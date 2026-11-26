import React from 'react';
import auroraLuxeWallpaper from '../assets/images/metatron_aurora_luxe_wallpaper_1795676377940.jpg';
import alpineTwilightWallpaper from '../assets/images/metatron_alpine_twilight_wallpaper_1795676378047.jpg';
import obsidianGlassWallpaper from '../assets/images/metatron_studio_wallpaper_1795674482399.jpg';

export type WallpaperTheme =
  | 'aurora_luxe'
  | 'alpine_twilight'
  | 'obsidian_glass'
  | 'aurora_silk'
  | 'daylight_clean'
  | 'midnight_violet'
  | 'emerald_mist';

export const WALLPAPER_META: Record<
  WallpaperTheme,
  { name: string; isLight?: boolean }
> = {
  aurora_luxe: { name: 'Aurora Cristallo (Predefinito)' },
  alpine_twilight: { name: 'Dolomiti al Tramonto' },
  obsidian_glass: { name: 'Studio Ossidiana' },
  aurora_silk: { name: 'Aurora Silk Classico' },
  daylight_clean: { name: 'Chiaro Minimal', isLight: true },
  midnight_violet: { name: 'Notte Indaco' },
  emerald_mist: { name: 'Petrolio Smeraldo' },
};

interface AuroraSilkWallpaperProps {
  theme?: WallpaperTheme;
}

