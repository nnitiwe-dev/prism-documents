// Generic tool workspace page. Clicking a tool opens one of these instead of a
// chain of native dialogs: add documents, adjust options, then run.

import { el, clear, icon, toast, infoModal } from './ui.js';
import { createTray } from './tray.js';
import { dirName, baseName } from './pdfjs.js';

const PDF_FILTER = [{ name: 'PDF', extensions: ['pdf'] }];

function parsePages(str) {
  return String(str || '').split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
}

async function api(path, body) {
  const r = await window.prism.api(path, { method: 'POST', body });
  if (!r.ok) throw new Error(r.error || 'Operation failed');
  return r.data;
}

// Per-tool behavior. `output`: 'file' (save dialog), 'dir' (folder dialog), or 'none'.
const CONFIG = {
  merge: {
    multi: true, minFiles: 2, output: 'file', defaultName: 'merged.pdf',
    run: async (items, _opts, output) => {
      const res = await api('/pdf/merge', { inputs: items.map((i) => i.path), output });
      return { message: `Merged ${items.length} files → ${res.pages} pages`, openPath: output };
    },
  },
  export: {
    multi: false, minFiles: 1, output: 'file', defaultName: 'copy.pdf',
    run: async (items, _opts, output) => {
      const res = await api('/pdf/merge', { inputs: [items[0].path], output });
      return { message: `Saved a copy (${res.pages} pages)`, openPath: output };
    },
  },
  rotate: {
    multi: false, minFiles: 1, output: 'file', defaultName: 'rotated.pdf',
    options: [
      { name: 'rotation', label: 'Rotation', type: 'select', options: [
        { value: '90', label: '90° clockwise' }, { value: '180', label: '180°' }, { value: '270', label: '270° clockwise' },
      ] },
      { name: 'pages', label: 'Pages to rotate (blank = all, e.g. 1,2,5)', type: 'text', placeholder: 'all' },
    ],
    run: async (items, opts, output) => {
      const pages = opts.pages ? parsePages(opts.pages) : null;
      await api('/pdf/rotate', { input: items[0].path, output, rotation: Number(opts.rotation), pages });
      return { message: 'Rotated and saved', openPath: output };
    },
  },
  'remove-pages': {
    multi: false, minFiles: 1, output: 'file', defaultName: 'edited.pdf',
    options: [{ name: 'pages', label: 'Pages to remove (e.g. 1,3,5)', type: 'text', placeholder: '1,3' }],
    validate: (items, opts) => (parsePages(opts.pages).length ? null : 'Enter at least one page number'),
    run: async (items, opts, output) => {
      const res = await api('/pdf/delete-pages', { input: items[0].path, output, pages: parsePages(opts.pages) });
      return { message: `Saved — ${res.pages} pages remain`, openPath: output };
    },
  },
  reorder: {
    multi: false, minFiles: 1, output: 'file', defaultName: 'reordered.pdf',
    options: [{ name: 'order', label: 'New page order (all pages, e.g. 3,1,2)', type: 'text', placeholder: '3,1,2' }],
    validate: (items, opts) => {
      const n = items[0]?.pages;
      if (n == null) return 'Still reading the document…';
      return parsePages(opts.order).length === n ? null : `Enter all ${n} pages exactly once`;
    },
    run: async (items, opts, output) => {
      await api('/pdf/reorder', { input: items[0].path, output, order: parsePages(opts.order) });
      return { message: 'Reordered and saved', openPath: output };
    },
  },
  split: {
    multi: false, minFiles: 1, output: 'dir',
    options: [
      { name: 'mode', label: 'How to split', type: 'select', options: [
        { value: 'each', label: 'One file per page' }, { value: 'range', label: 'A single page range' },
      ] },
      { name: 'range', label: 'Range (e.g. 1-3) — only for range mode', type: 'text', placeholder: '1-3' },
    ],
    run: async (items, opts, outputDir) => {
      let ranges = null;
      if (opts.mode === 'range') {
        const m = /^(\d+)\s*-\s*(\d+)$/.exec(opts.range || '');
        if (!m) throw new Error('Enter a range like "1-3"');
        ranges = [{ start: Number(m[1]), end: Number(m[2]) }];
      }
      const res = await api('/pdf/split', { input: items[0].path, output_dir: outputDir, ranges });
      return { message: `Created ${res.outputs.length} file(s)` };
    },
  },
  'extract-text': {
    multi: false, minFiles: 1, output: 'none',
    run: async (items) => {
      const res = await api('/pdf/extract-text', { input: items[0].path });
      const text = res.pages.map((p) => `--- Page ${p.page} ---\n${p.text}`).join('\n\n');
      infoModal({ title: 'Extracted text', pre: text || '(no selectable text found)' });
      return { message: 'Text extracted' };
    },
  },
};

