import QRCode from 'qrcode';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import jsPDF from 'jspdf';
import {
  CargoBox,
  CargoLoad,
  CargoPallet,
  ChecklistItem,
  StockMovement,
} from '../types/warehouse';
import { LIVE_PUBLIC_URL } from './cloudSync';

export type TrackEntityType = 'pallet' | 'box' | 'item';

export interface TrackingContentRow {
  code: string;
  name: string;
  quantity: number;
  location?: string;
}

export interface TrackingDetailedItem {
  itemId: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
  palletCode: string | null;
  boxCode: string | null;
  boxLabel: string | null;
  boxPath: string | null;
  fragile: boolean;
  notes?: string;
  loadedAt: string | null;
  shippedAt: string | null;
}

export interface ResolvedTrackingRecord {
  type: TrackEntityType;
  entityId: string;
  code: string;
  barcodeValue: string;
  name: string;
  commessaId: string;
  commessaCode: string;
  commessaTitle: string;
  client: string;
  destination: string;
  locationPath: string;
  palletCode: string | null;
  boxCode: string | null;
  parentBoxCode: string | null;
  quantityText: string;
  quantityNumber: number;
  weightKg: number;
  loadedAt: string | null;
  shippedAt: string | null;
  contents: TrackingContentRow[];
  detailedItems?: TrackingDetailedItem[];
}

interface CompactTrackPayload {
  v: 1;
  t: 'p' | 'b' | 'i';
  id: string;
  cc: string;
  ct: string;
  cl?: string;
  ds?: string;
  cd: string;
  n: string;
  q: string;
  qn: number;
  w: number;
  loc: string;
  p?: string;
  b?: string;
  ca?: string;
  sc?: string;
}

export function sanitizeCode39Text(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z\-.\s$/+%]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 24);
}

export function buildBarcodeValue(commessaCode: string, entityCode: string): string {
  const c = sanitizeCode39Text(commessaCode || 'COM').slice(0, 10);
  const e = sanitizeCode39Text(entityCode || 'COD').slice(0, 12);
  return `${c}-${e}`;
}

