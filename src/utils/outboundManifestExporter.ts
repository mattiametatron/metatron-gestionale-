import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyPrintLanguageToJsPdf, getPrintLanguage } from './printLanguage';
import { CargoLoad, StockMovement } from '../types/warehouse';
import {
  buildBarcodeValue,
  formatItDateTime,
  resolveAllTrackingRecordsForLoad,
  ResolvedTrackingRecord,
} from './qrTrackingUtils';
import { openPdfBlobInNewTab } from './pdfGenerator';

export interface OutboundPackageRow {
  type: 'BANCALE' | 'SCATOLA';
  entityId: string;
  code: string;
  barcodeValue: string;
  name: string;
  locationPath: string;
  palletCode: string;
  boxesCount: number;
  itemsCount: number;
  piecesCount: number;
  weightKg: number;
  loadedAt: string | null;
  shippedAt: string | null;
}

export interface OutboundItemRow {
  itemId: string;
  commessaCode: string;
  palletCode: string;
  palletLabel: string;
  boxCode: string;
  boxLabel: string;
  boxPath: string;
  packageBarcode: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
  fragile: boolean;
  notes: string;
  loadedAt: string | null;
  shippedAt: string | null;
}

export interface OutboundManifestData {
  load: CargoLoad;
  onlyShipped: boolean;
  generatedAt: string;
  packages: OutboundPackageRow[];
  items: OutboundItemRow[];
  totals: {
    palletsCount: number;
    boxesCount: number;
    itemLinesCount: number;
    totalPieces: number;
    totalWeightKg: number;
  };
}

/**
 * Costruisce i dati completi della Distinta Merce in Uscita espandendo
 * ogni Bancale, ogni Scatola (incluse sotto-scatole) e ogni singolo articolo
 * con la relativa Data e Ora esatta di scarico/uscita.
 */
