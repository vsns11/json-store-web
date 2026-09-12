const runtime = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {}

/** Runtime config first, then build-time env, then the default. */
const setting = (key, envKey, fallback = '') =>
  String(runtime[key] || import.meta.env[envKey] || fallback)

/**
 * Where the API lives. Empty means "same origin", which is what the dev proxy and a
 * reverse-proxied deployment both use. Set it when the API is on another host.
 *
 * Precedence: runtime config injected into the container > build-time env > same origin.
 */
export const API_BASE_URL = setting('apiBaseUrl', 'VITE_API_BASE_URL').replace(/\/+$/, '')

/**
 * What this deployment calls itself. A workspace running its own copy sets these at container
 * start, so the same image carries that workspace's name, mark and colour without a rebuild.
 * `theme.js` applies the colour before the first paint; the rest is read by the components.
 */
export const APP_NAME = setting('appName', 'VITE_APP_NAME', 'JSON Store')
export const BRAND_MARK = setting('brandMark', 'VITE_BRAND_MARK', '{}')
