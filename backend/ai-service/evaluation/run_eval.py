"""Evaluation runner for the OptiJob AI pipeline.

Run from backend/ai-service:

    python -m evaluation.run_eval analysis     # requirement extraction + evidence check + score
    python -m evaluation.run_eval retrieval    # job search: recall@k, MRR, duplicate handling
    python -m evaluation.run_eval sampling     # effect of temperature and top-k on accuracy and repeatability

It calls the same pipeline functions the API uses, against the golden datasets in
evaluation/golden/. Responses are cached on disk, so an interrupted run resumes for free.
"""

from __future__ import annotations

import argparse
import asyncio
import dataclasses
import json
import os
import re
import statistics
import sys
from datetime import date, datetime, timezone
from pathlib import Path

from app.cache import Cache, FileCache, NullCache
from app.config import Settings, load_settings
from app.gemini_client import CallRecord, GeminiClient
from app.guardrails import normalize_for_match, prepare_text
from app.job_index import Candidate, collapse_duplicates, cosine, dedupe_key, job_text
from app.pipeline import (
    PipelineContext,
    Requirement,
    assess_requirements,
    extract_requirements,
    weighted_score,
)
from app.schemas import JobDocument

ROOT = Path(__file__).resolve().parent
GOLDEN = ROOT / "golden"
RESULTS = ROOT / "results"
CACHE_DIR = ROOT / ".cache"


# --- setup -----------------------------------------------------------------------------------

def load_env_file() -> None:
    """Pick up GEMINI_API_KEY from backend/.env when it is not already in the environment."""
    env_file = ROOT.parent.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        name, separator, value = line.partition("=")
        if separator and name.strip().startswith("GEMINI_") and name.strip() not in os.environ:
            os.environ[name.strip()] = value.strip().strip('"')


def evaluation_settings(args: argparse.Namespace, **overrides: object) -> Settings:
    base = load_settings()
    return dataclasses.replace(
        base,
        model=args.model or base.model,
        # One model per run: a silent switch to the fallback would mix two models in one result.
        fallback_model="",
        max_attempts=6,
        max_retry_wait_seconds=70,
        requests_per_minute=args.rpm,
        max_concurrency=args.concurrency,
        **overrides,
    )


class PrefixedCache:
    """Separates repeated runs of the same request, so a repeat is a real second call."""

    def __init__(self, inner: Cache, prefix: str):
        self._inner, self._prefix = inner, prefix

    async def get(self, key: str) -> dict | None:
        return await self._inner.get(f"{self._prefix}:{key}")

    async def set(self, key: str, stage: str, value: dict) -> None:
        await self._inner.set(f"{self._prefix}:{key}", stage, value)


def percentile(values: list[float], share: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(share * (len(ordered) - 1)))]


def call_stats(records: list[CallRecord], settings: Settings) -> dict:
    """Latency and token usage per stage, from live (non-cached) calls only."""
    stats: dict[str, dict] = {}
    for stage in sorted({record.stage for record in records}):
        live = [record for record in records if record.stage == stage and record.ok and not record.cached]
        latencies = [record.latency_ms / 1000 for record in live]
        stats[stage] = {
            "live_calls": len(live),
            "cached_calls": sum(record.cached for record in records if record.stage == stage),
            "failed_calls": sum(not record.ok for record in records if record.stage == stage),
            "retries": sum(record.attempts - 1 for record in live),
            "mean_latency_s": round(statistics.mean(latencies), 2) if latencies else None,
            "p95_latency_s": round(percentile(latencies, 0.95), 2) if latencies else None,
            "mean_prompt_tokens": round(statistics.mean(record.prompt_tokens for record in live)) if live else None,
            "mean_output_tokens": round(statistics.mean(record.output_tokens + record.thought_tokens for record in live)) if live else None,
        }
    price_in, price_out = settings.price_input_per_million, settings.price_output_per_million
    if price_in is not None and price_out is not None:
        for stage_stats in stats.values():
            if stage_stats["mean_prompt_tokens"] is not None:
                stage_stats["mean_cost_usd"] = round(
                    (stage_stats["mean_prompt_tokens"] * price_in + stage_stats["mean_output_tokens"] * price_out) / 1_000_000, 6,
                )
    return stats


