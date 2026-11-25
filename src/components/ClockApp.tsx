import React, { useEffect, useRef, useState } from 'react';
import {
  AlarmClock,
  Bell,
  Clock as ClockIcon,
  Flag,
  Globe,
  Hourglass,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Volume2,
} from 'lucide-react';
import { AuthUser } from '../types/warehouse';

interface AlarmItem {
  id: string;
  time: string; // HH:MM
  label: string;
  enabled: boolean;
  days: number[]; // 0=Dom .. 6=Sab
}

interface WorldClockCity {
  id: string;
  label: string;
  timeZone: string;
}

const AVAILABLE_WORLD_CITIES: WorldClockCity[] = [
  { id: 'rome', label: 'Roma / Milano', timeZone: 'Europe/Rome' },
  { id: 'london', label: 'Londra', timeZone: 'Europe/London' },
  { id: 'berlin', label: 'Berlino / Parigi', timeZone: 'Europe/Berlin' },
  { id: 'new_york', label: 'New York', timeZone: 'America/New_York' },
  { id: 'los_angeles', label: 'Los Angeles', timeZone: 'America/Los_Angeles' },
  { id: 'dubai', label: 'Dubai', timeZone: 'Asia/Dubai' },
  { id: 'shanghai', label: 'Shanghai', timeZone: 'Asia/Shanghai' },
  { id: 'tokyo', label: 'Tokyo', timeZone: 'Asia/Tokyo' },
  { id: 'sydney', label: 'Sydney', timeZone: 'Australia/Sydney' },
];

const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function playClockChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [880, 1174.66, 1318.51];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
      gain.gain.setValueAtTime(0.09, ctx.currentTime + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.14);
      osc.stop(ctx.currentTime + i * 0.14 + 0.36);
    });
    window.setTimeout(() => ctx.close().catch(() => {}), 1000);
  } catch {
    // ignore audio restrictions
  }
}

function formatStopwatch(ms: number): string {
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60) % 60;
  const hr = Math.floor(totalSec / 3600);
  const p = (n: number) => String(n).padStart(2, '0');
  return hr > 0 ? `${p(hr)}:${p(min)}:${p(sec)}.${p(cs)}` : `${p(min)}:${p(sec)}.${p(cs)}`;
}

