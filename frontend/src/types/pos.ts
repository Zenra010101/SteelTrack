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
  pricePerTonPHP: number;
  lineTotalPHP: number;
  /** Backward compatibility */
  pricePerTonUSD?: number;
  lineTotalUSD?: number;
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
  subtotalPHP: number;
  taxPHP: number;
  discountPHP: number;
  totalAmountPHP: number;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Corporate Credit Line' | 'Cheque';
  amountTenderedPHP?: number;
  changeDuePHP?: number;
  referenceNumber?: string;
  createdAt: string;
  /** Backward compatibility */
  subtotalUSD?: number;
  taxUSD?: number;
  discountUSD?: number;
  totalAmountUSD?: number;
  amountTenderedUSD?: number;
  changeDueUSD?: number;
}
