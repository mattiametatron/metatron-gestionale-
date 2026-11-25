import React, { useState } from 'react';
import {
  CopyPlus,
  Plus,
  Trash2,
  X,
  Package,
  Layers,
  Camera,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  BOX_SPECS,
  BoxType,
  CargoLoad,
  ChecklistItem,
} from '../types/warehouse';
import { compressImageFileToDataUrl } from '../utils/calculations';

export interface KitTemplateItem {
  id: string;
  skuPrefix: string;
  name: string;
  quantityPerBox: number;
  unitWeightKg: number;
  fragile: boolean;
  photoDataUrl?: string;
}

export interface CreateKitPayload {
  kitName: string;
  mode: 'new_boxes' | 'existing_boxes';
  // For 'new_boxes'
  boxCount: number;
  boxType: BoxType;
  customDimensionsCm: string;
  targetPalletId: string | null;
  parentBoxId: string | null;
  // For 'existing_boxes'
  targetBoxIds: string[];
  // Kit items
  items: KitTemplateItem[];
}

interface KitGeneratorModalProps {
  load: CargoLoad;
  defaultPalletId?: string | null;
  onCreateKit: (payload: CreateKitPayload) => void;
  onClose: () => void;
}

export const KitGeneratorModal: React.FC<KitGeneratorModalProps> = ({
  load,
  defaultPalletId = null,
  onCreateKit,
  onClose,
}) => {
  const [kitName, setKitName] = useState('Kit Ricambi Standard');
  const [mode, setMode] = useState<'new_boxes' | 'existing_boxes'>('new_boxes');

  // New Boxes configuration
  const [boxCount, setBoxCount] = useState(3);
  const [boxType, setBoxType] = useState<BoxType>('M_60x40x40');
  const [customL, setCustomL] = useState(60);
  const [customW, setCustomW] = useState(40);
  const [customH, setCustomH] = useState(40);
  const [targetPalletId, setTargetPalletId] = useState<string>(
    defaultPalletId || load.pallets[0]?.id || ''
  );
  const [parentBoxId, setParentBoxId] = useState<string>('');

  // Existing Boxes selection
  const [selectedBoxIds, setSelectedBoxIds] = useState<string[]>(
    load.boxes.map((b) => b.id)
  );

  // Kit items list
  const [kitItems, setKitItems] = useState<KitTemplateItem[]>([
    {
      id: `ki-${Date.now()}-1`,
      skuPrefix: 'KIT-01',
      name: '',
      quantityPerBox: 1,
      unitWeightKg: 1.0,
      fragile: false,
    },
  ]);

  const handleBoxTypeChange = (nextType: BoxType) => {
    setBoxType(nextType);
    const spec = BOX_SPECS[nextType];
    const parts = spec.dimensionsCm
      .replace(/cm/gi, '')
      .split(/[x×*]/i)
      .map((n) => parseInt(n.trim(), 10));
    if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
      setCustomL(parts[0]);
      setCustomW(parts[1]);
      setCustomH(parts[2]);
    }
  };

  const handleAddKitItemRow = () => {
    setKitItems((prev) => [
      ...prev,
      {
        id: `ki-${Date.now()}-${prev.length + 1}`,
        skuPrefix: `KIT-${String(prev.length + 1).padStart(2, '0')}`,
        name: '',
        quantityPerBox: 1,
        unitWeightKg: 1.0,
        fragile: false,
      },
    ]);
  };

  const handleImportExistingItemIntoKit = (item: ChecklistItem) => {
    setKitItems((prev) => {
      const cleanPrev =
        prev.length === 1 && !prev[0].name.trim() ? [] : prev;
      return [
        ...cleanPrev,
        {
          id: `ki-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          skuPrefix: item.sku,
          name: item.name,
          quantityPerBox: item.quantity,
          unitWeightKg: item.unitWeightKg,
          fragile: item.fragile,
          photoDataUrl: item.photoDataUrl,
        },
      ];
    });
  };

  const handleUpdateKitItem = (
    id: string,
    updates: Partial<KitTemplateItem>
  ) => {
    setKitItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
    );
  };

  const handleRemoveKitItem = (id: string) => {
    if (kitItems.length <= 1) return;
    setKitItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handlePhotoUpload = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      handleUpdateKitItem(id, { photoDataUrl: dataUrl });
    } catch {
      // Ignore invalid image
    }
  };

  const toggleExistingBox = (boxId: string) => {
    setSelectedBoxIds((prev) =>
      prev.includes(boxId)
        ? prev.filter((id) => id !== boxId)
        : [...prev, boxId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = kitItems.filter((i) => i.name.trim().length > 0);
    if (!kitName.trim() || validItems.length === 0) return;

    if (mode === 'existing_boxes' && selectedBoxIds.length === 0) return;

    onCreateKit({
      kitName: kitName.trim(),
      mode,
      boxCount: Math.max(1, Math.min(50, boxCount)),
      boxType,
      customDimensionsCm: `${Math.max(10, customL)}×${Math.max(
        10,
        customW
      )}×${Math.max(10, customH)} cm`,
      targetPalletId: targetPalletId || null,
      parentBoxId: parentBoxId || null,
      targetBoxIds: selectedBoxIds,
      items: validItems,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <CopyPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Generatore Kit Ripetitivo in Più Scatole
              </h2>
              <p className="text-xs text-slate-500">
                Prepara un gruppo di articoli identici e replicalo automaticamente in N scatole diverse
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-5 text-xs"
        >
          {/* 1. Nome del Kit e Modalità */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-5">
              <label className="block font-bold text-slate-700 mb-1">
                Nome del Kit *
              </label>
              <input
                type="text"
                required
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                placeholder="es. Kit Montaggio Stazione / Kit Viteria..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="sm:col-span-7">
              <label className="block font-bold text-slate-700 mb-1">
                Come vuoi distribuire il Kit?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('new_boxes')}
                  className={`py-2 px-3 rounded-lg border font-bold text-left flex items-center gap-2 transition-all cursor-pointer ${
                    mode === 'new_boxes'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Package className="w-4 h-4 shrink-0" />
                  <span>Crea N Scatole Nuove</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('existing_boxes')}
                  disabled={load.boxes.length === 0}
                  className={`py-2 px-3 rounded-lg border font-bold text-left flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 ${
                    mode === 'existing_boxes'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>Copia in Scatole Esistenti ({load.boxes.length})</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Configurazione Scatole Destinazione */}
          {mode === 'new_boxes' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                Configurazione Nuove Scatole del Kit
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Numero Scatole Uguali
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={boxCount}
                    onChange={(e) => setBoxCount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 font-mono font-bold text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Formato Scatola
                  </label>
                  <select
                    value={boxType}
                    onChange={(e) =>
                      handleBoxTypeChange(e.target.value as BoxType)
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800"
                  >
                    {Object.entries(BOX_SPECS).map(([k, spec]) => (
                      <option key={k} value={k}>
                        {spec.name} ({spec.dimensionsCm})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Dimensioni Scatola (L × P × H in cm)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 font-mono">
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={customL}
                      onChange={(e) => {
                        setCustomL(Number(e.target.value));
                        setBoxType('PERSONALIZZATA');
                      }}
                      title="Lunghezza (cm)"
                      placeholder="L cm"
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold"
                    />
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={customW}
                      onChange={(e) => {
                        setCustomW(Number(e.target.value));
                        setBoxType('PERSONALIZZATA');
                      }}
                      title="Profondità (cm)"
                      placeholder="P cm"
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold"
                    />
                    <input
                      type="number"
                      min={10}
                      max={300}
                      value={customH}
                      onChange={(e) => {
                        setCustomH(Number(e.target.value));
                        setBoxType('PERSONALIZZATA');
                      }}
                      title="Altezza (cm)"
                      placeholder="H cm"
                      className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Posiziona su Bancale
                  </label>
                  <select
                    value={targetPalletId}
                    onChange={(e) => setTargetPalletId(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800"
                  >
                    <option value="">A Terra (Nessun Bancale)</option>
                    {load.pallets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.label} ({p.dimensionsCm})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Oppure Dentro uno Scatolone Madre (Opzionale)
                  </label>
                  <select
                    value={parentBoxId}
                    onChange={(e) => {
                      const pbId = e.target.value;
                      setParentBoxId(pbId);
                      if (pbId) {
                        const pb = load.boxes.find((b) => b.id === pbId);
                        if (pb?.palletId) setTargetPalletId(pb.palletId);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800"
                  >
                    <option value="">
                      — Scatole indipendenti direttamente sul bancale —
                    </option>
                    {load.boxes
                      .filter((b) => !b.parentBoxId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          Dentro {b.code} — {b.label} ({b.dimensionsCm})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  Seleziona le Scatole in cui inserire il Kit (
                  {selectedBoxIds.length}/{load.boxes.length})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedBoxIds(
                      selectedBoxIds.length === load.boxes.length
                        ? []
                        : load.boxes.map((b) => b.id)
                    )
                  }
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  {selectedBoxIds.length === load.boxes.length
                    ? 'Deseleziona Tutte'
                    : 'Seleziona Tutte'}
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto">
                {load.boxes.map((b) => {
                  const checked = selectedBoxIds.includes(b.id);
                  const pal = load.pallets.find((p) => p.id === b.palletId);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleExistingBox(b.id)}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                        checked
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="truncate">
                        <div className="font-mono text-[11px]">
                          {b.code} {pal ? `(${pal.code})` : ''}
                        </div>
                        <div className="truncate text-[11px]">{b.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Articoli che compongono ogni singolo Kit */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  Articoli Contenuti in Ciascuna Scatola del Kit
                </h3>
                <p className="text-[11px] text-slate-500">
                  Ogni scatola del kit riceverà tutti gli oggetti elencati qui sotto
                </p>
              </div>

              <div className="flex items-center gap-2">
                {load.items.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const found = load.items.find(
                        (i) => i.id === e.target.value
                      );
                      if (found) handleImportExistingItemIntoKit(found);
                    }}
                    className="px-2.5 py-1.5 bg-slate-100 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="">+ Copia da articolo esistente...</option>
                    {load.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.sku} — {it.name} ({it.quantity} pz)
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleAddKitItemRow}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Voce al Kit
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {kitItems.map((ki, idx) => (
                <div
                  key={ki.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl p-2.5"
                >
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={ki.skuPrefix}
                      onChange={(e) =>
                        handleUpdateKitItem(ki.id, {
                          skuPrefix: e.target.value,
                        })
                      }
                      placeholder="SKU"
                      className="w-full px-2 py-1.5 font-mono text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      required={idx === 0}
                      value={ki.name}
                      onChange={(e) =>
                        handleUpdateKitItem(ki.id, { name: e.target.value })
                      }
                      placeholder="Nome oggetto nel kit (es. Sensore ottico, Staffa)..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      value={ki.quantityPerBox}
                      onChange={(e) =>
                        handleUpdateKitItem(ki.id, {
                          quantityPerBox: Math.max(1, Number(e.target.value)),
                        })
                      }
                      className="w-full px-2 py-1.5 font-mono text-center bg-white border border-slate-300 rounded-lg font-bold"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">
                      pz
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <input
                      type="number"
                      min={0.05}
                      step={0.05}
                      value={ki.unitWeightKg}
                      onChange={(e) =>
                        handleUpdateKitItem(ki.id, {
                          unitWeightKg: Math.max(0.05, Number(e.target.value)),
                        })
                      }
                      className="w-full px-2 py-1.5 font-mono text-center bg-white border border-slate-300 rounded-lg"
                    />
                    <span className="text-[10px] text-slate-500 font-mono">
                      kg
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-1.5">
                    {/* Photo upload for kit item */}
                    <label
                      title="Carica foto oggetto"
                      className="p-1.5 bg-white hover:bg-blue-50 border border-slate-300 rounded-lg cursor-pointer flex items-center justify-center"
                    >
                      {ki.photoDataUrl ? (
                        <img
                          src={ki.photoDataUrl}
                          alt="Foto"
                          className="w-5 h-5 rounded object-cover"
                        />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoUpload(ki.id, e)}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveKitItem(ki.id)}
                      disabled={kitItems.length <= 1}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-xs text-slate-600">
              {mode === 'new_boxes' ? (
                <span>
                  Verranno create{' '}
                  <strong className="text-indigo-700">
                    {boxCount} scatole ({customL}×{customW}×{customH} cm)
                  </strong>{' '}
                  con il kit completo.
                </span>
              ) : (
                <span>
                  Il kit verrà copiato in{' '}
                  <strong className="text-indigo-700">
                    {selectedBoxIds.length} scatole
                  </strong>
                  .
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <CopyPlus className="w-4 h-4" />
                Genera Kit nelle Scatole
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
