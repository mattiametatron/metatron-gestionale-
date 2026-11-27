import {
  BOX_SPECS,
  CargoBox,
  CargoLoad,
  CargoPallet,
  ChecklistItem,
  CrmContact,
  PALLET_SPECS,
  PurchaseOrder,
  PurchaseOrderItem,
  StockMovement,
  WarehouseInventoryState,
  WarehouseStockItem,
} from '../types/warehouse';

export type AutopilotUrgency = 'normale' | 'urgente' | 'critica';
export type AutopilotMatchConfidence = 'alta' | 'media' | 'nuovo_articolo';
export type AutopilotStockStatus = 'disponibile' | 'parziale' | 'mancante' | 'nuovo';

export interface AutopilotExtractedItem {
  id: string;
  rawMention: string;
  matchedInventoryId: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  estimatedUnitWeightKg: number;
  unitCostEur: number;
  fragile: boolean;
  dimensionsCm: string;
  matchConfidence: AutopilotMatchConfidence;
  matchReason: string;
  supplierName: string;
  notes: string;
}

export interface AutopilotDraft {
  id: string;
  createdAt: string;
  sourceKind: 'testo' | 'file' | 'misto';
  sourceFileName?: string;
  sourcePreview: string;
  quoteNumber: string;
  clientName: string;
  matchedContactId: string;
  destination: string;
  requestedDeliveryDate: string;
  urgency: AutopilotUrgency;
  projectTitle: string;
  suggestedCommessaCode: string;
  summaryNotes: string;
  customerReplyMessage: string;
  marginPercent: number;
  transportEur: number;
  vatPercent: number;
  validityDays: number;
  paymentTerms: string;
  items: AutopilotExtractedItem[];
  status: 'bozza' | 'lanciata';
  createdLoadId?: string;
  createdLoadCode?: string;
  createdPoNumbers?: string[];
}

export interface EvaluatedAutopilotLine {
  item: AutopilotExtractedItem;
  inventoryMatch: WarehouseStockItem | null;
  availableStock: number;
  committedQty: number;
  shortageQty: number;
  stockStatus: AutopilotStockStatus;
  unitSalePriceEur: number;
  lineCostEur: number;
  lineSaleEur: number;
  lineMarginEur: number;
  lineWeightKg: number;
  supplierName: string;
}

export interface PlannedVehicleSpec {
  name: string;
  maxPallets: number;
  maxWeightKg: number;
}

export interface AutopilotEvaluation {
  lines: EvaluatedAutopilotLine[];
  totalPieces: number;
  totalMaterialsCostEur: number;
  materialsSaleSubtotalEur: number;
  transportEur: number;
  taxableSubtotalEur: number;
  vatAmountEur: number;
  grandTotalEur: number;
  grossMarginEur: number;
  effectiveMarginPercent: number;
  readyLinesCount: number;
  partialLinesCount: number;
  missingLinesCount: number;
  totalShortageUnits: number;
  netWeightKg: number;
  grossWeightKg: number;
  pallets: CargoPallet[];
  boxes: CargoBox[];
  checklistItems: ChecklistItem[];
  recommendedVehicle: PlannedVehicleSpec;
  weightSaturationPct: number;
  palletSaturationPct: number;
  supplierShortageGroups: Array<{
    supplierName: string;
    supplierContact: CrmContact | null;
    items: EvaluatedAutopilotLine[];
    estimatedCostEur: number;
    totalMissingUnits: number;
  }>;
}

export const AUTOPILOT_HISTORY_STORAGE_KEY = 'metatron_ai_order_autopilot_history_v1';

export function generateNextQuoteNumber(existingCount: number): string {
  const year = new Date().getFullYear();
  const seq = String(existingCount + 1).padStart(3, '0');
  return `PREV-${year}-${seq}`;
}

