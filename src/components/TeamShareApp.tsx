import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send,
  RefreshCw,
  Upload,
  Camera,
  FolderOpen,
  Download,
  Trash2,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Crown,
  Search,
  Inbox,
  ArrowUpRight,
  FolderPlus,
  X,
  AlertCircle,
  Users,
} from 'lucide-react';
import {
  AuthUser,
  DirectoryUser,
  SharedTransferRecord,
} from '../types/warehouse';
import { authFetch } from '../utils/authSession';

interface OwnPhotoItem {
  id: string;
  commessaCode: string;
  commessaTitle?: string;
  caption?: string;
  capturedAt: string;
  sizeBytes: number;
  mimeType: string;
  fileExt: string;
}

interface OwnFileItem {
  id: string;
  folderId: string | null;
  name: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  createdAt: string;
}

interface TeamShareAppProps {
  currentUser: AuthUser;
  activeCommessaCode?: string;
  onOpenApp?: (appId: 'file_manager' | 'commessa_photos') => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('it-IT', {
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

function getFileIcon(mime: string, ext: string) {
  const e = (ext || '').toLowerCase();
  if (mime.startsWith('image/')) return ImageIcon;
  if (e === 'xls' || e === 'xlsx' || e === 'csv') return FileSpreadsheet;
  if (e === 'zip' || e === 'rar' || e === '7z') return FileArchive;
  return FileText;
}

export const TeamShareApp: React.FC<TeamShareAppProps> = ({
  currentUser,
  activeCommessaCode = '',
  onOpenApp,
}) => {
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [shares, setShares] = useState<SharedTransferRecord[]>([]);
  const [ownPhotos, setOwnPhotos] = useState<OwnPhotoItem[]>([]);
  const [ownFiles, setOwnFiles] = useState<OwnFileItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  // Filters
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [feedFilter, setFeedFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer state
  const [recipientId, setRecipientId] = useState('');
  const [sourceMode, setSourceMode] = useState<'upload' | 'photo' | 'file'>('upload');
  const [pickedFile, setPickedFile] = useState<{
    name: string;
    mimeType: string;
    extension: string;
    sizeBytes: number;
    dataUrl: string;
  } | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string>('');
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [commessaTag, setCommessaTag] = useState(activeCommessaCode);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Action states
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxShare, setLightboxShare] = useState<SharedTransferRecord | null>(null);

  // Authenticated blob URLs cache for safe image previews (shares & own photos)
  const [shareBlobUrls, setShareBlobUrls] = useState<Record<string, string>>({});
  const [ownPhotoBlobUrls, setOwnPhotoBlobUrls] = useState<Record<string, string>>({});
  const shareUrlsRef = useRef<Record<string, string>>({});
  const ownPhotoUrlsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setCommessaTag((prev) => prev || activeCommessaCode);
  }, [activeCommessaCode]);

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(shareUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
      Object.values(ownPhotoUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const showTempNotice = useCallback((msg: string) => {
    setNoticeMsg(msg);
    window.setTimeout(() => {
      setNoticeMsg((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [dirRes, sharesRes, photosRes, filesRes] = await Promise.all([
        authFetch('/api/users/directory'),
        authFetch('/api/shares'),
        authFetch('/api/photos'),
        authFetch('/api/files'),
      ]);

      const [dirJson, sharesJson, photosJson, filesJson] = await Promise.all([
        dirRes.ok ? dirRes.json() : null,
        sharesRes.ok ? sharesRes.json() : null,
        photosRes.ok ? photosRes.json() : null,
        filesRes.ok ? filesRes.json() : null,
      ]);

      const users: DirectoryUser[] = Array.isArray(dirJson?.users) ? dirJson.users : [];
      const others = users.filter((u) => u.id !== currentUser.id);
      setDirectory(others);
      setRecipientId((prev) => {
        if (prev && others.some((u) => u.id === prev)) return prev;
        return others[0]?.id || '';
      });

      const list: SharedTransferRecord[] = Array.isArray(sharesJson?.shares)
        ? sharesJson.shares
        : [];
      setShares(list);

      setOwnPhotos(Array.isArray(photosJson?.photos) ? photosJson.photos : []);
      setOwnFiles(Array.isArray(filesJson?.files) ? filesJson.files : []);
    } catch {
      setErrorMsg('Impossibile caricare gli scambi dal server.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load authenticated thumbnail blobs for image shares
  useEffect(() => {
    let cancelled = false;
    const imageShares = shares.filter(
      (s) => s.kind === 'photo' && !shareUrlsRef.current[s.id]
    );
    if (imageShares.length === 0) return;

    (async () => {
      for (const s of imageShares.slice(0, 30)) {
        if (cancelled) return;
        try {
          const resp = await authFetch(`/api/shares/${encodeURIComponent(s.id)}/download`);
          if (!resp.ok || cancelled) continue;
          const blob = await resp.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          shareUrlsRef.current[s.id] = url;
          setShareBlobUrls((prev) => ({ ...prev, [s.id]: url }));
        } catch {
          // skip preview
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shares]);

  // Load own photo thumbnails when user switches to 'photo' picker
  useEffect(() => {
    if (sourceMode !== 'photo') return;
    let cancelled = false;
    const missing = ownPhotos.filter((p) => !ownPhotoUrlsRef.current[p.id]);
    if (missing.length === 0) return;

    (async () => {
      for (const p of missing.slice(0, 24)) {
        if (cancelled) return;
        try {
          const resp = await authFetch(`/api/photos/${encodeURIComponent(p.id)}/file`);
          if (!resp.ok || cancelled) continue;
          const blob = await resp.blob();
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          ownPhotoUrlsRef.current[p.id] = url;
          setOwnPhotoBlobUrls((prev) => ({ ...prev, [p.id]: url }));
        } catch {
          // skip
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceMode, ownPhotos]);

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      setErrorMsg('Il file supera il limite massimo di 30 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const ext = file.name.includes('.')
        ? (file.name.split('.').pop() || 'bin').toLowerCase()
        : 'bin';
      setPickedFile({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        extension: ext,
        sizeBytes: file.size,
        dataUrl: String(reader.result || ''),
      });
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!recipientId) {
      setErrorMsg('Seleziona un collega destinatario.');
      return;
    }

    let payload: Record<string, unknown> = {
      recipientId,
      sourceType: sourceMode,
      commessaCode: commessaTag.trim() || undefined,
      message: messageText.trim() || undefined,
    };

    if (sourceMode === 'upload') {
      if (!pickedFile || !pickedFile.dataUrl) {
        setErrorMsg('Seleziona un file o una foto dal dispositivo prima di inviare.');
        return;
      }
      payload = {
        ...payload,
        fileName: pickedFile.name,
        mimeType: pickedFile.mimeType,
        extension: pickedFile.extension,
        dataUrl: pickedFile.dataUrl,
      };
    } else if (sourceMode === 'photo') {
      if (!selectedPhotoId) {
        setErrorMsg("Seleziona una foto dall'App Foto prima di inviare.");
        return;
      }
      payload = { ...payload, sourcePhotoId: selectedPhotoId };
    } else {
      if (!selectedFileId) {
        setErrorMsg("Seleziona un documento dall'App File prima di inviare.");
        return;
      }
      payload = { ...payload, sourceFileId: selectedFileId };
    }

    setIsSending(true);
    try {
      const resp = await authFetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok || !data?.share) {
        setErrorMsg(data?.error || 'Invio non riuscito.');
        return;
      }
      setShares((prev) => [data.share, ...prev]);
      setPickedFile(null);
      setSelectedPhotoId('');
      setSelectedFileId('');
      setMessageText('');
      showTempNotice(`Inviato "${data.share.fileName}" a ${data.share.recipientName}`);
    } catch {
      setErrorMsg('Errore di rete durante la trasmissione.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDownloadShare = async (share: SharedTransferRecord) => {
    try {
      const resp = await authFetch(
        `/api/shares/${encodeURIComponent(share.id)}/download`
      );
      if (!resp.ok) {
        setErrorMsg('Impossibile scaricare questo file.');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = share.fileName || `file.${share.extension || 'bin'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErrorMsg('Errore durante il download del file.');
    }
  };

  const handleSaveToOwnArchive = async (
    share: SharedTransferRecord,
    target: 'files' | 'photos'
  ) => {
    setSavingId(`${share.id}_${target}`);
    try {
      const resp = await authFetch(
        `/api/shares/${encodeURIComponent(share.id)}/save-to-files`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target }),
        }
      );
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        setErrorMsg(data?.error || 'Salvataggio non riuscito.');
        return;
      }
      setShares((prev) =>
        prev.map((s) =>
          s.id === share.id ? { ...s, savedByRecipient: true } : s
        )
      );
      showTempNotice(
        target === 'photos'
          ? `"${share.fileName}" salvata nella tua App Foto`
          : `"${share.fileName}" salvato nella tua App File`
      );
    } catch {
      setErrorMsg('Errore di rete durante il salvataggio.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      const resp = await authFetch(`/api/shares/${encodeURIComponent(shareId)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        setErrorMsg('Impossibile eliminare questo invio.');
        return;
      }
      setShares((prev) => prev.filter((s) => s.id !== shareId));
      setConfirmDeleteId(null);
      if (lightboxShare?.id === shareId) setLightboxShare(null);
      showTempNotice('Elemento rimosso dagli scambi');
    } catch {
      setErrorMsg('Errore durante la rimozione.');
    }
  };

  const receivedCount = useMemo(
    () => shares.filter((s) => s.recipientId === currentUser.id).length,
    [shares, currentUser.id]
  );
  const sentCount = useMemo(
    () => shares.filter((s) => s.senderId === currentUser.id).length,
    [shares, currentUser.id]
  );

  const filteredShares = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shares.filter((s) => {
      if (selectedPeerId) {
        const involvesPeer =
          s.senderId === selectedPeerId || s.recipientId === selectedPeerId;
        if (!involvesPeer) return false;
      }
      if (feedFilter === 'received' && s.recipientId !== currentUser.id) return false;
      if (feedFilter === 'sent' && s.senderId !== currentUser.id) return false;
      if (q) {
        const hay = `${s.fileName} ${s.senderName} ${s.recipientName} ${s.commessaCode || ''} ${s.message || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [shares, selectedPeerId, feedFilter, searchQuery, currentUser.id]);

  const selectedPeer = directory.find((u) => u.id === selectedPeerId) || null;

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* Header Bar */}
      <div className="bg-[#0d101c] text-white px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#25b5ff] to-[#0b7be6] flex items-center justify-center shadow-md shrink-0">
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">
              Scambio File &amp; Foto tra Utenti
            </h2>
            <p className="text-[11px] text-white/60">
              Invia foto, PDF, Excel e documenti direttamente ai colleghi e alla Direzione
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenApp && (
            <>
              <button
                type="button"
                onClick={() => onOpenApp('commessa_photos')}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white/85 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-fuchsia-400" />
                <span className="hidden sm:inline">App Foto</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenApp('file_manager')}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-xs font-medium text-white/85 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">App File</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Aggiorna</span>
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {(errorMsg || noticeMsg) && (
        <div className="px-5 pt-3 shrink-0 space-y-2">
          {errorMsg && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between gap-2">
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
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{noticeMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Colleghi & Filtri */}
        <aside className="lg:col-span-4 xl:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col min-h-0 overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 space-y-2">
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFeedFilter('all')}
                className={`py-1.5 rounded-md cursor-pointer transition-colors ${
                  feedFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tutti ({shares.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter('received')}
                className={`py-1.5 rounded-md cursor-pointer transition-colors ${
                  feedFilter === 'received'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ricevuti ({receivedCount})
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter('sent')}
                className={`py-1.5 rounded-md cursor-pointer transition-colors ${
                  feedFilter === 'sent'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inviati ({sentCount})
              </button>
            </div>
          </div>

          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-600" />
              Utenti Registrati ({directory.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              type="button"
              onClick={() => setSelectedPeerId(null)}
              className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                selectedPeerId === null
                  ? 'bg-slate-900 text-white'
                  : 'hover:bg-slate-100 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    selectedPeerId === null
                      ? 'bg-white/15 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  <Inbox className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">Tutti gli scambi</div>
                  <div
                    className={`text-[10px] ${
                      selectedPeerId === null ? 'text-white/65' : 'text-slate-500'
                    }`}
                  >
                    Cronologia completa
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] font-bold tabular-nums">
                {shares.length}
              </span>
            </button>

            {directory.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 leading-relaxed">
                Nessun altro utente registrato al momento. Appena un collega o il Datore di Lavoro crea il proprio account apparirà qui.
              </div>
            ) : (
              directory.map((peer) => {
                const isSelected = selectedPeerId === peer.id;
                const peerShareCount = shares.filter(
                  (s) => s.senderId === peer.id || s.recipientId === peer.id
                ).length;
                const initial = (peer.name || 'U').trim().charAt(0).toUpperCase();
                return (
                  <button
                    key={peer.id}
                    type="button"
                    onClick={() => {
                      setSelectedPeerId(peer.id);
                      setRecipientId(peer.id);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            peer.role === 'employer'
                              ? 'bg-amber-500 text-white'
                              : isSelected
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {initial}
                        </div>
                        {peer.isOnline && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white"
                            title="Online"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-1">
                          <span className="truncate">{peer.name}</span>
                          {peer.role === 'employer' && (
                            <Crown
                              className={`w-3 h-3 shrink-0 ${
                                isSelected ? 'text-amber-200' : 'text-amber-500'
                              }`}
                            />
                          )}
                        </div>
                        <div
                          className={`text-[10px] truncate ${
                            isSelected ? 'text-sky-100' : 'text-slate-500'
                          }`}
                        >
                          {peer.role === 'employer' ? 'Direzione' : 'Operatore'}
                          {peer.company ? ` · ${peer.company}` : ''}
                        </div>
                      </div>
                    </div>
                    {peerShareCount > 0 && (
                      <span
                        className={`font-mono text-[11px] font-bold tabular-nums ${
                          isSelected ? 'text-white' : 'text-slate-500'
                        }`}
                      >
                        {peerShareCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Workspace: Composer + Feed */}
        <main className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Composer Card */}
          <form
            onSubmit={handleSendShare}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Invia File o Foto a un Collega
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Scegli dal dispositivo, dall&apos;App Foto o dall&apos;App File
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold text-slate-600">
                  Destinatario:
                </label>
                <select
                  value={recipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  disabled={directory.length === 0}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-sky-600"
                >
                  {directory.length === 0 ? (
                    <option value="">Nessun altro utente</option>
                  ) : (
                    directory.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'employer' ? 'Direzione' : 'Operatore'})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Source Selector Tabs */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSourceMode('upload')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  sourceMode === 'upload'
                    ? 'bg-sky-50 border-sky-400 text-sky-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Da PC / Telefono</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('photo')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  sourceMode === 'photo'
                    ? 'bg-fuchsia-50 border-fuchsia-400 text-fuchsia-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>App Foto ({ownPhotos.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('file')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  sourceMode === 'file'
                    ? 'bg-amber-50 border-amber-400 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>App File ({ownFiles.length})</span>
              </button>
            </div>

            {/* Source Content Picker */}
            {sourceMode === 'upload' && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300">
                <div className="min-w-0">
                  {pickedFile ? (
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {pickedFile.name}{' '}
                      <span className="font-mono font-normal text-slate-500">
                        ({formatBytes(pickedFile.sizeBytes)})
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Seleziona immagini, PDF, Excel, Word o archivi (max 30 MB)
                    </div>
                  )}
                </div>
                <label className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{pickedFile ? 'Cambia File' : 'Scegli File'}</span>
                  <input
                    type="file"
                    onChange={handleLocalFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {sourceMode === 'photo' && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 max-h-44 overflow-y-auto">
                {ownPhotos.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    Non hai ancora foto salvate nell&apos;App Foto.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                    {ownPhotos.map((p) => {
                      const isPicked = selectedPhotoId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPhotoId(p.id);
                            if (p.commessaCode) setCommessaTag(p.commessaCode);
                          }}
                          className={`relative rounded-lg overflow-hidden border-2 aspect-square bg-slate-200 cursor-pointer transition-all ${
                            isPicked
                              ? 'border-fuchsia-600 ring-2 ring-fuchsia-300'
                              : 'border-transparent hover:border-slate-400'
                          }`}
                        >
                          {ownPhotoBlobUrls[p.id] ? (
                            <img
                              src={ownPhotoBlobUrls[p.id]}
                              alt={p.caption || p.commessaCode}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Camera className="w-5 h-5" />
                            </div>
                          )}
                          <div className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[9px] font-mono px-1 py-0.5 truncate">
                            {p.commessaCode}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {sourceMode === 'file' && (
              <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 max-h-40 overflow-y-auto space-y-1">
                {ownFiles.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    Nessun documento presente nell&apos;App File.
                  </div>
                ) : (
                  ownFiles.map((f) => {
                    const isPicked = selectedFileId === f.id;
                    const Icon = getFileIcon(f.mimeType, f.extension);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFileId(f.id)}
                        className={`w-full px-2.5 py-2 rounded-lg text-left flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors ${
                          isPicked
                            ? 'bg-amber-100 border border-amber-400 text-amber-950 font-bold'
                            : 'hover:bg-white text-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 shrink-0 tabular-nums">
                          {formatBytes(f.sizeBytes)}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {/* Metadata + Submit */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Commessa (opz.)
                </label>
                <input
                  type="text"
                  value={commessaTag}
                  onChange={(e) => setCommessaTag(e.target.value)}
                  placeholder="Es. COM-001"
                  className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-sky-600"
                />
              </div>
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Messaggio / Nota (opzionale)
                </label>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Es. Foto bancale 2 prima della chiusura..."
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-sky-600"
                />
              </div>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={isSending || directory.length === 0}
                  className="w-full py-2 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Invio...' : 'Invia Ora'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Feed Header + Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {selectedPeer
                  ? `Scambi con ${selectedPeer.name}`
                  : 'Cronologia Scambi Team'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {filteredShares.length} elementi mostrati
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca file, commessa, nota..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
              />
            </div>
          </div>

          {/* Transfers List */}
          {filteredShares.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
              <Send className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">
                Nessun file o foto scambiato
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Seleziona un collega a sinistra e usa il pannello sopra per inviare foto, PDF, fogli Excel o documenti di spedizione.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredShares.map((item) => {
                const isReceived = item.recipientId === currentUser.id;
                const Icon = getFileIcon(item.mimeType, item.extension);
                const thumbUrl = shareBlobUrls[item.id];
                const isConfirmingDel = confirmDeleteId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col sm:flex-row items-start gap-4"
                  >
                    {/* Preview / Icon */}
                    {item.kind === 'photo' ? (
                      <button
                        type="button"
                        onClick={() => setLightboxShare(item)}
                        className="w-full sm:w-24 h-36 sm:h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center cursor-pointer group"
                        title="Apri anteprima foto"
                      >
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={item.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <ImageIcon className="w-7 h-7 text-slate-400" />
                        )}
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-sky-600 shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        <span
                          className={`font-bold flex items-center gap-1 ${
                            isReceived ? 'text-emerald-700' : 'text-sky-700'
                          }`}
                        >
                          {isReceived ? (
                            <>
                              <Inbox className="w-3.5 h-3.5" />
                              Ricevuto da {item.senderName}
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Inviato a {item.recipientName}
                            </>
                          )}
                        </span>
                        <span className="font-mono text-slate-400 tabular-nums">
                          {formatDateTime(item.createdAt)}
                        </span>
                        {item.commessaCode && (
                          <span className="font-mono font-bold text-indigo-700">
                            {item.commessaCode}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-slate-900 break-all">
                        {item.fileName}
                      </div>

                      <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {item.extension.toUpperCase()} · {formatBytes(item.sizeBytes)}
                        {item.savedByRecipient && isReceived && (
                          <span className="ml-2 text-emerald-700 font-sans font-semibold">
                            · Salvato nel tuo archivio
                          </span>
                        )}
                      </div>

                      {item.message && (
                        <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          {item.message}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadShare(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Scarica</span>
                        </button>

                        <button
                          type="button"
                          disabled={savingId === `${item.id}_files`}
                          onClick={() => handleSaveToOwnArchive(item, 'files')}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                          <span>
                            {savingId === `${item.id}_files`
                              ? 'Salvataggio...'
                              : 'Salva in App File'}
                          </span>
                        </button>

                        {item.kind === 'photo' && (
                          <button
                            type="button"
                            disabled={savingId === `${item.id}_photos`}
                            onClick={() => handleSaveToOwnArchive(item, 'photos')}
                            className="px-2.5 py-1.5 rounded-lg bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-300 text-fuchsia-900 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>
                              {savingId === `${item.id}_photos`
                                ? 'Salvataggio...'
                                : 'Salva in App Foto'}
                            </span>
                          </button>
                        )}

                        {isConfirmingDel ? (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <button
                              type="button"
                              onClick={() => handleDeleteShare(item.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                            >
                              Conferma Elimina
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                            >
                              Annulla
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="px-2 py-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 text-xs font-medium flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Elimina</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Lightbox Modal for Shared Photos */}
      {lightboxShare && (
        <div
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxShare(null)}
        >
          <div
            className="bg-[#0d101c] border border-white/15 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold truncate">{lightboxShare.fileName}</div>
                <div className="text-[11px] text-white/60">
                  {lightboxShare.senderName} → {lightboxShare.recipientName} ·{' '}
                  {formatDateTime(lightboxShare.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadShare(lightboxShare)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Scarica</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxShare(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-black/40 overflow-auto">
              {shareBlobUrls[lightboxShare.id] ? (
                <img
                  src={shareBlobUrls[lightboxShare.id]}
                  alt={lightboxShare.fileName}
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
