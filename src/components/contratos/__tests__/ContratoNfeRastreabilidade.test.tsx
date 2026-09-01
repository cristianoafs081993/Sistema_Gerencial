import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContratoNfeRastreabilidade } from '../ContratoNfeRastreabilidade';
import type { PncpInstrumentoCobranca } from '@/services/pncpInstrumentosCobranca';
import type { ContratoApiFaturaRow } from '@/services/contratosApi';

describe('ContratoNfeRastreabilidade', () => {
  it('renderiza os cards de NF-e, chave de acesso formatada e conciliação com faturas', () => {
    const instrumentos: PncpInstrumentoCobranca[] = [
      {
        sequencialInstrumentoCobranca: 1,
        tipoNome: 'Nota Fiscal Eletrônica (NF-e)',
        numeroInstrumentoCobranca: '864',
        dataEmissaoDocumento: '2026-07-23',
        chaveNFe: '24260755806684000105550010000008641253540068',
        notaFiscal: {
          numero: 864,
          serie: 1,
          chaveNotaFiscal: '24260755806684000105550010000008641253540068',
          valorNotaFiscal: 1318.11,
          nomeFornecedor: 'ZONA OESTE COMERCIO LTDA',
          cnpjFornecedor: '55.806.684/0001-05',
          municipioFornecedor: 'NATAL',
          tipoEventoMaisRecente: 'Autorização de Uso',
        },
        itens: [
          {
            numeroProduto: '1',
            descricaoProdutoServico: 'GLP EM CILINDRO P45',
            codigoNcmSh: '27111910',
            cfop: '5656',
            quantidade: '3,00',
            unidade: 'kg',
            valorUnitario: '439,37',
            valor: '1.318,11',
          },
        ],
        eventos: [],
        raw: {},
      },
    ];

    const faturasApi: ContratoApiFaturaRow[] = [
      {
        id: 'f1',
        contrato_api_id: 'c1',
        api_fatura_id: 100,
        numero: 'FAT-864',
        numero_instrumento_cobranca: '864',
        situacao: 'Pago',
        valor_bruto: 1318.11,
        valor_liquido: 1318.11,
        updated_at: '2026-08-01T00:00:00Z',
      },
    ];

    render(
      <ContratoNfeRastreabilidade
        instrumentos={instrumentos}
        faturasApi={faturasApi}
      />,
    );

    expect(screen.getByText('Nota Fiscal Nº 864')).toBeInTheDocument();
    expect(screen.getByText(/ZONA OESTE COMERCIO LTDA/i)).toBeInTheDocument();
    expect(screen.getByText(/Autorização de Uso/i)).toBeInTheDocument();
    expect(screen.getByText(/Conciliada no SIAFI/i)).toBeInTheDocument();

    // Chave formatada
    expect(screen.getByText(/2426 0755 8066 8400 0105 5500 1000 0008 6412 5354 0068/i)).toBeInTheDocument();

    // Botão de copiar
    expect(screen.getByRole('button', { name: /Copiar/i })).toBeInTheDocument();
    // Link Portal SEFAZ
    expect(screen.getByText('Portal SEFAZ')).toBeInTheDocument();
  });

  it('renderiza empty state amigável quando não há instrumentos de cobrança', () => {
    const onRefresh = vi.fn();
    render(
      <ContratoNfeRastreabilidade
        instrumentos={[]}
        faturasApi={[]}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText(/Nenhum instrumento de cobrança ou NF-e/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Consultar no PNCP agora/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRefresh).toHaveBeenCalled();
  });
});
