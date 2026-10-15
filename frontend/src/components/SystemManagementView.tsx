import { useState, useEffect } from 'react';
import {
  Lock,
  Building2,
  Edit2,
  CheckCircle2,
  X,
  Phone,
  MapPin,
  UserCheck,
  Database,
  RefreshCw,
  AlertCircle,
  UserPlus,
  ShieldAlert,
} from 'lucide-react';
import { PRESET_USERS, UserRole, BranchLocation } from '../types/auth';
import type { BranchRecord } from '../types/branch';
import {
  fetchBranches,
  updateBranch,
  fetchStaffUsers,
  createStaffUser,
  toggleStaffUserStatus,
  type StaffUser,
} from '../services/api';

export function SystemManagementView() {
  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editManager, setEditManager] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Staff Users State
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [userSuccessMsg, setUserSuccessMsg] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('SteelTrack@2026');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.Cashier);
  const [newUserBranch, setNewUserBranch] = useState<BranchLocation>(BranchLocation.Davao);

  // Database Seeder State
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ message: string; counts?: Record<string, number> } | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
    loadStaffUsers();
  }, []);

  const loadBranches = async () => {
    const data = await fetchBranches();
    setBranches(data);
  };

  const loadStaffUsers = async () => {
    const data = await fetchStaffUsers();
    setStaffUsers(data);
  };

  const handleTriggerSeed = async () => {
    if (!confirm('Run the SteelTrack database seeder? This will populate the 645 steel products, 4 branches, 52 user accounts, and 50+ operational records.')) {
      return;
    }
    setIsSeeding(true);
    setSeedResult(null);
    setSeedError(null);
    try {
      const res = await fetch('/api/admin/seed', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Seeder request failed with HTTP ${res.status}`);
      }
      const data = await res.json();
      setSeedResult(data);
      await loadBranches();
    } catch (err: any) {
      setSeedError(err.message || 'Failed to trigger database seeder.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenEdit = (branch: BranchRecord) => {
    setEditingBranch(branch);
    setEditName(branch.name);
    setEditAddress(branch.address || '');
    setEditContact(branch.contactNumber || '');
    setEditManager(branch.managerName || '');
    setEditIsActive(branch.isActive);
    setSaveSuccessMsg('');
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    const updated = await updateBranch(editingBranch.id, {
      name: editName,
      address: editAddress,
      contactNumber: editContact,
      managerName: editManager,
      isActive: editIsActive,
    });

    if (updated) {
      setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      setSaveSuccessMsg(`Branch "${updated.name}" updated successfully.`);
      setTimeout(() => {
        setEditingBranch(null);
        setSaveSuccessMsg('');
      }, 1200);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await createStaffUser({
      fullName: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      password: newUserPassword,
      roleName: newUserRole,
      branchName: newUserRole === UserRole.Owner ? undefined : newUserBranch,
      isActive: true,
    });

    if (created) {
      setUserSuccessMsg(`Account for "${created.fullName}" created successfully.`);
      setIsAddUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      await loadStaffUsers();
      setTimeout(() => setUserSuccessMsg(''), 2500);
    }
  };

  const handleToggleUser = async (userId: string) => {
    await toggleStaffUserStatus(userId);
    await loadStaffUsers();
  };

  return (
    <div className="system-container">
      {/* 1. Branch Network Management Section */}
      <div className="controls-bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0284C7', marginBottom: '0.25rem', fontWeight: 600 }}>
            <Building2 size={18} /> Operational Branch Network
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Branch Management & Facilities Configuration
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>
            Configure and maintain operational hubs (Davao, Mandaue, Cebu, Cagayan) across the enterprise
          </p>
        </div>
      </div>

      <div className="table-container" style={{ marginBottom: '2.5rem' }}>
        <table>
          <thead>
            <tr>
              <th>Branch Code</th>
              <th>Branch Name</th>
              <th>Physical Facility Address</th>
              <th>Contact Number</th>
              <th>Branch Manager</th>
              <th>Operating Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#0284C7', fontWeight: 700 }}>
                  {b.code}
                </td>
                <td style={{ fontWeight: 600, color: '#0F172A' }}>{b.name} Branch</td>
                <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MapPin size={12} style={{ color: '#94A3B8' }} /> {b.address || '—'}
                  </div>
                </td>
                <td style={{ fontSize: '0.85rem', color: '#475569', fontFamily: 'JetBrains Mono' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={12} style={{ color: '#94A3B8' }} /> {b.contactNumber || '—'}
                  </div>
                </td>
                <td style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <UserCheck size={13} style={{ color: '#0284C7' }} /> {b.managerName || 'Unassigned'}
                  </div>
                </td>
                <td>
                  {b.isActive ? (
                    <span className="badge badge-available">
                      <CheckCircle2 size={12} style={{ marginRight: 4 }} /> Active Facility
                    </span>
                  ) : (
                    <span className="badge badge-inproduction">Maintenance</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', gap: '0.25rem' }}
                    onClick={() => handleOpenEdit(b)}
                  >
                    <Edit2 size={12} /> Edit Branch
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. User Access & Role Scopes Section */}
      <div className="controls-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0284C7', marginBottom: '0.25rem', fontWeight: 600 }}>
            <Lock size={18} /> Role-Based Access Control (RBAC) & Accounts
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Staff User Directory & Authorization Control
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>
            Authorized Owner, Branch Manager, and Cashier operational credentials linked to database
          </p>
        </div>

        <button
          className="btn-primary"
          onClick={() => setIsAddUserModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.95rem' }}
        >
          <UserPlus size={16} /> Add New Account
        </button>
      </div>

      {userSuccessMsg && (
        <div style={{ background: 'rgba(5, 150, 105, 0.2)', border: '1px solid #059669', color: '#34D399', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle2 size={16} /> {userSuccessMsg}
        </div>
      )}

      <div className="table-container" style={{ marginBottom: '2rem' }}>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Username / Email</th>
              <th>Role</th>
              <th>Assigned Branch Scope</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(staffUsers.length > 0 ? staffUsers : PRESET_USERS.map((p) => ({
              id: p.id,
              fullName: p.name,
              email: p.username,
              roleName: p.role,
              branchName: p.branch,
              isActive: true,
              createdAt: '2026-01-01',
            }))).map((user) => (
              <tr key={user.id}>
                <td style={{ fontWeight: 600 }}>{user.fullName}</td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}>{user.email}</td>
                <td>
                  <span className="badge badge-qualitycheck">{user.roleName}</span>
                </td>
                <td>
                  <span className="branch-tag highlight">
                    {user.branchName ? `${user.branchName} Branch` : 'All Branches (Enterprise)'}
                  </span>
                </td>
                <td>
                  {user.isActive ? (
                    <span style={{ color: '#059669', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={13} /> Active
                    </span>
                  ) : (
                    <span style={{ color: '#DC2626', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ShieldAlert size={13} /> Suspended
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => handleToggleUser(user.id)}
                    style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Database Seeder & Live Enterprise Provisioning Section */}
      <div className="controls-bar" style={{ marginTop: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#0284C7', marginBottom: '0.25rem', fontWeight: 600 }}>
            <Database size={18} /> Database Seeder & Live Provisioning
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            Enterprise Data Initialization & Verification
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94A3B8', margin: '0.25rem 0 0' }}>
            Populate or re-sync the PostgreSQL database with 645 imported steel products, 4 branches, 52 user accounts, and 50+ records for all operational tables.
          </p>
        </div>
      </div>

      <div style={{
        background: '#1E293B',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '2.5rem',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#F8FAFC', fontWeight: 600 }}>
              One-Click Database Seeder
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94A3B8', maxWidth: '650px', lineHeight: 1.5 }}>
              Executes the comprehensive SQL seeding script directly against your connected database (Local PostgreSQL or MonsterASP host). Validates table constraints and displays record counts.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="btn-primary"
              disabled={isSeeding}
              onClick={handleTriggerSeed}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.9rem' }}
            >
              {isSeeding ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Seeding Database...
                </>
              ) : (
                <>
                  <Database size={16} /> Seed Database Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Seed Result Stats */}
        {seedResult && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #059669', borderRadius: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10B981', fontWeight: 600, marginBottom: '0.5rem' }}>
              <CheckCircle2 size={18} /> {seedResult.message}
            </div>
            {seedResult.counts && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {Object.entries(seedResult.counts).map(([tbl, count]) => (
                  <span
                    key={tbl}
                    style={{
                      background: '#0F172A',
                      border: '1px solid #334155',
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#E2E8F0'
                    }}
                  >
                    <strong style={{ color: '#38BDF8' }}>{tbl}:</strong> {count} records
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seed Error Banner */}
        {seedError && (
          <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #DC2626', borderRadius: '8px', color: '#F87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span><strong>Seeding Error:</strong> {seedError}</span>
          </div>
        )}
      </div>

      {/* EDIT BRANCH MODAL */}
      {editingBranch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '520px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Edit Branch Facility: {editingBranch.name} ({editingBranch.code})
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Update operational details and facility management parameters</span>
              </div>
              <button
                onClick={() => setEditingBranch(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {saveSuccessMsg && (
              <div style={{ background: 'rgba(5, 150, 105, 0.2)', border: '1px solid #059669', color: '#34D399', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} /> {saveSuccessMsg}
              </div>
            )}

            <form onSubmit={handleSaveBranch}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Branch Code</label>
                  <input
                    type="text"
                    disabled
                    value={editingBranch.code}
                    style={{ width: '100%', background: '#0B132B', border: '1px solid #1E293B', color: '#64748B', padding: '0.6rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Branch Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Physical Facility Address</label>
                <input
                  type="text"
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Contact Phone / Landline</label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Branch Manager Name</label>
                  <select
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.35rem' }}
                  >
                    <option value="">Select registered Branch Manager...</option>
                    {staffUsers
                      .filter((u) => u.roleName === 'BranchManager')
                      .map((m) => (
                        <option key={m.id} value={m.fullName}>
                          {m.fullName} ({m.branchName || 'Unassigned'})
                        </option>
                      ))}
                    {editManager && !staffUsers.some((u) => u.fullName === editManager) && (
                      <option value={editManager}>{editManager} (Current / Custom)</option>
                    )}
                  </select>
                  <input
                    type="text"
                    placeholder="Or type custom manager name..."
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.45rem', borderRadius: '4px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ color: '#94A3B8', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' }}>Operational Status</label>
                <select
                  value={editIsActive ? 'true' : 'false'}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.6rem', borderRadius: '6px' }}
                >
                  <option value="true">Active Facility (Open for Operations)</option>
                  <option value="false">Maintenance / Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingBranch(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Branch Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STAFF ACCOUNT MODAL */}
      {isAddUserModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1E293B', color: '#F8FAFC', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '480px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} color="#38BDF8" /> Add Staff User Account
              </h3>
              <button onClick={() => setIsAddUserModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gabriel Alcantara"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Email / Login Username</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. g.alcantara@steeltrack.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Initial Temporary Password</label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Assigned Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px' }}
                  >
                    <option value={UserRole.Cashier}>Cashier</option>
                    <option value={UserRole.BranchManager}>Branch Manager</option>
                    <option value={UserRole.Owner}>Owner / Executive</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Facility Branch</label>
                  <select
                    disabled={newUserRole === UserRole.Owner}
                    value={newUserBranch}
                    onChange={(e) => setNewUserBranch(e.target.value as BranchLocation)}
                    style={{ width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F8FAFC', padding: '0.55rem', borderRadius: '6px', opacity: newUserRole === UserRole.Owner ? 0.5 : 1 }}
                  >
                    <option value={BranchLocation.Davao}>Davao Branch</option>
                    <option value={BranchLocation.Cagayan}>Cagayan Branch</option>
                    <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
                    <option value={BranchLocation.Cebu}>Cebu Branch</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddUserModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
