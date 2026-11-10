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

  CreateGrsDto,

  HeatLookupResult,

} from '../types/returns';

import type { ProductItem, CreateProductDto } from '../types/product';

import type { BranchRecord, UpdateBranchDto } from '../types/branch';

import type { CustomerMaster, SupplierMaster } from '../types/suppliers';



const API_BASE_URL = '/api/inventory';



export function getAuthToken(): string | null {

  return localStorage.getItem('steeltrack_auth_token');

}



export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {

  const token = getAuthToken();

  const headers: Record<string, string> = {

    Accept: 'application/json',

    ...extraHeaders,

  };

  if (token) {

    headers['Authorization'] = `Bearer ${token}`;

  }

  return headers;

}



export function extractItems<T = any>(result: any): T[] {

  if (!result) return [];

  if (Array.isArray(result)) return result;

  if (Array.isArray(result.data)) return result.data;

  if (result.data && Array.isArray(result.data.items)) return result.data.items;

  if (result.items && Array.isArray(result.items)) return result.items;

  return [];

}



// ============================================================================

// INVENTORY & STEEL BATCHES (PostgreSQL Database Connected)

// ============================================================================



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

    if (branch && branch !== 'All') params.append('branch', branch);



    const res = await fetch(`${API_BASE_URL}?${params.toString()}`, {

      headers: getAuthHeaders(),

    });



    if (res.ok) {
      const json = await res.json();
      const rawList = extractItems<any>(json);
      if (Array.isArray(rawList)) {
        let batches: SteelBatch[] = rawList.map((b: any) => ({
          id: String(b.id || ''),
          heatNumber: b.heatNumber || b.batchCode || 'HT-2026',
          grade: b.grade || 'A36_Structural',
          weightInTons: Number(b.weightInTons ?? b.quantity ?? 0),
          dimensions: b.dimensions || 'Standard',
          status: b.status || 'In Stock',
          location: b.location || 'Warehouse Yard',
          branch: (b.branchName || b.branch || BranchLocation.Davao) as BranchLocation,
          createdAt: b.createdAt || new Date().toISOString(),
          lastUpdated: b.lastUpdated,
        }));
        if (branch && branch !== 'All') {
          batches = batches.filter((b) => b.branch === branch);
        }
        return { data: batches, isLiveBackend: true };
      }
    }
  } catch (err) {

    console.error('Error fetching inventory from database:', err);

  }



  return { data: [], isLiveBackend: false };

}



export async function fetchBranchProducts(

  search?: string,

  categoryId?: string,

  grade?: string,

  lowStockOnly?: boolean,

  branch?: BranchLocation | string

): Promise<{ data: BranchProductItem[]; totalCount: number }> {

  try {

    const params = new URLSearchParams();

    if (search) params.append('search', search);

    if (categoryId) params.append('categoryId', categoryId);

    if (grade) params.append('grade', grade);

    if (lowStockOnly) params.append('lowStockOnly', 'true');

    if (branch && branch !== 'All') params.append('branch', branch);



    // Call the dedicated BranchProducts database endpoint

    const res = await fetch(`/api/branchproducts?${params.toString()}`, {

      headers: getAuthHeaders(),

    });



    if (res.ok) {

      const json = await res.json();

      const items = extractItems<any>(json);

      if (Array.isArray(items)) {

        const mapped: BranchProductItem[] = items.map((p: any) => ({

          id: String(p.id || p.productId || ''),

          branchId: String(p.branchId || ''),

          productId: String(p.productId || ''),

          branch: (p.branchName || p.branch || 'Davao') as BranchLocation,

          sku: p.sku || p.productSku || '',

          productName: p.productName || p.name || 'Steel Product',

          productSku: p.sku || p.productSku || '',

          heatNumber: p.sku || p.productSku || '',

          sellingPrice: Number(p.sellingPrice ?? p.unitPrice ?? 0),

          defaultCostPrice: Number(p.defaultCostPrice ?? p.costPrice ?? 0),

          unitPrice: Number(p.sellingPrice ?? p.unitPrice ?? 0),

          costPrice: Number(p.defaultCostPrice ?? p.costPrice ?? 0),

          reorderLevel: Number(p.reorderLevel ?? 10),

          isAvailable: p.isAvailable !== false,

          isActive: p.isActive !== false,

          grade: p.grade || 'A36_Structural',

          unitOfMeasure: p.unitOfMeasure || 'pc',

          size: p.size,

          thickness: p.thickness,

          length: p.length,

          dimensions: p.dimensions || p.size || [p.thickness, p.length].filter(Boolean).join(' • ') || 'Standard',

          stockQuantity: Number(p.stockQuantity ?? p.currentStock ?? 20),

          currentStock: Number(p.stockQuantity ?? p.currentStock ?? 20),

          weightInTons: Number(((Number(p.stockQuantity ?? 20) * 0.1)).toFixed(2)),

          categoryName: p.categoryName || 'General Steel',

          createdAt: p.createdAt || new Date().toISOString(),

          status: p.stockQuantity <= 0 ? 'Shipped' : p.stockQuantity <= (p.reorderLevel ?? 10) ? 'QualityCheck' : 'Available',

        }));

        return { data: mapped, totalCount: json.totalCount ?? mapped.length };

      }

    }



    // Fallback to stock-list if branchproducts is unreachable

    const fallbackRes = await fetch(`${API_BASE_URL}/stock-list?${params.toString()}`, {

      headers: getAuthHeaders(),

    });

    if (fallbackRes.ok) {

      const json = await fallbackRes.json();

      const items = extractItems<any>(json) || (json.lines ?? []);

      const mapped: BranchProductItem[] = items.map((p: any) => ({

        id: String(p.id || p.batchCode || ''),

        branchId: String(p.branchId || ''),

        productId: String(p.productId || ''),

        branch: (p.branchName || p.branch || (branch && branch !== 'All' ? branch : 'Davao')) as BranchLocation,

        sku: p.productSku || p.sku || '',

        productName: p.productName || p.name || 'Steel Product',

        productSku: p.productSku || p.sku || '',

        heatNumber: p.productSku || p.sku || '',

        sellingPrice: Number(p.sellingPrice ?? 0),

        defaultCostPrice: Number(p.costPrice ?? 0),

        reorderLevel: Number(p.stockQuantity ?? 10),

        isAvailable: true,

        isActive: true,

        grade: p.grade || 'A36_Structural',

        unitOfMeasure: p.unitOfMeasure || 'pc',

        dimensions: p.dimensions || 'Standard',

        unitPrice: Number(p.sellingPrice ?? 0),

        costPrice: Number(p.costPrice ?? 0),

        stockQuantity: Number(p.remainingQuantity ?? p.stockQuantity ?? 20),

        currentStock: Number(p.remainingQuantity ?? p.stockQuantity ?? 20),

        weightInTons: Number(((Number(p.remainingQuantity ?? p.stockQuantity ?? 20) * 0.1)).toFixed(2)),

        categoryName: p.categoryName || '',

        createdAt: p.createdAt || '',

        status: 'Available',

      }));

      return { data: mapped, totalCount: json.totalCount ?? mapped.length };

    }

  } catch (err) {

    console.error('Error fetching branch products from database:', err);

  }



  return { data: [], totalCount: 0 };

}



