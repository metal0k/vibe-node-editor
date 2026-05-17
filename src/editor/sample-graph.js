import { LiteGraph } from 'litegraph.js';

/**
 * Builds the demo graph from UI_Protoype.jpg:
 *   Value A (3) ─┐
 *                ├─► Multiply ──► Default ──► Multiply (Custom)
 *   Value B (4) ─┘                            (second input empty)
 *   + a "Math Block" comment annotation
 */
export function buildSampleGraph(graph) {
  graph.clear();

  const valueA = LiteGraph.createNode('vibe/value');
  valueA.title = 'Value A';
  valueA.pos = [120, 200];
  valueA.properties.value = 3;
  if (valueA.widgets?.[0]) valueA.widgets[0].value = 3;
  graph.add(valueA);

  const valueB = LiteGraph.createNode('vibe/value');
  valueB.title = 'Value B';
  valueB.pos = [120, 440];
  valueB.properties.value = 4;
  if (valueB.widgets?.[0]) valueB.widgets[0].value = 4;
  graph.add(valueB);

  const multiply = LiteGraph.createNode('vibe/multiply');
  multiply.title = 'Multiply';
  multiply.pos = [400, 300];
  graph.add(multiply);

  const def = LiteGraph.createNode('vibe/default');
  def.title = 'Default Node';
  def.pos = [640, 180];
  graph.add(def);

  const multCustom = LiteGraph.createNode('vibe/multiply');
  multCustom.title = 'Multiply (Custom)';
  multCustom.pos = [880, 340];
  graph.add(multCustom);

  const comment = LiteGraph.createNode('vibe/comment');
  comment.pos = [400, 480];
  comment.size = [260, 140];
  comment.properties.title = 'Math Block';
  comment.properties.comment = 'Multiply A * B here.';
  graph.add(comment);

  valueA.connect(0, multiply, 0);
  valueB.connect(0, multiply, 1);
  multiply.connect(0, def, 0);
  def.connect(0, multCustom, 0);

  graph.runStep();
}
