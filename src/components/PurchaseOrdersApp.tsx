import React, { useMemo, useState } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  Plus,
  Search,
  Download,
  Mail,
  CheckCircle2,
  PackageCheck,
  Edit3,
  Trash2,
  X,
  ArrowDownToLine,
} from 'lucide-react';
import {
  AuthUser,
  CargoLoad,
  CrmContact,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  StockMovement,
  WarehouseInventoryState,
  WarehouseStockItem,
} from '../types/warehouse';
import { downloadCsvFile, generatePurchaseOrderPdf } from '../utils/businessPdfGenerator';
import {
  computePredictiveStockForecast,
  PredictiveStockAlert,
} from '../utils/localAutoEngine';

interface PurchaseOrdersAppProps {
  orders: PurchaseOrder[];
  inventory: WarehouseInventoryState;
  loads?: CargoLoad[];
  contacts: CrmContact[];
  currentUser: AuthUser;
  initialSupplierId?: string | null;
  onClearInitialIntent?: () => void;
  onUpdateOrders: (next: PurchaseOrder[]) => void;
  onUpdateInventory: (next: WarehouseInventoryState) => void;
}

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  bozza: 'Bozza',
  inviato: 'Inviato',
  confermato: 'Confermato',
  parziale: 'Ricevuto Parz.',
  ricevuto: 'Ricevuto',
  annullato: 'Annullato',
};

const STATUS_TEXT_CLASS: Record<PurchaseOrderStatus, string> = {
  bozza: 'text-slate-600',
  inviato: 'text-blue-700',
  confermato: 'text-indigo-700',
  parziale: 'text-amber-700',
  ricevuto: 'text-emerald-700',
  annullato: 'text-rose-700',
};

