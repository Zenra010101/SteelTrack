import { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Clock, Truck, ArrowRightLeft, X, AlertCircle, Ban, Check } from 'lucide-react';
import { fetchTransfers, createTransferRequest, updateTransferStatus, fetchBranchProducts } from '../services/api';
import type { StockTransferRequest, TransferStatus } from '../types/transfer';
import { BranchLocation } from '../types/auth';
import type { BranchProductItem } from '../types/steel';

/** Preset urgency tier baked into the transfer request form. */
const REORDERING_URGENCY = 'Regular Rebalancing';

/** Official system branches for inter-branch logistics transfer routes. */
export const OFFICIAL_TRANSFER_BRANCHES = [
  { code: BranchLocation.Mandaue, name: 'Mandaue', label: 'Mandaue Branch' },
  { code: BranchLocation.Cebu, name: 'Cebu', label: 'Cebu Branch' },
  { code: BranchLocation.Davao, name: 'Davao', label: 'Davao Branch' },
  { code: BranchLocation.Cagayan, name: 'Cagayan', label: 'Cagayan De Oro Branch' },
] as const;

/** Human-readable full name for a branch code (e.g. Davao Branch, Cagayan De Oro Branch). */
function branchLabelFor(code: string): string {
  if (!code) return 'Unknown Branch';
  const c = code.toLowerCase().trim();
  if (c === 'br1' || c.includes('davao')) return 'Davao Branch';
  if (c === 'br2' || c.includes('cagayan')) return 'Cagayan Branch';
  if (c === 'br3' || c.includes('cebu')) return 'Cebu Branch';
  if (c === 'br4' || c.includes('mandaue')) return 'Mandaue Branch';
  return `${code.charAt(0).toUpperCase() + code.slice(1)} Branch`;
}

interface InterBranchTransferViewProps {
  currentBranch?: BranchLocation;
  currentUserName: string;
}

export interface TransferManifestItem {
  id: string;
  product: BranchProductItem;
  weightInTons: number;
  availableStock: number;
}