export function buildOutboundManifestData(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options: { onlyShipped?: boolean; filterRecord?: ResolvedTrackingRecord | null } = {}
): OutboundManifestData {
  const onlyShipped = options.onlyShipped ?? true;
  const allRecords = resolveAllTrackingRecordsForLoad(load, movements);

  const palletRecords = allRecords.filter((r) => r.type === 'pallet');
  const boxRecords = allRecords.filter((r) => r.type === 'box');
  const itemRecords = allRecords.filter((r) => r.type === 'item');

  const palletMap = new Map(load.pallets.map((p) => [p.id, p]));
  const boxMap = new Map(load.boxes.map((b) => [b.id, b]));
  const itemById = new Map(load.items.map((it) => [it.id, it]));

  let allowedItemIds: Set<string> | null = null;
  let allowedPalletCodes: Set<string> | null = null;
  let allowedBoxCodes: Set<string> | null = null;

  if (options.filterRecord) {
    const fr = options.filterRecord;
    allowedItemIds = new Set((fr.detailedItems || []).map((d) => d.itemId));
    if (fr.type === 'item') {
      allowedItemIds.add(fr.entityId);
    }
    if (fr.type === 'pallet') {
      allowedPalletCodes = new Set([fr.code]);
      allowedBoxCodes = new Set(
        boxRecords.filter((b) => b.palletCode === fr.code).map((b) => b.code)
      );
    } else if (fr.type === 'box') {
      allowedPalletCodes = fr.palletCode ? new Set([fr.palletCode]) : new Set();
      allowedBoxCodes = new Set([fr.code]);
      (fr.detailedItems || []).forEach((d) => {
        if (d.boxCode) allowedBoxCodes!.add(d.boxCode);
      });
    } else {
      allowedPalletCodes = fr.palletCode ? new Set([fr.palletCode]) : new Set();
      allowedBoxCodes = fr.boxCode ? new Set([fr.boxCode]) : new Set();
    }
  }

  const packages: OutboundPackageRow[] = [];

  palletRecords.forEach((pr) => {
    if (allowedPalletCodes && !allowedPalletCodes.has(pr.code)) return;
    if (onlyShipped && !pr.shippedAt) {
      const hasAnyShippedChild = (pr.detailedItems || []).some((d) => Boolean(d.shippedAt));
      if (!hasAnyShippedChild) return;
    }
    const detailed = pr.detailedItems || [];
    const effectiveItems = onlyShipped
      ? detailed.filter((d) => Boolean(d.shippedAt || pr.shippedAt))
      : detailed;
    const distinctBoxCodes = new Set(
      effectiveItems.map((d) => d.boxCode).filter(Boolean)
    );
    packages.push({
      type: 'BANCALE',
      entityId: pr.entityId,
      code: pr.code,
      barcodeValue: pr.barcodeValue,
      name: pr.name,
      locationPath: pr.locationPath,
      palletCode: pr.code,
      boxesCount: distinctBoxCodes.size,
      itemsCount: effectiveItems.length,
      piecesCount: effectiveItems.reduce((acc, d) => acc + d.quantity, 0),
      weightKg: pr.weightKg,
      loadedAt: pr.loadedAt,
      shippedAt: pr.shippedAt,
    });
  });

  boxRecords.forEach((br) => {
    if (allowedBoxCodes && !allowedBoxCodes.has(br.code)) return;
    if (onlyShipped && !br.shippedAt) {
      const hasAnyShippedChild = (br.detailedItems || []).some((d) => Boolean(d.shippedAt));
      if (!hasAnyShippedChild) return;
    }
    const detailed = br.detailedItems || [];
    const effectiveItems = onlyShipped
      ? detailed.filter((d) => Boolean(d.shippedAt || br.shippedAt))
      : detailed;
    packages.push({
      type: 'SCATOLA',
      entityId: br.entityId,
      code: br.code,
      barcodeValue: br.barcodeValue,
      name: br.name,
      locationPath: br.locationPath,
      palletCode: br.palletCode || 'A TERRA',
      boxesCount: 0,
      itemsCount: effectiveItems.length,
      piecesCount: effectiveItems.reduce((acc, d) => acc + d.quantity, 0),
      weightKg: br.weightKg,
      loadedAt: br.loadedAt,
      shippedAt: br.shippedAt,
    });
  });

  const items: OutboundItemRow[] = [];
  itemRecords.forEach((ir) => {
    if (allowedItemIds && !allowedItemIds.has(ir.entityId)) return;
    if (onlyShipped && !ir.shippedAt) return;

    const rawItem = itemById.get(ir.entityId);
    const box = rawItem?.boxId ? boxMap.get(rawItem.boxId) || null : null;
    const palletId = box?.palletId || rawItem?.palletId || null;
    const pallet = palletId ? palletMap.get(palletId) || null : null;

    const boxChain: string[] = [];
    if (box) {
      let cur = box;
      let guard = 0;
      while (cur && guard < 8) {
        boxChain.unshift(cur.code);
        cur = cur.parentBoxId ? boxMap.get(cur.parentBoxId)! : undefined!;
        guard += 1;
      }
    }

    const pkgCode = box?.code || pallet?.code || ir.code;
    const unitW = Number(rawItem?.unitWeightKg) || 0;
    const qty = Number(ir.quantityNumber) || 0;

    items.push({
      itemId: ir.entityId,
      commessaCode: load.code,
      palletCode: pallet?.code || 'FUORI BANCALE',
      palletLabel: pallet?.label || '',
      boxCode: box?.code || 'FUORI SCATOLA',
      boxLabel: box?.label || '',
      boxPath: boxChain.length > 0 ? boxChain.join(' > ') : 'Fuori scatola',
      packageBarcode: buildBarcodeValue(load.code, pkgCode),
      sku: ir.code,
      name: ir.name,
      category: rawItem?.category || 'Generale',
      quantity: qty,
      unitWeightKg: unitW,
      totalWeightKg: Math.round(qty * unitW * 100) / 100,
      fragile: Boolean(rawItem?.fragile || box?.fragile),
      notes: rawItem?.notes || '',
      loadedAt: ir.loadedAt,
      shippedAt: ir.shippedAt,
    });
  });

  items.sort((a, b) => {
    const tA = a.shippedAt || '';
    const tB = b.shippedAt || '';
    if (tA !== tB) return tB.localeCompare(tA);
    if (a.palletCode !== b.palletCode) return a.palletCode.localeCompare(b.palletCode);
    if (a.boxCode !== b.boxCode) return a.boxCode.localeCompare(b.boxCode);
    return a.sku.localeCompare(b.sku);
  });

  const palletsOut = packages.filter((p) => p.type === 'BANCALE');
  const boxesOut = packages.filter((p) => p.type === 'SCATOLA');

  const totalWeightKg =
    palletsOut.length > 0
      ? Math.round(palletsOut.reduce((acc, p) => acc + p.weightKg, 0) * 100) / 100
      : Math.round(items.reduce((acc, it) => acc + it.totalWeightKg, 0) * 100) / 100;

  return {
    load,
    onlyShipped,
    generatedAt: new Date().toISOString(),
    packages,
    items,
    totals: {
      palletsCount: palletsOut.length,
      boxesCount: boxesOut.length,
      itemLinesCount: items.length,
      totalPieces: items.reduce((acc, it) => acc + it.quantity, 0),
      totalWeightKg,
    },
  };
}

