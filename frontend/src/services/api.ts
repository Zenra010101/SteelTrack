import type {
  SteelBatch,
  CreateSteelBatchDto,
  UpdateBatchStatusDto,
  InventoryStats,
} from '../types/steel';
import { BranchLocation } from '../types/auth';
import type { StockTransferRequest, PosTransaction, TransferStatus } from '../types/transfer';
import type {
  CustomerReceivable,
  ReceivablePaymentDto,
  SaleChequeItem,
  ReceivableStats,
  ChequeStatusType,
} from '../types/receivables';
import type {
  GoodsReturnSlip,
  GoodsReturnSlipItem,
  CreateGrsDto,
} from '../types/returns';

const API_BASE_URL = '/api/inventory';

// Initial Mock Inventory dataset tagged with Davao, Cagayan, Mandaue, and Cebu branches
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
    branch: BranchLocation.Cagayan,
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
    branch: BranchLocation.Cagayan,
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
    sourceBranch: BranchLocation.Cagayan,
    destinationBranch: BranchLocation.Davao,
    batchId: '66666666-6666-6666-6666-666666666666',
    heatNumber: 'HT-2026-1049',
    grade: 'A36_Structural',
    weightInTons: 15.0,
    requestedBy: 'Maria Santos (Davao Manager)',
    approvedBy: 'Carlos Reyes (Cagayan Manager)',
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
        pricePerTonPHP: 850,
        lineTotalPHP: 3825,
      },
    ],
    totalTonnage: 4.5,
    subtotalPHP: 3825,
    taxPHP: 459,
    discountPHP: 0,
    totalAmountPHP: 4284,
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
  const baseTonnage = (branch === BranchLocation.Cagayan ? 140 : branch === BranchLocation.Davao ? 110 : 95) * gradeFactor;

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

// ----------------------------------------------------
// Customer Receivables (A/R) & Post-Dated Cheques (PDC)
// ----------------------------------------------------
let mockReceivables: CustomerReceivable[] = [
  {
    id: 'rec-001',
    customerId: 'cust-101',
    customerName: 'Mindanao Steelworks Corp.',
    companyName: 'Mindanao Steelworks Corporation',
    tin: '241-890-112-000',
    creditLimitPHP: 5000000,
    totalOutstandingPHP: 1450000,
    currentBalancePHP: 850000,
    days30BalancePHP: 400000,
    days60BalancePHP: 200000,
    days90PlusBalancePHP: 0,
    lastPaymentDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    lastPaymentAmountPHP: 150000,
    status: 'Good Standing',
    branch: BranchLocation.Davao,
  },
  {
    id: 'rec-002',
    customerId: 'cust-102',
    customerName: 'Apex Industrial Builders',
    companyName: 'Apex Construction & Industrial Inc.',
    tin: '109-443-887-001',
    creditLimitPHP: 3000000,
    totalOutstandingPHP: 2850000,
    currentBalancePHP: 600000,
    days30BalancePHP: 950000,
    days60BalancePHP: 800000,
    days90PlusBalancePHP: 500000,
    lastPaymentDate: new Date(Date.now() - 25 * 86400000).toISOString(),
    lastPaymentAmountPHP: 80000,
    status: 'Credit Warning',
    branch: BranchLocation.Cagayan,
  },
  {
    id: 'rec-003',
    customerId: 'cust-103',
    customerName: 'Visayas Shipyard Yard',
    companyName: 'Visayas Heavy Industries Corp.',
    tin: '334-112-990-000',
    creditLimitPHP: 4000000,
    totalOutstandingPHP: 4200000,
    currentBalancePHP: 1000000,
    days30BalancePHP: 1200000,
    days60BalancePHP: 1000000,
    days90PlusBalancePHP: 1000000,
    lastPaymentDate: new Date(Date.now() - 60 * 86400000).toISOString(),
    lastPaymentAmountPHP: 50000,
    status: 'Credit Blocked',
    branch: BranchLocation.Cebu,
  },
  {
    id: 'rec-004',
    customerId: 'cust-104',
    customerName: 'Mandaue Heavy Equipment',
    companyName: 'Mandaue Fabrication & Supply',
    tin: '556-991-002-000',
    creditLimitPHP: 2500000,
    totalOutstandingPHP: 920000,
    currentBalancePHP: 620000,
    days30BalancePHP: 300000,
    days60BalancePHP: 0,
    days90PlusBalancePHP: 0,
    lastPaymentDate: new Date(Date.now() - 7 * 86400000).toISOString(),
    lastPaymentAmountPHP: 200000,
    status: 'Good Standing',
    branch: BranchLocation.Mandaue,
  },
];

