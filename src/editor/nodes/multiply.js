import { LiteGraph } from 'litegraph.js';

export function MultiplyNode() {
  this.addInput('A', 'number');
  this.addInput('B', 'number');
  this.addOutput('Result', 'number');
  this.properties = {};
  this.size = [160, 64];
  this._lastResult = 0;
}

MultiplyNode.title = 'Multiply';
MultiplyNode.desc = 'Outputs A * B';

MultiplyNode.prototype.onExecute = function () {
  const a = Number(this.getInputData(0)) || 0;
  const b = Number(this.getInputData(1)) || 0;
  this._lastResult = a * b;
  this.setOutputData(0, this._lastResult);
};

MultiplyNode.prototype.onDrawForeground = function (ctx) {
  if (this.flags && this.flags.collapsed) return;
  const text = formatNumber(this._lastResult);
  ctx.save();
  ctx.font = '500 10px JetBrains Mono, monospace';
  ctx.fillStyle = 'rgba(250, 204, 21, 0.85)';
  ctx.textAlign = 'right';
  ctx.fillText(text, this.size[0] - 8, this.size[1] - 6);
  ctx.restore();
};

export function registerMultiplyNode() {
  LiteGraph.registerNodeType('vibe/multiply', MultiplyNode);
}

function formatNumber(n) {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, '');
}
