import QRCode from 'qrcode';
import jsPDF from 'jspdf';

/**
 * Driver Web Bluetooth + motore raster 384px (57mm / 48mm utili, 200 DPI)
 * compatibile con stampanti termiche mini Bluetooth protocollo TiMini / Tiny Print / Cat-Printer
 * (GB01, GB02, GB03, GT01, MX05, MX06, MX08, MX09, MX10, YT01, C15, X5, P1, D1, ecc.)
 */

export const TIMINI_PRINT_WIDTH_PX = 384; // 48 bytes per riga (57mm rotolo, 48mm stampa utile)
export const TIMINI_BYTES_PER_LINE = TIMINI_PRINT_WIDTH_PX / 8; // 48

// UUID BLE standard usati dalle stampanti TiMini / Tiny Print / Cat-Printer
export const TIMINI_SERVICE_UUIDS = [
  0xae30,
  0xaf30,
  0xff00,
  '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000af30-0000-1000-8000-00805f9b34fb',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
];

const TIMINI_WRITE_CHAR_CANDIDATES = [
  '0000ae01-0000-1000-8000-00805f9b34fb',
  '0000ae03-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
];

const TIMINI_NOTIFY_CHAR_CANDIDATES = [
  '0000ae02-0000-1000-8000-00805f9b34fb',
  '0000ff01-0000-1000-8000-00805f9b34fb',
];

// Tabella CRC-8 (polinomio 0x07) usata dal protocollo 0x51 0x78
const CRC8_TABLE = new Uint8Array([
  0x00, 0x07, 0x0e, 0x09, 0x1c, 0x1b, 0x12, 0x15, 0x38, 0x3f, 0x36, 0x31, 0x24, 0x23, 0x2a, 0x2d,
  0x70, 0x77, 0x7e, 0x79, 0x6c, 0x6b, 0x62, 0x65, 0x48, 0x4f, 0x46, 0x41, 0x54, 0x53, 0x5a, 0x5d,
  0xe0, 0xe7, 0xee, 0xe9, 0xfc, 0xfb, 0xf2, 0xf5, 0xd8, 0xdf, 0xd6, 0xd1, 0xc4, 0xc3, 0xca, 0xcd,
  0x90, 0x97, 0x9e, 0x99, 0x8c, 0x8b, 0x82, 0x85, 0xa8, 0xaf, 0xa6, 0xa1, 0xb4, 0xb3, 0xba, 0xbd,
  0xc7, 0xc0, 0xc9, 0xce, 0xdb, 0xdc, 0xd5, 0xd2, 0xff, 0xf8, 0xf1, 0xf6, 0xe3, 0xe4, 0xed, 0xea,
  0xb7, 0xb0, 0xb9, 0xbe, 0xab, 0xac, 0xa5, 0xa2, 0x8f, 0x88, 0x81, 0x86, 0x93, 0x94, 0x9d, 0x9a,
  0x27, 0x20, 0x29, 0x2e, 0x3b, 0x3c, 0x35, 0x32, 0x1f, 0x18, 0x11, 0x16, 0x03, 0x04, 0x0d, 0x0a,
  0x57, 0x50, 0x59, 0x5e, 0x4b, 0x4c, 0x45, 0x42, 0x6f, 0x68, 0x61, 0x66, 0x73, 0x74, 0x7d, 0x7a,
  0x89, 0x8e, 0x87, 0x80, 0x95, 0x92, 0x9b, 0x9c, 0xb1, 0xb6, 0xbf, 0xb8, 0xad, 0xaa, 0xa3, 0xa4,
  0xf9, 0xfe, 0xf7, 0xf0, 0xe5, 0xe2, 0xeb, 0xec, 0xc1, 0xc6, 0xcf, 0xc8, 0xdd, 0xda, 0xd3, 0xd4,
  0x69, 0x6e, 0x67, 0x60, 0x75, 0x72, 0x7b, 0x7c, 0x51, 0x56, 0x5f, 0x58, 0x4d, 0x4a, 0x43, 0x44,
  0x19, 0x1e, 0x17, 0x10, 0x05, 0x02, 0x0b, 0x0c, 0x21, 0x26, 0x2f, 0x28, 0x3d, 0x3a, 0x33, 0x34,
  0x4e, 0x49, 0x40, 0x47, 0x52, 0x55, 0x5c, 0x5b, 0x76, 0x71, 0x78, 0x7f, 0x6a, 0x6d, 0x64, 0x63,
  0x3e, 0x39, 0x30, 0x37, 0x22, 0x25, 0x2c, 0x2b, 0x06, 0x01, 0x08, 0x0f, 0x1a, 0x1d, 0x14, 0x13,
  0xae, 0xa9, 0xa0, 0xa7, 0xb2, 0xb5, 0xbc, 0xbb, 0x96, 0x91, 0x98, 0x9f, 0x8a, 0x8d, 0x84, 0x83,
  0xde, 0xd9, 0xd0, 0xd7, 0xc2, 0xc5, 0xcc, 0xcb, 0xe6, 0xe1, 0xe8, 0xef, 0xfa, 0xfd, 0xf4, 0xf3,
]);

