import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { colors, radius } from '../constants/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  small?: boolean;
}

/** Chip de filtro (pílula). Usado em linhas de chips roláveis. */
export const Chip: React.FC<ChipProps> = ({ label, selected, onPress, small }) => (
  <TouchableOpacity
    style={[styles.chip, small && styles.chipSmall, selected && styles.chipSelected]}
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityState={{ selected }}
  >
    <Text style={[styles.text, small && styles.textSmall, selected && styles.textSelected]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineChip,
    backgroundColor: colors.white,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSmall: { minHeight: 30, paddingVertical: 5, paddingHorizontal: 11 },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  text: { fontSize: 13, color: colors.tagText, fontWeight: '600' },
  textSmall: { fontSize: 12 },
  textSelected: { color: colors.white, fontWeight: '700' },
});
