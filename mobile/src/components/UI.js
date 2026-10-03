import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionTitleText}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, style }) {
  const variantStyle = styles[`btn_${variant}`];
  const textStyle = styles[`btnText_${variant}`] || styles.btnText_primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variantStyle,
        disabled && styles.btnDisabled,
        pressed && !disabled && styles.btnPressed,
        style,
      ]}
    >
      <Text style={textStyle}>{title}</Text>
    </Pressable>
  );
}

export function StatCard({ label, value, hint, tone = 'text' }) {
  const valueColor = {
    text: colors.text,
    primary: colors.primary,
    green: colors.green,
    amber: colors.amber,
    red: colors.red,
  }[tone];
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function Badge({ label, tone = 'muted' }) {
  const toneStyle = {
    green: { bg: colors.greenBg, fg: colors.green },
    amber: { bg: colors.amberBg, fg: colors.amber },
    red: { bg: colors.redBg, fg: colors.red },
    muted: { bg: '#f0f3f9', fg: colors.muted },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.badgeText, { color: toneStyle.fg }]}>{label}</Text>
    </View>
  );
}

export function Field({ label, style, ...inputProps }) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...inputProps}
      />
    </View>
  );
}

export function Loading({ label = 'Loading...' }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ children }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{children}</Text>
    </View>
  );
}

export function SuccessText({ children }) {
  if (!children) return null;
  return (
    <View style={styles.successBox}>
      <Text style={styles.successText}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleText: { fontSize: 17, fontWeight: '700', color: colors.text },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn_primary: { backgroundColor: colors.primary },
  btn_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  btn_green: { backgroundColor: colors.green },
  btn_danger: { backgroundColor: colors.red },
  btnText_primary: { color: colors.white, fontWeight: '700', fontSize: 15 },
  btnText_green: { color: colors.white, fontWeight: '700', fontSize: 15 },
  btnText_danger: { color: colors.white, fontWeight: '700', fontSize: 15 },
  btnText_ghost: { color: colors.muted, fontWeight: '600', fontSize: 15 },
  btnDisabled: { opacity: 0.55 },
  btnPressed: { opacity: 0.85 },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  statHint: { color: colors.muted, fontSize: 11, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  loading: { padding: spacing.xl, alignItems: 'center' },
  loadingText: { color: colors.muted, marginTop: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, padding: spacing.xl },
  errorBox: {
    backgroundColor: colors.redBg,
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { color: '#b91c1c', fontSize: 14 },
  successBox: {
    backgroundColor: colors.greenBg,
    borderColor: '#a7f3d0',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successText: { color: '#047857', fontSize: 14 },
});