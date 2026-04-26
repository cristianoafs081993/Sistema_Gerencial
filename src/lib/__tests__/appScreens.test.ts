import { ADMIN_USERS_SCREEN_ID, appScreens, getScreenForPath, isProductionScreen } from '@/lib/appScreens';

describe('app screen registry', () => {
  it('mapeia rotas diretas e escopos de planejamento para telas cadastradas', () => {
    expect(getScreenForPath('/empenhos')?.id).toBe('empenhos');
    expect(getScreenForPath('/planejamento/campus')?.id).toBe('planejamento');
    expect(getScreenForPath('/economia-tempo')?.id).toBe('economia-tempo');
    expect(getScreenForPath('/modelos-documentos')?.id).toBe('modelos-documentos');
  });

  it('mantem controle de usuarios fora das telas de producao dos diretores', () => {
    const directorScreenIds = appScreens.filter(isProductionScreen).map((screen) => screen.id);

    expect(directorScreenIds).toContain('dashboard');
    expect(directorScreenIds).toContain('contratos');
    expect(directorScreenIds).toContain('economia-tempo');
    expect(directorScreenIds).not.toContain(ADMIN_USERS_SCREEN_ID);
    expect(directorScreenIds).not.toContain('modelos-documentos');
  });
});
