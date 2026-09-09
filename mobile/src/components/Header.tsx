import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../constants/theme';
import { IconChart, IconBuilding, IconBell } from './Icons';

interface HeaderProps {
  initials?: string;
  campusName?: string;
  notificationCount?: number;
  onPressNotification?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  initials = 'CF',
  campusName = 'Campus Currais Novos',
  notificationCount = 0,
  onPressNotification,
}) => {
  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <View style={styles.brandmark}>
            <IconChart size={18} color={colors.white} />
          </View>
          <Text style={styles.brandText}>
            siages
            <Text style={styles.brandDot}>.</Text>
          </Text>
        </View>

        {/* Right side: Notification bell + Avatar */}
        <View style={styles.rightActions}>
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

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </View>
      </View>

      {/* Campus subtitle */}
      <View style={styles.campus}>
        <IconBuilding size={14} color={colors.muted} />
        <Text style={styles.campusText}>
          IFRN <Text style={styles.campusSlash}>/</Text>{' '}
          <Text style={styles.campusBold}>{campusName}</Text>
        </Text>
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
    paddingTop: 14,
    paddingBottom: 10,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandmark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: colors.ink,
  },
  brandDot: {
    color: '#4870cc',
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  campus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 19,
    paddingBottom: 13,
    paddingTop: 0,
    gap: 6,
  },
  campusText: {
    fontSize: 12,
    color: colors.muted,
  },
  campusSlash: {
    color: colors.mutedExtraLight,
    paddingHorizontal: 3,
  },
  campusBold: {
    fontWeight: '600',
    color: colors.inkLight,
  },
});
