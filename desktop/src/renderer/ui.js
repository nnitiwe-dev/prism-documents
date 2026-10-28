// Small DOM helpers, icon set, toast and modal primitives.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Minimal geometric icon set (placeholder iconography; swap for a real set later).
const P = {
  'ti-files': 'M9 3h7l4 4v10a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M5 7v12a2 2 0 0 0 2 2h8',
  'ti-file-text': 'M14 3v4a1 1 0 0 0 1 1h4 M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z M9 9h1 M9 13h6 M9 17h6',
  'ti-tool': 'M7 10a4 4 0 0 1 5-4l-2 2 2 2 2-2a4 4 0 0 1-5 5l-5 5-2-2 5-5z',
  'ti-cpu': 'M6 6h12v12H6z M9 9h6v6H9z M9 2v3 M15 2v3 M9 19v3 M15 19v3 M2 9h3 M2 15h3 M19 9h3 M19 15h3',
  'ti-settings': 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.3-2.5H9.7l-.3 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.3 2.5h4.6l.3-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.6.1-1z',
  'ti-search': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
  'ti-scissors': 'M6 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M6 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M8 8l12 8 M8 16l12-8',
  'ti-file-minus': 'M14 3v4a1 1 0 0 0 1 1h4 M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z M9 14h6',
  'ti-arrows-sort': 'M7 4v16 M4 8l3-4 3 4 M17 20V4 M14 16l3 4 3-4',
  'ti-rotate-clockwise': 'M20 11a8 8 0 1 1-2.3-5.6 M20 4v5h-5',
  'ti-text-recognition': 'M4 7V5a1 1 0 0 1 1-1h2 M4 17v2a1 1 0 0 0 1 1h2 M20 7V5a1 1 0 0 0-1-1h-2 M20 17v2a1 1 0 0 1-1 1h-2 M8 9h8 M8 13h5',
  'ti-download': 'M12 4v11 M8 11l4 4 4-4 M5 20h14',
  'ti-highlight': 'M4 20h16 M6 16l8-8 4 4-8 8H6v-4z',
  'ti-forms': 'M4 5h16v14H4z M8 9h8 M8 13h4',
  'ti-signature': 'M4 16c3 0 3-6 5-6s2 6 5 6c2 0 3-2 6-2',
  'ti-scan': 'M4 7V5a1 1 0 0 1 1-1h2 M4 17v2a1 1 0 0 0 1 1h2 M20 7V5a1 1 0 0 0-1-1h-2 M20 17v2a1 1 0 0 1-1 1h-2 M4 12h16',
  'ti-folder': 'M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7z',
  'ti-x': 'M6 6l12 12 M18 6L6 18',
  'ti-plus': 'M12 5v14 M5 12h14',
  'ti-zoom-in': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4 M11 8v6 M8 11h6',
  'ti-zoom-out': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4 M8 11h6',
  'ti-chevron-left': 'M15 6l-6 6 6 6',
  'ti-chevron-right': 'M9 6l6 6-6 6',
  'ti-list': 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  'ti-check': 'M5 12l5 5L20 7',
  'ti-alert': 'M12 9v4 M12 17h.01 M10.3 4.3L2.6 18a1.5 1.5 0 0 0 1.3 2.2h16.2a1.5 1.5 0 0 0 1.3-2.2L13.7 4.3a1.5 1.5 0 0 0-2.6 0z',
};

export function icon(name) {
  const d = P[name] || P['ti-file-text'];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const seg of d.split(' M').map((s, i) => (i ? 'M' + s : s))) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', seg);
    svg.appendChild(path);
  }
  return svg;
}

export function toast(message, kind = 'info') {
  const root = document.getElementById('toast-root');
  const node = el('div', { class: `toast ${kind}`, text: message });
  root.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    setTimeout(() => node.remove(), 200);
  }, 3600);
}

/**
 * Generic modal. `fields` is an array of { name, label, type, options, value }.
 * Resolves with a values object on confirm, or null on cancel.
 */
export function formModal({ title, fields = [], confirmLabel = 'Run', validate }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const inputs = {};
    const errEl = el('div', { class: 'err' });

    const body = el('div', { class: 'body' });
    for (const f of fields) {
      let input;
      if (f.type === 'select') {
        input = el('select', {}, (f.options || []).map((o) => el('option', { value: o.value, text: o.label })));
        if (f.value != null) input.value = f.value;
      } else {
        input = el('input', { type: 'text', value: f.value || '', placeholder: f.placeholder || '' });
      }
      inputs[f.name] = input;
      body.appendChild(el('label', {}, [f.label, input]));
    }
    body.appendChild(errEl);

    const close = (result) => {
      scrim.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const submit = () => {
      const values = {};
      for (const [k, v] of Object.entries(inputs)) values[k] = v.value.trim();
      if (validate) {
        const msg = validate(values);
        if (msg) {
          errEl.textContent = msg;
          return;
        }
      }
      close(values);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter') submit();
    };

    const actions = el('div', { class: 'actions' }, [
      el('button', { class: 'btn', text: 'Cancel', onClick: () => close(null) }),
      el('button', { class: 'btn primary', text: confirmLabel, onClick: submit }),
    ]);
    const modal = el('div', { class: 'modal' }, [el('h3', { text: title }), body, actions]);
    const scrim = el('div', { class: 'modal-scrim', onClick: (e) => { if (e.target === scrim) close(null); } }, [modal]);
    root.appendChild(scrim);
    document.addEventListener('keydown', onKey);
    const first = Object.values(inputs)[0];
    if (first) first.focus();
  });
}

export function infoModal({ title, pre, text }) {
  const root = document.getElementById('modal-root');
  const body = el('div', { class: 'body' }, [pre ? el('pre', { text: pre }) : el('div', { text: text || '' })]);
  const close = () => scrim.remove();
  const actions = el('div', { class: 'actions' }, [el('button', { class: 'btn primary', text: 'Close', onClick: close })]);
  const modal = el('div', { class: 'modal' }, [el('h3', { text: title }), body, actions]);
  const scrim = el('div', { class: 'modal-scrim', onClick: (e) => { if (e.target === scrim) close(); } }, [modal]);
  root.appendChild(scrim);
}
