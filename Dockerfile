# syntax=docker/dockerfile:1

# ---- build -----------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG APP_VERSION=dev
ENV VITE_APP_VERSION=${APP_VERSION}
RUN npm run build

# ---- runtime ---------------------------------------------------------------
# Unprivileged nginx: listens on 8080 and never needs root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

USER root

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/*.template /etc/nginx/templates/
COPY docker-entrypoint.d/10-runtime-config.sh /docker-entrypoint.d/10-runtime-config.sh

# Two users must be able to write here: the image's own nginx user (101) under plain Docker,
# and the arbitrary UID with GID 0 that OpenShift assigns. Owner 101, group 0, and group
# permissions equal to owner permissions covers both.
#   /etc/nginx/conf.d      rendered config templates
#   /usr/share/nginx/html  config.js, rewritten on every start
#   /var/cache/nginx       nginx runtime files
RUN rm -f /etc/nginx/conf.d/default.conf \
    && chmod +x /docker-entrypoint.d/10-runtime-config.sh \
    && chown -R 101:0 /etc/nginx /usr/share/nginx/html /var/cache/nginx /docker-entrypoint.d \
    && chmod -R g=u /etc/nginx /usr/share/nginx/html /var/cache/nginx /docker-entrypoint.d

USER 101
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz | grep -q ok || exit 1
