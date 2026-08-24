import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher';
import { ThemeSwitcher } from '../components/layout/ThemeSwitcher';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../services/api';

export const ForgotPasswordPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email, locale: i18n.language });
      setSubmitted(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Something went wrong. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

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
              background: 'linear-gradient(135deg, #0f766e, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              margin: '0 auto 12px',
              boxShadow: '0 8px 16px rgba(15, 118, 110, 0.3)',
            }}
          >
            <Mail size={26} color="#fff" />
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-main)' }}>
            {submitted ? 'Check Your Email' : 'Forgot Password'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {submitted
              ? 'We\'ve sent you password reset instructions'
              : 'Enter your email and we\'ll send you a reset link'}
          </p>
        </div>

        {submitted ? (
          /* Success State */
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
                If <strong>{email}</strong> is registered, you'll receive an email with instructions to reset your password. Please check your inbox and spam folder.
              </div>
            </div>

            <Link
              to="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                color: 'var(--primary-600)',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        ) : (
          /* Form State */
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
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('auth.emailLabel')}</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  placeholder="user@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', padding: '12px', marginTop: '8px', fontSize: '15px' }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
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
