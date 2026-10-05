import { useState } from 'react';
import {
  FileCode,
  Search,
  Eye,
  X,
  Clock,
} from 'lucide-react';

interface AuditRecord {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  branch: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'APPROVE';
  entityName: string;
  entityId: string;
  ipAddress: string;
  beforeStateJson: string;
  afterStateJson: string;
}

const INITIAL_AUDIT_LOGS: AuditRecord[] = [
  {
    id: 'log-8001',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    userName: 'Maria Santos',
    userRole: 'BranchManager',
    branch: 'Davao',
    action: 'APPROVE',
    entityName: 'GoodsReturnSlip',
    entityId: 'grs-9002',
    ipAddress: '192.168.10.45',
    beforeStateJson: JSON.stringify(
      { grsNumber: 'GRS-2026-0088', status: 'Pending_Approval', creditNoteNumber: null },
      null,
      2
    ),
    afterStateJson: JSON.stringify(
      { grsNumber: 'GRS-2026-0088', status: 'Approved', creditNoteNumber: 'CN-2026-0033', approvedBy: 'Maria Santos' },
      null,
      2
    ),
  },
  {
    id: 'log-8002',
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    userName: 'System Admin',
    userRole: 'Owner',
    branch: 'Makati',
    action: 'UPDATE',
    entityName: 'CustomerReceivable',
    entityId: 'rec-003',
    ipAddress: '10.0.0.12',
    beforeStateJson: JSON.stringify(
      { customerName: 'Visayas Shipyard Yard', totalOutstandingPHP: 3700000, status: 'Credit Warning' },
      null,
      2
    ),
    afterStateJson: JSON.stringify(
      { customerName: 'Visayas Shipyard Yard', totalOutstandingPHP: 4200000, status: 'Credit Blocked', reason: 'Bounced Cheque #MBTC-3329011' },
      null,
      2
    ),
  },
  {
    id: 'log-8003',
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    userName: 'Juan Dela Cruz',
    userRole: 'Cashier',
    branch: 'Davao',
    action: 'INSERT',
    entityName: 'Sale',
    entityId: 'pos-8001',
    ipAddress: '192.168.10.12',
    beforeStateJson: 'null',
    afterStateJson: JSON.stringify(
      { invoiceNumber: 'INV-2026-0041', customerName: 'Mindanao Steelworks Corp.', totalAmountPHP: 4284, paymentMethod: 'Bank Transfer' },
      null,
      2
    ),
  },
];

export function AuditLogView() {
  const [logs] = useState<AuditRecord[]>(INITIAL_AUDIT_LOGS);
  const [search, setSearch] = useState<string>('');

  // Selected Log for Diff Viewing
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);

  const filteredLogs = logs.filter((l) =>
    l.userName.toLowerCase().includes(search.toLowerCase()) ||
    l.entityName.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.branch.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="view-container">
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ color: '#F8FAFC', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            System Audit Log & State Diff Inspection
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: '0.25rem 0 0 0' }}>
            Immutable trace log of all entity mutations, approvals, and user actions with side-by-side JSON diffs.
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="search-box" style={{ maxWidth: '400px', flex: 1 }}>
          <Search size={18} style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search user, entity, action, or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* TABLE WITH WHITE BACKGROUND */}
      <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '8px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #CBD5E1' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
              <th style={{ padding: '0.75rem 1rem' }}>User & Role</th>
              <th style={{ padding: '0.75rem 1rem' }}>Branch & IP</th>
              <th style={{ padding: '0.75rem 1rem' }}>Action</th>
              <th style={{ padding: '0.75rem 1rem' }}>Target Entity</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Diff Inspection</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((l) => (
              <tr key={l.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#0F172A', fontSize: '0.9rem', background: '#FFFFFF' }}>
                <td style={{ padding: '0.85rem 1rem', color: '#475569', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> {new Date(l.timestamp).toLocaleString()}
                  </div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{l.userName}</div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem' }}>{l.userRole}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <span className="branch-tag highlight">{l.branch}</span>
                  <div style={{ color: '#64748B', fontSize: '0.75rem', marginTop: '0.2rem' }}>{l.ipAddress}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <span
                    style={{
                      background: l.action === 'APPROVE' ? '#ECFDF5' : l.action === 'INSERT' ? '#EFF6FF' : '#FFFBEB',
                      color: l.action === 'APPROVE' ? '#047857' : l.action === 'INSERT' ? '#1D4ED8' : '#B45309',
                      border: `1px solid ${l.action === 'APPROVE' ? '#A7F3D0' : l.action === 'INSERT' ? '#BFDBFE' : '#FDE68A'}`,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {l.action}
                  </span>
                </td>

                <td style={{ padding: '0.85rem 1rem' }}>
                  <div style={{ fontWeight: 600, color: '#0284C7' }}>{l.entityName}</div>
                  <div style={{ color: '#64748B', fontSize: '0.75rem' }}>ID: {l.entityId}</div>
                </td>

                <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                    onClick={() => setSelectedLog(l)}
                  >
                    <Eye size={14} /> Compare Diff
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* JSON DIFF INSPECTION MODAL */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '850px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileCode size={20} /> Entity State Diff — {selectedLog.entityName} ({selectedLog.entityId})
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                  Mutated by {selectedLog.userName} ({selectedLog.userRole}) at {new Date(selectedLog.timestamp).toLocaleString()}
                </div>
              </div>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <div style={{ background: '#7F1D1D', color: '#FCA5A5', padding: '0.4rem 0.75rem', borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: '0.8rem' }}>
                  PREVIOUS STATE (BEFORE)
                </div>
                <pre style={{ background: '#0F172A', color: '#CBD5E1', padding: '1rem', borderRadius: '0 0 6px 6px', border: '1px solid #334155', borderTop: 'none', fontSize: '0.8rem', overflowX: 'auto', margin: 0 }}>
                  {selectedLog.beforeStateJson}
                </pre>
              </div>

              <div>
                <div style={{ background: '#065F46', color: '#6EE7B7', padding: '0.4rem 0.75rem', borderRadius: '6px 6px 0 0', fontWeight: 700, fontSize: '0.8rem' }}>
                  NEW MUTATED STATE (AFTER)
                </div>
                <pre style={{ background: '#0F172A', color: '#CBD5E1', padding: '1rem', borderRadius: '0 0 6px 6px', border: '1px solid #334155', borderTop: 'none', fontSize: '0.8rem', overflowX: 'auto', margin: 0 }}>
                  {selectedLog.afterStateJson}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
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
