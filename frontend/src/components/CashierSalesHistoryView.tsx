import { useState, useEffect, useCallback, useMemo } from 'react';
import { Receipt, Printer, Search, Calculator } from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { PosTransaction } from '../types/pos';
import { fetchPosTransactions } from '../services/api';
import { SalesReportVerificationModal } from './SalesReportVerificationModal';

interface CashierSalesHistoryViewProps {
  branch: BranchLocation;
  cashierName: string;
}

export function CashierSalesHistoryView({ branch, cashierName }: CashierSalesHistoryViewProps) {
  const [transactions, setTransactions] = useState<PosTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [activeReceipt, setActiveReceipt] = useState<PosTransaction | null>(null);
  const [isEodModalOpen, setIsEodModalOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const txList = await fetchPosTransactions(branch);
      setTransactions(txList);
    } catch (err) {
      console.error('Failed loading sales history:', err);
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPayment = paymentFilter === 'All' || tx.paymentMethod === paymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [transactions, searchQuery, paymentFilter]);

  // Aggregate Metrics
  const totalSalesPHP = useMemo(() => {
    return transactions.reduce((acc, tx) => acc + (tx.totalAmountPHP ?? tx.totalAmountUSD ?? 0), 0);
  }, [transactions]);

  const totalTonnageSold = useMemo(() => {
    return transactions.reduce((acc, tx) => acc + tx.totalTonnage, 0);
  }, [transactions]);

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="pos-container" style={{ padding: '0 0.5rem' }}>
      {/* Header & Metrics Bar */}
      <div className="pos-shift-banner" style={{ marginBottom: '1.5rem' }}>
        <div className="pos-shift-info">
          <div className="breadcrumb-icon" style={{ background: '#E0F2FE', color: '#0369A1' }}>
            <Receipt size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
              {branch} Branch Sales History & Receipt Journal
            </h3>
            <div style={{ fontSize: '0.82rem', color: '#64748B', marginTop: '0.2rem' }}>
              Cashier: <strong>{cashierName}</strong> • Real-time counter sales telemetry
            </div>
          </div>
        </div>

        <div className="pos-shift-metrics">
          <div className="pos-mini-stat">
            <span className="label">Total Shift Sales</span>
            <span className="val green">₱{totalSalesPHP.toLocaleString()}</span>
          </div>

          <div className="pos-mini-stat">
            <span className="label">Total Tonnage Sold</span>
            <span className="val">{totalTonnageSold.toFixed(1)} Tons</span>
          </div>

          <div className="pos-mini-stat">
            <span className="label">Receipts Recorded</span>
            <span className="val">{transactions.length}</span>
          </div>

          <button
            className="btn-primary"
            onClick={() => setIsEodModalOpen(true)}
            title="Perform End-of-Day Drawer Reconciliation"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem' }}
          >
            <Calculator size={16} /> EOD Balancing
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="controls-bar" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          <div className="pos-search-bar" style={{ flex: 1 }}>
            <Search size={16} style={{ color: '#94A3B8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              background: 'white',
              color: '#334155',
            }}
          >
            <option value="All">All Payment Types</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Corporate Credit Line">Corporate Credit Line</option>
            <option value="Cheque">Cheque</option>
            <option value="Split Payment">Split Payment</option>
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748B', display: 'flex', alignItems: 'center' }}>
          Showing <strong>{filteredTransactions.length}</strong> of {transactions.length} receipts
        </div>
      </div>

      {/* Receipts Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Time</th>
              <th>Customer</th>
              <th>Items Sold</th>
              <th>Total Weight</th>
              <th>Payment Method</th>
              <th>Total (PHP)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#94A3B8' }}>
                  Loading sales journal...
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#94A3B8', padding: '2.5rem' }}>
                  No transaction records found matching your query for {branch} Branch.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#0284C7' }}>
                    {tx.invoiceNumber}
                  </td>
                  <td style={{ color: '#475569', fontSize: '0.85rem' }}>
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ fontWeight: 600 }}>{tx.customerName}</td>
                  <td style={{ fontSize: '0.85rem' }}>{tx.items?.length || 1} line item(s)</td>
                  <td style={{ fontWeight: 600, color: '#334155' }}>{tx.totalTonnage.toFixed(2)} Tons</td>
                  <td>
                    <span className="badge badge-available">{tx.paymentMethod}</span>
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: '#0F172A' }}>
                    ₱{(tx.totalAmountPHP ?? tx.totalAmountUSD ?? 0).toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      onClick={() => setActiveReceipt(tx)}
                    >
                      <Printer size={13} /> Reprint Receipt
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* OFFICIAL REPRINT RECEIPT MODAL */}
      {activeReceipt && (
        <div className="receipt-modal-overlay">
          <div className="receipt-paper">
            <div className="receipt-header">
              <div className="brand">SteelTrack Philippines</div>
              <div className="store-sub">{branch} Commercial Retail Hub</div>
              <div className="tin">TIN: 004-982-120-000 • VAT Registered</div>
              <div className="contact">Industrial Highway, {branch} City</div>
              <div className="receipt-title">OFFICIAL CASH INVOICE (REPRINT)</div>
            </div>

            <div className="receipt-meta">
              <div>Invoice #: {activeReceipt.invoiceNumber}</div>
              <div>Date: {new Date(activeReceipt.createdAt).toLocaleString()}</div>
              <div>Cashier: {cashierName}</div>
              <div>Customer: {activeReceipt.customerName}</div>
            </div>

            <div className="receipt-divider" />

            <div className="receipt-items-table">
              {activeReceipt.items?.map((item, idx) => (
                <div key={idx} className="receipt-line-item">
                  <div className="item-name">
                    {item.grade.replace('_', ' ')} ({item.dimensions})
                  </div>
                  <div className="item-calc">
                    <span>{item.quantityTons}T @ ₱{item.pricePerTonPHP.toLocaleString()}</span>
                    <span>₱{(item.quantityTons * item.pricePerTonPHP).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="receipt-divider" />

            <div className="receipt-totals">
              <div className="row">
                <span>Payment Method:</span>
                <span>{activeReceipt.paymentMethod}</span>
              </div>
              <div className="row grand">
                <span>TOTAL AMOUNT:</span>
                <span>₱{(activeReceipt.totalAmountPHP ?? activeReceipt.totalAmountUSD ?? 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="receipt-footer">
              <div>*** DUPLICATE / REPRINT RECORD ***</div>
              <div>Thank you for your valued enterprise partnership!</div>
            </div>

            <div className="receipt-actions no-print">
              <button className="btn-secondary" onClick={() => setActiveReceipt(null)}>
                Close
              </button>
              <button className="btn-primary" onClick={handlePrintReceipt}>
                <Printer size={16} /> Print Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END-OF-DAY BALANCING MODAL */}
      <SalesReportVerificationModal
        isOpen={isEodModalOpen}
        branch={branch}
        cashierName={cashierName}
        systemTotalPHP={totalSalesPHP}
        onClose={() => setIsEodModalOpen(false)}
        onSubmitVerification={({ actualCashPHP, variancePHP, notes }) => {
          alert(`EOD Verification Submitted for ${branch} Counter!\nActual Cash: ₱${actualCashPHP.toLocaleString()}\nVariance: ₱${variancePHP.toLocaleString()}\nNotes: ${notes || 'None'}`);
          setIsEodModalOpen(false);
        }}
      />
    </div>
  );
}
