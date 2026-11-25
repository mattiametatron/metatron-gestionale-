import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  Package,
  Layers,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  Wand2,
  Trash2,
  Search,
  FileSpreadsheet,
  AlertCircle,
  Truck,
  ArrowRight,
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

interface SplitOverviewWorkspaceProps {
  load: CargoLoad;
  summary: LoadSummary;
  onToggleItemChecked: (itemId: string) => void;
  onAssignItemLocation: (
    itemId: string,
    palletId: string | null,
    boxId: string | null
  ) => void;
  onQuickCreateChecklistItem: (
    name: string,
    quantity: number,
    unitWeightKg: number,
    boxId: string | null,
    palletId: string | null
  ) => void;
  onBulkAddLines: (text: string) => void;
  onAddBox: (data: {
    label: string;
    boxType: BoxType;
    palletId: string | null;
    fragile: boolean;
    stackLevel: 1 | 2 | 3;
  }) => void;
  onDeleteBox: (boxId: string) => void;
  onToggleBoxSealed: (boxId: string) => void;
  onAddPallet: (data: {
    label: string;
    palletType: PalletType;
    heightCm: number;
    notes: string;
  }) => void;
  onDeletePallet: (palletId: string) => void;
  onTogglePalletWrapped: (palletId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onAutoDistributeItems: () => void;
  onOpenSignModal: () => void;
}

export const SplitOverviewWorkspace: React.FC<SplitOverviewWorkspaceProps> = ({
  load,
  summary,
  onToggleItemChecked,
  onAssignItemLocation,
  onQuickCreateChecklistItem,
  onBulkAddLines,
  onAddBox,
  onDeleteBox,
  onToggleBoxSealed,
  onAddPallet,
  onDeletePallet,
  onTogglePalletWrapped,
  onDeleteItem,
  onAutoDistributeItems,
  onOpenSignModal,
}) => {
  // Search & Filters
  const [itemSearch, setItemSearch] = useState('');
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState('');

  // Quick Item Form
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemWeight, setItemWeight] = useState(1.0);
  const [itemTargetBoxId, setItemTargetBoxId] = useState<string>('');

  // Quick Box Form
  const [boxLabel, setBoxLabel] = useState('');
  const [boxType, setBoxType] = useState<BoxType>('M_60x40x40');
  const [boxPalletId, setBoxPalletId] = useState<string>(
    load.pallets[0]?.id || ''
  );

  // Quick Pallet Form
  const [palletLabel, setPalletLabel] = useState('');
  const [palletType, setPalletType] = useState<PalletType>('EPAL_80x120');

