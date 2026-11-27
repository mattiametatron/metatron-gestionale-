import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  QrCode,
  Printer,
  Download,
  ScanLine,
  Camera,
  Clock,
  Truck,
  Boxes,
  Box,
  Package,
  Search,
  CheckCircle2,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Volume2,
  VolumeX,
  RotateCcw,
  Eye,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import { CargoLoad, StockMovement } from '../types/warehouse';
import {
  formatItDateTime,
  fromDatetimeLocalValue,
  lookupScannedCodeAcrossLoads,
  resolveAllTrackingRecordsForLoad,
  ResolvedTrackingRecord,
  toDatetimeLocalValue,
  TrackEntityType,
  TrackingDetailedItem,
} from '../utils/qrTrackingUtils';
import {
  buildOutboundManifestData,
  downloadOutboundManifestExcel,
  downloadOutboundManifestPdf,
  openOutboundManifestPdfInNewTab,
} from '../utils/outboundManifestExporter';
import {
  downloadTrackingLabelsA4Pdf,
  openTrackingLabelsA4PdfInNewTab,
} from '../utils/pdfGenerator';
import type { MultiFormatReader } from '@zxing/library';
import { QrTrackingScanView } from './QrTrackingScanView';
import {
  createUniversalBarcodeReader,
  decodeBarcodeFromVideoFrame,
} from '../utils/barcodeDecoder';
import {
  translateLoadForPrint,
  usePrintLanguage,
} from '../utils/printLanguage';
import { PrintLanguageSelector } from './PrintLanguageSelector';

export interface DispatchTrackingResult {
  timestampIso?: string;
  itemsCount: number;
  piecesCount: number;
  warehouseMatchedCount: number;
}

interface QrLabelsA4WorkspaceProps {
  load: CargoLoad;
  allLoads: CargoLoad[];
  movements: StockMovement[];
  operatorName?: string;
  onStampEntityDate: (
    commessaCode: string,
    entityType: 'load' | TrackEntityType,
    entityId: string,
    field: 'loadedAt' | 'shippedAt',
    timestampIso: string | undefined
  ) => void;
  onDispatchTrackingRecord?: (
    record: ResolvedTrackingRecord,
    options?: { syncWarehouse?: boolean; undo?: boolean }
  ) => DispatchTrackingResult;
}

type WorkspaceTab = 'labels' | 'dispatch';

function playDispatchBeep(kind: 'ok' | 'info' | 'warn') {
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
    if (kind === 'ok') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1180, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (kind === 'info') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, now);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(270, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.21);
    }
    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 320);
  } catch {
    // ignore audio restrictions
  }
}

