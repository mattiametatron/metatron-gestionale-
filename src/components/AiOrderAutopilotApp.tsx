import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileText,
  History,
  Loader2,
  MessageSquareText,
  Package,
  Plus,
  RefreshCw,
  Rocket,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import {
  AuthUser,
  CargoLoad,
  CrmContact,
  PurchaseOrder,
  WarehouseInventoryState,
} from '../types/warehouse';
import {
  AUTOPILOT_HISTORY_STORAGE_KEY,
  AutopilotDraft,
  AutopilotExtractedItem,
  AutopilotMatchConfidence,
  AutopilotUrgency,
  buildCargoLoadFromAutopilot,
  buildCommittedInventoryState,
  buildCustomerReplyText,
  buildPurchaseOrdersFromAutopilot,
  evaluateAutopilotDraft,
  generateNextCommessaCode,
  generateNextQuoteNumber,
} from '../utils/aiOrderAutopilot';
import { generateQuotePdf } from '../utils/businessPdfGenerator';
import {
  translateTextsForPrint,
  usePrintLanguage,
} from '../utils/printLanguage';
import { PrintLanguageSelector } from './PrintLanguageSelector';

interface AiOrderAutopilotAppProps {
  inventory: WarehouseInventoryState;
  loads: CargoLoad[];
  contacts: CrmContact[];
  purchaseOrders: PurchaseOrder[];
  currentUser: AuthUser;
  onCreateLoadFromAutopilot: (load: CargoLoad) => void;
  onUpdateInventory: (next: WarehouseInventoryState) => void;
  onUpdatePurchaseOrders: (next: PurchaseOrder[]) => void;
  onUpdateContacts: (next: CrmContact[]) => void;
  onNavigateToApp: (appId: 'commesse' | 'truck' | 'view3d' | 'purchase_orders' | 'warehouse_catalog') => void;
}

const SAMPLE_WHATSAPP_REQUEST = `Ciao Mattia! Sono Marco di EdilMetal Brescia.
Ci servirebbero urgenti per giovedì mattina in cantiere a Bergamo (Via Industriale 18):
- 40 staffe angolari rinforzate 40x40
- 18 profili in acciaio zincato da 3 metri
- 6 scatole di viti autoperforanti M8 inox
- 4 quadri elettrici stagni IP65 (fragili mi raccomando!)
- 25 guarnizioni gomma EPDM per tenuta
Fammi sapere subito se avete tutto in casa, quanto viene più o meno col trasporto e quanti bancali escono così preparo il muletto. Grazie!`;

const SAMPLE_EMAIL_REQUEST = `Oggetto: Richiesta quotazione e disponibilità urgente — Fornitura Magazzino Nord

Buongiorno,
per conto di Logistica Verona Srl chiediamo conferma disponibilità e preventivo rapido con consegna prevista entro 5 giorni presso il nostro stabilimento di Verona Interporto:

1) N. 120 bulloni M12 zincati con dado autobloccante
2) N. 12 pannelli coibentati 200x100 cm spessore 50mm RAL 7016
3) N. 8 cerniere pesanti saldabili per portoni industriali
4) N. 30 ml profilo guarnizione paracolpi
5) N. 2 motoriduttori trifase 230/400V (merce delicata)

Condizioni solite Bonifico 30gg df. In attesa di riscontro per conferma ordine immediata.
Cordiali saluti,
Ufficio Acquisti — Logistica Verona Srl`;

