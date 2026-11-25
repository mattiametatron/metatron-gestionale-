import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AuthUser } from '../types/warehouse';
import { authFetch } from '../utils/authSession';

interface SystemMetricsPayload {
  timestamp: string;
  host: {
    nodeName: string;
    hostname: string;
    hostnameLabel: string;
    platform: string;
    release: string;
    arch: string;
    nodeVersion: string;
    uptimeSeconds: number;
    processUptimeSeconds: number;
    port: number;
  };
  cpu: {
    model: string;
    cores: number;
    speedMhz: number;
    usagePercent: number;
    perCorePercent: number[];
    loadAvg: number[];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
  };
  disk: {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usedPercent: number;
  };
  networkInterfaces: Array<{
    name: string;
    address: string;
    family: string;
    mac: string;
    internal: boolean;
    cidr: string | null;
  }>;
  services: Array<{
    id: string;
    name: string;
    status: string;
    detail: string;
  }>;
  history: Array<{
    ts: string;
    cpuPercent: number;
    memPercent: number;
  }>;
}

interface ServerMonitorAppProps {
  currentUser: AuthUser;
  onOpenControlPanel?: () => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[idx]}`;
}

function formatUptime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0m';
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}g ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${sec % 60}s`;
}

export const ServerMonitorApp: React.FC<ServerMonitorAppProps> = ({
  onOpenControlPanel,
}) => {
  const [metrics, setMetrics] = useState<SystemMetricsPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const loadMetrics = useCallback(async () => {
    try {
      const resp = await authFetch('/api/system/metrics');
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        setError(data?.error || 'Impossibile leggere la telemetria del server.');
        return;
      }
      setMetrics(data as SystemMetricsPayload);
      setError(null);
    } catch {
      setError('Connessione al core METATRON temporaneamente non disponibile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(loadMetrics, 2500);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadMetrics]);

  const renderTelemetryChart = (
    points: Array<{ ts: string; cpuPercent: number; memPercent: number }>
  ) => {
    const w = 640;
    const h = 150;
    const padX = 8;
    const padY = 12;
    const usableW = w - padX * 2;
    const usableH = h - padY * 2;

    const safePoints =
      points.length >= 2
        ? points
        : [
            { ts: '', cpuPercent: points[0]?.cpuPercent || 0, memPercent: points[0]?.memPercent || 0 },
            { ts: '', cpuPercent: points[0]?.cpuPercent || 0, memPercent: points[0]?.memPercent || 0 },
          ];

    const buildPath = (key: 'cpuPercent' | 'memPercent') =>
      safePoints
        .map((pt, idx) => {
          const x = padX + (idx / Math.max(1, safePoints.length - 1)) * usableW;
          const y = padY + usableH - (Math.min(100, Math.max(0, pt[key])) / 100) * usableH;
          return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    const cpuLine = buildPath('cpuPercent');
    const memLine = buildPath('memPercent');
    const cpuArea = `${cpuLine} L${(padX + usableW).toFixed(1)},${(padY + usableH).toFixed(1)} L${padX},${(padY + usableH).toFixed(1)} Z`;

    return (
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-40 overflow-visible"
        role="img"
        aria-label="Andamento utilizzo CPU e memoria RAM"
      >
        <defs>
          <linearGradient id="metatronCpuFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = padY + usableH - (pct / 100) * usableH;
          return (
            <g key={pct}>
              <line
                x1={padX}
                y1={y}
                x2={w - padX}
                y2={y}
                stroke="rgba(255,255,255,0.07)"
                strokeDasharray="3 4"
              />
              <text
                x={w - padX}
                y={y - 3}
                textAnchor="end"
                fill="rgba(255,255,255,0.35)"
                fontSize="9"
                fontFamily="monospace"
              >
                {pct}%
              </text>
            </g>
          );
        })}
        <path d={cpuArea} fill="url(#metatronCpuFill)" />
        <path
          d={memLine}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d={cpuLine}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0b0e17] text-slate-100 overflow-hidden">
      {/* Top Bar (3-zone contract: Breadcrumb / Context — Actions) */}
      <header className="px-6 py-3.5 border-b border-white/[0.08] bg-[#0f1320] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/15 border border-indigo-400/25 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4 text-indigo-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-white truncate">
              Monitor Risorse Server
            </h2>
            <p className="text-xs text-slate-400 truncate font-mono tabular-nums">
              {metrics
                ? `${metrics.host.nodeName} · ${metrics.host.platform} ${metrics.host.arch} · Kernel ${metrics.host.release}`
                : 'Lettura telemetria hardware in corso...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              autoRefresh
                ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200'
                : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            {autoRefresh ? 'Aggiornamento Live (2.5s)' : 'In pausa'}
          </button>

          <button
            type="button"
            onClick={loadMetrics}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Aggiorna</span>
          </button>

          {onOpenControlPanel && (
            <button
              type="button"
              onClick={onOpenControlPanel}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Sistema &amp; ISO</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/12 border border-rose-400/30 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && !metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-[#111626] border border-white/[0.07] animate-pulse"
              />
            ))}
          </div>
        ) : metrics ? (
          <>
            {/* 4-Column Primary Hardware KPI Strip */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#111626] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Processore (CPU)</span>
                  <Cpu className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white">
                  {metrics.cpu.usagePercent.toFixed(1)}%
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, metrics.cpu.usagePercent)}%` }}
                    className={`h-full rounded-full ${
                      metrics.cpu.usagePercent > 85
                        ? 'bg-rose-500'
                        : metrics.cpu.usagePercent > 65
                        ? 'bg-amber-400'
                        : 'bg-indigo-400'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                  {metrics.cpu.cores} core · Load {metrics.cpu.loadAvg.join(' / ')}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#111626] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Memoria RAM</span>
                  <MemoryStick className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white">
                  {metrics.memory.usedPercent.toFixed(1)}%
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, metrics.memory.usedPercent)}%` }}
                    className={`h-full rounded-full ${
                      metrics.memory.usedPercent > 88
                        ? 'bg-rose-500'
                        : metrics.memory.usedPercent > 72
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                  {formatBytes(metrics.memory.usedBytes)} / {formatBytes(metrics.memory.totalBytes)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#111626] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Disco Principale</span>
                  <HardDrive className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white">
                  {metrics.disk.usedPercent.toFixed(1)}%
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, metrics.disk.usedPercent)}%` }}
                    className={`h-full rounded-full ${
                      metrics.disk.usedPercent > 90
                        ? 'bg-rose-500'
                        : metrics.disk.usedPercent > 75
                        ? 'bg-amber-400'
                        : 'bg-sky-400'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                  Liberi {formatBytes(metrics.disk.freeBytes)} di {formatBytes(metrics.disk.totalBytes)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#111626] border border-white/[0.08] space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium">Attività Sistema</span>
                  <Clock className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white">
                  {formatUptime(metrics.host.uptimeSeconds)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  Core attivo da {formatUptime(metrics.host.processUptimeSeconds)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate">
                  RSS Core: {formatBytes(metrics.memory.processRssBytes)}
                </div>
              </div>
            </section>

            {/* Live Graph + Core Breakdown */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Andamento CPU e RAM in tempo reale
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
                      {metrics.cpu.model}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-300 font-mono tabular-nums">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-indigo-400 inline-block" />
                      CPU {metrics.cpu.usagePercent.toFixed(1)}%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                      RAM {metrics.memory.usedPercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                {renderTelemetryChart(metrics.history)}
              </div>

              <div className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Carico per Core</h3>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    {metrics.cpu.cores} thread
                  </span>
                </div>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {metrics.cpu.perCorePercent.map((val, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono tabular-nums">
                        <span className="text-slate-400">Core {idx + 1}</span>
                        <span className="text-slate-200">{val}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                        <div
                          style={{ width: `${Math.min(100, val)}%` }}
                          className="h-full rounded-full bg-indigo-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Services + Network Interfaces */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Servizi Core METATRON</h3>
                  <span className="text-xs text-slate-400 font-mono tabular-nums">
                    {metrics.services.length} attivi
                  </span>
                </div>
                <div className="divide-y divide-white/[0.06]">
                  {metrics.services.map((svc) => (
                    <div
                      key={svc.id}
                      className="py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {svc.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono tabular-nums">
                          {svc.detail}
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-300 flex items-center gap-1 shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Attivo
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#111626] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Network className="w-4 h-4 text-sky-400" />
                    <span>Interfacce di Rete</span>
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    {metrics.host.hostnameLabel}:{metrics.host.port}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-[11px] text-slate-400">
                        <th className="py-2 pr-3 font-medium">Interfaccia</th>
                        <th className="py-2 pr-3 font-medium">Indirizzo</th>
                        <th className="py-2 pr-3 font-medium">Protocollo</th>
                        <th className="py-2 font-medium text-right">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] font-mono tabular-nums">
                      {metrics.networkInterfaces.map((ni, idx) => (
                        <tr key={`${ni.name}-${ni.address}-${idx}`} className="hover:bg-white/[0.03]">
                          <td className="py-2 pr-3 text-slate-200">{ni.name}</td>
                          <td className="py-2 pr-3 text-sky-300">{ni.address}</td>
                          <td className="py-2 pr-3 text-slate-400">{ni.family}</td>
                          <td className="py-2 text-right text-slate-400 font-sans">
                            {ni.internal ? 'Locale' : 'Rete LAN'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};
