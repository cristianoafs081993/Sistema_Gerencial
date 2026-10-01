import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/constants/theme';
import { TabType, ContratoFilter, NotificationItem, PtresItem } from './src/types';
import { Header } from './src/components/Header';
import { BottomNav } from './src/components/BottomNav';
import { PtresFilterModal } from './src/components/PtresFilterModal';
import { NotificationsModal } from './src/components/NotificationsModal';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OrcamentoScreen } from './src/screens/OrcamentoScreen';
import { ContratosScreen } from './src/screens/ContratosScreen';
import { LicitacoesScreen } from './src/screens/LicitacoesScreen';
import { InfraestruturaScreen } from './src/screens/InfraestruturaScreen';
import { AccountModal } from './src/components/AccountModal';
import { AccessStateScreen } from './src/screens/AccessStateScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { secoesOrcamento, type AppAccess } from './src/services/access';
import { fetchNotifications } from './src/services/api';

function initialsFromEmail(email?: string | null): string {
  const name = (email || '').split('@')[0].replace(/[^a-zA-Z.-_ ]/g, '');
  const parts = name.split(/[.-_ ]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || 'U').toUpperCase();
}

type AuthenticatedAppProps = {
  access: AppAccess;
  email?: string | null;
  onSignOut: () => void;
};

function AuthenticatedApp({ access, email, onSignOut }: AuthenticatedAppProps) {
  const allowedTabs = access.tabs;
  const [currentTab, setCurrentTabState] = useState<TabType>(
    allowedTabs.includes('dashboard') ? 'dashboard' : allowedTabs[0],
  );
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const setCurrentTab = useCallback(
    (tab: TabType) => {
      if (allowedTabs.includes(tab)) setCurrentTabState(tab);
    },
    [allowedTabs],
  );
  const [selectedPtres, setSelectedPtres] = useState<string>('all');
  const [ptresOptions, setPtresOptions] = useState<PtresItem[]>([]);
  const [isPtresOpen, setIsPtresOpen] = useState<boolean>(false);
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
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* App Topbar & Campus Info with Notifications Bell Icon */}
      <Header
        initials={initialsFromEmail(email)}
        onPressAvatar={() => setIsAccountOpen(true)}
        notificationCount={unreadCount}
        ptresFilter={
          currentTab === 'dashboard'
            ? {
                label: selectedPtres === 'all' ? 'PTRES: Todos' : `PTRES ${selectedPtres}`,
                active: selectedPtres !== 'all',
                disabled: ptresOptions.length === 0,
                onPress: () => setIsPtresOpen(true),
              }
            : undefined
        }
        onPressNotification={() => {
          loadNotifications();
          setIsNotificationsOpen(true);
        }}
      />

      {/* Active Screen View */}
      <View style={styles.screenContainer}>
        {currentTab === 'dashboard' && (
          <DashboardScreen
            selectedPtres={selectedPtres}
            onSelectPtres={setSelectedPtres}
            onPtresOptions={setPtresOptions}
            canOpenContratos={allowedTabs.includes('contratos')}
            onNavigateToContratosAlert={handleNavigateToContratosAlert}
          />
        )}

        {currentTab === 'empenhos' && <OrcamentoScreen sections={secoesOrcamento(access.screens)} />}

        {currentTab === 'contratos' && (
          <ContratosScreen
            initialFilter={contratosFilter}
            onClearInitialFilter={() => setContratosFilter('all')}
          />
        )}

        {currentTab === 'licitacoes' && <LicitacoesScreen />}

        {currentTab === 'infraestrutura' && <InfraestruturaScreen />}
      </View>

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        allowedTabs={allowedTabs}
      />

      <PtresFilterModal
        visible={isPtresOpen}
        onClose={() => setIsPtresOpen(false)}
        options={ptresOptions}
        selectedCode={selectedPtres}
        onSelect={setSelectedPtres}
      />

      <AccountModal
        visible={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        email={email}
        orgName={access.orgName}
        groupNames={access.groupNames}
        onSignOut={() => {
          setIsAccountOpen(false);
          onSignOut();
        }}
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
  );
}

function Gate() {
  const { status, user, access, errorMessage, signOut, retryAccess } = useAuth();

  if (status === 'loading') return <AccessStateScreen kind="loading" message="Abrindo o SIAGES..." />;
  if (status === 'signedOut') return <LoginScreen />;
  if (status === 'loadingAccess') return <AccessStateScreen kind="loading" message="Carregando suas permissões..." />;
  if (status === 'error') {
    return (
      <AccessStateScreen
        kind="error"
        message={errorMessage || 'Não foi possível carregar suas permissões.'}
        onRetry={retryAccess}
        onSignOut={signOut}
      />
    );
  }
  if (status === 'denied' || !access) {
    return (
      <AccessStateScreen
        kind="denied"
        email={user?.email}
        terceirizado={access?.isTerceirizado}
        onSignOut={signOut}
      />
    );
  }
  return <AuthenticatedApp access={access} email={user?.email} onSignOut={signOut} />;
}

export default function App() {
  const [fontesProntas, erroFontes] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Sem a fonte carregada mostramos só um indicador (nenhum texto é desenhado antes da hora).
  // Se o download/carga falhar, segue com a fonte do sistema em vez de travar o app.
  if (!fontesProntas && !erroFontes) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
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
