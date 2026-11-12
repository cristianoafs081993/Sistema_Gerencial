// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import type { LcSavedList } from '@/lib/lcSavedLists';
import type { SuapExtensionLcDocument, SuapExtensionLcStatus } from '@/lib/suapExtensionDispatch';
import type { LCRegistro } from '../lcImportService';
import type { LcGridRow } from '../lcWorkListBuilder';
import { isBolsaProcess, runSuapLcAutoBuild, type SuapLcAutoBuildDeps } from '../suapLcAutoBuildService';

const aluno = (nome: string, matricula: string, cpf: string, banco: string, agencia: string, conta: string) => [
  `${nome} (${matricula})`, 'Curso', 'Técnico em Informática', 'E-mail', 'aluno@escolar.ifrn.edu.br',
  'CPF', cpf, 'Empenho', '2026NE000123', 'Dados bancários', 'Banco', banco, 'Agência', agencia, 'Conta', conta,
].join('\n');

const oficio = (declared: number, alunos: string[]) => [
  `O auxílio por pessoa corresponde a R$ 400,00, relativa à ${declared} (${declared === 2 ? 'duas' : 'três'}) bolsas – TAL`,
  ...alunos,
].join('\n');

const ALUNO_A = aluno('ALUNA FICTICIA UM', '20241031120001', '529.982.247-25', 'Banco do Brasil S.A', '1234', '12345678-9');
const ALUNO_B = aluno('ALUNO FICTICIO DOIS', '20241031120002', '111.444.777-35', 'Nu Pagamentos S.A', '0001', '9876543-2');

const textDoc = (id: string, title: string, text: string): SuapExtensionLcDocument => ({ id, title, type: 'Ofício', kind: 'text', text });

const lcRows: LCRegistro[] = [{
  obListaCredores: '2026LC000001', sequencial: 1, favorecidoDocumento: '52998224725', favorecidoNome: 'ALUNA FICTICIA UM',
  bancoCodigo: '001', bancoNome: 'BB', agenciaCodigo: '1234', agenciaNome: '', contaBancaria: '12345678-9',
}];

function makeDeps(overrides: Partial<SuapLcAutoBuildDeps> = {}) {
  const statuses: SuapExtensionLcStatus[] = [];
  const save = vi.fn(async (input: Parameters<SuapLcAutoBuildDeps['save']>[0]): Promise<LcSavedList<LcGridRow>> => ({
    id: input.id || '11111111-1111-4111-8111-111111111111',
    name: input.name,
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
    sourcePdfNames: input.sourcePdfNames,
    rows: input.rows,
    suapId: input.suapId || undefined,
    origin: 'extensao',
    extraction: input.extraction || undefined,
  }));
  const deps: SuapLcAutoBuildDeps = {
    requestDocuments: vi.fn(async () => [
      textDoc('1', 'Despacho 526/2026', 'Autorização para liquidação da despesa.'),
      textDoc('2', 'Ofício Nº 156/2026', oficio(2, [ALUNO_A, ALUNO_B])),
    ]),
    extractFromPdf: vi.fn(async () => ({ records: [], warnings: [] })),
    extractWithAi: vi.fn(async () => ({ records: [] })),
    loadLcRows: vi.fn(async () => lcRows),
    findExisting: vi.fn(async () => null),
    save,
    onStatus: (status) => statuses.push(status),
    contaPagadora: '00001',
    now: () => new Date('2026-11-12T10:00:00.000Z'),
    ...overrides,
  };
  return { deps, statuses, save };
}

const info = { suapId: '505643', processNumber: '23035.003293.2026-22', assunto: 'Bolsa TAL 2026 - Outubro.', tipoProcesso: 'Ensino: Pagamento de Bolsa' };

describe('isBolsaProcess', () => {
  it('reconhece bolsa pelo assunto ou pelo tipo do processo', () => {
    expect(isBolsaProcess({ assunto: 'Bolsa TAL 2026 - Outubro.' })).toBe(true);
    expect(isBolsaProcess({ assunto: 'Pagamento', tipoProcesso: 'Ensino: Pagamento de Bolsa' })).toBe(true);
    expect(isBolsaProcess({ assunto: 'Pagamento de bolsistas do PIBIC' })).toBe(true);
    expect(isBolsaProcess({ assunto: 'Liquidação NF 123 - Bolsas térmicas' })).toBe(true);
    expect(isBolsaProcess({ assunto: 'Liquidação de nota fiscal', tipoProcesso: 'Administração: Pagamento' })).toBe(false);
  });
});

