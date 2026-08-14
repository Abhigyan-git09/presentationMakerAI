/**
 * PowerPoint export service. The selected template, theme, and text density
 * are applied to the generated .pptx so it matches the workspace preview.
 */

import {
  getDensity,
  getTheme,
  normalizePreferences,
  splitBulletPoint
} from '../config/presentationOptions.js'

async function imageToDataUri(url) {
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
    }
    const mimeType = response.headers.get('content-type') || 'image/jpeg'
    return `data:${mimeType};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

function photoCredit(photo) {
  return `Photo: ${photo.creator} | ${photo.license} | Wikimedia Commons`
}

function addPhoto(pptSlide, slide, data, position, theme) {
  pptSlide.addShape('rect', {
    x: position.x - 0.03,
    y: position.y - 0.03,
    w: position.w + 0.06,
    h: position.h + 0.06,
    fill: { color: theme.surface },
    line: { color: theme.surface }
  })
  pptSlide.addImage({
    data,
    x: position.x,
    y: position.y,
    w: position.w,
    h: position.h,
    sizing: { type: 'cover', w: position.w, h: position.h },
    altText: slide.photo.alt,
    hyperlink: { url: slide.photo.sourceUrl }
  })
  pptSlide.addText(photoCredit(slide.photo), {
    x: position.x,
    y: position.y + position.h + 0.05,
    w: position.w,
    h: 0.2,
    fontSize: 6.5,
    fontFace: 'Arial',
    color: theme.muted,
    hyperlink: { url: slide.photo.sourceUrl },
    margin: 0,
    fit: 'shrink'
  })
}

function addFooter(pptSlide, title, index, count, theme) {
  pptSlide.addText(title, {
    x: 0.75, y: 7.13, w: 7.2, h: 0.18,
    fontSize: 7, fontFace: 'Arial', color: theme.muted,
    margin: 0, fit: 'shrink'
  })
  pptSlide.addText(`${index + 1} / ${count}`, {
    x: 11.7, y: 7.1, w: 0.85, h: 0.2,
    fontSize: 8, fontFace: 'Arial', color: theme.muted,
    align: 'right', margin: 0
  })
}

function addTitle(pptSlide, title, position, theme, fontSize = 35) {
  pptSlide.addText(title, {
    ...position,
    fontSize,
    fontFace: 'Arial',
    color: theme.text,
    bold: true,
    margin: 0,
    breakLine: false,
    fit: 'shrink',
    valign: 'mid'
  })
}

function addTakeaway(pptSlide, takeaway, position, theme) {
  if (!takeaway) return
  pptSlide.addShape('rect', {
    x: position.x,
    y: position.y,
    w: 0.06,
    h: position.h,
    fill: { color: theme.accent },
    line: { transparency: 100 }
  })
  pptSlide.addText(takeaway, {
    x: position.x + 0.18,
    y: position.y,
    w: position.w - 0.18,
    h: position.h,
    fontSize: 21,
    fontFace: 'Arial',
    color: theme.muted,
    bold: true,
    margin: 0,
    fit: 'shrink',
    valign: 'mid'
  })
}

function addBulletList(pptSlide, points, position, preferences, theme) {
  if (!points?.length) return
  const density = getDensity(preferences)
  const step = density.id === 'detailed' ? 0.64 : density.id === 'concise' ? 0.84 : 0.72
  const maxPoints = Math.min(points.length, density.maxPoints)

  points.slice(0, maxPoints).forEach((point, index) => {
    const y = position.y + (index * step)
    const { label, detail } = splitBulletPoint(point)
    const runs = label
      ? [
          { text: `${label}: `, options: { bold: true, color: theme.text } },
          { text: detail, options: { color: theme.muted } }
        ]
      : [{ text: detail, options: { color: theme.muted } }]

    pptSlide.addShape('ellipse', {
      x: position.x,
      y: y + 0.18,
      w: 0.1,
      h: 0.1,
      fill: { color: theme.accent },
      line: { transparency: 100 }
    })
    pptSlide.addText(runs, {
      x: position.x + 0.22,
      y,
      w: position.w - 0.22,
      h: step - 0.05,
      fontSize: density.bodyFontSize,
      fontFace: 'Arial',
      margin: 0,
      breakLine: false,
      fit: 'shrink',
      valign: 'mid',
      paraSpaceAfterPt: 0
    })
  })
}

function contentGeometry(preferences, index, hasPhoto) {
  if (!hasPhoto) {
    return {
      title: { x: 0.82, y: 0.45, w: 11.7, h: 0.72 },
      copy: { x: 0.82, y: 1.45, w: 11.45, h: 4.9 },
      photo: null
    }
  }

  if (preferences.template === 'minimal') {
    return {
      title: { x: 0.82, y: 0.45, w: 11.7, h: 0.72 },
      copy: { x: 0.82, y: 1.45, w: 7.85, h: 4.9 },
      photo: { x: 9.25, y: 1.45, w: 3.25, h: 4.9 }
    }
  }

  const imageLeft = preferences.template === 'editorial' && index % 2 === 1
  return {
    title: { x: 0.82, y: 0.45, w: 11.7, h: 0.72 },
    copy: imageLeft
      ? { x: 6.75, y: 1.45, w: 5.75, h: 4.9 }
      : { x: 0.82, y: 1.45, w: 5.75, h: 4.9 },
    photo: imageLeft
      ? { x: 0.82, y: 1.45, w: 5.25, h: 4.9 }
      : { x: 7.25, y: 1.45, w: 5.25, h: 4.9 }
  }
}

function addTitleSlide(pptSlide, slide, imageData, preferences, theme) {
  const hasPhoto = Boolean(slide.photo && imageData)
  const minimal = preferences.template === 'minimal'
  const copyWidth = hasPhoto && !minimal ? 5.85 : 11.45

  pptSlide.addText('PITCHPILOT PRESENTATION', {
    x: 0.82, y: 0.78, w: copyWidth, h: 0.25,
    fontSize: 10, fontFace: 'Arial', color: theme.accent,
    bold: true, charSpacing: 2.2, margin: 0
  })
  addTitle(pptSlide, slide.title, {
    x: 0.82, y: 1.25, w: copyWidth, h: 1.65
  }, theme, 50)

  const subtitle = slide.takeaway || slide.keyPoints?.[0]
  if (subtitle) {
    pptSlide.addText(subtitle, {
      x: 0.82, y: 3.25, w: copyWidth, h: 0.9,
      fontSize: 22, fontFace: 'Arial', color: theme.muted,
      margin: 0, fit: 'shrink', valign: 'top'
    })
  }
  pptSlide.addShape('rect', {
    x: 0.82, y: 3.02, w: 1.8, h: 0.05,
    fill: { color: theme.accent }, line: { transparency: 100 }
  })

  if (hasPhoto) {
    const position = minimal
      ? { x: 0.82, y: 5.1, w: 11.68, h: 1.35 }
      : { x: 7.15, y: 0.62, w: 5.35, h: 5.95 }
    addPhoto(pptSlide, slide, imageData, position, theme)
  }
}

function addContentSlide(pptSlide, slide, imageData, index, preferences, theme) {
  const hasPhoto = Boolean(slide.photo && imageData)
  const geometry = contentGeometry(preferences, index, hasPhoto)
  addTitle(pptSlide, slide.title, geometry.title, theme, 35)

  const takeawayHeight = slide.takeaway ? 0.72 : 0
  if (slide.takeaway) {
    addTakeaway(pptSlide, slide.takeaway, {
      x: geometry.copy.x,
      y: geometry.copy.y,
      w: geometry.copy.w,
      h: takeawayHeight
    }, theme)
  }
  addBulletList(pptSlide, slide.keyPoints, {
    x: geometry.copy.x,
    y: geometry.copy.y + takeawayHeight + (slide.takeaway ? 0.25 : 0),
    w: geometry.copy.w,
    h: geometry.copy.h - takeawayHeight
  }, preferences, theme)

  if (hasPhoto) addPhoto(pptSlide, slide, imageData, geometry.photo, theme)
}

export async function exportToPPTX(presentation, title = 'PitchPilot Presentation', preferences = {}) {
  const module = await import('pptxgenjs')
  const PptxGenJS = module.default || module
  const pptx = new PptxGenJS()
  const normalizedPreferences = normalizePreferences(preferences || presentation.preferences)
  const theme = getTheme(normalizedPreferences)

  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = title
  pptx.subject = 'AI-generated presentation'
  pptx.author = 'PitchPilot AI'
  pptx.company = 'Prodapt Hackathon - Group 12'
  pptx.lang = 'en-US'

  pptx.defineSlideMaster({
    title: 'PITCH_MASTER',
    background: { color: theme.background },
    objects: [
      { rect: { x: 0, y: 7.0, w: 13.333, h: 0.5, fill: { color: theme.surface }, line: { transparency: 100 } } },
      { rect: { x: 0, y: 0, w: 0.06, h: 7.5, fill: { color: theme.accent }, line: { transparency: 100 } } }
    ],
    slideNumber: { x: 12.25, y: 7.1, color: theme.muted, fontSize: 8 }
  })

  const imageData = await Promise.all(
    presentation.slides.map(slide => imageToDataUri(slide.photo?.url))
  )

  presentation.slides.forEach((slide, index) => {
    const pptSlide = pptx.addSlide('PITCH_MASTER')
    if (index === 0) {
      addTitleSlide(pptSlide, slide, imageData[index], normalizedPreferences, theme)
    } else {
      addContentSlide(pptSlide, slide, imageData[index], index, normalizedPreferences, theme)
    }

    addFooter(pptSlide, presentation.title || title, index, presentation.slides.length, theme)

    if (slide.speakerNotes) {
      const notes = slide.photo
        ? `${slide.speakerNotes}\n\n${photoCredit(slide.photo)}\n${slide.photo.sourceUrl}`
        : slide.speakerNotes
      pptSlide.addNotes(notes)
    }
  })

  const safeName = title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'PitchPilot_Presentation'
  await pptx.writeFile({ fileName: `${safeName}.pptx` })
}
