import React, { useState } from 'react';
import {
  Monitor,
  Download,
  CheckCircle2,
  X,
  HardDrive,
  Sparkles,
  Laptop,
  FolderDown,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface WindowsDesktopInstallerModalProps {
  onClose: () => void;
  onSaveCurrentCommessa: () => void;
}

export const WindowsDesktopInstallerModal: React.FC<
  WindowsDesktopInstallerModalProps
> = ({ onClose, onSaveCurrentCommessa }) => {
  const [downloadedNotice, setDownloadedNotice] = useState<string | null>(null);
  const [isGeneratingStandalone, setIsGeneratingStandalone] = useState(false);

  const triggerDownloadBlob = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Scarica il Software Completo Autonomo (non richiede alcun server o internet!)
  const handleDownloadStandaloneWindowsSoftware = async () => {
    setIsGeneratingStandalone(true);
    try {
      const fetchUrl =
        typeof window !== 'undefined' && window.location.protocol === 'file:'
          ? 'https://ais-pre-junosxdkix6up54egjy3o6-613128675389.europe-west2.run.app/CaricoStudio_Desktop_Windows.html?v=' +
            Date.now()
          : `/CaricoStudio_Desktop_Windows.html?v=${Date.now()}`;

      const response = await fetch(fetchUrl, {
        cache: 'no-store',
      });
      if (response.ok) {
        const htmlText = await response.text();
        // Iniettiamo anche lo stato attuale delle commesse dell'utente dentro il programma scaricato,
        // così quando lo apre sul PC ritrova già tutti i suoi bancali, scatole e commesse!
        const currentLoadsJson =
          localStorage.getItem('caricostudio_loads_v5_win11') || '';
        let finalHtml = htmlText;
        if (currentLoadsJson) {
          const preloadScript = `<script>try{if(!localStorage.getItem('caricostudio_loads_v5_win11')){localStorage.setItem('caricostudio_loads_v5_win11', ${JSON.stringify(
            currentLoadsJson
          )});}}catch(e){}</script>`;
          finalHtml = htmlText.replace('<head>', () => `<head>${preloadScript}`);
        }
        const blob = new Blob([finalHtml], {
          type: 'text/html;charset=utf-8',
        });
        triggerDownloadBlob('CaricoStudio_Desktop_Windows.html', blob);
        setDownloadedNotice(
          'Programma "CaricoStudio_Desktop_Windows.html" scaricato! Fai doppio clic sul file scaricato per aprirlo sul tuo PC Windows (non serve internet né server).'
        );
      }
    } catch {
      // Fallback
    } finally {
      setIsGeneratingStandalone(false);
    }
  };

  const handleForceReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  // Scarica l'Avviatore Finestra Nativa Windows 11 (.bat) che apre sempre l'ultima versione del programma senza barre
  const handleDownloadLocalWindowLauncher = () => {
    const batContent = [
      '@echo off',
      'title CaricoStudio - Gestionale Magazzino Windows',
      'setlocal enabledelayedexpansion',
      '',
      'echo ========================================================',
      'echo       CaricoStudio - Avvio Software Windows 11',
      'echo ========================================================',
      'echo.',
      '',
      'set "TARGET_FILE="',
      '',
      'REM 1. Cerca il file scaricato piu recente nella cartella Downloads (rileva anche file rinumerati tipo (7) o (8))',
      'for /f "delims=" %%F in (\'dir /b /a:-d /o:d /t:w "%USERPROFILE%\\Downloads\\CaricoStudio_Desktop_Windows*.html" 2^^>nul\') do (',
      '    set "TARGET_FILE=%USERPROFILE%\\Downloads\\%%F"',
      ')',
      '',
      'REM 2. Se non presente in Downloads, cerca il file piu recente nella cartella di questo .bat',
      'if not defined TARGET_FILE (',
      '    for /f "delims=" %%F in (\'dir /b /a:-d /o:d /t:w "%~dp0CaricoStudio_Desktop_Windows*.html" 2^^>nul\') do (',
      '        set "TARGET_FILE=%~dp0%%F"',
      '    )',
      ')',
      '',
      'REM 3. Se ancora non trovato, cerca sul Desktop dell\'utente',
      'if not defined TARGET_FILE (',
      '    for /f "delims=" %%F in (\'dir /b /a:-d /o:d /t:w "%USERPROFILE%\\Desktop\\CaricoStudio_Desktop_Windows*.html" 2^^>nul\') do (',
      '        set "TARGET_FILE=%USERPROFILE%\\Desktop\\%%F"',
      '    )',
      ')',
      '',
      'if not defined TARGET_FILE (',
      '    echo [!] File CaricoStudio_Desktop_Windows.html non trovato!',
      '    echo.',
      '    echo Scarica prima il file "1. Scarica Programma Completo (.html)"',
      '    echo e salvalo nella cartella Download o sul Desktop.',
      '    echo.',
      '    pause',
      '    exit /b',
      ')',
      '',
      'echo [v] File programma rilevato: "!TARGET_FILE!"',
      '',
      'REM Se questo .bat si trova sul Desktop ed esiste gia un vecchio CaricoStudio_Desktop_Windows.html,',
      'REM aggiorna automaticamente la copia sul Desktop con l\'ultima versione scaricata!',
      'if exist "%~dp0CaricoStudio_Desktop_Windows.html" (',
      '    if /i not "!TARGET_FILE!"=="%~dp0CaricoStudio_Desktop_Windows.html" (',
      '        copy /y "!TARGET_FILE!" "%~dp0CaricoStudio_Desktop_Windows.html" >nul 2>nul',
      '        set "TARGET_FILE=%~dp0CaricoStudio_Desktop_Windows.html"',
      '        echo [v] Copia sul Desktop aggiornata all\'ultima versione con successo!',
      '    )',
      ')',
      '',
      'REM Prepara l\'URL locale per il browser',
      'set "URL_FILE=!TARGET_FILE:\\=/!"',
      '',
      'echo [*] Apertura finestra software Windows 11...',
      '',
      'REM Avvia Microsoft Edge o Chrome in modalita finestra nativa (--app)',
      'if exist "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" (',
      '    start "" "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" --app="file:///!URL_FILE!" --start-maximized',
      '    exit',
      ')',
      'if exist "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" (',
      '    start "" "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe" --app="file:///!URL_FILE!" --start-maximized',
      '    exit',
      ')',
      'if exist "%LOCALAPPDATA%\\Microsoft\\Edge\\Application\\msedge.exe" (',
      '    start "" "%LOCALAPPDATA%\\Microsoft\\Edge\\Application\\msedge.exe" --app="file:///!URL_FILE!" --start-maximized',
      '    exit',
      ')',
      'if exist "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" (',
      '    start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --app="file:///!URL_FILE!" --start-maximized',
      '    exit',
      ')',
      'if exist "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" (',
      '    start "" "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" --app="file:///!URL_FILE!" --start-maximized',
      '    exit',
      ')',
      '',
      'REM Fallback al browser predefinito di Windows',
      'start "" "!TARGET_FILE!"',
      'exit',
    ].join('\r\n');

    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    triggerDownloadBlob('Avvia_CaricoStudio_Finestra_Windows.bat', blob);
    setDownloadedNotice(
      'Nuovo Avviatore "Avvia_CaricoStudio_Finestra_Windows.bat" scaricato! Rileva automaticamente sempre l\'ultima versione scaricata.'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  Scarica CaricoStudio per Windows 10 / Windows 11
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  100% Locale & Offline
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Programma completo in un unico file autonomo sul tuo PC: non dipende da nessun server esterno e funziona anche senza internet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {downloadedNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{downloadedNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setDownloadedNotice(null)}
                className="px-2.5 py-1 rounded bg-emerald-200/70 text-emerald-900 hover:bg-emerald-200 text-[11px] cursor-pointer shrink-0"
              >
                Chiudi avviso
              </button>
            </div>
          )}

          {/* 🌟 METODO PREFERITO: INSTALLA COME VERA APP DESKTOP CHROME (SI AGGIORNA IN AUTOMATICO!) */}
          <div className="border-3 border-emerald-600 rounded-2xl p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Metodo Consigliato: App Desktop Chrome Windows 11
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 border border-emerald-300">
                Aggiornamenti Automatici Senza Scaricare File
              </span>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">
                Trasforma CaricoStudio in un'App Desktop con Google Chrome o Microsoft Edge
              </h3>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                In questo modo <strong>non devi più scaricare continuamente file .html né toccare file .bat</strong>: CaricoStudio diventa un'icona sul tuo Desktop e sulla barra delle applicazioni di Windows, si apre in una vera finestra software e <strong>scarica in automatico tutte le nuove versioni in background</strong>!
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border-2 border-emerald-300 text-xs space-y-2.5 text-slate-800 shadow-2xs">
              <div className="font-extrabold text-slate-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Come trasformarlo in App Desktop in 10 secondi:</span>
              </div>
              <ol className="list-decimal pl-5 space-y-1.5 text-xs">
                <li>
                  Apri questo gestionale in <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>.
                </li>
                <li>
                  In alto a destra, nella barra dell'indirizzo di Chrome, clicca sull'icona <strong>🖥️ Installa CaricoStudio</strong> (oppure clicca sui <strong>tre puntini in alto a destra &gt; "Salva e condividi" &gt; "Installa CaricoStudio come App"</strong>).
                </li>
                <li>
                  Conferma cliccando su <strong>"Installa"</strong>.
                </li>
              </ol>
              <div className="p-2.5 bg-emerald-100/70 rounded-lg text-emerald-950 text-[11px] font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Fatto! L'icona "CaricoStudio" comparirà sul Desktop e ogni volta che ci clicchi si aggiornerà da sola all'ultimo minuto con tutti i dati sincronizzati!</span>
              </div>
            </div>
          </div>

          {/* METODO ALTERNATIVO LOCALE OFFLINE */}
          <div className="border border-slate-300 rounded-2xl p-4 bg-slate-50 space-y-3">
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                In alternativa: File Locale Offline Singolo (.html)
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Se preferisci un file unico salvato sul disco fisso che funzioni anche senza alcuna connessione internet:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={isGeneratingStandalone}
                onClick={handleDownloadStandaloneWindowsSoftware}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 shrink-0" />
                {isGeneratingStandalone
                  ? 'Preparazione Programma in corso...'
                  : 'Scarica File Standalone (.html)'}
              </button>

              <button
                type="button"
                onClick={handleDownloadLocalWindowLauncher}
                className="py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Laptop className="w-4 h-4 text-blue-400 shrink-0" />
                2. Scarica Avviatore Finestra Windows (.bat)
              </button>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-blue-200 text-xs space-y-1.5 text-slate-700">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Come usare i file sul tuo PC Windows:
              </div>
              <div>
                <strong>1.</strong> Clicca su <strong>&quot;1. Scarica Programma Completo (.html)&quot;</strong>: nella tua cartella <em>Download</em> troverai l&apos;ultima versione <code className="font-mono font-bold text-blue-800">CaricoStudio_Desktop_Windows.html</code> (con CAD 3D e Traduttore PDF inclusi).
              </div>
              <div>
                <strong>2.</strong> Clicca su <strong>&quot;2. Scarica Avviatore Finestra Windows (.bat)&quot;</strong> e salvalo sul Desktop: il nuovo avviatore rileva in automatico la versione più recente scaricata (anche con suffisso numerico es. <em>(7)</em> o <em>(8)</em>) e la apre a tutto schermo come vera app desktop Windows 11.
              </div>
            </div>
          </div>

          {/* SEZIONE: COME AGGIORNARE IL SOFTWARE (PERCHÉ NON VEDI L'AGGIORNAMENTO) */}
          <div className="border border-amber-300 rounded-2xl p-4 bg-amber-50/70 space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-700" />
              <h4 className="text-xs font-extrabold uppercase tracking-wide text-amber-950">
                Sul file .bat vedi la versione precedente senza l&apos;aggiornamento?
              </h4>
            </div>
            <div className="text-xs text-amber-900 space-y-2 leading-relaxed">
              <p>
                <strong>Perché accade:</strong> Il tuo browser Windows, scaricando più volte il file, ha salvato copie con numeri tipo <code className="font-mono font-semibold">CaricoStudio_Desktop_Windows (1).html</code> o <code className="font-mono font-semibold">(7).html</code>. Il vecchio file <em>.bat</em> che avevi sul Desktop continuava ad aprire la primissima copia originale non aggiornata!
              </p>
              <p>
                <strong>Soluzione istantanea (2 scelte):</strong>
                <br />
                • <strong>Scelta rapida:</strong> Clicca sul pulsante nero <strong>&quot;2. Scarica Avviatore Finestra Windows (.bat)&quot;</strong> qui sopra: il nuovo avviatore cerca ed apre automaticamente sempre la versione più recente scaricata nei tuoi Download o sul Desktop!
                <br />
                • <strong>In alternativa:</strong> Elimina le vecchie copie di <em>CaricoStudio_Desktop_Windows</em> dalla cartella Download/Desktop e rinomina il file appena scaricato semplicemente in <code className="font-mono font-bold">CaricoStudio_Desktop_Windows.html</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleForceReload}
              className="py-2 px-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Forza Ricarica &amp; Svuota Cache Ora (Ctrl + F5)
            </button>
          </div>

          {/* SALVATAGGIO COMMESSA IN CARTELLA */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 block">
                  Archiviazione Commesse nelle Cartelle di Windows
                </span>
                <span className="text-[11px] text-slate-500">
                  Ogni commessa può essere salvata come file nella cartella del cliente sul tuo PC e riaperta in qualsiasi momento.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSaveCurrentCommessa}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
            >
              <FolderDown className="w-3.5 h-3.5" />
              Salva Commessa in Cartella
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">
            Funziona su tutti i PC Windows 10 e Windows 11 (anche senza connessione internet)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 cursor-pointer"
          >
            Torna al Gestionale
          </button>
        </div>
      </div>
    </div>
  );
};
