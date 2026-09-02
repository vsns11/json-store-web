# JSON Store Web

React single-page app for storing, formatting and browsing JSON documents. It is a pure static bundle —
nginx serves it, and it talks to the JSON Store API over HTTP.

The API lives in its own repository (`json-store-api`). This repo has no build-time dependency on it;
the API's address is supplied at container start.

```
src/
├── components/   table, editor, form, tree, sidebar, dialogs
├── lib/          json.js (parse, format, syntax-error locator) · jsonPath.js (read/write by path)
├── hooks/        document list and toasts
└── api/          the HTTP client
nginx/            config templates rendered at container start
openshift/        Deployment, Service, Route, HPA, BuildConfig
```

## Features

**Everything stored, in a table**

The landing view lists every document — name, description, tags, size, created and updated — with
sortable columns, pagination and search. Editing starts from a row: **Edit** opens the document, and
saving brings you back to the table.

**Three ways to edit a document**

- **Form** (the default) — an ordinary document form. Objects become sections, lists become numbered
  items, and every value gets a labelled input with its type beside it (`string`, `number`, `boolean`,
  `null`, `object`, `array`). Rename a field by typing over its name, switch a field to an object or a
  list to nest deeper, and use **Add field** / **Add item** at any level. Adding a row to a list of
  objects copies the shape of the last one, so filling in a template is mostly typing values. No JSON
  is written by hand.
- **Editor** — line numbers, `Tab` indentation, and live validation that reports the exact line and
  column of the first syntax error (click the error to jump the caret there).
- **Tree** — a collapsible view of the parsed document.

**Everything else**

- Pretty-print, minify, sort keys A→Z; live size, key, node and depth counts
- Import a `.json` file by picking it or dropping it on the editor; copy and download
- Full-text search across names, descriptions, tags and the JSON payload itself
- Name, description and up to 12 tags per document
- A sidebar that expands and collapses in place, light and dark themes
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
