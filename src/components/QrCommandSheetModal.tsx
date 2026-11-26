import React, { useEffect, useState } from 'react';
import { Download, QrCode, X } from 'lucide-react';
import {
  downloadQrCommandSheetPdf,
  generateQrDataUrl,
  METATRON_QR_COMMANDS,
  QrCommandDefinition,
} from '../utils/qrCommandSheet';

interface QrCommandSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrCommandSheetModal: React.FC<QrCommandSheetModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const cmd of METATRON_QR_COMMANDS) {
        next[cmd.code] = await generateQrDataUrl(cmd.code, 220);
      }
      if (active) setQrUrls(next);
    })();
    return () => {
      active = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const primaryCommands = METATRON_QR_COMMANDS.filter(
    (c) => c.group === 'azione' || c.group === 'conferma'
  );
  const qtyCommands = METATRON_QR_COMMANDS.filter((c) => c.group === 'quantita');

  const headerTone: Record<QrCommandDefinition['tone'], string> = {
    emerald: 'bg-emerald-600 text-white',
    rose: 'bg-rose-600 text-white',
    amber: 'bg-amber-500 text-slate-950',
    slate: 'bg-slate-900 text-white',
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadQrCommandSheetPdf();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-sheet-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="qr-sheet-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
                Plancia QR Comandi Rapidi da Banco
              </h3>
              <p className="text-xs text-slate-500">
                Stampa su foglio A4 e attacca al banco: spari l&apos;articolo, spari quantità o carico/scarico, poi spari CONFERMA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>{downloading ? 'Creazione PDF...' : 'Scarica PDF A4 da Stampare'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Chiudi plancia QR"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Sequenza consigliata a mani libere:</strong> 1) Spara il codice articolo (anche più volte) · 2) Spara <strong>CARICO</strong> / <strong>SCARICO</strong> o una quantità (es. <strong>×10</strong>) · 3) Spara <strong>CONFERMA</strong>.
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Compatibile tastiera IT / US
            </span>
          </div>

          {/* 4 Comandi Principali */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2.5">
              Comandi Principali (Azione &amp; Conferma)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {primaryCommands.map((cmd) => (
                <div
                  key={cmd.code}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
                >
                  <div
                    className={`px-3.5 py-2 text-xs font-bold flex items-center justify-between ${headerTone[cmd.tone]}`}
                  >
                    <span>{cmd.title}</span>
                    <span className="font-mono text-[11px] opacity-85">{cmd.code}</span>
                  </div>
                  <div className="p-3.5 flex items-center gap-4">
                    <div className="w-24 h-24 rounded-lg border border-slate-200 bg-white p-1 shrink-0 flex items-center justify-center">
                      {qrUrls[cmd.code] ? (
                        <img
                          src={qrUrls[cmd.code]}
                          alt={`QR ${cmd.title}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {cmd.subtitle}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {cmd.code === 'MTCONFERMA'
                          ? 'Registra tutti gli articoli in coda e azzera pronto al prossimo.'
                          : cmd.code === 'MTANNULLA'
                          ? 'Svuota la coda in corso oppure annulla l\'ultimo movimento salvato.'
                          : 'Cambia la direzione senza perdere gli articoli già sparati.'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 8 Comandi Quantità */}
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2.5">
              Quantità &amp; Moltiplicatori Rapidi
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {qtyCommands.map((cmd) => (
                <div
                  key={cmd.code}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden text-center"
                >
                  <div className="bg-slate-900 text-white py-1.5 text-sm font-bold font-mono tabular-nums">
                    {cmd.title}
                  </div>
                  <div className="p-3 flex flex-col items-center gap-1.5">
                    <div className="w-24 h-24 rounded-lg border border-slate-100 p-1 flex items-center justify-center">
                      {qrUrls[cmd.code] ? (
                        <img
                          src={qrUrls[cmd.code]}
                          alt={`QR ${cmd.title}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-8 h-8 text-slate-300" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono font-semibold text-slate-500">
                      {cmd.code}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
