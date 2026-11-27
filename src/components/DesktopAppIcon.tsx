import React, { useMemo } from 'react';

export type DesktopAppIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface DesktopAppIconProps {
  id: string;
  size?: DesktopAppIconSize;
  className?: string;
  now?: Date;
}

const SIZE_CLASSES: Record<DesktopAppIconSize, string> = {
  xs: 'w-4 h-4 rounded-[5px]',
  sm: 'w-6 h-6 rounded-[7px]',
  md: 'w-9 h-9 rounded-[11px]',
  lg: 'w-11 h-11 rounded-[13px]',
  xl: 'w-[58px] h-[58px] rounded-[17px]',
};

const WEEKDAYS_IT = ['DOM', 'LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB'];

/**
 * Icone stile macOS Sequoia / iOS 18 con grafica vettoriale multistrato,
 * riflessi vitrei, ombre morbide di profondità e dettagli live (Calendario e Orologio).
 */
export const DesktopAppIcon: React.FC<DesktopAppIconProps> = ({
  id,
  size = 'xl',
  className = '',
  now,
}) => {
  const current = now ?? new Date();
  const dayNum = current.getDate();
  const weekdayLabel = WEEKDAYS_IT[current.getDay()] ?? 'OGGI';
  const hours = current.getHours() % 12;
  const minutes = current.getMinutes();
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6;

  // Unique SVG gradient prefix per icon id + size to avoid DOM ID collisions
  const uid = useMemo(() => `mai-${id}-${size}`, [id, size]);

  const renderArtwork = () => {
    switch (id) {
      /* ---------------- CARICOSTUDIO (Isometric 3D Sapphire Glass Cube) ---------------- */
      case 'caricostudio':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="48%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>
              <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.98" />
                <stop offset="100%" stopColor="#bae6fd" stopOpacity="0.92" />
              </linearGradient>
              <linearGradient id={`${uid}-left`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id={`${uid}-right`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="14" cy="12" r="24" fill="#7dd3fc" fillOpacity="0.22" />
            <ellipse cx="32" cy="51" rx="16" ry="4" fill="#0f172a" fillOpacity="0.35" />
            {/* Isometric Cube */}
            <polygon points="32,14 50,24 32,34 14,24" fill={`url(#${uid}-top)`} />
            <polygon points="14,24 32,34 32,50 14,40" fill={`url(#${uid}-left)`} />
            <polygon points="50,24 32,34 32,50 50,40" fill={`url(#${uid}-right)`} />
            {/* Precision edges */}
            <polyline
              points="14,24 32,34 50,24"
              fill="none"
              stroke="#ffffff"
              strokeOpacity="0.85"
              strokeWidth="1.2"
            />
            <line x1="32" y1="34" x2="32" y2="50" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.2" />
          </svg>
        );

      /* ---------------- COMMESSE (macOS Sculpted 3D Folder) ---------------- */
      case 'commesse':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a5f" />
                <stop offset="100%" stopColor="#0b1526" />
              </linearGradient>
              <linearGradient id={`${uid}-back`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" />
                <stop offset="45%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="52" cy="12" r="20" fill="#38bdf8" fillOpacity="0.16" />
            {/* Folder back tab */}
            <path
              d="M11 20 C11 17 13 15 16 15 L26 15 C28 15 29.5 16.2 30.8 18 L32 19.5 L48 19.5 C51 19.5 53 21.5 53 24.5 L53 45 C53 48 51 50 48 50 L16 50 C13 50 11 48 11 45 Z"
              fill={`url(#${uid}-back)`}
            />
            {/* Crisp white paper sheet peeking */}
            <rect x="16" y="21" width="32" height="10" rx="2.5" fill="#f8fafc" fillOpacity="0.92" />
            {/* Folder front flap */}
            <rect
              x="11"
              y="25"
              width="42"
              height="25"
              rx="5"
              fill={`url(#${uid}-front)`}
            />
            <rect x="11" y="25" width="42" height="2" rx="1" fill="#ffffff" fillOpacity="0.45" />
            {/* Embossed folder lines */}
            <rect x="20" y="34" width="24" height="2.4" rx="1.2" fill="#0369a1" fillOpacity="0.4" />
            <rect x="24" y="39.5" width="16" height="2.2" rx="1.1" fill="#0369a1" fillOpacity="0.32" />
          </svg>
        );

      /* ---------------- FILE MANAGER (Glass Cloud Drive Folder) ---------------- */
      case 'file_manager':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="55%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0c4a6e" />
              </linearGradient>
              <linearGradient id={`${uid}-card`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e0f2fe" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            {/* Stacked translucent sheets */}
            <rect x="15" y="14" width="34" height="28" rx="6" fill="#ffffff" fillOpacity="0.3" />
            <rect x="13" y="19" width="38" height="30" rx="7" fill={`url(#${uid}-card)`} />
            <rect x="19" y="27" width="18" height="3" rx="1.5" fill="#0284c7" />
            <rect x="19" y="33" width="26" height="2.6" rx="1.3" fill="#94a3b8" fillOpacity="0.65" />
            <rect x="19" y="38.5" width="20" height="2.6" rx="1.3" fill="#94a3b8" fillOpacity="0.45" />
            <circle cx="43" cy="28.5" r="3" fill="#38bdf8" />
          </svg>
        );

      /* ---------------- MAGAZZINO (3D Warm Amber Parcel Box) ---------------- */
      case 'warehouse_catalog':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id={`${uid}-box`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fffbeb" />
                <stop offset="100%" stopColor="#fde68a" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="16" cy="14" r="22" fill="#fef3c7" fillOpacity="0.28" />
            <ellipse cx="32" cy="52" rx="17" ry="3.8" fill="#78350f" fillOpacity="0.32" />
            {/* Box top */}
            <polygon points="32,13 50,22 32,31 14,22" fill={`url(#${uid}-box)`} />
            {/* Box left */}
            <polygon points="14,22 32,31 32,49 14,40" fill="#fed7aa" />
            {/* Box right */}
            <polygon points="50,22 32,31 32,49 50,40" fill="#f59e0b" />
            <polygon points="50,22 32,31 32,49 50,40" fill="#ffffff" fillOpacity="0.22" />
            {/* Packing tape */}
            <polygon points="27,15.5 37,20.5 32,23 22,18" fill="#d97706" fillOpacity="0.55" />
            <polygon points="37,20.5 42,23 42,30 37,27.5" fill="#ffffff" fillOpacity="0.7" />
            {/* Mini barcode sticker */}
            <polygon points="18,32 27,36.5 27,42 18,37.5" fill="#ffffff" fillOpacity="0.92" />
          </svg>
        );

      /* ---------------- CARICO / SCARICO (Jade Glass Bidirectional Scanner) ---------------- */
      case 'stock_movements':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="50" cy="14" r="20" fill="#6ee7b7" fillOpacity="0.22" />
            {/* Scanner corners */}
            <path d="M16 23 V17 H22 M42 17 H48 V23 M48 41 V47 H42 M22 47 H16 V41" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Laser line */}
            <rect x="14" y="30.5" width="36" height="3" rx="1.5" fill="#a7f3d0" />
            {/* Barcode bars */}
            <rect x="22" y="23" width="2.8" height="18" rx="1.2" fill="#ffffff" fillOpacity="0.9" />
            <rect x="27.5" y="23" width="4.5" height="18" rx="1.2" fill="#ffffff" fillOpacity="0.9" />
            <rect x="34.5" y="23" width="2.5" height="18" rx="1.2" fill="#ffffff" fillOpacity="0.9" />
            <rect x="39.5" y="23" width="3" height="18" rx="1.2" fill="#ffffff" fillOpacity="0.9" />
          </svg>
        );

      /* ---------------- ETICHETTE QR (Obsidian Titanium QR Matrix) ---------------- */
      case 'qr_labels':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="52%" stopColor="#0f766e" />
                <stop offset="100%" stopColor="#042f2e" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="12" y="12" width="40" height="40" rx="10" fill="#ffffff" fillOpacity="0.96" />
            {/* QR Finder patterns */}
            <rect x="17" y="17" width="11" height="11" rx="2.5" fill="none" stroke="#0f172a" strokeWidth="3" />
            <rect x="20.5" y="20.5" width="4" height="4" rx="0.8" fill="#0f766e" />
            <rect x="36" y="17" width="11" height="11" rx="2.5" fill="none" stroke="#0f172a" strokeWidth="3" />
            <rect x="39.5" y="20.5" width="4" height="4" rx="0.8" fill="#0f766e" />
            <rect x="17" y="36" width="11" height="11" rx="2.5" fill="none" stroke="#0f172a" strokeWidth="3" />
            <rect x="20.5" y="39.5" width="4" height="4" rx="0.8" fill="#0f766e" />
            {/* Data dots */}
            <rect x="35" y="35" width="4.5" height="4.5" rx="1" fill="#0f172a" />
            <rect x="42" y="35" width="4.5" height="4.5" rx="1" fill="#0f766e" />
            <rect x="35" y="42" width="4.5" height="4.5" rx="1" fill="#0f766e" />
            <rect x="42" y="42" width="4.5" height="4.5" rx="1" fill="#0f172a" />
          </svg>
        );

      /* ---------------- FOTO COMMESSA (macOS Photo Frame + Sun & Peaks) ---------------- */
      case 'commessa_photos':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="55%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
              <linearGradient id={`${uid}-m1`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e1b4b" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill="#f8fafc" />
            <rect x="7" y="7" width="50" height="44" rx="9" fill={`url(#${uid}-sky)`} />
            <circle cx="44" cy="20" r="6" fill="#fef08a" />
            <circle cx="44" cy="20" r="10" fill="#fef08a" fillOpacity="0.28" />
            <path d="M7 42 L24 26 L38 40 L45 33 L57 44 L57 51 L7 51 Z" fill={`url(#${uid}-m1)`} fillOpacity="0.88" />
            <path d="M7 46 L29 31 L48 51 L7 51 Z" fill="#0f172a" fillOpacity="0.55" />
            {/* Polaroid bottom accent */}
            <rect x="22" y="55" width="20" height="2.6" rx="1.3" fill="#cbd5e1" />
          </svg>
        );

      /* ---------------- CALENDARIO (Authentic LIVE macOS Calendar Icon!) ---------------- */
      case 'calendar':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              <linearGradient id={`${uid}-paper`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#f1f5f9" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-paper)`} />
            <rect width="64" height="21" fill={`url(#${uid}-top)`} />
            <line x1="0" y1="21" x2="64" y2="21" stroke="#be123c" strokeWidth="1" strokeOpacity="0.4" />
            <text
              x="32"
              y="14.5"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="10.5"
              fontWeight="700"
              letterSpacing="1.2"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {weekdayLabel}
            </text>
            <text
              x="32"
              y="50.5"
              textAnchor="middle"
              fill="#0f172a"
              fontSize="29"
              fontWeight="700"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {dayNum}
            </text>
          </svg>
        );

      /* ---------------- METEO (Authentic macOS Weather Sun + Frosted Cloud) ---------------- */
      case 'weather':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="55%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#7dd3fc" />
              </linearGradient>
              <radialGradient id={`${uid}-sun`} cx="40%" cy="35%" r="60%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="65%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#f97316" />
              </radialGradient>
              <linearGradient id={`${uid}-cloud`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-sky)`} />
            {/* Sun halo + orb */}
            <circle cx="40" cy="24" r="16" fill="#fde047" fillOpacity="0.28" />
            <circle cx="40" cy="24" r="11" fill={`url(#${uid}-sun)`} />
            {/* Sculpted Cloud */}
            <path
              d="M19 47 H43 C47.5 47 51 43.6 51 39.2 C51 35.2 48.1 31.9 44.2 31.4 C42.8 25.9 37.8 22 32 22 C25.8 22 20.6 26.6 19.7 32.6 C15.8 33.4 13 36.7 13 40.6 C13 44.2 15.7 47 19 47 Z"
              fill={`url(#${uid}-cloud)`}
            />
          </svg>
        );

      /* ---------------- OROLOGIO (Authentic LIVE macOS Analog Clock!) ---------------- */
      case 'clock':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <radialGradient id={`${uid}-face`} cx="50%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </radialGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="32" cy="32" r="24" fill={`url(#${uid}-face)`} />
            {/* 12 Hour ticks */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
              <line
                key={deg}
                x1="32"
                y1="11.5"
                x2="32"
                y2={deg % 90 === 0 ? '15.5' : '13.8'}
                stroke={deg % 90 === 0 ? '#0f172a' : '#64748b'}
                strokeWidth={deg % 90 === 0 ? '2' : '1.3'}
                strokeLinecap="round"
                transform={`rotate(${deg} 32 32)`}
              />
            ))}
            {/* Hour hand */}
            <line
              x1="32"
              y1="32"
              x2="32"
              y2="20"
              stroke="#0f172a"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${hourAngle} 32 32)`}
            />
            {/* Minute hand */}
            <line
              x1="32"
              y1="32"
              x2="32"
              y2="14.5"
              stroke="#0f172a"
              strokeWidth="2.2"
              strokeLinecap="round"
              transform={`rotate(${minuteAngle} 32 32)`}
            />
            {/* Second accent hand */}
            <line
              x1="32"
              y1="36"
              x2="32"
              y2="14"
              stroke="#f97316"
              strokeWidth="1.2"
              strokeLinecap="round"
              transform={`rotate(${(minutes * 37) % 360} 32 32)`}
            />
            <circle cx="32" cy="32" r="2.6" fill="#0f172a" />
            <circle cx="32" cy="32" r="1.2" fill="#f97316" />
          </svg>
        );

      /* ---------------- TIMINI PRINT (Thermal Pocket Printer + Label Strip) ---------------- */
      case 'timini_print':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="55%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="50" cy="14" r="18" fill="#38bdf8" fillOpacity="0.2" />
            {/* White thermal paper coming out top */}
            <path d="M21 12 H43 V31 H21 Z" fill="#ffffff" />
            <rect x="25" y="16" width="14" height="2.2" rx="1" fill="#0f172a" />
            <rect x="25" y="20.5" width="2" height="6" fill="#0f172a" />
            <rect x="28.5" y="20.5" width="3" height="6" fill="#0f172a" />
            <rect x="33" y="20.5" width="1.6" height="6" fill="#0f172a" />
            <rect x="36" y="20.5" width="3" height="6" fill="#0f172a" />
            {/* Pocket printer body */}
            <rect x="13" y="29" width="38" height="23" rx="7" fill={`url(#${uid}-body)`} />
            <rect x="18" y="32" width="28" height="3" rx="1.5" fill="#1e293b" />
            {/* Blue Bluetooth LED */}
            <circle cx="43" cy="43" r="3" fill="#0ea5e9" />
            <circle cx="43" cy="43" r="5.5" fill="#38bdf8" fillOpacity="0.3" />
            <rect x="19" y="41.5" width="14" height="3" rx="1.5" fill="#64748b" fillOpacity="0.45" />
          </svg>
        );

      /* ---------------- SCANNER CARICO BANCALE & CAMION ---------------- */
      case 'pallet_truck_scanner':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="55%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <linearGradient id={`${uid}-amber`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="55%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="50" cy="14" r="20" fill="#f59e0b" fillOpacity="0.22" />
            {/* Corner scanner brackets */}
            <path
              d="M15 22 V15 H22 M42 15 H49 V22 M15 42 V49 H22 M42 49 H49 V42"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Barcode bars */}
            <rect x="20" y="21" width="3" height="16" rx="1" fill="#ffffff" />
            <rect x="25" y="21" width="1.8" height="16" rx="0.8" fill="#ffffff" />
            <rect x="29" y="21" width="4" height="16" rx="1" fill="#ffffff" />
            <rect x="35" y="21" width="2" height="16" rx="0.8" fill="#ffffff" />
            <rect x="39" y="21" width="3.5" height="16" rx="1" fill="#ffffff" />
            {/* Laser scan beam */}
            <rect x="13" y="28.5" width="38" height="2.4" rx="1.2" fill="#f97316" />
            <rect x="15" y="29.1" width="34" height="1.2" rx="0.6" fill="#fef08a" />
            {/* Wooden pallet base underneath */}
            <rect x="18" y="42" width="28" height="3.2" rx="1.2" fill={`url(#${uid}-amber)`} />
            <rect x="20" y="45.2" width="4.5" height="3.2" rx="0.8" fill="#b45309" />
            <rect x="29.75" y="45.2" width="4.5" height="3.2" rx="0.8" fill="#b45309" />
            <rect x="39.5" y="45.2" width="4.5" height="3.2" rx="0.8" fill="#b45309" />
          </svg>
        );

      /* ---------------- UNIONE FILE EXCEL CHECK-LIST ---------------- */
      case 'excel_checklist_merger':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="55%" stopColor="#047857" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
              <linearGradient id={`${uid}-sheet`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="14" cy="12" r="20" fill="#6ee7b7" fillOpacity="0.22" />
            {/* Back left Excel sheet */}
            <rect x="11" y="14" width="24" height="30" rx="4.5" fill="#ecfdf5" fillOpacity="0.82" />
            <rect x="15" y="20" width="16" height="2.4" rx="1" fill="#059669" fillOpacity="0.45" />
            <rect x="15" y="25.5" width="12" height="2.4" rx="1" fill="#059669" fillOpacity="0.35" />
            <rect x="15" y="31" width="14" height="2.4" rx="1" fill="#059669" fillOpacity="0.35" />
            {/* Front unified master checklist sheet */}
            <rect x="24" y="18" width="29" height="34" rx="5" fill={`url(#${uid}-sheet)`} />
            <rect x="24" y="18" width="29" height="9" rx="5" fill="#065f46" />
            <rect x="24" y="23" width="29" height="4" fill="#065f46" />
            {/* Grid rows inside unified sheet */}
            <rect x="29" y="31.5" width="19" height="2.5" rx="1.2" fill="#0f172a" fillOpacity="0.72" />
            <rect x="29" y="37" width="14" height="2.5" rx="1.2" fill="#0f172a" fillOpacity="0.45" />
            <rect x="29" y="42.5" width="17" height="2.5" rx="1.2" fill="#0f172a" fillOpacity="0.45" />
            {/* Unified check badge */}
            <circle cx="48" cy="46" r="8.5" fill="#0f172a" />
            <circle cx="48" cy="46" r="7" fill="#10b981" />
            <path
              d="M44.6 46.1 L47.1 48.6 L51.8 43.6"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      /* ---------------- AUTOPILOTA PREVENTIVI & COMMESSE AI ---------------- */
      case 'ai_order_autopilot':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="55%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="50" cy="14" r="18" fill="#3b82f6" fillOpacity="0.22" />
            {/* Chat bubble / client request card */}
            <rect x="11" y="13" width="26" height="20" rx="5" fill="#e2e8f0" />
            <rect x="15.5" y="18.5" width="15" height="2.4" rx="1.2" fill="#334155" />
            <rect x="15.5" y="23.5" width="10" height="2.4" rx="1.2" fill="#64748b" />
            {/* Resulting Quote + Order sheet */}
            <rect x="25" y="25" width="28" height="27" rx="5" fill="#ffffff" />
            <rect x="25" y="25" width="28" height="7" rx="5" fill="#2563eb" />
            <rect x="25" y="29" width="28" height="3" fill="#2563eb" />
            <rect x="30" y="36.5" width="17" height="2.5" rx="1.2" fill="#0f172a" fillOpacity="0.8" />
            <rect x="30" y="42" width="12" height="2.5" rx="1.2" fill="#10b981" />
            {/* Golden AI Sparkle */}
            <path
              d="M47 10 L49.1 15.9 L55 18 L49.1 20.1 L47 26 L44.9 20.1 L39 18 L44.9 15.9 Z"
              fill={`url(#${uid}-gold)`}
            />
          </svg>
        );

      /* ---------------- DDT & BOLLE (Crisp Document + Verified Seal) ---------------- */
      case 'ddt_documents':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="55%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#172554" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            {/* Folded document sheet */}
            <path d="M16 12 H39 L48 21 V52 H16 Z" fill="#ffffff" />
            <path d="M39 12 V21 H48 Z" fill="#bfdbfe" />
            <rect x="21" y="21" width="13" height="3.2" rx="1.5" fill="#1d4ed8" />
            <rect x="21" y="28" width="21" height="2.4" rx="1.2" fill="#94a3b8" />
            <rect x="21" y="33.5" width="17" height="2.4" rx="1.2" fill="#cbd5e1" />
            <rect x="21" y="39" width="13" height="2.4" rx="1.2" fill="#cbd5e1" />
            {/* Green seal */}
            <circle cx="44" cy="44" r="8" fill="#10b981" />
            <polyline points="40.5,44 43,46.6 47.8,41.6" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      /* ---------------- CLIENTI & FORNITORI (Royal Indigo Directory Card) ---------------- */
      case 'crm_directory':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="55%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#1e1b4b" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="13" y="13" width="38" height="38" rx="9" fill="#ffffff" fillOpacity="0.16" />
            <circle cx="32" cy="25.5" r="7.5" fill="#ffffff" />
            <path d="M19 46 C19 38.8 24.8 35 32 35 C39.2 35 45 38.8 45 46" fill="#ffffff" fillOpacity="0.94" />
            {/* Side address index tabs */}
            <rect x="51" y="18" width="3.5" height="7" rx="1.5" fill="#38bdf8" />
            <rect x="51" y="28" width="3.5" height="7" rx="1.5" fill="#34d399" />
            <rect x="51" y="38" width="3.5" height="7" rx="1.5" fill="#fbbf24" />
          </svg>
        );

      /* ---------------- ORDINI FORNITORI (Emerald Cart + Gold Tag) ---------------- */
      case 'purchase_orders':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="55%" stopColor="#0f766e" />
                <stop offset="100%" stopColor="#064e3b" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="48" cy="18" r="14" fill="#fde047" fillOpacity="0.2" />
            <path
              d="M14 19 H20 L24 39 H45 L49 25 H22"
              fill="none"
              stroke="#ffffff"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="26.5" cy="46.5" r="3.4" fill="#ffffff" />
            <circle cx="42.5" cy="46.5" r="3.4" fill="#ffffff" />
            <circle cx="45" cy="18" r="6" fill="#fbbf24" />
            <line x1="45" y1="15" x2="45" y2="21" stroke="#064e3b" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="42" y1="18" x2="48" y2="18" stroke="#064e3b" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        );

      /* ---------------- SCAMBIO TEAM (Luminous Sky Paper Plane) ---------------- */
      case 'team_share':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="55%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="16" cy="48" r="22" fill="#7dd3fc" fillOpacity="0.22" />
            {/* Sculpted Paper Plane */}
            <polygon points="50,15 13,30 27,36 44,21" fill="#ffffff" />
            <polygon points="50,15 27,36 33,49 41,39" fill="#bae6fd" />
            <polygon points="27,36 33,49 35,38" fill="#7dd3fc" />
          </svg>
        );

      /* ---------------- DIREZIONE TEAM (Luxury Brushed Gold Crown) ---------------- */
      case 'employer_hub':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#451a03" />
                <stop offset="50%" stopColor="#1c1917" />
                <stop offset="100%" stopColor="#09090b" />
              </linearGradient>
              <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="32" cy="24" r="22" fill="#f59e0b" fillOpacity="0.18" />
            <path
              d="M13 44 L17 23 L26 32 L32 18 L38 32 L47 23 L51 44 Z"
              fill={`url(#${uid}-gold)`}
              stroke="#fef08a"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <rect x="14" y="46" width="36" height="4" rx="2" fill={`url(#${uid}-gold)`} />
            <circle cx="32" cy="18" r="2.4" fill="#fef9c3" />
          </svg>
        );

      /* ---------------- MONITOR SERVER (Obsidian + Glowing Emerald Telemetry) ---------------- */
      case 'server_monitor':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <linearGradient id={`${uid}-glow`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            {/* Subtle grid lines */}
            <line x1="8" y1="22" x2="56" y2="22" stroke="#ffffff" strokeOpacity="0.07" />
            <line x1="8" y1="36" x2="56" y2="36" stroke="#ffffff" strokeOpacity="0.07" />
            <line x1="8" y1="50" x2="56" y2="50" stroke="#ffffff" strokeOpacity="0.07" />
            {/* Pulse fill */}
            <path d="M8 38 H18 L24 22 L31 45 L38 17 L44 38 H56 V56 H8 Z" fill={`url(#${uid}-glow)`} />
            {/* Pulse line */}
            <polyline
              points="8,38 18,38 24,22 31,45 38,17 44,38 56,38"
              fill="none"
              stroke="#34d399"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );

      /* ---------------- SISTEMA & ISO (Brushed Titanium Server Blades) ---------------- */
      case 'server_control':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="55%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id={`${uid}-blade`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="12" y="14" width="40" height="15" rx="4.5" fill={`url(#${uid}-blade)`} />
            <circle cx="19" cy="21.5" r="2.6" fill="#10b981" />
            <rect x="26" y="20" width="20" height="3" rx="1.5" fill="#64748b" />
            <rect x="12" y="34" width="40" height="15" rx="4.5" fill={`url(#${uid}-blade)`} />
            <circle cx="19" cy="41.5" r="2.6" fill="#38bdf8" />
            <rect x="26" y="40" width="20" height="3" rx="1.5" fill="#64748b" />
          </svg>
        );

      /* ---------------- AGGIORNAMENTI (Luminous Sapphire Cloud Download) ---------------- */
      case 'software_updates':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <circle cx="32" cy="32" r="20" fill="#ffffff" fillOpacity="0.16" />
            <circle cx="32" cy="32" r="14" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2.5" strokeDasharray="6 4" />
            <path d="M32 20 V38 M24.5 32.5 L32 40 L39.5 32.5" fill="none" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="23" y1="45" x2="41" y2="45" stroke="#bae6fd" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );

      /* ---------------- CHECK-LIST MERCI (Coral-Rose Clipboard + Green Checks) ---------------- */
      case 'checklist':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="55%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="14" y="13" width="36" height="40" rx="7" fill="#ffffff" fillOpacity="0.96" />
            <rect x="24" y="10" width="16" height="6" rx="3" fill="#fda4af" />
            <polyline points="20,27 23,30 28,24" fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="32" y="25.8" width="13" height="2.8" rx="1.4" fill="#334155" />
            <polyline points="20,38 23,41 28,35" fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="32" y="36.8" width="11" height="2.8" rx="1.4" fill="#94a3b8" />
          </svg>
        );

      /* ---------------- ALBERO BANCALI (Emerald Structured Nodes) ---------------- */
      case 'tree':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="55%" stopColor="#0d9488" />
                <stop offset="100%" stopColor="#115e59" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <path d="M22 22 V42 H40 M22 30 H40" fill="none" stroke="#ccfbf1" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="15" y="14" width="14" height="10" rx="3" fill="#ffffff" />
            <rect x="36" y="25" width="14" height="10" rx="3" fill="#ffffff" fillOpacity="0.92" />
            <rect x="36" y="38" width="14" height="10" rx="3" fill="#99f6e4" />
          </svg>
        );

      /* ---------------- PESI BANCALI (Precision Scale Dial) ---------------- */
      case 'pallet_weights':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#60a5fa" />
                <stop offset="55%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="13" y="16" width="38" height="34" rx="9" fill="#ffffff" fillOpacity="0.96" />
            <path d="M21 37 A11 11 0 0 1 43 37" fill="none" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <path d="M21 37 A11 11 0 0 1 39 29" fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
            <line x1="32" y1="38" x2="38.5" y2="29" stroke="#ef4444" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="32" cy="38" r="2.8" fill="#0f172a" />
          </svg>
        );

      /* ---------------- VERNICIATURA & RAL (Color Swatch Fan) ---------------- */
      case 'painting_tags':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="55%" stopColor="#ea580c" />
                <stop offset="100%" stopColor="#7c2d12" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            {/* Swatch fan cards */}
            <rect x="19" y="13" width="17" height="36" rx="4.5" fill="#38bdf8" transform="rotate(-18 28 45)" />
            <rect x="23" y="13" width="17" height="36" rx="4.5" fill="#fde047" transform="rotate(-4 30 45)" />
            <rect x="27" y="14" width="17" height="36" rx="4.5" fill="#ffffff" transform="rotate(11 32 45)" />
            <circle cx="30" cy="44" r="3" fill="#ea580c" />
          </svg>
        );

      /* ---------------- CAD 3D (Blueprint Wireframe & Layered Planes) ---------------- */
      case 'view3d':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="55%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <polygon points="32,14 50,23 32,32 14,23" fill="#38bdf8" fillOpacity="0.85" />
            <polygon points="32,24 50,33 32,42 14,33" fill="#818cf8" fillOpacity="0.65" />
            <polygon points="32,34 50,43 32,52 14,43" fill="#c084fc" fillOpacity="0.55" />
            <polyline points="14,23 32,32 50,23" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.2" />
          </svg>
        );

      /* ---------------- CENTRO STAMPE (Studio Laser Printer) ---------------- */
      case 'print_center':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="55%" stopColor="#334155" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="20" y="13" width="24" height="12" rx="2.5" fill="#e2e8f0" />
            <rect x="12" y="23" width="40" height="20" rx="6" fill="#ffffff" />
            <circle cx="45" cy="30" r="2.2" fill="#10b981" />
            <rect x="20" y="36" width="24" height="15" rx="2" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <rect x="24" y="40" width="16" height="2.2" rx="1" fill="#64748b" />
            <rect x="24" y="45" width="11" height="2.2" rx="1" fill="#94a3b8" />
          </svg>
        );

      /* ---------------- CARICO CAMION (Emerald-Teal Transport) ---------------- */
      case 'truck':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="55%" stopColor="#059669" />
                <stop offset="100%" stopColor="#065f46" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="11" y="20" width="27" height="21" rx="4" fill="#ffffff" />
            <path d="M38 26 H47 L52 33 V41 H38 Z" fill="#d1fae5" />
            <rect x="41" y="28.5" width="7" height="5" rx="1.2" fill="#065f46" fillOpacity="0.65" />
            <circle cx="20" cy="43" r="4.5" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
            <circle cx="44" cy="43" r="4.5" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
          </svg>
        );

      /* ---------------- FIRME & BOLLA (Rose Signature Nib) ---------------- */
      case 'signatures':
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="55%" stopColor="#be123c" />
                <stop offset="100%" stopColor="#4c0519" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <path d="M16 44 C22 34 28 46 34 38 C39 31 44 43 49 38" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M36 16 L46 26 L28 44 L19 45 L20 36 Z" fill="#ffffff" fillOpacity="0.95" />
          </svg>
        );

      /* ---------------- DEFAULT FALLBACK ---------------- */
      default:
        return (
          <svg viewBox="0 0 64 64" className="w-full h-full block">
            <defs>
              <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#1e3a8a" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" fill={`url(#${uid}-bg)`} />
            <rect x="18" y="18" width="28" height="28" rx="7" fill="#ffffff" fillOpacity="0.9" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`relative overflow-hidden shrink-0 select-none ${SIZE_CLASSES[size]} ${className}`}
      style={{
        boxShadow:
          size === 'xl'
            ? '0 14px 28px -6px rgba(0,0,0,0.58), 0 3px 8px rgba(0,0,0,0.34), inset 0 1px 1px rgba(255,255,255,0.42)'
            : size === 'lg' || size === 'md'
            ? '0 8px 18px -5px rgba(0,0,0,0.35), inset 0 1px 0.5px rgba(255,255,255,0.35)'
            : '0 2px 5px rgba(0,0,0,0.3)',
      }}
    >
      {renderArtwork()}
      {/* Specular macOS top glass highlight & crisp inner rim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/25"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.06) 38%, rgba(0,0,0,0) 56%, rgba(0,0,0,0.16) 100%)',
        }}
      />
    </div>
  );
};
