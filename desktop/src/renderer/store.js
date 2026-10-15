// Per-viewer persistence for recent documents (localStorage, best-effort).

const KEY = 'prism.recent';
const MAX = 24;

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

export function addRecent(path, name) {
  try {
    const list = getRecent().filter((r) => r.path !== path);
    list.unshift({ path, name: name || path.split(/[\\/]/).pop(), opened: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore storage errors (private mode, cleared data)
  }
  window.dispatchEvent(new CustomEvent('prism:recent-changed'));
}