/**
 * Esporta una Distinta Merce in Uscita reale in formato Microsoft Excel (.xlsx)
 * con 2 fogli formattati: "Riepilogo Colli Uscita" e "Dettaglio Contenuto".
 */
export function downloadOutboundManifestExcel(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options: {
    onlyShipped?: boolean;
    operatorName?: string;
    filterRecord?: ResolvedTrackingRecord | null;
  } = {}
): void {
  const data = buildOutboundManifestData(load, movements, options);
  const wb = XLSX.utils.book_new();

  // Foglio 1: Riepilogo Colli in Uscita (Bancali & Scatole)
  const summaryRows: Array<Array<string | number>> = [
    ['DISTINTA MERCE IN USCITA — RIEPILOGO COLLI (BANCALI E SCATOLE)'],
    ['Commessa', load.code, 'Titolo', load.title || '—'],
    ['Cliente', load.client || '—', 'Destinazione', load.destination || '—'],
    [
      'Vettore',
      load.carrier || '—',
      'Generata il',
      formatItDateTime(data.generatedAt, true),
    ],
    [
      'Operatore',
      options.operatorName || 'Operatore Magazzino',
      'Ambito',
      options.filterRecord
        ? `Singolo collo: ${options.filterRecord.code}`
        : data.onlyShipped
        ? 'Solo merce scaricata in uscita'
        : 'Tutta la commessa',
    ],
    [],
    [
      'Tipo Collo',
      'Codice Collo',
      'Barcode',
      'Descrizione',
      'Bancale',
      'Scatole Interne',
      'Righe Articoli',
      'Pezzi Totali',
      'Peso Lordo (kg)',
      'Data/Ora Carico',
      'Data/Ora Uscita (Scarico)',
    ],
    ...data.packages.map((pkg) => [
      pkg.type,
      pkg.code,
      pkg.barcodeValue,
      pkg.name,
      pkg.palletCode,
      pkg.boxesCount,
      pkg.itemsCount,
      pkg.piecesCount,
      pkg.weightKg,
      formatItDateTime(pkg.loadedAt, true),
      formatItDateTime(pkg.shippedAt, true),
    ]),
    [],
    [
      'TOTALI',
      `${data.totals.palletsCount} bancali · ${data.totals.boxesCount} scatole`,
      '',
      '',
      '',
      data.totals.boxesCount,
      data.totals.itemLinesCount,
      data.totals.totalPieces,
      data.totals.totalWeightKg,
      '',
      '',
    ],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 24 },
    { wch: 34 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Riepilogo Colli Uscita');

  // Foglio 2: Dettaglio Completo Contenuto (Ogni articolo dentro bancale e scatola)
  const detailRows: Array<Array<string | number>> = [
    [
      'Data/Ora Uscita (Scarico)',
      'Data/Ora Carico',
      'Commessa',
      'Bancale',
      'Scatola / Percorso',
      'Etichetta Scatola',
      'Barcode Collo',
      'SKU / Codice',
      'Descrizione Articolo',
      'Categoria',
      'Quantità (pz)',
      'Peso Unit. (kg)',
      'Peso Tot. (kg)',
      'Fragile',
      'Note',
    ],
    ...data.items.map((it) => [
      formatItDateTime(it.shippedAt, true),
      formatItDateTime(it.loadedAt, true),
      it.commessaCode,
      it.palletCode,
      it.boxPath,
      it.boxLabel || '—',
      it.packageBarcode,
      it.sku,
      it.name,
      it.category,
      it.quantity,
      it.unitWeightKg,
      it.totalWeightKg,
      it.fragile ? 'SI' : 'NO',
      it.notes,
    ]),
    [],
    [
      'TOTALE MERCE IN USCITA',
      '',
      load.code,
      `${data.totals.palletsCount} bancali`,
      `${data.totals.boxesCount} scatole`,
      '',
      '',
      `${data.totals.itemLinesCount} righe`,
      '',
      '',
      data.totals.totalPieces,
      '',
      Math.round(data.items.reduce((acc, i) => acc + i.totalWeightKg, 0) * 100) / 100,
      '',
      '',
    ],
  ];

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 22 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 36 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Dettaglio Contenuto');

  const safeCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
  const suffix = options.filterRecord
    ? `_${options.filterRecord.code.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : '';
  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Distinta_Uscita_${safeCode}${suffix}_${dateTag}.xlsx`);
}

