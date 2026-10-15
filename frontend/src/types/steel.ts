import { BranchLocation } from './auth';

export type SteelGrade =
  | 'A36_Structural'
  | 'A572_HighStrength'
  | 'SS304_Stainless'
  | 'SS316_Stainless'
  | 'AISI1045_Carbon'
  | 'ToolSteel_D2';

export type BatchStatus =
  | 'InProduction'
  | 'QualityCheck'
  | 'Available'
  | 'Reserved'
  | 'Shipped';

export interface SteelBatch {
  id: string;
  heatNumber: string;
  grade: SteelGrade | string;
  weightInTons: number;
  dimensions: string;
  status: BatchStatus | string;
  location: string;
  branch: BranchLocation;
  createdAt: string;
  lastUpdated?: string;
}

export interface CreateSteelBatchDto {
  heatNumber: string;
  grade: SteelGrade;
  weightInTons: number;
  dimensions: string;
  location: string;
  branch?: BranchLocation;
  createdAt?: string;
}

export interface UpdateBatchStatusDto {
  status: BatchStatus;
  newLocation?: string;
}

export interface InventoryStats {
  totalBatches: number;
  totalTonnage: number;
  inProductionCount: number;
  qualityCheckCount: number;
  availableCount: number;
  shippedCount: number;
}
