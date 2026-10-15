# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Phase 1 (PDF essentials MVP)

- Electron shell with a VS Code–style activity bar, sidebar, and command palette.
- Home screen with a tools carousel, category filter, "Explore all tools", and
  a recent-documents grid.
- In-app PDF viewer (PDF.js): render, zoom, page navigation, and basic text find.
- Python FastAPI backend (uv-managed) with PDF operations:
  merge, split, rotate, reorder, remove pages, extract text, and document info.
- Capability registry as the single source of truth for tools.
- Secure local sidecar: loopback-only binding, OS-assigned ephemeral port,
  per-session token auth, and a renderer that never holds the token.
- Hardware profile endpoint and a Models panel (groundwork for Phase 2).
- Backend test suite (31 tests) and ruff linting.
- Packaging configuration (electron-builder) and a PyInstaller backend build script.
- Open-source docs: README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY,
  THIRD_PARTY_NOTICES.

[Unreleased]: https://github.com/nnitiwe/prism-documents/commits/main
