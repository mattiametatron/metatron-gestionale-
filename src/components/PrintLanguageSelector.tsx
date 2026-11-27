import React from 'react';
import { Globe, Loader2 } from 'lucide-react';
import {
  PRINT_LANGUAGE_OPTIONS,
  PrintLanguageCode,
} from '../utils/printLanguage';

interface PrintLanguageSelectorProps {
  value: PrintLanguageCode;
  onChange: (lang: PrintLanguageCode) => void;
  isTranslating?: boolean;
  variant?: 'light' | 'dark' | 'topbar';
  label?: string;
}

export const PrintLanguageSelector: React.FC<PrintLanguageSelectorProps> = ({
  value,
  onChange,
  isTranslating = false,
  variant = 'light',
  label = 'Lingua stampa',
}) => {
  if (variant === 'topbar') {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white transition-colors"
        title="Lingua di stampa globale per tutte le etichette, PDF, DDT, Ordini e Cartelli"
      >
        {isTranslating ? (
          <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin shrink-0" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-sky-300 shrink-0" />
        )}
        <span className="hidden xl:inline text-[11px] font-medium text-white/80">
          Stampa:
        </span>
        <select
          aria-label="Lingua di stampa globale"
          value={value}
          onChange={(e) => onChange(e.target.value as PrintLanguageCode)}
          className="bg-transparent text-[11px] font-bold text-white focus:outline-none cursor-pointer pr-0.5"
        >
          {PRINT_LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code} className="bg-slate-900 text-white">
              {opt.shortLabel} — {opt.nativeName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (variant === 'dark') {
    return (
      <div
        className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700"
        title="Converti etichette e stampe in Inglese o altra lingua con AI"
      >
        {isTranslating ? (
          <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
        ) : (
          <Globe className="w-3.5 h-3.5 text-sky-400 shrink-0" />
        )}
        <span className="text-[11px] text-slate-300 font-semibold hidden sm:inline">
          {label}:
        </span>
        <select
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value as PrintLanguageCode)}
          className="bg-slate-900 text-white text-xs font-bold rounded-lg px-2 py-1 border border-slate-600 focus:outline-none focus:border-sky-400 cursor-pointer"
        >
          {PRINT_LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.shortLabel} · {opt.nativeName}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
      title="Converti etichette e stampe in Inglese o altra lingua con AI"
    >
      {isTranslating ? (
        <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
      ) : (
        <Globe className="w-3.5 h-3.5 text-blue-600 shrink-0" />
      )}
      <span className="text-[11px] font-semibold text-slate-600 hidden sm:inline">
        {label}:
      </span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as PrintLanguageCode)}
        className="bg-slate-50 text-slate-900 text-xs font-bold rounded-md px-2 py-0.5 border border-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
      >
        {PRINT_LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.shortLabel} · {opt.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
};
