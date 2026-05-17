import {
  saveJsonFile,
  loadJsonFile,
  frameAll,
  fitSelection,
} from './persistence.js';
import { toast } from '../ui/toolbar.js';

/**
 * Wire keyboard shortcuts. Plain keys (Delete, F, Esc) are skipped when
 * focus is in an input/textarea. Ctrl+S/O fire globally (with preventDefault)
 * because they shouldn't conflict with text editing.
 */
export function initShortcuts({ graph, lcanvas }) {
  document.addEventListener('keydown', (e) => onKey(e, { graph, lcanvas }));
}

function onKey(e, { graph, lcanvas }) {
  const target = e.target;
  const inField = target && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );

  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  // Ctrl shortcuts work even when not focused on canvas
  if (mod) {
    if (key === 's') {
      e.preventDefault();
      try {
        const name = saveJsonFile();
        toast(`Saved ${name}`, 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }
    if (key === 'o') {
      e.preventDefault();
      loadJsonFile()
        .then((name) => { if (name) toast(`Loaded ${name}`, 'success'); })
        .catch((err) => toast(err.message, 'error'));
      return;
    }
    if (key === 'a' && !inField) {
      e.preventDefault();
      selectAll(lcanvas);
      return;
    }
    if (key === 'd' && !inField) {
      e.preventDefault();
      duplicateSelected(graph, lcanvas);
      return;
    }
    return;
  }

  if (inField) return;

  if (key === 'delete') {
    e.preventDefault();
    deleteSelected(graph, lcanvas);
    return;
  }
  if (key === 'f') {
    e.preventDefault();
    if (e.shiftKey) fitSelection();
    else frameAll();
    return;
  }
  if (key === 'escape') {
    e.preventDefault();
    if (lcanvas.deselectAllNodes) lcanvas.deselectAllNodes();
    return;
  }
}

function selectAll(lcanvas) {
  const nodes = lcanvas.graph?._nodes || [];
  if (lcanvas.selectNodes) lcanvas.selectNodes(nodes);
  else for (const n of nodes) lcanvas.selectNode(n, true);
  lcanvas.setDirty(true, true);
}

function deleteSelected(graph, lcanvas) {
  const nodes = Object.values(lcanvas.selected_nodes || {});
  if (nodes.length === 0) return;
  for (const n of nodes) graph.remove(n);
  if (lcanvas.deselectAllNodes) lcanvas.deselectAllNodes();
  lcanvas.setDirty(true, true);
}

function duplicateSelected(graph, lcanvas) {
  const nodes = Object.values(lcanvas.selected_nodes || {});
  if (nodes.length === 0) return;
  const copies = [];
  for (const orig of nodes) {
    const data = orig.serialize();
    data.id = -1;
    data.pos = [orig.pos[0] + 24, orig.pos[1] + 24];
    const copy = window.__editor.LiteGraph.createNode(orig.type);
    if (!copy) continue;
    copy.configure(data);
    graph.add(copy);
    copies.push(copy);
  }
  if (copies.length && lcanvas.selectNodes) {
    lcanvas.selectNodes(copies);
  }
  lcanvas.setDirty(true, true);
}
