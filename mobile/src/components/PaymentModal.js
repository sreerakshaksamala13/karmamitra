import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorText, Field, StatCard } from './UI';
import { colors, radius, spacing } from '../theme';
import { formatMoney } from '../utils/format';

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'bank', label: 'Bank' },
];

/**
 * mode="create" -> record a payout for a worker's outstanding days.
 * mode="edit"   -> update the details of an existing payment.
 */
export default function PaymentModal({ visible, mode, worker, due, payment, onClose, onSubmit }) {
  const isEdit = mode === 'edit';
  const gross = isEdit ? payment?.grossAmount : due?.grossAmount || 0;

  const [deduction, setDeduction] = useState(String(isEdit ? payment?.deduction ?? 0 : 0));
  const [bonus, setBonus] = useState(String(isEdit ? payment?.bonus ?? 0 : 0));
  const [method, setMethod] = useState(isEdit ? payment?.method : 'cash');
  const [status, setStatus] = useState(isEdit ? payment?.status : 'paid');
  const [notes, setNotes] = useState(isEdit ? payment?.notes || '' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const net = Math.max(0, Number(gross) + Number(bonus || 0) - Number(deduction || 0));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        deduction: Number(deduction) || 0,
        bonus: Number(bonus) || 0,
        method,
        status,
        notes,
      });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{isEdit ? 'Update payment' : `Pay ${worker?.name}`}</Text>
            <View style={styles.summary}>
              <Text style={styles.summaryName}>{worker?.name}</Text>
              <Text style={styles.summaryMeta}>
                Gross {formatMoney(gross)}
                {due ? ` · ${due.attendanceCount} day(s) ${due.fromDate} → ${due.toDate}` : ''}
              </Text>
            </View>

            <ErrorText>{error}</ErrorText>

            <Field
              label="Deduction (advance recovered)"
              value={deduction}
              onChangeText={setDeduction}
              keyboardType="numeric"
            />
            <Field label="Bonus" value={bonus} onChangeText={setBonus} keyboardType="numeric" />

            <Text style={styles.label}>Method</Text>
            <View style={styles.methods}>
              {METHODS.map((m) => (
                <Button
                  key={m.key}
                  title={m.label}
                  variant={method === m.key ? 'primary' : 'ghost'}
                  onPress={() => setMethod(m.key)}
                  style={{ flex: 1 }}
                />
              ))}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Status</Text>
            <View style={styles.methods}>
              <Button
                title="Paid"
                variant={status === 'paid' ? 'green' : 'ghost'}
                onPress={() => setStatus('paid')}
                style={{ flex: 1 }}
              />
              <Button
                title="Pending"
                variant={status === 'pending' ? 'primary' : 'ghost'}
                onPress={() => setStatus('pending')}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" />
            </View>

            <View style={{ marginBottom: spacing.md }}>
              <StatCard label="Net amount to pay" value={formatMoney(net)} tone="green" />
            </View>

            <View style={styles.footer}>
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <View style={{ width: spacing.sm }} />
              <Button
                title={busy ? 'Saving...' : isEdit ? 'Save changes' : 'Record payment'}
                onPress={submit}
                disabled={busy}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  summary: {
    backgroundColor: '#eff6ff',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryName: { fontWeight: '700', color: colors.primaryDark },
  summaryMeta: { color: colors.primaryDark, fontSize: 12, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  methods: { flexDirection: 'row', gap: spacing.sm },
  footer: { flexDirection: 'row', marginTop: spacing.sm },
});