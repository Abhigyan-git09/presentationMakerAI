import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Download, ArrowLeft, Send, ChevronDown, ChevronRight, HelpCircle,
  ExternalLink, FileText, Sparkles, Image, RefreshCw, Library, Save, X
} from 'lucide-react'
import { editSlide } from '../services/ai.js'
import { addPhotosToPresentation, findPhoto } from '../services/imageService.js'
import { exportToPPTX } from '../services/pptxService.js'
import { createSavedPresentation, updateSavedPresentation } from '../services/library.js'
import {
  getDensity,
  getTemplate,
  getTheme,
  normalizePreferences,
  splitBulletPoint,
  themeCssVariables
} from '../config/presentationOptions.js'
import UserMenu from '../components/UserMenu.jsx'

function storedPreferences() {
  try {
    return normalizePreferences(JSON.parse(sessionStorage.getItem('pitchpilot_preferences') || '{}'))
  } catch {
    return normalizePreferences()
  }
}

function FormattedPoint({ point }) {
  const { label, detail } = splitBulletPoint(point)
  return label ? <><strong>{label}:</strong> {detail}</> : detail
}

export default function WorkspaceScreen() {
  const navigate = useNavigate()
  const [presentation, setPresentation] = useState(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [editPrompt, setEditPrompt] = useState('')
  const [editing, setEditing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savingToLibrary, setSavingToLibrary] = useState(false)
  const [libraryId, setLibraryId] = useState(() => sessionStorage.getItem('pitchpilot_library_id') || '')
  const [libraryName, setLibraryName] = useState(() => sessionStorage.getItem('pitchpilot_library_name') || '')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [refreshingPhoto, setRefreshingPhoto] = useState(false)
  const [expandedQA, setExpandedQA] = useState(new Set())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('pitchpilot_presentation')
    if (!stored) {
      navigate('/')
      return
    }

    let savedPresentation
    try {
      savedPresentation = JSON.parse(stored)
    } catch {
      sessionStorage.removeItem('pitchpilot_presentation')
      navigate('/')
      return
    }

    const hydratedPresentation = {
      ...savedPresentation,
      topic: savedPresentation.topic || sessionStorage.getItem('pitchpilot_prompt') || savedPresentation.title,
      preferences: normalizePreferences(savedPresentation.preferences || storedPreferences())
    }
    setPresentation(hydratedPresentation)

    setLoadingPhotos(true)
    addPhotosToPresentation(hydratedPresentation)
      .then(enrichedPresentation => {
        setPresentation(enrichedPresentation)
        sessionStorage.setItem('pitchpilot_presentation', JSON.stringify(enrichedPresentation))
      })
      .catch(() => setError('Some photos could not be loaded. Your slide content is still available.'))
      .finally(() => setLoadingPhotos(false))
  }, [navigate])

  const savePresentation = (nextPresentation) => {
    setPresentation(nextPresentation)
    sessionStorage.setItem('pitchpilot_presentation', JSON.stringify(nextPresentation))
  }

  const photoContext = (slide, excludeCurrent = false) => ({
    keywords: slide.photoKeywords,
    slideTitle: slide.title,
    presentationTitle: presentation.topic || presentation.title,
    excludeUrls: presentation.slides
      .map(item => item.photo?.url)
      .filter(url => url && (excludeCurrent || url !== slide.photo?.url))
  })

  const handleEditSlide = async () => {
    if (!editPrompt.trim()) return
    setEditing(true)
    setError('')

    try {
      const currentSlide = presentation.slides[activeSlide]
      const updated = await editSlide(currentSlide, editPrompt, presentation.preferences)
      const searchChanged = updated.photoSearchQuery &&
        updated.photoSearchQuery !== currentSlide.photoSearchQuery
      const photo = searchChanged
        ? await findPhoto(updated.photoSearchQuery, photoContext(updated, true))
        : currentSlide.photo

      const newSlides = [...presentation.slides]
      newSlides[activeSlide] = { ...currentSlide, ...updated, photo: photo || currentSlide.photo }
      savePresentation({ ...presentation, slides: newSlides })
      setEditPrompt('')
    } catch (err) {
      setError(err.message)
    } finally {
      setEditing(false)
    }
  }

  const handleRefreshPhoto = async () => {
    const currentSlide = presentation.slides[activeSlide]
    const query = currentSlide.photoSearchQuery || `${presentation.topic || presentation.title || ''} ${currentSlide.title}`
    setRefreshingPhoto(true)
    setError('')
    try {
      const photo = await findPhoto(query, photoContext(currentSlide, true))
      if (!photo) {
        setError('No additional strongly related photo was found. The current photo was kept.')
        return
      }
      const slides = [...presentation.slides]
      slides[activeSlide] = { ...currentSlide, photo }
      savePresentation({ ...presentation, slides })
    } catch {
      setError('The photo search is temporarily unavailable. Please try again.')
    } finally {
      setRefreshingPhoto(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setError('')
    setNotice('')
    try {
      const prompt = sessionStorage.getItem('pitchpilot_prompt') || presentation.title || 'Presentation'
      await exportToPPTX(presentation, prompt, presentation.preferences)
      setNotice('PowerPoint export created successfully.')
    } catch (err) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  const openSaveDialog = () => {
    setSaveName(libraryName || presentation.title || presentation.topic || 'Untitled presentation')
    setError('')
    setNotice('')
    setShowSaveDialog(true)
  }

  const handleSaveToLibrary = async () => {
    const name = saveName.trim()
    if (!name) return
    setSavingToLibrary(true)
    setError('')
    setNotice('')
    try {
      const saved = libraryId
        ? await updateSavedPresentation(libraryId, { name, presentation })
        : await createSavedPresentation({ name, presentation })
      setLibraryId(saved.id)
      setLibraryName(saved.name)
      sessionStorage.setItem('pitchpilot_library_id', saved.id)
      sessionStorage.setItem('pitchpilot_library_name', saved.name)
      setShowSaveDialog(false)
      setNotice(libraryId ? 'Library copy updated successfully.' : 'Presentation saved to your library.')
    } catch (requestError) {
      setError(`Library save failed: ${requestError.message}`)
    } finally {
      setSavingToLibrary(false)
    }
  }

  const toggleQA = (index) => {
    const next = new Set(expandedQA)
    next.has(index) ? next.delete(index) : next.add(index)
    setExpandedQA(next)
  }

  if (!presentation?.slides?.length) return null

  const slide = presentation.slides[activeSlide]
  const preferences = normalizePreferences(presentation.preferences)
  const template = getTemplate(preferences)
  const theme = getTheme(preferences)
  const density = getDensity(preferences)
  const imageLeft = preferences.template === 'editorial' && activeSlide % 2 === 1
  const previewPoints = activeSlide === 0
    ? (slide.takeaway ? [] : slide.keyPoints?.slice(0, 1))
    : slide.keyPoints
  const titleLengthClass = slide.title.length > 70
    ? 'very-long-title'
    : slide.title.length > 48 ? 'long-title' : ''

  return (
    <div>
      {editing && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p className="loading-text">AI is editing your slide...</p>
        </div>
      )}

      {showSaveDialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => !savingToLibrary && setShowSaveDialog(false)}>
          <section
            className="card save-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-dialog-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <button
              type="button"
              className="btn-icon save-dialog-close"
              onClick={() => setShowSaveDialog(false)}
              disabled={savingToLibrary}
              aria-label="Close save dialog"
            >
              <X size={17} />
            </button>
            <div className="save-dialog-icon"><Library size={22} /></div>
            <h2 id="save-dialog-title">{libraryId ? 'Update library copy' : 'Save to your library'}</h2>
            <p>
              {libraryId
                ? 'This replaces the saved copy with the presentation currently in your workspace.'
                : 'Your presentation is only added after you confirm. Nothing is saved automatically.'}
            </p>
            <label className="save-dialog-field">
              <span>Presentation name</span>
              <input
                className="input"
                value={saveName}
                maxLength={120}
                autoFocus
                onChange={event => setSaveName(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && handleSaveToLibrary()}
              />
            </label>
            <div className="save-dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowSaveDialog(false)} disabled={savingToLibrary}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveToLibrary} disabled={savingToLibrary || !saveName.trim()}>
                <Save size={16} />
                {savingToLibrary ? 'Saving...' : libraryId ? 'Save changes' : 'Save presentation'}
              </button>
            </div>
          </section>
        </div>
      )}

      <nav className="navbar workspace-navbar">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">P</div>
          PitchPilot
        </Link>
        <div className="navbar-actions">
          <Link to={libraryId ? '/library' : '/layout'} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            {libraryId ? 'Back to Library' : 'Back to Outline'}
          </Link>
          {!libraryId && (
            <Link to="/library" className="btn btn-ghost btn-sm">
              <Library size={15} />
              Library
            </Link>
          )}
          <button className="btn btn-ghost btn-sm" onClick={openSaveDialog} disabled={savingToLibrary}>
            <Save size={16} />
            {libraryId ? 'Save changes' : 'Save to library'}
          </button>
          <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export PPTX'}
          </button>
          <UserMenu />
        </div>
      </nav>

      <div className="page-container workspace-page-container">
        <div className="workspace-layout">
          <main>
            <div className="slide-nav" aria-label="Presentation slides">
              {presentation.slides.map((item, index) => (
                <button
                  key={`${index}-${item.title}`}
                  className={`slide-nav-item ${index === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(index)}
                >
                  {String(index + 1).padStart(2, '0')} - {item.title.length > 25 ? `${item.title.substring(0, 25)}...` : item.title}
                </button>
              ))}
            </div>

            <section className="card slide-preview-shell fade-in" key={activeSlide}>
              <div className="slide-preview-toolbar">
                <span className="badge badge-ai">
                  <Sparkles size={12} />
                  Slide {activeSlide + 1} of {presentation.slides.length}
                </span>
                <div className="slide-style-summary">
                  <span>{template.label}</span>
                  <span className="theme-dot" style={{ background: `#${theme.accent}` }} />
                  <span>{theme.label}</span>
                  <span>{density.label} text</span>
                  {loadingPhotos && <span className="badge badge-visual">Finding photos...</span>}
                </div>
              </div>

              <div
                className={`slide-preview template-${preferences.template} ${slide.photo ? 'has-photo' : 'no-photo'} ${imageLeft ? 'image-left' : ''} ${activeSlide === 0 ? 'title-slide' : ''} ${titleLengthClass}`}
                style={themeCssVariables(preferences)}
              >
                <div className="slide-copy">
                  <div className="slide-eyebrow">{String(activeSlide + 1).padStart(2, '0')}</div>
                  <h2>{slide.title}</h2>
                  {slide.takeaway && <p className="slide-takeaway">{slide.takeaway}</p>}
                  <ul className="key-points">
                    {previewPoints?.map((point, index) => (
                      <li key={`${index}-${point}`}><FormattedPoint point={point} /></li>
                    ))}
                  </ul>
                </div>

                {slide.photo && (
                  <figure className="slide-photo">
                    <img src={slide.photo.url} alt={slide.photo.alt} />
                    <figcaption>
                      <span>Photo by {slide.photo.creator} | {slide.photo.license}</span>
                      <a href={slide.photo.sourceUrl} target="_blank" rel="noreferrer">
                        Source <ExternalLink size={12} />
                      </a>
                    </figcaption>
                  </figure>
                )}
              </div>

              <div className="slide-authoring-meta">
                {slide.visualRecommendation && (
                  <div className="visual-guidance">
                    <Image size={15} />
                    <span><strong>Visual direction:</strong> {slide.visualRecommendation}</span>
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleRefreshPhoto}
                  disabled={refreshingPhoto}
                >
                  <RefreshCw size={14} className={refreshingPhoto ? 'spin-icon' : ''} />
                  {refreshingPhoto ? 'Finding a better match...' : slide.photo ? 'Try another photo' : 'Find a photo'}
                </button>
              </div>
            </section>

            {slide.speakerNotes && (
              <section className="speaker-notes">
                <div className="speaker-notes-label">
                  <FileText size={12} />
                  Speaker Notes
                </div>
                <p>{slide.speakerNotes}</p>
              </section>
            )}

            <div className="edit-area mt-2">
              <input
                className="input"
                placeholder="Edit this slide... e.g., 'Add an implementation example'"
                value={editPrompt}
                onChange={(event) => setEditPrompt(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleEditSlide()}
                disabled={editing}
              />
              <button className="btn btn-primary" onClick={handleEditSlide} disabled={editing || !editPrompt.trim()}>
                <Send size={16} />
                Apply Edit
              </button>
            </div>

            {error && <p className="error-text">{error}</p>}
            {notice && <p className="success-text" role="status">{notice}</p>}
          </main>

          <aside className="qa-sidebar">
            <h3 className="section-heading" style={{ fontSize: '1.1rem' }}>
              <HelpCircle size={18} style={{ color: 'var(--accent-violet)' }} />
              Audience Questions
            </h3>
            <p className="qa-intro">Prepare for these likely questions</p>

            {presentation.audienceQuestions?.map((qa, index) => (
              <button
                key={`${index}-${qa.question}`}
                type="button"
                className={`card qa-card ${expandedQA.has(index) ? 'expanded' : ''}`}
                onClick={() => toggleQA(index)}
                aria-expanded={expandedQA.has(index)}
              >
                <div className="qa-card-question">
                  {expandedQA.has(index)
                    ? <ChevronDown size={16} className="qa-chevron" />
                    : <ChevronRight size={16} className="qa-chevron" />}
                  {qa.question}
                </div>
                <div className="qa-card-answer">{qa.suggestedAnswer}</div>
              </button>
            ))}
          </aside>
        </div>
      </div>
    </div>
  )
}
