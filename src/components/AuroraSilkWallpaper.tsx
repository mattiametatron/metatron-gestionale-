import React from 'react';
import alpineTwilightWallpaper from '../assets/images/metatron_alpine_twilight_wallpaper_1795676378047.jpg';

export type WallpaperTheme = 'alpine_twilight';

export const WALLPAPER_META: Record<
  WallpaperTheme,
  { name: string; isLight?: boolean }
> = {
  alpine_twilight: { name: 'Dolomiti al Tramonto' },
};

interface AuroraSilkWallpaperProps {
  theme?: WallpaperTheme;
  className?: string;
}

/**
 * Sfondo fotografico unico "Dolomiti al Tramonto"
 * con velatura di contrasto calibrata per garantire massima leggibilità
 * su desktop, icone e schermata di accesso.
 */
export const AuroraSilkWallpaper: React.FC<AuroraSilkWallpaperProps> = ({
  className = '',
}) => {
  return (
    <div
      className={`fixed inset-0 overflow-hidden pointer-events-none select-none bg-[#070b14] ${className}`}
      aria-hidden="true"
    >
      <img
        src={alpineTwilightWallpaper}
        alt=""
        draggable={false}
        className="w-full h-full object-cover object-center scale-[1.01]"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(8, 12, 24, 0.28) 0%, rgba(10, 14, 26, 0.14) 44%, rgba(6, 10, 20, 0.56) 100%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 60% at 50% 0%, rgba(251, 191, 36, 0.08) 0%, transparent 65%)',
        }}
      />
    </div>
  );
};
