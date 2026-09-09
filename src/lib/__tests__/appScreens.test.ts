import { ADMIN_USERS_SCREEN_ID, appScreens, expandScreenAccessIds, getScreenForPath, isProductionScreen } from '@/lib/appScreens';

describe('app screen registry', () => {
  it('mapeia rotas diretas e escopos de planejamento para telas cadastradas', () => {
    expect(getScreenForPath('/empenhos')?.id).toBe('empenhos');
    expect(getScreenForPath('/credito-disponivel')?.id).toBe('credito-disponivel');
    expect(getScreenForPath('/planejamento/campus')?.id).toBe('planejamento');
    expect(getScreenForPath('/economia-tempo')?.id).toBe('economia-tempo');
    expect(getScreenForPath('/modelos-documentos')?.id).toBe('modelos-documentos');
    expect(getScreenForPath('/artefatos-licitacao')?.id).toBe('artefatos-licitacao');
    expect(getScreenForPath('/licitacoes-pregoes')?.id).toBe('licitacoes-pregoes');
    expect(getScreenForPath('/atas-registro-precos')?.id).toBe('atas-registro-precos');
    expect(getScreenForPath('/cadastro-fornecedores')?.id).toBe('cadastro-fornecedores');
    expect(getScreenForPath('/pesquisa-precos/ead')?.id).toBe('pesquisa-precos-ead');
    expect(getScreenForPath('/energia')?.id).toBe('energia-visao-geral');
    expect(getScreenForPath('/energia/esg')?.id).toBe('energia-esg');
    expect(getScreenForPath('/refeitorio')?.id).toBe('refeitorio');
    expect(getScreenForPath('/refeitorio/insumos')?.id).toBe('refeitorio-insumos');
  });

  it('expande subpaginas funcionais de modulos autorizados', () => {
    expect(expandScreenAccessIds(['pesquisa-precos'])).toEqual([
      'pesquisa-precos',
      'cadastro-fornecedores',
      'pesquisa-precos-ead',
    ]);
    expect(expandScreenAccessIds(['refeitorio'])).toEqual([
      'refeitorio',
      'refeitorio-insumos',
      'requisicao-compra',
    ]);
    expect(expandScreenAccessIds(['requisicao-compra'])).toEqual([
      'requisicao-compra',
      'refeitorio',
      'refeitorio-insumos',
    ]);
  });

  it('mantem controle de usuarios fora das telas de producao dos diretores', () => {
    const directorScreenIds = appScreens.filter(isProductionScreen).map((screen) => screen.id);

    expect(directorScreenIds).toContain('dashboard');
    expect(directorScreenIds).toContain('contratos');
    expect(directorScreenIds).toContain('credito-disponivel');
    expect(directorScreenIds).toContain('artefatos-licitacao');
    expect(directorScreenIds).toContain('licitacoes-pregoes');
    expect(directorScreenIds).toContain('atas-registro-precos');
    expect(directorScreenIds).toContain('energia-visao-geral');
    expect(directorScreenIds).toContain('energia-esg');
    expect(directorScreenIds).toContain('requisicao-compra');
    expect(directorScreenIds).toContain('refeitorio-insumos');
    expect(directorScreenIds).not.toContain('refeitorio');
    expect(directorScreenIds).not.toContain(ADMIN_USERS_SCREEN_ID);
    expect(directorScreenIds).not.toContain('modelos-documentos');
  });
});
