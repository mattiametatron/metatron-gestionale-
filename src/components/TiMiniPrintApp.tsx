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
  Check,
  ChevronsDown,
  Image as ImageIcon,
  QrCode,
  Barcode,
  RefreshCw,
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
  isWebBluetoothSupported,
  LabelBorderStyle,
  LabelHeightPreset,
  printRowsToTiMini,
  printThermalCanvasViaSystemDialog,
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

export const TiMiniPrintApp: React.FC<TiMiniPrintAppProps> = ({
  currentUser,
  inventory,
  loads,
  activeLoad,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'warehouse' | 'commessa' | 'templates'>(
    'editor'
  );
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

  // Impostazioni hardware TiMini
  const [connection, setConnection] = useState<TiMiniConnection | null>(null);
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
  const [notice, setNotice] = useState<{ text: string; tone?: 'normal' | 'error' } | null>(null);

  const showNotice = (text: string, tone: 'normal' | 'error' = 'normal') => {
    setNotice({ text, tone });
    setTimeout(() => {
      setNotice((curr) => (curr?.text === text ? null : curr));
    }, 4200);
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

  // Cleanup connessione BLE alla chiusura della finestra
  useEffect(() => {
    return () => {
      connection?.disconnect();
    };
  }, [connection]);

  // Rigenera l'anteprima termica 1-bit 384px ad ogni modifica del design
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
  }, [design]);

  const handleConnectBluetooth = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      const conn = await connectTiMiniBluetooth();
      setElectronBtDevices(null);
      conn.device?.addEventListener?.('gattserverdisconnected', () => {
        setConnection(null);
        showNotice('Stampante TiMini disconnessa.');
      });
      setConnection(conn);
      showNotice(`Connessa via Bluetooth: ${conn.deviceName}`);
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
    if (!connection) {
      showNotice('Collega prima la stampante TiMini via Bluetooth.', 'error');
      return;
    }
    if (latestRowsRef.current.length === 0) return;
    setIsPrinting(true);
    setPrintProgress({ pct: 0, label: 'Avvio invio Bluetooth...' });
    try {
      await printRowsToTiMini(connection, latestRowsRef.current, {
        darkness,
        feedAfterSteps,
        copies,
        chunkSize,
        onProgress: (pct, label) => setPrintProgress({ pct, label }),
      });
      showNotice(`Stampate ${copies} etichett${copies === 1 ? 'a' : 'e'} su ${connection.deviceName}.`);
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

  const handleFeedPaper = async () => {
    if (!connection) {
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
    showNotice('Finestra di stampa Windows/USB aperta.');
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
    showNotice('Immagine PNG 384px salvata (pronta anche per app Tiny Print su telefono).');
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
    showNotice(`Modello "${name}" salvato.`);
  };

  const handleDeleteTemplate = (tplId: string) => {
    const nextList = templates.filter((t) => t.id !== tplId);
    setTemplates(nextList);
    try {
      localStorage.setItem(`${TEMPLATES_KEY_PREFIX}${currentUser.id}`, JSON.stringify(nextList));
    } catch {}
    showNotice('Modello rimosso.');
  };

  // Carica un articolo di Magazzino direttamente nell'etichetta
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

  return (
    <div className="h-full flex bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar Sinistra */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900 tracking-tight">
            TiMini Print
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            Termica 57mm · 384px · 200 DPI
          </div>
        </div>

        <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
            Sorgente etichetta
          </div>
          {(
            [
              { id: 'editor', label: 'Editor Etichetta', icon: FileText },
              {
                id: 'warehouse',
                label: `Da Magazzino (${inventory.items.length})`,
                icon: Package,
              },
              { id: 'commessa', label: 'Da Commessa & Bancali', icon: Layers },
              {
                id: 'templates',
                label: `Modelli Salvati (${templates.length})`,
                icon: Bookmark,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          {/* Pannello Stampante Bluetooth BLE */}
          <div className="pt-4 mt-4 border-t border-slate-200 px-1.5 space-y-2.5">
            <div className="text-[11px] font-medium text-slate-500 px-1">
              Stampante Bluetooth TiMini
            </div>

            {connection ? (
              <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                  <BluetoothConnected className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">{connection.deviceName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleFeedPaper}
                    disabled={isPrinting}
                    className="flex-1 py-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ChevronsDown className="w-3 h-3" />
                    Avanza
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectBluetooth}
                    disabled={isPrinting}
                    className="px-2 py-1.5 text-[11px] font-medium text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-md cursor-pointer"
                  >
                    Scollega
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectBluetooth}
                disabled={isConnecting || !btSupported}
                className="w-full py-2 px-3 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Ricerca BLE...
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-3.5 h-3.5" />
                    Connetti TiMini BLE
                  </>
                )}
              </button>
            )}

            {!btSupported && (
              <p className="text-[11px] text-slate-500 px-1 leading-snug">
                Web Bluetooth non attivo in questo browser: usa Stampa Windows/USB o PNG 384px.
              </p>
            )}
          </div>
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-1.5">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="w-full px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            PNG 384px (Tiny Print)
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="w-full px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Scarica PDF 57mm
          </button>
        </div>
      </aside>

      {/* Corpo Centrale + Pannello Destro */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400">METATRON</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900 truncate">
              TiMini Print — Stampante Etichette Termiche
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintSystem}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Stampa Windows / USB
            </button>
            <button
              type="button"
              disabled={isPrinting}
              onClick={connection ? handlePrintBluetooth : handleConnectBluetooth}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 cursor-pointer"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              {isPrinting
                ? 'Stampa in corso...'
                : connection
                ? `Stampa su TiMini (${copies}×)`
                : 'Connetti & Stampa BLE'}
            </button>
          </div>
        </header>

        {notice && (
          <div
            className={`px-6 py-2 text-xs font-medium flex items-center justify-between ${
              notice.tone === 'error'
                ? 'bg-rose-700 text-white'
                : 'bg-slate-900 text-white'
            }`}
          >
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="opacity-75 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {printProgress && (
          <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-4">
            <div className="flex-1 h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-700 transition-all duration-150"
                style={{ width: `${printProgress.pct}%` }}
              />
            </div>
            <span className="text-xs font-mono tabular-nums text-blue-900 whitespace-nowrap">
              {printProgress.pct}% · {printProgress.label}
            </span>
          </div>
        )}

        {/* Workspace */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Colonna Centrale: Tab attiva oppure Anteprima Termica Live */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {activeTab === 'warehouse' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-white">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={warehouseSearch}
                      onChange={(e) => setWarehouseSearch(e.target.value)}
                      placeholder="Cerca articolo per SKU, nome, barcode o posizione..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {filteredWarehouseItems.length} articoli
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {filteredWarehouseItems.length === 0 ? (
                    <div className="p-10 text-center text-xs text-slate-500">
                      Nessun articolo presente in Magazzino.
                    </div>
                  ) : (
                    filteredWarehouseItems.map((it) => (
                      <div
                        key={it.id}
                        className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">{it.name}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            {it.sku} · Pos. {it.location || '—'} · Giac. {it.quantity} {it.unit}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => loadFromWarehouseItem(it)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shrink-0 cursor-pointer"
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
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                  <select
                    value={selectedCommessa.id}
                    onChange={(e) => setSelectedCommessaId(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-900"
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
                    className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Etichetta Commessa Intera
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-2">
                      Bancali ({selectedCommessa.pallets.length})
                    </div>
                    {selectedCommessa.pallets.length === 0 ? (
                      <div className="text-slate-400">Nessun bancale in questa commessa.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {selectedCommessa.pallets.map((p) => {
                          const pSum = commessaSummary.palletSummaries.find(
                            (ps) => ps.pallet.id === p.id
                          );
                          return (
                            <div
                              key={p.id}
                              className="px-4 py-2.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <div className="font-mono font-semibold text-slate-900">
                                  {p.code} · {p.label}
                                </div>
                                <div className="text-[11px] text-slate-500">
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
                                className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
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
                    <div className="text-[11px] font-medium text-slate-500 mb-2">
                      Scatole ({selectedCommessa.boxes.length})
                    </div>
                    {selectedCommessa.boxes.length === 0 ? (
                      <div className="text-slate-400">Nessuna scatola in questa commessa.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {selectedCommessa.boxes.map((b) => (
                          <div
                            key={b.id}
                            className="px-4 py-2.5 flex items-center justify-between gap-2 bg-white hover:bg-slate-50"
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-semibold text-slate-900">
                                {b.code} · {b.label}
                              </div>
                              <div className="text-[11px] text-slate-500">
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
                              className="px-3 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
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
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <input
                    type="text"
                    value={templateNameInput}
                    onChange={(e) => setTemplateNameInput(e.target.value)}
                    placeholder="Nome per salvare l'etichetta attuale come modello..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Salva modello attuale
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {templates.length === 0 ? (
                    <div className="p-10 text-center text-xs text-slate-500">
                      Nessun modello salvato. Configura un’etichetta e salvala qui per riutilizzarla
                      in un clic.
                    </div>
                  ) : (
                    templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{tpl.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {tpl.title} · {tpl.codeText || 'Senza codice'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDesign({ ...tpl });
                              setActiveTab('editor');
                            }}
                            className="px-3 py-1 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                          >
                            Apri
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* ANTEPRIMA TERMICA LIVE 384px (1-bit monocromatica fedele alla carta termica) */
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-start bg-slate-100">
                <div className="w-full max-w-md flex items-center justify-between text-xs text-slate-500 mb-3 font-mono tabular-nums">
                  <span>Anteprima Carta Termica 57mm</span>
                  <span>
                    {previewDims.w}×{previewDims.h} px · 57×{previewDims.mmH} mm
                  </span>
                </div>

                {/* Simulazione rotolo carta termica */}
                <div className="bg-white border border-slate-300 shadow-md px-5 py-4 rounded-sm">
                  <canvas
                    ref={previewCanvasRef}
                    className="block w-[288px] h-auto border border-dashed border-slate-200"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                <div className="mt-4 text-[11px] text-slate-500 text-center max-w-sm">
                  Anteprima reale in bianco e nero a 1 bit (200 DPI). Quello che vedi qui è
                  esattamente ciò che viene inviato alla testina termica TiMini.
                </div>
              </div>
            )}
          </div>

          {/* Pannello Destro: Contenuto Etichetta & Impostazioni Stampante */}
          <aside className="w-[380px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto px-5 py-4 space-y-5 text-xs">
            <div className="space-y-3">
              <div className="text-[11px] font-semibold text-slate-500">Contenuto Etichetta</div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Intestazione / Reparto
                </label>
                <input
                  type="text"
                  value={design.headerTag}
                  onChange={(e) => setDesign({ ...design, headerTag: e.target.value })}
                  placeholder="METATRON MAGAZZINO"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Titolo principale</label>
                <input
                  type="text"
                  value={design.title}
                  onChange={(e) => setDesign({ ...design, title: e.target.value })}
                  placeholder="Nome articolo, cliente o collo"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Sottotitolo / Dettagli
                </label>
                <input
                  type="text"
                  value={design.subtitle}
                  onChange={(e) => setDesign({ ...design, subtitle: e.target.value })}
                  placeholder="Posizione, peso, note..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Codice / SKU</label>
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
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Piè di pagina</label>
                  <input
                    type="text"
                    value={design.footerText}
                    onChange={(e) => setDesign({ ...design, footerText: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Barcode, QR & Immagine */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="text-[11px] font-semibold text-slate-500">
                Codici & Immagine / Logo
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Barcode className="w-3.5 h-3.5 text-slate-500" />
                    Stampa Codice a Barre 1D (Code39)
                  </span>
                  <input
                    type="checkbox"
                    checked={design.includeBarcode}
                    onChange={(e) => setDesign({ ...design, includeBarcode: e.target.checked })}
                  />
                </label>
                {design.includeBarcode && (
                  <input
                    type="text"
                    value={design.barcodeContent}
                    onChange={(e) => setDesign({ ...design, barcodeContent: e.target.value })}
                    placeholder="Testo codice a barre"
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <QrCode className="w-3.5 h-3.5 text-slate-500" />
                    Stampa QR Code
                  </span>
                  <input
                    type="checkbox"
                    checked={design.includeQr}
                    onChange={(e) => setDesign({ ...design, includeQr: e.target.checked })}
                  />
                </label>
                {design.includeQr && (
                  <input
                    type="text"
                    value={design.qrContent}
                    onChange={(e) => setDesign({ ...design, qrContent: e.target.value })}
                    placeholder="Contenuto QR (SKU, URL, commessa...)"
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {design.imageDataUrl ? 'Cambia Immagine / Logo' : 'Carica Logo o Foto'}
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
                    className="p-1.5 text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg cursor-pointer"
                    title="Rimuovi immagine"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Layout & Qualità Termica */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="text-[11px] font-semibold text-slate-500">
                Stile & Parametri Stampante TiMini
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Stile bordo</label>
                  <select
                    value={design.borderStyle}
                    onChange={(e) =>
                      setDesign({ ...design, borderStyle: e.target.value as LabelBorderStyle })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="header_banner">Testata Nera</option>
                    <option value="frame">Cornice</option>
                    <option value="none">Senza bordo</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Altezza etichetta</label>
                  <select
                    value={design.heightPreset}
                    onChange={(e) =>
                      setDesign({ ...design, heightPreset: e.target.value as LabelHeightPreset })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="auto">Automatica</option>
                    <option value="30mm">57 × 30 mm</option>
                    <option value="40mm">57 × 40 mm</option>
                    <option value="50mm">57 × 50 mm</option>
                    <option value="75mm">57 × 75 mm</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Copie</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={copies}
                    onChange={(e) =>
                      setCopies(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Intensità</label>
                  <select
                    value={darkness}
                    onChange={(e) => setDarkness(e.target.value as ThermalDarknessLevel)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="light">Chiaro</option>
                    <option value="medium">Medio</option>
                    <option value="dark">Scuro</option>
                    <option value="ultra">Extra Scuro</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Testo</label>
                  <select
                    value={design.fontScale}
                    onChange={(e) =>
                      setDesign({
                        ...design,
                        fontScale: e.target.value as 'compact' | 'normal' | 'large',
                      })
                    }
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="compact">Compatto</option>
                    <option value="normal">Normale</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Binarizzazione</label>
                  <select
                    value={design.ditherMode}
                    onChange={(e) =>
                      setDesign({ ...design, ditherMode: e.target.value as ThermalDitherMode })
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="threshold">Nitida (Testo / QR)</option>
                    <option value="floyd_steinberg">Retino (Foto / Loghi)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Avanza carta (passi)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={200}
                    value={feedAfterSteps}
                    onChange={(e) =>
                      setFeedAfterSteps(Math.max(16, Math.min(200, Number(e.target.value) || 64)))
                    }
                    className="w-full px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                  <span>Contrasto / Soglia nero</span>
                  <span className="font-mono tabular-nums">{design.threshold}</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={220}
                  value={design.threshold}
                  onChange={(e) => setDesign({ ...design, threshold: Number(e.target.value) })}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(design.mirrorHorizontal)}
                    onChange={(e) =>
                      setDesign({ ...design, mirrorHorizontal: e.target.checked })
                    }
                  />
                  <span>Inverti orizzontale (alcuni modelli)</span>
                </label>
                <select
                  value={chunkSize}
                  onChange={(e) => setChunkSize(Number(e.target.value))}
                  title="Dimensione pacchetto BLE"
                  className="px-2 py-1 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded"
                >
                  <option value={20}>BLE 20B (sicuro)</option>
                  <option value={80}>BLE 80B (rapido)</option>
                  <option value={120}>BLE 120B (veloce)</option>
                </select>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* MODALE SELETTORE DISPOSITIVI BLUETOOTH (Electron Desktop Windows) */}
      {electronBtDevices !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Bluetooth className="w-4 h-4 text-blue-700" />
                Seleziona Stampante TiMini Bluetooth
              </div>
              <button
                type="button"
                onClick={handleCancelElectronBt}
                className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto space-y-1.5 text-xs">
              {electronBtDevices.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  Ricerca stampanti Bluetooth nelle vicinanze... Assicurati che la stampante TiMini
                  sia accesa.
                </div>
              ) : (
                electronBtDevices.map((dev) => (
                  <button
                    key={dev.deviceId}
                    type="button"
                    onClick={() => handleSelectElectronBtDevice(dev.deviceId)}
                    className="w-full px-3.5 py-2.5 text-left rounded-lg border border-slate-200 hover:border-blue-600 hover:bg-blue-50/60 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {dev.deviceName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {dev.deviceId}
                      </div>
                    </div>
                    <span className="text-blue-700 font-medium shrink-0">Connetti</span>
                  </button>
                ))
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={handleCancelElectronBt}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
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
