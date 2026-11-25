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

// Blocca istanze duplicate del software
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let serverProcess = null;
let activePort = 3000;
let isQuitting = false;

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

function findAvailablePort(preferredPort = 3000) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => {
      const fallback = net.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const chosen = typeof addr === 'object' && addr ? addr.port : 3030;
        fallback.close(() => resolve(chosen));
      });
    });
    tester.once('listening', () => {
      tester.close(() => resolve(preferredPort));
    });
    tester.listen(preferredPort, '127.0.0.1');
  });
}

function waitForServerReady(port, timeoutMs = 20000) {
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
          if (res.statusCode && res.statusCode < 500) {
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

function resolveAppPaths() {
  const appPath = app.getAppPath();
  // In modalità pacchettizzata (asar), i file server e dist sono unpacked o accanto all'asar
  const unpackedBase = appPath.endsWith('.asar')
    ? appPath.replace(/\.asar$/, '.asar.unpacked')
    : appPath;

  const candidateServers = [
    path.join(unpackedBase, 'dist-electron', 'server.mjs'),
    path.join(appPath, 'dist-electron', 'server.mjs'),
    path.join(process.resourcesPath || appPath, 'dist-electron', 'server.mjs'),
  ];
  const serverEntry = candidateServers.find((p) => fs.existsSync(p));

  const candidateDists = [
    path.join(unpackedBase, 'dist'),
    path.join(appPath, 'dist'),
    path.join(process.resourcesPath || appPath, 'dist'),
  ];
  const distDir = candidateDists.find((p) => fs.existsSync(p)) || candidateDists[0];

  return { serverEntry, distDir, appPath, unpackedBase };
}

async function startEmbeddedServer() {
  const { serverEntry, distDir, unpackedBase } = resolveAppPaths();
  if (!serverEntry) {
    throw new Error(
      'Bundle server interno non trovato (dist-electron/server.mjs). Esegui prima la compilazione desktop.'
    );
  }

  const dataDir = getDataDirectory();
  fs.mkdirSync(dataDir, { recursive: true });
  activePort = await findAvailablePort(3000);

  const childEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: 'production',
    PORT: String(activePort),
    METATRON_DATA_DIR: dataDir,
    METATRON_DIST_DIR: distDir,
    METATRON_DESKTOP_MODE: '1',
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: unpackedBase,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[METATRON Server] ${chunk}`);
  });
  serverProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[METATRON Server ERR] ${chunk}`);
  });
  serverProcess.on('exit', (code) => {
    serverProcess = null;
    if (!isQuitting && code !== 0) {
      dialog.showErrorBox(
        'METATRON Desktop — Arresto imprevisto',
        `Il motore interno si è arrestato (codice ${code}). Riavvia il software.`
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
              message: 'METATRON CaricoStudio Desktop',
              detail:
                `Versione software autonomo (Windows / Mac / Linux)\n` +
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
    tray.setToolTip(`METATRON Desktop (porta ${activePort})`);
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

  // Sicurezza navigazione: consenti solo la origin locale del server embedded
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

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    await startEmbeddedServer();
    buildApplicationMenu();
    setupSystemTray();
    createMainWindow();
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
  stopEmbeddedServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    stopEmbeddedServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
