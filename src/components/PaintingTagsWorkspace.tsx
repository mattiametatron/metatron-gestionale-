import React, { useState, useEffect, useRef } from 'react';
import {
  Paintbrush,
  Printer,
  Plus,
  Trash2,
  Copy,
  RotateCcw,
  LayoutTemplate,
  Type,
  Eye,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CargoLoad,
  CartelloLayoutFormat,
  FinishingCartello,
} from '../types/warehouse';
import { LoadSummary } from '../utils/calculations';
import { FinishingPrintModal } from './FinishingPrintModal';
import { detectFinishingTagsFromLoad } from '../utils/localAutoEngine';

interface PaintingTagsWorkspaceProps {
  load: CargoLoad;
  summary: LoadSummary;
  onAddFinishingTag: (
    tag: Omit<FinishingCartello, 'id' | 'createdAt'>
  ) => FinishingCartello;
  onUpdateFinishingTag: (
    tagId: string,
    updates: Partial<FinishingCartello>
  ) => void;
  onDeleteFinishingTag: (tagId: string) => void;
  onDuplicateFinishingTag: (tagId: string) => void;
}

const QUICK_TREATMENTS: {
  label: string;
  value: string;
  hex: string | null;
  finish: string;
}[] = [
  {
    label: 'ZINCATO A CALDO',
    value: 'ZINCATO A CALDO',
    hex: '#cbd5e1',
    finish: 'Zincatura a Caldo UNI EN ISO 1461',
  },
  {
    label: 'ELETTROZINCATO BIANCO',
    value: 'ELETTROZINCATO BIANCO',
    hex: '#e2e8f0',
    finish: 'Passivazione Bianca Cr3+',
  },
  {
    label: 'ELETTROZINCATO GIALLO',
    value: 'ELETTROZINCATO GIALLO',
    hex: '#fde047',
    finish: 'Passivazione Gialla Tropicalizzata',
  },
  {
    label: 'ZINCATO + VERNICIATO',
    value: 'ZINCATO + VERNICIATO',
    hex: '#94a3b8',
    finish: 'Ciclo Duplex',
  },
  {
    label: 'SABBIATURA SA 2.5 + FONDO',
    value: 'SABBIATURA SA 2.5 + FONDO EPOSSIDICO',
    hex: '#a8a29e',
    finish: 'Fondo Antiruggine',
  },
  {
    label: 'CATAFORESI NERA',
    value: 'CATAFORESI NERA',
    hex: '#1e293b',
    finish: 'Immersione Cataforesi',
  },
  {
    label: 'BRUNITURA',
    value: 'BRUNITURA NERA A FREDDO',
    hex: '#0f172a',
    finish: 'Oliato Protettivo',
  },
  {
    label: 'DECAPAGGIO INOX',
    value: 'DECAPAGGIO E PASSIVAZIONE INOX',
    hex: '#f1f5f9',
    finish: 'Acciaio Inox',
  },
];

const QUICK_RALS: { code: string; name: string; hex: string }[] = [
  { code: 'RAL 7016', name: 'GRIGIO ANTRACITE', hex: '#383E42' },
  { code: 'RAL 7035', name: 'GRIGIO LUCE', hex: '#CBD0CC' },
  { code: 'RAL 9005', name: 'NERO INTENSO', hex: '#0E0E10' },
  { code: 'RAL 9010', name: 'BIANCO PURO', hex: '#F7F9EF' },
  { code: 'RAL 9006', name: 'ALLUMINIO BRILLANTE', hex: '#A1A1A0' },
  { code: 'RAL 7040', name: 'GRIGIO FINESTRA', hex: '#989EA1' },
  { code: 'RAL 3000', name: 'ROSSO FUOCO', hex: '#A72920' },
  { code: 'RAL 1021', name: 'GIALLO COLZA', hex: '#F6B600' },
  { code: 'RAL 5015', name: 'BLU CIELO', hex: '#007CB0' },
  { code: 'RAL 5010', name: 'BLU GENZIANA', hex: '#004F7C' },
  { code: 'RAL 6005', name: 'VERDE MUSCHIO', hex: '#114232' },
  { code: 'RAL 8017', name: 'MARRONE CIOCCOLATO', hex: '#442F29' },
];

