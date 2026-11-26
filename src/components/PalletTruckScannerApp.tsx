import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScanBarcode,
  Package,
  Truck,
  ArrowUpRight,
  Plus,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Layers,
  Box as BoxIcon,
  RotateCcw,
  Sparkles,
  Check,
  Pencil,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  AuthUser,
  CargoLoad,
  WarehouseInventoryState,
  WarehouseStockItem,
} from '../types/warehouse';
import {
  formatItDateTime,
  lookupScannedCodeAcrossLoads,
  ResolvedTrackingRecord,
  resolveAllTrackingRecordsForLoad,
} from '../utils/qrTrackingUtils';
import {
  downloadOutboundManifestExcel,
  downloadOutboundManifestPdf,
} from '../utils/outboundManifestExporter';
import {
  createUniversalBarcodeReader,
  decodeBarcodeFromVideoFrame,
} from '../utils/barcodeDecoder';

export type ScannerOperationMode = 'pack' | 'truck' | 'unload';

export interface ScanLogEntry {
  id: string;
  timestampIso: string;
  mode: ScannerOperationMode;
  rawCode: string;
  sku: string;
  title: string;
  subtitle: string;
  quantity: number;
  status: 'ok' | 'auto_created' | 'warning';
  inventoryItemId?: string;
  trackingRecord?: ResolvedTrackingRecord | null;
}

interface PalletTruckScannerAppProps {
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  inventory: WarehouseInventoryState;
  currentUser: AuthUser;
  onSelectLoad: (loadId: string) => void;
  onUpdateInventory: (next: WarehouseInventoryState) => void;
  onAddPallet: (data: {
    label: string;
    palletType: 'EPAL_80x120' | 'IND_100x120' | 'HALF_80x60' | 'FUORI_MISURA';
    heightCm: number;
    notes: string;
  }) => void;
  onAddBox: (data: {
    label: string;
    boxType: 'S_40x30x30' | 'M_60x40x40' | 'L_80x60x50' | 'CASSA_LEGNO' | 'PERSONALIZZATA';
    palletId: string | null;
    parentBoxId?: string | null;
    dimensionsCm?: string;
    fragile: boolean;
    stackLevel: 1 | 2 | 3;
  }) => void;
  onAssignPalletSlot: (palletId: string, slot: number | null) => void;
  onTogglePalletWrapped: (palletId: string) => void;
  onScanPackItemToLoad: (payload: {
    loadId: string;
    sku: string;
    name: string;
    category: string;
    quantity: number;
    palletId: string | null;
    boxId: string | null;
    notes?: string;
  }) => { itemId: string; merged: boolean };
  onRenameLoadItemBySku?: (loadId: string, sku: string, newName: string) => void;
  onDispatchTrackingRecord: (
    record: ResolvedTrackingRecord,
    options?: { syncWarehouse?: boolean; undo?: boolean }
  ) => {
    timestampIso?: string;
    itemsCount: number;
    piecesCount: number;
    warehouseMatchedCount: number;
  };
}

function playBeep(kind: 'ok' | 'created' | 'warn') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq: number, startOffset: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'warn' ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startOffset);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + startOffset);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + startOffset + dur
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + dur);
    };

    if (kind === 'ok') {
      playTone(1040, 0, 0.09);
    } else if (kind === 'created') {
      playTone(880, 0, 0.08);
      playTone(1320, 0.1, 0.11);
    } else {
      playTone(300, 0, 0.18);
    }
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 350);
  } catch {
    // Audio non disponibile
  }
}

function normalizeBarcodeToken(raw: string): string {
  return raw.replace(/^\*|\*$/g, '').trim();
}

