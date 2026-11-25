import { CargoLoad } from '../types/warehouse';

export const INITIAL_LOADS: CargoLoad[] = [
  {
    id: 'load-default',
    code: 'CAR-001',
    title: 'Nuovo Carico',
    client: 'Cliente Spedizione',
    destination: 'Destinazione Consegna',
    carrier: 'Motrice 12 EPAL',
    departureDate: new Date().toISOString().slice(0, 10),
    vehicleMaxWeightKg: 4500,
    vehicleMaxPallets: 12,
    status: 'in_preparazione',
    pallets: [],
    boxes: [],
    items: [],
  },
];
