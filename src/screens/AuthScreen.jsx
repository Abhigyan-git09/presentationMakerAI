import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'


export default function AuthScreen({ mode }) {
  const isSignup = mode === 'signup'
  const { user, loading, login, signup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!loading && user) return <Navigate to="/" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      if (isSignup) {
        const result = await signup({ name, email, password })
        if (result.requiresEmailConfirmation) {
          setNotice('Check your email to confirm your account, then return here to log in.')
          return
        }
      } else {
        await login({ email, password })
      }
      const destination = location.state?.from?.pathname || '/'
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card fade-in" aria-labelledby="auth-heading">
        <Link to="/" className="auth-brand" aria-label="PitchPilot home">
          <span className="logo-icon">P</span>
          PitchPilot
        </Link>

        <div className="auth-heading-block">
          <span className="auth-kicker">EMAIL ACCOUNT</span>
          <h1 id="auth-heading">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p>
            {isSignup
              ? 'Save your work behind a secure account and start building polished decks.'
              : 'Log in to continue creating presentations with PitchPilot.'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <label className="form-field" htmlFor="name">
              <span>Name</span>
              <span className="input-with-icon">
                <UserRound size={17} />
                <input
                  id="name"
                  name="name"
                  className="input"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  minLength={2}
                  maxLength={80}
                  required
                />
              </span>
            </label>
          )}

          <label className="form-field" htmlFor="email">
            <span>Email</span>
            <span className="input-with-icon">
              <Mail size={17} />
              <input
                id="email"
                name="email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
              />
            </span>
          </label>

          <label className="form-field" htmlFor="password">
            <span>Password</span>
            <span className="input-with-icon">
              <LockKeyhole size={17} />
              <input
                id="password"
                name="password"
                className="input"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={isSignup ? 15 : 1}
                maxLength={128}
                aria-describedby={isSignup ? 'password-hint' : undefined}
                required
              />
            </span>
            {isSignup && <small id="password-hint">Use at least 15 characters.</small>}
          </label>

          {isSignup && (
            <label className="form-field" htmlFor="confirm-password">
              <span>Confirm password</span>
              <span className="input-with-icon">
                <LockKeyhole size={17} />
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={15}
                  maxLength={128}
                  required
                />
              </span>
            </label>
          )}

          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}

          <button className="btn btn-primary btn-lg auth-submit" disabled={submitting || loading}>
            {submitting ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}
            {!submitting && <ArrowRight size={19} />}
          </button>
        </form>

        <p className="auth-footer-copy">
          {isSignup ? 'Already have an account?' : 'New to PitchPilot?'}{' '}
          <Link to={isSignup ? '/login' : '/signup'}>
            {isSignup ? 'Log in' : 'Create an account'}
          </Link>
        </p>
      </section>
    </main>
  )
}
