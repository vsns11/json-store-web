import { API_BASE_URL } from '../config.js'

const BASE = `${API_BASE_URL}/api`
const TOKEN_KEY = 'json-store.token'

// The bearer token lives in memory, mirrored into sessionStorage so a reload does not sign you out.
let token = sessionStorage.getItem(TOKEN_KEY)
let onUnauthorized = null

export function setToken(next) {
  token = next
  if (next) sessionStorage.setItem(TOKEN_KEY, next)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export function hasToken() {
  return Boolean(token)
}

/** Called when the API rejects the token, so the app can send the user back to sign-in. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

/** Error carrying the structured body the API sends back (field errors, JSON location, ...). */
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = body?.fieldErrors ?? []
    this.location = body?.location ?? null
  }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(0, { message: 'Cannot reach the API — is the backend running?' })
  }

  // An expired or rejected token ends the session everywhere, not just for this call.
  if (response.status === 401 && !path.startsWith('/auth/login')) {
    setToken(null)
    onUnauthorized?.()
  }

  if (response.status === 204) return null

  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body)
  return body
}

export const api = {
  async login(username, password) {
    const session = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    setToken(session.token)
    return session
  },

  me() {
    return request('/auth/me')
  },

  templates() {
    return request('/templates')
  },

  list({ search = '', page = 0, size = 20, sort = 'updatedAt', direction = 'desc' } = {}) {
    const params = new URLSearchParams({ page, size, sort, direction })
    if (search.trim()) params.set('search', search.trim())
    return request(`/profiles?${params}`)
  },

  get(id) {
    return request(`/profiles/${id}`)
  },

  create(document) {
    return request('/profiles', { method: 'POST', body: JSON.stringify(document) })
  },

  update(id, document) {
    return request(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(document) })
  },

  remove(id) {
    return request(`/profiles/${id}`, { method: 'DELETE' })
  },

  stats() {
    return request('/profiles/stats')
  },
}
