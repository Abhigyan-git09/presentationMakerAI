from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import PresentationModel, SlideModel
from app.schemas import (
    AIGenerateDeckResponse,
    GeneratePresentationRequest,
    Slide,
    SlideUpdate,
)


class PresentationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_from_generated_deck(
        self,
        *,
        request: GeneratePresentationRequest,
        slide_count: int,
        deck: AIGenerateDeckResponse,
    ) -> PresentationModel:
        now = datetime.now(UTC)
        presentation = PresentationModel(
            title=deck.title,
            summary=deck.summary,
            estimated_duration_minutes=deck.estimated_duration_minutes,
            source=request.source.value,
            audience=request.audience,
            tone=request.tone.value,
            slide_count=slide_count,
            status="draft",
            document_id=request.document_id,
            created_at=now,
            updated_at=now,
        )
        presentation.slides = [self._slide_model(slide) for slide in deck.slides]
        self.session.add(presentation)
        await self.session.flush()
        return presentation

    async def get(self, presentation_id: UUID) -> PresentationModel | None:
        statement = (
            select(PresentationModel)
            .options(selectinload(PresentationModel.slides))
            .where(PresentationModel.id == presentation_id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def update_slide(
        self,
        *,
        presentation: PresentationModel,
        slide: SlideModel,
        update: SlideUpdate,
    ) -> SlideModel:
        for field, value in update.model_dump(exclude_unset=True, mode="json").items():
            setattr(slide, field, value)
        presentation.updated_at = datetime.now(UTC)
        await self.session.flush()
        return slide

    async def replace_slide(
        self,
        *,
        presentation: PresentationModel,
        slide: SlideModel,
        replacement: Slide,
    ) -> SlideModel:
        payload = replacement.model_dump(mode="json", exclude={"slide_number"})
        for field, value in payload.items():
            setattr(slide, field, value)
        presentation.updated_at = datetime.now(UTC)
        await self.session.flush()
        return slide

    @staticmethod
    def find_slide(
        presentation: PresentationModel,
        slide_number: int,
    ) -> SlideModel | None:
        return next(
            (slide for slide in presentation.slides if slide.slide_number == slide_number),
            None,
        )

    @staticmethod
    def _slide_model(slide: Slide) -> SlideModel:
        payload = slide.model_dump(mode="json")
        return SlideModel(**payload)
