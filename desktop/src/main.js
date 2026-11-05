// Riff for desktop.
//
// This is a thin shell around the Riff web app, not a second implementation of
// it: the window loads https://riff.soundrig.io, so the desktop build can never
// drift from the website. The only desktop-specific behaviour lives here —
// window state, an offline screen, link handling, and the app menu.

const { app, BrowserWindow, Menu, shell, nativeTheme } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

// Same production backend the mobile app talks to (mobile/src/config/env.ts).
// Override for development: `npm run start:local`, or --url=<origin>.
const DEFAULT_URL = "https://riff.soundrig.io";
const urlArg = process.argv.find((a) => a.startsWith("--url="));
const APP_URL = (urlArg ? urlArg.slice("--url=".length) : process.env.RIFF_URL || DEFAULT_URL).replace(/\/+$/, "");
const APP_ORIGIN = new URL(APP_URL).origin;

// Brand background (colors.background in mobile/src/theme/tokens.ts) so the
// window never flashes white before the page paints.
const BACKGROUND = "#0a0a0f";

const WINDOW_STATE_FILE = path.join(app.getPath("userData"), "window-state.json");
const DEFAULT_BOUNDS = { width: 1280, height: 860 };

/** @type {BrowserWindow | null} */
let mainWindow = null;

function readWindowState() {
  try {
    const saved = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, "utf8"));
    if (typeof saved.width === "number" && typeof saved.height === "number") return saved;
  } catch {
    // First run, or the file was removed/corrupted — fall back to the default size.
  }
  return { ...DEFAULT_BOUNDS };
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const state = { ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() };
  try {
    fs.mkdirSync(path.dirname(WINDOW_STATE_FILE), { recursive: true });
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state));
  } catch {
    // Window position is a convenience; failing to persist it must never crash the app.
  }
}

function showOfflinePage() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  // The page needs the app URL to offer a working "Try again".
  void mainWindow.loadFile(path.join(__dirname, "offline.html"), { query: { url: APP_URL } });
}

/** Links to other sites open in the real browser, never inside the app window. */
function isAppUrl(target) {
  try {
    return new URL(target).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function openExternal(target) {
  if (/^https?:$/.test(new URL(target).protocol)) void shell.openExternal(target);
}

function createWindow() {
  const state = readWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: BACKGROUND,
    title: "Riff",
    autoHideMenuBar: process.platform !== "darwin",
    show: false,
    webPreferences: {
      // The window only ever shows our own site, but it is still remote content:
      // keep it fully isolated from Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  if (state.maximized) mainWindow.maximize();

  // Avoid a flash of empty window while the first paint happens.
  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.on("close", saveWindowState);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // target="_blank" and window.open → system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: "allow" };
    openExternal(url);
    return { action: "deny" };
  });

  // Clicking an off-site link navigates the browser, not the app window.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  // The app needs none of these; the Android build blocks the same ones.
  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["notifications", "clipboard-sanitized-write", "fullscreen"].includes(permission));
  });

  // Network down, DNS failure, server unreachable → offline screen instead of
  // Chromium's error page. -3 is ABORTED, which fires on ordinary navigations.
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _desc, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) showOfflinePage();
  });

  void mainWindow.loadURL(APP_URL);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  /** @type {import("electron").MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+Shift+H",
          click: () => mainWindow && void mainWindow.loadURL(APP_URL),
        },
        {
          label: "Open in Browser",
          click: () => {
            const current = mainWindow?.webContents.getURL();
            if (current && /^https?:/.test(current)) void shell.openExternal(current);
          },
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
        { role: "toggleDevTools" },
      ],
    },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Two copies of the app would mean two sessions; focus the open one instead.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  void app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    buildMenu();
    createWindow();

    // macOS: clicking the dock icon with no windows open reopens one.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
