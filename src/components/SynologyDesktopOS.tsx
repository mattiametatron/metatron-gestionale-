import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  CheckSquare,
  GitBranch,
  Truck,
  PenTool,
  FolderPlus,
  RotateCcw,
  Upload,
  Printer,
  Scale,
  CheckCircle2,
  Copy,
  Pencil,
  FolderDown,
  Monitor,
  Languages,
  Paintbrush,
  LayoutGrid,
  Minus,
  X,
  Maximize2,
  Minimize2,
  Columns,
  PanelLeft,
  PanelRight,
  FileSpreadsheet,
  CopyPlus,
  RefreshCw,
  HardDrive,
  Search,
  ChevronRight,
  Layers,
  FileText,
  Palette,
  Activity,
  FolderOpen,
  ChevronLeft,
  Camera,
  QrCode,
  HelpCircle,
  LogOut,
  Scan,
  ChevronDown,
  Wifi,
  Crown,
  Send,
  Package,
  Bell,
  CloudSun,
  Clock as ClockIcon,
  Calendar as CalendarIcon,
  Server,
  Cpu,
} from 'lucide-react';
import { AuthUser, CargoLoad } from '../types/warehouse';
import { LoadSummary } from '../utils/calculations';
import { TutorialContextId } from '../data/appTutorials';
import {
  AuroraSilkWallpaper,
  WallpaperTheme,
  WALLPAPER_META,
} from './AuroraSilkWallpaper';
import { NotificationCenter, UnifiedNotification } from './NotificationCenter';

export type CaricoStudioSubAppId =
  | 'commesse'
  | 'checklist'
  | 'tree'
  | 'pallet_weights'
  | 'painting_tags'
  | 'view3d'
  | 'truck'
  | 'signatures'
  | 'qr_labels';

export type SynologyAppId =
  | CaricoStudioSubAppId
  | 'stock_movements'
  | 'commessa_photos'
  | 'file_manager'
  | 'warehouse_catalog'
  | 'team_share'
  | 'employer_hub'
  | 'weather'
  | 'clock'
  | 'calendar'
  | 'server_monitor'
  | 'server_control';

export type DesktopWindowId =
  | 'caricostudio'
  | 'stock_movements'
  | 'commessa_photos'
  | 'file_manager'
  | 'warehouse_catalog'
  | 'team_share'
  | 'employer_hub'
  | 'weather'
  | 'clock'
  | 'calendar'
  | 'server_monitor'
  | 'server_control';

export type WindowSnapMode = 'maximized' | 'floating' | 'left' | 'right';

