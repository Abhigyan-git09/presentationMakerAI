from __future__ import annotations

from uuid import UUID

from app.clients import UpstreamClient
from app.errors import ai_failure, not_found
from app.models import PresentationModel, SlideModel
from app.repository import PresentationRepository
from app.schemas import (
    AIGenerateDeckRequest,
    AIGenerateSlideRequest,
    GeneratePresentationRequest,
    Presentation,
    PresentationContext,
    RegenerateSlideRequest,
    Slide,
    SlideUpdate,
    SourceType,
)


class PresentationService:
    def __init__(
        self,
        repository: PresentationRepository,
        upstream: UpstreamClient,
    ) -> None:
        self.repository = repository
        self.upstream = upstream

    async def generate(self, request: GeneratePresentationRequest) -> Presentation:
        slide_count = max(5, min(10, request.slide_count))
        topic = await self._resolve_topic(request)

        generated_deck = await self.upstream.generate_deck(
            AIGenerateDeckRequest(
                topic=topic,
                audience=request.audience,
                tone=request.tone,
                slide_count=slide_count,
                source=request.source,
            )
        )
        expected_numbers = list(range(1, slide_count + 1))
        actual_numbers = sorted(slide.slide_number for slide in generated_deck.slides)
        if len(generated_deck.slides) != slide_count or actual_numbers != expected_numbers:
            raise ai_failure(
                "AI Service returned an unexpected slide set",
                status_code=502,
                expected_slide_numbers=expected_numbers,
                actual_slide_numbers=actual_numbers,
            )

        async with self.repository.session.begin():
            presentation = await self.repository.create_from_generated_deck(
                request=request,
                slide_count=slide_count,
                deck=generated_deck,
            )
        return presentation_to_schema(presentation)

    async def get(self, presentation_id: UUID) -> Presentation:
        presentation = await self.repository.get(presentation_id)
        if presentation is None:
            raise not_found(
                "Presentation was not found",
                presentation_id=str(presentation_id),
            )
        return presentation_to_schema(presentation)

    async def update_slide(
        self,
        *,
        presentation_id: UUID,
        slide_number: int,
        update: SlideUpdate,
    ) -> Slide:
        async with self.repository.session.begin():
            presentation, slide = await self._get_presentation_and_slide(
                presentation_id,
                slide_number,
            )
            updated = await self.repository.update_slide(
                presentation=presentation,
                slide=slide,
                update=update,
            )
        return slide_to_schema(updated)

    async def regenerate_slide(
        self,
        *,
        presentation_id: UUID,
        slide_number: int,
        request: RegenerateSlideRequest,
    ) -> Slide:
        presentation, slide = await self._get_presentation_and_slide(
            presentation_id,
            slide_number,
        )
        context = PresentationContext(
            title=presentation.title,
            audience=presentation.audience,
            tone=presentation.tone,
            all_slide_titles=[item.title for item in presentation.slides],
        )
        current_slide = slide_to_schema(slide)
        # End SQLAlchemy's implicit read transaction before waiting on the AI
        # Service. The replacement is reloaded and written in a short transaction.
        await self.repository.session.rollback()
        replacement = await self.upstream.generate_slide(
            AIGenerateSlideRequest(
                presentation_context=context,
                slide_number=slide_number,
                current_slide=current_slide,
                instructions=request.instructions,
            )
        )
        if replacement.slide_number != slide_number:
            raise ai_failure(
                "AI Service returned the wrong slide number",
                status_code=502,
                expected_slide_number=slide_number,
                actual_slide_number=replacement.slide_number,
            )

        async with self.repository.session.begin():
            # Reload under the write transaction in case the slide changed while
            # the external AI request was in flight.
            presentation, slide = await self._get_presentation_and_slide(
                presentation_id,
                slide_number,
            )
            updated = await self.repository.replace_slide(
                presentation=presentation,
                slide=slide,
                replacement=replacement,
            )
        return slide_to_schema(updated)

    async def _resolve_topic(self, request: GeneratePresentationRequest) -> str:
        if request.source is SourceType.PROMPT:
            assert request.topic is not None
            return request.topic
        assert request.document_id is not None
        document = await self.upstream.get_document_text(str(request.document_id))
        if document.document_id != request.document_id:
            raise not_found(
                "Document Service returned a different document",
                document_id=str(request.document_id),
            )
        return document.extracted_text

    async def _get_presentation_and_slide(
        self,
        presentation_id: UUID,
        slide_number: int,
    ) -> tuple[PresentationModel, SlideModel]:
        presentation = await self.repository.get(presentation_id)
        if presentation is None:
            raise not_found(
                "Presentation was not found",
                presentation_id=str(presentation_id),
            )
        slide = self.repository.find_slide(presentation, slide_number)
        if slide is None:
            raise not_found(
                "Slide was not found",
                presentation_id=str(presentation_id),
                slide_number=slide_number,
            )
        return presentation, slide


def slide_to_schema(slide: SlideModel) -> Slide:
    return Slide.model_validate(
        {
            "slide_number": slide.slide_number,
            "title": slide.title,
            "key_points": slide.key_points,
            "speaker_notes": slide.speaker_notes,
            "visual_recommendation": slide.visual_recommendation,
            "audience_questions": slide.audience_questions,
        }
    )


def presentation_to_schema(presentation: PresentationModel) -> Presentation:
    return Presentation.model_validate(
        {
            "presentation_id": presentation.id,
            "title": presentation.title,
            "summary": presentation.summary,
            "estimated_duration_minutes": presentation.estimated_duration_minutes,
            "source": presentation.source,
            "audience": presentation.audience,
            "tone": presentation.tone,
            "slide_count": presentation.slide_count,
            "status": presentation.status,
            "slides": [slide_to_schema(slide) for slide in presentation.slides],
            "created_at": presentation.created_at,
            "updated_at": presentation.updated_at,
        }
    )
