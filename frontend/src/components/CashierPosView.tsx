import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShoppingCart,
  Printer,
  CheckCircle2,
  Search,
  Plus,
  Trash2,
  Building,
  RotateCcw,
  Boxes,
  Check,
  CreditCard,
  X,
  AlertCircle,
  AlertTriangle,
  Download,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BranchLocation } from '../types/auth';
import type { PosTransaction, PosCartItem, SteelCategory } from '../types/pos';
import { fetchPosBatches, processPosSale, fetchCustomers, type PosBatchItem } from '../services/api';
import { printReceiptPdf } from '../utils/tableExport';
import { formatPHP } from '../utils/currency';
import {
  enqueueOfflineSale,
  getPendingOfflineSalesCount,
  syncOfflineSales,
} from '../utils/offlinePosQueue';

interface CashierPosViewProps {
  branch: BranchLocation;
  cashierName: string;
}

const POS_CATEGORIES: { key: SteelCategory; label: string }[] = [
  { key: 'All', label: 'All Stock' },
  { key: 'Stainless Plates', label: 'Stainless Plates' },
  { key: 'Bars', label: 'Bars' },
  { key: 'Sheets', label: 'Sheets' },
  { key: 'Tubes', label: 'Tubes' },
];

export function CashierPosView({ branch, cashierName }: CashierPosViewProps) {
  const [batches, setBatches] = useState<PosBatchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Category Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SteelCategory>('All');

  // Multi-Item Cart
  const [cart, setCart] = useState<PosCartItem[]>([]);

  // Customer & Payment State
  const [customers, setCustomers] = useState<{ name: string; tin?: string }[]>([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('Walk-in Client');
  const [customCustomerInput, setCustomCustomerInput] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Bank Transfer' | 'Corporate Credit Line' | 'Cheque' | 'Split Payment'>('Cash');
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [taxMode, setTaxMode] = useState<0 | 1 | 2 | 3>(1); // 0=None, 1=VAT 12%, 2=WHT 1%, 3=Manual
  const [manualTaxName, setManualTaxName] = useState<string>('Manual Tax');
  const [manualTaxIsPercent, setManualTaxIsPercent] = useState<boolean>(true);
  const [manualTaxValue, setManualTaxValue] = useState<number>(5);
  const [manualTaxIsDeduction, setManualTaxIsDeduction] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Split Payment tenders state
  const [splitTenders, setSplitTenders] = useState<Array<{
    id: string;
    method: 'Cash' | 'Card' | 'Bank Transfer' | 'Corporate Credit Line' | 'Cheque';
    amount: number;
    referenceNumber: string;
  }>>([
    { id: '1', method: 'Cash', amount: 0, referenceNumber: '' },
    { id: '2', method: 'Card', amount: 0, referenceNumber: '' },
  ]);

  // Active Receipt Modal (Issued for every transaction)
  const [activeReceipt, setActiveReceipt] = useState<PosTransaction | null>(null);
  const [transactionError, setTransactionError] = useState<{ message: string; details?: string } | null>(null);

  // Dedicated Review Cart & Payment Modal State
  const [isReviewCartModalOpen, setIsReviewCartModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isProcessingSale, setIsProcessingSale] = useState<boolean>(false);
  const [fifoNotice, setFifoNotice] = useState<string | null>(null);

  // Offline / Edge POS Queue State (Deliverable 9)
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineSyncNotice, setOfflineSyncNotice] = useState<string | null>(null);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  // Automatically load batch data from database for THIS branch
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [posResult, custList] = await Promise.all([
        fetchPosBatches(branch, selectedCategory, debouncedSearch),
        fetchCustomers(branch),
      ]);

      // Product has to be available at the branch to appear (isAvailable == true and quantity > 0)
      const availableItems = posResult.data.filter(
        (b) => b.isAvailable !== false && b.isActive !== false && b.quantity > 0
      );
      setBatches(availableItems);

      if (custList && custList.length > 0) {
        const mappedCust = custList.map((c) => ({ name: c.customerName, tin: c.tin }));
        setCustomers(mappedCust);
        setSelectedCustomerName(mappedCust[0].name);
      }
    } catch (err) {
      console.error('Failed loading POS batch data:', err);
    } finally {
      setLoading(false);
    }
  }, [branch, selectedCategory, debouncedSearch]);

  const refreshOfflineCount = useCallback(async () => {
    try {
      const count = await getPendingOfflineSalesCount();
      setOfflinePendingCount(count);
    } catch {}
  }, []);

  const triggerOfflineSync = useCallback(async () => {
    if (isSyncingOffline) return;
    setIsSyncingOffline(true);
    setOfflineSyncNotice(null);
    try {
      const res = await syncOfflineSales(processPosSale);
      if (res.synced > 0) {
        setOfflineSyncNotice(`Successfully synced ${res.synced} offline transaction(s) to the backend.`);
        loadData();
      }
      await refreshOfflineCount();
    } catch (err: any) {
      console.warn('Manual sync failed:', err);
    } finally {
      setIsSyncingOffline(false);
    }
  }, [isSyncingOffline, loadData, refreshOfflineCount]);

  useEffect(() => {
    void refreshOfflineCount();

    const handleOnlineStatus = () => {
      setIsOnline(true);
      void triggerOfflineSync();
    };

    const handleOfflineStatus = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, [refreshOfflineCount, triggerOfflineSync]);

  // Debounce search keystrokes to ensure smooth live typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side instant filter on current batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      // Category match
      let catMatch = true;
      if (selectedCategory === 'Stainless Plates') catMatch = b.categoryName.toLowerCase().includes('plate');
      else if (selectedCategory === 'Bars' || selectedCategory === 'Stainless Bars') catMatch = b.categoryName.toLowerCase().includes('bar');
      else if (selectedCategory === 'Sheets' || selectedCategory === 'Stainless Sheets') catMatch = b.categoryName.toLowerCase().includes('sheet');
      else if (selectedCategory === 'Tubes' || selectedCategory === 'Stainless Tubes') catMatch = b.categoryName.toLowerCase().includes('tube');

      // Search match
      const q = searchQuery.toLowerCase().trim();
      const searchMatch =
        !q ||
        b.productName.toLowerCase().includes(q) ||
        b.sku.toLowerCase().includes(q) ||
        b.batchCode.toLowerCase().includes(q) ||
        b.grade.toLowerCase().includes(q) ||
        b.dimensions.toLowerCase().includes(q);

      return catMatch && searchMatch;
    });
  }, [batches, selectedCategory, searchQuery]);

  // Add Item to Cart with FIFO (First-In, First-Out) Priority
  const handleAddToCart = (batch: PosBatchItem) => {
    // Check if an older batch of the SAME product has remaining inventory
    const sameProductBatches = batches.filter(
      (b) => b.productId === batch.productId && b.quantity > 0
    );

    let targetBatch = batch;
    // Find oldest batch (FIFO priority)
    const oldestBatch = sameProductBatches.find((b) => b.isOldStock || b.fifoPriority) || sameProductBatches[0];

    // If user clicked a newer batch while the older batch still has unallocated stock, use older batch first
    if (oldestBatch && oldestBatch.batchId !== batch.batchId) {
      const alreadyInCartOld = cart.find((item) => item.batchId === oldestBatch.batchId);
      const remainingOldStock = oldestBatch.quantity - (alreadyInCartOld?.quantityTons || 0);

      if (remainingOldStock > 0) {
        setFifoNotice(
          `FIFO Policy Active: Older stock (Batch #${oldestBatch.batchCode} @ ${formatPHP(oldestBatch.sellingPrice)}) must be depleted before newer products with updated prices.`
        );
        targetBatch = oldestBatch;
      }
    }

    const existing = cart.find((item) => item.batchId === targetBatch.batchId);
    const unitPrice = Number(targetBatch.sellingPrice || targetBatch.branchSellingPrice || targetBatch.batchSellingPrice || 0);

    if (existing) {
      const maxAdd = Math.min(existing.quantityTons + 1, targetBatch.quantity);
      setCart((prev) =>
        prev.map((item) =>
          item.batchId === targetBatch.batchId
            ? {
              ...item,
              quantityTons: maxAdd,
              lineTotalPHP: Number((maxAdd * item.pricePerTonPHP).toFixed(2)),
            }
            : item
        )
      );
    } else {
      const initialQty = Math.min(1, targetBatch.quantity);
      const newItem: PosCartItem = {
        id: `cart-${targetBatch.batchId}`,
        batchId: targetBatch.batchId,
        batchCode: targetBatch.batchCode,
        productId: targetBatch.productId,
        productName: targetBatch.productName,
        sku: targetBatch.sku,
        categoryName: targetBatch.categoryName,
        heatNumber: targetBatch.batchCode,
        grade: targetBatch.grade,
        dimensions: targetBatch.dimensions,
        location: `${branch} Yard`,
        availableTons: targetBatch.quantity,
        availableQuantity: targetBatch.quantity,
        quantityTons: initialQty,
        pricePerTonPHP: unitPrice,
        costPrice: targetBatch.costPrice,
        lineTotalPHP: Number((initialQty * unitPrice).toFixed(2)),
        unitOfMeasure: targetBatch.unitOfMeasure,
        isOldStock: targetBatch.isOldStock,
        fifoPriority: targetBatch.fifoPriority,
        fifoRank: targetBatch.fifoRank,
        receivedDate: targetBatch.receivedDate,
      };
      setCart((prev) => [...prev, newItem]);
    }
  };

  // Update Cart Item Quantity
  const handleUpdateCartQuantity = (cartItemId: string, newQty: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === cartItemId) {
          const maxAvail = item.availableQuantity ?? item.availableTons;
          const clamped = Math.max(1, Math.min(newQty, maxAvail));
          return {
            ...item,
            quantityTons: clamped,
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

  const totalQuantityUnits = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantityTons, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return Number(((subtotalPHP * discountPercent) / 100).toFixed(2));
  }, [subtotalPHP, discountPercent]);

  const taxableBasePHP = useMemo(() => {
    return Math.max(0, Number((subtotalPHP - discountAmount).toFixed(2)));
  }, [subtotalPHP, discountAmount]);

  const { taxPHP, withholdingPHP, taxLabel } = useMemo(() => {
    if (taxMode === 1) {
      return {
        taxPHP: Number((taxableBasePHP * 0.12).toFixed(2)),
        withholdingPHP: 0,
        taxLabel: 'VAT 12%',
      };
    }
    if (taxMode === 2) {
      return {
        taxPHP: 0,
        withholdingPHP: Number((taxableBasePHP * 0.01).toFixed(2)),
        taxLabel: 'WHT 1%',
      };
    }
    if (taxMode === 3) {
      const val = Math.max(0, manualTaxValue || 0);
      const computed = manualTaxIsPercent
        ? Number(((taxableBasePHP * val) / 100).toFixed(2))
        : Number(val.toFixed(2));
      const label = manualTaxName.trim() || 'Manual Tax';
      return manualTaxIsDeduction
        ? { taxPHP: 0, withholdingPHP: computed, taxLabel: label }
        : { taxPHP: computed, withholdingPHP: 0, taxLabel: label };
    }
    return { taxPHP: 0, withholdingPHP: 0, taxLabel: 'No Tax' };
  }, [taxMode, taxableBasePHP, manualTaxName, manualTaxIsPercent, manualTaxValue, manualTaxIsDeduction]);

  const grandTotalPHP = useMemo(() => {
    return Math.max(0, Number((taxableBasePHP + taxPHP - withholdingPHP).toFixed(2)));
  }, [taxableBasePHP, taxPHP, withholdingPHP]);

  const changeDuePHP = useMemo(() => {
    if (paymentMethod !== 'Cash' || amountTendered < grandTotalPHP) return 0;
    return Number((amountTendered - grandTotalPHP).toFixed(2));
  }, [paymentMethod, amountTendered, grandTotalPHP]);

  // Split payment computations
  const totalSplitAllocated = useMemo(() => {
    return splitTenders.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [splitTenders]);

  const splitRemainingDue = useMemo(() => {
    return Math.max(0, Number((grandTotalPHP - totalSplitAllocated).toFixed(2)));
  }, [grandTotalPHP, totalSplitAllocated]);

  const splitCashTender = useMemo(() => {
    return splitTenders.filter((t) => t.method === 'Cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [splitTenders]);

  const splitNonCashSum = useMemo(() => {
    return splitTenders.filter((t) => t.method !== 'Cash').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [splitTenders]);

  const splitChangeDue = useMemo(() => {
    if (paymentMethod !== 'Split Payment') return 0;
    const requiredCash = Math.max(0, grandTotalPHP - splitNonCashSum);
    return Math.max(0, Number((splitCashTender - requiredCash).toFixed(2)));
  }, [paymentMethod, grandTotalPHP, splitNonCashSum, splitCashTender]);

  // Sale Execution from Dedicated Payment Modal (Supports Offline Queueing)
  const handleExecuteSale = async () => {
    if (cart.length === 0 || isProcessingSale) return;
    if (taxMode === 3 && (!manualTaxValue || manualTaxValue <= 0)) {
      setTransactionError({ message: 'Please enter a manual tax value greater than zero.' });
      return;
    }
    setIsProcessingSale(true);

    const customer = selectedCustomerName === 'Other' ? customCustomerInput || 'Cash Customer' : selectedCustomerName;
    const foundTin = customers.find((c) => c.name === customer)?.tin;

    const isSplit = paymentMethod === 'Split Payment';
    const cleanSplitTenders = isSplit
      ? splitTenders.filter((t) => t.amount > 0).map((t) => ({
          method: t.method,
          amount: Number(t.amount),
          referenceNumber: t.referenceNumber || undefined,
        }))
      : undefined;

    const salePayload = {
      branch,
      cashierName,
      customerName: customer,
      customerTin: foundTin,
      items: [...cart],
      totalTonnage: Number(totalQuantityUnits.toFixed(2)),
      subtotalPHP: Number(subtotalPHP.toFixed(2)),
      taxPHP,
      withholdingPHP,
      taxMode,
      taxTypeLabel: taxLabel,
      manualTaxName: taxMode === 3 ? (manualTaxName.trim() || 'Manual Tax') : undefined,
      manualTaxIsPercent: taxMode === 3 ? manualTaxIsPercent : false,
      manualTaxValue: taxMode === 3 ? manualTaxValue : 0,
      manualTaxIsDeduction: taxMode === 3 ? manualTaxIsDeduction : false,
      discountPercent,
      discountPHP: discountAmount,
      totalAmountPHP: grandTotalPHP,
      paymentMethod,
      splitTenders: cleanSplitTenders,
      amountTenderedPHP: isSplit
        ? totalSplitAllocated
        : paymentMethod === 'Cash'
        ? amountTendered
        : grandTotalPHP,
      changeDuePHP: isSplit ? splitChangeDue : paymentMethod === 'Cash' ? changeDuePHP : 0,
      referenceNumber: referenceNumber || undefined,
    };

    // If client is currently offline, enqueue directly to IndexedDB
    if (!navigator.onLine) {
      try {
        const offlineId = await enqueueOfflineSale(salePayload);
        const offlineReceipt: PosTransaction = {
          id: offlineId,
          invoiceNumber: `OFFLINE-${Date.now().toString().slice(-6)}`,
          branch,
          cashierName,
          customerName: customer,
          customerTin: foundTin,
          items: [...cart],
          totalTonnage: Number(totalQuantityUnits.toFixed(2)),
          subtotalPHP: Number(subtotalPHP.toFixed(2)),
          taxPHP,
          discountPHP: discountAmount,
          totalAmountPHP: grandTotalPHP,
          paymentMethod,
          amountTenderedPHP: salePayload.amountTenderedPHP,
          changeDuePHP: salePayload.changeDuePHP,
          referenceNumber: 'OFFLINE_LOCAL',
          createdAt: new Date().toISOString(),
        };
        setIsPaymentModalOpen(false);
        setActiveReceipt(offlineReceipt);
        setCart([]);
        setAmountTendered(0);
        setReferenceNumber('');
        await refreshOfflineCount();
        return;
      } catch (offlineErr: any) {
        setTransactionError({
          message: 'Failed to queue offline sale: ' + (offlineErr.message || 'IndexedDB error'),
        });
        return;
      } finally {
        setIsProcessingSale(false);
      }
    }

    try {
      const newTx = await processPosSale(salePayload);

      // Close payment modal and issue receipt immediately
      setIsPaymentModalOpen(false);
      setActiveReceipt(newTx);
      setCart([]);
      setDiscountPercent(0);
      setAmountTendered(0);
      setReferenceNumber('');
      setSplitTenders([
        { id: '1', method: 'Cash', amount: 0, referenceNumber: '' },
        { id: '2', method: 'Card', amount: 0, referenceNumber: '' },
      ]);
      await loadData();
    } catch (err: any) {
      // If error is network related, fallback gracefully to offline queue
      const errMsg = (err.message || '').toLowerCase();
      if (!navigator.onLine || errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('failed to fetch')) {
        try {
          const offlineId = await enqueueOfflineSale(salePayload);
          const offlineReceipt: PosTransaction = {
            id: offlineId,
            invoiceNumber: `OFFLINE-${Date.now().toString().slice(-6)}`,
            branch,
            cashierName,
            customerName: customer,
            customerTin: foundTin,
            items: [...cart],
            totalTonnage: Number(totalQuantityUnits.toFixed(2)),
            subtotalPHP: Number(subtotalPHP.toFixed(2)),
            taxPHP,
            discountPHP: discountAmount,
            totalAmountPHP: grandTotalPHP,
            paymentMethod,
            amountTenderedPHP: salePayload.amountTenderedPHP,
            changeDuePHP: salePayload.changeDuePHP,
            referenceNumber: 'OFFLINE_LOCAL',
            createdAt: new Date().toISOString(),
          };
          setIsPaymentModalOpen(false);
          setActiveReceipt(offlineReceipt);
          setCart([]);
          setAmountTendered(0);
          setReferenceNumber('');
          await refreshOfflineCount();
          return;
        } catch (enqueueErr) {
          console.error('Offline fallback failed:', enqueueErr);
        }
      }

      console.error('POS Checkout Error:', err);
      setTransactionError({
        message: err.message || 'Failed to complete sale transaction.',
        details: 'The database transaction was safely rolled back. No stock or financial balances were modified.',
      });
    } finally {
      setIsProcessingSale(false);
    }
  };

  const getCategoryBadgeColor = (categoryName: string) => {
    const c = categoryName.toLowerCase();
    if (c.includes('sheet')) return { bg: '#E0F2FE', fg: '#0284C7', border: '#BAE6FD' };
    if (c.includes('tube')) return { bg: '#F5F3FF', fg: '#7C3AED', border: '#DDD6FE' };
    if (c.includes('bar')) return { bg: '#FEF3C7', fg: '#D97706', border: '#FDE68A' };
    if (c.includes('plate')) return { bg: '#ECFDF5', fg: '#059669', border: '#A7F3D0' };
    return { bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' };
  };

  return (
    <div className="pos-container">
      {/* POS WORKSTATION: PRODUCT CATALOG (LEFT) & REGISTER CART (RIGHT) */}
      <div className="pos-layout-grid">
        {/* LEFT: PRODUCT CATALOG WITH SEARCH & CATEGORIES */}
        <div className="pos-catalog-panel">
          <div className="pos-panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Boxes size={18} style={{ color: '#0284C7' }} />
              <span>Available Inventory Catalog ({branch} Branch Stock)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.6rem',
                  borderRadius: '9999px',
                  background: isOnline ? '#ECFDF5' : '#FEF3C7',
                  color: isOnline ? '#059669' : '#D97706',
                  border: `1px solid ${isOnline ? '#A7F3D0' : '#FDE68A'}`,
                }}
              >
                {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                {isOnline ? 'Online POS' : 'Offline / Edge Mode'}
              </span>
              {offlinePendingCount > 0 && (
                <button
                  type="button"
                  onClick={triggerOfflineSync}
                  disabled={isSyncingOffline || !isOnline}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    background: '#0284C7',
                    color: '#FFF',
                    border: 'none',
                    cursor: isOnline ? 'pointer' : 'not-allowed',
                    opacity: isSyncingOffline ? 0.7 : 1,
                  }}
                >
                  {isSyncingOffline ? 'Syncing...' : `Sync (${offlinePendingCount})`}
                </button>
              )}
            </div>
          </div>

          {offlineSyncNotice && (
            <div style={{ margin: '0 0 0.75rem 0', padding: '0.6rem 0.85rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, color: '#065F46', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{offlineSyncNotice}</span>
              <button
                type="button"
                onClick={() => setOfflineSyncNotice(null)}
                style={{ background: 'none', border: 'none', color: '#065F46', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* FIFO Policy Notification Banner */}
          {fifoNotice && (
            <div style={{ margin: '0 0 0.75rem 0', padding: '0.6rem 0.85rem', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, color: '#92400E', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={15} style={{ color: '#D97706', flexShrink: 0 }} />
                <span>{fifoNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setFifoNotice(null)}
                style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Search and Category Filters */}
          <div className="pos-filter-section">
            <div className="pos-search-bar">
              <Search size={16} style={{ color: '#000000' }} />
              {/* Removed placeholder text as explicitly requested */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: '#000000', cursor: 'pointer' }}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Chips: Stainless Plates, Bars, Sheets, and Tubes */}
            <div className="pos-category-chips">
              {
                POS_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`cat-chip ${selectedCategory === cat.key ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.key)}
                  >
                    {cat.label}
                  </button>
                ))
              }
            </div>
          </div>

          {/* Card-Type Items Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#000000' }}>
              Loading available stock at {branch} Branch...
            </div>
          ) : filteredBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#000000', background: '#F8FAFC', borderRadius: '8px' }}>
              No available steel batches match your search criteria in {branch} Branch.
            </div>
          ) : (
            <div className="pos-items-grid">
              {filteredBatches.map((batch) => {
                const inCart = cart.find((item) => item.batchId === batch.batchId);
                const badgeTheme = getCategoryBadgeColor(batch.categoryName);

                return (
                  <div
                    key={batch.batchId}
                    className={`pos-item-card ${inCart ? 'in-cart' : ''}`}
                    onClick={() => handleAddToCart(batch)}
                  >
                    <div>
                      <div className="card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span
                          style={{
                            background: badgeTheme.bg,
                            color: badgeTheme.fg,
                            border: `1px solid ${badgeTheme.border}`,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                          }}
                        >
                          {batch.categoryName}
                        </span>
                        <span className="card-heat-no" style={{ fontSize: '0.75rem', color: '#000000', fontFamily: 'monospace' }}>
                          Batch: {batch.batchCode}
                        </span>
                      </div>

                      <div className="card-title" style={{ fontSize: '0.95rem', fontWeight: 700, color: '#000000', marginBottom: '0.2rem' }}>
                        {batch.productName}
                      </div>
                      <div className="card-specs" style={{ fontSize: '0.78rem', color: '#000000', marginBottom: '0.35rem' }}>
                        SKU: <strong style={{ color: '#0284C7' }}>{batch.sku}</strong> · {batch.dimensions}
                      </div>

                      {/* FIFO Classification Badges: Old Stock vs New Stock */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {batch.isOldStock ? (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '0.12rem 0.45rem', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Zap size={10} /> FIFO Old Stock (Priority)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.68rem', fontWeight: 600, background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '0.12rem 0.45rem', borderRadius: 4 }}>
                            📦 New Stock (Queue #{batch.fifoRank || 2})
                          </span>
                        )}
                        {batch.receivedDate && (
                          <span style={{ fontSize: '0.68rem', color: '#000000' }}>
                            Rec'd: {batch.receivedDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="card-stock-row" style={{ marginTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="stock-pill" style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', fontWeight: 700, fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                          {batch.quantity} {batch.unitOfMeasure || 'pcs'} in stock
                        </span>
                        <span className="price-pill" style={{ fontSize: '0.95rem', fontWeight: 800, color: '#000000' }}>
                          {formatPHP(batch.sellingPrice)}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: '0.2rem', textAlign: 'right' }}>
                        Cost: {formatPHP(batch.costPrice)}
                      </div>

                      <button
                        type="button"
                        className="card-add-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(batch);
                        }}
                        style={{ marginTop: '0.5rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                      >
                        {inCart ? (
                          <>
                            <Check size={14} style={{ color: '#059669' }} /> In Order ({inCart.quantityTons} {batch.unitOfMeasure || 'pcs'})
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

        {/* RIGHT: REGISTER & MULTI-ITEM ORDER CART */}
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
                  style={{ background: 'none', border: 'none', color: '#000000', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  onClick={handleClearCart}
                  title="Clear all items"
                >
                  <RotateCcw size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (cart.length > 0) setIsPaymentModalOpen(true); }}>
            {/* Customer Information */}
            <div className="customer-section">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#000000', marginBottom: '0.35rem' }}>
                Customer / Billed Enterprise:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={selectedCustomerName}
                  onChange={(e) => setSelectedCustomerName(e.target.value)}
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  {customers.map((c) => (
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
                    Select items from the catalog on the left to build an order.
                  </span>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="cart-item-row">
                    <div className="cart-item-info">
                      <div className="cart-item-name" style={{ fontWeight: 700 }}>
                        {item.productName || item.grade}
                      </div>
                      <div className="cart-item-meta" style={{ fontSize: '0.75rem', color: '#000000' }}>
                        Batch: {item.batchCode || item.heatNumber} • SKU: {item.sku} • Stock: {item.availableQuantity || item.availableTons}
                      </div>
                    </div>

                    <div className="cart-item-qty">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max={item.availableQuantity || item.availableTons}
                        value={item.quantityTons}
                        onChange={(e) =>
                          handleUpdateCartQuantity(item.id, parseInt(e.target.value) || 1)
                        }
                        className="qty-input"
                        title="Quantity ordered"
                      />
                      <span style={{ fontSize: '0.75rem', color: '#000000' }}>{item.unitOfMeasure || 'pc'}</span>
                    </div>

                    <div className="cart-item-total" style={{ fontWeight: 700 }}>
                      {formatPHP(item.lineTotalPHP)}
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
                <span>Total Items Ordered:</span>
                <strong>{totalQuantityUnits} Units</strong>
              </div>

              <div className="summary-row">
                <span>Subtotal:</span>
                <span>{formatPHP(subtotalPHP)}</span>
              </div>

              <div className="summary-row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                <span>Discount:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    aria-label="Discount Percentage"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#000000',
                    }}
                  >
                    <option value={0}>0% (None)</option>
                    {Array.from({ length: 20 }, (_, i) => i + 1).map((pct) => (
                      <option key={pct} value={pct}>
                        {pct}%
                      </option>
                    ))}
                  </select>
                  <span style={{ minWidth: '72px', textAlign: 'right', color: discountAmount > 0 ? '#059669' : '#000000' }}>
                    {discountAmount > 0 ? `-${formatPHP(discountAmount)}` : formatPHP(0)}
                  </span>
                </div>
              </div>

              <div className="summary-row" style={{ alignItems: 'center', gap: '0.5rem' }}>
                <span>Tax:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select
                    aria-label="Tax Mode"
                    value={taxMode}
                    onChange={(e) => setTaxMode(Number(e.target.value) as 0 | 1 | 2 | 3)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.82rem',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      background: '#FFFFFF',
                      color: '#000000',
                    }}
                  >
                    <option value={1}>VAT 12%</option>
                    <option value={2}>WHT 1%</option>
                    <option value={3}>Manual Tax</option>
                    <option value={0}>No Tax (0%)</option>
                  </select>
                  <span style={{ minWidth: '72px', textAlign: 'right', color: withholdingPHP > 0 ? '#DC2626' : '#000000' }}>
                    {withholdingPHP > 0 ? `-${formatPHP(withholdingPHP)}` : formatPHP(taxPHP)}
                  </span>
                </div>
              </div>

              {taxMode === 3 && (
                <div
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '6px',
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr 68px 64px 74px',
                    gap: '0.35rem',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    placeholder="Tax name"
                    value={manualTaxName}
                    onChange={(e) => setManualTaxName(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.4rem', borderRadius: 4, border: '1px solid #CBD5E1' }}
                  />
                  <input
                    type="number"
                    min={0.01}
                    max={manualTaxIsPercent ? 100 : undefined}
                    step="0.5"
                    value={manualTaxValue}
                    onChange={(e) => setManualTaxValue(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.35rem', textAlign: 'right', borderRadius: 4, border: '1px solid #CBD5E1' }}
                  />
                  <select
                    value={manualTaxIsPercent ? 'pct' : 'php'}
                    onChange={(e) => setManualTaxIsPercent(e.target.value === 'pct')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem', borderRadius: 4, border: '1px solid #CBD5E1', background: '#FFF' }}
                  >
                    <option value="pct">%</option>
                    <option value="php">₱</option>
                  </select>
                  <select
                    value={manualTaxIsDeduction ? 'deduct' : 'add'}
                    onChange={(e) => setManualTaxIsDeduction(e.target.value === 'deduct')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem', borderRadius: 4, border: '1px solid #CBD5E1', background: '#FFF' }}
                  >
                    <option value="add">+ Add</option>
                    <option value="deduct">- Ded</option>
                  </select>
                </div>
              )}

              <div className="summary-row total-highlight">
                <span>Grand Total Due:</span>
                <span className="total-due">{formatPHP(grandTotalPHP)}</span>
              </div>
            </div>

            {/* Checkout Action: Review Customer Cart Modal Trigger */}
            <div style={{ marginTop: '1.25rem' }}>
              <button
                type="button"
                className="checkout-submit-btn"
                disabled={cart.length === 0}
                onClick={() => setIsReviewCartModalOpen(true)}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                  background: cart.length === 0 ? '#94A3B8' : '#0284C7',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  border: 'none',
                  boxShadow: cart.length === 0 ? 'none' : '0 4px 6px -1px rgba(2, 132, 199, 0.3)',
                }}
              >
                <CreditCard size={18} /> Proceed to Payment
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* REVIEW CUSTOMER CART MODAL */}
      {isReviewCartModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReviewCartModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 840, width: '92%', borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', padding: 0, overflow: 'hidden' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #E2E8F0', padding: '1rem 1.5rem', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#000000' }}>Review Customer Cart</h3>
                  <div style={{ fontSize: '0.78rem', color: '#000000' }}>
                    {selectedCustomerName === 'Other' ? (customCustomerInput || 'Cash Client') : selectedCustomerName} {customers.find((c) => c.name === selectedCustomerName)?.tin ? `• TIN: ${customers.find((c) => c.name === selectedCustomerName)?.tin}` : ''} • Verify item specifications before payment
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsReviewCartModalOpen(false)}
                style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                title="Close"
              >
                <X size={18} style={{ color: '#000000' }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', padding: '1.5rem' }}>
              {/* Left Panel: List of products purchasing */}
              <div style={{ borderRight: '1px solid #E2E8F0', paddingRight: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Purchased Products</span>
                  <span style={{ fontSize: '0.75rem', background: '#E2E8F0', color: '#000000', padding: '0.1rem 0.45rem', borderRadius: 999 }}>{cart.length}</span>
                </h4>

                <div style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #CBD5E1', textAlign: 'left', background: '#F8FAFC' }}>
                        <th style={{ padding: '0.5rem 0.6rem', color: '#000000' }}>Item Details</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center', color: '#000000' }}>Qty</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#000000' }}>Unit Price</th>
                        <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#000000' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.6rem' }}>
                            <div style={{ fontWeight: 700, color: '#000000' }}>{item.productName}</div>
                            <div style={{ fontSize: '0.72rem', color: '#000000' }}>{item.sku} • {item.dimensions}</div>
                          </td>
                          <td style={{ padding: '0.6rem', textAlign: 'center', fontWeight: 700, color: '#000000' }}>
                            {item.quantityTons} {item.unitOfMeasure || 'pcs'}
                          </td>
                          <td style={{ padding: '0.6rem', textAlign: 'right', color: '#000000' }}>
                            {formatPHP(item.pricePerTonPHP)}
                          </td>
                          <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: 700, color: '#000000' }}>
                            {formatPHP(item.lineTotalPHP)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Panel: Order Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#000000' }}>Order Summary</h4>

                  <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '1rem', border: '1px solid #E2E8F0', fontSize: '0.88rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#000000' }}>
                      <span>Line Items Count:</span>
                      <strong>{cart.length} item(s) ({totalQuantityUnits} units)</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#000000' }}>
                      <span>Subtotal:</span>
                      <span>{formatPHP(subtotalPHP)}</span>
                    </div>

                    {discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: '#059669' }}>
                        <span>Discount ({discountPercent}%):</span>
                        <span>-{formatPHP(discountAmount)}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', color: withholdingPHP > 0 ? '#DC2626' : '#000000' }}>
                      <span>Tax ({taxLabel}):</span>
                      <span>{withholdingPHP > 0 ? `-${formatPHP(withholdingPHP)}` : formatPHP(taxPHP)}</span>
                    </div>

                    <div style={{ borderTop: '2px solid #CBD5E1', margin: '0.75rem 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: '#000000' }}>Total Amount Due:</span>
                      <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0284C7' }}>{formatPHP(grandTotalPHP)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setIsReviewCartModalOpen(false)}
                    style={{ flex: 1, padding: '0.75rem', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    Back to Edit Cart
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setIsReviewCartModalOpen(false);
                      setIsPaymentModalOpen(true);
                    }}
                    style={{
                      flex: 1.4,
                      padding: '0.75rem',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      background: '#10B981',
                      borderColor: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    <CheckCircle2 size={18} /> Confirm Order
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED POS PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540, borderRadius: 12, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #E2E8F0', padding: '1rem 1.25rem', background: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000000' }}>
                    Tender Payment & Finalize Sale
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: '#000000' }}>
                    Billed to: <strong>{selectedCustomerName === 'Other' ? customCustomerInput || 'Cash Client' : selectedCustomerName}</strong> · {branch} Counter
                  </div>
                </div>
              </div>
              <button
                className="btn-secondary"
                onClick={() => setIsPaymentModalOpen(false)}
                style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                title="Close"
              >
                <X size={18} style={{ color: '#000000' }} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '1.25rem' }}>
              {/* Grand Total Callout */}
              <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 8, padding: '1rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#0369A1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Grand Total Due
                </div>
                <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#0284C7', marginTop: 2 }}>
                  {formatPHP(grandTotalPHP)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#000000', marginTop: 4 }}>
                  {cart.length} item(s) · Subtotal: {formatPHP(subtotalPHP)} {discountAmount > 0 ? `· Discount (${discountPercent}%): -${formatPHP(discountAmount)}` : ''} {taxMode !== 0 ? `· ${taxLabel}: ${withholdingPHP > 0 ? `-${formatPHP(withholdingPHP)}` : formatPHP(taxPHP)}` : ''}
                </div>
              </div>

              {/* Payment Method Selector Dropdown */}
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#000000', marginBottom: '0.4rem' }}>
                Select Payment Method:
              </label>
              <div style={{ marginBottom: '1.25rem' }}>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 8,
                    border: '1.5px solid #CBD5E1',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    color: '#000000',
                    background: '#FFFFFF',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value="Cash">💵 Cash Settlement</option>
                  <option value="Card">💳 Card / QRPH Digital</option>
                  <option value="Bank Transfer">🏦 Bank Transfer</option>
                  <option value="Cheque">📝 Cheque / Post-Dated Cheque (PDC)</option>
                  <option value="Corporate Credit Line">🏢 Corporate Credit Line (A/R Terms)</option>
                  <option value="Split Payment">✂️ Split Payment (Multi-Tender)</option>
                </select>
              </div>

              {/* Method-Specific Inputs */}
              {paymentMethod === 'Cash' && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#000000' }}>Amount Tendered (₱):</label>
                    <input
                      type="number"
                      step="1"
                      min={0}
                      value={amountTendered || ''}
                      onChange={(e) => setAmountTendered(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      style={{ width: '150px', textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', padding: '0.4rem', borderRadius: 6, border: '1.5px solid #CBD5E1', background: '#FFFFFF', color: '#000000' }}
                      autoFocus
                    />
                  </div>

                  {/* Quick cash denomination buttons */}
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setAmountTendered(grandTotalPHP)}
                    >
                      Exact ({formatPHP(grandTotalPHP)})
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setAmountTendered((prev) => prev + 500)}
                    >
                      +₱500.00
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setAmountTendered((prev) => prev + 1000)}
                    >
                      +₱1,000.00
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.6rem', borderTop: '1px solid #E2E8F0', fontSize: '0.95rem' }}>
                    <span style={{ color: '#000000', fontWeight: 600 }}>Change Returned:</span>
                    <strong style={{ fontSize: '1.15rem', color: amountTendered >= grandTotalPHP ? '#059669' : '#DC2626' }}>
                      {formatPHP(changeDuePHP)}
                    </strong>
                  </div>
                  {amountTendered < grandTotalPHP && (
                    <div style={{ color: '#DC2626', fontSize: '0.75rem', marginTop: 4, textAlign: 'right' }}>
                      Insufficient cash tendered: Needs {formatPHP(grandTotalPHP - amountTendered)} more
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'Card' && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#000000', marginBottom: '0.4rem' }}>
                    Card / QRPH Terminal Reference Number: <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. POS-AUTH-98214 / QRPH-REF-5501"
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF', color: '#000000' }}
                    autoFocus
                  />
                  <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: 4 }}>
                    Enter terminal slip approval code or electronic gateway transaction ID.
                  </div>
                </div>
              )}

              {paymentMethod === 'Bank Transfer' && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#000000', marginBottom: '0.4rem' }}>
                    Bank Reference / Online Transaction ID: <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. BDO-TRX-8829410"
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF', color: '#000000' }}
                    autoFocus
                  />
                  <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: 4 }}>
                    Enter client's online banking confirmation or deposit slip reference number.
                  </div>
                </div>
              )}

              {paymentMethod === 'Cheque' && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#000000', marginBottom: '0.4rem' }}>
                    Cheque # & Drawee Bank: <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. CHQ-991204 (Metrobank Davao)"
                    required
                    style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF', color: '#000000' }}
                    autoFocus
                  />
                  <div style={{ fontSize: '0.72rem', color: '#000000', marginTop: 4 }}>
                    Automatically tracked in the Cheque & PDC Management register as Pending clearing.
                  </div>
                </div>
              )}

              {paymentMethod === 'Corporate Credit Line' && (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1E40AF', marginBottom: 4 }}>
                    Charge to Corporate Accounts Receivable
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#1E3A8A', lineHeight: 1.5 }}>
                    This transaction will post an official invoice to <strong>{selectedCustomerName === 'Other' ? customCustomerInput || 'Corporate Client' : selectedCustomerName}</strong>'s credit ledger under Standard Net 30-Day terms.
                  </div>
                </div>
              )}

              {paymentMethod === 'Split Payment' && (
                <div style={{ background: '#F8FAFC', border: '1.5px solid #CBD5E1', borderRadius: 8, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#000000' }}>Split Payment Tenders</div>
                      <div style={{ fontSize: '0.75rem', color: '#000000' }}>Divide transaction across two or more payment methods</div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      onClick={() => setSplitTenders((prev) => [
                        ...prev,
                        { id: String(Date.now()), method: 'Bank Transfer', amount: 0, referenceNumber: '' }
                      ])}
                    >
                      <Plus size={13} /> Add Tender
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
                    {splitTenders.map((tender) => (
                      <div key={tender.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr auto', gap: '0.5rem', alignItems: 'center', background: '#FFFFFF', padding: '0.55rem', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                        <select
                          value={tender.method}
                          onChange={(e) => {
                            const newMethod = e.target.value as any;
                            setSplitTenders((prev) => prev.map((t) => t.id === tender.id ? { ...t, method: newMethod } : t));
                          }}
                          style={{ padding: '0.45rem', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: '0.8rem', background: '#FFFFFF', color: '#000000', fontWeight: 600 }}
                        >
                          <option value="Cash">💵 Cash</option>
                          <option value="Card">💳 Card/QRPH</option>
                          <option value="Bank Transfer">🏦 Bank</option>
                          <option value="Cheque">📝 Cheque</option>
                          <option value="Corporate Credit Line">🏢 Credit Line</option>
                        </select>

                        <div>
                          <input
                            type="number"
                            min={0}
                            step="1"
                            placeholder="Amount (₱)"
                            value={tender.amount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setSplitTenders((prev) => prev.map((t) => t.id === tender.id ? { ...t, amount: val } : t));
                            }}
                            style={{ width: '100%', padding: '0.45rem', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, background: '#FFFFFF', color: '#000000' }}
                          />
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder={tender.method === 'Cash' ? 'Cash Tender' : 'Ref / Cheque #'}
                            value={tender.referenceNumber}
                            disabled={tender.method === 'Cash'}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSplitTenders((prev) => prev.map((t) => t.id === tender.id ? { ...t, referenceNumber: val } : t));
                            }}
                            style={{ width: '100%', padding: '0.45rem', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: '0.8rem', background: tender.method === 'Cash' ? '#F1F5F9' : '#FFFFFF', color: '#000000' }}
                          />
                        </div>

                        {splitTenders.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setSplitTenders((prev) => prev.filter((t) => t.id !== tender.id))}
                            style={{ background: 'transparent', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '0.3rem' }}
                            title="Remove tender"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Split Summary Callout */}
                  <div style={{ background: '#F1F5F9', padding: '0.75rem', borderRadius: 6, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#000000', display: 'block' }}>Total Allocated:</span>
                      <strong style={{ fontSize: '0.95rem', color: '#0284C7' }}>{formatPHP(totalSplitAllocated)}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#000000', display: 'block' }}>Remaining Due:</span>
                      <strong style={{ fontSize: '0.95rem', color: splitRemainingDue > 0 ? '#DC2626' : '#059669' }}>
                        {formatPHP(splitRemainingDue)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#000000', display: 'block' }}>Cash Change:</span>
                      <strong style={{ fontSize: '0.95rem', color: '#059669' }}>{formatPHP(splitChangeDue)}</strong>
                    </div>
                  </div>

                  {splitRemainingDue > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        onClick={() => {
                          setSplitTenders((prev) => {
                            if (prev.length === 0) return prev;
                            const lastIdx = prev.length - 1;
                            return prev.map((t, i) => i === lastIdx ? { ...t, amount: Number((t.amount + splitRemainingDue).toFixed(2)) } : t);
                          });
                        }}
                      >
                        Auto-fill Remaining ({formatPHP(splitRemainingDue)}) to Last Tender
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #E2E8F0', padding: '0.85rem 1.25rem', background: '#F8FAFC', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsPaymentModalOpen(false)}
                style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
              >
                Back to Cart
              </button>
              <button
                type="button"
                disabled={
                  isProcessingSale ||
                  (paymentMethod === 'Cash' && amountTendered < grandTotalPHP && grandTotalPHP > 0) ||
                  ((paymentMethod === 'Bank Transfer' || paymentMethod === 'Cheque' || paymentMethod === 'Card') && !referenceNumber.trim()) ||
                  (paymentMethod === 'Split Payment' && totalSplitAllocated < grandTotalPHP)
                }
                onClick={handleExecuteSale}
                style={{
                  background: isProcessingSale ? '#94A3B8' : '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '0.6rem 1.25rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: isProcessingSale ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {isProcessingSale ? (
                  <>
                    <RotateCcw size={15} className="spin" /> Processing Sale…
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} /> Confirm & Issue Receipt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS RECEIPT / OFFICIAL INVOICE MODAL */}
      {activeReceipt && (
        <div className="pos-modal-overlay">
          <div className="receipt-card">
            <div className="receipt-header">
              <div className="brand-title">STEELTRACK ENTERPRISE</div>
              <div className="branch-meta">
                <Building size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {activeReceipt.branch} Branch Facility • POS Terminal
              </div>
              <div className="invoice-meta">Official Invoice #{activeReceipt.invoiceNumber}</div>
              <div className="invoice-meta">
                Date: {new Date(activeReceipt.createdAt).toLocaleString()} • Cashier: {activeReceipt.cashierName}
              </div>
              <div className="invoice-meta">
                Client: <strong>{activeReceipt.customerName}</strong>
                {activeReceipt.customerTin && ` (TIN: ${activeReceipt.customerTin})`}
              </div>
            </div>

            <div className="receipt-items-table">
              <table>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Batch #</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activeReceipt.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <strong>{it.productName || it.grade}</strong>
                        <div style={{ fontSize: '0.7rem', color: '#000000' }}>{it.sku || it.dimensions}</div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{it.batchCode || it.heatNumber}</td>
                      <td style={{ textAlign: 'right' }}>{it.quantityTons} {it.unitOfMeasure || 'pcs'}</td>
                      <td style={{ textAlign: 'right' }}>{formatPHP(it.pricePerTonPHP)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPHP(it.lineTotalPHP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="receipt-totals-box">
              <div className="total-line">
                <span>Subtotal Amount:</span>
                <span>{formatPHP(activeReceipt.subtotalPHP)}</span>
              </div>
              {activeReceipt.discountPHP > 0 && (
                <div className="total-line discount">
                  <span>Discount{activeReceipt.discountPercent ? ` (${activeReceipt.discountPercent}%)` : ''}:</span>
                  <span>-{formatPHP(activeReceipt.discountPHP)}</span>
                </div>
              )}
              <div className="total-line">
                <span>Tax ({activeReceipt.taxTypeLabel || 'VAT 12%'}):</span>
                <span>
                  {activeReceipt.withholdingPHP && activeReceipt.withholdingPHP > 0
                    ? `-${formatPHP(activeReceipt.withholdingPHP)}`
                    : formatPHP(activeReceipt.taxPHP)}
                </span>
              </div>
              <div className="total-line grand">
                <span>Grand Total:</span>
                <span>{formatPHP(activeReceipt.totalAmountPHP)}</span>
              </div>
              <div className="total-line">
                <span>Payment Method:</span>
                <span>{activeReceipt.paymentMethod}</span>
              </div>
              {activeReceipt.splitTenders && activeReceipt.splitTenders.length > 0 && (
                <div style={{ margin: '0.4rem 0', padding: '0.4rem 0.6rem', background: '#F1F5F9', borderRadius: 4, fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 700, color: '#000000', marginBottom: 2 }}>Split Tender Breakdown:</div>
                  {activeReceipt.splitTenders.map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
                      <span>• {t.method} {t.referenceNumber ? `(${t.referenceNumber})` : ''}:</span>
                      <strong>{formatPHP(t.amount)}</strong>
                    </div>
                  ))}
                </div>
              )}
              {activeReceipt.paymentMethod === 'Cash' && activeReceipt.amountTenderedPHP !== undefined && (
                <>
                  <div className="total-line">
                    <span>Cash Tendered:</span>
                    <span>{formatPHP(activeReceipt.amountTenderedPHP)}</span>
                  </div>
                  <div className="total-line">
                    <span>Change Returned:</span>
                    <span>{formatPHP(activeReceipt.changeDuePHP || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="receipt-footer">
              <p>Certified Official Sales Invoice • BIR Compliant</p>
              <p>Thank you for choosing SteelTrack Industrial Solutions.</p>
            </div>

            <div className="receipt-actions no-print" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-print"
                onClick={() => printReceiptPdf(activeReceipt)}
                style={{ background: '#0284C7', color: '#FFFFFF', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                title="Download or print thermal official invoice PDF"
              >
                <Download size={16} /> Download PDF Receipt
              </button>
              <button
                type="button"
                className="btn-print"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Print Direct
              </button>
              <button
                type="button"
                className="btn-close"
                onClick={() => setActiveReceipt(null)}
              >
                <CheckCircle2 size={16} /> Complete & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS TRANSACTION ERROR MODAL */}
      {transactionError && (
        <div className="pos-modal-overlay">
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              maxWidth: '460px',
              width: '90%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #FECACA',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', color: '#DC2626' }}>
              <div style={{ background: '#FEE2E2', padding: '0.5rem', borderRadius: '50%' }}>
                <AlertTriangle size={24} color="#DC2626" />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#000000' }}>
                Transaction Not Completed
              </h3>
            </div>

            <div
              style={{
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                fontSize: '0.88rem',
                lineHeight: 1.45,
                marginBottom: '1rem',
              }}
            >
              {transactionError.message}
            </div>

            {transactionError.details && (
              <p style={{ fontSize: '0.8rem', color: '#000000', lineHeight: 1.4, margin: '0 0 1.25rem 0' }}>
                <CheckCircle2 size={13} style={{ display: 'inline', color: '#059669', marginRight: 4 }} />
                {transactionError.details}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setTransactionError(null)}
                style={{ background: '#0F172A', borderColor: '#000000', padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}
              >
                Review Cart & Try Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
