#!/bin/sh
# Writes the runtime configuration the app reads on boot, so one image serves every environment.
# Nothing here is baked into the bundle: a workspace points the app at its own API and puts its
# own name, mark and colour on it by setting these variables on the container.
set -eu

# Each value lands inside a double-quoted JS string, so a backslash or a quote in a workspace's
# name would end the literal and break the page. Both are escaped.
esc() {
    printf '%s' "${1:-}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

cat > /usr/share/nginx/html/config.js <<CONFIG
window.__APP_CONFIG__ = {
  apiBaseUrl: "$(esc "${API_BASE_URL:-}")",
  appName: "$(esc "${APP_NAME:-}")",
  brandMark: "$(esc "${BRAND_MARK:-}")",
  accent: "$(esc "${ACCENT_COLOR:-}")"
};
CONFIG

echo "runtime config: apiBaseUrl='${API_BASE_URL:-}' appName='${APP_NAME:-}' brandMark='${BRAND_MARK:-}' accent='${ACCENT_COLOR:-}'"
