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
  DownloadCloud,
  Building2,
  ShoppingCart,
  Loader2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { AuthUser, CargoLoad } from '../types/warehouse';
import { DesktopAppIcon } from './DesktopAppIcon';
import { LoadSummary } from '../utils/calculations';
import { TutorialContextId } from '../data/appTutorials';
import { AuroraSilkWallpaper } from './AuroraSilkWallpaper';
import { NotificationCenter, UnifiedNotification } from './NotificationCenter';
import {
  WhatsNewShowcaseModal,
  WHATS_NEW_RELEASE_KEY,
} from './WhatsNewShowcaseModal';
import { ZeroClickCommessaResult } from '../utils/localAutoEngine';
import { usePrintLanguage } from '../utils/printLanguage';
import { PrintLanguageSelector } from './PrintLanguageSelector';

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
  | 'server_control'
  | 'software_updates'
  | 'ddt_documents'
  | 'crm_directory'
  | 'purchase_orders'
  | 'timini_print'
  | 'pallet_truck_scanner'
  | 'excel_checklist_merger'
  | 'ai_order_autopilot';

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
  | 'server_control'
  | 'software_updates'
  | 'ddt_documents'
  | 'crm_directory'
  | 'purchase_orders'
  | 'timini_print'
  | 'pallet_truck_scanner'
  | 'excel_checklist_merger'
  | 'ai_order_autopilot';

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
    iconBg: 'bg-gradient-to-b from-blue-600 to-blue-700',
    badgeText: (load) => load.code,
    icon: LayoutGrid,
  },
  {
    id: 'stock_movements',
    title: 'Carico & Scarico Materiale — Magazzino',
    shortTitle: 'Carico/Scarico',
    subtitle: 'Movimenti entrata/uscita, giacenze e prove imballo 101%',
    iconBg: 'bg-gradient-to-b from-emerald-600 to-emerald-700',
    badgeText: () => 'Magazzino',
    icon: Scan,
  },
  {
    id: 'commessa_photos',
    title: 'Foto Commesse — Fotocamera & Galleria',
    shortTitle: 'Foto',
    subtitle: 'Album fotografici per commessa con scatto rapido',
    iconBg: 'bg-gradient-to-b from-slate-700 to-slate-800',
    badgeText: () => 'Galleria',
    icon: Camera,
  },
  {
    id: 'warehouse_catalog',
    title: 'Magazzino — Articoli, Scorte, Barcode & Preferiti',
    shortTitle: 'Magazzino',
    subtitle: 'Cassa lettore barcode, SKU, scorta minima e Preferiti',
    iconBg: 'bg-gradient-to-b from-amber-600 to-amber-700',
    badgeText: () => 'Scorte',
    icon: Package,
  },
  {
    id: 'file_manager',
    title: 'File — Cartelle, PDF, Excel & Foto',
    shortTitle: 'File',
    subtitle: 'Archivio cartelle, PDF, Excel e documenti aziendali',
    iconBg: 'bg-gradient-to-b from-sky-600 to-sky-700',
    badgeText: () => 'Archivio',
    icon: FolderOpen,
  },
  {
    id: 'team_share',
    title: 'Scambio Team — Invio File & Foto tra Utenti',
    shortTitle: 'Scambio Team',
    subtitle: 'Scambio file, PDF e foto con colleghi e Direzione',
    iconBg: 'bg-gradient-to-b from-cyan-600 to-sky-700',
    badgeText: () => 'Team',
    icon: Send,
  },
  {
    id: 'employer_hub',
    title: 'Portale Direzione — Profili, Commesse e Movimenti',
    shortTitle: 'Direzione Team',
    subtitle: 'Controllo centralizzato profili, commesse e movimentazioni',
    iconBg: 'bg-gradient-to-b from-amber-500 to-amber-700',
    badgeText: () => 'Direzione',
    icon: Crown,
  },
  {
    id: 'weather',
    title: 'Meteo — Previsioni Live Orarie e 7 Giorni',
    shortTitle: 'Meteo',
    subtitle: 'Temperatura live, vento, pioggia e previsioni 7 giorni',
    iconBg: 'bg-gradient-to-b from-sky-500 to-blue-600',
    badgeText: () => 'Live',
    icon: CloudSun,
  },
  {
    id: 'clock',
    title: 'Orologio — Sveglie, Timer, Cronometro & Fusi Orari',
    shortTitle: 'Orologio',
    subtitle: 'Fusi orari, sveglie sonore, timer e cronometro',
    iconBg: 'bg-gradient-to-b from-slate-600 to-slate-800',
    badgeText: () => 'Ora',
    icon: ClockIcon,
  },
  {
    id: 'calendar',
    title: 'Calendario — Appunti, Appuntamenti & Condivisi',
    shortTitle: 'Calendario',
    subtitle: 'Appunti giornalieri, scadenze e calendari di reparto',
    iconBg: 'bg-gradient-to-b from-rose-600 to-rose-700',
    badgeText: () => 'Condiviso',
    icon: CalendarIcon,
  },
  {
    id: 'server_monitor',
    title: 'Monitor Risorse — CPU, RAM, Dischi & Rete Server',
    shortTitle: 'Monitor Server',
    subtitle: 'Telemetria hardware live del server e rete LAN',
    iconBg: 'bg-gradient-to-b from-teal-600 to-emerald-700',
    badgeText: () => 'HW Live',
    icon: Cpu,
  },
  {
    id: 'server_control',
    title: 'Sistema & ISO — METATRON Server OS & Backup',
    shortTitle: 'Sistema & ISO',
    subtitle: 'Backup automatici, snapshot, sessioni e installer',
    iconBg: 'bg-gradient-to-b from-slate-700 to-slate-900',
    badgeText: () => 'OS',
    icon: Server,
  },
  {
    id: 'software_updates',
    title: 'Aggiornamenti — Controllo Versioni & Riavvio Sicuro',
    shortTitle: 'Aggiornamenti',
    subtitle: 'Nuove release METATRON con protezione dati garantita',
    iconBg: 'bg-gradient-to-b from-blue-600 to-indigo-700',
    badgeText: () => 'Update',
    icon: DownloadCloud,
  },
  {
    id: 'ddt_documents',
    title: 'DDT & Bolle — Documenti di Trasporto PDF & Firme',
    shortTitle: 'DDT & Bolle',
    subtitle: 'Documenti di trasporto A4 con numerazione e firme digitali',
    iconBg: 'bg-gradient-to-b from-blue-700 to-slate-900',
    badgeText: () => 'PDF A4',
    icon: FileText,
  },
  {
    id: 'crm_directory',
    title: 'Clienti & Fornitori — Anagrafica & Storico',
    shortTitle: 'Clienti & Forn.',
    subtitle: 'Indirizzi di scarico, P.IVA, corrieri e storico commesse',
    iconBg: 'bg-gradient-to-b from-indigo-600 to-slate-800',
    badgeText: () => 'Rubrica',
    icon: Building2,
  },
  {
    id: 'purchase_orders',
    title: 'Ordini Fornitori — Riordino Scorte & Carico',
    shortTitle: 'Ordini Forn.',
    subtitle: 'Riordino automatico sotto scorta, PDF e carico magazzino',
    iconBg: 'bg-gradient-to-b from-emerald-700 to-teal-800',
    badgeText: () => 'Acquisti',
    icon: ShoppingCart,
  },
  {
    id: 'timini_print',
    title: 'TiMini Print — Stampante Etichette Termiche 57mm',
    shortTitle: 'TiMini Print',
    subtitle: 'Stampa etichette 57mm QR, Barcode e loghi via Bluetooth BLE',
    iconBg: 'bg-gradient-to-b from-slate-800 to-slate-950',
    badgeText: () => '57mm BLE',
    icon: Printer,
  },
  {
    id: 'pallet_truck_scanner',
    title: 'Scanner Carico Bancale & Camion — Pistola Barcode',
    shortTitle: 'Scanner Bancale',
    subtitle: 'Carico/scarico bancali e camion via barcode con auto-creazione a q.tà 0',
    iconBg: 'bg-gradient-to-b from-amber-500 to-slate-900',
    badgeText: () => 'Barcode',
    icon: Scan,
  },
  {
    id: 'excel_checklist_merger',
    title: 'Unione File Excel — Check-List Unificata Completa',
    shortTitle: 'Unione Excel',
    subtitle: 'Confronta più file Excel e riscrive automaticamente un’unica check-list',
    iconBg: 'bg-gradient-to-b from-emerald-600 to-emerald-900',
    badgeText: () => 'Excel',
    icon: FileSpreadsheet,
  },
  {
    id: 'ai_order_autopilot',
    title: 'Autopilota Preventivi & Commesse AI — WhatsApp / Email / PDF',
    shortTitle: 'Preventivi AI',
    subtitle: 'Da messaggio cliente o PDF a Preventivo, Scorte, Riordini e Piano Camion in 10s',
    iconBg: 'bg-gradient-to-b from-blue-800 to-slate-950',
    badgeText: () => 'AI 10s',
    icon: Sparkles,
  },
];

