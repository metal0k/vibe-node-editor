import {
  saveJsonFile,
  loadJsonFile,
  frameAll,
  fitSelection,
  copyShareUrl,
} from '../editor/persistence.js';

const BUTTON_GROUPS = [
  [
    { id: 'save-json', label: 'Save', title: 'Save JSON  (Ctrl+S)' },
    { id: 'load-json', label: 'Load', title: 'Load JSON  (Ctrl+O)' },
  ],
  [
    { id: 'fit-selection', label: 'Fit',   title: 'Fit Selection  (Shift+F)' },
    { id: 'frame-all',    label: 'Frame', title: 'Frame All  (F)' },
  ],
  [
    { id: 'validate', label: 'Validate', title: 'Validate graph', variant: 'primary' },
    { id: 'share',    label: 'Share',    title: 'Copy share URL' },
  ],
];

let validateHandler = null;

export function setValidateHandler(fn) {
  validateHandler = fn;
}

export function initToolbar() {
  const host = document.getElementById('topbar-actions');
  if (!host) return;
  host.innerHTML = '';

  for (const group of BUTTON_GROUPS) {
    const wrap = document.createElement('div');
    wrap.className = 'topbar__group';
    for (const btn of group) {
      const el = document.createElement('button');
      el.className = 'btn' + (btn.variant === 'primary' ? ' btn--primary' : '');
      el.id = `btn-${btn.id}`;
      el.title = btn.title;
      el.textContent = btn.label;
      el.addEventListener('click', () => handleAction(btn.id));
      wrap.appendChild(el);
    }
    host.appendChild(wrap);
  }
}

async function handleAction(id) {
  try {
    switch (id) {
      case 'save-json': {
        const filename = saveJsonFile();
        toast(`Saved ${filename}`, 'success');
        break;
      }
      case 'load-json': {
        const filename = await loadJsonFile();
        if (filename) toast(`Loaded ${filename}`, 'success');
        break;
      }
      case 'fit-selection':
        fitSelection();
        break;
      case 'frame-all':
        frameAll();
        break;
      case 'share': {
        const url = await copyShareUrl();
        toast('Share URL copied to clipboard', 'success');
        console.info('[vibe] share URL:', url);
        break;
      }
      case 'validate':
        if (validateHandler) validateHandler();
        else toast('Validator not ready', 'warn');
        break;
      default:
        toast(`Unknown action: ${id}`, 'warn');
    }
  } catch (err) {
    console.error(err);
    toast(err.message || String(err), 'error', 4000);
  }
}

/* ── Toast helper ───────────────────────────────────────── */
let toastHost = null;
export function toast(message, kind = 'info', ttl = 2400) {
  if (!toastHost) toastHost = document.getElementById('toast-host');
  if (!toastHost) return;
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.textContent = message;
  toastHost.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, ttl);
}

/* ── Selected count updater ─────────────────────────────── */
export function updateSelectedCount(n) {
  const el = document.getElementById('selected-count');
  if (!el) return;
  el.innerHTML = `Selected nodes: <strong>${n}</strong>`;
}