export interface OpenWindowState {
  id: DesktopWindowId;
  minimized: boolean;
  snap: WindowSnapMode;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopAppDefinition {
  id: DesktopWindowId;
  title: string;
  shortTitle: string;
  subtitle: string;
  iconBg: string;
  badgeText?: (load: CargoLoad, summary: LoadSummary) => string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface SynologyAppDefinition {
  id: CaricoStudioSubAppId;
  title: string;
  shortTitle: string;
  subtitle: string;
  category: 'produzione' | 'logistica' | 'documenti';
  gradient: string;
  iconBg: string;
  badgeText?: (load: CargoLoad, summary: LoadSummary) => string;
  icon: React.ComponentType<{ className?: string }>;
}

export const DESKTOP_MAIN_APPS: DesktopAppDefinition[] = [
  {
    id: 'caricostudio',
    title: 'CaricoStudio — Suite Spedizioni & Logistica',
    shortTitle: 'CaricoStudio',
    subtitle: 'Commesse, Verniciatura & RAL, Bancali, Scatoloni, 3D, Camion e Firme',
    iconBg: 'bg-gradient-to-b from-[#7b5cff] to-[#5737eb]',
    badgeText: (load) => load.code,
    icon: LayoutGrid,
  },
  {
    id: 'stock_movements',
    title: 'Carico & Scarico Materiale — Magazzino',
    shortTitle: 'Carico/Scarico',
    subtitle: 'Commesse uscite/entrate, giacenze, movimenti, prove imballo 101%',
    iconBg: 'bg-gradient-to-b from-[#54cc31] to-[#32a61c]',
    badgeText: () => 'Magazzino',
    icon: Scan,
  },
  {
    id: 'commessa_photos',
    title: 'Foto Commesse — Fotocamera & Galleria',
    shortTitle: 'Foto',
    subtitle: 'Album divisi per commessa stile Google Foto con scatto rapido da telefono',
    iconBg: 'bg-gradient-to-b from-[#c84bff] to-[#9828e6]',
    badgeText: () => 'Galleria',
    icon: Camera,
  },
  {
    id: 'warehouse_catalog',
    title: 'Magazzino — Articoli, Scorte, Barcode & Preferiti',
    shortTitle: 'Magazzino',
    subtitle: 'Carica/scarica come alla cassa con lettore a barre, foto, file, SKU, scorta minima e Preferiti',
    iconBg: 'bg-gradient-to-b from-[#fb9518] to-[#e66c05]',
    badgeText: () => 'Scorte',
    icon: Package,
  },
  {
    id: 'file_manager',
    title: 'File — Cartelle, PDF, Excel & Foto',
    shortTitle: 'File',
    subtitle: "Crea e modifica cartelle, carica PDF, Excel, documenti o importa foto dall'App Foto",
    iconBg: 'bg-gradient-to-b from-[#f59e0b] to-[#d97706]',
    badgeText: () => 'Archivio',
    icon: FolderOpen,
  },
  {
    id: 'team_share',
    title: 'Scambio Team — Invio File & Foto tra Utenti',
    shortTitle: 'Scambio Team',
    subtitle: 'Scambia direttamente file, PDF, Excel e foto con tutti gli utenti registrati e la Direzione',
    iconBg: 'bg-gradient-to-b from-[#25b5ff] to-[#0b7be6]',
    badgeText: () => 'Team',
    icon: Send,
  },
  {
    id: 'employer_hub',
    title: 'Portale Direzione — Tutti i Profili, Commesse e Movimenti',
    shortTitle: 'Direzione Team',
    subtitle: 'Interfaccia riservata al Datore di Lavoro per controllare tutti i profili, commesse e carichi/scarichi',
    iconBg: 'bg-gradient-to-b from-[#f5b726] to-[#d97706]',
    badgeText: () => 'Direzione',
    icon: Crown,
  },
  {
    id: 'weather',
    title: 'Meteo — Previsioni Live Orarie e 7 Giorni',
    shortTitle: 'Meteo',
    subtitle: 'Temperatura in tempo reale, vento, pioggia, previsioni orarie e città preferite',
    iconBg: 'bg-gradient-to-b from-[#38bdf8] to-[#0284c7]',
    badgeText: () => 'Live',
    icon: CloudSun,
  },
  {
    id: 'clock',
    title: 'Orologio — Sveglie, Timer, Cronometro & Fusi Orari',
    shortTitle: 'Orologio',
    subtitle: 'Orologio digitale e analogico, fusi orari nel mondo, sveglie sonore, timer e cronometro',
    iconBg: 'bg-gradient-to-b from-[#6366f1] to-[#4338ca]',
    badgeText: () => 'Ora',
    icon: ClockIcon,
  },
  {
    id: 'calendar',
    title: 'Calendario — Appunti, Appuntamenti & Calendari Condivisi',
    shortTitle: 'Calendario',
    subtitle: 'Scrivi appunti giornalieri, appuntamenti e crea calendari condivisi con il team',
    iconBg: 'bg-gradient-to-b from-[#f43f5e] to-[#be123c]',
    badgeText: () => 'Condiviso',
    icon: CalendarIcon,
  },
  {
    id: 'server_monitor',
    title: 'Monitor Risorse — CPU, RAM, Dischi, Rete & Servizi Server',
    shortTitle: 'Monitor Server',
    subtitle: 'Telemetria hardware live del nodo METATRON Server OS, carico core e interfacce LAN',
    iconBg: 'bg-gradient-to-b from-[#10b981] to-[#047857]',
    badgeText: () => 'HW Live',
    icon: Cpu,
  },
  {
    id: 'server_control',
    title: 'Sistema & ISO — METATRON Server OS, Backup, Sessioni & Installer',
    shortTitle: 'Sistema & ISO',
    subtitle: 'Genera ISO avviabile da USB, installa su server Linux/Kiosk, snapshot backup, sessioni e log',
    iconBg: 'bg-gradient-to-b from-[#334155] to-[#0f172a]',
    badgeText: () => 'OS',
    icon: Server,
  },
];

export const CARICOSTUDIO_SUB_APPS: SynologyAppDefinition[] = [
  {
    id: 'commesse',
    title: 'File Station — Gestione Commesse',
    shortTitle: 'Commesse',
    subtitle: 'Archivio commesse, clienti, salvataggio file PC e backup',
    category: 'documenti',
    gradient: 'from-sky-500 to-blue-700',
    iconBg: 'bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-700',
    badgeText: (load) => load.code,
    icon: FolderOpen,
  },
  {
    id: 'painting_tags',
    title: 'Verniciatura, RAL & Zincatura (Studio Cartelli)',
    shortTitle: 'Verniciatura & RAL',
    subtitle: 'Layout cartello A4 in app, RAL, Zincato a caldo ed Elettrozincato',
    category: 'produzione',
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-600',
    badgeText: (load) =>
      (load.finishingTags?.length || 0) > 0
        ? `${load.finishingTags?.length} Cartelli`
        : 'Layout A4',
    icon: Paintbrush,
  },
  {
    id: 'pallet_weights',
    title: 'Pesi Bancali & Schede Collo A4',
    shortTitle: 'Pesi Bancali',
    subtitle: 'Inserisci i pesi a bilancia e stampa i fogli A4 per ogni bancale',
    category: 'produzione',
    gradient: 'from-emerald-500 to-teal-700',
    iconBg: 'bg-gradient-to-br from-emerald-400 via-teal-600 to-cyan-700',
    badgeText: (_, summary) => `${summary.totalPallets} Bancali`,
    icon: Scale,
  },
  {
    id: 'tree',
    title: 'Albero Bancali, Scatoloni & Fuori Scatola',
    shortTitle: 'Albero Bancali',
    subtitle: 'Gestione bancali, scatole su misura, sotto-scatole e foto',
    category: 'logistica',
    gradient: 'from-indigo-500 to-violet-700',
    iconBg: 'bg-gradient-to-br from-indigo-500 via-purple-600 to-violet-800',
    badgeText: (_, summary) =>
      `${summary.totalPallets}B · ${summary.totalBoxes}S`,
    icon: GitBranch,
  },
  {
    id: 'checklist',
    title: 'Check-list Merci, Foto & Kit',
    shortTitle: 'Check-list Merci',
    subtitle: 'Distinta articoli, foto pezzi, spunta carico e creazione Kit',
    category: 'logistica',
    gradient: 'from-blue-500 to-cyan-600',
    iconBg: 'bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600',
    badgeText: (_, summary) =>
      `${summary.checkedItems}/${summary.totalItems} Art.`,
    icon: CheckSquare,
  },
  {
    id: 'view3d',
    title: 'CAD 3D Stivaggio Bancali & Raggi X',
    shortTitle: 'CAD 3D Bancali',
    subtitle: 'Vista 3D interattiva a piani, ispezione sotto-scatole e guida',
    category: 'logistica',
    gradient: 'from-fuchsia-500 to-purple-700',
    iconBg: 'bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-800',
    badgeText: () => '3D CAD',
    icon: Box,
  },
  {
    id: 'truck',
    title: 'Piano di Carico Automezzo',
    shortTitle: 'Carico Camion',
    subtitle: 'Posizionamento bancali sul camion e bilanciamento pesi SX/DX',
    category: 'logistica',
    gradient: 'from-teal-500 to-emerald-700',
    iconBg: 'bg-gradient-to-br from-teal-400 via-emerald-600 to-green-700',
    badgeText: (load, summary) =>
      `${summary.totalPallets}/${load.vehicleMaxPallets} Posti`,
    icon: Truck,
  },
  {
    id: 'signatures',
    title: 'Firme Elettroniche & Convalida',
    shortTitle: 'Firme & Bolla',
    subtitle: 'Convalida digitale Operatore, Responsabile Logistica e Autista',
    category: 'documenti',
    gradient: 'from-rose-500 to-pink-700',
    iconBg: 'bg-gradient-to-br from-rose-500 via-pink-600 to-purple-700',
    badgeText: (load) => `${load.signatures?.length || 0}/3 Firme`,
    icon: PenTool,
  },
  {
    id: 'qr_labels',
    title: 'Etichette A4 QR & Codice a Barre',
    shortTitle: 'Etichette QR A4',
    subtitle: 'Foglio A4 con tutte le etichette per bancali, scatole e pezzi con carico/scarico',
    category: 'documenti',
    gradient: 'from-slate-700 to-slate-900',
    iconBg: 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950',
    badgeText: (load) =>
      `${load.pallets.length + load.boxes.length + load.items.length} Etich.`,
    icon: QrCode,
  },
];

export const SYNOLOGY_APPS = CARICOSTUDIO_SUB_APPS;

interface DesktopShortcutItem {
  id: string;
  label: string;
  title: string;
  iconBg: string;
  icon: React.ComponentType<{ className?: string }>;
  windowId?: DesktopWindowId;
  action: 'open_caricostudio_home' | 'open_window' | 'open_subapp' | 'open_print';
  subAppId?: CaricoStudioSubAppId;
}

const DESKTOP_COLUMN_1: DesktopShortcutItem[] = [
  {
    id: 'caricostudio',
    label: 'CaricoStudio',
    title: 'CaricoStudio — Suite Spedizioni & Logistica',
    iconBg: 'bg-gradient-to-b from-[#7b5cff] to-[#5737eb]',
    icon: LayoutGrid,
    windowId: 'caricostudio',
    action: 'open_caricostudio_home',
  },
  {
    id: 'commesse',
    label: 'Commesse',
    title: 'Gestione Commesse & Archivio Clienti',
    iconBg: 'bg-gradient-to-b from-[#2da4f9] to-[#1778e6]',
    icon: FolderOpen,
    windowId: 'caricostudio',
    subAppId: 'commesse',
    action: 'open_subapp',
  },
  {
    id: 'qr_labels',
    label: 'Etichette QR',
    title: 'Etichette A4 QR & Codice a Barre',
    iconBg: 'bg-gradient-to-b from-[#17b890] to-[#0a8f71]',
    icon: QrCode,
    windowId: 'caricostudio',
    subAppId: 'qr_labels',
    action: 'open_subapp',
  },
  {
    id: 'file_manager',
    label: 'File',
    title: 'Archivio File — Cartelle, PDF, Excel e Foto',
    iconBg: 'bg-gradient-to-b from-[#f59e0b] to-[#d97706]',
    icon: FolderOpen,
    windowId: 'file_manager',
    action: 'open_window',
  },
  {
    id: 'stock_movements',
    label: 'Carico/Scarico',
    title: 'Carico & Scarico Materiale — Magazzino',
    iconBg: 'bg-gradient-to-b from-[#54cc31] to-[#32a61c]',
    icon: Scan,
    windowId: 'stock_movements',
    action: 'open_window',
  },
  {
    id: 'commessa_photos',
    label: 'Foto',
    title: 'Foto Commesse — Fotocamera & Galleria',
    iconBg: 'bg-gradient-to-b from-[#c84bff] to-[#9828e6]',
    icon: Camera,
    windowId: 'commessa_photos',
    action: 'open_window',
  },
  {
    id: 'checklist',
    label: 'Check-list',
    title: 'Check-list Merci, Foto & Kit',
    iconBg: 'bg-gradient-to-b from-[#f23d52] to-[#d61c36]',
    icon: CheckSquare,
    windowId: 'caricostudio',
    subAppId: 'checklist',
    action: 'open_subapp',
  },
  {
    id: 'tree',
    label: 'Bancali',
    title: 'Albero Bancali, Scatoloni & Fuori Scatola',
    iconBg: 'bg-gradient-to-b from-[#15b58a] to-[#0b8a6a]',
    icon: GitBranch,
    windowId: 'caricostudio',
    subAppId: 'tree',
    action: 'open_subapp',
  },
];

const DESKTOP_COLUMN_2: DesktopShortcutItem[] = [
  {
    id: 'warehouse_catalog',
    label: 'Magazzino',
    title: 'Magazzino — Cassa Lettore Barcode, Articoli, Scorte, Foto & Preferiti',
    iconBg: 'bg-gradient-to-b from-[#fb9518] to-[#e66c05]',
    icon: Package,
    windowId: 'warehouse_catalog',
    action: 'open_window',
  },
  {
    id: 'pallet_weights',
    label: 'Pesi Bancali',
    title: 'Pesi Bancali & Schede Collo A4',
    iconBg: 'bg-gradient-to-b from-[#1b9ef5] to-[#0c78d1]',
    icon: Scale,
    windowId: 'caricostudio',
    subAppId: 'pallet_weights',
    action: 'open_subapp',
  },
  {
    id: 'painting_tags',
    label: 'Verniciatura',
    title: 'Verniciatura, RAL & Zincatura (Cartelli A4)',
    iconBg: 'bg-gradient-to-b from-[#5c6878] to-[#3e4856]',
    icon: Paintbrush,
    windowId: 'caricostudio',
    subAppId: 'painting_tags',
    action: 'open_subapp',
  },
  {
    id: 'view3d',
    label: 'CAD 3D',
    title: 'CAD 3D Stivaggio Bancali & Raggi X',
    iconBg: 'bg-gradient-to-b from-[#505d72] to-[#353f52]',
    icon: Layers,
    windowId: 'caricostudio',
    subAppId: 'view3d',
    action: 'open_subapp',
  },
  {
    id: 'print_center',
    label: 'Stampe',
    title: 'Centro Stampe Etichette e Distinte',
    iconBg: 'bg-gradient-to-b from-[#555e7a] to-[#384059]',
    icon: Printer,
    action: 'open_print',
  },
  {
    id: 'team_share',
    label: 'Scambio Team',
    title: 'Scambio Team — Invia e ricevi file e foto tra colleghi',
    iconBg: 'bg-gradient-to-b from-[#25b5ff] to-[#0b7be6]',
    icon: Send,
    windowId: 'team_share',
    action: 'open_window',
  },
];

const DESKTOP_COLUMN_3: DesktopShortcutItem[] = [
  {
    id: 'calendar',
    label: 'Calendario',
    title: 'Calendario — Appunti, Appuntamenti e Calendari Condivisi col Team',
    iconBg: 'bg-gradient-to-b from-[#f43f5e] to-[#be123c]',
    icon: CalendarIcon,
    windowId: 'calendar',
    action: 'open_window',
  },
  {
    id: 'weather',
    label: 'Meteo',
    title: 'Meteo — Previsioni live orarie e settimanali',
    iconBg: 'bg-gradient-to-b from-[#38bdf8] to-[#0284c7]',
    icon: CloudSun,
    windowId: 'weather',
    action: 'open_window',
  },
  {
    id: 'clock',
    label: 'Orologio',
    title: 'Orologio — Fusi orari, Sveglie, Timer e Cronometro',
    iconBg: 'bg-gradient-to-b from-[#6366f1] to-[#4338ca]',
    icon: ClockIcon,
    windowId: 'clock',
    action: 'open_window',
  },
  {
    id: 'server_monitor',
    label: 'Monitor Server',
    title: 'Monitor Risorse Server — CPU, RAM, Dischi, Rete e Servizi',
    iconBg: 'bg-gradient-to-b from-[#10b981] to-[#047857]',
    icon: Cpu,
    windowId: 'server_monitor',
    action: 'open_window',
  },
  {
    id: 'server_control',
    label: 'Sistema & ISO',
    title: 'METATRON Server OS — Installer Linux, Generatore ISO USB, Backup e Log',
    iconBg: 'bg-gradient-to-b from-[#334155] to-[#0f172a]',
    icon: Server,
    windowId: 'server_control',
    action: 'open_window',
  },
];

const EMPLOYER_ONLY_SHORTCUT: DesktopShortcutItem = {
  id: 'employer_hub',
  label: 'Direzione Team',
  title: 'Portale Direzione — Controllo profili, commesse e carichi/scarichi',
  iconBg: 'bg-gradient-to-b from-[#f5b726] to-[#d97706]',
  icon: Crown,
  windowId: 'employer_hub',
  action: 'open_window',
};

function getShortcutsForRole(isEmployer: boolean): DesktopShortcutItem[] {
  if (isEmployer) {
    return [
      EMPLOYER_ONLY_SHORTCUT,
      ...DESKTOP_COLUMN_1,
      ...DESKTOP_COLUMN_2,
      ...DESKTOP_COLUMN_3,
    ];
  }
  return [...DESKTOP_COLUMN_1, ...DESKTOP_COLUMN_2, ...DESKTOP_COLUMN_3];
}

interface DesktopGridPos {
  col: number;
  row: number;
}

const DESKTOP_GRID_ORIGIN_X = 16;
const DESKTOP_GRID_ORIGIN_Y = 16;
const DESKTOP_GRID_CELL_W = 88;
const DESKTOP_GRID_CELL_H = 88;

function getDefaultDesktopPositions(isEmployer: boolean): Record<string, DesktopGridPos> {
  const map: Record<string, DesktopGridPos> = {};
  DESKTOP_COLUMN_1.forEach((item, idx) => {
    map[item.id] = { col: 0, row: idx };
  });
  if (isEmployer) {
    // Place Direzione Team prominently at top of column 2 and shift col 2 items down by 1
    map[EMPLOYER_ONLY_SHORTCUT.id] = { col: 1, row: 0 };
    DESKTOP_COLUMN_2.forEach((item, idx) => {
      map[item.id] = { col: 1, row: idx + 1 };
    });
  } else {
    DESKTOP_COLUMN_2.forEach((item, idx) => {
      map[item.id] = { col: 1, row: idx };
    });
  }
  DESKTOP_COLUMN_3.forEach((item, idx) => {
    map[item.id] = { col: 2, row: idx };
  });
  return map;
}

function loadDesktopPositions(
  userId: string,
  isEmployer: boolean
): Record<string, DesktopGridPos> {
  const defaults = getDefaultDesktopPositions(isEmployer);
  const shortcuts = getShortcutsForRole(isEmployer);
  try {
    const raw = localStorage.getItem(`caricostudio_desktop_icons_${userId}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    const merged: Record<string, DesktopGridPos> = { ...defaults };
    for (const item of shortcuts) {
      const pos = parsed[item.id];
      if (
        pos &&
        typeof pos.col === 'number' &&
        typeof pos.row === 'number' &&
        Number.isFinite(pos.col) &&
        Number.isFinite(pos.row)
      ) {
        merged[item.id] = {
          col: Math.max(0, Math.round(pos.col)),
          row: Math.max(0, Math.round(pos.row)),
        };
      }
    }
    return merged;
  } catch {
    return defaults;
  }
}

function saveDesktopPositions(
  userId: string,
  positions: Record<string, DesktopGridPos>
): void {
  try {
    localStorage.setItem(
      `caricostudio_desktop_icons_${userId}`,
      JSON.stringify(positions)
    );
  } catch {
    // ignore storage errors
  }
}

interface CommesseFileStationProps {
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  summary: LoadSummary;
  onSelectLoad: (loadId: string) => void;
  onOpenNewLoadModal: () => void;
  onDuplicateLoad: () => void;
  onUpdateProjectName: (title: string, code: string) => void;
  onClearCurrentLoad: () => void;
  onSaveToFolder: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
  onOpenPrintModal: () => void;
  onOpenApp: (appId: SynologyAppId) => void;
}

export const CommesseFileStation: React.FC<CommesseFileStationProps> = ({
  loads,
  activeLoad,
  summary,
  onSelectLoad,
  onOpenNewLoadModal,
  onDuplicateLoad,
  onUpdateProjectName,
  onClearCurrentLoad,
  onSaveToFolder,
  onImportJSON,
  onExportCSV,
  onOpenPrintModal,
  onOpenApp,
}) => {
  const [editCode, setEditCode] = useState(activeLoad.code);
  const [editTitle, setEditTitle] = useState(activeLoad.title);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setEditCode(activeLoad.code);
    setEditTitle(activeLoad.title);
  }, [activeLoad.id, activeLoad.code, activeLoad.title]);

  const filteredLoads = loads.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.code.toLowerCase().includes(q) ||
      l.title.toLowerCase().includes(q) ||
      (l.client || '').toLowerCase().includes(q)
    );
  });

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    onUpdateProjectName(
      editTitle.trim(),
      editCode.trim().toUpperCase() || activeLoad.code
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* File Station Toolbar */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewLoadModal}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            <span>+ Nuova Commessa</span>
          </button>

          <button
            type="button"
            onClick={onDuplicateLoad}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Copy className="w-3.5 h-3.5 text-slate-600" />
            <span>Duplica Commessa</span>
          </button>

          <button
            type="button"
            onClick={onSaveToFolder}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FolderDown className="w-3.5 h-3.5 text-emerald-700" />
            <span>Salva su PC (.json)</span>
          </button>

          <label className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Apri File da PC</span>
            <input
              type="file"
              accept=".json"
              onChange={onImportJSON}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={onExportCSV}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Esporta Excel CSV</span>
          </button>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca commessa o cliente..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto min-h-0">
        {/* Left: Lista Commesse (File Station Folders) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              Cartelle Commesse ({filteredLoads.length})
            </span>
            <span className="text-[11px] text-slate-500 font-medium">
              Clicca per attivare
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {filteredLoads.map((item) => {
              const isSelected = item.id === activeLoad.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLoad(item.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-blue-50 text-blue-600 border border-blue-200'
                      }`}
                    >
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-black px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-blue-800 text-white'
                              : 'bg-slate-100 text-blue-700'
                          }`}
                        >
                          {item.code}
                        </span>
                        <span className="text-xs font-extrabold truncate">
                          {item.title}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 truncate ${
                          isSelected ? 'text-blue-100' : 'text-slate-500'
                        }`}
                      >
                        Cliente: {item.client || 'N/D'} · {item.pallets.length}{' '}
                        bancali · {item.boxes.length} scatole ·{' '}
                        {item.finishingTags?.length || 0} cartelli RAL
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Dettagli Commessa Attiva & Collegamenti Rapidi App */}
        <div className="lg:col-span-7 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                  COMMESSA SELEZIONATA
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {activeLoad.code} — {activeLoad.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClearCurrentLoad}
                className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Svuota Commessa</span>
              </button>
            </div>