export function InterBranchTransferView({
  currentBranch,
  currentUserName,
}: InterBranchTransferViewProps) {
  const [transfers, setTransfers] = useState<StockTransferRequest[]>([]);
  const [products, setProducts] = useState<BranchProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [transferWeight, setTransferWeight] = useState<string>('5.0');
  const [manifest, setManifest] = useState<TransferManifestItem[]>([]);
  const [urgency, setUrgency] = useState<string>('Regular Rebalancing');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [statusError, setStatusError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Route selection state — initialized to official system branches (Mandaue, Cebu, Davao, Cagayan)
  const [sourceBranch, setSourceBranch] = useState<BranchLocation>(currentBranch ?? BranchLocation.Mandaue);
  const [destinationBranch, setDestinationBranch] = useState<BranchLocation>(
    currentBranch === BranchLocation.Cebu ? BranchLocation.Mandaue : BranchLocation.Cebu
  );

  const loadTransfersAndInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [trList, invResult] = await Promise.all([
        fetchTransfers(currentBranch),
        fetchBranchProducts(undefined, undefined, undefined, false, currentBranch),
      ]);
      setTransfers(trList);
      setProducts(invResult.data);
      if (invResult.data.length > 0) {
        setSelectedProductId((prev) => prev || invResult.data[0].id);
      }
    } catch (err) {
      console.error('Error loading transfers:', err);
    } finally {
      setLoading(false);
    }
  }, [currentBranch]);

  // Dynamically load sender branch's real-time inventory
  const loadSourceBranchInventory = useCallback(async (branch: BranchLocation) => {
    try {
      const invResult = await fetchBranchProducts(undefined, undefined, undefined, false, branch);
      setProducts(invResult.data);
      if (invResult.data.length > 0) {
        setSelectedProductId(invResult.data[0].id);
        const avail = Number(invResult.data[0].stockQuantity ?? invResult.data[0].currentStock ?? 1);
        setTransferWeight(String(Math.min(5, Math.max(1, avail))));
      } else {
        setSelectedProductId('');
        setTransferWeight('0');
      }
    } catch (err) {
      console.error('Failed to load sender branch inventory:', err);
    }
  }, []);

  useEffect(() => {
    loadTransfersAndInventory();
  }, [loadTransfersAndInventory]);

  // Selected product object
  const activeProduct = products.find((p) => p.id === selectedProductId);

  const handleOpenModal = () => {
    const defaultOrigin = currentBranch && OFFICIAL_TRANSFER_BRANCHES.some((b) => b.code === currentBranch)
      ? currentBranch
      : BranchLocation.Mandaue;
    const defaultDest = defaultOrigin === BranchLocation.Cebu ? BranchLocation.Mandaue : BranchLocation.Cebu;
    setSourceBranch(defaultOrigin);
    setDestinationBranch(defaultDest);
    setManifest([]);
    loadSourceBranchInventory(defaultOrigin);
    setUrgency(REORDERING_URGENCY);
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSourceBranchChange = (newBranch: BranchLocation) => {
    setSourceBranch(newBranch);
    setManifest([]);
    loadSourceBranchInventory(newBranch);
  };

  const handleSwapBranches = () => {
    const temp = sourceBranch;
    const newSource = destinationBranch;
    setSourceBranch(newSource);
    setDestinationBranch(temp);
    setManifest([]);
    loadSourceBranchInventory(newSource);
  };

  const handleWeightChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '');
    setTransferWeight(clean);

    const num = parseFloat(clean);
    const availableMax = Number(activeProduct?.stockQuantity ?? activeProduct?.currentStock ?? 0);
    if (num > availableMax) {
      setFormError(`Transfer weight exceeds available stock of ${availableMax} units at ${branchLabelFor(sourceBranch)}!`);
    } else if (num <= 0 || isNaN(num)) {
      setFormError('Please enter a valid transfer tonnage.');
    } else {
      setFormError('');
    }
  };

  const handleAddToManifest = () => {
    if (!activeProduct) {
      setFormError('Please select a valid product from the inventory list.');
      return;
    }
    const weightNum = parseFloat(transferWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setFormError('Please enter a valid transfer tonnage.');
      return;
    }
    const maxAvailable = Number(activeProduct.stockQuantity ?? activeProduct.currentStock ?? 0);
    const alreadyQueued = manifest
      .filter((m) => m.product.id === activeProduct.id)
      .reduce((sum, m) => sum + m.weightInTons, 0);

    if (weightNum + alreadyQueued > maxAvailable) {
      setFormError(`Cannot add ${weightNum} tons. Total requested (${weightNum + alreadyQueued}) exceeds available stock (${maxAvailable} units at ${branchLabelFor(sourceBranch)}).`);
      return;
    }

    setManifest((prev) => [
      ...prev,
      {
        id: `${activeProduct.id}-${Date.now()}-${Math.random()}`,
        product: activeProduct,
        weightInTons: weightNum,
        availableStock: maxAvailable,
      },
    ]);
    setFormError('');
  };

  const handleRemoveFromManifest = (id: string) => {
    setManifest((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceBranch === destinationBranch) {
      setFormError('Source and Destination branches cannot be identical!');
      return;
    }

    // Determine items to submit: either from multi-item manifest, or the currently selected active item
    let itemsToSubmit = [...manifest];
    if (itemsToSubmit.length === 0) {
      if (!activeProduct) {
        setFormError('Please select or add at least one product to the transfer request.');
        return;
      }
      const weightNum = parseFloat(transferWeight);
      if (isNaN(weightNum) || weightNum <= 0) {
        setFormError('Please enter a valid transfer tonnage.');
        return;
      }
      const maxAvailable = Number(activeProduct.stockQuantity ?? activeProduct.currentStock ?? 0);
      if (weightNum > maxAvailable) {
        setFormError(`Transfer weight exceeds available stock of ${maxAvailable} units at ${branchLabelFor(sourceBranch)}!`);
        return;
      }
      itemsToSubmit = [{
        id: 'single',
        product: activeProduct,
        weightInTons: weightNum,
        availableStock: maxAvailable,
      }];
    }

    for (const item of itemsToSubmit) {
      await createTransferRequest({
        batchId: item.product.id,
        heatNumber: item.product.sku ?? 'N/A',
        grade: item.product.grade ?? 'A36_Structural',
        sourceBranch,
        destinationBranch,
        weightInTons: item.weightInTons,
        requestedBy: currentUserName,
        notes: `${urgency}: ${notes || 'Stock transfer request'} (Batch ${item.product.sku})`,
      });
    }

    setIsModalOpen(false);
    setManifest([]);
    loadTransfersAndInventory();
  };

  const handleStatusChange = async (id: string, newStatus: TransferStatus) => {
    setStatusError('');
    try {
      await updateTransferStatus(id, newStatus, currentUserName);
      await loadTransfersAndInventory();
    } catch (err: any) {
      console.error('Failed to update transfer status:', err);
      setStatusError(err.message || 'Failed to update transfer status.');
    }
  };

  const getStatusBadge = (status: TransferStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span style={{ background: '#E2E8F0', color: '#475569', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={12} /> Pending Approval
          </span>
        );
      case 'Approved':
        return (
          <span style={{ background: '#0284C7', color: '#DBEAFE', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={12} /> Approved
          </span>
        );
      case 'InTransit':
        return (
          <span style={{ background: '#0369A1', color: '#E0F2FE', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Truck size={12} /> In Transit
          </span>
        );
      case 'Completed':
        return (
          <span style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={12} /> Completed
          </span>
        );
      case 'Rejected':
        return (
          <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Ban size={12} /> Cancelled
          </span>
        );
      default:
        return (
          <span style={{ background: '#F1F5F9', color: '#475569', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
            {status}
          </span>
        );
    }
  };

  return (
    <div className="view-container">
      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#0F172A', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Inter-Branch Stock Transfer System
          </h2>
          <p style={{ color: '#64748B', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Coordinate and track logistics transfer routes across your enterprise's branches.
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Request Stock Transfer
        </button>
      </div>

      {statusError && (
        <div style={{ margin: '0 0 1rem 0', padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '0.85rem', fontWeight: 600 }}>
          {statusError}
        </div>
      )}

      {/* TRANSFERS TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Transfer #</th>
              <th style={{ padding: '0.75rem 1rem' }}>Logistics Route</th>
              <th style={{ padding: '0.75rem 1rem' }}>Steel Batch & Spec</th>
              <th style={{ padding: '0.75rem 1rem' }}>Tonnage</th>
              <th style={{ padding: '0.75rem 1rem' }}>Requested By</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  Loading stock transfer manifests...
                </td>
              </tr>
            ) : transfers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  No active stock transfers found for this branch.
                </td>
              </tr>
            ) : (
              transfers.map((tr) => (
                <tr key={tr.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                  <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#0284C7' }}>
                    {tr.transferNumber || (tr.id.length > 12 ? `${tr.id.slice(0, 8)}...` : tr.id)}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="branch-tag">{branchLabelFor(tr.sourceBranch)}</span>
                      <ArrowRightLeft size={14} style={{ color: '#0284C7' }} />
                      <span className="branch-tag highlight">{branchLabelFor(tr.destinationBranch)}</span>
                    </div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{tr.heatNumber}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{tr.grade}</div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0F172A' }}>
                    {tr.weightInTons} Tons
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#475569' }}>{tr.requestedBy}</div>
                    {tr.approvedBy && (
                      <div style={{ fontSize: '0.72rem', color: '#059669' }}>Approved by: {tr.approvedBy}</div>
                    )}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    {getStatusBadge(tr.status)}
                  </td>

                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {tr.status === 'Pending' && (
                        <>
                          <button
                            className="btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => handleStatusChange(tr.id, 'Approved')}
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}
                            onClick={() => handleStatusChange(tr.id, 'Rejected')}
                          >
                            <Ban size={12} /> Cancel
                          </button>
                        </>
                      )}

                      {tr.status === 'Approved' && (
                        <button
                          className="btn-primary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#0284C7' }}
                          onClick={() => handleStatusChange(tr.id, 'InTransit')}
                        >
                          <Truck size={12} /> Dispatch Truck
                        </button>
                      )}

                      {tr.status === 'InTransit' && (
                        <button
                          className="btn-primary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', background: '#059669' }}
                          onClick={() => handleStatusChange(tr.id, 'Completed')}
                        >
                          <CheckCircle size={12} /> Confirm Receipt
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODERNIZED TRANSFER REQUEST MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '12px', border: '1px solid #CBD5E1', width: '92%', maxWidth: '580px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Truck size={20} /> Request Inter-Branch Transfer
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#475569', fontSize: '0.8rem' }}>
                  Establish an authenticated dispatch manifest between regional facilities.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer}>
              {/* ROUTE CONFIGURATION CARD */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
                <div style={{ color: '#0F172A', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Logistics Transfer Route
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ color: '#475569', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                      Origin Branch (Sending) <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      value={sourceBranch}
                      onChange={(e) => handleSourceBranchChange(e.target.value as BranchLocation)}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {OFFICIAL_TRANSFER_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleSwapBranches}
                    title="Swap Route Direction"
                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0284C7', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '1rem' }}
                  >
                    <ArrowRightLeft size={16} />
                  </button>

                  <div>
                    <label style={{ color: '#475569', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                      Destination Branch (Receiving) <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      value={destinationBranch}
                      onChange={(e) => setDestinationBranch(e.target.value as BranchLocation)}
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {OFFICIAL_TRANSFER_BRANCHES.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {sourceBranch === destinationBranch && (
                  <div style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={13} /> Origin and destination cannot be the same branch!
                  </div>
                )}
              </div>

              {/* PRODUCT SELECTION & SENDER BRANCH AVAILABILITY */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <div style={{ color: '#0F172A', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Material & Product Selection
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0369A1', fontWeight: 600 }}>
                    Stock Availability at {branchLabelFor(sourceBranch)}
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#475569', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Select Product from {branchLabelFor(sourceBranch)} Inventory <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value);
                      const sel = products.find((p) => p.id === e.target.value);
                      const avail = Number(sel?.stockQuantity ?? sel?.currentStock ?? 1);
                      setTransferWeight(String(Math.min(5, Math.max(1, avail))));
                    }}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {products.length === 0 ? (
                      <option value="">No products available at {branchLabelFor(sourceBranch)}</option>
                    ) : (
                      products.map((p) => {
                        const stockCount = Number(p.stockQuantity ?? p.currentStock ?? 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.productName || p.sku || 'N/A'} — {p.grade?.replace(/_/g, ' ')} ({stockCount} units available at {branchLabelFor(sourceBranch)})
                          </option>
                        );
                      })
                    )}
                  </select>
                </div>

                {activeProduct && (
                  <div style={{ background: '#FFFFFF', padding: '0.75rem 0.9rem', borderRadius: '6px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ color: '#475569' }}>SKU / Heat #: </span>
                      <strong style={{ color: '#0369A1' }}>{activeProduct.sku || '—'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#475569' }}>Specs / Dimensions: </span>
                      <strong style={{ color: '#0F172A' }}>{activeProduct.dimensions || activeProduct.size || 'Standard'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#475569' }}>Current Branch Stock: </span>
                      <strong style={{ color: (activeProduct.stockQuantity ?? activeProduct.currentStock ?? 0) > 0 ? '#059669' : '#DC2626' }}>
                        {activeProduct.stockQuantity ?? activeProduct.currentStock ?? 0} units
                      </strong>
                    </div>
                  </div>
                )}

                {/* Tonnage entry & Add to manifest button */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ color: '#475569', fontSize: '0.8rem' }}>
                        Transfer Weight / Quantity (Units/Tons) <span style={{ color: '#DC2626' }}>*</span>
                      </label>
                      {activeProduct && (
                        <span style={{ fontSize: '0.72rem', color: '#0369A1' }}>
                          In-Stock at {branchLabelFor(sourceBranch)}: <strong>{activeProduct.stockQuantity ?? activeProduct.currentStock ?? 0}</strong>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={transferWeight}
                      onChange={(e) => handleWeightChange(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#FFFFFF',
                        border: formError ? '1px solid #DC2626' : '1px solid #CBD5E1',
                        color: '#0F172A',
                        padding: '0.55rem',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToManifest}
                    disabled={!activeProduct || (activeProduct.stockQuantity ?? activeProduct.currentStock ?? 0) <= 0}
                    className="btn-primary"
                    style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
                  >
                    <Plus size={15} /> Add to Transfer List
                  </button>
                </div>

                {formError && (
                  <div style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <AlertCircle size={13} /> {formError}
                  </div>
                )}
              </div>

              {/* DYNAMIC MULTI-ITEM TRANSFER MANIFEST */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ color: '#0F172A', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Transfer Manifest List ({manifest.length} Product{manifest.length === 1 ? '' : 's'})
                  </div>
                  {manifest.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#0369A1', fontWeight: 700 }}>
                      Total Weight: {manifest.reduce((sum, m) => sum + m.weightInTons, 0).toFixed(2)} Tons
                    </div>
                  )}
                </div>

                {manifest.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#64748B', fontSize: '0.8rem', background: '#FFFFFF', borderRadius: 6, border: '1px dashed #CBD5E1' }}>
                    No products added to manifest yet. Select a product above and click "<strong>+ Add to Transfer List</strong>" to build a multi-item dispatch request.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', background: '#FFFFFF', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569', textAlign: 'left' }}>
                          <th style={{ padding: '0.5rem 0.6rem' }}>Product / SKU</th>
                          <th style={{ padding: '0.5rem 0.6rem' }}>Grade & Specs</th>
                          <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>Sender Stock</th>
                          <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>Transfer Weight</th>
                          <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manifest.map((m) => (
                          <tr key={m.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '0.5rem 0.6rem' }}>
                              <strong style={{ color: '#0F172A' }}>{m.product.productName || m.product.sku}</strong>
                              <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{m.product.sku}</div>
                            </td>
                            <td style={{ padding: '0.5rem 0.6rem', color: '#475569' }}>
                              {m.product.grade?.replace(/_/g, ' ')} · {m.product.dimensions || 'Standard'}
                            </td>
                            <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                              <span style={{ background: '#ECFDF5', color: '#059669', padding: '0.15rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                                {m.availableStock} in-stock
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 700, color: '#0284C7' }}>
                              {m.weightInTons.toFixed(2)} Tons
                            </td>
                            <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromManifest(m.id)}
                                style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '0.2rem' }}
                                title="Remove item"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* URGENCY & PURPOSE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>
                    Transfer Urgency Tier
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="Regular Rebalancing">Regular Rebalancing</option>
                    <option value="Urgent Customer Demand">Urgent Customer Demand</option>
                    <option value="Stock Shortage Mitigation">Stock Shortage Mitigation</option>
                  </select>
                </div>
              </div>

              {/* PURPOSE / REMARKS */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  Transfer Remarks / Trucking Waybill Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Carrier / plate number, receiving dock notes, or order requisition ref..."
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>

              {/* MODAL FOOTER */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #CBD5E1', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={sourceBranch === destinationBranch || !!formError || (manifest.length === 0 && !activeProduct)}
                >
                  Submit Transfer Request ({manifest.length > 0 ? `${manifest.length} Item${manifest.length > 1 ? 's' : ''}` : '1 Item'})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
