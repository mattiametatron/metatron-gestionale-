import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileSpreadsheet,
  Upload,
  Trash2,
  Download,
  FileText,
  CheckCircle2,
  Plus,
  Search,
  SlidersHorizontal,
  ArrowDownToLine,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { CargoLoad } from '../types/warehouse';

interface ParsedSheetData {
  name: string;
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  skuCol: number; // -1 = none
  nameCol: number;
  qtyCol: number;
  weightCol: number;
  categoryCol: number;
  notesCol: number;
}

interface UploadedExcelSource {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  sheets: ParsedSheetData[];
  selectedSheetIndex: number;
  mapping: ColumnMapping;
}

export interface MergedChecklistRow {
  key: string;
  sku: string;
  name: string;
  quantity: number;
  unitWeightKg: number;
  category: string;
  notes: string;
  sources: string[]; // filenames where this item appeared
  missingFromFirst: boolean;
  presentInAll: boolean;
  quantityConflict: boolean;
  perFileQuantities: Array<{ fileName: string; qty: number }>;
}

interface ExcelChecklistMergerAppProps {
  activeLoad: CargoLoad;
  onImportItemsToLoad: (
    items: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitWeightKg: number;
      category: string;
      notes: string;
    }>,
    options: { replaceExisting: boolean }
  ) => void;
}

type MatchStrategy = 'sku_or_name' | 'name_only' | 'sku_and_name';
type DuplicateRule = 'keep_max' | 'sum_qty' | 'latest_wins';
type RowFilterMode = 'all' | 'added_missing' | 'common' | 'qty_diff';

function normalizeKeyText(val: string): string {
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseLocalizedNumber(raw: string, fallback = 0): number {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\d.,-]/g, '');
  if (!cleaned) return fallback;
  // Handle European decimals like "1.250,50" or "2,5"
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const num = Number(normalized);
  return Number.isFinite(num) ? num : fallback;
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const norm = headers.map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );

  const findByPatterns = (patterns: RegExp[], exclude: number[] = []): number => {
    for (const pat of patterns) {
      const idx = norm.findIndex(
        (h, i) => !exclude.includes(i) && pat.test(h)
      );
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const skuCol = findByPatterns([
    /^(sku|cod|codice|code|articolo|cod\.?\s*art|part\s*no|part\s*number|ref|barcode|ean|id)$/,
    /(sku|codice|cod\.|barcode|articolo|part|ref)/,
  ]);

  const nameCol = findByPatterns(
    [
      /^(descrizione|description|nome|name|materiale|oggetto|prodotto|item|voce)$/,
      /(descriz|material|oggett|prodott|denominaz|nome|item|desc)/,
    ],
    skuCol >= 0 ? [skuCol] : []
  );

  const usedSoFar = [skuCol, nameCol].filter((x) => x >= 0);

  const qtyCol = findByPatterns(
    [
      /^(q\.?ta|qta|qty|quantita|quantity|pz|pezzi|nr|n\.|num|numero)$/,
      /(quantit|q\.?ta|qty|pezzi|pz|totale\s*pz)/,
    ],
    usedSoFar
  );

  const weightCol = findByPatterns(
    [/^(peso|weight|kg|peso\s*kg|peso\s*unit)$/, /(peso|weight|\bkg\b)/],
    [...usedSoFar, qtyCol].filter((x) => x >= 0)
  );

  const categoryCol = findByPatterns(
    [/^(categoria|category|cat|gruppo|reparto|famiglia|tipo)$/, /(categ|grupp|repart|famigl)/],
    [...usedSoFar, qtyCol, weightCol].filter((x) => x >= 0)
  );

  const notesCol = findByPatterns(
    [/^(note|notes|osservazioni|commenti|rif|riferimento|bancale|scatola)$/, /(not[ae]|osserv|comment|ubicaz|collo)/],
    [...usedSoFar, qtyCol, weightCol, categoryCol].filter((x) => x >= 0)
  );

  // Fallback sensato se il foglio ha colonne generiche
  let resolvedNameCol = nameCol;
  if (resolvedNameCol === -1) {
    resolvedNameCol = headers.findIndex(
      (_, i) => i !== skuCol && i !== qtyCol && i !== weightCol
    );
    if (resolvedNameCol === -1 && headers.length > 0) {
      resolvedNameCol = 0;
    }
  }

  return {
    skuCol,
    nameCol: resolvedNameCol,
    qtyCol,
    weightCol,
    categoryCol,
    notesCol,
  };
}

function parseSheetMatrix(ws: XLSX.WorkSheet, name: string): ParsedSheetData {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (matrix.length === 0) {
    return { name, headers: [], rows: [] };
  }

  // Trova automaticamente la prima riga intestazione (saltando eventuali titoli di 1 sola cella)
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(matrix.length, 10); r++) {
    const row = (matrix[r] || []).map((c) => String(c ?? '').trim());
    const nonEmptyCount = row.filter(Boolean).length;
    if (nonEmptyCount >= 2) {
      headerRowIdx = r;
      break;
    }
  }

  const maxCols = matrix.reduce(
    (max, r) => Math.max(max, Array.isArray(r) ? r.length : 0),
    0
  );

  const rawHeaderRow = (matrix[headerRowIdx] || []).map((c) =>
    String(c ?? '').trim()
  );
  const headers: string[] = Array.from({ length: maxCols }, (_, colIdx) => {
    const val = rawHeaderRow[colIdx];
    return val || `Colonna ${colIdx + 1}`;
  });

  const rows: string[][] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const rawRow = Array.from({ length: maxCols }, (_, colIdx) =>
      String((matrix[r] as unknown[])?.[colIdx] ?? '').trim()
    );
    const hasContent = rawRow.some((cell) => cell.length > 0);
    if (!hasContent) continue;
    // Salta righe di totale puro a fondo foglio
    const firstNonEmpty = (rawRow.find(Boolean) || '').toUpperCase();
    if (
      firstNonEmpty === 'TOTALE' ||
      firstNonEmpty === 'TOTALI' ||
      firstNonEmpty.startsWith('TOTALE ')
    ) {
      continue;
    }
    rows.push(rawRow);
  }

  return { name, headers, rows };
}

