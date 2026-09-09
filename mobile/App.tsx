import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { colors } from './src/constants/theme';
import { TabType, ContratoFilter } from './src/types';
import { Header } from './src/components/Header';
import { BottomNav } from './src/components/BottomNav';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { EmpenhosScreen } from './src/screens/EmpenhosScreen';
import { ContratosScreen } from './src/screens/ContratosScreen';
import {
  registerForPushNotificationsAsync,
  sendExpiringContractsNotification,
  sendTestNotification,
} from './src/services/notifications';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [contratosFilter, setContratosFilter] = useState<ContratoFilter>('all');
  const [notificationCount, setNotificationCount] = useState<number>(11);
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    try {
      // 1. Register for push/local notifications
      void registerForPushNotificationsAsync();

      // 2. Listen to notification interactions (taps)
      notificationResponseListener.current =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          if (data?.screen === 'contratos') {
            setContratosFilter((data.filter as ContratoFilter) || 'vencer');
            setCurrentTab('contratos');
          }
        });

      // 3. Trigger initial check notification if there are contracts to expire
      const timer = setTimeout(() => {
        void sendExpiringContractsNotification(11);
      }, 2000);

      return () => {
        clearTimeout(timer);
        if (notificationResponseListener.current) {
          notificationResponseListener.current.remove();
        }
      };
    } catch (err) {
      console.warn('Erro ao inicializar listeners de notificação:', err);
    }
  }, []);

  const handleNavigateToContratosAlert = () => {
    setContratosFilter('vencer');
    setCurrentTab('contratos');
  };

  const handlePressNotification = () => {
    Alert.alert(
      'Central de Notificações SIAGES',
      'Existem 11 contratos com término de vigência nos próximos 30 dias no Campus Currais Novos.',
      [
        {
          text: 'Ver Contratos a Vencer',
          onPress: () => {
            setContratosFilter('vencer');
            setCurrentTab('contratos');
          },
        },
        {
          text: 'Testar Notificação Local',
          onPress: () => sendTestNotification(),
        },
        {
          text: 'Fechar',
          style: 'cancel',
        },
      ]
    );
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        {/* App Topbar & Campus Info with Notifications */}
        <Header
          notificationCount={notificationCount}
          onPressNotification={handlePressNotification}
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
        </View>

        {/* Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onTabChange={(tab) => setCurrentTab(tab)}
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
