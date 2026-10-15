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
  ReceivablePaymentRecord,
  SaleChequeItem,
  ReceivableStats,
  ChequeStatusType,
} from '../types/receivables';
import type {
  GoodsReturnSlip,
  GoodsReturnSlipItem,
  CreateGrsDto,
  HeatLookupResult,
} from '../types/returns';
import type { ProductItem, CreateProductDto } from '../types/product';

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
  try {
    const res = await fetch('/api/stocktransfers' + (branch ? `?branch=${encodeURIComponent(branch)}` : ''));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((t: any) => ({
          id: t.transferNumber || t.id,
          sourceBranch: t.sourceBranch as BranchLocation,
          destinationBranch: t.destinationBranch as BranchLocation,
          batchId: t.batchId,
          heatNumber: t.heatNumber,
          grade: t.reason?.includes('Grade:') ? t.reason.split('Grade:')[1].trim() : 'A36_Structural',
          weightInTons: t.weightInTons,
          status: t.status === 'Pending_Approval' ? 'Pending' : t.status === 'In_Transit' ? 'InTransit' : (t.status as TransferStatus),
          requestedBy: t.requestedBy,
          approvedBy: t.approvedBy,
          createdAt: t.requestedAt || new Date().toISOString(),
          notes: t.reason,
        }));
      }
    }
  } catch {
    // fallback
  }

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
    id: `TRX-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };

  try {
    const res = await fetch('/api/stocktransfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchId: request.batchId,
        heatNumber: request.heatNumber,
        sourceBranch: request.sourceBranch,
        destinationBranch: request.destinationBranch,
        weightInTons: request.weightInTons,
        requestedBy: request.requestedBy,
        reason: `${request.notes || 'Inter-branch rebalance'} (Grade: ${request.grade})`,
      }),
    });
    if (res.ok) {
      console.log('Stock transfer saved to backend DB');
    }
  } catch {
    // fallback
  }

  mockTransfers.unshift(newTransfer);
  return newTransfer;
}

export async function updateTransferStatus(
  id: string,
  status: TransferStatus,
  approverName?: string
): Promise<StockTransferRequest | null> {
  try {
    let endpoint = `/api/stocktransfers/${id}/approve`;
    let body: any = { approverName: approverName || 'Operations Manager' };
    if (status === 'Completed') {
      endpoint = `/api/stocktransfers/${id}/receive`;
      body = {};
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      console.log('Transfer status updated in backend DB');
    }
  } catch {
    // fallback
  }

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
  try {
    const res = await fetch('/api/sales');
    if (res.ok) {
      const result = await res.json();
      if (result && Array.isArray(result.data) && result.data.length > 0) {
        const remoteTx: PosTransaction[] = result.data.map((s: any) => ({
          id: s.id,
          invoiceNumber: s.saleNumber,
          branch: (s.branch as BranchLocation) || branch || BranchLocation.Davao,
          cashierName: 'Cashier Terminal',
          customerName: s.customerName || 'Walk-in Client',
          items: [],
          totalTonnage: 1.0,
          subtotalPHP: Number(s.subTotal || s.totalAmount || 0),
          taxPHP: Number(s.taxAmount || 0),
          discountPHP: Number(s.discountAmount || 0),
          totalAmountPHP: Number(s.totalAmount || 0),
          paymentMethod:
            s.paymentMethod === 'Cheque'
              ? 'Cheque'
              : s.paymentMethod === 'Charge'
              ? 'Corporate Credit Line'
              : s.paymentMethod === 'BankTransfer'
              ? 'Bank Transfer'
              : 'Cash',
          createdAt: s.createdAt || new Date().toISOString(),
        }));
        const merged = [...mockTransactions];
        for (const r of remoteTx) {
          if (!merged.some((m) => m.invoiceNumber === r.invoiceNumber)) {
            merged.push(r);
          }
        }
        mockTransactions = merged;
      }
    }
  } catch {
    // fallback to mock
  }

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

  // Synchronize to backend database /api/sales
  try {
    const methodMap: Record<string, number> = {
      Cash: 0,
      Card: 1,
      Cheque: 2,
      'Bank Transfer': 4,
      'Corporate Credit Line': 5,
    };

    const salePayload = {
      customerName: dto.customerName,
      customerTin: dto.customerTin,
      branch: dto.branch,
      userId: dto.cashierName || 'cashier-001',
      subTotal: dto.subtotalPHP,
      discountAmount: dto.discountPHP,
      taxAmount: dto.taxPHP,
      totalAmount: dto.totalAmountPHP,
      amountPaid: dto.amountTenderedPHP ?? dto.totalAmountPHP,
      changeAmount: dto.changeDuePHP ?? 0,
      paymentMethod: methodMap[dto.paymentMethod] ?? 0,
      chequeNumber: dto.paymentMethod === 'Cheque' ? dto.referenceNumber : undefined,
      notes: dto.referenceNumber ? `Ref: ${dto.referenceNumber}` : undefined,
      items: dto.items.map((it) => ({
        productId: it.batchId,
        productName: `${it.grade} (${it.dimensions})`,
        batchId: it.batchId,
        heatNumber: it.heatNumber,
        quantity: Math.max(1, Math.round(it.quantityTons)),
        unitPrice: it.pricePerTonPHP,
        lineTotal: it.lineTotalPHP,
        weightInTons: it.quantityTons,
      })),
    };

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.saleNumber) {
        newTx.invoiceNumber = data.saleNumber;
        newTx.id = data.id || newTx.id;
      }
    }
  } catch (err) {
    console.warn('Backend /api/sales offline, maintaining client POS journal:', err);
  }

  // Deduct tonnage from inventory batches locally
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

  // If Cheque payment, automatically record in mockCheques
  if (dto.paymentMethod === 'Cheque') {
    mockCheques.unshift({
      id: `chq-${Date.now()}`,
      chequeNumber: dto.referenceNumber || `CHQ-${Math.floor(100000 + Math.random() * 900000)}`,
      bankName: 'Metrobank',
      customerName: dto.customerName,
      invoiceNumber: newTx.invoiceNumber,
      amountPHP: dto.totalAmountPHP,
      issueDate: new Date().toISOString(),
      maturityDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      status: 'Pending',
      branch: dto.branch,
    });
  }

  // If Corporate Credit Line, update customer receivables
  if (dto.paymentMethod === 'Corporate Credit Line') {
    const existingRecv = mockReceivables.find(
      (r) => r.customerName.toLowerCase() === dto.customerName.toLowerCase()
    );
    if (existingRecv) {
      existingRecv.totalOutstandingPHP += dto.totalAmountPHP;
      existingRecv.currentBalancePHP += dto.totalAmountPHP;
      existingRecv.status =
        existingRecv.totalOutstandingPHP > (existingRecv.creditLimitPHP || 3000000)
          ? 'Credit Warning'
          : 'Good Standing';
    } else {
      mockReceivables.unshift({
        id: `rec-${Date.now()}`,
        customerId: `cust-${Date.now()}`,
        customerName: dto.customerName,
        companyName: dto.customerName,
        tin: dto.customerTin || '000-000-000-000',
        creditLimitPHP: 3000000,
        totalOutstandingPHP: dto.totalAmountPHP,
        currentBalancePHP: dto.totalAmountPHP,
        days30BalancePHP: 0,
        days60BalancePHP: 0,
        days90PlusBalancePHP: 0,
        status: 'Good Standing',
        branch: dto.branch,
      });
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
    payments: [
      {
        id: 'pmt-1001',
        customerReceivableId: 'rec-001',
        amount: 150000,
        balanceBefore: 1600000,
        balanceAfter: 1450000,
        paymentDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        reference: 'OR-77291',
        paymentMethod: 'Bank Transfer',
        notes: 'Wire transfer confirmation ref #BT-889102',
        recordedByName: 'Accounting - Davao',
      },
      {
        id: 'pmt-1002',
        customerReceivableId: 'rec-001',
        amount: 250000,
        balanceBefore: 1850000,
        balanceAfter: 1600000,
        paymentDate: new Date(Date.now() - 18 * 86400000).toISOString(),
        reference: 'CHQ-BDO-0912',
        paymentMethod: 'Cheque',
        notes: 'Cleared BDO Cheque #0912',
        recordedByName: 'Accounting - Davao',
      },
    ],
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
    payments: [
      {
        id: 'pmt-1003',
        customerReceivableId: 'rec-002',
        amount: 80000,
        balanceBefore: 2930000,
        balanceAfter: 2850000,
        paymentDate: new Date(Date.now() - 25 * 86400000).toISOString(),
        reference: 'CR-11829',
        paymentMethod: 'Cash',
        notes: 'Cash payment over counter',
        recordedByName: 'Cashier - Cagayan',
      },
    ],
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
    payments: [
      {
        id: 'pmt-1004',
        customerReceivableId: 'rec-003',
        amount: 50000,
        balanceBefore: 4250000,
        balanceAfter: 4200000,
        paymentDate: new Date(Date.now() - 60 * 86400000).toISOString(),
        reference: 'PDC-MBTC-3329',
        paymentMethod: 'Cheque',
        notes: 'Partial settlement PDC',
        recordedByName: 'Accounting - Cebu',
      },
    ],
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
    payments: [
      {
        id: 'pmt-1005',
        customerReceivableId: 'rec-004',
        amount: 200000,
        balanceBefore: 1120000,
        balanceAfter: 920000,
        paymentDate: new Date(Date.now() - 7 * 86400000).toISOString(),
        reference: 'OR-99182',
        paymentMethod: 'Bank Transfer',
        notes: 'Online bank settlement',
        recordedByName: 'Accounting - Mandaue',
      },
    ],
  },
  {
    id: 'rec-005',
    customerId: 'cust-105',
    customerName: 'Southern Steel Erectors',
    companyName: 'Southern Steel & Metal Works Inc.',
    tin: '445-120-998-000',
    creditLimitPHP: 2000000,
    totalOutstandingPHP: 0,
    currentBalancePHP: 0,
    days30BalancePHP: 0,
    days60BalancePHP: 0,
    days90PlusBalancePHP: 0,
    lastPaymentDate: new Date(Date.now() - 12 * 86400000).toISOString(),
    lastPaymentAmountPHP: 450000,
    status: 'Good Standing',
    branch: BranchLocation.Davao,
    payments: [
      {
        id: 'pmt-1006',
        customerReceivableId: 'rec-005',
        amount: 450000,
        balanceBefore: 450000,
        balanceAfter: 0,
        paymentDate: new Date(Date.now() - 12 * 86400000).toISOString(),
        reference: 'OR-88491',
        paymentMethod: 'Cash',
        notes: 'Full balance liquidation completed',
        recordedByName: 'Accounting - Davao',
      },
    ],
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
  try {
    const res = await fetch('/api/receivables' + (branch ? `?branch=${encodeURIComponent(branch)}` : ''));
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.sort((a, b) => {
          const aHasBal = (a.totalOutstandingPHP ?? a.currentBalancePHP ?? 0) > 0 ? 1 : 0;
          const bHasBal = (b.totalOutstandingPHP ?? b.currentBalancePHP ?? 0) > 0 ? 1 : 0;
          if (aHasBal !== bHasBal) return bHasBal - aHasBal;
          return (b.totalOutstandingPHP ?? b.currentBalancePHP ?? 0) - (a.totalOutstandingPHP ?? a.currentBalancePHP ?? 0);
        });
      }
    }
  } catch {
    // fallback to mock
  }

  const list = branch ? mockReceivables.filter((r) => r.branch === branch) : mockReceivables;
  return [...list].sort((a, b) => {
    const aHasBal = a.totalOutstandingPHP > 0 ? 1 : 0;
    const bHasBal = b.totalOutstandingPHP > 0 ? 1 : 0;
    if (aHasBal !== bHasBal) return bHasBal - aHasBal;
    return b.totalOutstandingPHP - a.totalOutstandingPHP;
  });
}

export async function fetchReceivableStats(branch?: BranchLocation): Promise<ReceivableStats> {
  try {
    const res = await fetch('/api/receivables/stats' + (branch ? `?branch=${encodeURIComponent(branch)}` : ''));
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.totalReceivablesPHP === 'number') {
        return data;
      }
    }
  } catch {
    // fallback to mock
  }

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
  try {
    const res = await fetch(`/api/receivables/${dto.receivableId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      console.log('Payment synchronized to backend DB');
    }
  } catch {
    // Ignore network error and continue with local mock state
  }

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

    const newPaymentRecord: ReceivablePaymentRecord = {
      id: `pmt-${Date.now()}`,
      customerReceivableId: r.id,
      amount: dto.amountPaidPHP,
      balanceBefore: r.totalOutstandingPHP,
      balanceAfter: newTotal,
      paymentDate: new Date().toISOString(),
      reference: dto.referenceNumber || (dto.paymentMethod === 'Cheque' ? dto.chequeNumber : undefined),
      notes: dto.notes,
      paymentMethod: dto.paymentMethod,
      recordedByName: dto.processedBy,
    };

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
      payments: [newPaymentRecord, ...(r.payments || [])],
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
  try {
    const statusMap: Record<ChequeStatusType, number> = {
      Pending: 0,
      Deposited: 1,
      Cleared: 2,
      Bounced: 3,
      Cancelled: 4,
    };
    const params = new URLSearchParams();
    if (status) params.append('status', statusMap[status].toString());
    const res = await fetch(`/api/cheques?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const revStatusMap: Record<number, ChequeStatusType> = {
          0: 'Pending',
          1: 'Deposited',
          2: 'Cleared',
          3: 'Bounced',
          4: 'Cancelled',
        };
        const mapped: SaleChequeItem[] = data.map((item: any) => ({
          id: item.id,
          chequeNumber: item.chequeNumber,
          bankName: item.bankName,
          customerName: item.accountName || 'Industrial Customer',
          invoiceNumber: item.saleId ? `INV-${item.saleId.slice(0, 6)}` : 'INV-GEN',
          amountPHP: item.amount,
          issueDate: item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          maturityDate: item.maturityDate ? item.maturityDate.split('T')[0] : new Date().toISOString().split('T')[0],
          status: revStatusMap[item.status] || 'Pending',
          branch: (item.branch as BranchLocation) || BranchLocation.Davao,
        }));
        if (branch) {
          return mapped.filter((c) => c.branch === branch);
        }
        return mapped;
      }
    }
  } catch {
    // fallback to mock
  }

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
  const statusMap: Record<ChequeStatusType, number> = {
    Pending: 0,
    Deposited: 1,
    Cleared: 2,
    Bounced: 3,
    Cancelled: 4,
  };

  try {
    const res = await fetch(`/api/cheques/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: statusMap[newStatus],
        remarks: bounceReason,
      }),
    });
    if (res.ok) {
      console.log('Cheque status updated in database');
    }
  } catch {
    // Ignore network error and continue with local mock state
  }

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

