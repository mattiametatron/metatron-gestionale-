import React, { useState } from 'react';
import {
  Layers,
  Package,
  Plus,
  CheckSquare,
  Square,
  Trash2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Wand2,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import {
  BOX_SPECS,
  BoxType,
  CargoLoad,
  PALLET_SPECS,
  PalletType,
} from '../types/warehouse';
import { LoadSummary } from '../utils/calculations';
import { PalletGraphic, BoxGraphic } from './WarehouseGraphics';

interface PalletsAndBoxesBuilderProps {
  load: CargoLoad;
  summary: LoadSummary;
  onAddPallet: (data: {
    label: string;
    palletType: PalletType;
    heightCm: number;
    notes: string;
  }) => void;
  onDeletePallet: (palletId: string) => void;
  onTogglePalletWrapped: (palletId: string) => void;
  onAddBox: (data: {
    label: string;
    boxType: BoxType;
    palletId: string | null;
    fragile: boolean;
    stackLevel: 1 | 2 | 3;
  }) => void;
  onDeleteBox: (boxId: string) => void;
  onMoveBoxToPallet: (boxId: string, palletId: string | null) => void;
  onToggleBoxSealed: (boxId: string) => void;
  onToggleItemChecked: (itemId: string) => void;
  onAssignItemLocation: (
    itemId: string,
    palletId: string | null,
    boxId: string | null
  ) => void;
  onQuickAddItemToBox: (
    palletId: string,
    boxId: string,
    name: string,
    quantity: number,
    unitWeightKg: number
  ) => void;
  onAutoDistributeItems: () => void;
}

export const PalletsAndBoxesBuilder: React.FC<PalletsAndBoxesBuilderProps> = ({
  load,
  summary,
  onAddPallet,
  onDeletePallet,
  onTogglePalletWrapped,
  onAddBox,
  onDeleteBox,
  onMoveBoxToPallet,
  onToggleBoxSealed,
  onToggleItemChecked,
  onAssignItemLocation,
  onQuickAddItemToBox,
  onAutoDistributeItems,
}) => {
  const [showNewPalletForm, setShowNewPalletForm] = useState(false);
  const [palletLabel, setPalletLabel] = useState('');
  const [palletType, setPalletType] = useState<PalletType>('EPAL_80x120');
  const [palletHeight, setPalletHeight] = useState(140);
  const [palletNotes, setPalletNotes] = useState('');

  const [showNewBoxForm, setShowNewBoxForm] = useState(false);
  const [boxLabel, setBoxLabel] = useState('');
  const [boxType, setBoxType] = useState<BoxType>('M_60x40x40');
  const [boxPalletId, setBoxPalletId] = useState<string>(
    load.pallets[0]?.id || ''
  );
  const [boxFragile, setBoxFragile] = useState(false);
  const [boxStackLevel, setBoxStackLevel] = useState<1 | 2 | 3>(1);

  const handleCreatePallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!palletLabel.trim()) return;
    onAddPallet({
      label: palletLabel.trim(),
      palletType,
      heightCm: palletHeight,
      notes: palletNotes.trim(),
    });
    setPalletLabel('');
    setPalletNotes('');
    setShowNewPalletForm(false);
  };

  const handleCreateBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxLabel.trim()) return;
    onAddBox({
      label: boxLabel.trim(),
      boxType,
      palletId: boxPalletId || null,
      fragile: boxFragile,
      stackLevel: boxStackLevel,
    });
    setBoxLabel('');
    setBoxFragile(false);
    setShowNewBoxForm(false);
  };

  return (
    <div className="space-y-4 max-w-[1500px] mx-auto text-slate-900 dark:text-slate-100 pb-12">
      {/* Top Action Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            Struttura Gerarchica: Bancali → Scatole → Articoli
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organizza i colli del carico, controlla tara e portata massima e sigilla le scatole.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {summary.unassignedItems.length > 0 && (
            <button
              type="button"
              onClick={onAutoDistributeItems}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/25 transition-all cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Smista Automaticamente ({summary.unassignedItems.length})
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setBoxPalletId(load.pallets[0]?.id || '');
              setShowNewBoxForm((prev) => !prev);
              setShowNewPalletForm(false);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            + Nuova Scatola
          </button>

          <button
            type="button"
            onClick={() => {
              setShowNewPalletForm((prev) => !prev);
              setShowNewBoxForm(false);
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Layers className="w-4 h-4" />
            + Nuovo Bancale
          </button>
        </div>
      </div>

      {/* Form Nuovo Bancale */}
      {showNewPalletForm && (
        <form
          onSubmit={handleCreatePallet}
          className="bg-white dark:bg-slate-900 border border-blue-400 dark:border-blue-500/40 rounded-xl p-5 space-y-4 shadow-md"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Crea Nuovo Bancale di Carico
            </h3>
            <button
              type="button"
              onClick={() => setShowNewPalletForm(false)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              Annulla
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Etichetta / Descrizione Bancale *
              </label>
              <input
                type="text"
                required
                placeholder="es. Componenti Meccanici Linea 1"
                value={palletLabel}
                onChange={(e) => setPalletLabel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Formato Pedana
              </label>
              <select
                value={palletType}
                onChange={(e) => setPalletType(e.target.value as PalletType)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
              >
                {Object.entries(PALLET_SPECS).map(([key, spec]) => (
                  <option key={key} value={key}>
                    {spec.name} (Tara {spec.tareKg}kg)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Altezza Prevista (cm)
              </label>
              <input
                type="number"
                min={40}
                max={260}
                value={palletHeight}
                onChange={(e) => setPalletHeight(Number(e.target.value))}
                className="w-full px-3 py-2 font-mono bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Note di Stivaggio / Istruzioni
              </label>
              <input
                type="text"
                placeholder="es. Reggiatura rinforzata, non sovrapporre colli..."
                value={palletNotes}
                onChange={(e) => setPalletNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-xs"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Crea Bancale
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Form Nuova Scatola */}
      {showNewBoxForm && (
        <form
          onSubmit={handleCreateBox}
          className="bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-500/40 rounded-xl p-5 space-y-4 shadow-md"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Crea Nuova Scatola / Collo
            </h3>
            <button
              type="button"
              onClick={() => setShowNewBoxForm(false)}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              Annulla
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Etichetta Scatola *
              </label>
              <input
                type="text"
                required
                placeholder="es. Scatola Cuscinetti & Supporti"
                value={boxLabel}
                onChange={(e) => setBoxLabel(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500 text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bancale di Destinazione
              </label>
              <select
                value={boxPalletId}
                onChange={(e) => setBoxPalletId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
              >
                {load.pallets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Formato Imballo
              </label>
              <select
                value={boxType}
                onChange={(e) => setBoxType(e.target.value as BoxType)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
              >
                {Object.entries(BOX_SPECS).map(([key, spec]) => (
                  <option key={key} value={key}>
                    {spec.name} ({spec.dimensionsCm})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Strato / Piano sul Bancale
              </label>
              <select
                value={boxStackLevel}
                onChange={(e) => setBoxStackLevel(Number(e.target.value) as 1 | 2 | 3)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 text-xs"
              >
                <option value={1}>Piano 1 — Base (Pesante)</option>
                <option value={2}>Piano 2 — Intermedio</option>
                <option value={3}>Piano 3 — Sommità</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={boxFragile}
                onChange={(e) => setBoxFragile(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
              />
              <span>Merce Fragile</span>
            </label>

            <button
              type="submit"
              className="py-2 px-5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Crea Scatola
            </button>
          </div>
        </form>
      )}

      {/* Elenco Bancali Strutturati */}
      <div className="space-y-4">
        {summary.palletSummaries.length > 0 ? (
          summary.palletSummaries.map((ps) => (
            <div
              key={ps.pallet.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm"
            >
              {/* Header Bancale */}
              <div className="px-5 py-4 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <PalletGraphic
                    wrapped={ps.pallet.wrapped}
                    boxCount={ps.totalBoxes}
                    heightCm={ps.pallet.heightCm}
                    className="w-14 h-12 shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-300 dark:border-indigo-500/20 text-xs">
                        {ps.pallet.code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {ps.pallet.label || 'Bancale di Spedizione'}
                      </h3>
                    </div>
                    <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-1">
                      {ps.pallet.dimensionsCm} · H {ps.pallet.heightCm} cm · Tara {ps.pallet.tareKg} kg
                      {ps.pallet.notes ? ` · Note: ${ps.pallet.notes}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right font-mono text-xs">
                    <div className="text-slate-500 dark:text-slate-400">
                      Scatole: <strong className="text-slate-900 dark:text-slate-200">{ps.totalBoxes}</strong> · Check:{' '}
                      <strong className="text-slate-900 dark:text-slate-200">{ps.checkedItemsCount}/{ps.totalItemsCount} ({ps.completionPercent}%)</strong>
                    </div>
                    <div className="text-slate-800 dark:text-slate-200 font-bold mt-0.5">
                      Lordo Bancale: {ps.grossWeightKg.toFixed(1)} / {ps.pallet.maxWeightKg} kg
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onTogglePalletWrapped(ps.pallet.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      ps.pallet.wrapped
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ps.pallet.wrapped ? 'Bancale Filmato' : 'Segna Filmato'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeletePallet(ps.pallet.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scatole nel Bancale */}
              <div className="p-4 space-y-3">
                {ps.boxes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ps.boxes.map((bs) => (
                      <div
                        key={bs.box.id}
                        className="border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl p-3.5 space-y-2 text-xs shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
                          <div className="flex items-start gap-2.5">
                            <BoxGraphic
                              sealed={bs.box.sealed}
                              fragile={bs.box.fragile}
                              className="w-10 h-9 shrink-0 mt-0.5"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/20 text-xs">
                                  {bs.box.code}
                                </span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">{bs.box.label}</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                                {bs.box.dimensionsCm} · Piano {bs.box.stackLevel} · Lordo:{' '}
                                <strong className="text-slate-900 dark:text-slate-200">{bs.grossWeightKg.toFixed(1)} kg</strong>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleBoxSealed(bs.box.id)}
                              className={`px-2 py-1 rounded-md border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                bs.box.sealed
                                  ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                              }`}
                            >
                              {bs.box.sealed ? <Lock className="w-3 h-3 text-emerald-600" /> : <Unlock className="w-3 h-3" />}
                              <span>{bs.box.sealed ? 'Sigillata' : 'Aperta'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDeleteBox(bs.box.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Articoli della scatola */}
                        <div className="space-y-1">
                          {bs.items.map((i) => (
                            <div key={i.id} className="flex justify-between items-center font-mono text-[11px] text-slate-700 dark:text-slate-300">
                              <span className="truncate pr-2">
                                {i.checked ? '✓' : '○'} {i.name}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400 font-bold shrink-0">{i.quantity} pz</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                    Nessuna scatola posizionata su questo bancale.
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
            Nessun bancale presente nel carico. Crea un bancale per iniziare.
          </div>
        )}
      </div>
    </div>
  );
};
