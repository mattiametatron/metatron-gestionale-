import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  GitBranch,
  HardDrive,
  RefreshCw,
  RotateCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { AuthUser } from '../types/warehouse';
import { authFetch } from '../utils/authSession';

export interface DesktopUpdaterState {
  status:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'unsupported';
  currentVersion: string;
  availableVersion?: string | null;
  releaseNotes?: string | null;
  releaseDate?: string | null;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string | null;
  isPortable?: boolean;
  repoSlug?: string | null;
}

export interface ServerUpdateAsset {
  name: string;
  sizeBytes: number;
  downloadUrl: string;
  platform: 'windows' | 'macos' | 'linux' | 'other';
}

export interface ServerUpdateStatusPayload {
  currentVersion: string;
  isDesktopMode: boolean;
  updateAvailable: boolean;
  config: {
    githubRepo: string;
    autoCheckEnabled: boolean;
    autoBackupBeforeUpdate: boolean;
    lastCheckedAt: string | null;
    lastKnownLatestVersion: string | null;
    lastKnownReleaseUrl: string | null;
    lastKnownReleaseNotes: string | null;
    lastKnownPublishedAt: string | null;
    lastKnownAssets: ServerUpdateAsset[];
  };
}

interface MetatronDesktopBridge {
  isDesktopApp: boolean;
  platform: string;
  openDataFolder: () => Promise<{ ok: boolean }>;
  getNetworkInfo: () => Promise<{
    port: number;
    localUrl: string;
    lanUrls: string[];
    dataDir: string;
  }>;
  updater?: {
    getState: () => Promise<DesktopUpdaterState>;
    check: (repoSlug?: string) => Promise<DesktopUpdaterState>;
    download: () => Promise<{ ok: boolean; error?: string }>;
    installAndRestart: () => Promise<{ ok: boolean; error?: string }>;
    onStateChange: (cb: (state: DesktopUpdaterState) => void) => () => void;
  };
}

function getDesktopBridge(): MetatronDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const b = (window as unknown as { metatronDesktop?: MetatronDesktopBridge }).metatronDesktop;
  return b && b.isDesktopApp ? b : null;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[idx]}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Mai controllato';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface SoftwareUpdateAppProps {
  currentUser: AuthUser;
  updateStatus: ServerUpdateStatusPayload | null;
  desktopUpdaterState: DesktopUpdaterState | null;
  onUpdateStatusChange: (next: ServerUpdateStatusPayload) => void;
  onForceReloadWeb: () => Promise<void>;
}

