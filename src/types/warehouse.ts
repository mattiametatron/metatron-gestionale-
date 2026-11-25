export type PalletType = 'EPAL_80x120' | 'IND_100x120' | 'HALF_80x60' | 'FUORI_MISURA';

export type BoxType =
  | 'S_40x30x30'
  | 'M_60x40x40'
  | 'L_80x60x50'
  | 'CASSA_LEGNO'
  | 'PERSONALIZZATA';

export interface ChecklistItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitWeightKg: number;
  checked: boolean;
  fragile: boolean;
  palletId: string | null;
  boxId: string | null;
  notes: string;
  dimensionsCm?: string; // es. "50×40×30 cm" per materiale fuori scatola o ingombrante
  photoDataUrl?: string; // Foto articolo compressa in DataURL
  kitName?: string; // Nome del Kit se generato da un Kit
  loadedAt?: string; // Data e ora CARICO (preparazione spedizione)
  shippedAt?: string; // Data e ora SCARICO (spedizione effettuata)
}

export interface CargoBox {
  id: string;
  code: string;
  label: string;
  boxType: BoxType;
  dimensionsCm: string;
  tareKg: number;
  maxWeightKg: number;
  palletId: string | null;
  parentBoxId?: string | null; // Se presente, questa scatola è contenuta dentro un'altra scatola (Scatolone madre)
  sealed: boolean;
  fragile: boolean;
  stackLevel: 1 | 2 | 3;
  kitName?: string;
  loadedAt?: string; // Data e ora CARICO (preparazione scatola)
  shippedAt?: string; // Data e ora SCARICO (spedizione scatola)
}

export interface CargoPallet {
  id: string;
  code: string;
  label: string;
  palletType: PalletType;
  dimensionsCm: string;
  heightCm: number;
  tareKg: number;
  maxWeightKg: number;
  wrapped: boolean;
  truckSlot: number | null;
  notes: string;
  customWeightKg?: number | null; // Peso lordo effettivo pesato alla bilancia o digitato manualmente
  loadedAt?: string; // Data e ora CARICO (preparazione bancale per spedizione)
  shippedAt?: string; // Data e ora SCARICO (bancale spedito)
}

export type LoadStatus = 'in_preparazione' | 'pronto_al_carico' | 'caricato';

export interface ElectronicSignature {
  id: string;
  role: 'operatore' | 'responsabile' | 'autista';
  roleLabel: string;
  signerName: string;
  companyOrBadge?: string;
  signatureDataUrl: string; // Base64 canvas stroke drawing
  signedAt: string; // ISO datetime
}

export type CartelloLayoutFormat =
  | 'a4_portrait'
  | 'a4_landscape'
  | 'a5_double'
  | 'a6_quad';

export interface FinishingCartello {
  id: string;
  commessaCode: string;
  commessaTitle: string;
  clientName?: string;
  treatmentText: string; // Testo libero es. "RAL 7016 GRIGIO ANTRACITE", "ZINCATO A CALDO", "ELETTROZINCATO"
  swatchHex?: string | null; // Colore indicativo opzionale per il cartello
  finishType?: string; // es. "Opaco", "Lucido", "Goffrato", "Passivazione Bianca"
  supplierName?: string; // Nome terzista / verniciatura / zincatura
  quantityOrPieces?: string; // es. "2 Bancali / 34 pz"
  palletCode?: string; // Eventuale bancale associato
  deliveryDate?: string;
  notes?: string;
  layoutFormat?: CartelloLayoutFormat;
  fontScale?: 'normal' | 'large' | 'giant';
  showSignatures?: boolean;
  showColorBanner?: boolean;
  showItemsList?: boolean;
  createdAt: string;
}

export interface CargoLoad {
  id: string;
  code: string;
  title: string;
  client: string;
  destination: string;
  carrier: string;
  departureDate: string;
  vehicleMaxWeightKg: number;
  vehicleMaxPallets: number;
  status: LoadStatus;
  pallets: CargoPallet[];
  boxes: CargoBox[];
  items: ChecklistItem[];
  signatures?: ElectronicSignature[];
  finishingTags?: FinishingCartello[];
  packingProofs?: PackageVerificationProof[];
  handoverProof?: ShipmentHandoverProof;
  loadedAt?: string; // Data e ora CARICO commessa (preparazione spedizione)
  shippedAt?: string; // Data e ora SCARICO commessa (spedizione effettuata)
}

export type ProofPhotoStage =
  | 'layer_1'
  | 'layer_2'
  | 'layer_3'
  | 'open_contents'
  | 'on_scale'
  | 'sealed_package'
  | 'on_pallet'
  | 'handover_pallet'
  | 'handover_truck'
  | 'extra_detail';

export interface PackingProofPhoto {
  id: string;
  stage: ProofPhotoStage;
  stageLabel: string;
  dataUrl: string;
  capturedAt: string;
}

