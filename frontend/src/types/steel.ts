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

/**
 * One row of the `branch_products` catalog table, exposed by
 * GET /api/inventory/stock-list (owner role). Replaces the legacy
 * in-memory inventory state when driving the UI from the database
 * instead of a locally cached list of steel batches.
 */
export interface BranchProductItem {
  id: string;
  branchId?: string;
  productId?: string;
  branch?: BranchLocation | string;
  branchName?: string;
  sku?: string;
  productName?: string;
  productSku?: string;
  heatNumber?: string;
  sellingPrice?: number;
  defaultCostPrice?: number;
  reorderLevel?: number;
  isAvailable?: boolean;
  isActive?: boolean;
  grade?: string;
  unitOfMeasure?: string;
  size?: string;
  thickness?: string;
  length?: string;
  unitPrice?: number;
  costPrice?: number;
  stockQuantity?: number;
  currentStock?: number;
  weightInTons?: number;
  location?: string;
  status?: string;
  categoryName?: string;
  dimensions?: string;
  createdAt?: string;
}
