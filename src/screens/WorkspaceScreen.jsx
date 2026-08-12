import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Download, ArrowLeft, Send, ChevronDown, ChevronRight,
  HelpCircle, ExternalLink, FileText, Sparkles, Image
} from 'lucide-react'
import { editSlide } from '../services/ai.js'
import { addPhotosToPresentation, findPhoto } from '../services/imageService.js'
import { exportToPPTX } from '../services/pptxService.js'
import UserMenu from '../components/UserMenu.jsx'

export default function WorkspaceScreen() {
  const navigate = useNavigate()
  const [presentation, setPresentation] = useState(null)
  const [activeSlide, setActiveSlide] = useState(0)
  const [editPrompt, setEditPrompt] = useState('')
  const [editing, setEditing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loadingPhotos, setLoadingPhotos] = useState(false)
  const [expandedQA, setExpandedQA] = useState(new Set())
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('pitchpilot_presentation')
    if (!stored) {
      navigate('/')
      return
    }
    const savedPresentation = JSON.parse(stored)
    setPresentation(savedPresentation)

    if (savedPresentation.slides.some(slide => !slide.photo)) {
      setLoadingPhotos(true)
      addPhotosToPresentation(savedPresentation)
        .then(enrichedPresentation => {
          setPresentation(enrichedPresentation)
          sessionStorage.setItem(
            'pitchpilot_presentation',
            JSON.stringify(enrichedPresentation)
          )
        })
        .finally(() => setLoadingPhotos(false))
    }
  }, [navigate])

  const handleEditSlide = async () => {
    if (!editPrompt.trim()) return
    setEditing(true)
    setError('')

    try {
      const currentSlide = presentation.slides[activeSlide]
      const updated = await editSlide(currentSlide, editPrompt)
      const searchChanged = updated.photoSearchQuery &&
        updated.photoSearchQuery !== currentSlide.photoSearchQuery
      const photo = searchChanged
        ? await findPhoto(updated.photoSearchQuery)
        : currentSlide.photo

      const newSlides = [...presentation.slides]
      newSlides[activeSlide] = { ...currentSlide, ...updated, photo }
      const newPresentation = { ...presentation, slides: newSlides }
      setPresentation(newPresentation)
      sessionStorage.setItem('pitchpilot_presentation', JSON.stringify(newPresentation))
      setEditPrompt('')
    } catch (err) {
      setError(err.message)
    } finally {
      setEditing(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const prompt = sessionStorage.getItem('pitchpilot_prompt') || 'Presentation'
      await exportToPPTX(presentation, prompt)
    } catch (err) {
      setError('Export failed: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  const toggleQA = (index) => {
    const newSet = new Set(expandedQA)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setExpandedQA(newSet)
  }

  if (!presentation) return null

  const slide = presentation.slides[activeSlide]

  return (
    <div>
      {/* Editing overlay */}
      {editing && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p className="loading-text">AI is editing your slide...</p>
        </div>
      )}

      {/* Navbar */}
      <nav className="navbar workspace-navbar">
        <Link to="/" className="navbar-logo" style={{ textDecoration: 'none' }}>
          <div className="logo-icon">P</div>
          PitchPilot
        </Link>
        <div className="navbar-actions">
          <Link to="/layout" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            Back to Outline
          </Link>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export PPTX'}
          </button>
          <UserMenu />
        </div>
      </nav>

      {/* Workspace Layout */}
      <div className="page-container workspace-page-container">
        <div className="workspace-layout">
          {/* Left Panel - Slide Preview */}
          <div>
            {/* Slide Navigation Strip */}
            <div className="slide-nav">
              {presentation.slides.map((s, i) => (
                <button
                  key={i}
                  className={`slide-nav-item ${i === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(i)}
                >
                  {String(i + 1).padStart(2, '0')} — {s.title.length > 25 ? s.title.substring(0, 25) + '…' : s.title}
                </button>
              ))}
            </div>

            {/* Slide Preview Card */}
            <div className="card slide-preview fade-in" key={activeSlide}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span className="badge badge-ai">
                  <Sparkles size={12} />
                  Slide {activeSlide + 1} of {presentation.slides.length}
                </span>
                {loadingPhotos && (
                  <span className="badge badge-visual">Finding photos...</span>
                )}
              </div>

              <h2>{slide.title}</h2>

              {/* Automatically sourced photo */}
              {slide.photo && (
                <figure className="slide-photo">
                  <img src={slide.photo.url} alt={slide.photo.alt} />
                  <figcaption>
                    <span>
                      Photo by {slide.photo.creator} · {slide.photo.license}
                    </span>
                    <a
                      href={slide.photo.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View photo source for ${slide.photo.title}`}
                    >
                      Source <ExternalLink size={12} />
                    </a>
                  </figcaption>
                </figure>
              )}

              {/* Visual Recommendation */}
              {slide.visualRecommendation && (
                <div className="badge badge-visual" style={{ marginBottom: '1.25rem' }}>
                  <Image size={14} />
                  Suggested: {slide.visualRecommendation}
                </div>
              )}

              {/* Key Points */}
              <ul className="key-points">
                {slide.keyPoints?.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>

              {/* Speaker Notes */}
              {slide.speakerNotes && (
                <div className="speaker-notes">
                  <div className="speaker-notes-label">
                    <FileText size={12} style={{ verticalAlign: 'middle', marginRight: '0.375rem' }} />
                    Speaker Notes
                  </div>
                  <p>{slide.speakerNotes}</p>
                </div>
              )}
            </div>

            {/* AI Edit Area */}
            <div className="edit-area mt-2">
              <input
                className="input"
                placeholder="Edit this slide... e.g., 'Make it more concise' or 'Add statistics'"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditSlide()}
                disabled={editing}
              />
              <button
                className="btn btn-primary"
                onClick={handleEditSlide}
                disabled={editing || !editPrompt.trim()}
              >
                <Send size={16} />
                Apply Edit
              </button>
            </div>

            {error && <p className="error-text">{error}</p>}
          </div>

          {/* Right Panel - Audience Q&A Sidebar */}
          <div className="qa-sidebar">
            <h3 className="section-heading" style={{ fontSize: '1.1rem' }}>
              <HelpCircle size={18} style={{ color: 'var(--accent-violet)' }} />
              Audience Questions
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
              Prepare for these likely questions
            </p>

            {presentation.audienceQuestions?.map((qa, i) => (
              <button
                key={i}
                type="button"
                className={`card qa-card ${expandedQA.has(i) ? 'expanded' : ''}`}
                onClick={() => toggleQA(i)}
                aria-expanded={expandedQA.has(i)}
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <div className="qa-card-question">
                  {expandedQA.has(i) ? <ChevronDown size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> : <ChevronRight size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
                  {qa.question}
                </div>
                <div className="qa-card-answer">
                  {qa.suggestedAnswer}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
