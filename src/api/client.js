import { API_BASE_URL } from '../config.js'

const BASE = `${API_BASE_URL}/api`

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
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
  } catch {
    throw new ApiError(0, { message: 'Cannot reach the API — is the backend running?' })
  }

  if (response.status === 204) return null

  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, body)
  return body
}

export const api = {
  list({ search = '', page = 0, size = 20, sort = 'updatedAt', direction = 'desc' } = {}) {
    const params = new URLSearchParams({ page, size, sort, direction })
    if (search.trim()) params.set('search', search.trim())
    return request(`/documents?${params}`)
  },

  get(id) {
    return request(`/documents/${id}`)
  },

  create(document) {
    return request('/documents', { method: 'POST', body: JSON.stringify(document) })
  },

  update(id, document) {
    return request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(document) })
  },

  remove(id) {
    return request(`/documents/${id}`, { method: 'DELETE' })
  },

  stats() {
    return request('/documents/stats')
  },
}
