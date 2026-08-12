from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StringConstraints,
    field_validator,
    model_validator,
)

NonEmptyString = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1),
]
SlideTitle = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]
SpeakerNotes = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=2000),
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SourceType(StrEnum):
    PROMPT = "prompt"
    DOCUMENT = "document"


class Tone(StrEnum):
    PROFESSIONAL = "professional"
    CASUAL = "casual"
    ACADEMIC = "academic"
    PERSUASIVE = "persuasive"


class PresentationStatus(StrEnum):
    DRAFT = "draft"
    FINAL = "final"


class VisualRecommendation(StrictModel):
    type: Literal["chart", "image", "diagram", "icon", "quote"]
    description: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=500),
    ]
    search_keywords: list[NonEmptyString] = Field(min_length=1, max_length=5)


class AudienceQuestion(StrictModel):
    question: NonEmptyString
    suggested_answer: NonEmptyString


class Slide(StrictModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    slide_number: int = Field(ge=1)
    title: SlideTitle
    key_points: list[NonEmptyString] = Field(min_length=1, max_length=5)
    speaker_notes: SpeakerNotes
    visual_recommendation: VisualRecommendation
    audience_questions: list[AudienceQuestion]


class Presentation(StrictModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    presentation_id: UUID
    title: NonEmptyString
    summary: NonEmptyString
    estimated_duration_minutes: int = Field(ge=1)
    source: SourceType
    audience: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    ]
    tone: Tone
    slide_count: int = Field(ge=5, le=10)
    status: PresentationStatus
    slides: list[Slide]
    created_at: datetime
    updated_at: datetime


class GeneratePresentationRequest(StrictModel):
    source: SourceType
    topic: str | None = None
    document_id: UUID | None = None
    audience: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
    ]
    tone: Tone
    # Member 4's contract explicitly clamps integers to 5-10. The public Gateway
    # still rejects out-of-range values before they reach this internal endpoint.
    slide_count: StrictInt

    @field_validator("topic")
    @classmethod
    def normalize_topic(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @model_validator(mode="after")
    def validate_source_fields(self) -> GeneratePresentationRequest:
        if self.source is SourceType.PROMPT:
            if self.topic is None or len(self.topic) < 10:
                raise ValueError("topic is required and must contain at least 10 characters")
            if self.document_id is not None:
                raise ValueError("document_id must not be supplied when source is prompt")
        else:
            if self.document_id is None:
                raise ValueError("document_id is required when source is document")
            if self.topic is not None:
                raise ValueError("topic must not be supplied when source is document")
        return self


class SlideUpdate(StrictModel):
    title: SlideTitle | None = None
    key_points: list[NonEmptyString] | None = Field(default=None, min_length=1, max_length=5)
    speaker_notes: SpeakerNotes | None = None
    visual_recommendation: VisualRecommendation | None = None
    audience_questions: list[AudienceQuestion] | None = None

    @model_validator(mode="after")
    def require_non_null_update(self) -> SlideUpdate:
        if not self.model_fields_set:
            raise ValueError("at least one slide field is required")
        null_fields = [name for name in self.model_fields_set if getattr(self, name) is None]
        if null_fields:
            raise ValueError(f"slide fields cannot be null: {', '.join(sorted(null_fields))}")
        return self


class RegenerateSlideRequest(StrictModel):
    instructions: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=1, max_length=500),
    ] | None = None


class AIGenerateDeckRequest(StrictModel):
    topic: NonEmptyString
    audience: NonEmptyString
    tone: Tone
    slide_count: int = Field(ge=5, le=10)
    source: SourceType


class AIGenerateDeckResponse(StrictModel):
    title: NonEmptyString
    summary: NonEmptyString
    estimated_duration_minutes: int = Field(ge=1)
    slides: list[Slide]


class PresentationContext(StrictModel):
    title: NonEmptyString
    audience: NonEmptyString
    tone: Tone
    all_slide_titles: list[NonEmptyString]


class AIGenerateSlideRequest(StrictModel):
    presentation_context: PresentationContext
    slide_number: int = Field(ge=1)
    current_slide: Slide | None = None
    instructions: str | None = None


class DocumentTextResponse(StrictModel):
    document_id: UUID
    extracted_text: str
    char_count: int = Field(ge=0)

    @model_validator(mode="after")
    def ensure_text_is_usable(self) -> DocumentTextResponse:
        if not self.extracted_text.strip():
            raise ValueError("extracted document text is empty")
        return self


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    service: Literal["presentation-orchestrator"] = "presentation-orchestrator"
    db: Literal["connected", "disconnected"]


class ErrorBody(StrictModel):
    code: Literal["VALIDATION_ERROR", "NOT_FOUND", "AI_FAILURE", "INTERNAL_ERROR"]
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(StrictModel):
    error: ErrorBody