export async function fetchStats(branch?: BranchLocation | string): Promise<InventoryStats> {

  try {

    const url = branch && branch !== 'All' ? `${API_BASE_URL}/stock-list` : `${API_BASE_URL}/stock-list`;

    const res = await fetch(url, { headers: getAuthHeaders() });

    if (res.ok) {

      const json = await res.json();

      const items = extractItems(json);

      if (Array.isArray(items)) {

        return {

          totalBatches: json.totalCount ?? items.length,

          totalTonnage: Number(items.reduce((sum, i) => sum + (Number(i.stockQuantity ?? 0) * 1), 0).toFixed(2)),

          inProductionCount: items.filter((i) => i.grade === 'InProduction').length,

          qualityCheckCount: items.filter((i) => i.grade === 'QualityCheck').length,

          availableCount: items.filter((i) => i.isAvailable !== false).length,

          shippedCount: items.filter((i) => i.grade === 'Shipped').length,

        };

      }

    }

  } catch (err) {

    console.warn('Backend API stats endpoint unreachable, computing from live branch products:', err);

  }



  const { data } = await fetchBranchProducts(undefined, undefined, undefined, undefined, branch);

  const activeRows = data.filter((r) => r.isActive !== false && r.isActive !== undefined);

  return {

    totalBatches: data.length,

    totalTonnage: Number(activeRows.reduce((sum, r) => sum + (Number(r.stockQuantity ?? 0)), 0).toFixed(2)),

    inProductionCount: data.filter((r) => r.grade === 'InProduction').length,

    qualityCheckCount: data.filter((r) => r.grade === 'QualityCheck').length,

    availableCount: data.filter((r) => r.isAvailable !== false).length,

    shippedCount: data.filter((r) => r.grade === 'Shipped').length,

  };

}



export async function createBatch(dto: CreateSteelBatchDto): Promise<SteelBatch> {

  const res = await fetch(API_BASE_URL, {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(dto),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to create steel batch in database: ${errorText || res.statusText}`);

  }



  return await res.json();

}



export async function updateBatchStatus(

  id: string,

  dto: UpdateBatchStatusDto

): Promise<SteelBatch | null> {

  const res = await fetch(`${API_BASE_URL}/${id}/status`, {

    method: 'PUT',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(dto),

  });



  if (!res.ok) {

    throw new Error(`Failed to update batch status in database: ${res.statusText}`);

  }



  return await res.json();

}



// ============================================================================

// INTER-BRANCH STOCK TRANSFERS (PostgreSQL Database Connected)

// ============================================================================



export async function fetchTransfers(branch?: BranchLocation | 'All' | string): Promise<StockTransferRequest[]> {

  try {

    const url = '/api/stocktransfers' + (branch && branch !== 'All' ? `?branch=${encodeURIComponent(branch)}` : '');

    const res = await fetch(url, { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        return data.map((t: any) => ({

          id: String(t.id),

          transferNumber: t.transferNumber || t.id,

          sourceBranch: t.sourceBranch as BranchLocation,

          destinationBranch: t.destinationBranch as BranchLocation,

          batchId: t.batchId,

          heatNumber: t.heatNumber,

          grade: t.reason?.includes('Grade:') ? t.reason.split('Grade:')[1].replace(')', '').trim() : (t.grade || 'A36_Structural'),

          weightInTons: Number(t.weightInTons || 0),

          status: (t.status === 'Pending_Approval' || t.status === 'Pending' ? 'Pending' :

            t.status === 'In_Transit' || t.status === 'InTransit' ? 'InTransit' :

              t.status === 'Approved' ? 'Approved' :

                t.status === 'Completed' ? 'Completed' :

                  t.status === 'Rejected' ? 'Rejected' : t.status) as TransferStatus,

          requestedBy: t.requestedBy,

          approvedBy: t.approvedBy,

          createdAt: t.requestedAt || t.createdAt || new Date().toISOString(),

          notes: t.reason || t.notes,

        }));

      }

    }

  } catch (err) {

    console.error('Error loading stock transfers from database:', err);

  }



  return [];

}



export async function createTransferRequest(

  request: Omit<StockTransferRequest, 'id' | 'createdAt' | 'status'>

): Promise<StockTransferRequest> {

  const payload = {

    batchId: request.batchId,

    heatNumber: request.heatNumber,

    sourceBranch: request.sourceBranch,

    destinationBranch: request.destinationBranch,

    weightInTons: request.weightInTons,

    requestedBy: request.requestedBy,

    reason: `${request.notes || 'Inter-branch rebalance'} (Grade: ${request.grade})`,

  };



  const res = await fetch('/api/stocktransfers', {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(payload),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to create stock transfer: ${errorText || res.statusText}`);

  }



  const data = await res.json();

  return {

    ...request,

    id: data.transferNumber || data.id,

    status: 'Pending',

    createdAt: data.requestedAt || new Date().toISOString(),

  };

}



