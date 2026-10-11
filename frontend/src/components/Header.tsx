import { Server, Layers } from 'lucide-react';
import type { UserSession } from '../types/auth';

interface HeaderProps {
  isLiveBackend: boolean;
  userSession: UserSession;
  activeTabTitle: string;
  onRefresh?: () => void;
}

export function Header({
  isLiveBackend,
  userSession,
  activeTabTitle,
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
          {isLiveBackend ? 'Active' : 'Offline'}
        </div>
      </div>
    </header>
  );
}
