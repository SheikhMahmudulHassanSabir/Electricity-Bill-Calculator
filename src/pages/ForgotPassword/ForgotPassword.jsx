import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Icon } from '../../components/Icons/Icons.jsx';
import './ForgotPassword.css';

export function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailError('');
    setFormError('');
    setSentTo('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setEmailError('Enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await resetPassword({ email: cleanEmail });
      setSentTo(res.email);
    } catch (err) {
      setFormError(err.message || 'Could not send password reset instructions.');
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
            <h1>Reset your password</h1>
            <p>Enter your account email and we will send a password reset link.</p>
          </div>
        </div>

        {formError && (
          <div className="banner bad auth-banner" role="alert">
            <Icon name="alert" />
            <span>{formError}</span>
          </div>
        )}

        {sentTo && (
          <div className="banner ok auth-banner" role="status">
            <Icon name="check" />
            <span>
              If an account exists for <strong>{sentTo}</strong>, password reset
              instructions have been sent.
            </span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="reset-email">Email address</label>
            <div className={`input ${emailError ? 'bad' : ''}`}>
              <input
                id="reset-email"
                type="email"
                className="text"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                }}
                aria-invalid={emailError ? 'true' : 'false'}
                aria-describedby="reset-email-err"
              />
            </div>
            <div className="err" id="reset-email-err" role="alert">
              {emailError || ''}
            </div>
          </div>

          <button
            type="submit"
            className="btn primary auth-submit"
            disabled={submitting}
          >
            {submitting ? 'Sending link…' : 'Send reset link'}
          </button>
        </form>

        <p className="auth-switch">
          Remembered your password? <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </main>
  );
}
