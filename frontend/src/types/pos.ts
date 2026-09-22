import { BranchLocation } from './auth';

export interface PosCartItem {
  id: string; // unique item id in cart
  batchId: string;
  heatNumber: string;
  grade: string;
  dimensions: string;
  location: string;
  availableTons: number;
  quantityTons: number;
  pricePerTonUSD: number;
  lineTotalUSD: number;
}

export type SteelCategory =
  | 'All'
  | 'Structural'
  | 'HighStrength'
  | 'Stainless'
  | 'Carbon'
  | 'ToolSteel';

export interface PosTransaction {
  id: string;
  invoiceNumber: string;
  branch: BranchLocation;
  cashierName: string;
  customerName: string;
  customerTin?: string;
  items: PosCartItem[];
  totalTonnage: number;
  subtotalUSD: number;
  taxUSD: number;
  discountUSD: number;
  totalAmountUSD: number;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Corporate Credit Line' | 'Cheque';
  amountTenderedUSD?: number;
  changeDueUSD?: number;
  referenceNumber?: string;
  createdAt: string;
}
