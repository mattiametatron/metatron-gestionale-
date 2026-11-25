import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Crown,
  Users,
  FolderOpen,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Send,
  Camera,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  Package,
  Scale,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  X,
  Building2,
  Calendar,
} from 'lucide-react';
import {
  AuthUser,
  EmployerProfileOverview,
  StockMovement,
  UserRole,
} from '../types/warehouse';
import { authFetch } from '../utils/authSession';

interface EmployerCommessaItem {
  ownerId: string;
  ownerName: string;
  ownerCompany: string;
  ownerRole: UserRole;
  id: string;
  code: string;
  title: string;
  client: string;
  destination: string;
  carrier: string;
  departureDate: string;
  status: string;
  palletsCount: number;
  boxesCount: number;
  itemsCount: number;
  checkedItemsCount: number;
  weightKg: number;
  loadedAt: string | null;
  shippedAt: string | null;
  pallets: Array<{
    id: string;
    code: string;
    label: string;
    dimensionsCm?: string;
    customWeightKg?: number | null;
    wrapped?: boolean;
  }>;
  boxes: Array<{
    id: string;
    code: string;
    label: string;
    palletId?: string | null;
    sealed?: boolean;
  }>;
  items: Array<{
    id: string;
    sku: string;
    name: string;
    quantity: number;
    unitWeightKg: number;
    checked?: boolean;
    boxId?: string | null;
    palletId?: string | null;
  }>;
}

interface EmployerMovementItem extends StockMovement {
  ownerId: string;
  ownerName: string;
  ownerCompany: string;
}

interface OverviewTotals {
  usersCount: number;
  onlineUsersCount: number;
  commesseCount: number;
  palletsCount: number;
  movementsCount: number;
  carichiCount: number;
  scarichiCount: number;
  photosCount: number;
  filesCount: number;
  sharesCount: number;
}

interface UserDetailsPayload {
  profile: AuthUser & { isOnline: boolean };
  photos: Array<{
    id: string;
    commessaCode: string;
    commessaTitle?: string;
    caption?: string;
    capturedAt: string;
    sizeBytes: number;
    mimeType: string;
    fileExt: string;
  }>;
  filesState: {
    folders: Array<{ id: string; name: string; commessaCode?: string }>;
    files: Array<{
      id: string;
      folderId: string | null;
      name: string;
      mimeType: string;
      extension: string;
      sizeBytes: number;
      createdAt: string;
    }>;
  };
}

interface EmployerHubAppProps {
  currentUser: AuthUser;
  onOpenTeamShare: () => void;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const EmployerHubApp: React.FC<EmployerHubAppProps> = ({
  currentUser,
  onOpenTeamShare,
}) => {
  const [activeTab, setActiveTab] = useState<
    'profiles' | 'commesse' | 'movements' | 'media'
  >('profiles');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [totals, setTotals] = useState<OverviewTotals | null>(null);
  const [profiles, setProfiles] = useState<EmployerProfileOverview[]>([]);
  const [allCommesse, setAllCommesse] = useState<EmployerCommessaItem[]>([]);
  const [allMovements, setAllMovements] = useState<EmployerMovementItem[]>([]);

  const [userDetails, setUserDetails] = useState<UserDetailsPayload | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  // Filters
  const [commessaSearch, setCommessaSearch] = useState('');
  const [expandedCommessaKey, setExpandedCommessaKey] = useState<string | null>(null);

  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<
    'all' | 'carico' | 'scarico'
  >('all');
  const [movementCommessaFilter, setMovementCommessaFilter] = useState('all');

  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);