function computeCrc8(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = CRC8_TABLE[(crc ^ data[i]) & 0xff];
  }
  return crc;
}

function buildPacket(cmd: number, payload: number[] | Uint8Array): Uint8Array {
  const data = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  const packet = new Uint8Array(8 + data.length);
  packet[0] = 0x51;
  packet[1] = 0x78;
  packet[2] = cmd & 0xff;
  packet[3] = 0x00;
  packet[4] = data.length & 0xff;
  packet[5] = (data.length >> 8) & 0xff;
  packet.set(data, 6);
  packet[6 + data.length] = computeCrc8(data);
  packet[7 + data.length] = 0xff;
  return packet;
}

const START_LATTICE = [0xaa, 0x55, 0x17, 0x38, 0x44, 0x5f, 0x5f, 0x5f, 0x44, 0x38, 0x2c];
const END_LATTICE = [0xaa, 0x55, 0x17, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x17];

export type ThermalDarknessLevel = 'light' | 'medium' | 'dark' | 'ultra';
export type ThermalDitherMode = 'threshold' | 'floyd_steinberg';
export type LabelBorderStyle = 'none' | 'frame' | 'header_banner';
export type LabelHeightPreset = 'auto' | '30mm' | '40mm' | '50mm' | '75mm';

export interface TiMiniLabelDesign {
  id: string;
  name: string;
  headerTag: string;
  title: string;
  subtitle: string;
  codeText: string;
  footerText: string;
  includeQr: boolean;
  qrContent: string;
  includeBarcode: boolean;
  barcodeContent: string;
  imageDataUrl?: string;
  borderStyle: LabelBorderStyle;
  heightPreset: LabelHeightPreset;
  ditherMode: ThermalDitherMode;
  threshold: number; // 80..220
  fontScale: 'compact' | 'normal' | 'large';
  mirrorHorizontal?: boolean;
}

const ENERGY_BY_DARKNESS: Record<ThermalDarknessLevel, number> = {
  light: 0x2ee0, // 12000
  medium: 0x4650, // 18000
  dark: 0x61a8, // 25000
  ultra: 0x8000, // 32768
};

export interface TiMiniConnection {
  device: any;
  deviceName: string;
  writeChar: any;
  notifyChar?: any;
  disconnect: () => void;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as any).bluetooth);
}

