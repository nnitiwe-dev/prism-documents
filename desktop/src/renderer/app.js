// Shell controller: activity bar, sidebar, a mount/destroy view host (no orphan
// pages, resources freed on navigation), status bar, and event routing.

import { el, clear, icon } from './ui.js';
import { getRecent, removeRecent, clearRecent } from './store.js';
import { buildHome, buildTools, buildModels, buildSettings } from './views.js';
import { buildViewer } from './viewer.js';
import { buildToolPage } from './toolpage.js';
import { runTool } from './ops.js';
import { initPalette } from './palette.js';

const state = { caps: null, ready: false, view: 'documents', toolsFilter: 'all' };

const SECTIONS = [
  { id: 'documents', label: 'Documents', icon: 'ti-files' },
  { id: 'tools', label: 'Tools', icon: 'ti-tool' },
  { id: 'models', label: 'Models', icon: 'ti-cpu' },
  { id: 'settings', label: 'Settings', icon: 'ti-settings' },
];

const $main = document.getElementById('main');
const $side = document.getElementById('sidebar');
const $act = document.getElementById('activitybar');
const $status = document.getElementById('statusbar');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- view host: exactly one { element, destroy } mounted at a time ----
let active = null;
let activeKind = 'section';
function mount(view, kind = 'section') {
  if (active && active.destroy) active.destroy();
  clear($main);
  active = view;
  activeKind = kind;
  if (view) $main.appendChild(view.element);
  $main.scrollTop = 0;
}

function handleTool(tool) {
  if (tool.status === 'planned' || tool.id === 'view') runTool(tool);
  else openToolPage(tool);
}

function openToolPage(tool) {
  mount(buildToolPage(tool, { onBack: () => navigate(state.view), onOpenFile: openFile }), 'tool');
}

function openFile(path, name) {
  mount(buildViewer(path, name), 'viewer');
}

function renderActivityBar() {
  clear($act);
  for (const s of SECTIONS) {
    $act.appendChild(el('button', {
      class: `act-btn${state.view === s.id ? ' active' : ''}`,
      title: s.label,
      'aria-label': s.label,
      onClick: () => navigate(s.id),
    }, [icon(s.icon)]));
  }
}

function renderSidebar() {
  clear($side);
  if (state.view === 'documents') {
    const recent = getRecent();
    $side.appendChild(el('div', { class: 'side-title row' }, [
      el('span', { text: 'Recent' }),
      recent.length ? el('button', { class: 'side-clear', text: 'Clear', onClick: () => clearRecent() }) : null,
    ]));
    if (!recent.length) $side.appendChild(el('div', { class: 'side-item muted', text: 'No documents yet' }));
    else for (const r of recent.slice(0, 12)) {
      $side.appendChild(el('div', { class: 'side-item', onClick: () => openFile(r.path, r.name) }, [
        icon('ti-file-text'),
        el('span', { class: 'side-item-name', text: r.name }),
        el('button', { class: 'side-x', title: 'Remove', 'aria-label': 'Remove', onClick: (e) => { e.stopPropagation(); removeRecent(r.path); } }, [icon('ti-x')]),
      ]));
    }
  } else if (state.view === 'tools') {
    $side.appendChild(el('div', { class: 'side-title', text: 'Categories' }));
    const cats = [{ id: 'all', label: 'All tools' }, ...((state.caps?.categories) || [])];
    for (const c of cats) {
      $side.appendChild(el('div', {
        class: `side-item${state.toolsFilter === c.id ? ' active' : ''}`,
        onClick: () => { state.toolsFilter = c.id; renderSidebar(); mount(buildTools(state.caps, { initialFilter: c.id, onOpenTool: handleTool }), 'section'); },
      }, [icon('ti-chevron-right'), el('span', { text: c.label })]));
    }
  } else if (state.view === 'models') {
    $side.appendChild(el('div', { class: 'side-title', text: 'Models' }));
    $side.appendChild(el('div', { class: 'side-item' }, [icon('ti-cpu'), el('span', { text: 'This machine' })]));
  } else {
    $side.appendChild(el('div', { class: 'side-title', text: 'Settings' }));
    $side.appendChild(el('div', { class: 'side-item' }, [icon('ti-settings'), el('span', { text: 'General' })]));
  }
}

function renderStatus() {
  clear($status);
  $status.appendChild(el('span', { class: `status-dot ${state.ready ? 'ok' : 'off'}` }));
  $status.appendChild(el('span', { text: state.ready ? 'Backend connected' : 'Starting backend…' }));
  $status.appendChild(el('span', { class: 'right', text: '⌘K / Ctrl+K — Commands' }));
}

function navigate(view) {
  state.view = view;
  renderActivityBar();
  renderSidebar();
  if (view === 'documents') mount(buildHome(state.caps, { onExplore: () => navigate('tools'), onOpenFile: openFile, onOpenTool: handleTool }));
  else if (view === 'tools') mount(buildTools(state.caps, { initialFilter: state.toolsFilter, onOpenTool: handleTool }));
  else if (view === 'models') mount(buildModels());
  else mount(buildSettings({ ready: state.ready, version: state.caps?.version }));
}

function wireEvents() {
  window.addEventListener('prism:navigate', (e) => navigate(e.detail.view));
  window.addEventListener('prism:open-file', (e) => openFile(e.detail.path, e.detail.name));
  window.addEventListener('prism:open-tool', (e) => {
    const tool = (state.caps?.tools || []).find((t) => t.id === e.detail.toolId);
    if (tool) openToolPage(tool);
  });
  window.addEventListener('prism:recent-changed', () => {
    renderSidebar();
    if (activeKind === 'section' && state.view === 'documents') navigate('documents');
  });
}

async function waitForBackend() {
  for (let i = 0; i < 60; i++) {
    const s = await window.prism.status();
    if (s.ready) return true;
    renderStatus();
    await sleep(500);
  }
  return false;
}

async function boot() {
  renderActivityBar();
  renderStatus();
  initPalette(() => state.caps);
  wireEvents();
  navigate('documents');

  state.ready = await waitForBackend();
  renderStatus();
  if (state.ready) {
    const r = await window.prism.api('/capabilities');
    if (r.ok) state.caps = r.data;
  }
  if (activeKind === 'section') navigate(state.view);
}

boot();
