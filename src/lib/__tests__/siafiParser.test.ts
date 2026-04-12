import { parseSiafiCsv, syncSiafiDataToDb, type SiafiEmpenhoData } from '@/lib/siafi-parser';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const siafiCsvVigente = [
  '"NE CCor","NE CCor - Núm. Processo","UG Responsável","Fonte Recursos Detalhada","PTRES","PI Código PI","PI Nome","Natureza Despesa","NE CCor - Favorecido Número","NE CCor - Favorecido Nome","NE CCor - Descrição","DESPESAS EMPENHADAS (CONTROLE EMPENHO)","DESPESAS EMPENHADAS A LIQUIDAR (CONTROLE EMP)","DESPESAS LIQUIDADAS (CONTROLE EMPENHO)","DESPESAS LIQUIDADAS A PAGAR(CONTROLE EMPENHO)","DESPESAS PAGAS (CONTROLE EMPENHO)","RESTOS A PAGAR NAO PROCESSADOS REINSCRITOS","RESTOS A PAGAR INSCRITOS (PROC E N PROC)","RESTOS A PAGAR PAGOS (PROC E N PROC)","RESTOS A PAGAR A PAGAR (PROC E N PROC)"',
  '"158366264352024NE000010","23035.000105.2024-42","151606","1000000000","231796","L20RLP99CIN","DICI-COMUNIC E EVENTOS OUTRAS DESPESAS","339039","33083309000141","VITA SERVICOS DE CERIMONIAL E EVENTOS LTDA","RAP antigo","","","","","","3.570,00","3.570,00","","3.570,00"',
  '"158366264352026NE000003","23035.000003.2026-11","151606","1000000000","231796","L20RLP99ADN","PROAD-GESTAO ADMINISTRATIVA","339039","11111111000111","Fornecedor A","Empenho existente","6.095,00","4.345,41","1.749,59","0,00","1.749,59","","","",""',
  '"158366264352026NE000017","23035.000017.2026-11","151606","1000000000","231796","L20RLP99IEN","DIENG-CONTRATOS CONTINUADOS-INFRAESTRUTURA","339039","22222222000122","Fornecedor B","Empenho pago","105.812,82","88.177,35","17.635,47","3.606,45","14.029,02","","","",""',
  '"158366264352026NE000024","23035.000024.2026-11","151606","1000000000","231796","L20RLP99ADN","PROAD-GESTAO ADMINISTRATIVA","339039","33333333000133","Fornecedor C","Empenho novo","3.217,50","3.217,50","0,00","0,00","0,00","","","",""',
].join('\n');

describe('siafi-parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parseia o layout vigente do CSV SIAFI usado no upload manual', async () => {
    const file = new File([siafiCsvVigente], 'Empenhos (3).csv', { type: 'text/csv' });

    const parsed = await parseSiafiCsv(file);
    const exercicioRows = parsed.filter((row) => !row.isRap);

    expect(exercicioRows).toHaveLength(3);
    expect(exercicioRows.reduce((total, row) => total + row.valorLiquidadoOficial, 0)).toBeCloseTo(19385.06);
    expect(exercicioRows.reduce((total, row) => total + row.valorPagoOficial, 0)).toBeCloseTo(15778.61);
    expect(parsed.find((row) => row.numeroResumido === '2026NE000017')).toMatchObject({
      valorPagoOficial: 14029.02,
    });
    expect(parsed.find((row) => row.numeroResumido === '2024NE000010')).toMatchObject({
      isRap: true,
      rapInscrito: 3570,
      rapPago: 0,
      rapAPagar: 3570,
    });
  });

  it('atualiza empenhos existentes e cria empenho corrente ausente no reprocessamento SIAFI', async () => {
    const existingByNumero = new Map([
      ['2026NE000003', { id: 'existing-current', tipo: 'exercicio' }],
    ]);
    const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];
    const inserts: Record<string, unknown>[] = [];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      expect(table).toBe('empenhos');

      return {
        select: () => ({
          eq: (_column: string, numero: string) => ({
            limit: async () => ({
              data: existingByNumero.has(numero) ? [existingByNumero.get(numero)] : [],
              error: null,
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async (_column: string, id: string) => {
            updates.push({ id, payload });
            return { error: null };
          },
        }),
        insert: async (payload: Record<string, unknown>) => {
          inserts.push(payload);
          return { error: null };
        },
      } as never;
    });

    const data: SiafiEmpenhoData[] = [
      {
        numeroCompleto: '158366264352026NE000003',
        numeroResumido: '2026NE000003',
        processo: '23035.000003.2026-11',
        favorecidoNome: 'Fornecedor A',
        favorecidoDocumento: '11.111.111/0001-11',
        descricao: 'Empenho existente',
        naturezaDespesa: '339039',
        planoInterno: 'L20RLP99ADN',
        ptres: '231796',
        isRap: false,
        valorEmpenhado: 6095,
        valorLiquidadoOficial: 1749.59,
        valorPagoOficial: 1749.59,
        valorLiquidadoAPagar: 0,
        rapInscrito: 0,
        rapALiquidar: 0,
        rapLiquidado: 0,
        rapPago: 0,
        rapAPagar: 0,
      },
      {
        numeroCompleto: '158366264352026NE000024',
        numeroResumido: '2026NE000024',
        processo: '23035.000024.2026-11',
        favorecidoNome: 'Fornecedor C',
        favorecidoDocumento: '33.333.333/0001-33',
        descricao: 'Empenho novo',
        naturezaDespesa: '339039',
        planoInterno: 'L20RLP99ADN',
        ptres: '231796',
        isRap: false,
        valorEmpenhado: 3217.5,
        valorLiquidadoOficial: 0,
        valorPagoOficial: 0,
        valorLiquidadoAPagar: 0,
        rapInscrito: 0,
        rapALiquidar: 0,
        rapLiquidado: 0,
        rapPago: 0,
        rapAPagar: 0,
      },
    ];

    const result = await syncSiafiDataToDb(data);

    expect(result).toEqual({ atualizados: 1, criados: 1, erros: 0 });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      id: 'existing-current',
      payload: {
        valor: 6095,
        valor_liquidado: 1749.59,
        valor_liquidado_oficial: 1749.59,
        valor_pago_oficial: 1749.59,
      },
    });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      numero: '2026NE000024',
      tipo: 'exercicio',
      valor: 3217.5,
      valor_liquidado: 0,
      valor_liquidado_oficial: 0,
      valor_pago_oficial: 0,
    });
  });
});
