import { useCallback, useEffect, useMemo, useState } from 'react';
import client, { errorMessage } from '../api/client';
import Spinner from '../components/Spinner';
import { STATUS_LABELS, formatMoney, toDateInput, weekdayName } from '../utils/format';

const STATUSES = ['present', 'half-day', 'absent'];

export default function Attendance() {
  const [date, setDate] = useState(toDateInput());
  const [site, setSite] = useState('');
  const [sites, setSites] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    client.get('/sites').then((res) => setSites(res.data)).catch(() => {});
  }, []);

  const loadSheet = useCallback(() => {
    setLoading(true);
    setError('');
    client
      .get('/attendance/sheet', { params: { date, site: site || undefined } })
      .then((res) => setRows(res.data.rows))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [date, site]);

  useEffect(loadSheet, [loadSheet]);

  const setStatus = (workerId, status) =>
    setRows((prev) => prev.map((r) => (r.worker._id === workerId ? { ...r, status } : r)));

  const markAll = (status) => setRows((prev) => prev.map((r) => ({ ...r, status })));

  const summary = useMemo(() => {
    const calc = (r) => {
      const factor = r.status === 'present' ? 1 : r.status === 'half-day' ? 0.5 : 0;
      return r.wageRate * factor;
    };
    return {
      present: rows.filter((r) => r.status === 'present').length,
      halfDay: rows.filter((r) => r.status === 'half-day').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      wage: rows.reduce((s, r) => s + calc(r), 0),
    };
  }, [rows]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const entries = rows.map((r) => ({
        worker: r.worker._id,
        status: r.status,
        wageRate: r.wageRate,
      }));
      const res = await client.post('/attendance/bulk', { date, site: site || undefined, entries });
      setMessage(
        `Saved ${res.data.marked} worker(s) for ${date}.` +
          (res.data.skipped?.length ? ` ${res.data.skipped.length} skipped.` : '')
      );
      loadSheet();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Daily attendance</h1>
          <p>
            {weekdayName(date)} — mark who came to work and the wage for the day.
          </p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving || !rows.length}>
          {saving ? 'Saving...' : 'Save attendance'}
        </button>
      </div>

      <div className="filter-bar">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Site</span>
          <select value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">All sites</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row-actions" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => markAll('present')}>
            All present
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => markAll('absent')}>
            All absent
          </button>
        </div>
      </div>

      {error && <p className="form-error" style={{ marginBottom: 14 }}>{error}</p>}
      {message && <p className="form-success">{message}</p>}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat-card stat-green">
          <span className="stat-label">Present</span>
          <span className="stat-value">{summary.present}</span>
        </div>
        <div className="stat-card stat-amber">
          <span className="stat-label">Half day</span>
          <span className="stat-value">{summary.halfDay}</span>
        </div>
        <div className="stat-card stat-red">
          <span className="stat-label">Absent</span>
          <span className="stat-value">{summary.absent}</span>
        </div>
        <div className="stat-card stat-primary">
          <span className="stat-label">Wage for the day</span>
          <span className="stat-value">{formatMoney(summary.wage)}</span>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <p className="empty">No active workers{site ? ' at this site' : ''}. Add workers first.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Role</th>
                  <th>Site</th>
                  <th className="num">Rate</th>
                  <th>Status</th>
                  <th className="num">Wage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const factor = r.status === 'present' ? 1 : r.status === 'half-day' ? 0.5 : 0;
                  return (
                    <tr key={r.worker._id}>
                      <td>
                        <strong>{r.worker.name}</strong>
                        {r.marked && (
                          <span className="badge badge-muted" style={{ marginLeft: 8 }}>
                            saved
                          </span>
                        )}
                      </td>
                      <td className="muted">{r.worker.role}</td>
                      <td className="muted">{r.worker.site?.name || '—'}</td>
                      <td className="num muted">{formatMoney(r.wageRate)}</td>
                      <td>
                        <div className="seg">
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className={r.status === s ? `active-${s}` : ''}
                              onClick={() => setStatus(r.worker._id, s)}
                            >
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="num">{formatMoney(r.wageRate * factor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}