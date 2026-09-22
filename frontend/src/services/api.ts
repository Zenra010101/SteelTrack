import type {
  SteelBatch,
  CreateSteelBatchDto,
  UpdateBatchStatusDto,
  InventoryStats,
} from '../types/steel';
import { BranchLocation } from '../types/auth';
import type { StockTransferRequest, PosTransaction, TransferStatus } from '../types/transfer';

const API_BASE_URL = '/api/inventory';

// Initial Mock Inventory dataset tagged with Davao, Makati, Mandaue, and Cebu branches
let mockBatches: SteelBatch[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    heatNumber: 'HT-2026-8841',
    grade: 'A36_Structural',
    weightInTons: 14.5,
    dimensions: '12mm x 1500mm x 6000mm',
    status: 'Available',
    location: 'Yard A - Bay 02',
    branch: BranchLocation.Davao,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    heatNumber: 'HT-2026-9012',
    grade: 'SS304_Stainless',
    weightInTons: 8.2,
    dimensions: '6mm x 1220mm x 3000mm',
    status: 'QualityCheck',
    location: 'Testing Lab B',
    branch: BranchLocation.Makati,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    heatNumber: 'HT-2026-9504',
    grade: 'A572_HighStrength',
    weightInTons: 22.0,
    dimensions: '25mm x 2000mm x 12000mm',
    status: 'InProduction',
    location: 'Mill Line #1',
    branch: BranchLocation.Mandaue,
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    heatNumber: 'HT-2026-7731',
    grade: 'AISI1045_Carbon',
    weightInTons: 18.7,
    dimensions: '50mm x 1000mm x 4000mm',
    status: 'Reserved',
    location: 'Yard C - Dock 1',
    branch: BranchLocation.Cebu,
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    heatNumber: 'HT-2026-6109',
    grade: 'SS316_Stainless',
    weightInTons: 11.4,
    dimensions: '8mm x 1500mm x 6000mm',
    status: 'Shipped',
    location: 'In Transit - Truck 409',
    branch: BranchLocation.Davao,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    heatNumber: 'HT-2026-1049',
    grade: 'A36_Structural',
    weightInTons: 30.0,
    dimensions: '16mm x 2000mm x 12000mm',
    status: 'Available',
    location: 'Central Storage Bay 4',
    branch: BranchLocation.Makati,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    heatNumber: 'HT-2026-3392',
    grade: 'ToolSteel_D2',
    weightInTons: 5.8,
    dimensions: '40mm x 500mm x 2000mm',
    status: 'Available',
    location: 'Precision Vault A',
    branch: BranchLocation.Cebu,
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

// Mock Inter-Branch Stock Transfers
let mockTransfers: StockTransferRequest[] = [
  {
    id: 'tr-101',
    sourceBranch: BranchLocation.Makati,
    destinationBranch: BranchLocation.Davao,
    batchId: '66666666-6666-6666-6666-666666666666',
    heatNumber: 'HT-2026-1049',
    grade: 'A36_Structural',
    weightInTons: 15.0,
    requestedBy: 'Maria Santos (Davao Manager)',
    approvedBy: 'Carlos Reyes (Makati Manager)',
    status: 'InTransit',
    notes: 'Urgent structural beams required for Davao Port Expansion project.',
    createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
  },
  {
    id: 'tr-102',
    sourceBranch: BranchLocation.Cebu,
    destinationBranch: BranchLocation.Mandaue,
    batchId: '44444444-4444-4444-4444-444444444444',
    heatNumber: 'HT-2026-7731',
    grade: 'AISI1045_Carbon',
    weightInTons: 8.0,
    requestedBy: 'Mandaue Logistics Lead',
    status: 'Pending',
    notes: 'Inter-island machinery fabrication order.',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
];

// Mock POS Receipts
let mockTransactions: PosTransaction[] = [
  {
    id: 'pos-8001',
    invoiceNumber: 'INV-2026-0041',
    branch: BranchLocation.Davao,
    cashierName: 'Juan Dela Cruz',
    customerName: 'Mindanao Steelworks Corp.',
    customerTin: '241-890-112-000',
    items: [
      {
        id: 'cart-1',
        batchId: '11111111-1111-1111-1111-111111111111',
        heatNumber: 'HT-2026-8841',
        grade: 'A36_Structural',
        dimensions: '12mm x 1500mm x 6000mm',
        location: 'Yard A - Bay 02',
        availableTons: 14.5,
        quantityTons: 4.5,
        pricePerTonUSD: 850,
        lineTotalUSD: 3825,
      },
    ],
    totalTonnage: 4.5,
    subtotalUSD: 3825,
    taxUSD: 459,
    discountUSD: 0,
    totalAmountUSD: 4284,
    paymentMethod: 'Bank Transfer',
    referenceNumber: 'BDO-TRX-992014',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
];

export async function fetchInventory(
  search?: string,
  grade?: string,
  status?: string,
  branch?: BranchLocation | string
): Promise<{ data: SteelBatch[]; isLiveBackend: boolean }> {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (grade) params.append('grade', grade);
    if (status) params.append('status', status);
    if (branch) params.append('branch', branch);

    const res = await fetch(`${API_BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = await res.json();
      return { data, isLiveBackend: true };
    }
  } catch (err) {
    console.warn('Backend API unreachable, using client state mode:', err);
  }

  // Filter fallback state
  let filtered = [...mockBatches];

  if (branch) {
    filtered = filtered.filter((b) => b.branch === branch);
  }
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.heatNumber.toLowerCase().includes(s) ||
        b.location.toLowerCase().includes(s) ||
        b.dimensions.toLowerCase().includes(s) ||
        b.branch.toLowerCase().includes(s)
    );
  }
  if (grade) {
    filtered = filtered.filter((b) => b.grade === grade);
  }
  if (status) {
    filtered = filtered.filter((b) => b.status === status);
  }

  return { data: filtered, isLiveBackend: false };
}

export async function fetchStats(branch?: BranchLocation | string): Promise<InventoryStats> {
  try {
    const url = branch ? `${API_BASE_URL}/stats?branch=${branch}` : `${API_BASE_URL}/stats`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API stats unreachable, computing locally:', err);
  }

  const activeBatches = branch
    ? mockBatches.filter((b) => b.branch === branch)
    : mockBatches;

  return {
    totalBatches: activeBatches.length,
    totalTonnage: Number(
      activeBatches.reduce((acc, b) => acc + b.weightInTons, 0).toFixed(2)
    ),
    inProductionCount: activeBatches.filter((b) => b.status === 'InProduction').length,
    qualityCheckCount: activeBatches.filter((b) => b.status === 'QualityCheck').length,
    availableCount: activeBatches.filter((b) => b.status === 'Available').length,
    shippedCount: activeBatches.filter((b) => b.status === 'Shipped').length,
  };
}

export async function createBatch(dto: CreateSteelBatchDto): Promise<SteelBatch> {
  try {
    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API create batch unreachable, using local store:', err);
  }

  const newBatch: SteelBatch = {
    id: crypto.randomUUID(),
    heatNumber:
      dto.heatNumber ||
      `HT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    grade: dto.grade,
    weightInTons: Number(dto.weightInTons),
    dimensions: dto.dimensions,
    location: dto.location,
    branch: dto.branch || BranchLocation.Davao,
    status: 'InProduction',
    createdAt: new Date().toISOString(),
  };

  mockBatches.unshift(newBatch);
  return newBatch;
}

export async function updateBatchStatus(
  id: string,
  dto: UpdateBatchStatusDto
): Promise<SteelBatch | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend API status update unreachable, using local store:', err);
  }

  const index = mockBatches.findIndex((b) => b.id === id);
  if (index !== -1) {
    mockBatches[index] = {
      ...mockBatches[index],
      status: dto.status,
      location: dto.newLocation || mockBatches[index].location,
      lastUpdated: new Date().toISOString(),
    };
    return mockBatches[index];
  }
  return null;
}

// Inter-Branch Stock Transfers API
export async function fetchTransfers(branch?: BranchLocation): Promise<StockTransferRequest[]> {
  if (!branch) return mockTransfers;
  return mockTransfers.filter(
    (t) => t.sourceBranch === branch || t.destinationBranch === branch
  );
}

export async function createTransferRequest(
  request: Omit<StockTransferRequest, 'id' | 'createdAt' | 'status'>
): Promise<StockTransferRequest> {
  const newTransfer: StockTransferRequest = {
    ...request,
    id: `tr-${Math.floor(100 + Math.random() * 900)}`,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  mockTransfers.unshift(newTransfer);
  return newTransfer;
}

export async function updateTransferStatus(
  id: string,
  status: TransferStatus,
  approverName?: string
): Promise<StockTransferRequest | null> {
  const index = mockTransfers.findIndex((t) => t.id === id);
  if (index !== -1) {
    mockTransfers[index] = {
      ...mockTransfers[index],
      status,
      approvedBy: approverName || mockTransfers[index].approvedBy,
    };
    return mockTransfers[index];
  }
  return null;
}

// POS Cashier Transactions API
export async function fetchPosTransactions(branch?: BranchLocation): Promise<PosTransaction[]> {
  if (!branch) return mockTransactions;
  return mockTransactions.filter((t) => t.branch === branch);
}

export async function processPosSale(
  dto: Omit<PosTransaction, 'id' | 'invoiceNumber' | 'createdAt'>
): Promise<PosTransaction> {
  const newTx: PosTransaction = {
    ...dto,
    id: `pos-${Math.floor(8000 + Math.random() * 1000)}`,
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: new Date().toISOString(),
  };

  // Deduct tonnage from inventory batches
  if (newTx.items && newTx.items.length > 0) {
    for (const item of newTx.items) {
      const bIdx = mockBatches.findIndex((b) => b.id === item.batchId);
      if (bIdx !== -1) {
        const remaining = Math.max(0, mockBatches[bIdx].weightInTons - item.quantityTons);
        mockBatches[bIdx] = {
          ...mockBatches[bIdx],
          weightInTons: Number(remaining.toFixed(2)),
          status: remaining <= 0.05 ? 'Shipped' : mockBatches[bIdx].status,
        };
      }
    }
  }

  mockTransactions.unshift(newTx);
  return newTx;
}

// Mock LSTM Demand Forecast Data Provider
export interface LstmDemandPoint {
  month: string;
  actualDemandTons?: number;
  predictedDemandTons: number;
  confidenceLower: number;
  confidenceUpper: number;
  isForecast: boolean;
}

export function fetchLstmDemandForecast(
  branch?: BranchLocation | 'All',
  grade?: string
): LstmDemandPoint[] {
  // Baseline data curve with realistic seasonal steel demand patterns
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr (Forecast)', 'May (Forecast)', 'Jun (Forecast)'];
  const gradeFactor = grade === 'A572_HighStrength' ? 1.25 : grade === 'SS304_Stainless' ? 0.75 : 1.0;
  const baseTonnage = (branch === BranchLocation.Makati ? 140 : branch === BranchLocation.Davao ? 110 : 95) * gradeFactor;

  return months.map((m, idx) => {
    const isForecast = idx >= 6;
    const variation = Math.sin(idx * 0.8) * 15 + (idx * 4);
    const predicted = Math.round(baseTonnage + variation);

    return {
      month: m,
      actualDemandTons: isForecast ? undefined : Math.round(predicted + (Math.random() * 10 - 5)),
      predictedDemandTons: predicted,
      confidenceLower: Math.round(predicted * 0.92),
      confidenceUpper: Math.round(predicted * 1.08),
      isForecast,
    };
  });
}
