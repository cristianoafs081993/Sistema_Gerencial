import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import EditorDocumentos from '@/pages/EditorDocumentos';
import { useData } from '@/contexts/DataContext';
import { contractDraftsService } from '@/services/contractDrafts';
import { referenceTermsService } from '@/services/referenceTerms';
import { suapProcessosService } from '@/services/suapProcessos';

vi.mock('@/contexts/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/Editor/RichTextEditor', () => ({
  default: ({
    content,
    toolbarLeft,
  }: {
    content: string;
    toolbarLeft?: ReactNode;
  }) => (
    <div>
      <div>{toolbarLeft}</div>
      <div data-testid="editor-content">{content}</div>
    </div>
  ),
}));

vi.mock('@/services/suapProcessos', () => ({
  suapProcessosService: {
    getAll: vi.fn(),
    getPdfSignedUrl: vi.fn(),
  },
}));

vi.mock('@/services/contractDrafts', () => ({
  contractDraftsService: {
    analyzeProcessPdf: vi.fn(),
    generateDraft: vi.fn(),
  },
}));

vi.mock('@/services/referenceTerms', () => ({
  referenceTermsService: {
    analyzeProcessPdf: vi.fn(),
    getActiveTemplate: vi.fn(),
    generateDraft: vi.fn(),
  },
}));

const mockedUseData = vi.mocked(useData);
const mockedSuapProcessosService = vi.mocked(suapProcessosService);
const mockedContractDraftsService = vi.mocked(contractDraftsService);
const mockedReferenceTermsService = vi.mocked(referenceTermsService);