export async function connectTiMiniBluetooth(): Promise<TiMiniConnection> {
  if (!isWebBluetoothSupported()) {
    throw new Error(
      'Bluetooth diretto non disponibile in questo browser. Usa METATRON Desktop, Chrome o Edge su PC/Android, oppure stampa con Windows/USB.'
    );
  }

  const bt = (navigator as any).bluetooth;
  let device: any = null;
  try {
    device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: TIMINI_SERVICE_UUIDS,
    });
  } catch (err: any) {
    const rawMsg = String(err?.message || err || '');
    if (/permissions policy|disallowed by permissions|not allowed/i.test(rawMsg)) {
      throw new Error(
        'Il Bluetooth è bloccato dentro il riquadro anteprima di AI Studio. Per stampare via Bluetooth TiMini usa METATRON Desktop installato sul PC oppure apri l’app in una scheda esterna di Chrome/Edge (qui puoi usare Stampa Windows/USB o PNG 384px).'
      );
    }
    throw err;
  }

  if (!device || !device.gatt) {
    throw new Error('Dispositivo Bluetooth non valido o GATT non supportato.');
  }

  const server = await device.gatt.connect();
  let service: any = null;
  for (const uuid of TIMINI_SERVICE_UUIDS) {
    try {
      service = await server.getPrimaryService(uuid);
      if (service) break;
    } catch {
      // prova prossimo UUID
    }
  }

  if (!service) {
    const services = await server.getPrimaryServices().catch(() => []);
    if (Array.isArray(services) && services.length > 0) {
      service = services[0];
    }
  }

  if (!service) {
    throw new Error(
      'Servizio di stampa BLE non trovato sulla stampante. Verifica che sia accesa e compatibile TiMini / Tiny Print.'
    );
  }

  let writeChar: any = null;
  for (const charUuid of TIMINI_WRITE_CHAR_CANDIDATES) {
    try {
      writeChar = await service.getCharacteristic(charUuid);
      if (writeChar) break;
    } catch {
      // continua
    }
  }

  if (!writeChar) {
    const chars = await service.getCharacteristics().catch(() => []);
    writeChar = chars.find(
      (c: any) => c.properties?.writeWithoutResponse || c.properties?.write
    );
  }

  if (!writeChar) {
    throw new Error('Caratteristica di scrittura BLE non trovata sulla stampante.');
  }

  let notifyChar: any = undefined;
  for (const charUuid of TIMINI_NOTIFY_CHAR_CANDIDATES) {
    try {
      notifyChar = await service.getCharacteristic(charUuid);
      if (notifyChar) break;
    } catch {
      // opzionale
    }
  }

  return {
    device,
    deviceName: device.name || 'Stampante TiMini BLE',
    writeChar,
    notifyChar,
    disconnect: () => {
      try {
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
      } catch {
        // ignore
      }
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeBleBytes(
  writeChar: any,
  bytes: Uint8Array,
  chunkSize = 80,
  delayMs = 12
): Promise<void> {
  const useNoResp = Boolean(writeChar.properties?.writeWithoutResponse);
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    if (useNoResp && typeof writeChar.writeValueWithoutResponse === 'function') {
      await writeChar.writeValueWithoutResponse(chunk);
    } else {
      await writeChar.writeValue(chunk);
    }
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }
}

export function isTiMiniConnected(conn: TiMiniConnection | null): boolean {
  return Boolean(conn && conn.device?.gatt?.connected);
}

export async function feedTiMiniPaper(
  conn: TiMiniConnection,
  steps = 48
): Promise<void> {
  const clamped = Math.max(8, Math.min(255, Math.round(steps)));
  const pkt = buildPacket(0xa1, [clamped & 0xff, (clamped >> 8) & 0xff]);
  await writeBleBytes(conn.writeChar, pkt, 60, 10);
}

/**
 * Stampa una piccola ricevuta di verifica connessione (~24mm) per confermare
 * fisicamente che la stampante TiMini riceve e stampa correttamente.
 */
export async function printTiMiniTestSlip(
  conn: TiMiniConnection,
  darkness: ThermalDarknessLevel = 'dark',
  chunkSize = 80
): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = TIMINI_PRINT_WIDTH_PX;
  canvas.height = 176;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 16px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('METATRON · TEST STAMPA OK', canvas.width / 2, 18);

  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'top';
  ctx.font = '700 20px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('STAMPANTE COLLEGATA', canvas.width / 2, 50);

  ctx.font = '700 15px "JetBrains Mono", Consolas, monospace';
  ctx.fillText((conn.deviceName || 'TiMini BLE').slice(0, 28), canvas.width / 2, 82);

  ctx.fillRect(24, 112, canvas.width - 48, 2);

  ctx.font = '700 14px "Plus Jakarta Sans", Arial, sans-serif';
  const nowStr = new Date().toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  ctx.fillText(`${nowStr} · 384px · 200 DPI`, canvas.width / 2, 126);

  const { rows } = binarizeThermalCanvas(canvas, 'threshold', 165, false);
  await printRowsToTiMini(conn, rows, {
    darkness,
    feedAfterSteps: 56,
    copies: 1,
    chunkSize,
  });
}

