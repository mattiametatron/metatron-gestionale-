import React, { useState } from 'react';
import {
  FileText,
  Package,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  X,
  Truck,
  Sparkles,
  Upload,
  TrendingDown,
  History,
  Brain,
  QrCode,
  ShoppingCart,
} from 'lucide-react';
import { SynologyAppId } from './SynologyDesktopOS';

export const WHATS_NEW_RELEASE_KEY = 'metatron_release_2_1_seen_v1';

interface WhatsNewShowcaseModalProps {
  userName?: string;
  onClose: () => void;
  onLaunchApp?: (appId: SynologyAppId) => void;
}

interface FeatureSlide {
  id: 'memory' | 'zeroclick' | 'antiforget' | 'predictive';
  number: string;
  shortTitle: string;
  title: string;
  summary: string;
  highlights: string[];
  targetApp: SynologyAppId;
  actionLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentText: string;
  accentBg: string;
  accentBorder: string;
}

const FEATURES: FeatureSlide[] = [
  {
    id: 'memory',
    number: '01',
    shortTitle: 'Memoria che Impara da Te',
    title: 'Ricorda le tue abitudini per sempre',
    summary:
      'Ogni volta che rinomini un barcode sparato, assegni una categoria o scegli un fornitore, METATRON se lo ricorda in locale. La volta dopo che passa quel codice o una descrizione simile in PDF, Excel o Scanner, compila già tutto nel tuo stile.',
    highlights: [
      'Impara in silenzio da Scanner Bancale, Magazzino e Check-List',
      'Compila automaticamente nome, categoria, scaffale e fornitore',
      '100% locale sul tuo PC: nessuna API esterna e nessuna chat',
    ],
    targetApp: 'pallet_truck_scanner',
    actionLabel: 'Apri Scanner Bancale',
    icon: Brain,
    accentText: 'text-amber-300',
    accentBg: 'bg-amber-400/15',
    accentBorder: 'border-amber-400/35',
  },
  {
    id: 'zeroclick',
    number: '02',
    shortTitle: 'Commessa Zero-Click',
    title: 'Trascina un file sul desktop e fa tutto lui',
    summary:
      'Trascina un PDF, un Excel o la foto di una bolla direttamente sulla scrivania: METATRON crea la nuova commessa, estrae gli articoli, prepara scatole e bancali bilanciati SX/DX sul camion, rileva i cartelli RAL/Zincatura e genera subito i QR.',
    highlights: [
      'Trascina direttamente sul desktop oppure clicca "Da File"',
      'Imballaggio automatico, bilanciamento camion e cartelli RAL in 1 passo',
      'Etichette QR pronte per la stampa immediata appena finisce',
    ],
    targetApp: 'checklist',
    actionLabel: 'Apri Check-List',
    icon: Upload,
    accentText: 'text-sky-300',
    accentBg: 'bg-sky-400/15',
    accentBorder: 'border-sky-400/35',
  },
  {
    id: 'antiforget',
    number: '03',
    shortTitle: 'Antidimenticanza Storico',
    title: 'Ti avvisa se manca qualcosa rispetto alle vecchie commesse',
    summary:
      'Mentre prepari una commessa, confronta silenziosamente i materiali con le tue spedizioni simili passate e ti segnala subito eventuali viti, staffe o accessori che metti sempre insieme — con aggiunta in un clic.',
    highlights: [
      'Confronto automatico tra la commessa attuale e lo storico spedizioni',
      'Suggerisce la quantità tipica usata nelle commesse precedenti',
      'Nessun popup fastidioso: barra discreta integrata nella Check-List',
    ],
    targetApp: 'checklist',
    actionLabel: 'Verifica in Check-List',
    icon: History,
    accentText: 'text-teal-300',
    accentBg: 'bg-teal-400/15',
    accentBorder: 'border-teal-400/35',
  },
  {
    id: 'predictive',
    number: '04',
    shortTitle: 'Magazzino Predittivo',
    title: 'Anticipa gli esaurimenti prima di restare a zero',
    summary:
      'Analizza il ritmo reale degli scarichi e il materiale già impegnato nelle commesse aperte: ti avvisa con giorni di anticipo cosa sta per finire e calcola le quantità giuste da ordinare al fornitore.',
    highlights: [
      'Calcola giorni rimanenti e fabbisogno delle commesse in corso',
      'Avviso anticipato sia in Magazzino che in Ordini Fornitori',
      'Prepara in un clic tutte le bozze ordine raggruppate per fornitore',
    ],
    targetApp: 'purchase_orders',
    actionLabel: 'Apri Ordini Fornitori',
    icon: TrendingDown,
    accentText: 'text-emerald-300',
    accentBg: 'bg-emerald-400/15',
    accentBorder: 'border-emerald-400/35',
  },
];

