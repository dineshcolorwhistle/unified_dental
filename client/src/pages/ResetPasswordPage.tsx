import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
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
        backgroundColor: '#0f172a',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
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
          background: 'radial-gradient(circle, rgba(15, 118, 110, 0.35) 0%, rgba(15, 23, 42, 0) 70%)',
          filter: 'blur(40px)',
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
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(15, 23, 42, 0) 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Language Switcher */}
      <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 10 }}>
        <LanguageSwitcher />
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '20px',
          padding: '36px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          zIndex: 1,
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
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
            {success ? 'Password Updated!' : 'Set New Password'}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
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
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
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
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
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
                  backgroundColor: '#ffe4e6',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
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
                      color: '#94a3b8',
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
                      color: '#94a3b8',
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
                    color: newPassword === confirmPassword ? '#16a34a' : '#dc2626',
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
                  color: '#0f766e',
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
        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            🦷 Unified Dental Platform
          </span>
        </div>
      </div>
    </div>
  );
};
