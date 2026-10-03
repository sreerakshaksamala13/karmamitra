import { useCallback, useEffect, useState } from 'react';
import client, { errorMessage } from '../api/client';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { formatMoney } from '../utils/format';

const EMPTY = {
  name: '',
  location: '',
  clientName: '',
  clientPhone: '',
  dailyRateToClient: 0,
  notes: '',
  active: true,
};

function SiteForm({ site, onClose, onSubmit }) {
  const isEdit = Boolean(site?._id);
  const [form, setForm] = useState(site ? { ...EMPTY, ...site } : EMPTY);
  const [busy, setBusy] = useState(false);
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ ...form, dailyRateToClient: Number(form.dailyRateToClient) || 0 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isEdit ? `Edit ${site.name}` : 'Add site'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="site-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Add site'}
          </button>
        </>
      }
    >
      <form id="site-form" className="form" onSubmit={submit}>
        <label className="field">
          <span>Site name</span>
          <input value={form.name} onChange={update('name')} required placeholder="e.g. Sunrise Apartments" />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Location</span>
            <input value={form.location} onChange={update('location')} placeholder="Area / city" />
          </label>
          <label className="field">
            <span>Client name</span>
            <input value={form.clientName} onChange={update('clientName')} placeholder="Who is paying" />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>Client phone</span>
            <input value={form.clientPhone} onChange={update('clientPhone')} />
          </label>
          <label className="field">
            <span>Client rate / day (₹)</span>
            <input type="number" min="0" value={form.dailyRateToClient} onChange={update('dailyRateToClient')} />
          </label>
        </div>
        <label className="field">
          <span>Status</span>
          <select
            value={form.active ? 'active' : 'inactive'}
            onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea rows="2" value={form.notes} onChange={update('notes')} placeholder="Optional" />
        </label>
      </form>
    </Modal>
  );
}

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    client
      .get('/sites')
      .then((res) => setSites(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3500);
  };

  const submit = async (payload) => {
    try {
      if (modal?._id) {
        await client.put(`/sites/${modal._id}`, payload);
        flash(`${payload.name} updated.`);
      } else {
        await client.post('/sites', payload);
        flash(`${payload.name} added.`);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
      setModal(null);
    }
  };

  const remove = async (site) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete ${site.name}?`)) return;
    try {
      await client.delete(`/sites/${site._id}`);
      flash(`${site.name} deleted.`);
      load();
    } catch (err) {
      if (err?.response?.status === 409) {
        // eslint-disable-next-line no-alert
        if (window.confirm(`${err.response.data.message}\n\nDelete anyway?`)) {
          await client.delete(`/sites/${site._id}?force=true`).catch((e) => setError(errorMessage(e)));
          load();
        }
      } else {
        setError(errorMessage(err));
      }
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Sites</h1>
          <p>{sites.length} construction site(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          + Add site
        </button>
      </div>

      {error && <p className="form-error" style={{ marginBottom: 14 }}>{error}</p>}
      {message && <p className="form-success">{message}</p>}

      {loading ? (
        <Spinner />
      ) : sites.length === 0 ? (
        <p className="empty">No sites yet. Add the places where your crew works.</p>
      ) : (
        <div className="grid grid-cards">
          {sites.map((s) => (
            <div className="card" key={s._id} style={{ marginBottom: 0 }}>
              <div className="card-head">
                <h3>{s.name}</h3>
                <span className={`badge ${s.active ? 'badge-paid' : 'badge-muted'}`}>
                  {s.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="muted" style={{ margin: '0 0 6px' }}>{s.location || 'No location'}</p>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 4px' }}>
                Client: {s.clientName || '—'}
              </p>
              <p className="muted" style={{ fontSize: 13, margin: '0 0 4px' }}>
                Client rate: {formatMoney(s.dailyRateToClient)}/day
              </p>
              <p style={{ margin: '0 0 12px' }}>
                <strong>{s.workerCount || 0}</strong> worker(s) assigned
              </p>
              <div className="row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>
                  Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <SiteForm site={modal._id ? modal : null} onClose={() => setModal(null)} onSubmit={submit} />}
    </div>
  );
}