export function buildToolPage(tool, { onBack, onOpenFile } = {}) {
  const cfg = CONFIG[tool.id];
  if (!cfg) {
    const element = el('div', { class: 'page' }, [el('div', { class: 'empty', text: `${tool.name} is not available yet.` })]);
    return { element, destroy: () => {} };
  }

  const tray = createTray({ multi: cfg.multi, onChange: () => refresh() });
  const optionInputs = {};
  const optionEls = (cfg.options || []).map((f) => {
    let input;
    if (f.type === 'select') input = el('select', {}, f.options.map((o) => el('option', { value: o.value, text: o.label })));
    else input = el('input', { type: 'text', placeholder: f.placeholder || '' });
    optionInputs[f.name] = input;
    return el('label', { class: 'opt' }, [f.label, input]);
  });

  const outName = cfg.output === 'file'
    ? el('input', { type: 'text', class: 'out-name', value: cfg.defaultName })
    : null;

  const runBtn = el('button', { class: 'btn primary', text: runLabel(cfg), onClick: run });
  const result = el('div', { class: 'result hidden' });

  const runbar = el('div', { class: 'runbar' }, [
    cfg.output === 'file' ? el('label', { class: 'out-label' }, ['Save as', outName]) : null,
    el('div', { class: 'runbar-spacer' }),
    runBtn,
  ]);

  const page = el('div', { class: 'page toolpage' }, [
    el('div', { class: 'toolpage-head' }, [
      el('button', { class: 'icon-btn', title: 'Back', 'aria-label': 'Back', onClick: () => onBack && onBack() }, [icon('ti-chevron-left')]),
      el('div', {}, [el('h1', { text: tool.name }), el('p', { text: tool.description })]),
    ]),
    tray.element,
    optionEls.length ? el('div', { class: 'options' }, optionEls) : null,
    runbar,
    result,
  ]);

  function runLabel(c) {
    if (c.output === 'none') return 'Run';
    if (c.output === 'dir') return 'Choose folder & run';
    return 'Save & run';
  }

  function refresh() {
    const items = tray.getItems();
    runBtn.disabled = items.length < cfg.minFiles;
  }

  async function run() {
    const items = tray.getItems();
    if (items.length < cfg.minFiles) {
      toast(`Add at least ${cfg.minFiles} ${cfg.minFiles === 1 ? 'document' : 'documents'}`, 'error');
      return;
    }
    const opts = {};
    for (const [k, v] of Object.entries(optionInputs)) opts[k] = v.value.trim();
    if (cfg.validate) {
      const msg = cfg.validate(items, opts);
      if (msg) { toast(msg, 'error'); return; }
    }

    let destination = null;
    if (cfg.output === 'file') {
      const name = (outName.value.trim() || cfg.defaultName).replace(/(\.pdf)?$/i, '.pdf');
      const r = await window.prism.saveDialog({ defaultPath: `${dirName(items[0].path)}/${name}`, filters: PDF_FILTER });
      if (r.canceled) return;
      destination = r.filePath;
    } else if (cfg.output === 'dir') {
      const r = await window.prism.openDialog({ properties: ['openDirectory', 'createDirectory'] });
      if (r.canceled) return;
      destination = r.filePaths[0];
    }

    runBtn.disabled = true;
    const prev = runBtn.textContent;
    runBtn.textContent = 'Working…';
    try {
      const res = await cfg.run(items, opts, destination);
      showResult(res);
      toast(res.message, 'success');
    } catch (err) {
      toast(err.message || 'Operation failed', 'error');
    } finally {
      runBtn.textContent = prev;
      refresh();
    }
  }

  function showResult(res) {
    clear(result);
    result.classList.remove('hidden');
    result.appendChild(el('span', { text: res.message }));
    if (res.openPath && onOpenFile) {
      result.appendChild(el('button', { class: 'btn', text: 'Open result', onClick: () => onOpenFile(res.openPath, baseName(res.openPath)) }));
    }
  }

  refresh();
  return { element: page, destroy: () => tray.destroy() };
}