export async function updateTransferStatus(

  id: string,

  status: TransferStatus,

  approverName?: string

): Promise<StockTransferRequest | null> {

  let endpoint = `/api/stocktransfers/${encodeURIComponent(id)}/approve`;

  let body: any = { approverName: approverName || 'Operations Manager' };



  if (status === 'InTransit') {

    endpoint = `/api/stocktransfers/${encodeURIComponent(id)}/dispatch`;

    body = {};

  } else if (status === 'Completed') {

    endpoint = `/api/stocktransfers/${encodeURIComponent(id)}/receive`;

    body = {};

  } else if (status === 'Rejected') {

    endpoint = `/api/stocktransfers/${encodeURIComponent(id)}/reject`;

    body = { rejectionReason: 'Transfer cancelled' };

  }



  const res = await fetch(endpoint, {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(body),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to update transfer status: ${errorText || res.statusText}`);

  }



  const data = await res.json();

  return {

    id: String(data.id || id),

    transferNumber: data.transferNumber || id,

    sourceBranch: data.sourceBranch as BranchLocation,

    destinationBranch: data.destinationBranch as BranchLocation,

    batchId: data.batchId,

    heatNumber: data.heatNumber,

    grade: data.grade || 'A36_Structural',

    weightInTons: Number(data.weightInTons || 0),

    status,

    requestedBy: data.requestedBy,

    approvedBy: approverName || data.approvedBy,

    createdAt: data.requestedAt || new Date().toISOString(),

  };

}



// ============================================================================

// POS CASHIER TRANSACTIONS & SALES (PostgreSQL Database Connected)

// ============================================================================



export async function fetchPosTransactions(branch?: BranchLocation | 'All' | string): Promise<PosTransaction[]> {
  try {
    const params = new URLSearchParams();
    if (branch && branch !== 'All') {
      params.append('branch', branch);
    }
    const url = params.toString() ? `/api/sales?${params.toString()}` : '/api/sales';
    const res = await fetch(url, { headers: getAuthHeaders() });

    if (res.ok) {
      const result = await res.json();
      const rawSales = extractItems(result);

      const remoteTx: PosTransaction[] = rawSales.map((s: any) => {
        let mappedMethod: PosTransaction['paymentMethod'] = 'Cash';
        const pm = s.paymentMethod;
        if (pm === 5 || pm === 'Split' || pm === 'Split Payment') mappedMethod = 'Split Payment';
        else if (pm === 4 || pm === 'Cheque') mappedMethod = 'Cheque';
        else if (pm === 3 || pm === 'Charged' || pm === 'Corporate Credit Line') mappedMethod = 'Corporate Credit Line';
        else if (pm === 2 || pm === 'OnlineBank' || pm === 'Bank Transfer') mappedMethod = 'Bank Transfer';
        else if (pm === 1 || pm === 'QRPH' || pm === 'Card') mappedMethod = 'Card';
        else mappedMethod = 'Cash';

        const totalTons = Array.isArray(s.items) && s.items.length > 0
          ? s.items.reduce((acc: number, it: any) => acc + (Number(it.weightInTons || it.quantity || 1)), 0)
          : Number(s.totalTonnage || 1.0);

        return {
          id: s.id,
          invoiceNumber: s.saleNumber || `INV-${s.id?.slice(0, 8)}`,
          branch: ((s.branch || (branch && branch !== 'All' ? branch : undefined) || BranchLocation.Davao) as BranchLocation),
          cashierName: s.cashierName || s.userName || 'Cashier Terminal',
          customerName: s.customerName || 'Walk-in Client',
          customerTin: s.customerTin,
          items: Array.isArray(s.items)
            ? s.items.map((it: any) => ({
              id: it.id,
              batchId: it.productBatchId || it.batchId || it.productId,
              heatNumber: it.batchCode || it.heatNumber || 'HT-N/A',
              grade: it.productName || 'A36_Structural',
              dimensions: it.dimensions || 'Standard',
              location: 'Main Yard',
              availableTons: Number(it.quantity || 1),
              quantityTons: Number(it.weightInTons || it.quantity || 1),
              pricePerTonPHP: Number(it.sellingPriceAtSale || it.unitPrice || 0),
              lineTotalPHP: Number(it.lineTotal || 0),
            }))
            : [],
          totalTonnage: Number(totalTons.toFixed(2)),
          subtotalPHP: Number(s.subTotal || s.totalAmount || 0),
          taxPHP: Number(s.taxAmount || 0),
          discountPHP: Number(s.discountAmount || 0),
          totalAmountPHP: Number(s.totalAmount || 0),
          paymentMethod: mappedMethod,
          referenceNumber: s.payment?.bankReferenceNumber || s.payment?.qrphReference || s.cheque?.chequeNumber || s.referenceNumber,
          createdAt: s.createdAt || new Date().toISOString(),
        };
      });

      if (branch && branch !== 'All') {
        const cleanBranch = branch.toLowerCase();
        return remoteTx.filter((t) => t.branch.toLowerCase().includes(cleanBranch) || cleanBranch.includes(t.branch.toLowerCase()));
      }

      return remoteTx;
    }
  } catch (err) {
    console.error('Error fetching sales from database:', err);
  }

  return [];
}

export async function processPosSale(
  dto: Omit<PosTransaction, 'id' | 'invoiceNumber' | 'createdAt'>
): Promise<PosTransaction> {
  const methodMap: Record<string, number> = {
    Cash: 0,
    Card: 1,
    'Bank Transfer': 2,
    'Corporate Credit Line': 3,
    Cheque: 4,
    'Split Payment': 5,
  };

  const isSplit = dto.paymentMethod === 'Split Payment' || (dto.splitTenders && dto.splitTenders.length > 0);
  const paymentMethodInt = methodMap[dto.paymentMethod] ?? 0;

  // Build split tenders payload if split payment
  let splitPaymentsPayload: any[] | undefined = undefined;
  if (isSplit && dto.splitTenders && dto.splitTenders.length > 0) {
    splitPaymentsPayload = dto.splitTenders.map((t) => {
      const mInt = methodMap[t.method] ?? 0;
      return {
        method: mInt,
        amount: t.amount,
        qrphReference: t.method === 'Card' ? t.referenceNumber || 'CARD-REF' : undefined,
        onlineBank: t.method === 'Bank Transfer' ? {
          bankName: 'Commercial Bank',
          branch: dto.branch || 'Main',
          referenceNumber: t.referenceNumber || 'BANK-REF',
          senderName: dto.customerName || 'Customer',
          datePaid: new Date().toISOString(),
        } : undefined,
        cheque: t.method === 'Cheque' ? {
          bankName: 'Commercial Bank',
          branch: dto.branch || 'Main',
          chequeNumber: t.referenceNumber || 'CHQ-001',
          accountName: dto.customerName || 'Customer',
          type: 0,
          maturityDate: new Date().toISOString(),
        } : undefined,
        dueDate: t.method === 'Corporate Credit Line' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
      };
    });
  }

  const salePayload: any = {
    branch: dto.branch,
    customerName: dto.customerName,
    customerTin: dto.customerTin,
    subTotal: dto.subtotalPHP,
    discountAmount: dto.discountPHP,
    taxAmount: dto.taxPHP,
    totalAmount: dto.totalAmountPHP,
    amountPaid: isSplit
      ? (dto.amountTenderedPHP ?? dto.totalAmountPHP)
      : dto.paymentMethod === 'Cash'
        ? (dto.amountTenderedPHP ?? dto.totalAmountPHP)
        : dto.totalAmountPHP,
    changeAmount: dto.changeDuePHP ?? 0,
    paymentMethod: isSplit ? 5 : paymentMethodInt,
    notes: dto.referenceNumber ? `Ref: ${dto.referenceNumber}` : undefined,
    items: dto.items.map((it) => ({
      productId: it.productId || it.batchId,
      productBatchId: it.batchId && it.batchId !== it.productId ? it.batchId : undefined,
      quantity: Math.max(1, Math.round(it.quantityTons)),
      discount: 0,
    })),
  };

  if (isSplit && splitPaymentsPayload) {
    salePayload.payments = splitPaymentsPayload;
  } else {
    if (dto.paymentMethod === 'Card') {
      salePayload.qrphReference = dto.referenceNumber || 'CARD-REF';
    } else if (dto.paymentMethod === 'Bank Transfer') {
      salePayload.onlineBank = {
        bankName: 'Commercial Bank',
        branch: dto.branch || 'Main',
        referenceNumber: dto.referenceNumber || 'BANK-REF',
        senderName: dto.customerName || 'Customer',
        datePaid: new Date().toISOString(),
      };
    } else if (dto.paymentMethod === 'Cheque') {
      salePayload.cheque = {
        bankName: 'Commercial Bank',
        branch: dto.branch || 'Main',
        chequeNumber: dto.referenceNumber || 'CHQ-001',
        accountName: dto.customerName || 'Customer',
        type: 0,
        maturityDate: new Date().toISOString(),
      };
    } else if (dto.paymentMethod === 'Corporate Credit Line') {
      salePayload.dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  const res = await fetch('/api/sales', {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(salePayload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let parsedMessage = errorText;
    try {
      const errJson = JSON.parse(errorText);
      const errList = Array.isArray(errJson.errors) ? errJson.errors.filter(Boolean).join('; ') : errJson.errors;
      parsedMessage = errJson.message || errList || errJson.title || errorText;
    } catch {
      // keep errorText
    }
    throw new Error(parsedMessage);
  }

  const createdSale = await res.json();
  const s = createdSale.data ?? createdSale;

  return {
    ...dto,
    id: s.id || `pos-${Date.now()}`,
    invoiceNumber: s.saleNumber || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: s.createdAt || new Date().toISOString(),
  };
}



export interface PosBatchItem {
  batchId: string;
  batchCode: string;
  quantity: number;
  costPrice: number;
  batchSellingPrice: number;
  branchSellingPrice: number;
  sellingPrice: number;
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  isAvailable: boolean;
  isActive: boolean;
  branchId: string;
  dimensions: string;
  grade: string;
  unitOfMeasure: string;
  receivedDate?: string;
  createdAt?: string;
  isOldStock?: boolean;
  fifoPriority?: boolean;
  fifoRank?: number;
  fifoStatus?: string;
}

export interface CrossBranchStockItem {
  branchId: string;
  branchName: string;
  branchCode: string;
  stockQuantity: number;
  sellingPrice: number;
  defaultCostPrice: number;
  reorderLevel: number;
  isAvailable: boolean;
  isActive: boolean;
  batchCount: number;
  oldestBatch?: string;
  oldestBatchReceivedDate?: string;
  batches: Array<{
    batchId: string;
    batchCode: string;
    quantity: number;
    sellingPrice: number;
    costPrice: number;
    receivedDate?: string;
  }>;
}

export interface CrossBranchStockResponse {
  success: boolean;
  productId: string;
  productName: string;
  sku: string;
  grade: string;
  categoryName: string;
  dimensions: string;
  unitOfMeasure: string;
  totalNetworkStock: number;
  branches: CrossBranchStockItem[];
}

export async function fetchCrossBranchStock(productId: string): Promise<CrossBranchStockResponse | null> {
  try {
    const res = await fetch(`/api/branchproducts/cross-branch-stock/${productId}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed fetching cross-branch stock:', err);
  }
  return null;
}

export async function fetchPosBatches(
  branch?: BranchLocation | string,
  category?: string,
  search?: string
): Promise<{ data: PosBatchItem[]; totalCount: number }> {
  try {
    const params = new URLSearchParams();
    if (branch && branch !== 'All') params.append('branch', branch);
    if (category && category !== 'All') params.append('category', category);
    if (search) params.append('search', search);

    const res = await fetch(`/api/branchproducts/pos-batches?${params.toString()}`, {
      headers: getAuthHeaders(),
    });

    if (res.ok) {
      const json = await res.json();
      const raw = extractItems<PosBatchItem>(json);
      return { data: raw, totalCount: json.totalCount ?? raw.length };
    }
  } catch (err) {
    console.error('Failed to fetch POS batches:', err);
  }
  return { data: [], totalCount: 0 };
}

// ============================================================================

// DEMAND FORECAST & ANALYTICS (Live DB Aggregations)

// ============================================================================



/** A forecast row as returned by GET /api/products/lstm-forecast. */

import type { BranchProductItem } from '../types/steel';



export interface LstmForecastRow {

  productId: string;

  productSku: string;

  productName: string;

  categoryId: string;

  categoryName: string;

  parentCategoryId?: string | null;

  parentCategoryName?: string | null;

  /** Format: "YYYY-MM" */

  month: string;

  predictedQuantity: number;

  predictedRevenue: number;

  /** 0..1 — how tight the confidence band is around the point forecast. */

  confidenceInterval: number;

  /** Lower bound of the 95% confidence band, in units. */

  confidenceLower: number;

  /** Upper bound of the 95% confidence band, in units. */

  confidenceUpper: number;

  /** Units actually sold in this month. Zero for months that have not happened. */

  actualQuantity: number;

  trend: 'up' | 'down' | 'stable';

  /**

   * Which engine produced the row:

   *   "lstm"          — served by the trained model

   *   "seasonal_naive" — the forecasting service fell back for a series

   *                      with no trained model

   *   "fallback"      — the forecasting service was unreachable and the

   *                      legacy seasonal estimate was used

   */

  source: 'lstm' | 'seasonal_naive' | 'fallback' | 'unknown';

  modelVersion: string;

  serviceFallback: boolean;

  sourceMismatchCount: number;

  currentStock: number;

  reorderLevel: number;

  recommendedRestock: number;

  planningStatus: 'Restock Needed' | 'Optimal' | 'Overstocked';

  // Post-LSTM Rule-Based Decision Support System (Section 2.3.2.2)

  projectedAvailableStock?: number;

  incomingStock?: number;

  reservedStock?: number;

  safetyStock?: number;

  requiredStock?: number;

  netInventoryRequirement?: number;

  excessStock?: number;

  transferQuantity?: number;

  procurementQuantity?: number;

  decisionRule?: string;

  donorBranch?: string;

  recipientBranch?: string;

}



export interface LstmForecastResponse {

  count: number;

  modelVersion: string;

  serviceReachable: boolean;

  serviceFallback: boolean;

  sourceMismatchCount: number;

  /** Rows in the window served by the trained model. */

  modelServedCount: number;

  /** Rows in the window served by the legacy seasonal estimate. */

  fallbackCount: number;

  /**

   * HTTP status the forecasting service answered with, or null when it never

   * answered at all. 401 means it rejected the shared API key; 503 means it

   * has no trained model; 5xx means it failed.

   */

  serviceStatusCode: number | null;

  /** Short excerpt of the forecasting service's error message, when it failed. */

  serviceError: string | null;

  /** Rows in the forecast region of the window (the months the model can forecast). */

  forecastWindowCount: number;

  /** Forecast-region rows that fell back to the legacy estimate. */

  forecastFallbackCount: number;

  forecasts: LstmForecastRow[];

}



/**

 * Why a forecast request failed. Each cause needs a different message — a

 * blanket "the API did not respond" is wrong for all but one of them.

 */

export type LstmForecastFailureKind =

  | 'unauthorized'

  | 'forbidden'

  | 'not_found'

  | 'bad_request'

  | 'server_error'

  | 'network'

  | 'malformed';



export type LstmForecastResult =

  | { ok: true; data: LstmForecastResponse; message?: string }

  | {

    ok: false;

    kind: LstmForecastFailureKind;

    status?: number;

    message: string;

    reason?: string;

  };



/**

 * Fetch the demand forecast from the .NET API, which delegates to the

 * Python LSTM forecasting service.

 *

 * Returns a discriminated result rather than null, so the caller can tell

 * an expired session from a server error from an unreachable API and say

 * something true about each.

 */

export async function fetchLstmForecast(
  fromMonth: string,
  toMonth: string,
  categoryId?: string,
  branchId?: string,
  modelVersion?: string
): Promise<LstmForecastResult> {
  const params = new URLSearchParams();
  const normalizedFrom = fromMonth.length === 7 ? `${fromMonth}-01` : fromMonth;
  const normalizedTo = toMonth.length === 7 ? `${toMonth}-01` : toMonth;
  params.append('fromMonth', normalizedFrom);
  params.append('toMonth', normalizedTo);
  if (categoryId) params.append('categoryId', categoryId);
  if (branchId) params.append('branchId', branchId);
  if (modelVersion) params.append('modelVersion', modelVersion);



  let res: Response;

  try {

    res = await fetch(`/api/products/lstm-forecast?${params.toString()}`, {

      headers: getAuthHeaders(),

    });

  } catch {

    // The request never completed: the API is not reachable at all.

    return {

      ok: false,

      kind: 'network',

      message:

        'Could not reach the .NET API. The browser could not complete the request — confirm the API is running and reachable.',

    };

  }



  if (!res.ok) {

    let serverMessage: string | undefined;

    let reason: string | undefined;

    try {

      const body = await res.json();

      serverMessage = body?.message;

      reason = body?.reason;

    } catch {

      // A non-JSON error body; the status alone still tells us something.

    }



    const detail = serverMessage ? ` ${serverMessage}` : '';



    if (res.status === 401) {

      return {

        ok: false,

        kind: 'unauthorized',

        status: res.status,

        reason,

        message:

          'Your session has ended. Sign in again to view the demand forecast.',

      };

    }



    if (res.status === 403) {

      return {

        ok: false,

        kind: 'forbidden',

        status: res.status,

        reason,

        message:

          'Your account does not have permission to view the demand forecast.',

      };

    }



    if (res.status === 404) {

      return {

        ok: false,

        kind: 'not_found',

        status: res.status,

        message:

          'The forecast endpoint was not found (HTTP 404). The frontend and the .NET API are out of sync.',

      };

    }



    if (res.status === 400) {

      return {

        ok: false,

        kind: 'bad_request',

        status: res.status,

        message: `The API rejected the forecast request (HTTP 400).${detail}`,

      };

    }



    if (res.status >= 500) {

      return {

        ok: false,

        kind: 'server_error',

        status: res.status,

        message: `The .NET API failed while building the forecast (HTTP ${res.status}).${detail} Check the API logs.`,

      };

    }



    return {

      ok: false,

      kind: 'bad_request',

      status: res.status,

      message: `The API rejected the forecast request (HTTP ${res.status}).${detail}`,

    };

  }



  let json: any;

  try {

    json = await res.json();

  } catch {

    return {

      ok: false,

      kind: 'malformed',

      status: res.status,

      message:

        'The .NET API returned a response the frontend could not read as JSON.',

    };

  }



  const data = json?.data;

  if (!data) {

    return {

      ok: false,

      kind: 'malformed',

      status: res.status,

      message: json?.message

        ? `The .NET API returned no forecast data. ${json.message}`

        : 'The .NET API returned no forecast data.',

    };

  }



  return {

    ok: true,

    data: {

      count: data.count ?? 0,

      modelVersion: data.modelVersion ?? 'unknown',

      serviceReachable: data.serviceReachable ?? false,

      serviceFallback: data.serviceFallback ?? true,

      sourceMismatchCount: data.sourceMismatchCount ?? 0,

      modelServedCount: data.modelServedCount ?? 0,

      fallbackCount: data.fallbackCount ?? 0,

      serviceStatusCode: data.serviceStatusCode ?? null,

      serviceError: data.serviceError ?? null,

      forecastWindowCount: data.forecastWindowCount ?? 0,

      forecastFallbackCount: data.forecastFallbackCount ?? 0,

      forecasts: Array.isArray(data.forecasts) ? data.forecasts : [],

    },

  };

}



// ============================================================================

// CUSTOMER RECEIVABLES (A/R) & PDC CHEQUES (PostgreSQL Database Connected)

// ============================================================================



export async function fetchReceivables(branch?: BranchLocation | 'All' | string): Promise<CustomerReceivable[]> {

  try {

    const url = '/api/receivables' + (branch && branch !== 'All' ? `?branch=${encodeURIComponent(branch)}` : '');

    const res = await fetch(url, { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        return data.map((r: any) => ({

          id: r.id,

          customerId: r.customerId,

          customerName: r.customerName || r.name,

          companyName: r.companyName || r.customerName || r.name,

          tin: r.tin || '000-000-000-000',

          creditLimitPHP: Number(r.creditLimitPHP || r.creditLimit || 0),

          totalOutstandingPHP: Number(r.totalOutstandingPHP || r.totalOutstanding || 0),

          currentBalancePHP: Number(r.currentBalancePHP || r.currentBalance || 0),

          days30BalancePHP: Number(r.days30BalancePHP || r.days30 || 0),

          days60BalancePHP: Number(r.days60BalancePHP || r.days60 || 0),

          days90PlusBalancePHP: Number(r.days90PlusBalancePHP || r.days90Plus || 0),

          lastPaymentDate: r.lastPaymentDate,

          lastPaymentAmountPHP: Number(r.lastPaymentAmountPHP || 0),

          status: r.status || (r.totalOutstandingPHP > r.creditLimitPHP ? 'Credit Warning' : 'Good Standing'),

          branch: (r.branch as BranchLocation) || BranchLocation.Davao,

          payments: Array.isArray(r.payments)

            ? r.payments.map((p: any) => ({

              id: p.id,

              customerReceivableId: p.customerReceivableId || r.id,

              amount: Number(p.amount || 0),

              balanceBefore: Number(p.balanceBefore || 0),

              balanceAfter: Number(p.balanceAfter || 0),

              paymentDate: p.paymentDate || p.createdAt,

              reference: p.reference,

              paymentMethod: p.paymentMethod || 'Cash',

              notes: p.notes,

              recordedByName: p.recordedByName || 'Accounting',

            }))

            : [],

        })).sort((a, b) => b.totalOutstandingPHP - a.totalOutstandingPHP);

      }

    }

  } catch (err) {

    console.error('Error fetching receivables from database:', err);

  }



  return [];

}



export async function fetchReceivableStats(branch?: BranchLocation | 'All' | string): Promise<ReceivableStats> {

  try {

    const url = '/api/receivables/stats' + (branch && branch !== 'All' ? `?branch=${encodeURIComponent(branch)}` : '');

    const res = await fetch(url, { headers: getAuthHeaders() });

    if (res.ok) {

      const data = await res.json();

      if (data && typeof data.totalReceivablesPHP === 'number') {

        return data;

      }

    }

  } catch (err) {

    console.warn('Error fetching receivable stats from backend:', err);

  }



  const list = await fetchReceivables(branch);

  const cheques = await fetchCheques(branch);



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

  const res = await fetch(`/api/receivables/${dto.receivableId}/pay`, {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(dto),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to record receivable payment in database: ${errorText || res.statusText}`);

  }



  return await res.json();

}



export async function fetchCheques(branch?: BranchLocation | 'All' | string, status?: ChequeStatusType): Promise<SaleChequeItem[]> {

  try {

    const statusMap: Record<ChequeStatusType, number> = {
      Pending: 0,
      Cleared: 1,
      Bounced: 2,
      Deposited: 3,
      Cancelled: 4,
    };

    const params = new URLSearchParams();

    if (status) params.append('status', statusMap[status].toString());

    if (branch && branch !== 'All') params.append('branch', branch);



    const res = await fetch(`/api/cheques?${params.toString()}`, { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        const revStatusMap: Record<number, ChequeStatusType> = {
          0: 'Pending',
          1: 'Cleared',
          2: 'Bounced',
          3: 'Deposited',
          4: 'Cancelled',
        };

        const mapped: SaleChequeItem[] = data.map((item: any) => ({

          id: item.id,

          chequeNumber: item.chequeNumber,

          bankName: item.bankName,

          customerName: item.accountName || item.customerName || 'Industrial Customer',

          invoiceNumber: item.saleId ? `INV-${item.saleId.slice(0, 6)}` : (item.invoiceNumber || 'INV-GEN'),

          amountPHP: Number(item.amount || 0),

          issueDate: item.createdAt ? item.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],

          maturityDate: item.maturityDate ? item.maturityDate.split('T')[0] : new Date().toISOString().split('T')[0],

          status: revStatusMap[item.status] || item.status || 'Pending',

          branch: (item.branch as BranchLocation) || BranchLocation.Davao,

          depositedDate: item.depositedDate,

          clearedDate: item.clearedDate,

          bouncedDate: item.bouncedDate,

          bounceReason: item.bounceReason || item.remarks,

        }));



        if (branch && branch !== 'All') {

          return mapped.filter((c) => c.branch === branch);

        }

        return mapped;

      }

    }

  } catch (err) {

    console.error('Error loading cheques from database:', err);

  }



  return [];

}



export async function updateChequeStatus(

  id: string,

  newStatus: ChequeStatusType,

  bounceReason?: string

): Promise<SaleChequeItem | null> {

  const statusMap: Record<ChequeStatusType, number> = {
    Pending: 0,
    Cleared: 1,
    Bounced: 2,
    Deposited: 3,
    Cancelled: 4,
  };



  const res = await fetch(`/api/cheques/${id}/status`, {

    method: 'PUT',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify({

      status: statusMap[newStatus],

      remarks: bounceReason,

    }),

  });



  if (!res.ok) {

    throw new Error(`Failed to update cheque status: ${res.statusText}`);

  }



  return await res.json();

}



// ============================================================================

// GOODS RETURN SLIPS (GRS) & EXCHANGES (PostgreSQL Database Connected)

// ============================================================================



export async function fetchGoodsReturns(branch?: BranchLocation | 'All' | string): Promise<GoodsReturnSlip[]> {

  try {

    const url = '/api/goodsreturns' + (branch && branch !== 'All' ? `?branch=${encodeURIComponent(branch)}` : '');

    const res = await fetch(url, { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        return data.map((g: any) => ({

          id: g.id,

          grsNumber: g.grsNumber,

          invoiceNumber: g.invoiceNumber,

          customerName: g.customerName,

          branch: (g.branch as BranchLocation) || BranchLocation.Davao,

          status: g.status || 'Pending_Approval',

          totalReturnAmount: Number(g.totalReturnAmount ?? g.totalReturnValuePHP ?? 0),
          totalReturnValuePHP: Number(g.totalReturnAmount ?? g.totalReturnValuePHP ?? 0),

          creditNoteNumber: g.creditNoteNumber,

          requestedBy: g.requestedBy,

          approvedBy: g.approvedBy,

          approvedAt: g.approvedAt,

          rejectedBy: g.rejectedBy,

          rejectedAt: g.rejectedAt,

          rejectionReason: g.rejectionReason,

          createdAt: g.createdAt || new Date().toISOString(),

          notes: g.notes,

          items: Array.isArray(g.items)

            ? g.items.map((it: any, idx: number) => ({

              id: it.id || `grs-item-${idx}`,

              returnSlipId: g.id,

              batchId: it.batchId,

              heatNumber: it.heatNumber,

              grade: it.grade,

              dimensions: it.dimensions,

              quantityReturnedTons: Number(it.quantityReturnedTons || 0),

              unitPricePerTonPHP: Number(it.unitPricePerTonPHP || 0),

              subtotalPHP: Number(it.subtotalPHP || 0),

              reason: it.reason || 'Specification Discrepancy',

              restockEligible: Boolean(it.restockEligible),

            }))

            : [],

        }));

      }

    }

  } catch (err) {

    console.error('Error fetching goods returns from database:', err);

  }



  return [];

}



export async function createGoodsReturn(dto: CreateGrsDto): Promise<GoodsReturnSlip> {

  const res = await fetch('/api/goodsreturns', {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(dto),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to create goods return slip in database: ${errorText || res.statusText}`);

  }



  return await res.json();

}



export async function approveGoodsReturn(

  id: string,

  approverName: string

): Promise<GoodsReturnSlip | null> {

  const res = await fetch(`/api/goodsreturns/${id}/approve`, {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify({ approverName }),

  });



  if (!res.ok) {

    throw new Error(`Failed to approve goods return in database: ${res.statusText}`);

  }



  return await res.json();

}



export async function rejectGoodsReturn(

  id: string,

  rejecterName: string,

  rejectionReason: string

): Promise<GoodsReturnSlip | null> {

  const res = await fetch(`/api/goodsreturns/${id}/reject`, {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify({ rejecterName, rejectionReason }),

  });



  if (!res.ok) {

    throw new Error(`Failed to reject goods return in database: ${res.statusText}`);

  }



  return await res.json();

}



export async function lookupHeatNumberForReturn(heatNumber: string): Promise<HeatLookupResult | null> {

  const query = heatNumber.trim().toUpperCase();

  if (!query) return null;



  try {

    const res = await fetch(`/api/goodsreturns/lookup-heat/${encodeURIComponent(query)}`, { headers: getAuthHeaders() });

    if (res.ok) {

      const data = await res.json();

      if (data && data.heatNumber) {

        return {

          heatNumber: data.heatNumber,

          invoiceNumber: data.invoiceNumber || 'INV-2026-0041',

          customerName: data.customerName || 'Mindanao Steelworks Corp.',

          grade: data.grade || 'A36_Structural',

          dimensions: data.dimensions || '12mm x 1500mm x 6000mm',

          purchasedQtyTons: Number(data.purchasedQtyTons || 5.0),

          purchasedQtyPieces: Number(data.purchasedQtyPieces || 25),

          unitPricePerTonPHP: Number(data.unitPricePerTonPHP || 85000),

          maxReturnableTons: Number(data.maxReturnableTons || 5.0),

        };

      }

    }

  } catch (err) {

    console.error('Error looking up heat number in database:', err);

  }



  return null;

}



// ============================================================================

// BRANCH MANAGEMENT API (PostgreSQL Database Connected)

// ============================================================================



export async function fetchBranches(): Promise<BranchRecord[]> {

  try {

    const res = await fetch('/api/branches', { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        return data.map((b: any) => ({

          id: b.id,

          code: b.code || b.name?.slice(0, 3).toUpperCase(),

          name: b.name,

          address: b.address || '',

          contactNumber: b.contactNumber || b.phone || '',

          managerName: b.managerName || '',

          isActive: Boolean(b.isActive),

          createdAt: b.createdAt || new Date().toISOString(),

        }));

      }

    }

  } catch (err) {

    console.error('Error loading branches from database:', err);

  }



  return [];

}



export async function updateBranch(id: string, dto: UpdateBranchDto): Promise<BranchRecord | null> {

  const res = await fetch(`/api/branches/${id}`, {

    method: 'PUT',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(dto),

  });



  if (!res.ok) {

    throw new Error(`Failed to update branch in database: ${res.statusText}`);

  }



  return await res.json();

}



// ============================================================================

// PRODUCTS MASTER CATALOG & CATEGORIES (PostgreSQL Database Connected)

// ============================================================================



export interface CategoryItem {

  id: string;

  name: string;

  description?: string;

  productCount?: number;

}



export async function fetchCategories(): Promise<CategoryItem[]> {

  try {

    const res = await fetch('/api/categories', { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const list = extractItems(raw);

      if (Array.isArray(list)) {

        return list;

      }

    }

  } catch (err) {

    console.error('Error fetching categories from database:', err);

  }



  return [];

}



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

    params.append('pageSize', '150');



    const res = await fetch(`/api/products?${params.toString()}`, { headers: getAuthHeaders() });

    if (res.ok) {

      const json = await res.json();

      const items = extractItems(json);

      if (Array.isArray(items)) {

        const mapped: ProductItem[] = items.map((p: any) => ({

          id: p.id,

          sku: p.sku || p.code || `STL-${p.id?.slice(0, 6)}`,

          name: p.name,

          description: p.description || '',

          barcode: p.barcode,

          size: p.size || 'Standard Size',

          thickness: p.thickness || '',

          length: p.length || '',

          grade: p.grade || 'A36_Structural',

          unitOfMeasure: p.unitOfMeasure || 'pc',

          unitPrice: Number(p.unitPrice || 0),

          costPrice: Number(p.costPrice || 0),

          stockQuantity: Number(p.stockQuantity ?? p.currentStock ?? 0),

          reorderLevel: Number(p.reorderLevel || 10),

          isActive: Boolean(p.isActive),

          categoryId: p.categoryId,

          categoryName: p.categoryName || 'General Steel',

          createdAt: p.createdAt || new Date().toISOString(),

        }));

        return { data: mapped, totalCount: json.totalCount || mapped.length };

      }

    }

  } catch (err) {

    console.error('Error fetching products from database:', err);

  }



  return { data: [], totalCount: 0 };

}



