import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { Button, ErrorText, Field } from './UI';
import { colors, radius, spacing } from '../theme';

const ROLES = ['Mason', 'Helper', 'Carpenter', 'Painter', 'Plumber', 'Electrician', 'Other'];

export default function WorkerModal({ visible, worker, onClose, onSubmit }) {
  const isEdit = Boolean(worker?._id);
  const [form, setForm] = useState({
    name: worker?.name || '',
    phone: worker?.phone || '',
    role: worker?.role || 'Mason',
    dailyWage: String(worker?.dailyWage ?? 500),
    address: worker?.address || '',
    idNumber: worker?.idNumber || '',
    notes: worker?.notes || '',
    active: worker?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Please enter a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        ...form,
        dailyWage: Number(form.dailyWage) || 0,
        site: null,
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
            <Text style={styles.title}>{isEdit ? `Edit ${worker.name}` : 'Add worker'}</Text>
            <ErrorText>{error}</ErrorText>

            <Field label="Full name" value={form.name} onChangeText={set('name')} placeholder="e.g. Ravi Kumar" />
            <Field label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" placeholder="Optional" />
            <Field label="Daily wage (₹)" value={form.dailyWage} onChangeText={set('dailyWage')} keyboardType="numeric" />

            <Text style={styles.label}>Role</Text>
            <View style={styles.chips}>
              {ROLES.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => set('role')(r)}
                  style={[styles.chip, form.role === r && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.role === r && styles.chipTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: spacing.md }]}>Status</Text>
            <View style={styles.row}>
              <Button
                title="Active"
                variant={form.active ? 'green' : 'ghost'}
                onPress={() => set('active')(true)}
                style={{ flex: 1 }}
              />
              <View style={{ width: spacing.sm }} />
              <Button
                title="Inactive"
                variant={!form.active ? 'primary' : 'ghost'}
                onPress={() => set('active')(false)}
                style={{ flex: 1 }}
              />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Field label="Address" value={form.address} onChangeText={set('address')} placeholder="Optional" />
              <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Optional" />
            </View>

            <View style={styles.footer}>
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <View style={{ width: spacing.sm }} />
              <Button
                title={busy ? 'Saving...' : isEdit ? 'Save changes' : 'Add worker'}
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
    maxHeight: '92%',
  },
  title: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#e5edff' },
  chipText: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.primary },
  row: { flexDirection: 'row' },
  footer: { flexDirection: 'row', marginTop: spacing.lg },
});