/**
 * Genera la Distinta Merce in Uscita formattata A4 PDF (con riepilogo colli,
 * dettaglio di tutto il contenuto di bancali e scatole, data/ora esatta e riquadri firma).
 */
export function generateOutboundManifestPdf(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options: {
    onlyShipped?: boolean;
    operatorName?: string;
    filterRecord?: ResolvedTrackingRecord | null;
  } = {}
): jsPDF {
  const data = buildOutboundManifestData(load, movements, options);
  const doc = applyPrintLanguageToJsPdf(
    new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }),
    getPrintLanguage()
  );
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Fascia testata industriale
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DISTINTA MERCE IN USCITA', margin, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const scopeLabel = options.filterRecord
    ? `Collo: ${options.filterRecord.code} — ${options.filterRecord.name}`
    : data.onlyShipped
    ? 'Merce scaricata tramite Barcode / QR con tracciabilità data e ora'
    : 'Elenco completo commessa (tutti i bancali, scatole e articoli)';
  doc.text(scopeLabel.slice(0, 95), margin, 17.5);
  doc.text(
    `Generata il ${formatItDateTime(data.generatedAt, true)} · Operatore: ${
      options.operatorName || 'Magazzino'
    }`,
    margin,
    22.5
  );

  // Badge commessa a destra
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.text(load.code || 'COMMESSA', pageWidth - margin, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text((load.client || 'Cliente').slice(0, 38), pageWidth - margin, 18, {
    align: 'right',
  });
  doc.text((load.destination || '—').slice(0, 38), pageWidth - margin, 22.5, {
    align: 'right',
  });

  // 4 KPI Boxes
  const kpiY = 31;
  const kpiGap = 3;
  const kpiW = (pageWidth - margin * 2 - kpiGap * 3) / 4;
  const kpis = [
    { label: 'BANCALI IN USCITA', val: String(data.totals.palletsCount) },
    { label: 'SCATOLE IN USCITA', val: String(data.totals.boxesCount) },
    {
      label: 'PEZZI TOTALI',
      val: `${data.totals.totalPieces} pz (${data.totals.itemLinesCount} righe)`,
    },
    { label: 'PESO LORDO STIMATO', val: `${data.totals.totalWeightKg.toFixed(1)} kg` },
  ];

  kpis.forEach((k, idx) => {
    const kx = margin + idx * (kpiW + kpiGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(kx, kpiY, kpiW, 14, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(k.label, kx + 2.5, kpiY + 4.5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(k.val, kx + 2.5, kpiY + 11);
  });

  let nextY = kpiY + 19;

  // Tabella 1: Riepilogo Colli (Bancali & Scatole)
  if (data.packages.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('1. RIEPILOGO COLLI (BANCALI E SCATOLE)', margin, nextY);

    autoTable(doc, {
      startY: nextY + 2.5,
      head: [
        [
          'Tipo',
          'Codice',
          'Barcode',
          'Descrizione',
          'Pezzi',
          'Peso',
          'Data / Ora Uscita',
        ],
      ],
      body: data.packages.map((p) => [
        p.type,
        p.code,
        p.barcodeValue,
        p.name.slice(0, 38),
        `${p.piecesCount} pz`,
        `${p.weightKg.toFixed(1)} kg`,
        formatItDateTime(p.shippedAt, true),
      ]),
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold' },
        1: { cellWidth: 19, font: 'courier', fontStyle: 'bold' },
        2: { cellWidth: 32, font: 'courier' },
        3: { cellWidth: 50 },
        4: { cellWidth: 16, halign: 'right' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 33, font: 'courier', fontStyle: 'bold' },
      },
      margin: { left: margin, right: margin },
    });

    nextY = ((doc as any).lastAutoTable?.finalY || nextY + 20) + 7;
  }

  // Tabella 2: Dettaglio completo di tutti gli articoli dentro bancali e scatole
  if (nextY > pageHeight - 45) {
    doc.addPage();
    nextY = 16;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DETTAGLIO COMPLETO ARTICOLI IN USCITA', margin, nextY);

  autoTable(doc, {
    startY: nextY + 2.5,
    head: [
      [
        'Data/Ora Uscita',
        'Bancale',
        'Scatola',
        'SKU',
        'Descrizione Articolo',
        'Q.tà',
        'Peso',
      ],
    ],
    body:
      data.items.length > 0
        ? data.items.map((it) => [
            formatItDateTime(it.shippedAt, true),
            it.palletCode,
            it.boxPath,
            it.sku,
            it.name.slice(0, 48),
            `${it.quantity} pz`,
            `${it.totalWeightKg.toFixed(1)} kg`,
          ])
        : [['—', '—', '—', '—', 'Nessun articolo presente in distinta', '0 pz', '0.0 kg']],
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: {
      fillColor: [15, 118, 110],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 29, font: 'courier', fontStyle: 'bold' },
      1: { cellWidth: 20, font: 'courier', fontStyle: 'bold' },
      2: { cellWidth: 22, font: 'courier' },
      3: { cellWidth: 24, font: 'courier', fontStyle: 'bold' },
      4: { cellWidth: 61 },
      5: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 16, halign: 'right' },
    },
    margin: { left: margin, right: margin },
  });

  // Riquadri firme a fondo documento
  let sigY = ((doc as any).lastAutoTable?.finalY || nextY + 30) + 10;
  if (sigY > pageHeight - 34) {
    doc.addPage();
    sigY = 20;
  }

  const sigW = (pageWidth - margin * 2 - 8) / 3;
  const sigLabels = [
    'Firma Operatore Magazzino',
    'Firma Autista / Vettore',
    'Data e Ora Consegna',
  ];
  sigLabels.forEach((lbl, idx) => {
    const sx = margin + idx * (sigW + 4);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(sx, sigY, sigW, 20, 1.5, 1.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(lbl, sx + 3, sigY + 4.5);
    doc.setDrawColor(148, 163, 184);
    doc.line(sx + 4, sigY + 16, sx + sigW - 4, sigY + 16);
  });

  // Numeri di pagina
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Distinta Merce in Uscita · Commessa ${load.code} · Pagina ${p} di ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}

export function downloadOutboundManifestPdf(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options: {
    onlyShipped?: boolean;
    operatorName?: string;
    filterRecord?: ResolvedTrackingRecord | null;
  } = {}
): void {
  const doc = generateOutboundManifestPdf(load, movements, options);
  const safeCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
  const suffix = options.filterRecord
    ? `_${options.filterRecord.code.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : '';
  const dateTag = new Date().toISOString().slice(0, 10);
  doc.save(`Distinta_Uscita_${safeCode}${suffix}_${dateTag}.pdf`);
}

export function openOutboundManifestPdfInNewTab(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options: {
    onlyShipped?: boolean;
    operatorName?: string;
    filterRecord?: ResolvedTrackingRecord | null;
  } = {}
): void {
  const doc = generateOutboundManifestPdf(load, movements, options);
  const blobUrl = URL.createObjectURL(doc.output('blob'));
  openPdfBlobInNewTab(blobUrl);
}
