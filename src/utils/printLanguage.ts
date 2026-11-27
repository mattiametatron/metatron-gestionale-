import { useEffect, useState } from 'react';
import type jsPDF from 'jspdf';
import {
  CargoLoad,
  DdtDocument,
  FinishingCartello,
  PurchaseOrder,
} from '../types/warehouse';
import { authFetch } from './authSession';
import { translateItalianToEnglish } from './logisticsTranslator';

export type PrintLanguageCode =
  | 'it'
  | 'en'
  | 'de'
  | 'fr'
  | 'es'
  | 'pt'
  | 'nl'
  | 'pl'
  | 'ro';

export interface PrintLanguageOption {
  code: PrintLanguageCode;
  shortLabel: string;
  label: string;
  nativeName: string;
}

export const PRINT_LANGUAGE_OPTIONS: PrintLanguageOption[] = [
  { code: 'it', shortLabel: 'IT', label: 'Italiano', nativeName: 'Italiano' },
  { code: 'en', shortLabel: 'EN', label: 'Inglese', nativeName: 'English' },
  { code: 'de', shortLabel: 'DE', label: 'Tedesco', nativeName: 'Deutsch' },
  { code: 'fr', shortLabel: 'FR', label: 'Francese', nativeName: 'Français' },
  { code: 'es', shortLabel: 'ES', label: 'Spagnolo', nativeName: 'Español' },
  { code: 'pt', shortLabel: 'PT', label: 'Portoghese', nativeName: 'Português' },
  { code: 'nl', shortLabel: 'NL', label: 'Olandese', nativeName: 'Nederlands' },
  { code: 'pl', shortLabel: 'PL', label: 'Polacco', nativeName: 'Polski' },
  { code: 'ro', shortLabel: 'RO', label: 'Rumeno', nativeName: 'Română' },
];

const PRINT_LANG_STORAGE_KEY = 'metatron_global_print_lang_v1';
const PRINT_LANG_EVENT = 'metatron-print-lang-change';
const TRANSLATION_CACHE_KEY = 'metatron_print_tx_cache_v1';

const memoryTranslationCache = new Map<string, string>();
let cacheHydrated = false;

function hydrateCache() {
  if (cacheHydrated || typeof window === 'undefined') return;
  cacheHydrated = true;
  try {
    const raw = sessionStorage.getItem(TRANSLATION_CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') memoryTranslationCache.set(k, v);
      }
    }
  } catch {
    // ignore
  }
}

function persistCache() {
  if (typeof window === 'undefined') return;
  try {
    const entries = Array.from(memoryTranslationCache.entries()).slice(-500);
    sessionStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // ignore
  }
}

export function getPrintLanguage(): PrintLanguageCode {
  if (typeof window === 'undefined') return 'it';
  try {
    const stored = localStorage.getItem(PRINT_LANG_STORAGE_KEY) as PrintLanguageCode | null;
    if (stored && PRINT_LANGUAGE_OPTIONS.some((o) => o.code === stored)) {
      return stored;
    }
  } catch {
    // ignore
  }
  return 'it';
}

export function setGlobalPrintLanguage(lang: PrintLanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PRINT_LANG_STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(PRINT_LANG_EVENT, { detail: lang }));
}

export function usePrintLanguage(): [PrintLanguageCode, (lang: PrintLanguageCode) => void] {
  const [lang, setLang] = useState<PrintLanguageCode>(() => getPrintLanguage());

  useEffect(() => {
    const onChange = (e: Event) => {
      const custom = e as CustomEvent<PrintLanguageCode>;
      if (custom.detail) setLang(custom.detail);
      else setLang(getPrintLanguage());
    };
    window.addEventListener(PRINT_LANG_EVENT, onChange);
    return () => window.removeEventListener(PRINT_LANG_EVENT, onChange);
  }, []);

  const update = (next: PrintLanguageCode) => {
    setLang(next);
    setGlobalPrintLanguage(next);
  };

  return [lang, update];
}

export function getPrintLanguageOption(code: PrintLanguageCode): PrintLanguageOption {
  return PRINT_LANGUAGE_OPTIONS.find((o) => o.code === code) || PRINT_LANGUAGE_OPTIONS[0];
}

/**
 * Normalizza diacritici non coperti dal font standard Helvetica di jsPDF
 * (es. caratteri polacchi/rumeni speciali) evitando glifi corrotti nei PDF A4.
 */
export function sanitizeForJsPdfLatin1(text: string): string {
  if (!text) return '';
  return text
    .replace(/[ăâ]/g, 'a')
    .replace(/[ĂÂ]/g, 'A')
    .replace(/[î]/g, 'i')
    .replace(/[Î]/g, 'I')
    .replace(/[șş]/g, 's')
    .replace(/[ȘŞ]/g, 'S')
    .replace(/[țţ]/g, 't')
    .replace(/[ȚŢ]/g, 'T')
    .replace(/[ą]/g, 'a')
    .replace(/[Ą]/g, 'A')
    .replace(/[ć]/g, 'c')
    .replace(/[Ć]/g, 'C')
    .replace(/[ę]/g, 'e')
    .replace(/[Ę]/g, 'E')
    .replace(/[ł]/g, 'l')
    .replace(/[Ł]/g, 'L')
    .replace(/[ń]/g, 'n')
    .replace(/[Ń]/g, 'N')
    .replace(/[ś]/g, 's')
    .replace(/[Ś]/g, 'S')
    .replace(/[źż]/g, 'z')
    .replace(/[ŹŻ]/g, 'Z')
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/€/g, 'EUR ');
}

/**
 * Dizionario multilingua istantaneo per tutte le intestazioni, etichette statiche,
 * colonne di tabella e firme in stampe PDF e HTML (9 lingue).
 */
