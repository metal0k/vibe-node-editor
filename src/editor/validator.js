/**
 * Validate a LiteGraph graph:
 *   - directed cycle detection (DFS)
 *   - type compatibility on every link
 *   - dangling input ports (warning, not error)
 *
 * Returns a structured report. Caller decides how to surface it.
 */

import { LiteGraph } from 'litegraph.js';
import { toast } from '../ui/toolbar.js';

export function initValidator({ graph, lcanvas }) {
  // Hook into LGraphCanvas drawNode to outline problem nodes
  installDrawHook(lcanvas);

  return () => runValidation({ graph, lcanvas });
}

const STATE = {
  errorNodeIds: new Set(),
  warnNodeIds: new Set(),
  errorLinkIds: new Set(),
};

function installDrawHook(lcanvas) {
  const proto = Object.getPrototypeOf(lcanvas);
  if (proto.__vibeValidatorPatched) return;
  proto.__vibeValidatorPatched = true;

  const originalDrawNode = proto.drawNode;
  proto.drawNode = function (node, ctx) {
    const result = originalDrawNode.call(this, node, ctx);
    overlayNodeOutline(node, ctx);
    return result;
  };

  // Color individual links by their status
  const originalRenderLink = proto.renderLink;
  if (originalRenderLink) {
    proto.renderLink = function (ctx, a, b, link, ...rest) {
      const fallback = link && STATE.errorLinkIds.has(link.id)
        ? this.default_link_color
        : null;
      const original = this.default_link_color;
      if (fallback) {
        this.default_link_color = readVar('--link-error');
      }
      const r = originalRenderLink.call(this, ctx, a, b, link, ...rest);
      if (fallback) this.default_link_color = original;
      return r;
    };
  }
}

function overlayNodeOutline(node, ctx) {
  let color = null;
  let width = 2;
  if (STATE.errorNodeIds.has(node.id)) {
    color = readVar('--error');
    width = 2.5;
  } else if (STATE.warnNodeIds.has(node.id)) {
    color = readVar('--warn');
    width = 1.5;
  }
  if (!color) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([4, 3]);
  const hasTitle = !(node.flags && (node.flags.no_title || node.type === 'vibe/comment'));
  const titleH = hasTitle ? (LiteGraph.NODE_TITLE_HEIGHT || 30) : 0;
  const h = (node.flags && node.flags.collapsed) ? (node._collapsed_height || 24) : node.size[1];
  ctx.strokeRect(-2, -2 - titleH, node.size[0] + 4, h + 4 + titleH);
  ctx.restore();
}

function readVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ── Validation entry point ─────────────────────────────── */

function runValidation({ graph, lcanvas }) {
  const nodes = graph._nodes || [];
  const links = graph.links || {};

  clearMarks();

  if (nodes.length > 5000) {
    toast('Graph too large to validate (>5000 nodes)', 'warn');
    lcanvas.setDirty(true, true);
    return { cycles: [], typeIssues: [], dangling: [], errors: 0, warnings: 0 };
  }

  const cycles = detectCycles(nodes, links);
  const typeIssues = checkTypes(nodes, links);
  const dangling = findDanglingInputs(nodes);

  // Mark nodes & links
  for (const cycle of cycles) {
    for (const nodeId of cycle) STATE.errorNodeIds.add(nodeId);
  }
  for (const issue of typeIssues) {
    STATE.errorLinkIds.add(issue.linkId);
    STATE.errorNodeIds.add(issue.fromNode);
    STATE.errorNodeIds.add(issue.toNode);
  }
  for (const w of dangling) {
    STATE.warnNodeIds.add(w.nodeId);
  }

  lcanvas.setDirty(true, true);

  const report = {
    cycles,
    typeIssues,
    dangling,
    errors: cycles.length + typeIssues.length,
    warnings: dangling.length,
  };
  announce(report);
  return report;
}

function clearMarks() {
  STATE.errorNodeIds.clear();
  STATE.warnNodeIds.clear();
  STATE.errorLinkIds.clear();
}

/* ── Cycle detection (Tarjan-lite via DFS) ──────────────── */

function detectCycles(nodes, links) {
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, []);
  for (const k in links) {
    const lk = links[k];
    if (!lk) continue;
    const from = lk.origin_id;
    const to = lk.target_id;
    if (adj.has(from)) adj.get(from).push(to);
  }

  const cycles = [];
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const parent = new Map();
  for (const n of nodes) color.set(n.id, WHITE);

  function visit(u, path) {
    color.set(u, GRAY);
    path.push(u);
    for (const v of adj.get(u) || []) {
      if (color.get(v) === GRAY) {
        const idx = path.indexOf(v);
        cycles.push(path.slice(idx).concat([v]));
      } else if (color.get(v) === WHITE) {
        parent.set(v, u);
        visit(v, path);
      }
    }
    color.set(u, BLACK);
    path.pop();
  }

  for (const n of nodes) {
    if (color.get(n.id) === WHITE) visit(n.id, []);
  }
  return cycles;
}

/* ── Type compatibility ─────────────────────────────────── */

function checkTypes(nodes, links) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const issues = [];
  for (const k in links) {
    const lk = links[k];
    if (!lk) continue;
    const fromNode = byId.get(lk.origin_id);
    const toNode = byId.get(lk.target_id);
    if (!fromNode || !toNode) continue;
    const outDef = fromNode.outputs?.[lk.origin_slot];
    const inDef = toNode.inputs?.[lk.target_slot];
    if (!outDef || !inDef) continue;

    const out = String(outDef.type ?? '0');
    const inT = String(inDef.type ?? '0');

    if (out === '0' || inT === '0' || out === '*' || inT === '*' || out === inT) continue;

    issues.push({
      linkId: lk.id,
      fromNode: lk.origin_id,
      toNode: lk.target_id,
      outType: out,
      inType: inT,
    });
  }
  return issues;
}

/* ── Dangling inputs ────────────────────────────────────── */

function findDanglingInputs(nodes) {
  const out = [];
  for (const n of nodes) {
    if (!n.inputs) continue;
    for (let i = 0; i < n.inputs.length; i++) {
      const inp = n.inputs[i];
      if (inp && inp.link == null) {
        out.push({ nodeId: n.id, slot: i, name: inp.name });
      }
    }
  }
  return out;
}

/* ── User-facing announcement ───────────────────────────── */

function announce(r) {
  if (r.errors === 0 && r.warnings === 0) {
    toast('Graph is valid', 'success');
    return;
  }
  const parts = [];
  if (r.cycles.length) parts.push(`${r.cycles.length} cycle${s(r.cycles.length)}`);
  if (r.typeIssues.length) parts.push(`${r.typeIssues.length} type mismatch${s(r.typeIssues.length, 'es')}`);
  if (r.dangling.length) parts.push(`${r.dangling.length} dangling input${s(r.dangling.length)}`);
  const kind = r.errors > 0 ? 'error' : 'warn';
  toast(parts.join(' · '), kind, 3600);
}

function s(n, suffix = 's') {
  return n === 1 ? '' : suffix;
}
