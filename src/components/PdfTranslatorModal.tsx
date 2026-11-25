import React, { useState, useRef } from 'react';
import {
  Languages,
  Upload,
  FileText,
  Printer,
  Copy,
  Check,
  RefreshCw,
  X,
  FileCheck2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Zap,
} from 'lucide-react';
import {
  translateLogisticsTextOffline,
  extractTextFromPdfArrayBuffer,
} from '../utils/logisticsTranslator';
import { authFetch } from '../utils/authSession';

interface PdfTranslatorModalProps {
  onClose: () => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'Inglese (English)', flag: '🇬🇧' },
  { code: 'de', name: 'Tedesco (Deutsch)', flag: '🇩🇪' },
  { code: 'fr', name: 'Francese (Français)', flag: '🇫🇷' },
  { code: 'es', name: 'Spagnolo (Español)', flag: '🇪🇸' },
  { code: 'pl', name: 'Polacco (Polski)', flag: '🇵🇱' },
  { code: 'ro', name: 'Rumeno (Română)', flag: '🇷🇴' },
  { code: 'pt', name: 'Portoghese (Português)', flag: '🇵🇹' },
  { code: 'zh', name: 'Cinese (中文)', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabo (العربية)', flag: '🇸🇦' },
];

export const PdfTranslatorModal: React.FC<PdfTranslatorModalProps> = ({ onClose }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('it');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [manualText, setManualText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translatedResult, setTranslatedResult] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<'ai' | 'offline' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setErrorMsg(null);
    setFile(uploadedFile);
    setFileName(uploadedFile.name);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract clean base64 data
      const base64Clean = result.includes(',') ? result.split(',')[1] : result;
      setFileBase64(base64Clean);
    };
    reader.onerror = () => {
      setErrorMsg('Errore nella lettura del file PDF.');
    };
    reader.readAsDataURL(uploadedFile);
  };

  const handleTranslate = async () => {
    if (!file && !fileBase64 && !manualText.trim()) {
      setErrorMsg('Carica un file PDF o inserisci del testo da tradurre.');
      return;
    }

    setIsTranslating(true);
    setErrorMsg(null);
    setTranslatedResult(null);
    setEngineUsed(null);

    let translationHandled = false;

    // 1. Se siamo in modalità Web online (non protocollo file:///), tentiamo l'elaborazione server con Gemini AI
    if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await authFetch('/api/translate-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            base64Data: fileBase64 || undefined,
            mimeType: file?.type || 'application/pdf',
            fileName: fileName || 'documento.pdf',
            text: !fileBase64 ? manualText.trim() : undefined,
            targetLanguage: selectedLanguage,
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.translatedContent) {
            setTranslatedResult(data.translatedContent);
            setEngineUsed('ai');
            translationHandled = true;
          }
        }
      } catch (cloudErr) {
        console.warn('Tentativo cloud non riuscito, passaggio automatico al motore offline:', cloudErr);
      }
    }

    // 2. Se siamo in modalità locale desktop (file:///) o se il server non è raggiungibile / offline:
    // Attiviamo IMMEDIATAMENTE il motore logistico deterministico locale (funziona al 100% senza server e senza rete!)
    if (!translationHandled) {
      try {
        let textToProcess = manualText.trim();

        // Se è stato caricato un file PDF e non è stato incollato testo manuale lungo, estraiamo il testo dal PDF
        if (file && (!textToProcess || textToProcess.length < 20)) {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const extracted = await extractTextFromPdfArrayBuffer(arrayBuffer);
            if (extracted && extracted.length > 10) {
              textToProcess = extracted;
            }
          } catch (extractErr) {
            console.warn('Estrazione testo PDF:', extractErr);
          }
        }

        if (!textToProcess) {
          setErrorMsg(
            'Il file PDF caricato sembra essere una scansione immagine bitmap (senza testo vettoriale). Incolla il testo della distinta o della bolla nel riquadro sottostante per tradurla all\'istante in qualsiasi lingua!'
          );
          setIsTranslating(false);
          return;
        }

        const offlineRes = translateLogisticsTextOffline(
          textToProcess,
          selectedLanguage,
          fileName || 'Documento di Spedizione'
        );

        setTranslatedResult(offlineRes.translatedText);
        setEngineUsed('offline');
      } catch (offlineErr: any) {
        console.error('Errore motore offline:', offlineErr);
        setErrorMsg(offlineErr.message || 'Errore durante l\'elaborazione del documento.');
      }
    }

    setIsTranslating(false);
  };

  const handleCopy = () => {
    if (!translatedResult) return;
    navigator.clipboard.writeText(translatedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printDocumentHtml = (content: string, langCode: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const safeText = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const isEnglish = langCode === 'en';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isEnglish ? 'Official International Translation (English) - CaricoStudio' : 'Traduzione Documento PDF - CaricoStudio'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 28px; color: #0f172a; line-height: 1.5; font-size: 13px; }
            h1, h2, h3 { color: #0f172a; border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-top: 18px; }
            table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 12px; }
            th, td { border: 1.5px solid #0f172a; padding: 6px 10px; text-align: left; }
            th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; }
            .header-meta { margin-bottom: 20px; font-size: 11px; color: #334155; font-family: monospace; border: 2px solid #0f172a; padding: 12px; border-radius: 6px; background: #f8fafc; }
            .badge-en { display: inline-block; background: #312e81; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-bottom: 4px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header-meta">
            ${isEnglish ? '<div class="badge-en">🇬🇧 OFFICIAL INTERNATIONAL TRANSLATION (ENGLISH)</div><br/>' : ''}
            <strong>CARICOSTUDIO — ${isEnglish ? 'OFFICIAL LOGISTICS & SHIPPING TRANSLATION' : 'TRADUZIONE UFFICIALE DOCUMENTO PDF / LOGISTICA'}</strong><br/>
            ${isEnglish ? 'Document' : 'Documento'}: ${fileName || (isEnglish ? 'Shipping List' : 'Distinta Merci')} &bull; ${isEnglish ? 'Target Language' : 'Lingua'}: ${SUPPORTED_LANGUAGES.find(l => l.code === langCode)?.name || langCode} &bull; ${isEnglish ? 'Issue Date' : 'Data'}: ${new Date().toLocaleDateString(isEnglish ? 'en-GB' : 'it-IT')} ${new Date().toLocaleTimeString(isEnglish ? 'en-GB' : 'it-IT')}
          </div>
          <div style="white-space: pre-wrap; font-family: inherit;">${safeText}</div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        iframe.remove();
      }, 1000);
    }, 250);
  };

  const handlePrintTranslation = () => {
    if (!translatedResult) return;
    printDocumentHtml(translatedResult, selectedLanguage);
  };

  const handlePrintInEnglishDirectly = async () => {
    setSelectedLanguage('en');
    let contentToPrint = translatedResult;

    // Se non è ancora stato tradotto o la lingua attuale non è inglese, traduci subito in inglese
    if (!contentToPrint || selectedLanguage !== 'en') {
      let textToProcess = manualText.trim();
      if (file && (!textToProcess || textToProcess.length < 20)) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const extracted = await extractTextFromPdfArrayBuffer(arrayBuffer);
          if (extracted && extracted.length > 10) {
            textToProcess = extracted;
          }
        } catch {
          // Ignore
        }
      }

      if (textToProcess) {
        const offlineRes = translateLogisticsTextOffline(
          textToProcess,
          'en',
          fileName || 'International Shipping Document'
        );
        contentToPrint = offlineRes.translatedText;
        setTranslatedResult(offlineRes.translatedText);
        setEngineUsed('offline');
      }
    }

    if (!contentToPrint) {
      setErrorMsg('Carica prima un file PDF o incolla del testo da convertire e stampare in inglese.');
      return;
    }

    printDocumentHtml(contentToPrint, 'en');
  };

  const handleDownloadTxt = () => {
    if (!translatedResult) return;
    const blob = new Blob([translatedResult], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Traduzione_${fileName ? fileName.replace(/\.[^/.]+$/, '') : 'documento'}_${selectedLanguage}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900">
        {/* Top Header */}
        <div className="border-b border-slate-200 bg-slate-50/90 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                Traduttore Documenti & PDF di Spedizione
              </h2>
              <p className="text-xs text-slate-500">
                Traduci bolle di consegna estere, packing list, DDT, CMR e schede tecniche internazionali con Gemini AI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Controls: Lingua & File Upload */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Lingua Target */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Traduci verso la Lingua:
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-600 cursor-pointer shadow-2xs"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 block">
                Mantiene codici SKU, pesi in kg, misure e formati intatti.
              </span>
            </div>

            {/* File Upload PDF */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Documento PDF da Tradurre:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-4 h-4" />
                  Scegli File PDF dal PC
                </button>
                {fileName ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-800">
                    <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate max-w-[240px] font-bold">{fileName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFileName('');
                        setFileBase64(null);
                      }}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Oppure scrivi/incolla il testo qui sotto
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Testo alternativo manuale */}
          {!fileName && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Oppure Incolla Testo del Documento / Packing List:
              </label>
              <textarea
                rows={3}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Incolla qui la distinta merci, bolla estera o testo da tradurre..."
                className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>
          )}

          {/* Azione di Traduzione */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isTranslating || (!fileBase64 && !manualText.trim())}
                onClick={handleTranslate}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isTranslating ? 'animate-spin' : ''}`} />
                {isTranslating ? 'Traduzione in corso...' : 'Avvia Traduzione Documento'}
              </button>

              <button
                type="button"
                disabled={isTranslating || (!fileBase64 && !manualText.trim())}
                onClick={handlePrintInEnglishDirectly}
                className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer border border-blue-900"
                title="Converte il file PDF o il testo direttamente in lingua inglese per export/dogana e apre la stampa"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                🇬🇧 Converti & Stampa in Inglese
              </button>
            </div>

            {translatedResult && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  {copied ? 'Copiato!' : 'Copia'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTxt}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Salva File
                </button>
                <button
                  type="button"
                  onClick={handlePrintTranslation}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-400" />
                  Stampa Traduzione
                </button>
                <button
                  type="button"
                  onClick={handlePrintInEnglishDirectly}
                  className="px-3 py-1.5 text-xs font-extrabold text-white bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs border border-blue-900"
                  title="Stampa documento ufficiale in inglese per dogana ed esportazione"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-300" />
                  🇬🇧 Stampa in Inglese (Export)
                </button>
              </div>
            )}
          </div>

          {/* Messaggi di Errore */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Risultato della Traduzione */}
          {translatedResult && (
            <div className="border-2 border-indigo-200 rounded-2xl bg-white p-5 space-y-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between border-b border-indigo-100 pb-2 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Documento Tradotto ({SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}):
                  </span>
                  {engineUsed === 'offline' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                      <Zap className="w-3 h-3 text-emerald-600" /> Motore Locale Offline (100% Affidabile)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ✨ Gemini AI Cloud
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Pronto per stampa e condivisione
                </span>
              </div>
              <div className="prose max-w-none text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap bg-slate-50/70 p-4 rounded-xl border border-slate-200 max-h-[48vh] overflow-y-auto">
                {translatedResult}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-3.5 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-500 font-mono">
            Supporta PDF, packing list e bolle in qualsiasi lingua estera
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
