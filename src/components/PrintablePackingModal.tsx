import React, { useState, useMemo } from 'react';
import {
  Printer,
  FileSpreadsheet,
  X,
  CheckSquare,
  Square,
  Package,
  Layers,
  FileText,
  PenTool,
  CheckCircle2,
  Trash2,
  FolderTree,
  GitBranch,
  Building2,
  Sparkles,
  Loader2,
  Bot,
  ExternalLink,
  Download,
  Info,
  QrCode,
} from 'lucide-react';
import { CargoLoad, ElectronicSignature, StockMovement } from '../types/warehouse';
import { LoadSummary, calculateLoadSummary, exportLoadToCSV } from '../utils/calculations';
import { SignaturePadModal } from './SignaturePadModal';
import { translateItalianToEnglish } from '../utils/logisticsTranslator';
import { translateLoadWithAi } from '../utils/aiTranslator';
import { PrintPortal } from './PrintPortal';
import {
  generateSelectiveLabelsPDF,
  openPdfBlobInNewTab,
  openTrackingLabelsA4PdfInNewTab,
} from '../utils/pdfGenerator';

interface PrintablePackingModalProps {
  load: CargoLoad;
  summary: LoadSummary;
  movements?: StockMovement[];
  onSaveSignature: (sig: ElectronicSignature) => void;
  onDeleteSignature: (role: 'operatore' | 'responsabile' | 'autista') => void;
  onClose: () => void;
  onOpenPdfTranslator?: () => void;
}

export type PrintCategory =
  | 'master_commessa_big'
  | 'pallets_only'
  | 'boxes_only'
  | 'tree_schema'
  | 'packing_list'
  | 'all';

