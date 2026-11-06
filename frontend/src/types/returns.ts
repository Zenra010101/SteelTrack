import { BranchLocation } from './auth';

export type ReturnReason =
  | 'Damaged_In_Transit'
  | 'Quality_Defect_Rust'
  | 'Incorrect_Specification'
  | 'Customer_Cancellation'
  | 'Over_Quantity_Delivered';

export type ReturnStatus = 'Draft' | 'Pending_Approval' | 'Approved' | 'Exchanged' | 'Refunded' | 'Rejected';

export interface GoodsReturnSlipItem {
  id: string;
  returnSlipId: string;
  batchId: string;
  heatNumber: string;
  grade: string;
  dimensions: string;
  quantityReturnedTons: number;
  unitPricePerTonPHP: number;
  subtotalPHP: number;
  reason: ReturnReason;
  restockEligible: boolean;
}

export interface GoodsReturnSlip {
  id: string;
  grsNumber: string;
  invoiceNumber: string;
  customerName: string;
  branch: BranchLocation;
  status: ReturnStatus;
  items: GoodsReturnSlipItem[];
  totalReturnAmount: number;
  totalReturnValuePHP?: number;
  creditNoteNumber?: string;
  requestedBy: string;
  approvedBy?: string;
  createdAt: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface CreateGrsDto {
  invoiceNumber: string;
  customerName: string;
  branch: BranchLocation;
  requestedBy: string;
  notes?: string;
  items: {
    batchId: string;
    heatNumber: string;
    grade: string;
    dimensions: string;
    quantityReturnedTons: number;
    unitPricePerTonPHP: number;
    reason: ReturnReason;
    restockEligible: boolean;
  }[];
}

export interface HeatLookupResult {
  heatNumber: string;
  invoiceNumber: string;
  customerName: string;
  companyName?: string;
  grade: string;
  dimensions: string;
  purchasedQtyTons: number;
  purchasedQtyPieces?: number;
  unitPricePerTonPHP: number;
  maxReturnableTons: number;
}
