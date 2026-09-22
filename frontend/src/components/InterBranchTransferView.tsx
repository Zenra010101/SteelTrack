import { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, Plus, CheckCircle, Clock, Truck } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Transfer Form State
  const [sourceBranch, setSourceBranch] = useState<BranchLocation>(
    currentBranch || BranchLocation.Makati
  );
  const [destinationBranch, setDestinationBranch] = useState<BranchLocation>(
    currentBranch === BranchLocation.Davao ? BranchLocation.Makati : BranchLocation.Davao
  );
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [transferWeight, setTransferWeight] = useState<number>(10);
  const [notes, setNotes] = useState<string>('');

  const loadTransfersAndInventory = useCallback(async () => {
    const [trList, invResult] = await Promise.all([
      fetchTransfers(currentBranch),
      fetchInventory(undefined, undefined, undefined, currentBranch),
    ]);
    setTransfers(trList);
    setBatches(invResult.data);
    if (invResult.data.length > 0 && !selectedBatchId) {
      setSelectedBatchId(invResult.data[0].id);
    }
  }, [currentBranch, selectedBatchId]);

  useEffect(() => {
    loadTransfersAndInventory();
  }, [loadTransfersAndInventory]);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const batch = batches.find((b) => b.id === selectedBatchId);
    if (!batch) return;

    await createTransferRequest({
      sourceBranch,
      destinationBranch,
      batchId: batch.id,
      heatNumber: batch.heatNumber,
      grade: batch.grade,
      weightInTons: transferWeight,
      requestedBy: currentUserName,
      notes,
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
          <span className="badge badge-inproduction">
            <Clock size={12} style={{ marginRight: 4 }} /> Pending Approval
          </span>
        );
      case 'Approved':
        return (
          <span className="badge badge-qualitycheck">
            <CheckCircle size={12} style={{ marginRight: 4 }} /> Approved
          </span>
        );
      case 'InTransit':
        return (
          <span className="badge badge-reserved">
            <Truck size={12} style={{ marginRight: 4 }} /> In Transit
          </span>
        );
      case 'Completed':
        return (
          <span className="badge badge-available">
            <CheckCircle size={12} style={{ marginRight: 4 }} /> Completed
          </span>
        );
      default:
        return <span className="badge badge-shipped">{status}</span>;
    }
  };

  return (
    <div className="transfer-container">
      <div className="controls-bar">
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            Inter-Branch Stock Transfer System
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
            Coordinate stock transfers across Davao, Makati, Mandaue, and Cebu branches
          </p>
        </div>

        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Request New Stock Transfer
        </button>
      </div>

      {/* Transfer List Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Route (Source → Destination)</th>
              <th>Steel Batch / Heat #</th>
              <th>Tonnage</th>
              <th>Requested By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#94A3B8', padding: '2rem' }}>
                  No active stock transfers found for this branch.
                </td>
              </tr>
            ) : (
              transfers.map((tr) => (
                <tr key={tr.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38BDF8' }}>
                    {tr.id}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="branch-tag">{tr.sourceBranch}</span>
                      <ArrowRightLeft size={14} style={{ color: '#94A3B8' }} />
                      <span className="branch-tag highlight">{tr.destinationBranch}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tr.heatNumber}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>{tr.grade}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{tr.weightInTons} Tons</td>
                  <td style={{ fontSize: '0.85rem', color: '#CBD5E1' }}>{tr.requestedBy}</td>
                  <td>{getStatusBadge(tr.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {tr.status === 'Pending' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#10B981', borderColor: 'rgba(16,185,129,0.3)' }}
                          onClick={() => handleStatusChange(tr.id, 'Approved')}
                        >
                          Approve
                        </button>
                      )}
                      {tr.status === 'Approved' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#38BDF8', borderColor: 'rgba(56,189,248,0.3)' }}
                          onClick={() => handleStatusChange(tr.id, 'InTransit')}
                        >
                          Dispatch
                        </button>
                      )}
                      {tr.status === 'InTransit' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#6EE7B7', borderColor: 'rgba(16,185,129,0.3)' }}
                          onClick={() => handleStatusChange(tr.id, 'Completed')}
                        >
                          Confirm Receipt
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

      {/* New Transfer Request Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Initiate Inter-Branch Transfer</h3>
              <button
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransfer}>
              <div className="form-group">
                <label>Source Branch (Sending Stock)</label>
                <select
                  value={sourceBranch}
                  onChange={(e) => setSourceBranch(e.target.value as BranchLocation)}
                >
                  <option value={BranchLocation.Davao}>Davao Branch</option>
                  <option value={BranchLocation.Makati}>Makati Branch</option>
                  <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
                  <option value={BranchLocation.Cebu}>Cebu Branch</option>
                </select>
              </div>

              <div className="form-group">
                <label>Destination Branch (Receiving Stock)</label>
                <select
                  value={destinationBranch}
                  onChange={(e) => setDestinationBranch(e.target.value as BranchLocation)}
                >
                  <option value={BranchLocation.Davao}>Davao Branch</option>
                  <option value={BranchLocation.Makati}>Makati Branch</option>
                  <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
                  <option value={BranchLocation.Cebu}>Cebu Branch</option>
                </select>
              </div>

              <div className="form-group">
                <label>Select Steel Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.heatNumber} - {b.grade} ({b.weightInTons}T available at {b.branch})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Transfer Tonnage (Tons)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={transferWeight}
                  onChange={(e) => setTransferWeight(parseFloat(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Transfer Purpose / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Urgent construction order demand..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
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
