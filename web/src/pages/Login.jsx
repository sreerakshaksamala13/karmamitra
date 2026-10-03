import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // If no owner exists yet, the API returns 403 on register; detect it here so
  // the very first run defaults to the "create account" form.
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(form.phone.trim(), form.password);
      } else {
        await register(form.name.trim(), form.phone.trim(), form.password);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark big">K</span>
          <h1>Karmamitra</h1>
          <p>Worker attendance, wages &amp; weekly payments</p>
        </div>

        <form onSubmit={submit} className="form">
          {mode === 'register' && (
            <label className="field">
              <span>Your name</span>
              <input value={form.name} onChange={update('name')} placeholder="e.g. Ramesh" required />
            </label>
          )}
          <label className="field">
            <span>Phone number</span>
            <input
              value={form.phone}
              onChange={update('phone')}
              placeholder="10-digit mobile number"
              inputMode="numeric"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {mode === 'login'
            ? 'New here? Create an account'
            : 'Already have an account? Log in'}
        </button>

        <p className="login-hint">
          Demo login &mdash; <strong>9999999999</strong> / <strong>admin123</strong>
        </p>
      </div>
    </div>
  );
}