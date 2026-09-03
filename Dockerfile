# Both base images can be swapped for internal ones:
#   docker build --build-arg RUNTIME_IMAGE=my-registry/nginx-unprivileged:1.27 .
ARG BUILD_IMAGE=node:22-alpine
ARG RUNTIME_IMAGE=nginxinc/nginx-unprivileged:1.27-alpine

FROM ${BUILD_IMAGE} AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${RUNTIME_IMAGE}
USER root
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx/*.template /etc/nginx/templates/
COPY docker-entrypoint.d/10-runtime-config.sh /docker-entrypoint.d/

# nginx and the entrypoint write to these. Owner 101 covers plain Docker, group 0
# covers the arbitrary UID OpenShift assigns.
RUN rm -f /etc/nginx/conf.d/default.conf \
    && chown -R 101:0 /etc/nginx /usr/share/nginx/html /var/cache/nginx /docker-entrypoint.d \
    && chmod -R g=u /etc/nginx /usr/share/nginx/html /var/cache/nginx /docker-entrypoint.d
USER 101

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
    CMD wget -qO- http://127.0.0.1:8080/healthz | grep -q ok