const STATIC_PHRASES: Array<{
  it: string;
  translations: Record<Exclude<PrintLanguageCode, 'it'>, string>;
}> = [
  // Intestazioni Documenti
  {
    it: 'DOCUMENTO DI TRASPORTO (D.D.T.)',
    translations: {
      en: 'DELIVERY NOTE / TRANSPORT DOCUMENT',
      de: 'LIEFERSCHEIN / TRANSPORTDOKUMENT',
      fr: 'BON DE LIVRAISON / DOCUMENT DE TRANSPORT',
      es: 'ALBARÁN DE ENTREGA / DOCUMENTO DE TRANSPORTE',
      pt: 'GUIA DE REMESSA / DOCUMENTO DE TRANSPORTE',
      nl: 'PAKBON / VERVOERSDOCUMENT',
      pl: 'DOWÓD DOSTAWY / DOKUMENT PRZEWOZOWY',
      ro: 'AVIZ DE ÎNSOȚIRE A MĂRFII',
    },
  },
  {
    it: 'ORDINE DI ACQUISTO FORNITORE',
    translations: {
      en: 'SUPPLIER PURCHASE ORDER',
      de: 'LIEFERANTENBESTELLUNG',
      fr: 'BON DE COMMANDE FOURNISSEUR',
      es: 'ORDEN DE COMPRA PROVEEDOR',
      pt: 'ORDEM DE COMPRA FORNECEDOR',
      nl: 'INKOOPORDER LEVERANCIER',
      pl: 'ZAMÓWIENIE DO DOSTAWCY',
      ro: 'COMANDĂ DE ACHIZIȚIE FURNIZOR',
    },
  },
  {
    it: 'OFFERTA COMMERCIALE / PREVENTIVO',
    translations: {
      en: 'COMMERCIAL QUOTATION / OFFER',
      de: 'ANGEBOT / KOSTENVORANSCHLAG',
      fr: 'DEVIS COMMERCIAL / OFFRE',
      es: 'PRESUPUESTO COMERCIAL / OFERTA',
      pt: 'ORÇAMENTO COMERCIAL / PROPOSTA',
      nl: 'COMMERCIËLE OFFERTE',
      pl: 'OFERTA HANDLOWA / WYCENA',
      ro: 'OFERTĂ COMERCIALĂ / DEVIZ',
    },
  },
  {
    it: 'DISTINTA UFFICIALE DI SPEDIZIONE & PACKING LIST MATERIALE',
    translations: {
      en: 'OFFICIAL SHIPMENT MANIFEST & PACKING LIST',
      de: 'OFFIZIELLE VERSANDLISTE & PACKLISTE',
      fr: 'LISTE DE COLISAGE & BORDEREAU D’EXPÉDITION',
      es: 'LISTA DE EMPAQUE & MANIFIESTO DE ENVÍO',
      pt: 'LISTA DE EMBALAGEM & MANIFESTO DE EXPEDIÇÃO',
      nl: 'OFFICIËLE PAKLIJST & VERZENDLIJST',
      pl: 'OFICJALNA SPECYFIKACJA WYSYŁKOWA / PACKING LIST',
      ro: 'LISTĂ OFICIALĂ DE EXPEDIERE & PACKING LIST',
    },
  },
  {
    it: 'CARTELLO TRATTAMENTO / VERNICIATURA',
    translations: {
      en: 'SURFACE TREATMENT / PAINTING TAG',
      de: 'OBERFLÄCHENBEHANDLUNG / LACKIERUNG',
      fr: 'ÉTIQUETTE TRAITEMENT / PEINTURE',
      es: 'ETIQUETA TRATAMIENTO / PINTURA',
      pt: 'ETIQUETA TRATAMENTO / PINTURA',
      nl: 'BEHANDELING / LAKWERK LABEL',
      pl: 'ETYKIETA OBRÓBKI / MALOWANIA',
      ro: 'ETICHETĂ TRATAMENT / VOPSIRE',
    },
  },
  {
    it: 'SCHEDA COLLO BANCALE',
    translations: {
      en: 'PALLET SHIPPING SHEET',
      de: 'PALETTENBEGLEITSCHEIN',
      fr: 'FICHE PALETTE D’EXPÉDITION',
      es: 'HOJA DE PALET / BULTO',
      pt: 'FICHA DE PALETE',
      nl: 'PALLETKAART / VERZENDLABEL',
      pl: 'KARTA PALETY WYSYŁKOWEJ',
      ro: 'FIȘĂ PALET EXPEDIERE',
    },
  },
  {
    it: 'SCHEDA IDENTIFICAZIONE BANCALE',
    translations: {
      en: 'PALLET IDENTIFICATION SHEET',
      de: 'PALETTEN-KENNZEICHNUNGSBLATT',
      fr: 'FICHE D’IDENTIFICATION PALETTE',
      es: 'HOJA DE IDENTIFICACIÓN DE PALET',
      pt: 'FICHA DE IDENTIFICAÇÃO DE PALETE',
      nl: 'PALLET IDENTIFICATIEKAART',
      pl: 'KARTA IDENTYFIKACYJNA PALETY',
      ro: 'FIȘĂ IDENTIFICARE PALET',
    },
  },
  {
    it: 'ETICHETTA COLLO / SCATOLA',
    translations: {
      en: 'PACKAGE / BOX LABEL',
      de: 'PAKET- / KARTONETIKETT',
      fr: 'ÉTIQUETTE COLIS / CARTON',
      es: 'ETIQUETA CAJA / BULTO',
      pt: 'ETIQUETA CAIXA / VOLUME',
      nl: 'DOOS / COLLO LABEL',
      pl: 'ETYKIETA PACZKI / KARTONU',
      ro: 'ETICHETĂ COLET / CUTIE',
    },
  },
  {
    it: 'ETICHETTA ARTICOLO',
    translations: {
      en: 'ITEM LABEL',
      de: 'ARTIKELETIKETT',
      fr: 'ÉTIQUETTE ARTICLE',
      es: 'ETIQUETA ARTÍCULO',
      pt: 'ETIQUETA ARTIGO',
      nl: 'ARTIKELLABEL',
      pl: 'ETYKIETA ARTYKUŁU',
      ro: 'ETICHETĂ ARTICOL',
    },
  },
  {
    it: 'PLANCIA QR COMANDI RAPIDI DA BANCO',
    translations: {
      en: 'WORKBENCH QR QUICK COMMAND SHEET',
      de: 'QR-SCHNELLBEFEHLSBLATT FÜR PACKTISCH',
      fr: 'PLANCHE QR COMMANDES RAPIDES POSTE',
      es: 'HOJA QR COMANDOS RÁPIDOS DE BANCO',
      pt: 'FOLHA QR COMANDOS RÁPIDOS DE BANCADA',
      nl: 'QR SNELOPDRACHTENBLAD WERKTAFEL',
      pl: 'ARKUSZ QR SZYBKICH POLECEŃ MAGAZYNOWYCH',
      ro: 'PLANȘĂ QR COMENZI RAPIDE BANC DE LUCRU',
    },
  },
  // Blocchi & Campi
  {
    it: 'MITTENTE',
    translations: { en: 'SHIPPER', de: 'ABSENDER', fr: 'EXPÉDITEUR', es: 'REMITENTE', pt: 'REMETENTE', nl: 'AFZENDER', pl: 'NADAWCA', ro: 'EXPEDITOR' },
  },
  {
    it: 'DESTINATARIO / CESSIONARIO',
    translations: { en: 'CONSIGNEE / RECIPIENT', de: 'EMPFÄNGER', fr: 'DESTINATAIRE', es: 'DESTINATARIO', pt: 'DESTINATÁRIO', nl: 'ONTVANGER', pl: 'ODBIORCA', ro: 'DESTINATAR' },
  },
  {
    it: 'LUOGO DI DESTINAZIONE MERCE',
    translations: { en: 'DELIVERY DESTINATION', de: 'LIEFERADRESSE', fr: 'LIEU DE LIVRAISON', es: 'LUGAR DE DESTINO', pt: 'LOCAL DE DESTINO', nl: 'AFLEVERADRES', pl: 'MIEJSCE DOSTAWY', ro: 'LOCUL DE DESTINAȚIE' },
  },
  {
    it: 'CAUSALE · PORTO · TRASPORTO A CURA',
    translations: { en: 'REASON · FREIGHT TERMS · CARRIER', de: 'GRUND · FRACHT · TRANSPORT', fr: 'MOTIF · PORT · TRANSPORT', es: 'MOTIVO · PORTE · TRANSPORTE', pt: 'MOTIVO · PORTE · TRANSPORTE', nl: 'REDEN · VRACHT · TRANSPORT', pl: 'POWÓD · PRZEWÓZ · TRANSPORT', ro: 'MOTIV · TRANSPORT · EXPEDIERE' },
  },
  {
    it: 'SPETT.LE FORNITORE',
    translations: { en: 'SUPPLIER', de: 'LIEFERANT', fr: 'FOURNISSEUR', es: 'PROVEEDOR', pt: 'FORNECEDOR', nl: 'LEVERANCIER', pl: 'DOSTAWCA', ro: 'FURNIZOR' },
  },
  {
    it: 'SPETT.LE CLIENTE',
    translations: { en: 'CUSTOMER', de: 'KUNDE', fr: 'CLIENT', es: 'CLIENTE', pt: 'CLIENTE', nl: 'KLANT', pl: 'KLIENT', ro: 'CLIENT' },
  },
  {
    it: 'DETTAGLI CONSEGNA & PAGAMENTO',
    translations: { en: 'DELIVERY & PAYMENT DETAILS', de: 'LIEFER- & ZAHLUNGSDETAILS', fr: 'LIVRAISON & PAIEMENT', es: 'ENTREGA Y PAGO', pt: 'ENTREGA E PAGAMENTO', nl: 'LEVERING & BETALING', pl: 'DOSTAWA I PŁATNOŚĆ', ro: 'LIVRARE ȘI PLATĂ' },
  },
  {
    it: 'CONDIZIONI & CONSEGNA',
    translations: { en: 'TERMS & DELIVERY', de: 'BEDINGUNGEN & LIEFERUNG', fr: 'CONDITIONS & LIVRAISON', es: 'CONDICIONES Y ENTREGA', pt: 'CONDIÇÕES E ENTREGA', nl: 'VOORWAARDEN & LEVERING', pl: 'WARUNKI I DOSTAWA', ro: 'CONDIȚII ȘI LIVRARE' },
  },
  {
    it: 'TIMBRO E FIRMA PER ACCETTAZIONE OFFERTA',
    translations: {
      en: 'STAMP & SIGNATURE FOR QUOTE ACCEPTANCE',
      de: 'STEMPEL & UNTERSCHRIFT ZUR ANGEBOTSANNAHME',
      fr: 'CACHET ET SIGNATURE POUR ACCORD',
      es: 'SELLO Y FIRMA DE ACEPTACIÓN',
      pt: 'CARIMBO E ASSINATURA DE ACEITAÇÃO',
      nl: 'STEMPEL & HANDTEKENING VOOR AKKOORD',
      pl: 'PIECZĘĆ I PODPIS AKCEPTACJI OFERTY',
      ro: 'ȘTAMPILĂ ȘI SEMNĂTURĂ PENTRU ACCEPTARE',
    },
  },
  {
    it: 'FIRMA CONDUCENTE / VETTORE',
    translations: { en: 'DRIVER / CARRIER SIGNATURE', de: 'UNTERSCHRIFT FAHRER / SPEDITION', fr: 'SIGNATURE CHAUFFEUR / TRANSPORTEUR', es: 'FIRMA CONDUCTOR / TRANSPORTISTA', pt: 'ASSINATURA MOTORISTA / TRANSPORTADORA', nl: 'HANDTEKENING CHAUFFEUR', pl: 'PODPIS KIEROWCY / PRZEWOŹNIKA', ro: 'SEMNĂTURĂ ȘOFER / TRANSPORTATOR' },
  },
  {
    it: 'FIRMA DESTINATARIO (PER RICEVUTA)',
    translations: { en: 'RECIPIENT SIGNATURE (RECEIVED)', de: 'UNTERSCHRIFT EMPFÄNGER', fr: 'SIGNATURE DESTINATAIRE', es: 'FIRMA DESTINATARIO', pt: 'ASSINATURA DESTINATÁRIO', nl: 'HANDTEKENING ONTVANGER', pl: 'PODPIS ODBIORCY', ro: 'SEMNĂTURĂ DESTINATAR' },
  },
  {
    it: 'VETTORE / INCARICATO DEL TRASPORTO & ANNOTAZIONI',
    translations: { en: 'CARRIER / TRANSPORT & NOTES', de: 'SPEDITION / TRANSPORT & HINWEISE', fr: 'TRANSPORTEUR & NOTES', es: 'TRANSPORTISTA Y NOTAS', pt: 'TRANSPORTADORA E NOTAS', nl: 'VERVOERDER & OPMERKINGEN', pl: 'PRZEWOŹNIK I UWAGI', ro: 'TRANSPORTATOR ȘI NOTE' },
  },
  {
    it: 'NOTE COMMERCIALI & LOGISTICHE',
    translations: { en: 'COMMERCIAL & LOGISTICS NOTES', de: 'HANDELS- & LOGISTIKHINWEISE', fr: 'NOTES COMMERCIALES & LOGISTIQUES', es: 'NOTAS COMERCIALES Y LOGÍSTICAS', pt: 'NOTAS COMERCIAIS E LOGÍSTICAS', nl: 'COMMERCIËLE & LOGISTIEKE NOTITIES', pl: 'UWAGI HANDLOWE I LOGISTYCZNE', ro: 'NOTE COMERCIALE ȘI LOGISTICE' },
  },
  {
    it: 'TOTALE PREVENTIVO:',
    translations: { en: 'QUOTE TOTAL:', de: 'GESAMTBETRAG:', fr: 'TOTAL DEVIS :', es: 'TOTAL PRESUPUESTO:', pt: 'TOTAL ORÇAMENTO:', nl: 'TOTAAL OFFERTE:', pl: 'SUMA OFERTY:', ro: 'TOTAL OFERTĂ:' },
  },
  {
    it: 'PESO LORDO',
    translations: { en: 'GROSS WEIGHT', de: 'BRUTTOGEWICHT', fr: 'POIDS BRUT', es: 'PESO BRUTO', pt: 'PESO BRUTO', nl: 'BRUTOGEWICHT', pl: 'WAGA BRUTTO', ro: 'GREUTATE BRUTĂ' },
  },
  {
    it: 'PESO NETTO',
    translations: { en: 'NET WEIGHT', de: 'NETTOGEWICHT', fr: 'POIDS NET', es: 'PESO NETO', pt: 'PESO LÍQUIDO', nl: 'NETTOGEWICHT', pl: 'WAGA NETTO', ro: 'GREUTATE NETĂ' },
  },
  {
    it: 'ASPETTO ESTERIORE',
    translations: { en: 'PACKAGING APPEARANCE', de: 'ÄUSSERE BESCHAFFENHEIT', fr: 'ASPECT EXTÉRIEUR', es: 'ASPECTO EXTERIOR', pt: 'ASPETO EXTERIOR', nl: 'UITERLIJKE STAAT', pl: 'WYGLĄD ZEWNĘTRZNY', ro: 'ASPECT EXTERIOR' },
  },
  {
    it: 'N. COLLI',
    translations: { en: 'PACKAGES', de: 'PACKSTÜCKE', fr: 'COLIS', es: 'BULTOS', pt: 'VOLUMES', nl: 'COLLI', pl: 'PACZKI', ro: 'COLETE' },
  },
  {
    it: 'BANCALI',
    translations: { en: 'PALLETS', de: 'PALETTEN', fr: 'PALETTES', es: 'PALETS', pt: 'PALETES', nl: 'PALLETS', pl: 'PALETY', ro: 'PALEȚI' },
  },
  {
    it: 'BANCALE',
    translations: { en: 'PALLET', de: 'PALETTE', fr: 'PALETTE', es: 'PALET', pt: 'PALETE', nl: 'PALLET', pl: 'PALETA', ro: 'PALET' },
  },
  {
    it: 'SCATOLE',
    translations: { en: 'BOXES', de: 'KARTONS', fr: 'CARTONS', es: 'CAJAS', pt: 'CAIXAS', nl: 'DOZEN', pl: 'KARTONY', ro: 'CUTII' },
  },
  {
    it: 'SCATOLA',
    translations: { en: 'BOX', de: 'KARTON', fr: 'CARTON', es: 'CAJA', pt: 'CAIXA', nl: 'DOOS', pl: 'KARTON', ro: 'CUTIE' },
  },
  {
    it: 'DESCRIZIONE BENI',
    translations: { en: 'DESCRIPTION OF GOODS', de: 'WARENBESCHREIBUNG', fr: 'DÉSIGNATION DES BIENS', es: 'DESCRIPCIÓN DE BIENES', pt: 'DESCRIÇÃO DOS BENS', nl: 'OMSCHRIJVING GOEDEREN', pl: 'OPIS TOWARU', ro: 'DESCRIEREA BUNURILOR' },
  },
  {
    it: 'DESCRIZIONE ARTICOLO',
    translations: { en: 'ITEM DESCRIPTION', de: 'ARTIKELBESCHREIBUNG', fr: 'DÉSIGNATION ARTICLE', es: 'DESCRIPCIÓN ARTÍCULO', pt: 'DESCRIÇÃO ARTIGO', nl: 'ARTIKELOMSCHRIJVING', pl: 'OPIS ARTYKUŁU', ro: 'DESCRIERE ARTICOL' },
  },
  {
    it: 'CODICE / SKU',
    translations: { en: 'CODE / SKU', de: 'ART.-NR. / SKU', fr: 'CODE / SKU', es: 'CÓDIGO / SKU', pt: 'CÓDIGO / SKU', nl: 'CODE / SKU', pl: 'KOD / SKU', ro: 'COD / SKU' },
  },
  {
    it: 'QUANTITÀ',
    translations: { en: 'QUANTITY', de: 'MENGE', fr: 'QUANTITÉ', es: 'CANTIDAD', pt: 'QUANTIDADE', nl: 'AANTAL', pl: 'ILOŚĆ', ro: 'CANTITATE' },
  },
  {
    it: 'PREZZO UNIT.',
    translations: { en: 'UNIT PRICE', de: 'EINZELPREIS', fr: 'PRIX UNIT.', es: 'PRECIO UNIT.', pt: 'PREÇO UNIT.', nl: 'STUKPRIJS', pl: 'CENA JEDN.', ro: 'PREȚ UNIT.' },
  },
  {
    it: 'IMPORTO',
    translations: { en: 'AMOUNT', de: 'BETRAG', fr: 'MONTANT', es: 'IMPORTE', pt: 'VALOR', nl: 'BEDRAG', pl: 'KWOTA', ro: 'VALOARE' },
  },
  {
    it: 'TOTALE',
    translations: { en: 'TOTAL', de: 'GESAMT', fr: 'TOTAL', es: 'TOTAL', pt: 'TOTAL', nl: 'TOTAAL', pl: 'RAZEM', ro: 'TOTAL' },
  },
  {
    it: 'PESO TOT.',
    translations: { en: 'TOT. WEIGHT', de: 'GESAMTGEW.', fr: 'POIDS TOT.', es: 'PESO TOT.', pt: 'PESO TOT.', nl: 'TOT. GEWICHT', pl: 'WAGA CAŁK.', ro: 'GREUT. TOT.' },
  },
  {
    it: 'TRATTAMENTO RICHIESTO',
    translations: { en: 'REQUIRED TREATMENT', de: 'ERFORDERLICHE BEHANDLUNG', fr: 'TRAITEMENT REQUIS', es: 'TRATAMIENTO REQUERIDO', pt: 'TRATAMENTO REQUERIDO', nl: 'VEREISTE BEHANDELING', pl: 'WYMAGANA OBRÓBKA', ro: 'TRATAMENT SOLICITAT' },
  },
  {
    it: 'COMMESSA',
    translations: { en: 'JOB / ORDER', de: 'AUFTRAG', fr: 'COMMANDE', es: 'PEDIDO / OBRA', pt: 'OBRA / PEDIDO', nl: 'ORDER / PROJECT', pl: 'ZLECENIE', ro: 'COMANDĂ' },
  },
  {
    it: 'CLIENTE',
    translations: { en: 'CUSTOMER', de: 'KUNDE', fr: 'CLIENT', es: 'CLIENTE', pt: 'CLIENTE', nl: 'KLANT', pl: 'KLIENT', ro: 'CLIENT' },
  },
  {
    it: 'DESTINAZIONE',
    translations: { en: 'DESTINATION', de: 'ZIELORT', fr: 'DESTINATION', es: 'DESTINO', pt: 'DESTINO', nl: 'BESTEMMING', pl: 'MIEJSCE DOCELOWE', ro: 'DESTINAȚIE' },
  },
  {
    it: 'VETTORE / MEZZO',
    translations: { en: 'CARRIER / VEHICLE', de: 'SPEDITION / FAHRZEUG', fr: 'TRANSPORTEUR / VÉHICULE', es: 'TRANSPORTISTA / VEHÍCULO', pt: 'TRANSPORTADORA / VEÍCULO', nl: 'VERVOERDER / VOERTUIG', pl: 'PRZEWOŹNIK / POJAZD', ro: 'TRANSPORTATOR / VEHICUL' },
  },
  {
    it: 'VETTORE',
    translations: { en: 'CARRIER', de: 'SPEDITION', fr: 'TRANSPORTEUR', es: 'TRANSPORTISTA', pt: 'TRANSPORTADORA', nl: 'VERVOERDER', pl: 'PRZEWOŹNIK', ro: 'TRANSPORTATOR' },
  },
  {
    it: 'TERZISTA / FORNITORE',
    translations: { en: 'SUBCONTRACTOR / SUPPLIER', de: 'UNTERAUFTRAGNEHMER / LIEFERANT', fr: 'SOUS-TRAITANT / FOURNISSEUR', es: 'PROVEEDOR / TALLER', pt: 'FORNECEDOR / PARCEIRO', nl: 'LEVERANCIER', pl: 'PODWYKONAWCA / DOSTAWCA', ro: 'FURNIZOR / SUBCONTRACTOR' },
  },
  {
    it: 'FINITURA',
    translations: { en: 'FINISH', de: 'OBERFLÄCHE', fr: 'FINITION', es: 'ACABADO', pt: 'ACABAMENTO', nl: 'AFWERKING', pl: 'WYKOŃCZENIE', ro: 'FINISAJ' },
  },
  {
    it: 'CONSEGNA RICHIESTA',
    translations: { en: 'REQUESTED DELIVERY', de: 'GEWÜNSCHTE LIEFERUNG', fr: 'LIVRAISON DEMANDÉE', es: 'ENTREGA SOLICITADA', pt: 'ENTREGA SOLICITADA', nl: 'GEWENSTE LEVERING', pl: 'WYMAGANA DOSTAWA', ro: 'LIVRARE SOLICITATĂ' },
  },
  {
    it: 'CONSEGNA PREVISTA',
    translations: { en: 'ESTIMATED DELIVERY', de: 'VORAUSSICHTL. LIEFERUNG', fr: 'LIVRAISON PRÉVUE', es: 'ENTREGA PREVISTA', pt: 'ENTREGA PREVISTA', nl: 'VERWACHTE LEVERING', pl: 'PLANOWANA DOSTAWA', ro: 'LIVRARE ESTIMATĂ' },
  },
  {
    it: 'VALIDITÀ OFFERTA',
    translations: { en: 'OFFER VALIDITY', de: 'ANGEBOTSGÜLTIGKEIT', fr: 'VALIDITÉ DE L’OFFRE', es: 'VALIDEZ DE LA OFERTA', pt: 'VALIDADE DA PROPOSTA', nl: 'GELDIGHEID OFFERTE', pl: 'WAŻNOŚĆ OFERTY', ro: 'VALABILITATE OFERTĂ' },
  },
  {
    it: 'PAGAMENTO',
    translations: { en: 'PAYMENT', de: 'ZAHLUNG', fr: 'PAIEMENT', es: 'PAGO', pt: 'PAGAMENTO', nl: 'BETALING', pl: 'PŁATNOŚĆ', ro: 'PLATĂ' },
  },
  {
    it: 'SUBTOTALE MERCI',
    translations: { en: 'GOODS SUBTOTAL', de: 'WARENWERT NETTO', fr: 'SOUS-TOTAL MARCHANDISES', es: 'SUBTOTAL MERCANCÍAS', pt: 'SUBTOTAL MERCADORIAS', nl: 'SUBTOTAAL GOEDEREN', pl: 'WARTOŚĆ TOWARÓW', ro: 'SUBTOTAL MARFĂ' },
  },
  {
    it: 'TRASPORTO E IMBALLO',
    translations: { en: 'FREIGHT & PACKAGING', de: 'FRACHT & VERPACKUNG', fr: 'TRANSPORT & EMBALLAGE', es: 'TRANSPORTE Y EMBALAJE', pt: 'TRANSPORTE E EMBALAGEM', nl: 'VRACHT & VERPAKKING', pl: 'TRANSPORT I PAKOWANIE', ro: 'TRANSPORT ȘI AMBALARE' },
  },
  {
    it: 'IMPONIBILE STIMATO',
    translations: { en: 'ESTIMATED SUBTOTAL', de: 'GESCHÄTZTER NETTOBETRAG', fr: 'MONTANT HT ESTIMÉ', es: 'BASE IMPONIBLE ESTIMADA', pt: 'SUBTOTAL ESTIMADO', nl: 'GESCHAT SUBTOTAAL', pl: 'SZACOWANA WARTOŚĆ NETTO', ro: 'SUBTOTAL ESTIMAT' },
  },
  {
    it: 'TOTALE QUANTITÀ ORDINATA',
    translations: { en: 'TOTAL ORDERED QUANTITY', de: 'GESAMTBESTELLMENGE', fr: 'QUANTITÉ TOTALE COMMANDÉE', es: 'CANTIDAD TOTAL PEDIDA', pt: 'QUANTIDADE TOTAL ENCOMENDADA', nl: 'TOTAAL BESTELD AANTAL', pl: 'ŁĄCZNA ILOŚĆ ZAMÓWIONA', ro: 'CANTITATE TOTALĂ COMANDATĂ' },
  },
  {
    it: 'RICHIEDENTE',
    translations: { en: 'REQUESTER', de: 'ANFORDERER', fr: 'DEMANDEUR', es: 'SOLICITANTE', pt: 'SOLICITANTE', nl: 'AANVRAGER', pl: 'ZAMAWIAJĄCY', ro: 'SOLICITANT' },
  },
  {
    it: 'DATA',
    translations: { en: 'DATE', de: 'DATUM', fr: 'DATE', es: 'FECHA', pt: 'DATA', nl: 'DATUM', pl: 'DATA', ro: 'DATA' },
  },
  {
    it: 'DIMENSIONI',
    translations: { en: 'DIMENSIONS', de: 'ABMESSUNGEN', fr: 'DIMENSIONS', es: 'DIMENSIONES', pt: 'DIMENSÕES', nl: 'AFMETINGEN', pl: 'WYMIARY', ro: 'DIMENSIUNI' },
  },
  {
    it: 'ALTEZZA',
    translations: { en: 'HEIGHT', de: 'HÖHE', fr: 'HAUTEUR', es: 'ALTURA', pt: 'ALTURA', nl: 'HOOGTE', pl: 'WYSOKOŚĆ', ro: 'ÎNĂLȚIME' },
  },
  {
    it: 'TARA',
    translations: { en: 'TARE', de: 'TARA', fr: 'TARE', es: 'TARA', pt: 'TARA', nl: 'TARRA', pl: 'TARA', ro: 'TARA' },
  },
  {
    it: 'FRAGILE',
    translations: { en: 'FRAGILE', de: 'ZERBRECHLICH', fr: 'FRAGILE', es: 'FRÁGIL', pt: 'FRÁGIL', nl: 'BREEKBAAR', pl: 'OSTROŻNIE / KRUCHE', ro: 'FRAGIL' },
  },
  {
    it: 'FASCIATO',
    translations: { en: 'WRAPPED', de: 'FOLIERT', fr: 'FILMÉ', es: 'ENFILMADO', pt: 'ENFAIXADO', nl: 'GEWIKKELD', pl: 'OWINIĘTY', ro: 'ÎNFOLIAT' },
  },
  {
    it: 'SIGILLATO',
    translations: { en: 'SEALED', de: 'VERSIEGELT', fr: 'SCELLÉ', es: 'PRECINTADO', pt: 'SELADO', nl: 'VERZEGELD', pl: 'ZAMKNIĘTY', ro: 'SIGILAT' },
  },
  {
    it: 'CONTENUTO',
    translations: { en: 'CONTENTS', de: 'INHALT', fr: 'CONTENU', es: 'CONTENIDO', pt: 'CONTEÚDO', nl: 'INHOUD', pl: 'ZAWARTOŚĆ', ro: 'CONȚINUT' },
  },
  {
    it: 'ARTICOLI',
    translations: { en: 'ITEMS', de: 'ARTIKEL', fr: 'ARTICLES', es: 'ARTÍCULOS', pt: 'ARTIGOS', nl: 'ARTIKELEN', pl: 'ARTYKUŁY', ro: 'ARTICOLE' },
  },
  {
    it: 'PEZZI',
    translations: { en: 'PIECES', de: 'STÜCK', fr: 'PIÈCES', es: 'PIEZAS', pt: 'PEÇAS', nl: 'STUKS', pl: 'SZTUK', ro: 'BUCĂȚI' },
  },
  {
    it: 'UBICAZIONE',
    translations: { en: 'LOCATION', de: 'LAGERPLATZ', fr: 'EMPLACEMENT', es: 'UBICACIÓN', pt: 'LOCALIZAÇÃO', nl: 'LOCATIE', pl: 'LOKALIZACJA', ro: 'LOCAȚIE' },
  },
  {
    it: 'NOTE',
    translations: { en: 'NOTES', de: 'HINWEISE', fr: 'NOTES', es: 'NOTAS', pt: 'NOTAS', nl: 'NOTITIES', pl: 'UWAGI', ro: 'NOTE' },
  },
  {
    it: 'FIRMA OPERATORE',
    translations: { en: 'OPERATOR SIGNATURE', de: 'UNTERSCHRIFT BEDIENER', fr: 'SIGNATURE OPÉRATEUR', es: 'FIRMA OPERADOR', pt: 'ASSINATURA OPERADOR', nl: 'HANDTEKENING OPERATOR', pl: 'PODPIS OPERATORA', ro: 'SEMNĂTURĂ OPERATOR' },
  },
  {
    it: 'FIRMA RESPONSABILE',
    translations: { en: 'SUPERVISOR SIGNATURE', de: 'UNTERSCHRIFT LEITER', fr: 'SIGNATURE RESPONSABLE', es: 'FIRMA RESPONSABLE', pt: 'ASSINATURA RESPONSÁVEL', nl: 'HANDTEKENING VERANTWOORDELIJKE', pl: 'PODPIS KIEROWNIKA', ro: 'SEMNĂTURĂ RESPONSABIL' },
  },
  {
    it: 'FIRMA AUTISTA',
    translations: { en: 'DRIVER SIGNATURE', de: 'UNTERSCHRIFT FAHRER', fr: 'SIGNATURE CHAUFFEUR', es: 'FIRMA CONDUCTOR', pt: 'ASSINATURA MOTORISTA', nl: 'HANDTEKENING CHAUFFEUR', pl: 'PODPIS KIEROWCY', ro: 'SEMNĂTURĂ ȘOFER' },
  },
  {
    it: 'CAUSALE',
    translations: { en: 'REASON', de: 'GRUND', fr: 'MOTIF', es: 'MOTIVO', pt: 'MOTIVO', nl: 'REDEN', pl: 'POWÓD', ro: 'MOTIV' },
  },
  {
    it: 'PORTO',
    translations: { en: 'FREIGHT', de: 'FRACHT', fr: 'PORT', es: 'PORTE', pt: 'PORTE', nl: 'VRACHT', pl: 'PRZEWÓZ', ro: 'TRANSPORT' },
  },
  {
    it: 'TRASPORTO STIMATO',
    translations: { en: 'ESTIMATED TRANSPORT', de: 'GESCHÄTZTER TRANSPORT', fr: 'TRANSPORT ESTIMÉ', es: 'TRANSPORTE ESTIMADO', pt: 'TRANSPORTE ESTIMADO', nl: 'GESCHAT TRANSPORT', pl: 'SZACOWANY TRANSPORT', ro: 'TRANSPORT ESTIMAT' },
  },
  {
    it: 'OGGETTO',
    translations: { en: 'SUBJECT', de: 'BETREFF', fr: 'OBJET', es: 'ASUNTO', pt: 'ASSUNTO', nl: 'ONDERWERP', pl: 'TEMAT', ro: 'SUBIECT' },
  },
  {
    it: 'DA QUOTARE',
    translations: { en: 'TBD', de: 'AUF ANFRAGE', fr: 'À CHIFFRER', es: 'A COTIZAR', pt: 'A COTAR', nl: 'N.T.B.', pl: 'DO WYCENY', ro: 'DE COTAT' },
  },
  {
    it: 'DA COMPILARE AL RITIRO',
    translations: { en: 'TO BE COMPLETED AT PICKUP', de: 'BEI ABHOLUNG AUSZUFÜLLEN', fr: 'À COMPLÉTER À L’ENLÈVEMENT', es: 'A COMPLETAR EN LA RECOGIDA', pt: 'A PREENCHER NA RECOLHA', nl: 'IN TE VULLEN BIJ AFHALING', pl: 'DO UZUPEŁNIENIA PRZY ODBIORZE', ro: 'DE COMPLETAT LA RIDICARE' },
  },
  {
    it: 'MEDESIMO INDIRIZZO DESTINATARIO',
    translations: { en: 'SAME AS RECIPIENT ADDRESS', de: 'IDENTISCH MIT EMPFÄNGERADRESSE', fr: 'IDENTIQUE À L’ADRESSE DESTINATAIRE', es: 'MISMA DIRECCIÓN DESTINATARIO', pt: 'MESMO ENDEREÇO DO DESTINATÁRIO', nl: 'ZELFDE ALS ONTVANGERADRES', pl: 'TEN SAM ADRES ODBIORCY', ro: 'ACEEAȘI ADRESĂ CA DESTINATARUL' },
  },
  {
    it: 'CARICO',
    translations: { en: 'STOCK IN', de: 'ZUGANG', fr: 'ENTRÉE', es: 'ENTRADA', pt: 'ENTRADA', nl: 'INVOER', pl: 'PRZYJĘCIE', ro: 'INTRARE' },
  },
  {
    it: 'SCARICO',
    translations: { en: 'STOCK OUT', de: 'ABGANG', fr: 'SORTIE', es: 'SALIDA', pt: 'SAÍDA', nl: 'UITVOER', pl: 'WYDANIE', ro: 'IEȘIRE' },
  },
  {
    it: 'CONFERMA',
    translations: { en: 'CONFIRM', de: 'BESTÄTIGEN', fr: 'CONFIRMER', es: 'CONFIRMAR', pt: 'CONFIRMAR', nl: 'BEVESTIGEN', pl: 'POTWIERDŹ', ro: 'CONFIRMĂ' },
  },
  {
    it: 'ANNULLA',
    translations: { en: 'CANCEL', de: 'ABBRECHEN', fr: 'ANNULER', es: 'CANCELAR', pt: 'CANCELAR', nl: 'ANNULEREN', pl: 'ANULUJ', ro: 'ANULEAZĂ' },
  },
];

