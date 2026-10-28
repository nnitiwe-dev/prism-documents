// View builders. Each returns a detached { element, destroy } the shell mounts.

import { el, clear, icon, toast } from './ui.js';
import { getRecent, removeRecent, clearRecent } from './store.js';
import { renderThumbnail, formatBytes } from './pdfjs.js';

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
  const GROUPS = [
    { label: 'Essential PDF tools', categories: ['organize-edit', 'annotate', 'forms-signing', 'convert-export', 'security', 'optimize'] },
    { label: 'Content understanding', categories: ['content-understanding', 'extraction'] },
  ];
  GROUPS.forEach((g, idx) => {
    const list = tools.filter((t) => g.categories.includes(t.category));
    if (!list.length) return;
    const actions = idx === 0
      ? el('div', { class: 'section-actions' }, [el('button', { class: 'btn', text: 'Explore all tools', onClick: onExplore })])
      : null;
    page.appendChild(el('div', { class: 'section-bar' }, [el('h2', { text: g.label }), actions]));
    const track = el('div', { class: 'carousel-track' });
    for (const t of list) track.appendChild(toolCard(t, onOpenTool));
    page.appendChild(el('div', { class: 'carousel' }, [track]));
  });

  const recent = getRecent();
  page.appendChild(el('div', { class: 'section-bar' }, [
    el('h2', { text: 'Recent documents' }),
    recent.length ? el('button', { class: 'btn', text: 'Clear all', onClick: () => clearRecent() }) : null,
  ]));

  let thumbObserver = null;
  if (!recent.length) {
    page.appendChild(el('div', { class: 'empty', text: 'No recent documents yet. Use “Open & view” to get started.' }));
  } else {
    const grid = el('div', { class: 'recent-grid' });
    thumbObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        thumbObserver.unobserve(e.target);
        const path = e.target.dataset.path;
        renderThumbnail(path, 260).then((t) => {
          if (t && e.target.isConnected) { clear(e.target); const img = el('img', { src: t.url, alt: '' }); e.target.appendChild(img); }
        }).catch(() => {});
      }
    }, { rootMargin: '200px 0px' });

    for (const r of recent) {
      const thumb = el('div', { class: 'recent-thumb', dataset: { path: r.path } }, [icon('ti-file-text')]);
      const removeBtn = el('button', { class: 'recent-x round-btn', title: 'Remove from recent', 'aria-label': 'Remove from recent', onClick: (e) => { e.stopPropagation(); removeRecent(r.path); } }, [icon('ti-x')]);
      grid.appendChild(el('div', { class: 'recent-card', onClick: () => onOpenFile(r.path, r.name) }, [
        thumb,
        removeBtn,
        el('div', { class: 'recent-meta' }, [
          el('div', { class: 'name', text: r.name }),
          el('div', { class: 'when', text: `Opened ${relTime(r.opened)}` }),
        ]),
      ]));
      thumbObserver.observe(thumb);
    }
    page.appendChild(grid);
  }
  return { element: page, destroy: () => { if (thumbObserver) thumbObserver.disconnect(); } };
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

function verdictBadge(engine) {
  // status overrides verdict wording where relevant
  if (engine.status === 'planned') return el('span', { class: 'badge badge-muted', text: 'Coming soon' });
  if (engine.status === 'needs-install') return el('span', { class: 'badge badge-red', text: 'Install required' });
  const level = engine.verdict?.level;
  if (level === 'comfortable') return el('span', { class: 'badge badge-green', text: 'Runs comfortably' });
  if (level === 'lag') return el('span', { class: 'badge badge-amber', text: 'May lag' });
  return el('span', { class: 'badge badge-red', text: 'Not recommended' });
}

function capabilityIndex(h) {
  const ramGb = h.ram_total_bytes / 1024 ** 3;
  const gpu = h.gpu;
  if (gpu && ramGb >= 16) return 'Can run mid-size models with acceleration';
  if (ramGb >= 16) return 'Good for small–mid models (CPU)';
  if (ramGb >= 8) return 'Good for small models';
  return 'Best with the lightest models';
}

function modelBadge(v) {
  const lvl = v?.level;
  if (lvl === 'comfortable') return el('span', { class: 'badge badge-green', text: 'Runs comfortably' });
  if (lvl === 'lag') return el('span', { class: 'badge badge-amber', text: 'May lag' });
  return el('span', { class: 'badge badge-red', text: 'Not recommended' });
}

