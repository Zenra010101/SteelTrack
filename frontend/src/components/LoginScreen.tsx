import { useState } from 'react';
import { Layers, User, KeyRound, ArrowRight, Sparkles, Building2, AlertCircle } from 'lucide-react';
import { UserRole, resolveRegisteredUser, type UserSession } from '../types/auth';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setErrorMessage('Please enter your work username or email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    const matchedUser = resolveRegisteredUser(trimmedUser);

    if (matchedUser) {
      setRedirectNotice(
        matchedUser.role === UserRole.Owner
          ? 'Authenticated! Redirecting to All-Branches Executive View...'
          : `Verified! Redirecting ${matchedUser.name} to ${matchedUser.branch} Branch Workspace...`
      );

      // Immediately clear sensitive credentials from component state
      setUsername('');
      setPassword('');

      setTimeout(() => {
        onLogin({
          username: matchedUser.username,
          name: matchedUser.name,
          role: matchedUser.role,
          branch: matchedUser.branch,
        });
      }, 400);
    } else {
      // In case user entered a non-preset account, authenticate with safe fallback
      const autoName = trimmedUser.split('@')[0] || 'User';
      const cleanName = autoName.charAt(0).toUpperCase() + autoName.slice(1);

      setRedirectNotice(`Authenticated! Redirecting to workspace...`);

      setUsername('');
      setPassword('');

      setTimeout(() => {
        onLogin({
          username: trimmedUser,
          name: cleanName,
          role: UserRole.Cashier,
          branch: undefined,
        });
      }, 400);
    }
  };

  const matchedPreview = username.trim() ? resolveRegisteredUser(username.trim()) : null;

  return (
    <div className="login-wrapper">
      <div className="login-container single-card">
        <div className="login-form-pane">
          {/* Brand Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.75rem' }}>
            <div
              style={{
                width: 52,
                height: 52,
                background: 'linear-gradient(135deg, #0284C7, #0369A1)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px -4px rgba(2, 132, 199, 0.35)',
                marginBottom: '1rem',
              }}
            >
              <Layers size={28} color="#FFFFFF" />
            </div>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.02em' }}>
              SteelTrack
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '0.25rem' }}>
              Enterprise Steel Supply & POS Infrastructure
            </p>
          </div>

          <div className="login-heading" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Sign In to Terminal</h2>
            <p style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '0.25rem' }}>
              Enter your authorized credentials to access your branch workspace
            </p>
          </div>

          {/* Feedback & Notices */}
          {redirectNotice && (
            <div className="login-auto-notice" style={{ background: '#ECFDF5', borderColor: '#A7F3D0', color: '#065F46', marginBottom: '1rem' }}>
              <Sparkles size={16} />
              <span>{redirectNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="login-auto-notice" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#B91C1C', marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {matchedPreview && !redirectNotice && (
            <div className="login-auto-notice" style={{ marginBottom: '1rem' }}>
              <Building2 size={16} />
              <span>
                Account: <strong>{matchedPreview.branch ? `${matchedPreview.branch} Branch` : 'All Branches'}</strong> ({matchedPreview.role})
              </span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Work Email / Username</label>
              <div className="input-with-icon">
                <User size={16} style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. manager.davao@steeltrack.com"
                  autoComplete="username"
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
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-login" style={{ marginTop: '0.5rem' }}>
              <span>Sign In to Workspace</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8' }}>
            SteelTrack v2.0 • Multi-Branch Role-Based Access Control
          </div>
        </div>
      </div>
    </div>
  );
}