/**
 * Converte un Canvas (larghezza 384px) in array di righe 1-bit (48 byte per riga, LSB-first)
 * e restituisce anche l'ImageData binarizzata per mostrare l'anteprima termica fedele al 100%.
 */
export function binarizeThermalCanvas(
  sourceCanvas: HTMLCanvasElement,
  mode: ThermalDitherMode,
  threshold = 155,
  mirrorHorizontal = false
): {
  rows: Uint8Array[];
  previewCanvas: HTMLCanvasElement;
} {
  const width = TIMINI_PRINT_WIDTH_PX;
  const height = sourceCanvas.height;

  const workCanvas = document.createElement('canvas');
  workCanvas.width = width;
  workCanvas.height = height;
  const ctx = workCanvas.getContext('2d');
  if (!ctx) {
    return { rows: [], previewCanvas: workCanvas };
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(sourceCanvas, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const gray = new Float32Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3] / 255;
    // Sfondo bianco per pixel trasparenti
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) * a + 255 * (1 - a);
    gray[i] = lum;
  }

  const mono = new Uint8Array(width * height); // 1 = nero (stampa), 0 = bianco

  if (mode === 'floyd_steinberg') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const oldVal = gray[idx];
        const isBlack = oldVal < threshold;
        const newVal = isBlack ? 0 : 255;
        mono[idx] = isBlack ? 1 : 0;
        const err = oldVal - newVal;

        if (x + 1 < width) gray[idx + 1] += (err * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) gray[idx + width - 1] += (err * 3) / 16;
          gray[idx + width] += (err * 5) / 16;
          if (x + 1 < width) gray[idx + width + 1] += (err * 1) / 16;
        }
      }
    }
  } else {
    for (let i = 0; i < width * height; i++) {
      mono[i] = gray[i] < threshold ? 1 : 0;
    }
  }

  // Costruisce righe 48-byte (LSB-first per protocollo TiMini 0xA2) e aggiorna l'anteprima
  const rows: Uint8Array[] = [];
  for (let y = 0; y < height; y++) {
    const rowBytes = new Uint8Array(TIMINI_BYTES_PER_LINE);
    for (let x = 0; x < width; x++) {
      const sampleX = mirrorHorizontal ? width - 1 - x : x;
      const isBlack = mono[y * width + sampleX] === 1;
      if (isBlack) {
        rowBytes[x >> 3] |= 1 << (x & 7);
      }
      const pIdx = (y * width + x) * 4;
      const c = mono[y * width + x] === 1 ? 15 : 255;
      data[pIdx] = c;
      data[pIdx + 1] = c;
      data[pIdx + 2] = c;
      data[pIdx + 3] = 255;
    }
    rows.push(rowBytes);
  }

  ctx.putImageData(imgData, 0, 0);
  return { rows, previewCanvas: workCanvas };
}

/**
 * Invia le righe raster 384px alla stampante TiMini via Bluetooth BLE
 */
