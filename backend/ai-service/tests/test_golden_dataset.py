"""Guards the golden dataset itself: a label with a typo would silently distort every metric."""

import json
import re
from pathlib import Path

from app.guardrails import normalize_for_match, prepare_text

EVALUATION = Path(__file__).resolve().parent.parent / "evaluation"
DATA = json.loads((EVALUATION / "golden" / "analysis.json").read_text(encoding="utf-8"))


def text(case, field):
    if f"{field}_file" in case:
        return (EVALUATION / case[f"{field}_file"]).read_text(encoding="utf-8")
    return "\n".join(case[field])


def test_every_labelled_quote_exists_in_its_source():
    for case in DATA["cases"]:
        cv, job = prepare_text(text(case, "cv")), prepare_text(text(case, "job"))
        for item in case["requirements"]:
            where = f'{case["id"]}: {item["requirement"]}'
            assert job.contains(item["jobEvidence"]), f"vacancy quote not found ({where})"
            assert item["expected"] in {"matched", "missing"}, where
            assert item["importance"] in {"required", "preferred"}, where
            if item["expected"] == "matched":
                assert cv.contains(item["cvEvidence"]), f"CV quote not found ({where})"
            else:
                assert "cvEvidence" not in item, where
            assert re.search(item["pattern"], normalize_for_match(item["requirement"]), re.IGNORECASE), where


def test_ids_are_unique_and_dev_cases_exist():
    ids = [case["id"] for case in DATA["cases"]]
    assert len(ids) == len(set(ids))
    assert set(DATA["dev_cases"]) <= set(ids)


def test_no_contact_details_in_the_published_demo_cv():
    cv = (EVALUATION / "demo" / "cv.anonymised.txt").read_text(encoding="utf-8")
    assert prepare_text(cv).pii_redactions == 0
    assert "linkedin" not in cv.lower() and "github.com" not in cv.lower()