// Ordina le frasi dalla più lunga alla più corta per evitare sostituzioni parziali
const SORTED_STATIC_PHRASES = [...STATIC_PHRASES].sort((a, b) => b.it.length - a.it.length);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Localizza istantaneamente le etichette statiche / intestazioni italiane
 * nella lingua di stampa scelta.
 */
export function localizeStaticPrintText(text: string, lang: PrintLanguageCode): string {
  if (!text || lang === 'it') return text;
  let out = text;

  for (const entry of SORTED_STATIC_PHRASES) {
    const replacement = entry.translations[lang];
    if (!replacement) continue;
    const isShort = entry.it.length <= 6;
    const pattern = isShort
      ? new RegExp(`\\b${escapeRegex(entry.it)}\\b`, 'gi')
      : new RegExp(escapeRegex(entry.it), 'gi');

    out = out.replace(pattern, (match) => {
      // Mantieni maiuscolo se l'originale è tutto maiuscolo, altrimenti Title/Sentence case
      if (match === match.toUpperCase() && match !== match.toLowerCase()) {
        return replacement.toUpperCase();
      }
      if (match[0] === match[0].toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
      }
      return replacement.toLowerCase();
    });
  }

  return out;
}

/**
 * Avvolge doc.text di una qualsiasi istanza jsPDF così che TUTTE le intestazioni,
 * colonne e didascalie statiche del PDF escano automaticamente nella lingua selezionata
 * e siano compatibili al 100% col font PDF Latin-1.
 */
