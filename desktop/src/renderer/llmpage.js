// Summarize workspace: pick a document, pick an installed local model, and get a
// summary. If no model is downloaded, it points to the Models screen.

import { el, clear, icon, toast } from './ui.js';
import { createTray } from './tray.js';

async function api(path, options) {
  const r = await window.prism.api(path, options);
  if (!r.ok) throw new Error(r.error || 'Request failed');
  return r.data;
}

export function buildLlmPage(tool, { onBack } = {}) {
  const runBtn = el('button', { class: 'btn primary', text: 'Summarize', onClick: run, disabled: true });
  const modelSelect = el('select', {});
  const modelRow = el('label', { class: 'opt' }, ['Model', modelSelect]);
  const hint = el('div', { class: 'empty hidden' }, [
    el('span', { text: 'No models downloaded yet. ' }),
    el('button', { class: 'btn', text: 'Open Models', onClick: () => window.dispatchEvent(new CustomEvent('prism:navigate', { detail: { view: 'models' } })) }),
  ]);
  const summaryWrap = el('div', { class: 'summary-wrap hidden' });

  const tray = createTray({ multi: false, onChange: refresh });
  let installed = [];

  const page = el('div', { class: 'page toolpage' }, [
    el('div', { class: 'toolpage-head' }, [
      el('button', { class: 'icon-btn', title: 'Back', 'aria-label': 'Back', onClick: () => onBack && onBack() }, [icon('ti-chevron-left')]),
      el('div', {}, [el('h1', { text: tool.name }), el('p', { text: 'Summarize a document with a model running locally on your machine.' })]),
    ]),
    tray.element,
    el('div', { class: 'options' }, [modelRow]),
    hint,
    el('div', { class: 'runbar' }, [el('div', { class: 'runbar-spacer' }), runBtn]),
    summaryWrap,
  ]);

  (async () => {
    try {
      const data = await api('/models', {});
      installed = data.models.filter((m) => m.installed);
      clear(modelSelect);
      if (!installed.length) {
        hint.classList.remove('hidden');
        modelRow.classList.add('hidden');
      } else {
        for (const m of installed) modelSelect.appendChild(el('option', { value: m.id, text: m.name }));
        try {
          const cfg = (await api('/settings', {})).settings || {};
          if (cfg.default_model && installed.some((m) => m.id === cfg.default_model)) modelSelect.value = cfg.default_model;
        } catch { /* defaults */ }
      }
    } catch { /* backend not ready */ }
    refresh();
  })();

  function refresh() {
    runBtn.disabled = tray.getItems().length < 1 || !installed.length;
  }

  async function run() {
    const items = tray.getItems();
    if (!items.length) { toast('Add a PDF first', 'error'); return; }
    if (!installed.length) { toast('Download a model first (Models)', 'error'); return; }
    runBtn.disabled = true;
    const prev = runBtn.textContent;
    runBtn.textContent = 'Summarizing…';
    try {
      const res = await api('/llm/summarize', { method: 'POST', body: { input: items[0].path, model_id: modelSelect.value } });
      clear(summaryWrap);
      summaryWrap.classList.remove('hidden');
      summaryWrap.appendChild(el('div', { class: 'engine-meta', text: `${res.model}${res.truncated ? ' · long document was truncated to fit' : ''}` }));
      summaryWrap.appendChild(el('pre', { class: 'infobox', text: res.summary }));
      toast('Summary ready', 'success');
    } catch (err) {
      toast(err.message || 'Summarization failed', 'error');
    } finally {
      runBtn.textContent = prev;
      refresh();
    }
  }

  return { element: page, destroy: () => tray.destroy() };
}
