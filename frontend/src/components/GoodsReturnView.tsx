import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  FileText,
  Printer,
  X,
  XCircle,
  Sparkles,
  AlertCircle,
  Building2,
  Check,
  RefreshCw,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { GoodsReturnSlip, CreateGrsDto, ReturnReason, HeatLookupResult } from '../types/returns';
import {
  fetchGoodsReturns,
  createGoodsReturn,
  approveGoodsReturn,
  rejectGoodsReturn,
  lookupHeatNumberForReturn,
} from '../services/api';
import { TableExportButtons } from './TableExportButtons';
import { formatPHP } from '../utils/currency';

interface GoodsReturnViewProps {
  currentBranch?: BranchLocation;
  currentUserName: string;
}

const COMMON_HEAT_SUGGESTIONS = [
  'HT-2026-8841',
  'HT-2026-1049',
  'HT-2026-9021',
  'HT-2026-3312',
];

export function GoodsReturnView({ currentBranch, currentUserName }: GoodsReturnViewProps) {
  const [returns, setReturns] = useState<GoodsReturnSlip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [creditNoteModalSlip, setCreditNoteModalSlip] = useState<GoodsReturnSlip | null>(null);

  // Reject Modal State
  const [rejectingSlip, setRejectingSlip] = useState<GoodsReturnSlip | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('Outside warranty return window / Non-factory defect');

  // Heat Autocomplete Form Fields
  const [heatNumber, setHeatNumber] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [autoMatched, setAutoMatched] = useState<boolean>(false);
  const [lookupFeedback, setLookupFeedback] = useState<string>('');

  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [dimensions, setDimensions] = useState<string>('');
  const [purchasedQtyTons, setPurchasedQtyTons] = useState<number>(0);
  const [purchasedQtyPieces, setPurchasedQtyPieces] = useState<number | undefined>(undefined);
  const [maxReturnableTons, setMaxReturnableTons] = useState<number>(0);

  const [returnedTons, setReturnedTons] = useState<string>('');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [reason, setReason] = useState<ReturnReason>('Quality_Defect_Rust');
  const [restockEligible, setRestockEligible] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [qtyError, setQtyError] = useState<string>('');

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

  const resetForm = () => {
    setHeatNumber('');
    setIsLookingUp(false);
    setAutoMatched(false);
    setLookupFeedback('');
    setInvoiceNumber('');
    setCustomerName('');
    setGrade('');
    setDimensions('');
    setPurchasedQtyTons(0);
    setPurchasedQtyPieces(undefined);
    setMaxReturnableTons(0);
    setReturnedTons('');
    setUnitPrice('');
    setReason('Quality_Defect_Rust');
    setRestockEligible(false);
    setNotes('');
    setQtyError('');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const handleHeatLookup = async (queryHeat: string) => {
    const clean = queryHeat.trim().toUpperCase();
    setHeatNumber(clean);

    if (!clean || clean.length < 3) {
      setAutoMatched(false);
      setLookupFeedback('');
      return;
    }

    setIsLookingUp(true);
    setLookupFeedback('');

    try {
      const res: HeatLookupResult | null = await lookupHeatNumberForReturn(clean);
      if (res) {
        setInvoiceNumber(res.invoiceNumber);
        setCustomerName(res.customerName);
        setGrade(res.grade);
        setDimensions(res.dimensions);
        setPurchasedQtyTons(res.purchasedQtyTons);
        setPurchasedQtyPieces(res.purchasedQtyPieces);
        setMaxReturnableTons(res.maxReturnableTons);
        setUnitPrice(res.unitPricePerTonPHP.toString());
        // Default return qty to a reasonable fraction or full purchase
        const initialReturn = Math.min(1.0, res.purchasedQtyTons);
        setReturnedTons(initialReturn.toString());
        setAutoMatched(true);
        setLookupFeedback(`Found sold item under Invoice #${res.invoiceNumber} for ${res.customerName}`);
        setQtyError('');
      } else {
        setAutoMatched(false);
        setLookupFeedback(`No past sales found for Heat #${clean}. Enter invoice details manually.`);
      }
    } catch (err) {
      console.error('Heat lookup failed:', err);
      setAutoMatched(false);
      setLookupFeedback('Lookup failed. Enter details manually.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleReturnedTonsChange = (val: string) => {
    // Sanitize non-numeric input
    const clean = val.replace(/[^0-9.]/g, '');
    setReturnedTons(clean);

    const num = parseFloat(clean);
    if (!isNaN(num)) {
      if (maxReturnableTons > 0 && num > maxReturnableTons) {
        setQtyError(`Exceeds purchased limit! Customer purchased max ${maxReturnableTons} Tons.`);
      } else if (num <= 0) {
        setQtyError('Return weight must be greater than 0.');
      } else {
        setQtyError('');
      }
    } else {
      setQtyError('');
    }
  };

  const calculatedCreditTotal =
    (parseFloat(returnedTons) || 0) * (parseFloat(unitPrice) || 0);

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    const weightNum = parseFloat(returnedTons);
    if (isNaN(weightNum) || weightNum <= 0) {
      setQtyError('Please enter a valid return weight.');
      return;
    }

    if (maxReturnableTons > 0 && weightNum > maxReturnableTons) {
      setQtyError(`Cannot return ${weightNum} Tons. Maximum allowable return is ${maxReturnableTons} Tons.`);
      return;
    }

    const dto: CreateGrsDto = {
      invoiceNumber: invoiceNumber || 'INV-MANUAL',
      customerName: customerName || 'Walk-in Customer',
      branch: currentBranch || BranchLocation.Davao,
      requestedBy: currentUserName,
      notes: notes || undefined,
      items: [
        {
          batchId: crypto.randomUUID(),
          heatNumber: heatNumber.trim().toUpperCase(),
          grade: grade || 'A36_Structural',
          dimensions: dimensions || '12mm x 1500mm x 6000mm',
          quantityReturnedTons: weightNum,
          unitPricePerTonPHP: parseFloat(unitPrice) || 0,
          reason,
          restockEligible,
        },
      ],
    };

    await createGoodsReturn(dto);
    setIsCreateModalOpen(false);
    resetForm();
    await loadData();
  };

  const handleApprove = async (id: string) => {
    await approveGoodsReturn(id, currentUserName);
    await loadData();
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingSlip) return;

    await rejectGoodsReturn(rejectingSlip.id, currentUserName, rejectionReason);
    setRejectingSlip(null);
    await loadData();
  };

  const filteredReturns = returns.filter((r) => {
    const matchesSearch =
      r.grsNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.items.some((i) => i.heatNumber.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#000000', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Goods Return Slips (GRS) & Product Exchanges
          </h2>
          <p style={{ color: '#000000', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Process customer returns with automated Heat Number lookup, defect inspection, and owner approvals.
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={18} /> Create Return Slip (GRS)
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
        <div className="search-box" style={{ maxWidth: '400px', flex: 1 }}>
          <Search size={18} style={{ color: '#000000' }} />
          <input
            type="text"
            placeholder="Search GRS #, invoice #, customer, or heat #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#000000', fontSize: '0.85rem' }}>
            <Filter size={16} /> Status:
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="All">All Return Slips</option>
            <option value="Pending_Approval">Pending Approval</option>
            <option value="Approved">Approved / Issued CN</option>
            <option value="Rejected">Rejected Returns</option>
          </select>

          <TableExportButtons
            filename={`Goods_Return_Slips_${currentBranch || 'All'}`}
            title="Goods Return Slips (GRS) & Exchanges"
            headers={['GRS Number', 'Invoice Ref', 'Customer', 'Branch', 'Return Amount (PHP)', 'Items Count', 'Status', 'Date']}
            rows={filteredReturns.map((r) => [
              r.grsNumber,
              r.invoiceNumber,
              r.customerName,
              r.branch,
              `₱${Number(r.totalReturnAmount ?? (r as any).totalReturnValuePHP ?? 0).toLocaleString()}`,
              r.items.length,
              r.status,
              new Date(r.createdAt).toLocaleDateString(),
            ])}
          />
        </div>
      </div>

      {/* TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '8px', border: '1px solid #94A3B8', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#000000', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #94A3B8' }}>
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
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#000000' }}>
                  Loading Return Slips...
                </td>
              </tr>
            ) : filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#000000' }}>
                  No Goods Return Slips found matching filter.
                </td>
              </tr>
            ) : (
              filteredReturns.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#000000', fontSize: '0.9rem', background: '#FFFFFF' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#0284C7' }}>{r.grsNumber}</div>
                    <div style={{ color: '#000000', fontSize: '0.75rem' }}>Ref Invoice: {r.invoiceNumber}</div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#000000' }}>{r.customerName}</div>
                    <div style={{ color: '#000000', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Building2 size={12} /> Branch: {r.branch}
                    </div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    {r.items.map((i) => (
                      <div key={i.id} style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, color: '#000000' }}>{i.heatNumber}</span> ({i.quantityReturnedTons} Tons - {i.reason.replace(/_/g, ' ')})
                      </div>
                    ))}
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#000000' }}>
                    {formatPHP(r.totalReturnAmount)}
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
                    {r.status === 'Rejected' && (
                      <div>
                        <span style={{ background: '#7F1D1D', color: '#F87171', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <XCircle size={12} /> Rejected
                        </span>
                        {r.rejectionReason && (
                          <div style={{ color: '#EF4444', fontSize: '0.72rem', marginTop: '0.2rem', maxWidth: '180px' }} title={r.rejectionReason}>
                            Reason: {r.rejectionReason}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      {r.status === 'Pending_Approval' && (
                        <>
                          <button
                            className="btn-primary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => handleApprove(r.id)}
                            title="Approve Return and Issue Credit Note"
                          >
                            <CheckCircle2 size={12} /> Approve
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' }}
                            onClick={() => {
                              setRejectingSlip(r);
                              setRejectionReason('Outside warranty return window / Non-factory defect');
                            }}
                            title="Reject Return with Reason"
                          >
                            <Ban size={12} /> Reject
                          </button>
                        </>
                      )}

                      {r.status === 'Approved' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
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

      {/* CREATE RETURN SLIP MODAL (WITH HEAT NUMBER AUTOCOMPLETE) */}
      {isCreateModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #CBD5E1', width: '100%', maxWidth: '680px', padding: '1.75rem', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2), 0 8px 10px -6px rgba(15, 23, 42, 0.1)' }}>
            
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '12px', background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <RotateCcw size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#000000', fontSize: '1.25rem', fontWeight: 700 }}>
                    Issue Goods Return Slip (GRS)
                  </h3>
                  <p style={{ margin: '0.2rem 0 0 0', color: '#000000', fontSize: '0.82rem' }}>
                    Lookup Heat Number to auto-fill purchase history, customer specs, and maximum return limits.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#000000', cursor: 'pointer', padding: '0.35rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReturn}>
              {/* SMART HEAT NUMBER LOOKUP SECTION */}
              <div style={{ background: '#F8FAFC', padding: '1rem 1.15rem', borderRadius: '10px', border: '1px solid #BAE6FD', marginBottom: '1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ color: '#0369A1', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={15} color="#0284C7" /> Batch / Heat Number Search <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  {isLookingUp && (
                    <span style={{ fontSize: '0.75rem', color: '#0284C7', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}>
                      <RefreshCw size={12} className="spin-icon" /> Querying Sales Ledger...
                    </span>
                  )}
                  {autoMatched && (
                    <span style={{ fontSize: '0.75rem', color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.15rem 0.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                      <Check size={13} /> Auto-Filled from Sales Record
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    required
                    placeholder="Enter or paste Heat # (e.g. HT-2026-8841)..."
                    value={heatNumber}
                    onChange={(e) => handleHeatLookup(e.target.value)}
                    style={{ flex: 1, background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => handleHeatLookup(heatNumber)}
                    style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    Lookup
                  </button>
                </div>

                {/* QUICK SUGGESTION CHIPS */}
                <div style={{ marginTop: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#000000', fontSize: '0.75rem' }}>Quick sample heats:</span>
                  {COMMON_HEAT_SUGGESTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHeatLookup(h)}
                      style={{ background: '#FFFFFF', color: '#0369A1', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}
                    >
                      {h}
                    </button>
                  ))}
                </div>

                {lookupFeedback && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: autoMatched ? '#059669' : '#D97706', fontWeight: 500 }}>
                    {lookupFeedback}
                  </div>
                )}
              </div>

              {/* AUTO-FILLED SALES METADATA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1.15rem' }}>
                <div>
                  <label style={{ color: '#000000', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Original Sales Invoice # <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-0041"
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#000000', fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Customer / Buyer Name <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Mindanao Steelworks Corp."
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem 0.8rem', borderRadius: '8px', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* PRODUCT SPECIFICATIONS & PRICE BASIS */}
              <div style={{ background: '#F8FAFC', padding: '1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '1.15rem' }}>
                <div style={{ color: '#000000', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Product Specifications & Price Basis
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Steel Grade</label>
                    <input
                      type="text"
                      required
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      placeholder="e.g. A36_Structural"
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Batch Dimensions</label>
                    <input
                      type="text"
                      required
                      value={dimensions}
                      onChange={(e) => setDimensions(e.target.value)}
                      placeholder="e.g. 12mm x 1500mm x 6000mm"
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Original Purchased Qty</label>
                    <div style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0284C7', padding: '0.55rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                      {purchasedQtyTons > 0 ? `${purchasedQtyTons} Tons (${purchasedQtyPieces ?? 'N/A'} Pieces)` : 'Not specified'}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Unit Price (PHP / Ton)</label>
                    <input
                      type="number"
                      required
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      placeholder="85000"
                      style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* RETURN QUANTITY & CALCULATED CREDIT */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600 }}>
                        Return Quantity (Tons) <span style={{ color: '#EF4444' }}>*</span>
                      </label>
                      {maxReturnableTons > 0 && (
                        <span style={{ fontSize: '0.7rem', color: '#0284C7', fontWeight: 600 }}>Max: {maxReturnableTons} Tons</span>
                      )}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={returnedTons}
                      onChange={(e) => handleReturnedTonsChange(e.target.value)}
                      placeholder="0.00"
                      style={{
                        width: '100%',
                        background: '#FFFFFF',
                        border: qtyError ? '1px solid #EF4444' : '1px solid #CBD5E1',
                        color: '#000000',
                        padding: '0.55rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        fontFamily: 'monospace',
                      }}
                    />
                    {qtyError && (
                      <div style={{ color: '#DC2626', fontSize: '0.72rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertCircle size={12} /> {qtyError}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Calculated Total Credit</label>
                    <div style={{ width: '100%', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#059669', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                      ₱{calculatedCreditTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* REASON FOR RETURN & INSPECTION NOTES */}
              <div style={{ background: '#F8FAFC', padding: '1.1rem', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
                <div style={{ color: '#000000', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Material Inspection & Return Justification
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Reason for Return
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as ReturnReason)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="Quality_Defect_Rust">Quality Defect / Surface Rust / Lamination</option>
                    <option value="Damaged_In_Transit">Damaged in Transit / Crushed Bundles</option>
                    <option value="Incorrect_Specification">Incorrect Dimension / Steel Grade Delivered</option>
                    <option value="Over_Quantity_Delivered">Excess / Over-Quantity Delivered</option>
                    <option value="Customer_Cancellation">Customer Project Cancellation</option>
                  </select>
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ color: '#000000', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                    Inspection Notes & Quality Condition
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Detail physical inspection findings, defect photos reference, or receiver remarks..."
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.55rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#FFFFFF', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                  <input
                    type="checkbox"
                    id="restockChk"
                    checked={restockEligible}
                    onChange={(e) => setRestockEligible(e.target.checked)}
                    style={{ accentColor: '#0284C7', cursor: 'pointer' }}
                  />
                  <label htmlFor="restockChk" style={{ color: '#000000', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
                    Material is in reusable condition — Eligible for Yard Restock upon Approval
                  </label>
                </div>
              </div>

              {/* FOOTER ACTIONS */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #F1F5F9', paddingTop: '1rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={!!qtyError} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem' }}>
                  <RotateCcw size={16} /> Submit Goods Return Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT RETURN SLIP MODAL (OWNER / MANAGER REJECTION FLOW) */}
      {rejectingSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #FCA5A5', width: '90%', maxWidth: '480px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#000000', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Ban size={18} style={{ color: '#EF4444' }} /> Reject Return Slip #{rejectingSlip.grsNumber}
              </h3>
              <button onClick={() => setRejectingSlip(null)} style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#FFFFFF', padding: '0.85rem', borderRadius: '6px', border: '1px solid #CBD5E1', marginBottom: '1rem', fontSize: '0.85rem', color: '#000000', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div><strong>Customer:</strong> {rejectingSlip.customerName}</div>
              <div><strong>Ref Invoice:</strong> {rejectingSlip.invoiceNumber}</div>
              <div><strong>Return Value:</strong> {formatPHP(rejectingSlip.totalReturnAmount)}</div>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#000000', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Reason for Rejection <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Specify why the return request is denied (e.g. buyer alteration, elapsed warranty, non-compliant return)..."
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setRejectingSlip(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#DC2626', borderColor: '#DC2626' }}>
                  Confirm Denial / Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDIT NOTE PRINTABLE MODAL (EXCLUDING BUTTONS WHEN PRINTING) */}
      {creditNoteModalSlip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '8px', width: '90%', maxWidth: '700px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>STEELTRACK ENTERPRISE</h2>
                <div style={{ fontSize: '0.85rem', color: '#000000' }}>Industrial Steel Logistics & Distribution</div>
                <div style={{ fontSize: '0.85rem', color: '#000000' }}>Branch: {creditNoteModalSlip.branch} Operations</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0284C7' }}>OFFICIAL CREDIT NOTE</h3>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#000000', marginTop: '0.2rem' }}>
                  {creditNoteModalSlip.creditNoteNumber || `CN-${creditNoteModalSlip.grsNumber}`}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#000000' }}>
                  Date: {creditNoteModalSlip.approvedAt ? new Date(creditNoteModalSlip.approvedAt).toLocaleDateString('en-PH') : new Date().toLocaleDateString('en-PH')}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#F8FAFC', padding: '1rem', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem', border: '1px solid #E2E8F0' }}>
              <div>
                <div><strong>Credited Customer:</strong> {creditNoteModalSlip.customerName}</div>
                <div><strong>Ref Invoice #:</strong> {creditNoteModalSlip.invoiceNumber}</div>
                <div><strong>GRS Slip #:</strong> {creditNoteModalSlip.grsNumber}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Requested By:</strong> {creditNoteModalSlip.requestedBy}</div>
                <div><strong>Approved By:</strong> {creditNoteModalSlip.approvedBy || 'Owner / Controller'}</div>
                <div><strong>Status:</strong> <span style={{ color: '#059669', fontWeight: 700 }}>CREDIT MEMO ISSUED</span></div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94A3B8', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <thead>
                <tr style={{ background: '#E2E8F0', color: '#000000' }}>
                  <th style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'left' }}>Heat #</th>
                  <th style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'left' }}>Grade & Dimensions</th>
                  <th style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'center' }}>Tons</th>
                  <th style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'right' }}>Unit Price (PHP)</th>
                  <th style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'right' }}>Credit Total</th>
                </tr>
              </thead>
              <tbody>
                {creditNoteModalSlip.items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ padding: '0.55rem', border: '1px solid #94A3B8', fontWeight: 600 }}>{i.heatNumber}</td>
                    <td style={{ padding: '0.55rem', border: '1px solid #94A3B8' }}>{i.grade} ({i.dimensions})</td>
                    <td style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'center' }}>{i.quantityReturnedTons}</td>
                    <td style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'right' }}>{formatPHP(i.unitPricePerTonPHP)}</td>
                    <td style={{ padding: '0.55rem', border: '1px solid #94A3B8', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      {formatPHP(i.subtotalPHP)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginBottom: '1.5rem' }}>
              Total Credit Allowed: {formatPHP(creditNoteModalSlip.totalReturnAmount)}
            </div>

            <div style={{ borderTop: '1px solid #94A3B8', paddingTop: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', textAlign: 'center', fontSize: '0.8rem', color: '#000000' }}>
              <div>
                <div style={{ borderBottom: '1px solid #0F172A', height: '2rem', marginBottom: '0.35rem' }}></div>
                <div style={{ fontWeight: 700, color: '#000000' }}>{creditNoteModalSlip.approvedBy || 'Branch Controller'}</div>
                <div>Authorized Executive Signatory</div>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #0F172A', height: '2rem', marginBottom: '0.35rem' }}></div>
                <div style={{ fontWeight: 700, color: '#000000' }}>{creditNoteModalSlip.customerName}</div>
                <div>Customer Conforme / Acknowledged</div>
              </div>
            </div>

            {/* ACTION BUTTONS (NO PRINT) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn-secondary no-print"
                onClick={() => setCreditNoteModalSlip(null)}
                style={{ background: '#E2E8F0', border: 'none', color: '#000000', padding: '0.55rem 1.25rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-primary no-print"
                onClick={() => window.print()}
                style={{ background: '#0284C7', border: 'none', color: '#FFFFFF', padding: '0.55rem 1.25rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
              >
                <Printer size={16} /> Print Credit Note (PDF)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
