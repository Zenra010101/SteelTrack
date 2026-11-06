import { useState } from 'react';
import { Server, Layers, RefreshCw } from 'lucide-react';
import type { UserSession } from '../types/auth';

interface HeaderProps {
  userSession: UserSession;
  activeTabTitle: string;
  onRefresh?: () => Promise<void> | void;
  lastRefreshedAt?: Date;
}

export function Header({
  userSession,
  activeTabTitle,
  onRefresh,
  lastRefreshedAt,
}: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        {onRefresh && (
          <button
            onClick={handleManualRefresh}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.78rem',
              borderRadius: '6px',
            }}
            title="Refresh database records"
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin-icon' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Now'}</span>
            {lastRefreshedAt && (
              <span style={{ color: '#64748B', fontSize: '0.72rem', marginLeft: '0.2rem' }}>
                ({lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
              </span>
            )}
          </button>
        )}

        <div className="status-pill">
          <div className="dot" />
          <Server size={14} />
          Active Database
        </div>
      </div>
    </header>
  );
}
