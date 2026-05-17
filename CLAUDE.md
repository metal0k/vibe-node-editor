# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A minimal web-based node editor — clone of the LazNodeEditor desktop demo. Vite + vanilla ES modules + LiteGraph.js 0.7.18. Deployed at <https://metal0k.github.io/vibe-node-editor/>.

Full implementation spec: **`specs/spec-node-editor.md`** — read this for architecture decisions, design tokens, acceptance criteria, and the §15 design-iterations log.

## Commands

```bash
npm run dev               # Vite dev server :5173
npm run build             # production build → dist/
npm run preview           # serve dist on :4173
npm run test:e2e          # full Playwright suite (boots vite preview)
npm run test:e2e:headed   # same, visible browser
npm run deploy            # build + push dist/ to gh-pages branch via gh-pages package

# Single test or filter
npx playwright test smoke.spec.js
npx playwright test contrast.spec.js -g "light"

# Smoke + contrast against production URL
PLAYWRIGHT_BASE_URL=https://metal0k.github.io/vibe-node-editor/ \
  npx playwright test smoke.spec.js contrast.spec.js
```

The `GITHUB_TOKEN` used for `git push` lives in `../.env` (workspace parent). It has `repo` scope only — **not `workflow`** — which is why `.github/workflows/deploy.yml` is intentionally absent (see Deploy).

## Architecture (the non-obvious bits)

**Wiring order** (`src/main.js`): `initTheme()` → `initToolbar()` → `initEditor()` → `applyNodeTheme()` → `initInspector()` → `initValidator()` → `initShortcuts()` → `initPersistence()`. If `initPersistence` returns `'sample'`, then `buildSampleGraph()` runs. Don't reorder casually — `applyNodeTheme` reads the LGraphCanvas instance; `initPersistence` checks URL hash > localStorage > sample.

**LiteGraph theming** (`src/editor/node-theme.js`): The editor doesn't override LiteGraph's draw code. Instead it pushes CSS-token values into `LiteGraph.NODE_TEXT_COLOR`, `NODE_BOX_OUTLINE_COLOR`, `WIDGET_*`, plus `lcanvas.default_link_color` etc. — every theme switch re-runs `paint(lcanvas)` via the `vibe:themechange` event. **Critical**: selection ring uses `LiteGraph.NODE_BOX_OUTLINE_COLOR` (default `#FFF`), NOT `node.boxcolor`. If selection looks invisible after a change, this is why.

**Canvas-rendered node text** (`multiply.js`, `default.js`, `comment.js`) reads CSS tokens (`--canvas-badge-text`, `--canvas-comment-title`, `--canvas-comment-body`) via `getComputedStyle` on every draw. Never hardcode colors in node drawers — it breaks theme switching and WCAG AA contrast tests.

**Prototype patching is global and HMR-fragile**. Several modules monkey-patch `LGraphCanvas.prototype` and `graph.onXxx` callbacks. All of them have idempotency guards (`__vibeMenuPatched`, `__vibeThemeSubscribed`, `__vibeReactiveHooked`, `__vibePersistenceHooked`, `__vibeMirrorHooked`). Preserve these flags when refactoring — without them, Vite HMR stacks duplicate wrappers and breaks behavior.

**Reactive execution**: `graph.runStep` is replaced in `setup.js` (capturing `LGraph.prototype.runStep` *before* the assignment). Triggered automatically on node add/remove and connection change via wrapped `onNodeAdded`/`onNodeRemoved`/`onConnectionChange`. Inspector edits explicitly call `graph.__vibeAutosave?.()` and (for Value widget) `graph.runStep()`. There is no fixed-rate loop.

**Persistence priority**: URL hash (`#g=<base64>`) > `localStorage['vibe:graph']` > sample graph. All three paths go through `validateGraphPayload` (caps 5000 nodes / 20000 links, whitelists `vibe/*` types). Don't bypass this — URL hash is attacker-controllable and overwrites localStorage within 300ms of load.

**Inspector two-way binding** uses `onNodeMoved` + a rAF loop bound to canvas `mousedown`/`mouseup` (not `setInterval`). Skips `document.activeElement` so the user's typing isn't fighting the mirror.

## Tests (Playwright)

- **`page.goto('./')` — always relative**, never `'/'`. Absolute `'/'` skips the `/vibe-node-editor/` baseURL path and lands on `metal0k.github.io` root in production.
- Every test starts with `addInitScript` to clear `localStorage['vibe:graph']` — otherwise the sample graph from a previous run pollutes the next.
- `contrast.spec.js` enforces WCAG AA (4.5 normal text / 3.0 UI & large) for both themes, walking DOM + checking LiteGraph globals + CSS tokens. A new visible text element or color change must keep all checks green.
- Canvas drag-to-connect tests use `node.getConnectionPos(is_input, slot)` to compute exact port pixel positions — approximations (NODE_TITLE_HEIGHT + slot math) miss the small hit zone.

## Deploy

Two paths, pick one:

1. **Current**: `npm run deploy` — builds and pushes `dist/` to `gh-pages` branch via the `gh-pages` npm package. GitHub Pages source = `gh-pages` branch. **This is what's wired up now.**
2. **Future**: `.github/workflows/deploy.yml` (full text in `specs/spec-node-editor.md` §10.2) automates on push to `main`. Cannot add it via git push with the current PAT — needs a token with `workflow` scope, OR upload through GitHub web UI.

**Heads up**: `git add -A` will re-stage `.github/workflows/deploy.yml` if you recreate it locally. The push will be rejected by GitHub with a `workflow` scope error. Either delete the file locally before staging or use `git add` with specific paths.

## Workflow conventions

- Commits are per-stage with conventional prefixes: `chore:`, `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `style:`, `ci:`.
- After significant changes, surface a proposed commit message and wait for approval (per global user CLAUDE.md).
- `specs/spec-node-editor.md` is the production spec — update it when behavior or architecture changes. §15 is the running design-iterations log.
