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
chart/            Helm chart: Deployment, Service, Route or Ingress, HPA
```

## Features

**Everything stored, in a table**

The landing view lists every profile — name, description, tags, size, created and updated — with
sortable columns, pagination and search. It asks the API for one page at a time, so it renders the same
~500 DOM nodes whether the store holds seven profiles or a hundred thousand; the page number is typeable
for when there are thousands of them. Editing starts from a row: **Edit** opens the profile, and
saving brings you back to the table. Profiles are created, updated and deleted from here.

**Three ways to work on a profile, two of them always available**

- **Form** — for profiles that came from templates. Editing one opens on this tab, showing a card per
  template it was built from, holding exactly the fields that template substitutes — the values that
  were taken as input, and nothing else. The pickers are not repeated here: which templates were used
  is settled, and each card is titled with its own. Changing a field rebuilds the inputs from those
  templates; if they were edited by hand since, the form says so before you overwrite that work.

  Profiles saved before the selection was recorded still get the form: their inputs are matched against
  the catalogue — every literal a fragment writes has to be present and equal — and the values are read
  back out of them. A field the catalogue gained later falls back to its default rather than failing the
  match, and saving records what was matched. Inputs that match nothing, like a document written by
  hand, get no form rather than a guess.

- **Editor** — a syntax-coloured editor: keys, strings, numbers, booleans and punctuation are coloured
  as you type, with line numbers, `Tab` indentation, and live validation that reports the exact line and
  column of the first syntax error (click the error to jump the caret there). Colouring is painted on a
  layer under a transparent textarea, so the caret, selection, undo and native shortcuts all behave
  exactly as they normally would.
- **Tree** — the same document collapsed into a browsable tree.

**Building a big profile from small ones**

There is one **New profile**, and it opens the same screen editing does. On its Form tab, pick a
scenario and optionally a customer, payment, delivery and expectation module, and the merged inputs
build up as you fill in the fields they ask for; leave every picker on *none* and write the inputs
yourself on the Editor tab instead. The catalogue comes from the API, so adding fragments is a
configuration change on that side.

The selection is stored with the profile, so **Edit** reopens that same form with everything still
filled in — the templates chosen and the values typed — rather than only the raw JSON.

**Working with a store full of near-identical profiles**

- **Duplicate** copies a profile — inputs, tags and the templates behind it — and opens the copy, which
  is how most scenarios start: the same thing with one field changed.
- **Compare** shows what differs between the open profile and any other, path by path, rather than two
  documents side by side. "Same but the card is declined" is the question, and a list of paths answers
  it.
- **Click a tag** to narrow the table to it. That is an exact filter on the tag, not a text search, so
  `regression` in someone's notes does not muddy the list.
- **Nothing is lost by accident**: leaving a profile with unsaved changes asks first, whether you use
  the back link, the sidebar, `Esc`, or close the tab.
- **Rows per page** is yours to choose once there is more than a page of them.

**Everything else**

- Pretty-print, minify, sort keys A→Z; live size, key, node and depth counts
- Import a `.json` file by picking it or dropping it on the editor; copy and download
- Full-text search across names, descriptions, tags and the inputs themselves
- Name, description and up to 12 tags per profile
- A sidebar that expands and collapses in place, light and dark themes
- The signed-in user sits top left, beside the brand; creating a profile lives in the sidebar
- Sign-in against the directory the API is pointed at; the session token lives in the tab only
- `⌘/Ctrl+S` save · `⌘/Ctrl+⇧F` format · `⌘/Ctrl+K` search

## Getting started

### What you need

| Path | Needs |
| --- | --- |
| Development | Node 20 or newer, and the API running (see the `json-store-api` repository) |
| Container | Docker Desktop, or Docker Engine with Compose v2 |

### Development

```bash
git clone <this-repo> json-store-web
cd json-store-web
npm install
npm run dev
```

Open <http://localhost:5173>. The dev server proxies `/api` to `localhost:8080`, so the browser only
ever talks to one origin and there is no CORS to think about. If the API is somewhere else:

```bash
API_URL=https://api.example.com npm run dev
```

### Container

```bash
cp .env.example .env      # then set API_BASE_URL if the API is not on localhost:8080
docker compose up -d --build
```

Open <http://localhost:3000>. Stop it with `docker compose down`.

### Signing in

The API authenticates against LDAP and answers with a bearer token, which this app keeps in
`sessionStorage` for the tab. Against the API's own local directory, sign in as `alice / secret` (may
delete profiles) or `bob / secret` (may not). A rejected or expired token returns you to the sign-in
screen.

### If something does not work

| Symptom | Cause and fix |
| --- | --- |
| Sign-in says the API cannot be reached | The API is not running, or `API_BASE_URL` points somewhere else. Check `curl localhost:8080/api/auth/login` |
| Sign-in works but every request then fails | The API is on another origin and does not allow this one: add it to `CORS_ORIGINS` there |
| `Port 5173 is in use` | Another Vite server is running: `npm run dev -- --port 5174` |
| The page loads but nothing appears | Look at `config.js` in the browser: it should hold the API address the container was given |
| Changes do not show after a rebuild | Hard-reload once; `index.html` and `config.js` are sent with `no-store`, hashed assets are cached forever |

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

## How the app fits together

If React is new to you, this is the whole shape of it. There are only three kinds of file.

**Components** (`src/components/`) are functions that return what you see. They take their data as
arguments — props — and call functions passed to them when something happens. They never fetch, and
they never reach into each other.

```jsx
// ProfileTable is given rows and told what to do when one is clicked.
<ProfileTable page={page} onOpen={openProfile} onDelete={setPendingDelete} />
```

**Hooks** (`src/hooks/`) hold state and the work that keeps it up to date. `useProfiles` owns the
query — search, tag, sort, page — and refetches whenever it changes. `useAuth` owns who is signed in.
`useToasts` owns the little messages. A hook is just a function whose name starts with `use`.

**Plain modules** (`src/lib/`, `src/api/`) are ordinary JavaScript with no React in them at all:
parsing and formatting JSON, matching templates, talking to the API. They can be read and tested on
their own.

State lives as high as it needs to and no higher:

```
App                      which view is showing, which profile is open, the theme
├── useProfiles          the table's query and its results
├── ProfileTable         nothing of its own — everything arrives as props
└── ProfileEditor        the draft being edited, until it is saved or discarded
    ├── TemplateForm     nothing of its own
    └── JsonEditor       nothing of its own
