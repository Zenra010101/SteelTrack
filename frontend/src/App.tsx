import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Filter, Loader2, LogOut, X, AlertTriangle } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricsOverview } from './components/MetricsOverview';
import { InventoryTable } from './components/InventoryTable';
import { AddBatchModal } from './components/AddBatchModal';
import { LoginScreen } from './components/LoginScreen';
import { DashboardView } from './components/DashboardView';
import { OwnerForecastView } from './components/OwnerForecastView';
import { InterBranchTransferView } from './components/InterBranchTransferView';
import { CashierPosView } from './components/CashierPosView';
import { CashierSalesHistoryView } from './components/CashierSalesHistoryView';
import { OwnerAnalyticsView } from './components/OwnerAnalyticsView';
import { BranchApprovalsView } from './components/BranchApprovalsView';
import { SystemManagementView } from './components/SystemManagementView';
import { ReceivablesView } from './components/ReceivablesView';
import { ChequeManagementView } from './components/ChequeManagementView';
import { GoodsReturnView } from './components/GoodsReturnView';
import { SupplierManagementView } from './components/SupplierManagementView';
import { CustomerManagementView } from './components/CustomerManagementView';
import { AuditLogView } from './components/AuditLogView';
import { ProductsManagementView } from './components/ProductsManagementView';

import {
  fetchBranchProducts,
  createBatch,
  updateBatchStatus,
  getAuthHeaders,
} from './services/api';
import {
  clearAuthState,
  decodeJwtPayload,
  getStoredToken,
  messageForReason,
  onSessionEnd,
} from './services/session';
import {
  startSignalR,
  joinBranchGroup,
  onInventoryChanged,
  onPriceChanged,
  onSaleCompleted,
} from './services/signalrService';
import type { BranchProductItem, InventoryStats, BatchStatus, CreateSteelBatchDto } from './types/steel';
// SteelBatch removed — inventory is now read live via fetchBranchProducts.
import { UserRole, BranchLocation, type UserSession } from './types/auth';

/**
 * What the app knows about the session when it boots.
 *
 * 'checking'  — we are still asking the server whether the stored token is
 *               good; the login screen must not flash on screen while this
 *               is in flight.
 * 'ready'     — the session is valid and unchanged.
 * 'ended'     — the session is over; the user has to sign in again.
 */
type BootState = 'checking' | 'ready' | 'ended';

