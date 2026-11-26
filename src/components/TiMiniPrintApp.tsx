import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  Printer,
  Download,
  FileText,
  Package,
  Layers,
  Bookmark,
  Upload,
  Trash2,
  X,
  Search,
  ChevronsDown,
  QrCode,
  Barcode,
  RefreshCw,
  Minus,
  Plus,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import {
  AuthUser,
  CargoLoad,
  WarehouseInventoryState,
  WarehouseStockItem,
} from '../types/warehouse';
import { calculateLoadSummary } from '../utils/calculations';
import {
  binarizeThermalCanvas,
  connectTiMiniBluetooth,
  downloadThermalLabelPdf,
  feedTiMiniPaper,
  isTiMiniConnected,
  isWebBluetoothSupported,
  LabelBorderStyle,
  LabelHeightPreset,
  printRowsToTiMini,
  printThermalCanvasViaSystemDialog,
  printTiMiniTestSlip,
  renderTiMiniLabelCanvas,
  ThermalDarknessLevel,
  ThermalDitherMode,
  TIMINI_PRINT_WIDTH_PX,
  TiMiniConnection,
  TiMiniLabelDesign,
} from '../utils/timiniBluetoothPrinter';

interface TiMiniPrintAppProps {
  currentUser: AuthUser;
  inventory: WarehouseInventoryState;
  loads: CargoLoad[];
  activeLoad: CargoLoad;
}

interface ElectronBluetoothDevice {
  deviceId: string;
  deviceName: string;
}

const TEMPLATES_KEY_PREFIX = 'metatron_timini_templates_v1_';

function createDefaultDesign(company?: string): TiMiniLabelDesign {
  return {
    id: `lbl_${Date.now()}`,
    name: 'Etichetta Standard',
    headerTag: company || 'METATRON MAGAZZINO',
    title: 'ARTICOLO MAGAZZINO',
    subtitle: 'Scaffale A-01 · Controllo qualità OK',
    codeText: 'SKU-001',
    footerText: new Date().toLocaleDateString('it-IT'),
    includeQr: true,
    qrContent: 'SKU-001',
    includeBarcode: true,
    barcodeContent: 'SKU-001',
    borderStyle: 'header_banner',
    heightPreset: 'auto',
    ditherMode: 'threshold',
    threshold: 160,
    fontScale: 'normal',
    mirrorHorizontal: false,
  };
}

/** Bordo dentellato realistico da rotolo carta termica */
const ThermalTearEdge: React.FC<{ flip?: boolean }> = ({ flip = false }) => (
  <svg
    viewBox="0 0 320 8"
    preserveAspectRatio="none"
    aria-hidden="true"
    className={`w-full h-2 block text-white ${flip ? 'rotate-180' : ''}`}
  >
    <polygon
      fill="currentColor"
      points="0,8 8,0 16,8 24,0 32,8 40,0 48,8 56,0 64,8 72,0 80,8 88,0 96,8 104,0 112,8 120,0 128,8 136,0 144,8 152,0 160,8 168,0 176,8 184,0 192,8 200,0 208,8 216,0 224,8 232,0 240,8 248,0 256,8 264,0 272,8 280,0 288,8 296,0 304,8 312,0 320,8"
    />
  </svg>
);