```

Data flows one way — down as props — and changes flow back up as function calls. When you cannot work
out where a value comes from, follow the props upward until you find the `useState` that owns it.

Two React details worth knowing, because they are both used here:

- `useState` remembers a value between renders; changing it redraws the component.
- `useEffect` runs after a render, for things outside React: fetching, listening for key presses,
  warning before the tab closes. Its second argument lists what it depends on.

## Making it yours

Everything visual is a CSS custom property, and every property lives in one file.

| File | What is in it |
| --- | --- |
| `src/styles/tokens.css` | Every colour, radius, shadow, font and code-view metric — light palette first, dark palette overriding only what differs. Includes the eight tints used for tags and monograms |
| `src/styles/base.css` | Element defaults and the small reusable pieces: buttons, inputs, dialogs, toasts, spinner, skeleton |
| `src/styles/layout.css` | The shell: top bar, sidebar rail, the panel every view sits in |
| `src/styles/views.css` | One block per screen: profile table, editor, composer, sign-in |

To rebrand, edit `tokens.css` and nothing else: `--accent` and `--accent-soft` carry the brand colour,
`--code-*` colour the JSON, `--tint-N-*` colour tags and monograms, `--radius*` set the corner style,
`--sans` and `--mono` the typefaces. No colour is written anywhere outside that file, so there is
nothing to hunt for.

Tags and profile monograms take their colour from their own name — `lib/palette.js` hashes the text to
one of the eight tints — so a tag looks the same in the table as it does on the profile, with nothing
stored against it. Widening the set means adding a `--tint-8-*` pair, a `.tint-8` class in `base.css`,
and raising `PALETTE_SIZE`.

Components map one-to-one onto what you see, and each takes plain props with no shared mutable state:

| Component | Shows |
| --- | --- |
| `ProfileTable` | The list of every profile, with sorting and paging |
| `ProfileEditor` | One profile, new or existing: toolbar, form/editor/tree, status bar |
| `ProfileHeader` | The profile's own name, description and tags |
| `CompareDialog` | Picking another profile and listing what differs |
| `JsonEditor` · `JsonTree` | The two ways of viewing inputs |
| `TemplateForm` | The template pickers and the cards of fields they ask for |
| `FormField` | Every input control the template form can draw (see below) |
| `Sidebar` | Navigation |
| `TopBar` | Brand, the signed-in user, store totals and search |
| `EditorToolbar` · `StatusBar` · `TagEditor` | The controls around the editor |
| `LoginScreen` · `ConfirmDialog` · `ShortcutsDialog` · `Toasts` · `ErrorBoundary` | Sign-in and the overlays |

### Adding a field to a template

Fields are declared in the API's catalogue and drawn by `src/components/FormField.jsx`. Each selected
template becomes a card of its own fields, so a fragment's inputs stay together on screen.

| `type` | Control | Value stored | Extra keys |
| --- | --- | --- | --- |
| `text` | Single-line input | string | `placeholder` |
| `textarea` | Multi-line input | string | `rows`, `placeholder` |
| `number` | Numeric input | number | `min`, `max`, `step` |
| `range` | Slider with a live readout | number | `min`, `max`, `step` |
| `date` | Date picker | string (`YYYY-MM-DD`) | |
| `select` | Dropdown | string | `options` |
| `radio` | Radio group | string | `options` |
| `switch` | On/off toggle | boolean | |
| `checkbox` | Single checkbox | boolean | `checkboxLabel` |
| `checkboxes` | Checkbox group | array of strings | `options` |
| `tags` | Free-form list | array of strings | `placeholder` |

A field is only shown if the fragment bodies actually substitute it — a `${key}` that appears nowhere
changes nothing, so it is never asked for.

Every type also takes `label`, `key`, `default`, `required` and `help`. `options` are plain strings, or
`{ value, label }` when the stored value should differ from what is shown.

```json
{ "key": "environment", "label": "Environment", "type": "radio",
  "options": ["local", "dev", "staging"], "default": "staging", "help": "Where the run happens" }
