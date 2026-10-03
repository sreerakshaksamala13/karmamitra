import { useCallback, useEffect, useState } from 'react';
import client, { errorMessage } from '../api/client';
import Spinner from '../components/Spinner';
import StatCard from '../components/StatCard';
import { addDays, formatMoney, toDateInput } from '../utils/format';

export default function Reports() {
  const [from, setFrom] = useState(addDays(toDateInput(), -6));
  const [to, setTo] = useState(toDateInput());
  const [site, setSite] = useState('');
  const [sites, setSites] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/sites').then((res) => setSites(res.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    client
      .get('/attendance/summary', { params: { from, to, site: site || undefined } })
      .then((res) => setData(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [from, to, site]);

  useEffect(load, [load]);

  const quickRange = (days) => {
    setFrom(addDays(toDateInput(), -days + 1));
    setTo(toDateInput());
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p>Attendance and wages for any date range.</p>
        </div>
        <div className="row-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => quickRange(7)}>
            Last 7 days
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => quickRange(30)}>
            Last 30 days
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <label className="field">
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
      </div>

      {error && <p className="form-error" style={{ marginBottom: 14 }}>{error}</p>}

      {loading ? (
        <Spinner />
      ) : !data ? (
        <p className="empty">No data.</p>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <StatCard label="Total present" value={data.totals.present} tone="green" />
            <StatCard label="Half days" value={data.totals.halfDay} tone="amber" />
            <StatCard label="Total absences" value={data.totals.absent} tone="red" />
            <StatCard
              label="Wages accrued"
              value={formatMoney(data.totals.wages)}
              hint={`${formatMoney(data.totals.unpaidWages)} still unpaid`}
              tone="primary"
            />
          </div>

          <div className="card">
            <div className="card-head">
              <h3>
                Per worker — {data.from} to {data.to}
              </h3>
            </div>
            {data.rows.length === 0 ? (
              <p className="empty">No attendance recorded in this period.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th className="num">Present</th>
                      <th className="num">Half</th>
                      <th className="num">Absent</th>
                      <th className="num">Wages earned</th>
                      <th className="num">Unpaid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.worker._id}>
                        <td>
                          <strong>{r.worker.name}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {r.worker.role}
                          </div>
                        </td>
                        <td className="num">{r.present}</td>
                        <td className="num">{r.halfDay}</td>
                        <td className="num">{r.absent}</td>
                        <td className="num">{formatMoney(r.wages)}</td>
                        <td className="num">
                          <strong>{formatMoney(r.unpaidWages)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}