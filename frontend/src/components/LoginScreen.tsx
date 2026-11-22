import { useState } from 'react';
import { Layers, User, KeyRound, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { UserRole, BranchLocation, type UserSession } from '../types/auth';

interface LoginScreenProps {
  onLogin: (session: UserSession) => void;
  /** Why the previous session ended, shown above the form. */
  notice?: string | null;
}

export function LoginScreen({ onLogin, notice: _notice }: LoginScreenProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [redirectNotice, setRedirectNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
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
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, color: '#000000', letterSpacing: '-0.02em' }}>
              SteelTrack
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#000000', marginTop: '0.25rem' }}>
              Enterprise Steel Supply & POS Infrastructure
            </p>
          </div>

          <div className="login-heading" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Sign In to Terminal</h2>
            <p style={{ fontSize: '0.8rem', color: '#000000', marginTop: '0.25rem' }}>
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

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Work Email / Username</label>
              <div className="input-with-icon">
                <User size={16} style={{ color: '#000000' }} />
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
                <KeyRound size={16} style={{ color: '#000000' }} />
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

            <button type="submit" className="btn-login" style={{ marginTop: '0.5rem' }} disabled={isLoading}>
              <span>{isLoading ? 'Verifying with Database...' : 'Sign In to Workspace'}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#000000' }}>
            SteelTrack v2.0 • Multi-Branch Role-Based Access Control
          </div>
        </div>
      </div>
    </div>
  );
}
