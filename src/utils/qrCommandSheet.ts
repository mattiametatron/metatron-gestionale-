import jsPDF from 'jspdf';
import QRCode from 'qrcode';

export type QrCommandGroup = 'azione' | 'conferma' | 'quantita';

export type ParsedQrCommand =
  | { kind: 'mode'; mode: 'carico' | 'scarico'; label: string }
  | { kind: 'confirm'; label: string }
  | { kind: 'cancel'; label: string }
  | { kind: 'set_qty'; qty: number; label: string }
  | { kind: 'add_qty'; delta: number; label: string };

export interface QrCommandDefinition {
  code: string; // Solo A-Z e 0-9: immune a layout tastiera IT/US di qualsiasi pistola USB
  title: string;
  subtitle: string;
  group: QrCommandGroup;
  tone: 'emerald' | 'rose' | 'amber' | 'slate';
  command: ParsedQrCommand;
}

export const METATRON_QR_COMMANDS: QrCommandDefinition[] = [
  {
    code: 'MTCARICO',
    title: 'CARICO (+)',
    subtitle: 'Imposta entrata in magazzino',
    group: 'azione',
    tone: 'emerald',
    command: { kind: 'mode', mode: 'carico', label: 'Modalità CARICO (+)' },
  },
  {
    code: 'MTSCARICO',
    title: 'SCARICO (−)',
    subtitle: 'Imposta uscita / prelievo',
    group: 'azione',
    tone: 'rose',
    command: { kind: 'mode', mode: 'scarico', label: 'Modalità SCARICO (−)' },
  },
  {
    code: 'MTCONFERMA',
    title: 'CONFERMA',
    subtitle: 'Esegui e salva operazione',
    group: 'conferma',
    tone: 'amber',
    command: { kind: 'confirm', label: 'Conferma operazione' },
  },
  {
    code: 'MTANNULLA',
    title: 'ANNULLA',
    subtitle: 'Svuota coda o annulla ultimo',
    group: 'conferma',
    tone: 'slate',
    command: { kind: 'cancel', label: 'Annulla operazione' },
  },
  {
    code: 'MTQ1',
    title: '×1',
    subtitle: 'Imposta quantità a 1',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'set_qty', qty: 1, label: 'Quantità ×1' },
  },
  {
    code: 'MTQ2',
    title: '×2',
    subtitle: 'Imposta quantità a 2',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'set_qty', qty: 2, label: 'Quantità ×2' },
  },
  {
    code: 'MTQ5',
    title: '×5',
    subtitle: 'Imposta quantità a 5',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'set_qty', qty: 5, label: 'Quantità ×5' },
  },
  {
    code: 'MTQ10',
    title: '×10',
    subtitle: 'Imposta quantità a 10',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'set_qty', qty: 10, label: 'Quantità ×10' },
  },
  {
    code: 'MTQ20',
    title: '×20',
    subtitle: 'Imposta quantità a 20',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'set_qty', qty: 20, label: 'Quantità ×20' },
  },
  {
    code: 'MTQ50',
    title: '×50',
    subtitle: 'Imposta quantità a 50',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'set_qty', qty: 50, label: 'Quantità ×50' },
  },
  {
    code: 'MTA5',
    title: '+5 PZ',
    subtitle: 'Somma +5 pezzi',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'add_qty', delta: 5, label: 'Aggiungi +5 pz' },
  },
  {
    code: 'MTA10',
    title: '+10 PZ',
    subtitle: 'Somma +10 pezzi',
    group: 'quantita',
    tone: 'slate',
    command: { kind: 'add_qty', delta: 10, label: 'Aggiungi +10 pz' },
  },
];

const COMMAND_MAP = new Map<string, ParsedQrCommand>(
  METATRON_QR_COMMANDS.map((def) => [def.code, def.command])
);

/**
 * Riconosce qualsiasi codice QR Comando Rapido sparato con la pistola USB/wireless.
 * Tollera anche spazi o separatori accidentali.
 */
export function parseQrCommand(raw: string): ParsedQrCommand | null {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return null;

  const exact = COMMAND_MAP.get(cleaned);
  if (exact) return exact;

  // Supporto dinamico per eventuali quantità personalizzate tipo MTQ100 o MTA25
  const setQtyMatch = cleaned.match(/^MTQ(\d{1,4})$/);
  if (setQtyMatch) {
    const qty = Math.max(1, parseInt(setQtyMatch[1], 10));
    return { kind: 'set_qty', qty, label: `Quantità ×${qty}` };
  }
  const addQtyMatch = cleaned.match(/^MTA(\d{1,4})$/);
  if (addQtyMatch) {
    const delta = Math.max(1, parseInt(addQtyMatch[1], 10));
    return { kind: 'add_qty', delta, label: `Aggiungi +${delta} pz` };
  }

  return null;
}

