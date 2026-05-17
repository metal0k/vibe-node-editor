import { LiteGraph } from 'litegraph.js';

export function DefaultNode() {
  this.addInput('In', 0);   // 0 = any type in LiteGraph
  this.addOutput('Out', 0);
  this.properties = {};
  this.size = [140, 48];
  this._lastValue = null;
}

DefaultNode.title = 'Default Node';
DefaultNode.desc = 'Pass-through any value';

DefaultNode.prototype.onExecute = function () {
  const v = this.getInputData(0);
  this._lastValue = v ?? null;
  this.setOutputData(0, v);
};

DefaultNode.prototype.onDrawForeground = function (ctx) {
  if (this.flags && this.flags.collapsed) return;
  if (this._lastValue == null) return;
  const text = typeof this._lastValue === 'number'
    ? formatNumber(this._lastValue)
    : String(this._lastValue).slice(0, 12);
  ctx.save();
  ctx.font = '500 10px JetBrains Mono, monospace';
  ctx.fillStyle = readToken('--canvas-badge-text');
  ctx.textAlign = 'right';
  ctx.fillText(text, this.size[0] - 8, this.size[1] - 6);
  ctx.restore();
};

function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function registerDefaultNode() {
  LiteGraph.registerNodeType('vibe/default', DefaultNode);
}

function formatNumber(n) {
  if (!isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, '');
}
