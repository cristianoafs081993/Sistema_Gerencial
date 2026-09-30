import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../constants/theme';

interface AccountModalProps {
  visible: boolean;
  onClose: () => void;
  email?: string | null;
  orgName?: string | null;
  groupNames: string[];
  onSignOut: () => void;
}

/** Folha inferior com os dados da conta e o botão Sair. */
export const AccountModal: React.FC<AccountModalProps> = ({
  visible,
  onClose,
  email,
  orgName,
  groupNames,
  onSignOut,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Fechar">
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Sua conta</Text>

          <View style={styles.rows}>
            <Row label="E-mail" value={email || '—'} />
            <Row label="Órgão" value={orgName || 'Não vinculado'} />
            <Row label="Perfil" value={groupNames.length ? groupNames.join(', ') : '—'} />
          </View>

          <TouchableOpacity style={styles.signOut} onPress={onSignOut} accessibilityRole="button">
            <Text style={styles.signOutText}>Sair da conta</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(27, 43, 58, 0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineInput },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, color: colors.ink },
  rows: { gap: 10 },
  row: { gap: 2 },
  rowLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.mutedLight, textTransform: 'uppercase' },
  rowValue: { fontSize: 15, fontWeight: '600', color: colors.ink },
  signOut: {
    marginTop: 6,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerBg,
    backgroundColor: colors.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { fontSize: 15, fontWeight: '800', color: colors.danger },
});