describe('runSuapLcAutoBuild', () => {
  it('nao faz nada em processo que nao e de bolsa', async () => {
    const { deps } = makeDeps();
    await expect(runSuapLcAutoBuild({ suapId: '1', assunto: 'Nota fiscal' }, deps)).resolves.toBeNull();
    expect(deps.findExisting).not.toHaveBeenCalled();
    expect(deps.requestDocuments).not.toHaveBeenCalled();
  });

  it('monta pelo script no documento com os alunos, sem chamar a IA, e salva vinculada ao processo', async () => {
    const { deps, statuses, save } = makeDeps();
    const result = await runSuapLcAutoBuild(info, deps);

    expect(deps.extractWithAi).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    const input = save.mock.calls[0][0];
    expect(input).toMatchObject({
      id: null,
      name: 'Bolsa TAL 2026 - Outubro — 23035.003293.2026-22',
      sourcePdfNames: ['Ofício Nº 156/2026'],
      suapId: '505643',
      processNumber: '23035.003293.2026-22',
      origin: 'extensao',
      extraction: { method: 'script', expected: 2, found: 2, pendencias: 1, documents: [{ id: '2', title: 'Ofício Nº 156/2026', kind: 'text' }] },
    });
    expect(input.rows.map((row) => [row.nome, row.status, row.selectedBanco])).toEqual([
      ['ALUNA FICTICIA UM', 'ok', '001'],
      ['ALUNO FICTICIO DOIS', 'aluno_nao_encontrado', '260'],
    ]);
    expect(statuses.map((status) => status.stage)).toEqual(['collecting', 'reading', 'saving', 'ready']);
    expect(result).toMatchObject({ stage: 'ready', listId: '11111111-1111-4111-8111-111111111111', found: 2, pendencias: 1, method: 'script' });
  });

  it('chama a IA quando o script le menos alunos que o total declarado e usa o resultado maior', async () => {
    const { deps, save } = makeDeps({
      requestDocuments: vi.fn(async () => [textDoc('2', 'Ofício', oficio(3, [ALUNO_A, ALUNO_B]))]),
      extractWithAi: vi.fn(async () => ({
        records: [
          { cpf: '529.982.247-25', nome: 'ALUNA FICTICIA UM', banco: '001', agencia: '1234', conta: '12345678-9', sourceFile: 'Ofício', valor: 400 },
          { cpf: '111.444.777-35', nome: 'ALUNO FICTICIO DOIS', banco: '260', agencia: '0001', conta: '9876543-2', sourceFile: 'Ofício', valor: 400 },
          { cpf: '123.456.789-09', nome: 'ALUNO FICTICIO TRES', banco: '104', agencia: '0002', conta: '555-1', sourceFile: 'Ofício', valor: 400 },
        ],
      })),
    });
    const result = await runSuapLcAutoBuild(info, deps);

    expect(deps.extractWithAi).toHaveBeenCalledWith(expect.objectContaining({ expectedCount: 3, processNumber: info.processNumber }));
    const input = save.mock.calls[0][0];
    expect(input.rows).toHaveLength(3);
    expect(input.rows.every((row) => row.ia)).toBe(true);
    expect(input.extraction?.method).toBe('ia');
    expect(result).toMatchObject({ stage: 'ready', method: 'ia', found: 3 });
  });

  it('chama a IA quando o script nao encontra alunos e mantem o aviso se ela falhar', async () => {
    const { deps, save } = makeDeps({
      requestDocuments: vi.fn(async () => [textDoc('9', 'Relação de bolsistas', 'Relação de bolsistas em anexo, total 2 (duas) bolsas.')]),
      extractWithAi: vi.fn(async () => { throw new Error('quota'); }),
    });
    const result = await runSuapLcAutoBuild(info, deps);

    expect(deps.extractWithAi).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(result).toMatchObject({ stage: 'empty', retryable: true });
    expect(result?.warnings).toEqual(['IA indisponível: quota.']);
  });

  it('mantem a lista ja montada para o processo sem reler documentos', async () => {
    const existing: LcSavedList<LcGridRow> = {
      id: '22222222-2222-4222-8222-222222222222', name: 'Editada', createdAt: '', updatedAt: '', sourcePdfNames: [],
      rows: [{ status: 'ok' } as LcGridRow, { status: 'conta_nao_encontrada' } as LcGridRow],
      suapId: '505643', origin: 'extensao',
      extraction: { method: 'script', documents: [], expected: 2, found: 2, pendencias: 1, warnings: [], builtAt: '' },
    };
    const { deps, save } = makeDeps({ findExisting: vi.fn(async () => existing) });
    const result = await runSuapLcAutoBuild(info, deps);

    expect(deps.requestDocuments).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result).toMatchObject({ stage: 'existing', listId: existing.id, found: 2, pendencias: 1, expected: 2 });
  });

  it('remontar substitui as linhas da lista existente mantendo id e nome', async () => {
    const existing = { id: '22222222-2222-4222-8222-222222222222', name: 'Editada', createdAt: '', updatedAt: '', sourcePdfNames: [], rows: [] };
    const { deps, save } = makeDeps({ findExisting: vi.fn(async () => existing) });
    await runSuapLcAutoBuild(info, deps, { force: true });

    expect(save.mock.calls[0][0]).toMatchObject({ id: existing.id, name: 'Editada' });
  });

  it('usa a lista salva por outra aba quando o indice unico recusa a insercao', async () => {
    const concurrent = { id: '33333333-3333-4333-8333-333333333333', name: 'Outra aba', createdAt: '', updatedAt: '', sourcePdfNames: [], rows: [] };
    const findExisting = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(concurrent);
    const { deps } = makeDeps({
      findExisting,
      save: vi.fn(async () => { throw Object.assign(new Error('duplicate key'), { code: '23505' }); }),
    });

    await expect(runSuapLcAutoBuild(info, deps)).resolves.toMatchObject({ stage: 'existing', listId: concurrent.id });
  });

  it('informa erro quando a extensao nao entrega os documentos', async () => {
    const { deps } = makeDeps({ requestDocuments: vi.fn(async () => { throw new Error('A extensão não enviou os documentos do processo.'); }) });
    await expect(runSuapLcAutoBuild(info, deps)).resolves.toMatchObject({ stage: 'error', retryable: true, message: 'A extensão não enviou os documentos do processo.' });
  });
});
