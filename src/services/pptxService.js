/**
 * PPTX Export Service
 * Generates .pptx files from the presentation JSON using pptxgenjs.
 */

import PptxGenJS from 'pptxgenjs';

/**
 * Generate and download a PPTX file from presentation data.
 * @param {Object} presentation - The full presentation object with slides array.
 * @param {string} title - The presentation title.
 */
export async function exportToPPTX(presentation, title = 'PitchPilot Presentation') {
  const pptx = new PptxGenJS();

  // Set presentation properties
  pptx.title = title;
  pptx.author = 'PitchPilot AI';
  pptx.company = 'Prodapt Hackathon - Group 12';

  // Define master slide layouts
  pptx.defineSlideMaster({
    title: 'PITCH_MASTER',
    background: { color: '0F172A' },
    objects: [
      // Bottom accent bar
      { rect: { x: 0, y: '92%', w: '100%', h: '8%', fill: { color: '1E293B' } } },
      // Subtle left accent line
      { rect: { x: 0, y: 0, w: 0.05, h: '100%', fill: { type: 'solid', color: '2E5BFF' } } }
    ]
  });

  presentation.slides.forEach((slide, index) => {
    const pptSlide = pptx.addSlide({ masterName: 'PITCH_MASTER' });

    if (index === 0) {
      // Title slide
      pptSlide.addText(slide.title, {
        x: 0.8, y: 1.5, w: '85%', h: 1.5,
        fontSize: 36, fontFace: 'Inter', color: 'E2E8F0',
        bold: true, align: 'left'
      });

      if (slide.keyPoints && slide.keyPoints.length > 0) {
        pptSlide.addText(slide.keyPoints[0], {
          x: 0.8, y: 3.2, w: '85%', h: 0.8,
          fontSize: 18, fontFace: 'Inter', color: '94A3B8',
          align: 'left'
        });
      }

      // Accent line under title
      pptSlide.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 3.0, w: 2, h: 0.04,
        fill: { type: 'solid', color: '2E5BFF' }
      });

    } else {
      // Content slides
      pptSlide.addText(slide.title, {
        x: 0.8, y: 0.4, w: '85%', h: 0.8,
        fontSize: 28, fontFace: 'Inter', color: 'E2E8F0',
        bold: true, align: 'left'
      });

      // Key points as bullet list
      if (slide.keyPoints && slide.keyPoints.length > 0) {
        const bulletPoints = slide.keyPoints.map(point => ({
          text: point,
          options: {
            fontSize: 16, fontFace: 'Inter', color: 'CBD5E1',
            bullet: { type: 'bullet', color: '2E5BFF' },
            paraSpaceAfter: 8
          }
        }));

        pptSlide.addText(bulletPoints, {
          x: 0.8, y: 1.5, w: '85%', h: 3,
          valign: 'top'
        });
      }

      // Visual recommendation as a subtle note
      if (slide.visualRecommendation) {
        pptSlide.addText(`💡 Visual: ${slide.visualRecommendation}`, {
          x: 0.8, y: 4.7, w: '85%', h: 0.4,
          fontSize: 10, fontFace: 'Inter', color: '64748B',
          italic: true
        });
      }
    }

    // Speaker notes
    if (slide.speakerNotes) {
      pptSlide.addNotes(slide.speakerNotes);
    }
  });

  // Download the file
  const fileName = title.replace(/[^a-zA-Z0-9]/g, '_') + '.pptx';
  await pptx.writeFile({ fileName });
}
