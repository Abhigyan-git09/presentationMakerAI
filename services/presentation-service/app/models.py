from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class PresentationModel(Base):
    __tablename__ = "presentations"
    __table_args__ = (
        CheckConstraint(
            "source IN ('prompt', 'document')",
            name="ck_presentations_source",
        ),
        CheckConstraint(
            "tone IN ('professional', 'casual', 'academic', 'persuasive')",
            name="ck_presentations_tone",
        ),
        CheckConstraint(
            "slide_count BETWEEN 5 AND 10",
            name="ck_presentations_slide_count",
        ),
        CheckConstraint(
            "status IN ('draft', 'final')",
            name="ck_presentations_status",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    audience: Mapped[str] = mapped_column(Text, nullable=False)
    tone: Mapped[str] = mapped_column(String(20), nullable=False)
    slide_count: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="draft",
        server_default="draft",
    )
    document_id: Mapped[UUID | None] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    slides: Mapped[list[SlideModel]] = relationship(
        back_populates="presentation",
        cascade="all, delete-orphan",
        order_by="SlideModel.slide_number",
        lazy="selectin",
    )


class SlideModel(Base):
    __tablename__ = "slides"
    __table_args__ = (
        CheckConstraint("slide_number >= 1", name="ck_slides_slide_number"),
        UniqueConstraint(
            "presentation_id",
            "slide_number",
            name="uq_slides_presentation_id_slide_number",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    presentation_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("presentations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slide_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    key_points: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    speaker_notes: Mapped[str] = mapped_column(Text, nullable=False)
    visual_recommendation: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    audience_questions: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)

    presentation: Mapped[PresentationModel] = relationship(back_populates="slides")
