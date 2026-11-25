import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DdtDocument, PurchaseOrder } from '../types/warehouse';

function formatDateIt(iso?: string): string {
  if (!iso) return '—';
  const clean = iso.trim();
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (match) {
    const [, y, m, d, hh, mm] = match;
    return hh && mm ? `${d}/${m}/${y} ${hh}:${mm}` : `${d}/${m}/${y}`;
  }
  return clean;
}

function formatEur(val: number): string {
  return `€ ${val.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  // Neutralize formula injection in spreadsheet applications
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function downloadCsvFile(filename: string, headers: string[], rows: unknown[][]): void {
  const lines = [
    headers.map(sanitizeCsvCell).join(';'),
    ...rows.map((r) => r.map(sanitizeCsvCell).join(';')),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Genera un Documento di Trasporto (D.D.T.) conforme DPR 472/96 in formato A4
 */
export function generateDdtPdf(ddt: DdtDocument): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Testata superiore
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 12, contentWidth, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('DOCUMENTO DI TRASPORTO (D.D.T.)', margin + 4, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text('D.P.R. 14 agosto 1996, n. 472 · Documento accompagnatorio merci', margin + 4, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`N. ${ddt.number}`, pageWidth - margin - 4, 19.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Data: ${formatDateIt(ddt.issueDate)}`, pageWidth - margin - 4, 26, {
    align: 'right',
  });

  // Riquadri Mittente / Destinatario / Luogo di Destinazione
  let y = 34;
  const boxGap = 4;
  const halfW = (contentWidth - boxGap) / 2;

  // Mittente
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, halfW, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('MITTENTE', margin + 3, y + 5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(ddt.senderCompany || 'METATRON CaricoStudio', margin + 3, y + 10.5, {
    maxWidth: halfW - 6,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const senderLines = [
    ddt.senderAddress || '',
    ddt.senderVat ? `P.IVA / C.F.: ${ddt.senderVat}` : '',
    ddt.commessaCode ? `Rif. Commessa: ${ddt.commessaCode}` : '',
  ].filter(Boolean);
  doc.text(senderLines.join('\n'), margin + 3, y + 15.5, { maxWidth: halfW - 6 });

  // Destinatario
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + halfW + boxGap, y, halfW, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DESTINATARIO / CESSIONARIO', margin + halfW + boxGap + 3, y + 5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(ddt.recipientName || '—', margin + halfW + boxGap + 3, y + 10.5, {
    maxWidth: halfW - 6,
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const recipientLines = [
    ddt.recipientAddress || '',
    ddt.recipientVat ? `P.IVA / C.F.: ${ddt.recipientVat}` : '',
  ].filter(Boolean);
  doc.text(recipientLines.join('\n'), margin + halfW + boxGap + 3, y + 15.5, {
    maxWidth: halfW - 6,
  });

  y += 32;

  // Luogo di destinazione + Dati Trasporto (2 colonne)
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, halfW, 20, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('LUOGO DI DESTINAZIONE MERCE', margin + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    ddt.destinationAddress || ddt.recipientAddress || 'Medesimo indirizzo destinatario',
    margin + 3,
    y + 10.5,
    { maxWidth: halfW - 6 }
  );

  doc.roundedRect(margin + halfW + boxGap, y, halfW, 20, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CAUSALE · PORTO · TRASPORTO A CURA', margin + halfW + boxGap + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Causale: ${ddt.causal}   |   Porto: ${ddt.porto}\nA cura del: ${ddt.transportBy}   |   Inizio trasp.: ${formatDateIt(
      ddt.transportDateTime
    )}`,
    margin + halfW + boxGap + 3,
    y + 10.5,
    { maxWidth: halfW - 6 }
  );

  y += 24;

  // Fascia riepilogo logistico (Colli, Bancali, Peso Lordo, Peso Netto, Aspetto)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');
  const colW = contentWidth / 5;
  const logisticCells = [
    { label: 'N. COLLI', val: String(ddt.packagesCount || 0) },
    { label: 'BANCALI', val: String(ddt.palletsCount || 0) },
    { label: 'PESO LORDO', val: `${(ddt.grossWeightKg || 0).toFixed(1)} kg` },
    { label: 'PESO NETTO', val: `${(ddt.netWeightKg || 0).toFixed(1)} kg` },
    { label: 'ASPETTO ESTERIORE', val: ddt.appearance || 'A vista' },
  ];
  logisticCells.forEach((cell, idx) => {
    const cx = margin + idx * colW;
    if (idx > 0) {
      doc.setDrawColor(226, 232, 240);
      doc.line(cx, y + 2, cx, y + 12);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(cell.label, cx + 2.5, y + 4.8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(cell.val, cx + 2.5, y + 10.5, { maxWidth: colW - 4 });
  });

  y += 18;

  // Tabella righe merce
  const tableBody =
    ddt.items.length > 0
      ? ddt.items.map((item, idx) => [
          String(idx + 1),
          item.sku || '—',
          item.notes ? `${item.description}\n${item.notes}` : item.description,
          item.unit || 'pz',
          String(item.quantity),
          item.unitWeightKg > 0 ? `${(item.quantity * item.unitWeightKg).toFixed(1)} kg` : '—',
        ])
      : [['—', '—', 'Nessun articolo specificato', '—', '0', '—']];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Codice / SKU', 'Descrizione Beni', 'U.M.', 'Quantità', 'Peso Tot.']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      cellPadding: 2.3,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30, font: 'courier', fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 22, halign: 'right' },
    },
  });

  const afterTableY = (doc as any).lastAutoTable?.finalY
    ? Number((doc as any).lastAutoTable.finalY) + 6
    : y + 40;

  let footerY = Math.max(afterTableY, pageHeight - 66);
  if (afterTableY > pageHeight - 66) {
    doc.addPage();
    footerY = 20;
  }

  // Vettore / Targa / Note
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, footerY, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('VETTORE / INCARICATO DEL TRASPORTO & ANNOTAZIONI', margin + 3, footerY + 4.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const carrierSummary = [
    ddt.carrierName ? `Vettore: ${ddt.carrierName}` : '',
    ddt.driverName ? `Conducente: ${ddt.driverName}` : '',
    ddt.vehiclePlate ? `Targa: ${ddt.vehiclePlate}` : '',
    ddt.trackingCode ? `Tracking: ${ddt.trackingCode}` : '',
  ]
    .filter(Boolean)
    .join('   ·   ');
  doc.text(carrierSummary || 'Da compilare al ritiro', margin + 3, footerY + 10, {
    maxWidth: contentWidth - 6,
  });
  if (ddt.notes) {
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Note: ${ddt.notes}`, margin + 3, footerY + 15, {
      maxWidth: contentWidth - 6,
    });
  }

  // Riquadri Firme (Conducente/Vettore & Destinatario)
  const sigY = footerY + 22;
  const sigH = 26;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, sigY, halfW, sigH, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + halfW + boxGap, sigY, halfW, sigH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('FIRMA CONDUCENTE / VETTORE', margin + 3, sigY + 4.8);
  doc.text('FIRMA DESTINATARIO (PER RICEVUTA)', margin + halfW + boxGap + 3, sigY + 4.8);

  if (ddt.driverSignatureDataUrl) {
    try {
      doc.addImage(ddt.driverSignatureDataUrl, 'PNG', margin + 6, sigY + 6.5, 48, 17);
    } catch {
      // ignore invalid image
    }
  }
  if (ddt.recipientSignatureDataUrl) {
    try {
      doc.addImage(
        ddt.recipientSignatureDataUrl,
        'PNG',
        margin + halfW + boxGap + 6,
        sigY + 6.5,
        48,
        17
      );
    } catch {
      // ignore invalid image
    }
  }

  // Footer pagina
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `METATRON CaricoStudio · D.D.T. ${ddt.number} · Generato il ${formatDateIt(
      new Date().toISOString().slice(0, 16)
    )}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc;
}

/**
 * Genera un Ordine di Acquisto a Fornitore (O.D.A.) in formato A4
 */
export function generatePurchaseOrderPdf(
  po: PurchaseOrder,
  buyerCompany: string
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Testata
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, 12, contentWidth, 18, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('ORDINE DI ACQUISTO FORNITORE', margin + 4, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(buyerCompany || 'METATRON CaricoStudio', margin + 4, 26);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`N. ${po.number}`, pageWidth - margin - 4, 19.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Data: ${formatDateIt(po.orderDate)}`, pageWidth - margin - 4, 26, {
    align: 'right',
  });

  let y = 34;
  const boxGap = 4;
  const halfW = (contentWidth - boxGap) / 2;

  // Box Fornitore
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, halfW, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('SPETT.LE FORNITORE', margin + 3, y + 5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(po.supplierName || 'Fornitore', margin + 3, y + 10.5, { maxWidth: halfW - 6 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const supLines = [
    po.supplierAddress || '',
    po.supplierVat ? `P.IVA: ${po.supplierVat}` : '',
    [po.supplierEmail, po.supplierPhone].filter(Boolean).join(' · '),
  ].filter(Boolean);
  doc.text(supLines.join('\n'), margin + 3, y + 15.5, { maxWidth: halfW - 6 });

  // Box Condizioni & Consegna
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin + halfW + boxGap, y, halfW, 28, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DETTAGLI CONSEGNA & PAGAMENTO', margin + halfW + boxGap + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const delivLines = [
    `Consegna richiesta: ${formatDateIt(po.expectedDeliveryDate)}`,
    `Pagamento: ${po.paymentTerms || 'Come da accordi'}`,
    po.deliveryAddress ? `Destinazione: ${po.deliveryAddress}` : '',
    `Richiedente: ${po.createdBy || 'Ufficio Acquisti'}`,
  ].filter(Boolean);
  doc.text(delivLines.join('\n'), margin + halfW + boxGap + 3, y + 10.5, {
    maxWidth: halfW - 6,
  });

  y += 33;

  const totalUnits = po.items.reduce((sum, it) => sum + (Number(it.orderedQty) || 0), 0);
  const totalCost = po.items.reduce(
    (sum, it) => sum + (Number(it.orderedQty) || 0) * (Number(it.unitCostEur) || 0),
    0
  );

  const rows =
    po.items.length > 0
      ? po.items.map((item, idx) => {
          const lineTotal = (Number(item.orderedQty) || 0) * (Number(item.unitCostEur) || 0);
          return [
            String(idx + 1),
            item.sku || '—',
            item.notes ? `${item.name}\n${item.notes}` : item.name,
            item.unit || 'pz',
            String(item.orderedQty),
            item.unitCostEur > 0 ? formatEur(item.unitCostEur) : 'Da quotare',
            lineTotal > 0 ? formatEur(lineTotal) : '—',
          ];
        })
      : [['—', '—', 'Nessun articolo in ordine', '—', '0', '—', '—']];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Codice / SKU', 'Descrizione Articolo', 'U.M.', 'Q.tà', 'Prezzo Unit.', 'Totale']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      cellPadding: 2.3,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 28, font: 'courier', fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 13, halign: 'center' },
      4: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY
    ? Number((doc as any).lastAutoTable.finalY) + 6
    : y + 40;

  // Box Totali
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin + contentWidth - 78, finalY, 78, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Totale quantità ordinata:', margin + contentWidth - 74, finalY + 6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${totalUnits} unità`, margin + contentWidth - 4, finalY + 6.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Imponibile stimato:', margin + contentWidth - 74, finalY + 13.5);
  doc.text(totalCost > 0 ? formatEur(totalCost) : 'Da quotare', margin + contentWidth - 4, finalY + 13.5, {
    align: 'right',
  });

  if (po.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('NOTE ORDINE', margin, finalY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(po.notes, margin, finalY + 9.5, { maxWidth: contentWidth - 84 });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `METATRON CaricoStudio · Ordine Fornitore ${po.number} · Si prega di citare il numero d'ordine nel DDT di consegna.`,
    pageWidth / 2,
    pageHeight - 8,
    { align: 'center' }
  );

  return doc;
}