  // Authenticated photo blob previews for inspected profile
  const [photoBlobUrls, setPhotoBlobUrls] = useState<Record<string, string>>({});
  const photoUrlsRef = useRef<Record<string, string>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    id: string;
    userId: string;
    title: string;
    subtitle: string;
  } | null>(null);

  const revokePhotoBlobs = useCallback(() => {
    Object.values(photoUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    photoUrlsRef.current = {};
    setPhotoBlobUrls({});
  }, []);

  useEffect(() => {
    return () => {
      revokePhotoBlobs();
    };
  }, [revokePhotoBlobs]);

  const showTempNotice = useCallback((msg: string) => {
    setNoticeMsg(msg);
    window.setTimeout(() => {
      setNoticeMsg((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const loadOverview = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const resp = await authFetch('/api/employer/overview');
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        setErrorMsg(
          data?.error || 'Impossibile caricare i dati della Direzione.'
        );
        return;
      }
      setTotals(data.totals || null);
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      setAllCommesse(Array.isArray(data.allCommesse) ? data.allCommesse : []);
      setAllMovements(Array.isArray(data.allMovements) ? data.allMovements : []);
    } catch {
      setErrorMsg('Errore di connessione al server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadUserDetails = useCallback(
    async (userId: string) => {
      setIsLoadingDetails(true);
      revokePhotoBlobs();
      try {
        const resp = await authFetch(
          `/api/employer/users/${encodeURIComponent(userId)}/details`
        );
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.ok) {
          setErrorMsg(data?.error || 'Impossibile caricare il dettaglio profilo.');
          return;
        }
        setUserDetails({
          profile: data.profile,
          photos: Array.isArray(data.photos) ? data.photos : [],
          filesState: data.filesState || { folders: [], files: [] },
        });
      } catch {
        setErrorMsg('Errore caricamento profilo utente.');
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [revokePhotoBlobs]
  );

  useEffect(() => {
    if (!selectedUserId) {
      setUserDetails(null);
      revokePhotoBlobs();
      return;
    }
    loadUserDetails(selectedUserId);
  }, [selectedUserId, loadUserDetails, revokePhotoBlobs]);

  // Fetch authenticated image blobs when viewing Media tab for selected user
  useEffect(() => {
    if (activeTab !== 'media' || !selectedUserId || !userDetails) return;
    let cancelled = false;
    const photos = userDetails.photos || [];
    const missing = photos.filter((p) => !photoUrlsRef.current[p.id]);
    if (missing.length === 0) return;

    (async () => {
      for (const ph of missing.slice(0, 36)) {
        if (cancelled) return;
        try {
          const resp = await authFetch(
            `/api/employer/users/${encodeURIComponent(selectedUserId)}/photos/${encodeURIComponent(ph.id)}/file`
          );
          if (!resp.ok || cancelled) continue;
          const blob = await resp.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          photoUrlsRef.current[ph.id] = url;
          setPhotoBlobUrls((prev) => ({ ...prev, [ph.id]: url }));
        } catch {
          // ignore broken image
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedUserId, userDetails]);

  const handleToggleRole = async (profile: EmployerProfileOverview) => {
    const nextRole: UserRole =
      profile.role === 'employer' ? 'worker' : 'employer';
    setRoleUpdatingId(profile.id);
    setErrorMsg(null);
    try {
      const resp = await authFetch(
        `/api/employer/users/${encodeURIComponent(profile.id)}/role`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: nextRole }),
        }
      );
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        setErrorMsg(data?.error || 'Impossibile aggiornare il ruolo.');
        return;
      }
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, role: nextRole } : p))
      );
      showTempNotice(
        `${profile.name} impostato come ${
          nextRole === 'employer' ? 'Datore di Lavoro (Direzione)' : 'Operatore'
        }`
      );
    } catch {
      setErrorMsg('Errore di rete durante la modifica del ruolo.');
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const handleDownloadUserPhoto = async (
    userId: string,
    photoId: string,
    filename: string
  ) => {
    try {
      const resp = await authFetch(
        `/api/employer/users/${encodeURIComponent(userId)}/photos/${encodeURIComponent(photoId)}/file`
      );
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErrorMsg('Errore durante il download della foto.');
    }
  };

  const handleDownloadUserFile = async (
    userId: string,
    fileId: string,
    filename: string
  ) => {
    try {
      const resp = await authFetch(
        `/api/employer/users/${encodeURIComponent(userId)}/files/${encodeURIComponent(fileId)}/download`
      );
      if (!resp.ok) return;
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErrorMsg('Errore durante il download del file.');
    }
  };

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedUserId) || null,
    [profiles, selectedUserId]
  );

  const filteredCommesse = useMemo(() => {
    const q = commessaSearch.trim().toLowerCase();
    return allCommesse.filter((c) => {
      if (selectedUserId && c.ownerId !== selectedUserId) return false;
      if (q) {
        const hay = `${c.code} ${c.title} ${c.client} ${c.destination} ${c.ownerName} ${c.ownerCompany}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allCommesse, selectedUserId, commessaSearch]);

  const movementCommessaOptions = useMemo(() => {
    const set = new Set<string>();
    allMovements.forEach((m) => {
      if (selectedUserId && m.ownerId !== selectedUserId) return;
      if (m.commessaCode) set.add(m.commessaCode);
    });
    return Array.from(set).sort();
  }, [allMovements, selectedUserId]);

  const filteredMovements = useMemo(() => {
    const q = movementSearch.trim().toLowerCase();
    return allMovements.filter((m) => {
      if (selectedUserId && m.ownerId !== selectedUserId) return false;
      if (movementTypeFilter !== 'all' && m.type !== movementTypeFilter) return false;
      if (
        movementCommessaFilter !== 'all' &&
        (m.commessaCode || '') !== movementCommessaFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${m.sku} ${m.itemName} ${m.commessaCode || ''} ${m.ownerName} ${m.operatorName || ''} ${m.reason || ''} ${m.packageCode || ''} ${m.sealNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    allMovements,
    selectedUserId,
    movementTypeFilter,
    movementCommessaFilter,
    movementSearch,
  ]);

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Executive Golden-Obsidian Header */}
      <div className="bg-gradient-to-r from-[#0d101c] via-[#171422] to-[#1d1712] text-white px-5 py-3.5 border-b border-amber-400/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-lg shrink-0">
            <Crown className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight text-white">
                Portale Direzione — Controllo Aziendale
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Datore di Lavoro
              </span>
            </div>
            <p className="text-[11px] text-white/60">
              Supervisione in tempo reale di tutti i profili, commesse, carichi, scarichi, foto e file
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenTeamShare}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Scambio File &amp; Foto Team</span>
          </button>
          <button
            type="button"
            onClick={() => {
              loadOverview();
              if (selectedUserId) loadUserDetails(selectedUserId);
            }}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {totals && (
        <div className="bg-white border-b border-slate-200 px-5 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Profili Registrati
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-lg font-extrabold font-mono text-slate-900 tabular-nums">
                {totals.usersCount}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">
                {totals.onlineUsersCount} online
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Commesse Totali
            </div>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-lg font-extrabold font-mono text-slate-900 tabular-nums">
                {totals.commesseCount}
              </span>
              <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                {totals.palletsCount} bancali
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Carichi / Scarichi
            </div>
            <div className="mt-0.5 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-lg font-extrabold text-slate-900">
                {totals.movementsCount}
              </span>
              <span className="text-[11px] font-semibold text-emerald-600">
                +{totals.carichiCount}
              </span>
              <span className="text-[11px] font-semibold text-rose-600">
                -{totals.scarichiCount}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Foto &amp; Documenti
            </div>
            <div className="mt-0.5 flex items-baseline gap-2 font-mono tabular-nums">
              <span className="text-lg font-extrabold text-slate-900">
                {totals.photosCount + totals.filesCount}
              </span>
              <span className="text-[11px] text-slate-500">
                {totals.photosCount} foto · {totals.filesCount} file
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 col-span-2 sm:col-span-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
              Scambi tra Utenti
            </div>
            <div className="mt-0.5 flex items-baseline justify-between gap-2">
              <span className="text-lg font-extrabold font-mono text-amber-950 tabular-nums">
                {totals.sharesCount}
              </span>
              <button
                type="button"
                onClick={onOpenTeamShare}
                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
              >
                Apri
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {(errorMsg || noticeMsg) && (
        <div className="px-5 pt-3 shrink-0 space-y-2">
          {errorMsg && (
            <div className="px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                {errorMsg}
              </span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-rose-500 hover:text-rose-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {noticeMsg && (
            <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{noticeMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Split: Left Profiles Rail + Right Tabs Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Tutti i Profili */}
        <aside className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col min-h-0 overflow-hidden">
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              Filtra per Profilo
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                selectedUserId === null
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'hover:bg-slate-100 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    selectedUserId === null
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Tutta l&apos;Azienda</div>
                  <div
                    className={`text-[10px] ${
                      selectedUserId === null ? 'text-white/65' : 'text-slate-500'
                    }`}
                  >
                    {profiles.length} profili registrati
                  </div>
                </div>
              </div>
            </button>

            {profiles.map((p) => {
              const isSelected = selectedUserId === p.id;
              const initial = (p.name || p.email || 'U').trim().charAt(0).toUpperCase();
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedUserId(p.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          p.role === 'employer'
                            ? isSelected
                              ? 'bg-slate-950 text-amber-300'
                              : 'bg-amber-500 text-white'
                            : isSelected
                            ? 'bg-slate-950 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {initial}
                      </div>
                      {p.isOnline && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white"
                          title="Online ora"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate flex items-center gap-1">
                        <span className="truncate">{p.name}</span>
                        {p.role === 'employer' && (
                          <Crown
                            className={`w-3 h-3 shrink-0 ${
                              isSelected ? 'text-slate-900' : 'text-amber-500'
                            }`}
                          />
                        )}
                      </div>
                      <div
                        className={`text-[10px] font-mono truncate tabular-nums ${
                          isSelected ? 'text-slate-900/80' : 'text-slate-500'
                        }`}
                      >
                        {p.stats.commesseCount} comm. · {p.stats.movementsCount} mov.
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="lg:col-span-9 flex flex-col min-h-0 overflow-hidden">
          {/* Sub-Navigation Tabs */}
          <div className="bg-white border-b border-slate-200 px-5 pt-2.5 flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center gap-1">
              {[
                {
                  id: 'profiles' as const,
                  label: `Profili (${profiles.length})`,
                  icon: Users,
                },
                {
                  id: 'commesse' as const,
                  label: `Commesse (${filteredCommesse.length})`,
                  icon: FolderOpen,
                },
                {
                  id: 'movements' as const,
                  label: `Carichi & Scarichi (${filteredMovements.length})`,
                  icon: ArrowUpCircle,
                },
                {
                  id: 'media' as const,
                  label: 'Foto & File Profilo',
                  icon: Camera,
                },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                      active
                        ? 'border-amber-500 text-slate-950'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {selectedProfile && (
              <div className="flex items-center gap-2 pb-2 shrink-0">
                <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <span>Filtro: {selectedProfile.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(null)}
                    className="hover:text-slate-950 cursor-pointer"
                    title="Mostra tutta l'azienda"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Tab Panels */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB 1: PROFILI */}
            {activeTab === 'profiles' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(selectedProfile ? [selectedProfile] : profiles).map((p) => {
                  const isMe = p.id === currentUser.id;
                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white shrink-0 ${
                              p.role === 'employer' ? 'bg-amber-500' : 'bg-indigo-600'
                            }`}
                          >
                            {(p.name || 'U').trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {isMe && (
                                <span className="text-[10px] font-semibold text-slate-400">
                                  (Tu)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 truncate">
                              {p.email}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span
                                className={`font-semibold ${
                                  p.role === 'employer'
                                    ? 'text-amber-700'
                                    : 'text-indigo-700'
                                }`}
                              >
                                {p.role === 'employer'
                                  ? 'Datore di Lavoro / Direzione'
                                  : 'Operatore'}
                              </span>
                              {p.company && <span>· {p.company}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-[11px] font-bold ${
                              p.isOnline ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          >
                            {p.isOnline ? 'Online' : 'Offline'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-0.5">
                            Dal {new Date(p.createdAt).toLocaleDateString('it-IT')}
                          </div>
                        </div>
                      </div>

                      {/* Profile Metrics */}
                      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
                        <div className="p-2 rounded-lg bg-slate-50">
                          <div className="text-[10px] text-slate-500">Commesse</div>
                          <div className="text-sm font-extrabold font-mono text-slate-900 tabular-nums">
                            {p.stats.commesseCount}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50">
                          <div className="text-[10px] text-slate-500">Bancali</div>
                          <div className="text-sm font-extrabold font-mono text-slate-900 tabular-nums">
                            {p.stats.palletsCount}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50">
                          <div className="text-[10px] text-slate-500">Car./Scar.</div>
                          <div className="text-sm font-extrabold font-mono text-slate-900 tabular-nums">
                            {p.stats.movementsCount}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50">
                          <div className="text-[10px] text-slate-500">Foto/File</div>
                          <div className="text-sm font-extrabold font-mono text-slate-900 tabular-nums">
                            {p.stats.photosCount}/{p.stats.filesCount}
                          </div>
                        </div>
                      </div>

                      {/* Profile Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId(p.id);
                              setActiveTab('commesse');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                          >
                            Vedi Commesse
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId(p.id);
                              setActiveTab('movements');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                          >
                            Movimenti
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId(p.id);
                              setActiveTab('media');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                          >
                            Foto &amp; File
                          </button>
                        </div>

                        {!isMe && (
                          <button
                            type="button"
                            disabled={roleUpdatingId === p.id}
                            onClick={() => handleToggleRole(p)}
                            className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {p.role === 'employer' ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Imposta Operatore</span>
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Promuovi Direzione</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: TUTTE LE COMMESSE */}
            {activeTab === 'commesse' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={commessaSearch}
                      onChange={(e) => setCommessaSearch(e.target.value)}
                      placeholder="Cerca codice commessa, cliente, operatore..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="text-xs font-medium text-slate-500">
                    {filteredCommesse.length} commesse trovate
                  </div>
                </div>

                {filteredCommesse.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                    Nessuna commessa corrisponde ai filtri attuali.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredCommesse.map((c) => {
                      const rowKey = `${c.ownerId}_${c.id}`;
                      const isExpanded = expandedCommessaKey === rowKey;
                      return (
                        <div
                          key={rowKey}
                          className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCommessaKey(isExpanded ? null : rowKey)
                            }
                            className="w-full p-4 text-left hover:bg-slate-50/80 transition-colors flex flex-wrap items-center justify-between gap-3 cursor-pointer"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="mt-0.5 text-slate-400">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-extrabold text-indigo-700">
                                    {c.code}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900">
                                    {c.title}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  <span>
                                    Profilo:{' '}
                                    <strong className="text-slate-700">
                                      {c.ownerName}
                                    </strong>
                                  </span>
                                  {c.client && <span>Cliente: {c.client}</span>}
                                  {c.destination && (
                                    <span>Dest.: {c.destination}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                              <div className="text-right">
                                <div className="font-bold text-slate-900">
                                  {c.palletsCount}B · {c.boxesCount}S · {c.itemsCount} art.
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {c.weightKg} kg · spuntati {c.checkedItemsCount}/
                                  {c.itemsCount}
                                </div>
                              </div>
                              <div className="text-right text-[11px] font-sans">
                                <div className="text-slate-600">
                                  Carico: {formatDateTime(c.loadedAt)}
                                </div>
                                <div className="text-emerald-700 font-semibold">
                                  Scarico: {formatDateTime(c.shippedAt)}
                                </div>
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Bancali */}
                                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                                    Bancali ({c.pallets.length})
                                  </div>
                                  {c.pallets.length === 0 ? (
                                    <div className="text-xs text-slate-400">
                                      Nessun bancale registrato.
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                      {c.pallets.map((pl) => (
                                        <div
                                          key={pl.id}
                                          className="text-xs flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-0"
                                        >
                                          <span className="truncate">
                                            <strong className="font-mono text-indigo-700">
                                              {pl.code}
                                            </strong>{' '}
                                            {pl.label}
                                          </span>
                                          <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                                            {pl.customWeightKg
                                              ? `${pl.customWeightKg} kg`
                                              : pl.dimensionsCm || ''}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Scatole */}
                                <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                    <Scale className="w-3.5 h-3.5 text-emerald-600" />
                                    Scatole ({c.boxes.length})
                                  </div>
                                  {c.boxes.length === 0 ? (
                                    <div className="text-xs text-slate-400">
                                      Nessuna scatola registrata.
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                      {c.boxes.map((bx) => (
                                        <div
                                          key={bx.id}
                                          className="text-xs flex items-center justify-between gap-2 py-1 border-b border-slate-100 last:border-0"
                                        >
                                          <span className="truncate">
                                            <strong className="font-mono text-slate-800">
                                              {bx.code}
                                            </strong>{' '}
                                            {bx.label}
                                          </span>
                                          <span
                                            className={`text-[10px] font-semibold shrink-0 ${
                                              bx.sealed
                                                ? 'text-emerald-700'
                                                : 'text-slate-400'
                                            }`}
                                          >
                                            {bx.sealed ? 'Sigillata' : 'Aperta'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Articoli */}
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                                  Articoli Commessa ({c.items.length})
                                </div>
                                {c.items.length === 0 ? (
                                  <div className="p-3 text-xs text-slate-400">
                                    Nessun articolo inserito.
                                  </div>
                                ) : (
                                  <div className="max-h-52 overflow-y-auto">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 border-b border-slate-200">
                                        <tr>
                                          <th className="py-1.5 px-3">SKU</th>
                                          <th className="py-1.5 px-3">Descrizione</th>
                                          <th className="py-1.5 px-3 text-right">Q.tà</th>
                                          <th className="py-1.5 px-3 text-right">Peso</th>
                                          <th className="py-1.5 px-3 text-right">Stato</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {c.items.map((it) => (
                                          <tr key={it.id}>
                                            <td className="py-1.5 px-3 font-mono font-semibold text-slate-700">
                                              {it.sku}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-900">
                                              {it.name}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-mono tabular-nums">
                                              {it.quantity}
                                            </td>
                                            <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-500">
                                              {(
                                                (it.quantity || 0) *
                                                (it.unitWeightKg || 0)
                                              ).toFixed(1)}{' '}
                                              kg
                                            </td>
                                            <td className="py-1.5 px-3 text-right">
                                              <span
                                                className={`text-[11px] font-semibold ${
                                                  it.checked
                                                    ? 'text-emerald-700'
                                                    : 'text-slate-400'
                                                }`}
                                              >
                                                {it.checked ? 'Spuntato' : 'Da fare'}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TUTTI I CARICHI & SCARICHI */}
            {activeTab === 'movements' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={movementSearch}
                      onChange={(e) => setMovementSearch(e.target.value)}
                      placeholder="Cerca SKU, articolo, commessa, operatore, sigillo..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
                    {(['all', 'carico', 'scarico'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setMovementTypeFilter(t)}
                        className={`px-3 py-1 rounded-lg cursor-pointer transition-colors ${
                          movementTypeFilter === t
                            ? t === 'carico'
                              ? 'bg-emerald-600 text-white'
                              : t === 'scarico'
                              ? 'bg-rose-600 text-white'
                              : 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t === 'all'
                          ? 'Tutti'
                          : t === 'carico'
                          ? 'Solo Carichi'
                          : 'Solo Scarichi'}
                      </button>
                    ))}
                  </div>

                  <select
                    value={movementCommessaFilter}
                    onChange={(e) => setMovementCommessaFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">Tutte le commesse</option>
                    {movementCommessaOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                {filteredMovements.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                    Nessun movimento di carico o scarico trovato con i filtri selezionati.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="py-2.5 px-3">Data / Ora</th>
                          <th className="py-2.5 px-3">Profilo</th>
                          <th className="py-2.5 px-3">Tipo</th>
                          <th className="py-2.5 px-3">Commessa</th>
                          <th className="py-2.5 px-3">Articolo / SKU</th>
                          <th className="py-2.5 px-3 text-right">Quantità</th>
                          <th className="py-2.5 px-3">Collo / Causale</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMovements.slice(0, 300).map((m, idx) => {
                          const isCarico = m.type === 'carico';
                          return (
                            <tr
                              key={`${m.ownerId}_${m.id}_${idx}`}
                              className="hover:bg-slate-50/70"
                            >
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                                {formatDateTime(m.timestamp)}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">
                                  {m.ownerName}
                                </div>
                                {m.operatorName && m.operatorName !== m.ownerName && (
                                  <div className="text-[10px] text-slate-400">
                                    Op: {m.operatorName}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 font-bold ${
                                    isCarico ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {isCarico ? (
                                    <ArrowDownCircle className="w-3.5 h-3.5" />
                                  ) : (
                                    <ArrowUpCircle className="w-3.5 h-3.5" />
                                  )}
                                  {isCarico ? 'Carico' : 'Scarico'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                                {m.commessaCode || '—'}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-900">
                                  {m.itemName}
                                </div>
                                <div className="font-mono text-[10px] text-slate-500">
                                  {m.sku}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                                <span
                                  className={
                                    isCarico ? 'text-emerald-700' : 'text-rose-700'
                                  }
                                >
                                  {isCarico ? '+' : '-'}
                                  {m.quantity} {m.unit || 'pz'}
                                </span>
                                <div className="text-[10px] font-normal text-slate-400">
                                  Giac.: {m.resultingQty}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 max-w-[240px]">
                                <div className="truncate">{m.reason || '—'}</div>
                                {(m.packageCode || m.sealNumber) && (
                                  <div className="font-mono text-[10px] text-slate-400 truncate">
                                    {m.packageCode ? `Collo ${m.packageCode}` : ''}
                                    {m.sealNumber ? ` · Sigillo ${m.sealNumber}` : ''}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: FOTO & FILE DEL PROFILO */}
            {activeTab === 'media' && (
              <div className="space-y-5">
                {!selectedUserId ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Seleziona un profilo per ispezionare Foto e File
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Scegli un operatore qui sotto o dalla colonna a sinistra per visualizzare e scaricare le sue foto commessa e i documenti archiviati.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {profiles.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSelectedUserId(p.id)}
                          className="p-3 rounded-xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/40 text-left flex items-center justify-between gap-2 cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {p.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                              {p.stats.photosCount} foto · {p.stats.filesCount} file
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : isLoadingDetails ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
                    Caricamento foto e documenti del profilo...
                  </div>
                ) : userDetails ? (
                  <>
                    {/* Photos Grid */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-fuchsia-600" />
                          Foto di {userDetails.profile.name} ({userDetails.photos.length})
                        </h3>
                      </div>
                      {userDetails.photos.length === 0 ? (
                        <div className="text-xs text-slate-400 py-4 text-center">
                          Nessuna foto caricata da questo profilo.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {userDetails.photos.map((ph) => (
                            <div
                              key={ph.id}
                              className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setLightboxPhoto({
                                    id: ph.id,
                                    userId: selectedUserId,
                                    title: ph.caption || ph.commessaCode,
                                    subtitle: `${userDetails.profile.name} · ${formatDateTime(ph.capturedAt)}`,
                                  })
                                }
                                className="aspect-[4/3] bg-slate-200 overflow-hidden flex items-center justify-center cursor-pointer"
                              >
                                {photoBlobUrls[ph.id] ? (
                                  <img
                                    src={photoBlobUrls[ph.id]}
                                    alt={ph.caption || ph.commessaCode}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <Camera className="w-6 h-6 text-slate-400" />
                                )}
                              </button>
                              <div className="p-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[11px] font-mono font-bold text-indigo-700 truncate">
                                    {ph.commessaCode}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {ph.caption || formatDateTime(ph.capturedAt)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadUserPhoto(
                                      selectedUserId,
                                      ph.id,
                                      `${ph.commessaCode}_${ph.id}.${ph.fileExt || 'jpg'}`
                                    )
                                  }
                                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0"
                                  title="Scarica foto"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Files List */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-600" />
                        File Archiviati da {userDetails.profile.name} (
                        {userDetails.filesState.files.length})
                      </h3>
                      {userDetails.filesState.files.length === 0 ? (
                        <div className="text-xs text-slate-400 py-4 text-center">
                          Nessun file presente nell&apos;App File di questo profilo.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {userDetails.filesState.files.map((fl) => {
                            const folder = userDetails.filesState.folders.find(
                              (fo) => fo.id === fl.folderId
                            );
                            return (
                              <div
                                key={fl.id}
                                className="py-2.5 flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-900 truncate">
                                      {fl.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-2">
                                      <span>{formatBytes(fl.sizeBytes)}</span>
                                      {folder && (
                                        <span className="font-sans">
                                          · Cartella: {folder.name}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDateTime(fl.createdAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadUserFile(
                                      selectedUserId,
                                      fl.id,
                                      fl.name
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Scarica</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="bg-[#0d101c] border border-white/15 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{lightboxPhoto.title}</div>
                <div className="text-[11px] text-white/60">
                  {lightboxPhoto.subtitle}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadUserPhoto(
                      lightboxPhoto.userId,
                      lightboxPhoto.id,
                      `${lightboxPhoto.id}.jpg`
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-black/40 overflow-auto">
              {photoBlobUrls[lightboxPhoto.id] ? (
                <img
                  src={photoBlobUrls[lightboxPhoto.id]}
                  alt={lightboxPhoto.title}
                  className="max-w-full max-h-[72vh] object-contain rounded-lg"
                />
              ) : (
                <div className="text-xs text-white/60">Caricamento immagine...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
