import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, space, type } from '@/lib/theme';

/** Bottom sheet opened from a history card's ⋮ button. */
export function ScanMenu({
  visible,
  onClose,
  onView,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={[styles.sheet, { paddingBottom: space.md + insets.bottom }]}>
        <Item icon="eye-outline" label="View Details" onPress={onView} />
        <Item icon="trash-outline" label="Delete Scan" danger onPress={onDelete} />
        <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Item({ icon, label, danger, onPress }: { icon: 'eye-outline' | 'trash-outline'; label: string; danger?: boolean; onPress: () => void }) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.mint }]}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.itemText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Centred confirmation shown before a scan is deleted. Stays open (with a spinner) while deleting. */
export function ConfirmDelete({
  visible,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onCancel} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.dialogWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.dialogIcon}>
            <Ionicons name="trash-outline" size={26} color={colors.danger} />
          </View>
          <Text style={[type.title, { textAlign: 'center' }]}>Delete scan?</Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>
            Are you sure you want to delete this scan? The result and its photo will be permanently removed.
          </Text>
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.dialogActions}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={[styles.dialogBtn, { backgroundColor: colors.mint }, busy && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={[styles.dialogBtnText, { color: colors.primaryDark }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={[styles.dialogBtn, { backgroundColor: colors.danger }]}
              accessibilityRole="button"
              accessibilityLabel="Delete"
              accessibilityState={{ busy, disabled: busy }}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.dialogBtnText, { color: '#fff' }]}>Delete</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.sm,
    paddingHorizontal: space.md,
    gap: 2,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md, borderRadius: radius.md },
  itemText: { fontSize: 16, fontWeight: '600' },
  cancel: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: space.sm, borderRadius: radius.md, backgroundColor: colors.mint },
  cancelText: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  dialogWrap: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.md,
    alignItems: 'stretch',
    ...shadow,
  },
  dialogIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  dialogActions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  dialogBtn: { flex: 1, minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dialogBtnText: { fontSize: 16, fontWeight: '700' },
});
