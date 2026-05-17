import { LiteGraph } from 'litegraph.js';
import { registerValueNode } from './value.js';
import { registerMultiplyNode } from './multiply.js';
import { registerDefaultNode } from './default.js';
import { registerCommentNode } from './comment.js';

export const VIBE_NODE_TYPES = [
  { type: 'vibe/value',    label: 'Value' },
  { type: 'vibe/multiply', label: 'Multiply' },
  { type: 'vibe/default',  label: 'Default Node' },
  { type: 'vibe/comment',  label: 'Comment' },
];

let registered = false;

export function registerAllNodes() {
  if (registered) return;
  // Remove LiteGraph's default node types so context menu only shows ours
  LiteGraph.clearRegisteredTypes?.();
  registerValueNode();
  registerMultiplyNode();
  registerDefaultNode();
  registerCommentNode();
  registered = true;
}
