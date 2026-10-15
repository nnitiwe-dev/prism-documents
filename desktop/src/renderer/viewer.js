// PDF viewer with lazy, RAM-bounded rendering: only pages near the viewport
// hold a canvas; pages scrolled far away are unloaded. Everything is torn down
// in destroy() so leaving the viewer frees the document and its canvases.

import { el, clear, icon, toast } from './ui.js';
import { loadDocument, baseName } from './pdfjs.js';
import { addRecent } from './store.js';

export function buildViewer(filePath, name) {
  const label = name || baseName(filePath);
  let scale = 1.1;
  let doc = null;
  let destroyed = false;
  let observer = null;
  let pageObjs = []; // { index, wrapper, page, renderTask, rendered }

  const nameEl = el('span', { class: 'name', text: label });
  const pageInfo = el('span', { class: 'zoom-label', text: '…' });
  const zoomLabel = el('span', { class: 'zoom-label', text: `${Math.round(scale * 100)}%` });
  const search = el('input', { type: 'search', placeholder: 'Find in document…' });
  const pagesEl = el('div', { class: 'viewer-pages' });

  const bar = el('div', { class: 'viewer-bar' }, [
    nameEl,
    search,
    iconBtn('ti-zoom-out', 'Zoom out', () => setScale(scale - 0.15)),
    zoomLabel,
    iconBtn('ti-zoom-in', 'Zoom in', () => setScale(scale + 0.15)),
    pageInfo,
  ]);
  const element = el('div', { class: 'viewer' }, [bar, pagesEl]);

  function iconBtn(ic, title, onClick) {
    return el('button', { class: 'icon-btn', title, 'aria-label': title, onClick }, [icon(ic)]);
  }

  async function renderPage(obj) {
    if (destroyed || obj.rendered || obj.renderTask) return;
    const viewport = obj.page.getViewport({ scale });
    const canvas = el('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    obj.wrapper.appendChild(canvas);
    obj.renderTask = obj.page.render({ canvasContext: canvas.getContext('2d'), viewport });
    try {
      await obj.renderTask.promise;
      obj.rendered = true;
    } catch {
      /* cancelled */
    } finally {
      obj.renderTask = null;
    }
  }

  function unloadPage(obj) {
    if (obj.renderTask) { try { obj.renderTask.cancel(); } catch { /* noop */ } obj.renderTask = null; }
    clear(obj.wrapper);
    obj.rendered = false;
  }

  function sizeWrapper(obj) {
    const viewport = obj.page.getViewport({ scale });
    obj.wrapper.style.width = `${Math.ceil(viewport.width)}px`;
    obj.wrapper.style.height = `${Math.ceil(viewport.height)}px`;
  }

  function setScale(next) {
    scale = Math.min(3, Math.max(0.4, Number(next.toFixed(2))));
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    for (const obj of pageObjs) { unloadPage(obj); sizeWrapper(obj); }
    // visible pages will re-render via the observer on the next tick
    observeAll();
  }

  function observeAll() {
    if (!observer) return;
    for (const obj of pageObjs) observer.observe(obj.wrapper);
  }

  async function find(query) {
    if (!query || !doc) return;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((i) => i.str).join(' ').toLowerCase();
      if (text.includes(query.toLowerCase())) {
        pageObjs[n - 1]?.wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast(`Found on page ${n}`, 'success');
        return;
      }
    }
    toast('No matches found', 'info');
  }
  search.addEventListener('keydown', (e) => { if (e.key === 'Enter') find(search.value.trim()); });

  (async () => {
    try {
      doc = await loadDocument(filePath);
      if (destroyed) { doc.destroy(); return; }
      pageInfo.textContent = `${doc.numPages} pages`;
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (destroyed) return;
        const wrapper = el('div', { class: 'page-wrap', dataset: { page: String(n) } });
        const obj = { index: n, wrapper, page, renderTask: null, rendered: false };
        sizeWrapper(obj);
        pageObjs.push(obj);
        pagesEl.appendChild(wrapper);
      }
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const obj = pageObjs.find((o) => o.wrapper === entry.target);
          if (!obj) continue;
          if (entry.isIntersecting) renderPage(obj);
          else unloadPage(obj);
        }
      }, { root: pagesEl, rootMargin: '500px 0px' });
      observeAll();
      addRecent(filePath, label);
    } catch (err) {
      clear(pagesEl);
      pagesEl.appendChild(el('div', { class: 'empty', text: err.message || 'Could not open this PDF.' }));
    }
  })();

  return {
    element,
    destroy: () => {
      destroyed = true;
      if (observer) { observer.disconnect(); observer = null; }
      for (const obj of pageObjs) { if (obj.renderTask) { try { obj.renderTask.cancel(); } catch { /* noop */ } } }
      pageObjs = [];
      if (doc) { try { doc.destroy(); } catch { /* noop */ } doc = null; }
    },
  };
}
