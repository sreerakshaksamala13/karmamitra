import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Button, Card, EmptyState, ErrorText, Loading, SectionTitle, StatCard, Badge } from '../components/UI';
import { colors, radius, spacing } from '../theme';
import { formatMoney, isPayoutDay, toDateInput, weekdayName } from '../utils/format';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [detail, setDetail] = useState(null);

  const date = toDateInput();

  const load = useCallback(async () => {
    try {
      const res = await client.get('/dashboard', { params: { date } });
      setData(res.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Refresh whenever the screen comes into focus (e.g. after marking attendance).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading && !data) return <Loading />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      <ErrorText>{error}</ErrorText>

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.hello}>Hello, {user?.name}</Text>
          <Text style={styles.date}>
            {weekdayName(date)}, {date}
          </Text>
        </View>
      </View>

      {isPayoutDay(date) && data && (
        <Card style={styles.payout}>
          <Text style={styles.payoutTitle}>Today is payout day</Text>
          <Text style={styles.payoutText}>
            {formatMoney(data.outstanding.total)} outstanding across {data.outstanding.days} worked days.
          </Text>
        </Card>
      )}

      {data && (
        <>
          <View style={styles.row}>
            <StatCard label="Active workers" value={data.counts.activeWorkers} tone="primary" hint={`${data.counts.totalWorkers} total`} />
            <View style={{ width: spacing.md }} />
            <StatCard label="Sites" value={data.counts.activeSites} />
          </View>
          <View style={[styles.row, { marginTop: spacing.md }]}>
            <StatCard
              label="Present today"
              value={data.today.present}
              tone="green"
              hint={`${data.today.halfDay} half, ${data.today.absent} absent`}
            />
            <View style={{ width: spacing.md }} />
            <StatCard label="Today's wage" value={formatMoney(data.today.totalWage)} hint={`${data.today.marked} marked`} />
          </View>
          <View style={[styles.row, { marginTop: spacing.md }]}>
            <StatCard
              label="Outstanding"
              value={formatMoney(data.outstanding.total)}
              tone="amber"
              hint={`${data.outstanding.days} unpaid days`}
            />
            <View style={{ width: spacing.md }} />
            <StatCard
              label="Paid this week"
              value={formatMoney(data.thisWeekPaid.total)}
              tone="green"
              hint={`${data.thisWeekPaid.payments} payment(s)`}
            />
          </View>

          <Card style={{ marginTop: spacing.lg }}>
            <SectionTitle>Dispatches by site · {date}</SectionTitle>
            {(data.siteDispatches || []).length === 0 ? (
              <EmptyState>No dispatches recorded for this date.</EmptyState>
            ) : (
              (data.siteDispatches || []).map((d) => (
                <Pressable key={d._id} onPress={() => setDetail(d)}>
                  <Card style={{ marginBottom: spacing.sm }}>
                    <View style={styles.paymentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.paymentName}>{d.site?.name || d.siteName}</Text>
                        <Text style={styles.paymentMeta}>
                          {d.workers.length} worker(s): {d.workers.map((w) => w.name).join(', ')}
                        </Text>
                        <Text style={styles.paymentMeta}>
                          Charge {formatMoney(d.customerCharge)}
                        </Text>
                      </View>
                      <Badge label={d.collectionStatus === 'paid' ? 'Collected' : 'Unpaid'} tone={d.collectionStatus === 'paid' ? 'green' : 'amber'} />
                    </View>
                  </Card>
                </Pressable>
              ))
            )}
          </Card>

          <Card style={{ marginTop: spacing.lg }}>
            <SectionTitle>Recent payments</SectionTitle>
            {data.recentPayments.length === 0 ? (
              <EmptyState>No payments recorded yet.</EmptyState>
            ) : (
              data.recentPayments.map((p) => (
                <View key={p._id} style={styles.paymentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentName}>{p.worker?.name || 'Removed worker'}</Text>
                    <Text style={styles.paymentMeta}>
                      {p.fromDate} → {p.toDate} · {p.method}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>{formatMoney(p.netAmount)}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}
      {detail && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setDetail(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{detail.site?.name || detail.siteName}</Text>
              <Text style={styles.sheetText}>Date: {detail.date}</Text>
              <Text style={styles.sheetText}>
                Workers ({detail.workers.length}): {detail.workers.map((w) => `${w.name} (${w.role})`).join(', ')}
              </Text>
              <Text style={styles.sheetText}>Customer charge: {formatMoney(detail.customerCharge)}</Text>
              <Text style={styles.sheetText}>
                Status: {detail.collectionStatus === 'paid' ? 'Collected' : 'Unpaid'}
                {detail.collectedAt ? ` · ${new Date(detail.collectedAt).toLocaleDateString()}` : ''}
              </Text>
              <View style={{ marginTop: spacing.lg }}>
                <Button title="Close" onPress={() => setDetail(null)} />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  hello: { fontSize: 20, fontWeight: '800', color: colors.text },
  date: { color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row' },
  payout: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  payoutTitle: { fontWeight: '800', color: colors.primaryDark, marginBottom: 4 },
  payoutText: { color: colors.primaryDark, fontSize: 13 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentName: { fontWeight: '600', color: colors.text },
  paymentMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  paymentAmount: { fontWeight: '700', color: colors.text },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: '85%' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  sheetText: { fontSize: 14, color: colors.text, marginTop: spacing.sm },
});