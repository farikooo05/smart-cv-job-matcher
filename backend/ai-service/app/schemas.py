from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    cv_text: str = Field(min_length=1, max_length=30_000)
    job_description: str = Field(min_length=1, max_length=30_000)


class JobInfo(BaseModel):
    title: str
    company: str
    date: str


class RequirementAssessment(BaseModel):
    requirement: str = Field(min_length=1, max_length=160)
    status: Literal["matched", "missing"]
    jobEvidence: str
    cvEvidence: str


class GeminiAssessmentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job: JobInfo
    cvKeywords: list[str] = Field(max_length=30)
    jdKeywords: list[str] = Field(max_length=30)
    requirementAssessments: list[RequirementAssessment] = Field(max_length=10)


class SkillSummary(BaseModel):
    matched: int = Field(ge=0)
    missing: int = Field(ge=0)


class Suggestion(BaseModel):
    type: Literal["improvement", "warning", "positive"]
    title: str
    description: str
    actionLabel: str
    actionUrl: str


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


class IndexResumeRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    cv_text: str = Field(min_length=1, max_length=30_000)


class IndexResumeResponse(BaseModel):
    indexed_chunks: int = Field(ge=0)
    embedding_model: str


class SearchResumeRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    requirements: list[str] = Field(min_length=1, max_length=10)
    top_k: int = Field(default=4, ge=1, le=10)

    @field_validator("requirements")
    @classmethod
    def validate_requirements(cls, requirements: list[str]) -> list[str]:
        if any(not item.strip() or len(item) > 300 for item in requirements):
            raise ValueError("Each requirement must contain 1 to 300 characters.")
        return [item.strip() for item in requirements]


class RetrievedChunk(BaseModel):
    chunk_id: int
    section: str
    text: str
    similarity: float = Field(ge=-1, le=1)


class SearchResumeResponse(BaseModel):
    results: dict[str, list[RetrievedChunk]]
