import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Filter } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MetricsOverview } from './components/MetricsOverview';
import { InventoryTable } from './components/InventoryTable';
import { AddBatchModal } from './components/AddBatchModal';
import { LoginScreen } from './components/LoginScreen';
import { OwnerForecastView } from './components/OwnerForecastView';
import { InterBranchTransferView } from './components/InterBranchTransferView';
import { CashierPosView } from './components/CashierPosView';
import { OwnerAnalyticsView } from './components/OwnerAnalyticsView';
import { BranchApprovalsView } from './components/BranchApprovalsView';
import { SystemManagementView } from './components/SystemManagementView';
import { ReceivablesView } from './components/ReceivablesView';
import { ChequeManagementView } from './components/ChequeManagementView';
import { GoodsReturnView } from './components/GoodsReturnView';
import { SupplierManagementView } from './components/SupplierManagementView';
import { CustomerManagementView } from './components/CustomerManagementView';
import { AuditLogView } from './components/AuditLogView';

import {
  fetchInventory,
  fetchStats,
  createBatch,
  updateBatchStatus,
} from './services/api';
import type { SteelBatch, InventoryStats, BatchStatus, CreateSteelBatchDto } from './types/steel';
import { UserRole, BranchLocation, type UserSession } from './types/auth';

export function App() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('inventory');

  // Inventory State
  const [batches, setBatches] = useState<SteelBatch[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLiveBackend, setIsLiveBackend] = useState<boolean>(false);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('All');
  const [search, setSearch] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Set default active tab based on role when logging in
  useEffect(() => {
    if (userSession) {
      if (userSession.role === UserRole.Cashier) {
        setActiveTab('pos');
        if (userSession.branch) setSelectedBranch(userSession.branch);
      } else if (userSession.role === UserRole.BranchManager) {
        setActiveTab('inventory');
        if (userSession.branch) setSelectedBranch(userSession.branch);
      } else {
        setActiveTab('inventory');
        setSelectedBranch('All');
      }
    }
  }, [userSession]);

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
    } catch (err) {
      console.error('Failed loading inventory data:', err);
    } finally {
      setLoading(false);
    }
  }, [search, gradeFilter, statusFilter, effectiveBranch]);

  useEffect(() => {
    if (userSession) {
      loadData();
    }
  }, [userSession, loadData]);

  const handleCreateBatch = async (dto: CreateSteelBatchDto) => {
    await createBatch(dto);
    await loadData();
  };

  const handleUpdateStatus = async (id: string, newStatus: BatchStatus) => {
    await updateBatchStatus(id, { status: newStatus });
    await loadData();
  };

  // Render Login Screen if user is not authenticated
  if (!userSession) {
    return <LoginScreen onLogin={setUserSession} />;
  }

  // Get current active tab human-readable title
  const getTabTitle = () => {
    switch (activeTab) {
      case 'inventory':
        return userSession.role === UserRole.Owner
          ? 'All Branches Steel Inventory'
          : `${userSession.branch} Branch Inventory Supervision`;
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
        onSelectTab={setActiveTab}
        selectedBranch={selectedBranch}
        onSelectBranch={setSelectedBranch}
        isLiveBackend={isLiveBackend}
        onRefresh={loadData}
        onLogout={() => setUserSession(null)}
      />

      {/* Main Workspace Area */}
      <main className="app-main">
        <Header
          isLiveBackend={isLiveBackend}
          userSession={userSession}
          activeTabTitle={getTabTitle()}
          onRefresh={loadData}
        />

        <div className="main-content">
          {/* TAB 1: POS VIEW (CASHIER ONLY) */}
          {activeTab === 'pos' && (
            <CashierPosView
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

          {/* TAB 4: MOCK LSTM DEMAND FORECASTING (OWNER ONLY) */}
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
