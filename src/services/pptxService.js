/**
 * PPTX Export Service
 * Generates .pptx files from presentation JSON using pptxgenjs.
 */

import PptxGenJS from 'pptxgenjs';

async function imageToDataUri(url) {
  if (!url) return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';

    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }

    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${mimeType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

function photoCredit(photo) {
  return `Photo: ${photo.creator} · ${photo.license} · Wikimedia Commons`;
}

function addPhoto(pptSlide, slide, data, position) {
  pptSlide.addImage({
    data,
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    sizing: { type: 'cover', w: position.w, h: position.h },
    altText: slide.photo.alt,
    hyperlink: { url: slide.photo.sourceUrl }
  });

  pptSlide.addText(photoCredit(slide.photo), {
    x: position.x,
    y: position.y + position.h + 0.05,
    w: position.w,
    h: 0.25,
    fontSize: 7,
    fontFace: 'Inter',
    color: '64748B',
    hyperlink: { url: slide.photo.sourceUrl },
    margin: 0
  });
}

/**
 * Generate and download a PPTX file from presentation data.
 * @param {Object} presentation - The full presentation object with slides array.
 * @param {string} title - The presentation title.
 */
export async function exportToPPTX(presentation, title = 'PitchPilot Presentation') {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';

  pptx.title = title;
  pptx.author = 'PitchPilot AI';
  pptx.company = 'Prodapt Hackathon - Group 12';

  pptx.defineSlideMaster({
    title: 'PITCH_MASTER',
    background: { color: '0F172A' },
    objects: [
      { rect: { x: 0, y: '92%', w: '100%', h: '8%', fill: { color: '1E293B' } } },
      { rect: { x: 0, y: 0, w: 0.05, h: '100%', fill: { type: 'solid', color: '2E5BFF' } } }
    ]
  });

  const photoData = await Promise.all(
    presentation.slides.map(slide => imageToDataUri(slide.photo?.url))
  );

  presentation.slides.forEach((slide, index) => {
    const pptSlide = pptx.addSlide({ masterName: 'PITCH_MASTER' });
    const hasPhoto = Boolean(slide.photo && photoData[index]);

    if (index === 0) {
      pptSlide.addText(slide.title, {
        x: 0.8, y: 1.5, w: hasPhoto ? 5.8 : 11.5, h: 1.5,
        fontSize: 36, fontFace: 'Inter', color: 'E2E8F0',
        bold: true, align: 'left'
      });

      if (slide.keyPoints?.length > 0) {
        pptSlide.addText(slide.keyPoints[0], {
          x: 0.8, y: 3.2, w: hasPhoto ? 5.8 : 11.5, h: 0.8,
          fontSize: 18, fontFace: 'Inter', color: '94A3B8',
          align: 'left'
        });
      }

      pptSlide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 3.0, w: 2, h: 0.04,
        fill: { type: 'solid', color: '2E5BFF' }
      });

      if (hasPhoto) {
        addPhoto(pptSlide, slide, photoData[index], {
          x: 7.05, y: 0.65, w: 5.55, h: 5.85
        });
      }
    } else {
      pptSlide.addText(slide.title, {
        x: 0.8, y: 0.4, w: hasPhoto ? 6.2 : 11.5, h: 0.8,
        fontSize: 28, fontFace: 'Inter', color: 'E2E8F0',
        bold: true, align: 'left'
      });

      if (slide.keyPoints?.length > 0) {
        const bulletPoints = slide.keyPoints.map(point => ({
          text: point,
          options: {
            fontSize: 16, fontFace: 'Inter', color: 'CBD5E1',
            bullet: { type: 'bullet', color: '2E5BFF' },
            paraSpaceAfter: 8
          }
        }));

        pptSlide.addText(bulletPoints, {
          x: 0.8, y: 1.5, w: hasPhoto ? 5.8 : 11.5, h: 3.9,
          valign: 'top'
        });
      }

      if (hasPhoto) {
        addPhoto(pptSlide, slide, photoData[index], {
          x: 7.2, y: 1.45, w: 5.4, h: 4.55
        });
      }

      if (slide.visualRecommendation) {
        pptSlide.addText(`Visual: ${slide.visualRecommendation}`, {
          x: 0.8, y: 6.25, w: hasPhoto ? 5.8 : 11.5, h: 0.45,
          fontSize: 10, fontFace: 'Inter', color: '64748B',
          italic: true
        });
      }
    }

    if (slide.speakerNotes) {
      const notes = slide.photo
        ? `${slide.speakerNotes}\n\n${photoCredit(slide.photo)}\n${slide.photo.sourceUrl}`
        : slide.speakerNotes;
      pptSlide.addNotes(notes);
    }
  });

  const fileName = title.replace(/[^a-zA-Z0-9]/g, '_') + '.pptx';
  await pptx.writeFile({ fileName });
}
