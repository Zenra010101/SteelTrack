import { useState, useEffect, useMemo } from 'react';
import {
  FileCode,
  Search,
  Eye,
  X,
  Clock,
  ShieldAlert,
  Database,
  Lock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { getAuthHeaders } from '../services/api';

export interface AuditRecord {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  userEmail?: string;
  branch: string;
  action: string;
  entityName: string;
  entityId: string;
  ipAddress: string;
  userAgent?: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  category: 'EntityMutation' | 'SecurityAccess';
  details?: string;
  beforeStateJson: string;
  afterStateJson: string;
}

export interface FieldDiff {
  fieldName: string;
  oldValue: string;
  newValue: string;
  diffType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
}

function computeObjectDiff(beforeJson: string, afterJson: string): FieldDiff[] {
  let beforeObj: Record<string, any> = {};
  let afterObj: Record<string, any> = {};

  try {
    if (beforeJson && beforeJson !== 'null' && beforeJson !== 'undefined') {
      beforeObj = JSON.parse(beforeJson);
    }
  } catch {
    beforeObj = { rawValue: beforeJson };
  }

  try {
    if (afterJson && afterJson !== 'null' && afterJson !== 'undefined') {
      afterObj = JSON.parse(afterJson);
    }
  } catch {
    afterObj = { rawValue: afterJson };
  }

  const allKeys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]));

  return allKeys.map((key) => {
    const hasOld = key in beforeObj;
    const hasNew = key in afterObj;
    const rawOld = beforeObj[key];
    const rawNew = afterObj[key];

    const formatVal = (v: any) => {
      if (v === null || v === undefined) return '—';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    };

    let diffType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED' = 'UNCHANGED';
    if (!hasOld && hasNew) diffType = 'ADDED';
    else if (hasOld && !hasNew) diffType = 'REMOVED';
    else if (JSON.stringify(rawOld) !== JSON.stringify(rawNew)) diffType = 'MODIFIED';

    return {
      fieldName: key,
      oldValue: formatVal(rawOld),
      newValue: formatVal(rawNew),
      diffType,
    };
  });
}

