import 'litegraph.js/css/litegraph.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/inspector.css';

import { initTheme } from './ui/theme.js';
import { initToolbar, setValidateHandler } from './ui/toolbar.js';
import { initInspector } from './ui/inspector.js';
import { initEditor } from './editor/setup.js';
import { applyNodeTheme } from './editor/node-theme.js';
import { initPersistence } from './editor/persistence.js';
import { initValidator } from './editor/validator.js';
import { initShortcuts } from './editor/shortcuts.js';
import { buildSampleGraph } from './editor/sample-graph.js';

initTheme();
initToolbar();

const { graph, lcanvas } = initEditor();
applyNodeTheme(lcanvas);
initInspector({ graph, lcanvas });

const validate = initValidator({ graph, lcanvas });
setValidateHandler(validate);

initShortcuts({ graph, lcanvas });

const source = initPersistence({ graph, lcanvas });
if (source === 'sample') {
  buildSampleGraph(graph);
}
