import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/constants/theme';
import { TabType, ContratoFilter } from './src/types';
import { Header } from './src/components/Header';
import { BottomNav } from './src/components/BottomNav';
import { NotificationsModal } from './src/components/NotificationsModal';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { EmpenhosScreen } from './src/screens/EmpenhosScreen';
import { ContratosScreen } from './src/screens/ContratosScreen';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [contratosFilter, setContratosFilter] = useState<ContratoFilter>('all');
  const [notificationCount, setNotificationCount] = useState<number>(11);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);

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
          notificationCount={notificationCount}
          onPressNotification={() => setIsNotificationsOpen(true)}
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

        {/* Internal In-App Notifications Modal */}
        <NotificationsModal
          visible={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          contratosAVencerCount={notificationCount}
          onNavigateToContratos={() => {
            setContratosFilter('vencer');
            setCurrentTab('contratos');
          }}
          onNavigateToDashboard={() => {
            setCurrentTab('dashboard');
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
