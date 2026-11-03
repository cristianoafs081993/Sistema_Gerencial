import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  systemSettingsService,
  DEFAULT_MAINTENANCE_SETTINGS,
} from '@/services/systemSettings';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      channel: vi.fn(),
      removeChannel: vi.fn(),
    },
  };
});

describe('systemSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna DEFAULT_MAINTENANCE_SETTINGS se banco nao retornar registro', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await systemSettingsService.getMaintenanceSettings();
    expect(result.title).toBe(DEFAULT_MAINTENANCE_SETTINGS.title);
    expect(result.bypassSecret).toBe('siages');
  });

  it('normaliza dados recebidos da tabela system_settings', async () => {
    const dbRow = {
      key: 'maintenance_mode',
      value: {
        enabled: true,
        title: 'Manutencao Agendada',
        description: 'Estamos realizando backup',
        estimated_return: '15:00',
        bypass_secret: 'segredo123',
      },
      updated_at: '2026-11-03T10:00:00Z',
      updated_by: 'admin@ifrn.edu.br',
    };

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await systemSettingsService.getMaintenanceSettings();
    expect(result.enabled).toBe(true);
    expect(result.title).toBe('Manutencao Agendada');
    expect(result.estimatedReturn).toBe('15:00');
    expect(result.bypassSecret).toBe('segredo123');
    expect(result.updatedBy).toBe('admin@ifrn.edu.br');
  });

  it('salva atualizacao do modo de manutencao no Supabase', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        key: 'maintenance_mode',
        value: {
          enabled: false,
          title: 'Sistema em Manutenção',
          bypass_secret: 'siages',
        },
        updated_at: '2026-11-03T11:00:00Z',
        updated_by: 'cristiano@ifrn.edu.br',
      },
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const upsertMock = vi.fn().mockReturnValue({ select: selectMock });

    // Mock getMaintenanceSettings call inside updateMaintenanceSettings
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        key: 'maintenance_mode',
        value: { enabled: true, title: 'Sistema em Manutenção', bypass_secret: 'siages' },
      },
      error: null,
    });
    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectGetMock = vi.fn().mockReturnValue({ eq: eqMock });

    (supabase.from as any).mockImplementation((table: string) => {
      return {
        select: selectGetMock,
        upsert: upsertMock,
      };
    });

    const updated = await systemSettingsService.updateMaintenanceSettings(
      { enabled: false },
      'cristiano@ifrn.edu.br'
    );

    expect(upsertMock).toHaveBeenCalled();
    expect(updated.enabled).toBe(false);
  });

  it('retenta chamada e recupera com sucesso se receber erro transitório de schema cache (PGRST002)', async () => {
    let attempt = 0;
    const maybeSingleMock = vi.fn().mockImplementation(() => {
      attempt++;
      if (attempt === 1) {
        return Promise.resolve({
          data: null,
          error: { message: 'Could not query the database for the schema cache. Retrying.', code: 'PGRST002' },
        });
      }
      return Promise.resolve({
        data: {
          key: 'maintenance_mode',
          value: { enabled: false, title: 'Sistema Operacional' },
        },
        error: null,
      });
    });

    const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await systemSettingsService.getMaintenanceSettings();
    expect(attempt).toBe(2);
    expect(result.enabled).toBe(false);
    expect(result.title).toBe('Sistema Operacional');
  });
});
