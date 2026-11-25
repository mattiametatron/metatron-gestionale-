import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShieldCheck,
  Scale,
  Camera,
  ScanBarcode,
  Check,
  AlertTriangle,
  ExternalLink,
  Download,
  Lock,
  Trash2,
  Plus,
  Minus,
  RefreshCw,
  CheckCircle2,
  PackageCheck,
  Video,
  Square,
  Play,
  Upload,
  Printer,
  ChevronLeft,
  ChevronRight,
  Truck,
  PenTool,
  Layers,
  Eraser,
  FileCheck2,
} from 'lucide-react';
import {
  CargoLoad,
  ChecklistItem,
  PackageVerificationProof,
  PackingProofPhoto,
  PackingProofVideoMeta,
  ProofPhotoStage,
  ShipmentHandoverProof,
  StockMovement,
} from '../types/warehouse';
import { LoadSummary } from '../utils/calculations';
import {
  computeBlobSha256Hex,
  computeSha256Hex,
  deleteProofVideoBlob,
  getProofVideoBlob,
  saveProofVideoBlob,
  stampProofWatermarkOnImage,
} from '../utils/packingProofUtils';
import {
  generateBoxAntiDisputeSealLabelPDF,
  generatePackingProofDossierPDF,
  openPdfBlobInNewTab,
} from '../utils/pdfGenerator';

interface PackingProofPanelProps {
  load: CargoLoad;
  summary: LoadSummary;
  movements: StockMovement[];
  onCertifyPackageAndUnload: (
    proof: PackageVerificationProof,
    options: { autoUnloadStock: boolean }
  ) => void;
  onBatchUnloadCheckedItems: (operatorName: string) => void;
  onSaveHandoverProof: (handover: ShipmentHandoverProof) => void;
}

interface PackableTarget {
  targetType: 'box' | 'pallet_loose' | 'full_commessa';
  targetId: string;
  targetCode: string;
  targetLabel: string;
  palletCode?: string;
  tareKg: number;
  items: ChecklistItem[];
  theoreticalWeightKg: number;
}