let mockCheques: SaleChequeItem[] = [
  {
    id: 'chq-5001',
    chequeNumber: 'BDO-0098412',
    bankName: 'BDO Unibank',
    customerName: 'Mindanao Steelworks Corp.',
    invoiceNumber: 'INV-2026-0041',
    amountPHP: 450000,
    issueDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
    maturityDate: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    status: 'Pending',
    branch: BranchLocation.Davao,
  },
  {
    id: 'chq-5002',
    chequeNumber: 'BPI-8871092',
    bankName: 'Bank of the Philippine Islands (BPI)',
    customerName: 'Apex Industrial Builders',
    invoiceNumber: 'INV-2026-0019',
    amountPHP: 800000,
    issueDate: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    maturityDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    status: 'Deposited',
    depositedDate: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    branch: BranchLocation.Cagayan,
  },
  {
    id: 'chq-5003',
    chequeNumber: 'MBTC-3329011',
    bankName: 'Metrobank',
    customerName: 'Visayas Shipyard Yard',
    invoiceNumber: 'INV-2026-0008',
    amountPHP: 500000,
    issueDate: new Date(Date.now() - 45 * 86400000).toISOString().split('T')[0],
    maturityDate: new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0],
    status: 'Bounced',
    depositedDate: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
    bouncedDate: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
    bounceReason: 'Drawn Against Insufficient Funds (DAIF)',
    bouncedNoticeSent: true,
    branch: BranchLocation.Cebu,
  },
  {
    id: 'chq-5004',
    chequeNumber: 'LBP-7740192',
    bankName: 'Landbank of the Philippines',
    customerName: 'Mandaue Heavy Equipment',
    invoiceNumber: 'INV-2026-0033',
    amountPHP: 300000,
    issueDate: new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0],
    maturityDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    status: 'Cleared',
    depositedDate: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    clearedDate: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    branch: BranchLocation.Mandaue,
  },
];

export async function fetchReceivables(branch?: BranchLocation): Promise<CustomerReceivable[]> {
  if (!branch) return mockReceivables;
  return mockReceivables.filter((r) => r.branch === branch);
}

export async function fetchReceivableStats(branch?: BranchLocation): Promise<ReceivableStats> {
  const list = branch ? mockReceivables.filter((r) => r.branch === branch) : mockReceivables;
  const cheques = branch ? mockCheques.filter((c) => c.branch === branch) : mockCheques;

  const totalReceivablesPHP = list.reduce((acc, r) => acc + r.totalOutstandingPHP, 0);
  const totalCurrentPHP = list.reduce((acc, r) => acc + r.currentBalancePHP, 0);
  const totalOverduePHP = list.reduce(
    (acc, r) => acc + r.days30BalancePHP + r.days60BalancePHP + r.days90PlusBalancePHP,
    0
  );

  const pendingPdcs = cheques.filter((c) => c.status === 'Pending');
  const bouncedPdcs = cheques.filter((c) => c.status === 'Bounced');

  return {
    totalReceivablesPHP,
    totalCurrentPHP,
    totalOverduePHP,
    pendingPdcAmountPHP: pendingPdcs.reduce((acc, c) => acc + c.amountPHP, 0),
    pendingPdcCount: pendingPdcs.length,
    bouncedCount: bouncedPdcs.length,
  };
}

