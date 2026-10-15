import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  Plus,
  CheckCircle,
  Clock,
  Truck,
  X,
  AlertCircle,
  Ban,
  Check,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { StockTransferRequest, TransferStatus } from '../types/transfer';
import {
  fetchTransfers,
  createTransferRequest,
  updateTransferStatus,
  fetchInventory,
} from '../services/api';
import type { SteelBatch } from '../types/steel';

interface InterBranchTransferViewProps {
  currentBranch?: BranchLocation;
  currentUserName: string;
}

export function InterBranchTransferView({
  currentBranch,
  currentUserName,
}: InterBranchTransferViewProps) {
  const [transfers, setTransfers] = useState<StockTransferRequest[]>([]);
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Modern Transfer Form State
  const [sourceBranch, setSourceBranch] = useState<BranchLocation>(
    currentBranch || BranchLocation.Davao
  );
  const [destinationBranch, setDestinationBranch] = useState<BranchLocation>(
    currentBranch === BranchLocation.Davao ? BranchLocation.Cagayan : BranchLocation.Davao
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [transferWeight, setTransferWeight] = useState<string>('5.0');
  const [urgency, setUrgency] = useState<string>('Regular Rebalancing');
  const [notes, setNotes] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const loadTransfersAndInventory = useCallback(async () => {
    setLoading(true);
    try {
      const [trList, invResult] = await Promise.all([
        fetchTransfers(currentBranch),
        fetchInventory(undefined, undefined, undefined, currentBranch),
      ]);
      setTransfers(trList);
      setBatches(invResult.data);
      if (invResult.data.length > 0 && !selectedBatchId) {
        setSelectedBatchId(invResult.data[0].id);
      }
    } catch (err) {
      console.error('Error loading transfers:', err);
    } finally {
      setLoading(false);
    }
  }, [currentBranch, selectedBatchId]);

  useEffect(() => {
    loadTransfersAndInventory();
  }, [loadTransfersAndInventory]);

  // Selected batch object
  const activeBatch = batches.find((b) => b.id === selectedBatchId);

  const handleOpenModal = () => {
    const src = currentBranch || BranchLocation.Davao;
    setSourceBranch(src);
    setDestinationBranch(src === BranchLocation.Davao ? BranchLocation.Cagayan : BranchLocation.Davao);
    if (batches.length > 0) {
      setSelectedBatchId(batches[0].id);
      setTransferWeight(Math.min(5.0, batches[0].weightInTons).toString());
    } else {
      setTransferWeight('5.0');
    }
    setUrgency('Regular Rebalancing');
    setNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSwapBranches = () => {
    const temp = sourceBranch;
    setSourceBranch(destinationBranch);
    setDestinationBranch(temp);
  };

  const handleWeightChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '');
    setTransferWeight(clean);

    const num = parseFloat(clean);
    if (activeBatch && num > activeBatch.weightInTons) {
      setFormError(`Transfer weight exceeds available batch stock of ${activeBatch.weightInTons} Tons!`);
    } else if (num <= 0 || isNaN(num)) {
      setFormError('Please enter a valid transfer tonnage.');
    } else {
      setFormError('');
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceBranch === destinationBranch) {
      setFormError('Source and Destination branches cannot be identical!');
      return;
    }

    const batch = batches.find((b) => b.id === selectedBatchId);
    if (!batch) {
      setFormError('Please select a valid steel batch to transfer.');
      return;
    }

    const weightNum = parseFloat(transferWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setFormError('Please enter a valid transfer tonnage.');
      return;
    }

    if (weightNum > batch.weightInTons) {
      setFormError(`Transfer weight exceeds available batch stock of ${batch.weightInTons} Tons!`);
      return;
    }

    await createTransferRequest({
      sourceBranch,
      destinationBranch,
      batchId: batch.id,
      heatNumber: batch.heatNumber,
      grade: batch.grade,
      weightInTons: weightNum,
      requestedBy: currentUserName,
      notes: `${urgency}: ${notes || 'Stock transfer request'}`,
    });

    setIsModalOpen(false);
    loadTransfersAndInventory();
  };

  const handleStatusChange = async (id: string, newStatus: TransferStatus) => {
    await updateTransferStatus(id, newStatus, currentUserName);
    loadTransfersAndInventory();
  };

  const getStatusBadge = (status: TransferStatus) => {
    switch (status) {
      case 'Pending':
        return (
          <span style={{ background: '#78350F', color: '#FDE68A', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={12} /> Pending Approval
          </span>
        );
      case 'Approved':
        return (
          <span style={{ background: '#1E3A8A', color: '#93C5FD', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={12} /> Approved
          </span>
        );
      case 'InTransit':
        return (
          <span style={{ background: '#075985', color: '#7DD3FC', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Truck size={12} /> In Transit
          </span>
        );
      case 'Completed':
        return (
          <span style={{ background: '#064E3B', color: '#34D399', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={12} /> Completed
          </span>
        );
      default:
        return (
          <span style={{ background: '#334155', color: '#CBD5E1', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700 }}>
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
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Inter-Branch Stock Transfer System
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Coordinate and track logistics transfer routes across Davao, Cagayan, Mandaue, and Cebu branches.
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenModal}>
          <Plus size={18} /> Request Stock Transfer
        </button>
      </div>

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
                    {tr.id}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="branch-tag">{tr.sourceBranch}</span>
                      <ArrowRightLeft size={14} style={{ color: '#0284C7' }} />
                      <span className="branch-tag highlight">{tr.destinationBranch}</span>
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
                    <div style={{ fontSize: '0.85rem', color: '#334155' }}>{tr.requestedBy}</div>
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
                            onClick={() => handleStatusChange(tr.id, 'Completed')} // or cancel
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
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '92%', maxWidth: '580px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)' }}>
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38BDF8' }}>
                  <Truck size={20} /> Request Inter-Branch Transfer
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#94A3B8', fontSize: '0.8rem' }}>
                  Establish an authenticated dispatch manifest between regional facilities.
                </p>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer}>
              {/* ROUTE CONFIGURATION CARD */}
              <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', marginBottom: '1rem' }}>
                <div style={{ color: '#CBD5E1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Logistics Transfer Route
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
                  <div>
                    <label style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                      Origin Branch (Sending) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <select
                      value={sourceBranch}
                      onChange={(e) => setSourceBranch(e.target.value as BranchLocation)}
                      style={{ width: '100%', background: '#1E293B', border: '1px solid #475569', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <option value={BranchLocation.Davao}>Davao Facility</option>
                      <option value={BranchLocation.Cagayan}>Cagayan Facility</option>
                      <option value={BranchLocation.Mandaue}>Mandaue Yard</option>
                      <option value={BranchLocation.Cebu}>Cebu Operations</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleSwapBranches}
                    title="Swap Route Direction"
                    style={{ background: '#1E293B', border: '1px solid #475569', color: '#38BDF8', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '1rem' }}
                  >
                    <ArrowRightLeft size={16} />
                  </button>

                  <div>
                    <label style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                      Destination Branch (Receiving) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <select
                      value={destinationBranch}
                      onChange={(e) => setDestinationBranch(e.target.value as BranchLocation)}
                      style={{ width: '100%', background: '#1E293B', border: '1px solid #475569', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      <option value={BranchLocation.Davao}>Davao Facility</option>
                      <option value={BranchLocation.Cagayan}>Cagayan Facility</option>
                      <option value={BranchLocation.Mandaue}>Mandaue Yard</option>
                      <option value={BranchLocation.Cebu}>Cebu Operations</option>
                    </select>
                  </div>
                </div>

                {sourceBranch === destinationBranch && (
                  <div style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={13} /> Origin and destination cannot be the same branch!
                  </div>
                )}
              </div>

              {/* BATCH SELECTION & SPECS */}
              <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', marginBottom: '1rem' }}>
                <div style={{ color: '#CBD5E1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Material & Steel Batch Selection
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Select Steel Batch from Inventory <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    style={{ width: '100%', background: '#1E293B', border: '1px solid #475569', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.heatNumber} — {b.grade.replace(/_/g, ' ')} ({b.weightInTons}T available at {b.branch})
                      </option>
                    ))}
                  </select>
                </div>

                {activeBatch && (
                  <div style={{ background: '#1E293B', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid #334155', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.78rem' }}>
                    <div>
                      <span style={{ color: '#94A3B8' }}>Heat #: </span>
                      <strong style={{ color: '#38BDF8' }}>{activeBatch.heatNumber}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94A3B8' }}>Yard Bay: </span>
                      <strong style={{ color: '#F8FAFC' }}>{activeBatch.location}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#94A3B8' }}>Available: </span>
                      <strong style={{ color: '#34D399' }}>{activeBatch.weightInTons} Tons</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* TONNAGE & PURPOSE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <label style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                      Transfer Weight (Tons) <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    {activeBatch && (
                      <span style={{ fontSize: '0.72rem', color: '#38BDF8' }}>Max: {activeBatch.weightInTons}T</span>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    value={transferWeight}
                    onChange={(e) => handleWeightChange(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0F172A',
                      border: formError ? '1px solid #EF4444' : '1px solid #334155',
                      color: '#F8FAFC',
                      padding: '0.55rem',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                    }}
                  />
                  {formError && (
                    <div style={{ color: '#EF4444', fontSize: '0.72rem', marginTop: '0.25rem' }}>
                      {formError}
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>
                    Transfer Urgency
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="Regular Rebalancing">Regular Rebalancing</option>
                    <option value="Urgent Customer Demand">Urgent Customer Demand</option>
                    <option value="Stock Shortage Mitigation">Stock Shortage Mitigation</option>
                  </select>
                </div>
              </div>

              {/* PURPOSE / REMARKS */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  Transfer Remarks / Trucking Waybill Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Carrier / plate number, receiving dock notes, or order requisition ref..."
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>

              {/* MODAL FOOTER */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
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
                  disabled={sourceBranch === destinationBranch || !!formError}
                >
                  Submit Transfer Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
