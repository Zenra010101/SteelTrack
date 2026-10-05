import { useState } from 'react';
import { Layers, User, KeyRound, ArrowRight, Sparkles, Building2, ShieldCheck, MapPin } from 'lucide-react';
import { UserRole, BranchLocation, REGISTERED_USERS, resolveRegisteredUser, type UserSession, type PresetAccount } from '../types/auth';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState<string>('cashier.davao@steeltrack.com');
  const [password, setPassword] = useState<string>('••••••••');
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);

  // Fallback branch selection if an unlisted custom username is typed
  const [customBranch, setCustomBranch] = useState<BranchLocation>(BranchLocation.Davao);
  const [customRole, setCustomRole] = useState<UserRole>(UserRole.Cashier);

  const matchedUser = resolveRegisteredUser(username);

  const handlePresetSelect = (preset: PresetAccount) => {
    setUsername(preset.username);
    setRedirectNotice(
      preset.role === UserRole.Owner
        ? 'Redirecting to Executive Enterprise Portal...'
        : `Authenticating & Redirecting to ${preset.branch} Branch Workspace...`
    );

    setTimeout(() => {
      onLogin({
        username: preset.username,
        name: preset.name,
        role: preset.role,
        branch: preset.branch,
      });
    }, 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (matchedUser) {
      setRedirectNotice(
        matchedUser.role === UserRole.Owner
          ? 'Welcome Alexander Vance! Redirecting to All-Branches Executive View...'
          : `Verified! Redirecting ${matchedUser.name} to ${matchedUser.branch} Branch...`
      );

      setTimeout(() => {
        onLogin({
          username: matchedUser.username,
          name: matchedUser.name,
          role: matchedUser.role,
          branch: matchedUser.branch,
        });
      }, 400);
    } else {
      // Unlisted account: apply selected branch registration
      const autoName = username.split('@')[0] || 'User';
      const cleanName = autoName.charAt(0).toUpperCase() + autoName.slice(1);
      
      setRedirectNotice(`Registering & Connecting to ${customBranch} Branch...`);

      setTimeout(() => {
        onLogin({
          username: username.trim(),
          name: cleanName,
          role: customRole,
          branch: customRole === UserRole.Owner ? undefined : customBranch,
        });
      }, 400);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        {/* Left Column: SteelTrack Enterprise Telemetry */}
        <div className="login-hero">
          <div>
            <div className="hero-brand">
              <div className="hero-logo-box">
                <Layers size={26} color="#FFFFFF" />
              </div>
              <div>
                <h1 className="hero-title">SteelTrack</h1>
                <p className="hero-tagline">Enterprise Steel Supply & POS Infrastructure</p>
              </div>
            </div>

            <div className="hero-telemetry">
              <div className="telemetry-title">CONNECTED BRANCH NETWORK NODES</div>
              <div className="branch-nodes-grid">
                <div className="branch-node">
                  <div className="node-dot" />
                  <div>
                    <div className="node-name">Davao Branch</div>
                    <div className="node-status">Davao Node Active</div>
                  </div>
                </div>

                <div className="branch-node">
                  <div className="node-dot" />
                  <div>
                    <div className="node-name">Makati Branch</div>
                    <div className="node-status">Makati Node Active</div>
                  </div>
                </div>

                <div className="branch-node">
                  <div className="node-dot" />
                  <div>
                    <div className="node-name">Mandaue Branch</div>
                    <div className="node-status">Mandaue Node Active</div>
                  </div>
                </div>

                <div className="branch-node">
                  <div className="node-dot" />
                  <div>
                    <div className="node-name">Cebu Branch</div>
                    <div className="node-status">Cebu Node Active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-footer-note">
            <ShieldCheck size={16} />
            <span>Strict Branch Boundary Policy: Users strictly access their registered branch.</span>
          </div>
        </div>

        {/* Right Column: Clean White Authentication Form */}
        <div className="login-form-pane">
          <div className="login-heading">
            <h2>Sign In to Workspace</h2>
            <p>Access will automatically redirect to your registered branch terminal.</p>
          </div>

          {redirectNotice ? (
            <div className="login-auto-notice" style={{ background: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46' }}>
              <Sparkles size={16} />
              <span>{redirectNotice}</span>
            </div>
          ) : matchedUser ? (
            <div className="login-auto-notice">
              <Building2 size={16} />
              <span>
                Registered to: <strong>{matchedUser.branch ? `${matchedUser.branch} Branch` : 'All Branches (Owner)'}</strong> ({matchedUser.role})
              </span>
            </div>
          ) : (
            <div className="login-auto-notice" style={{ background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
              <MapPin size={16} />
              <span>Custom Account: Will be assigned to {customBranch} Branch</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Work Email / Username</label>
              <div className="input-with-icon">
                <User size={16} style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="name@steeltrack.com"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <KeyRound size={16} style={{ color: '#94A3B8' }} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* If custom username that is not in registered list, offer branch assignment selector */}
            {!matchedUser && (
              <div className="form-group">
                <label>Branch Assignment for New User</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <select
                    value={customBranch}
                    onChange={(e) => setCustomBranch(e.target.value as BranchLocation)}
                  >
                    <option value={BranchLocation.Davao}>Davao Branch</option>
                    <option value={BranchLocation.Makati}>Makati Branch</option>
                    <option value={BranchLocation.Mandaue}>Mandaue Branch</option>
                    <option value={BranchLocation.Cebu}>Cebu Branch</option>
                  </select>

                  <select
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value as UserRole)}
                  >
                    <option value={UserRole.Cashier}>Cashier</option>
                    <option value={UserRole.BranchManager}>Branch Manager</option>
                    <option value={UserRole.Owner}>Owner</option>
                  </select>
                </div>
              </div>
            )}

            <button type="submit" className="btn-login">
              Continue to Assigned Branch
              <ArrowRight size={18} />
            </button>
          </form>

          {/* Quick Demo Switcher */}
          <div className="demo-preset-section">
            <div className="demo-preset-title">
              <Sparkles size={14} style={{ color: '#0284C7' }} /> One-Click Quick Login Presets:
            </div>
            <div className="demo-pills-grid">
              {REGISTERED_USERS.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="demo-pill"
                  onClick={() => handlePresetSelect(user)}
                  title={`${user.role} • ${user.branch || 'All Branches'}`}
                >
                  {user.name.split(' ')[0]} ({user.branch ? user.branch : 'Owner'})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
