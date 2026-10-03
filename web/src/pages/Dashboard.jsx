import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import StatCard from '../components/StatCard';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import { formatMoney, isPayoutDay, prettyDateTime, toDateInput, weekdayName } from '../utils/format';

export default function Dashboard() {
  const [date, setDate] = useState(toDateInput());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    client
      .get('/dashboard', { params: { date } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(load, [load]);

  if (loading && !data) return <Spinner />;
  if (!data) return <p className="empty">Could not load dashboard.</p>;

  const { counts, today, outstanding, thisWeekPaid, recentPayments } = data;
  const siteDispatches = data.siteDispatches || [];
  const payoutToday = isPayoutDay(date);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            {weekdayName(date)}, {date}
          </p>
        </div>
        <label className="field" style={{ maxWidth: 180 }}>
          <span>Viewing date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {payoutToday && (
        <div className="alert-banner">
          <strong>Today is payout day.</strong> {formatMoney(outstanding.total)} is
          outstanding across {outstanding.days} worked days.{' '}
          <Link to="/payments" style={{ textDecoration: 'underline' }}>
            Go to payments
          </Link>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard
          label="Active workers"
          value={counts.activeWorkers}
          hint={`${counts.totalWorkers} total`}
          tone="primary"
        />
        <StatCard label="Active sites" value={counts.activeSites} hint="Construction sites" />
        <StatCard
          label="Today present"
          value={today.present}
          hint={`${today.halfDay} half day, ${today.absent} absent, ${today.unmarked} unmarked`}
          tone="green"
        />
        <StatCard
          label="Today's wage cost"
          value={formatMoney(today.totalWage)}
          hint={`${today.marked} of ${counts.activeWorkers} marked`}
        />
      </div>

      <div className="grid grid-2">
        <StatCard
          label="Outstanding to pay"
          value={formatMoney(outstanding.total)}
          hint={`${outstanding.days} unpaid days across all workers`}
          tone="amber"
        />
        <StatCard
          label="Paid this week"
          value={formatMoney(thisWeekPaid.total)}
          hint={`${thisWeekPaid.payments} payment(s) since ${data.weekStart}`}
          tone="green"
        />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h3>Dispatches by site · {date}</h3>
          <Link className="btn btn-ghost btn-sm" to="/dispatch">
            View all
          </Link>
        </div>
        {siteDispatches.length === 0 ? (
          <p className="empty">No dispatches recorded for this date.</p>
        ) : (
          <div className="grid grid-cards">
            {siteDispatches.map((d) => (
              <button
                key={d._id}
                type="button"
                className="card"
                style={{ marginBottom: 0, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setDetail(d)}
              >
                <div className="card-head">
                  <h3>{d.site?.name || d.siteName}</h3>
                  <span className={`badge ${d.collectionStatus === 'paid' ? 'badge-paid' : 'badge-muted'}`}>
                    {d.collectionStatus === 'paid' ? 'Collected' : 'Unpaid'}
                  </span>
                </div>
                <p style={{ margin: '0 0 4px' }}>
                  <strong>{d.workers.length}</strong> worker(s): {d.workers.map((w) => w.name).join(', ')}
                </p>
                <p className="muted" style={{ margin: 0 }}>
                  Customer charge: <strong>{formatMoney(d.customerCharge)}</strong>
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {detail && (
        <Modal title={detail.site?.name || detail.siteName} onClose={() => setDetail(null)}>
          <p style={{ marginTop: 0 }}>
            <strong>Date:</strong> {detail.date}
          </p>
          <p>
            <strong>Workers ({detail.workers.length}):</strong>{' '}
            {detail.workers.map((w) => `${w.name} (${w.role}, ${formatMoney(w.dailyWage)}/day)`).join(' · ')}
          </p>
          <p>
            <strong>Customer charge:</strong> {formatMoney(detail.customerCharge)}
          </p>
          <p>
            <strong>Status:</strong> {detail.collectionStatus === 'paid' ? 'Collected' : 'Unpaid'}
            {detail.collectedAt ? ` · ${new Date(detail.collectedAt).toLocaleDateString()}` : ''}
          </p>
        </Modal>
      )}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">
          <h3>Recent payments</h3>
          <Link className="btn btn-ghost btn-sm" to="/payments">
            View all
          </Link>
        </div>
        {recentPayments.length === 0 ? (
          <p className="empty">No payments recorded yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Period</th>
                  <th>Method</th>
                  <th className="num">Net paid</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p._id}>
                    <td>{p.worker?.name || 'Removed worker'}</td>
                    <td className="muted">
                      {p.fromDate} → {p.toDate}
                    </td>
                    <td>
                      <span className="badge badge-muted">{p.method}</span>
                    </td>
                    <td className="num">{formatMoney(p.netAmount)}</td>
                    <td className="muted">{prettyDateTime(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}