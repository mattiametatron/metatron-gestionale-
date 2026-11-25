import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Search,
  Trash2,
  CheckCheck,
  Wand2,
  FileSpreadsheet,
  Minus,
  Pencil,
  Check,
  X,
  Copy,
  CopyPlus,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { CargoLoad, ChecklistItem } from '../types/warehouse';
import {
  LoadSummary,
  compressImageFileToDataUrl,
} from '../utils/calculations';

interface ChecklistWorkspaceProps {
  load: CargoLoad;
  summary: LoadSummary;
  onAddItem: (item: Omit<ChecklistItem, 'id'>) => void;
  onDuplicateItem: (itemId: string) => void;
  onBulkAddLines: (linesText: string) => void;
  onToggleItemChecked: (itemId: string) => void;
  onUpdateItemQuantity: (itemId: string, quantity: number) => void;
  onUpdateItemDetails: (
    itemId: string,
    updates: {
      name?: string;
      sku?: string;
      unitWeightKg?: number;
      fragile?: boolean;
      dimensionsCm?: string;
      photoDataUrl?: string;
    }
  ) => void;
  onAssignItemLocation: (
    itemId: string,
    palletId: string | null,
    boxId: string | null
  ) => void;
  onDeleteItem: (itemId: string) => void;
  onMarkAllChecked: (checked: boolean) => void;
  onAutoDistributeItems: () => void;
  onOpenKitModal: () => void;
}

