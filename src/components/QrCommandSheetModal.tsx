import React, { useEffect, useState } from 'react';
import { Download, QrCode, ScanBarcode, X } from 'lucide-react';
import {
  CommandSheetFormat,
  downloadQrCommandSheetPdf,
  generateBarcode1DDataUrl,
  generateQrDataUrl,
  METATRON_QR_COMMANDS,
  QrCommandDefinition,
} from '../utils/qrCommandSheet';
import { usePrintLanguage } from '../utils/printLanguage';
import { PrintLanguageSelector } from './PrintLanguageSelector';

interface QrCommandSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FORMAT_STORAGE_KEY = 'metatron_cmd_sheet_format_v1';

function loadSavedFormat(): CommandSheetFormat {
  try {
    const v = localStorage.getItem(FORMAT_STORAGE_KEY);
    if (v === 'barcode1d' || v === 'both' || v === 'qr2d') return v;
  } catch {
    // ignore
  }
  return 'barcode1d';
}

export const QrCommandSheetModal: React.FC<QrCommandSheetModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<CommandSheetFormat>(() => loadSavedFormat());
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [barcodeUrls, setBarcodeUrls] = useState<Record<string, string>>({});
  const [downloading, setDownloading] = useState(false);
  const [printLang, setPrintLang] = usePrintLanguage();

  const handleSelectFormat = (next: CommandSheetFormat) => {
    setFormat(next);
    try {
      localStorage.setItem(FORMAT_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    (async () => {
      const nextQr: Record<string, string> = {};
      const nextBc: Record<string, string> = {};
      for (const cmd of METATRON_QR_COMMANDS) {
        nextQr[cmd.code] = await generateQrDataUrl(cmd.code, 220);
        nextBc[cmd.code] = generateBarcode1DDataUrl(cmd.code, {
          barWidth: 2.5,
          height: 84,
          margin: 14,
        });
      }
      if (active) {
        setQrUrls(nextQr);
        setBarcodeUrls(nextBc);
      }
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
      await downloadQrCommandSheetPdf(printLang, format);
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
              {format === 'qr2d' ? (
                <QrCode className="w-5 h-5" />
              ) : (
                <ScanBarcode className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3
                id="qr-sheet-modal-title"
                className="text-sm font-bold text-slate-900 truncate"
              >
                Plancia Comandi Rapidi da Banco (Barcode 1D &amp; QR)
              </h3>
              <p className="text-xs text-slate-500">
                Stampa su foglio A4 e incolla sul banco: compatibile con qualsiasi pistola laser 1D a strisce e 2D.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <PrintLanguageSelector
              value={printLang}
              onChange={setPrintLang}
              isTranslating={downloading}
              variant="light"
              label="Lingua"
            />
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadPdf}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap transition-colors"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>
                {downloading
                  ? 'Creazione PDF...'
                  : format === 'barcode1d'
                  ? 'Scarica PDF A4 Barcode 1D'
                  : format === 'both'
                  ? 'Scarica PDF A4 (1D + QR)'
                  : 'Scarica PDF A4 QR'}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              aria-label="Chiudi plancia comandi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selettore Formato Pistola (1D Laser / Entrambi / QR 2D) */}
        <div className="px-5 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleSelectFormat('barcode1d')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                format === 'barcode1d'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ScanBarcode className="w-3.5 h-3.5" />
              <span>Barcode 1D (Pistola Laser)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectFormat('both')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                format === 'both'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrambi (1D + QR)
            </button>
            <button
              type="button"
              onClick={() => handleSelectFormat('qr2d')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                format === 'qr2d'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Solo QR 2D</span>
            </button>
          </div>

          <span className="font-mono text-[11px] text-slate-500">
            Standard CODE 128 · Tastiera IT / US
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Sequenza a mani libere:</strong> 1) Spara il codice articolo (anche più volte) · 2) Spara <strong>CARICO</strong> / <strong>SCARICO</strong> o una quantità (es. <strong>×10</strong>) · 3) Spara <strong>CONFERMA</strong>.
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
                  <div className="p-3.5 space-y-2.5">
                    {format === 'barcode1d' && (
                      <>
                        <div className="w-full h-20 rounded-lg border border-slate-200 bg-white px-2 py-1 flex items-center justify-center">
                          {barcodeUrls[cmd.code] ? (
                            <img
                              src={barcodeUrls[cmd.code]}
                              alt={`Barcode 1D ${cmd.title}`}
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            <ScanBarcode className="w-8 h-8 text-slate-300" />
                          )}
                        </div>
                        <div className="text-xs font-semibold text-slate-800 text-center">
                          {cmd.subtitle}
                        </div>
                      </>
                    )}

                    {format === 'both' && (
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-20 rounded-lg border border-slate-200 bg-white p-1 shrink-0 flex items-center justify-center">
                          {qrUrls[cmd.code] ? (
                            <img
                              src={qrUrls[cmd.code]}
                              alt={`QR ${cmd.title}`}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <QrCode className="w-7 h-7 text-slate-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="w-full h-16 rounded-lg border border-slate-200 bg-white px-1.5 py-1 flex items-center justify-center">
                            {barcodeUrls[cmd.code] && (
                              <img
                                src={barcodeUrls[cmd.code]}
                                alt={`Barcode 1D ${cmd.title}`}
                                className="max-w-full max-h-full object-contain"
                              />
                            )}
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 truncate">
                            {cmd.subtitle}
                          </div>
                        </div>
                      </div>
                    )}

                    {format === 'qr2d' && (
                      <div className="flex items-center gap-4">
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
                    )}
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

            {format === 'qr2d' ? (
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
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {qtyCommands.map((cmd) => (
                  <div
                    key={cmd.code}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden flex items-stretch"
                  >
                    <div className="w-24 bg-slate-900 text-white px-2 py-3 flex flex-col items-center justify-center shrink-0">
                      <div className="text-base font-bold font-mono tabular-nums">
                        {cmd.title}
                      </div>
                      <div className="text-[10px] font-mono text-slate-300 mt-0.5">
                        {cmd.code}
                      </div>
                    </div>
                    <div className="flex-1 p-2.5 flex items-center justify-center gap-2 bg-white min-w-0">
                      {format === 'both' && qrUrls[cmd.code] && (
                        <img
                          src={qrUrls[cmd.code]}
                          alt={`QR ${cmd.title}`}
                          className="w-16 h-16 object-contain shrink-0"
                        />
                      )}
                      {barcodeUrls[cmd.code] ? (
                        <img
                          src={barcodeUrls[cmd.code]}
                          alt={`Barcode 1D ${cmd.title}`}
                          className="h-16 max-w-full object-contain"
                        />
                      ) : (
                        <ScanBarcode className="w-7 h-7 text-slate-300" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
