const runtime = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {}

/**
 * Where the API lives. Empty means "same origin", which is what the dev proxy and a
 * reverse-proxied deployment both use. Set it when the API is on another host.
 *
 * Precedence: runtime config injected into the container > build-time env > same origin.
 */
export const API_BASE_URL = String(runtime.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export const APP_VERSION = String(runtime.version || import.meta.env.VITE_APP_VERSION || 'dev')