const FINISH_TYPES = [
  'Standard',
  'Opaco (Matt)',
  'Semilucido (Satinato)',
  'Lucido (Gloss)',
  'Bucciato / Goffrato Fine',
  'Micaceo / Raggrinzante',
  'Fondo + Smalto',
  'Polvere Epossipoliestere',
];

interface SavedTagCardProps {
  tag: FinishingCartello;
  index: number;
  pallets: CargoLoad['pallets'];
  onUpdate: (tagId: string, updates: Partial<FinishingCartello>) => void;
  onDelete: (tagId: string) => void;
  onDuplicate: (tagId: string) => void;
  onPrint: (tagId: string) => void;
  onLoadIntoLayout: (tag: FinishingCartello) => void;
}

const SavedTagCard: React.FC<SavedTagCardProps> = ({
  tag,
  index,
  pallets,
  onUpdate,
  onDelete,
  onDuplicate,
  onPrint,
  onLoadIntoLayout,
}) => {
  const [commessaCodeStr, setCommessaCodeStr] = useState(tag.commessaCode);
  const [commessaTitleStr, setCommessaTitleStr] = useState(tag.commessaTitle);
  const [treatmentStr, setTreatmentStr] = useState(tag.treatmentText);
  const [finishStr, setFinishStr] = useState(tag.finishType || '');
  const [supplierStr, setSupplierStr] = useState(tag.supplierName || '');
  const [qtyStr, setQtyStr] = useState(tag.quantityOrPieces || '');
  const [notesStr, setNotesStr] = useState(tag.notes || '');

  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setCommessaCodeStr(tag.commessaCode);
      setCommessaTitleStr(tag.commessaTitle);
      setTreatmentStr(tag.treatmentText);
      setFinishStr(tag.finishType || '');
      setSupplierStr(tag.supplierName || '');
      setQtyStr(tag.quantityOrPieces || '');
      setNotesStr(tag.notes || '');
    }
  }, [tag]);

  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-xs overflow-hidden flex flex-col justify-between transition-all">
      {/* Card Header */}
      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-mono font-black text-xs flex items-center justify-center shrink-0">
            #{index + 1}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-white truncate">
                {commessaCodeStr || 'COMMESSA'}
              </span>
              {tag.palletCode && (
                <span className="text-[11px] font-mono text-amber-300">
                  · {tag.palletCode}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-300 block truncate">
              {commessaTitleStr || 'Cartello Lavorazione / Verniciatura'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onLoadIntoLayout(tag)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-lg flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
            title="Apri questo cartello nel Layout Visivo sopra"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Apri in Layout</span>
          </button>

          <button
            type="button"
            onClick={() => onPrint(tag.id)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Stampa questo cartello A4"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Stampa</span>
          </button>

          <button
            type="button"
            onClick={() => onDuplicate(tag.id)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Duplica questo cartello"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(tag.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Elimina questo cartello"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Codice Commessa
            </label>
            <input
              type="text"
              value={commessaCodeStr}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => {
                setCommessaCodeStr(e.target.value);
                onUpdate(tag.id, { commessaCode: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 font-mono font-black text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Descrizione Commessa / Cliente
            </label>
            <input
              type="text"
              value={commessaTitleStr}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => {
                setCommessaTitleStr(e.target.value);
                onUpdate(tag.id, { commessaTitle: e.target.value });
              }}
              className="w-full px-2.5 py-1.5 font-bold text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50/50 border-2 border-amber-300/80 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5 text-amber-600" />
              <span>Colore RAL / Zincatura / Lavorazione:</span>
            </label>
            {tag.swatchHex && (
              <span
                className="w-4 h-4 rounded border border-slate-400 shrink-0"
                style={{ backgroundColor: tag.swatchHex }}
              />
            )}
          </div>

          <input
            type="text"
            value={treatmentStr}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={() => {
              isFocusedRef.current = false;
            }}
            onChange={(e) => {
              setTreatmentStr(e.target.value);
              onUpdate(tag.id, { treatmentText: e.target.value });
            }}
            className="w-full px-3 py-1.5 text-base font-black font-mono uppercase bg-white border-2 border-slate-300 focus:border-amber-600 rounded-xl text-slate-950 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Finitura
            </label>
            <input
              type="text"
              value={finishStr}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => {
                setFinishStr(e.target.value);
                onUpdate(tag.id, { finishType: e.target.value });
              }}
              className="w-full px-2 py-1 font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Bancale / Collo
            </label>
            <select
              value={tag.palletCode || ''}
              onChange={(e) =>
                onUpdate(tag.id, { palletCode: e.target.value || undefined })
              }
              className="w-full px-2 py-1 font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="">Intera Commessa</option>
              {pallets.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.code} — {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Quantità
            </label>
            <input
              type="text"
              value={qtyStr}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => {
                setQtyStr(e.target.value);
                onUpdate(tag.id, { quantityOrPieces: e.target.value });
              }}
              className="w-full px-2 py-1 font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Terzista
            </label>
            <input
              type="text"
              value={supplierStr}
              onFocus={() => {
                isFocusedRef.current = true;
              }}
              onBlur={() => {
                isFocusedRef.current = false;
              }}
              onChange={(e) => {
                setSupplierStr(e.target.value);
                onUpdate(tag.id, { supplierName: e.target.value });
              }}
              className="w-full px-2 py-1 font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
            Note / Mascherature
          </label>
          <input
            type="text"
            value={notesStr}
            onFocus={() => {
              isFocusedRef.current = true;
            }}
            onBlur={() => {
              isFocusedRef.current = false;
            }}
            onChange={(e) => {
              setNotesStr(e.target.value);
              onUpdate(tag.id, { notes: e.target.value });
            }}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

export const PaintingTagsWorkspace: React.FC<PaintingTagsWorkspaceProps> = ({
  load,
  summary,
  onAddFinishingTag,
  onUpdateFinishingTag,
  onDeleteFinishingTag,
  onDuplicateFinishingTag,
}) => {
  // Composer & In-App Layout State
  const [commessaCode, setCommessaCode] = useState<string>(load.code);
  const [commessaTitle, setCommessaTitle] = useState<string>(load.title);
  const [clientName, setClientName] = useState<string>(load.client || '');
  const [treatmentText, setTreatmentText] = useState<string>(
    'RAL 7016 GRIGIO ANTRACITE'
  );
  const [swatchHex, setSwatchHex] = useState<string | null>('#383E42');
  const [finishType, setFinishType] = useState<string>('Standard');
  const [supplierName, setSupplierName] = useState<string>('');
  const [palletCode, setPalletCode] = useState<string>('');
  const [quantityOrPieces, setQuantityOrPieces] = useState<string>(
    `${load.pallets.length || 1} Bancali (${summary.totalPieces || 0} pz)`
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date().toLocaleDateString('it-IT')
  );
  const [notes, setNotes] = useState<string>('');

  // In-App Layout Template Options
  const [layoutFormat, setLayoutFormat] =
    useState<CartelloLayoutFormat>('a4_portrait');
  const [fontScale, setFontScale] = useState<'normal' | 'large' | 'giant'>(
    'giant'
  );
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [showColorBanner, setShowColorBanner] = useState<boolean>(true);
  const [showItemsList, setShowItemsList] = useState<boolean>(false);

  // Sync commessa code & title when switching active commessa
  useEffect(() => {
    setCommessaCode(load.code);
    setCommessaTitle(load.title);
    setClientName(load.client || '');
    setQuantityOrPieces(
      `${load.pallets.length || 1} Bancali (${summary.totalPieces || 0} pz)`
    );
  }, [
    load.id,
    load.code,
    load.title,
    load.client,
    load.pallets.length,
    summary.totalPieces,
  ]);

  // Print Modal State
  const [printingTagId, setPrintingTagId] = useState<string | 'all' | null>(
    null
  );
  const [instantPrintTag, setInstantPrintTag] =
    useState<FinishingCartello | null>(null);

  const savedTags = load.finishingTags || [];

  const handleSelectQuickTreatment = (item: (typeof QUICK_TREATMENTS)[0]) => {
    setTreatmentText(item.value);
    setSwatchHex(item.hex);
    setFinishType(item.finish);
  };

  const handleSelectQuickRal = (ral: (typeof QUICK_RALS)[0]) => {
    setTreatmentText(`${ral.code} ${ral.name}`);
    setSwatchHex(ral.hex);
  };

  const buildCurrentPayload = (): Omit<
    FinishingCartello,
    'id' | 'createdAt'
  > => ({
    commessaCode: commessaCode.trim() || load.code,
    commessaTitle: commessaTitle.trim() || load.title,
    clientName: clientName.trim() || load.client,
    treatmentText: treatmentText.trim() || 'DA SPECIFICARE',
    swatchHex,
    finishType: finishType.trim() || undefined,
    supplierName: supplierName.trim() || undefined,
    palletCode: palletCode || undefined,
    quantityOrPieces: quantityOrPieces.trim() || undefined,
    deliveryDate: deliveryDate.trim() || new Date().toLocaleDateString('it-IT'),
    notes: notes.trim() || undefined,
    layoutFormat,
    fontScale,
    showSignatures,
    showColorBanner,
    showItemsList,
  });

  const handleSaveTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onAddFinishingTag(buildCurrentPayload());
  };

  const handleSaveAndPrintImmediately = () => {
    const created = onAddFinishingTag(buildCurrentPayload());
    setInstantPrintTag(created);
  };

  const handleLoadTagIntoLayout = (tag: FinishingCartello) => {
    setCommessaCode(tag.commessaCode);
    setCommessaTitle(tag.commessaTitle);
    setClientName(tag.clientName || load.client || '');
    setTreatmentText(tag.treatmentText);
    setSwatchHex(tag.swatchHex ?? null);
    setFinishType(tag.finishType || '');
    setSupplierName(tag.supplierName || '');
    setPalletCode(tag.palletCode || '');
    setQuantityOrPieces(tag.quantityOrPieces || '');
    setDeliveryDate(
      tag.deliveryDate || new Date().toLocaleDateString('it-IT')
    );
    setNotes(tag.notes || '');
    if (tag.layoutFormat) setLayoutFormat(tag.layoutFormat);
    if (tag.fontScale) setFontScale(tag.fontScale);
    if (tag.showSignatures !== undefined)
      setShowSignatures(tag.showSignatures);
    if (tag.showColorBanner !== undefined)
      setShowColorBanner(tag.showColorBanner);
    if (tag.showItemsList !== undefined) setShowItemsList(tag.showItemsList);
  };

  const commessaPreviewSize =
    fontScale === 'giant'
      ? 'text-4xl sm:text-5xl'
      : fontScale === 'large'
      ? 'text-3xl sm:text-4xl'
      : 'text-2xl sm:text-3xl';

  const treatmentPreviewSize =
    fontScale === 'giant'
      ? 'text-3xl sm:text-5xl'
      : fontScale === 'large'
      ? 'text-2xl sm:text-4xl'
      : 'text-xl sm:text-3xl';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden text-slate-900 rounded-xl border border-slate-200">
      {/* =====================================================================
          TOP HEADER & BARRA CONFIGURAZIONE LAYOUT IN-APP
      ===================================================================== */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-xs">
            <Paintbrush className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-black tracking-tight text-slate-900">
                Studio Layout Cartello Verniciatura, RAL &amp; Zincatura
              </h2>
              <span className="text-xs font-mono font-bold text-slate-500">
                · {savedTags.length} cartelli in commessa
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Personalizza il layout direttamente in app: puoi scrivere sia nei campi a sinistra sia cliccando direttamente dentro il Cartello A4 a destra
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const detected = detectFinishingTagsFromLoad(load);
              if (detected.length === 0) return;
              detected.forEach((tag) => onAddFinishingTag(tag));
              handleLoadTagIntoLayout({
                ...detected[0],
                id: 'preview',
                createdAt: new Date().toISOString(),
              });
            }}
            className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 border border-amber-500/70 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Cerca codici RAL, Zincatura e trattamenti negli articoli della commessa e genera i cartelli in automatico"
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Rileva Cartelli da Commessa</span>
          </button>

          {savedTags.length > 0 && (
            <button
              type="button"
              onClick={() => setPrintingTagId('all')}
              className="px-3.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Stampa Tutti ({savedTags.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAndPrintImmediately}
            className="px-4 py-2 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Stampa Cartello A4</span>
          </button>
        </div>
      </div>

      {/* BARRA SCELTA FORMATO LAYOUT IN-APP */}
      <div className="bg-slate-900 text-white px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        {/* 4 Template di Layout */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <LayoutTemplate className="w-3.5 h-3.5 text-amber-400" />
            <span>Formato Layout:</span>
          </span>

          {(
            [
              { id: 'a4_portrait', label: '1. A4 Verticale Gigante' },
              { id: 'a4_landscape', label: '2. A4 Orizzontale Panoramico' },
              { id: 'a5_double', label: '3. Doppio su A4 (2× A5)' },
              { id: 'a6_quad', label: '4. 4 Cartellini su A4 (4× A6)' },
            ] as { id: CartelloLayoutFormat; label: string }[]
          ).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => setLayoutFormat(tpl.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutFormat === tpl.id
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {tpl.label}
            </button>
          ))}
        </div>

        {/* Opzioni Carattere e Blocchi del Layout */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
            <Type className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-slate-300">Testo:</span>
            {(
              [
                { id: 'giant', label: 'Cubitale' },
                { id: 'large', label: 'Grande' },
                { id: 'normal', label: 'Medio' },
              ] as const
            ).map((sz) => (
              <button
                key={sz.id}
                type="button"
                onClick={() => setFontScale(sz.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  fontScale === sz.id
                    ? 'bg-white text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showColorBanner}
              onChange={(e) => setShowColorBanner(e.target.checked)}
              className="rounded text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span>Fascia Colore</span>
          </label>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showSignatures}
              onChange={(e) => setShowSignatures(e.target.checked)}
              className="rounded text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span>Box Firme</span>
          </label>

          <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showItemsList}
              onChange={(e) => setShowItemsList(e.target.checked)}
              className="rounded text-amber-500 focus:ring-0 cursor-pointer"
            />
            <span>Tabella Articoli</span>
          </label>
        </div>
      </div>

      {/* =====================================================================
          MAIN WORKSPACE: PANNELLO COMANDI (SX) + LAYOUT CARTELLO INTERATTIVO IN-APP (DX)
      ===================================================================== */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* COLONNA SINISTRA (5 COLS): TASTIERA RAPIDA RAL / ZINCATURA & DATI */}
          <div className="xl:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Impostazione Rapida Dati &amp; Trattamento
                </h3>
                <p className="text-[11px] text-slate-500">
                  Compila qui o clicca direttamente sul foglio del Cartello a destra
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTreatmentText('');
                  setSwatchHex(null);
                  setNotes('');
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Svuota</span>
              </button>
            </div>

            {/* Scelta Rapida Lavorazioni (Zincato / Elettrozincato / Sabbiato / Cataforesi) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                1-Clic Lavorazioni e Zincature:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TREATMENTS.map((tr) => (
                  <button
                    key={tr.label}
                    type="button"
                    onClick={() => handleSelectQuickTreatment(tr)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      treatmentText.toUpperCase() === tr.value
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-300'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scelta Rapida RAL */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                1-Clic Colori RAL Frequenti:
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {QUICK_RALS.map((ral) => {
                  const isSelected = treatmentText
                    .toUpperCase()
                    .includes(ral.code);
                  return (
                    <button
                      key={ral.code}
                      type="button"
                      onClick={() => handleSelectQuickRal(ral)}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
                      }`}
                      title={`${ral.code} ${ral.name}`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-xs border border-slate-400 shrink-0"
                        style={{ backgroundColor: ral.hex }}
                      />
                      <span className="truncate">{ral.code}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scelta Rapida Finitura */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                Finitura Superficiale:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {FINISH_TYPES.map((fin) => (
                  <button
                    key={fin}
                    type="button"
                    onClick={() => setFinishType(fin)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                      finishType === fin
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {fin}
                  </button>
                ))}
              </div>
            </div>

            {/* Colore Visivo Personalizzato & Associazione Bancale */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Bancale / Collo della Commessa
                </label>
                <select
                  value={palletCode}
                  onChange={(e) => setPalletCode(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                >
                  <option value="">LOTTO INTERA COMMESSA</option>
                  {load.pallets.map((p) => (
                    <option key={p.id} value={p.code}>
                      {p.code} — {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fascia Colore Indicativa
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={swatchHex || '#383E42'}
                    onChange={(e) => setSwatchHex(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-slate-300 shrink-0"
                  />
                  <input
                    type="text"
                    value={swatchHex || ''}
                    onChange={(e) => setSwatchHex(e.target.value || null)}
                    placeholder="#383E42"
                    className="w-full px-2.5 py-2 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Pulsanti Salva / Stampa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleSaveTag()}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Salva in Commessa</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndPrintImmediately}
                className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>Salva &amp; Stampa A4</span>
              </button>
            </div>
          </div>

          {/* =================================================================
              COLONNA DESTRA (7 COLS): IL FOGLIO CARTELLO INTERATTIVO IN-APP (WYSIWYG)
              L'utente può cliccare e scrivere direttamente dentro il cartello!
          ================================================================= */}
          <div className="xl:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-extrabold text-slate-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                <span>
                   FOGLIO CARTELLO INTERATTIVO IN-APP (Clicca sulle scritte del cartello per modificarle al volo)
                </span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                Formato attivo: {layoutFormat.toUpperCase()}
              </span>
            </div>

            {/* FOGLIO VISIVO EDITABILE DIRETTAMENTE */}
            <div className="bg-white border-4 border-slate-950 rounded-2xl p-6 sm:p-8 shadow-lg text-slate-950 space-y-5">
              {/* 1. INTESTAZIONE CARTELLO */}
              <div className="border-b-4 border-slate-950 pb-3.5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest bg-slate-950 text-white inline-block">
                    CARTELLO LAVORAZIONE / VERNICIATURA / TRATTAMENTO
                  </span>
                  <div className="text-[11px] font-bold text-slate-600 mt-1.5 uppercase tracking-wide">
                    SCHEDA IDENTIFICATIVA MATERIALE IN CONTO LAVORAZIONE
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    DATA EMISSIONE
                  </span>
                  <input
                    type="text"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="text-base font-black text-slate-950 text-right bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 focus:outline-none w-28"
                  />
                </div>
              </div>

              {/* 2. BOX COMMESSA E CLIENTE (EDITABILI DIRETTAMENTE SUL CARTELLO) */}
              <div
                className={
                  layoutFormat === 'a4_landscape'
                    ? 'grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch'
                    : 'space-y-5'
                }
              >
                <div
                  className={`border-4 border-slate-900 rounded-2xl p-4 sm:p-5 bg-slate-50 space-y-2 ${
                    layoutFormat === 'a4_landscape' ? 'md:col-span-5' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-300 pb-1.5">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">
                      COMMESSA / ORDINE (Clicca per scrivere)
                    </span>
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                      <span>Cliente:</span>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nome Cliente..."
                        className="font-black uppercase text-slate-950 bg-white/80 px-2 py-0.5 rounded border border-slate-300 focus:border-blue-600 focus:outline-none w-36"
                      />
                    </div>
                  </div>

                  {/* INPUT GIGANTE CODICE COMMESSA DIRETTAMENTE SUL FOGLIO */}
                  <input
                    type="text"
                    value={commessaCode}
                    onChange={(e) => setCommessaCode(e.target.value)}
                    placeholder="SCRIVI COMMESSA..."
                    className={`w-full ${commessaPreviewSize} font-black font-mono tracking-tight text-slate-950 bg-transparent border-b-2 border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white rounded px-1 focus:outline-none leading-none`}
                  />

                  {/* INPUT SOTTO-TITOLO COMMESSA DIRETTAMENTE SUL FOGLIO */}
                  <input
                    type="text"
                    value={commessaTitle}
                    onChange={(e) => setCommessaTitle(e.target.value)}
                    placeholder="Descrizione commessa o lotto..."
                    className="w-full text-lg sm:text-xl font-extrabold text-slate-800 uppercase bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white rounded px-1 focus:outline-none"
                  />
                </div>

                {/* 3. BOX GIGANTE COLORE RAL / ZINCATURA / LAVORAZIONE (EDITABILE DIRETTAMENTE SUL FOGLIO) */}
                <div
                  className={`border-4 border-slate-950 rounded-2xl p-5 bg-white text-center space-y-3 ${
                    layoutFormat === 'a4_landscape' ? 'md:col-span-7' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Paintbrush className="w-5 h-5 text-amber-600" />
                    <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-slate-700">
                      COLORE RAL / ZINCATURA / LAVORAZIONE (Scrivi qui sotto)
                    </span>
                  </div>

                  {showColorBanner && swatchHex && (
                    <div
                      className="w-full max-w-md h-7 rounded-lg border-2 border-slate-900 mx-auto shadow-inner"
                      style={{ backgroundColor: swatchHex }}
                    />
                  )}

                  {/* INPUT GIGANTE DEL COLORE O ZINCATURA DIRETTAMENTE SUL CARTELLO */}
                  <div className="py-2 px-2 bg-amber-50/40 border-y-4 border-slate-950">
                    <input
                      type="text"
                      value={treatmentText}
                      onChange={(e) => setTreatmentText(e.target.value)}
                      placeholder="SCRIVI RAL O ZINCATO / ELETTROZINCATO..."
                      className={`w-full text-center ${treatmentPreviewSize} font-black font-mono tracking-tight text-slate-950 uppercase bg-transparent focus:bg-white rounded focus:outline-none focus:ring-2 focus:ring-amber-500/40`}
                    />
                  </div>

                  {/* FINITURA EDITABILE SUL CARTELLO */}
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-black uppercase">
                    <span>FINITURA:</span>
                    <input
                      type="text"
                      value={finishType}
                      onChange={(e) => setFinishType(e.target.value)}
                      placeholder="OPACO / LUCIDO / STANDARD"
                      className="bg-transparent text-amber-300 font-black uppercase focus:outline-none border-b border-slate-600 focus:border-amber-400 text-center w-48"
                    />
                  </div>
                </div>
              </div>

              {/* 4. TRE RIQUADRI INFERIORI EDITABILI DIRETTAMENTE SUL CARTELLO */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="border-2 border-slate-900 rounded-xl p-3 bg-slate-50">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">
                    COLLO / BANCALE ASSOCIATO
                  </span>
                  <input
                    type="text"
                    value={palletCode}
                    onChange={(e) => setPalletCode(e.target.value)}
                    placeholder="LOTTO INTERA COMMESSA"
                    className="w-full text-sm font-black font-mono text-slate-950 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white mt-1 focus:outline-none"
                  />
                </div>

                <div className="border-2 border-slate-900 rounded-xl p-3 bg-slate-50">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">
                    QUANTITÀ / COLLI / PEZZI
                  </span>
                  <input
                    type="text"
                    value={quantityOrPieces}
                    onChange={(e) => setQuantityOrPieces(e.target.value)}
                    placeholder="Es. 2 Bancali / 40 pz"
                    className="w-full text-sm font-black font-mono text-slate-950 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white mt-1 focus:outline-none"
                  />
                </div>

                <div className="border-2 border-slate-900 rounded-xl p-3 bg-slate-50">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">
                    REPARTO / TERZISTA DESTINATARIO
                  </span>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="Reparto Verniciatura / Zincatura"
                    className="w-full text-sm font-extrabold text-slate-950 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:bg-white mt-1 focus:outline-none"
                  />
                </div>
              </div>

              {/* 5. TABELLA ARTICOLI SE ATTIVA */}
              {showItemsList && load.items.length > 0 && (
                <div className="border-2 border-slate-900 rounded-xl overflow-hidden text-xs">
                  <div className="bg-slate-900 text-white px-3 py-1.5 font-black uppercase text-[10px] flex justify-between">
                    <span>ELENCO MATERIALI DELLA COMMESSA</span>
                    <span>{load.items.length} articoli</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto divide-y divide-slate-200">
                    {load.items.map((it) => (
                      <div
                        key={it.id}
                        className="px-3 py-1 flex items-center justify-between"
                      >
                        <span>
                          <strong className="font-mono">{it.sku}</strong> —{' '}
                          {it.name}
                        </span>
                        <span className="font-mono font-bold">
                          {it.quantity} pz
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. NOTE OPERATIVE EDITABILI SUL CARTELLO */}
              <div className="border-2 border-slate-900 rounded-xl p-3.5 bg-white">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  ISTRUZIONI / NOTE PER LA VERNICIATURA O LAVORAZIONE:
                </span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Clicca qui per scrivere eventuali istruzioni (es. mascherare fori filettati, non verniciare sedi, urgente)..."
                  className="w-full text-sm font-bold text-slate-950 bg-slate-50 px-3 py-2 rounded-lg border border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* 7. RIQUADRI FIRME SE ATTIVI */}
              {showSignatures && (
                <div className="grid grid-cols-3 gap-3 pt-2 border-t-2 border-slate-900 text-[10px]">
                  <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50">
                    <span className="font-extrabold text-slate-700 block uppercase">
                      1. Invio Materiale
                    </span>
                    <div className="h-5 border-b border-dashed border-slate-400 mt-2" />
                  </div>
                  <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50">
                    <span className="font-extrabold text-slate-700 block uppercase">
                      2. Esecuzione RAL / Zinc.
                    </span>
                    <div className="h-5 border-b border-dashed border-slate-400 mt-2" />
                  </div>
                  <div className="border border-slate-400 rounded-lg p-2.5 bg-slate-50">
                    <span className="font-extrabold text-slate-700 block uppercase">
                      3. Controllo Rientro
                    </span>
                    <div className="h-5 border-b border-dashed border-slate-400 mt-2" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =====================================================================
            SEZIONE 2: ARCHIVIO CARTELLI SALVATI NELLA COMMESSA
        ===================================================================== */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Cartelli Salvati per Questa Commessa ({savedTags.length})
            </h3>
            {savedTags.length > 1 && (
              <button
                type="button"
                onClick={() => setPrintingTagId('all')}
                className="text-xs font-bold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Stampa tutti i {savedTags.length} cartelli insieme</span>
              </button>
            )}
          </div>

          {savedTags.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center space-y-1.5">
              <p className="text-xs font-bold text-slate-700">
                Nessun cartello salvato in archivio per questa commessa
              </p>
              <p className="text-xs text-slate-500">
                Compila il Cartello interattivo qui sopra e clicca su &quot;Salva in Commessa&quot; o &quot;Salva &amp; Stampa A4&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {savedTags.map((tag, idx) => (
                <SavedTagCard
                  key={tag.id}
                  tag={tag}
                  index={idx}
                  pallets={load.pallets}
                  onUpdate={onUpdateFinishingTag}
                  onDelete={onDeleteFinishingTag}
                  onDuplicate={onDuplicateFinishingTag}
                  onPrint={(id) => setPrintingTagId(id)}
                  onLoadIntoLayout={handleLoadTagIntoLayout}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Stampa per i Cartelli Salvati */}
      {printingTagId !== null && savedTags.length > 0 && (
        <FinishingPrintModal
          load={load}
          tags={savedTags}
          initialTagId={printingTagId}
          defaultLayoutFormat={layoutFormat}
          onClose={() => setPrintingTagId(null)}
        />
      )}

      {/* Modal Stampa Immediata per il Cartello appena creato */}
      {instantPrintTag !== null && (
        <FinishingPrintModal
          load={load}
          tags={[instantPrintTag]}
          initialTagId={instantPrintTag.id}
          defaultLayoutFormat={layoutFormat}
          onClose={() => setInstantPrintTag(null)}
        />
      )}
    </div>
  );
};
