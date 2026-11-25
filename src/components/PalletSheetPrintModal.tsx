import React, { useState } from 'react';
import {
  Printer,
  X,
  Scale,
  CheckCircle2,
  Package,
  Layers,
  Truck,
  Building2,
  Calendar,
  ExternalLink,
  Download,
  Info,
} from 'lucide-react';
import { CargoLoad } from '../types/warehouse';
import { PalletSummary } from '../utils/calculations';
import { PrintPortal } from './PrintPortal';
import {
  generatePalletSheetsPDF,
  openPdfBlobInNewTab,
} from '../utils/pdfGenerator';

interface PalletSheetPrintModalProps {
  load: CargoLoad;
  palletSummaries: PalletSummary[];
  initialPalletId?: string | 'all';
  onClose: () => void;
}

export const PalletSheetPrintModal: React.FC<PalletSheetPrintModalProps> = ({
  load,
  palletSummaries,
  initialPalletId = 'all',
  onClose,
}) => {
  const [selectedPalletId, setSelectedPalletId] = useState<string>(initialPalletId);

  const displayedSummaries =
    selectedPalletId === 'all'
      ? palletSummaries
      : palletSummaries.filter((ps) => ps.pallet.id === selectedPalletId);

  const handlePrint = () => {
    window.print();
  };

  const handleOpenPdfForPrint = () => {
    const doc = generatePalletSheetsPDF(load, displayedSummaries);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    openPdfBlobInNewTab(url);
  };

  const handleDownloadPdf = () => {
    const doc = generatePalletSheetsPDF(load, displayedSummaries);
    const cleanCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Schede_Bancali_${cleanCode}.pdf`);
  };

  return (
    <PrintPortal>
      <div className="print-modal-container fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        {/* Modal Container */}
        <div className="print-canvas-wrapper bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden text-slate-900">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="no-print bg-slate-900 text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  Stampa Foglio Bancale con Peso in Grande
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Formato A4 per Imballo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Scheda collo da incollare o inserire nella tasca trasparente del bancale filmato
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selettore Bancale Singolo o Tutti */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
              <span className="text-xs text-slate-300 font-semibold">Stampa:</span>
              <select
                value={selectedPalletId}
                onChange={(e) => setSelectedPalletId(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Tutti i Bancali ({palletSummaries.length} fogli)</option>
                {palletSummaries.map((ps, idx) => (
                  <option key={ps.pallet.id} value={ps.pallet.id}>
                    Bancale #{idx + 1} - {ps.pallet.code} ({ps.grossWeightKg.toFixed(1)} kg)
                  </option>
                ))}
              </select>
            </div>

            {/* Pulsante Apri PDF fuori dall'iframe */}
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
              <Download className="w-4 h-4 text-blue-300" />
              <span>Scarica PDF</span>
            </button>

            {/* Pulsante Stampa Browser */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer transition-all"
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

        {/* Avviso Stampanti Fisiche (hidden in print) */}
        <div className="no-print bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-2 text-[11px] text-amber-950 shrink-0">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Non vedi la tua stampante?</strong> Se usi l&apos;anteprima integrata, il browser potrebbe nascondere le stampanti fisiche. Clicca{' '}
            <strong>Apri PDF (Vedi Stampanti)</strong> per aprire il foglio in una nuova scheda esterna (oppure in Chrome clicca{' '}
            <strong>Destinazione &rarr; Vedi altro...</strong>).
          </span>
        </div>

        {/* Modal Printable Content Area */}
        <div className="print-canvas-wrapper flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/80 space-y-8">
          {displayedSummaries.map((ps, idx) => {
            const palletNumber =
              palletSummaries.findIndex((p) => p.pallet.id === ps.pallet.id) + 1;
            const totalPallets = palletSummaries.length;

            return (
              <div
                key={ps.pallet.id}
                className="pallet-sheet bg-white border-2 border-slate-900 rounded-2xl p-6 sm:p-10 shadow-lg text-slate-950 max-w-4xl mx-auto space-y-6"
                style={{
                  pageBreakAfter: idx < displayedSummaries.length - 1 ? 'always' : 'auto',
                  breakAfter: idx < displayedSummaries.length - 1 ? 'page' : 'auto',
                }}
              >
                {/* 1. Header Aziendale e Commessa */}
                <div className="border-b-4 border-slate-950 pb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
                        CARICOSTUDIO
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-slate-900 text-white">
                        SCHEDA COLLO BANCALE
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wide">
                      DOCUMENTO UFFICIALE DI IDENTIFICAZIONE E PESO SPEDIZIONE
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <div className="text-xs font-extrabold text-slate-500 uppercase">
                      COMMESSA SPEDIZIONE
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
                      {load.code}
                    </div>
                    <div className="text-xs font-semibold text-slate-600 mt-0.5">
                      Data Spedizione: {load.departureDate || new Date().toISOString().slice(0, 10)}
                    </div>
                  </div>
                </div>

                {/* 2. Riquadro Identificazione Bancale */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border-2 border-slate-300">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      IDENTIFICATIVO BANCALE
                    </span>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-4xl sm:text-5xl font-black font-mono text-slate-950">
                        {ps.pallet.code}
                      </span>
                      <span className="text-lg sm:text-xl font-extrabold text-slate-700">
                        (Bancale {palletNumber} di {totalPallets})
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-600 mt-1">
                      {ps.pallet.label || 'Bancale Standard'} • Piazzola Carico Mezzo: #{ps.pallet.truckSlot ?? palletNumber}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-medium">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Tipologia &amp; Dimensioni
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm font-mono block mt-0.5">
                        {ps.pallet.dimensionsCm}
                      </span>
                      <span className="text-[11px] text-slate-600 block mt-0.5">
                        Altezza: {ps.pallet.heightCm} cm
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Tara Bancale Vuoto
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm font-mono block mt-0.5">
                        {ps.pallet.tareKg} kg
                      </span>
                      <span className="text-[11px] text-slate-600 block mt-0.5">
                        {ps.pallet.wrapped ? 'Filmato con cellophane' : 'Da filmare'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 🌟 3. BOX PRINCIPALE: PESO LORDO EFFETTIVO SCRITTO IN GIGANTE 🌟 */}
                <div className="border-4 border-slate-950 rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-white to-slate-50 text-center shadow-xs">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Scale className="w-7 h-7 text-slate-900" />
                    <span className="text-base sm:text-lg font-black tracking-widest uppercase text-slate-900">
                      PESO LORDO EFFETTIVO BANCALE
                    </span>
                  </div>

                  {/* PESO IN GRANDE */}
                  <div className="text-7xl sm:text-8xl md:text-9xl font-black font-mono tracking-tight text-slate-950 my-2 select-all leading-none py-1">
                    {ps.grossWeightKg.toFixed(1)} <span className="text-4xl sm:text-6xl font-extrabold">KG</span>
                  </div>

                  {/* Dettagli Tara e Merce */}
                  <div className="flex flex-wrap items-center justify-center gap-4 text-xs sm:text-sm font-bold text-slate-700 mt-3 pt-3 border-t-2 border-slate-300">
                    <span className="bg-slate-200/80 px-3 py-1 rounded-full">
                      Tara Legno Bancale: <strong className="text-slate-950 font-mono">{ps.pallet.tareKg} kg</strong>
                    </span>
                    <span className="bg-slate-200/80 px-3 py-1 rounded-full">
                      Merce Netta Colli: <strong className="text-slate-950 font-mono">{ps.netWeightKg.toFixed(1)} kg</strong>
                    </span>
                    {ps.hasCustomWeight ? (
                      <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-full">
                        ✓ Rilevato su bilancia magazzino
                      </span>
                    ) : (
                      <span className="bg-blue-100 text-blue-900 border border-blue-300 px-3 py-1 rounded-full">
                        ✓ Calcolato da somma colli
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. Dati Destinatario e Spedizione */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs border-y-2 border-slate-300 py-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Cliente / Destinatario
                    </span>
                    <span className="text-base font-extrabold text-slate-950 block mt-0.5">
                      {load.client || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Destinazione Consegna
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">
                      {load.destination || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Vettore Incaricato
                    </span>
                    <span className="text-sm font-bold text-slate-900 block mt-0.5">
                      {load.carrier || '—'}
                    </span>
                  </div>
                </div>

                {/* 5. Riepilogo Colli e Contenuto sul Bancale */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>
                      CONTENUTO BANCALE: {ps.totalBoxes} SCATOLE / COLLI ({ps.totalItemsCount} ARTICOLI)
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Spunta: {ps.checkedItemsCount}/{ps.totalItemsCount} ({ps.completionPercent}%)
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 font-extrabold text-slate-800 border-b border-slate-300 text-[11px]">
                        <tr>
                          <th className="py-1.5 px-3">Collo / Scatola</th>
                          <th className="py-1.5 px-3">Cod. Articolo</th>
                          <th className="py-1.5 px-3">Descrizione Materiale</th>
                          <th className="py-1.5 px-3 text-right">Q.tà</th>
                          <th className="py-1.5 px-3 text-right">Peso Netto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {/* Materiale nelle scatole */}
                        {ps.boxes.flatMap((bs) =>
                          bs.items.map((it) => (
                            <tr key={`${bs.box.id}-${it.id}`} className="hover:bg-slate-50">
                              <td className="py-1.5 px-3 font-mono font-bold text-slate-900">
                                {bs.box.code}
                              </td>
                              <td className="py-1.5 px-3 font-mono font-bold text-slate-800">
                                {it.sku}
                              </td>
                              <td className="py-1.5 px-3 text-slate-800">{it.name}</td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold">
                                {it.quantity} pz
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono">
                                {(it.quantity * it.unitWeightKg).toFixed(1)} kg
                              </td>
                            </tr>
                          ))
                        )}

                        {/* Materiale fuori scatola */}
                        {ps.looseItems.map((it) => (
                          <tr key={`loose-${it.id}`} className="hover:bg-slate-50 bg-amber-50/50">
                            <td className="py-1.5 px-3 font-mono font-bold text-amber-900">
                              FUORI SCATOLA
                            </td>
                            <td className="py-1.5 px-3 font-mono font-bold text-slate-800">
                              {it.sku}
                            </td>
                            <td className="py-1.5 px-3 text-slate-800">{it.name}</td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold">
                              {it.quantity} pz
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono">
                              {(it.quantity * it.unitWeightKg).toFixed(1)} kg
                            </td>
                          </tr>
                        ))}

                        {ps.totalItemsCount === 0 && (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-slate-400 italic">
                              Nessun materiale ancora assegnato a questo bancale
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 6. Riquadro Firme e Convalida Pesatura */}
                <div className="grid grid-cols-3 gap-4 pt-3 border-t-2 border-slate-900 text-xs">
                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 space-y-4">
                    <span className="font-extrabold text-slate-700 block uppercase text-[10px]">
                      1. Operatore Pesa / Magazzino
                    </span>
                    <div className="h-6 border-b border-dashed border-slate-400" />
                    <span className="text-[10px] text-slate-500 block">Firma operatore</span>
                  </div>

                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 space-y-4">
                    <span className="font-extrabold text-slate-700 block uppercase text-[10px]">
                      2. Data e Ora Pesatura
                    </span>
                    <div className="h-6 border-b border-dashed border-slate-400 flex items-center justify-center font-mono text-xs font-bold text-slate-800">
                      {new Date().toLocaleDateString('it-IT')}
                    </div>
                    <span className="text-[10px] text-slate-500 block">Ora e convalida</span>
                  </div>

                  <div className="border border-slate-300 rounded-xl p-3 bg-slate-50 space-y-4">
                    <span className="font-extrabold text-slate-700 block uppercase text-[10px]">
                      3. Visto Spedizioniere / Autista
                    </span>
                    <div className="h-6 border-b border-dashed border-slate-400" />
                    <span className="text-[10px] text-slate-500 block">Firma per ricezione collo</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="no-print bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-600">
          <span className="font-semibold">
            Suggerimento: nella finestra di stampa del browser seleziona &quot;Salva come PDF&quot; oppure la tua stampante A4.
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
