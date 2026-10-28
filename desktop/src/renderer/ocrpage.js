// OCR workspace: pick a document, choose an engine (and see exactly what it can
// and can't do), choose an output format, then run.

import { el, clear, icon, toast } from './ui.js';
import { createTray } from './tray.js';
import { dirName, baseName } from './pdfjs.js';

const FMT_LABELS = {
  'searchable-pdf': 'Searchable PDF',
  text: 'Plain text (.txt)',
  markdown: 'Markdown (.md)',
  json: 'JSON (.json)',
};
const FMT_EXT = { 'searchable-pdf': 'pdf', text: 'txt', markdown: 'md', json: 'json' };

async function api(path, options) {
  const r = await window.prism.api(path, options);
  if (!r.ok) throw new Error(r.error || 'Request failed');
  return r.data;
}

export function buildOcrPage(tool, { onBack, onOpenFile } = {}) {
  const runBtn = el('button', { class: 'btn primary', onClick: run, disabled: true });
  const result = el('div', { class: 'summary-wrap hidden' });

  const engineSelect = el('select', {});
  const formatSelect = el('select', {});
  const langSelect = el('select', {}, [el('option', { value: 'eng', text: 'English' })]);
  const forceCb = el('input', { type: 'checkbox' });
  const capCard = el('div', { class: 'cap-card' });

  const tray = createTray({ multi: false, onChange: refresh });
  let engines = [];

  const page = el('div', { class: 'page toolpage' }, [
    el('div', { class: 'toolpage-head' }, [
      el('button', { class: 'icon-btn', title: 'Back', 'aria-label': 'Back', onClick: () => onBack && onBack() }, [icon('ti-chevron-left')]),
      el('div', {}, [el('h1', { text: tool.name }), el('p', { text: 'Get the text out of a document — read its text layer, or OCR a scan. Pick a method and output.' })]),
    ]),
    tray.element,
    el('div', { class: 'options' }, [
      el('label', { class: 'opt' }, ['OCR engine', engineSelect]),
      el('label', { class: 'opt' }, ['Output', formatSelect]),
      el('label', { class: 'opt' }, ['Language', langSelect]),
      el('label', { class: 'opt opt-row' }, [forceCb, el('span', { text: 'Re-OCR pages that already have text' })]),
    ]),
    capCard,
    el('div', { class: 'runbar' }, [el('div', { class: 'runbar-spacer' }), runBtn]),
    result,
  ]);

  (async () => {
    try {
      const data = await api('/system/engines', {});
      engines = data.engines.filter((e) => e.capability === 'ocr');
      clear(engineSelect);
      for (const e of engines) {
        const usable = e.status === 'available';
        const suffix = usable ? '' : e.status === 'planned' ? ' (coming soon)' : ' (install required)';
        engineSelect.appendChild(el('option', { value: e.id, text: e.name + suffix, disabled: usable ? null : '' }));
      }
      let cfg = {};
      try { cfg = (await api('/settings', {})).settings || {}; } catch { /* defaults */ }
      const avail = engines.filter((e) => e.status === 'available');
      const first = avail.find((e) => e.id === cfg.default_ocr_engine) || avail.find((e) => e.default) || avail[0] || engines[0];
      if (first) engineSelect.value = first.id;
      onEngineChange();
    } catch {
      clear(engineSelect);
      engineSelect.appendChild(el('option', { value: 'tesseract', text: 'Tesseract' }));
    }
    refresh();
  })();

  (async () => {
    try {
      const data = await api('/ocr/languages', {});
      if (data.languages && data.languages.length) {
        clear(langSelect);
        for (const code of data.languages) langSelect.appendChild(el('option', { value: code, text: code }));
        if (data.languages.includes('eng')) langSelect.value = 'eng';
      }
    } catch { /* keep default */ }
  })();

  engineSelect.addEventListener('change', onEngineChange);
  formatSelect.addEventListener('change', updateRunLabel);

  function currentEngine() {
    return engines.find((e) => e.id === engineSelect.value);
  }

  function onEngineChange() {
    const e = currentEngine();
    // output formats for this engine
    clear(formatSelect);
    const outputs = (e && e.outputs) || ['searchable-pdf'];
    for (const o of outputs) formatSelect.appendChild(el('option', { value: o, text: FMT_LABELS[o] || o }));
    renderCapCard(e);
    updateRunLabel();
    refresh();
  }

  function renderCapCard(e) {
    clear(capCard);
    if (!e) return;
    capCard.appendChild(el('div', { class: 'cap-desc', text: e.description || '' }));
    const grid = el('div', { class: 'cap-grid' });
    for (const c of e.capabilities || []) {
      grid.appendChild(el('div', { class: `cap-item ${c.supported ? 'yes' : 'no'}` }, [
        icon(c.supported ? 'ti-check' : 'ti-x'),
        el('span', { text: c.feature }),
      ]));
    }
    capCard.appendChild(grid);
    if (e.limits) capCard.appendChild(el('div', { class: 'cap-limits' }, [icon('ti-alert'), el('span', { text: e.limits })]));
    if (e.status !== 'available') {
      capCard.appendChild(el('div', { class: 'cap-limits warn' }, [
        el('span', { text: e.status === 'planned' ? 'This engine is coming soon — not installable yet.' : 'This engine needs to be installed.' }),
      ]));
    }
  }

  function updateRunLabel() {
    runBtn.textContent = formatSelect.value === 'searchable-pdf' ? 'Save searchable PDF' : 'Extract';
  }

  function refresh() {
    const e = currentEngine();
    runBtn.disabled = tray.getItems().length < 1 || !e || e.status !== 'available';
  }

  async function run() {
    const items = tray.getItems();
    const e = currentEngine();
    if (!items.length) { toast('Add a PDF first', 'error'); return; }
    if (!e || e.status !== 'available') { toast('That method isn’t available yet.', 'error'); return; }
    const fmt = formatSelect.value;
    const isPdf = fmt === 'searchable-pdf';

    let output = null;
    if (isPdf) {
      const stem = baseName(items[0].path).replace(/\.pdf$/i, '');
      const save = await window.prism.saveDialog({
        defaultPath: `${dirName(items[0].path)}/${stem}-ocr.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (save.canceled) return;
      output = save.filePath;
    }

    runBtn.disabled = true;
    const prev = runBtn.textContent;
    runBtn.textContent = 'Working…';
    try {
      const res = await api('/ocr/run', { method: 'POST', body: {
        input: items[0].path, output, language: langSelect.value,
        force: forceCb.checked, engine: e.id, output_format: fmt,
      } });
      showResult(res, fmt, items[0].path);
      toast('Done', 'success');
    } catch (err) {
      toast(err.message || 'Failed', 'error');
    } finally {
      runBtn.textContent = prev;
      refresh();
    }
  }

  function showResult(res, fmt, inputPath) {
    clear(result);
    result.classList.remove('hidden');
    if (res.text != null) {
      result.appendChild(el('div', { class: 'result-actions' }, [
        el('button', { class: 'btn', text: 'Copy', onClick: async () => {
          try { await navigator.clipboard.writeText(res.text); toast('Copied to clipboard', 'success'); }
          catch { toast('Copy failed', 'error'); }
        } }),
        el('button', { class: 'btn', text: 'Save…', onClick: () => saveText(res.text, fmt, inputPath) }),
      ]));
      result.appendChild(el('pre', { class: 'infobox', text: res.text || '(no text found)' }));
    } else {
      result.appendChild(el('div', { class: 'engine-meta' }, [
        el('span', { text: 'Searchable PDF saved. ' }),
        onOpenFile ? el('button', { class: 'btn', text: 'Open result', onClick: () => onOpenFile(res.output, baseName(res.output)) }) : null,
      ]));
    }
  }

  async function saveText(text, fmt, inputPath) {
    const ext = FMT_EXT[fmt] || 'txt';
    const stem = baseName(inputPath).replace(/\.pdf$/i, '');
    const save = await window.prism.saveDialog({
      defaultPath: `${dirName(inputPath)}/${stem}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (save.canceled) return;
    const r = await window.prism.writeFile(save.filePath, text);
    if (r && r.ok) toast(`Saved ${baseName(save.filePath)}`, 'success');
    else toast('Save failed', 'error');
  }

  return { element: page, destroy: () => tray.destroy() };
}