const MULTI_LAYER_PHOTO_BUTTONS: {
  stage: ProofPhotoStage;
  label: string;
  shortLabel: string;
}[] = [
  { stage: 'layer_1', label: 'Strato 1 (Fondo Scatola)', shortLabel: 'Strato 1 Fondo' },
  { stage: 'layer_2', label: 'Strato 2 (Intermedio)', shortLabel: 'Strato 2 Intermedio' },
  { stage: 'layer_3', label: 'Strato 3 / Completo Aperto', shortLabel: 'Strato 3 Completo' },
  { stage: 'on_scale', label: 'Scatola su Bilancia', shortLabel: 'Su Bilancia' },
  { stage: 'sealed_package', label: 'Chiusa & Sigillata', shortLabel: 'Chiusa & Sigillata' },
  { stage: 'on_pallet', label: 'Posizionata su Bancale', shortLabel: 'Sul Bancale' },
  { stage: 'extra_detail', label: 'Dettaglio Extra / Articolo', shortLabel: '+ Foto Extra' },
];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const PackingProofPanel: React.FC<PackingProofPanelProps> = ({
  load,
  summary,
  movements,
  onCertifyPackageAndUnload,
  onBatchUnloadCheckedItems,
  onSaveHandoverProof,
}) => {
  const existingProofs = load.packingProofs || [];
  const existingHandover = load.handoverProof;

  // Switch tra Verifica Singole Scatole (1..N) e Verbale Chiusura Bancali & Ritiro Corriere
  const [panelMode, setPanelMode] = useState<'boxes' | 'handover'>('boxes');
  const [boxFilter, setBoxFilter] = useState<'all' | 'pending' | 'certified'>('all');

  // Costruisce elenco completo di tutti i colli/bancali certificabili della commessa attiva
  const targets = useMemo<PackableTarget[]>(() => {
    const list: PackableTarget[] = [];
    const palletMap = new Map(load.pallets.map((p) => [p.id, p]));

    load.boxes.forEach((box) => {
      const boxItems = load.items.filter((it) => it.boxId === box.id);
      const netKg = boxItems.reduce((a, i) => a + i.quantity * i.unitWeightKg, 0);
      const pallet = box.palletId ? palletMap.get(box.palletId) : null;
      list.push({
        targetType: 'box',
        targetId: box.id,
        targetCode: box.code,
        targetLabel: box.label || 'Scatola Spedizione',
        palletCode: pallet?.code,
        tareKg: box.tareKg || 0,
        items: boxItems,
        theoreticalWeightKg: Math.round((netKg + (box.tareKg || 0)) * 100) / 100,
      });
    });

    load.pallets.forEach((pallet) => {
      const looseItems = load.items.filter(
        (it) => !it.boxId && it.palletId === pallet.id
      );
      if (looseItems.length > 0) {
        const netKg = looseItems.reduce((a, i) => a + i.quantity * i.unitWeightKg, 0);
        list.push({
          targetType: 'pallet_loose',
          targetId: pallet.id,
          targetCode: `${pallet.code}-FUORI`,
          targetLabel: `Materiale Fuori Scatola su ${pallet.code}`,
          palletCode: pallet.code,
          tareKg: pallet.tareKg || 0,
          items: looseItems,
          theoreticalWeightKg: Math.round((netKg + (pallet.tareKg || 0)) * 100) / 100,
        });
      }
    });

    const unassigned = load.items.filter((it) => !it.boxId && !it.palletId);
    if (unassigned.length > 0 || list.length === 0) {
      const targetItems = unassigned.length > 0 ? unassigned : load.items;
      const netKg = targetItems.reduce((a, i) => a + i.quantity * i.unitWeightKg, 0);
      list.push({
        targetType: 'full_commessa',
        targetId: load.id,
        targetCode: `${load.code}-COLLO`,
        targetLabel:
          unassigned.length > 0
            ? `Articoli Check-list Commessa ${load.code}`
            : `Intera Commessa ${load.code}`,
        tareKg: 0,
        items: targetItems,
        theoreticalWeightKg: Math.round(netKg * 100) / 100,
      });
    }

    return list;
  }, [load]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    targets[0]?.targetId || ''
  );

  useEffect(() => {
    if (!targets.some((t) => t.targetId === selectedTargetId)) {
      setSelectedTargetId(targets[0]?.targetId || '');
    }
  }, [targets, selectedTargetId]);

  const activeTargetIndex = useMemo(
    () => Math.max(0, targets.findIndex((t) => t.targetId === selectedTargetId)),
    [targets, selectedTargetId]
  );

  const activeTarget = targets[activeTargetIndex] || targets[0] || null;

  const savedProofForTarget = useMemo(
    () =>
      activeTarget
        ? existingProofs.find(
            (p) =>
              p.targetId === activeTarget.targetId &&
              p.targetType === activeTarget.targetType
          ) || null
        : null,
    [existingProofs, activeTarget]
  );

  // Stato form verifica del collo selezionato
  const [countedMap, setCountedMap] = useState<Record<string, number>>({});
  const [scanInput, setScanInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [measuredWeightStr, setMeasuredWeightStr] = useState('');
  const [tolerancePercent, setTolerancePercent] = useState<number>(3);
  const [sealNumber, setSealNumber] = useState('');
  const [operatorName, setOperatorName] = useState('Magazziniere');
  const [checkerName, setCheckerName] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [photos, setPhotos] = useState<PackingProofPhoto[]>([]);
  const [videos, setVideos] = useState<PackingProofVideoMeta[]>([]);
  const [autoUnloadStock, setAutoUnloadStock] = useState<boolean>(true);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState<boolean>(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [isCertifying, setIsCertifying] = useState<boolean>(false);
  const [certMessage, setCertMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  // Stato Registrazione Video Live Continuo con Timbro Orologio Indelebile
  const [isRecordingLive, setIsRecordingLive] = useState<boolean>(false);
  const [recordingSec, setRecordingSec] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const recTimerRef = useRef<number | null>(null);
  const recStartMsRef = useRef<number>(0);
  const liveMetaRef = useRef({
    commessaCode: load.code,
    packageCode: '',
    sealNumber: '',
    measuredWeightStr: '',
    operatorName: '',
  });

  useEffect(() => {
    liveMetaRef.current = {
      commessaCode: load.code,
      packageCode: activeTarget?.targetCode || '',
      sealNumber,
      measuredWeightStr,
      operatorName,
    };
  }, [load.code, activeTarget?.targetCode, sealNumber, measuredWeightStr, operatorName]);

  // Pulizia risorse webcam e blob URL alla chiusura / cambio collo
  const stopLiveCameraResources = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (recTimerRef.current !== null) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((tr) => tr.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopLiveCameraResources();
      if (previewVideoUrl) {
        URL.revokeObjectURL(previewVideoUrl);
      }
    };
  }, []);

  // Sincronizza stato locale quando si cambia collo
  useEffect(() => {
    if (!activeTarget) return;
    setCertMessage(null);
    setScanFeedback(null);
    setCameraError(null);
    if (previewVideoUrl) {
      URL.revokeObjectURL(previewVideoUrl);
      setPreviewVideoUrl(null);
      setPreviewVideoId(null);
    }

    if (savedProofForTarget) {
      const nextCounts: Record<string, number> = {};
      activeTarget.items.forEach((it) => {
        const matched = savedProofForTarget.items.find((pi) => pi.itemId === it.id);
        nextCounts[it.id] = matched ? matched.countedQty : it.checked ? it.quantity : 0;
      });
      setCountedMap(nextCounts);
      setMeasuredWeightStr(
        savedProofForTarget.measuredWeightKg !== null
          ? String(savedProofForTarget.measuredWeightKg)
          : ''
      );
      setTolerancePercent(savedProofForTarget.weightTolerancePercent || 3);
      setSealNumber(savedProofForTarget.sealNumber || '');
      setOperatorName(savedProofForTarget.operatorName || 'Magazziniere');
      setCheckerName(savedProofForTarget.checkerName || '');
      setProofNotes(savedProofForTarget.notes || '');
      setPhotos(savedProofForTarget.photos || []);
      setVideos(savedProofForTarget.videos || []);
    } else {
      const nextCounts: Record<string, number> = {};
      activeTarget.items.forEach((it) => {
        nextCounts[it.id] = it.checked ? it.quantity : 0;
      });
      setCountedMap(nextCounts);
      setMeasuredWeightStr('');
      const cleanCode = activeTarget.targetCode.replace(/[^a-zA-Z0-9]/g, '');
      setSealNumber(`SIG-${cleanCode}-${String(new Date().getDate()).padStart(2, '0')}`);
      setProofNotes('');
      setPhotos([]);
      setVideos([]);
    }
  }, [activeTarget?.targetId, activeTarget?.targetType, savedProofForTarget?.id]);

  // --- STATO MODE B: VERBALE CHIUSURA BANCALI & CONSEGNA AL CORRIERE ---
  const [handoverCarrier, setHandoverCarrier] = useState(
    existingHandover?.carrierName || load.carrier || ''
  );
  const [handoverDriver, setHandoverDriver] = useState(
    existingHandover?.driverName || ''
  );
  const [handoverPlate, setHandoverPlate] = useState(
    existingHandover?.truckPlate || ''
  );
  const [handoverDdt, setHandoverDdt] = useState(
    existingHandover?.ddtNumber || ''
  );
  const [handoverDdtWeightStr, setHandoverDdtWeightStr] = useState(
    existingHandover?.ddtDeclaredWeightKg !== null &&
      existingHandover?.ddtDeclaredWeightKg !== undefined
      ? String(existingHandover.ddtDeclaredWeightKg)
      : ''
  );
  const [handoverNotes, setHandoverNotes] = useState(
    existingHandover?.notes || ''
  );
  const [handoverPhotos, setHandoverPhotos] = useState<PackingProofPhoto[]>(
    existingHandover?.photos || []
  );
  const [driverSignatureUrl, setDriverSignatureUrl] = useState<string | undefined>(
    existingHandover?.driverSignatureDataUrl
  );
  const [handoverMessage, setHandoverMessage] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSavingHandover, setIsSavingHandover] = useState(false);

  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingSigRef = useRef<boolean>(false);

  useEffect(() => {
    setHandoverCarrier(existingHandover?.carrierName || load.carrier || '');
    setHandoverDriver(existingHandover?.driverName || '');
    setHandoverPlate(existingHandover?.truckPlate || '');
    setHandoverDdt(existingHandover?.ddtNumber || '');
    setHandoverDdtWeightStr(
      existingHandover?.ddtDeclaredWeightKg !== null &&
        existingHandover?.ddtDeclaredWeightKg !== undefined
        ? String(existingHandover.ddtDeclaredWeightKg)
        : ''
    );
    setHandoverNotes(existingHandover?.notes || '');
    setHandoverPhotos(existingHandover?.photos || []);
    setDriverSignatureUrl(existingHandover?.driverSignatureDataUrl);
  }, [load.id, existingHandover?.id]);

  // Calcoli verifica pezzi & peso bilancia
  const totalExpectedPieces = activeTarget
    ? activeTarget.items.reduce((a, i) => a + i.quantity, 0)
    : 0;
  const totalCountedPieces = activeTarget
    ? activeTarget.items.reduce((a, i) => a + (countedMap[i.id] || 0), 0)
    : 0;
  const allItemsExactMatch =
    !!activeTarget &&
    activeTarget.items.length > 0 &&
    activeTarget.items.every((it) => (countedMap[it.id] || 0) === it.quantity);

  const parsedMeasuredWeight = useMemo(() => {
    if (!measuredWeightStr.trim()) return null;
    const n = Number(measuredWeightStr.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : null;
  }, [measuredWeightStr]);

  const weightEvaluation = useMemo(() => {
    if (!activeTarget || parsedMeasuredWeight === null) {
      return {
        status: 'non_pesato' as const,
        deltaKg: 0,
        deltaPct: 0,
        maxAllowedKg: 0,
      };
    }
    const theo = activeTarget.theoreticalWeightKg;
    const deltaKg = Math.round((parsedMeasuredWeight - theo) * 100) / 100;
    const absDelta = Math.abs(deltaKg);
    const maxAllowedKg = Math.max(
      0.35,
      Math.round(theo * (tolerancePercent / 100) * 100) / 100
    );
    const deltaPct = theo > 0 ? Math.round((absDelta / theo) * 1000) / 10 : 0;
    return {
      status: absDelta <= maxAllowedKg ? ('conforme' as const) : ('scarto' as const),
      deltaKg,
      deltaPct,
      maxAllowedKg,
    };
  }, [activeTarget, parsedMeasuredWeight, tolerancePercent]);

  // Scansione rapida SKU / Barcode
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTarget || !scanInput.trim()) return;
    const q = scanInput.trim().toLowerCase();
    const match = activeTarget.items.find(
      (it) =>
        it.sku.toLowerCase() === q ||
        it.sku.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q)
    );
    if (!match) {
      setScanFeedback(`Codice "${scanInput.trim()}" non presente in questo collo.`);
      return;
    }
    const current = countedMap[match.id] || 0;
    const next = Math.min(match.quantity, current + 1);
    setCountedMap((prev) => ({ ...prev, [match.id]: next }));
    setScanFeedback(
      `Verificato ${match.sku}: ${next}/${match.quantity} pz${
        next === match.quantity ? ' (COMPLETO)' : ''
      }`
    );
    setScanInput('');
  };

  const handleConfirmAllPieces = () => {
    if (!activeTarget) return;
    const next: Record<string, number> = {};
    activeTarget.items.forEach((it) => {
      next[it.id] = it.quantity;
    });
    setCountedMap(next);
    setScanFeedback('Tutti i pezzi della scatola confermati.');
  };

  // Caricamento Foto Multi-Strato Illimitate con Timbro Indelebile
  const handlePhotoUpload = async (
    stage: ProofPhotoStage,
    stageLabel: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0 || !activeTarget) return;
    setIsProcessingPhoto(true);
    setCertMessage(null);
    try {
      const added: PackingProofPhoto[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const nowIso = new Date().toISOString();
        const countSameStage =
          photos.filter((p) => p.stage === stage).length + added.length;
        const numberedLabel =
          countSameStage > 0 ? `${stageLabel} #${countSameStage + 1}` : stageLabel;

        const watermarkedUrl = await stampProofWatermarkOnImage(file, {
          commessaCode: load.code,
          packageCode: activeTarget.targetCode,
          stageLabel: numberedLabel,
          sealNumber: sealNumber.trim() || undefined,
          measuredWeightKg: parsedMeasuredWeight,
          operatorName: operatorName.trim() || undefined,
          timestampIso: nowIso,
        });

        added.push({
          id: `ph-${stage}-${Date.now()}-${i}`,
          stage,
          stageLabel: numberedLabel,
          dataUrl: watermarkedUrl,
          capturedAt: nowIso,
        });
      }
      setPhotos((prev) => [...prev, ...added]);
    } catch (err: any) {
      setCertMessage({
        kind: 'error',
        text: err?.message || 'Errore durante la timbratura fotografica.',
      });
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  // --- VIDEO CONTINUO LIVE CON OROLOGIO & CODICE COLLO IMPRESSI SUI FRAME ---
  const handleStartLiveVideoRecording = async () => {
    if (!activeTarget) return;
    setCameraError(null);
    setCertMessage(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        'Webcam non rilevata su questo dispositivo. Usa "Carica Video da Telefono / PC" qui a fianco.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setIsRecordingLive(true);
      setRecordingSec(0);
      recStartMsRef.current = Date.now();

      // Attendiamo il mount del canvas e del video nascosto
      requestAnimationFrame(() => {
        const videoEl = hiddenVideoRef.current;
        const canvasEl = liveCanvasRef.current;
        if (!videoEl || !canvasEl) return;

        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.play().catch(() => {});

        canvasEl.width = 854;
        canvasEl.height = 480;
        const ctx = canvasEl.getContext('2d');

        const renderFrame = () => {
          if (ctx && videoEl.readyState >= 2) {
            const w = canvasEl.width;
            const h = canvasEl.height;
            const stripH = 54;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(videoEl, 0, 0, w, h - stripH);

            // Fascia timbro live indelebile in basso
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, h - stripH, w, stripH);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(0, h - stripH, w, 3);

            const now = new Date();
            const dtStr = `${now.toLocaleDateString('it-IT')} ${now.toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}`;
            const meta = liveMetaRef.current;
            const elapsed = Math.floor((Date.now() - recStartMsRef.current) / 1000);

            // Badge REC in alto a sinistra
            ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
            ctx.fillRect(14, 14, 108, 26);
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 13px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.fillText(`● REC ${formatDuration(elapsed)}`, 22, 31);

            ctx.fillStyle = '#ffffff';
            ctx.font = '700 14px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.fillText(
              `VIDEO CONTINUO 101% · ${meta.commessaCode} · ${meta.packageCode} · SIGILLO: ${meta.sealNumber || 'N/D'}`,
              14,
              h - stripH + 22,
              w - 28
            );

            ctx.fillStyle = '#cbd5e1';
            ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.fillText(
              `DATA/ORA REALE: ${dtStr}  |  PESO BILANCIA: ${
                meta.measuredWeightStr ? `${meta.measuredWeightStr} kg` : 'IN VERIFICA'
              }  |  OP: ${meta.operatorName || 'Magazziniere'}`,
              14,
              h - stripH + 42,
              w - 28
            );
          }
          rafIdRef.current = requestAnimationFrame(renderFrame);
        };
        rafIdRef.current = requestAnimationFrame(renderFrame);

        const canvasStream = canvasEl.captureStream(24);
        const preferredMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : '';

        const recorder = preferredMime
          ? new MediaRecorder(canvasStream, {
              mimeType: preferredMime,
              videoBitsPerSecond: 1_500_000,
            })
          : new MediaRecorder(canvasStream);

        recordedChunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            recordedChunksRef.current.push(ev.data);
          }
        };

        recorder.onstop = async () => {
          stopLiveCameraResources();
          setIsRecordingLive(false);
          const durationSec = Math.max(
            1,
            Math.round((Date.now() - recStartMsRef.current) / 1000)
          );
          const blob = new Blob(recordedChunksRef.current, {
            type: preferredMime || 'video/webm',
          });
          if (blob.size === 0) return;

          setIsProcessingVideo(true);
          try {
            const videoId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const sha256Hash = await computeBlobSha256Hex(blob);
            await saveProofVideoBlob(videoId, blob);

            const cleanTarget = (activeTarget?.targetCode || 'COLLO').replace(
              /[^a-zA-Z0-9_-]/g,
              '_'
            );
            const meta: PackingProofVideoMeta = {
              id: videoId,
              fileName: `Video_Imballo_${load.code}_${cleanTarget}_${new Date()
                .toISOString()
                .slice(11, 19)
                .replace(/:/g, '')}.webm`,
              mimeType: blob.type || 'video/webm',
              sizeBytes: blob.size,
              durationSec,
              capturedAt: new Date().toISOString(),
              sha256Hash,
            };
            setVideos((prev) => [...prev, meta]);
            setCertMessage({
              kind: 'success',
              text: `Video continuo salvato (${formatDuration(durationSec)}) · Impronta SHA-256: ${sha256Hash.slice(0, 14)}`,
            });
          } catch (err: any) {
            setCameraError(err?.message || 'Errore durante il salvataggio del video.');
          } finally {
            setIsProcessingVideo(false);
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000);

        recTimerRef.current = window.setInterval(() => {
          setRecordingSec(Math.floor((Date.now() - recStartMsRef.current) / 1000));
        }, 500);
      });
    } catch (err: any) {
      stopLiveCameraResources();
      setIsRecordingLive(false);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Permesso fotocamera negato dal browser. Consenti la webcam oppure usa "Carica Video da Telefono / PC".'
          : 'Fotocamera non disponibile su questo PC. Usa "Carica Video da Telefono / PC" per allegare un video registrato.'
      );
    }
  };

  const handleStopLiveVideoRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    } else {
      stopLiveCameraResources();
      setIsRecordingLive(false);
    }
  };

  const handleUploadVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTarget) return;
    setIsProcessingVideo(true);
    setCameraError(null);
    setCertMessage(null);
    try {
      const videoId = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const sha256Hash = await computeBlobSha256Hex(file);
      await saveProofVideoBlob(videoId, file);

      // Prova a leggere la durata del file video
      const durationSec = await new Promise<number>((resolve) => {
        const tmp = document.createElement('video');
        const tmpUrl = URL.createObjectURL(file);
        tmp.preload = 'metadata';
        tmp.onloadedmetadata = () => {
          const d = Number.isFinite(tmp.duration) ? Math.round(tmp.duration) : 0;
          URL.revokeObjectURL(tmpUrl);
          resolve(d);
        };
        tmp.onerror = () => {
          URL.revokeObjectURL(tmpUrl);
          resolve(0);
        };
        tmp.src = tmpUrl;
      });

      const meta: PackingProofVideoMeta = {
        id: videoId,
        fileName: file.name,
        mimeType: file.type || 'video/mp4',
        sizeBytes: file.size,
        durationSec,
        capturedAt: new Date().toISOString(),
        sha256Hash,
      };
      setVideos((prev) => [...prev, meta]);
      setCertMessage({
        kind: 'success',
        text: `Video "${file.name}" allegato e certificato · SHA-256: ${sha256Hash.slice(0, 14)}`,
      });
    } catch (err: any) {
      setCameraError(err?.message || 'Errore durante il caricamento del video.');
    } finally {
      setIsProcessingVideo(false);
      e.target.value = '';
    }
  };

  const handlePlayVideoProof = async (videoMeta: PackingProofVideoMeta) => {
    if (previewVideoId === videoMeta.id) {
      if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
      setPreviewVideoId(null);
      setPreviewVideoUrl(null);
      return;
    }
    const blob = await getProofVideoBlob(videoMeta.id);
    if (!blob) {
      setCameraError(
        'File video non trovato in archivio locale di questo browser (rimane comunque certificata l impronta SHA-256 nel dossier PDF).'
      );
      return;
    }
    if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    const url = URL.createObjectURL(blob);
    setPreviewVideoUrl(url);
    setPreviewVideoId(videoMeta.id);
  };

  const handleDownloadVideoProof = async (videoMeta: PackingProofVideoMeta) => {
    const blob = await getProofVideoBlob(videoMeta.id);
    if (!blob) {
      setCameraError('File video non disponibile localmente per il download.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = videoMeta.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleDeleteVideoProof = async (videoId: string) => {
    await deleteProofVideoBlob(videoId);
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    if (previewVideoId === videoId) {
      if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
      setPreviewVideoId(null);
      setPreviewVideoUrl(null);
    }
  };

  // Certificazione & Sigillo Scatola 101%
  const handleCertifyAndSeal = async () => {
    if (!activeTarget) return;
    setCertMessage(null);

    if (activeTarget.items.length === 0) {
      setCertMessage({
        kind: 'error',
        text: 'Questa scatola non contiene ancora articoli da certificare.',
      });
      return;
    }

    if (!allItemsExactMatch) {
      setCertMessage({
        kind: 'error',
        text: 'Impossibile sigillare: conferma al 100% tutti i pezzi al punto 01 prima di certificare la scatola.',
      });
      return;
    }

    if (weightEvaluation.status === 'scarto') {
      setCertMessage({
        kind: 'error',
        text: `Allerta bilancia: lo scarto (${weightEvaluation.deltaKg >= 0 ? '+' : ''}${weightEvaluation.deltaKg} kg) supera la tolleranza ammessa (±${weightEvaluation.maxAllowedKg} kg).`,
      });
      return;
    }

    setIsCertifying(true);
    try {
      const nowIso = new Date().toISOString();
      const verifiedItems = activeTarget.items.map((it) => ({
        itemId: it.id,
        sku: it.sku,
        name: it.name,
        expectedQty: it.quantity,
        countedQty: countedMap[it.id] || 0,
        unitWeightKg: it.unitWeightKg,
        verifiedAt: nowIso,
      }));

      const payloadToHash = JSON.stringify({
        commessa: load.code,
        target: activeTarget.targetCode,
        items: verifiedItems.map((i) => [i.sku, i.countedQty, i.unitWeightKg]),
        theoKg: activeTarget.theoreticalWeightKg,
        measKg: parsedMeasuredWeight,
        seal: sealNumber.trim(),
        op: operatorName.trim(),
        checker: checkerName.trim(),
        photoCount: photos.length,
        videoHashes: videos.map((v) => v.sha256Hash),
        certifiedAt: nowIso,
      });

      const sha256Hash = await computeSha256Hex(payloadToHash);

      const proof: PackageVerificationProof = {
        id: savedProofForTarget?.id || `proof-${Date.now()}`,
        targetType: activeTarget.targetType,
        targetId: activeTarget.targetId,
        targetCode: activeTarget.targetCode,
        targetLabel: activeTarget.targetLabel,
        palletCode: activeTarget.palletCode,
        commessaCode: load.code,
        items: verifiedItems,
        theoreticalWeightKg: activeTarget.theoreticalWeightKg,
        measuredWeightKg: parsedMeasuredWeight,
        weightTolerancePercent: tolerancePercent,
        weightStatus: weightEvaluation.status,
        sealNumber: sealNumber.trim() || `SIG-${activeTarget.targetCode}`,
        operatorName: operatorName.trim() || 'Magazziniere',
        checkerName: checkerName.trim() || undefined,
        photos,
        videos,
        notes: proofNotes.trim() || undefined,
        certifiedAt: nowIso,
        sha256Hash,
        stockUnloaded: savedProofForTarget?.stockUnloaded || autoUnloadStock,
        linkedMovementIds: savedProofForTarget?.linkedMovementIds || [],
      };

      onCertifyPackageAndUnload(proof, { autoUnloadStock });

      setCertMessage({
        kind: 'success',
        text: `Scatola ${activeTarget.targetCode} certificata 101% (${photos.length} foto, ${videos.length} video · SHA-256: ${sha256Hash.slice(0, 12)})${
          autoUnloadStock ? ' · Scaricata automaticamente dal magazzino!' : ''
        }`,
      });
    } finally {
      setIsCertifying(false);
    }
  };

  const handlePrintBoxSealLabel = () => {
    if (!activeTarget || !savedProofForTarget) return;
    const doc = generateBoxAntiDisputeSealLabelPDF(
      load,
      savedProofForTarget,
      activeTargetIndex + 1,
      targets.length
    );
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    openPdfBlobInNewTab(url);
  };

  // --- HANDLERS MODE B: FOTO BANCALI/CAMION & FIRMA AUTISTA ---
  const handleHandoverPhotoUpload = async (
    stage: 'handover_pallet' | 'handover_truck',
    stageLabel: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsProcessingPhoto(true);
    setHandoverMessage(null);
    try {
      const added: PackingProofPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const nowIso = new Date().toISOString();
        const existingCount =
          handoverPhotos.filter((p) => p.stage === stage).length + added.length;
        const numberedLabel =
          existingCount > 0 ? `${stageLabel} #${existingCount + 1}` : stageLabel;

        const totalScaleKg = existingProofs.reduce(
          (acc, p) => acc + (p.measuredWeightKg ?? 0),
          0
        );
        const watermarkedUrl = await stampProofWatermarkOnImage(files[i], {
          commessaCode: load.code,
          packageCode: handoverDdt.trim() ? `DDT ${handoverDdt.trim()}` : 'CONSEGNA CORRIERE',
          stageLabel: numberedLabel,
          sealNumber: handoverPlate.trim() ? `TARGA ${handoverPlate.trim()}` : undefined,
          measuredWeightKg: totalScaleKg > 0 ? totalScaleKg : null,
          operatorName: handoverDriver.trim() || operatorName.trim() || undefined,
          timestampIso: nowIso,
        });

        added.push({
          id: `hph-${stage}-${Date.now()}-${i}`,
          stage,
          stageLabel: numberedLabel,
          dataUrl: watermarkedUrl,
          capturedAt: nowIso,
        });
      }
      setHandoverPhotos((prev) => [...prev, ...added]);
    } catch (err: any) {
      setHandoverMessage({
        kind: 'error',
        text: err?.message || 'Errore elaborazione foto consegna.',
      });
    } finally {
      setIsProcessingPhoto(false);
      e.target.value = '';
    }
  };

  // Canvas Firma Digitale Autista (mouse + touch)
  const getSigCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    const me = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: (me.clientX - rect.left) * scaleX,
      y: (me.clientY - rect.top) * scaleY,
    };
  };

  const handleSigStart = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingSigRef.current = true;
    const { x, y } = getSigCoords(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSigMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawingSigRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getSigCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleSigEnd = () => {
    if (!isDrawingSigRef.current) return;
    isDrawingSigRef.current = false;
    const canvas = sigCanvasRef.current;
    if (canvas) {
      setDriverSignatureUrl(canvas.toDataURL('image/png'));
    }
  };

  const handleClearDriverSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDriverSignatureUrl(undefined);
  };

  const handleSaveHandoverCert = async (e: React.FormEvent) => {
    e.preventDefault();
    setHandoverMessage(null);
    if (!handoverCarrier.trim() && !handoverDriver.trim()) {
      setHandoverMessage({
        kind: 'error',
        text: 'Inserisci almeno il nome del Corriere o dell Autista che ritira la merce.',
      });
      return;
    }

    setIsSavingHandover(true);
    try {
      const nowIso = new Date().toISOString();
      const parsedDdtWeight = handoverDdtWeightStr.trim()
        ? Number(handoverDdtWeightStr.replace(',', '.'))
        : null;
      const cleanDdtWeight =
        parsedDdtWeight !== null && Number.isFinite(parsedDdtWeight)
          ? parsedDdtWeight
          : null;

      const payload = JSON.stringify({
        commessa: load.code,
        carrier: handoverCarrier.trim(),
        driver: handoverDriver.trim(),
        plate: handoverPlate.trim().toUpperCase(),
        ddt: handoverDdt.trim(),
        ddtKg: cleanDdtWeight,
        boxes: targets.length,
        pallets: load.pallets.length,
        photos: handoverPhotos.length,
        hasSignature: !!driverSignatureUrl,
        handoverAt: nowIso,
      });
      const sha256Hash = await computeSha256Hex(payload);

      const handover: ShipmentHandoverProof = {
        id: existingHandover?.id || `hnd-${Date.now()}`,
        commessaCode: load.code,
        carrierName: handoverCarrier.trim() || load.carrier || 'Corriere',
        driverName: handoverDriver.trim() || 'Autista',
        truckPlate: handoverPlate.trim().toUpperCase() || '—',
        ddtNumber: handoverDdt.trim() || '—',
        ddtDeclaredWeightKg: cleanDdtWeight,
        totalBoxesDelivered: targets.length,
        totalPalletsDelivered: load.pallets.length,
        photos: handoverPhotos,
        driverSignatureDataUrl: driverSignatureUrl,
        notes: handoverNotes.trim() || undefined,
        handoverAt: nowIso,
        sha256Hash,
      };

      onSaveHandoverProof(handover);
      setHandoverMessage({
        kind: 'success',
        text: `Verbale Consegna Corriere certificato 101% (SHA-256: ${sha256Hash.slice(0, 12)}) e incluso nel Dossier PDF!`,
      });
    } finally {
      setIsSavingHandover(false);
    }
  };

  // Movimenti collegati & Export Dossier PDF
  const commessaLinkedMovements = useMemo(
    () =>
      movements.filter(
        (m) =>
          (m.commessaCode || '').toUpperCase() === (load.code || '').toUpperCase() &&
          m.type === 'scarico'
      ),
    [movements, load.code]
  );

  const handleOpenDossierPdf = (singleOnly: boolean) => {
    const targetProofs =
      singleOnly && savedProofForTarget ? [savedProofForTarget] : existingProofs;
    const doc = generatePackingProofDossierPDF(
      load,
      targetProofs,
      commessaLinkedMovements
    );
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    openPdfBlobInNewTab(url);
  };

  const handleDownloadDossierPdf = (singleOnly: boolean) => {
    const targetProofs =
      singleOnly && savedProofForTarget ? [savedProofForTarget] : existingProofs;
    const doc = generatePackingProofDossierPDF(
      load,
      targetProofs,
      commessaLinkedMovements
    );
    const cleanCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
    doc.save(`Dossier_Prova_101_${cleanCode}.pdf`);
  };

  const certifiedCount = targets.filter((t) =>
    existingProofs.some((p) => p.targetId === t.targetId && p.targetType === t.targetType)
  ).length;
  const totalVideosCount = existingProofs.reduce(
    (acc, p) => acc + (p.videos?.length || 0),
    0
  );
  const totalPhotosCount =
    existingProofs.reduce((acc, p) => acc + p.photos.length, 0) +
    (existingHandover?.photos.length || 0);
  const totalCertifiedScaleWeight = existingProofs.reduce(
    (acc, p) => acc + (p.measuredWeightKg ?? 0),
    0
  );

  const filteredTargets = useMemo(() => {
    return targets.filter((t) => {
      const isCert = existingProofs.some(
        (p) => p.targetId === t.targetId && p.targetType === t.targetType
      );
      if (boxFilter === 'certified') return isCert;
      if (boxFilter === 'pending') return !isCert;
      return true;
    });
  }, [targets, existingProofs, boxFilter]);

  return (
    <div className="space-y-4">
      {/* Banner Riepilogo Catena di Custodia Multi-Scatola 101% */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900">
                Catena di Prova Multi-Scatola 101% (Video SHA-256 · Foto a Strati · Bilancia · Corriere) — {load.code}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              Scatole sigillate: <strong className="text-slate-900">{certifiedCount}/{targets.length}</strong>
              {' · '}Video continui: <strong className="text-slate-900">{totalVideosCount}</strong>
              {' · '}Foto timbrate: <strong className="text-slate-900">{totalPhotosCount}</strong>
              {' · '}Scarichi: <strong className="text-slate-900">{commessaLinkedMovements.length}</strong>
              {' · '}Peso bilancia tot: <strong className="text-slate-900">{totalCertifiedScaleWeight.toFixed(2)} kg</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onBatchUnloadCheckedItems(operatorName || 'Magazziniere')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              title="Scarica automaticamente dal magazzino tutti gli articoli spuntati in CaricoStudio non ancora scaricati"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
              Scarico Auto Spuntati ({summary.checkedItems})
            </button>

            <button
              type="button"
              disabled={existingProofs.length === 0 && !existingHandover}
              onClick={() => handleDownloadDossierPdf(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              Scarica Dossier PDF
            </button>

            <button
              type="button"
              disabled={existingProofs.length === 0 && !existingHandover}
              onClick={() => handleOpenDossierPdf(false)}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              Apri Dossier PDF 101%
            </button>
          </div>
        </div>

        {/* Barra di Navigazione tra Step A (Singole Scatole) e Step B (Chiusura Bancali & Ritiro Corriere) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setPanelMode('boxes')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                panelMode === 'boxes'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              A. Verifica Singole Scatole ({certifiedCount}/{targets.length})
            </button>
            <button
              type="button"
              onClick={() => setPanelMode('handover')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md cursor-pointer whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                panelMode === 'handover'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              B. Chiusura Bancali &amp; Verbale Ritiro Corriere
              {existingHandover ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : null}
            </button>
          </div>

          {/* Barra Avanzamento Multi-Scatola */}
          <div className="flex items-center gap-2 text-xs text-slate-600 font-mono tabular-nums">
            <span>Avanzamento Commessa:</span>
            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{
                  width: `${
                    targets.length > 0
                      ? Math.round((certifiedCount / targets.length) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <strong className="text-slate-900">
              {targets.length > 0
                ? Math.round((certifiedCount / targets.length) * 100)
                : 0}
              %
            </strong>
          </div>
        </div>
      </div>

      {panelMode === 'boxes' ? (
        /* ==================== MODE A: VERIFICA SINGOLE SCATOLE 1..N ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Colonna Sinistra: Elenco Scatole / Colli con Filtro Rapido */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Elenco Scatole / Colli ({targets.length})
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {certifiedCount} sigillate
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ['all', `Tutte (${targets.length})`],
                    ['pending', `Da fare (${targets.length - certifiedCount})`],
                    ['certified', `101% (${certifiedCount})`],
                  ] as const
                ).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBoxFilter(k)}
                    className={`py-1 px-1.5 text-[11px] font-semibold rounded border cursor-pointer truncate ${
                      boxFilter === k
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {filteredTargets.map((t) => {
                const realIdx = targets.findIndex(
                  (x) => x.targetId === t.targetId && x.targetType === t.targetType
                );
                const proof = existingProofs.find(
                  (p) => p.targetId === t.targetId && p.targetType === t.targetType
                );
                const isSelected =
                  activeTarget?.targetId === t.targetId &&
                  activeTarget?.targetType === t.targetType;
                const piecesTotal = t.items.reduce((a, i) => a + i.quantity, 0);
                const vCount = proof?.videos?.length || 0;

                return (
                  <button
                    key={`${t.targetType}-${t.targetId}`}
                    type="button"
                    onClick={() => setSelectedTargetId(t.targetId)}
                    className={`w-full px-3.5 py-2.5 text-left transition-colors cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          #{realIdx + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {t.targetCode}
                        </span>
                        {t.palletCode && (
                          <span className="text-[11px] font-mono text-slate-500">
                            · {t.palletCode}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 truncate mt-0.5">
                        {t.targetLabel}
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                        {piecesTotal} pz · {t.theoreticalWeightKg.toFixed(1)} kg
                        {proof?.measuredWeightKg !== null &&
                        proof?.measuredWeightKg !== undefined
                          ? ` → Bil: ${proof.measuredWeightKg.toFixed(2)} kg`
                          : ''}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {proof ? (
                        <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 justify-end">
                          <Lock className="w-3 h-3" />
                          101% OK
                        </div>
                      ) : (
                        <div className="text-[11px] font-medium text-amber-700">
                          Da verificare
                        </div>
                      )}
                      {proof && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {proof.photos.length} foto · {vCount} vid
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colonna Destra: Stazione Certificazione 5 Prove Concrete */}
          {activeTarget ? (
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              {/* Intestazione Scatola + Navigazione Rapida Prec/Succ + Stampa Etichetta Sigillo */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                      SCATOLA {activeTargetIndex + 1} DI {targets.length}
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {activeTarget.targetCode}
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {activeTarget.targetLabel}
                    </span>
                  </div>
                  {savedProofForTarget ? (
                    <p className="text-xs text-emerald-700 font-mono mt-1">
                      Certificata il {new Date(savedProofForTarget.certifiedAt).toLocaleString('it-IT')} · Sigillo {savedProofForTarget.sealNumber} · SHA-256 {savedProofForTarget.sha256Hash.slice(0, 14)}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1">
                      Conta pezzi, pesatura bilancia, video continuo senza tagli e foto a strati timbrate per rendere impossibile ogni contestazione.
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={activeTargetIndex <= 0}
                    onClick={() =>
                      setSelectedTargetId(targets[activeTargetIndex - 1].targetId)
                    }
                    className="px-2 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 rounded-lg cursor-pointer flex items-center gap-0.5"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Prec
                  </button>
                  <button
                    type="button"
                    disabled={activeTargetIndex >= targets.length - 1}
                    onClick={() =>
                      setSelectedTargetId(targets[activeTargetIndex + 1].targetId)
                    }
                    className="px-2 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-300 rounded-lg cursor-pointer flex items-center gap-0.5"
                  >
                    Succ
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {savedProofForTarget && (
                    <>
                      <button
                        type="button"
                        onClick={handlePrintBoxSealLabel}
                        className="px-2.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                        title="Stampa l etichetta anti-contestazione con Peso Bilancia gigante, Sigillo e clausola riserva da incollare sulla scatola"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Etichetta Sigillo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDossierPdf(true)}
                        className="px-2.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        PDF Collo
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* 01. CONTA PEZZI & BARCODE */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-900">
                    01. Verifica Pezzo-per-Pezzo ({totalCountedPieces}/{totalExpectedPieces} pz confermati)
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmAllPieces}
                    className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Conferma Tutti i Pezzi
                  </button>
                </div>

                <form onSubmit={handleScanSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Scansiona codice a barre / digita SKU + Invio per contare +1 pezzo..."
                      className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    Conta +1
                  </button>
                </form>

                {scanFeedback && (
                  <div className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                    {scanFeedback}
                  </div>
                )}

                {activeTarget.items.length === 0 ? (
                  <div className="p-4 text-xs text-slate-500 border border-slate-200 rounded-lg bg-slate-50 text-center">
                    Nessun articolo presente in questa scatola. Assegna prima gli articoli in CaricoStudio.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                          <th className="py-2 px-3">Codice SKU</th>
                          <th className="py-2 px-3">Descrizione</th>
                          <th className="py-2 px-3 text-right">Peso Tot.</th>
                          <th className="py-2 px-3 text-right">Contati / Attesi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeTarget.items.map((it) => {
                          const counted = countedMap[it.id] || 0;
                          const isExact = counted === it.quantity;
                          return (
                            <tr
                              key={it.id}
                              className={isExact ? 'bg-emerald-50/35' : ''}
                            >
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                                {it.sku}
                              </td>
                              <td className="py-2 px-3 text-slate-800">{it.name}</td>
                              <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                {(it.quantity * it.unitWeightKg).toFixed(2)} kg
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCountedMap((prev) => ({
                                        ...prev,
                                        [it.id]: Math.max(0, (prev[it.id] || 0) - 1),
                                      }))
                                    }
                                    className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span
                                    className={`font-mono tabular-nums font-bold min-w-[54px] text-center ${
                                      isExact ? 'text-emerald-700' : 'text-amber-700'
                                    }`}
                                  >
                                    {counted} / {it.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCountedMap((prev) => ({
                                        ...prev,
                                        [it.id]: Math.min(it.quantity, (prev[it.id] || 0) + 1),
                                      }))
                                    }
                                    className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCountedMap((prev) => ({
                                        ...prev,
                                        [it.id]: it.quantity,
                                      }))
                                    }
                                    className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer ${
                                      isExact
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    OK
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 02. PROVA MATEMATICA BILANCIA & SIGILLO */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    02. Prova Matematica Bilancia &amp; Sigillo Antimanomissione
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    Peso Teorico (incl. tara {activeTarget.tareKg} kg):{' '}
                    <strong className="text-slate-900">
                      {activeTarget.theoreticalWeightKg.toFixed(2)} kg
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Peso Reale Bilancia (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={measuredWeightStr}
                      onChange={(e) => setMeasuredWeightStr(e.target.value)}
                      placeholder={`Es. ${activeTarget.theoreticalWeightKg.toFixed(2)}`}
                      className="w-full px-3 py-2 font-mono tabular-nums font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Tolleranza Bilancia
                    </label>
                    <select
                      value={tolerancePercent}
                      onChange={(e) => setTolerancePercent(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono"
                    >
                      <option value={2}>±2% (min 0.35 kg)</option>
                      <option value={3}>±3% (min 0.35 kg)</option>
                      <option value={5}>±5% (min 0.35 kg)</option>
                      <option value={10}>±10% (imballi variabili)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      N° Sigillo / Nastro Numerato
                    </label>
                    <input
                      type="text"
                      value={sealNumber}
                      onChange={(e) => setSealNumber(e.target.value)}
                      placeholder="Es. SIG-00481"
                      className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <div
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                        weightEvaluation.status === 'conforme'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : weightEvaluation.status === 'scarto'
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate font-mono tabular-nums">
                        {weightEvaluation.status === 'conforme'
                          ? `CONFORME (${weightEvaluation.deltaKg >= 0 ? '+' : ''}${weightEvaluation.deltaKg} kg)`
                          : weightEvaluation.status === 'scarto'
                          ? `SCARTO ${weightEvaluation.deltaKg >= 0 ? '+' : ''}${weightEvaluation.deltaKg} kg`
                          : 'Inserisci peso'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Operatore Imballo
                    </label>
                    <input
                      type="text"
                      value={operatorName}
                      onChange={(e) => setOperatorName(e.target.value)}
                      placeholder="Nome operatore"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      2° Controllore / Testimone
                    </label>
                    <input
                      type="text"
                      value={checkerName}
                      onChange={(e) => setCheckerName(e.target.value)}
                      placeholder="Nome 2° verificatore (consigliato)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Note Scatola
                    </label>
                    <input
                      type="text"
                      value={proofNotes}
                      onChange={(e) => setProofNotes(e.target.value)}
                      placeholder="Es. Materiale fragile protetto con pluriball..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* 03. VIDEO CONTINUO SENZA TAGLI CON OROLOGIO IMPRESSO & SHA-256 */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-rose-600" />
                      03. Video Continuo Senza Tagli — Prova Regia ({videos.length} allegati)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Riprendi in un unico video l inserimento dei pezzi, la chiusura con sigillo e la pesatura: l orologio al secondo e il codice scatola vengono impressi sui fotogrammi e firmati con SHA-256.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isRecordingLive ? (
                      <button
                        type="button"
                        disabled={isProcessingVideo}
                        onClick={handleStartLiveVideoRecording}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Registra Video Live (Webcam)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopLiveVideoRecording}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                        Ferma &amp; Certifica ({formatDuration(recordingSec)})
                      </button>
                    )}

                    <label className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      {isProcessingVideo ? 'Calcolo SHA-256...' : 'Carica Video da Telefono / PC'}
                      <input
                        type="file"
                        accept="video/*"
                        capture="environment"
                        onChange={handleUploadVideoFile}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {cameraError && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                {/* Area Preview Registrazione Live */}
                {isRecordingLive && (
                  <div className="border border-rose-300 rounded-lg overflow-hidden bg-slate-950">
                    <video ref={hiddenVideoRef} className="hidden" playsInline muted />
                    <canvas
                      ref={liveCanvasRef}
                      className="w-full max-h-[300px] object-contain mx-auto block"
                    />
                  </div>
                )}

                {/* Lista Video Certificati SHA-256 */}
                {videos.length > 0 && (
                  <div className="space-y-2">
                    {videos.map((v) => (
                      <div
                        key={v.id}
                        className="border border-slate-200 rounded-lg bg-slate-50 p-2.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {v.fileName}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              Durata: {v.durationSec > 0 ? formatDuration(v.durationSec) : 'N/D'} ·{' '}
                              {(v.sizeBytes / (1024 * 1024)).toFixed(2)} MB · SHA-256:{' '}
                              <span className="text-slate-800 font-semibold">
                                {v.sha256Hash.slice(0, 18)}…
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handlePlayVideoProof(v)}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md cursor-pointer flex items-center gap-1"
                            >
                              <Play className="w-3 h-3 text-emerald-600" />
                              {previewVideoId === v.id ? 'Chiudi' : 'Riproduci'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadVideoProof(v)}
                              className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-md cursor-pointer flex items-center gap-1"
                              title="Scarica il file video originale da archiviare o inviare al cliente in caso di contestazione"
                            >
                              <Download className="w-3 h-3" />
                              Scarica Video
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVideoProof(v.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Rimuovi video"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {previewVideoId === v.id && previewVideoUrl && (
                          <video
                            src={previewVideoUrl}
                            controls
                            autoPlay
                            className="w-full max-h-[280px] rounded bg-black"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 04. FOTOGRAFIE ILLIMITATE MULTI-STRATO TIMBRATE */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-900">
                      04. Fotografie Illimitate a Strati con Timbro Indelebile ({photos.length} scatti)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Puoi scattare quanti strati vuoi per scatole piene o profonde: ogni scatto viene aggiunto alla galleria e stampato a griglia nel Dossier PDF.
                    </p>
                  </div>
                  {isProcessingPhoto && (
                    <span className="text-xs font-semibold text-blue-700">
                      Timbratura pixel in corso...
                    </span>
                  )}
                </div>

                {/* Bottoni Rapidi Aggiunta Foto per Strato / Fase */}
                <div className="flex flex-wrap gap-2">
                  {MULTI_LAYER_PHOTO_BUTTONS.map(({ stage, label, shortLabel }) => {
                    const count = photos.filter((p) => p.stage === stage).length;
                    return (
                      <label
                        key={stage}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                          count > 0
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                        <span>{shortLabel}</span>
                        {count > 0 && (
                          <span className="font-mono text-[11px] font-bold text-emerald-700">
                            ({count})
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          capture="environment"
                          onChange={(e) => handlePhotoUpload(stage, label, e)}
                          className="hidden"
                        />
                      </label>
                    );
                  })}
                </div>

                {/* Galleria Foto Timbrate della Scatola */}
                {photos.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-lg p-5 text-center text-xs text-slate-500 bg-slate-50/70">
                    Nessuna foto ancora acquisita per {activeTarget.targetCode}. Clicca uno dei pulsanti sopra (es. <strong>Strato 1 Fondo</strong>, <strong>Su Bilancia</strong>, <strong>Chiusa &amp; Sigillata</strong>).
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {photos.map((ph) => (
                      <div
                        key={ph.id}
                        className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900 flex flex-col"
                      >
                        <div className="px-2.5 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between gap-1">
                          <span className="text-[11px] font-bold text-slate-800 truncate">
                            {ph.stageLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPhotos((prev) => prev.filter((p) => p.id !== ph.id))
                            }
                            title="Elimina foto"
                            className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <img
                          src={ph.dataUrl}
                          alt={ph.stageLabel}
                          className="w-full h-32 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 05. SIGILLA, CERTIFICA & SCARICO AUTOMATICO MAGAZZINO */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoUnloadStock}
                      onChange={(e) => setAutoUnloadStock(e.target.checked)}
                      className="rounded cursor-pointer"
                    />
                    <span>
                      <strong>Scarica automaticamente dal Magazzino</strong> i pezzi di questa scatola (con Sigillo + SHA-256)
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={
                        isCertifying ||
                        !allItemsExactMatch ||
                        weightEvaluation.status === 'scarto'
                      }
                      onClick={handleCertifyAndSeal}
                      className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap transition-colors"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>
                        {isCertifying
                          ? 'Certificazione...'
                          : savedProofForTarget
                          ? 'Aggiorna Certificato 101%'
                          : 'Certifica 101%, Sigilla & Scarica'}
                      </span>
                    </button>

                    {savedProofForTarget && activeTargetIndex < targets.length - 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTargetId(targets[activeTargetIndex + 1].targetId)
                        }
                        className="px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        Prossima Scatola
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {!allItemsExactMatch && activeTarget.items.length > 0 && (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Per sigillare al 101%, conferma tutti i pezzi al punto 01 ({totalCountedPieces}/{totalExpectedPieces} confermati).
                    </span>
                  </div>
                )}

                {certMessage && (
                  <div
                    className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
                      certMessage.kind === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    {certMessage.kind === 'error' ? (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    ) : (
                      <Check className="w-4 h-4 shrink-0" />
                    )}
                    <span className="font-medium">{certMessage.text}</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* ==================== MODE B: CHIUSURA BANCALI & VERBALE RITIRO CORRIERE ==================== */
        <div className="space-y-4">
          {/* Tabella Riepilogo Tutte le Scatole della Spedizione */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900">
                  Quadro Riepilogativo Multi-Scatola ({certifiedCount}/{targets.length} sigillate)
                </span>
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-600">
                Somma Pesi Bilancia:{' '}
                <strong className="text-slate-900">
                  {totalCertifiedScaleWeight.toFixed(2)} kg
                </strong>
                {handoverDdtWeightStr && Number.isFinite(Number(handoverDdtWeightStr.replace(',', '.'))) ? (
                  <span className="ml-2">
                    · Peso DDT:{' '}
                    <strong className="text-slate-900">
                      {Number(handoverDdtWeightStr.replace(',', '.')).toFixed(2)} kg
                    </strong>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-white border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Scatola / Bancale</th>
                    <th className="py-2 px-3 text-right">Pezzi</th>
                    <th className="py-2 px-3 text-right">P. Teorico</th>
                    <th className="py-2 px-3 text-right">P. Bilancia</th>
                    <th className="py-2 px-3">Sigillo</th>
                    <th className="py-2 px-3">Foto / Video</th>
                    <th className="py-2 px-3 text-right">Stato</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {targets.map((t, idx) => {
                    const proof = existingProofs.find(
                      (p) => p.targetId === t.targetId && p.targetType === t.targetType
                    );
                    const pcs = t.items.reduce((a, i) => a + i.quantity, 0);
                    return (
                      <tr key={`${t.targetType}-${t.targetId}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono text-slate-500">#{idx + 1}</td>
                        <td className="py-2 px-3">
                          <span className="font-mono font-bold text-slate-900">
                            {t.targetCode}
                          </span>
                          {t.palletCode && (
                            <span className="text-slate-500 font-mono ml-1.5">
                              ({t.palletCode})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">
                          {pcs} pz
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                          {t.theoreticalWeightKg.toFixed(2)} kg
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {proof?.measuredWeightKg !== null &&
                          proof?.measuredWeightKg !== undefined
                            ? `${proof.measuredWeightKg.toFixed(2)} kg`
                            : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-700">
                          {proof?.sealNumber || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {proof
                            ? `${proof.photos.length} foto · ${proof.videos?.length || 0} vid`
                            : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {proof ? (
                            <span className="text-[11px] font-bold text-emerald-700">
                              101% SIGILLATA
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTargetId(t.targetId);
                                setPanelMode('boxes');
                              }}
                              className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                            >
                              Completa ora →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Form Verbale Consegna Corriere + Foto Bancali/Camion + Firma Digitale Autista */}
          <form
            onSubmit={handleSaveHandoverCert}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-5"
          >
            <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  Verbale Chiusura Bancali &amp; Consegna al Corriere (Prova Finale anti-contestazione)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fotografa i bancali filmati completi e il carico sul camion, inserisci DDT e targa, e fai firmare l autista direttamente su schermo. Tutto confluisce nel Dossier PDF 101%.
                </p>
              </div>
              {existingHandover && (
                <span className="text-xs font-mono font-bold text-emerald-700">
                  Certificato · SHA-256 {existingHandover.sha256Hash.slice(0, 12)}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="lg:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Corriere / Vettore *
                </label>
                <input
                  type="text"
                  value={handoverCarrier}
                  onChange={(e) => setHandoverCarrier(e.target.value)}
                  placeholder="Es. BRT, DHL, Bartolini, Trasportatore..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Nome e Cognome Autista *
                </label>
                <input
                  type="text"
                  value={handoverDriver}
                  onChange={(e) => setHandoverDriver(e.target.value)}
                  placeholder="Nome autista ritiro"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Targa Mezzo
                </label>
                <input
                  type="text"
                  value={handoverPlate}
                  onChange={(e) => setHandoverPlate(e.target.value.toUpperCase())}
                  placeholder="Es. GH123AB"
                  className="w-full px-3 py-2 font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  N° DDT / Bolla
                </label>
                <input
                  type="text"
                  value={handoverDdt}
                  onChange={(e) => setHandoverDdt(e.target.value)}
                  placeholder="Es. DDT 842/26"
                  className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Peso Dichiarato su DDT (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={handoverDdtWeightStr}
                  onChange={(e) => setHandoverDdtWeightStr(e.target.value)}
                  placeholder={`Somma scatole: ${totalCertifiedScaleWeight.toFixed(2)} kg`}
                  className="w-full px-3 py-2 font-mono tabular-nums font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  Note Consegna / Riserve / Stato Bancali
                </label>
                <input
                  type="text"
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Es. N. 12 scatole sigillate su 2 bancali EPAL filmati integri, ritirati senza riserve..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            {/* Foto Bancali Filmati & Carico Camion / Targa */}
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Foto Bancali Filmati &amp; Carico sul Camion ({handoverPhotos.length} scatti timbrati)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    + Foto Bancale Filmato Completo
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={(e) =>
                        handleHandoverPhotoUpload(
                          'handover_pallet',
                          'Bancale Filmato Completo',
                          e
                        )
                      }
                      className="hidden"
                    />
                  </label>
                  <label className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    + Foto Carico Camion / Targa
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      capture="environment"
                      onChange={(e) =>
                        handleHandoverPhotoUpload(
                          'handover_truck',
                          'Carico Camion & Targa',
                          e
                        )
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {handoverPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {handoverPhotos.map((ph) => (
                    <div
                      key={ph.id}
                      className="border border-slate-200 rounded-lg overflow-hidden bg-slate-900"
                    >
                      <div className="px-2 py-1 bg-white border-b border-slate-200 flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-slate-800 truncate">
                          {ph.stageLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setHandoverPhotos((prev) =>
                              prev.filter((p) => p.id !== ph.id)
                            )
                          }
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <img
                        src={ph.dataUrl}
                        alt={ph.stageLabel}
                        className="w-full h-28 object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Riquadro Firma Digitale Autista */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-slate-700" />
                  Firma Digitale Autista per Ritiro Colli Integri e Sigillati
                </span>
                <button
                  type="button"
                  onClick={handleClearDriverSignature}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer flex items-center gap-1"
                >
                  <Eraser className="w-3 h-3" />
                  Pulisci Firma
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div className="border border-slate-300 rounded-lg bg-white overflow-hidden">
                  <canvas
                    ref={sigCanvasRef}
                    width={520}
                    height={150}
                    onMouseDown={handleSigStart}
                    onMouseMove={handleSigMove}
                    onMouseUp={handleSigEnd}
                    onMouseLeave={handleSigEnd}
                    onTouchStart={handleSigStart}
                    onTouchMove={handleSigMove}
                    onTouchEnd={handleSigEnd}
                    className="w-full h-[140px] touch-none cursor-crosshair block"
                  />
                  <div className="px-3 py-1 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500">
                    Firma con mouse, dito o pennino nel riquadro bianco sopra
                  </div>
                </div>

                {driverSignatureUrl ? (
                  <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3">
                    <div className="text-[11px] font-bold text-emerald-800 mb-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Firma autista acquisita (verrà stampata nel Dossier PDF)
                    </div>
                    <img
                      src={driverSignatureUrl}
                      alt="Firma autista"
                      className="h-24 bg-white border border-emerald-200 rounded object-contain w-full"
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-lg p-4 text-xs text-slate-500 bg-slate-50">
                    La firma digitale dell autista attesta il ritiro fisico di tutti i colli sigillati e integri e viene incorporata direttamente nel Verbale PDF Anti-Contestazione.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-500">
                Colli consegnati: <strong className="text-slate-900">{targets.length} scatole</strong> ·{' '}
                <strong className="text-slate-900">{load.pallets.length} bancali</strong>
              </div>
              <button
                type="submit"
                disabled={isSavingHandover}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <ShieldCheck className="w-4 h-4" />
                {isSavingHandover
                  ? 'Certificazione in corso...'
                  : 'Salva & Certifica Verbale Consegna Corriere 101%'}
              </button>
            </div>

            {handoverMessage && (
              <div
                className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
                  handoverMessage.kind === 'error'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                {handoverMessage.kind === 'error' ? (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                <span className="font-medium">{handoverMessage.text}</span>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
