// View renderers for the main area: home, tools gallery, models, settings.

import { el, clear, icon } from './ui.js';
import { getRecent } from './store.js';
import { runTool } from './ops.js';

function toolCard(tool) {
  const planned = tool.status === 'planned';
  const children = [
    el('div', { class: 'ic' }, [icon(tool.icon)]),
    el('h3', { text: tool.name }),
    el('p', { text: tool.description }),
  ];
  if (tool.status !== 'ready') {
    children.push(el('span', { class: `tag ${tool.status}`, text: tool.status }));
  }
  return el('div', {
    class: `tool-card${planned ? ' is-planned' : ''}`,
    role: 'button',
    tabindex: '0',
    onClick: () => runTool(tool),
    onKeydown: (e) => { if (e.key === 'Enter') runTool(tool); },
  }, children);
}

function relTime(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(ts).toLocaleDateString();
}

export function renderHome(main, caps, onExplore) {
  clear(main);
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'Documents' }), el('p', { text: 'Open a document, or start with a tool below.' })]),
  ]));

  // Tools carousel with a category filter + explore button
  const tools = (caps?.tools) || [];
  const categories = (caps?.categories) || [];
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
    for (const t of list) track.appendChild(toolCard(t));
  };
  filter.addEventListener('change', fill);
  fill();

  page.appendChild(el('div', { class: 'section-bar' }, [
    el('h2', { text: 'Tools' }),
    el('div', { class: 'section-actions' }, [filter, el('button', { class: 'btn', text: 'Explore all tools', onClick: onExplore })]),
  ]));
  page.appendChild(el('div', { class: 'carousel' }, [track]));

  // Recent documents
  page.appendChild(el('div', { class: 'section-bar' }, [el('h2', { text: 'Recent documents' })]));
  const recent = getRecent();
  if (!recent.length) {
    page.appendChild(el('div', { class: 'empty', text: 'No recent documents yet. Use “Open & view” to get started.' }));
  } else {
    const grid = el('div', { class: 'recent-grid' });
    for (const r of recent) {
      grid.appendChild(el('div', {
        class: 'recent-card',
        onClick: () => window.dispatchEvent(new CustomEvent('prism:open-file', { detail: { path: r.path, name: r.name } })),
      }, [
        el('div', { class: 'recent-thumb' }, [icon('ti-file-text')]),
        el('div', { class: 'recent-meta' }, [
          el('div', { class: 'name', text: r.name }),
          el('div', { class: 'when', text: `Opened ${relTime(r.opened)}` }),
        ]),
      ]));
    }
    page.appendChild(grid);
  }
  main.appendChild(page);
}

export function renderTools(main, caps, initialFilter = 'all') {
  clear(main);
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
      for (const t of list) grid.appendChild(toolCard(t));
      group.appendChild(grid);
      body.appendChild(group);
    }
  };
  filter.addEventListener('change', render);
  render();
  page.appendChild(body);
  main.appendChild(page);
}

export async function renderModels(main) {
  clear(main);
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'Models' }), el('p', { text: 'Your machine, and what it can run. On-device model recommendations arrive in a later phase.' })]),
  ]));
  const box = el('pre', { class: '', text: 'Reading your hardware…' });
  box.style.cssText = 'background:var(--bg-2);border:1px solid var(--border);border-radius:12px;padding:16px;white-space:pre-wrap;color:var(--text-1);font-size:12.5px;';
  page.appendChild(box);
  main.appendChild(page);
  const r = await window.prism.api('/system/hardware');
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
}

export function renderSettings(main, { ready, version }) {
  clear(main);
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'Settings' }), el('p', { text: 'PRISM Documents — by PRISM Data Studio' })]),
  ]));
  const box = el('pre', { text: [
    `Version:        ${version || '0.1.0'}`,
    `Backend status: ${ready ? 'connected (local)' : 'not connected'}`,
    `License:        MIT`,
    '',
    'All processing happens locally on this machine.',
  ].join('\n') });
  box.style.cssText = 'background:var(--bg-2);border:1px solid var(--border);border-radius:12px;padding:16px;white-space:pre-wrap;color:var(--text-1);font-size:12.5px;';
  page.appendChild(box);
  main.appendChild(page);
}
