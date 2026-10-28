// Static fallback copy of the backend capability registry, so the tools UI
// always renders even before the backend is ready (or if it fails to start).
// The backend remains the source of truth: once /capabilities responds, it
// replaces this. Keep in sync with backend/src/prism_backend/registry.py.

export const FALLBACK_CAPABILITIES = {
  version: '0.1.0',
  fallback: true,
  categories: [
    { id: 'organize-edit', label: 'Organize & edit' },
    { id: 'annotate', label: 'Annotate' },
    { id: 'forms-signing', label: 'Forms & signing' },
    { id: 'convert-export', label: 'Convert & export' },
    { id: 'content-understanding', label: 'Content understanding' },
    { id: 'extraction', label: 'Extraction' },
    { id: 'security', label: 'Security' },
    { id: 'optimize', label: 'Optimize' },
  ],
  tools: [
    { id: 'view', name: 'Open & view', description: 'Open, read, search, zoom, and navigate a PDF.', category: 'organize-edit', icon: 'ti-file-text', execution: 'client', status: 'ready' },
    { id: 'merge', name: 'Merge PDFs', description: 'Combine several PDFs into one document.', category: 'organize-edit', icon: 'ti-files', execution: 'backend', endpoint: '/pdf/merge', status: 'ready' },
    { id: 'split', name: 'Split PDF', description: 'Split a PDF into page ranges or one file per page.', category: 'organize-edit', icon: 'ti-scissors', execution: 'backend', endpoint: '/pdf/split', status: 'ready' },
    { id: 'remove-pages', name: 'Remove pages', description: 'Delete one or more pages from a PDF.', category: 'organize-edit', icon: 'ti-file-minus', execution: 'backend', endpoint: '/pdf/delete-pages', status: 'ready' },
    { id: 'reorder', name: 'Reorder pages', description: 'Rearrange the pages of a PDF.', category: 'organize-edit', icon: 'ti-arrows-sort', execution: 'backend', endpoint: '/pdf/reorder', status: 'ready' },
    { id: 'rotate', name: 'Rotate pages', description: 'Rotate selected pages by 90, 180, or 270 degrees.', category: 'organize-edit', icon: 'ti-rotate-clockwise', execution: 'backend', endpoint: '/pdf/rotate', status: 'ready' },
    { id: 'extract-text', name: 'Extract text & OCR', description: 'Read the text layer or OCR scans; export to text, JSON or Markdown.', category: 'extraction', icon: 'ti-text-recognition', execution: 'backend', endpoint: '/ocr/run', status: 'ready' },
    { id: 'annotate', name: 'Highlight & notes', description: 'Highlight, underline, draw, and add notes.', category: 'annotate', icon: 'ti-highlight', execution: 'client', status: 'planned' },
    { id: 'fill-form', name: 'Fill form', description: 'Fill standard (AcroForm) PDF form fields.', category: 'forms-signing', icon: 'ti-forms', execution: 'backend', status: 'planned' },
    { id: 'sign', name: 'Sign', description: 'Add a visible signature image or drawing.', category: 'forms-signing', icon: 'ti-signature', execution: 'client', status: 'planned' },
    { id: 'summarize', name: 'Summarize', description: 'Summarize a document with a local AI model.', category: 'content-understanding', icon: 'ti-file-text', execution: 'backend', endpoint: '/llm/summarize', status: 'ready' },
  ],
};
