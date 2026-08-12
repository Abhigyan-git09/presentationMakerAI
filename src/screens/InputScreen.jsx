import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Upload, FileText, Presentation, MessageSquare, HelpCircle } from 'lucide-react'
import { generateOutline } from '../services/ai.js'
import { extractTextFromFile } from '../services/pdfService.js'
import UserMenu from '../components/UserMenu.jsx'

export default function InputScreen() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [prompt, setPrompt] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragover, setDragover] = useState(false)

  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragover(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) setFile(droppedFile)
  }

  const handleFileSelect = (e) => {
    if (e.target.files[0]) setFile(e.target.files[0])
  }

  const handleGenerate = async () => {
    if (!prompt.trim() && !file) {
      setError('Please enter an idea or upload a document.')
      return
    }
    setError('')
    setLoading(true)

    try {
      let documentText = ''
      if (file) {
        documentText = await extractTextFromFile(file)
      }

      const outline = await generateOutline(prompt, documentText)

      // Store in sessionStorage and navigate
      sessionStorage.setItem('pitchpilot_outline', JSON.stringify(outline))
      sessionStorage.setItem('pitchpilot_prompt', prompt)
      navigate('/layout')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p className="loading-text">Generating your presentation outline...</p>
        </div>
      )}

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <div className="logo-icon">P</div>
          PitchPilot
        </div>
        <div className="navbar-actions">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            AI Presentation Builder
          </span>
          <UserMenu />
        </div>
      </nav>

      {/* Hero */}
      <div className="page-container">
        <div className="page-center">
          <div className="hero-section fade-in">
            <h1 className="hero-title">
              Turn Ideas into Stunning<br />Presentations in Seconds
            </h1>
            <p className="hero-subtitle">
              The AI assistant that crafts perfect decks from your thoughts or documents —
              complete with speaker notes, visual recommendations, and audience Q&A prep.
            </p>
          </div>

          {/* Input Area */}
          <div className="fade-in" style={{ animationDelay: '0.1s' }}>
            <textarea
              className="textarea"
              placeholder="Describe your presentation topic, key points, or paste content..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              style={{ marginBottom: '1rem' }}
            />

            {/* Upload Zone */}
            <div
              className={`upload-zone ${dragover ? 'dragover' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragover(true) }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div className="upload-icon">
                <Upload size={32} />
              </div>
              {file ? (
                <p className="file-name">
                  <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  {file.name}
                </p>
              ) : (
                <>
                  <p>Or drop a PDF/TXT document here</p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Click to browse
                  </p>
                </>
              )}
            </div>

            {error && <p className="error-text">{error}</p>}

            {/* Generate Button */}
            <div className="text-center mt-4">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleGenerate}
                disabled={loading}
              >
                <Sparkles size={20} />
                Generate Layout
              </button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="features-grid fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="card feature-card">
              <div className="feature-icon">
                <Presentation size={24} />
              </div>
              <h3>AI-Powered Slides</h3>
              <p>
                Automatically generate structured, professional slides with
                key points and visual recommendations.
              </p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">
                <MessageSquare size={24} />
              </div>
              <h3>Speaker Notes</h3>
              <p>
                Get AI-crafted speaker notes for every slide to deliver your
                presentation with confidence.
              </p>
            </div>
            <div className="card feature-card">
              <div className="feature-icon">
                <HelpCircle size={24} />
              </div>
              <h3>Audience Q&A Prep</h3>
              <p>
                Anticipate audience questions with AI-generated Q&A pairs
                and suggested answers.
              </p>
            </div>
          </div>
        </div>

        <footer className="footer">
          Prodapt Hackathon - Group 12 | Powered by Gemini AI
        </footer>
      </div>
    </div>
  )
}
