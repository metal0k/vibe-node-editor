import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js';
import { registerAllNodes, VIBE_NODE_TYPES } from './nodes/index.js';

export function initEditor() {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) throw new Error('canvas#graph-canvas not found');

  // Quieter LiteGraph defaults
  LiteGraph.debug = false;
  LiteGraph.allow_multi_output_for_events = false;
  LiteGraph.search_hide_on_mouse_leave = true;

  registerAllNodes();
  customizeContextMenu();

  const graph = new LGraph();
  const lcanvas = new LGraphCanvas(canvas, graph);

  // Reactive execution: run a step on any structural change or property change
  const baseRunStep = LGraph.prototype.runStep;
  graph.runStep = function () {
    try {
      baseRunStep.call(this, 1);
    } catch (err) {
      console.warn('[vibe] graph runStep error:', err);
    }
    lcanvas.setDirty(true, true);
  };

  hookReactivity(graph);

  resizeCanvasToParent(canvas);
  const onResize = () => resizeCanvasToParent(canvas);
  window.addEventListener('resize', onResize);

  window.__editor = { graph, lcanvas, LiteGraph };
  return { graph, lcanvas };
}

function resizeCanvasToParent(canvas) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function hookReactivity(graph) {
  if (graph.__vibeReactiveHooked) return;
  const originalAdded = graph.onNodeAdded;
  graph.onNodeAdded = function (node) {
    if (originalAdded) originalAdded.call(this, node);
    graph.runStep();
  };

  const originalRemoved = graph.onNodeRemoved;
  graph.onNodeRemoved = function (node) {
    if (originalRemoved) originalRemoved.call(this, node);
    graph.runStep();
  };

  const originalConnect = graph.onConnectionChange;
  graph.onConnectionChange = function (node) {
    if (originalConnect) originalConnect.call(this, node);
    graph.runStep();
  };
  graph.__vibeReactiveHooked = true;
}

/**
 * Replace LiteGraph's built-in node catalog in the canvas right-click menu
 * with only our 4 registered types, grouped under one "Add Node" submenu.
 */
function customizeContextMenu() {
  if (LGraphCanvas.prototype.__vibeMenuPatched) return;
  const originalGetCanvasMenu = LGraphCanvas.prototype.getCanvasMenuOptions;
  LGraphCanvas.prototype.getCanvasMenuOptions = function () {
    const options = originalGetCanvasMenu.call(this);

    // Remove LiteGraph's default Add Node entry (we replace it)
    for (let i = options.length - 1; i >= 0; i--) {
      const opt = options[i];
      if (!opt) continue;
      const name = (opt.content || '').toLowerCase();
      if (name === 'add node' || name === 'add group') {
        options.splice(i, 1);
      }
    }

    const submenu = VIBE_NODE_TYPES.map((entry) => ({
      content: entry.label,
      callback: (_value, _opts, e) => {
        const node = LiteGraph.createNode(entry.type);
        if (!node) return;
        if (entry.type === 'vibe/comment') {
          node.title = 'Comment';
        }
        const lcanvas = this;
        const pos = lcanvas.convertEventToCanvasOffset(e);
        node.pos = [pos[0] - node.size[0] / 2, pos[1] - 10];
        lcanvas.graph.add(node);
      },
    }));

    options.unshift({
      content: 'Add Node',
      has_submenu: true,
      callback: (_value, _opts, e, menu) => {
        new LiteGraph.ContextMenu(submenu, { event: e, parentMenu: menu });
      },
    });

    return options;
  };
  LGraphCanvas.prototype.__vibeMenuPatched = true;
}
