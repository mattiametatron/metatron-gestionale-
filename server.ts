// Remove any broken relative __dirname definition so ESM plugins use their actual import.meta.url
if (typeof (globalThis as any).__dirname !== 'undefined') {
  delete (globalThis as any).__dirname;
}

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import PDFDocument from 'pdfkit';
import { zipSync } from 'fflate';

const parsedPort = Number(process.env.PORT);
const PORT =
  Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : 3000;
const DATA_ROOT = process.env.METATRON_DATA_DIR
  ? path.resolve(process.env.METATRON_DATA_DIR)
  : path.resolve(process.cwd(), 'data');
const DIST_ROOT = process.env.METATRON_DIST_DIR
  ? path.resolve(process.env.METATRON_DIST_DIR)
  : path.resolve(process.cwd(), 'dist');
const OS_INSTALLER_DIR = path.resolve(process.cwd(), 'os-installer');
const DESKTOP_APP_DIR = path.resolve(process.cwd(), 'desktop-app');
const SCRIPTS_DIR = path.resolve(process.cwd(), 'scripts');
const WORKFLOWS_DIR = path.resolve(process.cwd(), '.github', 'workflows');
const BACKUPS_DIR = path.join(DATA_ROOT, 'backups');
const USERS_FILE = path.join(DATA_ROOT, 'server_users.json');
const SESSIONS_FILE = path.join(DATA_ROOT, 'server_sessions.json');
const EMPLOYER_CONFIG_FILE = path.join(DATA_ROOT, 'server_employer_config.json');
const SHARES_INDEX_FILE = path.join(DATA_ROOT, 'server_shares.json');
const CALENDARS_FILE = path.join(DATA_ROOT, 'server_calendars.json');
const CALENDAR_EVENTS_FILE = path.join(DATA_ROOT, 'server_calendar_events.json');
const NOTIFICATIONS_FILE = path.join(DATA_ROOT, 'server_notifications.json');
const SYSTEM_SETTINGS_FILE = path.join(DATA_ROOT, 'server_system_settings.json');
const UPDATE_CONFIG_FILE = path.join(DATA_ROOT, 'server_update_config.json');
const SHARED_FILES_DIR = path.join(DATA_ROOT, 'shared_files');
const USERS_DIR = path.join(DATA_ROOT, 'users');

const SAFE_BACKUP_FILENAME_RE = /^metatron-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/;
const SAFE_SESSION_PREFIX_RE = /^[a-f0-9]{12}$/;
const SAFE_GITHUB_REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function readBundledAppVersion(): string {
  const fromEnv = String(process.env.METATRON_APP_VERSION || '').trim();
  if (fromEnv) return fromEnv;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (typeof parsed?.version === 'string' && parsed.version.trim()) {
        return parsed.version.trim();
      }
    }
  } catch {
    // ignore
  }
  return '1.0.0';
}

function readBundledGithubRepo(): string {
  const fromEnv = String(process.env.METATRON_GITHUB_REPO || '').trim();
  if (SAFE_GITHUB_REPO_RE.test(fromEnv)) return fromEnv;
  try {
    const cfgPath = path.join(DESKTOP_APP_DIR, 'update-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      const owner = String(parsed?.owner || '').trim();
      const repo = String(parsed?.repo || '').trim();
      const combined = owner && repo ? `${owner}/${repo}` : '';
      if (SAFE_GITHUB_REPO_RE.test(combined)) return combined;
    }
  } catch {
    // ignore
  }
  return '';
}

function compareSemverStrings(latestRaw: string, currentRaw: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const a = parse(latestRaw);
  const b = parse(currentRaw);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

const APP_VERSION = readBundledAppVersion();
const BUNDLED_GITHUB_REPO = readBundledGithubRepo();

type DeployArtifactBase = 'os_installer' | 'desktop_app' | 'scripts' | 'workflows';
const DEPLOY_ARTIFACT_BASE_DIRS: Record<DeployArtifactBase, string> = {
  os_installer: OS_INSTALLER_DIR,
  desktop_app: DESKTOP_APP_DIR,
  scripts: SCRIPTS_DIR,
  workflows: WORKFLOWS_DIR,
};
const DEPLOY_ARTIFACT_PATH_PREFIX: Record<DeployArtifactBase, string> = {
  os_installer: 'os-installer',
  desktop_app: 'desktop-app',
  scripts: 'scripts',
  workflows: '.github/workflows',
};

const ALLOWED_DEPLOY_ARTIFACTS: Record<
  string,
  {
    base: DeployArtifactBase;
    fileName: string;
    title: string;
    description: string;
    category: 'installer' | 'iso' | 'systemd' | 'docker' | 'docs' | 'desktop';
  }
> = {
  installer: {
    base: 'os_installer',
    fileName: 'install-metatron-os.sh',
    title: 'Installer Bare-Metal & Kiosk (Debian/Ubuntu)',
    description: 'Trasforma Debian 12 / Ubuntu Server in METATRON Server OS con servizio systemd, firewall UFW e opzione Kiosk a tutto schermo.',
    category: 'installer',
  },
  iso_builder: {
    base: 'os_installer',
    fileName: 'build-metatron-iso.sh',
    title: 'Generatore ISO Avviabile da USB (live-build)',
    description: 'Compila l’immagine metatron-os-amd64.iso avviabile da chiavetta USB con Debian Bookworm + METATRON OS preinstallato.',
    category: 'iso',
  },
  systemd: {
    base: 'os_installer',
    fileName: 'metatron-os.service',
    title: 'Unità systemd (avvio automatico)',
    description: 'Servizio Linux con permessi isolati, riavvio automatico e storage persistente in /var/lib/metatron.',
    category: 'systemd',
  },
  dockerfile: {
    base: 'os_installer',
    fileName: 'Dockerfile',
    title: 'Dockerfile di produzione',
    description: 'Immagine container pronta per deploy su server Docker / Proxmox / NAS.',
    category: 'docker',
  },
  compose: {
    base: 'os_installer',
    fileName: 'docker-compose.yml',
    title: 'Docker Compose',
    description: 'Configurazione multi-ambiente con volume persistente e riavvio automatico.',
    category: 'docker',
  },
  guide: {
    base: 'os_installer',
    fileName: 'README-INSTALL.md',
    title: 'Guida Installazione & Creazione ISO',
    description: 'Istruzioni passo-passo in italiano per installazione su server fisico, modalità Kiosk e creazione chiavetta USB.',
    category: 'docs',
  },
  desktop_win_bat: {
    base: 'desktop_app',
    fileName: 'CREA-SOFTWARE-WINDOWS.bat',
    title: 'Generatore 1-Clic Windows (.exe Setup + Portable)',
    description: 'Fai doppio clic su Windows: compila METATRON-CaricoStudio-Setup.exe e METATRON-CaricoStudio-Portable.exe pronto da zippare.',
    category: 'desktop',
  },
  desktop_readme: {
    base: 'desktop_app',
    fileName: 'README-DESKTOP.md',
    title: 'Guida Software Desktop (.exe / Mac / Linux)',
    description: 'Istruzioni semplici per compilare sul PC o nel cloud su GitHub e inviare l’eseguibile in uno ZIP.',
    category: 'desktop',
  },
  desktop_main: {
    base: 'desktop_app',
    fileName: 'main.cjs',
    title: 'Motore Desktop Electron (main.cjs)',
    description: 'Avvia automaticamente il server interno, apre la finestra desktop, gestisce tray icon e cartella dati locale.',
    category: 'desktop',
  },
  desktop_preload: {
    base: 'desktop_app',
    fileName: 'preload.cjs',
    title: 'Bridge Sicuro Desktop (preload.cjs)',
    description: 'Espone API sicure isolate (contextIsolation) per aprire la cartella dati e leggere l’indirizzo LAN.',
    category: 'desktop',
  },
  desktop_builder_cfg: {
    base: 'desktop_app',
    fileName: 'electron-builder.json',
    title: 'Configurazione Pacchetti (.exe / .dmg / .AppImage)',
    description: 'Configura installer Windows NSIS, eseguibile Portable, macOS DMG e Linux AppImage/DEB.',
    category: 'desktop',
  },
  desktop_mac_linux: {
    base: 'desktop_app',
    fileName: 'build-desktop-mac-linux.sh',
    title: 'Script Build macOS & Linux',
    description: 'Compila il software nativo .dmg su Mac o .AppImage / .deb su Linux con un solo comando.',
    category: 'desktop',
  },
  desktop_server_bundler: {
    base: 'scripts',
    fileName: 'build-desktop-server.mjs',
    title: 'Bundler Server Interno (esbuild)',
    description: 'Compila server.ts in dist-electron/server.mjs per funzionare dentro il software .exe senza Vite.',
    category: 'desktop',
  },
  desktop_github_workflow: {
    base: 'workflows',
    fileName: 'build-desktop.yml',
    title: 'Workflow Cloud GitHub Actions (.exe/.dmg/.AppImage)',
    description: 'Genera automaticamente gli eseguibili per Windows, Mac e Linux direttamente nel cloud senza installare nulla.',
    category: 'desktop',
  },
};

interface ServerSystemSettings {
  nodeName: string;
  hostnameLabel: string;
  timezone: string;
  kioskBootDefault: boolean;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  maintenanceBanner: string;
  updatedAt: string;
}

interface ServerSystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
  adminOnly?: boolean;
}

// Legacy pre-auth paths (migrated automatically to the FIRST registered user)
const LEGACY_LOADS_FILE = path.join(DATA_ROOT, 'server_loads.json');
const LEGACY_INVENTORY_FILE = path.join(DATA_ROOT, 'server_inventory.json');
const LEGACY_PHOTOS_INDEX_FILE = path.join(DATA_ROOT, 'server_photos.json');
const LEGACY_PHOTOS_DIR = path.join(DATA_ROOT, 'photos');
const LEGACY_FILES_INDEX_FILE = path.join(DATA_ROOT, 'server_files.json');
const LEGACY_FILES_DIR = path.join(DATA_ROOT, 'files');

