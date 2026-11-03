import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  systemSettingsService,
  type MaintenanceSettings,
  DEFAULT_MAINTENANCE_SETTINGS,
} from '@/services/systemSettings';
import { toast } from 'sonner';

interface MaintenanceContextType {
  settings: MaintenanceSettings;
  isLoading: boolean;
  isMaintenanceBlocking: boolean;
  toggleMaintenance: (enable?: boolean) => Promise<void>;
  updateSettings: (patch: Partial<MaintenanceSettings>) => Promise<void>;
  hasBypass: boolean;
  refreshSettings: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const { isSuperAdmin, user } = useAuth();
  const [settings, setSettings] = useState<MaintenanceSettings>(() =>
    systemSettingsService.getCachedSettings()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasBypass, setHasBypass] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const bypassParam = params.get('bypass');
    if (
      bypassParam === 'true' ||
      bypassParam === '1' ||
      bypassParam === DEFAULT_MAINTENANCE_SETTINGS.bypassSecret
    ) {
      sessionStorage.setItem('siages_maintenance_bypass', 'true');
      return true;
    }
    return sessionStorage.getItem('siages_maintenance_bypass') === 'true';
  });

  const loadSettings = useCallback(async () => {
    try {
      const data = await systemSettingsService.getMaintenanceSettings();
      setSettings(data);
    } catch (error) {
      console.warn('Erro ao obter configuracao de manutencao:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
    const unsubscribe = systemSettingsService.subscribeToMaintenance((updated) => {
      setSettings(updated);
    });

    return () => {
      unsubscribe();
    };
  }, [loadSettings]);

  // Se o usuário passar ?bypass na URL após carregar as settings
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const bypassParam = params.get('bypass');
    if (bypassParam && bypassParam.toLowerCase() === settings.bypassSecret.toLowerCase()) {
      sessionStorage.setItem('siages_maintenance_bypass', 'true');
      setHasBypass(true);
    }
  }, [settings.bypassSecret]);

  const toggleMaintenance = useCallback(
    async (enable?: boolean) => {
      const nextEnabled = typeof enable === 'boolean' ? enable : !settings.enabled;
      try {
        const updated = await systemSettingsService.updateMaintenanceSettings(
          { enabled: nextEnabled },
          user?.email
        );
        setSettings(updated);
        toast.success(
          nextEnabled
            ? 'Modo de manutenção ativado com sucesso.'
            : 'Modo de manutenção desativado. Sistema liberado para todos.'
        );
      } catch (error) {
        console.error(error);
        const current = await systemSettingsService.getMaintenanceSettings();
        setSettings(current);
        toast.error(error instanceof Error ? error.message : 'Falha ao alterar modo de manutenção.');
        throw error;
      }
    },
    [settings.enabled, user?.email]
  );

  const updateSettings = useCallback(
    async (patch: Partial<MaintenanceSettings>) => {
      try {
        const updated = await systemSettingsService.updateMaintenanceSettings(patch, user?.email);
        setSettings(updated);
        toast.success('Configurações da tela de manutenção salvas.');
      } catch (error) {
        console.error(error);
        const current = await systemSettingsService.getMaintenanceSettings();
        setSettings(current);
        toast.error(error instanceof Error ? error.message : 'Falha ao atualizar manutenção.');
        throw error;
      }
    },
    [user?.email]
  );

  // Define se o usuário atual deve ser bloqueado pela tela de manutenção
  const isMaintenanceBlocking = useMemo(() => {
    // 0. Enquanto ainda carrega pela primeira vez e não temos confirmação de manutenção, não bloqueia
    if (isLoading && !settings.enabled) return false;

    // 1. Se a manutenção não estiver ativada, ninguém é bloqueado
    if (!settings.enabled) return false;

    // 2. Superadministradores NUNCA são bloqueados
    if (isSuperAdmin) return false;

    // 3. Usuário com bypass ativo
    if (hasBypass) return false;

    // 4. Bloqueia usuários comuns e visitantes
    return true;
  }, [isLoading, settings.enabled, isSuperAdmin, hasBypass]);

  const value = useMemo(
    () => ({
      settings,
      isLoading,
      isMaintenanceBlocking,
      toggleMaintenance,
      updateSettings,
      hasBypass,
      refreshSettings: loadSettings,
    }),
    [settings, isLoading, isMaintenanceBlocking, toggleMaintenance, updateSettings, hasBypass, loadSettings]
  );

  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) {
    return {
      settings: DEFAULT_MAINTENANCE_SETTINGS,
      isLoading: false,
      isMaintenanceBlocking: false,
      toggleMaintenance: async () => {},
      updateSettings: async () => {},
      hasBypass: false,
      refreshSettings: async () => {},
    };
  }
  return context;
}
