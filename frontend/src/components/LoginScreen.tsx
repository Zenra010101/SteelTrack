import { useState } from 'react';
import { Layers, Mail, KeyRound, ArrowRight, Sparkles, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { UserRole, BranchLocation, type UserSession } from '../types/auth';
import loginHeroImg from '../assets/login-hero.jpg';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
  /** Why the previous session ended, shown above the form. */
  notice?: string | null;
}

export function LoginScreen({ onLogin, notice: _notice }: LoginScreenProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser) {
      setErrorMessage('Please enter your work email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      // Authenticate against backend /api/auth/login endpoint
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: trimmedUser,
          password: password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        const errorMsg =
          result?.message ||
          result?.error ||
          (res.status === 401 ? 'Invalid email or password.' : 'Login failed. Please check your credentials.');
        setErrorMessage(errorMsg);
        setIsLoading(false);
        return;
      }

      const authData = result.data;
      if (authData?.token) {
        localStorage.setItem('steeltrack_auth_token', authData.token);
      }
      if (authData?.user) {
        localStorage.setItem('steeltrack_user', JSON.stringify(authData.user));
      }

      // Map role from backend verification
      let role: UserRole = UserRole.Cashier;
      const rName = (authData?.user?.role || '').toLowerCase();
      if (rName.includes('owner') || rName.includes('admin') || authData?.user?.email?.toLowerCase().includes('owner')) {
        role = UserRole.Owner;
      } else if (rName.includes('manager') || authData?.user?.email?.toLowerCase().includes('manager')) {
        role = UserRole.BranchManager;
      }

      // Map branch location
      let branch: BranchLocation | undefined = undefined;
      if (role !== UserRole.Owner) {
        const bName = (authData?.user?.branchName || '').toLowerCase();
        const em = (authData?.user?.email || trimmedUser).toLowerCase();

        if (bName.includes('davao') || em.includes('davao') || em.includes('dvo')) branch = BranchLocation.Davao;
        else if (bName.includes('cagayan') || em.includes('cagayan') || em.includes('cgy')) branch = BranchLocation.Cagayan;
        else if (bName.includes('mandaue') || em.includes('mandaue') || em.includes('mnd')) branch = BranchLocation.Mandaue;
        else if (bName.includes('cebu') || em.includes('cebu') || em.includes('ceb')) branch = BranchLocation.Cebu;
        else branch = BranchLocation.Davao;
      }

      const displayName = authData?.user?.fullName || trimmedUser.split('@')[0];

      setRedirectNotice(
        role === UserRole.Owner
          ? 'Authenticated! Redirecting to All-Branches Executive View...'
          : `Verified! Redirecting ${displayName} to ${branch} Branch Workspace...`
      );

      setUsername('');
      setPassword('');

      setTimeout(() => {
        onLogin({
          username: authData?.user?.email || trimmedUser,
          name: displayName,
          role,
          branch,
        });
      }, 400);
    } catch (err: any) {
      console.error('Login request failed:', err);
      setErrorMessage('Unable to connect to authentication server. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-split-page">
      {/* Left Column: Visual Steel Image */}
      <div className="login-split-image-pane">
        <img
          src={loginHeroImg}
          alt="SteelTrack Industrial Products"
          className="login-split-hero-img"
        />
        <div className="login-split-image-overlay">
          <div className="login-split-badge">
            <Layers size={14} color="#FFFFFF" />
            <span>Enterprise Terminal</span>
          </div>
          <h2 className="login-split-hero-heading">
            Next-Generation Steel Supply & POS Infrastructure
          </h2>
          <p className="login-split-hero-subtext">
            Real-time multi-branch inventory, AI-driven demand forecasting, and automated supply telemetry.
          </p>
        </div>
      </div>

      {/* Right Column: Clean Login Form */}
      <div className="login-split-form-pane">
        <div className="login-split-form-content">
          {/* Brand Header */}
          <div className="login-brand-header">
            <div className="login-brand-icon">
              <Layers size={28} color="#FFFFFF" />
            </div>
            <h1 className="login-brand-title">SteelTrack</h1>
            <p className="login-brand-subtitle">
              Enterprise Steel Supply & POS Infrastructure
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

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Work Email</label>
              <div className="input-with-icon">
                <Mail size={16} style={{ color: '#000000' }} />
                <input
                  type="email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g JuanDelaCruz@steeltrack.com"
                  autoComplete="email"
                  required
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', background: 'transparent' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-with-icon">
                <KeyRound size={16} style={{ color: '#000000', flexShrink: 0 }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  style={{ border: 'none', outline: 'none', boxShadow: 'none', background: 'transparent' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '0 4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#6B7280',
                    outline: 'none',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-login" style={{ marginTop: '0.5rem' }} disabled={isLoading}>
              <span>{isLoading ? 'Verifying with Database...' : 'Sign In to Workspace'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '1.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748B' }}>
            SteelTrack v2.0 • Multi-Branch Role-Based Access Control
          </div>
        </div>
      </div>
    </div>
  );
}
