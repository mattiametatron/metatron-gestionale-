import zlib from 'node:zlib';

// ============================================================================
// METATRON — Motore Locale & Zero-API-Key per Traduzioni, PDF & Autopilota
// Funziona al 100% SENZA alcuna API key esterna (né Gemini né altro),
// sia in cloud sia in versione Desktop Windows locale/offline.
// ============================================================================

const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 4000;

function setCache(key: string, val: string) {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey !== undefined) translationCache.delete(firstKey);
  }
  translationCache.set(key, val);
}

// ============================================================================
// 1. ESTRAZIONE TESTO DA PDF SERVER-SIDE (Zero dipendenze esterne, usa zlib)
// ============================================================================
export function extractTextFromPdfBase64(base64Data: string): string {
  if (!base64Data) return '';
  try {
    const buf = Buffer.from(base64Data, 'base64');
    const rawLatin1 = buf.toString('latin1');
    const chunks: string[] = [];

    const extractFromTextStream = (content: string) => {
      // (stringa) Tj / ' / "
      const tjRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*(?:Tj|'|")/g;
      let m: RegExpExecArray | null;
      while ((m = tjRegex.exec(content)) !== null) {
        const cleaned = decodePdfEscapes(m[1]).trim();
        if (cleaned && /[a-zA-Z0-9À-ÿ]/.test(cleaned)) {
          chunks.push(cleaned);
        }
      }

      // [ (a) -20 (b) ] TJ
      const arrRegex = /\[([\s\S]*?)\]\s*TJ/g;
      while ((m = arrRegex.exec(content)) !== null) {
        const inner = m[1];
        const parts: string[] = [];
        const pReg = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
        let pm: RegExpExecArray | null;
        while ((pm = pReg.exec(inner)) !== null) {
          parts.push(decodePdfEscapes(pm[1]));
        }
        const joined = parts.join('').trim();
        if (joined && /[a-zA-Z0-9À-ÿ]/.test(joined)) {
          chunks.push(joined);
        }
      }
    };

    extractFromTextStream(rawLatin1);

    // Decomprimi flussi FlateDecode se pochi testi in chiaro
    if (chunks.join(' ').length < 80) {
      const streamRegex = /stream\r?\n/g;
      let sm: RegExpExecArray | null;
      while ((sm = streamRegex.exec(rawLatin1)) !== null) {
        const start = sm.index + sm[0].length;
        const end = rawLatin1.indexOf('endstream', start);
        if (end <= start || end - start > 4 * 1024 * 1024) continue;
        const slice = buf.subarray(start, end);
        // Trim trailing CR/LF
        let trimmed = slice;
        while (
          trimmed.length > 0 &&
          (trimmed[trimmed.length - 1] === 10 || trimmed[trimmed.length - 1] === 13)
        ) {
          trimmed = trimmed.subarray(0, trimmed.length - 1);
        }
        if (trimmed.length < 4) continue;
        let inflated: Buffer | null = null;
        try {
          inflated = zlib.inflateSync(trimmed);
        } catch {
          try {
            inflated = zlib.inflateRawSync(trimmed);
          } catch {
            inflated = null;
          }
        }
        if (inflated) {
          const text = inflated.toString('latin1');
          extractFromTextStream(text);
        }
      }
    }

    return chunks
      .join('\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

function decodePdfEscapes(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '')
    .replace(/\\t/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// ============================================================================
// 2. TRADUTTORE ZERO-API-KEY (9 LINGUE + PROTEZIONE CODICI SKU/RAL/MISURE)
// ============================================================================

// Dizionario tecnico-industriale multilingua 100% offline (fallback garantito anche senza internet)
const OFFLINE_TECH_DICT: Array<{
  it: RegExp;
  tx: Record<string, string>;
}> = [
  {
    it: /\bquadro elettrico\b/gi,
    tx: {
      en: 'Electrical Panel',
      de: 'Schaltschrank',
      fr: 'Armoire Électrique',
      es: 'Cuadro Eléctrico',
      pt: 'Quadro Elétrico',
      nl: 'Schakelkast',
      pl: 'Szafa Elektryczna',
      ro: 'Tablou Electric',
    },
  },
  {
    it: /\bquadri elettrici\b/gi,
    tx: {
      en: 'Electrical Panels',
      de: 'Schaltschränke',
      fr: 'Armoires Électriques',
      es: 'Cuadros Eléctricos',
      pt: 'Quadros Elétricos',
      nl: 'Schakelkasten',
      pl: 'Szafy Elektryczne',
      ro: 'Tablouri Electrice',
    },
  },
  {
    it: /\bpannelli coibentati\b/gi,
    tx: {
      en: 'Insulated Panels',
      de: 'Isolierpaneele',
      fr: 'Panneaux Isolants',
      es: 'Paneles Aislantes',
      pt: 'Painéis Isolantes',
      nl: 'Geïsoleerde Panelen',
      pl: 'Panele Izolowane',
      ro: 'Panouri Izolate',
    },
  },
  {
    it: /\bpannello\b/gi,
    tx: {
      en: 'Panel',
      de: 'Paneel',
      fr: 'Panneau',
      es: 'Panel',
      pt: 'Painel',
      nl: 'Paneel',
      pl: 'Panel',
      ro: 'Panou',
    },
  },
  {
    it: /\bpannelli\b/gi,
    tx: {
      en: 'Panels',
      de: 'Paneele',
      fr: 'Panneaux',
      es: 'Paneles',
      pt: 'Painéis',
      nl: 'Panelen',
      pl: 'Panele',
      ro: 'Panouri',
    },
  },
  {
    it: /\bverniciatura a polvere\b/gi,
    tx: {
      en: 'Powder Coating',
      de: 'Pulverbeschichtung',
      fr: 'Thermolaquage',
      es: 'Pintura en Polvo',
      pt: 'Pintura a Pó',
      nl: 'Poedercoating',
      pl: 'Malowanie Proszkowe',
      ro: 'Vopsire în Câmp Electrostatic',
    },
  },
  {
    it: /\bverniciatura\b/gi,
    tx: {
      en: 'Painting / Coating',
      de: 'Lackierung',
      fr: 'Peinture',
      es: 'Pintura',
      pt: 'Pintura',
      nl: 'Lakwerk',
      pl: 'Malowanie',
      ro: 'Vopsire',
    },
  },
  {
    it: /\bzincatura a caldo\b/gi,
    tx: {
      en: 'Hot-Dip Galvanizing',
      de: 'Feuerverzinkung',
      fr: 'Galvanisation à Chaud',
      es: 'Galvanizado en Caliente',
      pt: 'Galvanização a Quente',
      nl: 'Thermisch Verzinken',
      pl: 'Cynkowanie Ogniowe',
      ro: 'Zincare Termică',
    },
  },
  {
    it: /\bzincatura\b/gi,
    tx: {
      en: 'Galvanizing',
      de: 'Verzinkung',
      fr: 'Galvanisation',
      es: 'Galvanizado',
      pt: 'Galvanização',
      nl: 'Verzinken',
      pl: 'Cynkowanie',
      ro: 'Zincare',
    },
  },
  {
    it: /\bzincato\b/gi,
    tx: {
      en: 'Galvanized',
      de: 'Verzinkt',
      fr: 'Galvanisé',
      es: 'Galvanizado',
      pt: 'Galvanizado',
      nl: 'Verzinkt',
      pl: 'Ocynkowany',
      ro: 'Zincat',
    },
  },
  {
    it: /\bzincati\b/gi,
    tx: {
      en: 'Galvanized',
      de: 'Verzinkt',
      fr: 'Galvanisés',
      es: 'Galvanizados',
      pt: 'Galvanizados',
      nl: 'Verzinkt',
      pl: 'Ocynkowane',
      ro: 'Zincați',
    },
  },
  {
    it: /\bacciaio inox\b/gi,
    tx: {
      en: 'Stainless Steel',
      de: 'Edelstahl',
      fr: 'Acier Inoxydable',
      es: 'Acero Inoxidable',
      pt: 'Aço Inoxidável',
      nl: 'Roestvrij Staal',
      pl: 'Stal Nierdzewna',
      ro: 'Oțel Inoxidabil',
    },
  },
  {
    it: /\bacciaio\b/gi,
    tx: {
      en: 'Steel',
      de: 'Stahl',
      fr: 'Acier',
      es: 'Acero',
      pt: 'Aço',
      nl: 'Staal',
      pl: 'Stal',
      ro: 'Oțel',
    },
  },
  {
    it: /\balluminio\b/gi,
    tx: {
      en: 'Aluminum',
      de: 'Aluminium',
      fr: 'Aluminium',
      es: 'Aluminio',
      pt: 'Alumínio',
      nl: 'Aluminium',
      pl: 'Aluminium',
      ro: 'Aluminiu',
    },
  },
  {
    it: /\bstaffe\b/gi,
    tx: {
      en: 'Brackets',
      de: 'Halterungen',
      fr: 'Supports',
      es: 'Soportes',
      pt: 'Suportes',
      nl: 'Beugels',
      pl: 'Uchwyty',
      ro: 'Console / Suporturi',
    },
  },
  {
    it: /\bstaffa\b/gi,
    tx: {
      en: 'Bracket',
      de: 'Halterung',
      fr: 'Support',
      es: 'Soporte',
      pt: 'Suporte',
      nl: 'Beugel',
      pl: 'Uchwyt',
      ro: 'Suport',
    },
  },
  {
    it: /\bprofili\b/gi,
    tx: {
      en: 'Profiles',
      de: 'Profile',
      fr: 'Profilés',
      es: 'Perfiles',
      pt: 'Perfis',
      nl: 'Profielen',
      pl: 'Profile',
      ro: 'Profile',
    },
  },
  {
    it: /\bprofilo\b/gi,
    tx: {
      en: 'Profile',
      de: 'Profil',
      fr: 'Profilé',
      es: 'Perfil',
      pt: 'Perfil',
      nl: 'Profiel',
      pl: 'Profil',
      ro: 'Profil',
    },
  },
  {
    it: /\bviti\b/gi,
    tx: {
      en: 'Screws',
      de: 'Schrauben',
      fr: 'Vis',
      es: 'Tornillos',
      pt: 'Parafusos',
      nl: 'Schroeven',
      pl: 'Śruby',
      ro: 'Șuruburi',
    },
  },
  {
    it: /\bbulloni\b/gi,
    tx: {
      en: 'Bolts',
      de: 'Bolzen / Schrauben',
      fr: 'Boulons',
      es: 'Pernos',
      pt: 'Parafusos',
      nl: 'Bouten',
      pl: 'Śruby',
      ro: 'Bulon / Șuruburi',
    },
  },
  {
    it: /\bguarnizioni\b/gi,
    tx: {
      en: 'Gaskets / Seals',
      de: 'Dichtungen',
      fr: 'Joints',
      es: 'Juntas',
      pt: 'Juntas / Vedações',
      nl: 'Afdichtingen',
      pl: 'Uszczelki',
      ro: 'Garnituri',
    },
  },
  {
    it: /\bcerniere\b/gi,
    tx: {
      en: 'Hinges',
      de: 'Scharniere',
      fr: 'Charnières',
      es: 'Bisagras',
      pt: 'Dobradiças',
      nl: 'Scharnieren',
      pl: 'Zawiasy',
      ro: 'Balamale',
    },
  },
  {
    it: /\bmotoriduttori\b/gi,
    tx: {
      en: 'Gearmotors',
      de: 'Getriebemotoren',
      fr: 'Motoréducteurs',
      es: 'Motorreductores',
      pt: 'Motoredutores',
      nl: 'Motorreductoren',
      pl: 'Motoreduktory',
      ro: 'Motoreductoare',
    },
  },
  {
    it: /\bmotore\b/gi,
    tx: {
      en: 'Motor',
      de: 'Motor',
      fr: 'Moteur',
      es: 'Motor',
      pt: 'Motor',
      nl: 'Motor',
      pl: 'Silnik',
      ro: 'Motor',
    },
  },
  {
    it: /\bcavi\b/gi,
    tx: {
      en: 'Cables',
      de: 'Kabel',
      fr: 'Câbles',
      es: 'Cables',
      pt: 'Cabos',
      nl: 'Kabels',
      pl: 'Kable',
      ro: 'Cabluri',
    },
  },
  {
    it: /\bcavo\b/gi,
    tx: {
      en: 'Cable',
      de: 'Kabel',
      fr: 'Câble',
      es: 'Cable',
      pt: 'Cabo',
      nl: 'Kabel',
      pl: 'Kabel',
      ro: 'Cablu',
    },
  },
  {
    it: /\bfotocellule\b/gi,
    tx: {
      en: 'Safety Photocells',
      de: 'Lichtschranken',
      fr: 'Photocellules',
      es: 'Fotocélulas',
      pt: 'Fotocélulas',
      nl: 'Fotocellen',
      pl: 'Fotokomórki',
      ro: 'Fotocelule',
    },
  },
  {
    it: /\bsensori\b/gi,
    tx: {
      en: 'Sensors',
      de: 'Sensoren',
      fr: 'Capteurs',
      es: 'Sensores',
      pt: 'Sensores',
      nl: 'Sensoren',
      pl: 'Czujniki',
      ro: 'Senzori',
    },
  },
  {
    it: /\bricambi\b/gi,
    tx: {
      en: 'Spare Parts',
      de: 'Ersatzteile',
      fr: 'Pièces de Rechange',
      es: 'Repuestos',
      pt: 'Peças de Reposição',
      nl: 'Reserveonderdelen',
      pl: 'Części Zamienne',
      ro: 'Piese de Schimb',
    },
  },
  {
    it: /\bbancali\b/gi,
    tx: {
      en: 'Pallets',
      de: 'Paletten',
      fr: 'Palettes',
      es: 'Palets',
      pt: 'Paletes',
      nl: 'Pallets',
      pl: 'Palety',
      ro: 'Paleți',
    },
  },
  {
    it: /\bbancale\b/gi,
    tx: {
      en: 'Pallet',
      de: 'Palette',
      fr: 'Palette',
      es: 'Palet',
      pt: 'Palete',
      nl: 'Pallet',
      pl: 'Paleta',
      ro: 'Palet',
    },
  },
  {
    it: /\bscatole\b/gi,
    tx: {
      en: 'Boxes',
      de: 'Kartons',
      fr: 'Cartons',
      es: 'Cajas',
      pt: 'Caixas',
      nl: 'Dozen',
      pl: 'Kartony',
      ro: 'Cutii',
    },
  },
  {
    it: /\bscatola\b/gi,
    tx: {
      en: 'Box',
      de: 'Karton',
      fr: 'Carton',
      es: 'Caja',
      pt: 'Caixa',
      nl: 'Doos',
      pl: 'Karton',
      ro: 'Cutie',
    },
  },
  {
    it: /\bfragile\b/gi,
    tx: {
      en: 'Fragile',
      de: 'Zerbrechlich',
      fr: 'Fragile',
      es: 'Frágil',
      pt: 'Frágil',
      nl: 'Breekbaar',
      pl: 'Ostrożnie / Kruche',
      ro: 'Fragil',
    },
  },
  {
    it: /\bfasciato\b/gi,
    tx: {
      en: 'Stretch Wrapped',
      de: 'Foliert',
      fr: 'Filmé',
      es: 'Enfilmado',
      pt: 'Enfaixado',
      nl: 'Gewikkeld',
      pl: 'Owinięty Folią',
      ro: 'Înfoliat',
    },
  },
  {
    it: /\bsigillato\b/gi,
    tx: {
      en: 'Sealed',
      de: 'Versiegelt',
      fr: 'Scellé',
      es: 'Precintado',
      pt: 'Selado',
      nl: 'Verzegeld',
      pl: 'Zaplombowany',
      ro: 'Sigilat',
    },
  },
  {
    it: /\bfornitura\b/gi,
    tx: {
      en: 'Supply',
      de: 'Lieferung',
      fr: 'Fourniture',
      es: 'Suministro',
      pt: 'Fornecimento',
      nl: 'Levering',
      pl: 'Dostawa',
      ro: 'Furnizare',
    },
  },
  {
    it: /\bspedizione\b/gi,
    tx: {
      en: 'Shipment',
      de: 'Sendung',
      fr: 'Expédition',
      es: 'Envío',
      pt: 'Expedição',
      nl: 'Zending',
      pl: 'Wysyłka',
      ro: 'Expediere',
    },
  },
  {
    it: /\bvendita\b/gi,
    tx: {
      en: 'Sale',
      de: 'Verkauf',
      fr: 'Vente',
      es: 'Venta',
      pt: 'Venda',
      nl: 'Verkoop',
      pl: 'Sprzedaż',
      ro: 'Vânzare',
    },
  },
  {
    it: /\bconto lavorazione\b/gi,
    tx: {
      en: 'Subcontract Processing',
      de: 'Lohnbearbeitung',
      fr: 'Travail à Façon',
      es: 'Maquila / Subcontratación',
      pt: 'Subcontratação',
      nl: 'Loonwerk',
      pl: 'Obróbka Usługowa',
      ro: 'Prelucrare în Lohn',
    },
  },
  {
    it: /\bbonifico\b/gi,
    tx: {
      en: 'Bank Transfer',
      de: 'Überweisung',
      fr: 'Virement Bancaire',
      es: 'Transferencia Bancaria',
      pt: 'Transferência Bancária',
      nl: 'Bankoverschrijving',
      pl: 'Przelew Bankowy',
      ro: 'Transfer Bancar',
    },
  },
  {
    it: /\bfranco\b/gi,
    tx: {
      en: 'Prepaid / Free',
      de: 'Frei Haus',
      fr: 'Franco',
      es: 'Portes Pagados',
      pt: 'Franco',
      nl: 'Franco',
      pl: 'Opłacony',
      ro: 'Franco',
    },
  },
  {
    it: /\bassegnato\b/gi,
    tx: {
      en: 'Freight Collect',
      de: 'Unfrei',
      fr: 'Port Dû',
      es: 'Portes Debidos',
      pt: 'Frete a Pagar',
      nl: 'Ongefrankeerd',
      pl: 'Na Koszt Odbiorcy',
      ro: 'Plată la Destinație',
    },
  },
  {
    it: /\bpronto\b/gi,
    tx: {
      en: 'In Stock',
      de: 'Auf Lager',
      fr: 'En Stock',
      es: 'En Stock',
      pt: 'Em Stock',
      nl: 'Op Voorraad',
      pl: 'Dostępny',
      ro: 'În Stoc',
    },
  },
  {
    it: /\bmateriale\b/gi,
    tx: {
      en: 'Material',
      de: 'Material',
      fr: 'Matériel',
      es: 'Material',
      pt: 'Material',
      nl: 'Materiaal',
      pl: 'Materiał',
      ro: 'Material',
    },
  },
  {
    it: /\bopaco\b/gi,
    tx: {
      en: 'Matte',
      de: 'Matt',
      fr: 'Mat',
      es: 'Mate',
      pt: 'Fosco',
      nl: 'Mat',
      pl: 'Matowy',
      ro: 'Mat',
    },
  },
  {
    it: /\blucido\b/gi,
    tx: {
      en: 'Glossy',
      de: 'Glänzend',
      fr: 'Brillant',
      es: 'Brillante',
      pt: 'Brilhante',
      nl: 'Glanzend',
      pl: 'Połysk',
      ro: 'Lucios',
    },
  },
  {
    it: /\bbucciato\b/gi,
    tx: {
      en: 'Textured',
      de: 'Strukturiert',
      fr: 'Texturé',
      es: 'Texturizado',
      pt: 'Texturizado',
      nl: 'Structuur',
      pl: 'Strukturalny',
      ro: 'Texturat',
    },
  },
];

export function translateTextOfflineDict(text: string, targetLang: string): string {
  if (!text || targetLang === 'it') return text;
  let out = text;
  for (const entry of OFFLINE_TECH_DICT) {
    const rep = entry.tx[targetLang];
    if (!rep) continue;
    out = out.replace(entry.it, (match) => {
      if (match === match.toUpperCase() && match !== match.toLowerCase()) {
        return rep.toUpperCase();
      }
      return rep;
    });
  }
  return out;
}

/**
 * Protegge codici SKU, RAL, misure, voltaggi e codici alfanumerici con token
 * così il traduttore pubblico non altera mai codici di magazzino.
 */
function protectTechnicalTokens(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const pattern =
    /\b(?:RAL\s*\d{4}|(?:SKU|PLT|BOX|ART|COMM|DDT|ODA|PRV|QR|MT)[A-Z0-9\-_]{1,}|IP\d{2}|M\d{1,2}|\d+(?:[.,]\d+)?\s*(?:x|×)\s*\d+(?:[.,]\d+)?(?:\s*(?:x|×)\s*\d+(?:[.,]\d+)?)?\s*(?:mm|cm|m)?|\d+\/\d+\s*V)\b/gi;

  const masked = text.replace(pattern, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `ZZTOK${idx}ZZ`;
  });
  return { masked, tokens };
}

function restoreTechnicalTokens(text: string, tokens: string[]): string {
  return text.replace(/ZZTOK(\d+)ZZ/gi, (_, idxStr) => {
    const idx = Number(idxStr);
    return tokens[idx] !== undefined ? tokens[idx] : '';
  });
}

async function translateChunkViaPublicEndpoint(
  chunkTexts: string[],
  targetLang: string
): Promise<string[] | null> {
  const DELIM = ' |||MTSEP||| ';
  const maskedItems = chunkTexts.map((t) => protectTechnicalTokens(t));
  const joined = maskedItems.map((m) => m.masked).join(DELIM);

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(joined)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const json: any = await res.json();
    if (!Array.isArray(json) || !Array.isArray(json[0])) return null;

    const fullTranslated = json[0]
      .map((seg: any) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('');

    const parts = fullTranslated.split(/\s*\|\|\|\s*MTSEP\s*\|\|\|\s*/i);
    if (parts.length !== chunkTexts.length) {
      // Se il separatore è stato alterato, traduci singolarmente in parallelo limitato
      return null;
    }

    return parts.map((p: string, idx: number) =>
      restoreTechnicalTokens(p.trim(), maskedItems[idx].tokens)
    );
  } catch {
    return null;
  }
}

async function translateSingleViaPublicEndpoint(
  text: string,
  targetLang: string
): Promise<string | null> {
  const { masked, tokens } = protectTechnicalTokens(text);
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(masked)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json: any = await res.json();
    if (!Array.isArray(json) || !Array.isArray(json[0])) return null;
    const translated = json[0]
      .map((seg: any) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
      .join('')
      .trim();
    return translated ? restoreTechnicalTokens(translated, tokens) : null;
  } catch {
    return null;
  }
}

/**
 * Traduce qualsiasi array di stringhe in una delle 9 lingue SENZA ALCUNA API KEY.
 * 1) Cache RAM istantanea
 * 2) Motore traduzione pubblico gratuito keyless con protezione SKU/RAL/misure
 * 3) Fallback dizionario tecnico industriale 100% offline se manca internet
 */
export async function translateTextsZeroApiKey(
  texts: string[],
  targetLang: string
): Promise<{ translations: string[]; engine: 'keyless-online' | 'offline-dict' }> {
  if (!texts.length || targetLang === 'it') {
    return { translations: texts, engine: 'offline-dict' };
  }

  const results = [...texts];
  const pendingUnique: string[] = [];
  const pendingMap = new Map<string, number[]>();

  texts.forEach((raw, idx) => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed || /^[0-9.,:/\-+×xX%€$£\s#]+$/.test(trimmed)) {
      return;
    }
    const cacheKey = `${targetLang}::${trimmed}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      results[idx] = cached;
      return;
    }
    const existing = pendingMap.get(trimmed);
    if (existing) {
      existing.push(idx);
    } else {
      pendingMap.set(trimmed, [idx]);
      pendingUnique.push(trimmed);
    }
  });

  if (pendingUnique.length === 0) {
    return { translations: results, engine: 'keyless-online' };
  }

  // Raggruppa in batch da massimo ~1400 caratteri per velocità e affidabilità
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentChars = 0;

  for (const item of pendingUnique) {
    if (currentBatch.length >= 20 || currentChars + item.length > 1300) {
      if (currentBatch.length > 0) batches.push(currentBatch);
      currentBatch = [item];
      currentChars = item.length;
    } else {
      currentBatch.push(item);
      currentChars += item.length + 14;
    }
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  let usedOnline = false;

  for (const batch of batches) {
    let translatedBatch = await translateChunkViaPublicEndpoint(batch, targetLang);

    if (!translatedBatch && batch.length <= 8) {
      // Riprova singolarmente se il separatore del batch non combacia
      const singles = await Promise.all(
        batch.map((t) => translateSingleViaPublicEndpoint(t, targetLang))
      );
      if (singles.some(Boolean)) {
        translatedBatch = singles.map((s, i) => s || translateTextOfflineDict(batch[i], targetLang));
      }
    }

    if (translatedBatch) {
      usedOnline = true;
      batch.forEach((orig, bIdx) => {
        const tx = translatedBatch![bIdx] || orig;
        setCache(`${targetLang}::${orig}`, tx);
        const indices = pendingMap.get(orig) || [];
        indices.forEach((i) => {
          results[i] = tx;
        });
      });
    } else {
      // Fallback 100% offline
      batch.forEach((orig) => {
        const tx = translateTextOfflineDict(orig, targetLang);
        const indices = pendingMap.get(orig) || [];
        indices.forEach((i) => {
          results[i] = tx;
        });
      });
    }
  }

  return {
    translations: results,
    engine: usedOnline ? 'keyless-online' : 'offline-dict',
  };
}

// ============================================================================
// 3. MOTORE LOCALE ZERO-API-KEY PER AUTOPILOTA PREVENTIVI & COMMESSE
//    Legge WhatsApp, Email, TXT e PDF senza richiedere alcuna API Key!
// ============================================================================

interface CatalogLite {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  supplier: string;
}

interface ContactLite {
  id: string;
  companyName: string;
  city: string;
  shippingAddress: string;
  paymentTerms: string;
}

function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const IT_STOPWORDS = new Set([
  'di',
  'da',
  'in',
  'con',
  'su',
  'per',
  'tra',
  'fra',
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'un',
  'uno',
  'una',
  'del',
  'della',
  'dei',
  'degli',
  'delle',
  'al',
  'alla',
  'ai',
  'alle',
  'che',
  'mi',
  'ci',
  'si',
  'e',
  'ed',
  'o',
  'a',
  'n',
  'nr',
  'pz',
  'pezzi',
  'scatole',
  'scatola',
  'ml',
  'mt',
  'metri',
]);

function stemToken(tok: string): string {
  if (tok.length <= 3) return tok;
  return tok.replace(/(oni|ini|etti|ati|ate|iti|ite|elli|elle|i|e|a|o)$/, '');
}

function tokenizeSemantic(s: string): string[] {
  return normalizeStr(s)
    .split(' ')
    .filter((w) => w.length >= 2 && !IT_STOPWORDS.has(w))
    .map(stemToken);
}

function matchCatalogItem(
  mention: string,
  catalog: CatalogLite[]
): { item: CatalogLite | null; confidence: 'alta' | 'media' | 'nuovo_articolo'; reason: string } {
  if (!catalog.length) {
    return { item: null, confidence: 'nuovo_articolo', reason: 'Articolo non presente in catalogo' };
  }

  const normMention = normalizeStr(mention);
  const mentionTokens = new Set(tokenizeSemantic(mention));

  let bestItem: CatalogLite | null = null;
  let bestScore = 0;

  for (const c of catalog) {
    const normSku = normalizeStr(c.sku);
    if (normSku && normSku.length >= 3 && normMention.includes(normSku)) {
      return {
        item: c,
        confidence: 'alta',
        reason: `Corrispondenza esatta codice SKU (${c.sku})`,
      };
    }

    const catTokens = tokenizeSemantic(`${c.name} ${c.category} ${c.sku}`);
    if (catTokens.length === 0 || mentionTokens.size === 0) continue;

    let hits = 0;
    for (const ct of catTokens) {
      if (mentionTokens.has(ct)) {
        hits += 1;
      } else {
        for (const mt of mentionTokens) {
          if (mt.length >= 4 && ct.length >= 4 && (ct.startsWith(mt) || mt.startsWith(ct))) {
            hits += 0.75;
            break;
          }
        }
      }
    }

    const denom = Math.min(mentionTokens.size, catTokens.length) + 0.5;
    const score = hits / denom;
    if (score > bestScore) {
      bestScore = score;
      bestItem = c;
    }
  }

  if (bestItem && bestScore >= 0.55) {
    return {
      item: bestItem,
      confidence: 'alta',
      reason: `Abbinamento automatico catalogo (${bestItem.sku})`,
    };
  }
  if (bestItem && bestScore >= 0.34) {
    return {
      item: bestItem,
      confidence: 'media',
      reason: `Possibile corrispondenza catalogo (${bestItem.sku})`,
    };
  }
  return {
    item: null,
    confidence: 'nuovo_articolo',
    reason: 'Nuovo articolo rilevato dalla richiesta',
  };
}

function estimateIndustrialProfile(name: string, unit: string): {
  category: string;
  weightKg: number;
  costEur: number;
  fragile: boolean;
  skuPrefix: string;
} {
  const low = name.toLowerCase();
  const isBoxUnit = /scatol|cf|confez|carton/.test(unit.toLowerCase()) || /\bscatol/.test(low);

  if (/\b(quadr[oi]|centralin|inverter|plc|scheda elettron|alimentator|ups)\b/.test(low)) {
    return {
      category: 'Materiale Elettrico',
      weightKg: 14,
      costEur: 220,
      fragile: true,
      skuPrefix: 'EL',
    };
  }
  if (/\b(motor|motoriduttor|pomp|elettropomp|ventilator|compressor)\b/.test(low)) {
    return {
      category: 'Elettromeccanica',
      weightKg: 24,
      costEur: 340,
      fragile: true,
      skuPrefix: 'MOT',
    };
  }
  if (/\b(telecamer|sensor|fotocellul|laser|ottic|vetr|display|monitor|specchi)\b/.test(low)) {
    return {
      category: 'Automazione & Sensori',
      weightKg: 1.5,
      costEur: 85,
      fragile: true,
      skuPrefix: 'SNS',
    };
  }
  if (/\b(pannell|lamier|coibentat|grigliat|porton|lastra|lastre)\b/.test(low)) {
    return {
      category: 'Pannelli & Lamiere',
      weightKg: 16,
      costEur: 58,
      fragile: false,
      skuPrefix: 'PAN',
    };
  }
  if (/\b(profil|trav[ei]|tub[oi]|barra|barre|putrell|montant|corrimano|acciaio|ferro)\b/.test(low)) {
    return {
      category: 'Carpenteria & Profili',
      weightKg: 8.5,
      costEur: 26,
      fragile: false,
      skuPrefix: 'PRF',
    };
  }
  if (/\b(viti|vite|bullon|dad[oi]|rondell|tassell|rivett|viteria|minuteria)\b/.test(low)) {
    return {
      category: 'Viteria & Fissaggio',
      weightKg: isBoxUnit ? 1.8 : 0.08,
      costEur: isBoxUnit ? 16 : 0.65,
      fragile: false,
      skuPrefix: 'VIT',
    };
  }
  if (/\b(staff[ae]|angolar|cernier|piastr|support|mensol|ganci|collari)\b/.test(low)) {
    return {
      category: 'Ferramenta & Staffe',
      weightKg: 1.4,
      costEur: 9.5,
      fragile: false,
      skuPrefix: 'STF',
    };
  }
  if (/\b(guarnizion|gomma|epdm|paracolp|silicone|nastro|tubo fless|isolant)\b/.test(low)) {
    return {
      category: 'Guarnizioni & Tenute',
      weightKg: 0.35,
      costEur: 4.2,
      fragile: false,
      skuPrefix: 'GRN',
    };
  }
  if (/\b(cav[oi]|fil[oi]|guain|morsett|connettor|spin|pres[ae])\b/.test(low)) {
    return {
      category: 'Cavi & Cablaggio',
      weightKg: 0.9,
      costEur: 12,
      fragile: false,
      skuPrefix: 'CAV',
    };
  }

  return {
    category: 'Materiale Generale',
    weightKg: 2.2,
    costEur: 18,
    fragile: /fragil|delicat|vetr/.test(low),
    skuPrefix: 'MAT',
  };
}

function nextWeekdayIso(targetDay: number, fromDate: Date): string {
  const d = new Date(fromDate);
  const diff = (targetDay - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function extractDeliveryDateAndUrgency(text: string): {
  dateIso: string;
  urgency: 'normale' | 'urgente' | 'critica';
} {
  const now = new Date();
  const low = text.toLowerCase();

  let urgency: 'normale' | 'urgente' | 'critica' = 'normale';
  if (/\b(critica|emergenza|fermo impianto|oggi stesso|subito|immediata)\b/.test(low)) {
    urgency = 'critica';
  } else if (/\b(urgent|urgente|urgenti|urgenza|domani|entro\s+[123]\s+giorn|al pi[uù] presto)\b/.test(low)) {
    urgency = 'urgente';
  }

  // Data esplicita DD/MM/YYYY o DD-MM-YYYY
  const explicitDate = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (explicitDate) {
    const dd = explicitDate[1].padStart(2, '0');
    const mm = explicitDate[2].padStart(2, '0');
    const yyyy = explicitDate[3];
    return { dateIso: `${yyyy}-${mm}-${dd}`, urgency };
  }

  // Entro N giorni
  const withinDays = low.match(/\b(?:entro|tra|fra)\s+(\d{1,2})\s+giorn/);
  if (withinDays) {
    const days = Math.max(1, Math.min(60, Number(withinDays[1])));
    const d = new Date(now.getTime() + days * 86400000);
    return { dateIso: d.toISOString().slice(0, 10), urgency };
  }

  if (/\bdomani\b/.test(low)) {
    return {
      dateIso: new Date(now.getTime() + 1 * 86400000).toISOString().slice(0, 10),
      urgency: urgency === 'normale' ? 'urgente' : urgency,
    };
  }
  if (/\bdopodomani\b/.test(low)) {
    return {
      dateIso: new Date(now.getTime() + 2 * 86400000).toISOString().slice(0, 10),
      urgency: urgency === 'normale' ? 'urgente' : urgency,
    };
  }

  const weekdays: Array<[RegExp, number]> = [
    [/\bluned[iì]\b/, 1],
    [/\bmarted[iì]\b/, 2],
    [/\bmercoled[iì]\b/, 3],
    [/\bgioved[iì]\b/, 4],
    [/\bvenerd[iì]\b/, 5],
    [/\bsabato\b/, 6],
  ];
  for (const [re, dayNum] of weekdays) {
    if (re.test(low)) {
      return { dateIso: nextWeekdayIso(dayNum, now), urgency };
    }
  }

  return {
    dateIso: new Date(now.getTime() + 4 * 86400000).toISOString().slice(0, 10),
    urgency,
  };
}

function extractClientAndContact(
  text: string,
  contacts: ContactLite[]
): { clientName: string; matchedContact: ContactLite | null } {
  const normText = normalizeStr(text);

  // 1. Cerca corrispondenza diretta in rubrica CRM
  let bestContact: ContactLite | null = null;
  let bestLen = 0;
  for (const c of contacts) {
    const nc = normalizeStr(c.companyName);
    if (nc.length >= 4 && normText.includes(nc) && nc.length > bestLen) {
      bestContact = c;
      bestLen = nc.length;
    }
  }
  if (bestContact) {
    return { clientName: bestContact.companyName, matchedContact: bestContact };
  }

  // 2. Estrazione tramite pattern naturali italiani
  const patterns: RegExp[] = [
    /(?:per conto di|da parte di|azienda|cliente|spett\.?le)\s*[:\-]?\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ0-9&.\-\s]{2,50}?)(?=\s+(?:chiediamo|richiediamo|consegna|via|per|che|ci\b)|[.,;\n]|$)/i,
    /(?:sono\s+[A-ZÀ-Ý][a-zà-ÿ]+\s+di)\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ0-9&.\-\s]{2,45}?)(?=[.,!?\n]|$)/i,
    /(?:ufficio\s+acquisti|amministrazione|direzione)\s*[—\-–:]\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ0-9&.\-\s]{2,50}?)(?=[.,\n]|$)/i,
    /\b([A-ZÀ-Ý][A-Za-zÀ-ÿ0-9&\-\s]{2,40}\s+(?:S\.?r\.?l\.?|S\.?p\.?A\.?|S\.?n\.?c\.?|S\.?a\.?s\.?|GmbH|Ltd))\b/,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim().replace(/[.,;:!]+$/, '');
      if (candidate.length >= 3) {
        return { clientName: candidate, matchedContact: null };
      }
    }
  }

  return { clientName: 'Nuovo Cliente', matchedContact: null };
}

function extractDestination(text: string, matchedContact: ContactLite | null): string {
  const patterns: RegExp[] = [
    /(?:in\s+cantiere\s+a|cantiere\s+di|cantiere\s+a|presso\s+il\s+nostro\s+stabilimento\s+di|presso\s+lo\s+stabilimento\s+di|presso\s+stabilimento\s+di|consegna\s+(?:a|presso|in)|destinazione\s*[:\-])\s*([^\n.;:!?]{3,90})/i,
    /\b((?:Via|Viale|Corso|Piazza|Strada|Loc\.|Localit[àa]|Zona\s+Industriale)\s+[^\n.;!?]{4,75})/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      return m[1].trim().replace(/^[,\-:\s]+|[.,;:\s]+$/g, '');
    }
  }

  if (matchedContact) {
    return matchedContact.shippingAddress || matchedContact.city || 'Da confermare';
  }
  return 'Da confermare';
}

function extractPaymentTerms(text: string, matchedContact: ContactLite | null): string {
  const m = text.match(
    /\b((?:Bonifico|Ri\.?Ba\.?|Rimessa\s+Diretta|Contrassegno|Anticipato|Vista\s+fattura)[^\n.;]{0,35})/i
  );
  if (m && m[1]) {
    return m[1].trim().replace(/[.,;]+$/, '');
  }
  return matchedContact?.paymentTerms || 'Bonifico 30 gg d.f.';
}

function extractProjectTitle(text: string, clientName: string): string {
  const subj = text.match(/(?:oggetto|rif\.?|riferimento|commessa|progetto)\s*[:\-]\s*([^\n]{4,90})/i);
  if (subj && subj[1]) {
    return subj[1].trim().replace(/^(?:richiesta\s+(?:quotazione|preventivo)\s*(?:e\s+disponibilit[àa])?\s*[—\-–:]?\s*)/i, '').trim() || subj[1].trim();
  }
  return clientName && clientName !== 'Nuovo Cliente'
    ? `Fornitura ${clientName}`
    : 'Fornitura Materiale Industriale';
}

function parseQuantityUnitAndDesc(rawLine: string): {
  quantity: number;
  unit: string;
  name: string;
  dimensionsCm: string;
  notes: string;
  fragileHint: boolean;
} | null {
  let line = rawLine.trim();
  if (!line || line.length < 3) return null;

  // Rimuovi prefissi di elenco: "-", "*", "•", "1)", "1.", "2 -"
  const hadListMarker = /^(?:[-*•–—]|\d{1,2}\s*[).\-:])\s*/.test(line);
  line = line.replace(/^(?:[-*•–—]|\d{1,2}\s*[).\-:])\s*/, '').trim();

  // Ignora righe di saluto / firma / intestazione
  if (
    /^(?:ciao|buongiorno|buonasera|salve|gentile|spett|oggetto|cordiali|grazie|fammi sapere|condizioni|in attesa|ufficio acquisti|ci servirebbero|per conto di)/i.test(
      line
    ) &&
    !hadListMarker
  ) {
    return null;
  }

  // Estrai note fra parentesi es. "(fragili mi raccomando!)"
  const parenNotes: string[] = [];
  let fragileHint = /fragil|delicat|vetr|non sovrapporre/i.test(line);
  line = line
    .replace(/\(([^)]{2,80})\)/g, (_, inner) => {
      parenNotes.push(inner.trim());
      if (/fragil|delicat|vetr/i.test(inner)) fragileHint = true;
      return ' ';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Cerca quantità all'inizio: "N. 120 ...", "40 ...", "2x ...", "q.tà 15 ...", "una decina di ..."
  let quantity = 0;
  let unit = 'pz';
  let rest = line;

  const qtyPatterns: Array<{
    re: RegExp;
    extract: (m: RegExpMatchArray) => { qty: number; u?: string; desc: string };
  }> = [
    {
      re: /^(?:n\.?|nr\.?|q\.?t[àa]\.?|qty)?\s*(\d+(?:[.,]\d+)?)\s*(?:x\b)?\s*(pz|pezzi|ml|mt|m\b|mq|m2|kg|scatole|scatola|cf|confezioni|rotoli|rotolo|barre|barra|kit|set|bancali|bancale|paia)?\s*(?:di\s+)?(.+)$/i,
      extract: (m) => ({
        qty: Math.max(1, Math.round(Number(m[1].replace(',', '.')))),
        u: m[2],
        desc: m[3],
      }),
    },
    {
      re: /^(.+?)\s*(?:x|\*|q\.?t[àa]\.?|n\.?)\s*(\d+(?:[.,]\d+)?)\s*(pz|pezzi|ml|mt|m|mq|kg|scatole|cf|kit)?$/i,
      extract: (m) => ({
        qty: Math.max(1, Math.round(Number(m[2].replace(',', '.')))),
        u: m[3],
        desc: m[1],
      }),
    },
    {
      re: /^(?:una\s+decina|un\s+paio|mezza\s+dozzina|una\s+dozzina)\s+(?:di\s+)?(.+)$/i,
      extract: (m) => {
        const prefix = m[0].toLowerCase();
        const qty = prefix.startsWith('una decina')
          ? 10
          : prefix.startsWith('una dozzina')
          ? 12
          : prefix.startsWith('mezza dozzina')
          ? 6
          : 2;
        return { qty, desc: m[1] };
      },
    },
  ];

  for (const qp of qtyPatterns) {
    const m = rest.match(qp.re);
    if (m) {
      const parsed = qp.extract(m);
      if (parsed.qty > 0 && parsed.desc.trim().length >= 2) {
        quantity = parsed.qty;
        if (parsed.u) {
          const ul = parsed.u.toLowerCase();
          if (ul === 'pezzi' || ul === 'pz') unit = 'pz';
          else if (ul === 'scatole' || ul === 'scatola') unit = 'cf';
          else if (ul === 'confezioni' || ul === 'cf') unit = 'cf';
          else if (ul === 'mt' || ul === 'm') unit = 'm';
          else if (ul === 'ml') unit = 'ml';
          else if (ul === 'mq' || ul === 'm2') unit = 'mq';
          else if (ul === 'kg') unit = 'kg';
          else if (ul.startsWith('rotol')) unit = 'rot';
          else if (ul.startsWith('barr')) unit = 'pz';
          else if (ul.startsWith('bancal')) unit = 'plt';
          else unit = ul;
        }
        rest = parsed.desc.trim();
        break;
      }
    }
  }

  // Se non era una riga con quantità e non era un punto elenco, scartala
  if (quantity === 0) {
    if (!hadListMarker) return null;
    quantity = 1;
  }

  // Pulizia nome
  const cleanName = rest
    .replace(/^[-–—:.\s]+/, '')
    .replace(/[;,.]+$/, '')
    .trim();

  if (cleanName.length < 2) return null;

  // Estrai dimensioni eventuali (es. 40x40, 200x100 cm, da 3 metri, spessore 50mm)
  const dimMatches: string[] = [];
  const d1 = cleanName.match(/\b\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(?:mm|cm|m)?\b/i);
  if (d1) dimMatches.push(d1[0]);
  const d2 = cleanName.match(/\b(?:da\s+)?\d+(?:[.,]\d+)?\s*(?:metri|mt|mm|cm)\b/i);
  if (d2 && (!d1 || !d1[0].includes(d2[0]))) dimMatches.push(d2[0]);

  // Prima lettera maiuscola
  const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

  return {
    quantity,
    unit,
    name: formattedName,
    dimensionsCm: dimMatches.join(' · '),
    notes: parenNotes.join('; '),
    fragileHint,
  };
}

export function parseClientRequestZeroApiKey(params: {
  rawText: string;
  fileBase64?: string;
  fileMimeType?: string;
  fileName?: string;
  catalogSummary: CatalogLite[];
  contactsSummary: ContactLite[];
}) {
  let combinedText = (params.rawText || '').trim();

  if (params.fileBase64 && params.fileMimeType === 'application/pdf') {
    const pdfText = extractTextFromPdfBase64(params.fileBase64);
    if (pdfText) {
      combinedText = combinedText ? `${combinedText}\n\n${pdfText}` : pdfText;
    }
  } else if (params.fileBase64 && params.fileMimeType === 'text/plain') {
    try {
      const txt = Buffer.from(params.fileBase64, 'base64').toString('utf-8').trim();
      if (txt) combinedText = combinedText ? `${combinedText}\n\n${txt}` : txt;
    } catch {
      // ignore
    }
  }

  const { clientName, matchedContact } = extractClientAndContact(
    combinedText,
    params.contactsSummary
  );
  const destination = extractDestination(combinedText, matchedContact);
  const { dateIso, urgency } = extractDeliveryDateAndUrgency(combinedText);
  const paymentTerms = extractPaymentTerms(combinedText, matchedContact);
  const projectTitle = extractProjectTitle(combinedText, clientName);

  // Estrai righe candidate agli articoli
  const lines = combinedText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const extractedItems: any[] = [];
  for (const line of lines) {
    const parsed = parseQuantityUnitAndDesc(line);
    if (!parsed) continue;

    const match = matchCatalogItem(parsed.name, params.catalogSummary);
    const est = estimateIndustrialProfile(
      match.item?.name || parsed.name,
      match.item?.unit || parsed.unit
    );
    const seq = String(extractedItems.length + 1).padStart(3, '0');

    extractedItems.push({
      rawMention: line,
      matchedInventoryId: match.item?.id || '',
      sku: match.item?.sku || `${est.skuPrefix}-${seq}`,
      name: match.item?.name || parsed.name,
      category: match.item?.category || est.category,
      unit: match.item?.unit || parsed.unit,
      quantity: parsed.quantity,
      estimatedUnitWeightKg: est.weightKg,
      estimatedUnitCostEur: est.costEur,
      fragile: parsed.fragileHint || est.fragile,
      dimensionsCm: parsed.dimensionsCm,
      matchConfidence: match.confidence,
      matchReason: match.reason,
      supplierName: match.item?.supplier || '',
      notes: parsed.notes,
    });
  }

  // Se testo in paragrafo unico senza a-capo, prova a dividere su ";" o ","
  if (extractedItems.length === 0 && combinedText.length > 0) {
    const segments = combinedText.split(/[;,]+/).map((s) => s.trim());
    for (const seg of segments) {
      const parsed = parseQuantityUnitAndDesc(seg);
      if (!parsed) continue;
      const match = matchCatalogItem(parsed.name, params.catalogSummary);
      const est = estimateIndustrialProfile(
        match.item?.name || parsed.name,
        match.item?.unit || parsed.unit
      );
      const seq = String(extractedItems.length + 1).padStart(3, '0');
      extractedItems.push({
        rawMention: seg,
        matchedInventoryId: match.item?.id || '',
        sku: match.item?.sku || `${est.skuPrefix}-${seq}`,
        name: match.item?.name || parsed.name,
        category: match.item?.category || est.category,
        unit: match.item?.unit || parsed.unit,
        quantity: parsed.quantity,
        estimatedUnitWeightKg: est.weightKg,
        estimatedUnitCostEur: est.costEur,
        fragile: parsed.fragileHint || est.fragile,
        dimensionsCm: parsed.dimensionsCm,
        matchConfidence: match.confidence,
        matchReason: match.reason,
        supplierName: match.item?.supplier || '',
        notes: parsed.notes,
      });
    }
  }

  const year = new Date().getFullYear();
  const clientCode = normalizeStr(clientName)
    .replace(/\s+/g, '')
    .slice(0, 4)
    .toUpperCase();
  const suggestedCommessaCode = `COMM-${year}-${clientCode || 'NEW'}`;

  const summaryNotes =
    extractedItems.length > 0
      ? `Analisi locale completata: ${extractedItems.length} righe materiale estratte. Verifica pesi unitari e prezzi prima dell'invio definitivo.`
      : params.fileBase64 && params.fileMimeType?.startsWith('image/')
      ? 'Immagine allegata: in modalità senza API esterna inserisci o incolla il testo della richiesta oppure aggiungi le righe manualmente qui a destra.'
      : 'Richiesta acquisita: aggiungi o rifinisci gli articoli nella tabella preventivo.';

  const customerReplyMessage = `Buongiorno ${clientName},\n\nabbiamo ricevuto la vostra richiesta per "${projectTitle}" con consegna prevista presso ${destination} entro il ${dateIso}.\nAbbiamo già preparato il preventivo dettagliato con verifica disponibilità di magazzino e piano di carico.\nRestiamo a disposizione per conferma ordine.\n\nCordiali saluti`;

  return {
    clientName,
    matchedContactId: matchedContact?.id || '',
    destination,
    requestedDeliveryDate: dateIso,
    urgency,
    projectTitle,
    suggestedCommessaCode,
    paymentTerms,
    summaryNotes,
    customerReplyMessage,
    items: extractedItems,
  };
}
