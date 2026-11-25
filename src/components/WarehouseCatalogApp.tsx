import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  ScanBarcode,
  Star,
  Plus,
  Minus,
  Search,
  Paperclip,
  Trash2,
  Pencil,
  Download,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Volume2,
  VolumeX,
  RotateCcw,
  CheckCircle2,
  X,
  FileText,
  Image as ImageIcon,
  Layers,
  History,
  Upload,
  MapPin,
  LayoutGrid,
  List,
  ArrowUpDown,
  FileSpreadsheet,
  SlidersHorizontal,
} from 'lucide-react';
import {
  AuthUser,
  CargoLoad,
  StockMovement,
  WarehouseInventoryState,
  WarehouseItemAttachment,
  WarehouseStockItem,
} from '../types/warehouse';

interface WarehouseCatalogAppProps {
  inventory: WarehouseInventoryState;
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  currentUser: AuthUser;
  onUpdateInventory: (next: WarehouseInventoryState, notice?: string) => void;
}

interface SessionScanEntry {
  id: string;
  movementId: string;
  itemId: string;
  sku: string;
  barcode?: string;
  name: string;
  mode: 'carico' | 'scarico';
  quantity: number;
  unit: string;
  previousQty: number;
  resultingQty: number;
  timestamp: string;
  isNewItem?: boolean;
  undone?: boolean;
}

type WarehouseTab = 'catalog' | 'pos' | 'favorites' | 'low_stock' | 'history';
type CatalogSort = 'name_asc' | 'qty_asc' | 'qty_desc' | 'used_desc' | 'updated_desc';

const DEFAULT_CATEGORIES = [
  'Ferramenta & Minuteria',
  'Elettrico & Sensori',
  'Meccanica & Ricambi',
  'Imballaggio & Scatole',
  'Consumabili',
  'Vernici & Chimica',
  'Generale',
];

const UNITS = ['pz', 'kg', 'm', 'scatole', 'rotoli', 'litri', 'bancali', 'kit'];

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function compressImageFile(file: File, maxDim = 900, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore lettura immagine'));
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(src);
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

function playScannerBeep(kind: 'in' | 'out' | 'new' | 'warn') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (kind === 'in') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1040, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (kind === 'out') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.setValueAtTime(480, now + 0.06);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.16);
    } else if (kind === 'new') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.setValueAtTime(980, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    }
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 350);
  } catch {
    // ignore audio restrictions
  }
}