export const ChecklistWorkspace: React.FC<ChecklistWorkspaceProps> = ({
  load,
  summary,
  onAddItem,
  onDuplicateItem,
  onBulkAddLines,
  onToggleItemChecked,
  onUpdateItemQuantity,
  onUpdateItemDetails,
  onAssignItemLocation,
  onDeleteItem,
  onMarkAllChecked,
  onAutoDistributeItems,
  onOpenKitModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'unchecked' | 'checked' | 'unassigned'
  >('all');
  const [palletFilter, setPalletFilter] = useState<string>('all');

  // Inline Edit Item State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editName, setEditName] = useState('');
  const [editWeight, setEditWeight] = useState(1.0);
  const [editDimensions, setEditDimensions] = useState('');
  const [editFragile, setEditFragile] = useState(false);

  // Lightbox Photo Preview
  const [previewPhotoItem, setPreviewPhotoItem] =
    useState<ChecklistItem | null>(null);

  const startEditingItem = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setEditSku(item.sku);
    setEditName(item.name);
    setEditWeight(item.unitWeightKg);
    setEditDimensions(item.dimensionsCm || '');
    setEditFragile(item.fragile);
  };

  const commitEditingItem = (itemId: string) => {
    if (editName.trim()) {
      onUpdateItemDetails(itemId, {
        name: editName.trim(),
        sku: editSku.trim().toUpperCase() || 'ART',
        unitWeightKg: Math.max(0.05, Number(editWeight) || 0.1),
        dimensionsCm: editDimensions.trim() || undefined,
        fragile: editFragile,
      });
    }
    setEditingItemId(null);
  };

  const handleRowPhotoUpload = async (
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      onUpdateItemDetails(itemId, { photoDataUrl: dataUrl });
    } catch {
      // Ignore invalid image
    }
  };

  // New Item Form State
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category] = useState('Generale');
  const [quantity, setQuantity] = useState(1);
  const [unitWeightKg, setUnitWeightKg] = useState(1.0);
  const [dimensionsCm, setDimensionsCm] = useState('');
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState<string | undefined>(
    undefined
  );
  const [fragile, setFragile] = useState(false);
  const [targetLocation, setTargetLocation] = useState('');

  // Bulk Paste Modal State
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const handleNewItemPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      setNewPhotoDataUrl(dataUrl);
    } catch {
      // Ignore
    }
  };

  const handleAddSingleItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let palletId: string | null = null;
    let boxId: string | null = null;

    if (targetLocation.startsWith('box:')) {
      boxId = targetLocation.replace('box:', '');
      const foundBox = load.boxes.find((b) => b.id === boxId);
      palletId = foundBox?.palletId ?? null;
    } else if (targetLocation.startsWith('pal:')) {
      palletId = targetLocation.replace('pal:', '');
    }

    const generatedSku =
      sku.trim() || `ART-${String(load.items.length + 1).padStart(3, '0')}`;

    onAddItem({
      sku: generatedSku.toUpperCase(),
      name: name.trim(),
      category,
      quantity: Math.max(1, quantity),
      unitWeightKg: Math.max(0.05, unitWeightKg),
      checked: false,
      fragile,
      palletId,
      boxId,
      notes: '',
      dimensionsCm: dimensionsCm.trim() || undefined,
      photoDataUrl: newPhotoDataUrl,
    });

    setSku('');
    setName('');
    setQuantity(1);
    setDimensionsCm('');
    setNewPhotoDataUrl(undefined);
    setFragile(false);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkText.trim()) return;
    onBulkAddLines(bulkText);
    setBulkText('');
    setShowBulkPasteModal(false);
  };

  const filteredItems = useMemo(() => {
    return load.items.filter((item) => {
      if (statusFilter === 'unchecked' && item.checked) return false;
      if (statusFilter === 'checked' && !item.checked) return false;
      if (statusFilter === 'unassigned' && (item.palletId || item.boxId))
        return false;
      if (palletFilter !== 'all' && item.palletId !== palletFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.kitName && item.kitName.toLowerCase().includes(q)) ||
          item.notes.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [load.items, statusFilter, palletFilter, searchQuery]);

  const getLocationSelectValue = (item: ChecklistItem): string => {
    if (item.boxId) return `box:${item.boxId}`;
    if (item.palletId) return `pal:${item.palletId}`;
    return '';
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* =========================================================================
          1. BARRA DI INSERIMENTO RAPIDO ARTICOLO + FOTO + KIT MULTI-SCATOLA
      ========================================================================= */}
      <form
        onSubmit={handleAddSingleItem}
        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs shrink-0 space-y-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Nuovo Oggetto / Materiale Check-list
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              — Inserisci articolo (in scatola o fuori scatola sul bancale), allega foto o genera un Kit
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenKitModal}
              className="px-3 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CopyPlus className="w-3.5 h-3.5 text-indigo-600" />
              Crea Kit in Più Scatole
            </button>

            <button
              type="button"
              onClick={() => setShowBulkPasteModal(true)}
              className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Incolla da Excel / CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 text-xs items-end">
          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              SKU
            </label>
            <input
              type="text"
              placeholder={`ART-${String(load.items.length + 1).padStart(3, '0')}`}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="w-full px-2 py-1.5 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Descrizione Oggetto / Materiale *
            </label>
            <input
              type="text"
              required
              placeholder="es. Motore elettrico, Valvola DN50, Quadro..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Q.tà (pz)
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full px-2 py-1.5 font-mono text-center bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Peso (kg)
            </label>
            <input
              type="number"
              min={0.05}
              step={0.05}
              value={unitWeightKg}
              onChange={(e) => setUnitWeightKg(Number(e.target.value))}
              className="w-full px-2 py-1.5 font-mono text-center bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Misure (L×P×H cm opz.)
            </label>
            <input
              type="text"
              placeholder="es. 50×40×30 cm"
              value={dimensionsCm}
              onChange={(e) => setDimensionsCm(e.target.value)}
              className="w-full px-2 py-1.5 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Collocazione Scatola / Fuori Scatola
            </label>
            <select
              value={targetLocation}
              onChange={(e) => setTargetLocation(e.target.value)}
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono text-xs truncate focus:bg-white focus:outline-none focus:border-blue-600"
            >
              <option value="">Da smistare</option>
              {load.boxes.length > 0 && (
                <optgroup label="Dentro Scatola">
                  {load.boxes.map((b) => {
                    const pal = load.pallets.find((p) => p.id === b.palletId);
                    return (
                      <option key={b.id} value={`box:${b.id}`}>
                        {b.code} — {b.label} {pal ? `(${pal.code})` : ''}
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {load.pallets.length > 0 && (
                <optgroup label="Fuori Scatola (Diretto su Bancale)">
                  {load.pallets.map((p) => (
                    <option key={p.id} value={`pal:${p.id}`}>
                      [FUORI SCATOLA] Su {p.code} — {p.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="lg:col-span-2 flex items-center justify-end gap-1.5">
            {/* Upload Photo for New Item */}
            <label
              title="Allega foto dell'oggetto"
              className={`px-2.5 py-1.5 rounded-lg border font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                newPhotoDataUrl
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              {newPhotoDataUrl ? (
                <img
                  src={newPhotoDataUrl}
                  alt="Anteprima"
                  className="w-4 h-4 rounded object-cover"
                />
              ) : (
                <Camera className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Foto</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleNewItemPhotoUpload}
                className="hidden"
              />
            </label>

            <label className="inline-flex items-center gap-1 text-slate-700 font-semibold cursor-pointer px-1 py-1.5">
              <input
                type="checkbox"
                checked={fragile}
                onChange={(e) => setFragile(e.target.checked)}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Fragile</span>
            </label>

            <button
              type="submit"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              Inserisci
            </button>
          </div>
        </div>
      </form>

      {/* =========================================================================
          2. GRIGLIA TABELLARE AD ALTA DENSITÀ CON FOTO E DUPLICA
      ========================================================================= */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-xs min-h-0">
        {/* Barra Filtri & Azioni di Massa */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cerca SKU, nome o kit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 w-56"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tutti ({load.items.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unchecked')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'unchecked'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Da Spuntare ({summary.totalItems - summary.checkedItems})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('checked')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'checked'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Spuntati ({summary.checkedItems})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unassigned')}
                className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                  statusFilter === 'unassigned'
                    ? 'bg-white text-amber-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Da Smistare ({summary.unassignedItems.length})
              </button>
            </div>

            {load.pallets.length > 0 && (
              <select
                value={palletFilter}
                onChange={(e) => setPalletFilter(e.target.value)}
                className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-700"
              >
                <option value="all">Tutti i Bancali</option>
                {load.pallets.map((p) => (
                  <option key={p.id} value={p.id}>
                    Solo {p.code} — {p.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            {summary.unassignedItems.length > 0 && (
              <button
                type="button"
                onClick={onAutoDistributeItems}
                className="px-3 py-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-700" />
                Smista Automaticamente ({summary.unassignedItems.length})
              </button>
            )}

            {load.items.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onMarkAllChecked(summary.checkedItems < summary.totalItems)
                }
                className="px-3 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                {summary.checkedItems < summary.totalItems
                  ? 'Spunta Tutti'
                  : 'Deseleziona Tutti'}
              </button>
            )}
          </div>
        </div>

        {/* Corpo Tabella Scrollabile */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-2.5 pl-4 pr-2 w-10">Spunta</th>
                <th className="py-2.5 px-2 w-14 text-center">Foto</th>
                <th className="py-2.5 px-2 font-mono w-28">SKU</th>
                <th className="py-2.5 px-3">
                  Descrizione Oggetto (Clicca per modificare)
                </th>
                <th className="py-2.5 px-2 w-28 text-center font-mono">
                  Quantità
                </th>
                <th className="py-2.5 px-2 w-24 text-right font-mono">
                  Peso Tot.
                </th>
                <th className="py-2.5 px-3 w-72">
                  Scatola / Materiale Fuori Scatola
                </th>
                <th className="py-2.5 pl-2 pr-4 w-28 text-right">
                  Copia / Azioni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const assignedBox = load.boxes.find(
                    (b) => b.id === item.boxId
                  );
                  const assignedPallet = load.pallets.find(
                    (p) => p.id === item.palletId
                  );
                  const isEditing = editingItemId === item.id;
                  const isLooseOnPallet = !item.boxId && Boolean(item.palletId);

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors group ${
                        isEditing
                          ? 'bg-blue-50/70'
                          : item.checked
                          ? 'bg-emerald-50/50 hover:bg-emerald-50/80'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 pl-4 pr-2">
                        <button
                          type="button"
                          onClick={() => onToggleItemChecked(item.id)}
                          className="cursor-pointer flex items-center justify-center"
                        >
                          {item.checked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 hover:text-slate-700" />
                          )}
                        </button>
                      </td>

                      {/* Photo Thumbnail / Upload */}
                      <td className="py-2 px-2 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          {item.photoDataUrl ? (
                            <div className="relative group/photo">
                              <img
                                src={item.photoDataUrl}
                                alt={item.name}
                                onClick={() => setPreviewPhotoItem(item)}
                                title="Clicca per ingrandire la foto"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-300 cursor-pointer shadow-2xs"
                              />
                              <label
                                title="Cambia foto"
                                className="absolute -bottom-1 -right-1 bg-slate-900 text-white p-0.5 rounded-full cursor-pointer opacity-0 group-hover/photo:opacity-100 transition-opacity"
                              >
                                <Camera className="w-2.5 h-2.5" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    handleRowPhotoUpload(item.id, e)
                                  }
                                  className="hidden"
                                />
                              </label>
                            </div>
                          ) : (
                            <label
                              title="Carica foto per questo oggetto"
                              className="w-8 h-8 rounded-lg border border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 hover:bg-blue-50 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer transition-colors"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  handleRowPhotoUpload(item.id, e)
                                }
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="py-2 px-2 font-mono font-bold text-slate-700">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editSku}
                            onChange={(e) => setEditSku(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEditingItem(item.id);
                              if (e.key === 'Escape') setEditingItemId(null);
                            }}
                            className="w-full px-2 py-1 font-mono text-xs bg-white border border-blue-500 rounded text-slate-900 focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditingItem(item)}
                            className="hover:text-blue-700 hover:underline text-left cursor-pointer"
                          >
                            {item.sku}
                          </button>
                        )}
                      </td>

                      {/* Name, Dimensions, Kit & Fragile */}
                      <td className="py-2 px-3 font-semibold text-slate-900">
                        {isEditing ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="text"
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  commitEditingItem(item.id);
                                if (e.key === 'Escape') setEditingItemId(null);
                              }}
                              placeholder="Nome articolo..."
                              className="flex-1 min-w-[150px] px-2 py-1 text-xs bg-white border border-blue-500 rounded text-slate-900 focus:outline-none"
                            />
                            <input
                              type="text"
                              value={editDimensions}
                              onChange={(e) =>
                                setEditDimensions(e.target.value)
                              }
                              placeholder="Misure (es. 50×40×30 cm)"
                              className="w-32 px-2 py-1 font-mono text-xs bg-white border border-slate-300 rounded text-slate-800"
                            />
                            <input
                              type="number"
                              min={0.05}
                              step={0.05}
                              value={editWeight}
                              onChange={(e) =>
                                setEditWeight(Number(e.target.value))
                              }
                              title="Peso unitario kg"
                              className="w-18 px-1.5 py-1 font-mono text-xs bg-white border border-slate-300 rounded text-right"
                            />
                            <label className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200 cursor-pointer shrink-0">
                              <input
                                type="checkbox"
                                checked={editFragile}
                                onChange={(e) =>
                                  setEditFragile(e.target.checked)
                                }
                                className="rounded border-rose-300 text-rose-600"
                              />
                              <span>Fragile</span>
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditingItem(item)}
                              title="Clicca per modificare nome, misure o peso"
                              className={`text-left hover:text-blue-700 transition-colors flex items-center gap-1.5 cursor-pointer ${
                                item.checked
                                  ? 'line-through text-slate-400'
                                  : ''
                              }`}
                            >
                              <span>{item.name}</span>
                              <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                            {item.dimensionsCm && (
                              <span className="text-[10px] font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {item.dimensionsCm}
                              </span>
                            )}
                            {item.kitName && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                KIT: {item.kitName}
                              </span>
                            )}
                            {item.fragile && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                FRAGILE
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Quantity Stepper */}
                      <td className="py-2 px-2 text-center">
                        <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateItemQuantity(
                                item.id,
                                Math.max(1, item.quantity - 1)
                              )
                            }
                            className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 py-0.5 font-mono font-bold text-slate-900 tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateItemQuantity(item.id, item.quantity + 1)
                            }
                            className="px-2 py-0.5 text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Total Weight */}
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 tabular-nums">
                        <div>
                          {(item.quantity * item.unitWeightKg).toFixed(1)} kg
                        </div>
                        <div className="text-[10px] font-normal text-slate-400">
                          ({item.unitWeightKg.toFixed(2)}/pz)
                        </div>
                      </td>

                      {/* Location Assignment */}
                      <td className="py-2 px-3">
                        <select
                          aria-label={`Destinazione per ${item.name}`}
                          value={getLocationSelectValue(item)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              onAssignItemLocation(item.id, null, null);
                            } else if (val.startsWith('box:')) {
                              const bId = val.replace('box:', '');
                              const targetBox = load.boxes.find(
                                (b) => b.id === bId
                              );
                              onAssignItemLocation(
                                item.id,
                                targetBox?.palletId ?? null,
                                bId
                              );
                            } else if (val.startsWith('pal:')) {
                              onAssignItemLocation(
                                item.id,
                                val.replace('pal:', ''),
                                null
                              );
                            }
                          }}
                          className={`w-full px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                            isLooseOnPallet
                              ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold'
                              : assignedBox || assignedPallet
                              ? 'bg-slate-50 border-slate-300 text-slate-800 font-semibold'
                              : 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                          }`}
                        >
                          <option value="">⚠ Da Smistare</option>
                          {load.boxes.length > 0 && (
                            <optgroup label="Dentro Scatola">
                              {load.boxes.map((b) => {
                                const p = load.pallets.find(
                                  (pal) => pal.id === b.palletId
                                );
                                return (
                                  <option key={b.id} value={`box:${b.id}`}>
                                    {p ? `${p.code} > ` : ''}
                                    {b.code} ({b.label})
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          {load.pallets.length > 0 && (
                            <optgroup label="Fuori Scatola (Diretto su Bancale)">
                              {load.pallets.map((p) => (
                                <option key={p.id} value={`pal:${p.id}`}>
                                  [FUORI SCATOLA] Su {p.code} — {p.label}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </td>

                      {/* Actions: Duplicate (Copia/Incolla), Edit, Delete */}
                      <td className="py-2 pl-2 pr-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => commitEditingItem(item.id)}
                                title="Salva modifiche"
                                className="p-1 text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                title="Annulla"
                                className="p-1 text-slate-600 bg-slate-200 hover:bg-slate-300 rounded transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onDuplicateItem(item.id)}
                                title="Duplica questo oggetto (Copia e Incolla riga)"
                                className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditingItem(item)}
                                title="Modifica nome, SKU, misure o peso"
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteItem(item.id)}
                                title="Elimina riga"
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-2">
                      <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-sm font-bold text-slate-700">
                        La Check-list è vuota
                      </p>
                      <p className="text-xs text-slate-500">
                        Inserisci il primo articolo usando la barra in alto, allega una foto o clicca su &quot;Crea Kit in Più Scatole&quot;.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Riepilogo Tabella */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-600 shrink-0">
          <div className="flex items-center gap-4">
            <span>
              Righe Visualizzate:{' '}
              <strong className="text-slate-900">{filteredItems.length}</strong>{' '}
              / {load.items.length}
            </span>
            <span>·</span>
            <span>
              Pezzi Totali:{' '}
              <strong className="text-slate-900">
                {summary.totalPieces} pz
              </strong>{' '}
              ({summary.checkedPieces} spuntati)
            </span>
          </div>
          <div>
            Peso Netto Merce:{' '}
            <strong className="text-slate-900">
              {summary.netMerchandiseWeightKg.toFixed(1)} kg
            </strong>
          </div>
        </div>
      </div>

      {/* LIGHTBOX ANTEPRIMA FOTO ARTICOLO */}
      {previewPhotoItem && (
        <div
          onClick={() => setPreviewPhotoItem(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full p-4 space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">
                  {previewPhotoItem.sku}
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {previewPhotoItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPhotoItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewPhotoItem.photoDataUrl && (
              <img
                src={previewPhotoItem.photoDataUrl}
                alt={previewPhotoItem.name}
                className="w-full max-h-80 object-contain rounded-xl bg-slate-100 border border-slate-200"
              />
            )}
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
              <span>
                Quantità: <strong>{previewPhotoItem.quantity} pz</strong> · Peso:{' '}
                <strong>
                  {(
                    previewPhotoItem.quantity * previewPhotoItem.unitWeightKg
                  ).toFixed(1)}{' '}
                  kg
                </strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  onUpdateItemDetails(previewPhotoItem.id, {
                    photoDataUrl: undefined,
                  });
                  setPreviewPhotoItem(null);
                }}
                className="text-rose-600 hover:underline font-bold cursor-pointer"
              >
                Rimuovi Foto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE INCOLLA DA EXCEL / CSV */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 uppercase">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Importazione Rapida da Excel / Testo
              </h3>
              <button
                type="button"
                onClick={() => setShowBulkPasteModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Chiudi
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Incolla un articolo per riga separando con punto e virgola (
              <code className="font-mono font-bold text-slate-900">
                Descrizione ; Quantità ; PesoUnitarioKg
              </code>
              ):
            </p>

            <form onSubmit={handleBulkSubmit} className="space-y-3 text-xs">
              <textarea
                rows={7}
                required
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={`Valvola a sfera DN50 ; 10 ; 2.4\nCassa bulloneria zincata M12 ; 4 ; 8.5\nQuadro comando linea ; 1 ; 24.0`}
                className="w-full p-3 font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Importa Righe nella Check-list
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