export const CARICOSTUDIO_SUB_APPS: SynologyAppDefinition[] = [
  {
    id: 'commesse',
    title: 'File Station — Gestione Commesse',
    shortTitle: 'Commesse',
    subtitle: 'Archivio commesse, clienti, salvataggio file PC e backup',
    category: 'documenti',
    gradient: 'from-sky-600 to-blue-700',
    iconBg: 'bg-gradient-to-b from-sky-600 to-blue-700',
    badgeText: (load) => load.code,
    icon: FolderOpen,
  },
  {
    id: 'painting_tags',
    title: 'Verniciatura, RAL & Zincatura (Studio Cartelli)',
    shortTitle: 'Verniciatura & RAL',
    subtitle: 'Layout cartello A4 in app, RAL, Zincato a caldo ed Elettrozincato',
    category: 'produzione',
    gradient: 'from-amber-600 to-orange-700',
    iconBg: 'bg-gradient-to-b from-amber-600 to-orange-700',
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
    gradient: 'from-emerald-600 to-teal-700',
    iconBg: 'bg-gradient-to-b from-emerald-600 to-teal-700',
    badgeText: (_, summary) => `${summary.totalPallets} Bancali`,
    icon: Scale,
  },
  {
    id: 'tree',
    title: 'Albero Bancali, Scatoloni & Fuori Scatola',
    shortTitle: 'Albero Bancali',
    subtitle: 'Gestione bancali, scatole su misura, sotto-scatole e foto',
    category: 'logistica',
    gradient: 'from-blue-600 to-blue-800',
    iconBg: 'bg-gradient-to-b from-blue-600 to-blue-800',
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
    gradient: 'from-sky-500 to-blue-700',
    iconBg: 'bg-gradient-to-b from-sky-500 to-blue-700',
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
    gradient: 'from-slate-700 to-slate-900',
    iconBg: 'bg-gradient-to-b from-slate-700 to-slate-900',
    badgeText: () => '3D CAD',
    icon: Box,
  },
  {
    id: 'truck',
    title: 'Piano di Carico Automezzo',
    shortTitle: 'Carico Camion',
    subtitle: 'Posizionamento bancali sul camion e bilanciamento pesi SX/DX',
    category: 'logistica',
    gradient: 'from-teal-600 to-emerald-700',
    iconBg: 'bg-gradient-to-b from-teal-600 to-emerald-700',
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
    gradient: 'from-rose-600 to-rose-800',
    iconBg: 'bg-gradient-to-b from-rose-600 to-rose-800',
    badgeText: (load) => `${load.signatures?.length || 0}/3 Firme`,
    icon: PenTool,
  },
  {
    id: 'qr_labels',
    title: 'Etichette A4 QR & Codice a Barre',
    shortTitle: 'Etichette QR A4',
    subtitle: 'Foglio A4 con tutte le etichette per bancali, scatole e pezzi con carico/scarico',
    category: 'documenti',
    gradient: 'from-slate-800 to-slate-950',
    iconBg: 'bg-gradient-to-b from-slate-800 to-slate-950',
    badgeText: (load) =>
      `${load.pallets.length + load.boxes.length + load.items.length} Etich.`,
    icon: QrCode,
  },
];

export const SYNOLOGY_APPS = CARICOSTUDIO_SUB_APPS;

type StudioCategoryId = 'logistica' | 'magazzino' | 'team' | 'sistema';

interface DesktopShortcutItem {
  id: string;
  label: string;
  title: string;
  shortDesc?: string;
  studioGroup?: StudioCategoryId;
  iconBg: string;
  icon: React.ComponentType<{ className?: string }>;
  windowId?: DesktopWindowId;
  action: 'open_caricostudio_home' | 'open_window' | 'open_subapp' | 'open_print';
  subAppId?: CaricoStudioSubAppId;
}

const STUDIO_CATEGORY_META: { id: StudioCategoryId; title: string; shortLabel: string }[] = [
  { id: 'logistica', title: 'Logistica & Spedizioni', shortLabel: 'Logistica' },
  { id: 'magazzino', title: 'Magazzino & Commerciale', shortLabel: 'Magazzino' },
  { id: 'team', title: 'Archivio & Collaborazione', shortLabel: 'Archivio & Team' },
  { id: 'sistema', title: 'Sistema & Strumenti', shortLabel: 'Sistema' },
];

const DESKTOP_COLUMN_1: DesktopShortcutItem[] = [
  {
    id: 'caricostudio',
    label: 'CaricoStudio',
    title: 'CaricoStudio — Suite Spedizioni & Logistica',
    shortDesc: 'Suite completa spedizioni',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-blue-600 to-blue-700',
    icon: LayoutGrid,
    windowId: 'caricostudio',
    action: 'open_caricostudio_home',
  },
  {
    id: 'commesse',
    label: 'Commesse',
    title: 'Gestione Commesse & Archivio Clienti',
    shortDesc: 'Cartelle e archivio lavori',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-sky-600 to-blue-700',
    icon: FolderOpen,
    windowId: 'caricostudio',
    subAppId: 'commesse',
    action: 'open_subapp',
  },
  {
    id: 'qr_labels',
    label: 'Etichette QR',
    title: 'Etichette A4 QR & Codice a Barre',
    shortDesc: 'Fogli A4 QR e barcode',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-teal-600 to-emerald-700',
    icon: QrCode,
    windowId: 'caricostudio',
    subAppId: 'qr_labels',
    action: 'open_subapp',
  },
  {
    id: 'file_manager',
    label: 'File',
    title: 'Archivio File — Cartelle, PDF, Excel e Foto',
    shortDesc: 'Cartelle, PDF ed Excel',
    studioGroup: 'team',
    iconBg: 'bg-gradient-to-b from-sky-600 to-sky-700',
    icon: FolderOpen,
    windowId: 'file_manager',
    action: 'open_window',
  },
  {
    id: 'stock_movements',
    label: 'Carico/Scarico',
    title: 'Carico & Scarico Materiale — Magazzino',
    shortDesc: 'Movimenti entrata e uscita',
    studioGroup: 'magazzino',
    iconBg: 'bg-gradient-to-b from-emerald-600 to-emerald-700',
    icon: Scan,
    windowId: 'stock_movements',
    action: 'open_window',
  },
  {
    id: 'commessa_photos',
    label: 'Foto',
    title: 'Foto Commesse — Fotocamera & Galleria',
    shortDesc: 'Galleria foto per commessa',
    studioGroup: 'team',
    iconBg: 'bg-gradient-to-b from-slate-700 to-slate-800',
    icon: Camera,
    windowId: 'commessa_photos',
    action: 'open_window',
  },
  {
    id: 'checklist',
    label: 'Check-list',
    title: 'Check-list Merci, Foto & Kit',
    shortDesc: 'Distinta e spunta articoli',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-rose-600 to-rose-700',
    icon: CheckSquare,
    windowId: 'caricostudio',
    subAppId: 'checklist',
    action: 'open_subapp',
  },
  {
    id: 'tree',
    label: 'Bancali',
    title: 'Albero Bancali, Scatoloni & Fuori Scatola',
    shortDesc: 'Albero bancali e scatole',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-emerald-600 to-teal-700',
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
    shortDesc: 'Catalogo scorte e lettore',
    studioGroup: 'magazzino',
    iconBg: 'bg-gradient-to-b from-amber-600 to-amber-700',
    icon: Package,
    windowId: 'warehouse_catalog',
    action: 'open_window',
  },
  {
    id: 'pallet_weights',
    label: 'Pesi Bancali',
    title: 'Pesi Bancali & Schede Collo A4',
    shortDesc: 'Bilancia e schede collo',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-blue-600 to-sky-700',
    icon: Scale,
    windowId: 'caricostudio',
    subAppId: 'pallet_weights',
    action: 'open_subapp',
  },
  {
    id: 'painting_tags',
    label: 'Verniciatura',
    title: 'Verniciatura, RAL & Zincatura (Cartelli A4)',
    shortDesc: 'Cartelli RAL e zincatura',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-amber-600 to-orange-700',
    icon: Paintbrush,
    windowId: 'caricostudio',
    subAppId: 'painting_tags',
    action: 'open_subapp',
  },
  {
    id: 'view3d',
    label: 'CAD 3D',
    title: 'CAD 3D Stivaggio Bancali & Raggi X',
    shortDesc: 'Stivaggio 3D e raggi X',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-slate-600 to-slate-800',
    icon: Layers,
    windowId: 'caricostudio',
    subAppId: 'view3d',
    action: 'open_subapp',
  },
  {
    id: 'print_center',
    label: 'Stampe',
    title: 'Centro Stampe Etichette e Distinte',
    shortDesc: 'Distinte e fogli A4',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-slate-700 to-slate-900',
    icon: Printer,
    action: 'open_print',
  },
  {
    id: 'team_share',
    label: 'Scambio Team',
    title: 'Scambio Team — Invia e ricevi file e foto tra colleghi',
    shortDesc: 'Invio file e foto team',
    studioGroup: 'team',
    iconBg: 'bg-gradient-to-b from-cyan-600 to-sky-700',
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
    shortDesc: 'Appunti e agenda team',
    studioGroup: 'team',
    iconBg: 'bg-gradient-to-b from-rose-600 to-rose-700',
    icon: CalendarIcon,
    windowId: 'calendar',
    action: 'open_window',
  },
  {
    id: 'weather',
    label: 'Meteo',
    title: 'Meteo — Previsioni live orarie e settimanali',
    shortDesc: 'Previsioni live 7 giorni',
    studioGroup: 'sistema',
    iconBg: 'bg-gradient-to-b from-sky-500 to-blue-600',
    icon: CloudSun,
    windowId: 'weather',
    action: 'open_window',
  },
  {
    id: 'clock',
    label: 'Orologio',
    title: 'Orologio — Fusi orari, Sveglie, Timer e Cronometro',
    shortDesc: 'Sveglie, timer e fusi',
    studioGroup: 'sistema',
    iconBg: 'bg-gradient-to-b from-slate-600 to-slate-800',
    icon: ClockIcon,
    windowId: 'clock',
    action: 'open_window',
  },
  {
    id: 'server_monitor',
    label: 'Monitor Server',
    title: 'Monitor Risorse Server — CPU, RAM, Dischi, Rete e Servizi',
    shortDesc: 'CPU, RAM e stato rete',
    studioGroup: 'sistema',
    iconBg: 'bg-gradient-to-b from-teal-600 to-emerald-700',
    icon: Cpu,
    windowId: 'server_monitor',
    action: 'open_window',
  },
  {
    id: 'server_control',
    label: 'Sistema & ISO',
    title: 'METATRON Server OS — Installer Linux, Generatore ISO USB, Backup e Log',
    shortDesc: 'Backup, ISO e sistema',
    studioGroup: 'sistema',
    iconBg: 'bg-gradient-to-b from-slate-700 to-slate-900',
    icon: Server,
    windowId: 'server_control',
    action: 'open_window',
  },
  {
    id: 'software_updates',
    label: 'Aggiornamenti',
    title: 'Aggiornamenti METATRON — Verifica, scarica e riavvia senza perdere i dati',
    shortDesc: 'Versioni e aggiornamenti',
    studioGroup: 'sistema',
    iconBg: 'bg-gradient-to-b from-blue-600 to-indigo-700',
    icon: DownloadCloud,
    windowId: 'software_updates',
    action: 'open_window',
  },
];

