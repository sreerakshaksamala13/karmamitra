import { useCallback, useEffect, useState } from 'react';
import client, { errorMessage } from '../api/client';
import Spinner from '../components/Spinner';
import PaymentModal from '../components/PaymentModal';
import { formatMoney, isPayoutDay, prettyDateTime, toDateInput } from '../utils/format';

export default function Payments() {
  const [tab, setTab] = useState('dues');
  const [toDate, setToDate] = useState(toDateInput());
  const [site, setSite] = useState('');
  const [sites, setSites] = useState([]);
  const [dues, setDues] = useState({ rows: [], totalDue: 0 });
  const [payments, setPayments] = useState([]);
  const [loadingDues, setLoadingDues] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null); // { mode, worker, due, payment }

  useEffect(() => {
    client.get('/sites').then((res) => setSites(res.data)).catch(() => {});
  }, []);

  const loadDues = useCallback(() => {
    setLoadingDues(true);
    client
      .get('/payments/dues', { params: { to: toDate, site: site || undefined } })
      .then((res) => setDues(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoadingDues(false));
  }, [toDate, site]);

  const loadPayments = useCallback(() => {
    setLoadingPayments(true);
    client
      .get('/payments')
      .then((res) => setPayments(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoadingPayments(false));
  }, []);

  useEffect(loadDues, [loadDues]);
  useEffect(loadPayments, [loadPayments]);

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 4000);
  };

  const submitCreate = async (payload) => {
    const { worker, due } = modal;
    try {
      await client.post('/payments', { worker: worker._id, toDate: due.toDate, ...payload });
      setModal(null);
      flash(`Payment recorded for ${worker.name}.`);
      loadDues();
      loadPayments();
    } catch (err) {
      setError(errorMessage(err));
      setModal(null);
    }
  };

  const submitEdit = async (payload) => {
    try {
      await client.put(`/payments/${modal.payment._id}`, payload);
      setModal(null);
      flash('Payment updated.');
      loadPayments();
      loadDues();
    } catch (err) {
      setError(errorMessage(err));
      setModal(null);
    }
  };

  const reverse = async (payment) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Reverse payment of ${formatMoney(payment.netAmount)} to ${payment.worker?.name}?`)) {
      return;
    }
    try {
      await client.delete(`/payments/${payment._id}`);
      flash('Payment reversed — those days are owed again.');
      loadPayments();
      loadDues();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Payments</h1>
          <p>Pay out every Wednesday and update payment details any time.</p>
        </div>
        <div className="seg">
          <button className={tab === 'dues' ? 'active-present' : ''} onClick={() => setTab('dues')}>
            To pay
          </button>
          <button className={tab === 'history' ? 'active-present' : ''} onClick={() => setTab('history')}>
            History
          </button>
        </div>
      </div>

      {isPayoutDay(toDate) && tab === 'dues' && (
        <div className="alert-banner">
          <strong>Payout day.</strong> {formatMoney(dues.totalDue)} outstanding across{' '}
          {dues.rows.length} worker(s).
        </div>
      )}

      {error && <p className="form-error" style={{ marginBottom: 14 }}>{error}</p>}
      {message && <p className="form-success">{message}</p>}

      {tab === 'dues' && (
        <>
          <div className="filter-bar">
            <label className="field">
              <span>Pay all days up to</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
            <div className="stat-card stat-amber" style={{ marginLeft: 'auto', minWidth: 200 }}>
              <span className="stat-label">Total outstanding</span>
              <span className="stat-value">{formatMoney(dues.totalDue)}</span>
            </div>
          </div>

          <div className="card">
            {loadingDues ? (
              <Spinner />
            ) : dues.rows.length === 0 ? (
              <p className="empty">Everyone is fully paid up to {toDate}.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Site</th>
                      <th className="num">Days</th>
                      <th>Period</th>
                      <th className="num">Gross due</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {dues.rows.map((row) => (
                      <tr key={row.worker._id}>
                        <td>
                          <strong>{row.worker.name}</strong>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {row.worker.role}
                          </div>
                        </td>
                        <td className="muted">{row.worker.site?.name || '—'}</td>
                        <td className="num">
                          {row.attendanceCount}
                          <div className="muted" style={{ fontSize: 12 }}>
                            {row.presentDays}P / {row.halfDays}H
                          </div>
                        </td>
                        <td className="muted">
                          {row.fromDate} → {row.toDate}
                        </td>
                        <td className="num">
                          <strong>{formatMoney(row.grossAmount)}</strong>
                        </td>
                        <td className="num">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setModal({ mode: 'create', worker: row.worker, due: row })}
                          >
                            Pay
                          </button>
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

      {tab === 'history' && (
        <div className="card">
          {loadingPayments ? (
            <Spinner />
          ) : payments.length === 0 ? (
            <p className="empty">No payments recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Period</th>
                    <th className="num">Gross</th>
                    <th className="num">Deduction</th>
                    <th className="num">Net</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Paid on</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <strong>{p.worker?.name || 'Removed'}</strong>
                      </td>
                      <td className="muted">
                        {p.fromDate} → {p.toDate}
                      </td>
                      <td className="num">{formatMoney(p.grossAmount)}</td>
                      <td className="num">{formatMoney(p.deduction)}</td>
                      <td className="num">
                        <strong>{formatMoney(p.netAmount)}</strong>
                      </td>
                      <td>
                        <span className="badge badge-muted">{p.method}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${p.status}`}>{p.status}</span>
                      </td>
                      <td className="muted">{prettyDateTime(p.paidAt)}</td>
                      <td className="num">
                        <div className="row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setModal({ mode: 'edit', payment: p, worker: p.worker })}
                          >
                            Edit
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => reverse(p)}>
                            Reverse
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
      )}

      {modal?.mode === 'create' && (
        <PaymentModal
          mode="create"
          worker={modal.worker}
          due={modal.due}
          onClose={() => setModal(null)}
          onSubmit={submitCreate}
        />
      )}
      {modal?.mode === 'edit' && (
        <PaymentModal
          mode="edit"
          worker={modal.worker}
          payment={modal.payment}
          onClose={() => setModal(null)}
          onSubmit={submitEdit}
        />
      )}
    </div>
  );
}