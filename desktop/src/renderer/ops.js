// Thin dispatcher: turn a tool into navigation. The actual work lives in the
// tool workspace pages (toolpage.js). Used by the command palette and views.

import { toast } from './ui.js';

export async function runTool(tool) {
  if (tool.status === 'planned') {
    toast(`${tool.name} is planned for a future release.`, 'info');
    return;
  }
  if (tool.id === 'view') {
    const r = await window.prism.openDialog({ properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (!r.canceled) window.dispatchEvent(new CustomEvent('prism:open-file', { detail: { path: r.filePaths[0] } }));
    return;
  }
  window.dispatchEvent(new CustomEvent('prism:open-tool', { detail: { toolId: tool.id } }));
}
