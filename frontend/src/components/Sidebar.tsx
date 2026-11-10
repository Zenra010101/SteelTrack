import { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  Package,
  TrendingUp,
  ArrowRightLeft,
  ShoppingCart,
  Receipt,
  BarChart3,
  ShieldCheck,
  Building2,
  User,
  LogOut,
  Server,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  CreditCard,
  RotateCcw,
  Truck,
  Users,
  FileCode,
} from 'lucide-react';
import { UserRole, BranchLocation, type UserSession } from '../types/auth';

interface SidebarProps {
  userSession: UserSession;
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
  onRefresh?: () => void;
  onLogout: () => void;
}

export function Sidebar({
  userSession,
  activeTab,
  onSelectTab,
  selectedBranch,
  onSelectBranch,
  onLogout,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const getRoleIcon = () => {
    switch (userSession.role) {
      case UserRole.Owner:
        return <ShieldCheck size={16} style={{ color: '#38BDF8' }} />;
      case UserRole.BranchManager:
        return <Building2 size={16} style={{ color: '#F59E0B' }} />;
      case UserRole.Cashier:
        return <User size={16} style={{ color: '#10B981' }} />;
    }
  };

  return (
    <aside className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header & Brand */}
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Layers size={22} />
        </div>
        {!isCollapsed && (
          <div className="brand-text">
            <h2 className="brand-name">SteelTrack</h2>
            <div className="brand-tagline">Enterprise RBAC Hub</div>
          </div>
        )}
        <button
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Role Badge Indicator */}
      {!isCollapsed && (
        <div className="sidebar-role-badge">
          {getRoleIcon()}
          <span className="role-label">{userSession.role} Workspace</span>
        </div>
      )}

      {/* Owner Branch Switcher Widget */}
      {!isCollapsed && userSession.role === UserRole.Owner && (
        <div className="sidebar-branch-widget">
          <label className="widget-label">Executive Scope (All Branches):</label>
          <select
            value={selectedBranch}
            onChange={(e) => onSelectBranch(e.target.value)}
            className="branch-select"
          >
            <option value="All">All 4 Branches Combined</option>
            <option value={BranchLocation.Davao}>Davao Branch</option>
            <option value={BranchLocation.Cagayan}>Cagayan Branch</option>
            <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
            <option value={BranchLocation.Cebu}>Cebu Branch</option>
          </select>
        </div>
      )}

      {/* Navigation Menu Links */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">{!isCollapsed && 'MENU NAVIGATION'}</div>

        {/* OWNER MENU */}
        {userSession.role === UserRole.Owner && (
          <>
            <button
              className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSelectTab('dashboard')}
              title="Executive Dashboard"
            >
              <LayoutDashboard size={18} />
              {!isCollapsed && <span>Dashboard</span>}
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => onSelectTab('inventory')}
              title="Branch Products Dashboard"
            >
              <Layers size={18} />
              {!isCollapsed && <span>Branch Products</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => onSelectTab('products')}
              title="Products Master Catalog"
            >
              <Package size={18} />
              {!isCollapsed && <span>Products Catalog</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'receivables' ? 'active' : ''}`}
              onClick={() => onSelectTab('receivables')}
              title="Accounts Receivable"
            >
              <DollarSign size={18} />
              {!isCollapsed && <span>Accounts Receivable (A/R)</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'cheques' ? 'active' : ''}`}
              onClick={() => onSelectTab('cheques')}
              title="PDC Cheque Register"
            >
              <CreditCard size={18} />
              {!isCollapsed && <span>Cheques & PDC</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'returns' ? 'active' : ''}`}
              onClick={() => onSelectTab('returns')}
              title="Goods Return Slips (GRS)"
            >
              <RotateCcw size={18} />
              {!isCollapsed && <span>Goods Returns (GRS)</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'suppliers' ? 'active' : ''}`}
              onClick={() => onSelectTab('suppliers')}
              title="Suppliers & Certifications"
            >
              <Truck size={18} />
              {!isCollapsed && <span>Suppliers & MTC</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'customers' ? 'active' : ''}`}
              onClick={() => onSelectTab('customers')}
              title="Customer Directory"
            >
              <Users size={18} />
              {!isCollapsed && <span>Customer Directory</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => onSelectTab('audit')}
              title="Audit Logs & Diffs"
            >
              <FileCode size={18} />
              {!isCollapsed && <span>Audit Logs & Diffs</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'forecast' ? 'active' : ''}`}
              onClick={() => onSelectTab('forecast')}
              title="LSTM Demand Forecast"
            >
              <TrendingUp size={18} />
              {!isCollapsed && <span>LSTM AI Demand Forecast</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'transfers' ? 'active' : ''}`}
              onClick={() => onSelectTab('transfers')}
              title="Inter-Branch Transfers"
            >
              <ArrowRightLeft size={18} />
              {!isCollapsed && <span>Inter-Branch Transfers</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => onSelectTab('analytics')}
              title="Cross-Branch Analytics"
            >
              <BarChart3 size={18} />
              {!isCollapsed && <span>Cross-Branch Analytics</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => onSelectTab('system')}
              title="System Settings"
            >
              <Sliders size={18} />
              {!isCollapsed && <span>System Management</span>}
            </button>
          </>
        )}

        {/* BRANCH MANAGER MENU */}
        {userSession.role === UserRole.BranchManager && (
          <>
            <button
              className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSelectTab('dashboard')}
              title="Branch Dashboard"
            >
              <LayoutDashboard size={18} />
              {!isCollapsed && <span>Dashboard</span>}
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => onSelectTab('inventory')}
              title="Branch Products Catalog & Specs"
            >
              <Layers size={18} />
              {!isCollapsed && <span>Branch Products</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => onSelectTab('products')}
              title="Products Catalog & Specs"
            >
              <Package size={18} />
              {!isCollapsed && <span>Products Catalog</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'receivables' ? 'active' : ''}`}
              onClick={() => onSelectTab('receivables')}
              title="Branch Accounts Receivable"
            >
              <DollarSign size={18} />
              {!isCollapsed && <span>Branch A/R & Credit</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'cheques' ? 'active' : ''}`}
              onClick={() => onSelectTab('cheques')}
              title="PDC Cheque Register"
            >
              <CreditCard size={18} />
              {!isCollapsed && <span>Cheques & PDC</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'transfers' ? 'active' : ''}`}
              onClick={() => onSelectTab('transfers')}
              title="Stock Transfers & Approvals"
            >
              <ArrowRightLeft size={18} />
              {!isCollapsed && <span>Transfers & Approvals</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => onSelectTab('approvals')}
              title="Branch Quality Approvals"
            >
              <ClipboardCheck size={18} />
              {!isCollapsed && <span>Quality & Approvals</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'system' ? 'active' : ''}`}
              onClick={() => onSelectTab('system')}
              title="Branch Staff & User Accounts"
            >
              <Users size={18} />
              {!isCollapsed && <span>Branch Staff</span>}
            </button>
          </>
        )}

        {/* CASHIER MENU */}
        {userSession.role === UserRole.Cashier && (
          <>
            <button
              className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => onSelectTab('dashboard')}
              title="Cashier Dashboard"
            >
              <LayoutDashboard size={18} />
              {!isCollapsed && <span>Dashboard</span>}
            </button>
            <button
              className={`sidebar-nav-item ${activeTab === 'pos' ? 'active' : ''}`}
              onClick={() => onSelectTab('pos')}
              title="Point of Sale (POS)"
            >
              <ShoppingCart size={18} />
              {!isCollapsed && <span>Point of Sale (POS)</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'sales-history' ? 'active' : ''}`}
              onClick={() => onSelectTab('sales-history')}
              title="Sales History & Receipts"
            >
              <Receipt size={18} />
              {!isCollapsed && <span>Sales History</span>}
            </button>

            <button
              className={`sidebar-nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => onSelectTab('inventory')}
              title="Branch Stock Lookup"
            >
              <Layers size={18} />
              {!isCollapsed && <span>Available Stock Lookup</span>}
            </button>
          </>
        )}
      </nav>

      {/* Sidebar Footer User Profile Card */}
      <div className="sidebar-footer">
        {!isCollapsed ? (
          <div className="user-profile-card">
            <div className="profile-info">
              <div className="user-avatar-sm">{userSession.name.charAt(0)}</div>
              <div className="user-details">
                <div className="user-fullname">{userSession.name}</div>
                <div className="user-sub">
                  {userSession.branch ? `${userSession.branch} Branch` : 'All Branches (Owner)'}
                </div>
              </div>
            </div>

            <div className="profile-actions">
              <div className="status-dot-pill" title="Backend API status">
                <Server size={12} />
                Live
              </div>

              <button className="btn-icon logout" onClick={onLogout} title="Sign Out">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-icon logout centered" onClick={onLogout} title="Sign Out">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
