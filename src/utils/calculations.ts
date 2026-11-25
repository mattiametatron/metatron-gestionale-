import { CargoBox, CargoLoad, CargoPallet, ChecklistItem } from '../types/warehouse';

export interface BoxSummary {
  box: CargoBox;
  items: ChecklistItem[];
  childBoxes: BoxSummary[]; // Scatole contenute dentro questa scatola (Scatolone madre)
  totalPieces: number;
  checkedPieces: number;
  allItemsChecked: boolean;
  directNetWeightKg: number;
  netWeightKg: number;
  grossWeightKg: number;
  isOverweight: boolean;
}

export interface PalletSummary {
  pallet: CargoPallet;
  boxes: BoxSummary[]; // Tutte le scatole sul bancale
  topLevelBoxes: BoxSummary[]; // Scatole principali appoggiate sul bancale (non dentro altre scatole)
  looseItems: ChecklistItem[]; // Materiale fuori scatola assegnato direttamente al bancale
  totalBoxes: number;
  sealedBoxes: number;
  totalItemsCount: number;
  checkedItemsCount: number;
  netWeightKg: number; // items weight
  boxesTareKg: number; // sum of box tares
  calculatedGrossWeightKg: number;
  grossWeightKg: number; // customWeightKg se specificato, altrimenti calcolato
  hasCustomWeight: boolean;
  isOverweight: boolean;
  completionPercent: number;
}

export interface LoadSummary {
  totalItems: number;
  checkedItems: number;
  unassignedItems: ChecklistItem[];
  totalPieces: number;
  checkedPieces: number;
  checklistCompletionPercent: number;
  totalPallets: number;
  wrappedPallets: number;
  totalBoxes: number;
  sealedBoxes: number;
  netMerchandiseWeightKg: number;
  totalTareWeightKg: number;
  totalGrossWeightKg: number;
  isVehicleOverweight: boolean;
  palletSummaries: PalletSummary[];
  unassignedBoxes: BoxSummary[];
}

export function calculateBoxSummary(
  box: CargoBox,
  allItems: ChecklistItem[],
  allBoxes: CargoBox[] = [],
  visitedIds: Set<string> = new Set()
): BoxSummary {
  visitedIds.add(box.id);

  const items = allItems.filter((item) => item.boxId === box.id);
  const directChildBoxes = allBoxes.filter(
    (b) => b.parentBoxId === box.id && !visitedIds.has(b.id)
  );
  const childBoxes = directChildBoxes.map((cb) =>
    calculateBoxSummary(cb, allItems, allBoxes, new Set(visitedIds))
  );

  const directPieces = items.reduce((acc, i) => acc + i.quantity, 0);
  const directCheckedPieces = items.reduce(
    (acc, i) => acc + (i.checked ? i.quantity : 0),
    0
  );

  const childrenPieces = childBoxes.reduce((acc, cb) => acc + cb.totalPieces, 0);
  const childrenCheckedPieces = childBoxes.reduce(
    (acc, cb) => acc + cb.checkedPieces,
    0
  );

  const totalPieces = directPieces + childrenPieces;
  const checkedPieces = directCheckedPieces + childrenCheckedPieces;

  const directNetWeightKg = Number(
    items.reduce((acc, i) => acc + i.quantity * i.unitWeightKg, 0).toFixed(2)
  );
  const childrenNetWeightKg = childBoxes.reduce((acc, cb) => acc + cb.netWeightKg, 0);
  const childrenGrossWeightKg = childBoxes.reduce(
    (acc, cb) => acc + cb.grossWeightKg,
    0
  );

  const netWeightKg = Number((directNetWeightKg + childrenNetWeightKg).toFixed(2));
  const grossWeightKg = Number(
    (directNetWeightKg + box.tareKg + childrenGrossWeightKg).toFixed(2)
  );
  const isOverweight = grossWeightKg > box.maxWeightKg;
  const allItemsChecked =
    (items.length > 0 || childBoxes.length > 0) &&
    items.every((i) => i.checked) &&
    childBoxes.every((cb) => cb.allItemsChecked);

  return {
    box,
    items,
    childBoxes,
    totalPieces,
    checkedPieces,
    allItemsChecked,
    directNetWeightKg,
    netWeightKg,
    grossWeightKg,
    isOverweight,
  };
}

