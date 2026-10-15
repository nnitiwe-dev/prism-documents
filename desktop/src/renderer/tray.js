// Reusable document tray: drag-and-drop add, first-page preview cards with
// metadata, drag-to-reorder, in-place preview, and remove/replace.

import { el, clear, icon, toast } from './ui.js';
import { renderThumbnail, formatBytes, baseName } from './pdfjs.js';
import { openPreviewModal } from './viewer.js';

export function createTray({ multi = true, onChange = () => {} } = {}) {
  let items = []; // { id, path, name, pages, size, encrypted, thumbUrl, status }
  let seq = 0;
  let destroyed = false;
  let dragId = null;

  const grid = el('div', { class: 'tray-grid' });
  const hint = el('div', { class: 'dz-hint' }, [
    icon('ti-plus'),
    el('div', {}, [
      el('strong', { text: multi ? 'Drop PDFs here' : 'Drop a PDF here' }),
      el('span', { text: multi ? 'or click to choose two or more files' : 'or click to choose a file' }),
    ]),
  ]);
  const dropzone = el('div', { class: 'dropzone', role: 'button', tabindex: '0' }, [hint]);
  const root = el('div', { class: 'tray' }, [dropzone, grid]);

  const emit = () => onChange(items.slice());

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
      const t = await renderThumbnail(item.path, 220).catch(() => null);
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
    if (from < 0) return;
    const [moved] = items.splice(from, 1);
    const to = items.findIndex((it) => it.id === toId);
    items.splice(to < 0 ? items.length : to + (from < to ? 1 : 0), 0, moved);
    render();
    emit();
  }

  function metaLine(item) {
    if (item.status === 'error') return 'Could not read file';
    const bits = [];
    if (item.pages != null) bits.push(`${item.pages} page${item.pages === 1 ? '' : 's'}`);
    if (item.size != null) bits.push(formatBytes(item.size));
    if (item.encrypted) bits.push('encrypted');
    return bits.join(' · ') || 'Reading…';
  }

  function renderCard(item, idx) {
    const thumb = item.thumbUrl
      ? el('img', { class: 'tdoc-img', src: item.thumbUrl, alt: '' })
      : el('div', { class: `tdoc-img placeholder${item.status === 'loading' ? ' loading' : ''}` }, [icon('ti-file-text')]);

    const actions = el('div', { class: 'tdoc-actions' }, [
      el('button', { class: 'round-btn', title: 'Preview', 'aria-label': 'Preview', onClick: (e) => { e.stopPropagation(); openPreviewModal(item.path, item.name); } }, [icon('ti-search')]),
      el('button', { class: 'round-btn', title: 'Remove', 'aria-label': 'Remove', onClick: (e) => { e.stopPropagation(); remove(item.id); } }, [icon('ti-x')]),
    ]);

    const thumbBox = el('div', { class: 'tdoc-thumb' }, [
      thumb,
      multi ? el('span', { class: 'tdoc-badge', text: String(idx + 1) }) : null,
      actions,
    ]);

    const card = el('div', {
      class: 'tdoc',
      draggable: multi ? 'true' : null,
      title: item.path,
      dataset: { id: String(item.id) },
    }, [
      thumbBox,
      el('div', { class: 'tdoc-name', text: item.name }),
      el('div', { class: `tdoc-sub${item.encrypted ? ' warn' : ''}`, text: metaLine(item) }),
    ]);

    if (multi) {
      card.addEventListener('dragstart', (e) => { dragId = item.id; e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => { dragId = null; card.classList.remove('dragging'); render(); });
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.classList.add('drop-target'); });
      card.addEventListener('dragleave', () => card.classList.remove('drop-target'));
      card.addEventListener('drop', (e) => { e.preventDefault(); card.classList.remove('drop-target'); if (dragId != null) reorder(dragId, item.id); });
    }
    return card;
  }

  function render() {
    clear(grid);
    items.forEach((item, idx) => grid.appendChild(renderCard(item, idx)));
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
    destroy: () => { destroyed = true; items = []; },
  };
}
