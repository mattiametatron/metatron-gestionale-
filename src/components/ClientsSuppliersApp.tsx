import React, { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Star,
  Download,
  Edit3,
  Trash2,
  X,
  Phone,
  Mail,
  MapPin,
  Truck,
  FileText,
  ShoppingCart,
  FolderPlus,
  RefreshCw,
  ExternalLink,
  Package,
} from 'lucide-react';
import {
  CargoLoad,
  CrmContact,
  CrmContactKind,
  DdtDocument,
  PurchaseOrder,
  WarehouseInventoryState,
} from '../types/warehouse';
import { downloadCsvFile } from '../utils/businessPdfGenerator';

interface ClientsSuppliersAppProps {
  contacts: CrmContact[];
  loads: CargoLoad[];
  inventory: WarehouseInventoryState;
  ddtDocuments: DdtDocument[];
  purchaseOrders: PurchaseOrder[];
  onUpdateContacts: (next: CrmContact[]) => void;
  onCreateLoadForClient: (contact: CrmContact) => void;
  onCreateDdtForClient: (contactId: string) => void;
  onCreatePoForSupplier: (contactId: string) => void;
  onOpenCommessa: (loadId: string) => void;
}

const KIND_LABELS: Record<CrmContactKind, string> = {
  cliente: 'Cliente',
  fornitore: 'Fornitore',
  entrambi: 'Cliente & Fornitore',
};

const KIND_TEXT_CLASS: Record<CrmContactKind, string> = {
  cliente: 'text-blue-700',
  fornitore: 'text-emerald-700',
  entrambi: 'text-violet-700',
};

