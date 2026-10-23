import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Filter, Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricsOverview } from './components/MetricsOverview';
import { InventoryTable } from './components/InventoryTable';
import { AddBatchModal } from './components/AddBatchModal';
import { LoginScreen } from './components/LoginScreen';
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
  fetchInventory,
  fetchStats,
  createBatch,
  updateBatchStatus,
  getAuthHeaders,
} from './services/api';
import {
  clearAuthState,
  decodeJwtPayload,
  getStoredToken,
  messageForReason,
  notifySessionEnded,
  onSessionEnd,
} from './services/session';
import type { SteelBatch, InventoryStats, BatchStatus, CreateSteelBatchDto } from './types/steel';
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
    } catch {}
    return 'inventory';
  });

  // Inventory State
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    return localStorage.getItem('steeltrack_selected_branch') || 'All';
  });
  const [search, setSearch] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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

    // Set appropriate initial tab if none stored
    const existingTab = localStorage.getItem('steeltrack_active_tab');
    if (!existingTab) {
      const defaultTab = session.role === UserRole.Cashier ? 'pos' : 'inventory';
      setActiveTab(defaultTab);
      localStorage.setItem('steeltrack_active_tab', defaultTab);
    }
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
    } catch {}
  };

  const handleSelectBranch = (branch: string) => {
    setSelectedBranch(branch);
    try {
      localStorage.setItem('steeltrack_selected_branch', branch);
    } catch {}
  };

  const effectiveBranch = userSession?.role === UserRole.Owner
    ? (selectedBranch === 'All' ? undefined : selectedBranch)
    : userSession?.branch;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invResult, statsData] = await Promise.all([
        fetchInventory(search, gradeFilter, statusFilter, effectiveBranch),
        fetchStats(effectiveBranch),
      ]);
      setBatches(invResult.data);
      setIsLiveBackend(invResult.isLiveBackend);
      setStats(statsData);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error('Failed loading inventory data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, gradeFilter, statusFilter, effectiveBranch]);

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
              // The server restarted and no longer owns this token. Clear it
              // and report "restarted" rather than letting the generic 401
              // path call it an expiry.
              clearAuthState();
              if (!cancelled) {
                notifySessionEnded('server_restarted');
              }
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
      setSessionNotice(messageForReason(reason));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Auto-refresh stock lookup at 20-second interval when on inventory tab
  useEffect(() => {
    if (userSession && activeTab === 'inventory') {
      const timer = setInterval(() => {
        loadData();
      }, 20000);
      return () => clearInterval(timer);
    }
  }, [userSession, activeTab, loadData]);

  const handleCreateBatch = async (dto: CreateSteelBatchDto) => {
    await createBatch(dto);
    await loadData();
  };

  const handleUpdateStatus = async (id: string, newStatus: BatchStatus) => {
    await updateBatchStatus(id, { status: newStatus });
    await loadData();
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
              style={{ textAlign: 'center', color: '#64748B' }}
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
      case 'inventory':
        return userSession.role === UserRole.Owner
          ? 'All Branches Steel Inventory'
          : `${userSession.branch} Branch Inventory Supervision`;
      case 'products':
        return userSession.role === UserRole.Owner
          ? 'Master Products Catalog & Specifications — All Categories'
          : `Products Catalog & Specifications — ${userSession.branch} Branch`;
      case 'receivables':
        return `Accounts Receivable & Credit Control — ${
          userSession.role === UserRole.Owner ? 'All Branches' : `${userSession.branch} Branch`
        }`;
      case 'cheques':
        return `Post-Dated Cheque (PDC) Register — ${
          userSession.role === UserRole.Owner ? 'All Branches' : `${userSession.branch} Branch`
        }`;
      case 'returns':
        return `Goods Return Slips (GRS) & Restock — ${
          userSession.role === UserRole.Owner ? 'All Branches' : `${userSession.branch} Branch`
        }`;
      case 'suppliers':
        return 'Supplier Master Directory & Mill Test Certificates (MTC)';
      case 'customers':
        return 'Corporate Customer Directory & Credit Control';
      case 'audit':
        return 'System Audit Logs & Visual JSON Diff Inspection';
      case 'forecast':
        return 'LSTM Neural Network Steel Demand Forecast';
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
        isLiveBackend={isLiveBackend}
        onRefresh={loadData}
        onLogout={handleLogout}
      />

      {/* Main Workspace Area */}
      <main className="app-main">
        <Header
          isLiveBackend={isLiveBackend}
          userSession={userSession}
          activeTabTitle={getTabTitle()}
          onRefresh={loadData}
          lastRefreshedAt={lastRefreshedAt}
        />

        <div className="main-content">
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
                  <Search size={18} style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search heat #, yard location, dimensions, or branch..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94A3B8', fontSize: '0.85rem' }}>
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
                batches={batches}
                loading={loading}
                onUpdateStatus={handleUpdateStatus}
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
            <OwnerForecastView />
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

          {/* TAB 7: SYSTEM MANAGEMENT (OWNER ONLY) */}
          {activeTab === 'system' && userSession.role === UserRole.Owner && (
            <SystemManagementView />
          )}
        </div>

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
