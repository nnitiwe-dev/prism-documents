// Generic tool workspace page. Clicking a tool opens one of these instead of a
// chain of native dialogs: add documents, adjust options (or select pages
// visually), then run.

import { el, clear, icon, toast, infoModal } from './ui.js';
import { createTray } from './tray.js';
import { createPageGrid } from './pagegrid.js';
import { dirName, baseName } from './pdfjs.js';

const PDF_FILTER = [{ name: 'PDF', extensions: ['pdf'] }];

function parseRanges(str, max) {
  const out = new Set();
  for (const part of String(str || '').split(',')) {
    const p = part.trim();
    if (!p) continue;
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(p);
    if (m) {
      let a = +m[1];
      let b = +m[2];
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && (!max || i <= max)) out.add(i);
    } else {
      const n = parseInt(p, 10);
      if (Number.isInteger(n) && n >= 1 && (!max || n <= max)) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

async function api(path, body) {
  const r = await window.prism.api(path, { method: 'POST', body });
  if (!r.ok) throw new Error(r.error || 'Operation failed');
  return r.data;
}

// output: 'file' (save dialog), 'dir' (folder dialog), or 'none'.
const CONFIG = {
  merge: {
    multi: true, minFiles: 2, output: 'file', defaultName: 'merged.pdf',
    run: async (items, _o, output) => {
      const res = await api('/pdf/merge', { inputs: items.map((i) => i.path), output });
      return { message: `Merged ${items.length} files → ${res.pages} pages`, openPath: output };
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
      const pages = opts.pages ? parseRanges(opts.pages) : null;
      await api('/pdf/rotate', { input: items[0].path, output, rotation: Number(opts.rotation), pages });
      return { message: 'Rotated and saved', openPath: output };
    },
  },
  'remove-pages': {
    multi: false, minFiles: 1, output: 'file', defaultName: 'edited.pdf', pageSelector: true,
    run: async (items, _o, output, ctx) => {
      const pages = ctx.pageGrid.getSelected();
      const res = await api('/pdf/delete-pages', { input: items[0].path, output, pages });
      return { message: `Removed ${pages.length} page(s) — ${res.pages} remain`, openPath: output };
    },
  },
  reorder: {
    multi: false, minFiles: 1, output: 'file', defaultName: 'reordered.pdf',
    options: [{ name: 'order', label: 'New page order (all pages, e.g. 3,1,2)', type: 'text', placeholder: '3,1,2' }],
    validate: (items, opts) => {
      const n = items[0]?.pages;
      if (n == null) return 'Still reading the document…';
      return parseRanges(opts.order).length === n ? null : `Enter all ${n} pages exactly once`;
    },
    run: async (items, opts, output) => {
      await api('/pdf/reorder', { input: items[0].path, output, order: opts.order.split(',').map((s) => parseInt(s.trim(), 10)) });
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

  const runBtn = el('button', { class: 'btn primary', text: runLabel(cfg), onClick: run });
  const result = el('div', { class: 'result hidden' });

  // --- visual page selector (e.g. Remove pages) ---
  let pageGrid = null;
  let selectorSummary = null;
  let selectorBlock = null;
  if (cfg.pageSelector) {
    pageGrid = createPageGrid({ onChange: (s) => onSelectionChange(s) });
    selectorSummary = el('span', { class: 'sel-summary', text: 'Add a document to choose pages' });
    const rangeInput = el('input', { type: 'text', placeholder: 'or type pages, e.g. 1,3-5' });
    const applyBtn = el('button', { class: 'btn', text: 'Apply', onClick: () => {
      const pages = parseRanges(rangeInput.value, pageGrid.getTotal());
      pageGrid.setSelected(pages);
    } });
    const clearBtn = el('button', { class: 'btn', text: 'Clear', onClick: () => pageGrid.clearSelection() });
    selectorBlock = el('div', { class: 'selector' }, [
      el('div', { class: 'selector-bar' }, [selectorSummary, el('div', { class: 'runbar-spacer' }), rangeInput, applyBtn, clearBtn]),
      pageGrid.element,
    ]);
  }

  // --- tray ---
  const tray = createTray({ multi: cfg.multi, onChange: onTrayChange });

  // --- options ---
  const optionInputs = {};
  const optionEls = (cfg.options || []).map((f) => {
    let input;
    if (f.type === 'select') input = el('select', {}, f.options.map((o) => el('option', { value: o.value, text: o.label })));
    else input = el('input', { type: 'text', placeholder: f.placeholder || '' });
    optionInputs[f.name] = input;
    return el('label', { class: 'opt' }, [f.label, input]);
  });

  const outName = cfg.output === 'file' ? el('input', { type: 'text', class: 'out-name', value: cfg.defaultName }) : null;
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
    selectorBlock,
    optionEls.length ? el('div', { class: 'options' }, optionEls) : null,
    runbar,
    result,
  ]);

  function runLabel(c) {
    if (c.output === 'none') return 'Run';
    if (c.output === 'dir') return 'Choose folder & run';
    return 'Save & run';
  }

  function onTrayChange(items) {
    if (pageGrid) {
      if (items.length) pageGrid.load(items[0].path);
      else pageGrid.reset();
    }
    refresh();
  }

  function onSelectionChange(s) {
    if (selectorSummary) {
      selectorSummary.textContent = s.total
        ? `Removing ${s.selected.length} of ${s.total} page${s.total === 1 ? '' : 's'}`
        : 'Add a document to choose pages';
    }
    refresh();
  }

  function refresh() {
    const items = tray.getItems();
    let ok = items.length >= cfg.minFiles;
    if (cfg.pageSelector) ok = ok && pageGrid.getSelected().length > 0;
    runBtn.disabled = !ok;
  }

  async function run() {
    const items = tray.getItems();
    if (items.length < cfg.minFiles) {
      toast(`Add at least ${cfg.minFiles} ${cfg.minFiles === 1 ? 'document' : 'documents'}`, 'error');
      return;
    }
    if (cfg.pageSelector && pageGrid.getSelected().length === 0) {
      toast('Select at least one page to remove', 'error');
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
      const res = await cfg.run(items, opts, destination, { pageGrid });
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
  return { element: page, destroy: () => { tray.destroy(); if (pageGrid) pageGrid.destroy(); } };
}
