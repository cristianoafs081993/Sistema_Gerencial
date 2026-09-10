import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/constants/theme';
import { TabType, ContratoFilter, NotificationItem } from './src/types';
import { Header } from './src/components/Header';
import { BottomNav } from './src/components/BottomNav';
import { NotificationsModal } from './src/components/NotificationsModal';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { EmpenhosScreen } from './src/screens/EmpenhosScreen';
import { ContratosScreen } from './src/screens/ContratosScreen';
import { LicitacoesScreen } from './src/screens/LicitacoesScreen';
import { fetchNotifications } from './src/services/api';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [contratosFilter, setContratosFilter] = useState<ContratoFilter>('all');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(true);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(0);

  const loadNotifications = useCallback(async () => {
    try {
      setNotificationsLoading(true);
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Erro ao carregar notificações:', err);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = useMemo(() => {
    if (lastReadTimestamp === 0) return notifications.length;
    return notifications.filter((n) => n.date.getTime() > lastReadTimestamp).length;
  }, [notifications, lastReadTimestamp]);

  const handleMarkAllAsRead = () => {
    setLastReadTimestamp(Date.now());
  };

  const handleNavigateToContratosAlert = () => {
    setContratosFilter('vencer');
    setCurrentTab('contratos');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        {/* App Topbar & Campus Info with Notifications Bell Icon */}
        <Header
          notificationCount={unreadCount}
          onPressNotification={() => {
            loadNotifications();
            setIsNotificationsOpen(true);
          }}
        />

        {/* Active Screen View */}
        <View style={styles.screenContainer}>
          {currentTab === 'dashboard' && (
            <DashboardScreen
              onNavigateToContratosAlert={handleNavigateToContratosAlert}
            />
          )}

          {currentTab === 'empenhos' && <EmpenhosScreen />}

          {currentTab === 'contratos' && (
            <ContratosScreen
              initialFilter={contratosFilter}
              onClearInitialFilter={() => setContratosFilter('all')}
            />
          )}

          {currentTab === 'licitacoes' && <LicitacoesScreen />}
        </View>

        {/* Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
        />

        {/* Internal In-App Notifications Modal (Matching Web Platform) */}
        <NotificationsModal
          visible={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          loading={notificationsLoading}
          unreadCount={unreadCount}
          onMarkAllAsRead={handleMarkAllAsRead}
          onRefresh={loadNotifications}
          onNavigateToEmpenhos={() => {
            setCurrentTab('empenhos');
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
