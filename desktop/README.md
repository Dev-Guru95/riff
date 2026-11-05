# Riff for desktop

An Electron shell around the Riff web app, packaged as an installer for Windows
and macOS.

This is deliberately **not** a second implementation of Riff. The window loads
`https://riff.soundrig.io` — the same deployment the website and the mobile app
talk to — so the desktop build gets every web feature and can never drift from
the site. Shipping a web change ships it to the desktop app too; the installer
only needs rebuilding when something in `src/` here changes.

An internet connection is required. There is no offline mode.

## Layout

| File | Purpose |
| --- | --- |
| `src/main.js` | The whole app: window, state, link handling, menu, offline fallback |
| `src/offline.html` | Shown when the site can't be reached, with a retry that reconnects automatically |
| `electron-builder.yml` | Packaging targets for Windows, macOS and Linux |
| `build/icon.png` | 1024×1024 source icon; `.ico` and `.icns` are generated from it |

## Develop

```bash
npm install
npm start                 # against production (riff.soundrig.io)
npm run start:local       # against a local `pnpm dev` on :3000
npm start -- --url=https://riff-app.onrender.com   # any other deployment
```

## Build

```bash
npm run build:win         # dist/Riff-Setup-<version>.exe   (NSIS installer)
npm run build:mac         # dist/Riff-<version>-<arch>.dmg  — macOS hosts only
npm run build:linux       # dist/Riff-<version>.AppImage
npm run pack              # unpacked app in dist/, no installer — quick to test
```

**A macOS `.dmg` can only be built on macOS.** electron-builder refuses to
produce one from Windows or Linux. Use the `Desktop build` workflow
(`.github/workflows/desktop-build.yml`) — run it from the Actions tab and it
builds both installers on GitHub's runners and attaches them as artifacts.

## Code signing

Both builds are currently **unsigned**, because there is no code-signing
certificate or Apple Developer account configured. Consequences:

- **Windows** — SmartScreen shows "Windows protected your PC" on first run.
  Click _More info_ → _Run anyway_. Fixed by an EV/OV code-signing certificate
  (`CSC_LINK` + `CSC_KEY_PASSWORD`).
- **macOS** — Gatekeeper refuses a double-click. Right-click the app →
  _Open_ → _Open_, once. Fixed by an Apple Developer account: set `identity` in
  `electron-builder.yml` and add notarization.

## Version

`package.json` `version` drives the installer filename and the app version.
It currently tracks the mobile app's `2.0.0`; bump it when you ship a desktop
change.

## Security notes

The window renders remote content, so it runs with `contextIsolation: true`,
`nodeIntegration: false` and `sandbox: true`, and there is no preload bridge —
the page has no access to Node or to the filesystem beyond ordinary browser
APIs. Navigation is pinned to the app's own origin; any other link is handed to
the system browser. Camera, microphone, geolocation and MIDI permission requests
are denied, matching the permissions the Android build blocks. If a future
feature needs one, add it to the allowlist in `setPermissionRequestHandler`.
