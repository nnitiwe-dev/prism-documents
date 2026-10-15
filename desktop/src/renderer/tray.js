// Reusable document tray: drag-and-drop add, thumbnails + metadata,
// drag-to-reorder, remove. Used by every tool workspace.

import { el, clear, icon, toast } from './ui.js';
import { renderThumbnail, formatBytes, baseName } from './pdfjs.js';

export function createTray({ multi = true, onChange = () => {} } = {}) {
  let items = []; // { id, path, name, pages, size, encrypted, thumbUrl, status }
  let seq = 0;
  let destroyed = false;
  let dragId = null;

  const listEl = el('div', { class: 'tray-list' });
  const hint = el('div', { class: 'dz-hint' }, [
    icon('ti-plus'),
    el('div', {}, [
      el('strong', { text: multi ? 'Drop PDFs here' : 'Drop a PDF here' }),
      el('span', { text: multi ? 'or click to choose two or more files' : 'or click to choose a file' }),
    ]),
  ]);
  const dropzone = el('div', { class: 'dropzone', role: 'button', tabindex: '0' }, [hint]);
  const root = el('div', { class: 'tray' }, [dropzone, listEl]);

  function emit() {
    onChange(items.slice());
  }

  async function addPaths(paths) {
    for (const p of paths) {
      if (!p || !p.toLowerCase().endsWith('.pdf')) {
        if (p) toast(`Skipped (not a PDF): ${baseName(p)}`, 'error');
        continue;
      }
      if (!multi) items = [];
      else if (items.some((it) => it.path === p)) continue;
      const item = { id: ++seq, path: p, name: baseName(p), pages: null, size: null, encrypted: false, thumbUrl: null, status: 'loading' };
      items.push(item);
      render();
      loadMeta(item);
    }
    emit();
  }

  async function loadMeta(item) {
    try {
      const r = await window.prism.api('/pdf/info', { method: 'POST', body: { path: item.path } });
      if (destroyed) return;
      if (r.ok) {
        item.pages = r.data.pages;
        item.size = r.data.size_bytes;
        item.encrypted = r.data.encrypted;
      }
      const t = await renderThumbnail(item.path).catch(() => null);
      if (destroyed) return;
      if (t) item.thumbUrl = t.url;
      item.status = 'ready';
    } catch {
      item.status = 'error';
    }
    render();
  }

  function remove(id) {
    items = items.filter((it) => it.id !== id);
    render();
    emit();
  }

  function reorder(fromId, toId) {
    if (fromId === toId) return;
    const from = items.findIndex((it) => it.id === fromId);
    let to = items.findIndex((it) => it.id === toId);
    if (from < 0 || to < 0) return;
    const [moved] = items.splice(from, 1);
    to = items.findIndex((it) => it.id === toId);
    items.splice(to + (from < to ? 1 : 0), 0, moved);
    render();
    emit();
  }

  function renderItem(item, idx) {
    const thumb = item.thumbUrl
      ? el('img', { class: 'tray-thumb', src: item.thumbUrl, alt: '' })
      : el('div', { class: `tray-thumb placeholder${item.status === 'loading' ? ' loading' : ''}` }, [icon('ti-file-text')]);

    const metaBits = [];
    if (item.pages != null) metaBits.push(`${item.pages} page${item.pages === 1 ? '' : 's'}`);
    if (item.size != null) metaBits.push(formatBytes(item.size));
    if (item.encrypted) metaBits.push('encrypted');
    const metaText = item.status === 'error' ? 'Could not read file' : metaBits.join(' · ') || 'Reading…';

    const node = el('div', {
      class: 'tray-item',
      draggable: multi ? 'true' : null,
      dataset: { id: String(item.id) },
    }, [
      multi ? el('span', { class: 'drag-handle', title: 'Drag to reorder' }, [icon('ti-arrows-sort')]) : null,
      multi ? el('span', { class: 'tray-index', text: String(idx + 1) }) : null,
      thumb,
      el('div', { class: 'tray-meta' }, [
        el('div', { class: 'tray-name', title: item.path, text: item.name }),
        el('div', { class: `tray-sub${item.encrypted ? ' warn' : ''}`, text: metaText }),
      ]),
      multi ? el('button', { class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', onClick: () => move(item.id, -1) }, [icon('ti-chevron-left')]) : null,
      multi ? el('button', { class: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', onClick: () => move(item.id, 1) }, [icon('ti-chevron-right')]) : null,
      el('button', { class: 'icon-btn danger', title: 'Remove', 'aria-label': 'Remove', onClick: () => remove(item.id) }, [icon('ti-x')]),
    ]);

    if (multi) {
      node.addEventListener('dragstart', (e) => { dragId = item.id; e.dataTransfer.effectAllowed = 'move'; node.classList.add('dragging'); });
      node.addEventListener('dragend', () => { dragId = null; node.classList.remove('dragging'); render(); });
      node.addEventListener('dragover', (e) => { e.preventDefault(); node.classList.add('drop-target'); });
      node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
      node.addEventListener('drop', (e) => { e.preventDefault(); node.classList.remove('drop-target'); if (dragId != null) reorder(dragId, item.id); });
    }
    return node;
  }

  function move(id, dir) {
    const i = items.findIndex((it) => it.id === id);
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    render();
    emit();
  }

  function render() {
    clear(listEl);
    items.forEach((item, idx) => listEl.appendChild(renderItem(item, idx)));
    dropzone.classList.toggle('compact', items.length > 0);
    hint.querySelector('strong').textContent = items.length
      ? (multi ? 'Add more PDFs' : 'Replace PDF')
      : (multi ? 'Drop PDFs here' : 'Drop a PDF here');
  }

  async function pickAndAdd() {
    const props = multi ? ['openFile', 'multiSelections'] : ['openFile'];
    const r = await window.prism.openDialog({ properties: props, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (!r.canceled) addPaths(r.filePaths);
  }

  dropzone.addEventListener('click', pickAndAdd);
  dropzone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickAndAdd(); } });
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('over'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('over');
    const paths = Array.from(e.dataTransfer.files || []).map((f) => window.prism.pathForFile(f)).filter(Boolean);
    if (paths.length) addPaths(paths);
  });

  render();

  return {
    element: root,
    getItems: () => items.slice(),
    addPaths,
    destroy: () => {
      destroyed = true;
      items = [];
    },
  };
}
