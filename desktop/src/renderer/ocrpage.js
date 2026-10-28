// OCR workspace: pick a document, choose an engine (Tesseract bundled; others
// are optional packs), choose language/options, and produce a searchable PDF.

import { el, clear, icon, toast } from './ui.js';
import { createTray } from './tray.js';
import { dirName, baseName } from './pdfjs.js';

const PDF_FILTER = [{ name: 'PDF', extensions: ['pdf'] }];

async function api(path, options) {
  const r = await window.prism.api(path, options);
  if (!r.ok) throw new Error(r.error || 'Request failed');
  return r.data;
}

export function buildOcrPage(tool, { onBack, onOpenFile } = {}) {
  const runBtn = el('button', { class: 'btn primary', text: 'Save & run', onClick: run, disabled: true });
  const result = el('div', { class: 'result hidden' });

  const engineSelect = el('select', {});
  const engineNote = el('div', { class: 'engine-note', text: '' });
  const langSelect = el('select', {}, [el('option', { value: 'eng', text: 'English' })]);
  const forceCb = el('input', { type: 'checkbox' });
  const outName = el('input', { type: 'text', class: 'out-name', value: 'searchable.pdf' });

  const tray = createTray({ multi: false, onChange: refresh });

  const options = el('div', { class: 'options' }, [
    el('label', { class: 'opt' }, ['OCR engine', engineSelect, engineNote]),
    el('label', { class: 'opt' }, ['Language', langSelect]),
    el('label', { class: 'opt opt-row' }, [forceCb, el('span', { text: 'Re-OCR pages that already have text' })]),
  ]);

  const page = el('div', { class: 'page toolpage' }, [
    el('div', { class: 'toolpage-head' }, [
      el('button', { class: 'icon-btn', title: 'Back', 'aria-label': 'Back', onClick: () => onBack && onBack() }, [icon('ti-chevron-left')]),
      el('div', {}, [el('h1', { text: tool.name }), el('p', { text: 'Add a searchable text layer so the document can be selected and searched.' })]),
    ]),
    tray.element,
    options,
    el('div', { class: 'runbar' }, [
      el('label', { class: 'out-label' }, ['Save as', outName]),
      el('div', { class: 'runbar-spacer' }),
      runBtn,
    ]),
    result,
  ]);

  // Populate engines + languages.
  let engines = [];
  (async () => {
    try {
      const data = await api('/system/engines', {});
      engines = data.engines.filter((e) => e.capability === 'ocr');
      clear(engineSelect);
      for (const e of engines) {
        const usable = e.status === 'available';
        engineSelect.appendChild(el('option', { value: e.id, text: `${e.name}${usable ? '' : e.status === 'planned' ? ' (coming soon)' : ' (install required)'}`, disabled: !usable ? '' : null }));
      }
      const first = engines.find((e) => e.status === 'available');
      if (first) engineSelect.value = first.id;
      updateEngineNote();
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

  engineSelect.addEventListener('change', () => { updateEngineNote(); refresh(); });

  function currentEngine() {
    return engines.find((e) => e.id === engineSelect.value);
  }
  function updateEngineNote() {
    const e = currentEngine();
    engineNote.textContent = e ? (e.verdict?.reason || '') : '';
  }
  function refresh() {
    const e = currentEngine();
    runBtn.disabled = tray.getItems().length < 1 || !e || e.status !== 'available';
  }

  async function run() {
    const items = tray.getItems();
    if (!items.length) { toast('Add a PDF first', 'error'); return; }
    const engine = currentEngine();
    if (!engine || engine.status !== 'available') {
      toast('That engine isn’t available yet — pick Tesseract or install the pack.', 'error');
      return;
    }
    const name = (outName.value.trim() || 'searchable.pdf').replace(/(\.pdf)?$/i, '.pdf');
    const save = await window.prism.saveDialog({ defaultPath: `${dirName(items[0].path)}/${name}`, filters: PDF_FILTER });
    if (save.canceled) return;

    runBtn.disabled = true;
    const prev = runBtn.textContent;
    runBtn.textContent = 'Running OCR…';
    try {
      const res = await api('/ocr/run', { method: 'POST', body: { input: items[0].path, output: save.filePath, language: langSelect.value, force: forceCb.checked, engine: engine.id } });
      clear(result);
      result.classList.remove('hidden');
      result.appendChild(el('span', { text: 'Done — searchable PDF saved.' }));
      if (onOpenFile) result.appendChild(el('button', { class: 'btn', text: 'Open result', onClick: () => onOpenFile(res.output, baseName(res.output)) }));
      toast('OCR complete', 'success');
    } catch (err) {
      toast(err.message || 'OCR failed', 'error');
    } finally {
      runBtn.textContent = prev;
      refresh();
    }
  }

  return { element: page, destroy: () => tray.destroy() };
}
