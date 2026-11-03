import { supabase } from '@/lib/supabase';

export interface MaintenanceSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  description: string;
  estimatedReturn: string;
  bypassSecret: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  enabled: false,
  title: 'Sistema em Manutenção',
  subtitle: 'Estamos realizando melhorias programadas na infraestrutura do SIAGES.',
  description:
    'O acesso aos módulos do sistema está temporariamente suspenso para realização de atualizações e manutenções programadas no ambiente. Voltaremos em breve.',
  estimatedReturn: 'Previsão de retorno em breve',
  bypassSecret: 'siages',
};

const CACHE_KEY = 'siages_maintenance_cache';

export function getCachedMaintenanceSettings(): MaintenanceSettings {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_MAINTENANCE_SETTINGS,
          ...parsed,
          enabled: Boolean(parsed.enabled),
        };
      }
    } catch {
      // Fallback
    }
  }
  return DEFAULT_MAINTENANCE_SETTINGS;
}

export function setCachedMaintenanceSettings(settings: MaintenanceSettings): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }
}

type DbSettingRow = {
  key: string;
  value: {
    enabled?: boolean;
    title?: string;
    subtitle?: string;
    description?: string;
    estimated_return?: string;
    bypass_secret?: string;
  };
  description?: string | null;
  updated_at?: string;
  updated_by?: string | null;
};

function normalizeMaintenanceSettings(row?: DbSettingRow | null): MaintenanceSettings {
  if (!row || !row.value) {
    return getCachedMaintenanceSettings();
  }

  const v = row.value;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_MAINTENANCE_SETTINGS.enabled,
    title: v.title || DEFAULT_MAINTENANCE_SETTINGS.title,
    subtitle: v.subtitle || DEFAULT_MAINTENANCE_SETTINGS.subtitle,
    description: v.description || DEFAULT_MAINTENANCE_SETTINGS.description,
    estimatedReturn: v.estimated_return || DEFAULT_MAINTENANCE_SETTINGS.estimatedReturn,
    bypassSecret: v.bypass_secret || DEFAULT_MAINTENANCE_SETTINGS.bypassSecret,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err);
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';

      const isTransient =
        msg.includes('schema cache') ||
        msg.includes('PGRST002') ||
        msg.includes('PGRST000') ||
        code === 'PGRST002' ||
        code === 'PGRST000' ||
        msg.includes('503') ||
        msg.includes('502') ||
        msg.includes('Failed to fetch') ||
        msg.includes('network');

      if (!isTransient || attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

export const systemSettingsService = {
  getCachedSettings: getCachedMaintenanceSettings,

  async getMaintenanceSettings(): Promise<MaintenanceSettings> {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase
          .from('system_settings')
          .select('*')
          .eq('key', 'maintenance_mode')
          .maybeSingle();

        if (error) {
          throw error;
        }

        const normalized = normalizeMaintenanceSettings(data as DbSettingRow | null);
        setCachedMaintenanceSettings(normalized);
        return normalized;
      }, 2, 400);
    } catch (err) {
      console.warn('Falha na requisicao de system_settings, preservando estado anterior:', err);
      return getCachedMaintenanceSettings();
    }
  },

  async updateMaintenanceSettings(
    nextSettings: Partial<MaintenanceSettings>,
    updatedBy?: string | null
  ): Promise<MaintenanceSettings> {
    const current = await this.getMaintenanceSettings();
    const merged: MaintenanceSettings = {
      ...current,
      ...nextSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy ?? current.updatedBy,
    };

    const payload = {
      key: 'maintenance_mode',
      value: {
        enabled: Boolean(merged.enabled),
        title: merged.title,
        subtitle: merged.subtitle,
        description: merged.description,
        estimated_return: merged.estimatedReturn,
        bypass_secret: merged.bypassSecret,
      },
      description: 'Controle do modo de manutenção do sistema',
      updated_at: merged.updatedAt,
      updated_by: merged.updatedBy,
    };

    return await withRetry(async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert(payload)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Falha ao salvar modo de manutenção: ${error.message}`);
      }

      const normalized = normalizeMaintenanceSettings(data as DbSettingRow);
      setCachedMaintenanceSettings(normalized);
      return normalized;
    }, 3, 600);
  },

  subscribeToMaintenance(onUpdate: (settings: MaintenanceSettings) => void): () => void {
    const channel = supabase
      .channel('system_settings_maintenance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.maintenance_mode',
        },
        (payload) => {
          if (payload.new) {
            const normalized = normalizeMaintenanceSettings(payload.new as DbSettingRow);
            setCachedMaintenanceSettings(normalized);
            onUpdate(normalized);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
