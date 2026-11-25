import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Database,
  Disc3,
  Download,
  FileCode2,
  HardDrive,
  Laptop,
  Lock,
  RefreshCw,
  Save,
  ScrollText,
  Server,
  Shield,
  Terminal,
  Trash2,
} from 'lucide-react';
import { AuthUser } from '../types/warehouse';
import { authFetch } from '../utils/authSession';

interface ServerControlPanelAppProps {
  currentUser: AuthUser;
}

type ControlTab =
  | 'desktop_software'
  | 'install_iso'
  | 'general'
  | 'storage'
  | 'sessions'
  | 'logs';

interface SystemSettings {
  nodeName: string;
  hostnameLabel: string;
  timezone: string;
  kioskBootDefault: boolean;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  maintenanceBanner: string;
  updatedAt: string;
}

interface StorageResponse {
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
  };
  volumes: Array<{
    id: string;
    label: string;
    bytes: number;
    files: number;
  }>;
  backups: Array<{
    filename: string;
    sizeBytes: number;
    createdAt: string;
  }>;
}

interface ActiveSessionRow {
  sessionPrefix: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'worker' | 'employer';
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
  isOnlineWs: boolean;
}

interface SystemLogRow {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  source: string;
  message: string;
}

interface DeployArtifactMeta {
  key: string;
  fileName: string;
  relativePath?: string;
  title: string;
  description: string;
  category: 'installer' | 'iso' | 'systemd' | 'docker' | 'docs' | 'desktop';
  available: boolean;
  sizeBytes: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[idx]}`;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const ServerControlPanelApp: React.FC<ServerControlPanelAppProps> = ({
  currentUser,
}) => {
  const isEmployer = currentUser.role === 'employer';
  const [activeTab, setActiveTab] = useState<ControlTab>('desktop_software');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Settings
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Storage & Backups
  const [storage, setStorage] = useState<StorageResponse | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<ActiveSessionRow[]>([]);

  // Logs
  const [logs, setLogs] = useState<SystemLogRow[]>([]);
  const [logLevel, setLogLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  // Deploy / ISO / Desktop Artifacts
  const [artifacts, setArtifacts] = useState<DeployArtifactMeta[]>([]);
  const [selectedArtifactKey, setSelectedArtifactKey] = useState<string>('desktop_win_bat');
  const [artifactContent, setArtifactContent] = useState<string>('');
  const [artifactFileName, setArtifactFileName] = useState<string>('');
  const [artifactRelativePath, setArtifactRelativePath] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [downloadingProjectZip, setDownloadingProjectZip] = useState(false);

  const notify = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const loadSettings = useCallback(async () => {
    const r = await authFetch('/api/system/settings').catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (d?.settings) setSettings(d.settings);
    }
  }, []);

  const loadStorage = useCallback(async () => {
    const r = await authFetch('/api/system/storage').catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (d?.ok) setStorage(d);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    if (!isEmployer) return;
    const r = await authFetch('/api/system/sessions').catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (Array.isArray(d?.sessions)) setSessions(d.sessions);
    }
  }, [isEmployer]);

  const loadLogs = useCallback(async () => {
    const r = await authFetch(`/api/system/logs?level=${encodeURIComponent(logLevel)}`).catch(
      () => null
    );
    if (r && r.ok) {
      const d = await r.json();
      if (Array.isArray(d?.logs)) setLogs(d.logs);
    }
  }, [logLevel]);

  const loadArtifacts = useCallback(async () => {
    const r = await authFetch('/api/system/deploy-artifacts').catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (Array.isArray(d?.artifacts)) setArtifacts(d.artifacts);
    }
  }, []);

  const loadArtifactPreview = useCallback(async (key: string) => {
    const r = await authFetch(`/api/system/deploy-artifacts/${encodeURIComponent(key)}`).catch(
      () => null
    );
    if (r && r.ok) {
      const d = await r.json();
      setArtifactContent(d?.content || '');
      setArtifactFileName(d?.fileName || '');
      setArtifactRelativePath(d?.relativePath || d?.fileName || '');
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadStorage();
    loadArtifacts();
    if (isEmployer) loadSessions();
  }, [loadSettings, loadStorage, loadArtifacts, loadSessions, isEmployer]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (selectedArtifactKey) {
      loadArtifactPreview(selectedArtifactKey);
    }
  }, [selectedArtifactKey, loadArtifactPreview]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !isEmployer) return;
    setSavingSettings(true);
    try {
      const r = await authFetch('/api/system/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) {
        notify('err', d?.error || 'Errore salvataggio configurazione.');
      } else {
        setSettings(d.settings);
        notify('ok', 'Configurazione nodo METATRON salvata.');
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!isEmployer) return;
    setCreatingBackup(true);
    try {
      const r = await authFetch('/api/system/backups', { method: 'POST' });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) {
        notify('err', d?.error || 'Errore creazione snapshot.');
      } else {
        notify('ok', `Snapshot creato: ${d.backup.filename}`);
        loadStorage();
        loadLogs();
      }
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadBackup = async (filename: string) => {
    try {
      const r = await authFetch(`/api/system/backups/${encodeURIComponent(filename)}`);
      if (!r.ok) {
        notify('err', 'Impossibile scaricare il backup.');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      notify('err', 'Errore durante il download del backup.');
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    const r = await authFetch(`/api/system/backups/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (r.ok) {
      notify('ok', `Backup ${filename} eliminato.`);
      loadStorage();
      loadLogs();
    }
  };

  const handleRevokeSession = async (prefix: string) => {
    const r = await authFetch(`/api/system/sessions/${encodeURIComponent(prefix)}`, {
      method: 'DELETE',
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d?.ok) {
      notify('err', d?.error || 'Impossibile revocare la sessione.');
    } else {
      notify('ok', 'Sessione disconnessa.');
      loadSessions();
      loadLogs();
    }
  };

  const handleDownloadArtifact = async (key: string, fileName: string) => {
    try {
      const r = await authFetch(
        `/api/system/deploy-artifacts/${encodeURIComponent(key)}?download=1`
      );
      if (!r.ok) {
        notify('err', 'Download non riuscito.');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('ok', `Scaricato ${fileName}`);
    } catch {
      notify('err', 'Errore durante il download.');
    }
  };

  const handleDownloadDesktopProjectZip = async () => {
    setDownloadingProjectZip(true);
    try {
      const r = await authFetch('/api/system/desktop-project-zip');
      if (!r.ok) {
        notify('err', 'Impossibile generare il pacchetto ZIP del progetto.');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'METATRON-Desktop-Builder.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify(
        'ok',
        'Pacchetto METATRON-Desktop-Builder.zip scaricato! Estrailo e avvia CREA-SOFTWARE-WINDOWS.bat.'
      );
    } catch {
      notify('err', 'Errore durante il download del pacchetto ZIP.');
    } finally {
      setDownloadingProjectZip(false);
    }
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(id);
      window.setTimeout(() => setCopiedKey((c) => (c === id ? null : c)), 1800);
    } catch {
      notify('err', 'Copia negli appunti non riuscita.');
    }
  };

  const desktopArtifacts = artifacts.filter((a) => a.category === 'desktop');
  const serverOsArtifacts = artifacts.filter((a) => a.category !== 'desktop');

  const navItems: Array<{
    id: ControlTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'desktop_software', label: 'Software Desktop (.exe)', icon: Laptop },
    { id: 'install_iso', label: 'Installa OS & Genera ISO', icon: Disc3 },
    { id: 'general', label: 'Nodo & Rete Server', icon: Server },
    { id: 'storage', label: 'Storage & Backup', icon: HardDrive },
    { id: 'sessions', label: 'Sessioni & Accessi', icon: Shield },
    { id: 'logs', label: 'Log di Sistema', icon: ScrollText },
  ];

  const handleSelectTab = (tab: ControlTab) => {
    setActiveTab(tab);
    if (tab === 'desktop_software' && !selectedArtifactKey.startsWith('desktop_')) {
      setSelectedArtifactKey('desktop_win_bat');
    } else if (tab === 'install_iso' && selectedArtifactKey.startsWith('desktop_')) {
      setSelectedArtifactKey('installer');
    }
  };

  return (
    <div className="h-full w-full flex bg-[#0b0e17] text-slate-100 overflow-hidden">
      {/* Left Sidebar (240px) */}
      <aside className="w-60 shrink-0 border-r border-white/[0.08] bg-[#0f1320] flex flex-col">
        <div className="px-4 py-4 border-b border-white/[0.08]">
          <div className="text-xs font-semibold text-white tracking-tight">
            METATRON Server OS
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {settings?.nodeName || 'METATRON-SRV-01'} · {isEmployer ? 'Amministratore' : 'Operatore'}
          </div>
        </div>

        <nav className="p-2.5 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectTab(item.id)}
                className={`w-full px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-white/[0.08] text-[11px] text-slate-400 leading-relaxed">
          Base Linux compatibile: Debian 12 Bookworm / Ubuntu Server 22.04–24.04 LTS.
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="px-6 py-3.5 border-b border-white/[0.08] bg-[#0f1320]/70 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2 truncate">
            <span>Sistema Server</span>
            <span aria-hidden="true">/</span>
            <span className="text-white font-semibold">
              {navItems.find((n) => n.id === activeTab)?.label}
            </span>
          </div>

          {feedback && (
            <div
              className={`text-xs font-medium ${
                feedback.type === 'ok' ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {feedback.text}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 0: SOFTWARE DESKTOP (.EXE / MAC / LINUX) */}
          {activeTab === 'desktop_software' && (
            <div className="space-y-6 max-w-5xl">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-white">
                  Software Desktop Autonomo (Windows .exe, macOS .dmg, Linux .AppImage)
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                  Impacchetta METATRON CaricoStudio e il suo server interno dentro un vero
                  programma desktop indipendente da Chrome. Genera sia l&apos;installer{' '}
                  <code className="text-indigo-300 font-mono">
                    METATRON-CaricoStudio-Setup-1.0.0.exe
                  </code>{' '}
                  sia il file unico{' '}
                  <code className="text-emerald-300 font-mono">
                    METATRON-CaricoStudio-Portable-1.0.0.exe
                  </code>{' '}
                  pronto da mettere in uno ZIP e inviare a chiunque.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#111626] border border-indigo-500/35 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-indigo-400" />
                      1. Compila su Windows in 1 clic (Pacchetto Completo)
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={downloadingProjectZip}
                    onClick={handleDownloadDesktopProjectZip}
                    className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {downloadingProjectZip
                        ? 'Preparazione pacchetto ZIP...'
                        : 'Scarica Pacchetto Completo (.zip)'}
                    </span>
                  </button>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Estrai <span className="font-mono text-emerald-300">METATRON-Desktop-Builder.zip</span>{' '}
                    in una cartella su Windows e fai doppio clic su{' '}
                    <span className="font-mono text-white">CREA-SOFTWARE-WINDOWS.bat</span>{' '}
                    al suo interno: genera <span className="font-mono text-slate-200">Setup.exe</span> e{' '}
                    <span className="font-mono text-slate-200">Portable.exe</span> nella cartella{' '}
                    <span className="font-mono text-slate-200">release\</span>.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#111626] border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-sky-400" />
                      2. Oppure genera nel Cloud (Windows + Mac + Linux)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          'bash desktop-app/build-desktop-mac-linux.sh',
                          'cmd-desktop-unix'
                        )
                      }
                      className="px-2 py-1 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cmd-desktop-unix' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'cmd-desktop-unix' ? 'Copiato' : 'Copia'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-[#080a12] border border-white/[0.06] text-[11px] font-mono text-sky-300 overflow-x-auto">
                    .github/workflows/build-desktop.yml
                  </pre>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Carica il progetto su GitHub e avvia l&apos;Action per scaricare direttamente
                    gli ZIP con <span className="font-mono text-slate-200">.exe</span>,{' '}
                    <span className="font-mono text-slate-200">.dmg</span> e{' '}
                    <span className="font-mono text-slate-200">.AppImage</span> senza installare nulla.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl bg-[#111626] border border-white/[0.08] divide-y divide-white/[0.06]">
                  {desktopArtifacts.map((art) => {
                    const isSelected = art.key === selectedArtifactKey;
                    return (
                      <div
                        key={art.key}
                        className={`p-3.5 transition-colors ${
                          isSelected ? 'bg-indigo-600/15' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedArtifactKey(art.key)}
                          className="w-full text-left cursor-pointer"
                        >
                          <div className="text-xs font-semibold text-white flex items-center justify-between gap-2">
                            <span className="truncate">{art.fileName}</span>
                            <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                              {formatBytes(art.sizeBytes)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                            {art.description}
                          </div>
                        </button>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadArtifact(art.key, art.fileName)}
                            className="px-2.5 py-1 rounded-md bg-white/[0.07] hover:bg-indigo-600 text-[11px] font-medium text-white flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Scarica</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="lg:col-span-2 rounded-xl bg-[#080a12] border border-white/[0.08] flex flex-col overflow-hidden min-h-[360px]">
                  <div className="px-4 py-2.5 border-b border-white/[0.08] bg-[#111626] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-200 truncate">
                      <FileCode2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate">
                        {artifactRelativePath || artifactFileName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyText(artifactContent, 'code-preview-desktop')}
                        className="px-2.5 py-1 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'code-preview-desktop' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedKey === 'code-preview-desktop' ? 'Copiato' : 'Copia file'}
                        </span>
                      </button>
                      {artifactFileName && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadArtifact(selectedArtifactKey, artifactFileName)
                          }
                          className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Scarica</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="flex-1 p-4 text-[11px] leading-relaxed font-mono text-slate-300 overflow-auto max-h-[460px] select-text">
                    {artifactContent || 'Caricamento file...'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: INSTALLA OS & GENERA ISO */}
          {activeTab === 'install_iso' && (
            <div className="space-y-6 max-w-5xl">
              <div className="space-y-1.5">
                <h2 className="text-lg font-semibold text-white">
                  Installa METATRON come Sistema Operativo su Server o Chiavetta USB
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                  Tutti gli script reali di sistema sono già integrati nella cartella{' '}
                  <code className="text-indigo-300 font-mono">os-installer/</code> del progetto.
                  Puoi trasformare un PC/server Debian o Ubuntu in METATRON OS con un solo comando,
                  oppure compilare l&apos;immagine bootable{' '}
                  <code className="text-emerald-300 font-mono">metatron-os-amd64.iso</code> da
                  scrivere su chiavetta USB.
                </p>
              </div>

              {/* Quick Command Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#111626] border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      1. Installa su Server Linux (Kiosk + LAN)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          'sudo bash os-installer/install-metatron-os.sh --kiosk',
                          'cmd-kiosk'
                        )
                      }
                      className="px-2 py-1 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cmd-kiosk' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'cmd-kiosk' ? 'Copiato' : 'Copia'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-[#080a12] border border-white/[0.06] text-[11px] font-mono text-emerald-300 overflow-x-auto">
                    sudo bash os-installer/install-metatron-os.sh --kiosk
                  </pre>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Installa Node 20, configura il servizio systemd automatico, apre il firewall
                    e avvia METATRON a tutto schermo direttamente all&apos;accensione del PC.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#111626] border border-white/[0.08] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <Disc3 className="w-4 h-4 text-sky-400" />
                      2. Genera ISO Avviabile da Chiavetta USB
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          'sudo bash os-installer/build-metatron-iso.sh',
                          'cmd-iso'
                        )
                      }
                      className="px-2 py-1 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'cmd-iso' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'cmd-iso' ? 'Copiato' : 'Copia'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-lg bg-[#080a12] border border-white/[0.06] text-[11px] font-mono text-sky-300 overflow-x-auto">
                    sudo bash os-installer/build-metatron-iso.sh
                  </pre>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Compila <span className="font-mono text-slate-200">metatron-os-amd64.iso</span>{' '}
                    (Debian Bookworm + METATRON OS Kiosk) pronta per Rufus o BalenaEtcher.
                  </p>
                </div>
              </div>

              {/* Artifacts Browser & Live Viewer */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl bg-[#111626] border border-white/[0.08] divide-y divide-white/[0.06]">
                  {serverOsArtifacts.map((art) => {
                    const isSelected = art.key === selectedArtifactKey;
                    return (
                      <div
                        key={art.key}
                        className={`p-3.5 transition-colors ${
                          isSelected ? 'bg-indigo-600/15' : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedArtifactKey(art.key)}
                          className="w-full text-left cursor-pointer"
                        >
                          <div className="text-xs font-semibold text-white flex items-center justify-between gap-2">
                            <span className="truncate">{art.fileName}</span>
                            <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                              {formatBytes(art.sizeBytes)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                            {art.description}
                          </div>
                        </button>
                        <div className="mt-2.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadArtifact(art.key, art.fileName)}
                            className="px-2.5 py-1 rounded-md bg-white/[0.07] hover:bg-indigo-600 text-[11px] font-medium text-white flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Scarica</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="lg:col-span-2 rounded-xl bg-[#080a12] border border-white/[0.08] flex flex-col overflow-hidden min-h-[360px]">
                  <div className="px-4 py-2.5 border-b border-white/[0.08] bg-[#111626] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-200 truncate">
                      <FileCode2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate">
                        {artifactRelativePath || `os-installer/${artifactFileName}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyText(artifactContent, 'code-preview')}
                        className="px-2.5 py-1 rounded-md bg-white/[0.07] hover:bg-white/[0.14] text-[11px] text-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === 'code-preview' ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedKey === 'code-preview' ? 'Copiato' : 'Copia file'}</span>
                      </button>
                      {artifactFileName && (
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadArtifact(selectedArtifactKey, artifactFileName)
                          }
                          className="px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Scarica</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <pre className="flex-1 p-4 text-[11px] leading-relaxed font-mono text-slate-300 overflow-auto max-h-[460px] select-text">
                    {artifactContent || 'Caricamento file...'}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NODO & RETE SERVER */}
          {activeTab === 'general' && settings && (
            <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Configurazione Nodo METATRON Server OS
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Identità del server in rete locale, fuso orario e politica di avvio.
                </p>
              </div>

              {!isEmployer && (
                <div className="p-3.5 rounded-xl bg-amber-500/12 border border-amber-400/25 text-xs text-amber-200 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>
                    Visualizzazione in sola lettura: solo un account Direzione può modificare i
                    parametri del server.
                  </span>
                </div>
              )}

              <div className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Nome Nodo Server
                    </label>
                    <input
                      type="text"
                      disabled={!isEmployer}
                      value={settings.nodeName}
                      onChange={(e) => setSettings({ ...settings, nodeName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0e17] border border-white/12 text-xs font-mono text-white disabled:opacity-60 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Hostname Rete Locale (mDNS)
                    </label>
                    <input
                      type="text"
                      disabled={!isEmployer}
                      value={settings.hostnameLabel}
                      onChange={(e) =>
                        setSettings({ ...settings, hostnameLabel: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0e17] border border-white/12 text-xs font-mono text-white disabled:opacity-60 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Fuso Orario Server
                    </label>
                    <select
                      disabled={!isEmployer}
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0e17] border border-white/12 text-xs text-white disabled:opacity-60 focus:outline-none focus:border-indigo-400"
                    >
                      <option value="Europe/Rome">Europe/Rome (Italia)</option>
                      <option value="Europe/Berlin">Europe/Berlin</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Intervallo Backup Automatico (ore)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      disabled={!isEmployer}
                      value={settings.autoBackupIntervalHours}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          autoBackupIntervalHours: Number(e.target.value) || 24,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0e17] border border-white/12 text-xs font-mono tabular-nums text-white disabled:opacity-60 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-white/[0.07]">
                  <label className="flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer">
                    <span>Avvio grafico Kiosk predefinito su monitor collegato al server</span>
                    <input
                      type="checkbox"
                      disabled={!isEmployer}
                      checked={settings.kioskBootDefault}
                      onChange={(e) =>
                        setSettings({ ...settings, kioskBootDefault: e.target.checked })
                      }
                      className="w-4 h-4 accent-indigo-500"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer">
                    <span>Abilita pianificazione snapshot di backup server</span>
                    <input
                      type="checkbox"
                      disabled={!isEmployer}
                      checked={settings.autoBackupEnabled}
                      onChange={(e) =>
                        setSettings({ ...settings, autoBackupEnabled: e.target.checked })
                      }
                      className="w-4 h-4 accent-indigo-500"
                    />
                  </label>
                </div>

                {isEmployer && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Ultimo salvataggio: {formatDateTime(settings.updatedAt)}
                    </span>
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingSettings ? 'Salvataggio...' : 'Salva Configurazione'}</span>
                    </button>
                  </div>
                )}
              </div>
            </form>
          )}

          {/* TAB 3: STORAGE & BACKUP */}
          {activeTab === 'storage' && (
            <div className="space-y-6 max-w-4xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Volumi Storage &amp; Snapshot Server
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Occupazione reale del disco ospite e salvataggio snapshot completi di tutti gli archivi.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadStorage}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Aggiorna</span>
                  </button>
                  {isEmployer && (
                    <button
                      type="button"
                      disabled={creatingBackup}
                      onClick={handleCreateBackup}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>
                        {creatingBackup ? 'Creazione snapshot...' : 'Crea Snapshot Backup'}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {storage && (
                <>
                  <div className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">Volume Disco Principale</span>
                      <span className="font-mono tabular-nums text-slate-300">
                        {formatBytes(storage.disk.usedBytes)} usati /{' '}
                        {formatBytes(storage.disk.totalBytes)} ({storage.disk.usedPercent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, storage.disk.usedPercent)}%` }}
                        className="h-full rounded-full bg-sky-400"
                      />
                    </div>

                    <div className="pt-3 border-t border-white/[0.07] divide-y divide-white/[0.06]">
                      {storage.volumes.map((v) => (
                        <div
                          key={v.id}
                          className="py-2.5 flex items-center justify-between gap-4 text-xs"
                        >
                          <span className="text-slate-200">{v.label}</span>
                          <span className="font-mono tabular-nums text-slate-400 shrink-0">
                            {v.files} file ·{' '}
                            <strong className="text-white">{formatBytes(v.bytes)}</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      Snapshot di Backup Salvati sul Server
                    </h3>
                    {!isEmployer ? (
                      <p className="text-xs text-slate-400">
                        La creazione e il download degli snapshot completi del server sono riservati
                        alla Direzione.
                      </p>
                    ) : storage.backups.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4">
                        Nessuno snapshot presente. Clicca &ldquo;Crea Snapshot Backup&rdquo; per
                        salvare una copia di sicurezza completa del server.
                      </p>
                    ) : (
                      <div className="divide-y divide-white/[0.06]">
                        {storage.backups.map((b) => (
                          <div
                            key={b.filename}
                            className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-semibold text-white truncate">
                                {b.filename}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                                {formatDateTime(b.createdAt)} · {formatBytes(b.sizeBytes)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDownloadBackup(b.filename)}
                                className="px-2.5 py-1.5 rounded-lg bg-white/[0.07] hover:bg-indigo-600 text-xs text-white flex items-center gap-1 cursor-pointer transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Scarica</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBackup(b.filename)}
                                className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-rose-600 text-slate-300 hover:text-white cursor-pointer transition-colors"
                                title="Elimina snapshot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: SESSIONI & ACCESSI */}
          {activeTab === 'sessions' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Sessioni Autenticate Attive
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Controlla i dispositivi collegati al server e revoca le sessioni non autorizzate.
                  </p>
                </div>
                {isEmployer && (
                  <button
                    type="button"
                    onClick={loadSessions}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Aggiorna</span>
                  </button>
                )}
              </div>

              {!isEmployer ? (
                <div className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] text-xs text-slate-400 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    La gestione e revoca delle sessioni multi-utente è riservata all&apos;account
                    Direzione.
                  </span>
                </div>
              ) : (
                <div className="rounded-xl bg-[#111626] border border-white/[0.08] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[11px] text-slate-400">
                        <th className="px-4 py-3 font-medium">Utente</th>
                        <th className="px-4 py-3 font-medium">Ruolo</th>
                        <th className="px-4 py-3 font-medium">ID Sessione</th>
                        <th className="px-4 py-3 font-medium">Creata il</th>
                        <th className="px-4 py-3 font-medium text-right">Azione</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {sessions.map((s) => (
                        <tr key={s.sessionPrefix} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-white">{s.userName}</div>
                            <div className="text-[11px] text-slate-400">{s.userEmail}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {s.userRole === 'employer' ? 'Direzione' : 'Operatore'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400 tabular-nums">
                            {s.sessionPrefix}…{s.isCurrent ? ' (corrente)' : ''}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400 tabular-nums">
                            {formatDateTime(s.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {s.isCurrent ? (
                              <span className="text-[11px] text-emerald-300 font-medium">
                                Sessione attiva
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRevokeSession(s.sessionPrefix)}
                                className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-600 text-rose-200 hover:text-white text-[11px] font-medium cursor-pointer transition-colors"
                              >
                                Disconnetti
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: LOG DI SISTEMA */}
          {activeTab === 'logs' && (
            <div className="space-y-4 max-w-5xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">Registro Eventi Server</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tracciamento in tempo reale di avvii, accessi, backup e modifiche di sistema.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-[#111626] border border-white/[0.08]">
                    {(['all', 'info', 'warn', 'error'] as const).map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setLogLevel(lvl)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                          logLevel === lvl
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {lvl === 'all'
                          ? 'Tutti'
                          : lvl === 'info'
                          ? 'Info'
                          : lvl === 'warn'
                          ? 'Avvisi'
                          : 'Errori'}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={loadLogs}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Aggiorna</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#080a12] border border-white/[0.08] divide-y divide-white/[0.06] font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 font-sans">
                    Nessun evento registrato per il filtro selezionato.
                  </div>
                ) : (
                  logs.map((entry) => (
                    <div
                      key={entry.id}
                      className="px-4 py-2.5 flex flex-wrap sm:flex-nowrap items-baseline gap-3 hover:bg-white/[0.03]"
                    >
                      <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                        {formatDateTime(entry.timestamp)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold uppercase shrink-0 w-12 ${
                          entry.level === 'error'
                            ? 'text-rose-400'
                            : entry.level === 'warn'
                            ? 'text-amber-300'
                            : 'text-emerald-300'
                        }`}
                      >
                        {entry.level}
                      </span>
                      <span className="text-[11px] text-indigo-300 shrink-0 w-32 truncate">
                        {entry.source}
                      </span>
                      <span className="text-slate-200 font-sans text-xs flex-1 min-w-[200px]">
                        {entry.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
