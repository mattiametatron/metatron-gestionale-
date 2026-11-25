import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Pencil,
  Plus,
  RefreshCw,
  StickyNote,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import {
  AuthUser,
  CalendarEventKind,
  CalendarEventRecord,
  CalendarRecord,
  CargoLoad,
  DirectoryUser,
} from '../types/warehouse';
import { authFetch } from '../utils/authSession';

const CALENDAR_COLORS = [
  { hex: '#6366f1', label: 'Indaco' },
  { hex: '#0ea5e9', label: 'Azzurro' },
  { hex: '#10b981', label: 'Smeraldo' },
  { hex: '#f59e0b', label: 'Ambra' },
  { hex: '#f43f5e', label: 'Corallo' },
  { hex: '#8b5cf6', label: 'Viola' },
  { hex: '#ec4899', label: 'Magenta' },
  { hex: '#14b8a6', label: 'Ottanio' },
];

const WEEKDAYS_MON_FIRST = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTHS_IT = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatReadableDate(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    const s = d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return s.charAt(0).toUpperCase() + s.slice(1);
  } catch {
    return isoDate;
  }
}

function getKindMeta(kind: CalendarEventKind): {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
} {
  if (kind === 'appunto') {
    return {
      label: 'Appunto',
      icon: StickyNote,
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
    };
  }
  if (kind === 'promemoria') {
    return {
      label: 'Promemoria',
      icon: Bell,
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-200',
    };
  }
  if (kind === 'spedizione') {
    return {
      label: 'Spedizione',
      icon: Truck,
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    };
  }
  return {
    label: 'Appuntamento',
    icon: Clock,
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
  };
}

interface CalendarAppProps {
  currentUser: AuthUser;
  loads: CargoLoad[];
  syncVersion: number;
  onDataChanged?: (calendars: CalendarRecord[], events: CalendarEventRecord[]) => void;
}

