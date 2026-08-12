"""Create presentations and slides tables.

Revision ID: 0001
Revises:
Create Date: 2026-08-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "presentations",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("audience", sa.Text(), nullable=False),
        sa.Column("tone", sa.String(length=20), nullable=False),
        sa.Column("slide_count", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "source IN ('prompt', 'document')",
            name="ck_presentations_source",
        ),
        sa.CheckConstraint(
            "tone IN ('professional', 'casual', 'academic', 'persuasive')",
            name="ck_presentations_tone",
        ),
        sa.CheckConstraint(
            "slide_count BETWEEN 5 AND 10",
            name="ck_presentations_slide_count",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'final')",
            name="ck_presentations_status",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "slides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("presentation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slide_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("key_points", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("speaker_notes", sa.Text(), nullable=False),
        sa.Column(
            "visual_recommendation",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "audience_questions",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.CheckConstraint("slide_number >= 1", name="ck_slides_slide_number"),
        sa.ForeignKeyConstraint(
            ["presentation_id"],
            ["presentations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "presentation_id",
            "slide_number",
            name="uq_slides_presentation_id_slide_number",
        ),
    )
    op.create_index(
        op.f("ix_slides_presentation_id"),
        "slides",
        ["presentation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_slides_presentation_id"), table_name="slides")
    op.drop_table("slides")
    op.drop_table("presentations")
