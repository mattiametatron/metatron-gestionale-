import React, { useMemo, useState } from 'react';
import {
  AlarmClock,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  Calendar as CalendarIcon,
  CheckCheck,
  ExternalLink,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { NotificationCategory } from '../types/warehouse';
import { SynologyAppId } from './SynologyDesktopOS';

export interface UnifiedNotification {
  id: string;
  source: 'server' | 'derived' | 'local';
  category: NotificationCategory;
  title: string;
  body: string;
  targetApp: SynologyAppId;
  timestamp: string;
  read: boolean;
  badgeText?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  notifications: UnifiedNotification[];
  onClose: () => void;
  onMarkRead: (item: UnifiedNotification) => void;
  onMarkAllRead: () => void;
  onDismiss: (item: UnifiedNotification) => void;
  onOpenApp: (appId: SynologyAppId) => void;
}

function formatRelTime(iso: string): string {
  if (!iso) return '';
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return iso;
    const diffSec = Math.floor((Date.now() - t) / 1000);
    if (diffSec < 60 && diffSec >= -60) return 'Adesso';
    if (diffSec >= 60 && diffSec < 3600) return `${Math.floor(diffSec / 60)} min fa`;
    if (diffSec >= 3600 && diffSec < 86400) return `${Math.floor(diffSec / 3600)} ore fa`;
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onOpenApp,
}) => {
  const [filter, setFilter] = useState<'all' | NotificationCategory>('all');

  const counts = useMemo(() => {
    const unread = notifications.filter((n) => !n.read).length;
    const byCat = {
      message: notifications.filter((n) => n.category === 'message').length,
      low_stock: notifications.filter((n) => n.category === 'low_stock').length,
      stock_movement: notifications.filter((n) => n.category === 'stock_movement').length,
      calendar: notifications.filter((n) => n.category === 'calendar' || n.category === 'alarm').length,
    };
    return { unread, byCat };
  }, [notifications]);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'calendar') {
      return notifications.filter(
        (n) => n.category === 'calendar' || n.category === 'alarm'
      );
    }
    return notifications.filter((n) => n.category === filter);
  }, [notifications, filter]);

  if (!isOpen) return null;

  const getVisuals = (n: UnifiedNotification) => {
    switch (n.category) {
      case 'message':
        return {
          icon: Send,
          iconBg: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
          label: 'Messaggi & File',
        };
      case 'low_stock':
        return {
          icon: AlertTriangle,
          iconBg: 'bg-rose-500/20 text-rose-300 border-rose-400/35',
          label: 'Sotto Scorta',
        };
      case 'stock_movement':
        return {
          icon: n.badgeText === 'CARICO' ? ArrowDownCircle : ArrowUpCircle,
          iconBg:
            n.badgeText === 'CARICO'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
              : 'bg-amber-500/20 text-amber-300 border-amber-400/30',
          label: 'Carico / Scarico',
        };
      case 'alarm':
        return {
          icon: AlarmClock,
          iconBg: 'bg-violet-500/20 text-violet-300 border-violet-400/30',
          label: 'Orologio',
        };
      case 'calendar':
      default:
        return {
          icon: CalendarIcon,
          iconBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
          label: 'Calendario',
        };
    }
  };

  return (
    <>
      <div
        className="no-print fixed inset-0 z-40"
        onClick={onClose}
      />
      <aside className="no-print fixed bottom-13 right-3 z-50 w-[94vw] max-w-[420px] max-h-[80vh] flex flex-col rounded-2xl bg-[#0d101c]/96 backdrop-blur-2xl border border-white/14 shadow-[0_24px_70px_rgba(0,0,0,0.8)] text-white overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold tracking-tight text-white">
                Centro Notifiche
              </h3>
              <p className="text-[11px] text-white/55">
                {counts.unread > 0
                  ? `${counts.unread} non lette · ${notifications.length} totali`
                  : 'Tutte le notifiche sono state lette'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {counts.unread > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-[11px] font-semibold text-indigo-200 flex items-center gap-1 cursor-pointer transition-colors"
                title="Segna tutte come lette"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Letto tutto</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/[0.07] hover:bg-white/[0.15] text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Filter Bar */}
        <div className="px-3 py-2 border-b border-white/[0.08] flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 bg-black/20">
          {[
            { id: 'all' as const, label: `Tutte (${notifications.length})` },
            { id: 'message' as const, label: `File/Msg (${counts.byCat.message})` },
            { id: 'low_stock' as const, label: `Sotto Scorta (${counts.byCat.low_stock})` },
            { id: 'stock_movement' as const, label: `Movimenti (${counts.byCat.stock_movement})` },
            { id: 'calendar' as const, label: `Calendario (${counts.byCat.calendar})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.07]">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-white/50">
              <Bell className="w-8 h-8 mx-auto mb-2 text-white/25" />
              Nessuna notifica in questa sezione.
            </div>
          ) : (
            filtered.map((item) => {
              const vis = getVisuals(item);
              const Icon = vis.icon;
              return (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors hover:bg-white/[0.05] ${
                    item.read ? 'opacity-72' : 'bg-indigo-500/[0.07]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${vis.iconBg}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                          {vis.label}
                        </span>
                        <span className="text-[10px] font-mono text-white/45 shrink-0">
                          {formatRelTime(item.timestamp)}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
                        {!item.read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                        )}
                        <span className="truncate">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-white/70 mt-0.5 leading-snug line-clamp-2">
                        {item.body}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onMarkRead(item);
                            onOpenApp(item.targetApp);
                            onClose();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.09] hover:bg-indigo-600 text-[11px] font-semibold text-white flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Apri</span>
                        </button>
                        {!item.read && (
                          <button
                            type="button"
                            onClick={() => onMarkRead(item)}
                            className="px-2 py-1 rounded-lg hover:bg-white/[0.08] text-[11px] text-white/60 hover:text-white cursor-pointer"
                          >
                            Segna letto
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDismiss(item)}
                          className="ml-auto p-1 rounded-lg hover:bg-rose-500/25 text-white/40 hover:text-rose-300 cursor-pointer"
                          title="Rimuovi notifica"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};