export async function createProduct(dto: CreateProductDto): Promise<ProductItem> {

  const res = await fetch('/api/products', {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(dto),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to create product in database: ${errorText || res.statusText}`);

  }



  return await res.json();

}



export async function updateProduct(

  id: string,

  dto: Partial<ProductItem>

): Promise<ProductItem | null> {

  const res = await fetch(`/api/products/${id}`, {

    method: 'PUT',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(dto),

  });



  if (!res.ok) {

    throw new Error(`Failed to update product in database: ${res.statusText}`);

  }



  return await res.json();

}



// ============================================================================

// USER ACCOUNTS & STAFF (PostgreSQL Database Connected)

// ============================================================================



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



export async function fetchStaffUsers(search?: string, branchId?: string): Promise<StaffUser[]> {

  try {

    const params = new URLSearchParams();

    if (search) params.append('search', search);

    if (branchId) params.append('branchId', branchId);



    const res = await fetch(`/api/users?${params.toString()}`, { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        return data.map((u: any) => ({

          id: u.id,

          email: u.email,

          fullName: u.fullName || u.email,

          isActive: Boolean(u.isActive),

          roleId: u.roleId,

          roleName: u.roleName || (u.role && u.role.name) || 'User',

          branchId: u.branchId,

          branchName: u.branchName || (u.role && u.role.branch && u.role.branch.name),

          branchCode: u.branchCode,

          createdAt: u.createdAt || new Date().toISOString(),

        }));

      }

    }

  } catch (err) {

    console.error('Error fetching users from database:', err);

  }



  return [];

}



export async function createStaffUser(dto: CreateStaffUserDto): Promise<StaffUser> {

  const res = await fetch('/api/users', {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify({

      email: dto.email,

      fullName: dto.fullName,

      password: dto.password || 'SteelTrack@2026',

      roleId: dto.roleId || 'role-cashier',

      isActive: dto.isActive !== false,

    }),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to create user in database: ${errorText || res.statusText}`);

  }



  return await res.json();

}