export function applyPrintLanguageToJsPdf(doc: jsPDF, lang: PrintLanguageCode): jsPDF {
  if (lang === 'it') return doc;
  const anyDoc = doc as any;
  if (anyDoc.__metatronLangWrapped === lang) return doc;
  const origText = anyDoc.text.bind(doc);

  anyDoc.text = (text: any, x: any, y: any, options?: any, transform?: any) => {
    const transformOne = (val: string) =>
      sanitizeForJsPdfLatin1(localizeStaticPrintText(val, lang));
    let localized = text;
    if (typeof text === 'string') {
      localized = transformOne(text);
    } else if (Array.isArray(text)) {
      localized = text.map((line) => (typeof line === 'string' ? transformOne(line) : line));
    }
    return origText(localized, x, y, options, transform);
  };
  anyDoc.__metatronLangWrapped = lang;
  return doc;
}

/**
 * Traduce un batch di stringhe dinamiche con Gemini 4 AI (server-side)
 * usando cache di sessione istantanea e fallback deterministico per EN offline.
 */
export async function translateTextsForPrint(
  texts: string[],
  targetLang: PrintLanguageCode,
  domain?: string
): Promise<string[]> {
  if (targetLang === 'it' || texts.length === 0) return texts;
  hydrateCache();

  const result = [...texts];
  const pendingIndices: number[] = [];
  const pendingValues: string[] = [];

  texts.forEach((raw, idx) => {
    const trimmed = (raw || '').trim();
    if (!trimmed || /^[0-9.,:/\-+×xX%€$£\s#]+$/.test(trimmed)) {
      return;
    }
    const cacheKey = `${targetLang}::${trimmed}`;
    const cached = memoryTranslationCache.get(cacheKey);
    if (cached) {
      result[idx] = cached;
    } else {
      pendingIndices.push(idx);
      pendingValues.push(trimmed);
    }
  });

  if (pendingValues.length === 0) {
    return result;
  }

  // Deduplica le stringhe uniche da mandare all'AI
  const uniqueMap = new Map<string, number[]>();
  pendingValues.forEach((val, i) => {
    const list = uniqueMap.get(val) || [];
    list.push(pendingIndices[i]);
    uniqueMap.set(val, list);
  });
  const uniqueList = Array.from(uniqueMap.keys());

  try {
    const res = await authFetch('/api/ai/translate-texts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: uniqueList,
        targetLanguage: targetLang,
        domain:
          domain ||
          'industrial warehouse labels, pallets, boxes, DDT delivery notes, purchase orders and commercial quotes',
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json?.success && Array.isArray(json.translations)) {
        uniqueList.forEach((orig, uIdx) => {
          const translated =
            typeof json.translations[uIdx] === 'string' && json.translations[uIdx].trim()
              ? json.translations[uIdx]
              : orig;
          memoryTranslationCache.set(`${targetLang}::${orig}`, translated);
          const targets = uniqueMap.get(orig) || [];
          targets.forEach((tIdx) => {
            result[tIdx] = translated;
          });
        });
        persistCache();
        return result;
      }
    }
  } catch (err) {
    console.warn('AI batch print translation fallback:', err);
  }

  // Fallback locale deterministico (soprattutto per EN / static labels)
  pendingIndices.forEach((idx) => {
    const orig = result[idx];
    const localized = localizeStaticPrintText(orig, targetLang);
    result[idx] = targetLang === 'en' ? translateItalianToEnglish(localized) : localized;
  });
  return result;
}