function modelCard(m, refresh) {
  let action;
  if (m.installed) {
    action = el('div', { class: 'engine-side' }, [
      el('span', { class: 'badge badge-green', text: 'Installed' }),
      el('button', { class: 'btn', text: 'Remove', onClick: async () => { await window.prism.api('/models/remove', { method: 'POST', body: { model_id: m.id } }); refresh(); } }),
    ]);
  } else if (m.downloading) {
    const p = m.progress || {};
    const pct = p.total ? Math.round((p.downloaded / p.total) * 100) : 0;
    action = el('div', { class: 'dl-progress' }, [
      el('div', { class: 'dl-bar' }, [el('div', { class: 'dl-fill', style: `width:${pct}%` })]),
      el('span', { class: 'dl-pct', text: `${pct}%` }),
    ]);
  } else {
    action = el('button', { class: 'btn primary', text: 'Download', onClick: async () => {
      const r = await window.prism.api('/models/download', { method: 'POST', body: { model_id: m.id } });
      if (r.ok) refresh(); else toast(r.error || 'Download failed', 'error');
    } });
  }
  return el('div', { class: 'engine-card' }, [
    el('div', { class: 'engine-main' }, [
      el('div', { class: 'engine-top' }, [el('span', { class: 'engine-name', text: m.name }), modelBadge(m.verdict)]),
      el('div', { class: 'engine-desc', text: m.note || '' }),
      el('div', { class: 'engine-meta', text: `${formatBytes(m.size_bytes)} · ${m.license}${m.verdict?.reason ? ' · ' + m.verdict.reason : ''}` }),
    ]),
    action,
  ]);
}

export function buildModels() {
  const gb = (b) => (b / 1024 ** 3).toFixed(1) + ' GB';
  const page = el('div', { class: 'page' });
  page.appendChild(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h1', { text: 'Models' }), el('p', { text: 'Your machine, and which engines it can run.' })]),
  ]));

  const pcCard = el('div', { class: 'pc-card' }, [el('div', { class: 'empty', text: 'Reading your hardware…' })]);
  page.appendChild(pcCard);
  page.appendChild(el('div', { class: 'section-bar' }, [el('h2', { text: 'Engines' })]));
  const enginesWrap = el('div', {});
  page.appendChild(enginesWrap);
  page.appendChild(el('div', { class: 'section-bar' }, [el('h2', { text: 'Downloadable models' })]));
  const modelsWrap = el('div', {}, [el('div', { class: 'empty', text: 'Loading models…' })]);
  page.appendChild(modelsWrap);

  let cancelled = false;
  let poll = null;
  Promise.all([window.prism.api('/system/hardware'), window.prism.api('/system/engines')]).then(([hw, eng]) => {
    if (cancelled) return;

    clear(pcCard);
    if (hw.ok) {
      const h = hw.data;
      pcCard.appendChild(el('div', { class: 'pc-icon' }, [icon('ti-cpu')]));
      pcCard.appendChild(el('div', { class: 'pc-body' }, [
        el('div', { class: 'pc-title', text: capabilityIndex(h) }),
        el('div', { class: 'pc-specs' }, [
          el('span', { text: `${h.cpu_cores_physical}-core CPU` }),
          el('span', { text: `${gb(h.ram_available_bytes)} free of ${gb(h.ram_total_bytes)} RAM` }),
          el('span', { text: h.gpu ? (h.gpu.name || 'GPU') : 'No dedicated GPU' }),
          el('span', { text: `${gb(h.disk_free_bytes)} disk free` }),
          el('span', { text: `${h.os} (${h.arch})` }),
        ]),
      ]));
    } else {
      pcCard.appendChild(el('div', { class: 'empty', text: 'Could not read hardware (backend not ready).' }));
    }

    clear(enginesWrap);
    if (!eng.ok) {
      enginesWrap.appendChild(el('div', { class: 'empty', text: 'Could not load engines.' }));
      return;
    }
    for (const cap of eng.data.capabilities) {
      const list = eng.data.engines.filter((e) => e.capability === cap.id);
      if (!list.length) continue;
      const group = el('div', { class: 'cat-group' }, [el('h2', { text: cap.label })]);
      const grid = el('div', { class: 'engine-grid' });
      for (const e of list) {
        grid.appendChild(el('div', { class: 'engine-card' }, [
          el('div', { class: 'engine-main' }, [
            el('div', { class: 'engine-top' }, [el('span', { class: 'engine-name', text: e.name }), verdictBadge(e)]),
            el('div', { class: 'engine-desc', text: e.description }),
            el('div', { class: 'engine-meta', text: `${e.availability === 'bundled' ? 'Built in' : 'Optional download'} · ${e.license}${e.verdict?.reason ? ' · ' + e.verdict.reason : ''}` }),
          ]),
        ]));
      }
      group.appendChild(grid);
      enginesWrap.appendChild(group);
    }
  });

  async function renderModels() {
    const r = await window.prism.api('/models');
    if (cancelled) return;
    clear(modelsWrap);
    if (!r.ok) {
      modelsWrap.appendChild(el('div', { class: 'empty', text: 'Could not load models.' }));
      return;
    }
    const grid = el('div', { class: 'engine-grid' });
    for (const m of r.data.models) grid.appendChild(modelCard(m, renderModels));
    modelsWrap.appendChild(grid);
    const anyDownloading = r.data.models.some((m) => m.downloading);
    if (anyDownloading && !poll) poll = setInterval(renderModels, 1500);
    if (!anyDownloading && poll) { clearInterval(poll); poll = null; }
  }
  renderModels();

  return { element: page, destroy: () => { cancelled = true; if (poll) clearInterval(poll); } };
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
