// WikiSpin desktop shell: serves the Expo web build from a private app:// origin
// inside an Electron window sized like a phone.
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const WEB_ROOT = path.join(__dirname, 'web');
const SCHEME = 'app';
const ORIGIN = `${SCHEME}://wikispin`;

// Must run before "ready": a standard, secure scheme gets its own origin,
// so localStorage (saved articles, history) persists between launches.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

/** Map an app:// URL to a file in the web build; unknown paths fall back to index.html (single-page app). */
function resolveFile(requestUrl) {
  const { pathname } = new URL(requestUrl);
  const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidate = path.normalize(path.join(WEB_ROOT, relative));
  if (candidate.startsWith(WEB_ROOT) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  return path.join(WEB_ROOT, 'index.html');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    title: 'WikiSpin',
    backgroundColor: '#EEF1F8',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  // Article links and anything else that tries to open a window go to the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(ORIGIN)) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
    }
  });

  win.loadURL(`${ORIGIN}/`);
  return win;
}

// Identify the app to Wikimedia's APIs (their User-Agent policy), keeping the browser UA in front.
app.userAgentFallback = `${app.userAgentFallback} WikiSpin/${app.getVersion()}`;

app.whenReady().then(() => {
  protocol.handle(SCHEME, (request) => net.fetch(pathToFileURL(resolveFile(request.url)).toString()));
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
