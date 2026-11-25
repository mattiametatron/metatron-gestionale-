import React, { useState } from 'react';
import {
  Monitor,
  Download,
  CheckCircle2,
  X,
  Sparkles,
  Laptop,
  FolderDown,
  ShieldCheck,
  RefreshCw,
  Wifi,
  Share2,
  Copy,
  ExternalLink,
  Smartphone,
  Tablet,
  Check,
  Radio,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface NetworkSyncPwaModalProps {
  onClose: () => void;
  onSaveCurrentCommessa: () => void;
  connectedDevicesCount: number;
  isRealtimeConnected: boolean;
  lastSyncTime: Date;
  onForceReload: () => void;
}

export const NetworkSyncPwaModal: React.FC<NetworkSyncPwaModalProps> = ({
  onClose,
  onSaveCurrentCommessa,
  connectedDevicesCount,
  isRealtimeConnected,
  lastSyncTime,
  onForceReload,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [copiedLink, setCopiedLink] = useState(false);
  const [installSuccessNotice, setInstallSuccessNotice] = useState<string | null>(null);

  const currentUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://ais-pre-junosxdkix6up54egjy3o6-613128675389.europe-west2.run.app';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setInstallSuccessNotice(
          'App CaricoStudio installata con successo su Google Chrome! Trovi l\'icona sul tuo Desktop e nella barra delle applicazioni.'
        );
      }
    } else {
      // Open in a standalone new Chrome window so Chrome's native address-bar install icon is highlighted
      window.open(currentUrl, '_blank');
    }
  };

  const handleOpenFullscreenTab = () => {
    window.open(currentUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-blue-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white">
                  Trasforma CaricoStudio in App Chrome & Rete Locale
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  PWA + Multi-Device Sync
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Aggiornamenti automatici senza scaricare file continui • Sincronizzazione in tempo reale su tutti i dispositivi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {installSuccessNotice && (
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 text-xs font-bold flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span>{installSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setInstallSuccessNotice(null)}
                className="px-3 py-1.5 rounded-lg bg-emerald-200 text-emerald-900 hover:bg-emerald-300 text-xs cursor-pointer shrink-0"
              >
                Chiudi
              </button>
            </div>
          )}

          {/* SEZIONE 1: TRASFORMA IN APP CHROME (PWA) */}
          <div className="border-2 border-blue-600/70 rounded-2xl p-5 bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black uppercase tracking-wider shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" /> 1. App Web Google Chrome
                </span>
                {isInstalled && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Già installata come App
                  </span>
                )}
              </div>
              <span className="text-[11px] font-semibold text-blue-900 bg-blue-100/80 px-2.5 py-0.5 rounded-md">
                Niente file .html da scaricare continuamente
              </span>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900">
                Installazione diretta su Google Chrome (Windows, Mac, Android)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Trasforma il sito web in una <strong>vera applicazione autonoma con icona sul Desktop</strong> e nella barra delle applicazioni. Non dovrai più riscaricare file: ogni nuova funzione o modifica si <strong>aggiorna automaticamente all&apos;avvio</strong>.
              </p>
            </div>

            {/* Quick Action Button for Direct Install */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isInstallable ? (
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-blue-600/25 transition-all cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  Installa CaricoStudio con Google Chrome
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenFullscreenTab}
                  className="py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-blue-600/25 transition-all cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Apri Scheda Chrome per Installare l&apos;App
                </button>
              )}

              <button
                type="button"
                onClick={onForceReload}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300 transition-all cursor-pointer"
                title="Svuota cache locale e forza l'aggiornamento immediato"
              >
                <RefreshCw className="w-4 h-4 text-slate-600" />
                Aggiorna &amp; Ricarica Versione
              </button>
            </div>

            {/* Guida visiva Chrome */}
            <div className="bg-white p-4 rounded-xl border border-blue-200 text-xs space-y-2 text-slate-700">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Come installare da Google Chrome in 2 clic:
              </div>
              <ul className="space-y-1.5 pl-1">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    In alto a destra nella barra dell&apos;indirizzo di <strong>Google Chrome</strong> cerca l&apos;icona di installazione (icona computer con freccia in basso <strong>⬇️ Installa CaricoStudio</strong>).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    <em>In alternativa:</em> Clicca sui <strong>tre puntini verticali (⋮)</strong> in alto a destra in Chrome ➔ seleziona <strong>&quot;Salva e condividi&quot;</strong> ➔ clicca <strong>&quot;Installa CaricoStudio come App...&quot;</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Clicca <strong>&quot;Installa&quot;</strong>. L&apos;app si aprirà in una finestra pulita senza barre del browser e sarà sempre collegata in tempo reale con tutti gli altri dispositivi!
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* SEZIONE 2: RETE LOCALE & AGGIORNAMENTI MULTI-DISPOSITIVO IN TEMPO REALE */}
          <div className="border-2 border-emerald-600/70 rounded-2xl p-5 bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-white shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider shadow-xs">
                <Wifi className="w-3.5 h-3.5 text-white" /> 2. Rete Locale &amp; Multi-Dispositivo
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full h-2.5 w-2.5 ${
                    isRealtimeConnected ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="text-xs font-mono font-bold text-slate-800">
                  {isRealtimeConnected
                    ? `${connectedDevicesCount} dispositivo/i connesso/i`
                    : 'Tentativo di connessione in corso...'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-black text-slate-900">
                Tutti i PC, Tablet e Smartphone sulla stessa rete lavorano insieme
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Qualsiasi collega o magazziniere connesso alla stessa rete Wi-Fi o aziendale può aprire il gestionale. Quando chiunque <strong>spunta un articolo, aggiunge un bancale o inserisce una firma</strong>, la modifica appare <strong>immediatamente su tutti gli schermi in tempo reale</strong>, senza dover ricaricare o inviare file!
              </p>
            </div>

            {/* Link di Condivisione Rete Locale */}
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2.5">
              <span className="text-xs font-extrabold text-slate-800 block">
                Indirizzo Web per gli altri dispositivi nella stessa rete:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={currentUrl}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copia Link
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Invia o incolla questo link sui computer dei colleghi o aprilo dallo smartphone/tablet per collaborare in diretta alla stessa commessa.
              </p>
            </div>

            {/* Card Dispositivi Supportati */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs">
                <Laptop className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">PC Ufficio</span>
                  <span className="text-[11px] text-slate-500">Pianifica carichi e distinte</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs">
                <Tablet className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Tablet Magazzino</span>
                  <span className="text-[11px] text-slate-500">Spunta rapida e CAD 3D</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-2xs">
                <Smartphone className="w-5 h-5 text-indigo-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">Smartphone / Autista</span>
                  <span className="text-[11px] text-slate-500">Firme digitali e controllo</span>
                </div>
              </div>
            </div>
          </div>

          {/* SEZIONE 3: SALVATAGGIO DI SICUREZZA IN CARTELLA */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2.5">
              <FolderDown className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block">
                  Archivio Storico Commesse sul PC
                </span>
                <span className="text-[11px] text-slate-500">
                  Vuoi conservare una copia di sicurezza di questa commessa in una cartella del tuo computer?
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSaveCurrentCommessa}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors shadow-2xs"
            >
              <FolderDown className="w-3.5 h-3.5" />
              Salva Commessa in Cartella
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ultima sincronizzazione: {lastSyncTime.toLocaleTimeString()}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer transition-colors"
          >
            Chiudi e Torna al Gestionale
          </button>
        </div>
      </div>
    </div>
  );
};
