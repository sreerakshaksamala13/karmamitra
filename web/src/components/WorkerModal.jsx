import { useState } from 'react';
import Modal from './Modal';

const EMPTY = {
  name: '',
  phone: '',
  role: 'Mason',
  dailyWage: 500,
  site: '',
  address: '',
  idNumber: '',
  notes: '',
  active: true,
};

const ROLES = ['Mason', 'Helper', 'Carpenter', 'Painter', 'Plumber', 'Electrician', 'Other'];

export default function WorkerModal({ worker, sites, onClose, onSubmit }) {
  const isEdit = Boolean(worker?._id);
  const [form, setForm] = useState(
    isEdit
      ? {
          ...EMPTY,
          ...worker,
          site: worker.site?._id || worker.site || '',
        }
      : EMPTY
  );
  const [busy, setBusy] = useState(false);

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        ...form,
        dailyWage: Number(form.dailyWage) || 0,
        site: form.site || null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isEdit ? `Edit ${worker.name}` : 'Add worker'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="worker-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Add worker'}
          </button>
        </>
      }
    >
      <form id="worker-form" className="form" onSubmit={submit}>
        <div className="form-row">
          <label className="field">
            <span>Full name</span>
            <input value={form.name} onChange={update('name')} required placeholder="e.g. Ravi Kumar" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={form.phone} onChange={update('phone')} placeholder="Optional" inputMode="numeric" />
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span>Role</span>
            <select value={form.role} onChange={update('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Daily wage (₹)</span>
            <input
              type="number"
              min="0"
              value={form.dailyWage}
              onChange={update('dailyWage')}
              required
            />
          </label>
        </div>

        <label className="field">
          <span>Site</span>
          <select value={form.site} onChange={update('site')}>
            <option value="">Not assigned</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="form-row">
          <label className="field">
            <span>ID number (Aadhaar)</span>
            <input value={form.idNumber} onChange={update('idNumber')} placeholder="Optional" />
          </label>
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
        </div>

        <label className="field">
          <span>Address</span>
          <input value={form.address} onChange={update('address')} placeholder="Optional" />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea rows="2" value={form.notes} onChange={update('notes')} placeholder="Optional" />
        </label>
      </form>
    </Modal>
  );
}