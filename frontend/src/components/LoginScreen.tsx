import { useState } from 'react';
import { Layers, ShieldCheck, Building2, User, KeyRound, ArrowRight, Sparkles } from 'lucide-react';
import { UserRole, BranchLocation, PRESET_USERS, type UserSession, type PresetAccount } from '../types/auth';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.Owner);
  const [selectedBranch, setSelectedBranch] = useState<BranchLocation>(BranchLocation.Davao);
  const [username, setUsername] = useState<string>('owner@steeltrack.com');
  const [password, setPassword] = useState<string>('••••••••');

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    // Update default username according to role
    const preset = PRESET_USERS.find((p) => p.role === role);
    if (preset) {
      setUsername(preset.username);
      if (preset.branch) setSelectedBranch(preset.branch);
    }
  };

  const handlePresetSelect = (preset: PresetAccount) => {
    onLogin({
      username: preset.username,
      name: preset.name,
      role: preset.role,
      branch: preset.branch,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const presetMatch = PRESET_USERS.find(
      (p) => p.username.toLowerCase() === username.toLowerCase()
    );

    const session: UserSession = {
      username: username || 'user@steeltrack.com',
      name: presetMatch ? presetMatch.name : username.split('@')[0] || 'User',
      role: selectedRole,
      branch: selectedRole === UserRole.Owner ? undefined : selectedBranch,
    };

    onLogin(session);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon-lg">
            <Layers size={32} />
          </div>
          <h2>SteelTrack Enterprise</h2>
          <p className="login-sub">Select your user role and branch to access workspace</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="role-tabs">
          <button
            type="button"
            className={`role-tab ${selectedRole === UserRole.Owner ? 'active' : ''}`}
            onClick={() => handleRoleChange(UserRole.Owner)}
          >
            <ShieldCheck size={16} />
            Owner
          </button>
          <button
            type="button"
            className={`role-tab ${selectedRole === UserRole.BranchManager ? 'active' : ''}`}
            onClick={() => handleRoleChange(UserRole.BranchManager)}
          >
            <Building2 size={16} />
            Branch Manager
          </button>
          <button
            type="button"
            className={`role-tab ${selectedRole === UserRole.Cashier ? 'active' : ''}`}
            onClick={() => handleRoleChange(UserRole.Cashier)}
          >
            <User size={16} />
            Cashier
          </button>
        </div>

        {/* Preset Quick Login Cards */}
        <div className="preset-section">
          <div className="preset-title">
            <Sparkles size={14} style={{ color: '#38BDF8' }} /> Quick Demo Login:
          </div>
          <div className="preset-grid">
            {PRESET_USERS.filter((p) => p.role === selectedRole).map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-card"
                onClick={() => handlePresetSelect(preset)}
              >
                <div className="preset-name">{preset.name}</div>
                <div className="preset-detail">
                  {preset.branch ? `${preset.branch} Branch` : 'All Branches'}
                </div>
                <div className="preset-desc">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Standard Credentials Form */}
        <form onSubmit={handleSubmit} className="login-form">
          {selectedRole !== UserRole.Owner && (
            <div className="form-group">
              <label>Assigned Branch Location</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value as BranchLocation)}
              >
                <option value={BranchLocation.Davao}>Davao Branch (Yard South)</option>
                <option value={BranchLocation.Makati}>Makati Branch (Capital Hub)</option>
                <option value={BranchLocation.Mandaue}>Mandaue Branch (Visayas Logistics)</option>
                <option value={BranchLocation.Cebu}>Cebu Branch (Port Yard)</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Username / Email</label>
            <div className="input-with-icon">
              <User size={16} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="enter email..."
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-with-icon">
              <KeyRound size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-login">
            Sign In to {selectedRole} Portal
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
