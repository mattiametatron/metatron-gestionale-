import React, { useState, useMemo } from 'react';
import {
  Package,
  Layers,
  CheckCircle2,
  Circle,
  Search,
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  Calendar,
  Truck,
  Building,
  MapPin,
  ExternalLink,
  ShieldCheck,
  Camera,
  X,
  FileText,
  PenTool,
  Check,
  Languages,
} from 'lucide-react';
import { CargoLoad, ChecklistItem, ElectronicSignature } from '../types/warehouse';
import { calculateLoadSummary, exportLoadToCSV } from '../utils/calculations';
import { translateItalianToEnglish } from '../utils/logisticsTranslator';
import { SignaturePadModal } from './SignaturePadModal';
import { downloadPackingListPDF, getPackingListPdfBlobUrl } from '../utils/pdfGenerator';

interface DigitalPackingListViewerProps {
  load: CargoLoad;
  onClose?: () => void;
  onBackToApp?: () => void;
  onSaveDeliverySignature?: (sig: ElectronicSignature) => void;
}

export const DigitalPackingListViewer: React.FC<DigitalPackingListViewerProps> = ({
  load,
  onClose,
  onBackToApp,
  onSaveDeliverySignature,
}) => {
  const handleExit = onClose || onBackToApp;
  const [lang, setLang] = useState<'it' | 'en'>('it');
  const isEn = lang === 'en';
  const t = (it: string, en: string) => (isEn ? en : it);
  const tr = (val?: string) => (!val ? '' : isEn ? translateItalianToEnglish(val) : val);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pallets' | 'boxes' | 'loose'>('all');
  const [selectedPalletId, setSelectedPalletId] = useState<string>('all');
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; title: string } | null>(null);

  const [viewMode, setViewMode] = useState<'pdf' | 'interactive'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      if (search.includes('format=pdf') || !search.includes('view=interactive')) {
        return 'pdf';
      }
    }
    return 'pdf';
  });
  const [unloadingChecked, setUnloadingChecked] = useState<Record<string, boolean>>({});
  const [showSignModal, setShowSignModal] = useState<boolean>(false);
  const [receiverSignature, setReceiverSignature] = useState<ElectronicSignature | null>(() => {
    return load.signatures?.find((s) => s.role === 'autista') || null;
  });

  const pdfBlobUrl = useMemo(() => {
    try {
      return getPackingListPdfBlobUrl(load);
    } catch (e) {
      console.error('Error generating PDF blob URL:', e);
      return '';
    }
  }, [load]);

  const summary = useMemo(() => calculateLoadSummary(load), [load]);

  const toggleCheck = (itemId: string) => {
    setUnloadingChecked((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const allItems = load.items;
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchNotes = (item.notes || '').toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchNotes) return false;
      }

      // Category filter
      if (activeFilter === 'loose') {
        return item.palletId && !item.boxId;
      }
      if (activeFilter === 'boxes') {
        return !!item.boxId;
      }
      if (activeFilter === 'pallets' && selectedPalletId !== 'all') {
        return item.palletId === selectedPalletId;
      }

      return true;
    });
  }, [allItems, searchTerm, activeFilter, selectedPalletId]);

  const checkedCount = Object.values(unloadingChecked).filter(Boolean).length;
  const progressPercent = allItems.length > 0 ? Math.round((checkedCount / allItems.length) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-16 font-sans antialiased selection:bg-blue-600 selection:text-white print-modal-container">
      {/* Top Navbar */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {handleExit && (
              <button
                type="button"
                onClick={handleExit}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title="Torna alla gestione completa magazzino"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Gestionale CaricoStudio</span>
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs text-sm">
              CS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-950">
                  {t('Distinta Materiale & Spedizione Digitale', 'Digital Packing List & Delivery Note')}
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  {t('Ufficiale', 'Official')}
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-500">
                {t('Commessa', 'Job Order')}: <strong className="text-slate-900">{load.code}</strong> &bull; {load.title ? tr(load.title) : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Lingua Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang('it')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                  lang === 'it' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇮🇹 IT
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-all ${
                  lang === 'en' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇬🇧 EN
              </button>
            </div>

            {/* Modalità Documento PDF vs Spunta Interattiva */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                className={`px-3 py-1 rounded cursor-pointer transition-all flex items-center gap-1.5 ${
                  viewMode === 'pdf' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Documento PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                className={`px-3 py-1 rounded cursor-pointer transition-all flex items-center gap-1.5 ${
                  viewMode === 'interactive' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Spunta & Foto</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => downloadPackingListPDF(load)}
              className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
              title="Scarica il file PDF della distinta"
            >
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>{t('Scarica PDF', 'Download PDF')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT: Se viewMode === 'pdf', visualizza direttamente il documento PDF nativo */}
      {viewMode === 'pdf' ? (
        <main className="max-w-6xl mx-auto px-4 py-4 flex-1 flex flex-col h-[calc(100vh-72px)]">
          <div className="bg-white border-2 border-slate-900 rounded-2xl shadow-sm flex flex-col flex-1 overflow-hidden">
            {/* Barra info documento PDF */}
            <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-300" />
                <span className="font-extrabold font-mono tracking-wide">
                  DOCUMENTO UFFICIALE PDF: {load.code} — {load.title || 'Distinta Spedizione'}
                </span>
                <span className="hidden sm:inline text-slate-400">|</span>
                <span className="hidden sm:inline text-slate-300 text-[11px]">
                  Tutto il materiale caricato, pesi, scatole e bancali
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadPackingListPDF(load)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer flex items-center gap-1.5 shadow-2xs text-[11px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Scarica PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('interactive')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg cursor-pointer flex items-center gap-1.5 text-[11px]"
                >
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Passa a Vista Interattiva con Spunta</span>
                </button>
              </div>
            </div>

            {/* Viewer Iframe PDF Reale */}
            {pdfBlobUrl ? (
              <iframe
                src={`${pdfBlobUrl}#toolbar=1&navpanes=0`}
                title={`Distinta PDF ${load.code}`}
                className="w-full flex-1 border-0 min-h-[550px]"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-10 text-center text-slate-500 text-xs">
                Generazione del documento PDF in corso...
              </div>
            )}
          </div>
        </main>
      ) : (
        /* Main Container: Vista Interattiva */
        <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Banner Master Commessa */}
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <div className="text-xs font-mono font-black text-slate-500 uppercase tracking-widest">
                {t('DISTINTA DI SPEDIZIONE & CONSEGNA MERCI', 'MASTER SHIPMENT & DELIVERY DISPATCH')}
              </div>
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-950 mt-1 select-all">
                {load.code}
              </div>
              <div className="text-base sm:text-lg font-extrabold text-blue-900 mt-0.5">
                {load.title ? tr(load.title) : t('Nuova Spedizione Merci', 'General Freight Shipment')}
              </div>
            </div>

            <div className="text-right space-y-1 text-xs font-mono">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-200 font-bold">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{t('Data Spedizione', 'Departure')}: {load.departureDate || new Date().toISOString().split('T')[0]}</span>
              </div>
              <div className="text-slate-500 text-[11px]">
                {t('Generato da CaricoStudio', 'Powered by CaricoStudio Digital Dispatch')}
              </div>
            </div>
          </div>

          {/* Dati Cliente e Vettore */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-500 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-slate-600" />
                {t('CLIENTE & DESTINAZIONE', 'CUSTOMER & DESTINATION')}
              </div>
              <div className="text-sm font-black text-slate-900">
                {load.client || t('Cliente Non Specificato', 'Unspecified Customer')}
              </div>
              <div className="text-slate-600 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{load.destination ? tr(load.destination) : '—'}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="text-[10px] font-mono font-bold uppercase text-slate-500 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-600" />
                {t('VETTORE / TRASPORTATORE', 'CARRIER / FORWARDER')}
              </div>
              <div className="text-sm font-black text-slate-900">
                {load.carrier || t('Vettore Incaricato', 'Assigned Logistics Carrier')}
              </div>
              <div className="text-slate-600 text-[11px]">
                {t('Stato Merci', 'Cargo Status')}: <strong className="text-emerald-700">{t('VERIFICATO E PRONTO', 'VERIFIED & READY')}</strong>
              </div>
            </div>
          </div>

          {/* 4 Cards Metriche */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200">
              <div className="text-[10px] font-mono font-bold uppercase text-blue-900">
                {t('BANCALI TOTALI', 'TOTAL PALLETS')}
              </div>
              <div className="text-3xl font-black font-mono text-blue-900 my-0.5">
                {summary.totalPallets}
              </div>
              <div className="text-[10px] text-blue-700 font-medium">
                {t('Colli Pallet', 'Pallet Units')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200">
              <div className="text-[10px] font-mono font-bold uppercase text-amber-900">
                {t('SCATOLE TOTALI', 'TOTAL BOXES')}
              </div>
              <div className="text-3xl font-black font-mono text-amber-900 my-0.5">
                {summary.totalBoxes}
              </div>
              <div className="text-[10px] text-amber-700 font-medium">
                {t('Scatole e Casse', 'Cartons & Crates')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
              <div className="text-[10px] font-mono font-bold uppercase text-emerald-900">
                {t('FUORI SCATOLA', 'LOOSE ITEMS')}
              </div>
              <div className="text-3xl font-black font-mono text-emerald-900 my-0.5">
                {summary.palletSummaries.reduce((acc, p) => acc + p.looseItems.length, 0)}
              </div>
              <div className="text-[10px] text-emerald-700 font-medium">
                {t('Articoli sfusi su bancale', 'Items on pallets')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200">
              <div className="text-[10px] font-mono font-bold uppercase text-rose-900">
                {t('PESO LORDO', 'GROSS WEIGHT')}
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-rose-900 my-0.5">
                {summary.totalGrossWeightKg.toFixed(1)} <span className="text-sm font-bold">KG</span>
              </div>
              <div className="text-[10px] text-rose-700 font-medium">
                {t('Inclusa tara', 'Tare included')}
              </div>
            </div>
          </div>
        </div>

        {/* Barra di Spunta allo Scarico (Check-in Ricezione Merci per il Cliente) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  {t('Spunta & Controllo Merci allo Scarico (Ricezione)', 'Unloading Goods Inspection & Check-in')}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {t('Tocca la spunta per ciascun articolo per convalidare la conformità del collo all\'arrivo.', 'Tap checkboxes as you unload items from the truck to confirm reception.')}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-slate-800">
                {checkedCount} / {allItems.length} ({progressPercent}%) {t('Verificati', 'Verified')}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Toolbar Ricerca & Filtri */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Cerca Articolo */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('Cerca per codice SKU, nome articolo o nota...', 'Search by SKU, item name or notes...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Tipologia */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'all' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Tutti', 'All')} ({allItems.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('boxes')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'boxes' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('In Scatola', 'In Boxes')}
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('loose')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeFilter === 'loose' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('Fuori Scatola', 'Loose Items')}
            </button>
          </div>
        </div>

        {/* Elenco Articoli della Distinta */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 text-slate-500 text-xs">
              {t('Nessun articolo trovato con i filtri attuali.', 'No items found matching the selected filters.')}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isChecked = !!unloadingChecked[item.id];
              const pal = load.pallets.find((p) => p.id === item.palletId);
              const bx = load.boxes.find((b) => b.id === item.boxId);
              const parentBx = bx?.parentBoxId ? load.boxes.find((b) => b.id === bx.parentBoxId) : null;

              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-4 transition-all shadow-2xs ${
                    isChecked
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Checkbox di verifica scarico */}
                      <button
                        type="button"
                        onClick={() => toggleCheck(item.id)}
                        className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-emerald-500 bg-white text-transparent'
                        }`}
                        title={t('Segna come verificato', 'Mark as checked')}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      {/* Foto Collo (se disponibile) */}
                      {item.photoDataUrl ? (
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto({ url: item.photoDataUrl!, title: `${item.sku} · ${item.name}` })}
                          className="relative group w-14 h-14 rounded-xl overflow-hidden border border-slate-300 bg-slate-900 shrink-0 cursor-pointer shadow-2xs"
                          title="Tocca per ingrandire la fotografia reale del collo"
                        >
                          <img
                            src={item.photoDataUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                            <Camera className="w-4 h-4" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-14 h-14 rounded-xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      {/* Descrizione Articolo */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {item.sku}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 truncate">
                            {tr(item.name)}
                          </span>
                          {item.fragile && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              ⚠️ {t('FRAGILE', 'FRAGILE')}
                            </span>
                          )}
                          {item.dimensionsCm && (
                            <span className="text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                              {item.dimensionsCm}
                            </span>
                          )}
                        </div>

                        {/* Note articolo */}
                        {item.notes && (
                          <p className="text-xs text-slate-600 italic">
                            {tr(item.notes)}
                          </p>
                        )}

                        {/* Posizione Stivaggio */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 pt-0.5">
                          {pal && (
                            <span className="flex items-center gap-1 font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                              <Layers className="w-3 h-3 text-blue-600" />
                              {pal.code} ({tr(pal.label)})
                            </span>
                          )}
                          {bx ? (
                            <span className="flex items-center gap-1 font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                              <Package className="w-3 h-3 text-amber-600" />
                              {bx.code} {parentBx ? `(in ${parentBx.code})` : ''}
                            </span>
                          ) : (
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                              {t('Fuori Scatola su Bancale', 'Loose Item directly on Pallet')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quantità e Peso */}
                    <div className="text-right shrink-0">
                      <div className="font-black text-base text-slate-950 font-mono">
                        {item.quantity} {t('pz', 'pcs')}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 font-bold">
                        {(item.quantity * item.unitWeightKg).toFixed(1)} kg
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sezione Firme e Ricevuta Consegna */}
        <div className="bg-white border-2 border-slate-900 rounded-2xl p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">
                {t('Attestazione Firme Elettroniche & Presa in Consegna', 'Electronic Signatures & Proof of Delivery')}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {t('Certificato Digitale Conforme', 'Digital Compliance')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Operatore Preparatore */}
            {(() => {
              const opSig = load.signatures?.find((s) => s.role === 'operatore');
              return (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                    1. {t('Operatore Preparazione', 'Preparation Operator')}
                  </span>
                  {opSig ? (
                    <div>
                      <div className="font-bold text-slate-900">{opSig.signerName}</div>
                      <img src={opSig.signatureDataUrl} alt="Firma" className="h-10 object-contain my-1 border border-slate-200 rounded bg-white" />
                      <div className="text-[10px] font-mono text-slate-400">
                        {new Date(opSig.signedAt).toLocaleDateString()} {new Date(opSig.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] py-4 text-center">
                      {t('Verificato in magazzino', 'Verified at warehouse')}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Responsabile Logistica */}
            {(() => {
              const respSig = load.signatures?.find((s) => s.role === 'responsabile');
              return (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                    2. {t('Responsabile Logistica', 'Logistics Supervisor')}
                  </span>
                  {respSig ? (
                    <div>
                      <div className="font-bold text-slate-900">{respSig.signerName}</div>
                      <img src={respSig.signatureDataUrl} alt="Firma" className="h-10 object-contain my-1 border border-slate-200 rounded bg-white" />
                      <div className="text-[10px] font-mono text-slate-400">
                        {new Date(respSig.signedAt).toLocaleDateString()} {new Date(respSig.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-[11px] py-4 text-center">
                      {t('Approvato per spedizione', 'Approved for departure')}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Firma Cliente / Ricevitore allo Scarico */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-slate-500 block">
                3. {t('Ricevuta Merci Cliente', 'Customer Goods Receipt')}
              </span>
              {receiverSignature ? (
                <div>
                  <div className="font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {receiverSignature.signerName}
                  </div>
                  <img src={receiverSignature.signatureDataUrl} alt="Firma Ricevente" className="h-10 object-contain my-1 border border-slate-200 rounded bg-white" />
                  <div className="text-[10px] font-mono text-slate-400">
                    {new Date(receiverSignature.signedAt).toLocaleDateString()} {new Date(receiverSignature.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2 space-y-2">
                  <div className="text-[11px] text-slate-500">
                    {t('Firma sullo schermo per conferma arrivo', 'Sign on screen to confirm receipt')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSignModal(true)}
                    className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {t('Firma per Ricevuta', 'Sign Receipt')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      )}

      {/* Lightbox Ingrandimento Foto Collo */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4 animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl overflow-hidden shadow-2xl max-w-lg w-full space-y-3 p-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="text-xs font-bold text-slate-800 truncate">
                {lightboxPhoto.title}
              </h4>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title}
              className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-900 shadow-inner"
            />
            <div className="text-center text-[11px] text-slate-500 font-mono">
              Fotografia reale verificata in magazzino prima dell'imballo
            </div>
          </div>
        </div>
      )}

      {/* Modale Firma Elettronica Ricezione Merci */}
      {showSignModal && (
        <SignaturePadModal
          role="autista"
          existingSignature={receiverSignature || undefined}
          onSaveSignature={(sig: ElectronicSignature) => {
            setReceiverSignature(sig);
            onSaveDeliverySignature?.(sig);
            setShowSignModal(false);
          }}
          onClose={() => setShowSignModal(false)}
        />
      )}
    </div>
  );
};