const DESKTOP_COLUMN_4: DesktopShortcutItem[] = [
  {
    id: 'ddt_documents',
    label: 'DDT & Bolle',
    title: 'DDT & Bolle di Trasporto — Generatore PDF A4 con numerazione e firme digitali',
    shortDesc: 'Bolle A4 e firme digitali',
    studioGroup: 'magazzino',
    iconBg: 'bg-gradient-to-b from-blue-700 to-slate-900',
    icon: FileText,
    windowId: 'ddt_documents',
    action: 'open_window',
  },
  {
    id: 'crm_directory',
    label: 'Clienti & Forn.',
    title: 'Anagrafica Clienti & Fornitori — Indirizzi, P.IVA, corrieri e storico',
    shortDesc: 'Rubrica e storico azienda',
    studioGroup: 'magazzino',
    iconBg: 'bg-gradient-to-b from-indigo-600 to-slate-800',
    icon: Building2,
    windowId: 'crm_directory',
    action: 'open_window',
  },
  {
    id: 'purchase_orders',
    label: 'Ordini Forn.',
    title: 'Ordini Fornitori & Riordino Automatico Scorte — PDF e carico rapido in magazzino',
    shortDesc: 'Riordino scorte e PDF',
    studioGroup: 'magazzino',
    iconBg: 'bg-gradient-to-b from-emerald-700 to-teal-800',
    icon: ShoppingCart,
    windowId: 'purchase_orders',
    action: 'open_window',
  },
  {
    id: 'timini_print',
    label: 'TiMini Print',
    title: 'TiMini Print — Stampante Etichette Termiche 57mm Bluetooth & USB',
    shortDesc: 'Etichette 57mm Bluetooth',
    studioGroup: 'magazzino',
    iconBg: 'bg-gradient-to-b from-slate-800 to-slate-950',
    icon: Printer,
    windowId: 'timini_print',
    action: 'open_window',
  },
  {
    id: 'pallet_truck_scanner',
    label: 'Scanner Bancale',
    title: 'Scanner Carico Bancale & Camion — Barcode scatole, camion e auto-creazione q.tà 0',
    shortDesc: 'Barcode bancali & camion',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-amber-500 to-slate-900',
    icon: Scan,
    windowId: 'pallet_truck_scanner',
    action: 'open_window',
  },
  {
    id: 'excel_checklist_merger',
    label: 'Unione Excel',
    title: 'Unione File Excel per Check-List — Confronta tutti gli Excel e riscrive la check-list unica',
    shortDesc: 'Unisci più Excel in 1',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-emerald-600 to-emerald-900',
    icon: FileSpreadsheet,
    windowId: 'excel_checklist_merger',
    action: 'open_window',
  },
  {
    id: 'ai_order_autopilot',
    label: 'Preventivi AI',
    title: 'Autopilota Preventivi & Commesse AI — Da WhatsApp, Email o PDF a Preventivo + Commessa + Camion in 10s',
    shortDesc: 'WhatsApp/PDF → Commessa',
    studioGroup: 'logistica',
    iconBg: 'bg-gradient-to-b from-blue-800 to-slate-950',
    icon: Sparkles,
    windowId: 'ai_order_autopilot',
    action: 'open_window',
  },
];

const EMPLOYER_ONLY_SHORTCUT: DesktopShortcutItem = {
  id: 'employer_hub',
  label: 'Direzione Team',
  title: 'Portale Direzione — Controllo profili, commesse e carichi/scarichi',
  shortDesc: 'Supervisione profili e lavori',
  studioGroup: 'team',
  iconBg: 'bg-gradient-to-b from-amber-500 to-amber-700',
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
      ...DESKTOP_COLUMN_4,
    ];
  }
  return [
    ...DESKTOP_COLUMN_1,
    ...DESKTOP_COLUMN_2,
    ...DESKTOP_COLUMN_3,
    ...DESKTOP_COLUMN_4,
  ];
}

interface DesktopGridPos {
  col: number;
  row: number;
}