const SAFE_USER_ID_RE = /^usr_[a-f0-9]{12,32}$/;
const SAFE_PHOTO_ID_RE = /^[a-zA-Z0-9_-]{3,80}$/;
const SAFE_FILE_ID_RE = /^[a-zA-Z0-9_-]{3,90}$/;
const SAFE_SHARE_ID_RE = /^shr_[a-f0-9]{12,32}$/;
const SAFE_CAL_ID_RE = /^cal_[a-zA-Z0-9_-]{6,48}$/;
const SAFE_EVT_ID_RE = /^evt_[a-f0-9]{12,32}$/;
const SAFE_NOTIF_ID_RE = /^ntf_[a-f0-9]{12,32}$/;
const SAFE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALLOWED_CAL_COLORS = new Set([
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UserRole = 'worker' | 'employer';

interface StoredUser {
  id: string;
  name: string;
  company?: string;
  email: string;
  role?: UserRole;
  passwordHash: string; // saltHex:scryptHex
  createdAt: string;
}

interface PublicUser {
  id: string;
  name: string;
  company?: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface EmployerConfig {
  accessCodeHash?: string;
  claimedByUserId?: string;
  claimedAt?: string;
}

interface ServerSharedTransfer {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  fileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  kind: 'photo' | 'file';
  commessaCode?: string;
  message?: string;
  createdAt: string;
  savedByRecipient?: boolean;
}

interface ServerCalendarRecord {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  ownerName: string;
  isShared: boolean;
  isDefaultPersonal?: boolean;
  memberIds: string[];
  createdAt: string;
}

interface ServerCalendarEventRecord {
  id: string;
  calendarId: string;
  date: string;
  time?: string;
  endTime?: string;
  title: string;
  notes?: string;
  kind: 'appuntamento' | 'appunto' | 'promemoria' | 'spedizione';
  commessaCode?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

interface ServerNotificationItem {
  id: string;
  userId: string;
  category: 'message' | 'low_stock' | 'stock_movement' | 'calendar' | 'alarm';
  title: string;
  body: string;
  targetApp:
    | 'team_share'
    | 'warehouse_catalog'
    | 'stock_movements'
    | 'calendar'
    | 'clock';
  meta?: {
    shareId?: string;
    calendarId?: string;
    eventId?: string;
    eventDate?: string;
    commessaCode?: string;
  };
  read: boolean;
  createdAt: string;
}

interface StoredSession {
  tokenHash: string; // sha256(rawToken)
  userId: string;
  createdAt: string;
  expiresAt: string;
}

interface ServerFileManagerState {
  folders: any[];
  files: any[];
}

interface ServerPhotoRecord {
  id: string;
  commessaId: string;
  commessaCode: string;
  commessaTitle: string;
  caption: string;
  capturedAt: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  fileExt: string;
}

interface UserDataCache {
  loads: any[];
  inventory: {
    items: any[];
    movements: any[];
    categories?: string[];
    hiddenCommessaCodes?: string[];
  } | null;
  photos: ServerPhotoRecord[];
  filesState: ServerFileManagerState;
  crmContacts: any[];
  ddtDocuments: any[];
  purchaseOrders: any[];
}

interface UserPaths {
  userDir: string;
  loadsFile: string;
  inventoryFile: string;
  photosIndexFile: string;
  photosDir: string;
  filesIndexFile: string;
  filesDir: string;
  crmFile: string;
  ddtFile: string;
  purchaseOrdersFile: string;
}

interface AuthenticatedRequest extends express.Request {
  authUser?: PublicUser;
  sessionTokenHash?: string;
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function assertSafeChildPath(baseDir: string, targetPath: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (
    resolvedTarget !== resolvedBase &&
    !resolvedTarget.startsWith(resolvedBase + path.sep)
  ) {
    throw new Error('Percorso file non consentito');
  }
  return resolvedTarget;
}

function getUserPaths(userId: string): UserPaths {
  if (!SAFE_USER_ID_RE.test(userId)) {
    throw new Error('ID utente non valido');
  }
  const userDir = assertSafeChildPath(USERS_DIR, path.join(USERS_DIR, userId));
  return {
    userDir,
    loadsFile: assertSafeChildPath(userDir, path.join(userDir, 'loads.json')),
    inventoryFile: assertSafeChildPath(userDir, path.join(userDir, 'inventory.json')),
    photosIndexFile: assertSafeChildPath(userDir, path.join(userDir, 'photos.json')),
    photosDir: assertSafeChildPath(userDir, path.join(userDir, 'photos')),
    filesIndexFile: assertSafeChildPath(userDir, path.join(userDir, 'files.json')),
    filesDir: assertSafeChildPath(userDir, path.join(userDir, 'files')),
    crmFile: assertSafeChildPath(userDir, path.join(userDir, 'crm_contacts.json')),
    ddtFile: assertSafeChildPath(userDir, path.join(userDir, 'ddt_documents.json')),
    purchaseOrdersFile: assertSafeChildPath(
      userDir,
      path.join(userDir, 'purchase_orders.json')
    ),
  };
}

function toPublicUser(u: StoredUser): PublicUser {
  return {
    id: u.id,
    name: u.name,
    company: u.company || undefined,
    email: u.email,
    role: u.role === 'employer' ? 'employer' : 'worker',
    createdAt: u.createdAt,
  };
}

function safeCompareSecret(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getSafeDownloadHeaders(
  mimeType: string,
  fileName: string
): { contentType: string; disposition: string } {
  const cleanMime = String(mimeType || '').toLowerCase().trim();
  const safeInlineMimes = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);
  const encodedName = encodeURIComponent(fileName || 'file');
  if (safeInlineMimes.has(cleanMime)) {
    return {
      contentType: cleanMime === 'image/jpg' ? 'image/jpeg' : cleanMime,
      disposition: `inline; filename="${encodedName}"`,
    };
  }
  return {
    contentType: 'application/octet-stream',
    disposition: `attachment; filename="${encodedName}"`,
  };
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    console.warn(`[CaricoStudio] Errore lettura ${path.basename(filePath)}:`, err);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[CaricoStudio] Errore salvataggio ${path.basename(filePath)}:`, err);
  }
}

function copyDirectoryContents(srcDir: string, dstDir: string) {
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

function migrateLegacyDataToFirstUser(userId: string) {
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
    console.warn('[CaricoStudio] Errore migrazione dati legacy:', err);
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatItDateTimeServer(iso?: string | null): string {
  if (!iso) return 'Non registrata';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return String(iso);
  }
}

interface CompactTrackPayload {
  v: 1;
  t: 'p' | 'b' | 'i';
  id: string;
  cc: string;
  ct: string;
  cl?: string;
  ds?: string;
  cd: string;
  n: string;
  q: string;
  qn: number;
  w: number;
  loc: string;
  p?: string;
  b?: string;
  ca?: string;
  sc?: string;
}

interface PublicResolvedTrack {
  type: 'pallet' | 'box' | 'item';
  entityId: string;
  code: string;
  barcodeValue: string;
  name: string;
  commessaCode: string;
  commessaTitle: string;
  client: string;
  destination: string;
  locationPath: string;
  palletCode: string | null;
  boxCode: string | null;
  quantityText: string;
  quantityNumber: number;
  weightKg: number;
  loadedAt: string | null;
  shippedAt: string | null;
  contents: Array<{ code: string; name: string; quantity: number; location?: string }>;
  liveVerified: boolean;
}

function sanitizeCode39Server(input: string): string {
  return String(input || '')
    .toUpperCase()
    .replace(/[^0-9A-Z\-.\s$/+%]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 24);
}

function decodeTrackTokenServer(encoded: string): PublicResolvedTrack | null {
  if (!encoded || typeof encoded !== 'string' || encoded.length > 4096) return null;
  try {
    const buf = Buffer.from(encoded.trim(), 'base64url');
    let inflated: Buffer;
    try {
      inflated = zlib.inflateRawSync(buf);
    } catch {
      inflated = zlib.inflateSync(buf);
    }
    const parsed = JSON.parse(inflated.toString('utf-8')) as CompactTrackPayload;
    if (!parsed || parsed.v !== 1) return null;
    const type: 'pallet' | 'box' | 'item' =
      parsed.t === 'p' ? 'pallet' : parsed.t === 'b' ? 'box' : 'item';
    const cc = String(parsed.cc || 'COM');
    const cd = String(parsed.cd || 'COD');
    return {
      type,
      entityId: String(parsed.id || ''),
      code: cd,
      barcodeValue: `${sanitizeCode39Server(cc).slice(0, 10)}-${sanitizeCode39Server(cd).slice(0, 12)}`,
      name: String(parsed.n || 'Articolo'),
      commessaCode: cc,
      commessaTitle: String(parsed.ct || 'Commessa'),
      client: String(parsed.cl || '—'),
      destination: String(parsed.ds || '—'),
      locationPath: String(parsed.loc || 'Non assegnato'),
      palletCode: parsed.p ? String(parsed.p) : null,
      boxCode: parsed.b ? String(parsed.b) : null,
      quantityText: String(parsed.q || `${Number(parsed.qn) || 0} pz`),
      quantityNumber: Number(parsed.qn) || 0,
      weightKg: Number(parsed.w) || 0,
      loadedAt: parsed.ca ? String(parsed.ca) : null,
      shippedAt: parsed.sc ? String(parsed.sc) : null,
      contents: [],
      liveVerified: false,
    };
  } catch {
    return null;
  }
}

function enrichTrackRecordFromLoad(
  base: PublicResolvedTrack,
  load: any,
  movements: any[]
): PublicResolvedTrack | null {
  if (!load) return null;
  const pallets: any[] = Array.isArray(load.pallets) ? load.pallets : [];
  const boxes: any[] = Array.isArray(load.boxes) ? load.boxes : [];
  const items: any[] = Array.isArray(load.items) ? load.items : [];
  const palletMap = new Map(pallets.map((p) => [p.id, p]));
  const boxMap = new Map(boxes.map((b) => [b.id, b]));
  const handoverAt: string | null = load.handoverProof?.handoverAt || null;

  const findScarico = (target: string, matchBy: 'sku' | 'package'): string | null => {
    const cUpper = String(load.code || '').trim().toUpperCase();
    const tUpper = String(target || '').trim().toUpperCase();
    if (!tUpper) return null;
    const hit = movements.find((m: any) => {
      if (!m || m.type !== 'scarico') return false;
      if (cUpper && String(m.commessaCode || '').trim().toUpperCase() !== cUpper) return false;
      return matchBy === 'sku'
        ? String(m.sku || '').trim().toUpperCase() === tUpper
        : String(m.packageCode || '').trim().toUpperCase() === tUpper;
    });
    return hit?.timestamp || null;
  };

  if (base.type === 'pallet') {
    const pallet = pallets.find((p) => p.id === base.entityId);
    if (!pallet) return null;
    const palletBoxes = boxes.filter((b) => b.palletId === pallet.id);
    const palletBoxIds = new Set(palletBoxes.map((b) => b.id));
    const palletItems = items.filter(
      (it) => it.palletId === pallet.id || (it.boxId && palletBoxIds.has(it.boxId))
    );
    const totalPieces = palletItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const calcW =
      (Number(pallet.tareKg) || 0) +
      palletBoxes.reduce((acc, b) => acc + (Number(b.tareKg) || 0), 0) +
      palletItems.reduce(
        (acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitWeightKg) || 0),
        0
      );
    const grossW =
      pallet.customWeightKg !== undefined && pallet.customWeightKg !== null
        ? Number(pallet.customWeightKg)
        : calcW;
    const loadedAt =
      pallet.loadedAt ||
      palletBoxes.find((b) => b.loadedAt)?.loadedAt ||
      palletItems.find((i) => i.loadedAt)?.loadedAt ||
      load.loadedAt ||
      base.loadedAt;
    const shippedAt =
      pallet.shippedAt ||
      load.shippedAt ||
      handoverAt ||
      findScarico(pallet.code, 'package') ||
      base.shippedAt;
    const slotLabel = pallet.truckSlot
      ? `Posto Camion #${pallet.truckSlot}`
      : 'Area Preparazione Spedizione';
    return {
      ...base,
      code: pallet.code || base.code,
      name: pallet.label || base.name,
      commessaTitle: load.title || base.commessaTitle,
      client: load.client || base.client,
      destination: load.destination || base.destination,
      locationPath: `${load.code} > ${pallet.code} (${slotLabel})`,
      palletCode: pallet.code || base.palletCode,
      quantityText: `${palletBoxes.length} scatole · ${totalPieces} pz`,
      quantityNumber: totalPieces,
      weightKg: Math.round(grossW * 100) / 100,
      loadedAt: loadedAt || null,
      shippedAt: shippedAt || null,
      contents: [
        ...palletBoxes.map((b) => {
          const bItems = items.filter((i) => i.boxId === b.id);
          const bPcs = bItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
          return {
            code: String(b.code || 'SC'),
            name: `Scatola: ${b.label || ''}`,
            quantity: bPcs,
            location: `${bItems.length} articoli`,
          };
        }),
        ...palletItems
          .filter((i) => !i.boxId)
          .map((i) => ({
            code: String(i.sku || 'ART'),
            name: String(i.name || 'Articolo'),
            quantity: Number(i.quantity) || 0,
            location: 'Fuori Scatola',
          })),
      ],
      liveVerified: true,
    };
  }

  if (base.type === 'box') {
    const box = boxes.find((b) => b.id === base.entityId);
    if (!box) return null;
    const pallet = box.palletId ? palletMap.get(box.palletId) || null : null;
    const parentBox = box.parentBoxId ? boxMap.get(box.parentBoxId) || null : null;
    const boxPath = parentBox ? `${parentBox.code} > ${box.code}` : box.code;
    const boxItems = items.filter((i) => i.boxId === box.id);
    const totalPieces = boxItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
    const boxWeight =
      (Number(box.tareKg) || 0) +
      boxItems.reduce(
        (acc, i) => acc + (Number(i.quantity) || 0) * (Number(i.unitWeightKg) || 0),
        0
      );
    const loadedAt =
      box.loadedAt ||
      pallet?.loadedAt ||
      boxItems.find((i) => i.loadedAt)?.loadedAt ||
      load.loadedAt ||
      base.loadedAt;
    const shippedAt =
      box.shippedAt ||
      pallet?.shippedAt ||
      load.shippedAt ||
      handoverAt ||
      findScarico(box.code, 'package') ||
      base.shippedAt;
    return {
      ...base,
      code: box.code || base.code,
      name: box.label || base.name,
      commessaTitle: load.title || base.commessaTitle,
      client: load.client || base.client,
      destination: load.destination || base.destination,
      locationPath: pallet ? `${pallet.code} > ${boxPath}` : `A Terra > ${boxPath}`,
      palletCode: pallet?.code || null,
      boxCode: box.code || base.boxCode,
      quantityText: `${totalPieces} pz (${boxItems.length} art.)`,
      quantityNumber: totalPieces,
      weightKg: Math.round(boxWeight * 100) / 100,
      loadedAt: loadedAt || null,
      shippedAt: shippedAt || null,
      contents: boxItems.map((it) => ({
        code: String(it.sku || 'ART'),
        name: String(it.name || 'Articolo'),
        quantity: Number(it.quantity) || 0,
        location: String(box.code || ''),
      })),
      liveVerified: true,
    };
  }

  // item
  const item = items.find((i) => i.id === base.entityId);
  if (!item) return null;
  const box = item.boxId ? boxMap.get(item.boxId) || null : null;
  const resolvedPalletId = box?.palletId || item.palletId || null;
  const pallet = resolvedPalletId ? palletMap.get(resolvedPalletId) || null : null;
  const parentBox = box?.parentBoxId ? boxMap.get(box.parentBoxId) || null : null;
  const boxPath = box ? (parentBox ? `${parentBox.code} > ${box.code}` : box.code) : '';
  let locationPath = 'Non ancora collocato';
  if (box && pallet) {
    locationPath = `${pallet.code} > ${boxPath}`;
  } else if (box) {
    locationPath = `Scatola ${boxPath}`;
  } else if (pallet) {
    locationPath = `Fuori Scatola su ${pallet.code}`;
  }
  const loadedAt =
    item.loadedAt || box?.loadedAt || pallet?.loadedAt || load.loadedAt || base.loadedAt;
  const shippedAt =
    item.shippedAt ||
    box?.shippedAt ||
    pallet?.shippedAt ||
    load.shippedAt ||
    handoverAt ||
    findScarico(item.sku, 'sku') ||
    base.shippedAt;
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
    weightKg:
      Math.round((Number(item.quantity) || 0) * (Number(item.unitWeightKg) || 0) * 100) / 100,
    loadedAt: loadedAt || null,
    shippedAt: shippedAt || null,
    contents: [],
    liveVerified: true,
  };
}

function renderStandaloneTrackHtml(record: PublicResolvedTrack | null): string {
  if (!record) {
    return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Scheda Tracciabilità QR — CaricoStudio</title>
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

  const typeLabel =
    record.type === 'pallet'
      ? 'BANCALE'
      : record.type === 'box'
      ? 'SCATOLA'
      : 'OGGETTO / PEZZO';
  const headerBg =
    record.type === 'pallet'
      ? '#0f172a'
      : record.type === 'box'
      ? '#1d4ed8'
      : '#047857';

  const statusText = record.shippedAt
    ? 'SPEDITO (SCARICATO)'
    : record.loadedAt
    ? 'PREPARATO (CARICATO)'
    : 'IN PREPARAZIONE';
  const statusBg = record.shippedAt
    ? '#ecfdf5'
    : record.loadedAt
    ? '#f0f9ff'
    : '#fffbeb';
  const statusBorder = record.shippedAt
    ? '#a7f3d0'
    : record.loadedAt
    ? '#bae6fd'
    : '#fde68a';
  const statusColor = record.shippedAt
    ? '#065f46'
    : record.loadedAt
    ? '#075985'
    : '#92400e';

  const contentsHtml =
    record.contents.length > 0
      ? `<div class="section">
          <div class="section-head">
            <span>Contenuto all'interno (${record.contents.length})</span>
            <span class="mono">Tot. ${escapeHtml(record.quantityNumber)} pz</span>
          </div>
          <div class="list">
            ${record.contents
              .map(
                (row) => `<div class="list-row">
                  <div class="list-left">
                    <div class="mono bold">${escapeHtml(row.code)}${
                  row.location ? ` <span class="muted">· ${escapeHtml(row.location)}</span>` : ''
                }</div>
                    <div class="item-name">${escapeHtml(row.name)}</div>
                  </div>
                  <div class="mono bold qty">${escapeHtml(row.quantity)} pz</div>
                </div>`
              )
              .join('')}
          </div>
        </div>`
      : '';

  return `<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(record.code)} · ${escapeHtml(record.commessaCode)} — Scheda Tracciabilità</title>
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
        <span class="sync-note">${
          record.liveVerified
            ? 'Stato aggiornato dal server'
            : 'Scheda letta direttamente dal QR'
        }</span>
      </div>

      <div class="loc-box">
        <div class="label-xs">Dove si trova questo pezzo</div>
        <div class="loc-val">${escapeHtml(record.locationPath)}</div>
        <div class="loc-meta">
          <span>Commessa: <strong>${escapeHtml(record.commessaCode)}</strong> (${escapeHtml(
    record.commessaTitle
  )})</span>
          ${
            record.palletCode
              ? `<span>Bancale: <strong class="mono">${escapeHtml(record.palletCode)}</strong></span>`
              : ''
          }
          ${
            record.boxCode
              ? `<span>Scatola: <strong class="mono">${escapeHtml(record.boxCode)}</strong></span>`
              : ''
          }
        </div>
      </div>

      <div class="grid-2">
        <div class="stat">
          <div class="label-xs">Quantità</div>
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

      <div class="foot">Scheda sola lettura — nessuna app o login richiesto per la scansione.</div>
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

  // Server OS settings, live event log ring-buffer & CPU/RAM telemetry sampler
  const DEFAULT_SYSTEM_SETTINGS: ServerSystemSettings = {
    nodeName: 'METATRON-SRV-01',
    hostnameLabel: 'metatron.local',
    timezone: 'Europe/Rome',
    kioskBootDefault: true,
    autoBackupEnabled: true,
    autoBackupIntervalHours: 24,
    maintenanceBanner: '',
    updatedAt: new Date().toISOString(),
  };

  let systemSettings: ServerSystemSettings = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...readJsonFile<Partial<ServerSystemSettings>>(SYSTEM_SETTINGS_FILE, {}),
  };

  const systemLogs: ServerSystemLogEntry[] = [];
  function addSystemLog(
    level: 'info' | 'warn' | 'error',
    source: string,
    message: string,
    adminOnly = false
  ) {
    systemLogs.unshift({
      id: `log_${crypto.randomBytes(6).toString('hex')}`,
      timestamp: new Date().toISOString(),
      level,
      source: source.slice(0, 40),
      message: message.slice(0, 260),
      adminOnly,
    });
    if (systemLogs.length > 250) {
      systemLogs.length = 250;
    }
  }

  addSystemLog('info', 'Kernel / Core', `Avvio METATRON Server OS su ${os.hostname()} (${os.platform()} ${os.arch()})`);
  addSystemLog('info', 'Storage Engine', `Volume dati montato in ${DATA_ROOT}`);

  interface CpuCoreSnapshot {
    idle: number;
    total: number;
  }
  function captureCpuSnapshots(): CpuCoreSnapshot[] {
    return os.cpus().map((c) => {
      const t = c.times;
      const total = t.user + t.nice + t.sys + t.idle + t.irq;
      return { idle: t.idle, total };
    });
  }

  let prevCpuSnapshots = captureCpuSnapshots();
  let latestCpuPercent = 0;
  let latestCorePercents: number[] = prevCpuSnapshots.map(() => 0);
  const telemetryHistory: Array<{ ts: string; cpuPercent: number; memPercent: number }> = [];

  function sampleTelemetryPoint() {
    const current = captureCpuSnapshots();
    let totalDelta = 0;
    let idleDelta = 0;
    const perCore: number[] = [];

    for (let i = 0; i < current.length; i++) {
      const prev = prevCpuSnapshots[i] || current[i];
      const dt = Math.max(1, current[i].total - prev.total);
      const di = Math.max(0, current[i].idle - prev.idle);
      totalDelta += dt;
      idleDelta += di;
      perCore.push(Math.max(0, Math.min(100, Math.round(((dt - di) / dt) * 100))));
    }
    prevCpuSnapshots = current;
    latestCorePercents = perCore;
    latestCpuPercent =
      totalDelta > 0
        ? Math.max(0, Math.min(100, Math.round(((totalDelta - idleDelta) / totalDelta) * 1000) / 10))
        : 0;

    const totalMem = os.totalmem();
    const usedMem = Math.max(0, totalMem - os.freemem());
    const memPercent =
      totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0;

    telemetryHistory.push({
      ts: new Date().toISOString(),
      cpuPercent: latestCpuPercent,
      memPercent,
    });
    if (telemetryHistory.length > 45) {
      telemetryHistory.shift();
    }
  }

  sampleTelemetryPoint();
  const telemetryInterval = setInterval(sampleTelemetryPoint, 2000);
  telemetryInterval.unref();

  function getDirectoryStats(dirPath: string): { bytes: number; files: number } {
    let bytes = 0;
    let files = 0;
    if (!fs.existsSync(dirPath)) return { bytes, files };
    const stack: string[] = [dirPath];
    while (stack.length > 0) {
      const currentDir = stack.pop()!;
      let entries: fs.Dirent[];
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
            // ignore unreadable file
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
      const usedPercent =
        totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
      return { totalBytes, usedBytes, freeBytes, usedPercent };
    } catch {
      return { totalBytes: 0, usedBytes: 0, freeBytes: 0, usedPercent: 0 };
    }
  }

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '50mb' }));

  const METATRON_SESSION_COOKIE = 'metatron_sid';
  const REMEMBER_ME_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 giorni

  function parseCookieValue(req: express.Request, name: string): string | null {
    const rawHeader = req.headers.cookie;
    if (!rawHeader || typeof rawHeader !== 'string') return null;
    const pairs = rawHeader.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
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

  function isPlainLanHttpRequest(req: express.Request): boolean {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (forwardedProto === 'https' || req.secure) return false;
    const originOrReferer = String(req.headers.origin || req.headers.referer || '');
    if (originOrReferer.startsWith('https://')) return false;
    if (originOrReferer.startsWith('http://')) {
      try {
        const u = new URL(originOrReferer);
        if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
          return true;
        }
      } catch {
        // ignore
      }
    }
    return false;
  }

  function setSessionCookie(
    res: express.Response,
    req: express.Request,
    rawToken: string,
    rememberMe = true
  ) {
    const plainLanHttp = isPlainLanHttpRequest(req);
    const parts = [
      `${METATRON_SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
      'Path=/',
      'HttpOnly',
    ];
    if (plainLanHttp) {
      parts.push('SameSite=Lax');
    } else {
      parts.push('Secure', 'SameSite=None', 'Partitioned');
    }
    if (rememberMe) {
      parts.push(`Max-Age=${REMEMBER_ME_MAX_AGE_SEC}`);
    }
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function clearSessionCookie(res: express.Response, req: express.Request) {
    const plainLanHttp = isPlainLanHttpRequest(req);
    const parts = [
      `${METATRON_SESSION_COOKIE}=`,
      'Path=/',
      'HttpOnly',
      'Max-Age=0',
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    ];
    if (plainLanHttp) {
      parts.push('SameSite=Lax');
    } else {
      parts.push('Secure', 'SameSite=None', 'Partitioned');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
  }

  function isSameOriginHeader(req: express.Request): boolean {
    const origin = req.headers.origin;
    if (!origin || typeof origin !== 'string') return false;
    const forwardedHost = String(req.headers['x-forwarded-host'] || '')
      .split(',')[0]
      .trim();
    const host = String(req.headers.host || '').trim();
    const effectiveHost = forwardedHost || host;
    const serverIsLocal =
      effectiveHost.startsWith('localhost') ||
      effectiveHost.startsWith('127.0.0.1');
    try {
      const originUrl = new URL(origin);
      if (forwardedHost && originUrl.host === forwardedHost) return true;
      if (host && originUrl.host === host) return true;
      if (
        serverIsLocal &&
        (originUrl.hostname === 'localhost' ||
          originUrl.hostname === '127.0.0.1')
      ) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  // Restricted CORS: allow same-origin / local preview host without wildcard '*'
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isSameOriginHeader(req)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
      );
      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // In-memory auth & sharing registries backed by disk
  let usersRegistry: StoredUser[] = readJsonFile<StoredUser[]>(USERS_FILE, []);
  let sessionsRegistry: StoredSession[] = readJsonFile<StoredSession[]>(
    SESSIONS_FILE,
    []
  ).filter((s) => s && new Date(s.expiresAt).getTime() > Date.now());
  let employerConfig: EmployerConfig = readJsonFile<EmployerConfig>(
    EMPLOYER_CONFIG_FILE,
    {}
  );
  let sharesRegistry: ServerSharedTransfer[] = readJsonFile<ServerSharedTransfer[]>(
    SHARES_INDEX_FILE,
    []
  );
  let calendarsRegistry: ServerCalendarRecord[] = readJsonFile<ServerCalendarRecord[]>(
    CALENDARS_FILE,
    []
  );
  let calendarEventsRegistry: ServerCalendarEventRecord[] = readJsonFile<
    ServerCalendarEventRecord[]
  >(CALENDAR_EVENTS_FILE, []);
  let notificationsRegistry: ServerNotificationItem[] = readJsonFile<
    ServerNotificationItem[]
  >(NOTIFICATIONS_FILE, []);

  function saveSharesRegistry(next: ServerSharedTransfer[]) {
    sharesRegistry = next;
    writeJsonFile(SHARES_INDEX_FILE, sharesRegistry);
  }

  function saveCalendarsRegistry(next: ServerCalendarRecord[]) {
    calendarsRegistry = next;
    writeJsonFile(CALENDARS_FILE, calendarsRegistry);
  }

  function saveCalendarEventsRegistry(next: ServerCalendarEventRecord[]) {
    calendarEventsRegistry = next;
    writeJsonFile(CALENDAR_EVENTS_FILE, calendarEventsRegistry);
  }

  function saveNotificationsRegistry(next: ServerNotificationItem[]) {
    // Keep at most 1500 notifications globally across users to keep disk lean
    notificationsRegistry = next.slice(0, 1500);
    writeJsonFile(NOTIFICATIONS_FILE, notificationsRegistry);
  }

  function ensurePersonalCalendarForUser(user: PublicUser): ServerCalendarRecord {
    const existing = calendarsRegistry.find(
      (c) => c.ownerId === user.id && c.isDefaultPersonal
    );
    if (existing) return existing;
    const personal: ServerCalendarRecord = {
      id: `cal_pers_${user.id.replace(/^usr_/, '').slice(0, 20)}`,
      name: 'Calendario Personale',
      color: '#6366f1',
      ownerId: user.id,
      ownerName: user.name,
      isShared: false,
      isDefaultPersonal: true,
      memberIds: [user.id],
      createdAt: new Date().toISOString(),
    };
    saveCalendarsRegistry([...calendarsRegistry, personal]);
    return personal;
  }

  function userCanAccessCalendar(cal: ServerCalendarRecord, userId: string): boolean {
    return cal.ownerId === userId || cal.memberIds.includes(userId);
  }

  function hydrateCalendarForClient(cal: ServerCalendarRecord) {
    const uniqueIds = Array.from(new Set([cal.ownerId, ...cal.memberIds]));
    const members = uniqueIds
      .map((id) => usersRegistry.find((u) => u.id === id))
      .filter((u): u is StoredUser => Boolean(u))
      .map((u) => ({
        id: u.id,
        name: u.name,
        role: (u.role === 'employer' ? 'employer' : 'worker') as UserRole,
      }));
    return {
      ...cal,
      memberIds: uniqueIds,
      members,
    };
  }

  function pushUserNotification(
    targetUserId: string,
    payload: Omit<ServerNotificationItem, 'id' | 'userId' | 'read' | 'createdAt'>
  ): ServerNotificationItem {
    const item: ServerNotificationItem = {
      id: `ntf_${crypto.randomBytes(10).toString('hex')}`,
      userId: targetUserId,
      category: payload.category,
      title: payload.title.slice(0, 140),
      body: payload.body.slice(0, 320),
      targetApp: payload.targetApp,
      meta: payload.meta,
      read: false,
      createdAt: new Date().toISOString(),
    };
    saveNotificationsRegistry([item, ...notificationsRegistry]);
    broadcastToUser(targetUserId, null, {
      type: 'notification_new',
      notification: item,
    });
    return item;
  }

  function hasAnyEmployer(): boolean {
    return usersRegistry.some((u) => u.role === 'employer');
  }

  const userCaches = new Map<string, UserDataCache>();

  function getUserCache(userId: string): UserDataCache {
    const existing = userCaches.get(userId);
    if (existing) return existing;
    const paths = getUserPaths(userId);
    ensureDir(paths.userDir);
    const loads = readJsonFile<any[]>(paths.loadsFile, []);
    const inventory = readJsonFile<UserDataCache['inventory']>(paths.inventoryFile, null);
    const photos = readJsonFile<ServerPhotoRecord[]>(paths.photosIndexFile, []);
    const filesState = readJsonFile<ServerFileManagerState>(paths.filesIndexFile, {
      folders: [],
      files: [],
    });
    const crmContacts = readJsonFile<any[]>(paths.crmFile, []);
    const ddtDocuments = readJsonFile<any[]>(paths.ddtFile, []);
    const purchaseOrders = readJsonFile<any[]>(paths.purchaseOrdersFile, []);
    const cache: UserDataCache = {
      loads: Array.isArray(loads) ? loads : [],
      inventory:
        inventory && Array.isArray(inventory.items) && Array.isArray(inventory.movements)
          ? inventory
          : null,
      photos: Array.isArray(photos) ? photos : [],
      filesState:
        filesState && Array.isArray(filesState.folders) && Array.isArray(filesState.files)
          ? filesState
          : { folders: [], files: [] },
      crmContacts: Array.isArray(crmContacts) ? crmContacts : [],
      ddtDocuments: Array.isArray(ddtDocuments) ? ddtDocuments : [],
      purchaseOrders: Array.isArray(purchaseOrders) ? purchaseOrders : [],
    };
    userCaches.set(userId, cache);
    return cache;
  }

  function saveUserLoads(userId: string, loads: any[]) {
    const cache = getUserCache(userId);
    cache.loads = loads;
    writeJsonFile(getUserPaths(userId).loadsFile, loads);
  }

  function saveUserInventory(
    userId: string,
    inventory: {
      items: any[];
      movements: any[];
      categories?: string[];
      hiddenCommessaCodes?: string[];
    }
  ) {
    const cache = getUserCache(userId);
    cache.inventory = inventory;
    writeJsonFile(getUserPaths(userId).inventoryFile, inventory);
  }

  function saveUserPhotos(userId: string, photos: ServerPhotoRecord[]) {
    const cache = getUserCache(userId);
    cache.photos = photos;
    writeJsonFile(getUserPaths(userId).photosIndexFile, photos);
  }

  function saveUserFilesState(userId: string, state: ServerFileManagerState) {
    const cache = getUserCache(userId);
    cache.filesState = state;
    writeJsonFile(getUserPaths(userId).filesIndexFile, state);
  }

  function saveUserCrmContacts(userId: string, contacts: any[]) {
    const cache = getUserCache(userId);
    cache.crmContacts = contacts;
    writeJsonFile(getUserPaths(userId).crmFile, contacts);
  }

  function saveUserDdtDocuments(userId: string, documents: any[]) {
    const cache = getUserCache(userId);
    cache.ddtDocuments = documents;
    writeJsonFile(getUserPaths(userId).ddtFile, documents);
  }

  function saveUserPurchaseOrders(userId: string, orders: any[]) {
    const cache = getUserCache(userId);
    cache.purchaseOrders = orders;
    writeJsonFile(getUserPaths(userId).purchaseOrdersFile, orders);
  }

  function createSessionForUser(userId: string, rememberMe = true): string {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const now = Date.now();
    const ttlMs = rememberMe
      ? REMEMBER_ME_MAX_AGE_SEC * 1000
      : 12 * 60 * 60 * 1000;
    const session: StoredSession = {
      tokenHash,
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    };
    sessionsRegistry = [
      ...sessionsRegistry.filter((s) => new Date(s.expiresAt).getTime() > now),
      session,
    ];
    writeJsonFile(SESSIONS_FILE, sessionsRegistry);
    return rawToken;
  }

  function resolveSessionFromBearer(
    rawToken: string | null | undefined
  ): { user: PublicUser; tokenHash: string } | null {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 32) return null;
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

  function extractBearerToken(req: express.Request): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || typeof authHeader !== 'string') return null;
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return parts[1].trim() || null;
  }

  function requireAuth(
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ) {
    const bearerToken = extractBearerToken(req);
    const cookieToken = !bearerToken
      ? parseCookieValue(req, METATRON_SESSION_COOKIE)
      : null;

    if (
      !bearerToken &&
      cookieToken &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())
    ) {
      const hasCustomHeader = Boolean(req.headers['x-requested-with']);
      if (!hasCustomHeader && !isSameOriginHeader(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Richiesta non autorizzata (verifica origine fallita).',
        });
      }
    }

    const resolved = resolveSessionFromBearer(bearerToken || cookieToken);
    if (!resolved) {
      return res.status(401).json({
        ok: false,
        error: 'Autenticazione richiesta. Effettua il login.',
      });
    }
    req.authUser = resolved.user;
    req.sessionTokenHash = resolved.tokenHash;
    next();
  }

  function requireEmployer(
    req: AuthenticatedRequest,
    res: express.Response,
    next: express.NextFunction
  ) {
    if (!req.authUser || req.authUser.role !== 'employer') {
      return res.status(403).json({
        ok: false,
        error: 'Accesso riservato al Datore di Lavoro / Direzione.',
      });
    }
    next();
  }

  // =========================================================================
  // AUTHENTICATION ENDPOINTS (MULTI-USER ISOLATION + EMPLOYER ROLE)
  // =========================================================================
  app.get('/api/auth/status', (_req, res) => {
    const envEmployerCode = (process.env.EMPLOYER_ACCESS_CODE || '').trim();
    const hasEmployer = hasAnyEmployer();
    res.json({
      hasUsers: usersRegistry.length > 0,
      hasEmployer,
      employerCodeRequired: Boolean(
        envEmployerCode || hasEmployer || employerConfig.accessCodeHash
      ),
    });
  });

  app.post('/api/auth/register', (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim().slice(0, 80);
      const company = String(body.company || '').trim().slice(0, 80);
      const email = String(body.email || '').trim().toLowerCase().slice(0, 140);
      const password = String(body.password || '');
      const requestedRole: UserRole =
        body.role === 'employer' ? 'employer' : 'worker';
      const employerCode = String(body.employerCode || '').trim();

      if (name.length < 2) {
        return res.status(400).json({
          ok: false,
          error: 'Inserisci un nome valido (almeno 2 caratteri).',
        });
      }
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({
          ok: false,
          error: 'Inserisci un indirizzo email valido.',
        });
      }
      if (password.length < 8) {
        return res.status(400).json({
          ok: false,
          error: 'La password deve contenere almeno 8 caratteri.',
        });
      }

      const duplicate = usersRegistry.find((u) => u.email === email);
      if (duplicate) {
        return res.status(409).json({
          ok: false,
          error: 'Esiste già un account registrato con questa email.',
        });
      }

      // Server-enforced Employer role verification
      const envEmployerCode = (process.env.EMPLOYER_ACCESS_CODE || '').trim();
      const employerExists = hasAnyEmployer();
      let shouldStoreClaimedEmployerCode = false;

      if (requestedRole === 'employer') {
        if (envEmployerCode) {
          if (!employerCode || !safeCompareSecret(employerCode, envEmployerCode)) {
            return res.status(403).json({
              ok: false,
              error: 'Codice Accesso Direzione non valido.',
            });
          }
        } else if (employerExists || employerConfig.accessCodeHash) {
          if (
            !employerConfig.accessCodeHash ||
            !employerCode ||
            !verifyPassword(employerCode, employerConfig.accessCodeHash)
          ) {
            return res.status(403).json({
              ok: false,
              error:
                'Codice Accesso Direzione non valido. Richiedi il codice al titolare.',
            });
          }
        } else {
          // First-run Employer bootstrap: require a user-chosen access code (>= 6 chars) to lock future employer signups
          if (employerCode.length < 6) {
            return res.status(400).json({
              ok: false,
              error:
                'Imposta un Codice Segreto Direzione di almeno 6 caratteri per proteggere l\'accesso del Datore di Lavoro.',
            });
          }
          shouldStoreClaimedEmployerCode = true;
        }
      }

      const isFirstUser = usersRegistry.length === 0;
      const userId = `usr_${crypto.randomBytes(10).toString('hex')}`;
      const newUser: StoredUser = {
        id: userId,
        name,
        company: company || undefined,
        email,
        role: requestedRole,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };

      usersRegistry = [...usersRegistry, newUser];
      writeJsonFile(USERS_FILE, usersRegistry);

      if (shouldStoreClaimedEmployerCode) {
        employerConfig = {
          accessCodeHash: hashPassword(employerCode),
          claimedByUserId: userId,
          claimedAt: new Date().toISOString(),
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
      res.setHeader('Cache-Control', 'no-store');
      addSystemLog(
        'info',
        'Auth Vault',
        `Nuovo profilo registrato: ${newUser.name} (${newUser.role === 'employer' ? 'Direzione' : 'Operatore'})`,
        true
      );
      return res.status(201).json({
        ok: true,
        token,
        user: toPublicUser(newUser),
        migratedLegacy: isFirstUser,
      });
    } catch (err) {
      console.error('[CaricoStudio Auth] Errore registrazione:', err);
      return res.status(500).json({ ok: false, error: 'Errore durante la registrazione.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const body = req.body || {};
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const rememberMe = body.rememberMe !== false;

      const found = usersRegistry.find((u) => u.email === email);
      if (!found || !verifyPassword(password, found.passwordHash)) {
        addSystemLog('warn', 'Auth Vault', 'Tentativo di accesso non riuscito', true);
        return res.status(401).json({
          ok: false,
          error: 'Email o password non corretti.',
        });
      }

      const token = createSessionForUser(found.id, rememberMe);
      setSessionCookie(res, req, token, rememberMe);
      res.setHeader('Cache-Control', 'no-store');
      addSystemLog('info', 'Auth Vault', `Accesso effettuato: ${found.name}`, true);
      return res.json({
        ok: true,
        token,
        user: toPublicUser(found),
      });
    } catch (err) {
      console.error('[CaricoStudio Auth] Errore login:', err);
      return res.status(500).json({ ok: false, error: 'Errore durante il login.' });
    }
  });

  app.get('/api/auth/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const bearerToken = extractBearerToken(req);
    const cookieToken = !bearerToken
      ? parseCookieValue(req, METATRON_SESSION_COOKIE)
      : null;

    if (!bearerToken && cookieToken) {
      if (!req.headers['x-requested-with']) {
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
      user: resolved.user,
    });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const bearerToken = extractBearerToken(req);
    const cookieToken = !bearerToken
      ? parseCookieValue(req, METATRON_SESSION_COOKIE)
      : null;

    if (!bearerToken && cookieToken) {
      const hasCustomHeader = Boolean(req.headers['x-requested-with']);
      if (!hasCustomHeader && !isSameOriginHeader(req)) {
        return res.status(403).json({
          ok: false,
          error: 'Richiesta non autorizzata.',
        });
      }
    }

    const resolved = resolveSessionFromBearer(bearerToken || cookieToken);
    if (resolved) {
      sessionsRegistry = sessionsRegistry.filter(
        (s) => s.tokenHash !== resolved.tokenHash
      );
      writeJsonFile(SESSIONS_FILE, sessionsRegistry);
      addSystemLog('info', 'Auth Vault', `Disconnessione: ${resolved.user.name}`, true);
    }
    clearSessionCookie(res, req);
    return res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ ok: true, user: req.authUser });
  });

  // =========================================================================
  // PUBLIC STANDALONE MOBILE QR ENDPOINT (/t?d=...) — ZERO APP, ZERO LOGIN
  // =========================================================================
  function resolvePublicTrackLive(encoded: string): PublicResolvedTrack | null {
    const base = decodeTrackTokenServer(encoded);
    if (!base) return null;

    // Cerca corrispondenza ESATTA per (commessaCode + entityId) nei dati persistenti
    // per mostrare date carico/scarico live e contenuti senza esporre altri dati utente
    const targetCodeUpper = base.commessaCode.trim().toUpperCase();
    if (base.entityId && targetCodeUpper) {
      for (const u of usersRegistry) {
        const cache = getUserCache(u.id);
        const matchedLoad = cache.loads.find(
          (l: any) =>
            l && String(l.code || '').trim().toUpperCase() === targetCodeUpper
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
      // Fallback anche sui file legacy se non ci sono ancora utenti registrati
      if (usersRegistry.length === 0 && fs.existsSync(LEGACY_LOADS_FILE)) {
        const legacyLoads = readJsonFile<any[]>(LEGACY_LOADS_FILE, []);
        const legacyInv = readJsonFile<{ movements?: any[] } | null>(
          LEGACY_INVENTORY_FILE,
          null
        );
        const matchedLoad = legacyLoads.find(
          (l: any) =>
            l && String(l.code || '').trim().toUpperCase() === targetCodeUpper
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

  app.get('/t', (req, res) => {
    const rawD = String(req.query.d || req.query.track || '').trim();
    const resolved = rawD ? resolvePublicTrackLive(rawD) : null;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(resolved ? 200 : 400).send(renderStandaloneTrackHtml(resolved));
  });

  app.get('/api/public/track', (req, res) => {
    const rawD = String(req.query.d || req.query.track || '').trim();
    const resolved = rawD ? resolvePublicTrackLive(rawD) : null;
    if (!resolved) {
      return res.status(404).json({ ok: false, error: 'Scheda QR non trovata' });
    }
    return res.json({ ok: true, record: resolved });
  });

  // Protect process from malformed WebSocket frame exceptions caused by proxy probes or HMR
  process.on('uncaughtException', (err: any) => {
    if (
      err?.message?.includes('WebSocket frame') ||
      err?.message?.includes('status code') ||
      err?.message?.includes('Invalid WebSocket frame')
    ) {
      console.warn('[CaricoStudio WS] Suppressed benign WebSocket frame error:', err?.message || err);
      return;
    }
    console.error('[CaricoStudio] Uncaught exception:', err);
  });

  // WebSocket Server for Real-Time Sync scoped STRICTLY per authenticated user
  const wss = new WebSocketServer({ noServer: true });
  const wsUserMap = new WeakMap<WebSocket, string>();

  wss.on('error', (err: any) => {
    console.warn('[CaricoStudio WS] WebSocket server warning:', err?.message || err);
  });

  const viteWs = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) => {
      for (const p of protocols) {
        if (p === 'vite-hmr') return 'vite-hmr';
      }
      return false;
    },
  });

  viteWs.on('error', (err: any) => {
    console.warn('[CaricoStudio Vite WS] Server warning:', err?.message || err);
  });

  viteWs.on('connection', (ws) => {
    ws.on('error', (err: any) => {
      console.warn('[CaricoStudio Vite WS] Socket warning:', err?.message || err);
    });
    try {
      ws.send(JSON.stringify({ type: 'connected' }));
    } catch {}
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {}
    });
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        viteWs.handleUpgrade(request, socket, head, (ws) => {
          viteWs.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  function broadcastToUser(userId: string, sender: WebSocket | null, message: object) {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (
        client !== sender &&
        client.readyState === WebSocket.OPEN &&
        wsUserMap.get(client) === userId
      ) {
        client.send(data);
      }
    });
  }

  function getOnlineCountForUser(userId: string): number {
    let count = 0;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && wsUserMap.get(client) === userId) {
        count++;
      }
    });
    return count;
  }

  function broadcastPresenceForUser(userId: string) {
    const count = getOnlineCountForUser(userId);
    const data = JSON.stringify({ type: 'presence', count });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && wsUserMap.get(client) === userId) {
        client.send(data);
      }
    });
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'auth') {
          const resolved = resolveSessionFromBearer(msg.token);
          if (!resolved) {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Sessione non valida' }));
            ws.close(4001, 'Unauthorized');
            return;
          }
          const userId = resolved.user.id;
          wsUserMap.set(ws, userId);
          const cache = getUserCache(userId);
          ws.send(
            JSON.stringify({
              type: 'init',
              loads: cache.loads.length > 0 ? cache.loads : null,
              count: getOnlineCountForUser(userId),
            })
          );
          broadcastPresenceForUser(userId);
          return;
        }

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        const userId = wsUserMap.get(ws);
        if (!userId) {
          return;
        }

        if (msg.type === 'sync_loads' && Array.isArray(msg.loads)) {
          saveUserLoads(userId, msg.loads);
          broadcastToUser(userId, ws, {
            type: 'loads_updated',
            loads: msg.loads,
            senderId: msg.senderId,
          });
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      const userId = wsUserMap.get(ws);
      wsUserMap.delete(ws);
      if (userId) {
        broadcastPresenceForUser(userId);
      }
    });

    ws.on('error', (err: any) => {
      console.warn('[CaricoStudio WS] Client socket warning:', err?.message || err);
    });
  });

  // =========================================================================
  // PER-USER AUTHENTICATED REST ENDPOINTS
  // =========================================================================
  app.get('/api/loads', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const cache = getUserCache(userId);
    res.json({ loads: cache.loads, count: getOnlineCountForUser(userId) });
  });

  app.post('/api/loads', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    if (Array.isArray(req.body.loads)) {
      saveUserLoads(userId, req.body.loads);
      broadcastToUser(userId, null, {
        type: 'loads_updated',
        loads: req.body.loads,
        senderId: req.body.senderId,
      });
      res.json({
        success: true,
        count: getOnlineCountForUser(userId),
        totalLoads: req.body.loads.length,
      });
    } else {
      res.status(400).json({ error: 'loads must be an array' });
    }
  });

  app.post('/api/sync-load', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const load = req.body.load || req.body;
      if (!load || (!load.code && !load.id)) {
        return res
          .status(400)
          .json({ error: 'Carico non valido: parametri code o id mancanti.' });
      }

      const cache = getUserCache(userId);
      const nextLoads = [...cache.loads];
      const existingIndex = nextLoads.findIndex(
        (l: any) =>
          (load.id && l.id === load.id) ||
          (load.code && l.code?.trim().toLowerCase() === load.code.trim().toLowerCase())
      );

      if (existingIndex >= 0) {
        nextLoads[existingIndex] = { ...nextLoads[existingIndex], ...load };
      } else {
        nextLoads.unshift(load);
      }

      saveUserLoads(userId, nextLoads);
      broadcastToUser(userId, null, {
        type: 'loads_updated',
        loads: nextLoads,
        senderId: req.body.senderId || 'rest_sync_single',
      });

      res.json({
        success: true,
        loadCode: load.code,
        itemsCount: load.items?.length || 0,
        palletsCount: load.pallets?.length || 0,
        boxesCount: load.boxes?.length || 0,
        count: getOnlineCountForUser(userId),
      });
    } catch (err: any) {
      console.error('Error in /api/sync-load:', err);
      res
        .status(500)
        .json({ error: err.message || 'Errore durante la sincronizzazione del carico.' });
    }
  });

  // Timbro live Data/Ora Carico o Scarico (richiede utente autenticato)
  app.post('/api/track/stamp', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const body = req.body || {};
    const commessaCode = String(body.commessaCode || '').trim().toUpperCase();
    const entityType = String(body.entityType || '').trim();
    const entityId = String(body.entityId || '').trim();
    const entityCode = String(body.entityCode || '').trim().toUpperCase();
    const field =
      body.field === 'shippedAt'
        ? 'shippedAt'
        : body.field === 'loadedAt'
        ? 'loadedAt'
        : null;
    const timestampIso = body.timestampIso
      ? String(body.timestampIso)
      : new Date().toISOString();

    if (!commessaCode || !field) {
      return res.status(400).json({ ok: false, error: 'Parametri non validi' });
    }

    const cache = getUserCache(userId);
    let updated = false;
    const nextLoads = cache.loads.map((load: any) => {
      if (!load || String(load.code || '').trim().toUpperCase() !== commessaCode) {
        return load;
      }
      updated = true;

      if (entityType === 'load') {
        return {
          ...load,
          [field]: timestampIso,
          pallets: (load.pallets || []).map((p: any) => ({ ...p, [field]: timestampIso })),
          boxes: (load.boxes || []).map((b: any) => ({ ...b, [field]: timestampIso })),
          items: (load.items || []).map((it: any) => ({ ...it, [field]: timestampIso })),
        };
      }

      if (entityType === 'pallet') {
        const targetPallet = (load.pallets || []).find(
          (p: any) => p.id === entityId || String(p.code || '').toUpperCase() === entityCode
        );
        const pid = targetPallet?.id || entityId;
        const boxIdsOnPallet = new Set(
          (load.boxes || []).filter((b: any) => b.palletId === pid).map((b: any) => b.id)
        );
        return {
          ...load,
          pallets: (load.pallets || []).map((p: any) =>
            p.id === pid ? { ...p, [field]: timestampIso } : p
          ),
          boxes: (load.boxes || []).map((b: any) =>
            b.palletId === pid ? { ...b, [field]: timestampIso } : b
          ),
          items: (load.items || []).map((it: any) =>
            it.palletId === pid || (it.boxId && boxIdsOnPallet.has(it.boxId))
              ? { ...it, [field]: timestampIso }
              : it
          ),
        };
      }

      if (entityType === 'box') {
        const targetBox = (load.boxes || []).find(
          (b: any) => b.id === entityId || String(b.code || '').toUpperCase() === entityCode
        );
        const bid = targetBox?.id || entityId;
        return {
          ...load,
          boxes: (load.boxes || []).map((b: any) =>
            b.id === bid ? { ...b, [field]: timestampIso } : b
          ),
          items: (load.items || []).map((it: any) =>
            it.boxId === bid ? { ...it, [field]: timestampIso } : it
          ),
        };
      }

      if (entityType === 'item') {
        return {
          ...load,
          items: (load.items || []).map((it: any) =>
            it.id === entityId || String(it.sku || '').toUpperCase() === entityCode
              ? { ...it, [field]: timestampIso }
              : it
          ),
        };
      }

      return load;
    });

    if (updated) {
      saveUserLoads(userId, nextLoads);
      broadcastToUser(userId, null, {
        type: 'loads_updated',
        loads: nextLoads,
        senderId: 'qr_scan_server',
      });
    }

    return res.json({ ok: true, updated, timestampIso });
  });

  app.get('/api/inventory', requireAuth, (req: AuthenticatedRequest, res) => {
    const cache = getUserCache(req.authUser!.id);
    res.json({ inventory: cache.inventory });
  });

  app.post('/api/inventory', requireAuth, (req: AuthenticatedRequest, res) => {
    const { inventory } = req.body || {};
    if (
      inventory &&
      Array.isArray(inventory.items) &&
      Array.isArray(inventory.movements)
    ) {
      const cleanCategories: string[] | undefined = Array.isArray(inventory.categories)
        ? Array.from(
            new Set<string>(
              (inventory.categories as unknown[])
                .filter((c): c is string => typeof c === 'string')
                .map((c) => c.trim().slice(0, 80))
                .filter(Boolean)
            )
          ).slice(0, 200)
        : undefined;
      saveUserInventory(req.authUser!.id, {
        items: inventory.items,
        movements: inventory.movements,
        ...(cleanCategories !== undefined ? { categories: cleanCategories } : {}),
        hiddenCommessaCodes: Array.isArray(inventory.hiddenCommessaCodes)
          ? inventory.hiddenCommessaCodes
          : [],
      });
      return res.json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Payload inventario non valido' });
  });

  // --- ANAGRAFICA CLIENTI & FORNITORI (Isolata per Utente) ---
  const SAFE_DATAURL_IMG_RE = /^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]{1,600000}$/;
  const clipStr = (val: unknown, maxLen: number): string =>
    typeof val === 'string' ? val.trim().slice(0, maxLen) : '';
  const safeNum = (val: unknown, min = 0, max = 1e9): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  };

  app.get('/api/crm', requireAuth, (req: AuthenticatedRequest, res) => {
    const cache = getUserCache(req.authUser!.id);
    return res.json({ contacts: cache.crmContacts });
  });

  app.post('/api/crm', requireAuth, (req: AuthenticatedRequest, res) => {
    const { contacts } = req.body || {};
    if (!Array.isArray(contacts) || contacts.length > 2000) {
      return res.status(400).json({ ok: false, error: 'Elenco anagrafiche non valido' });
    }
    const allowedKinds = new Set(['cliente', 'fornitore', 'entrambi']);
    const sanitized = contacts
      .filter((c) => c && typeof c === 'object' && clipStr(c.companyName, 200))
      .map((c) => {
        const rawWebsite = clipStr(c.website, 240);
        const safeWebsite =
          rawWebsite && /^https?:\/\//i.test(rawWebsite)
            ? rawWebsite
            : rawWebsite && !/^(javascript|data|vbscript):/i.test(rawWebsite)
            ? `https://${rawWebsite}`
            : '';
        return {
          id: clipStr(c.id, 80) || `crm_${crypto.randomBytes(6).toString('hex')}`,
          kind: allowedKinds.has(c.kind) ? c.kind : 'cliente',
          code: clipStr(c.code, 40),
          companyName: clipStr(c.companyName, 200),
          contactName: clipStr(c.contactName, 140),
          vatNumber: clipStr(c.vatNumber, 40),
          sdiCode: clipStr(c.sdiCode, 80),
          email: clipStr(c.email, 160),
          phone: clipStr(c.phone, 50),
          mobile: clipStr(c.mobile, 50),
          website: safeWebsite,
          billingAddress: clipStr(c.billingAddress, 240),
          shippingAddress: clipStr(c.shippingAddress, 240),
          city: clipStr(c.city, 100),
          province: clipStr(c.province, 16),
          postalCode: clipStr(c.postalCode, 20),
          country: clipStr(c.country, 80) || 'Italia',
          defaultCarrier: clipStr(c.defaultCarrier, 120),
          paymentTerms: clipStr(c.paymentTerms, 100),
          leadTimeDays:
            c.leadTimeDays !== undefined && c.leadTimeDays !== null && c.leadTimeDays !== ''
              ? Math.round(safeNum(c.leadTimeDays, 0, 365))
              : undefined,
          notes: clipStr(c.notes, 2000),
          isFavorite: Boolean(c.isFavorite),
          createdAt: clipStr(c.createdAt, 40) || new Date().toISOString(),
          updatedAt: clipStr(c.updatedAt, 40) || new Date().toISOString(),
        };
      });
    saveUserCrmContacts(req.authUser!.id, sanitized);
    return res.json({ ok: true, contacts: sanitized });
  });

  // --- DDT / DOCUMENTI DI TRASPORTO (Isolati per Utente) ---
  app.get('/api/ddt', requireAuth, (req: AuthenticatedRequest, res) => {
    const cache = getUserCache(req.authUser!.id);
    return res.json({ documents: cache.ddtDocuments });
  });

  app.post('/api/ddt', requireAuth, (req: AuthenticatedRequest, res) => {
    const { documents } = req.body || {};
    if (!Array.isArray(documents) || documents.length > 2000) {
      return res.status(400).json({ ok: false, error: 'Elenco DDT non valido' });
    }
    const allowedStatuses = new Set(['bozza', 'emesso', 'in_transito', 'consegnato', 'annullato']);
    const allowedCausals = new Set([
      'Vendita',
      'Conto Lavorazione',
      'Conto Visione',
      'Reso',
      'Trasferimento Interno',
      'Riparazione',
      'Omaggio',
    ]);
    const allowedTransportBy = new Set(['Mittente', 'Destinatario', 'Vettore']);
    const sanitized = documents
      .filter((d) => d && typeof d === 'object' && clipStr(d.number, 60))
      .map((d) => {
        const rawItems = Array.isArray(d.items) ? d.items.slice(0, 500) : [];
        const items = rawItems
          .filter((it: any) => it && typeof it === 'object')
          .map((it: any) => ({
            id: clipStr(it.id, 80) || `ddti_${crypto.randomBytes(5).toString('hex')}`,
            sku: clipStr(it.sku, 80),
            description: clipStr(it.description, 240),
            unit: clipStr(it.unit, 24) || 'pz',
            quantity: safeNum(it.quantity, 0, 1e7),
            unitWeightKg: safeNum(it.unitWeightKg, 0, 1e6),
            notes: clipStr(it.notes, 300),
          }));
        const driverSig =
          typeof d.driverSignatureDataUrl === 'string' &&
          SAFE_DATAURL_IMG_RE.test(d.driverSignatureDataUrl)
            ? d.driverSignatureDataUrl
            : undefined;
        const recipientSig =
          typeof d.recipientSignatureDataUrl === 'string' &&
          SAFE_DATAURL_IMG_RE.test(d.recipientSignatureDataUrl)
            ? d.recipientSignatureDataUrl
            : undefined;
        return {
          id: clipStr(d.id, 80) || `ddt_${crypto.randomBytes(6).toString('hex')}`,
          number: clipStr(d.number, 60),
          progressiveNumber: Math.round(safeNum(d.progressiveNumber, 1, 999999)),
          year: Math.round(safeNum(d.year, 2000, 2100)),
          issueDate: clipStr(d.issueDate, 20) || new Date().toISOString().slice(0, 10),
          transportDateTime:
            clipStr(d.transportDateTime, 30) || new Date().toISOString().slice(0, 16),
          status: allowedStatuses.has(d.status) ? d.status : 'bozza',
          commessaId: clipStr(d.commessaId, 80) || undefined,
          commessaCode: clipStr(d.commessaCode, 60) || undefined,
          commessaTitle: clipStr(d.commessaTitle, 200) || undefined,
          senderCompany: clipStr(d.senderCompany, 200) || 'METATRON CaricoStudio',
          senderVat: clipStr(d.senderVat, 40),
          senderAddress: clipStr(d.senderAddress, 240),
          clientId: clipStr(d.clientId, 80) || undefined,
          recipientName: clipStr(d.recipientName, 200),
          recipientVat: clipStr(d.recipientVat, 40),
          recipientAddress: clipStr(d.recipientAddress, 240),
          destinationAddress: clipStr(d.destinationAddress, 240),
          causal: allowedCausals.has(d.causal) ? d.causal : 'Vendita',
          transportBy: allowedTransportBy.has(d.transportBy) ? d.transportBy : 'Vettore',
          carrierName: clipStr(d.carrierName, 160),
          driverName: clipStr(d.driverName, 120),
          vehiclePlate: clipStr(d.vehiclePlate, 30),
          trackingCode: clipStr(d.trackingCode, 80),
          appearance: clipStr(d.appearance, 200) || 'Bancali filmati e scatole',
          packagesCount: Math.round(safeNum(d.packagesCount, 0, 100000)),
          palletsCount: Math.round(safeNum(d.palletsCount, 0, 10000)),
          grossWeightKg: safeNum(d.grossWeightKg, 0, 1e7),
          netWeightKg: safeNum(d.netWeightKg, 0, 1e7),
          porto: d.porto === 'Assegnato' ? 'Assegnato' : 'Franco',
          items,
          notes: clipStr(d.notes, 2000),
          driverSignatureDataUrl: driverSig,
          recipientSignatureDataUrl: recipientSig,
          signedAt: clipStr(d.signedAt, 40) || undefined,
          createdBy: clipStr(d.createdBy, 120) || req.authUser!.name,
          createdAt: clipStr(d.createdAt, 40) || new Date().toISOString(),
          updatedAt: clipStr(d.updatedAt, 40) || new Date().toISOString(),
        };
      });
    saveUserDdtDocuments(req.authUser!.id, sanitized);
    return res.json({ ok: true, documents: sanitized });
  });

  // --- ORDINI FORNITORI & RIORDINO SCORTE (Isolati per Utente) ---
  app.get('/api/purchase-orders', requireAuth, (req: AuthenticatedRequest, res) => {
    const cache = getUserCache(req.authUser!.id);
    return res.json({ orders: cache.purchaseOrders });
  });

  app.post('/api/purchase-orders', requireAuth, (req: AuthenticatedRequest, res) => {
    const { orders } = req.body || {};
    if (!Array.isArray(orders) || orders.length > 2000) {
      return res.status(400).json({ ok: false, error: 'Elenco ordini fornitori non valido' });
    }
    const allowedStatuses = new Set([
      'bozza',
      'inviato',
      'confermato',
      'parziale',
      'ricevuto',
      'annullato',
    ]);
    const sanitized = orders
      .filter((o) => o && typeof o === 'object' && clipStr(o.number, 60))
      .map((o) => {
        const rawItems = Array.isArray(o.items) ? o.items.slice(0, 500) : [];
        const items = rawItems
          .filter((it: any) => it && typeof it === 'object')
          .map((it: any) => ({
            id: clipStr(it.id, 80) || `poi_${crypto.randomBytes(5).toString('hex')}`,
            inventoryItemId: clipStr(it.inventoryItemId, 80) || undefined,
            sku: clipStr(it.sku, 80),
            name: clipStr(it.name, 220),
            unit: clipStr(it.unit, 24) || 'pz',
            currentStockAtOrder: safeNum(it.currentStockAtOrder, 0, 1e7),
            minStockAtOrder: safeNum(it.minStockAtOrder, 0, 1e7),
            orderedQty: safeNum(it.orderedQty, 0, 1e7),
            receivedQty: safeNum(it.receivedQty, 0, 1e7),
            unitCostEur: safeNum(it.unitCostEur, 0, 1e8),
            notes: clipStr(it.notes, 300),
          }));
        return {
          id: clipStr(o.id, 80) || `po_${crypto.randomBytes(6).toString('hex')}`,
          number: clipStr(o.number, 60),
          progressiveNumber: Math.round(safeNum(o.progressiveNumber, 1, 999999)),
          year: Math.round(safeNum(o.year, 2000, 2100)),
          orderDate: clipStr(o.orderDate, 20) || new Date().toISOString().slice(0, 10),
          expectedDeliveryDate: clipStr(o.expectedDeliveryDate, 20) || undefined,
          status: allowedStatuses.has(o.status) ? o.status : 'bozza',
          supplierId: clipStr(o.supplierId, 80) || undefined,
          supplierName: clipStr(o.supplierName, 200) || 'Fornitore generico',
          supplierEmail: clipStr(o.supplierEmail, 160),
          supplierPhone: clipStr(o.supplierPhone, 50),
          supplierVat: clipStr(o.supplierVat, 40),
          supplierAddress: clipStr(o.supplierAddress, 240),
          paymentTerms: clipStr(o.paymentTerms, 100),
          deliveryAddress: clipStr(o.deliveryAddress, 240),
          notes: clipStr(o.notes, 2000),
          items,
          receivedAt: clipStr(o.receivedAt, 40) || undefined,
          stockLoaded: Boolean(o.stockLoaded),
          createdBy: clipStr(o.createdBy, 120) || req.authUser!.name,
          createdAt: clipStr(o.createdAt, 40) || new Date().toISOString(),
          updatedAt: clipStr(o.updatedAt, 40) || new Date().toISOString(),
        };
      });
    saveUserPurchaseOrders(req.authUser!.id, sanitized);
    return res.json({ ok: true, orders: sanitized });
  });

  // --- APP FOTO PER COMMESSA (Isolata per Utente) ---
  app.get('/api/photos', requireAuth, (req: AuthenticatedRequest, res) => {
    const cache = getUserCache(req.authUser!.id);
    res.json({ photos: cache.photos });
  });

  app.post('/api/photos', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body || {};
      const id = String(body.id || '').trim();
      const dataUrl = String(body.dataUrl || '');
      if (!SAFE_PHOTO_ID_RE.test(id)) {
        return res.status(400).json({ ok: false, error: 'ID foto non valido' });
      }
      const match = dataUrl.match(
        /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/
      );
      if (!match) {
        return res.status(400).json({ ok: false, error: 'Formato immagine non valido' });
      }
      const mimeType = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      const fileExt =
        mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const buffer = Buffer.from(match[2], 'base64');

      const paths = getUserPaths(userId);
      ensureDir(paths.photosDir);
      const filePath = assertSafeChildPath(
        paths.photosDir,
        path.join(paths.photosDir, `${id}.${fileExt}`)
      );
      fs.writeFileSync(filePath, buffer);

      const record: ServerPhotoRecord = {
        id,
        commessaId: String(body.commessaId || ''),
        commessaCode: String(body.commessaCode || 'COMMESSA'),
        commessaTitle: String(body.commessaTitle || ''),
        caption: String(body.caption || ''),
        capturedAt: String(body.capturedAt || new Date().toISOString()),
        width: Number(body.width) || 0,
        height: Number(body.height) || 0,
        sizeBytes: buffer.length,
        mimeType,
        fileExt,
      };

      const cache = getUserCache(userId);
      saveUserPhotos(userId, [record, ...cache.photos.filter((p) => p.id !== id)]);
      return res.json({ ok: true, photo: record });
    } catch (err) {
      console.error('[CaricoStudio] Errore salvataggio foto:', err);
      return res.status(500).json({ ok: false, error: 'Errore salvataggio foto' });
    }
  });

  app.get('/api/photos/:id/file', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_PHOTO_ID_RE.test(id)) {
      return res.status(400).send('Invalid photo ID');
    }
    const cache = getUserCache(userId);
    const meta = cache.photos.find((p) => p.id === id);
    if (!meta) return res.status(404).send('Photo not found');
    const paths = getUserPaths(userId);
    const target = assertSafeChildPath(
      paths.photosDir,
      path.join(paths.photosDir, `${id}.${meta.fileExt || 'jpg'}`)
    );
    if (fs.existsSync(target)) {
      res.setHeader(
        'Content-Type',
        meta.fileExt === 'png'
          ? 'image/png'
          : meta.fileExt === 'webp'
          ? 'image/webp'
          : 'image/jpeg'
      );
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.sendFile(target);
    }
    return res.status(404).send('Photo not found');
  });

  app.patch('/api/photos/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_PHOTO_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID foto non valido' });
    }
    const caption = String((req.body || {}).caption ?? '');
    const cache = getUserCache(userId);
    const nextPhotos = cache.photos.map((p) => (p.id === id ? { ...p, caption } : p));
    saveUserPhotos(userId, nextPhotos);
    return res.json({ ok: true });
  });

  app.delete('/api/photos/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_PHOTO_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID foto non valido' });
    }
    const cache = getUserCache(userId);
    const existing = cache.photos.find((p) => p.id === id);
    saveUserPhotos(
      userId,
      cache.photos.filter((p) => p.id !== id)
    );
    const paths = getUserPaths(userId);
    const exts = existing ? [existing.fileExt] : ['jpg', 'png', 'webp'];
    for (const ext of exts) {
      const target = assertSafeChildPath(
        paths.photosDir,
        path.join(paths.photosDir, `${id}.${ext}`)
      );
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
          // ignore
        }
      }
    }
    return res.json({ ok: true });
  });

  // --- APP FILE (Isolata per Utente) ---
  app.get('/api/files', requireAuth, (req: AuthenticatedRequest, res) => {
    const cache = getUserCache(req.authUser!.id);
    res.json(cache.filesState);
  });

  app.post('/api/files/folders', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const body = req.body || {};
    const id = String(body.id || '').trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID cartella non valido' });
    }
    const folder = {
      id,
      name: String(body.name || 'Nuova Cartella').trim().slice(0, 120),
      parentId: body.parentId ? String(body.parentId) : null,
      color: String(body.color || 'blue'),
      commessaCode: body.commessaCode ? String(body.commessaCode).trim() : undefined,
      createdAt: String(body.createdAt || new Date().toISOString()),
      updatedAt: String(body.updatedAt || new Date().toISOString()),
    };
    const cache = getUserCache(userId);
    saveUserFilesState(userId, {
      ...cache.filesState,
      folders: [...cache.filesState.folders.filter((f: any) => f.id !== id), folder],
    });
    return res.json({ ok: true, folder });
  });

  app.patch('/api/files/folders/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID cartella non valido' });
    }
    const body = req.body || {};
    const cache = getUserCache(userId);
    saveUserFilesState(userId, {
      ...cache.filesState,
      folders: cache.filesState.folders.map((f: any) => {
        if (f.id !== id) return f;
        return {
          ...f,
          name: body.name !== undefined ? String(body.name).trim().slice(0, 120) : f.name,
          color: body.color !== undefined ? String(body.color) : f.color,
          commessaCode:
            body.commessaCode !== undefined
              ? String(body.commessaCode).trim() || undefined
              : f.commessaCode,
          parentId: body.parentId !== undefined ? body.parentId || null : f.parentId,
          updatedAt: new Date().toISOString(),
        };
      }),
    });
    return res.json({ ok: true });
  });

  app.delete('/api/files/folders/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID cartella non valido' });
    }
    const cache = getUserCache(userId);
    const toDelete = new Set<string>([id]);
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
      (fl: any) => fl.folderId && toDelete.has(fl.folderId)
    );
    for (const fl of removedFiles) {
      const safeExt =
        String(fl.extension || 'bin')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 10) || 'bin';
      const target = assertSafeChildPath(
        paths.filesDir,
        path.join(paths.filesDir, `${fl.id}.${safeExt}`)
      );
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
          // ignore
        }
      }
    }

    saveUserFilesState(userId, {
      folders: cache.filesState.folders.filter((f: any) => !toDelete.has(f.id)),
      files: cache.filesState.files.filter(
        (fl: any) => !fl.folderId || !toDelete.has(fl.folderId)
      ),
    });
    return res.json({ ok: true });
  });

  app.post('/api/files/upload', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.authUser!.id;
      const body = req.body || {};
      const id = String(body.id || '').trim();
      const dataUrl = String(body.dataUrl || '');
      if (!SAFE_FILE_ID_RE.test(id)) {
        return res.status(400).json({ ok: false, error: 'ID file non valido' });
      }
      const commaIdx = dataUrl.indexOf(',');
      if (!dataUrl.startsWith('data:') || commaIdx === -1) {
        return res.status(400).json({ ok: false, error: 'Contenuto file non valido' });
      }
      const headerPart = dataUrl.slice(5, commaIdx);
      const mimeFromHeader = headerPart.split(';')[0] || 'application/octet-stream';
      const base64Data = dataUrl.slice(commaIdx + 1);
      const buffer = Buffer.from(base64Data, 'base64');

      const safeExt =
        String(body.extension || 'bin')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 10) || 'bin';

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
        mimeType: String(body.mimeType || mimeFromHeader || 'application/octet-stream'),
        extension: safeExt,
        sizeBytes: buffer.length,
        source: body.source === 'app_foto' ? 'app_foto' : 'upload',
        createdAt: String(body.createdAt || new Date().toISOString()),
        updatedAt: String(body.updatedAt || new Date().toISOString()),
      };

      const cache = getUserCache(userId);
      saveUserFilesState(userId, {
        ...cache.filesState,
        files: [meta, ...cache.filesState.files.filter((f: any) => f.id !== id)],
      });
      return res.json({ ok: true, file: meta });
    } catch (err) {
      console.error('[CaricoStudio] Errore upload file:', err);
      return res.status(500).json({ ok: false, error: 'Errore caricamento file' });
    }
  });

  app.get('/api/files/:id/content', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).send('Invalid file ID');
    }
    const cache = getUserCache(userId);
    const meta = cache.filesState.files.find((f: any) => f.id === id);
    if (!meta) return res.status(404).send('File not found');
    const safeExt =
      String(meta.extension || 'bin')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10) || 'bin';
    const paths = getUserPaths(userId);
    const target = assertSafeChildPath(
      paths.filesDir,
      path.join(paths.filesDir, `${id}.${safeExt}`)
    );
    if (!fs.existsSync(target)) {
      return res.status(404).send('File content missing');
    }
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(meta.name || id)}"`
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(target);
  });

  app.patch('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID file non valido' });
    }
    const body = req.body || {};
    const cache = getUserCache(userId);
    saveUserFilesState(userId, {
      ...cache.filesState,
      files: cache.filesState.files.map((f: any) => {
        if (f.id !== id) return f;
        return {
          ...f,
          name: body.name !== undefined ? String(body.name).trim().slice(0, 180) : f.name,
          folderId: body.folderId !== undefined ? body.folderId || null : f.folderId,
          updatedAt: new Date().toISOString(),
        };
      }),
    });
    return res.json({ ok: true });
  });

  app.delete('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const userId = req.authUser!.id;
    const id = String(req.params.id || '').trim();
    if (!SAFE_FILE_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID file non valido' });
    }
    const cache = getUserCache(userId);
    const existing = cache.filesState.files.find((f: any) => f.id === id);
    saveUserFilesState(userId, {
      ...cache.filesState,
      files: cache.filesState.files.filter((f: any) => f.id !== id),
    });
    if (existing) {
      const safeExt =
        String(existing.extension || 'bin')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 10) || 'bin';
      const paths = getUserPaths(userId);
      const target = assertSafeChildPath(
        paths.filesDir,
        path.join(paths.filesDir, `${id}.${safeExt}`)
      );
      if (fs.existsSync(target)) {
        try {
          fs.unlinkSync(target);
        } catch {
          // ignore
        }
      }
    }
    return res.json({ ok: true });
  });

  // =========================================================================
  // DIRECTORY UTENTI & SCAMBIO DIRETTO FILE / FOTO TRA COLLEGHI
  // =========================================================================
  app.get('/api/users/directory', requireAuth, (req: AuthenticatedRequest, res) => {
    const users = usersRegistry.map((u) => ({
      id: u.id,
      name: u.name,
      company: u.company || undefined,
      role: u.role === 'employer' ? 'employer' : 'worker',
      isOnline: getOnlineCountForUser(u.id) > 0,
    }));
    return res.json({ ok: true, users });
  });

  app.get('/api/shares', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const myShares = sharesRegistry
      .filter((s) => s.senderId === me.id || s.recipientId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ ok: true, shares: myShares });
  });

  app.post('/api/shares', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const sender = req.authUser!;
      const body = req.body || {};
      const recipientId = String(body.recipientId || '').trim();
      const sourceType = String(body.sourceType || 'upload').trim();
      const message = String(body.message || '').trim().slice(0, 500);
      const commessaCode = String(body.commessaCode || '').trim().slice(0, 60);

      if (!SAFE_USER_ID_RE.test(recipientId)) {
        return res.status(400).json({ ok: false, error: 'Destinatario non valido.' });
      }
      const recipientStored = usersRegistry.find((u) => u.id === recipientId);
      if (!recipientStored) {
        return res.status(404).json({ ok: false, error: 'Utente destinatario non trovato.' });
      }
      if (recipientStored.id === sender.id) {
        return res.status(400).json({
          ok: false,
          error: 'Seleziona un altro utente registrato a cui inviare il file.',
        });
      }

      const shareId = `shr_${crypto.randomBytes(10).toString('hex')}`;
      let buffer: Buffer;
      let fileName = 'allegato';
      let mimeType = 'application/octet-stream';
      let safeExt = 'bin';
      let kind: 'photo' | 'file' = 'file';

      if (sourceType === 'photo') {
        const sourcePhotoId = String(body.sourcePhotoId || '').trim();
        if (!SAFE_PHOTO_ID_RE.test(sourcePhotoId)) {
          return res.status(400).json({ ok: false, error: 'ID foto non valido.' });
        }
        const senderCache = getUserCache(sender.id);
        const photoMeta = senderCache.photos.find((p) => p.id === sourcePhotoId);
        if (!photoMeta) {
          return res.status(404).json({ ok: false, error: 'Foto non trovata nel tuo archivio.' });
        }
        const senderPaths = getUserPaths(sender.id);
        safeExt =
          String(photoMeta.fileExt || 'jpg')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 10) || 'jpg';
        const srcPath = assertSafeChildPath(
          senderPaths.photosDir,
          path.join(senderPaths.photosDir, `${photoMeta.id}.${safeExt}`)
        );
        if (!fs.existsSync(srcPath)) {
          return res.status(404).json({ ok: false, error: 'Immagine non disponibile su disco.' });
        }
        buffer = fs.readFileSync(srcPath);
        mimeType = photoMeta.mimeType || 'image/jpeg';
        const cleanCaption = (photoMeta.caption || photoMeta.commessaCode || 'foto')
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .slice(0, 60);
        fileName = `${cleanCaption}.${safeExt}`;
        kind = 'photo';
      } else if (sourceType === 'file') {
        const sourceFileId = String(body.sourceFileId || '').trim();
        if (!SAFE_FILE_ID_RE.test(sourceFileId)) {
          return res.status(400).json({ ok: false, error: 'ID file non valido.' });
        }
        const senderCache = getUserCache(sender.id);
        const fileMeta = senderCache.filesState.files.find((f: any) => f.id === sourceFileId);
        if (!fileMeta) {
          return res.status(404).json({ ok: false, error: 'File non trovato nel tuo archivio.' });
        }
        const senderPaths = getUserPaths(sender.id);
        safeExt =
          String(fileMeta.extension || 'bin')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 10) || 'bin';
        const srcPath = assertSafeChildPath(
          senderPaths.filesDir,
          path.join(senderPaths.filesDir, `${fileMeta.id}.${safeExt}`)
        );
        if (!fs.existsSync(srcPath)) {
          return res.status(404).json({ ok: false, error: 'Contenuto file non trovato.' });
        }
        buffer = fs.readFileSync(srcPath);
        mimeType = String(fileMeta.mimeType || 'application/octet-stream');
        fileName = String(fileMeta.name || `file.${safeExt}`).slice(0, 180);
        kind = mimeType.startsWith('image/') ? 'photo' : 'file';
      } else {
        const dataUrl = String(body.dataUrl || '');
        const commaIdx = dataUrl.indexOf(',');
        if (!dataUrl.startsWith('data:') || commaIdx === -1) {
          return res.status(400).json({ ok: false, error: 'File allegato non valido.' });
        }
        const headerPart = dataUrl.slice(5, commaIdx);
        const mimeFromHeader = headerPart.split(';')[0] || 'application/octet-stream';
        buffer = Buffer.from(dataUrl.slice(commaIdx + 1), 'base64');
        if (buffer.length === 0 || buffer.length > 30 * 1024 * 1024) {
          return res.status(400).json({
            ok: false,
            error: 'Dimensione file non valida (massimo 30 MB).',
          });
        }
        fileName = String(body.fileName || 'documento').trim().slice(0, 180) || 'documento';
        const extFromName = fileName.includes('.')
          ? fileName.split('.').pop() || 'bin'
          : 'bin';
        safeExt =
          String(body.extension || extFromName)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .slice(0, 10) || 'bin';
        mimeType = String(body.mimeType || mimeFromHeader || 'application/octet-stream');
        kind = mimeType.startsWith('image/') ? 'photo' : 'file';
      }

      ensureDir(SHARED_FILES_DIR);
      const destPath = assertSafeChildPath(
        SHARED_FILES_DIR,
        path.join(SHARED_FILES_DIR, `${shareId}.${safeExt}`)
      );
      fs.writeFileSync(destPath, buffer);

      const record: ServerSharedTransfer = {
        id: shareId,
        senderId: sender.id,
        senderName: sender.name,
        senderRole: sender.role,
        recipientId: recipientStored.id,
        recipientName: recipientStored.name,
        recipientRole: recipientStored.role === 'employer' ? 'employer' : 'worker',
        fileName,
        mimeType,
        extension: safeExt,
        sizeBytes: buffer.length,
        kind,
        commessaCode: commessaCode || undefined,
        message: message || undefined,
        createdAt: new Date().toISOString(),
        savedByRecipient: false,
      };

      saveSharesRegistry([record, ...sharesRegistry]);
      broadcastToUser(recipientStored.id, null, {
        type: 'share_received',
        share: record,
      });
      pushUserNotification(recipientStored.id, {
        category: 'message',
        title:
          kind === 'photo'
            ? `Nuova foto da ${sender.name}`
            : `Nuovo file da ${sender.name}`,
        body: message
          ? `${fileName} — "${message}"`
          : `${sender.name} ti ha inviato ${fileName}${
              commessaCode ? ` (Commessa ${commessaCode})` : ''
            }`,
        targetApp: 'team_share',
        meta: {
          shareId: record.id,
          commessaCode: commessaCode || undefined,
        },
      });

      return res.status(201).json({ ok: true, share: record });
    } catch (err) {
      console.error('[CaricoStudio] Errore invio file tra utenti:', err);
      return res.status(500).json({ ok: false, error: 'Errore durante l\'invio del file.' });
    }
  });

  app.get('/api/shares/:id/download', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const shareId = String(req.params.id || '').trim();
    if (!SAFE_SHARE_ID_RE.test(shareId)) {
      return res.status(400).send('ID condivisione non valido');
    }
    const share = sharesRegistry.find((s) => s.id === shareId);
    if (!share) {
      return res.status(404).send('File condiviso non trovato');
    }
    if (
      share.senderId !== me.id &&
      share.recipientId !== me.id &&
      me.role !== 'employer'
    ) {
      return res.status(403).send('Accesso negato');
    }
    const safeExt =
      String(share.extension || 'bin')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10) || 'bin';
    const target = assertSafeChildPath(
      SHARED_FILES_DIR,
      path.join(SHARED_FILES_DIR, `${share.id}.${safeExt}`)
    );
    if (!fs.existsSync(target)) {
      return res.status(404).send('File non presente su disco');
    }
    const headers = getSafeDownloadHeaders(share.mimeType, share.fileName);
    res.setHeader('Content-Type', headers.contentType);
    res.setHeader('Content-Disposition', headers.disposition);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(target);
  });

  app.post('/api/shares/:id/save-to-files', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const me = req.authUser!;
      const shareId = String(req.params.id || '').trim();
      if (!SAFE_SHARE_ID_RE.test(shareId)) {
        return res.status(400).json({ ok: false, error: 'ID non valido.' });
      }
      const share = sharesRegistry.find((s) => s.id === shareId);
      if (!share) {
        return res.status(404).json({ ok: false, error: 'Elemento condiviso non trovato.' });
      }
      if (share.recipientId !== me.id && share.senderId !== me.id) {
        return res.status(403).json({ ok: false, error: 'Accesso non autorizzato.' });
      }
      const safeExt =
        String(share.extension || 'bin')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 10) || 'bin';
      const srcPath = assertSafeChildPath(
        SHARED_FILES_DIR,
        path.join(SHARED_FILES_DIR, `${share.id}.${safeExt}`)
      );
      if (!fs.existsSync(srcPath)) {
        return res.status(404).json({ ok: false, error: 'File originale mancante.' });
      }

      const targetType =
        req.body?.target === 'photos' && share.kind === 'photo' ? 'photos' : 'files';
      const myPaths = getUserPaths(me.id);
      const myCache = getUserCache(me.id);
      const nowIso = new Date().toISOString();

      if (targetType === 'photos') {
        const newPhotoId = `ph_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const photoExt = safeExt === 'png' || safeExt === 'webp' ? safeExt : 'jpg';
        ensureDir(myPaths.photosDir);
        const destPath = assertSafeChildPath(
          myPaths.photosDir,
          path.join(myPaths.photosDir, `${newPhotoId}.${photoExt}`)
        );
        fs.copyFileSync(srcPath, destPath);
        const photoRecord: ServerPhotoRecord = {
          id: newPhotoId,
          commessaId: share.commessaCode || 'shared_team',
          commessaCode: share.commessaCode || 'RICEVUTE',
          commessaTitle: `Ricevuta da ${share.senderName}`,
          caption: share.message || share.fileName,
          capturedAt: nowIso,
          width: 0,
          height: 0,
          sizeBytes: share.sizeBytes,
          mimeType: share.mimeType || 'image/jpeg',
          fileExt: photoExt,
        };
        saveUserPhotos(me.id, [photoRecord, ...myCache.photos]);
      } else {
        const newFileId = `fl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
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
          mimeType: share.mimeType || 'application/octet-stream',
          extension: safeExt,
          sizeBytes: share.sizeBytes,
          source: 'upload',
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        saveUserFilesState(me.id, {
          ...myCache.filesState,
          files: [fileMeta, ...myCache.filesState.files],
        });
      }

      if (share.recipientId === me.id) {
        saveSharesRegistry(
          sharesRegistry.map((s) =>
            s.id === share.id ? { ...s, savedByRecipient: true } : s
          )
        );
      }

      return res.json({ ok: true, savedTo: targetType });
    } catch (err) {
      console.error('[CaricoStudio] Errore salvataggio file condiviso:', err);
      return res.status(500).json({ ok: false, error: 'Errore salvataggio file.' });
    }
  });

  app.delete('/api/shares/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const shareId = String(req.params.id || '').trim();
    if (!SAFE_SHARE_ID_RE.test(shareId)) {
      return res.status(400).json({ ok: false, error: 'ID non valido.' });
    }
    const existing = sharesRegistry.find((s) => s.id === shareId);
    if (!existing) {
      return res.json({ ok: true });
    }
    if (
      existing.senderId !== me.id &&
      existing.recipientId !== me.id &&
      me.role !== 'employer'
    ) {
      return res.status(403).json({ ok: false, error: 'Accesso non autorizzato.' });
    }
    saveSharesRegistry(sharesRegistry.filter((s) => s.id !== shareId));
    const safeExt =
      String(existing.extension || 'bin')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10) || 'bin';
    const target = assertSafeChildPath(
      SHARED_FILES_DIR,
      path.join(SHARED_FILES_DIR, `${existing.id}.${safeExt}`)
    );
    if (fs.existsSync(target)) {
      try {
        fs.unlinkSync(target);
      } catch {
        // ignore
      }
    }
    return res.json({ ok: true });
  });

  // =========================================================================
  // CALENDARI PERSONALI & CONDIVISI + APPUNTI & APPUNTAMENTI
  // =========================================================================
  app.get('/api/calendars', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    ensurePersonalCalendarForUser(me);
    const accessible = calendarsRegistry
      .filter((c) => userCanAccessCalendar(c, me.id))
      .map(hydrateCalendarForClient);
    return res.json({ ok: true, calendars: accessible });
  });

  app.post('/api/calendars', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const me = req.authUser!;
      const body = req.body || {};
      const name = String(body.name || '').trim().slice(0, 80);
      const rawColor = String(body.color || '#6366f1').trim();
      const color = ALLOWED_CAL_COLORS.has(rawColor) ? rawColor : '#6366f1';
      const isShared = Boolean(body.isShared);
      const rawMembers: unknown[] = Array.isArray(body.memberIds) ? body.memberIds : [];

      if (name.length < 2) {
        return res.status(400).json({
          ok: false,
          error: 'Inserisci un nome per il calendario (almeno 2 caratteri).',
        });
      }

      const validMemberIds = new Set<string>([me.id]);
      if (isShared) {
        for (const rawId of rawMembers) {
          const uid = String(rawId || '').trim();
          if (SAFE_USER_ID_RE.test(uid) && usersRegistry.some((u) => u.id === uid)) {
            validMemberIds.add(uid);
          }
        }
      }

      const newCal: ServerCalendarRecord = {
        id: `cal_${crypto.randomBytes(10).toString('hex')}`,
        name,
        color,
        ownerId: me.id,
        ownerName: me.name,
        isShared: isShared && validMemberIds.size > 1 ? true : isShared,
        isDefaultPersonal: false,
        memberIds: Array.from(validMemberIds),
        createdAt: new Date().toISOString(),
      };

      saveCalendarsRegistry([...calendarsRegistry, newCal]);
      const hydrated = hydrateCalendarForClient(newCal);

      // Notify invited members in real time
      for (const memberId of newCal.memberIds) {
        if (memberId !== me.id) {
          broadcastToUser(memberId, null, {
            type: 'calendar_updated',
            calendarId: newCal.id,
          });
          pushUserNotification(memberId, {
            category: 'calendar',
            title: `Calendario condiviso: ${newCal.name}`,
            body: `${me.name} ha condiviso con te il calendario "${newCal.name}". Ora puoi leggere e aggiungere appuntamenti e appunti.`,
            targetApp: 'calendar',
            meta: { calendarId: newCal.id },
          });
        }
      }

      return res.status(201).json({ ok: true, calendar: hydrated });
    } catch (err) {
      console.error('[CaricoStudio Calendar] Errore creazione calendario:', err);
      return res.status(500).json({ ok: false, error: 'Errore creazione calendario.' });
    }
  });

  app.patch('/api/calendars/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const calId = String(req.params.id || '').trim();
    if (!SAFE_CAL_ID_RE.test(calId)) {
      return res.status(400).json({ ok: false, error: 'ID calendario non valido.' });
    }
    const existing = calendarsRegistry.find((c) => c.id === calId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Calendario non trovato.' });
    }
    if (existing.ownerId !== me.id) {
      return res.status(403).json({
        ok: false,
        error: 'Solo il creatore può modificare le impostazioni o i membri del calendario.',
      });
    }

    const body = req.body || {};
    const nextName =
      typeof body.name === 'string' && body.name.trim().length >= 2
        ? body.name.trim().slice(0, 80)
        : existing.name;
    const rawColor = String(body.color || existing.color).trim();
    const nextColor = ALLOWED_CAL_COLORS.has(rawColor) ? rawColor : existing.color;
    const prevMembers = new Set(existing.memberIds);
    const nextMemberIds = new Set<string>([me.id]);

    if (!existing.isDefaultPersonal && Array.isArray(body.memberIds)) {
      for (const rawId of body.memberIds) {
        const uid = String(rawId || '').trim();
        if (SAFE_USER_ID_RE.test(uid) && usersRegistry.some((u) => u.id === uid)) {
          nextMemberIds.add(uid);
        }
      }
    } else if (!existing.isDefaultPersonal) {
      existing.memberIds.forEach((id) => nextMemberIds.add(id));
    }

    const updated: ServerCalendarRecord = {
      ...existing,
      name: nextName,
      color: nextColor,
      isShared: existing.isDefaultPersonal
        ? false
        : typeof body.isShared === 'boolean'
        ? body.isShared
        : nextMemberIds.size > 1 || existing.isShared,
      memberIds: Array.from(nextMemberIds),
    };

    saveCalendarsRegistry(
      calendarsRegistry.map((c) => (c.id === calId ? updated : c))
    );

    // Notify newly added, existing, and removed members to refresh their calendar views
    const allImpacted = new Set([...updated.memberIds, ...Array.from(prevMembers)]);
    for (const memberId of allImpacted) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: 'calendar_updated',
          calendarId: updated.id,
        });
        if (!prevMembers.has(memberId) && updated.memberIds.includes(memberId)) {
          pushUserNotification(memberId, {
            category: 'calendar',
            title: `Aggiunto al calendario "${updated.name}"`,
            body: `${me.name} ti ha aggiunto al calendario condiviso "${updated.name}".`,
            targetApp: 'calendar',
            meta: { calendarId: updated.id },
          });
        }
      }
    }

    return res.json({ ok: true, calendar: hydrateCalendarForClient(updated) });
  });

  app.delete('/api/calendars/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const calId = String(req.params.id || '').trim();
    if (!SAFE_CAL_ID_RE.test(calId)) {
      return res.status(400).json({ ok: false, error: 'ID calendario non valido.' });
    }
    const existing = calendarsRegistry.find((c) => c.id === calId);
    if (!existing) {
      return res.json({ ok: true });
    }
    if (existing.ownerId !== me.id) {
      return res.status(403).json({
        ok: false,
        error: 'Solo il creatore può eliminare questo calendario.',
      });
    }
    if (existing.isDefaultPersonal) {
      return res.status(400).json({
        ok: false,
        error: 'Il calendario personale principale non può essere eliminato.',
      });
    }

    saveCalendarsRegistry(calendarsRegistry.filter((c) => c.id !== calId));
    saveCalendarEventsRegistry(
      calendarEventsRegistry.filter((ev) => ev.calendarId !== calId)
    );
    for (const memberId of existing.memberIds) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: 'calendar_updated',
          calendarId: calId,
        });
      }
    }
    return res.json({ ok: true });
  });

  app.get('/api/calendar/events', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    ensurePersonalCalendarForUser(me);
    const accessibleIds = new Set(
      calendarsRegistry
        .filter((c) => userCanAccessCalendar(c, me.id))
        .map((c) => c.id)
    );
    const events = calendarEventsRegistry
      .filter((ev) => accessibleIds.has(ev.calendarId))
      .sort((a, b) =>
        `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`)
      );
    return res.json({ ok: true, events });
  });

  app.post('/api/calendar/events', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const me = req.authUser!;
      const body = req.body || {};
      const calendarId = String(body.calendarId || '').trim();
      const date = String(body.date || '').trim();
      const rawTime = String(body.time || '').trim();
      const rawEndTime = String(body.endTime || '').trim();
      const title = String(body.title || '').trim().slice(0, 140);
      const notes = String(body.notes || '').trim().slice(0, 2000);
      const commessaCode = String(body.commessaCode || '').trim().slice(0, 60);
      const allowedKinds = new Set(['appuntamento', 'appunto', 'promemoria', 'spedizione']);
      const kind = (
        allowedKinds.has(String(body.kind)) ? String(body.kind) : 'appuntamento'
      ) as ServerCalendarEventRecord['kind'];

      if (!SAFE_CAL_ID_RE.test(calendarId)) {
        return res.status(400).json({ ok: false, error: 'Calendario non valido.' });
      }
      const cal = calendarsRegistry.find((c) => c.id === calendarId);
      if (!cal || !userCanAccessCalendar(cal, me.id)) {
        return res.status(403).json({
          ok: false,
          error: 'Non hai i permessi per scrivere in questo calendario.',
        });
      }
      if (!SAFE_DATE_RE.test(date)) {
        return res.status(400).json({ ok: false, error: 'Data non valida (YYYY-MM-DD).' });
      }
      if (title.length < 1) {
        return res.status(400).json({ ok: false, error: 'Inserisci un titolo.' });
      }
      const time = rawTime && SAFE_TIME_RE.test(rawTime) ? rawTime : undefined;
      const endTime = rawEndTime && SAFE_TIME_RE.test(rawEndTime) ? rawEndTime : undefined;

      const nowIso = new Date().toISOString();
      const newEvt: ServerCalendarEventRecord = {
        id: `evt_${crypto.randomBytes(10).toString('hex')}`,
        calendarId: cal.id,
        date,
        time,
        endTime,
        title,
        notes: notes || undefined,
        kind,
        commessaCode: commessaCode || undefined,
        authorId: me.id,
        authorName: me.name,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      saveCalendarEventsRegistry([...calendarEventsRegistry, newEvt]);

      // Notify all other members of this calendar if it's shared
      const kindLabel =
        kind === 'appunto'
          ? 'Appunto'
          : kind === 'promemoria'
          ? 'Promemoria'
          : kind === 'spedizione'
          ? 'Spedizione'
          : 'Appuntamento';
      for (const memberId of cal.memberIds) {
        if (memberId !== me.id) {
          broadcastToUser(memberId, null, {
            type: 'calendar_updated',
            calendarId: cal.id,
            eventId: newEvt.id,
          });
          pushUserNotification(memberId, {
            category: 'calendar',
            title: `${kindLabel} su "${cal.name}": ${title}`,
            body: `${me.name} ha aggiunto "${title}" per il ${date.split('-').reverse().join('/')}${
              time ? ` alle ${time}` : ''
            }${notes ? ` — ${notes.slice(0, 100)}` : ''}`,
            targetApp: 'calendar',
            meta: {
              calendarId: cal.id,
              eventId: newEvt.id,
              eventDate: date,
              commessaCode: commessaCode || undefined,
            },
          });
        }
      }

      return res.status(201).json({ ok: true, event: newEvt });
    } catch (err) {
      console.error('[CaricoStudio Calendar] Errore salvataggio evento:', err);
      return res.status(500).json({ ok: false, error: 'Errore salvataggio evento.' });
    }
  });

  app.patch('/api/calendar/events/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const evtId = String(req.params.id || '').trim();
    if (!SAFE_EVT_ID_RE.test(evtId)) {
      return res.status(400).json({ ok: false, error: 'ID evento non valido.' });
    }
    const existing = calendarEventsRegistry.find((e) => e.id === evtId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Elemento non trovato.' });
    }
    const cal = calendarsRegistry.find((c) => c.id === existing.calendarId);
    if (!cal || !userCanAccessCalendar(cal, me.id)) {
      return res.status(403).json({ ok: false, error: 'Accesso negato.' });
    }

    const body = req.body || {};
    const nextDate =
      typeof body.date === 'string' && SAFE_DATE_RE.test(body.date.trim())
        ? body.date.trim()
        : existing.date;
    const rawTime = typeof body.time === 'string' ? body.time.trim() : existing.time || '';
    const rawEnd =
      typeof body.endTime === 'string' ? body.endTime.trim() : existing.endTime || '';
    const nextTitle =
      typeof body.title === 'string' && body.title.trim().length > 0
        ? body.title.trim().slice(0, 140)
        : existing.title;
    const nextNotes =
      typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : existing.notes;
    const nextCommessa =
      typeof body.commessaCode === 'string'
        ? body.commessaCode.trim().slice(0, 60)
        : existing.commessaCode;
    const allowedKinds = new Set(['appuntamento', 'appunto', 'promemoria', 'spedizione']);
    const nextKind = (
      typeof body.kind === 'string' && allowedKinds.has(body.kind)
        ? body.kind
        : existing.kind
    ) as ServerCalendarEventRecord['kind'];

    const updated: ServerCalendarEventRecord = {
      ...existing,
      date: nextDate,
      time: rawTime && SAFE_TIME_RE.test(rawTime) ? rawTime : undefined,
      endTime: rawEnd && SAFE_TIME_RE.test(rawEnd) ? rawEnd : undefined,
      title: nextTitle,
      notes: nextNotes || undefined,
      kind: nextKind,
      commessaCode: nextCommessa || undefined,
      updatedAt: new Date().toISOString(),
    };

    saveCalendarEventsRegistry(
      calendarEventsRegistry.map((e) => (e.id === evtId ? updated : e))
    );

    for (const memberId of cal.memberIds) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: 'calendar_updated',
          calendarId: cal.id,
          eventId: updated.id,
        });
      }
    }

    return res.json({ ok: true, event: updated });
  });

  app.delete('/api/calendar/events/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const evtId = String(req.params.id || '').trim();
    if (!SAFE_EVT_ID_RE.test(evtId)) {
      return res.status(400).json({ ok: false, error: 'ID evento non valido.' });
    }
    const existing = calendarEventsRegistry.find((e) => e.id === evtId);
    if (!existing) {
      return res.json({ ok: true });
    }
    const cal = calendarsRegistry.find((c) => c.id === existing.calendarId);
    if (!cal || !userCanAccessCalendar(cal, me.id)) {
      return res.status(403).json({ ok: false, error: 'Accesso negato.' });
    }
    saveCalendarEventsRegistry(calendarEventsRegistry.filter((e) => e.id !== evtId));
    for (const memberId of cal.memberIds) {
      if (memberId !== me.id) {
        broadcastToUser(memberId, null, {
          type: 'calendar_updated',
          calendarId: cal.id,
        });
      }
    }
    return res.json({ ok: true });
  });

  // =========================================================================
  // CENTRO NOTIFICHE SERVER (MESSAGGI/FILE TEAM, CALENDARI CONDIVISI, ECC.)
  // =========================================================================
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const items = notificationsRegistry
      .filter((n) => n.userId === me.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 120);
    return res.json({ ok: true, notifications: items });
  });

  app.post('/api/notifications/read', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const id = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
    const markAll = Boolean(req.body?.all);

    if (markAll) {
      saveNotificationsRegistry(
        notificationsRegistry.map((n) =>
          n.userId === me.id ? { ...n, read: true } : n
        )
      );
      return res.json({ ok: true });
    }

    if (!SAFE_NOTIF_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID notifica non valido.' });
    }
    saveNotificationsRegistry(
      notificationsRegistry.map((n) =>
        n.id === id && n.userId === me.id ? { ...n, read: true } : n
      )
    );
    return res.json({ ok: true });
  });

  app.delete('/api/notifications/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const me = req.authUser!;
    const id = String(req.params.id || '').trim();
    if (!SAFE_NOTIF_ID_RE.test(id)) {
      return res.status(400).json({ ok: false, error: 'ID notifica non valido.' });
    }
    saveNotificationsRegistry(
      notificationsRegistry.filter((n) => !(n.id === id && n.userId === me.id))
    );
    return res.json({ ok: true });
  });

  // =========================================================================
  // INTERFACCIA DATORE DI LAVORO / DIREZIONE (SOLO RUOLO 'employer')
  // =========================================================================
  app.get(
    '/api/employer/overview',
    requireAuth,
    requireEmployer,
    (_req: AuthenticatedRequest, res) => {
      try {
        const profiles: any[] = [];
        const allCommesse: any[] = [];
        const allMovements: any[] = [];

        for (const u of usersRegistry) {
          const pub = toPublicUser(u);
          const cache = getUserCache(u.id);
          const loads = Array.isArray(cache.loads) ? cache.loads : [];
          const movements = Array.isArray(cache.inventory?.movements)
            ? cache.inventory!.movements
            : [];
          const photos = Array.isArray(cache.photos) ? cache.photos : [];
          const files = Array.isArray(cache.filesState?.files)
            ? cache.filesState.files
            : [];

          let palletsCount = 0;
          let boxesCount = 0;
          let totalWeightKg = 0;

          for (const l of loads) {
            const pArr: any[] = Array.isArray(l?.pallets) ? l.pallets : [];
            const bArr: any[] = Array.isArray(l?.boxes) ? l.boxes : [];
            const iArr: any[] = Array.isArray(l?.items) ? l.items : [];
            palletsCount += pArr.length;
            boxesCount += bArr.length;

            let loadWeight = 0;
            for (const p of pArr) {
              if (p?.customWeightKg !== undefined && p?.customWeightKg !== null) {
                loadWeight += Number(p.customWeightKg) || 0;
              } else {
                loadWeight += Number(p?.tareKg) || 0;
                const pBoxes = bArr.filter((b) => b?.palletId === p?.id);
                const pBoxIds = new Set(pBoxes.map((b) => b.id));
                loadWeight += pBoxes.reduce((s, b) => s + (Number(b?.tareKg) || 0), 0);
                loadWeight += iArr
                  .filter(
                    (it) =>
                      it?.palletId === p?.id || (it?.boxId && pBoxIds.has(it.boxId))
                  )
                  .reduce(
                    (s, it) =>
                      s + (Number(it?.quantity) || 0) * (Number(it?.unitWeightKg) || 0),
                    0
                  );
              }
            }
            totalWeightKg += loadWeight;

            allCommesse.push({
              ownerId: pub.id,
              ownerName: pub.name,
              ownerCompany: pub.company || '',
              ownerRole: pub.role,
              id: l.id,
              code: l.code || 'COM',
              title: l.title || 'Commessa',
              client: l.client || '',
              destination: l.destination || '',
              carrier: l.carrier || '',
              departureDate: l.departureDate || '',
              status: l.status || 'in_preparazione',
              palletsCount: pArr.length,
              boxesCount: bArr.length,
              itemsCount: iArr.length,
              checkedItemsCount: iArr.filter((it) => Boolean(it?.checked)).length,
              weightKg: Math.round(loadWeight),
              loadedAt: l.loadedAt || null,
              shippedAt: l.shippedAt || l.handoverProof?.handoverAt || null,
              pallets: pArr,
              boxes: bArr,
              items: iArr,
            });
          }

          let carichiCount = 0;
          let scarichiCount = 0;
          for (const m of movements) {
            if (m?.type === 'carico') carichiCount++;
            else if (m?.type === 'scarico') scarichiCount++;
            allMovements.push({
              ...m,
              ownerId: pub.id,
              ownerName: pub.name,
              ownerCompany: pub.company || '',
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
              filesCount: files.length,
            },
          });
        }

        allMovements.sort((a, b) =>
          String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
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
            sharesCount: sharesRegistry.length,
          }
        );

        return res.json({
          ok: true,
          totals,
          profiles,
          allCommesse,
          allMovements,
        });
      } catch (err) {
        console.error('[CaricoStudio Employer] Errore overview:', err);
        return res.status(500).json({ ok: false, error: 'Errore caricamento panoramica.' });
      }
    }
  );

  // =========================================================================
  // METATRON SERVER OS — TELEMETRIA REALE, STORAGE, BACKUP, SESSIONI, ISO
  // =========================================================================
  app.get('/api/system/metrics', requireAuth, (_req: AuthenticatedRequest, res) => {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = Math.max(0, totalMem - freeMem);
      const procMem = process.memoryUsage();
      const disk = getHostDiskStats();

      const rawIfaces = os.networkInterfaces();
      const networkInterfaces: Array<{
        name: string;
        address: string;
        family: string;
        mac: string;
        internal: boolean;
        cidr: string | null;
      }> = [];
      for (const [ifaceName, addrs] of Object.entries(rawIfaces)) {
        if (!addrs) continue;
        for (const a of addrs) {
          if (a.family === 'IPv4' || a.family === 'IPv6') {
            networkInterfaces.push({
              name: ifaceName,
              address: a.address,
              family: a.family,
              mac: a.mac,
              internal: a.internal,
              cidr: a.cidr || null,
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
        timestamp: new Date().toISOString(),
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
          port: PORT,
        },
        cpu: {
          model: cpus[0]?.model || 'CPU Server',
          cores: cpus.length,
          speedMhz: cpus[0]?.speed || 0,
          usagePercent: latestCpuPercent,
          perCorePercent: latestCorePercents,
          loadAvg: os.loadavg().map((v) => Math.round(v * 100) / 100),
        },
        memory: {
          totalBytes: totalMem,
          usedBytes: usedMem,
          freeBytes: freeMem,
          usedPercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 1000) / 10 : 0,
          processRssBytes: procMem.rss,
          processHeapUsedBytes: procMem.heapUsed,
        },
        disk,
        networkInterfaces,
        services: [
          {
            id: 'http-core',
            name: 'METATRON HTTP / API Core',
            status: 'active',
            detail: `Porta ${PORT} · Node ${process.version}`,
          },
          {
            id: 'ws-sync',
            name: 'Motore Sincronizzazione WebSocket',
            status: 'active',
            detail: `${activeWsCount} client connessi in tempo reale`,
          },
          {
            id: 'storage-engine',
            name: 'Storage Persistente & Backup',
            status: 'active',
            detail: `${usersRegistry.length} profili · ${sharesRegistry.length} scambi team`,
          },
          {
            id: 'auth-vault',
            name: 'Servizio Autenticazione & Sessioni',
            status: 'active',
            detail: `${activeSessionsCount} sessioni attive autenticate`,
          },
          {
            id: 'calendar-hub',
            name: 'Hub Calendari & Centro Notifiche',
            status: 'active',
            detail: `${calendarsRegistry.length} calendari · ${calendarEventsRegistry.length} eventi`,
          },
        ],
        history: telemetryHistory,
      });
    } catch (err) {
      console.error('[METATRON OS] Errore lettura metriche:', err);
      return res.status(500).json({ ok: false, error: 'Errore lettura telemetria server.' });
    }
  });

  app.get('/api/system/storage', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      const isEmployer = req.authUser?.role === 'employer';
      const disk = getHostDiskStats();
      const usersStats = getDirectoryStats(USERS_DIR);
      const sharedStats = getDirectoryStats(SHARED_FILES_DIR);
      const backupsStats = getDirectoryStats(BACKUPS_DIR);
      const totalDataStats = getDirectoryStats(DATA_ROOT);

      let backups: Array<{ filename: string; sizeBytes: number; createdAt: string }> = [];
      if (isEmployer && fs.existsSync(BACKUPS_DIR)) {
        backups = fs
          .readdirSync(BACKUPS_DIR)
          .filter((name) => SAFE_BACKUP_FILENAME_RE.test(name))
          .map((filename) => {
            const full = path.join(BACKUPS_DIR, filename);
            const st = fs.statSync(full);
            return {
              filename,
              sizeBytes: st.size,
              createdAt: st.mtime.toISOString(),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      return res.json({
        ok: true,
        disk,
        volumes: [
          {
            id: 'users_vault',
            label: 'Archivi Utenti (Commesse, Magazzino, Foto, File)',
            bytes: usersStats.bytes,
            files: usersStats.files,
          },
          {
            id: 'team_shares',
            label: 'Scambio File & Foto Team',
            bytes: sharedStats.bytes,
            files: sharedStats.files,
          },
          {
            id: 'snapshots',
            label: 'Snapshot di Backup Server',
            bytes: backupsStats.bytes,
            files: backupsStats.files,
          },
          {
            id: 'total_data',
            label: 'Totale Directory Dati METATRON',
            bytes: totalDataStats.bytes,
            files: totalDataStats.files,
          },
        ],
        backups,
      });
    } catch (err) {
      console.error('[METATRON OS] Errore storage:', err);
      return res.status(500).json({ ok: false, error: 'Errore lettura volumi storage.' });
    }
  });

  app.post(
    '/api/system/backups',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      try {
        const me = req.authUser!;
        ensureDir(BACKUPS_DIR);

        const stamp = new Date()
          .toISOString()
          .replace(/\.\d{3}Z$/, '')
          .replace(/:/g, '-');
        const filename = `metatron-backup-${stamp}.json`;
        const resolved = path.resolve(BACKUPS_DIR, filename);
        if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
          return res.status(400).json({ ok: false, error: 'Percorso backup non valido.' });
        }

        // Snapshot completo sanitizzato (esclude passwordHash, token di sessione e accessCodeHash)
        const userWorkspaces = usersRegistry.map((u) => {
          const cache = getUserCache(u.id);
          return {
            user: toPublicUser(u),
            loadsCount: Array.isArray(cache.loads) ? cache.loads.length : 0,
            loads: cache.loads || [],
            inventory: cache.inventory || { items: [], movements: [], hiddenCommessaCodes: [] },
            photosIndex: cache.photos || [],
            filesIndex: cache.filesState || { folders: [], files: [] },
          };
        });

        const snapshot = {
          format: 'metatron-server-os-snapshot-v1',
          createdAt: new Date().toISOString(),
          createdBy: { id: me.id, name: me.name, role: me.role },
          serverNode: {
            nodeName: systemSettings.nodeName,
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
          },
          systemSettings,
          calendars: calendarsRegistry,
          calendarEvents: calendarEventsRegistry,
          sharesIndex: sharesRegistry,
          workspaces: userWorkspaces,
        };

        const rawJson = JSON.stringify(snapshot, null, 2);
        fs.writeFileSync(resolved, rawJson, 'utf-8');
        const st = fs.statSync(resolved);

        addSystemLog(
          'info',
          'Backup Engine',
          `Snapshot ${filename} creato da ${me.name} (${Math.round(st.size / 1024)} KB)`,
          true
        );

        return res.status(201).json({
          ok: true,
          backup: {
            filename,
            sizeBytes: st.size,
            createdAt: st.mtime.toISOString(),
          },
        });
      } catch (err) {
        console.error('[METATRON OS] Errore creazione backup:', err);
        addSystemLog('error', 'Backup Engine', 'Errore durante la creazione dello snapshot', true);
        return res.status(500).json({ ok: false, error: 'Impossibile creare lo snapshot.' });
      }
    }
  );

  app.get(
    '/api/system/backups/:filename',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const filename = String(req.params.filename || '').trim();
      if (!SAFE_BACKUP_FILENAME_RE.test(filename)) {
        return res.status(400).json({ ok: false, error: 'Nome file backup non valido.' });
      }
      const resolved = path.resolve(BACKUPS_DIR, filename);
      if (!resolved.startsWith(BACKUPS_DIR + path.sep) || !fs.existsSync(resolved)) {
        return res.status(404).json({ ok: false, error: 'Backup non trovato.' });
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.sendFile(resolved);
    }
  );

  app.delete(
    '/api/system/backups/:filename',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const filename = String(req.params.filename || '').trim();
      if (!SAFE_BACKUP_FILENAME_RE.test(filename)) {
        return res.status(400).json({ ok: false, error: 'Nome file backup non valido.' });
      }
      const resolved = path.resolve(BACKUPS_DIR, filename);
      if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
        return res.status(400).json({ ok: false, error: 'Percorso non consentito.' });
      }
      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
        addSystemLog(
          'warn',
          'Backup Engine',
          `Snapshot ${filename} eliminato da ${req.authUser!.name}`,
          true
        );
      }
      return res.json({ ok: true });
    }
  );

  app.get(
    '/api/system/sessions',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const now = Date.now();
      const currentHash = req.sessionTokenHash || '';
      const active = sessionsRegistry
        .filter((s) => new Date(s.expiresAt).getTime() > now)
        .map((s) => {
          const u = usersRegistry.find((usr) => usr.id === s.userId);
          return {
            sessionPrefix: s.tokenHash.slice(0, 12),
            userId: s.userId,
            userName: u?.name || 'Utente',
            userEmail: u?.email || '',
            userRole: (u?.role === 'employer' ? 'employer' : 'worker') as UserRole,
            createdAt: s.createdAt,
            expiresAt: s.expiresAt,
            isCurrent: s.tokenHash === currentHash,
            isOnlineWs: getOnlineCountForUser(s.userId) > 0,
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      return res.json({ ok: true, sessions: active });
    }
  );

  app.delete(
    '/api/system/sessions/:sessionPrefix',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const prefix = String(req.params.sessionPrefix || '').trim();
      if (!SAFE_SESSION_PREFIX_RE.test(prefix)) {
        return res.status(400).json({ ok: false, error: 'Identificativo sessione non valido.' });
      }
      if (req.sessionTokenHash && req.sessionTokenHash.startsWith(prefix)) {
        return res.status(400).json({
          ok: false,
          error: 'Non puoi revocare la tua sessione corrente da questa schermata.',
        });
      }
      const before = sessionsRegistry.length;
      sessionsRegistry = sessionsRegistry.filter((s) => !s.tokenHash.startsWith(prefix));
      if (sessionsRegistry.length !== before) {
        writeJsonFile(SESSIONS_FILE, sessionsRegistry);
        addSystemLog(
          'warn',
          'Auth Vault',
          `Sessione ${prefix}… revocata da ${req.authUser!.name}`,
          true
        );
      }
      return res.json({ ok: true });
    }
  );

  app.get('/api/system/logs', requireAuth, (req: AuthenticatedRequest, res) => {
    const isEmployer = req.authUser?.role === 'employer';
    const levelFilter = String(req.query.level || 'all').trim();
    const filtered = systemLogs.filter((entry) => {
      if (!isEmployer && entry.adminOnly) return false;
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      return true;
    });
    return res.json({ ok: true, logs: filtered.slice(0, 120) });
  });

  app.get('/api/system/settings', requireAuth, (_req: AuthenticatedRequest, res) => {
    return res.json({ ok: true, settings: systemSettings });
  });

  app.patch(
    '/api/system/settings',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const body = req.body || {};
      const nextNodeName =
        typeof body.nodeName === 'string' && body.nodeName.trim().length >= 2
          ? body.nodeName.trim().replace(/[^a-zA-Z0-9._ -]/g, '').slice(0, 48)
          : systemSettings.nodeName;
      const nextHostLabel =
        typeof body.hostnameLabel === 'string' && body.hostnameLabel.trim().length >= 2
          ? body.hostnameLabel.trim().replace(/[^a-zA-Z0-9.-]/g, '').slice(0, 64)
          : systemSettings.hostnameLabel;
      const nextTimezone =
        typeof body.timezone === 'string' && body.timezone.trim().length >= 3
          ? body.timezone.trim().replace(/[^a-zA-Z0-9/_+-]/g, '').slice(0, 48)
          : systemSettings.timezone;
      const nextKiosk =
        typeof body.kioskBootDefault === 'boolean'
          ? body.kioskBootDefault
          : systemSettings.kioskBootDefault;
      const nextAutoBackup =
        typeof body.autoBackupEnabled === 'boolean'
          ? body.autoBackupEnabled
          : systemSettings.autoBackupEnabled;
      const nextInterval =
        typeof body.autoBackupIntervalHours === 'number' &&
        Number.isFinite(body.autoBackupIntervalHours)
          ? Math.max(1, Math.min(168, Math.round(body.autoBackupIntervalHours)))
          : systemSettings.autoBackupIntervalHours;
      const nextBanner =
        typeof body.maintenanceBanner === 'string'
          ? body.maintenanceBanner.trim().slice(0, 180)
          : systemSettings.maintenanceBanner;

      systemSettings = {
        nodeName: nextNodeName || DEFAULT_SYSTEM_SETTINGS.nodeName,
        hostnameLabel: nextHostLabel || DEFAULT_SYSTEM_SETTINGS.hostnameLabel,
        timezone: nextTimezone || DEFAULT_SYSTEM_SETTINGS.timezone,
        kioskBootDefault: nextKiosk,
        autoBackupEnabled: nextAutoBackup,
        autoBackupIntervalHours: nextInterval,
        maintenanceBanner: nextBanner,
        updatedAt: new Date().toISOString(),
      };
      writeJsonFile(SYSTEM_SETTINGS_FILE, systemSettings);
      addSystemLog(
        'info',
        'System Config',
        `Configurazione nodo "${systemSettings.nodeName}" aggiornata da ${req.authUser!.name}`,
        true
      );
      return res.json({ ok: true, settings: systemSettings });
    }
  );

  // =========================================================================
  // SOFTWARE UPDATES ENGINE (GITHUB RELEASES + PRE-UPDATE BACKUP)
  // =========================================================================
  interface ServerUpdateAssetRecord {
    name: string;
    sizeBytes: number;
    downloadUrl: string;
    platform: 'windows' | 'macos' | 'linux' | 'other';
  }
  interface ServerUpdateConfigRecord {
    githubRepo: string;
    autoCheckEnabled: boolean;
    autoBackupBeforeUpdate: boolean;
    lastCheckedAt: string | null;
    lastKnownLatestVersion: string | null;
    lastKnownReleaseUrl: string | null;
    lastKnownReleaseNotes: string | null;
    lastKnownPublishedAt: string | null;
    lastKnownAssets: ServerUpdateAssetRecord[];
  }

  const DEFAULT_UPDATE_CONFIG: ServerUpdateConfigRecord = {
    githubRepo: BUNDLED_GITHUB_REPO,
    autoCheckEnabled: true,
    autoBackupBeforeUpdate: true,
    lastCheckedAt: null,
    lastKnownLatestVersion: null,
    lastKnownReleaseUrl: null,
    lastKnownReleaseNotes: null,
    lastKnownPublishedAt: null,
    lastKnownAssets: [],
  };

  let updateConfig: ServerUpdateConfigRecord = {
    ...DEFAULT_UPDATE_CONFIG,
    ...readJsonFile<Partial<ServerUpdateConfigRecord>>(UPDATE_CONFIG_FILE, {}),
  };
  if (!updateConfig.githubRepo && BUNDLED_GITHUB_REPO) {
    updateConfig.githubRepo = BUNDLED_GITHUB_REPO;
  }

  function buildUpdateStatusPayload() {
    const latest = updateConfig.lastKnownLatestVersion;
    const updateAvailable = Boolean(
      latest && compareSemverStrings(latest, APP_VERSION) > 0
    );
    return {
      currentVersion: APP_VERSION,
      isDesktopMode: process.env.METATRON_DESKTOP_MODE === '1',
      updateAvailable,
      config: updateConfig,
    };
  }

  app.get('/api/system/updates/status', requireAuth, (_req: AuthenticatedRequest, res) => {
    return res.json({ ok: true, status: buildUpdateStatusPayload() });
  });

  app.patch('/api/system/updates/config', requireAuth, (req: AuthenticatedRequest, res) => {
    if (hasAnyEmployer() && req.authUser?.role !== 'employer') {
      return res.status(403).json({
        ok: false,
        error: 'Solo un account Direzione può modificare la sorgente degli aggiornamenti.',
      });
    }
    const body = req.body || {};
    if (typeof body.githubRepo === 'string') {
      const cleaned = body.githubRepo
        .trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^\/+|\/+$/g, '');
      if (cleaned !== '' && !SAFE_GITHUB_REPO_RE.test(cleaned)) {
        return res.status(400).json({
          ok: false,
          error: 'Formato repository non valido. Usa il formato utente/nome-repo.',
        });
      }
      updateConfig.githubRepo = cleaned;
    }
    if (typeof body.autoCheckEnabled === 'boolean') {
      updateConfig.autoCheckEnabled = body.autoCheckEnabled;
    }
    if (typeof body.autoBackupBeforeUpdate === 'boolean') {
      updateConfig.autoBackupBeforeUpdate = body.autoBackupBeforeUpdate;
    }
    writeJsonFile(UPDATE_CONFIG_FILE, updateConfig);
    addSystemLog(
      'info',
      'Update Center',
      `Configurazione aggiornamenti salvata (${updateConfig.githubRepo || 'nessun repo'})`,
      false
    );
    return res.json({ ok: true, status: buildUpdateStatusPayload() });
  });

  app.post('/api/system/updates/check', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const canOverrideRepo = !hasAnyEmployer() || req.authUser?.role === 'employer';
      const requestedRepo =
        canOverrideRepo &&
        typeof req.body?.githubRepo === 'string' &&
        req.body.githubRepo.trim()
          ? req.body.githubRepo
              .trim()
              .replace(/^https?:\/\/github\.com\//i, '')
              .replace(/\.git$/i, '')
              .replace(/^\/+|\/+$/g, '')
          : updateConfig.githubRepo;

      if (!requestedRepo) {
        return res.status(400).json({
          ok: false,
          error:
            'Configura prima il repository GitHub (es. utente/nome-repo) per verificare gli aggiornamenti.',
        });
      }
      if (!SAFE_GITHUB_REPO_RE.test(requestedRepo)) {
        return res.status(400).json({
          ok: false,
          error: 'Formato repository GitHub non valido.',
        });
      }

      const [owner, repo] = requestedRepo.split('/');
      const ghUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;
      const ghToken = String(process.env.METATRON_GITHUB_TOKEN || '').trim();
      const ghHeaders: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'METATRON-CaricoStudio-Updater',
      };
      if (ghToken) {
        ghHeaders.Authorization = `Bearer ${ghToken}`;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let ghResp: globalThis.Response;
      try {
        ghResp = await fetch(ghUrl, {
          headers: ghHeaders,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (ghResp.status === 404) {
        updateConfig.lastCheckedAt = new Date().toISOString();
        writeJsonFile(UPDATE_CONFIG_FILE, updateConfig);
        return res.status(404).json({
          ok: false,
          error:
            'Nessuna Release leggibile trovata: se il repository GitHub è Privato, pubblica gli installer su un secondo repository Pubblico vuoto (es. utente/metatron-releases) lasciando privato il codice, oppure imposta la variabile ambiente METATRON_GITHUB_TOKEN.',
        });
      }
      if (!ghResp.ok) {
        return res.status(502).json({
          ok: false,
          error: `GitHub ha risposto con errore HTTP ${ghResp.status}. Riprova più tardi.`,
        });
      }

      const release = (await ghResp.json()) as {
        tag_name?: string;
        name?: string;
        body?: string;
        html_url?: string;
        published_at?: string;
        assets?: Array<{
          name?: string;
          size?: number;
          browser_download_url?: string;
        }>;
      };

      const rawTag = String(release.tag_name || release.name || '').trim();
      const latestVersion = rawTag.replace(/^v/i, '') || APP_VERSION;
      const htmlUrl =
        typeof release.html_url === 'string' &&
        release.html_url.startsWith('https://github.com/')
          ? release.html_url
          : null;

      const safeAssets: ServerUpdateAssetRecord[] = Array.isArray(release.assets)
        ? release.assets
            .filter(
              (a) =>
                typeof a?.name === 'string' &&
                typeof a?.browser_download_url === 'string' &&
                (a.browser_download_url.startsWith('https://github.com/') ||
                  a.browser_download_url.startsWith('https://objects.githubusercontent.com/')) &&
                !/\.yml$|\.blockmap$/i.test(a.name)
            )
            .slice(0, 12)
            .map((a) => {
              const name = String(a.name);
              const platform: ServerUpdateAssetRecord['platform'] = /\.exe$/i.test(name)
                ? 'windows'
                : /\.dmg$/i.test(name)
                ? 'macos'
                : /\.AppImage$|\.deb$/i.test(name)
                ? 'linux'
                : 'other';
              return {
                name,
                sizeBytes: Number(a.size) || 0,
                downloadUrl: String(a.browser_download_url),
                platform,
              };
            })
        : [];

      updateConfig = {
        ...updateConfig,
        githubRepo: requestedRepo,
        lastCheckedAt: new Date().toISOString(),
        lastKnownLatestVersion: latestVersion,
        lastKnownReleaseUrl: htmlUrl,
        lastKnownReleaseNotes:
          typeof release.body === 'string' ? release.body.slice(0, 4000) : null,
        lastKnownPublishedAt:
          typeof release.published_at === 'string' ? release.published_at : null,
        lastKnownAssets: safeAssets,
      };
      writeJsonFile(UPDATE_CONFIG_FILE, updateConfig);

      const statusPayload = buildUpdateStatusPayload();
      addSystemLog(
        'info',
        'Update Center',
        statusPayload.updateAvailable
          ? `Trovato aggiornamento METATRON v${latestVersion} (attuale v${APP_VERSION})`
          : `Controllo completato: sistema aggiornato (v${APP_VERSION})`,
        false
      );

      return res.json({ ok: true, status: statusPayload });
    } catch (err) {
      console.error('[METATRON Updater] Errore controllo aggiornamenti:', err);
      return res.status(502).json({
        ok: false,
        error: 'Impossibile contattare GitHub per verificare gli aggiornamenti.',
      });
    }
  });

  app.post('/api/system/updates/pre-backup', requireAuth, (req: AuthenticatedRequest, res) => {
    try {
      ensureDir(BACKUPS_DIR);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `metatron-backup-${stamp}.json`;
      const resolved = path.resolve(BACKUPS_DIR, filename);
      if (!resolved.startsWith(BACKUPS_DIR + path.sep)) {
        return res.status(400).json({ ok: false, error: 'Percorso backup non valido.' });
      }
      const me = req.authUser!;
      const userWorkspaces = usersRegistry.map((u) => {
        const cache = getUserCache(u.id);
        return {
          user: toPublicUser(u),
          loads: cache.loads,
          inventory: cache.inventory,
          photosIndex: cache.photos,
          filesState: cache.filesState,
        };
      });

      const snapshot = {
        format: 'metatron-server-os-snapshot-v1',
        reason: 'pre-update-automatic-backup',
        appVersion: APP_VERSION,
        createdAt: new Date().toISOString(),
        createdBy: { id: me.id, name: me.name, role: me.role },
        serverNode: {
          nodeName: systemSettings.nodeName,
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
        },
        systemSettings,
        calendars: calendarsRegistry,
        calendarEvents: calendarEventsRegistry,
        sharesIndex: sharesRegistry,
        workspaces: userWorkspaces,
      };

      fs.writeFileSync(resolved, JSON.stringify(snapshot, null, 2), 'utf-8');
      const st = fs.statSync(resolved);
      addSystemLog(
        'info',
        'Update Center',
        `Backup pre-aggiornamento salvato: ${filename} (${Math.round(st.size / 1024)} KB)`,
        false
      );
      return res.status(201).json({
        ok: true,
        backup: {
          filename,
          sizeBytes: st.size,
          createdAt: st.mtime.toISOString(),
        },
      });
    } catch (err) {
      console.error('[METATRON Updater] Errore pre-backup:', err);
      return res.status(500).json({
        ok: false,
        error: 'Impossibile creare il backup pre-aggiornamento.',
      });
    }
  });

  app.get('/api/system/deploy-artifacts', requireAuth, (_req: AuthenticatedRequest, res) => {
    const items = Object.entries(ALLOWED_DEPLOY_ARTIFACTS).map(([key, meta]) => {
      const baseDir = DEPLOY_ARTIFACT_BASE_DIRS[meta.base];
      const full = path.resolve(baseDir, meta.fileName);
      const exists =
        full.startsWith(baseDir + path.sep) && fs.existsSync(full);
      const sizeBytes = exists ? fs.statSync(full).size : 0;
      return {
        key,
        fileName: meta.fileName,
        relativePath: `${DEPLOY_ARTIFACT_PATH_PREFIX[meta.base]}/${meta.fileName}`,
        title: meta.title,
        description: meta.description,
        category: meta.category,
        available: exists,
        sizeBytes,
      };
    });
    return res.json({ ok: true, artifacts: items });
  });

  app.get('/api/system/deploy-artifacts/:key', requireAuth, (req: AuthenticatedRequest, res) => {
    const key = String(req.params.key || '').trim();
    const meta = ALLOWED_DEPLOY_ARTIFACTS[key];
    if (!meta) {
      return res.status(404).json({ ok: false, error: 'Pacchetto installer non trovato.' });
    }
    const baseDir = DEPLOY_ARTIFACT_BASE_DIRS[meta.base];
    const resolved = path.resolve(baseDir, meta.fileName);
    if (!resolved.startsWith(baseDir + path.sep) || !fs.existsSync(resolved)) {
      return res.status(404).json({ ok: false, error: 'File installer non presente.' });
    }

    const download = req.query.download === '1';
    if (download) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${meta.fileName}"`);
      if (meta.fileName.toLowerCase().endsWith('.bat')) {
        const crlf = fs
          .readFileSync(resolved, 'utf-8')
          .replace(/\r?\n/g, '\r\n');
        return res.send(crlf);
      }
      return res.sendFile(resolved);
    }

    const content = fs.readFileSync(resolved, 'utf-8');
    return res.json({
      ok: true,
      key,
      fileName: meta.fileName,
      relativePath: `${DEPLOY_ARTIFACT_PATH_PREFIX[meta.base]}/${meta.fileName}`,
      title: meta.title,
      content,
    });
  });

  // Esporta pacchetto ZIP completo pronto alla compilazione Desktop (.exe / .dmg / .AppImage)
  // Elenco chiuso di sorgenti: ESCLUDE sempre data/, .env, node_modules/, dist/, .git/
  app.get('/api/system/desktop-project-zip', requireAuth, (_req: AuthenticatedRequest, res) => {
    try {
      const projectRoot = path.resolve(process.cwd());
      const zipEntries: Record<string, Uint8Array> = {};
      const zipPrefix = 'METATRON-Desktop-Builder';

      const allowedRootFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'index.html',
        'metadata.json',
        'server.ts',
        '.env.example',
        '.gitignore',
      ];

      const allowedDirs = [
        'src',
        'public',
        'scripts',
        'desktop-app',
        'os-installer',
        path.join('.github', 'workflows'),
      ];

      const skippedFileNames = new Set(['CaricoStudio_Desktop_Windows.html']);

      const addSafeFile = (absPath: string, zipRelPath: string) => {
        const resolved = path.resolve(absPath);
        if (!resolved.startsWith(projectRoot + path.sep)) return;
        let stat: fs.Stats;
        try {
          stat = fs.lstatSync(resolved);
        } catch {
          return;
        }
        if (stat.isSymbolicLink() || !stat.isFile()) return;
        const baseName = path.basename(resolved);
        if (skippedFileNames.has(baseName)) return;

        if (baseName.toLowerCase().endsWith('.bat')) {
          const crlfText = fs
            .readFileSync(resolved, 'utf-8')
            .replace(/\r?\n/g, '\r\n');
          zipEntries[`${zipPrefix}/${zipRelPath}`] = Buffer.from(crlfText, 'utf-8');
        } else {
          zipEntries[`${zipPrefix}/${zipRelPath}`] = new Uint8Array(
            fs.readFileSync(resolved)
          );
        }
      };

      const walkAllowedDir = (relDir: string) => {
        const absDir = path.resolve(projectRoot, relDir);
        if (!absDir.startsWith(projectRoot + path.sep) || !fs.existsSync(absDir)) return;
        const entries = fs.readdirSync(absDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isSymbolicLink()) continue;
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const childRel = path.posix.join(relDir.replace(/\\/g, '/'), entry.name);
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

      // Copia anche CREA-SOFTWARE-WINDOWS.bat direttamente nella root dello ZIP per doppio clic immediato
      const winBatAbs = path.join(DESKTOP_APP_DIR, 'CREA-SOFTWARE-WINDOWS.bat');
      if (fs.existsSync(winBatAbs)) {
        addSafeFile(winBatAbs, 'CREA-SOFTWARE-WINDOWS.bat');
      }

      const zipped = zipSync(zipEntries, { level: 6 });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="METATRON-Desktop-Builder.zip"'
      );
      res.setHeader('Cache-Control', 'no-store');
      return res.send(Buffer.from(zipped));
    } catch (err) {
      console.error('[METATRON Desktop ZIP] Errore generazione pacchetto:', err);
      return res.status(500).json({
        ok: false,
        error: 'Errore durante la creazione del pacchetto ZIP.',
      });
    }
  });

  app.get(
    '/api/employer/users/:userId/details',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const targetUserId = String(req.params.userId || '').trim();
      if (!SAFE_USER_ID_RE.test(targetUserId)) {
        return res.status(400).json({ ok: false, error: 'ID utente non valido.' });
      }
      const stored = usersRegistry.find((u) => u.id === targetUserId);
      if (!stored) {
        return res.status(404).json({ ok: false, error: 'Profilo utente non trovato.' });
      }
      const cache = getUserCache(targetUserId);
      return res.json({
        ok: true,
        profile: {
          ...toPublicUser(stored),
          isOnline: getOnlineCountForUser(targetUserId) > 0,
        },
        loads: cache.loads,
        inventory: cache.inventory || { items: [], movements: [], hiddenCommessaCodes: [] },
        photos: cache.photos,
        filesState: cache.filesState,
      });
    }
  );

  app.get(
    '/api/employer/users/:userId/photos/:photoId/file',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const targetUserId = String(req.params.userId || '').trim();
      const photoId = String(req.params.photoId || '').trim();
      if (!SAFE_USER_ID_RE.test(targetUserId) || !SAFE_PHOTO_ID_RE.test(photoId)) {
        return res.status(400).send('Parametri non validi');
      }
      const cache = getUserCache(targetUserId);
      const meta = cache.photos.find((p) => p.id === photoId);
      if (!meta) return res.status(404).send('Foto non trovata');
      const paths = getUserPaths(targetUserId);
      const safeExt =
        String(meta.fileExt || 'jpg')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 10) || 'jpg';
      const target = assertSafeChildPath(
        paths.photosDir,
        path.join(paths.photosDir, `${photoId}.${safeExt}`)
      );
      if (!fs.existsSync(target)) return res.status(404).send('Foto mancante');
      const headers = getSafeDownloadHeaders(meta.mimeType || 'image/jpeg', `${photoId}.${safeExt}`);
      res.setHeader('Content-Type', headers.contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.sendFile(target);
    }
  );

  app.get(
    '/api/employer/users/:userId/files/:fileId/download',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const targetUserId = String(req.params.userId || '').trim();
      const fileId = String(req.params.fileId || '').trim();
      if (!SAFE_USER_ID_RE.test(targetUserId) || !SAFE_FILE_ID_RE.test(fileId)) {
        return res.status(400).send('Parametri non validi');
      }
      const cache = getUserCache(targetUserId);
      const meta = cache.filesState.files.find((f: any) => f.id === fileId);
      if (!meta) return res.status(404).send('File non trovato');
      const paths = getUserPaths(targetUserId);
      const safeExt =
        String(meta.extension || 'bin')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 10) || 'bin';
      const target = assertSafeChildPath(
        paths.filesDir,
        path.join(paths.filesDir, `${fileId}.${safeExt}`)
      );
      if (!fs.existsSync(target)) return res.status(404).send('File mancante');
      const headers = getSafeDownloadHeaders(meta.mimeType || 'application/octet-stream', meta.name || fileId);
      res.setHeader('Content-Type', headers.contentType);
      res.setHeader('Content-Disposition', headers.disposition);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.sendFile(target);
    }
  );

  app.patch(
    '/api/employer/users/:userId/role',
    requireAuth,
    requireEmployer,
    (req: AuthenticatedRequest, res) => {
      const targetUserId = String(req.params.userId || '').trim();
      const nextRole: UserRole = req.body?.role === 'employer' ? 'employer' : 'worker';
      if (!SAFE_USER_ID_RE.test(targetUserId)) {
        return res.status(400).json({ ok: false, error: 'ID utente non valido.' });
      }
      const target = usersRegistry.find((u) => u.id === targetUserId);
      if (!target) {
        return res.status(404).json({ ok: false, error: 'Utente non trovato.' });
      }
      if (target.role === 'employer' && nextRole !== 'employer') {
        const employerCount = usersRegistry.filter((u) => u.role === 'employer').length;
        if (employerCount <= 1) {
          return res.status(400).json({
            ok: false,
            error: 'Deve rimanere almeno un account Datore di Lavoro attivo.',
          });
        }
      }
      usersRegistry = usersRegistry.map((u) =>
        u.id === targetUserId ? { ...u, role: nextRole } : u
      );
      writeJsonFile(USERS_FILE, usersRegistry);
      const updated = usersRegistry.find((u) => u.id === targetUserId)!;
      return res.json({ ok: true, user: toPublicUser(updated) });
    }
  );

  // =========================================================================
  // DIRECT SELF-CONTAINED PDF ENDPOINT (decodes ?d= from shared customer QR)
  // =========================================================================
  function decodeLoadFromQuery(dString: string): any {
    if (!dString || typeof dString !== 'string') return null;
    try {
      const buf = Buffer.from(dString, 'base64url');
      let decompressed: Buffer;
      try {
        decompressed = zlib.inflateRawSync(buf);
      } catch {
        decompressed = zlib.inflateSync(buf);
      }

      const parsed = JSON.parse(decompressed.toString('utf-8'));
      if (!parsed) return null;

      const items = (parsed.i || parsed.items || []).map((it: any) => ({
        id: it.id || 'it_' + Math.random().toString(36).substring(2, 7),
        sku: it.s || it.sku || '—',
        name: it.n || it.name || 'Articolo',
        quantity: it.q !== undefined ? Number(it.q) : Number(it.quantity || 1),
        unitWeightKg: it.w !== undefined ? Number(it.w) : Number(it.unitWeightKg || 0),
        palletId: it.pid || it.palletId || null,
        boxId: it.bid || it.boxId || null,
      }));

      const pallets = (parsed.p || parsed.pallets || []).map((p: any) => ({
        id: p.id || 'p_' + Math.random().toString(36).substring(2, 7),
        code: p.c || p.code || 'BANCALE',
        label: p.l || p.label || 'Bancale',
        type: p.t || p.type || 'EUR_EPAL_1',
      }));

      const boxes = (parsed.b || parsed.boxes || []).map((b: any) => ({
        id: b.id || 'b_' + Math.random().toString(36).substring(2, 7),
        code: b.c || b.code || 'SCATOLA',
        label: b.l || b.label || 'Scatola',
        palletId: b.pid || b.palletId || null,
      }));

      return {
        code: (parsed.c || parsed.code || 'CARICO').trim(),
        title: parsed.t || parsed.title || 'Nuova Commessa Spedizione',
        client: parsed.cl || parsed.client || '—',
        destination: parsed.d || parsed.destination || '—',
        carrier: parsed.cr || parsed.carrier || '—',
        departureDate: parsed.dt || parsed.departureDate || new Date().toISOString().slice(0, 10),
        pallets,
        boxes,
        items,
      };
    } catch {
      return null;
    }
  }

  const handleDirectPdfDownload = (req: express.Request, res: express.Response) => {
    const code = req.params.code;
    const queryD = (req.query.d || req.query.data) as string | undefined;
    let load: any = null;

    if (queryD) {
      load = decodeLoadFromQuery(queryD);
    }

    if (!load) {
      // Only allow looking up stored loads if the request carries a valid Bearer token
      const resolved = resolveSessionFromBearer(extractBearerToken(req));
      if (resolved) {
        const cache = getUserCache(resolved.user.id);
        const targetLower = decodeURIComponent(code || '').trim().toLowerCase();
        load = cache.loads.find(
          (l: any) =>
            l &&
            (String(l.code || '').trim().toLowerCase() === targetLower ||
              String(l.id || '').trim().toLowerCase() === targetLower)
        );
      }
    }

    if (!load) {
      return res.status(404).send('Distinta PDF non trovata o link incompleto.');
    }

    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `Distinta Materiali Commessa ${load.code}`,
          Author: 'CaricoStudio Logistics',
        },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="Distinta_${encodeURIComponent(load.code)}.pdf"`
      );
      res.setHeader('Cache-Control', 'no-cache');

      doc.pipe(res);

      doc.rect(36, 36, 523, 50).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold').text('CARICOSTUDIO', 50, 48);
      doc
        .fontSize(9)
        .font('Helvetica')
        .text('DISTINTA UFFICIALE DI SPEDIZIONE & PACKING LIST MATERIALE', 50, 70);

      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(load.code, 350, 48, { width: 195, align: 'right' });
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Data: ${load.departureDate || new Date().toISOString().slice(0, 10)}`, 350, 70, {
          width: 195,
          align: 'right',
        });

      doc
        .roundedRect(36, 96, 523, 65, 4)
        .lineWidth(1)
        .strokeColor('#cbd5e1')
        .fillColor('#f8fafc')
        .fillAndStroke();
      doc
        .fillColor('#0f172a')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(load.title || 'Nuova Commessa Spedizione', 48, 106);

      doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Cliente: ', 48, 122);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(load.client || '—', 95, 122);

      doc.font('Helvetica').fillColor('#64748b').text('Destinazione: ', 48, 138);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(load.destination || '—', 115, 138);

      doc.font('Helvetica').fillColor('#64748b').text('Vettore: ', 300, 122);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(load.carrier || '—', 350, 122);

      const totalPallets = load.pallets?.length || 0;
      const totalBoxes = load.boxes?.length || 0;
      const totalItems = load.items?.length || 0;
      const anyPalletCustomWeight = (load.pallets || []).some(
        (p: any) => typeof p.customWeightKg === 'number' && p.customWeightKg > 0
      );
      const palletsCustomTotal = (load.pallets || []).reduce(
        (acc: number, p: any) => acc + (Number(p.customWeightKg) || 0),
        0
      );
      const itemsNetTotal = (load.items || []).reduce(
        (acc: number, it: any) =>
          acc + Number(it.quantity || 1) * Number(it.unitWeightKg || 0),
        0
      );
      const totalWeightKg = anyPalletCustomWeight ? palletsCustomTotal : itemsNetTotal;

      const palletStr = totalPallets === 1 ? '1 bancale' : `${totalPallets} bancali`;
      const boxStr = totalBoxes === 1 ? '1 scatola' : `${totalBoxes} scatole`;

      doc.font('Helvetica').fillColor('#64748b').text('Bancali / Scatole: ', 300, 138);
      doc
        .font('Helvetica-Bold')
        .fillColor('#0f172a')
        .text(`${palletStr}, ${boxStr}`, 385, 138);

      doc.font('Helvetica').fillColor('#64748b').text('Peso Totale: ', 300, 150);
      doc
        .font('Helvetica-Bold')
        .fillColor('#e11d48')
        .text(`${totalWeightKg.toFixed(1)} kg`, 365, 150);

      let currentY = 175;
      doc
        .fillColor('#0f172a')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`DETTAGLIO MATERIALE E CHECK-LIST (${totalItems} articoli):`, 36, currentY);

      currentY += 15;
      doc.rect(36, currentY, 523, 20).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
      doc.text('#', 42, currentY + 6);
      doc.text('Cod. Articolo', 62, currentY + 6);
      doc.text('Descrizione Materiale', 142, currentY + 6);
      doc.text('Q.tà', 345, currentY + 6);
      doc.text('Peso Tot.', 385, currentY + 6);
      doc.text('Collocazione', 440, currentY + 6);
      doc.text('Spunta', 524, currentY + 6);
      currentY += 20;

      const palletMap = new Map((load.pallets || []).map((p: any) => [p.id, p]));
      const boxMap = new Map((load.boxes || []).map((b: any) => [b.id, b]));

      if (!load.items || load.items.length === 0) {
        doc
          .rect(36, currentY, 523, 24)
          .fillColor('#ffffff')
          .strokeColor('#e2e8f0')
          .fillAndStroke();
        doc
          .fillColor('#64748b')
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text('Nessun articolo registrato nella commessa.', 50, currentY + 8);
        currentY += 24;
      } else {
        load.items.forEach((item: any, idx: number) => {
          if (currentY > 730) {
            doc.addPage();
            currentY = 40;
            doc.rect(36, currentY, 523, 20).fill('#1e293b');
            doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
            doc.text('#', 42, currentY + 6);
            doc.text('Cod. Articolo', 62, currentY + 6);
            doc.text('Descrizione Materiale', 142, currentY + 6);
            doc.text('Q.tà', 345, currentY + 6);
            doc.text('Peso Tot.', 385, currentY + 6);
            doc.text('Collocazione', 440, currentY + 6);
            doc.text('Spunta', 524, currentY + 6);
            currentY += 20;
          }

          let colloDesc = 'Non assegnato';
          if (item.boxId) {
            const bx: any = boxMap.get(item.boxId);
            const pal: any = bx?.palletId ? palletMap.get(bx.palletId) : null;
            colloDesc = `${bx?.code || 'Scatola'} (${pal?.code || '—'})`;
          } else if (item.palletId) {
            const pal: any = palletMap.get(item.palletId);
            colloDesc = `Fuori Scatola ${pal?.code || 'Bancale'}`;
          }

          const isEven = idx % 2 === 0;
          doc
            .rect(36, currentY, 523, 22)
            .fillColor(isEven ? '#ffffff' : '#f8fafc')
            .strokeColor('#e2e8f0')
            .fillAndStroke();

          doc
            .fillColor('#0f172a')
            .fontSize(8)
            .font('Helvetica-Bold')
            .text(String(idx + 1), 42, currentY + 6);
          doc
            .font('Helvetica-Bold')
            .text(item.sku || '—', 62, currentY + 6, { width: 75, ellipsis: true });
          doc
            .font('Helvetica')
            .text(item.name || 'Articolo', 142, currentY + 6, { width: 195, ellipsis: true });
          doc.font('Helvetica-Bold').text(`${item.quantity || 1} pz`, 345, currentY + 6);
          doc
            .font('Helvetica')
            .text(
              `${((item.quantity || 1) * (item.unitWeightKg || 0)).toFixed(1)} kg`,
              385,
              currentY + 6
            );
          doc
            .font('Helvetica')
            .text(colloDesc, 440, currentY + 6, { width: 78, ellipsis: true });
          doc.font('Helvetica-Bold').text('[   ]', 528, currentY + 6);

          currentY += 22;
        });
      }

      if (currentY > 690) {
        doc.addPage();
        currentY = 40;
      } else {
        currentY += 15;
      }

      doc
        .fillColor('#0f172a')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('CONVALIDA E FIRME DI RICEZIONE MERCI:', 36, currentY);
      currentY += 10;

      const sigWidth = 168;
      const sigHeight = 44;

      doc
        .rect(36, currentY, sigWidth, sigHeight)
        .fillColor('#f8fafc')
        .strokeColor('#cbd5e1')
        .fillAndStroke();
      doc
        .fillColor('#64748b')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('1. PREPARATORE MAGAZZINO', 42, currentY + 6);
      doc
        .fillColor('#334155')
        .fontSize(7.5)
        .font('Helvetica')
        .text('Firma Operatore:', 42, currentY + 20);
      doc
        .moveTo(42, currentY + 36)
        .lineTo(36 + sigWidth - 10, currentY + 36)
        .lineWidth(0.75)
        .strokeColor('#94a3b8')
        .stroke();

      doc
        .rect(212, currentY, sigWidth, sigHeight)
        .fillColor('#f8fafc')
        .strokeColor('#cbd5e1')
        .fillAndStroke();
      doc
        .fillColor('#64748b')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('2. RESPONSABILE SPEDIZIONI', 218, currentY + 6);
      doc
        .fillColor('#334155')
        .fontSize(7.5)
        .font('Helvetica')
        .text('Firma Logistica:', 218, currentY + 20);
      doc
        .moveTo(218, currentY + 36)
        .lineTo(212 + sigWidth - 10, currentY + 36)
        .lineWidth(0.75)
        .strokeColor('#94a3b8')
        .stroke();

      doc
        .rect(388, currentY, sigWidth, sigHeight)
        .fillColor('#f8fafc')
        .strokeColor('#cbd5e1')
        .fillAndStroke();
      doc
        .fillColor('#64748b')
        .fontSize(7)
        .font('Helvetica-Bold')
        .text('3. RICEVUTA CLIENTE / TRASPORTATORE', 394, currentY + 6);
      doc
        .fillColor('#334155')
        .fontSize(7.5)
        .font('Helvetica')
        .text('Firma per Ricevuta:', 394, currentY + 20);
      doc
        .moveTo(394, currentY + 36)
        .lineTo(388 + sigWidth - 10, currentY + 36)
        .lineWidth(0.75)
        .strokeColor('#94a3b8')
        .stroke();

      doc.end();
    } catch (err: any) {
      console.error('Error generating direct PDF:', err);
      res.status(500).send('Errore durante la generazione del documento PDF.');
    }
  };

  app.get('/pdf/:code', handleDirectPdfDownload);
  app.get('/api/pdf/:code', handleDirectPdfDownload);

  // AI-Powered PDF & Logistics Text Translator endpoint (Authenticated)
  app.post('/api/translate-pdf', requireAuth, async (req, res) => {
    try {
      const {
        text,
        targetLanguage = 'it',
        base64Data,
        mimeType = 'application/pdf',
        fileName = 'document.pdf',
      } = req.body;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY non configurata sul server.',
        });
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const languageNames: Record<string, string> = {
        it: 'Italiano',
        en: 'Inglese (English)',
        de: 'Tedesco (Deutsch)',
        fr: 'Francese (Français)',
        es: 'Spagnolo (Español)',
        pl: 'Polacco (Polski)',
        ro: 'Rumeno (Română)',
        pt: 'Portoghese (Português)',
        zh: 'Cinese (中文)',
        ar: 'Arabo (العربية)',
      };

      const langLabel = languageNames[targetLanguage] || targetLanguage;

      const prompt = `Sei un traduttore professionista esperto di documenti di trasporto, logistica industriale, bolle di carico, DDT, packing list e schede tecniche internazionali.
Traduci accuratamente in ${langLabel} il seguente documento o testo PDF di logistica.
Mantieni intatti e fedeli i formati di dati: codici articolo, SKU, misure (cm, mm, m), pesi (kg, t), quantitativi, codici doganali (HS code) e nomi propri.
Formatta la risposta in markdown ben strutturato con titoli, tabelle e sezioni corrispondenti al documento originale.`;

      const parts: any[] = [];
      if (base64Data) {
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
        parts.push({
          text: `${prompt}\n\nTraduci l'intero contenuto di questo documento allegato (${fileName}) in ${langLabel}. Riassumi anche in una breve sezione iniziale: Mittente, Destinatario, Peso totale, Numero colli/bancali (se identificabili).`,
        });
      } else if (text) {
        parts.push({
          text: `${prompt}\n\nTesto da tradurre:\n${text}`,
        });
      } else {
        return res.status(400).json({ error: 'Nessun testo o documento PDF fornito.' });
      }

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: { parts },
        });
      } catch {
        response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: { parts },
        });
      }

      return res.json({
        success: true,
        translatedContent: response.text || '',
        targetLanguage: langLabel,
      });
    } catch (err: any) {
      console.error('Translation error:', err);
      return res.status(500).json({
        error: err.message || 'Errore durante la traduzione del documento PDF.',
      });
    }
  });

  // AI-Powered Load / Shipment Documents Translation endpoint (Authenticated)
  app.post('/api/translate-load-ai', requireAuth, async (req, res) => {
    try {
      const { load, targetLanguage = 'en' } = req.body;
      if (!load) {
        return res.status(400).json({ error: 'Nessun carico da tradurre fornito.' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          error: 'GEMINI_API_KEY non configurata',
          fallbackNeeded: true,
        });
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const languageNames: Record<string, string> = {
        en: 'English (customs, freight and logistics international terminology)',
        de: 'German (Deutsch - Fachbegriffe Logistik & Spedition)',
        fr: 'French (Français - transport et logistique internationale)',
        es: 'Spanish (Español - transporte y logística)',
      };

      const langTarget = languageNames[targetLanguage] || 'English';

      const toTranslate = {
        title: load.title || '',
        destination: load.destination || '',
        client: load.client || '',
        carrier: load.carrier || '',
        pallets: (load.pallets || []).map((p: any) => ({
          id: p.id,
          label: p.label || '',
          notes: p.notes || '',
        })),
        boxes: (load.boxes || []).map((b: any) => ({
          id: b.id,
          label: b.label || '',
        })),
        items: (load.items || []).map((it: any) => ({
          id: it.id,
          name: it.name || '',
          category: it.category || '',
          notes: it.notes || '',
        })),
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
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '';
      const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const translatedData = JSON.parse(cleanJson);

      return res.json({
        success: true,
        engine: 'gemini',
        model: 'gemini-3.8-flash',
        translatedData,
      });
    } catch (err: any) {
      console.error('AI Load Translation error:', err);
      return res.status(500).json({
        error: err.message || 'Errore durante la traduzione AI del carico.',
        fallbackNeeded: true,
      });
    }
  });

  // Vite middleware mounting in development mode
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const indexHtmlPath = path.join(DIST_ROOT, 'index.html');
    const isDesktopRuntime = process.env.METATRON_DESKTOP_MODE === '1';
    console.log(
      `[CaricoStudio] Static DIST_ROOT=${DIST_ROOT} (index.html=${fs.existsSync(indexHtmlPath)})`
    );
    if (isDesktopRuntime) {
      // Nel software desktop locale non serve il Service Worker PWA: disinstalla eventuali SW vecchi
      // così dopo ogni aggiornamento automatico l'interfaccia è sempre aggiornata all'istante.
      app.get('/sw.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.send(
          `self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k)))).then(()=>self.registration.unregister()));});`
        );
      });
      app.get('/registerSW.js', (_req, res) => {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.send(
          `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()));}`
        );
      });
    }
    app.use(
      express.static(DIST_ROOT, {
        dotfiles: 'allow',
        etag: !isDesktopRuntime,
        lastModified: !isDesktopRuntime,
        setHeaders: isDesktopRuntime
          ? (res) => {
              res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
            }
          : undefined,
      })
    );
    app.get('*', (_req, res) => {
      if (isDesktopRuntime) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
      res.sendFile(indexHtmlPath, { dotfiles: 'allow' });
    });
  }

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[CaricoStudio] Port ${PORT} busy, retrying in 1s...`);
      setTimeout(() => {
        try {
          server.close();
        } catch {}
        server.listen(PORT, '0.0.0.0');
      }, 1000);
    } else {
      console.error('[CaricoStudio] Server error:', err);
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `\n  VITE v8.3.5  ready in 200 ms\n\n  ➜  Local:   http://localhost:${PORT}/\n  ➜  Network: http://0.0.0.0:${PORT}/\n`
    );
    console.log(`[CaricoStudio] Server running with WebSockets on http://0.0.0.0:${PORT}`);
  });

  const shutdown = () => {
    try {
      wss.close();
      server.close();
    } catch {}
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[CaricoStudio] Failed to start server:', err);
  process.exit(1);
});
