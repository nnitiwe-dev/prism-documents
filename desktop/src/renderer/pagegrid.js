// Visual page selector: a thumbnail grid of every page. Click a page to toggle
// it (e.g. mark for removal). Thumbnails render lazily via IntersectionObserver
// and the document is destroyed on teardown to bound RAM.

import { el, clear, icon } from './ui.js';
import { loadDocument } from './pdfjs.js';

export function createPageGrid({ onChange = () => {}, thumbWidth = 150 } = {}) {
  let doc = null;
  let destroyed = false;
  let observer = null;
  let cells = []; // { n, el, thumb, page, rendered }
  let selected = new Set();
  let loadedPath = null;

  const grid = el('div', { class: 'pagegrid' });
  const root = el('div', { class: 'pagegrid-wrap' }, [grid]);

  function teardown() {
    if (observer) { observer.disconnect(); observer = null; }
    cells = [];
    if (doc) { try { doc.destroy(); } catch { /* noop */ } doc = null; }
  }

  async function load(filePath) {
    if (filePath === loadedPath) return;
    loadedPath = filePath;
    teardown();
    selected = new Set();
    clear(grid);
    grid.appendChild(el('div', { class: 'empty', text: 'Rendering pages…' }));
    try {
      doc = await loadDocument(filePath);
      if (destroyed) { doc.destroy(); return; }
      clear(grid);
      for (let n = 1; n <= doc.numPages; n++) {
        const c = buildCell(n);
        cells.push(c);
        grid.appendChild(c.el);
      }
      observer = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const c = cells.find((x) => x.el === e.target);
          if (c) renderCell(c);
        }
      }, { root, rootMargin: '400px 0px' });
      for (const c of cells) observer.observe(c.el);
      emit();
    } catch {
      clear(grid);
      grid.appendChild(el('div', { class: 'empty', text: 'Could not render pages.' }));
    }
  }

  function buildCell(n) {
    const thumb = el('div', { class: 'pg-thumb' });
    const cellEl = el('div', {
      class: 'pg-cell',
      dataset: { page: String(n) },
      title: `Page ${n} — click to toggle`,
      onClick: () => toggle(n),
    }, [thumb, el('span', { class: 'pg-mark' }, [icon('ti-x')]), el('span', { class: 'pg-num', text: String(n) })]);
    return { n, el: cellEl, thumb, page: null, rendered: false };
  }

  async function renderCell(c) {
    if (destroyed || c.rendered || !doc) return;
    c.rendered = true;
    try {
      c.page = c.page || (await doc.getPage(c.n));
      if (destroyed) return;
      const base = c.page.getViewport({ scale: 1 });
      const vp = c.page.getViewport({ scale: thumbWidth / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      await c.page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      if (destroyed) return;
      clear(c.thumb);
      c.thumb.appendChild(canvas);
    } catch {
      c.rendered = false;
    }
  }

  function toggle(n) {
    if (selected.has(n)) selected.delete(n);
    else selected.add(n);
    sync();
    emit();
  }

  function sync() {
    for (const c of cells) c.el.classList.toggle('removing', selected.has(c.n));
  }

  function setSelected(arr) {
    selected = new Set((arr || []).filter((x) => x >= 1 && x <= cells.length));
    sync();
    emit();
  }

  function emit() {
    onChange({ selected: getSelected(), total: cells.length });
  }

  const getSelected = () => [...selected].sort((a, b) => a - b);

  return {
    element: root,
    load,
    getSelected,
    getTotal: () => cells.length,
    setSelected,
    clearSelection: () => setSelected([]),
    reset: () => { loadedPath = null; teardown(); clear(grid); selected = new Set(); },
    destroy: () => { destroyed = true; teardown(); },
  };
}
