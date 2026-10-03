import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import client, { errorMessage } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Loading, StatCard, SuccessText } from '../components/UI';
import { colors, radius, spacing } from '../theme';
import { addDays, formatMoney, statusFactor, toDateInput, weekdayName } from '../utils/format';

const STATUSES = ['present', 'half-day', 'absent'];
const SHORT = { present: 'Present', 'half-day': 'Half', absent: 'Absent' };

export default function AttendanceScreen() {
  const [date, setDate] = useState(toDateInput());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await client.get('/attendance/sheet', { params: { date } });
      setRows(res.data.rows.map((r) => ({ ...r, status: r.status || 'present' })));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = (workerId, status) =>
    setRows((prev) => prev.map((r) => (r.worker._id === workerId ? { ...r, status } : r)));

  const markAll = (status) => setRows((prev) => prev.map((r) => ({ ...r, status })));

  const summary = useMemo(
    () => ({
      present: rows.filter((r) => r.status === 'present').length,
      halfDay: rows.filter((r) => r.status === 'half-day').length,
      absent: rows.filter((r) => r.status === 'absent').length,
      wage: rows.reduce((s, r) => s + r.wageRate * statusFactor(r.status), 0),
    }),
    [rows]
  );

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const entries = rows.map((r) => ({ worker: r.worker._id, status: r.status, wageRate: r.wageRate }));
      const res = await client.post('/attendance/bulk', { date, entries });
      setMessage(`Saved ${res.data.marked} worker(s) for ${date}.`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.dateBar}>
        <Pressable style={styles.dateNav} onPress={() => setDate(addDays(date, -1))}>
          <Text style={styles.dateNavText}>‹ Prev</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.dateText}>{weekdayName(date)}</Text>
          <Text style={styles.dateSub}>{date}</Text>
        </View>
        <Pressable style={styles.dateNav} onPress={() => setDate(addDays(date, 1))}>
          <Text style={styles.dateNavText}>Next ›</Text>
        </Pressable>
      </View>

      {date !== toDateInput() && (
        <Button
          title="Jump to today"
          variant="ghost"
          onPress={() => setDate(toDateInput())}
          style={{ marginBottom: spacing.md }}
        />
      )}

      <ErrorText>{error}</ErrorText>
      <SuccessText>{message}</SuccessText>

      <View style={styles.statsRow}>
        <StatCard label="Present" value={summary.present} tone="green" />
        <View style={{ width: spacing.sm }} />
        <StatCard label="Half" value={summary.halfDay} tone="amber" />
        <View style={{ width: spacing.sm }} />
        <StatCard label="Absent" value={summary.absent} tone="red" />
      </View>
      <Card style={{ marginTop: spacing.md }}>
        <StatCard label="Wage for the day" value={formatMoney(summary.wage)} tone="primary" />
      </Card>

      <View style={styles.actions}>
        <Button title="All present" variant="ghost" onPress={() => markAll('present')} style={{ flex: 1 }} />
        <View style={{ width: spacing.sm }} />
        <Button title="All absent" variant="ghost" onPress={() => markAll('absent')} style={{ flex: 1 }} />
      </View>

      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState>No active workers. Add workers first.</EmptyState>
      ) : (
        rows.map((r) => <WorkerRow key={r.worker._id} row={r} onSet={setStatus} />)
      )}

      {rows.length > 0 && (
        <Button
          title={saving ? 'Saving...' : 'Save attendance'}
          onPress={save}
          disabled={saving}
          style={{ marginTop: spacing.sm }}
        />
      )}
    </ScrollView>
  );
}

function WorkerRow({ row, onSet }) {
  const r = row;
  return (
    <Card style={styles.workerCard}>
      <View style={styles.workerHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.workerName}>{r.worker.name}</Text>
          <Text style={styles.workerMeta}>
            {r.worker.role} · {formatMoney(r.wageRate)}/day
          </Text>
        </View>
        <Text style={styles.workerWage}>{formatMoney(r.wageRate * statusFactor(r.status))}</Text>
      </View>
      <View style={styles.seg}>
        {STATUSES.map((s) => {
          const active = r.status === s;
          const tone = { present: colors.greenBg, 'half-day': colors.amberBg, absent: colors.redBg }[s];
          const fg = { present: colors.green, 'half-day': colors.amber, absent: colors.red }[s];
          return (
            <Pressable
              key={s}
              onPress={() => onSet(r.worker._id, s)}
              style={[styles.segBtn, active && { backgroundColor: tone }]}
            >
              <Text style={[styles.segText, active && { color: fg, fontWeight: '800' }]}>
                {SHORT[s]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dateNav: { padding: spacing.sm },
  dateNavText: { color: colors.primary, fontWeight: '700' },
  dateText: { fontWeight: '800', color: colors.text, fontSize: 16 },
  dateSub: { color: colors.muted, fontSize: 12 },
  statsRow: { flexDirection: 'row' },
  actions: { flexDirection: 'row', marginBottom: spacing.md },
  workerCard: { paddingVertical: spacing.md },
  workerHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  workerName: { fontWeight: '700', fontSize: 16, color: colors.text },
  workerMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  workerWage: { fontWeight: '800', color: colors.text },
  seg: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  segBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
});