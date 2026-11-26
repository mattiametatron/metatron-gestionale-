import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  BOX_SPECS,
  BoxType,
  CargoBox,
  CargoLoad,
  CargoPallet,
  ChecklistItem,
  CrmContact,
  FinishingCartello,
  PALLET_SPECS,
  PurchaseOrder,
  WarehouseInventoryState,
  WarehouseStockItem,
} from '../types/warehouse';
import { LoadSummary } from './calculations';

// Configura worker PDF.js completamente locale (zero API, zero CDN)
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

// ============================================================================
// 1. MOTORE DI CLASSIFICAZIONE LOCALE (ARTICOLI, CATEGORIE, PESI, FRAGILITÀ)
// ============================================================================

interface CategoryRule {
  category: string;
  defaultUnit: string;
  defaultLocation: string;
  estimatedWeightKg: number;
  fragile: boolean;
  keywords: RegExp;
}

const INDUSTRIAL_CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Viteria & Fissaggi',
    defaultUnit: 'pz',
    defaultLocation: 'Scaffale A · Minuteria',
    estimatedWeightKg: 0.08,
    fragile: false,
    keywords:
      /\b(vit[ei]|bullon[ei]|dad[oi]|rondell[ae]|tassell[oi]|rivett[oi]|fissagg|chiav[ei]|perno|perni|brugol|m[4-9]|m1[0-6]|m20|din\s*\d+|iso\s*\d+|staff[ae])\b/i,
  },
  {
    category: 'Elettrica & Automazione',
    defaultUnit: 'pz',
    defaultLocation: 'Scaffale B · Elettrica',
    estimatedWeightKg: 0.45,
    fragile: true,
    keywords:
      /\b(cav[oi]|quadr[oi]|sensor[ei]|plc|rele|relè|interruttor|morsett|alimentator|inverter|led|lampad|display|sched[ae]|centralin|pulsant|connettor|spin[ae]|presa|prese|motore|fotocellul)\b/i,
  },
  {
    category: 'Vetro & Componenti Fragili',
    defaultUnit: 'pz',
    defaultLocation: 'Zona Protetta · Fragili',
    estimatedWeightKg: 2.2,
    fragile: true,
    keywords:
      /\b(vetr[oi]|cristall|specchi|ceramic|ottic|lent[ei]|scherm[oi]|monitor|fragil|plexiglass|policarbonat|porcellan)\b/i,
  },
  {
    category: 'Carpenteria & Profili',
    defaultUnit: 'pz',
    defaultLocation: 'Corsia C · Carpenteria',
    estimatedWeightKg: 4.5,
    fragile: false,
    keywords:
      /\b(profil[oi]|trave|travi|lamier[ae]|piastr[ae]|tub[oi]|tubolar|angolar|telaio|telai|struttur|mensol[ae]|montant[ei]|travers[oi]|pannell[oi]|cancello|ringhier|ferro|acciaio|alluminio|inox|zincat)\b/i,
  },
  {
    category: 'Idraulica & Pneumatica',
    defaultUnit: 'pz',
    defaultLocation: 'Scaffale D · Idraulica',
    estimatedWeightKg: 0.75,
    fragile: false,
    keywords:
      /\b(valvol[ae]|raccord[oi]|guarnizion|o-?ring|pomp[ae]|cilindr[oi]|pneumatic|idraulic|flessibil|manometr|filtr[oi]|rubinett|flangi[ae]|manicotto)\b/i,
  },
  {
    category: 'Verniciatura & Chimica',
    defaultUnit: 'litri',
    defaultLocation: 'Armadio E · Chimica',
    estimatedWeightKg: 1.5,
    fragile: true,
    keywords:
      /\b(vernic|smalt[oi]|diluent|primer|fond[oi]|silicon|coll[ae]|sigillant|oli[oi]|grass[oi]|spray|ral\s*\d{4}|resina|catalizzator)\b/i,
  },
  {
    category: 'Imballaggi & Protezioni',
    defaultUnit: 'rotoli',
    defaultLocation: 'Zona F · Imballo',
    estimatedWeightKg: 1.2,
    fragile: false,
    keywords:
      /\b(scatol[ae]|carton[ei]|nastr[oi]|scotch|film|estensibil|pluriball|bancal[ei]|epal|reggett|angolari\s*carton|etichett|sacch[ei]|polistirol)\b/i,
  },
  {
    category: 'Ricambi & Meccanica',
    defaultUnit: 'pz',
    defaultLocation: 'Scaffale G · Meccanica',
    estimatedWeightKg: 1.4,
    fragile: false,
    keywords:
      /\b(cuscinett|cinghi[ae]|ingranagg|puleggi[ae]|molla|molle|albero|bussol[ae]|giunt[oi]|riduttor|caten[ae]|guida|guide|carrell[oi]|ruot[ae]|ricambi)\b/i,
  },
];

// ============================================================================
// 1B. MEMORIA ADATTIVA LOCALE (IMPARA DALLE ABITUDINI DELL'OPERATORE)
// ============================================================================

const ADAPTIVE_MEMORY_KEY = 'metatron_adaptive_memory_v1';

export interface LearnedSkuEntry {
  sku: string;
  name?: string;
  category?: string;
  unit?: string;
  location?: string;
  supplier?: string;
  unitWeightKg?: number;
  fragile?: boolean;
  hits: number;
  updatedAt: string;
}

export interface LearnedTokenRule {
  categoryCounts: Record<string, number>;
  supplierCounts: Record<string, number>;
  locationCounts: Record<string, number>;
  unitCounts: Record<string, number>;
}

export interface AdaptiveMemoryStore {
  bySku: Record<string, LearnedSkuEntry>;
  byToken: Record<string, LearnedTokenRule>;
}

const STOPWORDS_IT = new Set([
  'con', 'per', 'del', 'della', 'delle', 'degli', 'dei', 'nel', 'nella', 'su',
  'da', 'di', 'in', 'a', 'e', 'o', 'il', 'lo', 'la', 'i', 'gli', 'le', 'un',
  'una', 'uno', 'art', 'articolo', 'cod', 'codice', 'pz', 'pezzi', 'tipo',
  'mod', 'modello', 'serie', 'nuovo', 'generale', 'materiale', 'standard',
]);

function normalizeMemoryKey(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function tokenizeDescription(text: string): string[] {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !/^\d+$/.test(t) && !STOPWORDS_IT.has(t))
    .slice(0, 8);
}

export function loadAdaptiveMemory(): AdaptiveMemoryStore {
  if (typeof window === 'undefined') return { bySku: {}, byToken: {} };
  try {
    const raw = localStorage.getItem(ADAPTIVE_MEMORY_KEY);
    if (!raw) return { bySku: {}, byToken: {} };
    const parsed = JSON.parse(raw);
    return {
      bySku: parsed?.bySku && typeof parsed.bySku === 'object' ? parsed.bySku : {},
      byToken: parsed?.byToken && typeof parsed.byToken === 'object' ? parsed.byToken : {},
    };
  } catch {
    return { bySku: {}, byToken: {} };
  }
}

function saveAdaptiveMemory(store: AdaptiveMemoryStore): void {
  if (typeof window === 'undefined') return;
  try {
    // Limita dimensione per mantenere localStorage leggero e velocissimo
    const skuEntries = Object.entries(store.bySku);
    if (skuEntries.length > 1200) {
      skuEntries.sort((a, b) => (b[1].updatedAt || '').localeCompare(a[1].updatedAt || ''));
      store.bySku = Object.fromEntries(skuEntries.slice(0, 1000));
    }
    const tokenEntries = Object.entries(store.byToken);
    if (tokenEntries.length > 800) {
      store.byToken = Object.fromEntries(tokenEntries.slice(0, 650));
    }
    localStorage.setItem(ADAPTIVE_MEMORY_KEY, JSON.stringify(store));
  } catch {
    // Ignora quota localStorage
  }
}

export function getAdaptiveMemoryStats(): { learnedSkus: number; learnedPatterns: number } {
  const mem = loadAdaptiveMemory();
  return {
    learnedSkus: Object.keys(mem.bySku).length,
    learnedPatterns: Object.keys(mem.byToken).length,
  };
}

