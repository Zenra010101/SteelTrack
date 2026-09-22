import { Lock } from 'lucide-react';
import { PRESET_USERS } from '../types/auth';

export function SystemManagementView() {
  return (
    <div className="system-container">
      <div className="controls-bar">
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
            System Management & User Access Control (RBAC)
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
            System Settings, User Roles, and Branch Configuration
          </p>
        </div>
      </div>

      <div className="table-container" style={{ marginBottom: '2rem' }}>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Username</th>
              <th>Role</th>
              <th>Assigned Branch Scope</th>
              <th>Role Description</th>
              <th>Security Level</th>
            </tr>
          </thead>
          <tbody>
            {PRESET_USERS.map((user) => (
              <tr key={user.id}>
                <td style={{ fontWeight: 600 }}>{user.name}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}>{user.username}</td>
                <td>
                  <span className="badge badge-qualitycheck">{user.role}</span>
                </td>
                <td>
                  <span className="branch-tag highlight">
                    {user.branch ? `${user.branch} Branch` : 'All Branches (Owner)'}
                  </span>
                </td>
                <td style={{ fontSize: '0.85rem', color: '#334155' }}>{user.description}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Lock size={12} /> Active Policy
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
