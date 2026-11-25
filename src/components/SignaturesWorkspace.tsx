import React, { useState } from 'react';
import {
  PenTool,
  CheckCircle2,
  Trash2,
  Printer,
  ShieldCheck,
  Clock,
  Building2,
  UserCheck,
} from 'lucide-react';
import { CargoLoad, ElectronicSignature } from '../types/warehouse';
import { LoadSummary } from '../utils/calculations';
import { SignaturePadModal } from './SignaturePadModal';

interface SignaturesWorkspaceProps {
  load: CargoLoad;
  summary: LoadSummary;
  onSaveSignature: (sig: ElectronicSignature) => void;
  onDeleteSignature: (role: 'operatore' | 'responsabile' | 'autista') => void;
  onOpenPrintModal: () => void;
}

const ROLES: Array<{
  role: 'operatore' | 'responsabile' | 'autista';
  step: string;
  title: string;
  department: string;
  description: string;
}> = [
  {
    role: 'operatore',
    step: '01',
    title: 'Operatore di Magazzino',
    department: 'Reparto Prelievo & Imballo',
    description:
      'Attesta il prelievo fisico degli articoli, il conteggio conforme alla check-list e il corretto imballaggio nelle scatole.',
  },
  {
    role: 'responsabile',
    step: '02',
    title: 'Responsabile Spedizioni',
    department: 'Controllo Qualità & Logistica',
    description:
      'Convalida la chiusura delle scatole, la filmatura dei bancali, il rispetto della portata e la conformità documentale.',
  },
  {
    role: 'autista',
    step: '03',
    title: 'Autista / Vettore',
    department: 'Presa in Carico Trasporto',
    description:
      'Certifica il caricamento dei bancali sulla ribalta del mezzo, l’integrità esterna dei colli e la presa in consegna.',
  },
];

export const SignaturesWorkspace: React.FC<SignaturesWorkspaceProps> = ({
  load,
  summary,
  onSaveSignature,
  onDeleteSignature,
  onOpenPrintModal,
}) => {
  const [activeSignRole, setActiveSignRole] = useState<
    'operatore' | 'responsabile' | 'autista' | null
  >(null);

  const getSignature = (role: 'operatore' | 'responsabile' | 'autista') => {
    return load.signatures?.find((s) => s.role === role);
  };

  return (
    <div className="h-full flex flex-col justify-between gap-4 overflow-y-auto pr-1">
      <div className="space-y-4">
        {/* Banner Informativo Convalida */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                Registro Firme Elettroniche e Convalida Carico ({load.code})
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                Fai firmare direttamente sullo schermo con mouse, penna touch o dito chi lavora con te in magazzino e l&apos;autista. Le firme vengono stampate in calce alla Packing List e alle etichette bancale.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPrintModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Printer className="w-4 h-4" />
            Anteprima Documenti Firmati
          </button>
        </div>

        {/* Griglia 3 Ruoli di Firma */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {ROLES.map((item) => {
            const sig = getSignature(item.role);

            return (
              <div
                key={item.role}
                className={`bg-white rounded-xl border transition-all p-5 flex flex-col justify-between space-y-5 shadow-xs ${
                  sig ? 'border-emerald-400 ring-1 ring-emerald-500/20' : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {item.step}
                      </span>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {item.title}
                        </h3>
                        <span className="text-[11px] font-medium text-slate-500 block">
                          {item.department}
                        </span>
                      </div>
                    </div>

                    {sig ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Firmato
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                        In attesa
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Riquadro Grafico Firma */}
                  {sig ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="bg-white border border-slate-200 rounded-lg p-3 h-28 flex items-center justify-center">
                        <img
                          src={sig.signatureDataUrl}
                          alt={`Firma ${sig.signerName}`}
                          className="max-h-24 object-contain"
                        />
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{sig.signerName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{sig.companyOrBadge || item.department}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {new Date(sig.signedAt).toLocaleDateString('it-IT')} ore{' '}
                            {new Date(sig.signedAt).toLocaleTimeString('it-IT', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setActiveSignRole(item.role)}
                      className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/70 hover:bg-blue-50/30 rounded-xl h-44 flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-blue-600 group-hover:border-blue-300 shadow-2xs mb-2 transition-colors">
                        <PenTool className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                        Clicca qui per apporre la firma
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        Traccia con mouse, touch o penna grafica
                      </span>
                    </div>
                  )}
                </div>

                {/* Azioni Footer Card */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSignRole(item.role)}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      sig
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {sig ? 'Aggiorna Firma' : 'Apponi Firma Ora'}
                  </button>

                  {sig && (
                    <button
                      type="button"
                      onClick={() => onDeleteSignature(item.role)}
                      title="Cancella firma"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Riepilogo Stato Conformità a Piè di Pagina */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs shadow-2xs shrink-0">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="text-slate-500">Articoli Verificati: </span>
            <strong className="font-mono text-slate-900">
              {summary.checkedItems}/{summary.totalItems} ({summary.checklistCompletionPercent}%)
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Scatole Sigillate: </span>
            <strong className="font-mono text-slate-900">
              {summary.sealedBoxes}/{summary.totalBoxes}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Bancali Filmati: </span>
            <strong className="font-mono text-slate-900">
              {summary.wrappedPallets}/{summary.totalPallets}
            </strong>
          </div>
        </div>

        <div className="font-mono text-slate-600">
          Firme registrate: <strong className="text-slate-900">{load.signatures?.length || 0} di 3</strong>
        </div>
      </div>

      {activeSignRole && (
        <SignaturePadModal
          role={activeSignRole}
          existingSignature={getSignature(activeSignRole)}
          onSaveSignature={onSaveSignature}
          onClose={() => setActiveSignRole(null)}
        />
      )}
    </div>
  );
};