def classification(pairs: list[tuple[bool, bool]]) -> dict:
    """Metrics for (expected_matched, predicted_matched) pairs; "matched" is the positive class."""
    tp = sum(expected and predicted for expected, predicted in pairs)
    fp = sum(not expected and predicted for expected, predicted in pairs)
    fn = sum(expected and not predicted for expected, predicted in pairs)
    tn = sum(not expected and not predicted for expected, predicted in pairs)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "decisions": len(pairs),
        "accuracy": round((tp + tn) / len(pairs), 4) if pairs else None,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0,
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
    }


# --- dataset ---------------------------------------------------------------------------------

def load_analysis_cases(limit: int | None, split: str = "all") -> tuple[date, list[dict]]:
    """Load cases and tag each with its split: "dev" (used to tune prompts) or "test" (held out)."""
    data = json.loads((GOLDEN / "analysis.json").read_text(encoding="utf-8"))
    dev = set(data["dev_cases"])
    cases = []
    for case in data["cases"]:
        case_split = "dev" if case["id"] in dev else "test"
        if split in ("all", case_split):
            cases.append({**case, "tags": [*case["tags"], f"split:{case_split}"]})
    return date.fromisoformat(data["today"]), cases[:limit] if limit else cases


def case_text(case: dict, field: str) -> str:
    if f"{field}_file" in case:
        return (ROOT / case[f"{field}_file"]).read_text(encoding="utf-8")
    return "\n".join(case[field])


def golden_requirements(case: dict) -> list[Requirement]:
    return [
        Requirement(index + 1, item["requirement"], item["importance"], item["category"], item["jobEvidence"])
        for index, item in enumerate(case["requirements"])
    ]


def map_to_extracted(golden_item: dict, extracted: list[Requirement]) -> list[Requirement]:
    """Find which extracted requirements correspond to a golden one: by label first, then by vacancy quote."""
    pattern = re.compile(golden_item["pattern"], re.IGNORECASE)
    by_label = [item for item in extracted if pattern.search(normalize_for_match(item.requirement))]
    return by_label or [item for item in extracted if pattern.search(normalize_for_match(item.job_evidence))]


# --- analysis suite --------------------------------------------------------------------------

async def run_analysis_case(ctx: PipelineContext, case: dict, today: date) -> dict:
    cv = prepare_text(case_text(case, "cv"))
    job = prepare_text(case_text(case, "job"))
    golden = golden_requirements(case)

    extraction = await extract_requirements(ctx, job)
    # (1) Evidence check alone: the model gets the golden requirement list.
    on_golden = await assess_requirements(ctx, cv, golden, today)
    # (2) End to end: the model checks the requirements it extracted itself.
    end_to_end = await assess_requirements(ctx, cv, extraction.requirements, today)
    verdict = {item.requirement.id: item for item in end_to_end.assessments}

    rows = []
    for golden_item, assessed in zip(case["requirements"], on_golden.assessments, strict=True):
        mapped = map_to_extracted(golden_item, extraction.requirements)
        rows.append({
            "requirement": golden_item["requirement"],
            "expected": golden_item["expected"] == "matched",
            "assessment_predicted": assessed.matched,
            "assessment_evidence": assessed.cv_evidence,
            "assessment_advice": assessed.advice,
            "extracted_as": [item.requirement for item in mapped],
            "importance_agrees": mapped[0].importance == golden_item["importance"] if mapped else None,
            "end_to_end_predicted": any(verdict[item.id].matched for item in mapped),
        })

    covered_ids = {item.id for golden_item in case["requirements"] for item in map_to_extracted(golden_item, extraction.requirements)}
    return {
        "id": case["id"],
        "tags": case["tags"],
        "rows": rows,
        "extracted": [item.requirement for item in extraction.requirements],
        "extra_extracted": [item.requirement for item in extraction.requirements if item.id not in covered_ids],
        "dropped_vacancy_quotes": extraction.dropped,
        "claimed_matches": sum(item.matched for item in on_golden.assessments) + on_golden.unverified_quotes,
        "unverified_quotes": on_golden.unverified_quotes,
        "unassessed": on_golden.unassessed,
        "injection_flagged": bool(cv.injections or job.injections),
        "pii_redactions": cv.pii_redactions,
        "golden_score": weighted_score([
            (requirement.weight, item["expected"] == "matched")
            for requirement, item in zip(golden, case["requirements"], strict=True)
        ]),
        "predicted_score": weighted_score([(item.requirement.weight, item.matched) for item in end_to_end.assessments]),
    }