```

A value lands in the profile wherever the fragment's body names it: `"env": "${environment}"`. A string
that is exactly one placeholder keeps the value's type, so switches stay booleans, sliders stay numbers
and tag lists stay arrays.

Adding a new *kind* of control means one `case` in `FormField.jsx` and a matching class in
`base.css` — nothing else in the app needs to know about it.

Data access is confined to `src/api/client.js`; the three hooks in `src/hooks/` own sign-in, the profile
list and toasts. A component never calls `fetch` itself, so pointing the app at a different API, or
changing how errors surface, is a one-file change.

## Deploying with Helm

The chart in `chart/` deploys the bundle to OpenShift or plain Kubernetes. Images come from your CI;
the chart only deploys them.

```bash
helm upgrade --install json-store-web ./chart \
  --namespace json-store \
  --set image.repository=registry.example.com/json-store-web \
  --set image.tag=1.0.0 \
  --set route.enabled=true --set route.host=json-store.apps.example.com
```

`config.API_BASE_URL` decides where the browser sends its requests, and it is read when the container
starts, so the same image works in every environment:

- **Left empty** — the browser calls `/api` on the same host. Add a second Route or Ingress rule
  sending `/api` to the API's Service. No CORS, one certificate; this is the recommended setup.
- **Set to the API's own URL** — the browser calls it directly, and that URL must also be listed in
  `CORS_ORIGINS` on the API.

Changing it rolls the pods automatically: the Deployment carries a checksum of the ConfigMap.

See what a release will contain before applying it:

```bash
helm template json-store-web ./chart --set route.enabled=true --set route.host=… | less
```

The image is `nginx-unprivileged`: it listens on 8080, needs no root, and its writable paths belong to
GID 0, so OpenShift's arbitrary UID works under the `restricted-v2` SCC without an `anyuid` exception.

## Building the image

```bash
docker build -t json-store-web:1.0.0 .
```

Both base images are build arguments, so internal ones can be used instead:

```bash
docker build -t json-store-web:1.0.0 \
  --build-arg BUILD_IMAGE=registry.example.com/node:22 \
  --build-arg RUNTIME_IMAGE=registry.example.com/nginx-unprivileged:1.27 .
```

For static hosting without a container (S3, Pages, Netlify, Vercel), skip the image altogether: set
`VITE_API_BASE_URL` at build time and upload `dist/`.
