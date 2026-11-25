import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  CargoLoad,
  CartelloLayoutFormat,
  ChecklistItem,
  FinishingCartello,
  PackageVerificationProof,
  StockMovement,
  WarehouseStockItem,
} from '../types/warehouse';
import { calculateLoadSummary, PalletSummary } from './calculations';
import {
  buildTrackingQrUrl,
  drawCode39BarcodeOnPdf,
  formatItDateTime,
  generateQrPngDataUrl,
  resolveAllTrackingRecordsForLoad,
  ResolvedTrackingRecord,
} from './qrTrackingUtils';

/**
 * Genera il documento PDF ufficiale della Commessa / Packing List / Check-list
 * con tutti i dettagli, materiali caricati, ubicazione (bancale/scatola/fuori scatola) e firme.
 */
export function generatePackingListPDF(load: CargoLoad): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const summary = calculateLoadSummary(load);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header Aziendale
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, 12, pageWidth - margin * 2, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CARICOSTUDIO', margin + 6, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('DISTINTA UFFICIALE DI SPEDIZIONE & PACKING LIST MATERIALE', margin + 6, 29);

  // Codice commessa in alto a destra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(load.code, pageWidth - margin - 6, 22, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${load.departureDate || new Date().toISOString().slice(0, 10)}`, pageWidth - margin - 6, 29, { align: 'right' });

  // Blocco Metadati Commessa
  let yPos = 42;
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 28, 3, 3, 'FD');

  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(load.title || 'Nuova Commessa Spedizione', margin + 5, yPos + 7);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Cliente: `, margin + 5, yPos + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(load.client || '—', margin + 20, yPos + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Destinazione: `, margin + 5, yPos + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(load.destination || '—', margin + 27, yPos + 21);

  // Colonna destra metadati
  const rightColX = pageWidth / 2 + 10;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Vettore / Mezzo: `, rightColX, yPos + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(load.carrier || '—', rightColX + 26, yPos + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Bancali Totali: `, rightColX, yPos + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${summary.totalPallets} (${summary.totalBoxes} scatole)`, rightColX + 24, yPos + 21);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Peso Lordo Totale: `, rightColX + 68, yPos + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // rose-600
  doc.text(`${summary.totalGrossWeightKg.toFixed(1)} kg`, rightColX + 96, yPos + 21);

  // Mappa per risalire al bancale e scatola dell'articolo
  const palletMap = new Map(load.pallets.map((p) => [p.id, p]));
  const boxMap = new Map(load.boxes.map((b) => [b.id, b]));

  // Prepara righe tabella
  const tableRows = load.items.map((item: ChecklistItem, index: number) => {
    let collocazione = 'Non assegnato';
    if (item.boxId) {
      const box = boxMap.get(item.boxId);
      const pallet = box?.palletId ? palletMap.get(box.palletId) : null;
      collocazione = `${box ? box.code : 'Scatola'} (${pallet ? pallet.code : '—'})`;
    } else if (item.palletId) {
      const pallet = palletMap.get(item.palletId);
      collocazione = `Fuori Scatola su ${pallet ? pallet.code : 'Bancale'}`;
    }

    const totaleRigaKg = (item.quantity * item.unitWeightKg).toFixed(1);
    const spunta = item.checked ? '[X]' : '[ ]';

    return [
      String(index + 1),
      item.sku || '—',
      item.name + (item.fragile ? ' (FRAGILE)' : '') + (item.notes ? `\nNote: ${item.notes}` : ''),
      item.category || 'Generale',
      `${item.quantity} pz`,
      `${item.unitWeightKg} kg`,
      `${totaleRigaKg} kg`,
      collocazione,
      spunta,
    ];
  });

  yPos = 76;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`DETTAGLIO MATERIALE E CHECK-LIST MERCI (${load.items.length} articoli)`, margin, yPos);

  autoTable(doc, {
    startY: yPos + 3,
    head: [
      ['#', 'Cod. Articolo', 'Descrizione / Nome Materiale', 'Cat.', 'Q.tà', 'P. Unit.', 'P. Tot.', 'Collocazione (Scatola / Bancale)', 'Spunta'],
    ],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 50 },
      3: { cellWidth: 16 },
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 14, halign: 'right' },
      6: { cellWidth: 14, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 30 },
      8: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // Riepilogo Bancali
  let finalY = (doc as any).lastAutoTable?.finalY || 160;

  // Se siamo vicini a fondo pagina, aggiungi nuova pagina
  if (finalY > pageHeight - 65) {
    doc.addPage();
    finalY = 20;
  } else {
    finalY += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`RIEPILOGO BANCALI DI SPEDIZIONE (${load.pallets.length} bancali)`, margin, finalY);

  const palletRows = summary.palletSummaries.map((ps) => [
    ps.pallet.code,
    ps.pallet.label || 'Bancale Standard',
    ps.pallet.dimensionsCm || '80×120×140 cm',
    `${ps.totalBoxes} scatole`,
    `${ps.looseItems.length} colli`,
    `${ps.grossWeightKg.toFixed(1)} kg`,
    ps.pallet.notes || 'Pronto per il carico',
  ]);

  autoTable(doc, {
    startY: finalY + 3,
    head: [['Bancale', 'Descrizione / Tipo', 'Dimensioni', 'Scatole', 'Fuori Scatola', 'Peso Lordo', 'Note']],
    body: palletRows.length > 0 ? palletRows : [['—', 'Nessun bancale configurato', '—', '—', '—', '—', '—']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [30, 58, 138], // blue-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    margin: { left: margin, right: margin },
  });

  // Sezione Firme Convalida
  let sigY = (doc as any).lastAutoTable?.finalY || 200;
  if (sigY > pageHeight - 45) {
    doc.addPage();
    sigY = 20;
  } else {
    sigY += 10;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('CONVALIDA E FIRME DI RICEZIONE MERCI', margin, sigY);

  const sigBoxWidth = (pageWidth - margin * 2 - 8) / 3;
  const sigBoxHeight = 22;

  // Box 1: Operatore
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, sigY + 3, sigBoxWidth, sigBoxHeight, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('1. OPERATORE PREPARATORE', margin + 3, sigY + 8);
  const opSig = load.signatures?.find((s) => s.role === 'operatore');
  if (opSig) {
    doc.setTextColor(15, 23, 42);
    doc.text(opSig.signerName, margin + 3, sigY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Firmato: ${new Date(opSig.signedAt).toLocaleDateString()}`, margin + 3, sigY + 19);
  }

  // Box 2: Responsabile
  const box2X = margin + sigBoxWidth + 4;
  doc.rect(box2X, sigY + 3, sigBoxWidth, sigBoxHeight, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('2. RESPONSABILE LOGISTICA', box2X + 3, sigY + 8);
  const respSig = load.signatures?.find((s) => s.role === 'responsabile');
  if (respSig) {
    doc.setTextColor(15, 23, 42);
    doc.text(respSig.signerName, box2X + 3, sigY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Firmato: ${new Date(respSig.signedAt).toLocaleDateString()}`, box2X + 3, sigY + 19);
  }

  // Box 3: Autista / Ricevente
  const box3X = margin + (sigBoxWidth + 4) * 2;
  doc.rect(box3X, sigY + 3, sigBoxWidth, sigBoxHeight, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('3. RICEVUTA CLIENTE / VETTORE', box3X + 3, sigY + 8);
  const autSig = load.signatures?.find((s) => s.role === 'autista');
  if (autSig) {
    doc.setTextColor(15, 23, 42);
    doc.text(autSig.signerName, box3X + 3, sigY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Firmato: ${new Date(autSig.signedAt).toLocaleDateString()}`, box3X + 3, sigY + 19);
  }

  // Footer di pagina su tutte le pagine
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `CaricoStudio &bull; Commessa ${load.code} &bull; Documento Generato il ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      margin,
      pageHeight - 6
    );
    doc.text(`Pagina ${i} di ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  return doc;
}

/**
 * Scarica direttamente il file PDF della commessa sul dispositivo dell'utente
 */
export function downloadPackingListPDF(load: CargoLoad): void {
  const doc = generatePackingListPDF(load);
  const cleanCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Distinta_${cleanCode}_PackingList.pdf`);
}

/**
 * Ottiene il PDF come Blob URL per l'apertura diretta nel browser dello smartphone o PC
 */
export function getPackingListPdfBlobUrl(load: CargoLoad): string {
  const doc = generatePackingListPDF(load);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

/**
 * Converte un colore hex (es. #dc2626) in tupla RGB per jsPDF
 */
function hexToRgbTuple(hex?: string): [number, number, number] {
  if (!hex) return [245, 158, 11];
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return [r, g, b];
  } else if (cleaned.length === 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return [r, g, b];
  }
  return [245, 158, 11];
}

/**
 * Apre/scarica un Blob URL tramite elemento anchor sicuro (senza window.open)
 */
export function openPdfBlobInNewTab(blobUrl: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Genera PDF vettoriale ad alta leggibilità per i Cartelli Verniciatura / RAL / Zincatura
 */
export function generateFinishingCartelliPDF(
  load: CargoLoad,
  tags: FinishingCartello[],
  options: {
    layoutFormat: CartelloLayoutFormat;
    copiesPerTag: number;
    showColorBanner: boolean;
    showSignatures: boolean;
    showItemsList: boolean;
  }
): jsPDF {
  const isLandscape = options.layoutFormat === 'a4_landscape';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const expanded: { tag: FinishingCartello; copyIndex: number; totalCopies: number }[] = [];
  const count = Math.max(1, Math.min(12, options.copiesPerTag || 1));
  tags.forEach((tag) => {
    for (let c = 1; c <= count; c++) {
      expanded.push({ tag, copyIndex: c, totalCopies: count });
    }
  });

  if (expanded.length === 0) {
    doc.setFontSize(14);
    doc.text('Nessun cartello selezionato.', 20, 30);
    return doc;
  }

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  if (options.layoutFormat === 'a5_double') {
    const pairs = expanded.length === 1 ? [expanded[0], expanded[0]] : expanded;
    const cardW = pageW - margin * 2;
    const cardH = (pageH - margin * 2 - 8) / 2;

    pairs.forEach(({ tag }, idx) => {
      if (idx > 0 && idx % 2 === 0) doc.addPage();
      const slot = idx % 2;
      const topY = margin + slot * (cardH + 8);

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(1.2);
      doc.roundedRect(margin, topY, cardW, cardH, 3, 3, 'S');

      // Header bar
      doc.setFillColor(15, 23, 42);
      doc.rect(margin + 4, topY + 4, 86, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(`CARTELLO VERNICIATURA / LAVORAZIONE #${idx + 1}`, margin + 6, topY + 8.8);

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.text(
        `Data: ${tag.deliveryDate || new Date().toLocaleDateString('it-IT')}`,
        margin + cardW - 4,
        topY + 8.8,
        { align: 'right' }
      );

      // Left box: Commessa
      const boxY = topY + 15;
      const boxH = cardH - 34;
      const leftW = cardW * 0.4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.7);
      doc.roundedRect(margin + 4, boxY, leftW, boxH, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('COMMESSA / ORDINE', margin + 8, boxY + 7);
      doc.setFontSize(24);
      doc.setTextColor(15, 23, 42);
      doc.text(String(tag.commessaCode || load.code), margin + 8, boxY + 22, {
        maxWidth: leftW - 8,
      });
      doc.setFontSize(10);
      doc.text(
        String(tag.commessaTitle || load.title || '').toUpperCase(),
        margin + 8,
        boxY + 34,
        { maxWidth: leftW - 8 }
      );

      // Right box: Colore RAL / Lavorazione
      const rightX = margin + 4 + leftW + 4;
      const rightW = cardW - 12 - leftW;
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(1);
      doc.roundedRect(rightX, boxY, rightW, boxH, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('COLORE RAL / ZINCATURA / LAVORAZIONE', rightX + rightW / 2, boxY + 7, {
        align: 'center',
      });

      if (options.showColorBanner && tag.swatchHex) {
        const [r, g, b] = hexToRgbTuple(tag.swatchHex);
        doc.setFillColor(r, g, b);
        doc.setDrawColor(15, 23, 42);
        doc.rect(rightX + 8, boxY + 10, rightW - 16, 7, 'FD');
      }

      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text(
        String(tag.treatmentText || 'DA SPECIFICARE').toUpperCase(),
        rightX + rightW / 2,
        boxY + (options.showColorBanner ? 31 : 26),
        { align: 'center', maxWidth: rightW - 10 }
      );

      if (tag.finishType) {
        doc.setFontSize(9.5);
        doc.text(`Finitura: ${tag.finishType.toUpperCase()}`, rightX + rightW / 2, boxY + boxH - 6, {
          align: 'center',
        });
      }

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Q.tà: ${tag.quantityOrPieces || 'Lotto Commessa'}${tag.supplierName ? `  |  Dest.: ${tag.supplierName}` : ''}`,
        margin + 5,
        topY + cardH - 6,
        { maxWidth: cardW - 10 }
      );
    });
    return doc;
  }

  if (options.layoutFormat === 'a6_quad') {
    const quadList =
      expanded.length < 4
        ? [...expanded, ...Array(4 - expanded.length).fill(expanded[0])]
        : expanded;

    const cardW = (pageW - margin * 2 - 6) / 2;
    const cardH = (pageH - margin * 2 - 6) / 2;

    quadList.forEach(({ tag }, idx) => {
      if (idx > 0 && idx % 4 === 0) doc.addPage();
      const pos = idx % 4;
      const col = pos % 2;
      const row = Math.floor(pos / 2);
      const x = margin + col * (cardW + 6);
      const y = margin + row * (cardH + 6);

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(1.1);
      doc.roundedRect(x, y, cardW, cardH, 3, 3, 'S');

      doc.setFillColor(15, 23, 42);
      doc.rect(x + 4, y + 4, 42, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(`CARTELLINO #${idx + 1}`, x + 6, y + 8.2);

      doc.setTextColor(71, 85, 105);
      doc.text(tag.deliveryDate || new Date().toLocaleDateString('it-IT'), x + cardW - 4, y + 8.2, {
        align: 'right',
      });

      // Commessa box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.6);
      doc.roundedRect(x + 4, y + 14, cardW - 8, 30, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('COMMESSA', x + 7, y + 19);
      doc.setFontSize(20);
      doc.setTextColor(15, 23, 42);
      doc.text(String(tag.commessaCode || load.code), x + 7, y + 30, { maxWidth: cardW - 14 });
      doc.setFontSize(8.5);
      doc.text(String(tag.commessaTitle || load.title || ''), x + 7, y + 39, {
        maxWidth: cardW - 14,
      });

      // Treatment box
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(0.9);
      doc.roundedRect(x + 4, y + 48, cardW - 8, cardH - 64, 2, 2, 'FD');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('COLORE RAL / LAVORAZIONE', x + cardW / 2, y + 54, { align: 'center' });

      if (options.showColorBanner && tag.swatchHex) {
        const [r, g, b] = hexToRgbTuple(tag.swatchHex);
        doc.setFillColor(r, g, b);
        doc.rect(x + 8, y + 57, cardW - 16, 6, 'FD');
      }

      doc.setFontSize(17);
      doc.setTextColor(15, 23, 42);
      doc.text(
        String(tag.treatmentText || 'DA SPECIFICARE').toUpperCase(),
        x + cardW / 2,
        y + (options.showColorBanner ? 77 : 72),
        { align: 'center', maxWidth: cardW - 14 }
      );

      if (tag.finishType) {
        doc.setFontSize(8.5);
        doc.text(tag.finishType.toUpperCase(), x + cardW / 2, y + cardH - 22, { align: 'center' });
      }

      doc.setFontSize(8);
      doc.text(
        `${tag.palletCode || 'Lotto'}   ${tag.quantityOrPieces || ''}`,
        x + 5,
        y + cardH - 6
      );
    });
    return doc;
  }

  // A4 Portrait or A4 Landscape (1 cartello gigante per foglio)
  expanded.forEach(({ tag, copyIndex, totalCopies }, idx) => {
    if (idx > 0) doc.addPage();

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1.4);
    doc.roundedRect(margin, margin, pageW - margin * 2, pageH - margin * 2, 4, 4, 'S');

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(margin + 6, margin + 6, 118, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CARTELLO LAVORAZIONE / VERNICIATURA / RAL', margin + 9, margin + 12);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text(
      `Data: ${tag.deliveryDate || new Date().toLocaleDateString('it-IT')}${totalCopies > 1 ? ` · Copia ${copyIndex}/${totalCopies}` : ''}`,
      pageW - margin - 6,
      margin + 12,
      { align: 'right' }
    );

    doc.setLineWidth(0.8);
    doc.line(margin + 6, margin + 20, pageW - margin - 6, margin + 20);

    if (isLandscape) {
      // Side by side layout
      const leftW = (pageW - margin * 2 - 18) * 0.42;
      const rightW = (pageW - margin * 2 - 18) * 0.58;
      const boxY = margin + 25;
      const boxH = 95;

      // Left: Commessa
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin + 6, boxY, leftW, boxH, 3, 3, 'FD');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('COMMESSA / ORDINE', margin + 11, boxY + 9);
      doc.setFontSize(34);
      doc.setTextColor(15, 23, 42);
      doc.text(String(tag.commessaCode || load.code), margin + 11, boxY + 34, {
        maxWidth: leftW - 12,
      });
      doc.setFontSize(13);
      doc.text(String(tag.commessaTitle || load.title || '').toUpperCase(), margin + 11, boxY + 55, {
        maxWidth: leftW - 12,
      });
      if (tag.clientName || load.client) {
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(`Cliente: ${tag.clientName || load.client}`, margin + 11, boxY + 84, {
          maxWidth: leftW - 12,
        });
      }

      // Right: RAL / Treatment
      const rightX = margin + 12 + leftW;
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(1.2);
      doc.roundedRect(rightX, boxY, rightW, boxH, 3, 3, 'FD');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text('COLORE RAL / ZINCATURA / LAVORAZIONE', rightX + rightW / 2, boxY + 10, {
        align: 'center',
      });

      if (options.showColorBanner && tag.swatchHex) {
        const [r, g, b] = hexToRgbTuple(tag.swatchHex);
        doc.setFillColor(r, g, b);
        doc.rect(rightX + 12, boxY + 15, rightW - 24, 10, 'FD');
      }

      doc.setFontSize(32);
      doc.setTextColor(15, 23, 42);
      doc.text(
        String(tag.treatmentText || 'DA SPECIFICARE').toUpperCase(),
        rightX + rightW / 2,
        boxY + 54,
        { align: 'center', maxWidth: rightW - 16 }
      );

      if (tag.finishType) {
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(rightX + 20, boxY + boxH - 18, rightW - 40, 11, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text(`FINITURA: ${tag.finishType.toUpperCase()}`, rightX + rightW / 2, boxY + boxH - 10.5, {
          align: 'center',
        });
      }

      // Bottom details
      const infoY = boxY + boxH + 8;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.text(
        `Collo: ${tag.palletCode || 'Lotto Commessa'}   |   Quantità: ${tag.quantityOrPieces || '—'}   |   Dest.: ${tag.supplierName || 'Verniciatura / Trattamenti'}`,
        margin + 6,
        infoY + 6
      );
      if (tag.notes) {
        doc.setFontSize(10);
        doc.text(`Note: ${tag.notes}`, margin + 6, infoY + 15, { maxWidth: pageW - margin * 2 - 12 });
      }
    } else {
      // Portrait Giant Layout
      const innerW = pageW - margin * 2 - 12;

      // 1. Commessa Box
      doc.setFillColor(248, 250, 252);
      doc.setLineWidth(1);
      doc.roundedRect(margin + 6, margin + 25, innerW, 56, 3, 3, 'FD');
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      doc.text('COMMESSA / RIFERIMENTO ORDINE', margin + 12, margin + 34);
      if (tag.clientName || load.client) {
        doc.text(`Cliente: ${(tag.clientName || load.client).toUpperCase()}`, pageW - margin - 12, margin + 34, {
          align: 'right',
        });
      }

      doc.setFontSize(40);
      doc.setTextColor(15, 23, 42);
      doc.text(String(tag.commessaCode || load.code), margin + 12, margin + 56, {
        maxWidth: innerW - 12,
      });
      doc.setFontSize(14);
      doc.text(String(tag.commessaTitle || load.title || '').toUpperCase(), margin + 12, margin + 71, {
        maxWidth: innerW - 12,
      });

      // 2. Giant Colore RAL / Zincatura Box
      const treatY = margin + 88;
      const treatH = 92;
      doc.setFillColor(255, 255, 255);
      doc.setLineWidth(1.3);
      doc.roundedRect(margin + 6, treatY, innerW, treatH, 3, 3, 'FD');

      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text('COLORE RAL / LAVORAZIONE / TRATTAMENTO RICHIESTO', pageW / 2, treatY + 11, {
        align: 'center',
      });

      if (options.showColorBanner && tag.swatchHex) {
        const [r, g, b] = hexToRgbTuple(tag.swatchHex);
        doc.setFillColor(r, g, b);
        doc.setLineWidth(0.6);
        doc.rect(margin + 25, treatY + 17, innerW - 38, 11, 'FD');
      }

      doc.setFontSize(36);
      doc.setTextColor(15, 23, 42);
      doc.text(
        String(tag.treatmentText || 'DA SPECIFICARE').toUpperCase(),
        pageW / 2,
        treatY + 55,
        { align: 'center', maxWidth: innerW - 16 }
      );

      if (tag.finishType) {
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(pageW / 2 - 55, treatY + treatH - 18, 110, 11, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.text(`FINITURA: ${tag.finishType.toUpperCase()}`, pageW / 2, treatY + treatH - 10.5, {
          align: 'center',
        });
      }

      // 3. Details grid (3 boxes)
      const detY = treatY + treatH + 7;
      const colW = (innerW - 8) / 3;
      const details = [
        { label: 'COLLO / BANCALE', val: tag.palletCode || 'LOTTO COMMESSA' },
        {
          label: 'QUANTITÀ / COLLI',
          val:
            tag.quantityOrPieces ||
            `${load.pallets.length} Bancali / ${load.items.reduce((a, i) => a + i.quantity, 0)} pz`,
        },
        { label: 'REPARTO / TERZISTA', val: tag.supplierName || 'Reparto Verniciatura' },
      ];
      details.forEach((d, i) => {
        const dx = margin + 6 + i * (colW + 4);
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.7);
        doc.roundedRect(dx, detY, colW, 24, 2, 2, 'FD');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(d.label, dx + 4, detY + 7);
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(String(d.val), dx + 4, detY + 17, { maxWidth: colW - 8 });
      });

      // 4. Notes
      const noteY = detY + 30;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 6, noteY, innerW, 26, 2, 2, 'FD');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text('ISTRUZIONI / NOTE PER LA VERNICIATURA O LAVORAZIONE:', margin + 10, noteY + 7);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(String(tag.notes || '—'), margin + 10, noteY + 17, { maxWidth: innerW - 14 });

      // 5. Signatures
      if (options.showSignatures) {
        const sigY = pageH - margin - 30;
        const sigLabels = [
          '1. Preparazione / Invio Materiale',
          '2. Esecuzione Trattamento / RAL',
          '3. Controllo Qualità al Rientro',
        ];
        sigLabels.forEach((lbl, i) => {
          const sx = margin + 6 + i * (colW + 4);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(148, 163, 184);
          doc.roundedRect(sx, sigY, colW, 22, 2, 2, 'FD');
          doc.setFontSize(7.5);
          doc.setTextColor(51, 65, 85);
          doc.text(lbl.toUpperCase(), sx + 3, sigY + 6);
          doc.line(sx + 4, sigY + 16, sx + colW - 4, sigY + 16);
        });
      }
    }
  });

  return doc;
}

/**
 * Genera PDF A4 per le Schede Collo / Peso Bancali
 */
export function generatePalletSheetsPDF(
  load: CargoLoad,
  palletSummaries: PalletSummary[]
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const innerW = pageW - margin * 2;

  palletSummaries.forEach((ps, idx) => {
    if (idx > 0) doc.addPage();

    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1.2);
    doc.roundedRect(margin, margin, innerW, pageH - margin * 2, 4, 4, 'S');

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('CARICOSTUDIO', margin + 6, margin + 13);
    doc.setFontSize(9);
    doc.text('SCHEDA COLLO BANCALE & PESO UFFICIALE', margin + 6, margin + 19);

    doc.setFontSize(18);
    doc.text(load.code, pageW - margin - 6, margin + 13, { align: 'right' });
    doc.setFontSize(9);
    doc.text(
      `Data: ${load.departureDate || new Date().toLocaleDateString('it-IT')}`,
      pageW - margin - 6,
      margin + 19,
      { align: 'right' }
    );
    doc.line(margin + 6, margin + 24, pageW - margin - 6, margin + 24);

    // Pallet Identity
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 6, margin + 29, innerW - 12, 32, 2, 2, 'FD');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('IDENTIFICATIVO BANCALE', margin + 11, margin + 36);
    doc.setFontSize(26);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${ps.pallet.code}  (Bancale ${idx + 1} di ${palletSummaries.length})`,
      margin + 11,
      margin + 49
    );
    doc.setFontSize(10);
    doc.text(
      `${ps.pallet.label || 'Bancale Standard'} · ${ps.pallet.dimensionsCm} · H ${ps.pallet.heightCm} cm · Tara ${ps.pallet.tareKg} kg`,
      margin + 11,
      margin + 57
    );

    // Giant Weight Box
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(1.5);
    doc.roundedRect(margin + 6, margin + 67, innerW - 12, 54, 3, 3, 'FD');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('PESO LORDO EFFETTIVO BANCALE', pageW / 2, margin + 77, { align: 'center' });
    doc.setFontSize(46);
    doc.text(`${ps.grossWeightKg.toFixed(1)} KG`, pageW / 2, margin + 102, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Tara Legno: ${ps.pallet.tareKg} kg   |   Merce Netta: ${ps.netWeightKg.toFixed(1)} kg   |   ${ps.hasCustomWeight ? 'Rilevato su bilancia' : 'Calcolato da colli'}`,
      pageW / 2,
      margin + 114,
      { align: 'center' }
    );

    // Client / Dest / Carrier
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Cliente: ${load.client || '—'}   |   Destinazione: ${load.destination || '—'}   |   Vettore: ${load.carrier || '—'}`,
      margin + 6,
      margin + 131,
      { maxWidth: innerW - 12 }
    );

    // Content table
    const rows: string[][] = [];
    ps.boxes.forEach((bs) => {
      bs.items.forEach((it) => {
        rows.push([
          bs.box.code,
          it.sku,
          it.name,
          `${it.quantity} pz`,
          `${(it.quantity * it.unitWeightKg).toFixed(1)} kg`,
        ]);
      });
    });
    ps.looseItems.forEach((it) => {
      rows.push([
        'FUORI SCATOLA',
        it.sku,
        it.name,
        `${it.quantity} pz`,
        `${(it.quantity * it.unitWeightKg).toFixed(1)} kg`,
      ]);
    });

    autoTable(doc, {
      startY: margin + 137,
      head: [['Collo / Scatola', 'Cod. Articolo', 'Descrizione Materiale', 'Q.tà', 'Peso Netto']],
      body: rows.length > 0 ? rows : [['—', '—', 'Nessun materiale assegnato', '—', '—']],
      margin: { left: margin + 6, right: margin + 6 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    });
  });

  return doc;
}

/**
 * Genera PDF selettivo per Etichette Scatole, Etichette Bancali o Master Commessa
 */
export function generateSelectiveLabelsPDF(
  load: CargoLoad,
  category: 'master_commessa_big' | 'pallets_only' | 'boxes_only' | 'tree_schema' | 'packing_list' | 'all',
  selectedPalletId: string,
  selectedBoxId: string
): jsPDF {
  if (category === 'packing_list' || category === 'tree_schema' || category === 'all') {
    return generatePackingListPDF(load);
  }

  const summary = calculateLoadSummary(load);
  if (category === 'pallets_only') {
    const filtered =
      selectedPalletId === 'all'
        ? summary.palletSummaries
        : summary.palletSummaries.filter((p) => p.pallet.id === selectedPalletId);
    return generatePalletSheetsPDF(load, filtered.length > 0 ? filtered : summary.palletSummaries);
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const innerW = pageW - margin * 2;

  if (category === 'master_commessa_big') {
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1.5);
    doc.roundedRect(margin, margin, innerW, pageH - margin * 2, 4, 4, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('CARICOSTUDIO · FOGLIO MASTER COMMESSA DI SPEDIZIONE', margin + 8, margin + 15);
    doc.line(margin + 8, margin + 20, pageW - margin - 8, margin + 20);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin + 8, margin + 26, innerW - 16, 60, 3, 3, 'FD');
    doc.setFontSize(46);
    doc.text(load.code, pageW / 2, margin + 54, { align: 'center' });
    doc.setFontSize(18);
    doc.text((load.title || '').toUpperCase(), pageW / 2, margin + 72, {
      align: 'center',
      maxWidth: innerW - 24,
    });

    doc.setFontSize(12);
    doc.text(`Cliente: ${load.client || '—'}`, margin + 10, margin + 100);
    doc.text(`Destinazione: ${load.destination || '—'}`, margin + 10, margin + 110);
    doc.text(`Vettore: ${load.carrier || '—'}`, margin + 10, margin + 120);
    doc.text(
      `Bancali Totali: ${summary.totalPallets}   |   Scatole: ${summary.totalBoxes}   |   Peso Lordo: ${summary.totalGrossWeightKg.toFixed(1)} kg`,
      margin + 10,
      margin + 134
    );
    return doc;
  }

  // boxes_only -> crisp Box Labels (1 or 2 per page cleanly)
  const allBoxes = summary.palletSummaries.flatMap((ps) =>
    ps.boxes.map((bs) => ({ ...bs, pallet: ps.pallet }))
  );
  const filteredBoxes = allBoxes.filter((b) => {
    if (selectedBoxId === 'all') {
      if (selectedPalletId === 'all') return true;
      return b.pallet.id === selectedPalletId;
    }
    return b.box.id === selectedBoxId;
  });

  if (filteredBoxes.length === 0) {
    doc.setFontSize(14);
    doc.text('Nessuna scatola presente da stampare.', 20, 30);
    return doc;
  }

  filteredBoxes.forEach((b, idx) => {
    if (idx > 0) doc.addPage();
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(1.4);
    doc.roundedRect(margin, margin, innerW, pageH - margin * 2, 4, 4, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`ETICHETTA COLLO SCATOLA · COMMESSA ${load.code}`, margin + 8, margin + 14);

    doc.setFontSize(40);
    doc.setTextColor(15, 23, 42);
    doc.text(b.box.code, margin + 8, margin + 32);

    doc.setFontSize(16);
    doc.text(b.box.label || 'Scatola Spedizione', margin + 8, margin + 43);

    doc.setFontSize(12);
    doc.text(
      `Bancale: ${b.pallet.code}   |   Misure: ${b.box.dimensionsCm}   |   Peso Lordo: ${b.grossWeightKg.toFixed(1)} kg`,
      margin + 8,
      margin + 55
    );
    doc.text(
      `Destinatario: ${load.client || '—'} — ${load.destination || '—'}`,
      margin + 8,
      margin + 64
    );

    autoTable(doc, {
      startY: margin + 72,
      head: [['Codice', 'Descrizione Articolo Contenuto', 'Q.tà', 'Peso']],
      body:
        b.items.length > 0
          ? b.items.map((it) => [
              it.sku,
              it.name,
              `${it.quantity} pz`,
              `${(it.quantity * it.unitWeightKg).toFixed(1)} kg`,
            ])
          : [['—', 'Scatola vuota', '—', '—']],
      margin: { left: margin + 8, right: margin + 8 },
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    });
  });

  return doc;
}

/**
 * Genera PDF ufficiale A4 per Giacenze Magazzino o Registro Movimenti Carico / Scarico
 */
export function generateInventoryReportPDF(
  items: WarehouseStockItem[],
  movements: StockMovement[],
  mode: 'giacenze' | 'movimenti'
): jsPDF {
  const doc = new jsPDF({
    orientation: mode === 'movimenti' ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 10, pageW - margin * 2, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(
    mode === 'giacenze'
      ? 'CARICOSTUDIO · INVENTARIO GIACENZE MAGAZZINO'
      : 'CARICOSTUDIO · REGISTRO CARICO & SCARICO MATERIALE',
    margin + 5,
    19
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Generato il ${new Date().toLocaleDateString('it-IT')} alle ${new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`,
    pageW - margin - 5,
    19,
    { align: 'right' }
  );

  doc.setFontSize(8.5);
  doc.text(
    mode === 'giacenze'
      ? `Articoli in anagrafica: ${items.length} · Sotto scorta: ${items.filter((i) => i.quantity <= i.minStock).length}`
      : `Movimenti registrati: ${movements.length} · Carichi: ${movements.filter((m) => m.type === 'carico').length} · Scarichi: ${movements.filter((m) => m.type === 'scarico').length}`,
    margin + 5,
    26
  );

  if (mode === 'giacenze') {
    autoTable(doc, {
      startY: 36,
      head: [['Codice SKU', 'Descrizione Materiale', 'Categoria', 'Ubicazione', 'Giacenza', 'Scorta Min.', 'Stato']],
      body:
        items.length > 0
          ? items.map((it) => {
              const status =
                it.quantity <= 0
                  ? 'ESAURITO'
                  : it.quantity <= it.minStock
                  ? 'SOTTO SCORTA'
                  : 'OK';
              return [
                it.sku,
                it.name,
                it.category,
                it.location || '—',
                `${it.quantity} ${it.unit}`,
                `${it.minStock} ${it.unit}`,
                status,
              ];
            })
          : [['—', 'Nessun materiale in anagrafica', '—', '—', '—', '—', '—']],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right' },
      },
    });
  } else {
    autoTable(doc, {
      startY: 36,
      head: [
        [
          'Data / Ora',
          'Tipo',
          'Codice',
          'Materiale',
          'Variazione',
          'Giacenza',
          'Causale',
          'Commessa',
          'Rif. DDT',
          'Operatore',
        ],
      ],
      body:
        movements.length > 0
          ? movements.map((mv) => [
              new Date(mv.timestamp).toLocaleString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }),
              mv.type === 'carico' ? 'CARICO (+)' : 'SCARICO (-)',
              mv.sku,
              mv.itemName,
              `${mv.type === 'carico' ? '+' : '-'}${mv.quantity} ${mv.unit}`,
              `${mv.previousQty} -> ${mv.resultingQty}`,
              mv.reason || '—',
              mv.commessaCode || '—',
              mv.documentRef || '—',
              mv.operatorName || '—',
            ])
          : [['—', '—', '—', 'Nessun movimento registrato', '—', '—', '—', '—', '—', '—']],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right' },
      },
    });
  }

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`CaricoStudio Magazzino · Pagina ${i} di ${totalPages}`, pageW - margin, pageH - 6, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Genera il Dossier PDF Ufficiale Anti-Contestazione 101% Multi-Scatola:
 * prove incrociate di Verifica Pezzi, Peso Bilancia vs Teorico, Sigillo Antimanomissione,
 * Registro Video Continui SHA-256, Scarico Magazzino, Verbale Chiusura Bancali & Consegna Corriere
 * (con Firma Autista) e Allegato Fotografico Multi-Strato Timbrato a 2 colonne.
 */