export function App() {
  const [bootState, setBootState] = useState<BootState>('checking');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const [userSession, setUserSession] = useState<UserSession | null>(null);

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const savedTab = localStorage.getItem('steeltrack_active_tab');
      if (savedTab) return savedTab;
    } catch { }
    return 'dashboard';
  });

  // Branch products — read live from the branch_products table via /api/inventory/stock-list
  const [branchProducts, setBranchProducts] = useState<BranchProductItem[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    return localStorage.getItem('steeltrack_selected_branch') || 'All';
  });
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [lowStockFilter, setLowStockFilter] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // Debounce search keystrokes to prevent table reload jitter
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const handleLogin = (session: UserSession) => {
    try {
      localStorage.setItem('steeltrack_user_session', JSON.stringify(session));
    } catch (err) {
      console.warn('Failed saving session to localStorage:', err);
    }
    setUserSession(session);

    // Set initial branch
    if (session.branch) {
      setSelectedBranch(session.branch);
      localStorage.setItem('steeltrack_selected_branch', session.branch);
    } else {
      setSelectedBranch('All');
      localStorage.setItem('steeltrack_selected_branch', 'All');
    }

    // Landing page: always route to Role Dashboard on login

    setActiveTab('dashboard');
    try {

      localStorage.setItem('steeltrack_active_tab', 'dashboard');
    } catch { }
  };

  const handleLogout = () => {
    // Tell the server first — it writes the audit row. Best effort: if the
    // API is unreachable the local session still has to end.
    void fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    }).catch(() => undefined);

    try {
      localStorage.removeItem('steeltrack_active_tab');
      localStorage.removeItem('steeltrack_selected_branch');
    } catch (err) {
      console.warn('Failed clearing session from localStorage:', err);
    }

    // Removes the token and the stored user as well as the session marker.
    clearAuthState();

    setUserSession(null);
    setBootState('ended');
    setSessionNotice(null);
  };

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('steeltrack_active_tab', tab);
    } catch { }
  };

  const handleSelectBranch = (branch: string) => {
    setSelectedBranch(branch);
    try {
      localStorage.setItem('steeltrack_selected_branch', branch);
    } catch { }
  };

  const effectiveBranch = userSession?.role === UserRole.Owner
    ? (selectedBranch === 'All' ? undefined : selectedBranch)
    : userSession?.branch;

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent && branchProducts.length === 0) {
      setLoading(true);
    }
    try {
      const prodResult = await fetchBranchProducts(debouncedSearch, undefined, gradeFilter, lowStockFilter, effectiveBranch);
      setBranchProducts(prodResult.data);

      const items = prodResult.data;
      const totalBatches = prodResult.totalCount || items.length;
      const totalTonnage = Number(items.reduce((sum, p) => sum + (Number(p.weightInTons ?? (Number(p.stockQuantity ?? 0) * 0.1))), 0).toFixed(2));
      const availableCount = items.filter(p => p.isAvailable !== false && p.status !== 'Shipped').length;
      const qualityCheckCount = items.filter(p => p.status === 'QualityCheck' || (((p.currentStock ?? 0) <= (p.reorderLevel ?? 0)) && (p.currentStock ?? 0) > 0)).length;
      const inProductionCount = items.filter(p => p.status === 'InProduction').length;
      const shippedCount = items.filter(p => p.status === 'Shipped' || (p.currentStock ?? 0) <= 0).length;

      setStats({
        totalBatches,
        totalTonnage,
        availableCount,
        qualityCheckCount,
        inProductionCount,
        shippedCount,
      });

      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed loading branch products from database:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, gradeFilter, lowStockFilter, effectiveBranch, branchProducts.length]);

  // Begin boot validation once. While it is running the login screen must
  // not flash at somebody who is already signed in.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const raw = localStorage.getItem('steeltrack_user_session');

      // Nothing stored: there is no session to validate.
      if (!raw) {
        if (!cancelled) setBootState('ready');
        return;
      }

      const token = getStoredToken();

      if (!token) {
        // The marker says we are logged in but there is no token. Toss the
        // marker and start fresh.
        try {
          localStorage.removeItem('steeltrack_user_session');
        } catch {
          /* ignore */
        }
        if (!cancelled) setBootState('ready');
        return;
      }

      const claim = decodeJwtPayload(token);

      if (claim?.stt_instance) {
        try {
          const res = await fetch('/api/session/instance', {
            headers: getAuthHeaders(),
          });

          if (res.ok) {
            const serverInstanceId = (await res.json()).instanceId;
            if (serverInstanceId && claim.stt_instance !== serverInstanceId) {
              // Server restarted — silently invalidate and clear session
              clearAuthState();
              setUserSession(null);
              setSessionNotice(null);
              if (!cancelled) setBootState('ready');
              return;
            }
          }
        } catch {
          // The API could not be reached. That is a connectivity problem, not
          // a session problem — the token stays exactly where it is and the
          // views report their own errors.
        }
      }

      // Everything matched, or the server could not be asked. Restore the
      // stored session exactly as it was: a browser reload is not a session
      // change, and the token is not touched.
      try {
        const parsed = JSON.parse(raw) as UserSession;
        if (!cancelled && parsed?.username) setUserSession(parsed);
      } catch {
        /* keep current state */
      }

      if (!cancelled) setBootState('ready');
    }

    void boot();

    // A 401 from anywhere in the app ends the session. The interceptor has
    // already cleared the stored token; drop the in-memory session too, so
    // the app stops rendering data it can no longer fetch.
    const unsubscribe = onSessionEnd((reason) => {
      setUserSession(null);
      setBootState('ended');
      if (reason === 'server_restarted') {
        setSessionNotice(null);
      } else {
        setSessionNotice(messageForReason(reason));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Real-Time SignalR Collaboration (Deliverable 7)
  useEffect(() => {
    if (!userSession) return;

    let mounted = true;
    startSignalR().then((hub) => {
      if (!hub || !mounted) return;
      if (userSession.branch) {
        void joinBranchGroup(userSession.branch);
      }
    });

    const unsubInventory = onInventoryChanged(() => {
      void loadData(true);
    });

    const unsubPrice = onPriceChanged(() => {
      void loadData(true);
    });

    const unsubSale = onSaleCompleted(() => {
      void loadData(true);
    });

    return () => {
      mounted = false;
      unsubInventory();
      unsubPrice();
      unsubSale();
    };
  }, [userSession, loadData]);

  // Auto-refresh stock lookup at 30-second interval when on inventory tab (silent in background)
  useEffect(() => {
    if (!userSession || activeTab !== 'inventory') return;

    // Load immediately on tab open or filter changes
    void loadData(false);

    const timer = setInterval(() => {
      void loadData(true);
    }, 30000);

    return () => clearInterval(timer);
  }, [userSession, activeTab, debouncedSearch, gradeFilter, effectiveBranch]);

  const displayedBranchProducts = useMemo(() => {
    if (!statusFilter) return branchProducts;
    return branchProducts.filter((p) => {
      const displayStatus = p.status || (p.isAvailable !== false ? 'Available' : 'Reserved');
      return displayStatus === statusFilter;
    });
  }, [branchProducts, statusFilter]);

  const handleCreateBatch = async (dto: CreateSteelBatchDto) => {
    await createBatch(dto);
    await loadData();
  };

  const handleUpdateStatus = async (id: string, newStatus: BatchStatus) => {
    try {
      await updateBatchStatus(id, { status: newStatus });
      setBranchProducts((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: newStatus,
                isAvailable: newStatus === 'Available',
                isActive: newStatus !== 'Shipped',
              }
            : item
        )
      );
      await loadData(true);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert(`Could not update status: ${err?.message || 'Server error'}`);
    }
  };

  // Render Login Screen if user is not authenticated.
  // While the boot check is in flight we hold the screen rather than flash the
  // login form at somebody who is already signed in — a page reload must not
  // look like a session ending.
  if (!userSession) {
    if (bootState === 'checking') {
      return (
        <div className="login-wrapper">
          <div className="login-container single-card">
            <div
              className="login-form-pane"
              style={{ textAlign: 'center', color: '#000000' }}
            >
              <Loader2 size={22} />
              <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
                Restoring your session…
              </p>
            </div>
          </div>
        </div>
      );
    }

    return <LoginScreen onLogin={handleLogin} notice={sessionNotice} />;
  }

  // Get current active tab human-readable title
  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return userSession.role === UserRole.Owner
          ? 'Enterprise Executive Dashboard — Overview & KPIs'
          : userSession.role === UserRole.BranchManager
            ? `${userSession.branch} Branch Operations Dashboard`
            : `Cashier POS Terminal Dashboard — ${userSession.branch} Branch`;
      case 'inventory':
        return userSession.role === UserRole.Owner
          ? 'All Branches Steel Inventory'
          : `${userSession.branch} Branch Products Supervision`;
      case 'products':
        return userSession.role === UserRole.Owner
          ? 'Master Products Catalog & Specifications — All Categories'
          : `Products Catalog & Specifications — ${userSession.branch} Branch`;
      case 'receivables':
        return `Accounts Receivable & Credit Control — ${userSession.role === UserRole.Owner ? 'All Branches' : `${userSession.branch} Branch`
          }`;
      case 'cheques':
        return `Post-Dated Cheque (PDC) Register — ${userSession.role === UserRole.Owner ? 'All Branches' : `${userSession.branch} Branch`
          }`;
      case 'returns':
        return `Goods Return Slips (GRS) & Restock — ${userSession.role === UserRole.Owner ? 'All Branches' : `${userSession.branch} Branch`
          }`;
      case 'suppliers':
        return 'Supplier Master Directory & Mill Test Certificates (MTC)';
      case 'customers':
        return 'Corporate Customer Directory & Credit Control';
      case 'audit':
        return 'System Audit Logs & Visual JSON Diff Inspection';
      case 'forecast':
        return 'Demand Forecasting';
      case 'transfers':
        return 'Inter-Branch Stock Transfer System';
      case 'pos':
        return `Point of Sale (POS) Terminal — ${userSession.branch} Branch`;
      case 'sales-history':
        return `Sales History & Receipt Journal — ${userSession.branch} Branch`;
      case 'analytics':
        return 'Cross-Branch Financial & Inventory Analytics';
      case 'approvals':
        return `Quality Control & Batch Approvals — ${userSession.branch} Branch`;
      case 'system':
        return 'System Management & User Access Control (RBAC)';
      default:
        return 'SteelTrack Dashboard';
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar
        userSession={userSession}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        selectedBranch={selectedBranch}
        onSelectBranch={handleSelectBranch}
        onRefresh={loadData}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      {/* Main Workspace Area */}
      <main className="app-main">
        <Header
          userSession={userSession}
          activeTabTitle={getTabTitle()}
          onRefresh={loadData}
          lastRefreshedAt={lastRefreshedAt}
        />

        <div className="main-content">
          {/* TAB 0: DASHBOARD (LANDING PAGE FOR ALL ROLES) */}
          {activeTab === 'dashboard' && (
            <DashboardView
              userSession={userSession}
              selectedBranch={selectedBranch}
              onSelectTab={handleSelectTab}
              onSelectBranch={handleSelectBranch}
            />
          )}
          {/* TAB 1: POS VIEW (CASHIER ONLY) */}
          {activeTab === 'pos' && (
            <CashierPosView
              branch={userSession.branch || BranchLocation.Davao}
              cashierName={userSession.name}
            />
          )}

          {/* TAB: SALES HISTORY (CASHIER ONLY) */}
          {activeTab === 'sales-history' && (
            <CashierSalesHistoryView
              branch={userSession.branch || BranchLocation.Davao}
              cashierName={userSession.name}
            />
          )}

          {/* TAB 2: INVENTORY MANAGEMENT DASHBOARD */}
          {activeTab === 'inventory' && (
            <>
              <MetricsOverview stats={stats} />

              <div className="controls-bar">
                <div className="search-box">
                  <Search size={18} style={{ color: '#000000' }} />
                  <input
                    type="text"
                    placeholder="Search heat #, yard location, dimensions, or branch..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#000000', fontSize: '0.85rem' }}>
                    <Filter size={16} /> Filters:
                  </div>

                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                  >
                    <option value="">All Steel Grades</option>
                    <option value="A36_Structural">A36 Structural</option>
                    <option value="A572_HighStrength">A572 High Strength</option>
                    <option value="SS304_Stainless">SS304 Stainless</option>
                    <option value="SS316_Stainless">SS316 Stainless</option>
                    <option value="AISI1045_Carbon">AISI 1045 Carbon</option>
                    <option value="ToolSteel_D2">Tool Steel D2</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">All Statuses</option>
                    <option value="InProduction">In Production</option>
                    <option value="QualityCheck">Quality Check</option>
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Shipped">Shipped</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setLowStockFilter(!lowStockFilter)}
                    style={{
                      background: lowStockFilter ? '#DC2626' : '#FFFFFF',
                      color: lowStockFilter ? '#FFFFFF' : '#475569',
                      border: lowStockFilter ? '1px solid #DC2626' : '1px solid #CBD5E1',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: lowStockFilter ? 700 : 500,
                      transition: 'all 0.15s ease-in-out',
                    }}
                    title="Filter branch products with low or critical inventory"
                  >
                    <AlertTriangle size={15} /> Low Stock Only
                  </button>

                  {/* RBAC Protection: Only Owner and Branch Manager can log new batches */}
                  {userSession.role !== UserRole.Cashier && (
                    <button
                      className="btn-primary"
                      onClick={() => setIsModalOpen(true)}
                    >
                      <Plus size={18} /> New Batch
                    </button>
                  )}
                </div>
              </div>

              <InventoryTable
                batches={displayedBranchProducts as unknown as import('./types/steel').SteelBatch[]}
                loading={loading}
                onUpdateStatus={handleUpdateStatus}
                onStockAdded={() => loadData(true)}
              />
            </>
          )}

          {/* TAB: PRODUCTS MASTER CATALOG (OWNER & MANAGER) */}
          {activeTab === 'products' && userSession.role !== UserRole.Cashier && (
            <ProductsManagementView userSession={userSession} />
          )}

          {/* TAB 3: INTER-BRANCH STOCK TRANSFERS (OWNER & MANAGER) */}
          {activeTab === 'transfers' && (
            <InterBranchTransferView
              currentBranch={userSession.branch}
              currentUserName={userSession.name}
            />
          )}

          {/* TAB: ACCOUNTS RECEIVABLE (OWNER & MANAGER) */}
          {activeTab === 'receivables' && userSession.role !== UserRole.Cashier && (
            <ReceivablesView
              currentBranch={userSession.role === UserRole.Owner ? (selectedBranch === 'All' ? undefined : (selectedBranch as BranchLocation)) : userSession.branch}
              currentUserName={userSession.name}
            />
          )}

          {/* TAB: CHEQUES & PDC REGISTER (OWNER & MANAGER) */}
          {activeTab === 'cheques' && userSession.role !== UserRole.Cashier && (
            <ChequeManagementView
              currentBranch={userSession.role === UserRole.Owner ? (selectedBranch === 'All' ? undefined : (selectedBranch as BranchLocation)) : userSession.branch}
            />
          )}

          {/* TAB: GOODS RETURN SLIPS & EXCHANGES (OWNER & MANAGER) */}
          {activeTab === 'returns' && userSession.role !== UserRole.Cashier && (
            <GoodsReturnView
              currentBranch={userSession.role === UserRole.Owner ? (selectedBranch === 'All' ? undefined : (selectedBranch as BranchLocation)) : userSession.branch}
              currentUserName={userSession.name}
            />
          )}

          {/* TAB: SUPPLIER DIRECTORY (OWNER & MANAGER) */}
          {activeTab === 'suppliers' && userSession.role !== UserRole.Cashier && (
            <SupplierManagementView />
          )}

          {/* TAB: CUSTOMER DIRECTORY (OWNER & MANAGER) */}
          {activeTab === 'customers' && userSession.role !== UserRole.Cashier && (
            <CustomerManagementView />
          )}

          {/* TAB: AUDIT LOGS & DIFF INSPECTION (OWNER ONLY) */}
          {activeTab === 'audit' && userSession.role === UserRole.Owner && (
            <AuditLogView />
          )}

          {/* TAB 4: AI LSTM DEMAND FORECASTING (OWNER ONLY) */}
          {activeTab === 'forecast' && userSession.role === UserRole.Owner && (
            <OwnerForecastView selectedBranch={selectedBranch as BranchLocation | 'All'} />
          )}

          {/* TAB 5: CROSS-BRANCH ANALYTICS (OWNER ONLY) */}
          {activeTab === 'analytics' && userSession.role === UserRole.Owner && (
            <OwnerAnalyticsView />
          )}

          {/* TAB 6: QUALITY APPROVALS (BRANCH MANAGER ONLY) */}
          {activeTab === 'approvals' && userSession.role === UserRole.BranchManager && (
            <BranchApprovalsView
              branch={userSession.branch || BranchLocation.Davao}
              managerName={userSession.name}
            />
          )}

          {/* TAB 7: SYSTEM & STAFF MANAGEMENT (OWNER & BRANCH MANAGER) */}
          {activeTab === 'system' && (userSession.role === UserRole.Owner || userSession.role === UserRole.BranchManager) && (
            <SystemManagementView userSession={userSession} />
          )}
        </div>

        {/* LOGOUT CONFIRMATION MODAL */}
        {showLogoutConfirm && (
          <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 440, borderRadius: 12, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
            >
              <div className="modal-header" style={{ borderBottom: '1px solid #E2E8F0', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: '#FEE2E2',
                      color: '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <LogOut size={17} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#000000' }}>
                      Confirm Sign Out
                    </h3>
                  </div>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  title="Close"
                >
                  <X size={18} style={{ color: '#000000' }} />
                </button>
              </div>

              <div className="modal-body" style={{ padding: '1.25rem', color: '#000000', fontSize: '0.88rem', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 1rem 0' }}>
                  Are you sure you want to end your current session and sign out of <strong>SteelTrack Enterprise Hub</strong>?
                </p>

                {userSession && (
                  <div
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      padding: '0.75rem 1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#000000', fontSize: '0.85rem' }}>
                        {userSession.name}
                      </div>
                      <div style={{ color: '#000000', fontSize: '0.75rem', marginTop: 2 }}>
                        {userSession.role} • {userSession.branch ? `${userSession.branch} Branch` : 'Executive Scope (All Branches)'}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.2rem 0.5rem',
                        borderRadius: 4,
                        background: '#E2E8F0',
                        color: '#000000',
                      }}
                    >
                      Active Session
                    </span>
                  </div>
                )}
              </div>

              <div
                className="modal-footer"
                style={{
                  borderTop: '1px solid #E2E8F0',
                  padding: '0.85rem 1.25rem',
                  background: '#F8FAFC',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ padding: '0.55rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  style={{
                    background: '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.55rem 1.15rem',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <LogOut size={15} /> Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ADD BATCH MODAL */}
        <AddBatchModal
          isOpen={isModalOpen}
          defaultBranch={userSession.branch || BranchLocation.Davao}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateBatch}
        />
      </main>
    </div>
  );
}

export default App;