describe('EditorDocumentos', () => {
  beforeEach(() => {
    mockedUseData.mockReturnValue({
      atividades: [],
      empenhos: [],
      descentralizacoes: [],
      contratos: [],
      contratosEmpenhos: [],
      creditosDisponiveis: [],
      isLoading: false,
      addAtividade: vi.fn(),
      updateAtividade: vi.fn(),
      deleteAtividade: vi.fn(),
      addEmpenho: vi.fn(),
      updateEmpenho: vi.fn(),
      deleteEmpenho: vi.fn(),
      addDescentralizacao: vi.fn(),
      updateDescentralizacao: vi.fn(),
      deleteDescentralizacao: vi.fn(),
      getResumoOrcamentario: vi.fn(),
      getTotalPlanejado: vi.fn(),
      getTotalEmpenhado: vi.fn(),
      getTotalDescentralizado: vi.fn(),
      getADescentralizar: vi.fn(),
      getSaldoTotal: vi.fn(),
      refreshData: vi.fn(),
    });

    mockedSuapProcessosService.getAll.mockResolvedValue([
      {
        id: 'proc-1',
        suapId: '123',
        url: 'https://suap.local/processo/1',
        status: 'sincronizado',
        numProcesso: '23035.000123/2026-11',
        beneficiario: 'Fornecedor Teste Ltda',
        cpfCnpj: '12345678000190',
        assunto: 'Servico continuado de apoio',
        pdfUrl: 'proc-1.pdf',
        dadosCompletos: {
          contrato_numero: '15/2026',
        },
      },
    ] as never);

    mockedContractDraftsService.analyzeProcessPdf.mockResolvedValue({
      pageCount: 12,
      searchablePageCount: 12,
      templateCandidates: [
        {
          id: 'candidate-1',
          title: 'Contrato 15/2026',
          subtitle: 'Paginas 8-14',
          pageStart: 8,
          pageEnd: 14,
          pageNumbers: [8, 9, 10, 11, 12, 13, 14],
          excerpt: 'TERMO DE CONTRATO...',
          templateText: 'TERMO DE CONTRATO...',
          truncated: false,
        },
      ],
      snippets: [],
      warnings: [],
    });

    mockedContractDraftsService.generateDraft.mockResolvedValue({
      status: 'generated',
      title: 'Contrato 15/2026',
      subtitle: 'Fornecedor Teste Ltda | Processo 23035.000123/2026-11',
      html: '<p>Contrato gerado</p>',
      warnings: [],
      missingRequiredFields: [],
      fields: [],
      sources: [{ label: 'Contrato 15/2026', pageStart: 8, pageEnd: 14 }],
      model: 'gemini-2.0-flash',
    });

    mockedReferenceTermsService.getActiveTemplate.mockResolvedValue({
      id: 'template-1',
      code: 'termo-referencia-compras',
      name: 'TR Compras',
      description: 'Modelo vigente',
      versionLabel: 'Dez/2025',
      fileName: 'tr-compras.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      templateBase64: 'dGVzdGU=',
      templateText: 'MODELO DE TERMO DE REFERENCIA',
      editableBlocks: [
        {
          id: 'block-1',
          kind: 'paragraph',
          blockIndex: 1,
          text: '[INSERIR OBJETO]',
          excerpt: '[INSERIR OBJETO]',
          isInstructional: true,
          hasPlaceholder: true,
        },
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    mockedReferenceTermsService.analyzeProcessPdf.mockResolvedValue({
      pageCount: 18,
      searchablePageCount: 18,
      snippets: [
        {
          id: 'objeto-5',
          kind: 'objeto',
          label: 'Objeto da contratacao',
          pageNumber: 5,
          excerpt: 'Aquisicao de notebooks para laboratorios.',
        },
      ],
      warnings: [],
    });

    mockedReferenceTermsService.generateDraft.mockResolvedValue({
      status: 'generated',
      title: 'Termo de Referencia - Compras',
      subtitle: 'Processo 23035.000123/2026-11',
      html: '<p>TR gerado</p>',
      warnings: [],
      missingRequiredFields: [],
      fields: [],
      sources: [{ label: 'Objeto da contratacao', pageStart: 5, pageEnd: 5 }],
      model: 'gemini-2.0-flash',
      templatePlan: {
        paragraphReplacements: [
          {
            blockId: 'block-1',
            blockIndex: 1,
            paragraphs: ['Objeto: aquisicao de notebooks.'],
          },
        ],
        tableReplacements: [],
      },
    });
  });

  it('gera contrato a partir de processo sincronizado', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Contrato de Servico IFRN/i }));
    fireEvent.change(screen.getByPlaceholderText('Cole um numero de processo sincronizado no SUAP.'), {
      target: { value: '23035.000123/2026-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar contrato/i }));

    await waitFor(() => {
      expect(mockedContractDraftsService.analyzeProcessPdf).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockedContractDraftsService.generateDraft).toHaveBeenCalled();
    });

    expect(await screen.findByText('Contrato gerado.')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toHaveTextContent('<p>Contrato gerado</p>');
  });

  it('gera termo de referencia e habilita download em DOCX', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Termo de Referencia - Compras/i }));
    fireEvent.change(screen.getByPlaceholderText('Cole um numero de processo sincronizado no SUAP.'), {
      target: { value: '23035.000123/2026-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar Termo de Referencia/i }));

    await waitFor(() => {
      expect(mockedReferenceTermsService.getActiveTemplate).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockedReferenceTermsService.analyzeProcessPdf).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockedReferenceTermsService.generateDraft).toHaveBeenCalled();
    });

    expect(await screen.findByText('Termo de Referencia gerado.')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toHaveTextContent('<p>TR gerado</p>');
    expect(screen.getByRole('button', { name: /Baixar DOCX/i })).toBeInTheDocument();
  });

  it('exibe questionario do termo de referencia antes da geracao final', async () => {
    mockedReferenceTermsService.generateDraft.mockClear();
    mockedReferenceTermsService.getActiveTemplate.mockResolvedValueOnce({
      id: 'template-1',
      code: 'termo-referencia-compras',
      name: 'TR Compras',
      description: 'Modelo vigente',
      versionLabel: 'Dez/2025',
      fileName: 'tr-compras.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      templateBase64: 'dGVzdGU=',
      templateText: 'MODELO DE TERMO DE REFERENCIA',
      editableBlocks: [
        {
          id: 'block-1',
          kind: 'paragraph',
          blockIndex: 1,
          text: '[INSERIR OBJETO]',
          excerpt: '[INSERIR OBJETO]',
          isInstructional: true,
          hasPlaceholder: true,
        },
      ],
      questionnaireSchema: {
        version: 1,
        generatedAt: new Date().toISOString(),
        questions: [
          {
            id: 'field-1-inserir-objeto',
            kind: 'field',
            title: 'Campo previsto no modelo',
            prompt: 'Preencha [INSERIR OBJETO] ou pule para manter o campo pendente.',
            blockId: 'block-1',
            blockIndex: 1,
            placeholder: '[INSERIR OBJETO]',
          },
        ],
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Termo de Referencia - Compras/i }));
    fireEvent.change(screen.getByPlaceholderText('Cole um numero de processo sincronizado no SUAP.'), {
      target: { value: '23035.000123/2026-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar Termo de Referencia/i }));

    expect(await screen.findByText('Questionario do Termo de Referencia')).toBeInTheDocument();
    expect(mockedReferenceTermsService.generateDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Pular/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar geracao/i }));

    await waitFor(() => {
      expect(mockedReferenceTermsService.generateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          questionnaireAnswers: [
            expect.objectContaining({
              questionId: 'field-1-inserir-objeto',
              skipped: true,
            }),
          ],
        }),
      );
    });
  });
});