export const TiMiniPrintApp: React.FC<TiMiniPrintAppProps> = ({
  currentUser,
  inventory,
  loads,
  activeLoad,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'warehouse' | 'commessa' | 'templates'>(
    'editor'
  );
  const [inspectorTab, setInspectorTab] = useState<'content' | 'codes' | 'printer'>('content');
  const [previewZoom, setPreviewZoom] = useState<'100' | '125'>('100');

  const [design, setDesign] = useState<TiMiniLabelDesign>(() =>
    createDefaultDesign(currentUser.company)
  );
  const [templates, setTemplates] = useState<TiMiniLabelDesign[]>(() => {
    try {
      const raw = localStorage.getItem(`${TEMPLATES_KEY_PREFIX}${currentUser.id}`);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Stato hardware reale Bluetooth TiMini
  const [connection, setConnection] = useState<TiMiniConnection | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState<{ pct: number; label: string } | null>(null);
  const [darkness, setDarkness] = useState<ThermalDarknessLevel>('dark');
  const [copies, setCopies] = useState<number>(1);
  const [feedAfterSteps, setFeedAfterSteps] = useState<number>(64);
  const [chunkSize, setChunkSize] = useState<number>(80);

  // Picker Bluetooth nativo Electron (Windows .exe)
  const [electronBtDevices, setElectronBtDevices] = useState<ElectronBluetoothDevice[] | null>(
    null
  );

  // Anteprima binarizzata 384px
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestRowsRef = useRef<Uint8Array[]>([]);
  const latestPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewDims, setPreviewDims] = useState<{ w: number; h: number; mmH: number }>({
    w: TIMINI_PRINT_WIDTH_PX,
    h: 320,
    mmH: 40,
  });

  // Filtri liste Magazzino & Commessa
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [selectedCommessaId, setSelectedCommessaId] = useState<string>(activeLoad.id);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [notice, setNotice] = useState<{ text: string; tone?: 'normal' | 'success' | 'error' } | null>(
    null
  );

  const showNotice = (text: string, tone: 'normal' | 'success' | 'error' = 'normal') => {
    setNotice({ text, tone });
    setTimeout(() => {
      setNotice((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  };

  // Ascolta eventi selettore Bluetooth in Electron Desktop
  useEffect(() => {
    const bridge = (window as any).metatronDesktop?.bluetooth;
    if (!bridge || typeof bridge.onDevices !== 'function') return;
    const unsubscribe = bridge.onDevices((devices: ElectronBluetoothDevice[]) => {
      setElectronBtDevices(Array.isArray(devices) ? devices : []);
    });
    return () => unsubscribe();
  }, []);

  // Verifica reale stato connessione GATT ogni 3 secondi + cleanup alla chiusura
  useEffect(() => {
    if (!connection) return;
    const timer = window.setInterval(() => {
      if (!isTiMiniConnected(connection)) {
        setConnection(null);
        setConnectedAt(null);
        showNotice('Connessione Bluetooth con la stampante TiMini persa.', 'error');
      }
    }, 3000);
    return () => {
      window.clearInterval(timer);
    };
  }, [connection]);

  useEffect(() => {
    return () => {
      connection?.disconnect();
    };
  }, [connection]);

  // Rigenera l'anteprima termica 1-bit 384px ad ogni modifica e quando si torna al tab Editor
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rawCanvas = await renderTiMiniLabelCanvas(design);
      if (cancelled) return;
      const { rows, previewCanvas } = binarizeThermalCanvas(
        rawCanvas,
        design.ditherMode,
        design.threshold,
        Boolean(design.mirrorHorizontal)
      );
      if (cancelled) return;
      latestRowsRef.current = rows;
      latestPreviewCanvasRef.current = previewCanvas;

      const mmH = Math.max(25, Math.round((previewCanvas.height / TIMINI_PRINT_WIDTH_PX) * 48));
      setPreviewDims({
        w: previewCanvas.width,
        h: previewCanvas.height,
        mmH,
      });

      const target = previewCanvasRef.current;
      if (target) {
        target.width = previewCanvas.width;
        target.height = previewCanvas.height;
        const ctx = target.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, target.width, target.height);
          ctx.drawImage(previewCanvas, 0, 0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [design, activeTab]);

  const handleConnectBluetooth = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const conn = await connectTiMiniBluetooth();
      setElectronBtDevices(null);
      conn.device?.addEventListener?.('gattserverdisconnected', () => {
        setConnection(null);
        setConnectedAt(null);
        showNotice('Stampante TiMini disconnessa.');
      });
      setConnection(conn);
      setConnectedAt(
        new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      );
      showNotice(`Stampante collegata via Bluetooth: ${conn.deviceName}`, 'success');
    } catch (err: any) {
      setElectronBtDevices(null);
      const msg = err?.message || 'Connessione Bluetooth annullata o non riuscita.';
      if (!/cancel|annull/i.test(msg)) {
        showNotice(msg, 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectBluetooth = () => {
    connection?.disconnect();
    setConnection(null);
    setConnectedAt(null);
    showNotice('Stampante Bluetooth scollegata.');
  };

  const handleSelectElectronBtDevice = async (deviceId: string) => {
    const bridge = (window as any).metatronDesktop?.bluetooth;
    if (bridge?.selectDevice) {
      await bridge.selectDevice(deviceId);
    }
    setElectronBtDevices(null);
  };

  const handleCancelElectronBt = async () => {
    const bridge = (window as any).metatronDesktop?.bluetooth;
    if (bridge?.cancel) {
      await bridge.cancel();
    }
    setElectronBtDevices(null);
    setIsConnecting(false);
  };

  const handlePrintBluetooth = async () => {
    if (!connection || !isTiMiniConnected(connection)) {
      setConnection(null);
      setConnectedAt(null);
      showNotice('Stampante non collegata. Premi Connetti TiMini BLE.', 'error');
      return;
    }
    if (latestRowsRef.current.length === 0) return;
    setIsPrinting(true);
    setPrintProgress({ pct: 0, label: 'Invio Bluetooth...' });
    try {
      await printRowsToTiMini(connection, latestRowsRef.current, {
        darkness,
        feedAfterSteps,
        copies,
        chunkSize,
        onProgress: (pct, label) => setPrintProgress({ pct, label }),
      });
      showNotice(
        `Stampate ${copies} etichett${copies === 1 ? 'a' : 'e'} su ${connection.deviceName}.`,
        'success'
      );
    } catch (err: any) {
      showNotice(
        err?.message || 'Errore durante la trasmissione Bluetooth alla stampante.',
        'error'
      );
    } finally {
      setIsPrinting(false);
      setTimeout(() => setPrintProgress(null), 1500);
    }
  };

  const handlePrintTestSlip = async () => {
    if (!connection || !isTiMiniConnected(connection)) {
      showNotice('Collega prima la stampante TiMini via Bluetooth.', 'error');
      return;
    }
    setIsPrinting(true);
    setPrintProgress({ pct: 35, label: 'Invio ricevuta di test...' });
    try {
      await printTiMiniTestSlip(connection, darkness, chunkSize);
      setPrintProgress({ pct: 100, label: 'Test completato' });
      showNotice(`Test di stampa inviato a ${connection.deviceName}.`, 'success');
    } catch (err: any) {
      showNotice(err?.message || 'Errore durante la stampa di prova.', 'error');
    } finally {
      setIsPrinting(false);
      setTimeout(() => setPrintProgress(null), 1200);
    }
  };

  const handleFeedPaper = async () => {
    if (!connection || !isTiMiniConnected(connection)) {
      showNotice('Collega prima la stampante TiMini.', 'error');
      return;
    }
    try {
      await feedTiMiniPaper(connection, 56);
      showNotice('Avanzamento carta inviato.');
    } catch (err: any) {
      showNotice(err?.message || 'Errore avanzamento carta.', 'error');
    }
  };

  const handlePrintSystem = () => {
    if (!latestPreviewCanvasRef.current) return;
    printThermalCanvasViaSystemDialog(latestPreviewCanvasRef.current, copies);
    showNotice('Finestra di stampa Windows / USB aperta.');
  };

  const handleDownloadPdf = () => {
    if (!latestPreviewCanvasRef.current) return;
    const slug = (design.codeText || design.title || 'etichetta')
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .slice(0, 32);
    downloadThermalLabelPdf(latestPreviewCanvasRef.current, `TiMini_${slug}_57mm.pdf`, copies);
    showNotice('PDF termico 57mm scaricato.');
  };

  const handleDownloadPng = () => {
    if (!latestPreviewCanvasRef.current) return;
    const url = latestPreviewCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    const slug = (design.codeText || design.title || 'etichetta')
      .replace(/[^A-Za-z0-9_-]/g, '_')
      .slice(0, 32);
    a.download = `TiMini_${slug}_384px.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showNotice('Immagine PNG 384px salvata.');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotice('Seleziona un file immagine valido (PNG, JPG, WebP).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDesign((prev) => ({
          ...prev,
          imageDataUrl: reader.result as string,
          ditherMode: 'floyd_steinberg',
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveTemplate = () => {
    const name = templateNameInput.trim() || design.title.trim() || 'Modello Etichetta';
    const nextEntry: TiMiniLabelDesign = {
      ...design,
      id: `tpl_${Date.now()}`,
      name,
    };
    const nextList = [nextEntry, ...templates].slice(0, 30);
    setTemplates(nextList);
    try {
      localStorage.setItem(`${TEMPLATES_KEY_PREFIX}${currentUser.id}`, JSON.stringify(nextList));
    } catch {}
    setTemplateNameInput('');
    showNotice(`Modello "${name}" salvato.`, 'success');
  };

  const handleDeleteTemplate = (tplId: string) => {
    const nextList = templates.filter((t) => t.id !== tplId);
    setTemplates(nextList);
    try {
      localStorage.setItem(`${TEMPLATES_KEY_PREFIX}${currentUser.id}`, JSON.stringify(nextList));
    } catch {}
    showNotice('Modello rimosso.');
  };

  const applyQuickPreset = (kind: 'stock' | 'pallet' | 'shipping') => {
    if (kind === 'stock') {
      setDesign(createDefaultDesign(currentUser.company));
    } else if (kind === 'pallet') {
      setDesign((prev) => ({
        ...prev,
        headerTag: 'IDENTIFICATIVO BANCALE',
        title: activeLoad.client || 'BANCALE SPEDIZIONE',
        subtitle: `${activeLoad.destination || 'Magazzino'} · 120×80 cm`,
        codeText: `${activeLoad.code}-B01`,
        footerText: `Commessa ${activeLoad.code}`,
        includeBarcode: true,
        barcodeContent: `${activeLoad.code}-B01`,
        includeQr: true,
        qrContent: `${activeLoad.code}:B01`,
        borderStyle: 'header_banner',
      }));
    } else {
      setDesign((prev) => ({
        ...prev,
        headerTag: 'ETICHETTA COLLO · FRAGILE',
        title: activeLoad.client || 'DESTINATARIO',
        subtitle: activeLoad.destination || 'Indirizzo spedizione',
        codeText: activeLoad.code,
        footerText: 'MANEGGIARE CON CURA',
        includeBarcode: true,
        barcodeContent: activeLoad.code,
        includeQr: false,
        borderStyle: 'frame',
      }));
    }
    setActiveTab('editor');
  };

  const loadFromWarehouseItem = (item: WarehouseStockItem) => {
    const barcodeVal = item.barcode || item.sku;
    setDesign((prev) => ({
      ...prev,
      headerTag: currentUser.company || 'MAGAZZINO METATRON',
      title: item.name,
      subtitle: [
        item.location ? `Pos. ${item.location}` : '',
        item.category,
        item.supplier ? `Forn. ${item.supplier}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      codeText: item.sku,
      footerText: `Giacenza: ${item.quantity} ${item.unit} · Min: ${item.minStock}`,
      includeQr: true,
      qrContent: barcodeVal,
      includeBarcode: true,
      barcodeContent: barcodeVal,
      imageDataUrl: undefined,
      ditherMode: 'threshold',
    }));
    setActiveTab('editor');
    showNotice(`Caricata etichetta per ${item.sku}.`);
  };

  const selectedCommessa = useMemo(
    () => loads.find((l) => l.id === selectedCommessaId) || activeLoad,
    [loads, selectedCommessaId, activeLoad]
  );

  const commessaSummary = useMemo(
    () => calculateLoadSummary(selectedCommessa),
    [selectedCommessa]
  );

  const filteredWarehouseItems = useMemo(() => {
    const q = warehouseSearch.trim().toLowerCase();
    if (!q) return inventory.items;
    return inventory.items.filter(
      (it) =>
        it.sku.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        (it.barcode || '').toLowerCase().includes(q) ||
        (it.location || '').toLowerCase().includes(q)
    );
  }, [inventory.items, warehouseSearch]);

  const btSupported = isWebBluetoothSupported();
  const isConnected = Boolean(connection);

  return (
    <div className="h-full flex bg-[#F4F6F9] text-slate-900 overflow-hidden select-none">
      {/* SIDEBAR SINISTRA */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200/90 flex flex-col">
        {/* Titolo Applicazione */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="text-[15px] font-semibold text-slate-900 tracking-tight">
            TiMini Print
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Termica 57mm · 384px · 200 DPI
          </div>
        </div>

        {/* Navigazione Sorgenti */}
        <nav className="px-3 py-4 space-y-1">
          <div className="px-2.5 pb-1.5 text-[11px] font-medium text-slate-400">
            Sorgente etichetta
          </div>
          {(
            [
              { id: 'editor', label: 'Editor Etichetta', icon: FileText, count: null },
              {
                id: 'warehouse',
                label: 'Da Magazzino',
                icon: Package,
                count: inventory.items.length,
              },
              {
                id: 'commessa',
                label: 'Commesse & Bancali',
                icon: Layers,
                count: loads.length,
              },
              {
                id: 'templates',
                label: 'Modelli Salvati',
                icon: Bookmark,
                count: templates.length,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.count !== null && (
                  <span
                    className={`text-xs font-mono tabular-nums shrink-0 ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* STATO STAMPANTE BLUETOOTH (sempre ben visibile) */}
        <div className="px-4 py-4 border-t border-slate-100 flex-1 overflow-y-auto">
          <div className="text-[11px] font-medium text-slate-400 mb-2.5">
            Stato Stampante
          </div>

          {isConnected && connection ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <BluetoothConnected className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span>Collegata</span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-slate-900 truncate mt-0.5">
                    {connection.deviceName}
                  </div>
                  {connectedAt && (
                    <div className="text-[11px] text-emerald-700/80 tabular-nums mt-0.5">
                      Attiva dalle {connectedAt}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={handlePrintTestSlip}
                  disabled={isPrinting}
                  className="py-1.5 px-2 text-xs font-medium text-emerald-900 bg-white hover:bg-emerald-100/70 border border-emerald-200 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Stampa una piccola ricevuta di verifica sulla TiMini"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Test
                </button>
                <button
                  type="button"
                  onClick={handleFeedPaper}
                  disabled={isPrinting}
                  className="py-1.5 px-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                  Avanza
                </button>
              </div>

              <button
                type="button"
                onClick={handleDisconnectBluetooth}
                disabled={isPrinting}
                className="w-full py-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                Scollega stampante
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="flex items-start gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-slate-200/80 text-slate-500 flex items-center justify-center shrink-0">
                  <BluetoothOff className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800">
                    Non collegata
                  </div>
                  <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                    Accendi la TiMini e premi Connetti per associarla.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConnectBluetooth}
                disabled={isConnecting || !btSupported}
                className="w-full py-2 px-3 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Ricerca Bluetooth...
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-3.5 h-3.5" />
                    Connetti TiMini BLE
                  </>
                )}
              </button>

              {!btSupported && (
                <p className="text-[11px] text-slate-500 leading-snug">
                  Bluetooth non attivo in questo browser: usa Stampa Windows / USB oppure esporta
                  PNG.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Esportazione file */}
        <div className="px-4 py-3.5 border-t border-slate-100 space-y-1.5">
          <div className="text-[11px] font-medium text-slate-400 mb-1">Esporta etichetta</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              PNG
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-2.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF 57mm
            </button>
          </div>
        </div>
      </aside>

      {/* AREA PRINCIPALE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP BAR PULITA */}
        <header className="h-14 shrink-0 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 whitespace-nowrap">METATRON</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-900 truncate">TiMini Print</span>
            </div>

            <span className="h-4 w-px bg-slate-200 shrink-0" aria-hidden="true" />

            {/* Indicatore testuale live connessione hardware */}
            <div className="flex items-center gap-1.5 text-xs min-w-0">
              {isConnected && connection ? (
                <>
                  <BluetoothConnected className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-medium text-emerald-700 whitespace-nowrap">Collegata</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono text-slate-600 truncate max-w-[160px]">
                    {connection.deviceName}
                  </span>
                </>
              ) : isConnecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
                  <span className="text-blue-700 whitespace-nowrap">Ricerca stampante...</span>
                </>
              ) : (
                <>
                  <BluetoothOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500 whitespace-nowrap">Non collegata</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePrintSystem}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Stampa Windows / USB
            </button>
            <button
              type="button"
              disabled={isPrinting}
              onClick={isConnected ? handlePrintBluetooth : handleConnectBluetooth}
              className={`px-4 py-2 text-xs font-medium text-white rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 cursor-pointer ${
                isConnected
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5" />
              {isPrinting
                ? 'Stampa in corso...'
                : isConnected
                ? `Stampa su TiMini (${copies}×)`
                : 'Connetti & Stampa'}
            </button>
          </div>
        </header>

        {/* Banner avvisi / errori */}
        {notice && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between gap-4 ${
              notice.tone === 'error'
                ? 'bg-rose-600 text-white'
                : notice.tone === 'success'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-900 text-white'
            }`}
          >
            <span className="leading-snug">{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="opacity-80 hover:opacity-100 shrink-0 cursor-pointer"
              aria-label="Chiudi avviso"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Barra avanzamento stampa Bluetooth */}
        {printProgress && (
          <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-4">
            <div className="flex-1 h-1.5 bg-blue-200/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-150"
                style={{ width: `${printProgress.pct}%` }}
              />
            </div>
            <span className="text-xs font-mono tabular-nums text-blue-900 whitespace-nowrap">
              {printProgress.pct}% · {printProgress.label}
            </span>
          </div>
        )}

        {/* WORKSPACE */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* COLONNA CENTRALE */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {activeTab === 'warehouse' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={warehouseSearch}
                      onChange={(e) => setWarehouseSearch(e.target.value)}
                      placeholder="Cerca articolo per SKU, nome, barcode o posizione..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
                    {filteredWarehouseItems.length} articoli
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {filteredWarehouseItems.length === 0 ? (
                    <div className="py-16 px-6 text-center space-y-2">
                      <Package className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-sm font-medium text-slate-700">
                        Nessun articolo trovato in Magazzino
                      </div>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Aggiungi articoli nell’app Magazzino per generare le loro etichette barcode e
                        QR in un clic.
                      </p>
                    </div>
                  ) : (
                    filteredWarehouseItems.map((it) => (
                      <div
                        key={it.id}
                        className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {it.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                            {it.sku} · Pos. {it.location || '—'} · Giac. {it.quantity} {it.unit}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadFromWarehouseItem(it)}
                          className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shrink-0 transition-colors cursor-pointer"
                        >
                          Carica etichetta
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : activeTab === 'commessa' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <select
                    value={selectedCommessa.id}
                    onChange={(e) => setSelectedCommessaId(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400"
                  >
                    {loads.map((ld) => (
                      <option key={ld.id} value={ld.id}>
                        {ld.code} — {ld.client || ld.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setDesign((prev) => ({
                        ...prev,
                        headerTag: `COMMESSA ${selectedCommessa.code}`,
                        title: selectedCommessa.client || selectedCommessa.title,
                        subtitle: `${selectedCommessa.destination || 'Spedizione'} · ${
                          commessaSummary.totalPallets
                        } bancali · ${commessaSummary.totalGrossWeightKg.toFixed(0)} kg`,
                        codeText: selectedCommessa.code,
                        footerText: `Vettore: ${selectedCommessa.carrier || 'Da definire'}`,
                        includeQr: true,
                        qrContent: `${selectedCommessa.code} | ${selectedCommessa.client}`,
                        includeBarcode: true,
                        barcodeContent: selectedCommessa.code,
                        imageDataUrl: undefined,
                        ditherMode: 'threshold',
                      }));
                      setActiveTab('editor');
                    }}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    Etichetta Commessa Intera
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-2.5 tabular-nums">
                      Bancali · {selectedCommessa.pallets.length}
                    </div>
                    {selectedCommessa.pallets.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3">
                        Nessun bancale in questa commessa.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {selectedCommessa.pallets.map((p) => {
                          const pSum = commessaSummary.palletSummaries.find(
                            (ps) => ps.pallet.id === p.id
                          );
                          return (
                            <div
                              key={p.id}
                              className="px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-mono font-semibold text-slate-900">
                                  {p.code} · {p.label}
                                </div>
                                <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                                  {p.dimensionsCm} · Peso{' '}
                                  {(pSum?.grossWeightKg ?? p.tareKg).toFixed(1)} kg
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setDesign((prev) => ({
                                    ...prev,
                                    headerTag: `BANCALE · ${selectedCommessa.code}`,
                                    title: selectedCommessa.client || p.label,
                                    subtitle: `${selectedCommessa.destination || ''} · ${
                                      p.dimensionsCm
                                    } · ${(pSum?.grossWeightKg ?? p.tareKg).toFixed(0)} kg`,
                                    codeText: p.code,
                                    footerText: `Commessa ${selectedCommessa.code} · ${p.label}`,
                                    includeQr: true,
                                    qrContent: `${selectedCommessa.code}:${p.code}`,
                                    includeBarcode: true,
                                    barcodeContent: `${selectedCommessa.code}-${p.code}`,
                                    imageDataUrl: undefined,
                                    ditherMode: 'threshold',
                                  }));
                                  setActiveTab('editor');
                                }}
                                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Carica
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-500 mb-2.5 tabular-nums">
                      Scatole · {selectedCommessa.boxes.length}
                    </div>
                    {selectedCommessa.boxes.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3">
                        Nessuna scatola in questa commessa.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {selectedCommessa.boxes.map((b) => (
                          <div
                            key={b.id}
                            className="px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-semibold text-slate-900">
                                {b.code} · {b.label}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {b.dimensionsCm} {b.fragile ? '· FRAGILE' : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setDesign((prev) => ({
                                  ...prev,
                                  headerTag: b.fragile
                                    ? `FRAGILE · ${selectedCommessa.code}`
                                    : `COLLO · ${selectedCommessa.code}`,
                                  title: b.label,
                                  subtitle: `${selectedCommessa.client} · ${b.dimensionsCm}`,
                                  codeText: b.code,
                                  footerText: b.fragile
                                    ? 'MANEGGIARE CON CURA'
                                    : selectedCommessa.destination || selectedCommessa.code,
                                  includeQr: true,
                                  qrContent: `${selectedCommessa.code}:${b.code}`,
                                  includeBarcode: true,
                                  barcodeContent: b.code,
                                  imageDataUrl: undefined,
                                  ditherMode: 'threshold',
                                }));
                                setActiveTab('editor');
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Carica
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'templates' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="px-6 py-4 border-b border-slate-200/80 flex items-center gap-2.5">
                  <input
                    type="text"
                    value={templateNameInput}
                    onChange={(e) => setTemplateNameInput(e.target.value)}
                    placeholder="Nome del modello per salvare l’etichetta attuale..."
                    className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap transition-colors cursor-pointer"
                  >
                    Salva modello
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {templates.length === 0 ? (
                    <div className="py-16 px-6 text-center space-y-2">
                      <Bookmark className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="text-sm font-medium text-slate-700">
                        Nessun modello salvato
                      </div>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        Personalizza la tua etichetta e salvala qui per riutilizzarla in un clic.
                      </p>
                    </div>
                  ) : (
                    templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {tpl.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">
                            {tpl.title} · {tpl.codeText || 'Senza codice'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDesign({ ...tpl });
                              setActiveTab('editor');
                            }}
                            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            Apri
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                            aria-label="Elimina modello"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* STUDIO ANTEPRIMA CARTA TERMICA 57mm */
              <div
                className="flex-1 flex flex-col min-h-0 overflow-hidden"
                style={{
                  backgroundColor: '#EEF1F5',
                  backgroundImage:
                    'radial-gradient(rgba(15, 23, 42, 0.08) 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              >
                {/* Barra info dimensioni, copie & zoom */}
                <div className="px-6 py-3 bg-white/80 backdrop-blur-xs border-b border-slate-200/80 flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-600 font-mono tabular-nums">
                    57 × {previewDims.mmH} mm · {previewDims.w} × {previewDims.h} px · 200 DPI
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Copie rapide */}
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <span>Copie</span>
                      <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setCopies((c) => Math.max(1, c - 1))}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
                          aria-label="Riduci copie"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-semibold text-slate-900 tabular-nums">
                          {copies}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCopies((c) => Math.min(20, c + 1))}
                          className="w-6 h-6 flex items-center justify-center rounded-md text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
                          aria-label="Aumenta copie"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Zoom anteprima */}
                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom('100')}
                        className={`px-2.5 py-1 rounded-md font-medium tabular-nums transition-colors cursor-pointer ${
                          previewZoom === '100'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        100%
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom('125')}
                        className={`px-2.5 py-1 rounded-md font-medium tabular-nums transition-colors cursor-pointer ${
                          previewZoom === '125'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        125%
                      </button>
                    </div>
                  </div>
                </div>

                {/* Foglio rotolo termico centrato */}
                <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col items-center justify-start">
                  <div
                    className="transition-transform duration-150"
                    style={{
                      filter: 'drop-shadow(0 18px 30px rgba(15, 23, 42, 0.14))',
                    }}
                  >
                    <ThermalTearEdge />
                    <div className="bg-white px-5 py-4">
                      <canvas
                        ref={previewCanvasRef}
                        className={`block h-auto transition-all duration-150 ${
                          previewZoom === '125' ? 'w-[340px]' : 'w-[288px]'
                        }`}
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                    <ThermalTearEdge flip />
                  </div>

                  <p className="mt-6 text-xs text-slate-500 text-center max-w-sm leading-relaxed">
                    Anteprima reale in bianco e nero 1-bit: la stampante termica TiMini inciderà
                    esattamente questi pixel sulla carta da 57 mm.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* PANNELLO ISPETTORE DESTRO (organizzato in 3 tab pulite) */}
          <aside className="w-[368px] shrink-0 border-l border-slate-200/90 bg-white flex flex-col overflow-hidden">
            {/* Segmented Control Tabs */}
            <div className="px-5 pt-4 pb-3 border-b border-slate-100">
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                {(
                  [
                    { id: 'content', label: 'Contenuto' },
                    { id: 'codes', label: 'Codici & Logo' },
                    { id: 'printer', label: 'Stampante' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setInspectorTab(tab.id)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                      inspectorTab === tab.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Corpo Ispettore */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 text-xs">
              {inspectorTab === 'content' && (
                <>
                  {/* Preset rapidi */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-slate-400">
                        Modelli rapidi
                      </span>
                      <button
                        type="button"
                        onClick={() => setDesign(createDefaultDesign(currentUser.company))}
                        className="text-[11px] text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Ripristina
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('stock')}
                        className="py-1.5 px-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Articolo
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('pallet')}
                        className="py-1.5 px-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Bancale
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickPreset('shipping')}
                        className="py-1.5 px-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Fragile
                      </button>
                    </div>
                  </div>

                  {/* Campi Testo */}
                  <div className="space-y-3.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Intestazione / Reparto
                      </label>
                      <input
                        type="text"
                        value={design.headerTag}
                        onChange={(e) => setDesign({ ...design, headerTag: e.target.value })}
                        placeholder="METATRON MAGAZZINO"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Titolo principale
                      </label>
                      <input
                        type="text"
                        value={design.title}
                        onChange={(e) => setDesign({ ...design, title: e.target.value })}
                        placeholder="Nome articolo, cliente o collo"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Sottotitolo / Dettagli
                      </label>
                      <input
                        type="text"
                        value={design.subtitle}
                        onChange={(e) => setDesign({ ...design, subtitle: e.target.value })}
                        placeholder="Posizione, peso, note..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Codice / SKU
                        </label>
                        <input
                          type="text"
                          value={design.codeText}
                          onChange={(e) =>
                            setDesign({
                              ...design,
                              codeText: e.target.value,
                              barcodeContent:
                                design.barcodeContent === design.codeText
                                  ? e.target.value
                                  : design.barcodeContent,
                              qrContent:
                                design.qrContent === design.codeText
                                  ? e.target.value
                                  : design.qrContent,
                            })
                          }
                          className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                          Piè di pagina
                        </label>
                        <input
                          type="text"
                          value={design.footerText}
                          onChange={(e) => setDesign({ ...design, footerText: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stile rapido */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Stile cornice
                      </label>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                        {(
                          [
                            { id: 'header_banner', label: 'Testata' },
                            { id: 'frame', label: 'Cornice' },
                            { id: 'none', label: 'Pulita' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setDesign({ ...design, borderStyle: opt.id as LabelBorderStyle })
                            }
                            className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                              design.borderStyle === opt.id
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Dimensione testo
                      </label>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                        {(
                          [
                            { id: 'compact', label: 'Compatto' },
                            { id: 'normal', label: 'Normale' },
                            { id: 'large', label: 'Grande' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDesign({ ...design, fontScale: opt.id })}
                            className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                              design.fontScale === opt.id
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {inspectorTab === 'codes' && (
                <div className="space-y-5">
                  {/* Barcode 1D */}
                  <div className="space-y-2.5">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <Barcode className="w-4 h-4 text-slate-500" />
                        Codice a Barre 1D (Code39)
                      </span>
                      <input
                        type="checkbox"
                        checked={design.includeBarcode}
                        onChange={(e) =>
                          setDesign({ ...design, includeBarcode: e.target.checked })
                        }
                        className="w-4 h-4 accent-slate-900 cursor-pointer"
                      />
                    </label>
                    {design.includeBarcode && (
                      <input
                        type="text"
                        value={design.barcodeContent}
                        onChange={(e) =>
                          setDesign({ ...design, barcodeContent: e.target.value })
                        }
                        placeholder="Testo codice a barre (es. SKU-001)"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                      />
                    )}
                  </div>

                  {/* QR Code */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-100">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <QrCode className="w-4 h-4 text-slate-500" />
                        QR Code scansionabile
                      </span>
                      <input
                        type="checkbox"
                        checked={design.includeQr}
                        onChange={(e) => setDesign({ ...design, includeQr: e.target.checked })}
                        className="w-4 h-4 accent-slate-900 cursor-pointer"
                      />
                    </label>
                    {design.includeQr && (
                      <input
                        type="text"
                        value={design.qrContent}
                        onChange={(e) => setDesign({ ...design, qrContent: e.target.value })}
                        placeholder="Contenuto QR (SKU, URL, commessa...)"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                      />
                    )}
                  </div>

                  {/* Logo / Foto */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-100">
                    <div className="font-medium text-slate-800">Logo aziendale o foto</div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      L’immagine viene convertita automaticamente in retino termico 1-bit per la
                      testina da 384 px.
                    </p>
                    <div className="flex items-center gap-2">
                      <label className="flex-1 px-3 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4 text-slate-500" />
                        {design.imageDataUrl ? 'Sostituisci immagine' : 'Carica logo o immagine'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {design.imageDataUrl && (
                        <button
                          type="button"
                          onClick={() => setDesign({ ...design, imageDataUrl: undefined })}
                          className="p-2.5 text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          title="Rimuovi immagine"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {inspectorTab === 'printer' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Intensità stampa termica
                    </label>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                      {(
                        [
                          { id: 'light', label: 'Chiaro' },
                          { id: 'medium', label: 'Medio' },
                          { id: 'dark', label: 'Scuro' },
                          { id: 'ultra', label: 'Extra' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDarkness(opt.id)}
                          className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                            darkness === opt.id
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Altezza carta
                      </label>
                      <select
                        value={design.heightPreset}
                        onChange={(e) =>
                          setDesign({
                            ...design,
                            heightPreset: e.target.value as LabelHeightPreset,
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                      >
                        <option value="auto">Automatica</option>
                        <option value="30mm">57 × 30 mm</option>
                        <option value="40mm">57 × 40 mm</option>
                        <option value="50mm">57 × 50 mm</option>
                        <option value="75mm">57 × 75 mm</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Binarizzazione
                      </label>
                      <select
                        value={design.ditherMode}
                        onChange={(e) =>
                          setDesign({
                            ...design,
                            ditherMode: e.target.value as ThermalDitherMode,
                          })
                        }
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                      >
                        <option value="threshold">Nitida (Testo/QR)</option>
                        <option value="floyd_steinberg">Retino (Foto)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                      <span>Contrasto / Soglia nero</span>
                      <span className="font-mono font-medium text-slate-900 tabular-nums">
                        {design.threshold}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={80}
                      max={220}
                      value={design.threshold}
                      onChange={(e) => setDesign({ ...design, threshold: Number(e.target.value) })}
                      className="w-full accent-slate-900 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Avanza carta (passi)
                      </label>
                      <input
                        type="number"
                        min={16}
                        max={200}
                        value={feedAfterSteps}
                        onChange={(e) =>
                          setFeedAfterSteps(
                            Math.max(16, Math.min(200, Number(e.target.value) || 64))
                          )
                        }
                        className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Pacchetto BLE
                      </label>
                      <select
                        value={chunkSize}
                        onChange={(e) => setChunkSize(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <option value={20}>20 B (sicuro)</option>
                        <option value={80}>80 B (standard)</option>
                        <option value={120}>120 B (rapido)</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center justify-between pt-2 border-t border-slate-100 cursor-pointer">
                    <span className="text-xs text-slate-700">
                      Specchio orizzontale (alcuni modelli)
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(design.mirrorHorizontal)}
                      onChange={(e) =>
                        setDesign({ ...design, mirrorHorizontal: e.target.checked })
                      }
                      className="w-4 h-4 accent-slate-900 cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* MODALE SELETTORE DISPOSITIVI BLUETOOTH (Electron Desktop Windows) */}
      {electronBtDevices !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Bluetooth className="w-4 h-4 text-blue-600" />
                Seleziona Stampante TiMini
              </div>
              <button
                type="button"
                onClick={handleCancelElectronBt}
                className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer"
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto space-y-2 text-xs">
              {electronBtDevices.length === 0 ? (
                <div className="py-10 text-center space-y-2 text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
                  <p>Ricerca dispositivi Bluetooth nelle vicinanze...</p>
                  <p className="text-[11px] text-slate-400">
                    Assicurati che la stampante TiMini sia accesa e non collegata al telefono.
                  </p>
                </div>
              ) : (
                electronBtDevices.map((dev) => (
                  <button
                    key={dev.deviceId}
                    type="button"
                    onClick={() => handleSelectElectronBtDevice(dev.deviceId)}
                    className="w-full px-4 py-3 text-left rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {dev.deviceName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                        {dev.deviceId}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-blue-600 shrink-0">Connetti</span>
                  </button>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={handleCancelElectronBt}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