function formatEur(val: number): string {
  return `€ ${val.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || '');
      const commaIdx = str.indexOf(',');
      resolve(commaIdx >= 0 ? str.slice(commaIdx + 1) : str);
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato.'));
    reader.readAsDataURL(file);
  });
}

function loadHistoryFromStorage(): AutopilotDraft[] {
  try {
    const raw = localStorage.getItem(AUTOPILOT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const AiOrderAutopilotApp: React.FC<AiOrderAutopilotAppProps> = ({
  inventory,
  loads,
  contacts,
  purchaseOrders,
  currentUser,
  onCreateLoadFromAutopilot,
  onUpdateInventory,
  onUpdatePurchaseOrders,
  onUpdateContacts,
  onNavigateToApp,
}) => {
  const [rawText, setRawText] = useState('');
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    base64: string;
  } | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [history, setHistory] = useState<AutopilotDraft[]>(() => loadHistoryFromStorage());
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const [draft, setDraft] = useState<AutopilotDraft | null>(null);
  const [activeTab, setActiveTab] = useState<'preventivo' | 'camion' | 'riordini' | 'risposta'>(
    'preventivo'
  );

  // Opzioni di lancio 1-click
  const [optCreateLoad, setOptCreateLoad] = useState(true);
  const [optCreatePurchaseOrders, setOptCreatePurchaseOrders] = useState(true);
  const [optCommitStock, setOptCommitStock] = useState(false);
  const [optSaveNewClient, setOptSaveNewClient] = useState(true);

  const [launchFeedback, setLaunchFeedback] = useState<{
    loadCode?: string;
    poNumbers: string[];
    stockMovementsCount: number;
    clientSaved: boolean;
  } | null>(null);

  const [copiedReply, setCopiedReply] = useState(false);
  const [printLang, setPrintLang] = usePrintLanguage();
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(AUTOPILOT_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
    } catch {
      // ignore storage quota
    }
  }, [history]);

  const evaluation = useMemo(() => {
    if (!draft) return null;
    return evaluateAutopilotDraft(draft, inventory, contacts);
  }, [draft, inventory, contacts]);

  const liveReplyMessage = useMemo(() => {
    if (!draft || !evaluation) return '';
    return buildCustomerReplyText(
      draft,
      evaluation,
      currentUser.company || currentUser.name || 'METATRON CaricoStudio'
    );
  }, [draft, evaluation, currentUser]);

  const handleAttachFile = async (file: File) => {
    setErrorMessage(null);
    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'text/plain',
    ];
    if (!allowed.includes(file.type)) {
      setErrorMessage('Formato file non supportato. Allega PDF, PNG, JPG, WEBP o TXT.');
      return;
    }
    if (file.size > 11 * 1024 * 1024) {
      setErrorMessage('Il file supera il limite di 11 MB.');
      return;
    }
    try {
      if (file.type === 'text/plain') {
        const txt = await file.text();
        setRawText((prev) => (prev ? `${prev}\n\n${txt}` : txt));
        return;
      }
      const base64 = await readFileAsBase64(file);
      setAttachedFile({
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        base64,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Errore lettura file.');
    }
  };

  const handlePasteInTextarea = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) {
          e.preventDefault();
          await handleAttachFile(
            new File([f], `screenshot-whatsapp-${Date.now()}.png`, { type: f.type })
          );
          return;
        }
      }
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!rawText.trim() && !attachedFile) {
      setErrorMessage('Incolla un messaggio WhatsApp/Email oppure allega un PDF o screenshot.');
      return;
    }
    setErrorMessage(null);
    setLaunchFeedback(null);
    setIsAnalyzing(true);
    setAnalyzeStage('Lettura richiesta e riconoscimento articoli...');

    const stageTimer1 = window.setTimeout(() => {
      setAnalyzeStage('Abbinamento catalogo magazzino e controllo scorte...');
    }, 1700);
    const stageTimer2 = window.setTimeout(() => {
      setAnalyzeStage('Calcolo preventivo, bancali EPAL e piano camion...');
    }, 3400);

    try {
      const catalogSummary = inventory.items.slice(0, 250).map((it) => ({
        id: it.id,
        sku: it.sku,
        name: it.name,
        category: it.category,
        unit: it.unit,
        quantity: it.quantity,
        supplier: it.supplier || '',
      }));

      const contactsSummary = contacts
        .filter((c) => c.kind === 'cliente' || c.kind === 'entrambi')
        .slice(0, 120)
        .map((c) => ({
          id: c.id,
          companyName: c.companyName,
          city: c.city || '',
          shippingAddress: c.shippingAddress || c.billingAddress || '',
          paymentTerms: c.paymentTerms || '',
        }));

      const res = await fetch('/api/ai/parse-client-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: rawText.trim(),
          fileBase64: attachedFile?.base64 || '',
          fileMimeType: attachedFile?.mimeType || '',
          fileName: attachedFile?.name || '',
          catalogSummary,
          contactsSummary,
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success || !payload?.data) {
        throw new Error(payload?.error || 'Analisi AI non riuscita. Riprova.');
      }

      const d = payload.data;
      const rawItems = Array.isArray(d.items) ? d.items : [];
      const extractedItems: AutopilotExtractedItem[] = rawItems.map((it: any, idx: number) => {
        const matchedInv =
          it.matchedInventoryId &&
          inventory.items.find((x) => x.id === String(it.matchedInventoryId));
        const confRaw = String(it.matchConfidence || '').toLowerCase();
        const matchConfidence: AutopilotMatchConfidence =
          confRaw === 'alta'
            ? 'alta'
            : confRaw === 'media'
            ? 'media'
            : matchedInv
            ? 'alta'
            : 'nuovo_articolo';
        return {
          id: `line-${Date.now()}-${idx}`,
          rawMention: String(it.rawMention || it.name || ''),
          matchedInventoryId: matchedInv ? matchedInv.id : '',
          sku: String(matchedInv?.sku || it.sku || `ART-${String(idx + 1).padStart(3, '0')}`),
          name: String(matchedInv?.name || it.name || `Articolo ${idx + 1}`),
          category: String(matchedInv?.category || it.category || 'Materiale Generale'),
          unit: String(matchedInv?.unit || it.unit || 'pz'),
          quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
          estimatedUnitWeightKg: Math.max(0.05, Number(it.estimatedUnitWeightKg) || 1),
          unitCostEur: Math.max(0, Number(it.estimatedUnitCostEur) || 12),
          fragile: Boolean(it.fragile),
          dimensionsCm: String(it.dimensionsCm || ''),
          matchConfidence,
          matchReason: String(it.matchReason || ''),
          supplierName: String(matchedInv?.supplier || it.supplierName || ''),
          notes: String(it.notes || ''),
        };
      });

      const urgencyRaw = String(d.urgency || '').toLowerCase();
      const urgency: AutopilotUrgency =
        urgencyRaw === 'critica'
          ? 'critica'
          : urgencyRaw === 'urgente'
          ? 'urgente'
          : 'normale';

      const matchedContact =
        d.matchedContactId && contacts.find((c) => c.id === String(d.matchedContactId));

      const nextDraft: AutopilotDraft = {
        id: `auto-${Date.now()}`,
        createdAt: new Date().toISOString(),
        sourceKind: rawText.trim() && attachedFile ? 'misto' : attachedFile ? 'file' : 'testo',
        sourceFileName: attachedFile?.name,
        sourcePreview:
          rawText.trim().slice(0, 140) || attachedFile?.name || 'Richiesta cliente',
        quoteNumber: generateNextQuoteNumber(history.length),
        clientName: String(matchedContact?.companyName || d.clientName || 'Nuovo Cliente'),
        matchedContactId: matchedContact ? matchedContact.id : '',
        destination: String(
          d.destination ||
            matchedContact?.shippingAddress ||
            matchedContact?.city ||
            'Da confermare'
        ),
        requestedDeliveryDate:
          typeof d.requestedDeliveryDate === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(d.requestedDeliveryDate)
            ? d.requestedDeliveryDate
            : new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
        urgency,
        projectTitle: String(
          d.projectTitle || `Fornitura ${d.clientName || 'Cliente'}`
        ),
        suggestedCommessaCode: generateNextCommessaCode(loads, d.suggestedCommessaCode),
        summaryNotes: String(d.summaryNotes || ''),
        customerReplyMessage: String(d.customerReplyMessage || ''),
        marginPercent: 35,
        transportEur: extractedItems.length > 0 ? 120 : 0,
        vatPercent: 22,
        validityDays: 15,
        paymentTerms: String(
          d.paymentTerms || matchedContact?.paymentTerms || 'Bonifico 30 gg d.f.'
        ),
        items: extractedItems,
        status: 'bozza',
      };

      setDraft(nextDraft);
      setActiveTab('preventivo');
      setHistory((prev) => [nextDraft, ...prev.filter((h) => h.id !== nextDraft.id)]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Errore durante l’analisi AI.');
    } finally {
      window.clearTimeout(stageTimer1);
      window.clearTimeout(stageTimer2);
      setIsAnalyzing(false);
      setAnalyzeStage('');
    }
  };

  const updateDraft = (updater: (prev: AutopilotDraft) => AutopilotDraft) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const updated = updater(prev);
      setHistory((h) => [updated, ...h.filter((item) => item.id !== updated.id)]);
      return updated;
    });
  };

  const updateLine = (lineId: string, patch: Partial<AutopilotExtractedItem>) => {
    updateDraft((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === lineId ? { ...it, ...patch } : it)),
    }));
  };

  const handleLinkInventoryItem = (lineId: string, inventoryId: string) => {
    const inv = inventory.items.find((x) => x.id === inventoryId);
    if (!inv) {
      updateLine(lineId, {
        matchedInventoryId: '',
        matchConfidence: 'nuovo_articolo',
        matchReason: 'Scollegato dal catalogo',
      });
      return;
    }
    updateLine(lineId, {
      matchedInventoryId: inv.id,
      sku: inv.sku,
      name: inv.name,
      category: inv.category || 'Materiale Generale',
      unit: inv.unit || 'pz',
      supplierName: inv.supplier || '',
      matchConfidence: 'alta',
      matchReason: 'Collegato manualmente al catalogo',
    });
  };

  const handleAddEmptyLine = () => {
    updateDraft((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `line-${Date.now()}`,
          rawMention: 'Aggiunto manualmente',
          matchedInventoryId: '',
          sku: `NEW-${String(prev.items.length + 1).padStart(3, '0')}`,
          name: 'Nuovo articolo',
          category: 'Materiale Generale',
          unit: 'pz',
          quantity: 1,
          estimatedUnitWeightKg: 1,
          unitCostEur: 15,
          fragile: false,
          dimensionsCm: '',
          matchConfidence: 'nuovo_articolo',
          matchReason: 'Inserimento manuale',
          supplierName: '',
          notes: '',
        },
      ],
    }));
  };

  const handleRemoveLine = (lineId: string) => {
    updateDraft((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== lineId),
    }));
  };

  const handleDownloadQuotePdf = async () => {
    if (!draft || !evaluation) return;
    setIsExportingPdf(true);
    try {
      const issueDate = new Date().toISOString().slice(0, 10);
      const validUntilDate = new Date(Date.now() + (draft.validityDays || 15) * 86400000)
        .toISOString()
        .slice(0, 10);

      let projectTitle = draft.projectTitle;
      let paymentTerms = draft.paymentTerms;
      let recommendedVehicle = evaluation.recommendedVehicle.name;
      let summaryNotes = draft.summaryNotes;
      let lines = evaluation.lines.map((l) => ({
        sku: l.item.sku,
        name: l.item.name,
        unit: l.item.unit,
        quantity: l.item.quantity,
        unitSalePriceEur: l.unitSalePriceEur,
        lineSaleEur: l.lineSaleEur,
        availabilityLabel:
          l.stockStatus === 'disponibile'
            ? 'Pronto'
            : l.stockStatus === 'parziale'
            ? `${l.committedQty}/${l.item.quantity}`
            : '2-3 gg',
      }));

      if (printLang !== 'it') {
        const textsToTranslate = [
          projectTitle,
          paymentTerms,
          recommendedVehicle,
          summaryNotes,
          ...lines.map((l) => l.name),
          ...lines.map((l) => l.availabilityLabel),
        ];
        const tx = await translateTextsForPrint(
          textsToTranslate,
          printLang,
          'Commercial quote / quotation PDF for industrial and warehouse materials'
        );
        projectTitle = tx[0] || projectTitle;
        paymentTerms = tx[1] || paymentTerms;
        recommendedVehicle = tx[2] || recommendedVehicle;
        summaryNotes = tx[3] || summaryNotes;
        const n = lines.length;
        lines = lines.map((l, idx) => ({
          ...l,
          name: tx[4 + idx] || l.name,
          availabilityLabel: tx[4 + n + idx] || l.availabilityLabel,
        }));
      }

      const doc = generateQuotePdf(
        {
          quoteNumber: draft.quoteNumber,
          issueDate,
          validUntilDate,
          senderCompany: currentUser.company || currentUser.name || 'METATRON CaricoStudio',
          senderEmail: currentUser.email,
          clientName: draft.clientName,
          destination: draft.destination,
          projectTitle,
          requestedDeliveryDate: draft.requestedDeliveryDate,
          paymentTerms,
          palletsCount: evaluation.pallets.length,
          boxesCount: evaluation.boxes.length,
          grossWeightKg: evaluation.grossWeightKg,
          recommendedVehicle,
          lines,
          materialsSubtotalEur: evaluation.materialsSaleSubtotalEur,
          transportEur: evaluation.transportEur,
          taxableSubtotalEur: evaluation.taxableSubtotalEur,
          vatPercent: draft.vatPercent,
          vatAmountEur: evaluation.vatAmountEur,
          grandTotalEur: evaluation.grandTotalEur,
          notes: summaryNotes,
        },
        printLang
      );
      const langSuffix = printLang !== 'it' ? `_${printLang.toUpperCase()}` : '';
      doc.save(
        `Preventivo_${draft.quoteNumber}_${draft.clientName.replace(/[^a-zA-Z0-9]+/g, '_')}${langSuffix}.pdf`
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyReply = async () => {
    if (!liveReplyMessage) return;
    try {
      await navigator.clipboard.writeText(liveReplyMessage);
      setCopiedReply(true);
      window.setTimeout(() => setCopiedReply(false), 2200);
    } catch {
      // ignore clipboard error
    }
  };

  const handleLaunchFullAutopilot = () => {
    if (!draft || !evaluation || draft.items.length === 0) return;

    let createdLoad: CargoLoad | null = null;
    if (optCreateLoad) {
      createdLoad = buildCargoLoadFromAutopilot(draft, evaluation, loads);
      onCreateLoadFromAutopilot(createdLoad);
    }

    const commessaRefCode = createdLoad?.code || draft.suggestedCommessaCode;
    let createdPos: PurchaseOrder[] = [];
    if (optCreatePurchaseOrders && evaluation.supplierShortageGroups.length > 0) {
      createdPos = buildPurchaseOrdersFromAutopilot(
        draft,
        evaluation,
        purchaseOrders,
        currentUser.name,
        commessaRefCode
      );
      if (createdPos.length > 0) {
        onUpdatePurchaseOrders([...createdPos, ...purchaseOrders]);
      }
    }

    let movementsCount = 0;
    if (optCommitStock) {
      const { nextInventory, movementsAdded } = buildCommittedInventoryState(
        inventory,
        evaluation,
        commessaRefCode,
        currentUser.name,
        draft.clientName
      );
      if (movementsAdded > 0) {
        onUpdateInventory(nextInventory);
        movementsCount = movementsAdded;
      }
    }

    let clientSaved = false;
    if (optSaveNewClient && !draft.matchedContactId && draft.clientName.trim()) {
      const exists = contacts.some(
        (c) => c.companyName.trim().toLowerCase() === draft.clientName.trim().toLowerCase()
      );
      if (!exists) {
        const nowIso = new Date().toISOString();
        const newContact: CrmContact = {
          id: `crm-ai-${Date.now()}`,
          kind: 'cliente',
          code: `CLI-${String(contacts.length + 1).padStart(3, '0')}`,
          companyName: draft.clientName.trim(),
          shippingAddress: draft.destination.trim(),
          paymentTerms: draft.paymentTerms,
          notes: `Creato automaticamente da Autopilota AI (${draft.quoteNumber})`,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        onUpdateContacts([newContact, ...contacts]);
        clientSaved = true;
      }
    }

    updateDraft((prev) => ({
      ...prev,
      status: 'lanciata',
      createdLoadId: createdLoad?.id || prev.createdLoadId,
      createdLoadCode: createdLoad?.code || prev.createdLoadCode,
      createdPoNumbers: createdPos.map((p) => p.number),
    }));

    setLaunchFeedback({
      loadCode: createdLoad?.code,
      poNumbers: createdPos.map((p) => p.number),
      stockMovementsCount: movementsCount,
      clientSaved,
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] text-slate-900 overflow-hidden">
      {/* Top Action Header */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate">
              Autopilota Preventivi &amp; Commesse AI
            </h2>
            <p className="text-xs text-slate-500 truncate">
              Incolla WhatsApp, Email o trascina un PDF/foto: in 10 secondi ottieni Preventivo, Scorte, Riordini e Piano Camion 3D.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium tabular-nums">
            <Package className="w-3.5 h-3.5 text-slate-500" />
            {inventory.items.length} articoli in catalogo
          </span>
          <button
            type="button"
            onClick={() => setShowHistoryDrawer((v) => !v)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              showHistoryDrawer
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Storico ({history.length})
          </button>
          <PrintLanguageSelector
            value={printLang}
            onChange={setPrintLang}
            isTranslating={isExportingPdf}
          />
          {draft && evaluation && (
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleDownloadQuotePdf}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-amber-400" />
              )}
              Preventivo PDF A4
            </button>
          )}
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Pane: Input Richiesta Cliente */}
        <div className="w-full lg:w-[390px] xl:w-[420px] shrink-0 bg-white border-r border-slate-200 flex flex-col min-h-0 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              1. Richiesta del Cliente
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setRawText(SAMPLE_WHATSAPP_REQUEST);
                  setAttachedFile(null);
                  setErrorMessage(null);
                }}
                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer"
                title="Carica un messaggio WhatsApp di esempio"
              >
                Es. WhatsApp
              </button>
              <button
                type="button"
                onClick={() => {
                  setRawText(SAMPLE_EMAIL_REQUEST);
                  setAttachedFile(null);
                  setErrorMessage(null);
                }}
                className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-700 cursor-pointer"
                title="Carica una richiesta email di esempio"
              >
                Es. Email
              </button>
              {(rawText || attachedFile) && (
                <button
                  type="button"
                  onClick={() => {
                    setRawText('');
                    setAttachedFile(null);
                    setErrorMessage(null);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Pulisci input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            onPaste={handlePasteInTextarea}
            rows={9}
            placeholder="Incolla qui un messaggio WhatsApp disordinato, una email, un elenco di cantiere oppure premi Ctrl+V per incollare uno screenshot..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 px-3.5 py-3 text-xs text-slate-800 leading-relaxed resize-none outline-none transition-all"
          />

          {/* Dropzone PDF / Immagine / Screenshot */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              const f = e.dataTransfer.files?.[0];
              if (f) await handleAttachFile(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-3.5 text-center cursor-pointer transition-colors ${
              isDraggingFile
                ? 'border-blue-500 bg-blue-50'
                : attachedFile
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp,.txt"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await handleAttachFile(f);
                e.target.value = '';
              }}
            />
            {attachedFile ? (
              <div className="flex items-center justify-between gap-2 text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {attachedFile.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {(attachedFile.sizeBytes / 1024).toFixed(0)} KB · Pronto per lettura AI
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachedFile(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 py-1">
                <Upload className="w-4.5 h-4.5 text-slate-400" />
                <div className="text-xs font-semibold text-slate-700">
                  Allega PDF, foto foglio o screenshot WhatsApp
                </div>
                <div className="text-[11px] text-slate-500">
                  Trascina qui oppure clicca (PDF, JPG, PNG, WEBP)
                </div>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            disabled={isAnalyzing || (!rawText.trim() && !attachedFile)}
            onClick={handleAnalyzeWithAI}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-colors"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{analyzeStage || 'Analisi AI in corso...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analizza e Prepara Preventivo + Commessa + Camion</span>
              </>
            )}
          </button>

          {/* Riepilogo Dati Testata Cliente (quando c'è una bozza) */}
          {draft && (
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  Intestazione &amp; Condizioni
                </span>
                <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {draft.quoteNumber}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">Cliente</span>
                  <input
                    type="text"
                    value={draft.clientName}
                    onChange={(e) =>
                      updateDraft((p) => ({ ...p, clientName: e.target.value }))
                    }
                    className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 focus:border-blue-500 outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">
                    Oggetto / Titolo Commessa
                  </span>
                  <input
                    type="text"
                    value={draft.projectTitle}
                    onChange={(e) =>
                      updateDraft((p) => ({ ...p, projectTitle: e.target.value }))
                    }
                    className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:border-blue-500 outline-none"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">
                    Destinazione Consegna
                  </span>
                  <input
                    type="text"
                    value={draft.destination}
                    onChange={(e) =>
                      updateDraft((p) => ({ ...p, destination: e.target.value }))
                    }
                    className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:border-blue-500 outline-none"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600">
                      Consegna richiesta
                    </span>
                    <input
                      type="date"
                      value={draft.requestedDeliveryDate}
                      onChange={(e) =>
                        updateDraft((p) => ({ ...p, requestedDeliveryDate: e.target.value }))
                      }
                      className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:border-blue-500 outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-600">
                      Codice Commessa
                    </span>
                    <input
                      type="text"
                      value={draft.suggestedCommessaCode}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          suggestedCommessaCode: e.target.value.toUpperCase(),
                        }))
                      }
                      className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-semibold text-slate-900 focus:border-blue-500 outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[11px] font-medium text-slate-600">
                    Termini di pagamento
                  </span>
                  <input
                    type="text"
                    value={draft.paymentTerms}
                    onChange={(e) =>
                      updateDraft((p) => ({ ...p, paymentTerms: e.target.value }))
                    }
                    className="mt-0.5 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:border-blue-500 outline-none"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Live Cockpit (Preventivo + Scorte + Camion + Riordini + Lancio 1-Click) */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {!draft || !evaluation ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="max-w-lg text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center mx-auto shadow-md">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Da messaggio disordinato a Commessa operativa in 10 secondi
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Incolla a sinistra una richiesta WhatsApp, una mail del cliente oppure trascina un PDF o uno screenshot. L&apos;AI riconosce gli articoli collegandoli al tuo magazzino reale, calcola margine e preventivo, stima i bancali EPAL sul camion e prepara i riordini per i soli pezzi mancanti.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 text-left">
                  {[
                    { icon: Package, title: 'Match Catalogo', desc: 'Riconosce anche gergo e abbreviazioni' },
                    { icon: FileText, title: 'Preventivo PDF', desc: 'Margini editabili + PDF A4 pronto' },
                    { icon: Truck, title: 'Bancali & 3D', desc: 'Calcola EPAL, pesi e mezzo ideale' },
                    { icon: ShoppingCart, title: 'Riordini Auto', desc: 'Ordina solo ciò che manca a scorta' },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="bg-white border border-slate-200 rounded-xl p-3 space-y-1"
                    >
                      <card.icon className="w-4 h-4 text-blue-600" />
                      <div className="text-xs font-bold text-slate-900">{card.title}</div>
                      <div className="text-[11px] text-slate-500 leading-snug">{card.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* KPI Summary Bar */}
              <div className="bg-white border-b border-slate-200 px-5 py-3 grid grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Totale Preventivo (Ivato)
                  </div>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {formatEur(evaluation.grandTotalEur)}
                  </div>
                  <div className="text-[11px] text-emerald-700 font-semibold tabular-nums">
                    Margine {formatEur(evaluation.grossMarginEur)} ({evaluation.effectiveMarginPercent}%)
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Disponibilità Magazzino
                  </div>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {evaluation.readyLinesCount}/{evaluation.lines.length} voci pronte
                  </div>
                  <div
                    className={`text-[11px] font-semibold tabular-nums ${
                      evaluation.totalShortageUnits > 0 ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {evaluation.totalShortageUnits > 0
                      ? `${evaluation.totalShortageUnits} pz da ordinare (${evaluation.supplierShortageGroups.length} forn.)`
                      : 'Tutto pronto in magazzino'}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Bancali &amp; Piano Camion
                  </div>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {evaluation.pallets.length} EPAL · {evaluation.grossWeightKg.toFixed(0)} kg
                  </div>
                  <div className="text-[11px] text-blue-700 font-semibold truncate">
                    {evaluation.recommendedVehicle.name} ({evaluation.palletSaturationPct}% spazio)
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5">
                  <div className="text-[11px] font-medium text-slate-500">
                    Stato &amp; Urgenza
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        draft.urgency === 'critica'
                          ? 'bg-rose-100 text-rose-700'
                          : draft.urgency === 'urgente'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {draft.urgency}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 tabular-nums">
                      {draft.requestedDeliveryDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {evaluation.totalPieces} pz totali · {evaluation.boxes.length} scatole
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="bg-white border-b border-slate-200 px-5 flex items-center justify-between gap-2 shrink-0 overflow-x-auto">
                <div className="flex items-center gap-1">
                  {[
                    {
                      id: 'preventivo' as const,
                      label: `Preventivo & Scorte (${evaluation.lines.length})`,
                      icon: FileText,
                    },
                    {
                      id: 'camion' as const,
                      label: `Bancali & Camion (${evaluation.pallets.length} EPAL)`,
                      icon: Truck,
                    },
                    {
                      id: 'riordini' as const,
                      label: `Riordini Mancanti (${evaluation.supplierShortageGroups.length})`,
                      icon: ShoppingCart,
                    },
                    {
                      id: 'risposta' as const,
                      label: 'Risposta Cliente',
                      icon: MessageSquareText,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                        activeTab === tab.id
                          ? 'border-blue-600 text-blue-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {launchFeedback && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-bold text-emerald-950">
                          Autopilota eseguito con successo!
                        </div>
                        <div className="text-xs text-emerald-800 mt-0.5 space-x-2">
                          {launchFeedback.loadCode && (
                            <span>Commessa <strong>{launchFeedback.loadCode}</strong> creata con bancali e piano camion</span>
                          )}
                          {launchFeedback.poNumbers.length > 0 && (
                            <span>· Ordini Fornitore: <strong>{launchFeedback.poNumbers.join(', ')}</strong></span>
                          )}
                          {launchFeedback.stockMovementsCount > 0 && (
                            <span>· {launchFeedback.stockMovementsCount} articoli scaricati dal magazzino</span>
                          )}
                          {launchFeedback.clientSaved && <span>· Nuovo cliente salvato in Rubrica</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {launchFeedback.loadCode && (
                        <>
                          <button
                            type="button"
                            onClick={() => onNavigateToApp('commesse')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            Apri Commessa
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateToApp('truck')}
                            className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold cursor-pointer"
                          >
                            Apri Piano Camion 3D
                          </button>
                        </>
                      )}
                      {launchFeedback.poNumbers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onNavigateToApp('purchase_orders')}
                          className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold cursor-pointer"
                        >
                          Vedi Ordini Fornitori
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'preventivo' && (
                  <div className="space-y-4">
                    {/* Controlli Economici Rapidi */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-end justify-between gap-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="block">
                          <span className="text-[11px] font-semibold text-slate-600">
                            Ricarico / Margine (%)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={300}
                            value={draft.marginPercent}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                marginPercent: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="mt-1 w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold tabular-nums text-slate-900 outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold text-slate-600">
                            Trasporto &amp; Imballo (€)
                          </span>
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={draft.transportEur}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                transportEur: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="mt-1 w-28 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold tabular-nums text-slate-900 outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[11px] font-semibold text-slate-600">
                            IVA (%)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={draft.vatPercent}
                            onChange={(e) =>
                              updateDraft((p) => ({
                                ...p,
                                vatPercent: Math.max(0, Number(e.target.value) || 0),
                              }))
                            }
                            className="mt-1 w-20 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold tabular-nums text-slate-900 outline-none focus:border-blue-500"
                          />
                        </label>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddEmptyLine}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Aggiungi Articolo
                      </button>
                    </div>

                    {/* Tabella Articoli & Matching Catalogo */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                              <th className="py-2.5 px-3">Articolo &amp; Match Catalogo</th>
                              <th className="py-2.5 px-2 text-right w-20">Q.tà</th>
                              <th className="py-2.5 px-2 text-center w-28">Magazzino</th>
                              <th className="py-2.5 px-2 text-right w-24">Peso u. (kg)</th>
                              <th className="py-2.5 px-2 text-right w-24">Costo u. (€)</th>
                              <th className="py-2.5 px-2 text-right w-24">Vendita u.</th>
                              <th className="py-2.5 px-3 text-right w-28">Importo</th>
                              <th className="py-2.5 px-2 w-9" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {evaluation.lines.map((line) => (
                              <tr key={line.item.id} className="hover:bg-slate-50/70 align-top">
                                <td className="py-2.5 px-3 min-w-[260px]">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={line.item.sku}
                                      onChange={(e) =>
                                        updateLine(line.item.id, { sku: e.target.value })
                                      }
                                      className="w-24 px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] font-bold text-slate-800 bg-slate-50"
                                    />
                                    <input
                                      type="text"
                                      value={line.item.name}
                                      onChange={(e) =>
                                        updateLine(line.item.id, { name: e.target.value })
                                      }
                                      className="flex-1 px-2 py-0.5 rounded border border-slate-200 text-xs font-semibold text-slate-900"
                                    />
                                  </div>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <select
                                      value={line.item.matchedInventoryId}
                                      onChange={(e) =>
                                        handleLinkInventoryItem(line.item.id, e.target.value)
                                      }
                                      className="max-w-[240px] px-2 py-0.5 rounded border border-slate-200 bg-white text-[11px] text-slate-600"
                                    >
                                      <option value="">
                                        — Articolo non a catalogo (nuovo) —
                                      </option>
                                      {inventory.items.map((inv) => (
                                        <option key={inv.id} value={inv.id}>
                                          {inv.sku} · {inv.name} (disp: {inv.quantity})
                                        </option>
                                      ))}
                                    </select>
                                    {line.item.fragile && (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-bold">
                                        FRAGILE
                                      </span>
                                    )}
                                    {line.item.rawMention &&
                                      line.item.rawMention !== line.item.name && (
                                        <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                          da: &ldquo;{line.item.rawMention}&rdquo;
                                        </span>
                                      )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-2 text-right">
                                  <input
                                    type="number"
                                    min={1}
                                    value={line.item.quantity}
                                    onChange={(e) =>
                                      updateLine(line.item.id, {
                                        quantity: Math.max(1, Math.round(Number(e.target.value) || 1)),
                                      })
                                    }
                                    className="w-16 px-2 py-1 rounded border border-slate-200 text-right font-bold tabular-nums"
                                  />
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {line.item.unit}
                                  </div>
                                </td>

                                <td className="py-2.5 px-2 text-center">
                                  {line.stockStatus === 'disponibile' && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[11px] font-bold tabular-nums">
                                      Pronto ({line.availableStock})
                                    </span>
                                  )}
                                  {line.stockStatus === 'parziale' && (
                                    <div className="space-y-0.5">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-bold tabular-nums">
                                        {line.committedQty}/{line.item.quantity} disp.
                                      </span>
                                      <div className="text-[10px] text-rose-600 font-semibold">
                                        Mancano {line.shortageQty}
                                      </div>
                                    </div>
                                  )}
                                  {line.stockStatus === 'mancante' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] font-bold tabular-nums">
                                      Mancano {line.shortageQty}
                                    </span>
                                  )}
                                  {line.stockStatus === 'nuovo' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-semibold">
                                      Da ordinare
                                    </span>
                                  )}
                                </td>

                                <td className="py-2.5 px-2 text-right">
                                  <input
                                    type="number"
                                    min={0.05}
                                    step={0.1}
                                    value={line.item.estimatedUnitWeightKg}
                                    onChange={(e) =>
                                      updateLine(line.item.id, {
                                        estimatedUnitWeightKg: Math.max(
                                          0.05,
                                          Number(e.target.value) || 0.1
                                        ),
                                      })
                                    }
                                    className="w-18 px-2 py-1 rounded border border-slate-200 text-right tabular-nums"
                                  />
                                  <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                                    tot {line.lineWeightKg.toFixed(1)} kg
                                  </div>
                                </td>

                                <td className="py-2.5 px-2 text-right">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={line.item.unitCostEur}
                                    onChange={(e) =>
                                      updateLine(line.item.id, {
                                        unitCostEur: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                    className="w-20 px-2 py-1 rounded border border-slate-200 text-right tabular-nums"
                                  />
                                </td>

                                <td className="py-2.5 px-2 text-right font-semibold text-slate-700 tabular-nums pt-3.5">
                                  {formatEur(line.unitSalePriceEur)}
                                </td>

                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 tabular-nums pt-3.5">
                                  {formatEur(line.lineSaleEur)}
                                </td>

                                <td className="py-2.5 px-2 text-center pt-3">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveLine(line.item.id)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                    title="Rimuovi voce"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Riepilogo Totali in calce */}
                      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div className="text-slate-600 space-y-0.5 tabular-nums">
                          <div>
                            Costo materiali stimato:{' '}
                            <strong className="text-slate-800">
                              {formatEur(evaluation.totalMaterialsCostEur)}
                            </strong>
                          </div>
                          <div>
                            Margine lordo stimato:{' '}
                            <strong className="text-emerald-700">
                              {formatEur(evaluation.grossMarginEur)} ({evaluation.effectiveMarginPercent}%)
                            </strong>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-5 tabular-nums">
                          <div className="text-right">
                            <div className="text-[11px] text-slate-500">Imponibile</div>
                            <div className="font-bold text-slate-900">
                              {formatEur(evaluation.taxableSubtotalEur)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-slate-500">
                              IVA {draft.vatPercent}%
                            </div>
                            <div className="font-semibold text-slate-700">
                              {formatEur(evaluation.vatAmountEur)}
                            </div>
                          </div>
                          <div className="text-right pl-4 border-l border-slate-300">
                            <div className="text-[11px] font-semibold text-blue-700">
                              TOTALE PREVENTIVO
                            </div>
                            <div className="text-base font-extrabold text-slate-900">
                              {formatEur(evaluation.grandTotalEur)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'camion' && (
                  <div className="space-y-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                          <Truck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            Mezzo consigliato: {evaluation.recommendedVehicle.name}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {evaluation.pallets.length} / {evaluation.recommendedVehicle.maxPallets}{' '}
                            bancali EPAL · Peso lordo {evaluation.grossWeightKg.toFixed(1)} kg /{' '}
                            {evaluation.recommendedVehicle.maxWeightKg.toLocaleString('it-IT')} kg
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs tabular-nums">
                        <div>
                          <div className="text-[11px] text-slate-500">Saturazione spazio</div>
                          <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden mt-1">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${evaluation.palletSaturationPct}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Saturazione peso</div>
                          <div className="w-32 h-2 rounded-full bg-slate-200 overflow-hidden mt-1">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${evaluation.weightSaturationPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {evaluation.pallets.map((pallet) => {
                        const palletBoxes = evaluation.boxes.filter(
                          (b) => b.palletId === pallet.id
                        );
                        const palletItems = evaluation.checklistItems.filter(
                          (it) => it.palletId === pallet.id
                        );
                        const palletNet = palletItems.reduce(
                          (s, it) => s + it.quantity * it.unitWeightKg,
                          0
                        );
                        const palletGross =
                          palletNet +
                          pallet.tareKg +
                          palletBoxes.reduce((s, b) => s + b.tareKg, 0);

                        return (
                          <div
                            key={pallet.id}
                            className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400">
                                  {pallet.code}
                                </span>
                                <span className="text-xs font-bold text-slate-900">
                                  {pallet.label}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                                Slot #{pallet.truckSlot} · H {pallet.heightCm} cm
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-600 tabular-nums">
                              <span>{pallet.dimensionsCm}</span>
                              <span>·</span>
                              <span>{palletBoxes.length} scatole</span>
                              <span>·</span>
                              <span className="font-bold text-slate-900">
                                {palletGross.toFixed(1)} kg lordi
                              </span>
                            </div>

                            <div className="border-t border-slate-100 pt-2 space-y-1">
                              {palletItems.map((it) => (
                                <div
                                  key={it.id}
                                  className="flex items-center justify-between gap-2 text-xs text-slate-700"
                                >
                                  <span className="truncate flex items-center gap-1.5">
                                    <Box className="w-3 h-3 text-slate-400 shrink-0" />
                                    {it.name}
                                  </span>
                                  <span className="font-mono font-semibold text-slate-900 shrink-0 tabular-nums">
                                    ×{it.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'riordini' && (
                  <div className="space-y-3">
                    {evaluation.supplierShortageGroups.length === 0 ? (
                      <div className="bg-white border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                        <div className="text-sm font-bold text-slate-900">
                          Nessun riordino necessario
                        </div>
                        <p className="text-xs text-slate-600">
                          Tutti gli articoli richiesti sono già disponibili nelle giacenze attuali di magazzino.
                        </p>
                      </div>
                    ) : (
                      evaluation.supplierShortageGroups.map((group) => (
                        <div
                          key={group.supplierName}
                          className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
                        >
                          <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                Fornitore: {group.supplierName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {group.supplierContact
                                  ? `${group.supplierContact.email || 'Nessuna email'} · Consegna media ${group.supplierContact.leadTimeDays || 3} gg`
                                  : 'Fornitore non ancora in rubrica (verrà creata bozza OdA modificabile)'}
                              </div>
                            </div>
                            <div className="text-right tabular-nums">
                              <div className="text-xs font-bold text-slate-900">
                                {formatEur(group.estimatedCostEur)}
                              </div>
                              <div className="text-[11px] text-amber-700 font-semibold">
                                {group.totalMissingUnits} unità da ordinare
                              </div>
                            </div>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {group.items.map((line) => (
                              <div
                                key={line.item.id}
                                className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <span className="font-mono font-bold text-slate-700 mr-2">
                                    {line.item.sku}
                                  </span>
                                  <span className="font-semibold text-slate-900">
                                    {line.item.name}
                                  </span>
                                  <span className="text-[11px] text-slate-500 ml-2">
                                    (in casa: {line.availableStock} · richiesti: {line.item.quantity})
                                  </span>
                                </div>
                                <div className="font-bold text-rose-700 tabular-nums shrink-0">
                                  Ordina {line.shortageQty} {line.item.unit}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'risposta' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Risposta pronta per WhatsApp / Email
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Aggiornata automaticamente con i totali reali, i bancali e la disponibilità di magazzino.
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCopyReply}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedReply ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              Copiato!
                            </>
                          ) : (
                            <>
                              <ClipboardCopy className="w-3.5 h-3.5" />
                              Copia Testo
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadQuotePdf}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Scarica PDF Allegato
                        </button>
                      </div>
                    </div>

                    <textarea
                      readOnly
                      rows={13}
                      value={liveReplyMessage}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-800 leading-relaxed font-sans outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Sticky Bottom 1-Click Autopilot Execution Bar */}
              <div className="bg-white border-t border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={optCreateLoad}
                      onChange={(e) => setOptCreateLoad(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold">Crea Commessa + Piano 3D</span>
                  </label>

                  {evaluation.supplierShortageGroups.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={optCreatePurchaseOrders}
                        onChange={(e) => setOptCreatePurchaseOrders(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-semibold">
                        Genera {evaluation.supplierShortageGroups.length} OdA Mancanti
                      </span>
                    </label>
                  )}

                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={optCommitStock}
                      onChange={(e) => setOptCommitStock(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Scarica subito scorte disponibili</span>
                  </label>

                  {!draft.matchedContactId && (
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={optSaveNewClient}
                        onChange={(e) => setOptSaveNewClient(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Salva nuovo cliente</span>
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  disabled={draft.items.length === 0 || (!optCreateLoad && !optCreatePurchaseOrders && !optCommitStock)}
                  onClick={handleLaunchFullAutopilot}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer transition-colors whitespace-nowrap"
                >
                  <Rocket className="w-4 h-4" />
                  <span>Conferma &amp; Lancia in Produzione</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* History Side Drawer */}
        {showHistoryDrawer && (
          <div className="absolute inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Storico Preventivi AI ({history.length})
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {history.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-8">
                  Nessun preventivo analizzato finora.
                </div>
              ) : (
                history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setDraft(item);
                      setLaunchFeedback(null);
                      setShowHistoryDrawer(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      draft?.id === item.id
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold text-blue-700">
                        {item.quoteNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          item.status === 'lanciata'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate mt-1">
                      {item.clientName}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {item.items.length} articoli · {item.createdLoadCode || item.suggestedCommessaCode}
                    </div>
                  </button>
                ))
              )}
            </div>
            {history.length > 0 && (
              <div className="p-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setHistory([])}
                  className="w-full py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Svuota Storico Locale
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
