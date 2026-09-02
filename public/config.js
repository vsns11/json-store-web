// Rewritten when the container starts (see docker-entrypoint.sh) so one image serves every
// environment. An empty apiBaseUrl means the API is reachable on the same origin.
window.__APP_CONFIG__ = { apiBaseUrl: '', version: 'dev' }
