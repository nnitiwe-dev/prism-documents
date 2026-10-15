// Tool runners: collect inputs via native dialogs/modals and call the backend.

import { toast, formModal, infoModal } from './ui.js';
import { addRecent } from './store.js';

const PDF_FILTER = [{ name: 'PDF', extensions: ['pdf'] }];

async function api(path, body) {
  const r = await window.prism.api(path, { method: 'POST', body });
  if (!r.ok) throw new Error(r.error || 'Operation failed');
  return r.data;
}

async function pickPdf() {
  const r = await window.prism.openDialog({ properties: ['openFile'], filters: PDF_FILTER });
  return r.canceled ? null : r.filePaths[0];
}
async function pickPdfs() {
  const r = await window.prism.openDialog({ properties: ['openFile', 'multiSelections'], filters: PDF_FILTER });
  return r.canceled ? null : r.filePaths;
}
async function pickSave(defaultName) {
  const r = await window.prism.saveDialog({ defaultPath: defaultName, filters: PDF_FILTER });
  return r.canceled ? null : r.filePath;
}
async function pickDir() {
  const r = await window.prism.openDialog({ properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
}

function parsePages(str) {
  // "1,3,5" -> [1,3,5]
  return str.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

function openInViewer(path, name) {
  window.dispatchEvent(new CustomEvent('prism:open-file', { detail: { path, name } }));
}

async function guard(fn) {
  try {
    await fn();
  } catch (err) {
    toast(err.message || 'Something went wrong', 'error');
  }
}

export function runTool(tool) {
  if (tool.status === 'planned') {
    toast(`${tool.name} is planned for a future release.`, 'info');
    return;
  }
  switch (tool.id) {
    case 'view':
      return guard(async () => {
        const p = await pickPdf();
        if (p) openInViewer(p);
      });
    case 'merge':
    case 'export':
      return guard(runMerge);
    case 'split':
      return guard(runSplit);
    case 'rotate':
      return guard(runRotate);
    case 'remove-pages':
      return guard(runDelete);
    case 'reorder':
      return guard(runReorder);
    case 'extract-text':
      return guard(runExtract);
    default:
      toast(`${tool.name} is not available yet.`, 'info');
  }
}

async function runMerge() {
  const inputs = await pickPdfs();
  if (!inputs || inputs.length < 1) return;
  const output = await pickSave('merged.pdf');
  if (!output) return;
  const res = await api('/pdf/merge', { inputs, output });
  addRecent(output);
  toast(`Merged ${inputs.length} file(s) → ${res.pages} pages`, 'success');
}

async function runSplit() {
  const input = await pickPdf();
  if (!input) return;
  const mode = await formModal({
    title: 'Split PDF',
    confirmLabel: 'Choose folder',
    fields: [
      {
        name: 'mode',
        label: 'How should it be split?',
        type: 'select',
        options: [
          { value: 'each', label: 'One file per page' },
          { value: 'range', label: 'A single page range' },
        ],
      },
      { name: 'range', label: 'Range (e.g. 1-3) — only for range mode', placeholder: '1-3' },
    ],
  });
  if (!mode) return;
  const outDir = await pickDir();
  if (!outDir) return;
  let ranges = null;
  if (mode.mode === 'range') {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(mode.range);
    if (!m) throw new Error('Enter a range like "1-3"');
    ranges = [{ start: Number(m[1]), end: Number(m[2]) }];
  }
  const res = await api('/pdf/split', { input, output_dir: outDir, ranges });
  toast(`Created ${res.outputs.length} file(s)`, 'success');
}

async function runRotate() {
  const input = await pickPdf();
  if (!input) return;
  const vals = await formModal({
    title: 'Rotate pages',
    fields: [
      {
        name: 'rotation',
        label: 'Rotation',
        type: 'select',
        options: [
          { value: '90', label: '90° clockwise' },
          { value: '180', label: '180°' },
          { value: '270', label: '270° clockwise' },
        ],
      },
      { name: 'pages', label: 'Pages (blank = all, e.g. 1,2,5)', placeholder: 'all' },
    ],
  });
  if (!vals) return;
  const output = await pickSave('rotated.pdf');
  if (!output) return;
  const pages = vals.pages ? parsePages(vals.pages) : null;
  await api('/pdf/rotate', { input, output, rotation: Number(vals.rotation), pages });
  addRecent(output);
  toast('Rotated and saved', 'success');
}

async function runDelete() {
  const input = await pickPdf();
  if (!input) return;
  const vals = await formModal({
    title: 'Remove pages',
    fields: [{ name: 'pages', label: 'Pages to remove (e.g. 1,3,5)', placeholder: '1,3' }],
    validate: (v) => (parsePages(v.pages).length ? null : 'Enter at least one page number'),
  });
  if (!vals) return;
  const output = await pickSave('edited.pdf');
  if (!output) return;
  const res = await api('/pdf/delete-pages', { input, output, pages: parsePages(vals.pages) });
  addRecent(output);
  toast(`Saved — ${res.pages} pages remain`, 'success');
}

async function runReorder() {
  const input = await pickPdf();
  if (!input) return;
  const info = await api('/pdf/info', { path: input });
  const vals = await formModal({
    title: `Reorder ${info.pages} pages`,
    fields: [
      {
        name: 'order',
        label: 'New order (all pages, e.g. 3,1,2)',
        placeholder: Array.from({ length: info.pages }, (_, i) => i + 1).join(','),
      },
    ],
    validate: (v) => (parsePages(v.order).length === info.pages ? null : `Enter all ${info.pages} pages exactly once`),
  });
  if (!vals) return;
  const output = await pickSave('reordered.pdf');
  if (!output) return;
  await api('/pdf/reorder', { input, output, order: parsePages(vals.order) });
  addRecent(output);
  toast('Reordered and saved', 'success');
}

async function runExtract() {
  const input = await pickPdf();
  if (!input) return;
  const res = await api('/pdf/extract-text', { input });
  const text = res.pages.map((p) => `--- Page ${p.page} ---\n${p.text}`).join('\n\n');
  infoModal({ title: 'Extracted text', pre: text || '(no selectable text found)' });
}
