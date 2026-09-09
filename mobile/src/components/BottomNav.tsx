import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { TabType } from '../types';
import { IconGrid, IconWallet, IconDoc } from './Icons';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onTabChange,
}) => {
  const insets = useSafeAreaInsets();

  const tabs: { id: TabType; label: string; icon: (isActive: boolean) => React.ReactNode }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (isActive) => (
        <IconGrid size={21} color={isActive ? colors.blue : colors.navInactive} />
      ),
    },
    {
      id: 'empenhos',
      label: 'Empenhos',
      icon: (isActive) => (
        <IconWallet size={21} color={isActive ? colors.blue : colors.navInactive} />
      ),
    },
    {
      id: 'contratos',
      label: 'Contratos',
      icon: (isActive) => (
        <IconDoc size={21} color={isActive ? colors.blue : colors.navInactive} />
      ),
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = currentTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onTabChange(tab.id)}
            style={styles.navItem}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.navIconContainer,
                isActive && styles.navIconActive,
              ]}
            >
              {tab.icon(isActive)}
            </View>
            <Text
              style={[
                styles.navLabel,
                isActive && styles.navLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
    paddingHorizontal: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 49,
    gap: 3,
  },
  navIconContainer: {
    width: 57,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconActive: {
    backgroundColor: colors.blueNavActive,
  },
  navLabel: {
    fontSize: 12,
    color: colors.navInactive,
    fontWeight: '400',
  },
  navLabelActive: {
    color: colors.blue,
    fontWeight: '700',
  },
});