export const WarehouseCatalogApp: React.FC<WarehouseCatalogAppProps> = ({
  inventory,
  loads,
  activeLoad,
  currentUser,
  onUpdateInventory,
}) => {
  const [activeTab, setActiveTab] = useState<WarehouseTab>('catalog');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortBy, setSortBy] = useState<CatalogSort>('name_asc');

  // USB / Keyboard Barcode Terminal State (zero camera)
  const [scanMode, setScanMode] = useState<'carico' | 'scarico'>('carico');
  const [scanCodeInput, setScanCodeInput] = useState('');
  const [scanQty, setScanQty] = useState<number>(1);
  const [scanCommessaCode, setScanCommessaCode] = useState<string>(
    activeLoad?.code || ''
  );
  const [autoFocusScanner, setAutoFocusScanner] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sessionLog, setSessionLog] = useState<SessionScanEntry[]>([]);
  const [lastScannedBanner, setLastScannedBanner] = useState<{
    kind: 'in' | 'out' | 'warn';
    title: string;
    detail: string;
    resultingQty?: number;
    unit?: string;
    lowStock?: boolean;
  } | null>(null);

  // Catalog & History Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'carico' | 'scarico'>(
    'all'
  );
  const [historySearch, setHistorySearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Side Inspector Drawer + Quick Custom Movement inside Drawer
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [drawerQty, setDrawerQty] = useState<number>(1);
  const [drawerReason, setDrawerReason] = useState<string>('');

  // Create / Edit Item Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isFromUnknownScan, setIsFromUnknownScan] = useState(false);

  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [formUnit, setFormUnit] = useState('pz');
  const [formQty, setFormQty] = useState<number>(1);
  const [formMinStock, setFormMinStock] = useState<number>(5);
  const [formLocation, setFormLocation] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formFavorite, setFormFavorite] = useState<boolean>(false);
  const [formPhoto, setFormPhoto] = useState<string>('');
  const [formAttachments, setFormAttachments] = useState<WarehouseItemAttachment[]>(
    []
  );
  const [formError, setFormError] = useState<string | null>(null);

  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setScanCommessaCode((prev) => prev || activeLoad?.code || '');
  }, [activeLoad?.code]);

  // Keep USB barcode wedge input focused in POS mode
  useEffect(() => {
    if (activeTab === 'pos' && autoFocusScanner && !editorOpen) {
      const t = window.setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [activeTab, autoFocusScanner, editorOpen, scanMode]);

  useEffect(() => {
    if (editorOpen && isFromUnknownScan) {
      const t = window.setTimeout(() => {
        nameInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [editorOpen, isFromUnknownScan]);

  const items = inventory.items;
  const movements = inventory.movements;

  const selectedItem = useMemo(
    () => (selectedItemId ? items.find((it) => it.id === selectedItemId) || null : null),
    [items, selectedItemId]
  );

  const selectedItemMovements = useMemo(() => {
    if (!selectedItem) return [];
    return movements.filter((m) => m.itemId === selectedItem.id).slice(0, 12);
  }, [movements, selectedItem]);

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    items.forEach((it) => {
      if (it.category?.trim()) set.add(it.category.trim());
    });
    return Array.from(set);
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((it) => {
      const key = (it.category || 'Generale').trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [items]);

  const lowStockItems = useMemo(
    () => items.filter((it) => it.quantity <= it.minStock),
    [items]
  );

  const outOfStockCount = useMemo(
    () => items.filter((it) => it.quantity <= 0).length,
    [items]
  );

  const favoriteItems = useMemo(
    () =>
      items
        .filter((it) => Boolean(it.isFavorite))
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)),
    [items]
  );

  const mostUsedSuggestions = useMemo(
    () =>
      items
        .filter((it) => !it.isFavorite && (it.usageCount || 0) > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 6),
    [items]
  );

  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMovs = movements.filter((m) => m.timestamp.startsWith(todayStr));
    return {
      total: todayMovs.length,
      inCount: todayMovs.filter((m) => m.type === 'carico').length,
      outCount: todayMovs.filter((m) => m.type === 'scarico').length,
    };
  }, [movements]);

  const totalUnitsInStock = useMemo(
    () => items.reduce((acc, it) => acc + Math.max(0, Number(it.quantity) || 0), 0),
    [items]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = items.filter((it) => {
      if (activeTab === 'low_stock' && it.quantity > it.minStock) return false;
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
      if (q) {
        const hay = `${it.name} ${it.sku} ${it.barcode || ''} ${it.location || ''} ${it.supplier || ''} ${it.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'qty_asc':
          return a.quantity - b.quantity;
        case 'qty_desc':
          return b.quantity - a.quantity;
        case 'used_desc':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'updated_desc':
          return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name, 'it');
      }
    });
  }, [items, activeTab, categoryFilter, searchQuery, sortBy]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return movements.filter((m) => {
      if (historyFilter !== 'all' && m.type !== historyFilter) return false;
      if (!q) return true;
      return (
        m.itemName.toLowerCase().includes(q) ||
        m.sku.toLowerCase().includes(q) ||
        (m.commessaCode || '').toLowerCase().includes(q) ||
        (m.reason || '').toLowerCase().includes(q) ||
        (m.operatorName || '').toLowerCase().includes(q)
      );
    });
  }, [movements, historyFilter, historySearch]);

  // Live suggestions when typing SKU/name in barcode terminal
  const scannerSuggestions = useMemo(() => {
    const q = scanCodeInput.trim().toLowerCase();
    if (q.length < 2) return [];
    return items
      .filter(
        (it) =>
          it.sku.toLowerCase().includes(q) ||
          (it.barcode && it.barcode.toLowerCase().includes(q)) ||
          it.name.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [items, scanCodeInput]);

  const findItemByCode = useCallback(
    (rawCode: string): WarehouseStockItem | undefined => {
      const normalized = rawCode.trim().toUpperCase();
      if (!normalized) return undefined;
      return items.find(
        (it) =>
          (it.barcode && it.barcode.trim().toUpperCase() === normalized) ||
          it.sku.trim().toUpperCase() === normalized
      );
    },
    [items]
  );

  // Core stock adjustment
  const applyStockMovement = useCallback(
    (
      item: WarehouseStockItem,
      mode: 'carico' | 'scarico',
      deltaQty: number,
      reasonOverride?: string
    ) => {
      const safeQty = Math.max(0.01, Number(deltaQty) || 1);
      const nowIso = new Date().toISOString();
      const previousQty = Number(item.quantity) || 0;

      if (mode === 'scarico' && previousQty <= 0) {
        if (soundEnabled) playScannerBeep('warn');
        setLastScannedBanner({
          kind: 'warn',
          title: `${item.name} — Giacenza esaurita`,
          detail: `Impossibile scaricare ${safeQty} ${item.unit}: la giacenza attuale è 0.`,
          resultingQty: 0,
          unit: item.unit,
          lowStock: true,
        });
        return;
      }

      const resultingQty =
        mode === 'carico'
          ? Math.round((previousQty + safeQty) * 100) / 100
          : Math.max(0, Math.round((previousQty - safeQty) * 100) / 100);

      const nextItems = items.map((it) =>
        it.id === item.id
          ? {
              ...it,
              quantity: resultingQty,
              usageCount: (it.usageCount || 0) + 1,
              updatedAt: nowIso,
            }
          : it
      );

      const movementId = `mov-pos-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
      const newMov: StockMovement = {
        id: movementId,
        itemId: item.id,
        sku: item.sku,
        itemName: item.name,
        unit: item.unit,
        type: mode,
        quantity: safeQty,
        previousQty,
        resultingQty,
        reason:
          reasonOverride?.trim() ||
          (mode === 'carico'
            ? 'Entrata magazzino'
            : 'Uscita magazzino'),
        commessaCode: scanCommessaCode.trim() || undefined,
        operatorName: currentUser.name,
        timestamp: nowIso,
      };

      onUpdateInventory(
        {
          ...inventory,
          items: nextItems,
          movements: [newMov, ...movements],
        },
        mode === 'carico'
          ? `Caricato +${safeQty} ${item.unit} di ${item.name} (Giacenza: ${resultingQty})`
          : `Scaricato −${safeQty} ${item.unit} di ${item.name} (Giacenza: ${resultingQty})`
      );

      if (soundEnabled) {
        playScannerBeep(mode === 'carico' ? 'in' : 'out');
      }

      const isLow = resultingQty <= item.minStock;
      setLastScannedBanner({
        kind: mode === 'carico' ? 'in' : 'out',
        title: item.name,
        detail: `${mode === 'carico' ? 'Entrata' : 'Uscita'} ${
          mode === 'carico' ? '+' : '−'
        }${safeQty} ${item.unit} · ${item.sku}${
          item.barcode ? ` · ${item.barcode}` : ''
        }`,
        resultingQty,
        unit: item.unit,
        lowStock: isLow,
      });

      setSessionLog((prev) => [
        {
          id: `ses-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          movementId,
          itemId: item.id,
          sku: item.sku,
          barcode: item.barcode,
          name: item.name,
          mode,
          quantity: safeQty,
          unit: item.unit,
          previousQty,
          resultingQty,
          timestamp: nowIso,
        },
        ...prev.slice(0, 49),
      ]);
    },
    [
      items,
      movements,
      inventory,
      onUpdateInventory,
      scanCommessaCode,
      currentUser.name,
      soundEnabled,
    ]
  );

  const openNewItemModal = useCallback(
    (prefilledCode?: string, fromUnknownScan = false) => {
      const cleanCode = (prefilledCode || '').trim();
      setEditingItemId(null);
      setIsFromUnknownScan(fromUnknownScan);
      setFormBarcode(cleanCode);
      setFormSku(
        cleanCode
          ? cleanCode.toUpperCase().slice(0, 32)
          : `SKU-${String(items.length + 1).padStart(4, '0')}`
      );
      setFormName('');
      setFormCategory(
        categoryFilter !== 'all' ? categoryFilter : DEFAULT_CATEGORIES[0]
      );
      setFormUnit('pz');
      setFormQty(Math.max(1, scanQty || 1));
      setFormMinStock(5);
      setFormLocation('');
      setFormSupplier('');
      setFormNotes('');
      setFormFavorite(false);
      setFormPhoto('');
      setFormAttachments([]);
      setFormError(null);
      setEditorOpen(true);
    },
    [items.length, scanQty, categoryFilter]
  );

  const openEditItemModal = (item: WarehouseStockItem) => {
    setEditingItemId(item.id);
    setIsFromUnknownScan(false);
    setFormSku(item.sku);
    setFormBarcode(item.barcode || '');
    setFormName(item.name);
    setFormCategory(item.category || DEFAULT_CATEGORIES[0]);
    setFormUnit(item.unit || 'pz');
    setFormQty(item.quantity);
    setFormMinStock(item.minStock);
    setFormLocation(item.location || '');
    setFormSupplier(item.supplier || '');
    setFormNotes(item.notes || '');
    setFormFavorite(Boolean(item.isFavorite));
    setFormPhoto(item.photoDataUrl || '');
    setFormAttachments(item.attachments ? [...item.attachments] : []);
    setFormError(null);
    setEditorOpen(true);
  };

  const processScannedCode = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;
      const found = findItemByCode(code);
      if (found) {
        applyStockMovement(
          found,
          scanMode,
          scanQty,
          scanMode === 'carico'
            ? 'Entrata da lettore barcode USB'
            : 'Uscita da lettore barcode USB'
        );
      } else {
        if (soundEnabled) playScannerBeep('new');
        openNewItemModal(code, true);
      }
      setScanCodeInput('');
    },
    [findItemByCode, applyStockMovement, scanMode, scanQty, soundEnabled, openNewItemModal]
  );

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScannedCode(scanCodeInput);
  };

  const handleUndoSessionEntry = (entry: SessionScanEntry) => {
    if (entry.undone) return;
    const target = items.find((it) => it.id === entry.itemId);
    if (!target) return;
    const nowIso = new Date().toISOString();
    const reversedQty =
      entry.mode === 'carico'
        ? Math.max(0, Math.round((target.quantity - entry.quantity) * 100) / 100)
        : Math.round((target.quantity + entry.quantity) * 100) / 100;

    const nextItems = items.map((it) =>
      it.id === target.id ? { ...it, quantity: reversedQty, updatedAt: nowIso } : it
    );
    const nextMovements = movements.filter((m) => m.id !== entry.movementId);

    onUpdateInventory(
      {
        ...inventory,
        items: nextItems,
        movements: nextMovements,
      },
      `Annullata operazione su ${entry.name}`
    );
    setSessionLog((prev) =>
      prev.map((s) => (s.id === entry.id ? { ...s, undone: true } : s))
    );
  };

  const handleToggleFavorite = (itemId: string) => {
    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, isFavorite: !it.isFavorite } : it
    );
    onUpdateInventory({
      ...inventory,
      items: nextItems,
    });
  };

  const handleDeleteItem = (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    onUpdateInventory(
      {
        ...inventory,
        items: items.filter((i) => i.id !== itemId),
      },
      target ? `Articolo "${target.name}" rimosso dal magazzino` : undefined
    );
    setConfirmDeleteId(null);
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 900, 0.78);
      setFormPhoto(compressed);
    } catch {
      setFormError('Impossibile leggere l\'immagine selezionata.');
    }
    e.target.value = '';
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setFormError('Ogni file allegato può pesare al massimo 4 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const att: WarehouseItemAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl: String(reader.result || ''),
        addedAt: new Date().toISOString(),
      };
      setFormAttachments((prev) => [...prev, att]);
      setFormError(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadAttachment = (att: WarehouseItemAttachment) => {
    const a = document.createElement('a');
    a.href = att.dataUrl;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportCsv = () => {
    const isHistory = activeTab === 'history';
    let csv = '';
    if (isHistory) {
      const headers = [
        'Data/Ora',
        'Tipo',
        'SKU',
        'Articolo',
        'Quantita',
        'Unita',
        'Giacenza Finale',
        'Commessa',
        'Causale',
        'Operatore',
      ];
      const rows = filteredHistory.map((m) => [
        new Date(m.timestamp).toLocaleString('it-IT'),
        m.type === 'carico' ? 'ENTRATA' : 'USCITA',
        m.sku,
        m.itemName,
        m.type === 'carico' ? `+${m.quantity}` : `-${m.quantity}`,
        m.unit,
        m.resultingQty,
        m.commessaCode || '',
        m.reason,
        m.operatorName,
      ]);
      csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    } else {
      const headers = [
        'SKU',
        'Barcode',
        'Nome Articolo',
        'Categoria',
        'Ubicazione',
        'Giacenza',
        'Unita',
        'Scorta Minima',
        'Fornitore',
        'Note',
      ];
      const rows = filteredCatalog.map((i) => [
        i.sku,
        i.barcode || '',
        i.name,
        i.category,
        i.location || '',
        i.quantity,
        i.unit,
        i.minStock,
        i.supplier || '',
        i.notes || '',
      ]);
      csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${isHistory ? 'Movimenti_Magazzino' : 'Catalogo_Magazzino'}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleSaveEditor = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = formName.trim();
    const cleanSku = formSku.trim().toUpperCase();
    const cleanBarcode = formBarcode.trim();

    if (cleanName.length < 2) {
      setFormError('Inserisci il nome dell\'articolo (almeno 2 caratteri).');
      return;
    }
    if (!cleanSku) {
      setFormError('Inserisci un codice SKU.');
      return;
    }

    const duplicate = items.find(
      (it) =>
        it.id !== editingItemId &&
        (it.sku.trim().toUpperCase() === cleanSku ||
          (cleanBarcode &&
            it.barcode &&
            it.barcode.trim().toUpperCase() === cleanBarcode.toUpperCase()))
    );
    if (duplicate) {
      setFormError(
        `Esiste già un articolo con questo SKU o codice a barre: "${duplicate.name}" (${duplicate.sku}).`
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const qtyNum = Math.max(0, Number(formQty) || 0);
    const minStockNum = Math.max(0, Number(formMinStock) || 0);

    if (editingItemId) {
      const prevItem = items.find((i) => i.id === editingItemId);
      const nextItems = items.map((it) =>
        it.id === editingItemId
          ? {
              ...it,
              sku: cleanSku,
              barcode: cleanBarcode || undefined,
              name: cleanName,
              category: formCategory.trim() || 'Generale',
              unit: formUnit || 'pz',
              quantity: qtyNum,
              minStock: minStockNum,
              location: formLocation.trim() || 'Magazzino',
              supplier: formSupplier.trim() || undefined,
              notes: formNotes.trim() || undefined,
              isFavorite: formFavorite,
              photoDataUrl: formPhoto || undefined,
              attachments: formAttachments,
              updatedAt: nowIso,
            }
          : it
      );

      let nextMovements = movements;
      if (prevItem && prevItem.quantity !== qtyNum) {
        const diff = Math.round((qtyNum - prevItem.quantity) * 100) / 100;
        const adjMov: StockMovement = {
          id: `mov-edit-${Date.now()}`,
          itemId: editingItemId,
          sku: cleanSku,
          itemName: cleanName,
          unit: formUnit || 'pz',
          type: diff > 0 ? 'carico' : 'scarico',
          quantity: Math.abs(diff),
          previousQty: prevItem.quantity,
          resultingQty: qtyNum,
          reason: 'Rettifica manuale giacenza',
          commessaCode: scanCommessaCode.trim() || undefined,
          operatorName: currentUser.name,
          timestamp: nowIso,
        };
        nextMovements = [adjMov, ...movements];
      }

      onUpdateInventory(
        {
          ...inventory,
          items: nextItems,
          movements: nextMovements,
        },
        `Articolo "${cleanName}" aggiornato`
      );
      setEditorOpen(false);
      return;
    }

    const newId = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newItem: WarehouseStockItem = {
      id: newId,
      sku: cleanSku,
      barcode: cleanBarcode || undefined,
      name: cleanName,
      category: formCategory.trim() || 'Generale',
      unit: formUnit || 'pz',
      quantity: qtyNum,
      minStock: minStockNum,
      location: formLocation.trim() || 'Magazzino',
      supplier: formSupplier.trim() || undefined,
      notes: formNotes.trim() || undefined,
      isFavorite: formFavorite,
      usageCount: 1,
      photoDataUrl: formPhoto || undefined,
      attachments: formAttachments,
      updatedAt: nowIso,
    };

    const movId = `mov-new-${Date.now()}`;
    const initMov: StockMovement | null =
      qtyNum > 0
        ? {
            id: movId,
            itemId: newId,
            sku: cleanSku,
            itemName: cleanName,
            unit: newItem.unit,
            type: 'carico',
            quantity: qtyNum,
            previousQty: 0,
            resultingQty: qtyNum,
            reason: isFromUnknownScan
              ? 'Nuovo articolo registrato da lettore barcode'
              : 'Inserimento nuovo articolo in magazzino',
            commessaCode: scanCommessaCode.trim() || undefined,
            operatorName: currentUser.name,
            timestamp: nowIso,
          }
        : null;

    onUpdateInventory(
      {
        ...inventory,
        items: [newItem, ...items],
        movements: initMov ? [initMov, ...movements] : movements,
      },
      `Articolo "${cleanName}" salvato (${qtyNum} ${newItem.unit})`
    );

    if (isFromUnknownScan) {
      if (soundEnabled) playScannerBeep('in');
      setLastScannedBanner({
        kind: 'in',
        title: `${cleanName} — Registrato`,
        detail: `Codice ${cleanBarcode || cleanSku} memorizzato per le scansioni successive`,
        resultingQty: qtyNum,
        unit: newItem.unit,
        lowStock: qtyNum <= minStockNum,
      });
      if (initMov) {
        setSessionLog((prev) => [
          {
            id: `ses-new-${Date.now()}`,
            movementId: movId,
            itemId: newId,
            sku: cleanSku,
            barcode: cleanBarcode || undefined,
            name: cleanName,
            mode: 'carico',
            quantity: qtyNum,
            unit: newItem.unit,
            previousQty: 0,
            resultingQty: qtyNum,
            timestamp: nowIso,
            isNewItem: true,
          },
          ...prev.slice(0, 49),
        ]);
      }
    }

    setEditorOpen(false);
    setIsFromUnknownScan(false);
  };

  const navItems: {
    id: WarehouseTab;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    tone?: 'amber' | 'rose';
  }[] = [
    { id: 'catalog', label: 'Catalogo Articoli', count: items.length, icon: Layers },
    { id: 'pos', label: 'Lettore Barcode', count: sessionLog.filter((s) => !s.undone).length, icon: ScanBarcode },
    { id: 'favorites', label: 'Preferiti', count: favoriteItems.length, icon: Star, tone: 'amber' },
    {
      id: 'low_stock',
      label: 'Sotto Scorta',
      count: lowStockItems.length,
      icon: AlertTriangle,
      tone: lowStockItems.length > 0 ? 'rose' : undefined,
    },
    { id: 'history', label: 'Movimenti', count: movements.length, icon: History },
  ];

  const sectionTitles: Record<WarehouseTab, string> = {
    catalog: 'Catalogo Magazzino',
    pos: 'Lettore Barcode USB / SKU',
    favorites: 'Articoli Preferiti',
    low_stock: 'Materiali Sotto Scorta',
    history: 'Registro Movimenti',
  };

  const getStockStatus = (item: WarehouseStockItem) => {
    if (item.quantity <= 0) {
      return { label: 'Esaurito', textClass: 'text-rose-700', barClass: 'bg-rose-600' };
    }
    if (item.quantity <= item.minStock) {
      return { label: 'Sotto scorta', textClass: 'text-amber-700', barClass: 'bg-amber-500' };
    }
    return { label: 'Regolare', textClass: 'text-emerald-700', barClass: 'bg-emerald-600' };
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-50 text-slate-900 overflow-hidden">
      {/* ===================================================================
          SIDEBAR SINISTRA STRUTTURATA
      =================================================================== */}
      <aside className="w-full md:w-60 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-orange-400 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
            Magazzino
          </span>
        </div>

        {/* Navigazione principale */}
        <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer whitespace-nowrap transition-colors shrink-0 md:shrink ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      active
                        ? 'text-orange-400'
                        : item.tone === 'rose'
                        ? 'text-rose-600'
                        : item.tone === 'amber'
                        ? 'text-amber-500'
                        : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    active ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Categorie rapide nella sidebar (desktop) */}
        <div className="hidden md:flex flex-col flex-1 min-h-0 border-t border-slate-200 mt-1">
          <div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
            <span>Categorie</span>
            {categoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="text-orange-600 hover:underline cursor-pointer font-medium"
              >
                Tutte
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all');
                if (activeTab !== 'catalog' && activeTab !== 'low_stock') {
                  setActiveTab('catalog');
                }
              }}
              className={`w-full px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="truncate">Tutte le categorie</span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                {items.length}
              </span>
            </button>
            {categories.map((cat) => {
              const count = categoryCounts.get(cat) || 0;
              const isSelected = categoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(cat);
                    if (activeTab !== 'catalog' && activeTab !== 'low_stock') {
                      setActiveTab('catalog');
                    }
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-orange-50 text-orange-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{cat}</span>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Sidebar */}
        <div className="hidden md:flex items-center justify-between gap-2 px-3 py-2.5 border-t border-slate-200 bg-slate-50/70">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
            title={soundEnabled ? 'Disattiva segnale acustico' : 'Attiva segnale acustico'}
          >
            {soundEnabled ? (
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{soundEnabled ? 'Bip attivo' : 'Bip muto'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 flex items-center gap-1 cursor-pointer transition-colors"
            title="Esporta elenco attuale in CSV Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
            <span>CSV</span>
          </button>
        </div>
      </aside>

      {/* ===================================================================
          AREA PRINCIPALE + INSPECTOR LATERALE
      =================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar 1 riga */}
        <header className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              {sectionTitles[activeTab]}
            </h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5 truncate">
              {items.length} articoli · {totalUnitsInStock} unità totali ·{' '}
              {lowStockItems.length} sotto scorta · {todayStats.total} movimenti oggi
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeTab !== 'pos' && (
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              >
                <ScanBarcode className="w-3.5 h-3.5 text-slate-500" />
                <span>Lettore Barcode</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openNewItemModal('', false)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-orange-400" />
              <span>Nuovo Articolo</span>
            </button>
          </div>
        </header>

        {/* Contenuto + Side Drawer */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <main className="flex-1 min-w-0 overflow-y-auto p-5">
            {/* ===============================================================
                TAB 1 & TAB 4: CATALOGO ARTICOLI & SOTTO SCORTA
            =============================================================== */}
            {(activeTab === 'catalog' || activeTab === 'low_stock') && (
              <div className="max-w-7xl mx-auto space-y-4">
                {/* 4 KPI Piani a singola elevazione */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                    <div className="text-xs text-slate-500">Articoli in catalogo</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {items.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {favoriteItems.length} preferiti salvati
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                    <div className="text-xs text-slate-500">Unità complessive</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {totalUnitsInStock}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      su {categories.filter((c) => (categoryCounts.get(c) || 0) > 0).length}{' '}
                      categorie attive
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveTab(activeTab === 'low_stock' ? 'catalog' : 'low_stock')
                    }
                    className={`text-left border rounded-xl px-4 py-3 cursor-pointer transition-colors ${
                      lowStockItems.length > 0
                        ? 'bg-white border-amber-300 hover:bg-amber-50/40'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-xs text-slate-500">Sotto scorta minima</div>
                    <div
                      className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                        lowStockItems.length > 0 ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {lowStockItems.length}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {outOfStockCount > 0
                        ? `${outOfStockCount} completamente esauriti`
                        : 'Nessun articolo a zero'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="text-left bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-3 cursor-pointer transition-colors"
                  >
                    <div className="text-xs text-slate-500">Movimenti oggi</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {todayStats.total}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      +{todayStats.inCount} entrate · −{todayStats.outCount} uscite
                    </div>
                  </button>
                </div>

                {/* Barra ricerca, ordinamento e cambio vista */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cerca nome, SKU, barcode, scaffale o fornitore..."
                        className="w-full pl-8 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                          aria-label="Pulisci ricerca"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-2.5 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-slate-900"
                    >
                      <option value="all">Tutte le categorie</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as CatalogSort)}
                        className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                      >
                        <option value="name_asc">Nome (A–Z)</option>
                        <option value="qty_asc">Giacenza crescente</option>
                        <option value="qty_desc">Giacenza decrescente</option>
                        <option value="used_desc">Più movimentati</option>
                        <option value="updated_desc">Aggiornati di recente</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-slate-500 tabular-nums hidden sm:inline">
                      {filteredCatalog.length} risultati
                    </span>
                    <div className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                          viewMode === 'table'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Vista Tabella ad alta densità"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Tabella</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors ${
                          viewMode === 'grid'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                        title="Vista Schede"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Schede</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista Articoli (Empty / Tabella / Schede) */}
                {filteredCatalog.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
                    <Package className="w-9 h-9 text-slate-300 mx-auto" />
                    <div className="text-sm font-semibold text-slate-800">
                      {activeTab === 'low_stock'
                        ? 'Nessun articolo sotto scorta minima'
                        : 'Nessun articolo corrisponde ai filtri'}
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {activeTab === 'low_stock'
                        ? 'Tutte le giacenze sono sopra la soglia minima configurata.'
                        : 'Aggiungi un nuovo articolo oppure modifica i criteri di ricerca.'}
                    </p>
                    <div className="pt-1 flex items-center justify-center gap-2">
                      {(searchQuery || categoryFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setCategoryFilter('all');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          Ripristina filtri
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openNewItemModal('', false)}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                      >
                        Aggiungi primo articolo
                      </button>
                    </div>
                  </div>
                ) : viewMode === 'table' ? (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                            <th className="py-2.5 pl-4 pr-2 w-8"></th>
                            <th className="py-2.5 px-3">Articolo e Codici</th>
                            <th className="py-2.5 px-3">Categoria / Ubicazione</th>
                            <th className="py-2.5 px-3 text-right">Giacenza</th>
                            <th className="py-2.5 px-3">Stato Scorta</th>
                            <th className="py-2.5 pl-3 pr-4 text-right">Azioni Rapide</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCatalog.map((item) => {
                            const status = getStockStatus(item);
                            const isSelected = selectedItemId === item.id;
                            const isConfirmDel = confirmDeleteId === item.id;
                            const attCount = item.attachments?.length || 0;
                            const ratio =
                              item.minStock > 0
                                ? Math.min(
                                    100,
                                    Math.round((item.quantity / (item.minStock * 2)) * 100)
                                  )
                                : item.quantity > 0
                                ? 100
                                : 0;

                            return (
                              <tr
                                key={item.id}
                                onClick={() => {
                                  setSelectedItemId(item.id);
                                  setDrawerQty(1);
                                  setDrawerReason('');
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-orange-50/70'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td
                                  className="py-2.5 pl-4 pr-1 align-middle"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFavorite(item.id)}
                                    className={`p-1 cursor-pointer transition-colors ${
                                      item.isFavorite
                                        ? 'text-amber-500'
                                        : 'text-slate-300 hover:text-amber-400'
                                    }`}
                                    title={
                                      item.isFavorite
                                        ? 'Rimuovi dai Preferiti'
                                        : 'Aggiungi ai Preferiti'
                                    }
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        item.isFavorite ? 'fill-amber-400' : ''
                                      }`}
                                    />
                                  </button>
                                </td>

                                <td className="py-2.5 px-3 align-middle">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                      {item.photoDataUrl ? (
                                        <img
                                          src={item.photoDataUrl}
                                          alt={item.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <Package className="w-4 h-4 text-slate-400" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold text-slate-900 truncate max-w-[260px]">
                                        {item.name}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-mono truncate max-w-[280px]">
                                        {item.sku}
                                        {item.barcode ? ` · ${item.barcode}` : ''}
                                        {attCount > 0 ? ` · ${attCount} allegati` : ''}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 align-middle">
                                  <div className="text-slate-800 font-medium truncate max-w-[180px]">
                                    {item.category}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                    {item.location || 'Magazzino'}
                                    {item.supplier ? ` · ${item.supplier}` : ''}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap">
                                  <div className="font-mono text-sm font-bold tabular-nums text-slate-900">
                                    {item.quantity}{' '}
                                    <span className="text-[11px] font-normal text-slate-500">
                                      {item.unit}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                    min. {item.minStock}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                                  <div className="w-28 space-y-1">
                                    <div className={`text-[11px] font-semibold ${status.textClass}`}>
                                      {status.label}
                                    </div>
                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        style={{ width: `${ratio}%` }}
                                        className={`h-full rounded-full ${status.barClass}`}
                                      />
                                    </div>
                                  </div>
                                </td>

                                <td
                                  className="py-2.5 pl-3 pr-4 align-middle text-right whitespace-nowrap"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        applyStockMovement(
                                          item,
                                          'scarico',
                                          1,
                                          'Uscita rapida da catalogo'
                                        )
                                      }
                                      className="px-2 py-1 rounded-md bg-white hover:bg-rose-600 text-rose-700 hover:text-white border border-slate-200 hover:border-rose-600 font-mono text-[11px] font-bold cursor-pointer transition-colors"
                                      title="Scarica 1"
                                    >
                                      −1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        applyStockMovement(
                                          item,
                                          'carico',
                                          1,
                                          'Entrata rapida da catalogo'
                                        )
                                      }
                                      className="px-2 py-1 rounded-md bg-white hover:bg-emerald-600 text-emerald-700 hover:text-white border border-slate-200 hover:border-emerald-600 font-mono text-[11px] font-bold cursor-pointer transition-colors"
                                      title="Carica +1"
                                    >
                                      +1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditItemModal(item)}
                                      className="p-1.5 rounded-md hover:bg-slate-200/70 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                                      title="Modifica articolo"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {isConfirmDel ? (
                                      <div className="inline-flex items-center gap-1 ml-1">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteItem(item.id)}
                                          className="px-2 py-1 rounded-md bg-rose-600 text-white text-[10px] font-semibold cursor-pointer"
                                        >
                                          Conferma
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteId(null)}
                                          className="px-1.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium cursor-pointer"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(item.id)}
                                        className="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                                        title="Elimina articolo"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* Vista Schede pulita */
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {filteredCatalog.map((item) => {
                      const status = getStockStatus(item);
                      const isSelected = selectedItemId === item.id;
                      const attCount = item.attachments?.length || 0;
                      const ratio =
                        item.minStock > 0
                          ? Math.min(
                              100,
                              Math.round((item.quantity / (item.minStock * 2)) * 100)
                            )
                          : item.quantity > 0
                          ? 100
                          : 0;

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setDrawerQty(1);
                            setDrawerReason('');
                          }}
                          className={`bg-white rounded-xl border p-4 flex flex-col justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-slate-900'
                              : item.quantity <= item.minStock
                              ? 'border-amber-300 hover:border-amber-400'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                              {item.photoDataUrl ? (
                                <img
                                  src={item.photoDataUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="text-sm font-semibold text-slate-900 truncate">
                                  {item.name}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(item.id);
                                  }}
                                  className={`p-0.5 cursor-pointer shrink-0 ${
                                    item.isFavorite
                                      ? 'text-amber-500'
                                      : 'text-slate-300 hover:text-amber-400'
                                  }`}
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      item.isFavorite ? 'fill-amber-400' : ''
                                    }`}
                                  />
                                </button>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                                {item.sku}
                                {item.barcode ? ` · ${item.barcode}` : ''}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {item.category} · {item.location || 'Magazzino'}
                                {attCount > 0 ? ` · ${attCount} file` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-baseline justify-between">
                              <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                                {item.quantity}{' '}
                                <span className="text-xs font-normal text-slate-500">
                                  {item.unit}
                                </span>
                              </span>
                              <span className={`text-[11px] font-semibold ${status.textClass}`}>
                                {status.label} · min. {item.minStock}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${ratio}%` }}
                                className={`h-full rounded-full ${status.barClass}`}
                              />
                            </div>
                          </div>

                          <div
                            className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  applyStockMovement(
                                    item,
                                    'scarico',
                                    1,
                                    'Uscita rapida da catalogo'
                                  )
                                }
                                className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-slate-200 hover:border-rose-600 font-mono text-xs font-bold cursor-pointer transition-colors"
                              >
                                −1
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  applyStockMovement(
                                    item,
                                    'carico',
                                    1,
                                    'Entrata rapida da catalogo'
                                  )
                                }
                                className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-slate-200 hover:border-emerald-600 font-mono text-xs font-bold cursor-pointer transition-colors"
                              >
                                +1
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEditItemModal(item)}
                              className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Modifica</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 2: LETTORE BARCODE USB / SKU (SENZA TELECAMERA)
            =============================================================== */}
            {activeTab === 'pos' && (
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-7 space-y-4">
                  {/* Terminale Barcode Pulito */}
                  <form
                    onSubmit={handleScanSubmit}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Segmented Mode Control */}
                      <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setScanMode('carico')}
                          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            scanMode === 'carico'
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <ArrowDownCircle className="w-3.5 h-3.5" />
                          <span>Entrata (+)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setScanMode('scarico')}
                          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                            scanMode === 'scarico'
                              ? 'bg-rose-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>Uscita (−)</span>
                        </button>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={autoFocusScanner}
                          onChange={(e) => setAutoFocusScanner(e.target.checked)}
                          className="rounded accent-slate-900"
                        />
                        <span>Mantieni campo pronto per pistola USB</span>
                      </label>
                    </div>

                    {/* Campo Codice a Barre / SKU */}
                    <div className="relative">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            ref={scannerInputRef}
                            type="text"
                            value={scanCodeInput}
                            onChange={(e) => setScanCodeInput(e.target.value)}
                            placeholder="Scansiona codice a barre con lettore USB o digita SKU e premi Invio..."
                            autoComplete="off"
                            className="w-full pl-10 pr-4 py-3 text-sm font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <button
                          type="submit"
                          className={`px-5 py-3 rounded-lg text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                            scanMode === 'carico'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-rose-600 hover:bg-rose-700'
                          }`}
                        >
                          {scanMode === 'carico' ? 'Carica +' : 'Scarica −'}
                        </button>
                      </div>

                      {/* Autocompletamento rapido durante digitazione manuale */}
                      {scannerSuggestions.length > 0 && (
                        <div className="mt-1.5 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 shadow-md overflow-hidden">
                          {scannerSuggestions.map((sug) => (
                            <button
                              key={sug.id}
                              type="button"
                              onClick={() => {
                                applyStockMovement(
                                  sug,
                                  scanMode,
                                  scanQty,
                                  scanMode === 'carico'
                                    ? 'Entrata rapida da terminale'
                                    : 'Uscita rapida da terminale'
                                );
                                setScanCodeInput('');
                              }}
                              className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-900 truncate">
                                  {sug.name}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500">
                                  {sug.sku}
                                  {sug.barcode ? ` · ${sug.barcode}` : ''}
                                </div>
                              </div>
                              <div className="text-xs font-mono tabular-nums text-slate-700 shrink-0">
                                {sug.quantity} {sug.unit}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quantità e Commessa */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                      <div className="sm:col-span-7">
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                          Quantità per operazione
                        </label>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 5, 10].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setScanQty(preset)}
                              className={`px-2.5 py-1.5 rounded-md font-mono text-xs font-semibold border cursor-pointer transition-colors ${
                                scanQty === preset
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              ×{preset}
                            </button>
                          ))}
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={scanQty}
                            onChange={(e) =>
                              setScanQty(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-20 px-2.5 py-1.5 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md text-center focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-5">
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                          Commessa associata
                        </label>
                        <select
                          value={scanCommessaCode}
                          onChange={(e) => setScanCommessaCode(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:border-slate-900"
                        >
                          <option value="">Magazzino generale</option>
                          {loads.map((ld) => (
                            <option key={ld.id} value={ld.code}>
                              {ld.code} — {ld.title}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500">
                      Se il codice esiste già la giacenza si aggiorna subito; se è nuovo si apre la scheda per registrarlo una sola volta.
                    </p>
                  </form>

                  {/* Conferma ultima operazione */}
                  {lastScannedBanner && (
                    <div
                      className={`rounded-xl border px-4 py-3.5 flex items-center justify-between gap-4 ${
                        lastScannedBanner.kind === 'in'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                          : lastScannedBanner.kind === 'out'
                          ? 'bg-rose-50 border-rose-200 text-rose-950'
                          : 'bg-amber-50 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {lastScannedBanner.title}
                          </div>
                          <div className="text-xs opacity-80 truncate">
                            {lastScannedBanner.detail}
                          </div>
                          {lastScannedBanner.lowStock && (
                            <div className="text-xs font-semibold text-rose-700 mt-0.5">
                              Attenzione: articolo sotto la scorta minima
                            </div>
                          )}
                        </div>
                      </div>
                      {lastScannedBanner.resultingQty !== undefined && (
                        <div className="text-right shrink-0">
                          <div className="text-[11px] opacity-70">Giacenza</div>
                          <div className="text-lg font-bold font-mono tabular-nums">
                            {lastScannedBanner.resultingQty} {lastScannedBanner.unit}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Preferiti rapidi */}
                  {favoriteItems.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-slate-700">
                          Accesso rapido Preferiti ({scanMode === 'carico' ? `+${scanQty}` : `−${scanQty}`})
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab('favorites')}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          Gestisci preferiti
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {favoriteItems.slice(0, 6).map((fav) => (
                          <button
                            key={fav.id}
                            type="button"
                            onClick={() => applyStockMovement(fav, scanMode, scanQty)}
                            className="p-2.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left cursor-pointer transition-colors"
                          >
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {fav.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
                              {fav.quantity} {fav.unit} · {fav.sku}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Colonna destra: Registro Sessione */}
                <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden max-h-[600px]">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Registro Sessione
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {sessionLog.filter((s) => !s.undone).length} operazioni attive
                      </div>
                    </div>
                    {sessionLog.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSessionLog([])}
                        className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        Pulisci elenco
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {sessionLog.length === 0 ? (
                      <div className="py-16 px-6 text-center space-y-2">
                        <ScanBarcode className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="text-xs font-semibold text-slate-700">
                          In attesa di scansioni
                        </div>
                        <p className="text-xs text-slate-500">
                          Ogni codice battuto con il lettore USB o digitato apparirà qui con possibilità di annullamento immediato.
                        </p>
                      </div>
                    ) : (
                      sessionLog.map((entry) => (
                        <div
                          key={entry.id}
                          className={`px-4 py-3 flex items-center justify-between gap-3 ${
                            entry.undone ? 'opacity-45 line-through' : ''
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {entry.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
                              {entry.mode === 'carico' ? 'Entrata' : 'Uscita'} · {entry.sku} ·{' '}
                              {entry.previousQty} → {entry.resultingQty} {entry.unit}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`font-mono text-xs font-bold tabular-nums ${
                                entry.mode === 'carico'
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                              }`}
                            >
                              {entry.mode === 'carico' ? '+' : '−'}
                              {entry.quantity}
                            </span>
                            {!entry.undone && (
                              <button
                                type="button"
                                onClick={() => handleUndoSessionEntry(entry)}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-900 cursor-pointer"
                                title="Annulla operazione"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                TAB 3: PREFERITI
            =============================================================== */}
            {activeTab === 'favorites' && (
              <div className="max-w-6xl mx-auto space-y-5">
                {favoriteItems.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
                    <Star className="w-8 h-8 text-amber-300 mx-auto" />
                    <div className="text-sm font-semibold text-slate-800">
                      Nessun articolo nei Preferiti
                    </div>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Clicca la stella accanto a un articolo nel Catalogo per tenerlo in evidenza qui e nel Lettore Barcode.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {favoriteItems.map((item) => {
                      const status = getStockStatus(item);
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between gap-3 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900 truncate">
                                {item.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">
                                {item.sku} · {item.location || 'Magazzino'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(item.id);
                              }}
                              className="p-1 text-amber-500 cursor-pointer shrink-0"
                              title="Rimuovi dai Preferiti"
                            >
                              <Star className="w-4 h-4 fill-amber-400" />
                            </button>
                          </div>

                          <div
                            className="flex items-center justify-between pt-2.5 border-t border-slate-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div>
                              <div className="text-base font-bold font-mono tabular-nums text-slate-900">
                                {item.quantity}{' '}
                                <span className="text-xs font-normal text-slate-500">
                                  {item.unit}
                                </span>
                              </div>
                              <div className={`text-[11px] font-medium ${status.textClass}`}>
                                {status.label} · min. {item.minStock}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  applyStockMovement(
                                    item,
                                    'scarico',
                                    1,
                                    'Uscita rapida da Preferiti'
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-slate-200 hover:border-rose-600 font-mono text-xs font-bold cursor-pointer transition-colors"
                              >
                                −1
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  applyStockMovement(
                                    item,
                                    'carico',
                                    1,
                                    'Entrata rapida da Preferiti'
                                  )
                                }
                                className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-slate-200 hover:border-emerald-600 font-mono text-xs font-bold cursor-pointer transition-colors"
                              >
                                +1
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {mostUsedSuggestions.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-semibold text-slate-700">
                      Articoli più movimentati — aggiungi ai Preferiti
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {mostUsedSuggestions.map((it) => (
                        <div
                          key={it.id}
                          className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {it.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                              {it.sku} · {it.usageCount || 0} utilizzi
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(it.id)}
                            className="px-2.5 py-1 rounded-md bg-white hover:bg-amber-50 border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer shrink-0"
                          >
                            Aggiungi
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===============================================================
                TAB 5: STORICO MOVIMENTI
            =============================================================== */}
            {activeTab === 'history' && (
              <div className="max-w-7xl mx-auto space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center p-0.5 bg-slate-200/80 rounded-lg text-xs font-medium">
                      {(['all', 'carico', 'scarico'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setHistoryFilter(t)}
                          className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                            historyFilter === t
                              ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t === 'all'
                            ? 'Tutti'
                            : t === 'carico'
                            ? 'Solo Entrate'
                            : 'Solo Uscite'}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[220px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Filtra per articolo, SKU, commessa..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {filteredHistory.length} movimenti
                    </span>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                      <span>Esporta CSV</span>
                    </button>
                  </div>
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
                    Nessun movimento registrato con questi filtri.
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                          <th className="py-2.5 px-4">Data / Ora</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Articolo / SKU</th>
                          <th className="py-2.5 px-3 text-right">Quantità</th>
                          <th className="py-2.5 px-3">Commessa</th>
                          <th className="py-2.5 px-4">Causale e Operatore</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredHistory.slice(0, 200).map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                              {formatDateTime(m.timestamp)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`font-semibold ${
                                  m.type === 'carico' ? 'text-emerald-700' : 'text-rose-700'
                                }`}
                              >
                                {m.type === 'carico' ? 'Entrata' : 'Uscita'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{m.itemName}</div>
                              <div className="font-mono text-[11px] text-slate-500">{m.sku}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                              <span
                                className={
                                  m.type === 'carico' ? 'text-emerald-700' : 'text-rose-700'
                                }
                              >
                                {m.type === 'carico' ? '+' : '−'}
                                {m.quantity} {m.unit}
                              </span>
                              <div className="text-[11px] font-normal text-slate-400">
                                Giac.: {m.resultingQty}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {m.commessaCode || '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              <div>{m.reason}</div>
                              <div className="text-[11px] text-slate-400">{m.operatorName}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* =================================================================
              PANNELLO LATERALE DETTAGLIO ARTICOLO (INSPECTOR)
          ================================================================= */}
          {selectedItem && (
            <aside className="w-full max-w-sm border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {selectedItem.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    {selectedItem.sku}
                    {selectedItem.barcode ? ` · ${selectedItem.barcode}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditItemModal(selectedItem)}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                    title="Modifica scheda"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedItemId(null)}
                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                    title="Chiudi pannello"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {selectedItem.photoDataUrl && (
                  <img
                    src={selectedItem.photoDataUrl}
                    alt={selectedItem.name}
                    className="w-full max-h-44 object-contain rounded-lg bg-slate-50 border border-slate-200"
                  />
                )}

                {/* Giacenza & Ubicazione */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Giacenza attuale</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                      {selectedItem.quantity} {selectedItem.unit}
                    </div>
                    <div
                      className={`text-[11px] font-medium mt-0.5 ${
                        getStockStatus(selectedItem).textClass
                      }`}
                    >
                      {getStockStatus(selectedItem).label} (min. {selectedItem.minStock})
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-500">Posizione</div>
                    <div className="text-xs font-semibold text-slate-900 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{selectedItem.location || 'Magazzino'}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-1">
                      {selectedItem.category}
                    </div>
                  </div>
                </div>

                {/* Movimento rapido quantità personalizzata */}
                <div className="p-3.5 rounded-lg border border-slate-200 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Movimenta quantità</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={drawerQty}
                      onChange={(e) => setDrawerQty(Math.max(0.01, Number(e.target.value) || 1))}
                      className="w-20 px-2.5 py-1.5 font-mono font-semibold text-center bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:border-slate-900"
                    />
                    <input
                      type="text"
                      value={drawerReason}
                      onChange={(e) => setDrawerReason(e.target.value)}
                      placeholder="Causale (opzionale)"
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md focus:bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        applyStockMovement(
                          selectedItem,
                          'scarico',
                          drawerQty,
                          drawerReason || 'Scarico da scheda articolo'
                        );
                        setDrawerReason('');
                      }}
                      className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>Scarica {drawerQty}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        applyStockMovement(
                          selectedItem,
                          'carico',
                          drawerQty,
                          drawerReason || 'Carico da scheda articolo'
                        );
                        setDrawerReason('');
                      }}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Carica {drawerQty}</span>
                    </button>
                  </div>
                </div>

                {/* Dettagli fornitore & note */}
                {(selectedItem.supplier || selectedItem.notes) && (
                  <div className="space-y-1.5 text-slate-600 border-t border-slate-100 pt-3">
                    {selectedItem.supplier && (
                      <div>
                        <span className="text-slate-400">Fornitore:</span>{' '}
                        <span className="font-medium text-slate-800">{selectedItem.supplier}</span>
                      </div>
                    )}
                    {selectedItem.notes && (
                      <div>
                        <span className="text-slate-400">Note:</span>{' '}
                        <span className="text-slate-700">{selectedItem.notes}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Allegati */}
                {selectedItem.attachments && selectedItem.attachments.length > 0 && (
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <div className="font-semibold text-slate-800">
                      Allegati ({selectedItem.attachments.length})
                    </div>
                    {selectedItem.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="px-2.5 py-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate font-medium text-slate-800">
                            {att.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            {formatBytes(att.sizeBytes)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(att)}
                          className="p-1 text-slate-600 hover:text-slate-900 cursor-pointer shrink-0"
                          title="Scarica allegato"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ultimi movimenti di questo articolo */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <div className="font-semibold text-slate-800">
                    Ultimi movimenti articolo
                  </div>
                  {selectedItemMovements.length === 0 ? (
                    <div className="text-slate-400">Nessun movimento registrato.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {selectedItemMovements.map((m) => (
                        <div
                          key={m.id}
                          className="px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-slate-800 truncate">
                              {m.reason}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                              {formatDateTime(m.timestamp)}
                              {m.commessaCode ? ` · ${m.commessaCode}` : ''}
                            </div>
                          </div>
                          <div
                            className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                              m.type === 'carico' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {m.type === 'carico' ? '+' : '−'}
                            {m.quantity}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* =====================================================================
          MODAL: NUOVO ARTICOLO / MODIFICA ARTICOLO (SENZA TELECAMERA)
      ===================================================================== */}
      {editorOpen && (
        <div className="fixed inset-0 z-[85] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold">
                  {editingItemId
                    ? 'Modifica Articolo'
                    : isFromUnknownScan
                    ? 'Nuovo codice rilevato — Registra Articolo'
                    : 'Nuovo Articolo di Magazzino'}
                </h3>
                {isFromUnknownScan && (
                  <p className="text-[11px] text-amber-300 mt-0.5">
                    Una volta salvato, questo codice verrà riconosciuto automaticamente alle prossime scansioni.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveEditor}
              className="flex-1 overflow-y-auto p-5 space-y-4 text-xs"
            >
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome Articolo *
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Es. Bullone Inox M10×40"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="SKU-0001"
                    className="w-full px-3 py-2 font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Codice a Barre
                  </label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="EAN / Barcode"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Giacenza *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={formQty}
                    onChange={(e) => setFormQty(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Scorta Minima *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unità
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    list="warehouse-cat-list"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <datalist id="warehouse-cat-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ubicazione / Scaffale
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Es. Corsia B · Scaffale 3"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fornitore (opzionale)
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Nome fornitore"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Immagine da file & Allegati */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                      Immagine Articolo
                    </span>
                    {formPhoto && (
                      <button
                        type="button"
                        onClick={() => setFormPhoto('')}
                        className="text-[11px] text-rose-600 hover:underline cursor-pointer"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                  {formPhoto ? (
                    <img
                      src={formPhoto}
                      alt="Anteprima articolo"
                      className="w-full h-28 object-cover rounded-lg border border-slate-200"
                    />
                  ) : (
                    <label className="h-24 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-500 cursor-pointer">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-[11px] font-medium">
                        Carica immagine dal PC
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                      Schede Tecniche ({formAttachments.length})
                    </span>
                    <label className="text-[11px] font-semibold text-slate-700 hover:underline flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Allega file</span>
                      <input
                        type="file"
                        onChange={handleAttachmentUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {formAttachments.length === 0 ? (
                    <div className="h-24 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-[11px] text-slate-400 text-center px-3">
                      PDF, Excel o schede tecniche (max 4 MB per file)
                    </div>
                  ) : (
                    <div className="max-h-28 overflow-y-auto space-y-1">
                      {formAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="px-2 py-1.5 rounded-md bg-white border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-[11px] font-medium text-slate-800">
                            {att.name} ({formatBytes(att.sizeBytes)})
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormAttachments((prev) =>
                                prev.filter((a) => a.id !== att.id)
                              )
                            }
                            className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Note (opzionale)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Specifiche, dimensioni, codice fornitore..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formFavorite}
                  onChange={(e) => setFormFavorite(e.target.checked)}
                  className="accent-slate-900 w-4 h-4"
                />
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span className="font-semibold text-slate-800">
                  Aggiungi ai Preferiti
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
                >
                  {editingItemId ? 'Salva Modifiche' : 'Salva Articolo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
