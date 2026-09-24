import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JsonImportDialog } from '@/components/JsonImportDialog';

describe('JsonImportDialog para relatórios SIAFI', () => {
  it('reconhece o cabeçalho real do CSV de Documentos Hábeis e exibe o nome esperado', async () => {
    const onImport = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <JsonImportDialog
        open
        onOpenChange={onOpenChange}
        onImport={onImport}
        title="Importar Documentos Hábeis"
        expectedFields={['documento_habil', 'dh_processo', 'dh_estado', 'dh_valor_doc_origem']}
        recommendedFilename="8 - Documentos Hábeis.csv"
        acceptCsv
      />,
    );

    expect(screen.getByText('8 - Documentos Hábeis.csv')).toBeInTheDocument();
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([
      [
        'Documento Hábil\tDH - Processo\tDH - Estado\tDH - UG Pagadora\tDH Item - UG Pagadora\tDH - Credor\t\tDH - Situação\tDH - Data Emissão Doc.Origem\tDH Item - Dia Vencimento\tDH Item - Dia Pagamento\tDH Item - Liquidado (S/N)\tDH - Valor Doc.Origem\tMétrica\t',
        '158366264352026NP000262\t23035.002730/2026-91\tREALIZADO\t158366\t158366\t12345678000199\tEmpresa Exemplo\tDOB035\t14/09/2026\t20/09/2026\t20/09/2026\tS\t18669,00\tRetenção\t1.928,83',
      ].join('\n'),
    ], '8 - Documentos Hábeis.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByText('Arquivo Validado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /importar \(1\)/i }));

    await waitFor(() => expect(onImport).toHaveBeenCalledWith([
      expect.objectContaining({
        documentohabil: '158366264352026NP000262',
        dhsituacao: 'DOB035',
        empty_6: 'Empresa Exemplo',
        empty_14: '1.928,83',
      }),
    ]));
  });

  it('localiza o cabeçalho tabulado na segunda linha do CSV de Liquidações', async () => {
    const onImport = vi.fn();
    render(
      <JsonImportDialog
        open
        onOpenChange={vi.fn()}
        onImport={onImport}
        title="Importar Fonte SOF / Liquidações"
        expectedFields={['documento_origem', 'ne_ccor', 'fonte_sof']}
        recommendedFilename="9 - Liquidações.csv"
        acceptCsv
      />,
    );
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([
      'Relatório SIAFI\nEmissão - Dia\tNS\tDocumento Origem\tNE CCor\tFonte SOF\n16/09/2026\t2026NS000001\t2026NP000262\t2026NE000001\t1000',
    ], '9 - Liquidações.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByText('Arquivo Validado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /importar \(1\)/i }));

    await waitFor(() => expect(onImport).toHaveBeenCalledWith([
      expect.objectContaining({
        documentoorigem: '2026NP000262',
        neccor: '2026NE000001',
        fontesof: '1000',
      }),
    ]));
  });

  it('reconhece os cabeçalhos oficiais de Ordens Bancárias e Situações', async () => {
    const onImportBank = vi.fn();
    const { unmount } = render(
      <JsonImportDialog
        open
        onOpenChange={vi.fn()}
        onImport={onImportBank}
        title="Importar Ordens Bancárias / Pagos"
        expectedFields={['documento', 'documento_origem', 'despesas_pagas', 'restos_a_pagar_pagos']}
        recommendedFilename="12 - Ordens Bancárias (5).csv"
        acceptCsv
      />,
    );
    const bankFile = new File([
      'Dia Lançamento\tDocumento\tDocumento Origem\tDESPESAS PAGAS\tRESTOS A PAGAR PAGOS (PROC E N PROC)\n16/09/2026\t2026OB000001\t2026NP000262\t0,00\t1.928,83',
    ], '12 - Ordens Bancárias (5).csv', { type: 'text/csv' });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [bankFile] },
    });
    expect(await screen.findByText('Arquivo Validado')).toBeInTheDocument();
    unmount();

    const onImportSituations = vi.fn();
    render(
      <JsonImportDialog
        open
        onOpenChange={vi.fn()}
        onImport={onImportSituations}
        title="Importar Situações (Despesas/Retenções)"
        expectedFields={['documento_habil', 'dh_situacao', 'dh_valor_doc_origem']}
        recommendedFilename="21 -Retenções por NP.csv"
        acceptCsv
      />,
    );
    const situationFile = new File([
      'DH - Situação,DH - Valor Doc.Origem,Documento Hábil\nDOB035,"1.928,83",2026NP000262',
    ], '21 -Retenções por NP.csv', { type: 'text/csv' });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, {
      target: { files: [situationFile] },
    });
    expect(await screen.findByText('Arquivo Validado')).toBeInTheDocument();
  });
});