/**
 * Traduce un'intera commessa (titolo, destinazione, bancali, scatole, articoli, cartelli verniciatura)
 * nella lingua scelta per qualsiasi stampa o PDF.
 */
export async function translateLoadForPrint(
  load: CargoLoad,
  targetLang: PrintLanguageCode
): Promise<CargoLoad> {
  if (targetLang === 'it') return load;

  const bucket: string[] = [];
  const push = (val?: string): number => {
    const idx = bucket.length;
    bucket.push(val || '');
    return idx;
  };

  const titleIdx = push(load.title);
  const destIdx = push(load.destination);

  const palletIdxs = load.pallets.map((p) => ({
    label: push(p.label),
    notes: push(p.notes),
  }));
  const boxIdxs = load.boxes.map((b) => ({
    label: push(b.label),
  }));
  const itemIdxs = load.items.map((it) => ({
    name: push(it.name),
    category: push(it.category),
    notes: push(it.notes),
  }));
  const tagIdxs = (load.finishingTags || []).map((t) => ({
    commessaTitle: push(t.commessaTitle),
    treatmentText: push(t.treatmentText),
    finishType: push(t.finishType),
    quantityOrPieces: push(t.quantityOrPieces),
    notes: push(t.notes),
  }));

  const translated = await translateTextsForPrint(
    bucket,
    targetLang,
    'shipment packing list, pallet labels, box labels, industrial parts and surface finishing tags (preserve SKUs and RAL codes)'
  );

  return {
    ...load,
    title: translated[titleIdx] || load.title,
    destination: translated[destIdx] || load.destination,
    pallets: load.pallets.map((p, i) => ({
      ...p,
      label: translated[palletIdxs[i].label] || p.label,
      notes: translated[palletIdxs[i].notes] || p.notes,
    })),
    boxes: load.boxes.map((b, i) => ({
      ...b,
      label: translated[boxIdxs[i].label] || b.label,
    })),
    items: load.items.map((it, i) => ({
      ...it,
      name: translated[itemIdxs[i].name] || it.name,
      category: translated[itemIdxs[i].category] || it.category,
      notes: translated[itemIdxs[i].notes] || it.notes,
    })),
    finishingTags: load.finishingTags?.map((t, i) => ({
      ...t,
      commessaTitle: translated[tagIdxs[i].commessaTitle] || t.commessaTitle,
      treatmentText: translated[tagIdxs[i].treatmentText] || t.treatmentText,
      finishType: translated[tagIdxs[i].finishType] || t.finishType,
      quantityOrPieces: translated[tagIdxs[i].quantityOrPieces] || t.quantityOrPieces,
      notes: translated[tagIdxs[i].notes] || t.notes,
    })),
  };
}

