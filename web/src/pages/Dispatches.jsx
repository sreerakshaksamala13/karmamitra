import { useCallback, useEffect, useState } from 'react';
import client, { errorMessage } from '../api/client';
import { formatMoney, toDateInput } from '../utils/format';
import Modal from '../components/Modal';

export default function Dispatches() {
  const [date, setDate] = useState(toDateInput());
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [site, setSite] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [customerCharge, setCustomerCharge] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    Promise.all([
      client.get('/sites', { params: { active: true } }),
      client.get('/workers', { params: { active: true } }),
    ])
      .then(([siteRes, workerRes]) => {
        setSites(siteRes.data);
        setWorkers(workerRes.data);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const loadAssignments = useCallback(() => {
    setLoading(true);
    client
      .get('/assignments', { params: { date } })
      .then((res) => setAssignments(res.data))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(loadAssignments, [loadAssignments]);

  const toggleWorker = (workerId) => {
    setSelectedWorkers((current) => {
      if (current.includes(workerId)) return current.filter((id) => id !== workerId);
      return [...current, workerId];
    });
  };

  const createAssignment = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      await client.post('/assignments', {
        date,
        site,
        workers: selectedWorkers,
        customerCharge: Number(customerCharge),
      });
      setMessage('Dispatch saved. Selected workers are assigned to this site and marked present.');
      setSelectedWorkers([]);
      setCustomerCharge('');
      loadAssignments();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setCollectionStatus = async (assignment, status) => {
    setBusyId(assignment._id);
    setError('');
    setMessage('');
    try {
      await client.patch(`/assignments/${assignment._id}/collection`, { status });
      setMessage(status === 'paid' ? 'Customer charge marked collected.' : 'Customer charge marked unpaid.');
      loadAssignments();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const openEdit = (assignment) => {
    setError('');
    setMessage('');
    setEditing({
      id: assignment._id,
      site: assignment.site?._id || assignment.site || '',
      workers: assignment.workers.map((w) => w._id || w),
      customerCharge: String(assignment.customerCharge ?? ''),
    });
  };

  const toggleEditWorker = (workerId) => {
    setEditing((current) => {
      if (!current) return current;
      const has = current.workers.includes(workerId);
      return {
        ...current,
        workers: has ? current.workers.filter((id) => id !== workerId) : [...current.workers, workerId],
      };
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    setBusyId(editing.id);
    setError('');
    setMessage('');
    try {
      await client.put(`/assignments/${editing.id}`, {
        site: editing.site,
        workers: editing.workers,
        customerCharge: Number(editing.customerCharge),
      });
      setMessage('Dispatch updated. Attendance has been synced.');
      setEditing(null);
      loadAssignments();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const deleteAssignment = async (assignment) => {
    if (!window.confirm(`Delete dispatch for ${assignment.site?.name || assignment.siteName} (${assignment.workers.map((w) => w.name).join(', ')})? Workers removed from it will go back to unmarked unless their attendance was edited or paid.`)) return;
    setBusyId(assignment._id);
    setError('');
    setMessage('');
    try {
      const res = await client.delete(`/assignments/${assignment._id}`);
      setMessage(res.data?.removedAttendance ? 'Dispatch deleted and attendance cleared.' : 'Dispatch deleted.');
      loadAssignments();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const availableWorkers = workers.filter(
    (worker) => !assignments.some((assignment) =>
      assignment.workers.some((assigned) => assigned._id === worker._id)
    )
  );
  const unpaidTotal = assignments
    .filter((assignment) => assignment.collectionStatus === 'unpaid')
    .reduce((total, assignment) => total + assignment.customerCharge, 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Daily dispatch</h1>
          <p>Choose a site, assign one or more workers, then record the negotiated customer charge.</p>
        </div>
      </div>

      {error && <p className="form-error" style={{ marginBottom: 14 }}>{error}</p>}
      {message && <p className="form-success">{message}</p>}

      <div className="card" style={{ marginBottom: 18 }}>
        <form className="form" onSubmit={createAssignment}>
          <div className="form-row">
            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  setSelectedWorkers([]);
                }}
                required
              />
            </label>
            <label className="field">
              <span>Site (select first)</span>
              <select value={site} onChange={(event) => {
                setSite(event.target.value);
                setSelectedWorkers([]);
              }} required>
                <option value="">Choose a site</option>
                {sites.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
              </select>
            </label>
          </div>

          {site && (
            <>
              <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={{ fontWeight: 600, marginBottom: 8 }}>
                  Select workers <span className="muted">({selectedWorkers.length} selected)</span>
                </legend>
                {availableWorkers.length === 0 ? (
                  <p className="empty">All active workers are already assigned for this date.</p>
                ) : (
                  <div className="dispatch-worker-list">
                    {availableWorkers.map((worker) => (
                      <label
                        key={worker._id}
                        className={`dispatch-worker-option ${selectedWorkers.includes(worker._id) ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="dispatch-worker-checkbox"
                          checked={selectedWorkers.includes(worker._id)}
                          onChange={() => toggleWorker(worker._id)}
                        />{' '}
                        <span className="dispatch-worker-checkmark" aria-hidden="true" />
                        <span className="dispatch-worker-info">
                          <strong>{worker.name}</strong>
                          <span>{worker.role} · {formatMoney(worker.dailyWage)}/day wage</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
              <div className="form-row" style={{ marginTop: 16 }}>
                <label className="field">
                  <span>Negotiated customer charge (₹, for selected group)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={customerCharge}
                    onChange={(event) => setCustomerCharge(event.target.value)}
                    required
                  />
                </label>
                <div className="field" style={{ justifyContent: 'end' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || selectedWorkers.length < 1 || !customerCharge}
                  >
                    {saving ? 'Saving...' : 'Assign workers'}
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>

      <div className="page-head">
        <div>
          <h2>Dispatches for {date}</h2>
          <p>Unpaid customer charges: <strong>{formatMoney(unpaidTotal)}</strong></p>
        </div>
      </div>
      <div className="card">
        {loading ? (
          <p className="empty">Loading dispatches...</p>
        ) : assignments.length === 0 ? (
          <p className="empty">No dispatches recorded for this date.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Site</th><th>Workers</th><th className="num">Customer charge</th><th>Status / collection date</th><th /></tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment._id}>
                    <td>{assignment.site?.name || assignment.siteName}</td>
                    <td>{assignment.workers.map((worker) => worker.name).join(' + ')}</td>
                    <td className="num">{formatMoney(assignment.customerCharge)}</td>
                    <td>
                      <span className={`badge ${assignment.collectionStatus === 'paid' ? 'badge-paid' : 'badge-muted'}`}>
                        {assignment.collectionStatus === 'paid' ? 'Collected' : 'Unpaid'}
                      </span>
                      {assignment.collectedAt && <span className="muted"> · {new Date(assignment.collectedAt).toLocaleDateString()}</span>}
                    </td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === assignment._id}
                        onClick={() => setCollectionStatus(
                          assignment,
                          assignment.collectionStatus === 'paid' ? 'unpaid' : 'paid'
                        )}
                      >
                        {busyId === assignment._id ? 'Saving...' : assignment.collectionStatus === 'paid' ? 'Mark unpaid' : 'Mark collected today'}
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={busyId === assignment._id}
                        onClick={() => openEdit(assignment)}
                      >
                        Edit
                      </button>{' '}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#b91c1c' }}
                        disabled={busyId === assignment._id}
                        onClick={() => deleteAssignment(assignment)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && (
        <EditDispatchModal
          editing={editing}
          setEditing={setEditing}
          sites={sites}
          workers={workers}
          assignments={assignments}
          busyId={busyId}
          onSave={saveEdit}
          onToggleWorker={toggleEditWorker}
        />
      )}
    </div>
  );
}

function EditDispatchModal({ editing, setEditing, sites, workers, assignments, busyId, onSave, onToggleWorker }) {
  const canSave = editing.site
    && editing.workers.length >= 1
    && editing.customerCharge !== ''
    && Number.isFinite(Number(editing.customerCharge))
    && Number(editing.customerCharge) >= 0;
  const options = workers.filter((w) => {
    const inThis = editing.workers.includes(w._id);
    if (inThis) return true;
    return !assignments.some((a) =>
      String(a._id) !== String(editing.id) &&
      a.workers.some((aw) => String(aw._id || aw) === String(w._id))
    );
  });
  return (
    <Modal
      title="Edit dispatch"
      onClose={() => setEditing(null)}
      wide
      footer={(
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyId === editing.id || !canSave}
            onClick={onSave}
          >
            {busyId === editing.id ? 'Saving...' : 'Save changes'}
          </button>
        </>
      )}
    >
      <form className="form" onSubmit={onSave}>
        <label className="field">
          <span>Site</span>
          <select
            value={editing.site}
            onChange={(e) => setEditing((c) => ({ ...c, site: e.target.value }))}
            required
          >
            {sites.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
          </select>
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 8 }}>
            Workers <span className="muted">({editing.workers.length} selected)</span>
          </legend>
          <div className="dispatch-worker-list">
            {options.map((worker) => (
              <label
                key={worker._id}
                className={`dispatch-worker-option ${editing.workers.includes(worker._id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  className="dispatch-worker-checkbox"
                  checked={editing.workers.includes(worker._id)}
                  onChange={() => onToggleWorker(worker._id)}
                />{' '}
                <span className="dispatch-worker-checkmark" aria-hidden="true" />
                <span className="dispatch-worker-info">
                  <strong>{worker.name}</strong>
                  <span>{worker.role} · {formatMoney(worker.dailyWage)}/day wage</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field" style={{ marginTop: 16 }}>
          <span>Negotiated customer charge (₹)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editing.customerCharge}
            onChange={(e) => setEditing((c) => ({ ...c, customerCharge: e.target.value }))}
            required
          />
        </label>
      </form>
    </Modal>
  );
}