function generateNextCode(contacts: CrmContact[], kind: CrmContactKind): string {
  const prefix = kind === 'fornitore' ? 'FOR' : 'CLI';
  const count = contacts.filter((c) => c.code.startsWith(prefix)).length + 1;
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

export const ClientsSuppliersApp: React.FC<ClientsSuppliersAppProps> = ({
  contacts,
  loads,
  inventory,
  ddtDocuments,
  purchaseOrders,
  onUpdateContacts,
  onCreateLoadForClient,
  onCreateDdtForClient,
  onCreatePoForSupplier,
  onOpenCommessa,
}) => {
  const [filterKind, setFilterKind] = useState<'all' | CrmContactKind | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(contacts[0]?.id || null);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);
  const [isNewMode, setIsNewMode] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback((curr) => (curr === msg ? null : curr)), 3200);
  };

  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      if (Boolean(b.isFavorite) !== Boolean(a.isFavorite)) {
        return b.isFavorite ? 1 : -1;
      }
      return a.companyName.localeCompare(b.companyName, 'it');
    });
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedContacts.filter((c) => {
      if (filterKind === 'favorites' && !c.isFavorite) return false;
      if (
        filterKind !== 'all' &&
        filterKind !== 'favorites' &&
        c.kind !== filterKind &&
        !(c.kind === 'entrambi' && (filterKind === 'cliente' || filterKind === 'fornitore'))
      ) {
        return false;
      }
      if (!q) return true;
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.contactName || '').toLowerCase().includes(q) ||
        (c.vatNumber || '').toLowerCase().includes(q) ||
        (c.city || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      );
    });
  }, [sortedContacts, filterKind, searchQuery]);

  const selectedContact = useMemo(() => {
    return (
      filteredContacts.find((c) => c.id === selectedId) ||
      contacts.find((c) => c.id === selectedId) ||
      filteredContacts[0] ||
      null
    );
  }, [filteredContacts, contacts, selectedId]);

  const kpis = useMemo(() => {
    const clienti = contacts.filter((c) => c.kind === 'cliente' || c.kind === 'entrambi').length;
    const fornitori = contacts.filter(
      (c) => c.kind === 'fornitore' || c.kind === 'entrambi'
    ).length;
    const preferiti = contacts.filter((c) => c.isFavorite).length;
    return { total: contacts.length, clienti, fornitori, preferiti };
  }, [contacts]);

  // Collegamenti reali tra la scheda selezionata e il resto del gestionale
  const linkedData = useMemo(() => {
    if (!selectedContact) {
      return { loads: [], ddts: [], items: [], orders: [] };
    }
    const target = selectedContact.companyName.trim().toLowerCase();
    const matchedLoads = loads.filter(
      (l) => (l.client || '').trim().toLowerCase() === target
    );
    const matchedDdts = ddtDocuments.filter(
      (d) =>
        d.clientId === selectedContact.id ||
        d.recipientName.trim().toLowerCase() === target
    );
    const matchedItems = inventory.items.filter(
      (it) => (it.supplier || '').trim().toLowerCase() === target
    );
    const matchedOrders = purchaseOrders.filter(
      (o) =>
        o.supplierId === selectedContact.id ||
        o.supplierName.trim().toLowerCase() === target
    );
    return {
      loads: matchedLoads,
      ddts: matchedDdts,
      items: matchedItems,
      orders: matchedOrders,
    };
  }, [selectedContact, loads, ddtDocuments, inventory.items, purchaseOrders]);

  const createEmptyContact = (defaultKind: CrmContactKind = 'cliente'): CrmContact => {
    const now = new Date().toISOString();
    return {
      id: `crm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: defaultKind,
      code: generateNextCode(contacts, defaultKind),
      companyName: '',
      contactName: '',
      vatNumber: '',
      sdiCode: '',
      email: '',
      phone: '',
      mobile: '',
      website: '',
      billingAddress: '',
      shippingAddress: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'Italia',
      defaultCarrier: '',
      paymentTerms: '30 gg DFFM',
      leadTimeDays: defaultKind === 'fornitore' ? 5 : undefined,
      notes: '',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    };
  };

  // Import automatico da commesse esistenti (clienti) e magazzino (fornitori)
  const handleAutoImportFromWorkspace = () => {
    const existingByName = new Map<string, CrmContact>();
    contacts.forEach((c) => existingByName.set(c.companyName.trim().toLowerCase(), c));

    const added: CrmContact[] = [];
    const now = new Date().toISOString();

    loads.forEach((ld) => {
      const name = (ld.client || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!existingByName.has(key)) {
        const contact: CrmContact = {
          id: `crm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kind: 'cliente',
          code: generateNextCode([...contacts, ...added], 'cliente'),
          companyName: name,
          shippingAddress: ld.destination || '',
          defaultCarrier: ld.carrier || '',
          country: 'Italia',
          createdAt: now,
          updatedAt: now,
        };
        existingByName.set(key, contact);
        added.push(contact);
      }
    });

    inventory.items.forEach((it) => {
      const name = (it.supplier || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      const existing = existingByName.get(key);
      if (!existing) {
        const contact: CrmContact = {
          id: `crm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          kind: 'fornitore',
          code: generateNextCode([...contacts, ...added], 'fornitore'),
          companyName: name,
          country: 'Italia',
          leadTimeDays: 5,
          createdAt: now,
          updatedAt: now,
        };
        existingByName.set(key, contact);
        added.push(contact);
      }
    });

    if (added.length === 0) {
      showNotice('Tutti i clienti delle commesse e i fornitori di magazzino sono già in rubrica.');
      return;
    }

    const next = [...added, ...contacts];
    onUpdateContacts(next);
    setSelectedId(added[0].id);
    showNotice(`Importate ${added.length} anagrafiche da Commesse e Magazzino.`);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    if (!editingContact.companyName.trim()) {
      showNotice('Inserisci la ragione sociale.');
      return;
    }
    const updated: CrmContact = {
      ...editingContact,
      companyName: editingContact.companyName.trim(),
      updatedAt: new Date().toISOString(),
    };
    const exists = contacts.some((c) => c.id === updated.id);
    const next = exists
      ? contacts.map((c) => (c.id === updated.id ? updated : c))
      : [updated, ...contacts];
    onUpdateContacts(next);
    setSelectedId(updated.id);
    setEditingContact(null);
    setIsNewMode(false);
    showNotice(exists ? 'Anagrafica aggiornata.' : `${updated.companyName} aggiunta in rubrica.`);
  };

  const handleToggleFavorite = (contactId: string) => {
    onUpdateContacts(
      contacts.map((c) =>
        c.id === contactId
          ? { ...c, isFavorite: !c.isFavorite, updatedAt: new Date().toISOString() }
          : c
      )
    );
  };

  const handleDelete = (contactId: string) => {
    const next = contacts.filter((c) => c.id !== contactId);
    onUpdateContacts(next);
    setConfirmDeleteId(null);
    if (selectedId === contactId) {
      setSelectedId(next[0]?.id || null);
    }
    showNotice('Anagrafica rimossa.');
  };

  const handleExportCsv = () => {
    downloadCsvFile(
      `rubrica-clienti-fornitori-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Codice',
        'Tipo',
        'Ragione Sociale',
        'Referente',
        'P.IVA / CF',
        'Email',
        'Telefono',
        'Città',
        'Indirizzo Spedizione',
        'Corriere',
        'Pagamento',
      ],
      filteredContacts.map((c) => [
        c.code,
        KIND_LABELS[c.kind],
        c.companyName,
        c.contactName || '',
        c.vatNumber || '',
        c.email || '',
        c.phone || c.mobile || '',
        [c.city, c.province].filter(Boolean).join(' '),
        c.shippingAddress || c.billingAddress || '',
        c.defaultCarrier || '',
        c.paymentTerms || '',
      ])
    );
    showNotice('Rubrica esportata in CSV.');
  };

  return (
    <div className="h-full flex bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar Sinistra */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900 tracking-tight">
            Clienti & Fornitori
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {kpis.clienti} clienti · {kpis.fornitori} fornitori
          </div>
        </div>

        <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
            Rubrica aziendale
          </div>
          {(
            [
              { id: 'all', label: 'Tutte le anagrafiche', count: kpis.total },
              { id: 'cliente', label: 'Clienti', count: kpis.clienti },
              { id: 'fornitore', label: 'Fornitori', count: kpis.fornitori },
              { id: 'favorites', label: 'Preferiti', count: kpis.preferiti },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setFilterKind(nav.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterKind === nav.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="truncate">{nav.label}</span>
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  filterKind === nav.id ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {nav.count}
              </span>
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-slate-200 px-2 space-y-2">
            <div className="text-[11px] font-medium text-slate-500">
              Sincronizzazione rapida
            </div>
            <button
              type="button"
              onClick={handleAutoImportFromWorkspace}
              className="w-full px-2.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 cursor-pointer text-left"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              <span className="leading-snug">Importa da Commesse e Magazzino</span>
            </button>
          </div>
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredContacts.length === 0}
            className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Esporta rubrica CSV
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
              Anagrafica Clienti & Fornitori
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingContact(createEmptyContact('fornitore'));
                setIsNewMode(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuovo Fornitore
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingContact(createEmptyContact('cliente'));
                setIsNewMode(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuovo Cliente
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
            <div className="text-xs text-slate-500">Totale Anagrafiche</div>
            <div className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
              {kpis.total}
            </div>
          </div>
          <div className="px-5 py-3.5">
            <div className="text-xs text-slate-500">Clienti attivi</div>
            <div className="text-xl font-semibold text-blue-700 font-mono tabular-nums mt-0.5">
              {kpis.clienti}
            </div>
          </div>
          <div className="px-5 py-3.5">
            <div className="text-xs text-slate-500">Fornitori attivi</div>
            <div className="text-xl font-semibold text-emerald-700 font-mono tabular-nums mt-0.5">
              {kpis.fornitori}
            </div>
          </div>
          <div className="px-5 py-3.5">
            <div className="text-xs text-slate-500">Preferiti</div>
            <div className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
              {kpis.preferiti}
            </div>
          </div>
        </div>

        {/* Barra ricerca */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca ragione sociale, P.IVA, città, referente o codice..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-400"
            />
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            {filteredContacts.length} contatti
          </div>
        </div>

        {/* Master-Detail */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="flex-1 overflow-auto bg-white">
            {filteredContacts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <Building2 className="w-10 h-10 text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Nessuna anagrafica trovata
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Aggiungi un cliente o fornitore oppure importa automaticamente i nominativi già
                  presenti nelle commesse e nel magazzino.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={handleAutoImportFromWorkspace}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                  >
                    Importa automaticamente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingContact(createEmptyContact('cliente'));
                      setIsNewMode(true);
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    Crea scheda manuale
                  </button>
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 z-10">
                  <tr>
                    <th className="py-2.5 pl-4 pr-2 w-8"></th>
                    <th className="py-2.5 px-3">Codice</th>
                    <th className="py-2.5 px-3">Ragione Sociale</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Località</th>
                    <th className="py-2.5 px-4">Contatto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredContacts.map((c) => {
                    const isSelected = selectedContact?.id === c.id;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 pl-4 pr-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(c.id);
                            }}
                            aria-label="Preferito"
                            className="text-slate-300 hover:text-amber-500 cursor-pointer"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                c.isFavorite ? 'fill-amber-400 text-amber-400' : ''
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {c.code || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900 truncate max-w-[220px]">
                            {c.companyName}
                          </div>
                          {c.vatNumber && (
                            <div className="text-[11px] font-mono text-slate-400">
                              {c.vatNumber}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`font-medium ${KIND_TEXT_CLASS[c.kind]}`}>
                            {KIND_LABELS[c.kind]}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[160px]">
                          {[c.city, c.province ? `(${c.province})` : ''].filter(Boolean).join(' ') ||
                            '—'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 truncate max-w-[190px]">
                          {c.email || c.phone || c.mobile || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Inspector Destro */}
          {selectedContact && (
            <aside className="w-[410px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-slate-500">{selectedContact.code}</span>
                    <span className="text-slate-300">·</span>
                    <span className={`font-medium ${KIND_TEXT_CLASS[selectedContact.kind]}`}>
                      {KIND_LABELS[selectedContact.kind]}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mt-0.5 truncate">
                    {selectedContact.companyName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(selectedContact);
                    setIsNewMode(false);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Modifica
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
                {/* Azioni rapide collegate */}
                <div className="flex flex-wrap gap-2">
                  {(selectedContact.kind === 'cliente' || selectedContact.kind === 'entrambi') && (
                    <>
                      <button
                        type="button"
                        onClick={() => onCreateLoadForClient(selectedContact)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        Nuova Commessa
                      </button>
                      <button
                        type="button"
                        onClick={() => onCreateDdtForClient(selectedContact.id)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Nuovo DDT
                      </button>
                    </>
                  )}
                  {(selectedContact.kind === 'fornitore' ||
                    selectedContact.kind === 'entrambi') && (
                    <button
                      type="button"
                      onClick={() => onCreatePoForSupplier(selectedContact.id)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Nuovo Ordine Fornitore
                    </button>
                  )}
                </div>

                {/* Dati anagrafici */}
                <div className="space-y-2 border-t border-slate-100 pt-4">
                  {selectedContact.contactName && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Referente</span>
                      <span className="text-slate-900 font-medium">
                        {selectedContact.contactName}
                      </span>
                    </div>
                  )}
                  {selectedContact.vatNumber && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">P.IVA / C.F.</span>
                      <span className="font-mono text-slate-900">{selectedContact.vatNumber}</span>
                    </div>
                  )}
                  {selectedContact.sdiCode && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">SDI / PEC</span>
                      <span className="font-mono text-slate-900">{selectedContact.sdiCode}</span>
                    </div>
                  )}
                  {selectedContact.email && (
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </span>
                      <a
                        href={`mailto:${selectedContact.email}`}
                        className="text-blue-700 hover:underline truncate max-w-[220px]"
                      >
                        {selectedContact.email}
                      </a>
                    </div>
                  )}
                  {(selectedContact.phone || selectedContact.mobile) && (
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> Telefono
                      </span>
                      <span className="font-mono text-slate-900">
                        {[selectedContact.phone, selectedContact.mobile]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  )}
                  {selectedContact.defaultCarrier && (
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" /> Corriere abituale
                      </span>
                      <span className="text-slate-900">{selectedContact.defaultCarrier}</span>
                    </div>
                  )}
                  {selectedContact.paymentTerms && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Pagamento</span>
                      <span className="text-slate-900">{selectedContact.paymentTerms}</span>
                    </div>
                  )}
                </div>

                {/* Indirizzi */}
                {(selectedContact.billingAddress ||
                  selectedContact.shippingAddress ||
                  selectedContact.city) && (
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Indirizzi
                    </div>
                    {selectedContact.billingAddress && (
                      <div>
                        <div className="text-[11px] text-slate-400">Sede legale</div>
                        <div className="text-slate-800">
                          {selectedContact.billingAddress}
                          {selectedContact.city
                            ? `, ${[
                                selectedContact.postalCode,
                                selectedContact.city,
                                selectedContact.province,
                              ]
                                .filter(Boolean)
                                .join(' ')}`
                            : ''}
                        </div>
                      </div>
                    )}
                    {selectedContact.shippingAddress && (
                      <div>
                        <div className="text-[11px] text-slate-400">Scarico / Spedizione</div>
                        <div className="text-slate-800">{selectedContact.shippingAddress}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Storico Commesse & DDT collegati */}
                {(selectedContact.kind === 'cliente' || selectedContact.kind === 'entrambi') && (
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <div className="text-[11px] font-medium text-slate-500">
                      Storico Commesse ({linkedData.loads.length}) · DDT ({linkedData.ddts.length})
                    </div>
                    {linkedData.loads.length === 0 ? (
                      <div className="text-slate-400">Nessuna commessa registrata.</div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {linkedData.loads.slice(0, 6).map((ld) => (
                          <button
                            key={ld.id}
                            type="button"
                            onClick={() => onOpenCommessa(ld.id)}
                            className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="font-mono font-semibold text-slate-900">
                                {ld.code}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate">
                                {ld.title}
                              </div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Storico Articoli & Ordini Fornitore */}
                {(selectedContact.kind === 'fornitore' ||
                  selectedContact.kind === 'entrambi') && (
                  <div className="border-t border-slate-100 pt-4 space-y-2">
                    <div className="text-[11px] font-medium text-slate-500">
                      Articoli Magazzino ({linkedData.items.length}) · Ordini (
                      {linkedData.orders.length})
                    </div>
                    {linkedData.items.length === 0 ? (
                      <div className="text-slate-400">
                        Nessun articolo di magazzino associato a questo fornitore.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                        {linkedData.items.slice(0, 6).map((it) => {
                          const low = it.quantity <= it.minStock;
                          return (
                            <div
                              key={it.id}
                              className="px-3 py-2 flex items-center justify-between gap-2 bg-white"
                            >
                              <div className="min-w-0">
                                <div className="font-medium text-slate-900 truncate">
                                  {it.name}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  {it.sku}
                                </div>
                              </div>
                              <div
                                className={`font-mono tabular-nums font-semibold whitespace-nowrap ${
                                  low ? 'text-rose-700' : 'text-slate-800'
                                }`}
                              >
                                {it.quantity} {it.unit} {low ? '(Sotto scorta)' : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {selectedContact.notes && (
                  <div className="border-t border-slate-100 pt-4">
                    <div className="text-[11px] font-medium text-slate-500 mb-1">Note</div>
                    <p className="text-slate-700 whitespace-pre-line">{selectedContact.notes}</p>
                  </div>
                )}

                {/* Elimina */}
                <div className="border-t border-slate-100 pt-4 flex justify-end">
                  {confirmDeleteId === selectedContact.id ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(selectedContact.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                      >
                        Conferma eliminazione
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
                      onClick={() => setConfirmDeleteId(selectedContact.id)}
                      className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina scheda
                    </button>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* MODALE CREAZIONE / MODIFICA ANAGRAFICA */}
      {editingContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveContact}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {isNewMode ? 'Nuova Anagrafica' : `Modifica ${editingContact.companyName}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tipologia</label>
                  <select
                    value={editingContact.kind}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        kind: e.target.value as CrmContactKind,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="cliente">Cliente</option>
                    <option value="fornitore">Fornitore</option>
                    <option value="entrambi">Cliente & Fornitore</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Codice interno</label>
                  <input
                    type="text"
                    value={editingContact.code}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, code: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">P.IVA / C.F.</label>
                  <input
                    type="text"
                    value={editingContact.vatNumber || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, vatNumber: e.target.value })
                    }
                    placeholder="IT01234567890"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Ragione Sociale *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingContact.companyName}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, companyName: e.target.value })
                    }
                    placeholder="Es. Officine Bianchi S.r.l."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Persona di riferimento
                  </label>
                  <input
                    type="text"
                    value={editingContact.contactName || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, contactName: e.target.value })
                    }
                    placeholder="Es. Marco Bianchi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editingContact.email || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, email: e.target.value })
                    }
                    placeholder="ordini@azienda.it"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Telefono</label>
                  <input
                    type="text"
                    value={editingContact.phone || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Codice SDI / PEC</label>
                  <input
                    type="text"
                    value={editingContact.sdiCode || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, sdiCode: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Indirizzo Sede Legale
                  </label>
                  <input
                    type="text"
                    value={editingContact.billingAddress || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, billingAddress: e.target.value })
                    }
                    placeholder="Via Industria 24"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Indirizzo Spedizione / Scarico
                  </label>
                  <input
                    type="text"
                    value={editingContact.shippingAddress || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, shippingAddress: e.target.value })
                    }
                    placeholder="Se diverso dalla sede legale"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Città</label>
                  <input
                    type="text"
                    value={editingContact.city || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, city: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Provincia</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editingContact.province || ''}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        province: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="MI"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">CAP</label>
                  <input
                    type="text"
                    value={editingContact.postalCode || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, postalCode: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Corriere abituale
                  </label>
                  <input
                    type="text"
                    value={editingContact.defaultCarrier || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, defaultCarrier: e.target.value })
                    }
                    placeholder="BRT / GLS / Proprio"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Condizioni pagamento
                  </label>
                  <input
                    type="text"
                    value={editingContact.paymentTerms || ''}
                    onChange={(e) =>
                      setEditingContact({ ...editingContact, paymentTerms: e.target.value })
                    }
                    placeholder="30 gg DFFM"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Giorni consegna (Fornitore)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={editingContact.leadTimeDays ?? ''}
                    onChange={(e) =>
                      setEditingContact({
                        ...editingContact,
                        leadTimeDays:
                          e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                      })
                    }
                    placeholder="5"
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Note operative</label>
                <textarea
                  rows={2}
                  value={editingContact.notes || ''}
                  onChange={(e) =>
                    setEditingContact({ ...editingContact, notes: e.target.value })
                  }
                  placeholder="Orari scarico, ribalta, referenti magazzino..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Salva anagrafica
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
