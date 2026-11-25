'use strict';

const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  shell,
  dialog,
  ipcMain,
  clipboard,
} = require('electron');

let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch {
  autoUpdater = null;
}

// Blocca istanze duplicate del software
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

const SAFE_REPO_PART_RE = /^[A-Za-z0-9_.-]{1,100}$/;

let mainWindow = null;
let tray = null;
let serverProcess = null;
let activePort = 3000;
let isQuitting = false;
let updateCheckTimer = null;

const isPortableBuild = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);

let updaterState = {
  status: autoUpdater && !isPortableBuild ? 'idle' : 'unsupported',
  currentVersion: app.getVersion() || '1.0.0',
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  percent: 0,
  bytesPerSecond: 0,
  transferred: 0,
  total: 0,
  error: null,
  isPortable: isPortableBuild,
  repoSlug: null,
};

function getDataDirectory() {
  return path.join(app.getPath('userData'), 'data');
}

function getLocalLanAddresses() {
  const result = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const info of nets[name] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        result.push(info.address);
      }
    }
  }
  return result;
}

function parseRepoSlug(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const parts = cleaned.split('/');
  if (parts.length !== 2) return null;
  const [owner, repo] = parts;
  if (!SAFE_REPO_PART_RE.test(owner) || !SAFE_REPO_PART_RE.test(repo)) return null;
  return { owner, repo, slug: `${owner}/${repo}` };
}

function resolveConfiguredGithubRepo(overrideSlug) {
  const fromOverride = parseRepoSlug(overrideSlug);
  if (fromOverride) return fromOverride;

  // 1. Configurazione salvata dall'utente nella cartella dati persistente
  try {
    const userCfgPath = path.join(getDataDirectory(), 'server_update_config.json');
    if (fs.existsSync(userCfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(userCfgPath, 'utf-8'));
      const fromUser = parseRepoSlug(parsed && parsed.githubRepo);
      if (fromUser) return fromUser;
    }
  } catch {
    // ignore
  }

  // 2. Configurazione pre-compilata automaticamente da GitHub Actions
  const appPath = app.getAppPath();
  const resourcesBase = process.resourcesPath || appPath;
  const unpackedBase = appPath.endsWith('.asar')
    ? appPath.replace(/\.asar$/, '.asar.unpacked')
    : appPath;
  const candidateConfigs = [
    path.join(resourcesBase, 'desktop-app', 'update-config.json'),
    path.join(unpackedBase, 'desktop-app', 'update-config.json'),
    path.join(appPath, 'desktop-app', 'update-config.json'),
  ];
  for (const p of candidateConfigs) {
    try {
      if (fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (parsed && parsed.owner && parsed.repo) {
          const parsedSlug = parseRepoSlug(`${parsed.owner}/${parsed.repo}`);
          if (parsedSlug) return parsedSlug;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function broadcastUpdaterState(patch) {
  updaterState = { ...updaterState, ...patch };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('metatron:update-state', updaterState);
  }
}

function normalizeReleaseNotes(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+\n/g, '\n').trim().slice(0, 4000);
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item : item && item.note ? String(item.note) : ''))
      .filter(Boolean)
      .join('\n\n')
      .replace(/<[^>]+>/g, ' ')
      .trim()
      .slice(0, 4000);
  }
  return null;
}

