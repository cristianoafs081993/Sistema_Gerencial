import { describe, expect, it } from 'vitest';
import {
  buildContratoApiDerivedFields,
  deriveContratoApiCampusScope,
  deriveContratoApiStatus,
  isContratoApiCampusEmpenho,
  isContratoApiCampusFatura,
  isContratoApiNonCurraisNovosScope,
} from '@/utils/contratosApiStatus';

const today = new Date('2026-05-02T12:00:00Z');

describe('contratosApiStatus', () => {
  it('usa a maior vigencia_fim do historico para manter contrato vigente', () => {
    const status = deriveContratoApiStatus(
      {
        vigencia_inicio: '2024-01-01',
        vigencia_fim: '2025-01-01',
      },
      [
        {
          vigencia_inicio: '2024-01-01',
          vigencia_fim: '2025-01-01',
        },
        {
          tipo: 'Termo Aditivo',
          vigencia_inicio: '2025-01-02',
          vigencia_fim: '2026-12-31',
        },
      ],
      today,
    );

    expect(status).toMatchObject({
      situacao_derivada: true,
      vigencia_inicio_derivada: '2025-01-02',
      vigencia_fim_derivada: '2026-12-31',
      situacao_derivada_motivo: 'historico_vigente',
    });
  });

  it('marca como inativo quando o ultimo aditivo venceu e nao houve renovacao', () => {
    const status = deriveContratoApiStatus(
      {
        vigencia_inicio: '2024-01-01',
        vigencia_fim: '2027-01-01',
      },
      [
        {
          tipo: 'Termo Aditivo',
          vigencia_inicio: '2024-01-01',
          vigencia_fim: '2026-04-30',
        },
      ],
      today,
    );

    expect(status).toMatchObject({
      situacao_derivada: false,
      vigencia_fim_derivada: '2026-04-30',
      situacao_derivada_motivo: 'historico_vencido_sem_renovacao',
    });
  });

  it('termo de rescisao no historico torna o contrato inativo mesmo com vigencia futura', () => {
    const status = deriveContratoApiStatus(
      {
        vigencia_inicio: '2024-01-01',
        vigencia_fim: '2027-01-01',
      },
      [
        {
          tipo: 'Termo Aditivo',
          vigencia_inicio: '2024-01-01',
          vigencia_fim: '2027-01-01',
        },
        {
          tipo: 'Termo de Rescisao',
          observacao: 'Rescisao amigavel',
          data_assinatura: '2026-04-01',
        },
      ],
      today,
    );

    expect(status).toMatchObject({
      situacao_derivada: false,
      vigencia_fim_derivada: '2027-01-01',
      situacao_derivada_motivo: 'rescisao_ou_cancelamento_no_historico',
    });
  });

  it('usa vigencia da listagem como fallback quando nao ha historico', () => {
    const status = deriveContratoApiStatus(
      {
        vigencia_inicio: '2026-01-01',
        vigencia_fim: '2026-12-31',
      },
      [],
      today,
    );

    expect(status).toMatchObject({
      situacao_derivada: true,
      vigencia_inicio_derivada: '2026-01-01',
      vigencia_fim_derivada: '2026-12-31',
      situacao_derivada_motivo: 'fallback_sem_historico_vigente',
    });
  });

  it('inclui UG 158366 diretamente no escopo do campus', () => {
    expect(deriveContratoApiCampusScope({ unidade_codigo: '158366' }, [], [])).toEqual({
      inScope: true,
      campus_scope_reason: 'ug_campus',
    });
  });

  it('exclui contratos da UASG 158366 cujo objeto aponta campus avancado fora de Currais Novos', () => {
    const contratoParelhas = {
      unidade_codigo: '158366',
      objeto: 'Conclusao da construcao do galpao no Campus Avancado Parelhas',
    };
    expect(isContratoApiNonCurraisNovosScope(contratoParelhas)).toBe(true);
    expect(deriveContratoApiCampusScope(contratoParelhas, [], [])).toEqual({
      inScope: false,
      campus_scope_reason: 'ug_campus_objeto_fora_currais_novos',
    });

    expect(
      deriveContratoApiCampusScope(
        {
          unidade_codigo: '158366',
          objeto: 'Servicos continuados para o Campus Currais Novos',
        },
        [],
        [],
      ),
    ).toEqual({
      inScope: true,
      campus_scope_reason: 'ug_campus',
    });
  });

  it('inclui contrato da Reitoria apenas com evidencia operacional do campus', () => {
    expect(
      deriveContratoApiCampusScope(
        { unidade_codigo: '158155' },
        [{ unidade_gestora: '158366' }],
        [],
      ),
    ).toEqual({
      inScope: true,
      campus_scope_reason: 'reitoria_com_empenho_campus',
    });

    expect(deriveContratoApiCampusScope({ unidade_codigo: '158155' }, [], [])).toEqual({
      inScope: false,
      campus_scope_reason: 'reitoria_sem_evidencia_operacional_campus',
    });
  });

  it('identifica apenas evidencias operacionais da UG do campus', () => {
    expect(isContratoApiCampusEmpenho({ unidade_gestora: '158366' })).toBe(true);
    expect(isContratoApiCampusEmpenho({ unidade_gestora: '158155' })).toBe(false);
    expect(isContratoApiCampusFatura({ raw_data: { contratante: 'IFRN - UG 158366' } })).toBe(true);
    expect(isContratoApiCampusFatura({ raw_data: { contratante: 'IFRN - UG 158155' } })).toBe(false);
  });

  it('mantem vencido fora da tela mesmo quando a API retorna situacao ativa', () => {
    const derived = buildContratoApiDerivedFields(
      {
        unidade_codigo: '158366',
        vigencia_inicio: '2024-01-01',
        vigencia_fim: '2027-01-01',
      },
      [
        {
          tipo: 'Termo Aditivo',
          vigencia_inicio: '2024-01-01',
          vigencia_fim: '2026-04-30',
          situacao_contrato: 'Ativo',
        },
      ],
      [],
      [],
      today,
    );

    expect(derived.situacao_derivada).toBe(false);
    expect(derived.situacao_derivada_motivo).toBe('historico_vencido_sem_renovacao');
  });
});