function formatDateIt(iso?: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function getNextPoNumber(orders: PurchaseOrder[], year: number) {
  const maxProg = orders
    .filter((o) => o.year === year)
    .reduce((max, o) => Math.max(max, o.progressiveNumber || 0), 0);
  const nextProg = maxProg + 1;
  return {
    progressiveNumber: nextProg,
    number: `ODA-${year}-${String(nextProg).padStart(3, '0')}`,
  };
}

function getSuggestedReorderQty(item: WarehouseStockItem): number {
  const target = Math.max(item.minStock * 2, item.minStock + 5, 10);
  return Math.max(1, target - item.quantity);
}

export const PurchaseOrdersApp: React.FC<PurchaseOrdersAppProps> = ({
  orders,
  inventory,
  loads = [],
  contacts,
  currentUser,
  initialSupplierId,
  onClearInitialIntent,
  onUpdateOrders,
  onUpdateInventory,
}) => {
  const [activeView, setActiveView] = useState<'reorder' | 'orders'>('reorder');
  const [statusFilter, setStatusFilter] = useState<'all' | PurchaseOrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoId, setSelectedPoId] = useState<string | null>(orders[0]?.id || null);

  // Stato selezione riordino automatico
  const [selectedReorderIds, setSelectedReorderIds] = useState<Record<string, boolean>>({});
  const [customReorderQty, setCustomReorderQty] = useState<Record<string, number>>({});

  // Modale creazione/modifica ordine
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [isNewMode, setIsNewMode] = useState(false);

  // Modale ricezione merce -> carico automatico in magazzino
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receiveQtyMap, setReceiveQtyMap] = useState<Record<string, number>>({});

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback((curr) => (curr === msg ? null : curr)), 3500);
  };

  const suppliersList = useMemo(
    () => contacts.filter((c) => c.kind === 'fornitore' || c.kind === 'entrambi'),
    [contacts]
  );

  // Previsione predittiva + articoli sotto scorta minima dal Magazzino
  const predictiveAlerts = useMemo(
    () => computePredictiveStockForecast(inventory, loads, orders, contacts),
    [inventory, loads, orders, contacts]
  );

  const predictiveAlertByItemId = useMemo(() => {
    const map = new Map<string, PredictiveStockAlert>();
    predictiveAlerts.forEach((a) => map.set(a.item.id, a));
    return map;
  }, [predictiveAlerts]);

  const lowStockItems = useMemo(() => {
    return predictiveAlerts.map((a) => a.item);
  }, [predictiveAlerts]);

  const proactiveOnlyCount = useMemo(
    () => predictiveAlerts.filter((a) => !a.isAlreadyLowStock).length,
    [predictiveAlerts]
  );

  // Verifica se un articolo ha già un ordine aperto (bozza/inviato/confermato/parziale)
  const openOrderedBySku = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .filter((o) => o.status !== 'ricevuto' && o.status !== 'annullato')
      .forEach((o) => {
        o.items.forEach((it) => {
          const pending = Math.max(0, (it.orderedQty || 0) - (it.receivedQty || 0));
          if (pending > 0) {
            const key = it.inventoryItemId || it.sku.toUpperCase();
            map.set(key, (map.get(key) || 0) + pending);
          }
        });
      });
    return map;
  }, [orders]);

  const buildBlankOrder = (supplier?: CrmContact): PurchaseOrder => {
    const now = new Date();
    const year = now.getFullYear();
    const { progressiveNumber, number } = getNextPoNumber(orders, year);
    const expected = new Date(now);
    expected.setDate(expected.getDate() + (supplier?.leadTimeDays || 5));

    const supAddress = supplier
      ? [
          supplier.billingAddress,
          [supplier.postalCode, supplier.city, supplier.province].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(', ')
      : '';

    return {
      id: `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number,
      progressiveNumber,
      year,
      orderDate: now.toISOString().slice(0, 10),
      expectedDeliveryDate: expected.toISOString().slice(0, 10),
      status: 'bozza',
      supplierId: supplier?.id,
      supplierName: supplier?.companyName || '',
      supplierEmail: supplier?.email || '',
      supplierPhone: supplier?.phone || supplier?.mobile || '',
      supplierVat: supplier?.vatNumber || '',
      supplierAddress: supAddress,
      paymentTerms: supplier?.paymentTerms || '30 gg DFFM',
      deliveryAddress: currentUser.company || 'Magazzino Principale',
      notes: '',
      items: [],
      stockLoaded: false,
      createdBy: currentUser.name,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  React.useEffect(() => {
    if (initialSupplierId) {
      const sup = contacts.find((c) => c.id === initialSupplierId);
      setActiveView('orders');
      setEditingOrder(buildBlankOrder(sup));
      setIsNewMode(true);
      onClearInitialIntent?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSupplierId]);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedOrders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.number.toLowerCase().includes(q) ||
        o.supplierName.toLowerCase().includes(q) ||
        o.items.some(
          (it) =>
            it.sku.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)
        )
      );
    });
  }, [sortedOrders, statusFilter, searchQuery]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find((o) => o.id === selectedPoId) ||
      orders.find((o) => o.id === selectedPoId) ||
      filteredOrders[0] ||
      null
    );
  }, [filteredOrders, orders, selectedPoId]);

  const kpis = useMemo(() => {
    const openOrders = orders.filter(
      (o) => o.status === 'inviato' || o.status === 'confermato' || o.status === 'parziale'
    ).length;
    const receivedOrders = orders.filter((o) => o.status === 'ricevuto').length;
    const openValue = orders
      .filter((o) => o.status !== 'annullato' && o.status !== 'ricevuto')
      .reduce(
        (sum, o) =>
          sum + o.items.reduce((s, it) => s + it.orderedQty * (it.unitCostEur || 0), 0),
        0
      );
    return {
      lowStockCount: lowStockItems.length,
      openOrders,
      receivedOrders,
      openValue,
    };
  }, [lowStockItems.length, orders]);

  // Genera automaticamente uno o più ordini fornitore raggruppati per fornitore dagli articoli sotto scorta selezionati
  const handleGenerateAutoOrders = (targetItems: WarehouseStockItem[]) => {
    if (targetItems.length === 0) {
      showNotice('Seleziona almeno un articolo sotto scorta.');
      return;
    }

    const grouped = new Map<string, WarehouseStockItem[]>();
    targetItems.forEach((it) => {
      const supName = (it.supplier || '').trim() || 'Fornitore da assegnare';
      const list = grouped.get(supName) || [];
      list.push(it);
      grouped.set(supName, list);
    });

    const now = new Date();
    const year = now.getFullYear();
    let workingOrders = [...orders];
    const created: PurchaseOrder[] = [];

    grouped.forEach((groupItems, supName) => {
      const matchedSup = suppliersList.find(
        (s) => s.companyName.trim().toLowerCase() === supName.toLowerCase()
      );
      const { progressiveNumber, number } = getNextPoNumber(workingOrders, year);
      const expected = new Date(now);
      expected.setDate(expected.getDate() + (matchedSup?.leadTimeDays || 5));

      const poItems: PurchaseOrderItem[] = groupItems.map((invItem) => ({
        id: `poi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        inventoryItemId: invItem.id,
        sku: invItem.sku,
        name: invItem.name,
        unit: invItem.unit || 'pz',
        currentStockAtOrder: invItem.quantity,
        minStockAtOrder: invItem.minStock,
        orderedQty:
          customReorderQty[invItem.id] ??
          predictiveAlertByItemId.get(invItem.id)?.recommendedOrderQty ??
          getSuggestedReorderQty(invItem),
        receivedQty: 0,
        unitCostEur: 0,
      }));

      const supAddress = matchedSup
        ? [
            matchedSup.billingAddress,
            [matchedSup.postalCode, matchedSup.city, matchedSup.province]
              .filter(Boolean)
              .join(' '),
          ]
            .filter(Boolean)
            .join(', ')
        : '';

      const po: PurchaseOrder = {
        id: `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        number,
        progressiveNumber,
        year,
        orderDate: now.toISOString().slice(0, 10),
        expectedDeliveryDate: expected.toISOString().slice(0, 10),
        status: 'bozza',
        supplierId: matchedSup?.id,
        supplierName: matchedSup?.companyName || supName,
        supplierEmail: matchedSup?.email || '',
        supplierPhone: matchedSup?.phone || matchedSup?.mobile || '',
        supplierVat: matchedSup?.vatNumber || '',
        supplierAddress: supAddress,
        paymentTerms: matchedSup?.paymentTerms || '30 gg DFFM',
        deliveryAddress: currentUser.company || 'Magazzino Principale',
        notes: 'Riordino automatico generato da segnalazione sotto scorta minima.',
        items: poItems,
        stockLoaded: false,
        createdBy: currentUser.name,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      workingOrders = [po, ...workingOrders];
      created.push(po);
    });

    onUpdateOrders(workingOrders);
    setSelectedReorderIds({});
    setSelectedPoId(created[0].id);
    setActiveView('orders');
    showNotice(
      created.length === 1
        ? `Generato ordine ${created[0].number} per ${created[0].supplierName}.`
        : `Generati ${created.length} ordini fornitore automatici.`
    );
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    if (!editingOrder.supplierName.trim()) {
      showNotice('Specifica il nome del fornitore.');
      return;
    }
    const cleanItems = editingOrder.items.filter((it) => it.name.trim() || it.sku.trim());
    if (cleanItems.length === 0) {
      showNotice('Aggiungi almeno un articolo all’ordine.');
      return;
    }
    const updated: PurchaseOrder = {
      ...editingOrder,
      items: cleanItems,
      updatedAt: new Date().toISOString(),
    };
    const exists = orders.some((o) => o.id === updated.id);
    const next = exists
      ? orders.map((o) => (o.id === updated.id ? updated : o))
      : [updated, ...orders];
    onUpdateOrders(next);
    setSelectedPoId(updated.id);
    setEditingOrder(null);
    setIsNewMode(false);
    setActiveView('orders');
    showNotice(exists ? `Ordine ${updated.number} aggiornato.` : `Ordine ${updated.number} creato.`);
  };

  const handleChangeStatus = (poId: string, status: PurchaseOrderStatus) => {
    onUpdateOrders(
      orders.map((o) =>
        o.id === poId ? { ...o, status, updatedAt: new Date().toISOString() } : o
      )
    );
    showNotice(`Ordine aggiornato a "${STATUS_LABELS[status]}".`);
  };

  const openReceiveModal = (po: PurchaseOrder) => {
    const initialMap: Record<string, number> = {};
    po.items.forEach((it) => {
      initialMap[it.id] = Math.max(0, (it.orderedQty || 0) - (it.receivedQty || 0));
    });
    setReceiveQtyMap(initialMap);
    setReceivingOrder(po);
  };

  // Conferma ricezione merce + CARICO AUTOMATICO IN MAGAZZINO
  const handleConfirmReceiveAndLoadStock = () => {
    if (!receivingOrder) return;
    const nowIso = new Date().toISOString();
    let totalLoaded = 0;

    let nextItems = [...inventory.items];
    const newMovements: StockMovement[] = [];

    const updatedPoItems = receivingOrder.items.map((line) => {
      const incoming = Math.max(0, Number(receiveQtyMap[line.id]) || 0);
      if (incoming <= 0) return line;
      totalLoaded += incoming;

      // Trova articolo in magazzino per ID o SKU
      const existingIdx = nextItems.findIndex(
        (inv) =>
          (line.inventoryItemId && inv.id === line.inventoryItemId) ||
          (line.sku && inv.sku.trim().toLowerCase() === line.sku.trim().toLowerCase())
      );

      if (existingIdx >= 0) {
        const inv = nextItems[existingIdx];
        const prevQty = inv.quantity;
        const resultingQty = prevQty + incoming;
        nextItems[existingIdx] = {
          ...inv,
          quantity: resultingQty,
          supplier: inv.supplier || receivingOrder.supplierName,
          updatedAt: nowIso,
        };
        newMovements.push({
          id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          itemId: inv.id,
          sku: inv.sku,
          itemName: inv.name,
          unit: inv.unit || line.unit || 'pz',
          type: 'carico',
          quantity: incoming,
          previousQty: prevQty,
          resultingQty,
          reason: `Ricezione merce da Ordine ${receivingOrder.number}`,
          operatorName: currentUser.name,
          documentRef: receivingOrder.number,
          notes: `Fornitore: ${receivingOrder.supplierName}`,
          timestamp: nowIso,
        });
      } else {
        // Crea automaticamente l'articolo in magazzino se non esisteva ancora
        const newInvId = `itm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const createdInv: WarehouseStockItem = {
          id: newInvId,
          sku: line.sku || `SKU-${Date.now().toString().slice(-5)}`,
          name: line.name,
          category: 'Acquisti Fornitori',
          unit: line.unit || 'pz',
          quantity: incoming,
          minStock: line.minStockAtOrder || 0,
          location: 'Arrivo Merce',
          supplier: receivingOrder.supplierName,
          updatedAt: nowIso,
        };
        nextItems = [createdInv, ...nextItems];
        newMovements.push({
          id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          itemId: createdInv.id,
          sku: createdInv.sku,
          itemName: createdInv.name,
          unit: createdInv.unit,
          type: 'carico',
          quantity: incoming,
          previousQty: 0,
          resultingQty: incoming,
          reason: `Ricezione merce da Ordine ${receivingOrder.number}`,
          operatorName: currentUser.name,
          documentRef: receivingOrder.number,
          notes: `Fornitore: ${receivingOrder.supplierName}`,
          timestamp: nowIso,
        });
      }

      return {
        ...line,
        receivedQty: (line.receivedQty || 0) + incoming,
      };
    });

    if (totalLoaded <= 0) {
      showNotice('Inserisci almeno una quantità ricevuta maggiore di zero.');
      return;
    }

    const allReceived = updatedPoItems.every((it) => it.receivedQty >= it.orderedQty);
    const updatedOrder: PurchaseOrder = {
      ...receivingOrder,
      items: updatedPoItems,
      status: allReceived ? 'ricevuto' : 'parziale',
      receivedAt: nowIso,
      stockLoaded: true,
      updatedAt: nowIso,
    };

    onUpdateInventory({
      ...inventory,
      items: nextItems,
      movements: [...newMovements, ...inventory.movements],
    });
    onUpdateOrders(orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    setReceivingOrder(null);
    showNotice(
      `Caricate +${totalLoaded} unità in Magazzino da ${updatedOrder.number} (${newMovements.length} movimenti registrati).`
    );
  };

  const handleDownloadPdf = (po: PurchaseOrder) => {
    const pdf = generatePurchaseOrderPdf(po, currentUser.company || 'METATRON CaricoStudio');
    pdf.save(`${po.number.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`);
    showNotice(`PDF ${po.number} scaricato.`);
  };

  const handleDeleteOrder = (poId: string) => {
    const next = orders.filter((o) => o.id !== poId);
    onUpdateOrders(next);
    setConfirmDeleteId(null);
    if (selectedPoId === poId) {
      setSelectedPoId(next[0]?.id || null);
    }
    showNotice('Ordine fornitore eliminato.');
  };

  const handleExportCsv = () => {
    downloadCsvFile(
      `ordini-fornitori-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Numero Ordine',
        'Data',
        'Consegna Prevista',
        'Stato',
        'Fornitore',
        'Righe',
        'Totale Unità',
        'Imponibile Stimato (€)',
      ],
      filteredOrders.map((o) => [
        o.number,
        o.orderDate,
        o.expectedDeliveryDate || '',
        STATUS_LABELS[o.status],
        o.supplierName,
        o.items.length,
        o.items.reduce((s, i) => s + i.orderedQty, 0),
        o.items
          .reduce((s, i) => s + i.orderedQty * (i.unitCostEur || 0), 0)
          .toFixed(2),
      ])
    );
    showNotice('Archivio ordini esportato in CSV.');
  };

  const applySupplierToOrder = (supId: string) => {
    if (!editingOrder) return;
    const sup = suppliersList.find((s) => s.id === supId);
    if (!sup) return;
    const supAddress = [
      sup.billingAddress,
      [sup.postalCode, sup.city, sup.province].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ');
    setEditingOrder({
      ...editingOrder,
      supplierId: sup.id,
      supplierName: sup.companyName,
      supplierEmail: sup.email || '',
      supplierPhone: sup.phone || sup.mobile || '',
      supplierVat: sup.vatNumber || '',
      supplierAddress: supAddress,
      paymentTerms: sup.paymentTerms || editingOrder.paymentTerms,
    });
  };

  const selectedLowStockList = useMemo(
    () => lowStockItems.filter((it) => selectedReorderIds[it.id]),
    [lowStockItems, selectedReorderIds]
  );

  const buildMailtoHref = (po: PurchaseOrder): string => {
    const to = encodeURIComponent(po.supplierEmail || '');
    const subject = encodeURIComponent(
      `Ordine di Acquisto ${po.number} — ${currentUser.company || 'METATRON'}`
    );
    const lines = [
      `Buongiorno ${po.supplierName},`,
      '',
      `con la presente inviamo il nostro ordine ${po.number} del ${formatDateIt(po.orderDate)}:`,
      '',
      ...po.items.map(
        (it) => `- ${it.sku ? `[${it.sku}] ` : ''}${it.name}: ${it.orderedQty} ${it.unit}`
      ),
      '',
      po.expectedDeliveryDate
        ? `Consegna richiesta entro: ${formatDateIt(po.expectedDeliveryDate)}`
        : '',
      po.notes ? `Note: ${po.notes}` : '',
      '',
      `Cordiali saluti,`,
      `${currentUser.name}${currentUser.company ? ` — ${currentUser.company}` : ''}`,
    ]
      .filter(Boolean)
      .join('\n');
    return `mailto:${to}?subject=${subject}&body=${encodeURIComponent(lines)}`;
  };

  return (
    <div className="h-full flex bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar Sinistra */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900 tracking-tight">
            Ordini Fornitori
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {kpis.lowStockCount} sotto scorta · {orders.length} ordini
          </div>
        </div>

        <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
            Approvvigionamento
          </div>
          <button
            type="button"
            onClick={() => setActiveView('reorder')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeView === 'reorder'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Da riordinare
            </span>
            <span
              className={`font-mono tabular-nums text-[11px] ${
                activeView === 'reorder'
                  ? 'text-amber-300'
                  : kpis.lowStockCount > 0
                  ? 'text-rose-700 font-semibold'
                  : 'text-slate-400'
              }`}
            >
              {kpis.lowStockCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveView('orders');
              setStatusFilter('all');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              activeView === 'orders' && statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              Tutti gli ordini
            </span>
            <span
              className={`font-mono tabular-nums text-[11px] ${
                activeView === 'orders' && statusFilter === 'all'
                  ? 'text-slate-300'
                  : 'text-slate-400'
              }`}
            >
              {orders.length}
            </span>
          </button>

          <div className="pt-3 mt-3 border-t border-slate-200 px-2.5 pb-1 text-[11px] font-medium text-slate-400">
            Stato ordini
          </div>
          {(['bozza', 'inviato', 'confermato', 'parziale', 'ricevuto'] as PurchaseOrderStatus[]).map(
            (st) => {
              const count = orders.filter((o) => o.status === st).length;
              const active = activeView === 'orders' && statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setActiveView('orders');
                    setStatusFilter(st);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="truncate">{STATUS_LABELS[st]}</span>
                  <span
                    className={`font-mono tabular-nums text-[11px] ${
                      active ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={orders.length === 0}
            className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Esporta ordini CSV
          </button>
        </div>
      </aside>

      {/* Area Principale */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400">METATRON</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900 truncate">
              {activeView === 'reorder'
                ? 'Riordino Automatico Scorte'
                : 'Ordini di Acquisto Fornitori'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingOrder(buildBlankOrder());
                setIsNewMode(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuovo Ordine
            </button>
          </div>
        </header>

        {feedback && (
          <div className="bg-slate-900 text-white px-6 py-2 text-xs font-medium flex items-center justify-between">
            <span>{feedback}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200 bg-white divide-x divide-slate-200 shrink-0">
          <div className="px-5 py-3.5">
            <div className="text-xs text-slate-500">Articoli sotto scorta</div>
            <div
              className={`text-xl font-semibold font-mono tabular-nums mt-0.5 ${
                kpis.lowStockCount > 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              {kpis.lowStockCount}
            </div>
          </div>
          <div className="px-5 py-3.5">
            <div className="text-xs text-slate-500">Ordini in attesa consegna</div>
            <div className="text-xl font-semibold text-blue-700 font-mono tabular-nums mt-0.5">
              {kpis.openOrders}
            </div>
          </div>
          <div className="px-5 py-3.5">
            <div className="text-xs text-slate-500">Ordini ricevuti</div>
            <div className="text-xl font-semibold text-emerald-700 font-mono tabular-nums mt-0.5">
              {kpis.receivedOrders}
            </div>
          </div>
          <div className="px-5 py-3.5">
            <div className="text-xs text-slate-500">Valore ordini aperti</div>
            <div className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
              € {kpis.openValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* VISTA 1: RIORDINO AUTOMATICO SOTTO SCORTA */}
        {activeView === 'reorder' ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-600">
                <strong className="text-slate-900">Riordino predittivo &amp; sotto scorta:</strong>{' '}
                include gli articoli sotto soglia minima
                {proactiveOnlyCount > 0 ? (
                  <>
                    {' '}e{' '}
                    <strong className="text-amber-800">
                      {proactiveOnlyCount} in esaurimento previsto
                    </strong>{' '}
                    in base a consumi recenti e commesse aperte.
                  </>
                ) : (
                  ' e calcola automaticamente i quantitativi in base a consumi e commesse aperte.'
                )}
              </div>
              {lowStockItems.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const allSelected = selectedLowStockList.length === lowStockItems.length;
                      if (allSelected) {
                        setSelectedReorderIds({});
                      } else {
                        const next: Record<string, boolean> = {};
                        lowStockItems.forEach((it) => {
                          next[it.id] = true;
                        });
                        setSelectedReorderIds(next);
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    {selectedLowStockList.length === lowStockItems.length
                      ? 'Deseleziona tutti'
                      : 'Seleziona tutti'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleGenerateAutoOrders(
                        selectedLowStockList.length > 0 ? selectedLowStockList : lowStockItems
                      )
                    }
                    className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {selectedLowStockList.length > 0
                      ? `Genera ordini (${selectedLowStockList.length} art.)`
                      : `Prepara Ordini Predittivi (${lowStockItems.length} art.)`}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto bg-white">
              {lowStockItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Tutte le scorte di Magazzino sono regolari
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Nessun articolo è sotto la soglia di scorta minima. Puoi comunque creare un
                    ordine fornitore manuale in qualsiasi momento.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOrder(buildBlankOrder());
                      setIsNewMode(true);
                    }}
                    className="mt-4 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Crea ordine manuale
                  </button>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 z-10">
                    <tr>
                      <th className="py-2.5 pl-5 pr-2 w-10"></th>
                      <th className="py-2.5 px-3">SKU</th>
                      <th className="py-2.5 px-3">Articolo</th>
                      <th className="py-2.5 px-3">Fornitore</th>
                      <th className="py-2.5 px-3 text-right">Giacenza / Min.</th>
                      <th className="py-2.5 px-3 text-right">Già in ordine</th>
                      <th className="py-2.5 px-3 text-right">Q.tà da ordinare</th>
                      <th className="py-2.5 px-5 text-right">Azione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {lowStockItems.map((it) => {
                      const checked = Boolean(selectedReorderIds[it.id]);
                      const forecast = predictiveAlertByItemId.get(it.id);
                      const suggested =
                        customReorderQty[it.id] ??
                        forecast?.recommendedOrderQty ??
                        getSuggestedReorderQty(it);
                      const alreadyPending =
                        openOrderedBySku.get(it.id) ||
                        openOrderedBySku.get(it.sku.toUpperCase()) ||
                        0;
                      return (
                        <tr key={it.id} className="hover:bg-slate-50">
                          <td className="py-2.5 pl-5 pr-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedReorderIds((prev) => ({
                                  ...prev,
                                  [it.id]: e.target.checked,
                                }))
                              }
                              className="rounded border-slate-300 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {it.sku}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">{it.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {it.category} · Pos. {it.location || '—'}
                            </div>
                            {forecast && (
                              <div
                                className={`text-[11px] font-medium mt-0.5 ${
                                  forecast.urgency === 'critico'
                                    ? 'text-rose-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {forecast.reason}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {it.supplier || (
                              <span className="text-slate-400">Non assegnato</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            <span
                              className={`font-semibold ${
                                it.quantity <= it.minStock
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {it.quantity}
                            </span>
                            <span className="text-slate-400"> / {it.minStock} {it.unit}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                            {alreadyPending > 0 ? (
                              <span className="text-blue-700 font-medium">
                                +{alreadyPending} {it.unit}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={1}
                              value={suggested}
                              onChange={(e) =>
                                setCustomReorderQty((prev) => ({
                                  ...prev,
                                  [it.id]: Math.max(1, Number(e.target.value) || 1),
                                }))
                              }
                              className="w-20 px-2 py-1 text-right font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:border-slate-400"
                            />
                          </td>
                          <td className="py-2.5 px-5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleGenerateAutoOrders([it])}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer"
                            >
                              Ordina
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* VISTA 2: ARCHIVIO ORDINI FORNITORI */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca per numero ordine, fornitore o SKU articolo..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="text-xs text-slate-500 tabular-nums">
                {filteredOrders.length} ordini
              </div>
            </div>

            <div className="flex-1 flex min-h-0 overflow-hidden">
              <div className="flex-1 overflow-auto bg-white">
                {filteredOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                    <ShoppingCart className="w-10 h-10 text-slate-300 mb-3" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Nessun ordine fornitore presente
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1">
                      Genera un ordine dagli articoli sotto scorta oppure creane uno nuovo.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 z-10">
                      <tr>
                        <th className="py-2.5 px-4">Numero</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Fornitore</th>
                        <th className="py-2.5 px-3 text-right">Articoli / Q.tà</th>
                        <th className="py-2.5 px-3 text-right">Imponibile</th>
                        <th className="py-2.5 px-4 text-right">Stato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredOrders.map((o) => {
                        const isSelected = selectedOrder?.id === o.id;
                        const totalUnits = o.items.reduce((s, i) => s + i.orderedQty, 0);
                        const totalVal = o.items.reduce(
                          (s, i) => s + i.orderedQty * (i.unitCostEur || 0),
                          0
                        );
                        return (
                          <tr
                            key={o.id}
                            onClick={() => setSelectedPoId(o.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                              {o.number}
                            </td>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                              {formatDateIt(o.orderDate)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-900 truncate max-w-[200px]">
                                {o.supplierName}
                              </div>
                              {o.expectedDeliveryDate && (
                                <div className="text-[11px] text-slate-400">
                                  Consegna prev. {formatDateIt(o.expectedDeliveryDate)}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {o.items.length} righe · {totalUnits} u.
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                              {totalVal > 0
                                ? `€ ${totalVal.toLocaleString('it-IT', {
                                    minimumFractionDigits: 2,
                                  })}`
                                : '—'}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <span className={`font-medium ${STATUS_TEXT_CLASS[o.status]}`}>
                                {STATUS_LABELS[o.status]}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Inspector Ordine */}
              {selectedOrder && (
                <aside className="w-[410px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          {selectedOrder.number}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span
                          className={`text-xs font-medium ${
                            STATUS_TEXT_CLASS[selectedOrder.status]
                          }`}
                        >
                          {STATUS_LABELS[selectedOrder.status]}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {selectedOrder.supplierName}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(selectedOrder)}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOrder(selectedOrder);
                          setIsNewMode(false);
                        }}
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
                    {/* Azione principale: Ricevi Merce e Carica Magazzino */}
                    {selectedOrder.status !== 'ricevuto' &&
                      selectedOrder.status !== 'annullato' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openReceiveModal(selectedOrder)}
                            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            Ricevi Merce & Carica Magazzino
                          </button>
                          <a
                            href={buildMailtoHref(selectedOrder)}
                            className="px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Email
                          </a>
                        </div>
                      )}

                    {/* Avanzamento stato */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                        Stato ordine
                      </div>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                        {(['bozza', 'inviato', 'confermato'] as PurchaseOrderStatus[]).map(
                          (st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleChangeStatus(selectedOrder.id, st)}
                              className={`py-1.5 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                                selectedOrder.status === st
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              {STATUS_LABELS[st]}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Dettagli fornitore */}
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Data ordine</span>
                        <span className="font-mono tabular-nums text-slate-900">
                          {formatDateIt(selectedOrder.orderDate)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Consegna prevista</span>
                        <span className="font-mono tabular-nums text-slate-900">
                          {formatDateIt(selectedOrder.expectedDeliveryDate)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Pagamento</span>
                        <span className="text-slate-900">
                          {selectedOrder.paymentTerms || 'Come da accordi'}
                        </span>
                      </div>
                      {selectedOrder.supplierEmail && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Email fornitore</span>
                          <span className="text-slate-900 truncate max-w-[200px]">
                            {selectedOrder.supplierEmail}
                          </span>
                        </div>
                      )}
                      {selectedOrder.stockLoaded && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Carico Magazzino</span>
                          <span className="text-emerald-700 font-medium flex items-center gap-1">
                            <PackageCheck className="w-3.5 h-3.5" />
                            Registrato
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Righe articoli */}
                    <div className="border-t border-slate-100 pt-4">
                      <div className="text-[11px] font-medium text-slate-500 mb-2">
                        Articoli ordinati ({selectedOrder.items.length})
                      </div>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {selectedOrder.items.map((it) => (
                          <div
                            key={it.id}
                            className="px-3 py-2 flex items-center justify-between gap-2 bg-white"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">
                                {it.name}
                              </div>
                              <div className="text-[11px] font-mono text-slate-400">
                                {it.sku || 'Senza SKU'}
                                {it.unitCostEur > 0
                                  ? ` · € ${it.unitCostEur.toFixed(2)}/${it.unit}`
                                  : ''}
                              </div>
                            </div>
                            <div className="text-right font-mono tabular-nums whitespace-nowrap">
                              <div className="font-semibold text-slate-900">
                                {it.orderedQty} {it.unit}
                              </div>
                              {it.receivedQty > 0 && (
                                <div className="text-[11px] text-emerald-700">
                                  Ric. {it.receivedQty}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedOrder.notes && (
                      <div className="border-t border-slate-100 pt-4">
                        <div className="text-[11px] font-medium text-slate-500 mb-1">Note</div>
                        <p className="text-slate-700">{selectedOrder.notes}</p>
                      </div>
                    )}

                    {/* Elimina */}
                    <div className="border-t border-slate-100 pt-4 flex justify-end">
                      {confirmDeleteId === selectedOrder.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(selectedOrder.id)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                          >
                            Conferma elimina
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                          >
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(selectedOrder.id)}
                          className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Elimina ordine
                        </button>
                      )}
                    </div>
                  </div>
                </aside>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALE EDITOR ORDINE FORNITORE */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveOrder}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {isNewMode
                    ? `Nuovo Ordine Fornitore · ${editingOrder.number}`
                    : `Modifica ${editingOrder.number}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ordine di acquisto con PDF A4 e carico automatico in Magazzino alla ricezione
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Numero Ordine *</label>
                  <input
                    type="text"
                    required
                    value={editingOrder.number}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, number: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Data Ordine</label>
                  <input
                    type="date"
                    value={editingOrder.orderDate}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, orderDate: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Consegna richiesta
                  </label>
                  <input
                    type="date"
                    value={editingOrder.expectedDeliveryDate || ''}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, expectedDeliveryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pagamento</label>
                  <input
                    type="text"
                    value={editingOrder.paymentTerms || ''}
                    onChange={(e) =>
                      setEditingOrder({ ...editingOrder, paymentTerms: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Fornitore */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">Dati Fornitore</div>
                  {suppliersList.length > 0 && (
                    <select
                      value={editingOrder.supplierId || ''}
                      onChange={(e) => applySupplierToOrder(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="">Compila da Rubrica Fornitori...</option>
                      {suppliersList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.companyName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Ragione Sociale Fornitore *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingOrder.supplierName}
                      onChange={(e) =>
                        setEditingOrder({ ...editingOrder, supplierName: e.target.value })
                      }
                      placeholder="Es. Ferramenta Industriale S.p.A."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Email Ordini</label>
                    <input
                      type="email"
                      value={editingOrder.supplierEmail || ''}
                      onChange={(e) =>
                        setEditingOrder({ ...editingOrder, supplierEmail: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Telefono</label>
                    <input
                      type="text"
                      value={editingOrder.supplierPhone || ''}
                      onChange={(e) =>
                        setEditingOrder({ ...editingOrder, supplierPhone: e.target.value })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Articoli dell'ordine */}
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    Articoli da ordinare ({editingOrder.items.length})
                  </div>
                  <div className="flex items-center gap-2">
                    {inventory.items.length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const inv = inventory.items.find((x) => x.id === e.target.value);
                          if (!inv) return;
                          setEditingOrder({
                            ...editingOrder,
                            items: [
                              ...editingOrder.items,
                              {
                                id: `poi_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                                inventoryItemId: inv.id,
                                sku: inv.sku,
                                name: inv.name,
                                unit: inv.unit || 'pz',
                                currentStockAtOrder: inv.quantity,
                                minStockAtOrder: inv.minStock,
                                orderedQty: getSuggestedReorderQty(inv),
                                receivedQty: 0,
                                unitCostEur: 0,
                              },
                            ],
                          });
                        }}
                        className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-700 max-w-[240px]"
                      >
                        <option value="">+ Aggiungi da Magazzino...</option>
                        {inventory.items.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            [{inv.sku}] {inv.name} (giac. {inv.quantity})
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setEditingOrder({
                          ...editingOrder,
                          items: [
                            ...editingOrder.items,
                            {
                              id: `poi_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                              sku: '',
                              name: '',
                              unit: 'pz',
                              currentStockAtOrder: 0,
                              minStockAtOrder: 0,
                              orderedQty: 10,
                              receivedQty: 0,
                              unitCostEur: 0,
                            },
                          ],
                        })
                      }
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Riga libera
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {editingOrder.items.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-lg">
                      Scegli gli articoli dal menu &ldquo;Aggiungi da Magazzino&rdquo; oppure
                      aggiungi una riga libera.
                    </div>
                  ) : (
                    editingOrder.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                      >
                        <input
                          type="text"
                          placeholder="SKU"
                          value={item.sku}
                          onChange={(e) => {
                            const nextItems = [...editingOrder.items];
                            nextItems[idx] = { ...item, sku: e.target.value };
                            setEditingOrder({ ...editingOrder, items: nextItems });
                          }}
                          className="col-span-2 px-2 py-1.5 font-mono bg-white border border-slate-200 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Descrizione *"
                          value={item.name}
                          onChange={(e) => {
                            const nextItems = [...editingOrder.items];
                            nextItems[idx] = { ...item, name: e.target.value };
                            setEditingOrder({ ...editingOrder, items: nextItems });
                          }}
                          className="col-span-4 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                        />
                        <input
                          type="text"
                          placeholder="U.M."
                          value={item.unit}
                          onChange={(e) => {
                            const nextItems = [...editingOrder.items];
                            nextItems[idx] = { ...item, unit: e.target.value };
                            setEditingOrder({ ...editingOrder, items: nextItems });
                          }}
                          className="col-span-1 px-1.5 py-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Q.tà"
                          value={item.orderedQty}
                          onChange={(e) => {
                            const nextItems = [...editingOrder.items];
                            nextItems[idx] = {
                              ...item,
                              orderedQty: Math.max(1, Number(e.target.value) || 1),
                            };
                            setEditingOrder({ ...editingOrder, items: nextItems });
                          }}
                          className="col-span-2 px-2 py-1.5 font-mono bg-white border border-slate-200 rounded text-xs text-right"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="€ unit."
                          value={item.unitCostEur}
                          onChange={(e) => {
                            const nextItems = [...editingOrder.items];
                            nextItems[idx] = {
                              ...item,
                              unitCostEur: Math.max(0, Number(e.target.value) || 0),
                            };
                            setEditingOrder({ ...editingOrder, items: nextItems });
                          }}
                          className="col-span-2 px-2 py-1.5 font-mono bg-white border border-slate-200 rounded text-xs text-right"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditingOrder({
                              ...editingOrder,
                              items: editingOrder.items.filter((_, i) => i !== idx),
                            })
                          }
                          className="col-span-1 flex items-center justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Note ordine</label>
                <input
                  type="text"
                  value={editingOrder.notes || ''}
                  onChange={(e) => setEditingOrder({ ...editingOrder, notes: e.target.value })}
                  placeholder="Urgenza, riferimenti interni, istruzioni consegna..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Salva Ordine
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE RICEZIONE MERCE & CARICO MAGAZZINO */}
      {receivingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Ricezione Merce · {receivingOrder.number}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Le quantità confermate vengono caricate subito nel Magazzino e registrate nei
                  movimenti.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceivingOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              {receivingOrder.items.map((line) => {
                const remaining = Math.max(0, line.orderedQty - (line.receivedQty || 0));
                return (
                  <div
                    key={line.id}
                    className="flex items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 truncate">{line.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {line.sku || 'Senza SKU'} · Ordinati {line.orderedQty} · Già ricevuti{' '}
                        {line.receivedQty || 0}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-slate-500">Arrivati ora:</span>
                      <input
                        type="number"
                        min={0}
                        value={receiveQtyMap[line.id] ?? remaining}
                        onChange={(e) =>
                          setReceiveQtyMap((prev) => ({
                            ...prev,
                            [line.id]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                        className="w-20 px-2 py-1.5 text-right font-mono bg-white border border-slate-300 rounded-md"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReceivingOrder(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfirmReceiveAndLoadStock}
                className="px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                Conferma & Carica in Magazzino
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