export async function toggleStaffUserStatus(id: string): Promise<boolean> {

  const res = await fetch(`/api/users/${id}/status`, { method: 'PATCH', headers: getAuthHeaders() });

  if (!res.ok) {

    throw new Error(`Failed to toggle user status in database: ${res.statusText}`);

  }



  const data = await res.json();

  return Boolean(data.isActive);

}



// ============================================================================

// CUSTOMER DIRECTORY & CREDIT LIMIT (PostgreSQL Database Connected)

// ============================================================================



export async function fetchCustomers(branch?: BranchLocation | 'All' | string): Promise<CustomerMaster[]> {

  try {

    const res = await fetch('/api/customers?includeInactive=true', { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        const mapped: CustomerMaster[] = data.map((c: any) => ({

          id: c.id,

          customerCode: c.customerCode || `CUST-${c.id.slice(0, 4).toUpperCase()}`,

          customerName: c.name,

          companyName: c.name,

          tin: c.notes?.match(/TIN:\s*([^\s|]+)/)?.[1] || '000-000-000-000',

          address: c.address || 'Commercial Address',

          contactPerson: c.contactPerson || c.name,

          contactPhone: c.phone || '-',

          contactEmail: c.email || '-',

          creditLimitPHP: Number(c.creditLimit || 0),

          termsDays: Number(c.paymentTerms || 30),

          status: c.isBlocked ? 'Blocked' : c.isActive ? 'Active' : 'On Hold',

          assignedBranch: (c.branch as BranchLocation) || BranchLocation.Davao,

          createdAt: c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],

        }));



        if (branch && branch !== 'All') {

          return mapped.filter((c) => c.assignedBranch === branch);

        }

        return mapped;

      }

    }

  } catch (err) {

    console.error('Error fetching customers from database:', err);

  }



  return [];

}