export async function rejectGoodsReturn(
  id: string,
  rejecterName: string,
  rejectionReason: string
): Promise<GoodsReturnSlip | null> {
  try {
    const res = await fetch(`/api/goodsreturns/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejecterName, rejectionReason }),
    });
    if (res.ok) {
      console.log('Return rejection recorded in backend DB');
    }
  } catch {
    // Continue with mock update
  }

  const index = mockGoodsReturns.findIndex((g) => g.id === id);
  if (index !== -1) {
    mockGoodsReturns[index] = {
      ...mockGoodsReturns[index],
      status: 'Rejected',
      rejectedBy: rejecterName,
      rejectedAt: new Date().toISOString(),
      rejectionReason: rejectionReason,
    };
    return mockGoodsReturns[index];
  }
  return null;
}

export async function lookupHeatNumberForReturn(heatNumber: string): Promise<HeatLookupResult | null> {
  const query = heatNumber.trim().toUpperCase();
  if (!query) return null;

  try {
    const res = await fetch(`/api/goodsreturns/lookup-heat/${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.heatNumber) {
        return {
          heatNumber: data.heatNumber,
          invoiceNumber: data.invoiceNumber || 'INV-2026-0041',
          customerName: data.customerName || 'Mindanao Steelworks Corp.',
          grade: data.grade || 'A36_Structural',
          dimensions: data.dimensions || '12mm x 1500mm x 6000mm',
          purchasedQtyTons: data.purchasedQtyTons || 5.0,
          purchasedQtyPieces: data.purchasedQtyPieces || 25,
          unitPricePerTonPHP: data.unitPricePerTonPHP || 85000,
          maxReturnableTons: data.maxReturnableTons || 5.0,
        };
      }
    }
  } catch {
    // fallback to mock
  }

  const knownHeats: HeatLookupResult[] = [
    {
      heatNumber: 'HT-2026-8841',
      invoiceNumber: 'INV-2026-0041',
      customerName: 'Mindanao Steelworks Corp.',
      companyName: 'Mindanao Steelworks Corporation',
      grade: 'A36_Structural',
      dimensions: '12mm x 1500mm x 6000mm',
      purchasedQtyTons: 5.0,
      purchasedQtyPieces: 20,
      unitPricePerTonPHP: 85000,
      maxReturnableTons: 5.0,
    },
    {
      heatNumber: 'HT-2026-1049',
      invoiceNumber: 'INV-2026-0019',
      customerName: 'Apex Industrial Builders',
      companyName: 'Apex Construction & Industrial Inc.',
      grade: 'A36_Structural',
      dimensions: '16mm x 2000mm x 12000mm',
      purchasedQtyTons: 8.5,
      purchasedQtyPieces: 35,
      unitPricePerTonPHP: 80000,
      maxReturnableTons: 8.5,
    },
    {
      heatNumber: 'HT-2026-9021',
      invoiceNumber: 'INV-2026-0008',
      customerName: 'Visayas Shipyard Yard',
      companyName: 'Visayas Heavy Industries Corp.',
      grade: 'A572_Grade50',
      dimensions: '25mm x 2400mm x 6000mm',
      purchasedQtyTons: 12.0,
      purchasedQtyPieces: 15,
      unitPricePerTonPHP: 92000,
      maxReturnableTons: 12.0,
    },
    {
      heatNumber: 'HT-2026-3312',
      invoiceNumber: 'INV-2026-0033',
      customerName: 'Mandaue Heavy Equipment',
      companyName: 'Mandaue Fabrication & Supply',
      grade: 'A36_Structural',
      dimensions: '8mm x 1200mm x 6000mm',
      purchasedQtyTons: 4.2,
      purchasedQtyPieces: 40,
      unitPricePerTonPHP: 78000,
      maxReturnableTons: 4.2,
    },
  ];

  const matched = knownHeats.find((h) => h.heatNumber.toUpperCase() === query || h.heatNumber.toUpperCase().includes(query));
  if (matched) return matched;

  const batch = mockBatches.find((b) => b.heatNumber.toUpperCase() === query || b.heatNumber.toUpperCase().includes(query));
  if (batch) {
    return {
      heatNumber: batch.heatNumber,
      invoiceNumber: `INV-2026-${batch.heatNumber.slice(-4)}`,
      customerName: 'Mindanao Steelworks Corp.',
      grade: batch.grade,
      dimensions: batch.dimensions,
      purchasedQtyTons: batch.weightInTons,
      unitPricePerTonPHP: (batch as any).unitPricePHP || 45000,
      maxReturnableTons: batch.weightInTons,
    };
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

// ==========================================================================
// PRODUCTS MASTER CATALOG API
// ==========================================================================

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  productCount?: number;
}

const mockCategories: CategoryItem[] = [
  { id: 'cat-1', name: 'Structural Steel', description: 'Beams, Columns & Heavy Sections', productCount: 140 },
  { id: 'cat-2', name: 'Stainless Steel Sheet & Plate', description: 'Corrosion-Resistant Cold/Hot Rolled', productCount: 185 },
  { id: 'cat-3', name: 'Carbon Steel Plate', description: 'High-Tensile Industrial Plates', productCount: 120 },
  { id: 'cat-4', name: 'Steel Pipes & Tubing', description: 'Seamless and ERW Structural Pipes', productCount: 95 },
  { id: 'cat-5', name: 'Deformed Rebars & Wire Rods', description: 'Civil Construction Reinforcements', productCount: 105 },
];

let mockProducts: ProductItem[] = [
  {
    id: 'prod-001',
    sku: 'STL-A36-WF-200X200',
    name: 'A36 Wide Flange Structural Beam (200 x 200 mm)',
    description: 'Hot-rolled structural steel beam for building frames and bridge construction.',
    barcode: '480651200101',
    size: '200mm x 200mm',
    thickness: '8mm Web / 12mm Flange',
    length: '6000mm',
    grade: 'A36_Structural',
    unitOfMeasure: 'pc',
    unitPrice: 18500,
    costPrice: 14200,
    stockQuantity: 42,
    reorderLevel: 15,
    isActive: true,
    categoryId: 'cat-1',
    categoryName: 'Structural Steel',
    createdAt: '2026-01-10T08:00:00Z',
  },
  {
    id: 'prod-002',
    sku: 'STL-SS304-PL-6MM',
    name: 'SS304 Stainless Steel Plate 2B Finish',
    description: 'Food-grade stainless plate with superior corrosion resistance.',
    barcode: '480651200202',
    size: '1220mm x 2440mm',
    thickness: '6.0mm',
    length: '2440mm',
    grade: 'SS304_Stainless',
    unitOfMeasure: 'pc',
    unitPrice: 32400,
    costPrice: 25800,
    stockQuantity: 8,
    reorderLevel: 10,
    isActive: true,
    categoryId: 'cat-2',
    categoryName: 'Stainless Steel Sheet & Plate',
    createdAt: '2026-01-15T09:30:00Z',
  },
  {
    id: 'prod-003',
    sku: 'STL-A572-PL-25MM',
    name: 'A572 Grade 50 High-Strength Plate',
    description: 'Quenched and tempered high-yield plate for heavy earthmoving and cranes.',
    barcode: '480651200303',
    size: '2000mm x 6000mm',
    thickness: '25.0mm',
    length: '6000mm',
    grade: 'A572_HighStrength',
    unitOfMeasure: 'pc',
    unitPrice: 78900,
    costPrice: 63000,
    stockQuantity: 19,
    reorderLevel: 8,
    isActive: true,
    categoryId: 'cat-3',
    categoryName: 'Carbon Steel Plate',
    createdAt: '2026-02-01T11:00:00Z',
  },
  {
    id: 'prod-004',
    sku: 'STL-PIP-SCH40-4IN',
    name: 'ASTM A53 Seamless Steel Pipe Sch 40 (4")',
    description: 'Pressure rated seamless steel pipe for high-temperature fluid transmission.',
    barcode: '480651200404',
    size: '4-inch Nominal Bore (114.3mm OD)',
    thickness: '6.02mm (Sch 40)',
    length: '6000mm',
    grade: 'A36_Structural',
    unitOfMeasure: 'length',
    unitPrice: 12600,
    costPrice: 9400,
    stockQuantity: 3,
    reorderLevel: 12,
    isActive: true,
    categoryId: 'cat-4',
    categoryName: 'Steel Pipes & Tubing',
    createdAt: '2026-02-18T14:15:00Z',
  },
  {
    id: 'prod-005',
    sku: 'STL-REB-GR40-16MM',
    name: 'Grade 40 Deformed Reinforcing Bar (16mm x 9m)',
    description: 'Standard seismic rebars for commercial slab and foundation reinforcement.',
    barcode: '480651200505',
    size: '16mm Diameter',
    thickness: '16mm',
    length: '9000mm',
    grade: 'A36_Structural',
    unitOfMeasure: 'bundle',
    unitPrice: 14500,
    costPrice: 11200,
    stockQuantity: 65,
    reorderLevel: 25,
    isActive: true,
    categoryId: 'cat-5',
    categoryName: 'Deformed Rebars & Wire Rods',
    createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'prod-006',
    sku: 'STL-SS316-PL-8MM',
    name: 'SS316 Marine Grade Stainless Plate No. 1',
    description: 'Molybdenum-bearing stainless alloy for marine port and chemical plants.',
    barcode: '480651200606',
    size: '1500mm x 3000mm',
    thickness: '8.0mm',
    length: '3000mm',
    grade: 'SS316_Stainless',
    unitOfMeasure: 'pc',
    unitPrice: 56200,
    costPrice: 44000,
    stockQuantity: 14,
    reorderLevel: 6,
    isActive: true,
    categoryId: 'cat-2',
    categoryName: 'Stainless Steel Sheet & Plate',
    createdAt: '2026-03-12T16:20:00Z',
  },
];

export async function fetchProducts(
  search?: string,
  categoryId?: string,
  grade?: string,
  lowStockOnly?: boolean
): Promise<{ data: ProductItem[]; totalCount: number }> {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (categoryId) params.append('categoryId', categoryId);
    if (grade) params.append('grade', grade);
    if (lowStockOnly) params.append('lowStockOnly', 'true');
    params.append('pageSize', '100');

    const res = await fetch(`/api/products?${params.toString()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && json.data.length > 0) {
        return { data: json.data, totalCount: json.totalCount };
      }
    }
  } catch (err) {
    console.warn('Backend API products unreachable, using mock data:', err);
  }

  // Fallback to local mock filtering
  let filtered = [...mockProducts];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        p.sku.toLowerCase().includes(s) ||
        (p.barcode && p.barcode.toLowerCase().includes(s)) ||
        (p.grade && p.grade.toLowerCase().includes(s)) ||
        (p.size && p.size.toLowerCase().includes(s))
    );
  }
  if (categoryId) {
    filtered = filtered.filter((p) => p.categoryId === categoryId);
  }
  if (grade) {
    filtered = filtered.filter((p) => p.grade === grade);
  }
  if (lowStockOnly) {
    filtered = filtered.filter((p) => p.stockQuantity <= p.reorderLevel);
  }

  return { data: filtered, totalCount: filtered.length };
}

export async function createProduct(dto: CreateProductDto): Promise<ProductItem> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      const created = await res.json();
      mockProducts.unshift(created);
      return created;
    }
  } catch (err) {
    console.warn('Backend createProduct failed, saving locally:', err);
  }

  const category = mockCategories.find((c) => c.id === dto.categoryId);
  const newProduct: ProductItem = {
    ...dto,
    id: `prod-${Date.now()}`,
    categoryName: category?.name || 'General Steel',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  mockProducts.unshift(newProduct);
  return newProduct;
}

export async function updateProduct(
  id: string,
  dto: Partial<ProductItem>
): Promise<ProductItem | null> {
  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = mockProducts.findIndex((p) => p.id === id);
      if (idx !== -1) mockProducts[idx] = updated;
      return updated;
    }
  } catch (err) {
    console.warn('Backend updateProduct failed, updating locally:', err);
  }

  const idx = mockProducts.findIndex((p) => p.id === id);
  if (idx !== -1) {
    mockProducts[idx] = {
      ...mockProducts[idx],
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    return mockProducts[idx];
  }
  return null;
}

export async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    const res = await fetch('/api/categories');
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch {
    // fallback
  }
  return mockCategories;
}

// ==========================================================================
// USER ACCOUNTS & RBAC MANAGEMENT API
// ==========================================================================

export interface StaffUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roleId?: string;
  roleName: string;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  createdAt: string;
}

export interface CreateStaffUserDto {
  email: string;
  fullName: string;
  password?: string;
  roleId?: string;
  roleName?: string;
  branchName?: string;
  isActive?: boolean;
}

let mockStaffUsers: StaffUser[] = [
  {
    id: 'usr-1',
    email: 'owner@steeltrack.com',
    fullName: 'Alexander Vance',
    isActive: true,
    roleName: 'Owner',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'usr-2',
    email: 'manager.davao@steeltrack.com',
    fullName: 'Maria Santos',
    isActive: true,
    roleName: 'BranchManager',
    branchName: 'Davao',
    branchCode: 'DAV',
    createdAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'usr-3',
    email: 'cashier.davao@steeltrack.com',
    fullName: 'Juan Dela Cruz',
    isActive: true,
    roleName: 'Cashier',
    branchName: 'Davao',
    branchCode: 'DAV',
    createdAt: '2026-01-06T00:00:00Z',
  },
  {
    id: 'usr-4',
    email: 'manager.cagayan@steeltrack.com',
    fullName: 'Carlos Reyes',
    isActive: true,
    roleName: 'BranchManager',
    branchName: 'Cagayan',
    branchCode: 'CGY',
    createdAt: '2026-01-07T00:00:00Z',
  },
  {
    id: 'usr-5',
    email: 'cashier.cagayan@steeltrack.com',
    fullName: 'Ana Patricia Gonzales',
    isActive: true,
    roleName: 'Cashier',
    branchName: 'Cagayan',
    branchCode: 'CGY',
    createdAt: '2026-01-08T00:00:00Z',
  },
  {
    id: 'usr-6',
    email: 'manager.mandaue@steeltrack.com',
    fullName: 'Rodrigo Tan',
    isActive: true,
    roleName: 'BranchManager',
    branchName: 'Mandaue',
    branchCode: 'MND',
    createdAt: '2026-01-09T00:00:00Z',
  },
  {
    id: 'usr-7',
    email: 'cashier.mandaue@steeltrack.com',
    fullName: 'Liza Mercado',
    isActive: true,
    roleName: 'Cashier',
    branchName: 'Mandaue',
    branchCode: 'MND',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'usr-8',
    email: 'manager.cebu@steeltrack.com',
    fullName: 'Mateo Lim',
    isActive: true,
    roleName: 'BranchManager',
    branchName: 'Cebu',
    branchCode: 'CEB',
    createdAt: '2026-01-11T00:00:00Z',
  },
  {
    id: 'usr-9',
    email: 'cashier.cebu@steeltrack.com',
    fullName: 'Elena Ramos',
    isActive: true,
    roleName: 'Cashier',
    branchName: 'Cebu',
    branchCode: 'CEB',
    createdAt: '2026-01-12T00:00:00Z',
  },
];

export async function fetchStaffUsers(search?: string, branchId?: string): Promise<StaffUser[]> {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (branchId) params.append('branchId', branchId);

    const res = await fetch(`/api/users?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // fallback
  }

  let filtered = [...mockStaffUsers];
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (u) => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
    );
  }
  return filtered;
}

