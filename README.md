# Vibe Node Editor

A web-based node editor — minimal clone of the LazNodeEditor desktop demo,
built with Vite + vanilla JS + [LiteGraph.js](https://github.com/jagenjo/litegraph.js).

**Live**: <https://metal0k.github.io/vibe-node-editor/>

## Features

- 4 node types: **Value**, **Multiply**, **Default**, **Comment**
- Reactive execution — value changes propagate downstream automatically
- Inspector panel with two-way binding (name, position, size, type-specific fields)
- Save / Load JSON, autosave to `localStorage`, share via base64 URL hash
- Validator: cycle detection, type checking, dangling input warnings (with on-canvas highlights)
- Light / dark themes (persists in `localStorage`, falls back to `prefers-color-scheme`)
- WCAG AA contrast guaranteed in both themes (enforced via Playwright tests)
- Keyboard shortcuts: `Del`, `Ctrl+S/O/A/D`, `F`, `Shift+F`, `Esc`, `Space+drag`
- Pan / zoom / multi-select / box-select / right-click Add Node menu

## Development

```bash
npm install
npm run dev          # vite dev server on :5173
npm run build        # production build → dist/
npm run preview      # preview build on :4173
npm run test:e2e     # Playwright suite (6 functional + 4 contrast tests)
npm run test:e2e:headed  # same, with visible browser
```

## E2E tests against production

```bash
PLAYWRIGHT_BASE_URL=https://metal0k.github.io/vibe-node-editor/ \
  npx playwright test smoke.spec.js contrast.spec.js
```

## Deploy

```bash
npm run deploy       # build + push dist/ to gh-pages branch
```

This pushes the built `dist/` directory to the `gh-pages` branch via the
[`gh-pages`](https://github.com/tschaub/gh-pages) package. GitHub Pages is
configured with source = `gh-pages` branch (path `/`).

> **Note**: A GitHub Action workflow (`.github/workflows/deploy.yml`) is
> spec'd in `specs/spec-node-editor.md` §10.2 for full automation on push
> to `main`, but is not in this repo because the deploying PAT lacked
> `workflow` scope. To enable: add the workflow file (via web UI or with a
> re-issued PAT) and switch Pages source to "GitHub Actions".

## Project structure

See `specs/spec-node-editor.md` in the parent project for the full spec,
architecture decisions, design tokens, and acceptance criteria.

```
src/
  main.js                      # entry — wires theme → toolbar → editor → inspector → validator → persistence
  editor/
    setup.js                   # LiteGraph init, context menu override, reactivity hooks
    sample-graph.js            # initial demo graph (Value A × Value B → Multiply → Default → Multiply Custom + Comment)
    persistence.js             # Save/Load JSON, localStorage autosave, base64 URL hash, Fit/Frame
    validator.js               # DFS cycles, port type check, dangling inputs, canvas overlay
    shortcuts.js               # keyboard handlers
    node-theme.js              # pushes CSS tokens into LiteGraph globals (reactive on theme change)
    nodes/                     # 4 node type implementations
  ui/
    theme.js                   # light/dark toggle
    toolbar.js                 # topbar buttons + toast helper
    inspector.js               # adaptive form, two-way binding
  styles/                      # tokens.css (CSS vars), app.css, inspector.css
tests/e2e/                     # Playwright specs (smoke, add-node, connect-ports, reactive, contrast)
```
