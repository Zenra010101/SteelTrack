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
  UserPlus,
  ShieldAlert,
} from 'lucide-react';
import { UserRole, BranchLocation } from '../types/auth';
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
            {staffUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                  No staff users found in database. Click <strong>Add Staff User</strong> to create one.
                </td>
              </tr>
            ) : (
              staffUsers.map((user) => (
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT BRANCH MODAL */}
      {editingBranch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '12px', border: '1px solid #334155', width: '90%', maxWidth: '520px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
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
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Branch Code</label>
                  <input
                    type="text"
                    disabled
                    value={editingBranch.code}
                    style={{ width: '100%', background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Branch Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Physical Facility Address</label>
                <input
                  type="text"
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Contact Phone / Landline</label>
                  <input
                    type="text"
                    value={editContact}
                    onChange={(e) => setEditContact(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Branch Manager Name</label>
                  <select
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.35rem' }}
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
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.45rem', borderRadius: '4px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ color: '#475569', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>Operational Status</label>
                <select
                  value={editIsActive ? 'true' : 'false'}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.6rem', borderRadius: '6px' }}
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
          <div style={{ background: '#FFFFFF', color: '#0F172A', borderRadius: '12px', border: '1px solid #CBD5E1', width: '90%', maxWidth: '480px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserPlus size={18} color="#0284C7" /> Add Staff User Account
              </h3>
              <button onClick={() => setIsAddUserModalOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gabriel Alcantara"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Email / Login Username</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. g.alcantara@steeltrack.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Initial Temporary Password</label>
                <input
                  type="text"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', fontFamily: 'JetBrains Mono' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Assigned Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px' }}
                  >
                    <option value={UserRole.Cashier}>Cashier</option>
                    <option value={UserRole.BranchManager}>Branch Manager</option>
                    <option value={UserRole.Owner}>Owner / Executive</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#475569', fontSize: '0.75rem', marginBottom: '0.25rem', fontWeight: 600 }}>Facility Branch</label>
                  <select
                    disabled={newUserRole === UserRole.Owner}
                    value={newUserBranch}
                    onChange={(e) => setNewUserBranch(e.target.value as BranchLocation)}
                    style={{ width: '100%', background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A', padding: '0.55rem', borderRadius: '6px', opacity: newUserRole === UserRole.Owner ? 0.5 : 1 }}
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
