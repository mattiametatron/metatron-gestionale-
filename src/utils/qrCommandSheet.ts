import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import {
  applyPrintLanguageToJsPdf,
  getPrintLanguage,
  PrintLanguageCode,
  translateTextsForPrint,
} from './printLanguage';

export type QrCommandGroup = 'azione' | 'conferma' | 'quantita';
export type CommandSheetFormat = 'barcode1d' | 'both' | 'qr2d';

export type ParsedQrCommand =
  | { kind: 'mode'; mode: 'carico' | 'scarico'; label: string }
  | { kind: 'confirm'; label: string }
  | { kind: 'cancel'; label: string }
  | { kind: 'set_qty'; qty: number; label: string }
  | { kind: 'add_qty'; delta: number; label: string };

export interface QrCommandDefinition {
  code: string; // Solo A-Z e 0-9: immune a layout tastiera IT/US di qualsiasi pistola 1D/2D USB
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
 * Riconosce qualsiasi codice Comando Rapido (Barcode 1D o QR 2D) sparato con pistola USB/wireless.
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
 * Genera un codice a barre 1D CODE 128 ad altissima definizione (ISO/IEC 15417)
 * con zone silenziose (quiet zones) laterali generose, leggibile istantaneamente
 * da qualsiasi pistola laser 1D (linea rossa) e 2D.
 */
export function generateBarcode1DDataUrl(
  text: string,
  opts?: { barWidth?: number; height?: number; margin?: number }
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  JsBarcode(canvas, text, {
    format: 'CODE128',
    lineColor: '#000000',
    background: '#ffffff',
    width: opts?.barWidth ?? 3,
    height: opts?.height ?? 110,
    displayValue: false,
    margin: opts?.margin ?? 18,
  });
  return canvas.toDataURL('image/png');
}

/**
 * Genera e scarica la Plancia A4 "Comandi Rapidi da Banco" in formato:
 * - 'barcode1d': Barcode 1D Code128 larghi, ottimizzati per pistole laser 1D
 * - 'both': Sia Barcode 1D Code128 che QR 2D su ogni comando
 * - 'qr2d': Solo QR 2D grandi
 */
export async function downloadQrCommandSheetPdf(
  lang: PrintLanguageCode = getPrintLanguage(),
  format: CommandSheetFormat = 'barcode1d'
): Promise<void> {
  const doc = applyPrintLanguageToJsPdf(
    new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }),
    lang
  );
  const pageW = 210;

  let localizedCommands = METATRON_QR_COMMANDS;
  let instructionLine =
    "1. Spara l'articolo (anche più volte)   ·   2. Spara CARICO / SCARICO o la quantità   ·   3. Spara CONFERMA";
  let qtyHeading = 'QUANTITÀ & MOLTIPLICATORI RAPIDI';
  let headerTitle =
    format === 'barcode1d'
      ? 'METATRON · PLANCIA BARCODE 1D COMANDI DA BANCO'
      : format === 'both'
      ? 'METATRON · PLANCIA BARCODE 1D + QR COMANDI DA BANCO'
      : 'METATRON · PLANCIA QR COMANDI RAPIDI DA BANCO';

  if (lang !== 'it') {
    const textsToTranslate = [
      headerTitle,
      instructionLine,
      qtyHeading,
      ...METATRON_QR_COMMANDS.flatMap((c) => [c.title, c.subtitle]),
    ];
    const translated = await translateTextsForPrint(
      textsToTranslate,
      lang,
      'warehouse barcode scanner workbench quick command labels (keep short, preserve symbols like +, -, ×, 1D, QR)'
    );
    headerTitle = translated[0] || headerTitle;
    instructionLine = translated[1] || instructionLine;
    qtyHeading = translated[2] || qtyHeading;
    localizedCommands = METATRON_QR_COMMANDS.map((c, idx) => ({
      ...c,
      title: translated[3 + idx * 2] || c.title,
      subtitle: translated[3 + idx * 2 + 1] || c.subtitle,
    }));
  }

  // Intestazione pulita ad alto contrasto
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 25, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(headerTitle, 12, 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(instructionLine, 12, 18.5);

  // Pre-genera immagini QR e/o Barcode 1D (codice interno SEMPRE invariato!)
  const qrImages = new Map<string, string>();
  const barcodeImages = new Map<string, string>();

  for (const def of METATRON_QR_COMMANDS) {
    if (format === 'qr2d' || format === 'both') {
      qrImages.set(def.code, await generateQrDataUrl(def.code, 320));
    }
    if (format === 'barcode1d' || format === 'both') {
      barcodeImages.set(
        def.code,
        generateBarcode1DDataUrl(def.code, { barWidth: 3, height: 115, margin: 20 })
      );
    }
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

  const primaryCommands = localizedCommands.filter(
    (c) => c.group === 'azione' || c.group === 'conferma'
  );
  const qtyCommands = localizedCommands.filter((c) => c.group === 'quantita');
  const marginX = 12;

  if (format === 'barcode1d' || format === 'both') {
    // =========================================================================
    // LAYOUT OTTIMIZZATO 1D LASER (Card larghe 90mm con Code128 nitidissimi!)
    // =========================================================================
    const startY = 30;
    const bigCardW = 90;
    const bigCardH = 52;
    const gapX = 6;
    const gapY = 5;

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
      doc.roundedRect(x, y, bigCardW, 11.5, 3, 3, 'F');
      doc.rect(x, y + 6, bigCardW, 5.5, 'F');

      doc.setTextColor(pal.text[0], pal.text[1], pal.text[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.text(cmd.title, x + 4.5, y + 8);
      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.text(cmd.code, x + bigCardW - 4.5, y + 7.8, { align: 'right' });

      const bcUrl = barcodeImages.get(cmd.code);
      if (format === 'barcode1d') {
        if (bcUrl) {
          doc.addImage(bcUrl, 'PNG', x + 4, y + 14.5, bigCardW - 8, 25);
        }
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(cmd.subtitle, x + bigCardW / 2, y + 46.5, { align: 'center' });
      } else {
        // Modalità Entrambi (QR a sinistra + Barcode 1D a destra)
        const qrUrl = qrImages.get(cmd.code);
        if (qrUrl) {
          doc.addImage(qrUrl, 'PNG', x + 3.5, y + 15, 28, 28);
        }
        if (bcUrl) {
          doc.addImage(bcUrl, 'PNG', x + 33, y + 16.5, 53.5, 22);
        }
        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(cmd.subtitle, x + 59.5, y + 46.5, { align: 'center', maxWidth: 54 });
      }
    });

    // Sezione 2: 8 Comandi Quantità in 2 colonne LARGHE × 4 righe (perfette per fascio laser 1D)
    const qtyHeadingY = startY + 2 * (bigCardH + gapY) + 4;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(qtyHeading, marginX, qtyHeadingY);

    const gridY = qtyHeadingY + 3.5;
    const qtyW = 90;
    const qtyH = 29;
    const qtyGapX = 6;
    const qtyGapY = 4;

    qtyCommands.forEach((cmd, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = marginX + col * (qtyW + qtyGapX);
      const y = gridY + row * (qtyH + qtyGapY);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.55);
      doc.roundedRect(x, y, qtyW, qtyH, 2.5, 2.5, 'FD');

      // Blocco scuro a sinistra col valore grande (es. ×10, +5 PZ)
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(x, y, 24, qtyH, 2.5, 2.5, 'F');
      doc.rect(x + 12, y, 12, qtyH, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cmd.title.length > 4 ? 11 : 14);
      doc.text(cmd.title, x + 12, y + 14.5, { align: 'center' });
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(203, 213, 225);
      doc.text(cmd.code, x + 12, y + 23, { align: 'center' });

      const bcUrl = barcodeImages.get(cmd.code);
      if (format === 'barcode1d') {
        if (bcUrl) {
          doc.addImage(bcUrl, 'PNG', x + 26, y + 3, 61.5, 23);
        }
      } else {
        const qrUrl = qrImages.get(cmd.code);
        if (qrUrl) {
          doc.addImage(qrUrl, 'PNG', x + 25.5, y + 3.5, 22, 22);
        }
        if (bcUrl) {
          doc.addImage(bcUrl, 'PNG', x + 48.5, y + 4.5, 39.5, 20);
        }
      }
    });
  } else {
    // =========================================================================
    // LAYOUT SOLO QR 2D (2x2 grandi + 4x2 quantità)
    // =========================================================================
    const startY = 31;
    const bigCardW = 90;
    const bigCardH = 56;
    const gapX = 6;
    const gapY = 6;

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

    const qtyStartY = startY + 2 * (bigCardH + gapY) + 6;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(qtyHeading, marginX, qtyStartY);

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
  }

  // Nota a piè di pagina
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Code 128 / QR · Compatibile con qualsiasi pistola laser 1D e 2D USB/wireless (tastiera IT/US) in Magazzino e Scanner Bancale.',
    pageW / 2,
    290,
    { align: 'center' }
  );

  const fileName =
    format === 'barcode1d'
      ? 'METATRON_Plancia_Barcode1D_Comandi_Banco.pdf'
      : format === 'both'
      ? 'METATRON_Plancia_1D_QR_Comandi_Banco.pdf'
      : 'METATRON_Plancia_QR_Comandi_Banco.pdf';

  doc.save(fileName);
}
