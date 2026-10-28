# Releasing & distributing PRISM Documents

Installers are distributed through **GitHub Releases** — no separate server or
CDN is needed, and it doubles as the feed for in-app auto-update.

## ⚠️ You cannot cross-build from one machine

The Python backend is compiled by **PyInstaller into a native, OS-specific
binary** (a macOS build yields a Mach-O that will not run on Windows or Linux).
Electron can cross-package the shell, but it will just bundle whatever backend
binary is on disk — so a Windows/Linux installer built on a Mac ships a **Mac**
backend and fails to start. Each platform's backend must be built **on that
platform**.

## TL;DR — the recommended way (CI, builds all three)

Push a version tag; the **`.github/workflows/release.yml`** matrix builds the
backend + installer natively on macOS, Windows, and Linux runners and publishes
them (plus the `latest*.yml` / `.blockmap` auto-update metadata) to a draft
release — no physical Windows/Linux machines needed.

```bash
# bump versions + changelog first (see checklist), then:
git tag v0.1.1 && git push origin v0.1.1
```

Review the draft release it creates, then publish.

## Manual, single-OS way (automated publish)

Let `electron-builder` build **and** publish in one step. It uploads the
installers *and* the auto-update metadata, and creates/updates the GitHub
release for the current version. This is better than uploading by hand because
it never forgets the `latest*.yml` / `.blockmap` files that auto-update needs.

```bash
# once: a GitHub token with repo scope
export GH_TOKEN=ghp_xxx

# rebuild the bundled backend first (the installer ships the pre-built binary)
./scripts/build-backend.sh

# build + publish for the current OS (run on each OS, or cross-build)
cd desktop
npm run dist:mac    -- --publish always
npm run dist:win    -- --publish always
npm run dist:linux  -- --publish always
```

The `publish:` block in `electron-builder.yml` already points at
`github.com/nnitiwe-dev/prism-documents`. electron-builder creates a **draft**
release named after the version; review it on GitHub and click **Publish**.

> Each platform's installer must be built on (or cross-built for) that OS:
> `.dmg` on macOS, `.exe` on Windows, `.AppImage`/`.deb` on Linux.

## Manual way (uploading pre-built files)

If you build the three installers separately (as for v0.1.0), create the release
with the GitHub CLI and attach **all** of these from `desktop/dist/`:

- the installers: `*.dmg`, `*.exe`, `*.AppImage` (and `*.deb` if built)
- the macOS zip: `*-x64.zip` (required for macOS auto-update)
- the update metadata: `latest-mac.yml`, `latest.yml`, `latest-linux.yml`
- the block maps: `*.blockmap`

```bash
cd desktop/dist
gh release create v0.1.0 \
  --repo nnitiwe-dev/prism-documents \
  --title "PRISM Documents 0.1.0" \
  --notes-file ../../docs/release-notes-0.1.0.md \
  --draft \
  "PRISM Documents-0.1.0-x64.dmg" \
  "PRISM Documents-0.1.0-x64.dmg.blockmap" \
  "PRISM Documents-0.1.0-x64.zip" \
  "PRISM Documents-0.1.0-x64.zip.blockmap" \
  "PRISM Documents-Setup-0.1.0.exe" \
  "PRISM Documents-Setup-0.1.0.exe.blockmap" \
  "PRISM Documents-0.1.0-x86_64.AppImage" \
  latest-mac.yml latest.yml
```

`--draft` keeps it private until you review and publish. Drop it (and add
`latest-linux.yml` once produced) when you're ready to go public.

## Why the `.yml` / `.blockmap` files matter

The app ships `electron-updater` (see `src/main/updater.js`). On launch it fetches
`latest-mac.yml` / `latest.yml` / `latest-linux.yml` from the **latest** release
to learn the newest version and where to download it; the `.blockmap` enables
differential (delta) downloads. **If you upload only the installers, auto-update
silently does nothing.** Always include the metadata.

## Download links

Direct links resolve against whatever is attached to the latest release:

```
https://github.com/nnitiwe-dev/prism-documents/releases/latest/download/<asset-name>
```

GitHub replaces spaces in asset names with `.`, so `PRISM Documents-0.1.0-x64.dmg`
is served as `PRISM.Documents-0.1.0-x64.dmg`. The README's download table uses
these. Because the version is in the filename, the direct links change each
release — the always-correct entry point is the releases page itself:
`…/releases/latest`. (Future builds use hyphenated, space-free names; see
`artifactName` in `electron-builder.yml`.)

## Code signing (not yet configured)

Until the app is signed, users see OS warnings and must bypass them (documented
in the README). To remove the friction later:

- **macOS** — an Apple *Developer ID Application* certificate + notarization
  (`afterSign` notarize step). Required for Gatekeeper to run a downloaded app
  without the right-click→Open dance, and for macOS auto-update to apply.
- **Windows** — an Authenticode code-signing certificate to clear SmartScreen.
- **Linux** — no signing requirement; AppImage just needs the executable bit.

## Checklist per release

1. Bump `version` in `desktop/package.json` and `backend/pyproject.toml`; update `CHANGELOG.md`.
2. `./scripts/build-backend.sh` (rebuild the bundled backend).
3. Build + publish per OS (automated or manual above).
4. Verify the release has installers **and** `latest*.yml` + `.blockmap`.
5. Update the README download table if asset names changed.
6. Publish the draft release.
