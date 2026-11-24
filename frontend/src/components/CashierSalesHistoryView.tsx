import { useState, useEffect, useCallback, useMemo } from 'react';
import { Receipt, Printer, Search, Calculator, Download } from 'lucide-react';
import { BranchLocation, UserRole } from '../types/auth';
import type { PosTransaction } from '../types/pos';
import { fetchPosTransactions } from '../services/api';
import { SalesReportVerificationModal } from './SalesReportVerificationModal';
import { TableExportButtons } from './TableExportButtons';
import { printReceiptPdf } from '../utils/tableExport';
import { formatPHP } from '../utils/currency';

interface CashierSalesHistoryViewProps {
  branch?: BranchLocation | 'All';
  cashierName: string;
  userRole?: UserRole;
  selectedBranch?: string;
  onSelectBranch?: (branch: string) => void;
}

export function CashierSalesHistoryView({
  branch = BranchLocation.Davao,
  cashierName,
  userRole = UserRole.Cashier,
  selectedBranch,
  onSelectBranch,
}: CashierSalesHistoryViewProps) {
  const isOwner = userRole === UserRole.Owner;
  const isCashier = userRole === UserRole.Cashier;
  const isBranchManager = userRole === UserRole.BranchManager;

  // For Owner: can switch between 'All' and each individual branch.
  // For Branch Manager / Cashier: strictly scoped to their own branch.
  const [localOwnerBranch, setLocalOwnerBranch] = useState<string>(selectedBranch || 'All');

  const effectiveBranch = isOwner
    ? (selectedBranch !== undefined ? selectedBranch : localOwnerBranch)
    : (branch || BranchLocation.Davao);

  const handleBranchChange = (newBranch: string) => {
    setLocalOwnerBranch(newBranch);
    if (onSelectBranch) {
      onSelectBranch(newBranch);
    }
  };

  const [transactions, setTransactions] = useState<PosTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [activeReceipt, setActiveReceipt] = useState<PosTransaction | null>(null);
  const [isEodModalOpen, setIsEodModalOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const txList = await fetchPosTransactions(effectiveBranch === 'All' ? undefined : effectiveBranch);
      setTransactions(txList);
    } catch (err) {
      console.error('Failed loading sales history:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveBranch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.branch && tx.branch.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesPayment = paymentFilter === 'All' || tx.paymentMethod === paymentFilter;
      const matchesBranch =
        effectiveBranch === 'All' ||
        !tx.branch ||
        tx.branch.toLowerCase().includes(effectiveBranch.toLowerCase()) ||
        effectiveBranch.toLowerCase().includes(tx.branch.toLowerCase());
      return matchesSearch && matchesPayment && matchesBranch;
    });
  }, [transactions, searchQuery, paymentFilter, effectiveBranch]);

  // Aggregate Metrics calculated over active filtered scope
  const totalSalesPHP = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + (tx.totalAmountPHP ?? tx.totalAmountUSD ?? 0), 0);
  }, [filteredTransactions]);

  const totalTonnageSold = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + tx.totalTonnage, 0);
  }, [filteredTransactions]);

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
              {isOwner
                ? (effectiveBranch === 'All' ? 'Enterprise Sales History & BIR Receipt Journal' : `${effectiveBranch} Branch Sales History & Receipt Journal`)
                : `${effectiveBranch} Branch Sales History & Receipt Journal`}
            </h3>
            <div style={{ fontSize: '0.82rem', color: '#000000', marginTop: '0.2rem' }}>
              {isOwner ? (
                <>Executive Scope: <strong>{effectiveBranch === 'All' ? 'All 4 Regional Branches' : `${effectiveBranch} Facility`}</strong> • Multi-branch revenue audit & telemetry</>
              ) : isBranchManager ? (
                <>Branch Facility: <strong>{effectiveBranch} Branch</strong> • Regional sales ledger & receipts journal</>
              ) : (
                <>Cashier: <strong>{cashierName}</strong> • Real-time counter sales telemetry</>
              )}
            </div>
          </div>
        </div>

        <div className="pos-shift-metrics">
          <div className="pos-mini-stat">
            <span className="label">
              {isOwner ? 'Total Gross Sales' : isBranchManager ? 'Branch Gross Sales' : 'Total Shift Sales'}
            </span>
            <span className="val green">{formatPHP(totalSalesPHP)}</span>
          </div>

          <div className="pos-mini-stat">
            <span className="label">Total Tonnage Sold</span>
            <span className="val">{totalTonnageSold.toFixed(1)} Tons</span>
          </div>

          <div className="pos-mini-stat">
            <span className="label">Receipts Recorded</span>
            <span className="val">{filteredTransactions.length}</span>
          </div>

          {isCashier && (
            <button
              className="btn-primary"
              onClick={() => setIsEodModalOpen(true)}
              title="Perform End-of-Day Drawer Reconciliation"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1rem' }}
            >
              <Calculator size={16} /> EOD Balancing
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="controls-bar" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
          <div className="pos-search-bar" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={16} style={{ color: '#000000' }} />
            <input
              type="text"
              placeholder="Search invoice #, customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          {/* Owner Multi-Branch Filter Selector */}
          {isOwner && (
            <select
              value={effectiveBranch}
              onChange={(e) => handleBranchChange(e.target.value)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                background: 'white',
                color: '#000000',
                fontWeight: 600,
              }}
              title="Filter sales by branch facility"
            >
              <option value="All">All Branches (Global)</option>
              <option value={BranchLocation.Davao}>Davao Branch</option>
              <option value={BranchLocation.Cagayan}>Cagayan Branch</option>
              <option value={BranchLocation.Cebu}>Cebu Branch</option>
              <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
            </select>
          )}

          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              background: 'white',
              color: '#000000',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.85rem', color: '#000000', display: 'flex', alignItems: 'center' }}>
            Showing <strong>{filteredTransactions.length}</strong> of {transactions.length} receipts
          </div>
          <TableExportButtons
            filename={`${effectiveBranch === 'All' ? 'Enterprise' : effectiveBranch}_Sales_History`}
            title={`${effectiveBranch === 'All' ? 'Enterprise Regional' : effectiveBranch} Branch Sales History & Receipt Journal`}
            headers={
              effectiveBranch === 'All'
                ? ['Invoice #', 'Branch', 'Date & Time', 'Customer Name', 'Items Count', 'Total Tonnage', 'Payment Method', 'VAT (12%)', 'Total Amount (PHP)']
                : ['Invoice #', 'Date & Time', 'Customer Name', 'Items Count', 'Total Tonnage', 'Payment Method', 'VAT (12%)', 'Total Amount (PHP)']
            }
            rows={filteredTransactions.map((tx) =>
              effectiveBranch === 'All'
                ? [
                  tx.invoiceNumber,
                  tx.branch || 'Davao',
                  new Date(tx.createdAt).toLocaleString(),
                  tx.customerName,
                  tx.items?.length || 1,
                  `${tx.totalTonnage.toFixed(2)} Tons`,
                  tx.paymentMethod,
                  formatPHP(tx.taxPHP || 0),
                  formatPHP(tx.totalAmountPHP ?? tx.totalAmountUSD ?? 0),
                ]
                : [
                  tx.invoiceNumber,
                  new Date(tx.createdAt).toLocaleString(),
                  tx.customerName,
                  tx.items?.length || 1,
                  `${tx.totalTonnage.toFixed(2)} Tons`,
                  tx.paymentMethod,
                  formatPHP(tx.taxPHP || 0),
                  formatPHP(tx.totalAmountPHP ?? tx.totalAmountUSD ?? 0),
                ]
            )}
          />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              {effectiveBranch === 'All' && <th>Branch</th>}
              <th>Time</th>
              <th>Customer</th>
              <th>Items Sold</th>
              <th>Total Weight</th>
              <th>Payment Method</th>
              <th>VAT (12%)</th>
              <th>Total (PHP)</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={effectiveBranch === 'All' ? 10 : 9} style={{ textAlign: 'center', padding: '2rem', color: '#000000' }}>
                  Loading sales journal...
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={effectiveBranch === 'All' ? 10 : 9} style={{ textAlign: 'center', color: '#000000', padding: '2.5rem' }}>
                  No transaction records found matching your query {effectiveBranch === 'All' ? 'across all branches' : `for ${effectiveBranch} Branch`}.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: '#0284C7' }}>
                    {tx.invoiceNumber}
                  </td>
                  {effectiveBranch === 'All' && (
                    <td>
                      <span className="badge badge-branch" style={{ fontWeight: 600 }}>
                        {tx.branch || 'Davao'}
                      </span>
                    </td>
                  )}
                  <td style={{ color: '#000000', fontSize: '0.85rem' }}>
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ fontWeight: 600 }}>{tx.customerName}</td>
                  <td style={{ fontSize: '0.85rem' }}>{tx.items?.length || 1} line item(s)</td>
                  <td style={{ fontWeight: 600, color: '#000000' }}>{tx.totalTonnage.toFixed(2)} Tons</td>
                  <td>
                    <span className="badge badge-available">{tx.paymentMethod}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#000000' }}>
                    {formatPHP(tx.taxPHP || 0)}
                  </td>
                  <td style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: '#000000' }}>
                    {formatPHP(tx.totalAmountPHP ?? tx.totalAmountUSD ?? 0)}
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
        <div
          className="pos-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            overflowY: 'auto',
          }}
        >
          <div
            className="receipt-card"
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #E2E8F0',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            <div className="receipt-header" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#000000', letterSpacing: '-0.01em' }}>
                STEELTRACK PHILIPPINES
              </div>
              <div style={{ fontSize: '0.8rem', color: '#000000', marginTop: 2 }}>
                {activeReceipt.branch || effectiveBranch || 'Main'} Commercial Retail Hub
              </div>
              <div style={{ fontSize: '0.75rem', color: '#000000' }}>
                TIN: 004-982-120-000 • VAT Registered
              </div>
              <div style={{ fontSize: '0.75rem', color: '#000000' }}>
                Industrial Highway, {activeReceipt.branch || effectiveBranch || 'Main'} City
              </div>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  marginTop: '0.65rem',
                  padding: '0.25rem 0',
                  borderTop: '1px dashed #CBD5E1',
                  borderBottom: '1px dashed #CBD5E1',
                  color: '#0284C7',
                }}
              >
                OFFICIAL CASH INVOICE (REPRINT)
              </div>
            </div>

            <div className="receipt-meta" style={{ fontSize: '0.8rem', color: '#000000', lineHeight: 1.45, marginBottom: '0.75rem' }}>
              <div><strong>Invoice #:</strong> {activeReceipt.invoiceNumber}</div>
              <div><strong>Branch:</strong> {activeReceipt.branch || effectiveBranch || 'Main'}</div>
              <div><strong>Date:</strong> {new Date(activeReceipt.createdAt).toLocaleString()}</div>
              <div><strong>Cashier:</strong> {activeReceipt.cashierName || cashierName}</div>
              <div><strong>Customer:</strong> {activeReceipt.customerName || 'Walk-in Client'}</div>
              {activeReceipt.customerTin && <div><strong>TIN:</strong> {activeReceipt.customerTin}</div>}
            </div>

            <div className="receipt-divider" style={{ borderTop: '1px dashed #CBD5E1', margin: '0.75rem 0' }} />

            <div className="receipt-items-table" style={{ margin: '0.75rem 0', maxHeight: '200px', overflowY: 'auto' }}>
              {activeReceipt.items && activeReceipt.items.length > 0 ? (
                activeReceipt.items.map((item, idx) => {
                  const displayName = (item.grade || (item as any).productName || 'Steel Product').replace(/_/g, ' ');
                  const displayDims = item.dimensions || (item as any).sku || 'Standard';
                  const qty = Number(item.quantityTons ?? (item as any).quantity ?? 1);
                  const price = Number(item.pricePerTonPHP ?? (item as any).unitPrice ?? 0);
                  const lineTotal = Number(item.lineTotalPHP ?? (item as any).lineTotal ?? (qty * price));

                  return (
                    <div
                      key={idx}
                      className="receipt-line-item"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.35rem 0',
                        borderBottom: '1px dashed #F1F5F9',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div className="item-name" style={{ maxWidth: '65%' }}>
                        <div style={{ fontWeight: 700, color: '#000000' }}>{displayName}</div>
                        <div style={{ fontSize: '0.7rem', color: '#000000' }}>{displayDims}</div>
                      </div>
                      <div className="item-calc" style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: '#000000' }}>
                          {qty}T @ {formatPHP(price)}
                        </div>
                        <div style={{ fontWeight: 700, color: '#000000' }}>
                          {formatPHP(lineTotal)}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '0.75rem', textAlign: 'center', color: '#000000', fontSize: '0.8rem', background: '#F8FAFC', borderRadius: 4 }}>
                  Standard Sales Invoice Allocation
                </div>
              )}
            </div>

            <div className="receipt-divider" style={{ borderTop: '1px dashed #CBD5E1', margin: '0.75rem 0' }} />

            <div className="receipt-totals" style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
                <span>Subtotal Amount:</span>
                <span>{formatPHP(activeReceipt.subtotalPHP ?? activeReceipt.totalAmountPHP ?? 0)}</span>
              </div>
              {Number(activeReceipt.discountPHP || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#059669' }}>
                  <span>Volume Discount:</span>
                  <span>-{formatPHP(activeReceipt.discountPHP)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
                <span>Value Added Tax (12% VAT):</span>
                <span>{formatPHP(activeReceipt.taxPHP || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
                <span>Payment Method:</span>
                <span style={{ fontWeight: 600, color: '#000000' }}>{activeReceipt.paymentMethod}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: '#000000',
                  borderTop: '1px solid #0F172A',
                  borderBottom: '1px solid #0F172A',
                  padding: '0.4rem 0',
                  marginTop: '0.4rem',
                }}
              >
                <span>TOTAL AMOUNT:</span>
                <span>{formatPHP(activeReceipt.totalAmountPHP ?? activeReceipt.totalAmountUSD ?? 0)}</span>
              </div>
            </div>

            <div className="receipt-footer" style={{ textAlign: 'center', fontSize: '0.75rem', color: '#000000', marginTop: '1rem' }}>
              <div>*** DUPLICATE / REPRINT RECORD ***</div>
              <div>Thank you for your valued enterprise partnership!</div>
            </div>

            <div className="receipt-actions no-print" style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => printReceiptPdf(activeReceipt)}
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  background: '#0284C7',
                  borderColor: '#0284C7',
                  fontSize: '0.82rem',
                }}
              >
                <Download size={15} /> Download PDF
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => printReceiptPdf(activeReceipt)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.82rem',
                }}
              >
                <Printer size={15} /> Print Copy
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveReceipt(null)}
                style={{ fontSize: '0.82rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END-OF-DAY BALANCING MODAL - STRICTLY CASHIER ONLY */}
      {isCashier && (
        <SalesReportVerificationModal
          isOpen={isEodModalOpen}
          branch={(effectiveBranch === 'All' ? BranchLocation.Davao : effectiveBranch) as BranchLocation}
          cashierName={cashierName}
          systemTotalPHP={totalSalesPHP}
          onClose={() => setIsEodModalOpen(false)}
          onSubmitVerification={({ actualCashPHP, variancePHP, notes }) => {
            alert(`EOD Verification Submitted for ${effectiveBranch} Counter!\nActual Cash: ${formatPHP(actualCashPHP)}\nVariance: ${formatPHP(variancePHP)}\nNotes: ${notes || 'None'}`);
            setIsEodModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
