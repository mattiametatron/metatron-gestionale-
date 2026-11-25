import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  X,
  Check,
  Search,
  RefreshCw,
  Upload,
  SwitchCamera,
  CheckSquare,
  Image as ImageIcon,
  FolderOpen,
  Sparkles,
  Plus,
  Loader2,
  Play,
} from 'lucide-react';
import { CargoLoad } from '../types/warehouse';
import {
  CommessaPhotoItem,
  deleteCommessaPhoto,
  listCommessaPhotos,
  loadImageFile,
  processImageSourceToJpeg,
  saveCommessaPhoto,
  triggerPhotoDownload,
  updateCommessaPhotoCaption,
} from '../utils/commessaPhotosStorage';

interface CommessaPhotosAppProps {
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  initialCommessaId?: string | null;
  onSelectLoad: (loadId: string) => void;
  onOpenNewLoadModal: () => void;
  onDeleteProofPhoto?: (loadId: string, rawPhotoId: string) => void;
}

function formatDayGroupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayKey = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === todayKey) return 'Oggi';
  if (d.toDateString() === yesterday.toDateString()) return 'Ieri';
  return d.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const CommessaPhotosApp: React.FC<CommessaPhotosAppProps> = ({
  loads,
  activeLoad,
  initialCommessaId,
  onSelectLoad,
  onOpenNewLoadModal,
  onDeleteProofPhoto,
}) => {
  const [photos, setPhotos] = useState<CommessaPhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedCommessaId, setSelectedCommessaId] = useState<string | null>(
    initialCommessaId || null
  );
  const [albumSearch, setAlbumSearch] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'app_foto' | 'prova_101'>('all');

  // Camera Live State (stile fotocamera telefono pronta allo scatto rapido)
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [needsTapToPlay, setNeedsTapToPlay] = useState<boolean>(false);
  const [stampEnabled, setStampEnabled] = useState<boolean>(true);
  const [quickCaption, setQuickCaption] = useState<string>('');
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [sessionShots, setSessionShots] = useState<CommessaPhotoItem[]>([]);
  const [isSavingShot, setIsSavingShot] = useState<boolean>(false);

  // Selection & Lightbox State
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const showNotice = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Aggiorna se l'utente apre l'app Foto puntando a una commessa specifica
  useEffect(() => {
    if (initialCommessaId) {
      setSelectedCommessaId(initialCommessaId);
    }
  }, [initialCommessaId]);

  const loadAllPhotos = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const list = await listCommessaPhotos();
      setPhotos(list);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllPhotos(false);
  }, []);

  // Unisce le foto dell'App Foto con le foto timbrate delle Prove Imballo 101% di ogni commessa
  const combinedPhotos = useMemo<CommessaPhotoItem[]>(() => {
    const proofPhotos: CommessaPhotoItem[] = [];
    loads.forEach((ld) => {
      (ld.packingProofs || []).forEach((pr) => {
        (pr.photos || []).forEach((ph) => {
          proofPhotos.push({
            id: `proof_${ld.id}_${ph.id}`,
            commessaId: ld.id,
            commessaCode: ld.code,
            commessaTitle: ld.title,
            caption: `${pr.targetCode} · ${ph.stageLabel}`,
            capturedAt: ph.capturedAt || pr.certifiedAt,
            width: 0,
            height: 0,
            sizeBytes: 0,
            imageUrl: ph.dataUrl,
            source: 'prova_101',
          });
        });
      });
      (ld.handoverProof?.photos || []).forEach((ph) => {
        proofPhotos.push({
          id: `handover_${ld.id}_${ph.id}`,
          commessaId: ld.id,
          commessaCode: ld.code,
          commessaTitle: ld.title,
          caption: `Consegna Corriere · ${ph.stageLabel}`,
          capturedAt: ph.capturedAt || ld.handoverProof!.handoverAt,
          width: 0,
          height: 0,
          sizeBytes: 0,
          imageUrl: ph.dataUrl,
          source: 'prova_101',
        });
      });
    });

    return [...photos, ...proofPhotos].sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
    );
  }, [photos, loads]);

  // Commessa attualmente aperta nell'album
  const currentCommessa = useMemo(
    () => loads.find((l) => l.id === selectedCommessaId) || null,
    [loads, selectedCommessaId]
  );

  // Foto appartenenti alla commessa aperta (match per commessaId o commessaCode)
  const currentAlbumPhotos = useMemo(() => {
    if (!currentCommessa) return [];
    const codeUpper = currentCommessa.code.trim().toUpperCase();
    return combinedPhotos.filter((p) => {
      const matchesCommessa =
        p.commessaId === currentCommessa.id ||
        p.commessaCode.trim().toUpperCase() === codeUpper;
      if (!matchesCommessa) return false;
      if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
      return true;
    });
  }, [combinedPhotos, currentCommessa, sourceFilter]);

  // Raggruppamento stile Google Foto per giornata
  const groupedAlbumPhotos = useMemo(() => {
    const groups: { dayKey: string; label: string; items: CommessaPhotoItem[] }[] = [];
    const byKey = new Map<string, { dayKey: string; label: string; items: CommessaPhotoItem[] }>();
    currentAlbumPhotos.forEach((photo) => {
      const d = new Date(photo.capturedAt);
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      let group = byKey.get(dayKey);
      if (!group) {
        group = { dayKey, label: formatDayGroupLabel(photo.capturedAt), items: [] };
        byKey.set(dayKey, group);
        groups.push(group);
      }
      group.items.push(photo);
    });
    return groups;
  }, [currentAlbumPhotos]);

  // Dati album per la vista principale
  const commessaAlbums = useMemo(() => {
    const q = albumSearch.trim().toLowerCase();
    return loads
      .filter((l) => {
        if (!q) return true;
        return (
          l.code.toLowerCase().includes(q) ||
          l.title.toLowerCase().includes(q) ||
          (l.client || '').toLowerCase().includes(q)
        );
      })
      .map((l) => {
        const codeUpper = l.code.trim().toUpperCase();
        const albumPhotos = combinedPhotos.filter(
          (p) =>
            p.commessaId === l.id || p.commessaCode.trim().toUpperCase() === codeUpper
        );
        return {
          load: l,
          photos: albumPhotos,
          coverPhoto: albumPhotos[0] || null,
          count: albumPhotos.length,
          latestAt: albumPhotos[0]?.capturedAt || null,
        };
      });
  }, [loads, combinedPhotos, albumSearch]);

  // --- GESTIONE FOTOCAMERA LIVE (iOS Safari + Android Chrome + Desktop safe) ---
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }
    setActiveStream(null);
    setCameraReady(false);
    setIsCameraLoading(false);
    setNeedsTapToPlay(false);
  };

  const startCameraStream = async (mode: 'environment' | 'user') => {
    stopCameraStream();
    setCameraError(null);
    setCameraReady(false);
    setNeedsTapToPlay(false);
    setIsCameraLoading(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsCameraLoading(false);
      setCameraError(
        'Fotocamera live non supportata in questa finestra. Usa "Fotocamera Nativa Telefono" qui sotto per scattare e salvare subito nell\'album.'
      );
      return;
    }

    // Tentativi progressivi: 1) posteriore/anteriore preferita, 2) qualsiasi fotocamera
    const attempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: { facingMode: mode },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let obtainedStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of attempts) {
      try {
        obtainedStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (obtainedStream) break;
      } catch (err: any) {
        lastError = err;
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    if (!obtainedStream) {
      setIsCameraLoading(false);
      setCameraError(
        lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError'
          ? 'Permesso fotocamera negato dal telefono/browser. Consenti la fotocamera nelle impostazioni del browser oppure usa "Fotocamera Nativa Telefono" qui sotto.'
          : 'Impossibile accedere al flusso live della fotocamera su questo dispositivo. Usa "Fotocamera Nativa Telefono" qui sotto per scattare subito.'
      );
      return;
    }

    streamRef.current = obtainedStream;
    setActiveStream(obtainedStream);
  };

  // Collega SEMPRE lo stream all'elemento <video> appena montato (evita schermo nero su iOS/Android!)
  useEffect(() => {
    if (!isCameraOpen || !activeStream) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;

    let cancelled = false;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', 'true');
    videoEl.setAttribute('webkit-playsinline', 'true');
    videoEl.srcObject = activeStream;

    const markReadyIfHasFrames = () => {
      if (cancelled) return;
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        setCameraReady(true);
        setIsCameraLoading(false);
        setNeedsTapToPlay(false);
      }
    };

    const tryPlay = async () => {
      try {
        await videoEl.play();
        markReadyIfHasFrames();
      } catch {
        if (!cancelled) {
          setIsCameraLoading(false);
          setNeedsTapToPlay(true);
        }
      }
    };

    videoEl.addEventListener('loadedmetadata', tryPlay);
    videoEl.addEventListener('loadeddata', markReadyIfHasFrames);
    videoEl.addEventListener('playing', markReadyIfHasFrames);
    videoEl.addEventListener('resize', markReadyIfHasFrames);

    // Avvia subito anche se metadata già presenti
    tryPlay();

    // Controllo di sicurezza se dopo 2.5s ancora non ci sono frame visibili
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled && videoEl.videoWidth === 0) {
        setIsCameraLoading(false);
        setNeedsTapToPlay(true);
      }
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
      videoEl.removeEventListener('loadedmetadata', tryPlay);
      videoEl.removeEventListener('loadeddata', markReadyIfHasFrames);
      videoEl.removeEventListener('playing', markReadyIfHasFrames);
      videoEl.removeEventListener('resize', markReadyIfHasFrames);
    };
  }, [isCameraOpen, activeStream]);

  const handleManualVideoPlay = async () => {
    const videoEl = videoRef.current;
    if (!videoEl || !activeStream) {
      startCameraStream(facingMode);
      return;
    }
    try {
      videoEl.muted = true;
      videoEl.srcObject = activeStream;
      await videoEl.play();
      if (videoEl.videoWidth > 0) {
        setCameraReady(true);
        setNeedsTapToPlay(false);
      }
    } catch {
      startCameraStream(facingMode);
    }
  };

  const handleOpenCamera = () => {
    setSessionShots([]);
    setIsCameraOpen(true);
    // Avvio diretto dentro il gesto utente (click/tap) senza setTimeout: richiesto da iOS Safari e Android Chrome!
    startCameraStream(facingMode);
  };

  const handleCloseCamera = () => {
    stopCameraStream();
    setIsCameraOpen(false);
  };

  const handleSwitchCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCameraStream(next);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const handleTakeLiveSnapshot = async () => {
    if (!currentCommessa || !videoRef.current || !cameraReady || isSavingShot) return;
    setIsSavingShot(true);
    setShutterFlash(true);
    window.setTimeout(() => setShutterFlash(false), 160);

    try {
      const nowIso = new Date().toISOString();
      const { dataUrl, width, height } = processImageSourceToJpeg(videoRef.current, {
        maxDim: 1600,
        quality: 0.86,
        stampMeta: stampEnabled
          ? {
              commessaCode: currentCommessa.code,
              caption: quickCaption.trim() || undefined,
              timestampIso: nowIso,
            }
          : null,
      });

      const saved = await saveCommessaPhoto({
        commessaId: currentCommessa.id,
        commessaCode: currentCommessa.code,
        commessaTitle: currentCommessa.title,
        caption: quickCaption.trim(),
        dataUrl,
        width,
        height,
        capturedAt: nowIso,
      });

      setPhotos((prev) => [saved, ...prev]);
      setSessionShots((prev) => [saved, ...prev]);
      showNotice(`Foto salvata in ${currentCommessa.code}`);
    } catch (err: any) {
      setCameraError(err?.message || 'Errore durante il salvataggio dello scatto.');
    } finally {
      setIsSavingShot(false);
    }
  };

  // Caricamento da fotocamera nativa telefono o galleria (supporta selezione multipla)
  const handleFilePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentCommessa) return;
    setIsSavingShot(true);
    try {
      const newlySaved: CommessaPhotoItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const img = await loadImageFile(file);
        const nowIso = new Date().toISOString();
        const { dataUrl, width, height } = processImageSourceToJpeg(img, {
          maxDim: 1600,
          quality: 0.86,
          stampMeta: stampEnabled
            ? {
                commessaCode: currentCommessa.code,
                caption: quickCaption.trim() || undefined,
                timestampIso: nowIso,
              }
            : null,
        });

        const saved = await saveCommessaPhoto({
          commessaId: currentCommessa.id,
          commessaCode: currentCommessa.code,
          commessaTitle: currentCommessa.title,
          caption: quickCaption.trim(),
          dataUrl,
          width,
          height,
          capturedAt: nowIso,
        });
        newlySaved.push(saved);
      }

      setPhotos((prev) => [...newlySaved.reverse(), ...prev]);
      if (isCameraOpen) {
        setSessionShots((prev) => [...newlySaved, ...prev]);
      }
      showNotice(
        newlySaved.length === 1
          ? `1 foto salvata in ${currentCommessa.code}`
          : `${newlySaved.length} foto salvate in ${currentCommessa.code}`
      );
    } catch (err: any) {
      showNotice(err?.message || 'Errore durante il caricamento delle foto.');
    } finally {
      setIsSavingShot(false);
      e.target.value = '';
    }
  };

  // --- LIGHTBOX & GESTIONE SELEZIONE MULTIPLA ---
  const lightboxIndex = useMemo(
    () =>
      lightboxPhotoId
        ? currentAlbumPhotos.findIndex((p) => p.id === lightboxPhotoId)
        : -1,
    [currentAlbumPhotos, lightboxPhotoId]
  );
  const lightboxPhoto = lightboxIndex >= 0 ? currentAlbumPhotos[lightboxIndex] : null;

  useEffect(() => {
    if (lightboxPhoto) {
      setEditingCaption(lightboxPhoto.caption || '');
      setConfirmDeleteId(null);
    }
  }, [lightboxPhoto?.id]);

  useEffect(() => {
    if (!lightboxPhoto) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setLightboxPhotoId(null);
      } else if (ev.key === 'ArrowRight' && lightboxIndex < currentAlbumPhotos.length - 1) {
        setLightboxPhotoId(currentAlbumPhotos[lightboxIndex + 1].id);
      } else if (ev.key === 'ArrowLeft' && lightboxIndex > 0) {
        setLightboxPhotoId(currentAlbumPhotos[lightboxIndex - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxPhoto, lightboxIndex, currentAlbumPhotos]);

  const handleSaveLightboxCaption = async () => {
    if (!lightboxPhoto || lightboxPhoto.source !== 'app_foto') return;
    const nextCap = editingCaption.trim();
    await updateCommessaPhotoCaption(lightboxPhoto.id, nextCap);
    setPhotos((prev) =>
      prev.map((p) => (p.id === lightboxPhoto.id ? { ...p, caption: nextCap } : p))
    );
    showNotice('Nota foto aggiornata');
  };

  const extractProofPhotoRef = (
    photo: CommessaPhotoItem
  ): { loadId: string; rawPhotoId: string } | null => {
    if (photo.source !== 'prova_101') return null;
    const prefix = photo.id.startsWith('proof_')
      ? `proof_${photo.commessaId}_`
      : photo.id.startsWith('handover_')
      ? `handover_${photo.commessaId}_`
      : null;
    if (!prefix || !photo.id.startsWith(prefix)) return null;
    return {
      loadId: photo.commessaId,
      rawPhotoId: photo.id.slice(prefix.length),
    };
  };

  const handleDeleteSinglePhoto = async (photo: CommessaPhotoItem) => {
    if (photo.source === 'app_foto') {
      await deleteCommessaPhoto(photo.id);
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setSessionShots((prev) => prev.filter((p) => p.id !== photo.id));
    } else if (photo.source === 'prova_101' && onDeleteProofPhoto) {
      const ref = extractProofPhotoRef(photo);
      if (ref) {
        onDeleteProofPhoto(ref.loadId, ref.rawPhotoId);
      }
    } else {
      return;
    }

    if (lightboxPhotoId === photo.id) {
      const next = currentAlbumPhotos[lightboxIndex + 1] || currentAlbumPhotos[lightboxIndex - 1];
      setLightboxPhotoId(next ? next.id : null);
    }
    setConfirmDeleteId(null);
    showNotice('Foto eliminata');
  };

  const toggleSelectPhoto = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDownloadSelected = async () => {
    const targets = currentAlbumPhotos.filter((p) => selectedIds.has(p.id));
    for (const p of targets) {
      await triggerPhotoDownload(p);
      await new Promise((r) => setTimeout(r, 180));
    }
    showNotice(`Scaricate ${targets.length} foto`);
  };

  const handleDeleteSelected = async () => {
    const targets = currentAlbumPhotos.filter((p) => selectedIds.has(p.id));
    const deletedAppIds = new Set<string>();
    let deletedCount = 0;

    for (const p of targets) {
      if (p.source === 'app_foto') {
        await deleteCommessaPhoto(p.id);
        deletedAppIds.add(p.id);
        deletedCount++;
      } else if (p.source === 'prova_101' && onDeleteProofPhoto) {
        const ref = extractProofPhotoRef(p);
        if (ref) {
          onDeleteProofPhoto(ref.loadId, ref.rawPhotoId);
          deletedCount++;
        }
      }
    }

    if (deletedAppIds.size > 0) {
      setPhotos((prev) => prev.filter((p) => !deletedAppIds.has(p.id)));
      setSessionShots((prev) => prev.filter((p) => !deletedAppIds.has(p.id)));
    }
    setSelectedIds(new Set());
    setSelectMode(false);
    showNotice(`Eliminate ${deletedCount} foto`);
  };

  const handleDownloadAllInAlbum = async () => {
    if (currentAlbumPhotos.length === 0) return;
    showNotice(`Avvio download di ${currentAlbumPhotos.length} foto...`);
    for (const p of currentAlbumPhotos) {
      await triggerPhotoDownload(p);
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  return (
    <div className="h-full flex flex-col bg-white text-slate-900 overflow-hidden relative">
      {/* ===================================================================
          TOP BAR PULITA (Stile Google Foto — 1 sola riga pulita)
      =================================================================== */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {currentCommessa ? (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => {
                  handleCloseCamera();
                  setSelectMode(false);
                  setSelectedIds(new Set());
                  setSelectedCommessaId(null);
                }}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
                Commesse
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-700 shrink-0">
                    {currentCommessa.code}
                  </span>
                  <h2 className="text-sm font-bold text-slate-900 truncate">
                    {currentCommessa.title}
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {currentAlbumPhotos.length} foto salvate
                  {currentCommessa.client ? ` · ${currentCommessa.client}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => loadAllPhotos(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                title="Aggiorna foto scattate dal telefono"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>

              {currentAlbumPhotos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectMode((v) => !v);
                    setSelectedIds(new Set());
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    selectMode
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {selectMode ? 'Fine Selezione' : 'Seleziona'}
                </button>
              )}

              <label className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-slate-600" />
                Carica Foto
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilePhotosUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleOpenCamera}
                className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                Abilita Fotocamera
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <ImageIcon className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Foto Commesse
                </h2>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {loads.length} album commesse · {combinedPhotos.length} foto totali
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={albumSearch}
                  onChange={(e) => setAlbumSearch(e.target.value)}
                  placeholder="Cerca album commessa..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={() => loadAllPhotos(true)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                title="Sincronizza foto scattate dal telefono"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Aggiorna
              </button>

              <button
                type="button"
                onClick={onOpenNewLoadModal}
                className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuova Commessa
              </button>
            </div>
          </>
        )}
      </div>

      {/* Toast discreto */}
      {statusToast && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* ===================================================================
          CONTENUTO PRINCIPALE: ALBUM COMMESSE vs GALLERIA GOOGLE FOTO
      =================================================================== */}
      <div className="flex-1 overflow-y-auto bg-slate-50/70">
        {!currentCommessa ? (
          /* VISTA 1: GRIGLIA ALBUM PER COMMESSA (STILE GOOGLE FOTO) */
          <div className="max-w-6xl mx-auto p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                Scegli la commessa su cui stai lavorando per aprire la fotocamera e salvare automaticamente tutti gli scatti nel suo album.
              </p>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="rounded-2xl bg-white border border-slate-200 overflow-hidden animate-pulse"
                  >
                    <div className="aspect-[4/3] bg-slate-200" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                      <div className="h-3 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : commessaAlbums.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
                <FolderOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-800">
                  Nessuna commessa trovata.
                </p>
                <button
                  type="button"
                  onClick={onOpenNewLoadModal}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crea Commessa
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {commessaAlbums.map(({ load: item, coverPhoto, count, latestAt }) => {
                  const isActive = item.id === activeLoad.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onSelectLoad(item.id);
                        setSelectedCommessaId(item.id);
                        setSourceFilter('all');
                      }}
                      className={`group text-left bg-white rounded-2xl border overflow-hidden transition-all cursor-pointer flex flex-col ${
                        isActive
                          ? 'border-blue-500 ring-1 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {/* Copertina Album 4:3 */}
                      <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
                        {coverPhoto ? (
                          <img
                            src={coverPhoto.imageUrl}
                            alt={`${item.code} ${item.title}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-slate-400">
                            <Camera className="w-7 h-7 stroke-[1.5]" />
                            <span className="text-[11px] font-medium">
                              Apri per scattare foto
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Titolo e Metadati Puliti (Zero Pill) */}
                      <div className="p-3.5 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700">
                            {item.code}
                          </span>
                          {isActive && (
                            <span className="text-[11px] font-semibold text-emerald-700">
                              In lavorazione
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums truncate">
                          {count} {count === 1 ? 'foto' : 'foto'}
                          {latestAt
                            ? ` · ${new Date(latestAt).toLocaleDateString('it-IT')}`
                            : ' · Vuoto'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* VISTA 2: DENTRO LA COMMESSA — GALLERIA GOOGLE FOTO */
          <div className="max-w-6xl mx-auto p-5 space-y-5">
            {/* Barra Azioni Rapide Telefono + Filtri */}
            <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                  {(
                    [
                      ['all', 'Tutte'],
                      ['app_foto', 'App Foto'],
                      ['prova_101', 'Prove 101%'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setSourceFilter(val)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                        sourceFilter === val
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <label className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Scatta da Telefono
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFilePhotosUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectMode ? (
                  <>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {selectedIds.size} selezionate
                    </span>
                    <button
                      type="button"
                      disabled={selectedIds.size === 0}
                      onClick={handleDownloadSelected}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Scarica Selezionate
                    </button>
                    <button
                      type="button"
                      disabled={selectedIds.size === 0}
                      onClick={handleDeleteSelected}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 border border-rose-200 rounded-lg cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina
                    </button>
                  </>
                ) : (
                  currentAlbumPhotos.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadAllInAlbum}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      Scarica Tutte ({currentAlbumPhotos.length})
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Galleria Raggruppata per Data (Stile Google Foto) */}
            {groupedAlbumPhotos.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                  <Camera className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="text-base font-bold text-slate-900">
                    Album {currentCommessa.code} pronto per gli scatti
                  </h3>
                  <p className="text-xs text-slate-500">
                    Abilita la fotocamera del telefono o del PC: ogni foto che scatti qui dentro viene salvata automaticamente in questa commessa e resta pronta da vedere o scaricare.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleOpenCamera}
                    className="px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer inline-flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Abilita Fotocamera Live
                  </button>
                  <label className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer inline-flex items-center gap-2">
                    <Upload className="w-4 h-4 text-blue-600" />
                    Carica Foto dal Dispositivo
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFilePhotosUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-7">
                {groupedAlbumPhotos.map((group) => (
                  <section key={group.dayKey} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800 capitalize">
                        {group.label}
                      </h3>
                      <span className="text-xs font-mono text-slate-500 tabular-nums">
                        {group.items.length} foto
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                      {group.items.map((photo) => {
                        const isSelected = selectedIds.has(photo.id);
                        return (
                          <div
                            key={photo.id}
                            className={`group relative aspect-square rounded-xl overflow-hidden bg-slate-200 border transition-all ${
                              isSelected
                                ? 'border-blue-600 ring-2 ring-blue-600/30'
                                : 'border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (selectMode) {
                                  toggleSelectPhoto(photo.id);
                                } else {
                                  setLightboxPhotoId(photo.id);
                                }
                              }}
                              className="w-full h-full block cursor-pointer"
                            >
                              <img
                                src={photo.imageUrl}
                                alt={photo.caption || `${photo.commessaCode} foto`}
                                referrerPolicy="no-referrer"
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                              />
                            </button>

                            {/* Scrim inferiore con ora e nota */}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-2 pt-6 text-white">
                              <div className="text-[11px] font-medium truncate">
                                {photo.caption || formatTimeShort(photo.capturedAt)}
                              </div>
                              {photo.caption && (
                                <div className="text-[10px] font-mono text-white/80">
                                  {formatTimeShort(photo.capturedAt)}
                                </div>
                              )}
                            </div>

                            {/* Checkbox selezione multipla o Download + Elimina sempre accessibili */}
                            {selectMode ? (
                              <button
                                type="button"
                                onClick={() => toggleSelectPhoto(photo.id)}
                                className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'bg-black/40 border-white text-transparent'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                                {confirmDeleteId === photo.id ? (
                                  <div className="flex items-center gap-1 bg-black/85 rounded-lg p-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSinglePhoto(photo);
                                      }}
                                      className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer whitespace-nowrap"
                                    >
                                      Elimina
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmDeleteId(null);
                                      }}
                                      className="p-1 rounded bg-white/15 hover:bg-white/25 text-white cursor-pointer"
                                      title="Annulla"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        triggerPhotoDownload(photo);
                                      }}
                                      title="Scarica foto"
                                      className="p-1.5 rounded-lg bg-black/60 hover:bg-black/85 text-white transition-colors cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    {(photo.source === 'app_foto' || onDeleteProofPhoto) && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteId(photo.id);
                                        }}
                                        title="Elimina immagine"
                                        className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================
          STUDIO FOTOCAMERA LIVE A TUTTO SCHERMO (PORTAL SU DOCUMENT.BODY PER MOBILE)
      =================================================================== */}
      {isCameraOpen &&
        currentCommessa &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 h-[100dvh] w-screen z-[9999] bg-black text-white flex flex-col">
            {/* Top Bar Fotocamera */}
            <div className="px-4 py-3 flex items-center justify-between gap-2 bg-black/85 border-b border-white/10 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-emerald-400">
                  SALVATAGGIO AUTOMATICO · {currentCommessa.code}
                </div>
                <div className="text-xs text-slate-300 truncate">
                  {currentCommessa.title} · Scattate ora: {sessionShots.length}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStampEnabled((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    stampEnabled
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-white/5 border-white/20 text-slate-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Timbro Ora:</span> {stampEnabled ? 'ON' : 'OFF'}
                </button>

                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                  title="Cambia fotocamera (posteriore / anteriore)"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleCloseCamera}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Chiudi
                </button>
              </div>
            </div>

            {/* Viewfinder Centrale Reale (sempre visibile con aspect cover su smartphone) */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center overflow-hidden bg-slate-950">
              {cameraError ? (
                <div className="max-w-md mx-auto p-6 text-center space-y-4">
                  <Camera className="w-10 h-10 text-amber-400 mx-auto" />
                  <p className="text-sm text-slate-200">{cameraError}</p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <label className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Apri Fotocamera Nativa Telefono
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handleFilePhotosUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => startCameraStream(facingMode)}
                      className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
                    >
                      Riprova Live
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                    style={{ minHeight: '240px' }}
                  />

                  {isCameraLoading && !cameraReady && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      <p className="text-sm font-semibold text-white">
                        Avvio telecamera del telefono in corso...
                      </p>
                      <p className="text-xs text-slate-300 max-w-xs">
                        Conferma il permesso fotocamera se richiesto dal telefono.
                      </p>
                    </div>
                  )}

                  {needsTapToPlay && !cameraReady && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-3 p-5 text-center">
                      <p className="text-sm font-semibold text-white max-w-xs">
                        Tocca qui per attivare l&apos;anteprima video della telecamera
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleManualVideoPlay}
                          className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" />
                          Mostra Telecamera Live
                        </button>
                        <label className="px-4 py-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-2">
                          <Camera className="w-4 h-4" />
                          Fotocamera Nativa Telefono
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            multiple
                            onChange={handleFilePhotosUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {shutterFlash && (
                    <div className="absolute inset-0 bg-white/75 pointer-events-none" />
                  )}
                </>
              )}
            </div>

            {/* Barra Controlli Scatto + Filmstrip Foto Appena Scattate con Elimina */}
            <div className="bg-black/95 border-t border-white/10 px-4 py-3.5 space-y-3 shrink-0">
              <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={quickCaption}
                  onChange={(e) => setQuickCaption(e.target.value)}
                  placeholder="Nota rapida opzionale (es. Scatola 04, Bancale 1, Etichetta)..."
                  className="w-full sm:flex-1 px-3 py-2 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                />

                <div className="flex items-center gap-3 shrink-0">
                  <label className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    Nativo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handleFilePhotosUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!cameraReady || isSavingShot}
                    onClick={handleTakeLiveSnapshot}
                    className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 active:scale-95 disabled:opacity-40 text-slate-900 border-4 border-slate-500 flex items-center justify-center cursor-pointer transition-transform shadow-lg"
                    title="Scatta Foto e salva nella Commessa"
                  >
                    <Camera className="w-7 h-7" />
                  </button>
                </div>
              </div>

              {sessionShots.length > 0 && (
                <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    Salvate ({sessionShots.length}):
                  </span>
                  {sessionShots.map((shot) => (
                    <div key={shot.id} className="relative shrink-0">
                      <img
                        src={shot.imageUrl}
                        alt="Scatto"
                        className="w-12 h-12 rounded-md object-cover border border-white/30"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteSinglePhoto(shot)}
                        title="Elimina questo scatto"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center cursor-pointer shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================
          LIGHTBOX FULLSCREEN STILE GOOGLE FOTO (PORTAL SU DOCUMENT.BODY)
      =================================================================== */}
      {lightboxPhoto &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 h-[100dvh] w-screen z-[9999] bg-[#050505] text-white flex flex-col">
            {/* Header Lightbox */}
            <div className="px-4 py-3 flex items-center justify-between gap-3 bg-black/80 border-b border-white/10 shrink-0">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-white truncate">
                  {lightboxPhoto.commessaCode} ·{' '}
                  {new Date(lightboxPhoto.capturedAt).toLocaleString('it-IT')}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Foto {lightboxIndex + 1} di {currentAlbumPhotos.length}
                  {lightboxPhoto.width > 0
                    ? ` · ${lightboxPhoto.width}×${lightboxPhoto.height}px`
                    : ''}
                  {lightboxPhoto.source === 'prova_101' ? ' · Prova Imballo 101%' : ''}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerPhotoDownload(lightboxPhoto)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Scarica
                </button>

                {(lightboxPhoto.source === 'app_foto' || onDeleteProofPhoto) &&
                  (confirmDeleteId === lightboxPhoto.id ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteSinglePhoto(lightboxPhoto)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Conferma Elimina
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(lightboxPhoto.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                      title="Elimina immagine"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina
                    </button>
                  ))}

                <button
                  type="button"
                  onClick={() => setLightboxPhotoId(null)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white cursor-pointer"
                  title="Chiudi (ESC)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Immagine Centrale + Frecce Navigazione */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 overflow-hidden">
              {lightboxIndex > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightboxPhotoId(currentAlbumPhotos[lightboxIndex - 1].id)
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-white/20 text-white cursor-pointer z-10"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}

              <img
                src={lightboxPhoto.imageUrl}
                alt={lightboxPhoto.caption || lightboxPhoto.commessaCode}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain rounded"
              />

              {lightboxIndex < currentAlbumPhotos.length - 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightboxPhotoId(currentAlbumPhotos[lightboxIndex + 1].id)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/60 hover:bg-white/20 text-white cursor-pointer z-10"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Footer Nota Editabile */}
            {lightboxPhoto.source === 'app_foto' && (
              <div className="px-4 py-3 bg-black/80 border-t border-white/10 shrink-0">
                <div className="max-w-xl mx-auto flex items-center gap-2">
                  <input
                    type="text"
                    value={editingCaption}
                    onChange={(e) => setEditingCaption(e.target.value)}
                    placeholder="Aggiungi una descrizione (es. Scatola 02 prima della chiusura)..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveLightboxCaption}
                    className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Salva Nota
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