export const QrLabelsA4Workspace: React.FC<QrLabelsA4WorkspaceProps> = ({
  load,
  allLoads,
  movements,
  operatorName,
  onStampEntityDate,
  onDispatchTrackingRecord,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('labels');

  // Filtri Etichette A4
  const [includePallets, setIncludePallets] = useState(true);
  const [includeBoxes, setIncludeBoxes] = useState(true);
  const [includeItems, setIncludeItems] = useState(true);
  const [palletFilterId, setPalletFilterId] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [printLang, setPrintLang] = usePrintLanguage();

  // Scanner QR / Barcode condiviso (Pistola USB o Ricerca Manuale o Fotocamera)
  const [scannerInput, setScannerInput] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedRecord, setScannedRecord] = useState<ResolvedTrackingRecord | null>(null);

  // Stato Terminale Scarico Barcode & Distinta Uscita
  const [dispatchScannerInput, setDispatchScannerInput] = useState('');
  const [dispatchAutoUnload, setDispatchAutoUnload] = useState(true);
  const [dispatchSyncWarehouse, setDispatchSyncWarehouse] = useState(true);
  const [dispatchAutoFocus, setDispatchAutoFocus] = useState(true);
  const [dispatchSoundEnabled, setDispatchSoundEnabled] = useState(true);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [inspectedDispatchRef, setInspectedDispatchRef] = useState<{
    commessaCode: string;
    type: TrackEntityType;
    entityId: string;
    lastActionText?: string;
    lastActionAt?: string;
  } | null>(null);
  const [manifestOnlyShipped, setManifestOnlyShipped] = useState(true);
  const [manifestSearch, setManifestSearch] = useState('');

  const dispatchInputRef = useRef<HTMLInputElement | null>(null);

  // Live Camera Scanner (Universal ZXing + Native Fast-Path)
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<'labels' | 'dispatch'>('labels');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const isFrameBusyRef = useRef<boolean>(false);
  const scanTickRef = useRef<number>(0);

  const allRecords = useMemo(
    () => resolveAllTrackingRecordsForLoad(load, movements),
    [load, movements]
  );

  // Mantieni sincronizzato il record ispezionato nel terminale scarico con gli ultimi dati live
  const inspectedDispatchRecord = useMemo<ResolvedTrackingRecord | null>(() => {
    if (!inspectedDispatchRef) return null;
    const targetLoad =
      allLoads.find(
        (l) =>
          (l.code || '').trim().toUpperCase() ===
          inspectedDispatchRef.commessaCode.trim().toUpperCase()
      ) || load;
    const recs = resolveAllTrackingRecordsForLoad(targetLoad, movements);
    return (
      recs.find(
        (r) =>
          r.type === inspectedDispatchRef.type &&
          r.entityId === inspectedDispatchRef.entityId
      ) || null
    );
  }, [inspectedDispatchRef, allLoads, load, movements]);

  const inspectedDispatchLoad = useMemo<CargoLoad>(() => {
    if (!inspectedDispatchRecord) return load;
    return (
      allLoads.find(
        (l) =>
          (l.code || '').trim().toUpperCase() ===
          inspectedDispatchRecord.commessaCode.trim().toUpperCase()
      ) || load
    );
  }, [inspectedDispatchRecord, allLoads, load]);

  // Raggruppa gli articoli del collo ispezionato per Scatola + Fuori Scatola
  const inspectedContentGroups = useMemo(() => {
    if (!inspectedDispatchRecord) return [];
    const detailed = inspectedDispatchRecord.detailedItems || [];
    if (detailed.length === 0) return [];

    const map = new Map<
      string,
      { key: string; title: string; isBox: boolean; items: TrackingDetailedItem[] }
    >();
    detailed.forEach((item) => {
      const key = item.boxCode ? `box:${item.boxPath || item.boxCode}` : 'loose';
      const title = item.boxCode
        ? `${item.boxPath || item.boxCode}${item.boxLabel ? ` — ${item.boxLabel}` : ''}`
        : 'Fuori scatola (direttamente sul bancale)';
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(key, { key, title, isBox: Boolean(item.boxCode), items: [item] });
      }
    });
    return Array.from(map.values());
  }, [inspectedDispatchRecord]);

  // Distinta Merce in Uscita live per la commessa attiva
  const outboundManifest = useMemo(
    () =>
      buildOutboundManifestData(load, movements, {
        onlyShipped: manifestOnlyShipped,
      }),
    [load, movements, manifestOnlyShipped]
  );

  // Contatore globale solo scaricati per badge tab
  const shippedStats = useMemo(() => {
    const onlyOut = buildOutboundManifestData(load, movements, {
      onlyShipped: true,
    });
    return {
      packagesCount: onlyOut.packages.length,
      palletsCount: onlyOut.totals.palletsCount,
      boxesCount: onlyOut.totals.boxesCount,
      itemLinesCount: onlyOut.totals.itemLinesCount,
      totalPieces: onlyOut.totals.totalPieces,
      totalWeightKg: onlyOut.totals.totalWeightKg,
    };
  }, [load, movements]);

  const filteredManifestItems = useMemo(() => {
    const q = manifestSearch.trim().toLowerCase();
    if (!q) return outboundManifest.items;
    return outboundManifest.items.filter(
      (it) =>
        it.sku.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        it.palletCode.toLowerCase().includes(q) ||
        it.boxCode.toLowerCase().includes(q) ||
        it.boxPath.toLowerCase().includes(q) ||
        it.packageBarcode.toLowerCase().includes(q)
    );
  }, [outboundManifest.items, manifestSearch]);

  const packageRecordsForLoad = useMemo(
    () => allRecords.filter((r) => r.type === 'pallet' || r.type === 'box'),
    [allRecords]
  );

  const palletCodeFilter = useMemo(() => {
    if (palletFilterId === 'all') return null;
    return load.pallets.find((p) => p.id === palletFilterId)?.code || null;
  }, [load.pallets, palletFilterId]);

  const filteredRecords = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return allRecords.filter((rec) => {
      if (rec.type === 'pallet' && !includePallets) return false;
      if (rec.type === 'box' && !includeBoxes) return false;
      if (rec.type === 'item' && !includeItems) return false;
      if (palletCodeFilter && rec.palletCode !== palletCodeFilter) return false;
      if (q) {
        return (
          rec.code.toLowerCase().includes(q) ||
          rec.name.toLowerCase().includes(q) ||
          rec.locationPath.toLowerCase().includes(q) ||
          rec.barcodeValue.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    allRecords,
    includePallets,
    includeBoxes,
    includeItems,
    palletCodeFilter,
    searchText,
  ]);

  const counts = useMemo(() => {
    const pallets = allRecords.filter((r) => r.type === 'pallet').length;
    const boxes = allRecords.filter((r) => r.type === 'box').length;
    const items = allRecords.filter((r) => r.type === 'item').length;
    const pagesA4 = Math.max(1, Math.ceil(filteredRecords.length / 8));
    return { pallets, boxes, items, pagesA4 };
  }, [allRecords, filteredRecords.length]);

  useEffect(() => {
    if (activeTab === 'dispatch' && dispatchAutoFocus && !cameraOpen && !scannedRecord) {
      const t = window.setTimeout(() => {
        dispatchInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(t);
    }
  }, [activeTab, dispatchAutoFocus, cameraOpen, scannedRecord]);

  const stopCamera = () => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    isFrameBusyRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const triggerDispatchForRecord = (
    rec: ResolvedTrackingRecord,
    undo = false
  ) => {
    let timestampIso: string | undefined;
    let itemsCount = rec.detailedItems?.length || (rec.type === 'item' ? 1 : 0);
    let piecesCount =
      rec.detailedItems?.reduce((acc, d) => acc + d.quantity, 0) ||
      (rec.type === 'item' ? 1 : 0);

    if (onDispatchTrackingRecord) {
      const res = onDispatchTrackingRecord(rec, {
        syncWarehouse: dispatchSyncWarehouse,
        undo,
      });
      timestampIso = res.timestampIso;
      itemsCount = res.itemsCount;
      piecesCount = res.piecesCount;
    } else {
      timestampIso = undo ? undefined : new Date().toISOString();
      onStampEntityDate(
        rec.commessaCode,
        rec.type,
        rec.entityId,
        'shippedAt',
        timestampIso
      );
    }

    if (dispatchSoundEnabled) {
      playDispatchBeep(undo ? 'info' : 'ok');
    }

    setInspectedDispatchRef({
      commessaCode: rec.commessaCode,
      type: rec.type,
      entityId: rec.entityId,
      lastActionText: undo
        ? `Scarico annullato su ${rec.code}`
        : `Scaricato in uscita: ${itemsCount} righe (${piecesCount} pz)`,
      lastActionAt: timestampIso || new Date().toISOString(),
    });
  };

  const handleDispatchScanInput = (raw: string) => {
    setDispatchError(null);
    const trimmed = raw.trim();
    if (!trimmed) return;
    const match = lookupScannedCodeAcrossLoads(trimmed, allLoads, movements);
    if (!match) {
      if (dispatchSoundEnabled) playDispatchBeep('warn');
      setDispatchError(
        `Codice "${trimmed}" non trovato tra i bancali, scatole o oggetti delle commesse.`
      );
      setDispatchScannerInput('');
      return;
    }

    if (dispatchAutoUnload) {
      triggerDispatchForRecord(match, false);
    } else {
      if (dispatchSoundEnabled) playDispatchBeep('info');
      setInspectedDispatchRef({
        commessaCode: match.commessaCode,
        type: match.type,
        entityId: match.entityId,
        lastActionText: `Contenuto rilevato (modalità solo controllo)`,
        lastActionAt: new Date().toISOString(),
      });
    }
    setDispatchScannerInput('');
    if (dispatchAutoFocus) {
      window.setTimeout(() => dispatchInputRef.current?.focus(), 40);
    }
  };

  const handleLookupInput = (raw: string) => {
    setScannerError(null);
    const match = lookupScannedCodeAcrossLoads(raw, allLoads, movements);
    if (!match) {
      setScannerError(
        `Nessun bancale, scatola o pezzo trovato per "${raw.trim()}". Verifica il codice o la commessa.`
      );
      return;
    }
    setScannedRecord(match);
    setScannerInput('');
  };

  const handleCameraDecodedRef = useRef<(raw: string) => void>(() => {});
  useEffect(() => {
    handleCameraDecodedRef.current = (raw: string) => {
      if (cameraTarget === 'dispatch') {
        handleDispatchScanInput(raw);
      } else {
        handleLookupInput(raw);
      }
    };
  });

  const handleStartCameraScanner = async (target: 'labels' | 'dispatch') => {
    stopCamera();
    setCameraTarget(target);
    setCameraError(null);
    setScannerError(null);
    setDispatchError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Fotocamera non disponibile in questo contesto. Puoi comunque scansionare con la fotocamera nativa del telefono oppure con una pistola barcode USB.'
      );
      return;
    }

    let stream: MediaStream | null = null;
    try {
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
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    } catch {
      setCameraError(
        'Permesso fotocamera negato o fotocamera occupata. Concedi il permesso al browser oppure usa la casella Scanner USB.'
      );
      return;
    }

    streamRef.current = stream;
    setCameraOpen(true);

    const BarcodeDetectorCtor = (window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
      };
    }).BarcodeDetector;

    let nativeDetector: {
      detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
    } | null = null;
    if (BarcodeDetectorCtor) {
      try {
        nativeDetector = new BarcodeDetectorCtor({
          formats: ['qr_code', 'code_39', 'code_128', 'ean_13'],
        });
      } catch {
        nativeDetector = null;
      }
    }

    if (!zxingReaderRef.current) {
      zxingReaderRef.current = createUniversalBarcodeReader();
    }
    if (!scanCanvasRef.current) {
      scanCanvasRef.current = document.createElement('canvas');
    }
    scanTickRef.current = 0;

    window.setTimeout(async () => {
      const videoEl = videoRef.current;
      if (!videoEl || !streamRef.current) return;
      videoEl.srcObject = streamRef.current;
      await videoEl.play().catch(() => {});

      scanIntervalRef.current = window.setInterval(async () => {
        if (!streamRef.current || !videoRef.current || isFrameBusyRef.current) return;
        const vid = videoRef.current;
        if (vid.readyState < 2 || vid.videoWidth === 0) return;

        isFrameBusyRef.current = true;
        try {
          if (nativeDetector) {
            try {
              const detected = await nativeDetector.detect(vid);
              if (detected && detected.length > 0 && detected[0].rawValue) {
                const rawVal = detected[0].rawValue;
                stopCamera();
                handleCameraDecodedRef.current(rawVal);
                return;
              }
            } catch {
              // fall through to ZXing
            }
          }

          const canvas = scanCanvasRef.current;
          const reader = zxingReaderRef.current;
          if (!canvas || !reader) return;

          scanTickRef.current += 1;
          const decoded = decodeBarcodeFromVideoFrame(
            reader,
            vid,
            canvas,
            scanTickRef.current % 2 === 0
          );
          if (decoded) {
            stopCamera();
            handleCameraDecodedRef.current(decoded);
          }
        } finally {
          isFrameBusyRef.current = false;
        }
      }, 200);
    }, 100);
  };

  const handleOpenA4Pdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const targetLoad =
        printLang === 'it' ? load : await translateLoadForPrint(load, printLang);
      await openTrackingLabelsA4PdfInNewTab(targetLoad, movements, {
        includePallets,
        includeBoxes,
        includeItems,
        palletFilterId,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadA4Pdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const targetLoad =
        printLang === 'it' ? load : await translateLoadForPrint(load, printLang);
      await downloadTrackingLabelsA4Pdf(targetLoad, movements, {
        includePallets,
        includeBoxes,
        includeItems,
        palletFilterId,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleStampWholeLoad = (field: 'loadedAt' | 'shippedAt') => {
    const nowIso = new Date().toISOString();
    onStampEntityDate(load.code, 'load', load.id, field, nowIso);
  };

  const handleExportManifestExcel = (
    targetLoad = load,
    opts?: { onlyShipped?: boolean; filterRecord?: ResolvedTrackingRecord | null }
  ) => {
    downloadOutboundManifestExcel(targetLoad, movements, {
      onlyShipped: opts?.onlyShipped ?? manifestOnlyShipped,
      operatorName,
      filterRecord: opts?.filterRecord ?? null,
    });
  };

  const handleExportManifestPdf = async (
    targetLoad = load,
    opts?: { onlyShipped?: boolean; filterRecord?: ResolvedTrackingRecord | null }
  ) => {
    setIsGeneratingPdf(true);
    try {
      const preparedLoad =
        printLang === 'it' ? targetLoad : await translateLoadForPrint(targetLoad, printLang);
      downloadOutboundManifestPdf(preparedLoad, movements, {
        onlyShipped: opts?.onlyShipped ?? manifestOnlyShipped,
        operatorName,
        filterRecord: opts?.filterRecord ?? null,
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePreviewManifestPdf = (
    targetLoad = load,
    opts?: { onlyShipped?: boolean; filterRecord?: ResolvedTrackingRecord | null }
  ) => {
    openOutboundManifestPdfInNewTab(targetLoad, movements, {
      onlyShipped: opts?.onlyShipped ?? manifestOnlyShipped,
      operatorName,
      filterRecord: opts?.filterRecord ?? null,
    });
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header Operativo con Switch 2 Schede */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-4 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-slate-900 shrink-0" />
              <h1 className="text-base font-bold text-slate-900 truncate">
                Etichette QR, Scarico Barcode &amp; Distinta Uscita — {load.code}
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              QR e Barcode unificati con TiMini Print: scansiona un bancale o scatola per vedere tutto il contenuto, scaricare con data/ora ed esportare la distinta Excel e PDF.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Switch Tab Principale */}
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveTab('labels');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'labels'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Etichette A4</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setActiveTab('dispatch');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                activeTab === 'dispatch'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>Scarico Barcode &amp; Distinta</span>
              {shippedStats.itemLinesCount > 0 && (
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                    activeTab === 'dispatch'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {shippedStats.totalPieces} pz
                </span>
              )}
            </button>
          </div>

          <PrintLanguageSelector
            value={printLang}
            onChange={setPrintLang}
            isTranslating={isGeneratingPdf}
            variant="light"
            label="Etichette"
          />

          {activeTab === 'labels' ? (
            <>
              <button
                type="button"
                disabled={isGeneratingPdf || filteredRecords.length === 0}
                onClick={handleDownloadA4Pdf}
                className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>Scarica PDF A4</span>
              </button>

              <button
                type="button"
                disabled={isGeneratingPdf || filteredRecords.length === 0}
                onClick={handleOpenA4Pdf}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>
                  Foglio A4 ({filteredRecords.length} · {counts.pagesA4}{' '}
                  {counts.pagesA4 === 1 ? 'pag.' : 'pagg.'})
                </span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={outboundManifest.items.length === 0}
                onClick={() => handleExportManifestExcel()}
                className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Distinta Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                disabled={outboundManifest.items.length === 0}
                onClick={() => handleExportManifestPdf()}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Distinta PDF</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===================================================================
          SCHEDA 1: ETICHETTE A4 QR & BARCODE
      =================================================================== */}
      {activeTab === 'labels' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Riga 1: Timbri Rapidi Commessa + Scanner QR / Barcode */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Timbro Data/Ora Carico & Scarico Commessa */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Orari Carico (Preparazione) &amp; Scarico (Spedizione)
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  {load.code}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-sky-200 bg-sky-50/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-sky-900 uppercase flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Carico (Preparazione)
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-xs font-bold text-slate-900">
                    {formatItDateTime(load.loadedAt, true)}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStampWholeLoad('loadedAt')}
                    className="w-full py-1.5 px-2.5 rounded-md bg-white hover:bg-sky-100 border border-sky-300 text-sky-900 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Timbra Carico Ora (Tutta Commessa)
                  </button>
                </div>

                <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-900 uppercase flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5" />
                      Scarico (Spedito)
                    </span>
                  </div>
                  <div className="font-mono tabular-nums text-xs font-bold text-slate-900">
                    {formatItDateTime(
                      load.shippedAt || load.handoverProof?.handoverAt,
                      true
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStampWholeLoad('shippedAt')}
                    className="w-full py-1.5 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Timbra Scarico / Spedito Ora
                  </button>
                </div>
              </div>

              {/* Scorciatoia diretta a Distinta Uscita Excel / PDF */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600">
                  Merce scaricata in uscita:{' '}
                  <strong className="font-mono text-slate-900">
                    {shippedStats.palletsCount} banc. · {shippedStats.boxesCount} scat. ·{' '}
                    {shippedStats.totalPieces} pz
                  </strong>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dispatch')}
                    className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <ScanLine className="w-3 h-3" />
                    <span>Apri Scarico Barcode</span>
                  </button>
                  <button
                    type="button"
                    disabled={shippedStats.itemLinesCount === 0}
                    onClick={() => handleExportManifestExcel(load, { onlyShipped: true })}
                    className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title="Esporta distinta merce scaricata in Excel"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    disabled={shippedStats.itemLinesCount === 0}
                    onClick={() => handleExportManifestPdf(load, { onlyShipped: true })}
                    className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    title="Esporta distinta merce scaricata in PDF"
                  >
                    <FileText className="w-3 h-3 text-slate-700" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Scanner QR & Pistola Barcode USB (Consultazione Rapida) */}
            <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ScanLine className="w-4 h-4 text-blue-600" />
                  <span>Consulta Scheda QR / Codice a Barre</span>
                </div>
                <button
                  type="button"
                  onClick={
                    cameraOpen && cameraTarget === 'labels'
                      ? stopCamera
                      : () => handleStartCameraScanner('labels')
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                    cameraOpen && cameraTarget === 'labels'
                      ? 'bg-rose-50 border-rose-300 text-rose-800'
                      : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>
                    {cameraOpen && cameraTarget === 'labels'
                      ? 'Chiudi Camera'
                      : 'Usa Fotocamera'}
                  </span>
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (scannerInput.trim()) handleLookupInput(scannerInput);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={scannerInput}
                    onChange={(e) => {
                      setScannerInput(e.target.value);
                      setScannerError(null);
                    }}
                    placeholder="Spara con pistola barcode o digita es. ART-001, SC-01, BANC-01..."
                    className="w-full pl-8 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  Trova Scheda
                </button>
              </form>

              <p className="text-[11px] text-slate-500">
                Le etichette stampate con <strong>TiMini Print</strong> usano lo stesso QR e lo stesso Barcode Code-39 di questa commessa: inquadrando il QR da smartphone si apre subito il contenuto completo del bancale e delle scatole.
              </p>

              {scannerError && (
                <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{scannerError}</span>
                </div>
              )}

              {cameraError && cameraTarget === 'labels' && (
                <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              {cameraOpen && cameraTarget === 'labels' && (
                <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-black">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full max-h-56 object-cover"
                  />
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-black/70 text-white hover:bg-black cursor-pointer"
                    title="Chiudi fotocamera"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Barra Filtri Selezione Etichette A4 */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 mr-1">
                Includi nel file A4:
              </span>

              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePallets}
                  onChange={(e) => setIncludePallets(e.target.checked)}
                  className="accent-slate-900"
                />
                <Boxes className="w-3.5 h-3.5 text-slate-700" />
                <span>Bancali ({counts.pallets})</span>
              </label>

              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeBoxes}
                  onChange={(e) => setIncludeBoxes(e.target.checked)}
                  className="accent-blue-700"
                />
                <Box className="w-3.5 h-3.5 text-blue-700" />
                <span>Scatole ({counts.boxes})</span>
              </label>

              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeItems}
                  onChange={(e) => setIncludeItems(e.target.checked)}
                  className="accent-emerald-700"
                />
                <Package className="w-3.5 h-3.5 text-emerald-700" />
                <span>Oggetti / Pezzi ({counts.items})</span>
              </label>

              {load.pallets.length > 0 && (
                <select
                  aria-label="Filtra per bancale"
                  value={palletFilterId}
                  onChange={(e) => setPalletFilterId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800"
                >
                  <option value="all">Tutti i bancali</option>
                  {load.pallets.map((p) => (
                    <option key={p.id} value={p.id}>
                      Solo {p.code} — {p.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Filtra etichette..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Tabella Elenco Completo Etichette con Orari Modificabili */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">
                Anteprima Etichette incluse nel foglio A4 ({filteredRecords.length})
              </span>
              <span className="font-mono text-slate-500">
                Formato: A4 · 8 etichette/pagina (95×66 mm) · QR + Code-39
              </span>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Nessun bancale, scatola o oggetto trovato con i filtri selezionati.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Tipo &amp; Codice</th>
                      <th className="py-2.5 px-3">Descrizione</th>
                      <th className="py-2.5 px-3">Posizione / Dove si trova</th>
                      <th className="py-2.5 px-3 text-right">Quantità</th>
                      <th className="py-2.5 px-3">Carico (Preparazione)</th>
                      <th className="py-2.5 px-3">Scarico (Spedizione)</th>
                      <th className="py-2.5 px-3 text-right">Scansione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((rec) => {
                      const typeTag =
                        rec.type === 'pallet'
                          ? 'bg-slate-900 text-white'
                          : rec.type === 'box'
                          ? 'bg-blue-700 text-white'
                          : 'bg-emerald-700 text-white';

                      const typeName =
                        rec.type === 'pallet'
                          ? 'BANCALE'
                          : rec.type === 'box'
                          ? 'SCATOLA'
                          : 'OGGETTO';

                      return (
                        <tr
                          key={`${rec.type}-${rec.entityId}`}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${typeTag}`}
                              >
                                {typeName}
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {rec.code}
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                              *{rec.barcodeValue}*
                            </div>
                          </td>

                          <td className="py-2.5 px-3 max-w-[220px]">
                            <div className="font-semibold text-slate-900 truncate">
                              {rec.name}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {rec.weightKg.toFixed(1)} kg
                            </div>
                          </td>

                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {rec.locationPath}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                            {rec.quantityText}
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="datetime-local"
                                aria-label={`Data e ora carico ${rec.code}`}
                                value={toDatetimeLocalValue(rec.loadedAt)}
                                onChange={(e) =>
                                  onStampEntityDate(
                                    load.code,
                                    rec.type,
                                    rec.entityId,
                                    'loadedAt',
                                    fromDatetimeLocalValue(e.target.value)
                                  )
                                }
                                className="px-1.5 py-1 text-[11px] font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-sky-600"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  onStampEntityDate(
                                    load.code,
                                    rec.type,
                                    rec.entityId,
                                    'loadedAt',
                                    new Date().toISOString()
                                  )
                                }
                                className="px-2 py-1 text-[11px] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded cursor-pointer"
                                title="Imposta data e ora carico adesso"
                              >
                                Ora
                              </button>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="datetime-local"
                                aria-label={`Data e ora scarico ${rec.code}`}
                                value={toDatetimeLocalValue(rec.shippedAt)}
                                onChange={(e) =>
                                  onStampEntityDate(
                                    load.code,
                                    rec.type,
                                    rec.entityId,
                                    'shippedAt',
                                    fromDatetimeLocalValue(e.target.value)
                                  )
                                }
                                className="px-1.5 py-1 text-[11px] font-mono bg-white border border-slate-200 rounded focus:outline-none focus:border-emerald-600"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  onStampEntityDate(
                                    load.code,
                                    rec.type,
                                    rec.entityId,
                                    'shippedAt',
                                    new Date().toISOString()
                                  )
                                }
                                className="px-2 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded cursor-pointer"
                                title="Imposta data e ora scarico/spedizione adesso"
                              >
                                Ora
                              </button>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setScannedRecord(rec)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold cursor-pointer"
                              title="Apri scheda QR come vista da smartphone"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Scheda QR</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================
          SCHEDA 2: SCARICO BARCODE (TUTTO IL CONTENUTO) & DISTINTA USCITA
      =================================================================== */}
      {activeTab === 'dispatch' && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Terminale Pistola Barcode + Contenuto Rilevato */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Colonna Sinistra: Scanner Barcode Uscita + Colli Commessa */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                      <ScanLine className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Terminale Scarico Barcode / QR
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Legge etichette TiMini Print ed Etichette A4
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDispatchSoundEnabled((s) => !s)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      title={dispatchSoundEnabled ? 'Disattiva bip' : 'Attiva bip'}
                    >
                      {dispatchSoundEnabled ? (
                        <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={
                        cameraOpen && cameraTarget === 'dispatch'
                          ? stopCamera
                          : () => handleStartCameraScanner('dispatch')
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer border whitespace-nowrap ${
                        cameraOpen && cameraTarget === 'dispatch'
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>
                        {cameraOpen && cameraTarget === 'dispatch'
                          ? 'Chiudi'
                          : 'Camera'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Modalità Scansione */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDispatchAutoUnload(true)}
                    className={`py-1.5 px-2.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      dispatchAutoUnload
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Scarica subito (Data/Ora)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDispatchAutoUnload(false)}
                    className={`py-1.5 px-2.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      !dispatchAutoUnload
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Solo vedi contenuto
                  </button>
                </div>

                {/* Input Pistola USB */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (dispatchScannerInput.trim()) {
                      handleDispatchScanInput(dispatchScannerInput);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative flex-1">
                    <ScanLine className="w-4 h-4 text-emerald-700 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={dispatchInputRef}
                      type="text"
                      value={dispatchScannerInput}
                      onChange={(e) => {
                        setDispatchScannerInput(e.target.value);
                        setDispatchError(null);
                      }}
                      placeholder="Spara barcode bancale o scatola (es. BANC-01, SC-01)..."
                      autoComplete="off"
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono font-semibold bg-slate-50 border-2 border-emerald-600/40 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    {dispatchAutoUnload ? 'Scarica' : 'Controlla'}
                  </button>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dispatchSyncWarehouse}
                      onChange={(e) => setDispatchSyncWarehouse(e.target.checked)}
                      className="rounded accent-emerald-700"
                    />
                    <span>Registra scarico anche nei movimenti Magazzino</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dispatchAutoFocus}
                      onChange={(e) => setDispatchAutoFocus(e.target.checked)}
                      className="rounded accent-slate-900"
                    />
                    <span>Focus pistola USB</span>
                  </label>
                </div>

                {dispatchError && (
                  <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{dispatchError}</span>
                  </div>
                )}

                {cameraError && cameraTarget === 'dispatch' && (
                  <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                {cameraOpen && cameraTarget === 'dispatch' && (
                  <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-black">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full max-h-56 object-cover"
                    />
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-black/70 text-white hover:bg-black cursor-pointer"
                      title="Chiudi fotocamera"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Elenco Rapido Bancali & Scatole della Commessa */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Bancali &amp; Scatole Commessa ({packageRecordsForLoad.length})
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    Clicca per ispezionare o scaricare
                  </span>
                </div>

                {packageRecordsForLoad.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Nessun bancale o scatola presente nella commessa attiva.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                    {packageRecordsForLoad.map((pkg) => {
                      const isSelected =
                        inspectedDispatchRecord?.type === pkg.type &&
                        inspectedDispatchRecord?.entityId === pkg.entityId;
                      const isShipped = Boolean(pkg.shippedAt);
                      const itemsInside = pkg.detailedItems?.length || 0;
                      const piecesInside =
                        pkg.detailedItems?.reduce((acc, d) => acc + d.quantity, 0) || 0;

                      return (
                        <div
                          key={`${pkg.type}-${pkg.entityId}`}
                          className={`px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/70'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setInspectedDispatchRef({
                                commessaCode: pkg.commessaCode,
                                type: pkg.type,
                                entityId: pkg.entityId,
                              })
                            }
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  pkg.type === 'pallet'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-blue-700 text-white'
                                }`}
                              >
                                {pkg.type === 'pallet' ? 'BANCALE' : 'SCATOLA'}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {pkg.code}
                              </span>
                              <span className="text-xs text-slate-600 truncate">
                                {pkg.name}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-mono text-slate-500">
                              <span>
                                {itemsInside} righe · {piecesInside} pz ·{' '}
                                {pkg.weightKg.toFixed(1)} kg
                              </span>
                              {isShipped ? (
                                <span className="text-emerald-700 font-bold">
                                  ✓ Uscito {formatItDateTime(pkg.shippedAt, true)}
                                </span>
                              ) : (
                                <span className="text-amber-700">In preparazione</span>
                              )}
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {isShipped ? (
                              <button
                                type="button"
                                onClick={() => triggerDispatchForRecord(pkg, true)}
                                className="px-2 py-1 rounded-md bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Annulla scarico uscita"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Annulla</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => triggerDispatchForRecord(pkg, false)}
                                className="px-2.5 py-1 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                title="Scarica tutto il contenuto registrando data e ora"
                              >
                                <ArrowUpRight className="w-3 h-3" />
                                <span>Scarica Ora</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Colonna Destra: Contenuto Completo del Bancale / Scatola Scansionato */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
              {!inspectedDispatchRecord ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Scansiona un Bancale o una Scatola (o clicca a sinistra)
                  </div>
                  <p className="text-xs text-slate-500 max-w-md">
                    Qui vedrai subito tutto ciò che si trova dentro il bancale e dentro ogni singola scatola (codici, descrizioni, quantità, pesi) con la data e l&apos;ora esatta di scarico in uscita.
                  </p>
                </div>
              ) : (
                <>
                  {/* Intestazione Collo Rilevato */}
                  <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50/80 space-y-2.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              inspectedDispatchRecord.type === 'pallet'
                                ? 'bg-slate-900 text-white'
                                : inspectedDispatchRecord.type === 'box'
                                ? 'bg-blue-700 text-white'
                                : 'bg-emerald-700 text-white'
                            }`}
                          >
                            {inspectedDispatchRecord.type === 'pallet'
                              ? 'BANCALE'
                              : inspectedDispatchRecord.type === 'box'
                              ? 'SCATOLA'
                              : 'OGGETTO'}
                          </span>
                          <span className="font-mono text-base font-bold text-slate-900">
                            {inspectedDispatchRecord.code}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            *{inspectedDispatchRecord.barcodeValue}*
                          </span>
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                          {inspectedDispatchRecord.name}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          Commessa{' '}
                          <strong className="font-mono">
                            {inspectedDispatchRecord.commessaCode}
                          </strong>{' '}
                          · {inspectedDispatchRecord.locationPath} ·{' '}
                          <strong>{inspectedDispatchRecord.quantityText}</strong> ·{' '}
                          <span className="font-mono">
                            {inspectedDispatchRecord.weightKg.toFixed(1)} kg
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {inspectedDispatchRecord.shippedAt ? (
                          <button
                            type="button"
                            onClick={() =>
                              triggerDispatchForRecord(inspectedDispatchRecord, true)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Annulla Uscita</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              triggerDispatchForRecord(inspectedDispatchRecord, false)
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Scarica Tutto in Uscita Ora</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stato Data/Ora Scarico + Export singolo collo */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                      <div className="flex items-center gap-2 text-xs">
                        {inspectedDispatchRecord.shippedAt ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 font-semibold font-mono tabular-nums">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>
                              SCARICATO IL{' '}
                              {formatItDateTime(inspectedDispatchRecord.shippedAt, true)}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Non ancora scaricato in uscita</span>
                          </span>
                        )}
                        {inspectedDispatchRef?.lastActionText && (
                          <span className="text-[11px] text-slate-500">
                            {inspectedDispatchRef.lastActionText}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleExportManifestExcel(inspectedDispatchLoad, {
                              onlyShipped: false,
                              filterRecord: inspectedDispatchRecord,
                            })
                          }
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-emerald-50 border border-slate-300 text-slate-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                          <span>Excel Collo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleExportManifestPdf(inspectedDispatchLoad, {
                              onlyShipped: false,
                              filterRecord: inspectedDispatchRecord,
                            })
                          }
                          className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-slate-700" />
                          <span>PDF Collo</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Albero Contenuto Completo: Scatole -> Articoli + Fuori Scatola */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[420px]">
                    {inspectedContentGroups.length > 0 ? (
                      inspectedContentGroups.map((group) => (
                        <div
                          key={group.key}
                          className="border border-slate-200 rounded-lg overflow-hidden"
                        >
                          <div className="px-3 py-2 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              {group.isBox ? (
                                <Box className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              ) : (
                                <Package className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                              )}
                              <span>{group.title}</span>
                            </span>
                            <span className="font-mono text-[11px] text-slate-600">
                              {group.items.length} righe ·{' '}
                              {group.items.reduce((a, b) => a + b.quantity, 0)} pz
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {group.items.map((it) => (
                              <div
                                key={it.itemId}
                                className="px-3 py-2 flex items-center justify-between gap-3 text-xs hover:bg-slate-50/70"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-slate-900">
                                      {it.sku}
                                    </span>
                                    <span className="font-medium text-slate-800 truncate">
                                      {it.name}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                                    {it.totalWeightKg.toFixed(1)} kg
                                    {it.shippedAt
                                      ? ` · Uscito ${formatItDateTime(it.shippedAt, true)}`
                                      : ' · Non ancora scaricato'}
                                  </div>
                                </div>
                                <span className="font-mono font-bold tabular-nums text-slate-900 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                                  {it.quantity} pz
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : inspectedDispatchRecord.type === 'item' ? (
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1">
                        <div className="font-bold text-slate-900">
                          {inspectedDispatchRecord.code} — {inspectedDispatchRecord.name}
                        </div>
                        <div className="text-slate-600">
                          Posizione: {inspectedDispatchRecord.locationPath} · Quantità:{' '}
                          <strong>{inspectedDispatchRecord.quantityText}</strong> · Peso:{' '}
                          {inspectedDispatchRecord.weightKg.toFixed(1)} kg
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-500">
                        Questo bancale/scatola non contiene ancora articoli registrati.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ===============================================================
              SEZIONE DISTINTA MERCE IN USCITA (EXCEL .XLSX + PDF)
          =============================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-700" />
                  <span>Distinta Merce in Uscita — {load.code}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Elenco completo dei bancali, delle scatole e di tutti gli articoli con data e ora esatta di scarico, pronto per Excel (.xlsx) e PDF.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Toggle Solo Scaricati vs Tutta la Commessa */}
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setManifestOnlyShipped(true)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      manifestOnlyShipped
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Solo merce scaricata ({shippedStats.itemLinesCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setManifestOnlyShipped(false)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      !manifestOnlyShipped
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tutta la commessa ({load.items.length})
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outboundManifest.items.length === 0}
                  onClick={() => handleExportManifestExcel()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Scarica Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  disabled={outboundManifest.items.length === 0}
                  onClick={() => handleExportManifestPdf()}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica PDF</span>
                </button>
                <button
                  type="button"
                  disabled={outboundManifest.items.length === 0}
                  onClick={() => handlePreviewManifestPdf()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Anteprima PDF</span>
                </button>
              </div>
            </div>

            {/* 4 KPI Riepilogo Uscita */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 border-b border-slate-200 bg-white">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Bancali in Distinta
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {outboundManifest.totals.palletsCount}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Scatole in Distinta
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-blue-800 mt-0.5">
                  {outboundManifest.totals.boxesCount}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Pezzi Totali ({outboundManifest.totals.itemLinesCount} righe)
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-0.5">
                  {outboundManifest.totals.totalPieces}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase">
                  Peso Lordo Stimato
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-0.5">
                  {outboundManifest.totals.totalWeightKg.toFixed(1)} kg
                </div>
              </div>
            </div>

            {/* Barra Ricerca Tabella Distinta */}
            <div className="px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
              <span className="text-xs font-semibold text-slate-700">
                Dettaglio articoli nella distinta ({filteredManifestItems.length})
              </span>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manifestSearch}
                  onChange={(e) => setManifestSearch(e.target.value)}
                  placeholder="Cerca SKU, articolo, bancale o scatola..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
            </div>

            {filteredManifestItems.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="text-xs font-semibold text-slate-700">
                  {manifestOnlyShipped
                    ? 'Nessun bancale o scatola ancora scaricato in uscita per questa commessa.'
                    : 'Nessun articolo trovato con la ricerca corrente.'}
                </div>
                {manifestOnlyShipped && (
                  <p className="text-xs text-slate-500">
                    Scansiona il barcode di un bancale o di una scatola sopra (oppure clicca &quot;Scarica Ora&quot;) per registrarne l&apos;uscita con data e ora e popolare subito la distinta Excel e PDF.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Data / Ora Uscita</th>
                      <th className="py-2.5 px-3">Bancale</th>
                      <th className="py-2.5 px-3">Scatola</th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Articolo / Contenuto</th>
                      <th className="py-2.5 px-3 text-right">Q.tà</th>
                      <th className="py-2.5 px-3 text-right">Peso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredManifestItems.map((row) => (
                      <tr
                        key={`${row.itemId}-${row.boxCode}-${row.palletCode}`}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                          {row.shippedAt ? (
                            <span className="font-bold text-emerald-800">
                              {formatItDateTime(row.shippedAt, true)}
                            </span>
                          ) : (
                            <span className="text-slate-400">Non scaricato</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {row.palletCode}
                        </td>
                        <td className="py-2 px-3 font-mono text-blue-800 whitespace-nowrap">
                          {row.boxPath || row.boxCode}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                          {row.sku}
                        </td>
                        <td className="py-2 px-3 text-slate-900 font-medium">
                          {row.name}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                          {row.quantity} pz
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                          {row.totalWeightKg.toFixed(1)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modale Anteprima / Risultato Scansione QR */}
      {scannedRecord && (
        <QrTrackingScanView
          initialRecord={scannedRecord}
          localLoads={allLoads}
          localMovements={movements}
          isModal
          onClose={() => setScannedRecord(null)}
          onStampLocal={(commessaCode, entityType, entityId, field, ts) => {
            onStampEntityDate(commessaCode, entityType, entityId, field, ts);
            setScannedRecord((prev) =>
              prev ? { ...prev, [field]: ts } : prev
            );
          }}
        />
      )}
    </div>
  );
};