export async function recordReceivablePayment(dto: ReceivablePaymentDto): Promise<CustomerReceivable | null> {
  const index = mockReceivables.findIndex((r) => r.id === dto.receivableId);
  if (index !== -1) {
    const r = mockReceivables[index];
    const newTotal = Math.max(0, r.totalOutstandingPHP - dto.amountPaidPHP);
    
    // Deduct from oldest bucket first
    let paidRemaining = dto.amountPaidPHP;
    let d90 = r.days90PlusBalancePHP;
    let d60 = r.days60BalancePHP;
    let d30 = r.days30BalancePHP;
    let curr = r.currentBalancePHP;

    if (paidRemaining > 0 && d90 > 0) {
      const ded = Math.min(paidRemaining, d90);
      d90 -= ded;
      paidRemaining -= ded;
    }
    if (paidRemaining > 0 && d60 > 0) {
      const ded = Math.min(paidRemaining, d60);
      d60 -= ded;
      paidRemaining -= ded;
    }
    if (paidRemaining > 0 && d30 > 0) {
      const ded = Math.min(paidRemaining, d30);
      d30 -= ded;
      paidRemaining -= ded;
    }
    if (paidRemaining > 0 && curr > 0) {
      const ded = Math.min(paidRemaining, curr);
      curr -= ded;
      paidRemaining -= ded;
    }

    let status: 'Good Standing' | 'Credit Warning' | 'Credit Blocked' = 'Good Standing';
    if (newTotal > r.creditLimitPHP * 0.95 || d90 > 0) {
      status = 'Credit Blocked';
    } else if (newTotal > r.creditLimitPHP * 0.75 || d60 > 0) {
      status = 'Credit Warning';
    }

    mockReceivables[index] = {
      ...r,
      totalOutstandingPHP: newTotal,
      currentBalancePHP: curr,
      days30BalancePHP: d30,
      days60BalancePHP: d60,
      days90PlusBalancePHP: d90,
      lastPaymentDate: new Date().toISOString(),
      lastPaymentAmountPHP: dto.amountPaidPHP,
      status,
    };

    // If payment was made by cheque, add to cheque register
    if (dto.paymentMethod === 'Cheque' && dto.chequeNumber) {
      mockCheques.unshift({
        id: `chq-${Math.floor(5000 + Math.random() * 1000)}`,
        chequeNumber: dto.chequeNumber,
        bankName: dto.bankName || 'Partner Bank',
        customerName: r.customerName,
        invoiceNumber: `PAY-${Date.now().toString().slice(-4)}`,
        amountPHP: dto.amountPaidPHP,
        issueDate: new Date().toISOString().split('T')[0],
        maturityDate: dto.chequeDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        status: 'Pending',
        branch: r.branch,
      });
    }

    return mockReceivables[index];
  }
  return null;
}

export async function fetchCheques(branch?: BranchLocation, status?: ChequeStatusType): Promise<SaleChequeItem[]> {
  let filtered = [...mockCheques];
  if (branch) filtered = filtered.filter((c) => c.branch === branch);
  if (status) filtered = filtered.filter((c) => c.status === status);
  return filtered;
}

export async function updateChequeStatus(
  id: string,
  newStatus: ChequeStatusType,
  bounceReason?: string
): Promise<SaleChequeItem | null> {
  const index = mockCheques.findIndex((c) => c.id === id);
  if (index !== -1) {
    const today = new Date().toISOString().split('T')[0];
    const c = mockCheques[index];

    let updated: SaleChequeItem = {
      ...c,
      status: newStatus,
    };

    if (newStatus === 'Deposited') {
      updated.depositedDate = today;
    } else if (newStatus === 'Cleared') {
      updated.clearedDate = today;
    } else if (newStatus === 'Bounced') {
      updated.bouncedDate = today;
      updated.bounceReason = bounceReason || 'Drawn Against Insufficient Funds (DAIF)';
      updated.bouncedNoticeSent = true;

      // Update customer receivable standing if cheque bounced
      const rIdx = mockReceivables.findIndex((r) => r.customerName === c.customerName);
      if (rIdx !== -1) {
        mockReceivables[rIdx] = {
          ...mockReceivables[rIdx],
          totalOutstandingPHP: mockReceivables[rIdx].totalOutstandingPHP + c.amountPHP,
          days90PlusBalancePHP: mockReceivables[rIdx].days90PlusBalancePHP + c.amountPHP,
          status: 'Credit Blocked',
        };
      }
    }

    mockCheques[index] = updated;
    return updated;
  }
  return null;
}

