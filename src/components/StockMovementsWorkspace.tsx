import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  Search,
  RotateCcw,
  Trash2,
  Pencil,
  Download,
  ExternalLink,
  FileSpreadsheet,
  AlertTriangle,
  PackagePlus,
  X,
  Check,
  History,
  Boxes,
  ArrowLeftRight,
  ShieldCheck,
  FolderOpen,
  ChevronRight,
  ChevronLeft,
  Camera,
} from 'lucide-react';
import {
  CargoLoad,
  PackageVerificationProof,
  ShipmentHandoverProof,
  StockMovement,
  StockMovementType,
  WarehouseInventoryState,
  WarehouseStockItem,
} from '../types/warehouse';
import { LoadSummary } from '../utils/calculations';
import {
  generateInventoryReportPDF,
  openPdfBlobInNewTab,
} from '../utils/pdfGenerator';
import { PackingProofPanel } from './PackingProofPanel';

interface StockMovementsWorkspaceProps {
  inventory: WarehouseInventoryState;
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  summary: LoadSummary;
  autoSyncStockWithPacking: boolean;
  onToggleAutoSyncStockWithPacking: (enabled: boolean) => void;
  onUpdateInventory: (next: WarehouseInventoryState, notice?: string) => void;
  onCertifyPackageAndUnload: (
    proof: PackageVerificationProof,
    options: { autoUnloadStock: boolean }
  ) => void;
  onBatchUnloadCheckedItems: (operatorName: string) => void;
  onSaveHandoverProof: (handover: ShipmentHandoverProof) => void;
  onOpenCommessaPhotos?: (commessaId: string) => void;
}

type WorkspaceSection =
  | 'commesse'
  | 'giacenze'
  | 'movimenti'
  | 'sotto_scorta'
  | 'prove_101';

const CATEGORIES = [
  'Carpenteria',
  'Elettrico',
  'Ferramenta',
  'Verniciatura',
  'Imballo',
  'Ricambi',
  'Consumabili',
  'Generale',
];

const UNITS = ['pz', 'kg', 'm', 'lt', 'cf', 'rotoli', 'bancali'];

const CARICO_REASONS = [
  'Acquisto / DDT Fornitore',
  'Rientro da Verniciatura / Zincatura',
  'Reso da Cantiere / Commessa',
  'Produzione Interna',
  'Rettifica Inventario (+)',
];

const SCARICO_REASONS = [
  'Prelievo per Commessa',
  'Spedizione Cliente',
  'Invio in Verniciatura / Zincatura',
  'Consumo Officina / Reparto',
  'Scarto / Danneggiato',
  'Rettifica Inventario (-)',
];

interface CommessaLedgerSummary {
  code: string;
  load: CargoLoad | null;
  title: string;
  client: string;
  destination: string;
  movements: StockMovement[];
  outMovements: StockMovement[];
  inMovements: StockMovement[];
  totalOutQty: number;
  totalInQty: number;
  lastTimestamp: string | null;
  proofCount: number;
  totalBoxes: number;
}