export function calculatePalletSummary(
  pallet: CargoPallet,
  allBoxes: CargoBox[],
  allItems: ChecklistItem[]
): PalletSummary {
  const palletBoxes = allBoxes.filter((b) => b.palletId === pallet.id);
  const boxSummaries = palletBoxes.map((b) =>
    calculateBoxSummary(b, allItems, allBoxes)
  );

  // Top-level boxes on this pallet (either no parentBoxId, or parentBox is not on this pallet)
  const palletBoxIds = new Set(palletBoxes.map((b) => b.id));
  const topLevelBoxes = boxSummaries.filter(
    (bs) => !bs.box.parentBoxId || !palletBoxIds.has(bs.box.parentBoxId)
  );

  // Items assigned directly to this pallet (Materiale Fuori Scatola / Collo Sciolto)
  const looseItems = allItems.filter(
    (item) => item.palletId === pallet.id && !item.boxId
  );

  const itemsInBoxes = palletBoxes.flatMap((b) =>
    allItems.filter((i) => i.boxId === b.id)
  );
  const allPalletItems = [...itemsInBoxes, ...looseItems];

  const totalItemsCount = allPalletItems.length;
  const checkedItemsCount = allPalletItems.filter((i) => i.checked).length;

  const looseNetWeightKg = looseItems.reduce(
    (acc, i) => acc + i.quantity * i.unitWeightKg,
    0
  );
  const boxesDirectNetWeightKg = itemsInBoxes.reduce(
    (acc, i) => acc + i.quantity * i.unitWeightKg,
    0
  );
  const boxesTareKg = Number(
    palletBoxes.reduce((acc, b) => acc + b.tareKg, 0).toFixed(2)
  );

  const netWeightKg = Number((looseNetWeightKg + boxesDirectNetWeightKg).toFixed(2));
  const calculatedGrossWeightKg = Number((netWeightKg + boxesTareKg + pallet.tareKg).toFixed(2));
  const hasCustomWeight =
    typeof pallet.customWeightKg === 'number' &&
    !isNaN(pallet.customWeightKg) &&
    pallet.customWeightKg > 0;
  const grossWeightKg = hasCustomWeight
    ? Number(pallet.customWeightKg!.toFixed(2))
    : calculatedGrossWeightKg;
  const isOverweight = grossWeightKg > pallet.maxWeightKg;

  const completionPercent =
    totalItemsCount === 0
      ? pallet.wrapped
        ? 100
        : 0
      : Math.round((checkedItemsCount / totalItemsCount) * 100);

  return {
    pallet,
    boxes: boxSummaries,
    topLevelBoxes,
    looseItems,
    totalBoxes: boxSummaries.length,
    sealedBoxes: boxSummaries.filter((b) => b.box.sealed).length,
    totalItemsCount,
    checkedItemsCount,
    netWeightKg,
    boxesTareKg,
    calculatedGrossWeightKg,
    grossWeightKg,
    hasCustomWeight,
    isOverweight,
    completionPercent,
  };
}

export function calculateLoadSummary(load: CargoLoad): LoadSummary {
  const palletSummaries = load.pallets.map((p) =>
    calculatePalletSummary(p, load.boxes, load.items)
  );

  const unassignedBoxesRaw = load.boxes.filter((b) => !b.palletId);
  const unassignedBoxes = unassignedBoxesRaw.map((b) =>
    calculateBoxSummary(b, load.items, load.boxes)
  );

  const unassignedItems = load.items.filter((i) => !i.palletId && !i.boxId);

  const totalItems = load.items.length;
  const checkedItems = load.items.filter((i) => i.checked).length;

  const totalPieces = load.items.reduce((acc, i) => acc + i.quantity, 0);
  const checkedPieces = load.items.reduce(
    (acc, i) => acc + (i.checked ? i.quantity : 0),
    0
  );

  const checklistCompletionPercent =
    totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100);

  const netMerchandiseWeightKg = Number(
    load.items
      .reduce((acc, i) => acc + i.quantity * i.unitWeightKg, 0)
      .toFixed(2)
  );

  const totalPalletTareKg = load.pallets.reduce((acc, p) => acc + p.tareKg, 0);
  const totalBoxTareKg = load.boxes.reduce((acc, b) => acc + b.tareKg, 0);
  const totalTareWeightKg = Number((totalPalletTareKg + totalBoxTareKg).toFixed(2));

  // Se ci sono bancali con peso effettivo pesato a bilancia (customWeightKg),
  // il peso lordo totale della commessa riflette la somma dei pesi lordi dei bancali + eventuale merce/scatole non ancora imballate su bancale
  const anyCustomWeight = load.pallets.some(
    (p) => typeof p.customWeightKg === 'number' && p.customWeightKg > 0
  );

  let totalGrossWeightKg = Number(
    (netMerchandiseWeightKg + totalTareWeightKg).toFixed(2)
  );

  if (anyCustomWeight) {
    const palletsTotalGross = palletSummaries.reduce(
      (acc, ps) => acc + ps.grossWeightKg,
      0
    );
    const unassignedItemsWeight = unassignedItems.reduce(
      (acc, i) => acc + i.quantity * i.unitWeightKg,
      0
    );
    const unassignedBoxesGross = unassignedBoxes.reduce(
      (acc, ub) => acc + ub.grossWeightKg,
      0
    );
    totalGrossWeightKg = Number(
      (palletsTotalGross + unassignedItemsWeight + unassignedBoxesGross).toFixed(2)
    );
  }

  return {
    totalItems,
    checkedItems,
    unassignedItems,
    totalPieces,
    checkedPieces,
    checklistCompletionPercent,
    totalPallets: load.pallets.length,
    wrappedPallets: load.pallets.filter((p) => p.wrapped).length,
    totalBoxes: load.boxes.length,
    sealedBoxes: load.boxes.filter((b) => b.sealed).length,
    netMerchandiseWeightKg,
    totalTareWeightKg,
    totalGrossWeightKg,
    isVehicleOverweight: totalGrossWeightKg > load.vehicleMaxWeightKg,
    palletSummaries,
    unassignedBoxes,
  };
}

