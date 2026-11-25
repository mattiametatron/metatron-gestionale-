import React, { useState } from 'react';
import {
  Printer,
  X,
  Paintbrush,
  LayoutTemplate,
  Type,
  ExternalLink,
  Download,
  Info,
} from 'lucide-react';
import {
  CargoLoad,
  CartelloLayoutFormat,
  FinishingCartello,
} from '../types/warehouse';
import { PrintPortal } from './PrintPortal';
import {
  generateFinishingCartelliPDF,
  openPdfBlobInNewTab,
} from '../utils/pdfGenerator';

interface FinishingPrintModalProps {
  load: CargoLoad;
  tags: FinishingCartello[];
  initialTagId?: string | 'all';
  defaultLayoutFormat?: CartelloLayoutFormat;
  onClose: () => void;
}

const LAYOUT_LABELS: Record<CartelloLayoutFormat, string> = {
  a4_portrait: 'A4 Verticale Standard',
  a4_landscape: 'A4 Orizzontale Panoramico',
  a5_double: '2 Cartelli per Foglio (2× A5)',
  a6_quad: '4 Cartellini per Foglio (4× A6)',
};

export const FinishingPrintModal: React.FC<FinishingPrintModalProps> = ({
  load,
  tags,
  initialTagId = 'all',
  defaultLayoutFormat,
  onClose,
}) => {
  const firstTag = tags.find((t) => t.id === initialTagId) || tags[0];

  const [selectedTagId, setSelectedTagId] = useState<string>(initialTagId);
  const [copiesPerTag, setCopiesPerTag] = useState<number>(1);
  const [layoutFormat, setLayoutFormat] = useState<CartelloLayoutFormat>(
    defaultLayoutFormat || firstTag?.layoutFormat || 'a4_portrait'
  );
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'giant'>(
    firstTag?.fontScale || 'giant'
  );
  const [showSignatures, setShowSignatures] = useState<boolean>(
    firstTag?.showSignatures !== false
  );
  const [showColorBanner, setShowColorBanner] = useState<boolean>(
    firstTag?.showColorBanner !== false
  );
  const [showItemsList, setShowItemsList] = useState<boolean>(
    firstTag?.showItemsList === true
  );

  const filteredTags =
    selectedTagId === 'all'
      ? tags
      : tags.filter((t) => t.id === selectedTagId);

  const displayedSheets: {
    tag: FinishingCartello;
    copyIndex: number;
    totalCopies: number;
  }[] = [];

  filteredTags.forEach((tag) => {
    const count = Math.max(1, Math.min(12, copiesPerTag));
    for (let c = 1; c <= count; c++) {
      displayedSheets.push({ tag, copyIndex: c, totalCopies: count });
    }
  });

  const handlePrint = () => {
    window.print();
  };

  const buildPdfDoc = () =>
    generateFinishingCartelliPDF(load, filteredTags, {
      layoutFormat,
      copiesPerTag,
      showColorBanner,
      showSignatures,
      showItemsList,
    });

  const handleOpenPdfForPrint = () => {
    const doc = buildPdfDoc();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    openPdfBlobInNewTab(url);
  };

  const handleDownloadPdf = () => {
    const doc = buildPdfDoc();
    const cleanCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Cartelli_Verniciatura_${cleanCode}.pdf`);
  };

  const commessaFontClass =
    fontScale === 'giant'
      ? 'text-5xl sm:text-6xl md:text-7xl'
      : fontScale === 'large'
      ? 'text-4xl sm:text-5xl md:text-6xl'
      : 'text-3xl sm:text-4xl md:text-5xl';

  const treatmentFontClass =
    fontScale === 'giant'
      ? 'text-5xl sm:text-6xl md:text-7xl'
      : fontScale === 'large'
      ? 'text-4xl sm:text-5xl md:text-6xl'
      : 'text-3xl sm:text-4xl md:text-5xl';

  return (
    <PrintPortal>
      {layoutFormat === 'a4_landscape' && (
        <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } }`}</style>
      )}
      <div className="print-modal-container fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        <div className="print-canvas-wrapper bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden text-slate-900">
        {/* Top Modal Bar (hidden in print) */}
        <div className="no-print bg-slate-900 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-sm">
              <Paintbrush className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                  Layout Stampa Cartello Verniciatura / RAL / Zincatura
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {LAYOUT_LABELS[layoutFormat]}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Scegli il formato del layout, la grandezza dei caratteri e il numero di copie prima di stampare
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selettore Layout */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
              <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={layoutFormat}
                onChange={(e) =>
                  setLayoutFormat(e.target.value as CartelloLayoutFormat)
                }
                className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="a4_portrait">A4 Verticale Gigante (1 per foglio)</option>
                <option value="a4_landscape">A4 Orizzontale Panoramico</option>
                <option value="a5_double">2 Cartelli su 1 Foglio A4 (Doppio A5)</option>
                <option value="a6_quad">4 Cartellini su 1 Foglio A4 (4× Etichette)</option>
              </select>
            </div>

            {/* Grandezza Caratteri */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
              <Type className="w-3.5 h-3.5 text-blue-400" />
              <select
                value={fontScale}
                onChange={(e) =>
                  setFontScale(e.target.value as 'normal' | 'large' | 'giant')
                }
                className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="giant">Carattere Cubitale Massimo</option>
                <option value="large">Carattere Molto Grande</option>
                <option value="normal">Carattere Standard</option>
              </select>
            </div>

            {/* Selettore Cartello */}
            {tags.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
                <select
                  value={selectedTagId}
                  onChange={(e) => setSelectedTagId(e.target.value)}
                  className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="all">Tutti i Cartelli ({tags.length})</option>
                  {tags.map((t, idx) => (
                    <option key={t.id} value={t.id}>
                      #{idx + 1} — {t.commessaCode}: {t.treatmentText}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Numero Copie */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-300 font-semibold">Copie:</span>
              <select
                value={copiesPerTag}
                onChange={(e) => setCopiesPerTag(Number(e.target.value) || 1)}
                className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-amber-400 cursor-pointer font-mono"
              >
                {[1, 2, 3, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            {/* Pulsante Apri PDF fuori dall'iframe per vedere tutte le stampanti */}
            <button
              type="button"
              onClick={handleOpenPdfForPrint}
              className="py-2 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
              title="Apre il PDF in una nuova scheda del browser per selezionare qualsiasi stampante Windows/USB/Wi-Fi"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Apri PDF (Vedi Stampanti)</span>
            </button>

            {/* Pulsante Scarica PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-600 cursor-pointer transition-all"
              title="Scarica il file PDF sul PC"
            >
              <Download className="w-4 h-4 text-amber-300" />
              <span>Scarica PDF</span>
            </button>

            {/* Pulsante Stampa */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Stampa Diretta</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Toolbar Opzioni Visive (hidden in print) */}
        <div className="no-print bg-slate-800 text-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-slate-700 shrink-0">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showColorBanner}
                onChange={(e) => setShowColorBanner(e.target.checked)}
                className="rounded text-amber-500 focus:ring-0 cursor-pointer"
              />
              <span>Mostra Barra Colore Visiva</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showSignatures}
                onChange={(e) => setShowSignatures(e.target.checked)}
                className="rounded text-amber-500 focus:ring-0 cursor-pointer"
              />
              <span>Mostra Riquadri Firme &amp; Controllo Qualità</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showItemsList}
                onChange={(e) => setShowItemsList(e.target.checked)}
                className="rounded text-amber-500 focus:ring-0 cursor-pointer"
              />
              <span>Includi Elenco Articoli della Commessa ({load.items.length})</span>
            </label>
          </div>

          <span className="text-[11px] text-slate-400">
            Totale da stampare: <strong className="text-white">{displayedSheets.length}</strong> cartellini
          </span>
        </div>

        {/* Avviso Stampanti Fisiche (hidden in print) */}
        <div className="no-print bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-2 text-[11px] text-amber-950 shrink-0">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Non vedi la tua stampante?</strong> Se usi l&apos;anteprima integrata, il browser potrebbe nascondere le stampanti fisiche. Clicca{' '}
            <strong>Apri PDF (Vedi Stampanti)</strong> per aprire fuori dall&apos;anteprima (oppure in Chrome clicca{' '}
            <strong>Destinazione &rarr; Vedi altro...</strong>).
          </span>
        </div>

        {/* Printable A4 Preview Area */}
        <div className="print-canvas-wrapper flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/80 space-y-8">
          {/* =====================================================================
              LAYOUT 3: DOPPIO CARTELLO A5 SU 1 FOGLIO A4 (2 PER PAGINA)
          ===================================================================== */}
          {layoutFormat === 'a5_double' ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {(displayedSheets.length === 1
                ? [displayedSheets[0], displayedSheets[0]]
                : displayedSheets
              ).map(({ tag }, idx, arr) => (
                <div
                  key={`a5-${tag.id}-${idx}`}
                  className="pallet-sheet bg-white border-4 border-slate-950 rounded-2xl p-5 shadow-md text-slate-950 space-y-3"
                  style={{
                    pageBreakAfter:
                      idx % 2 === 1 && idx < arr.length - 1 ? 'always' : 'auto',
                  }}
                >
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
                    <span className="px-2.5 py-0.5 rounded bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest">
                      CARTELLO VERNICIATURA / TRATTAMENTO #{idx + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700">
                      Data: {tag.deliveryDate || new Date().toLocaleDateString('it-IT')}
                      {tag.palletCode ? ` · ${tag.palletCode}` : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
                    <div className="sm:col-span-5 border-2 border-slate-900 rounded-xl p-3 bg-slate-50 flex flex-col justify-center">
                      <span className="text-[10px] font-black uppercase text-slate-500">
                        COMMESSA / ORDINE
                      </span>
                      <div className="text-3xl sm:text-4xl font-black font-mono text-slate-950 leading-none mt-1 break-words">
                        {tag.commessaCode || load.code}
                      </div>
                      <div className="text-xs font-extrabold text-slate-700 mt-1 uppercase truncate">
                        {tag.commessaTitle || load.title}
                      </div>
                    </div>

                    <div className="sm:col-span-7 border-3 border-slate-950 rounded-xl p-3 bg-white flex flex-col justify-center text-center">
                      <span className="text-[10px] font-black uppercase text-slate-500">
                        COLORE RAL / ZINCATURA / LAVORAZIONE
                      </span>
                      {showColorBanner && tag.swatchHex && (
                        <div
                          className="w-full h-4 rounded border border-slate-900 my-1"
                          style={{ backgroundColor: tag.swatchHex }}
                        />
                      )}
                      <div className="text-2xl sm:text-3xl font-black font-mono text-slate-950 uppercase leading-tight break-words py-1">
                        {tag.treatmentText || 'DA SPECIFICARE'}
                      </div>
                      {tag.finishType && (
                        <span className="text-[11px] font-black uppercase text-slate-700">
                          Finitura: {tag.finishType}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-300 font-bold">
                    <span>
                      Quantità: <strong className="font-mono">{tag.quantityOrPieces || 'Lotto Commessa'}</strong>
                    </span>
                    {tag.supplierName && (
                      <span>
                        Destinatario: <strong>{tag.supplierName}</strong>
                      </span>
                    )}
                    {tag.notes && (
                      <span className="text-slate-900">
                        Note: <strong>{tag.notes}</strong>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : layoutFormat === 'a6_quad' ? (
            /* =====================================================================
               LAYOUT 4: 4 CARTELLINI PER FOGLIO A4 (GRIGLIA 2x2)
            ===================================================================== */
            <div className="pallet-sheet max-w-4xl mx-auto bg-white p-4 border-2 border-slate-900 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(displayedSheets.length < 4
                ? [
                    ...displayedSheets,
                    ...Array(4 - displayedSheets.length).fill(displayedSheets[0]),
                  ]
                : displayedSheets
              ).map(({ tag }, idx) => (
                <div
                  key={`a6-${tag.id}-${idx}`}
                  className="border-3 border-slate-950 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-white text-slate-950"
                >
                  <div className="flex items-center justify-between border-b-2 border-slate-900 pb-1.5">
                    <span className="text-[10px] font-black uppercase bg-slate-950 text-white px-2 py-0.5 rounded">
                      CARTELLINO COLLO #{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono font-bold">
                      {tag.deliveryDate || new Date().toLocaleDateString('it-IT')}
                    </span>
                  </div>

                  <div className="bg-slate-50 border-2 border-slate-900 rounded-lg p-2.5">
                    <span className="text-[9px] font-black uppercase text-slate-500 block">
                      COMMESSA
                    </span>
                    <div className="text-2xl sm:text-3xl font-black font-mono leading-none mt-0.5">
                      {tag.commessaCode || load.code}
                    </div>
                    <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                      {tag.commessaTitle || load.title}
                    </div>
                  </div>

                  <div className="border-2 border-slate-950 rounded-lg p-3 text-center bg-white">
                    <span className="text-[9px] font-black uppercase text-slate-500 block">
                      COLORE RAL / LAVORAZIONE
                    </span>
                    {showColorBanner && tag.swatchHex && (
                      <div
                        className="w-full h-3.5 rounded border border-slate-900 my-1"
                        style={{ backgroundColor: tag.swatchHex }}
                      />
                    )}
                    <div className="text-xl sm:text-2xl font-black font-mono uppercase leading-tight break-words py-1">
                      {tag.treatmentText || 'DA SPECIFICARE'}
                    </div>
                    {tag.finishType && (
                      <div className="text-[10px] font-extrabold uppercase text-slate-700">
                        {tag.finishType}
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] font-bold flex items-center justify-between border-t border-slate-300 pt-1.5">
                    <span>{tag.palletCode || 'Lotto Commessa'}</span>
                    <span className="font-mono">{tag.quantityOrPieces || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* =====================================================================
               LAYOUT 1 & 2: A4 VERTICALE GIGANTE O A4 ORIZZONTALE PANORAMICO
            ===================================================================== */
            displayedSheets.map(({ tag, copyIndex, totalCopies }, idx) => (
              <div
                key={`${tag.id}-copy-${copyIndex}-${idx}`}
                className={`pallet-sheet bg-white border-4 border-slate-950 rounded-2xl p-6 sm:p-9 shadow-lg text-slate-950 mx-auto space-y-6 ${
                  layoutFormat === 'a4_landscape' ? 'max-w-5xl' : 'max-w-4xl'
                }`}
                style={{
                  pageBreakAfter:
                    idx < displayedSheets.length - 1 ? 'always' : 'auto',
                  breakAfter:
                    idx < displayedSheets.length - 1 ? 'page' : 'auto',
                }}
              >
                {/* 1. INTESTAZIONE SUPERIORE CARTELLO */}
                <div className="border-b-4 border-slate-950 pb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest bg-slate-950 text-white">
                        CARTELLO LAVORAZIONE / VERNICIATURA / TRATTAMENTO
                      </span>
                      {totalCopies > 1 && (
                        <span className="text-xs font-mono font-bold text-slate-600">
                          Copia {copyIndex}/{totalCopies}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-600 mt-1.5 uppercase tracking-wide">
                      SCHEDA IDENTIFICATIVA MATERIALE IN CONTO LAVORAZIONE / VERNICIATURA / ZINCATURA
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      DATA EMISSIONE
                    </div>
                    <div className="text-lg font-black text-slate-950">
                      {tag.deliveryDate || new Date().toLocaleDateString('it-IT')}
                    </div>
                    {tag.supplierName && (
                      <div className="text-xs font-bold text-slate-800 mt-0.5 uppercase">
                        Dest.: {tag.supplierName}
                      </div>
                    )}
                  </div>
                </div>

                {/* CORPO PRINCIPALE (VERTICALE O AFFIANCATO SE PANORAMICO) */}
                <div
                  className={
                    layoutFormat === 'a4_landscape'
                      ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch'
                      : 'space-y-6'
                  }
                >
                  {/* 🌟 2. RIQUADRO COMMESSA SCRITTA IN GRANDE 🌟 */}
                  <div
                    className={`border-4 border-slate-900 rounded-2xl p-5 sm:p-6 bg-slate-50 flex flex-col justify-center ${
                      layoutFormat === 'a4_landscape' ? 'lg:col-span-5' : ''
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-300 pb-2 mb-3">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-600">
                        COMMESSA / RIFERIMENTO ORDINE
                      </span>
                      {(tag.clientName || load.client) && (
                        <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                          Cliente:{' '}
                          <strong className="font-black uppercase">
                            {tag.clientName || load.client}
                          </strong>
                        </span>
                      )}
                    </div>

                    <div
                      className={`${commessaFontClass} font-black font-mono tracking-tight text-slate-950 leading-none break-words select-all`}
                    >
                      {tag.commessaCode || load.code}
                    </div>

                    {(tag.commessaTitle || load.title) && (
                      <div className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-2 uppercase tracking-tight">
                        {tag.commessaTitle || load.title}
                      </div>
                    )}
                  </div>

                  {/* 🌟 3. RIQUADRO GIGANTE: COLORE RAL / ZINCATURA / LAVORAZIONE 🌟 */}
                  <div
                    className={`border-4 border-slate-950 rounded-2xl p-6 sm:p-8 bg-white text-center shadow-xs space-y-4 flex flex-col justify-center ${
                      layoutFormat === 'a4_landscape' ? 'lg:col-span-7' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Paintbrush className="w-6 h-6 text-slate-900" />
                      <span className="text-sm sm:text-base font-black tracking-widest uppercase text-slate-700">
                        COLORE RAL / LAVORAZIONE / TRATTAMENTO RICHIESTO
                      </span>
                    </div>

                    {showColorBanner && tag.swatchHex && (
                      <div className="flex items-center justify-center">
                        <div
                          className="w-full max-w-md h-8 rounded-lg border-2 border-slate-900 shadow-inner"
                          style={{ backgroundColor: tag.swatchHex }}
                        />
                      </div>
                    )}

                    <div className="py-4 px-2 bg-slate-50 border-y-4 border-slate-950 my-2">
                      <div
                        className={`${treatmentFontClass} font-black font-mono tracking-tight text-slate-950 uppercase leading-tight break-words select-all`}
                      >
                        {tag.treatmentText || 'DA SPECIFICARE'}
                      </div>
                    </div>

                    {tag.finishType && (
                      <div>
                        <span className="inline-block px-5 py-1.5 rounded-xl bg-slate-900 text-white text-base sm:text-lg font-black uppercase tracking-wide">
                          FINITURA: {tag.finishType}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. DETTAGLI BANCALE, QUANTITÀ E FORNITORE */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="border-2 border-slate-900 rounded-xl p-3.5 bg-slate-50">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      COLLO / BANCALE ASSOCIATO
                    </span>
                    <span className="text-lg font-black font-mono text-slate-950 block mt-1">
                      {tag.palletCode || 'LOTTO INTERA COMMESSA'}
                    </span>
                  </div>

                  <div className="border-2 border-slate-900 rounded-xl p-3.5 bg-slate-50">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      QUANTITÀ / COLLI / PEZZI
                    </span>
                    <span className="text-lg font-black font-mono text-slate-950 block mt-1">
                      {tag.quantityOrPieces ||
                        `${load.pallets.length} Bancali / ${load.items.reduce(
                          (acc, i) => acc + i.quantity,
                          0
                        )} pz`}
                    </span>
                  </div>

                  <div className="border-2 border-slate-900 rounded-xl p-3.5 bg-slate-50">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      REPARTO / TERZISTA DESTINATARIO
                    </span>
                    <span className="text-base font-extrabold text-slate-950 block mt-1 truncate">
                      {tag.supplierName || 'Reparto Verniciatura / Trattamenti'}
                    </span>
                  </div>
                </div>

                {/* 5. TABELLA ARTICOLI OPZIONALE */}
                {showItemsList && load.items.length > 0 && (
                  <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs">
                    <div className="bg-slate-900 text-white px-3 py-1.5 font-black uppercase text-[11px] flex justify-between">
                      <span>ELENCO MATERIALI / ARTICOLI IN LAVORAZIONE</span>
                      <span>{load.items.length} voci</span>
                    </div>
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 border-b border-slate-300 font-bold text-[10px] uppercase">
                        <tr>
                          <th className="py-1.5 px-3">Codice</th>
                          <th className="py-1.5 px-3">Descrizione</th>
                          <th className="py-1.5 px-3 text-right">Quantità</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {load.items.map((it) => (
                          <tr key={it.id}>
                            <td className="py-1 px-3 font-mono font-bold">{it.sku}</td>
                            <td className="py-1 px-3 font-semibold">{it.name}</td>
                            <td className="py-1 px-3 text-right font-mono font-bold">
                              {it.quantity} pz
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 6. NOTE OPERATIVE O SPAZIO PER ANNOTAZIONI A PENNA */}
                <div className="border-2 border-slate-900 rounded-xl p-4 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      ISTRUZIONI / NOTE PER LA VERNICIATURA O LAVORAZIONE:
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">
                      (Spazio compilabile anche a mano sul cartellino)
                    </span>
                  </div>

                  {tag.notes ? (
                    <div className="text-base sm:text-lg font-bold text-slate-950 whitespace-pre-wrap py-1">
                      {tag.notes}
                    </div>
                  ) : (
                    <div className="h-10 border-b border-dashed border-slate-400" />
                  )}
                </div>

                {/* 7. RIQUADRO CONVALIDA PARTENZA E RIENTRO */}
                {showSignatures && (
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t-2 border-slate-900 text-xs">
                    <div className="border border-slate-400 rounded-xl p-3 bg-slate-50 space-y-4">
                      <span className="font-extrabold text-slate-800 block uppercase text-[10px]">
                        1. Preparazione / Invio Materiale
                      </span>
                      <div className="h-6 border-b border-dashed border-slate-400" />
                      <span className="text-[10px] text-slate-500 block">
                        Firma operatore magazzino
                      </span>
                    </div>

                    <div className="border border-slate-400 rounded-xl p-3 bg-slate-50 space-y-4">
                      <span className="font-extrabold text-slate-800 block uppercase text-[10px]">
                        2. Esecuzione Trattamento / RAL
                      </span>
                      <div className="h-6 border-b border-dashed border-slate-400" />
                      <span className="text-[10px] text-slate-500 block">
                        Timbro / Visto Verniciatore
                      </span>
                    </div>

                    <div className="border border-slate-400 rounded-xl p-3 bg-slate-50 space-y-4">
                      <span className="font-extrabold text-slate-800 block uppercase text-[10px]">
                        3. Controllo Qualità al Rientro
                      </span>
                      <div className="h-6 border-b border-dashed border-slate-400" />
                      <span className="text-[10px] text-slate-500 block">
                        Esito controllo spessore/colore
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="no-print bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold">
            Suggerimento: puoi scegliere tra A4 Verticale, A4 Orizzontale, 2 Cartelli per foglio o 4 Etichette per foglio.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
          >
            Chiudi Anteprima
          </button>
        </div>
        </div>
      </div>
    </PrintPortal>
  );
};
