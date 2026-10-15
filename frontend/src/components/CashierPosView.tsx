import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  Receipt,
  Printer,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
  CreditCard,
  Building,
  RotateCcw,
  Boxes,
  Check,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { PosTransaction, PosCartItem, SteelCategory } from '../types/pos';
import type { SteelBatch } from '../types/steel';
import { fetchInventory, processPosSale } from '../services/api';

interface CashierPosViewProps {
  branch: BranchLocation;
  cashierName: string;
}

// Recommended steel grade pricing reference per ton
const GRADE_PRICE_MAP: Record<string, number> = {
  A36_Structural: 850,
  A572_HighStrength: 980,
  SS304_Stainless: 2450,
  SS316_Stainless: 3100,
  AISI1045_Carbon: 920,
  ToolSteel_D2: 3800,
};

const COMMON_CUSTOMERS = [
  { name: 'Mindanao Steelworks Corp.', tin: '241-890-112-000' },
  { name: 'Apex Construction Inc.', tin: '109-445-882-000' },
  { name: 'MegaBuild Infrastructure', tin: '330-192-551-000' },
  { name: 'Port Marine Fabricators', tin: '512-889-320-000' },
  { name: 'Davao Prime Engineering', tin: '419-332-108-000' },
];

export function CashierPosView({ branch, cashierName }: CashierPosViewProps) {
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SteelCategory>('All');

  // Multi-Item Cart
  const [cart, setCart] = useState<PosCartItem[]>([]);

  // Customer & Payment State
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(COMMON_CUSTOMERS[0].name);
  const [customCustomerInput, setCustomCustomerInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Corporate Credit Line' | 'Cheque'>('Cash');
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [applyVat, setApplyVat] = useState<boolean>(true);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Active Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<PosTransaction | null>(null);

  // Strict Branch Data Loading: only loads data for THIS branch!
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const invResult = await fetchInventory(undefined, undefined, undefined, branch);

      // Only batches marked 'Available' at THIS branch can be sold
      const available = invResult.data.filter(
        (b) => b.branch === branch && (b.status === 'Available' || b.status === 'QualityCheck') && b.weightInTons > 0
      );
      setBatches(available);
    } catch (err) {
      console.error('Failed loading POS data:', err);
    } finally {
      setLoading(false);
    }
  }, [branch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter Catalog Items by Search & Category
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Category Match
      let catMatch = true;
      if (selectedCategory === 'Structural') catMatch = b.grade.includes('A36');
      else if (selectedCategory === 'HighStrength') catMatch = b.grade.includes('A572');
      else if (selectedCategory === 'Stainless') catMatch = b.grade.includes('SS304') || b.grade.includes('SS316');
      else if (selectedCategory === 'Carbon') catMatch = b.grade.includes('1045');
      else if (selectedCategory === 'ToolSteel') catMatch = b.grade.includes('D2');

      // Search Match
      const q = searchQuery.toLowerCase().trim();
      const searchMatch =
        !q ||
        b.heatNumber.toLowerCase().includes(q) ||
        b.grade.toLowerCase().includes(q) ||
        b.dimensions.toLowerCase().includes(q) ||
        b.location.toLowerCase().includes(q);

      return catMatch && searchMatch;
    });
  }, [batches, selectedCategory, searchQuery]);

  // Add Item to Cart
  const handleAddToCart = (batch: SteelBatch) => {
    const existing = cart.find((item) => item.batchId === batch.id);
    const unitPrice = GRADE_PRICE_MAP[batch.grade] || 850;

    if (existing) {
      // Increment tonnage up to available capacity
      const maxAdd = Math.min(existing.quantityTons + 1.0, batch.weightInTons);
      setCart((prev) =>
        prev.map((item) =>
          item.batchId === batch.id
            ? {
                ...item,
                quantityTons: Number(maxAdd.toFixed(2)),
                lineTotalPHP: Number((maxAdd * item.pricePerTonPHP).toFixed(2)),
              }
            : item
        )
      );
    } else {
      // Initial default order tonnage: min 1 Ton or total batch weight
      const initialQty = Math.min(1.0, batch.weightInTons);
      const newItem: PosCartItem = {
        id: `cart-${batch.id}`,
        batchId: batch.id,
        heatNumber: batch.heatNumber,
        grade: batch.grade,
        dimensions: batch.dimensions,
        location: batch.location,
        availableTons: batch.weightInTons,
        quantityTons: Number(initialQty.toFixed(2)),
        pricePerTonPHP: unitPrice,
        lineTotalPHP: Number((initialQty * unitPrice).toFixed(2)),
      };
      setCart((prev) => [...prev, newItem]);
    }
  };

  // Update Cart Item Tonnage
  const handleUpdateCartTonnage = (cartItemId: string, newQty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === cartItemId) {
          const clamped = Math.max(0.1, Math.min(newQty, item.availableTons));
          return {
            ...item,
            quantityTons: Number(clamped.toFixed(2)),
            lineTotalPHP: Number((clamped * item.pricePerTonPHP).toFixed(2)),
          };
        }
        return item;
      })
    );
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  // Clear Entire Cart
  const handleClearCart = () => {
    setCart([]);
  };

  // Financial Computations
  const subtotalPHP = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.lineTotalPHP, 0);
  }, [cart]);

  const totalTonnage = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantityTons, 0);
  }, [cart]);

  const taxPHP = useMemo(() => {
    return applyVat ? Number((subtotalPHP * 0.12).toFixed(2)) : 0;
  }, [subtotalPHP, applyVat]);

  const grandTotalPHP = useMemo(() => {
    return Math.max(0, Number((subtotalPHP + taxPHP - discountAmount).toFixed(2)));
  }, [subtotalPHP, taxPHP, discountAmount]);

  const changeDuePHP = useMemo(() => {
    if (paymentMethod !== 'Cash' || amountTendered < grandTotalPHP) return 0;
    return Number((amountTendered - grandTotalPHP).toFixed(2));
  }, [paymentMethod, amountTendered, grandTotalPHP]);



  // Checkout Execution
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    const customer = selectedCustomerName === 'Other' ? customCustomerInput || 'Cash Customer' : selectedCustomerName;
    const foundTin = COMMON_CUSTOMERS.find((c) => c.name === customer)?.tin;

    const newTx = await processPosSale({
      branch,
      cashierName,
      customerName: customer,
      customerTin: foundTin,
      items: [...cart],
      totalTonnage: Number(totalTonnage.toFixed(2)),
      subtotalPHP: Number(subtotalPHP.toFixed(2)),
      taxPHP,
      discountPHP: discountAmount,
      totalAmountPHP: grandTotalPHP,
      paymentMethod,
      amountTenderedPHP: paymentMethod === 'Cash' ? amountTendered : undefined,
      changeDuePHP: paymentMethod === 'Cash' ? changeDuePHP : undefined,
      referenceNumber: referenceNumber || undefined,
    });

    setActiveReceipt(newTx);
    setCart([]);
    setAmountTendered(0);
    setReferenceNumber('');
    await loadData();
  };

  const getGradeBadgeClass = (grade: string) => {
    if (grade.includes('A36')) return 'structural';
    if (grade.includes('SS')) return 'stainless';
    if (grade.includes('1045')) return 'carbon';
    return 'highstrength';
  };

  return (
    <div className="pos-container">
      {/* PURE POS WORKSTATION: PRODUCT CATALOG (LEFT) & REGISTER CART (RIGHT) */}
      <div className="pos-layout-grid">
        {/* LEFT: PRODUCT CATALOG WITH SEARCH & CATEGORIES */}
        <div className="pos-catalog-panel">
          <div className="pos-panel-title">
            <Boxes size={18} style={{ color: '#0284C7' }} />
            <span>Available Inventory Catalog ({branch} Branch Stock)</span>
          </div>

          {/* Search and Category Filters */}
          <div className="pos-filter-section">
            <div className="pos-search-bar">
              <Search size={16} style={{ color: '#94A3B8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Heat #, Grade name, dimensions, or bay..."
              />
              {searchQuery && (
                <button
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Chips */}
            <div className="pos-category-chips">
              {(
                [
                  { key: 'All', label: 'All Stock' },
                  { key: 'Structural', label: 'Structural (A36)' },
                  { key: 'HighStrength', label: 'High Strength (A572)' },
                  { key: 'Stainless', label: 'Stainless (SS304/SS316)' },
                  { key: 'Carbon', label: 'Carbon (1045)' },
                  { key: 'ToolSteel', label: 'Tool Steel (D2)' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={`cat-chip ${selectedCategory === cat.key ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Card-Type Items Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8' }}>
              Loading available stock at {branch} Branch...
            </div>
          ) : filteredBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94A3B8', background: '#F8FAFC', borderRadius: '8px' }}>
              No available steel batches match your search criteria in {branch} Branch.
            </div>
          ) : (
            <div className="pos-items-grid">
              {filteredBatches.map((batch) => {
                const inCart = cart.find((item) => item.batchId === batch.id);
                const unitPrice = GRADE_PRICE_MAP[batch.grade] || 850;

                return (
                  <div
                    key={batch.id}
                    className={`pos-item-card ${inCart ? 'in-cart' : ''}`}
                    onClick={() => handleAddToCart(batch)}
                  >
                    <div>
                      <div className="card-top">
                        <span className={`card-grade-badge ${getGradeBadgeClass(batch.grade)}`}>
                          {batch.grade.replace('_', ' ')}
                        </span>
                        <span className="card-heat-no">{batch.heatNumber}</span>
                      </div>

                      <div className="card-title">{batch.dimensions}</div>
                      <div className="card-specs">Yard Location: {batch.location}</div>
                    </div>

                    <div>
                      <div className="card-stock-row">
                        <span className="stock-pill">{batch.weightInTons.toFixed(1)}T in stock</span>
                        <span className="price-pill">₱{unitPrice.toLocaleString()}/T</span>
                      </div>

                      <button
                        type="button"
                        className="card-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(batch);
                        }}
                      >
                        {inCart ? (
                          <>
                            <Check size={14} style={{ color: '#059669' }} /> In Order ({inCart.quantityTons}T)
                          </>
                        ) : (
                          <>
                            <Plus size={14} /> Add to Order
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: INTERACTIVE REGISTER & MULTI-ITEM ORDER CART */}
        <div className="pos-cart-panel">
          <div className="cart-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={18} style={{ color: '#0284C7' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Sales Order Cart</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="cart-badge">{cart.length} Item(s)</span>
              {cart.length > 0 && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  onClick={handleClearCart}
                  title="Clear all items"
                >
                  <RotateCcw size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleCheckout}>
            {/* Customer Information */}
            <div className="customer-section">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Customer / Billed Enterprise:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={selectedCustomerName}
                  onChange={(e) => setSelectedCustomerName(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  {COMMON_CUSTOMERS.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="Other">+ Enter Custom Client / Hauler</option>
                </select>
              </div>

              {selectedCustomerName === 'Other' && (
                <input
                  type="text"
                  placeholder="Enter client company name..."
                  value={customCustomerInput}
                  onChange={(e) => setCustomCustomerInput(e.target.value)}
                  style={{ marginTop: '0.5rem' }}
                  required
                />
              )}
            </div>

            {/* Cart Line Items */}
            <div className="cart-items-container">
              {cart.length === 0 ? (
                <div className="cart-empty-state">
                  <ShoppingCart size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3 }} />
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>Order Cart is Empty</p>
                  <span style={{ fontSize: '0.75rem' }}>
                    Select card items from the catalog on the left to build order.
                  </span>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-item-row">
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.grade.replace('_', ' ')}</div>
                      <div className="cart-item-meta">
                        {item.heatNumber} • Max: {item.availableTons}T
                      </div>
                    </div>

                    <div className="cart-item-qty">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max={item.availableTons}
                        value={item.quantityTons}
                        onChange={(e) =>
                          handleUpdateCartTonnage(item.id, parseFloat(e.target.value) || 0.1)
                        }
                        className="qty-input"
                        title="Tons ordered"
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>T</span>
                    </div>

                    <div className="cart-item-total">
                      ₱{(item.lineTotalPHP ?? item.lineTotalUSD ?? 0).toLocaleString()}
                    </div>

                    <button
                      type="button"
                      className="cart-remove-btn"
                      onClick={() => handleRemoveFromCart(item.id)}
                      title="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Financial Totals Summary */}
            <div className="cart-summary-box">
              <div className="summary-row">
                <span>Total Tonnage Weight:</span>
                <strong>{totalTonnage.toFixed(2)} Tons</strong>
              </div>

              <div className="summary-row">
                <span>Subtotal (Steel):</span>
                <span>₱{subtotalPHP.toLocaleString()}</span>
              </div>

              <div className="summary-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={applyVat}
                    onChange={(e) => setApplyVat(e.target.checked)}
                  />
                  <span>Standard Value Added Tax (12% VAT):</span>
                </label>
                <span>₱{taxPHP.toLocaleString()}</span>
              </div>

              <div className="summary-row">
                <span>Enterprise Volume Discount (₱):</span>
                <input
                  type="number"
                  min={0}
                  step="10"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  style={{ width: '90px', padding: '0.2rem 0.4rem', textAlign: 'right', fontSize: '0.85rem' }}
                />
              </div>

              <div className="summary-row total">
                <span>Grand Total Due:</span>
                <span className="summary-total-amount">₱{grandTotalPHP.toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Methods Selection */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                Payment Method:
              </label>
              <div className="payment-methods-grid">
                {(
                  [
                    { key: 'Cash', label: 'Cash Payment', icon: CreditCard },
                    { key: 'Bank Transfer', label: 'Bank Transfer', icon: Building },
                    { key: 'Corporate Credit Line', label: 'Credit Line', icon: CreditCard },
                    { key: 'Cheque', label: 'Company Cheque', icon: Receipt },
                  ] as const
                ).map((pm) => (
                  <button
                    key={pm.key}
                    type="button"
                    className={`pay-btn ${paymentMethod === pm.key ? 'active' : ''}`}
                    onClick={() => {
                      setPaymentMethod(pm.key);
                      if (pm.key === 'Cash' && amountTendered === 0) {
                        setAmountTendered(grandTotalPHP);
                      }
                    }}
                  >
                    <pm.icon size={14} />
                    {pm.label}
                  </button>
                ))}
              </div>

              {/* Cash Payment Tender Calculator */}
              {paymentMethod === 'Cash' && (
                <div className="cash-tender-box">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534' }}>
                      Cash Amount Tendered (₱):
                    </label>
                    <input
                      type="number"
                      step="1"
                      min={0}
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                      style={{ width: '110px', padding: '0.3rem', fontSize: '0.85rem', fontWeight: 700 }}
                      required
                    />
                  </div>

                  <div className="quick-denominations">
                    <span style={{ fontSize: '0.72rem', color: '#166534', alignSelf: 'center' }}>Quick:</span>
                    {[1000, 5000, 10000, 20000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className="denom-btn"
                        onClick={() => setAmountTendered(amt)}
                      >
                        ₱{amt.toLocaleString()}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="denom-btn"
                      onClick={() => setAmountTendered(grandTotalPHP)}
                    >
                      Exact
                    </button>
                  </div>

                  <div className="change-due-banner">
                    <span>Change Due to Customer:</span>
                    <span style={{ fontSize: '1.1rem', fontFamily: 'Outfit' }}>
                      ₱{changeDuePHP.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Bank Transfer Reference input */}
              {paymentMethod === 'Bank Transfer' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Bank Reference / Wire Confirmation #:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BDO-REF-883190"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Cheque Details input */}
              {paymentMethod === 'Cheque' && (
                <div style={{ marginBottom: '1rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                    Cheque # & Drawee Bank:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MBTC-992014 (Metrobank)"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem' }}
                  />
                  <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.3rem' }}>
                    Automatically tracked in Cheques & PDC Management ledger as 'Pending'.
                  </div>
                </div>
              )}

              {/* Corporate Credit Line info */}
              {paymentMethod === 'Corporate Credit Line' && (
                <div style={{ marginBottom: '1rem', background: '#EFF6FF', padding: '0.75rem', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1E40AF', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CreditCard size={14} /> Corporate Account Receivable
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#1E3A8A', marginTop: '0.25rem' }}>
                    Net 30-day payment term. This charge will be posted to the customer's Accounts Receivable balance.
                  </div>
                </div>
              )}
            </div>

            {/* Checkout & Submit */}
            <button
              type="submit"
              className="btn-checkout"
              disabled={cart.length === 0}
            >
              <CheckCircle2 size={18} /> Complete Sale & Generate Receipt
            </button>
          </form>
        </div>
      </div>

      {/* 4. OFFICIAL INDUSTRIAL INVOICE & THERMAL RECEIPT MODAL */}
      {activeReceipt && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669' }}>
                <CheckCircle2 size={20} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Transaction Confirmed</h3>
              </div>
              <button
                className="no-print"
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.25rem' }}
                onClick={() => setActiveReceipt(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="receipt-paper">
                <div className="receipt-header">
                  <div className="receipt-company">STEELTRACK ENTERPRISE</div>
                  <div className="receipt-sub">OFFICIAL POINT OF SALE TAX INVOICE</div>
                  <div className="receipt-sub">
                    {activeReceipt.branch.toUpperCase()} BRANCH - OPERATIONAL TERMINAL
                  </div>
                </div>

                <div className="receipt-divider" />

                <div className="receipt-row">
                  <span>Invoice #:</span>
                  <strong style={{ color: '#0284C7' }}>{activeReceipt.invoiceNumber}</strong>
                </div>

                <div className="receipt-row">
                  <span>Date & Time:</span>
                  <span>{new Date(activeReceipt.createdAt).toLocaleString()}</span>
                </div>

                <div className="receipt-row">
                  <span>Terminal Cashier:</span>
                  <span>{activeReceipt.cashierName}</span>
                </div>

                <div className="receipt-row">
                  <span>Client / Enterprise:</span>
                  <strong>{activeReceipt.customerName}</strong>
                </div>

                {activeReceipt.customerTin && (
                  <div className="receipt-row">
                    <span>Tax ID (TIN):</span>
                    <span>{activeReceipt.customerTin}</span>
                  </div>
                )}

                <div className="receipt-divider" />

                {/* Line Items Table */}
                <table className="receipt-items-table">
                  <thead>
                    <tr>
                      <th>Steel Grade / Heat</th>
                      <th style={{ textAlign: 'center' }}>Tons</th>
                      <th style={{ textAlign: 'right' }}>₱/Ton</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReceipt.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <div>{item.grade.replace('_', ' ')}</div>
                          <div style={{ fontSize: '0.68rem', color: '#64748B' }}>{item.heatNumber}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.quantityTons}T</td>
                        <td style={{ textAlign: 'right' }}>₱{(item.pricePerTonPHP ?? item.pricePerTonUSD ?? 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₱{(item.lineTotalPHP ?? item.lineTotalUSD ?? 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="receipt-divider" />

                <div className="receipt-row">
                  <span>Total Net Weight:</span>
                  <strong>{activeReceipt.totalTonnage} Tons</strong>
                </div>

                <div className="receipt-row">
                  <span>Subtotal:</span>
                  <span>₱{(activeReceipt.subtotalPHP ?? activeReceipt.subtotalUSD ?? 0).toLocaleString()}</span>
                </div>

                <div className="receipt-row">
                  <span>VAT (12%):</span>
                  <span>₱{(activeReceipt.taxPHP ?? activeReceipt.taxUSD ?? 0).toLocaleString()}</span>
                </div>

                <div className="receipt-divider" />

                <div className="receipt-row total">
                  <span>TOTAL PAID:</span>
                  <span style={{ color: '#059669', fontSize: '1.2rem' }}>
                    ₱{(activeReceipt.totalAmountPHP ?? activeReceipt.totalAmountUSD ?? 0).toLocaleString()}
                  </span>
                </div>

                <div className="receipt-row">
                  <span>Payment Tender:</span>
                  <span>{activeReceipt.paymentMethod}</span>
                </div>

                {(activeReceipt.amountTenderedPHP !== undefined || activeReceipt.amountTenderedUSD !== undefined) && (
                  <>
                    <div className="receipt-row">
                      <span>Amount Tendered:</span>
                      <span>₱{((activeReceipt.amountTenderedPHP ?? activeReceipt.amountTenderedUSD) || 0).toLocaleString()}</span>
                    </div>
                    <div className="receipt-row">
                      <span>Change Due:</span>
                      <span>₱{((activeReceipt.changeDuePHP ?? activeReceipt.changeDueUSD) || 0).toLocaleString()}</span>
                    </div>
                  </>
                )}

                {activeReceipt.referenceNumber && (
                  <div className="receipt-row">
                    <span>Reference #:</span>
                    <span>{activeReceipt.referenceNumber}</span>
                  </div>
                )}

                <div className="receipt-barcode">
                  ||| | |||| || |||||| | ||| |||| | ||
                </div>

                <div className="receipt-footer-msg">
                  Official BIR / Capstone Project Receipt Stamp<br />
                  Thank you for partnering with SteelTrack Enterprise.
                </div>
              </div>
            </div>

            <div className="modal-footer no-print">
              <button
                type="button"
                className="btn-secondary no-print"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print Receipt (Thermal)
              </button>
              <button
                type="button"
                className="btn-primary no-print"
                onClick={() => setActiveReceipt(null)}
              >
                New Transaction
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
