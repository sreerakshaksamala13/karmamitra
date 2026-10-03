import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client, { errorMessage } from '../api/client';
import { Button, Card, EmptyState, ErrorText, Loading, StatCard, SuccessText } from '../components/UI';
import PaymentModal from '../components/PaymentModal';
import { colors, radius, spacing } from '../theme';
import { formatMoney, isPayoutDay, prettyDate, toDateInput } from '../utils/format';

export default function PaymentsScreen() {
  const [tab, setTab] = useState('dues');
  const [toDate] = useState(toDateInput());
  const [site, setSite] = useState('');
  const [sites, setSites] = useState([]);
  const [dues, setDues] = useState({ rows: [], totalDue: 0 });
  const [payments, setPayments] = useState([]);
  const [loadingDues, setLoadingDues] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);

  useEffect(() => {
    client.get('/sites').then((res) => setSites(res.data)).catch(() => {});
  }, []);

  const loadDues = useCallback(async () => {
    setLoadingDues(true);
    try {
      const res = await client.get('/payments/dues', { params: { to: toDate, site: site || undefined } });
      setDues(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingDues(false);
    }
  }, [toDate, site]);

  const loadPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await client.get('/payments', { params: { site: site || undefined } });
      setPayments(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingPayments(false);
    }
  }, [site]);

  useEffect(() => {
    loadDues();
    loadPayments();
  }, [loadDues, loadPayments]);

  useFocusEffect(
    useCallback(() => {
      loadDues();
      loadPayments();
    }, [loadDues, loadPayments])
  );

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3500);
  };

  const submitCreate = async (payload) => {
    await client.post('/payments', { worker: modal.worker._id, toDate: modal.due.toDate, ...payload });
    setModal(null);
    flash(`Payment recorded for ${modal.worker.name}.`);
    loadDues();
    loadPayments();
  };

  const submitEdit = async (payload) => {
    await client.put(`/payments/${modal.payment._id}`, payload);
    setModal(null);
    flash('Payment updated.');
    loadDues();
    loadPayments();
  };

  const daySitesText = (row) => {
    const names = (row.dayBreakdown || []).map((d) => d.site?.name).filter(Boolean);
    const unique = [...new Set(names)];
    if (unique.length) return unique.join(', ');
    return row.worker?.site?.name || '—';
  };

  const workedSitesText = (p) => {
    const names = (p.attendance || [])
      .map((a) => a.site?.name)
      .filter(Boolean);
    const unique = [...new Set(names)];
    if (unique.length) return unique.join(', ');
    return p.worker?.site?.name || '—';
  };

  const reverse = (payment) => {
    Alert.alert(
      'Reverse payment',
      `Reverse ${formatMoney(payment.netAmount)} to ${payment.worker?.name}? Those days will be owed again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.delete(`/payments/${payment._id}`);
              flash('Payment reversed.');
              loadDues();
              loadPayments();
            } catch (err) {
              setError(errorMessage(err));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tabs}>
          <Button
            title="To pay"
            variant={tab === 'dues' ? 'primary' : 'ghost'}
            onPress={() => setTab('dues')}
            style={{ flex: 1 }}
          />
          <View style={{ width: spacing.sm }} />
          <Button
            title="History"
            variant={tab === 'history' ? 'primary' : 'ghost'}
            onPress={() => setTab('history')}
            style={{ flex: 1 }}
          />
        </View>

        {isPayoutDay(toDate) && tab === 'dues' && (
          <Card style={styles.payout}>
            <Text style={styles.payoutTitle}>Today is payout day</Text>
            <Text style={styles.payoutText}>
              {formatMoney(dues.totalDue)} outstanding across {dues.rows.length} worker(s).
            </Text>
          </Card>
        )}

        <ErrorText>{error}</ErrorText>
        <SuccessText>{message}</SuccessText>

        <Text style={styles.label}>Site</Text>
        <View style={styles.sites}>
          <Pressable onPress={() => setSite('')} style={[styles.siteChip, !site && styles.siteChipActive]}>
            <Text style={[styles.siteText, !site && styles.siteTextActive]}>All sites</Text>
          </Pressable>
          {sites.map((s) => (
            <Pressable key={s._id} onPress={() => setSite(s._id)} style={[styles.siteChip, site === s._id && styles.siteChipActive]}>
              <Text style={[styles.siteText, site === s._id && styles.siteTextActive]}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ height: spacing.md }} />

        {tab === 'dues' && (
          <>
            <StatCard label="Total outstanding" value={formatMoney(dues.totalDue)} tone="amber" />
            <View style={{ height: spacing.md }} />
            {loadingDues ? (
              <Loading />
            ) : dues.rows.length === 0 ? (
              <EmptyState>Everyone is fully paid up.</EmptyState>
            ) : (
              dues.rows.map((row) => (
                <Card key={row.worker._id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{row.worker.name}</Text>
                      <Text style={styles.meta}>
                        {row.attendanceCount} day(s) · {row.fromDate} → {row.toDate}
                      </Text>
                      <Text style={styles.meta}>
                        Worked at: {daySitesText(row)}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{formatMoney(row.grossAmount)}</Text>
                  </View>
                  <Button
                    title="Pay"
                    onPress={() => setModal({ mode: 'create', worker: row.worker, due: row })}
                    style={{ marginTop: spacing.sm }}
                  />
                </Card>
              ))
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            {loadingPayments ? (
              <Loading />
            ) : payments.length === 0 ? (
              <EmptyState>No payments recorded yet.</EmptyState>
            ) : (
              payments.map((p) => (
                <Card key={p._id}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{p.worker?.name || 'Removed'}</Text>
                      <Text style={styles.meta}>
                        {p.fromDate} → {p.toDate} · {p.method} · {prettyDate(p.paidAt)}
                      </Text>
                      <Text style={styles.meta}>
                        Worked at: {workedSitesText(p)}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{formatMoney(p.netAmount)}</Text>
                  </View>
                  <Text style={styles.meta}>
                    Gross {formatMoney(p.grossAmount)} · Deduction {formatMoney(p.deduction)} · {p.status}
                  </Text>
                  <View style={styles.rowBetween}>
                    <Button
                      title="Edit"
                      variant="ghost"
                      onPress={() => setModal({ mode: 'edit', payment: p, worker: p.worker })}
                      style={{ flex: 1 }}
                    />
                    <View style={{ width: spacing.sm }} />
                    <Button title="Reverse" variant="danger" onPress={() => reverse(p)} style={{ flex: 1 }} />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>

      {modal && (
        <PaymentModal
          visible
          mode={modal.mode}
          worker={modal.worker}
          due={modal.due}
          payment={modal.payment}
          onClose={() => setModal(null)}
          onSubmit={modal.mode === 'edit' ? submitEdit : submitCreate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  tabs: { flexDirection: 'row', marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  sites: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  siteChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  siteChipActive: { borderColor: colors.primary, backgroundColor: '#e5edff' },
  siteText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  siteTextActive: { color: colors.primary },
  payout: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginBottom: spacing.md },
  payoutTitle: { fontWeight: '800', color: colors.primaryDark, marginBottom: 4 },
  payoutText: { color: colors.primaryDark, fontSize: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontWeight: '700', fontSize: 16, color: colors.text },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  amount: { fontWeight: '800', color: colors.text },
});