export function learnItemPattern(input: {
  sku?: string;
  barcode?: string;
  name?: string;
  category?: string;
  unit?: string;
  location?: string;
  supplier?: string;
  unitWeightKg?: number;
  fragile?: boolean;
}): void {
  const store = loadAdaptiveMemory();
  const nowIso = new Date().toISOString();

  const cleanName = (input.name || '').trim();
  const isGenericName =
    !cleanName || /^articolo\s+/i.test(cleanName) || cleanName.length < 2;
  const cleanCat = (input.category || '').trim();
  const isUsefulCat =
    cleanCat.length >= 2 && cleanCat.toLowerCase() !== 'generale';
  const cleanLoc = (input.location || '').trim();
  const isUsefulLoc =
    cleanLoc.length >= 2 &&
    !['magazzino', 'magazzino generale', 'da classificare'].includes(
      cleanLoc.toLowerCase()
    );
  const cleanSup = (input.supplier || '').trim();
  const cleanUnit = (input.unit || '').trim();

  const keysToRecord = [input.sku, input.barcode]
    .map((k) => normalizeMemoryKey(k || ''))
    .filter((k) => k.length >= 2);

  for (const key of keysToRecord) {
    const prev = store.bySku[key];
    store.bySku[key] = {
      sku: (input.sku || input.barcode || prev?.sku || key).trim(),
      name: !isGenericName ? cleanName : prev?.name,
      category: isUsefulCat ? cleanCat : prev?.category,
      unit: cleanUnit || prev?.unit,
      location: isUsefulLoc ? cleanLoc : prev?.location,
      supplier: cleanSup || prev?.supplier,
      unitWeightKg:
        typeof input.unitWeightKg === 'number' && input.unitWeightKg > 0
          ? input.unitWeightKg
          : prev?.unitWeightKg,
      fragile:
        typeof input.fragile === 'boolean' ? input.fragile : prev?.fragile,
      hits: (prev?.hits || 0) + 1,
      updatedAt: nowIso,
    };
  }

  // Impara anche associazioni parola chiave -> categoria / fornitore / scaffale
  if (!isGenericName && (isUsefulCat || cleanSup || isUsefulLoc)) {
    const tokens = tokenizeDescription(cleanName);
    for (const tok of tokens) {
      const rule: LearnedTokenRule = store.byToken[tok] || {
        categoryCounts: {},
        supplierCounts: {},
        locationCounts: {},
        unitCounts: {},
      };
      if (isUsefulCat) {
        rule.categoryCounts[cleanCat] = (rule.categoryCounts[cleanCat] || 0) + 1;
      }
      if (cleanSup) {
        rule.supplierCounts[cleanSup] = (rule.supplierCounts[cleanSup] || 0) + 1;
      }
      if (isUsefulLoc) {
        rule.locationCounts[cleanLoc] = (rule.locationCounts[cleanLoc] || 0) + 1;
      }
      if (cleanUnit) {
        rule.unitCounts[cleanUnit] = (rule.unitCounts[cleanUnit] || 0) + 1;
      }
      store.byToken[tok] = rule;
    }
  }

  saveAdaptiveMemory(store);
}

export function seedAdaptiveMemoryFromInventory(items: WarehouseStockItem[]): void {
  if (!items || items.length === 0) return;
  const store = loadAdaptiveMemory();
  let changed = false;
  const nowIso = new Date().toISOString();

  for (const it of items) {
    const cleanCat = (it.category || '').trim();
    const isUsefulCat = cleanCat.length >= 2 && cleanCat.toLowerCase() !== 'generale';
    const cleanName = (it.name || '').trim();
    const isGenericName = !cleanName || /^articolo\s+/i.test(cleanName);
    if (isGenericName && !isUsefulCat && !it.supplier) continue;

    const skuKey = normalizeMemoryKey(it.sku);
    if (skuKey.length >= 2 && !store.bySku[skuKey]) {
      store.bySku[skuKey] = {
        sku: it.sku,
        name: !isGenericName ? cleanName : undefined,
        category: isUsefulCat ? cleanCat : undefined,
        unit: it.unit || undefined,
        location:
          it.location &&
          !['magazzino', 'da classificare'].includes(it.location.toLowerCase())
            ? it.location
            : undefined,
        supplier: it.supplier || undefined,
        hits: 1,
        updatedAt: it.updatedAt || nowIso,
      };
      changed = true;
    }

    if (!isGenericName && isUsefulCat) {
      const tokens = tokenizeDescription(cleanName);
      for (const tok of tokens) {
        const rule: LearnedTokenRule = store.byToken[tok] || {
          categoryCounts: {},
          supplierCounts: {},
          locationCounts: {},
          unitCounts: {},
        };
        if (!rule.categoryCounts[cleanCat]) {
          rule.categoryCounts[cleanCat] = 1;
          changed = true;
        }
        if (it.supplier && !rule.supplierCounts[it.supplier]) {
          rule.supplierCounts[it.supplier] = 1;
          changed = true;
        }
        store.byToken[tok] = rule;
      }
    }
  }

  if (changed) {
    saveAdaptiveMemory(store);
  }
}

export interface LearnedMatchResult {
  name?: string;
  category?: string;
  unit?: string;
  location?: string;
  supplier?: string;
  unitWeightKg?: number;
  fragile?: boolean;
  exactSkuMatch: boolean;
}

