import { CargoLoad } from '../types/warehouse';
import { translateItalianToEnglish } from './logisticsTranslator';
import { authFetch } from './authSession';

export interface AiTranslationResult {
  translatedLoad: CargoLoad;
  engine: 'gemini' | 'offline';
  targetLanguage: string;
}

/**
 * Traduce l'intera commessa (articoli, scatole, bancali, descrizioni e note)
 * utilizzando Google Gemini AI se il server è disponibile, con fallback istantaneo
 * sul motore deterministico logistico offline in caso di modalità desktop o assenza di rete.
 */
export async function translateLoadWithAi(
  load: CargoLoad,
  targetLanguage: string = 'en'
): Promise<AiTranslationResult> {
  // 1. Se siamo in modalità Web (non protocollo locale file:///), tentiamo la traduzione AI con Gemini
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await authFetch('/api/translate-load-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          load,
          targetLanguage,
        }),
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.translatedData) {
          const td = json.translatedData;

          const palletMap = new Map<string, { label?: string; notes?: string }>();
          if (Array.isArray(td.pallets)) {
            for (const p of td.pallets) {
              if (p.id) palletMap.set(p.id, p);
            }
          }

          const boxMap = new Map<string, { label?: string }>();
          if (Array.isArray(td.boxes)) {
            for (const b of td.boxes) {
              if (b.id) boxMap.set(b.id, b);
            }
          }

          const itemMap = new Map<string, { name?: string; category?: string; notes?: string }>();
          if (Array.isArray(td.items)) {
            for (const it of td.items) {
              if (it.id) itemMap.set(it.id, it);
            }
          }

          const translatedLoad: CargoLoad = {
            ...load,
            title: td.title || (load.title ? translateItalianToEnglish(load.title) : ''),
            destination: td.destination || (load.destination ? translateItalianToEnglish(load.destination) : ''),
            client: td.client || load.client,
            carrier: td.carrier || load.carrier,
            pallets: load.pallets.map((p) => {
              const trP = palletMap.get(p.id);
              return {
                ...p,
                label: trP?.label || (p.label ? translateItalianToEnglish(p.label) : p.label),
                notes: trP?.notes || (p.notes ? translateItalianToEnglish(p.notes) : p.notes),
              };
            }),
            boxes: load.boxes.map((b) => {
              const trB = boxMap.get(b.id);
              return {
                ...b,
                label: trB?.label || (b.label ? translateItalianToEnglish(b.label) : b.label),
              };
            }),
            items: load.items.map((it) => {
              const trIt = itemMap.get(it.id);
              return {
                ...it,
                name: trIt?.name || (it.name ? translateItalianToEnglish(it.name) : it.name),
                category: trIt?.category || (it.category ? translateItalianToEnglish(it.category) : it.category),
                notes: trIt?.notes || (it.notes ? translateItalianToEnglish(it.notes) : it.notes),
              };
            }),
          };

          return {
            translatedLoad,
            engine: 'gemini',
            targetLanguage,
          };
        }
      }
    } catch (err) {
      console.warn('Tentativo traduzione con Gemini non riuscito, uso fallback deterministico locale:', err);
    }
  }

  // 2. Fallback Deterministico Locale Offline (funziona al 100% offline, anche dentro file:/// sul PC)
  const fallbackLoad: CargoLoad = {
    ...load,
    title: load.title ? translateItalianToEnglish(load.title) : '',
    destination: load.destination ? translateItalianToEnglish(load.destination) : '',
    pallets: load.pallets.map((p) => ({
      ...p,
      label: p.label ? translateItalianToEnglish(p.label) : p.label,
      notes: p.notes ? translateItalianToEnglish(p.notes) : p.notes,
    })),
    boxes: load.boxes.map((b) => ({
      ...b,
      label: b.label ? translateItalianToEnglish(b.label) : b.label,
    })),
    items: load.items.map((it) => ({
      ...it,
      name: it.name ? translateItalianToEnglish(it.name) : it.name,
      category: it.category ? translateItalianToEnglish(it.category) : it.category,
      notes: it.notes ? translateItalianToEnglish(it.notes) : it.notes,
    })),
  };

  return {
    translatedLoad: fallbackLoad,
    engine: 'offline',
    targetLanguage,
  };
}
