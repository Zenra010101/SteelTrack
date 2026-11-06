import { BranchLocation } from './auth';

export interface PosCartItem {
  id: string; // unique item id in cart
  batchId: string;
  batchCode?: string;
  productId?: string;
  productName?: string;
  sku?: string;
  categoryName?: string;
  heatNumber: string;
  grade: string;
  dimensions: string;
  location: string;
  availableTons: number;
  availableQuantity?: number;
  quantityTons: number;
  pricePerTonPHP: number;
  lineTotalPHP: number;
  costPrice?: number;
  unitOfMeasure?: string;
  isOldStock?: boolean;
  fifoPriority?: boolean;
  fifoRank?: number;
  receivedDate?: string;
  /** Backward compatibility */
  pricePerTonUSD?: number;
  lineTotalUSD?: number;
}

export type SteelCategory =
  | 'All'
  | 'Stainless Plates'
  | 'Bars'
  | 'Sheets'
  | 'Tubes'
  | 'Stainless Bars'
  | 'Stainless Sheets'
  | 'Stainless Tubes';

export interface PosSplitTender {
  method: 'Cash' | 'Card' | 'Bank Transfer' | 'Corporate Credit Line' | 'Cheque';
  amount: number;
  referenceNumber?: string;
}

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
  paymentMethod: 'Cash' | 'Card' | 'Bank Transfer' | 'Corporate Credit Line' | 'Cheque' | 'Split Payment';
  splitTenders?: PosSplitTender[];
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
