import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from './AppText';
import { colors, radius } from '../constants/theme';
import { IconBell, IconChevronDown } from './Icons';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  initials?: string;
  notificationCount?: number;
  onPressNotification?: () => void;
  onPressAvatar?: () => void;
  /** Filtro de PTRES (só o dashboard informa); aparece na barra, antes do sino. */
  ptresFilter?: { label: string; active: boolean; disabled?: boolean; onPress: () => void };
}

export const Header: React.FC<HeaderProps> = ({
  initials = 'CF',
  notificationCount = 0,
  onPressNotification,
  onPressAvatar,
  ptresFilter,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <BrandLogo size={26} />
          <Text style={styles.brandText}>
            Siages
            <Text style={styles.brandDot}>.</Text>
          </Text>
        </View>

        {/* Right side: PTRES filter (dashboard) + Notification bell + Avatar */}
        <View style={styles.rightActions}>
          {ptresFilter ? (
            <TouchableOpacity
              style={[styles.ptresBadge, ptresFilter.active && styles.ptresBadgeActive]}
              onPress={ptresFilter.onPress}
              disabled={ptresFilter.disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Filtrar por PTRES. Atual: ${ptresFilter.label}`}
            >
              <Text style={[styles.ptresBadgeText, ptresFilter.active && styles.ptresBadgeTextActive]} numberOfLines={1}>
                {ptresFilter.label}
              </Text>
              <IconChevronDown size={12} color={ptresFilter.active ? colors.white : colors.mutedText} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.bellButton}
            onPress={onPressNotification}
            activeOpacity={0.7}
            accessibilityLabel="Notificações"
          >
            <IconBell size={21} color={colors.muted} />
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            onPress={onPressAvatar}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Conta e sair"
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
  },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 19,
    paddingTop: 12,
    paddingBottom: 10,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.7,
    color: colors.ink,
  },
  brandDot: {
    color: colors.cyan,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellButton: {
    position: 'relative',
    padding: 6,
    borderRadius: 20,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#e11d48',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#eaf0fd',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#f5f8ff',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
  },
  ptresBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.blueLight,
    backgroundColor: colors.blueBg,
    maxWidth: 130,
  },
  ptresBadgeActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  ptresBadgeText: { fontSize: 12, fontWeight: '800', color: colors.blue, flexShrink: 1 },
  ptresBadgeTextActive: { color: colors.white },
});