            <form
              onSubmit={handleSaveRename}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end bg-slate-50 p-3.5 rounded-xl border border-slate-200"
            >
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Codice Commessa
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Titolo / Nome Commessa
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Aggiorna Nome</span>
                </button>
              </div>
            </form>

            {/* Metriche Commessa */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                <div className="text-[10px] font-bold uppercase text-blue-700">
                  Articoli Spuntati
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                  {summary.checkedItems}/{summary.totalItems}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                <div className="text-[10px] font-bold uppercase text-indigo-700">
                  Bancali & Scatole
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                  {summary.totalPallets}B · {summary.totalBoxes}S
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="text-[10px] font-bold uppercase text-emerald-700">
                  Peso Totale Lordo
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                  {summary.totalGrossWeightKg.toFixed(0)} kg
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <div className="text-[10px] font-bold uppercase text-amber-800">
                  Cartelli RAL / Zinc.
                </div>
                <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                  {activeLoad.finishingTags?.length || 0}
                </div>
              </div>
            </div>

            {/* Apri questa commessa nelle altre App di CaricoStudio */}
            <div className="pt-2">
              <div className="text-xs font-extrabold text-slate-700 mb-2.5">
                Apri questa Commessa nelle App di CaricoStudio:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {CARICOSTUDIO_SUB_APPS.filter((a) => a.id !== 'commesse').map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => onOpenApp(app.id)}
                      className="p-3 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/50 flex items-center gap-2.5 text-left transition-all cursor-pointer group"
                    >
                      <div
                        className={`w-9 h-9 rounded-xl ${app.iconBg} text-white flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {app.shortTitle}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          Apri in CaricoStudio
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onOpenPrintModal}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-900 text-white flex items-center gap-2.5 text-left transition-all cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">
                      Centro Stampe
                    </div>
                    <div className="text-[10px] text-slate-300 truncate">
                      Etichette e Bolle
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SynologyDesktopOSProps {
  currentUser: AuthUser;
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  summary: LoadSummary;
  statusNotice: string | null;
  isRealtimeConnected: boolean;
  activeUsersCount: number;
  selected3DPalletId: string;
  onLogout: () => void;
  onActiveTutorialContextChange?: (contextId: TutorialContextId) => void;
  onOpenTutorial?: () => void;
  onSelectLoad: (loadId: string) => void;
  onOpenNewLoadModal: () => void;
  onDuplicateLoad: () => void;
  onUpdateProjectName: (title: string, code: string) => void;
  onClearCurrentLoad: () => void;
  onOpenPrintModal: () => void;
  onOpenPdfDirect: () => void;
  onSaveToFolder: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
  onOpenNetworkSyncModal: () => void;
  onOpenPdfTranslator: () => void;
  onOpenKitModal: (defaultPalletId?: string | null) => void;
  onForceReload: () => void;
  notifications: UnifiedNotification[];
  onMarkNotificationRead: (item: UnifiedNotification) => void;
  onMarkAllNotificationsRead: () => void;
  onDismissNotification: (item: UnifiedNotification) => void;
  renderAppContent: (
    appId: SynologyAppId,
    openApp: (targetAppId: SynologyAppId) => void
  ) => React.ReactNode;
}

export const SynologyDesktopOS: React.FC<SynologyDesktopOSProps> = ({
  currentUser,
  loads,
  activeLoad,
  summary,
  statusNotice,
  isRealtimeConnected,
  activeUsersCount,
  onLogout,
  onActiveTutorialContextChange,
  onOpenTutorial,
  onSelectLoad,
  onOpenNewLoadModal,
  onDuplicateLoad,
  onUpdateProjectName,
  onClearCurrentLoad,
  onOpenPrintModal,
  onOpenPdfDirect,
  onSaveToFolder,
  onImportJSON,
  onExportCSV,
  onOpenNetworkSyncModal,
  onOpenPdfTranslator,
  onOpenKitModal,
  onForceReload,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onDismissNotification,
  renderAppContent,
}) => {
  const [windows, setWindows] = useState<OpenWindowState[]>([]);
  const [caricoStudioSubApp, setCaricoStudioSubApp] = useState<
    CaricoStudioSubAppId | 'home'
  >('home');
  const [topZIndex, setTopZIndex] = useState<number>(20);
  const [showStartMenu, setShowStartMenu] = useState<boolean>(false);
  const [showAccountMenu, setShowAccountMenu] = useState<boolean>(false);
  const [showCommessaMenu, setShowCommessaMenu] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showWidgetPanel, setShowWidgetPanel] = useState<boolean>(false);
  const [wallpaper, setWallpaper] = useState<WallpaperTheme>('aurora_silk');
  const [clockText, setClockText] = useState<string>('');
  const [dateText, setDateText] = useState<string>('');

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const isEmployer = currentUser.role === 'employer';
  const visibleShortcuts = getShortcutsForRole(isEmployer);
  const visibleMainApps = DESKTOP_MAIN_APPS.filter(
    (a) => a.id !== 'employer_hub' || isEmployer
  );

  // Desktop draggable icons state (grid-snapped, saved per user)
  const desktopAreaRef = useRef<HTMLDivElement | null>(null);
  const [desktopBounds, setDesktopBounds] = useState<{
    width: number;
    height: number;
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight - 44 : 720,
  });
  const [iconPositions, setIconPositions] = useState<
    Record<string, DesktopGridPos>
  >(() => loadDesktopPositions(currentUser.id, isEmployer));
  const [draggingIcon, setDraggingIcon] = useState<{
    id: string;
    pxX: number;
    pxY: number;
    snapCol: number;
    snapRow: number;
  } | null>(null);
  const [desktopContextMenu, setDesktopContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const iconDragRef = useRef<{
    id: string;
    startClientX: number;
    startClientY: number;
    origPxX: number;
    origPxY: number;
    origCol: number;
    origRow: number;
    snapCol: number;
    snapRow: number;
    moved: boolean;
  } | null>(null);
  const justDraggedIconIdRef = useRef<string | null>(null);

  // Reload icon layout when active user changes & auto-launch Direzione Team for Employer
  useEffect(() => {
    setIconPositions(loadDesktopPositions(currentUser.id, isEmployer));
    if (isEmployer) {
      setWindows([
        {
          id: 'employer_hub',
          minimized: false,
          snap: 'maximized',
          zIndex: 25,
          x: 40,
          y: 28,
          width: 1180,
          height: 720,
        },
      ]);
      setTopZIndex(26);
    } else {
      setWindows((prev) => prev.filter((w) => w.id !== 'employer_hub'));
    }
  }, [currentUser.id, isEmployer]);

  // Keep desktop bounds synced for clamping dragged icons
  useEffect(() => {
    const updateBounds = () => {
      const el = desktopAreaRef.current;
      if (el) {
        setDesktopBounds({ width: el.clientWidth, height: el.clientHeight });
      } else {
        setDesktopBounds({
          width: window.innerWidth,
          height: Math.max(300, window.innerHeight - 44),
        });
      }
    };
    updateBounds();
    window.addEventListener('resize', updateBounds);
    return () => window.removeEventListener('resize', updateBounds);
  }, []);

  const maxGridCol = Math.max(
    1,
    Math.floor(
      (desktopBounds.width - DESKTOP_GRID_ORIGIN_X * 2) / DESKTOP_GRID_CELL_W
    ) - 1
  );
  const maxGridRow = Math.max(
    2,
    Math.floor(
      (desktopBounds.height - DESKTOP_GRID_ORIGIN_Y * 2) / DESKTOP_GRID_CELL_H
    ) - 1
  );

  // Pointer drag lifecycle for moving desktop app icons
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = iconDragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (!drag.moved && Math.hypot(dx, dy) < 6) {
        return;
      }
      drag.moved = true;

      const rawX = drag.origPxX + dx;
      const rawY = drag.origPxY + dy;
      const clampedX = Math.max(
        4,
        Math.min(desktopBounds.width - 80, rawX)
      );
      const clampedY = Math.max(
        4,
        Math.min(desktopBounds.height - 84, rawY)
      );

      const snapCol = Math.max(
        0,
        Math.min(
          maxGridCol,
          Math.round((clampedX - DESKTOP_GRID_ORIGIN_X) / DESKTOP_GRID_CELL_W)
        )
      );
      const snapRow = Math.max(
        0,
        Math.min(
          maxGridRow,
          Math.round((clampedY - DESKTOP_GRID_ORIGIN_Y) / DESKTOP_GRID_CELL_H)
        )
      );

      drag.snapCol = snapCol;
      drag.snapRow = snapRow;

      setDraggingIcon({
        id: drag.id,
        pxX: clampedX,
        pxY: clampedY,
        snapCol,
        snapRow,
      });
    };

    const handlePointerUp = () => {
      const drag = iconDragRef.current;
      if (!drag) return;
      iconDragRef.current = null;

      if (drag.moved) {
        justDraggedIconIdRef.current = drag.id;
        window.setTimeout(() => {
          if (justDraggedIconIdRef.current === drag.id) {
            justDraggedIconIdRef.current = null;
          }
        }, 80);

        const targetCol = drag.snapCol;
        const targetRow = drag.snapRow;
        setIconPositions((prev) => {
          const next: Record<string, DesktopGridPos> = { ...prev };
          const occupantId = Object.keys(prev).find(
            (otherId) =>
              otherId !== drag.id &&
              prev[otherId]?.col === targetCol &&
              prev[otherId]?.row === targetRow
          );
          if (occupantId) {
            next[occupantId] = { col: drag.origCol, row: drag.origRow };
          }
          next[drag.id] = { col: targetCol, row: targetRow };
          saveDesktopPositions(currentUser.id, next);
          return next;
        });
      }
      setDraggingIcon(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [currentUser.id, desktopBounds.width, desktopBounds.height, maxGridCol, maxGridRow]);

  const handleResetDesktopIcons = () => {
    const defaults = getDefaultDesktopPositions(isEmployer);
    setIconPositions(defaults);
    saveDesktopPositions(currentUser.id, defaults);
    setDesktopContextMenu(null);
    setShowAccountMenu(false);
  };

  // Dragging state for floating windows
  const dragRef = useRef<{
    appId: DesktopWindowId;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockText(
        now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      );
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      setDateText(`${dd}/${mm}/${yyyy}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { appId, startX, startY, origX, origY } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      setWindows((prev) =>
        prev.map((w) =>
          w.id === appId
            ? {
                ...w,
                x: Math.max(8, Math.min(window.innerWidth - 220, origX + dx)),
                y: Math.max(8, Math.min(window.innerHeight - 104, origY + dy)),
              }
            : w
        )
      );
    };
    const handleMouseUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const closeAllPopovers = () => {
    setShowStartMenu(false);
    setShowAccountMenu(false);
    setShowCommessaMenu(false);
    setShowNotifications(false);
    setDesktopContextMenu(null);
  };

  const openDesktopWindow = (
    windowId: DesktopWindowId,
    initialSnap?: WindowSnapMode
  ) => {
    closeAllPopovers();
    setTopZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === windowId);
        if (existing) {
          return prev.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  minimized: false,
                  snap: initialSnap || w.snap,
                  zIndex: nextZ,
                }
              : w
          );
        }
        const offset = (prev.length % 4) * 26;
        const defaultW = Math.min(
          1240,
          Math.max(820, Math.round(window.innerWidth * 0.86))
        );
        const defaultH = Math.min(
          760,
          Math.max(520, Math.round((window.innerHeight - 44) * 0.86))
        );
        const defaultX = Math.max(
          20,
          Math.round((window.innerWidth - defaultW) / 2) + offset - 20
        );
        const defaultY = Math.max(16, 24 + offset);

        return [
          ...prev,
          {
            id: windowId,
            minimized: false,
            snap: initialSnap || 'floating',
            zIndex: nextZ,
            x: defaultX,
            y: defaultY,
            width: defaultW,
            height: defaultH,
          },
        ];
      });
      return nextZ;
    });
  };

  const openApp = (appId: SynologyAppId, initialSnap?: WindowSnapMode) => {
    if (appId === 'employer_hub' && !isEmployer) {
      return;
    }
    if (
      appId === 'stock_movements' ||
      appId === 'commessa_photos' ||
      appId === 'file_manager' ||
      appId === 'warehouse_catalog' ||
      appId === 'team_share' ||
      appId === 'employer_hub' ||
      appId === 'weather' ||
      appId === 'clock' ||
      appId === 'calendar' ||
      appId === 'server_monitor' ||
      appId === 'server_control'
    ) {
      openDesktopWindow(appId, initialSnap);
      return;
    }
    setCaricoStudioSubApp(appId);
    openDesktopWindow('caricostudio', initialSnap);
  };

  const handleShortcutClick = (item: DesktopShortcutItem) => {
    if (item.action === 'open_print') {
      closeAllPopovers();
      onOpenPrintModal();
      return;
    }
    if (item.action === 'open_caricostudio_home') {
      const alreadyOpen = windows.some((w) => w.id === 'caricostudio');
      if (!alreadyOpen) setCaricoStudioSubApp('home');
      openDesktopWindow('caricostudio');
      return;
    }
    if (item.action === 'open_subapp' && item.subAppId) {
      openApp(item.subAppId);
      return;
    }
    if (item.action === 'open_window' && item.windowId) {
      openDesktopWindow(item.windowId);
    }
  };

  const focusWindow = (appId: DesktopWindowId) => {
    closeAllPopovers();
    setTopZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setWindows((prev) =>
        prev.map((w) =>
          w.id === appId ? { ...w, minimized: false, zIndex: nextZ } : w
        )
      );
      return nextZ;
    });
  };

  const toggleMinimizeWindow = (appId: DesktopWindowId) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === appId ? { ...w, minimized: !w.minimized } : w
      )
    );
  };

  const closeWindow = (appId: DesktopWindowId) => {
    setWindows((prev) => prev.filter((w) => w.id !== appId));
  };

  const setWindowSnap = (appId: DesktopWindowId, snap: WindowSnapMode) => {
    focusWindow(appId);
    setWindows((prev) =>
      prev.map((w) => (w.id === appId ? { ...w, snap, minimized: false } : w))
    );
  };

  const minimizeAllToDesktop = () => {
    closeAllPopovers();
    setWindows((prev) => prev.map((w) => ({ ...w, minimized: true })));
  };

  const tileTwoWindowsSideBySide = () => {
    openDesktopWindow('caricostudio', 'left');
    openDesktopWindow('stock_movements', 'right');
  };

  const activeVisibleWindows = windows.filter((w) => !w.minimized);
  const topVisibleWindowId =
    activeVisibleWindows.length > 0
      ? [...activeVisibleWindows].sort((a, b) => b.zIndex - a.zIndex)[0].id
      : null;

  useEffect(() => {
    if (!onActiveTutorialContextChange) return;
    if (!topVisibleWindowId) {
      onActiveTutorialContextChange('desktop');
      return;
    }
    if (topVisibleWindowId === 'caricostudio') {
      onActiveTutorialContextChange(
        caricoStudioSubApp === 'home' ? 'caricostudio_home' : caricoStudioSubApp
      );
      return;
    }
    onActiveTutorialContextChange(topVisibleWindowId);
  }, [topVisibleWindowId, caricoStudioSubApp, onActiveTutorialContextChange]);

  const weightPercent = Math.min(
    100,
    Math.round(
      (summary.totalGrossWeightKg / Math.max(1, activeLoad.vehicleMaxWeightKg)) *
        100
    )
  );

  const wallpaperInfo = WALLPAPER_META[wallpaper];
  const isLightWallpaper = Boolean(wallpaperInfo.isLight);
  const userInitial = (currentUser.name || currentUser.email || 'U')
    .trim()
    .charAt(0)
    .toUpperCase();

  const renderDesktopShortcut = (item: DesktopShortcutItem) => {
    const Icon = item.icon;
    const isWindowOpen =
      item.windowId &&
      windows.some((w) => w.id === item.windowId) &&
      (item.action === 'open_window' ||
        item.action === 'open_caricostudio_home' ||
        (item.action === 'open_subapp' && caricoStudioSubApp === item.subAppId));

    const pos = iconPositions[item.id] || { col: 0, row: 0 };
    const clampedCol = Math.max(0, Math.min(maxGridCol, pos.col));
    const clampedRow = Math.max(0, Math.min(maxGridRow, pos.row));
    const gridPxX = DESKTOP_GRID_ORIGIN_X + clampedCol * DESKTOP_GRID_CELL_W;
    const gridPxY = DESKTOP_GRID_ORIGIN_Y + clampedRow * DESKTOP_GRID_CELL_H;

    const isDraggingThis = draggingIcon?.id === item.id;
    const leftPx = isDraggingThis ? draggingIcon.pxX : gridPxX;
    const topPx = isDraggingThis ? draggingIcon.pxY : gridPxY;

    return (
      <button
        key={item.id}
        type="button"
        draggable={false}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          closeAllPopovers();
          iconDragRef.current = {
            id: item.id,
            startClientX: e.clientX,
            startClientY: e.clientY,
            origPxX: gridPxX,
            origPxY: gridPxY,
            origCol: clampedCol,
            origRow: clampedRow,
            snapCol: clampedCol,
            snapRow: clampedRow,
            moved: false,
          };
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (justDraggedIconIdRef.current === item.id) return;
          handleShortcutClick(item);
        }}
        style={{
          left: leftPx,
          top: topPx,
        }}
        title={`${item.title} — Trascina per spostare`}
        className={`group absolute w-[76px] py-1 px-1 rounded-xl flex flex-col items-center text-center gap-1.5 touch-none select-none focus:outline-none ${
          isDraggingThis
            ? 'z-30 scale-[1.07] opacity-95 cursor-grabbing bg-white/[0.12] ring-1 ring-white/25 shadow-2xl'
            : 'z-10 transition-[left,top,transform,background-color] duration-150 cursor-grab hover:bg-white/[0.08] active:scale-[0.97]'
        }`}
      >
        <div
          className={`w-[50px] h-[50px] rounded-[14px] ${item.iconBg} flex items-center justify-center text-white shadow-[0_8px_20px_rgba(0,0,0,0.45)] ring-1 ring-inset ring-white/25 transition-transform duration-150 ${
            isDraggingThis
              ? 'shadow-[0_16px_30px_rgba(0,0,0,0.65)]'
              : 'group-hover:scale-[1.06] group-hover:shadow-[0_12px_24px_rgba(0,0,0,0.55)]'
          }`}
        >
          <Icon className="w-[22px] h-[22px] stroke-[1.9]" />
        </div>
        <span
          className={`text-[11px] font-medium leading-[1.2] tracking-[0.005em] max-w-[74px] line-clamp-2 ${
            isLightWallpaper
              ? 'text-slate-900'
              : 'text-white/92 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]'
          }`}
        >
          {item.label}
        </span>
        {isWindowOpen && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-white/85 -mt-0.5"
            aria-hidden="true"
          />
        )}
      </button>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col select-none relative bg-[#090b16] font-sans">
      {/* =====================================================================
          1. DESKTOP WORKSPACE (SILK AURORA BACKDROP + DRAGGABLE ICON GRID)
      ===================================================================== */}
      <div className="flex-1 relative overflow-hidden">
        <AuroraSilkWallpaper theme={wallpaper} />

        {/* Desktop Surface: Free Grid-Snapped Draggable Icons + Optional Widget */}
        <div
          ref={desktopAreaRef}
          onClick={() => {
            if (
              showStartMenu ||
              showAccountMenu ||
              showCommessaMenu ||
              showNotifications ||
              desktopContextMenu
            ) {
              closeAllPopovers();
            }
          }}
          onContextMenu={(e) => {
            if ((e.target as HTMLElement).closest('button, aside')) return;
            e.preventDefault();
            closeAllPopovers();
            const menuW = 210;
            const menuH = 165;
            const x = Math.min(e.clientX, Math.max(8, window.innerWidth - menuW - 8));
            const y = Math.min(e.clientY, Math.max(8, window.innerHeight - 44 - menuH - 8));
            setDesktopContextMenu({ x, y });
          }}
          className="no-print relative z-10 h-full w-full overflow-hidden"
        >
          {/* Drop-target snap preview while dragging an app icon */}
          {draggingIcon && (
            <div
              aria-hidden="true"
              style={{
                left:
                  DESKTOP_GRID_ORIGIN_X +
                  draggingIcon.snapCol * DESKTOP_GRID_CELL_W,
                top:
                  DESKTOP_GRID_ORIGIN_Y +
                  draggingIcon.snapRow * DESKTOP_GRID_CELL_H,
              }}
              className="pointer-events-none absolute z-[5] w-[76px] h-[78px] rounded-xl border border-dashed border-white/40 bg-white/[0.08] transition-[left,top] duration-100"
            />
          )}

          {/* All Draggable Desktop Icons */}
          {visibleShortcuts.map(renderDesktopShortcut)}

          {/* Desktop Right-Click Context Menu */}
          {desktopContextMenu && (
            <div
              style={{
                left: desktopContextMenu.x,
                top: desktopContextMenu.y,
              }}
              onClick={(e) => e.stopPropagation()}
              className="fixed z-40 w-52 rounded-xl bg-[#0d101c]/95 backdrop-blur-2xl border border-white/14 shadow-2xl p-1.5 text-white space-y-0.5"
            >
              <button
                type="button"
                onClick={handleResetDesktopIcons}
                className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.09] text-xs text-white/90 flex items-center gap-2 cursor-pointer transition-colors text-left"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
                <span>Riordina icone desktop</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const keys = Object.keys(WALLPAPER_META) as WallpaperTheme[];
                  const nextIdx = (keys.indexOf(wallpaper) + 1) % keys.length;
                  setWallpaper(keys[nextIdx]);
                  setDesktopContextMenu(null);
                }}
                className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.09] text-xs text-white/90 flex items-center gap-2 cursor-pointer transition-colors text-left"
              >
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>Cambia sfondo</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWidgetPanel((p) => !p);
                  setDesktopContextMenu(null);
                }}
                className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.09] text-xs text-white/90 flex items-center gap-2 cursor-pointer transition-colors text-left"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {showWidgetPanel ? 'Nascondi riepilogo' : 'Mostra riepilogo'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDesktopContextMenu(null);
                  onOpenNewLoadModal();
                }}
                className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.09] text-xs text-white/90 flex items-center gap-2 cursor-pointer transition-colors text-left"
              >
                <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
                <span>Nuova commessa</span>
              </button>
            </div>
          )}

          {/* Optional Commessa Status Widget (Hidden by default for ultra-clean desktop) */}
          {showWidgetPanel && (
            <aside className="absolute top-4 right-4 z-20 w-full max-w-[280px] shrink-0 hidden md:block">
              <div className="rounded-2xl bg-[#0d101c]/82 backdrop-blur-2xl border border-white/12 p-4 text-white shadow-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-indigo-400" />
                    <span className="text-[11px] font-bold tracking-wide text-white/90">
                      Stato Commessa
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-semibold text-indigo-300 tabular-nums">
                      {activeLoad.code}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowWidgetPanel(false)}
                      className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white cursor-pointer"
                      title="Nascondi pannello"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Portata Mezzo */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-white/65">Portata Mezzo</span>
                    <span className="font-mono font-semibold text-white tabular-nums">
                      {summary.totalGrossWeightKg.toFixed(0)} /{' '}
                      {activeLoad.vehicleMaxWeightKg} kg ({weightPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${weightPercent}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${
                        weightPercent > 100
                          ? 'bg-rose-500'
                          : weightPercent > 85
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                  </div>
                </div>

                {/* Metriche Rapide */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => openApp('pallet_weights')}
                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[10px] text-white/55 font-medium">
                      Bancali
                    </div>
                    <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
                      {summary.totalPallets}{' '}
                      <span className="text-[10px] text-emerald-400 font-normal">
                        ({summary.wrappedPallets} film)
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openApp('tree')}
                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[10px] text-white/55 font-medium">
                      Scatoloni
                    </div>
                    <div className="text-sm font-bold font-mono text-white mt-0.5 tabular-nums">
                      {summary.totalBoxes}{' '}
                      <span className="text-[10px] text-sky-400 font-normal">
                        colli
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openApp('painting_tags')}
                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[10px] text-white/55 font-medium">
                      Verniciatura
                    </div>
                    <div className="text-sm font-bold font-mono text-amber-300 mt-0.5 tabular-nums">
                      {activeLoad.finishingTags?.length || 0}{' '}
                      <span className="text-[10px] text-white/50 font-normal">
                        cartelli
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openApp('checklist')}
                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[10px] text-white/55 font-medium">
                      Spunta Merce
                    </div>
                    <div className="text-sm font-bold font-mono text-emerald-300 mt-0.5 tabular-nums">
                      {summary.checklistCompletionPercent}%
                    </div>
                  </button>
                </div>

                {/* Azioni File */}
                <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={onSaveToFolder}
                    className="py-1.5 px-2 rounded-lg bg-white/[0.07] hover:bg-white/[0.13] text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <FolderDown className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Salva JSON</span>
                  </button>
                  <label className="py-1.5 px-2 rounded-lg bg-white/[0.07] hover:bg-white/[0.13] text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-sky-400" />
                    <span>Importa</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={onImportJSON}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </aside>
          )}
        </div>

        {/* Transient Floating Status Notice Toast */}
        {statusNotice && (
          <div className="no-print fixed bottom-14 left-1/2 -translate-x-1/2 z-[75] flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#0d101c]/95 backdrop-blur-xl border border-emerald-400/30 text-emerald-200 text-xs font-medium shadow-2xl">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[320px]">{statusNotice}</span>
          </div>
        )}

        {/* ===================================================================
            2. FINESTRE APPLICAZIONI DESKTOP (SOPRA LA BARRA INFERIORE)
        =================================================================== */}
        {windows.map((win) => {
          if (win.minimized) return null;
          const appDef = DESKTOP_MAIN_APPS.find((a) => a.id === win.id);
          if (!appDef) return null;
          const Icon = appDef.icon;
          const isFocused = topVisibleWindowId === win.id;
          const activeSubAppDef =
            win.id === 'caricostudio' && caricoStudioSubApp !== 'home'
              ? CARICOSTUDIO_SUB_APPS.find((s) => s.id === caricoStudioSubApp)
              : null;

          let positionStyle: React.CSSProperties = {};
          let containerClasses =
            'fixed flex flex-col bg-slate-100 overflow-hidden transition-shadow ';

          if (win.snap === 'maximized') {
            positionStyle = {
              top: 0,
              left: 0,
              right: 0,
              bottom: 44,
              zIndex: win.zIndex,
            };
            containerClasses += 'rounded-none border-0 shadow-2xl';
          } else if (win.snap === 'left') {
            positionStyle = {
              top: 0,
              left: 0,
              width: '50vw',
              bottom: 44,
              zIndex: win.zIndex,
            };
            containerClasses +=
              'rounded-none border-r border-white/15 shadow-2xl';
          } else if (win.snap === 'right') {
            positionStyle = {
              top: 0,
              left: '50vw',
              width: '50vw',
              bottom: 44,
              zIndex: win.zIndex,
            };
            containerClasses +=
              'rounded-none border-l border-white/15 shadow-2xl';
          } else {
            positionStyle = {
              top: win.y,
              left: win.x,
              width: win.width,
              height: win.height,
              zIndex: win.zIndex,
            };
            containerClasses += `rounded-xl border ${
              isFocused
                ? 'border-white/20 shadow-[0_28px_80px_rgba(0,0,0,0.65)]'
                : 'border-white/10 shadow-xl opacity-96'
            }`;
          }

          return (
            <div
              key={win.id}
              style={positionStyle}
              onMouseDown={() => {
                if (!isFocused) focusWindow(win.id);
              }}
              className={containerClasses}
            >
              {/* Titlebar Finestra Obsidian */}
              <div
                onMouseDown={(e) => {
                  if (win.snap !== 'floating') return;
                  if ((e.target as HTMLElement).closest('button')) return;
                  dragRef.current = {
                    appId: win.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    origX: win.x,
                    origY: win.y,
                  };
                }}
                onDoubleClick={() =>
                  setWindowSnap(
                    win.id,
                    win.snap === 'maximized' ? 'floating' : 'maximized'
                  )
                }
                className={`no-print h-10 px-3.5 flex items-center justify-between gap-3 shrink-0 select-none border-b border-white/[0.08] ${
                  isFocused
                    ? 'bg-[#0d101b] text-white'
                    : 'bg-[#151927] text-slate-300'
                } ${win.snap === 'floating' ? 'cursor-move' : ''}`}
              >
                {/* Left: App Icon + Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md ${appDef.iconBg} flex items-center justify-center text-white shadow-xs shrink-0`}
                  >
                    <Icon className="w-3 h-3" />
                  </div>
                  <span className="text-xs font-semibold tracking-tight truncate">
                    {activeSubAppDef
                      ? `CaricoStudio — ${activeSubAppDef.title}`
                      : appDef.title}
                  </span>
                  {win.id === 'caricostudio' && (
                    <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.07] text-[10px] font-mono font-medium text-indigo-300 border border-white/10 shrink-0 tabular-nums">
                      {activeLoad.code} · {activeLoad.title}
                    </span>
                  )}
                </div>

                {/* Right: Window Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={minimizeAllToDesktop}
                    className="px-2 py-1 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-[10px] font-semibold text-white/80 hover:text-white flex items-center gap-1 mr-1 cursor-pointer transition-colors"
                    title="Torna alla Scrivania"
                  >
                    <Monitor className="w-3 h-3" />
                    <span className="hidden sm:inline">Scrivania</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWindowSnap(win.id, 'left')}
                    className={`p-1.5 rounded-md hover:bg-white/12 cursor-pointer transition-colors ${
                      win.snap === 'left' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'
                    }`}
                    title="Affianca a Sinistra (50%)"
                  >
                    <PanelLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setWindowSnap(win.id, 'right')}
                    className={`p-1.5 rounded-md hover:bg-white/12 cursor-pointer transition-colors ${
                      win.snap === 'right' ? 'bg-indigo-600 text-white' : 'text-white/60 hover:text-white'
                    }`}
                    title="Affianca a Destra (50%)"
                  >
                    <PanelRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setWindowSnap(
                        win.id,
                        win.snap === 'floating' ? 'maximized' : 'floating'
                      )
                    }
                    className="p-1.5 rounded-md hover:bg-white/12 text-white/60 hover:text-white cursor-pointer transition-colors"
                    title={
                      win.snap === 'floating'
                        ? 'Ingrandisci a tutto schermo'
                        : 'Ripristina finestra'
                    }
                  >
                    {win.snap === 'floating' ? (
                      <Maximize2 className="w-3.5 h-3.5" />
                    ) : (
                      <Minimize2 className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleMinimizeWindow(win.id)}
                    className="p-1.5 rounded-md hover:bg-white/12 text-white/60 hover:text-white cursor-pointer transition-colors"
                    title="Riduci nella barra inferiore"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => closeWindow(win.id)}
                    className="p-1.5 rounded-md hover:bg-rose-600 text-white/60 hover:text-white cursor-pointer transition-colors"
                    title="Chiudi finestra"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Barra Interna Sotto-App dentro CaricoStudio */}
              {win.id === 'caricostudio' && (
                <div className="no-print bg-white border-b border-slate-200 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  <button
                    type="button"
                    onClick={() => setCaricoStudioSubApp('home')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      caricoStudioSubApp === 'home'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {caricoStudioSubApp === 'home' ? (
                      <LayoutGrid className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronLeft className="w-3.5 h-3.5" />
                    )}
                    <span>App CaricoStudio</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

                  {CARICOSTUDIO_SUB_APPS.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = caricoStudioSubApp === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setCaricoStudioSubApp(sub.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          isSubActive
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <SubIcon className="w-3.5 h-3.5" />
                        <span>{sub.shortTitle}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Corpo Interno dell'App */}
              <div className="flex-1 overflow-hidden min-h-0 bg-slate-100">
                {win.id === 'stock_movements' ||
                win.id === 'commessa_photos' ||
                win.id === 'file_manager' ||
                win.id === 'warehouse_catalog' ||
                win.id === 'team_share' ||
                win.id === 'employer_hub' ||
                win.id === 'weather' ||
                win.id === 'clock' ||
                win.id === 'calendar' ||
                win.id === 'server_monitor' ||
                win.id === 'server_control' ? (
                  renderAppContent(win.id, (targetId) => openApp(targetId))
                ) : caricoStudioSubApp === 'home' ? (
                  /* HUB INTERNO DELLE APP DI CARICOSTUDIO */
                  <div className="h-full overflow-y-auto p-6 bg-slate-50 text-slate-900">
                    <div className="max-w-5xl mx-auto space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                        <div>
                          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                            Applicazioni CaricoStudio
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            Commessa attiva:{' '}
                            <strong className="text-slate-800">{activeLoad.code}</strong> ·{' '}
                            {activeLoad.title} · {summary.totalPallets} bancali ·{' '}
                            {summary.totalBoxes} scatole ·{' '}
                            {summary.totalGrossWeightKg.toFixed(0)} kg
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={tileTwoWindowsSideBySide}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Columns className="w-3.5 h-3.5 text-emerald-600" />
                          Affianca con Carico / Scarico
                        </button>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold text-slate-500 mb-3">
                          Moduli Operativi Spedizione
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                          {CARICOSTUDIO_SUB_APPS.map((sub) => {
                            const SubIcon = sub.icon;
                            const badge = sub.badgeText
                              ? sub.badgeText(activeLoad, summary)
                              : null;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => setCaricoStudioSubApp(sub.id)}
                                className="group p-4 rounded-xl bg-white hover:bg-indigo-50/40 border border-slate-200 hover:border-indigo-400 flex flex-col items-start text-left gap-2.5 transition-all cursor-pointer"
                              >
                                <div className="w-full flex items-center justify-between gap-2">
                                  <div
                                    className={`w-11 h-11 rounded-[12px] ${sub.iconBg} flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform`}
                                  >
                                    <SubIcon className="w-5 h-5" />
                                  </div>
                                  {badge && (
                                    <span className="font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
                                      {badge}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900">
                                    {sub.shortTitle}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                                    {sub.subtitle}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <h3 className="text-xs font-semibold text-slate-500 mb-3">
                          Strumenti Rapidi &amp; Stampe
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <button
                            type="button"
                            onClick={onOpenPrintModal}
                            className="p-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-3 text-left cursor-pointer transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg bg-slate-900 text-sky-400 flex items-center justify-center shrink-0">
                              <Printer className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                Centro Stampe
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                Etichette &amp; PDF
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onOpenKitModal(activeLoad.pallets[0]?.id || null)
                            }
                            className="p-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-3 text-left cursor-pointer transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                              <CopyPlus className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                Genera Kit
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                Kit multi-scatola
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={onOpenPdfTranslator}
                            className="p-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-3 text-left cursor-pointer transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                              <Languages className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                Traduttore PDF
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                Packing list estero
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={onSaveToFolder}
                            className="p-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-3 text-left cursor-pointer transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <FolderDown className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                Salva su PC
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                Backup JSON commessa
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : caricoStudioSubApp === 'commesse' ? (
                  <div className="h-full p-3.5 overflow-hidden">
                    <CommesseFileStation
                      loads={loads}
                      activeLoad={activeLoad}
                      summary={summary}
                      onSelectLoad={onSelectLoad}
                      onOpenNewLoadModal={onOpenNewLoadModal}
                      onDuplicateLoad={onDuplicateLoad}
                      onUpdateProjectName={onUpdateProjectName}
                      onClearCurrentLoad={onClearCurrentLoad}
                      onSaveToFolder={onSaveToFolder}
                      onImportJSON={onImportJSON}
                      onExportCSV={onExportCSV}
                      onOpenPrintModal={onOpenPrintModal}
                      onOpenApp={(targetId) => openApp(targetId)}
                    />
                  </div>
                ) : (
                  <div className="h-full p-3.5 overflow-hidden">
                    {renderAppContent(caricoStudioSubApp, (targetId) =>
                      openApp(targetId)
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ===================================================================
            3. START MENU POPOVER (ANCORATO IN BASSO A SINISTRA)
        =================================================================== */}
        {showStartMenu && (
          <>
            <div
              className="no-print fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
              onClick={() => setShowStartMenu(false)}
            />
            <div className="no-print fixed bottom-13 left-3 z-50 w-[92vw] max-w-3xl max-h-[82vh] overflow-y-auto rounded-2xl bg-[#0d101c]/95 backdrop-blur-2xl border border-white/12 shadow-[0_24px_70px_rgba(0,0,0,0.75)] p-5 text-white">
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white">
                    Menu Applicazioni
                  </h2>
                  <p className="text-[11px] text-white/55 mt-0.5">
                    Commessa attiva:{' '}
                    <span className="font-mono text-indigo-300">
                      {activeLoad.code}
                    </span>{' '}
                    · {activeLoad.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStartMenu(false)}
                  className="p-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* App Principali */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 py-4 border-b border-white/10">
                {visibleMainApps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        if (app.id === 'caricostudio') {
                          setCaricoStudioSubApp('home');
                          openDesktopWindow('caricostudio');
                        } else {
                          openDesktopWindow(app.id);
                        }
                      }}
                      className="p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] flex items-center gap-3 text-left transition-all cursor-pointer group"
                    >
                      <div
                        className={`w-11 h-11 rounded-[12px] ${app.iconBg} flex items-center justify-center text-white shadow-md ring-1 ring-inset ring-white/20 shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">
                          {app.shortTitle}
                        </div>
                        <div className="text-[11px] text-white/55 line-clamp-1 mt-0.5">
                          {app.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sotto-App CaricoStudio */}
              <div className="py-4">
                <div className="text-[11px] font-semibold text-white/50 mb-2.5">
                  Moduli interni CaricoStudio
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CARICOSTUDIO_SUB_APPS.map((app) => {
                    const Icon = app.icon;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => openApp(app.id)}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.07] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                      >
                        <div
                          className={`w-8 h-8 rounded-[9px] ${app.iconBg} flex items-center justify-center text-white shadow-xs shrink-0`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-xs font-medium text-white/90 truncate">
                          {app.shortTitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={tileTwoWindowsSideBySide}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Columns className="w-3.5 h-3.5" />
                    <span>Affianca 2 App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartMenu(false);
                      onOpenPdfDirect();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    <span>PDF Materiali</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartMenu(false);
                      onOpenPrintModal();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Stampe</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowStartMenu(false);
                    onOpenNewLoadModal();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Nuova Commessa</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===================================================================
            4. COMMESSA QUICK SWITCHER POPOVER (BASSO DESTRA)
        =================================================================== */}
        {showCommessaMenu && (
          <>
            <div
              className="no-print fixed inset-0 z-40"
              onClick={() => setShowCommessaMenu(false)}
            />
            <div className="no-print fixed bottom-13 right-28 z-50 w-72 rounded-2xl bg-[#0d101c]/95 backdrop-blur-2xl border border-white/12 shadow-2xl p-3 text-white">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-white/10">
                <span className="text-[11px] font-semibold text-white/65">
                  Commessa Attiva
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowCommessaMenu(false);
                    onOpenNewLoadModal();
                  }}
                  className="px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>Nuova</span>
                </button>
              </div>
              <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
                {loads.map((l, idx) => {
                  const isActive = l.id === activeLoad.id;
                  return (
                    <button
                      key={`${l.id}-${idx}`}
                      type="button"
                      onClick={() => {
                        onSelectLoad(l.id);
                        setShowCommessaMenu(false);
                      }}
                      className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-indigo-600/85 text-white'
                          : 'hover:bg-white/[0.08] text-white/80'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-bold truncate tabular-nums">
                          {l.code}
                        </div>
                        <div className="text-[11px] text-white/65 truncate">
                          {l.title}
                        </div>
                      </div>
                      {isActive && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ===================================================================
            5. ACCOUNT & SISTEMA POPOVER (BASSO DESTRA SU AVATAR CIRCOLARE)
        =================================================================== */}
        {showAccountMenu && (
          <>
            <div
              className="no-print fixed inset-0 z-40"
              onClick={() => setShowAccountMenu(false)}
            />
            <div className="no-print fixed bottom-13 right-3 z-50 w-72 rounded-2xl bg-[#0d101c]/95 backdrop-blur-2xl border border-white/12 shadow-2xl p-3.5 text-white space-y-3">
              {/* Profilo Utente */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                <div
                  className={`w-9 h-9 rounded-full font-bold text-sm flex items-center justify-center shrink-0 ${
                    isEmployer
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-indigo-500 text-white'
                  }`}
                >
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                    <span className="truncate">{currentUser.name}</span>
                    {isEmployer && (
                      <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] text-white/55 truncate">
                    {currentUser.email}
                  </div>
                  <div
                    className={`text-[10px] font-semibold truncate mt-0.5 ${
                      isEmployer ? 'text-amber-300' : 'text-indigo-300'
                    }`}
                  >
                    {isEmployer ? 'Datore di Lavoro · Direzione' : 'Operatore'}
                    {currentUser.company ? ` · ${currentUser.company}` : ''}
                  </div>
                </div>
              </div>

              {/* Azioni Rapide Sistema */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    onOpenNetworkSyncModal();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.08] text-xs text-white/85 flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sincronizzazione Rete</span>
                  </span>
                  <span className="text-[10px] font-mono text-white/55">
                    {isRealtimeConnected
                      ? activeUsersCount > 1
                        ? `${activeUsersCount} disp.`
                        : 'Attiva'
                      : 'Locale'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    onOpenPdfDirect();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.08] text-xs text-white/85 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>PDF Materiali Commessa</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    onOpenPdfTranslator();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.08] text-xs text-white/85 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Languages className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Traduttore PDF Estero</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    onSaveToFolder();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.08] text-xs text-white/85 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <FolderDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Esporta Backup JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetDesktopIcons}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.08] text-xs text-white/85 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Riordina Icone Desktop</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    onForceReload();
                  }}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.08] text-xs text-white/85 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-white/60" />
                  <span>Aggiorna Sistema</span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    onLogout();
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Esci dall&apos;account</span>
                </button>
              </div>
            </div>
          </>
        )}

        {/* ===================================================================
            5B. CENTRO NOTIFICHE POPOVER (MESSAGGI, FILE, SOTTO SCORTA, MOVIMENTI, CALENDARIO)
        =================================================================== */}
        <NotificationCenter
          isOpen={showNotifications}
          notifications={notifications}
          onClose={() => setShowNotifications(false)}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onDismiss={onDismissNotification}
          onOpenApp={(appId) => openApp(appId)}
        />
      </div>

      {/* =====================================================================
          6. BARRA INFERIORE MINIMAL OBSIDIAN (ESATTAMENTE COME DA RIFERIMENTO)
      ===================================================================== */}
      <footer className="no-print h-11 bg-[#090b12]/95 backdrop-blur-2xl border-t border-white/[0.08] px-2.5 flex items-center justify-between gap-2 z-50 text-white shrink-0">
        {/* Bottom-Left: Minimal 4-Square Start Button + Open Window Tabs */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setShowAccountMenu(false);
              setShowCommessaMenu(false);
              setShowNotifications(false);
              setShowStartMenu((prev) => !prev);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
              showStartMenu
                ? 'bg-white/15 text-white'
                : 'text-white/75 hover:bg-white/[0.09] hover:text-white'
            }`}
            title="Menu Applicazioni"
            aria-label="Menu Applicazioni"
          >
            <LayoutGrid className="w-4 h-4 stroke-[1.8]" />
          </button>

          {windows.length > 0 && (
            <div className="h-4 w-px bg-white/10 mx-0.5 shrink-0" />
          )}

          {windows.map((win) => {
            const appDef = DESKTOP_MAIN_APPS.find((a) => a.id === win.id);
            if (!appDef) return null;
            const Icon = appDef.icon;
            const isTop = topVisibleWindowId === win.id && !win.minimized;
            const activeSubDef =
              win.id === 'caricostudio' && caricoStudioSubApp !== 'home'
                ? CARICOSTUDIO_SUB_APPS.find((s) => s.id === caricoStudioSubApp)
                : null;
            return (
              <div
                key={win.id}
                className={`group relative flex items-center gap-1.5 h-8 pl-2 pr-1.5 rounded-lg text-xs transition-colors shrink-0 ${
                  isTop
                    ? 'bg-white/[0.12] text-white font-semibold'
                    : win.minimized
                    ? 'text-white/45 hover:bg-white/[0.07] hover:text-white/85'
                    : 'bg-white/[0.06] text-white/80 hover:bg-white/[0.1]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (isTop) {
                      toggleMinimizeWindow(win.id);
                    } else {
                      focusWindow(win.id);
                    }
                  }}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <div
                    className={`w-4 h-4 rounded-[4px] flex items-center justify-center ${appDef.iconBg} text-white`}
                  >
                    <Icon className="w-2.5 h-2.5" />
                  </div>
                  <span className="truncate max-w-[155px]">
                    {activeSubDef
                      ? `${appDef.shortTitle} · ${activeSubDef.shortTitle}`
                      : appDef.shortTitle}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => closeWindow(win.id)}
                  className="p-0.5 rounded hover:bg-white/15 text-white/40 hover:text-white transition-colors cursor-pointer"
                  title={`Chiudi ${appDef.shortTitle}`}
                >
                  <X className="w-3 h-3" />
                </button>
                {isTop && (
                  <span className="absolute bottom-0.5 left-2.5 right-2.5 h-[2px] rounded-full bg-indigo-400" />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom-Right: Quiet Tray Icons + Stacked Time/Date + Circular User Avatar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Quiet Commessa Trigger */}
          <button
            type="button"
            onClick={() => {
              setShowStartMenu(false);
              setShowAccountMenu(false);
              setShowNotifications(false);
              setShowCommessaMenu((prev) => !prev);
            }}
            className={`hidden sm:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-mono transition-colors cursor-pointer tabular-nums ${
              showCommessaMenu
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/[0.08] hover:text-white'
            }`}
            title={`Commessa attiva: ${activeLoad.code} — ${activeLoad.title}`}
          >
            <span className="truncate max-w-[110px]">{activeLoad.code}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Affianca 2 App */}
          <button
            type="button"
            onClick={tileTwoWindowsSideBySide}
            className="w-7 h-7 rounded-md text-white/50 hover:text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
            title="Affianca CaricoStudio + Carico/Scarico"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>

          {/* Widget Toggle */}
          <button
            type="button"
            onClick={() => setShowWidgetPanel((p) => !p)}
            className={`w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
              showWidgetPanel
                ? 'bg-white/15 text-white'
                : 'text-white/50 hover:text-white hover:bg-white/[0.08]'
            }`}
            title="Mostra/Nascondi Riepilogo Commessa"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          {/* Wallpaper Switcher */}
          <button
            type="button"
            onClick={() => {
              const keys = Object.keys(WALLPAPER_META) as WallpaperTheme[];
              const nextIdx = (keys.indexOf(wallpaper) + 1) % keys.length;
              setWallpaper(keys[nextIdx]);
            }}
            className="w-7 h-7 rounded-md text-white/50 hover:text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
            title={`Cambia Sfondo (${wallpaperInfo.name})`}
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* Guida Rapida */}
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="w-7 h-7 rounded-md text-white/50 hover:text-white hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
              title="Apri guida rapida"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Stacked Time & Date (exact screenshot typography & alignment) */}
          <button
            type="button"
            onClick={minimizeAllToDesktop}
            className="px-1.5 py-0.5 rounded-md hover:bg-white/[0.08] flex flex-col items-end justify-center leading-none cursor-pointer transition-colors"
            title="Mostra Scrivania"
          >
            <span className="text-[11px] font-semibold text-white/95 tabular-nums leading-[1.15]">
              {clockText}
            </span>
            <span className="text-[10px] text-white/50 tabular-nums leading-[1.15]">
              {dateText}
            </span>
          </button>

          {/* Direzione Quick Button for Employer + Team Share Quick Button */}
          {isEmployer && (
            <button
              type="button"
              onClick={() => openDesktopWindow('employer_hub', 'maximized')}
              className="hidden md:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 cursor-pointer transition-colors"
              title="Apri Portale Direzione"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Direzione</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openDesktopWindow('team_share')}
            className="w-7 h-7 rounded-md text-sky-300/80 hover:text-sky-200 hover:bg-white/[0.08] flex items-center justify-center cursor-pointer transition-colors"
            title="Scambio File & Foto Team"
          >
            <Send className="w-3.5 h-3.5" />
          </button>

          {/* Centro Notifiche Bell Button with Unread Counter */}
          <button
            type="button"
            onClick={() => {
              setShowStartMenu(false);
              setShowCommessaMenu(false);
              setShowAccountMenu(false);
              setShowNotifications((prev) => !prev);
            }}
            className={`relative w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
              showNotifications
                ? 'bg-indigo-500/30 text-indigo-200 ring-1 ring-indigo-400/50'
                : unreadNotificationsCount > 0
                ? 'text-white hover:bg-white/[0.1]'
                : 'text-white/65 hover:text-white hover:bg-white/[0.08]'
            }`}
            title={
              unreadNotificationsCount > 0
                ? `Centro Notifiche (${unreadNotificationsCount} non lette)`
                : 'Centro Notifiche'
            }
            aria-label="Centro Notifiche"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-md ring-2 ring-[#090b12] tabular-nums">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </button>

          {/* Circular User Initial Avatar */}
          <button
            type="button"
            onClick={() => {
              setShowStartMenu(false);
              setShowCommessaMenu(false);
              setShowNotifications(false);
              setShowAccountMenu((prev) => !prev);
            }}
            className={`ml-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer shrink-0 ${
              isEmployer
                ? showAccountMenu
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200/70'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : showAccountMenu
                ? 'bg-indigo-400 text-white ring-2 ring-white/40'
                : 'bg-indigo-500 hover:bg-indigo-400 text-white'
            }`}
            title={`${currentUser.name} (${isEmployer ? 'Direzione' : 'Operatore'}) — Account & Esci`}
            aria-label="Menu account utente"
          >
            {userInitial}
          </button>
        </div>
      </footer>
    </div>
  );
};
