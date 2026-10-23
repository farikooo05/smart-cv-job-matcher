from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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
