import { updateSelectedCount } from './toolbar.js';

const TYPE_LABEL = {
  'vibe/value':    'Value',
  'vibe/multiply': 'Multiply',
  'vibe/default':  'Default Node',
  'vibe/comment':  'Comment',
};

let editorRefs = null;
let bodyEl = null;
let currentNodeIds = [];
let suppressFromCanvas = false;

export function initInspector({ graph, lcanvas }) {
  editorRefs = { graph, lcanvas };
  bodyEl = document.getElementById('inspector-body');

  // Subscribe to LiteGraph selection events
  const prevSelected = graph.onNodeSelected;
  graph.onNodeSelected = function (node) {
    if (prevSelected) prevSelected.call(this, node);
    syncFromCanvas();
  };
  const prevDeselected = graph.onNodeDeselected;
  graph.onNodeDeselected = function (node) {
    if (prevDeselected) prevDeselected.call(this, node);
    syncFromCanvas();
  };

  // LGraphCanvas tracks selection in selected_nodes — but events above
  // sometimes don't fire on multi-select box. Patch selectNode + deselectAllNodes.
  patchCanvasSelection(lcanvas);

  // Render on transform/property changes (drag, resize)
  hookPropertyMirror(graph);

  renderEmpty();
  updateSelectedCount(0);
}

function patchCanvasSelection(lcanvas) {
  const origSelect = lcanvas.selectNode;
  lcanvas.selectNode = function (node, additive) {
    origSelect.call(this, node, additive);
    syncFromCanvas();
  };
  const origSelectNodes = lcanvas.selectNodes;
  if (origSelectNodes) {
    lcanvas.selectNodes = function (nodes, additive) {
      origSelectNodes.call(this, nodes, additive);
      syncFromCanvas();
    };
  }
  const origDeselect = lcanvas.deselectAllNodes;
  lcanvas.deselectAllNodes = function () {
    origDeselect.call(this);
    syncFromCanvas();
  };
  const origDeselectOne = lcanvas.deselectNode;
  if (origDeselectOne) {
    lcanvas.deselectNode = function (node) {
      origDeselectOne.call(this, node);
      syncFromCanvas();
    };
  }
}

function hookPropertyMirror(graph) {
  // Re-mirror inspector inputs when a selected node moves/resizes
  if (graph.__vibeMirrorHooked) return;
  graph.__vibeMirrorHooked = true;

  const trigger = () => {
    if (!editorRefs || currentNodeIds.length === 0) return;
    const selectedNow = getSelectedNodes(editorRefs.lcanvas);
    if (selectedNow.length === 1) mirrorSingleNodeFields(selectedNow[0]);
    updateSelectedCount(selectedNow.length);
  };

  // LiteGraph fires these on drag / resize commit; supplement with rAF poll
  // only while pointer is down (handled via canvas mousedown/mouseup below).
  const origNodeMoved = graph.onNodeMoved;
  graph.onNodeMoved = function (node) {
    if (origNodeMoved) origNodeMoved.call(this, node);
    trigger();
  };

  const lcanvas = editorRefs.lcanvas;
  const canvas = lcanvas.canvas;
  if (canvas) {
    let rafId = null;
    const tick = () => { trigger(); rafId = requestAnimationFrame(tick); };
    canvas.addEventListener('mousedown', () => {
      if (rafId == null) rafId = requestAnimationFrame(tick);
    });
    canvas.addEventListener('mouseup', () => {
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
      trigger();
    });
    canvas.addEventListener('mouseleave', () => {
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    });
  }
}

function getSelectedNodes(lcanvas) {
  if (!lcanvas?.selected_nodes) return [];
  return Object.values(lcanvas.selected_nodes);
}

function syncFromCanvas() {
  if (!editorRefs) return;
  if (suppressFromCanvas) return;
  const nodes = getSelectedNodes(editorRefs.lcanvas);
  currentNodeIds = nodes.map((n) => n.id);
  updateSelectedCount(nodes.length);
  if (nodes.length === 0) {
    renderEmpty();
  } else if (nodes.length === 1) {
    renderSingleNode(nodes[0]);
  } else {
    renderMultiSelection(nodes);
  }
}

/* ── Renderers ──────────────────────────────────────────── */

function renderEmpty() {
  bodyEl.innerHTML = '';
  const p = document.createElement('p');
  p.className = 'inspector__empty';
  p.textContent = 'No selection';
  bodyEl.appendChild(p);
}

function renderSingleNode(node) {
  bodyEl.innerHTML = '';
  const typeLabel = TYPE_LABEL[node.type] || node.type || 'Node';
  bodyEl.appendChild(badge(`Type: ${typeLabel}`));

  // Identity section
  const idSection = section('Identity');
  idSection.appendChild(field({
    label: 'Name',
    type: 'text',
    value: node.title || '',
    onInput: (v) => updateNode(node, () => { node.title = v; }),
  }));
  bodyEl.appendChild(idSection);

  // Transform section
  const tSection = section('Transform');
  tSection.appendChild(rowFields([
    { label: 'X', type: 'number', value: roundPos(node.pos[0]), onInput: (v) => updateNode(node, () => { node.pos[0] = parseFloat(v) || 0; }) },
    { label: 'Y', type: 'number', value: roundPos(node.pos[1]), onInput: (v) => updateNode(node, () => { node.pos[1] = parseFloat(v) || 0; }) },
  ]));
  tSection.appendChild(rowFields([
    { label: 'Width',  type: 'number', value: Math.round(node.size[0]), onInput: (v) => updateNode(node, () => { node.size[0] = Math.max(40, parseFloat(v) || 0); }) },
    { label: 'Height', type: 'number', value: Math.round(node.size[1]), onInput: (v) => updateNode(node, () => { node.size[1] = Math.max(28, parseFloat(v) || 0); }) },
  ]));
  bodyEl.appendChild(tSection);

  // Type-specific section
  const dataSection = sectionForType(node);
  if (dataSection) bodyEl.appendChild(dataSection);
}

