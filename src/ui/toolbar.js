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
      el.addEventListener('click', () => {
        // Stage 5/6/7 will replace these stubs with real handlers
        toast(`${btn.label}: not yet implemented`, 'info');
      });
      wrap.appendChild(el);
    }
    host.appendChild(wrap);
  }
}

/* ── Toast helper (exported for use by other modules) ───── */
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

/* ── Selected count updater ──────────────────────────────── */
export function updateSelectedCount(n) {
  const el = document.getElementById('selected-count');
  if (!el) return;
  el.innerHTML = `Selected nodes: <strong>${n}</strong>`;
}