export async function createCustomer(dto: Partial<CustomerMaster>): Promise<CustomerMaster> {

  const res = await fetch('/api/customers', {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify({

      id: dto.id || crypto.randomUUID(),

      name: dto.customerName || dto.companyName || 'New Customer',

      customerCode: dto.customerCode || `CUST-DAV-${Math.floor(100 + Math.random() * 900)}`,

      phone: dto.contactPhone,

      email: dto.contactEmail,

      address: dto.address,

      creditLimit: dto.creditLimitPHP || 1000000,

      enableCredit: true,

      paymentTerms: dto.termsDays || 30,

      dueDays: dto.termsDays || 30,

      isActive: dto.status !== 'Blocked' && dto.status !== 'On Hold',

      isBlocked: dto.status === 'Blocked',

    }),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to create customer in database: ${errorText || res.statusText}`);

  }



  const created = await res.json();

  return {

    id: created.id,

    customerCode: created.customerCode || dto.customerCode || 'CUST-NEW',

    customerName: created.name,

    companyName: created.name,

    tin: dto.tin || '000-000-000-000',

    address: created.address || 'Commercial Address',

    contactPerson: dto.contactPerson || created.name,

    contactPhone: created.phone || '-',

    contactEmail: created.email || '-',

    creditLimitPHP: Number(created.creditLimit || 0),

    termsDays: Number(created.paymentTerms || 30),

    status: created.isBlocked ? 'Blocked' : created.isActive ? 'Active' : 'On Hold',

    assignedBranch: dto.assignedBranch || BranchLocation.Davao,

    createdAt: created.createdAt ? created.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],

  };

}



export async function updateCustomerCreditLimit(

  id: string,

  creditLimitPHP: number,

  justification?: string

): Promise<boolean> {

  const res = await fetch(`/api/customers/${id}/credit-limit`, {

    method: 'PATCH',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify({ creditLimitPHP, justification }),

  });



  return res.ok;

}



export async function updateCustomerStatus(

  id: string,

  status: 'Active' | 'On Hold' | 'Blocked'

): Promise<boolean> {

  const res = await fetch(`/api/customers/${id}/status`, {

    method: 'PATCH',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify({ status }),

  });



  return res.ok;

}



// ============================================================================

// SUPPLIERS DIRECTORY & CERTIFICATES (PostgreSQL Database Connected)

// ============================================================================



export async function fetchSuppliers(

  search?: string,

  includeInactive: boolean = false

): Promise<SupplierMaster[]> {

  try {

    const params = new URLSearchParams();

    if (search) params.append('search', search);

    if (includeInactive) params.append('includeInactive', 'true');



    const res = await fetch(`/api/suppliers?${params.toString()}`, { headers: getAuthHeaders() });

    if (res.ok) {

      const raw = await res.json();

      const data = extractItems(raw);

      if (Array.isArray(data)) {

        return data.map((s: any) => ({

          id: s.id,

          supplierCode: s.supplierCode || `SUP-${s.id.slice(0, 6)}`,

          companyName: s.name,

          tin: s.tin || (s.notes?.match(/TIN:\s*([^\s|]+)/)?.[1] ?? '000-000-000-000'),

          countryOfOrigin: s.countryOfOrigin || (s.address?.includes('Japan') ? 'Japan' : s.address?.includes('Korea') ? 'South Korea' : 'Philippines'),

          paymentTermsDays: Number(s.paymentTerms || 30),

          ratingScore: Number(s.ratingScore || 5),

          status: s.isActive ? 'Active' : 'Under Review',

          contacts: Array.isArray(s.contacts)

            ? s.contacts.map((c: any) => ({

              id: c.id,

              supplierId: s.id,

              contactPerson: c.name || c.contactPerson || s.contactPerson || 'Sales Contact',

              designation: c.designation || 'Export Sales',

              phone: c.phone || s.phone || '',

              email: c.email || s.email || '',

              isPrimary: Boolean(c.isPrimary ?? true),

            }))

            : s.contactPerson

              ? [

                {

                  id: `contact-${s.id}`,

                  supplierId: s.id,

                  contactPerson: s.contactPerson,

                  designation: 'Primary Contact',

                  phone: s.phone || '',

                  email: s.email || '',

                  isPrimary: true,

                },

              ]

              : [],

          attachments: Array.isArray(s.attachments)

            ? s.attachments.map((a: any) => ({

              id: a.id,

              supplierId: s.id,

              fileName: a.fileName || 'Mill_Test_Certificate.pdf',

              fileType: a.fileType || 'Mill_Test_Certificate',

              uploadDate: a.uploadDate || a.createdAt || new Date().toISOString().split('T')[0],

              fileUrl: a.fileUrl || '#',

            }))

            : [],

        }));

      }

    }

  } catch (err) {

    console.error('Error fetching suppliers from database:', err);

  }



  return [];

}



export async function createSupplier(supplier: Partial<SupplierMaster>): Promise<SupplierMaster> {

  const payload = {

    id: supplier.id || crypto.randomUUID(),

    name: supplier.companyName,

    supplierCode: supplier.supplierCode,

    contactPerson: supplier.contacts?.[0]?.contactPerson || '',

    phone: supplier.contacts?.[0]?.phone || '',

    email: supplier.contacts?.[0]?.email || '',

    address: supplier.countryOfOrigin || 'Registered Office',

    paymentTerms: supplier.paymentTermsDays || 30,

    isActive: supplier.status === 'Active',

    notes: `TIN: ${supplier.tin || '000-000-000-000'} | Rating: ${supplier.ratingScore || 5}`,

  };



  const res = await fetch('/api/suppliers', {

    method: 'POST',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(payload),

  });



  if (!res.ok) {

    const errorText = await res.text();

    throw new Error(`Failed to create supplier in database: ${errorText || res.statusText}`);

  }



  const created = await res.json();

  return {

    id: created.id,

    supplierCode: created.supplierCode || supplier.supplierCode || 'SUP-001',

    companyName: created.name,

    tin: supplier.tin || '000-000-000-000',

    countryOfOrigin: supplier.countryOfOrigin || 'Philippines',

    paymentTermsDays: Number(created.paymentTerms || 30),

    ratingScore: Number(supplier.ratingScore || 5),

    status: created.isActive ? 'Active' : 'Under Review',

    contacts: supplier.contacts || [],

    attachments: supplier.attachments || [],

  };

}



export async function updateSupplier(

  id: string,

  supplier: Partial<SupplierMaster>

): Promise<SupplierMaster> {

  const payload = {

    id,

    name: supplier.companyName,

    supplierCode: supplier.supplierCode,

    contactPerson: supplier.contacts?.[0]?.contactPerson,

    phone: supplier.contacts?.[0]?.phone,

    email: supplier.contacts?.[0]?.email,

    address: supplier.countryOfOrigin,

    paymentTerms: supplier.paymentTermsDays,

    isActive: supplier.status === 'Active',

    notes: `TIN: ${supplier.tin || '000-000-000-000'} | Rating: ${supplier.ratingScore || 5}`,

  };



  const res = await fetch(`/api/suppliers/${id}`, {

    method: 'PUT',

    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

    body: JSON.stringify(payload),

  });



  if (!res.ok) {

    throw new Error(`Failed to update supplier in database: ${res.statusText}`);

  }



  const updated = await res.json();

  return {

    id: updated.id,

    supplierCode: updated.supplierCode,

    companyName: updated.name,

    tin: supplier.tin || '000-000-000-000',

    countryOfOrigin: supplier.countryOfOrigin || 'Philippines',

    paymentTermsDays: Number(updated.paymentTerms || 30),

    ratingScore: Number(supplier.ratingScore || 5),

    status: updated.isActive ? 'Active' : 'Under Review',

    contacts: supplier.contacts || [],

    attachments: supplier.attachments || [],

  };

}



export async function deleteSupplier(id: string): Promise<boolean> {

  const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE', headers: getAuthHeaders() });

  return res.ok;

}





// ============================================================================

// QUALITY CONTROL & APPROVAL REQUESTS (Live Supabase Tables)

// ============================================================================



export interface ApprovalRequestItem {

  id: string;

  type: string;

  status: string;

  referenceNumber: string;

  details: string;

  requestedBy: string;

  requestedAt: string;

  reviewedBy?: string;

  reviewedAt?: string;

  rejectionReason?: string;

}



export async function fetchApprovals(status?: string, branch?: string): Promise<ApprovalRequestItem[]> {

  try {

    const params = new URLSearchParams();

    if (status && status !== 'All') params.append('status', status);

    if (branch && branch !== 'All') params.append('branch', branch);

    const res = await fetch(`/api/approvals?${params.toString()}`, {

      headers: getAuthHeaders(),

    });

    if (res.ok) {

      const json = await res.json();

      const items = extractItems(json);

      return items.map((a: any) => ({

        id: String(a.id),

        type: a.typeLabel || a.type || 'Quality / Status Review',

        status: a.statusLabel || a.status || 'Pending',

        referenceNumber: a.referenceNumber || a.title || a.saleNumber || a.grsNumber || String(a.id).slice(0, 8),

        details: a.reason || a.details || 'Pending review by branch manager or owner',

        requestedBy: a.requestedByName || a.requesterName || a.requestedBy || 'Staff Member',

        requestedAt: a.requestedAt || a.createdAt || new Date().toISOString(),

        reviewedBy: a.approvedByName || a.rejectedByName || a.reviewerName,

        reviewedAt: a.approvedAt || a.rejectedAt || a.reviewedAt,

        rejectionReason: a.rejectionReason,

      }));

    }

  } catch (err) {

    console.error('Error fetching approvals from database:', err);

  }

  return [];

}



export async function reviewApproval(id: string, action: 'approve' | 'reject', reason?: string): Promise<boolean> {

  try {

    const res = await fetch(`/api/approvals/${encodeURIComponent(id)}/${action}`, {

      method: 'POST',

      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),

      body: JSON.stringify({ reason: reason || '', notes: reason || '' }),

    });

    return res.ok;

  } catch (err) {

    console.error(`Error reviewing approval ${id}:`, err);

    return false;

  }

}



// ============================================================================

// DASHBOARD & EXECUTIVE METRICS (Live Supabase Connected)

// ============================================================================



export async function fetchDashboardMetrics(): Promise<any> {

  try {

    const res = await fetch('/api/dashboard', {

      headers: getAuthHeaders(),

    });

    if (res.ok) {

      const json = await res.json();

      return json.data || json;

    }

  } catch (err) {

    console.error('Error fetching dashboard metrics:', err);

  }

  return null;

}

