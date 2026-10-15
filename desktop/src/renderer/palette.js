// Command palette (Cmd/Ctrl+K): run any tool or jump to a section.

import { el, clear, icon } from './ui.js';
import { runTool } from './ops.js';

let overlay = null;
let getCaps = () => null;

export function initPalette(capsGetter) {
  getCaps = capsGetter;
  overlay = document.getElementById('palette');
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      hide();
    }
  });
}

function commands() {
  const caps = getCaps();
  const tools = (caps?.tools || []).map((t) => ({
    label: t.name,
    hint: t.status === 'ready' ? 'Tool' : t.status,
    icon: t.icon,
    run: () => runTool(t),
  }));
  const nav = ['documents', 'tools', 'models', 'settings'].map((v) => ({
    label: `Go to ${v[0].toUpperCase() + v.slice(1)}`,
    hint: 'Section',
    icon: 'ti-chevron-right',
    run: () => window.dispatchEvent(new CustomEvent('prism:navigate', { detail: { view: v } })),
  }));
  return [...nav, ...tools];
}

function toggle() {
  overlay.classList.contains('hidden') ? show() : hide();
}

function show() {
  const all = commands();
  let sel = 0;
  let filtered = all;

  const input = el('input', { type: 'text', placeholder: 'Type a command or tool…' });
  const list = el('div', { class: 'palette-list' });
  const box = el('div', { class: 'palette-box' }, [input, list]);
  clear(overlay);
  overlay.appendChild(box);
  overlay.classList.remove('hidden');

  const draw = () => {
    clear(list);
    filtered.forEach((c, i) => {
      list.appendChild(el('div', {
        class: `palette-item${i === sel ? ' sel' : ''}`,
        onClick: () => { hide(); c.run(); },
      }, [icon(c.icon), el('span', { text: c.label }), el('span', { class: 'meta', text: c.hint })]));
    });
  };
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    filtered = q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;
    sel = 0;
    draw();
  };

  input.addEventListener('input', apply);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, filtered.length - 1); draw(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); }
    else if (e.key === 'Enter' && filtered[sel]) { hide(); filtered[sel].run(); }
  });
  overlay.onclick = (e) => { if (e.target === overlay) hide(); };

  draw();
  input.focus();
}

function hide() {
  overlay.classList.add('hidden');
  clear(overlay);
}