export function generateNextCommessaCode(loads: CargoLoad[], hint?: string): string {
  const cleanHint = (hint || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const existingCodes = new Set(loads.map((l) => l.code.toUpperCase()));
  if (cleanHint && cleanHint.length >= 4 && !existingCodes.has(cleanHint)) {
    return cleanHint;
  }
  const year = new Date().getFullYear();
  let maxNum = loads.length;
  for (const l of loads) {
    const m = l.code.match(/(\d{2,5})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
  }
  let candidate = `COM-${year}-${String(maxNum + 1).padStart(3, '0')}`;
  let guard = 2;
  while (existingCodes.has(candidate.toUpperCase())) {
    candidate = `COM-${year}-${String(maxNum + guard).padStart(3, '0')}`;
    guard += 1;
  }
  return candidate;
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findInventoryMatchForLine(
  item: AutopilotExtractedItem,
  inventoryItems: WarehouseStockItem[]
): WarehouseStockItem | null {
  if (item.matchedInventoryId) {
    const byId = inventoryItems.find((i) => i.id === item.matchedInventoryId);
    if (byId) return byId;
  }
  const cleanSku = item.sku.trim().toLowerCase();
  if (cleanSku) {
    const bySku = inventoryItems.find(
      (i) =>
        i.sku.trim().toLowerCase() === cleanSku ||
        (i.barcode && i.barcode.trim().toLowerCase() === cleanSku)
    );
    if (bySku) return bySku;
  }
  const cleanName = normalizeToken(item.name);
  if (cleanName.length >= 4) {
    const exactName = inventoryItems.find((i) => normalizeToken(i.name) === cleanName);
    if (exactName) return exactName;
  }
  return null;
}

export function chooseOptimalVehicle(
  palletCount: number,
  grossWeightKg: number
): PlannedVehicleSpec {
  const fleet: PlannedVehicleSpec[] = [
    { name: 'Furgone 4 EPAL', maxPallets: 4, maxWeightKg: 1200 },
    { name: 'Camioncino 8 EPAL', maxPallets: 8, maxWeightKg: 3500 },
    { name: 'Motrice 12 EPAL', maxPallets: 12, maxWeightKg: 7500 },
    { name: 'Motrice 18 EPAL', maxPallets: 18, maxWeightKg: 12000 },
    { name: 'Bilico 33 EPAL', maxPallets: 33, maxWeightKg: 24000 },
  ];
  for (const v of fleet) {
    if (palletCount <= v.maxPallets && grossWeightKg <= v.maxWeightKg) {
      return v;
    }
  }
  return {
    name: 'Bilico 33 EPAL (Multi-Viaggio)',
    maxPallets: Math.max(33, palletCount),
    maxWeightKg: Math.max(24000, Math.ceil(grossWeightKg / 1000) * 1000),
  };
}

/**
 * Calcola in tempo reale disponibilità scorte, margini preventivo,
 * confezionamento automatico scatole/bancali EPAL, piano camion e lista riordini.
 */
export function evaluateAutopilotDraft(
  draft: AutopilotDraft,
  inventory: WarehouseInventoryState,
  contacts: CrmContact[]
): AutopilotEvaluation {
  const marginPct = Math.max(0, Math.min(300, Number(draft.marginPercent) || 0));
  const multiplier = 1 + marginPct / 100;
  const transportEur = Math.max(0, Number(draft.transportEur) || 0);
  const vatPercent = Math.max(0, Math.min(50, Number(draft.vatPercent) || 0));

  // Traccia disponibilità residua se lo stesso articolo compare su più righe
  const remainingStockById = new Map<string, number>();
  for (const inv of inventory.items) {
    remainingStockById.set(inv.id, Math.max(0, Number(inv.quantity) || 0));
  }

  const lines: EvaluatedAutopilotLine[] = draft.items.map((item) => {
    const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
    const unitWeight = Math.max(0.05, Number(item.estimatedUnitWeightKg) || 0.5);
    const unitCost = Math.max(0, Number(item.unitCostEur) || 0);
    const invMatch = findInventoryMatchForLine(item, inventory.items);

    const availableStock = invMatch ? remainingStockById.get(invMatch.id) ?? 0 : 0;
    const committedQty = invMatch ? Math.min(availableStock, qty) : 0;
    const shortageQty = Math.max(0, qty - committedQty);
    if (invMatch) {
      remainingStockById.set(invMatch.id, Math.max(0, availableStock - committedQty));
    }

    let stockStatus: AutopilotStockStatus = 'nuovo';
    if (invMatch) {
      if (shortageQty === 0) stockStatus = 'disponibile';
      else if (committedQty > 0) stockStatus = 'parziale';
      else stockStatus = 'mancante';
    }

    const unitSalePriceEur = Math.round(unitCost * multiplier * 100) / 100;
    const lineCostEur = Math.round(unitCost * qty * 100) / 100;
    const lineSaleEur = Math.round(unitSalePriceEur * qty * 100) / 100;
    const lineMarginEur = Math.round((lineSaleEur - lineCostEur) * 100) / 100;
    const lineWeightKg = Math.round(unitWeight * qty * 100) / 100;
    const supplierName =
      (item.supplierName || '').trim() ||
      (invMatch?.supplier || '').trim() ||
      'Fornitore Da Assegnare';

    return {
      item: {
        ...item,
        quantity: qty,
        estimatedUnitWeightKg: unitWeight,
        unitCostEur: unitCost,
      },
      inventoryMatch: invMatch,
      availableStock,
      committedQty,
      shortageQty,
      stockStatus,
      unitSalePriceEur,
      lineCostEur,
      lineSaleEur,
      lineMarginEur,
      lineWeightKg,
      supplierName,
    };
  });

  const totalPieces = lines.reduce((s, l) => s + l.item.quantity, 0);
  const totalMaterialsCostEur =
    Math.round(lines.reduce((s, l) => s + l.lineCostEur, 0) * 100) / 100;
  const materialsSaleSubtotalEur =
    Math.round(lines.reduce((s, l) => s + l.lineSaleEur, 0) * 100) / 100;
  const taxableSubtotalEur =
    Math.round((materialsSaleSubtotalEur + transportEur) * 100) / 100;
  const vatAmountEur =
    Math.round(taxableSubtotalEur * (vatPercent / 100) * 100) / 100;
  const grandTotalEur = Math.round((taxableSubtotalEur + vatAmountEur) * 100) / 100;
  const grossMarginEur =
    Math.round((materialsSaleSubtotalEur - totalMaterialsCostEur) * 100) / 100;
  const effectiveMarginPercent =
    materialsSaleSubtotalEur > 0
      ? Math.round((grossMarginEur / materialsSaleSubtotalEur) * 1000) / 10
      : 0;

  const readyLinesCount = lines.filter((l) => l.stockStatus === 'disponibile').length;
  const partialLinesCount = lines.filter((l) => l.stockStatus === 'parziale').length;
  const missingLinesCount = lines.filter(
    (l) => l.stockStatus === 'mancante' || l.stockStatus === 'nuovo'
  ).length;
  const totalShortageUnits = lines.reduce((s, l) => s + l.shortageQty, 0);

  // --- Pianificazione Automatica Scatole, Bancali EPAL e Slot Camion ---
  const pallets: CargoPallet[] = [];
  const boxes: CargoBox[] = [];
  const checklistItems: ChecklistItem[] = [];

  const maxPalletPayloadKg = 720; // Margine sicurezza su EPAL 800kg
  const maxBoxesPerPallet = 12;

  interface WorkingPallet {
    pallet: CargoPallet;
    currentWeightKg: number;
    boxesCount: number;
    looseItemsCount: number;
  }

  const workingPallets: WorkingPallet[] = [];

  const createWorkingPallet = (labelSuffix: string): WorkingPallet => {
    const idx = workingPallets.length + 1;
    const spec = PALLET_SPECS.EPAL_80x120;
    const pallet: CargoPallet = {
      id: `pal-ai-${Date.now()}-${idx}`,
      code: `PAL-${String(idx).padStart(2, '0')}`,
      label: `Bancale ${idx} — ${labelSuffix}`,
      palletType: 'EPAL_80x120',
      dimensionsCm: spec.dimensionsCm,
      heightCm: 115,
      tareKg: spec.tareKg,
      maxWeightKg: spec.defaultMaxKg,
      wrapped: false,
      truckSlot: idx,
      notes: 'Pianificato automaticamente da Autopilota AI',
    };
    const wp: WorkingPallet = {
      pallet,
      currentWeightKg: 0,
      boxesCount: 0,
      looseItemsCount: 0,
    };
    workingPallets.push(wp);
    pallets.push(pallet);
    return wp;
  };

  // Ordina: prima articoli pesanti/ingombranti, poi scatolabili, poi fragili in alto
  const sortedLines = [...lines].sort((a, b) => {
    if (a.item.fragile !== b.item.fragile) return a.item.fragile ? 1 : -1;
    return b.lineWeightKg - a.lineWeightKg;
  });

  let boxSeq = 1;
  let activeBox: {
    box: CargoBox;
    palletRef: WorkingPallet;
    currentWeightKg: number;
    fragile: boolean;
  } | null = null;

  for (const line of sortedLines) {
    const isHeavyOrBulky =
      line.item.estimatedUnitWeightKg >= 12 ||
      line.lineWeightKg >= 45 ||
      /profil|barra|trave|pannell|lastra|tubo|bancal|telaio/i.test(line.item.name);

    if (isHeavyOrBulky) {
      // Articolo posato direttamente su bancale (fuori scatola)
      let targetPallet = workingPallets.find(
        (wp) => wp.currentWeightKg + line.lineWeightKg <= maxPalletPayloadKg
      );
      if (!targetPallet) {
        targetPallet = createWorkingPallet(line.item.category || 'Materiale Pesante');
      }
      targetPallet.currentWeightKg += line.lineWeightKg;
      targetPallet.looseItemsCount += 1;

      checklistItems.push({
        id: `itm-ai-${line.item.id}`,
        sku: line.item.sku || `ART-${checklistItems.length + 1}`,
        name: line.item.name,
        category: line.item.category || 'Materiale Generale',
        quantity: line.item.quantity,
        unitWeightKg: line.item.estimatedUnitWeightKg,
        checked: false,
        fragile: line.item.fragile,
        palletId: targetPallet.pallet.id,
        boxId: null,
        dimensionsCm: line.item.dimensionsCm || undefined,
        notes: [
          line.item.notes,
          line.shortageQty > 0 ? `Da ordinare: ${line.shortageQty} ${line.item.unit}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      });
    } else {
      // Articolo scatolabile (minuterie, ricambi, accessori, fragili)
      const boxSpec = line.item.fragile ? BOX_SPECS.M_60x40x40 : BOX_SPECS.L_80x60x50;
      const boxMaxKg = line.item.fragile ? 22 : 34;

      const canReuseBox =
        activeBox &&
        activeBox.fragile === line.item.fragile &&
        activeBox.currentWeightKg + line.lineWeightKg <= boxMaxKg &&
        activeBox.palletRef.currentWeightKg + line.lineWeightKg <= maxPalletPayloadKg;

      if (!canReuseBox) {
        let targetPallet = workingPallets.find(
          (wp) =>
            wp.boxesCount < maxBoxesPerPallet &&
            wp.currentWeightKg + line.lineWeightKg + boxSpec.tareKg <= maxPalletPayloadKg
        );
        if (!targetPallet) {
          targetPallet = createWorkingPallet(
            line.item.fragile ? 'Fragili & Componenti' : 'Colli & Minuteria'
          );
        }
        const newBox: CargoBox = {
          id: `box-ai-${Date.now()}-${boxSeq}`,
          code: `SCAT-${String(boxSeq).padStart(2, '0')}`,
          label: line.item.fragile
            ? `Scatola Fragile #${boxSeq}`
            : `Collo ${line.item.category || 'Materiale'} #${boxSeq}`,
          boxType: line.item.fragile ? 'M_60x40x40' : 'L_80x60x50',
          dimensionsCm: boxSpec.dimensionsCm,
          tareKg: boxSpec.tareKg,
          maxWeightKg: boxSpec.defaultMaxKg,
          palletId: targetPallet.pallet.id,
          sealed: false,
          fragile: line.item.fragile,
          stackLevel: line.item.fragile ? 3 : targetPallet.boxesCount >= 6 ? 2 : 1,
        };
        boxSeq += 1;
        boxes.push(newBox);
        targetPallet.boxesCount += 1;
        targetPallet.currentWeightKg += boxSpec.tareKg;
        activeBox = {
          box: newBox,
          palletRef: targetPallet,
          currentWeightKg: 0,
          fragile: line.item.fragile,
        };
      }

      activeBox!.currentWeightKg += line.lineWeightKg;
      activeBox!.palletRef.currentWeightKg += line.lineWeightKg;

      checklistItems.push({
        id: `itm-ai-${line.item.id}`,
        sku: line.item.sku || `ART-${checklistItems.length + 1}`,
        name: line.item.name,
        category: line.item.category || 'Materiale Generale',
        quantity: line.item.quantity,
        unitWeightKg: line.item.estimatedUnitWeightKg,
        checked: false,
        fragile: line.item.fragile,
        palletId: activeBox!.palletRef.pallet.id,
        boxId: activeBox!.box.id,
        dimensionsCm: line.item.dimensionsCm || undefined,
        notes: [
          line.item.notes,
          line.shortageQty > 0 ? `Da ordinare: ${line.shortageQty} ${line.item.unit}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      });
    }
  }

  // Calcola altezze realistiche dei bancali
  for (const wp of workingPallets) {
    const estHeight = Math.min(
      195,
      Math.max(70, 30 + wp.boxesCount * 16 + wp.looseItemsCount * 22)
    );
    wp.pallet.heightCm = Math.round(estHeight);
  }

  const netWeightKg = Math.round(lines.reduce((s, l) => s + l.lineWeightKg, 0) * 10) / 10;
  const tareTotalKg =
    pallets.reduce((s, p) => s + p.tareKg, 0) + boxes.reduce((s, b) => s + b.tareKg, 0);
  const grossWeightKg = Math.round((netWeightKg + tareTotalKg) * 10) / 10;

  const recommendedVehicle = chooseOptimalVehicle(pallets.length, grossWeightKg);
  const weightSaturationPct =
    recommendedVehicle.maxWeightKg > 0
      ? Math.min(100, Math.round((grossWeightKg / recommendedVehicle.maxWeightKg) * 100))
      : 0;
  const palletSaturationPct =
    recommendedVehicle.maxPallets > 0
      ? Math.min(100, Math.round((pallets.length / recommendedVehicle.maxPallets) * 100))
      : 0;

  // --- Raggruppamento Riordini Fornitori per Materiali Mancanti ---
  const groupMap = new Map<string, EvaluatedAutopilotLine[]>();
  for (const l of lines) {
    if (l.shortageQty > 0) {
      const key = l.supplierName || 'Fornitore Da Assegnare';
      const arr = groupMap.get(key) || [];
      arr.push(l);
      groupMap.set(key, arr);
    }
  }

  const supplierShortageGroups = Array.from(groupMap.entries()).map(
    ([supplierName, groupLines]) => {
      const normSup = normalizeToken(supplierName);
      const supplierContact =
        contacts.find(
          (c) =>
            (c.kind === 'fornitore' || c.kind === 'entrambi') &&
            normalizeToken(c.companyName) === normSup
        ) || null;
      const estimatedCostEur =
        Math.round(
          groupLines.reduce((s, l) => s + l.shortageQty * l.item.unitCostEur, 0) * 100
        ) / 100;
      const totalMissingUnits = groupLines.reduce((s, l) => s + l.shortageQty, 0);
      return {
        supplierName,
        supplierContact,
        items: groupLines,
        estimatedCostEur,
        totalMissingUnits,
      };
    }
  );

  return {
    lines,
    totalPieces,
    totalMaterialsCostEur,
    materialsSaleSubtotalEur,
    transportEur,
    taxableSubtotalEur,
    vatAmountEur,
    grandTotalEur,
    grossMarginEur,
    effectiveMarginPercent,
    readyLinesCount,
    partialLinesCount,
    missingLinesCount,
    totalShortageUnits,
    netWeightKg,
    grossWeightKg,
    pallets,
    boxes,
    checklistItems,
    recommendedVehicle,
    weightSaturationPct,
    palletSaturationPct,
    supplierShortageGroups,
  };
}

/**
 * Costruisce il CargoLoad pronto per essere lanciato in CaricoStudio + 3D + Piano Camion
 */
export function buildCargoLoadFromAutopilot(
  draft: AutopilotDraft,
  evaluation: AutopilotEvaluation,
  existingLoads: CargoLoad[]
): CargoLoad {
  const code = generateNextCommessaCode(existingLoads, draft.suggestedCommessaCode);
  return {
    id: `load-ai-${Date.now()}`,
    code,
    title: draft.projectTitle.trim() || `Fornitura ${draft.clientName || 'Cliente'}`,
    client: draft.clientName.trim() || 'Cliente Preventivo AI',
    destination: draft.destination.trim() || 'Da confermare',
    carrier: evaluation.recommendedVehicle.name,
    departureDate:
      draft.requestedDeliveryDate ||
      new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    vehicleMaxWeightKg: evaluation.recommendedVehicle.maxWeightKg,
    vehicleMaxPallets: evaluation.recommendedVehicle.maxPallets,
    status: 'in_preparazione',
    pallets: evaluation.pallets,
    boxes: evaluation.boxes,
    items: evaluation.checklistItems,
    signatures: [],
  };
}

/**
 * Genera le bozze di Ordine di Acquisto a Fornitore per i soli materiali mancanti
 */
export function buildPurchaseOrdersFromAutopilot(
  draft: AutopilotDraft,
  evaluation: AutopilotEvaluation,
  existingOrders: PurchaseOrder[],
  createdBy: string,
  commessaCode: string
): PurchaseOrder[] {
  if (evaluation.supplierShortageGroups.length === 0) return [];
  const year = new Date().getFullYear();
  let nextProg =
    existingOrders.reduce(
      (max, o) => (o.year === year && o.progressiveNumber > max ? o.progressiveNumber : max),
      0
    ) + 1;
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  return evaluation.supplierShortageGroups.map((group, idx) => {
    const prog = nextProg + idx;
    const number = `ODA-${year}-${String(prog).padStart(3, '0')}`;
    const leadDays = group.supplierContact?.leadTimeDays || 3;
    const expectedDate = new Date(Date.now() + leadDays * 86400000).toISOString().slice(0, 10);

    const poItems: PurchaseOrderItem[] = group.items.map((line, itemIdx) => ({
      id: `poi-ai-${Date.now()}-${idx}-${itemIdx}`,
      inventoryItemId: line.inventoryMatch?.id,
      sku: line.item.sku,
      name: line.item.name,
      unit: line.item.unit || 'pz',
      currentStockAtOrder: line.availableStock,
      minStockAtOrder: line.inventoryMatch?.minStock ?? 0,
      orderedQty: line.shortageQty,
      receivedQty: 0,
      unitCostEur: line.item.unitCostEur,
      notes: `Fabbisogno commessa ${commessaCode} (${draft.clientName})`,
    }));

    return {
      id: `po-ai-${Date.now()}-${idx}`,
      number,
      progressiveNumber: prog,
      year,
      orderDate: today,
      expectedDeliveryDate: expectedDate,
      status: 'bozza',
      supplierId: group.supplierContact?.id,
      supplierName: group.supplierName,
      supplierEmail: group.supplierContact?.email,
      supplierPhone: group.supplierContact?.phone || group.supplierContact?.mobile,
      supplierVat: group.supplierContact?.vatNumber,
      supplierAddress: group.supplierContact?.billingAddress,
      paymentTerms: group.supplierContact?.paymentTerms || 'Bonifico 30 gg d.f.',
      notes: `Generato automaticamente da Autopilota AI per ${commessaCode} · Preventivo ${draft.quoteNumber}`,
      items: poItems,
      createdBy,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  });
}

/**
 * Calcola il nuovo stato magazzino impegnando/scaricando le quantità disponibili per la commessa
 */
export function buildCommittedInventoryState(
  inventory: WarehouseInventoryState,
  evaluation: AutopilotEvaluation,
  commessaCode: string,
  operatorName: string,
  clientName: string
): { nextInventory: WarehouseInventoryState; movementsAdded: number } {
  const deductionsById = new Map<string, number>();
  for (const line of evaluation.lines) {
    if (line.inventoryMatch && line.committedQty > 0) {
      deductionsById.set(
        line.inventoryMatch.id,
        (deductionsById.get(line.inventoryMatch.id) || 0) + line.committedQty
      );
    }
  }
  if (deductionsById.size === 0) {
    return { nextInventory: inventory, movementsAdded: 0 };
  }

  const nowIso = new Date().toISOString();
  const newMovements: StockMovement[] = [];
  const nextItems = inventory.items.map((item) => {
    const qtyToDeduct = deductionsById.get(item.id) || 0;
    if (qtyToDeduct <= 0) return item;
    const prevQty = Math.max(0, Number(item.quantity) || 0);
    const actualDeduct = Math.min(prevQty, qtyToDeduct);
    const resultingQty = Math.max(0, prevQty - actualDeduct);
    newMovements.push({
      id: `mov-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      itemId: item.id,
      sku: item.sku,
      itemName: item.name,
      unit: item.unit || 'pz',
      type: 'scarico',
      quantity: actualDeduct,
      previousQty: prevQty,
      resultingQty,
      reason: `Impegno Commessa AI (${clientName || commessaCode})`,
      commessaCode,
      operatorName,
      timestamp: nowIso,
    });
    return {
      ...item,
      quantity: resultingQty,
      usageCount: (item.usageCount || 0) + 1,
      updatedAt: nowIso,
    };
  });

  return {
    nextInventory: {
      ...inventory,
      items: nextItems,
      movements: [...newMovements, ...inventory.movements],
    },
    movementsAdded: newMovements.length,
  };
}

export function buildCustomerReplyText(
  draft: AutopilotDraft,
  evaluation: AutopilotEvaluation,
  senderCompany: string
): string {
  const formatEur = (v: number) =>
    `€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const deliveryStr = draft.requestedDeliveryDate
    ? draft.requestedDeliveryDate.split('-').reverse().join('/')
    : 'da concordare';
  const availabilityNote =
    evaluation.totalShortageUnits === 0
      ? 'Tutto il materiale richiesto è disponibile a magazzino per preparazione immediata.'
      : `Disponiamo subito a magazzino della maggior parte del materiale; per ${evaluation.missingLinesCount + evaluation.partialLinesCount} voci in riassortimento stimiamo approvvigionamento rapido in 2-3 giorni lavorativi.`;

  const linesSummary = evaluation.lines
    .slice(0, 8)
    .map(
      (l) =>
        `• ${l.item.quantity} ${l.item.unit} ${l.item.name} (${formatEur(l.lineSaleEur)})`
    )
    .join('\n');
  const extraLines =
    evaluation.lines.length > 8
      ? `\n• ...e altri ${evaluation.lines.length - 8} articoli nel PDF allegato.`
      : '';

  return `Buongiorno ${draft.clientName || 'Gentile Cliente'},\n\nconfermiamo ricezione della Sua richiesta (${draft.quoteNumber}).\n\nRiepilogo fornitura:\n${linesSummary}${extraLines}\n\nImponibile: ${formatEur(evaluation.taxableSubtotalEur)} + IVA ${draft.vatPercent}% (Totale: ${formatEur(evaluation.grandTotalEur)})\nLogistica stimata: ${evaluation.pallets.length} bancali EPAL · ${evaluation.grossWeightKg.toFixed(0)} kg lordi (${evaluation.recommendedVehicle.name})\nConsegna prevista: ${deliveryStr}\n\n${availabilityNote}\n\nRestiamo a disposizione per conferma d'ordine.\nUn cordiale saluto,\n${senderCompany || 'METATRON CaricoStudio'}`;
}