export async function generateQrDataUrl(text: string, width = 260): Promise<string> {
  return QRCode.toDataURL(text, {
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}

/**
 * Genera e scarica la Plancia A4 "QR Comandi Rapidi da Banco" pronta da stampare e attaccare allo scaffale/banco.
 */
export async function downloadQrCommandSheetPdf(): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;

  // Intestazione pulita ad alto contrasto
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 27, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('METATRON · PLANCIA QR COMANDI RAPIDI DA BANCO', 12, 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(226, 232, 240);
  doc.text(
    '1. Spara l\'articolo (anche più volte)   ·   2. Spara CARICO / SCARICO o la quantità   ·   3. Spara CONFERMA',
    12,
    19.5
  );

  // Pre-genera tutti i QR in alta risoluzione
  const qrImages = new Map<string, string>();
  for (const def of METATRON_QR_COMMANDS) {
    const url = await generateQrDataUrl(def.code, 320);
    qrImages.set(def.code, url);
  }

  const toneRgb: Record<
    QrCommandDefinition['tone'],
    { header: [number, number, number]; border: [number, number, number]; text: [number, number, number] }
  > = {
    emerald: { header: [5, 150, 105], border: [16, 185, 129], text: [255, 255, 255] },
    rose: { header: [225, 29, 72], border: [244, 63, 94], text: [255, 255, 255] },
    amber: { header: [217, 119, 6], border: [245, 158, 11], text: [255, 255, 255] },
    slate: { header: [30, 41, 59], border: [148, 163, 184], text: [255, 255, 255] },
  };

  // Sezione 1: 4 Comandi Principali GRANDI (2x2) -> leggibili anche da 40 cm di distanza
  const primaryCommands = METATRON_QR_COMMANDS.filter(
    (c) => c.group === 'azione' || c.group === 'conferma'
  );
  const startY = 33;
  const bigCardW = 90;
  const bigCardH = 56;
  const gapX = 6;
  const gapY = 6;
  const marginX = 12;

  primaryCommands.forEach((cmd, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = marginX + col * (bigCardW + gapX);
    const y = startY + row * (bigCardH + gapY);
    const pal = toneRgb[cmd.tone];

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(pal.border[0], pal.border[1], pal.border[2]);
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, bigCardW, bigCardH, 3, 3, 'FD');

    doc.setFillColor(pal.header[0], pal.header[1], pal.header[2]);
    doc.roundedRect(x, y, bigCardW, 12, 3, 3, 'F');
    doc.rect(x, y + 6, bigCardW, 6, 'F');

    doc.setTextColor(pal.text[0], pal.text[1], pal.text[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(cmd.title, x + 5, y + 8.3);

    const qrUrl = qrImages.get(cmd.code);
    if (qrUrl) {
      doc.addImage(qrUrl, 'PNG', x + 4.5, y + 15.5, 36, 36);
    }

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(cmd.subtitle, x + 44, y + 28, { maxWidth: 42 });

    doc.setTextColor(100, 116, 139);
    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text(cmd.code, x + 44, y + 46);
  });

  // Sezione 2: 8 Comandi Quantità (4 colonne × 2 righe)
  const qtyStartY = startY + 2 * (bigCardH + gapY) + 6;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('QUANTITÀ & MOLTIPLICATORI RAPIDI', marginX, qtyStartY);

  const qtyCommands = METATRON_QR_COMMANDS.filter((c) => c.group === 'quantita');
  const smallW = 43.5;
  const smallH = 54;
  const smallGapX = 4;
  const smallGapY = 5;
  const gridY = qtyStartY + 4;

  qtyCommands.forEach((cmd, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const x = marginX + col * (smallW + smallGapX);
    const y = gridY + row * (smallH + smallGapY);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, smallW, smallH, 2.5, 2.5, 'FD');

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(x, y, smallW, 9.5, 2.5, 2.5, 'F');
    doc.rect(x, y + 5, smallW, 4.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(cmd.title, x + smallW / 2, y + 6.8, { align: 'center' });

    const qrUrl = qrImages.get(cmd.code);
    if (qrUrl) {
      doc.addImage(qrUrl, 'PNG', x + (smallW - 31) / 2, y + 12, 31, 31);
    }

    doc.setTextColor(71, 85, 105);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(cmd.code, x + smallW / 2, y + 48.5, { align: 'center' });
  });

  // Nota a piè di pagina
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Compatibile con qualsiasi pistola barcode/QR USB o wireless (tastiera IT/US) in Magazzino e Scanner Bancale.',
    pageW / 2,
    288,
    { align: 'center' }
  );

  doc.save('METATRON_Plancia_QR_Comandi_Banco.pdf');
}
