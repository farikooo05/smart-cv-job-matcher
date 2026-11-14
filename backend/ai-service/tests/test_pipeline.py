"""Pipeline tests with a fake model: they check what the code does with the model's answer, without the network."""

import asyncio
from dataclasses import replace

from app.cache import MemoryCache
from app.config import load_settings
from app.gemini_client import CallRecord
from app.pipeline import PipelineContext, analyze, extract_profile, weighted_score
from app.schemas import LlmAssessments, LlmProfile, LlmRequirements

CV = "Skills: Python, PostgreSQL\nEnglish – B2\nPhone: +994 00 000 00 00"
JOB = "Backend Developer at Nova\nRequirements: Python, SQL, Kubernetes. Teamwork. Nice to have: AWS."


class FakeLlm:
    """Returns canned answers per stage and counts calls."""

    def __init__(self, answers: dict):
        self.settings = replace(load_settings(), model="fake-model")
        self.answers = answers
        self.calls: list[str] = []
        self.prompts: list[str] = []

    def generation_config(self) -> dict:
        return {"temperature": 0.0}

    def emit(self, record: CallRecord) -> None:
        pass

    async def generate_json(self, *, stage, prompt_version, system, prompt, schema, response_model, max_output_tokens=8192):
        self.calls.append(stage)
        self.prompts.append(prompt)
        record = CallRecord(stage=stage, prompt_version=prompt_version, model="fake-model", model_version="fake-model", prompt_tokens=100, output_tokens=20)
        return response_model.model_validate(self.answers[stage]), record


def requirement(label, quote, importance="required", category="skill"):
    return {"jobEvidence": quote, "requirement": label, "importance": importance, "category": category}


ANSWERS = {
    "requirements": LlmRequirements(title="Backend Developer", company="Nova", requirements=[
        requirement("Python", "Python"),
        requirement("SQL", "SQL"),
        requirement("Kubernetes", "Kubernetes"),
        requirement("Teamwork", "Teamwork", category="soft_skill"),
        requirement("AWS", "Nice to have: AWS", importance="preferred"),
        requirement("Go", "5 years of Go"),  # the quote is not in the vacancy: must be dropped
    ]).model_dump(),
    "assessment": LlmAssessments(cvKeywords=["Python", "PostgreSQL", "Docker"], assessments=[
        {"id": 1, "cvEvidence": "Skills: Python, PostgreSQL", "status": "matched", "advice": ""},
        {"id": 2, "cvEvidence": "PostgreSQL", "status": "matched", "advice": ""},
        {"id": 3, "cvEvidence": "Managed Kubernetes clusters", "status": "matched", "advice": ""},  # invented quote
        {"id": 4, "cvEvidence": "", "status": "missing", "advice": "Name teamwork. See https://example.com/tips"},
        # id 5 has no verdict at all
    ]).model_dump(),
    "profile": LlmProfile(fullName="Nobody Here", summary="A backend developer.", skills=[
        {"source": "Python, PostgreSQL", "en": "Python", "az": "Python", "ru": "Python"},
        {"source": "Kubernetes expert", "en": "Kubernetes", "az": "", "ru": ""},  # not in the CV
    ]).model_dump(),
}


def run(coroutine):
    return asyncio.run(coroutine)


def test_weighted_score():
    assert weighted_score([(1.0, True), (1.0, False)]) == 50
    assert weighted_score([(1.0, True), (0.5, False)]) == 67
    assert weighted_score([]) == 0


def test_analysis_keeps_only_verified_results():
    llm = FakeLlm(ANSWERS)
    result = run(analyze(PipelineContext(llm=llm, cache=MemoryCache()), CV, JOB))

    assert result.jdKeywords == ["Python", "SQL", "Kubernetes", "Teamwork", "AWS"]  # "Go" dropped
    assert result.meta.droppedRequirements == 1
    assert [item.split(" — ")[0] for item in result.matchingSkills] == ["Python", "SQL"]
    assert result.missingRequirements == ["Kubernetes", "Teamwork", "AWS"]
    assert result.meta.unverifiedQuotes == 1  # the invented Kubernetes quote
    assert result.meta.unassessedRequirements == 1  # AWS had no verdict
    # weights: Python 1, SQL 1, Kubernetes 1, Teamwork 0.5, AWS 0.5 -> 2 / 4
    assert result.compatibilityScore == 50
    assert result.cvKeywords == ["Python", "PostgreSQL"]  # "Docker" is not in the CV
    assert result.job.title == "Backend Developer" and result.job.company == "Nova"
    assert all("http" not in suggestion.description for suggestion in result.suggestions)
    assert all(suggestion.actionUrl == "" for suggestion in result.suggestions)


def test_contact_details_never_reach_the_model():
    llm = FakeLlm(ANSWERS)
    result = run(analyze(PipelineContext(llm=llm, cache=MemoryCache()), CV, JOB))
    assert result.meta.piiRedactions == 1
    assert all("+994" not in prompt for prompt in llm.prompts)


def test_identical_request_is_served_from_cache():
    llm = FakeLlm(ANSWERS)
    ctx = PipelineContext(llm=llm, cache=MemoryCache())
    first = run(analyze(ctx, CV, JOB))
    second = run(analyze(ctx, CV, JOB))
    assert llm.calls == ["requirements", "assessment"]  # no new calls for the repeat
    assert second.meta.cached and not first.meta.cached
    assert second.compatibilityScore == first.compatibilityScore


def test_same_vacancy_is_extracted_once_for_different_cvs():
    llm = FakeLlm(ANSWERS)
    ctx = PipelineContext(llm=llm, cache=MemoryCache())
    run(analyze(ctx, CV, JOB))
    run(analyze(ctx, CV + "\nGit", JOB))
    assert llm.calls == ["requirements", "assessment", "assessment"]


def test_vacancy_without_requirements():
    llm = FakeLlm({**ANSWERS, "requirements": LlmRequirements(requirements=[]).model_dump()})
    result = run(analyze(PipelineContext(llm=llm, cache=MemoryCache()), CV, "Marketing Manager, Baku office"))
    assert result.compatibilityScore == 0 and result.requirements == []
    assert llm.calls == ["requirements"]  # nothing to assess, so no second call
    assert "No checkable requirements" in result.summary


def test_profile_keeps_only_skills_found_in_the_cv():
    llm = FakeLlm(ANSWERS)
    profile = run(extract_profile(PipelineContext(llm=llm, cache=MemoryCache()), CV))
    assert profile.keywords == ["Python"]
    assert profile.fullName == ""  # the name the model returned is not in the CV
    assert "+994" not in profile.parsedText and "[phone]" in profile.parsedText
