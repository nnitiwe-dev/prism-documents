// PDF viewer: render, zoom, page navigation, and basic text find via PDF.js.

import { el, clear, icon, toast } from './ui.js';
import { addRecent } from './store.js';

let pdfjs = null;

async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  try {
    pdfjs = await import('../../node_modules/pdfjs-dist/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      '../../node_modules/pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url,
    ).href;
  } catch (err) {
    pdfjs = null;
    throw new Error('PDF.js is not installed. Run `npm install` in the desktop folder.');
  }
  return pdfjs;
}

export async function openViewer(container, filePath, name) {
  clear(container);
  const label = name || filePath.split(/[\\/]/).pop();
  let scale = 1.1;
  let doc = null;

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
  container.appendChild(el('div', { class: 'viewer' }, [bar, pagesEl]));

  function iconBtn(ic, title, onClick) {
    return el('button', { class: 'icon-btn', title, 'aria-label': title, onClick }, [icon(ic)]);
  }

  async function render() {
    clear(pagesEl);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = el('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.dataset.page = String(n);
      pagesEl.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
    pageInfo.textContent = `${doc.numPages} pages`;
  }

  function setScale(next) {
    scale = Math.min(3, Math.max(0.4, Number(next.toFixed(2))));
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
    if (doc) render();
  }

  async function find(query) {
    if (!query) return;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      const text = content.items.map((i) => i.str).join(' ').toLowerCase();
      if (text.includes(query.toLowerCase())) {
        const canvas = pagesEl.querySelector(`canvas[data-page="${n}"]`);
        if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast(`Found on page ${n}`, 'success');
        return;
      }
    }
    toast('No matches found', 'info');
  }
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') find(search.value.trim());
  });

  try {
    const bytes = await window.prism.readFile(filePath);
    const lib = await loadPdfjs();
    doc = await lib.getDocument({ data: new Uint8Array(bytes) }).promise;
    await render();
    addRecent(filePath, label);
  } catch (err) {
    clear(pagesEl);
    pagesEl.appendChild(el('div', { class: 'empty', text: err.message || 'Could not open this PDF.' }));
  }
}