async def run_analysis(args: argparse.Namespace) -> dict:
    settings = evaluation_settings(args)
    records: list[CallRecord] = []
    llm = GeminiClient(settings, sink=records.append)
    cache: Cache = NullCache() if args.no_cache else FileCache(CACHE_DIR / f"analysis-{settings.model}.json")
    ctx = PipelineContext(llm=llm, cache=cache)
    today, cases = load_analysis_cases(args.limit, args.split)
    try:
        results = []
        for index, case in enumerate(cases, start=1):
            print(f"[{index}/{len(cases)}] {case['id']}", flush=True)
            results.append(await run_analysis_case(ctx, case, today))
    finally:
        await llm.aclose()

    rows = [(case, row) for case in results for row in case["rows"]]
    scored = [case for case in results if case["rows"]]
    empty = [case for case in results if not case["rows"]]
    claimed = sum(case["claimed_matches"] for case in results)
    extracted_total = sum(len(case["extracted"]) for case in results)
    dropped_total = sum(case["dropped_vacancy_quotes"] for case in results)
    importance = [row["importance_agrees"] for _, row in rows if row["importance_agrees"] is not None]

    def by_tag(field: str) -> dict:
        tags = sorted({tag for case in results for tag in case["tags"]})
        return {
            tag: classification([(row["expected"], row[field]) for case, row in rows if tag in case["tags"]])
            for tag in tags if any(tag in case["tags"] and case["rows"] for case in results)
        }

    return {
        "suite": "analysis",
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": settings.model,
        "model_versions": sorted({record.model_version for record in records if record.model_version}),
        "generation_config": llm.generation_config(),
        "prompt_versions": sorted({record.prompt_version for record in records if record.prompt_version}),
        "cases": len(results),
        "labelled_requirements": len(rows),
        "assessment": {
            **classification([(row["expected"], row["assessment_predicted"]) for _, row in rows]),
            "model_claimed_matches": claimed,
            "unverified_quotes": sum(case["unverified_quotes"] for case in results),
            "quote_validity": round(1 - sum(case["unverified_quotes"] for case in results) / claimed, 4) if claimed else None,
            "unassessed_requirements": sum(case["unassessed"] for case in results),
        },
        "extraction": {
            "golden_requirements_found": sum(bool(row["extracted_as"]) for _, row in rows),
            "coverage": round(sum(bool(row["extracted_as"]) for _, row in rows) / len(rows), 4) if rows else None,
            "importance_agreement": round(sum(importance) / len(importance), 4) if importance else None,
            "mean_extracted_per_vacancy": round(statistics.mean(len(case["extracted"]) for case in scored), 2) if scored else None,
            "extra_requirements": sum(len(case["extra_extracted"]) for case in scored),
            "vacancy_quote_validity": round(extracted_total / (extracted_total + dropped_total), 4) if extracted_total + dropped_total else None,
            "empty_vacancies_handled": f"{sum(not case['extracted'] for case in empty)}/{len(empty)}",
        },
        "end_to_end": {
            **classification([(row["expected"], row["end_to_end_predicted"]) for _, row in rows]),
            "score_mean_absolute_error": round(statistics.mean(abs(case["golden_score"] - case["predicted_score"]) for case in scored), 2) if scored else None,
            "scores": {case["id"]: {"golden": case["golden_score"], "predicted": case["predicted_score"]} for case in scored},
        },
        "assessment_by_tag": by_tag("assessment_predicted"),
        "end_to_end_by_tag": by_tag("end_to_end_predicted"),
        "guardrails": {
            "cases_with_injection_flag": [case["id"] for case in results if case["injection_flagged"]],
            "contact_details_redacted": sum(case["pii_redactions"] for case in results),
        },
        "calls": call_stats(records, settings),
        "disagreements": [
            {
                "case": case["id"],
                "requirement": row["requirement"],
                "expected": "matched" if row["expected"] else "missing",
                "assessment": "matched" if row["assessment_predicted"] else "missing",
                "end_to_end": "matched" if row["end_to_end_predicted"] else "missing",
                "extracted_as": row["extracted_as"],
                "evidence": row["assessment_evidence"],
                "advice": row["assessment_advice"],
            }
            for case, row in rows
            if row["expected"] != row["assessment_predicted"] or row["expected"] != row["end_to_end_predicted"]
        ],
        "extra_requirements_by_case": {case["id"]: case["extra_extracted"] for case in scored if case["extra_extracted"]},
    }