/**
 * Traduce un elenco di Cartelli Verniciatura / RAL / Zincatura
 */
export async function translateFinishingTagsForPrint(
  tags: FinishingCartello[],
  targetLang: PrintLanguageCode
): Promise<FinishingCartello[]> {
  if (targetLang === 'it' || tags.length === 0) return tags;
  const bucket: string[] = [];
  const push = (v?: string) => {
    const i = bucket.length;
    bucket.push(v || '');
    return i;
  };
  const mapIdx = tags.map((t) => ({
    commessaTitle: push(t.commessaTitle),
    treatmentText: push(t.treatmentText),
    finishType: push(t.finishType),
    quantityOrPieces: push(t.quantityOrPieces),
    notes: push(t.notes),
  }));
  const tx = await translateTextsForPrint(
    bucket,
    targetLang,
    'industrial painting, powder coating, galvanizing and RAL surface treatment tags (preserve RAL numbers verbatim)'
  );
  return tags.map((t, i) => ({
    ...t,
    commessaTitle: tx[mapIdx[i].commessaTitle] || t.commessaTitle,
    treatmentText: tx[mapIdx[i].treatmentText] || t.treatmentText,
    finishType: tx[mapIdx[i].finishType] || t.finishType,
    quantityOrPieces: tx[mapIdx[i].quantityOrPieces] || t.quantityOrPieces,
    notes: tx[mapIdx[i].notes] || t.notes,
  }));
}