export async function createStaffUser(dto: CreateStaffUserDto): Promise<StaffUser> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dto.email,
        fullName: dto.fullName,
        password: dto.password || 'SteelTrack@2026',
        roleId: dto.roleId || 'role-cashier',
        isActive: dto.isActive !== false,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      mockStaffUsers.unshift(created);
      return created;
    }
  } catch (err) {
    console.warn('Backend createStaffUser failed, saving locally:', err);
  }

  const newUser: StaffUser = {
    id: `usr-${Date.now()}`,
    email: dto.email,
    fullName: dto.fullName,
    isActive: dto.isActive !== false,
    roleName: dto.roleName || 'Cashier',
    branchName: dto.branchName,
    createdAt: new Date().toISOString(),
  };
  mockStaffUsers.unshift(newUser);
  return newUser;
}

export async function toggleStaffUserStatus(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/users/${id}/status`, { method: 'PATCH' });
    if (res.ok) {
      const data = await res.json();
      const idx = mockStaffUsers.findIndex((u) => u.id === id);
      if (idx !== -1) mockStaffUsers[idx].isActive = data.isActive;
      return data.isActive;
    }
  } catch {
    // fallback
  }

  const idx = mockStaffUsers.findIndex((u) => u.id === id);
  if (idx !== -1) {
    mockStaffUsers[idx].isActive = !mockStaffUsers[idx].isActive;
    return mockStaffUsers[idx].isActive;
  }
  return false;
}

// ----------------------------------------------------
// Customer Directory & Credit Limit Setup API
// ----------------------------------------------------
import type { CustomerMaster } from '../types/suppliers';

let mockCustomerDirectory: CustomerMaster[] = [
  {
    id: 'cust-101',
    customerCode: 'CUST-DAV-001',
    customerName: 'Mindanao Steelworks Corp.',
    companyName: 'Mindanao Steelworks Corporation',
    tin: '241-890-112-000',
    address: 'Panacan Industrial Estate, Davao City',
    contactPerson: 'Engr. Roberto Dela Cruz',
    contactPhone: '+63 82 291 4000',
    contactEmail: 'purchasing@mindanaosteel.ph',
    creditLimitPHP: 5000000,
    termsDays: 30,
    status: 'Active',
    assignedBranch: BranchLocation.Davao,
    createdAt: '2025-11-10',
  },
  {
    id: 'cust-102',
    customerCode: 'CUST-CGY-004',
    customerName: 'Apex Industrial Builders',
    companyName: 'Apex Construction & Industrial Inc.',
    tin: '109-443-887-001',
    address: 'CM Recto Ave, Cagayan de Oro City',
    contactPerson: 'Clarissa Tan',
    contactPhone: '+63 88 856 9000',
    contactEmail: 'ctan@apexbuilders.ph',
    creditLimitPHP: 3000000,
    termsDays: 30,
    status: 'Active',
    assignedBranch: BranchLocation.Cagayan,
    createdAt: '2025-12-01',
  },
  {
    id: 'cust-103',
    customerCode: 'CUST-CEB-012',
    customerName: 'Visayas Shipyard Yard',
    companyName: 'Visayas Heavy Industries Corp.',
    tin: '334-112-990-000',
    address: 'MEPZ 1, Lapu-Lapu City, Cebu',
    contactPerson: 'Capt. Manuel Osmeña',
    contactPhone: '+63 32 340 8800',
    contactEmail: 'm.osmena@visayasshipyard.ph',
    creditLimitPHP: 4000000,
    termsDays: 60,
    status: 'Blocked',
    assignedBranch: BranchLocation.Cebu,
    createdAt: '2025-08-15',
  },
  {
    id: 'cust-104',
    customerCode: 'CUST-MAN-019',
    customerName: 'Mandaue Heavy Equipment',
    companyName: 'Mandaue Fabrication & Supply',
    tin: '556-991-002-000',
    address: 'Subangdaku, Mandaue City',
    contactPerson: 'Arthur Sy',
    contactPhone: '+63 32 344 1920',
    contactEmail: 'asy@mandaueheavy.ph',
    creditLimitPHP: 2500000,
    termsDays: 30,
    status: 'Active',
    assignedBranch: BranchLocation.Mandaue,
    createdAt: '2026-01-05',
  },
  {
    id: 'cust-105',
    customerCode: 'CUST-DAV-028',
    customerName: 'Southern Steel Erectors',
    companyName: 'Southern Steel & Metal Works Inc.',
    tin: '445-120-998-000',
    address: 'Toril Commercial District, Davao City',
    contactPerson: 'Grace Morales',
    contactPhone: '+63 82 299 8811',
    contactEmail: 'grace@southernsteel.ph',
    creditLimitPHP: 2000000,
    termsDays: 15,
    status: 'On Hold',
    assignedBranch: BranchLocation.Davao,
    createdAt: '2026-01-20',
  },
];

export async function fetchCustomers(branch?: BranchLocation): Promise<CustomerMaster[]> {
  try {
    const res = await fetch('/api/customers?includeInactive=true');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped: CustomerMaster[] = data.map((c: any) => ({
          id: c.id,
          customerCode: c.customerCode || `CUST-${c.id.slice(0, 4).toUpperCase()}`,
          customerName: c.name,
          companyName: c.name,
          tin: c.notes?.match(/TIN:\s*([^\s|]+)/)?.[1] || '000-000-000-000',
          address: c.address || 'Registered Office',
          contactPerson: c.name,
          contactPhone: c.phone || '-',
          contactEmail: c.email || '-',
          creditLimitPHP: c.creditLimit || 0,
          termsDays: c.paymentTerms || 30,
          status: c.isBlocked ? 'Blocked' : c.isActive ? 'Active' : 'On Hold',
          assignedBranch: BranchLocation.Davao,
          createdAt: c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
        }));
        if (branch) return mapped.filter((c) => c.assignedBranch === branch);
        return mapped;
      }
    }
  } catch {
    // fallback
  }

  const list = branch ? mockCustomerDirectory.filter((c) => c.assignedBranch === branch) : mockCustomerDirectory;
  return [...list];
}

export async function createCustomer(dto: Partial<CustomerMaster>): Promise<CustomerMaster> {
  const newCust: CustomerMaster = {
    id: `cust-${Date.now()}`,
    customerCode: dto.customerCode || `CUST-DAV-${Math.floor(100 + Math.random() * 900)}`,
    customerName: dto.customerName || 'New Customer',
    companyName: dto.companyName || dto.customerName || 'New Customer Inc.',
    tin: dto.tin || '000-000-000-000',
    address: dto.address || 'Commercial Address',
    contactPerson: dto.contactPerson || '-',
    contactPhone: dto.contactPhone || '-',
    contactEmail: dto.contactEmail || '-',
    creditLimitPHP: dto.creditLimitPHP || 1000000,
    termsDays: dto.termsDays || 30,
    status: dto.status || 'Active',
    assignedBranch: dto.assignedBranch || BranchLocation.Davao,
    createdAt: new Date().toISOString().split('T')[0],
  };

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newCust.id,
        name: newCust.customerName,
        customerCode: newCust.customerCode,
        phone: newCust.contactPhone,
        email: newCust.contactEmail,
        address: newCust.address,
        creditLimit: newCust.creditLimitPHP,
        enableCredit: true,
        paymentTerms: newCust.termsDays,
        dueDays: newCust.termsDays,
        isActive: newCust.status === 'Active',
        isBlocked: newCust.status === 'Blocked',
      }),
    });
    if (res.ok) {
      console.log('Customer saved to backend DB');
    }
  } catch {
    // fallback
  }

  mockCustomerDirectory.unshift(newCust);
  return newCust;
}

export async function updateCustomerCreditLimit(
  id: string,
  creditLimitPHP: number,
  justification?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/customers/${id}/credit-limit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditLimitPHP, justification }),
    });
    if (res.ok) {
      console.log('Credit limit synchronized to backend DB');
    }
  } catch {
    // fallback
  }

  const idx = mockCustomerDirectory.findIndex((c) => c.id === id);
  if (idx !== -1) {
    mockCustomerDirectory[idx] = {
      ...mockCustomerDirectory[idx],
      creditLimitPHP,
    };
    return true;
  }
  return false;
}

export async function updateCustomerStatus(
  id: string,
  status: 'Active' | 'On Hold' | 'Blocked'
): Promise<boolean> {
  try {
    const res = await fetch(`/api/customers/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      console.log('Customer status synchronized to backend DB');
    }
  } catch {
    // fallback
  }

  const idx = mockCustomerDirectory.findIndex((c) => c.id === id);
  if (idx !== -1) {
    mockCustomerDirectory[idx] = {
      ...mockCustomerDirectory[idx],
      status,
    };
    return true;
  }
  return false;
}





