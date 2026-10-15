// Single shared PDF.js loader + helpers. Used by the viewer and the tray.

let libPromise = null;

export function getPdfjs() {
  if (!libPromise) {
    libPromise = import('../../node_modules/pdfjs-dist/build/pdf.mjs')
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = new URL(
          '../../node_modules/pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url,
        ).href;
        return lib;
      })
      .catch((err) => {
        libPromise = null;
        throw new Error('PDF.js is not installed. Run `npm install` in the desktop folder.');
      });
  }
  return libPromise;
}

export async function loadDocument(filePath) {
  const bytes = await window.prism.readFile(filePath);
  const lib = await getPdfjs();
  return lib.getDocument({ data: new Uint8Array(bytes) }).promise;
}

/**
 * Render page 1 to a small data URL, then destroy the document so no PDF stays
 * resident in memory just for a thumbnail.
 */
export async function renderThumbnail(filePath, maxWidth = 132) {
  let doc = null;
  try {
    doc = await loadDocument(filePath);
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = maxWidth / base.width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const url = canvas.toDataURL('image/png');
    return { url, width: canvas.width, height: canvas.height };
  } finally {
    if (doc) {
      try {
        await doc.destroy();
      } catch {
        /* already gone */
      }
    }
  }
}

export function formatBytes(n) {
  if (!n) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function baseName(p) {
  return p.split(/[\\/]/).pop();
}

export function dirName(p) {
  const parts = p.split(/[\\/]/);
  parts.pop();
  return parts.join('/') || '.';
}
