import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client, { errorMessage } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Field, Loading, StatCard } from '../components/UI';
import { colors, radius, spacing } from '../theme';
import { addDays, formatMoney, toDateInput } from '../utils/format';

const initialTo = toDateInput();

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function ReportsScreen() {
  const [from, setFrom] = useState(addDays(initialTo, -6));
  const [to, setTo] = useState(initialTo);
  const [site, setSite] = useState('');
  const [filters, setFilters] = useState({ from: addDays(initialTo, -6), to: initialTo, site: '' });
  const [sites, setSites] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [siteError, setSiteError] = useState('');

  useEffect(() => {
    client
      .get('/sites')
      .then((res) => setSites(res.data))
      .catch((err) => setSiteError(errorMessage(err)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await client.get('/attendance/summary', { params: filters });
      setData(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const applyFilters = () => {
    if (!isValidDate(from) || !isValidDate(to)) {
      setError('Enter valid dates in YYYY-MM-DD format.');
      return;
    }
    if (from > to) {
      setError('The start date must be on or before the end date.');
      return;
    }
    setFilters({ from, to, site: site || undefined });
  };

  const setQuickRange = (days) => {
    const end = toDateInput();
    const start = addDays(end, -days + 1);
    setFrom(start);
    setTo(end);
    setFilters({ from: start, to: end, site: site || undefined });
  };

  const selectSite = (id) => {
    setSite(id);
    setFilters((f) => ({ ...f, site: id || undefined }));
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>Attendance and wages for any date range.</Text>

      <Card>
        <View style={styles.quickRanges}>
          <Button title="Last 7 days" variant="ghost" onPress={() => setQuickRange(7)} style={styles.quickButton} />
          <Button title="Last 30 days" variant="ghost" onPress={() => setQuickRange(30)} style={styles.quickButton} />
        </View>
        <View style={styles.dates}>
          <Field label="From" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" />
          <View style={{ width: spacing.sm }} />
          <Field label="To" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" />
        </View>

        <Text style={styles.label}>Site</Text>
        <View style={styles.sites}>
          <Pressable onPress={() => selectSite('')} style={[styles.siteChip, !site && styles.siteChipActive]}>
            <Text style={[styles.siteText, !site && styles.siteTextActive]}>All sites</Text>
          </Pressable>
          {sites.map((item) => (
            <Pressable
              key={item._id}
              onPress={() => selectSite(item._id)}
              style={[styles.siteChip, site === item._id && styles.siteChipActive]}
            >
              <Text style={[styles.siteText, site === item._id && styles.siteTextActive]}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <Button title="Apply filters" onPress={applyFilters} style={{ marginTop: spacing.md }} />
      </Card>

      <ErrorText>{error}</ErrorText>
      <ErrorText>{siteError}</ErrorText>

      {loading ? (
        <Loading />
      ) : data ? (
        <>
          <View style={styles.stats}>
            <StatCard label="Present" value={data.totals.present} tone="green" />
            <View style={{ width: spacing.sm }} />
            <StatCard label="Half days" value={data.totals.halfDay} tone="amber" />
          </View>
          <View style={[styles.stats, { marginTop: spacing.sm }]}>
            <StatCard label="Absences" value={data.totals.absent} tone="red" />
            <View style={{ width: spacing.sm }} />
            <StatCard
              label="Wages accrued"
              value={formatMoney(data.totals.wages)}
              hint={`${formatMoney(data.totals.unpaidWages)} still unpaid`}
              tone="primary"
            />
          </View>

          <Text style={styles.sectionTitle}>Per worker · {data.from} to {data.to}</Text>
          {data.rows.length === 0 ? (
            <EmptyState>No attendance recorded in this period.</EmptyState>
          ) : (
            data.rows.map((row) => (
              <Card key={row.worker._id}>
                <View style={styles.workerHeading}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workerName}>{row.worker.name}</Text>
                    <Text style={styles.workerRole}>{row.worker.role || 'Worker'}</Text>
                  </View>
                  <Text style={styles.wages}>{formatMoney(row.wages)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detail}>Present {row.present}</Text>
                  <Text style={styles.detail}>Half {row.halfDay}</Text>
                  <Text style={styles.detail}>Absent {row.absent}</Text>
                </View>
                <Text style={styles.unpaid}>Unpaid: {formatMoney(row.unpaidWages)}</Text>
              </Card>
            ))
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  subtitle: { color: colors.muted, marginBottom: spacing.md },
  quickRanges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  quickButton: { flex: 1 },
  dates: { flexDirection: 'row' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  sites: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  siteChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  siteChipActive: { borderColor: colors.primary, backgroundColor: '#e5edff' },
  siteText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  siteTextActive: { color: colors.primary },
  stats: { flexDirection: 'row' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginVertical: spacing.md },
  workerHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  workerName: { fontSize: 16, fontWeight: '700', color: colors.text },
  workerRole: { color: colors.muted, fontSize: 12, marginTop: 2 },
  wages: { fontSize: 16, fontWeight: '800', color: colors.primary },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detail: { color: colors.muted, fontSize: 12 },
  unpaid: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: spacing.sm },
});
