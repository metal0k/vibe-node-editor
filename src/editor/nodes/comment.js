import { LiteGraph } from 'litegraph.js';

export function CommentNode() {
  this.properties = {
    title: 'Math Block',
    comment: 'Multiply A * B here.',
  };
  this.size = [240, 140];
  this.resizable = true;
  this.flags = this.flags || {};
  this.flags.no_inputs = true;
  this.flags.no_outputs = true;
}

CommentNode.title = 'Comment';
CommentNode.desc = 'Annotate region with text';

/* No execution — comments are inert */
CommentNode.prototype.onExecute = function () {};

CommentNode.prototype.onDrawBackground = function (ctx) {
  if (this.flags && this.flags.collapsed) return;
  ctx.save();
  ctx.fillStyle = 'rgba(250, 204, 21, 0.04)';
  ctx.fillRect(0, 0, this.size[0], this.size[1]);
  ctx.restore();
};

CommentNode.prototype.onDrawForeground = function (ctx) {
  if (this.flags && this.flags.collapsed) return;
  const padding = 12;
  const titleColor = readToken('--canvas-comment-title');
  const bodyColor = readToken('--canvas-comment-body');
  ctx.save();

  // Title bar
  ctx.font = '600 11px JetBrains Mono, monospace';
  ctx.fillStyle = titleColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText((this.properties.title || '').toUpperCase(), padding, padding);

  // Divider — derive from title color at low alpha via stroke trick
  ctx.strokeStyle = titleColor;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding + 18);
  ctx.lineTo(this.size[0] - padding, padding + 18);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Body text (multiline, wrap)
  ctx.font = '400 12px "IBM Plex Sans", system-ui, sans-serif';
  ctx.fillStyle = bodyColor;
  wrapText(
    ctx,
    this.properties.comment || '',
    padding,
    padding + 30,
    this.size[0] - padding * 2,
    16,
  );

  ctx.restore();
};

function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = String(text).split(/\r?\n/);
  let cursorY = y;
  for (const rawLine of lines) {
    const words = rawLine.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      const metrics = ctx.measureText(test);
      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = words[i];
        cursorY += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    }
  }
}

export function registerCommentNode() {
  LiteGraph.registerNodeType('vibe/comment', CommentNode);
}