function pickTopScored(counts: Record<string, number>): string | undefined {
  let bestKey: string | undefined;
  let bestVal = 0;
  for (const [k, v] of Object.entries(counts)) {
    if (v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  }
  return bestKey;
}

export function lookupLearnedPattern(
  sku = '',
  nameOrText = ''
): LearnedMatchResult | null {
  const store = loadAdaptiveMemory();
  const skuKey = normalizeMemoryKey(sku);

  if (skuKey.length >= 2 && store.bySku[skuKey]) {
    const entry = store.bySku[skuKey];
    return {
      name: entry.name,
      category: entry.category,
      unit: entry.unit,
      location: entry.location,
      supplier: entry.supplier,
      unitWeightKg: entry.unitWeightKg,
      fragile: entry.fragile,
      exactSkuMatch: true,
    };
  }

  // Cerca per parole chiave apprese dalle abitudini dell'utente
  const tokens = tokenizeDescription(nameOrText);
  if (tokens.length === 0) return null;

  const catScores: Record<string, number> = {};
  const supScores: Record<string, number> = {};
  const locScores: Record<string, number> = {};
  const unitScores: Record<string, number> = {};
  let matchedAny = false;

  for (const tok of tokens) {
    const rule = store.byToken[tok];
    if (!rule) continue;
    matchedAny = true;
    for (const [k, v] of Object.entries(rule.categoryCounts)) {
      catScores[k] = (catScores[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(rule.supplierCounts)) {
      supScores[k] = (supScores[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(rule.locationCounts)) {
      locScores[k] = (locScores[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(rule.unitCounts)) {
      unitScores[k] = (unitScores[k] || 0) + v;
    }
  }

  if (!matchedAny) return null;
  const bestCat = pickTopScored(catScores);
  const bestSup = pickTopScored(supScores);
  const bestLoc = pickTopScored(locScores);
  const bestUnit = pickTopScored(unitScores);

  if (!bestCat && !bestSup && !bestLoc) return null;
  return {
    category: bestCat,
    supplier: bestSup,
    location: bestLoc,
    unit: bestUnit,
    exactSkuMatch: false,
  };
}

export interface InferredItemMeta {
  category: string;
  unit: string;
  location: string;
  estimatedWeightKg: number;
  fragile: boolean;
  learnedName?: string;
  learnedSupplier?: string;
  fromMemory?: boolean;
}

export function classifyItemLocally(
  nameOrText: string,
  sku = '',
  existingUserCategories: string[] = []
): InferredItemMeta {
  const combined = `${sku} ${nameOrText}`.trim();
  const combinedLower = combined.toLowerCase();

  // 0. Prima controlla la Memoria Adattiva appresa dalle scelte dell'operatore
  const learned = lookupLearnedPattern(sku, nameOrText);
  const baseIndustrial = INDUSTRIAL_CATEGORY_RULES.find((r) =>
    r.keywords.test(combined)
  );
  if (learned && (learned.category || learned.name || learned.supplier)) {
    return {
      category:
        learned.category ||
        baseIndustrial?.category ||
        existingUserCategories[0] ||
        'Generale',
      unit:
        learned.unit ||
        inferUnitFromText(combined) ||
        baseIndustrial?.defaultUnit ||
        'pz',
      location:
        learned.location ||
        baseIndustrial?.defaultLocation ||
        'Magazzino Generale',
      estimatedWeightKg:
        learned.unitWeightKg ?? baseIndustrial?.estimatedWeightKg ?? 1.0,
      fragile:
        learned.fragile ??
        baseIndustrial?.fragile ??
        /\b(fragil|vetr|display|sensor|elettronic|led)\b/i.test(combined),
      learnedName: learned.name,
      learnedSupplier: learned.supplier,
      fromMemory: true,
    };
  }

  // 1. Controlla se una categoria personalizzata dell'utente corrisponde per nome/radice
  for (const userCat of existingUserCategories) {
    const cleanCat = userCat.trim();
    if (cleanCat.length < 3) continue;
    const tokens = cleanCat
      .toLowerCase()
      .split(/[\s/&,-]+/)
      .filter((t) => t.length >= 4);
    if (tokens.some((tok) => combinedLower.includes(tok.slice(0, Math.max(4, tok.length - 1))))) {
      return {
        category: cleanCat,
        unit: baseIndustrial?.defaultUnit || inferUnitFromText(combined),
        location: baseIndustrial?.defaultLocation || `Settore ${cleanCat.slice(0, 18)}`,
        estimatedWeightKg: baseIndustrial?.estimatedWeightKg ?? 1.0,
        fragile:
          baseIndustrial?.fragile ??
          /\b(fragil|vetr|display|sensor|elettronic|led)\b/i.test(combined),
      };
    }
  }

  // 2. Regole industriali locali
  if (baseIndustrial) {
    return {
      category: baseIndustrial.category,
      unit: inferUnitFromText(combined) || baseIndustrial.defaultUnit,
      location: baseIndustrial.defaultLocation,
      estimatedWeightKg: baseIndustrial.estimatedWeightKg,
      fragile: baseIndustrial.fragile,
    };
  }

  // 3. Fallback pulito
  return {
    category: existingUserCategories[0] || 'Generale',
    unit: inferUnitFromText(combined) || 'pz',
    location: 'Magazzino Generale',
    estimatedWeightKg: 1.0,
    fragile: /\b(fragil|vetr|delicat|ottic)\b/i.test(combined),
  };
}

function inferUnitFromText(text: string): string {
  if (/\b(kg|chili|chilogramm)\b/i.test(text)) return 'kg';
  if (/\b(mt|metr[oi]|ml\b|barre?\s*\d+m)\b/i.test(text)) return 'm';
  if (/\b(lt|litr[oi]|tanic[ae]|lattin[ae])\b/i.test(text)) return 'litri';
  if (/\b(rotol[oi]|bobin[ae])\b/i.test(text)) return 'rotoli';
  if (/\b(kit|set|coppi[ae])\b/i.test(text)) return 'kit';
  if (/\b(scatol[ae]|conf\.?|confezion)\b/i.test(text)) return 'scatole';
  return 'pz';
}

export function autoClassifyWarehouseItems(
  items: WarehouseStockItem[],
  userCategories: string[] = []
): { nextItems: WarehouseStockItem[]; updatedCount: number; learnedAppliedCount: number } {
  // Alimenta prima la memoria con gli articoli già ben compilati dall'utente
  seedAdaptiveMemoryFromInventory(items);

  const nowIso = new Date().toISOString();
  let updatedCount = 0;
  let learnedAppliedCount = 0;

  const nextItems = items.map((item) => {
    const needsCategory =
      !item.category ||
      item.category.trim() === '' ||
      item.category.trim().toLowerCase() === 'generale';
    const needsLocation =
      !item.location ||
      item.location.trim() === '' ||
      item.location.trim().toLowerCase() === 'da classificare' ||
      item.location.trim().toLowerCase() === 'magazzino';
    const needsSupplier = !item.supplier || item.supplier.trim() === '';
    const isGenericName = /^articolo\s+/i.test(item.name || '');

    if (!needsCategory && !needsLocation && !needsSupplier && !isGenericName) return item;

    const inferred = classifyItemLocally(
      `${item.name} ${item.notes || ''}`,
      item.sku,
      userCategories
    );

    const nextName =
      isGenericName && inferred.learnedName ? inferred.learnedName : item.name;
    const nextCat = needsCategory ? inferred.category : item.category;
    const nextLoc = needsLocation ? inferred.location : item.location;
    const nextUnit = item.unit || inferred.unit;
    const nextSupplier =
      needsSupplier && inferred.learnedSupplier
        ? inferred.learnedSupplier
        : item.supplier;

    if (
      nextName !== item.name ||
      nextCat !== item.category ||
      nextLoc !== item.location ||
      nextUnit !== item.unit ||
      nextSupplier !== item.supplier
    ) {
      updatedCount += 1;
      if (inferred.fromMemory) learnedAppliedCount += 1;
      return {
        ...item,
        name: nextName,
        category: nextCat,
        location: nextLoc,
        unit: nextUnit,
        supplier: nextSupplier,
        updatedAt: nowIso,
      };
    }
    return item;
  });

  return { nextItems, updatedCount, learnedAppliedCount };
}

// ============================================================================
// 2. IMPORTATORE LOCALE UNIVERSALE (PDF, FOTO OCR, EXCEL/CSV, TESTO LIBERO)
// ============================================================================

export interface ParsedImportedItem {
  sku: string;
  name: string;
  quantity: number;
  unitWeightKg: number;
  category: string;
  fragile: boolean;
  notes: string;
}

export interface LocalDocumentParseResult {
  sourceType: 'pdf' | 'image' | 'excel' | 'text';
  fileName: string;
  detectedClient?: string;
  detectedCode?: string;
  detectedDestination?: string;
  items: ParsedImportedItem[];
  rawLinesCount: number;
}

function parseLocaleNum(raw: string, fallback: number): number {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^\d.,-]/g, '');
  if (!cleaned) return fallback;
  let norm = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    norm =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    norm = cleaned.replace(',', '.');
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : fallback;
}

const NOISE_LINE_REGEX =
  /^(pagina\s*\d+|pag\.?\s*\d+|totale|totali|subtotale|imponibile|iva\s*\d|p\.?\s*iva|cod\.?\s*fisc|iban|banca|tel\.|fax|www\.|http|firma|conducente|vettore|aspetto|causale|porto|data\s+documento|documento\s+di\s+trasporto|ddt\s*n|spett\.?le|destinatario|codice\s+descrizione|cod\.\s+art)/i;

export function extractStructuredItemsFromLines(
  lines: string[],
  userCategories: string[] = []
): {
  detectedClient?: string;
  detectedCode?: string;
  detectedDestination?: string;
  items: ParsedImportedItem[];
} {
  let detectedClient: string | undefined;
  let detectedCode: string | undefined;
  let detectedDestination: string | undefined;
  const items: ParsedImportedItem[] = [];
  let autoIdx = 1;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (line.length < 3) continue;

    // Estrai metadati intestazione (Cliente, Commessa, Destinazione)
    if (!detectedClient) {
      const mClient = line.match(
        /(?:spett\.?le|cliente|destinatario)\s*[:\-]?\s*(.{3,60})$/i
      );
      if (mClient && !/^\d+$/.test(mClient[1].trim())) {
        detectedClient = mClient[1].trim();
        continue;
      }
    }
    if (!detectedCode) {
      const mCode = line.match(
        /(?:commessa|ordine|rif\.?\s*ord|ddt\s*n\.?°?)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-/_]{2,20})/i
      );
      if (mCode) {
        detectedCode = mCode[1].trim().toUpperCase();
      }
    }
    if (!detectedDestination) {
      const mDest = line.match(
        /(?:destinazione|luogo\s+di\s+consegna|indirizzo)\s*[:\-]?\s*(.{4,70})$/i
      );
      if (mDest) {
        detectedDestination = mDest[1].trim();
        continue;
      }
    }

    if (NOISE_LINE_REGEX.test(line)) continue;
    // Salta righe composte solo da numeri/date/simboli
    if (/^[\d\s.,:/\-€$%]+$/.test(line)) continue;

    // 1. Formato separato da punto e virgola o tab (es. "SKU; Descrizione; 5; 2.4" oppure "Descrizione; 5; 2.4")
    if (line.includes(';') || line.includes('\t')) {
      const parts = line
        .split(/[;\t]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        let sku = '';
        let name = '';
        let qty = 1;
        let weight = 0;

        if (
          parts.length >= 3 &&
          /^[A-Z0-9][A-Z0-9\-_/.]{1,18}$/i.test(parts[0]) &&
          !/^\d+$/.test(parts[0])
        ) {
          sku = parts[0].toUpperCase();
          name = parts[1];
          qty = Math.max(1, Math.round(parseLocaleNum(parts[2], 1)));
          weight = parts[3] ? Math.max(0, parseLocaleNum(parts[3], 0)) : 0;
        } else {
          name = parts[0];
          qty = Math.max(1, Math.round(parseLocaleNum(parts[1], 1)));
          weight = parts[2] ? Math.max(0, parseLocaleNum(parts[2], 0)) : 0;
        }

        if (name.length >= 2) {
          const meta = classifyItemLocally(name, sku, userCategories);
          items.push({
            sku: sku || `AUTO-${String(autoIdx++).padStart(3, '0')}`,
            name,
            quantity: qty,
            unitWeightKg: weight > 0 ? weight : meta.estimatedWeightKg,
            category: meta.category,
            fragile: meta.fragile,
            notes: '',
          });
          continue;
        }
      }
    }

    // 2. Righe libere da PDF / OCR bolla (es. "ART-045 Staffa zincata 12 pz 1,5 kg" oppure "10x Bullone M12")
    let sku = '';
    let working = line;

    // Leading SKU (es. ART-001, COD_12, 004521A, M12-50)
    const skuMatch = working.match(
      /^([A-Z]{1,6}[-_/.]?\d{2,8}[A-Z0-9\-_]*|\d{4,13})\s+(.+)$/i
    );
    if (skuMatch && skuMatch[2].trim().length >= 3) {
      sku = skuMatch[1].toUpperCase();
      working = skuMatch[2].trim();
    }

    // Peso esplicito (es. "2,5 kg" / "12kg")
    let weightKg = 0;
    const weightMatch = working.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|chil[oi])\b/i);
    if (weightMatch) {
      weightKg = Math.max(0, parseLocaleNum(weightMatch[1], 0));
      working = working.replace(weightMatch[0], ' ').trim();
    }

    // Quantità esplicita (es. "x12", "12 pz", "q.tà 5", o numero finale isolato)
    let quantity = 1;
    const qtyExplicit =
      working.match(/\b(?:q\.?t[aà]|qty)\s*[:=]?\s*(\d+)/i) ||
      working.match(/(?:^|\s)[x×]\s*(\d+)\b/i) ||
      working.match(/\b(\d+)\s*(?:pz|pezzi|nr|n\.|conf|scatole?|rotol[oi]|kit|mt|m)\b/i) ||
      working.match(/^(\d+)\s*[x×]\s*/i);

    if (qtyExplicit) {
      quantity = Math.max(1, Math.min(99999, parseInt(qtyExplicit[1], 10) || 1));
      working = working.replace(qtyExplicit[0], ' ').trim();
    } else {
      // Numero intero isolato a fine riga (es. "Pannello zincato RAL 7016 24")
      const trailingNum = working.match(/\s+(\d{1,5})$/);
      if (trailingNum) {
        const val = parseInt(trailingNum[1], 10);
        if (val >= 1 && val <= 10000) {
          quantity = val;
          working = working.slice(0, trailingNum.index).trim();
        }
      }
    }

    const cleanName = working
      .replace(/^[\-•*·\d.)\s]+/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (cleanName.length < 3) continue;
    // Scarta righe chiaramente descrittive non articoli se non hanno né SKU né quantità rilevata
    if (!sku && !qtyExplicit && cleanName.split(' ').length > 14) continue;

    const meta = classifyItemLocally(cleanName, sku, userCategories);
    items.push({
      sku: sku || `IMP-${String(autoIdx++).padStart(3, '0')}`,
      name: cleanName.slice(0, 110),
      quantity,
      unitWeightKg: weightKg > 0 ? weightKg : meta.estimatedWeightKg,
      category: meta.category,
      fragile: meta.fragile,
      notes: '',
    });
  }

  return { detectedClient, detectedCode, detectedDestination, items };
}

