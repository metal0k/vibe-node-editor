# Vibe Node Editor

A web-based node editor — minimal clone of the LazNodeEditor desktop demo,
built with Vite + vanilla JS + [LiteGraph.js](https://github.com/jagenjo/litegraph.js).

**Live**: https://metal0k.github.io/vibe-node-editor/

## Features

- 4 node types: **Value**, **Multiply**, **Default**, **Comment**
- Reactive execution — value changes propagate downstream automatically
- Inspector panel with two-way binding (name, position, size, type-specific fields)
- Save / Load JSON, autosave to `localStorage`, share via base64 URL hash
- Validator: cycle detection, type checking, dangling input warnings
- Light / dark themes (persists in `localStorage`)
- Keyboard shortcuts: `Del`, `Ctrl+S/O/A/D`, `F`, `Shift+F`, `Esc`, `Space+drag`
- Pan / zoom / multi-select / box-select / right-click Add Node menu

## Development

```bash
npm install
npm run dev          # vite dev server on :5173
npm run build        # production build → dist/
npm run preview      # preview build on :4173
npm run test:e2e     # Playwright tests against preview server
```

## E2E tests against production

```bash
PLAYWRIGHT_BASE_URL=https://metal0k.github.io/vibe-node-editor/ \
  npx playwright test smoke.spec.js
```

## Deploy

Pushes to `main` are built and deployed via the GitHub Action in
`.github/workflows/deploy.yml`. GitHub Pages source must be set to
**GitHub Actions** in repo settings.
