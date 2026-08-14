import { useState } from 'react'
import { LogOut, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'


export default function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')

  const handleLogout = async () => {
    setLoggingOut(true)
    setError('')
    try {
      await logout()
      sessionStorage.removeItem('pitchpilot_outline')
      sessionStorage.removeItem('pitchpilot_prompt')
      sessionStorage.removeItem('pitchpilot_presentation')
      sessionStorage.removeItem('pitchpilot_library_id')
      sessionStorage.removeItem('pitchpilot_library_name')
      navigate('/login', { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="user-menu">
      <span className="user-identity" title={user.email}>
        <UserRound size={15} />
        <span className="user-email">{user.email}</span>
      </span>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-label="Log out"
      >
        <LogOut size={15} />
        {loggingOut ? 'Logging out...' : 'Log out'}
      </button>
      {error && <span className="user-menu-error" role="alert">{error}</span>}
    </div>
  )
}
