import React from 'react';
import { Truck, Scale, CheckCircle2, MapPin, Building2, Calendar } from 'lucide-react';
import { CargoLoad } from '../types/warehouse';
import { LoadSummary, PalletSummary } from '../utils/calculations';
import { PalletGraphic } from './WarehouseGraphics';

interface TruckLoadPlannerProps {
  load: CargoLoad;
  summary: LoadSummary;
  onAssignPalletSlot: (palletId: string, slotNumber: number | null) => void;
  onTogglePalletWrapped: (palletId: string) => void;
  onUpdateVehicleSpecs: (specs: {
    client?: string;
    destination?: string;
    carrier: string;
    vehicleMaxWeightKg: number;
    vehicleMaxPallets: number;
    departureDate: string;
  }) => void;
}

export const TruckLoadPlanner: React.FC<TruckLoadPlannerProps> = ({
  load,
  summary,
  onAssignPalletSlot,
  onTogglePalletWrapped,
  onUpdateVehicleSpecs,
}) => {
  const totalSlots = Math.max(4, Math.min(34, load.vehicleMaxPallets));
  const slots = Array.from({ length: totalSlots }, (_, idx) => idx + 1);

  let leftSideWeightKg = 0;
  let rightSideWeightKg = 0;

  summary.palletSummaries.forEach((ps) => {
    const slot = ps.pallet.truckSlot;
    if (slot) {
      if (slot % 2 === 1) {
        leftSideWeightKg += ps.grossWeightKg;
      } else {
        rightSideWeightKg += ps.grossWeightKg;
      }
    }
  });

  const totalPositionedKg = leftSideWeightKg + rightSideWeightKg;
  const leftPercent =
    totalPositionedKg > 0
      ? Math.round((leftSideWeightKg / totalPositionedKg) * 100)
      : 50;
  const rightPercent = totalPositionedKg > 0 ? 100 - leftPercent : 50;

  const findPalletInSlot = (slotNum: number): PalletSummary | undefined =>
    summary.palletSummaries.find((ps) => ps.pallet.truckSlot === slotNum);

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden">
      {/* COLONNA SINISTRA (5 COLS): PARAMETRI SPEDIZIONE E BILANCIAMENTO */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between overflow-y-auto shadow-xs space-y-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-xs font-extrabold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
              <Truck className="w-4 h-4 text-blue-600" />
              Dati Trasporto & Configurazione Mezzo
            </h2>
            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {load.code}
            </span>
          </div>

          <div className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  Cliente / Destinatario
                </label>
                <input
                  type="text"
                  placeholder="Ragione Sociale Destinatario"
                  value={load.client}
                  onChange={(e) =>
                    onUpdateVehicleSpecs({
                      client: e.target.value,
                      destination: load.destination,
                      carrier: load.carrier,
                      vehicleMaxWeightKg: load.vehicleMaxWeightKg,
                      vehicleMaxPallets: load.vehicleMaxPallets,
                      departureDate: load.departureDate,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Luogo di Scarico
                </label>
                <input
                  type="text"
                  placeholder="Città / Indirizzo"
                  value={load.destination}
                  onChange={(e) =>
                    onUpdateVehicleSpecs({
                      client: load.client,
                      destination: e.target.value,
                      carrier: load.carrier,
                      vehicleMaxWeightKg: load.vehicleMaxWeightKg,
                      vehicleMaxPallets: load.vehicleMaxPallets,
                      departureDate: load.departureDate,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Vettore / Tipo Automezzo / Targa
              </label>
              <input
                type="text"
                value={load.carrier}
                onChange={(e) =>
                  onUpdateVehicleSpecs({
                    client: load.client,
                    destination: load.destination,
                    carrier: e.target.value,
                    vehicleMaxWeightKg: load.vehicleMaxWeightKg,
                    vehicleMaxPallets: load.vehicleMaxPallets,
                    departureDate: load.departureDate,
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Piazzole EPAL
                </label>
                <select
                  value={load.vehicleMaxPallets}
                  onChange={(e) =>
                    onUpdateVehicleSpecs({
                      client: load.client,
                      destination: load.destination,
                      carrier: load.carrier,
                      vehicleMaxWeightKg: load.vehicleMaxWeightKg,
                      vehicleMaxPallets: Number(e.target.value),
                      departureDate: load.departureDate,
                    })
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value={6}>6 EPAL (Furgone)</option>
                  <option value={8}>8 EPAL</option>
                  <option value={12}>12 EPAL (Motrice)</option>
                  <option value={18}>18 EPAL (Motrice Grande)</option>
                  <option value={24}>24 EPAL</option>
                  <option value={33}>33 EPAL (Bilico 13.6m)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Portata Utile (kg)
                </label>
                <input
                  type="number"
                  min={500}
                  step={100}
                  value={load.vehicleMaxWeightKg}
                  onChange={(e) =>
                    onUpdateVehicleSpecs({
                      client: load.client,
                      destination: load.destination,
                      carrier: load.carrier,
                      vehicleMaxWeightKg: Math.max(100, Number(e.target.value)),
                      vehicleMaxPallets: load.vehicleMaxPallets,
                      departureDate: load.departureDate,
                    })
                  }
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Partenza
                </label>
                <input
                  type="date"
                  value={load.departureDate}
                  onChange={(e) =>
                    onUpdateVehicleSpecs({
                      client: load.client,
                      destination: load.destination,
                      carrier: load.carrier,
                      vehicleMaxWeightKg: load.vehicleMaxWeightKg,
                      vehicleMaxPallets: load.vehicleMaxPallets,
                      departureDate: e.target.value,
                    })
                  }
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bilanciamento Pesi Sinistra / Destra */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-blue-600" />
              Bilanciamento Laterale Pianale (SX / DX)
            </span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              SX {leftSideWeightKg.toFixed(0)} kg ({leftPercent}%) · DX{' '}
              {rightSideWeightKg.toFixed(0)} kg ({rightPercent}%)
            </span>
          </div>

          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${leftPercent}%` }}
              className="bg-blue-600 transition-all duration-300"
            />
            <div
              style={{ width: `${rightPercent}%` }}
              className="bg-indigo-500 transition-all duration-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs font-mono">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-bold">
                Piazzole Occupate
              </span>
              <strong className="text-sm text-slate-900">
                {summary.totalPallets} / {load.vehicleMaxPallets} bancali
              </strong>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block uppercase font-sans font-bold">
                Peso Totale Lordo
              </span>
              <strong className="text-sm text-slate-900">
                {summary.totalGrossWeightKg.toFixed(1)} / {load.vehicleMaxWeightKg} kg
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* COLONNA DESTRA (7 COLS): SCHEMA GRAFICO PIAZZOLE CAMION */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col overflow-hidden shadow-xs">
        <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
              Schema di Stivaggio Pianale Automezzo
            </h2>
            <p className="text-xs text-slate-500">
              Assegna ogni bancale alla propria piazzola sul cassone del camion.
            </p>
          </div>
          <div className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700">
            ▲ CABINA MOTRICE
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-2 border-slate-300 rounded-xl p-4 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {slots.map((slotNum) => {
              const occupant = findPalletInSlot(slotNum);
              const isLeft = slotNum % 2 === 1;

              return (
                <div
                  key={slotNum}
                  className={`rounded-xl border p-3 transition-all text-xs ${
                    occupant
                      ? 'bg-white border-blue-500 shadow-xs'
                      : 'bg-white/60 border-dashed border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                    <span className="font-mono font-extrabold text-slate-600 text-[11px]">
                      PIAZZOLA #{slotNum} ({isLeft ? 'LATO SX' : 'LATO DX'})
                    </span>
                    <select
                      aria-label={`Piazzola ${slotNum}`}
                      value={occupant ? occupant.pallet.id : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val && occupant) {
                          onAssignPalletSlot(occupant.pallet.id, null);
                        } else if (val) {
                          onAssignPalletSlot(val, slotNum);
                        }
                      }}
                      className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg bg-slate-50 border border-slate-300 text-slate-800 cursor-pointer"
                    >
                      <option value="">— Piazzola Libera —</option>
                      {summary.palletSummaries.map((ps) => (
                        <option key={ps.pallet.id} value={ps.pallet.id}>
                          {ps.pallet.code} — {ps.pallet.label} (
                          {ps.grossWeightKg.toFixed(0)}kg)
                        </option>
                      ))}
                    </select>
                  </div>

                  {occupant ? (
                    <div className="flex items-center gap-3">
                      <PalletGraphic
                        wrapped={occupant.pallet.wrapped}
                        boxCount={occupant.totalBoxes}
                        heightCm={occupant.pallet.heightCm}
                        className="w-12 h-10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 truncate">
                          {occupant.pallet.code} — {occupant.pallet.label}
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-0.5">
                          <span>
                            {occupant.pallet.dimensionsCm} · {occupant.totalBoxes} scatole
                          </span>
                          <strong className="text-slate-900">
                            {occupant.grossWeightKg.toFixed(1)} kg
                          </strong>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-3 text-center text-slate-400 font-mono text-[11px]">
                      Spazio disponibile
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2.5 mt-2 text-center text-xs font-mono font-bold text-slate-500 shrink-0">
          ▼ PORTELLONE / RIBALTA DI CARICO POSTERIORE
        </div>
      </div>
    </div>
  );
};
