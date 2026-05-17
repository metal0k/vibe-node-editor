import { LiteGraph } from 'litegraph.js';

export function ValueNode() {
  this.addOutput('Value', 'number');
  this.properties = { value: 0 };
  this.size = [180, 56];

  this.addWidget('number', 'value', this.properties.value, (v) => {
    this.properties.value = Number(v) || 0;
    this.setDirtyCanvas(true, true);
    // Reactivity: trigger a single re-evaluation when graph exists and
    // we're not mid-configure (configuration restores widgets, no need to step)
    if (this.graph && !this.graph._is_subgraph && this.graph.runStep) {
      this.graph.runStep();
      this.graph.__vibeAutosave?.();
    }
  }, { precision: 3, step: 10 });
}

ValueNode.title = 'Value';
ValueNode.desc = 'Outputs a constant number';

ValueNode.prototype.onExecute = function () {
  this.setOutputData(0, Number(this.properties.value) || 0);
};

ValueNode.prototype.onPropertyChanged = function (name, value) {
  if (name === 'value') {
    if (this.widgets && this.widgets[0]) {
      this.widgets[0].value = value;
    }
    this.setDirtyCanvas(true, true);
    return true;
  }
};

export function registerValueNode() {
  LiteGraph.registerNodeType('vibe/value', ValueNode);
}