export const StockMovementsWorkspace: React.FC<StockMovementsWorkspaceProps> = ({
  inventory,
  loads,
  activeLoad,
  summary,
  autoSyncStockWithPacking,
  onToggleAutoSyncStockWithPacking,
  onUpdateInventory,
  onCertifyPackageAndUnload,
  onBatchUnloadCheckedItems,
  onSaveHandoverProof,
  onOpenCommessaPhotos,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceSection>('commesse');

  // Commesse Drilldown State
  const [selectedCommessaCode, setSelectedCommessaCode] = useState<string | null>(null);
  const [commessaSearch, setCommessaSearch] = useState<string>('');
  const [commessaListFilter, setCommessaListFilter] = useState<'all' | 'out' | 'in'>('all');
  const [commessaDetailFilter, setCommessaDetailFilter] = useState<
    'all' | 'scarico' | 'carico' | 'planned'
  >('all');

  // Modal Registrazione Movimento (Carico / Scarico) — pulito, su richiesta
  const [showMoveModal, setShowMoveModal] = useState<boolean>(false);
  const [movementType, setMovementType] = useState<StockMovementType>('scarico');
  const [selectedItemId, setSelectedItemId] = useState<string>(
    inventory.items[0]?.id || ''
  );
  const [moveQty, setMoveQty] = useState<string>('1');
  const [moveReason, setMoveReason] = useState<string>(SCARICO_REASONS[0]);
  const [moveCommessa, setMoveCommessa] = useState<string>(activeLoad.code || '');
  const [moveDocRef, setMoveDocRef] = useState<string>('');
  const [moveOperator, setMoveOperator] = useState<string>('Magazziniere');
  const [moveNotes, setMoveNotes] = useState<string>('');
  const [formFeedback, setFormFeedback] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);

  // Filters Giacenze / Movimenti
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Tutte');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'carico' | 'scarico'>('all');
  const [commessaFilter, setCommessaFilter] = useState<string>('all');

  // Create / Edit Item Modal
  const [itemModalMode, setItemModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemSku, setItemSku] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Generale');
  const [itemUnit, setItemUnit] = useState('pz');
  const [itemInitialQty, setItemInitialQty] = useState('0');
  const [itemMinStock, setItemMinStock] = useState('5');
  const [itemLocation, setItemLocation] = useState('');
  const [itemSupplier, setItemSupplier] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  // Inline confirmation states (no window.confirm)
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  const [confirmReverseMovId, setConfirmReverseMovId] = useState<string | null>(null);
  const [confirmDeleteCommessaCode, setConfirmDeleteCommessaCode] = useState<string | null>(
    null
  );
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => inventory.items.find((it) => it.id === selectedItemId) || inventory.items[0] || null,
    [inventory.items, selectedItemId]
  );

  // Metriche globali magazzino
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMovements = inventory.movements.filter((m) =>
      m.timestamp.startsWith(todayStr)
    );
    const lowStockItems = inventory.items.filter((i) => i.quantity <= i.minStock);
    return {
      totalItems: inventory.items.length,
      lowStockCount: lowStockItems.length,
      todayCount: todayMovements.length,
      totalCarichiToday: todayMovements.filter((m) => m.type === 'carico').length,
      totalScarichiToday: todayMovements.filter((m) => m.type === 'scarico').length,
    };
  }, [inventory]);

  const hiddenCommessaSet = useMemo(
    () =>
      new Set(
        (inventory.hiddenCommessaCodes || [])
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean)
      ),
    [inventory.hiddenCommessaCodes]
  );

  // Riepilogo completo di TUTTE le commesse (da CaricoStudio + da movimenti storici), escluse quelle rimosse solo da Carico / Scarico
  const commessaSummaries = useMemo<CommessaLedgerSummary[]>(() => {
    const map = new Map<string, CommessaLedgerSummary>();

    loads.forEach((ld) => {
      const codeKey = (ld.code || ld.id).trim().toUpperCase();
      if (hiddenCommessaSet.has(codeKey)) return;
      map.set(codeKey, {
        code: ld.code,
        load: ld,
        title: ld.title || 'Commessa Spedizione',
        client: ld.client || '—',
        destination: ld.destination || '—',
        movements: [],
        outMovements: [],
        inMovements: [],
        totalOutQty: 0,
        totalInQty: 0,
        lastTimestamp: null,
        proofCount: ld.packingProofs?.length || 0,
        totalBoxes: ld.boxes.length,
      });
    });

    inventory.movements.forEach((mv) => {
      const rawCode = (mv.commessaCode || '').trim();
      if (!rawCode) return;
      const codeKey = rawCode.toUpperCase();
      if (hiddenCommessaSet.has(codeKey)) return;
      let entry = map.get(codeKey);
      if (!entry) {
        entry = {
          code: rawCode,
          load: null,
          title: 'Movimenti registrati su commessa',
          client: '—',
          destination: '—',
          movements: [],
          outMovements: [],
          inMovements: [],
          totalOutQty: 0,
          totalInQty: 0,
          lastTimestamp: null,
          proofCount: 0,
          totalBoxes: 0,
        };
        map.set(codeKey, entry);
      }
      entry.movements.push(mv);
      if (mv.type === 'scarico') {
        entry.outMovements.push(mv);
        entry.totalOutQty = Math.round((entry.totalOutQty + mv.quantity) * 100) / 100;
      } else {
        entry.inMovements.push(mv);
        entry.totalInQty = Math.round((entry.totalInQty + mv.quantity) * 100) / 100;
      }
      if (!entry.lastTimestamp || mv.timestamp > entry.lastTimestamp) {
        entry.lastTimestamp = mv.timestamp;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.lastTimestamp && b.lastTimestamp) {
        return b.lastTimestamp.localeCompare(a.lastTimestamp);
      }
      if (a.lastTimestamp) return -1;
      if (b.lastTimestamp) return 1;
      return a.code.localeCompare(b.code);
    });
  }, [loads, inventory.movements, hiddenCommessaSet]);

  const filteredCommesse = useMemo(() => {
    const q = commessaSearch.trim().toLowerCase();
    return commessaSummaries.filter((c) => {
      if (commessaListFilter === 'out' && c.outMovements.length === 0) return false;
      if (commessaListFilter === 'in' && c.inMovements.length === 0) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.client.toLowerCase().includes(q) ||
        c.destination.toLowerCase().includes(q)
      );
    });
  }, [commessaSummaries, commessaSearch, commessaListFilter]);

  const activeCommessaDetail = useMemo(() => {
    if (!selectedCommessaCode) return null;
    const key = selectedCommessaCode.trim().toUpperCase();
    return (
      commessaSummaries.find((c) => c.code.trim().toUpperCase() === key) || null
    );
  }, [commessaSummaries, selectedCommessaCode]);

  // Filtered Stock Items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.items.filter((item) => {
      if (activeTab === 'sotto_scorta' && item.quantity > item.minStock) return false;
      if (categoryFilter !== 'Tutte' && item.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.location || '').toLowerCase().includes(q) ||
        (item.supplier || '').toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [inventory.items, searchQuery, categoryFilter, activeTab]);

  // Filtered Movements
  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return inventory.movements.filter((mv) => {
      if (movementTypeFilter !== 'all' && mv.type !== movementTypeFilter) return false;
      if (commessaFilter !== 'all' && (mv.commessaCode || '') !== commessaFilter) return false;
      if (!q) return true;
      return (
        mv.sku.toLowerCase().includes(q) ||
        mv.itemName.toLowerCase().includes(q) ||
        mv.reason.toLowerCase().includes(q) ||
        (mv.commessaCode || '').toLowerCase().includes(q) ||
        (mv.documentRef || '').toLowerCase().includes(q) ||
        (mv.operatorName || '').toLowerCase().includes(q)
      );
    });
  }, [inventory.movements, searchQuery, movementTypeFilter, commessaFilter]);

  const distinctMovementCommesse = useMemo(() => {
    const set = new Set<string>();
    loads.forEach((l) => {
      if (l.code) set.add(l.code);
    });
    inventory.movements.forEach((m) => {
      if (m.commessaCode) set.add(m.commessaCode);
    });
    return Array.from(set);
  }, [loads, inventory.movements]);

  const openMovementModal = (opts?: {
    type?: StockMovementType;
    itemId?: string;
    commessaCode?: string;
  }) => {
    const nextType = opts?.type || 'scarico';
    setMovementType(nextType);
    setMoveReason(nextType === 'carico' ? CARICO_REASONS[0] : SCARICO_REASONS[0]);
    if (opts?.itemId) {
      setSelectedItemId(opts.itemId);
    } else if (!selectedItemId && inventory.items[0]) {
      setSelectedItemId(inventory.items[0].id);
    }
    if (opts?.commessaCode !== undefined) {
      setMoveCommessa(opts.commessaCode);
    } else {
      setMoveCommessa(selectedCommessaCode || activeLoad.code || '');
    }
    setMoveQty('1');
    setFormFeedback(null);
    setShowMoveModal(true);
  };

  const switchMovementType = (type: StockMovementType) => {
    setMovementType(type);
    setMoveReason(type === 'carico' ? CARICO_REASONS[0] : SCARICO_REASONS[0]);
    setFormFeedback(null);
  };

  const handleRegisterMovement = (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    if (!selectedItem) {
      setFormFeedback({
        kind: 'error',
        text: 'Seleziona o crea prima un articolo di magazzino.',
      });
      return;
    }

    const qty = Number(moveQty.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormFeedback({
        kind: 'error',
        text: 'Inserisci una quantità valida maggiore di zero.',
      });
      return;
    }

    const previousQty = selectedItem.quantity;
    if (movementType === 'scarico' && qty > previousQty) {
      setFormFeedback({
        kind: 'error',
        text: `Giacenza insufficiente per ${selectedItem.sku}: disponibili ${previousQty} ${selectedItem.unit}, richiesti ${qty} ${selectedItem.unit}.`,
      });
      return;
    }

    const resultingQty =
      movementType === 'carico'
        ? Math.round((previousQty + qty) * 100) / 100
        : Math.round((previousQty - qty) * 100) / 100;

    const nowIso = new Date().toISOString();
    const newMovement: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: selectedItem.id,
      sku: selectedItem.sku,
      itemName: selectedItem.name,
      unit: selectedItem.unit,
      type: movementType,
      quantity: qty,
      previousQty,
      resultingQty,
      reason:
        moveReason.trim() ||
        (movementType === 'carico' ? 'Carico materiale' : 'Scarico materiale'),
      commessaCode: moveCommessa.trim() || undefined,
      operatorName: moveOperator.trim() || 'Magazziniere',
      documentRef: moveDocRef.trim() || undefined,
      notes: moveNotes.trim() || undefined,
      timestamp: nowIso,
    };

    const nextItems = inventory.items.map((it) =>
      it.id === selectedItem.id
        ? { ...it, quantity: resultingQty, updatedAt: nowIso }
        : it
    );

    const actionLabel = movementType === 'carico' ? 'Carico' : 'Scarico';
    const sign = movementType === 'carico' ? '+' : '−';

    const movCommessaUpper = (newMovement.commessaCode || '').trim().toUpperCase();
    const nextHiddenCodes = movCommessaUpper
      ? (inventory.hiddenCommessaCodes || []).filter(
          (c) => c.trim().toUpperCase() !== movCommessaUpper
        )
      : inventory.hiddenCommessaCodes;

    onUpdateInventory(
      {
        ...inventory,
        items: nextItems,
        movements: [newMovement, ...inventory.movements],
        hiddenCommessaCodes: nextHiddenCodes,
      },
      `${actionLabel} registrato: ${selectedItem.sku} (${sign}${qty} ${selectedItem.unit}) → Giacenza ${resultingQty} ${selectedItem.unit}`
    );

    setMoveQty('1');
    setMoveDocRef('');
    setMoveNotes('');
    setShowMoveModal(false);
    setWorkspaceNotice(
      `${actionLabel} registrato: ${selectedItem.sku} (${sign}${qty} ${selectedItem.unit})${
        newMovement.commessaCode ? ` · Commessa ${newMovement.commessaCode}` : ''
      }`
    );
    window.setTimeout(() => setWorkspaceNotice(null), 3500);
  };

  const openCreateItemModal = () => {
    setItemModalMode('create');
    setEditingItemId(null);
    const nextNum = inventory.items.length + 1;
    setItemSku(`MAT-${String(nextNum).padStart(3, '0')}`);
    setItemName('');
    setItemCategory('Generale');
    setItemUnit('pz');
    setItemInitialQty('0');
    setItemMinStock('5');
    setItemLocation('Scaffale A1');
    setItemSupplier('');
    setItemNotes('');
  };

  const openEditItemModal = (item: WarehouseStockItem) => {
    setItemModalMode('edit');
    setEditingItemId(item.id);
    setItemSku(item.sku);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemUnit(item.unit);
    setItemInitialQty(String(item.quantity));
    setItemMinStock(String(item.minStock));
    setItemLocation(item.location || '');
    setItemSupplier(item.supplier || '');
    setItemNotes(item.notes || '');
  };

  const handleSaveItemModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSku = itemSku.trim().toUpperCase();
    const cleanName = itemName.trim();
    if (!cleanSku || !cleanName) return;

    const nowIso = new Date().toISOString();
    const parsedMin = Math.max(0, Number(itemMinStock.replace(',', '.')) || 0);

    if (itemModalMode === 'create') {
      const initQty = Math.max(0, Number(itemInitialQty.replace(',', '.')) || 0);
      const newItem: WarehouseStockItem = {
        id: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sku: cleanSku,
        name: cleanName,
        category: itemCategory,
        unit: itemUnit,
        quantity: initQty,
        minStock: parsedMin,
        location: itemLocation.trim() || 'Magazzino',
        supplier: itemSupplier.trim() || undefined,
        notes: itemNotes.trim() || undefined,
        updatedAt: nowIso,
      };

      const nextMovements = [...inventory.movements];
      if (initQty > 0) {
        nextMovements.unshift({
          id: `mov-init-${Date.now()}`,
          itemId: newItem.id,
          sku: newItem.sku,
          itemName: newItem.name,
          unit: newItem.unit,
          type: 'carico',
          quantity: initQty,
          previousQty: 0,
          resultingQty: initQty,
          reason: 'Giacenza iniziale anagrafica',
          operatorName: moveOperator.trim() || 'Magazziniere',
          timestamp: nowIso,
        });
      }

      onUpdateInventory(
        {
          items: [newItem, ...inventory.items],
          movements: nextMovements,
        },
        `Articolo ${newItem.sku} aggiunto in magazzino`
      );
      setSelectedItemId(newItem.id);
    } else if (itemModalMode === 'edit' && editingItemId) {
      const nextItems = inventory.items.map((it) =>
        it.id === editingItemId
          ? {
              ...it,
              sku: cleanSku,
              name: cleanName,
              category: itemCategory,
              unit: itemUnit,
              minStock: parsedMin,
              location: itemLocation.trim() || 'Magazzino',
              supplier: itemSupplier.trim() || undefined,
              notes: itemNotes.trim() || undefined,
              updatedAt: nowIso,
            }
          : it
      );
      onUpdateInventory(
        {
          items: nextItems,
          movements: inventory.movements,
        },
        `Anagrafica ${cleanSku} aggiornata`
      );
    }

    setItemModalMode('closed');
  };

  const handleDeleteItem = (itemId: string) => {
    const target = inventory.items.find((i) => i.id === itemId);
    const nextItems = inventory.items.filter((i) => i.id !== itemId);
    onUpdateInventory(
      {
        items: nextItems,
        movements: inventory.movements,
      },
      target ? `Articolo ${target.sku} rimosso dall'anagrafica` : undefined
    );
    if (selectedItemId === itemId) {
      setSelectedItemId(nextItems[0]?.id || '');
    }
    setConfirmDeleteItemId(null);
  };

  const handleReverseMovement = (mov: StockMovement) => {
    const targetItem = inventory.items.find((i) => i.id === mov.itemId);
    const nowIso = new Date().toISOString();
    let nextItems = inventory.items;

    if (targetItem) {
      const restoredQty =
        mov.type === 'carico'
          ? Math.max(0, Math.round((targetItem.quantity - mov.quantity) * 100) / 100)
          : Math.round((targetItem.quantity + mov.quantity) * 100) / 100;

      nextItems = inventory.items.map((i) =>
        i.id === targetItem.id ? { ...i, quantity: restoredQty, updatedAt: nowIso } : i
      );
    }

    const nextMovements = inventory.movements.filter((m) => m.id !== mov.id);
    onUpdateInventory(
      {
        ...inventory,
        items: nextItems,
        movements: nextMovements,
      },
      `Movimento stornato (${mov.sku}) e giacenza ripristinata`
    );
    setConfirmReverseMovId(null);
  };

  // Elimina la commessa e i suoi movimenti SOLO dentro Carico / Scarico (CaricoStudio resta intatto!)
  const handleDeleteCommessaFromStockOnly = (commessaCode: string) => {
    const codeKey = commessaCode.trim().toUpperCase();
    if (!codeKey) return;

    const nextMovements = inventory.movements.filter(
      (m) => (m.commessaCode || '').trim().toUpperCase() !== codeKey
    );
    const prevHidden = inventory.hiddenCommessaCodes || [];
    const nextHidden = prevHidden.some((c) => c.trim().toUpperCase() === codeKey)
      ? prevHidden
      : [...prevHidden, codeKey];

    onUpdateInventory(
      {
        ...inventory,
        movements: nextMovements,
        hiddenCommessaCodes: nextHidden,
      },
      `Commessa ${commessaCode} eliminata da Carico / Scarico (intatta in CaricoStudio)`
    );

    if (
      selectedCommessaCode &&
      selectedCommessaCode.trim().toUpperCase() === codeKey
    ) {
      setSelectedCommessaCode(null);
    }
    setConfirmDeleteCommessaCode(null);
    setWorkspaceNotice(
      `Commessa ${commessaCode} rimossa solo da Carico / Scarico. Nel gestionale CaricoStudio è rimasta intatta con tutto.`
    );
    window.setTimeout(() => setWorkspaceNotice(null), 4500);
  };

  const handleRestoreHiddenCommesse = () => {
    onUpdateInventory(
      {
        ...inventory,
        hiddenCommessaCodes: [],
      },
      'Commesse nascoste ripristinate in Carico / Scarico'
    );
    setWorkspaceNotice('Tutte le commesse di CaricoStudio sono nuovamente visibili qui.');
    window.setTimeout(() => setWorkspaceNotice(null), 3500);
  };

  const handleImportFromActiveLoad = () => {
    if (!activeLoad.items || activeLoad.items.length === 0) {
      setWorkspaceNotice(`La commessa ${activeLoad.code} non ha articoli nella Check-list.`);
      window.setTimeout(() => setWorkspaceNotice(null), 3000);
      return;
    }

    const nowIso = new Date().toISOString();
    const existingBySku = new Map(
      inventory.items.map((it) => [it.sku.trim().toUpperCase(), it])
    );

    const addedItems: WarehouseStockItem[] = [];
    const addedMovements: StockMovement[] = [];

    activeLoad.items.forEach((ci, idx) => {
      const skuKey = (ci.sku || `ART-${idx + 1}`).trim().toUpperCase();
      if (!existingBySku.has(skuKey)) {
        const newItem: WarehouseStockItem = {
          id: `stk-imp-${Date.now()}-${idx}`,
          sku: skuKey,
          name: ci.name || 'Articolo Commessa',
          category: CATEGORIES.includes(ci.category) ? ci.category : 'Generale',
          unit: 'pz',
          quantity: Math.max(0, Number(ci.quantity) || 0),
          minStock: 2,
          location: `Commessa ${activeLoad.code}`,
          notes: ci.notes || undefined,
          updatedAt: nowIso,
        };
        addedItems.push(newItem);
        existingBySku.set(skuKey, newItem);

        if (newItem.quantity > 0) {
          addedMovements.push({
            id: `mov-imp-${Date.now()}-${idx}`,
            itemId: newItem.id,
            sku: newItem.sku,
            itemName: newItem.name,
            unit: newItem.unit,
            type: 'carico',
            quantity: newItem.quantity,
            previousQty: 0,
            resultingQty: newItem.quantity,
            reason: `Importato da Check-list Commessa ${activeLoad.code}`,
            commessaCode: activeLoad.code,
            operatorName: moveOperator.trim() || 'Magazziniere',
            timestamp: nowIso,
          });
        }
      }
    });

    if (addedItems.length === 0) {
      setWorkspaceNotice(`Tutti gli articoli di ${activeLoad.code} sono già in magazzino.`);
      window.setTimeout(() => setWorkspaceNotice(null), 3000);
      return;
    }

    onUpdateInventory(
      {
        items: [...addedItems, ...inventory.items],
        movements: [...addedMovements, ...inventory.movements],
      },
      `Importati ${addedItems.length} articoli dalla commessa ${activeLoad.code}`
    );
    setSelectedItemId(addedItems[0].id);
    setWorkspaceNotice(`Importati ${addedItems.length} articoli da ${activeLoad.code}`);
    window.setTimeout(() => setWorkspaceNotice(null), 3000);
  };

  const handleExportCsv = (customMovements?: StockMovement[], filePrefix?: string) => {
    const isMov = customMovements !== undefined || activeTab === 'movimenti';
    let csv = '';
    if (isMov) {
      const list = customMovements ?? filteredMovements;
      const headers = [
        'Data/Ora',
        'Tipo',
        'Codice SKU',
        'Materiale',
        'Quantita',
        'Unita',
        'Giacenza Prima',
        'Giacenza Dopo',
        'Causale',
        'Commessa',
        'Rif DDT',
        'Operatore',
        'Note',
      ];
      const rows = list.map((m) => [
        new Date(m.timestamp).toLocaleString('it-IT'),
        m.type === 'carico' ? 'CARICO' : 'SCARICO',
        m.sku,
        m.itemName,
        m.type === 'carico' ? `+${m.quantity}` : `-${m.quantity}`,
        m.unit,
        m.previousQty,
        m.resultingQty,
        m.reason,
        m.commessaCode || '',
        m.documentRef || '',
        m.operatorName,
        m.notes || '',
      ]);
      csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    } else {
      const headers = [
        'Codice SKU',
        'Descrizione Materiale',
        'Categoria',
        'Ubicazione',
        'Giacenza',
        'Unita',
        'Scorta Minima',
        'Fornitore',
        'Note',
      ];
      const rows = filteredItems.map((i) => [
        i.sku,
        i.name,
        i.category,
        i.location,
        i.quantity,
        i.unit,
        i.minStock,
        i.supplier || '',
        i.notes || '',
      ]);
      csv = [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filePrefix || (isMov ? 'Registro_Carico_Scarico' : 'Giacenze_Magazzino')}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleOpenPdfPrint = (customMovements?: StockMovement[]) => {
    const mode = customMovements || activeTab === 'movimenti' ? 'movimenti' : 'giacenze';
    const doc = generateInventoryReportPDF(
      filteredItems,
      customMovements ?? filteredMovements,
      mode
    );
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    openPdfBlobInNewTab(url);
  };

  const handleDownloadPdf = (customMovements?: StockMovement[]) => {
    const mode = customMovements || activeTab === 'movimenti' ? 'movimenti' : 'giacenze';
    const doc = generateInventoryReportPDF(
      filteredItems,
      customMovements ?? filteredMovements,
      mode
    );
    doc.save(
      mode === 'movimenti'
        ? `Registro_Movimenti_${new Date().toISOString().slice(0, 10)}.pdf`
        : `Inventario_Giacenze_${new Date().toISOString().slice(0, 10)}.pdf`
    );
  };

  const navItems: {
    id: WorkspaceSection;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    accent?: 'amber' | 'emerald';
  }[] = [
    {
      id: 'commesse',
      label: 'Commesse Uscite / Entrate',
      count: commessaSummaries.length,
      icon: FolderOpen,
    },
    {
      id: 'giacenze',
      label: 'Giacenze Magazzino',
      count: inventory.items.length,
      icon: Boxes,
    },
    {
      id: 'movimenti',
      label: 'Storico Movimenti',
      count: inventory.movements.length,
      icon: History,
    },
    {
      id: 'sotto_scorta',
      label: 'Sotto Scorta',
      count: stats.lowStockCount,
      icon: AlertTriangle,
      accent: stats.lowStockCount > 0 ? 'amber' : undefined,
    },
    {
      id: 'prove_101',
      label: 'Prove Imballo 101%',
      count: activeLoad.packingProofs?.length || 0,
      icon: ShieldCheck,
      accent: 'emerald',
    },
  ];

  const sectionHeaderTitle: Record<WorkspaceSection, string> = {
    commesse: activeCommessaDetail
      ? `Commessa ${activeCommessaDetail.code}`
      : 'Commesse Uscite ed Entrate',
    giacenze: 'Giacenze di Magazzino',
    movimenti: 'Storico Carichi e Scarichi',
    sotto_scorta: 'Materiali Sotto Scorta',
    prove_101: `Prove Imballo 101% — ${activeLoad.code}`,
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-50 text-slate-900 overflow-hidden">
      {/* ===================================================================
          SIDEBAR SINISTRA PULITA (Navigazione Chiara e Ordinata)
      =================================================================== */}
      <aside className="w-full md:w-56 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0">
        {/* Titolo App nella Sidebar */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
            Carico / Scarico
          </span>
        </div>

        {/* Menu Navigazione Principale */}
        <nav className="p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible no-scrollbar flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'commesse') setSelectedCommessaCode(null);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer whitespace-nowrap transition-colors shrink-0 md:shrink ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive
                        ? 'text-white'
                        : item.accent === 'amber'
                        ? 'text-amber-600'
                        : item.accent === 'emerald'
                        ? 'text-emerald-600'
                        : 'text-slate-500'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                <span
                  className={`font-mono text-[11px] tabular-nums ${
                    isActive ? 'text-slate-300' : 'text-slate-400'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Footer Sidebar: Automazione & Importa (fuori dai piedi!) */}
        <div className="hidden md:block p-3 border-t border-slate-200 space-y-2 bg-slate-50/70">
          <label
            className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer select-none"
            title="Quando spunti un articolo in CaricoStudio, lo scarica automaticamente da Magazzino"
          >
            <input
              type="checkbox"
              checked={autoSyncStockWithPacking}
              onChange={(e) => onToggleAutoSyncStockWithPacking(e.target.checked)}
              className="mt-0.5 rounded cursor-pointer"
            />
            <span>
              <strong className="text-slate-800 block">Auto-Scarico Spunta</strong>
              Sincronizza con CaricoStudio
            </span>
          </label>

          <button
            type="button"
            onClick={handleImportFromActiveLoad}
            className="w-full px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
          >
            <PackagePlus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">Importa da {activeLoad.code}</span>
          </button>
        </div>
      </aside>

      {/* ===================================================================
          AREA PRINCIPALE PULITA (Top Bar 1 Riga + Contenuto Spazioso)
      =================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar 1-riga, max 2 azioni primarie */}
        <header className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              {sectionHeaderTitle[activeTab]}
            </h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5 truncate">
              {stats.todayCount} movimenti oggi ({stats.totalCarichiToday} entrati ·{' '}
              {stats.totalScarichiToday} usciti) · {stats.totalItems} articoli in magazzino
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openCreateItemModal}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuovo Materiale
            </button>
            <button
              type="button"
              onClick={() => openMovementModal({ type: 'scarico' })}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
              Registra Carico / Scarico
            </button>
          </div>
        </header>

        {/* Notifica discreta in linea */}
        {workspaceNotice && (
          <div className="px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-800 flex items-center justify-between shrink-0">
            <span>{workspaceNotice}</span>
            <button
              type="button"
              onClick={() => setWorkspaceNotice(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Contenuto Principale Scrollabile */}
        <main className="flex-1 overflow-y-auto p-5">
          {activeTab === 'commesse' ? (
            /* ==================== SEZIONE 1: COMMESSE USCITE / ENTRATE ==================== */
            activeCommessaDetail ? (
              /* SCHEDA DETTAGLIO SINGOLA COMMESSA */
              <div className="max-w-6xl mx-auto space-y-5">
                {/* Breadcrumb & Azioni Rapide Commessa */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCommessaCode(null);
                        setCommessaDetailFilter('all');
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Tutte le Commesse
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">
                          {activeCommessaDetail.code}
                        </span>
                        <span className="text-slate-300">/</span>
                        <span className="text-sm font-semibold text-slate-800 truncate">
                          {activeCommessaDetail.title}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        Cliente: {activeCommessaDetail.client} · Destinazione:{' '}
                        {activeCommessaDetail.destination}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {activeCommessaDetail.load && onOpenCommessaPhotos && (
                      <button
                        type="button"
                        onClick={() => onOpenCommessaPhotos(activeCommessaDetail.load!.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        Foto Commessa
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        openMovementModal({
                          type: 'scarico',
                          commessaCode: activeCommessaDetail.code,
                        })
                      }
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1"
                    >
                      <ArrowUpFromLine className="w-3.5 h-3.5" />
                      Manda Via (−)
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openMovementModal({
                          type: 'carico',
                          commessaCode: activeCommessaDetail.code,
                        })
                      }
                      className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1"
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                      Entrata / Reso (+)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenPdfPrint(activeCommessaDetail.movements)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Stampa PDF
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDeleteCommessaCode(activeCommessaDetail.code)
                      }
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                      title="Elimina la commessa solo da Carico / Scarico (resta intatta in CaricoStudio)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina da Carico / Scarico
                    </button>
                  </div>
                </div>

                {confirmDeleteCommessaCode &&
                  confirmDeleteCommessaCode.trim().toUpperCase() ===
                    activeCommessaDetail.code.trim().toUpperCase() && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-rose-900">
                        <strong>Eliminare {activeCommessaDetail.code} solo da Carico / Scarico?</strong>{' '}
                        I movimenti di questa commessa verranno rimossi qui, mentre la commessa dentro{' '}
                        <strong>CaricoStudio</strong> resterà completamente intatta con bancali, scatole, foto e prove.
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCommessaCode(null)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
                        >
                          Annulla
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCommessaFromStockOnly(activeCommessaDetail.code)
                          }
                          className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                        >
                          Conferma Elimina Solo Qui
                        </button>
                      </div>
                    </div>
                  )}

                {/* 4 Metriche Piane (Single-Elevation) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs text-slate-500">Mandato Via (Uscite)</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-rose-700 mt-1">
                      −{activeCommessaDetail.totalOutQty} pz
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {activeCommessaDetail.outMovements.length} scarichi registrati
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs text-slate-500">Entrato / Resi (Carichi)</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                      +{activeCommessaDetail.totalInQty} pz
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {activeCommessaDetail.inMovements.length} carichi registrati
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs text-slate-500">Totale Movimenti</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {activeCommessaDetail.movements.length}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {activeCommessaDetail.lastTimestamp
                        ? `Ultimo: ${new Date(
                            activeCommessaDetail.lastTimestamp
                          ).toLocaleDateString('it-IT')}`
                        : 'Nessun movimento'}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <div className="text-xs text-slate-500">Scatole Certificate 101%</div>
                    <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                      {activeCommessaDetail.proofCount}
                      {activeCommessaDetail.totalBoxes > 0
                        ? ` / ${activeCommessaDetail.totalBoxes}`
                        : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {activeCommessaDetail.load?.handoverProof
                        ? 'Ritiro corriere firmato'
                        : 'Dossier in lavorazione'}
                    </div>
                  </div>
                </div>

                {/* Filtri Dettaglio Commessa */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
                    {(
                      [
                        ['all', `Tutti (${activeCommessaDetail.movements.length})`],
                        [
                          'scarico',
                          `Mandato Via (${activeCommessaDetail.outMovements.length})`,
                        ],
                        [
                          'carico',
                          `Entrato (${activeCommessaDetail.inMovements.length})`,
                        ],
                        ...(activeCommessaDetail.load
                          ? ([
                              [
                                'planned',
                                `Previsti in Lista (${activeCommessaDetail.load.items.length})`,
                              ],
                            ] as const)
                          : []),
                      ] as const
                    ).map(([k, lbl]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setCommessaDetailFilter(k)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap transition-colors ${
                          commessaDetailFilter === k
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleExportCsv(
                        activeCommessaDetail.movements,
                        `Movimenti_${activeCommessaDetail.code}`
                      )
                    }
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    Esporta CSV Commessa
                  </button>
                </div>

                {/* Tabella Materiali Previsti o Movimenti Reali della Commessa */}
                {commessaDetailFilter === 'planned' && activeCommessaDetail.load ? (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {activeCommessaDetail.load.items.length === 0 ? (
                      <div className="p-10 text-center text-xs text-slate-500">
                        Nessun materiale inserito nella Check-list di CaricoStudio per questa commessa.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                              <th className="py-2.5 px-4">Codice SKU</th>
                              <th className="py-2.5 px-4">Materiale Previsto</th>
                              <th className="py-2.5 px-4 text-right">Q.tà Prevista</th>
                              <th className="py-2.5 px-4 text-right">Già Mandato Via</th>
                              <th className="py-2.5 px-4">Stato Check-list</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeCommessaDetail.load.items.map((it) => {
                              const sentQty = activeCommessaDetail.outMovements
                                .filter(
                                  (m) =>
                                    m.sku.trim().toUpperCase() ===
                                    it.sku.trim().toUpperCase()
                                )
                                .reduce((acc, m) => acc + m.quantity, 0);
                              return (
                                <tr key={it.id} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                                    {it.sku}
                                  </td>
                                  <td className="py-2.5 px-4 text-slate-800">{it.name}</td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                                    {it.quantity} pz
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-rose-700">
                                    {sentQty > 0 ? `−${sentQty} pz` : '0 pz'}
                                  </td>
                                  <td className="py-2.5 px-4">
                                    {it.checked ? (
                                      <span className="font-semibold text-emerald-700">
                                        Spuntato / Caricato
                                      </span>
                                    ) : (
                                      <span className="text-slate-500">In preparazione</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {(() => {
                      const rows =
                        commessaDetailFilter === 'scarico'
                          ? activeCommessaDetail.outMovements
                          : commessaDetailFilter === 'carico'
                          ? activeCommessaDetail.inMovements
                          : activeCommessaDetail.movements;

                      if (rows.length === 0) {
                        return (
                          <div className="p-10 text-center space-y-2.5">
                            <p className="text-sm font-semibold text-slate-800">
                              Nessun movimento registrato per {activeCommessaDetail.code}.
                            </p>
                            <p className="text-xs text-slate-500">
                              Registra un uscita o un entrata per questa commessa, oppure spunta gli articoli in CaricoStudio con Auto-Scarico attivo.
                            </p>
                            <div className="pt-1 flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openMovementModal({
                                    type: 'scarico',
                                    commessaCode: activeCommessaDetail.code,
                                  })
                                }
                                className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                Registra Prima Uscita / Entrata
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                                <th className="py-2.5 px-3.5">Data / Ora</th>
                                <th className="py-2.5 px-3.5">Direzione</th>
                                <th className="py-2.5 px-3.5">Materiale</th>
                                <th className="py-2.5 px-3.5 text-right">Quantità</th>
                                <th className="py-2.5 px-3.5">Causale / Collo / DDT</th>
                                <th className="py-2.5 px-3.5">Operatore</th>
                                <th className="py-2.5 px-3.5 text-right">Storno</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {rows.map((mv) => {
                                const isCarico = mv.type === 'carico';
                                return (
                                  <tr key={mv.id} className="hover:bg-slate-50">
                                    <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                      {new Date(mv.timestamp).toLocaleString('it-IT', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </td>
                                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                                      <span
                                        className={`font-bold ${
                                          isCarico ? 'text-emerald-700' : 'text-rose-700'
                                        }`}
                                      >
                                        {isCarico ? 'ENTRATO (+)' : 'MANDATO VIA (−)'}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3.5">
                                      <div className="font-semibold text-slate-900">
                                        <span className="font-mono text-slate-500 mr-1.5">
                                          {mv.sku}
                                        </span>
                                        {mv.itemName}
                                      </div>
                                      {mv.notes && (
                                        <div className="text-[11px] text-slate-500">
                                          {mv.notes}
                                        </div>
                                      )}
                                    </td>
                                    <td
                                      className={`py-2.5 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                        isCarico ? 'text-emerald-700' : 'text-rose-700'
                                      }`}
                                    >
                                      {isCarico ? '+' : '−'}
                                      {mv.quantity} {mv.unit}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-slate-700">
                                      <div>{mv.reason}</div>
                                      {(mv.documentRef || mv.packageCode || mv.sealNumber) && (
                                        <div className="text-[11px] font-mono text-slate-500">
                                          {[
                                            mv.documentRef ? `Rif ${mv.documentRef}` : null,
                                            mv.packageCode ? `Collo ${mv.packageCode}` : null,
                                            mv.sealNumber ? `Sigillo ${mv.sealNumber}` : null,
                                          ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap">
                                      {mv.operatorName}
                                    </td>
                                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                      {confirmReverseMovId === mv.id ? (
                                        <span className="inline-flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleReverseMovement(mv)}
                                            className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 rounded cursor-pointer"
                                          >
                                            Conferma
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmReverseMovId(null)}
                                            className="p-1 text-slate-500 cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setConfirmReverseMovId(mv.id)}
                                          className="text-[11px] font-medium text-slate-500 hover:text-rose-700 cursor-pointer inline-flex items-center gap-1"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                          Storna
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              /* LISTA COMMESSE CLICCABILI (PANORAMICA USCITE / ENTRATE) */
              <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={commessaSearch}
                      onChange={(e) => setCommessaSearch(e.target.value)}
                      placeholder="Cerca commessa, cliente o destinazione..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  <div className="inline-flex items-center p-1 bg-slate-200/70 rounded-lg">
                    {(
                      [
                        ['all', 'Tutte le Commesse'],
                        ['out', 'Solo con Uscite'],
                        ['in', 'Solo con Entrate'],
                      ] as const
                    ).map(([k, lbl]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setCommessaListFilter(k)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer whitespace-nowrap ${
                          commessaListFilter === k
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {filteredCommesse.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-800">
                        Nessuna commessa trovata con questo filtro.
                      </p>
                      <p className="text-xs text-slate-500">
                        Ogni movimento registrato con un codice commessa comparirà automaticamente qui.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                            <th className="py-2.5 px-4">Commessa</th>
                            <th className="py-2.5 px-4">Cliente / Destinazione</th>
                            <th className="py-2.5 px-4 text-right">Mandato Via (−)</th>
                            <th className="py-2.5 px-4 text-right">Entrato (+)</th>
                            <th className="py-2.5 px-4 text-right">Ultimo Movimento</th>
                            <th className="py-2.5 px-4 text-right">Dettaglio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredCommesse.map((c) => (
                            <tr
                              key={c.code}
                              onClick={() => {
                                setSelectedCommessaCode(c.code);
                                setCommessaDetailFilter('all');
                              }}
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
                                  <div>
                                    <div className="font-mono font-bold text-slate-900">
                                      {c.code}
                                    </div>
                                    <div className="text-xs text-slate-600 truncate max-w-[260px]">
                                      {c.title}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                <div className="font-medium text-slate-800">{c.client}</div>
                                <div className="text-[11px] text-slate-500">
                                  {c.destination}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                                {c.outMovements.length > 0 ? (
                                  <div>
                                    <span className="font-bold text-rose-700">
                                      −{c.totalOutQty} pz
                                    </span>
                                    <div className="text-[11px] text-slate-500">
                                      {c.outMovements.length} uscite
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                                {c.inMovements.length > 0 ? (
                                  <div>
                                    <span className="font-bold text-emerald-700">
                                      +{c.totalInQty} pz
                                    </span>
                                    <div className="text-[11px] text-slate-500">
                                      {c.inMovements.length} entrate
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                {c.lastTimestamp
                                  ? new Date(c.lastTimestamp).toLocaleString('it-IT', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Nessuno'}
                              </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  {confirmDeleteCommessaCode === c.code ? (
                                    <div
                                      className="inline-flex items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteCommessaFromStockOnly(c.code)
                                        }
                                        className="px-2.5 py-1 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                                        title="Elimina solo da Carico / Scarico — resta in CaricoStudio"
                                      >
                                        Conferma (solo qui)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteCommessaCode(null)}
                                        className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                                        title="Annulla"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-2.5">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteCommessaCode(c.code);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer transition-colors"
                                        title="Elimina commessa solo da Carico / Scarico (resta intatta in CaricoStudio)"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                                        Apri
                                        <ChevronRight className="w-4 h-4" />
                                      </span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {confirmDeleteCommessaCode && !activeCommessaDetail && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900">
                    <span>
                      Stai eliminando <strong>{confirmDeleteCommessaCode}</strong> solo da{' '}
                      <strong>Carico / Scarico</strong>. La commessa nel gestionale{' '}
                      <strong>CaricoStudio</strong> rimarrà intatta con bancali, scatole e foto.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCommessaCode(null)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md cursor-pointer"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteCommessaFromStockOnly(confirmDeleteCommessaCode)
                        }
                        className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
                      >
                        Elimina Solo da Carico / Scarico
                      </button>
                    </div>
                  </div>
                )}

                {(inventory.hiddenCommessaCodes?.length || 0) > 0 && (
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600">
                    <span>
                      {inventory.hiddenCommessaCodes!.length}{' '}
                      {inventory.hiddenCommessaCodes!.length === 1
                        ? 'commessa rimossa'
                        : 'commesse rimosse'}{' '}
                      da Carico / Scarico (rimangono intatte in CaricoStudio).
                    </span>
                    <button
                      type="button"
                      onClick={handleRestoreHiddenCommesse}
                      className="text-xs font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      Ripristina tutte qui
                    </button>
                  </div>
                )}
              </div>
            )
          ) : activeTab === 'prove_101' ? (
            /* ==================== SEZIONE 5: PROVE IMBALLO 101% ==================== */
            <div className="max-w-6xl mx-auto">
              <PackingProofPanel
                load={activeLoad}
                summary={summary}
                movements={inventory.movements}
                onCertifyPackageAndUnload={onCertifyPackageAndUnload}
                onBatchUnloadCheckedItems={onBatchUnloadCheckedItems}
                onSaveHandoverProof={onSaveHandoverProof}
              />
            </div>
          ) : (
            /* ==================== SEZIONI 2, 3, 4: GIACENZE / MOVIMENTI / SOTTO SCORTA ==================== */
            <div className="max-w-6xl mx-auto space-y-4">
              {/* Barra Ricerca, Filtri & Export */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={
                        activeTab === 'movimenti'
                          ? 'Cerca codice, materiale, DDT, commessa...'
                          : 'Cerca codice SKU, descrizione, scaffale...'
                      }
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>

                  {activeTab !== 'movimenti' ? (
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
                    >
                      <option value="Tutte">Tutte le categorie</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <select
                        value={movementTypeFilter}
                        onChange={(e) =>
                          setMovementTypeFilter(
                            e.target.value as 'all' | 'carico' | 'scarico'
                          )
                        }
                        className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
                      >
                        <option value="all">Tutti i movimenti</option>
                        <option value="carico">Solo Entrate (+)</option>
                        <option value="scarico">Solo Uscite (−)</option>
                      </select>

                      <select
                        value={commessaFilter}
                        onChange={(e) => setCommessaFilter(e.target.value)}
                        className="px-3 py-1.5 text-xs font-mono font-medium bg-white border border-slate-300 rounded-lg text-slate-700 cursor-pointer"
                      >
                        <option value="all">Tutte le commesse</option>
                        {distinctMovementCommesse.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleExportCsv()}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf()}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600" />
                    PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenPdfPrint()}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    Stampa
                  </button>
                </div>
              </div>

              {/* Tabella Giacenze / Sotto Scorta vs Tabella Storico Movimenti */}
              {activeTab !== 'movimenti' ? (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {filteredItems.length === 0 ? (
                    <div className="p-10 text-center space-y-2.5">
                      <p className="text-sm font-semibold text-slate-800">
                        {activeTab === 'sotto_scorta'
                          ? 'Nessun materiale sotto scorta al momento.'
                          : 'Nessun materiale trovato.'}
                      </p>
                      {activeTab !== 'sotto_scorta' && (
                        <button
                          type="button"
                          onClick={openCreateItemModal}
                          className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Aggiungi Primo Materiale
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                            <th className="py-2.5 px-3.5">Codice SKU</th>
                            <th className="py-2.5 px-3.5">Materiale</th>
                            <th className="py-2.5 px-3.5">Ubicazione</th>
                            <th className="py-2.5 px-3.5 text-right">Giacenza</th>
                            <th className="py-2.5 px-3.5 text-right">Scorta Min.</th>
                            <th className="py-2.5 px-3.5">Stato</th>
                            <th className="py-2.5 px-3.5 text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredItems.map((item) => {
                            const isOut = item.quantity <= 0;
                            const isLow = !isOut && item.quantity <= item.minStock;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {item.sku}
                                </td>
                                <td className="py-2.5 px-3.5">
                                  <div className="font-semibold text-slate-900">
                                    {item.name}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {item.category}
                                    {item.supplier ? ` · ${item.supplier}` : ''}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap">
                                  {item.location || '—'}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                                  {item.quantity}{' '}
                                  <span className="font-normal text-slate-500">
                                    {item.unit}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                                  {item.minStock} {item.unit}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  {isOut ? (
                                    <span className="font-semibold text-rose-700">
                                      Esaurito
                                    </span>
                                  ) : isLow ? (
                                    <span className="font-semibold text-amber-700">
                                      Sotto scorta
                                    </span>
                                  ) : (
                                    <span className="font-medium text-emerald-700">
                                      Disponibile
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openMovementModal({
                                          type: 'carico',
                                          itemId: item.id,
                                        })
                                      }
                                      className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md cursor-pointer"
                                    >
                                      + Carica
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openMovementModal({
                                          type: 'scarico',
                                          itemId: item.id,
                                        })
                                      }
                                      className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md cursor-pointer"
                                    >
                                      − Scarica
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditItemModal(item)}
                                      title="Modifica anagrafica"
                                      className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    {confirmDeleteItemId === item.id ? (
                                      <span className="inline-flex items-center gap-1 ml-1">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteItem(item.id)}
                                          className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 rounded cursor-pointer"
                                        >
                                          Elimina
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteItemId(null)}
                                          className="p-1 text-slate-500 cursor-pointer"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteItemId(item.id)}
                                        title="Elimina articolo"
                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
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
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {filteredMovements.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-800">
                        Nessun movimento trovato.
                      </p>
                      <p className="text-xs text-slate-500">
                        Usa il pulsante "Registra Carico / Scarico" in alto a destra per registrare un movimento.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                            <th className="py-2.5 px-3.5">Data / Ora</th>
                            <th className="py-2.5 px-3.5">Direzione</th>
                            <th className="py-2.5 px-3.5">Materiale</th>
                            <th className="py-2.5 px-3.5 text-right">Quantità</th>
                            <th className="py-2.5 px-3.5 text-right">Giacenza</th>
                            <th className="py-2.5 px-3.5">Causale</th>
                            <th className="py-2.5 px-3.5">Commessa</th>
                            <th className="py-2.5 px-3.5 text-right">Storno</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredMovements.map((mv) => {
                            const isCarico = mv.type === 'carico';
                            return (
                              <tr key={mv.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                  {new Date(mv.timestamp).toLocaleString('it-IT', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  <span
                                    className={`font-bold ${
                                      isCarico ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    {isCarico ? 'CARICO (+)' : 'SCARICO (−)'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3.5">
                                  <div className="font-semibold text-slate-900">
                                    <span className="font-mono text-slate-500 mr-1.5">
                                      {mv.sku}
                                    </span>
                                    {mv.itemName}
                                  </div>
                                  {mv.notes && (
                                    <div className="text-[11px] text-slate-500">
                                      {mv.notes}
                                    </div>
                                  )}
                                </td>
                                <td
                                  className={`py-2.5 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                                    isCarico ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {isCarico ? '+' : '−'}
                                  {mv.quantity} {mv.unit}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                                  {mv.previousQty} →{' '}
                                  <strong className="text-slate-900">
                                    {mv.resultingQty}
                                  </strong>
                                </td>
                                <td className="py-2.5 px-3.5 text-slate-700">
                                  <div>{mv.reason}</div>
                                  {mv.documentRef && (
                                    <div className="text-[11px] font-mono text-slate-500">
                                      Rif: {mv.documentRef}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5 whitespace-nowrap">
                                  {mv.commessaCode ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCommessaCode(mv.commessaCode!);
                                        setActiveTab('commesse');
                                      }}
                                      className="font-mono font-bold text-blue-700 hover:underline cursor-pointer"
                                    >
                                      {mv.commessaCode}
                                    </button>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                  {confirmReverseMovId === mv.id ? (
                                    <span className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleReverseMovement(mv)}
                                        className="px-2 py-1 text-[11px] font-bold text-white bg-rose-600 rounded cursor-pointer"
                                      >
                                        Storna
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmReverseMovId(null)}
                                        className="p-1 text-slate-500 cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmReverseMovId(mv.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Storna
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================
          MODALE PULITA: REGISTRA CARICO / SCARICO
      =================================================================== */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleRegisterMovement}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Registra Movimento di Magazzino
              </h3>
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Switcher Chiaro Entrata vs Uscita */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => switchMovementType('carico')}
                  className={`py-2 px-3 rounded-md font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    movementType === 'carico'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  Carico (Entrata +)
                </button>
                <button
                  type="button"
                  onClick={() => switchMovementType('scarico')}
                  className={`py-2 px-3 rounded-md font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    movementType === 'scarico'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  Scarico (Uscita −)
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Materiale / Articolo *
                </label>
                <select
                  value={selectedItem?.id || ''}
                  onChange={(e) => {
                    setSelectedItemId(e.target.value);
                    setFormFeedback(null);
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {inventory.items.length === 0 ? (
                    <option value="">Nessun materiale — creane uno nuovo</option>
                  ) : (
                    inventory.items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.sku} — {it.name} (Disp: {it.quantity} {it.unit})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantità ({selectedItem?.unit || 'pz'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={moveQty}
                    onChange={(e) => setMoveQty(e.target.value)}
                    required
                    className="w-full px-3 py-2 font-mono tabular-nums font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Commessa Collegata
                  </label>
                  <input
                    type="text"
                    list="commesse-stock-datalist"
                    value={moveCommessa}
                    onChange={(e) => setMoveCommessa(e.target.value)}
                    placeholder="Es. COM-001"
                    className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <datalist id="commesse-stock-datalist">
                    {loads.map((l) => (
                      <option key={l.id} value={l.code}>
                        {l.title}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Causale
                  </label>
                  <select
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  >
                    {(movementType === 'carico' ? CARICO_REASONS : SCARICO_REASONS).map(
                      (r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Rif. DDT / Bolla
                  </label>
                  <input
                    type="text"
                    value={moveDocRef}
                    onChange={(e) => setMoveDocRef(e.target.value)}
                    placeholder="Es. DDT 458/26"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Operatore
                  </label>
                  <input
                    type="text"
                    value={moveOperator}
                    onChange={(e) => setMoveOperator(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Note (opzionale)
                  </label>
                  <input
                    type="text"
                    value={moveNotes}
                    onChange={(e) => setMoveNotes(e.target.value)}
                    placeholder="Lotto, scaffale..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {formFeedback && (
                <div
                  className={`px-3 py-2 rounded-lg border text-xs ${
                    formFeedback.kind === 'error'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  {formFeedback.text}
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={!selectedItem}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 ${
                  movementType === 'carico'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                {movementType === 'carico' ? 'Salva Carico (+)' : 'Salva Scarico (−)'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================
          MODALE CREAZIONE / MODIFICA ARTICOLO MAGAZZINO
      =================================================================== */}
      {itemModalMode !== 'closed' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSaveItemModal}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {itemModalMode === 'create'
                  ? 'Nuovo Materiale in Magazzino'
                  : 'Modifica Anagrafica Materiale'}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalMode('closed')}
                className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Codice SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                    placeholder="ES. MAT-001"
                    className="w-full px-3 py-2 font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Descrizione Materiale *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Es. Profilo acciaio 40x40, Morsetti Phoenix..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unità di Misura
                  </label>
                  <select
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Scorta Minima
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={itemMinStock}
                    onChange={(e) => setItemMinStock(e.target.value)}
                    className="w-full px-3 py-2 font-mono tabular-nums border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {itemModalMode === 'create' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Giacenza Iniziale ({itemUnit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={itemInitialQty}
                      onChange={(e) => setItemInitialQty(e.target.value)}
                      className="w-full px-3 py-2 font-mono tabular-nums font-bold border border-slate-300 rounded-lg"
                    />
                  </div>
                )}

                <div className={itemModalMode === 'edit' ? 'sm:col-span-2' : ''}>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ubicazione / Scaffale
                  </label>
                  <input
                    type="text"
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    placeholder="Es. Scaffale A2, Corsia 3..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Fornitore Abituale
                  </label>
                  <input
                    type="text"
                    value={itemSupplier}
                    onChange={(e) => setItemSupplier(e.target.value)}
                    placeholder="Es. Ferramenta Rossi Srl"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Note Articolo
                  </label>
                  <input
                    type="text"
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Dettagli tecnici o lotto..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemModalMode('closed')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                {itemModalMode === 'create' ? 'Salva Materiale' : 'Salva Modifiche'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
