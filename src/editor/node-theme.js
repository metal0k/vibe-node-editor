/**
 * Apply Vibe Node Editor's design tokens to a LiteGraph canvas.
 * Reads CSS custom properties from :root and pushes them onto
 * LGraphCanvas + each node. Re-applies on theme change.
 */

import { onThemeChange } from '../ui/theme.js';

const NODE_TYPE_COLORS = {
  // type-name (registered as 'vibe/value' etc.) → CSS var name
  'vibe/value':    '--node-value',
  'vibe/multiply': '--node-multiply',
  'vibe/default':  '--node-default',
  'vibe/comment':  '--node-comment-bg',
};

export function applyNodeTheme(lcanvas) {
  if (!lcanvas) return;
  paint(lcanvas);
  onThemeChange(() => paint(lcanvas));
}

function paint(lcanvas) {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();

  /* ── Canvas background + dot grid via data-URL ───────────── */
  lcanvas.clear_background = true;
  lcanvas.clear_background_color = v('--bg-canvas');
  lcanvas.background_image = buildDotGrid(v('--grid-dot'));

  /* ── Connection lines ────────────────────────────────────── */
  lcanvas.default_link_color = v('--link-default');
  lcanvas.default_connection_color_byType = {
    number:  v('--link-default'),
    string:  v('--port-any'),
    '*':     v('--link-default'),
  };
  lcanvas.links_render_mode = 2;  // 0=straight, 1=linear, 2=spline (bezier)
  lcanvas.render_curved_connections = true;
  lcanvas.render_connection_arrows = false;
  lcanvas.render_connections_shadows = false;
  lcanvas.render_connections_border = true;
  lcanvas.connections_width = 3;

  /* ── Port circles ────────────────────────────────────────── */
  lcanvas.default_connection_color = {
    input_off:  v('--port-in'),
    input_on:   v('--port-out'),
    output_off: v('--port-in'),
    output_on:  v('--port-out'),
  };

  /* ── Re-color existing nodes ─────────────────────────────── */
  const graph = lcanvas.graph;
  if (graph && graph._nodes) {
    for (const node of graph._nodes) colorNode(node, v);
  }

  /* ── Hook future node additions (idempotent) ─────────────── */
  if (graph && !graph.__vibeThemed) {
    const original = graph.onNodeAdded;
    graph.onNodeAdded = function (node) {
      colorNode(node, getCssVarReader());
      if (original) original.call(this, node);
    };
    graph.__vibeThemed = true;
  }

  lcanvas.setDirty(true, true);
}

function colorNode(node, v) {
  const varName = NODE_TYPE_COLORS[node.type];
  const headerColor = varName ? v(varName) : v('--node-default');

  if (node.type === 'vibe/comment') {
    node.color = 'transparent';
    node.bgcolor = v('--node-comment-bg');
    node.boxcolor = v('--node-comment-border');
  } else {
    node.color = headerColor;
    node.bgcolor = v('--bg-elevated');
    node.boxcolor = v('--selection');
  }
}

function getCssVarReader() {
  const css = getComputedStyle(document.documentElement);
  return (name) => css.getPropertyValue(name).trim();
}

/* Build a tiny SVG data-URL for the canvas dot-grid background */
function buildDotGrid(dotColor) {
  const safe = encodeURIComponent(dotColor);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'>` +
    `<circle cx='11' cy='11' r='0.9' fill='${dotColor}'/>` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
