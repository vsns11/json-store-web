# JSON Store Web

React single-page app for storing, formatting and browsing test-scenario profiles — each profile being
a named set of JSON inputs a scenario runs with. It is a pure static bundle —
nginx serves it, and it talks to the JSON Store API over HTTP.

The API lives in its own repository (`json-store-api`). This repo has no build-time dependency on it;
the API's address is supplied at container start.

```
src/
├── components/   one file per piece of the interface (see the map below)
├── styles/       tokens.css · base.css · layout.css · views.css
├── lib/          json.js (parse, format, error locator) · highlight.js · template.js (merging)
├── hooks/        sign-in, profile list, toasts
├── api/          the HTTP client
└── config.js     runtime configuration read from the container
nginx/            config templates rendered at container start
openshift/        Deployment, Service, Route, HPA, BuildConfig
```

## Features

**Everything stored, in a table**

The landing view lists every profile — name, description, tags, size, created and updated — with
sortable columns, pagination and search. Editing starts from a row: **Edit** opens the profile, and
saving brings you back to the table. Profiles are created, updated and deleted from here.

**Two ways to look at a profile's inputs**

- **Editor** — a syntax-coloured editor: keys, strings, numbers, booleans and punctuation are coloured
  as you type, with line numbers, `Tab` indentation, and live validation that reports the exact line and
  column of the first syntax error (click the error to jump the caret there). Colouring is painted on a
  layer under a transparent textarea, so the caret, selection, undo and native shortcuts all behave
  exactly as they normally would.
- **Tree** — the same document collapsed into a browsable tree.

**Building a big profile from small ones**

**New profile from template** composes one large profile out of catalogue fragments: choose a scenario
and optionally a customer, payment, delivery and expectation module, then fill in the handful of fields
they ask for. **Preview** shows the merged result before you save it. The catalogue comes from the API,
so adding fragments is a configuration change on that side.

**Everything else**

- Pretty-print, minify, sort keys A→Z; live size, key, node and depth counts
- Import a `.json` file by picking it or dropping it on the editor; copy and download
- Full-text search across names, descriptions, tags and the inputs themselves
- Name, description and up to 12 tags per profile
- A sidebar that expands and collapses in place, light and dark themes
- Sign-in against the directory the API is pointed at; the session token lives in the tab only
- `⌘/Ctrl+S` save · `⌘/Ctrl+⇧F` format · `⌘/Ctrl+K` search

## Signing in

The API authenticates against LDAP and answers with a bearer token, which this app keeps in
`sessionStorage` for the tab. When the API is running locally with its built-in directory, sign in as
`alice / secret` (may delete profiles) or `bob / secret` (may not). A rejected or expired token drops
you back to the sign-in screen automatically.

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

The container writes this into `/usr/share/nginx/html/config.js` on start; `index.html` loads it before
the bundle. For static hosting (S3+CloudFront, Pages, Netlify, Vercel) there is no container, so set
`VITE_API_BASE_URL` at build time instead and upload `dist/`.

nginx serves the bundle with gzip, a content security policy whose `connect-src` is widened to
`API_BASE_URL`, one-year immutable caching on content-hashed assets, and `no-store` on `index.html` and
`config.js` so a deploy reaches browsers immediately.

## Making it yours

Everything visual is a CSS custom property, and every property lives in one file.

| File | What is in it |
| --- | --- |
| `src/styles/tokens.css` | Every colour, radius, shadow, font and code-view metric — light palette first, dark palette overriding only what differs |
| `src/styles/base.css` | Element defaults and the small reusable pieces: buttons, inputs, dialogs, toasts, spinner, skeleton |
| `src/styles/layout.css` | The shell: top bar, sidebar rail, the panel every view sits in |
| `src/styles/views.css` | One block per screen: profile table, editor, composer, sign-in |

To rebrand, edit `tokens.css` and nothing else: `--accent` and `--accent-soft` carry the brand colour,
`--code-*` colour the JSON, `--radius*` set the corner style, `--sans` and `--mono` the typefaces. No
colour is written anywhere outside that file, so there is nothing to hunt for.

Components map one-to-one onto what you see, and each takes plain props with no shared mutable state:

| Component | Shows |
| --- | --- |
| `ProfileTable` | The list of every profile, with sorting and paging |
| `ProfileEditor` | One profile: header, toolbar, editor or tree, status bar |
| `JsonEditor` · `JsonTree` | The two ways of viewing inputs |
| `ComposeView` | Template pickers, generated fields, the preview dialog |
| `Sidebar` | Navigation, and the signed-in user |
| `EditorToolbar` · `StatusBar` · `TagEditor` | The controls around the editor |
| `LoginScreen` · `ConfirmDialog` · `ShortcutsDialog` · `Toasts` · `ErrorBoundary` | Sign-in and the overlays |

Data access is confined to `src/api/client.js`; the three hooks in `src/hooks/` own sign-in, the profile
list and toasts. A component never calls `fetch` itself, so pointing the app at a different API, or
changing how errors surface, is a one-file change.

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
