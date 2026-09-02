# JSON Store Web

React single-page app for storing, formatting and browsing JSON documents. It is a pure static bundle —
nginx serves it, and it talks to the JSON Store API over HTTP.

The API lives in its own repository (`json-store-api`). This repo has no build-time dependency on it;
the API's address is supplied at container start.

```
src/
├── components/   editor, form, tree, list, menu, dialogs
├── lib/          json.js (parse, format, syntax-error locator) · jsonPath.js (paths)
├── hooks/        document list and toasts
└── api/          the HTTP client
nginx/            config templates rendered at container start
openshift/        Deployment, Service, Route, HPA, BuildConfig
```

## Features

**Three ways to edit a document**

- **Form** — the document as a list of JSON paths. Add a path such as `owner.email`, `items[0].sku` or
  `rollout["region.eu"]`, pick a type (`string`, `number`, `boolean`, `null`, or nested `json`) and give
  it a value; the objects and arrays along that path are created for you. Rename a path to move its
  value, remove a row to delete it. Handy for filling in a template without writing JSON by hand.
- **Editor** — line numbers, `Tab` indentation, and live validation that reports the exact line and
  column of the first syntax error (click the error to jump the caret there).
- **Tree** — a collapsible view of the parsed document.

**Everything else**

- Pretty-print, minify, sort keys A→Z; live size, key, node and depth counts
- Import a `.json` file by picking it or dropping it on the editor; copy and download
- Full-text search across names, descriptions, tags and the JSON payload itself
- Name, description and up to 12 tags per document; sorting and pagination
- Menu for new/refresh/theme/shortcuts, light and dark themes
- `⌘/Ctrl+S` save · `⌘/Ctrl+⇧F` format · `⌘/Ctrl+K` search

## Run it

**Development** — proxies `/api` to `localhost:8080`, so there is no CORS to think about:

```bash
npm install && npm run dev
```

Point it at an API somewhere else with `API_URL=https://api.example.com npm run dev`.

**Container**:

```bash
docker compose up -d --build          # http://localhost:3000
```

## Configuration

The bundle is built once and configured at start, so the same image ships to every environment.

| Variable | Default | Notes |
| --- | --- | --- |
| `API_BASE_URL` | empty | Where the browser reaches the API. Empty means same origin |
| `APP_VERSION` | `dev` | Shown in the menu |

The container writes these into `/usr/share/nginx/html/config.js` on start; `index.html` loads it before
the bundle. For static hosting (S3+CloudFront, Pages, Netlify, Vercel) there is no container, so set
`VITE_API_BASE_URL` at build time instead and upload `dist/`.

nginx serves the bundle with gzip, a content security policy whose `connect-src` is widened to
`API_BASE_URL`, one-year immutable caching on content-hashed assets, and `no-store` on `index.html` and
`config.js` so a deploy reaches browsers immediately.

## Deploying to OpenShift

The image is `nginx-unprivileged`: it listens on 8080, needs no root, and its writable paths belong to
GID 0, so OpenShift's arbitrary UID works under the `restricted-v2` SCC without an `anyuid` exception.

```bash
oc project json-store

# Either let OpenShift build the image from git…
oc apply -f openshift/build.yaml
oc start-build json-store-web --follow

# …or push your own image and skip build.yaml.

oc apply -f openshift/deployment.yaml
oc apply -f openshift/route.yaml
```

`openshift/route.yaml` creates two Routes on one hostname: `/` to this app and `/api` to the API's
Service (which the other repo creates). Longest path wins in the OpenShift router, so the API is matched
first. That keeps everything same-origin: no CORS preflights, one certificate.

To run the two on separate hostnames instead, delete the second Route, set `API_BASE_URL` on this
Deployment to the API's URL, and add this app's URL to `CORS_ORIGINS` on the API.
