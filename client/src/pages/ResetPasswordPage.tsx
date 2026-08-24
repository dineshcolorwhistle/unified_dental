import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { ThemeSwitcher } from '../components/layout/ThemeSwitcher';
import { KeyRound, ArrowLeft, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      // Auto-redirect to login after 3 seconds
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Failed to reset password. The link may be expired or invalid.',
      );
    } finally {
      setLoading(false);
    }
  };

  const hasNoToken = !token;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background-color 0.2s ease',
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(15, 118, 110, 0.2) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Top right utility bar: Language Switcher & Theme Switcher */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <LanguageSwitcher />
        <ThemeSwitcher />
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid var(--border-color)',
          position: 'relative',
          zIndex: 1,
          transition: 'all 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: success
                ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                : 'linear-gradient(135deg, #0f766e, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              margin: '0 auto 12px',
              boxShadow: success
                ? '0 8px 16px rgba(22, 163, 74, 0.3)'
                : '0 8px 16px rgba(15, 118, 110, 0.3)',
            }}
          >
            {success ? <CheckCircle size={26} color="#fff" /> : <KeyRound size={26} color="#fff" />}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
            {success ? 'Password Updated!' : 'Set New Password'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {success
              ? 'Redirecting you to the login page...'
              : 'Choose a strong password for your account'}
          </p>
        </div>

        {/* No token state */}
        {hasNoToken && !success ? (
          <div>
            <div
              style={{
                backgroundColor: 'var(--badge-danger-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--badge-danger-text)',
                padding: '16px',
                borderRadius: '10px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                <strong>Invalid reset link.</strong><br />
                This page requires a valid password reset token. Please request a new reset link.
              </div>
            </div>

            <Link
              to="/forgot-password"
              className="btn btn-primary"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                textAlign: 'center',
                textDecoration: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              Request New Reset Link
            </Link>
          </div>
        ) : success ? (
          /* Success state */
          <div>
            <div
              style={{
                backgroundColor: 'var(--badge-success-bg)',
                border: '1px solid var(--border-color)',
                color: 'var(--badge-success-text)',
                padding: '16px',
                borderRadius: '10px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                marginBottom: '24px',
              }}
            >
              <CheckCircle size={20} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>
                Your password has been updated successfully. You can now log in with your new password.
              </div>
            </div>

            <Link
              to="/login"
              className="btn btn-primary"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                textAlign: 'center',
                textDecoration: 'none',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              Go to Login
            </Link>
          </div>
        ) : (
          /* Reset form */
          <>
            {error && (
              <div
                style={{
                  backgroundColor: 'var(--badge-danger-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--badge-danger-text)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    required
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    autoFocus
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-subtle)',
                      padding: '4px',
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    className="form-input"
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-subtle)',
                      padding: '4px',
                    }}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Password match indicator */}
              {confirmPassword && (
                <div
                  style={{
                    fontSize: '12px',
                    color: newPassword === confirmPassword ? 'var(--emerald-500)' : 'var(--rose-500)',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {newPassword === confirmPassword ? (
                    <><CheckCircle size={13} /> Passwords match</>
                  ) : (
                    <><AlertTriangle size={13} /> Passwords do not match</>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || newPassword !== confirmPassword}
                style={{ width: '100%', padding: '12px', marginTop: '8px', fontSize: '15px' }}
              >
                {loading ? 'Updating...' : 'Set New Password'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--primary-600)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <ArrowLeft size={14} />
                Back to Login
              </Link>
            </div>
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
            🦷 Unified Dental Platform
          </span>
        </div>
      </div>
    </div>
  );
};
