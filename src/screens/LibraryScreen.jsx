import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Check,
  Clock3,
  Download,
  FolderOpen,
  Library,
  Pencil,
  Plus,
  Presentation,
  Trash2,
  X,
} from 'lucide-react'
import UserMenu from '../components/UserMenu.jsx'
import { getDensity, getTemplate, getTheme, normalizePreferences } from '../config/presentationOptions.js'
import {
  deleteSavedPresentation,
  getSavedPresentation,
  listSavedPresentations,
  renameSavedPresentation,
} from '../services/library.js'
import { exportToPPTX } from '../services/pptxService.js'

function formatSavedDate(timestamp) {
  const date = new Date(timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp)
  return Number.isNaN(date.getTime())
    ? 'Recently'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function savedTimestamp(timestamp) {
  const date = new Date(typeof timestamp === 'number' && timestamp < 1_000_000_000_000
    ? timestamp * 1000
    : timestamp)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export default function LibraryScreen() {
  const navigate = useNavigate()
  const [presentations, setPresentations] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [renamingId, setRenamingId] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    listSavedPresentations()
      .then(items => {
        if (active) setPresentations(items)
      })
      .catch(requestError => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleNewPresentation = () => {
    sessionStorage.removeItem('pitchpilot_outline')
    sessionStorage.removeItem('pitchpilot_prompt')
    sessionStorage.removeItem('pitchpilot_presentation')
    sessionStorage.removeItem('pitchpilot_library_id')
    sessionStorage.removeItem('pitchpilot_library_name')
    navigate('/')
  }

  const loadPresentation = async (id) => {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      const saved = await getSavedPresentation(id)
      sessionStorage.removeItem('pitchpilot_outline')
      sessionStorage.setItem('pitchpilot_presentation', JSON.stringify(saved.presentation))
      sessionStorage.setItem('pitchpilot_prompt', saved.presentation.topic || saved.name)
      sessionStorage.setItem('pitchpilot_preferences', JSON.stringify(saved.presentation.preferences || {}))
      sessionStorage.setItem('pitchpilot_library_id', saved.id)
      sessionStorage.setItem('pitchpilot_library_name', saved.name)
      navigate('/workspace')
    } catch (requestError) {
      setError(requestError.message)
      setBusyId('')
    }
  }

  const exportPresentation = async (id) => {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      const saved = await getSavedPresentation(id)
      await exportToPPTX(saved.presentation, saved.name, saved.presentation.preferences)
      setNotice(`Exported “${saved.name}” successfully.`)
    } catch (requestError) {
      setError(`Export failed: ${requestError.message}`)
    } finally {
      setBusyId('')
    }
  }

  const beginRename = (item) => {
    setRenamingId(item.id)
    setRenameValue(item.name)
    setPendingDeleteId('')
    setError('')
  }

  const saveRename = async (id) => {
    const name = renameValue.trim()
    if (!name) return
    setBusyId(id)
    setError('')
    try {
      const updated = await renameSavedPresentation(id, name)
      setPresentations(items => items
        .map(item => item.id === id ? updated : item)
        .sort((a, b) => savedTimestamp(b.updatedAt) - savedTimestamp(a.updatedAt)))
      if (sessionStorage.getItem('pitchpilot_library_id') === id) {
        sessionStorage.setItem('pitchpilot_library_name', updated.name)
      }
      setRenamingId('')
      setNotice('Presentation renamed.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  const deletePresentation = async (id) => {
    setBusyId(id)
    setError('')
    try {
      await deleteSavedPresentation(id)
      setPresentations(items => items.filter(item => item.id !== id))
      if (sessionStorage.getItem('pitchpilot_library_id') === id) {
        sessionStorage.removeItem('pitchpilot_library_id')
        sessionStorage.removeItem('pitchpilot_library_name')
      }
      setPendingDeleteId('')
      setNotice('Presentation removed from your library.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div>
      <nav className="navbar">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">P</div>
          PitchPilot
        </Link>
        <div className="navbar-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleNewPresentation}>
            <Plus size={16} />
            New presentation
          </button>
          <UserMenu />
        </div>
      </nav>

      <main className="page-container library-page">
        <header className="library-header">
          <div>
            <span className="library-kicker"><Library size={14} /> Your saved work</span>
            <h1>Presentation Library</h1>
            <p>Save only the decks you want to keep, then reopen, update, or export them anytime.</p>
          </div>
          {!loading && presentations.length > 0 && (
            <span className="library-count">
              {presentations.length} {presentations.length === 1 ? 'presentation' : 'presentations'}
            </span>
          )}
        </header>

        {error && <p className="error-text library-message" role="alert">{error}</p>}
        {notice && <p className="success-text library-message" role="status">{notice}</p>}

        {loading ? (
          <div className="library-grid" aria-label="Loading saved presentations">
            {[0, 1, 2].map(item => <div className="shimmer-card library-shimmer" key={item} />)}
          </div>
        ) : presentations.length === 0 ? (
          <section className="card library-empty">
            <div className="library-empty-icon"><Presentation size={30} /></div>
            <h2>Your library is ready</h2>
            <p>Create a presentation, then choose “Save to library” from the workspace when you want to keep it.</p>
            <button type="button" className="btn btn-primary" onClick={handleNewPresentation}>
              <Plus size={17} />
              Create your first presentation
            </button>
          </section>
        ) : (
          <section className="library-grid" aria-label="Saved presentations">
            {presentations.map(item => {
              const preferences = normalizePreferences(item.preferences)
              const theme = getTheme(preferences)
              const template = getTemplate(preferences)
              const density = getDensity(preferences)
              const busy = busyId === item.id
              const deleting = pendingDeleteId === item.id

              return (
                <article className="card library-card" key={item.id}>
                  <div
                    className="library-card-preview"
                    style={{
                      '--library-bg': `#${theme.background}`,
                      '--library-surface': `#${theme.surface}`,
                      '--library-accent': `#${theme.accent}`,
                      '--library-text': `#${theme.text}`,
                    }}
                  >
                    <span className="library-preview-number">01</span>
                    <div className="library-preview-copy">
                      <strong>{item.firstSlideTitle}</strong>
                      <span>{item.slideCount} slides</span>
                    </div>
                    <div className="library-preview-accent" />
                  </div>

                  <div className="library-card-body">
                    {renamingId === item.id ? (
                      <div className="library-rename-row">
                        <input
                          className="input"
                          value={renameValue}
                          maxLength={120}
                          autoFocus
                          onChange={event => setRenameValue(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') saveRename(item.id)
                            if (event.key === 'Escape') setRenamingId('')
                          }}
                          aria-label="Presentation name"
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => saveRename(item.id)}
                          disabled={busy || !renameValue.trim()}
                          title="Save name"
                        >
                          <Check size={16} />
                        </button>
                        <button type="button" className="btn-icon" onClick={() => setRenamingId('')} title="Cancel rename">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="library-title-row">
                        <div>
                          <h2>{item.name}</h2>
                          {item.title !== item.name && <p>{item.title}</p>}
                        </div>
                        <button type="button" className="btn-icon" onClick={() => beginRename(item)} title="Rename presentation">
                          <Pencil size={15} />
                        </button>
                      </div>
                    )}

                    <div className="library-meta">
                      <span><Clock3 size={13} /> Updated {formatSavedDate(item.updatedAt)}</span>
                      <div className="library-tags">
                        <span>{template.label}</span>
                        <span>{theme.label}</span>
                        <span>{density.label}</span>
                      </div>
                    </div>

                    <div className="library-card-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => loadPresentation(item.id)} disabled={busy}>
                        <FolderOpen size={15} />
                        {busy ? 'Loading...' : 'Open'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => exportPresentation(item.id)} disabled={busy}>
                        <Download size={15} />
                        Export
                      </button>
                      {deleting ? (
                        <div className="library-delete-confirm">
                          <button type="button" className="btn btn-danger-solid btn-sm" onClick={() => deletePresentation(item.id)} disabled={busy}>
                            Delete
                          </button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPendingDeleteId('')}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn-icon btn-danger library-delete-button"
                          onClick={() => {
                            setPendingDeleteId(item.id)
                            setRenamingId('')
                          }}
                          title="Delete presentation"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>
    </div>
  )
}
