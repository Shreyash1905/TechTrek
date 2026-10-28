import React, { useState } from 'react';
import { Lock, User, KeyRound, AlertCircle, CheckCircle2, ArrowRight, Loader2, ShieldAlert } from 'lucide-react';

export default function AdminLogin({
  onLoginSuccess,
  onNavigateHome,
  initialMustChangePassword = false,
  initialToken = '',
  sessionExpiredNotice = '',
}) {
  const [username, setUsername] = useState('SHREYASH');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(sessionExpiredNotice || '');

  // Password change required flow
  const [mustChangePassword, setMustChangePassword] = useState(initialMustChangePassword);
  const [activeToken, setActiveToken] = useState(initialToken);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changeSuccessMsg, setChangeSuccessMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('techtrek_admin_token', data.token);
        setActiveToken(data.token);

        if (data.mustChangePassword) {
          setMustChangePassword(true);
          setCurrentPassword(password);
        } else {
          onLoginSuccess({ username: data.username, token: data.token });
        }
      } else {
        setErrorMsg(data.message || 'Administrator authentication failed.');
      }
    } catch (err) {
      setErrorMsg('Unable to connect to administration server.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (newPassword === '1905') {
      setErrorMsg('You cannot reuse the default bootstrap password (1905).');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      const token = activeToken || localStorage.getItem('techtrek_admin_token');
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setChangeSuccessMsg('Password updated! Redirecting to dashboard…');
        setTimeout(() => {
          onLoginSuccess({ username, token });
        }, 800);
      } else {
        setErrorMsg(data.message || 'Failed to update password.');
      }
    } catch (err) {
      setErrorMsg('Network error while updating password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        {/* Brand header */}
        <div className="admin-brand-header">
          <img src="/images/sdmit_logo_white.png" alt="SDMIT Emblem" className="admin-login-logo" />
          <span className="admin-login-badge">SPARDHAM 2026 // TECH TREK</span>
          <h1 className="admin-login-title">Control Portal</h1>
          <p className="admin-login-subtitle">Administrative & Coordinator Access</p>
        </div>

        {errorMsg && (
          <div className="portal-alert portal-alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {changeSuccessMsg && (
          <div className="portal-alert portal-alert-success" role="status">
            <CheckCircle2 size={16} />
            <span>{changeSuccessMsg}</span>
          </div>
        )}

        {/* Normal Login Form */}
        {!mustChangePassword ? (
          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="form-group">
              <label className="input-label">ADMIN USERNAME</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. SHREYASH"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="modal-input has-icon"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="input-label">PASSWORD</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="modal-input has-icon"
                />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-portal-submit admin-submit">
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>SIGN IN TO DASHBOARD</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="admin-login-footer-links">
              <button type="button" onClick={onNavigateHome} className="btn-back-link">
                ← Return to Public Website
              </button>
            </div>
          </form>
        ) : (
          /* Mandatory First-Time Password Change Form */
          <form onSubmit={handleChangePassword} className="admin-login-form">
            <div className="security-notice-card">
              <ShieldAlert size={20} className="warning-icon" />
              <div>
                <strong>Security Requirement: Password Change Mandatory</strong>
                <p>
                  You are logging in with the initial bootstrap credential. You must set a personalized, secure password before accessing coordinator controls.
                </p>
              </div>
            </div>

            <div className="form-group">
              <label className="input-label">CURRENT PASSWORD</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="modal-input"
              />
            </div>

            <div className="form-group">
              <label className="input-label">NEW SECURE PASSWORD (MIN 6 CHARACTERS)</label>
              <input
                type="password"
                placeholder="Choose new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="modal-input"
              />
            </div>

            <div className="form-group">
              <label className="input-label">CONFIRM NEW PASSWORD</label>
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="modal-input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-portal-submit admin-submit">
              {loading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Updating Password…</span>
                </>
              ) : (
                <>
                  <ShieldAlert size={16} />
                  <span>UPDATE PASSWORD & UNLOCK</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