  // Filter selected pallet
  const [selectedPalletId, setSelectedPalletId] = useState<string | 'all'>('all');

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return load.items;
    const q = itemSearch.toLowerCase();
    return load.items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.sku.toLowerCase().includes(q) ||
        (i.category && i.category.toLowerCase().includes(q))
    );
  }, [load.items, itemSearch]);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;
    const foundBox = load.boxes.find((b) => b.id === itemTargetBoxId);
    onQuickCreateChecklistItem(
      itemName.trim(),
      Math.max(1, itemQty),
      Math.max(0.05, itemWeight),
      foundBox ? foundBox.id : null,
      foundBox ? foundBox.palletId : null
    );
    setItemName('');
    setItemQty(1);
  };

  const handleAddBox = (e: React.FormEvent) => {
    e.preventDefault();
    if (!boxLabel.trim()) return;
    onAddBox({
      label: boxLabel.trim(),
      boxType,
      palletId: boxPalletId || load.pallets[0]?.id || null,
      fragile: false,
      stackLevel: 1,
    });
    setBoxLabel('');
  };

  const handleAddPallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!palletLabel.trim()) return;
    onAddPallet({
      label: palletLabel.trim(),
      palletType,
      heightCm: 140,
      notes: '',
    });
    setPalletLabel('');
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    onBulkAddLines(bulkText);
    setBulkText('');
    setShowBulkPasteModal(false);
  };

  const visibleBoxes =
    selectedPalletId === 'all'
      ? summary.palletSummaries.flatMap((ps) => ps.boxes)
      : summary.palletSummaries
          .filter((ps) => ps.pallet.id === selectedPalletId)
          .flatMap((ps) => ps.boxes);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 h-[calc(100vh-128px)] min-h-[580px] w-full">
      {/* =========================================================================
          COLONNA 1: CHECK-LIST ARTICOLI (5 COLS)
      ========================================================================= */}
      <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-sm transition-colors">
        {/* Header di Colonna */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Check-list Merce
                </h2>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold tabular-nums">
                  {summary.checkedItems}/{summary.totalItems}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {summary.checkedPieces}/{summary.totalPieces} pz · {summary.netMerchandiseWeightKg.toFixed(1)} kg netti
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowBulkPasteModal(true)}
              className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              title="Incolla elenco da Excel o blocco note"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Incolla CSV</span>
            </button>

            {summary.unassignedItems.length > 0 && (
              <button
                type="button"
                onClick={onAutoDistributeItems}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 rounded-md hover:bg-amber-100 dark:hover:bg-amber-500/25 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                title="Smista automaticamente gli articoli senza scatola"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Smista ({summary.unassignedItems.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Input Rapido Articolo */}
        <form
          onSubmit={handleAddItem}
          className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 shrink-0 flex items-center gap-1.5 text-xs"
        >
          <input
            type="text"
            required
            placeholder="Nome articolo / Descrizione..."
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 text-xs transition-colors"
          />
          <input
            type="number"
            min={1}
            value={itemQty}
            onChange={(e) => setItemQty(Number(e.target.value))}
            title="Quantità (pezzi)"
            placeholder="Q.tà"
            className="w-14 px-1.5 py-1.5 font-mono text-center bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500"
          />
          <input
            type="number"
            min={0.05}
            step={0.1}
            value={itemWeight}
            onChange={(e) => setItemWeight(Number(e.target.value))}
            title="Peso unitario per pezzo in kg"
            placeholder="kg/pz"
            className="w-16 px-1.5 py-1.5 font-mono text-center bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-blue-500"
          />
          <select
            value={itemTargetBoxId}
            onChange={(e) => setItemTargetBoxId(e.target.value)}
            aria-label="Destinazione scatola per nuovo articolo"
            className="w-28 px-1.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-mono truncate focus:outline-none focus:border-blue-500"
          >
            <option value="">Da smistare</option>
            {load.boxes.map((b) => {
              const pal = load.pallets.find((p) => p.id === b.palletId);
              return (
                <option key={b.id} value={b.id}>
                  {b.code} {pal ? `(${pal.code})` : ''}
                </option>
              );
            })}
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Articolo
          </button>
        </form>

        {/* Filtro ricerca rapido */}
        {load.items.length > 5 && (
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 shrink-0 flex items-center gap-2 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca per codice o nome..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400"
            />
            {itemSearch && (
              <button
                type="button"
                onClick={() => setItemSearch('')}
                className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Pulisci
              </button>
            )}
          </div>
        )}

        {/* Lista Scrollabile Articoli */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const box = load.boxes.find((b) => b.id === item.boxId);
              const pal = load.pallets.find((p) => p.id === item.palletId);

              return (
                <div
                  key={item.id}
                  className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-between gap-2.5 text-xs ${
                    item.checked
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {/* Spunta e Nome */}
                  <button
                    type="button"
                    onClick={() => onToggleItemChecked(item.id)}
                    className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer"
                  >
                    {item.checked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shrink-0 transition-colors" />
                    )}
                    <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                      {item.sku}
                    </span>
                    <span
                      className={`truncate font-medium text-xs ${
                        item.checked
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {item.name}
                    </span>
                  </button>

                  {/* Quantità, Peso e Destinazione */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 tabular-nums">
                      <strong className="text-slate-900 dark:text-slate-100 font-bold">{item.quantity}</strong> pz ·{' '}
                      {(item.quantity * item.unitWeightKg).toFixed(1)} kg
                    </span>

                    <select
                      aria-label={`Assegna ${item.name}`}
                      value={item.boxId || ''}
                      onChange={(e) => {
                        const bId = e.target.value;
                        if (!bId) {
                          onAssignItemLocation(item.id, null, null);
                        } else {
                          const targetBox = load.boxes.find((b) => b.id === bId);
                          onAssignItemLocation(
                            item.id,
                            targetBox?.palletId ?? null,
                            bId
                          );
                        }
                      }}
                      className={`w-28 px-2 py-1 rounded-md border text-[11px] font-mono transition-colors ${
                        box
                          ? 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-300'
                          : 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                      }`}
                    >
                      <option value="">
                        {pal && !box ? `${pal.code} (Libero)` : '⚠ Smista'}
                      </option>
                      {load.boxes.map((b) => {
                        const p = load.pallets.find((pl) => pl.id === b.palletId);
                        return (
                          <option key={b.id} value={b.id}>
                            {p ? `${p.code} > ` : ''}
                            {b.code}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      title="Elimina riga"
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500">
              <CheckSquare className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2.5" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nessun articolo in lista</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[240px]">
                Usa la barra sopra per inserire un articolo o clicca su &quot;Incolla CSV&quot; per importare più righe da Excel.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          COLONNA 2: SCATOLE E COLLI (4 COLS)
      ========================================================================= */}
      <section className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-sm transition-colors">
        {/* Header Scatole */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Scatole & Colli
                </h2>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold tabular-nums">
                  {summary.sealedBoxes}/{summary.totalBoxes} chiuse
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Imballo intermedio per spedizione
              </span>
            </div>
          </div>

          {selectedPalletId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedPalletId('all')}
              className="text-[11px] text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
            >
              Mostra tutte
            </button>
          )}
        </div>

        {/* Form Creazione Scatola Rapida */}
        <form
          onSubmit={handleAddBox}
          className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 shrink-0 flex items-center gap-1.5 text-xs"
        >
          <input
            type="text"
            required
            placeholder="Nome scatola (es. Bulloneria)..."
            value={boxLabel}
            onChange={(e) => setBoxLabel(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 text-xs transition-colors"
          />
          <select
            value={boxType}
            onChange={(e) => setBoxType(e.target.value as BoxType)}
            className="w-24 px-1.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-mono truncate focus:outline-none focus:border-amber-500"
          >
            {Object.entries(BOX_SPECS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={boxPalletId}
            onChange={(e) => setBoxPalletId(e.target.value)}
            className="w-24 px-1.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-mono truncate focus:outline-none focus:border-amber-500"
          >
            <option value="">A terra</option>
            {load.pallets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 text-xs flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Scatola
          </button>
        </form>

        {/* Lista Scatole Scrollabile */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
          {visibleBoxes.length > 0 ? (
            visibleBoxes.map((bs) => {
              const pal = load.pallets.find((p) => p.id === bs.box.palletId);
              const maxWeight = bs.box.maxWeightKg || 30;
              const weightRatio = Math.min(100, Math.round((bs.grossWeightKg / maxWeight) * 100));

              return (
                <div
                  key={bs.box.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs space-y-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <BoxGraphic
                        sealed={bs.box.sealed}
                        fragile={bs.box.fragile}
                        className="w-10 h-9 shrink-0 mt-0.5"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs bg-amber-100 dark:bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-500/20">
                            {bs.box.code}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {bs.box.label}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>{pal ? `Stivata: ${pal.code}` : 'A terra'}</span>
                          <span>·</span>
                          <span>{bs.box.dimensionsCm}</span>
                          <span>·</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {bs.grossWeightKg.toFixed(1)} kg
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleBoxSealed(bs.box.id)}
                        className={`px-2 py-1 rounded-md border text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                          bs.box.sealed
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                        title={bs.box.sealed ? 'Scatola sigillata (clicca per riaprire)' : 'Scatola aperta (clicca per sigillare)'}
                      >
                        {bs.box.sealed ? (
                          <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Unlock className="w-3 h-3" />
                        )}
                        <span>{bs.box.sealed ? 'Sigillata' : 'Aperta'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteBox(bs.box.id)}
                        title="Elimina scatola"
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Indicatore Portata / Peso */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span>Capacità peso ({weightRatio}%)</span>
                      <span>Max {maxWeight} kg</span>
                    </div>
                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${weightRatio}%` }}
                        className={`h-full transition-all duration-300 ${
                          weightRatio > 90 ? 'bg-rose-500' : weightRatio > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Articoli contenuti nella scatola */}
                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900/90 p-2 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                    {bs.items.length > 0 ? (
                      bs.items.map((i) => (
                        <div key={i.id} className="flex justify-between items-center">
                          <span className="truncate pr-2 text-slate-800 dark:text-slate-300">
                            {i.checked ? '✓' : '○'} {i.name}
                          </span>
                          <span className="shrink-0 text-slate-600 dark:text-slate-400 font-bold">
                            {i.quantity} pz
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400 italic block text-center py-0.5">
                        Scatola vuota · Assegna articoli dalla colonna di sinistra
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500">
              <Package className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2.5" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nessuna scatola creata</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[240px]">
                Aggiungi una scatola con il modulo in alto per iniziare a imballare la merce.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          COLONNA 3: BANCALI DEL CARICO (3 COLS)
      ========================================================================= */}
      <section className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-sm transition-colors">
        {/* Header Bancali */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Bancali Carico
                </h2>
                <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold tabular-nums">
                  {summary.wrappedPallets}/{summary.totalPallets} pronti
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Lordo: <strong className="text-slate-900 dark:text-slate-100">{summary.totalGrossWeightKg.toFixed(0)} kg</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Form Creazione Bancale Rapida */}
        <form
          onSubmit={handleAddPallet}
          className="p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 shrink-0 flex items-center gap-1.5 text-xs"
        >
          <input
            type="text"
            required
            placeholder="Nome bancale..."
            value={palletLabel}
            onChange={(e) => setPalletLabel(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 text-xs transition-colors"
          />
          <select
            value={palletType}
            onChange={(e) => setPalletType(e.target.value as PalletType)}
            className="w-24 px-1.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 text-xs font-mono truncate focus:outline-none focus:border-indigo-500"
          >
            {Object.entries(PALLET_SPECS).map(([k, spec]) => (
              <option key={k} value={k}>
                {spec.dimensionsCm}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 text-xs flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            + Bancale
          </button>
        </form>

        {/* Lista Bancali Scrollabile */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
          {summary.palletSummaries.length > 0 ? (
            summary.palletSummaries.map((ps) => {
              const isSelected = selectedPalletId === ps.pallet.id;
              return (
                <div
                  key={ps.pallet.id}
                  onClick={() => setSelectedPalletId(isSelected ? 'all' : ps.pallet.id)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all text-xs space-y-2.5 ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-md ring-1 ring-indigo-500'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-950/40 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <PalletGraphic
                        wrapped={ps.pallet.wrapped}
                        boxCount={ps.totalBoxes}
                        heightCm={ps.pallet.heightCm}
                        className="w-14 h-12 shrink-0"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400 text-xs bg-indigo-100 dark:bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-500/20">
                            {ps.pallet.code}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[120px]">
                            {ps.pallet.label || 'Bancale'}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">
                          {ps.pallet.dimensionsCm} · H {ps.pallet.heightCm}cm
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm tabular-nums">
                        {ps.grossWeightKg.toFixed(0)} kg
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePallet(ps.pallet.id);
                        }}
                        title="Elimina bancale"
                        className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{ps.totalBoxes} scatole stivate</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      Completamento: {ps.completionPercent}%
                    </span>
                  </div>

                  {/* Barra Avanzamento */}
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${ps.completionPercent}%` }}
                      className="h-full bg-emerald-500 transition-all duration-300"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800/80">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Piazzola #{ps.pallet.truckSlot ?? '—'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePalletWrapped(ps.pallet.id);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                        ps.pallet.wrapped
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {ps.pallet.wrapped ? 'Filmato ✓' : 'Da filmare'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-16 text-center text-slate-400 dark:text-slate-500">
              <Layers className="w-10 h-10 text-slate-300 dark:text-slate-700 mb-2.5" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300">Nessun bancale creato</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[240px]">
                Crea il primo bancale per posizionare le scatole e comporre il carico per il camion.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* MODAL INCOLLA CSV / EXCEL */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Incolla Righe Articoli (da Excel o CSV)
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkPasteModal(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Chiudi
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Incolla una riga per ogni articolo. Formato accettato: <br />
              <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
                Nome Articolo ; Quantità ; Peso in kg
              </code>
            </p>

            <form onSubmit={handleBulkSubmit} className="space-y-3">
              <textarea
                rows={7}
                required
                placeholder="Raccordo acciaio inox 1/2 ; 10 ; 0.45&#10;Guarnizione flangiata DN50 ; 50 ; 0.1&#10;Valvola a sfera manuale ; 4 ; 3.2"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(false)}
                  className="px-4 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Inserisci Articoli
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