const DESKTOP_GRID_ORIGIN_X = 24;
const DESKTOP_GRID_ORIGIN_Y = 22;
const DESKTOP_GRID_CELL_W = 94;
const DESKTOP_GRID_CELL_H = 96;

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
  DESKTOP_COLUMN_4.forEach((item, idx) => {
    map[item.id] = { col: 3, row: idx };
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
    <div className="h-full flex flex-col bg-[#F5F7FA] overflow-hidden rounded-xl border border-slate-200/90">
      {/* Toolbar pulita */}
      <div className="bg-white border-b border-slate-200/80 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewLoadModal}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Nuova Commessa</span>
          </button>

          <button
            type="button"
            onClick={onDuplicateLoad}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>Duplica</span>
          </button>

          <button
            type="button"
            onClick={onSaveToFolder}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <FolderDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Salva JSON</span>
          </button>

          <label className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap">
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Importa</span>
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
            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
        </div>

        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca commessa o cliente..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
          />
        </div>
      </div>

      {/* Main Split Body */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto min-h-0">
        {/* Left: Lista Commesse */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">
              Cartelle Commesse
            </span>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {filteredLoads.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-0.5">
            {filteredLoads.map((item) => {
              const isSelected = item.id === activeLoad.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectLoad(item.id)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white'
                      : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-white/15 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-semibold tabular-nums ${
                            isSelected ? 'text-blue-300' : 'text-slate-900'
                          }`}
                        >
                          {item.code}
                        </span>
                        <span className="text-xs font-medium truncate">
                          {item.title}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 truncate tabular-nums ${
                          isSelected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {item.client || 'Nessun cliente'} · {item.pallets.length} bancali ·{' '}
                        {item.boxes.length} scatole
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-slate-300' : 'text-slate-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Dettagli Commessa Attiva */}
        <div className="lg:col-span-7 space-y-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-slate-200/90 p-5 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">Commessa attiva</div>
                <h3 className="text-base font-semibold text-slate-900 mt-0.5 truncate">
                  <span className="font-mono">{activeLoad.code}</span> — {activeLoad.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClearCurrentLoad}
                className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Svuota</span>
              </button>
            </div>

            <form
              onSubmit={handleSaveRename}
              className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Codice
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Nome commessa
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Salva</span>
                </button>
              </div>
            </form>

            {/* Metriche Commessa (pulite e tabulari, senza box colorati) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border border-slate-200/80 rounded-xl bg-slate-50/50">
              <div className="px-4 py-3">
                <div className="text-xs text-slate-500">Articoli</div>
                <div className="text-lg font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
                  {summary.checkedItems}/{summary.totalItems}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs text-slate-500">Bancali · Scatole</div>
                <div className="text-lg font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
                  {summary.totalPallets} · {summary.totalBoxes}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs text-slate-500">Peso Lordo</div>
                <div className="text-lg font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
                  {summary.totalGrossWeightKg.toFixed(0)} kg
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="text-xs text-slate-500">Cartelli RAL</div>
                <div className="text-lg font-semibold font-mono text-slate-900 tabular-nums mt-0.5">
                  {activeLoad.finishingTags?.length || 0}
                </div>
              </div>
            </div>

            {/* Moduli CaricoStudio */}
            <div>
              <div className="text-xs font-medium text-slate-500 mb-2.5">
                Apri questa commessa nei moduli
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARICOSTUDIO_SUB_APPS.filter((a) => a.id !== 'commesse').map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => onOpenApp(app.id)}
                      className="p-2.5 rounded-xl border border-slate-200/90 hover:border-slate-300 bg-white hover:bg-slate-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg ${app.iconBg} text-white flex items-center justify-center shrink-0`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {app.shortTitle}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">Apri modulo</div>
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onOpenPrintModal}
                  className="p-2.5 rounded-xl border border-slate-900 bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/15 text-white flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">Centro Stampe</div>
                    <div className="text-[11px] text-slate-300 truncate">Etichette e PDF</div>
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
  onZeroClickFileDrop?: (
    file: File,
    onProgress: (pct: number, label: string) => void
  ) => Promise<ZeroClickCommessaResult>;
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
  onZeroClickFileDrop,
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
  const [showWhatsNewModal, setShowWhatsNewModal] = useState<boolean>(false);
  const [globalPrintLang, setGlobalPrintLang] = usePrintLanguage();
  const [liveNow, setLiveNow] = useState<Date>(() => new Date());

  // Nuova Commessa Zero-Click da file trascinato sul desktop (PDF / Excel / Foto)
  const zeroClickFileInputRef = useRef<HTMLInputElement | null>(null);
  const desktopFileDragCounterRef = useRef<number>(0);
  const [isDesktopFileDragging, setIsDesktopFileDragging] = useState(false);
  const [zeroClickBusy, setZeroClickBusy] = useState(false);
  const [zeroClickPct, setZeroClickPct] = useState(0);
  const [zeroClickStage, setZeroClickStage] = useState('');
  const [zeroClickError, setZeroClickError] = useState<string | null>(null);
  const [zeroClickResult, setZeroClickResult] =
    useState<ZeroClickCommessaResult | null>(null);

  const runZeroClickCommessaFile = async (file: File) => {
    if (!onZeroClickFileDrop) return;
    setZeroClickError(null);
    setZeroClickResult(null);
    setZeroClickBusy(true);
    setZeroClickPct(6);
    setZeroClickStage(`Lettura locale di "${file.name}"...`);
    try {
      const res = await onZeroClickFileDrop(file, (pct, lbl) => {
        setZeroClickPct(pct);
        setZeroClickStage(lbl);
      });
      setZeroClickResult(res);
    } catch (err) {
      setZeroClickError(
        err instanceof Error
          ? err.message
          : 'Impossibile creare la commessa da questo file.'
      );
    } finally {
      setZeroClickBusy(false);
    }
  };

  // Mostra l'avviso delle novità METATRON 2.0 in centro schermo al primo avvio dopo l'aggiornamento
  useEffect(() => {
    const storageKey = `${WHATS_NEW_RELEASE_KEY}_${currentUser.id}`;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        const timer = window.setTimeout(() => {
          setShowWhatsNewModal(true);
        }, 550);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // ignore storage errors
    }
  }, [currentUser.id]);

  const handleCloseWhatsNew = () => {
    setShowWhatsNewModal(false);
    try {
      localStorage.setItem(`${WHATS_NEW_RELEASE_KEY}_${currentUser.id}`, '1');
    } catch {
      // ignore
    }
  };
  const [desktopLayout, setDesktopLayout] = useState<'studio' | 'icons'>(() => {
    try {
      const saved = localStorage.getItem('metatron_desktop_layout_v2');
      if (saved === 'icons' || saved === 'studio') return saved;
    } catch {}
    return 'icons';
  });
  const [desktopCategory, setDesktopCategory] = useState<'all' | StudioCategoryId>('all');
  const [desktopSearch, setDesktopSearch] = useState<string>('');
  const [startMenuSearch, setStartMenuSearch] = useState<string>('');
  const desktopSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [clockText, setClockText] = useState<string>('');
  const [dateText, setDateText] = useState<string>('');
  const [longDateText, setLongDateText] = useState<string>('');
  const [greetingText, setGreetingText] = useState<string>('Buongiorno');

  const handleToggleDesktopLayout = (next?: 'studio' | 'icons') => {
    setDesktopLayout((prev) => {
      const resolved = next ?? (prev === 'studio' ? 'icons' : 'studio');
      try {
        localStorage.setItem('metatron_desktop_layout_v2', resolved);
      } catch {}
      return resolved;
    });
  };

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
      setLiveNow(now);
      setClockText(
        now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      );
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      setDateText(`${dd}/${mm}/${yyyy}`);
      setLongDateText(
        now.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      );
      const hr = now.getHours();
      setGreetingText(hr < 13 ? 'Buongiorno' : hr < 18 ? 'Buon pomeriggio' : 'Buonasera');
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);
    return () => clearInterval(timer);
  }, []);

  // Scorciatoia Ctrl+K / Cmd+K per ricerca rapida
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (desktopLayout === 'studio' && !windows.some((w) => !w.minimized)) {
          desktopSearchInputRef.current?.focus();
        } else {
          setShowAccountMenu(false);
          setShowCommessaMenu(false);
          setShowNotifications(false);
          setShowStartMenu((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [windows, desktopLayout]);

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
      appId === 'server_control' ||
      appId === 'software_updates' ||
      appId === 'ddt_documents' ||
      appId === 'crm_directory' ||
      appId === 'purchase_orders' ||
      appId === 'timini_print' ||
      appId === 'pallet_truck_scanner' ||
      appId === 'excel_checklist_merger' ||
      appId === 'ai_order_autopilot'
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

  const isLightWallpaper = false;
  const userInitial = (currentUser.name || currentUser.email || 'U')
    .trim()
    .charAt(0)
    .toUpperCase();

  const renderDesktopShortcut = (item: DesktopShortcutItem) => {
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
        className={`group absolute w-[86px] py-2 px-1 rounded-2xl flex flex-col items-center text-center gap-1.5 touch-none select-none focus:outline-none ${
          isDraggingThis
            ? 'z-30 scale-[1.07] opacity-95 cursor-grabbing bg-white/[0.15] backdrop-blur-md ring-1 ring-white/30 shadow-2xl'
            : isLightWallpaper
            ? 'z-10 transition-[left,top,transform,background-color,box-shadow] duration-150 cursor-grab hover:bg-white/60 hover:backdrop-blur-md hover:ring-1 hover:ring-slate-900/10 active:scale-[0.96]'
            : 'z-10 transition-[left,top,transform,background-color,box-shadow] duration-150 cursor-grab hover:bg-white/[0.09] hover:backdrop-blur-md hover:ring-1 hover:ring-white/[0.16] active:scale-[0.96]'
        }`}
      >
        <DesktopAppIcon
          id={item.id}
          size="xl"
          now={liveNow}
          className={`transition-transform duration-200 ease-out ${
            isDraggingThis
              ? 'scale-[1.04]'
              : 'group-hover:-translate-y-1 group-hover:scale-[1.06]'
          }`}
        />
        <span
          className={`text-[11.5px] font-medium leading-[1.2] tracking-[0.005em] max-w-[82px] line-clamp-2 ${
            isLightWallpaper
              ? 'text-slate-900'
              : 'text-white/95 drop-shadow-[0_1px_5px_rgba(0,0,0,0.95)]'
          }`}
        >
          {item.label}
        </span>
        {isWindowOpen && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_rgba(125,211,252,0.95)] -mt-0.5"
            aria-hidden="true"
          />
        )}
      </button>
    );
  };

  const firstName = (currentUser.name || currentUser.email || 'Utente')
    .trim()
    .split(/\s+/)[0];

  const normalizedDesktopQuery = desktopSearch.trim().toLowerCase();
  const filteredStudioShortcuts = visibleShortcuts.filter((item) => {
    if (desktopCategory !== 'all' && item.studioGroup !== desktopCategory) {
      return false;
    }
    if (!normalizedDesktopQuery) return true;
    return (
      item.label.toLowerCase().includes(normalizedDesktopQuery) ||
      item.title.toLowerCase().includes(normalizedDesktopQuery) ||
      (item.shortDesc || '').toLowerCase().includes(normalizedDesktopQuery)
    );
  });

  const matchingLoadsInSearch = normalizedDesktopQuery
    ? loads.filter(
        (ld) =>
          ld.code.toLowerCase().includes(normalizedDesktopQuery) ||
          ld.title.toLowerCase().includes(normalizedDesktopQuery) ||
          (ld.client || '').toLowerCase().includes(normalizedDesktopQuery)
      )
    : [];

  return (
    <div className="h-screen w-screen overflow-hidden relative select-none bg-[#060913] font-sans">
      {/* Sfondo unico Dolomiti al Tramonto */}
      <AuroraSilkWallpaper />

      {/* =====================================================================
          1. DESKTOP WORKSPACE (ICONE CLASSICHE O GRIGLIA REPARTI)
      ===================================================================== */}
      <div className="relative z-10 h-full w-full pb-[66px] overflow-hidden">
        {/* Desktop Surface (supporta drag & drop diretto di PDF/Excel/Foto per Commessa Zero-Click) */}
        <div
          ref={desktopAreaRef}
          onDragEnter={(e) => {
            if (!onZeroClickFileDrop) return;
            if (!e.dataTransfer?.types?.includes('Files')) return;
            if ((e.target as HTMLElement).closest('[data-window-shell="true"]')) return;
            e.preventDefault();
            desktopFileDragCounterRef.current += 1;
            setIsDesktopFileDragging(true);
          }}
          onDragOver={(e) => {
            if (!onZeroClickFileDrop) return;
            if (!e.dataTransfer?.types?.includes('Files')) return;
            if ((e.target as HTMLElement).closest('[data-window-shell="true"]')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            if (!onZeroClickFileDrop) return;
            if (!e.dataTransfer?.types?.includes('Files')) return;
            desktopFileDragCounterRef.current = Math.max(
              0,
              desktopFileDragCounterRef.current - 1
            );
            if (desktopFileDragCounterRef.current === 0) {
              setIsDesktopFileDragging(false);
            }
          }}
          onDrop={(e) => {
            if (!onZeroClickFileDrop) return;
            if (!e.dataTransfer?.files || e.dataTransfer.files.length === 0) return;
            if ((e.target as HTMLElement).closest('[data-window-shell="true"]')) return;
            e.preventDefault();
            desktopFileDragCounterRef.current = 0;
            setIsDesktopFileDragging(false);
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile) {
              void runZeroClickCommessaFile(droppedFile);
            }
          }}
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
            if ((e.target as HTMLElement).closest('button, aside, input')) return;
            e.preventDefault();
            closeAllPopovers();
            const menuW = 220;
            const menuH = 200;
            const x = Math.min(e.clientX, Math.max(8, window.innerWidth - menuW - 8));
            const y = Math.min(e.clientY, Math.max(8, window.innerHeight - 66 - menuH - 8));
            setDesktopContextMenu({ x, y });
          }}
          className="no-print relative h-full w-full overflow-hidden"
        >
          <input
            ref={zeroClickFileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.xlsm,.csv,.ods,.tsv,.txt,image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runZeroClickCommessaFile(f);
              e.target.value = '';
            }}
          />
          {desktopLayout === 'studio' ? (
            /* ===============================================================
               SCRIVANIA ORDINATA (STUDIO) — PULITA, STRUTTURATA, IMMEDIATA
            =============================================================== */
            <div className="h-full w-full overflow-y-auto">
              <div className="max-w-[1180px] mx-auto px-6 sm:px-10 py-7 sm:py-9 space-y-6">
                {/* Intestazione Ambientale + Orologio */}
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1">
                    <h1
                      className={`text-2xl sm:text-[28px] font-semibold tracking-tight leading-tight ${
                        isLightWallpaper ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {greetingText}, {firstName}
                    </h1>
                    <div
                      className={`flex flex-wrap items-center gap-2 text-xs ${
                        isLightWallpaper ? 'text-slate-600' : 'text-slate-300/80'
                      }`}
                    >
                      <span className="font-medium">METATRON</span>
                      <span aria-hidden="true">·</span>
                      <span>{currentUser.company || 'Suite Gestionale Logistica'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{loads.length} commesse in archivio</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-3xl sm:text-[34px] font-light font-mono tabular-nums tracking-tight leading-none ${
                        isLightWallpaper ? 'text-slate-900' : 'text-white/95'
                      }`}
                    >
                      {clockText}
                    </div>
                    <div
                      className={`text-xs capitalize mt-1 ${
                        isLightWallpaper ? 'text-slate-600' : 'text-slate-300/70'
                      }`}
                    >
                      {longDateText || dateText}
                    </div>
                  </div>
                </div>

                {/* Striscia Commessa Attiva (singolo livello, zero rumore) */}
                <div
                  className={`rounded-2xl border backdrop-blur-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 ${
                    isLightWallpaper
                      ? 'bg-white/80 border-slate-200/90 text-slate-900 shadow-xs'
                      : 'bg-white/[0.055] border-white/[0.09] text-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCommessaMenu((prev) => !prev);
                    }}
                    className="flex items-center gap-3 text-left min-w-0 group cursor-pointer"
                    title="Cambia commessa attiva"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isLightWallpaper
                          ? 'bg-slate-900 text-white'
                          : 'bg-white/[0.09] text-blue-300 border border-white/[0.08]'
                      }`}
                    >
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
                        <span className="font-mono tabular-nums">{activeLoad.code}</span>
                        <span className="opacity-40">·</span>
                        <span className="truncate max-w-[240px] sm:max-w-[300px]">
                          {activeLoad.title}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-55 group-hover:opacity-100 shrink-0 transition-opacity" />
                      </div>
                      <div
                        className={`text-xs truncate ${
                          isLightWallpaper ? 'text-slate-500' : 'text-slate-300/65'
                        }`}
                      >
                        {activeLoad.client || 'Cliente non impostato'}
                        {activeLoad.destination ? ` · ${activeLoad.destination}` : ''}
                      </div>
                    </div>
                  </button>

                  {/* 4 Metriche Tabulari Cliccabili */}
                  <div
                    className={`hidden lg:flex items-center divide-x text-xs ${
                      isLightWallpaper ? 'divide-slate-200' : 'divide-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => openApp('tree')}
                      className="px-4 text-left hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <div className={isLightWallpaper ? 'text-slate-500' : 'text-slate-400'}>
                        Bancali
                      </div>
                      <div className="font-mono font-semibold tabular-nums text-sm mt-0.5">
                        {summary.totalPallets}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openApp('tree')}
                      className="px-4 text-left hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <div className={isLightWallpaper ? 'text-slate-500' : 'text-slate-400'}>
                        Scatole
                      </div>
                      <div className="font-mono font-semibold tabular-nums text-sm mt-0.5">
                        {summary.totalBoxes}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openApp('pallet_weights')}
                      className="px-4 text-left hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <div className={isLightWallpaper ? 'text-slate-500' : 'text-slate-400'}>
                        Peso Lordo
                      </div>
                      <div className="font-mono font-semibold tabular-nums text-sm mt-0.5">
                        {summary.totalGrossWeightKg.toFixed(0)} kg
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => openApp('checklist')}
                      className="px-4 text-left hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <div className={isLightWallpaper ? 'text-slate-500' : 'text-slate-400'}>
                        Spunta
                      </div>
                      <div className="font-mono font-semibold tabular-nums text-sm mt-0.5">
                        {summary.checklistCompletionPercent}%
                      </div>
                    </button>
                  </div>

                  {/* Azioni Commessa */}
                  <div className="flex items-center gap-2 shrink-0">
                    {onZeroClickFileDrop && (
                      <button
                        type="button"
                        onClick={() => zeroClickFileInputRef.current?.click()}
                        title="Carica o trascina sul desktop un PDF, Excel o foto bolla per creare automaticamente la nuova commessa completa"
                        className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                          isLightWallpaper
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-950'
                            : 'bg-amber-400/18 hover:bg-amber-400/28 border border-amber-300/30 text-amber-100'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Da File</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onOpenNewLoadModal}
                      className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                        isLightWallpaper
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                          : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/90'
                      }`}
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Nuova</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCaricoStudioSubApp('home');
                        openDesktopWindow('caricostudio');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                        isLightWallpaper
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-950'
                      }`}
                    >
                      <span>Apri CaricoStudio</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Ricerca Rapida + Filtri Reparto */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                        isLightWallpaper ? 'text-slate-400' : 'text-slate-400'
                      }`}
                    />
                    <input
                      ref={desktopSearchInputRef}
                      type="text"
                      value={desktopSearch}
                      onChange={(e) => setDesktopSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && filteredStudioShortcuts.length > 0) {
                          handleShortcutClick(filteredStudioShortcuts[0]);
                          setDesktopSearch('');
                        } else if (e.key === 'Escape') {
                          setDesktopSearch('');
                        }
                      }}
                      placeholder="Cerca app, modulo o commessa... (Ctrl+K)"
                      className={`w-full pl-10 pr-9 py-2.5 text-xs rounded-xl border backdrop-blur-md transition-colors focus:outline-none ${
                        isLightWallpaper
                          ? 'bg-white/85 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-slate-400'
                          : 'bg-white/[0.06] border-white/[0.1] text-white placeholder:text-slate-400 focus:bg-white/[0.1] focus:border-white/25'
                      }`}
                    />
                    {desktopSearch && (
                      <button
                        type="button"
                        onClick={() => setDesktopSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                        aria-label="Cancella ricerca"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filtri Categoria */}
                  <div
                    className={`flex items-center gap-1 p-1 rounded-xl border backdrop-blur-md overflow-x-auto no-scrollbar ${
                      isLightWallpaper
                        ? 'bg-white/75 border-slate-200/90'
                        : 'bg-white/[0.05] border-white/[0.08]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDesktopCategory('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                        desktopCategory === 'all'
                          ? isLightWallpaper
                            ? 'bg-slate-900 text-white'
                            : 'bg-white text-slate-950'
                          : isLightWallpaper
                          ? 'text-slate-600 hover:text-slate-900'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Tutte
                    </button>
                    {STUDIO_CATEGORY_META.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setDesktopCategory(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          desktopCategory === cat.id
                            ? isLightWallpaper
                              ? 'bg-slate-900 text-white'
                              : 'bg-white text-slate-950'
                            : isLightWallpaper
                            ? 'text-slate-600 hover:text-slate-900'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {cat.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risultati Commesse durante la ricerca */}
                {matchingLoadsInSearch.length > 0 && (
                  <div className="space-y-2">
                    <div
                      className={`text-xs font-medium ${
                        isLightWallpaper ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Commesse trovate
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {matchingLoadsInSearch.slice(0, 6).map((ld) => (
                        <button
                          key={ld.id}
                          type="button"
                          onClick={() => {
                            onSelectLoad(ld.id);
                            setDesktopSearch('');
                            openApp('commesse');
                          }}
                          className={`px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isLightWallpaper
                              ? 'bg-white/85 hover:bg-white border-slate-200 text-slate-900'
                              : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.09] text-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-semibold truncate">
                              {ld.code} · {ld.title}
                            </div>
                            <div
                              className={`text-[11px] truncate ${
                                isLightWallpaper ? 'text-slate-500' : 'text-slate-400'
                              }`}
                            >
                              {ld.client || 'Cliente N/D'}
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Griglia Applicazioni Ordinate per Reparto */}
                <div className="space-y-6 pb-4">
                  {STUDIO_CATEGORY_META.filter(
                    (cat) => desktopCategory === 'all' || desktopCategory === cat.id
                  ).map((cat) => {
                    const groupItems = filteredStudioShortcuts.filter(
                      (it) => it.studioGroup === cat.id
                    );
                    if (groupItems.length === 0) return null;
                    return (
                      <section key={cat.id} className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <h2
                            className={`text-xs font-medium tracking-wide ${
                              isLightWallpaper ? 'text-slate-600' : 'text-slate-300/80'
                            }`}
                          >
                            {cat.title}
                          </h2>
                          <span
                            className={`text-[11px] font-mono tabular-nums ${
                              isLightWallpaper ? 'text-slate-400' : 'text-slate-500'
                            }`}
                          >
                            {groupItems.length}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                          {groupItems.map((item) => {
                            const isWindowOpen =
                              item.windowId &&
                              windows.some((w) => w.id === item.windowId) &&
                              (item.action === 'open_window' ||
                                item.action === 'open_caricostudio_home' ||
                                (item.action === 'open_subapp' &&
                                  caricoStudioSubApp === item.subAppId));

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShortcutClick(item);
                                }}
                                title={item.title}
                                className={`group relative px-3.5 py-3 rounded-xl border backdrop-blur-md flex items-center gap-3 text-left transition-all duration-150 cursor-pointer ${
                                  isLightWallpaper
                                    ? 'bg-white/82 hover:bg-white border-slate-200/90 hover:border-slate-300 text-slate-900 shadow-2xs hover:shadow-sm'
                                    : 'bg-white/[0.05] hover:bg-white/[0.11] border-white/[0.08] hover:border-white/[0.2] text-white'
                                }`}
                              >
                                <DesktopAppIcon
                                  id={item.id}
                                  size="md"
                                  now={liveNow}
                                  className="transition-transform duration-150 group-hover:scale-[1.06]"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="text-[13px] font-medium leading-tight truncate">
                                    {item.label}
                                  </div>
                                  <div
                                    className={`text-[11px] leading-tight truncate mt-0.5 ${
                                      isLightWallpaper ? 'text-slate-500' : 'text-slate-400'
                                    }`}
                                  >
                                    {item.shortDesc || 'Apri app'}
                                  </div>
                                </div>
                                {isWindowOpen && (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"
                                    title="Finestra aperta"
                                  />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}

                  {filteredStudioShortcuts.length === 0 && matchingLoadsInSearch.length === 0 && (
                    <div
                      className={`py-14 text-center rounded-2xl border ${
                        isLightWallpaper
                          ? 'bg-white/70 border-slate-200 text-slate-600'
                          : 'bg-white/[0.04] border-white/[0.08] text-slate-400'
                      }`}
                    >
                      <p className="text-sm font-medium">
                        Nessun risultato per &ldquo;{desktopSearch}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopSearch('');
                          setDesktopCategory('all');
                        }}
                        className="mt-2.5 text-xs underline underline-offset-2 hover:opacity-80 cursor-pointer"
                      >
                        Mostra tutte le applicazioni
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ===============================================================
               SCRIVANIA CLASSICA AD ICONE (ESTETICA RAFFINATA)
            =============================================================== */
            <>
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
                  className="pointer-events-none absolute z-[5] w-[84px] h-[88px] rounded-2xl border border-dashed border-white/40 bg-white/[0.08] backdrop-blur-sm transition-[left,top] duration-100"
                />
              )}
              {visibleShortcuts.map(renderDesktopShortcut)}

              {/* Angolo Ambientale Discreto (Alto Destra: Orologio + Commessa Attiva) */}
              {!showWidgetPanel && (
                <div className="hidden lg:flex flex-col items-end gap-3.5 absolute top-6 right-7 z-[8] pointer-events-none">
                  <div className="text-right select-none">
                    <div
                      className={`text-[42px] font-light font-mono tabular-nums tracking-tight leading-none ${
                        isLightWallpaper
                          ? 'text-slate-900/90'
                          : 'text-white/92 drop-shadow-[0_4px_18px_rgba(0,0,0,0.45)]'
                      }`}
                    >
                      {clockText}
                    </div>
                    <div
                      className={`text-xs capitalize mt-1.5 font-medium ${
                        isLightWallpaper
                          ? 'text-slate-600'
                          : 'text-white/65 drop-shadow-[0_1px_6px_rgba(0,0,0,0.65)]'
                      }`}
                    >
                      {longDateText || dateText}
                    </div>
                  </div>

                  <div
                    className={`pointer-events-auto w-[264px] rounded-2xl border backdrop-blur-2xl p-3.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.45)] space-y-3 ${
                      isLightWallpaper
                        ? 'bg-white/75 border-slate-900/10 text-slate-900'
                        : 'bg-[#0b101b]/55 border-white/[0.12] text-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCommessaMenu((prev) => !prev);
                      }}
                      className="w-full flex items-center justify-between gap-2 text-left group cursor-pointer"
                      title="Cambia commessa attiva"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-mono text-xs font-semibold tracking-tight tabular-nums">
                            {activeLoad.code}
                          </span>
                        </div>
                        <div
                          className={`text-xs truncate mt-0.5 ${
                            isLightWallpaper ? 'text-slate-600' : 'text-white/70'
                          }`}
                        >
                          {activeLoad.title}
                        </div>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 shrink-0 transition-opacity" />
                    </button>

                    <div
                      className={`grid grid-cols-3 gap-1.5 pt-2.5 border-t ${
                        isLightWallpaper ? 'border-slate-900/10' : 'border-white/[0.08]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => openApp('pallet_weights')}
                        className={`rounded-xl py-1.5 px-2 text-left transition-colors cursor-pointer ${
                          isLightWallpaper
                            ? 'hover:bg-slate-900/[0.05]'
                            : 'hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="text-[10px] opacity-60">Bancali</div>
                        <div className="text-xs font-mono font-semibold tabular-nums mt-0.5">
                          {summary.totalPallets}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openApp('tree')}
                        className={`rounded-xl py-1.5 px-2 text-left transition-colors cursor-pointer ${
                          isLightWallpaper
                            ? 'hover:bg-slate-900/[0.05]'
                            : 'hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="text-[10px] opacity-60">Scatole</div>
                        <div className="text-xs font-mono font-semibold tabular-nums mt-0.5">
                          {summary.totalBoxes}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openApp('checklist')}
                        className={`rounded-xl py-1.5 px-2 text-left transition-colors cursor-pointer ${
                          isLightWallpaper
                            ? 'hover:bg-slate-900/[0.05]'
                            : 'hover:bg-white/[0.08]'
                        }`}
                      >
                        <div className="text-[10px] opacity-60">Spunta</div>
                        <div className="text-xs font-mono font-semibold text-emerald-400 tabular-nums mt-0.5">
                          {summary.checklistCompletionPercent}%
                        </div>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAccountMenu(false);
                        setShowCommessaMenu(false);
                        setShowNotifications(false);
                        setShowStartMenu(true);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isLightWallpaper
                          ? 'bg-slate-900/[0.04] hover:bg-slate-900/[0.08] border-slate-900/10 text-slate-600'
                          : 'bg-white/[0.05] hover:bg-white/[0.11] border-white/[0.08] text-white/65 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Search className="w-3 h-3 opacity-75" />
                        <span>Cerca app...</span>
                      </span>
                      <kbd className="font-mono text-[10px] opacity-60">Ctrl K</kbd>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Desktop Right-Click Context Menu */}
          {desktopContextMenu && (
            <div
              style={{
                left: desktopContextMenu.x,
                top: desktopContextMenu.y,
              }}
              onClick={(e) => e.stopPropagation()}
              className="fixed z-40 w-56 rounded-xl bg-[#0d111a]/95 backdrop-blur-2xl border border-white/14 shadow-2xl p-1.5 text-white space-y-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  handleToggleDesktopLayout();
                  setDesktopContextMenu(null);
                }}
                className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.09] text-xs text-white/90 flex items-center gap-2 cursor-pointer transition-colors text-left"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {desktopLayout === 'studio'
                    ? 'Passa a Icone libere'
                    : 'Passa a Scrivania ordinata'}
                </span>
              </button>
              {desktopLayout === 'icons' && (
                <button
                  type="button"
                  onClick={handleResetDesktopIcons}
                  className="w-full px-2.5 py-2 rounded-lg hover:bg-white/[0.09] text-xs text-white/90 flex items-center gap-2 cursor-pointer transition-colors text-left"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-300" />
                  <span>Riordina icone desktop</span>
                </button>
              )}
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
                <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Nuova commessa</span>
              </button>
            </div>
          )}

          {/* Optional Commessa Status Widget */}
          {showWidgetPanel && (
            <aside className="absolute top-4 right-4 z-20 w-full max-w-[280px] shrink-0 hidden md:block">
              <div className="rounded-2xl bg-[#0d111a]/88 backdrop-blur-2xl border border-white/12 p-4 text-white shadow-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-semibold text-white/90">
                      Stato Commessa
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-medium text-blue-300 tabular-nums">
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
                    <div className="text-[11px] text-white/55">Bancali</div>
                    <div className="text-sm font-semibold font-mono text-white mt-0.5 tabular-nums">
                      {summary.totalPallets}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openApp('tree')}
                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[11px] text-white/55">Scatoloni</div>
                    <div className="text-sm font-semibold font-mono text-white mt-0.5 tabular-nums">
                      {summary.totalBoxes}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openApp('painting_tags')}
                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[11px] text-white/55">Verniciatura</div>
                    <div className="text-sm font-semibold font-mono text-amber-300 mt-0.5 tabular-nums">
                      {activeLoad.finishingTags?.length || 0}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => openApp('checklist')}
                    className="p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-left cursor-pointer transition-colors"
                  >
                    <div className="text-[11px] text-white/55">Spunta Merce</div>
                    <div className="text-sm font-semibold font-mono text-emerald-300 mt-0.5 tabular-nums">
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
          <div className="no-print fixed bottom-[72px] left-1/2 -translate-x-1/2 z-[75] flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0b101b]/95 backdrop-blur-2xl border border-white/15 text-white text-xs font-medium shadow-2xl">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate max-w-[340px]">{statusNotice}</span>
          </div>
        )}

        {/* ===================================================================
            2. FINESTRE APPLICAZIONI DESKTOP (SOPRA LA BARRA INFERIORE)
        =================================================================== */}
        {windows.map((win) => {
          if (win.minimized) return null;
          const appDef = DESKTOP_MAIN_APPS.find((a) => a.id === win.id);
          if (!appDef) return null;
          const isFocused = topVisibleWindowId === win.id;
          const activeSubAppDef =
            win.id === 'caricostudio' && caricoStudioSubApp !== 'home'
              ? CARICOSTUDIO_SUB_APPS.find((s) => s.id === caricoStudioSubApp)
              : null;

          let positionStyle: React.CSSProperties = {};
          let containerClasses =
            'fixed flex flex-col bg-[#F5F7FA] overflow-hidden transition-shadow ';

          if (win.snap === 'maximized') {
            positionStyle = {
              top: 0,
              left: 0,
              right: 0,
              bottom: 64,
              zIndex: win.zIndex,
            };
            containerClasses += 'rounded-b-2xl border-b border-white/12 shadow-2xl';
          } else if (win.snap === 'left') {
            positionStyle = {
              top: 0,
              left: 0,
              width: '50vw',
              bottom: 64,
              zIndex: win.zIndex,
            };
            containerClasses +=
              'rounded-br-2xl border-r border-b border-slate-300/60 shadow-2xl';
          } else if (win.snap === 'right') {
            positionStyle = {
              top: 0,
              left: '50vw',
              width: '50vw',
              bottom: 64,
              zIndex: win.zIndex,
            };
            containerClasses +=
              'rounded-bl-2xl border-l border-b border-slate-300/60 shadow-2xl';
          } else {
            positionStyle = {
              top: win.y,
              left: win.x,
              width: win.width,
              height: win.height,
              zIndex: win.zIndex,
            };
            containerClasses += `rounded-2xl border ${
              isFocused
                ? 'border-white/20 shadow-[0_32px_90px_-12px_rgba(0,0,0,0.72)]'
                : 'border-white/10 shadow-xl opacity-96'
            }`;
          }

          return (
            <div
              key={win.id}
              data-window-shell="true"
              style={positionStyle}
              onMouseDown={() => {
                if (!isFocused) focusWindow(win.id);
              }}
              className={containerClasses}
            >
              {/* Titlebar Finestra Studio */}
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
                className={`no-print h-11 px-4 flex items-center justify-between gap-3 shrink-0 select-none border-b border-white/[0.07] ${
                  isFocused
                    ? 'bg-[#0b101b] text-white'
                    : 'bg-[#161c29] text-slate-300'
                } ${win.snap === 'floating' ? 'cursor-move' : ''}`}
              >
                {/* Left: App Icon + Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <DesktopAppIcon
                    id={activeSubAppDef ? activeSubAppDef.id : win.id}
                    size="sm"
                    now={liveNow}
                  />
                  <span className="text-[13px] font-medium tracking-tight truncate">
                    {activeSubAppDef
                      ? `CaricoStudio · ${activeSubAppDef.shortTitle}`
                      : appDef.title}
                  </span>
                  {win.id === 'caricostudio' && (
                    <span className="hidden md:inline text-xs font-mono text-slate-400 truncate shrink-0 tabular-nums">
                      / {activeLoad.code} · {activeLoad.title}
                    </span>
                  )}
                </div>

                {/* Right: Window Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={minimizeAllToDesktop}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-[11px] font-medium text-white/80 hover:text-white flex items-center gap-1.5 mr-1.5 cursor-pointer transition-colors whitespace-nowrap"
                    title="Torna alla Scrivania"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Scrivania</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWindowSnap(win.id, 'left')}
                    className={`p-1.5 rounded-lg hover:bg-white/12 cursor-pointer transition-colors ${
                      win.snap === 'left' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'
                    }`}
                    title="Affianca a Sinistra (50%)"
                  >
                    <PanelLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setWindowSnap(win.id, 'right')}
                    className={`p-1.5 rounded-lg hover:bg-white/12 cursor-pointer transition-colors ${
                      win.snap === 'right' ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'
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
                    className="p-1.5 rounded-lg hover:bg-white/12 text-white/60 hover:text-white cursor-pointer transition-colors"
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
                    className="p-1.5 rounded-lg hover:bg-white/12 text-white/60 hover:text-white cursor-pointer transition-colors"
                    title="Riduci nella barra inferiore"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => closeWindow(win.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-600 text-white/60 hover:text-white cursor-pointer transition-colors"
                    title="Chiudi finestra"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Barra Interna Sotto-App dentro CaricoStudio */}
              {win.id === 'caricostudio' && (
                <div className="no-print bg-white border-b border-slate-200/90 px-4 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                  <button
                    type="button"
                    onClick={() => setCaricoStudioSubApp('home')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      caricoStudioSubApp === 'home'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {caricoStudioSubApp === 'home' ? (
                      <LayoutGrid className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronLeft className="w-3.5 h-3.5" />
                    )}
                    <span>Panoramica</span>
                  </button>

                  <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

                  {CARICOSTUDIO_SUB_APPS.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = caricoStudioSubApp === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setCaricoStudioSubApp(sub.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          isSubActive
                            ? 'bg-slate-900 text-white'
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
              <div className="flex-1 overflow-hidden min-h-0 bg-[#F5F7FA]">
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
                win.id === 'server_control' ||
                win.id === 'software_updates' ||
                win.id === 'ddt_documents' ||
                win.id === 'crm_directory' ||
                win.id === 'purchase_orders' ||
                win.id === 'timini_print' ||
                win.id === 'pallet_truck_scanner' ||
                win.id === 'excel_checklist_merger' ||
                win.id === 'ai_order_autopilot' ? (
                  renderAppContent(win.id, (targetId) => openApp(targetId))
                ) : caricoStudioSubApp === 'home' ? (
                  /* HUB INTERNO DELLE APP DI CARICOSTUDIO */
                  <div className="h-full overflow-y-auto px-6 py-7 bg-[#F5F7FA] text-slate-900">
                    <div className="max-w-5xl mx-auto space-y-7">
                      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200/80 pb-5">
                        <div>
                          <div className="text-[11px] font-medium text-slate-500 mb-1">
                            METATRON CaricoStudio
                          </div>
                          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
                            {activeLoad.code} — {activeLoad.title}
                          </h2>
                          <p className="text-xs text-slate-500 mt-1 tabular-nums">
                            {summary.totalPallets} bancali · {summary.totalBoxes} scatole ·{' '}
                            {summary.totalGrossWeightKg.toFixed(0)} kg lordi ·{' '}
                            {summary.checkedItems}/{summary.totalItems} articoli spuntati
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={tileTwoWindowsSideBySide}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/90 shadow-xs text-xs font-medium text-slate-700 flex items-center gap-2 cursor-pointer whitespace-nowrap transition-colors"
                        >
                          <Columns className="w-3.5 h-3.5 text-blue-600" />
                          Affianca con Carico / Scarico
                        </button>
                      </div>

                      <div>
                        <h3 className="text-xs font-medium text-slate-500 mb-3.5">
                          Moduli operativi spedizione
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                          {CARICOSTUDIO_SUB_APPS.map((sub) => {
                            const badge = sub.badgeText
                              ? sub.badgeText(activeLoad, summary)
                              : null;
                            return (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => setCaricoStudioSubApp(sub.id)}
                                className="group p-4 rounded-2xl bg-white hover:bg-slate-50/70 border border-slate-200/85 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_6px_18px_-6px_rgba(15,23,42,0.08)] flex flex-col items-start text-left gap-3 transition-all cursor-pointer"
                              >
                                <div className="w-full flex items-center justify-between gap-2">
                                  <DesktopAppIcon
                                    id={sub.id}
                                    size="lg"
                                    now={liveNow}
                                    className="transition-transform duration-150 group-hover:scale-[1.05]"
                                  />
                                  {badge && (
                                    <span className="font-mono text-[11px] font-medium text-slate-500 tabular-nums">
                                      {badge}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <div className="text-[13px] font-semibold text-slate-900">
                                    {sub.shortTitle}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                    {sub.subtitle}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200/80">
                        <h3 className="text-xs font-medium text-slate-500 mb-3.5">
                          Strumenti rapidi e stampe
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <button
                            type="button"
                            onClick={onOpenPrintModal}
                            className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/85 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center gap-3 text-left cursor-pointer transition-all"
                          >
                            <div className="w-9 h-9 rounded-lg bg-slate-900 text-sky-400 flex items-center justify-center shrink-0">
                              <Printer className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
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
                            className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/85 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center gap-3 text-left cursor-pointer transition-all"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                              <CopyPlus className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
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
                            className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/85 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center gap-3 text-left cursor-pointer transition-all"
                          >
                            <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                              <Languages className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
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
                            className="p-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200/85 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center gap-3 text-left cursor-pointer transition-all"
                          >
                            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <FolderDown className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
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
            3. START MENU POPOVER CON RICERCA ISTANTANEA
        =================================================================== */}
        {showStartMenu && (
          <>
            <div
              className="no-print fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => {
                setShowStartMenu(false);
                setStartMenuSearch('');
              }}
            />
            <div className="no-print fixed bottom-[68px] left-3 z-50 w-[92vw] max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-[#0b101b]/94 backdrop-blur-3xl border border-white/15 shadow-[0_28px_80px_rgba(0,0,0,0.78)] p-5 text-white">
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-tight text-white">
                    Applicazioni METATRON
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    Commessa attiva:{' '}
                    <span className="font-mono text-sky-300">{activeLoad.code}</span> ·{' '}
                    {activeLoad.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="relative w-48 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={startMenuSearch}
                      onChange={(e) => setStartMenuSearch(e.target.value)}
                      placeholder="Cerca app..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.08] border border-white/14 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:border-white/35"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartMenu(false);
                      setStartMenuSearch('');
                    }}
                    className="p-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] text-white/70 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* App Principali */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-4 border-b border-white/10">
                {visibleMainApps
                  .filter((app) => {
                    const q = startMenuSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      app.shortTitle.toLowerCase().includes(q) ||
                      app.title.toLowerCase().includes(q) ||
                      app.subtitle.toLowerCase().includes(q)
                    );
                  })
                  .map((app) => {
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => {
                          setStartMenuSearch('');
                          if (app.id === 'caricostudio') {
                            setCaricoStudioSubApp('home');
                            openDesktopWindow('caricostudio');
                          } else {
                            openDesktopWindow(app.id);
                          }
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.11] border border-white/[0.07] hover:border-white/[0.16] flex items-center gap-3 text-left transition-all cursor-pointer group"
                      >
                        <DesktopAppIcon
                          id={app.id}
                          size="md"
                          now={liveNow}
                          className="transition-transform duration-150 group-hover:scale-[1.06]"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate">
                            {app.shortTitle}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {app.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* Sotto-App CaricoStudio */}
              <div className="py-4">
                <div className="text-[11px] font-medium text-slate-400 mb-2.5">
                  Moduli interni CaricoStudio
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CARICOSTUDIO_SUB_APPS.filter((app) => {
                    const q = startMenuSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      app.shortTitle.toLowerCase().includes(q) ||
                      app.title.toLowerCase().includes(q)
                    );
                  }).map((app) => {
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => {
                          setStartMenuSearch('');
                          openApp(app.id);
                        }}
                        className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.11] border border-white/[0.07] hover:border-white/[0.16] flex items-center gap-2.5 text-left transition-all cursor-pointer group"
                      >
                        <DesktopAppIcon
                          id={app.id}
                          size="sm"
                          now={liveNow}
                          className="transition-transform duration-150 group-hover:scale-[1.06]"
                        />
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
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Columns className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Affianca 2 App</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartMenu(false);
                      onOpenPdfDirect();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
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
                    className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-400" />
                    <span>Stampe</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowStartMenu(false);
                    onOpenNewLoadModal();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-950 font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
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
            <div className="no-print fixed bottom-[68px] right-28 z-50 w-72 rounded-2xl bg-[#0b101b]/95 backdrop-blur-3xl border border-white/15 shadow-2xl p-3 text-white">
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
            <div className="no-print fixed bottom-[68px] right-3 z-50 w-72 rounded-2xl bg-[#0b101b]/95 backdrop-blur-3xl border border-white/15 shadow-2xl p-3.5 text-white space-y-3">
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

              <div className="pt-2 border-t border-white/10 space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(false);
                    setShowWhatsNewModal(true);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Novità METATRON 2.1</span>
                </button>
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
            5A-TER. OVERLAY COMMESSA ZERO-CLICK (DRAG & DROP SU DESKTOP)
        =================================================================== */}
        {isDesktopFileDragging && (
          <div className="no-print pointer-events-none fixed inset-0 z-[105] flex items-center justify-center p-6 bg-[#04070f]/75 backdrop-blur-md">
            <div className="w-full max-w-xl rounded-3xl border-2 border-dashed border-amber-400/80 bg-[#0b1324]/92 px-8 py-12 text-center text-white shadow-2xl space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight">
                Rilascia qui per creare la Commessa Zero-Click
              </h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                PDF, Excel, CSV o foto di una bolla: METATRON estrae gli articoli, applica la memoria delle tue abitudini, prepara scatole e bancali bilanciati SX/DX, rileva i cartelli RAL e genera subito i QR.
              </p>
            </div>
          </div>
        )}

        {(zeroClickBusy || zeroClickError || zeroClickResult) && (
          <div
            className="no-print fixed inset-0 z-[108] flex items-center justify-center p-4 bg-[#04070f]/75 backdrop-blur-lg"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-lg rounded-2xl border border-white/[0.15] bg-[#0b1220] text-white shadow-2xl overflow-hidden">
              {zeroClickBusy && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/35 text-amber-300 flex items-center justify-center shrink-0">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-white">
                        Preparazione Commessa Zero-Click in corso
                      </h3>
                      <p className="text-xs text-slate-300 truncate mt-0.5">
                        {zeroClickStage}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all duration-200"
                      style={{ width: `${Math.max(8, zeroClickPct)}%` }}
                    />
                  </div>
                </div>
              )}

              {!zeroClickBusy && zeroClickError && (
                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white">
                        File non riconosciuto
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {zeroClickError}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setZeroClickError(null)}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer"
                    >
                      Chiudi
                    </button>
                  </div>
                </div>
              )}

              {!zeroClickBusy && zeroClickResult && (
                <div className="p-6 space-y-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Commessa Zero-Click pronta</span>
                      </div>
                      <h3 className="text-lg font-semibold text-white mt-1 truncate">
                        <span className="font-mono">{zeroClickResult.load.code}</span> ·{' '}
                        {zeroClickResult.load.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {zeroClickResult.load.client} · da {zeroClickResult.fileName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setZeroClickResult(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] py-2.5 px-2">
                      <div className="text-lg font-bold font-mono tabular-nums text-white">
                        {zeroClickResult.itemsCount}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Articoli ({zeroClickResult.totalPieces} pz)
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] py-2.5 px-2">
                      <div className="text-lg font-bold font-mono tabular-nums text-sky-300">
                        {zeroClickResult.boxesCount}
                      </div>
                      <div className="text-[11px] text-slate-400">Scatole auto</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] py-2.5 px-2">
                      <div className="text-lg font-bold font-mono tabular-nums text-amber-300">
                        {zeroClickResult.palletsCount}
                      </div>
                      <div className="text-[11px] text-slate-400">Bancali SX/DX</div>
                    </div>
                    <div className="rounded-xl bg-white/[0.05] border border-white/[0.08] py-2.5 px-2">
                      <div className="text-lg font-bold font-mono tabular-nums text-emerald-300">
                        {zeroClickResult.finishingTagsCount}
                      </div>
                      <div className="text-[11px] text-slate-400">Cartelli RAL</div>
                    </div>
                  </div>

                  {zeroClickResult.matchedFromMemoryCount > 0 && (
                    <div className="text-xs text-slate-300">
                      Memoria locale applicata su{' '}
                      <span className="font-mono font-semibold text-amber-300">
                        {zeroClickResult.matchedFromMemoryCount}
                      </span>{' '}
                      articoli già riconosciuti dalle tue abitudini.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => {
                        setZeroClickResult(null);
                        openApp('truck');
                      }}
                      className="px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Piano Camion</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZeroClickResult(null);
                        openApp('qr_labels');
                      }}
                      className="px-3 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Stampa QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZeroClickResult(null);
                        openApp('checklist');
                      }}
                      className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Apri Check-List</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            5A-BIS. AVVISO NOVITÀ METATRON 2.1 IN CENTRO SCHERMO AL PRIMO AVVIO
        =================================================================== */}
        {showWhatsNewModal && (
          <WhatsNewShowcaseModal
            userName={currentUser.name}
            onClose={handleCloseWhatsNew}
            onLaunchApp={(appId) => openApp(appId)}
          />
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
          6. BARRA DOCK INFERIORE FLOTTANTE IN VETRO SATINATO
      ===================================================================== */}
      <footer className="no-print fixed bottom-2.5 left-3 right-3 h-12 rounded-2xl bg-[#090e1a]/76 backdrop-blur-3xl border border-white/[0.15] shadow-[0_18px_48px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.16)] px-3 flex items-center justify-between gap-2 z-50 text-white">
        {/* Bottom-Left: App Launcher + Open Window Tabs */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => {
              setShowAccountMenu(false);
              setShowCommessaMenu(false);
              setShowNotifications(false);
              setShowStartMenu((prev) => !prev);
            }}
            className={`h-8 px-2.5 rounded-xl flex items-center gap-2 shrink-0 text-xs font-medium transition-all cursor-pointer ${
              showStartMenu
                ? 'bg-white/18 text-white ring-1 ring-white/20'
                : 'text-white/85 hover:bg-white/[0.11] hover:text-white'
            }`}
            title="Menu Applicazioni (Ctrl+K)"
            aria-label="Menu Applicazioni"
          >
            <LayoutGrid className="w-4 h-4 stroke-[1.85]" />
            <span className="hidden sm:inline">App</span>
          </button>

          {windows.length > 0 && (
            <div className="h-4 w-px bg-white/14 mx-0.5 shrink-0" />
          )}

          {windows.map((win) => {
            const appDef = DESKTOP_MAIN_APPS.find((a) => a.id === win.id);
            if (!appDef) return null;
            const isTop = topVisibleWindowId === win.id && !win.minimized;
            const activeSubDef =
              win.id === 'caricostudio' && caricoStudioSubApp !== 'home'
                ? CARICOSTUDIO_SUB_APPS.find((s) => s.id === caricoStudioSubApp)
                : null;
            return (
              <div
                key={win.id}
                className={`group relative flex items-center gap-1.5 h-8 pl-2 pr-1.5 rounded-xl text-xs transition-all shrink-0 ${
                  isTop
                    ? 'bg-white/[0.16] text-white font-medium ring-1 ring-white/[0.14]'
                    : win.minimized
                    ? 'text-white/45 hover:bg-white/[0.09] hover:text-white/85'
                    : 'bg-white/[0.07] text-white/80 hover:bg-white/[0.12]'
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
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <DesktopAppIcon
                    id={activeSubDef ? activeSubDef.id : win.id}
                    size="xs"
                    now={liveNow}
                  />
                  <span className="truncate max-w-[160px]">
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
                  <span className="absolute bottom-0.5 left-3 right-3 h-[2px] rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom-Right: Quiet Tray Controls */}
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
            className={`hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-mono transition-colors cursor-pointer tabular-nums ${
              showCommessaMenu
                ? 'bg-white/18 text-white'
                : 'text-white/75 hover:bg-white/[0.1] hover:text-white'
            }`}
            title={`Commessa attiva: ${activeLoad.code} — ${activeLoad.title}`}
          >
            <span className="truncate max-w-[115px]">{activeLoad.code}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Affianca 2 App */}
          <button
            type="button"
            onClick={tileTwoWindowsSideBySide}
            className="w-8 h-8 rounded-xl text-white/65 hover:text-white hover:bg-white/[0.1] flex items-center justify-center cursor-pointer transition-colors"
            title="Affianca CaricoStudio + Carico/Scarico"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>

          {/* Guida Rapida */}
          {onOpenTutorial && (
            <button
              type="button"
              onClick={onOpenTutorial}
              className="w-8 h-8 rounded-xl text-white/65 hover:text-white hover:bg-white/[0.1] flex items-center justify-center cursor-pointer transition-colors"
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

          <div className="hidden sm:flex items-center">
            <PrintLanguageSelector
              value={globalPrintLang}
              onChange={setGlobalPrintLang}
              variant="topbar"
            />
          </div>

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