export const CalendarApp: React.FC<CalendarAppProps> = ({
  currentUser,
  loads,
  syncVersion,
  onDataChanged,
}) => {
  const todayStr = useMemo(() => toDateStr(new Date()), []);
  const [viewYear, setViewYear] = useState<number>(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'month' | 'agenda'>('month');

  const [calendars, setCalendars] = useState<CalendarRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [hiddenCalendarIds, setHiddenCalendarIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Create/Edit Event Form
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evtCalendarId, setEvtCalendarId] = useState<string>('');
  const [evtKind, setEvtKind] = useState<CalendarEventKind>('appuntamento');
  const [evtTitle, setEvtTitle] = useState('');
  const [evtTime, setEvtTime] = useState('');
  const [evtEndTime, setEvtEndTime] = useState('');
  const [evtCommessa, setEvtCommessa] = useState('');
  const [evtNotes, setEvtNotes] = useState('');
  const [isSavingEvt, setIsSavingEvt] = useState(false);

  // Create/Edit Calendar Modal
  const [calModalOpen, setCalModalOpen] = useState(false);
  const [editingCalendarId, setEditingCalendarId] = useState<string | null>(null);
  const [calName, setCalName] = useState('');
  const [calColor, setCalColor] = useState(CALENDAR_COLORS[1].hex);
  const [calIsShared, setCalIsShared] = useState(true);
  const [calSelectedMembers, setCalSelectedMembers] = useState<string[]>([]);
  const [isSavingCal, setIsSavingCal] = useState(false);

  const loadCalendarData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [calsRes, evtsRes, dirRes] = await Promise.all([
        authFetch('/api/calendars'),
        authFetch('/api/calendar/events'),
        authFetch('/api/directory'),
      ]);
      const calsJson = calsRes.ok ? await calsRes.json() : null;
      const evtsJson = evtsRes.ok ? await evtsRes.json() : null;
      const dirJson = dirRes.ok ? await dirRes.json() : null;

      const nextCals: CalendarRecord[] = Array.isArray(calsJson?.calendars)
        ? calsJson.calendars
        : [];
      const nextEvts: CalendarEventRecord[] = Array.isArray(evtsJson?.events)
        ? evtsJson.events
        : [];
      const nextDir: DirectoryUser[] = Array.isArray(dirJson?.users) ? dirJson.users : [];

      setCalendars(nextCals);
      setEvents(nextEvts);
      setDirectory(nextDir.filter((u) => u.id !== currentUser.id));
      setEvtCalendarId((prev) =>
        prev && nextCals.some((c) => c.id === prev) ? prev : nextCals[0]?.id || ''
      );
      onDataChanged?.(nextCals, nextEvts);
    } catch {
      setErrorMsg('Errore durante il caricamento dei calendari.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id, onDataChanged]);

  useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData, syncVersion]);

  const calendarMap = useMemo(() => {
    const map = new Map<string, CalendarRecord>();
    calendars.forEach((c) => map.set(c.id, c));
    return map;
  }, [calendars]);

  const visibleEvents = useMemo(
    () => events.filter((e) => !hiddenCalendarIds.includes(e.calendarId)),
    [events, hiddenCalendarIds]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventRecord[]>();
    visibleEvents.forEach((e) => {
      const arr = map.get(e.date) || [];
      arr.push(e);
      map.set(e.date, arr);
    });
    return map;
  }, [visibleEvents]);

  const selectedDayEvents = useMemo(
    () => eventsByDate.get(selectedDate) || [],
    [eventsByDate, selectedDate]
  );

  const upcomingAgendaEvents = useMemo(
    () => visibleEvents.filter((e) => e.date >= todayStr).slice(0, 60),
    [visibleEvents, todayStr]
  );

  // Build 6-row month calendar grid (Monday-first)
  const monthCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0 .. Sun=6
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: Array<{ dateStr: string; dayNum: number; inCurrentMonth: boolean }> = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      cells.push({ dateStr: toDateStr(d), dayNum: d.getDate(), inCurrentMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      cells.push({ dateStr: toDateStr(d), dayNum: day, inCurrentMonth: true });
    }
    while (cells.length < 42) {
      const nextIdx = cells.length - (startWeekday + daysInMonth) + 1;
      const d = new Date(viewYear, viewMonth + 1, nextIdx);
      cells.push({ dateStr: toDateStr(d), dayNum: d.getDate(), inCurrentMonth: false });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEvtKind('appuntamento');
    setEvtTitle('');
    setEvtTime('');
    setEvtEndTime('');
    setEvtCommessa('');
    setEvtNotes('');
  };

  const startEditEvent = (ev: CalendarEventRecord) => {
    setEditingEventId(ev.id);
    setEvtCalendarId(ev.calendarId);
    setEvtKind(ev.kind);
    setEvtTitle(ev.title);
    setEvtTime(ev.time || '');
    setEvtEndTime(ev.endTime || '');
    setEvtCommessa(ev.commessaCode || '');
    setEvtNotes(ev.notes || '');
    setSelectedDate(ev.date);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim() || !evtCalendarId) return;
    setIsSavingEvt(true);
    setErrorMsg(null);
    try {
      const payload = {
        calendarId: evtCalendarId,
        date: selectedDate,
        time: evtTime || undefined,
        endTime: evtEndTime || undefined,
        title: evtTitle.trim(),
        notes: evtNotes.trim() || undefined,
        kind: evtKind,
        commessaCode: evtCommessa.trim() || undefined,
      };
      const res = editingEventId
        ? await authFetch(`/api/calendar/events/${editingEventId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/calendar/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErrorMsg(json?.error || 'Impossibile salvare l\'elemento.');
        return;
      }
      resetEventForm();
      await loadCalendarData();
    } catch {
      setErrorMsg('Errore di rete durante il salvataggio.');
    } finally {
      setIsSavingEvt(false);
    }
  };

  const handleDeleteEvent = async (evtId: string) => {
    try {
      await authFetch(`/api/calendar/events/${evtId}`, { method: 'DELETE' });
      if (editingEventId === evtId) resetEventForm();
      await loadCalendarData();
    } catch {
      setErrorMsg('Errore durante l\'eliminazione.');
    }
  };

  const openCreateCalendarModal = (defaultShared = true) => {
    setEditingCalendarId(null);
    setCalName('');
    setCalColor(defaultShared ? '#0ea5e9' : '#10b981');
    setCalIsShared(defaultShared);
    setCalSelectedMembers([]);
    setCalModalOpen(true);
  };

  const openEditCalendarModal = (cal: CalendarRecord) => {
    setEditingCalendarId(cal.id);
    setCalName(cal.name);
    setCalColor(cal.color);
    setCalIsShared(cal.isShared);
    setCalSelectedMembers(cal.memberIds.filter((id) => id !== currentUser.id));
    setCalModalOpen(true);
  };

  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (calName.trim().length < 2) return;
    setIsSavingCal(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: calName.trim(),
        color: calColor,
        isShared: calIsShared,
        memberIds: calIsShared ? calSelectedMembers : [],
      };
      const res = editingCalendarId
        ? await authFetch(`/api/calendars/${editingCalendarId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await authFetch('/api/calendars', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErrorMsg(json?.error || 'Errore salvataggio calendario.');
        return;
      }
      setCalModalOpen(false);
      await loadCalendarData();
      if (json.calendar?.id) {
        setEvtCalendarId(json.calendar.id);
      }
    } catch {
      setErrorMsg('Errore di rete durante il salvataggio del calendario.');
    } finally {
      setIsSavingCal(false);
    }
  };

  const handleDeleteCalendar = async (calId: string) => {
    try {
      await authFetch(`/api/calendars/${calId}`, { method: 'DELETE' });
      await loadCalendarData();
    } catch {
      setErrorMsg('Errore durante l\'eliminazione del calendario.');
    }
  };

  const personalCalendars = calendars.filter((c) => !c.isShared);
  const sharedCalendars = calendars.filter((c) => c.isShared);

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header */}
      <div className="bg-[#0d101c] text-white px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-rose-500 to-red-600 flex items-center justify-center shadow-md shrink-0">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">
              Calendario, Appunti &amp; Team Condiviso
            </h2>
            <p className="text-[11px] text-white/60">
              {calendars.length} calendari ({sharedCalendars.length} condivisi) · {events.length} appunti e appuntamenti
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-white/[0.08] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1 rounded-md cursor-pointer flex items-center gap-1 ${
                viewMode === 'month' ? 'bg-white text-slate-950 font-bold' : 'text-white/75'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Mese</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('agenda')}
              className={`px-2.5 py-1 rounded-md cursor-pointer flex items-center gap-1 ${
                viewMode === 'agenda' ? 'bg-white text-slate-950 font-bold' : 'text-white/75'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openCreateCalendarModal(true)}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Nuovo Calendario Condiviso</span>
          </button>

          <button
            type="button"
            onClick={loadCalendarData}
            className="p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white/80 hover:text-white cursor-pointer"
            title="Aggiorna"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-xs text-rose-800 font-semibold flex items-center justify-between shrink-0">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 3-Column Body */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* LEFT SIDEBAR: Calendars List */}
        <aside className="lg:col-span-3 bg-white border-r border-slate-200 p-3.5 overflow-y-auto space-y-4">
          {/* Personal Calendars */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                I Miei Calendari
              </span>
              <button
                type="button"
                onClick={() => openCreateCalendarModal(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                title="Nuovo calendario personale"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1">
              {personalCalendars.map((cal) => {
                const visible = !hiddenCalendarIds.includes(cal.id);
                return (
                  <div
                    key={cal.id}
                    className="group flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50"
                  >
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() =>
                          setHiddenCalendarIds((prev) =>
                            prev.includes(cal.id)
                              ? prev.filter((id) => id !== cal.id)
                              : [...prev, cal.id]
                          )
                        }
                        className="sr-only"
                      />
                      <span
                        style={{
                          backgroundColor: visible ? cal.color : 'transparent',
                          borderColor: cal.color,
                        }}
                        className="w-4 h-4 rounded flex items-center justify-center border-2 shrink-0"
                      >
                        {visible && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </span>
                      <span className="truncate">{cal.name}</span>
                    </label>
                    {cal.ownerId === currentUser.id && !cal.isDefaultPersonal && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEditCalendarModal(cal)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                          title="Modifica"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCalendar(cal.id)}
                          className="p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Elimina"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Calendars */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Calendari Condivisi
              </span>
              <button
                type="button"
                onClick={() => openCreateCalendarModal(true)}
                className="p-1 rounded hover:bg-indigo-50 text-indigo-600 cursor-pointer"
                title="Crea calendario condiviso"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {sharedCalendars.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-[11px] text-slate-500 space-y-2">
                <p>
                  Crea un calendario condiviso per coordinare consegne, turni e appunti con i colleghi registrati.
                </p>
                <button
                  type="button"
                  onClick={() => openCreateCalendarModal(true)}
                  className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
                >
                  + Crea Condiviso
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sharedCalendars.map((cal) => {
                  const visible = !hiddenCalendarIds.includes(cal.id);
                  const isOwner = cal.ownerId === currentUser.id;
                  return (
                    <div
                      key={cal.id}
                      className="group p-2 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-900 cursor-pointer min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={() =>
                              setHiddenCalendarIds((prev) =>
                                prev.includes(cal.id)
                                  ? prev.filter((id) => id !== cal.id)
                                  : [...prev, cal.id]
                              )
                            }
                            className="sr-only"
                          />
                          <span
                            style={{
                              backgroundColor: visible ? cal.color : 'transparent',
                              borderColor: cal.color,
                            }}
                            className="w-4 h-4 rounded flex items-center justify-center border-2 shrink-0"
                          >
                            {visible && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                          </span>
                          <span className="truncate">{cal.name}</span>
                        </label>
                        {isOwner && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditCalendarModal(cal)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                              title="Modifica membri"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCalendar(cal.id)}
                              className="p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer"
                              title="Elimina calendario"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-1 pl-6 text-[10px] text-slate-500 truncate">
                        {isOwner ? 'Creato da te' : `Di ${cal.ownerName}`} ·{' '}
                        {cal.members?.length || cal.memberIds.length} partecipanti
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: Month Grid or Agenda */}
        <section className="lg:col-span-5 flex flex-col min-h-0 overflow-hidden bg-slate-50 border-r border-slate-200">
          {viewMode === 'month' ? (
            <>
              {/* Month Toolbar */}
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h3 className="text-sm font-extrabold text-slate-900 min-w-[145px] text-center">
                    {MONTHS_IT[viewMonth]} {viewYear}
                  </h3>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setViewYear(now.getFullYear());
                    setViewMonth(now.getMonth());
                    setSelectedDate(toDateStr(now));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  Oggi
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200 shrink-0">
                {WEEKDAYS_MON_FIRST.map((wd) => (
                  <div
                    key={wd}
                    className="py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* 6x7 Month Cells */}
              <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0 overflow-y-auto">
                {monthCells.map((cell) => {
                  const dayEvents = eventsByDate.get(cell.dateStr) || [];
                  const isToday = cell.dateStr === todayStr;
                  const isSelected = cell.dateStr === selectedDate;
                  return (
                    <button
                      key={cell.dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.dateStr);
                        if (editingEventId) resetEventForm();
                      }}
                      className={`p-1.5 border-b border-r border-slate-200/80 text-left flex flex-col gap-1 transition-colors cursor-pointer min-h-[72px] ${
                        isSelected
                          ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-500'
                          : cell.inCurrentMonth
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-slate-100/70 text-slate-400 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center tabular-nums ${
                          isToday
                            ? 'bg-rose-600 text-white'
                            : isSelected
                            ? 'text-indigo-700'
                            : cell.inCurrentMonth
                            ? 'text-slate-800'
                            : 'text-slate-400'
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      <div className="w-full space-y-0.5 overflow-hidden">
                        {dayEvents.slice(0, 3).map((ev) => {
                          const cal = calendarMap.get(ev.calendarId);
                          return (
                            <div
                              key={ev.id}
                              style={{ backgroundColor: cal?.color || '#6366f1' }}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white truncate leading-tight"
                              title={`${ev.time ? `${ev.time} · ` : ''}${ev.title}`}
                            >
                              {ev.time ? `${ev.time} ` : ''}
                              {ev.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] font-bold text-slate-500 pl-1">
                            +{dayEvents.length - 3} altri
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            /* Agenda List View */
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                Prossimi Appuntamenti &amp; Appunti ({upcomingAgendaEvents.length})
              </div>
              {upcomingAgendaEvents.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-white text-center text-xs text-slate-500">
                  Nessun appuntamento o appunto futuro. Seleziona una data per aggiungerne uno.
                </div>
              ) : (
                upcomingAgendaEvents.map((ev) => {
                  const cal = calendarMap.get(ev.calendarId);
                  const km = getKindMeta(ev.kind);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        setSelectedDate(ev.date);
                        startEditEvent(ev);
                      }}
                      className="w-full p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 text-left flex items-start gap-3 cursor-pointer transition-colors"
                    >
                      <span
                        style={{ backgroundColor: cal?.color || '#6366f1' }}
                        className="w-1.5 self-stretch rounded-full shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-500">
                          <span className="font-bold text-slate-800">
                            {ev.date.split('-').reverse().join('/')}
                          </span>
                          {ev.time && <span>· {ev.time}{ev.endTime ? `–${ev.endTime}` : ''}</span>}
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-sans font-bold ${km.badgeClass}`}>
                            {km.label}
                          </span>
                          {cal && (
                            <span className="text-[10px] font-sans text-slate-500">
                              · {cal.name}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-extrabold text-slate-900 mt-1">{ev.title}</div>
                        {ev.notes && (
                          <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                            {ev.notes}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>

        {/* RIGHT PANEL: Selected Day Notes & Quick Editor */}
        <aside className="lg:col-span-4 bg-white flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="border-b border-slate-200 pb-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
              {selectedDate === todayStr ? 'OGGI' : 'GIORNO SELEZIONATO'}
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-0.5">
              {formatReadableDate(selectedDate)}
            </h3>
          </div>

          {/* Events & Notes on this Day */}
          <div className="space-y-2">
            {selectedDayEvents.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-xs text-slate-500 text-center">
                Nessun appunto o appuntamento per questa giornata.
              </div>
            ) : (
              selectedDayEvents.map((ev) => {
                const cal = calendarMap.get(ev.calendarId);
                const km = getKindMeta(ev.kind);
                const KIcon = km.icon;
                return (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          style={{ backgroundColor: cal?.color || '#6366f1' }}
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                        />
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 ${km.badgeClass}`}
                        >
                          <KIcon className="w-2.5 h-2.5" />
                          {km.label}
                        </span>
                        {ev.time && (
                          <span className="text-[11px] font-mono font-bold text-slate-700">
                            {ev.time}
                            {ev.endTime ? `–${ev.endTime}` : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditEvent(ev)}
                          className="p-1 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                          title="Modifica"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id)}
                          className="p-1 rounded hover:bg-rose-100 text-rose-600 cursor-pointer"
                          title="Elimina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs font-extrabold text-slate-900">{ev.title}</div>
                    {ev.notes && (
                      <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                        {ev.notes}
                      </p>
                    )}
                    <div className="pt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span>{cal?.name || 'Calendario'}</span>
                      <span>· di {ev.authorName}</span>
                      {ev.commessaCode && (
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {ev.commessaCode}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add / Edit Form */}
          <form
            onSubmit={handleSaveEvent}
            className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-900">
                {editingEventId ? 'Modifica Appunto / Evento' : '+ Nuovo Appunto o Appuntamento'}
              </span>
              {editingEventId && (
                <button
                  type="button"
                  onClick={resetEventForm}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Annulla
                </button>
              )}
            </div>

            {/* Kind Selector */}
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'appuntamento', label: 'Appuntamento' },
                  { id: 'appunto', label: 'Appunto / Nota' },
                  { id: 'promemoria', label: 'Promemoria' },
                  { id: 'spedizione', label: 'Spedizione' },
                ] as const
              ).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setEvtKind(k.id)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                    evtKind === k.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Calendario di destinazione
              </label>
              <select
                value={evtCalendarId}
                onChange={(e) => setEvtCalendarId(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isShared ? '👥 ' : '👤 '}
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Titolo *
              </label>
              <input
                type="text"
                required
                value={evtTitle}
                onChange={(e) => setEvtTitle(e.target.value)}
                placeholder="es. Ritiro corriere DHL / Appunti riunione..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Ora inizio (opz.)
                </label>
                <input
                  type="time"
                  value={evtTime}
                  onChange={(e) => setEvtTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Ora fine (opz.)
                </label>
                <input
                  type="time"
                  value={evtEndTime}
                  onChange={(e) => setEvtEndTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Collega Commessa (opz.)
              </label>
              <select
                value={evtCommessa}
                onChange={(e) => setEvtCommessa(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600"
              >
                <option value="">Nessuna commessa</option>
                {loads.map((ld) => (
                  <option key={ld.id} value={ld.code}>
                    {ld.code} — {ld.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Appunti / Dettagli
              </label>
              <textarea
                rows={3}
                value={evtNotes}
                onChange={(e) => setEvtNotes(e.target.value)}
                placeholder="Scrivi qui i tuoi appunti, note operative, indirizzi o promemoria..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-600 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingEvt}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold cursor-pointer transition-colors disabled:opacity-50"
            >
              {isSavingEvt
                ? 'Salvataggio...'
                : editingEventId
                ? 'Salva Modifiche'
                : 'Salva nel Calendario'}
            </button>
          </form>
        </aside>
      </div>

      {/* Create / Edit Calendar Modal */}
      {calModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveCalendar}
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingCalendarId ? 'Modifica Calendario' : 'Crea Nuovo Calendario'}
              </h3>
              <button
                type="button"
                onClick={() => setCalModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nome del Calendario *
              </label>
              <input
                type="text"
                required
                minLength={2}
                value={calName}
                onChange={(e) => setCalName(e.target.value)}
                placeholder="es. Spedizioni Team, Turni Magazzino..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Colore identificativo
              </label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setCalColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform ${
                      calColor === c.hex ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''
                    }`}
                    title={c.label}
                  >
                    {calColor === c.hex && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-200 cursor-pointer">
              <input
                type="checkbox"
                checked={calIsShared}
                onChange={(e) => setCalIsShared(e.target.checked)}
                className="rounded accent-indigo-600"
              />
              <div>
                <div className="text-xs font-bold text-indigo-950">
                  Calendario condiviso con altri utenti
                </div>
                <div className="text-[11px] text-indigo-700">
                  I colleghi selezionati vedranno e potranno aggiungere appunti ricevendo notifiche.
                </div>
              </div>
            </label>

            {calIsShared && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Seleziona utenti registrati ({calSelectedMembers.length} selezionati)
                </label>
                {directory.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                    Non ci sono ancora altri utenti registrati. Potrai aggiungerli modificando il calendario appena si registreranno.
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
                    {directory.map((u) => {
                      const checked = calSelectedMembers.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center justify-between gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                            checked
                              ? 'bg-indigo-50 border-indigo-300'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setCalSelectedMembers((prev) =>
                                  prev.includes(u.id)
                                    ? prev.filter((id) => id !== u.id)
                                    : [...prev, u.id]
                                )
                              }
                              className="rounded accent-indigo-600"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {u.name}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {u.role === 'employer' ? 'Direzione' : 'Operatore'}
                                {u.company ? ` · ${u.company}` : ''}
                              </div>
                            </div>
                          </div>
                          {u.isOnline && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Online" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCalModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={isSavingCal}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isSavingCal ? 'Salvataggio...' : editingCalendarId ? 'Aggiorna' : 'Crea Calendario'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
