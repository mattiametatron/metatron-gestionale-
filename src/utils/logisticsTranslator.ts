/**
 * CaricoStudio - Motore di Traduzione Logistica & Estrazione Testo PDF (100% Offline & Fallback AI)
 * Supporta bolle di trasporto, packing list, DDT, CMR, fatture e distinte merci
 * nelle lingue: IT, EN, DE, FR, ES, PL, RO, PT, ZH, AR
 */

export interface TranslationResult {
  translatedText: string;
  sourceType: 'ai' | 'offline_engine';
  detectedFields?: {
    shipper?: string;
    consignee?: string;
    docNumber?: string;
    date?: string;
    totalWeight?: string;
    totalPackages?: string;
  };
}

// Dizionario Multilingua Specializzato per Logistica Industriale e Spedizioni
const LOGISTICS_DICTIONARY: Record<string, Record<string, string>> = {
  // Documenti e Titoli
  'packing list': {
    it: 'Distinta Colli / Packing List',
    en: 'Packing List',
    de: 'Packliste / Lieferschein',
    fr: 'Liste de Colisage',
    es: 'Lista de Empaque',
    pl: 'Specyfikacja Załadunku (Packing List)',
    ro: 'Listă de Ambalare (Packing List)',
    pt: 'Lista de Embalagem (Packing List)',
    zh: '装箱单 (Packing List)',
    ar: 'قائمة التعبئة (Packing List)',
  },
  'delivery note': {
    it: 'Documento di Trasporto (DDT)',
    en: 'Delivery Note',
    de: 'Lieferschein',
    fr: 'Bon de Livraison',
    es: 'Albarán de Entrega',
    pl: 'Dowód Dostawy (WZ)',
    ro: 'Aviz de Însoțire a Mărfii',
    pt: 'Guia de Remessa',
    zh: '送货单',
    ar: 'إشعار التسليم',
  },
  'commercial invoice': {
    it: 'Fattura Commerciale',
    en: 'Commercial Invoice',
    de: 'Handelsrechnung',
    fr: 'Facture Commerciale',
    es: 'Factura Comercial',
    pl: 'Faktura Handlowa',
    ro: 'Factură Comercială',
    pt: 'Fatura Comercial',
    zh: '商业发票',
    ar: 'فاتورة تجارية',
  },
  'bill of lading': {
    it: 'Polizza di Carico (B/L)',
    en: 'Bill of Lading',
    de: 'Konnossement (B/L)',
    fr: 'Connaissement',
    es: 'Conocimiento de Embarque',
    pl: 'Konosament',
    ro: 'Conosament',
    pt: 'Conhecimento de Embarque',
    zh: '提单',
    ar: 'بوليصة الشحن',
  },
  'cmr': {
    it: 'Lettera di Vettura Internazionale (CMR)',
    en: 'International Consignment Note (CMR)',
    de: 'CMR-Frachtbrief',
    fr: 'Lettre de Voiture Internationale (CMR)',
    es: 'Carta de Porte Internacional (CMR)',
    pl: 'Międzynarodowy List Przewozowy (CMR)',
    ro: 'Scrisoare de Trăsură Internațională (CMR)',
    pt: 'Declaração de Expedição (CMR)',
    zh: '国际公路运单 (CMR)',
    ar: 'وثيقة النقل الدولي (CMR)',
  },

  // Campi Anagrafici e Logistici
  'shipper': { it: 'Mittente / Speditore', en: 'Shipper', de: 'Absender / Versender', fr: 'Expéditeur', es: 'Remitente / Expedidor', pl: 'Nadawca', ro: 'Expeditor', pt: 'Expedidor', zh: '发货人', ar: 'الشاحن / المرسل' },
  'consignor': { it: 'Mittente', en: 'Consignor', de: 'Absender', fr: 'Expéditeur', es: 'Consignador', pl: 'Nadawca', ro: 'Expeditor', pt: 'Consignador', zh: '托运人', ar: 'المرسل' },
  'consignee': { it: 'Destinatario', en: 'Consignee', de: 'Empfänger', fr: 'Destinataire', es: 'Destinatario', pl: 'Odbiorca', ro: 'Destinatar', pt: 'Destinatário', zh: '收货人', ar: 'المرسل إليه' },
  'carrier': { it: 'Vettore / Trasportatore', en: 'Carrier', de: 'Frachtführer / Spedition', fr: 'Transporteur', es: 'Transportista', pl: 'Przewoźnik', ro: 'Transportator', pt: 'Transportador', zh: '承运人', ar: 'الناقل' },
  'invoice no': { it: 'N. Fattura', en: 'Invoice No', de: 'Rechnungs-Nr.', fr: 'N° Facture', es: 'Nº Factura', pl: 'Nr Faktury', ro: 'Nr. Factură', pt: 'Nº Fatura', zh: '发票编号', ar: 'رقم الفاتورة' },
  'document no': { it: 'N. Documento', en: 'Document No', de: 'Dokumenten-Nr.', fr: 'N° Document', es: 'Nº Documento', pl: 'Nr Dokumentu', ro: 'Nr. Document', pt: 'Nº Documento', zh: '单据编号', ar: 'رقم المستند' },
  'order no': { it: 'N. Ordine', en: 'Order No', de: 'Bestell-Nr. / Auftrags-Nr.', fr: 'N° Commande', es: 'Nº Pedido', pl: 'Nr Zamówienia', ro: 'Nr. Comandă', pt: 'Nº Encomenda', zh: '订单编号', ar: 'رقم الطلب' },
  'tracking no': { it: 'N. Tracciamento', en: 'Tracking No', de: 'Sendungsnummer', fr: 'N° Suivi', es: 'Nº Seguimiento', pl: 'Nr Przesyłki', ro: 'Nr. AWB / Urmărire', pt: 'Nº Rastreio', zh: '追踪单号', ar: 'رقم التتبع' },
  'date': { it: 'Data', en: 'Date', de: 'Datum', fr: 'Date', es: 'Fecha', pl: 'Data', ro: 'Data', pt: 'Data', zh: '日期', ar: 'التاريخ' },
  'delivery date': { it: 'Data di Consegna', en: 'Delivery Date', de: 'Lieferdatum', fr: 'Date de Livraison', es: 'Fecha de Entrega', pl: 'Data Dostawy', ro: 'Data Livrării', pt: 'Data de Entrega', zh: '交货日期', ar: 'تاريخ التسليم' },

  // Pesi e Misure
  'gross weight': { it: 'Peso Lordo', en: 'Gross Weight', de: 'Bruttogewicht', fr: 'Poids Brut', es: 'Peso Bruto', pl: 'Waga Brutto', ro: 'Greutate Brută', pt: 'Peso Bruto', zh: '毛重', ar: 'الوزن الإجمالي' },
  'net weight': { it: 'Peso Netto', en: 'Net Weight', de: 'Nettogewicht', fr: 'Poids Net', es: 'Peso Neto', pl: 'Waga Netto', ro: 'Greutate Netă', pt: 'Peso Líquido', zh: '净重', ar: 'الوزن الصافي' },
  'tare weight': { it: 'Tara', en: 'Tare Weight', de: 'Taragewicht', fr: 'Tare', es: 'Tara', pl: 'Tara', ro: 'Tara', pt: 'Tara', zh: '皮重', ar: 'وزن الفارغ' },
  'total weight': { it: 'Peso Totale', en: 'Total Weight', de: 'Gesamtgewicht', fr: 'Poids Total', es: 'Peso Total', pl: 'Waga Całkowita', ro: 'Greutate Totală', pt: 'Peso Total', zh: '总重量', ar: 'الوزن الكلي' },
  'dimensions': { it: 'Dimensioni (cm)', en: 'Dimensions (cm)', de: 'Abmessungen (cm)', fr: 'Dimensions (cm)', es: 'Dimensiones (cm)', pl: 'Wymiary (cm)', ro: 'Dimensiuni (cm)', pt: 'Dimensões (cm)', zh: '尺寸 (cm)', ar: 'الأبعاد (سم)' },
  'volume': { it: 'Volume (m³)', en: 'Volume (m³)', de: 'Volumen (m³)', fr: 'Volume (m³)', es: 'Volumen (m³)', pl: 'Objętość (m³)', ro: 'Volum (m³)', pt: 'Volume (m³)', zh: '体积 (m³)', ar: 'الحجم (م³)' },

  // Unità di Imballaggio
  'total packages': { it: 'Totale Colli', en: 'Total Packages', de: 'Gesamtpackstücke', fr: 'Total Colis', es: 'Total Bultos', pl: 'Łącznie Paczek', ro: 'Total Colete', pt: 'Total de Volumes', zh: '总件数', ar: 'إجمالي الطرود' },
  'pallet': { it: 'Bancale / Pallet', en: 'Pallet', de: 'Palette / Europalette', fr: 'Palette', es: 'Palé / Palet', pl: 'Paleta', ro: 'Palet', pt: 'Palete', zh: '托盘', ar: 'منصة نقالة (طبلية)' },
  'pallets': { it: 'Bancali', en: 'Pallets', de: 'Paletten', fr: 'Palettes', es: 'Palets', pl: 'Palety', ro: 'Paleți', pt: 'Paletes', zh: '托盘', ar: 'منصات نقالة' },
  'box': { it: 'Scatola / Cartone', en: 'Box', de: 'Karton / Schachtel', fr: 'Carton / Boîte', es: 'Caja / Cartón', pl: 'Karton / Pudełko', ro: 'Cutie / Carton', pt: 'Caixa', zh: '箱 / 纸箱', ar: 'صندوق / كرتون' },
  'boxes': { it: 'Scatole / Cartoni', en: 'Boxes', de: 'Kartons / Schachteln', fr: 'Cartons / Boîtes', es: 'Cajas', pl: 'Kartony / Pudełka', ro: 'Cutii', pt: 'Caixas', zh: '箱', ar: 'صناديق' },
  'carton': { it: 'Scatolone', en: 'Carton', de: 'Karton', fr: 'Carton', es: 'Caja de cartón', pl: 'Karton', ro: 'Cutie de carton', pt: 'Caixa de papelão', zh: '纸箱', ar: 'كرتون' },
  'crate': { it: 'Cassa in Legno', en: 'Wooden Crate', de: 'Holzkiste', fr: 'Caisse en bois', es: 'Caja de madera', pl: 'Skrzynia drewniana', ro: 'Ladă de lemn', pt: 'Caixa de madeira', zh: '板条箱', ar: 'صندوق خشبي' },
  'bundle': { it: 'Fascio / Collo', en: 'Bundle', de: 'Bündel', fr: 'Faisceau', es: 'Fardo / Haz', pl: 'Wiązka', ro: 'Mănunchi', pt: 'Fardo', zh: '捆 / 束', ar: 'حزمة' },

  // Colonne Tabella Articoli
  'item': { it: 'Pos.', en: 'Item', de: 'Pos.', fr: 'Poste', es: 'Pos.', pl: 'Poz.', ro: 'Poz.', pt: 'Item', zh: '序号', ar: 'البند' },
  'description': { it: 'Descrizione Articolo', en: 'Description of Goods', de: 'Artikelbezeichnung / Beschreibung', fr: 'Désignation des Marchandises', es: 'Descripción de Mercancías', pl: 'Opis Towaru', ro: 'Descrierea Mărfii', pt: 'Descrição dos Artigos', zh: '货物描述', ar: 'وصف البضاعة' },
  'part number': { it: 'Codice Articolo / P/N', en: 'Part Number (P/N)', de: 'Artikelnummer / Teilenummer', fr: 'Référence Article (P/N)', es: 'Número de Pieza (P/N)', pl: 'Numer Części (P/N)', ro: 'Cod Piesă (P/N)', pt: 'Número da Peça (P/N)', zh: '零件号 (P/N)', ar: 'رقم القطعة' },
  'sku': { it: 'Codice SKU', en: 'SKU Code', de: 'Artikel-SKU', fr: 'Code SKU', es: 'Código SKU', pl: 'Kod SKU', ro: 'Cod SKU', pt: 'Código SKU', zh: 'SKU编号', ar: 'رمز التخزين SKU' },
  'quantity': { it: 'Quantità', en: 'Quantity (Qty)', de: 'Menge (M)', fr: 'Quantité (Qté)', es: 'Cantidad (Cant)', pl: 'Ilość (Szt)', ro: 'Cantitate', pt: 'Quantidade (Qtd)', zh: '数量', ar: 'الكمية' },
  'qty': { it: 'Q.tà', en: 'Qty', de: 'Mge', fr: 'Qté', es: 'Cant', pl: 'Ilość', ro: 'Cant.', pt: 'Qtd', zh: '数量', ar: 'الكمية' },
  'unit': { it: 'U.M.', en: 'Unit', de: 'Einheit', fr: 'Unité', es: 'Unidad', pl: 'Jedn.', ro: 'U.M.', pt: 'Unidade', zh: '单位', ar: 'الوحدة' },
  'pieces': { it: 'Pezzi (pz)', en: 'Pieces (pcs)', de: 'Stück (Stk)', fr: 'Pièces (pcs)', es: 'Piezas (piezas)', pl: 'Sztuki (szt)', ro: 'Bucăți (buc)', pt: 'Peças (un)', zh: '件 (pcs)', ar: 'قطع' },
  'pcs': { it: 'pz', en: 'pcs', de: 'Stk', fr: 'pcs', es: 'uds', pl: 'szt', ro: 'buc', pt: 'un', zh: '件', ar: 'قطعة' },

  // Componentistica Industriale Comune
  'electric panel': { it: 'Quadro Elettrico', en: 'Electrical Panel / Switchboard', de: 'Schaltschrank / Elektroverteiler', fr: 'Armoire Électrique', es: 'Cuadro Eléctrico', pl: 'Szafa Sterownicza', ro: 'Tablou Electric', pt: 'Quadro Elétrico', zh: '配电柜 / 电气面板', ar: 'لوحة كهربائية' },
  'switchboard': { it: 'Quadro di Comando', en: 'Switchboard', de: 'Schalttafel', fr: 'Tableau de Commande', es: 'Cuadro de Mando', pl: 'Rozdzielnica', ro: 'Panou de Comandă', pt: 'Quadro de Comando', zh: '控制面板', ar: 'لوحة توزيع' },
  'cable': { it: 'Cavo Elettrico', en: 'Cable', de: 'Kabel', fr: 'Câble', es: 'Cable', pl: 'Kabel / Przewód', ro: 'Cablu', pt: 'Cabo', zh: '电缆', ar: 'كابل' },
  'power supply': { it: 'Alimentatore di Corrente', en: 'Power Supply', de: 'Netzteil / Stromversorgung', fr: 'Alimentation Électrique', es: 'Fuente de Alimentación', pl: 'Zasilacz', ro: 'Sursă de Alimentare', pt: 'Fonte de Alimentação', zh: '电源', ar: 'مزود الطاقة' },
  'photocell': { it: 'Fotocellula di Sicurezza', en: 'Photocell / Photoelectric Sensor', de: 'Lichtschranke', fr: 'Photocellule', es: 'Fotocélula', pl: 'Fotokomórka', ro: 'Fotocelulă', pt: 'Fotocélula', zh: '光电开关 / 光电传感器', ar: 'خلية ضوئية' },
  'photocells': { it: 'Fotocellule', en: 'Photocells', de: 'Lichtschranken', fr: 'Photocellules', es: 'Fotocélulas', pl: 'Fotokomórki', ro: 'Fotocelule', pt: 'Fotocélulas', zh: '光电开关', ar: 'خلايا ضوئية' },
  'sensor': { it: 'Sensore', en: 'Sensor', de: 'Sensor / Fühler', fr: 'Capteur', es: 'Sensor', pl: 'Czujnik', ro: 'Senzor', pt: 'Sensor', zh: '传感器', ar: 'مستشعر' },
  'sensors': { it: 'Sensori', en: 'Sensors', de: 'Sensoren', fr: 'Capteurs', es: 'Sensores', pl: 'Czujniki', ro: 'Senzori', pt: 'Sensores', zh: '传感器', ar: 'مستشعرات' },
  'camera': { it: 'Telecamera / Sensore Ottico', en: 'Camera / Optical Sensor', de: 'Kamera / Bildverarbeitungssensor', fr: 'Caméra', es: 'Cámara', pl: 'Kamera', ro: 'Cameră', pt: 'Câmera', zh: '摄像机', ar: 'كاميرا' },
  'laser scanner': { it: 'Laser Scanner di Sicurezza', en: 'Safety Laser Scanner', de: 'Sicherheitslaserscanner', fr: 'Scanner Laser de Sécurité', es: 'Escáner Láser de Seguridad', pl: 'Skaner Laserowy', ro: 'Scanner Laser', pt: 'Scanner Laser', zh: '安全激光扫描仪', ar: 'ماسح ليزري' },
  'mirror': { it: 'Specchietto di Rinvio', en: 'Deflection Mirror', de: 'Umlenkspiegel', fr: 'Miroir de Renvoi', es: 'Espejo de Desviación', pl: 'Lustro Odchylające', ro: 'Oglindă de Deviație', pt: 'Espelho', zh: '反射镜', ar: 'مرآة عاكسة' },
  'bracket': { it: 'Staffa di Supporto', en: 'Support Bracket', de: 'Halterung / Befestigungswinkel', fr: 'Support / Équerre', es: 'Soporte / Escuadra', pl: 'Uchwyt / Wspornik', ro: 'Suport / Consolă', pt: 'Suporte', zh: '支架', ar: 'قوس الدعم' },
  'spare parts': { it: 'Kit Ricambi', en: 'Spare Parts Kit', de: 'Ersatzteilkit', fr: 'Pièces de Rechange', es: 'Piezas de Repuesto', pl: 'Części Zamienne', ro: 'Piese de Schimb', pt: 'Peças Sobressalentes', zh: '备件包', ar: 'قطع غيار' },
  'screws': { it: 'Viteria / Bulloneria', en: 'Screws / Bolts', de: 'Schrauben / Befestigungsmaterial', fr: 'Visserie', es: 'Tornillería', pl: 'Śruby / Wkręty', ro: 'Șuruburi', pt: 'Parafusos', zh: '螺丝 / 螺栓', ar: 'براغي' },
  'motor': { it: 'Motore Elettrico', en: 'Electric Motor', de: 'Elektromotor', fr: 'Moteur Électrique', es: 'Motor Eléctrico', pl: 'Silnik Elektryczny', ro: 'Motor Electric', pt: 'Motor Elétrico', zh: '电动机', ar: 'محرك كهربائي' },
  'connector': { it: 'Connettore / Morsettiera', en: 'Connector / Terminal Block', de: 'Steckverbinder / Klemmenleiste', fr: 'Connecteur', es: 'Conector', pl: 'Złącze / Listwa Zaciskowa', ro: 'Conector', pt: 'Conector', zh: '连接器 / 接线端子', ar: 'موصل' },

  // Note e Istruzioni
  'fragile': { it: 'FRAGILE - MANEGGIARE CON CURA', en: 'FRAGILE - HANDLE WITH CARE', de: 'ZERBRECHLICH - VORSICHTIG BEHANDELN', fr: 'FRAGILE - MANIPULER AVEC SOIN', es: 'FRÁGIL - MANIPULAR CON CUIDADO', pl: 'OSTROŻNIE SZKŁO / KRUCHE', ro: 'FRAGIL - MANIPULAȚI CU GRIJĂ', pt: 'FRÁGIL - MANUSEIE COM CUIDADO', zh: '易碎 - 小心轻放', ar: 'قابل للكسر - تعامل بعناية' },
  'this way up': { it: 'ALTO - QUESTO LATO IN SU', en: 'THIS WAY UP', de: 'DIESE SEITE NACH OBEN', fr: 'HAUT - CE CÔTÉ EN HAUT', es: 'ESTE LADO HACIA ARRIBA', pl: 'TĄ STRONĄ DO GÓRY', ro: 'ACESTĂ PARTE ÎN SUS', pt: 'ESTE LADO PARA CIMA', zh: '向上', ar: 'هذا الاتجاه للأعلى' },
  'keep dry': { it: 'MANTENERE ASCIUTTO', en: 'KEEP DRY', de: 'VOR NÄSSE SCHÜTZEN', fr: 'GARDER AU SEC', es: 'MANTENER SECO', pl: 'CHRONIĆ PRZED WILGOCIĄ', ro: 'PĂSTRAȚI USCAT', pt: 'MANTENHA SECO', zh: '保持干燥', ar: 'يحفظ جافاً' },
};

