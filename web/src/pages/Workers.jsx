import { useCallback, useEffect, useState } from 'react';
import client, { errorMessage } from '../api/client';
import Spinner from '../components/Spinner';
import WorkerModal from '../components/WorkerModal';
import { formatMoney } from '../utils/format';

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null); // worker or {} for new

  const load = useCallback(() => {
    setLoading(true);
    client
      .get('/workers', {
        params: {
          search: search || undefined,
          active: activeFilter || undefined,
        },
      })
      .then((res) => setWorkers(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [search, activeFilter]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3500);
  };

  const submit = async (payload) => {
    try {
      if (modal?._id) {
        await client.put(`/workers/${modal._id}`, payload);
        flash(`${payload.name} updated.`);
      } else {
        await client.post('/workers', payload);
        flash(`${payload.name} added.`);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
      setModal(null);
    }
  };

  const toggleActive = async (worker) => {
    try {
      await client.patch(`/workers/${worker._id}/status`, { active: !worker.active });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (worker) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete ${worker.name}? This cannot be undone.`)) return;
    try {
      await client.delete(`/workers/${worker._id}`);
      flash(`${worker.name} deleted.`);
      load();
    } catch (err) {
      if (err?.response?.status === 409) {
        // eslint-disable-next-line no-alert
        const force = window.confirm(`${err.response.data.message}\n\nDelete anyway and remove all their records?`);
        if (force) {
          await client.delete(`/workers/${worker._id}?force=true`).catch((e) => setError(errorMessage(e)));
          flash(`${worker.name} and all their records deleted.`);
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
          <h1>Workers</h1>
          <p>{workers.length} worker(s) shown</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          + Add worker
        </button>
      </div>

      {error && <p className="form-error" style={{ marginBottom: 14 }}>{error}</p>}
      {message && <p className="form-success">{message}</p>}

      <div className="filter-bar">
        <label className="field">
          <span>Search name</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name" />
        </label>
        <label className="field">
          <span>Status</span>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : workers.length === 0 ? (
          <p className="empty">No workers found. Add your first worker to get started.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th className="num">Daily wage</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w._id}>
                    <td>
                      <strong>{w.name}</strong>
                    </td>
                    <td className="muted">{w.role}</td>
                    <td className="muted">{w.phone || '—'}</td>
                    <td className="num">{formatMoney(w.dailyWage)}</td>
                    <td>
                      <span className={`badge ${w.active ? 'badge-paid' : 'badge-muted'}`}>
                        {w.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="num">
                      <div className="row-actions">
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(w)}>
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(w)}>
                          {w.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(w)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <WorkerModal
          worker={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}