function initAutoUpdater() {
  if (!autoUpdater || isPortableBuild) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    broadcastUpdaterState({ status: 'checking', error: null });
  });

  autoUpdater.on('update-available', (info) => {
    broadcastUpdaterState({
      status: 'available',
      availableVersion: info && info.version ? String(info.version) : null,
      releaseNotes: normalizeReleaseNotes(info && info.releaseNotes),
      releaseDate: info && info.releaseDate ? String(info.releaseDate) : null,
      error: null,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    broadcastUpdaterState({
      status: 'not-available',
      availableVersion: info && info.version ? String(info.version) : updaterState.currentVersion,
      error: null,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    broadcastUpdaterState({
      status: 'downloading',
      percent: progress && typeof progress.percent === 'number' ? progress.percent : 0,
      bytesPerSecond: progress && progress.bytesPerSecond ? progress.bytesPerSecond : 0,
      transferred: progress && progress.transferred ? progress.transferred : 0,
      total: progress && progress.total ? progress.total : 0,
      error: null,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdaterState({
      status: 'downloaded',
      percent: 100,
      availableVersion:
        (info && info.version ? String(info.version) : null) || updaterState.availableVersion,
      releaseNotes:
        normalizeReleaseNotes(info && info.releaseNotes) || updaterState.releaseNotes,
      error: null,
    });
  });

  autoUpdater.on('error', (err) => {
    broadcastUpdaterState({
      status: 'error',
      error: err && err.message ? String(err.message).slice(0, 300) : 'Errore updater desktop.',
    });
  });
}

async function runDesktopUpdateCheck(overrideSlug) {
  if (!autoUpdater || isPortableBuild) {
    return updaterState;
  }
  const repoInfo = resolveConfiguredGithubRepo(overrideSlug);
  if (!repoInfo) {
    broadcastUpdaterState({
      status: 'idle',
      repoSlug: null,
      error: null,
    });
    return updaterState;
  }
  try {
    broadcastUpdaterState({ repoSlug: repoInfo.slug, error: null });
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      releaseType: 'release',
    });
    await autoUpdater.checkForUpdates();
  } catch (err) {
    broadcastUpdaterState({
      status: 'error',
      error: err && err.message ? String(err.message).slice(0, 300) : 'Controllo fallito.',
    });
  }
  return updaterState;
}

function findAvailablePort(preferredPort = 3000) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      const fallback = net.createServer();
      fallback.listen(0, '0.0.0.0', () => {
        const addr = fallback.address();
        const chosen = typeof addr === 'object' && addr ? addr.port : 3030;
        fallback.close(() => resolve(chosen));
      });
    });
    tester.once('listening', () => {
      tester.close(() => resolve(preferredPort));
    });
    tester.listen(preferredPort, '0.0.0.0');
  });
}

function waitForServerReady(port, timeoutMs = 25000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port,
          path: '/api/auth/status',
          timeout: 1500,
        },
        (res) => {
          res.resume();
          if (res.statusCode === 200) {
            resolve();
          } else {
            retry();
          }
        }
      );
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('Timeout avvio server interno METATRON.'));
        return;
      }
      setTimeout(check, 250);
    };

    check();
  });
}

function isOutsideAsar(p) {
  return Boolean(p) && !p.includes(`.asar${path.sep}`);
}

function resolveAppPaths() {
  const appPath = app.getAppPath();
  const unpackedBase = appPath.endsWith('.asar')
    ? appPath.replace(/\.asar$/, '.asar.unpacked')
    : appPath;
  const resourcesBase = process.resourcesPath || appPath;

  const candidateServers = [
    path.join(resourcesBase, 'dist-electron', 'server.cjs'),
    path.join(unpackedBase, 'dist-electron', 'server.cjs'),
    path.join(appPath, 'dist-electron', 'server.cjs'),
    path.join(resourcesBase, 'dist-electron', 'server.mjs'),
    path.join(unpackedBase, 'dist-electron', 'server.mjs'),
    path.join(appPath, 'dist-electron', 'server.mjs'),
  ];
  const serverEntry =
    candidateServers.find((p) => isOutsideAsar(p) && fs.existsSync(p)) ||
    candidateServers.find((p) => fs.existsSync(p));

  const candidateDists = [
    path.join(resourcesBase, 'dist-electron', 'web'),
    path.join(unpackedBase, 'dist-electron', 'web'),
    path.join(appPath, 'dist-electron', 'web'),
    path.join(resourcesBase, 'dist'),
    path.join(unpackedBase, 'dist'),
    path.join(appPath, 'dist'),
  ];
  const distDir =
    candidateDists.find(
      (p) => isOutsideAsar(p) && fs.existsSync(path.join(p, 'index.html'))
    ) ||
    candidateDists.find((p) => fs.existsSync(path.join(p, 'index.html'))) ||
    candidateDists[0];

  const safeCwd = fs.existsSync(path.join(resourcesBase, 'dist-electron'))
    ? resourcesBase
    : fs.existsSync(unpackedBase)
    ? unpackedBase
    : path.dirname(serverEntry || appPath);

  return { serverEntry, distDir, appPath, unpackedBase, safeCwd };
}

