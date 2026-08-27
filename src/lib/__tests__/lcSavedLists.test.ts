import { beforeEach, describe, expect, it } from 'vitest';

import { deleteLcSavedList, loadLcSavedLists, saveLcSavedList } from '@/lib/lcSavedLists';

describe('lcSavedLists', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('salva, atualiza e carrega uma lista de trabalho da LC', () => {
    const saved = saveLcSavedList({
      name: 'Pagamento agosto',
      sourcePdfNames: ['pagamento-agosto.pdf'],
      rows: [{ cpf: '12345678901', selectedConta: '020846728' }],
    });

    const updated = saveLcSavedList({
      id: saved.id,
      name: 'Pagamento agosto revisado',
      sourcePdfNames: ['pagamento-agosto.pdf'],
      rows: [{ cpf: '12345678901', selectedConta: '999999999' }],
    });

    expect(updated.id).toBe(saved.id);
    expect(updated.createdAt).toBe(saved.createdAt);
    expect(loadLcSavedLists()).toEqual([
      expect.objectContaining({
        id: saved.id,
        name: 'Pagamento agosto revisado',
        rows: [{ cpf: '12345678901', selectedConta: '999999999' }],
      }),
    ]);
  });

  it('exclui somente a lista selecionada', () => {
    const first = saveLcSavedList({ name: 'Primeira', sourcePdfNames: [], rows: [] });
    saveLcSavedList({ name: 'Segunda', sourcePdfNames: [], rows: [] });

    deleteLcSavedList(first.id);

    expect(loadLcSavedLists()).toEqual([
      expect.objectContaining({ name: 'Segunda' }),
    ]);
  });
});
