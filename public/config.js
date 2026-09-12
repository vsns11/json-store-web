// Rewritten when the container starts (see docker-entrypoint.d/10-runtime-config.sh) so one image
// serves every environment. An empty apiBaseUrl means the API is reachable on the same origin;
// empty branding means the app keeps its own name, mark and colour.
window.__APP_CONFIG__ = { apiBaseUrl: '', appName: '', brandMark: '', accent: '' }