export function AuditLogView() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'EntityMutation' | 'SecurityAccess'>('EntityMutation');
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'SUCCESS' | 'FAILED' | 'WARNING'>('All');
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);

  // Diff inspection modal options
  const [diffViewMode, setDiffViewMode] = useState<'table' | 'json'>('table');
  const [showOnlyChanges, setShowOnlyChanges] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Live Backend Database Synchronization
  const syncWithBackend = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/auditlogs?pageSize=200', { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        const rawItems: any[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.data?.items)
          ? json.data.items
          : Array.isArray(json?.items)
          ? json.items
          : [];

        if (rawItems.length > 0) {
          const mapped: AuditRecord[] = rawItems.map((l: any) => {
            const isSecurity =
              l.category === 0 ||
              l.category === 'Security' ||
              (typeof l.action === 'string' && l.action.toLowerCase().includes('login')) ||
              (typeof l.action === 'string' && l.action.toLowerCase().includes('logout')) ||
              l.entityType === 'Security' ||
              l.entityType === 'Auth';

            const rawStatus = (l.status || 'SUCCESS').toUpperCase();
            const status: 'SUCCESS' | 'FAILED' | 'WARNING' =
              rawStatus.includes('FAIL') || rawStatus.includes('ERR')
                ? 'FAILED'
                : rawStatus.includes('WARN')
                ? 'WARNING'
                : 'SUCCESS';

            return {
              id: l.id,
              timestamp: l.createdAt,
              userName: l.userEmail || (l.userId ? `User #${String(l.userId).slice(0, 8)}` : 'System'),
              userRole: l.userEmail?.toLowerCase().includes('owner') ? 'Owner' : isSecurity ? 'Security' : 'User',
              userEmail: l.userEmail,
              branch: 'Enterprise',
              action: l.action || 'MUTATION',
              entityName: l.entityType || 'General',
              entityId: l.entityId || '—',
              ipAddress: l.ipAddress || '127.0.0.1',
              userAgent: l.userAgent || 'SteelTrack Client',
              status,
              category: isSecurity ? 'SecurityAccess' : 'EntityMutation',
              details: l.details || '',
              beforeStateJson: l.oldValue || 'null',
              afterStateJson: l.newValue || 'null',
            };
          });

          setLogs(mapped);
        }
      }
    } catch (err) {
      console.warn('Backend /api/auditlogs unreachable:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    syncWithBackend();
  }, []);

  // Filter logs by active sub-tab, search, and status
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (l.category !== activeTab) return false;
      if (statusFilter !== 'All' && l.status !== statusFilter) return false;

      const q = search.toLowerCase().trim();
      if (!q) return true;

      return (
        l.userName.toLowerCase().includes(q) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
        l.entityName.toLowerCase().includes(q) ||
        l.entityId.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.branch.toLowerCase().includes(q) ||
        l.ipAddress.includes(q) ||
        (l.details && l.details.toLowerCase().includes(q))
      );
    });
  }, [logs, activeTab, statusFilter, search]);

  // Computed field diffs for selected log
  const computedDiffs = useMemo(() => {
    if (!selectedLog) return [];
    const diffs = computeObjectDiff(selectedLog.beforeStateJson, selectedLog.afterStateJson);
    if (showOnlyChanges) {
      return diffs.filter((d) => d.diffType !== 'UNCHANGED');
    }
    return diffs;
  }, [selectedLog, showOnlyChanges]);

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Database size={24} style={{ color: '#38BDF8' }} />
            Enterprise Audit Log & State Diff Engine
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.88rem', margin: '0.25rem 0 0 0' }}>
            Immutable cryptographically verifiable audit trail of entity mutations, approvals, and security access telemetry.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn-secondary"
            onClick={syncWithBackend}
            disabled={isRefreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            {isRefreshing ? 'Syncing...' : 'Sync Logs'}
          </button>
          <button
            className="btn-secondary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Printer size={14} /> Export / Print
          </button>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #334155', marginBottom: '1.25rem', paddingBottom: '0.25rem' }}>
        <button
          onClick={() => setActiveTab('EntityMutation')}
          style={{
            background: activeTab === 'EntityMutation' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'EntityMutation' ? '#38BDF8' : '#94A3B8',
            border: activeTab === 'EntityMutation' ? '1px solid #38BDF8' : '1px solid transparent',
            padding: '0.55rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <FileCode size={16} />
          Entity Mutations & State Diffs
          <span style={{ background: '#334155', color: '#F8FAFC', padding: '0.1rem 0.45rem', borderRadius: '12px', fontSize: '0.75rem' }}>
            {logs.filter((l) => l.category === 'EntityMutation').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('SecurityAccess')}
          style={{
            background: activeTab === 'SecurityAccess' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            color: activeTab === 'SecurityAccess' ? '#34D399' : '#94A3B8',
            border: activeTab === 'SecurityAccess' ? '1px solid #10B981' : '1px solid transparent',
            padding: '0.55rem 1rem',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Lock size={16} />
          Security & Access Logs
          <span style={{ background: '#334155', color: '#F8FAFC', padding: '0.1rem 0.45rem', borderRadius: '12px', fontSize: '0.75rem' }}>
            {logs.filter((l) => l.category === 'SecurityAccess').length}
          </span>
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
        <div className="search-box" style={{ maxWidth: '450px', flex: 1 }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder={
              activeTab === 'EntityMutation'
                ? 'Search entity, action, user, or ID...'
                : 'Search user email, IP address, device, or security action...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600 }}>Status:</span>
          {(['All', 'SUCCESS', 'WARNING', 'FAILED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? '#334155' : 'transparent',
                color: statusFilter === st ? '#F8FAFC' : '#94A3B8',
                border: '1px solid #475569',
                padding: '0.3rem 0.65rem',
                borderRadius: '4px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: statusFilter === st ? 700 : 500,
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
              <th style={{ padding: '0.75rem 1rem' }}>Operator / Identity</th>
              <th style={{ padding: '0.75rem 1rem' }}>{activeTab === 'EntityMutation' ? 'Branch & IP' : 'Origin IP & Device'}</th>
              <th style={{ padding: '0.75rem 1rem' }}>Action / Event</th>
              <th style={{ padding: '0.75rem 1rem' }}>{activeTab === 'EntityMutation' ? 'Target Entity' : 'Details / Remarks'}</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Inspection</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748B' }}>
                  No audit records match the current filter criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                  {/* Timestamp */}
                  <td style={{ padding: '0.85rem 1rem', color: '#475569', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Clock size={13} style={{ color: '#64748B' }} /> {new Date(l.timestamp).toLocaleString()}
                    </div>
                  </td>

                  {/* Operator */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{l.userName}</div>
                    <div style={{ color: '#64748B', fontSize: '0.75rem' }}>
                      {l.userEmail ? l.userEmail : l.userRole}
                    </div>
                  </td>

                  {/* Branch / IP / Device */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    {activeTab === 'EntityMutation' ? (
                      <>
                        <span className="branch-tag highlight">{l.branch}</span>
                        <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.2rem' }}>{l.ipAddress}</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.82rem' }}>{l.ipAddress}</div>
                        <div style={{ color: '#64748B', fontSize: '0.72rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.userAgent || 'Web Client'}
                        </div>
                      </>
                    )}
                  </td>

                  {/* Action Badge */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    <span
                      style={{
                        background:
                          l.status === 'FAILED'
                            ? '#FEF2F2'
                            : l.status === 'WARNING'
                            ? '#FFFBEB'
                            : l.action === 'APPROVE'
                            ? '#ECFDF5'
                            : l.action === 'INSERT'
                            ? '#EFF6FF'
                            : '#F1F5F9',
                        color:
                          l.status === 'FAILED'
                            ? '#DC2626'
                            : l.status === 'WARNING'
                            ? '#D97706'
                            : l.action === 'APPROVE'
                            ? '#047857'
                            : l.action === 'INSERT'
                            ? '#1D4ED8'
                            : '#334155',
                        border: `1px solid ${
                          l.status === 'FAILED'
                            ? '#FCA5A5'
                            : l.status === 'WARNING'
                            ? '#FDE68A'
                            : l.action === 'APPROVE'
                            ? '#A7F3D0'
                            : l.action === 'INSERT'
                            ? '#BFDBFE'
                            : '#CBD5E1'
                        }`,
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      {l.status === 'FAILED' && <ShieldAlert size={12} />}
                      {l.status === 'SUCCESS' && <CheckCircle2 size={12} />}
                      {l.status === 'WARNING' && <AlertTriangle size={12} />}
                      {l.action}
                    </span>
                  </td>

                  {/* Target Entity / Details */}
                  <td style={{ padding: '0.85rem 1rem' }}>
                    {activeTab === 'EntityMutation' ? (
                      <>
                        <div style={{ fontWeight: 600, color: '#0284C7' }}>{l.entityName}</div>
                        <div style={{ color: '#64748B', fontSize: '0.75rem' }}>ID: {l.entityId}</div>
                        {l.details && (
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>{l.details}</div>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: '0.85rem', color: '#1E293B', fontWeight: 500 }}>
                          {l.details || 'Security event logged'}
                        </div>
                        <div style={{ color: '#64748B', fontSize: '0.75rem' }}>Ref: {l.entityId}</div>
                      </>
                    )}
                  </td>

                  {/* Diff Inspection Action */}
                  <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                    <button
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      onClick={() => setSelectedLog(l)}
                    >
                      <Eye size={14} /> Compare Diff
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* HUMAN-READABLE VISUAL DIFF INSPECTION MODAL */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '12px', border: '1px solid #334155', width: '100%', maxWidth: '900px', padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.85rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCode size={22} />
                  Mutation Audit Trail: {selectedLog.entityName} ({selectedLog.entityId})
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginTop: '0.3rem' }}>
                  Mutated by <strong>{selectedLog.userName}</strong> ({selectedLog.userRole}) at{' '}
                  {new Date(selectedLog.timestamp).toLocaleString()} • IP: {selectedLog.ipAddress}
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* View Controls & Filter */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: '#0F172A', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setDiffViewMode('table')}
                  style={{
                    background: diffViewMode === 'table' ? '#0284C7' : 'transparent',
                    color: '#F8FAFC',
                    border: 'none',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Visual Field Diff Table
                </button>
                <button
                  onClick={() => setDiffViewMode('json')}
                  style={{
                    background: diffViewMode === 'json' ? '#0284C7' : 'transparent',
                    color: '#F8FAFC',
                    border: 'none',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Raw JSON Code View
                </button>
              </div>

              {diffViewMode === 'table' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: '#CBD5E1', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showOnlyChanges}
                    onChange={(e) => setShowOnlyChanges(e.target.checked)}
                  />
                  Show only modified / changed fields
                </label>
              )}
            </div>

            {/* DIFF PRESENTATION */}
            {diffViewMode === 'table' ? (
              <div style={{ background: '#0F172A', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', color: '#94A3B8', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '0.65rem 1rem' }}>Field Name</th>
                      <th style={{ padding: '0.65rem 1rem' }}>Previous Value (Before)</th>
                      <th style={{ padding: '0.65rem 1rem' }}>New Mutated Value (After)</th>
                      <th style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>Change Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedDiffs.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                          No modified fields found between before and after states.
                        </td>
                      </tr>
                    ) : (
                      computedDiffs.map((d, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #1E293B',
                            background:
                              d.diffType === 'ADDED'
                                ? 'rgba(16, 185, 129, 0.08)'
                                : d.diffType === 'MODIFIED'
                                ? 'rgba(217, 119, 6, 0.08)'
                                : d.diffType === 'REMOVED'
                                ? 'rgba(239, 68, 68, 0.08)'
                                : 'transparent',
                          }}
                        >
                          {/* Field Name */}
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#F1F5F9' }}>
                            {d.fieldName}
                          </td>

                          {/* Previous Value */}
                          <td style={{ padding: '0.75rem 1rem', color: d.diffType === 'MODIFIED' || d.diffType === 'REMOVED' ? '#FCA5A5' : '#94A3B8', fontFamily: 'monospace' }}>
                            {d.oldValue}
                          </td>

                          {/* New Value */}
                          <td style={{ padding: '0.75rem 1rem', color: d.diffType === 'MODIFIED' || d.diffType === 'ADDED' ? '#6EE7B7' : '#94A3B8', fontWeight: d.diffType !== 'UNCHANGED' ? 600 : 400, fontFamily: 'monospace' }}>
                            {d.newValue}
                          </td>

                          {/* Change Type Badge */}
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span
                              style={{
                                background:
                                  d.diffType === 'ADDED'
                                    ? '#065F46'
                                    : d.diffType === 'MODIFIED'
                                    ? '#78350F'
                                    : d.diffType === 'REMOVED'
                                    ? '#7F1D1D'
                                    : '#334155',
                                color:
                                  d.diffType === 'ADDED'
                                    ? '#6EE7B7'
                                    : d.diffType === 'MODIFIED'
                                    ? '#FDE68A'
                                    : d.diffType === 'REMOVED'
                                    ? '#FCA5A5'
                                    : '#94A3B8',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                              }}
                            >
                              {d.diffType}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* RAW JSON CODE VIEW */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ background: '#7F1D1D', color: '#FCA5A5', padding: '0.4rem 0.75rem', borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: '0.8rem' }}>
                    PREVIOUS STATE (BEFORE)
                  </div>
                  <pre style={{ background: '#0F172A', color: '#CBD5E1', padding: '1rem', borderRadius: '0 0 6px 6px', border: '1px solid #334155', borderTop: 'none', fontSize: '0.8rem', overflowX: 'auto', margin: 0, maxHeight: '350px' }}>
                    {selectedLog.beforeStateJson}
                  </pre>
                </div>

                <div>
                  <div style={{ background: '#065F46', color: '#6EE7B7', padding: '0.4rem 0.75rem', borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: '0.8rem' }}>
                    NEW MUTATED STATE (AFTER)
                  </div>
                  <pre style={{ background: '#0F172A', color: '#CBD5E1', padding: '1rem', borderRadius: '0 0 6px 6px', border: '1px solid #334155', borderTop: 'none', fontSize: '0.8rem', overflowX: 'auto', margin: 0, maxHeight: '350px' }}>
                    {selectedLog.afterStateJson}
                  </pre>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem' }}>
              <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
                Event Log ID: <span style={{ fontFamily: 'monospace' }}>{selectedLog.id}</span>
              </div>
              <button className="btn-secondary" onClick={() => setSelectedLog(null)}>
                Close Diff Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