async function extractTextLinesFromPdfFile(
  file: File,
  onProgress?: (pct: number, label: string) => void
): Promise<string[]> {
  onProgress?.(15, 'Lettura pagine PDF in locale...');
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const pct = 20 + Math.round((pageNum / Math.max(1, pdf.numPages)) * 65);
    onProgress?.(pct, `Analisi pagina ${pageNum} di ${pdf.numPages}...`);
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Raggruppa gli elementi testuali per coordinata Y per ricostruire righe tabellari reali
    const rowsByY = new Map<number, Array<{ x: number; text: string }>>();
    for (const rawItem of content.items) {
      const it = rawItem as { str?: string; transform?: number[] };
      const txt = (it.str || '').trim();
      if (!txt) continue;
      const x = it.transform ? it.transform[4] : 0;
      const y = it.transform ? Math.round(it.transform[5] / 4) * 4 : 0;
      const bucket = rowsByY.get(y) || [];
      bucket.push({ x, text: txt });
      rowsByY.set(y, bucket);
    }

    const sortedYs = Array.from(rowsByY.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const rowTokens = (rowsByY.get(y) || []).sort((a, b) => a.x - b.x);
      const lineText = rowTokens.map((t) => t.text).join(' ').trim();
      if (lineText) allLines.push(lineText);
    }
  }

  return allLines;
}

async function extractTextLinesFromImageFile(
  file: File,
  onProgress?: (pct: number, label: string) => void
): Promise<string[]> {
  onProgress?.(10, 'Avvio OCR ottico locale (senza API)...');
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(file, 'ita+eng', {
    logger: (m: { status?: string; progress?: number }) => {
      if (typeof m.progress === 'number') {
        const pct = Math.min(95, Math.max(12, Math.round(m.progress * 90)));
        onProgress?.(pct, 'Riconoscimento testo dalla foto in corso...');
      }
    },
  });
  const text = result?.data?.text || '';
  return text
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter(Boolean);
}

async function parseExcelFileItems(
  file: File,
  userCategories: string[] = []
): Promise<ParsedImportedItem[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  });
  if (matrix.length === 0) return [];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(matrix.length, 8); i++) {
    const nonEmpty = (matrix[i] || []).filter((c) => String(c ?? '').trim()).length;
    if (nonEmpty >= 2) {
      headerIdx = i;
      break;
    }
  }

  const headers = (matrix[headerIdx] || []).map((c) =>
    String(c ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );

  const findCol = (re: RegExp, exclude: number[] = []) =>
    headers.findIndex((h, idx) => !exclude.includes(idx) && re.test(h));

  const skuCol = findCol(/(sku|codice|cod\.|articolo|barcode|ref)/);
  const nameCol = findCol(
    /(descriz|material|nome|oggett|prodott|voce|item|desc)/,
    skuCol >= 0 ? [skuCol] : []
  );
  const qtyCol = findCol(
    /(quantit|q\.?ta|qty|pezzi|pz\b)/,
    [skuCol, nameCol].filter((x) => x >= 0)
  );
  const weightCol = findCol(
    /(peso|weight|\bkg\b)/,
    [skuCol, nameCol, qtyCol].filter((x) => x >= 0)
  );
  const notesCol = findCol(
    /(note|osserv|comment)/,
    [skuCol, nameCol, qtyCol, weightCol].filter((x) => x >= 0)
  );

  const effectiveNameCol =
    nameCol >= 0 ? nameCol : headers.findIndex((_, i) => i !== skuCol && i !== qtyCol);

  const items: ParsedImportedItem[] = [];
  let autoIdx = 1;
  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const row = (matrix[r] || []).map((c) => String(c ?? '').trim());
    const sku = skuCol >= 0 ? row[skuCol] || '' : '';
    const name = effectiveNameCol >= 0 ? row[effectiveNameCol] || '' : '';
    if (!sku && !name) continue;
    if (/^total[ei]/i.test(sku || name)) continue;
    const qty = qtyCol >= 0 ? Math.max(1, Math.round(parseLocaleNum(row[qtyCol], 1))) : 1;
    const w = weightCol >= 0 ? Math.max(0, parseLocaleNum(row[weightCol], 0)) : 0;
    const notes = notesCol >= 0 ? row[notesCol] || '' : '';
    const meta = classifyItemLocally(name || sku, sku, userCategories);

    items.push({
      sku: sku || `XLS-${String(autoIdx++).padStart(3, '0')}`,
      name: name || sku,
      quantity: qty,
      unitWeightKg: w > 0 ? w : meta.estimatedWeightKg,
      category: meta.category,
      fragile: meta.fragile,
      notes,
    });
  }

  return items;
}

export async function parseDocumentLocally(
  file: File,
  userCategories: string[] = [],
  onProgress?: (pct: number, label: string) => void
): Promise<LocalDocumentParseResult> {
  const lowerName = file.name.toLowerCase();

  if (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.xlsm') ||
    lowerName.endsWith('.csv') ||
    lowerName.endsWith('.ods') ||
    lowerName.endsWith('.tsv')
  ) {
    onProgress?.(40, 'Lettura foglio Excel...');
    const items = await parseExcelFileItems(file, userCategories);
    onProgress?.(100, 'Completato');
    return {
      sourceType: 'excel',
      fileName: file.name,
      items,
      rawLinesCount: items.length,
    };
  }

  if (lowerName.endsWith('.pdf') || file.type === 'application/pdf') {
    const lines = await extractTextLinesFromPdfFile(file, onProgress);
    onProgress?.(92, 'Strutturazione articoli e quantità...');
    const parsed = extractStructuredItemsFromLines(lines, userCategories);
    onProgress?.(100, 'Completato');
    return {
      sourceType: 'pdf',
      fileName: file.name,
      ...parsed,
      rawLinesCount: lines.length,
    };
  }

  if (
    file.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp|gif)$/i.test(lowerName)
  ) {
    const lines = await extractTextLinesFromImageFile(file, onProgress);
    onProgress?.(96, 'Estrazione codici e quantità...');
    const parsed = extractStructuredItemsFromLines(lines, userCategories);
    onProgress?.(100, 'Completato');
    return {
      sourceType: 'image',
      fileName: file.name,
      ...parsed,
      rawLinesCount: lines.length,
    };
  }

  // Testo semplice (.txt)
  const rawText = await file.text();
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim());
  const parsed = extractStructuredItemsFromLines(lines, userCategories);
  onProgress?.(100, 'Completato');
  return {
    sourceType: 'text',
    fileName: file.name,
    ...parsed,
    rawLinesCount: lines.length,
  };
}

// ============================================================================
// 3. MOTORE DI AUTO-IMBALLAGGIO SCATOLE, BANCALI & BILANCIAMENTO CAMION (FFD)
// ============================================================================

export function autoBalanceTruckSlotsForLoad(load: CargoLoad): CargoLoad {
  if (load.pallets.length === 0) return load;
  const maxSlots = Math.max(2, load.vehicleMaxPallets || 18);

  // Calcola peso lordo reale per ogni bancale
  const palletWeights = load.pallets.map((p) => {
    const pBoxes = load.boxes.filter((b) => b.palletId === p.id);
    const pBoxIds = new Set(pBoxes.map((b) => b.id));
    const pItems = load.items.filter(
      (i) => i.palletId === p.id || (i.boxId && pBoxIds.has(i.boxId))
    );
    const calc =
      p.tareKg +
      pBoxes.reduce((s, b) => s + (b.tareKg || 0), 0) +
      pItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitWeightKg || 0), 0);
    const gross =
      p.customWeightKg !== undefined && p.customWeightKg !== null
        ? p.customWeightKg
        : calc;
    return { pallet: p, gross };
  });

  // Ordina dal più pesante al più leggero (i più pesanti verso la cabina, bilanciando SX/DX)
  palletWeights.sort((a, b) => b.gross - a.gross);

  const slotAssignments = new Map<string, number | null>();
  let leftTotal = 0;
  let rightTotal = 0;
  let nextLeftSlot = 1; // dispari: 1, 3, 5...
  let nextRightSlot = 2; // pari: 2, 4, 6...

  for (const { pallet, gross } of palletWeights) {
    const canLeft = nextLeftSlot <= maxSlots;
    const canRight = nextRightSlot <= maxSlots;
    if (!canLeft && !canRight) {
      slotAssignments.set(pallet.id, null);
      continue;
    }
    if (canLeft && (!canRight || leftTotal <= rightTotal)) {
      slotAssignments.set(pallet.id, nextLeftSlot);
      leftTotal += gross;
      nextLeftSlot += 2;
    } else {
      slotAssignments.set(pallet.id, nextRightSlot);
      rightTotal += gross;
      nextRightSlot += 2;
    }
  }

  return {
    ...load,
    pallets: load.pallets.map((p) => ({
      ...p,
      truckSlot: slotAssignments.get(p.id) ?? null,
    })),
  };
}

