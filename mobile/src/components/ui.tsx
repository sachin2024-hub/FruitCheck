import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, shadow, space, type } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'outline' | 'onDark' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const fg =
    variant === 'primary' || variant === 'onDark'
      ? '#fff'
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? colors.primary
          : colors.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && { backgroundColor: colors.primary },
        variant === 'secondary' && { backgroundColor: colors.mint },
        variant === 'outline' && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        variant === 'onDark' && { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
        variant === 'danger' && { backgroundColor: colors.dangerSoft },
        variant === 'ghost' && { minHeight: 40 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        disabled && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Full-screen soft fruit-toned backdrop; render children on top of it. */
export function ScreenBackground({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Image
        source={require('@/assets/images/background.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        accessibilityElementsHidden
      />
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Banner({
  tone,
  text,
  title,
  action,
}: {
  tone: 'error' | 'warn' | 'info';
  text: string;
  title?: string;
  action?: ReactNode;
}) {
  const bg = tone === 'error' ? colors.dangerSoft : tone === 'warn' ? colors.accentSoft : colors.mint;
  const fg = tone === 'error' ? colors.danger : tone === 'warn' ? colors.accentText : colors.primaryDark;
  const icon: IconName = tone === 'error' ? 'alert-circle' : tone === 'warn' ? 'warning' : 'information-circle';
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="alert">
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} />
        <View style={{ flex: 1, gap: 2 }}>
          {title && <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Text>}
          <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{text}</Text>
        </View>
      </View>
      {action}
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.muted, { textAlign: 'center' }]}>{text}</Text>
      {action}
    </View>
  );
}

export function TextField({
  label,
  error,
  icon,
  secure,
  ...input
}: TextInputProps & { label: string; error?: string | null; icon?: IconName; secure?: boolean }) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && { borderColor: colors.primary },
          !!error && { borderColor: colors.danger },
        ]}>
        {icon && <Ionicons name={icon} size={20} color={colors.muted} />}
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={secure && hidden}
          placeholderTextColor="#9AA59C"
          style={styles.input}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
        />
        {secure && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={type.title}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, ...shadow },
  banner: { borderRadius: radius.md, padding: space.md, gap: space.sm },
  empty: { alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.lg, gap: space.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  inputWrap: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 12 },
  fieldError: { fontSize: 13, color: colors.danger },
  chip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