export function formatItDateTime(
  iso?: string | null,
  includeSeconds = false
): string {
  if (!iso) return 'Non registrata';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    if (includeSeconds) {
      const sec = String(d.getSeconds()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${min}:${sec}`;
    }
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return String(iso);
  }
}

export function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

export function fromDatetimeLocalValue(val: string): string | undefined {
  if (!val) return undefined;
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function collectBoxTreeIds(
  boxes: CargoBox[],
  rootBoxId: string
): Set<string> {
  const result = new Set<string>([rootBoxId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const b of boxes) {
      if (b.parentBoxId && result.has(b.parentBoxId) && !result.has(b.id)) {
        result.add(b.id);
        expanded = true;
      }
    }
  }
  return result;
}

export function collectPalletBoxIds(
  boxes: CargoBox[],
  palletId: string
): Set<string> {
  const result = new Set<string>(
    boxes.filter((b) => b.palletId === palletId).map((b) => b.id)
  );
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const b of boxes) {
      if (b.parentBoxId && result.has(b.parentBoxId) && !result.has(b.id)) {
        result.add(b.id);
        expanded = true;
      }
    }
  }
  return result;
}

function getBoxChainLabel(box: CargoBox, boxMap: Map<string, CargoBox>): {
  parentBoxCode: string | null;
  boxPath: string;
} {
  const chain: string[] = [box.code];
  let cursor = box;
  let guard = 0;
  while (cursor.parentBoxId && guard < 8) {
    const parent = boxMap.get(cursor.parentBoxId);
    if (!parent) break;
    chain.unshift(parent.code);
    cursor = parent;
    guard += 1;
  }
  const directParent = box.parentBoxId ? boxMap.get(box.parentBoxId) : null;
  return {
    parentBoxCode: directParent?.code || null,
    boxPath: chain.join(' > '),
  };
}

function findMatchingScaricoTimestamp(
  movements: StockMovement[],
  commessaCode: string,
  skuOrPkgCode: string,
  matchBy: 'sku' | 'package'
): string | null {
  const cUpper = (commessaCode || '').trim().toUpperCase();
  const targetUpper = (skuOrPkgCode || '').trim().toUpperCase();
  if (!targetUpper) return null;

  const matched = movements.find((m) => {
    if (m.type !== 'scarico') return false;
    if (cUpper && (m.commessaCode || '').trim().toUpperCase() !== cUpper) {
      return false;
    }
    if (matchBy === 'sku') {
      return (m.sku || '').trim().toUpperCase() === targetUpper;
    }
    return (m.packageCode || '').trim().toUpperCase() === targetUpper;
  });

  return matched?.timestamp || null;
}

export function resolveAllTrackingRecordsForLoad(
  load: CargoLoad,
  movements: StockMovement[] = []
): ResolvedTrackingRecord[] {
  const records: ResolvedTrackingRecord[] = [];
  const palletMap = new Map<string, CargoPallet>(load.pallets.map((p) => [p.id, p]));
  const boxMap = new Map<string, CargoBox>(load.boxes.map((b) => [b.id, b]));
  const handoverAt = load.handoverProof?.handoverAt || null;

  const buildDetailedItem = (
    item: ChecklistItem,
    fallbackPalletCode: string | null
  ): TrackingDetailedItem => {
    const box = item.boxId ? boxMap.get(item.boxId) || null : null;
    const boxChain = box ? getBoxChainLabel(box, boxMap) : null;
    const resolvedPalletId = box?.palletId || item.palletId || null;
    const pallet = resolvedPalletId ? palletMap.get(resolvedPalletId) || null : null;
    const unitWeightKg = Number(item.unitWeightKg) || 0;
    const qty = Number(item.quantity) || 0;
    const itemLoadedAt =
      item.loadedAt || box?.loadedAt || pallet?.loadedAt || load.loadedAt || null;
    const itemShippedAt =
      item.shippedAt ||
      box?.shippedAt ||
      pallet?.shippedAt ||
      load.shippedAt ||
      handoverAt ||
      findMatchingScaricoTimestamp(movements, load.code, item.sku, 'sku') ||
      null;

    return {
      itemId: item.id,
      sku: item.sku || `ART-${item.id.slice(-4).toUpperCase()}`,
      name: item.name || 'Articolo',
      category: item.category || 'Generale',
      quantity: qty,
      unitWeightKg,
      totalWeightKg: Math.round(qty * unitWeightKg * 100) / 100,
      palletCode: pallet?.code || fallbackPalletCode,
      boxCode: box?.code || null,
      boxLabel: box?.label || null,
      boxPath: boxChain?.boxPath || box?.code || null,
      fragile: Boolean(item.fragile || box?.fragile),
      notes: item.notes,
      loadedAt: itemLoadedAt,
      shippedAt: itemShippedAt,
    };
  };

  // 1. BANCALI
  load.pallets.forEach((pallet) => {
    const palletBoxIds = collectPalletBoxIds(load.boxes, pallet.id);
    const palletBoxes = load.boxes.filter((b) => palletBoxIds.has(b.id));
    const palletItems = load.items.filter(
      (it) => it.palletId === pallet.id || (it.boxId && palletBoxIds.has(it.boxId))
    );

    const totalPieces = palletItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
    const calculatedWeight =
      pallet.tareKg +
      palletBoxes.reduce((acc, b) => acc + (b.tareKg || 0), 0) +
      palletItems.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitWeightKg || 0), 0);
    const grossWeight =
      pallet.customWeightKg !== undefined && pallet.customWeightKg !== null
        ? pallet.customWeightKg
        : calculatedWeight;

    const proofForPallet = (load.packingProofs || []).find(
      (pr) => pr.targetId === pallet.id || pr.palletCode === pallet.code
    );

    const loadedAt =
      pallet.loadedAt ||
      proofForPallet?.certifiedAt ||
      palletBoxes.find((b) => b.loadedAt)?.loadedAt ||
      palletItems.find((i) => i.loadedAt)?.loadedAt ||
      load.loadedAt ||
      null;

    const shippedAt =
      pallet.shippedAt ||
      load.shippedAt ||
      handoverAt ||
      findMatchingScaricoTimestamp(movements, load.code, pallet.code, 'package') ||
      null;

    const slotLabel = pallet.truckSlot
      ? `Posto Camion #${pallet.truckSlot}`
      : 'Area Preparazione Spedizione';

    const contents: TrackingContentRow[] = [
      ...palletBoxes.map((b) => {
        const subBoxIds = collectBoxTreeIds(load.boxes, b.id);
        const bItems = load.items.filter((i) => i.boxId && subBoxIds.has(i.boxId));
        const bPcs = bItems.reduce((acc, i) => acc + i.quantity, 0);
        return {
          code: b.code,
          name: `Scatola: ${b.label}`,
          quantity: bPcs,
          location: `${bItems.length} articoli`,
        };
      }),
      ...palletItems
        .filter((i) => !i.boxId)
        .map((i) => ({
          code: i.sku,
          name: i.name,
          quantity: i.quantity,
          location: 'Fuori Scatola',
        })),
    ];

    const detailedItems = palletItems.map((it) =>
      buildDetailedItem(it, pallet.code)
    );

    records.push({
      type: 'pallet',
      entityId: pallet.id,
      code: pallet.code,
      barcodeValue: buildBarcodeValue(load.code, pallet.code),
      name: pallet.label || `Bancale ${pallet.code}`,
      commessaId: load.id,
      commessaCode: load.code,
      commessaTitle: load.title,
      client: load.client || '—',
      destination: load.destination || '—',
      locationPath: `${load.code} > ${pallet.code} (${slotLabel})`,
      palletCode: pallet.code,
      boxCode: null,
      parentBoxCode: null,
      quantityText: `${palletBoxes.length} scatole · ${totalPieces} pz`,
      quantityNumber: totalPieces,
      weightKg: Math.round(grossWeight * 100) / 100,
      loadedAt,
      shippedAt,
      contents,
      detailedItems,
    });
  });

  // 2. SCATOLE
  load.boxes.forEach((box) => {
    const pallet = box.palletId ? palletMap.get(box.palletId) || null : null;
    const { parentBoxCode, boxPath } = getBoxChainLabel(box, boxMap);
    const boxTreeIds = collectBoxTreeIds(load.boxes, box.id);
    const nestedBoxes = load.boxes.filter(
      (b) => b.id !== box.id && boxTreeIds.has(b.id)
    );
    const boxItems = load.items.filter((i) => i.boxId && boxTreeIds.has(i.boxId));
    const totalPieces = boxItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
    const boxWeight =
      (box.tareKg || 0) +
      nestedBoxes.reduce((acc, b) => acc + (b.tareKg || 0), 0) +
      boxItems.reduce((acc, i) => acc + (i.quantity || 0) * (i.unitWeightKg || 0), 0);

    const proofForBox = (load.packingProofs || []).find(
      (pr) => pr.targetType === 'box' && pr.targetId === box.id
    );

    const loadedAt =
      box.loadedAt ||
      proofForBox?.certifiedAt ||
      pallet?.loadedAt ||
      boxItems.find((i) => i.loadedAt)?.loadedAt ||
      load.loadedAt ||
      null;

    const shippedAt =
      box.shippedAt ||
      pallet?.shippedAt ||
      load.shippedAt ||
      handoverAt ||
      findMatchingScaricoTimestamp(movements, load.code, box.code, 'package') ||
      null;

    const locationPath = pallet
      ? `${pallet.code} > ${boxPath}`
      : `A Terra > ${boxPath}`;

    const detailedItems = boxItems.map((it) =>
      buildDetailedItem(it, pallet?.code || null)
    );

    records.push({
      type: 'box',
      entityId: box.id,
      code: box.code,
      barcodeValue: buildBarcodeValue(load.code, box.code),
      name: box.label || `Scatola ${box.code}`,
      commessaId: load.id,
      commessaCode: load.code,
      commessaTitle: load.title,
      client: load.client || '—',
      destination: load.destination || '—',
      locationPath,
      palletCode: pallet?.code || null,
      boxCode: box.code,
      parentBoxCode,
      quantityText: `${totalPieces} pz (${boxItems.length} art.)`,
      quantityNumber: totalPieces,
      weightKg: Math.round(boxWeight * 100) / 100,
      loadedAt,
      shippedAt,
      contents: boxItems.map((it) => {
        const itBox = it.boxId ? boxMap.get(it.boxId) : null;
        return {
          code: it.sku,
          name: it.name,
          quantity: it.quantity,
          location: itBox ? itBox.code : box.code,
        };
      }),
      detailedItems,
    });
  });

  // 3. OGGETTI / PEZZI
  load.items.forEach((item) => {
    const box = item.boxId ? boxMap.get(item.boxId) || null : null;
    const resolvedPalletId = box?.palletId || item.palletId || null;
    const pallet = resolvedPalletId ? palletMap.get(resolvedPalletId) || null : null;
    const boxChain = box ? getBoxChainLabel(box, boxMap) : null;

    let locationPath = 'Non ancora collocato';
    if (box && pallet) {
      locationPath = `${pallet.code} > ${boxChain?.boxPath || box.code}`;
    } else if (box) {
      locationPath = `Scatola ${boxChain?.boxPath || box.code}`;
    } else if (pallet) {
      locationPath = `Fuori Scatola su ${pallet.code}`;
    }

    const proofForItem = (load.packingProofs || []).find((pr) =>
      pr.items.some((pi) => pi.itemId === item.id)
    );

    const loadedAt =
      item.loadedAt ||
      box?.loadedAt ||
      proofForItem?.certifiedAt ||
      pallet?.loadedAt ||
      load.loadedAt ||
      null;

    const shippedAt =
      item.shippedAt ||
      box?.shippedAt ||
      pallet?.shippedAt ||
      load.shippedAt ||
      handoverAt ||
      findMatchingScaricoTimestamp(movements, load.code, item.sku, 'sku') ||
      null;

    records.push({
      type: 'item',
      entityId: item.id,
      code: item.sku || `ART-${item.id.slice(-4).toUpperCase()}`,
      barcodeValue: buildBarcodeValue(load.code, item.sku || item.id.slice(-4)),
      name: item.name || 'Articolo',
      commessaId: load.id,
      commessaCode: load.code,
      commessaTitle: load.title,
      client: load.client || '—',
      destination: load.destination || '—',
      locationPath,
      palletCode: pallet?.code || null,
      boxCode: box?.code || null,
      parentBoxCode: boxChain?.parentBoxCode || null,
      quantityText: `${item.quantity} pz`,
      quantityNumber: item.quantity,
      weightKg: Math.round(item.quantity * (item.unitWeightKg || 0) * 100) / 100,
      loadedAt,
      shippedAt,
      contents: [],
    });
  });

  return records;
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const bin = atob(padded + '='.repeat(padLen));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function encodeTrackPayload(record: ResolvedTrackingRecord): string {
  const compact: CompactTrackPayload = {
    v: 1,
    t: record.type === 'pallet' ? 'p' : record.type === 'box' ? 'b' : 'i',
    id: record.entityId,
    cc: record.commessaCode,
    ct: record.commessaTitle.slice(0, 48),
    cl: record.client !== '—' ? record.client.slice(0, 32) : undefined,
    ds: record.destination !== '—' ? record.destination.slice(0, 32) : undefined,
    cd: record.code,
    n: record.name.slice(0, 60),
    q: record.quantityText,
    qn: record.quantityNumber,
    w: record.weightKg,
    loc: record.locationPath.slice(0, 64),
    p: record.palletCode || undefined,
    b: record.boxCode || undefined,
    ca: record.loadedAt || undefined,
    sc: record.shippedAt || undefined,
  };
  const jsonBytes = strToU8(JSON.stringify(compact));
  const compressed = deflateSync(jsonBytes, { level: 9 });
  return uint8ToBase64Url(compressed);
}

export function decodeTrackPayload(encoded: string): ResolvedTrackingRecord | null {
  try {
    const compressed = base64UrlToUint8(encoded.trim());
    const inflated = inflateSync(compressed);
    const parsed = JSON.parse(strFromU8(inflated)) as CompactTrackPayload;
    if (!parsed || parsed.v !== 1) return null;

    const type: TrackEntityType =
      parsed.t === 'p' ? 'pallet' : parsed.t === 'b' ? 'box' : 'item';

    return {
      type,
      entityId: parsed.id || '',
      code: parsed.cd || '—',
      barcodeValue: buildBarcodeValue(parsed.cc || 'COM', parsed.cd || 'COD'),
      name: parsed.n || 'Articolo',
      commessaId: '',
      commessaCode: parsed.cc || '—',
      commessaTitle: parsed.ct || 'Commessa',
      client: parsed.cl || '—',
      destination: parsed.ds || '—',
      locationPath: parsed.loc || 'Non assegnato',
      palletCode: parsed.p || null,
      boxCode: parsed.b || null,
      parentBoxCode: null,
      quantityText: parsed.q || `${parsed.qn || 0} pz`,
      quantityNumber: Number(parsed.qn) || 0,
      weightKg: Number(parsed.w) || 0,
      loadedAt: parsed.ca || null,
      shippedAt: parsed.sc || null,
      contents: [],
    };
  } catch {
    return null;
  }
}

export function buildTrackingQrUrl(
  record: ResolvedTrackingRecord,
  baseUrl?: string
): string {
  let origin = baseUrl || '';
  if (!origin && typeof window !== 'undefined') {
    const loc = window.location;
    const isPublicHttp =
      (loc.protocol === 'https:' || loc.protocol === 'http:') &&
      loc.hostname !== 'localhost' &&
      loc.hostname !== '127.0.0.1' &&
      loc.origin !== 'null';
    origin = isPublicHttp ? loc.origin : LIVE_PUBLIC_URL;
  }
  if (!origin) {
    origin = LIVE_PUBLIC_URL;
  }
  const encoded = encodeTrackPayload(record);
  return `${origin.replace(/\/$/, '')}/t?d=${encoded}`;
}

export async function generateQrPngDataUrl(
  text: string,
  sizePx = 220
): Promise<string> {
  return QRCode.toDataURL(text, {
    width: sizePx,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

// =========================================================================
// STANDARD ISO CODE-39 VECTOR BARCODE RENDERER FOR JSPDF (Zero dependencies)
// Scannable by any industrial USB/Bluetooth laser scanner or phone app
// =========================================================================
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

export function drawCode39BarcodeOnPdf(
  doc: jsPDF,
  rawText: string,
  x: number,
  y: number,
  maxWidthMm: number,
  heightMm: number
) {
  const clean = sanitizeCode39Text(rawText) || 'ITEM';
  const encoded = `*${clean}*`;

  // Compute total module units (narrow = 1, wide = 2.5, inter-char gap = 1)
  const WIDE = 2.5;
  let totalUnits = 0;
  for (let i = 0; i < encoded.length; i++) {
    const pat = CODE39_PATTERNS[encoded[i]] || CODE39_PATTERNS['-'];
    for (let j = 0; j < pat.length; j++) {
      totalUnits += pat[j] === 'w' ? WIDE : 1;
    }
    if (i < encoded.length - 1) totalUnits += 1;
  }

  const unitWidth = Math.min(0.45, maxWidthMm / Math.max(totalUnits, 1));
  const actualWidth = totalUnits * unitWidth;
  let cursorX = x + Math.max(0, (maxWidthMm - actualWidth) / 2);

  doc.setFillColor(15, 23, 42);

  for (let i = 0; i < encoded.length; i++) {
    const pat = CODE39_PATTERNS[encoded[i]] || CODE39_PATTERNS['-'];
    for (let j = 0; j < pat.length; j++) {
      const w = (pat[j] === 'w' ? WIDE : 1) * unitWidth;
      if (j % 2 === 0) {
        // Bar
        doc.rect(cursorX, y, w, heightMm, 'F');
      }
      cursorX += w;
    }
    cursorX += unitWidth; // Inter-character narrow space
  }
}

/**
 * Cerca un record scansionato partendo da:
 * - un URL intero `https://.../?track=...`
 * - un payload `track=...`
 * - un codice barcode `COM001-ART005`
 * - un codice SKU, Scatola o Bancale (`ART-005`, `SC-01`, `BANC-01`)
 */
export function lookupScannedCodeAcrossLoads(
  rawInput: string,
  loads: CargoLoad[],
  movements: StockMovement[]
): ResolvedTrackingRecord | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // 1. Se contiene parametro ?track= oppure /t?d=
  let trackParam: string | null = null;
  if (trimmed.includes('track=') || trimmed.includes('?d=') || trimmed.includes('&d=')) {
    try {
      const urlObj = new URL(
        trimmed.startsWith('http')
          ? trimmed
          : `https://x.local/${trimmed.startsWith('?') ? trimmed : `?${trimmed}`}`
      );
      trackParam = urlObj.searchParams.get('d') || urlObj.searchParams.get('track');
    } catch {
      const match = trimmed.match(/(?:[?&]d=|track=)([A-Za-z0-9\-_]+)/);
      if (match) trackParam = match[1];
    }
  }

  if (trackParam) {
    const decoded = decodeTrackPayload(trackParam);
    if (decoded) {
      // Cerca versione live nei loads attuali per avere date carico/scarico sempre aggiornate!
      const liveLoad = loads.find(
        (l) => l.code.trim().toUpperCase() === decoded.commessaCode.trim().toUpperCase()
      );
      if (liveLoad) {
        const all = resolveAllTrackingRecordsForLoad(liveLoad, movements);
        const liveMatch = all.find(
          (r) =>
            r.type === decoded.type &&
            (r.entityId === decoded.entityId ||
              r.code.trim().toUpperCase() === decoded.code.trim().toUpperCase())
        );
        if (liveMatch) return liveMatch;
      }
      return decoded;
    }
  }

  // 2. Ricerca diretta per barcodeValue o codice (es. COM001-ART005, ART-005, SC-01, BANC-01)
  const cleanSearch = trimmed.replace(/^\*|\*$/g, '').trim().toUpperCase();
  const compactSearch = cleanSearch.replace(/[^A-Z0-9]/g, '');

  for (const load of loads) {
    const all = resolveAllTrackingRecordsForLoad(load, movements);
    const exact = all.find((r) => {
      const bv = r.barcodeValue.toUpperCase();
      const cd = r.code.toUpperCase();
      return (
        bv === cleanSearch ||
        cd === cleanSearch ||
        bv.replace(/[^A-Z0-9]/g, '') === compactSearch ||
        cd.replace(/[^A-Z0-9]/g, '') === compactSearch
      );
    });
    if (exact) return exact;
  }

  // 3. Ricerca parziale per nome articolo/scatola
  const lower = trimmed.toLowerCase();
  for (const load of loads) {
    const all = resolveAllTrackingRecordsForLoad(load, movements);
    const partial = all.find(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.code.toLowerCase().includes(lower)
    );
    if (partial) return partial;
  }

  return null;
}
