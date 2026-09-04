import { API_BASE_URL } from '../config.js'

const BASE = `${API_BASE_URL}/api`
const TOKEN_KEY = 'json-store.token'
const EXPIRY_KEY = 'json-store.token-expires'

// The bearer token lives in memory, mirrored into sessionStorage so a reload does not sign you out.
// Its expiry is kept beside it so the session can be renewed before it runs out.
let token = sessionStorage.getItem(TOKEN_KEY)
let expiresAt = Number(sessionStorage.getItem(EXPIRY_KEY)) || null
let onUnauthorized = null

/** Sign-in and refresh answer with the same shape; both replace the token the app is carrying. */
function storeSession(session) {
  token = session.accessToken
  expiresAt = session.expiresAt ? Date.parse(session.expiresAt) : null
  sessionStorage.setItem(TOKEN_KEY, token)
  if (expiresAt) sessionStorage.setItem(EXPIRY_KEY, String(expiresAt))
  else sessionStorage.removeItem(EXPIRY_KEY)
}

export function clearSession() {
  token = null
  expiresAt = null
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(EXPIRY_KEY)
}

export function hasToken() {
  return Boolean(token)
}

/** When the current token stops working, as a timestamp, or null if that is not known. */
export function tokenExpiresAt() {
  return expiresAt
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

/** Sign-in and refresh report their own failures; a 401 from them does not end the session. */
const AUTH_CALLS = ['/auth/login', '/auth/refresh']

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError(0, { message: 'Cannot reach the API — is the backend running?' })
  }

  // An expired or rejected token ends the session everywhere, not just for this call.
  if (response.status === 401 && !AUTH_CALLS.includes(path)) {
    clearSession()
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
    storeSession(session)
    return session
  },

  /** A new token for the one being carried, so a long day does not end in a sign-in screen. */
  async refresh() {
    const session = await request('/auth/refresh', { method: 'POST' })
    storeSession(session)
    return session
  },

  me() {
    return request('/auth/me')
  },

  templates() {
    return request('/templates')
  },

  list({ search = '', tag = '', page = 0, size = 20, sort = 'updatedAt', direction = 'desc' } = {}) {
    const params = new URLSearchParams({ page, size, sort, direction })
    if (search.trim()) params.set('search', search.trim())
    if (tag) params.set('tag', tag)
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
