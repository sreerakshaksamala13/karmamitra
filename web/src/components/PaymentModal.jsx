import { useState } from 'react';
import Modal from './Modal';
import { formatMoney } from '../utils/format';

/**
 * Used for two jobs:
 *  - mode="create": record a new payout for a worker's outstanding days.
 *  - mode="edit":   update the details of an existing payment.
 */
export default function PaymentModal({ mode, worker, due, payment, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const gross = isEdit ? payment.grossAmount : due?.grossAmount || 0;

  const [form, setForm] = useState({
    deduction: isEdit ? payment.deduction : 0,
    bonus: isEdit ? payment.bonus : 0,
    method: isEdit ? payment.method : 'cash',
    status: isEdit ? payment.status : 'paid',
    notes: isEdit ? payment.notes : '',
    paidAt: isEdit ? new Date(payment.paidAt).toISOString().slice(0, 10) : '',
  });
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const net = Math.max(0, Number(gross) + Number(form.bonus || 0) - Number(form.deduction || 0));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        deduction: Number(form.deduction) || 0,
        bonus: Number(form.bonus) || 0,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Update payment' : `Pay ${worker?.name}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="payment-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Record payment'}
          </button>
        </>
      }
    >
      <form id="payment-form" className="form" onSubmit={submit}>
        <div className="alert-banner" style={{ margin: 0 }}>
          <strong>{worker?.name}</strong> — gross {formatMoney(gross)}
          {due && (
            <div className="muted" style={{ fontSize: 13 }}>
              {due.attendanceCount} day(s) from {due.fromDate} to {due.toDate}
            </div>
          )}
        </div>

        <div className="form-row">
          <label className="field">
            <span>Deduction (advance recovered)</span>
            <input
              type="number"
              min="0"
              value={form.deduction}
              onChange={update('deduction')}
            />
          </label>
          <label className="field">
            <span>Bonus</span>
            <input type="number" min="0" value={form.bonus} onChange={update('bonus')} />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span>Method</span>
            <select value={form.method} onChange={update('method')}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank">Bank transfer</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={update('status')}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
            </select>
          </label>
        </div>

        {isEdit && (
          <label className="field">
            <span>Payment date</span>
            <input type="date" value={form.paidAt} onChange={update('paidAt')} />
          </label>
        )}

        <label className="field">
          <span>Notes</span>
          <textarea rows="2" value={form.notes} onChange={update('notes')} placeholder="Optional" />
        </label>

        <div className="stat-card stat-green">
          <span className="stat-label">Net amount to pay</span>
          <span className="stat-value">{formatMoney(net)}</span>
        </div>
      </form>
    </Modal>
  );
}