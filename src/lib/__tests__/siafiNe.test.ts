// @vitest-environment node
import { agruparNesPorCampus, extractUgEmitenteDaNe, mesclarNesDuplicadas } from '@/lib/siafiNe';
import { isIfrnCampusUasg } from '@/lib/ifrnCampuses';

describe('siafiNe', () => {
  describe('extractUgEmitenteDaNe', () => {
    it('extrai a UG emitente dos 6 primeiros digitos do NE CCor completo', () => {
      expect(extractUgEmitenteDaNe('152711264352026NE000001')).toBe('152711');
      expect(extractUgEmitenteDaNe('158366264352026NE000107')).toBe('158366');
      expect(extractUgEmitenteDaNe(' 158155264352025NE000014 ')).toBe('158155');
    });

    it('retorna null para o numero resumido ou valores invalidos', () => {
      expect(extractUgEmitenteDaNe('2026NE000001')).toBeNull();
      expect(extractUgEmitenteDaNe('12345NE000001')).toBeNull();
      expect(extractUgEmitenteDaNe('')).toBeNull();
      expect(extractUgEmitenteDaNe(undefined)).toBeNull();
    });
  });

  describe('mesclarNesDuplicadas', () => {
    const linha = (numeroCompleto: string, extra: Record<string, unknown>) => ({
      numeroCompleto,
      isRap: false,
      favorecidoNome: 'MERCATTO',
      descricao: '',
      valorEmpenhado: 0,
      valorLiquidadoOficial: 0,
      valorPagoOficial: 0,
      valorLiquidadoAPagar: 0,
      rapInscrito: 0,
      rapALiquidar: 0,
      rapLiquidado: 0,
      rapPago: 0,
      rapAPagar: 0,
      ...extra,
    });

    it('soma a linha principal e a linha de ajuste da NE, qualquer que seja a ordem no arquivo', () => {
      const principal = linha('158366264352026NE000001', {
        valorEmpenhado: 8897.98,
        valorLiquidadoOficial: 8897.98,
        valorPagoOficial: 8377.45,
        valorLiquidadoAPagar: 520.53,
        descricao: 'Compra de alimentos',
      });
      // "liquidado a pagar" (520,53) vem entre parenteses e e lido como 0 pelos parsers.
      const ajuste = linha('158366264352026NE000001', { valorPagoOficial: 520.53 });

      for (const ordem of [[principal, ajuste], [ajuste, principal]]) {
        const [resultado, ...demais] = mesclarNesDuplicadas(ordem);
        expect(demais).toHaveLength(0);
        expect(resultado).toMatchObject({
          valorEmpenhado: 8897.98,
          valorLiquidadoOficial: 8897.98,
          valorPagoOficial: 8897.98,
          valorLiquidadoAPagar: 0,
          descricao: 'Compra de alimentos',
          favorecidoNome: 'MERCATTO',
        });
      }
    });

    it('nao mistura NEs de UGs diferentes com o mesmo numero resumido e nao altera linhas unicas', () => {
      const a = linha('158366264352026NE000126', { valorEmpenhado: 100, valorLiquidadoAPagar: 7 });
      const b = linha('158365264352026NE000126', { valorEmpenhado: 2511903.04 });
      const resultado = mesclarNesDuplicadas([a, b]);

      expect(resultado).toHaveLength(2);
      expect(resultado[0]).toMatchObject({ valorEmpenhado: 100, valorLiquidadoAPagar: 7 });
      expect(resultado[1]).toMatchObject({ valorEmpenhado: 2511903.04 });
    });

    it('em saldo de RAP a ultima linha prevalece, sem somar', () => {
      const rap = (saldo: number) => linha('158366264352024NE000010', { isRap: true, rapSaldoOnly: true, rapAPagar: saldo });
      expect(mesclarNesDuplicadas([rap(100), rap(250)])[0]).toMatchObject({ rapAPagar: 250 });
    });
  });

  describe('agruparNesPorCampus', () => {
    const rows = [
      { numeroCompleto: '158366264352026NE000001' },
      { numeroCompleto: '152711264352026NE000001' },
      { numeroCompleto: '158155264352026NE000001' },
      { numeroCompleto: '158999264352026NE000001' },
      { numeroCompleto: '2026NE000009' },
    ];
    const base = { campusPadrao: '158366', isCampusValido: isIfrnCampusUasg };

    it('direciona cada NE para o campus da sua UG, mesmo com numero resumido repetido', () => {
      const { porCampus, ignoradas } = agruparNesPorCampus(rows, base);

      expect(Array.from(porCampus.keys()).sort()).toEqual(['152711', '158155', '158366']);
      expect(porCampus.get('158366')).toHaveLength(2); // inclui a NE sem UG no numero
      expect(ignoradas).toMatchObject({ total: 1, ugDesconhecida: 1, semPermissao: 0, porUg: { '158999': 1 } });
    });

    it('sem permissao para outras UGs, so aceita o campus da sessao e conta as demais', () => {
      const { porCampus, ignoradas } = agruparNesPorCampus(rows, { ...base, apenasCampusPadrao: true });

      expect(Array.from(porCampus.keys())).toEqual(['158366']);
      expect(porCampus.get('158366')).toHaveLength(2);
      expect(ignoradas).toMatchObject({ total: 3, semPermissao: 2, ugDesconhecida: 1 });
      expect(ignoradas.porUg).toEqual({ '152711': 1, '158155': 1, '158999': 1 });
    });
  });
});
