import { describe, expect, it } from 'vitest';
import {
  calculateEmpenhoAtividadeMatchScore,
  extractPlanoInternoCode,
  extractProcessNumbers,
  extractSiglas,
  matchEmpenhosToAtividades,
} from '../atividadeEmpenhoMatching';
import type { Atividade, Empenho } from '@/types';

describe('atividadeEmpenhoMatching', () => {
  describe('extractPlanoInternoCode', () => {
    it('extrai o código de 11 caracteres de strings completas', () => {
      expect(extractPlanoInternoCode('L2994P23AEN - DIAE-Ações de assistência estudantil')).toBe('L2994P23AEN');
      expect(extractPlanoInternoCode('L20RLP01ADN')).toBe('L20RLP01ADN');
      expect(extractPlanoInternoCode(null)).toBeNull();
      expect(extractPlanoInternoCode('')).toBeNull();
    });
  });

  describe('extractProcessNumbers', () => {
    it('extrai números de processos em diferentes formatos', () => {
      expect(extractProcessNumbers('CONFORME PROCESSO 23035.000591.2026-61.')).toEqual(['23035000591202661']);
      expect(extractProcessNumbers('Processo 23035.000591/2026-61')).toEqual(['23035000591202661']);
      expect(extractProcessNumbers('Sem processo')).toEqual([]);
    });
  });

  describe('extractSiglas', () => {
    it('extrai siglas entre parênteses e siglas conhecidas', () => {
      expect(extractSiglas('Programa de Apoio à Formação Estudantil (PAFE)')).toContain('PAFE');
      expect(extractSiglas('Auxílios a estudantes em eventos acadêmicos - (PROFE)')).toContain('PROFE');
      expect(extractSiglas('Fortalecer os Núcleos de Estudos (NEABI)')).toContain('NEABI');
      expect(extractSiglas('Fortalecer o ProITEC')).toContain('PROITEC');
    });
  });

  describe('matchEmpenhosToAtividades', () => {
    const atvPafe: Atividade = {
      id: 'atv-pafe',
      atividade: 'Programa de Apoio à Formação Estudantil (PAFE)',
      descricao: 'Programa de Apoio à Formação Estudantil (PAFE)',
      valorTotal: 110000,
      origemRecurso: '231802',
      planoInterno: 'L2994P23AEN - DIAE-Ações de assistência estudantil',
      naturezaDespesa: '339018',
      dimensao: 'AE',
      componenteFuncional: 'Atividades Estudantis',
      tipoAtividade: 'campus',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const atvTransporte: Atividade = {
      id: 'atv-transporte',
      atividade: 'Programa de Auxílio Transporte',
      descricao: 'Programa de Auxílio Transporte',
      valorTotal: 94377.12,
      origemRecurso: '231802',
      planoInterno: 'L2994P23AEN - DIAE-Ações de assistência estudantil',
      naturezaDespesa: '339018',
      dimensao: 'AE',
      componenteFuncional: 'Atividades Estudantis',
      tipoAtividade: 'campus',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const atvProfe: Atividade = {
      id: 'atv-profe',
      atividade: 'Auxílios a estudantes em eventos acadêmicos, artísticos e culturais - (PROFE)',
      descricao: 'Auxílios a estudantes em eventos acadêmicos, artísticos e culturais - (PROFE)',
      valorTotal: 45000,
      origemRecurso: '231802',
      planoInterno: 'L2994P23AEN - DIAE-Ações de assistência estudantil',
      naturezaDespesa: '339018',
      dimensao: 'AE',
      componenteFuncional: 'Atividades Estudantis',
      tipoAtividade: 'campus',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const atvNeabi: Atividade = {
      id: 'atv-neabi',
      atividade: 'Fortalecer os Núcleos de Estudos Afro-brasileiros e Indígenas e de Apoio a Pessoas de Povos e Comunidades Tradicionais (NEABI)',
      descricao: 'Fortalecer os Núcleos de Estudos Afro-brasileiros e Indígenas (NEABI)',
      valorTotal: 3200,
      origemRecurso: '231802',
      planoInterno: 'L2994P19ENN - PROEN-Ações de ensino',
      naturezaDespesa: '339018',
      dimensao: 'EN',
      componenteFuncional: 'Ensino',
      tipoAtividade: 'campus',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const empPafe: Empenho = {
      id: 'emp-1',
      numero: '2026NE000012',
      descricao: 'RECURSO PARA PAGAMENTO DE BOLSA PAFE, CONFORME PROCESSO 23035.000591.2026-61',
      valor: 53100,
      origemRecurso: '231802',
      planoInterno: 'L2994P23AEN',
      naturezaDespesa: '339018',
      tipo: 'exercicio',
      status: 'pendente',
      dataEmpenho: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const empTransporte: Empenho = {
      id: 'emp-2',
      numero: '2026NE000013',
      descricao: 'RECURSO PARA PAGAMENTO DE AUXILIO TRANSPORTE, CONFORME PROCESSO 23035.000593.2026-50',
      valor: 83258,
      origemRecurso: '231802',
      planoInterno: 'L2994P23AEN',
      naturezaDespesa: '339018',
      tipo: 'exercicio',
      status: 'pendente',
      dataEmpenho: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const empProfe: Empenho = {
      id: 'emp-3',
      numero: '2026NE000009',
      descricao: 'EMISSAO DE EMPENHO PARA PAGAMENTO DE AUXILIOS A ESTUDANTES EM EVENTOS ACADEMICO, ARTISTICOS E CULTURAIS (PROFE).',
      valor: 14286.35,
      origemRecurso: '231802',
      planoInterno: 'L2994P23AEN',
      naturezaDespesa: '339018',
      tipo: 'exercicio',
      status: 'pendente',
      dataEmpenho: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const empNeabi: Empenho = {
      id: 'emp-4',
      numero: '2026NE000022',
      descricao: 'EMISSAO DE EMPENHO PARA FORTALECER OS NUCLEOS DE ESTUDOS AFRO-BRASILEIROS E INDIGENAS E DE APOIO A PESSOAS DE POVOS E COMUNIDADES TRADICIONAIS (NEABI), CONFORME PROCESSO 23035.000866.2026-66',
      valor: 3200,
      origemRecurso: '231802',
      planoInterno: 'L2994P19ENN',
      naturezaDespesa: '339018',
      tipo: 'exercicio',
      status: 'pendente',
      dataEmpenho: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('correlaciona com sucesso os empenhos às atividades corretas da origem 231802', () => {
      const atividades = [atvPafe, atvTransporte, atvProfe, atvNeabi];
      const empenhos = [empPafe, empTransporte, empProfe, empNeabi];

      const { empenhosPorAtividadeMap, unmatchedEmpenhos } = matchEmpenhosToAtividades(atividades, empenhos);

      expect(unmatchedEmpenhos).toHaveLength(0);

      const pafeInfo = empenhosPorAtividadeMap.get(atvPafe.id);
      expect(pafeInfo?.total).toBe(53100);
      expect(pafeInfo?.count).toBe(1);

      const transporteInfo = empenhosPorAtividadeMap.get(atvTransporte.id);
      expect(transporteInfo?.total).toBe(83258);
      expect(transporteInfo?.count).toBe(1);

      const profeInfo = empenhosPorAtividadeMap.get(atvProfe.id);
      expect(profeInfo?.total).toBe(14286.35);
      expect(profeInfo?.count).toBe(1);

      const neabiInfo = empenhosPorAtividadeMap.get(atvNeabi.id);
      expect(neabiInfo?.total).toBe(3200);
      expect(neabiInfo?.count).toBe(1);
    });

    it('calcula saldos exatos evitando que o PAFE mostre valor total planejado de 110k', () => {
      const atividades = [atvPafe, atvTransporte, atvProfe, atvNeabi];
      const empenhos = [empPafe, empTransporte, empProfe, empNeabi];

      const { empenhosPorAtividadeMap } = matchEmpenhosToAtividades(atividades, empenhos);

      // Saldo do PAFE deve ser 110.000 - 53.100 = 56.900
      const pafeEmpenhado = empenhosPorAtividadeMap.get(atvPafe.id)?.total || 0;
      const pafeSaldo = atvPafe.valorTotal - pafeEmpenhado;
      expect(pafeSaldo).toBe(56900);

      // Saldo do NEABI deve ser 3.200 - 3.200 = 0
      const neabiEmpenhado = empenhosPorAtividadeMap.get(atvNeabi.id)?.total || 0;
      const neabiSaldo = atvNeabi.valorTotal - neabiEmpenhado;
      expect(neabiSaldo).toBe(0);
    });

    it('respeita vínculo manual explícito por atividadeId quando presente', () => {
      const empManual: Empenho = {
        ...empPafe,
        id: 'emp-manual',
        atividadeId: atvTransporte.id, // forçado manualmente para transporte
      };

      const { empenhosPorAtividadeMap } = matchEmpenhosToAtividades([atvPafe, atvTransporte], [empManual]);

      expect(empenhosPorAtividadeMap.get(atvTransporte.id)?.total).toBe(53100);
      expect(empenhosPorAtividadeMap.get(atvPafe.id)?.total).toBe(0);
    });
  });
});