# --- sampling suite --------------------------------------------------------------------------

SAMPLING_CONFIGS = [
    ("temperature 0", {"temperature": 0.0, "top_k": None, "top_p": None}),
    ("temperature 1", {"temperature": 1.0, "top_k": None, "top_p": None}),
    ("temperature 1, top_k 1", {"temperature": 1.0, "top_k": 1, "top_p": None}),
    ("temperature 2", {"temperature": 2.0, "top_k": None, "top_p": None}),
]


async def run_sampling(args: argparse.Namespace) -> dict:
    today, cases = load_analysis_cases(args.limit, args.split)
    cases = [case for case in cases if case["requirements"]]
    report = {"suite": "sampling", "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "repeats": args.repeats, "cases": len(cases), "configs": []}
    for name, overrides in SAMPLING_CONFIGS:
        settings = evaluation_settings(args, **overrides)
        report["model"] = settings.model
        records: list[CallRecord] = []
        llm = GeminiClient(settings, sink=records.append)
        disk: Cache = NullCache() if args.no_cache else FileCache(CACHE_DIR / f"sampling-{settings.model}.json")
        verdicts: list[list[bool]] = []  # one list of verdicts per repeat
        expected: list[bool] = []
        try:
            for repeat in range(args.repeats):
                print(f"{name}: repeat {repeat + 1}/{args.repeats}", flush=True)
                ctx = PipelineContext(llm=llm, cache=PrefixedCache(disk, f"repeat{repeat}"))
                run: list[bool] = []
                for case in cases:
                    result = await assess_requirements(ctx, prepare_text(case_text(case, "cv")), golden_requirements(case), today)
                    run.extend(item.matched for item in result.assessments)
                    if repeat == 0:
                        expected.extend(item["expected"] == "matched" for item in case["requirements"])
                verdicts.append(run)
        finally:
            await llm.aclose()
        accuracies = [classification(list(zip(expected, run, strict=True)))["accuracy"] for run in verdicts]
        stable = sum(len({run[index] for run in verdicts}) == 1 for index in range(len(expected)))
        report["configs"].append({
            "name": name,
            "generation_config": llm.generation_config(),
            "accuracy_mean": round(statistics.mean(accuracies), 4),
            "accuracy_min": min(accuracies),
            "accuracy_max": max(accuracies),
            # Share of requirements that got the same verdict in every repeat.
            "verdict_stability": round(stable / len(expected), 4),
            "decisions_per_run": len(expected),
            "calls": call_stats(records, settings).get("assessment"),
        })
    return report


# --- retrieval suite -------------------------------------------------------------------------

def ranking_metrics(ranked: list[list[str]], relevant: list[set[str]]) -> dict:
    def recall_at(k: int) -> float:
        return round(statistics.mean(len(set(hits[:k]) & wanted) / len(wanted) for hits, wanted in zip(ranked, relevant, strict=True)), 4)

    reciprocal = [
        next((1 / rank for rank, job_id in enumerate(hits, start=1) if job_id in wanted), 0.0)
        for hits, wanted in zip(ranked, relevant, strict=True)
    ]
    return {"recall@1": recall_at(1), "recall@3": recall_at(3), "recall@5": recall_at(5), "recall@10": recall_at(10), "mrr": round(statistics.mean(reciprocal), 4)}


async def run_retrieval(args: argparse.Namespace) -> dict:
    settings = evaluation_settings(args)
    records: list[CallRecord] = []
    llm = GeminiClient(settings, sink=records.append)
    data = json.loads((GOLDEN / "retrieval.json").read_text(encoding="utf-8"))
    jobs, queries = data["jobs"], data["queries"]
    canonical = {job["id"]: job.get("duplicate_of", job["id"]) for job in jobs}
    relevant = [set(query["relevant"]) for query in queries]
    report = {
        "suite": "retrieval",
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "embedding_model": settings.embedding_model,
        "embedding_dimensions": settings.embedding_dimensions,
        "duplicate_similarity": settings.duplicate_similarity,
        "jobs": len(jobs),
        "duplicate_postings": sum("duplicate_of" in job for job in jobs),
        "queries": len(queries),
        "modes": {},
    }
    try:
        query_vectors = await llm.embed([query["profile"] for query in queries], task_type="RETRIEVAL_QUERY")
        for mode in ("title and description", "title only"):
            documents = [
                JobDocument(job_id=job["id"], title=job["title"], company=job["company"], description=job["description"] if mode == "title and description" else "")
                for job in jobs
            ]
            job_vectors = await llm.embed([job_text(document) for document in documents], task_type="RETRIEVAL_DOCUMENT")
            raw_ranked, collapsed_ranked = [], []
            raw_duplicates = collapsed_duplicates = 0
            relevant_similarities, other_similarities = [], []
            for query_vector, wanted in zip(query_vectors, relevant, strict=True):
                candidates = sorted(
                    (Candidate(document.job_id, cosine(query_vector, vector), dedupe_key(document), vector) for document, vector in zip(documents, job_vectors, strict=True)),
                    key=lambda item: -item.similarity,
                )
                for candidate in candidates:
                    (relevant_similarities if canonical[candidate.job_id] in wanted else other_similarities).append(candidate.similarity)
                raw = [canonical[item.job_id] for item in candidates]
                raw_ranked.append(raw)
                raw_duplicates += len(raw[:5]) - len(set(raw[:5]))
                chosen, _ = collapse_duplicates(candidates, top_k=10, min_similarity=-1, duplicate_similarity=settings.duplicate_similarity)
                collapsed = [canonical[item.job_id] for item in chosen]
                collapsed_ranked.append(collapsed)
                collapsed_duplicates += len(collapsed[:5]) - len(set(collapsed[:5]))
            report["modes"][mode] = {
                **ranking_metrics(collapsed_ranked, relevant),
                "duplicate_results_in_top5_before_collapse": raw_duplicates,
                "duplicate_results_in_top5_after_collapse": collapsed_duplicates,
                "relevant_similarity_min": round(min(relevant_similarities), 3),
                "relevant_similarity_mean": round(statistics.mean(relevant_similarities), 3),
                "other_similarity_mean": round(statistics.mean(other_similarities), 3),
                "other_similarity_max": round(max(other_similarities), 3),
            }
    finally:
        await llm.aclose()
    report["calls"] = call_stats(records, settings)
    return report


# --- entry point -----------------------------------------------------------------------------

async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("suite", choices=["analysis", "retrieval", "sampling"])
    parser.add_argument("--model", help="Generation model to evaluate (default: GEMINI_MODEL).")
    parser.add_argument("--limit", type=int, help="Use only the first N cases.")
    parser.add_argument("--split", choices=["all", "dev", "test"], default="all", help="dev = cases used to tune prompts, test = held out.")
    parser.add_argument("--repeats", type=int, default=3, help="Repeats per configuration in the sampling suite.")
    parser.add_argument("--rpm", type=int, default=15, help="Request-per-minute budget for this run.")
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--no-cache", action="store_true", help="Ignore and do not write the on-disk response cache.")
    parser.add_argument("--out", type=Path, help="Where to write the JSON report.")
    args = parser.parse_args()

    load_env_file()
    report = await {"analysis": run_analysis, "retrieval": run_retrieval, "sampling": run_sampling}[args.suite](args)

    suffix = f"-{args.model}" if args.model else ""
    out = args.out or RESULTS / f"{args.suite}{suffix}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = {key: value for key, value in report.items() if key not in {"disagreements", "extra_requirements_by_case"}}
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"\nReport written to {out}")


if __name__ == "__main__":
    asyncio.run(main())
