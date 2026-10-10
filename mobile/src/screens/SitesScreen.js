import { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client, { errorMessage } from '../api/client';
import { Badge, Button, Card, EmptyState, ErrorText, Field, Loading } from '../components/UI';
import { colors, radius, spacing } from '../theme';
import { formatMoney } from '../utils/format';
import ContactPicker from '../components/ContactPicker';

function SiteForm({ site, onClose, onSubmit }) {
  const isEdit = Boolean(site?._id);
  const [form, setForm] = useState({
    name: site?.name || '',
    location: site?.location || '',
    clientName: site?.clientName || '',
    clientPhone: site?.clientPhone || '',
    dailyRateToClient: String(site?.dailyRateToClient ?? 0),
    notes: site?.notes || '',
    active: site?.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ ...form, dailyRateToClient: Number(form.dailyRateToClient) || 0 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>{isEdit ? `Edit ${site.name}` : 'Add site'}</Text>
            <ContactPicker
              label="Add from contacts"
              subtitle="Takes the client name and phone from a selected contact"
              onContactPicked={({ name, phone }) => {
                set('clientName')(name);
                set('clientPhone')(phone);
              }}
            />
            <Field label="Site name" value={form.name} onChangeText={set('name')} placeholder="e.g. Sunrise Apartments" />
            <Field label="Location" value={form.location} onChangeText={set('location')} placeholder="Area / city" />
            <Field label="Client name" value={form.clientName} onChangeText={set('clientName')} />
            <Field label="Client phone" value={form.clientPhone} onChangeText={set('clientPhone')} keyboardType="phone-pad" />
            <Field
              label="Client rate / day (₹)"
              value={form.dailyRateToClient}
              onChangeText={set('dailyRateToClient')}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Status</Text>
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
            <View style={[styles.row, { marginTop: spacing.lg }]}>
              <Button title="Cancel" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
              <View style={{ width: spacing.sm }} />
              <Button
                title={busy ? 'Saving...' : isEdit ? 'Save' : 'Add site'}
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

export default function SitesScreen() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/sites');
      setSites(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const submit = async (payload) => {
    if (modal?._id) {
      await client.put(`/sites/${modal._id}`, payload);
    } else {
      await client.post('/sites', payload);
    }
    setModal(null);
    load();
  };

  const remove = (site) => {
    Alert.alert('Delete site', `Delete ${site.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/sites/${site._id}`);
            load();
          } catch (err) {
            if (err?.response?.status === 409) {
              Alert.alert('Has workers', err.response.data.message, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete anyway',
                  style: 'destructive',
                  onPress: async () => {
                    await client.delete(`/sites/${site._id}?force=true`);
                    load();
                  },
                },
              ]);
            } else {
              setError(errorMessage(err));
            }
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text style={styles.count}>{sites.length} site(s)</Text>
          <Button title="+ Add site" onPress={() => setModal({})} />
        </View>

        <ErrorText>{error}</ErrorText>

        {loading ? (
          <Loading />
        ) : sites.length === 0 ? (
          <EmptyState>No sites yet. Add where your crew works.</EmptyState>
        ) : (
          sites.map((s) => (
            <Card key={s._id}>
              <View style={styles.rowBetween}>
                <Text style={styles.name}>{s.name}</Text>
                <Badge label={s.active ? 'Active' : 'Inactive'} tone={s.active ? 'green' : 'muted'} />
              </View>
              <Text style={styles.meta}>{s.location || 'No location'}</Text>
              <Text style={styles.meta}>Client: {s.clientName || '—'}</Text>
              <Text style={styles.meta}>Client rate: {formatMoney(s.dailyRateToClient)}/day</Text>
              <Text style={styles.meta}>{s.workerCount || 0} worker(s) assigned</Text>
              <View style={[styles.rowBetween, { marginTop: spacing.sm }]}>
                <Button title="Edit" variant="ghost" onPress={() => setModal(s)} style={{ flex: 1 }} />
                <View style={{ width: spacing.sm }} />
                <Button title="Delete" variant="danger" onPress={() => remove(s)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {modal && <SiteForm site={modal._id ? modal : null} onClose={() => setModal(null)} onSubmit={submit} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  count: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontWeight: '700', fontSize: 16, color: colors.text },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '92%',
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
});