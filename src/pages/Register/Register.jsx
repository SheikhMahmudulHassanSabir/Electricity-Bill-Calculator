import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../../components/Icons/Icons.jsx';
import './Register.css';

export function Register() {
  const { user, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/workspaces" replace />;
  }

  const validate = () => {
    const next = {};
    if (!fullName.trim()) {
      next.fullName = 'Enter your full name.';
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      next.email = 'Enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      next.email = 'Enter a valid email address.';
    }

    if (!password) {
      next.password = 'Enter a password.';
    } else if (password.length < 6) {
      next.password = 'Password must be at least 6 characters.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setInfoMsg('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await register({ fullName, email, password });
      if (res?.needsEmailConfirmation) {
        setInfoMsg(
          'Account created! Please check your email inbox to confirm your address before logging in.'
        );
      } else {
        navigate('/workspaces', { replace: true });
      }
    } catch (err) {
      setFormError(err.message || 'Could not create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setFormError('');
    setInfoMsg('');
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/workspaces', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Could not sign in with Google.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="panel auth-card">
        <div className="auth-brand">
          <div className="auth-mark">
            <Icon name="zap" />
          </div>
          <div>
            <h1>Create your account</h1>
            <p>Start a workspace for your home or join an existing flat with an invite code.</p>
          </div>
        </div>

        {formError && (
          <div className="banner bad auth-banner" role="alert">
            <Icon name="alert" />
            <span>{formError}</span>
          </div>
        )}

        {infoMsg && (
          <div className="banner ok auth-banner" role="status">
            <Icon name="check" />
            <span>{infoMsg}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <div className={`input ${errors.fullName ? 'bad' : ''}`}>
              <input
                id="reg-name"
                type="text"
                className="text"
                autoComplete="name"
                placeholder="e.g. Asha Rao"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                aria-invalid={errors.fullName ? 'true' : 'false'}
                aria-describedby="reg-name-err"
              />
            </div>
            <div className="err" id="reg-name-err" role="alert">
              {errors.fullName || ''}
            </div>
          </div>

          <div className="field">
            <label htmlFor="reg-email">Email address</label>
            <div className={`input ${errors.email ? 'bad' : ''}`}>
              <input
                id="reg-email"
                type="email"
                className="text"
                autoComplete="email"
                placeholder="asha@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby="reg-email-err"
              />
            </div>
            <div className="err" id="reg-email-err" role="alert">
              {errors.email || ''}
            </div>
          </div>

          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <div className={`input ${errors.password ? 'bad' : ''}`}>
              <input
                id="reg-password"
                type="password"
                className="text"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby="reg-pass-err"
              />
            </div>
            <div className="err" id="reg-pass-err" role="alert">
              {errors.password || ''}
            </div>
          </div>

          <button
            type="submit"
            className="btn primary auth-submit"
            disabled={submitting}
          >
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn ghost auth-google-btn"
          onClick={handleGoogleLogin}
          disabled={submitting}
        >
          <Icon name="google" />
          <span>Continue with Google</span>
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