export interface PackingProofVideoMeta {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number;
  capturedAt: string;
  sha256Hash: string;
}

export interface VerifiedProofItem {
  itemId: string;
  sku: string;
  name: string;
  expectedQty: number;
  countedQty: number;
  unitWeightKg: number;
  verifiedAt: string;
}

export interface PackageVerificationProof {
  id: string;
  targetType: 'box' | 'pallet_loose' | 'full_commessa';
  targetId: string; // box.id or pallet.id or load.id
  targetCode: string; // es. SCAT-01 or PAL-01
  targetLabel: string;
  palletCode?: string;
  commessaCode: string;
  items: VerifiedProofItem[];
  theoreticalWeightKg: number;
  measuredWeightKg: number | null;
  weightTolerancePercent: number;
  weightStatus: 'conforme' | 'scarto' | 'non_pesato';
  sealNumber: string;
  operatorName: string;
  checkerName?: string;
  photos: PackingProofPhoto[];
  videos?: PackingProofVideoMeta[];
  notes?: string;
  certifiedAt: string;
  sha256Hash: string;
  stockUnloaded: boolean;
  linkedMovementIds: string[];
}

export interface ShipmentHandoverProof {
  id: string;
  commessaCode: string;
  carrierName: string;
  driverName: string;
  truckPlate: string;
  ddtNumber: string;
  ddtDeclaredWeightKg: number | null;
  totalBoxesDelivered: number;
  totalPalletsDelivered: number;
  photos: PackingProofPhoto[];
  driverSignatureDataUrl?: string;
  notes?: string;
  handoverAt: string;
  sha256Hash: string;
}

export type StockMovementType = 'carico' | 'scarico';

export interface WarehouseItemAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  addedAt: string;
}

export interface WarehouseStockItem {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  location: string;
  supplier?: string;
  notes?: string;
  photoDataUrl?: string;
  attachments?: WarehouseItemAttachment[];
  isFavorite?: boolean;
  usageCount?: number;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  type: StockMovementType;
  quantity: number;
  previousQty: number;
  resultingQty: number;
  reason: string;
  commessaCode?: string;
  packageCode?: string;
  sealNumber?: string;
  proofHash?: string;
  operatorName: string;
  documentRef?: string;
  notes?: string;
  timestamp: string;
}

export interface WarehouseInventoryState {
  items: WarehouseStockItem[];
  movements: StockMovement[];
  hiddenCommessaCodes?: string[];
}

export type UserRole = 'worker' | 'employer';

