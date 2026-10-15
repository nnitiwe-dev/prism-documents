// PDF viewer with a navigation pane (document outline / page list) and lazy,
// RAM-bounded page rendering. Everything is torn down in destroy().

import { el, clear, icon, toast } from './ui.js';
import { loadDocument, getPdfjs, baseName } from './pdfjs.js';
import { addRecent } from './store.js';

// Open a document in a modal overlay (used by the tray's preview button) so the
// current tool page stays mounted underneath.
export function openPreviewModal(filePath, name) {
  const root = document.getElementById('modal-root');
  const viewer = buildViewer(filePath, name);
  const close = () => {
    viewer.destroy();
    scrim.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const head = el('div', { class: 'preview-head' }, [
    el('span', { class: 'preview-title', text: name || baseName(filePath) }),
    el('button', { class: 'icon-btn', title: 'Close', 'aria-label': 'Close', onClick: close }, [icon('ti-x')]),
  ]);
  const frame = el('div', { class: 'preview-frame' }, [head, viewer.element]);
  const scrim = el('div', { class: 'modal-scrim', onClick: (e) => { if (e.target === scrim) close(); } }, [frame]);
  root.appendChild(scrim);
  document.addEventListener('keydown', onKey);
}

export function buildViewer(filePath, name) {
  const label = name || baseName(filePath);
  let scale = 1.1;
  let doc = null;
  let lib = null;
  let destroyed = false;
  let observer = null;
  let pageObjs = []; // { index, wrapper, page, renderTask, rendered, textLayer }

  const navEl = el('aside', { class: 'viewer-nav hidden' });
  const navToggle = iconBtn('ti-list', 'Navigation', () => navEl.classList.toggle('hidden'));
  const nameEl = el('span', { class: 'name', text: label });
  const pageInfo = el('span', { class: 'zoom-label', text: '…' });
  const zoomLabel = el('span', { class: 'zoom-label', text: `${Math.round(scale * 100)}%` });
  const search = el('input', { type: 'search', placeholder: 'Find in document…' });
  const pagesEl = el('div', { class: 'viewer-pages' });

  const bar = el('div', { class: 'viewer-bar' }, [
    navToggle,
    nameEl,
    search,
    iconBtn('ti-zoom-out', 'Zoom out', () => setScale(scale - 0.15)),
    zoomLabel,
    iconBtn('ti-zoom-in', 'Zoom in', () => setScale(scale + 0.15)),
    pageInfo,
  ]);
  const element = el('div', { class: 'viewer' }, [bar, el('div', { class: 'viewer-body' }, [navEl, pagesEl])]);

  function iconBtn(ic, title, onClick) {
    return el('button', { class: 'icon-btn', title, 'aria-label': title, onClick }, [icon(ic)]);
  }

  function scrollToPage(n) {
    pageObjs[n - 1]?.wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function gotoDest(dest) {
    try {
      let d = dest;
      if (typeof d === 'string') d = await doc.getDestination(d);
      if (!Array.isArray(d) || !d.length) return;
      const ref = d[0];
      let pageIndex = 0;
      if (ref && typeof ref === 'object') pageIndex = await doc.getPageIndex(ref);
      else if (typeof ref === 'number') pageIndex = ref;
      scrollToPage(pageIndex + 1);
    } catch {
      /* unresolved destination */
    }
  }

  function buildOutline(items, depth) {
    const frag = document.createDocumentFragment();
    for (const it of items) {
      frag.appendChild(el('div', {
        class: 'outline-item',
        style: `padding-left:${8 + depth * 12}px`,
        title: it.title,
        onClick: () => gotoDest(it.dest),
      }, it.title || '(untitled)'));
      if (it.items && it.items.length) frag.appendChild(buildOutline(it.items, depth + 1));
    }
    return frag;
  }

  function buildPageList(n) {
    const frag = document.createDocumentFragment();
    frag.appendChild(el('div', { class: 'nav-title', text: 'Pages' }));
    for (let i = 1; i <= n; i++) {
      frag.appendChild(el('div', { class: 'outline-item', onClick: () => scrollToPage(i) }, `Page ${i}`));
    }
    return frag;
  }

  async function renderPage(obj) {
    if (destroyed || obj.rendered || obj.renderTask) return;
    const viewport = obj.page.getViewport({ scale });
    // Render at the device pixel ratio for crisp output on Retina/HiDPI, then
    // display at the logical size (cap at 2x to bound canvas memory).
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = el('canvas');
    canvas.width = Math.ceil(viewport.width * dpr);
    canvas.height = Math.ceil(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    obj.wrapper.appendChild(canvas);
    const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;
    obj.renderTask = obj.page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, transform });
    try {
      await obj.renderTask.promise;
      obj.rendered = true;
    } catch {
      /* cancelled */
    } finally {
      obj.renderTask = null;
    }
    if (destroyed || !obj.rendered || !lib) return;
    // Invisible, positioned text layer over the canvas → native selection,
    // copy, and find-highlighting, exactly like a standard PDF reader.
    try {
      const textLayerDiv = el('div', { class: 'textLayer' });
      obj.wrapper.appendChild(textLayerDiv);
      obj.textLayer = new lib.TextLayer({
        textContentSource: obj.page.streamTextContent({ includeMarkedContent: true, disableNormalization: true }),
        container: textLayerDiv,
        viewport,
      });
      await obj.textLayer.render();
    } catch {
      /* no text layer (e.g. scanned page) */
    }
  }

  function unloadPage(obj) {
    if (obj.renderTask) { try { obj.renderTask.cancel(); } catch { /* noop */ } obj.renderTask = null; }
    if (obj.textLayer) { try { obj.textLayer.cancel(); } catch { /* noop */ } obj.textLayer = null; }
    clear(obj.wrapper);
    obj.rendered = false;
  }

  function sizeWrapper(obj) {
    const viewport = obj.page.getViewport({ scale });
    obj.wrapper.style.width = `${Math.ceil(viewport.width)}px`;
    obj.wrapper.style.height = `${Math.ceil(viewport.height)}px`;
    obj.wrapper.style.setProperty('--scale-factor', String(scale));
  }

  function setScale(next) {
    scale = Math.min(3, Math.max(0.4, Number(next.toFixed(2))));
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    for (const obj of pageObjs) { unloadPage(obj); sizeWrapper(obj); }
    if (observer) for (const obj of pageObjs) observer.observe(obj.wrapper);
  }

  async function find(query) {
    if (!query || !doc) return;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((i) => i.str).join(' ').toLowerCase();
      if (text.includes(query.toLowerCase())) {
        scrollToPage(n);
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
      lib = await getPdfjs();
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
      for (const obj of pageObjs) observer.observe(obj.wrapper);

      // Navigation pane: show the document outline (TOC) if present, else a
      // simple page list. Shown by default only when a real outline exists.
      const outline = await doc.getOutline().catch(() => null);
      clear(navEl);
      if (outline && outline.length) {
        navEl.appendChild(el('div', { class: 'nav-title', text: 'Contents' }));
        navEl.appendChild(buildOutline(outline, 0));
        navEl.classList.remove('hidden');
      } else {
        navEl.appendChild(buildPageList(doc.numPages));
      }

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