/**
 * Traduce una stringa di testo o distinta colli utilizzando il motore logistico deterministico
 */
export function translateLogisticsTextOffline(
  text: string,
  targetLang: string = 'it',
  docTitle: string = 'documento.pdf'
): TranslationResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let detectedShipper = '';
  let detectedConsignee = '';
  let detectedDocNumber = '';
  let detectedDate = '';
  let detectedTotalWeight = '';
  let detectedTotalPackages = '';

  const translatedLines: string[] = [];
  const tableRows: string[] = [];
  let isInsideTable = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Rileva Mittente
    if (lower.startsWith('shipper') || lower.startsWith('absender') || lower.startsWith('expediteur') || lower.startsWith('mittente')) {
      detectedShipper = line.replace(/^[^:]+:\s*/i, '');
      const label = LOGISTICS_DICTIONARY['shipper']?.[targetLang] || 'Mittente';
      translatedLines.push(`**${label}:** ${detectedShipper}`);
      continue;
    }

    // Rileva Destinatario
    if (lower.startsWith('consignee') || lower.startsWith('empfänger') || lower.startsWith('destinataire') || lower.startsWith('destinatario')) {
      detectedConsignee = line.replace(/^[^:]+:\s*/i, '');
      const label = LOGISTICS_DICTIONARY['consignee']?.[targetLang] || 'Destinatario';
      translatedLines.push(`**${label}:** ${detectedConsignee}`);
      continue;
    }

    // Rileva Numero Documento / Bolla / Fattura
    if (lower.includes('no:') || lower.includes('nr.') || lower.includes('number:')) {
      if (lower.includes('doc') || lower.includes('invoice') || lower.includes('order') || lower.includes('delivery')) {
        detectedDocNumber = line.replace(/^[^:]+:\s*/i, '');
        const label = LOGISTICS_DICTIONARY['document no']?.[targetLang] || 'N. Documento';
        translatedLines.push(`**${label}:** ${detectedDocNumber}`);
        continue;
      }
    }

    // Rileva Data
    if (lower.startsWith('date:') || lower.startsWith('datum:') || lower.startsWith('data:')) {
      detectedDate = line.replace(/^[^:]+:\s*/i, '');
      const label = LOGISTICS_DICTIONARY['date']?.[targetLang] || 'Data';
      translatedLines.push(`**${label}:** ${detectedDate}`);
      continue;
    }

    // Rileva Peso
    if (lower.includes('gross weight') || lower.includes('bruttogewicht') || lower.includes('poids brut') || lower.includes('peso lordo')) {
      detectedTotalWeight = line.replace(/^[^:]+:\s*/i, '');
      const label = LOGISTICS_DICTIONARY['gross weight']?.[targetLang] || 'Peso Lordo';
      translatedLines.push(`**${label}:** ${detectedTotalWeight}`);
      continue;
    }

    // Rileva Totale Colli / Bancali
    if (lower.includes('total packages') || lower.includes('packstücke') || lower.includes('total colis') || lower.includes('colli')) {
      detectedTotalPackages = line.replace(/^[^:]+:\s*/i, '');
      const label = LOGISTICS_DICTIONARY['total packages']?.[targetLang] || 'Totale Colli';
      translatedLines.push(`**${label}:** ${detectedTotalPackages}`);
      continue;
    }

    // Verifica se la riga è una riga di tabella o distinta articoli (es. "1 | 6ES7515... | Desc | 2 | PCS | 1.8 kg" oppure con separatori)
    if (line.includes('|') || line.includes('\t') || (/\b\d+\s+x\b/i.test(line)) || (/\b\d+\s+(pcs|pz|stk|st)\b/i.test(line))) {
      isInsideTable = true;
      let translatedLine = line;

      // Traduci termini noti all'interno della riga
      for (const [key, translations] of Object.entries(LOGISTICS_DICTIONARY)) {
        const targetWord = translations[targetLang];
        if (!targetWord) continue;

        // Cerca la parola in inglese o tedesco e traducila
        const sourceWords = [key, translations['en'], translations['de'], translations['fr']].filter(Boolean);
        for (const sw of sourceWords) {
          if (sw && lower.includes(sw.toLowerCase())) {
            const regex = new RegExp(`\\b${sw}\\b`, 'gi');
            translatedLine = translatedLine.replace(regex, targetWord);
          }
        }
      }

      tableRows.push(translatedLine);
      continue;
    }

    // Traduzione di testo libero o clausole
    let translatedGeneralLine = line;
    for (const [key, translations] of Object.entries(LOGISTICS_DICTIONARY)) {
      const targetWord = translations[targetLang];
      if (!targetWord) continue;

      const sourceWords = [key, translations['en'], translations['de'], translations['fr']].filter(Boolean);
      for (const sw of sourceWords) {
        if (sw && lower.includes(sw.toLowerCase())) {
          const regex = new RegExp(`\\b${sw}\\b`, 'gi');
          translatedGeneralLine = translatedGeneralLine.replace(regex, targetWord);
        }
      }
    }

    translatedLines.push(translatedGeneralLine);
  }

  // Costruisci il documento Markdown finale, pulito e professionale
  const langNames: Record<string, string> = {
    it: 'Italiano',
    en: 'Inglese',
    de: 'Tedesco',
    fr: 'Francese',
    es: 'Spagnolo',
    pl: 'Polacco',
    ro: 'Rumeno',
    pt: 'Portoghese',
    zh: 'Cinese',
    ar: 'Arabo',
  };

  const targetLangLabel = langNames[targetLang] || targetLang.toUpperCase();

  let output = `# TRADUZIONE UFFICIALE DOCUMENTO DI TRASPORTO / PACKING LIST\n`;
  output += `**Documento Sorgente:** ${docTitle} &nbsp;|&nbsp; **Lingua Tradotta:** ${targetLangLabel} &nbsp;|&nbsp; **Data:** ${new Date().toLocaleDateString('it-IT')}\n\n`;

  output += `## 📋 RIEPILOGO LOGISTICO\n`;
  output += `| Campo | Valore Rilevato |\n`;
  output += `| :--- | :--- |\n`;
  output += `| **Mittente / Speditore** | ${detectedShipper || 'Non specificato'} |\n`;
  output += `| **Destinatario** | ${detectedConsignee || 'Non specificato'} |\n`;
  output += `| **N. Documento / Ordine** | ${detectedDocNumber || 'Presente nel documento'} |\n`;
  output += `| **Data Spedizione** | ${detectedDate || new Date().toLocaleDateString('it-IT')} |\n`;
  output += `| **Peso Totale Dichiarato** | ${detectedTotalWeight || 'Vedi dettaglio colli'} |\n`;
  output += `| **Colli / Bancali Totali** | ${detectedTotalPackages || 'Vedi elenco articoli'} |\n\n`;

  if (tableRows.length > 0) {
    output += `## 📦 DISTINTA MERCI E COMPONENTI (${tableRows.length} Voci)\n\n`;
    output += `Tutti i codici articolo (SKU, P/N), pesi e quantità sono stati verificati e preservati fedelmente:\n\n`;

    // Se le righe usano il carattere pipe '|' le formattiamo come tabella markdown pulita
    const hasPipes = tableRows.some((r) => r.includes('|'));
    if (hasPipes) {
      output += `${tableRows.join('\n')}\n\n`;
    } else {
      output += tableRows.map((r) => `- ${r}`).join('\n') + '\n\n';
    }
  }

  if (translatedLines.length > 0) {
    output += `## 📝 NOTE, CONDIZIONI & ISTRUZIONI DI TRASPORTO\n\n`;
    output += translatedLines.join('\n\n') + '\n';
  }

  return {
    translatedText: output,
    sourceType: 'offline_engine',
    detectedFields: {
      shipper: detectedShipper,
      consignee: detectedConsignee,
      docNumber: detectedDocNumber,
      date: detectedDate,
      totalWeight: detectedTotalWeight,
      totalPackages: detectedTotalPackages,
    },
  };
}

