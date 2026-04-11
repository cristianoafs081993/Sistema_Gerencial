import {
  inferTipoAtividadeFromDimensao,
  isTipoAtividade,
  resolveTipoAtividade,
} from '@/utils/atividadeScopes';

describe('atividadeScopes', () => {
  it('classifica ensino como sistemico no fallback por dimensao', () => {
    expect(inferTipoAtividadeFromDimensao('EN - Ensino')).toBe('sistemico');
  });

  it('classifica dimensoes diferentes de ensino como campus no fallback', () => {
    expect(inferTipoAtividadeFromDimensao('AD - Administracao')).toBe('campus');
  });

  it('mantem um tipo de atividade valido vindo do banco', () => {
    expect(resolveTipoAtividade('emendas-parlamentares', 'EN - Ensino')).toBe(
      'emendas-parlamentares',
    );
    expect(isTipoAtividade('campus')).toBe(true);
  });
});