/**
 * Traduce un D.D.T. (Documento di Trasporto) per stampa PDF internazionale
 */
export async function translateDdtForPrint(
  ddt: DdtDocument,
  targetLang: PrintLanguageCode
): Promise<DdtDocument> {
  if (targetLang === 'it') return ddt;
  const bucket: string[] = [];
  const push = (v?: string) => {
    const i = bucket.length;
    bucket.push(v || '');
    return i;
  };
  const causalIdx = push(ddt.causal);
  const transportByIdx = push(ddt.transportBy);
  const appearanceIdx = push(ddt.appearance);
  const portoIdx = push(ddt.porto);
  const notesIdx = push(ddt.notes);
  const itemIdxs = ddt.items.map((it) => ({
    description: push(it.description),
    unit: push(it.unit),
    notes: push(it.notes),
  }));

  const tx = await translateTextsForPrint(
    bucket,
    targetLang,
    'international delivery note (DDT / packing slip) transport terms and goods descriptions'
  );

  return {
    ...ddt,
    causal: (tx[causalIdx] || ddt.causal) as any,
    transportBy: (tx[transportByIdx] || ddt.transportBy) as any,
    appearance: tx[appearanceIdx] || ddt.appearance,
    porto: (tx[portoIdx] || ddt.porto) as any,
    notes: tx[notesIdx] || ddt.notes,
    items: ddt.items.map((it, i) => ({
      ...it,
      description: tx[itemIdxs[i].description] || it.description,
      unit: tx[itemIdxs[i].unit] || it.unit,
      notes: tx[itemIdxs[i].notes] || it.notes,
    })),
  };
}

/**
 * Traduce un Ordine di Acquisto Fornitore (O.D.A.) per fornitori esteri
 */
export async function translatePurchaseOrderForPrint(
  po: PurchaseOrder,
  targetLang: PrintLanguageCode
): Promise<PurchaseOrder> {
  if (targetLang === 'it') return po;
  const bucket: string[] = [];
  const push = (v?: string) => {
    const i = bucket.length;
    bucket.push(v || '');
    return i;
  };
  const paymentIdx = push(po.paymentTerms);
  const notesIdx = push(po.notes);
  const itemIdxs = po.items.map((it) => ({
    name: push(it.name),
    unit: push(it.unit),
    notes: push(it.notes),
  }));

  const tx = await translateTextsForPrint(
    bucket,
    targetLang,
    'supplier purchase order (PO) commercial terms and industrial product names'
  );

  return {
    ...po,
    paymentTerms: tx[paymentIdx] || po.paymentTerms,
    notes: tx[notesIdx] || po.notes,
    items: po.items.map((it, i) => ({
      ...it,
      name: tx[itemIdxs[i].name] || it.name,
      unit: tx[itemIdxs[i].unit] || it.unit,
      notes: tx[itemIdxs[i].notes] || it.notes,
    })),
  };
}
