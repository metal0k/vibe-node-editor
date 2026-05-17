import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js';

export function initEditor() {
  const canvas = document.getElementById('graph-canvas');
  if (!canvas) throw new Error('canvas#graph-canvas not found');

  const graph = new LGraph();
  const lcanvas = new LGraphCanvas(canvas, graph);

  resizeCanvasToParent(canvas);
  window.addEventListener('resize', () => resizeCanvasToParent(canvas));

  graph.start();

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
