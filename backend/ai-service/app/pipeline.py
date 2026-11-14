"""The analysis pipeline.

    input guardrails -> extract requirements (LLM) -> verify vacancy quotes
                     -> check evidence (LLM)       -> verify CV quotes -> score

The model only ever proposes. Whether a requirement exists and whether it is matched
is decided here, by checking the model's quotes against the source text, and the score
is plain arithmetic over the verified results.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from datetime import date
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from .cache import Cache, cache_key
from .gemini_client import CallRecord, GeminiClient
from .guardrails import PreparedText, neutralize_delimiters, normalize_for_match, prepare_text
from .prompts import (
    ASSESSMENT_PROMPT,
    ASSESSMENT_SCHEMA,
    ASSESSMENT_SYSTEM,
    PROFILE_PROMPT,
    PROFILE_SCHEMA,
    PROFILE_SYSTEM,
    PROMPT_VERSIONS,
    REQUIREMENTS_PROMPT,
    REQUIREMENTS_SCHEMA,
    REQUIREMENTS_SYSTEM,
)
from .schemas import (
    MAX_REQUIREMENTS,
    AnalysisMeta,
    AnalysisResponse,
    JobInfo,
    LlmAssessments,
    LlmProfile,
    LlmRequirements,
    MultilingualSkill,
    ProfileResponse,
    RequirementResult,
    SkillSummary,
    Suggestion,
)

# A nice-to-have or a soft skill counts half as much as a hard requirement.
IMPORTANCE_WEIGHTS = {"required": 1.0, "preferred": 0.5}
SOFT_SKILL_WEIGHT = 0.5
MAX_SUGGESTIONS = 4
DEFAULT_ADVICE = (
    "The CV has no verifiable evidence for this requirement. "
    "If you have this experience, add a specific example."
)
_URL = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)

ModelT = TypeVar("ModelT", bound=BaseModel)


@dataclass
class PipelineContext:
    llm: GeminiClient
    cache: Cache


@dataclass
class Requirement:
    id: int
    requirement: str
    importance: str
    category: str
    job_evidence: str

    @property
    def weight(self) -> float:
        weight = IMPORTANCE_WEIGHTS[self.importance]
        return min(weight, SOFT_SKILL_WEIGHT) if self.category == "soft_skill" else weight


@dataclass
class Extraction:
    title: str
    company: str
    requirements: list[Requirement]
    dropped: int  # items the model returned whose vacancy quote could not be verified
    record: CallRecord


@dataclass
class Assessment:
    requirement: Requirement
    matched: bool
    cv_evidence: str
    advice: str


@dataclass
class AssessmentResult:
    assessments: list[Assessment] = field(default_factory=list)
    cv_keywords: list[str] = field(default_factory=list)
    unverified_quotes: int = 0  # the model said "matched" but its quote is not in the CV
    unassessed: int = 0  # the model returned no verdict for a requirement
    record: CallRecord | None = None


def _clean(text: str, limit: int) -> str:
    return " ".join(text.split())[:limit].strip()


def weighted_score(items: list[tuple[float, bool]]) -> int:
    """Share of requirement weight that has verified CV evidence, as a 0-100 integer."""
    total = sum(weight for weight, _ in items)
    return round(100 * sum(weight for weight, matched in items if matched) / total) if total else 0


async def _generate(
    ctx: PipelineContext,
    stage: str,
    system: str,
    prompt: str,
    schema: dict,
    response_model: type[ModelT],
) -> tuple[ModelT, CallRecord]:
    """One LLM stage, served from the cache when the exact same request was answered before."""
    version = PROMPT_VERSIONS[stage]
    settings = ctx.llm.settings
    key = cache_key(stage, version, settings.model, ctx.llm.generation_config(), system, prompt)

    cached = await ctx.cache.get(key)
    if cached is not None:
        try:
            result = response_model.model_validate(cached["result"])
        except (ValidationError, KeyError, TypeError):
            result = None
        if result is not None:
            record = CallRecord(
                stage=stage,
                prompt_version=version,
                model=settings.model,
                model_version=str(cached.get("model_version", "")),
                cached=True,
            )
            ctx.llm.emit(record)
            return result, record

    result, record = await ctx.llm.generate_json(
        stage=stage,
        prompt_version=version,
        system=system,
        prompt=prompt,
        schema=schema,
        response_model=response_model,
    )
    # An answer from the fallback model is not stored under the primary model's key.
    if record.model == settings.model:
        await ctx.cache.set(key, stage, {"result": result.model_dump(), "model_version": record.model_version})
    return result, record


async def extract_requirements(ctx: PipelineContext, job: PreparedText) -> Extraction:
    raw, record = await _generate(
        ctx,
        "requirements",
        REQUIREMENTS_SYSTEM,
        REQUIREMENTS_PROMPT.format(job_text=job.text),
        REQUIREMENTS_SCHEMA,
        LlmRequirements,
    )
    requirements: list[Requirement] = []
    seen: set[str] = set()
    dropped = 0
    for item in raw.requirements:
        label = _clean(neutralize_delimiters(item.requirement), 160)
        # A requirement is kept only if its quote really is in the vacancy.
        if not label or not job.contains(item.jobEvidence):
            dropped += 1
            continue
        key = normalize_for_match(label)
        if key in seen:
            continue
        seen.add(key)
        requirements.append(Requirement(
            id=len(requirements) + 1,
            requirement=label,
            importance=item.importance,
            category=item.category,
            job_evidence=_clean(item.jobEvidence, 400),
        ))
        if len(requirements) == MAX_REQUIREMENTS:
            break
    return Extraction(
        title=_clean(raw.title, 160) if job.contains(raw.title) else "",
        company=_clean(raw.company, 160) if job.contains(raw.company) else "",
        requirements=requirements,
        dropped=dropped,
        record=record,
    )


async def assess_requirements(
    ctx: PipelineContext,
    cv: PreparedText,
    requirements: list[Requirement],
    today: date | None = None,
) -> AssessmentResult:
    if not requirements:
        return AssessmentResult()
    listing = "\n".join(
        json.dumps(
            {
                "id": item.id,
                "requirement": item.requirement,
                "importance": item.importance,
                "vacancyQuote": item.job_evidence,
            },
            ensure_ascii=False,
        )
        for item in requirements
    )
    raw, record = await _generate(
        ctx,
        "assessment",
        ASSESSMENT_SYSTEM,
        ASSESSMENT_PROMPT.format(
            today=(today or date.today()).strftime("%B %Y"),
            requirements=listing,
            cv_text=cv.text,
        ),
        ASSESSMENT_SCHEMA,
        LlmAssessments,
    )

    verdicts = {}
    for verdict in raw.assessments:
        verdicts.setdefault(verdict.id, verdict)

    result = AssessmentResult(record=record)
    for requirement in requirements:
        verdict = verdicts.get(requirement.id)
        if verdict is None:
            result.unassessed += 1
            result.assessments.append(Assessment(requirement, False, "", DEFAULT_ADVICE))
        elif verdict.status == "matched":
            # The verdict stands only if the quote is verbatim CV text.
            if cv.contains(verdict.cvEvidence):
                result.assessments.append(Assessment(requirement, True, _clean(verdict.cvEvidence, 400), ""))
            else:
                result.unverified_quotes += 1
                result.assessments.append(Assessment(requirement, False, "", DEFAULT_ADVICE))
        else:
            advice = _clean(_URL.sub("", verdict.advice), 300)
            result.assessments.append(Assessment(requirement, False, "", advice or DEFAULT_ADVICE))

    for keyword in raw.cvKeywords:
        keyword = _clean(keyword, 60)
        if keyword and cv.contains(keyword) and keyword.casefold() not in {k.casefold() for k in result.cv_keywords}:
            result.cv_keywords.append(keyword)
    return result


def _join(labels: list[str]) -> str:
    return ", ".join(labels[:-1]) + " and " + labels[-1] if len(labels) > 1 else "".join(labels)


def _summary(assessments: list[Assessment]) -> str:
    if not assessments:
        return (
            "No checkable requirements were found in the job description. "
            "Paste the full vacancy text, including its requirements section."
        )
    matched = [item for item in assessments if item.matched]
    required = [item for item in assessments if item.requirement.importance == "required"]
    preferred = [item for item in assessments if item.requirement.importance == "preferred"]
    parts = [f"{sum(item.matched for item in required)} of {len(required)} required"] if required else []
    if preferred:
        parts.append(f"{sum(item.matched for item in preferred)} of {len(preferred)} nice-to-have")
    text = f"Your CV shows evidence for {len(matched)} of {len(assessments)} requirements ({', '.join(parts)})."
    gaps = [item.requirement.requirement for item in required if not item.matched][:3]
    if gaps:
        text += f" Not covered: {_join(gaps)}."
    return text


def _suggestions(assessments: list[Assessment]) -> list[Suggestion]:
    missing = sorted((item for item in assessments if not item.matched), key=lambda item: -item.requirement.weight)
    suggestions = [
        Suggestion(
            type="improvement",
            title=f"Add evidence for: {item.requirement.requirement}",
            description=item.advice,
            actionLabel="",
            actionUrl="",
        )
        for item in missing[:MAX_SUGGESTIONS]
    ]
    # Short labels of fully weighted requirements read best in one sentence.
    strongest = [
        item.requirement.requirement
        for item in assessments
        if item.matched and item.requirement.weight == 1.0 and len(item.requirement.requirement) <= 40
    ][:3]
    if assessments and not missing:
        suggestions.append(Suggestion(
            type="positive",
            title="Every listed requirement is covered",
            description="Your CV shows evidence for each requirement in this vacancy. Keep those phrases easy to find.",
            actionLabel="",
            actionUrl="",
        ))
    elif len(strongest) >= 2:
        suggestions.append(Suggestion(
            type="positive",
            title="Your strongest matches",
            description=f"The CV gives clear evidence for {_join(strongest)}. Keep these near the top of your CV.",
            actionLabel="",
            actionUrl="",
        ))
    return suggestions


def _meta(records: list[CallRecord], started: float, **signals: object) -> AnalysisMeta:
    live = [record for record in records if not record.cached]
    return AnalysisMeta(
        model=next((record.model_version or record.model for record in reversed(records)), ""),
        promptVersion="+".join(record.prompt_version for record in records),
        latencyMs=round((time.perf_counter() - started) * 1000),
        promptTokens=sum(record.prompt_tokens for record in live),
        outputTokens=sum(record.output_tokens + record.thought_tokens for record in live),
        cached=bool(records) and not live,
        **signals,
    )


def _warnings(cv: PreparedText | None, job: PreparedText | None) -> list[str]:
    warnings = []
    if cv and cv.injections:
        warnings.append("The CV contains text that looks like instructions to an AI system. It was not used as evidence.")
    if job and job.injections:
        warnings.append("The job description contains text that looks like instructions to an AI system. It was ignored.")
    return warnings


def build_analysis(
    extraction: Extraction,
    result: AssessmentResult,
    cv: PreparedText,
    job: PreparedText,
    started: float,
) -> AnalysisResponse:
    assessments = result.assessments
    matched = [item for item in assessments if item.matched]
    missing = [item for item in assessments if not item.matched]
    records = [extraction.record] + ([result.record] if result.record else [])
    return AnalysisResponse(
        job=JobInfo(title=extraction.title or "Job Opportunity", company=extraction.company or "Unknown", date=""),
        compatibilityScore=weighted_score([(item.requirement.weight, item.matched) for item in assessments]),
        skillsSummary=SkillSummary(matched=len(matched), missing=len(missing)),
        cvKeywords=result.cv_keywords,
        jdKeywords=[item.requirement.requirement for item in assessments],
        matchingSkills=[f"{item.requirement.requirement} — CV evidence: “{item.cv_evidence}”" for item in matched],
        missingRequirements=[item.requirement.requirement for item in missing],
        suggestions=_suggestions(assessments),
        summary=_summary(assessments),
        requirements=[
            RequirementResult(
                requirement=item.requirement.requirement,
                importance=item.requirement.importance,
                category=item.requirement.category,
                status="matched" if item.matched else "missing",
                jobEvidence=item.requirement.job_evidence,
                cvEvidence=item.cv_evidence,
                advice=item.advice,
            )
            for item in assessments
        ],
        meta=_meta(
            records,
            started,
            droppedRequirements=extraction.dropped,
            unverifiedQuotes=result.unverified_quotes,
            unassessedRequirements=result.unassessed,
            piiRedactions=cv.pii_redactions + job.pii_redactions,
            warnings=_warnings(cv, job),
        ),
    )


async def analyze(ctx: PipelineContext, cv_text: str, job_text: str) -> AnalysisResponse:
    started = time.perf_counter()
    cv = prepare_text(cv_text)
    job = prepare_text(job_text)
    extraction = await extract_requirements(ctx, job)
    result = await assess_requirements(ctx, cv, extraction.requirements)
    return build_analysis(extraction, result, cv, job, started)


async def extract_profile(ctx: PipelineContext, cv_text: str) -> ProfileResponse:
    started = time.perf_counter()
    cv = prepare_text(cv_text)
    raw, record = await _generate(
        ctx, "profile", PROFILE_SYSTEM, PROFILE_PROMPT.format(cv_text=cv.text), PROFILE_SCHEMA, LlmProfile,
    )
    skills: list[MultilingualSkill] = []
    seen: set[str] = set()
    for skill in raw.skills:
        name = _clean(skill.en, 60)
        # A skill is kept only if the phrase it was taken from is really in the CV.
        if not name or name.casefold() in seen or not cv.contains(skill.source):
            continue
        seen.add(name.casefold())
        skills.append(MultilingualSkill(en=name, az=_clean(skill.az, 60) or name, ru=_clean(skill.ru, 60) or name))
    return ProfileResponse(
        fullName=_clean(raw.fullName, 120) if cv.contains(raw.fullName) else "",
        keywords=[skill.en for skill in skills],
        multilingualSkills=skills,
        summary=_clean(raw.summary, 600),
        parsedText=cv.text,
        meta=_meta(
            [record],
            started,
            droppedRequirements=len(raw.skills) - len(skills),
            piiRedactions=cv.pii_redactions,
            warnings=_warnings(cv, None),
        ),
    )
