"""Request and response models for the HTTP API, plus the shapes the LLM must return."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_DOCUMENT_CHARS = 30_000
MAX_REQUIREMENTS = 20

Importance = Literal["required", "preferred"]
Category = Literal["skill", "experience", "education", "language", "certification", "soft_skill", "other"]
Status = Literal["matched", "missing"]


# --- What the model returns (validated before any of it is used) ---------------------------

class LlmRequirement(BaseModel):
    jobEvidence: str
    requirement: str
    importance: Importance
    category: Category


class LlmRequirements(BaseModel):
    title: str = ""
    company: str = ""
    requirements: list[LlmRequirement]


class LlmAssessment(BaseModel):
    id: int
    cvEvidence: str = ""
    status: Status
    advice: str = ""


class LlmAssessments(BaseModel):
    assessments: list[LlmAssessment]
    cvKeywords: list[str] = []


class LlmSkill(BaseModel):
    source: str
    en: str
    az: str = ""
    ru: str = ""


class LlmProfile(BaseModel):
    fullName: str = ""
    skills: list[LlmSkill]
    summary: str = ""


# --- /analyze --------------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    cv_text: str = Field(min_length=1, max_length=MAX_DOCUMENT_CHARS)
    job_description: str = Field(min_length=1, max_length=MAX_DOCUMENT_CHARS)


class JobInfo(BaseModel):
    title: str
    company: str
    date: str


class SkillSummary(BaseModel):
    matched: int = Field(ge=0)
    missing: int = Field(ge=0)


class Suggestion(BaseModel):
    type: Literal["improvement", "warning", "positive"]
    title: str
    description: str
    actionLabel: str
    actionUrl: str


class RequirementResult(BaseModel):
    requirement: str
    importance: Importance
    category: Category
    status: Status
    jobEvidence: str
    cvEvidence: str
    advice: str


class AnalysisMeta(BaseModel):
    requestId: str = ""
    model: str = ""
    promptVersion: str = ""
    latencyMs: int = 0
    promptTokens: int = 0
    outputTokens: int = 0
    cached: bool = False
    # Quality signals from the guardrails, also written to the pipeline_runs table.
    droppedRequirements: int = 0
    unverifiedQuotes: int = 0
    unassessedRequirements: int = 0
    piiRedactions: int = 0
    warnings: list[str] = []


class AnalysisResponse(BaseModel):
    job: JobInfo
    compatibilityScore: int = Field(ge=0, le=100)
    skillsSummary: SkillSummary
    cvKeywords: list[str]
    jdKeywords: list[str]
    matchingSkills: list[str]
    missingRequirements: list[str]
    suggestions: list[Suggestion]
    summary: str
    requirements: list[RequirementResult] = []
    meta: AnalysisMeta = AnalysisMeta()


# --- /profile --------------------------------------------------------------------------------

class ProfileRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    cv_text: str = Field(min_length=1, max_length=MAX_DOCUMENT_CHARS)


class MultilingualSkill(BaseModel):
    en: str
    az: str
    ru: str


class ProfileResponse(BaseModel):
    fullName: str
    keywords: list[str]
    multilingualSkills: list[MultilingualSkill]
    summary: str
    # The CV text after cleaning and contact-detail removal; this is what the backend stores.
    parsedText: str
    meta: AnalysisMeta = AnalysisMeta()


# --- /jobs -----------------------------------------------------------------------------------

class JobDocument(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    job_id: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=300)
    company: str = Field(default="", max_length=300)
    location: str = Field(default="", max_length=300)
    description: str = Field(default="", max_length=MAX_DOCUMENT_CHARS)


class IndexJobsRequest(BaseModel):
    jobs: list[JobDocument] = Field(min_length=1, max_length=500)


class IndexJobsResponse(BaseModel):
    embedded: int = Field(ge=0)
    unchanged: int = Field(ge=0)
    embedding_model: str


class SearchJobsRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    query_text: str = Field(min_length=1, max_length=MAX_DOCUMENT_CHARS)
    top_k: int | None = Field(default=None, ge=1, le=50)
    min_similarity: float | None = Field(default=None, ge=-1, le=1)
    job_ids: list[str] | None = Field(default=None, max_length=5000)


class JobHit(BaseModel):
    job_id: str
    similarity: float
    # Other indexed jobs judged to be the same vacancy (same title and company, or near-identical vector).
    duplicate_job_ids: list[str] = []


class SearchJobsResponse(BaseModel):
    results: list[JobHit]
    top_k: int
    candidates_considered: int
    duplicates_collapsed: int
