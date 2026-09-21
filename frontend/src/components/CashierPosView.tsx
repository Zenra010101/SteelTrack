import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Receipt, DollarSign, Printer, CheckCircle2 } from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { PosTransaction } from '../types/transfer';
import type { SteelBatch } from '../types/steel';
import { fetchInventory, fetchPosTransactions, processPosSale } from '../services/api';

interface CashierPosViewProps {
  branch: BranchLocation;
  cashierName: string;
}

export function CashierPosView({ branch, cashierName }: CashierPosViewProps) {
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [transactions, setTransactions] = useState<PosTransaction[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  // POS Form
  const [customerName, setCustomerName] = useState<string>('Apex Construction Inc.');
  const [tonnageSold, setTonnageSold] = useState<number>(5.0);
  const [pricePerTon, setPricePerTon] = useState<number>(880);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Cash' | 'Credit Line'>('Bank Transfer');
  const [lastInvoice, setLastInvoice] = useState<PosTransaction | null>(null);

  const loadData = useCallback(async () => {
    const [invResult, txList] = await Promise.all([
      fetchInventory(undefined, undefined, undefined, branch),
      fetchPosTransactions(branch),
    ]);
    const available = invResult.data.filter((b) => b.status === 'Available');
    setBatches(available);
    setTransactions(txList);
    if (available.length > 0 && !selectedBatchId) {
      setSelectedBatchId(available[0].id);
    }
  }, [branch, selectedBatchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const totalAmount = (tonnageSold * pricePerTon).toFixed(2);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    const newTx = await processPosSale({
      branch,
      cashierName,
      customerName,
      batchId: selectedBatch.id,
      heatNumber: selectedBatch.heatNumber,
      grade: selectedBatch.grade,
      tonnageSold,
      pricePerTonUSD: pricePerTon,
      totalAmountUSD: parseFloat(totalAmount),
      paymentMethod,
    });

    setLastInvoice(newTx);
    loadData();
  };

  return (
    <div className="pos-container">
      <div className="pos-grid">
        {/* Left Column: POS Order Entry */}
        <div className="pos-card">
          <div className="pos-card-header">
            <div className="brand-icon-sm">
              <ShoppingCart size={18} />
            </div>
            <div>
              <h3>Branch Counter Checkout (POS)</h3>
              <p style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Daily sales transaction terminal for {branch} Branch
              </p>
            </div>
          </div>

          <form onSubmit={handleCheckout} className="pos-form">
            <div className="form-group">
              <label>Customer / Enterprise Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter client company..."
                required
              />
            </div>

            <div className="form-group">
              <label>Select Available Inventory Batch ({branch} Branch)</label>
              {batches.length === 0 ? (
                <div style={{ padding: '0.6rem', color: '#F59E0B', fontSize: '0.85rem' }}>
                  No batches currently marked 'Available' at {branch} Branch.
                </div>
              ) : (
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.heatNumber} — {b.grade} ({b.weightInTons}T in stock)
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Tonnage to Sell (Tons)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max={selectedBatch ? selectedBatch.weightInTons : 100}
                  value={tonnageSold}
                  onChange={(e) => setTonnageSold(parseFloat(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Price per Ton ($)</label>
                <input
                  type="number"
                  step="10"
                  value={pricePerTon}
                  onChange={(e) => setPricePerTon(parseFloat(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash Payment</option>
                <option value="Credit Line">Corporate Credit Line</option>
              </select>
            </div>

            <div className="pos-summary-box">
              <div className="summary-line">
                <span>Subtotal Tonnage:</span>
                <strong>{tonnageSold} Tons</strong>
              </div>
              <div className="summary-line">
                <span>Unit Rate:</span>
                <strong>${pricePerTon} / Ton</strong>
              </div>
              <div className="summary-line total">
                <span>Total Amount Due:</span>
                <span className="total-amount">${totalAmount}</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.75rem', justifyContent: 'center', marginTop: '1rem' }}
              disabled={batches.length === 0}
            >
              <DollarSign size={18} /> Complete Sale & Print Receipt
            </button>
          </form>
        </div>

        {/* Right Column: Recent Receipts & Invoice Preview */}
        <div className="pos-history-card">
          <div className="pos-card-header">
            <div className="brand-icon-sm green">
              <Receipt size={18} />
            </div>
            <div>
              <h3>Transaction Receipt History</h3>
              <p style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
                Completed counter receipts at {branch} Branch
              </p>
            </div>
          </div>

          <div className="tx-list">
            {transactions.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>
                No sales recorded yet today.
              </div>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="tx-item">
                  <div className="tx-item-header">
                    <span className="tx-inv">{tx.invoiceNumber}</span>
                    <span className="tx-amount">${tx.totalAmountUSD.toLocaleString()}</span>
                  </div>
                  <div className="tx-client">{tx.customerName}</div>
                  <div className="tx-meta">
                    {tx.heatNumber} • {tx.grade} • {tx.tonnageSold} Tons
                  </div>
                  <div className="tx-footer">
                    <span>{new Date(tx.createdAt).toLocaleTimeString()}</span>
                    <span className="badge badge-available">{tx.paymentMethod}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Generated Receipt Modal */}
      {lastInvoice && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981' }}>
                <CheckCircle2 size={20} />
                <h3 style={{ margin: 0 }}>Transaction Completed</h3>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}
                onClick={() => setLastInvoice(null)}
              >
                ✕
              </button>
            </div>

            <div className="receipt-paper">
              <div className="receipt-title">STEELTRACK ENTERPRISE</div>
              <div className="receipt-sub">{lastInvoice.branch} BRANCH - OFFICIAL RECEIPT</div>
              <div className="receipt-divider" />

              <div className="receipt-row">
                <span>Invoice #:</span>
                <strong>{lastInvoice.invoiceNumber}</strong>
              </div>
              <div className="receipt-row">
                <span>Date/Time:</span>
                <span>{new Date(lastInvoice.createdAt).toLocaleString()}</span>
              </div>
              <div className="receipt-row">
                <span>Cashier:</span>
                <span>{lastInvoice.cashierName}</span>
              </div>
              <div className="receipt-row">
                <span>Customer:</span>
                <strong>{lastInvoice.customerName}</strong>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-row">
                <span>Heat Number:</span>
                <span>{lastInvoice.heatNumber}</span>
              </div>
              <div className="receipt-row">
                <span>Steel Grade:</span>
                <span>{lastInvoice.grade}</span>
              </div>
              <div className="receipt-row">
                <span>Tonnage:</span>
                <span>{lastInvoice.tonnageSold} Tons</span>
              </div>
              <div className="receipt-row">
                <span>Unit Rate:</span>
                <span>${lastInvoice.pricePerTonUSD}/Ton</span>
              </div>

              <div className="receipt-divider" />

              <div className="receipt-row total">
                <span>TOTAL PAID:</span>
                <span className="amount">${lastInvoice.totalAmountUSD.toLocaleString()}</span>
              </div>
              <div className="receipt-row">
                <span>Payment Method:</span>
                <span>{lastInvoice.paymentMethod}</span>
              </div>

              <div className="receipt-footer">Thank you for your business!</div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print Receipt
              </button>
              <button
                className="btn-primary"
                onClick={() => setLastInvoice(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