export const WhatsNewShowcaseModal: React.FC<WhatsNewShowcaseModalProps> = ({
  userName,
  onClose,
  onLaunchApp,
}) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = FEATURES[activeIdx];
  const firstName = (userName || '').trim().split(/\s+/)[0];

  return (
    <div
      className="no-print fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-[#04070f]/75 backdrop-blur-xl animate-[fadeIn_240ms_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
    >
      <div className="relative w-full max-w-[960px] rounded-[28px] overflow-hidden border border-white/[0.16] bg-[#0a101d]/95 text-white shadow-[0_40px_120px_-20px_rgba(0,0,0,0.88)]">
        {/* Subtle warm alpine horizon light */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[640px] h-[220px] rounded-full blur-3xl opacity-35"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(251,191,36,0.55) 0%, rgba(14,165,233,0.24) 55%, transparent 80%)',
          }}
        />

        {/* Top Bar */}
        <div className="relative z-10 px-6 sm:px-8 pt-6 pb-5 border-b border-white/[0.09] flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Aggiornamento METATRON 2.1 · Intelligenza Adattiva Locale</span>
            </div>
            <h2
              id="whats-new-title"
              className="mt-2 text-2xl sm:text-[28px] font-semibold tracking-[-0.025em] leading-tight text-white [text-wrap:balance]"
            >
              {firstName
                ? `${firstName}, ora METATRON impara da te e anticipa il lavoro.`
                : 'Ora METATRON impara da te e anticipa il lavoro.'}
            </h2>
            <p className="mt-1.5 text-[13px] text-slate-300/85 max-w-2xl">
              Quattro nuovi motori silenziosi integrati direttamente nel gestionale. Zero chat, zero API esterne: tutto apprende e funziona in locale.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.09] transition-colors cursor-pointer shrink-0"
            aria-label="Chiudi finestra novità"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Split Showcase */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[290px_1fr]">
          {/* Left Navigation Rail */}
          <nav
            aria-label="Novità automazione adattiva"
            className="p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-white/[0.02] flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible"
          >
            {FEATURES.map((feat, idx) => {
              const Icon = feat.icon;
              const isSelected = idx === activeIdx;
              return (
                <button
                  key={feat.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`min-w-[205px] lg:min-w-0 w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-white/[0.09] border-white/[0.22] shadow-lg'
                      : 'bg-transparent border-transparent hover:bg-white/[0.04] hover:border-white/[0.08]'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? `${feat.accentBg} ${feat.accentBorder} ${feat.accentText}`
                        : 'bg-white/[0.04] border-white/[0.08] text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] tabular-nums text-slate-400">
                      {feat.number}.
                    </div>
                    <div
                      className={`text-[13px] font-semibold truncate ${
                        isSelected ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {feat.shortTitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Right Live Visual Preview Stage */}
          <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-5">
              {/* Mechanism-to-Outcome Visual Diagram */}
              <div className="rounded-2xl border border-white/[0.11] bg-[#060a14]/90 p-4 sm:p-5">
                {current.id === 'memory' && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1.2fr] items-center gap-3.5">
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>La prima volta</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-300">
                        Barcode 80129400 → Rinomini in &quot;Staffa Inox L40&quot;
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Categoria: Carpenteria · Fornitore: Rossi Srl
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/25 p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-emerald-300">
                        Ogni volta successiva
                      </div>
                      <div className="text-[11px] text-slate-200 leading-relaxed">
                        Riconosce codice e parole chiave in automatico: nome, categoria, scaffale e fornitore già compilati senza rifare nulla.
                      </div>
                    </div>
                  </div>
                )}

                {current.id === 'zeroclick' && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1.35fr] items-center gap-3.5">
                    <div className="rounded-xl bg-white/[0.04] border border-dashed border-sky-400/45 p-3 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                        <FileText className="w-4 h-4" />
                        <span>Trascini sul Desktop</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-300">
                        Ordine_Cliente_402.pdf
                      </div>
                      <div className="text-[11px] text-slate-400">
                        PDF · Excel · CSV · Foto Bolla
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className="w-9 h-9 rounded-full bg-sky-400/15 border border-sky-400/40 text-sky-300 flex items-center justify-center">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.1] p-3 grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
                      <div className="text-slate-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Commessa + Lista</span>
                      </div>
                      <div className="text-slate-200 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                        <span>Bancali SX/DX OK</span>
                      </div>
                      <div className="text-slate-200 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                        <span>Cartelli RAL auto</span>
                      </div>
                      <div className="text-slate-200 flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                        <span>QR subito pronti</span>
                      </div>
                    </div>
                  </div>
                )}

                {current.id === 'antiforget' && (
                  <div className="rounded-xl bg-white/[0.04] border border-teal-400/25 p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-teal-300">
                        Confronto silenzioso con le tue commesse passate
                      </span>
                      <span className="font-mono tabular-nums text-[11px] text-slate-400">
                        Storico locale
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0a1222] border border-white/[0.08] px-3 py-2 text-xs">
                      <div>
                        <div className="font-medium text-white">
                          KIT-BULL-M12 · Bulloneria Fissaggio Guide
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Presente in 3 commesse simili insieme a &quot;Guida Lineare&quot; · q.tà tipica 24
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-teal-300 whitespace-nowrap">
                        + Aggiungi in 1 clic
                      </span>
                    </div>
                  </div>
                )}

                {current.id === 'predictive' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-amber-300 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" />
                        <span>Previsione Esaurimento</span>
                      </div>
                      <div className="text-[11px] text-slate-200 font-mono tabular-nums">
                        Giacenza 14 pz · Servono 20 pz per commesse aperte
                      </div>
                      <div className="text-[11px] text-amber-200/90">
                        Segnalato in anticipo prima di andare a zero
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/25 p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-emerald-300 flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4" />
                        <span>Ordini Predittivi Pronti</span>
                      </div>
                      <div className="text-[11px] text-slate-200 leading-relaxed">
                        Calcola da solo la quantità ideale per coprire commesse aperte e consumi delle prossime 3 settimane.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Copy & Highlights */}
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-white">
                  {current.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-300">
                  {current.summary}
                </p>

                <ul className="mt-4 space-y-2">
                  {current.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-start gap-2.5 text-[13px] text-slate-200"
                    >
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 mt-0.5 ${current.accentText}`}
                      />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {FEATURES.map((f, i) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    aria-label={`Mostra novità ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      i === activeIdx
                        ? 'w-7 bg-amber-400'
                        : 'w-2 bg-white/25 hover:bg-white/45'
                    }`}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {onLaunchApp && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLaunchApp(current.targetApp);
                    }}
                    className="h-10 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.15] text-xs font-semibold text-white whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {current.actionLabel}
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:via-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold flex items-center gap-2 whitespace-nowrap shadow-[0_12px_28px_-8px_rgba(245,158,11,0.65)] transition-all cursor-pointer"
                >
                  <span>Inizia a usare METATRON 2.1</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
