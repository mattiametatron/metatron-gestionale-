import React from 'react';

interface PalletGraphicProps {
  wrapped?: boolean;
  boxCount?: number;
  heightCm?: number;
  className?: string;
}

export const PalletGraphic: React.FC<PalletGraphicProps> = ({
  wrapped = false,
  boxCount = 0,
  heightCm = 140,
  className = 'w-16 h-14',
}) => {
  return (
    <div className={`relative flex items-end justify-center ${className}`}>
      <svg
        viewBox="0 0 100 80"
        className="w-full h-full drop-shadow-sm transition-all"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wooden Pallet Base Structure */}
        {/* Bottom skids */}
        <rect x="10" y="68" width="16" height="6" rx="1" fill="#8d5b28" />
        <rect x="42" y="68" width="16" height="6" rx="1" fill="#8d5b28" />
        <rect x="74" y="68" width="16" height="6" rx="1" fill="#8d5b28" />

        {/* Middle spacers / blocks */}
        <rect x="10" y="60" width="16" height="8" rx="1" fill="#b88349" />
        <rect x="42" y="60" width="16" height="8" rx="1" fill="#b88349" />
        <rect x="74" y="60" width="16" height="8" rx="1" fill="#b88349" />

        {/* Top Deck Planks */}
        <rect x="5" y="55" width="90" height="5" rx="1" fill="#d49b5c" />
        <line x1="25" y1="55" x2="25" y2="60" stroke="#8d5b28" strokeWidth="0.8" />
        <line x1="50" y1="55" x2="50" y2="60" stroke="#8d5b28" strokeWidth="0.8" />
        <line x1="75" y1="55" x2="75" y2="60" stroke="#8d5b28" strokeWidth="0.8" />

        {/* EPAL / EUR Stamp Simulation on Center Block */}
        <ellipse cx="50" cy="64" rx="5" ry="2.5" stroke="#68421b" strokeWidth="0.6" fill="none" />
        <text
          x="50"
          y="65.5"
          fontSize="2.5"
          fill="#68421b"
          textAnchor="middle"
          fontWeight="bold"
          fontFamily="monospace"
        >
          EPAL
        </text>

        {/* Stacked Cargo Boxes on Pallet (if boxCount > 0) */}
        {boxCount > 0 && (
          <g>
            {/* Box Layer 1 */}
            <rect x="12" y="38" width="36" height="17" rx="1.5" fill="#c69255" stroke="#9e6e37" strokeWidth="0.8" />
            <line x1="12" y1="46" x2="48" y2="46" stroke="#9e6e37" strokeDasharray="1.5 1" strokeWidth="0.6" />
            <rect x="52" y="38" width="36" height="17" rx="1.5" fill="#baa474" stroke="#9e6e37" strokeWidth="0.8" />
            <line x1="52" y1="46" x2="88" y2="46" stroke="#9e6e37" strokeDasharray="1.5 1" strokeWidth="0.6" />

            {/* Box Layer 2 if > 2 boxes */}
            {boxCount >= 3 && (
              <>
                <rect x="18" y="22" width="32" height="16" rx="1.5" fill="#baa474" stroke="#9e6e37" strokeWidth="0.8" />
                <rect x="50" y="22" width="32" height="16" rx="1.5" fill="#c69255" stroke="#9e6e37" strokeWidth="0.8" />
              </>
            )}

            {/* Box Layer 3 if > 5 boxes */}
            {boxCount >= 6 && (
              <rect x="25" y="8" width="50" height="14" rx="1.5" fill="#d2a679" stroke="#9e6e37" strokeWidth="0.8" />
            )}
          </g>
        )}

        {/* Stretch Film Wrapping Sheen (Pellicola Termoretraibile) */}
        {wrapped && (
          <g>
            <rect
              x="8"
              y={boxCount > 0 ? (boxCount >= 6 ? 6 : boxCount >= 3 ? 20 : 36) : 53}
              width="84"
              height={boxCount > 0 ? (boxCount >= 6 ? 51 : boxCount >= 3 ? 37 : 21) : 6}
              rx="2"
              fill="rgba(56, 189, 248, 0.22)"
              stroke="rgba(14, 165, 233, 0.6)"
              strokeWidth="1.2"
              strokeDasharray="4 2"
            />
            {/* Wrap Band Stripes */}
            <line
              x1="8"
              y1={boxCount >= 6 ? 25 : boxCount >= 3 ? 32 : 45}
              x2="92"
              y2={boxCount >= 6 ? 28 : boxCount >= 3 ? 35 : 48}
              stroke="rgba(255, 255, 255, 0.7)"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* Wrapping Indicator Badge */}
      {wrapped && (
        <span className="absolute -top-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white shadow-xs">
          Filmato
        </span>
      )}
    </div>
  );
};