async function startEmbeddedServer() {
  const { serverEntry, distDir, safeCwd } = resolveAppPaths();
  if (!serverEntry) {
    throw new Error(
      'Bundle server interno non trovato (dist-electron/server.cjs). Esegui prima la compilazione desktop.'
    );
  }

  const dataDir = getDataDirectory();
  fs.mkdirSync(dataDir, { recursive: true });
  const startupLogPath = path.join(dataDir, 'desktop-startup.log');
  const recentStderr = [];

  const appendLog = (line) => {
    try {
      fs.appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${line}\n`, 'utf-8');
    } catch {
      // ignore
    }
  };

  try {
    fs.writeFileSync(
      startupLogPath,
      `[${new Date().toISOString()}] Avvio METATRON Desktop v${app.getVersion() || '1.0.0'} (${process.platform} ${process.arch})\n` +
        `serverEntry=${serverEntry}\ndistDir=${distDir}\ncwd=${safeCwd}\n`,
      'utf-8'
    );
  } catch {
    // ignore
  }

  activePort = await findAvailablePort(3000);
  const configuredRepo = resolveConfiguredGithubRepo();

  const childEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(activePort),
    METATRON_DATA_DIR: dataDir,
    METATRON_DIST_DIR: distDir,
    METATRON_DESKTOP_MODE: '1',
    METATRON_APP_VERSION: app.getVersion() || '1.0.0',
    ...(configuredRepo ? { METATRON_GITHUB_REPO: configuredRepo.slug } : {}),
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: safeCwd,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    process.stdout.write(`[METATRON Server] ${text}`);
    appendLog(`[OUT] ${text.trimEnd()}`);
  });
  serverProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    process.stderr.write(`[METATRON Server ERR] ${text}`);
    appendLog(`[ERR] ${text.trimEnd()}`);
    recentStderr.push(text.trim());
    if (recentStderr.length > 12) recentStderr.shift();
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    appendLog(`Server terminato con codice ${code}`);
    if (!isQuitting && code !== 0) {
      const detail = recentStderr.length > 0 ? `\n\nDettaglio:\n${recentStderr.join('\n').slice(0, 700)}` : '';
      dialog.showErrorBox(
        'METATRON Desktop — Arresto imprevisto',
        `Il motore interno si è arrestato (codice ${code}).${detail}\n\nLog completo: ${startupLogPath}`
      );
      app.quit();
    }
  });

  await waitForServerReady(activePort);
}

function stopEmbeddedServer() {
  if (!serverProcess) return;
  try {
    serverProcess.kill('SIGTERM');
  } catch {
    // ignore
  }
  serverProcess = null;
}

function isSafeExternalUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getAppIconPath() {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, 'public', 'pwa-512x512.png'),
    path.join(appPath, 'dist', 'pwa-512x512.png'),
  ];
  return candidates.find((p) => fs.existsSync(p));
}

function buildApplicationMenu() {
  const lanIps = getLocalLanAddresses();
  const lanUrl = lanIps[0]
    ? `http://${lanIps[0]}:${activePort}`
    : `http://localhost:${activePort}`;

  const template = [
    {
      label: 'METATRON',
      submenu: [
        {
          label: 'Verifica Aggiornamenti',
          click: () => {
            runDesktopUpdateCheck().catch(() => {});
          },
        },
        {
          label: 'Apri Cartella Dati & Backup',
          click: () => shell.openPath(getDataDirectory()),
        },
        {
          label: `Copia Indirizzo Rete LAN (${lanUrl})`,
          click: () => {
            clipboard.writeText(lanUrl);
          },
        },
        { type: 'separator' },
        {
          label: 'Ricarica Interfaccia',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.reload(),
        },
        {
          label: 'Schermo Intero',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          click: () => {
            if (mainWindow) {
              mainWindow.setFullScreen(!mainWindow.isFullScreen());
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Esci da METATRON',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Modifica',
      submenu: [
        { role: 'undo', label: 'Annulla' },
        { role: 'redo', label: 'Ripeti' },
        { type: 'separator' },
        { role: 'cut', label: 'Taglia' },
        { role: 'copy', label: 'Copia' },
        { role: 'paste', label: 'Incolla' },
        { role: 'selectAll', label: 'Seleziona Tutto' },
      ],
    },
    {
      label: 'Visualizza',
      submenu: [
        { role: 'resetZoom', label: 'Zoom Normale' },
        { role: 'zoomIn', label: 'Ingrandisci' },
        { role: 'zoomOut', label: 'Riduci' },
      ],
    },
    {
      label: 'Aiuto',
      submenu: [
        {
          label: 'Informazioni su METATRON Desktop',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'METATRON — CaricoStudio Desktop',
              message: `METATRON CaricoStudio Desktop v${app.getVersion() || '1.0.0'}`,
              detail:
                `Server interno attivo su: http://localhost:${activePort}\n` +
                `Indirizzo rete LAN: ${lanUrl}\n` +
                `Cartella dati locale: ${getDataDirectory()}`,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupSystemTray() {
  const iconPath = getAppIconPath();
  if (!iconPath) return;
  try {
    const img = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
    tray = new Tray(img);
    tray.setToolTip(`METATRON Desktop v${app.getVersion() || '1.0.0'} (porta ${activePort})`);
    const lanIps = getLocalLanAddresses();
    const lanUrl = lanIps[0]
      ? `http://${lanIps[0]}:${activePort}`
      : `http://localhost:${activePort}`;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Apri METATRON Desktop',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Verifica Aggiornamenti',
        click: () => runDesktopUpdateCheck().catch(() => {}),
      },
      {
        label: `Copia link rete LAN (${lanUrl})`,
        click: () => clipboard.writeText(lanUrl),
      },
      {
        label: 'Apri Cartella Dati',
        click: () => shell.openPath(getDataDirectory()),
      },
      { type: 'separator' },
      {
        label: 'Chiudi completamente METATRON',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch {
    // Tray non supportato su alcuni desktop Linux minimali
  }
}

function createMainWindow() {
  const appOrigin = `http://127.0.0.1:${activePort}`;
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'METATRON — CaricoStudio Desktop',
    backgroundColor: '#090b16',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(appOrigin)) {
      event.preventDefault();
      if (isSafeExternalUrl(targetUrl)) {
        shell.openExternal(targetUrl);
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(appOrigin) || url.startsWith('blob:')) {
      return { action: 'allow' };
    }
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(appOrigin);
}

// IPC sicuri e limitati per il renderer desktop
ipcMain.handle('metatron:open-data-folder', async () => {
  await shell.openPath(getDataDirectory());
  return { ok: true };
});

ipcMain.handle('metatron:get-network-info', async () => {
  const lanIps = getLocalLanAddresses();
  return {
    port: activePort,
    localUrl: `http://localhost:${activePort}`,
    lanUrls: lanIps.map((ip) => `http://${ip}:${activePort}`),
    dataDir: getDataDirectory(),
  };
});

ipcMain.handle('metatron:updater-get-state', async () => {
  return updaterState;
});

ipcMain.handle('metatron:updater-check', async (_event, repoSlug) => {
  return await runDesktopUpdateCheck(typeof repoSlug === 'string' ? repoSlug : undefined);
});

ipcMain.handle('metatron:updater-download', async () => {
  if (!autoUpdater || isPortableBuild) {
    return {
      ok: false,
      error: 'Download automatico supportato solo nella versione Setup installata.',
    };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err && err.message ? String(err.message).slice(0, 300) : 'Download fallito.',
    };
  }
});

ipcMain.handle('metatron:updater-install-restart', async () => {
  if (!autoUpdater || isPortableBuild || updaterState.status !== 'downloaded') {
    return { ok: false, error: 'Nessun aggiornamento pronto per il riavvio.' };
  }
  try {
    isQuitting = true;
    stopEmbeddedServer();
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true };
  } catch (err) {
    isQuitting = false;
    return {
      ok: false,
      error: err && err.message ? String(err.message).slice(0, 300) : 'Riavvio fallito.',
    };
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    initAutoUpdater();
    await startEmbeddedServer();
    buildApplicationMenu();
    setupSystemTray();
    createMainWindow();

    // Controllo aggiornamenti automatico all'avvio (dopo 15s) e ogni 60 minuti
    if (autoUpdater && !isPortableBuild) {
      setTimeout(() => runDesktopUpdateCheck().catch(() => {}), 15000);
      updateCheckTimer = setInterval(() => {
        runDesktopUpdateCheck().catch(() => {});
      }, 60 * 60 * 1000);
    }
  } catch (err) {
    dialog.showErrorBox(
      'Errore avvio METATRON Desktop',
      err && err.message ? err.message : String(err)
    );
    stopEmbeddedServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  stopEmbeddedServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    if (updateCheckTimer) clearInterval(updateCheckTimer);
    stopEmbeddedServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