export function generatePackingProofDossierPDF(
  load: CargoLoad,
  proofs: PackageVerificationProof[],
  linkedMovements: StockMovement[]
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 13;
  const innerW = pageW - margin * 2;
  const handover = load.handoverProof;

  // Raccoglie tutti i video continui allegati ai colli
  const allVideos: {
    proof: PackageVerificationProof;
    video: NonNullable<PackageVerificationProof['videos']>[number];
  }[] = [];
  proofs.forEach((p) => {
    (p.videos || []).forEach((v) => {
      allVideos.push({ proof: p, video: v });
    });
  });

  const totalCertifiedScaleWeight = proofs.reduce(
    (acc, p) => acc + (p.measuredWeightKg ?? 0),
    0
  );
  const totalTheoreticalWeight = proofs.reduce(
    (acc, p) => acc + p.theoreticalWeightKg,
    0
  );

  // 1. Intestazione Ufficiale Dossier
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 11, innerW, 25, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, 36, innerW, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.text('CERTIFICATO DI IMBALLO & PROVA DI SPEDIZIONE 101%', margin + 5, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(203, 213, 225);
  doc.text(
    'Dossier Multi-Collo: Conta Pezzi · Bilancia · Video SHA-256 · Foto a Strati · Scarico Magazzino · Consegna Corriere',
    margin + 5,
    27
  );
  doc.text(
    `Commessa: ${load.code}  ·  Emesso il: ${new Date().toLocaleString('it-IT')}`,
    margin + 5,
    33
  );

  // 2. Metadati Spedizione
  let y = 43;
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, innerW, 26, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${load.code} — ${load.title || 'Spedizione Materiale'}`, margin + 4, y + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  doc.setTextColor(51, 65, 85);
  doc.text(`Cliente: ${load.client || '—'}`, margin + 4, y + 13);
  doc.text(`Destinazione: ${load.destination || '—'}`, margin + 4, y + 19);
  doc.text(
    `Peso Somma Bilancia Colli: ${totalCertifiedScaleWeight.toFixed(2)} kg (Teorico: ${totalTheoreticalWeight.toFixed(2)} kg)`,
    margin + 4,
    y + 24
  );

  const rightX = margin + innerW * 0.54;
  doc.text(`Vettore: ${handover?.carrierName || load.carrier || '—'}`, rightX, y + 13);
  doc.text(
    `Colli Certificati: ${proofs.length}  ·  Video SHA-256: ${allVideos.length}  ·  Scarichi: ${linkedMovements.length}`,
    rightX,
    y + 19
  );
  doc.text(
    handover
      ? `DDT: ${handover.ddtNumber || '—'} · Autista: ${handover.driverName || '—'} (${handover.truckPlate || '—'})`
      : 'Verbale Ritiro Corriere: non ancora compilato',
    rightX,
    y + 24
  );

  // 3. Tabella Riepilogo Prove Incrociate per Collo
  y = 76;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('1. RIEPILOGO PROVE INCROCIATE PER SCATOLA / COLLO (PESI, SIGILLI, MEDIA)', margin, y);

  const summaryRows =
    proofs.length > 0
      ? proofs.map((p, idx) => {
          const totalExpected = p.items.reduce((a, i) => a + i.expectedQty, 0);
          const totalCounted = p.items.reduce((a, i) => a + i.countedQty, 0);
          const measuredStr =
            p.measuredWeightKg !== null
              ? `${p.measuredWeightKg.toFixed(2)} kg`
              : 'N/D';
          const deltaStr =
            p.measuredWeightKg !== null
              ? `${p.measuredWeightKg - p.theoreticalWeightKg >= 0 ? '+' : ''}${(
                  p.measuredWeightKg - p.theoreticalWeightKg
                ).toFixed(2)} kg`
              : '—';
          const weightVerdict =
            p.weightStatus === 'conforme'
              ? 'CONFORME'
              : p.weightStatus === 'scarto'
              ? 'SCARTO'
              : 'NON PESATO';
          const videoCount = p.videos?.length || 0;
          return [
            `${idx + 1}/${proofs.length} ${p.targetCode}${p.palletCode ? `\n(${p.palletCode})` : ''}`,
            p.sealNumber || '—',
            `${totalCounted}/${totalExpected} pz`,
            `${p.theoreticalWeightKg.toFixed(2)} kg`,
            `${measuredStr}\n(${deltaStr})`,
            weightVerdict,
            `${p.photos.length} foto\n${videoCount} video`,
            p.stockUnloaded ? 'SCARICATO' : 'IN ATTESA',
            p.sha256Hash.slice(0, 12),
          ];
        })
      : [['—', '—', '—', '—', '—', '—', '—', '—', 'Nessun collo certificato']];

  autoTable(doc, {
    startY: y + 3,
    head: [
      [
        'Collo',
        'N° Sigillo',
        'Pezzi',
        'P. Teorico',
        'P. Bilancia (Δ)',
        'Esito',
        'Prove Media',
        'Magazzino',
        'SHA-256',
      ],
    ],
    body: summaryRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.2, cellPadding: 1.8, textColor: [15, 23, 42] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
  });

  // 4. Dettaglio Analitico Articoli Certificati & Scarichi Magazzino
  let nextY = ((doc as any).lastAutoTable?.finalY || 130) + 8;
  if (nextY > pageH - 55) {
    doc.addPage();
    nextY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(15, 23, 42);
  doc.text('2. DISTINTA ANALITICA PEZZI VERIFICATI & CONFERMA CONTABILE SCARICO', margin, nextY);

  const itemDetailRows: string[][] = [];
  proofs.forEach((p) => {
    p.items.forEach((it) => {
      const mov = linkedMovements.find(
        (m) =>
          m.sku.toUpperCase() === it.sku.toUpperCase() &&
          m.packageCode === p.targetCode
      );
      itemDetailRows.push([
        p.targetCode,
        it.sku,
        it.name,
        `${it.countedQty}/${it.expectedQty} pz`,
        `${(it.countedQty * it.unitWeightKg).toFixed(2)} kg`,
        p.operatorName + (p.checkerName ? ` / ${p.checkerName}` : ''),
        mov
          ? `SCARICO -${mov.quantity} (${mov.previousQty}->${mov.resultingQty})`
          : p.stockUnloaded
          ? 'SCARICATO'
          : '—',
        new Date(it.verifiedAt || p.certifiedAt).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      ]);
    });
  });

  autoTable(doc, {
    startY: nextY + 3,
    head: [
      [
        'Collo',
        'Codice SKU',
        'Descrizione Materiale',
        'Verificati',
        'Peso Netto',
        'Op. / Controllore',
        'Movimento Magazzino',
        'Ora',
      ],
    ],
    body:
      itemDetailRows.length > 0
        ? itemDetailRows
        : [['—', '—', 'Nessun articolo certificato', '—', '—', '—', '—', '—']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.2, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
  });

  // 5. Registro Video Continui di Imballaggio (Impronta Binaria SHA-256)
  let sectionNum = 3;
  let cursorY = ((doc as any).lastAutoTable?.finalY || 160) + 8;

  if (allVideos.length > 0) {
    if (cursorY > pageH - 52) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${sectionNum}. REGISTRO VIDEO CONTINUI DI IMBALLAGGIO (IMPRONTA CRIPTOGRAFICA SHA-256)`,
      margin,
      cursorY
    );
    sectionNum++;

    const videoRows = allVideos.map(({ proof, video }) => {
      const sizeMb = (video.sizeBytes / (1024 * 1024)).toFixed(2);
      const mins = Math.floor(video.durationSec / 60);
      const secs = Math.round(video.durationSec % 60);
      const durStr = video.durationSec > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : 'File';
      return [
        proof.targetCode,
        video.fileName,
        `${durStr}\n(${sizeMb} MB)`,
        new Date(video.capturedAt).toLocaleString('it-IT'),
        video.sha256Hash,
      ];
    });

    autoTable(doc, {
      startY: cursorY + 3,
      head: [['Collo', 'File Video Continuo', 'Durata / Dim.', 'Data/Ora Registrazione', 'Impronta Binaria SHA-256 Integrità']],
      body: videoRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 6.9, cellPadding: 1.8, font: 'courier' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', font: 'helvetica' },
      columnStyles: {
        4: { cellWidth: 62 },
      },
    });

    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY + 28) + 8;
  }

  // 6. Verbale Chiusura Bancali & Consegna al Corriere (con Firma Autista)
  if (handover) {
    if (cursorY > pageH - 72) {
      doc.addPage();
      cursorY = 18;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${sectionNum}. VERBALE CHIUSURA BANCALI & CONSEGNA AL CORRIERE`,
      margin,
      cursorY
    );
    sectionNum++;

    const boxY = cursorY + 3;
    const boxH = 52;
    doc.setDrawColor(15, 23, 42);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, boxY, innerW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Corriere / Vettore: ${handover.carrierName || '—'}`, margin + 4, boxY + 7);
    doc.text(`Autista Ritiro: ${handover.driverName || '—'}`, margin + 4, boxY + 13);
    doc.text(`Targa Mezzo: ${handover.truckPlate || '—'}`, margin + 4, boxY + 19);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`N° DDT / Bolla: ${handover.ddtNumber || '—'}`, margin + 4, boxY + 25.5);
    doc.text(
      `Colli Consegnati: ${handover.totalBoxesDelivered} scatole · ${handover.totalPalletsDelivered} bancali`,
      margin + 4,
      boxY + 31.5
    );
    const ddtW =
      handover.ddtDeclaredWeightKg !== null
        ? `${handover.ddtDeclaredWeightKg.toFixed(2)} kg`
        : 'N/D';
    doc.text(
      `Peso DDT: ${ddtW}  ·  Somma Bilancia: ${totalCertifiedScaleWeight.toFixed(2)} kg`,
      margin + 4,
      boxY + 37.5
    );
    doc.text(
      `Consegnato il: ${new Date(handover.handoverAt).toLocaleString('it-IT')}  ·  SHA-256: ${handover.sha256Hash.slice(0, 16)}`,
      margin + 4,
      boxY + 43.5
    );
    if (handover.notes) {
      doc.text(`Note: ${handover.notes}`, margin + 4, boxY + 49, {
        maxWidth: innerW * 0.56,
      });
    }

    // Riquadro Firma Digitale Autista
    const sigBoxX = margin + innerW * 0.62;
    const sigBoxY = boxY + 5;
    const sigBoxW = innerW * 0.35;
    const sigBoxH = 38;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(148, 163, 184);
    doc.roundedRect(sigBoxX, sigBoxY, sigBoxW, sigBoxH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text('FIRMA AUTISTA PER RITIRO INTEGRO', sigBoxX + 3, sigBoxY + 5);

    if (handover.driverSignatureDataUrl) {
      try {
        doc.addImage(
          handover.driverSignatureDataUrl,
          'PNG',
          sigBoxX + 2,
          sigBoxY + 7,
          sigBoxW - 4,
          sigBoxH - 12,
          undefined,
          'FAST'
        );
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.text('[Firma digitale acquisita]', sigBoxX + 4, sigBoxY + 22);
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(148, 163, 184);
      doc.text('Spazio firma autista', sigBoxX + 4, sigBoxY + 22);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Ritiro confermato: ${handover.driverName || 'Autista'}`,
      sigBoxX + 3,
      sigBoxY + sigBoxH - 2
    );

    cursorY = boxY + boxH + 8;
  }

  // 7. Dichiarazione & Firme di Convalida
  if (cursorY > pageH - 48) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, cursorY, innerW, 38, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${sectionNum}. DICHIARAZIONE DI INTEGRITÀ E TRACCIABILITÀ CARICO/SCARICO`,
    margin + 4,
    cursorY + 6.5
  );
  sectionNum++;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    'Si attesta che ogni scatola e bancale sopra elencati sono stati verificati pezzo per pezzo prima della chiusura, pesati su bilancia con riscontro matematico rispetto al peso teorico, scaricati contestualmente dal registro Carico/Scarico, sigillati con codice identificativo univoco e documentati tramite fotografie multi-strato con timbro data/ora indelebile e/o ripresa video continua con impronta crittografica SHA-256.',
    margin + 4,
    cursorY + 12.5,
    { maxWidth: innerW - 8 }
  );

  const firstProof = proofs[0];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Operatore Imballo: ${firstProof?.operatorName || '________________'}`,
    margin + 4,
    cursorY + 32
  );
  doc.text(
    `2° Controllore / Responsabile: ${firstProof?.checkerName || '________________'}`,
    margin + innerW * 0.52,
    cursorY + 32
  );

  // 8. Allegato Fotografico Certificato a 2 Colonne (4 scatti per pagina — ideale per tante scatole!)
  interface FlatPhotoEntry {
    title: string;
    subtitle: string;
    dataUrl: string;
  }

  const allPhotos: FlatPhotoEntry[] = [];
  proofs.forEach((p) => {
    p.photos.forEach((ph) => {
      allPhotos.push({
        title: `Collo ${p.targetCode} · ${ph.stageLabel}`,
        subtitle: `Sigillo: ${p.sealNumber || '—'} · Peso: ${
          p.measuredWeightKg !== null ? `${p.measuredWeightKg.toFixed(2)} kg` : 'N/D'
        } · SHA: ${p.sha256Hash.slice(0, 10)}`,
        dataUrl: ph.dataUrl,
      });
    });
  });

  if (handover?.photos?.length) {
    handover.photos.forEach((ph) => {
      allPhotos.push({
        title: `Consegna Corriere · ${ph.stageLabel}`,
        subtitle: `DDT: ${handover.ddtNumber || '—'} · Targa: ${handover.truckPlate || '—'} · SHA: ${handover.sha256Hash.slice(0, 10)}`,
        dataUrl: ph.dataUrl,
      });
    });
  }

  if (allPhotos.length > 0) {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `${sectionNum}. ALLEGATO FOTOGRAFICO CERTIFICATO MULTI-STRATO & CONSEGNA`,
      margin,
      17
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Commessa ${load.code} · Totale fotografie timbrate sui pixel: ${allPhotos.length} (layout compatto 2×2 per pagina)`,
      margin,
      22.5
    );

    const gapX = 5;
    const gapY = 8;
    const colW = (innerW - gapX) / 2;
    const photoH = 68;
    const cellTotalH = photoH + 13;
    let gridY = 28;

    allPhotos.forEach((entry, index) => {
      const col = index % 2;
      if (col === 0 && index > 0) {
        gridY += cellTotalH + gapY;
        if (gridY + cellTotalH > pageH - 12) {
          doc.addPage();
          gridY = 18;
        }
      }

      const x = margin + col * (colW + gapX);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(entry.title.slice(0, 52), x, gridY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(entry.subtitle.slice(0, 62), x, gridY + 3.8);

      try {
        doc.addImage(
          entry.dataUrl,
          'JPEG',
          x,
          gridY + 5.5,
          colW,
          photoH,
          undefined,
          'FAST'
        );
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.35);
        doc.rect(x, gridY + 5.5, colW, photoH, 'S');
      } catch {
        doc.setFont('helvetica', 'normal');
        doc.text('[Immagine non incorporabile]', x + 3, gridY + 18);
      }
    });
  }

  // Footer su tutte le pagine
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Dossier Prova Imballo 101% · Commessa ${load.code} · Documento generato automaticamente da CaricoStudio & Magazzino`,
      margin,
      pageH - 6
    );
    doc.text(`Pagina ${i} di ${totalPages}`, pageW - margin, pageH - 6, {
      align: 'right',
    });
  }

  return doc;
}

/**
 * Genera l'Etichetta Sigillo Anti-Contestazione PDF da stampare e applicare esternamente su ogni scatola.
 * Mostra numero scatola X di N, PESO CERTIFICATO BILANCIA gigante, N° Sigillo, SHA-256,
 * avviso Video Continuo e clausola di accettazione con riserva.
 */
export function generateBoxAntiDisputeSealLabelPDF(
  load: CargoLoad,
  proof: PackageVerificationProof,
  boxIndex: number,
  totalBoxes: number
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 13;
  const innerW = pageW - margin * 2;

  // Riquadro esterno tagliabile (Etichetta Principale da incollare sulla scatola)
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1.2);
  doc.rect(margin, 12, innerW, 146, 'S');

  // Header nero ad alto contrasto
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 12, innerW, 24, 'F');
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, 36, innerW, 2.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('COLLO VERIFICATO, PESATO & SIGILLATO 101%', margin + 5, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `COMMESSA: ${load.code}  ·  CLIENTE: ${load.client || '—'}  ·  DEST: ${load.destination || '—'}`,
    margin + 5,
    30
  );

  // Riga 1: SCATOLA X DI N + CODICE COLLO + PESO CERTIFICATO BILANCIA GIGANTE
  const row1Y = 42;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin + 5, row1Y, innerW * 0.48 - 3, 36, 'FD');

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('IDENTIFICATIVO SCATOLA / COLLO', margin + 9, row1Y + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(22);
  doc.text(`SCATOLA ${boxIndex} DI ${totalBoxes}`, margin + 9, row1Y + 19);

  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(
    `${proof.targetCode}${proof.palletCode ? `  ·  BANCALE ${proof.palletCode}` : ''}`,
    margin + 9,
    row1Y + 29
  );

  // Box Peso Bilancia Gigante
  const weightBoxX = margin + innerW * 0.5 + 2;
  const weightBoxW = innerW * 0.5 - 7;
  doc.setFillColor(15, 23, 42);
  doc.rect(weightBoxX, row1Y, weightBoxW, 36, 'F');

  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PESO CERTIFICATO SU BILANCIA', weightBoxX + 4, row1Y + 7);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(25);
  const weightText =
    proof.measuredWeightKg !== null
      ? `${proof.measuredWeightKg.toFixed(2)} KG`
      : `${proof.theoreticalWeightKg.toFixed(2)} KG*`;
  doc.text(weightText, weightBoxX + 4, row1Y + 21);

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Teorico: ${proof.theoreticalWeightKg.toFixed(2)} kg · Esito: ${proof.weightStatus.toUpperCase()}`,
    weightBoxX + 4,
    row1Y + 30
  );

  // Riga 2: SIGILLO + PROVE ACQUISITE + IMPRONTA SHA-256
  const row2Y = 82;
  doc.setDrawColor(148, 163, 184);
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 5, row2Y, innerW - 10, 32, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(`N° SIGILLO ANTIMANOMISSIONE: ${proof.sealNumber}`, margin + 9, row2Y + 8);

  const totalPcs = proof.items.reduce((a, i) => a + i.countedQty, 0);
  const videoCount = proof.videos?.length || 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text(
    `PEZZI VERIFICATI: ${totalPcs} PZ  ·  FOTO TIMBRATE: ${proof.photos.length}  ·  ${
      videoCount > 0 ? `VIDEO CONTINUO REGISTRATO (${videoCount})` : 'DOSSIER FOTOGRAFICO 101%'
    }`,
    margin + 9,
    row2Y + 16
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `CERTIFICATO SHA-256: ${proof.sha256Hash.slice(0, 36)}`,
    margin + 9,
    row2Y + 23
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(
    `Data/Ora Chiusura: ${new Date(proof.certifiedAt).toLocaleString('it-IT')}  ·  Operatore: ${proof.operatorName}${
      proof.checkerName ? `  ·  2° Controllore: ${proof.checkerName}` : ''
    }`,
    margin + 9,
    row2Y + 29
  );

  // Fascia Avviso Legale Deterrente Contestazioni Infondate
  const warnY = 118;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.7);
  doc.rect(margin + 5, warnY, innerW - 10, 35, 'FD');

  doc.setTextColor(185, 28, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    'ATTENZIONE DESTINATARIO — COLLO DOCUMENTATO CON PROVA DI IMBALLO 101%',
    margin + 9,
    warnY + 7.5
  );

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Il contenuto di questa scatola è stato contato pezzo per pezzo, verificato su bilancia di precisione, scaricato dal registro magazzino e documentato con foto multi-strato timbrate e/o video continuo con impronta crittografica SHA-256 prima della spedizione. Alla consegna verificare integrità del sigillo e corrispondenza del peso indicato sopra. Eventuali contestazioni per ammanchi saranno esaminate solo previa RISERVA SPECIFICA scritta e firmata sul documento del corriere al momento dello scarico.',
    margin + 9,
    warnY + 13.5,
    { maxWidth: innerW - 18 }
  );

  // Parte inferiore del foglio A4: Distinta Sintetica del Contenuto di questa Scatola
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `DISTINTA CONTENUTO CERTIFICATO — ${proof.targetCode} (${proof.targetLabel})`,
    margin,
    168
  );

  autoTable(doc, {
    startY: 171,
    head: [['Codice SKU', 'Descrizione Articolo', 'Q.tà Verificata', 'Peso Netto']],
    body: proof.items.map((it) => [
      it.sku,
      it.name,
      `${it.countedQty} / ${it.expectedQty} pz`,
      `${(it.countedQty * it.unitWeightKg).toFixed(2)} kg`,
    ]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
  });

  return doc;
}