export const PrintablePackingModal: React.FC<PrintablePackingModalProps> = ({
  load: rawLoad,
  summary: rawSummary,
  movements = [],
  onSaveSignature,
  onDeleteSignature,
  onClose,
  onOpenPdfTranslator,
}) => {
  const [printCategory, setPrintCategory] = useState<PrintCategory>('master_commessa_big');
  const [pageByPage, setPageByPage] = useState<boolean>(true);
  const [selectedPalletId, setSelectedPalletId] = useState<string>('all');
  const [selectedBoxId, setSelectedBoxId] = useState<string>('all');
  const [printLanguage, setPrintLanguage] = useState<'it' | 'en'>('it');

  // AI Automatic Translation State
  const [isAiTranslating, setIsAiTranslating] = useState<boolean>(false);
  const [aiTranslatedLoad, setAiTranslatedLoad] = useState<CargoLoad | null>(null);
  const [aiEngineUsed, setAiEngineUsed] = useState<'gemini' | 'offline' | null>(null);

  const isEn = printLanguage === 'en';
  const t = (itText: string, enText: string) => (isEn ? enText : itText);
  const tr = (val?: string) => (!val ? '' : isEn ? translateItalianToEnglish(val) : val);

  // Quando la lingua inglese è attiva e la traduzione AI è pronta, usa i dati tradotti con AI
  const load = isEn && aiTranslatedLoad ? aiTranslatedLoad : rawLoad;
  const summary = useMemo(() => {
    if (isEn && aiTranslatedLoad) {
      return calculateLoadSummary(aiTranslatedLoad);
    }
    return rawSummary;
  }, [isEn, aiTranslatedLoad, rawSummary]);

  const executeAiTranslation = async (targetLang: 'en' | 'it' = 'en') => {
    if (targetLang === 'it') {
      setPrintLanguage('it');
      return;
    }

    setPrintLanguage('en');
    if (aiTranslatedLoad) {
      return aiTranslatedLoad;
    }

    setIsAiTranslating(true);
    try {
      const result = await translateLoadWithAi(rawLoad, 'en');
      setAiTranslatedLoad(result.translatedLoad);
      setAiEngineUsed(result.engine);
      return result.translatedLoad;
    } catch (err) {
      console.error('Translation error:', err);
      return null;
    } finally {
      setIsAiTranslating(false);
    }
  };

  const handleAiTranslateAndPrint = async () => {
    setIsAiTranslating(true);
    setPrintLanguage('en');
    try {
      let tLoad = aiTranslatedLoad;
      if (!tLoad) {
        const res = await translateLoadWithAi(rawLoad, 'en');
        tLoad = res.translatedLoad;
        setAiTranslatedLoad(res.translatedLoad);
        setAiEngineUsed(res.engine);
      }
      setTimeout(() => {
        window.print();
      }, 300);
    } catch (err) {
      console.error('Error during AI translate and print:', err);
      window.print();
    } finally {
      setIsAiTranslating(false);
    }
  };

  // Signature modal state
  const [activeSignRole, setActiveSignRole] = useState<
    'operatore' | 'responsabile' | 'autista' | null
  >(null);

  const handlePrint = () => {
    window.print();
  };

  const handleOpenPdfForPrint = () => {
    const doc = generateSelectiveLabelsPDF(
      load,
      printCategory,
      selectedPalletId,
      selectedBoxId
    );
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    openPdfBlobInNewTab(url);
  };

  const handleDownloadPdf = () => {
    const doc = generateSelectiveLabelsPDF(
      load,
      printCategory,
      selectedPalletId,
      selectedBoxId
    );
    const cleanCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Stampa_${printCategory}_${cleanCode}.pdf`);
  };

  const getSignature = (role: 'operatore' | 'responsabile' | 'autista') => {
    return load.signatures?.find((s) => s.role === role);
  };

  const operatoreSig = getSignature('operatore');
  const responsabileSig = getSignature('responsabile');
  const autistaSig = getSignature('autista');

  const displayedPalletSummaries = summary.palletSummaries.filter((ps) => {
    if (selectedPalletId === 'all') return true;
    return ps.pallet.id === selectedPalletId;
  });

  const allBoxesWithPallet = summary.palletSummaries.flatMap((ps) =>
    ps.boxes.map((bs) => ({ ...bs, pallet: ps.pallet }))
  );

  const displayedBoxes = allBoxesWithPallet.filter((b) => {
    if (selectedBoxId === 'all') {
      if (selectedPalletId === 'all') return true;
      return b.pallet.id === selectedPalletId;
    }
    return b.box.id === selectedBoxId;
  });

  return (
    <PrintPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto print-modal-container">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden text-slate-900 print-canvas-wrapper">
        {/* =========================================================================
            HEADER & CONTROLLI MODALE STAMPA (Nascosti su stampa reale)
        ========================================================================= */}
        <div className="no-print border-b border-slate-200 bg-slate-50/90 p-4 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs font-bold">
                <Printer className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Stampa Documenti, Materiale Fuori Scatola, Albero & Firme
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                  Commessa: <strong className="text-slate-800">{load.code}</strong> —{' '}
                  {load.title || 'Nuova Commessa'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Selettore Lingua Documento */}
              <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPrintLanguage('it')}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all ${
                    printLanguage === 'it'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Stampa documento in lingua italiana originale"
                >
                  🇮🇹 Italiano
                </button>
                <button
                  type="button"
                  disabled={isAiTranslating}
                  onClick={() => executeAiTranslation('en')}
                  className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer transition-all flex items-center gap-1 ${
                    printLanguage === 'en'
                      ? 'bg-blue-700 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Traduce automaticamente tutto il file che stai stampando con AI in lingua inglese per esportazione/dogana"
                >
                  {isAiTranslating ? (
                    <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                  ) : (
                    <Sparkles className="w-3 h-3 text-amber-300" />
                  )}
                  🇬🇧 English (AI Export)
                </button>
              </div>

              {onOpenPdfTranslator && (
                <button
                  type="button"
                  onClick={onOpenPdfTranslator}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                  title="Traduci il documento o una distinta PDF in qualsiasi lingua"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  Traduttore PDF
                </button>
              )}
              <button
                type="button"
                onClick={() => exportLoadToCSV(load)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                {t('Esporta Excel CSV', 'Export CSV')}
              </button>

              {/* PULSANTE PRIMARIO: TRADUZIONE AUTOMATICA AI E STAMPA */}
              <button
                type="button"
                disabled={isAiTranslating}
                onClick={handleAiTranslateAndPrint}
                className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-black text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800 disabled:opacity-60 rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap border border-indigo-400/50"
                title="Traduce automaticamente tutti i file che stai stampando con AI Gemini in inglese e avvia la stampa"
              >
                {isAiTranslating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>{isAiTranslating ? 'Traduzione AI in corso...' : '✨ Traduci con AI & Stampa'}</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  openTrackingLabelsA4PdfInNewTab(load, movements, {
                    includePallets: true,
                    includeBoxes: true,
                    includeItems: true,
                    palletFilterId: selectedPalletId,
                  })
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                title="Genera 1 file PDF A4 con tutte le etichette QR e codice a barre per bancali, scatole e pezzi"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Foglio A4 Etichette QR</span>
              </button>

              <button
                type="button"
                onClick={handleOpenPdfForPrint}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-sm"
                title="Apre il PDF in una nuova scheda del browser fuori dall'anteprima per vedere tutte le stampanti Windows/USB/Wi-Fi"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Apri PDF (Vedi Stampanti)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
                title="Scarica il file PDF sul computer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Scarica PDF</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                {isEn ? 'Print (English)' : 'Stampa Diretta'}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi finestra di stampa"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Avviso Stampanti Fisiche */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2 text-[11px] text-amber-950">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Non vedi la tua stampante fisica?</strong> Nell&apos;anteprima integrata le stampanti locali possono essere nascoste. Clicca{' '}
              <strong>Apri PDF (Vedi Stampanti)</strong> per aprire il foglio in una nuova scheda del browser (oppure in Chrome scegli{' '}
              <strong>Destinazione &rarr; Vedi altro...</strong>).
            </span>
          </div>

          {/* Quick Signatures Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <PenTool className="w-4 h-4 text-blue-600" />
              <span>Firme Elettroniche Team:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Operatore Button */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-slate-500">Operatore:</span>
                {operatoreSig ? (
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {operatoreSig.signerName}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveSignRole('operatore')}
                    className="text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    + Apponi Firma
                  </button>
                )}
                {operatoreSig && (
                  <button
                    type="button"
                    onClick={() => onDeleteSignature('operatore')}
                    title="Rimuovi firma"
                    className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Responsabile Button */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-slate-500">Responsabile:</span>
                {responsabileSig ? (
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {responsabileSig.signerName}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveSignRole('responsabile')}
                    className="text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    + Apponi Firma
                  </button>
                )}
                {responsabileSig && (
                  <button
                    type="button"
                    onClick={() => onDeleteSignature('responsabile')}
                    title="Rimuovi firma"
                    className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Autista Button */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                <span className="text-[11px] text-slate-500">Autista/Vettore:</span>
                {autistaSig ? (
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {autistaSig.signerName}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveSignRole('autista')}
                    className="text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    + Apponi Firma
                  </button>
                )}
                {autistaSig && (
                  <button
                    type="button"
                    onClick={() => onDeleteSignature('autista')}
                    title="Rimuovi firma"
                    className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Banner di Stato Traduzione Automatica con AI */}
          {isEn && (
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 text-white p-3 rounded-xl border border-indigo-700/60 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/80 flex items-center justify-center text-amber-300 shrink-0">
                  {isAiTranslating ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className="font-extrabold text-amber-300 flex items-center gap-2">
                    <span>
                      {isAiTranslating
                        ? 'Traduzione Intelligente con AI Gemini in corso...'
                        : 'Traduzione Automatica AI Attiva su Tutto il File'}
                    </span>
                    {!isAiTranslating && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase">
                        {aiEngineUsed === 'gemini' ? 'Google Gemini 3.8 AI' : 'Motore Logistico Locale'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {isAiTranslating
                      ? 'Sto elaborando con l\'Intelligenza Artificiale tutti gli articoli, scatole, bancali e note per il documento di stampa...'
                      : 'Tutti gli articoli, colli, bancali, descrizioni e note di questo documento sono stati tradotti in lingua Inglese per la stampa.'}
                  </p>
                </div>
              </div>

              {!isAiTranslating && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAiTranslatedLoad(null);
                      executeAiTranslation('en');
                    }}
                    className="px-2.5 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-amber-300" />
                    Riesegui Traduzione AI
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintLanguage('it')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] cursor-pointer"
                  >
                    Vedi Originale Italiano
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Segmented Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setPrintCategory('master_commessa_big');
                  setSelectedBoxId('all');
                  setSelectedPalletId('all');
                }}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  printCategory === 'master_commessa_big'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Stampa foglio master ad altissima visibilità con codice commessa enorme, statistiche e riepilogo stivaggio"
              >
                <Building2 className="w-3.5 h-3.5 text-amber-300" />
                {t('🏢 Solo Commessa in Grande', '🏢 Master Commessa Sheet')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintCategory('pallets_only');
                  setSelectedBoxId('all');
                }}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  printCategory === 'pallets_only'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {t('Solo Bancali', 'Pallets Only')}
              </button>
              <button
                type="button"
                onClick={() => setPrintCategory('boxes_only')}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  printCategory === 'boxes_only'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                {t('Solo Scatole', 'Boxes Only')}
              </button>
              <button
                type="button"
                onClick={() => setPrintCategory('tree_schema')}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  printCategory === 'tree_schema'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                {t('Schema Albero & Foto', 'Tree Schema & Photos')}
              </button>
              <button
                type="button"
                onClick={() => setPrintCategory('packing_list')}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  printCategory === 'packing_list'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                {t('Packing List Distinta', 'Packing List Table')}
              </button>
              <button
                type="button"
                onClick={() => setPrintCategory('all')}
                className={`px-3 py-1 font-bold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  printCategory === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t('Tutto Insieme', 'All Together')}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {(printCategory === 'pallets_only' ||
                printCategory === 'tree_schema' ||
                printCategory === 'all') && (
                <select
                  value={selectedPalletId}
                  onChange={(e) => setSelectedPalletId(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                >
                  <option value="all">Tutti i Bancali ({summary.totalPallets})</option>
                  {summary.palletSummaries.map((ps) => (
                    <option key={ps.pallet.id} value={ps.pallet.id}>
                      {ps.pallet.code} — {ps.pallet.label || 'Bancale'}
                    </option>
                  ))}
                </select>
              )}

              {(printCategory === 'boxes_only' || printCategory === 'all') && (
                <select
                  value={selectedBoxId}
                  onChange={(e) => setSelectedBoxId(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800"
                >
                  <option value="all">Tutte le Scatole ({summary.totalBoxes})</option>
                  {allBoxesWithPallet.map((b) => (
                    <option key={b.box.id} value={b.box.id}>
                      {b.box.code} — {b.box.label} ({b.pallet.code})
                    </option>
                  ))}
                </select>
              )}

              <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                <input
                  type="checkbox"
                  checked={pageByPage}
                  onChange={(e) => setPageByPage(e.target.checked)}
                  className="rounded border-slate-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs">
                  {pageByPage
                    ? 'Stampa multipagina: 1 collo per foglio A4 (Attiva)'
                    : 'Stampa continua: compatta colli insieme'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CANVAS DEL DOCUMENTO STAMPABILE (Sfondo Bianco Reale A4)
        ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-slate-100 text-slate-950 print-canvas-wrapper">
          <div className="max-w-[880px] mx-auto bg-white p-8 sm:p-12 shadow-md rounded-xl space-y-8 print-canvas-wrapper">
            {isAiTranslating && (
              <div className="no-print p-4 bg-indigo-50 border-2 border-indigo-300 rounded-xl flex items-center justify-center gap-3 text-indigo-950 font-bold text-xs animate-pulse shadow-xs">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                <span>Traduzione intelligente con Intelligenza Artificiale Gemini in corso... Sto convertendo articoli, colli e distinte in lingua inglese...</span>
              </div>
            )}

            {summary.totalPallets === 0 && summary.totalBoxes === 0 && (
              <div className="text-center py-20 text-slate-400 text-sm">
                Nessun bancale o scatola presente nella commessa da stampare.
              </div>
            )}

            {/* 0. SEZIONE SPECIALE: STAMPA SOLO COMMESSA IN GRANDE (FOGLIO MASTER A4 SINGOLO) */}
            {printCategory === 'master_commessa_big' && (
              <div className="border-4 border-slate-900 rounded-2xl p-6 sm:p-10 text-slate-950 bg-white space-y-6 page-break-after shadow-sm">
                {/* Intestazione Aziendale & Master Bar */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center font-black text-xl shadow-xs">
                      CS
                    </div>
                    <div>
                      <h1 className="text-base font-black uppercase tracking-wider text-slate-950">
                        CARICOSTUDIO &bull; {t('FOGLIO MASTER COMMESSA DI SPEDIZIONE', 'MASTER SHIPMENT & LOADING MANIFEST')}
                      </h1>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {t('Documento Ufficiale di Baia di Carico & Spedizione Merci', 'Official Loading Bay & Customs Transport Manifest')} &bull; Rev. {new Date().getFullYear()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isEn && (
                      <span className="inline-block bg-blue-900 text-white px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider mr-2">
                        🇬🇧 INTERNATIONAL EXPORT VERSION
                      </span>
                    )}
                    <div className="text-xs font-mono font-bold text-slate-800">
                      {new Date().toLocaleDateString(isEn ? 'en-GB' : 'it-IT')} &bull; {new Date().toLocaleTimeString(isEn ? 'en-GB' : 'it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {/* BLOCCO COMMESSA IN GRANDE (ENORME VISIBILITÀ OPERATORI E AUTISTA) */}
                <div className="bg-slate-50 border-4 border-slate-950 rounded-2xl p-6 text-center space-y-2.5">
                  <div className="text-xs font-mono font-black uppercase tracking-widest text-slate-600">
                    {t('CODICE IDENTIFICATIVO COMMESSA / SPEDIZIONE', 'MASTER SHIPMENT / JOB IDENTIFICATION CODE')}
                  </div>
                  <div className="text-5xl sm:text-6xl font-black font-mono tracking-widest text-slate-950 select-all">
                    {load.code}
                  </div>
                  <div className="text-xl sm:text-2xl font-extrabold text-blue-900">
                    {load.title ? tr(load.title) : t('Nuova Spedizione Merci', 'General Freight Shipment')}
                  </div>

                  {/* Codice a barre ottico identificativo */}
                  <div className="pt-3 border-t border-slate-300 flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="font-mono text-xs sm:text-sm tracking-[8px] sm:tracking-[12px] text-slate-700 select-none font-bold">
                        ||||| ||||||| |||| ||||||||||||||||| |||| |||||||| ||||||||||||
                      </div>
                      <div className="text-xs font-mono font-bold text-slate-600 mt-1">
                        *{load.code}*
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {t('Identificativo Baia e Lettore Laser', 'Bay & Laser Barcode')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Griglia Dati Principali Spedizione */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="border-2 border-slate-900 rounded-xl p-4 bg-white space-y-2">
                    <div className="text-[11px] font-mono font-bold uppercase text-slate-500">
                      {t('CLIENTE & DESTINAZIONE MERCI', 'CONSIGNEE & DESTINATION')}
                    </div>
                    <div className="text-base font-black text-slate-950">
                      {load.client || t('Destinatario Generale Spedizione', 'General Consignee Destination')}
                    </div>
                    <div className="text-xs text-slate-600">
                      {load.destination ? tr(load.destination) : t('Spedizione standard da magazzino centrale', 'Standard outbound delivery from main depot')}
                    </div>
                  </div>

                  <div className="border-2 border-slate-900 rounded-xl p-4 bg-white space-y-2">
                    <div className="text-[11px] font-mono font-bold uppercase text-slate-500">
                      {t('VETTORE / TRASPORTATORE & DATA', 'CARRIER / FORWARDER & DEPARTURE')}
                    </div>
                    <div className="text-base font-black text-slate-950">
                      {load.carrier || t('Vettore Incaricato per Trasporto', 'Assigned Logistics Freight Carrier')}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-700">
                      <span>{t('Data Partenza', 'Departure')}: <strong>{load.departureDate || new Date().toISOString().split('T')[0]}</strong></span>
                      <span>&bull;</span>
                      <span>{t('Stato Carico', 'Loading Status')}: <strong className="text-emerald-700">{t('PRONTO AL CARICO', 'READY FOR LOADING')}</strong></span>
                    </div>
                  </div>
                </div>

                {/* 4 CARDS STATISTICHE GIGANTI */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="border-3 border-blue-900 rounded-xl p-3.5 bg-blue-50/70">
                    <div className="text-[11px] font-mono font-bold uppercase text-blue-950">
                      {t('BANCALI TOTALI', 'TOTAL PALLETS')}
                    </div>
                    <div className="text-4xl sm:text-5xl font-black font-mono text-blue-900 my-1">
                      {summary.totalPallets}
                    </div>
                    <div className="text-xs font-bold text-blue-800">
                      {summary.palletSummaries.length > 0 ? `${summary.palletSummaries.length} ${t('Bancali preparati', 'Pallets staged')}` : '-'}
                    </div>
                  </div>

                  <div className="border-3 border-amber-900 rounded-xl p-3.5 bg-amber-50/70">
                    <div className="text-[11px] font-mono font-bold uppercase text-amber-950">
                      {t('SCATOLE TOTALI', 'TOTAL CARTON BOXES')}
                    </div>
                    <div className="text-4xl sm:text-5xl font-black font-mono text-amber-900 my-1">
                      {summary.totalBoxes}
                    </div>
                    <div className="text-xs font-bold text-amber-800">
                      {t('Scatole imballate', 'Packed boxes')}
                    </div>
                  </div>

                  <div className="border-3 border-emerald-900 rounded-xl p-3.5 bg-emerald-50/70">
                    <div className="text-[11px] font-mono font-bold uppercase text-emerald-950">
                      {t('FUORI SCATOLA', 'LOOSE / OVERSIZED')}
                    </div>
                    <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-900 my-1">
                      {summary.palletSummaries.reduce((acc, p) => acc + p.looseItems.length, 0)}
                    </div>
                    <div className="text-xs font-bold text-emerald-800">
                      {t('Articoli sfusi su bancale', 'Loose items on pallets')}
                    </div>
                  </div>

                  <div className="border-3 border-rose-900 rounded-xl p-3.5 bg-rose-50/70">
                    <div className="text-[11px] font-mono font-bold uppercase text-rose-950">
                      {t('PESO LORDO TOTALE', 'TOTAL GROSS WEIGHT')}
                    </div>
                    <div className="text-3xl sm:text-4xl font-black font-mono text-rose-900 my-1">
                      {summary.totalGrossWeightKg.toFixed(1)} <span className="text-base">KG</span>
                    </div>
                    <div className="text-xs font-bold text-rose-800">
                      {t('Tara Totale', 'Total Tare')}: {summary.totalTareWeightKg.toFixed(1)} kg
                    </div>
                  </div>
                </div>

                {/* TABELLA DI RIEPILOGO STIVAGGIO BANCALI */}
                <div className="border-2 border-slate-900 rounded-xl overflow-hidden">
                  <div className="bg-slate-900 text-white px-4 py-2.5 text-xs font-mono font-bold uppercase flex items-center justify-between">
                    <span>{t('DISTINTA BANCALI DA CARICARE SUL MEZZO', 'PALLETS LOADING & STAGING MANIFEST')}</span>
                    <span>{summary.totalPallets} {t('BANCALI TOTALI', 'TOTAL PALLETS')}</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[11px] text-slate-800">
                        <th className="p-2.5 font-bold border-r border-slate-200"># {t('Bancale', 'Pallet')}</th>
                        <th className="p-2.5 font-bold border-r border-slate-200">{t('Tipo & Dimensioni', 'Type & Dims')}</th>
                        <th className="p-2.5 font-bold text-center border-r border-slate-200">{t('Scatole', 'Boxes')}</th>
                        <th className="p-2.5 font-bold text-center border-r border-slate-200">{t('Fuori Scatola', 'Loose Items')}</th>
                        <th className="p-2.5 font-bold text-right border-r border-slate-200">{t('Peso Lordo', 'Gross Wgt')}</th>
                        <th className="p-2.5 font-bold">{t('Note & Stivaggio', 'Notes & Staging')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-sans">
                      {summary.palletSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                            {t('Nessun bancale configurato nella commessa.', 'No pallets configured in this shipment.')}
                          </td>
                        </tr>
                      ) : (
                        summary.palletSummaries.map((ps, idx) => (
                          <tr key={ps.pallet.id} className="hover:bg-slate-50">
                            <td className="p-2.5 font-mono font-black text-slate-950 border-r border-slate-200 text-base">
                              {ps.pallet.code}
                            </td>
                            <td className="p-2.5 font-medium text-slate-800 border-r border-slate-200">
                              <div className="font-bold text-slate-900">{ps.pallet.label || (isEn ? `Pallet ${idx + 1}` : `Bancale ${idx + 1}`)}</div>
                              <div className="text-[10px] font-mono text-slate-500">{ps.pallet.dimensionsCm || '80×120×140 cm'}</div>
                            </td>
                            <td className="p-2.5 font-mono font-bold text-center text-amber-700 border-r border-slate-200 text-sm">
                              {ps.totalBoxes}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-center text-emerald-700 border-r border-slate-200 text-sm">
                              {ps.looseItems.length}
                            </td>
                            <td className="p-2.5 font-mono font-black text-right text-slate-950 border-r border-slate-200 text-sm">
                              {ps.grossWeightKg.toFixed(1)} kg
                            </td>
                            <td className="p-2.5 text-xs text-slate-600">
                              {ps.pallet.notes ? tr(ps.pallet.notes) : t('Pronto per il carico a bordo', 'Ready for vehicle loading')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* SEZIONE FIRME IN GRANDE */}
                <div className="border-2 border-slate-900 rounded-xl p-4 bg-slate-50 space-y-3">
                  <div className="text-xs font-mono font-black uppercase text-slate-900 tracking-wider">
                    {t('APPROVAZIONE E PRESA IN CARICO MERCI (FIRME DIGITALI)', 'MASTER COMMESSA SIGNATURES & CARRIER RECEIPT')}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Operatore */}
                    <div className="border border-slate-300 rounded-lg p-3 bg-white text-xs space-y-1">
                      <div className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                        1. {t('Operatore Preparatore', 'Preparation Operator')}
                      </div>
                      {operatoreSig ? (
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900">{operatoreSig.signerName}</div>
                          <img src={operatoreSig.signatureDataUrl} alt="Firma Operatore" className="h-12 border border-slate-200 rounded object-contain bg-slate-50" />
                          <div className="text-[9px] font-mono text-slate-400">{new Date(operatoreSig.signedAt).toLocaleDateString()} {new Date(operatoreSig.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : (
                        <div className="h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 text-[10px]">
                          {t('Firma e Data Operatore', 'Operator Signature & Date')}
                        </div>
                      )}
                    </div>

                    {/* Responsabile */}
                    <div className="border border-slate-300 rounded-lg p-3 bg-white text-xs space-y-1">
                      <div className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                        2. {t('Responsabile Logistica', 'Logistics Supervisor')}
                      </div>
                      {responsabileSig ? (
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900">{responsabileSig.signerName}</div>
                          <img src={responsabileSig.signatureDataUrl} alt="Firma Responsabile" className="h-12 border border-slate-200 rounded object-contain bg-slate-50" />
                          <div className="text-[9px] font-mono text-slate-400">{new Date(responsabileSig.signedAt).toLocaleDateString()} {new Date(responsabileSig.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : (
                        <div className="h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 text-[10px]">
                          {t('Firma e Data Responsabile', 'Supervisor Signature & Date')}
                        </div>
                      )}
                    </div>

                    {/* Autista/Vettore */}
                    <div className="border border-slate-300 rounded-lg p-3 bg-white text-xs space-y-1">
                      <div className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                        3. {t('Autista / Vettore per Ricevuta', 'Driver / Carrier Receipt')}
                      </div>
                      {autistaSig ? (
                        <div className="space-y-1">
                          <div className="font-bold text-slate-900">{autistaSig.signerName}</div>
                          <img src={autistaSig.signatureDataUrl} alt="Firma Autista" className="h-12 border border-slate-200 rounded object-contain bg-slate-50" />
                          <div className="text-[9px] font-mono text-slate-400">{new Date(autistaSig.signedAt).toLocaleDateString()} {new Date(autistaSig.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ) : (
                        <div className="h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400 text-[10px]">
                          {t('Firma e Data Autista/Vettore', 'Driver Signature & Date')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 1. SEZIONE SOLO BANCALI */}
            {(printCategory === 'pallets_only' || printCategory === 'all') && (
              <div className="space-y-8">
                {displayedPalletSummaries.map((ps, index) => (
                  <div
                    key={ps.pallet.id}
                    className={`border-2 border-slate-900 rounded-xl p-6 sm:p-8 text-slate-950 bg-white ${
                      pageByPage ? 'page-break-after' : 'page-break-inside-avoid'
                    }`}
                  >
                    {/* Header Etichetta Bancale */}
                    <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                      <div>
                        <div className="text-[11px] font-mono font-bold tracking-wider text-slate-600 uppercase">
                          {t('DOCUMENTO COLLO BANCALE · COMMESSA', 'PALLET CARGO MANIFEST · JOB REF')} {load.code} — {load.title ? tr(load.title) : ''}
                        </div>
                        <div className="text-5xl font-black font-mono tracking-tight text-slate-950 mt-1">
                          {ps.pallet.code}
                        </div>
                        <div className="text-lg font-bold text-slate-800 mt-0.5">
                          {ps.pallet.label ? tr(ps.pallet.label) : t('Bancale di Spedizione', 'Shipping Pallet')}
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {t('COLLO / BANCALE', 'COLLO / PALLET')}
                        </div>
                        <div className="text-4xl font-black text-slate-950 tabular-nums">
                          {index + 1} / {summary.totalPallets}
                        </div>
                        <div className="text-xs font-bold text-slate-700 mt-1">
                          {t('Piazzola Mezzo', 'Bay Slot')}: #{ps.pallet.truckSlot ?? index + 1}
                        </div>
                        <div className="font-mono text-sm tracking-widest text-slate-800 mt-2">
                          ||| ||||| || |||| ||||
                        </div>
                      </div>
                    </div>

                    {/* Specifiche Tecniche Bancale */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-slate-300 py-3.5 my-3">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                          {t('Destinatario', 'Consignee')}
                        </span>
                        <span className="font-bold text-slate-900 text-sm block">
                          {load.client || '—'}
                        </span>
                        <span className="text-slate-600 block text-xs truncate mt-0.5">
                          {load.destination || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                          {t('Dimensioni & Altezza', 'Dimensions & Height')}
                        </span>
                        <span className="font-bold text-slate-900 font-mono text-sm block">
                          {ps.pallet.dimensionsCm}
                        </span>
                        <span className="text-slate-600 block text-xs font-mono mt-0.5">
                          H {ps.pallet.heightCm} cm · {t('Tara', 'Tare')} {ps.pallet.tareKg} kg
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                          {t('Contenuto Bancale', 'Pallet Cargo')}
                        </span>
                        <span className="font-bold text-slate-900 text-sm font-mono block">
                          {ps.totalBoxes} {t('scatole', 'boxes')} · {ps.looseItems.length} {t('fuori scatola', 'loose items')}
                        </span>
                        <span className="text-slate-600 block text-xs mt-0.5">
                          {ps.pallet.wrapped ? t('Film estensibile applicato', 'Stretch wrapped') : t('Da filmare', 'Unwrapped')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                          {t('Peso Lordo Bancale', 'Gross Pallet Weight')}
                        </span>
                        <span className="font-black text-slate-950 text-3xl sm:text-4xl font-mono tabular-nums block">
                          {ps.grossWeightKg.toFixed(1)} kg
                        </span>
                      </div>
                    </div>

                    {/* BANNER PESO IN GRANDE PER ETICHETTATURA COLLO */}
                    <div className="my-4 p-4 sm:p-5 border-4 border-slate-950 rounded-xl bg-slate-50 flex items-center justify-between text-slate-950">
                      <div>
                        <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-700 block">
                          {t('PESO LORDO EFFETTIVO COLLO BANCALE', 'GROSS PALLET WEIGHT')}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {t('Tara Legno', 'Tare')}: {ps.pallet.tareKg} kg · {t('Merce Netta', 'Net Cargo')}: {ps.netWeightKg.toFixed(1)} kg
                        </span>
                      </div>
                      <div className="text-right font-black font-mono text-5xl sm:text-7xl text-slate-950 tracking-tight leading-none">
                        {ps.grossWeightKg.toFixed(1)} <span className="text-2xl sm:text-4xl font-extrabold">KG</span>
                      </div>
                    </div>

                    {/* Elenco Scatole Madre + Sotto-Scatole e Articoli */}
                    <div className="pt-2 space-y-4">
                      <div>
                        <div className="text-xs font-bold tracking-wider uppercase text-slate-800 mb-2.5">
                          1. {t('SCATOLONI E SOTTO-SCATOLE SU', 'CARTON BOXES & PACKAGES ON')} {ps.pallet.code}:
                        </div>

                        {ps.topLevelBoxes.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {ps.topLevelBoxes.map((bs) => (
                              <div
                                key={bs.box.id}
                                className="border border-slate-300 rounded-lg p-3 text-xs bg-slate-50/70 space-y-2"
                              >
                                <div className="flex justify-between font-mono font-bold text-slate-900 border-b border-slate-200 pb-1.5">
                                  <span>
                                    {bs.box.code} — {bs.box.label}
                                  </span>
                                  <span>{bs.grossWeightKg.toFixed(1)} kg</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {bs.box.dimensionsCm} · Piano {bs.box.stackLevel}
                                  {bs.box.fragile ? ' · FRAGILE' : ''}
                                  {bs.box.kitName ? ` · KIT: ${bs.box.kitName}` : ''}
                                </div>

                                {/* Articoli diretti nello scatolone */}
                                {bs.items.length > 0 && (
                                  <ul className="space-y-1 text-slate-800 font-mono text-xs">
                                    {bs.items.map((i) => (
                                      <li
                                        key={i.id}
                                        className="flex items-center justify-between gap-2"
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {i.photoDataUrl && (
                                            <img
                                              src={i.photoDataUrl}
                                              alt={i.name}
                                              className="w-6 h-6 rounded object-cover border border-slate-300 shrink-0"
                                            />
                                          )}
                                          <span className="truncate">
                                            {i.sku} · {i.name}
                                          </span>
                                        </div>
                                        <span className="font-bold shrink-0">{i.quantity} pz</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                {/* Sotto-Scatole annidate dentro questo scatolone */}
                                {bs.childBoxes.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-dashed border-slate-300 space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-purple-800">
                                      Sotto-Scatole contenute ({bs.childBoxes.length}):
                                    </div>
                                    {bs.childBoxes.map((sub) => (
                                      <div
                                        key={sub.box.id}
                                        className="pl-2.5 border-l-2 border-purple-500 bg-white p-2 rounded text-[11px]"
                                      >
                                        <div className="flex justify-between font-mono font-bold text-slate-900">
                                          <span>
                                            ↳ {sub.box.code} — {sub.box.label} ({sub.box.dimensionsCm})
                                          </span>
                                          <span>{sub.grossWeightKg.toFixed(1)} kg</span>
                                        </div>
                                        {sub.items.length > 0 && (
                                          <ul className="mt-1 space-y-0.5 text-slate-700 font-mono text-[10px]">
                                            {sub.items.map((si) => (
                                              <li
                                                key={si.id}
                                                className="flex items-center justify-between gap-1.5"
                                              >
                                                <div className="flex items-center gap-1 min-w-0">
                                                  {si.photoDataUrl && (
                                                    <img
                                                      src={si.photoDataUrl}
                                                      alt={si.name}
                                                      className="w-5 h-5 rounded object-cover border border-slate-200 shrink-0"
                                                    />
                                                  )}
                                                  <span className="truncate">
                                                    {si.sku} · {si.name}
                                                  </span>
                                                </div>
                                                <span className="font-bold shrink-0">
                                                  {si.quantity} pz
                                                </span>
                                              </li>
                                            ))}
                                          </ul>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {bs.items.length === 0 && bs.childBoxes.length === 0 && (
                                  <span className="text-slate-400 italic text-xs block">
                                    Scatola vuota
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic py-2">
                            Nessuna scatola chiusa posizionata su questo bancale.
                          </div>
                        )}
                      </div>

                      {/* MATERIALE FUORI SCATOLA SUL BANCALE */}
                      {ps.looseItems.length > 0 && (
                        <div className="border-2 border-teal-800 rounded-xl p-4 bg-teal-50/40">
                          <div className="flex items-center justify-between border-b border-teal-300 pb-2 mb-2.5">
                            <span className="text-xs font-black uppercase tracking-wider text-teal-950">
                              2. MATERIALE FUORI SCATOLA (COLLI SCIOLTI FISSI SU {ps.pallet.code}):
                            </span>
                            <span className="text-xs font-mono font-bold text-teal-900">
                              {ps.looseItems.length} colli ·{' '}
                              {ps.looseItems
                                .reduce((acc, i) => acc + i.quantity * i.unitWeightKg, 0)
                                .toFixed(1)}{' '}
                              kg
                            </span>
                          </div>
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-teal-300 text-teal-900 font-bold">
                                <th className="py-1.5 pr-2 w-8">Spunta</th>
                                <th className="py-1.5 px-2 w-12">Foto</th>
                                <th className="py-1.5 px-2 font-mono w-24">SKU</th>
                                <th className="py-1.5 px-2">Descrizione Materiale Sciolto</th>
                                <th className="py-1.5 px-2 font-mono w-28">Misure (cm)</th>
                                <th className="py-1.5 px-2 text-right font-mono w-16">Q.tà</th>
                                <th className="py-1.5 pl-2 text-right font-mono w-20">Peso Tot.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-teal-200/70">
                              {ps.looseItems.map((li) => (
                                <tr key={li.id}>
                                  <td className="py-1.5 pr-2">
                                    {li.checked ? (
                                      <CheckSquare className="w-4 h-4 text-slate-950" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400" />
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2">
                                    {li.photoDataUrl ? (
                                      <img
                                        src={li.photoDataUrl}
                                        alt={li.name}
                                        className="w-8 h-8 rounded object-cover border border-slate-300"
                                      />
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-mono">—</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2 font-mono font-bold text-slate-900">
                                    {li.sku}
                                  </td>
                                  <td className="py-1.5 px-2 font-bold text-slate-900">
                                    {li.name}
                                    {li.fragile ? ' [FRAGILE]' : ''}
                                  </td>
                                  <td className="py-1.5 px-2 font-mono text-slate-700">
                                    {li.dimensionsCm || '45×35×30 cm'}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-mono font-bold">
                                    {li.quantity} pz
                                  </td>
                                  <td className="py-1.5 pl-2 text-right font-mono font-bold text-slate-900">
                                    {(li.quantity * li.unitWeightKg).toFixed(1)} kg
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Timbro e Firma Elettronica in calce */}
                    {operatoreSig && (
                      <div className="mt-6 pt-4 border-t-2 border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                            Preparazione e Convalida Bancale:
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {operatoreSig.signerName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                            {operatoreSig.companyOrBadge} · Data:{' '}
                            {new Date(operatoreSig.signedAt).toLocaleDateString('it-IT')}{' '}
                            {new Date(operatoreSig.signedAt).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <img
                          src={operatoreSig.signatureDataUrl}
                          alt="Firma Operatore"
                          className="h-12 border-b-2 border-slate-400 object-contain"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 2. SEZIONE SOLO SCATOLE */}
            {(printCategory === 'boxes_only' || printCategory === 'all') && (
              <div
                className={`space-y-8 ${
                  printCategory === 'all' ? 'mt-8 pt-8 border-t-2 border-slate-900' : ''
                }`}
              >
                {displayedBoxes.map((bs, index) => {
                  const parentBox = bs.box.parentBoxId
                    ? load.boxes.find((b) => b.id === bs.box.parentBoxId)
                    : null;

                  return (
                    <div
                      key={bs.box.id}
                      className={`border-2 border-slate-900 rounded-xl p-6 sm:p-8 text-slate-950 bg-white ${
                        pageByPage ? 'page-break-after' : 'page-break-inside-avoid'
                      }`}
                    >
                      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                        <div>
                          <div className="text-[11px] font-mono font-bold tracking-wider text-slate-600 uppercase">
                            {t('ETICHETTA COLLO / SCATOLA · COMMESSA', 'BOX CARGO MANIFEST · JOB REF')} {load.code}
                          </div>
                          <div className="text-5xl font-black font-mono tracking-tight text-slate-950 mt-1">
                            {bs.box.code}
                          </div>
                          <div className="text-lg font-bold text-slate-800 mt-0.5">
                            {bs.box.label ? tr(bs.box.label) : t('Scatola Spedizione', 'Shipping Carton')}
                          </div>
                          {parentBox && (
                            <div className="mt-1 inline-block px-2.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-mono text-xs font-bold">
                              {t('SOTTO-SCATOLA INSERITA DENTRO', 'SUB-BOX PACKED INSIDE')}: {parentBox.code} ({tr(parentBox.label)})
                            </div>
                          )}
                        </div>

                        <div className="text-right font-mono">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            {t('COLLO SCATOLA', 'CARTON / BOX')}
                          </div>
                          <div className="text-4xl font-black text-slate-950 tabular-nums">
                            {index + 1} / {allBoxesWithPallet.length}
                          </div>
                          <div className="text-xs font-bold text-blue-700 mt-1">
                            {t('Stivata su', 'Staged on')}: {bs.pallet.code}
                          </div>
                          <div className="font-mono text-sm tracking-widest text-slate-800 mt-2">
                            |||| ||| ||||| || |||
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-slate-300 py-3.5 my-3 font-mono">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                            Dimensioni Scatola
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {bs.box.dimensionsCm}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                            Posizione
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {parentBox
                              ? `Dentro ${parentBox.code} (${bs.pallet.code})`
                              : `${bs.pallet.code} · P.${bs.box.stackLevel}`}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                            Pezzi Totali
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {bs.totalPieces} pz
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                            Peso Lordo Scatola
                          </span>
                          <span className="font-black text-slate-950 text-2xl tabular-nums">
                            {bs.grossWeightKg.toFixed(1)} kg
                          </span>
                        </div>
                      </div>

                      {/* Eventuali sotto-scatole contenute */}
                      {bs.childBoxes.length > 0 && (
                        <div className="mb-4 p-3 rounded-lg border border-purple-300 bg-purple-50/50 text-xs">
                          <div className="font-bold text-purple-950 uppercase tracking-wider mb-1.5">
                            SOTTO-SCATOLE CONTENUTE IN QUESTO SCATOLONE ({bs.childBoxes.length}):
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {bs.childBoxes.map((sub) => (
                              <div
                                key={sub.box.id}
                                className="p-2 rounded bg-white border border-purple-200 font-mono flex justify-between"
                              >
                                <span>
                                  <strong>{sub.box.code}</strong> — {sub.box.label} (
                                  {sub.box.dimensionsCm})
                                </span>
                                <span className="font-bold">
                                  {sub.totalPieces} pz · {sub.grossWeightKg.toFixed(1)} kg
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <div className="text-xs font-bold tracking-wider uppercase text-slate-800 mb-2.5">
                          DISTINTA ARTICOLI IN QUESTA SCATOLA:
                        </div>
                        {bs.items.length > 0 ? (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b-2 border-slate-300 text-slate-600 font-bold">
                                <th className="py-2 pr-2 w-8">Spunta</th>
                                <th className="py-2 px-2 w-12">Foto</th>
                                <th className="py-2 px-2 font-mono w-28">SKU</th>
                                <th className="py-2 px-2">Descrizione Articolo</th>
                                <th className="py-2 px-2 text-right w-20 font-mono">Quantità</th>
                                <th className="py-2 pl-2 text-right w-24 font-mono">Peso Totale</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {bs.items.map((item) => (
                                <tr key={item.id}>
                                  <td className="py-2 pr-2">
                                    {item.checked ? (
                                      <CheckSquare className="w-4 h-4 text-slate-950" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400" />
                                    )}
                                  </td>
                                  <td className="py-2 px-2">
                                    {item.photoDataUrl ? (
                                      <img
                                        src={item.photoDataUrl}
                                        alt={item.name}
                                        className="w-9 h-9 rounded object-cover border border-slate-300"
                                      />
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-mono">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 font-mono font-bold text-slate-900">
                                    {item.sku}
                                  </td>
                                  <td className="py-2 px-2 text-slate-800">
                                    <span className="font-bold">{item.name}</span>
                                    {item.dimensionsCm ? ` (${item.dimensionsCm})` : ''}
                                    {item.fragile ? ' [FRAGILE]' : ''}
                                  </td>
                                  <td className="py-2 px-2 text-right font-mono font-bold tabular-nums">
                                    {item.quantity} pz
                                  </td>
                                  <td className="py-2 pl-2 text-right font-mono tabular-nums text-slate-700">
                                    {(item.quantity * item.unitWeightKg).toFixed(1)} kg
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="text-xs text-slate-400 italic py-3">
                            Nessun articolo sciolto diretto (vedi eventuali sotto-scatole).
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. SEZIONE SCHEMA AD ALBERO VISIVO CON FOTO */}
            {(printCategory === 'tree_schema' || printCategory === 'all') && (
              <div
                className={`space-y-6 ${
                  printCategory === 'all' ? 'mt-8 pt-8 border-t-2 border-slate-900' : ''
                }`}
              >
                <div className="border-b-2 border-slate-900 pb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      SCHEMA GERARCHICO AD ALBERO CON FOTO OGGETTI · COMMESSA {load.code}
                    </div>
                    <h2 className="text-2xl font-black text-slate-950 mt-0.5">
                      {load.title} — Mappa Bancali, Scatoloni, Sotto-Scatole e Fuori Scatola
                    </h2>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-700">
                    <div>Data: {load.departureDate}</div>
                    <div className="font-bold text-slate-950">
                      Totale: {summary.totalGrossWeightKg.toFixed(1)} kg
                    </div>
                  </div>
                </div>

                {displayedPalletSummaries.map((ps) => (
                  <div
                    key={ps.pallet.id}
                    className={`border-2 border-slate-800 rounded-xl p-5 bg-white space-y-4 ${
                      pageByPage ? 'page-break-after' : 'page-break-inside-avoid'
                    }`}
                  >
                    <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-lg">
                      <div className="flex items-center gap-2.5">
                        <FolderTree className="w-5 h-5 text-blue-400" />
                        <div>
                          <span className="font-mono font-black text-base">
                            {ps.pallet.code}
                          </span>{' '}
                          — <span className="font-bold">{ps.pallet.label}</span>
                          <span className="text-xs text-slate-300 font-mono ml-2">
                            ({ps.pallet.dimensionsCm} · H {ps.pallet.heightCm} cm)
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-black text-sm text-amber-300">
                        {ps.grossWeightKg.toFixed(1)} kg
                      </span>
                    </div>

                    {/* Ramo Scatoloni Madre */}
                    <div className="pl-5 border-l-2 border-slate-400 space-y-3">
                      {ps.topLevelBoxes.map((bs) => (
                        <div
                          key={bs.box.id}
                          className="border border-slate-300 rounded-lg p-3 bg-slate-50/70 space-y-2"
                        >
                          <div className="flex items-center justify-between font-mono text-xs font-bold text-slate-900 border-b border-slate-200 pb-1">
                            <span>
                              ├── SCATOLONE {bs.box.code} — {bs.box.label} ({bs.box.dimensionsCm})
                            </span>
                            <span>
                              {bs.totalPieces} pz · {bs.grossWeightKg.toFixed(1)} kg
                            </span>
                          </div>

                          {/* Oggetti diretti con Foto */}
                          {bs.items.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                              {bs.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-2.5 p-1.5 rounded bg-white border border-slate-200 text-xs"
                                >
                                  {item.photoDataUrl ? (
                                    <img
                                      src={item.photoDataUrl}
                                      alt={item.name}
                                      className="w-10 h-10 rounded object-cover border border-slate-300 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-mono text-slate-400 shrink-0">
                                      FOTO
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-slate-900 truncate">
                                      {item.name}
                                    </div>
                                    <div className="font-mono text-[10px] text-slate-500">
                                      {item.sku} · {item.quantity} pz × {item.unitWeightKg} kg
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Ramo Sotto-Scatole */}
                          {bs.childBoxes.length > 0 && (
                            <div className="pl-5 border-l-2 border-purple-500 space-y-2 pt-1">
                              {bs.childBoxes.map((sub) => (
                                <div
                                  key={sub.box.id}
                                  className="border border-purple-300 rounded-lg p-2.5 bg-white space-y-1.5"
                                >
                                  <div className="flex items-center justify-between font-mono text-[11px] font-bold text-purple-950">
                                    <span>
                                      └── SOTTO-SCATOLA {sub.box.code} — {sub.box.label} (
                                      {sub.box.dimensionsCm})
                                    </span>
                                    <span>
                                      {sub.totalPieces} pz · {sub.grossWeightKg.toFixed(1)} kg
                                    </span>
                                  </div>
                                  {sub.items.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {sub.items.map((si) => (
                                        <div
                                          key={si.id}
                                          className="flex items-center gap-2 p-1.5 rounded bg-purple-50/40 border border-purple-200 text-xs"
                                        >
                                          {si.photoDataUrl ? (
                                            <img
                                              src={si.photoDataUrl}
                                              alt={si.name}
                                              className="w-9 h-9 rounded object-cover border border-purple-300 shrink-0"
                                            />
                                          ) : (
                                            <div className="w-9 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-mono text-slate-400 shrink-0">
                                              FOTO
                                            </div>
                                          )}
                                          <div className="min-w-0 flex-1">
                                            <div className="font-bold text-slate-900 truncate">
                                              {si.name}
                                            </div>
                                            <div className="font-mono text-[10px] text-slate-600">
                                              {si.sku} · {si.quantity} pz
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Ramo Materiale Fuori Scatola */}
                      {ps.looseItems.length > 0 && (
                        <div className="border-2 border-teal-700 rounded-lg p-3 bg-teal-50/40 space-y-2">
                          <div className="font-mono text-xs font-black text-teal-950 uppercase">
                            ├── MATERIALE FUORI SCATOLA SUL BANCALE ({ps.looseItems.length} colli):
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ps.looseItems.map((li) => (
                              <div
                                key={li.id}
                                className="flex items-center gap-2.5 p-2 rounded bg-white border border-teal-300 text-xs"
                              >
                                {li.photoDataUrl ? (
                                  <img
                                    src={li.photoDataUrl}
                                    alt={li.name}
                                    className="w-10 h-10 rounded object-cover border border-teal-400 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-teal-50 border border-teal-200 flex items-center justify-center text-[9px] font-mono text-teal-700 shrink-0">
                                    COLLO
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="font-bold text-slate-900 truncate">
                                    {li.name}
                                  </div>
                                  <div className="font-mono text-[10px] text-teal-900">
                                    {li.sku} · {li.dimensionsCm || '45×35×30 cm'} · {li.quantity} pz (
                                    {(li.quantity * li.unitWeightKg).toFixed(1)} kg)
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. SEZIONE PACKING LIST RIEPILOGATIVA */}
            {printCategory === 'packing_list' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b-2 border-slate-950">
                  <div>
                    <div className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      DOCUMENTO UFFICIALE DI TRASPORTO · PACKING LIST DI MAGAZZINO
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 mt-1">
                      {load.code} — {load.title}
                    </h1>
                    <p className="text-xs text-slate-700 mt-1 font-medium">
                      Cliente: <span className="font-bold">{load.client || '—'}</span> ·
                      Destinazione: <span className="font-bold">{load.destination || '—'}</span>
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-xs font-mono space-y-1 text-slate-700">
                    <div className="text-left sm:text-right space-y-1">
                      <div>
                        Data: <strong className="text-slate-900">{load.departureDate}</strong>
                      </div>
                      <div>
                        Vettore: <strong className="text-slate-900">{load.carrier || '—'}</strong>
                      </div>
                      <div>
                        Verifica Spunta:{' '}
                        <strong className="text-slate-900">
                          {summary.checkedItems}/{summary.totalItems}
                        </strong>{' '}
                        ({summary.checklistCompletionPercent}%)
                      </div>
                      <div>
                        Peso Totale Lordo:{' '}
                        <strong className="text-slate-950 text-sm">
                          {summary.totalGrossWeightKg.toFixed(1)} kg
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabella di Riepilogo Bancali */}
                <div>
                  <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-800 mb-2">
                    1. RIEPILOGO BANCALI, SCATOLE E MATERIALE FUORI SCATOLA:
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-slate-600 font-bold">
                        <th className="py-2 pr-2 font-mono">Codice Bancale</th>
                        <th className="py-2 px-2">Formato & Altezza</th>
                        <th className="py-2 px-2 text-center font-mono">Scatole</th>
                        <th className="py-2 px-2 text-center font-mono">Fuori Scatola</th>
                        <th className="py-2 px-2 text-center">Stato</th>
                        <th className="py-2 pl-2 text-right font-mono">Peso Lordo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {summary.palletSummaries.map((ps) => (
                        <tr key={ps.pallet.id}>
                          <td className="py-2 pr-2 font-mono font-bold text-slate-950">
                            {ps.pallet.code} — {ps.pallet.label || 'Bancale'}
                          </td>
                          <td className="py-2 px-2 text-slate-700 font-mono">
                            {ps.pallet.dimensionsCm} · H {ps.pallet.heightCm}cm
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-slate-900">
                            {ps.totalBoxes}
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-teal-800">
                            {ps.looseItems.length} colli
                          </td>
                          <td className="py-2 px-2 text-center text-slate-700">
                            {ps.pallet.wrapped ? 'Filmato' : 'Da filmare'}
                          </td>
                          <td className="py-2 pl-2 text-right font-mono font-bold text-slate-950 tabular-nums">
                            {ps.grossWeightKg.toFixed(1)} kg
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Distinta Analitica Articoli con Posizione e Foto */}
                <div>
                  <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-slate-800 mb-2">
                    2. DISTINTA ANALITICA ARTICOLI E COLLOCAZIONE:
                  </h3>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-slate-600 font-bold">
                        <th className="py-1.5 pr-2 w-10">Foto</th>
                        <th className="py-1.5 px-2 font-mono">SKU</th>
                        <th className="py-1.5 px-2">Articolo</th>
                        <th className="py-1.5 px-2 font-mono">Collocazione</th>
                        <th className="py-1.5 px-2 text-right font-mono">Q.tà</th>
                        <th className="py-1.5 pl-2 text-right font-mono">Peso Netto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {load.items.map((item) => {
                        const pal = load.pallets.find((p) => p.id === item.palletId);
                        const bx = load.boxes.find((b) => b.id === item.boxId);
                        const parentBx = bx?.parentBoxId
                          ? load.boxes.find((b) => b.id === bx.parentBoxId)
                          : null;

                        return (
                          <tr key={item.id}>
                            <td className="py-1.5 pr-2">
                              {item.photoDataUrl ? (
                                <img
                                  src={item.photoDataUrl}
                                  alt={item.name}
                                  className="w-7 h-7 rounded object-cover border border-slate-300"
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono">—</span>
                              )}
                            </td>
                            <td className="py-1.5 px-2 font-mono font-bold text-slate-900">
                              {item.sku}
                            </td>
                            <td className="py-1.5 px-2 text-slate-900">
                              {item.name}
                              {item.dimensionsCm ? ` (${item.dimensionsCm})` : ''}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-slate-700">
                              {bx
                                ? parentBx
                                  ? `${pal?.code || ''} > ${parentBx.code} > ${bx.code}`
                                  : `${pal?.code || ''} > ${bx.code}`
                                : pal
                                ? `${pal.code} [FUORI SCATOLA]`
                                : 'Non assegnato'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold">
                              {item.quantity} pz
                            </td>
                            <td className="py-1.5 pl-2 text-right font-mono">
                              {(item.quantity * item.unitWeightKg).toFixed(1)} kg
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sezione Firme Elettroniche Ufficiali */}
                <div className="pt-8 mt-8 border-t-2 border-slate-950 page-break-inside-avoid">
                  <div className="text-xs font-bold font-mono tracking-wider uppercase text-slate-800 mb-4">
                    CONVALIDA E FIRME ELETTRONICHE DI PRESA IN CARICO:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-700">
                    {/* Operatore */}
                    <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between h-44">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          1. Preparazione Check-list
                        </div>
                        <div className="text-[11px] text-slate-500">Operatore Magazziniere</div>
                      </div>
                      {operatoreSig ? (
                        <div className="space-y-1 text-center">
                          <img
                            src={operatoreSig.signatureDataUrl}
                            alt="Firma Operatore"
                            className="h-14 mx-auto object-contain border-b border-slate-400 w-full"
                          />
                          <div className="font-bold text-slate-900 text-xs mt-1">
                            {operatoreSig.signerName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {operatoreSig.companyOrBadge}
                          </div>
                        </div>
                      ) : (
                        <div className="no-print text-center py-4">
                          <button
                            type="button"
                            onClick={() => setActiveSignRole('operatore')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs hover:bg-blue-100 flex items-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            Apponi Firma
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Responsabile */}
                    <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between h-44">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          2. Controllo Imballo & Pesi
                        </div>
                        <div className="text-[11px] text-slate-500">Responsabile Spedizioni</div>
                      </div>
                      {responsabileSig ? (
                        <div className="space-y-1 text-center">
                          <img
                            src={responsabileSig.signatureDataUrl}
                            alt="Firma Responsabile"
                            className="h-14 mx-auto object-contain border-b border-slate-400 w-full"
                          />
                          <div className="font-bold text-slate-900 text-xs mt-1">
                            {responsabileSig.signerName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {responsabileSig.companyOrBadge}
                          </div>
                        </div>
                      ) : (
                        <div className="no-print text-center py-4">
                          <button
                            type="button"
                            onClick={() => setActiveSignRole('responsabile')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs hover:bg-blue-100 flex items-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            Apponi Firma
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Autista */}
                    <div className="border border-slate-300 rounded-xl p-4 bg-slate-50/50 flex flex-col justify-between h-44">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">
                          3. Presa in Consegna Merci
                        </div>
                        <div className="text-[11px] text-slate-500">Autista / Vettore Esterno</div>
                      </div>
                      {autistaSig ? (
                        <div className="space-y-1 text-center">
                          <img
                            src={autistaSig.signatureDataUrl}
                            alt="Firma Autista"
                            className="h-14 mx-auto object-contain border-b border-slate-400 w-full"
                          />
                          <div className="font-bold text-slate-900 text-xs mt-1">
                            {autistaSig.signerName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {autistaSig.companyOrBadge}
                          </div>
                        </div>
                      ) : (
                        <div className="no-print text-center py-4">
                          <button
                            type="button"
                            onClick={() => setActiveSignRole('autista')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-bold text-xs hover:bg-blue-100 flex items-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            Apponi Firma
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature Pad Modal */}
      {activeSignRole && (
        <SignaturePadModal
          role={activeSignRole}
          existingSignature={getSignature(activeSignRole)}
          onSaveSignature={onSaveSignature}
          onClose={() => setActiveSignRole(null)}
        />
      )}
      </div>
    </PrintPortal>
  );
};
