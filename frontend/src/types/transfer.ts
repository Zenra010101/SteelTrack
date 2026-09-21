import { BranchLocation } from './auth';

export type TransferStatus = 'Pending' | 'Approved' | 'InTransit' | 'Completed' | 'Rejected';

export interface StockTransferRequest {
  id: string;
  sourceBranch: BranchLocation;
  destinationBranch: BranchLocation;
  batchId: string;
  heatNumber: string;
  grade: string;
  weightInTons: number;
  requestedBy: string;
  approvedBy?: string;
  status: TransferStatus;
  notes?: string;
  createdAt: string;
}

export interface PosTransaction {
  id: string;
  invoiceNumber: string;
  branch: BranchLocation;
  cashierName: string;
  customerName: string;
  batchId: string;
  heatNumber: string;
  grade: string;
  tonnageSold: number;
  pricePerTonUSD: number;
  totalAmountUSD: number;
  paymentMethod: 'Bank Transfer' | 'Cash' | 'Credit Line';
  createdAt: string;
}
