import { BranchLocation } from './auth';
export * from './pos';

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
