// View builders. Each returns a detached { element, destroy } the shell mounts.

import { el, clear, icon } from './ui.js';
import { getRecent } from './store.js';

function toolCard(tool, onOpenTool) {
  const planned = tool.status === 'planned';
  const children = [
    el('div', { class: 'ic' }, [icon(tool.icon)]),
    el('h3', { text: tool.name }),
    el('p', { text: tool.description }),
  ];
  if (tool.status !== 'ready') children.push(el('span', { class: `tag ${tool.status}`, text: tool.status }));
  return el('div', {
    class: `tool-card${planned ? ' is-planned' : ''}`,
    role: 'button',
    tabindex: '0',
    onClick: () => onOpenTool(tool),
    onKeydown: (e) => { if (e.key === 'Enter') onOpenTool(tool); },
  }, children);
}

function relTime(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function buildHome(caps, { onExplore, onOpenFile, onOpenTool }) {
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'Documents' }), el('p', { text: 'Open a document, or start with a tool below.' })]),
  ]));

  const tools = caps?.tools || [];
  const categories = caps?.categories || [];
  const filter = el('select', {}, [
    el('option', { value: 'all', text: 'All categories' }),
    ...categories.map((c) => el('option', { value: c.id, text: c.label })),
  ]);
  const track = el('div', { class: 'carousel-track' });
  const fill = () => {
    clear(track);
    const sel = filter.value;
    const list = tools.filter((t) => sel === 'all' || t.category === sel);
    if (!list.length) track.appendChild(el('div', { class: 'empty', text: 'No tools in this category yet.' }));
    for (const t of list) track.appendChild(toolCard(t, onOpenTool));
  };
  filter.addEventListener('change', fill);
  fill();

  page.appendChild(el('div', { class: 'section-bar' }, [
    el('h2', { text: 'Tools' }),
    el('div', { class: 'section-actions' }, [filter, el('button', { class: 'btn', text: 'Explore all tools', onClick: onExplore })]),
  ]));
  page.appendChild(el('div', { class: 'carousel' }, [track]));

  page.appendChild(el('div', { class: 'section-bar' }, [el('h2', { text: 'Recent documents' })]));
  const recent = getRecent();
  if (!recent.length) {
    page.appendChild(el('div', { class: 'empty', text: 'No recent documents yet. Use “Open & view” to get started.' }));
  } else {
    const grid = el('div', { class: 'recent-grid' });
    for (const r of recent) {
      grid.appendChild(el('div', { class: 'recent-card', onClick: () => onOpenFile(r.path, r.name) }, [
        el('div', { class: 'recent-thumb' }, [icon('ti-file-text')]),
        el('div', { class: 'recent-meta' }, [
          el('div', { class: 'name', text: r.name }),
          el('div', { class: 'when', text: `Opened ${relTime(r.opened)}` }),
        ]),
      ]));
    }
    page.appendChild(grid);
  }
  return { element: page, destroy: () => {} };
}

export function buildTools(caps, { initialFilter = 'all', onOpenTool }) {
  const page = el('div', { class: 'page' });
  const filter = el('select', {}, [
    el('option', { value: 'all', text: 'All categories' }),
    ...(caps?.categories || []).map((c) => el('option', { value: c.id, text: c.label })),
  ]);
  filter.value = initialFilter;
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'All tools' }), el('p', { text: 'Every document tool, grouped by what it does.' })]),
    filter,
  ]));
  const body = el('div', {});
  const render = () => {
    clear(body);
    const sel = filter.value;
    for (const cat of caps?.categories || []) {
      if (sel !== 'all' && sel !== cat.id) continue;
      const list = (caps?.tools || []).filter((t) => t.category === cat.id);
      if (!list.length) continue;
      const group = el('div', { class: 'cat-group' }, [el('h2', { text: cat.label })]);
      const grid = el('div', { class: 'grid' });
      for (const t of list) grid.appendChild(toolCard(t, onOpenTool));
      group.appendChild(grid);
      body.appendChild(group);
    }
  };
  filter.addEventListener('change', render);
  render();
  page.appendChild(body);
  return { element: page, destroy: () => {} };
}

export function buildModels() {
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'Models' }), el('p', { text: 'Your machine, and what it can run. On-device model recommendations arrive in a later phase.' })]),
  ]));
  const box = el('pre', { class: 'infobox', text: 'Reading your hardware…' });
  page.appendChild(box);
  let cancelled = false;
  window.prism.api('/system/hardware').then((r) => {
    if (cancelled) return;
    if (r.ok) {
      const h = r.data;
      const gb = (b) => (b / 1024 ** 3).toFixed(1) + ' GB';
      box.textContent = [
        `OS:        ${h.os} ${h.os_version} (${h.arch})`,
        `CPU:       ${h.cpu}`,
        `Cores:     ${h.cpu_cores_physical} physical / ${h.cpu_cores_logical} logical`,
        `Memory:    ${gb(h.ram_total_bytes)} total · ${gb(h.ram_available_bytes)} available`,
        `Disk free: ${gb(h.disk_free_bytes)}`,
        '',
        'GPU detection and model compatibility scoring are planned for Phase 2.',
      ].join('\n');
    } else {
      box.textContent = 'Could not read hardware (backend not ready).';
    }
  });
  return { element: page, destroy: () => { cancelled = true; } };
}

export function buildSettings({ ready, version }) {
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'Settings' }), el('p', { text: 'PRISM Documents — by PRISM Data Studio' })]),
  ]));
  page.appendChild(el('pre', { class: 'infobox', text: [
    `Version:        ${version || '0.1.0'}`,
    `Backend status: ${ready ? 'connected (local)' : 'not connected'}`,
    `License:        MIT`,
    '',
    'All processing happens locally on this machine.',
  ].join('\n') }));
  return { element: page, destroy: () => {} };
}
