const STORAGE_KEY = 'vibe:theme';
const THEME_EVENT = 'vibe:themechange';

export function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
  const theme = stored === 'light' || stored === 'dark' ? stored : preferred;
  applyTheme(theme);

  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', toggleTheme);
  }

  return theme;
}

export function getTheme() {
  return document.documentElement.dataset.theme || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme } }));
}

export function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(handler) {
  const wrapped = (e) => handler(e.detail.theme);
  window.addEventListener(THEME_EVENT, wrapped);
  return () => window.removeEventListener(THEME_EVENT, wrapped);
}
