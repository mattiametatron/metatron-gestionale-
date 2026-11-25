import { createRequire as __metatronCreateRequire } from 'node:module'; const require = __metatronCreateRequire(import.meta.url);

// server.ts
import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import crypto from "crypto";
import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import PDFDocument from "pdfkit";
import { zipSync } from "fflate";
if (typeof globalThis.__dirname !== "undefined") {
  delete globalThis.__dirname;
}
var parsedPort = Number(process.env.PORT);
var PORT = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3e3;
var DATA_ROOT = process.env.METATRON_DATA_DIR ? path.resolve(process.env.METATRON_DATA_DIR) : path.resolve(process.cwd(), "data");
var DIST_ROOT = process.env.METATRON_DIST_DIR ? path.resolve(process.env.METATRON_DIST_DIR) : path.resolve(process.cwd(), "dist");
var OS_INSTALLER_DIR = path.resolve(process.cwd(), "os-installer");
var DESKTOP_APP_DIR = path.resolve(process.cwd(), "desktop-app");
var SCRIPTS_DIR = path.resolve(process.cwd(), "scripts");
var WORKFLOWS_DIR = path.resolve(process.cwd(), ".github", "workflows");
var BACKUPS_DIR = path.join(DATA_ROOT, "backups");
var USERS_FILE = path.join(DATA_ROOT, "server_users.json");
var SESSIONS_FILE = path.join(DATA_ROOT, "server_sessions.json");
var EMPLOYER_CONFIG_FILE = path.join(DATA_ROOT, "server_employer_config.json");
var SHARES_INDEX_FILE = path.join(DATA_ROOT, "server_shares.json");
var CALENDARS_FILE = path.join(DATA_ROOT, "server_calendars.json");
var CALENDAR_EVENTS_FILE = path.join(DATA_ROOT, "server_calendar_events.json");
var NOTIFICATIONS_FILE = path.join(DATA_ROOT, "server_notifications.json");
var SYSTEM_SETTINGS_FILE = path.join(DATA_ROOT, "server_system_settings.json");
var SHARED_FILES_DIR = path.join(DATA_ROOT, "shared_files");
var USERS_DIR = path.join(DATA_ROOT, "users");
var SAFE_BACKUP_FILENAME_RE = /^metatron-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/;
var SAFE_SESSION_PREFIX_RE = /^[a-f0-9]{12}$/;
var DEPLOY_ARTIFACT_BASE_DIRS = {
  os_installer: OS_INSTALLER_DIR,
  desktop_app: DESKTOP_APP_DIR,
  scripts: SCRIPTS_DIR,
  workflows: WORKFLOWS_DIR
};
var DEPLOY_ARTIFACT_PATH_PREFIX = {
  os_installer: "os-installer",
  desktop_app: "desktop-app",
  scripts: "scripts",
  workflows: ".github/workflows"
};
var ALLOWED_DEPLOY_ARTIFACTS = {
  installer: {
    base: "os_installer",
    fileName: "install-metatron-os.sh",
    title: "Installer Bare-Metal & Kiosk (Debian/Ubuntu)",
    description: "Trasforma Debian 12 / Ubuntu Server in METATRON Server OS con servizio systemd, firewall UFW e opzione Kiosk a tutto schermo.",
    category: "installer"
  },
  iso_builder: {
    base: "os_installer",
    fileName: "build-metatron-iso.sh",
    title: "Generatore ISO Avviabile da USB (live-build)",
    description: "Compila l\u2019immagine metatron-os-amd64.iso avviabile da chiavetta USB con Debian Bookworm + METATRON OS preinstallato.",
    category: "iso"
  },
  systemd: {
    base: "os_installer",
    fileName: "metatron-os.service",
    title: "Unit\xE0 systemd (avvio automatico)",
    description: "Servizio Linux con permessi isolati, riavvio automatico e storage persistente in /var/lib/metatron.",
    category: "systemd"
  },
  dockerfile: {
    base: "os_installer",
    fileName: "Dockerfile",
    title: "Dockerfile di produzione",
    description: "Immagine container pronta per deploy su server Docker / Proxmox / NAS.",
    category: "docker"
  },
  compose: {
    base: "os_installer",
    fileName: "docker-compose.yml",
    title: "Docker Compose",
    description: "Configurazione multi-ambiente con volume persistente e riavvio automatico.",
    category: "docker"
  },
  guide: {
    base: "os_installer",
    fileName: "README-INSTALL.md",
    title: "Guida Installazione & Creazione ISO",
    description: "Istruzioni passo-passo in italiano per installazione su server fisico, modalit\xE0 Kiosk e creazione chiavetta USB.",
    category: "docs"
  },
  desktop_win_bat: {
    base: "desktop_app",
    fileName: "CREA-SOFTWARE-WINDOWS.bat",
    title: "Generatore 1-Clic Windows (.exe Setup + Portable)",
    description: "Fai doppio clic su Windows: compila METATRON-CaricoStudio-Setup.exe e METATRON-CaricoStudio-Portable.exe pronto da zippare.",
    category: "desktop"
  },
  desktop_readme: {
    base: "desktop_app",
    fileName: "README-DESKTOP.md",
    title: "Guida Software Desktop (.exe / Mac / Linux)",
    description: "Istruzioni semplici per compilare sul PC o nel cloud su GitHub e inviare l\u2019eseguibile in uno ZIP.",
    category: "desktop"
  },
  desktop_main: {
    base: "desktop_app",
    fileName: "main.cjs",
    title: "Motore Desktop Electron (main.cjs)",
    description: "Avvia automaticamente il server interno, apre la finestra desktop, gestisce tray icon e cartella dati locale.",
    category: "desktop"
  },
  desktop_preload: {
    base: "desktop_app",
    fileName: "preload.cjs",
    title: "Bridge Sicuro Desktop (preload.cjs)",
    description: "Espone API sicure isolate (contextIsolation) per aprire la cartella dati e leggere l\u2019indirizzo LAN.",
    category: "desktop"
  },
  desktop_builder_cfg: {
    base: "desktop_app",
    fileName: "electron-builder.json",
    title: "Configurazione Pacchetti (.exe / .dmg / .AppImage)",
    description: "Configura installer Windows NSIS, eseguibile Portable, macOS DMG e Linux AppImage/DEB.",
    category: "desktop"
  },
  desktop_mac_linux: {
    base: "desktop_app",
    fileName: "build-desktop-mac-linux.sh",
    title: "Script Build macOS & Linux",
    description: "Compila il software nativo .dmg su Mac o .AppImage / .deb su Linux con un solo comando.",
    category: "desktop"
  },
  desktop_server_bundler: {
    base: "scripts",
    fileName: "build-desktop-server.mjs",
    title: "Bundler Server Interno (esbuild)",
    description: "Compila server.ts in dist-electron/server.mjs per funzionare dentro il software .exe senza Vite.",
    category: "desktop"
  },
  desktop_github_workflow: {
    base: "workflows",
    fileName: "build-desktop.yml",
    title: "Workflow Cloud GitHub Actions (.exe/.dmg/.AppImage)",
    description: "Genera automaticamente gli eseguibili per Windows, Mac e Linux direttamente nel cloud senza installare nulla.",
    category: "desktop"
  }
};
var LEGACY_LOADS_FILE = path.join(DATA_ROOT, "server_loads.json");
var LEGACY_INVENTORY_FILE = path.join(DATA_ROOT, "server_inventory.json");
var LEGACY_PHOTOS_INDEX_FILE = path.join(DATA_ROOT, "server_photos.json");
var LEGACY_PHOTOS_DIR = path.join(DATA_ROOT, "photos");
var LEGACY_FILES_INDEX_FILE = path.join(DATA_ROOT, "server_files.json");
var LEGACY_FILES_DIR = path.join(DATA_ROOT, "files");
var SAFE_USER_ID_RE = /^usr_[a-f0-9]{12,32}$/;
var SAFE_PHOTO_ID_RE = /^[a-zA-Z0-9_-]{3,80}$/;
var SAFE_FILE_ID_RE = /^[a-zA-Z0-9_-]{3,90}$/;
var SAFE_SHARE_ID_RE = /^shr_[a-f0-9]{12,32}$/;
var SAFE_CAL_ID_RE = /^cal_[a-zA-Z0-9_-]{6,48}$/;
var SAFE_EVT_ID_RE = /^evt_[a-f0-9]{12,32}$/;
var SAFE_NOTIF_ID_RE = /^ntf_[a-f0-9]{12,32}$/;
var SAFE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var SAFE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
var ALLOWED_CAL_COLORS = /* @__PURE__ */ new Set([
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6"
]);
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
function assertSafeChildPath(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error("Percorso file non consentito");
  }
  return resolvedTarget;
}
function getUserPaths(userId) {
  if (!SAFE_USER_ID_RE.test(userId)) {
    throw new Error("ID utente non valido");
  }
  const userDir = assertSafeChildPath(USERS_DIR, path.join(USERS_DIR, userId));
  return {
    userDir,
    loadsFile: assertSafeChildPath(userDir, path.join(userDir, "loads.json")),
    inventoryFile: assertSafeChildPath(userDir, path.join(userDir, "inventory.json")),
    photosIndexFile: assertSafeChildPath(userDir, path.join(userDir, "photos.json")),
    photosDir: assertSafeChildPath(userDir, path.join(userDir, "photos")),
    filesIndexFile: assertSafeChildPath(userDir, path.join(userDir, "files.json")),
    filesDir: assertSafeChildPath(userDir, path.join(userDir, "files"))
  };
}
function toPublicUser(u) {
  return {
    id: u.id,
    name: u.name,
    company: u.company || void 0,
    email: u.email,
    role: u.role === "employer" ? "employer" : "worker",
    createdAt: u.createdAt
  };
}
function safeCompareSecret(a, b) {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function getSafeDownloadHeaders(mimeType, fileName) {
  const cleanMime = String(mimeType || "").toLowerCase().trim();
  const safeInlineMimes = /* @__PURE__ */ new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf"
  ]);
  const encodedName = encodeURIComponent(fileName || "file");
  if (safeInlineMimes.has(cleanMime)) {
    return {
      contentType: cleanMime === "image/jpg" ? "image/jpeg" : cleanMime,
      disposition: `inline; filename="${encodedName}"`
    };
  }
  return {
    contentType: "application/octet-stream",
    disposition: `attachment; filename="${encodedName}"`
  };
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
function hashSessionToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}
function readJsonFile(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn(`[CaricoStudio] Errore lettura ${path.basename(filePath)}:`, err);
  }
  return fallback;
}
function writeJsonFile(filePath, data) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`[CaricoStudio] Errore salvataggio ${path.basename(filePath)}:`, err);
  }
}
function copyDirectoryContents(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(dstDir);
  for (const entry of fs.readdirSync(srcDir)) {
    const srcPath = path.join(srcDir, entry);
    const dstPath = path.join(dstDir, entry);
    const stat = fs.statSync(srcPath);
    if (stat.isFile() && !fs.existsSync(dstPath)) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}
function migrateLegacyDataToFirstUser(userId) {
  try {
    const paths = getUserPaths(userId);
    ensureDir(paths.userDir);
    if (fs.existsSync(LEGACY_LOADS_FILE) && !fs.existsSync(paths.loadsFile)) {
      fs.copyFileSync(LEGACY_LOADS_FILE, paths.loadsFile);
    }
    if (fs.existsSync(LEGACY_INVENTORY_FILE) && !fs.existsSync(paths.inventoryFile)) {
      fs.copyFileSync(LEGACY_INVENTORY_FILE, paths.inventoryFile);
    }
    if (fs.existsSync(LEGACY_PHOTOS_INDEX_FILE) && !fs.existsSync(paths.photosIndexFile)) {
      fs.copyFileSync(LEGACY_PHOTOS_INDEX_FILE, paths.photosIndexFile);
    }
    if (fs.existsSync(LEGACY_FILES_INDEX_FILE) && !fs.existsSync(paths.filesIndexFile)) {
      fs.copyFileSync(LEGACY_FILES_INDEX_FILE, paths.filesIndexFile);
    }
    copyDirectoryContents(LEGACY_PHOTOS_DIR, paths.photosDir);
    copyDirectoryContents(LEGACY_FILES_DIR, paths.filesDir);
    console.log(`[CaricoStudio] Dati pre-esistenti migrati nell'account principale ${userId}`);
  } catch (err) {
    console.warn("[CaricoStudio] Errore migrazione dati legacy:", err);
  }
}
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatItDateTimeServer(iso) {
  if (!iso) return "Non registrata";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return String(iso);
  }
}
function sanitizeCode39Server(input) {
  return String(input || "").toUpperCase().replace(/[^0-9A-Z\-.\s$/+%]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 24);
}
function decodeTrackTokenServer(encoded) {
  if (!encoded || typeof encoded !== "string" || encoded.length > 4096) return null;
  try {
    const buf = Buffer.from(encoded.trim(), "base64url");
    let inflated;
    try {
      inflated = zlib.inflateRawSync(buf);
    } catch {
      inflated = zlib.inflateSync(buf);
    }
    const parsed = JSON.parse(inflated.toString("utf-8"));
    if (!parsed || parsed.v !== 1) return null;
    const type = parsed.t === "p" ? "pallet" : parsed.t === "b" ? "box" : "item";
    const cc = String(parsed.cc || "COM");
    const cd = String(parsed.cd || "COD");
    return {
      type,
      entityId: String(parsed.id || ""),
      code: cd,
      barcodeValue: `${sanitizeCode39Server(cc).slice(0, 10)}-${sanitizeCode39Server(cd).slice(0, 12)}`,
      name: String(parsed.n || "Articolo"),
      commessaCode: cc,
      commessaTitle: String(parsed.ct || "Commessa"),
      client: String(parsed.cl || "\u2014"),
      destination: String(parsed.ds || "\u2014"),
      locationPath: String(parsed.loc || "Non assegnato"),
      palletCode: parsed.p ? String(parsed.p) : null,
      boxCode: parsed.b ? String(parsed.b) : null,
      quantityText: String(parsed.q || `${Number(parsed.qn) || 0} pz`),
      quantityNumber: Number(parsed.qn) || 0,
      weightKg: Number(parsed.w) || 0,
      loadedAt: parsed.ca ? String(parsed.ca) : null,
      shippedAt: parsed.sc ? String(parsed.sc) : null,
      contents: [],
      liveVerified: false
    };
  } catch {
    return null;
  }
}
function enrichTrackRecordFromLoad(base, load, movements) {
  if (!load) return null;
  const pallets = Array.isArray(load.pallets) ? load.pallets : [];
  const boxes = Array.isArray(load.boxes) ? load.boxes : [];
  const items = Array.isArray(load.items) ? load.items : [];
  const palletMap = new Map(pallets.map((p) => [p.id, p]));
  const boxMap = new Map(boxes.map((b) => [b.id, b]));
  const handoverAt = load.handoverProof?.handoverAt || null;
  const findScarico = (target, matchBy) => {
    const cUpper = String(load.code || "").trim().toUpperCase();
    const tUpper = String(target || "").trim().toUpperCase();
    if (!tUpper) return null;
    const hit = movements.find((m) => {
      if (!m || m.type !== "scarico") return false;
      if (cUpper && String(m.commessaCode || "").trim().toUpperCase() !== cUpper) return false;
      return matchBy === "sku" ? String(m.sku || "").trim().toUpperCase() === tUpper : String(m.packageCode || "").trim().toUpperCase() === tUpper;
    });
    return hit?.timestamp || null;
  };
  if (base.type === "pallet") {
    const pallet2 = pallets.find((p) => p.id === base.entityId);
    if (!pallet2) return null;
    const palletBoxes = boxes.filter((b) => b.palletId === pallet2.id);
    const palletBoxIds = new Set(palletBoxes.map((b) => b.id));
    const palletItems = items.filter(
      (it) => it.palletId === pallet2.id || it.boxId && palletBoxIds.has(it.boxId)
    );
    const totalPieces = palletItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const calcW = (Number(pallet2.tareKg) || 0) + palletBoxes.reduce((acc, b) => acc + (Number(b.tareKg) || 0), 0) + palletItems.reduce(
      (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitWeightKg) || 0),
      0
    );
    const grossW = pallet2.customWeightKg !== void 0 && pallet2.customWeightKg !== null ? Number(pallet2.customWeightKg) : calcW;
    const loadedAt2 = pallet2.loadedAt || palletBoxes.find((b) => b.loadedAt)?.loadedAt || palletItems.find((i) => i.loadedAt)?.loadedAt || load.loadedAt || base.loadedAt;
    const shippedAt2 = pallet2.shippedAt || load.shippedAt || handoverAt || findScarico(pallet2.code, "package") || base.shippedAt;
    const slotLabel = pallet2.truckSlot ? `Posto Camion #${pallet2.truckSlot}` : "Area Preparazione Spedizione";
    return {
      ...base,
      code: pallet2.code || base.code,
      name: pallet2.label || base.name,
      commessaTitle: load.title || base.commessaTitle,
      client: load.client || base.client,
      destination: load.destination || base.destination,
      locationPath: `${load.code} > ${pallet2.code} (${slotLabel})`,
      palletCode: pallet2.code || base.palletCode,
      quantityText: `${palletBoxes.length} scatole \xB7 ${totalPieces} pz`,
      quantityNumber: totalPieces,
      weightKg: Math.round(grossW * 100) / 100,
      loadedAt: loadedAt2 || null,
      shippedAt: shippedAt2 || null,
      contents: [
        ...palletBoxes.map((b) => {
          const bItems = items.filter((i) => i.boxId === b.id);
          const bPcs = bItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
          return {
            code: String(b.code || "SC"),
            name: `Scatola: ${b.label || ""}`,
            quantity: bPcs,
            location: `${bItems.length} articoli`
          };
        }),
        ...palletItems.filter((i) => !i.boxId).map((i) => ({
          code: String(i.sku || "ART"),
          name: String(i.name || "Articolo"),
          quantity: Number(i.quantity) || 0,
          location: "Fuori Scatola"
        }))
      ],
      liveVerified: true
    };
  }
  if (base.type === "box") {
    const box2 = boxes.find((b) => b.id === base.entityId);
    if (!box2) return null;
    const pallet2 = box2.palletId ? palletMap.get(box2.palletId) || null : null;
    const parentBox2 = box2.parentBoxId ? boxMap.get(box2.parentBoxId) || null : null;
    const boxPath2 = parentBox2 ? `${parentBox2.code} > ${box2.code}` : box2.code;
    const boxItems = items.filter((i) => i.boxId === box2.id);
    const totalPieces = boxItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
    const boxWeight = (Number(box2.tareKg) || 0) + boxItems.reduce(
      (acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitWeightKg) || 0),
      0
    );
    const loadedAt2 = box2.loadedAt || pallet2?.loadedAt || boxItems.find((i) => i.loadedAt)?.loadedAt || load.loadedAt || base.loadedAt;
    const shippedAt2 = box2.shippedAt || pallet2?.shippedAt || load.shippedAt || handoverAt || findScarico(box2.code, "package") || base.shippedAt;
    return {
      ...base,
      code: box2.code || base.code,
      name: box2.label || base.name,
      commessaTitle: load.title || base.commessaTitle,
      client: load.client || base.client,
      destination: load.destination || base.destination,
      locationPath: pallet2 ? `${pallet2.code} > ${boxPath2}` : `A Terra > ${boxPath2}`,
      palletCode: pallet2?.code || null,
      boxCode: box2.code || base.boxCode,
      quantityText: `${totalPieces} pz (${boxItems.length} art.)`,
      quantityNumber: totalPieces,
      weightKg: Math.round(boxWeight * 100) / 100,
      loadedAt: loadedAt2 || null,
      shippedAt: shippedAt2 || null,
      contents: boxItems.map((it) => ({
        code: String(it.sku || "ART"),
        name: String(it.name || "Articolo"),
        quantity: Number(it.quantity) || 0,
        location: String(box2.code || "")
      })),
      liveVerified: true
    };
  }
  const item = items.find((i) => i.id === base.entityId);
  if (!item) return null;
  const box = item.boxId ? boxMap.get(item.boxId) || null : null;
  const resolvedPalletId = box?.palletId || item.palletId || null;
  const pallet = resolvedPalletId ? palletMap.get(resolvedPalletId) || null : null;
  const parentBox = box?.parentBoxId ? boxMap.get(box.parentBoxId) || null : null;
  const boxPath = box ? parentBox ? `${parentBox.code} > ${box.code}` : box.code : "";
  let locationPath = "Non ancora collocato";
  if (box && pallet) {
    locationPath = `${pallet.code} > ${boxPath}`;
  } else if (box) {
    locationPath = `Scatola ${boxPath}`;
  } else if (pallet) {
    locationPath = `Fuori Scatola su ${pallet.code}`;
  }
  const loadedAt = item.loadedAt || box?.loadedAt || pallet?.loadedAt || load.loadedAt || base.loadedAt;
  const shippedAt = item.shippedAt || box?.shippedAt || pallet?.shippedAt || load.shippedAt || handoverAt || findScarico(item.sku, "sku") || base.shippedAt;
  return {
    ...base,
    code: item.sku || base.code,
    name: item.name || base.name,
    commessaTitle: load.title || base.commessaTitle,
    client: load.client || base.client,
    destination: load.destination || base.destination,
    locationPath,
    palletCode: pallet?.code || null,
    boxCode: box?.code || null,
    quantityText: `${Number(item.quantity) || 0} pz`,
    quantityNumber: Number(item.quantity) || 0,
    weightKg: Math.round((Number(item.quantity) || 0) * (Number(item.unitWeightKg) || 0) * 100) / 100,
    loadedAt: loadedAt || null,
    shippedAt: shippedAt || null,
    contents: [],
    liveVerified: true
  };
}
function renderStandaloneTrackHtml(record) {
  if (!record) {
    return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scheda Tracciabilit\xE0 QR \u2014 CaricoStudio</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; padding: 20px; }
    .card { max-width: 480px; margin: 40px auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 14px; padding: 24px; text-align: center; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #475569; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Codice QR non valido o incompleto</h1>
    <p>Riscansiona l'etichetta stampata dal foglio A4 con la fotocamera del telefono.</p>
  </div>
</body>
</html>`;
  }
  const typeLabel = record.type === "pallet" ? "BANCALE" : record.type === "box" ? "SCATOLA" : "OGGETTO / PEZZO";
  const headerBg = record.type === "pallet" ? "#0f172a" : record.type === "box" ? "#1d4ed8" : "#047857";
  const statusText = record.shippedAt ? "SPEDITO (SCARICATO)" : record.loadedAt ? "PREPARATO (CARICATO)" : "IN PREPARAZIONE";
  const statusBg = record.shippedAt ? "#ecfdf5" : record.loadedAt ? "#f0f9ff" : "#fffbeb";
  const statusBorder = record.shippedAt ? "#a7f3d0" : record.loadedAt ? "#bae6fd" : "#fde68a";
  const statusColor = record.shippedAt ? "#065f46" : record.loadedAt ? "#075985" : "#92400e";
  const contentsHtml = record.contents.length > 0 ? `<div class="section">
          <div class="section-head">
            <span>Contenuto all'interno (${record.contents.length})</span>
            <span class="mono">Tot. ${escapeHtml(record.quantityNumber)} pz</span>
          </div>
          <div class="list">
            ${record.contents.map(
    (row) => `<div class="list-row">
                  <div class="list-left">
                    <div class="mono bold">${escapeHtml(row.code)}${row.location ? ` <span class="muted">\xB7 ${escapeHtml(row.location)}</span>` : ""}</div>
                    <div class="item-name">${escapeHtml(row.name)}</div>
                  </div>
                  <div class="mono bold qty">${escapeHtml(row.quantity)} pz</div>
                </div>`
  ).join("")}
          </div>
        </div>` : "";
  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(record.code)} \xB7 ${escapeHtml(record.commessaCode)} \u2014 Scheda Tracciabilit\xE0</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; padding: 14px; }
    .wrap { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); }
    .head { background: ${headerBg}; color: #ffffff; padding: 18px 20px; }
    .head-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .type { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; opacity: 0.85; }
    .commessa-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.16); padding: 3px 9px; border-radius: 6px; }
    .code-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 8px; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
    .barcode { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; opacity: 0.78; }
    .name { font-size: 15px; font-weight: 600; margin-top: 6px; line-height: 1.35; }
    .body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
    .status-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
    .status { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 6px; background: ${statusBg}; border: 1px solid ${statusBorder}; color: ${statusColor}; }
    .sync-note { font-size: 11px; color: #64748b; }
    .loc-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px 14px; }
    .label-xs { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .loc-val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; }
    .loc-meta { font-size: 12px; color: #475569; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 420px) { .grid-2 { grid-template-columns: 1fr; } }
    .stat { border: 1px solid #e2e8f0; border-radius: 10px; padding: 11px 13px; background: #fff; }
    .stat-val { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 17px; font-weight: 800; margin-top: 4px; }
    .meta-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 11px 0; font-size: 12px; }
    .meta-val { font-weight: 700; color: #0f172a; margin-top: 2px; }
    .time-card { border-radius: 10px; padding: 12px 14px; }
    .time-carico { background: #f0f9ff; border: 1px solid #bae6fd; }
    .time-scarico { background: #ecfdf5; border: 1px solid #a7f3d0; }
    .time-sub { font-size: 11px; color: #475569; margin-top: 2px; }
    .time-val { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 14px; font-weight: 800; margin-top: 6px; color: #0f172a; }
    .section { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .section-head { background: #f8fafc; padding: 9px 13px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #334155; }
    .list { display: flex; flex-direction: column; }
    .list-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 13px; border-top: 1px solid #f1f5f9; font-size: 12px; }
    .list-row:first-child { border-top: none; }
    .list-left { min-width: 0; }
    .item-name { color: #334155; margin-top: 2px; }
    .qty { white-space: nowrap; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .bold { font-weight: 700; }
    .muted { color: #64748b; font-weight: 500; }
    .foot { text-align: center; font-size: 11px; color: #64748b; padding: 4px 0 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="head">
      <div class="head-top">
        <span class="type">${escapeHtml(typeLabel)}</span>
        <span class="commessa-chip">${escapeHtml(record.commessaCode)}</span>
      </div>
      <div class="code-row">
        <div class="code">${escapeHtml(record.code)}</div>
        <div class="barcode">*${escapeHtml(record.barcodeValue)}*</div>
      </div>
      <div class="name">${escapeHtml(record.name)}</div>
    </div>

    <div class="body">
      <div class="status-row">
        <span class="status">${escapeHtml(statusText)}</span>
        <span class="sync-note">${record.liveVerified ? "Stato aggiornato dal server" : "Scheda letta direttamente dal QR"}</span>
      </div>

      <div class="loc-box">
        <div class="label-xs">Dove si trova questo pezzo</div>
        <div class="loc-val">${escapeHtml(record.locationPath)}</div>
        <div class="loc-meta">
          <span>Commessa: <strong>${escapeHtml(record.commessaCode)}</strong> (${escapeHtml(
    record.commessaTitle
  )})</span>
          ${record.palletCode ? `<span>Bancale: <strong class="mono">${escapeHtml(record.palletCode)}</strong></span>` : ""}
          ${record.boxCode ? `<span>Scatola: <strong class="mono">${escapeHtml(record.boxCode)}</strong></span>` : ""}
        </div>
      </div>

      <div class="grid-2">
        <div class="stat">
          <div class="label-xs">Quantit\xE0</div>
          <div class="stat-val">${escapeHtml(record.quantityText)}</div>
        </div>
        <div class="stat">
          <div class="label-xs">Peso Totale</div>
          <div class="stat-val">${escapeHtml(record.weightKg.toFixed(2))} kg</div>
        </div>
      </div>

      <div class="meta-row">
        <div>
          <div class="label-xs">Cliente</div>
          <div class="meta-val">${escapeHtml(record.client)}</div>
        </div>
        <div>
          <div class="label-xs">Destinazione</div>
          <div class="meta-val">${escapeHtml(record.destination)}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="time-card time-carico">
          <div class="label-xs" style="color:#075985;">Data / Ora Carico</div>
          <div class="time-sub">Preparazione bancale per spedizione</div>
          <div class="time-val">${escapeHtml(formatItDateTimeServer(record.loadedAt))}</div>
        </div>
        <div class="time-card time-scarico">
          <div class="label-xs" style="color:#065f46;">Data / Ora Scarico</div>
          <div class="time-sub">Uscita / Spedizione effettuata</div>
          <div class="time-val">${escapeHtml(formatItDateTimeServer(record.shippedAt))}</div>
        </div>
      </div>

      ${contentsHtml}

      <div class="foot">Scheda sola lettura \u2014 nessuna app o login richiesto per la scansione.</div>
    </div>
  </div>
</body>
</html>`;
}
async function startServer() {
  const app = express();
  const server = createServer(app);
  ensureDir(DATA_ROOT);
  ensureDir(USERS_DIR);
  ensureDir(SHARED_FILES_DIR);
  ensureDir(BACKUPS_DIR);
  const DEFAULT_SYSTEM_SETTINGS = {
    nodeName: "METATRON-SRV-01",
    hostnameLabel: "metatron.local",
    timezone: "Europe/Rome",
    kioskBootDefault: true,
    autoBackupEnabled: true,
    autoBackupIntervalHours: 24,
    maintenanceBanner: "",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  let systemSettings = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...readJsonFile(SYSTEM_SETTINGS_FILE, {})
  };
  const systemLogs = [];
  function addSystemLog(level, source, message, adminOnly = false) {
    systemLogs.unshift({
      id: `log_${crypto.randomBytes(6).toString("hex")}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      source: source.slice(0, 40),
      message: message.slice(0, 260),
      adminOnly
    });
    if (systemLogs.length > 250) {
      systemLogs.length = 250;
    }
  }
  addSystemLog("info", "Kernel / Core", `Avvio METATRON Server OS su ${os.hostname()} (${os.platform()} ${os.arch()})`);
  addSystemLog("info", "Storage Engine", `Volume dati montato in ${DATA_ROOT}`);
  function captureCpuSnapshots() {
    return os.cpus().map((c) => {
      const t = c.times;
      const total = t.user + t.nice + t.sys + t.idle + t.irq;
      return { idle: t.idle, total };
    });
  }
  let prevCpuSnapshots = captureCpuSnapshots();
  let latestCpuPercent = 0;
  let latestCorePercents = prevCpuSnapshots.map(() => 0);
  const telemetryHistory = [];
  function sampleTelemetryPoint() {
    const current = captureCpuSnapshots();
    let totalDelta = 0;
    let idleDelta = 0;
    const perCore = [];
    for (let i = 0; i < current.length; i++) {
      const prev = prevCpuSnapshots[i] || current[i];
      const dt = Math.max(1, current[i].total - prev.total);
      const di = Math.max(0, current[i].idle - prev.idle);
      totalDelta += dt;
      idleDelta += di;
      perCore.push(Math.max(0, Math.min(100, Math.round((dt - di) / dt * 100))));
    }
    prevCpuSnapshots = current;
    latestCorePercents = perCore;
    latestCpuPercent = totalDelta > 0 ? Math.max(0, Math.min(100, Math.round((totalDelta - idleDelta) / totalDelta * 1e3) / 10)) : 0;
    const totalMem = os.totalmem();
    const usedMem = Math.max(0, totalMem - os.freemem());
    const memPercent = totalMem > 0 ? Math.round(usedMem / totalMem * 1e3) / 10 : 0;
    telemetryHistory.push({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      cpuPercent: latestCpuPercent,
      memPercent
    });
    if (telemetryHistory.length > 45) {
      telemetryHistory.shift();
    }
  }
  sampleTelemetryPoint();
  const telemetryInterval = setInterval(sampleTelemetryPoint, 2e3);
  telemetryInterval.unref();
  function getDirectoryStats(dirPath) {
    let bytes = 0;
    let files = 0;
    if (!fs.existsSync(dirPath)) return { bytes, files };
    const stack = [dirPath];
    while (stack.length > 0) {
      const currentDir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue;
        const full = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          try {
            const st = fs.statSync(full);
            bytes += st.size;
            files += 1;
          } catch {
          }
        }
      }
    }
    return { bytes, files };
  }
  function getHostDiskStats() {
    try {
      const st = fs.statfsSync(DATA_ROOT);
      const bsize = Number(st.bsize) || 4096;
      const totalBytes = Number(st.blocks) * bsize;
      const freeBytes = Number(st.bavail) * bsize;
      const usedBytes = Math.max(0, totalBytes - freeBytes);
      const usedPercent = totalBytes > 0 ? Math.round(usedBytes / totalBytes * 1e3) / 10 : 0;
      return { totalBytes, usedBytes, freeBytes, usedPercent };
    } catch {
      return { totalBytes: 0, usedBytes: 0, freeBytes: 0, usedPercent: 0 };
    }
  }
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  const METATRON_SESSION_COOKIE = "metatron_sid";
  const REMEMBER_ME_MAX_AGE_SEC = 30 * 24 * 60 * 60;
  function parseCookieValue(req, name) {
    const rawHeader = req.headers.cookie;
    if (!rawHeader || typeof rawHeader !== "string") return null;
    const pairs = rawHeader.split(";");
    for (const pair of pairs) {
      const idx = pair.indexOf("=");
      if (idx <= 0) continue;
      const key = pair.slice(0, idx).trim();
      if (key === name) {
        try {
          return decodeURIComponent(pair.slice(idx + 1).trim());
        } catch {
          return pair.slice(idx + 1).trim();
        }
      }
    }
    return null;
  }
  function isPlainLanHttpRequest(req) {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    if (forwardedProto === "https" || req.secure) return false;
    const originOrReferer = String(req.headers.origin || req.headers.referer || "");
    if (originOrReferer.startsWith("https://")) return false;
    if (originOrReferer.startsWith("http://")) {
      try {
        const u = new URL(originOrReferer);
        if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
  function setSessionCookie(res, req, rawToken, rememberMe = true) {
    const plainLanHttp = isPlainLanHttpRequest(req);
    const parts = [
      `${METATRON_SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
      "Path=/",
      "HttpOnly"
    ];
    if (plainLanHttp) {
      parts.push("SameSite=Lax");
    } else {
      parts.push("Secure", "SameSite=None", "Partitioned");
    }
    if (rememberMe) {
      parts.push(`Max-Age=${REMEMBER_ME_MAX_AGE_SEC}`);
    }
    res.setHeader("Set-Cookie", parts.join("; "));
  }
  function clearSessionCookie(res, req) {
    const plainLanHttp = isPlainLanHttpRequest(req);
    const parts = [
      `${METATRON_SESSION_COOKIE}=`,
      "Path=/",
      "HttpOnly",
      "Max-Age=0",
      "Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    ];
    if (plainLanHttp) {
      parts.push("SameSite=Lax");
    } else {
      parts.push("Secure", "SameSite=None", "Partitioned");
    }
    res.setHeader("Set-Cookie", parts.join("; "));
  }
  function isSameOriginHeader(req) {
    const origin = req.headers.origin;
    if (!origin || typeof origin !== "string") return false;
    const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const host = String(req.headers.host || "").trim();
    const effectiveHost = forwardedHost || host;
    const serverIsLocal = effectiveHost.startsWith("localhost") || effectiveHost.startsWith("127.0.0.1");
    try {
      const originUrl = new URL(origin);
      if (forwardedHost && originUrl.host === forwardedHost) return true;
      if (host && originUrl.host === host) return true;
      if (serverIsLocal && (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1")) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isSameOriginHeader(req)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Credentials", "true");
      res.header("Vary", "Origin");
      res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });
  let usersRegistry = readJsonFile(USERS_FILE, []);
  let sessionsRegistry = readJsonFile(
    SESSIONS_FILE,
    []
  ).filter((s) => s && new Date(s.expiresAt).getTime() > Date.now());
  let employerConfig = readJsonFile(
    EMPLOYER_CONFIG_FILE,
    {}
  );
  let sharesRegistry = readJsonFile(
    SHARES_INDEX_FILE,
    []
  );
  let calendarsRegistry = readJsonFile(
    CALENDARS_FILE,
    []
  );
  let calendarEventsRegistry = readJsonFile(CALENDAR_EVENTS_FILE, []);
  let notificationsRegistry = readJsonFile(NOTIFICATIONS_FILE, []);
  function saveSharesRegistry(next) {
    sharesRegistry = next;
    writeJsonFile(SHARES_INDEX_FILE, sharesRegistry);
  }
  function saveCalendarsRegistry(next) {
    calendarsRegistry = next;
    writeJsonFile(CALENDARS_FILE, calendarsRegistry);
  }
  function saveCalendarEventsRegistry(next) {
    calendarEventsRegistry = next;
    writeJsonFile(CALENDAR_EVENTS_FILE, calendarEventsRegistry);
  }
  function saveNotificationsRegistry(next) {
    notificationsRegistry = next.slice(0, 1500);
    writeJsonFile(NOTIFICATIONS_FILE, notificationsRegistry);
  }
  function ensurePersonalCalendarForUser(user) {
    const existing = calendarsRegistry.find(
      (c) => c.ownerId === user.id && c.isDefaultPersonal
    );
    if (existing) return existing;
    const personal = {
      id: `cal_pers_${user.id.replace(/^usr_/, "").slice(0, 20)}`,
      name: "Calendario Personale",
      color: "#6366f1",
      ownerId: user.id,
      ownerName: user.name,
      isShared: false,
      isDefaultPersonal: true,
      memberIds: [user.id],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveCalendarsRegistry([...calendarsRegistry, personal]);
    return personal;
  }
  function userCanAccessCalendar(cal, userId) {
    return cal.ownerId === userId || cal.memberIds.includes(userId);
  }
  function hydrateCalendarForClient(cal) {
    const uniqueIds = Array.from(/* @__PURE__ */ new Set([cal.ownerId, ...cal.memberIds]));
    const members = uniqueIds.map((id) => usersRegistry.find((u) => u.id === id)).filter((u) => Boolean(u)).map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role === "employer" ? "employer" : "worker"
    }));
    return {
      ...cal,
      memberIds: uniqueIds,
      members
    };
  }
  function pushUserNotification(targetUserId, payload) {
    const item = {
      id: `ntf_${crypto.randomBytes(10).toString("hex")}`,
      userId: targetUserId,
      category: payload.category,
      title: payload.title.slice(0, 140),
      body: payload.body.slice(0, 320),
      targetApp: payload.targetApp,
      meta: payload.meta,
      read: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveNotificationsRegistry([item, ...notificationsRegistry]);
    broadcastToUser(targetUserId, null, {
      type: "notification_new",
      notification: item
    });
    return item;
  }
  function hasAnyEmployer() {
    return usersRegistry.some((u) => u.role === "employer");
  }
  const userCaches = /* @__PURE__ */ new Map();
  function getUserCache(userId) {
    const existing = userCaches.get(userId);
    if (existing) return existing;
    const paths = getUserPaths(userId);
    ensureDir(paths.userDir);
    const loads = readJsonFile(paths.loadsFile, []);
    const inventory = readJsonFile(paths.inventoryFile, null);
    const photos = readJsonFile(paths.photosIndexFile, []);
    const filesState = readJsonFile(paths.filesIndexFile, {
      folders: [],
      files: []
    });
    const cache = {
      loads: Array.isArray(loads) ? loads : [],
      inventory: inventory && Array.isArray(inventory.items) && Array.isArray(inventory.movements) ? inventory : null,
      photos: Array.isArray(photos) ? photos : [],
      filesState: filesState && Array.isArray(filesState.folders) && Array.isArray(filesState.files) ? filesState : { folders: [], files: [] }
    };
    userCaches.set(userId, cache);
    return cache;
  }
  function saveUserLoads(userId, loads) {
    const cache = getUserCache(userId);
    cache.loads = loads;
    writeJsonFile(getUserPaths(userId).loadsFile, loads);
  }
  function saveUserInventory(userId, inventory) {
    const cache = getUserCache(userId);
    cache.inventory = inventory;
    writeJsonFile(getUserPaths(userId).inventoryFile, inventory);
  }
  function saveUserPhotos(userId, photos) {
    const cache = getUserCache(userId);
    cache.photos = photos;
    writeJsonFile(getUserPaths(userId).photosIndexFile, photos);
  }
  function saveUserFilesState(userId, state) {
    const cache = getUserCache(userId);
    cache.filesState = state;
    writeJsonFile(getUserPaths(userId).filesIndexFile, state);
  }
  function createSessionForUser(userId, rememberMe = true) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashSessionToken(rawToken);
    const now = Date.now();
    const ttlMs = rememberMe ? REMEMBER_ME_MAX_AGE_SEC * 1e3 : 12 * 60 * 60 * 1e3;
    const session = {
      tokenHash,
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString()
    };
    sessionsRegistry = [
      ...sessionsRegistry.filter((s) => new Date(s.expiresAt).getTime() > now),
      session
    ];
    writeJsonFile(SESSIONS_FILE, sessionsRegistry);
    return rawToken;
  }
  function resolveSessionFromBearer(rawToken) {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) return null;
    const tokenHash = hashSessionToken(rawToken.trim());
    const now = Date.now();
    const session = sessionsRegistry.find(
      (s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now
    );
    if (!session) return null;
    const storedUser = usersRegistry.find((u) => u.id === session.userId);
    if (!storedUser) return null;
    return { user: toPublicUser(storedUser), tokenHash };
  }
  function extractBearerToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== "string") return null;
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
    return parts[1].trim() || null;
  }
  function requireAuth(req, res, next) {
    const bearerToken = extractBearerToken(req);
    const cookieToken = !bearerToken ? parseCookieValue(req, METATRON_SESSION_COOKIE) : null;
    if (!bearerToken && cookieToken && ["POST", "PUT", "PATCH", "DELETE"].includes(req.method.toUpperCase())) {
      const hasCustomHeader = Boolean(req.headers["x-requested-with"]);
      if (!hasCustomHeader && !isSameOriginHeader(req)) {
        return res.status(403).json({
          ok: false,
          error: "Richiesta non autorizzata (verifica origine fallita)."
        });
      }
    }
    const resolved = resolveSessionFromBearer(bearerToken || cookieToken);
    if (!resolved) {
      return res.status(401).json({
        ok: false,
        error: "Autenticazione richiesta. Effettua il login."
      });
    }
    req.authUser = resolved.user;
    req.sessionTokenHash = resolved.tokenHash;
    next();
  }
  function requireEmployer(req, res, next) {
    if (!req.authUser || req.authUser.role !== "employer") {
      return res.status(403).json({
        ok: false,
        error: "Accesso riservato al Datore di Lavoro / Direzione."
      });
    }
    next();
  }
  app.get("/api/auth/status", (_req, res) => {
    const envEmployerCode = (process.env.EMPLOYER_ACCESS_CODE || "").trim();
    const hasEmployer = hasAnyEmployer();
    res.json({
      hasUsers: usersRegistry.length > 0,
      hasEmployer,
      employerCodeRequired: Boolean(
        envEmployerCode || hasEmployer || employerConfig.accessCodeHash
      )
    });
  });
  app.post("/api/auth/register", (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || "").trim().slice(0, 80);
      const company = String(body.company || "").trim().slice(0, 80);
      const email = String(body.email || "").trim().toLowerCase().slice(0, 140);
      const password = String(body.password || "");
      const requestedRole = body.role === "employer" ? "employer" : "worker";
      const employerCode = String(body.employerCode || "").trim();
      if (name.length < 2) {
        return res.status(400).json({
          ok: false,
          error: "Inserisci un nome valido (almeno 2 caratteri)."
        });
      }
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({
          ok: false,
          error: "Inserisci un indirizzo email valido."
        });
      }
      if (password.length < 8) {
        return res.status(400).json({
          ok: false,
          error: "La password deve contenere almeno 8 caratteri."
        });
      }
      const duplicate = usersRegistry.find((u) => u.email === email);
      if (duplicate) {
        return res.status(409).json({
          ok: false,
          error: "Esiste gi\xE0 un account registrato con questa email."
        });
      }
      const envEmployerCode = (process.env.EMPLOYER_ACCESS_CODE || "").trim();
      const employerExists = hasAnyEmployer();
      let shouldStoreClaimedEmployerCode = false;
      if (requestedRole === "employer") {
        if (envEmployerCode) {
          if (!employerCode || !safeCompareSecret(employerCode, envEmployerCode)) {
            return res.status(403).json({
              ok: false,
              error: "Codice Accesso Direzione non valido."
            });
          }
        } else if (employerExists || employerConfig.accessCodeHash) {
          if (!employerConfig.accessCodeHash || !employerCode || !verifyPassword(employerCode, employerConfig.accessCodeHash)) {
            return res.status(403).json({
              ok: false,
              error: "Codice Accesso Direzione non valido. Richiedi il codice al titolare."
            });
          }
        } else {
          if (employerCode.length < 6) {
            return res.status(400).json({
              ok: false,
              error: "Imposta un Codice Segreto Direzione di almeno 6 caratteri per proteggere l'accesso del Datore di Lavoro."
            });
          }
          shouldStoreClaimedEmployerCode = true;
        }
      }
      const isFirstUser = usersRegistry.length === 0;
      const userId = `usr_${crypto.randomBytes(10).toString("hex")}`;
      const newUser = {
        id: userId,
        name,
        company: company || void 0,
        email,
        role: requestedRole,
        passwordHash: hashPassword(password),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      usersRegistry = [...usersRegistry, newUser];
      writeJsonFile(USERS_FILE, usersRegistry);
      if (shouldStoreClaimedEmployerCode) {
        employerConfig = {
          accessCodeHash: hashPassword(employerCode),
          claimedByUserId: userId,
          claimedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        writeJsonFile(EMPLOYER_CONFIG_FILE, employerConfig);
      }
      ensureDir(getUserPaths(userId).userDir);
      if (isFirstUser) {
        migrateLegacyDataToFirstUser(userId);
      }
      const rememberMe = body.rememberMe !== false;
      const token = createSessionForUser(userId, rememberMe);
      setSessionCookie(res, req, token, rememberMe);
      res.setHeader("Cache-Control", "no-store");
      addSystemLog(
        "info",
        "Auth Vault",
        `Nuovo profilo registrato: ${newUser.name} (${newUser.role === "employer" ? "Direzione" : "Operatore"})`,
        true
      );
      return res.status(201).json({
        ok: true,
        token,
        user: toPublicUser(newUser),
        migratedLegacy: isFirstUser
      });
    } catch (err) {
      console.error("[CaricoStudio Auth] Errore registrazione:", err);
      return res.status(500).json({ ok: false, error: "Errore durante la registrazione." });
    }
  });
  app.post("/api/auth/login", (req, res) => {
    try {
      const body = req.body || {};
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const rememberMe = body.rememberMe !== false;
      const found = usersRegistry.find((u) => u.email === email);
      if (!found || !verifyPassword(password, found.passwordHash)) {
        addSystemLog("warn", "Auth Vault", "Tentativo di accesso non riuscito", true);
        return res.status(401).json({
          ok: false,
          error: "Email o password non corretti."
        });
      }
      const token = createSessionForUser(found.id, rememberMe);
      setSessionCookie(res, req, token, rememberMe);
      res.setHeader("Cache-Control", "no-store");
      addSystemLog("info", "Auth Vault", `Accesso effettuato: ${found.name}`, true);
      return res.json({
        ok: true,
        token,
        user: toPublicUser(found)
      });
    } catch (err) {
      console.error("[CaricoStudio Auth] Errore login:", err);
      return res.status(500).json({ ok: false, error: "Errore durante il login." });
    }
  });
  app.get("/api/auth/session", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const bearerToken = extractBearerToken(req);
    const cookieToken = !bearerToken ? parseCookieValue(req, METATRON_SESSION_COOKIE) : null;
    if (!bearerToken && cookieToken) {
      if (!req.headers["x-requested-with"]) {
        return res.status(403).json({ ok: false, authenticated: false });
      }
    }
    const activeToken = bearerToken || cookieToken;
    const resolved = resolveSessionFromBearer(activeToken);
    if (!resolved || !activeToken) {
      if (cookieToken) {
        clearSessionCookie(res, req);
      }
      return res.json({ ok: true, authenticated: false });
    }
    return res.json({
      ok: true,
      authenticated: true,
      token: activeToken,
      user: resolved.user
    });
  });
  app.post("/api/auth/logout", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const bearerToken = extractBearerToken(req);
    const cookieToken = !bearerToken ? parseCookieValue(req, METATRON_SESSION_COOKIE) : null;
    if (!bearerToken && cookieToken) {
      const hasCustomHeader = Boolean(req.headers["x-requested-with"]);
      if (!hasCustomHeader && !isSameOriginHeader(req)) {
        return res.status(403).json({
          ok: false,
          error: "Richiesta non autorizzata."
        });
      }
    }
    const resolved = resolveSessionFromBearer(bearerToken || cookieToken);
    if (resolved) {
      sessionsRegistry = sessionsRegistry.filter(
        (s) => s.tokenHash !== resolved.tokenHash
      );
      writeJsonFile(SESSIONS_FILE, sessionsRegistry);
      addSystemLog("info", "Auth Vault", `Disconnessione: ${resolved.user.name}`, true);
    }
    clearSessionCookie(res, req);
    return res.json({ ok: true });
  });
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ ok: true, user: req.authUser });
  });
  function resolvePublicTrackLive(encoded) {
    const base = decodeTrackTokenServer(encoded);
    if (!base) return null;
    const targetCodeUpper = base.commessaCode.trim().toUpperCase();
    if (base.entityId && targetCodeUpper) {
      for (const u of usersRegistry) {
        const cache = getUserCache(u.id);
        const matchedLoad = cache.loads.find(
          (l) => l && String(l.code || "").trim().toUpperCase() === targetCodeUpper
        );
        if (matchedLoad) {
          const enriched = enrichTrackRecordFromLoad(
            base,
            matchedLoad,
            cache.inventory?.movements || []
          );
          if (enriched) return enriched;
        }
      }
      if (usersRegistry.length === 0 && fs.existsSync(LEGACY_LOADS_FILE)) {
        const legacyLoads = readJsonFile(LEGACY_LOADS_FILE, []);
        const legacyInv = readJsonFile(
          LEGACY_INVENTORY_FILE,
          null
        );
        const matchedLoad = legacyLoads.find(
          (l) => l && String(l.code || "").trim().toUpperCase() === targetCodeUpper
        );
        if (matchedLoad) {
          const enriched = enrichTrackRecordFromLoad(
            base,
            matchedLoad,
            legacyInv?.movements || []
          );
          if (enriched) return enriched;
        }
      }
    }
    return base;
  }
  app.get("/t", (req, res) => {
    const rawD = String(req.query.d || req.query.track || "").trim();
    const resolved = rawD ? resolvePublicTrackLive(rawD) : null;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(resolved ? 200 : 400).send(renderStandaloneTrackHtml(resolved));
  });
  app.get("/api/public/track", (req, res) => {
    const rawD = String(req.query.d || req.query.track || "").trim();
    const resolved = rawD ? resolvePublicTrackLive(rawD) : null;
    if (!resolved) {
      return res.status(404).json({ ok: false, error: "Scheda QR non trovata" });
    }
    return res.json({ ok: true, record: resolved });
  });
  process.on("uncaughtException", (err) => {
    if (err?.message?.includes("WebSocket frame") || err?.message?.includes("status code") || err?.message?.includes("Invalid WebSocket frame")) {
      console.warn("[CaricoStudio WS] Suppressed benign WebSocket frame error:", err?.message || err);
      return;
    }
    console.error("[CaricoStudio] Uncaught exception:", err);
  });
  const wss = new WebSocketServer({ noServer: true });
  const wsUserMap = /* @__PURE__ */ new WeakMap();
  wss.on("error", (err) => {
    console.warn("[CaricoStudio WS] WebSocket server warning:", err?.message || err);
  });
  const viteWs = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => {
      for (const p of protocols) {
        if (p === "vite-hmr") return "vite-hmr";
      }
      return false;
    }
  });
  viteWs.on("error", (err) => {
    console.warn("[CaricoStudio Vite WS] Server warning:", err?.message || err);
  });
  viteWs.on("connection", (ws) => {
    ws.on("error", (err) => {
      console.warn("[CaricoStudio Vite WS] Socket warning:", err?.message || err);
    });
    try {
      ws.send(JSON.stringify({ type: "connected" }));
    } catch {
    }
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
      }
    });
  });
  server.on("upgrade", (request, socket, head) => {
    try {
      const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
      if (url.pathname === "/ws") {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      } else {
        viteWs.handleUpgrade(request, socket, head, (ws) => {
          viteWs.emit("connection", ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });
  function broadcastToUser(userId, sender, message) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN && wsUserMap.get(client) === userId) {
        client.send(data);
      }
    });
  }
  function getOnlineCountForUser(userId) {
    let count = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && wsUserMap.get(client) === userId) {
        count++;
      }
    });
    return count;
  }
  function broadcastPresenceForUser(userId) {
    const count = getOnlineCountForUser(userId);
    const data = JSON.stringify({ type: "presence", count });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && wsUserMap.get(client) === userId) {
        client.send(data);
      }
    });
  }
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "auth") {
          const resolved = resolveSessionFromBearer(msg.token);
          if (!resolved) {
            ws.send(JSON.stringify({ type: "auth_error", error: "Sessione non valida" }));
            ws.close(4001, "Unauthorized");
            return;
          }
          const userId2 = resolved.user.id;
          wsUserMap.set(ws, userId2);
          const cache = getUserCache(userId2);
          ws.send(
            JSON.stringify({
              type: "init",
              loads: cache.loads.length > 0 ? cache.loads : null,
              count: getOnlineCountForUser(userId2)
            })
          );
          broadcastPresenceForUser(userId2);
          return;
        }
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        const userId = wsUserMap.get(ws);
        if (!userId) {
          return;
        }
        if (msg.type === "sync_loads" && Array.isArray(msg.loads)) {
          saveUserLoads(userId, msg.loads);
          broadcastToUser(userId, ws, {
            type: "loads_updated",
            loads: msg.loads,
            senderId: msg.senderId
          });
        }
      } catch (err) {
        console.error("Error handling WebSocket message:", err);
      }
    });
    ws.on("close", () => {
      const userId = wsUserMap.get(ws);
      wsUserMap.delete(ws);
      if (userId) {
        broadcastPresenceForUser(userId);
      }
    });
    ws.on("error", (err) => {
      console.warn("[CaricoStudio WS] Client socket warning:", err?.message || err);
    });
  });
  app.get("/api/loads", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const cache = getUserCache(userId);
    res.json({ loads: cache.loads, count: getOnlineCountForUser(userId) });
  });
  app.post("/api/loads", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    if (Array.isArray(req.body.loads)) {
      saveUserLoads(userId, req.body.loads);
      broadcastToUser(userId, null, {
        type: "loads_updated",
        loads: req.body.loads,
        senderId: req.body.senderId
      });
      res.json({
        success: true,
        count: getOnlineCountForUser(userId),
        totalLoads: req.body.loads.length
      });
    } else {
      res.status(400).json({ error: "loads must be an array" });
    }
  });
  app.post("/api/sync-load", requireAuth, (req, res) => {
    try {
      const userId = req.authUser.id;
      const load = req.body.load || req.body;
      if (!load || !load.code && !load.id) {
        return res.status(400).json({ error: "Carico non valido: parametri code o id mancanti." });
      }
      const cache = getUserCache(userId);
      const nextLoads = [...cache.loads];
      const existingIndex = nextLoads.findIndex(
        (l) => load.id && l.id === load.id || load.code && l.code?.trim().toLowerCase() === load.code.trim().toLowerCase()
      );
      if (existingIndex >= 0) {
        nextLoads[existingIndex] = { ...nextLoads[existingIndex], ...load };
      } else {
        nextLoads.unshift(load);
      }
      saveUserLoads(userId, nextLoads);
      broadcastToUser(userId, null, {
        type: "loads_updated",
        loads: nextLoads,
        senderId: req.body.senderId || "rest_sync_single"
      });
      res.json({
        success: true,
        loadCode: load.code,
        itemsCount: load.items?.length || 0,
        palletsCount: load.pallets?.length || 0,
        boxesCount: load.boxes?.length || 0,
        count: getOnlineCountForUser(userId)
      });
    } catch (err) {
      console.error("Error in /api/sync-load:", err);
      res.status(500).json({ error: err.message || "Errore durante la sincronizzazione del carico." });
    }
  });
  app.post("/api/track/stamp", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const body = req.body || {};
    const commessaCode = String(body.commessaCode || "").trim().toUpperCase();
    const entityType = String(body.entityType || "").trim();
    const entityId = String(body.entityId || "").trim();
    const entityCode = String(body.entityCode || "").trim().toUpperCase();
    const field = body.field === "shippedAt" ? "shippedAt" : body.field === "loadedAt" ? "loadedAt" : null;
    const timestampIso = body.timestampIso ? String(body.timestampIso) : (/* @__PURE__ */ new Date()).toISOString();
    if (!commessaCode || !field) {
      return res.status(400).json({ ok: false, error: "Parametri non validi" });
    }
    const cache = getUserCache(userId);
    let updated = false;
    const nextLoads = cache.loads.map((load) => {
      if (!load || String(load.code || "").trim().toUpperCase() !== commessaCode) {
        return load;
      }
      updated = true;
      if (entityType === "load") {
        return {
          ...load,
          [field]: timestampIso,
          pallets: (load.pallets || []).map((p) => ({ ...p, [field]: timestampIso })),
          boxes: (load.boxes || []).map((b) => ({ ...b, [field]: timestampIso })),
          items: (load.items || []).map((it) => ({ ...it, [field]: timestampIso }))
        };
      }
      if (entityType === "pallet") {
        const targetPallet = (load.pallets || []).find(
          (p) => p.id === entityId || String(p.code || "").toUpperCase() === entityCode
        );
        const pid = targetPallet?.id || entityId;
        const boxIdsOnPallet = new Set(
          (load.boxes || []).filter((b) => b.palletId === pid).map((b) => b.id)
        );
        return {
          ...load,
          pallets: (load.pallets || []).map(
            (p) => p.id === pid ? { ...p, [field]: timestampIso } : p
          ),
          boxes: (load.boxes || []).map(
            (b) => b.palletId === pid ? { ...b, [field]: timestampIso } : b
          ),
          items: (load.items || []).map(
            (it) => it.palletId === pid || it.boxId && boxIdsOnPallet.has(it.boxId) ? { ...it, [field]: timestampIso } : it
          )
        };
      }
      if (entityType === "box") {
        const targetBox = (load.boxes || []).find(
          (b) => b.id === entityId || String(b.code || "").toUpperCase() === entityCode
        );
        const bid = targetBox?.id || entityId;
        return {
          ...load,
          boxes: (load.boxes || []).map(
            (b) => b.id === bid ? { ...b, [field]: timestampIso } : b
          ),
          items: (load.items || []).map(
            (it) => it.boxId === bid ? { ...it, [field]: timestampIso } : it
          )
        };
      }
      if (entityType === "item") {
        return {
          ...load,
          items: (load.items || []).map(
            (it) => it.id === entityId || String(it.sku || "").toUpperCase() === entityCode ? { ...it, [field]: timestampIso } : it
          )
        };
      }
      return load;
    });
    if (updated) {
      saveUserLoads(userId, nextLoads);
      broadcastToUser(userId, null, {
        type: "loads_updated",
        loads: nextLoads,
        senderId: "qr_scan_server"
      });
    }
    return res.json({ ok: true, updated, timestampIso });
  });
  app.get("/api/inventory", requireAuth, (req, res) => {
    const cache = getUserCache(req.authUser.id);
    res.json({ inventory: cache.inventory });
  });
  app.post("/api/inventory", requireAuth, (req, res) => {
    const { inventory } = req.body || {};
    if (inventory && Array.isArray(inventory.items) && Array.isArray(inventory.movements)) {
      saveUserInventory(req.authUser.id, {
        items: inventory.items,
        movements: inventory.movements,
        hiddenCommessaCodes: Array.isArray(inventory.hiddenCommessaCodes) ? inventory.hiddenCommessaCodes : []
      });
      return res.json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: "Payload inventario non valido" });
  });
  app.get("/api/photos", requireAuth, (req, res) => {
    const cache = getUserCache(req.authUser.id);
    res.json({ photos: cache.photos });
  });
  app.post("/api/photos", requireAuth, (req, res) => {
    try {
      const userId = req.authUser.id;
      const body = req.body || {};
      const id = String(body.id || "").trim();
      const dataUrl = String(body.dataUrl || "");
      if (!SAFE_PHOTO_ID_RE.test(id)) {
        return res.status(400).json({ ok: false, error: "ID foto non valido" });
      }
      const match = dataUrl.match(
        /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/
      );
      if (!match) {
        return res.status(400).json({ ok: false, error: "Formato immagine non valido" });
      }
      const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
      const fileExt = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
      const buffer = Buffer.from(match[2], "base64");
      const paths = getUserPaths(userId);
      ensureDir(paths.photosDir);
      const filePath = assertSafeChildPath(
        paths.photosDir,
        path.join(paths.photosDir, `${id}.${fileExt}`)
      );
      fs.writeFileSync(filePath, buffer);
      const record = {
        id,
        commessaId: String(body.commessaId || ""),
        commessaCode: String(body.commessaCode || "COMMESSA"),
        commessaTitle: String(body.commessaTitle || ""),
        caption: String(body.caption || ""),
        capturedAt: String(body.capturedAt || (/* @__PURE__ */ new Date()).toISOString()),
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
        sizeBytes: buffer.length,
        mimeType,
        fileExt
      };
      const cache = getUserCache(userId);
      saveUserPhotos(userId, [record, ...cache.photos.filter((p) => p.id !== id)]);
      return res.json({ ok: true, photo: record });
    } catch (err) {
      console.error("[CaricoStudio] Errore salvataggio foto:", err);
      return res.status(500).json({ ok: false, error: "Errore salvataggio foto" });
    }
  });
  app.get("/api/photos/:id/file", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_PHOTO_ID_RE.test(id)) {
      return res.status(400).send("Invalid photo ID");
    }
    const cache = getUserCache(userId);
    const meta = cache.photos.find((p) => p.id === id);
    if (!meta) return res.status(404).send("Photo not found");
    const paths = getUserPaths(userId);
    const target = assertSafeChildPath(
      paths.photosDir,
      path.join(paths.photosDir, `${id}.${meta.fileExt || "jpg"}`)
    );
    if (fs.existsSync(target)) {
      res.setHeader(
        "Content-Type",
        meta.fileExt === "png" ? "image/png" : meta.fileExt === "webp" ? "image/webp" : "image/jpeg"
      );
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.sendFile(target);
    }
    return res.status(404).send("Photo not found");
  });
  app.patch("/api/photos/:id", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_PHOTO_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID foto non valido" });
    }
    const caption = String((req.body || {}).caption ?? "");
    const cache = getUserCache(userId);
    const nextPhotos = cache.photos.map((p) => p.id === id ? { ...p, caption } : p);
    saveUserPhotos(userId, nextPhotos);
    return res.json({ ok: true });
  });
  app.delete("/api/photos/:id", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_PHOTO_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID foto non valido" });
    }
    const cache = getUserCache(userId);
    const existing = cache.photos.find((p) => p.id === id);
    saveUserPhotos(
      userId,
      cache.photos.filter((p) => p.id !== id)
    );
    const paths = getUserPaths(userId);
    const exts = existing ? [existing.fileExt] : ["jpg", "png", "webp"];
    for (const ext of exts) {
      const target = assertSafeChildPath(
        paths.photosDir,
        path.join(paths.photosDir, `${id}.${ext}`)
      );
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
        }
      }
    }
    return res.json({ ok: true });
  });
  app.get("/api/files", requireAuth, (req, res) => {
    const cache = getUserCache(req.authUser.id);
    res.json(cache.filesState);
  });
  app.post("/api/files/folders", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const body = req.body || {};
    const id = String(body.id || "").trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID cartella non valido" });
    }
    const folder = {
      id,
      name: String(body.name || "Nuova Cartella").trim().slice(0, 120),
      parentId: body.parentId ? String(body.parentId) : null,
      color: String(body.color || "blue"),
      commessaCode: body.commessaCode ? String(body.commessaCode).trim() : void 0,
      createdAt: String(body.createdAt || (/* @__PURE__ */ new Date()).toISOString()),
      updatedAt: String(body.updatedAt || (/* @__PURE__ */ new Date()).toISOString())
    };
    const cache = getUserCache(userId);
    saveUserFilesState(userId, {
      ...cache.filesState,
      folders: [...cache.filesState.folders.filter((f) => f.id !== id), folder]
    });
    return res.json({ ok: true, folder });
  });
  app.patch("/api/files/folders/:id", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID cartella non valido" });
    }
    const body = req.body || {};
    const cache = getUserCache(userId);
    saveUserFilesState(userId, {
      ...cache.filesState,
      folders: cache.filesState.folders.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          name: body.name !== void 0 ? String(body.name).trim().slice(0, 120) : f.name,
          color: body.color !== void 0 ? String(body.color) : f.color,
          commessaCode: body.commessaCode !== void 0 ? String(body.commessaCode).trim() || void 0 : f.commessaCode,
          parentId: body.parentId !== void 0 ? body.parentId || null : f.parentId,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      })
    });
    return res.json({ ok: true });
  });
  app.delete("/api/files/folders/:id", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID cartella non valido" });
    }
    const cache = getUserCache(userId);
    const toDelete = /* @__PURE__ */ new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const f of cache.filesState.folders) {
        if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
          toDelete.add(f.id);
          changed = true;
        }
      }
    }
    const paths = getUserPaths(userId);
    const removedFiles = cache.filesState.files.filter(
      (fl) => fl.folderId && toDelete.has(fl.folderId)
    );
    for (const fl of removedFiles) {
      const safeExt = String(fl.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
      const target = assertSafeChildPath(
        paths.filesDir,
        path.join(paths.filesDir, `${fl.id}.${safeExt}`)
      );
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
        }
      }
    }
    saveUserFilesState(userId, {
      folders: cache.filesState.folders.filter((f) => !toDelete.has(f.id)),
      files: cache.filesState.files.filter(
        (fl) => !fl.folderId || !toDelete.has(fl.folderId)
      )
    });
    return res.json({ ok: true });
  });
  app.post("/api/files/upload", requireAuth, (req, res) => {
    try {
      const userId = req.authUser.id;
      const body = req.body || {};
      const id = String(body.id || "").trim();
      const dataUrl = String(body.dataUrl || "");
      if (!SAFE_FILE_ID_RE.test(id)) {
        return res.status(400).json({ ok: false, error: "ID file non valido" });
      }
      const commaIdx = dataUrl.indexOf(",");
      if (!dataUrl.startsWith("data:") || commaIdx === -1) {
        return res.status(400).json({ ok: false, error: "Contenuto file non valido" });
      }
      const headerPart = dataUrl.slice(5, commaIdx);
      const mimeFromHeader = headerPart.split(";")[0] || "application/octet-stream";
      const base64Data = dataUrl.slice(commaIdx + 1);
      const buffer = Buffer.from(base64Data, "base64");
      const safeExt = String(body.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
      const paths = getUserPaths(userId);
      ensureDir(paths.filesDir);
      const destPath = assertSafeChildPath(
        paths.filesDir,
        path.join(paths.filesDir, `${id}.${safeExt}`)
      );
      fs.writeFileSync(destPath, buffer);
      const meta = {
        id,
        folderId: body.folderId ? String(body.folderId) : null,
        name: String(body.name || `file.${safeExt}`).trim().slice(0, 180),
        mimeType: String(body.mimeType || mimeFromHeader || "application/octet-stream"),
        extension: safeExt,
        sizeBytes: buffer.length,
        source: body.source === "app_foto" ? "app_foto" : "upload",
        createdAt: String(body.createdAt || (/* @__PURE__ */ new Date()).toISOString()),
        updatedAt: String(body.updatedAt || (/* @__PURE__ */ new Date()).toISOString())
      };
      const cache = getUserCache(userId);
      saveUserFilesState(userId, {
        ...cache.filesState,
        files: [meta, ...cache.filesState.files.filter((f) => f.id !== id)]
      });
      return res.json({ ok: true, file: meta });
    } catch (err) {
      console.error("[CaricoStudio] Errore upload file:", err);
      return res.status(500).json({ ok: false, error: "Errore caricamento file" });
    }
  });
  app.get("/api/files/:id/content", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).send("Invalid file ID");
    }
    const cache = getUserCache(userId);
    const meta = cache.filesState.files.find((f) => f.id === id);
    if (!meta) return res.status(404).send("File not found");
    const safeExt = String(meta.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
    const paths = getUserPaths(userId);
    const target = assertSafeChildPath(
      paths.filesDir,
      path.join(paths.filesDir, `${id}.${safeExt}`)
    );
    if (!fs.existsSync(target)) {
      return res.status(404).send("File content missing");
    }
    res.setHeader("Content-Type", meta.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(meta.name || id)}"`
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.sendFile(target);
  });
  app.patch("/api/files/:id", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID file non valido" });
    }
    const body = req.body || {};
    const cache = getUserCache(userId);
    saveUserFilesState(userId, {
      ...cache.filesState,
      files: cache.filesState.files.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          name: body.name !== void 0 ? String(body.name).trim().slice(0, 180) : f.name,
          folderId: body.folderId !== void 0 ? body.folderId || null : f.folderId,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
      })
    });
    return res.json({ ok: true });
  });
  app.delete("/api/files/:id", requireAuth, (req, res) => {
    const userId = req.authUser.id;
    const id = String(req.params.id || "").trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID file non valido" });
    }
    const cache = getUserCache(userId);
    const existing = cache.filesState.files.find((f) => f.id === id);
    saveUserFilesState(userId, {
      ...cache.filesState,
      files: cache.filesState.files.filter((f) => f.id !== id)
    });
    if (existing) {
      const safeExt = String(existing.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
      const paths = getUserPaths(userId);
      const target = assertSafeChildPath(
        paths.filesDir,
        path.join(paths.filesDir, `${id}.${safeExt}`)
      );
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
        }
      }
    }
    return res.json({ ok: true });
  });
  app.get("/api/users/directory", requireAuth, (req, res) => {
    const users = usersRegistry.map((u) => ({
      id: u.id,
      name: u.name,
      company: u.company || void 0,
      role: u.role === "employer" ? "employer" : "worker",
      isOnline: getOnlineCountForUser(u.id) > 0
    }));
    return res.json({ ok: true, users });
  });
  app.get("/api/shares", requireAuth, (req, res) => {
    const me = req.authUser;
    const myShares = sharesRegistry.filter((s) => s.senderId === me.id || s.recipientId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ ok: true, shares: myShares });
  });
  app.post("/api/shares", requireAuth, (req, res) => {
    try {
      const sender = req.authUser;
      const body = req.body || {};
      const recipientId = String(body.recipientId || "").trim();
      const sourceType = String(body.sourceType || "upload").trim();
      const message = String(body.message || "").trim().slice(0, 500);
      const commessaCode = String(body.commessaCode || "").trim().slice(0, 60);
      if (!SAFE_USER_ID_RE.test(recipientId)) {
        return res.status(400).json({ ok: false, error: "Destinatario non valido." });
      }
      const recipientStored = usersRegistry.find((u) => u.id === recipientId);
      if (!recipientStored) {
        return res.status(404).json({ ok: false, error: "Utente destinatario non trovato." });
      }
      if (recipientStored.id === sender.id) {
        return res.status(400).json({
          ok: false,
          error: "Seleziona un altro utente registrato a cui inviare il file."
        });
      }
      const shareId = `shr_${crypto.randomBytes(10).toString("hex")}`;
      let buffer;
      let fileName = "allegato";
      let mimeType = "application/octet-stream";
      let safeExt = "bin";
      let kind = "file";
      if (sourceType === "photo") {
        const sourcePhotoId = String(body.sourcePhotoId || "").trim();
        if (!SAFE_PHOTO_ID_RE.test(sourcePhotoId)) {
          return res.status(400).json({ ok: false, error: "ID foto non valido." });
        }
        const senderCache = getUserCache(sender.id);
        const photoMeta = senderCache.photos.find((p) => p.id === sourcePhotoId);
        if (!photoMeta) {
          return res.status(404).json({ ok: false, error: "Foto non trovata nel tuo archivio." });
        }
        const senderPaths = getUserPaths(sender.id);
        safeExt = String(photoMeta.fileExt || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "jpg";
        const srcPath = assertSafeChildPath(
          senderPaths.photosDir,
          path.join(senderPaths.photosDir, `${photoMeta.id}.${safeExt}`)
        );
        if (!fs.existsSync(srcPath)) {
          return res.status(404).json({ ok: false, error: "Immagine non disponibile su disco." });
        }
        buffer = fs.readFileSync(srcPath);
        mimeType = photoMeta.mimeType || "image/jpeg";
        const cleanCaption = (photoMeta.caption || photoMeta.commessaCode || "foto").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 60);
        fileName = `${cleanCaption}.${safeExt}`;
        kind = "photo";
      } else if (sourceType === "file") {
        const sourceFileId = String(body.sourceFileId || "").trim();
        if (!SAFE_FILE_ID_RE.test(sourceFileId)) {
          return res.status(400).json({ ok: false, error: "ID file non valido." });
        }
        const senderCache = getUserCache(sender.id);
        const fileMeta = senderCache.filesState.files.find((f) => f.id === sourceFileId);
        if (!fileMeta) {
          return res.status(404).json({ ok: false, error: "File non trovato nel tuo archivio." });
        }
        const senderPaths = getUserPaths(sender.id);
        safeExt = String(fileMeta.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
        const srcPath = assertSafeChildPath(
          senderPaths.filesDir,
          path.join(senderPaths.filesDir, `${fileMeta.id}.${safeExt}`)
        );
        if (!fs.existsSync(srcPath)) {
          return res.status(404).json({ ok: false, error: "Contenuto file non trovato." });
        }
        buffer = fs.readFileSync(srcPath);
        mimeType = String(fileMeta.mimeType || "application/octet-stream");
        fileName = String(fileMeta.name || `file.${safeExt}`).slice(0, 180);
        kind = mimeType.startsWith("image/") ? "photo" : "file";
      } else {
        const dataUrl = String(body.dataUrl || "");
        const commaIdx = dataUrl.indexOf(",");
        if (!dataUrl.startsWith("data:") || commaIdx === -1) {
          return res.status(400).json({ ok: false, error: "File allegato non valido." });
        }
        const headerPart = dataUrl.slice(5, commaIdx);
        const mimeFromHeader = headerPart.split(";")[0] || "application/octet-stream";
        buffer = Buffer.from(dataUrl.slice(commaIdx + 1), "base64");
        if (buffer.length === 0 || buffer.length > 30 * 1024 * 1024) {
          return res.status(400).json({
            ok: false,
            error: "Dimensione file non valida (massimo 30 MB)."
          });
        }
        fileName = String(body.fileName || "documento").trim().slice(0, 180) || "documento";
        const extFromName = fileName.includes(".") ? fileName.split(".").pop() || "bin" : "bin";
        safeExt = String(body.extension || extFromName).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
        mimeType = String(body.mimeType || mimeFromHeader || "application/octet-stream");
        kind = mimeType.startsWith("image/") ? "photo" : "file";
      }
      ensureDir(SHARED_FILES_DIR);
      const destPath = assertSafeChildPath(
        SHARED_FILES_DIR,
        path.join(SHARED_FILES_DIR, `${shareId}.${safeExt}`)
      );
      fs.writeFileSync(destPath, buffer);
      const record = {
        id: shareId,
        senderId: sender.id,
        senderName: sender.name,
        senderRole: sender.role,
        recipientId: recipientStored.id,
        recipientName: recipientStored.name,
        recipientRole: recipientStored.role === "employer" ? "employer" : "worker",
        fileName,
        mimeType,
        extension: safeExt,
        sizeBytes: buffer.length,
        kind,
        commessaCode: commessaCode || void 0,
        message: message || void 0,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        savedByRecipient: false
      };
      saveSharesRegistry([record, ...sharesRegistry]);
      broadcastToUser(recipientStored.id, null, {
        type: "share_received",
        share: record
      });
      pushUserNotification(recipientStored.id, {
        category: "message",
        title: kind === "photo" ? `Nuova foto da ${sender.name}` : `Nuovo file da ${sender.name}`,
        body: message ? `${fileName} \u2014 "${message}"` : `${sender.name} ti ha inviato ${fileName}${commessaCode ? ` (Commessa ${commessaCode})` : ""}`,
        targetApp: "team_share",
        meta: {
          shareId: record.id,
          commessaCode: commessaCode || void 0
        }
      });
      return res.status(201).json({ ok: true, share: record });
    } catch (err) {
      console.error("[CaricoStudio] Errore invio file tra utenti:", err);
      return res.status(500).json({ ok: false, error: "Errore durante l'invio del file." });
    }
  });
  app.get("/api/shares/:id/download", requireAuth, (req, res) => {
    const me = req.authUser;
    const shareId = String(req.params.id || "").trim();
    if (!SAFE_SHARE_ID_RE.test(shareId)) {
      return res.status(400).send("ID condivisione non valido");
    }
    const share = sharesRegistry.find((s) => s.id === shareId);
    if (!share) {
      return res.status(404).send("File condiviso non trovato");
    }
    if (share.senderId !== me.id && share.recipientId !== me.id && me.role !== "employer") {
      return res.status(403).send("Accesso negato");
    }
    const safeExt = String(share.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
    const target = assertSafeChildPath(
      SHARED_FILES_DIR,
      path.join(SHARED_FILES_DIR, `${share.id}.${safeExt}`)
    );
    if (!fs.existsSync(target)) {
      return res.status(404).send("File non presente su disco");
    }
    const headers = getSafeDownloadHeaders(share.mimeType, share.fileName);
    res.setHeader("Content-Type", headers.contentType);
    res.setHeader("Content-Disposition", headers.disposition);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.sendFile(target);
  });
  app.post("/api/shares/:id/save-to-files", requireAuth, (req, res) => {
    try {
      const me = req.authUser;
      const shareId = String(req.params.id || "").trim();
      if (!SAFE_SHARE_ID_RE.test(shareId)) {
        return res.status(400).json({ ok: false, error: "ID non valido." });
      }
      const share = sharesRegistry.find((s) => s.id === shareId);
      if (!share) {
        return res.status(404).json({ ok: false, error: "Elemento condiviso non trovato." });
      }
      if (share.recipientId !== me.id && share.senderId !== me.id) {
        return res.status(403).json({ ok: false, error: "Accesso non autorizzato." });
      }
      const safeExt = String(share.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
      const srcPath = assertSafeChildPath(
        SHARED_FILES_DIR,
        path.join(SHARED_FILES_DIR, `${share.id}.${safeExt}`)
      );
      if (!fs.existsSync(srcPath)) {
        return res.status(404).json({ ok: false, error: "File originale mancante." });
      }
      const targetType = req.body?.target === "photos" && share.kind === "photo" ? "photos" : "files";
      const myPaths = getUserPaths(me.id);
      const myCache = getUserCache(me.id);
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      if (targetType === "photos") {
        const newPhotoId = `ph_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const photoExt = safeExt === "png" || safeExt === "webp" ? safeExt : "jpg";
        ensureDir(myPaths.photosDir);
        const destPath = assertSafeChildPath(
          myPaths.photosDir,
          path.join(myPaths.photosDir, `${newPhotoId}.${photoExt}`)
        );
        fs.copyFileSync(srcPath, destPath);
        const photoRecord = {
          id: newPhotoId,
          commessaId: share.commessaCode || "shared_team",
          commessaCode: share.commessaCode || "RICEVUTE",
          commessaTitle: `Ricevuta da ${share.senderName}`,
          caption: share.message || share.fileName,
          capturedAt: nowIso,
          width: 0,
          height: 0,
          sizeBytes: share.sizeBytes,
          mimeType: share.mimeType || "image/jpeg",
          fileExt: photoExt
        };
        saveUserPhotos(me.id, [photoRecord, ...myCache.photos]);
      } else {
        const newFileId = `fl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        ensureDir(myPaths.filesDir);
        const destPath = assertSafeChildPath(
          myPaths.filesDir,
          path.join(myPaths.filesDir, `${newFileId}.${safeExt}`)
        );
        fs.copyFileSync(srcPath, destPath);
        const fileMeta = {
          id: newFileId,
          folderId: null,
          name: share.fileName,
          mimeType: share.mimeType || "application/octet-stream",
          extension: safeExt,
          sizeBytes: share.sizeBytes,
          source: "upload",
          createdAt: nowIso,
          updatedAt: nowIso
        };
        saveUserFilesState(me.id, {
          ...myCache.filesState,
          files: [fileMeta, ...myCache.filesState.files]
        });
      }
      if (share.recipientId === me.id) {
        saveSharesRegistry(
          sharesRegistry.map(
            (s) => s.id === share.id ? { ...s, savedByRecipient: true } : s
          )
        );
      }
      return res.json({ ok: true, savedTo: targetType });
    } catch (err) {
      console.error("[CaricoStudio] Errore salvataggio file condiviso:", err);
      return res.status(500).json({ ok: false, error: "Errore salvataggio file." });
    }
  });
  app.delete("/api/shares/:id", requireAuth, (req, res) => {
    const me = req.authUser;
    const shareId = String(req.params.id || "").trim();
    if (!SAFE_SHARE_ID_RE.test(shareId)) {
      return res.status(400).json({ ok: false, error: "ID non valido." });
    }
    const existing = sharesRegistry.find((s) => s.id === shareId);
    if (!existing) {
      return res.json({ ok: true });
    }
    if (existing.senderId !== me.id && existing.recipientId !== me.id && me.role !== "employer") {
      return res.status(403).json({ ok: false, error: "Accesso non autorizzato." });
    }
    saveSharesRegistry(sharesRegistry.filter((s) => s.id !== shareId));
    const safeExt = String(existing.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
    const target = assertSafeChildPath(
      SHARED_FILES_DIR,
      path.join(SHARED_FILES_DIR, `${existing.id}.${safeExt}`)
    );
    if (fs.existsSync(target)) {
      try {
        fs.unlinkSync(target);
      } catch {
      }
    }
    return res.json({ ok: true });
  });
  app.get("/api/calendars", requireAuth, (req, res) => {
    const me = req.authUser;
    ensurePersonalCalendarForUser(me);
    const accessible = calendarsRegistry.filter((c) => userCanAccessCalendar(c, me.id)).map(hydrateCalendarForClient);
    return res.json({ ok: true, calendars: accessible });
  });
  app.post("/api/calendars", requireAuth, (req, res) => {
    try {
      const me = req.authUser;
      const body = req.body || {};
      const name = String(body.name || "").trim().slice(0, 80);
      const rawColor = String(body.color || "#6366f1").trim();
      const color = ALLOWED_CAL_COLORS.has(rawColor) ? rawColor : "#6366f1";
      const isShared = Boolean(body.isShared);
      const rawMembers = Array.isArray(body.memberIds) ? body.memberIds : [];
      if (name.length < 2) {
        return res.status(400).json({
          ok: false,
          error: "Inserisci un nome per il calendario (almeno 2 caratteri)."
        });
      }
      const validMemberIds = /* @__PURE__ */ new Set([me.id]);
      if (isShared) {
        for (const rawId of rawMembers) {
          const uid = String(rawId || "").trim();
          if (SAFE_USER_ID_RE.test(uid) && usersRegistry.some((u) => u.id === uid)) {
            validMemberIds.add(uid);
          }
        }
      }
      const newCal = {
        id: `cal_${crypto.randomBytes(10).toString("hex")}`,
        name,
        color,
        ownerId: me.id,
        ownerName: me.name,
        isShared: isShared && validMemberIds.size > 1 ? true : isShared,
        isDefaultPersonal: false,
        memberIds: Array.from(validMemberIds),
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      saveCalendarsRegistry([...calendarsRegistry, newCal]);
      const hydrated = hydrateCalendarForClient(newCal);
      for (const memberId of newCal.memberIds) {
        if (memberId !== me.id) {
          broadcastToUser(memberId, null, {
            type: "calendar_updated",
            calendarId: newCal.id
          });
          pushUserNotification(memberId, {
            category: "calendar",
            title: `Calendario condiviso: ${newCal.name}`,
            body: `${me.name} ha condiviso con te il calendario "${newCal.name}". Ora puoi leggere e aggiungere appuntamenti e appunti.`,
            targetApp: "calendar",
            meta: { calendarId: newCal.id }
          });
        }
      }
      return res.status(201).json({ ok: true, calendar: hydrated });
    } catch (err) {
      console.error("[CaricoStudio Calendar] Errore creazione calendario:", err);
      return res.status(500).json({ ok: false, error: "Errore creazione calendario." });
    }
  });
  app.patch("/api/calendars/:id", requireAuth, (req, res) => {
    const me = req.authUser;
    const calId = String(req.params.id || "").trim();
    if (!SAFE_CAL_ID_RE.test(calId)) {
      return res.status(400).json({ ok: false, error: "ID calendario non valido." });
    }
    const existing = calendarsRegistry.find((c) => c.id === calId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Calendario non trovato." });
    }
    if (existing.ownerId !== me.id) {
      return res.status(403).json({
        ok: false,
        error: "Solo il creatore pu\xF2 modificare le impostazioni o i membri del calendario."
      });
    }
    const body = req.body || {};
    const nextName = typeof body.name === "string" && body.name.trim().length >= 2 ? body.name.trim().slice(0, 80) : existing.name;
    const rawColor = String(body.color || existing.color).trim();
    const nextColor = ALLOWED_CAL_COLORS.has(rawColor) ? rawColor : existing.color;
    const prevMembers = new Set(existing.memberIds);
    const nextMemberIds = /* @__PURE__ */ new Set([me.id]);
    if (!existing.isDefaultPersonal && Array.isArray(body.memberIds)) {
      for (const rawId of body.memberIds) {
        const uid = String(rawId || "").trim();
        if (SAFE_USER_ID_RE.test(uid) && usersRegistry.some((u) => u.id === uid)) {
          nextMemberIds.add(uid);
        }
      }
    } else if (!existing.isDefaultPersonal) {
      existing.memberIds.forEach((id) => nextMemberIds.add(id));
    }
    const updated = {
      ...existing,
      name: nextName,
      color: nextColor,
      isShared: existing.isDefaultPersonal ? false : typeof body.isShared === "boolean" ? body.isShared : nextMemberIds.size > 1 || existing.isShared,
      memberIds: Array.from(nextMemberIds)
    };
    saveCalendarsRegistry(
      calendarsRegistry.map((c) => c.id === calId ? updated : c)
    );
    const allImpacted = /* @__PURE__ */ new Set([...updated.memberIds, ...Array.from(prevMembers)]);
    for (const memberId of allImpacted) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: "calendar_updated",
          calendarId: updated.id
        });
        if (!prevMembers.has(memberId) && updated.memberIds.includes(memberId)) {
          pushUserNotification(memberId, {
            category: "calendar",
            title: `Aggiunto al calendario "${updated.name}"`,
            body: `${me.name} ti ha aggiunto al calendario condiviso "${updated.name}".`,
            targetApp: "calendar",
            meta: { calendarId: updated.id }
          });
        }
      }
    }
    return res.json({ ok: true, calendar: hydrateCalendarForClient(updated) });
  });
  app.delete("/api/calendars/:id", requireAuth, (req, res) => {
    const me = req.authUser;
    const calId = String(req.params.id || "").trim();
    if (!SAFE_CAL_ID_RE.test(calId)) {
      return res.status(400).json({ ok: false, error: "ID calendario non valido." });
    }
    const existing = calendarsRegistry.find((c) => c.id === calId);
    if (!existing) {
      return res.json({ ok: true });
    }
    if (existing.ownerId !== me.id) {
      return res.status(403).json({
        ok: false,
        error: "Solo il creatore pu\xF2 eliminare questo calendario."
      });
    }
    if (existing.isDefaultPersonal) {
      return res.status(400).json({
        ok: false,
        error: "Il calendario personale principale non pu\xF2 essere eliminato."
      });
    }
    saveCalendarsRegistry(calendarsRegistry.filter((c) => c.id !== calId));
    saveCalendarEventsRegistry(
      calendarEventsRegistry.filter((ev) => ev.calendarId !== calId)
    );
    for (const memberId of existing.memberIds) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: "calendar_updated",
          calendarId: calId
        });
      }
    }
    return res.json({ ok: true });
  });
  app.get("/api/calendar/events", requireAuth, (req, res) => {
    const me = req.authUser;
    ensurePersonalCalendarForUser(me);
    const accessibleIds = new Set(
      calendarsRegistry.filter((c) => userCanAccessCalendar(c, me.id)).map((c) => c.id)
    );
    const events = calendarEventsRegistry.filter((ev) => accessibleIds.has(ev.calendarId)).sort(
      (a, b) => `${a.date}T${a.time || "00:00"}`.localeCompare(`${b.date}T${b.time || "00:00"}`)
    );
    return res.json({ ok: true, events });
  });
  app.post("/api/calendar/events", requireAuth, (req, res) => {
    try {
      const me = req.authUser;
      const body = req.body || {};
      const calendarId = String(body.calendarId || "").trim();
      const date = String(body.date || "").trim();
      const rawTime = String(body.time || "").trim();
      const rawEndTime = String(body.endTime || "").trim();
      const title = String(body.title || "").trim().slice(0, 140);
      const notes = String(body.notes || "").trim().slice(0, 2e3);
      const commessaCode = String(body.commessaCode || "").trim().slice(0, 60);
      const allowedKinds = /* @__PURE__ */ new Set(["appuntamento", "appunto", "promemoria", "spedizione"]);
      const kind = allowedKinds.has(String(body.kind)) ? String(body.kind) : "appuntamento";
      if (!SAFE_CAL_ID_RE.test(calendarId)) {
        return res.status(400).json({ ok: false, error: "Calendario non valido." });
      }
      const cal = calendarsRegistry.find((c) => c.id === calendarId);
      if (!cal || !userCanAccessCalendar(cal, me.id)) {
        return res.status(403).json({
          ok: false,
          error: "Non hai i permessi per scrivere in questo calendario."
        });
      }
      if (!SAFE_DATE_RE.test(date)) {
        return res.status(400).json({ ok: false, error: "Data non valida (YYYY-MM-DD)." });
      }
      if (title.length < 1) {
        return res.status(400).json({ ok: false, error: "Inserisci un titolo." });
      }
      const time = rawTime && SAFE_TIME_RE.test(rawTime) ? rawTime : void 0;
      const endTime = rawEndTime && SAFE_TIME_RE.test(rawEndTime) ? rawEndTime : void 0;
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const newEvt = {
        id: `evt_${crypto.randomBytes(10).toString("hex")}`,
        calendarId: cal.id,
        date,
        time,
        endTime,
        title,
        notes: notes || void 0,
        kind,
        commessaCode: commessaCode || void 0,
        authorId: me.id,
        authorName: me.name,
        createdAt: nowIso,
        updatedAt: nowIso
      };
      saveCalendarEventsRegistry([...calendarEventsRegistry, newEvt]);
      const kindLabel = kind === "appunto" ? "Appunto" : kind === "promemoria" ? "Promemoria" : kind === "spedizione" ? "Spedizione" : "Appuntamento";
      for (const memberId of cal.memberIds) {
        if (memberId !== me.id) {
          broadcastToUser(memberId, null, {
            type: "calendar_updated",
            calendarId: cal.id,
            eventId: newEvt.id
          });
          pushUserNotification(memberId, {
            category: "calendar",
            title: `${kindLabel} su "${cal.name}": ${title}`,
            body: `${me.name} ha aggiunto "${title}" per il ${date.split("-").reverse().join("/")}${time ? ` alle ${time}` : ""}${notes ? ` \u2014 ${notes.slice(0, 100)}` : ""}`,
            targetApp: "calendar",
            meta: {
              calendarId: cal.id,
              eventId: newEvt.id,
              eventDate: date,
              commessaCode: commessaCode || void 0
            }
          });
        }
      }
      return res.status(201).json({ ok: true, event: newEvt });
    } catch (err) {
      console.error("[CaricoStudio Calendar] Errore salvataggio evento:", err);
      return res.status(500).json({ ok: false, error: "Errore salvataggio evento." });
    }
  });
  app.patch("/api/calendar/events/:id", requireAuth, (req, res) => {
    const me = req.authUser;
    const evtId = String(req.params.id || "").trim();
    if (!SAFE_EVT_ID_RE.test(evtId)) {
      return res.status(400).json({ ok: false, error: "ID evento non valido." });
    }
    const existing = calendarEventsRegistry.find((e) => e.id === evtId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Elemento non trovato." });
    }
    const cal = calendarsRegistry.find((c) => c.id === existing.calendarId);
    if (!cal || !userCanAccessCalendar(cal, me.id)) {
      return res.status(403).json({ ok: false, error: "Accesso negato." });
    }
    const body = req.body || {};
    const nextDate = typeof body.date === "string" && SAFE_DATE_RE.test(body.date.trim()) ? body.date.trim() : existing.date;
    const rawTime = typeof body.time === "string" ? body.time.trim() : existing.time || "";
    const rawEnd = typeof body.endTime === "string" ? body.endTime.trim() : existing.endTime || "";
    const nextTitle = typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim().slice(0, 140) : existing.title;
    const nextNotes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2e3) : existing.notes;
    const nextCommessa = typeof body.commessaCode === "string" ? body.commessaCode.trim().slice(0, 60) : existing.commessaCode;
    const allowedKinds = /* @__PURE__ */ new Set(["appuntamento", "appunto", "promemoria", "spedizione"]);
    const nextKind = typeof body.kind === "string" && allowedKinds.has(body.kind) ? body.kind : existing.kind;
    const updated = {
      ...existing,
      date: nextDate,
      time: rawTime && SAFE_TIME_RE.test(rawTime) ? rawTime : void 0,
      endTime: rawEnd && SAFE_TIME_RE.test(rawEnd) ? rawEnd : void 0,
      title: nextTitle,
      notes: nextNotes || void 0,
      kind: nextKind,
      commessaCode: nextCommessa || void 0,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveCalendarEventsRegistry(
      calendarEventsRegistry.map((e) => e.id === evtId ? updated : e)
    );
    for (const memberId of cal.memberIds) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: "calendar_updated",
          calendarId: cal.id,
          eventId: updated.id
        });
      }
    }
    return res.json({ ok: true, event: updated });
  });
  app.delete("/api/calendar/events/:id", requireAuth, (req, res) => {
    const me = req.authUser;
    const evtId = String(req.params.id || "").trim();
    if (!SAFE_EVT_ID_RE.test(evtId)) {
      return res.status(400).json({ ok: false, error: "ID evento non valido." });
    }
    const existing = calendarEventsRegistry.find((e) => e.id === evtId);
    if (!existing) {
      return res.json({ ok: true });
    }
    const cal = calendarsRegistry.find((c) => c.id === existing.calendarId);
    if (!cal || !userCanAccessCalendar(cal, me.id)) {
      return res.status(403).json({ ok: false, error: "Accesso negato." });
    }
    saveCalendarEventsRegistry(calendarEventsRegistry.filter((e) => e.id !== evtId));
    for (const memberId of cal.memberIds) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: "calendar_updated",
          calendarId: cal.id
        });
      }
    }
    return res.json({ ok: true });
  });
  app.get("/api/notifications", requireAuth, (req, res) => {
    const me = req.authUser;
    const items = notificationsRegistry.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 120);
    return res.json({ ok: true, notifications: items });
  });
  app.post("/api/notifications/read", requireAuth, (req, res) => {
    const me = req.authUser;
    const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    const markAll = Boolean(req.body?.all);
    if (markAll) {
      saveNotificationsRegistry(
        notificationsRegistry.map(
          (n) => n.userId === me.id ? { ...n, read: true } : n
        )
      );
      return res.json({ ok: true });
    }
    if (!SAFE_NOTIF_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID notifica non valido." });
    }
    saveNotificationsRegistry(
      notificationsRegistry.map(
        (n) => n.id === id && n.userId === me.id ? { ...n, read: true } : n
      )
    );
    return res.json({ ok: true });
  });
  app.delete("/api/notifications/:id", requireAuth, (req, res) => {
    const me = req.authUser;
    const id = String(req.params.id || "").trim();
    if (!SAFE_NOTIF_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: "ID notifica non valido." });
    }
    saveNotificationsRegistry(
      notificationsRegistry.filter((n) => !(n.id === id && n.userId === me.id))
    );
    return res.json({ ok: true });
  });
  app.get(
    "/api/employer/overview",
    requireAuth,
    requireEmployer,
    (_req, res) => {
      try {
        const profiles = [];
        const allCommesse = [];
        const allMovements = [];
        for (const u of usersRegistry) {
          const pub = toPublicUser(u);
          const cache = getUserCache(u.id);
          const loads = Array.isArray(cache.loads) ? cache.loads : [];
          const movements = Array.isArray(cache.inventory?.movements) ? cache.inventory.movements : [];
          const photos = Array.isArray(cache.photos) ? cache.photos : [];
          const files = Array.isArray(cache.filesState?.files) ? cache.filesState.files : [];
          let palletsCount = 0;
          let boxesCount = 0;
          let totalWeightKg = 0;
          for (const l of loads) {
            const pArr = Array.isArray(l?.pallets) ? l.pallets : [];
            const bArr = Array.isArray(l?.boxes) ? l.boxes : [];
            const iArr = Array.isArray(l?.items) ? l.items : [];
            palletsCount += pArr.length;
            boxesCount += bArr.length;
            let loadWeight = 0;
            for (const p of pArr) {
              if (p?.customWeightKg !== void 0 && p?.customWeightKg !== null) {
                loadWeight += Number(p.customWeightKg) || 0;
              } else {
                loadWeight += Number(p?.tareKg) || 0;
                const pBoxes = bArr.filter((b) => b?.palletId === p?.id);
                const pBoxIds = new Set(pBoxes.map((b) => b.id));
                loadWeight += pBoxes.reduce((s, b) => s + (Number(b?.tareKg) || 0), 0);
                loadWeight += iArr.filter(
                  (it) => it?.palletId === p?.id || it?.boxId && pBoxIds.has(it.boxId)
                ).reduce(
                  (s, it) => s + (Number(it?.quantity) || 0) * (Number(it?.unitWeightKg) || 0),
                  0
                );
              }
            }
            totalWeightKg += loadWeight;
            allCommesse.push({
              ownerId: pub.id,
              ownerName: pub.name,
              ownerCompany: pub.company || "",
              ownerRole: pub.role,
              id: l.id,
              code: l.code || "COM",
              title: l.title || "Commessa",
              client: l.client || "",
              destination: l.destination || "",
              carrier: l.carrier || "",
              departureDate: l.departureDate || "",
              status: l.status || "in_preparazione",
              palletsCount: pArr.length,
              boxesCount: bArr.length,
              itemsCount: iArr.length,
              checkedItemsCount: iArr.filter((it) => Boolean(it?.checked)).length,
              weightKg: Math.round(loadWeight),
              loadedAt: l.loadedAt || null,
              shippedAt: l.shippedAt || l.handoverProof?.handoverAt || null,
              pallets: pArr,
              boxes: bArr,
              items: iArr
            });
          }
          let carichiCount = 0;
          let scarichiCount = 0;
          for (const m of movements) {
            if (m?.type === "carico") carichiCount++;
            else if (m?.type === "scarico") scarichiCount++;
            allMovements.push({
              ...m,
              ownerId: pub.id,
              ownerName: pub.name,
              ownerCompany: pub.company || ""
            });
          }
          profiles.push({
            ...pub,
            isOnline: getOnlineCountForUser(u.id) > 0,
            stats: {
              commesseCount: loads.length,
              palletsCount,
              boxesCount,
              totalWeightKg: Math.round(totalWeightKg),
              movementsCount: movements.length,
              carichiCount,
              scarichiCount,
              photosCount: photos.length,
              filesCount: files.length
            }
          });
        }
        allMovements.sort(
          (a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
        );
        const totals = profiles.reduce(
          (acc, p) => {
            acc.usersCount += 1;
            if (p.isOnline) acc.onlineUsersCount += 1;
            acc.commesseCount += p.stats.commesseCount;
            acc.palletsCount += p.stats.palletsCount;
            acc.movementsCount += p.stats.movementsCount;
            acc.carichiCount += p.stats.carichiCount;
            acc.scarichiCount += p.stats.scarichiCount;
            acc.photosCount += p.stats.photosCount;
            acc.filesCount += p.stats.filesCount;
            return acc;
          },
          {
            usersCount: 0,
            onlineUsersCount: 0,
            commesseCount: 0,
            palletsCount: 0,
            movementsCount: 0,
            carichiCount: 0,
            scarichiCount: 0,
            photosCount: 0,
            filesCount: 0,
            sharesCount: sharesRegistry.length
          }
        );
        return res.json({
          ok: true,
          totals,
          profiles,
          allCommesse,
          allMovements
        });
      } catch (err) {
        console.error("[CaricoStudio Employer] Errore overview:", err);
        return res.status(500).json({ ok: false, error: "Errore caricamento panoramica." });
      }
    }
  );
  app.get("/api/system/metrics", requireAuth, (_req, res) => {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = Math.max(0, totalMem - freeMem);
      const procMem = process.memoryUsage();
      const disk = getHostDiskStats();
      const rawIfaces = os.networkInterfaces();
      const networkInterfaces = [];
      for (const [ifaceName, addrs] of Object.entries(rawIfaces)) {
        if (!addrs) continue;
        for (const a of addrs) {
          if (a.family === "IPv4" || a.family === "IPv6") {
            networkInterfaces.push({
              name: ifaceName,
              address: a.address,
              family: a.family,
              mac: a.mac,
              internal: a.internal,
              cidr: a.cidr || null
            });
          }
        }
      }
      const activeWsCount = wss.clients.size;
      const activeSessionsCount = sessionsRegistry.filter(
        (s) => new Date(s.expiresAt).getTime() > Date.now()
      ).length;
      return res.json({
        ok: true,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        host: {
          nodeName: systemSettings.nodeName,
          hostname: os.hostname(),
          hostnameLabel: systemSettings.hostnameLabel,
          platform: os.platform(),
          release: os.release(),
          arch: os.arch(),
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(os.uptime()),
          processUptimeSeconds: Math.floor(process.uptime()),
          port: PORT
        },
        cpu: {
          model: cpus[0]?.model || "CPU Server",
          cores: cpus.length,
          speedMhz: cpus[0]?.speed || 0,
          usagePercent: latestCpuPercent,
          perCorePercent: latestCorePercents,
          loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100)
        },
        memory: {
          totalBytes: totalMem,
          usedBytes: usedMem,
          freeBytes: freeMem,
          usedPercent: totalMem > 0 ? Math.round(usedMem / totalMem * 1e3) / 10 : 0,
          processRssBytes: procMem.rss,
          processHeapUsedBytes: procMem.heapUsed
        },
        disk,
        networkInterfaces,
        services: [
          {
            id: "http-core",
            name: "METATRON HTTP / API Core",
            status: "active",
            detail: `Porta ${PORT} \xB7 Node ${process.version}`
          },
          {
            id: "ws-sync",
            name: "Motore Sincronizzazione WebSocket",
            status: "active",
            detail: `${activeWsCount} client connessi in tempo reale`
          },
          {
            id: "storage-engine",
            name: "Storage Persistente & Backup",
            status: "active",
            detail: `${usersRegistry.length} profili \xB7 ${sharesRegistry.length} scambi team`
          },
          {
            id: "auth-vault",
            name: "Servizio Autenticazione & Sessioni",
            status: "active",
            detail: `${activeSessionsCount} sessioni attive autenticate`
          },
          {
            id: "calendar-hub",
            name: "Hub Calendari & Centro Notifiche",
            status: "active",
            detail: `${calendarsRegistry.length} calendari \xB7 ${calendarEventsRegistry.length} eventi`
          }
        ],
        history: telemetryHistory
      });
    } catch (err) {
      console.error("[METATRON OS] Errore lettura metriche:", err);
      return res.status(500).json({ ok: false, error: "Errore lettura telemetria server." });
    }
  });
  app.get("/api/system/storage", requireAuth, (req, res) => {
    try {
      const isEmployer = req.authUser?.role === "employer";
      const disk = getHostDiskStats();
      const usersStats = getDirectoryStats(USERS_DIR);
      const sharedStats = getDirectoryStats(SHARED_FILES_DIR);
      const backupsStats = getDirectoryStats(BACKUPS_DIR);
      const totalDataStats = getDirectoryStats(DATA_ROOT);
      let backups = [];
      if (isEmployer && fs.existsSync(BACKUPS_DIR)) {
        backups = fs.readdirSync(BACKUPS_DIR).filter((name) => SAFE_BACKUP_FILENAME_RE.test(name)).map((filename) => {
          const full = path.join(BACKUPS_DIR, filename);
          const st = fs.statSync(full);
          return {
            filename,
            sizeBytes: st.size,
            createdAt: st.mtime.toISOString()
          };
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      return res.json({
        ok: true,
        disk,
        volumes: [
          {
            id: "users_vault",
            label: "Archivi Utenti (Commesse, Magazzino, Foto, File)",
            bytes: usersStats.bytes,
            files: usersStats.files
          },
          {
            id: "team_shares",
            label: "Scambio File & Foto Team",
            bytes: sharedStats.bytes,
            files: sharedStats.files
          },
          {
            id: "snapshots",
            label: "Snapshot di Backup Server",
            bytes: backupsStats.bytes,
            files: backupsStats.files
          },
          {
            id: "total_data",
            label: "Totale Directory Dati METATRON",
            bytes: totalDataStats.bytes,
            files: totalDataStats.files
          }
        ],
        backups
      });
    } catch (err) {
      console.error("[METATRON OS] Errore storage:", err);
      return res.status(500).json({ ok: false, error: "Errore lettura volumi storage." });
    }
  });
  app.post(
    "/api/system/backups",
    requireAuth,
    requireEmployer,
    (req, res) => {
      try {
        const me = req.authUser;
        ensureDir(BACKUPS_DIR);
        const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "").replace(/:/g, "-");
        const filename = `metatron-backup-${stamp}.json`;
        const resolved = path.resolve(BACKUPS_DIR, filename);
        if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
          return res.status(400).json({ ok: false, error: "Percorso backup non valido." });
        }
        const userWorkspaces = usersRegistry.map((u) => {
          const cache = getUserCache(u.id);
          return {
            user: toPublicUser(u),
            loadsCount: Array.isArray(cache.loads) ? cache.loads.length : 0,
            loads: cache.loads || [],
            inventory: cache.inventory || { items: [], movements: [], hiddenCommessaCodes: [] },
            photosIndex: cache.photos || [],
            filesIndex: cache.filesState || { folders: [], files: [] }
          };
        });
        const snapshot = {
          format: "metatron-server-os-snapshot-v1",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: { id: me.id, name: me.name, role: me.role },
          serverNode: {
            nodeName: systemSettings.nodeName,
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch()
          },
          systemSettings,
          calendars: calendarsRegistry,
          calendarEvents: calendarEventsRegistry,
          sharesIndex: sharesRegistry,
          workspaces: userWorkspaces
        };
        const rawJson = JSON.stringify(snapshot, null, 2);
        fs.writeFileSync(resolved, rawJson, "utf-8");
        const st = fs.statSync(resolved);
        addSystemLog(
          "info",
          "Backup Engine",
          `Snapshot ${filename} creato da ${me.name} (${Math.round(st.size / 1024)} KB)`,
          true
        );
        return res.status(201).json({
          ok: true,
          backup: {
            filename,
            sizeBytes: st.size,
            createdAt: st.mtime.toISOString()
          }
        });
      } catch (err) {
        console.error("[METATRON OS] Errore creazione backup:", err);
        addSystemLog("error", "Backup Engine", "Errore durante la creazione dello snapshot", true);
        return res.status(500).json({ ok: false, error: "Impossibile creare lo snapshot." });
      }
    }
  );
  app.get(
    "/api/system/backups/:filename",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const filename = String(req.params.filename || "").trim();
      if (!SAFE_BACKUP_FILENAME_RE.test(filename)) {
        return res.status(400).json({ ok: false, error: "Nome file backup non valido." });
      }
      const resolved = path.resolve(BACKUPS_DIR, filename);
      if (!resolved.startsWith(BACKUPS_DIR + path.sep) || !fs.existsSync(resolved)) {
        return res.status(404).json({ ok: false, error: "Backup non trovato." });
      }
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.sendFile(resolved);
    }
  );
  app.delete(
    "/api/system/backups/:filename",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const filename = String(req.params.filename || "").trim();
      if (!SAFE_BACKUP_FILENAME_RE.test(filename)) {
        return res.status(400).json({ ok: false, error: "Nome file backup non valido." });
      }
      const resolved = path.resolve(BACKUPS_DIR, filename);
      if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
        return res.status(400).json({ ok: false, error: "Percorso non consentito." });
      }
      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
        addSystemLog(
          "warn",
          "Backup Engine",
          `Snapshot ${filename} eliminato da ${req.authUser.name}`,
          true
        );
      }
      return res.json({ ok: true });
    }
  );
  app.get(
    "/api/system/sessions",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const now = Date.now();
      const currentHash = req.sessionTokenHash || "";
      const active = sessionsRegistry.filter((s) => new Date(s.expiresAt).getTime() > now).map((s) => {
        const u = usersRegistry.find((usr) => usr.id === s.userId);
        return {
          sessionPrefix: s.tokenHash.slice(0, 12),
          userId: s.userId,
          userName: u?.name || "Utente",
          userEmail: u?.email || "",
          userRole: u?.role === "employer" ? "employer" : "worker",
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          isCurrent: s.tokenHash === currentHash,
          isOnlineWs: getOnlineCountForUser(s.userId) > 0
        };
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return res.json({ ok: true, sessions: active });
    }
  );
  app.delete(
    "/api/system/sessions/:sessionPrefix",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const prefix = String(req.params.sessionPrefix || "").trim();
      if (!SAFE_SESSION_PREFIX_RE.test(prefix)) {
        return res.status(400).json({ ok: false, error: "Identificativo sessione non valido." });
      }
      if (req.sessionTokenHash && req.sessionTokenHash.startsWith(prefix)) {
        return res.status(400).json({
          ok: false,
          error: "Non puoi revocare la tua sessione corrente da questa schermata."
        });
      }
      const before = sessionsRegistry.length;
      sessionsRegistry = sessionsRegistry.filter((s) => !s.tokenHash.startsWith(prefix));
      if (sessionsRegistry.length !== before) {
        writeJsonFile(SESSIONS_FILE, sessionsRegistry);
        addSystemLog(
          "warn",
          "Auth Vault",
          `Sessione ${prefix}\u2026 revocata da ${req.authUser.name}`,
          true
        );
      }
      return res.json({ ok: true });
    }
  );
  app.get("/api/system/logs", requireAuth, (req, res) => {
    const isEmployer = req.authUser?.role === "employer";
    const levelFilter = String(req.query.level || "all").trim();
    const filtered = systemLogs.filter((entry) => {
      if (!isEmployer && entry.adminOnly) return false;
      if (levelFilter !== "all" && entry.level !== levelFilter) return false;
      return true;
    });
    return res.json({ ok: true, logs: filtered.slice(0, 120) });
  });
  app.get("/api/system/settings", requireAuth, (_req, res) => {
    return res.json({ ok: true, settings: systemSettings });
  });
  app.patch(
    "/api/system/settings",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const body = req.body || {};
      const nextNodeName = typeof body.nodeName === "string" && body.nodeName.trim().length >= 2 ? body.nodeName.trim().replace(/[^a-zA-Z0-9._ -]/g, "").slice(0, 48) : systemSettings.nodeName;
      const nextHostLabel = typeof body.hostnameLabel === "string" && body.hostnameLabel.trim().length >= 2 ? body.hostnameLabel.trim().replace(/[^a-zA-Z0-9.-]/g, "").slice(0, 64) : systemSettings.hostnameLabel;
      const nextTimezone = typeof body.timezone === "string" && body.timezone.trim().length >= 3 ? body.timezone.trim().replace(/[^a-zA-Z0-9/_+-]/g, "").slice(0, 48) : systemSettings.timezone;
      const nextKiosk = typeof body.kioskBootDefault === "boolean" ? body.kioskBootDefault : systemSettings.kioskBootDefault;
      const nextAutoBackup = typeof body.autoBackupEnabled === "boolean" ? body.autoBackupEnabled : systemSettings.autoBackupEnabled;
      const nextInterval = typeof body.autoBackupIntervalHours === "number" && Number.isFinite(body.autoBackupIntervalHours) ? Math.max(1, Math.min(168, Math.round(body.autoBackupIntervalHours))) : systemSettings.autoBackupIntervalHours;
      const nextBanner = typeof body.maintenanceBanner === "string" ? body.maintenanceBanner.trim().slice(0, 180) : systemSettings.maintenanceBanner;
      systemSettings = {
        nodeName: nextNodeName || DEFAULT_SYSTEM_SETTINGS.nodeName,
        hostnameLabel: nextHostLabel || DEFAULT_SYSTEM_SETTINGS.hostnameLabel,
        timezone: nextTimezone || DEFAULT_SYSTEM_SETTINGS.timezone,
        kioskBootDefault: nextKiosk,
        autoBackupEnabled: nextAutoBackup,
        autoBackupIntervalHours: nextInterval,
        maintenanceBanner: nextBanner,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      writeJsonFile(SYSTEM_SETTINGS_FILE, systemSettings);
      addSystemLog(
        "info",
        "System Config",
        `Configurazione nodo "${systemSettings.nodeName}" aggiornata da ${req.authUser.name}`,
        true
      );
      return res.json({ ok: true, settings: systemSettings });
    }
  );
  app.get("/api/system/deploy-artifacts", requireAuth, (_req, res) => {
    const items = Object.entries(ALLOWED_DEPLOY_ARTIFACTS).map(([key, meta]) => {
      const baseDir = DEPLOY_ARTIFACT_BASE_DIRS[meta.base];
      const full = path.resolve(baseDir, meta.fileName);
      const exists = full.startsWith(baseDir + path.sep) && fs.existsSync(full);
      const sizeBytes = exists ? fs.statSync(full).size : 0;
      return {
        key,
        fileName: meta.fileName,
        relativePath: `${DEPLOY_ARTIFACT_PATH_PREFIX[meta.base]}/${meta.fileName}`,
        title: meta.title,
        description: meta.description,
        category: meta.category,
        available: exists,
        sizeBytes
      };
    });
    return res.json({ ok: true, artifacts: items });
  });
  app.get("/api/system/deploy-artifacts/:key", requireAuth, (req, res) => {
    const key = String(req.params.key || "").trim();
    const meta = ALLOWED_DEPLOY_ARTIFACTS[key];
    if (!meta) {
      return res.status(404).json({ ok: false, error: "Pacchetto installer non trovato." });
    }
    const baseDir = DEPLOY_ARTIFACT_BASE_DIRS[meta.base];
    const resolved = path.resolve(baseDir, meta.fileName);
    if (!resolved.startsWith(baseDir + path.sep) || !fs.existsSync(resolved)) {
      return res.status(404).json({ ok: false, error: "File installer non presente." });
    }
    const download = req.query.download === "1";
    if (download) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${meta.fileName}"`);
      if (meta.fileName.toLowerCase().endsWith(".bat")) {
        const crlf = fs.readFileSync(resolved, "utf-8").replace(/\r?\n/g, "\r\n");
        return res.send(crlf);
      }
      return res.sendFile(resolved);
    }
    const content = fs.readFileSync(resolved, "utf-8");
    return res.json({
      ok: true,
      key,
      fileName: meta.fileName,
      relativePath: `${DEPLOY_ARTIFACT_PATH_PREFIX[meta.base]}/${meta.fileName}`,
      title: meta.title,
      content
    });
  });
  app.get("/api/system/desktop-project-zip", requireAuth, (_req, res) => {
    try {
      const projectRoot = path.resolve(process.cwd());
      const zipEntries = {};
      const zipPrefix = "METATRON-Desktop-Builder";
      const allowedRootFiles = [
        "package.json",
        "tsconfig.json",
        "vite.config.ts",
        "index.html",
        "metadata.json",
        "server.ts",
        ".env.example",
        ".gitignore"
      ];
      const allowedDirs = [
        "src",
        "public",
        "scripts",
        "desktop-app",
        "os-installer",
        path.join(".github", "workflows")
      ];
      const skippedFileNames = /* @__PURE__ */ new Set(["CaricoStudio_Desktop_Windows.html"]);
      const addSafeFile = (absPath, zipRelPath) => {
        const resolved = path.resolve(absPath);
        if (!resolved.startsWith(projectRoot + path.sep)) return;
        let stat;
        try {
          stat = fs.lstatSync(resolved);
        } catch {
          return;
        }
        if (stat.isSymbolicLink() || !stat.isFile()) return;
        const baseName = path.basename(resolved);
        if (skippedFileNames.has(baseName)) return;
        if (baseName.toLowerCase().endsWith(".bat")) {
          const crlfText = fs.readFileSync(resolved, "utf-8").replace(/\r?\n/g, "\r\n");
          zipEntries[`${zipPrefix}/${zipRelPath}`] = Buffer.from(crlfText, "utf-8");
        } else {
          zipEntries[`${zipPrefix}/${zipRelPath}`] = new Uint8Array(
            fs.readFileSync(resolved)
          );
        }
      };
      const walkAllowedDir = (relDir) => {
        const absDir = path.resolve(projectRoot, relDir);
        if (!absDir.startsWith(projectRoot + path.sep) || !fs.existsSync(absDir)) return;
        const entries = fs.readdirSync(absDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          if (entry.name === "node_modules" || entry.name === ".git") continue;
          const childRel = path.posix.join(relDir.replace(/\\/g, "/"), entry.name);
          const childAbs = path.join(absDir, entry.name);
          if (entry.isDirectory()) {
            walkAllowedDir(childRel);
          } else if (entry.isFile()) {
            addSafeFile(childAbs, childRel);
          }
        }
      };
      for (const fileName of allowedRootFiles) {
        addSafeFile(path.join(projectRoot, fileName), fileName);
      }
      for (const dirName of allowedDirs) {
        walkAllowedDir(dirName);
      }
      const winBatAbs = path.join(DESKTOP_APP_DIR, "CREA-SOFTWARE-WINDOWS.bat");
      if (fs.existsSync(winBatAbs)) {
        addSafeFile(winBatAbs, "CREA-SOFTWARE-WINDOWS.bat");
      }
      const zipped = zipSync(zipEntries, { level: 6 });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="METATRON-Desktop-Builder.zip"'
      );
      res.setHeader("Cache-Control", "no-store");
      return res.send(Buffer.from(zipped));
    } catch (err) {
      console.error("[METATRON Desktop ZIP] Errore generazione pacchetto:", err);
      return res.status(500).json({
        ok: false,
        error: "Errore durante la creazione del pacchetto ZIP."
      });
    }
  });
  app.get(
    "/api/employer/users/:userId/details",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const targetUserId = String(req.params.userId || "").trim();
      if (!SAFE_USER_ID_RE.test(targetUserId)) {
        return res.status(400).json({ ok: false, error: "ID utente non valido." });
      }
      const stored = usersRegistry.find((u) => u.id === targetUserId);
      if (!stored) {
        return res.status(404).json({ ok: false, error: "Profilo utente non trovato." });
      }
      const cache = getUserCache(targetUserId);
      return res.json({
        ok: true,
        profile: {
          ...toPublicUser(stored),
          isOnline: getOnlineCountForUser(targetUserId) > 0
        },
        loads: cache.loads,
        inventory: cache.inventory || { items: [], movements: [], hiddenCommessaCodes: [] },
        photos: cache.photos,
        filesState: cache.filesState
      });
    }
  );
  app.get(
    "/api/employer/users/:userId/photos/:photoId/file",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const targetUserId = String(req.params.userId || "").trim();
      const photoId = String(req.params.photoId || "").trim();
      if (!SAFE_USER_ID_RE.test(targetUserId) || !SAFE_PHOTO_ID_RE.test(photoId)) {
        return res.status(400).send("Parametri non validi");
      }
      const cache = getUserCache(targetUserId);
      const meta = cache.photos.find((p) => p.id === photoId);
      if (!meta) return res.status(404).send("Foto non trovata");
      const paths = getUserPaths(targetUserId);
      const safeExt = String(meta.fileExt || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "jpg";
      const target = assertSafeChildPath(
        paths.photosDir,
        path.join(paths.photosDir, `${photoId}.${safeExt}`)
      );
      if (!fs.existsSync(target)) return res.status(404).send("Foto mancante");
      const headers = getSafeDownloadHeaders(meta.mimeType || "image/jpeg", `${photoId}.${safeExt}`);
      res.setHeader("Content-Type", headers.contentType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.sendFile(target);
    }
  );
  app.get(
    "/api/employer/users/:userId/files/:fileId/download",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const targetUserId = String(req.params.userId || "").trim();
      const fileId = String(req.params.fileId || "").trim();
      if (!SAFE_USER_ID_RE.test(targetUserId) || !SAFE_FILE_ID_RE.test(fileId)) {
        return res.status(400).send("Parametri non validi");
      }
      const cache = getUserCache(targetUserId);
      const meta = cache.filesState.files.find((f) => f.id === fileId);
      if (!meta) return res.status(404).send("File non trovato");
      const paths = getUserPaths(targetUserId);
      const safeExt = String(meta.extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "bin";
      const target = assertSafeChildPath(
        paths.filesDir,
        path.join(paths.filesDir, `${fileId}.${safeExt}`)
      );
      if (!fs.existsSync(target)) return res.status(404).send("File mancante");
      const headers = getSafeDownloadHeaders(meta.mimeType || "application/octet-stream", meta.name || fileId);
      res.setHeader("Content-Type", headers.contentType);
      res.setHeader("Content-Disposition", headers.disposition);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=3600");
      return res.sendFile(target);
    }
  );
  app.patch(
    "/api/employer/users/:userId/role",
    requireAuth,
    requireEmployer,
    (req, res) => {
      const targetUserId = String(req.params.userId || "").trim();
      const nextRole = req.body?.role === "employer" ? "employer" : "worker";
      if (!SAFE_USER_ID_RE.test(targetUserId)) {
        return res.status(400).json({ ok: false, error: "ID utente non valido." });
      }
      const target = usersRegistry.find((u) => u.id === targetUserId);
      if (!target) {
        return res.status(404).json({ ok: false, error: "Utente non trovato." });
      }
      if (target.role === "employer" && nextRole !== "employer") {
        const employerCount = usersRegistry.filter((u) => u.role === "employer").length;
        if (employerCount <= 1) {
          return res.status(400).json({
            ok: false,
            error: "Deve rimanere almeno un account Datore di Lavoro attivo."
          });
        }
      }
      usersRegistry = usersRegistry.map(
        (u) => u.id === targetUserId ? { ...u, role: nextRole } : u
      );
      writeJsonFile(USERS_FILE, usersRegistry);
      const updated = usersRegistry.find((u) => u.id === targetUserId);
      return res.json({ ok: true, user: toPublicUser(updated) });
    }
  );
  function decodeLoadFromQuery(dString) {
    if (!dString || typeof dString !== "string") return null;
    try {
      const buf = Buffer.from(dString, "base64url");
      let decompressed;
      try {
        decompressed = zlib.inflateRawSync(buf);
      } catch {
        decompressed = zlib.inflateSync(buf);
      }
      const parsed = JSON.parse(decompressed.toString("utf-8"));
      if (!parsed) return null;
      const items = (parsed.i || parsed.items || []).map((it) => ({
        id: it.id || "it_" + Math.random().toString(36).substring(2, 7),
        sku: it.s || it.sku || "\u2014",
        name: it.n || it.name || "Articolo",
        quantity: it.q !== void 0 ? Number(it.q) : Number(it.quantity || 1),
        unitWeightKg: it.w !== void 0 ? Number(it.w) : Number(it.unitWeightKg || 0),
        palletId: it.pid || it.palletId || null,
        boxId: it.bid || it.boxId || null
      }));
      const pallets = (parsed.p || parsed.pallets || []).map((p) => ({
        id: p.id || "p_" + Math.random().toString(36).substring(2, 7),
        code: p.c || p.code || "BANCALE",
        label: p.l || p.label || "Bancale",
        type: p.t || p.type || "EUR_EPAL_1"
      }));
      const boxes = (parsed.b || parsed.boxes || []).map((b) => ({
        id: b.id || "b_" + Math.random().toString(36).substring(2, 7),
        code: b.c || b.code || "SCATOLA",
        label: b.l || b.label || "Scatola",
        palletId: b.pid || b.palletId || null
      }));
      return {
        code: (parsed.c || parsed.code || "CARICO").trim(),
        title: parsed.t || parsed.title || "Nuova Commessa Spedizione",
        client: parsed.cl || parsed.client || "\u2014",
        destination: parsed.d || parsed.destination || "\u2014",
        carrier: parsed.cr || parsed.carrier || "\u2014",
        departureDate: parsed.dt || parsed.departureDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        pallets,
        boxes,
        items
      };
    } catch {
      return null;
    }
  }
  const handleDirectPdfDownload = (req, res) => {
    const code = req.params.code;
    const queryD = req.query.d || req.query.data;
    let load = null;
    if (queryD) {
      load = decodeLoadFromQuery(queryD);
    }
    if (!load) {
      const resolved = resolveSessionFromBearer(extractBearerToken(req));
      if (resolved) {
        const cache = getUserCache(resolved.user.id);
        const targetLower = decodeURIComponent(code || "").trim().toLowerCase();
        load = cache.loads.find(
          (l) => l && (String(l.code || "").trim().toLowerCase() === targetLower || String(l.id || "").trim().toLowerCase() === targetLower)
        );
      }
    }
    if (!load) {
      return res.status(404).send("Distinta PDF non trovata o link incompleto.");
    }
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 36,
        info: {
          Title: `Distinta Materiali Commessa ${load.code}`,
          Author: "CaricoStudio Logistics"
        }
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="Distinta_${encodeURIComponent(load.code)}.pdf"`
      );
      res.setHeader("Cache-Control", "no-cache");
      doc.pipe(res);
      doc.rect(36, 36, 523, 50).fill("#0f172a");
      doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("CARICOSTUDIO", 50, 48);
      doc.fontSize(9).font("Helvetica").text("DISTINTA UFFICIALE DI SPEDIZIONE & PACKING LIST MATERIALE", 50, 70);
      doc.fontSize(16).font("Helvetica-Bold").text(load.code, 350, 48, { width: 195, align: "right" });
      doc.fontSize(9).font("Helvetica").text(`Data: ${load.departureDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`, 350, 70, {
        width: 195,
        align: "right"
      });
      doc.roundedRect(36, 96, 523, 65, 4).lineWidth(1).strokeColor("#cbd5e1").fillColor("#f8fafc").fillAndStroke();
      doc.fillColor("#0f172a").fontSize(11).font("Helvetica-Bold").text(load.title || "Nuova Commessa Spedizione", 48, 106);
      doc.fontSize(9).font("Helvetica").fillColor("#64748b").text("Cliente: ", 48, 122);
      doc.font("Helvetica-Bold").fillColor("#0f172a").text(load.client || "\u2014", 95, 122);
      doc.font("Helvetica").fillColor("#64748b").text("Destinazione: ", 48, 138);
      doc.font("Helvetica-Bold").fillColor("#0f172a").text(load.destination || "\u2014", 115, 138);
      doc.font("Helvetica").fillColor("#64748b").text("Vettore: ", 300, 122);
      doc.font("Helvetica-Bold").fillColor("#0f172a").text(load.carrier || "\u2014", 350, 122);
      const totalPallets = load.pallets?.length || 0;
      const totalBoxes = load.boxes?.length || 0;
      const totalItems = load.items?.length || 0;
      const anyPalletCustomWeight = (load.pallets || []).some(
        (p) => typeof p.customWeightKg === "number" && p.customWeightKg > 0
      );
      const palletsCustomTotal = (load.pallets || []).reduce(
        (acc, p) => acc + (Number(p.customWeightKg) || 0),
        0
      );
      const itemsNetTotal = (load.items || []).reduce(
        (acc, it) => acc + Number(it.quantity || 1) * Number(it.unitWeightKg || 0),
        0
      );
      const totalWeightKg = anyPalletCustomWeight ? palletsCustomTotal : itemsNetTotal;
      const palletStr = totalPallets === 1 ? "1 bancale" : `${totalPallets} bancali`;
      const boxStr = totalBoxes === 1 ? "1 scatola" : `${totalBoxes} scatole`;
      doc.font("Helvetica").fillColor("#64748b").text("Bancali / Scatole: ", 300, 138);
      doc.font("Helvetica-Bold").fillColor("#0f172a").text(`${palletStr}, ${boxStr}`, 385, 138);
      doc.font("Helvetica").fillColor("#64748b").text("Peso Totale: ", 300, 150);
      doc.font("Helvetica-Bold").fillColor("#e11d48").text(`${totalWeightKg.toFixed(1)} kg`, 365, 150);
      let currentY = 175;
      doc.fillColor("#0f172a").fontSize(10).font("Helvetica-Bold").text(`DETTAGLIO MATERIALE E CHECK-LIST (${totalItems} articoli):`, 36, currentY);
      currentY += 15;
      doc.rect(36, currentY, 523, 20).fill("#1e293b");
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
      doc.text("#", 42, currentY + 6);
      doc.text("Cod. Articolo", 62, currentY + 6);
      doc.text("Descrizione Materiale", 142, currentY + 6);
      doc.text("Q.t\xE0", 345, currentY + 6);
      doc.text("Peso Tot.", 385, currentY + 6);
      doc.text("Collocazione", 440, currentY + 6);
      doc.text("Spunta", 524, currentY + 6);
      currentY += 20;
      const palletMap = new Map((load.pallets || []).map((p) => [p.id, p]));
      const boxMap = new Map((load.boxes || []).map((b) => [b.id, b]));
      if (!load.items || load.items.length === 0) {
        doc.rect(36, currentY, 523, 24).fillColor("#ffffff").strokeColor("#e2e8f0").fillAndStroke();
        doc.fillColor("#64748b").fontSize(9).font("Helvetica-Oblique").text("Nessun articolo registrato nella commessa.", 50, currentY + 8);
        currentY += 24;
      } else {
        load.items.forEach((item, idx) => {
          if (currentY > 730) {
            doc.addPage();
            currentY = 40;
            doc.rect(36, currentY, 523, 20).fill("#1e293b");
            doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
            doc.text("#", 42, currentY + 6);
            doc.text("Cod. Articolo", 62, currentY + 6);
            doc.text("Descrizione Materiale", 142, currentY + 6);
            doc.text("Q.t\xE0", 345, currentY + 6);
            doc.text("Peso Tot.", 385, currentY + 6);
            doc.text("Collocazione", 440, currentY + 6);
            doc.text("Spunta", 524, currentY + 6);
            currentY += 20;
          }
          let colloDesc = "Non assegnato";
          if (item.boxId) {
            const bx = boxMap.get(item.boxId);
            const pal = bx?.palletId ? palletMap.get(bx.palletId) : null;
            colloDesc = `${bx?.code || "Scatola"} (${pal?.code || "\u2014"})`;
          } else if (item.palletId) {
            const pal = palletMap.get(item.palletId);
            colloDesc = `Fuori Scatola ${pal?.code || "Bancale"}`;
          }
          const isEven = idx % 2 === 0;
          doc.rect(36, currentY, 523, 22).fillColor(isEven ? "#ffffff" : "#f8fafc").strokeColor("#e2e8f0").fillAndStroke();
          doc.fillColor("#0f172a").fontSize(8).font("Helvetica-Bold").text(String(idx + 1), 42, currentY + 6);
          doc.font("Helvetica-Bold").text(item.sku || "\u2014", 62, currentY + 6, { width: 75, ellipsis: true });
          doc.font("Helvetica").text(item.name || "Articolo", 142, currentY + 6, { width: 195, ellipsis: true });
          doc.font("Helvetica-Bold").text(`${item.quantity || 1} pz`, 345, currentY + 6);
          doc.font("Helvetica").text(
            `${((item.quantity || 1) * (item.unitWeightKg || 0)).toFixed(1)} kg`,
            385,
            currentY + 6
          );
          doc.font("Helvetica").text(colloDesc, 440, currentY + 6, { width: 78, ellipsis: true });
          doc.font("Helvetica-Bold").text("[   ]", 528, currentY + 6);
          currentY += 22;
        });
      }
      if (currentY > 690) {
        doc.addPage();
        currentY = 40;
      } else {
        currentY += 15;
      }
      doc.fillColor("#0f172a").fontSize(9).font("Helvetica-Bold").text("CONVALIDA E FIRME DI RICEZIONE MERCI:", 36, currentY);
      currentY += 10;
      const sigWidth = 168;
      const sigHeight = 44;
      doc.rect(36, currentY, sigWidth, sigHeight).fillColor("#f8fafc").strokeColor("#cbd5e1").fillAndStroke();
      doc.fillColor("#64748b").fontSize(7).font("Helvetica-Bold").text("1. PREPARATORE MAGAZZINO", 42, currentY + 6);
      doc.fillColor("#334155").fontSize(7.5).font("Helvetica").text("Firma Operatore:", 42, currentY + 20);
      doc.moveTo(42, currentY + 36).lineTo(36 + sigWidth - 10, currentY + 36).lineWidth(0.75).strokeColor("#94a3b8").stroke();
      doc.rect(212, currentY, sigWidth, sigHeight).fillColor("#f8fafc").strokeColor("#cbd5e1").fillAndStroke();
      doc.fillColor("#64748b").fontSize(7).font("Helvetica-Bold").text("2. RESPONSABILE SPEDIZIONI", 218, currentY + 6);
      doc.fillColor("#334155").fontSize(7.5).font("Helvetica").text("Firma Logistica:", 218, currentY + 20);
      doc.moveTo(218, currentY + 36).lineTo(212 + sigWidth - 10, currentY + 36).lineWidth(0.75).strokeColor("#94a3b8").stroke();
      doc.rect(388, currentY, sigWidth, sigHeight).fillColor("#f8fafc").strokeColor("#cbd5e1").fillAndStroke();
      doc.fillColor("#64748b").fontSize(7).font("Helvetica-Bold").text("3. RICEVUTA CLIENTE / TRASPORTATORE", 394, currentY + 6);
      doc.fillColor("#334155").fontSize(7.5).font("Helvetica").text("Firma per Ricevuta:", 394, currentY + 20);
      doc.moveTo(394, currentY + 36).lineTo(388 + sigWidth - 10, currentY + 36).lineWidth(0.75).strokeColor("#94a3b8").stroke();
      doc.end();
    } catch (err) {
      console.error("Error generating direct PDF:", err);
      res.status(500).send("Errore durante la generazione del documento PDF.");
    }
  };
  app.get("/pdf/:code", handleDirectPdfDownload);
  app.get("/api/pdf/:code", handleDirectPdfDownload);
  app.post("/api/translate-pdf", requireAuth, async (req, res) => {
    try {
      const {
        text,
        targetLanguage = "it",
        base64Data,
        mimeType = "application/pdf",
        fileName = "document.pdf"
      } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY non configurata sul server."
        });
      }
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const languageNames = {
        it: "Italiano",
        en: "Inglese (English)",
        de: "Tedesco (Deutsch)",
        fr: "Francese (Fran\xE7ais)",
        es: "Spagnolo (Espa\xF1ol)",
        pl: "Polacco (Polski)",
        ro: "Rumeno (Rom\xE2n\u0103)",
        pt: "Portoghese (Portugu\xEAs)",
        zh: "Cinese (\u4E2D\u6587)",
        ar: "Arabo (\u0627\u0644\u0639\u0631\u0628\u064A\u0629)"
      };
      const langLabel = languageNames[targetLanguage] || targetLanguage;
      const prompt = `Sei un traduttore professionista esperto di documenti di trasporto, logistica industriale, bolle di carico, DDT, packing list e schede tecniche internazionali.
Traduci accuratamente in ${langLabel} il seguente documento o testo PDF di logistica.
Mantieni intatti e fedeli i formati di dati: codici articolo, SKU, misure (cm, mm, m), pesi (kg, t), quantitativi, codici doganali (HS code) e nomi propri.
Formatta la risposta in markdown ben strutturato con titoli, tabelle e sezioni corrispondenti al documento originale.`;
      const parts = [];
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        });
        parts.push({
          text: `${prompt}

Traduci l'intero contenuto di questo documento allegato (${fileName}) in ${langLabel}. Riassumi anche in una breve sezione iniziale: Mittente, Destinatario, Peso totale, Numero colli/bancali (se identificabili).`
        });
      } else if (text) {
        parts.push({
          text: `${prompt}

Testo da tradurre:
${text}`
        });
      } else {
        return res.status(400).json({ error: "Nessun testo o documento PDF fornito." });
      }
      let response;
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: { parts }
        });
      } catch {
        response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: { parts }
        });
      }
      return res.json({
        success: true,
        translatedContent: response.text || "",
        targetLanguage: langLabel
      });
    } catch (err) {
      console.error("Translation error:", err);
      return res.status(500).json({
        error: err.message || "Errore durante la traduzione del documento PDF."
      });
    }
  });
  app.post("/api/translate-load-ai", requireAuth, async (req, res) => {
    try {
      const { load, targetLanguage = "en" } = req.body;
      if (!load) {
        return res.status(400).json({ error: "Nessun carico da tradurre fornito." });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: "GEMINI_API_KEY non configurata",
          fallbackNeeded: true
        });
      }
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const languageNames = {
        en: "English (customs, freight and logistics international terminology)",
        de: "German (Deutsch - Fachbegriffe Logistik & Spedition)",
        fr: "French (Fran\xE7ais - transport et logistique internationale)",
        es: "Spanish (Espa\xF1ol - transporte y log\xEDstica)"
      };
      const langTarget = languageNames[targetLanguage] || "English";
      const toTranslate = {
        title: load.title || "",
        destination: load.destination || "",
        client: load.client || "",
        carrier: load.carrier || "",
        pallets: (load.pallets || []).map((p) => ({
          id: p.id,
          label: p.label || "",
          notes: p.notes || ""
        })),
        boxes: (load.boxes || []).map((b) => ({
          id: b.id,
          label: b.label || ""
        })),
        items: (load.items || []).map((it) => ({
          id: it.id,
          name: it.name || "",
          category: it.category || "",
          notes: it.notes || ""
        }))
      };
      const prompt = `You are a professional logistics, customs export, and warehouse freight document translator.
Translate the following shipment items, box labels, pallet descriptions, and job notes from Italian into ${langTarget}.
RULES:
1. Translate item names, categories, box labels, pallet notes, and shipping descriptions into clear, accurate international logistics terminology.
2. PRESERVE exact SKUs, part numbers, serial codes, dimensions (e.g. 80x120 cm), and numbers exactly as given.
3. Return ONLY a valid JSON object matching the exact structure below, with the same ids:
{
  "title": "translated title",
  "destination": "translated destination or address notes",
  "client": "translated or preserved client name",
  "carrier": "translated or preserved carrier name",
  "pallets": [
    { "id": "original_id", "label": "translated label", "notes": "translated notes" }
  ],
  "boxes": [
    { "id": "original_id", "label": "translated label" }
  ],
  "items": [
    { "id": "original_id", "name": "translated item name", "category": "translated category", "notes": "translated notes" }
  ]
}

Input data to translate:
${JSON.stringify(toTranslate, null, 2)}`;
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = response.text || "";
      const cleanJson = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const translatedData = JSON.parse(cleanJson);
      return res.json({
        success: true,
        engine: "gemini",
        model: "gemini-3.8-flash",
        translatedData
      });
    } catch (err) {
      console.error("AI Load Translation error:", err);
      return res.status(500).json({
        error: err.message || "Errore durante la traduzione AI del carico.",
        fallbackNeeded: true
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_ROOT));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(DIST_ROOT, "index.html"));
    });
  }
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[CaricoStudio] Port ${PORT} busy, retrying in 1s...`);
      setTimeout(() => {
        try {
          server.close();
        } catch {
        }
        server.listen(PORT, "0.0.0.0");
      }, 1e3);
    } else {
      console.error("[CaricoStudio] Server error:", err);
    }
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(
      `
  VITE v8.3.5  ready in 200 ms

  \u279C  Local:   http://localhost:${PORT}/
  \u279C  Network: http://0.0.0.0:${PORT}/
`
    );
    console.log(`[CaricoStudio] Server running with WebSockets on http://0.0.0.0:${PORT}`);
  });
  const shutdown = () => {
    try {
      wss.close();
      server.close();
    } catch {
    }
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
startServer().catch((err) => {
  console.error("[CaricoStudio] Failed to start server:", err);
  process.exit(1);
});
