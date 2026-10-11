import { useState, useEffect } from 'react';
import {
  CreditCard,
  AlertOctagon,
  Clock,
  Search,
  ShieldAlert,
  X,
  Printer,
  Building,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { SaleChequeItem, ChequeStatusType } from '../types/receivables';
import { fetchCheques, updateChequeStatus } from '../services/api';

interface ChequeManagementViewProps {
  currentBranch?: BranchLocation;
}

export function ChequeManagementView({ currentBranch }: ChequeManagementViewProps) {
  const [cheques, setCheques] = useState<SaleChequeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusTab, setStatusTab] = useState<string>('All');

  // Bounce Modal State
  const [selectedChequeForBounce, setSelectedChequeForBounce] = useState<SaleChequeItem | null>(null);
  const [bounceReason, setBounceReason] = useState<string>('Drawn Against Insufficient Funds (DAIF)');

  // Bounced Notice Printable Preview
  const [noticeCheque, setNoticeCheque] = useState<SaleChequeItem | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCheques(
        currentBranch,
        statusTab !== 'All' ? (statusTab as ChequeStatusType) : undefined
      );
      setCheques(data);
    } catch (err) {
      console.error('Error loading cheque register:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentBranch, statusTab]);

  const handleDeposit = async (id: string) => {
    await updateChequeStatus(id, 'Deposited');
    await loadData();
  };

  const handleClear = async (id: string) => {
    await updateChequeStatus(id, 'Cleared');
    await loadData();
  };

  const handleConfirmBounce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChequeForBounce) return;

    await updateChequeStatus(selectedChequeForBounce.id, 'Bounced', bounceReason);
    setSelectedChequeForBounce(null);
    await loadData();
  };

  const filteredCheques = cheques.filter((c) => {
    const matchesSearch =
      c.chequeNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.bankName.toLowerCase().includes(search.toLowerCase()) ||
      c.invoiceNumber.toLowerCase().includes(search.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Post-Dated Cheque (PDC) Management
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Track customer cheque maturities, record bank deposits, and handle returned/bounced cheques.
          </p>
        </div>
      </div>

      {/* FILTER & STATUS TABS WITH WHITE BACKGROUND & BUTTONS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', background: '#FFFFFF', padding: '0.3rem', borderRadius: '8px', border: '1px solid #CBD5E1', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          {['All', 'Pending', 'Deposited', 'Cleared', 'Bounced'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              style={{
                background: statusTab === tab ? '#F1F5F9' : '#FFFFFF',
                color: statusTab === tab ? '#0284C7' : '#475569',
                border: statusTab === tab ? '1px solid #0284C7' : '1px solid transparent',
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                fontWeight: statusTab === tab ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease-in-out',
              }}
            >
              {tab === 'All' ? 'All Cheques' : tab}
            </button>
          ))}
        </div>

        <div className="search-box" style={{ maxWidth: '350px' }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search cheque #, customer, bank, or invoice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* CHEQUE REGISTER TABLE WITH WHITE BACKGROUND & WHITE BUTTONS */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Cheque # & Bank</th>
              <th style={{ padding: '0.75rem 1rem' }}>Customer & Invoice</th>
              <th style={{ padding: '0.75rem 1rem' }}>Amount (PHP)</th>
              <th style={{ padding: '0.75rem 1rem' }}>Maturity Date</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  Loading Cheque Register...
                </td>
              </tr>
            ) : filteredCheques.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>
                  No cheques found matching current filter.
                </td>
              </tr>
            ) : (
              filteredCheques.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CreditCard size={14} style={{ color: '#0284C7' }} /> {c.chequeNumber}
                    </div>
                    <div style={{ color: '#475569', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Building size={12} /> {c.bankName}
                    </div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{c.customerName}</div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Ref Invoice: {c.invoiceNumber}</div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0F172A' }}>
                    ₱{c.amountPHP.toLocaleString()}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#334155' }}>
                      <Clock size={14} style={{ color: '#64748B' }} /> {c.maturityDate}
                    </div>
                    {c.depositedDate && (
                      <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Deposited: {c.depositedDate}</div>
                    )}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    {c.status === 'Pending' && (
                      <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Pending Maturity
                      </span>
                    )}
                    {c.status === 'Deposited' && (
                      <span style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #E9D5FF', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Deposited in Bank
                      </span>
                    )}
                    {c.status === 'Cleared' && (
                      <span style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Cleared / Honored
                      </span>
                    )}
                    {c.status === 'Bounced' && (
                      <span style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertOctagon size={12} /> Bounced (DAIF)
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      {c.status === 'Pending' && (
                        <button
                          className="btn-table-action btn-table-info"
                          onClick={() => handleDeposit(c.id)}
                        >
                          Mark Deposited
                        </button>
                      )}

                      {c.status === 'Deposited' && (
                        <>
                          <button
                            className="btn-table-action btn-table-success"
                            onClick={() => handleClear(c.id)}
                          >
                            Mark Cleared
                          </button>
                          <button
                            className="btn-table-action btn-table-danger"
                            onClick={() => setSelectedChequeForBounce(c)}
                          >
                            Flag Bounced
                          </button>
                        </>
                      )}

                      {c.status === 'Bounced' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                          onClick={() => setNoticeCheque(c)}
                        >
                          <Printer size={12} /> Notice
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

      {/* BOUNCED CHEQUE FLAG MODAL */}
      {selectedChequeForBounce && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', borderRadius: '12px', border: '1px solid #7F1D1D', width: '90%', maxWidth: '480px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#EF4444', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} /> Flag Bounced Cheque
              </h3>
              <button onClick={() => setSelectedChequeForBounce(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#0F172A', padding: '0.85rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #334155', fontSize: '0.85rem' }}>
              <div style={{ color: '#F8FAFC', fontWeight: 600 }}>Cheque #{selectedChequeForBounce.chequeNumber}</div>
              <div style={{ color: '#94A3B8' }}>Customer: {selectedChequeForBounce.customerName}</div>
              <div style={{ color: '#38BDF8', fontWeight: 700 }}>Amount: ₱{selectedChequeForBounce.amountPHP.toLocaleString()}</div>
            </div>

            <form onSubmit={handleConfirmBounce}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                  Bank Return Reason
                </label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                >
                  <option value="Drawn Against Insufficient Funds (DAIF)">Drawn Against Insufficient Funds (DAIF)</option>
                  <option value="Drawn Against Uncollected Deposits (DAUD)">Drawn Against Uncollected Deposits (DAUD)</option>
                  <option value="Account Closed">Account Closed</option>
                  <option value="Signature Mismatch / Irregularity">Signature Mismatch / Irregularity</option>
                  <option value="Payment Stopped by Drawer">Payment Stopped by Drawer</option>
                </select>
              </div>

              <div style={{ background: '#450A0A', color: '#FCA5A5', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                ⚠️ Flagging this cheque will automatically adjust customer credit standing to <strong>Credit Blocked</strong> and generate a formal collection notice.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setSelectedChequeForBounce(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ background: '#DC2626', border: 'none' }}>
                  Flag & Notify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOUNCED CHEQUE FORMAL LEGAL NOTICE MODAL */}
      {noticeCheque && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', width: '90%', maxWidth: '650px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: '0.75rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, textTransform: 'uppercase', color: '#991B1B' }}>
                NOTICE OF DISHONORED CHEQUE
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '0.25rem' }}>
                Under BP 22 (Bouncing Checks Law) / Civil Code Obligations
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#1E293B', marginBottom: '1.5rem' }}>
              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>To:</strong> {noticeCheque.customerName}</p>
              <p>
                Please be advised that your <strong>{noticeCheque.bankName}</strong> Cheque No.{' '}
                <strong>{noticeCheque.chequeNumber}</strong> dated <strong>{noticeCheque.maturityDate}</strong> in the amount of{' '}
                <strong>₱{noticeCheque.amountPHP.toLocaleString()}</strong> drawn in favor of SteelTrack Enterprise has been returned by our depository bank marked:
              </p>
              <div style={{ background: '#FEF2F2', borderLeft: '4px solid #DC2626', padding: '0.75rem', fontWeight: 700, color: '#991B1B', margin: '1rem 0' }}>
                "{noticeCheque.bounceReason || 'Drawn Against Insufficient Funds'}"
              </div>
              <p>
                Kindly remit full cash payment or bank wire replacement within five (5) business days upon receipt of this notice to prevent formal legal proceedings under Batas Pambansa Blg. 22.
              </p>
            </div>

            <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                <div>Authorized Signatory:</div>
                <div style={{ fontWeight: 700, marginTop: '2rem', color: '#0F172A' }}>SteelTrack Credit & Collection Officer</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setNoticeCheque(null)}
                  style={{ background: '#E2E8F0', border: 'none', color: '#0F172A', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  style={{ background: '#0F172A', border: 'none', color: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Printer size={14} /> Print Notice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