export const PalletTruckScannerApp: React.FC<PalletTruckScannerAppProps> = ({
  loads,
  activeLoad,
  inventory,
  currentUser,
  onSelectLoad,
  onUpdateInventory,
  onAddPallet,
  onAddBox,
  onAssignPalletSlot,
  onTogglePalletWrapped,
  onScanPackItemToLoad,
  onRenameLoadItemBySku,
  onDispatchTrackingRecord,
}) => {
  const [mode, setMode] = useState<ScannerOperationMode>('pack');
  const [scanInput, setScanInput] = useState('');
  const [scanQty, setScanQty] = useState<number>(1);
  const [selectedPalletId, setSelectedPalletId] = useState<string>(
    activeLoad.pallets[0]?.id || ''
  );
  const [selectedBoxId, setSelectedBoxId] = useState<string>('');
  const [targetTruckSlot, setTargetTruckSlot] = useState<number | null>(null);
  const [autoWrapOnTruckLoad, setAutoWrapOnTruckLoad] = useState<boolean>(true);
  const [syncWarehouseOnUnload, setSyncWarehouseOnUnload] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoFocusLocked, setAutoFocusLocked] = useState<boolean>(true);
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [lastFeedback, setLastFeedback] = useState<{
    kind: 'ok' | 'auto_created' | 'warning';
    title: string;
    detail: string;
  } | null>(null);
  const [lastUnloadedRecord, setLastUnloadedRecord] =
    useState<ResolvedTrackingRecord | null>(null);

  // Quick rename state for auto-created catalog items (qty 0)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState<string>('');

  // Camera scanner state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCamScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync selected pallet & box when activeLoad changes
  useEffect(() => {
    if (
      selectedPalletId &&
      !activeLoad.pallets.some((p) => p.id === selectedPalletId)
    ) {
      setSelectedPalletId(activeLoad.pallets[0]?.id || '');
      setSelectedBoxId('');
    } else if (!selectedPalletId && activeLoad.pallets.length > 0) {
      setSelectedPalletId(activeLoad.pallets[0].id);
    }
  }, [activeLoad.id, activeLoad.pallets, selectedPalletId]);

  const boxesOnSelectedPallet = useMemo(() => {
    if (!selectedPalletId) return activeLoad.boxes;
    return activeLoad.boxes.filter((b) => b.palletId === selectedPalletId);
  }, [activeLoad.boxes, selectedPalletId]);

  useEffect(() => {
    if (selectedBoxId && !activeLoad.boxes.some((b) => b.id === selectedBoxId)) {
      setSelectedBoxId('');
    }
  }, [activeLoad.boxes, selectedBoxId]);

  // Refocus USB barcode wedge input automatically when enabled
  const refocusInput = useCallback(() => {
    if (!autoFocusLocked || editingItemId) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [autoFocusLocked, editingItemId]);

  useEffect(() => {
    refocusInput();
  }, [mode, selectedPalletId, selectedBoxId, refocusInput]);

  // Stats for current load
  const loadStats = useMemo(() => {
    const palletsOnTruck = activeLoad.pallets.filter(
      (p) => p.truckSlot !== null
    ).length;
    const shippedItems = activeLoad.items.filter((i) => Boolean(i.shippedAt)).length;
    const totalPieces = activeLoad.items.reduce((s, i) => s + (i.quantity || 0), 0);
    const autoCreatedCount = scanLogs.filter((l) => l.status === 'auto_created').length;
    return {
      palletsTotal: activeLoad.pallets.length,
      palletsOnTruck,
      boxesTotal: activeLoad.boxes.length,
      itemsTotal: activeLoad.items.length,
      shippedItems,
      totalPieces,
      autoCreatedCount,
    };
  }, [activeLoad, scanLogs]);

  const allTrackingRecords = useMemo(
    () => resolveAllTrackingRecordsForLoad(activeLoad, inventory.movements),
    [activeLoad, inventory.movements]
  );

  // Core barcode processor
  const processScannedCode = useCallback(
    (rawValue: string) => {
      const cleaned = normalizeBarcodeToken(rawValue);
      if (!cleaned) return;
      const nowIso = new Date().toISOString();
      const upper = cleaned.toUpperCase();
      const compact = upper.replace(/[^A-Z0-9]/g, '');

      // ================================================================
      // MODALITÀ 1: CARICA SU BANCALE / SCATOLA (+ AUTO-CREA ARTICOLO A 0)
      // ================================================================
      if (mode === 'pack') {
        // 1A. Verifica se lo scan corrisponde a un BANCALE o SCATOLA della commessa (per selezionarlo al volo)
        const trackedHit = lookupScannedCodeAcrossLoads(
          cleaned,
          [activeLoad],
          inventory.movements
        );
        if (trackedHit && trackedHit.type === 'pallet') {
          setSelectedPalletId(trackedHit.entityId);
          setSelectedBoxId('');
          if (soundEnabled) playBeep('ok');
          setLastFeedback({
            kind: 'ok',
            title: `Bancale selezionato: ${trackedHit.code}`,
            detail: `Ora tutto ciò che spari andrà su ${trackedHit.code} (${trackedHit.name}).`,
          });
          setScanLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              timestampIso: nowIso,
              mode: 'pack',
              rawCode: cleaned,
              sku: trackedHit.code,
              title: `Selezionato Bancale ${trackedHit.code}`,
              subtitle: trackedHit.name,
              quantity: 1,
              status: 'ok',
            },
            ...prev.slice(0, 49),
          ]);
          return;
        }
        if (trackedHit && trackedHit.type === 'box') {
          const boxObj = activeLoad.boxes.find((b) => b.id === trackedHit.entityId);
          if (boxObj) {
            if (boxObj.palletId) setSelectedPalletId(boxObj.palletId);
            setSelectedBoxId(boxObj.id);
            if (soundEnabled) playBeep('ok');
            setLastFeedback({
              kind: 'ok',
              title: `Scatola selezionata: ${boxObj.code}`,
              detail: `I prossimi articoli sparati verranno inseriti dentro ${boxObj.code} (${boxObj.label}).`,
            });
            setScanLogs((prev) => [
              {
                id: `log-${Date.now()}`,
                timestampIso: nowIso,
                mode: 'pack',
                rawCode: cleaned,
                sku: boxObj.code,
                title: `Selezionata Scatola ${boxObj.code}`,
                subtitle: boxObj.label,
                quantity: 1,
                status: 'ok',
              },
              ...prev.slice(0, 49),
            ]);
            return;
          }
        }

        // 1B. Cerca l'articolo nel Magazzino Gestionale (per barcode o SKU)
        const existingStock = inventory.items.find((it) => {
          const skuU = (it.sku || '').trim().toUpperCase();
          const barU = (it.barcode || '').trim().toUpperCase();
          return (
            skuU === upper ||
            barU === upper ||
            (compact.length >= 3 &&
              (skuU.replace(/[^A-Z0-9]/g, '') === compact ||
                barU.replace(/[^A-Z0-9]/g, '') === compact))
          );
        });

        let resolvedSku = existingStock?.sku || upper;
        let resolvedName = existingStock?.name || '';
        let resolvedCategory = existingStock?.category || '';
        let autoCreatedId: string | undefined;

        // Se NON esiste nel gestionale -> CREA AUTOMATICAMENTE CON QUANTITÀ 0!
        if (!existingStock) {
          // Controlla se esiste già nella checklist della commessa per prendere almeno il nome
          const loadItemHint = activeLoad.items.find(
            (li) => li.sku.trim().toUpperCase() === upper
          );
          resolvedSku = loadItemHint?.sku || upper;
          resolvedName = loadItemHint?.name || `Articolo ${resolvedSku}`;
          resolvedCategory = loadItemHint?.category || '';

          const newItemId = `stk-auto-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;
          autoCreatedId = newItemId;

          const newStockItem: WarehouseStockItem = {
            id: newItemId,
            sku: resolvedSku,
            barcode: cleaned,
            name: resolvedName,
            category: resolvedCategory,
            unit: 'pz',
            quantity: 0,
            minStock: 0,
            location: 'Da classificare',
            notes: `Creato automaticamente con q.tà 0 da Scanner Bancale/Camion (Commessa ${activeLoad.code})`,
            updatedAt: nowIso,
          };

          onUpdateInventory({
            ...inventory,
            items: [newStockItem, ...inventory.items],
          });
        }

        // Aggiunge/aggiorna l'articolo sul Bancale / Scatola selezionati nella commessa attiva
        const targetPalletObj = activeLoad.pallets.find(
          (p) => p.id === selectedPalletId
        );
        const targetBoxObj = activeLoad.boxes.find((b) => b.id === selectedBoxId);
        const effectivePalletId =
          targetBoxObj?.palletId || targetPalletObj?.id || null;

        onScanPackItemToLoad({
          loadId: activeLoad.id,
          sku: resolvedSku,
          name: resolvedName,
          category: resolvedCategory || 'Generale',
          quantity: Math.max(1, scanQty),
          palletId: effectivePalletId,
          boxId: targetBoxObj?.id || null,
          notes: autoCreatedId
            ? 'Creato in automatico in Magazzino con q.tà 0'
            : undefined,
        });

        const destLabel = targetBoxObj
          ? `${targetPalletObj ? `${targetPalletObj.code} › ` : ''}${targetBoxObj.code}`
          : targetPalletObj
          ? `${targetPalletObj.code} (fuori scatola)`
          : 'Commessa (senza bancale)';

        if (autoCreatedId) {
          if (soundEnabled) playBeep('created');
          setLastFeedback({
            kind: 'auto_created',
            title: `Creato in Magazzino (q.tà 0) e caricato su ${destLabel}`,
            detail: `${resolvedSku} non era nel gestionale: aggiunto automaticamente con quantità 0 + caricato ×${scanQty} su ${destLabel}.`,
          });
        } else {
          if (soundEnabled) playBeep('ok');
          setLastFeedback({
            kind: 'ok',
            title: `Caricato ×${scanQty} su ${destLabel}`,
            detail: `${resolvedSku} — ${resolvedName}`,
          });
        }

        setScanLogs((prev) => [
          {
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            timestampIso: nowIso,
            mode: 'pack',
            rawCode: cleaned,
            sku: resolvedSku,
            title: resolvedName,
            subtitle: `Su ${destLabel}`,
            quantity: Math.max(1, scanQty),
            status: autoCreatedId ? 'auto_created' : 'ok',
            inventoryItemId: autoCreatedId || existingStock?.id,
          },
          ...prev.slice(0, 49),
        ]);
        return;
      }

      // ================================================================
      // MODALITÀ 2: CARICA BANCALE SUL CAMION
      // ================================================================
      if (mode === 'truck') {
        const trackedHit = lookupScannedCodeAcrossLoads(
          cleaned,
          [activeLoad],
          inventory.movements
        );

        let targetPallet =
          trackedHit && trackedHit.type === 'pallet'
            ? activeLoad.pallets.find((p) => p.id === trackedHit.entityId)
            : activeLoad.pallets.find((p) => {
                const codeU = p.code.toUpperCase();
                return (
                  codeU === upper ||
                  codeU.replace(/[^A-Z0-9]/g, '') === compact
                );
              });

        // Se ha sparato una scatola, trova il bancale che la contiene
        if (!targetPallet && trackedHit && trackedHit.type === 'box') {
          const boxObj = activeLoad.boxes.find((b) => b.id === trackedHit.entityId);
          if (boxObj?.palletId) {
            targetPallet = activeLoad.pallets.find((p) => p.id === boxObj.palletId);
          }
        }

        if (!targetPallet) {
          if (soundEnabled) playBeep('warn');
          setLastFeedback({
            kind: 'warning',
            title: `Bancale non trovato in ${activeLoad.code}`,
            detail: `Il codice "${cleaned}" non corrisponde a nessun bancale della commessa attiva.`,
          });
          setScanLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              timestampIso: nowIso,
              mode: 'truck',
              rawCode: cleaned,
              sku: cleaned,
              title: 'Bancale non trovato',
              subtitle: `Commessa ${activeLoad.code}`,
              quantity: 1,
              status: 'warning',
            },
            ...prev.slice(0, 49),
          ]);
          return;
        }

        // Trova posto camion libero (o quello selezionato dall'utente)
        const maxSlots = Math.max(1, activeLoad.vehicleMaxPallets || 18);
        const occupied = new Set(
          activeLoad.pallets
            .filter((p) => p.id !== targetPallet!.id && p.truckSlot !== null)
            .map((p) => p.truckSlot as number)
        );
        let chosenSlot = targetTruckSlot;
        if (!chosenSlot || occupied.has(chosenSlot)) {
          chosenSlot = null;
          for (let s = 1; s <= maxSlots; s++) {
            if (!occupied.has(s)) {
              chosenSlot = s;
              break;
            }
          }
        }

        if (!chosenSlot) {
          if (soundEnabled) playBeep('warn');
          setLastFeedback({
            kind: 'warning',
            title: 'Camion al completo',
            detail: `Tutti i ${maxSlots} posti del mezzo risultano già occupati.`,
          });
          return;
        }

        onAssignPalletSlot(targetPallet.id, chosenSlot);
        if (autoWrapOnTruckLoad && !targetPallet.wrapped) {
          onTogglePalletWrapped(targetPallet.id);
        }
        setTargetTruckSlot(null);

        if (soundEnabled) playBeep('ok');
        setLastFeedback({
          kind: 'ok',
          title: `Bancale ${targetPallet.code} caricato sul Posto #${chosenSlot}`,
          detail: `${targetPallet.label}${
            autoWrapOnTruckLoad ? ' · Filmato/pronto per trasporto' : ''
          }`,
        });
        setScanLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timestampIso: nowIso,
            mode: 'truck',
            rawCode: cleaned,
            sku: targetPallet!.code,
            title: `Caricato su Camion — Posto #${chosenSlot}`,
            subtitle: targetPallet!.label,
            quantity: 1,
            status: 'ok',
          },
          ...prev.slice(0, 49),
        ]);
        return;
      }

      // ================================================================
      // MODALITÀ 3: SCARICA USCITA CON BARCODE (DATA E ORA + CONTENUTO)
      // ================================================================
      if (mode === 'unload') {
        const trackedHit = lookupScannedCodeAcrossLoads(
          cleaned,
          loads,
          inventory.movements
        );

        if (!trackedHit) {
          if (soundEnabled) playBeep('warn');
          setLastFeedback({
            kind: 'warning',
            title: `Codice "${cleaned}" non trovato nelle commesse`,
            detail:
              'Spara il barcode/QR di un Bancale, di una Scatola o di un Articolo stampato da Etichette o TiMini.',
          });
          setScanLogs((prev) => [
            {
              id: `log-${Date.now()}`,
              timestampIso: nowIso,
              mode: 'unload',
              rawCode: cleaned,
              sku: cleaned,
              title: 'Codice non riconosciuto per scarico uscita',
              subtitle: 'Nessun bancale/scatola corrispondente',
              quantity: 1,
              status: 'warning',
            },
            ...prev.slice(0, 49),
          ]);
          return;
        }

        const res = onDispatchTrackingRecord(trackedHit, {
          syncWarehouse: syncWarehouseOnUnload,
        });
        const updatedRecord: ResolvedTrackingRecord = {
          ...trackedHit,
          shippedAt: res.timestampIso || nowIso,
        };
        setLastUnloadedRecord(updatedRecord);

        if (soundEnabled) playBeep('ok');
        const kindLabel =
          trackedHit.type === 'pallet'
            ? 'Bancale'
            : trackedHit.type === 'box'
            ? 'Scatola'
            : 'Articolo';
        setLastFeedback({
          kind: 'ok',
          title: `Scarico Uscita registrato: ${kindLabel} ${trackedHit.code}`,
          detail: `${res.itemsCount} righe (${res.piecesCount} pz) scaricate il ${formatItDateTime(
            updatedRecord.shippedAt,
            true
          )}. Distinta Excel/PDF pronta.`,
        });
        setScanLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timestampIso: updatedRecord.shippedAt || nowIso,
            mode: 'unload',
            rawCode: cleaned,
            sku: trackedHit.code,
            title: `Uscita ${kindLabel}: ${trackedHit.name}`,
            subtitle: `${trackedHit.commessaCode} · ${res.piecesCount} pz · ${formatItDateTime(
              updatedRecord.shippedAt,
              true
            )}`,
            quantity: res.piecesCount,
            status: 'ok',
            trackingRecord: updatedRecord,
          },
          ...prev.slice(0, 49),
        ]);
      }
    },
    [
      mode,
      activeLoad,
      loads,
      inventory,
      selectedPalletId,
      selectedBoxId,
      scanQty,
      targetTruckSlot,
      autoWrapOnTruckLoad,
      syncWarehouseOnUnload,
      soundEnabled,
      onUpdateInventory,
      onScanPackItemToLoad,
      onAssignPalletSlot,
      onTogglePalletWrapped,
      onDispatchTrackingRecord,
    ]
  );

  // Camera scanner lifecycle
  useEffect(() => {
    if (!cameraOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let rafTimer: number | null = null;
    const reader = createUniversalBarcodeReader();

    const startCamera = async () => {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const scanTick = () => {
          if (cancelled) return;
          if (videoRef.current && canvasRef.current) {
            const decoded = decodeBarcodeFromVideoFrame(
              reader,
              videoRef.current,
              canvasRef.current,
              true
            );
            if (decoded) {
              const now = Date.now();
              if (
                decoded !== lastCamScanRef.current.code ||
                now - lastCamScanRef.current.at > 1800
              ) {
                lastCamScanRef.current = { code: decoded, at: now };
                processScannedCode(decoded);
              }
            }
          }
          rafTimer = window.setTimeout(scanTick, 220);
        };
        rafTimer = window.setTimeout(scanTick, 350);
      } catch {
        setCameraError(
          'Fotocamera non disponibile o permesso negato. Usa la pistola barcode USB o inserisci il codice.'
        );
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      if (rafTimer !== null) window.clearTimeout(rafTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOpen, processScannedCode]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    processScannedCode(scanInput);
    setScanInput('');
    refocusInput();
  };

  const handleSaveInlineRename = (logEntry: ScanLogEntry) => {
    const trimmed = editingItemName.trim();
    if (!trimmed || !logEntry.inventoryItemId) {
      setEditingItemId(null);
      return;
    }
    const nowIso = new Date().toISOString();
    onUpdateInventory({
      ...inventory,
      items: inventory.items.map((it) =>
        it.id === logEntry.inventoryItemId
          ? { ...it, name: trimmed, updatedAt: nowIso }
          : it
      ),
    });
    if (onRenameLoadItemBySku) {
      onRenameLoadItemBySku(activeLoad.id, logEntry.sku, trimmed);
    }
    setScanLogs((prev) =>
      prev.map((l) =>
        l.inventoryItemId === logEntry.inventoryItemId
          ? { ...l, title: trimmed }
          : l
      )
    );
    setEditingItemId(null);
    refocusInput();
  };

  const handleQuickCreatePallet = () => {
    const nextNum = activeLoad.pallets.length + 1;
    onAddPallet({
      label: `Bancale #${nextNum}`,
      palletType: 'EPAL_80x120',
      heightCm: 140,
      notes: 'Creato da Scanner Bancale & Camion',
    });
  };

  const handleQuickCreateBox = () => {
    const nextNum = activeLoad.boxes.length + 1;
    onAddBox({
      label: `Scatola #${nextNum}`,
      boxType: 'M_60x40x40',
      palletId: selectedPalletId || activeLoad.pallets[0]?.id || null,
      fragile: false,
      stackLevel: 1,
    });
  };

  const truckMaxSlots = Math.max(1, activeLoad.vehicleMaxPallets || 18);
  const palletsBySlot = useMemo(() => {
    const map = new Map<number, (typeof activeLoad.pallets)[number]>();
    activeLoad.pallets.forEach((p) => {
      if (p.truckSlot !== null) map.set(p.truckSlot, p);
    });
    return map;
  }, [activeLoad.pallets]);

  const waitingPallets = useMemo(
    () => activeLoad.pallets.filter((p) => p.truckSlot === null),
    [activeLoad.pallets]
  );

  const selectedPalletObj = activeLoad.pallets.find(
    (p) => p.id === selectedPalletId
  );
  const selectedBoxObj = activeLoad.boxes.find((b) => b.id === selectedBoxId);

  const itemsInSelectedTarget = useMemo(() => {
    if (selectedBoxId) {
      return activeLoad.items.filter((i) => i.boxId === selectedBoxId);
    }
    if (selectedPalletId) {
      const boxIdsOnPallet = new Set(
        activeLoad.boxes
          .filter((b) => b.palletId === selectedPalletId)
          .map((b) => b.id)
      );
      return activeLoad.items.filter(
        (i) =>
          i.palletId === selectedPalletId ||
          (i.boxId && boxIdsOnPallet.has(i.boxId))
      );
    }
    return activeLoad.items;
  }, [activeLoad.items, activeLoad.boxes, selectedPalletId, selectedBoxId]);

  const unloadSourceLoad = useMemo(() => {
    if (!lastUnloadedRecord) return activeLoad;
    return (
      loads.find(
        (l) =>
          l.code.trim().toUpperCase() ===
          lastUnloadedRecord.commessaCode.trim().toUpperCase()
      ) || activeLoad
    );
  }, [lastUnloadedRecord, loads, activeLoad]);

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] text-slate-900 overflow-hidden">
      {/* ================================================================
          HEADER SUPERIORE DEDICATO (SEPARATO DAL GESTIONALE MAGAZZINO)
      ================================================================ */}
      <header className="bg-white border-b border-slate-200/90 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
            <ScanBarcode className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight truncate">
              Scanner Carico Bancale &amp; Camion
            </h1>
            <p className="text-xs text-slate-500 truncate">
              Pistola barcode per bancali, scatole e camion · Auto-creazione articoli mancanti a q.tà 0
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selettore Commessa */}
          <select
            value={activeLoad.id}
            onChange={(e) => onSelectLoad(e.target.value)}
            aria-label="Commessa attiva"
            className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-400 cursor-pointer"
          >
            {loads.map((ld) => (
              <option key={ld.id} value={ld.id}>
                {ld.code} — {ld.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAutoFocusLocked((p) => !p)}
            className={`h-9 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              autoFocusLocked
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Mantieni il cursore sempre pronto per la pistola barcode USB"
          >
            {autoFocusLocked ? (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            <span className="hidden md:inline">Auto-Focus</span>
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((p) => !p)}
            className="h-9 w-9 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
            title={soundEnabled ? 'Disattiva beep audio' : 'Attiva beep audio'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-slate-700" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setCameraOpen((p) => !p)}
            className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              cameraOpen
                ? 'bg-amber-500 border-amber-600 text-slate-950'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {cameraOpen ? (
              <CameraOff className="w-3.5 h-3.5" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>{cameraOpen ? 'Chiudi Camera' : 'Fotocamera'}</span>
          </button>
        </div>
      </header>

      {/* ================================================================
          SELETTORE MODALITÀ OPERATIVA (3 TAB CHIARE)
      ================================================================ */}
      <div className="bg-white border-b border-slate-200/80 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200/80">
          <button
            type="button"
            onClick={() => setMode('pack')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'pack'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>1. Carica su Bancale / Scatola</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('truck')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'truck'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>2. Carica sul Camion</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('unload')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              mode === 'unload'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>3. Scarica Uscita (Data/Ora)</span>
          </button>
        </div>

        {/* Metriche compatte in linea (no pill, numeri tabellari) */}
        <div className="flex items-center gap-5 text-xs text-slate-600 font-mono tabular-nums">
          <div>
            <span className="text-slate-400 font-sans mr-1.5">Bancali:</span>
            <strong className="text-slate-900">
              {loadStats.palletsOnTruck}/{loadStats.palletsTotal}
            </strong>
            <span className="text-slate-400 font-sans ml-1">su camion</span>
          </div>
          <div>
            <span className="text-slate-400 font-sans mr-1.5">Scatole:</span>
            <strong className="text-slate-900">{loadStats.boxesTotal}</strong>
          </div>
          <div>
            <span className="text-slate-400 font-sans mr-1.5">Pezzi:</span>
            <strong className="text-slate-900">{loadStats.totalPieces}</strong>
          </div>
          {loadStats.autoCreatedCount > 0 && (
            <div className="text-amber-700 font-sans font-medium">
              Auto-creati (q.tà 0):{' '}
              <strong className="font-mono">{loadStats.autoCreatedCount}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          AREA PRINCIPALE A 2 COLONNE
      ================================================================ */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-5 items-start">
          {/* COLONNA SINISTRA: POSTAZIONE SCANNER + CONTROLLI OPERATIVI */}
          <div className="space-y-4">
            {/* Box Input Pistola Barcode */}
            <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {mode === 'pack'
                      ? 'Spara Barcode Articolo o Scatola'
                      : mode === 'truck'
                      ? 'Spara Barcode Bancale da Caricare sul Camion'
                      : 'Spara Barcode Bancale / Scatola per Scarico Uscita'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {mode === 'pack'
                      ? 'Se il codice non è presente nel gestionale Magazzino, viene creato automaticamente con quantità 0 e aggiunto subito al bancale.'
                      : mode === 'truck'
                      ? 'Assegna automaticamente il bancale scansionato al prossimo posto libero sul camion (o allo slot selezionato).'
                      : 'Registra data e ora esatta di uscita di tutto il contenuto del bancale o della scatola e prepara la distinta Excel/PDF.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleFormSubmit} className="flex flex-wrap gap-2.5">
                <div className="relative flex-1 min-w-[230px]">
                  <ScanBarcode className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder={
                      mode === 'pack'
                        ? 'Spara qui il barcode con la pistola oppure digita SKU + Invio...'
                        : mode === 'truck'
                        ? 'Spara codice bancale (es. PAL-01 o barcode etichetta)...'
                        : 'Spara barcode/QR di Bancale, Scatola o Articolo...'
                    }
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-slate-50 border-2 border-slate-300 focus:border-slate-900 focus:bg-white text-sm font-mono text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none transition-colors"
                  />
                </div>

                {mode === 'pack' && (
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-2 h-12 gap-1">
                    <span className="text-[11px] font-medium text-slate-500 pl-1">
                      Q.tà
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={9999}
                      value={scanQty}
                      onChange={(e) =>
                        setScanQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                      }
                      className="w-14 h-8 text-center font-mono text-sm font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                    {[1, 2, 5].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setScanQty(preset);
                          refocusInput();
                        }}
                        className={`px-2 h-8 rounded-lg text-xs font-mono font-medium cursor-pointer transition-colors ${
                          scanQty === preset
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        ×{preset}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  className="h-12 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                >
                  <span>Registra</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>

              {/* Camera Preview */}
              {cameraOpen && (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-950 relative">
                  {cameraError ? (
                    <div className="p-4 text-xs text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{cameraError}</span>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={videoRef}
                        muted
                        playsInline
                        className="w-full max-h-[240px] object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-0.5 bg-amber-400/90 pointer-events-none" />
                    </>
                  )}
                </div>
              )}

              {/* Feedback Immediato Ultima Scansione */}
              {lastFeedback && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    lastFeedback.kind === 'auto_created'
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : lastFeedback.kind === 'warning'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  }`}
                >
                  {lastFeedback.kind === 'auto_created' ? (
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : lastFeedback.kind === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 text-xs">
                    <div className="font-semibold">{lastFeedback.title}</div>
                    <div className="opacity-85 mt-0.5 leading-relaxed">
                      {lastFeedback.detail}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* PANNELLO CONTESTUALE PER LA MODALITÀ SCELTA */}
            {mode === 'pack' && (
              <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Destinazione di Carico Attiva
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleQuickCreatePallet}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-xs font-medium text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nuovo Bancale
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCreateBox}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-xs font-medium text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Nuova Scatola
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Bancale di destinazione
                    </label>
                    <select
                      value={selectedPalletId}
                      onChange={(e) => {
                        setSelectedPalletId(e.target.value);
                        setSelectedBoxId('');
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer"
                    >
                      <option value="">Nessun bancale (solo commessa)</option>
                      {activeLoad.pallets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.label}
                          {p.truckSlot ? ` (Camion #${p.truckSlot})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      Scatola (opzionale)
                    </label>
                    <select
                      value={selectedBoxId}
                      onChange={(e) => setSelectedBoxId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer"
                    >
                      <option value="">
                        Fuori scatola (diretto sul bancale)
                      </option>
                      {boxesOnSelectedPallet.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} — {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contenuto attuale del Bancale / Scatola selezionati */}
                <div className="border-t border-slate-100 pt-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      {selectedBoxObj ? (
                        <>
                          <BoxIcon className="w-3.5 h-3.5 text-slate-500" />
                          Contenuto {selectedBoxObj.code} — {selectedBoxObj.label}
                        </>
                      ) : selectedPalletObj ? (
                        <>
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          Contenuto {selectedPalletObj.code} —{' '}
                          {selectedPalletObj.label}
                        </>
                      ) : (
                        'Articoli nella Commessa'
                      )}
                    </span>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {itemsInSelectedTarget.length} righe ·{' '}
                      {itemsInSelectedTarget.reduce((s, i) => s + i.quantity, 0)}{' '}
                      pz
                    </span>
                  </div>

                  {itemsInSelectedTarget.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                      Ancora vuoto. Spara il primo barcode per iniziare a riempirlo.
                    </div>
                  ) : (
                    <div className="max-h-[260px] overflow-y-auto divide-y divide-slate-100 border border-slate-200/80 rounded-xl">
                      {itemsInSelectedTarget.map((item) => {
                        const box = item.boxId
                          ? activeLoad.boxes.find((b) => b.id === item.boxId)
                          : null;
                        return (
                          <div
                            key={item.id}
                            className="px-3.5 py-2.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/80 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-slate-900">
                                  {item.sku}
                                </span>
                                {box && (
                                  <span className="font-mono text-[11px] text-slate-500">
                                    · {box.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-600 truncate">
                                {item.name}
                              </div>
                            </div>
                            <div className="text-right shrink-0 font-mono tabular-nums">
                              <div className="font-semibold text-slate-900">
                                ×{item.quantity} pz
                              </div>
                              {item.loadedAt && (
                                <div className="text-[10.5px] text-slate-400">
                                  {formatItDateTime(item.loadedAt)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            )}

            {mode === 'truck' && (
              <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Mappa Posti Camion ({loadStats.palletsOnTruck}/{truckMaxSlots})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clicca un posto libero per mirarlo oppure spara direttamente il bancale per riempire in sequenza.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoWrapOnTruckLoad}
                      onChange={(e) => setAutoWrapOnTruckLoad(e.target.checked)}
                      className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                    />
                    Segna bancale come filmato
                  </label>
                </div>

                {/* Griglia Slot Camion */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {Array.from({ length: truckMaxSlots }, (_, i) => i + 1).map(
                    (slotNum) => {
                      const occupant = palletsBySlot.get(slotNum);
                      const isTarget = targetTruckSlot === slotNum;
                      return (
                        <button
                          key={slotNum}
                          type="button"
                          onClick={() => {
                            if (occupant) {
                              onAssignPalletSlot(occupant.id, null);
                            } else {
                              setTargetTruckSlot(isTarget ? null : slotNum);
                              refocusInput();
                            }
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            occupant
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-950 hover:bg-rose-50 hover:border-rose-300'
                              : isTarget
                              ? 'bg-amber-50 border-amber-400 text-amber-950 ring-2 ring-amber-400/30'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}
                          title={
                            occupant
                              ? `Occupato da ${occupant.code} — Clicca per scaricare dal posto`
                              : `Posto libero #${slotNum} — Clicca per selezionare`
                          }
                        >
                          <div className="text-[10.5px] font-mono font-semibold opacity-70">
                            #{slotNum}
                          </div>
                          <div className="text-xs font-mono font-bold truncate mt-0.5">
                            {occupant ? occupant.code : isTarget ? 'PROSSIMO' : 'Libero'}
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Bancali ancora a terra pronti da caricare */}
                <div className="border-t border-slate-100 pt-3.5">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Bancali in attesa di carico sul camion ({waitingPallets.length})
                  </div>
                  {waitingPallets.length === 0 ? (
                    <div className="py-4 text-center text-xs text-emerald-700 bg-emerald-50/70 rounded-xl border border-emerald-200">
                      Tutti i bancali della commessa sono già caricati sul camion.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {waitingPallets.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => processScannedCode(p.code)}
                          className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-semibold text-slate-900">
                              {p.code}
                            </div>
                            <div className="text-[11.5px] text-slate-500 truncate">
                              {p.label}
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-800 shrink-0">
                            Carica →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {mode === 'unload' && (
              <section className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Distinta Merce in Uscita &amp; Contenuto Collo
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ogni barcode di bancale o scatola espande automaticamente tutto il contenuto interno con data e ora di uscita.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={syncWarehouseOnUnload}
                      onChange={(e) => setSyncWarehouseOnUnload(e.target.checked)}
                      className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                    />
                    Scala anche dal Magazzino
                  </label>
                </div>

                {/* Pulsanti Distinta Uscita Commessa */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      downloadOutboundManifestExcel(
                        activeLoad,
                        inventory.movements,
                        {
                          onlyShipped: true,
                          operatorName: currentUser.name,
                        }
                      )
                    }
                    className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Distinta Uscita Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadOutboundManifestPdf(
                        activeLoad,
                        inventory.movements,
                        {
                          onlyShipped: true,
                          operatorName: currentUser.name,
                        }
                      )
                    }
                    className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Distinta Uscita PDF</span>
                  </button>
                </div>

                {/* Dettaglio dell'ultimo collo scaricato */}
                {lastUnloadedRecord ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-mono font-bold text-slate-900">
                          {lastUnloadedRecord.code} · {lastUnloadedRecord.name}
                        </div>
                        <div className="text-[11.5px] text-slate-500 mt-0.5 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Scaricato il{' '}
                            {formatItDateTime(lastUnloadedRecord.shippedAt, true)}
                          </span>
                          <span>· {lastUnloadedRecord.commessaCode}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            downloadOutboundManifestExcel(
                              unloadSourceLoad,
                              inventory.movements,
                              {
                                onlyShipped: false,
                                operatorName: currentUser.name,
                                filterRecord: lastUnloadedRecord,
                              }
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          Excel Collo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadOutboundManifestPdf(
                              unloadSourceLoad,
                              inventory.movements,
                              {
                                onlyShipped: false,
                                operatorName: currentUser.name,
                                filterRecord: lastUnloadedRecord,
                              }
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          PDF Collo
                        </button>
                      </div>
                    </div>

                    {lastUnloadedRecord.detailedItems &&
                      lastUnloadedRecord.detailedItems.length > 0 && (
                        <div className="max-h-[210px] overflow-y-auto divide-y divide-slate-200/70 bg-white rounded-lg border border-slate-200">
                          {lastUnloadedRecord.detailedItems.map((di) => (
                            <div
                              key={di.itemId}
                              className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <span className="font-mono font-semibold text-slate-900 mr-2">
                                  {di.sku}
                                </span>
                                <span className="text-slate-600">{di.name}</span>
                                {di.boxPath && (
                                  <span className="text-[11px] font-mono text-slate-400 ml-2">
                                    [{di.boxPath}]
                                  </span>
                                )}
                              </div>
                              <span className="font-mono font-semibold text-slate-900 shrink-0 tabular-nums">
                                ×{di.quantity}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="border-t border-slate-100 pt-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Colli della commessa pronti per lo scarico rapido
                    </div>
                    <div className="max-h-[220px] overflow-y-auto space-y-1.5">
                      {allTrackingRecords
                        .filter((r) => r.type === 'pallet' || r.type === 'box')
                        .map((rec) => (
                          <div
                            key={`${rec.type}-${rec.entityId}`}
                            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-semibold text-slate-900">
                                {rec.code}{' '}
                                <span className="font-sans font-normal text-slate-600">
                                  — {rec.name}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {rec.quantityText}
                                {rec.shippedAt
                                  ? ` · Scaricato ${formatItDateTime(rec.shippedAt)}`
                                  : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => processScannedCode(rec.barcodeValue)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold shrink-0 cursor-pointer"
                            >
                              {rec.shippedAt ? 'Aggiorna' : 'Scarica'}
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* COLONNA DESTRA: REGISTRO LIVE SCANSIONI + RINOMINA RAPIDA ARTICOLI AUTO-CREATI */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col max-h-[680px]">
            <div className="px-5 py-3.5 border-b border-slate-200/80 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Registro Scansioni Live
                </h3>
                <p className="text-[11.5px] text-slate-500">
                  Gli articoli mancanti creati in automatico con q.tà 0 possono essere rinominati qui subito.
                </p>
              </div>
              {scanLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScanLogs([])}
                  className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Pulisci
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {scanLogs.length === 0 ? (
                <div className="py-16 px-6 text-center space-y-2">
                  <ScanBarcode className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-600">
                    Nessuna scansione in questa sessione
                  </p>
                  <p className="text-[11.5px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Punta la pistola barcode sulle scatole o sui bancali: ogni lettura apparirà qui in tempo reale.
                  </p>
                </div>
              ) : (
                scanLogs.map((entry) => {
                  const isEditing =
                    editingItemId !== null &&
                    entry.inventoryItemId === editingItemId;
                  return (
                    <div
                      key={entry.id}
                      className={`px-4 py-3 text-xs space-y-1.5 ${
                        entry.status === 'auto_created'
                          ? 'bg-amber-50/60'
                          : entry.status === 'warning'
                          ? 'bg-rose-50/50'
                          : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900">
                              {entry.sku}
                            </span>
                            {entry.status === 'auto_created' && (
                              <span className="text-[10.5px] font-semibold text-amber-800">
                                · Creato in Magazzino (q.tà 0)
                              </span>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <input
                                type="text"
                                autoFocus
                                value={editingItemName}
                                onChange={(e) => setEditingItemName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveInlineRename(entry);
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingItemId(null);
                                  }
                                }}
                                placeholder="Inserisci nome articolo..."
                                className="flex-1 h-8 px-2.5 rounded-lg bg-white border border-amber-400 text-xs text-slate-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveInlineRename(entry)}
                                className="h-8 px-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Salva
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-slate-700 font-medium truncate">
                                {entry.title}
                              </span>
                              {entry.status === 'auto_created' &&
                                entry.inventoryItemId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemId(entry.inventoryItemId!);
                                      setEditingItemName(entry.title);
                                    }}
                                    className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline underline-offset-2 flex items-center gap-1 cursor-pointer shrink-0"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Rinomina
                                  </button>
                                )}
                            </div>
                          )}

                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {entry.subtitle}
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono tabular-nums">
                          <div className="font-semibold text-slate-900">
                            ×{entry.quantity}
                          </div>
                          <div className="text-[10.5px] text-slate-400">
                            {formatItDateTime(entry.timestampIso, true).slice(11)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
