import React, { useState } from 'react';
import {
  Boxes,
  Box,
  CheckSquare,
  GitBranch,
  Truck,
  PenTool,
  FolderPlus,
  RotateCcw,
  Download,
  Upload,
  Printer,
  Scale,
  CheckCircle2,
  AlertCircle,
  Copy,
  Pencil,
  Check,
  X,
  FolderDown,
  Monitor,
  Languages,
  Paintbrush,
} from 'lucide-react';
import { CargoLoad } from '../types/warehouse';
import { LoadSummary } from '../utils/calculations';

export type DesktopSection =
  | 'checklist'
  | 'tree'
  | 'pallet_weights'
  | 'painting_tags'
  | 'view3d'
  | 'truck'
  | 'signatures';

interface SidebarNavProps {
  loads: CargoLoad[];
  activeLoad: CargoLoad;
  summary: LoadSummary;
  activeSection: DesktopSection;
  onSelectSection: (section: DesktopSection) => void;
  onSelectLoad: (loadId: string) => void;
  onOpenNewLoadModal: () => void;
  onDuplicateLoad: () => void;
  onUpdateProjectName: (title: string, code: string) => void;
  onClearCurrentLoad: () => void;
  onOpenPrintModal: () => void;
  onSaveToFolder: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenWindowsInstaller: () => void;
  onOpenPdfTranslator: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  loads,
  activeLoad,
  summary,
  activeSection,
  onSelectSection,
  onSelectLoad,
  onOpenNewLoadModal,
  onDuplicateLoad,
  onUpdateProjectName,
  onClearCurrentLoad,
  onOpenPrintModal,
  onSaveToFolder,
  onImportJSON,
  onOpenWindowsInstaller,
  onOpenPdfTranslator,
}) => {
  const [editingProject, setEditingProject] = useState(false);
  const [editTitle, setEditTitle] = useState(activeLoad.title);
  const [editCode, setEditCode] = useState(activeLoad.code);

  const startEditProject = () => {
    setEditTitle(activeLoad.title);
    setEditCode(activeLoad.code);
    setEditingProject(true);
  };

  const saveEditProject = () => {
    if (editTitle.trim()) {
      onUpdateProjectName(
        editTitle.trim(),
        editCode.trim().toUpperCase() || activeLoad.code
      );
    }
    setEditingProject(false);
  };

  const weightPercent = Math.min(
    100,
    Math.round(
      (summary.totalGrossWeightKg / Math.max(1, activeLoad.vehicleMaxWeightKg)) *
        100
    )
  );

  const signedCount = activeLoad.signatures?.length || 0;

  return (
    <aside className="no-print w-[280px] shrink-0 h-full bg-white border-r border-slate-200 flex flex-col justify-between select-none shadow-xs z-20">
      {/* TOP: BRAND & PROGETTO / COMMESSA SPEDIZIONE */}
      <div className="p-4 space-y-3 border-b border-slate-200">
        {/* App Title Lockup */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-black tracking-tight text-slate-900 block leading-tight">
                CaricoStudio
              </span>
              <span className="text-[10px] font-semibold text-slate-400 block">
                Gestione Spedizioni
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            v2.6
          </span>
        </div>

        {/* Selettore & Gestione Progetto / Commessa */}
        <div className="bg-slate-50/90 p-2.5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Commessa Attiva</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={startEditProject}
                title="Rinomina Progetto / Commessa"
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onDuplicateLoad}
                title="Duplica intera Commessa (Copia)"
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onClearCurrentLoad}
                title="Svuota articoli e scatole della commessa corrente"
                className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {editingProject ? (
            <div className="space-y-1.5 bg-white p-2 rounded-lg border border-blue-400 shadow-2xs">
              <div className="grid grid-cols-3 gap-1">
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="Codice"
                  className="px-2 py-1 text-[11px] font-mono font-bold bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Titolo commessa"
                  className="col-span-2 px-2 py-1 text-[11px] font-bold bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => setEditingProject(false)}
                  className="px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={saveEditProject}
                  className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded cursor-pointer"
                >
                  Salva
                </button>
              </div>
            </div>
          ) : (
            <select
              aria-label="Seleziona Progetto / Commessa Attiva"
              value={activeLoad.id}
              onChange={(e) => onSelectLoad(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 transition-all truncate cursor-pointer shadow-2xs"
            >
              {loads.map((l, index) => (
                <option key={`${l.id || l.code || 'load'}-${index}`} value={l.id}>
                  {l.code} — {l.title}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <span className="truncate max-w-[150px]" title={activeLoad.client || 'Cliente non specificato'}>
              {activeLoad.client || 'Cliente N/D'}
            </span>
            <span className="font-mono text-[10px]">
              {activeLoad.departureDate || 'In preparazione'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenNewLoadModal}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/90 rounded-lg transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>+ Nuova Commessa</span>
          </button>
        </div>
      </div>

      {/* CENTER: MENU DI NAVIGAZIONE PRINCIPALE */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <div className="px-2.5 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Aree Operative
        </div>

        {/* 1. Check-list Merci */}
        <button
          type="button"
          onClick={() => onSelectSection('checklist')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
            activeSection === 'checklist'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <CheckSquare
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'checklist' ? 'text-white' : 'text-blue-600'
              }`}
            />
            <div className="truncate">
              <div className="text-xs leading-tight">Check-list & Foto</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  activeSection === 'checklist' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Articoli, foto, kit e duplica
              </div>
            </div>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
              activeSection === 'checklist'
                ? 'bg-blue-700 text-white font-bold'
                : 'bg-slate-100 text-slate-700 font-semibold'
            }`}
          >
            {summary.checkedItems}/{summary.totalItems}
          </span>
        </button>

        {/* 2. Albero Bancali & Scatole */}
        <button
          type="button"
          onClick={() => onSelectSection('tree')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
            activeSection === 'tree'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <GitBranch
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'tree' ? 'text-white' : 'text-indigo-600'
              }`}
            />
            <div className="truncate">
              <div className="text-xs leading-tight">Albero Bancali & Scatole</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  activeSection === 'tree' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Misure, sotto-scatole e fuori scatola
              </div>
            </div>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
              activeSection === 'tree'
                ? 'bg-blue-700 text-white font-bold'
                : 'bg-slate-100 text-slate-700 font-semibold'
            }`}
          >
            {summary.totalPallets}B · {summary.totalBoxes}S
          </span>
        </button>

        {/* 3. Pesi Bancali & Stampa Fogli Collo A4 */}
        <button
          type="button"
          onClick={() => onSelectSection('pallet_weights')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
            activeSection === 'pallet_weights'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Scale
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'pallet_weights' ? 'text-white' : 'text-blue-600'
              }`}
            />
            <div className="truncate">
              <div className="text-xs leading-tight">Pesi Bancali &amp; Fogli A4</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  activeSection === 'pallet_weights' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Scrivi peso e stampa foglio singolo
              </div>
            </div>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
              activeSection === 'pallet_weights'
                ? 'bg-blue-700 text-white font-bold'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold'
            }`}
          >
            {summary.totalPallets} bancali
          </span>
        </button>

        {/* 4. Cartelli Verniciatura / RAL / Zincatura */}
        <button
          type="button"
          onClick={() => onSelectSection('painting_tags')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
            activeSection === 'painting_tags'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Paintbrush
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'painting_tags' ? 'text-white' : 'text-amber-600'
              }`}
            />
            <div className="truncate">
              <div className="text-xs leading-tight">Verniciatura / RAL &amp; Zinc.</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  activeSection === 'painting_tags' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Cartellini RAL, zincato e lavorazioni
              </div>
            </div>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
              activeSection === 'painting_tags'
                ? 'bg-blue-700 text-white font-bold'
                : 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
            }`}
          >
            {(activeLoad.finishingTags?.length || 0) > 0
              ? `${activeLoad.finishingTags?.length} cart.`
              : 'RAL'}
          </span>
        </button>

        {/* 5. Riproduzione 3D Stivaggio Scatole su Bancale */}
        <button
          type="button"
          onClick={() => onSelectSection('view3d')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
            activeSection === 'view3d'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Box
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'view3d' ? 'text-white' : 'text-amber-600'
              }`}
            />
            <div className="truncate">
              <div className="text-xs leading-tight">CAD 3D Bancali</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  activeSection === 'view3d' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Piani, raggi X e guida passo-passo
              </div>
            </div>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
              activeSection === 'view3d'
                ? 'bg-blue-700 text-white font-bold'
                : 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
            }`}
          >
            3D
          </span>
        </button>

        {/* 4. Piano Carico Camion */}
        <button
          type="button"
          onClick={() => onSelectSection('truck')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
            activeSection === 'truck'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Truck
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'truck' ? 'text-white' : 'text-emerald-600'
              }`}
            />
            <div className="truncate">
              <div className="text-xs leading-tight">Piano Carico Mezzo</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  activeSection === 'truck' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Stivaggio piazzole e pesi
              </div>
            </div>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
              activeSection === 'truck'
                ? 'bg-blue-700 text-white font-bold'
                : 'bg-slate-100 text-slate-700 font-semibold'
            }`}
          >
            {summary.totalPallets}/{activeLoad.vehicleMaxPallets}
          </span>
        </button>

        {/* 5. Firme Elettroniche Collaboratori */}
        <button
          type="button"
          onClick={() => onSelectSection('signatures')}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
            activeSection === 'signatures'
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-700 hover:bg-slate-100 font-semibold'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <PenTool
              className={`w-4 h-4 shrink-0 ${
                activeSection === 'signatures' ? 'text-white' : 'text-amber-600'
              }`}
            />
            <div className="truncate">
              <div className="text-xs leading-tight">Firme & Convalida</div>
              <div
                className={`text-[10px] font-normal mt-0.5 ${
                  activeSection === 'signatures' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                Operatore, Logistica, Vettore
              </div>
            </div>
          </div>
          <span
            className={`font-mono text-[11px] px-2 py-0.5 rounded-md tabular-nums shrink-0 ${
              activeSection === 'signatures'
                ? 'bg-blue-700 text-white font-bold'
                : signedCount === 3
                ? 'bg-emerald-100 text-emerald-800 font-bold'
                : 'bg-slate-100 text-slate-700 font-semibold'
            }`}
          >
            {signedCount}/3
          </span>
        </button>

        {/* Alert Articoli Da Smistare */}
        {summary.unassignedItems.length > 0 && (
          <div className="mt-3 mx-1 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{summary.unassignedItems.length} articoli da assegnare</span>
            </div>
            <p className="text-[10px] text-amber-800 leading-relaxed">
              Assegnali a una scatola o come fuori scatola sul bancale.
            </p>
          </div>
        )}
      </div>

      {/* BOTTOM: RIEPILOGO PESI & AZIONI RAPIDE */}
      <div className="p-3.5 border-t border-slate-200 bg-slate-50/80 space-y-2.5">
        {/* Saturazione Peso e Capacità Mezzo */}
        <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-blue-600" />
                <span>Portata Mezzo</span>
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {weightPercent}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                style={{ width: `${weightPercent}%` }}
                className={`h-full transition-all duration-300 rounded-full ${
                  weightPercent > 100
                    ? 'bg-rose-600'
                    : weightPercent > 85
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 tabular-nums">
              <span>{summary.totalGrossWeightKg.toFixed(0)} kg lordo</span>
              <span>Max: {activeLoad.vehicleMaxWeightKg} kg</span>
            </div>
          </div>

          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 font-medium">Spunta Check-list:</span>
            <span className="font-mono font-bold text-slate-800 tabular-nums flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {summary.checklistCompletionPercent}% ({summary.checkedPieces}/{summary.totalPieces})
            </span>
          </div>
        </div>

        {/* Pulsante Primario Stampa */}
        <button
          type="button"
          onClick={onOpenPrintModal}
          className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-blue-400" />
          <span>Stampa Etichette &amp; Distinte</span>
        </button>

        {/* Salva Commessa nella Cartella PC / Apri da Cartella */}
        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={onSaveToFolder}
            className="py-1.5 px-2 font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title="Scegli la cartella sul PC e salva il file della Commessa"
          >
            <FolderDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Salva File</span>
          </button>
          <label
            className="py-1.5 px-2 font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
            title="Apri una Commessa o archivio salvato in una cartella del PC"
          >
            <Upload className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Apri File</span>
            <input
              type="file"
              accept=".json"
              onChange={onImportJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </aside>
  );
};
