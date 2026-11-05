import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../../components/Icons/Icons.jsx';
import './Login.css';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/calculator" replace />;
  }

  const validate = () => {
    const next = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      next.email = 'Enter your email address.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      next.email = 'Enter a valid email address.';
    }

    if (!password) {
      next.password = 'Enter your password.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({ email, password });
      navigate('/calculator', { replace: true });
    } catch (err) {
      setFormError(err.message || 'Could not log in. Please try again.');
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
            <h1>Log in to your account</h1>
            <p>Manage shared meters, billing rates, and electricity bills together.</p>
          </div>
        </div>

        {formError && (
          <div className="banner bad auth-banner" role="alert">
            <Icon name="alert" />
            <span>{formError}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">Email address</label>
            <div className={`input ${errors.email ? 'bad' : ''}`}>
              <input
                id="login-email"
                type="email"
                className="text"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                }}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby="login-email-err"
              />
            </div>
            <div className="err" id="login-email-err" role="alert">
              {errors.email || ''}
            </div>
          </div>

          <div className="field">
            <div className="label-row">
              <label htmlFor="login-password">Password</label>
              <Link to="/forgot-password" className="forgot-link">
                Forgot password?
              </Link>
            </div>
            <div className={`input ${errors.password ? 'bad' : ''}`}>
              <input
                id="login-password"
                type="password"
                className="text"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                }}
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby="login-pass-err"
              />
            </div>
            <div className="err" id="login-pass-err" role="alert">
              {errors.password || ''}
            </div>
          </div>

          <button
            type="submit"
            className="btn primary auth-submit"
            disabled={submitting}
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="auth-switch">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