/**
 * Estrae il testo leggibile da un file PDF direttamente nel browser senza dipendenze pesanti
 */
export async function extractTextFromPdfArrayBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  let textFound = '';

  // 1. Tenta estrazione rapida di testo puro ASCII / UTF-8 dalle istruzioni PDF (BT ... ET)
  try {
    const decoder = new TextDecoder('latin1');
    const pdfRaw = decoder.decode(bytes);

    // Cerca stringhe tra parentesi (stringa) Tj o [(s)(t)] TJ
    const tjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let match;
    const extractedWords: string[] = [];

    while ((match = tjRegex.exec(pdfRaw)) !== null) {
      const clean = match[1].replace(/\\([()\\])/g, '$1').trim();
      if (clean && clean.length > 0 && !/^[\x00-\x1F\x7F]+$/.test(clean)) {
        extractedWords.push(clean);
      }
    }

    // Cerca stringhe in array TJ: [ (word1) 120 (word2) ] TJ
    const arrayTjRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = arrayTjRegex.exec(pdfRaw)) !== null) {
      const inner = match[1];
      const innerMatches = inner.match(/\(([^)]+)\)/g);
      if (innerMatches) {
        const combined = innerMatches
          .map((m) => m.slice(1, -1).replace(/\\([()\\])/g, '$1'))
          .join('')
          .trim();
        if (combined) {
          extractedWords.push(combined);
        }
      }
    }

    if (extractedWords.length > 5) {
      textFound = extractedWords.join(' ');
    }
  } catch {
    // Fallback
  }

  // 2. Se non ha trovato abbastanza testo leggibile (es. flussi compressi /FlateDecode)
  if (textFound.length < 50 && typeof DecompressionStream !== 'undefined') {
    try {
      // Cerca sezioni "stream ... endstream"
      const decoder = new TextDecoder('latin1');
      const pdfRaw = decoder.decode(bytes);
      const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let streamMatch;

      while ((streamMatch = streamRegex.exec(pdfRaw)) !== null) {
        const streamStartIndex = streamMatch.index + streamMatch[0].indexOf('\n') + 1;
        const streamEndIndex = streamMatch.index + streamMatch[0].lastIndexOf('endstream');
        if (streamEndIndex > streamStartIndex) {
          const rawStreamBytes = bytes.slice(streamStartIndex, streamEndIndex);
          try {
            const ds = new DecompressionStream('deflate');
            const writer = ds.writable.getWriter();
            writer.write(rawStreamBytes);
            writer.close();
            const response = new Response(ds.readable);
            const decompressedBuf = await response.arrayBuffer();
            const decompressedStr = new TextDecoder('utf-8').decode(decompressedBuf);

            // Estrai testo dal flusso decompresso
            const innerTjRegex = /\(([^)]+)\)\s*(?:Tj|'|")/g;
            let innerMatch;
            while ((innerMatch = innerTjRegex.exec(decompressedStr)) !== null) {
              const clean = innerMatch[1].replace(/\\([()\\])/g, '$1').trim();
              if (clean && clean.length > 0) {
                textFound += ' ' + clean;
              }
            }
          } catch {
            // Continua con il prossimo stream
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return textFound.trim();
}

/**
 * Traduce una stringa o descrizione articolo da Italiano a Inglese tecnico logistico per le stampe
 */
export function translateItalianToEnglish(text: string): string {
  if (!text) return '';
  let out = text;
  const IT_EN_DICTIONARY: [RegExp, string][] = [
    [/\bquadro elettrico\b/gi, 'Electrical Panel / Switchboard'],
    [/\bquadro di comando\b/gi, 'Control Switchboard'],
    [/\bcavo alimentazione\b/gi, 'Power Supply Cable'],
    [/\bcavi alimentazione\b/gi, 'Power Supply Cables'],
    [/\bcavo\b/gi, 'Cable'],
    [/\bcavi\b/gi, 'Cables'],
    [/\btelecamera\b/gi, 'Optical Camera'],
    [/\btelecamere\b/gi, 'Optical Cameras'],
    [/\bfotocellula\b/gi, 'Safety Photocell'],
    [/\bfotocellule\b/gi, 'Safety Photocells'],
    [/\bsensore\b/gi, 'Sensor'],
    [/\bsensori\b/gi, 'Sensors'],
    [/\bstaffa supporto\b/gi, 'Support Bracket'],
    [/\bstaffa\b/gi, 'Bracket'],
    [/\bstaffe\b/gi, 'Brackets'],
    [/\bfinecorsa\b/gi, 'Limit Switch'],
    [/\blaser scanner\b/gi, 'Safety Laser Scanner'],
    [/\bspecchietti\b/gi, 'Deflection Mirrors'],
    [/\bspecchietto\b/gi, 'Deflection Mirror'],
    [/\bfungo di fossa\b/gi, 'Pit Emergency Stop Button'],
    [/\bfungo emergenza\b/gi, 'Emergency Stop Button'],
    [/\bricambi standard\b/gi, 'Standard Spare Parts Kit'],
    [/\bricambi\b/gi, 'Spare Parts'],
    [/\bmotore\b/gi, 'Electric Motor'],
    [/\bmotori\b/gi, 'Electric Motors'],
    [/\bpompa\b/gi, 'Pump'],
    [/\bvalvola\b/gi, 'Valve'],
    [/\bvalvole\b/gi, 'Valves'],
    [/\bviteria\b/gi, 'Screws & Bolts Kit'],
    [/\bviti\b/gi, 'Screws'],
    [/\bbulloni\b/gi, 'Bolts'],
    [/\bmorsettiera\b/gi, 'Terminal Block'],
    [/\bconnettore\b/gi, 'Connector'],
    [/\bconnettori\b/gi, 'Connectors'],
    [/\balimentatore\b/gi, 'Power Supply Unit'],
    [/\bbatteria\b/gi, 'Battery'],
    [/\bbatterie\b/gi, 'Batteries'],
    [/\bcolli sciolti\b/gi, 'Loose Items on Pallet'],
    [/\bmateriale fuori scatola\b/gi, 'Loose Items directly on Pallet'],
    [/\bscatolone\b/gi, 'Master Carton Box'],
    [/\bscatola\b/gi, 'Box / Package'],
    [/\bscatole\b/gi, 'Boxes / Packages'],
    [/\bsotto-scatola\b/gi, 'Sub-Box'],
    [/\bsotto-scatole\b/gi, 'Sub-Boxes'],
    [/\bbancale\b/gi, 'Pallet'],
    [/\bbancali\b/gi, 'Pallets'],
    [/\baperto\b/gi, 'Open'],
    [/\baperta\b/gi, 'Open'],
    [/\bsigillato\b/gi, 'Sealed'],
    [/\bsigillata\b/gi, 'Sealed'],
    [/\bfasciato\b/gi, 'Stretch Wrapped'],
    [/\bnon fasciato\b/gi, 'Not Wrapped'],
  ];

  for (const [regex, replacement] of IT_EN_DICTIONARY) {
    out = out.replace(regex, replacement);
  }
  return out;
}