interface BoxGraphicProps {
  sealed?: boolean;
  fragile?: boolean;
  boxType?: string;
  className?: string;
}

export const BoxGraphic: React.FC<BoxGraphicProps> = ({
  sealed = false,
  fragile = false,
  className = 'w-12 h-11',
}) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 60 50"
        className="w-full h-full drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Main Cardboard Box Body */}
        <path
          d="M6 14L30 3L54 14V38L30 48L6 38V14Z"
          fill="#d49b5c"
          stroke="#9e6e37"
          strokeWidth="1.2"
        />

        {/* Top Fold Faces */}
        <path d="M6 14L30 24L54 14L30 3L6 14Z" fill="#e0b17b" stroke="#9e6e37" strokeWidth="1" />

        {/* Center fold lines */}
        <line x1="30" y1="24" x2="30" y2="48" stroke="#9e6e37" strokeWidth="1.2" />

        {/* Left and Right face shading */}
        <path d="M6 14L30 24V48L6 38V14Z" fill="rgba(0,0,0,0.08)" />

        {/* Sealing Tape Strip */}
        {sealed ? (
          <path
            d="M26 4L34 7L34 22L26 19Z"
            fill="#92400e"
            opacity="0.9"
            stroke="#78350f"
            strokeWidth="0.5"
          />
        ) : (
          <line
            x1="30"
            y1="3"
            x2="30"
            y2="24"
            stroke="#b45309"
            strokeWidth="1"
            strokeDasharray="2 1"
          />
        )}

        {/* Shipping Label on Front Right */}
        <rect
          x="34"
          y="28"
          width="14"
          height="10"
          rx="1"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="0.6"
        />
        <line x1="36" y1="31" x2="44" y2="31" stroke="#0f172a" strokeWidth="0.8" />
        <line x1="36" y1="34" x2="42" y2="34" stroke="#64748b" strokeWidth="0.6" />

        {/* Fragile Glass Symbol on Front Left if fragile */}
        {fragile && (
          <path
            d="M16 28H22V32C22 33.5 20.5 35 19 35V38H22V39H16V38H19V35C17.5 35 16 33.5 16 32V28Z"
            fill="#dc2626"
          />
        )}
      </svg>
    </div>
  );
};

export const TruckBedMiniGraphic: React.FC<{
  assignedPallets: number;
  maxPallets: number;
  className?: string;
}> = ({ assignedPallets, maxPallets, className = 'w-full h-8' }) => {
  const slots = Array.from({ length: maxPallets }, (_, i) => i + 1);

  return (
    <div className={`flex items-center gap-1.5 p-1 bg-slate-900/60 rounded-lg border border-slate-700/60 ${className}`}>
      {/* Truck Cab Front */}
      <div className="w-6 h-6 rounded bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-[10px] font-bold text-slate-400">
        CAB
      </div>

      {/* Trailer Bays */}
      <div className="flex-1 grid grid-flow-col auto-cols-fr gap-1 h-6">
        {slots.map((s) => {
          const filled = s <= assignedPallets;
          return (
            <div
              key={s}
              title={`Piazzola #${s} ${filled ? '(Occupata)' : '(Libera)'}`}
              className={`rounded border text-[9px] font-mono flex items-center justify-center font-bold transition-all ${
                filled
                  ? 'bg-blue-600/80 border-blue-400 text-white shadow-xs'
                  : 'bg-slate-950/40 border-slate-800 text-slate-600'
              }`}
            >
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
};
