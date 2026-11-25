import React, { useState, useMemo } from 'react';
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
  Wand2,
  ChevronRight,
  ChevronDown,
  FolderTree,
  AlertCircle,
  Pencil,
  Check,
  X,
  Box,
  Copy,
  CopyPlus,
  Camera,
  GitBranch,
  LayoutGrid,
} from 'lucide-react';
import {
  BOX_SPECS,
  BoxType,
  CargoBox,
  CargoLoad,
  CargoPallet,
  ChecklistItem,
  PALLET_SPECS,
  PalletType,
} from '../types/warehouse';
import {
  LoadSummary,
  BoxSummary,
  compressImageFileToDataUrl,
} from '../utils/calculations';
import { PalletGraphic, BoxGraphic } from './WarehouseGraphics';
import { Pallet3DVisualizer } from './Pallet3DVisualizer';
import { ImageEditorModal } from './ImageEditorModal';

interface HierarchicalLoadTreeProps {
  load: CargoLoad;
  summary: LoadSummary;
  onAddPallet: (data: {
    label: string;
    palletType: PalletType;
    heightCm: number;
    notes: string;
  }) => void;
  onUpdatePallet: (
    palletId: string,
    updates: {
      label?: string;
      palletType?: PalletType;
      heightCm?: number;
      notes?: string;
    }
  ) => void;
  onDuplicatePallet: (palletId: string) => void;
  onDeletePallet: (palletId: string) => void;
  onTogglePalletWrapped: (palletId: string) => void;
  onAddBox: (data: {
    label: string;
    boxType: BoxType;
    dimensionsCm?: string;
    palletId: string | null;
    parentBoxId?: string | null;
    fragile: boolean;
    stackLevel: 1 | 2 | 3;
  }) => void;
  onUpdateBox: (
    boxId: string,
    updates: {
      label?: string;
      boxType?: BoxType;
      dimensionsCm?: string;
      parentBoxId?: string | null;
      stackLevel?: 1 | 2 | 3;
      fragile?: boolean;
    }
  ) => void;
  onDuplicateBox: (boxId: string) => void;
  onDeleteBox: (boxId: string) => void;
  onMoveBoxToPallet: (
    boxId: string,
    palletId: string | null,
    parentBoxId?: string | null
  ) => void;
  onToggleBoxSealed: (boxId: string) => void;
  onToggleItemChecked: (itemId: string) => void;
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
  onDuplicateItem: (itemId: string) => void;
  onAssignItemLocation: (
    itemId: string,
    palletId: string | null,
    boxId: string | null
  ) => void;
  onQuickAddItemToBox: (
    palletId: string | null,
    boxId: string | null,
    name: string,
    quantity: number,
    unitWeightKg: number,
    dimensionsCm?: string,
    photoDataUrl?: string
  ) => void;
  onAutoDistributeItems: () => void;
  onOpen3DViewForPallet: (palletId: string | 'all') => void;
  onOpenKitModal: (defaultPalletId?: string | null) => void;
}

function parseLWH(dimStr: string): [number, number, number] {
  const nums = dimStr
    .replace(/cm/gi, '')
    .split(/[x×*]/i)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
  if (nums.length >= 3) return [nums[0], nums[1], nums[2]];
  return [60, 40, 40];
}