export const ExcelChecklistMergerApp: React.FC<
  ExcelChecklistMergerAppProps
> = ({ activeLoad, onImportItemsToLoad }) => {
  const [sources, setSources] = useState<UploadedExcelSource[]>([]);
  const [matchStrategy, setMatchStrategy] =
    useState<MatchStrategy>('sku_or_name');
  const [duplicateRule, setDuplicateRule] =
    useState<DuplicateRule>('keep_max');
  const [filterMode, setFilterMode] = useState<RowFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFileId, setExpandedFileId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  // Manual row edits / deletions / extra rows on top of automatic merge
  const [overrides, setOverrides] = useState<
    Record<
      string,
      Partial<{
        sku: string;
        name: string;
        quantity: number;
        unitWeightKg: number;
        category: string;
        notes: string;
      }>
    >
  >({});
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(() => new Set());
  const [manualRows, setManualRows] = useState<MergedChecklistRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesSelected = async (fileList: FileList | File[]) => {
    setErrorMsg(null);
    setNoticeMsg(null);
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const addedSources: UploadedExcelSource[] = [];
    const failedFiles: string[] = [];

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const parsedSheets: ParsedSheetData[] = workbook.SheetNames.map(
          (sheetName) => parseSheetMatrix(workbook.Sheets[sheetName], sheetName)
        ).filter((s) => s.headers.length > 0);

        if (parsedSheets.length === 0) {
          failedFiles.push(`${file.name} (foglio vuoto)`);
          continue;
        }

        // Scegli automaticamente il foglio con più righe utili
        let bestIdx = 0;
        for (let i = 1; i < parsedSheets.length; i++) {
          if (parsedSheets[i].rows.length > parsedSheets[bestIdx].rows.length) {
            bestIdx = i;
          }
        }

        const mapping = detectColumnMapping(parsedSheets[bestIdx].headers);
        addedSources.push({
          id: `xls-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          fileSizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          sheets: parsedSheets,
          selectedSheetIndex: bestIdx,
          mapping,
        });
      } catch {
        failedFiles.push(`${file.name} (formato non leggibile)`);
      }
    }

    if (addedSources.length > 0) {
      setSources((prev) => [...prev, ...addedSources]);
      setNoticeMsg(
        `Caricati ${addedSources.length} file Excel. Check-list ricalcolata e unificata automaticamente.`
      );
    }
    if (failedFiles.length > 0) {
      setErrorMsg(`Impossibile leggere: ${failedFiles.join(', ')}`);
    }
  };

  const handleRemoveSource = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id));
    if (expandedFileId === id) setExpandedFileId(null);
  };

  const handleChangeSheet = (sourceId: string, sheetIdx: number) => {
    setSources((prev) =>
      prev.map((s) => {
        if (s.id !== sourceId) return s;
        const targetSheet = s.sheets[sheetIdx];
        return {
          ...s,
          selectedSheetIndex: sheetIdx,
          mapping: detectColumnMapping(targetSheet?.headers || []),
        };
      })
    );
  };

  const handleChangeMapping = (
    sourceId: string,
    field: keyof ColumnMapping,
    colIdx: number
  ) => {
    setSources((prev) =>
      prev.map((s) =>
        s.id === sourceId
          ? { ...s, mapping: { ...s.mapping, [field]: colIdx } }
          : s
      )
    );
  };

  // =========================================================================
  // MOTORE DI CONFRONTO E RISCRITTURA COMPLETA CHECK-LIST DA TUTTI GLI EXCEL
  // =========================================================================
  const mergedRows = useMemo<MergedChecklistRow[]>(() => {
    if (sources.length === 0) return manualRows;

    const firstFileName = sources[0].fileName;
    const map = new Map<
      string,
      {
        key: string;
        sku: string;
        name: string;
        quantity: number;
        unitWeightKg: number;
        category: string;
        notes: string;
        sourceSet: Set<string>;
        perFileQtyMap: Map<string, number>;
      }
    >();

    sources.forEach((source) => {
      const sheet = source.sheets[source.selectedSheetIndex];
      if (!sheet) return;
      const { skuCol, nameCol, qtyCol, weightCol, categoryCol, notesCol } =
        source.mapping;

      sheet.rows.forEach((row) => {
        const rawSku = skuCol >= 0 ? (row[skuCol] || '').trim() : '';
        const rawName = nameCol >= 0 ? (row[nameCol] || '').trim() : '';
        if (!rawSku && !rawName) return;

        const qty =
          qtyCol >= 0
            ? Math.max(1, Math.round(parseLocalizedNumber(row[qtyCol], 1)))
            : 1;
        const weight =
          weightCol >= 0
            ? Math.max(0, parseLocalizedNumber(row[weightCol], 0))
            : 0;
        const category =
          categoryCol >= 0 ? (row[categoryCol] || '').trim() : '';
        const notes = notesCol >= 0 ? (row[notesCol] || '').trim() : '';

        const normSku = normalizeKeyText(rawSku);
        const normName = normalizeKeyText(rawName);

        let key = '';
        if (matchStrategy === 'name_only') {
          key = normName || normSku;
        } else if (matchStrategy === 'sku_and_name') {
          key = `${normSku}__${normName}`;
        } else {
          // Default: codice/SKU se presente, altrimenti descrizione normalizzata
          key = normSku || normName;
        }
        if (!key) return;

        const existing = map.get(key);
        if (!existing) {
          const perFileQtyMap = new Map<string, number>();
          perFileQtyMap.set(source.fileName, qty);
          map.set(key, {
            key,
            sku: rawSku || '',
            name: rawName || rawSku,
            quantity: qty,
            unitWeightKg: weight,
            category: category || 'Generale',
            notes,
            sourceSet: new Set([source.fileName]),
            perFileQtyMap,
          });
        } else {
          existing.sourceSet.add(source.fileName);
          const prevFileQty = existing.perFileQtyMap.get(source.fileName) || 0;
          const fileTotalQty = prevFileQty + qty;
          existing.perFileQtyMap.set(source.fileName, fileTotalQty);

          // Completa eventuali campi vuoti con i dati migliori dagli altri Excel
          if (!existing.sku && rawSku) existing.sku = rawSku;
          if ((!existing.name || existing.name === existing.sku) && rawName) {
            existing.name = rawName;
          }
          if (existing.unitWeightKg === 0 && weight > 0) {
            existing.unitWeightKg = weight;
          }
          if (
            (!existing.category || existing.category === 'Generale') &&
            category
          ) {
            existing.category = category;
          }
          if (notes && !existing.notes.includes(notes)) {
            existing.notes = existing.notes
              ? `${existing.notes} · ${notes}`
              : notes;
          }

          // Applica regola di unione quantità
          const allFileQtys = Array.from(existing.perFileQtyMap.values());
          if (duplicateRule === 'sum_qty') {
            existing.quantity = allFileQtys.reduce((a, b) => a + b, 0);
          } else if (duplicateRule === 'latest_wins') {
            existing.quantity = fileTotalQty;
          } else {
            // keep_max: mantiene la quantità più alta senza duplicare righe identiche
            existing.quantity = Math.max(...allFileQtys);
          }
        }
      });
    });

    const computed: MergedChecklistRow[] = [];
    let autoSkuCounter = 1;
    map.forEach((entry) => {
      if (deletedKeys.has(entry.key)) return;
      const patch = overrides[entry.key];
      const sourceArr = Array.from(entry.sourceSet);
      const perFileQuantities = Array.from(entry.perFileQtyMap.entries()).map(
        ([fileName, qty]) => ({ fileName, qty })
      );
      const distinctQtys = new Set(perFileQuantities.map((x) => x.qty));
      const fallbackSku =
        entry.sku || `CHK-${String(autoSkuCounter++).padStart(3, '0')}`;

      computed.push({
        key: entry.key,
        sku: patch?.sku !== undefined ? patch.sku : fallbackSku,
        name: patch?.name !== undefined ? patch.name : entry.name,
        quantity:
          patch?.quantity !== undefined ? patch.quantity : entry.quantity,
        unitWeightKg:
          patch?.unitWeightKg !== undefined
            ? patch.unitWeightKg
            : entry.unitWeightKg,
        category:
          patch?.category !== undefined ? patch.category : entry.category,
        notes: patch?.notes !== undefined ? patch.notes : entry.notes,
        sources: sourceArr,
        missingFromFirst:
          sources.length >= 2 && !entry.sourceSet.has(firstFileName),
        presentInAll:
          sources.length >= 2 && entry.sourceSet.size === sources.length,
        quantityConflict: distinctQtys.size > 1,
        perFileQuantities,
      });
    });

    const activeManual = manualRows.filter((r) => !deletedKeys.has(r.key));
    return [...computed, ...activeManual];
  }, [sources, matchStrategy, duplicateRule, overrides, deletedKeys, manualRows]);

  const stats = useMemo(() => {
    const totalRows = mergedRows.length;
    const addedMissingCount = mergedRows.filter((r) => r.missingFromFirst).length;
    const commonCount = mergedRows.filter((r) => r.presentInAll).length;
    const qtyDiffCount = mergedRows.filter((r) => r.quantityConflict).length;
    const totalPieces = mergedRows.reduce((s, r) => s + (r.quantity || 0), 0);
    return {
      totalRows,
      addedMissingCount,
      commonCount,
      qtyDiffCount,
      totalPieces,
    };
  }, [mergedRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mergedRows.filter((r) => {
      if (filterMode === 'added_missing' && !r.missingFromFirst) return false;
      if (filterMode === 'common' && !r.presentInAll) return false;
      if (filterMode === 'qty_diff' && !r.quantityConflict) return false;
      if (!q) return true;
      return (
        r.sku.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q)
      );
    });
  }, [mergedRows, filterMode, searchQuery]);

  const handleEditCell = (
    rowKey: string,
    field: 'sku' | 'name' | 'quantity' | 'unitWeightKg' | 'category' | 'notes',
    value: string | number
  ) => {
    if (manualRows.some((m) => m.key === rowKey)) {
      setManualRows((prev) =>
        prev.map((m) => (m.key === rowKey ? { ...m, [field]: value } : m))
      );
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {}),
        [field]: value,
      },
    }));
  };

  const handleAddManualRow = () => {
    const key = `manual-${Date.now()}`;
    setManualRows((prev) => [
      ...prev,
      {
        key,
        sku: `MAN-${String(prev.length + 1).padStart(3, '0')}`,
        name: 'Nuovo materiale',
        quantity: 1,
        unitWeightKg: 0,
        category: 'Generale',
        notes: 'Aggiunto manualmente',
        sources: ['Aggiunta manuale'],
        missingFromFirst: true,
        presentInAll: false,
        quantityConflict: false,
        perFileQuantities: [{ fileName: 'Manuale', qty: 1 }],
      },
    ]);
  };

  // =========================================================================
  // ESPORTAZIONE EXCEL UNIFICATO (.xlsx — 2 FOGLI)
  // =========================================================================
  const handleDownloadUnifiedExcel = () => {
    if (mergedRows.length === 0) return;
    const wb = XLSX.utils.book_new();

    // Foglio 1: Check-List Unificata Completa (pronta all'uso, riscritta da capo)
    const masterData: Array<Array<string | number>> = [
      [
        'N°',
        'Codice / SKU',
        'Descrizione Materiale',
        'Quantità',
        'Peso Unit. (kg)',
        'Categoria',
        'Stato Unione',
        'File Sorgente',
        'Note',
      ],
      ...mergedRows.map((row, idx) => [
        idx + 1,
        row.sku,
        row.name,
        row.quantity,
        row.unitWeightKg,
        row.category,
        row.missingFromFirst
          ? 'Aggiunto da altro Excel'
          : row.presentInAll
          ? 'Presente in tutti i file'
          : 'Presente in File 1',
        row.sources.join(' + '),
        row.notes,
      ]),
      [],
      [
        'TOTALI',
        `${mergedRows.length} articoli`,
        '',
        stats.totalPieces,
        Math.round(
          mergedRows.reduce((s, r) => s + r.quantity * r.unitWeightKg, 0) * 100
        ) / 100,
        '',
        `${stats.addedMissingCount} aggiunti mancanti`,
        `${sources.length} file uniti`,
        '',
      ],
    ];

    const wsMaster = XLSX.utils.aoa_to_sheet(masterData);
    wsMaster['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 42 },
      { wch: 12 },
      { wch: 15 },
      { wch: 18 },
      { wch: 24 },
      { wch: 32 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, wsMaster, 'Check-List Unificata');

    // Foglio 2: Matrice Confronto per File
    if (sources.length > 0) {
      const compareHeader = [
        'Codice / SKU',
        'Descrizione Materiale',
        ...sources.map((s) => s.fileName),
        'Quantità Finale Unificata',
        'Esito Confronto',
      ];
      const compareRows = mergedRows.map((row) => {
        const qtyByFile = new Map(
          row.perFileQuantities.map((x) => [x.fileName, x.qty])
        );
        return [
          row.sku,
          row.name,
          ...sources.map((s) =>
            qtyByFile.has(s.fileName) ? qtyByFile.get(s.fileName)! : 'MANCANTE'
          ),
          row.quantity,
          row.missingFromFirst
            ? 'Mancante nel File 1 → Aggiunto automaticamente'
            : row.quantityConflict
            ? 'Quantità diverse tra i file'
            : 'Allineato',
        ];
      });
      const wsCompare = XLSX.utils.aoa_to_sheet([compareHeader, ...compareRows]);
      wsCompare['!cols'] = [
        { wch: 18 },
        { wch: 38 },
        ...sources.map(() => ({ wch: 20 })),
        { wch: 22 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, wsCompare, 'Confronto Excel');
    }

    const dateTag = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `CheckList_Unificata_${dateTag}.xlsx`);
    setNoticeMsg('File Excel Check-List Unificata scaricato con successo.');
  };

  // =========================================================================
  // ESPORTAZIONE PDF A4 CHECK-LIST UNIFICATA
  // =========================================================================
  const handleDownloadUnifiedPdf = () => {
    if (mergedRows.length === 0) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text('CHECK-LIST MATERIALI UNIFICATA', margin, 10.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Generata dall'unione di ${sources.length} file Excel · ${mergedRows.length} articoli · ${stats.totalPieces} pezzi totali`,
      margin,
      17
    );
    doc.text(
      `Data: ${new Date().toLocaleString('it-IT')}`,
      pageW - margin,
      11,
      { align: 'right' }
    );
    doc.text(
      `Aggiunti mancanti: ${stats.addedMissingCount}`,
      pageW - margin,
      17,
      { align: 'right' }
    );

    autoTable(doc, {
      startY: 29,
      head: [
        ['#', 'SKU / Codice', 'Descrizione Materiale', 'Q.tà', 'Stato', 'Spunta'],
      ],
      body: mergedRows.map((r, i) => [
        String(i + 1),
        r.sku,
        r.name,
        String(r.quantity),
        r.missingFromFirst
          ? 'Aggiunto'
          : r.presentInAll
          ? 'Tutti i file'
          : 'File 1',
        '[   ]',
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'right' },
        1: { cellWidth: 28, font: 'courier', fontStyle: 'bold' },
        2: { cellWidth: 88 },
        3: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 28 },
        5: { cellWidth: 16, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });

    const dateTag = new Date().toISOString().slice(0, 10);
    doc.save(`CheckList_Unificata_${dateTag}.pdf`);
  };

  const handlePushToActiveLoad = (replaceExisting: boolean) => {
    if (mergedRows.length === 0) return;
    onImportItemsToLoad(
      mergedRows.map((r) => ({
        sku: r.sku,
        name: r.name,
        quantity: r.quantity,
        unitWeightKg: r.unitWeightKg,
        category: r.category,
        notes: r.notes,
      })),
      { replaceExisting }
    );
    setNoticeMsg(
      replaceExisting
        ? `Check-list di ${activeLoad.code} riscritta con ${mergedRows.length} articoli unificati.`
        : `Aggiunti ${mergedRows.length} articoli unificati alla commessa ${activeLoad.code}.`
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#F5F7FA] text-slate-900 overflow-hidden">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200/90 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-slate-900 tracking-tight truncate">
              Unione File Excel per Check-List
            </h1>
            <p className="text-xs text-slate-500 truncate">
              Carica 2 o più file Excel (.xlsx, .xls, .csv, .ods): confronta automaticamente e riscrive un&apos;unica Check-List completa senza doppioni.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={mergedRows.length === 0}
            onClick={handleDownloadUnifiedExcel}
            className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Scarica Excel Unico (.xlsx)</span>
          </button>

          <button
            type="button"
            disabled={mergedRows.length === 0}
            onClick={handleDownloadUnifiedPdf}
            className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Scarica PDF</span>
          </button>

          <button
            type="button"
            disabled={mergedRows.length === 0}
            onClick={() => handlePushToActiveLoad(false)}
            className="h-9 px-3.5 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            title={`Importa tutta la check-list unificata dentro la commessa ${activeLoad.code}`}
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-700" />
            <span>Invia a {activeLoad.code}</span>
          </button>
        </div>
      </header>

      {/* CORPO SCROLLABILE */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5">
        <div className="max-w-[1400px] mx-auto space-y-5">
          {/* Messaggi di stato */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
          {noticeMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{noticeMsg}</span>
            </div>
          )}

          {/* SEZIONE 1: CARICAMENTO MULTI-EXCEL + REGOLE UNIONE */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4 items-start">
            {/* Area Drop / Upload illimitato */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingOver(true);
              }}
              onDragLeave={() => setIsDraggingOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                if (e.dataTransfer.files?.length) {
                  handleFilesSelected(e.dataTransfer.files);
                }
              }}
              className={`rounded-2xl border-2 border-dashed p-5 transition-colors bg-white ${
                isDraggingOver
                  ? 'border-emerald-500 bg-emerald-50/40'
                  : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.ods,.tsv"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFilesSelected(e.target.files);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Trascina qui tutti i file Excel che vuoi unire
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Supporta qualsiasi numero di file: .xlsx, .xls, .xlsm, .xlsb, .csv, .ods, .tsv
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {sources.length === 0
                      ? 'Scegli File Excel'
                      : 'Aggiungi altri Excel'}
                  </span>
                </button>
              </div>

              {/* Lista File Excel caricati */}
              {sources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                  {sources.map((src, idx) => {
                    const activeSheet = src.sheets[src.selectedSheetIndex];
                    const isExpanded = expandedFileId === src.id;
                    return (
                      <div
                        key={src.id}
                        className="rounded-xl border border-slate-200/90 bg-slate-50/70 overflow-hidden"
                      >
                        <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {src.fileName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                Foglio: {activeSheet?.name || '—'} ·{' '}
                                {activeSheet?.rows.length || 0} righe rilevate
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedFileId(isExpanded ? null : src.id)
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                              title="Controlla o modifica le colonne rilevate"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span>Colonne</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSource(src.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                              title="Rimuovi file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && activeSheet && (
                          <div className="px-3.5 py-3 bg-white border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                            {src.sheets.length > 1 && (
                              <div className="col-span-2 sm:col-span-3">
                                <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                  Foglio del file Excel
                                </label>
                                <select
                                  value={src.selectedSheetIndex}
                                  onChange={(e) =>
                                    handleChangeSheet(
                                      src.id,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                >
                                  {src.sheets.map((sh, sIdx) => (
                                    <option key={sh.name} value={sIdx}>
                                      {sh.name} ({sh.rows.length} righe)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {(
                              [
                                ['skuCol', 'Codice / SKU'],
                                ['nameCol', 'Descrizione'],
                                ['qtyCol', 'Quantità'],
                                ['weightCol', 'Peso (kg)'],
                                ['categoryCol', 'Categoria'],
                                ['notesCol', 'Note'],
                              ] as Array<[keyof ColumnMapping, string]>
                            ).map(([field, label]) => (
                              <div key={field}>
                                <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                  {label}
                                </label>
                                <select
                                  value={src.mapping[field]}
                                  onChange={(e) =>
                                    handleChangeMapping(
                                      src.id,
                                      field,
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full h-8 px-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                >
                                  <option value={-1}>— Nessuna —</option>
                                  {activeSheet.headers.map((h, colIdx) => (
                                    <option key={colIdx} value={colIdx}>
                                      {h}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pannello Regole di Confronto & Riepilogo Numerico */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Confronta gli articoli per
                  </label>
                  <select
                    value={matchStrategy}
                    onChange={(e) =>
                      setMatchStrategy(e.target.value as MatchStrategy)
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="sku_or_name">
                      Codice/SKU (o Descrizione se manca SKU)
                    </option>
                    <option value="name_only">Solo Descrizione Materiale</option>
                    <option value="sku_and_name">
                      Codice/SKU + Descrizione esatta
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Se un articolo è in più Excel
                  </label>
                  <select
                    value={duplicateRule}
                    onChange={(e) =>
                      setDuplicateRule(e.target.value as DuplicateRule)
                    }
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 cursor-pointer"
                  >
                    <option value="keep_max">
                      Unisci senza duplicare (tieni q.tà maggiore)
                    </option>
                    <option value="sum_qty">
                      Somma le quantità dei vari Excel
                    </option>
                    <option value="latest_wins">
                      Tieni la quantità dell&apos;ultimo Excel caricato
                    </option>
                  </select>
                </div>
              </div>

              {/* 4 KPI Puliti */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">File Uniti</div>
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                    {sources.length}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">
                    Check-List Finale
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                    {stats.totalRows}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80">
                  <div className="text-[11px] text-emerald-800">
                    Mancanti Recuperati
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-900 tabular-nums mt-0.5">
                    +{stats.addedMissingCount}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div className="text-[11px] text-slate-500">Pezzi Totali</div>
                  <div className="text-lg font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                    {stats.totalPieces}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SEZIONE 2: TABELLA CHECK-LIST UNIFICATA COMPLETA */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Toolbar filtri */}
            <div className="px-5 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['all', `Tutta la Check-List (${stats.totalRows})`],
                    [
                      'added_missing',
                      `Aggiunti da altri Excel (${stats.addedMissingCount})`,
                    ],
                    ['common', `Presenti in tutti (${stats.commonCount})`],
                    ['qty_diff', `Differenze Q.tà (${stats.qtyDiffCount})`],
                  ] as Array<[RowFilterMode, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterMode(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      filterMode === key
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cerca SKU o materiale..."
                    className="h-9 pl-8 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-slate-900 w-52"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Riga
                </button>
              </div>
            </div>

            {mergedRows.length === 0 ? (
              <div className="py-16 px-6 text-center space-y-2.5">
                <Layers className="w-9 h-9 text-slate-300 mx-auto" />
                <div className="text-sm font-semibold text-slate-700">
                  Carica almeno 2 file Excel per confrontarli e unirli in una Check-List unica
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Tutto il materiale mancante in uno dei fogli verrà recuperato e riscritto automaticamente da capo in un unico file Excel e PDF pulito, pronto da stampare o inviare alla commessa.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3 font-semibold w-10 text-right">
                        #
                      </th>
                      <th className="py-2.5 px-3 font-semibold w-36">
                        Codice / SKU
                      </th>
                      <th className="py-2.5 px-3 font-semibold">
                        Descrizione Materiale
                      </th>
                      <th className="py-2.5 px-3 font-semibold w-24 text-right">
                        Quantità
                      </th>
                      <th className="py-2.5 px-3 font-semibold w-24 text-right">
                        Peso (kg)
                      </th>
                      <th className="py-2.5 px-3 font-semibold w-44">
                        Origine / Stato
                      </th>
                      <th className="py-2.5 px-3 font-semibold w-44">Note</th>
                      <th className="py-2.5 px-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row, index) => (
                      <tr
                        key={row.key}
                        className={
                          row.missingFromFirst
                            ? 'bg-emerald-50/45 hover:bg-emerald-50/80'
                            : row.quantityConflict
                            ? 'bg-amber-50/45 hover:bg-amber-50/80'
                            : 'bg-white hover:bg-slate-50/80'
                        }
                      >
                        <td className="py-2 px-3 text-right font-mono text-slate-400 tabular-nums">
                          {index + 1}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.sku}
                            onChange={(e) =>
                              handleEditCell(row.key, 'sku', e.target.value)
                            }
                            className="w-full bg-transparent font-mono font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-300 rounded px-1.5 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              handleEditCell(row.key, 'name', e.target.value)
                            }
                            className="w-full bg-transparent font-medium text-slate-800 focus:bg-white focus:ring-1 focus:ring-slate-300 rounded px-1.5 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={row.quantity}
                            onChange={(e) =>
                              handleEditCell(
                                row.key,
                                'quantity',
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className="w-20 text-right bg-transparent font-mono font-semibold text-slate-900 tabular-nums focus:bg-white focus:ring-1 focus:ring-slate-300 rounded px-1.5 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={row.unitWeightKg}
                            onChange={(e) =>
                              handleEditCell(
                                row.key,
                                'unitWeightKg',
                                Math.max(0, Number(e.target.value) || 0)
                              )
                            }
                            className="w-20 text-right bg-transparent font-mono text-slate-700 tabular-nums focus:bg-white focus:ring-1 focus:ring-slate-300 rounded px-1.5 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div
                            className={`text-[11px] font-semibold ${
                              row.missingFromFirst
                                ? 'text-emerald-700'
                                : row.quantityConflict
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }`}
                          >
                            {row.missingFromFirst
                              ? 'Aggiunto (mancava nel File 1)'
                              : row.quantityConflict
                              ? 'Q.tà diversa tra i file'
                              : row.presentInAll
                              ? 'Presente in tutti i file'
                              : 'Solo File 1'}
                          </div>
                          <div
                            className="text-[10.5px] text-slate-400 truncate max-w-[190px]"
                            title={row.perFileQuantities
                              .map((x) => `${x.fileName}: ${x.qty}`)
                              .join(' | ')}
                          >
                            {row.sources.join(' · ')}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) =>
                              handleEditCell(row.key, 'notes', e.target.value)
                            }
                            placeholder="—"
                            className="w-full bg-transparent text-slate-600 focus:bg-white focus:ring-1 focus:ring-slate-300 rounded px-1.5 py-1 focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setDeletedKeys((prev) => {
                                const next = new Set(prev);
                                next.add(row.key);
                                return next;
                              })
                            }
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Rimuovi riga"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
