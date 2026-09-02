#!/bin/sh
# Writes the runtime configuration the app reads on boot, so one image serves every environment.
set -eu

cat > /usr/share/nginx/html/config.js <<CONFIG
window.__APP_CONFIG__ = { apiBaseUrl: "${API_BASE_URL:-}", version: "${APP_VERSION:-dev}" };
CONFIG

echo "runtime config: apiBaseUrl='${API_BASE_URL:-}' version='${APP_VERSION:-dev}'"
