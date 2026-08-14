const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || 'http://127.0.0.1:8082').replace(/\/$/, '')

export async function accountRequest(path, options = {}) {
  const response = await fetch(`${AUTH_API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json') ? await response.json() : null

  if (!response.ok) {
    const validationMessage = Array.isArray(data?.detail)
      ? data.detail[0]?.msg?.replace(/^Value error, /, '')
      : null
    const error = new Error(validationMessage || data?.detail || 'Authentication request failed')
    error.status = response.status
    throw error
  }

  return data
}

export async function signup({ name, email, password }) {
  const result = await accountRequest('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  return result.user
}

export async function login({ email, password }) {
  const result = await accountRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  return result.user
}

export async function getCurrentUser() {
  try {
    const result = await accountRequest('/auth/me')
    return result.user
  } catch (error) {
    if (error.status === 401) return null
    throw error
  }
}

export function logout() {
  return accountRequest('/auth/logout', { method: 'POST' })
}
