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
import { TableExportButtons } from './TableExportButtons';
import { formatPHP } from '../utils/currency';

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
          <h2 style={{ color: '#000000', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Post-Dated Cheque (PDC) Management
          </h2>
          <p style={{ color: '#000000', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
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

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ maxWidth: '320px' }}>
            <Search size={18} style={{ color: '#000000' }} />
            <input
              type="text"
              placeholder="Search cheque #, customer, bank, or invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <TableExportButtons
            filename={`Cheque_Register_${currentBranch || 'All'}`}
            title="Post-Dated Cheque Register & Status Journal"
            headers={['Cheque #', 'Bank Name', 'Customer Account', 'Invoice Ref', 'Amount (PHP)', 'Maturity Date', 'Status']}
            rows={filteredCheques.map((c) => [
              c.chequeNumber,
              c.bankName,
              c.customerName,
              c.invoiceNumber,
              formatPHP(c.amountPHP),
              new Date(c.maturityDate).toLocaleDateString(),
              c.status,
            ])}
          />
        </div>
      </div>

      {/* CHEQUE REGISTER TABLE WITH WHITE BACKGROUND & WHITE BUTTONS */}
      <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#000000', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
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
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#000000' }}>
                  Loading Cheque Register...
                </td>
              </tr>
            ) : filteredCheques.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#000000' }}>
                  No cheques found matching current filter.
                </td>
              </tr>
            ) : (
              filteredCheques.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#000000', fontSize: '0.9rem', background: '#FFFFFF' }}>
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CreditCard size={14} style={{ color: '#0284C7' }} /> {c.chequeNumber}
                    </div>
                    <div style={{ color: '#000000', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Building size={12} /> {c.bankName}
                    </div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#000000' }}>{c.customerName}</div>
                    <div style={{ color: '#000000', fontSize: '0.75rem' }}>Ref Invoice: {c.invoiceNumber}</div>
                  </td>

                  <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#000000' }}>
                    {formatPHP(c.amountPHP)}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#000000' }}>
                      <Clock size={14} style={{ color: '#000000' }} /> {c.maturityDate}
                    </div>
                    {c.depositedDate && (
                      <div style={{ fontSize: '0.7rem', color: '#000000' }}>Deposited: {c.depositedDate}</div>
                    )}
                  </td>

                  <td style={{ padding: '0.85rem 1rem' }}>
                    {c.status === 'Pending' && (
                      <span style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Pending
                      </span>
                    )}
                    {c.status === 'Deposited' && (
                      <span style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #E9D5FF', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Deposited
                      </span>
                    )}
                    {c.status === 'Cleared' && (
                      <span style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '0.2rem 0.55rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Cleared
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
          <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #CBD5E1', width: '90%', maxWidth: '480px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#EF4444', fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={20} /> Flag Bounced Cheque
              </h3>
              <button onClick={() => setSelectedChequeForBounce(null)} style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: '#FFFFFF', padding: '0.85rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #CBD5E1', fontSize: '0.85rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ color: '#000000', fontWeight: 600 }}>Cheque #{selectedChequeForBounce.chequeNumber}</div>
              <div style={{ color: '#000000' }}>Customer: {selectedChequeForBounce.customerName}</div>
              <div style={{ color: '#0284C7', fontWeight: 700 }}>Amount: {formatPHP(selectedChequeForBounce.amountPHP)}</div>
            </div>

            <form onSubmit={handleConfirmBounce}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', color: '#000000', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Bank Return Reason
                </label>
                <select
                  value={bounceReason}
                  onChange={(e) => setBounceReason(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#000000', padding: '0.6rem', borderRadius: '6px' }}
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
          <div style={{ background: '#FFFFFF', color: '#000000', borderRadius: '8px', width: '90%', maxWidth: '650px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: '0.75rem', marginBottom: '1.25rem', textAlign: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, textTransform: 'uppercase', color: '#991B1B' }}>
                NOTICE OF DISHONORED CHEQUE
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#000000', marginTop: '0.25rem' }}>
                Under BP 22 (Bouncing Checks Law) / Civil Code Obligations
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#000000', marginBottom: '1.5rem' }}>
              <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>To:</strong> {noticeCheque.customerName}</p>
              <p>
                Please be advised that your <strong>{noticeCheque.bankName}</strong> Cheque No.{' '}
                <strong>{noticeCheque.chequeNumber}</strong> dated <strong>{noticeCheque.maturityDate}</strong> in the amount of{' '}
                <strong>{formatPHP(noticeCheque.amountPHP)}</strong> drawn in favor of SteelTrack Enterprise has been returned by our depository bank marked:
              </p>
              <div style={{ background: '#FEF2F2', borderLeft: '4px solid #DC2626', padding: '0.75rem', fontWeight: 700, color: '#991B1B', margin: '1rem 0' }}>
                "{noticeCheque.bounceReason || 'Drawn Against Insufficient Funds'}"
              </div>
              <p>
                Kindly remit full cash payment or bank wire replacement within five (5) business days upon receipt of this notice to prevent formal legal proceedings under Batas Pambansa Blg. 22.
              </p>
            </div>

            {/* FORMAL LETTER FOOTER AND SIGNATURES */}
            <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '1.5rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#000000' }}>
                <div>Authorized Signatory & Legal Officer:</div>
                <div style={{ borderBottom: '1px solid #0F172A', width: '220px', height: '2rem', marginTop: '0.5rem' }}></div>
                <div style={{ fontWeight: 700, marginTop: '0.35rem', color: '#000000' }}>SteelTrack Credit & Legal Recovery Counsel</div>
                <div style={{ fontSize: '0.75rem', color: '#000000' }}>Regional Commercial Branch Office</div>
              </div>

              {/* ACTION BUTTONS (EXCLUDED WHEN PRINTING) */}
              <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary no-print"
                  onClick={() => setNoticeCheque(null)}
                  style={{ background: '#E2E8F0', border: 'none', color: '#000000', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary no-print"
                  onClick={() => window.print()}
                  style={{ background: '#991B1B', border: 'none', color: '#FFFFFF', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
                >
                  <Printer size={14} /> Print Notice (PDF)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
