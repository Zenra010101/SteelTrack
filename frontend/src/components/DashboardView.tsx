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
        const [prodResult, trList, appList, posResult, recStats] = await Promise.all([
          fetchBranchProducts(undefined, undefined, undefined, false, effectiveBranch),
          fetchTransfers(effectiveBranch),
          fetchApprovals(undefined, effectiveBranch),
          fetchPosTransactions(effectiveBranch),
          fetchReceivableStats(effectiveBranch),
        ]);

        if (cancelled) return;

        setBranchProducts(prodResult.data || []);
        setTransfersCount(trList.filter((t) => t.status === 'Pending' || t.status === 'InTransit').length);
        setApprovalsCount(appList.filter((a) => a.status === 'Pending').length);
        setAllSales(posResult || []);

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

  // Owner Breakdown: revenue & volume disseminated across all 4 official branches
  const branchBreakdownData = useMemo(() => {
    const branches = [
      BranchLocation.Davao,
      BranchLocation.Cagayan,
      BranchLocation.Cebu,
      BranchLocation.Mandaue,
    ];

    return branches.map((loc) => {
      const bSales = timeframeSales.filter((s) => {
        const bName = (s.branch || '').toLowerCase();
        const lName = loc.toLowerCase();
        return bName.includes(lName) || lName.includes(bName);
      });

      const rev = bSales.reduce((sum, s) => sum + (s.totalAmountPHP || s.totalAmountUSD || 0), 0);
      const count = bSales.length;
      const share = salesRevenueTotal > 0 ? (rev / salesRevenueTotal) * 100 : 0;
      const avgTicket = count > 0 ? rev / count : 0;

      return {
        branch: loc,
        revenue: rev,
        count,
        share,
        avgTicket,
      };
    });
  }, [timeframeSales, salesRevenueTotal]);

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
      <div
        style={{
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.08)',
          borderRadius: 12,
          padding: '1.5rem 1.75rem',
          color: '#FFFFFF',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0.15rem 0.5rem',
                borderRadius: 4,
                background:
                  userSession.role === UserRole.Owner
                    ? '#0284C7'
                    : userSession.role === UserRole.BranchManager
                      ? '#D97706'
                      : '#059669',
              }}
            >
              {userSession.role} Workspace
            </span>
            <span style={{ color: '#94A3B8', fontSize: '0.8rem' }}>• SteelTrack Enterprise Hub</span>
          </div>

          <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Welcome, {userSession.name}
          </h1>

          <p style={{ margin: '0.35rem 0 0 0', color: '#94A3B8', fontSize: '0.85rem' }}>
            {userSession.role === UserRole.Owner &&
              'Executive enterprise scope active across all 4 operational branch facilities.'}
            {userSession.role === UserRole.BranchManager &&
              `Full operational supervision for ${userSession.branch} Branch facility, quality approvals & local inventory.`}
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

          {userSession.role === UserRole.BranchManager && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-primary"
                onClick={() => onSelectTab('approvals')}
                style={{
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <ClipboardCheck size={16} /> Quality Approvals ({approvalsCount})
              </button>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('inventory')}
                style={{
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  background: '#334155',
                  color: '#FFFFFF',
                  borderColor: '#475569',
                }}
              >
                <Layers size={16} /> Branch Products
              </button>
            </div>
          )}

          {userSession.role === UserRole.Owner ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Scope:</div>
              <select
                value={selectedBranch}
                onChange={(e) => onSelectBranch(e.target.value)}
                style={{
                  padding: '0.5rem 0.85rem',
                  borderRadius: 6,
                  background: '#334155',
                  color: '#FFFFFF',
                  border: '1px solid #475569',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <option value="All">All 4 Branches Combined</option>
                <option value={BranchLocation.Davao}>Davao Branch</option>
                <option value={BranchLocation.Cagayan}>Cagayan Branch</option>
                <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
                <option value={BranchLocation.Cebu}>Cebu Branch</option>
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  color: '#E2E8F0',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Building2 size={14} color="#38BDF8" /> {userSession.branch} Branch Workspace
              </span>
            </div>
          )}
        </div>
      </div>

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
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A' }}>
            Revenue & Sales Timeframe:
          </span>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
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
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {userSession.role === UserRole.Cashier
                  ? `Counter Sales (${timeframe})`
                  : userSession.role === UserRole.BranchManager
                  ? `${userSession.branch} Revenue (${timeframe})`
                  : `Total Revenue (${timeframe})`}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                ₱{salesRevenueTotal.toLocaleString()}
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
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 8, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {userSession.role === UserRole.Cashier ? 'Active Stock Transfers' : 'Inter-Branch Transfers'}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                {transfersCount}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowRightLeft size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 8 }}>
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
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                Cashier Point of Sale Terminal
              </h3>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
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
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                Automated FIFO Inventory Active
              </h3>
            </div>
            <p style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.5 }}>
              First-In, First-Out (FIFO) ensures older inventory batches received at the counter are sold first before newer stock with updated pricing is accessed.
            </p>
            <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, fontSize: '0.78rem', color: '#334155' }}>
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
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                  Quality Control Sign-Off
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: approvalsCount > 0 ? '#FEF3C7' : '#DCFCE7', color: approvalsCount > 0 ? '#B45309' : '#15803D', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                {approvalsCount} Pending
              </span>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
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
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
                Inter-Branch Stock Transfers
              </h3>
            </div>
            <p style={{ color: '#64748B', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
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
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <TrendingUp size={18} style={{ color: '#059669' }} />
                  {userSession.branch} Branch Revenue Breakdown ({timeframe})
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', color: '#64748B', fontSize: '0.8rem' }}>
                  Audited financial settlement and tender channel metrics strictly scoped to {userSession.branch} Branch.
                </p>
              </div>

              <TableExportButtons
                filename={`${userSession.branch}_Revenue_${timeframe}`}
                title={`${userSession.branch} Branch Revenue Breakdown (${timeframe})`}
                subtitle={`Total Period Revenue: ₱${salesRevenueTotal.toLocaleString()} across ${salesCount} transaction(s)`}
                headers={['Payment Tender Channel', 'Transaction Count', 'Revenue Total (PHP)', 'Share of Period Revenue']}
                rows={branchPaymentBreakdown.map((b) => [
                  b.method,
                  b.count,
                  `₱${b.revenue.toLocaleString()}`,
                  `${b.share.toFixed(1)}%`,
                ])}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                  Branch Period Total
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                  ₱{salesRevenueTotal.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: 4, fontWeight: 600 }}>
                  {salesCount} Total Orders • Avg Order: ₱{salesCount > 0 ? Math.round(salesRevenueTotal / salesCount).toLocaleString() : '0'}
                </div>
              </div>

              <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  Tender Channel Dissemination
                </div>
                {branchPaymentBreakdown.length === 0 ? (
                  <div style={{ color: '#94A3B8', fontSize: '0.82rem', padding: '0.5rem 0' }}>
                    No settled sales transactions recorded in this {timeframe.toLowerCase()} window.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {branchPaymentBreakdown.map((t) => (
                      <div key={t.method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{t.method} ({t.count}):</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, color: '#0F172A' }}>₱{t.revenue.toLocaleString()}</span>
                          <span style={{ fontSize: '0.72rem', background: '#F1F5F9', color: '#64748B', padding: '0.1rem 0.35rem', borderRadius: 4 }}>
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
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <PieChart size={20} style={{ color: '#0284C7' }} />
                  Enterprise Revenue Breakdown per Branch ({timeframe})
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748B', fontSize: '0.82rem' }}>
                  Comprehensive cross-branch revenue dissemination across all 4 regional hubs. Filter scope above or drill into any branch.
                </p>
              </div>

              <TableExportButtons
                filename={`AllBranches_Revenue_Breakdown_${timeframe}`}
                title={`Enterprise Revenue Breakdown per Branch (${timeframe})`}
                subtitle={`Overall Combined Revenue: ₱${salesRevenueTotal.toLocaleString()} across ${salesCount} transaction(s)`}
                headers={['Branch Facility', 'Revenue Total (PHP)', 'Share of Revenue (%)', 'Transaction Count', 'Avg Ticket (PHP)']}
                rows={branchBreakdownData.map((b) => [
                  `${b.branch} Branch`,
                  `₱${b.revenue.toLocaleString()}`,
                  `${b.share.toFixed(1)}%`,
                  b.count,
                  `₱${Math.round(b.avgTicket).toLocaleString()}`,
                ])}
              />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>Branch Facility</th>
                    <th style={{ textAlign: 'right', padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>Revenue (PHP)</th>
                    <th style={{ textAlign: 'left', padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700, minWidth: '150px' }}>Share of Revenue</th>
                    <th style={{ textAlign: 'center', padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>Transactions</th>
                    <th style={{ textAlign: 'right', padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>Avg Ticket</th>
                    <th style={{ textAlign: 'center', padding: '0.65rem 0.85rem', color: '#475569', fontWeight: 700 }}>Scope View</th>
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
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{b.branch} Branch</span>
                            {isSelected && (
                              <span style={{ fontSize: '0.7rem', background: '#0284C7', color: '#FFFFFF', padding: '0.1rem 0.4rem', borderRadius: 4, fontWeight: 700 }}>
                                Active Scope
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.75rem 0.85rem', fontWeight: 700, color: '#0F172A', fontFamily: 'Outfit, sans-serif' }}>
                          ₱{b.revenue.toLocaleString()}
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
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '40px' }}>
                              {b.share.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.75rem 0.85rem', fontWeight: 600, color: '#334155' }}>
                          {b.count}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.75rem 0.85rem', color: '#475569' }}>
                          ₱{Math.round(b.avgTicket).toLocaleString()}
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
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Building2 size={18} style={{ color: '#0284C7' }} />
                Regional Facility Performance
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Live Database Replication Active</span>
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
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>{f.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{f.region}</div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, background: '#ECFDF5', color: '#059669', padding: '0.15rem 0.45rem', borderRadius: 4 }}>
                      ● Online
                    </span>
                  </div>

                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: '#0284C7', fontWeight: 600 }}>Supervise Inventory</span>
                    <ChevronRight size={14} style={{ color: '#94A3B8' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Quick Actions */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Executive Tools & Operations
              </h4>
              {receivablesTotal > 0 && (
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Total Receivables: <strong style={{ color: '#0F172A' }}>₱{receivablesTotal.toLocaleString()}</strong>
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
              <button
                className="btn-secondary"
                onClick={() => onSelectTab('forecast')}
                style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', justifyContent: 'flex-start' }}
              >
                <Sparkles size={16} style={{ color: '#0284C7' }} /> LSTM Demand Forecast
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