export function autoPackAndBalanceLoad(load: CargoLoad): {
  nextLoad: CargoLoad;
  createdBoxes: number;
  createdPallets: number;
  assignedItems: number;
} {
  const now = Date.now();
  const nowIso = new Date().toISOString();

  const pallets: CargoPallet[] = load.pallets.map((p) => ({ ...p }));
  const boxes: CargoBox[] = load.boxes.map((b) => ({ ...b }));
  const items: ChecklistItem[] = load.items.map((i) => ({ ...i }));

  const unassignedIndices = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => !it.boxId && !it.palletId);

  if (unassignedIndices.length === 0) {
    // Anche se già tutto posizionato, bilancia comunque il camion
    return {
      nextLoad: autoBalanceTruckSlotsForLoad(load),
      createdBoxes: 0,
      createdPallets: 0,
      assignedItems: 0,
    };
  }

  let nextPalletNum = pallets.length + 1;
  let nextBoxNum = boxes.length + 1;
  let createdBoxes = 0;
  let createdPallets = 0;

  const ensurePalletForWeight = (neededKg: number): CargoPallet => {
    const SAFE_RATIO = 0.88;
    // Cerca bancale esistente con spazio peso sufficiente (preferendo quello meno carico per bilanciare)
    let best: CargoPallet | null = null;
    let bestWeight = Infinity;

    for (const p of pallets) {
      const pBoxes = boxes.filter((b) => b.palletId === p.id);
      const pBoxIds = new Set(pBoxes.map((b) => b.id));
      const pItems = items.filter(
        (i) => i.palletId === p.id || (i.boxId && pBoxIds.has(i.boxId))
      );
      const curW =
        p.tareKg +
        pBoxes.reduce((s, b) => s + b.tareKg, 0) +
        pItems.reduce((s, i) => s + i.quantity * i.unitWeightKg, 0);
      if (curW + neededKg <= p.maxWeightKg * SAFE_RATIO && curW < bestWeight) {
        best = p;
        bestWeight = curW;
      }
    }

    if (best) return best;

    const spec = PALLET_SPECS.EPAL_80x120;
    const newPallet: CargoPallet = {
      id: `pal-auto-${now}-${createdPallets + 1}`,
      code: `BANC-${String(nextPalletNum++).padStart(2, '0')}`,
      label: `Bancale Auto #${pallets.length + 1}`,
      palletType: 'EPAL_80x120',
      dimensionsCm: spec.dimensionsCm,
      heightCm: 145,
      tareKg: spec.tareKg,
      maxWeightKg: spec.defaultMaxKg,
      wrapped: false,
      truckSlot: null,
      notes: 'Preparato automaticamente',
      loadedAt: nowIso,
    };
    pallets.push(newPallet);
    createdPallets += 1;
    return newPallet;
  };

  // Ordina gli articoli non assegnati: prima non fragili dal più pesante, poi fragili
  const sortedUnassigned = [...unassignedIndices].sort((a, b) => {
    if (a.it.fragile !== b.it.fragile) return a.it.fragile ? 1 : -1;
    const wA = a.it.quantity * Math.max(0.1, a.it.unitWeightKg);
    const wB = b.it.quantity * Math.max(0.1, b.it.unitWeightKg);
    return wB - wA;
  });

  // Traccia peso corrente per ogni scatola
  const boxWeightMap = new Map<string, number>();
  boxes.forEach((b) => {
    const bItems = items.filter((i) => i.boxId === b.id);
    const w = bItems.reduce((s, i) => s + i.quantity * i.unitWeightKg, 0);
    boxWeightMap.set(b.id, w);
  });

  for (const { it, idx } of sortedUnassigned) {
    const itemTotalW = Math.max(0.1, it.quantity * (it.unitWeightKg || 0.5));

    // Articolo molto pesante (> 35 kg): fuori scatola direttamente su bancale
    if (itemTotalW > 35 && !it.fragile) {
      const targetPallet = ensurePalletForWeight(itemTotalW);
      items[idx] = {
        ...it,
        palletId: targetPallet.id,
        boxId: null,
        loadedAt: it.loadedAt || nowIso,
      };
      continue;
    }

    // Trova una scatola compatibile (stessa fragilità, non sigillata, entro 85% maxWeightKg)
    let chosenBox = boxes.find((b) => {
      if (b.sealed) return false;
      if (Boolean(b.fragile) !== Boolean(it.fragile)) return false;
      const curW = boxWeightMap.get(b.id) || 0;
      return curW + itemTotalW <= b.maxWeightKg * 0.85;
    });

    if (!chosenBox) {
      const boxType: BoxType = it.fragile
        ? 'M_60x40x40'
        : itemTotalW > 18
        ? 'L_80x60x50'
        : itemTotalW > 8
        ? 'M_60x40x40'
        : 'S_40x30x30';
      const spec = BOX_SPECS[boxType];
      const targetPallet = ensurePalletForWeight(itemTotalW + spec.tareKg);
      const stackLevel: 1 | 2 | 3 = it.fragile ? 3 : itemTotalW > 12 ? 1 : 2;

      chosenBox = {
        id: `box-auto-${now}-${createdBoxes + 1}`,
        code: `SC-${String(nextBoxNum++).padStart(2, '0')}`,
        label: it.fragile
          ? `Fragili · ${it.category || 'Protetti'}`
          : `${it.category || 'Materiale'} #${boxes.length + 1}`,
        boxType,
        dimensionsCm: spec.dimensionsCm,
        tareKg: spec.tareKg,
        maxWeightKg: spec.defaultMaxKg,
        palletId: targetPallet.id,
        parentBoxId: null,
        sealed: false,
        fragile: Boolean(it.fragile),
        stackLevel,
        loadedAt: nowIso,
      };
      boxes.push(chosenBox);
      boxWeightMap.set(chosenBox.id, 0);
      createdBoxes += 1;
    }

    items[idx] = {
      ...it,
      palletId: chosenBox.palletId,
      boxId: chosenBox.id,
      loadedAt: it.loadedAt || nowIso,
    };
    boxWeightMap.set(
      chosenBox.id,
      (boxWeightMap.get(chosenBox.id) || 0) + itemTotalW
    );
  }

  const packedLoad: CargoLoad = {
    ...load,
    loadedAt: load.loadedAt || nowIso,
    pallets,
    boxes,
    items,
  };

  return {
    nextLoad: autoBalanceTruckSlotsForLoad(packedLoad),
    createdBoxes,
    createdPallets,
    assignedItems: unassignedIndices.length,
  };
}

// ============================================================================
// 4. CONTROLLO ERRORI SILENZIOSO (AUDIT SPEDIZIONE) & CARTELLI AUTOMATICI
// ============================================================================

export type AuditFixAction =
  | 'auto_pack'
  | 'balance_truck'
  | 'fix_fragile_levels'
  | 'fill_missing_weights';

export interface CommessaAuditIssue {
  id: string;
  severity: 'error' | 'warning';
  title: string;
  detail: string;
  fixAction?: AuditFixAction;
  fixLabel?: string;
}

