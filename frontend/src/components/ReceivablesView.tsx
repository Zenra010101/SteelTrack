import { useState, useEffect } from 'react';
import {
  DollarSign,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
  FileText,
  Search,
  Filter,
  Printer,
  X,
  Building2,
  ShieldAlert,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type {
  CustomerReceivable,
  ReceivableStats,
  ReceivablePaymentDto,
  PaymentMethodType,
} from '../types/receivables';
import {
  fetchReceivables,
  fetchReceivableStats,
  recordReceivablePayment,
} from '../services/api';

interface ReceivablesViewProps {
  currentBranch?: BranchLocation;
  currentUserName: string;
}

export function ReceivablesView({ currentBranch, currentUserName }: ReceivablesViewProps) {
  const [receivables, setReceivables] = useState<CustomerReceivable[]>([]);
  const [stats, setStats] = useState<ReceivableStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [agingFilter, setAgingFilter] = useState<string>('All');

  // Payment Modal State
  const [selectedReceivable, setSelectedReceivable] = useState<CustomerReceivable | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('Cash');
  const [refNumber, setRefNumber] = useState<string>('');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [chequeDate, setChequeDate] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Statement of Account (SOA) Modal State
  const [soaCustomer, setSoaCustomer] = useState<CustomerReceivable | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, statsData] = await Promise.all([
        fetchReceivables(currentBranch),
        fetchReceivableStats(currentBranch),
      ]);
      setReceivables(list);
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching receivables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch]);

  const handleOpenPayment = (item: CustomerReceivable) => {
    setSelectedReceivable(item);
    setPaymentAmount(item.totalOutstandingPHP.toString());
    setPaymentMethod('Cash');
    setRefNumber('');
    setChequeNumber('');
    setBankName('');
    setChequeDate('');
    setPaymentNotes('');
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceivable || !paymentAmount || parseFloat(paymentAmount) <= 0) return;

    const dto: ReceivablePaymentDto = {
      receivableId: selectedReceivable.id,
      amountPaidPHP: parseFloat(paymentAmount),
      paymentMethod,
      referenceNumber: refNumber,
      chequeNumber: paymentMethod === 'Cheque' ? chequeNumber : undefined,
      bankName: paymentMethod === 'Cheque' ? bankName : undefined,
      chequeDate: paymentMethod === 'Cheque' ? chequeDate : undefined,
      notes: paymentNotes,
      processedBy: currentUserName,
    };

    await recordReceivablePayment(dto);
    setSelectedReceivable(null);
    await loadData();
  };

  const filteredList = receivables.filter((r) => {
    const matchesSearch =
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.companyName.toLowerCase().includes(search.toLowerCase()) ||
      r.tin.includes(search);

    if (!matchesSearch) return false;

    if (agingFilter === 'Current') return r.days30BalancePHP === 0 && r.days60BalancePHP === 0 && r.days90PlusBalancePHP === 0;
    if (agingFilter === 'Days_30') return r.days30BalancePHP > 0;
    if (agingFilter === 'Days_60') return r.days60BalancePHP > 0;
    if (agingFilter === 'Days_90_Plus') return r.days90PlusBalancePHP > 0;
    return true;
  });

  return (
    <div className="view-container">
      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Accounts Receivable & Credit Control
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Monitor customer credit limits, outstanding aging balances, and collect ledger payments.
          </p>
        </div>
      </div>

      {/* METRIC OVERVIEW CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '1.25rem', border: '1px solid #CBD5E1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.85rem' }}>
            <span>Total Outstanding A/R</span>
            <DollarSign size={18} style={{ color: '#0284C7' }} />
          </div>
          <div style={{ color: '#0F172A', fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
            ₱{stats?.totalReceivablesPHP.toLocaleString() ?? 0}
          </div>
          <div style={{ color: '#0284C7', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>
            Total Customer Ledger Debit
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '1.25rem', border: '1px solid #CBD5E1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.85rem' }}>
            <span>Current Balance (0-30 Days)</span>
            <CheckCircle2 size={18} style={{ color: '#059669' }} />
          </div>
          <div style={{ color: '#059669', fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
            ₱{stats?.totalCurrentPHP.toLocaleString() ?? 0}
          </div>
          <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Within Normal Terms
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '1.25rem', border: '1px solid #CBD5E1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.85rem' }}>
            <span>Overdue Balance (30+ Days)</span>
            <AlertTriangle size={18} style={{ color: '#D97706' }} />
          </div>
          <div style={{ color: '#D97706', fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
            ₱{stats?.totalOverduePHP.toLocaleString() ?? 0}
          </div>
          <div style={{ color: '#D97706', fontSize: '0.75rem', marginTop: '0.25rem', fontWeight: 600 }}>
            Requires Collection Action
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '8px', padding: '1.25rem', border: '1px solid #CBD5E1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '0.85rem' }}>
            <span>Pending PDCs Intransit</span>
            <CreditCard size={18} style={{ color: '#7C3AED' }} />
          </div>
          <div style={{ color: '#7C3AED', fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem' }}>
            ₱{stats?.pendingPdcAmountPHP.toLocaleString() ?? 0}
          </div>
          <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {stats?.pendingPdcCount ?? 0} Cheques Awaiting Maturity
          </div>
        </div>
      </div>

      {/* FILTER & CONTROL BAR */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', gap: '1rem' }}>
        <div className="search-box" style={{ flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search customer name, company, or TIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94A3B8', fontSize: '0.85rem' }}>
            <Filter size={16} /> Aging:
          </div>
          <select value={agingFilter} onChange={(e) => setAgingFilter(e.target.value)}>
            <option value="All">All Receivables</option>
            <option value="Current">Current (On-Time)</option>
            <option value="Days_30">30+ Days Overdue</option>
            <option value="Days_60">60+ Days Overdue</option>
            <option value="Days_90_Plus">90+ Days (Credit Blocked)</option>
          </select>
        </div>
      </div>

      {/* RECEIVABLES TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Customer & TIN</th>
              <th style={{ padding: '0.75rem 1rem' }}>Credit Line Used</th>
              <th style={{ padding: '0.75rem 1rem' }}>Total Outstanding</th>
              <th style={{ padding: '0.75rem 1rem' }}>Aging Breakdown</th>
              <th style={{ padding: '0.75rem 1rem' }}>Standing</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  Loading Customer Receivables...
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  No customer accounts match the current filter.
                </td>
              </tr>
            ) : (
              filteredList.map((item) => {
                const usedPct = Math.min(100, (item.totalOutstandingPHP / item.creditLimitPHP) * 100);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.customerName}</div>
                      <div style={{ color: '#475569', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Building2 size={12} /> {item.companyName}
                      </div>
                      <div style={{ color: '#64748B', fontSize: '0.75rem' }}>TIN: {item.tin}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', width: '200px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        <span style={{ color: '#0F172A', fontWeight: 600 }}>₱{item.totalOutstandingPHP.toLocaleString()}</span>
                        <span style={{ color: '#64748B' }}>/ ₱{(item.creditLimitPHP / 1000000).toFixed(1)}M</span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${usedPct}%`,
                            height: '100%',
                            background: usedPct > 90 ? '#EF4444' : usedPct > 70 ? '#F59E0B' : '#0284C7',
                          }}
                        />
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0F172A' }}>
                      ₱{item.totalOutstandingPHP.toLocaleString()}
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                        {item.currentBalancePHP > 0 && (
                          <span style={{ background: '#065F46', color: '#6EE7B7', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            Curr: ₱{item.currentBalancePHP.toLocaleString()}
                          </span>
                        )}
                        {item.days30BalancePHP > 0 && (
                          <span style={{ background: '#78350F', color: '#FDE68A', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            30d: ₱{item.days30BalancePHP.toLocaleString()}
                          </span>
                        )}
                        {item.days60BalancePHP > 0 && (
                          <span style={{ background: '#991B1B', color: '#FCA5A5', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                            60d: ₱{item.days60BalancePHP.toLocaleString()}
                          </span>
                        )}
                        {item.days90PlusBalancePHP > 0 && (
                          <span style={{ background: '#450A0A', color: '#EF4444', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                            90d+: ₱{item.days90PlusBalancePHP.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      {item.status === 'Good Standing' && (
                        <span style={{ background: '#064E3B', color: '#34D399', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                          <CheckCircle2 size={12} /> Good Standing
                        </span>
                      )}
                      {item.status === 'Credit Warning' && (
                        <span style={{ background: '#78350F', color: '#FBBF24', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                          <AlertTriangle size={12} /> Credit Warning
                        </span>
                      )}
                      {item.status === 'Credit Blocked' && (
                        <span style={{ background: '#7F1D1D', color: '#F87171', padding: '0.2rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                          <ShieldAlert size={12} /> Credit Blocked
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                          onClick={() => setSoaCustomer(item)}
                        >
                          <FileText size={14} /> SOA
                        </button>
                        <button
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                          onClick={() => handleOpenPayment(item)}
                        >
                          <DollarSign size={14} /> Record Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {selectedReceivable && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '520px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#F8FAFC', fontSize: '1.2rem', fontWeight: 700 }}>
                Record Ledger Payment
              </h3>
              <button onClick={() => setSelectedReceivable(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid #334155' }}>
              <div style={{ color: '#F8FAFC', fontWeight: 600 }}>{selectedReceivable.customerName}</div>
              <div style={{ color: '#94A3B8', fontSize: '0.8rem' }}>{selectedReceivable.companyName}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#94A3B8' }}>Total Outstanding:</span>
                <span style={{ color: '#38BDF8', fontWeight: 700 }}>₱{selectedReceivable.totalOutstandingPHP.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleProcessPayment}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Payment Amount (PHP)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                >
                  <option value="Cash">Cash Payment</option>
                  <option value="Cheque">Post-Dated / Dated Cheque (PDC)</option>
                  <option value="Bank Transfer">Bank Wire / Electronic Transfer</option>
                  <option value="Credit Note">Credit Note Deduction</option>
                </select>
              </div>

              {paymentMethod === 'Cheque' && (
                <div style={{ background: '#0F172A', padding: '1rem', borderRadius: '6px', border: '1px solid #334155', marginBottom: '1rem' }}>
                  <div style={{ color: '#38BDF8', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                    Cheque Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. BDO, BPI"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Cheque Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 004819"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                        style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Maturity Date (PDC)</label>
                    <input
                      type="date"
                      value={chequeDate}
                      onChange={(e) => setChequeDate(e.target.value)}
                      style={{ width: '100%', background: '#1E293B', border: '1px solid #334155', color: '#F8FAFC', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              {paymentMethod === 'Bank Transfer' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    Bank Reference / Transaction #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BDO-TRX-884902"
                    value={refNumber}
                    onChange={(e) => setRefNumber(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              )}

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Payment Remarks / Collection Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Collector name, official receipt number, or special arrangement notes..."
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedReceivable(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATEMENT OF ACCOUNT (SOA) PRINT MODAL */}
      {soaCustomer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', width: '90%', maxWidth: '700px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0F172A', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>STEELTRACK ENTERPRISE</h2>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>Industrial Steel Logistics & Distribution</div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>Branch: {soaCustomer.branch} Office</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0F172A' }}>STATEMENT OF ACCOUNT</h3>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>Date: {new Date().toLocaleDateString()}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', background: '#F8FAFC', padding: '1rem', borderRadius: '6px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Billed To:</div>
                <div style={{ fontWeight: 600 }}>{soaCustomer.customerName}</div>
                <div>{soaCustomer.companyName}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>TIN: {soaCustomer.tin}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>Credit Limit: ₱{soaCustomer.creditLimitPHP.toLocaleString()}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#DC2626', marginTop: '0.25rem' }}>
                  Total Due: ₱{soaCustomer.totalOutstandingPHP.toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>Aging Summary Breakdown:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #CBD5E1', fontSize: '0.85rem', textAlign: 'center' }}>
                <thead>
                  <tr style={{ background: '#E2E8F0' }}>
                    <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>Current (0-30d)</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>31-60 Days</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>61-90 Days</th>
                    <th style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>90+ Days</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>₱{soaCustomer.currentBalancePHP.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>₱{soaCustomer.days30BalancePHP.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1' }}>₱{soaCustomer.days60BalancePHP.toLocaleString()}</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #CBD5E1', color: '#DC2626', fontWeight: 700 }}>
                      ₱{soaCustomer.days90PlusBalancePHP.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#475569', borderTop: '1px solid #E2E8F0', paddingTop: '1rem', marginBottom: '1.5rem' }}>
              <p style={{ margin: '0 0 0.25rem 0' }}>Please remit payment to SteelTrack Enterprise Treasury or via BDO Account #1002-8841-99.</p>
              <p style={{ margin: 0 }}>For billing inquiries, contact accounting@{soaCustomer.branch.toLowerCase()}.steeltrack.ph</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setSoaCustomer(null)}
                style={{ background: '#E2E8F0', color: '#0F172A', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '4px' }}
              >
                Close
              </button>
              <button
                className="btn-primary"
                onClick={() => window.print()}
                style={{ background: '#0F172A', color: '#FFFFFF', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Printer size={16} /> Print SOA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
