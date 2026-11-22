import { useState, useMemo } from 'react';
import { Tag, Sliders, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Info, Building2, X, Boxes, PackagePlus, AlertTriangle } from 'lucide-react';
import type { SteelBatch, BatchStatus } from '../types/steel';
import { fetchCrossBranchStock, addBranchProductStock, type CrossBranchStockResponse } from '../services/api';
import { BarcodePrintModal } from './BarcodePrintModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { TableExportButtons } from './TableExportButtons';

interface InventoryTableProps {
  batches: SteelBatch[];
  loading: boolean;
  onUpdateStatus: (id: string, newStatus: BatchStatus) => void;
  onAdjustStock?: (id: string, newTons: number, reason: string) => Promise<void>;
  onStockAdded?: () => void;
}

export function InventoryTable({
  batches,
  loading,
  onUpdateStatus: _onUpdateStatus,
  onAdjustStock,
  onStockAdded,
}: InventoryTableProps) {
  const [selectedBarcodeBatch, setSelectedBarcodeBatch] = useState<SteelBatch | null>(null);
  const [selectedAdjustmentBatch, setSelectedAdjustmentBatch] = useState<SteelBatch | null>(null);

  // Add/Restock Branch Product modal state
  const [selectedRestockBatch, setSelectedRestockBatch] = useState<SteelBatch | null>(null);
  const [restockQty, setRestockQty] = useState<string>('50');
  const [restockCost, setRestockCost] = useState<string>('');
  const [restockSelling, setRestockSelling] = useState<string>('');
  const [restockBatchCode, setRestockBatchCode] = useState<string>('');
  const [restockRef, setRestockRef] = useState<string>('');
  const [restockNotes, setRestockNotes] = useState<string>('');
  const [restockLoading, setRestockLoading] = useState<boolean>(false);
  const [restockError, setRestockError] = useState<string | null>(null);

  const handleOpenRestock = (batch: SteelBatch) => {
    const bAny = batch as any;
    setSelectedRestockBatch(batch);
    setRestockQty('50');
    setRestockCost(bAny.defaultCostPrice || bAny.costPrice ? String(bAny.defaultCostPrice || bAny.costPrice) : '');
    setRestockSelling(bAny.sellingPrice ? String(bAny.sellingPrice) : '');
    const branchCode = ((bAny.branch || bAny.branchName || 'DVO') as string).slice(0, 3).toUpperCase();
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setRestockBatchCode(`BAT-${dateStamp}-${branchCode}`);
    setRestockRef(`PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setRestockNotes('');
    setRestockError(null);
  };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestockBatch) return;

    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setRestockError('Restock quantity must be a positive integer greater than zero.');
      return;
    }

    setRestockLoading(true);
    setRestockError(null);

    try {
      const bAny = selectedRestockBatch as any;
      const targetId = bAny.id || bAny.productId;
      await addBranchProductStock(targetId, {
        quantity: qty,
        costPrice: restockCost ? parseFloat(restockCost) : undefined,
        sellingPrice: restockSelling ? parseFloat(restockSelling) : undefined,
        batchCode: restockBatchCode.trim() || undefined,
        reference: restockRef.trim() || undefined,
        notes: restockNotes.trim() || undefined,
      });

      setSelectedRestockBatch(null);
      if (onStockAdded) {
        onStockAdded();
      }
    } catch (err: any) {
      console.error('Failed restocking branch product:', err);
      setRestockError(err.message || 'Failed to restock inventory.');
    } finally {
      setRestockLoading(false);
    }
  };

  // Cross-branch product stock modal state for Branch Managers
  const [crossBranchData, setCrossBranchData] = useState<{
    isOpen: boolean;
    loading: boolean;
    productName: string;
    sku: string;
    grade: string;
    currentBranch: string;
    response: CrossBranchStockResponse | null;
  }>({
    isOpen: false,
    loading: false,
    productName: '',
    sku: '',
    grade: '',
    currentBranch: '',
    response: null,
  });

  const handleOpenCrossBranch = async (batch: any) => {
    const prodId = batch.productId || batch.id;
    const prodName = batch.productName || batch.name || 'Steel Product';
    const sku = batch.sku || batch.heatNumber || 'N/A';
    const grade = batch.grade || 'Standard';
    const curBranch = batch.branch || batch.branchName || 'Current';

    setCrossBranchData({
      isOpen: true,
      loading: true,
      productName: prodName,
      sku,
      grade,
      currentBranch: curBranch,
      response: null,
    });

    try {
      const res = await fetchCrossBranchStock(prodId);
      setCrossBranchData((prev) => ({
        ...prev,
        loading: false,
        response: res,
      }));
    } catch (err) {
      console.error('Failed fetching cross-branch stock:', err);
      setCrossBranchData((prev) => ({ ...prev, loading: false }));
    }
  };

  // Pagination state to prevent lag when rendering thousands of branch products
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const formatGrade = (gradeStr: string) => {
    return gradeStr.replace(/_/g, ' ');
  };

  // Safe pagination calculations
  const totalItems = batches.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const pagedBatches = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return batches.slice(start, start + pageSize);
  }, [batches, safePage, pageSize]);

  return (
    <div className="table-container">
      {/* Background refresh badge if loading while batches are already rendered */}
      {loading && batches.length > 0 && (
        <div style={{
          padding: '0.4rem 1rem',
          background: '#F0FDF4',
          borderBottom: '1px solid #DCFCE7',
          color: '#15803D',
          fontSize: '0.78rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}>
          <RefreshCw size={13} className="spin" />
          <span>Syncing branch inventory with database in background…</span>
        </div>
      )}

      {loading && batches.length === 0 ? (
        <div style={{ padding: '3.5rem', textAlign: 'center', color: '#000000' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem auto', color: '#0284C7' }} />
          <div>Loading branch products from database...</div>
        </div>
      ) : batches.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#000000' }}>
          No steel inventory batches match your filter criteria.
        </div>
      ) : (
        <>
          <div
            style={{
              padding: '0.6rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#000000' }}>
              Showing {pagedBatches.length} of <strong>{batches.length}</strong> inventory records
            </div>
            <TableExportButtons
              filename="SteelTrack_Inventory_Report"
              title="Branch Steel Inventory Report"
              headers={['Branch', 'SKU / Heat #', 'Product', 'Grade', 'On-Hand Stock', 'UOM', 'Dimensions', 'Selling Price', 'Status']}
              rows={batches.map((b: any) => [
                b.branch || b.branchName || 'Davao',
                b.heatNumber || b.sku || '—',
                b.productName || 'Steel Product',
                b.grade || 'Standard',
                b.stockQuantity ?? b.currentStock ?? b.weightInTons ?? 0,
                b.unitOfMeasure || (b.weightInTons ? 't' : 'pc'),
                b.dimensions || b.size || 'Standard',
                b.sellingPrice ? `₱${Number(b.sellingPrice).toLocaleString()}` : '—',
                b.status || 'Available',
              ])}
            />
          </div>

          <table>
            <thead>
              <tr>
                <th>Branch</th>
                <th>SKU / Heat #</th>
                <th>Product & Grade</th>
                <th>On-Hand Stock</th>
                <th>Dimensions & Specs</th>
                <th>Yard / Selling Price</th>
                <th>Date Added</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedBatches.map((b) => {
                const bAny = b as any;
                const displayBranch = b.branch || bAny.branchName || 'Davao';
                const displaySku = b.heatNumber || bAny.sku || bAny.productSku || '—';
                const stockQty = Number(bAny.stockQuantity ?? bAny.currentStock ?? b.weightInTons ?? 0);
                const reorderLevel = Number(bAny.reorderLevel ?? 10);
                const isLowStock = stockQty <= reorderLevel || stockQty <= 20 || stockQty <= 0;

                return (
                  <tr
                    key={b.id}
                    style={{
                      background: isLowStock ? '#FEF2F2' : '#FFFFFF',
                      borderLeft: isLowStock ? '3px solid #DC2626' : '3px solid transparent',
                    }}
                  >
                    <td>
                      <span className="branch-tag highlight">{displayBranch}</span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: '#0284C7' }}>
                      {displaySku}
                    </td>
                    <td>
                      {bAny.productName && (
                        <div style={{ fontWeight: 600, color: '#000000', fontSize: '0.88rem' }}>{bAny.productName}</div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: bAny.productName ? '0.15rem' : '0' }}>
                        <span style={{ color: '#0284C7', fontWeight: 600, fontSize: bAny.productName ? '0.78rem' : '0.88rem' }}>
                          {formatGrade(b.grade || 'Standard')}
                        </span>
                        {bAny.categoryName && (
                          <span style={{ color: '#000000', fontSize: '0.75rem' }}>• {bAny.categoryName}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: 700, color: isLowStock ? '#DC2626' : '#0F172A', fontSize: '0.9rem' }}>
                          {stockQty} {bAny.unitOfMeasure || (b.weightInTons ? 't' : 'pc')}
                        </span>
                      </div>
                      {isLowStock ? (
                        <div style={{ marginTop: '0.2rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#DC2626',
                              fontWeight: 700,
                              background: '#FEE2E2',
                              border: '1px solid #FECACA',
                              padding: '0.1rem 0.35rem',
                              borderRadius: 3,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            <AlertTriangle size={10} /> Low Stock (&le;{reorderLevel})
                          </span>
                        </div>
                      ) : (
                        b.weightInTons !== undefined && bAny.stockQuantity !== undefined && (
                          <div style={{ fontSize: '0.72rem', color: '#000000' }}>{b.weightInTons} tons</div>
                        )
                      )}
                    </td>
                    <td style={{ color: '#000000', fontSize: '0.83rem' }}>
                      {b.dimensions || bAny.size || [bAny.thickness, bAny.length].filter(Boolean).join(' • ') || 'Standard specifications'}
                    </td>
                    <td>
                      {bAny.sellingPrice !== undefined && Number(bAny.sellingPrice) > 0 ? (
                        <div style={{ fontWeight: 700, color: '#000000' }}>₱{Number(bAny.sellingPrice).toLocaleString()}</div>
                      ) : null}
                      <div style={{ color: '#000000', fontSize: '0.75rem' }}>{b.location || 'Main Yard'}</div>
                    </td>
                    <td style={{ color: '#000000', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div
                        className="branch-products-actions-grid"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '0.35rem',
                        }}
                      >
                        <div className="branch-products-actions-icons" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              width: '30px',
                              height: '30px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              background: '#ECFDF5',
                              color: '#059669',
                              borderColor: '#A7F3D0',
                            }}
                            title="Add / Restock Branch Inventory"
                            aria-label="Add Stock"
                            onClick={() => handleOpenRestock(b)}
                          >
                            <PackagePlus size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              width: '30px',
                              height: '30px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                              background: '#F0F9FF',
                              color: '#0284C7',
                              borderColor: '#BAE6FD',
                            }}
                            title="View cross-branch stock breakdown"
                            aria-label="Stock Info"
                            onClick={() => handleOpenCrossBranch(b)}
                          >
                            <Info size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              width: '30px',
                              height: '30px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                            title="Print Industrial Barcode Tag"
                            aria-label="Print Barcode Tag"
                            onClick={() => setSelectedBarcodeBatch(b)}
                          >
                            <Tag size={14} />
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            style={{
                              width: '30px',
                              height: '30px',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '6px',
                            }}
                            title="Adjust Physical Tonnage"
                            aria-label="Adjust Stock"
                            onClick={() => setSelectedAdjustmentBatch(b)}
                          >
                            <Sliders size={14} />
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* TABLE PAGINATION & STATS BAR */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderTop: '1px solid #E2E8F0',
            background: '#F8FAFC',
            fontSize: '0.82rem',
            color: '#000000',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <div>
              Showing <strong style={{ color: '#000000' }}>{totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1}</strong> to{' '}
              <strong style={{ color: '#000000' }}>{Math.min(safePage * pageSize, totalItems)}</strong> of{' '}
              <strong style={{ color: '#000000' }}>{totalItems.toLocaleString()}</strong> items
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.2rem 0.4rem',
                    fontSize: '0.8rem',
                    borderRadius: '4px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                  }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button
                  className="btn-secondary"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  style={{ padding: '0.25rem 0.4rem' }}
                  title="First Page"
                >
                  <ChevronsLeft size={14} />
                </button>
                <button
                  className="btn-secondary"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ padding: '0.25rem 0.4rem' }}
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ padding: '0 0.5rem', fontWeight: 600, color: '#000000' }}>
                  Page {safePage} of {totalPages}
                </span>
                <button
                  className="btn-secondary"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ padding: '0.25rem 0.4rem' }}
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  className="btn-secondary"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  style={{ padding: '0.25rem 0.4rem' }}
                  title="Last Page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* BARCODE MODAL */}
      <BarcodePrintModal
        isOpen={Boolean(selectedBarcodeBatch)}
        batch={selectedBarcodeBatch}
        onClose={() => setSelectedBarcodeBatch(null)}
      />

      {/* ADJUSTMENT MODAL */}
      <StockAdjustmentModal
        isOpen={Boolean(selectedAdjustmentBatch)}
        batch={selectedAdjustmentBatch}
        onClose={() => setSelectedAdjustmentBatch(null)}
        onSubmitAdjustment={async (id, adjustedTons, reason) => {
          if (onAdjustStock) await onAdjustStock(id, adjustedTons, reason);
        }}
      />

      {/* CROSS-BRANCH PRODUCT STOCK MODAL (FOR BRANCH MANAGERS & EXECUTIVES) */}
      {crossBranchData.isOpen && (
        <div className="modal-overlay" onClick={() => setCrossBranchData((prev) => ({ ...prev, isOpen: false }))}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 720, borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #E2E8F0', padding: '1.1rem 1.5rem', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#000000' }}>
                    Cross-Branch Stock Availability
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#000000', marginTop: 2 }}>
                    <strong>{crossBranchData.productName}</strong> · SKU: <span style={{ color: '#0284C7', fontFamily: 'monospace' }}>{crossBranchData.sku}</span> · Grade: {crossBranchData.grade?.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setCrossBranchData((prev) => ({ ...prev, isOpen: false }))}
                style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                title="Close"
              >
                <X size={18} style={{ color: '#000000' }} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.5rem', color: '#000000', maxHeight: '70vh', overflowY: 'auto' }}>
              {(() => {
                const resp = crossBranchData.response;
                if (crossBranchData.loading) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#000000' }}>
                      <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem auto', color: '#0284C7' }} />
                      <div>Querying real-time inventory balances across all branches…</div>
                    </div>
                  );
                }
                if (!resp) {
                  return (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#EF4444', background: '#FEF2F2', borderRadius: 8 }}>
                      Could not retrieve cross-branch inventory records for this product.
                    </div>
                  );
                }
                return (
                  <>
                    {/* Network Aggregate Overview */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '0.85rem 1rem', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.75rem', color: '#0369A1', fontWeight: 600 }}>Total Network Stock</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284C7', marginTop: 3 }}>
                          {resp.totalNetworkStock.toLocaleString()} {resp.unitOfMeasure}
                        </div>
                      </div>

                      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.85rem 1rem', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.75rem', color: '#000000', fontWeight: 600 }}>Standard Specifications</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#000000', marginTop: 4 }}>
                          {resp.dimensions}
                        </div>
                      </div>

                      <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.85rem 1rem', borderRadius: 8 }}>
                        <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>Category</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#059669', marginTop: 4 }}>
                          {resp.categoryName}
                        </div>
                      </div>
                    </div>

                    {/* Branches Availability Breakdown Table */}
                    <div style={{ borderRadius: 8, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#000000', textAlign: 'left' }}>
                            <th style={{ padding: '0.75rem 1rem' }}>Branch Facility</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Available Stock</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Selling Price</th>
                            <th style={{ padding: '0.75rem 1rem' }}>Active Batches</th>
                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Stock Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resp.branches.map((b) => {
                            const isCurrent = crossBranchData.currentBranch && (
                              b.branchName.toLowerCase().includes(crossBranchData.currentBranch.toLowerCase()) ||
                              crossBranchData.currentBranch.toLowerCase().includes(b.branchCode.toLowerCase())
                            );
                            const hasStock = b.stockQuantity > 0;

                            return (
                              <tr key={b.branchId} style={{ borderBottom: '1px solid #F1F5F9', background: isCurrent ? '#F0F9FF' : '#FFFFFF' }}>
                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                    <strong style={{ color: '#000000' }}>{b.branchName}</strong>
                                    {isCurrent && (
                                      <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem', borderRadius: 4, background: '#BAE6FD', color: '#0369A1', fontWeight: 700 }}>
                                        Current Branch
                                      </span>
                                    )}
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#000000' }}>Code: {b.branchCode}</span>
                                </td>

                                <td style={{ padding: '0.85rem 1rem' }}>
                                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: hasStock ? '#059669' : '#DC2626' }}>
                                    {b.stockQuantity.toLocaleString()} {resp.unitOfMeasure}
                                  </div>
                                  {b.oldestBatchReceivedDate && (
                                    <div style={{ fontSize: '0.7rem', color: '#000000' }}>
                                      FIFO Oldest: {b.oldestBatchReceivedDate}
                                    </div>
                                  )}
                                </td>

                                <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#000000' }}>
                                  ₱{Number(b.sellingPrice).toLocaleString()}
                                </td>

                                <td style={{ padding: '0.85rem 1rem', color: '#000000' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <Boxes size={14} style={{ color: '#0284C7' }} />
                                    <span>{b.batchCount} batch(es)</span>
                                  </div>
                                </td>

                                <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                                  {hasStock ? (
                                    <span style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                                      Available
                                    </span>
                                  ) : (
                                    <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: 4 }}>
                                      Zero Stock
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', padding: '0.85rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCrossBranchData((prev) => ({ ...prev, isOpen: false }))}
                style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTOCK / ADD STOCKS MODAL */}
      {selectedRestockBatch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '12px', border: '1px solid #CBD5E1', width: '90%', maxWidth: '520px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#000000' }}>
                <PackagePlus size={20} style={{ color: '#059669' }} /> Restock Branch Product
              </h3>
              <button
                onClick={() => setSelectedRestockBatch(null)}
                style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Product & Branch Info Card */}
            {(() => {
              const bAny = selectedRestockBatch as any;
              const branchName = selectedRestockBatch.branch || bAny.branchName || 'Current Branch';
              const prodName = bAny.productName || 'Steel Product';
              const sku = bAny.sku || selectedRestockBatch.heatNumber || 'N/A';
              const currentStock = Number(bAny.stockQuantity ?? bAny.currentStock ?? selectedRestockBatch.weightInTons ?? 0);
              const uom = bAny.unitOfMeasure || (selectedRestockBatch.weightInTons ? 't' : 'pc');

              return (
                <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                    <span style={{ color: '#000000', fontWeight: 600 }}>Facility Branch:</span>
                    <span style={{ color: '#000000', fontWeight: 700 }}>{branchName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                    <span style={{ color: '#000000', fontWeight: 600 }}>Product Name:</span>
                    <span style={{ color: '#0284C7', fontWeight: 700 }}>{prodName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                    <span style={{ color: '#000000', fontWeight: 600 }}>SKU / Heat #:</span>
                    <span style={{ color: '#000000', fontFamily: 'JetBrains Mono, monospace' }}>{sku}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.45rem', borderTop: '1px solid #E2E8F0', fontSize: '0.92rem' }}>
                    <span style={{ color: '#000000', fontWeight: 600 }}>Current On-Hand Stock:</span>
                    <strong style={{ color: currentStock <= 20 ? '#DC2626' : '#059669', fontSize: '1rem' }}>
                      {currentStock} {uom}
                    </strong>
                  </div>
                </div>
              );
            })()}

            {restockError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {restockError}
              </div>
            )}

            <form onSubmit={handleConfirmRestock}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#000000', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Quantity to Restock / Add *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem', borderRadius: '6px', fontSize: '1.05rem', fontWeight: 700, outline: 'none' }}
                  placeholder="e.g. 50"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Unit Cost Price (PHP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={restockCost}
                    onChange={(e) => setRestockCost(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                    placeholder="Optional cost"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Unit Selling Price (PHP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={restockSelling}
                    onChange={(e) => setRestockSelling(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                    placeholder="Optional price"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    Batch / Heat Code
                  </label>
                  <input
                    type="text"
                    value={restockBatchCode}
                    onChange={(e) => setRestockBatchCode(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#000000', fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                    PO / Reference #
                  </label>
                  <input
                    type="text"
                    value={restockRef}
                    onChange={(e) => setRestockRef(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#000000', fontSize: '0.82rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Restock Notes / Supplier Detail
                </label>
                <textarea
                  rows={2}
                  value={restockNotes}
                  onChange={(e) => setRestockNotes(e.target.value)}
                  placeholder="Optional notes regarding supplier shipment, steel mill certs, or yard bay..."
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedRestockBatch(null)}
                  disabled={restockLoading}
                  style={{ color: '#000000' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={restockLoading}
                  style={{ background: '#059669', borderColor: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <PackagePlus size={16} />
                  {restockLoading ? 'Adding Stock...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
