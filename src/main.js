import 'litegraph.js/css/litegraph.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/inspector.css';

import { initTheme } from './ui/theme.js';
import { initToolbar } from './ui/toolbar.js';
import { initEditor } from './editor/setup.js';
import { applyNodeTheme } from './editor/node-theme.js';

initTheme();
initToolbar();

const { lcanvas } = initEditor();
applyNodeTheme(lcanvas);