export const SoftwareUpdateApp: React.FC<SoftwareUpdateAppProps> = ({
  currentUser,
  updateStatus,
  desktopUpdaterState,
  onUpdateStatusChange,
  onForceReloadWeb,
}) => {
  const bridge = getDesktopBridge();
  const isDesktop = Boolean(bridge);
  const canUseNativeUpdater = Boolean(
    bridge?.updater && !desktopUpdaterState?.isPortable && desktopUpdaterState?.status !== 'unsupported'
  );

  const [repoInput, setRepoInput] = useState(updateStatus?.config.githubRepo || '');
  const [autoCheck, setAutoCheck] = useState(updateStatus?.config.autoCheckEnabled ?? true);
  const [autoBackup, setAutoBackup] = useState(
    updateStatus?.config.autoBackupBeforeUpdate ?? true
  );
  const [checking, setChecking] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [lastBackupFile, setLastBackupFile] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dataDirPath, setDataDirPath] = useState<string | null>(null);

  useEffect(() => {
    if (updateStatus?.config) {
      setRepoInput(updateStatus.config.githubRepo || '');
      setAutoCheck(updateStatus.config.autoCheckEnabled);
      setAutoBackup(updateStatus.config.autoBackupBeforeUpdate);
    }
  }, [updateStatus]);

  useEffect(() => {
    if (bridge?.getNetworkInfo) {
      bridge
        .getNetworkInfo()
        .then((info) => {
          if (info?.dataDir) setDataDirPath(info.dataDir);
        })
        .catch(() => {});
    }
  }, [bridge]);

  const notify = (type: 'ok' | 'err', text: string) => {
    setFeedback({ type, text });
    window.setTimeout(() => {
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const refreshStatus = useCallback(async () => {
    const r = await authFetch('/api/system/updates/status').catch(() => null);
    if (r && r.ok) {
      const d = await r.json();
      if (d?.ok && d?.status) {
        onUpdateStatusChange(d.status);
      }
    }
  }, [onUpdateStatusChange]);

  useEffect(() => {
    if (!updateStatus) {
      refreshStatus();
    }
  }, [updateStatus, refreshStatus]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const cleaned = repoInput
        .trim()
        .replace(/^https?:\/\/github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^\/+|\/+$/g, '');

      const r = await authFetch('/api/system/updates/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepo: cleaned,
          autoCheckEnabled: autoCheck,
          autoBackupBeforeUpdate: autoBackup,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) {
        notify('err', d?.error || 'Impossibile salvare la configurazione aggiornamenti.');
        return;
      }
      setRepoInput(cleaned);
      if (d.status) onUpdateStatusChange(d.status);
      notify('ok', 'Configurazione aggiornamenti salvata.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCheckUpdates = async () => {
    setChecking(true);
    try {
      const r = await authFetch('/api/system/updates/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubRepo: repoInput.trim() || undefined }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) {
        notify('err', d?.error || 'Controllo aggiornamenti non riuscito.');
      } else {
        if (d.status) onUpdateStatusChange(d.status);
        if (d.status?.updateAvailable) {
          notify(
            'ok',
            `Nuova versione disponibile: v${d.status.config.lastKnownLatestVersion}`
          );
        } else {
          notify('ok', 'METATRON è già aggiornato all’ultima versione disponibile.');
        }
      }

      if (bridge?.updater) {
        await bridge.updater.check(repoInput.trim() || undefined).catch(() => {});
      }
    } finally {
      setChecking(false);
    }
  };

  const runPreUpdateBackup = async (): Promise<boolean> => {
    setCreatingBackup(true);
    try {
      const r = await authFetch('/api/system/updates/pre-backup', { method: 'POST' });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) {
        notify('err', d?.error || 'Backup pre-aggiornamento non riuscito.');
        return false;
      }
      setLastBackupFile(d.backup?.filename || 'Snapshot creato');
      return true;
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDownloadDesktopUpdate = async () => {
    if (!bridge?.updater) return;
    if (autoBackup) {
      const backedUp = await runPreUpdateBackup();
      if (!backedUp) return;
    }
    const res = await bridge.updater.download();
    if (!res?.ok) {
      notify('err', res?.error || 'Download aggiornamento non riuscito.');
    }
  };

  const handleInstallAndRestart = async () => {
    setInstalling(true);
    try {
      if (autoBackup && !lastBackupFile) {
        await runPreUpdateBackup();
      }
      if (bridge?.updater && desktopUpdaterState?.status === 'downloaded') {
        const res = await bridge.updater.installAndRestart();
        if (!res?.ok) {
          notify('err', res?.error || 'Impossibile avviare il riavvio di aggiornamento.');
          setInstalling(false);
        }
        return;
      }
      await onForceReloadWeb();
    } catch {
      setInstalling(false);
    }
  };

  const currentVersion =
    desktopUpdaterState?.currentVersion || updateStatus?.currentVersion || '1.0.0';
  const latestVersion =
    desktopUpdaterState?.availableVersion ||
    updateStatus?.config.lastKnownLatestVersion ||
    null;
  const hasUpdate =
    Boolean(updateStatus?.updateAvailable) ||
    desktopUpdaterState?.status === 'available' ||
    desktopUpdaterState?.status === 'downloading' ||
    desktopUpdaterState?.status === 'downloaded';

  const isDownloading = desktopUpdaterState?.status === 'downloading';
  const isDownloaded = desktopUpdaterState?.status === 'downloaded';
  const downloadPercent = Math.max(
    0,
    Math.min(100, Math.round(desktopUpdaterState?.percent || 0))
  );

  const releaseNotes =
    desktopUpdaterState?.releaseNotes ||
    updateStatus?.config.lastKnownReleaseNotes ||
    null;

  const assets = updateStatus?.config.lastKnownAssets || [];
  const preferredWindowsAsset =
    assets.find((a) => a.platform === 'windows' && /setup/i.test(a.name)) ||
    assets.find((a) => a.platform === 'windows') ||
    null;

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0e17] text-slate-100 overflow-hidden">
      {/* Top Bar */}
      <header className="px-6 py-4 border-b border-white/[0.08] bg-[#0f1320] flex items-center justify-between gap-6 shrink-0">
        <div className="min-w-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>METATRON OS</span>
            <span aria-hidden="true">/</span>
            <span className="text-white font-semibold">Aggiornamenti di Sistema</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 font-mono tabular-nums">
            <span>Versione v{currentVersion}</span>
            <span aria-hidden="true">·</span>
            <span>
              {isDesktop
                ? desktopUpdaterState?.isPortable
                  ? 'Desktop Portable'
                  : 'Software Desktop Installato'
                : 'Server / Browser Web'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Ultimo controllo: {formatDateTime(updateStatus?.config.lastCheckedAt)}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={checking || isDownloading}
          onClick={handleCheckUpdates}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-55 text-xs font-semibold text-white flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          <span>{checking ? 'Controllo in corso...' : 'Verifica aggiornamenti'}</span>
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {feedback && (
            <div
              className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/12 border-emerald-400/30 text-emerald-200'
                  : 'bg-rose-500/12 border-rose-400/30 text-rose-200'
              }`}
            >
              {feedback.type === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Primary Status Panel */}
          <section className="p-6 rounded-xl bg-[#111626] border border-white/[0.08] space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  {isDownloaded
                    ? `Aggiornamento v${latestVersion} pronto per l'installazione`
                    : isDownloading
                    ? `Download aggiornamento v${latestVersion} in corso`
                    : hasUpdate && latestVersion
                    ? `Nuova versione disponibile: v${latestVersion}`
                    : 'Il sistema METATRON è aggiornato'}
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isDownloaded
                    ? 'Il pacchetto è stato scaricato e verificato. Riavvia ora per applicare la nuova versione: tutti i dati salvati resteranno intatti.'
                    : hasUpdate && latestVersion
                    ? `È disponibile la versione v${latestVersion} (attuale v${currentVersion}). Prima del riavvio verrà eseguito un backup automatico di sicurezza dei tuoi archivi.`
                    : updateStatus?.config.githubRepo
                    ? `Connesso a GitHub (${updateStatus.config.githubRepo}). Quando pubblichi una nuova release, riceverai automaticamente una notifica nel Centro Notifiche.`
                    : 'Collega qui sotto il tuo repository GitHub (es. nomeutente/nome-repo) per attivare il controllo automatico degli aggiornamenti e le notifiche.'}
                </p>
              </div>

              <div className="text-right font-mono tabular-nums shrink-0">
                <div className="text-xs text-slate-400">Installata</div>
                <div className="text-xl font-semibold text-white">v{currentVersion}</div>
                {latestVersion && hasUpdate && (
                  <div className="text-xs text-emerald-300 mt-0.5">
                    Nuova: v{latestVersion}
                  </div>
                )}
              </div>
            </div>

            {/* Download Progress Bar (Electron autoUpdater) */}
            {isDownloading && (
              <div className="space-y-2 pt-2 border-t border-white/[0.07]">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-300">
                    Scaricamento pacchetto... {downloadPercent}%
                  </span>
                  <span className="text-slate-400">
                    {formatBytes(desktopUpdaterState?.transferred || 0)} /{' '}
                    {formatBytes(desktopUpdaterState?.total || 0)}
                    {desktopUpdaterState?.bytesPerSecond
                      ? ` · ${formatBytes(desktopUpdaterState.bytesPerSecond)}/s`
                      : ''}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    style={{ width: `${downloadPercent}%` }}
                    className="h-full rounded-full bg-cyan-400 transition-all duration-150"
                  />
                </div>
              </div>
            )}

            {/* Primary Update Action Row */}
            <div className="pt-4 border-t border-white/[0.07] flex flex-wrap items-center gap-3">
              {isDownloaded && canUseNativeUpdater ? (
                <button
                  type="button"
                  disabled={installing}
                  onClick={handleInstallAndRestart}
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCw className={`w-4 h-4 ${installing ? 'animate-spin' : ''}`} />
                  <span>
                    {installing
                      ? 'Backup e riavvio in corso...'
                      : 'Riavvia e Applica Aggiornamento'}
                  </span>
                </button>
              ) : hasUpdate && canUseNativeUpdater ? (
                <button
                  type="button"
                  disabled={isDownloading || creatingBackup}
                  onClick={handleDownloadDesktopUpdate}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {creatingBackup
                      ? 'Backup di sicurezza in corso...'
                      : isDownloading
                      ? `Download ${downloadPercent}%...`
                      : `Scarica Aggiornamento v${latestVersion}`}
                  </span>
                </button>
              ) : hasUpdate && preferredWindowsAsset ? (
                <a
                  href={preferredWindowsAsset.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (autoBackup) {
                      runPreUpdateBackup();
                    }
                  }}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    Scarica {preferredWindowsAsset.name} (
                    {formatBytes(preferredWindowsAsset.sizeBytes)})
                  </span>
                </a>
              ) : null}

              <button
                type="button"
                disabled={creatingBackup}
                onClick={async () => {
                  const ok = await runPreUpdateBackup();
                  if (ok) {
                    notify('ok', 'Backup di sicurezza creato: i tuoi dati sono protetti.');
                  }
                }}
                className="px-4 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {creatingBackup ? 'Salvataggio snapshot...' : 'Crea Backup di Sicurezza'}
                </span>
              </button>

              {!isDesktop && (
                <button
                  type="button"
                  disabled={installing}
                  onClick={handleInstallAndRestart}
                  className="px-4 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${installing ? 'animate-spin' : ''}`} />
                  <span>Ricarica e Aggiorna Interfaccia</span>
                </button>
              )}

              {updateStatus?.config.lastKnownReleaseUrl && (
                <a
                  href={updateStatus.config.lastKnownReleaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Apri Release su GitHub</span>
                </a>
              )}
            </div>

            {desktopUpdaterState?.error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-400/25 text-xs text-rose-200">
                Dettaglio updater desktop: {desktopUpdaterState.error}
              </div>
            )}
          </section>

          {/* Data Protection Guarantee */}
          <section className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3 max-w-2xl">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">
                  Protezione Dati durante gli Aggiornamenti
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Utenti, commesse, magazzino, foto, file, calendari e notifiche sono archiviati
                  in un volume separato dal programma eseguibile. Aggiornare o riavviare METATRON
                  non cancella mai i tuoi dati.
                  {dataDirPath && (
                    <span className="block font-mono text-[11px] text-slate-300 mt-1">
                      Archivio dati locale: {dataDirPath}
                    </span>
                  )}
                  {lastBackupFile && (
                    <span className="block font-mono text-[11px] text-emerald-300 mt-1">
                      Ultimo backup pre-aggiornamento: {lastBackupFile}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {bridge?.openDataFolder && (
              <button
                type="button"
                onClick={() => bridge.openDataFolder()}
                className="px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white flex items-center gap-2 shrink-0 cursor-pointer transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Apri Cartella Dati</span>
              </button>
            )}
          </section>

          {/* Release Notes & Assets */}
          {(releaseNotes || assets.length > 0) && (
            <section className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">
                  Dettagli Release {latestVersion ? `v${latestVersion}` : ''}
                </h3>
                {updateStatus?.config.lastKnownPublishedAt && (
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    Pubblicata il {formatDateTime(updateStatus.config.lastKnownPublishedAt)}
                  </span>
                )}
              </div>

              {releaseNotes && (
                <pre className="p-4 rounded-lg bg-[#080a12] border border-white/[0.06] text-xs font-sans text-slate-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {releaseNotes}
                </pre>
              )}

              {assets.length > 0 && (
                <div className="divide-y divide-white/[0.06] border-t border-white/[0.07]">
                  {assets.map((asset) => (
                    <div
                      key={asset.name}
                      className="py-2.5 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-slate-200 truncate">{asset.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {asset.platform.toUpperCase()} · {formatBytes(asset.sizeBytes)}
                        </div>
                      </div>
                      <a
                        href={asset.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-white/[0.07] hover:bg-indigo-600 text-xs font-medium text-white flex items-center gap-1.5 shrink-0 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Scarica</span>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* GitHub Update Source Configuration */}
          <form
            onSubmit={handleSaveConfig}
            className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">
                  Sorgente Aggiornamenti Automatici (GitHub)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                Profilo: {currentUser.role === 'employer' ? 'Direzione' : 'Operatore'}
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Repository GitHub (formato <span className="font-mono">utente/nome-repo</span>)
              </label>
              <input
                type="text"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="es. mattiametatron/metatron-caricostudio"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#080a12] border border-white/12 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
              />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Quando compili con GitHub Actions, questo campo viene già precompilato
                automaticamente dentro l&apos;eseguibile <span className="font-mono">.exe</span>.
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-white/[0.07]">
              <label className="flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer">
                <span>Controlla automaticamente nuovi aggiornamenti all&apos;avvio e invia notifica</span>
                <input
                  type="checkbox"
                  checked={autoCheck}
                  onChange={(e) => setAutoCheck(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-xs text-slate-200 cursor-pointer">
                <span>Crea automaticamente uno snapshot di backup prima di ogni aggiornamento</span>
                <input
                  type="checkbox"
                  checked={autoBackup}
                  onChange={(e) => setAutoBackup(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                <span>Canale: GitHub Releases (stabile)</span>
              </div>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingConfig ? 'Salvataggio...' : 'Salva Impostazioni'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
