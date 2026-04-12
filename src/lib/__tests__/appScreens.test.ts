import { ADMIN_USERS_SCREEN_ID, appScreens, getScreenForPath, isProductionScreen } from '@/lib/appScreens';

describe('app screen registry', () => {
  it('mapeia rotas diretas e escopos de planejamento para telas cadastradas', () => {
    expect(getScreenForPath('/empenhos')?.id).toBe('empenhos');
    expect(getScreenForPath('/planejamento/campus')?.id).toBe('planejamento');
  });

  it('mantem controle de usuarios fora das telas de producao dos diretores', () => {
    const directorScreenIds = appScreens.filter(isProductionScreen).map((screen) => screen.id);

    expect(directorScreenIds).toContain('dashboard');
    expect(directorScreenIds).toContain('contratos');
    expect(directorScreenIds).not.toContain(ADMIN_USERS_SCREEN_ID);
  });
});