export interface AuthUser {
  id: string;
  name: string;
  company?: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface DirectoryUser {
  id: string;
  name: string;
  company?: string;
  role: UserRole;
  isOnline?: boolean;
}

export interface SharedTransferRecord {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  fileName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  kind: 'photo' | 'file';
  commessaCode?: string;
  message?: string;
  createdAt: string;
  savedByRecipient?: boolean;
}

export interface EmployerProfileOverview {
  id: string;
  name: string;
  company?: string;
  email: string;
  role: UserRole;
  createdAt: string;
  isOnline: boolean;
  stats: {
    commesseCount: number;
    palletsCount: number;
    boxesCount: number;
    totalWeightKg: number;
    movementsCount: number;
    carichiCount: number;
    scarichiCount: number;
    photosCount: number;
    filesCount: number;
  };
}

export type CalendarEventKind =
  | 'appuntamento'
  | 'appunto'
  | 'promemoria'
  | 'spedizione';

export interface CalendarMemberSummary {
  id: string;
  name: string;
  role: UserRole;
}

export interface CalendarRecord {
  id: string;
  name: string;
  color: string;
  ownerId: string;
  ownerName: string;
  isShared: boolean;
  isDefaultPersonal?: boolean;
  memberIds: string[];
  members?: CalendarMemberSummary[];
  createdAt: string;
}

export interface CalendarEventRecord {
  id: string;
  calendarId: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  endTime?: string; // HH:MM
  title: string;
  notes?: string;
  kind: CalendarEventKind;
  commessaCode?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationCategory =
  | 'message'
  | 'low_stock'
  | 'stock_movement'
  | 'calendar'
  | 'alarm'
  | 'system_update';

export interface ServerNotificationRecord {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  targetApp:
    | 'team_share'
    | 'warehouse_catalog'
    | 'stock_movements'
    | 'calendar'
    | 'clock'
    | 'software_updates'
    | 'ddt_documents'
    | 'crm_directory'
    | 'purchase_orders';
  meta?: {
    shareId?: string;
    calendarId?: string;
    eventId?: string;
    eventDate?: string;
    commessaCode?: string;
  };
  read: boolean;
  createdAt: string;
}

export type CrmContactKind = 'cliente' | 'fornitore' | 'entrambi';

export interface CrmContact {
  id: string;
  kind: CrmContactKind;
  code: string;
  companyName: string;
  contactName?: string;
  vatNumber?: string;
  sdiCode?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  website?: string;
  billingAddress?: string;
  shippingAddress?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  defaultCarrier?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  notes?: string;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DdtStatus = 'bozza' | 'emesso' | 'in_transito' | 'consegnato' | 'annullato';

export type DdtCausal =
  | 'Vendita'
  | 'Conto Lavorazione'
  | 'Conto Visione'
  | 'Reso'
  | 'Trasferimento Interno'
  | 'Riparazione'
  | 'Omaggio';

export type DdtTransportBy = 'Mittente' | 'Destinatario' | 'Vettore';

export interface DdtLineItem {
  id: string;
  sku: string;
  description: string;
  unit: string;
  quantity: number;
  unitWeightKg: number;
  notes?: string;
}

export interface DdtDocument {
  id: string;
  number: string;
  progressiveNumber: number;
  year: number;
  issueDate: string; // YYYY-MM-DD
  transportDateTime: string; // YYYY-MM-DDTHH:MM
  status: DdtStatus;
  commessaId?: string;
  commessaCode?: string;
  commessaTitle?: string;
  senderCompany: string;
  senderVat?: string;
  senderAddress?: string;
  clientId?: string;
  recipientName: string;
  recipientVat?: string;
  recipientAddress?: string;
  destinationAddress?: string;
  causal: DdtCausal;
  transportBy: DdtTransportBy;
  carrierName?: string;
  driverName?: string;
  vehiclePlate?: string;
  trackingCode?: string;
  appearance: string;
  packagesCount: number;
  palletsCount: number;
  grossWeightKg: number;
  netWeightKg: number;
  porto: 'Franco' | 'Assegnato';
  items: DdtLineItem[];
  notes?: string;
  driverSignatureDataUrl?: string;
  recipientSignatureDataUrl?: string;
  signedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus =
  | 'bozza'
  | 'inviato'
  | 'confermato'
  | 'parziale'
  | 'ricevuto'
  | 'annullato';

export interface PurchaseOrderItem {
  id: string;
  inventoryItemId?: string;
  sku: string;
  name: string;
  unit: string;
  currentStockAtOrder: number;
  minStockAtOrder: number;
  orderedQty: number;
  receivedQty: number;
  unitCostEur: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  progressiveNumber: number;
  year: number;
  orderDate: string; // YYYY-MM-DD
  expectedDeliveryDate?: string; // YYYY-MM-DD
  status: PurchaseOrderStatus;
  supplierId?: string;
  supplierName: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierVat?: string;
  supplierAddress?: string;
  paymentTerms?: string;
  deliveryAddress?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  receivedAt?: string;
  stockLoaded?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const PALLET_SPECS: Record<
  PalletType,
  { name: string; dimensionsCm: string; tareKg: number; defaultMaxKg: number }
> = {
  EPAL_80x120: {
    name: 'EPAL Euro (80×120 cm)',
    dimensionsCm: '80×120 cm',
    tareKg: 25,
    defaultMaxKg: 800,
  },
  IND_100x120: {
    name: 'Industriale (100×120 cm)',
    dimensionsCm: '100×120 cm',
    tareKg: 30,
    defaultMaxKg: 1000,
  },
  HALF_80x60: {
    name: 'Mezzo Bancale (80×60 cm)',
    dimensionsCm: '80×60 cm',
    tareKg: 12,
    defaultMaxKg: 400,
  },
  FUORI_MISURA: {
    name: 'Fuori Misura (120×120 cm)',
    dimensionsCm: '120×120 cm',
    tareKg: 35,
    defaultMaxKg: 1200,
  },
};

export const BOX_SPECS: Record<
  BoxType,
  { name: string; dimensionsCm: string; tareKg: number; defaultMaxKg: number }
> = {
  S_40x30x30: {
    name: 'Scatola Piccola Doppia Onda',
    dimensionsCm: '40×30×30 cm',
    tareKg: 0.5,
    defaultMaxKg: 18,
  },
  M_60x40x40: {
    name: 'Scatola Media Standard EPAL',
    dimensionsCm: '60×40×40 cm',
    tareKg: 0.8,
    defaultMaxKg: 28,
  },
  L_80x60x50: {
    name: 'Scatola Grande Master',
    dimensionsCm: '80×60×50 cm',
    tareKg: 1.4,
    defaultMaxKg: 40,
  },
  CASSA_LEGNO: {
    name: 'Cassa Legno / KLT Rinforzata',
    dimensionsCm: '80×60×60 cm',
    tareKg: 6.0,
    defaultMaxKg: 120,
  },
  PERSONALIZZATA: {
    name: 'Su Misura (L×P×H cm)',
    dimensionsCm: '50×40×35 cm',
    tareKg: 1.0,
    defaultMaxKg: 35,
  },
};