export function auditCargoLoad(
  load: CargoLoad,
  summary: LoadSummary
): CommessaAuditIssue[] {
  const issues: CommessaAuditIssue[] = [];

  // 1. Articoli non ancora collocati
  const unassignedCount = load.items.filter((i) => !i.boxId && !i.palletId).length;
  if (unassignedCount > 0) {
    issues.push({
      id: 'unassigned_items',
      severity: 'warning',
      title: `${unassignedCount} articoli non ancora imballati`,
      detail:
        'Non sono assegnati a nessuna scatola o bancale. Puoi prepararli e bilanciarli in un clic.',
      fixAction: 'auto_pack',
      fixLabel: 'Imballa & Bilancia Auto',
    });
  }

  // 2. Sovraccarico mezzo
  if (summary.totalGrossWeightKg > load.vehicleMaxWeightKg) {
    issues.push({
      id: 'vehicle_overweight',
      severity: 'error',
      title: `Sovraccarico mezzo (+${Math.round(
        summary.totalGrossWeightKg - load.vehicleMaxWeightKg
      )} kg)`,
      detail: `Peso lordo totale ${summary.totalGrossWeightKg.toFixed(
        0
      )} kg superiore alla portata (${load.vehicleMaxWeightKg} kg).`,
    });
  }

  // 3. Bancali non caricati sul camion o camion sbilanciato SX/DX
  const palletsOffTruck = load.pallets.filter((p) => p.truckSlot === null).length;
  let leftKg = 0;
  let rightKg = 0;
  summary.palletSummaries.forEach((ps) => {
    if (ps.pallet.truckSlot) {
      if (ps.pallet.truckSlot % 2 === 1) leftKg += ps.grossWeightKg;
      else rightKg += ps.grossWeightKg;
    }
  });
  const positionedKg = leftKg + rightKg;
  const imbalancePct =
    positionedKg > 0
      ? Math.round((Math.abs(leftKg - rightKg) / positionedKg) * 100)
      : 0;

  if (palletsOffTruck > 0 || (load.pallets.length >= 2 && imbalancePct > 18)) {
    issues.push({
      id: 'truck_balance',
      severity: 'warning',
      title:
        palletsOffTruck > 0
          ? `${palletsOffTruck} bancali ancora fuori dal piano camion`
          : `Camion sbilanciato SX/DX (${imbalancePct}% di scarto)`,
      detail:
        'Posiziona e bilancia automaticamente i bancali per distribuire il peso in modo uniforme.',
      fixAction: 'balance_truck',
      fixLabel: 'Bilancia Camion',
    });
  }

  // 4. Scatole o bancali in sovrappeso
  const overloadedPallets = summary.palletSummaries.filter(
    (ps) => ps.grossWeightKg > ps.pallet.maxWeightKg
  );
  if (overloadedPallets.length > 0) {
    issues.push({
      id: 'overloaded_pallets',
      severity: 'error',
      title: `${overloadedPallets.length} bancali oltre il limite di portata`,
      detail: `Controlla: ${overloadedPallets.map((p) => p.pallet.code).join(', ')}.`,
    });
  }

  // 5. Articoli fragili su livello 1 (sotto carico)
  const riskyFragileBoxes = load.boxes.filter((b) => {
    const hasFragileItem =
      b.fragile || load.items.some((i) => i.boxId === b.id && i.fragile);
    return hasFragileItem && b.stackLevel === 1;
  });
  if (riskyFragileBoxes.length > 0) {
    issues.push({
      id: 'fragile_bottom',
      severity: 'warning',
      title: `${riskyFragileBoxes.length} scatole fragili posizionate alla base`,
      detail: `Sposta ${riskyFragileBoxes
        .map((b) => b.code)
        .join(', ')} sul livello superiore (livello 3) per evitare schiacciamenti.`,
      fixAction: 'fix_fragile_levels',
      fixLabel: 'Proteggi Fragili',
    });
  }

  // 6. Articoli con peso 0 kg
  const zeroWeightItems = load.items.filter(
    (i) => !i.unitWeightKg || i.unitWeightKg <= 0
  ).length;
  if (zeroWeightItems > 0) {
    issues.push({
      id: 'missing_weights',
      severity: 'warning',
      title: `${zeroWeightItems} articoli con peso unitario a 0 kg`,
      detail:
        'Puoi stimare automaticamente i pesi mancanti per calcoli più accurati di bancali e DDT.',
      fixAction: 'fill_missing_weights',
      fixLabel: 'Stima Pesi Auto',
    });
  }

  return issues;
}

const RAL_HEX_LOOKUP: Record<string, { name: string; hex: string }> = {
  '7016': { name: 'GRIGIO ANTRACITE', hex: '#383E42' },
  '7035': { name: 'GRIGIO LUCE', hex: '#CBD0CC' },
  '9005': { name: 'NERO INTENSO', hex: '#0E0E10' },
  '9010': { name: 'BIANCO PURO', hex: '#F7F9EF' },
  '9006': { name: 'ALLUMINIO BRILLANTE', hex: '#A1A1A0' },
  '7040': { name: 'GRIGIO FINESTRA', hex: '#989EA1' },
  '3000': { name: 'ROSSO FUOCO', hex: '#A72920' },
  '1021': { name: 'GIALLO COLZA', hex: '#F6B600' },
  '5015': { name: 'BLU CIELO', hex: '#007CB0' },
  '5010': { name: 'BLU GENZIANA', hex: '#004F7C' },
  '6005': { name: 'VERDE MUSCHIO', hex: '#114232' },
  '8017': { name: 'MARRONE CIOCCOLATO', hex: '#442F29' },
};

export function detectFinishingTagsFromLoad(
  load: CargoLoad
): Array<Omit<FinishingCartello, 'id' | 'createdAt'>> {
  const existingKeys = new Set(
    (load.finishingTags || []).map((t) => t.treatmentText.trim().toUpperCase())
  );
  const grouped = new Map<
    string,
    { treatmentText: string; hex: string | null; finish: string; pieces: number; pallets: Set<string> }
  >();

  const palletCodeById = new Map(load.pallets.map((p) => [p.id, p.code]));
  const boxPalletById = new Map(load.boxes.map((b) => [b.id, b.palletId]));

  for (const item of load.items) {
    const text = `${item.name} ${item.notes || ''} ${item.category || ''}`;
    const resolvedPalletId =
      item.palletId || (item.boxId ? boxPalletById.get(item.boxId) || null : null);
    const palletCode = resolvedPalletId ? palletCodeById.get(resolvedPalletId) : undefined;

    let key = '';
    let treatmentText = '';
    let hex: string | null = null;
    let finish = 'Standard';

    const ralMatch = text.match(/ral\s*([0-9]{4})/i);
    if (ralMatch) {
      const code = ralMatch[1];
      const info = RAL_HEX_LOOKUP[code];
      treatmentText = info ? `RAL ${code} ${info.name}` : `RAL ${code}`;
      hex = info?.hex || '#64748b';
      finish = /opac|matt/i.test(text)
        ? 'Opaco (Matt)'
        : /lucid|gloss/i.test(text)
        ? 'Lucido (Gloss)'
        : 'Polvere Epossipoliestere';
      key = treatmentText.toUpperCase();
    } else if (/zincat[oa]\s+a\s+caldo/i.test(text)) {
      treatmentText = 'ZINCATO A CALDO';
      hex = '#cbd5e1';
      finish = 'Zincatura a Caldo UNI EN ISO 1461';
      key = treatmentText;
    } else if (/elettrozincat|zincat/i.test(text)) {
      treatmentText = 'ELETTROZINCATO BIANCO';
      hex = '#e2e8f0';
      finish = 'Passivazione Bianca Cr3+';
      key = treatmentText;
    } else if (/cataforesi/i.test(text)) {
      treatmentText = 'CATAFORESI NERA';
      hex = '#1e293b';
      finish = 'Immersione Cataforesi';
      key = treatmentText;
    } else if (/sabbiatur/i.test(text)) {
      treatmentText = 'SABBIATURA SA 2.5 + FONDO EPOSSIDICO';
      hex = '#a8a29e';
      finish = 'Fondo Antiruggine';
      key = treatmentText;
    } else if (/decapagg|inox/i.test(text)) {
      treatmentText = 'DECAPAGGIO E PASSIVAZIONE INOX';
      hex = '#f1f5f9';
      finish = 'Acciaio Inox';
      key = treatmentText;
    }

    if (!key || existingKeys.has(key)) continue;

    const bucket = grouped.get(key) || {
      treatmentText,
      hex,
      finish,
      pieces: 0,
      pallets: new Set<string>(),
    };
    bucket.pieces += item.quantity || 1;
    if (palletCode) bucket.pallets.add(palletCode);
    grouped.set(key, bucket);
  }

  return Array.from(grouped.values()).map((g) => ({
    commessaCode: load.code,
    commessaTitle: load.title,
    clientName: load.client || undefined,
    treatmentText: g.treatmentText,
    swatchHex: g.hex,
    finishType: g.finish,
    quantityOrPieces: `${g.pieces} pz${
      g.pallets.size > 0 ? ` · ${g.pallets.size} bancali` : ''
    }`,
    palletCode: Array.from(g.pallets).join(', ') || undefined,
    deliveryDate: load.departureDate || undefined,
    notes: 'Rilevato automaticamente dagli articoli della commessa',
    layoutFormat: 'a4_landscape',
    fontScale: 'large',
    showSignatures: true,
    showColorBanner: true,
    showItemsList: true,
  }));
}

// ============================================================================
// 5. NUOVA COMMESSA "ZERO-CLICK" DA FILE TRASCINATO (PDF / EXCEL / FOTO)
// ============================================================================

export interface ZeroClickCommessaResult {
  load: CargoLoad;
  fileName: string;
  sourceType: LocalDocumentParseResult['sourceType'];
  itemsCount: number;
  totalPieces: number;
  boxesCount: number;
  palletsCount: number;
  finishingTagsCount: number;
  matchedFromMemoryCount: number;
}

