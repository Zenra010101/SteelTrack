import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { GoodsReturnSlip, CreateGrsDto, ReturnReason } from '../types/returns';
import { fetchGoodsReturns, createGoodsReturn, approveGoodsReturn } from '../services/api';

interface GoodsReturnViewProps {
  currentBranch?: BranchLocation;
  currentUserName: string;
}

export function GoodsReturnView({ currentBranch, currentUserName }: GoodsReturnViewProps) {
  const [returns, setReturns] = useState<GoodsReturnSlip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [creditNoteModalSlip, setCreditNoteModalSlip] = useState<GoodsReturnSlip | null>(null);

  // Form Fields
  const [invoiceNumber, setInvoiceNumber] = useState<string>('INV-2026-0041');
  const [customerName, setCustomerName] = useState<string>('Mindanao Steelworks Corp.');
  const [heatNumber, setHeatNumber] = useState<string>('HT-2026-8841');
  const [grade, setGrade] = useState<string>('A36_Structural');
  const [dimensions, setDimensions] = useState<string>('12mm x 1500mm x 6000mm');
  const [returnedTons, setReturnedTons] = useState<string>('1.5');
  const [unitPrice, setUnitPrice] = useState<string>('85000');
  const [reason, setReason] = useState<ReturnReason>('Quality_Defect_Rust');
  const [restockEligible, setRestockEligible] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchGoodsReturns(currentBranch);
      setReturns(list);
    } catch (err) {
      console.error('Error fetching return slips:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const dto: CreateGrsDto = {
      invoiceNumber,
      customerName,
      branch: currentBranch || BranchLocation.Davao,
      requestedBy: currentUserName,
      notes,
      items: [
        {
          batchId: crypto.randomUUID(),
          heatNumber,
          grade,
          dimensions,
          quantityReturnedTons: parseFloat(returnedTons),
          unitPricePerTonPHP: parseFloat(unitPrice),
          reason,
          restockEligible,
        },
      ],
    };

    await createGoodsReturn(dto);
    setIsCreateModalOpen(false);
    await loadData();
  };

  const handleApprove = async (id: string) => {
    await approveGoodsReturn(id, currentUserName);
    await loadData();
  };

  const filteredReturns = returns.filter((r) => {
    const matchesSearch =
      r.grsNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Goods Return Slips (GRS) & Product Exchanges
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Process customer return slips, quality defect inspections, and restock approvals.
          </p>
        </div>

        <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={18} /> Create Return Slip (GRS)
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="search-box" style={{ maxWidth: '400px', flex: 1 }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search GRS #, invoice #, or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94A3B8', fontSize: '0.85rem' }}>
            <Filter size={16} /> Status:
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Return Slips</option>
            <option value="Pending_Approval">Pending Approval</option>
            <option value="Approved">Approved / Issued CN</option>
          </select>
        </div>
      </div>

      {/* TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>GRS # & Invoice</th>
              <th style={{ padding: '0.75rem 1rem' }}>Customer & Branch</th>
              <th style={{ padding: '0.75rem 1rem' }}>Returned Items</th>
              <th style={{ padding: '0.75rem 1rem' }}>Return Value (PHP)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  Loading Return Slips...
                </td>
              </tr>
            ) : filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  No Goods Return Slips found matching filter.
                </td>
              </tr>
            ) : (
              filteredReturns.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>{r.grsNumber}</div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Ref Invoice: {r.invoiceNumber}</div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{r.customerName}</div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Branch: {r.branch}</div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    {r.items.map((i) => (
                      <div key={i.id} style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{i.heatNumber}</span> ({i.quantityReturnedTons} Tons - {i.reason.replace(/_/g, ' ')})
                      </div>
                    ))}
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0F172A' }}>
                    ₱{r.totalReturnValuePHP.toLocaleString()}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    {r.status === 'Pending_Approval' && (
                      <span style={{ background: '#78350F', color: '#FBBF24', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Pending Approval
                      </span>
                    )}
                    {r.status === 'Approved' && (
                      <span style={{ background: '#064E3B', color: '#34D399', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Approved ({r.creditNoteNumber})
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {r.status === 'Pending_Approval' && (
                        <button
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => handleApprove(r.id)}
                        >
                          <CheckCircle2 size={12} /> Approve Return
                        </button>
                      )}

                      {r.status === 'Approved' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                          onClick={() => setCreditNoteModalSlip(r)}
                        >
                          <FileText size={12} /> Credit Note
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

      {/* CREATE RETURN SLIP MODAL */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '560px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.2rem', fontWeight: 700 }}>
                Issue Goods Return Slip (GRS)
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateReturn}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Ref Invoice #</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Customer Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', marginBottom: '1rem' }}>
                <div style={{ color: '#38BDF8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                  Return Batch Item Details
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Heat Number</label>
                    <input
                      type="text"
                      value={heatNumber}
                      onChange={(e) => setHeatNumber(e.target.value)}
                      style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Steel Grade</label>
                    <input
                      type="text"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Returned Weight (Tons)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={returnedTons}
                      onChange={(e) => setReturnedTons(e.target.value)}
                      style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Unit Price (PHP / Ton)</label>
                    <input
                      type="number"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Batch Dimensions</label>
                  <input
                    type="text"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    placeholder="e.g. 12mm x 1500mm x 6000mm"
                    style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Reason for Return</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReturnReason)}
                    style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                  >
                    <option value="Damaged_In_Transit">Damaged in Transit</option>
                    <option value="Quality_Defect_Rust">Quality Defect / Rust</option>
                    <option value="Incorrect_Specification">Incorrect Dimension / Grade Delivered</option>
                    <option value="Customer_Cancellation">Customer Order Cancellation</option>
                  </select>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#94A3B8', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Inspection Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Quality inspection findings or driver notes..."
                    style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="restockChk"
                    checked={restockEligible}
                    onChange={(e) => setRestockEligible(e.target.checked)}
                  />
                  <label htmlFor="restockChk" style={{ color: '#CBD5E1', fontSize: '0.8rem', cursor: 'pointer' }}>
                    Eligible for Yard Restock upon Approval
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Return Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDIT NOTE PRINTABLE MODAL */}
      {creditNoteModalSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', width: '90%', maxWidth: '650px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>STEELTRACK ENTERPRISE</h2>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>Official Credit Memo</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A' }}>CREDIT NOTE</h3>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0284C7' }}>{creditNoteModalSlip.creditNoteNumber}</div>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>Date: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div><strong>Customer:</strong> {creditNoteModalSlip.customerName}</div>
              <div><strong>Ref Invoice:</strong> {creditNoteModalSlip.invoiceNumber}</div>
              <div><strong>GRS Slip #:</strong> {creditNoteModalSlip.grsNumber}</div>
              <div><strong>Approved By:</strong> {creditNoteModalSlip.approvedBy || 'Branch Manager'}</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <thead>
                <tr style={{ background: '#E2E8F0' }}>
                  <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>Heat #</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>Grade & Dimensions</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>Tons</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>Unit Price</th>
                  <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>Credit Total</th>
                </tr>
              </thead>
              <tbody>
                {creditNoteModalSlip.items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>{i.heatNumber}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>{i.grade} ({i.dimensions})</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1', textAlign: 'center' }}>{i.quantityReturnedTons}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1', textAlign: 'right' }}>₱{i.unitPricePerTonPHP.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 700 }}>
                      ₱{i.subtotalPHP.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: '1.2rem', fontWeight: 800, color: '#059669', marginBottom: '1.5rem' }}>
              Total Credit Allowed: ₱{creditNoteModalSlip.totalReturnValuePHP.toLocaleString()}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setCreditNoteModalSlip(null)}
                style={{ background: '#E2E8F0', border: 'none', color: '#0F172A', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                style={{ background: '#0F172A', border: 'none', color: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Printer size={14} /> Print Credit Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
