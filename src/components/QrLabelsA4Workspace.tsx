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
} from '../utils/qrTrackingUtils';
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

interface QrLabelsA4WorkspaceProps {
  load: CargoLoad;
  allLoads: CargoLoad[];
  movements: StockMovement[];
  onStampEntityDate: (
    commessaCode: string,
    entityType: 'load' | TrackEntityType,
    entityId: string,
    field: 'loadedAt' | 'shippedAt',
    timestampIso: string | undefined
  ) => void;
}

export const QrLabelsA4Workspace: React.FC<QrLabelsA4WorkspaceProps> = ({
  load,
  allLoads,
  movements,
  onStampEntityDate,
}) => {
  const [includePallets, setIncludePallets] = useState(true);
  const [includeBoxes, setIncludeBoxes] = useState(true);
  const [includeItems, setIncludeItems] = useState(true);
  const [palletFilterId, setPalletFilterId] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Scanner QR / Barcode (Pistola USB o Ricerca Manuale o Fotocamera)
  const [scannerInput, setScannerInput] = useState('');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedRecord, setScannedRecord] = useState<ResolvedTrackingRecord | null>(null);

  // Live Camera Scanner (Universal ZXing + Native Fast-Path)
  const [cameraOpen, setCameraOpen] = useState(false);
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

  const handleLookupInputRef = useRef(handleLookupInput);
  useEffect(() => {
    handleLookupInputRef.current = handleLookupInput;
  });

  const handleStartCameraScanner = async () => {
    stopCamera();
    setCameraError(null);
    setScannerError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Fotocamera non disponibile in questo contesto. Puoi comunque scansionare con la fotocamera nativa del telefono (apre direttamente la scheda) oppure con una pistola barcode USB.'
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
                handleLookupInputRef.current(rawVal);
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
            handleLookupInputRef.current(decoded);
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
      await openTrackingLabelsA4PdfInNewTab(load, movements, {
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
      await downloadTrackingLabelsA4Pdf(load, movements, {
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

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header Operativo Pulito */}
      <div className="bg-white border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-slate-900 shrink-0" />
            <h1 className="text-base font-bold text-slate-900 truncate">
              Etichette A4 QR &amp; Codice a Barre — {load.code}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Genera 1 file PDF A4 (8 etichette per foglio con linee di taglio) per ogni bancale, scatola e pezzo con posizione, quantità, carico e scarico.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
              Apri Foglio A4 Etichette ({filteredRecords.length} · {counts.pagesA4}{' '}
              {counts.pagesA4 === 1 ? 'pag.' : 'pagg.'})
            </span>
          </button>
        </div>
      </div>

      {/* Corpo Scorrevole */}
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
                  {formatItDateTime(load.loadedAt)}
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
                  {formatItDateTime(load.shippedAt || load.handoverProof?.handoverAt)}
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
          </div>

          {/* Scanner QR & Pistola Barcode USB */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <ScanLine className="w-4 h-4 text-blue-600" />
                <span>Scannerizza QR / Codice a Barre</span>
              </div>
              <button
                type="button"
                onClick={cameraOpen ? stopCamera : handleStartCameraScanner}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                  cameraOpen
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{cameraOpen ? 'Chiudi Camera' : 'Usa Fotocamera'}</span>
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
                Trova Pezzo
              </button>
            </form>

            <p className="text-[11px] text-slate-500">
              Inquadrando qualsiasi QR stampato con la normale fotocamera dello smartphone si apre direttamente la scheda con posizione, quantità, carico e scarico.
            </p>

            {scannerError && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{scannerError}</span>
              </div>
            )}

            {cameraError && (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {cameraOpen && (
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