// ----------------------------------------------------
// Goods Return Slips (GRS) & Product Exchanges API
// ----------------------------------------------------
let mockGoodsReturns: GoodsReturnSlip[] = [
  {
    id: 'grs-9001',
    grsNumber: 'GRS-2026-0104',
    invoiceNumber: 'INV-2026-0041',
    customerName: 'Mindanao Steelworks Corp.',
    branch: BranchLocation.Davao,
    status: 'Pending_Approval',
    totalReturnValuePHP: 127500,
    requestedBy: 'Juan Dela Cruz (Cashier)',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    notes: 'Surface oxidation observed on outer bundle edge during unloading.',
    items: [
      {
        id: 'grs-item-1',
        returnSlipId: 'grs-9001',
        batchId: '11111111-1111-1111-1111-111111111111',
        heatNumber: 'HT-2026-8841',
        grade: 'A36_Structural',
        dimensions: '12mm x 1500mm x 6000mm',
        quantityReturnedTons: 1.5,
        unitPricePerTonPHP: 85000,
        subtotalPHP: 127500,
        reason: 'Quality_Defect_Rust',
        restockEligible: false,
      },
    ],
  },
  {
    id: 'grs-9002',
    grsNumber: 'GRS-2026-0088',
    invoiceNumber: 'INV-2026-0019',
    customerName: 'Apex Industrial Builders',
    branch: BranchLocation.Cagayan,
    status: 'Approved',
    totalReturnValuePHP: 240000,
    creditNoteNumber: 'CN-2026-0033',
    requestedBy: 'Cagayan Counter Staff',
    approvedBy: 'Carlos Reyes (Branch Manager)',
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    approvedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    notes: 'Customer ordered 8mm plates instead of 10mm plates. Restocked to Yard B.',
    items: [
      {
        id: 'grs-item-2',
        returnSlipId: 'grs-9002',
        batchId: '66666666-6666-6666-6666-666666666666',
        heatNumber: 'HT-2026-1049',
        grade: 'A36_Structural',
        dimensions: '16mm x 2000mm x 12000mm',
        quantityReturnedTons: 3.0,
        unitPricePerTonPHP: 80000,
        subtotalPHP: 240000,
        reason: 'Incorrect_Specification',
        restockEligible: true,
      },
    ],
  },
];

export async function fetchGoodsReturns(branch?: BranchLocation): Promise<GoodsReturnSlip[]> {
  if (!branch) return mockGoodsReturns;
  return mockGoodsReturns.filter((g) => g.branch === branch);
}