export async function printRowsToTiMini(
  conn: TiMiniConnection,
  rows: Uint8Array[],
  options: {
    darkness: ThermalDarknessLevel;
    feedAfterSteps: number;
    copies: number;
    chunkSize?: number;
    onProgress?: (percent: number, label: string) => void;
  }
): Promise<void> {
  const { darkness, feedAfterSteps, copies, chunkSize = 80, onProgress } = options;
  const energy = ENERGY_BY_DARKNESS[darkness] ?? ENERGY_BY_DARKNESS.dark;
  const totalCopies = Math.max(1, Math.min(20, Math.round(copies)));

  for (let copyIdx = 0; copyIdx < totalCopies; copyIdx++) {
    onProgress?.(
      Math.round((copyIdx / totalCopies) * 100),
      `Preparazione stampa ${copyIdx + 1}/${totalCopies}...`
    );

    // Sequenza di inizializzazione TiMini / Cat-Printer 0x51 0x78
    const initPackets = [
      buildPacket(0xa3, [0x00]), // Get Dev State
      buildPacket(0xa4, [0x33]), // Set Quality
      buildPacket(0xa6, START_LATTICE), // Start Lattice
      buildPacket(0xaf, [energy & 0xff, (energy >> 8) & 0xff]), // Set Energy (Darkness)
      buildPacket(0xbe, [0x01]), // Apply Energy
      buildPacket(0xbd, [0x19]), // Set Print Speed (nitido per barcode/QR)
    ];

    for (const pkt of initPackets) {
      await writeBleBytes(conn.writeChar, pkt, chunkSize, 12);
    }

    // Invio righe raster in blocchi compatti per massima fluidità
    const batchLines = 4;
    for (let i = 0; i < rows.length; i += batchLines) {
      const slice = rows.slice(i, Math.min(i + batchLines, rows.length));
      let totalLen = 0;
      const linePackets = slice.map((r) => {
        const p = buildPacket(0xa2, r);
        totalLen += p.length;
        return p;
      });
      const combined = new Uint8Array(totalLen);
      let pos = 0;
      for (const p of linePackets) {
        combined.set(p, pos);
        pos += p.length;
      }
      await writeBleBytes(conn.writeChar, combined, chunkSize, 14);

      const linePct = (i + slice.length) / Math.max(1, rows.length);
      const overallPct = Math.round(((copyIdx + linePct) / totalCopies) * 100);
      onProgress?.(
        overallPct,
        `Stampa copia ${copyIdx + 1}/${totalCopies} · riga ${Math.min(
          i + slice.length,
          rows.length
        )}/${rows.length}`
      );
    }

    // Avanzamento carta + chiusura lattice
    const endPackets = [
      buildPacket(0xa1, [feedAfterSteps & 0xff, (feedAfterSteps >> 8) & 0xff]),
      buildPacket(0xa6, END_LATTICE),
    ];
    for (const pkt of endPackets) {
      await writeBleBytes(conn.writeChar, pkt, chunkSize, 15);
    }

    if (copyIdx < totalCopies - 1) {
      await sleep(350);
    }
  }

  onProgress?.(100, 'Stampa completata');
}

// Codifica Code 39 reale per barcode 1D nitidi e scansionabili da pistola USB
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw',
  W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn',
};

