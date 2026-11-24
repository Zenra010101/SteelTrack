import { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  TrendingUp,
  ShoppingCart,
  Receipt,
  ArrowRightLeft,
  ClipboardCheck,
  Package,
  DollarSign,
  Boxes,
  Zap,
  CheckCircle2,
  ChevronRight,
  Layers,
  Sparkles,
  Calendar,
  PieChart,
} from 'lucide-react';
import { UserRole, BranchLocation, type UserSession } from '../types/auth';
import type { BranchProductItem } from '../types/steel';
import type { PosTransaction } from '../types/pos';
import {
  fetchBranchProducts,
  fetchTransfers,
  fetchApprovals,
  fetchPosTransactions,
  fetchReceivableStats,
} from '../services/api';
import { TableExportButtons } from './TableExportButtons';
import { formatPHP } from '../utils/currency';

export type RevenueTimeframe = 'Daily' | 'Monthly' | 'Trimester' | 'Semester' | 'Yearly';

interface DashboardViewProps {
  userSession: UserSession;
  selectedBranch: string;
  onSelectTab: (tabId: string) => void;
  onSelectBranch: (branch: string) => void;
}

export function isDateInTimeframe(dateStr: string, timeframe: RevenueTimeframe): boolean {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return true;
  const now = new Date();

  switch (timeframe) {
    case 'Daily': {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return date >= startOfDay;
    }
    case 'Monthly': {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return date >= startOfMonth;
    }
    case 'Trimester': {
      // Exactly 3 months threshold
      const startOfTrimester = new Date(now);
      startOfTrimester.setMonth(startOfTrimester.getMonth() - 3);
      startOfTrimester.setHours(0, 0, 0, 0);
      return date >= startOfTrimester;
    }
    case 'Semester': {
      // Exactly 6 months threshold
      const startOfSemester = new Date(now);
      startOfSemester.setMonth(startOfSemester.getMonth() - 6);
      startOfSemester.setHours(0, 0, 0, 0);
      return date >= startOfSemester;
    }
    case 'Yearly': {
      // Exactly 12 months threshold
      const startOfYearly = new Date(now);
      startOfYearly.setMonth(startOfYearly.getMonth() - 12);
      startOfYearly.setHours(0, 0, 0, 0);
      return date >= startOfYearly;
    }
    default:
      return true;
  }
}