function formatCountdown(totalSec: number): string {
  const clamped = Math.max(0, Math.ceil(totalSec));
  const hr = Math.floor(clamped / 3600);
  const min = Math.floor((clamped % 3600) / 60);
  const sec = clamped % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(hr)}:${p(min)}:${p(sec)}`;
}

interface ClockAppProps {
  currentUser: AuthUser;
  onTriggerNotification?: (title: string, body: string) => void;
}

export const ClockApp: React.FC<ClockAppProps> = ({
  currentUser,
  onTriggerNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'clock' | 'alarms' | 'stopwatch' | 'timer'>(
    'clock'
  );
  const [now, setNow] = useState<Date>(() => new Date());

  // World clocks
  const worldKey = `caricostudio_world_clocks_${currentUser.id}`;
  const [worldCityIds, setWorldCityIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(worldKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return ['london', 'new_york', 'dubai', 'tokyo'];
  });

  // Alarms
  const alarmsKey = `caricostudio_alarms_${currentUser.id}`;
  const [alarms, setAlarms] = useState<AlarmItem[]>(() => {
    try {
      const raw = localStorage.getItem(alarmsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [newAlarmTime, setNewAlarmTime] = useState('08:30');
  const [newAlarmLabel, setNewAlarmLabel] = useState('');
  const [newAlarmDays, setNewAlarmDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [ringingBanner, setRingingBanner] = useState<string | null>(null);
  const lastTriggeredMinuteRef = useRef<string>('');

  // Stopwatch
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsedMs, setSwElapsedMs] = useState(0);
  const [swLaps, setSwLaps] = useState<Array<{ lap: number; totalMs: number; splitMs: number }>>(
    []
  );
  const swStartRef = useRef<number>(0);

  // Timer
  const [timerHours, setTimerHours] = useState(0);
  const [timerMinutes, setTimerMinutes] = useState(5);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTotalSec, setTimerTotalSec] = useState(300);
  const [timerRemainingSec, setTimerRemainingSec] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerEndAtRef = useRef<number>(0);

  const onTriggerRef = useRef(onTriggerNotification);
  onTriggerRef.current = onTriggerNotification;

  // Live 1s clock + alarm watcher
  useEffect(() => {
    const id = window.setInterval(() => {
      const current = new Date();
      setNow(current);

      const hh = String(current.getHours()).padStart(2, '0');
      const mm = String(current.getMinutes()).padStart(2, '0');
      const currentHHMM = `${hh}:${mm}`;
      const minuteStamp = `${current.toISOString().slice(0, 10)}_${currentHHMM}`;
      const dayOfWeek = current.getDay();

      if (lastTriggeredMinuteRef.current !== minuteStamp) {
        const hit = alarms.find(
          (a) =>
            a.enabled &&
            a.time === currentHHMM &&
            (a.days.length === 0 || a.days.includes(dayOfWeek))
        );
        if (hit) {
          lastTriggeredMinuteRef.current = minuteStamp;
          playClockChime();
          const label = hit.label || 'Sveglia programmata';
          setRingingBanner(`Sveglia ${hit.time} — ${label}`);
          onTriggerRef.current?.(`Sveglia ${hit.time}`, label);
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [alarms]);

  // High-frequency stopwatch ticker
  useEffect(() => {
    if (!swRunning) return;
    swStartRef.current = performance.now() - swElapsedMs;
    let rafId = 0;
    const tick = () => {
      setSwElapsedMs(performance.now() - swStartRef.current);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swRunning]);

  // Countdown timer ticker
  useEffect(() => {
    if (!timerRunning) return;
    timerEndAtRef.current = Date.now() + timerRemainingSec * 1000;
    const id = window.setInterval(() => {
      const rem = (timerEndAtRef.current - Date.now()) / 1000;
      if (rem <= 0) {
        setTimerRemainingSec(0);
        setTimerRunning(false);
        playClockChime();
        setRingingBanner('Timer terminato!');
        onTriggerRef.current?.('Timer terminato', 'Il conto alla rovescia dell\'Orologio è arrivato a 00:00.');
      } else {
        setTimerRemainingSec(rem);
      }
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning]);

  const saveAlarms = (next: AlarmItem[]) => {
    setAlarms(next);
    try {
      localStorage.setItem(alarmsKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleAddAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlarmTime) return;
    const item: AlarmItem = {
      id: `alm_${Date.now()}`,
      time: newAlarmTime,
      label: newAlarmLabel.trim() || 'Promemoria',
      enabled: true,
      days: [...newAlarmDays],
    };
    saveAlarms([...alarms, item].sort((a, b) => a.time.localeCompare(b.time)));
    setNewAlarmLabel('');
  };

  const toggleWorldCity = (cityId: string) => {
    const next = worldCityIds.includes(cityId)
      ? worldCityIds.filter((id) => id !== cityId)
      : [...worldCityIds, cityId];
    setWorldCityIds(next);
    try {
      localStorage.setItem(worldKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const applyTimerPreset = (minutes: number) => {
    setTimerRunning(false);
    const total = minutes * 60;
    setTimerHours(Math.floor(minutes / 60));
    setTimerMinutes(minutes % 60);
    setTimerSeconds(0);
    setTimerTotalSec(total);
    setTimerRemainingSec(total);
  };

  const handleApplyCustomTimer = () => {
    const total = Math.max(1, timerHours * 3600 + timerMinutes * 60 + timerSeconds);
    setTimerRunning(false);
    setTimerTotalSec(total);
    setTimerRemainingSec(total);
  };

  // Analog watch angles
  const secDeg = now.getSeconds() * 6;
  const minDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
  const hrDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;

  const timerProgress =
    timerTotalSec > 0 ? Math.max(0, Math.min(1, timerRemainingSec / timerTotalSec)) : 0;
  const ringRadius = 92;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* Top Bar */}
      <div className="bg-[#0d101c] border-b border-white/10 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-indigo-500 to-violet-700 flex items-center justify-center shadow-md">
            <ClockIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Orologio &amp; Strumenti Tempo</h2>
            <p className="text-[11px] text-white/55">
              Fusi orari, sveglie con notifica, cronometro e timer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-white/[0.06] p-1 rounded-xl border border-white/10">
          {[
            { id: 'clock' as const, label: 'Orologio', icon: Globe },
            { id: 'alarms' as const, label: `Sveglie (${alarms.filter((a) => a.enabled).length})`, icon: AlarmClock },
            { id: 'stopwatch' as const, label: 'Cronometro', icon: Timer },
            { id: 'timer' as const, label: 'Timer', icon: Hourglass },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-white/65 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ringing Alert Banner */}
      {ringingBanner && (
        <div className="bg-amber-500 text-slate-950 px-5 py-2.5 flex items-center justify-between gap-3 text-xs font-extrabold shrink-0">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 animate-bounce" />
            <span>{ringingBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setRingingBanner(null)}
            className="px-3 py-1 rounded-lg bg-slate-950 text-white text-xs font-bold cursor-pointer"
          >
            Ferma
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-4xl mx-auto">
          {/* TAB 1: CLOCK & WORLD TIME */}
          {activeTab === 'clock' && (
            <div className="space-y-6">
              <div className="rounded-3xl bg-gradient-to-br from-[#121629] via-[#0e1222] to-[#0a0d17] border border-white/10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-8 shadow-2xl">
                {/* Analog Face */}
                <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
                  <circle cx="100" cy="100" r="94" fill="#090c16" stroke="rgba(255,255,255,0.16)" strokeWidth="2.5" />
                  {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i * 30 * Math.PI) / 180;
                    const x1 = 100 + Math.sin(angle) * 76;
                    const y1 = 100 - Math.cos(angle) * 76;
                    const x2 = 100 + Math.sin(angle) * 86;
                    const y2 = 100 - Math.cos(angle) * 86;
                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={i % 3 === 0 ? '#a5b4fc' : 'rgba(255,255,255,0.3)'}
                        strokeWidth={i % 3 === 0 ? '3' : '1.5'}
                        strokeLinecap="round"
                      />
                    );
                  })}
                  {/* Hour hand */}
                  <line
                    x1="100"
                    y1="100"
                    x2="100"
                    y2="52"
                    stroke="#ffffff"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    transform={`rotate(${hrDeg} 100 100)`}
                  />
                  {/* Minute hand */}
                  <line
                    x1="100"
                    y1="100"
                    x2="100"
                    y2="34"
                    stroke="#c7d2fe"
                    strokeWidth="3"
                    strokeLinecap="round"
                    transform={`rotate(${minDeg} 100 100)`}
                  />
                  {/* Second hand */}
                  <line
                    x1="100"
                    y1="112"
                    x2="100"
                    y2="24"
                    stroke="#f43f5e"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    transform={`rotate(${secDeg} 100 100)`}
                  />
                  <circle cx="100" cy="100" r="4.5" fill="#f43f5e" />
                </svg>

                {/* Digital Readout */}
                <div className="text-center sm:text-left flex-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                    Ora Locale · {Intl.DateTimeFormat().resolvedOptions().timeZone}
                  </div>
                  <div className="text-5xl sm:text-6xl font-black font-mono tabular-nums tracking-tight mt-2">
                    {now.toLocaleTimeString('it-IT', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                  <div className="text-sm text-white/75 mt-2 capitalize">
                    {now.toLocaleDateString('it-IT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* World Clocks */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                    Fusi Orari nel Mondo
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_WORLD_CITIES.map((city) => {
                      const active = worldCityIds.includes(city.id);
                      return (
                        <button
                          key={city.id}
                          type="button"
                          onClick={() => toggleWorldCity(city.id)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer transition-colors ${
                            active
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.12]'
                          }`}
                        >
                          {active ? '✓ ' : '+ '}
                          {city.label.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {AVAILABLE_WORLD_CITIES.filter((c) => worldCityIds.includes(c.id)).map((city) => {
                    const timeStr = now.toLocaleTimeString('it-IT', {
                      timeZone: city.timeZone,
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const dayStr = now.toLocaleDateString('it-IT', {
                      timeZone: city.timeZone,
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    });
                    return (
                      <div
                        key={city.id}
                        className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex flex-col justify-between gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white/90">{city.label}</span>
                          <Globe className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <div className="text-3xl font-black font-mono tabular-nums">{timeStr}</div>
                        <div className="text-[11px] text-white/55 capitalize">{dayStr}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALARMS */}
          {activeTab === 'alarms' && (
            <div className="space-y-5">
              <form
                onSubmit={handleAddAlarm}
                className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  Nuova Sveglia
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <input
                    type="time"
                    value={newAlarmTime}
                    onChange={(e) => setNewAlarmTime(e.target.value)}
                    required
                    className="sm:col-span-3 px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-lg font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={newAlarmLabel}
                    onChange={(e) => setNewAlarmLabel(e.target.value)}
                    placeholder="Etichetta (es. Ritiro Corriere, Riunione...)"
                    className="sm:col-span-6 px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="sm:col-span-3 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Aggiungi Sveglia</span>
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/55 mr-1">Ripeti:</span>
                  {WEEKDAYS_SHORT.map((day, idx) => {
                    const active = newAlarmDays.includes(idx);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setNewAlarmDays((prev) =>
                            prev.includes(idx)
                              ? prev.filter((d) => d !== idx)
                              : [...prev, idx]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white/[0.06] text-white/55 hover:bg-white/[0.12]'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </form>

              {alarms.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/55 text-xs">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-white/30" />
                  Nessuna sveglia impostata. Aggiungine una sopra: suonerà e apparirà anche nel Centro Notifiche.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {alarms.map((alm) => (
                    <div
                      key={alm.id}
                      className={`rounded-2xl border p-4 flex items-center justify-between gap-4 transition-colors ${
                        alm.enabled
                          ? 'bg-white/[0.05] border-indigo-400/30'
                          : 'bg-white/[0.02] border-white/10 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="text-3xl font-black font-mono tabular-nums">{alm.time}</div>
                        <div className="text-xs font-semibold text-white/85 mt-0.5">{alm.label}</div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          {alm.days.length === 0 || alm.days.length === 7
                            ? 'Tutti i giorni'
                            : alm.days.map((d) => WEEKDAYS_SHORT[d]).join(', ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            saveAlarms(
                              alarms.map((a) =>
                                a.id === alm.id ? { ...a, enabled: !a.enabled } : a
                              )
                            )
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                            alm.enabled
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-white/10 text-white/70'
                          }`}
                        >
                          {alm.enabled ? 'Attiva' : 'Spenta'}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveAlarms(alarms.filter((a) => a.id !== alm.id))}
                          className="p-2 rounded-xl bg-white/[0.06] hover:bg-rose-600/80 text-white/60 hover:text-white cursor-pointer"
                          title="Elimina sveglia"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STOPWATCH */}
          {activeTab === 'stopwatch' && (
            <div className="space-y-5">
              <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-8 text-center space-y-6">
                <div className="text-6xl sm:text-7xl font-black font-mono tabular-nums tracking-tight">
                  {formatStopwatch(swElapsedMs)}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSwRunning((r) => !r)}
                    className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                      swRunning
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    {swRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{swRunning ? 'Pausa' : swElapsedMs > 0 ? 'Riprendi' : 'Avvia'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!swRunning}
                    onClick={() => {
                      const prevTotal = swLaps[0]?.totalMs || 0;
                      setSwLaps((prev) => [
                        {
                          lap: prev.length + 1,
                          totalMs: swElapsedMs,
                          splitMs: swElapsedMs - prevTotal,
                        },
                        ...prev,
                      ]);
                    }}
                    className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-sm font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Flag className="w-4 h-4 text-sky-400" />
                    <span>Giro</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSwRunning(false);
                      setSwElapsedMs(0);
                      setSwLaps([]);
                    }}
                    className="px-4 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/15 text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Azzera</span>
                  </button>
                </div>
              </div>

              {swLaps.length > 0 && (
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                  <div className="px-4 py-2.5 bg-white/[0.04] border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/60 grid grid-cols-3">
                    <span>Giro</span>
                    <span>Parziale</span>
                    <span className="text-right">Totale</span>
                  </div>
                  <div className="divide-y divide-white/[0.06] max-h-60 overflow-y-auto">
                    {swLaps.map((l) => (
                      <div key={l.lap} className="px-4 py-2.5 text-xs font-mono tabular-nums grid grid-cols-3">
                        <span className="font-bold text-indigo-300">Giro #{l.lap}</span>
                        <span className="text-white/85">+{formatStopwatch(l.splitMs)}</span>
                        <span className="text-right font-bold text-white">{formatStopwatch(l.totalMs)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TIMER */}
          {activeTab === 'timer' && (
            <div className="space-y-5">
              <div className="rounded-3xl bg-white/[0.04] border border-white/10 p-6 sm:p-8 flex flex-col items-center gap-6">
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <svg viewBox="0 0 220 220" className="w-full h-full -rotate-90">
                    <circle
                      cx="110"
                      cy="110"
                      r={ringRadius}
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="110"
                      cy="110"
                      r={ringRadius}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringCircumference * (1 - timerProgress)}
                      className="transition-[stroke-dashoffset] duration-200"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-4xl font-black font-mono tabular-nums">
                      {formatCountdown(timerRemainingSec)}
                    </div>
                    <div className="text-[11px] text-white/50 mt-1">
                      {timerRunning ? 'In corso...' : 'Pronto'}
                    </div>
                  </div>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {[1, 3, 5, 10, 15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => applyTimerPreset(m)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.15] border border-white/10 text-xs font-mono font-bold cursor-pointer"
                    >
                      {m} min
                    </button>
                  ))}
                </div>

                {/* Custom H/M/S */}
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={timerHours}
                    onChange={(e) => setTimerHours(Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 px-2 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-center font-mono font-bold"
                  />
                  <span className="text-white/50">h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerMinutes}
                    onChange={(e) => setTimerMinutes(Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 px-2 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-center font-mono font-bold"
                  />
                  <span className="text-white/50">m</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Math.max(0, Number(e.target.value) || 0))}
                    className="w-16 px-2 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-center font-mono font-bold"
                  />
                  <span className="text-white/50">s</span>
                  <button
                    type="button"
                    onClick={handleApplyCustomTimer}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 font-bold cursor-pointer"
                  >
                    Imposta
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={timerRemainingSec <= 0}
                    onClick={() => setTimerRunning((r) => !r)}
                    className={`px-6 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 cursor-pointer disabled:opacity-40 ${
                      timerRunning
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    <span>{timerRunning ? 'Pausa' : 'Avvia Timer'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTimerRunning(false);
                      setTimerRemainingSec(timerTotalSec);
                    }}
                    className="px-4 py-3 rounded-2xl bg-white/[0.07] hover:bg-white/15 text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Ripristina</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
