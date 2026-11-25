import React, { useMemo, useRef, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Download,
  PenTool,
  Truck,
  CheckCircle2,
  Copy,
  Trash2,
  Edit3,
  X,
  Package,
  Calendar,
  ExternalLink,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import {
  AuthUser,
  CargoLoad,
  CrmContact,
  DdtCausal,
  DdtDocument,
  DdtLineItem,
  DdtStatus,
  DdtTransportBy,
} from '../types/warehouse';
import { calculateLoadSummary } from '../utils/calculations';
import { downloadCsvFile, generateDdtPdf } from '../utils/businessPdfGenerator';

interface DdtDocumentsAppProps {
  documents: DdtDocument[];
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  contacts: CrmContact[];
  currentUser: AuthUser;
  initialCommessaId?: string | null;
  initialClientId?: string | null;
  onClearInitialIntent?: () => void;
  onUpdateDocuments: (next: DdtDocument[]) => void;
  onOpenCommessa?: (loadId: string) => void;
}

const STATUS_LABELS: Record<DdtStatus, string> = {
  bozza: 'Bozza',
  emesso: 'Emesso',
  in_transito: 'In Transito',
  consegnato: 'Consegnato',
  annullato: 'Annullato',
};

const STATUS_TEXT_CLASS: Record<DdtStatus, string> = {
  bozza: 'text-slate-600',
  emesso: 'text-blue-700',
  in_transito: 'text-amber-700',
  consegnato: 'text-emerald-700',
  annullato: 'text-rose-700',
};

const CAUSAL_OPTIONS: DdtCausal[] = [
  'Vendita',
  'Conto Lavorazione',
  'Conto Visione',
  'Reso',
  'Trasferimento Interno',
  'Riparazione',
  'Omaggio',
];

const TRANSPORT_BY_OPTIONS: DdtTransportBy[] = ['Vettore', 'Mittente', 'Destinatario'];

function formatDateIt(iso?: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) {
    return m[4] && m[5] ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}/${m[1]}`;
  }
  return iso;
}

function getNextDdtNumber(documents: DdtDocument[], year: number) {
  const maxProg = documents
    .filter((d) => d.year === year)
    .reduce((max, d) => Math.max(max, d.progressiveNumber || 0), 0);
  const nextProg = maxProg + 1;
  return {
    progressiveNumber: nextProg,
    number: `DDT-${year}-${String(nextProg).padStart(3, '0')}`,
  };
}

export const DdtDocumentsApp: React.FC<DdtDocumentsAppProps> = ({
  documents,
  loads,
  activeLoad,
  contacts,
  currentUser,
  initialCommessaId,
  initialClientId,
  onClearInitialIntent,
  onUpdateDocuments,
  onOpenCommessa,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | DdtStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(documents[0]?.id || null);

  // Modale creazione / modifica
  const [editingDoc, setEditingDoc] = useState<DdtDocument | null>(null);
  const [isNewMode, setIsNewMode] = useState(false);

  // Modale firma digitale
  const [signingTarget, setSigningTarget] = useState<{
    ddtId: string;
    role: 'driver' | 'recipient';
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  // Conferma eliminazione inline
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback((curr) => (curr === msg ? null : curr)), 3200);
  };

  // Crea bozza DDT partendo da una commessa esistente
  const buildDraftFromLoad = (load: CargoLoad): DdtDocument => {
    const now = new Date();
    const year = now.getFullYear();
    const { progressiveNumber, number } = getNextDdtNumber(documents, year);
    const summary = calculateLoadSummary(load);

    // Prova ad associare il cliente dalla Rubrica Clienti & Fornitori
    const matchedClient = contacts.find(
      (c) =>
        (c.kind === 'cliente' || c.kind === 'entrambi') &&
        c.companyName.trim().toLowerCase() === (load.client || '').trim().toLowerCase()
    );

    const items: DdtLineItem[] = load.items.map((it) => ({
      id: `ddti_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sku: it.sku || '',
      description: it.name || 'Articolo',
      unit: 'pz',
      quantity: Number(it.quantity) || 1,
      unitWeightKg: Number(it.unitWeightKg) || 0,
      notes: it.notes || '',
    }));

    const packagesCount =
      load.boxes.length > 0
        ? load.boxes.length
        : load.pallets.length > 0
        ? load.pallets.length
        : items.reduce((s, i) => s + i.quantity, 0);

    const appearanceParts: string[] = [];
    if (load.pallets.length > 0) appearanceParts.push(`${load.pallets.length} bancali filmati`);
    if (load.boxes.length > 0) appearanceParts.push(`${load.boxes.length} scatole sigillate`);

    return {
      id: `ddt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number,
      progressiveNumber,
      year,
      issueDate: now.toISOString().slice(0, 10),
      transportDateTime: now.toISOString().slice(0, 16),
      status: 'bozza',
      commessaId: load.id,
      commessaCode: load.code,
      commessaTitle: load.title,
      senderCompany: currentUser.company || 'METATRON CaricoStudio',
      senderVat: '',
      senderAddress: '',
      clientId: matchedClient?.id,
      recipientName: matchedClient?.companyName || load.client || '',
      recipientVat: matchedClient?.vatNumber || '',
      recipientAddress: matchedClient
        ? [
            matchedClient.billingAddress,
            [matchedClient.postalCode, matchedClient.city, matchedClient.province]
              .filter(Boolean)
              .join(' '),
          ]
            .filter(Boolean)
            .join(', ')
        : '',
      destinationAddress:
        load.destination ||
        matchedClient?.shippingAddress ||
        matchedClient?.billingAddress ||
        '',
      causal: 'Vendita',
      transportBy: load.carrier ? 'Vettore' : 'Mittente',
      carrierName: load.carrier || matchedClient?.defaultCarrier || '',
      driverName: load.handoverProof?.driverName || '',
      vehiclePlate: load.handoverProof?.truckPlate || '',
      trackingCode: '',
      appearance: appearanceParts.join(' · ') || 'Colli imballati',
      packagesCount,
      palletsCount: load.pallets.length,
      grossWeightKg: Math.round(summary.totalGrossWeightKg * 10) / 10,
      netWeightKg: Math.round(summary.netMerchandiseWeightKg * 10) / 10,
      porto: 'Franco',
      items,
      notes: load.title ? `Riferimento commessa ${load.code} — ${load.title}` : '',
      createdBy: currentUser.name,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  const buildBlankDraft = (client?: CrmContact): DdtDocument => {
    const now = new Date();
    const year = now.getFullYear();
    const { progressiveNumber, number } = getNextDdtNumber(documents, year);
    const billingFull = client
      ? [
          client.billingAddress,
          [client.postalCode, client.city, client.province].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(', ')
      : '';
    return {
      id: `ddt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number,
      progressiveNumber,
      year,
      issueDate: now.toISOString().slice(0, 10),
      transportDateTime: now.toISOString().slice(0, 16),
      status: 'bozza',
      senderCompany: currentUser.company || 'METATRON CaricoStudio',
      senderVat: '',
      senderAddress: '',
      clientId: client?.id,
      recipientName: client?.companyName || '',
      recipientVat: client?.vatNumber || '',
      recipientAddress: billingFull,
      destinationAddress: client?.shippingAddress || billingFull,
      causal: 'Vendita',
      transportBy: 'Vettore',
      carrierName: client?.defaultCarrier || '',
      driverName: '',
      vehiclePlate: '',
      trackingCode: '',
      appearance: 'Colli imballati',
      packagesCount: 1,
      palletsCount: 0,
      grossWeightKg: 0,
      netWeightKg: 0,
      porto: 'Franco',
      items: [
        {
          id: `ddti_${Date.now()}`,
          sku: '',
          description: '',
          unit: 'pz',
          quantity: 1,
          unitWeightKg: 0,
          notes: '',
        },
      ],
      notes: '',
      createdBy: currentUser.name,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  // Gestisce eventuale apertura diretta da un'altra app (Clienti o Commesse)
  React.useEffect(() => {
    if (initialCommessaId) {
      const targetLoad = loads.find((l) => l.id === initialCommessaId);
      if (targetLoad) {
        setEditingDoc(buildDraftFromLoad(targetLoad));
        setIsNewMode(true);
      }
      onClearInitialIntent?.();
    } else if (initialClientId) {
      const targetClient = contacts.find((c) => c.id === initialClientId);
      if (targetClient) {
        setEditingDoc(buildBlankDraft(targetClient));
        setIsNewMode(true);
      }
      onClearInitialIntent?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCommessaId, initialClientId]);

  const sortedDocs = useMemo(() => {
    return [...documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [documents]);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedDocs.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (!q) return true;
      return (
        d.number.toLowerCase().includes(q) ||
        d.recipientName.toLowerCase().includes(q) ||
        (d.commessaCode || '').toLowerCase().includes(q) ||
        (d.carrierName || '').toLowerCase().includes(q) ||
        (d.destinationAddress || '').toLowerCase().includes(q)
      );
    });
  }, [sortedDocs, statusFilter, searchQuery]);

  const selectedDoc = useMemo(() => {
    return (
      filteredDocs.find((d) => d.id === selectedId) ||
      documents.find((d) => d.id === selectedId) ||
      filteredDocs[0] ||
      null
    );
  }, [filteredDocs, documents, selectedId]);

  const kpis = useMemo(() => {
    const total = documents.length;
    const activeTransit = documents.filter(
      (d) => d.status === 'emesso' || d.status === 'in_transito'
    ).length;
    const delivered = documents.filter((d) => d.status === 'consegnato').length;
    const totalWeight = documents
      .filter((d) => d.status !== 'annullato')
      .reduce((sum, d) => sum + (Number(d.grossWeightKg) || 0), 0);
    return { total, activeTransit, delivered, totalWeight };
  }, [documents]);

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    if (!editingDoc.recipientName.trim()) {
      showNotice('Inserisci la ragione sociale del destinatario.');
      return;
    }
    const cleanItems = editingDoc.items.filter(
      (it) => it.description.trim() || it.sku.trim()
    );
    const updated: DdtDocument = {
      ...editingDoc,
      items: cleanItems,
      updatedAt: new Date().toISOString(),
    };
    const exists = documents.some((d) => d.id === updated.id);
    const next = exists
      ? documents.map((d) => (d.id === updated.id ? updated : d))
      : [updated, ...documents];
    onUpdateDocuments(next);
    setSelectedId(updated.id);
    setEditingDoc(null);
    setIsNewMode(false);
    showNotice(exists ? `DDT ${updated.number} aggiornato.` : `DDT ${updated.number} creato.`);
  };

  const handleChangeStatus = (ddtId: string, nextStatus: DdtStatus) => {
    const next = documents.map((d) =>
      d.id === ddtId
        ? { ...d, status: nextStatus, updatedAt: new Date().toISOString() }
        : d
    );
    onUpdateDocuments(next);
    showNotice(`Stato aggiornato a "${STATUS_LABELS[nextStatus]}".`);
  };

  const handleDuplicate = (doc: DdtDocument) => {
    const now = new Date();
    const year = now.getFullYear();
    const { progressiveNumber, number } = getNextDdtNumber(documents, year);
    const copy: DdtDocument = {
      ...doc,
      id: `ddt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      number,
      progressiveNumber,
      year,
      issueDate: now.toISOString().slice(0, 10),
      transportDateTime: now.toISOString().slice(0, 16),
      status: 'bozza',
      driverSignatureDataUrl: undefined,
      recipientSignatureDataUrl: undefined,
      signedAt: undefined,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    onUpdateDocuments([copy, ...documents]);
    setSelectedId(copy.id);
    showNotice(`Duplicato come ${copy.number}.`);
  };

  const handleDelete = (ddtId: string) => {
    const next = documents.filter((d) => d.id !== ddtId);
    onUpdateDocuments(next);
    setConfirmDeleteId(null);
    if (selectedId === ddtId) {
      setSelectedId(next[0]?.id || null);
    }
    showNotice('DDT eliminato.');
  };

  const handleDownloadPdf = (ddt: DdtDocument) => {
    const pdf = generateDdtPdf(ddt);
    pdf.save(`${ddt.number.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`);
    showNotice(`PDF ${ddt.number} scaricato.`);
  };

  const handleExportCsv = () => {
    downloadCsvFile(
      `registro-ddt-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Numero DDT',
        'Data',
        'Stato',
        'Commessa',
        'Destinatario',
        'Destinazione',
        'Causale',
        'Vettore',
        'Colli',
        'Bancali',
        'Peso Lordo (kg)',
      ],
      filteredDocs.map((d) => [
        d.number,
        d.issueDate,
        STATUS_LABELS[d.status],
        d.commessaCode || '',
        d.recipientName,
        d.destinationAddress || d.recipientAddress || '',
        d.causal,
        d.carrierName || '',
        d.packagesCount,
        d.palletsCount,
        d.grossWeightKg,
      ])
    );
    showNotice('Registro DDT esportato in CSV.');
  };

  // Gestione firma canvas
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    setHasStroke(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const clearSignatureCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasStroke(false);
  };

  const saveSignature = () => {
    if (!signingTarget || !canvasRef.current || !hasStroke) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const nowIso = new Date().toISOString();
    const next = documents.map((d) => {
      if (d.id !== signingTarget.ddtId) return d;
      if (signingTarget.role === 'driver') {
        return {
          ...d,
          driverSignatureDataUrl: dataUrl,
          signedAt: nowIso,
          updatedAt: nowIso,
        };
      }
      return {
        ...d,
        recipientSignatureDataUrl: dataUrl,
        status: d.status === 'emesso' || d.status === 'in_transito' ? 'consegnato' : d.status,
        signedAt: nowIso,
        updatedAt: nowIso,
      };
    });
    onUpdateDocuments(next);
    setSigningTarget(null);
    setHasStroke(false);
    showNotice('Firma salvata sul DDT.');
  };

  const clientsList = useMemo(
    () => contacts.filter((c) => c.kind === 'cliente' || c.kind === 'entrambi'),
    [contacts]
  );

  const applyClientToDraft = (clientId: string) => {
    if (!editingDoc) return;
    const c = clientsList.find((x) => x.id === clientId);
    if (!c) return;
    const billingFull = [
      c.billingAddress,
      [c.postalCode, c.city, c.province].filter(Boolean).join(' '),
    ]
      .filter(Boolean)
      .join(', ');
    setEditingDoc({
      ...editingDoc,
      clientId: c.id,
      recipientName: c.companyName,
      recipientVat: c.vatNumber || '',
      recipientAddress: billingFull,
      destinationAddress: c.shippingAddress || billingFull,
      carrierName: editingDoc.carrierName || c.defaultCarrier || '',
    });
  };

  return (
    <div className="h-full flex bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar Sinistra */}
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900 tracking-tight">
            DDT & Bolle di Trasporto
          </div>
          <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {documents.length} documenti · Anno {new Date().getFullYear()}
          </div>
        </div>

        <nav className="p-2.5 space-y-0.5 flex-1 overflow-y-auto">
          <div className="px-2.5 py-1.5 text-[11px] font-medium text-slate-400">
            Stato documenti
          </div>
          {(
            [
              { id: 'all', label: 'Tutti i DDT', count: documents.length },
              {
                id: 'bozza',
                label: 'Bozze',
                count: documents.filter((d) => d.status === 'bozza').length,
              },
              {
                id: 'emesso',
                label: 'Emessi',
                count: documents.filter((d) => d.status === 'emesso').length,
              },
              {
                id: 'in_transito',
                label: 'In Transito',
                count: documents.filter((d) => d.status === 'in_transito').length,
              },
              {
                id: 'consegnato',
                label: 'Consegnati',
                count: documents.filter((d) => d.status === 'consegnato').length,
              },
              {
                id: 'annullato',
                label: 'Annullati',
                count: documents.filter((d) => d.status === 'annullato').length,
              },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setStatusFilter(nav.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === nav.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="truncate">{nav.label}</span>
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  statusFilter === nav.id ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                {nav.count}
              </span>
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-slate-200 px-2">
            <div className="text-[11px] font-medium text-slate-500 mb-2">
              Genera rapido da commessa
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {loads.slice(0, 8).map((ld) => (
                <button
                  key={ld.id}
                  type="button"
                  onClick={() => {
                    setEditingDoc(buildDraftFromLoad(ld));
                    setIsNewMode(true);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition-colors cursor-pointer"
                >
                  <div className="font-mono text-[11px] font-semibold text-slate-900 truncate">
                    {ld.code}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {ld.client || ld.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-slate-200">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredDocs.length === 0}
            className="w-full px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Esporta registro CSV
          </button>
        </div>
      </aside>

      {/* Area Principale */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar Contract */}
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400">METATRON</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900 truncate">
              Documenti di Trasporto (DDT)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingDoc(buildDraftFromLoad(activeLoad));
                setIsNewMode(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              Da Commessa ({activeLoad.code})
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingDoc(buildBlankDraft());
                setIsNewMode(true);
              }}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuovo DDT
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

        {/* KPI Strip + Split Table & Inspector */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 4 KPI flat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-slate-200 bg-white divide-x divide-slate-200 shrink-0">
            <div className="px-5 py-3.5">
              <div className="text-xs text-slate-500">Documenti emessi</div>
              <div className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
                {kpis.total}
              </div>
            </div>
            <div className="px-5 py-3.5">
              <div className="text-xs text-slate-500">Emessi / In transito</div>
              <div className="text-xl font-semibold text-blue-700 font-mono tabular-nums mt-0.5">
                {kpis.activeTransit}
              </div>
            </div>
            <div className="px-5 py-3.5">
              <div className="text-xs text-slate-500">Consegnati</div>
              <div className="text-xl font-semibold text-emerald-700 font-mono tabular-nums mt-0.5">
                {kpis.delivered}
              </div>
            </div>
            <div className="px-5 py-3.5">
              <div className="text-xs text-slate-500">Peso totale trasportato</div>
              <div className="text-xl font-semibold text-slate-900 font-mono tabular-nums mt-0.5">
                {kpis.totalWeight.toLocaleString('it-IT', { maximumFractionDigits: 1 })} kg
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
                placeholder="Cerca per numero DDT, cliente, commessa o vettore..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div className="text-xs text-slate-500 tabular-nums">
              {filteredDocs.length} risultati
            </div>
          </div>

          {/* Split Master-Detail */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Tabella sinistra */}
            <div className="flex-1 overflow-auto bg-white">
              {filteredDocs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                  <FileText className="w-10 h-10 text-slate-300 mb-3" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    Nessun Documento di Trasporto presente
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Genera il primo DDT direttamente da una commessa esistente con colli, pesi e
                    articoli già compilati, oppure crea un DDT manuale.
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoc(buildDraftFromLoad(activeLoad));
                        setIsNewMode(true);
                      }}
                      className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                    >
                      Genera da {activeLoad.code}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoc(buildBlankDraft());
                        setIsNewMode(true);
                      }}
                      className="px-4 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                    >
                      DDT manuale
                    </button>
                  </div>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-500 z-10">
                    <tr>
                      <th className="py-2.5 px-4">Numero</th>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3">Destinatario</th>
                      <th className="py-2.5 px-3">Commessa</th>
                      <th className="py-2.5 px-3 text-right">Colli / Peso</th>
                      <th className="py-2.5 px-4 text-right">Stato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDocs.map((d) => {
                      const isSelected = selectedDoc?.id === d.id;
                      return (
                        <tr
                          key={d.id}
                          onClick={() => setSelectedId(d.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                            {d.number}
                          </td>
                          <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {formatDateIt(d.issueDate)}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900 truncate max-w-[200px]">
                              {d.recipientName || '—'}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                              {d.carrierName || d.causal}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {d.commessaCode || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                            {d.packagesCount} colli · {d.grossWeightKg.toFixed(0)} kg
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <span className={`font-medium ${STATUS_TEXT_CLASS[d.status]}`}>
                              {STATUS_LABELS[d.status]}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Inspector Destro */}
            {selectedDoc && (
              <aside className="w-[410px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-900">
                        {selectedDoc.number}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span
                        className={`text-xs font-medium ${STATUS_TEXT_CLASS[selectedDoc.status]}`}
                      >
                        {STATUS_LABELS[selectedDoc.status]}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {selectedDoc.recipientName}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(selectedDoc)}
                      title="Scarica PDF A4"
                      className="px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDoc(selectedDoc);
                        setIsNewMode(false);
                      }}
                      title="Modifica DDT"
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 text-xs">
                  {/* Cambio stato rapido */}
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                      Avanzamento spedizione
                    </div>
                    <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                      {(['bozza', 'emesso', 'in_transito', 'consegnato'] as DdtStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleChangeStatus(selectedDoc.id, st)}
                            className={`py-1.5 px-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer truncate ${
                              selectedDoc.status === st
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

                  {/* Dettagli destinatario & trasporto */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-4">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Data emissione</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatDateIt(selectedDoc.issueDate)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Inizio trasporto</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatDateIt(selectedDoc.transportDateTime)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Causale / Porto</span>
                      <span className="text-slate-900 font-medium">
                        {selectedDoc.causal} · {selectedDoc.porto}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Vettore</span>
                      <span className="text-slate-900 text-right">
                        {selectedDoc.carrierName || selectedDoc.transportBy}
                        {selectedDoc.vehiclePlate ? ` · ${selectedDoc.vehiclePlate}` : ''}
                      </span>
                    </div>
                    {selectedDoc.commessaCode && (
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-slate-500">Commessa collegata</span>
                        <button
                          type="button"
                          onClick={() =>
                            selectedDoc.commessaId && onOpenCommessa?.(selectedDoc.commessaId)
                          }
                          className="font-mono text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {selectedDoc.commessaCode}
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="pt-1">
                      <div className="text-slate-500 mb-0.5">Destinazione merce</div>
                      <div className="text-slate-800">
                        {selectedDoc.destinationAddress || selectedDoc.recipientAddress || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Dati colli & pesi */}
                  <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <div className="text-[11px] text-slate-500">Colli</div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
                        {selectedDoc.packagesCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Bancali</div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
                        {selectedDoc.palletsCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Peso Lordo</div>
                      <div className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
                        {selectedDoc.grossWeightKg.toFixed(1)} kg
                      </div>
                    </div>
                  </div>

                  {/* Elenco articoli nel DDT */}
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-slate-500">
                        Articoli in bolla ({selectedDoc.items.length})
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                      {selectedDoc.items.length === 0 ? (
                        <div className="p-3 text-slate-400 text-center">Nessuna riga inserita</div>
                      ) : (
                        selectedDoc.items.map((it) => (
                          <div
                            key={it.id}
                            className="px-3 py-2 flex items-center justify-between gap-2 bg-white"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate">
                                {it.description}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                {it.sku || 'Senza SKU'}
                              </div>
                            </div>
                            <div className="font-mono tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                              {it.quantity} {it.unit}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Firme digitali */}
                  <div className="border-t border-slate-100 pt-4 space-y-2.5">
                    <div className="text-[11px] font-medium text-slate-500">
                      Firme digitali su PDF
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex flex-col justify-between gap-2">
                        <div className="text-[11px] font-medium text-slate-700">
                          Conducente / Vettore
                        </div>
                        {selectedDoc.driverSignatureDataUrl ? (
                          <img
                            src={selectedDoc.driverSignatureDataUrl}
                            alt="Firma conducente"
                            className="h-12 w-full object-contain bg-white rounded border border-slate-200"
                          />
                        ) : (
                          <div className="h-12 flex items-center justify-center text-[11px] text-slate-400">
                            Non firmato
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSigningTarget({ ddtId: selectedDoc.id, role: 'driver' });
                            setHasStroke(false);
                          }}
                          className="w-full py-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <PenTool className="w-3 h-3" />
                          {selectedDoc.driverSignatureDataUrl ? 'Rifirma' : 'Firma ora'}
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex flex-col justify-between gap-2">
                        <div className="text-[11px] font-medium text-slate-700">
                          Destinatario
                        </div>
                        {selectedDoc.recipientSignatureDataUrl ? (
                          <img
                            src={selectedDoc.recipientSignatureDataUrl}
                            alt="Firma destinatario"
                            className="h-12 w-full object-contain bg-white rounded border border-slate-200"
                          />
                        ) : (
                          <div className="h-12 flex items-center justify-center text-[11px] text-slate-400">
                            Non firmato
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSigningTarget({ ddtId: selectedDoc.id, role: 'recipient' });
                            setHasStroke(false);
                          }}
                          className="w-full py-1.5 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <PenTool className="w-3 h-3" />
                          {selectedDoc.recipientSignatureDataUrl ? 'Rifirma' : 'Firma ora'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Azioni secondarie */}
                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(selectedDoc)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Duplica
                    </button>

                    {confirmDeleteId === selectedDoc.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDelete(selectedDoc.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
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
                        onClick={() => setConfirmDeleteId(selectedDoc.id)}
                        className="px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Elimina
                      </button>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {/* MODALE EDITOR DDT */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveDraft}
            className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {isNewMode ? `Nuovo DDT · ${editingDoc.number}` : `Modifica ${editingDoc.number}`}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Documento di Trasporto pronto per stampa e download PDF A4
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {/* Numerazione, Date e Import da Rubrica/Commessa */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Numero DDT *</label>
                  <input
                    type="text"
                    required
                    value={editingDoc.number}
                    onChange={(e) => setEditingDoc({ ...editingDoc, number: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Data emissione *</label>
                  <input
                    type="date"
                    required
                    value={editingDoc.issueDate}
                    onChange={(e) => setEditingDoc({ ...editingDoc, issueDate: e.target.value })}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Data/Ora inizio trasporto
                  </label>
                  <input
                    type="datetime-local"
                    value={editingDoc.transportDateTime}
                    onChange={(e) =>
                      setEditingDoc({ ...editingDoc, transportDateTime: e.target.value })
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Stato</label>
                  <select
                    value={editingDoc.status}
                    onChange={(e) =>
                      setEditingDoc({ ...editingDoc, status: e.target.value as DdtStatus })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                  >
                    {(Object.keys(STATUS_LABELS) as DdtStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Destinatario + Autocompilazione da Rubrica Clienti */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">Destinatario & Destinazione</div>
                  {clientsList.length > 0 && (
                    <select
                      value={editingDoc.clientId || ''}
                      onChange={(e) => applyClientToDraft(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                    >
                      <option value="">Compila da Rubrica Clienti...</option>
                      {clientsList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} {c.city ? `(${c.city})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">
                      Ragione Sociale Destinatario *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingDoc.recipientName}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, recipientName: e.target.value })
                      }
                      placeholder="Es. Meccanica Rossi S.r.l."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">P.IVA / C.F.</label>
                    <input
                      type="text"
                      value={editingDoc.recipientVat || ''}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, recipientVat: e.target.value })
                      }
                      placeholder="IT01234567890"
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
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
                      value={editingDoc.recipientAddress || ''}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, recipientAddress: e.target.value })
                      }
                      placeholder="Via Roma 10, 20100 Milano (MI)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Luogo di Destinazione Merce
                    </label>
                    <input
                      type="text"
                      value={editingDoc.destinationAddress || ''}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, destinationAddress: e.target.value })
                      }
                      placeholder="Stabilimento / Magazzino di scarico"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Dati Trasporto & Logistica */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="font-semibold text-slate-900">Trasporto, Colli & Vettore</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Causale</label>
                    <select
                      value={editingDoc.causal}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, causal: e.target.value as DdtCausal })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {CAUSAL_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Trasporto a cura</label>
                    <select
                      value={editingDoc.transportBy}
                      onChange={(e) =>
                        setEditingDoc({
                          ...editingDoc,
                          transportBy: e.target.value as DdtTransportBy,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      {TRANSPORT_BY_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Porto</label>
                    <select
                      value={editingDoc.porto}
                      onChange={(e) =>
                        setEditingDoc({
                          ...editingDoc,
                          porto: e.target.value as 'Franco' | 'Assegnato',
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <option value="Franco">Franco</option>
                      <option value="Assegnato">Assegnato</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Aspetto esteriore
                    </label>
                    <input
                      type="text"
                      value={editingDoc.appearance}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, appearance: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">N. Colli</label>
                    <input
                      type="number"
                      min={0}
                      value={editingDoc.packagesCount}
                      onChange={(e) =>
                        setEditingDoc({
                          ...editingDoc,
                          packagesCount: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">N. Bancali</label>
                    <input
                      type="number"
                      min={0}
                      value={editingDoc.palletsCount}
                      onChange={(e) =>
                        setEditingDoc({
                          ...editingDoc,
                          palletsCount: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Peso Lordo (kg)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={editingDoc.grossWeightKg}
                      onChange={(e) =>
                        setEditingDoc({
                          ...editingDoc,
                          grossWeightKg: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Peso Netto (kg)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={editingDoc.netWeightKg}
                      onChange={(e) =>
                        setEditingDoc({
                          ...editingDoc,
                          netWeightKg: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Vettore / Corriere</label>
                    <input
                      type="text"
                      value={editingDoc.carrierName || ''}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, carrierName: e.target.value })
                      }
                      placeholder="Es. BRT, GLS, Bilico aziendale..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Conducente</label>
                    <input
                      type="text"
                      value={editingDoc.driverName || ''}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, driverName: e.target.value })
                      }
                      placeholder="Nome autista"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Targa / Tracking</label>
                    <input
                      type="text"
                      value={editingDoc.vehiclePlate || ''}
                      onChange={(e) =>
                        setEditingDoc({ ...editingDoc, vehiclePlate: e.target.value })
                      }
                      placeholder="Es. AB123CD"
                      className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Righe articoli */}
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">
                    Elenco Articoli ({editingDoc.items.length})
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingDoc({
                        ...editingDoc,
                        items: [
                          ...editingDoc.items,
                          {
                            id: `ddti_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                            sku: '',
                            description: '',
                            unit: 'pz',
                            quantity: 1,
                            unitWeightKg: 0,
                          },
                        ],
                      })
                    }
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi riga
                  </button>
                </div>

                <div className="space-y-2">
                  {editingDoc.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                    >
                      <input
                        type="text"
                        placeholder="SKU"
                        value={item.sku}
                        onChange={(e) => {
                          const nextItems = [...editingDoc.items];
                          nextItems[idx] = { ...item, sku: e.target.value };
                          setEditingDoc({ ...editingDoc, items: nextItems });
                        }}
                        className="col-span-2 px-2 py-1.5 font-mono bg-white border border-slate-200 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Descrizione articolo *"
                        value={item.description}
                        onChange={(e) => {
                          const nextItems = [...editingDoc.items];
                          nextItems[idx] = { ...item, description: e.target.value };
                          setEditingDoc({ ...editingDoc, items: nextItems });
                        }}
                        className="col-span-5 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs"
                      />
                      <input
                        type="text"
                        placeholder="U.M."
                        value={item.unit}
                        onChange={(e) => {
                          const nextItems = [...editingDoc.items];
                          nextItems[idx] = { ...item, unit: e.target.value };
                          setEditingDoc({ ...editingDoc, items: nextItems });
                        }}
                        className="col-span-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs text-center"
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="Q.tà"
                        value={item.quantity}
                        onChange={(e) => {
                          const nextItems = [...editingDoc.items];
                          nextItems[idx] = {
                            ...item,
                            quantity: Math.max(0, Number(e.target.value) || 0),
                          };
                          setEditingDoc({ ...editingDoc, items: nextItems });
                        }}
                        className="col-span-2 px-2 py-1.5 font-mono bg-white border border-slate-200 rounded text-xs text-right"
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.1"
                        placeholder="kg/pz"
                        value={item.unitWeightKg}
                        onChange={(e) => {
                          const nextItems = [...editingDoc.items];
                          nextItems[idx] = {
                            ...item,
                            unitWeightKg: Math.max(0, Number(e.target.value) || 0),
                          };
                          setEditingDoc({ ...editingDoc, items: nextItems });
                        }}
                        className="col-span-1 px-1.5 py-1.5 font-mono bg-white border border-slate-200 rounded text-xs text-right"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDoc({
                            ...editingDoc,
                            items: editingDoc.items.filter((_, i) => i !== idx),
                          })
                        }
                        className="col-span-1 flex items-center justify-center text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Note & Dati Mittente */}
              <div className="border-t border-slate-200 pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Intestazione Mittente
                  </label>
                  <input
                    type="text"
                    value={editingDoc.senderCompany}
                    onChange={(e) =>
                      setEditingDoc({ ...editingDoc, senderCompany: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Annotazioni / Riserve
                  </label>
                  <input
                    type="text"
                    value={editingDoc.notes || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, notes: e.target.value })}
                    placeholder="Eventuali note consegna, orari scarico..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Salva DDT
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE FIRMA DIGITALE */}
      {signingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                {signingTarget.role === 'driver'
                  ? 'Firma Conducente / Vettore'
                  : 'Firma Destinatario (Per Ricevuta)'}
              </div>
              <button
                type="button"
                onClick={() => setSigningTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-slate-500">
                Disegna la firma nel riquadro qui sotto con il mouse o con il dito.
              </p>
              <canvas
                ref={canvasRef}
                width={420}
                height={170}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-44 bg-slate-50 border border-slate-300 rounded-lg touch-none cursor-crosshair"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={clearSignatureCanvas}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Pulisci
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSigningTarget(null)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={!hasStroke}
                    onClick={saveSignature}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    Salva firma
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