export const HierarchicalLoadTree: React.FC<HierarchicalLoadTreeProps> = ({
  load,
  summary,
  onAddPallet,
  onUpdatePallet,
  onDuplicatePallet,
  onDeletePallet,
  onTogglePalletWrapped,
  onAddBox,
  onUpdateBox,
  onDuplicateBox,
  onDeleteBox,
  onMoveBoxToPallet,
  onToggleBoxSealed,
  onToggleItemChecked,
  onUpdateItemDetails,
  onDuplicateItem,
  onAssignItemLocation,
  onQuickAddItemToBox,
  onAutoDistributeItems,
  onOpen3DViewForPallet,
  onOpenKitModal,
}) => {
  // Tree Selection State: 'all', palletId, or 'loose_boxes'
  const [selectedNodeId, setSelectedNodeId] = useState<string>('all');
  const [expandedPallets, setExpandedPallets] = useState<
    Record<string, boolean>
  >({});
  const [focusedBoxId, setFocusedBoxId] = useState<string | null>(null);
  const [rightViewMode, setRightViewMode] = useState<
    'cards' | 'tree_schema' | 'cad_3d'
  >('cards');

  // Lightbox Photo Preview
  const [previewPhotoItem, setPreviewPhotoItem] =
    useState<ChecklistItem | null>(null);

  // Inline Edit Pallet State
  const [editingPalletId, setEditingPalletId] = useState<string | null>(null);
  const [editPalletLabel, setEditPalletLabel] = useState('');
  const [editPalletType, setEditPalletType] =
    useState<PalletType>('EPAL_80x120');
  const [editPalletHeight, setEditPalletHeight] = useState<number | string>(140);

  const startEditingPallet = (pallet: CargoPallet, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPalletId(pallet.id);
    setEditPalletLabel(pallet.label);
    setEditPalletType(pallet.palletType);
    setEditPalletHeight(pallet.heightCm);
  };

  const commitEditingPallet = (
    palletId: string,
    e?: React.FormEvent | React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    if (editPalletLabel.trim()) {
      onUpdatePallet(palletId, {
        label: editPalletLabel.trim(),
        palletType: editPalletType,
        heightCm: Math.max(40, Math.min(260, Number(editPalletHeight) || 140)),
      });
    }
    setEditingPalletId(null);
  };

  // Inline Edit Box State (with Custom LxPxH cm & ParentBox)
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);
  const [editBoxLabel, setEditBoxLabel] = useState('');
  const [editBoxType, setEditBoxType] = useState<BoxType>('M_60x40x40');
  const [editBoxL, setEditBoxL] = useState(60);
  const [editBoxW, setEditBoxW] = useState(40);
  const [editBoxH, setEditBoxH] = useState(40);
  const [editBoxParentId, setEditBoxParentId] = useState<string>('');
  const [editBoxStackLevel, setEditBoxStackLevel] = useState<1 | 2 | 3>(1);
  const [editBoxFragile, setEditBoxFragile] = useState(false);

  const startEditingBox = (box: CargoBox, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const [l, w, h] = parseLWH(box.dimensionsCm);
    setEditingBoxId(box.id);
    setEditBoxLabel(box.label);
    setEditBoxType(box.boxType);
    setEditBoxL(l);
    setEditBoxW(w);
    setEditBoxH(h);
    setEditBoxParentId(box.parentBoxId || '');
    setEditBoxStackLevel(box.stackLevel);
    setEditBoxFragile(box.fragile);
  };

  const commitEditingBox = (boxId: string) => {
    if (editBoxLabel.trim()) {
      const customDim = `${Math.max(10, editBoxL)}×${Math.max(
        10,
        editBoxW
      )}×${Math.max(10, editBoxH)} cm`;
      onUpdateBox(boxId, {
        label: editBoxLabel.trim(),
        boxType: editBoxType,
        dimensionsCm: customDim,
        parentBoxId: editBoxParentId || null,
        stackLevel: editBoxStackLevel,
        fragile: editBoxFragile,
      });
    }
    setEditingBoxId(null);
  };

  // Inline Edit Article inside Box State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemSku, setEditItemSku] = useState('');
  const [editItemDim, setEditItemDim] = useState('');

  const startEditingItem = (item: ChecklistItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemSku(item.sku);
    setEditItemDim(item.dimensionsCm || '');
  };

  const commitEditingItem = (itemId: string) => {
    if (editItemName.trim()) {
      onUpdateItemDetails(itemId, {
        name: editItemName.trim(),
        sku: editItemSku.trim().toUpperCase() || 'ART',
        dimensionsCm: editItemDim.trim() || undefined,
      });
    }
    setEditingItemId(null);
  };

  // State per Modifica / Ritocco Foto
  const [photoEditorItem, setPhotoEditorItem] = useState<{
    id: string;
    dataUrl: string;
    name: string;
  } | null>(null);

  const handleItemPhotoUpload = async (
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>,
    itemName?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      // Apri subito l'editor fotografico: permette rotazione (0/90/180/270), luminosità, contrasto, annotazioni e timbri
      setPhotoEditorItem({
        id: itemId,
        dataUrl,
        name: itemName || 'Articolo / Collo',
      });
    } catch {
      // Ignore
    } finally {
      e.target.value = '';
    }
  };

  // Quick Add Pallet State
  const [showAddPalletModal, setShowAddPalletModal] = useState(false);
  const [newPalletLabel, setNewPalletLabel] = useState('');
  const [newPalletType, setNewPalletType] =
    useState<PalletType>('EPAL_80x120');
  const [newPalletHeight, setNewPalletHeight] = useState(140);
  const [newPalletNotes, setNewPalletNotes] = useState('');

  // Quick Add Box Inline Form (with custom LxPxH cm and optional parentBoxId)
  const [newBoxLabel, setNewBoxLabel] = useState('');
  const [newBoxType, setNewBoxType] = useState<BoxType>('M_60x40x40');
  const [newBoxL, setNewBoxL] = useState(60);
  const [newBoxW, setNewBoxW] = useState(40);
  const [newBoxH, setNewBoxH] = useState(40);
  const [newBoxParentId, setNewBoxParentId] = useState<string>('');
  const [newBoxStackLevel, setNewBoxStackLevel] = useState<1 | 2 | 3>(1);
  const [newBoxFragile, setNewBoxFragile] = useState(false);

  const handleNewBoxPresetChange = (nextType: BoxType) => {
    setNewBoxType(nextType);
    const [l, w, h] = parseLWH(BOX_SPECS[nextType].dimensionsCm);
    setNewBoxL(l);
    setNewBoxW(w);
    setNewBoxH(h);
  };

  // Quick Add Item inside a specific Box
  const [activeQuickBoxId, setActiveQuickBoxId] = useState<string | null>(null);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemQty, setQuickItemQty] = useState(1);
  const [quickItemWeight, setQuickItemWeight] = useState(1.0);
  const [quickItemPhoto, setQuickItemPhoto] = useState<string | undefined>(
    undefined
  );

  // Quick Add Loose Item ("Materiale Fuori Scatola") directly onto a Pallet
  const [showAddLooseForm, setShowAddLooseForm] = useState(false);
  const [looseName, setLooseName] = useState('');
  const [looseQty, setLooseQty] = useState(1);
  const [looseWeight, setLooseWeight] = useState(5.0);
  const [looseDim, setLooseDim] = useState('50×40×35 cm');
  const [loosePhoto, setLoosePhoto] = useState<string | undefined>(undefined);

  const looseBoxes: BoxSummary[] = summary.unassignedBoxes;

  const toggleExpandPallet = (palletId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPallets((prev) => ({
      ...prev,
      [palletId]: prev[palletId] === undefined ? false : !prev[palletId],
    }));
  };

  const isPalletExpanded = (palletId: string) => {
    return expandedPallets[palletId] !== false;
  };

  const handleCreatePallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPalletLabel.trim()) return;
    onAddPallet({
      label: newPalletLabel.trim(),
      palletType: newPalletType,
      heightCm: newPalletHeight,
      notes: newPalletNotes.trim(),
    });
    setNewPalletLabel('');
    setNewPalletNotes('');
    setShowAddPalletModal(false);
  };

  const handleQuickCreateBox = (
    e: React.FormEvent,
    targetPalletId: string | null
  ) => {
    e.preventDefault();
    if (!newBoxLabel.trim()) return;
    const customDimensionsCm = `${Math.max(10, newBoxL)}×${Math.max(
      10,
      newBoxW
    )}×${Math.max(10, newBoxH)} cm`;

    const parentBox = newBoxParentId
      ? load.boxes.find((b) => b.id === newBoxParentId)
      : null;

    onAddBox({
      label: newBoxLabel.trim(),
      boxType: newBoxType,
      dimensionsCm: customDimensionsCm,
      palletId: parentBox ? parentBox.palletId : targetPalletId,
      parentBoxId: newBoxParentId || null,
      fragile: newBoxFragile,
      stackLevel: newBoxStackLevel,
    });
    setNewBoxLabel('');
    setNewBoxFragile(false);
    setNewBoxParentId('');
  };

  const handleQuickAddItemSubmit = (
    e: React.FormEvent,
    palletId: string | null,
    boxId: string
  ) => {
    e.preventDefault();
    if (!quickItemName.trim()) return;
    onQuickAddItemToBox(
      palletId,
      boxId,
      quickItemName.trim(),
      Math.max(1, quickItemQty),
      Math.max(0.05, quickItemWeight),
      undefined,
      quickItemPhoto
    );
    setQuickItemName('');
    setQuickItemQty(1);
    setQuickItemWeight(1.0);
    setQuickItemPhoto(undefined);
    setActiveQuickBoxId(null);
  };

  const handleQuickAddLooseSubmit = (
    e: React.FormEvent,
    palletId: string
  ) => {
    e.preventDefault();
    if (!looseName.trim()) return;
    onQuickAddItemToBox(
      palletId,
      null, // null boxId = Materiale Fuori Scatola direttamente sul bancale!
      looseName.trim(),
      Math.max(1, looseQty),
      Math.max(0.1, looseWeight),
      looseDim.trim() || '50×40×35 cm',
      loosePhoto
    );
    setLooseName('');
    setLooseQty(1);
    setLooseWeight(5.0);
    setLoosePhoto(undefined);
    setShowAddLooseForm(false);
  };

  const selectedPalletSummary = useMemo(() => {
    if (selectedNodeId === 'all' || selectedNodeId === 'loose_boxes')
      return null;
    return (
      summary.palletSummaries.find((ps) => ps.pallet.id === selectedNodeId) ||
      null
    );
  }, [selectedNodeId, summary.palletSummaries]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* =========================================================================
          STRISCIA SUPERIORE SMISTAMENTO RAPIDO
      ========================================================================= */}
      {summary.unassignedItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs">
            <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-amber-950">
              {summary.unassignedItems.length} articoli senza collocazione
            </span>
          </div>

          <button
            type="button"
            onClick={onAutoDistributeItems}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Smista Automaticamente in Scatole & Bancali
          </button>
        </div>
      )}

      {/* =========================================================================
          CORPO MASTER-DETAIL: ALBERO GERARCHICO (SX) + ISPETTORE / SCHEMA (DX)
      ========================================================================= */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* PANNELLO SINISTRO (4 COLS): ALBERO GERARCHICO VISIVO */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-xs">
          {/* Intestazione Albero */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                Albero Commessa
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onOpenKitModal(selectedPalletSummary?.pallet.id || null)
                }
                title="Crea Kit ripetitivo in più scatole"
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[11px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CopyPlus className="w-3 h-3" />
                Kit
              </button>
              <button
                type="button"
                onClick={() => setShowAddPalletModal(true)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Bancale
              </button>
            </div>
          </div>

          {/* Albero Navigabile */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Nodo Radice: Tutto il Carico */}
            <button
              type="button"
              onClick={() => {
                setSelectedNodeId('all');
                setFocusedBoxId(null);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                selectedNodeId === 'all'
                  ? 'bg-blue-50/90 border-blue-500 text-blue-950 shadow-2xs font-bold'
                  : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100 font-semibold'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Layers className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs truncate">
                  Tutti i Bancali ({summary.totalPallets})
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 tabular-nums">
                {summary.totalGrossWeightKg.toFixed(0)} kg
              </span>
            </button>

            {/* Nodi Bancali con Sotto-Rami Scatoloni -> Sotto-Scatole -> Materiale Fuori Scatola */}
            {summary.palletSummaries.length > 0 ? (
              <div className="space-y-2 pt-1">
                {summary.palletSummaries.map((ps) => {
                  const isSelected = selectedNodeId === ps.pallet.id;
                  const expanded = isPalletExpanded(ps.pallet.id);

                  return (
                    <div
                      key={ps.pallet.id}
                      className={`rounded-xl border transition-all overflow-hidden ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/30 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Nodo Padre: Il Bancale */}
                      <div
                        onClick={() => {
                          setSelectedNodeId(ps.pallet.id);
                          setFocusedBoxId(null);
                        }}
                        className={`px-3 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors group ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={(e) =>
                              toggleExpandPallet(ps.pallet.id, e)
                            }
                            className={`p-0.5 rounded transition-colors ${
                              isSelected
                                ? 'hover:bg-blue-700 text-blue-100'
                                : 'hover:bg-slate-200 text-slate-500'
                            }`}
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>

                          <span
                            className={`font-mono text-xs font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                              isSelected
                                ? 'bg-white text-blue-700'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            }`}
                          >
                            {ps.pallet.code}
                          </span>

                          <div className="truncate flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-xs font-bold truncate ${
                                  isSelected ? 'text-white' : 'text-slate-900'
                                }`}
                              >
                                {ps.pallet.label || 'Bancale'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  setSelectedNodeId(ps.pallet.id);
                                  startEditingPallet(ps.pallet, e);
                                }}
                                title="Rinomina bancale"
                                className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0 ${
                                  isSelected
                                    ? 'text-blue-100 hover:text-white'
                                    : 'text-slate-400 hover:text-blue-600'
                                }`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDuplicatePallet(ps.pallet.id);
                                }}
                                title="Duplica intero bancale (Copia/Incolla)"
                                className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0 ${
                                  isSelected
                                    ? 'text-blue-100 hover:text-white'
                                    : 'text-slate-400 hover:text-indigo-600'
                                }`}
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <span
                              className={`text-[10px] font-mono block ${
                                isSelected ? 'text-blue-100' : 'text-slate-500'
                              }`}
                            >
                              {ps.totalBoxes} scatole ·{' '}
                              {ps.looseItems.length} fuori scatola
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`font-mono text-xs font-extrabold tabular-nums block ${
                              isSelected ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {ps.grossWeightKg.toFixed(0)} kg
                          </span>
                          <span
                            className={`text-[10px] font-semibold block ${
                              ps.pallet.wrapped
                                ? isSelected
                                  ? 'text-emerald-200'
                                  : 'text-emerald-600'
                                : isSelected
                                ? 'text-blue-200'
                                : 'text-slate-400'
                            }`}
                          >
                            {ps.pallet.wrapped ? '✓ Filmato' : 'Aperto'}
                          </span>
                        </div>
                      </div>

                      {/* Sotto-Rami: Scatoloni, Sotto-Scatole e Materiale Fuori Scatola */}
                      {expanded && (
                        <div className="pl-5 pr-2.5 py-2 bg-slate-50/70 border-t border-slate-100 space-y-1.5">
                          {ps.topLevelBoxes.map((bs) => {
                            const isBoxFocused = focusedBoxId === bs.box.id;
                            return (
                              <div key={bs.box.id} className="space-y-1">
                                <div
                                  onClick={() => {
                                    setSelectedNodeId(ps.pallet.id);
                                    setFocusedBoxId(bs.box.id);
                                  }}
                                  className={`tree-branch-line group flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                    isBoxFocused
                                      ? 'bg-amber-50 border-amber-400 text-slate-900 font-bold shadow-2xs'
                                      : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Package className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="font-mono font-bold text-[11px] text-amber-800">
                                      {bs.box.code}
                                    </span>
                                    <span className="truncate text-xs">
                                      {bs.box.label}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                      ({bs.box.dimensionsCm.replace(' cm', '')})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] tabular-nums">
                                    {bs.childBoxes.length > 0 && (
                                      <span className="px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                                        +{bs.childBoxes.length} scat
                                      </span>
                                    )}
                                    <span className="font-bold text-slate-800">
                                      {bs.grossWeightKg.toFixed(1)}kg
                                    </span>
                                    {bs.box.sealed ? (
                                      <Lock className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Unlock className="w-3 h-3 text-slate-400" />
                                    )}
                                  </div>
                                </div>

                                {/* Eventuali Sotto-Scatole dentro questo Scatolone */}
                                {bs.childBoxes.length > 0 && (
                                  <div className="pl-5 space-y-1">
                                    {bs.childBoxes.map((subBs) => (
                                      <div
                                        key={subBs.box.id}
                                        onClick={() => {
                                          setSelectedNodeId(ps.pallet.id);
                                          setFocusedBoxId(subBs.box.id);
                                        }}
                                        className={`flex items-center justify-between px-2 py-1 rounded-md border text-[11px] cursor-pointer ${
                                          focusedBoxId === subBs.box.id
                                            ? 'bg-indigo-50 border-indigo-400 font-bold text-indigo-950'
                                            : 'bg-indigo-50/40 border-indigo-200/70 text-slate-700 hover:bg-indigo-50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5 truncate">
                                          <span className="text-indigo-500 font-mono">
                                            ↳
                                          </span>
                                          <span className="font-mono font-bold text-indigo-800">
                                            {subBs.box.code}
                                          </span>
                                          <span className="truncate">
                                            {subBs.box.label}
                                          </span>
                                        </div>
                                        <span className="font-mono text-[10px] font-bold text-indigo-900 shrink-0">
                                          {subBs.grossWeightKg.toFixed(1)}kg
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Materiale Fuori Scatola sul Bancale */}
                          {ps.looseItems.length > 0 && (
                            <div className="pt-1 space-y-1">
                              <div className="text-[10px] font-bold text-sky-800 uppercase tracking-wider pl-1">
                                Materiale Fuori Scatola ({ps.looseItems.length}):
                              </div>
                              {ps.looseItems.map((li) => (
                                <div
                                  key={li.id}
                                  onClick={() => setSelectedNodeId(ps.pallet.id)}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50/70 text-sky-950 text-xs cursor-pointer"
                                >
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    {li.photoDataUrl ? (
                                      <img
                                        src={li.photoDataUrl}
                                        alt={li.name}
                                        className="w-4 h-4 rounded object-cover shrink-0"
                                      />
                                    ) : (
                                      <Box className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                    )}
                                    <span className="font-mono font-bold text-[10px] text-sky-800">
                                      {li.sku}
                                    </span>
                                    <span className="truncate font-semibold">
                                      {li.name}
                                    </span>
                                  </div>
                                  <span className="font-mono text-[10px] font-bold text-sky-900 shrink-0">
                                    {li.quantity}pz ·{' '}
                                    {(li.quantity * li.unitWeightKg).toFixed(1)}
                                    kg
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {ps.topLevelBoxes.length === 0 &&
                            ps.looseItems.length === 0 && (
                              <div className="text-[11px] text-slate-400 italic py-1 pl-2">
                                Bancale vuoto — Aggiungi scatole o materiale fuori scatola
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                <Layers className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">
                  Nessun Bancale Creato
                </p>
                <p className="text-[11px] text-slate-500">
                  Clicca su &quot;+ Bancale&quot; per iniziare a strutturare il carico.
                </p>
              </div>
            )}

            {/* Nodo Scatole a Terra */}
            {looseBoxes.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNodeId('loose_boxes');
                    setFocusedBoxId(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedNodeId === 'loose_boxes'
                      ? 'bg-amber-600 text-white border-amber-600 font-bold'
                      : 'bg-amber-50/70 border-amber-200 text-amber-950 hover:bg-amber-100/70 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <span className="text-xs">
                      Scatole a Terra (Senza Bancale)
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white/90 text-amber-900">
                    {looseBoxes.length}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* PANNELLO DESTRO (8 COLS): ISPETTORE DETTAGLIO / SCHEMA AD ALBERO CON FOTO */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden shadow-xs">
          {/* Header Ispettore + Toggle Vista Schede / Schema Albero Completo */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/80 space-y-3 shrink-0">
            {selectedPalletSummary ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <PalletGraphic
                    wrapped={selectedPalletSummary.pallet.wrapped}
                    boxCount={selectedPalletSummary.totalBoxes}
                    heightCm={selectedPalletSummary.pallet.heightCm}
                    className="w-14 h-12 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {editingPalletId === selectedPalletSummary.pallet.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          commitEditingPallet(selectedPalletSummary.pallet.id);
                        }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {selectedPalletSummary.pallet.code}
                        </span>
                        <input
                          type="text"
                          autoFocus
                          value={editPalletLabel}
                          onChange={(e) => setEditPalletLabel(e.target.value)}
                          placeholder="Nome bancale..."
                          className="px-2.5 py-1 text-xs font-bold bg-white border border-blue-500 rounded-lg text-slate-900 focus:outline-none w-48"
                        />
                        <select
                          value={editPalletType}
                          onChange={(e) =>
                            setEditPalletType(e.target.value as PalletType)
                          }
                          className="px-2 py-1 text-xs font-mono bg-white border border-slate-300 rounded-lg text-slate-800"
                        >
                          {Object.entries(PALLET_SPECS).map(([k, spec]) => (
                            <option key={k} value={k}>
                              {spec.name}
                            </option>
                          ))}
                        </select>
                        <div className="inline-flex items-center gap-1 text-xs font-mono bg-white border border-slate-300 rounded-lg px-2 py-1">
                          <span className="text-slate-500">H max:</span>
                          <input
                            type="number"
                            min={40}
                            max={260}
                            value={editPalletHeight}
                            onChange={(e) =>
                              setEditPalletHeight(e.target.value)
                            }
                            className="w-12 font-bold text-slate-900 focus:outline-none text-center"
                          />
                          <span className="text-slate-500">cm</span>
                        </div>
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Salva
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPalletId(null)}
                          className="p-1 text-slate-500 hover:text-slate-800 bg-slate-200 rounded-lg cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {selectedPalletSummary.pallet.code}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            startEditingPallet(selectedPalletSummary.pallet)
                          }
                          title="Clicca per modificare il nome o le misure del bancale"
                          className="text-base font-extrabold text-slate-900 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer truncate"
                        >
                          <span className="truncate">
                            {selectedPalletSummary.pallet.label || 'Bancale'}
                          </span>
                          <Pencil className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>
                      </div>
                    )}

                    <div className="text-xs font-mono text-slate-600 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>
                        Formato: {selectedPalletSummary.pallet.dimensionsCm}
                      </span>
                      <span>·</span>
                      <span>H {selectedPalletSummary.pallet.heightCm} cm</span>
                      <span>·</span>
                      <strong className="text-slate-900">
                        Lordo: {selectedPalletSummary.grossWeightKg.toFixed(1)}{' '}
                        / {selectedPalletSummary.pallet.maxWeightKg} kg
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onOpen3DViewForPallet(selectedPalletSummary.pallet.id)
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Box className="w-3.5 h-3.5 text-amber-600" />
                    Vedi in 3D
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onDuplicatePallet(selectedPalletSummary.pallet.id)
                    }
                    title="Duplica questo bancale con tutte le sue scatole e articoli"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplica Bancale
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onTogglePalletWrapped(selectedPalletSummary.pallet.id)
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedPalletSummary.pallet.wrapped
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {selectedPalletSummary.pallet.wrapped
                      ? 'Filmato ✓'
                      : 'Segna Filmato'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDeletePallet(selectedPalletSummary.pallet.id);
                      setSelectedNodeId('all');
                    }}
                    title="Elimina questo bancale"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                    {selectedNodeId === 'loose_boxes'
                      ? 'Scatole a Terra (Non assegnate a un bancale)'
                      : 'Gestione Bancali, Scatoloni, Sotto-Scatole e Materiale Fuori Scatola'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Inserisci misure personalizzate, annida scatole dentro scatoloni, carica foto degli oggetti o duplica con un clic.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Switch Vista Schede / Schema ad Albero / Vista Grafica CAD 3D */}
                  <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300 text-xs">
                    <button
                      type="button"
                      onClick={() => setRightViewMode('cards')}
                      className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        rightViewMode === 'cards'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
                      Schede Operative
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightViewMode('tree_schema')}
                      className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        rightViewMode === 'tree_schema'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                      Schema ad Albero &amp; Foto
                    </button>
                    <button
                      type="button"
                      onClick={() => setRightViewMode('cad_3d')}
                      className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                        rightViewMode === 'cad_3d'
                          ? 'bg-amber-500 text-slate-950 shadow-2xs'
                          : 'text-amber-800 hover:text-amber-950 hover:bg-amber-100/60'
                      }`}
                    >
                      <Box className="w-3.5 h-3.5 text-amber-700" />
                      Vista Grafica CAD 3D
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Barra Creazione Rapida Scatola con Misure L×P×H cm + Scatola Madre */}
            <form
              onSubmit={(e) =>
                handleQuickCreateBox(
                  e,
                  selectedPalletSummary
                    ? selectedPalletSummary.pallet.id
                    : load.pallets[0]?.id || null
                )
              }
              className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center gap-2 text-xs"
            >
              <span className="font-bold text-slate-700 flex items-center gap-1 shrink-0">
                <Package className="w-3.5 h-3.5 text-amber-600" />
                Nuova Scatola:
              </span>
              <input
                type="text"
                required
                placeholder="Nome scatola (es. Scatolone Quadri, Sotto-scatola Viteria)..."
                value={newBoxLabel}
                onChange={(e) => setNewBoxLabel(e.target.value)}
                className="flex-1 min-w-[160px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
              />
              <select
                value={newBoxType}
                onChange={(e) =>
                  handleNewBoxPresetChange(e.target.value as BoxType)
                }
                className="px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 font-mono text-xs"
                title="Formato predefinito o su misura"
              >
                {Object.entries(BOX_SPECS).map(([k, spec]) => (
                  <option key={k} value={k}>
                    {spec.name}
                  </option>
                ))}
              </select>

              {/* Misure Personalizzate L x P x H in cm */}
              <div
                className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs"
                title="Inserisci le dimensioni esatte della scatola in centimetri: Lunghezza × Profondità × Altezza"
              >
                <span className="text-[10px] text-slate-400 font-bold">
                  cm:
                </span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={newBoxL}
                  onChange={(e) => {
                    setNewBoxL(Number(e.target.value));
                    setNewBoxType('PERSONALIZZATA');
                  }}
                  className="w-10 text-center font-bold text-slate-900 focus:outline-none"
                  title="Lunghezza cm"
                />
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={newBoxW}
                  onChange={(e) => {
                    setNewBoxW(Number(e.target.value));
                    setNewBoxType('PERSONALIZZATA');
                  }}
                  className="w-10 text-center font-bold text-slate-900 focus:outline-none"
                  title="Profondità cm"
                />
                <span className="text-slate-400">×</span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={newBoxH}
                  onChange={(e) => {
                    setNewBoxH(Number(e.target.value));
                    setNewBoxType('PERSONALIZZATA');
                  }}
                  className="w-10 text-center font-bold text-slate-900 focus:outline-none"
                  title="Altezza cm"
                />
              </div>

              {/* Opzione: Dentro un'altra Scatola (Scatolone Madre) */}
              {load.boxes.length > 0 && (
                <select
                  value={newBoxParentId}
                  onChange={(e) => setNewBoxParentId(e.target.value)}
                  className="px-2 py-1.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-indigo-950 font-mono text-xs max-w-[185px] truncate"
                  title="Metti questa scatola dentro un'altra scatola più grande"
                >
                  <option value="">Su Bancale (Esterna)</option>
                  {load.boxes
                    .filter((b) => !b.parentBoxId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        Dentro {b.code} ({b.label})
                      </option>
                    ))}
                </select>
              )}

              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 shadow-2xs cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Crea Scatola
              </button>
            </form>
          </div>

          {/* =====================================================================
              CORPO CENTRALE PANNELLO DESTRO: VISTA SCHEMA AD ALBERO OPPURE SCHEDE
          ===================================================================== */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
            {rightViewMode === 'cad_3d' ? (
              <div className="h-[650px] w-full rounded-xl overflow-hidden border border-slate-300 shadow-sm relative">
                <Pallet3DVisualizer
                  key={selectedPalletSummary?.pallet.id || 'all'}
                  load={load}
                  summary={summary}
                  initialPalletId={selectedPalletSummary?.pallet.id || 'all'}
                />
              </div>
            ) : rightViewMode === 'tree_schema' ? (
              /* VISTA SCHEMA AD ALBERO VISUALE COMPLETO CON FOTO OGGETTI */
              <div className="space-y-4">
                {summary.palletSummaries.map((ps) => (
                  <div
                    key={ps.pallet.id}
                    className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-black px-2.5 py-1 rounded-lg bg-indigo-600 text-white">
                          {ps.pallet.code}
                        </span>
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">
                            {ps.pallet.label} ({ps.pallet.dimensionsCm} · H max{' '}
                            {ps.pallet.heightCm} cm)
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {ps.totalBoxes} Scatole · {ps.looseItems.length}{' '}
                            Materiali Fuori Scatola · Peso Lordo{' '}
                            <strong className="text-slate-900">
                              {ps.grossWeightKg.toFixed(1)} kg
                            </strong>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpen3DViewForPallet(ps.pallet.id)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Box className="w-3.5 h-3.5 text-amber-600" />
                        Apri 3D
                      </button>
                    </div>

                    {/* Ramo Scatoloni e Sotto-Scatole */}
                    <div className="pl-4 border-l-2 border-indigo-200 space-y-3">
                      {ps.topLevelBoxes.map((bs) => (
                        <div
                          key={bs.box.id}
                          className="bg-amber-50/40 border border-amber-200 rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-amber-600" />
                              <span className="font-mono text-xs font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                {bs.box.code}
                              </span>
                              <span className="text-xs font-extrabold text-slate-900">
                                {bs.box.label}
                              </span>
                              <span className="text-xs font-mono text-slate-600">
                                ({bs.box.dimensionsCm})
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-900">
                              {bs.grossWeightKg.toFixed(1)} kg
                            </span>
                          </div>

                          {/* Sotto-scatole annidate */}
                          {bs.childBoxes.length > 0 && (
                            <div className="pl-4 border-l-2 border-indigo-300 space-y-2 pt-1">
                              {bs.childBoxes.map((sub) => (
                                <div
                                  key={sub.box.id}
                                  className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-2.5 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-indigo-950 font-mono">
                                      ↳ SOTTO-SCATOLA {sub.box.code} —{' '}
                                      {sub.box.label} ({sub.box.dimensionsCm})
                                    </span>
                                    <span className="font-mono font-bold text-indigo-900">
                                      {sub.grossWeightKg.toFixed(1)} kg
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-3">
                                    {sub.items.map((it) => (
                                      <div
                                        key={it.id}
                                        className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-indigo-100 text-xs"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {it.photoDataUrl ? (
                                            <img
                                              src={it.photoDataUrl}
                                              alt={it.name}
                                              onClick={() =>
                                                setPreviewPhotoItem(it)
                                              }
                                              className="w-7 h-7 rounded object-cover border border-slate-300 cursor-pointer shrink-0"
                                            />
                                          ) : (
                                            <label className="w-7 h-7 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer shrink-0">
                                              <Camera className="w-3.5 h-3.5" />
                                              <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) =>
                                                  handleItemPhotoUpload(
                                                    it.id,
                                                    e
                                                  )
                                                }
                                                className="hidden"
                                              />
                                            </label>
                                          )}
                                          <span className="truncate font-semibold text-slate-800">
                                            {it.sku} · {it.name}
                                          </span>
                                        </div>
                                        <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                                          {it.quantity} pz
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Oggetti diretti nello scatolone */}
                          {bs.items.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4 pt-1">
                              {bs.items.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {it.photoDataUrl ? (
                                      <img
                                        src={it.photoDataUrl}
                                        alt={it.name}
                                        onClick={() => setPreviewPhotoItem(it)}
                                        className="w-8 h-8 rounded object-cover border border-slate-300 cursor-pointer shrink-0"
                                      />
                                    ) : (
                                      <label
                                        title="Carica foto oggetto"
                                        className="w-8 h-8 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer shrink-0"
                                      >
                                        <Camera className="w-3.5 h-3.5" />
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) =>
                                            handleItemPhotoUpload(it.id, e)
                                          }
                                          className="hidden"
                                        />
                                      </label>
                                    )}
                                    <div className="truncate">
                                      <div className="font-mono text-[10px] font-bold text-slate-500">
                                        {it.sku}
                                      </div>
                                      <div className="font-semibold text-slate-900 truncate">
                                        {it.name}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 shrink-0 ml-2">
                                    {it.quantity} pz
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Ramo Materiale Fuori Scatola sul Bancale */}
                      {ps.looseItems.length > 0 && (
                        <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-2">
                          <div className="text-xs font-extrabold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                            <Box className="w-4 h-4 text-sky-600" />
                            Materiale Fuori Scatola posizionato su{' '}
                            {ps.pallet.code}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ps.looseItems.map((li) => (
                              <div
                                key={li.id}
                                className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-sky-200 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {li.photoDataUrl ? (
                                    <img
                                      src={li.photoDataUrl}
                                      alt={li.name}
                                      onClick={() => setPreviewPhotoItem(li)}
                                      className="w-8 h-8 rounded object-cover border border-slate-300 cursor-pointer shrink-0"
                                    />
                                  ) : (
                                    <label className="w-8 h-8 rounded border border-dashed border-sky-300 flex items-center justify-center text-sky-500 cursor-pointer shrink-0">
                                      <Camera className="w-3.5 h-3.5" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handleItemPhotoUpload(li.id, e)
                                        }
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                  <div className="truncate">
                                    <div className="font-mono text-[10px] font-bold text-sky-700">
                                      {li.sku} ·{' '}
                                      {li.dimensionsCm || '45×35×30 cm'}
                                    </div>
                                    <div className="font-bold text-slate-900 truncate">
                                      {li.name}
                                    </div>
                                  </div>
                                </div>
                                <span className="font-mono font-bold text-sky-900 shrink-0 ml-2">
                                  {li.quantity} pz (
                                  {(li.quantity * li.unitWeightKg).toFixed(1)}{' '}
                                  kg)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* VISTA SCHEDE OPERATIVE SCATOLE + SEZIONE MATERIALE FUORI SCATOLA */
              <>
                {/* BANNER RAPIDO VISTA GRAFICA CAD 3D */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Visualizzazione Grafica CAD 3D del Bancale
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Clicca qui per vedere in 3D le scatole e il materiale posizionati sul bancale invece delle sole schede scritte.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRightViewMode('cad_3d')}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                  >
                    <Box className="w-3.5 h-3.5" />
                    Mostra Bancale in Grafica 3D
                  </button>
                </div>

                {/* SEZIONE MATERIALE FUORI SCATOLA SUL BANCALE SELEZIONATO */}
                {(selectedPalletSummary ||
                  summary.palletSummaries.some(
                    (ps) => ps.looseItems.length > 0
                  )) &&
                  selectedNodeId !== 'loose_boxes' && (
                    <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Box className="w-4 h-4 text-sky-600" />
                          <span className="text-xs font-extrabold text-sky-950 uppercase tracking-wider">
                            Materiale Fuori Scatola (Colli Sciolti Diretti su Bancale)
                          </span>
                        </div>
                        {(selectedPalletSummary || load.pallets.length > 0) && (
                          <button
                            type="button"
                            onClick={() =>
                              setShowAddLooseForm((prev) => !prev)
                            }
                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Aggiungi Materiale Fuori Scatola
                          </button>
                        )}
                      </div>

                      {showAddLooseForm && (
                        <form
                          onSubmit={(e) =>
                            handleQuickAddLooseSubmit(
                              e,
                              selectedPalletSummary?.pallet.id ||
                                load.pallets[0]?.id ||
                                ''
                            )
                          }
                          className="bg-white p-3 rounded-lg border border-sky-200 flex flex-wrap items-center gap-2 text-xs"
                        >
                          <input
                            type="text"
                            required
                            value={looseName}
                            onChange={(e) => setLooseName(e.target.value)}
                            placeholder="Descrizione materiale fuori scatola (es. Motore su sella, Tubazione)..."
                            className="flex-1 min-w-[180px] px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                          />
                          <input
                            type="text"
                            value={looseDim}
                            onChange={(e) => setLooseDim(e.target.value)}
                            placeholder="Misure (es. 70×50×45 cm)"
                            className="w-36 px-2.5 py-1.5 font-mono bg-slate-50 border border-slate-300 rounded-lg"
                          />
                          <input
                            type="number"
                            min={1}
                            value={looseQty}
                            onChange={(e) =>
                              setLooseQty(Number(e.target.value))
                            }
                            className="w-16 px-2 py-1.5 font-mono text-center bg-slate-50 border border-slate-300 rounded-lg"
                            title="Quantità"
                          />
                          <input
                            type="number"
                            min={0.1}
                            step={0.5}
                            value={looseWeight}
                            onChange={(e) =>
                              setLooseWeight(Number(e.target.value))
                            }
                            className="w-20 px-2 py-1.5 font-mono text-center bg-slate-50 border border-slate-300 rounded-lg"
                            title="Peso unitario kg"
                          />
                          <label className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg font-bold flex items-center gap-1 cursor-pointer">
                            <Camera className="w-3.5 h-3.5 text-slate-600" />
                            <span>{loosePhoto ? 'Foto ✓' : 'Foto'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  const d = await compressImageFileToDataUrl(f);
                                  setLoosePhoto(d);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-sky-600 text-white font-bold rounded-lg cursor-pointer"
                          >
                            Salva su Bancale
                          </button>
                        </form>
                      )}

                      {(() => {
                        const looseList = selectedPalletSummary
                          ? selectedPalletSummary.looseItems.map((li) => ({
                              li,
                              palCode: selectedPalletSummary.pallet.code,
                            }))
                          : summary.palletSummaries.flatMap((ps) =>
                              ps.looseItems.map((li) => ({
                                li,
                                palCode: ps.pallet.code,
                              }))
                            );

                        if (looseList.length === 0) {
                          return (
                            <p className="text-[11px] text-sky-800/80 italic">
                              Nessun materiale fuori scatola su questo bancale. Clicca su &quot;+ Aggiungi Materiale Fuori Scatola&quot; per posizionare colli sciolti direttamente sulla pedana.
                            </p>
                          );
                        }

                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {looseList.map(({ li, palCode }) => (
                              <div
                                key={li.id}
                                className="bg-white border border-sky-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-xs shadow-2xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {li.photoDataUrl ? (
                                    <img
                                      src={li.photoDataUrl}
                                      alt={li.name}
                                      onClick={() => setPreviewPhotoItem(li)}
                                      className="w-9 h-9 rounded-lg object-cover border border-slate-300 cursor-pointer shrink-0"
                                    />
                                  ) : (
                                    <label
                                      title="Carica foto"
                                      className="w-9 h-9 rounded-lg border border-dashed border-sky-300 flex items-center justify-center text-sky-500 hover:bg-sky-50 cursor-pointer shrink-0"
                                    >
                                      <Camera className="w-4 h-4" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) =>
                                          handleItemPhotoUpload(li.id, e)
                                        }
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                  <div className="truncate">
                                    <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-sky-700">
                                      <span>Su {palCode}</span>
                                      <span>·</span>
                                      <span>{li.sku}</span>
                                      <span>·</span>
                                      <span>
                                        {li.dimensionsCm || '45×35×30 cm'}
                                      </span>
                                    </div>
                                    <div className="font-bold text-slate-900 truncate">
                                      {li.name}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                                  <span className="font-bold text-slate-900">
                                    {li.quantity} pz (
                                    {(li.quantity * li.unitWeightKg).toFixed(1)}
                                    kg)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onDuplicateItem(li.id)}
                                    title="Duplica materiale fuori scatola"
                                    className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onAssignItemLocation(li.id, null, null)
                                    }
                                    title="Scollega dal bancale"
                                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                {/* LISTA SCHEDE SCATOLE (Con Misure Personalizzabili, Sotto-Scatole, Foto e Duplica) */}
                {(() => {
                  const boxesToRender: Array<{
                    bs: BoxSummary;
                    palletCode: string;
                    palletId: string | null;
                  }> =
                    selectedNodeId === 'loose_boxes'
                      ? looseBoxes.map((bs) => ({
                          bs,
                          palletCode: 'A TERRA',
                          palletId: null,
                        }))
                      : selectedPalletSummary
                      ? selectedPalletSummary.boxes.map((bs) => ({
                          bs,
                          palletCode: selectedPalletSummary.pallet.code,
                          palletId: selectedPalletSummary.pallet.id,
                        }))
                      : [
                          ...summary.palletSummaries.flatMap((ps) =>
                            ps.boxes.map((bs) => ({
                              bs,
                              palletCode: ps.pallet.code,
                              palletId: ps.pallet.id,
                            }))
                          ),
                          ...looseBoxes.map((bs) => ({
                            bs,
                            palletCode: 'A TERRA',
                            palletId: null,
                          })),
                        ];

                  if (boxesToRender.length === 0) {
                    return (
                      <div className="h-full flex flex-col items-center justify-center py-12 text-center text-slate-400">
                        <Package className="w-12 h-12 text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-700">
                          Nessuna scatola presente in questa vista
                        </p>
                        <p className="text-xs text-slate-500 mt-1 max-w-md">
                          Usa la barra &quot;Nuova Scatola&quot; qui sopra per creare una scatola con le tue misure in cm o clicca su &quot;Kit&quot; per generare più scatole uguali.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {boxesToRender.map(({ bs, palletCode, palletId }) => {
                        const isHighlighted = focusedBoxId === bs.box.id;
                        const maxW = bs.box.maxWeightKg || 30;
                        const weightPct = Math.min(
                          100,
                          Math.round((bs.grossWeightKg / maxW) * 100)
                        );
                        const isEditingThisBox = editingBoxId === bs.box.id;
                        const parentBoxObj = bs.box.parentBoxId
                          ? load.boxes.find((b) => b.id === bs.box.parentBoxId)
                          : null;

                        return (
                          <div
                            key={bs.box.id}
                            className={`bg-white rounded-xl border transition-all p-4 flex flex-col justify-between space-y-3 shadow-2xs ${
                              isHighlighted
                                ? 'border-amber-500 ring-2 ring-amber-500/20'
                                : parentBoxObj
                                ? 'border-indigo-300 bg-indigo-50/15'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="space-y-3">
                              {/* Box Card Header */}
                              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <BoxGraphic
                                    sealed={bs.box.sealed}
                                    fragile={bs.box.fragile}
                                    className="w-11 h-10 shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    {isEditingThisBox ? (
                                      <form
                                        onSubmit={(e) => {
                                          e.preventDefault();
                                          commitEditingBox(bs.box.id);
                                        }}
                                        className="space-y-2 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono text-xs font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                            {bs.box.code}
                                          </span>
                                          <input
                                            type="text"
                                            autoFocus
                                            value={editBoxLabel}
                                            onChange={(e) =>
                                              setEditBoxLabel(e.target.value)
                                            }
                                            placeholder="Nome scatola..."
                                            className="flex-1 min-w-0 px-2 py-1 text-xs font-bold bg-white border border-blue-500 rounded text-slate-900 focus:outline-none"
                                          />
                                        </div>

                                        {/* Misure L x P x H personalizzate */}
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                          <span className="text-[11px] font-bold text-slate-600">
                                            Misure cm (L×P×H):
                                          </span>
                                          <input
                                            type="number"
                                            min={10}
                                            max={300}
                                            value={editBoxL}
                                            onChange={(e) => {
                                              setEditBoxL(
                                                Number(e.target.value)
                                              );
                                              setEditBoxType('PERSONALIZZATA');
                                            }}
                                            className="w-12 px-1 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded"
                                          />
                                          <span>×</span>
                                          <input
                                            type="number"
                                            min={10}
                                            max={300}
                                            value={editBoxW}
                                            onChange={(e) => {
                                              setEditBoxW(
                                                Number(e.target.value)
                                              );
                                              setEditBoxType('PERSONALIZZATA');
                                            }}
                                            className="w-12 px-1 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded"
                                          />
                                          <span>×</span>
                                          <input
                                            type="number"
                                            min={10}
                                            max={300}
                                            value={editBoxH}
                                            onChange={(e) => {
                                              setEditBoxH(
                                                Number(e.target.value)
                                              );
                                              setEditBoxType('PERSONALIZZATA');
                                            }}
                                            className="w-12 px-1 py-0.5 text-center font-mono font-bold bg-white border border-slate-300 rounded"
                                          />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                          <select
                                            value={editBoxParentId}
                                            onChange={(e) =>
                                              setEditBoxParentId(e.target.value)
                                            }
                                            className="px-2 py-1 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-800"
                                          >
                                            <option value="">
                                              Esterna (Su Bancale)
                                            </option>
                                            {load.boxes
                                              .filter(
                                                (b) =>
                                                  b.id !== bs.box.id &&
                                                  b.parentBoxId !== bs.box.id
                                              )
                                              .map((b) => (
                                                <option key={b.id} value={b.id}>
                                                  Dentro {b.code} ({b.label})
                                                </option>
                                              ))}
                                          </select>

                                          <label className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 px-1.5 py-0.5 bg-white rounded border border-rose-200 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={editBoxFragile}
                                              onChange={(e) =>
                                                setEditBoxFragile(
                                                  e.target.checked
                                                )
                                              }
                                              className="rounded border-rose-300"
                                            />
                                            <span>Fragile</span>
                                          </label>
                                          <button
                                            type="submit"
                                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-[11px] flex items-center gap-1 cursor-pointer"
                                          >
                                            <Check className="w-3 h-3" />
                                            Salva
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingBoxId(null)
                                            }
                                            className="p-1 text-slate-500 hover:text-slate-800 bg-slate-200 rounded cursor-pointer"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                            {bs.box.code}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              startEditingBox(bs.box)
                                            }
                                            title="Clicca per modificare nome, dimensioni in cm o scatola madre"
                                            className="font-bold text-slate-900 hover:text-blue-700 text-sm flex items-center gap-1 cursor-pointer text-left"
                                          >
                                            <span>{bs.box.label}</span>
                                            <Pencil className="w-3 h-3 text-slate-400 shrink-0" />
                                          </button>
                                          {parentBoxObj && (
                                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-300">
                                              Dentro {parentBoxObj.code}
                                            </span>
                                          )}
                                          {bs.box.fragile && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                              FRAGILE
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              startEditingBox(bs.box)
                                            }
                                            className="hover:text-blue-600 underline decoration-dotted cursor-pointer"
                                            title="Clicca per cambiare le dimensioni in cm"
                                          >
                                            📏 {bs.box.dimensionsCm}
                                          </button>
                                          <span>·</span>
                                          <strong className="text-slate-900">
                                            Lordo: {bs.grossWeightKg.toFixed(1)}{' '}
                                            kg
                                          </strong>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Azioni Scatola: Duplica, Modifica, Sposta, Sigilla, Elimina */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => onDuplicateBox(bs.box.id)}
                                    title="Duplica questa scatola con tutti i suoi articoli (Copia e Incolla)"
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => startEditingBox(bs.box)}
                                    title="Modifica nome, dimensioni cm o scatola madre"
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>

                                  <select
                                    aria-label="Bancale assegnato"
                                    value={
                                      bs.box.parentBoxId
                                        ? `box:${bs.box.parentBoxId}`
                                        : bs.box.palletId || ''
                                    }
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val.startsWith('box:')) {
                                        const pbId = val.replace('box:', '');
                                        const pb = load.boxes.find(
                                          (b) => b.id === pbId
                                        );
                                        onMoveBoxToPallet(
                                          bs.box.id,
                                          pb?.palletId || bs.box.palletId,
                                          pbId
                                        );
                                      } else {
                                        onMoveBoxToPallet(
                                          bs.box.id,
                                          val || null,
                                          null
                                        );
                                      }
                                    }}
                                    className="px-1.5 py-1 text-[11px] font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg text-slate-700 max-w-[115px] truncate"
                                    title="Sposta su altro bancale o dentro un'altra scatola"
                                  >
                                    <option value="">A Terra</option>
                                    <optgroup label="Su Bancale">
                                      {load.pallets.map((p) => (
                                        <option key={p.id} value={p.id}>
                                          Su {p.code}
                                        </option>
                                      ))}
                                    </optgroup>
                                    {load.boxes.filter(
                                      (b) =>
                                        b.id !== bs.box.id &&
                                        b.parentBoxId !== bs.box.id
                                    ).length > 0 && (
                                      <optgroup label="Dentro Scatolone">
                                        {load.boxes
                                          .filter(
                                            (b) =>
                                              b.id !== bs.box.id &&
                                              b.parentBoxId !== bs.box.id
                                          )
                                          .map((b) => (
                                            <option
                                              key={b.id}
                                              value={`box:${b.id}`}
                                            >
                                              In {b.code} ({b.label})
                                            </option>
                                          ))}
                                      </optgroup>
                                    )}
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => onToggleBoxSealed(bs.box.id)}
                                    className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                                      bs.box.sealed
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                        : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                                    }`}
                                  >
                                    {bs.box.sealed ? (
                                      <Lock className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Unlock className="w-3 h-3" />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onDeleteBox(bs.box.id)}
                                    title="Elimina scatola"
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Eventuali Sotto-Scatole contenute dentro questa scatola */}
                              {bs.childBoxes.length > 0 && (
                                <div className="bg-indigo-50/70 border border-indigo-200 rounded-lg p-2.5 space-y-1.5">
                                  <div className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider">
                                    Scatole Interne Contenute (
                                    {bs.childBoxes.length}):
                                  </div>
                                  {bs.childBoxes.map((cb) => (
                                    <div
                                      key={cb.box.id}
                                      onClick={() => setFocusedBoxId(cb.box.id)}
                                      className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-indigo-200 text-xs cursor-pointer hover:border-indigo-400"
                                    >
                                      <span className="font-mono font-bold text-indigo-800 truncate">
                                        📦 {cb.box.code} — {cb.box.label} (
                                        {cb.box.dimensionsCm})
                                      </span>
                                      <span className="font-mono font-bold text-slate-800 shrink-0">
                                        {cb.totalPieces} pz ·{' '}
                                        {cb.grossWeightKg.toFixed(1)} kg
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Barra Capacità Peso Scatola */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                                  <span>
                                    Carico totale: {bs.totalPieces} pz (
                                    {weightPct}%)
                                  </span>
                                  <span>Max {maxW} kg</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${weightPct}%` }}
                                    className={`h-full transition-all ${
                                      weightPct > 95
                                        ? 'bg-rose-500'
                                        : weightPct > 75
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                  />
                                </div>
                              </div>

                              {/* Lista Articoli dentro la Scatola (con Foto e Duplica) */}
                              <div className="bg-slate-50 rounded-lg border border-slate-200/80 divide-y divide-slate-200/60 max-h-48 overflow-y-auto">
                                {bs.items.length > 0 ? (
                                  bs.items.map((item) => {
                                    const isEditingThisItem =
                                      editingItemId === item.id;
                                    return (
                                      <div
                                        key={item.id}
                                        className="px-2.5 py-1.5 flex items-center justify-between gap-2 text-xs hover:bg-white transition-colors group/item"
                                      >
                                        {isEditingThisItem ? (
                                          <form
                                            onSubmit={(e) => {
                                              e.preventDefault();
                                              commitEditingItem(item.id);
                                            }}
                                            className="flex items-center gap-1.5 flex-1 min-w-0"
                                          >
                                            <input
                                              type="text"
                                              value={editItemSku}
                                              onChange={(e) =>
                                                setEditItemSku(e.target.value)
                                              }
                                              className="w-18 px-1.5 py-0.5 font-mono text-[11px] bg-white border border-blue-500 rounded text-slate-900 focus:outline-none"
                                            />
                                            <input
                                              type="text"
                                              autoFocus
                                              value={editItemName}
                                              onChange={(e) =>
                                                setEditItemName(e.target.value)
                                              }
                                              placeholder="Nome articolo..."
                                              className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-white border border-blue-500 rounded text-slate-900 focus:outline-none"
                                            />
                                            <button
                                              type="submit"
                                              className="p-1 bg-emerald-600 text-white rounded cursor-pointer"
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setEditingItemId(null)
                                              }
                                              className="p-1 bg-slate-200 text-slate-600 rounded cursor-pointer"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </form>
                                        ) : (
                                          <div className="flex items-center gap-2 text-left min-w-0 flex-1">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onToggleItemChecked(item.id)
                                              }
                                              className="cursor-pointer shrink-0"
                                            >
                                              {item.checked ? (
                                                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                              ) : (
                                                <Square className="w-3.5 h-3.5 text-slate-400" />
                                              )}
                                            </button>

                                            {/* Miniatura Foto o Pulsante Carica Foto */}
                                            {item.photoDataUrl ? (
                                              <img
                                                src={item.photoDataUrl}
                                                alt={item.name}
                                                onClick={() =>
                                                  setPreviewPhotoItem(item)
                                                }
                                                title="Clicca per ingrandire foto"
                                                className="w-6 h-6 rounded object-cover border border-slate-300 cursor-pointer shrink-0"
                                              />
                                            ) : (
                                              <label
                                                title="Carica foto di questo oggetto"
                                                className="w-6 h-6 rounded border border-dashed border-slate-300 hover:border-blue-500 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer shrink-0"
                                              >
                                                <Camera className="w-3 h-3" />
                                                <input
                                                  type="file"
                                                  accept="image/*"
                                                  onChange={(e) =>
                                                    handleItemPhotoUpload(
                                                      item.id,
                                                      e
                                                    )
                                                  }
                                                  className="hidden"
                                                />
                                              </label>
                                            )}

                                            <span className="font-mono text-[10px] font-bold text-slate-500 shrink-0">
                                              {item.sku}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                startEditingItem(item)
                                              }
                                              title="Clicca per rinominare"
                                              className={`truncate font-medium text-left hover:text-blue-700 flex items-center gap-1 cursor-pointer ${
                                                item.checked
                                                  ? 'line-through text-slate-400'
                                                  : 'text-slate-800'
                                              }`}
                                            >
                                              <span className="truncate">
                                                {item.name}
                                              </span>
                                            </button>
                                          </div>
                                        )}

                                        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[11px] tabular-nums">
                                          <span className="font-bold text-slate-900">
                                            {item.quantity} pz
                                          </span>
                                          <span className="text-slate-500">
                                            {(
                                              item.quantity * item.unitWeightKg
                                            ).toFixed(1)}
                                            kg
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onDuplicateItem(item.id)
                                            }
                                            title="Duplica questo oggetto"
                                            className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                                          >
                                            <Copy className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              startEditingItem(item)
                                            }
                                            title="Modifica nome"
                                            className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onAssignItemLocation(
                                                item.id,
                                                null,
                                                null
                                              )
                                            }
                                            title="Rimuovi dalla scatola"
                                            className="text-slate-400 hover:text-rose-600 px-1 cursor-pointer"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="py-4 text-center text-[11px] text-slate-400 italic">
                                    Scatola vuota — Aggiungi oggetti o sotto-scatole
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Footer Scatola: Assegna articolo o crea nuovo articolo con foto nella scatola */}
                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                              {activeQuickBoxId === bs.box.id ? (
                                <form
                                  onSubmit={(e) =>
                                    handleQuickAddItemSubmit(
                                      e,
                                      palletId,
                                      bs.box.id
                                    )
                                  }
                                  className="flex items-center gap-1.5 text-xs"
                                >
                                  <input
                                    type="text"
                                    required
                                    placeholder="Nome oggetto..."
                                    value={quickItemName}
                                    onChange={(e) =>
                                      setQuickItemName(e.target.value)
                                    }
                                    className="flex-1 min-w-0 px-2 py-1 bg-white border border-slate-300 rounded text-xs"
                                  />
                                  <input
                                    type="number"
                                    min={1}
                                    value={quickItemQty}
                                    onChange={(e) =>
                                      setQuickItemQty(Number(e.target.value))
                                    }
                                    className="w-12 px-1 py-1 font-mono text-center bg-white border border-slate-300 rounded text-xs"
                                    title="Quantità"
                                  />
                                  <label
                                    title="Carica foto"
                                    className="p-1.5 bg-slate-100 hover:bg-blue-50 border border-slate-300 rounded cursor-pointer"
                                  >
                                    <Camera className="w-3.5 h-3.5 text-slate-600" />
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={async (e) => {
                                        const f = e.target.files?.[0];
                                        if (f) {
                                          const d =
                                            await compressImageFileToDataUrl(f);
                                          setQuickItemPhoto(d);
                                        }
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                  <button
                                    type="submit"
                                    className="px-2.5 py-1 bg-blue-600 text-white font-bold rounded text-xs cursor-pointer"
                                  >
                                    Salva
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveQuickBoxId(null)}
                                    className="px-1.5 py-1 text-slate-500 text-xs cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </form>
                              ) : (
                                <div className="flex items-center justify-between gap-2">
                                  {summary.unassignedItems.length > 0 ? (
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        const itemId = e.target.value;
                                        if (itemId) {
                                          onAssignItemLocation(
                                            itemId,
                                            palletId,
                                            bs.box.id
                                          );
                                        }
                                      }}
                                      className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-amber-50 border border-amber-300 rounded-lg text-amber-950 font-semibold truncate cursor-pointer"
                                    >
                                      <option value="">
                                        + Inserisci da smistare (
                                        {summary.unassignedItems.length})...
                                      </option>
                                      {summary.unassignedItems.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.sku} — {u.name} ({u.quantity} pz)
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 font-mono">
                                      Bancale: {palletCode}
                                    </span>
                                  )}

                                  <div className="flex items-center gap-1">
                                    {!bs.box.parentBoxId && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewBoxParentId(bs.box.id);
                                          setNewBoxL(30);
                                          setNewBoxW(20);
                                          setNewBoxH(20);
                                          setNewBoxType('PERSONALIZZATA');
                                        }}
                                        title="Crea una scatola interna dentro questo scatolone"
                                        className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                                      >
                                        + Sotto-Scatola
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveQuickBoxId(bs.box.id)
                                      }
                                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors shrink-0 cursor-pointer"
                                    >
                                      + Oggetto Qui
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>

      {/* LIGHTBOX ANTEPRIMA FOTO */}
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
              <div className="space-y-3">
                <img
                  src={previewPhotoItem.photoDataUrl}
                  alt={previewPhotoItem.name}
                  className="w-full max-h-80 object-contain rounded-xl bg-slate-900 border border-slate-200 shadow-inner"
                />
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateItemDetails(previewPhotoItem.id, { photoDataUrl: undefined });
                      setPreviewPhotoItem(null);
                    }}
                    className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Rimuovi Foto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoEditorItem({
                        id: previewPhotoItem.id,
                        dataUrl: previewPhotoItem.photoDataUrl || '',
                        name: previewPhotoItem.name,
                      });
                      setPreviewPhotoItem(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifica / Ruota Foto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE CREAZIONE NUOVO BANCALE */}
      {showAddPalletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 uppercase">
                <Layers className="w-4 h-4 text-blue-600" />
                Nuovo Bancale di Spedizione
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPalletModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Chiudi
              </button>
            </div>

            <form
              onSubmit={handleCreatePallet}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome / Identificativo Bancale *
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. Bancale Quadri Elettrici / Ricambi"
                  value={newPalletLabel}
                  onChange={(e) => setNewPalletLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Formato Pedana
                  </label>
                  <select
                    value={newPalletType}
                    onChange={(e) =>
                      setNewPalletType(e.target.value as PalletType)
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-mono"
                  >
                    {Object.entries(PALLET_SPECS).map(([k, spec]) => (
                      <option key={k} value={k}>
                        {spec.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Altezza Utile (cm)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={260}
                    value={newPalletHeight}
                    onChange={(e) => setNewPalletHeight(Number(e.target.value))}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Note Operatore (Opzionale)
                </label>
                <input
                  type="text"
                  placeholder="es. Non sovrapporre, reggiare con angolari..."
                  value={newPalletNotes}
                  onChange={(e) => setNewPalletNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddPalletModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Crea Bancale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE EDITOR FOTO COLLI / ARTICOLI */}
      {photoEditorItem && (
        <ImageEditorModal
          initialImageDataUrl={photoEditorItem.dataUrl}
          itemTitle={photoEditorItem.name}
          onSave={(editedDataUrl) => {
            onUpdateItemDetails(photoEditorItem.id, { photoDataUrl: editedDataUrl });
            setPhotoEditorItem(null);
          }}
          onClose={() => setPhotoEditorItem(null)}
        />
      )}
    </div>
  );
};
