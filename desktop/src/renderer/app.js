// Shell controller: activity bar, sidebar, routing, status bar, events.

import { el, clear, icon } from './ui.js';
import { getRecent } from './store.js';
import { renderHome, renderTools, renderModels, renderSettings } from './views.js';
import { openViewer } from './viewer.js';
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
    $side.appendChild(el('div', { class: 'side-title', text: 'Recent' }));
    const recent = getRecent();
    if (!recent.length) {
      $side.appendChild(el('div', { class: 'side-item', text: 'No documents yet' }));
    } else {
      for (const r of recent.slice(0, 12)) {
        $side.appendChild(el('div', {
          class: 'side-item',
          onClick: () => openFile(r.path, r.name),
        }, [icon('ti-file-text'), el('span', { text: r.name })]));
      }
    }
  } else if (state.view === 'tools') {
    $side.appendChild(el('div', { class: 'side-title', text: 'Categories' }));
    const cats = [{ id: 'all', label: 'All tools' }, ...((state.caps?.categories) || [])];
    for (const c of cats) {
      $side.appendChild(el('div', {
        class: `side-item${state.toolsFilter === c.id ? ' active' : ''}`,
        onClick: () => { state.toolsFilter = c.id; renderSidebar(); renderTools($main, state.caps, c.id); },
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
  if (view === 'documents') renderHome($main, state.caps, () => navigate('tools'));
  else if (view === 'tools') renderTools($main, state.caps, state.toolsFilter);
  else if (view === 'models') renderModels($main);
  else renderSettings($main, { ready: state.ready, version: state.caps?.version });
}

function openFile(path, name) {
  state.view = 'documents';
  renderActivityBar();
  renderSidebar();
  openViewer($main, path, name);
}

function wireEvents() {
  window.addEventListener('prism:navigate', (e) => navigate(e.detail.view));
  window.addEventListener('prism:open-file', (e) => openFile(e.detail.path, e.detail.name));
  window.addEventListener('prism:recent-changed', () => {
    if (state.view === 'documents' && $main.querySelector('.recent-grid, .page')) {
      // only refresh the home page listing, not an open viewer
      if ($main.querySelector('.carousel')) renderHome($main, state.caps, () => navigate('tools'));
    }
    renderSidebar();
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
  navigate(state.view);
}

boot();
