import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Boxes,
  Package,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Layers,
  Scale,
  QrCode,
  CalendarClock,
} from 'lucide-react';
import { CargoLoad, StockMovement } from '../types/warehouse';
import {
  decodeTrackPayload,
  formatItDateTime,
  resolveAllTrackingRecordsForLoad,
  ResolvedTrackingRecord,
} from '../utils/qrTrackingUtils';
import { authFetch, getAuthToken } from '../utils/authSession';

interface QrTrackingScanViewProps {
  encodedTrackParam?: string | null;
  initialRecord?: ResolvedTrackingRecord | null;
  localLoads?: CargoLoad[];
  localMovements?: StockMovement[];
  onClose?: () => void;
  onStampLocal?: (
    commessaCode: string,
    entityType: 'pallet' | 'box' | 'item',
    entityId: string,
    field: 'loadedAt' | 'shippedAt',
    timestampIso: string
  ) => void;
  isModal?: boolean;
}

export const QrTrackingScanView: React.FC<QrTrackingScanViewProps> = ({
  encodedTrackParam,
  initialRecord,
  localLoads,
  localMovements,
  onClose,
  onStampLocal,
  isModal = false,
}) => {
  const [record, setRecord] = useState<ResolvedTrackingRecord | null>(() => {
    if (initialRecord) return initialRecord;
    if (encodedTrackParam) return decodeTrackPayload(encodedTrackParam);
    return null;
  });

  const [isRefreshingLive, setIsRefreshingLive] = useState(false);
  const [isLiveSynced, setIsLiveSynced] = useState(false);
  const [stampingField, setStampingField] = useState<'loadedAt' | 'shippedAt' | null>(null);
  const [stampFeedback, setStampFeedback] = useState<string | null>(null);

  const hydrateLiveRecord = useCallback(
    async (baseRec: ResolvedTrackingRecord) => {
      // 1. Prima controlla i dati locali in memoria se disponibili
      if (localLoads && localLoads.length > 0) {
        const matchedLoad = localLoads.find(
          (l) =>
            l.code.trim().toUpperCase() === baseRec.commessaCode.trim().toUpperCase()
        );
        if (matchedLoad) {
          const resolvedList = resolveAllTrackingRecordsForLoad(
            matchedLoad,
            localMovements || []
          );
          const match = resolvedList.find(
            (r) =>
              r.type === baseRec.type &&
              (r.entityId === baseRec.entityId ||
                r.code.trim().toUpperCase() === baseRec.code.trim().toUpperCase())
          );
          if (match) {
            setRecord(match);
            setIsLiveSynced(true);
            return;
          }
        }
      }

      // 2. Poi interroga il server live: se siamo in scansione pubblica usa /api/public/track
      if (typeof window === 'undefined' || window.location.protocol === 'file:') return;
      setIsRefreshingLive(true);
      try {
        if (encodedTrackParam) {
          const pubRes = await fetch(
            `/api/public/track?d=${encodeURIComponent(encodedTrackParam)}`
          ).catch(() => null);
          if (pubRes && pubRes.ok) {
            const pubData = await pubRes.json();
            if (pubData?.record) {
              setRecord((prev) => ({
                ...(prev || baseRec),
                ...pubData.record,
                commessaId: prev?.commessaId || '',
                parentBoxCode: prev?.parentBoxCode || null,
              }));
              setIsLiveSynced(Boolean(pubData.record.liveVerified));
              return;
            }
          }
        }
        if (getAuthToken()) {
          const [loadsRes, invRes] = await Promise.all([
            authFetch('/api/loads').catch(() => null),
            authFetch('/api/inventory').catch(() => null),
          ]);
          const loadsData = loadsRes && loadsRes.ok ? await loadsRes.json() : null;
          const invData = invRes && invRes.ok ? await invRes.json() : null;

          const serverLoads: CargoLoad[] = Array.isArray(loadsData?.loads)
            ? loadsData.loads
            : [];
          const serverMovements: StockMovement[] = Array.isArray(
            invData?.inventory?.movements
          )
            ? invData.inventory.movements
            : [];

          const matchedLoad = serverLoads.find(
            (l) =>
              l.code.trim().toUpperCase() === baseRec.commessaCode.trim().toUpperCase()
          );
          if (matchedLoad) {
            const resolvedList = resolveAllTrackingRecordsForLoad(
              matchedLoad,
              serverMovements
            );
            const match = resolvedList.find(
              (r) =>
                r.type === baseRec.type &&
                (r.entityId === baseRec.entityId ||
                  r.code.trim().toUpperCase() === baseRec.code.trim().toUpperCase())
            );
            if (match) {
              setRecord(match);
              setIsLiveSynced(true);
            }
          }
        }
      } catch {
        // Rimane valido il dato decodificato offline dal QR
      } finally {
        setIsRefreshingLive(false);
      }
    },
    [localLoads, localMovements, encodedTrackParam]
  );

  useEffect(() => {
    const base =
      initialRecord ||
      (encodedTrackParam ? decodeTrackPayload(encodedTrackParam) : null);
    if (base) {
      setRecord(base);
      hydrateLiveRecord(base);
    }
  }, [encodedTrackParam, initialRecord, hydrateLiveRecord]);

  const handleStampNow = async (field: 'loadedAt' | 'shippedAt') => {
    if (!record) return;
    const nowIso = new Date().toISOString();
    setStampingField(field);
    setStampFeedback(null);

    try {
      // Aggiorna localmente se siamo dentro l'app
      if (onStampLocal) {
        onStampLocal(
          record.commessaCode,
          record.type,
          record.entityId,
          field,
          nowIso
        );
      }

      // Persiste sul server se l'utente è autenticato
      if (
        typeof window !== 'undefined' &&
        window.location.protocol !== 'file:' &&
        getAuthToken()
      ) {
        await authFetch('/api/track/stamp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            commessaCode: record.commessaCode,
            entityType: record.type,
            entityId: record.entityId,
            entityCode: record.code,
            field,
            timestampIso: nowIso,
          }),
        }).catch(() => {});
      }

      setRecord((prev) =>
        prev
          ? {
              ...prev,
              [field]: nowIso,
            }
          : prev
      );
      setStampFeedback(
        field === 'loadedAt'
          ? `Carico (preparazione) timbrato: ${formatItDateTime(nowIso)}`
          : `Scarico (spedizione) timbrato: ${formatItDateTime(nowIso)}`
      );
    } finally {
      setStampingField(null);
    }
  };

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-center space-y-3">
          <QrCode className="w-10 h-10 text-slate-400 mx-auto" />
          <h1 className="text-base font-bold text-slate-900">
            Codice QR non valido o incompleto
          </h1>
          <p className="text-xs text-slate-500">
            Riscansiona l&apos;etichetta A4 stampata da CaricoStudio oppure cerca il codice manualmente.
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Apri CaricoStudio
            </button>
          )}
        </div>
      </div>
    );
  }

  const typeMeta =
    record.type === 'pallet'
      ? {
          label: 'BANCALE',
          headerBg: 'bg-slate-900',
          icon: Boxes,
        }
      : record.type === 'box'
      ? {
          label: 'SCATOLA',
          headerBg: 'bg-blue-700',
          icon: Box,
        }
      : {
          label: 'OGGETTO / PEZZO',
          headerBg: 'bg-emerald-700',
          icon: Package,
        };

  const TypeIcon = typeMeta.icon;

  const statusText = record.shippedAt
    ? 'SPEDITO (SCARICATO)'
    : record.loadedAt
    ? 'PREPARATO (CARICATO)'
    : 'IN PREPARAZIONE';

  const statusClasses = record.shippedAt
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : record.loadedAt
    ? 'bg-sky-50 text-sky-800 border-sky-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';

  const content = (
    <div className="w-full max-w-xl mx-auto bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Header Tipo & Codice */}
      <div className={`${typeMeta.headerBg} text-white px-5 py-4`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-white/90 shrink-0" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-white/80">
              {typeMeta.label}
            </span>
          </div>
          <span className="font-mono text-xs font-bold bg-white/15 px-2.5 py-0.5 rounded">
            {record.commessaCode}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <div className="font-mono text-2xl font-bold tracking-tight">
            {record.code}
          </div>
          <div className="font-mono text-xs text-white/75">
            *{record.barcodeValue}*
          </div>
        </div>

        <div className="mt-1 text-sm font-semibold text-white/95">
          {record.name}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Stato & Sincronizzazione */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <span
            className={`px-2.5 py-1 rounded-md border text-xs font-bold tracking-wide ${statusClasses}`}
          >
            {statusText}
          </span>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{isLiveSynced ? 'Dati live dal server' : 'Scheda QR'}</span>
            <button
              type="button"
              onClick={() => hydrateLiveRecord(record)}
              disabled={isRefreshingLive}
              className="p-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Aggiorna stato dal server"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshingLive ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* DOVE SI TROVA (Posizione Esatta) */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Dove si trova questo pezzo</span>
          </div>
          <div className="text-base font-bold text-slate-900">
            {record.locationPath}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
            <span>
              Commessa: <strong className="text-slate-900">{record.commessaCode}</strong> ({record.commessaTitle})
            </span>
            {record.palletCode && (
              <span>
                Bancale: <strong className="font-mono text-slate-900">{record.palletCode}</strong>
              </span>
            )}
            {record.boxCode && (
              <span>
                Scatola: <strong className="font-mono text-slate-900">{record.boxCode}</strong>
              </span>
            )}
          </div>
        </div>

        {/* QUANTITÀ & PESO */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Quantità</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
              {record.quantityText}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Scale className="w-3.5 h-3.5 text-slate-400" />
              <span>Peso Totale</span>
            </div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900">
              {record.weightKg.toFixed(2)} kg
            </div>
          </div>
        </div>

        {/* CLIENTE & DESTINAZIONE */}
        <div className="grid grid-cols-2 gap-3 text-xs border-y border-slate-200 py-3">
          <div>
            <div className="text-slate-500">Cliente</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {record.client || '—'}
            </div>
          </div>
          <div>
            <div className="text-slate-500">Destinazione</div>
            <div className="font-semibold text-slate-900 mt-0.5">
              {record.destination || '—'}
            </div>
          </div>
        </div>

        {/* DATE E ORARI CARICO & SCARICO */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <CalendarClock className="w-3.5 h-3.5 text-slate-600" />
            <span>Tracciabilità Oraria Carico e Scarico</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* DATA/ORA CARICO (Preparazione spedizione) */}
            <div className="border border-sky-200 bg-sky-50/60 rounded-lg p-3 flex flex-col justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-800 uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Data / Ora Carico</span>
                </div>
                <div className="text-[11px] text-sky-700/80 mt-0.5">
                  Preparazione bancale per spedizione
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-sm font-bold text-slate-900">
                  {formatItDateTime(record.loadedAt)}
                </div>
              </div>
              <button
                type="button"
                disabled={stampingField !== null}
                onClick={() => handleStampNow('loadedAt')}
                className="w-full py-1.5 px-2.5 rounded-md bg-white hover:bg-sky-100 border border-sky-300 text-sky-900 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
              >
                {stampingField === 'loadedAt'
                  ? 'Registrazione...'
                  : 'Timbra Carico Ora'}
              </button>
            </div>

            {/* DATA/ORA SCARICO (Spedito) */}
            <div className="border border-emerald-200 bg-emerald-50/60 rounded-lg p-3 flex flex-col justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 uppercase">
                  <Truck className="w-3.5 h-3.5" />
                  <span>Data / Ora Scarico</span>
                </div>
                <div className="text-[11px] text-emerald-700/80 mt-0.5">
                  Uscita / Spedizione effettuata
                </div>
                <div className="mt-1.5 font-mono tabular-nums text-sm font-bold text-slate-900">
                  {formatItDateTime(record.shippedAt)}
                </div>
              </div>
              <button
                type="button"
                disabled={stampingField !== null}
                onClick={() => handleStampNow('shippedAt')}
                className="w-full py-1.5 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
              >
                {stampingField === 'shippedAt'
                  ? 'Registrazione...'
                  : 'Timbra Scarico / Spedito Ora'}
              </button>
            </div>
          </div>

          {stampFeedback && (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{stampFeedback}</span>
            </div>
          )}
        </div>

        {/* CONTENUTO (se è stato scansionato un Bancale o una Scatola) */}
        {record.contents && record.contents.length > 0 && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>
                Contenuto all&apos;interno ({record.contents.length})
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Tot. {record.quantityNumber} pz
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
              {record.contents.map((row, idx) => (
                <div
                  key={`${row.code}-${idx}`}
                  className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {row.code}
                      </span>
                      {row.location && (
                        <span className="text-[11px] text-slate-500">
                          · {row.location}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-700 truncate">{row.name}</div>
                  </div>
                  <div className="font-mono font-bold tabular-nums text-slate-900 shrink-0">
                    {row.quantity} pz
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Azione */}
        {onClose && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{isModal ? 'Chiudi Scheda Scansione' : 'Apri CaricoStudio Completo'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-xl my-auto">{content}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 overflow-y-auto">
      {content}
    </div>
  );
};
