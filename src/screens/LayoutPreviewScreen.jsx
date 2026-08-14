import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowUp, ArrowDown, Trash2, Sparkles, ArrowRight, ArrowLeft, RefreshCw, Library } from 'lucide-react'
import { refineOutline, generateFullPresentation } from '../services/ai.js'
import UserMenu from '../components/UserMenu.jsx'
import PresentationOptions from '../components/PresentationOptions.jsx'
import {
  DEFAULT_PRESENTATION_PREFERENCES,
  normalizePreferences
} from '../config/presentationOptions.js'

function loadPreferences() {
  try {
    return normalizePreferences(JSON.parse(sessionStorage.getItem('pitchpilot_preferences') || '{}'))
  } catch {
    return DEFAULT_PRESENTATION_PREFERENCES
  }
}

export default function LayoutPreviewScreen() {
  const navigate = useNavigate()
  const [outline, setOutline] = useState(null)
  const [refinementPrompt, setRefinementPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')
  const [preferences, setPreferences] = useState(loadPreferences)

  useEffect(() => {
    const stored = sessionStorage.getItem('pitchpilot_outline')
    if (!stored) {
      navigate('/')
      return
    }
    try {
      setOutline(JSON.parse(stored))
    } catch {
      sessionStorage.removeItem('pitchpilot_outline')
      navigate('/')
    }
  }, [navigate])

  const moveSlide = (index, direction) => {
    const newSlides = [...outline.slides]
    const target = index + direction
    if (target < 0 || target >= newSlides.length) return
    ;[newSlides[index], newSlides[target]] = [newSlides[target], newSlides[index]]
    const updated = { ...outline, slides: newSlides }
    setOutline(updated)
    sessionStorage.setItem('pitchpilot_outline', JSON.stringify(updated))
  }

  const deleteSlide = (index) => {
    const newSlides = outline.slides.filter((_, i) => i !== index)
    const updated = { ...outline, slides: newSlides }
    setOutline(updated)
    sessionStorage.setItem('pitchpilot_outline', JSON.stringify(updated))
  }

  const handleRefine = async () => {
    if (!refinementPrompt.trim()) return
    setLoading(true)
    setLoadingMsg('Refining your outline...')
    setError('')

    try {
      const refined = await refineOutline(outline, refinementPrompt, preferences)
      setOutline(refined)
      sessionStorage.setItem('pitchpilot_outline', JSON.stringify(refined))
      setRefinementPrompt('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFull = async () => {
    setLoading(true)
    setLoadingMsg('Generating full presentation with AI...')
    setError('')

    try {
      const presentation = await generateFullPresentation(outline, preferences)
      sessionStorage.setItem('pitchpilot_presentation', JSON.stringify(presentation))
      sessionStorage.removeItem('pitchpilot_library_id')
      sessionStorage.removeItem('pitchpilot_library_name')
      navigate('/workspace')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!outline) return null

  const updatePreferences = (nextPreferences) => {
    const normalized = normalizePreferences(nextPreferences)
    setPreferences(normalized)
    sessionStorage.setItem('pitchpilot_preferences', JSON.stringify(normalized))
  }

  return (
    <div>
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p className="loading-text">{loadingMsg}</p>
        </div>
      )}

      {/* Navbar */}
      <nav className="navbar">
        <Link to="/" className="navbar-logo" style={{ textDecoration: 'none' }}>
          <div className="logo-icon">P</div>
          PitchPilot
        </Link>
        <div className="navbar-actions">
          <Link to="/library" className="btn btn-ghost btn-sm">
            <Library size={15} />
            Library
          </Link>
          <Link to="/" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} />
            Back
          </Link>
          <UserMenu />
        </div>
      </nav>

      {/* Content */}
      <div className="page-container">
        <div className="page-center">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 className="section-heading" style={{ marginBottom: 0 }}>
              <Sparkles size={22} style={{ color: 'var(--accent-blue)' }} />
              Presentation Outline
            </h2>
            <span className="badge badge-ai">AI Generated</span>
          </div>

          <PresentationOptions
            value={preferences}
            onChange={updatePreferences}
            compact
          />

          {/* Outline Cards */}
          <div className="outline-list">
            {outline.slides.map((slide, index) => (
              <div
                key={index}
                className="card outline-card fade-in"
                style={{ animationDelay: `${index * 0.06}s` }}
              >
                <div className="badge-number">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="outline-card-content">
                  <h4>{slide.title}</h4>
                  <p>{slide.summary}</p>
                </div>
                <div className="outline-card-actions">
                  <button
                    className="btn-icon"
                    onClick={() => moveSlide(index, -1)}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => moveSlide(index, 1)}
                    disabled={index === outline.slides.length - 1}
                    title="Move down"
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => deleteSlide(index)}
                    title="Delete slide"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Refinement Input */}
          <div className="edit-area mt-3">
            <input
              className="input"
              placeholder="Refine your outline... e.g., 'Add a slide about competitive analysis'"
              value={refinementPrompt}
              onChange={(e) => setRefinementPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
            />
            <button
              className="btn btn-ghost"
              onClick={handleRefine}
              disabled={loading || !refinementPrompt.trim()}
            >
              <RefreshCw size={16} />
              Regenerate
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}

          {/* Generate Full Button */}
          <div className="text-center mt-4">
            <button
              className="btn btn-primary btn-lg"
              onClick={handleGenerateFull}
              disabled={loading || outline.slides.length === 0}
            >
              Generate Full Presentation
              <ArrowRight size={20} />
            </button>
          </div>
        </div>

        <footer className="footer">
          Prodapt Hackathon - Group 12 | Powered by Gemini AI
        </footer>
      </div>
    </div>
  )
}
