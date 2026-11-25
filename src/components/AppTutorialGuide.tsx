import React, { useEffect, useState } from 'react';
import {
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  EyeOff,
  Lightbulb,
} from 'lucide-react';
import { APP_TUTORIALS, TutorialContextId } from '../data/appTutorials';

export interface TutorialPreferences {
  disableAll: boolean;
  dismissedIds: TutorialContextId[];
}

export function loadTutorialPreferences(userId: string): TutorialPreferences {
  try {
    const raw = localStorage.getItem(`caricostudio_tutorials_prefs_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        disableAll: Boolean(parsed?.disableAll),
        dismissedIds: Array.isArray(parsed?.dismissedIds) ? parsed.dismissedIds : [],
      };
    }
  } catch {
    // ignore
  }
  return { disableAll: false, dismissedIds: [] };
}

export function saveTutorialPreferences(
  userId: string,
  prefs: TutorialPreferences
): void {
  try {
    localStorage.setItem(`caricostudio_tutorials_prefs_${userId}`, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

interface AppTutorialGuideProps {
  contextId: TutorialContextId;
  isOpen: boolean;
  onSkipSession: () => void;
  onDontAskAgainForApp: (contextId: TutorialContextId) => void;
  onDontAskAgainEver: () => void;
}

export const AppTutorialGuide: React.FC<AppTutorialGuideProps> = ({
  contextId,
  isOpen,
  onSkipSession,
  onDontAskAgainForApp,
  onDontAskAgainEver,
}) => {
  const tutorial = APP_TUTORIALS[contextId];
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
  }, [contextId, isOpen]);

  if (!isOpen || !tutorial) return null;

  const steps = tutorial.steps;
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;

  return (
    <div className="no-print fixed bottom-14 right-4 z-[80] w-[calc(100vw-2rem)] max-w-md bg-[#0f1320]/96 backdrop-blur-2xl border border-white/14 rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.72)] overflow-hidden text-white">
      {/* Header */}
      <div className="bg-white/[0.04] px-4 py-3 border-b border-white/[0.08] flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-b from-[#7b5cff] to-[#5737eb] flex items-center justify-center shrink-0 mt-0.5 ring-1 ring-inset ring-white/20">
            <HelpCircle className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-wide text-indigo-300 tabular-nums">
              Guida Rapida · Passo {stepIndex + 1} di {steps.length}
            </div>
            <h3 className="text-sm font-bold leading-snug truncate text-white">
              {tutorial.appTitle}
            </h3>
            <p className="text-[11px] text-white/55 truncate">{tutorial.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSkipSession}
          className="p-1 rounded-lg hover:bg-white/12 text-white/60 hover:text-white cursor-pointer shrink-0"
          title="Chiudi guida"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Progress bar */}
        <div className="flex items-center gap-1.5">
          {steps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStepIndex(idx)}
              aria-label={`Vai al passo ${idx + 1}`}
              className={`h-1.5 flex-1 rounded-full transition-colors cursor-pointer ${
                idx === stepIndex
                  ? 'bg-indigo-400'
                  : idx < stepIndex
                  ? 'bg-indigo-400/45'
                  : 'bg-white/12'
              }`}
            />
          ))}
        </div>

        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-white">{currentStep.title}</h4>
          <p className="text-xs text-white/70 leading-relaxed">{currentStep.body}</p>
        </div>

        {currentStep.tip && (
          <div className="p-2.5 rounded-xl bg-amber-500/12 border border-amber-400/25 text-[11px] text-amber-200 flex items-start gap-2">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{currentStep.tip}</span>
          </div>
        )}

        {/* Navigation row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={onSkipSession}
            className="px-2.5 py-1.5 text-xs font-semibold text-white/65 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer whitespace-nowrap transition-colors"
          >
            Salta
          </button>

          <div className="flex items-center gap-1.5">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="px-3 py-1.5 text-xs font-semibold text-white/85 bg-white/[0.08] hover:bg-white/[0.15] rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Indietro</span>
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                onClick={() => onDontAskAgainForApp(contextId)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Ho capito</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors"
              >
                <span>Avanti</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Footer: Non chiedere più (questa app / nessuna app) */}
        <div className="pt-2.5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => onDontAskAgainForApp(contextId)}
            className="text-white/65 hover:text-white font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <EyeOff className="w-3 h-3" />
            <span>Non chiedere più qui</span>
          </button>
          <button
            type="button"
            onClick={onDontAskAgainEver}
            className="text-white/45 hover:text-rose-300 font-medium cursor-pointer transition-colors"
          >
            Non chiedere più su nessuna app
          </button>
        </div>
      </div>
    </div>
  );
};