export interface TrackingLabelsA4Options {
  includePallets: boolean;
  includeBoxes: boolean;
  includeItems: boolean;
  palletFilterId?: string | 'all';
  baseUrl?: string;
}

function truncateTextLines(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const split = doc.splitTextToSize(text || '—', maxWidth) as string[];
  if (split.length <= maxLines) return split;
  const trimmed = split.slice(0, maxLines);
  const last = trimmed[maxLines - 1];
  trimmed[maxLines - 1] =
    last.length > 3 ? `${last.slice(0, last.length - 3)}...` : `${last}...`;
  return trimmed;
}

/**
 * Genera un singolo file PDF A4 con TUTTE le etichette ritagliabili (8 per foglio A4, 2x4)
 * per ogni Bancale, ogni Scatola e ogni Oggetto inserito nella commessa,
 * complete di QR Code scansionabile, Codice a Barre Code-39, posizione esatta,
 * quantità, Data/Ora CARICO (preparazione) e Data/Ora SCARICO (spedizione).
 */
export async function generateAllTrackingLabelsA4PDF(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options: TrackingLabelsA4Options = {
    includePallets: true,
    includeBoxes: true,
    includeItems: true,
    palletFilterId: 'all',
  }
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const allRecords = resolveAllTrackingRecordsForLoad(load, movements);
  const palletCodeFilter =
    options.palletFilterId && options.palletFilterId !== 'all'
      ? load.pallets.find((p) => p.id === options.palletFilterId)?.code || null
      : null;

  const filteredRecords: ResolvedTrackingRecord[] = allRecords.filter((rec) => {
    if (rec.type === 'pallet' && !options.includePallets) return false;
    if (rec.type === 'box' && !options.includeBoxes) return false;
    if (rec.type === 'item' && !options.includeItems) return false;
    if (palletCodeFilter) {
      if (rec.palletCode !== palletCodeFilter) return false;
    }
    return true;
  });

  const pageWidth = 210;
  const marginX = 8;
  const gutterX = 4;
  const cols = 2;
  const rows = 4;
  const perPage = cols * rows; // 8 etichette per foglio A4
  const labelW = (pageWidth - marginX * 2 - gutterX) / cols; // 95mm
  const startY = 14;
  const gutterY = 3.5;
  const labelH = 66; // 14 + 4*66 + 3*3.5 = 288.5mm

  if (filteredRecords.length === 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Nessuna etichetta selezionata per la commessa ${load.code}`,
      pageWidth / 2,
      140,
      { align: 'center' }
    );
    return doc;
  }

  // Pre-genera tutti i QR Code PNG ad alta nitidezza
  const qrImages = await Promise.all(
    filteredRecords.map((rec) =>
      generateQrPngDataUrl(buildTrackingQrUrl(rec, options.baseUrl), 240)
    )
  );

  const totalPages = Math.ceil(filteredRecords.length / perPage);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage();

    // Fascia testata foglio A4
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `CARICOSTUDIO · ETICHETTE QR & BARCODE A4 · COMMESSA ${load.code} (${load.title || 'Spedizione'})`,
      marginX,
      9.5
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Foglio ${pageIdx + 1} di ${totalPages} · Totale etichette: ${filteredRecords.length}`,
      pageWidth - marginX,
      9.5,
      { align: 'right' }
    );

    // Linee tratteggiate leggere di taglio
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([1.5, 1.5], 0);
    // Taglio verticale centrale
    doc.line(
      marginX + labelW + gutterX / 2,
      startY - 1.5,
      marginX + labelW + gutterX / 2,
      startY + rows * labelH + (rows - 1) * gutterY + 1.5
    );
    // Tagli orizzontali
    for (let r = 1; r < rows; r++) {
      const cutY = startY + r * labelH + (r - 1) * gutterY + gutterY / 2;
      doc.line(marginX - 2, cutY, pageWidth - marginX + 2, cutY);
    }
    doc.setLineDashPattern([], 0);

    const startIdx = pageIdx * perPage;
    const endIdx = Math.min(startIdx + perPage, filteredRecords.length);

    for (let i = startIdx; i < endIdx; i++) {
      const slot = i - startIdx;
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const x = marginX + col * (labelW + gutterX);
      const y = startY + row * (labelH + gutterY);

      const rec = filteredRecords[i];
      const qrDataUrl = qrImages[i];

      // Cornice Etichetta
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.45);
      doc.roundedRect(x, y, labelW, labelH, 1.8, 1.8, 'FD');

      // Intestazione colorata per tipo
      const headerRgb: [number, number, number] =
        rec.type === 'pallet'
          ? [15, 23, 42] // Slate 900
          : rec.type === 'box'
          ? [29, 78, 216] // Blue 700
          : [4, 120, 87]; // Emerald 700

      const typeLabel =
        rec.type === 'pallet'
          ? 'BANCALE'
          : rec.type === 'box'
          ? 'SCATOLA'
          : 'OGGETTO';

      doc.setFillColor(headerRgb[0], headerRgb[1], headerRgb[2]);
      doc.rect(x, y, labelW, 8.5, 'F');

      // Badge Tipo + Codice Principale
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text(typeLabel, x + 2.5, y + 5.7);

      doc.setFont('courier', 'bold');
      doc.setFontSize(10.5);
      doc.text(rec.code, x + 21, y + 5.9);

      // Codice Commessa a destra nell'intestazione
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(226, 232, 240);
      doc.text(rec.commessaCode, x + labelW - 2.5, y + 5.7, { align: 'right' });

      // Area Sinistra (Dettagli, Posizione, Quantità, Date Carico/Scarico)
      const qrSize = 27;
      const qrX = x + labelW - qrSize - 2.5;
      const qrY = y + 10.2;
      const leftW = labelW - qrSize - 6.5;

      // Nome / Descrizione
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      const nameLines = truncateTextLines(doc, rec.name, leftW, 2);
      doc.text(nameLines, x + 2.5, y + 13.2);

      // Box POSIZIONE / DOVE SI TROVA
      const locY = y + 20.5;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.roundedRect(x + 2.5, locY, leftW, 9.2, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(71, 85, 105);
      doc.text('POSIZIONE / DOVE SI TROVA', x + 4, locY + 3.2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(15, 23, 42);
      const locLine = truncateTextLines(doc, rec.locationPath, leftW - 3, 1)[0];
      doc.text(locLine, x + 4, locY + 7.4);

      // QUANTITÀ & PESO
      const qtyY = y + 34.2;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      doc.text('QUANTITA:', x + 2.5, qtyY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(rec.quantityText, x + 16.5, qtyY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`${rec.weightKg.toFixed(1)} kg`, x + leftW + 2, qtyY, {
        align: 'right',
      });

      // DATA E ORA CARICO (Preparazione Spedizione) & SCARICO (Spedito)
      const datesY = y + 36.8;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(x + 2.5, datesY, x + 2.5 + leftW, datesY);

      // Riga Carico
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(3, 105, 161); // sky-700
      doc.text('CARICO (Prep.):', x + 2.5, datesY + 4.1);
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(15, 23, 42);
      doc.text(
        rec.loadedAt ? formatItDateTime(rec.loadedAt) : 'Da preparare',
        x + 23.5,
        datesY + 4.1
      );

      // Riga Scarico
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(4, 120, 87); // emerald-700
      doc.text('SCARICO (Sped.):', x + 2.5, datesY + 8.3);
      doc.setFont('courier', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(rec.shippedAt ? 4 : 100, rec.shippedAt ? 120 : 116, rec.shippedAt ? 87 : 139);
      doc.text(
        rec.shippedAt ? formatItDateTime(rec.shippedAt) : 'Non spedito',
        x + 23.5,
        datesY + 8.3
      );

      // QR Code a destra
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      doc.rect(qrX - 0.5, qrY - 0.5, qrSize + 1, qrSize + 1, 'S');
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(71, 85, 105);
      doc.text('SCANSIONA QR', qrX + qrSize / 2, qrY + qrSize + 3.2, {
        align: 'center',
      });

      // Fascia Inferiore: Codice a Barre Code-39 reale + Testo Monospace
      const bcTopY = y + 48.8;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.line(x + 2.5, bcTopY, x + labelW - 2.5, bcTopY);

      drawCode39BarcodeOnPdf(
        doc,
        rec.barcodeValue,
        x + 4,
        bcTopY + 1.6,
        labelW - 8,
        10.2
      );

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(`*${rec.barcodeValue}*`, x + labelW / 2, y + labelH - 1.8, {
        align: 'center',
      });
    }
  }

  return doc;
}

export async function openTrackingLabelsA4PdfInNewTab(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options?: TrackingLabelsA4Options
): Promise<void> {
  const doc = await generateAllTrackingLabelsA4PDF(load, movements, options);
  const blobUrl = URL.createObjectURL(doc.output('blob'));
  openPdfBlobInNewTab(blobUrl);
}

export async function downloadTrackingLabelsA4Pdf(
  load: CargoLoad,
  movements: StockMovement[] = [],
  options?: TrackingLabelsA4Options
): Promise<void> {
  const doc = await generateAllTrackingLabelsA4PDF(load, movements, options);
  const safeCode = (load.code || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Etichette_A4_QR_${safeCode}.pdf`);
}