export function DashboardView({
  userSession,
  selectedBranch,
  onSelectTab,
  onSelectBranch,
}: DashboardViewProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [branchProducts, setBranchProducts] = useState<BranchProductItem[]>([]);
  const [transfersCount, setTransfersCount] = useState<number>(0);
  const [approvalsCount, setApprovalsCount] = useState<number>(0);
  const [allSales, setAllSales] = useState<PosTransaction[]>([]);
  const [globalSales, setGlobalSales] = useState<PosTransaction[]>([]);
  const [receivablesTotal, setReceivablesTotal] = useState<number>(0);
  const [timeframe, setTimeframe] = useState<RevenueTimeframe>('Monthly');

  // Branch Manager can ONLY view their assigned branch; Owner can view All or scoped branch
  const effectiveBranch =
    userSession.role === UserRole.Owner
      ? selectedBranch === 'All'
        ? undefined
        : selectedBranch
      : userSession.branch;

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardMetrics() {
      setLoading(true);
      try {
        const [prodResult, trList, appList, posResult, recStats, globalPosResult] = await Promise.all([
          fetchBranchProducts(undefined, undefined, undefined, false, effectiveBranch),
          fetchTransfers(effectiveBranch),
          fetchApprovals(undefined, effectiveBranch),
          fetchPosTransactions(effectiveBranch),
          fetchReceivableStats(effectiveBranch),
          userSession.role === UserRole.Owner && effectiveBranch !== undefined
            ? fetchPosTransactions(undefined)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setBranchProducts(prodResult.data || []);
        setTransfersCount(trList.filter((t) => t.status === 'Pending' || t.status === 'InTransit').length);
        setApprovalsCount(appList.filter((a) => a.status === 'Pending').length);
        setAllSales(posResult || []);
        if (userSession.role === UserRole.Owner) {
          setGlobalSales(globalPosResult !== null ? (globalPosResult || []) : (posResult || []));
        }

        if (recStats) {
          setReceivablesTotal(recStats.totalReceivablesPHP || 0);
        }
      } catch (err) {
        console.error('Failed loading dashboard metrics:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboardMetrics();
    return () => {
      cancelled = true;
    };
  }, [effectiveBranch, userSession]);

  // Filter sales dynamically by selected timeframe
  const timeframeSales = useMemo(() => {
    return allSales.filter((s) => isDateInTimeframe(s.createdAt, timeframe));
  }, [allSales, timeframe]);

  const salesRevenueTotal = useMemo(() => {
    return timeframeSales.reduce((sum, s) => sum + (s.totalAmountPHP || s.totalAmountUSD || 0), 0);
  }, [timeframeSales]);

  const salesCount = timeframeSales.length;

  // Enterprise-wide sales for Owner branch breakdown (always global across all 4 branches regardless of sidebar filter)
  const enterpriseTimeframeSales = useMemo(() => {
    const list = userSession.role === UserRole.Owner && globalSales.length > 0 ? globalSales : allSales;
    return list.filter((s) => isDateInTimeframe(s.createdAt, timeframe));
  }, [userSession.role, globalSales, allSales, timeframe]);

  const enterpriseSalesRevenueTotal = useMemo(() => {
    return enterpriseTimeframeSales.reduce((sum, s) => sum + (s.totalAmountPHP || s.totalAmountUSD || 0), 0);
  }, [enterpriseTimeframeSales]);

  const enterpriseSalesCount = enterpriseTimeframeSales.length;

  const totalStockTons = branchProducts
    .reduce((acc, p) => acc + Number(p.weightInTons ?? Number(p.stockQuantity ?? 0) * 0.1), 0)
    .toFixed(1);

  const totalCatalogItems = branchProducts.length;
  const availableStockCount = branchProducts.filter(
    (p) => p.isAvailable !== false && (p.currentStock ?? p.stockQuantity ?? 0) > 0
  ).length;

  // Refined stock categorizations:
  // - Very Low Stock: Stock < 10 (strict critical threshold)
  // - Low Stock: Stock between 10 and 20 (minimum stock up to count 20)
  const veryLowStockItems = branchProducts.filter((p) => {
    const qty = p.currentStock ?? p.stockQuantity ?? 0;
    return qty > 0 && qty < 10;
  });

  const lowStockItems = branchProducts.filter((p) => {
    const qty = p.currentStock ?? p.stockQuantity ?? 0;
    return qty >= 10 && qty <= 20;
  });

  // Owner Breakdown: revenue & volume disseminated across all 4 official branches (always global)
  const branchBreakdownData = useMemo(() => {
    const branches = [
      BranchLocation.Davao,
      BranchLocation.Cagayan,
      BranchLocation.Cebu,
      BranchLocation.Mandaue,
    ];

    return branches.map((loc) => {
      const bSales = enterpriseTimeframeSales.filter((s) => {
        const bName = (s.branch || '').toLowerCase();
        const lName = loc.toLowerCase();
        return bName.includes(lName) || lName.includes(bName);
      });

      const rev = bSales.reduce((sum, s) => sum + (s.totalAmountPHP || s.totalAmountUSD || 0), 0);
      const count = bSales.length;
      const share = enterpriseSalesRevenueTotal > 0 ? (rev / enterpriseSalesRevenueTotal) * 100 : 0;
      const avgTicket = count > 0 ? rev / count : 0;

      return {
        branch: loc,
        revenue: rev,
        count,
        share,
        avgTicket,
      };
    });
  }, [enterpriseTimeframeSales, enterpriseSalesRevenueTotal]);

  // Branch Manager Breakdown: revenue breakdown by payment method for their assigned branch
  const branchPaymentBreakdown = useMemo(() => {
    const methods: PosTransaction['paymentMethod'][] = [
      'Cash',
      'Card',
      'Bank Transfer',
      'Split Payment',
      'Corporate Credit Line',
      'Cheque',
    ];

    return methods.map((m) => {
      const matching = timeframeSales.filter((s) => s.paymentMethod === m);
      const rev = matching.reduce((sum, s) => sum + (s.totalAmountPHP || s.totalAmountUSD || 0), 0);
      const count = matching.length;
      const share = salesRevenueTotal > 0 ? (rev / salesRevenueTotal) * 100 : 0;
      return {
        method: m,
        revenue: rev,
        count,
        share,
      };
    }).filter((x) => x.count > 0 || x.revenue > 0);
  }, [timeframeSales, salesRevenueTotal]);

  return (
    <div className="dashboard-container" style={{ background: '#F4F6F9', padding: '1.5rem', borderRadius: 12, border: '1px solid #E2E8F0', minHeight: '100%' }}>
      {/* TOP WELCOME BANNER */}
      {userSession.role === UserRole.BranchManager ? (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            borderRadius: 12,
            padding: '1.75rem 2rem',
            color: '#000000',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: '1.25rem',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#000000' }}>
              Welcome, {userSession.name}
            </h1>

            <p style={{ margin: '0.4rem 0 0 0', color: '#000000', fontSize: '0.9rem' }}>
              Full operational supervision for {userSession.branch} Branch facility, quality approvals & local inventory.
            </p>
          </div>

          {/* Centered Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={() => onSelectTab('approvals')}
              style={{
                padding: '0.65rem 1.35rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <ClipboardCheck size={16} /> Quality Approvals ({approvalsCount})
            </button>
            <button
              className="btn-secondary"
              onClick={() => onSelectTab('inventory')}
              style={{
                padding: '0.65rem 1.35rem',
                fontSize: '0.88rem',
                fontWeight: 600,
                background: '#F8FAFC',
                color: '#000000',
                borderColor: '#CBD5E1',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <Layers size={16} /> Branch Products
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            borderRadius: 12,
            padding: '1.5rem 1.75rem',
            color: '#000000',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#000000' }}>
              Welcome, {userSession.name}
            </h1>

            <p style={{ margin: '0.35rem 0 0 0', color: '#000000', fontSize: '0.85rem' }}>
              {userSession.role === UserRole.Owner &&
                'Executive enterprise scope active across all 4 operational branch facilities.'}
              {userSession.role === UserRole.Cashier &&
                `${userSession.branch} Branch POS Counter Terminal active. Fast cashier transactions & BIR receipt issuing.`}
            </p>
          </div>

          {/* Quick Launch CTA based on Role */}
          <div>
            {userSession.role === UserRole.Cashier && (
              <button
                className="btn-primary"
                onClick={() => onSelectTab('pos')}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  background: '#10B981',
                  borderColor: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.4)',
                }}
              >
                <ShoppingCart size={18} /> Launch POS Terminal
              </button>
            )}

            {userSession.role === UserRole.Owner && (
              <div
                style={{
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'center',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 6,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  fontSize: '0.8rem',
                }}
                title="Branch scope is managed globally via the sidebar"
              >
                <span style={{ color: '#000000', fontWeight: 600 }}>Active Scope:</span>
                <strong style={{ color: '#000000' }}>
                  {selectedBranch === 'All' ? 'All 4 Branches Combined' : `${selectedBranch} Branch`}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TIMEFRAME SORTING / FILTER CONTROLS */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: '#FFFFFF',
          padding: '0.85rem 1.25rem',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          marginBottom: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} color="#0284C7" />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#000000' }}>
            Revenue & Sales Timeframe:
          </span>
          <span style={{ fontSize: '0.8rem', color: '#000000' }}>
            ({timeframe === 'Daily' ? 'Today 00:00 to now' : timeframe === 'Monthly' ? 'Current Month' : timeframe === 'Trimester' ? 'Past 3 Months' : timeframe === 'Semester' ? 'Past 6 Months' : 'Past 12 Months'})
          </span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            background: '#F1F5F9',
            padding: '0.25rem',
            borderRadius: '8px',
            gap: '0.25rem',
          }}
        >
          {(['Daily', 'Monthly', 'Trimester', 'Semester', 'Yearly'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              style={{
                border: 'none',
                background: timeframe === tf ? '#0284C7' : 'transparent',
                color: timeframe === tf ? '#FFFFFF' : '#475569',
                padding: '0.35rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: timeframe === tf ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: timeframe === tf ? '0 2px 4px rgba(2, 132, 199, 0.25)' : 'none',
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* METRIC KPI TILES */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Metric 1 */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {userSession.role === UserRole.Cashier
                  ? `Counter Sales (${timeframe})`
                  : userSession.role === UserRole.BranchManager
                  ? `${userSession.branch} Revenue (${timeframe})`
                  : `Total Revenue (${timeframe})`}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#000000', marginTop: 4 }}>
                {formatPHP(salesRevenueTotal)}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: 8, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <TrendingUp size={13} /> {salesCount} transaction(s) recorded in {timeframe.toLowerCase()} scope
          </div>
        </div>

        {/* Metric 2 */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                On-Hand Steel Tonnage
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0284C7', marginTop: 4 }}>
                {loading ? '…' : `${totalStockTons} T`}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#000000', marginTop: 8, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span>{availableStockCount} specifications</span>
            {veryLowStockItems.length > 0 && (
              <span style={{ color: '#DC2626', fontWeight: 700, background: '#FEF2F2', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
                {veryLowStockItems.length} Very Low (&lt;10)
              </span>
            )}
            {lowStockItems.length > 0 && (
              <span style={{ color: '#D97706', fontWeight: 600, background: '#FEF3C7', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
                {lowStockItems.length} Low (10–20)
              </span>
            )}
          </div>
        </div>

        {/* Metric 3 */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {userSession.role === UserRole.Cashier ? 'Branch Items Ready' : 'Quality & Approvals'}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: approvalsCount > 0 ? '#D97706' : '#0F172A', marginTop: 4 }}>
                {userSession.role === UserRole.Cashier ? totalCatalogItems : approvalsCount}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {userSession.role === UserRole.Cashier ? <Boxes size={20} /> : <ClipboardCheck size={20} />}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: approvalsCount > 0 ? '#D97706' : '#64748B', marginTop: 8 }}>
            {userSession.role === UserRole.Cashier
              ? 'FIFO prioritized & ready to ring up'
              : approvalsCount > 0
                ? 'Pending manager review & approval'
                : 'All quality checks up-to-date'}
          </div>
        </div>

        {/* Metric 4 */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {userSession.role === UserRole.Cashier ? 'Active Stock Transfers' : 'Inter-Branch Transfers'}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#000000', marginTop: 4 }}>
                {transfersCount}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRightLeft size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#000000', marginTop: 8 }}>
            Active logistics in transit / pending
          </div>
        </div>
      </div>

      {/* ROLE SPECIFIC SECTIONS */}
      {/* 1. CASHIER WORKSPACE */}
      {userSession.role === UserRole.Cashier && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Quick Counter Action Card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000000' }}>
                Cashier Point of Sale Terminal
              </h3>
            </div>
            <p style={{ color: '#000000', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Fast multi-item barcode lookup, automated FIFO stock allocation, multiple payment methods (Cash, Transfer, Cheque, Credit Line), and official BIR thermal receipt issuing.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-primary"
                onClick={() => onSelectTab('pos')}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ShoppingCart size={16} /> Open POS Terminal
              </button>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('sales-history')}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Receipt size={16} /> Sales & Receipts
              </button>
            </div>
          </div>

          {/* FIFO Policy Guide */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000000' }}>
                Automated FIFO Inventory Active
              </h3>
            </div>
            <p style={{ color: '#000000', fontSize: '0.82rem', lineHeight: 1.5 }}>
              First-In, First-Out (FIFO) ensures older inventory batches received at the counter are sold first before newer stock with updated pricing is accessed.
            </p>
            <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: '0.78rem', color: '#000000' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#15803D', marginBottom: 2 }}>
                <CheckCircle2 size={13} /> Automatic Batch Depletion
              </div>
              Old products with earlier received dates are auto-selected when adding items to order.
            </div>
          </div>
        </div>
      )}

      {/* 2. BRANCH MANAGER WORKSPACE */}
      {userSession.role === UserRole.BranchManager && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Quality & Batch Approvals Card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardCheck size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000000' }}>
                  Quality Control Sign-Off
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: approvalsCount > 0 ? '#FEF3C7' : '#DCFCE7', color: approvalsCount > 0 ? '#B45309' : '#15803D', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                {approvalsCount} Pending
              </span>
            </div>
            <p style={{ color: '#000000', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Inspect and authorize incoming steel batches, mill test certificates (MTC), and physical tonnage adjustments for {userSession.branch} Branch.
            </p>
            <button
              className="btn-primary"
              onClick={() => onSelectTab('approvals')}
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ClipboardCheck size={15} /> Review Pending Batches
            </button>
          </div>

          {/* Cross-Branch Visibility Card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000000' }}>
                Inter-Branch Stock Transfers
              </h3>
            </div>
            <p style={{ color: '#000000', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Query real-time stock balances across all 4 branch depots (Davao, Cagayan, Cebu, Mandaue) and request inventory replenishment with 1 click.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('inventory')}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Layers size={15} /> Check Branch Stock
              </button>
              <button
                className="btn-primary"
                onClick={() => onSelectTab('transfers')}
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ArrowRightLeft size={15} /> Stock Transfers
              </button>
            </div>
          </div>

          {/* Branch Manager Scoped Revenue & Tender Breakdown Card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingUp size={18} style={{ color: '#059669' }} />
                  {userSession.branch} Branch Revenue Breakdown ({timeframe})
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#000000', fontSize: '0.8rem' }}>
                  Audited financial settlement and tender channel metrics strictly scoped to {userSession.branch} Branch.
                </p>
              </div>

              <TableExportButtons
                filename={`${userSession.branch}_Revenue_${timeframe}`}
                title={`${userSession.branch} Branch Revenue Breakdown (${timeframe})`}
                subtitle={`Total Period Revenue: ${formatPHP(salesRevenueTotal)} across ${salesCount} transaction(s)`}
                headers={['Payment Tender Channel', 'Transaction Count', 'Revenue Total (PHP)', 'Share of Period Revenue']}
                rows={branchPaymentBreakdown.map((b) => [
                  b.method,
                  b.count,
                  formatPHP(b.revenue),
                  `${b.share.toFixed(1)}%`,
                ])}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.78rem', color: '#000000', fontWeight: 600, textTransform: 'uppercase' }}>
                  Branch Period Total
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#000000', marginTop: 4 }}>
                  {formatPHP(salesRevenueTotal)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: 4, fontWeight: 600 }}>
                  {salesCount} Total Orders • Avg Order: {formatPHP(salesCount > 0 ? salesRevenueTotal / salesCount : 0)}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.78rem', color: '#000000', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Tender Channel Dissemination
                </div>
                {branchPaymentBreakdown.length === 0 ? (
                  <div style={{ color: '#000000', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                    No settled sales transactions recorded in this {timeframe.toLowerCase()} window.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {branchPaymentBreakdown.map((t) => (
                      <div key={t.method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <span style={{ fontWeight: 600, color: '#000000' }}>{t.method} ({t.count}):</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: '#000000' }}>{formatPHP(t.revenue)}</span>
                          <span style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#000000', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
                            {t.share.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. OWNER EXECUTIVE WORKSPACE */}
      {userSession.role === UserRole.Owner && (
        <>
          {/* Owner Branch Revenue Dissemination Table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#000000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PieChart size={20} style={{ color: '#0284C7' }} />
                  Enterprise Revenue Breakdown per Branch ({timeframe})
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', color: '#000000', fontSize: '0.82rem' }}>
                  Comprehensive cross-branch revenue dissemination across all 4 regional hubs. Filter scope above or drill into any branch.
                </p>
              </div>

              <TableExportButtons
                filename={`AllBranches_Revenue_Breakdown_${timeframe}`}
                title={`Enterprise Revenue Breakdown per Branch (${timeframe})`}
                subtitle={`Overall Combined Revenue: ${formatPHP(enterpriseSalesRevenueTotal)} across ${enterpriseSalesCount} transaction(s)`}
                headers={['Branch Facility', 'Revenue Total (PHP)', 'Share of Revenue (%)', 'Transaction Count', 'Avg Ticket (PHP)']}
                rows={branchBreakdownData.map((b) => [
                  `${b.branch} Branch`,
                  formatPHP(b.revenue),
                  `${b.share.toFixed(1)}%`,
                  b.count,
                  formatPHP(b.avgTicket),
                ])}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem', color: '#000000', fontWeight: 700 }}>Branch Facility</th>
                    <th style={{ textAlign: 'right', padding: '0.65rem 0.85rem', color: '#000000', fontWeight: 700 }}>Revenue (PHP)</th>
                    <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem', color: '#000000', fontWeight: 700, minWidth: '150px' }}>Share of Revenue</th>
                    <th style={{ textAlign: 'center', padding: '0.65rem 0.85rem', color: '#000000', fontWeight: 700 }}>Transactions</th>
                    <th style={{ textAlign: 'right', padding: '0.65rem 0.85rem', color: '#000000', fontWeight: 700 }}>Avg Ticket</th>
                    <th style={{ textAlign: 'center', padding: '0.65rem 0.85rem', color: '#000000', fontWeight: 700 }}>Scope View</th>
                  </tr>
                </thead>
                <tbody>
                  {branchBreakdownData.map((b) => {
                    const isSelected = selectedBranch === b.branch;
                    return (
                      <tr
                        key={b.branch}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: isSelected ? '#F0F9FF' : '#FFFFFF',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 700, color: '#000000' }}>{b.branch} Branch</span>
                            {isSelected && (
                              <span style={{ fontSize: '0.7rem', background: '#0284C7', color: '#FFFFFF', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                                Active Scope
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.75rem 0.85rem', fontWeight: 700, color: '#000000', fontFamily: 'Outfit, sans-serif' }}>
                          {formatPHP(b.revenue)}
                        </td>
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, background: '#E2E8F0', height: 7, borderRadius: 4, overflow: 'hidden' }}>
                              <div
                                style={{
                                  background: b.branch === BranchLocation.Davao ? '#0284C7' : b.branch === BranchLocation.Cagayan ? '#10B981' : b.branch === BranchLocation.Cebu ? '#F59E0B' : '#8B5CF6',
                                  width: `${Math.min(100, b.share)}%`,
                                  height: '100%',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#000000', minWidth: '40px' }}>
                              {b.share.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.75rem 0.85rem', fontWeight: 600, color: '#000000' }}>
                          {b.count}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.75rem 0.85rem', color: '#000000' }}>
                          {formatPHP(b.avgTicket)}
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.75rem 0.85rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => onSelectBranch(isSelected ? 'All' : b.branch)}
                            style={{
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: isSelected ? '#0284C7' : '#FFFFFF',
                              color: isSelected ? '#FFFFFF' : '#334155',
                              borderColor: isSelected ? '#0284C7' : '#CBD5E1',
                            }}
                          >
                            {isSelected ? 'View All' : 'Filter Scope'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* Branch Facilities Network Matrix */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000000', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Building2 size={18} style={{ color: '#0284C7' }} />
                Regional Facility Performance
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#000000' }}>Live Database Replication Active</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {[
                { name: 'Davao Branch', code: BranchLocation.Davao, region: 'Mindanao Central', live: true },
                { name: 'Cagayan De Oro Branch', code: BranchLocation.Cagayan, region: 'Northern Mindanao', live: true },
                { name: 'Cebu Branch', code: BranchLocation.Cebu, region: 'Central Visayas', live: true },
                { name: 'Mandaue Branch', code: BranchLocation.Mandaue, region: 'Metro Cebu Industrial', live: true },
              ].map((f) => (
                <div
                  key={f.code}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 10,
                    padding: '1.15rem',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onClick={() => {
                    onSelectBranch(f.code);
                    onSelectTab('inventory');
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#000000' }}>{f.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#000000' }}>{f.region}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#ECFDF5', color: '#059669', padding: '0.15rem 0.45rem', borderRadius: 4 }}>
                      ● Online
                    </span>
                  </div>

                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#0284C7', fontWeight: 600 }}>Supervise Inventory</span>
                    <ChevronRight size={14} style={{ color: '#000000' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Quick Actions */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#000000', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Executive Tools & Operations
              </h4>
              {receivablesTotal > 0 && (
                <span style={{ fontSize: '0.78rem', color: '#000000' }}>
                  Total Receivables: <strong style={{ color: '#000000' }}>{formatPHP(receivablesTotal)}</strong>
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('forecast')}
                style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', justifyContent: 'flex-start' }}
              >
                <Sparkles size={16} style={{ color: '#0284C7' }} /> Demand Forecasting
              </button>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('analytics')}
                style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', justifyContent: 'flex-start' }}
              >
                <TrendingUp size={16} style={{ color: '#059669' }} /> Cross-Branch Analytics
              </button>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('products')}
                style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', justifyContent: 'flex-start' }}
              >
                <Package size={16} style={{ color: '#D97706' }} /> Products Catalog
              </button>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('receivables')}
                style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', justifyContent: 'flex-start' }}
              >
                <DollarSign size={16} style={{ color: '#7C3AED' }} /> Accounts Receivable
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardView;
