import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Linking from 'expo-linking';
import { colors } from '../theme';

/**
 * Lets the user pick a contact from their phone's address book and returns
 * its name and primary phone number so it can be used to prefill a worker or
 * a site's contact fields.
 *
 * @param {{ onContactPicked: (contact: { name: string; phone: string }) => void, onCancel?: () => void, label?: string, subtitle?: string, style?: any }} props
 */
export default function ContactPicker({ onContactPicked, onCancel, label = 'Add from contacts', subtitle = 'Pick a contact to fill the name and phone fields', style }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const extractNameAndPhone = async (contact) => {
    const details = await contact.getDetails([
      Contacts.ContactField.FULL_NAME,
      Contacts.ContactField.PHONES,
    ]);
    const name =
      (details?.fullName || details?.givenName || details?.familyName || '').trim();
    const phone = (details?.phones?.[0]?.number || '').trim();
    return { name, phone };
  };

  const pick = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (!permission.granted) {
        if (permission.canAskAgain) {
          Alert.alert(
            'Contacts access needed',
            'Please allow contacts access in your phone settings so we can fetch a contact with a name and phone number.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open settings',
                onPress: () => Linking.openSettings(),
                style: 'default',
              },
            ]
          );
        } else {
          Alert.alert(
            'Contacts access required',
            'Contacts access is required to add a worker/site from a contact. Please enable it in Settings.',
            [
              { text: 'OK', style: 'default' },
            ]
          );
        }
        return;
      }

      const picked = await Contacts.Contact.presentPicker();
      if (!picked) {
        setLoading(false);
        return;
      }

      const { name, phone } = await extractNameAndPhone(picked);
      if (onContactPicked) {
        onContactPicked({ name, phone });
      }
    } catch (err) {
      setError(err?.message || 'Could not pick a contact.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.wrapper, style]}>
      <Button title={label} onPress={pick} disabled={loading} />
      <Text style={styles.subtitle}>{subtitle}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {onCancel ? <Button title="Cancel" variant="ghost" onPress={onCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  error: {
    color: colors.red,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});