export async function buildZeroClickCommessaFromFile(
  file: File,
  existingLoads: CargoLoad[],
  inventory: WarehouseInventoryState,
  contacts: CrmContact[] = [],
  onProgress?: (pct: number, label: string) => void
): Promise<ZeroClickCommessaResult> {
  seedAdaptiveMemoryFromInventory(inventory.items);

  onProgress?.(10, `Analisi di "${file.name}" in corso...`);
  const parsed = await parseDocumentLocally(
    file,
    inventory.categories || [],
    (pct, lbl) => onProgress?.(Math.min(62, Math.round(pct * 0.62)), lbl)
  );

  if (parsed.items.length === 0) {
    throw new Error(
      'Nessun articolo riconosciuto nel file. Prova con un Excel, un PDF tabellare o una foto più nitida.'
    );
  }

  onProgress?.(72, 'Applicazione memoria abitudini e creazione commessa...');
  const now = Date.now();
  const nowIso = new Date().toISOString();

  // Arricchisci ogni riga con memoria adattiva e catalogo magazzino
  let matchedFromMemoryCount = 0;
  const stockBySku = new Map<string, WarehouseStockItem>();
  inventory.items.forEach((it) => {
    const k = normalizeMemoryKey(it.sku);
    if (k) stockBySku.set(k, it);
    if (it.barcode) {
      const bk = normalizeMemoryKey(it.barcode);
      if (bk) stockBySku.set(bk, it);
    }
  });

  const checklistItems: ChecklistItem[] = parsed.items.map((raw, idx) => {
    const skuKey = normalizeMemoryKey(raw.sku);
    const catalogHit = skuKey ? stockBySku.get(skuKey) : undefined;
    const learned = lookupLearnedPattern(raw.sku, raw.name);
    if (learned || catalogHit) matchedFromMemoryCount += 1;

    const finalName =
      learned?.exactSkuMatch && learned.name
        ? learned.name
        : catalogHit?.name && /^articolo\s+/i.test(raw.name)
        ? catalogHit.name
        : raw.name;
    const finalCat =
      (learned?.category && learned.category !== 'Generale' ? learned.category : '') ||
      (catalogHit?.category && catalogHit.category !== 'Generale' ? catalogHit.category : '') ||
      raw.category ||
      'Generale';
    const finalWeight =
      raw.unitWeightKg > 0
        ? raw.unitWeightKg
        : learned?.unitWeightKg ?? 1.0;

    return {
      id: `itm-zc-${now}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      sku: raw.sku || `ZC-${String(idx + 1).padStart(3, '0')}`,
      name: finalName,
      category: finalCat,
      quantity: Math.max(1, raw.quantity || 1),
      unitWeightKg: Math.max(0.05, finalWeight),
      checked: false,
      fragile: learned?.fragile ?? raw.fragile,
      palletId: null,
      boxId: null,
      notes: raw.notes || '',
      loadedAt: nowIso,
    };
  });

  // Ricava titolo, codice e cliente dalla bolla o dal nome file
  const baseFileName = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const candidateCode =
    parsed.detectedCode ||
    `COM-${String(existingLoads.length + 1).padStart(3, '0')}`;
  const codeAlreadyUsed = existingLoads.some(
    (l) => l.code.trim().toUpperCase() === candidateCode.toUpperCase()
  );
  const finalCode = codeAlreadyUsed
    ? `${candidateCode}-${String(existingLoads.length + 1).padStart(2, '0')}`
    : candidateCode;

  // Se il cliente rilevato esiste in Rubrica CRM, compila anche destinazione e vettore
  const matchedContact = parsed.detectedClient
    ? contacts.find((c) =>
        c.companyName
          .toLowerCase()
          .includes(parsed.detectedClient!.toLowerCase().slice(0, 12))
      )
    : undefined;

  const clientName =
    matchedContact?.companyName ||
    parsed.detectedClient ||
    'Cliente da file';
  const destination =
    parsed.detectedDestination ||
    matchedContact?.shippingAddress ||
    [matchedContact?.billingAddress, matchedContact?.city]
      .filter(Boolean)
      .join(', ') ||
    'Destinazione da confermare';

  const draftLoad: CargoLoad = {
    id: `load-zc-${now}`,
    code: finalCode,
    title: baseFileName || `Commessa ${finalCode}`,
    client: clientName,
    destination,
    carrier: matchedContact?.defaultCarrier || 'Motrice 12 EPAL',
    departureDate: nowIso.slice(0, 10),
    vehicleMaxPallets: 18,
    vehicleMaxWeightKg: 12000,
    status: 'in_preparazione',
    pallets: [],
    boxes: [],
    items: checklistItems,
    signatures: [],
    finishingTags: [],
    loadedAt: nowIso,
  };

  onProgress?.(84, 'Imballaggio automatico scatole, bancali e bilanciamento camion...');
  const packed = autoPackAndBalanceLoad(draftLoad);

  onProgress?.(94, 'Rilevamento cartelli RAL/Zincatura e codici QR...');
  const detectedTags = detectFinishingTagsFromLoad(packed.nextLoad);
  const finishingTags: FinishingCartello[] = detectedTags.map((t, i) => ({
    ...t,
    id: `tag-zc-${now}-${i}`,
    createdAt: nowIso,
  }));

  const finalLoad: CargoLoad = {
    ...packed.nextLoad,
    finishingTags,
  };

  const totalPieces = finalLoad.items.reduce((s, i) => s + (i.quantity || 0), 0);
  onProgress?.(100, 'Commessa Zero-Click pronta');

  return {
    load: finalLoad,
    fileName: file.name,
    sourceType: parsed.sourceType,
    itemsCount: finalLoad.items.length,
    totalPieces,
    boxesCount: finalLoad.boxes.length,
    palletsCount: finalLoad.pallets.length,
    finishingTagsCount: finishingTags.length,
    matchedFromMemoryCount,
  };
}

// ============================================================================
// 6. ANTIDIMENTICANZA BASATO SULLE COMMESSE PASSATE (CO-OCCORRENZA LOCALE)
// ============================================================================

export interface ForgottenItemSuggestion {
  signatureKey: string;
  sku: string;
  name: string;
  category: string;
  typicalQty: number;
  unitWeightKg: number;
  fragile: boolean;
  coOccurrenceCount: number;
  similarLoadsCount: number;
  confidencePct: number;
  reason: string;
}

function getItemSignature(item: Pick<ChecklistItem, 'sku' | 'name'>): string {
  const cleanSku = normalizeMemoryKey(item.sku);
  // Se è uno SKU generico tipo ART001 / IMP001 / CHK001 / ZC001 usa le parole della descrizione
  const isAutoSku = /^(ART|IMP|CHK|XLS|ZC|AUTO)\d+$/.test(cleanSku);
  if (cleanSku.length >= 3 && !isAutoSku) {
    return `SKU:${cleanSku}`;
  }
  const tokens = tokenizeDescription(item.name).slice(0, 4).sort();
  if (tokens.length > 0) {
    return `TXT:${tokens.join('_')}`;
  }
  return `RAW:${(item.name || item.sku || '').trim().toLowerCase()}`;
}

export function findForgottenItemsForLoad(
  activeLoad: CargoLoad,
  allLoads: CargoLoad[],
  maxSuggestions = 4
): ForgottenItemSuggestion[] {
  if (!activeLoad || activeLoad.items.length === 0) return [];
  const pastLoads = allLoads.filter(
    (l) => l.id !== activeLoad.id && l.items.length >= 2
  );
  if (pastLoads.length === 0) return [];

  const activeSigs = new Set<string>();
  const activeTokens = new Set<string>();
  const activeNameBySig = new Map<string, string>();

  for (const it of activeLoad.items) {
    const sig = getItemSignature(it);
    activeSigs.add(sig);
    activeNameBySig.set(sig, it.name);
    tokenizeDescription(it.name).forEach((t) => activeTokens.add(t));
  }

  // Trova commesse passate affini (condividono almeno 1 articolo esatto o >= 2 parole chiave materiale)
  const similarLoads: Array<{
    load: CargoLoad;
    overlapWeight: number;
    matchedTriggerName: string;
  }> = [];

  for (const past of pastLoads) {
    let exactOverlap = 0;
    let triggerName = '';
    const pastTokens = new Set<string>();

    for (const it of past.items) {
      const sig = getItemSignature(it);
      if (activeSigs.has(sig)) {
        exactOverlap += 1;
        if (!triggerName) triggerName = activeNameBySig.get(sig) || it.name;
      }
      tokenizeDescription(it.name).forEach((t) => pastTokens.add(t));
    }

    let tokenOverlap = 0;
    pastTokens.forEach((t) => {
      if (activeTokens.has(t)) tokenOverlap += 1;
    });

    const sameClient =
      activeLoad.client &&
      past.client &&
      activeLoad.client.trim().toLowerCase() === past.client.trim().toLowerCase();

    if (exactOverlap >= 1 || tokenOverlap >= 2 || (sameClient && tokenOverlap >= 1)) {
      similarLoads.push({
        load: past,
        overlapWeight: exactOverlap * 3 + tokenOverlap + (sameClient ? 2 : 0),
        matchedTriggerName:
          triggerName ||
          (sameClient ? `spedizioni per ${past.client}` : 'materiali simili'),
      });
    }
  }

  if (similarLoads.length === 0) return [];

  // Aggrega gli articoli presenti nelle commesse simili ma ASSENTI nella commessa corrente
  const candidates = new Map<
    string,
    {
      sample: ChecklistItem;
      count: number;
      qtySum: number;
      scoreSum: number;
      triggerLabel: string;
    }
  >();

  for (const sim of similarLoads) {
    const seenInThisLoad = new Set<string>();
    for (const it of sim.load.items) {
      const sig = getItemSignature(it);
      if (activeSigs.has(sig) || seenInThisLoad.has(sig)) continue;
      seenInThisLoad.add(sig);

      const entry = candidates.get(sig) || {
        sample: it,
        count: 0,
        qtySum: 0,
        scoreSum: 0,
        triggerLabel: sim.matchedTriggerName,
      };
      entry.count += 1;
      entry.qtySum += Math.max(1, it.quantity || 1);
      entry.scoreSum += sim.overlapWeight;
      candidates.set(sig, entry);
    }
  }

  const totalSimilar = similarLoads.length;
  const results: ForgottenItemSuggestion[] = [];

  for (const [sig, data] of candidates.entries()) {
    const ratio = data.count / totalSimilar;
    // Se abbiamo >= 2 commesse simili, richiedi almeno 50% di presenza; se ce n'è 1 sola molto affine (overlapWeight >= 4), suggerisci comunque i compagni principali
    const qualifies =
      (totalSimilar >= 2 && data.count >= 2 && ratio >= 0.45) ||
      (totalSimilar === 1 && data.scoreSum >= 4);

    if (!qualifies) continue;

    const confidencePct = Math.min(98, Math.round(ratio * 100));
    results.push({
      signatureKey: sig,
      sku: data.sample.sku,
      name: data.sample.name,
      category: data.sample.category || 'Generale',
      typicalQty: Math.max(1, Math.round(data.qtySum / data.count)),
      unitWeightKg: data.sample.unitWeightKg || 0.5,
      fragile: Boolean(data.sample.fragile),
      coOccurrenceCount: data.count,
      similarLoadsCount: totalSimilar,
      confidencePct,
      reason:
        data.count > 1
          ? `Presente in ${data.count} commesse simili con "${data.triggerLabel}"`
          : `Di solito spedito insieme a "${data.triggerLabel}"`,
    });
  }

  return results
    .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount || b.confidencePct - a.confidencePct)
    .slice(0, maxSuggestions);
}

// ============================================================================
// 7. MAGAZZINO PREDITTIVO (PREVISIONE ESAURIMENTO & CONSUMI REALI)
// ============================================================================

export interface PredictiveStockAlert {
  item: WarehouseStockItem;
  currentStock: number;
  minStock: number;
  pendingOrderQty: number;
  committedInOpenLoads: number;
  projectedStockAfterLoads: number;
  avgWeeklyConsumption: number;
  daysUntilStockout: number | null;
  leadTimeDays: number;
  recommendedOrderQty: number;
  urgency: 'critico' | 'in_esaurimento';
  reason: string;
  isAlreadyLowStock: boolean;
}

export function computePredictiveStockForecast(
  inventory: WarehouseInventoryState,
  loads: CargoLoad[],
  orders: PurchaseOrder[],
  contacts: CrmContact[] = []
): PredictiveStockAlert[] {
  const nowMs = Date.now();
  const LOOKBACK_DAYS = 45;
  const lookbackStartMs = nowMs - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;

  // 1. Calcola consumi reali (scarichi) negli ultimi 45 giorni
  const outboundQtyByItemId = new Map<string, number>();
  const outboundQtyBySku = new Map<string, number>();
  let oldestMovMs = nowMs;

  for (const mov of inventory.movements) {
    if (mov.type !== 'scarico') continue;
    const t = Date.parse(mov.timestamp);
    if (!Number.isFinite(t) || t < lookbackStartMs) continue;
    if (t < oldestMovMs) oldestMovMs = t;

    const q = Math.max(0, mov.quantity || 0);
    outboundQtyByItemId.set(
      mov.itemId,
      (outboundQtyByItemId.get(mov.itemId) || 0) + q
    );
    const skuKey = normalizeMemoryKey(mov.sku);
    if (skuKey) {
      outboundQtyBySku.set(skuKey, (outboundQtyBySku.get(skuKey) || 0) + q);
    }
  }

  const activeWindowDays = Math.max(
    7,
    Math.min(LOOKBACK_DAYS, Math.ceil((nowMs - oldestMovMs) / (24 * 60 * 60 * 1000)) || 14)
  );

  // 2. Calcola fabbisogno impegnato dalle commesse aperte non ancora spedite
  const committedBySku = new Map<string, number>();
  for (const ld of loads) {
    if (ld.status === 'caricato' || ld.shippedAt) continue;
    for (const it of ld.items) {
      if (it.shippedAt) continue;
      const skuKey = normalizeMemoryKey(it.sku);
      if (!skuKey) continue;
      committedBySku.set(skuKey, (committedBySku.get(skuKey) || 0) + Math.max(0, it.quantity || 0));
    }
  }

  // 3. Calcola quantità già in arrivo da ordini fornitori aperti
  const pendingByItemId = new Map<string, number>();
  const pendingBySku = new Map<string, number>();
  for (const po of orders) {
    if (po.status === 'ricevuto' || po.status === 'annullato') continue;
    for (const line of po.items) {
      const pending = Math.max(0, (line.orderedQty || 0) - (line.receivedQty || 0));
      if (pending <= 0) continue;
      if (line.inventoryItemId) {
        pendingByItemId.set(
          line.inventoryItemId,
          (pendingByItemId.get(line.inventoryItemId) || 0) + pending
        );
      }
      const skuKey = normalizeMemoryKey(line.sku);
      if (skuKey) {
        pendingBySku.set(skuKey, (pendingBySku.get(skuKey) || 0) + pending);
      }
    }
  }

  // 4. Mappa tempi di consegna fornitori dal CRM
  const leadTimeBySupplier = new Map<string, number>();
  contacts.forEach((c) => {
    if (c.companyName && c.leadTimeDays && c.leadTimeDays > 0) {
      leadTimeBySupplier.set(c.companyName.trim().toLowerCase(), c.leadTimeDays);
    }
  });

  const alerts: PredictiveStockAlert[] = [];

  for (const item of inventory.items) {
    const skuKey = normalizeMemoryKey(item.sku);
    const barKey = item.barcode ? normalizeMemoryKey(item.barcode) : '';

    const outboundTotal = Math.max(
      outboundQtyByItemId.get(item.id) || 0,
      skuKey ? outboundQtyBySku.get(skuKey) || 0 : 0
    );
    const dailyRate = outboundTotal / activeWindowDays;
    const avgWeeklyConsumption = Math.round(dailyRate * 7 * 10) / 10;

    const committedInOpenLoads =
      (skuKey ? committedBySku.get(skuKey) || 0 : 0) ||
      (barKey ? committedBySku.get(barKey) || 0 : 0);

    const pendingOrderQty = Math.max(
      pendingByItemId.get(item.id) || 0,
      skuKey ? pendingBySku.get(skuKey) || 0 : 0
    );

    const leadTimeDays =
      (item.supplier
        ? leadTimeBySupplier.get(item.supplier.trim().toLowerCase())
        : undefined) || 5;

    const effectiveStock = item.quantity + pendingOrderQty;
    const projectedStockAfterLoads = effectiveStock - committedInOpenLoads;
    const daysUntilStockout =
      dailyRate > 0.05
        ? Math.max(0, Math.floor(Math.max(0, projectedStockAfterLoads) / dailyRate))
        : null;

    const isAlreadyLowStock = item.quantity <= item.minStock;
    const shortForOpenLoads =
      committedInOpenLoads > 0 && projectedStockAfterLoads < Math.max(1, item.minStock);
    const runsOutSoon =
      daysUntilStockout !== null && daysUntilStockout <= leadTimeDays + 10;

    if (!isAlreadyLowStock && !shortForOpenLoads && !runsOutSoon) continue;

    // Quantità consigliata: copre commesse aperte + 21 giorni di consumo + scorta minima
    const cover21Days = Math.ceil(dailyRate * 21);
    const targetLevel = Math.max(
      item.minStock * 2,
      item.minStock + committedInOpenLoads + cover21Days,
      committedInOpenLoads + 5,
      10
    );
    const recommendedOrderQty = Math.max(1, Math.ceil(targetLevel - effectiveStock));

    let urgency: 'critico' | 'in_esaurimento' = 'in_esaurimento';
    let reason = '';

    if (item.quantity <= 0) {
      urgency = 'critico';
      reason =
        committedInOpenLoads > 0
          ? `Esaurito a 0 · servono ${committedInOpenLoads} ${item.unit} per commesse attive`
          : 'Giacenza esaurita a 0 in magazzino';
    } else if (projectedStockAfterLoads < 0) {
      urgency = 'critico';
      reason = `Mancano ${Math.abs(projectedStockAfterLoads)} ${item.unit} per coprire le commesse aperte`;
    } else if (isAlreadyLowStock) {
      urgency = 'critico';
      reason =
        daysUntilStockout !== null
          ? `Sotto scorta minima · al ritmo attuale (~${avgWeeklyConsumption}/sett) finisce in ${daysUntilStockout} gg`
          : `Sotto scorta minima (${item.quantity}/${item.minStock} ${item.unit})`;
    } else if (shortForOpenLoads) {
      urgency = 'in_esaurimento';
      reason = `Dopo le commesse aperte restano solo ${projectedStockAfterLoads} ${item.unit} (min. ${item.minStock})`;
    } else if (daysUntilStockout !== null) {
      urgency = daysUntilStockout <= leadTimeDays ? 'critico' : 'in_esaurimento';
      reason = `Al ritmo attuale (~${avgWeeklyConsumption} ${item.unit}/sett) finisce tra ${daysUntilStockout} giorni`;
    }

    alerts.push({
      item,
      currentStock: item.quantity,
      minStock: item.minStock,
      pendingOrderQty,
      committedInOpenLoads,
      projectedStockAfterLoads,
      avgWeeklyConsumption,
      daysUntilStockout,
      leadTimeDays,
      recommendedOrderQty,
      urgency,
      reason,
      isAlreadyLowStock,
    });
  }

  return alerts.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === 'critico' ? -1 : 1;
    const dA = a.daysUntilStockout ?? 999;
    const dB = b.daysUntilStockout ?? 999;
    if (dA !== dB) return dA - dB;
    return a.projectedStockAfterLoads - b.projectedStockAfterLoads;
  });
}
