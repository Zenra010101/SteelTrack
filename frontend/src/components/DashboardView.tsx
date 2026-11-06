import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { UserRole, BranchLocation, type UserSession } from '../types/auth';
import type { BranchProductItem } from '../types/steel';
import {
  fetchBranchProducts,
  fetchTransfers,
  fetchApprovals,
  fetchPosTransactions,
  fetchReceivableStats,
} from '../services/api';

interface DashboardViewProps {
  userSession: UserSession;
  selectedBranch: string;
  onSelectTab: (tabId: string) => void;
  onSelectBranch: (branch: string) => void;
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
  const [todaySalesCount, setTodaySalesCount] = useState<number>(0);
  const [todaySalesTotal, setTodaySalesTotal] = useState<number>(0);
  const [receivablesTotal, setReceivablesTotal] = useState<number>(0);

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

        // Compute sales
        const sales = posResult || [];
        setTodaySalesCount(sales.length);
        const total = sales.reduce((sum, s) => sum + (s.totalAmountPHP || s.totalAmountUSD || 0), 0);
        setTodaySalesTotal(total);

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

  const totalStockTons = branchProducts
    .reduce((acc, p) => acc + (Number(p.weightInTons ?? (Number(p.stockQuantity ?? 0) * 0.1))), 0)
    .toFixed(1);

  const totalCatalogItems = branchProducts.length;
  const availableStockCount = branchProducts.filter(
    (p) => p.isAvailable !== false && (p.currentStock ?? p.stockQuantity ?? 0) > 0
  ).length;

  const lowStockItems = branchProducts.filter(
    (p) => (p.currentStock ?? p.stockQuantity ?? 0) <= (p.reorderLevel ?? 5) && (p.currentStock ?? p.stockQuantity ?? 0) > 0
  );

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

          {userSession.role === UserRole.Owner && (
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
          )}
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
                {userSession.role === UserRole.Cashier ? 'Counter Sales (Today)' : 'Sales Revenue'}
              </div>
              <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                ₱{todaySalesTotal.toLocaleString()}
              </div>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={20} />
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: 8, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <TrendingUp size={13} /> {todaySalesCount} transaction(s) recorded
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
          <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 8 }}>
            {availableStockCount} product specification(s) in stock {lowStockItems.length > 0 ? `(${lowStockItems.length} low stock)` : ''}
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
        </div>
      )}

      {/* 3. OWNER EXECUTIVE WORKSPACE */}
      {userSession.role === UserRole.Owner && (
        <>
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
