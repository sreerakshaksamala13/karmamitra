import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client, { errorMessage } from '../api/client';
import { Badge, Button, Card, EmptyState, ErrorText, Field, Loading, SuccessText } from '../components/UI';
import { colors, radius, spacing } from '../theme';
import { addDays, formatMoney, toDateInput, weekdayName } from '../utils/format';

export default function DispatchesScreen() {
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

  const [loadingSites, setLoadingSites] = useState(true);

  const loadLookups = useCallback(async () => {
    setLoadingSites(true);
    try {
      const [siteRes, workerRes] = await Promise.all([
        client.get('/sites', { params: { active: true } }),
        client.get('/workers', { params: { active: true } }),
      ]);
      setSites(Array.isArray(siteRes.data) ? siteRes.data : []);
      setWorkers(Array.isArray(workerRes.data) ? workerRes.data : []);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingSites(false);
    }
  }, []);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/assignments', { params: { date } });
      setAssignments(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      loadAssignments();
      loadLookups();
    }, [loadAssignments, loadLookups])
  );

  const toggleWorker = (workerId) => {
    setSelectedWorkers((current) => {
      if (current.includes(workerId)) return current.filter((id) => id !== workerId);
      return [...current, workerId];
    });
  };

  const changeDate = (nextDate) => {
    setDate(nextDate);
    setSelectedWorkers([]);
  };

  const createAssignment = async () => {
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
      setMessage('Dispatch saved. Workers are assigned and marked present.');
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

  const editWorkerOptions = editing
    ? workers.filter((w) => {
        const inThis = editing.workers.includes(w._id);
        if (inThis) return true;
        return !assignments.some((a) =>
          String(a._id) !== String(editing.id) &&
          a.workers.some((aw) => String(aw._id || aw) === String(w._id))
        );
      })
    : [];

  const saveEdit = async () => {
    if (!editing) return;
    setError('');
    setMessage('');
    setBusyId(editing.id);
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

  const deleteAssignment = (assignment) => {
    Alert.alert(
      'Delete dispatch?',
      `${assignment.site?.name || assignment.siteName} (${assignment.workers.map((w) => w.name).join(', ')}) will be removed. Attendance created by it goes back to unmarked unless edited or paid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ]
    );
  };

  const availableWorkers = workers.filter(
    (worker) => !assignments.some((assignment) =>
      assignment.workers.some((assigned) => String(assigned._id || assigned) === String(worker._id))
    )
  );
  const unpaidTotal = assignments
    .filter((assignment) => assignment.collectionStatus === 'unpaid')
    .reduce((total, assignment) => total + assignment.customerCharge, 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Daily dispatch</Text>
      <Text style={styles.subtitle}>Choose a site, select workers, and enter the agreed customer charge.</Text>

      <Card style={styles.dateBar}>
        <Pressable style={styles.dateNav} onPress={() => changeDate(addDays(date, -1))}>
          <Text style={styles.dateNavText}>‹ Prev</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.dateText}>{weekdayName(date)}</Text>
          <Text style={styles.dateSub}>{date}</Text>
        </View>
        <Pressable style={styles.dateNav} onPress={() => changeDate(addDays(date, 1))}>
          <Text style={styles.dateNavText}>Next ›</Text>
        </Pressable>
      </Card>
      {date !== toDateInput() && (
        <Button title="Jump to today" variant="ghost" onPress={() => changeDate(toDateInput())} style={{ marginBottom: spacing.md }} />
      )}

      <ErrorText>{error}</ErrorText>
      <SuccessText>{message}</SuccessText>

      <Card>
        <Text style={styles.sectionTitle}>1. Select site</Text>
        {loadingSites ? (
          <Loading label="Loading sites..." />
        ) : sites.length === 0 ? (
          <EmptyState>Add an active site before creating a dispatch. Pull down / refocus to retry if this keeps showing.</EmptyState>
        ) : (
          <View style={styles.chips}>
            {sites.map((item) => (
              <Pressable
                key={item._id}
                onPress={() => {
                  setSite(item._id);
                  setSelectedWorkers([]);
                }}
                style={[styles.chip, site === item._id && styles.chipActive]}
              >
                <Text style={[styles.chipText, site === item._id && styles.chipTextActive]}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {site ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
              2. Select workers ({selectedWorkers.length} selected)
            </Text>
            {availableWorkers.length === 0 ? (
              <EmptyState>All active workers are already assigned for this date.</EmptyState>
            ) : (
              availableWorkers.map((worker) => {
                const selected = selectedWorkers.map(String).includes(String(worker._id));
                return (
                  <Pressable
                    key={worker._id}
                    onPress={() => toggleWorker(worker._id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={[styles.workerOption, selected && styles.workerSelected]}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.workerName}>{worker.name}</Text>
                      <Text style={styles.meta}>{worker.role} · {formatMoney(worker.dailyWage)}/day wage</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
            <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>3. Negotiated customer charge</Text>
            <Field
              label="Total for the selected group (₹)"
              value={customerCharge}
              onChangeText={setCustomerCharge}
              keyboardType="decimal-pad"
              placeholder="Enter agreed amount"
            />
            <Button
              title={saving ? 'Saving...' : 'Assign workers'}
              onPress={createAssignment}
              disabled={saving || selectedWorkers.length === 0 || customerCharge === '' || !Number.isFinite(Number(customerCharge)) || Number(customerCharge) < 0}
            />
          </>
        ) : null}
      </Card>

      {editing && (
        <Card>
          <Text style={styles.sectionTitle}>Edit dispatch ({editing.workers.length} selected)</Text>
          <Text style={[styles.sectionTitle, { marginTop: spacing.sm }]}>Site</Text>
          <View style={styles.chips}>
            {sites.map((item) => (
              <Pressable
                key={item._id}
                onPress={() => setEditing((c) => ({ ...c, site: item._id }))}
                style={[styles.chip, editing.site === item._id && styles.chipActive]}
              >
                <Text style={[styles.chipText, editing.site === item._id && styles.chipTextActive]}>{item.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Workers</Text>
          {editWorkerOptions.map((worker) => {
            const selected = editing.workers.includes(worker._id);
            return (
              <Pressable
                key={worker._id}
                onPress={() => toggleEditWorker(worker._id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                style={[styles.workerOption, selected && styles.workerSelected]}
              >
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.meta}>{worker.role} · {formatMoney(worker.dailyWage)}/day wage</Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Customer charge</Text>
          <Field
            label="Total for the selected group (₹)"
            value={editing.customerCharge}
            onChangeText={(v) => setEditing((c) => ({ ...c, customerCharge: v }))}
            keyboardType="decimal-pad"
            placeholder="Enter agreed amount"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="ghost" onPress={() => setEditing(null)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={busyId === editing.id ? 'Saving...' : 'Save changes'}
                onPress={saveEdit}
                disabled={busyId === editing.id || !editing.site || editing.workers.length === 0 || editing.customerCharge === '' || !Number.isFinite(Number(editing.customerCharge)) || Number(editing.customerCharge) < 0}
              />
            </View>
          </View>
        </Card>
      )}

      <Text style={styles.sectionTitle}>Dispatches for {date}</Text>
      <Card>
        <Text style={styles.meta}>Unpaid customer charges: {formatMoney(unpaidTotal)}</Text>
      </Card>
      {loading ? (
        <Loading />
      ) : assignments.length === 0 ? (
        <EmptyState>No dispatches recorded for this date.</EmptyState>
      ) : (
        assignments.map((assignment) => (
          <Card key={assignment._id}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={styles.workerName}>{assignment.site?.name || assignment.siteName}</Text>
                <Text style={styles.meta}>{assignment.workers.map((worker) => worker.name).join(' + ')}</Text>
              </View>
              <Text style={styles.amount}>{formatMoney(assignment.customerCharge)}</Text>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <Badge
                label={assignment.collectionStatus === 'paid' ? 'Collected' : 'Unpaid'}
                tone={assignment.collectionStatus === 'paid' ? 'green' : 'amber'}
              />
              {assignment.collectedAt ? (
                <Text style={styles.meta}>Collected {new Date(assignment.collectedAt).toLocaleDateString()}</Text>
              ) : null}
            </View>
            <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Button
                  title="Edit"
                  variant="ghost"
                  disabled={busyId === assignment._id}
                  onPress={() => openEdit(assignment)}
                />
                <Button
                  title="Delete"
                  variant="danger"
                  disabled={busyId === assignment._id}
                  onPress={() => deleteAssignment(assignment)}
                />
              </View>
              <Button
                title={busyId === assignment._id ? 'Saving...' : assignment.collectionStatus === 'paid' ? 'Mark unpaid' : 'Mark collected today'}
                variant="ghost"
                disabled={busyId === assignment._id}
                onPress={() => setCollectionStatus(
                  assignment,
                  assignment.collectionStatus === 'paid' ? 'unpaid' : 'paid'
                )}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, marginTop: 4, marginBottom: spacing.md },
  dateBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateNav: { padding: spacing.sm },
  dateNavText: { color: colors.primary, fontWeight: '700' },
  dateText: { fontWeight: '800', color: colors.text, fontSize: 16 },
  dateSub: { color: colors.muted, fontSize: 12 },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipActive: { borderColor: colors.primary, backgroundColor: '#e5edff' },
  chipText: { color: colors.muted, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  workerOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.surface },
  workerSelected: { borderColor: colors.primary, backgroundColor: '#f1f5ff' },
  checkbox: { width: 22, height: 22, borderWidth: 1.5, borderColor: '#aeb9ca', borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.white, fontWeight: '800' },
  workerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  amount: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