function drawCode39Barcode(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  x: number,
  y: number,
  maxWidth: number,
  barHeight: number
) {
  const sanitized = rawText
    .toUpperCase()
    .replace(/[^0-9A-Z\-.$ /+%]/g, '')
    .slice(0, 18);
  if (!sanitized) return;

  const full = `*${sanitized}*`;
  const modules: boolean[] = [];
  for (let c = 0; c < full.length; c++) {
    const pattern = CODE39_PATTERNS[full[c]] || CODE39_PATTERNS['-'];
    for (let i = 0; i < pattern.length; i++) {
      const isBar = i % 2 === 0;
      const units = pattern[i] === 'w' ? 3 : 1;
      for (let u = 0; u < units; u++) modules.push(isBar);
    }
    modules.push(false); // spazio tra caratteri
  }

  const unitW = Math.max(1, Math.floor(maxWidth / modules.length));
  const actualW = modules.length * unitW;
  const startX = Math.floor(x + (maxWidth - actualW) / 2);

  ctx.fillStyle = '#000000';
  for (let i = 0; i < modules.length; i++) {
    if (modules[i]) {
      ctx.fillRect(startX + i * unitW, y, unitW, barHeight);
    }
  }
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const PRESET_MIN_HEIGHT_PX: Record<LabelHeightPreset, number> = {
  auto: 180,
  '30mm': 240, // ~30mm @ 203 DPI
  '40mm': 320,
  '50mm': 400,
  '75mm': 600,
};

/**
 * Disegna l'etichetta termica completa su un Canvas esattamente largo 384px (200 DPI)
 */
export async function renderTiMiniLabelCanvas(
  design: TiMiniLabelDesign
): Promise<HTMLCanvasElement> {
  const width = TIMINI_PRINT_WIDTH_PX;
  const pad = design.borderStyle === 'frame' ? 18 : 12;
  const contentW = width - pad * 2;

  const scale =
    design.fontScale === 'compact' ? 0.85 : design.fontScale === 'large' ? 1.18 : 1;

  // Misurazione dinamica altezza
  const measureCanvas = document.createElement('canvas');
  measureCanvas.width = width;
  measureCanvas.height = 100;
  const mctx = measureCanvas.getContext('2d')!;

  const titleFontSize = Math.round(24 * scale);
  const subtitleFontSize = Math.round(16 * scale);
  const codeFontSize = Math.round(22 * scale);

  mctx.font = `700 ${titleFontSize}px "Plus Jakarta Sans", Arial, sans-serif`;
  const titleLines = wrapCanvasText(mctx, design.title || '', contentW, 3);

  mctx.font = `500 ${subtitleFontSize}px "Plus Jakarta Sans", Arial, sans-serif`;
  const subtitleLines = wrapCanvasText(mctx, design.subtitle || '', contentW, 3);

  const loadedImage = design.imageDataUrl ? await loadImage(design.imageDataUrl) : null;
  const imgDrawH = loadedImage
    ? Math.min(180, Math.round((loadedImage.height / Math.max(1, loadedImage.width)) * contentW))
    : 0;

  let calcY = design.borderStyle === 'header_banner' ? 46 : pad;
  if (design.borderStyle !== 'header_banner' && design.headerTag.trim()) calcY += 22;
  if (loadedImage) calcY += imgDrawH + 10;
  if (titleLines.length > 0) calcY += titleLines.length * (titleFontSize + 5) + 6;
  if (subtitleLines.length > 0) calcY += subtitleLines.length * (subtitleFontSize + 4) + 6;
  if (design.codeText.trim()) calcY += codeFontSize + 14;
  if (design.includeBarcode && (design.barcodeContent || design.codeText).trim()) {
    calcY += 64;
  }
  if (design.includeQr && (design.qrContent || design.codeText || design.title).trim()) {
    calcY += 136;
  }
  if (design.footerText.trim()) calcY += 26;
  calcY += pad + 6;

  const finalHeight = Math.max(PRESET_MIN_HEIGHT_PX[design.heightPreset], calcY);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = finalHeight;
  const ctx = canvas.getContext('2d')!;

  // Sfondo bianco carta termica
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, finalHeight);

  // Stile bordo / testata
  let y = pad;
  if (design.borderStyle === 'frame') {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, width - 12, finalHeight - 12);
    y = pad + 2;
  } else if (design.borderStyle === 'header_banner') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, 38);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 16px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      (design.headerTag || 'METATRON').toUpperCase().slice(0, 32),
      width / 2,
      19
    );
    y = 48;
  }

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (design.borderStyle !== 'header_banner' && design.headerTag.trim()) {
    ctx.font = '700 13px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(design.headerTag.trim().toUpperCase(), width / 2, y);
    y += 18;
    ctx.fillRect(pad, y, contentW, 2);
    y += 8;
  }

  // Logo / immagine opzionale
  if (loadedImage && imgDrawH > 0) {
    const drawW = Math.min(
      contentW,
      Math.round((loadedImage.width / Math.max(1, loadedImage.height)) * imgDrawH)
    );
    ctx.drawImage(loadedImage, Math.round((width - drawW) / 2), y, drawW, imgDrawH);
    y += imgDrawH + 10;
  }

  // Titolo principale
  if (titleLines.length > 0) {
    ctx.font = `800 ${titleFontSize}px "Plus Jakarta Sans", Arial, sans-serif`;
    for (const line of titleLines) {
      ctx.fillText(line, width / 2, y);
      y += titleFontSize + 5;
    }
    y += 4;
  }

  // Sottotitolo / Dettagli
  if (subtitleLines.length > 0) {
    ctx.font = `500 ${subtitleFontSize}px "Plus Jakarta Sans", Arial, sans-serif`;
    for (const line of subtitleLines) {
      ctx.fillText(line, width / 2, y);
      y += subtitleFontSize + 4;
    }
    y += 4;
  }

  // Codice SKU / Bancale in evidenza
  if (design.codeText.trim()) {
    ctx.font = `800 ${codeFontSize}px "JetBrains Mono", Consolas, monospace`;
    const boxH = codeFontSize + 10;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad + 6, y, contentW - 12, boxH);
    ctx.textBaseline = 'middle';
    ctx.fillText(design.codeText.trim(), width / 2, y + boxH / 2 + 1);
    ctx.textBaseline = 'top';
    y += boxH + 8;
  }

  // Barcode 1D Code39
  const barcodeVal = (design.barcodeContent || design.codeText).trim();
  if (design.includeBarcode && barcodeVal) {
    drawCode39Barcode(ctx, barcodeVal, pad + 4, y, contentW - 8, 46);
    y += 51;
    ctx.font = '800 14px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(barcodeVal.toUpperCase(), width / 2, y);
    y += 22;
  }

  // QR Code scansionabile
  const qrVal = (design.qrContent || design.codeText || design.title).trim();
  if (design.includeQr && qrVal) {
    try {
      const qrDataUrl = await QRCode.toDataURL(qrVal, {
        width: 128,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });
      const qrImg = await loadImage(qrDataUrl);
      if (qrImg) {
        ctx.drawImage(qrImg, Math.round((width - 128) / 2), y, 128, 128);
        y += 136;
      }
    } catch {
      // ignore QR error
    }
  }

  // Footer
  if (design.footerText.trim()) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(pad, y, contentW, 2);
    y += 8;
    ctx.font = '700 14px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillText(design.footerText.trim().slice(0, 42), width / 2, y);
  }

  return canvas;
}

