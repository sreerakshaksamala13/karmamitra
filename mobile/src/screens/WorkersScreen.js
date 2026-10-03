import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import client, { errorMessage } from '../api/client';
import { Badge, Button, Card, EmptyState, ErrorText, Field, Loading, SuccessText } from '../components/UI';
import WorkerModal from '../components/WorkerModal';
import { colors, spacing } from '../theme';
import { formatMoney } from '../utils/format';

export default function WorkersScreen() {
  const [workers, setWorkers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/workers', { params: { search: search || undefined } });
      setWorkers(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 3500);
  };

  const submit = async (payload) => {
    if (modal?._id) {
      await client.put(`/workers/${modal._id}`, payload);
      flash(`${payload.name} updated.`);
    } else {
      await client.post('/workers', payload);
      flash(`${payload.name} added.`);
    }
    setModal(null);
    load();
  };

  const toggleActive = async (worker) => {
    try {
      await client.patch(`/workers/${worker._id}/status`, { active: !worker.active });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = (worker) => {
    Alert.alert('Delete worker', `Delete ${worker.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/workers/${worker._id}`);
            flash(`${worker.name} deleted.`);
            load();
          } catch (err) {
            if (err?.response?.status === 409) {
              Alert.alert('Has records', err.response.data.message, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete anyway',
                  style: 'destructive',
                  onPress: async () => {
                    await client.delete(`/workers/${worker._id}?force=true`);
                    flash(`${worker.name} and records deleted.`);
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <Text style={styles.count}>{workers.length} worker(s)</Text>
          <Button title="+ Add worker" onPress={() => setModal({})} />
        </View>

        <Field
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name"
        />

        <ErrorText>{error}</ErrorText>
        <SuccessText>{message}</SuccessText>

        {loading ? (
          <Loading />
        ) : workers.length === 0 ? (
          <EmptyState>No workers found. Add your first worker.</EmptyState>
        ) : (
          workers.map((w) => (
            <Card key={w._id}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{w.name}</Text>
                  <Text style={styles.meta}>
                    {w.role} · {formatMoney(w.dailyWage)}/day
                  </Text>
                  {w.phone ? <Text style={styles.meta}>{w.phone}</Text> : null}
                </View>
                <Badge label={w.active ? 'Active' : 'Inactive'} tone={w.active ? 'green' : 'muted'} />
              </View>
              <View style={[styles.row, { marginTop: spacing.sm }]}>
                <Button title="Edit" variant="ghost" onPress={() => setModal(w)} style={{ flex: 1 }} />
                <View style={{ width: spacing.sm }} />
                <Button
                  title={w.active ? 'Deactivate' : 'Activate'}
                  variant="ghost"
                  onPress={() => toggleActive(w)}
                  style={{ flex: 1 }}
                />
                <View style={{ width: spacing.sm }} />
                <Button title="Delete" variant="danger" onPress={() => remove(w)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {modal && (
        <WorkerModal
          visible
          worker={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSubmit={submit}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  count: { fontSize: 16, fontWeight: '700', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontWeight: '700', fontSize: 16, color: colors.text },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});