export const AuroraSilkWallpaper: React.FC<AuroraSilkWallpaperProps> = ({
  theme = 'aurora_luxe',
}) => {
  if (theme === 'aurora_luxe') {
    return (
      <div
        aria-hidden="true"
        className="no-print absolute inset-0 overflow-hidden pointer-events-none bg-[#060913]"
        style={{
          backgroundImage:
            'radial-gradient(85% 75% at 65% 45%, #162244 0%, #090e1d 55%, #05070f 100%)',
        }}
      >
        <img
          src={auroraLuxeWallpaper}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01]"
        />
        {/* Leggera sfumatura a sinistra per massima leggibilità delle icone */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(5, 8, 18, 0.44) 0%, rgba(5, 8, 18, 0.14) 44%, rgba(5, 8, 18, 0.12) 100%)',
          }}
        />
      </div>
    );
  }

  if (theme === 'alpine_twilight') {
    return (
      <div
        aria-hidden="true"
        className="no-print absolute inset-0 overflow-hidden pointer-events-none bg-[#0a1322]"
      >
        <img
          src={alpineTwilightWallpaper}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center scale-[1.01]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(8, 14, 28, 0.36) 0%, rgba(8, 14, 28, 0.08) 46%, rgba(8, 14, 28, 0.12) 100%)',
          }}
        />
      </div>
    );
  }

  if (theme === 'obsidian_glass') {
    return (
      <div
        aria-hidden="true"
        className="no-print absolute inset-0 overflow-hidden pointer-events-none bg-[#080b12]"
        style={{
          backgroundImage:
            'radial-gradient(85% 75% at 50% 20%, #131c2e 0%, #090d16 55%, #06080e 100%)',
        }}
      >
        <img
          src={obsidianGlassWallpaper}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-90 scale-[1.01]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(7, 10, 18, 0.46) 0%, rgba(7, 10, 18, 0.28) 48%, rgba(6, 8, 15, 0.62) 100%)',
          }}
        />
      </div>
    );
  }
  if (theme === 'daylight_clean') {
    return (
      <div
        aria-hidden="true"
        className="no-print absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background:
            'radial-gradient(120% 95% at 15% 15%, #e2e8f0 0%, #cbd5e1 48%, #dbeafe 100%)',
        }}
      >
        <div
          className="absolute -top-32 right-0 w-[65vw] h-[65vw] rounded-full opacity-55 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(14,165,233,0.12) 55%, transparent 75%)',
          }}
        />
        <div
          className="absolute -bottom-40 -left-20 w-[60vw] h-[60vw] rounded-full opacity-50 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, rgba(20,184,166,0.22) 0%, rgba(59,130,246,0.1) 55%, transparent 75%)',
          }}
        />
      </div>
    );
  }

  if (theme === 'midnight_violet') {
    return (
      <div
        aria-hidden="true"
        className="no-print absolute inset-0 overflow-hidden pointer-events-none bg-[#070914]"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 80% at 12% 18%, rgba(44, 48, 122, 0.58) 0%, rgba(15, 19, 44, 0.45) 45%, rgba(7, 9, 20, 1) 100%)',
          }}
        />
        <svg
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full opacity-90"
        >
          <defs>
            <filter id="mv-blur-lg" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="52" />
            </filter>
            <filter id="mv-blur-md" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="20" />
            </filter>
            <linearGradient id="mv-wave-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.28" />
            </linearGradient>
            <linearGradient id="mv-wave-2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.36" />
              <stop offset="55%" stopColor="#6366f1" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <path
            d="M-120,260 C260,120 680,520 1120,380 C1480,265 1680,40 2040,120 L2040,780 C1620,660 1280,920 820,760 C420,620 140,840 -120,700 Z"
            fill="url(#mv-wave-1)"
            filter="url(#mv-blur-lg)"
          />
          <path
            d="M200,1120 C560,720 1020,860 1440,500 C1680,295 1840,180 2020,160 L2020,640 C1720,740 1320,980 880,1040 Z"
            fill="url(#mv-wave-2)"
            filter="url(#mv-blur-lg)"
          />
          <path
            d="M-80,340 C380,180 780,620 1240,420 C1560,280 1760,120 1980,80"
            fill="none"
            stroke="rgba(165,180,252,0.34)"
            strokeWidth="12"
            filter="url(#mv-blur-md)"
          />
        </svg>
      </div>
    );
  }

  if (theme === 'emerald_mist') {
    return (
      <div
        aria-hidden="true"
        className="no-print absolute inset-0 overflow-hidden pointer-events-none bg-[#061116]"
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(95% 85% at 15% 18%, rgba(19, 64, 82, 0.55) 0%, rgba(8, 28, 38, 0.5) 52%, rgba(5, 14, 20, 1) 100%)',
          }}
        />
        <svg
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full opacity-95"
        >
          <defs>
            <filter id="em-blur-lg" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="54" />
            </filter>
            <filter id="em-blur-sm" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
            <linearGradient id="em-wave-a" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0d9488" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.22" />
            </linearGradient>
            <linearGradient id="em-wave-b" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#0f766e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <path
            d="M-100,820 C340,620 680,760 1160,440 C1520,200 1760,90 2040,40 L2040,560 C1680,680 1320,960 760,1040 L-100,1080 Z"
            fill="url(#em-wave-a)"
            filter="url(#em-blur-lg)"
          />
          <path
            d="M-120,220 C360,80 820,480 1280,260 C1620,100 1820,-40 2020,20 L2020,420 C1640,520 1140,640 620,500 Z"
            fill="url(#em-wave-b)"
            filter="url(#em-blur-lg)"
          />
          <path
            d="M80,960 C540,760 920,660 1380,340 C1640,160 1820,60 1980,20"
            fill="none"
            stroke="rgba(110, 231, 183, 0.34)"
            strokeWidth="10"
            filter="url(#em-blur-sm)"
          />
        </svg>
      </div>
    );
  }

  // Default: "aurora_silk" — silky dark midnight navy with flowing plum, mauve-rose & sage-teal aurora ribbons
  return (
    <div
      aria-hidden="true"
      className="no-print absolute inset-0 overflow-hidden pointer-events-none bg-[#0a0c18]"
    >
      {/* Base ambient atmospheric glow */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(62% 70% at 14% 24%, rgba(36, 40, 96, 0.62) 0%, rgba(18, 20, 48, 0.35) 55%, transparent 100%)',
            'radial-gradient(58% 64% at 88% 82%, rgba(12, 46, 56, 0.72) 0%, rgba(10, 24, 34, 0.4) 55%, transparent 100%)',
            'radial-gradient(50% 48% at 52% 48%, rgba(62, 46, 86, 0.34) 0%, transparent 72%)',
          ].join(', '),
        }}
      />

      {/* Flowing Silk Aurora Ribbons */}
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <filter id="silk-blur-xl" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="56" />
          </filter>
          <filter id="silk-blur-md" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
          <filter id="silk-blur-sm" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="8" />
          </filter>

          {/* Mauve / Plum silk veil sweeping top-left to bottom-center */}
          <linearGradient id="silk-plum" x1="8%" y1="12%" x2="82%" y2="85%">
            <stop offset="0%" stopColor="#3c3a78" stopOpacity="0.18" />
            <stop offset="32%" stopColor="#8f4f7f" stopOpacity="0.34" />
            <stop offset="62%" stopColor="#a45c7d" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3a2a54" stopOpacity="0.06" />
          </linearGradient>

          {/* Sage-Emerald / Misty Teal silk sweep rising from bottom-center to upper-right */}
          <linearGradient id="silk-teal" x1="28%" y1="95%" x2="95%" y2="8%">
            <stop offset="0%" stopColor="#26545c" stopOpacity="0.14" />
            <stop offset="42%" stopColor="#4f8c82" stopOpacity="0.34" />
            <stop offset="72%" stopColor="#72ad98" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#295264" stopOpacity="0.1" />
          </linearGradient>

          {/* Deep violet-rose lower swell */}
          <linearGradient id="silk-lower" x1="12%" y1="92%" x2="72%" y2="38%">
            <stop offset="0%" stopColor="#583366" stopOpacity="0.26" />
            <stop offset="48%" stopColor="#864d72" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#2b385a" stopOpacity="0.04" />
          </linearGradient>

          {/* Luminous silk edge highlight strokes */}
          <linearGradient id="edge-rose" x1="15%" y1="20%" x2="88%" y2="70%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="28%" stopColor="#c47aa0" stopOpacity="0.45" />
            <stop offset="56%" stopColor="#d996ad" stopOpacity="0.38" />
            <stop offset="82%" stopColor="#6aa89e" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="edge-emerald" x1="35%" y1="100%" x2="96%" y2="5%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0" />
            <stop offset="30%" stopColor="#7ec4ae" stopOpacity="0.38" />
            <stop offset="65%" stopColor="#a3d9c5" stopOpacity="0.44" />
            <stop offset="92%" stopColor="#5ea39d" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="edge-violet" x1="18%" y1="96%" x2="75%" y2="42%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0" />
            <stop offset="38%" stopColor="#b06996" stopOpacity="0.34" />
            <stop offset="72%" stopColor="#94a3b8" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Broad soft silk folds */}
        <path
          d="M-120,210 C220,90 520,160 820,420 C1120,680 1420,420 1780,10 C1890,-100 1980,-40 2060,40 L2060,640 C1680,780 1320,940 940,860 C560,780 280,460 -120,560 Z"
          fill="url(#silk-plum)"
          filter="url(#silk-blur-xl)"
        />

        <path
          d="M520,1140 C860,820 1160,680 1460,420 C1680,230 1840,120 2060,55 L2060,720 C1760,860 1520,1020 1160,1140 Z"
          fill="url(#silk-teal)"
          filter="url(#silk-blur-xl)"
        />

        <path
          d="M140,1120 C260,820 420,560 660,610 C890,660 1040,940 1340,980 L1340,1140 Z"
          fill="url(#silk-lower)"
          filter="url(#silk-blur-xl)"
        />

        {/* Secondary translucent ribbon body (medium blur for realistic folded silk depth) */}
        <path
          d="M280,260 C520,170 670,410 920,535 C1190,670 1380,470 1650,220 C1780,100 1890,45 2020,25 L2020,265 C1760,360 1510,590 1240,685 C940,790 670,640 430,490 C310,415 220,335 280,260 Z"
          fill="url(#silk-teal)"
          opacity="0.62"
          filter="url(#silk-blur-md)"
        />

        <path
          d="M350,350 C520,240 690,450 930,605 C1160,750 1370,860 1640,920 L1520,1060 C1180,990 920,820 690,655 C470,495 270,470 350,350 Z"
          fill="url(#silk-plum)"
          opacity="0.58"
          filter="url(#silk-blur-md)"
        />

        {/* Luminous silk ridge crests — gives the unmistakable satin sheen from the screenshot */}
        <path
          d="M260,260 C490,195 660,415 920,548 C1190,686 1410,472 1670,224 C1790,108 1895,46 1980,18"
          fill="none"
          stroke="url(#edge-rose)"
          strokeWidth="10"
          strokeLinecap="round"
          filter="url(#silk-blur-sm)"
        />
        <path
          d="M840,1080 C1060,820 1290,565 1530,340 C1705,176 1845,92 1990,48"
          fill="none"
          stroke="url(#edge-emerald)"
          strokeWidth="11"
          strokeLinecap="round"
          filter="url(#silk-blur-sm)"
        />
        <path
          d="M660,300 C880,350 1120,355 1300,195 C1405,102 1480,22 1560,-20"
          fill="none"
          stroke="url(#edge-rose)"
          strokeWidth="7"
          strokeLinecap="round"
          opacity="0.7"
          filter="url(#silk-blur-sm)"
        />
        <path
          d="M340,1090 C410,820 495,585 655,610 C825,635 960,835 1220,910"
          fill="none"
          stroke="url(#edge-violet)"
          strokeWidth="8"
          strokeLinecap="round"
          filter="url(#silk-blur-sm)"
        />
      </svg>

      {/* Subtle vignette for high icon & text legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(125% 110% at 50% 45%, transparent 45%, rgba(4, 6, 14, 0.55) 100%)',
        }}
      />
    </div>
  );
};