function sectionForType(node) {
  if (node.type === 'vibe/value') {
    const s = section('Value');
    s.appendChild(field({
      label: 'Number',
      type: 'number',
      value: node.properties.value ?? 0,
      onInput: (v) => updateNode(node, () => {
        const n = Number(v) || 0;
        node.properties.value = n;
        if (node.widgets?.[0]) node.widgets[0].value = n;
      }, true),
    }));
    return s;
  }
  if (node.type === 'vibe/comment') {
    const s = section('Annotation');
    s.appendChild(field({
      label: 'Title',
      type: 'text',
      value: node.properties.title || '',
      onInput: (v) => updateNode(node, () => { node.properties.title = v; }),
    }));
    s.appendChild(field({
      label: 'Comment',
      type: 'textarea',
      value: node.properties.comment || '',
      onInput: (v) => updateNode(node, () => { node.properties.comment = v; }),
    }));
    return s;
  }
  return null;
}

function renderMultiSelection(nodes) {
  bodyEl.innerHTML = '';
  bodyEl.appendChild(badge(`${nodes.length} nodes selected`));

  const s = section('Batch Transform');
  s.appendChild(rowFields([
    {
      label: 'Width',
      type: 'number',
      value: '',
      placeholder: 'mixed',
      onInput: (v) => batchUpdate(nodes, (n) => { n.size[0] = Math.max(40, parseFloat(v) || n.size[0]); }),
    },
    {
      label: 'Height',
      type: 'number',
      value: '',
      placeholder: 'mixed',
      onInput: (v) => batchUpdate(nodes, (n) => { n.size[1] = Math.max(28, parseFloat(v) || n.size[1]); }),
    },
  ]));
  bodyEl.appendChild(s);

  const hint = document.createElement('p');
  hint.className = 'inspector__hint';
  hint.textContent = 'Select a single node to edit name, position and type-specific fields.';
  bodyEl.appendChild(hint);
}

/* ── Inspector → Canvas update ──────────────────────────── */

function updateNode(node, mutator, runStep = false) {
  suppressFromCanvas = true;
  try {
    mutator();
    node.setDirtyCanvas?.(true, true);
    if (runStep && editorRefs?.graph?.runStep) editorRefs.graph.runStep();
    editorRefs.lcanvas?.setDirty(true, true);
    editorRefs?.graph?.__vibeAutosave?.();
  } finally {
    suppressFromCanvas = false;
  }
}

function batchUpdate(nodes, mutator) {
  suppressFromCanvas = true;
  try {
    for (const n of nodes) mutator(n);
    editorRefs.lcanvas?.setDirty(true, true);
  } finally {
    suppressFromCanvas = false;
  }
}

/* ── Mirror canvas → inspector inputs (drag, resize) ────── */

function mirrorSingleNodeFields(node) {
  if (!bodyEl) return;
  const inputs = bodyEl.querySelectorAll('input[data-mirror]');
  inputs.forEach((inp) => {
    if (document.activeElement === inp) return;  // don't fight user typing
    const key = inp.dataset.mirror;
    const newValue = mirrorValue(node, key);
    if (newValue == null) return;
    if (String(inp.value) !== String(newValue)) inp.value = newValue;
  });
}

function mirrorValue(node, key) {
  switch (key) {
    case 'pos.x':    return roundPos(node.pos[0]);
    case 'pos.y':    return roundPos(node.pos[1]);
    case 'size.w':   return Math.round(node.size[0]);
    case 'size.h':   return Math.round(node.size[1]);
    case 'title':    return node.title || '';
    case 'value':    return node.properties.value ?? 0;
    case 'c.title':  return node.properties.title || '';
    case 'c.body':   return node.properties.comment || '';
    default:         return null;
  }
}

/* ── Tiny DOM helpers ───────────────────────────────────── */

function section(title) {
  const s = document.createElement('section');
  s.className = 'inspector__section';
  const h = document.createElement('h3');
  h.className = 'inspector__section-title';
  h.textContent = title;
  s.appendChild(h);
  return s;
}

function badge(text) {
  const b = document.createElement('div');
  b.className = 'inspector__type';
  b.textContent = text;
  return b;
}

function field({ label, type, value, onInput, placeholder }) {
  const wrap = document.createElement('div');
  wrap.className = 'inspector__field';
  const l = document.createElement('label');
  l.textContent = label;
  wrap.appendChild(l);

  let input;
  if (type === 'textarea') {
    input = document.createElement('textarea');
    input.value = value ?? '';
    input.dataset.mirror = inferMirrorKey(label);
  } else {
    input = document.createElement('input');
    input.type = type;
    input.value = value ?? '';
    if (placeholder) input.placeholder = placeholder;
    input.dataset.mirror = inferMirrorKey(label);
  }
  input.addEventListener('input', () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
}

function rowFields(fields) {
  const wrap = document.createElement('div');
  wrap.className = 'inspector__field--row';
  for (const f of fields) wrap.appendChild(field(f));
  return wrap;
}

function inferMirrorKey(label) {
  const l = String(label).toLowerCase();
  if (l === 'x') return 'pos.x';
  if (l === 'y') return 'pos.y';
  if (l === 'width')  return 'size.w';
  if (l === 'height') return 'size.h';
  if (l === 'name')    return 'title';
  if (l === 'number')  return 'value';
  if (l === 'title')   return 'c.title';
  if (l === 'comment') return 'c.body';
  return '';
}

function roundPos(n) {
  return Math.round(n);
}
