import { buildSampleGraph } from './sample-graph.js';

const LS_KEY = 'vibe:graph';
const URL_PARAM = 'g';

let refs = null;
let autosaveTimer = null;

export function initPersistence({ graph, lcanvas }) {
  refs = { graph, lcanvas };

  // Auto-save on structural changes only (debounced 300ms)
  if (!graph.__vibePersistenceHooked) {
    const trigger = () => scheduleAutosave();
    hookAfter(graph, 'onNodeAdded', trigger);
    hookAfter(graph, 'onNodeRemoved', trigger);
    hookAfter(graph, 'onConnectionChange', trigger);
    hookAfter(graph, 'onAfterChange', trigger);
    graph.__vibePersistenceHooked = true;
  }

  // Expose for inspector property changes to trigger autosave explicitly
  graph.__vibeAutosave = () => scheduleAutosave();

  // Initial load: URL hash > localStorage > sample
  const restored = restoreOnStartup(graph);
  return restored;
}

function hookAfter(graph, methodName, fn) {
  const prev = graph[methodName];
  graph[methodName] = function (...args) {
    if (prev) prev.apply(this, args);
    fn();
  };
}

/* ── Save / Load JSON ───────────────────────────────────── */

export function saveJsonFile() {
  const data = refs.graph.serialize();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = formatTimestamp();
  a.href = url;
  a.download = `vibe-graph-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return a.download;
}

export function loadJsonFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!validateGraphPayload(data)) {
          throw new Error('Invalid or unsafe graph payload');
        }
        refs.graph.configure(data);
        refs.graph.runStep();
        resolve(file.name);
      } catch (err) {
        reject(err);
      }
    });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Sanity-check a deserialized graph object before feeding it to LiteGraph.
 * Rejects oversize payloads and unknown node types. Returns true if safe.
 */
const MAX_NODES = 5000;
const MAX_LINKS = 20000;
const ALLOWED_TYPES = new Set([
  'vibe/value', 'vibe/multiply', 'vibe/default', 'vibe/comment',
]);

export function validateGraphPayload(data) {
  if (!data || typeof data !== 'object') return false;
  const nodes = Array.isArray(data._nodes) ? data._nodes : data.nodes;
  if (!Array.isArray(nodes)) return false;
  if (nodes.length > MAX_NODES) return false;
  for (const n of nodes) {
    if (!n || typeof n !== 'object') return false;
    if (n.type && !ALLOWED_TYPES.has(n.type)) return false;
  }
  if (data.links) {
    const links = Array.isArray(data.links)
      ? data.links
      : Object.values(data.links);
    if (links.length > MAX_LINKS) return false;
  }
  return true;
}

/* ── localStorage autosave / restore ────────────────────── */

function scheduleAutosave() {
  if (!refs) return;
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      const data = refs.graph.serialize();
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (err) {
      console.warn('[vibe] autosave failed:', err);
    }
  }, 300);
}

function restoreOnStartup(graph) {
  // URL hash takes priority
  const hashData = readHashGraph();
  if (hashData && validateGraphPayload(hashData)) {
    try {
      graph.configure(hashData);
      graph.runStep();
      return 'url';
    } catch (err) {
      console.warn('[vibe] failed to restore from URL:', err);
    }
  } else if (hashData) {
    console.warn('[vibe] URL payload rejected by validation');
  }
  // localStorage second
  const stored = localStorage.getItem(LS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (validateGraphPayload(parsed)) {
        graph.configure(parsed);
        graph.runStep();
        return 'localStorage';
      }
    } catch (err) {
      console.warn('[vibe] failed to restore from localStorage:', err);
    }
  }
  return 'sample';
}

/* ── URL share ──────────────────────────────────────────── */

export function buildShareUrl() {
  const data = refs.graph.serialize();
  const encoded = encodePayload(data);
  const url = new URL(window.location.href);
  url.hash = `${URL_PARAM}=${encoded}`;
  return url.toString();
}

export async function copyShareUrl() {
  const url = buildShareUrl();
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
  } else {
    fallbackCopy(url);
  }
  return url;
}

function readHashGraph() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const payload = params.get(URL_PARAM);
  if (!payload) return null;
  try {
    return decodePayload(payload);
  } catch (err) {
    console.warn('[vibe] invalid URL payload:', err);
    return null;
  }
}

function encodePayload(data) {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePayload(s) {
  let pad = s.replace(/-/g, '+').replace(/_/g, '/');
  while (pad.length % 4) pad += '=';
  const binary = atob(pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* noop */ }
  ta.remove();
}

/* ── Viewport helpers (Fit / Frame) ─────────────────────── */

export function frameAll() {
  if (!refs) return;
  const nodes = refs.graph._nodes;
  if (!nodes || nodes.length === 0) return;
  frameNodes(nodes);
}

export function fitSelection() {
  if (!refs) return;
  const nodes = Object.values(refs.lcanvas.selected_nodes || {});
  if (nodes.length === 0) return frameAll();
  frameNodes(nodes);
}

function frameNodes(nodes) {
  const lcanvas = refs.lcanvas;
  const canvas = lcanvas.canvas;
  if (!canvas) return;
  const bounds = boundsOf(nodes);
  if (!bounds) return;

  const margin = 60;
  const w = bounds.right - bounds.left + margin * 2;
  const h = bounds.bottom - bounds.top + margin * 2;

  const scale = Math.min(canvas.width / w, canvas.height / h, 1.5);
  const cx = (bounds.left + bounds.right) / 2;
  const cy = (bounds.top + bounds.bottom) / 2;

  lcanvas.ds.scale = scale;
  lcanvas.ds.offset[0] = canvas.width / 2 / scale - cx;
  lcanvas.ds.offset[1] = canvas.height / 2 / scale - cy;
  lcanvas.setDirty(true, true);
}

function boundsOf(nodes) {
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  for (const n of nodes) {
    const [x, y] = n.pos;
    const [w, h] = n.size;
    if (x < l) l = x;
    if (y < t) t = y;
    if (x + w > r) r = x + w;
    if (y + h > b) b = y + h;
  }
  if (l === Infinity) return null;
  return { left: l, top: t, right: r, bottom: b };
}

/* ── Reset to sample ────────────────────────────────────── */

export function resetToSample() {
  buildSampleGraph(refs.graph);
  scheduleAutosave();
}

function formatTimestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