export async function createGoodsReturn(dto: CreateGrsDto): Promise<GoodsReturnSlip> {
  const grsId = `grs-${Math.floor(9000 + Math.random() * 1000)}`;
  const totalVal = dto.items.reduce(
    (acc, i) => acc + i.quantityReturnedTons * i.unitPricePerTonPHP,
    0
  );

  const items: GoodsReturnSlipItem[] = dto.items.map((i, idx) => ({
    id: `grs-item-${Date.now()}-${idx}`,
    returnSlipId: grsId,
    batchId: i.batchId,
    heatNumber: i.heatNumber,
    grade: i.grade,
    dimensions: i.dimensions,
    quantityReturnedTons: i.quantityReturnedTons,
    unitPricePerTonPHP: i.unitPricePerTonPHP,
    subtotalPHP: i.quantityReturnedTons * i.unitPricePerTonPHP,
    reason: i.reason,
    restockEligible: i.restockEligible,
  }));

  const newGrs: GoodsReturnSlip = {
    id: grsId,
    grsNumber: `GRS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiceNumber: dto.invoiceNumber,
    customerName: dto.customerName,
    branch: dto.branch,
    status: 'Pending_Approval',
    totalReturnValuePHP: totalVal,
    requestedBy: dto.requestedBy,
    createdAt: new Date().toISOString(),
    notes: dto.notes,
    items,
  };

  mockGoodsReturns.unshift(newGrs);
  return newGrs;
}

export async function approveGoodsReturn(
  id: string,
  approverName: string
): Promise<GoodsReturnSlip | null> {
  const index = mockGoodsReturns.findIndex((g) => g.id === id);
  if (index !== -1) {
    const grs = mockGoodsReturns[index];
    const creditNoteNum = `CN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    mockGoodsReturns[index] = {
      ...grs,
      status: 'Approved',
      approvedBy: approverName,
      approvedAt: new Date().toISOString(),
      creditNoteNumber: creditNoteNum,
    };

    // Restock inventory for items marked as restockEligible
    for (const item of grs.items) {
      if (item.restockEligible) {
        const bIdx = mockBatches.findIndex((b) => b.id === item.batchId);
        if (bIdx !== -1) {
          mockBatches[bIdx] = {
            ...mockBatches[bIdx],
            weightInTons: Number((mockBatches[bIdx].weightInTons + item.quantityReturnedTons).toFixed(2)),
            status: 'Available',
          };
        }
      }
    }

    // Deduct return total from customer receivable balance if customer account exists
    const rIdx = mockReceivables.findIndex((r) => r.customerName === grs.customerName);
    if (rIdx !== -1) {
      const newTotal = Math.max(0, mockReceivables[rIdx].totalOutstandingPHP - grs.totalReturnValuePHP);
      mockReceivables[rIdx] = {
        ...mockReceivables[rIdx],
        totalOutstandingPHP: newTotal,
        currentBalancePHP: Math.max(0, mockReceivables[rIdx].currentBalancePHP - grs.totalReturnValuePHP),
      };
    }

    return mockGoodsReturns[index];
  }
  return null;
}

// ----------------------------------------------------
// Branch Network Management API & Live State
// ----------------------------------------------------
import type { BranchRecord, UpdateBranchDto } from '../types/branch';

let mockBranches: BranchRecord[] = [
  {
    id: 'branch-dvo',
    code: 'DVO',
    name: 'Davao',
    address: 'J.P. Laurel Ave, Bajada, Davao City',
    contactNumber: '(082) 221-4900',
    managerName: 'Maria Santos',
    isActive: true,
    createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
  },
  {
    id: 'branch-mnd',
    code: 'MND',
    name: 'Mandaue',
    address: 'A.C. Cortes Ave, Mandaue City, Cebu',
    contactNumber: '(032) 345-8120',
    managerName: 'Rodrigo Tan',
    isActive: true,
    createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
  },
  {
    id: 'branch-ceb',
    code: 'CEB',
    name: 'Cebu',
    address: 'North Reclamation Area, Cebu City',
    contactNumber: '(032) 231-7788',
    managerName: 'Mateo Lim',
    isActive: true,
    createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
  },
  {
    id: 'branch-cgy',
    code: 'CGY',
    name: 'Cagayan',
    address: 'CM Recto Ave, Lapasan, Cagayan de Oro City',
    contactNumber: '(088) 856-3200',
    managerName: 'Carlos Reyes',
    isActive: true,
    createdAt: new Date(Date.now() - 180 * 86400000).toISOString(),
  },
];

export async function fetchBranches(): Promise<BranchRecord[]> {
  try {
    const res = await fetch('/api/branches');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback to local mock
  }
  return [...mockBranches];
}

export async function updateBranch(id: string, dto: UpdateBranchDto): Promise<BranchRecord | null> {
  try {
    const res = await fetch(`/api/branches/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      const data = await res.json();
      const idx = mockBranches.findIndex((b) => b.id === id);
      if (idx !== -1) mockBranches[idx] = data;
      return data;
    }
  } catch {
    // fallback
  }

  const idx = mockBranches.findIndex((b) => b.id === id);
  if (idx !== -1) {
    mockBranches[idx] = {
      ...mockBranches[idx],
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    return mockBranches[idx];
  }
  return null;
}


