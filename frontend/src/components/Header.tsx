import { Server, RefreshCw, Layers } from 'lucide-react';
import type { UserSession } from '../types/auth';

interface HeaderProps {
  isLiveBackend: boolean;
  userSession: UserSession;
  activeTabTitle: string;
  onRefresh: () => void;
}

export function Header({
  isLiveBackend,
  userSession,
  activeTabTitle,
  onRefresh,
}: HeaderProps) {
  return (
    <header className="header-topbar">
      <div className="topbar-breadcrumb">
        <div className="breadcrumb-icon">
          <Layers size={18} />
        </div>
        <div>
          <h2 className="breadcrumb-title">{activeTabTitle}</h2>
          <div className="breadcrumb-sub">
            {userSession.role} Portal • {userSession.branch ? `${userSession.branch} Branch` : 'All Branches'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div className={`status-pill ${isLiveBackend ? '' : 'offline'}`}>
          <div className="dot" />
          <Server size={14} />
          {isLiveBackend ? 'C# API Connected' : 'Client State Mode'}
        </div>

        <button className="btn-secondary" onClick={onRefresh} title="Sync Server Data">
          <RefreshCw size={14} />
          Sync
        </button>
      </div>
    </header>
  );
}