export function exportLoadToCSV(load: CargoLoad): void {
  const headers = [
    'Codice Commessa',
    'Titolo Progetto / Commessa',
    'Bancale',
    'Tipo Bancale',
    'Scatola / Collo',
    'Dentro Scatolone Madre',
    'Dimensioni (cm)',
    'SKU Articolo',
    'Descrizione Articolo',
    'Kit',
    'Quantita (Pz)',
    'Peso Unitario (kg)',
    'Peso Netto Totale (kg)',
    'Fragile',
    'Stato Check-list',
    'Note',
  ];

  const rows = load.items.map((item) => {
    const pallet = load.pallets.find((p) => p.id === item.palletId);
    const box = load.boxes.find((b) => b.id === item.boxId);
    const parentBox = box?.parentBoxId
      ? load.boxes.find((pb) => pb.id === box.parentBoxId)
      : null;
    const totalNet = (item.quantity * item.unitWeightKg).toFixed(2);
    return [
      load.code,
      load.title,
      pallet ? `${pallet.code} - ${pallet.label}` : 'NON ASSEGNATO',
      pallet ? pallet.dimensionsCm : '-',
      box
        ? `${box.code} - ${box.label}`
        : item.palletId
        ? 'FUORI SCATOLA (Diretto su Bancale)'
        : 'NON ASSEGNATO',
      parentBox ? `${parentBox.code} - ${parentBox.label}` : '-',
      box ? box.dimensionsCm : item.dimensionsCm || '-',
      item.sku,
      item.name,
      item.kitName || '-',
      String(item.quantity),
      item.unitWeightKg.toFixed(2),
      totalNet,
      item.fragile ? 'SI' : 'NO',
      item.checked ? 'VERIFICATO' : 'DA CONTROLLARE',
      item.notes || '',
    ];
  });

  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Distinta_${load.code}_${load.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Compresses an uploaded image file into a lightweight 320x320 DataURL (JPEG)
 * so item photos can be stored cleanly in localStorage and project JSON files.
 */
export function compressImageFileToDataUrl(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore lettura immagine'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Immagine non valida'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Saves a single Commessa/Project (or full archive) directly into a user-chosen PC folder
 * using the File System Access API (showSaveFilePicker) when available, with standard download fallback.
 */
export async function saveCommessaToPCFolder(
  load: CargoLoad,
  allLoads?: CargoLoad[]
): Promise<boolean> {
  const safeTitle = (load.title || 'Commessa')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_');
  const suggestedName = `Commessa_${load.code}_${safeTitle}.carico.json`;
  const payload = JSON.stringify(
    allLoads ? allLoads : [load],
    null,
    2
  );

  const win = window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (data: string) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (typeof win.showSaveFilePicker === 'function') {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'File Progetto Commessa CaricoStudio (.json)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(payload);
      await writable.close();
      return true;
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return false;
      // Fallback to standard download if blocked by iframe permissions
    }
  }

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}

