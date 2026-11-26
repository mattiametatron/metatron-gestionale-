import React, { useEffect, useRef, useState } from 'react';
import { AuroraSilkWallpaper } from './AuroraSilkWallpaper';

export type MetatronSplashMode = 'login' | 'register' | 'logout';

interface MetatronBootSplashProps {
  userName: string;
  mode?: MetatronSplashMode;
  onComplete: () => void;
}

const LOAD_DURATION_MS = 5000;
const WELCOME_DURATION_MS = 2000;
const FAREWELL_DURATION_MS = 2000;
const FADE_OUT_MS = 380;
const METATRON_LETTERS = 'METATRON'.split('');

function formatDisplayName(rawName: string): string {
  const trimmed = rawName.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Utente';
  return trimmed
    .split(' ')
    .map((part) => {
      if (!part) return '';
      if (part === part.toUpperCase() && part.length <= 4) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function getEntryGreeting(hour: number): string {
  if (hour >= 5 && hour < 13) return 'Buongiorno';
  if (hour >= 13 && hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

function getFarewellWish(hour: number): string {
  if (hour >= 5 && hour < 14) return 'Buona giornata';
  if (hour >= 14 && hour < 18) return 'Buon proseguimento';
  return 'Buona serata';
}

export const MetatronBootSplash: React.FC<MetatronBootSplashProps> = ({
  userName,
  mode = 'login',
  onComplete,
}) => {
  const isLogout = mode === 'logout';
  const [progress, setProgress] = useState<number>(isLogout ? 100 : 0);
  const [phase, setPhase] = useState<'loading' | 'welcome' | 'exiting'>(
    isLogout ? 'welcome' : 'loading'
  );
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let rafId = 0;
    let exitTimer: number | undefined;
    let doneTimer: number | undefined;

    if (isLogout) {
      setPhase('welcome');
      exitTimer = window.setTimeout(() => {
        setPhase('exiting');
      }, FAREWELL_DURATION_MS);
      doneTimer = window.setTimeout(() => {
        onCompleteRef.current();
      }, FAREWELL_DURATION_MS + FADE_OUT_MS);

      return () => {
        if (exitTimer !== undefined) window.clearTimeout(exitTimer);
        if (doneTimer !== undefined) window.clearTimeout(doneTimer);
      };
    }

    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const ratio = Math.min(1, elapsed / LOAD_DURATION_MS);
      const eased = 1 - Math.pow(1 - ratio, 1.35);
      setProgress(Math.round(eased * 1000) / 10);

      if (ratio < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setProgress(100);
        setPhase('welcome');
        exitTimer = window.setTimeout(() => {
          setPhase('exiting');
        }, WELCOME_DURATION_MS);
        doneTimer = window.setTimeout(() => {
          onCompleteRef.current();
        }, WELCOME_DURATION_MS + FADE_OUT_MS);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (exitTimer !== undefined) window.clearTimeout(exitTimer);
      if (doneTimer !== undefined) window.clearTimeout(doneTimer);
    };
  }, [isLogout]);

  const cleanUserName = formatDisplayName(userName);
  const currentHour = new Date().getHours();
  const timeGreeting = getEntryGreeting(currentHour);
  const farewellWish = getFarewellWish(currentHour);

  const welcomePrefix =
    mode === 'register'
      ? 'Benvenuto'
      : mode === 'logout'
      ? 'Arrivederci'
      : 'Bentornato';

  const subtitleText =
    mode === 'register'
      ? 'Il tuo spazio di lavoro è pronto'
      : mode === 'logout'
      ? `${farewellWish} · A presto`
      : 'Buon lavoro';

  return (
    <div
      className={`no-print fixed inset-0 z-[120] flex items-center justify-center bg-[#090b16] overflow-hidden select-none transition-all duration-[380ms] ${
        phase === 'exiting'
          ? 'opacity-0 scale-[1.015] pointer-events-none'
          : 'opacity-100 scale-100'
      }`}
    >
      <AuroraSilkWallpaper />

      {/* Soft centered atmospheric glow behind wordmark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[520px] h-[520px] rounded-full blur-3xl opacity-45"
        style={{
          background:
            'radial-gradient(circle, rgba(111,88,242,0.28) 0%, rgba(124,70,118,0.18) 42%, rgba(74,154,142,0.1) 70%, transparent 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center text-center">
        {phase === 'loading' ? (
          <div className="flex flex-col items-center w-full">
            {/* Animated METATRON Wordmark (outer reveal + inner shimmer) */}
            <div
              className="flex items-center justify-center pl-[0.28em] sm:pl-[0.34em] text-3xl sm:text-6xl font-extrabold tracking-[0.28em] sm:tracking-[0.34em] drop-shadow-[0_10px_35px_rgba(123,92,255,0.35)]"
              aria-label="METATRON"
            >
              {METATRON_LETTERS.map((char, index) => (
                <span
                  key={`${char}-${index}`}
                  style={{ animationDelay: `${index * 65}ms` }}
                  className="metatron-letter-in inline-block"
                >
                  <span className="metatron-title-shimmer inline-block">
                    {char}
                  </span>
                </span>
              ))}
            </div>

            {/* Subtle luminous divider */}
            <div
              aria-hidden="true"
              className="mt-5 h-px w-24 bg-gradient-to-r from-transparent via-white/35 to-transparent"
            />

            {/* Sleek 5-Second Loading Progress Bar */}
            <div className="mt-8 w-64 sm:w-80 space-y-2.5">
              <div className="relative h-[3.5px] w-full rounded-full bg-white/[0.1] overflow-hidden ring-1 ring-white/[0.06]">
                <div
                  style={{ width: `${Math.min(100, progress)}%` }}
                  className="relative h-full rounded-full bg-gradient-to-r from-[#6c52f5] via-[#b86ef5] to-[#72d4b8] shadow-[0_0_16px_rgba(139,92,246,0.75)]"
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white/90 blur-[2px]" />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-medium text-white/45 tracking-wide">
                <span>Avvio ambiente di lavoro</span>
                <span className="font-mono tabular-nums text-white/65">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="metatron-welcome-in flex flex-col items-center space-y-3.5">
            <span className="text-[11px] font-semibold tracking-[0.34em] pl-[0.34em] text-white/50 uppercase">
              {isLogout ? 'METATRON · DISCONNESSIONE' : `METATRON · ${timeGreeting}`}
            </span>

            <h1 className="text-3xl sm:text-5xl font-light tracking-tight text-white/90 leading-tight">
              {welcomePrefix},{' '}
              <span className="font-bold bg-gradient-to-r from-white via-indigo-100 to-emerald-200 bg-clip-text text-transparent">
                {cleanUserName}
              </span>
            </h1>

            <p className="text-sm sm:text-base font-normal text-white/55 tracking-wide">
              {subtitleText}
            </p>

            <div
              aria-hidden="true"
              className="mt-1 h-[2px] w-20 rounded-full bg-gradient-to-r from-[#7b5cff] via-[#c84bff] to-[#54cc96] opacity-85"
            />
          </div>
        )}
      </div>
    </div>
  );
};
