import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Package,
  ScanBarcode,
  Star,
  Plus,
  Minus,
  Search,
  Camera,
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
  Sparkles,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import type { MultiFormatReader } from '@zxing/library';
import {
  createUniversalBarcodeReader,
  decodeBarcodeFromCanvas,
  decodeBarcodeFromVideoFrame,
} from '../utils/barcodeDecoder';
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
  photoDataUrl?: string;
  timestamp: string;
  isNewItem?: boolean;
  undone?: boolean;
}

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
      second: '2-digit',
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
  const [activeTab, setActiveTab] = useState<
    'pos' | 'favorites' | 'catalog' | 'low_stock' | 'history'
  >('pos');

  // POS / Barcode Checkout State
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
    photoDataUrl?: string;
    resultingQty?: number;
    unit?: string;
    lowStock?: boolean;
  } | null>(null);

  // Camera Barcode Scanner State (Universal ZXing + Native Fast-Path)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraDetectedCode, setCameraDetectedCode] = useState<string | null>(null);
  const [isDecodingPhoto, setIsDecodingPhoto] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const isFrameBusyRef = useRef<boolean>(false);
  const scanTickCountRef = useRef<number>(0);
  const photoScanInputRef = useRef<HTMLInputElement | null>(null);
  const lastCameraCodeRef = useRef<{ code: string; at: number }>({
    code: '',
    at: 0,
  });

  // Catalog Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'carico' | 'scarico'>(
    'all'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Create / Edit / Unknown-Barcode Registration Modal
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

  // Quick Preview Lightbox
  const [previewItem, setPreviewItem] = useState<WarehouseStockItem | null>(null);

  const scannerInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setScanCommessaCode((prev) => prev || activeLoad?.code || '');
  }, [activeLoad?.code]);

  // Keep barcode input focused in POS mode when autoFocusScanner is enabled
  useEffect(() => {
    if (activeTab === 'pos' && autoFocusScanner && !editorOpen && !previewItem) {
      const t = window.setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [activeTab, autoFocusScanner, editorOpen, previewItem, scanMode]);

  useEffect(() => {
    if (editorOpen && isFromUnknownScan) {
      const t = window.setTimeout(() => {
        nameInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [editorOpen, isFromUnknownScan]);

  // Cleanup camera stream on unmount
  const stopCameraScanner = useCallback(() => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isFrameBusyRef.current = false;
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((tr) => tr.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setCameraDetectedCode(null);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  const items = inventory.items;
  const movements = inventory.movements;

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    items.forEach((it) => {
      if (it.category?.trim()) set.add(it.category.trim());
    });
    return Array.from(set);
  }, [items]);

  const lowStockItems = useMemo(
    () => items.filter((it) => it.quantity <= it.minStock),
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

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((it) => {
      if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
      if (q) {
        const hay = `${it.name} ${it.sku} ${it.barcode || ''} ${it.location || ''} ${it.supplier || ''} ${it.category || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, categoryFilter, searchQuery]);

  const filteredHistory = useMemo(() => {
    return movements.filter((m) =>
      historyFilter === 'all' ? true : m.type === historyFilter
    );
  }, [movements, historyFilter]);

  const totalUnitsInStock = useMemo(
    () => items.reduce((acc, it) => acc + Math.max(0, Number(it.quantity) || 0), 0),
    [items]
  );

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

  // Core stock adjustment (used by barcode scanner, favorites quick-buttons, and catalog +/-)
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
          title: `${item.name} — Giacenza già a 0`,
          detail: `Impossibile scaricare ${safeQty} ${item.unit}: scorta esaurita in magazzino.`,
          photoDataUrl: item.photoDataUrl,
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
          reasonOverride ||
          (mode === 'carico'
            ? 'Entrata Magazzino (Lettore Barcode / Cassa)'
            : 'Uscita Magazzino (Lettore Barcode / Cassa)'),
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
        detail: `${mode === 'carico' ? 'ENTRATA' : 'USCITA'} ${
          mode === 'carico' ? '+' : '−'
        }${safeQty} ${item.unit} · ${item.sku}${
          item.barcode ? ` · Barcode ${item.barcode}` : ''
        }`,
        photoDataUrl: item.photoDataUrl,
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
          photoDataUrl: item.photoDataUrl,
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

  // Open Editor for New Item (or triggered automatically on unknown barcode scan!)
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
      setFormCategory(DEFAULT_CATEGORIES[0]);
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
    [items.length, scanQty]
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

  // Process scanned barcode (from USB wedge input or camera)
  const processScannedCode = useCallback(
    (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;
      const found = findItemByCode(code);
      if (found) {
        applyStockMovement(found, scanMode, scanQty);
      } else {
        if (soundEnabled) playScannerBeep('new');
        openNewItemModal(code, true);
      }
      setScanCodeInput('');
    },
    [findItemByCode, applyStockMovement, scanMode, scanQty, soundEnabled, openNewItemModal]
  );

  // Keep live refs so an open camera always uses the latest scanMode, scanQty & modal state
  const processScannedCodeRef = useRef(processScannedCode);
  useEffect(() => {
    processScannedCodeRef.current = processScannedCode;
  }, [processScannedCode]);

  const editorOpenRef = useRef(editorOpen);
  useEffect(() => {
    editorOpenRef.current = editorOpen;
  }, [editorOpen]);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScannedCode(scanCodeInput);
  };

  // Start Universal Cross-Browser Camera Barcode Scanner (works on Chrome Windows/Mac/Android/iOS, Edge, Firefox, Safari)
  const startCameraScanner = async (overrideDeviceId?: string) => {
    stopCameraScanner();
    setCameraError(null);
    setCameraDetectedCode(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Fotocamera live non disponibile in questo contesto. Usa "Leggi da Foto" oppure una pistola barcode USB/Bluetooth.'
      );
      return;
    }

    let stream: MediaStream | null = null;
    const targetDeviceId = overrideDeviceId ?? selectedDeviceId;

    try {
      if (targetDeviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          });
        } catch {
          // Fallback for desktop webcams that reject facingMode/resolution constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }
    } catch {
      setCameraError(
        'Permesso fotocamera negato o nessuna webcam trovata. Concedi il permesso al browser oppure usa "Leggi da Foto" o il lettore USB.'
      );
      return;
    }

    cameraStreamRef.current = stream;
    setIsCameraOpen(true);

    // Discover available cameras for optional switching
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(cams);
      const activeTrackId = stream.getVideoTracks()[0]?.getSettings()?.deviceId;
      if (activeTrackId) setSelectedDeviceId(activeTrackId);
    } catch {
      // ignore enumeration errors
    }

    window.setTimeout(() => {
      if (videoRef.current && cameraStreamRef.current) {
        videoRef.current.srcObject = cameraStreamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }, 60);

    // Optional native fast-path where available (Chrome Android/macOS)
    const DetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;

    let nativeDetector: {
      detect: (src: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
    } | null = null;
    if (DetectorCtor) {
      try {
        nativeDetector = new DetectorCtor({
          formats: [
            'ean_13',
            'ean_8',
            'code_128',
            'code_39',
            'upc_a',
            'upc_e',
            'qr_code',
            'itf',
          ],
        });
      } catch {
        nativeDetector = null;
      }
    }

    // Always initialize universal pure-JS ZXing decoder (works on EVERY browser including Chrome Windows & iOS!)
    if (!zxingReaderRef.current) {
      zxingReaderRef.current = createUniversalBarcodeReader();
    }
    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement('canvas');
    }
    scanTickCountRef.current = 0;

    const handleDetectedValue = (raw: string) => {
      const val = raw.trim();
      if (!val) return;
      const now = Date.now();
      if (
        val !== lastCameraCodeRef.current.code ||
        now - lastCameraCodeRef.current.at > 1800
      ) {
        lastCameraCodeRef.current = { code: val, at: now };
        setCameraDetectedCode(val);
        window.setTimeout(() => {
          setCameraDetectedCode((curr) => (curr === val ? null : curr));
        }, 1600);
        processScannedCodeRef.current(val);
      }
    };

    scanIntervalRef.current = window.setInterval(async () => {
      if (!cameraStreamRef.current || isFrameBusyRef.current || editorOpenRef.current) {
        return;
      }
      const vid = videoRef.current;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0 || vid.videoHeight === 0) {
        return;
      }
      isFrameBusyRef.current = true;
      try {
        // 1) Native BarcodeDetector fast-path if present
        if (nativeDetector) {
          try {
            const found = await nativeDetector.detect(vid);
            if (found.length > 0 && found[0].rawValue) {
              handleDetectedValue(found[0].rawValue);
              return;
            }
          } catch {
            // Fall through to universal ZXing decoder
          }
        }

        // 2) Universal ZXing decoder on offscreen canvas
        const canvas = scanCanvasRef.current;
        const reader = zxingReaderRef.current;
        if (!canvas || !reader) return;

        scanTickCountRef.current += 1;
        // Alternate between central laser-line strip (fast & crisp for 1D barcodes) and full frame (great for QR/tilted codes)
        const decoded = decodeBarcodeFromVideoFrame(
          reader,
          vid,
          canvas,
          scanTickCountRef.current % 2 === 0
        );
        if (decoded) {
          handleDetectedValue(decoded);
        }
      } finally {
        isFrameBusyRef.current = false;
      }
    }, 200);
  };

  const handleSwitchCamera = () => {
    if (videoDevices.length < 2) return;
    const idx = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const next = videoDevices[(idx + 1) % videoDevices.length];
    if (next) {
      setSelectedDeviceId(next.deviceId);
      startCameraScanner(next.deviceId);
    }
  };

  // Decode barcode/QR directly from a captured or uploaded photo (works even if live camera is blocked)
  const handleDecodeFromPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCameraError(null);
    setIsDecodingPhoto(true);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        if (!zxingReaderRef.current) {
          zxingReaderRef.current = createUniversalBarcodeReader();
        }
        const reader = zxingReaderRef.current;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas unavailable');

        const maxDim = 1400;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        // Attempt 1: Original orientation
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);
        let decoded = decodeBarcodeFromCanvas(reader, canvas);

        // Attempt 2: Rotate 90° clockwise (for vertical barcodes photographed sideways)
        if (!decoded) {
          canvas.width = h;
          canvas.height = w;
          ctx.save();
          ctx.translate(h / 2, w / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore();
          decoded = decodeBarcodeFromCanvas(reader, canvas);
        }

        if (decoded) {
          processScannedCode(decoded);
        } else {
          if (soundEnabled) playScannerBeep('warn');
          setCameraError(
            'Nessun codice a barre rilevato nella foto. Avvicinati al codice, metti bene a fuoco e riprova con buona luce.'
          );
        }
      } catch {
        setCameraError('Errore durante la lettura del codice a barre dalla foto.');
      } finally {
        URL.revokeObjectURL(objectUrl);
        setIsDecodingPhoto(false);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setIsDecodingPhoto(false);
      setCameraError('Impossibile aprire la foto selezionata.');
    };
    img.src = objectUrl;
  };

  // Undo a session scan entry cleanly
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
      `Annullata ultima battuta su ${entry.name}`
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
    if (previewItem?.id === itemId) setPreviewItem(null);
  };

  // Photo & Attachment pickers in Editor Modal
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 900, 0.78);
      setFormPhoto(compressed);
    } catch {
      setFormError('Impossibile leggere la foto selezionata.');
    }
    e.target.value = '';
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setFormError('Ogni file allegato all\'articolo può pesare al massimo 4 MB.');
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
          reason: 'Rettifica manuale giacenza in Magazzino',
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

    // Creating a BRAND NEW article -> saved permanently into warehouse & initial movement recorded
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
              : 'Inserimento nuovo articolo in Magazzino',
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
      `Nuovo articolo "${cleanName}" salvato nel gestionale (${qtyNum} ${newItem.unit})`
    );

    if (isFromUnknownScan) {
      if (soundEnabled) playScannerBeep('in');
      setLastScannedBanner({
        kind: 'in',
        title: `${cleanName} (Memorizzato nel gestionale)`,
        detail: `Nuovo codice ${cleanBarcode || cleanSku} registrato · alla prossima scansione verrà riconosciuto automaticamente`,
        photoDataUrl: newItem.photoDataUrl,
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
            photoDataUrl: newItem.photoDataUrl,
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

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-[#0d101c] text-white px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#fb9518] to-[#e66c05] flex items-center justify-center shadow-md shrink-0">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">
              Magazzino &amp; Cassa Lettore Barcode
            </h2>
            <p className="text-[11px] text-white/60 font-mono tabular-nums">
              {items.length} articoli · {totalUnitsInStock} unità totali ·{' '}
              {favoriteItems.length} preferiti · {lowStockItems.length} sotto scorta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            className="p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white/80 hover:text-white cursor-pointer transition-colors"
            title={soundEnabled ? 'Disattiva bip lettore' : 'Attiva bip lettore'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-white/45" />
            )}
          </button>
          <button
            type="button"
            onClick={() => openNewItemModal('', false)}
            className="px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nuovo Articolo</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 px-5 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
        {[
          {
            id: 'pos' as const,
            label: 'Cassa Lettore Barcode',
            icon: ScanBarcode,
          },
          {
            id: 'favorites' as const,
            label: `Preferiti (${favoriteItems.length})`,
            icon: Star,
          },
          {
            id: 'catalog' as const,
            label: `Catalogo Magazzino (${items.length})`,
            icon: Layers,
          },
          {
            id: 'low_stock' as const,
            label: `Sotto Scorta (${lowStockItems.length})`,
            icon: AlertTriangle,
          },
          {
            id: 'history' as const,
            label: `Movimenti (${movements.length})`,
            icon: History,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-3 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                active
                  ? 'border-orange-500 text-slate-950'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 ${
                  tab.id === 'favorites' && active
                    ? 'text-amber-500 fill-amber-400'
                    : tab.id === 'low_stock' && lowStockItems.length > 0
                    ? 'text-rose-600'
                    : ''
                }`}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
        {/* ===================================================================
            TAB 1: CASSA LETTORE BARCODE (STILE CASSA SUPERMERCATO)
        =================================================================== */}
        {activeTab === 'pos' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left / Main POS Terminal */}
            <div className="lg:col-span-7 space-y-4">
              {/* Big ENTRATA / USCITA Mode Toggle */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScanMode('carico')}
                  className={`p-4 rounded-2xl border-2 text-left flex items-center gap-3 cursor-pointer transition-all ${
                    scanMode === 'carico'
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      scanMode === 'carico'
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    <ArrowDownCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold tracking-tight">
                      ENTRATA (Carico +)
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        scanMode === 'carico' ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      Spara il codice per caricare in magazzino
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setScanMode('scarico')}
                  className={`p-4 rounded-2xl border-2 text-left flex items-center gap-3 cursor-pointer transition-all ${
                    scanMode === 'scarico'
                      ? 'bg-rose-600 border-rose-700 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-rose-400'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      scanMode === 'scarico'
                        ? 'bg-white/20 text-white'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    <ArrowUpCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold tracking-tight">
                      USCITA (Scarico −)
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        scanMode === 'scarico' ? 'text-rose-100' : 'text-slate-500'
                      }`}
                    >
                      Spara il codice per togliere dal magazzino
                    </div>
                  </div>
                </button>
              </div>

              {/* Barcode Scanner Input Box */}
              <form
                onSubmit={handleScanSubmit}
                className={`bg-white rounded-2xl border-2 p-5 space-y-4 shadow-xs transition-colors ${
                  scanMode === 'carico'
                    ? 'border-emerald-300'
                    : 'border-rose-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ScanBarcode
                      className={`w-5 h-5 ${
                        scanMode === 'carico' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      Lettore Codice a Barre / SKU
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoFocusScanner}
                        onChange={(e) => setAutoFocusScanner(e.target.checked)}
                        className="rounded accent-orange-500"
                      />
                      <span>Pistola sempre pronta</span>
                    </label>
                    <input
                      ref={photoScanInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleDecodeFromPhoto}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isDecodingPhoto}
                      onClick={() => photoScanInputRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                      title="Scatta o carica una foto del codice a barre per decodificarlo"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>{isDecodingPhoto ? 'Lettura...' : 'Leggi da Foto'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        isCameraOpen ? stopCameraScanner() : startCameraScanner()
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isCameraOpen
                          ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isCameraOpen ? 'Chiudi Camera' : 'Usa Fotocamera'}</span>
                    </button>
                  </div>
                </div>

                {/* Big Scanner Input */}
                <div className="flex gap-2">
                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={scanCodeInput}
                    onChange={(e) => setScanCodeInput(e.target.value)}
                    placeholder="Spara il codice a barre o digita SKU e premi Invio..."
                    autoComplete="off"
                    className="flex-1 px-4 py-3.5 text-base font-mono font-bold bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal focus:bg-white focus:outline-none focus:border-slate-900"
                  />
                  <button
                    type="submit"
                    className={`px-5 py-3.5 rounded-xl text-white text-sm font-extrabold cursor-pointer transition-colors shrink-0 ${
                      scanMode === 'carico'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {scanMode === 'carico' ? '+ Carica' : '− Togli'}
                  </button>
                </div>

                {/* Quantity multiplier & optional Commessa */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 items-end">
                  <div className="sm:col-span-7">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Quantità per ogni scansione
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 5, 10].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setScanQty(preset)}
                          className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-bold border cursor-pointer transition-colors ${
                            scanQty === preset
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
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
                        className="w-20 px-2.5 py-1.5 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg text-center focus:bg-white focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Commessa associata (opz.)
                    </label>
                    <select
                      value={scanCommessaCode}
                      onChange={(e) => setScanCommessaCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
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

                {/* Live Universal Camera Barcode Viewfinder */}
                {isCameraOpen && (
                  <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full max-h-64 object-cover"
                    />
                    {/* Target laser guide */}
                    <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500/90 shadow-[0_0_12px_rgba(244,63,94,0.95)] pointer-events-none" />
                    <div className="absolute inset-x-8 top-[22%] bottom-[22%] border border-white/25 rounded-lg pointer-events-none" />

                    {/* Top-left live status */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/70 text-white text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>
                        Inquadra barcode o QR (EAN, Code-128, UPC, QR)
                      </span>
                    </div>

                    {/* Camera switcher button if multiple cameras exist */}
                    {videoDevices.length > 1 && (
                      <button
                        type="button"
                        onClick={handleSwitchCamera}
                        className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-black/70 hover:bg-black/90 text-white text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer backdrop-blur-xs transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Cambia Camera</span>
                      </button>
                    )}

                    {/* Instant green confirmation overlay on decode */}
                    {cameraDetectedCode && (
                      <div className="absolute bottom-2.5 inset-x-3 px-3 py-1.5 rounded-lg bg-emerald-600/95 text-white text-xs font-mono font-bold text-center shadow-lg">
                        ✓ Codice letto: {cameraDetectedCode}
                      </div>
                    )}
                  </div>
                )}

                {cameraError && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    {cameraError}
                  </div>
                )}

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Se il codice a barre o lo SKU esiste già, la giacenza si aggiorna subito. Se è un codice nuovo, si apre la scheda di registrazione e viene memorizzato direttamente sul gestionale per tutte le volte successive.
                </p>
              </form>

              {/* Live Checkout Display Banner */}
              {lastScannedBanner && (
                <div
                  className={`rounded-2xl border p-4 flex items-center gap-4 shadow-2xs ${
                    lastScannedBanner.kind === 'in'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : lastScannedBanner.kind === 'out'
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-amber-50 border-amber-300 text-amber-950'
                  }`}
                >
                  {lastScannedBanner.photoDataUrl ? (
                    <img
                      src={lastScannedBanner.photoDataUrl}
                      alt={lastScannedBanner.title}
                      className="w-16 h-16 rounded-xl object-cover border border-black/10 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/70 border border-black/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold truncate">
                      {lastScannedBanner.title}
                    </div>
                    <div className="text-xs opacity-85 mt-0.5">
                      {lastScannedBanner.detail}
                    </div>
                    {lastScannedBanner.lowStock && (
                      <div className="text-[11px] font-bold text-rose-700 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Attenzione: articolo sotto la scorta minima!
                      </div>
                    )}
                  </div>
                  {lastScannedBanner.resultingQty !== undefined && (
                    <div className="text-right shrink-0 pl-2">
                      <div className="text-[10px] font-bold uppercase opacity-65">
                        In Magazzino
                      </div>
                      <div className="text-2xl font-black font-mono tabular-nums">
                        {lastScannedBanner.resultingQty}{' '}
                        <span className="text-xs font-semibold">
                          {lastScannedBanner.unit}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Favorites Strip right inside POS */}
              {favoriteItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                      Tasti Rapidi Preferiti (un click per {scanMode === 'carico' ? 'caricare' : 'togliere'})
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('favorites')}
                      className="text-[11px] font-semibold text-orange-600 hover:underline cursor-pointer"
                    >
                      Vedi tutti ({favoriteItems.length})
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {favoriteItems.slice(0, 6).map((fav) => (
                      <button
                        key={fav.id}
                        type="button"
                        onClick={() => applyStockMovement(fav, scanMode, scanQty)}
                        className="p-2.5 rounded-xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/40 text-left flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        {fav.photoDataUrl ? (
                          <img
                            src={fav.photoDataUrl}
                            alt={fav.name}
                            className="w-9 h-9 rounded-lg object-cover shrink-0 border border-slate-200"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {fav.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                            {fav.quantity} {fav.unit} · {scanMode === 'carico' ? `+${scanQty}` : `−${scanQty}`}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Scontrino / Battute Sessione */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden max-h-[640px]">
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider">
                    Scontrino Battute Sessione
                  </div>
                  <div className="text-[10px] text-white/60 font-mono tabular-nums">
                    {sessionLog.filter((s) => !s.undone).length} operazioni registrate
                  </div>
                </div>
                {sessionLog.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSessionLog([])}
                    className="text-[11px] text-white/70 hover:text-white cursor-pointer"
                  >
                    Pulisci vista
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                {sessionLog.length === 0 ? (
                  <div className="py-16 px-6 text-center space-y-2">
                    <ScanBarcode className="w-9 h-9 text-slate-300 mx-auto" />
                    <div className="text-xs font-bold text-slate-600">
                      Pronto per la prima scansione
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Ogni articolo scansionato con il lettore a barre o cliccato dai Preferiti apparirà qui in tempo reale con stato Entrata/Uscita.
                    </p>
                  </div>
                ) : (
                  sessionLog.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-xl flex items-center justify-between gap-2.5 ${
                        entry.undone ? 'opacity-45 line-through' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                              entry.mode === 'carico'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {entry.mode === 'carico' ? 'ENTRATA' : 'USCITA'}
                          </span>
                          {entry.isNewItem && (
                            <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                              NUOVO
                            </span>
                          )}
                          <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                            {formatDateTime(entry.timestamp)}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-900 truncate mt-1">
                          {entry.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {entry.sku} · {entry.previousQty} →{' '}
                          <strong className="text-slate-900">
                            {entry.resultingQty} {entry.unit}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono text-sm font-black tabular-nums ${
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
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-800 cursor-pointer"
                            title="Annulla questa battuta"
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

        {/* ===================================================================
            TAB 2: PREFERITI (ARTICOLI PIU UTILIZZATI)
        =================================================================== */}
        {activeTab === 'favorites' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  Articoli Preferiti — Accesso Rapido Entrata / Uscita
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Carica o scarica con un click gli articoli che usi più spesso in magazzino
                </p>
              </div>
              <button
                type="button"
                onClick={() => openNewItemModal('', false)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuovo Articolo</span>
              </button>
            </div>

            {favoriteItems.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                <Star className="w-9 h-9 text-amber-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">
                  Nessun articolo nei Preferiti
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Clicca la stellina ★ su qualsiasi articolo nel Catalogo Magazzino (o mentre ne registri uno nuovo) per tenerlo sempre a portata di mano qui e nella Cassa Lettore.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteItems.map((item) => {
                  const isLow = item.quantity <= item.minStock;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          {item.photoDataUrl ? (
                            <img
                              src={item.photoDataUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-slate-400" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            <div className="text-sm font-bold text-slate-900 truncate">
                              {item.name}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(item.id)}
                              className="p-1 text-amber-500 hover:scale-110 transition-transform cursor-pointer shrink-0"
                              title="Rimuovi dai Preferiti"
                            >
                              <Star className="w-4 h-4 fill-amber-400" />
                            </button>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate">
                            {item.sku}
                            {item.barcode ? ` · ${item.barcode}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{item.location || 'Magazzino'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div>
                          <div className="text-[10px] font-semibold uppercase text-slate-400">
                            Giacenza (min. {item.minStock})
                          </div>
                          <div
                            className={`text-xl font-black font-mono tabular-nums ${
                              isLow ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {item.quantity}{' '}
                            <span className="text-xs font-semibold text-slate-500">
                              {item.unit}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              applyStockMovement(item, 'scarico', 1, 'Uscita rapida da Preferiti')
                            }
                            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                            <span>1</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              applyStockMovement(item, 'carico', 1, 'Entrata rapida da Preferiti')
                            }
                            className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-xs font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>1</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Suggestions from Most Used */}
            {mostUsedSuggestions.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-orange-500" />
                  Più utilizzati di recente — aggiungi ai Preferiti
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {mostUsedSuggestions.map((it) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {it.name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                          {it.sku} · {it.usageCount || 0} utilizzi
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleFavorite(it.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Star className="w-3 h-3" />
                        <span>Aggiungi</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            TAB 3 & TAB 4: CATALOGO MAGAZZINO & SOTTO SCORTA
        =================================================================== */}
        {(activeTab === 'catalog' || activeTab === 'low_stock') && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca per nome, SKU, codice a barre, scaffale..."
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500"
                  />
                </div>
                {activeTab === 'catalog' && (
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500"
                  >
                    <option value="all">Tutte le categorie</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                onClick={() => openNewItemModal('', false)}
                className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Aggiungi Articolo</span>
              </button>
            </div>

            {(() => {
              const list =
                activeTab === 'low_stock'
                  ? filteredCatalog.filter((it) => it.quantity <= it.minStock)
                  : filteredCatalog;

              if (list.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
                    <Package className="w-9 h-9 text-slate-300 mx-auto" />
                    <div className="text-sm font-bold text-slate-700">
                      {activeTab === 'low_stock'
                        ? 'Nessun articolo sotto scorta minima'
                        : 'Nessun articolo trovato in magazzino'}
                    </div>
                    <p className="text-xs text-slate-500">
                      {activeTab === 'low_stock'
                        ? 'Tutte le giacenze sono sopra la soglia minima configurata.'
                        : 'Usa "Nuovo Articolo" oppure spara un codice a barre dalla Cassa Lettore per registrarlo subito.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {list.map((item) => {
                    const isLow = item.quantity <= item.minStock;
                    const ratio =
                      item.minStock > 0
                        ? Math.min(100, Math.round((item.quantity / (item.minStock * 2)) * 100))
                        : item.quantity > 0
                        ? 100
                        : 0;
                    const attCount = item.attachments?.length || 0;
                    const isConfirmDel = confirmDeleteId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border p-4 flex flex-col justify-between gap-3 shadow-2xs ${
                          isLow ? 'border-rose-300' : 'border-slate-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer group"
                            title="Apri scheda e allegati"
                          >
                            {item.photoDataUrl ? (
                              <img
                                src={item.photoDataUrl}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <Package className="w-6 h-6 text-slate-400" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewItem(item)}
                                className="text-sm font-bold text-slate-900 hover:text-orange-600 text-left truncate cursor-pointer"
                              >
                                {item.name}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleFavorite(item.id)}
                                className={`p-1 cursor-pointer shrink-0 transition-transform hover:scale-110 ${
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
                                  className={`w-4 h-4 ${
                                    item.isFavorite ? 'fill-amber-400' : ''
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="text-[11px] font-mono font-bold text-indigo-700 truncate">
                              SKU: {item.sku}
                            </div>
                            {item.barcode && (
                              <div className="text-[11px] font-mono text-slate-500 truncate flex items-center gap-1">
                                <ScanBarcode className="w-3 h-3 text-slate-400" />
                                {item.barcode}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2">
                              <span>{item.category}</span>
                              {item.location && <span>· {item.location}</span>}
                              {attCount > 0 && (
                                <span className="text-sky-700 font-semibold inline-flex items-center gap-0.5">
                                  <Paperclip className="w-3 h-3" />
                                  {attCount} file
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Stock Level Bar */}
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between">
                            <span
                              className={`text-lg font-black font-mono tabular-nums ${
                                isLow ? 'text-rose-600' : 'text-slate-900'
                              }`}
                            >
                              {item.quantity}{' '}
                              <span className="text-xs font-semibold text-slate-500">
                                {item.unit}
                              </span>
                            </span>
                            <span
                              className={`text-[11px] font-bold ${
                                isLow ? 'text-rose-600' : 'text-slate-500'
                              }`}
                            >
                              {isLow
                                ? `Sotto scorta (min. ${item.minStock})`
                                : `Scorta min. ${item.minStock}`}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              style={{ width: `${ratio}%` }}
                              className={`h-full rounded-full transition-all ${
                                isLow ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                applyStockMovement(
                                  item,
                                  'scarico',
                                  1,
                                  'Uscita rapida da Catalogo'
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-bold cursor-pointer transition-colors"
                              title="Togli 1 dal magazzino"
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
                                  'Entrata rapida da Catalogo'
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-200 text-xs font-bold cursor-pointer transition-colors"
                              title="Carica +1 in magazzino"
                            >
                              +1
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditItemModal(item)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                              title="Modifica articolo, foto e file"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {isConfirmDel ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="px-2 py-1 rounded-md bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                                >
                                  Elimina
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Elimina articolo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ===================================================================
            TAB 5: STORICO MOVIMENTI ENTRATA / USCITA
        =================================================================== */}
        {activeTab === 'history' && (
          <div className="max-w-6xl mx-auto space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
                {(['all', 'carico', 'scarico'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHistoryFilter(t)}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      historyFilter === t
                        ? t === 'carico'
                          ? 'bg-emerald-600 text-white'
                          : t === 'scarico'
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-900 text-white'
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
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {filteredHistory.length} movimenti
              </span>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                Nessun movimento registrato finora.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Data / Ora</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Articolo / SKU</th>
                      <th className="py-2.5 px-3 text-right">Quantità</th>
                      <th className="py-2.5 px-3">Commessa</th>
                      <th className="py-2.5 px-3">Causale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.slice(0, 200).map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                          {formatDateTime(m.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`font-bold ${
                              m.type === 'carico' ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {m.type === 'carico' ? 'Entrata' : 'Uscita'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">
                            {m.itemName}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            {m.sku}
                          </div>
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
                          <div className="text-[10px] font-normal text-slate-400">
                            Giac.: {m.resultingQty}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-indigo-700 font-semibold">
                          {m.commessaCode || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{m.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =====================================================================
          MODAL: REGISTRA NUOVO ARTICOLO (ANCHE DA BARCODE NON RICONOSCIUTO) / MODIFICA
      ===================================================================== */}
      {editorOpen && (
        <div className="fixed inset-0 z-[85] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 bg-[#0d101c] text-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold">
                  {editingItemId
                    ? 'Modifica Articolo di Magazzino'
                    : isFromUnknownScan
                    ? 'Codice non riconosciuto — Registra Nuovo Articolo'
                    : 'Nuovo Articolo di Magazzino'}
                </h3>
                {isFromUnknownScan && (
                  <p className="text-[11px] text-amber-300 mt-0.5">
                    Una volta salvato, questo codice a barre verrà memorizzato e riconosciuto automaticamente alle prossime scansioni.
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
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nome Articolo *
                  </label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Es. Bullone Inox M10×40"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="SKU-0001"
                    className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-bold text-slate-700 mb-1">
                    Codice a Barre
                  </label>
                  <input
                    type="text"
                    value={formBarcode}
                    onChange={(e) => setFormBarcode(e.target.value)}
                    placeholder="EAN / Barcode"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Quantità in Magazzino *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={formQty}
                    onChange={(e) => setFormQty(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Scorta Minima *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Unità
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    list="warehouse-cat-list"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
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
                  <label className="block font-bold text-slate-700 mb-1">
                    Ubicazione / Scaffale
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="Es. Corsia B · Scaffale 3"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Fornitore (opzionale)
                  </label>
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="Nome fornitore"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Photo & File Attachments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Foto Articolo */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-orange-600" />
                      Foto Articolo
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
                      className="w-full h-32 object-cover rounded-lg border border-slate-200"
                    />
                  ) : (
                    <label className="h-24 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-slate-50 flex flex-col items-center justify-center gap-1 text-slate-500 cursor-pointer">
                      <Camera className="w-5 h-5 text-slate-400" />
                      <span className="text-[11px] font-semibold">
                        Scatta o scegli foto
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

                {/* Allegati File (PDF / Excel / Schede) */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                      File / Schede Tecniche ({formAttachments.length})
                    </span>
                    <label className="text-[11px] font-bold text-sky-700 hover:underline flex items-center gap-1 cursor-pointer">
                      <Upload className="w-3 h-3" />
                      <span>Allega</span>
                      <input
                        type="file"
                        onChange={handleAttachmentUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {formAttachments.length === 0 ? (
                    <div className="h-24 rounded-lg border border-dashed border-slate-300 bg-white flex items-center justify-center text-[11px] text-slate-400 text-center px-3">
                      PDF, Excel, disegni o foto extra (max 4 MB per file)
                    </div>
                  ) : (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {formAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="px-2 py-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
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
                <label className="block font-bold text-slate-700 mb-1">
                  Note (opzionale)
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Specifiche, dimensioni, codice fornitore..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formFavorite}
                  onChange={(e) => setFormFavorite(e.target.checked)}
                  className="accent-amber-500 w-4 h-4"
                />
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                <span className="font-bold text-amber-950">
                  Aggiungi ai Preferiti (articoli più utilizzati)
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 font-extrabold cursor-pointer shadow-xs"
                >
                  {editingItemId
                    ? 'Salva Modifiche'
                    : 'Memorizza sul Gestionale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: SCHEDA DETTAGLIO ARTICOLO & ALLEGATI
      ===================================================================== */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[85] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-[#0d101c] text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{previewItem.name}</div>
                <div className="text-[11px] font-mono text-white/60">
                  SKU {previewItem.sku}
                  {previewItem.barcode ? ` · Barcode ${previewItem.barcode}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {previewItem.photoDataUrl && (
                <img
                  src={previewItem.photoDataUrl}
                  alt={previewItem.name}
                  className="w-full max-h-60 object-contain rounded-xl bg-slate-100 border border-slate-200"
                />
              )}

              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase">Giacenza</div>
                  <div className="text-lg font-black font-mono text-slate-900 tabular-nums">
                    {previewItem.quantity} {previewItem.unit}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase">Scorta Min.</div>
                  <div className="text-lg font-black font-mono text-slate-900 tabular-nums">
                    {previewItem.minStock} {previewItem.unit}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 uppercase">Ubicazione</div>
                  <div className="text-xs font-bold text-slate-900 mt-1 truncate">
                    {previewItem.location || 'Magazzino'}
                  </div>
                </div>
              </div>

              {previewItem.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  <strong>Note:</strong> {previewItem.notes}
                </div>
              )}

              {previewItem.attachments && previewItem.attachments.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-slate-700">
                    File Allegati ({previewItem.attachments.length})
                  </div>
                  <div className="space-y-1.5">
                    {previewItem.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="truncate font-semibold text-slate-800">
                            {att.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 shrink-0">
                            {formatBytes(att.sizeBytes)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(att)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Download className="w-3 h-3" />
                          <span>Scarica</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const target = previewItem;
                    setPreviewItem(null);
                    openEditItemModal(target);
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Modifica Articolo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