/**
 * Esporta l'etichetta 384px in PDF esatto 57mm pronto per driver Windows/USB o Tiny Print mobile
 */
export function downloadThermalLabelPdf(
  canvas: HTMLCanvasElement,
  fileName: string,
  copies = 1
): void {
  const widthMm = 57;
  const heightMm = Math.max(25, Math.round((canvas.height / TIMINI_PRINT_WIDTH_PX) * 48 + 4));
  const doc = new jsPDF({
    orientation: widthMm >= heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  });
  const dataUrl = canvas.toDataURL('image/png');
  const total = Math.max(1, Math.min(20, copies));
  for (let i = 0; i < total; i++) {
    if (i > 0) doc.addPage([widthMm, heightMm]);
    doc.addImage(dataUrl, 'PNG', 4.5, 2, 48, heightMm - 4);
  }
  doc.save(fileName);
}

/**
 * Stampa tramite stampante di sistema Windows/USB (senza window.open, via iframe nascosto)
 */
export function printThermalCanvasViaSystemDialog(
  canvas: HTMLCanvasElement,
  copies = 1
): void {
  const dataUrl = canvas.toDataURL('image/png');
  const heightMm = Math.max(25, Math.round((canvas.height / TIMINI_PRINT_WIDTH_PX) * 48 + 4));
  const total = Math.max(1, Math.min(20, copies));

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!doctype html><html><head><title>TiMini Print</title><style>
    @page { size: 57mm ${heightMm}mm; margin: 0; }
    body { margin: 0; padding: 0; background: #fff; }
    .page { width: 57mm; height: ${heightMm}mm; display: flex; align-items: center; justify-content: center; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    img { width: 48mm; height: auto; image-rendering: pixelated; }
  </style></head><body></body></html>`);
  doc.close();

  for (let i = 0; i < total; i++) {
    const page = doc.createElement('div');
    page.className = 'page';
    const img = doc.createElement('img');
    img.src = dataUrl;
    page.appendChild(img);
    doc.body.appendChild(page);
  }

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // ignore
      }
    }, 1500);
  }, 250);
}
