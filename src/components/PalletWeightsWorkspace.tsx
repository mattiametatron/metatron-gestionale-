import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Scale,
  Printer,
  Plus,
  Layers,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  Sparkles,
  Pencil,
  Check,
  FileText,
  Package,
  Info,
  Trash2,
} from 'lucide-react';
import { CargoLoad, CargoPallet, PALLET_SPECS, PalletType } from '../types/warehouse';
import { LoadSummary, PalletSummary } from '../utils/calculations';
import { PalletSheetPrintModal } from './PalletSheetPrintModal';

interface PalletWeightsWorkspaceProps {
  load: CargoLoad;
  summary: LoadSummary;
  onUpdatePallet: (palletId: string, updates: Partial<CargoPallet>) => void;
  onAddPallet: (data: {
    label: string;
    palletType: PalletType;
    dimensionsCm?: string;
    heightCm?: number;
    tareKg?: number;
    notes?: string;
  }) => void;
  onDeletePallet: (palletId: string) => void;
}

interface PalletWeightCardProps {
  ps: PalletSummary;
  index: number;
  onUpdatePallet: (palletId: string, updates: Partial<CargoPallet>) => void;
  onDeletePallet: (palletId: string) => void;
  onPrintPallet: (palletId: string) => void;
}

const PalletWeightCard: React.FC<PalletWeightCardProps> = ({
  ps,
  index,
  onUpdatePallet,
  onDeletePallet,
  onPrintPallet,
}) => {
  const pallet = ps.pallet;
  const hasCustom = ps.hasCustomWeight;
  const isOverloaded = ps.isOverweight;

  // Local string states to allow full clearing/backspacing without auto-snapping
  const [weightStr, setWeightStr] = useState<string>(() =>
    pallet.customWeightKg !== undefined && pallet.customWeightKg !== null
      ? String(pallet.customWeightKg)
      : ''
  );
  const [tareStr, setTareStr] = useState<string>(() => String(pallet.tareKg ?? 0));
  const [heightStr, setHeightStr] = useState<string>(() => String(pallet.heightCm ?? 160));
  const [slotStr, setSlotStr] = useState<string>(() =>
    String(pallet.truckSlot ?? index + 1)
  );

  const isWeightFocused = useRef(false);
  const isTareFocused = useRef(false);
  const isHeightFocused = useRef(false);
  const isSlotFocused = useRef(false);

  // Sync external changes when input is not actively focused by user
  useEffect(() => {
    if (!isWeightFocused.current) {
      setWeightStr(
        pallet.customWeightKg !== undefined && pallet.customWeightKg !== null
          ? String(pallet.customWeightKg)
          : ''
      );
    }
  }, [pallet.customWeightKg]);

  useEffect(() => {
    if (!isTareFocused.current) {
      setTareStr(String(pallet.tareKg ?? 0));
    }
  }, [pallet.tareKg]);

  useEffect(() => {
    if (!isHeightFocused.current) {
      setHeightStr(String(pallet.heightCm ?? 160));
    }
  }, [pallet.heightCm]);

  useEffect(() => {
    if (!isSlotFocused.current) {
      setSlotStr(String(pallet.truckSlot ?? index + 1));
    }
  }, [pallet.truckSlot, index]);

  const handleWeightChange = (rawVal: string) => {
    // Normalize comma to dot for European keyboard layouts
    const val = rawVal.replace(',', '.');
    setWeightStr(val);

    if (val.trim() === '') {
      // User cleared the input: set custom weight to null so calculated is used
      onUpdatePallet(pallet.id, { customWeightKg: null });
      return;
    }

    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) {
      onUpdatePallet(pallet.id, { customWeightKg: num });
    }
  };

  const handleWeightBlur = () => {
    isWeightFocused.current = false;
    if (weightStr.trim() === '') {
      onUpdatePallet(pallet.id, { customWeightKg: null });
      return;
    }
    const num = parseFloat(weightStr.replace(',', '.'));
    if (isNaN(num) || num <= 0) {
      setWeightStr('');
      onUpdatePallet(pallet.id, { customWeightKg: null });
    } else {
      setWeightStr(String(num));
      onUpdatePallet(pallet.id, { customWeightKg: num });
    }
  };

  const handleResetWeight = () => {
    setWeightStr('');
    onUpdatePallet(pallet.id, { customWeightKg: null });
  };

  const handleTareChange = (rawVal: string) => {
    const val = rawVal.replace(',', '.');
    setTareStr(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      onUpdatePallet(pallet.id, { tareKg: num });
    }
  };

  const handleTareBlur = () => {
    isTareFocused.current = false;
    const num = parseFloat(tareStr.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      setTareStr(String(pallet.tareKg ?? 0));
    } else {
      setTareStr(String(num));
    }
  };

  const handleHeightChange = (val: string) => {
    setHeightStr(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 20 && num <= 300) {
      onUpdatePallet(pallet.id, { heightCm: num });
    }
  };

  const handleHeightBlur = () => {
    isHeightFocused.current = false;
    const num = parseFloat(heightStr);
    if (isNaN(num) || num < 20) {
      const fallback = pallet.heightCm ?? 160;
      setHeightStr(String(fallback));
      onUpdatePallet(pallet.id, { heightCm: fallback });
    }
  };

  const handleSlotChange = (val: string) => {
    setSlotStr(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 1 && num <= 50) {
      onUpdatePallet(pallet.id, { truckSlot: num });
    }
  };

  const handleSlotBlur = () => {
    isSlotFocused.current = false;
    const num = parseInt(slotStr, 10);
    if (isNaN(num) || num < 1) {
      const fallback = pallet.truckSlot ?? index + 1;
      setSlotStr(String(fallback));
      onUpdatePallet(pallet.id, { truckSlot: fallback });
    }
  };

  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between transition-all">
      {/* Card Top Header */}
      <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-blue-600 font-mono font-black text-sm flex items-center justify-center text-white shrink-0">
            {index + 1}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-black tracking-tight text-white">
                {pallet.code}
              </span>
              <span className="text-xs font-semibold text-slate-300">
                • {pallet.dimensionsCm}
              </span>
            </div>
            <span className="text-xs text-slate-300 block truncate">
              {pallet.label || 'Bancale Standard'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Checkbox Bancale Filmato */}
          <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
            <input
              type="checkbox"
              checked={pallet.wrapped}
              onChange={(e) =>
                onUpdatePallet(pallet.id, { wrapped: e.target.checked })
              }
              className="rounded text-blue-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-[11px] font-semibold">Filmato</span>
          </label>

          {/* Pulsante Stampa Foglio Singolo */}
          <button
            type="button"
            onClick={() => onPrintPallet(pallet.id)}
            className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            title="Stampa il foglio A4 per questo singolo bancale con il peso scritto in grande"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Stampa Foglio</span>
          </button>

          {/* Pulsante Elimina Bancale */}
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Sei sicuro di voler eliminare il bancale ${pallet.code}? Gli articoli e scatole associati verranno liberati.`
                )
              ) {
                onDeletePallet(pallet.id);
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Elimina questo bancale"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 space-y-4">
        {/* 🌟 SEZIONE PESO: INPUT DIRETTO IN GRANDE & BADGE STATO 🌟 */}
        <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 rounded-xl border-2 border-slate-300 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={`pallet-weight-${pallet.id}`}
              className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5"
            >
              <Scale className="w-4 h-4 text-blue-600" />
              <span>Scrivi Peso Bancale (kg):</span>
            </label>

            {hasCustom ? (
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Pesato a Bilancia
                </span>
                <button
                  type="button"
                  onClick={handleResetWeight}
                  className="text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                  title="Ripristina al peso calcolato in automatico dai colli"
                >
                  Ripristina calcolato ({ps.calculatedGrossWeightKg.toFixed(1)} kg)
                </button>
              </div>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-700">
                Calcolato da colli ({ps.calculatedGrossWeightKg.toFixed(1)} kg)
              </span>
            )}
          </div>

          {/* INPUT PESO IN GRANDE */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id={`pallet-weight-${pallet.id}`}
                type="text"
                inputMode="decimal"
                value={weightStr}
                onFocus={() => {
                  isWeightFocused.current = true;
                }}
                onBlur={handleWeightBlur}
                onChange={(e) => handleWeightChange(e.target.value)}
                placeholder={ps.calculatedGrossWeightKg.toFixed(1)}
                className="w-full pl-4 pr-14 py-2.5 text-2xl font-black font-mono text-slate-950 bg-white border-2 border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 rounded-xl transition-all shadow-inner"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono font-extrabold text-sm text-slate-500 pointer-events-none">
                KG
              </span>
            </div>

            <button
              type="button"
              onClick={() => onPrintPallet(pallet.id)}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              title="Stampa foglio A4 con questo peso in grande"
            >
              <Printer className="w-4 h-4 text-blue-400" />
              <span>Stampa A4</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 pt-1">
            <span>
              Tara Bancale Vuoto:{' '}
              <strong className="font-mono text-slate-900">
                {pallet.tareKg} kg
              </strong>
            </span>
            <span>
              Merce Netta Colli:{' '}
              <strong className="font-mono text-slate-900">
                {ps.netWeightKg.toFixed(1)} kg
              </strong>
            </span>
            <span>
              Portata Max:{' '}
              <strong className="font-mono text-slate-900">
                {pallet.maxWeightKg} kg
              </strong>
            </span>
          </div>

          {isOverloaded && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-bold">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                Attenzione: il peso ({ps.grossWeightKg.toFixed(1)} kg) supera la
                portata massima di {pallet.maxWeightKg} kg!
              </span>
            </div>
          )}
        </div>

        {/* Parametri Modificabili Rapidi: Tara, Altezza, Piazzola Mezzo */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Tara Legno (kg)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={tareStr}
              onFocus={() => {
                isTareFocused.current = true;
              }}
              onBlur={handleTareBlur}
              onChange={(e) => handleTareChange(e.target.value)}
              className="w-full px-2 py-1 font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Altezza (cm)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={heightStr}
              onFocus={() => {
                isHeightFocused.current = true;
              }}
              onBlur={handleHeightBlur}
              onChange={(e) => handleHeightChange(e.target.value)}
              className="w-full px-2 py-1 font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Piazzola Mezzo (#)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={slotStr}
              onFocus={() => {
                isSlotFocused.current = true;
              }}
              onBlur={handleSlotBlur}
              onChange={(e) => handleSlotChange(e.target.value)}
              className="w-full px-2 py-1 font-mono font-bold bg-white border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Sintesi Contenuto Scatole */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                Contenuto: {ps.totalBoxes} Scatole ({ps.totalItemsCount} Articoli)
              </span>
            </span>
            <span className="font-mono text-[11px] text-blue-700">
              Spunta: {ps.completionPercent}%
            </span>
          </div>

          {ps.totalBoxes > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {ps.boxes.map((bs) => (
                <span
                  key={bs.box.id}
                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-mono font-semibold"
                >
                  {bs.box.code}: {bs.totalPieces} pz ({bs.grossWeightKg.toFixed(1)} kg)
                </span>
              ))}
            </div>
          ) : ps.looseItems.length > 0 ? (
            <span className="text-[11px] text-amber-800 font-semibold">
              {ps.looseItems.length} colli fuori scatola assegnati direttamente al bancale
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 italic">
              Nessuna scatola o articolo ancora assegnato a questo bancale
            </span>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">
          Stampa foglio A4 con il peso gigante per applicazione sul film del bancale.
        </span>
        <button
          type="button"
          onClick={() => onPrintPallet(pallet.id)}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Stampa Foglio Bancale</span>
        </button>
      </div>
    </div>
  );
};

export const PalletWeightsWorkspace: React.FC<PalletWeightsWorkspaceProps> = ({
  load,
  summary,
  onUpdatePallet,
  onAddPallet,
  onDeletePallet,
}) => {
  const [printingPalletId, setPrintingPalletId] = useState<string | null>(null);
  const [showAllPrintModal, setShowAllPrintModal] = useState(false);
  const [showAddPalletModal, setShowAddPalletModal] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'wrapped' | 'to_wrap' | 'custom'>('all');

  // Form State for New Pallet
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<PalletType>('EPAL_80x120');
  const [newHeight, setNewHeight] = useState<number | string>(160);

  const handleCreatePallet = (e: React.FormEvent) => {
    e.preventDefault();
    const spec = PALLET_SPECS[newType];
    onAddPallet({
      label: newLabel.trim() || spec.name,
      palletType: newType,
      dimensionsCm: spec.dimensionsCm,
      heightCm: Math.max(30, Math.min(280, Number(newHeight) || 160)),
      tareKg: spec.tareKg,
    });
    setNewLabel('');
    setNewHeight(160);
    setShowAddPalletModal(false);
  };

  const handleResetAllToCalculated = () => {
    load.pallets.forEach((p) => {
      if (p.customWeightKg !== undefined && p.customWeightKg !== null) {
        onUpdatePallet(p.id, { customWeightKg: null });
      }
    });
  };

  const handleToggleAllWrapped = (wrapped: boolean) => {
    load.pallets.forEach((p) => {
      onUpdatePallet(p.id, { wrapped });
    });
  };

  const filteredPalletSummaries = useMemo(() => {
    return summary.palletSummaries.filter((ps) => {
      if (statusFilter === 'wrapped' && !ps.pallet.wrapped) return false;
      if (statusFilter === 'to_wrap' && ps.pallet.wrapped) return false;
      if (statusFilter === 'custom' && !ps.hasCustomWeight) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = ps.pallet.code.toLowerCase().includes(q);
        const matchesLabel = ps.pallet.label.toLowerCase().includes(q);
        const matchesBox = ps.boxes.some(b => b.box.code.toLowerCase().includes(q) || b.box.label.toLowerCase().includes(q));
        return matchesCode || matchesLabel || matchesBox;
      }
      return true;
    });
  }, [summary.palletSummaries, statusFilter, searchQuery]);

  const customWeightsCount = load.pallets.filter(p => p.customWeightKg !== undefined && p.customWeightKg !== null).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden text-slate-900">
      {/* Top Header Section */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Pesi Bancali &amp; Stampa Fogli Collo A4
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                {load.pallets.length} Bancali in Spedizione
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Imposta il peso reale di ciascun bancale e stampa i singoli fogli con peso cubitale in formato A4
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {summary.wrappedPallets < summary.totalPallets ? (
            <button
              type="button"
              onClick={() => handleToggleAllWrapped(true)}
              className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Segna tutti i bancali della commessa come filmati"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Segna Tutti Filmati</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleToggleAllWrapped(false)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Deseleziona Filmati</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetAllToCalculated}
            title="Azzera i pesi manuali e ricalcola tutti i bancali in base ai colli"
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Pesi Calcolati</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddPalletModal(true)}
            className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Bancale</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAllPrintModal(true)}
            className="px-4 py-1.5 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-slate-900/20"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>Stampa Tutti i Fogli A4</span>
          </button>
        </div>
      </div>

      {/* Quick Summary & Filter Toolbar */}
      <div className="px-6 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-3">
        {/* Search & Tabs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="text"
            placeholder="Cerca bancale o codice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600 w-44"
          />

          <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tutti ({load.pallets.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('to_wrap')}
              className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                statusFilter === 'to_wrap'
                  ? 'bg-white text-amber-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Da Filmare ({summary.totalPallets - summary.wrappedPallets})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('wrapped')}
              className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                statusFilter === 'wrapped'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Filmati ({summary.wrappedPallets})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('custom')}
              className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                statusFilter === 'custom'
                  ? 'bg-white text-blue-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pesati ({customWeightsCount})
            </button>
          </div>
        </div>

        {/* Load Stats Pill */}
        <div className="flex items-center gap-3 font-semibold text-slate-600 text-xs">
          <span>
            Lordo Totale:{' '}
            <strong className="font-mono text-slate-950 text-sm">
              {summary.totalGrossWeightKg.toFixed(1)} kg
            </strong>
          </span>
          <span className="text-slate-300">|</span>
          <span>
            Portata Mezzo:{' '}
            <strong className="font-mono text-slate-900">
              {Math.min(
                100,
                Math.round(
                  (summary.totalGrossWeightKg / Math.max(1, load.vehicleMaxWeightKg)) *
                    100
                )
              )}%
            </strong>{' '}
            ({summary.totalGrossWeightKg.toFixed(0)}/{load.vehicleMaxWeightKg} kg)
          </span>
        </div>
      </div>

      {/* Main Content Area - Grid of Pallet Cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {load.pallets.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-3">
            <Layers className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">
              Nessun bancale presente in questa commessa
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Aggiungi il tuo primo bancale per gestire i pesi effettivi e stampare i fogli collo A4.
            </p>
            <button
              type="button"
              onClick={() => setShowAddPalletModal(true)}
              className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Primo Bancale
            </button>
          </div>
        ) : filteredPalletSummaries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
            <p className="text-sm font-bold text-slate-700">Nessun bancale trovato per i filtri selezionati</p>
            <p className="text-xs text-slate-500">Prova a modificare il testo di ricerca o la scheda di filtro attivo.</p>
            <button
              type="button"
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              Azzera filtri
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredPalletSummaries.map((ps, index) => (
              <PalletWeightCard
                key={ps.pallet.id}
                ps={ps}
                index={index}
                onUpdatePallet={onUpdatePallet}
                onDeletePallet={onDeletePallet}
                onPrintPallet={(id) => setPrintingPalletId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal Aggiungi Nuovo Bancale */}
      {showAddPalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">
                Aggiungi Nuovo Bancale
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPalletModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePallet} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tipologia Bancale
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as PalletType)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold"
                >
                  {Object.entries(PALLET_SPECS).map(([k, s]) => (
                    <option key={k} value={k}>
                      {s.name} ({s.dimensionsCm}) • Tara {s.tareKg} kg
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome / Etichetta (opzionale)
                </label>
                <input
                  type="text"
                  placeholder="Es. Bancale Materiale Elettrico"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Altezza Stimata (cm)
                </label>
                <input
                  type="number"
                  min="30"
                  max="280"
                  value={newHeight}
                  onChange={(e) => setNewHeight(e.target.value)}
                  className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddPalletModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer"
                >
                  Crea Bancale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Stampa Singolo Bancale (o Tutti) */}
      {(printingPalletId !== null || showAllPrintModal) && (
        <PalletSheetPrintModal
          load={load}
          palletSummaries={summary.palletSummaries}
          initialPalletId={printingPalletId || 'all'}
          onClose={() => {
            setPrintingPalletId(null);
            setShowAllPrintModal(false);
          }}
        />
      )}
    </div>
  );
};
