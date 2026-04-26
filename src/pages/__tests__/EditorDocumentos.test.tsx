import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import EditorDocumentos from '@/pages/EditorDocumentos';
import { useData } from '@/contexts/DataContext';
import { preliminaryStudyQuestions } from '@/lib/preliminaryStudyQuestionnaire';
import { contractDraftsService } from '@/services/contractDrafts';
import { preliminaryStudiesService } from '@/services/preliminaryStudies';
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
    suggestQuestionnaireAnswers: vi.fn(),
    generateDraft: vi.fn(),
  },
}));

vi.mock('@/services/preliminaryStudies', () => ({
  preliminaryStudiesService: {
    analyzeProcessPdf: vi.fn(),
    suggestQuestionnaireAnswers: vi.fn(),
    generateQuestionText: vi.fn(),
    generateDraft: vi.fn(),
  },
}));

const mockedUseData = vi.mocked(useData);
const mockedSuapProcessosService = vi.mocked(suapProcessosService);
const mockedContractDraftsService = vi.mocked(contractDraftsService);
const mockedReferenceTermsService = vi.mocked(referenceTermsService);
const mockedPreliminaryStudiesService = vi.mocked(preliminaryStudiesService);

describe('EditorDocumentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
          text: '1.1 O objeto da contratacao e [INSERIR OBJETO], conforme especificacoes constantes neste Termo de Referencia.',
          excerpt: '1.1 O objeto da contratacao e [INSERIR OBJETO], conforme especificacoes constantes neste Termo de Referencia.',
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

    mockedReferenceTermsService.suggestQuestionnaireAnswers.mockResolvedValue({
      status: 'generated',
      suggestions: [],
      warnings: [],
      model: 'gemini-2.5-flash-lite',
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

    mockedPreliminaryStudiesService.analyzeProcessPdf.mockResolvedValue({
      pageCount: 10,
      searchablePageCount: 10,
      snippets: [
        {
          id: 'necessidade-2',
          kind: 'necessidade',
          label: 'Necessidade da contratação',
          pageNumber: 2,
          excerpt: 'Necessidade de manter os servicos de limpeza do campus.',
        },
      ],
      warnings: [],
    });

    mockedPreliminaryStudiesService.suggestQuestionnaireAnswers.mockResolvedValue({
      status: 'generated',
      suggestions: [],
      warnings: [],
      model: 'gemini-2.5-flash-lite',
    });

    mockedPreliminaryStudiesService.generateQuestionText.mockResolvedValue({
      status: 'generated',
      value: 'Texto gerado para a secao do ETP.',
      warnings: [],
      model: 'gemini-2.5-flash-lite',
    });

    mockedPreliminaryStudiesService.generateDraft.mockResolvedValue({
      status: 'generated',
      title: 'Estudo Tecnico Preliminar - Servicos Continuos',
      subtitle: 'Processo 23035.000123/2026-11',
      html: '<h1>ETP gerado</h1>',
      sections: [
        {
          id: 'necessidade',
          title: 'Necessidade da contratação',
          html: '<h2>Necessidade da contratação</h2><p>Manter limpeza.</p>',
        },
      ],
      warnings: [],
      missingRequiredFields: [],
      fields: [],
      model: 'gemini-2.5-flash-lite',
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
    mockedReferenceTermsService.suggestQuestionnaireAnswers.mockResolvedValueOnce({
      status: 'generated',
      suggestions: [
        {
          questionId: 'exclusive-2-bem',
          kind: 'exclusive',
          status: 'suggested',
          selectedOptionId: 'bem-comum',
          justification: 'O ETP descreve bem padronizado disponivel no mercado.',
          sourcePage: 4,
          sourceExcerpt: 'O objeto consiste na aquisicao de bens comuns.',
          confidence: 'high',
        },
      ],
      warnings: [],
      model: 'gemini-2.5-flash-lite',
    });
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
          {
            id: 'exclusive-2-bem',
            kind: 'exclusive',
            title: 'Caracterizacao do bem',
            prompt: 'Escolha a classificacao do bem.',
            blockId: 'block-1',
            blockIndex: 1,
            options: [
              {
                id: 'bem-comum',
                label: 'Bem comum',
                text: 'Os bens objeto desta contratacao sao caracterizados como comuns.',
              },
              {
                id: 'bem-especial',
                label: 'Bem especial',
                text: 'Os bens objeto desta contratacao sao caracterizados como especiais.',
              },
            ],
          },
          {
            id: 'exclusive-3-subcontratacao',
            kind: 'exclusive',
            title: 'Escolha exclusiva',
            prompt: 'Escolha qual clausula deve permanecer ativa neste ponto do Termo de Referencia.',
            blockId: 'block-1',
            blockIndex: 1,
            options: [
              {
                id: 'subcontratacao-vedada',
                label: 'Subcontratacao vedada',
                text: 'O prazo de vigencia da contratacao e de [indicar o prazo] contados do(a) [indicar o termo inicial da vigencia], na forma do artigo 105 da Lei n° 14.133, de 2021.',
              },
              {
                id: 'subcontratacao-parcial',
                label: 'Subcontratacao parcial',
                text: 'O prazo de vigencia da contratacao e de [indicar o prazo, limitado a 5 anos] contados do(a) [indicar o termo inicial da vigencia], prorrogavel por ate 10 anos, na forma dos artigos 106 e 107 da Lei n° 14.133, de 2021.',
              },
            ],
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

    expect(await screen.findByText('Sugestoes da IA para o Termo de Referencia')).toBeInTheDocument();
    expect(screen.getByText(/aquisicao de bens comuns/i)).toBeInTheDocument();
    expect(mockedReferenceTermsService.generateDraft).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Aprovar todas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar para pendencias/i }));
    expect(await screen.findByText('Objeto da contratacao')).toBeInTheDocument();
    expect(screen.getByText(/Campo do modelo:/i)).toBeInTheDocument();
    expect(screen.queryByText(/conforme especificacoes constantes neste Termo de Referencia/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver texto original do TR/i })).toHaveAttribute(
      'title',
      '[INSERIR OBJETO]',
    );
    expect(screen.queryByText(/^Campo$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^1 de 1$/)).not.toBeInTheDocument();
    expect(screen.queryByText('O que preencher agora')).not.toBeInTheDocument();
    expect(screen.queryByText('Questionario do Termo de Referencia')).not.toBeInTheDocument();
    expect(screen.queryByText('Uma questao por vez, com contexto fixo e resposta direta.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pular/i }));
    expect(await screen.findByText('Escolha qual clausula deve permanecer ativa neste ponto do Termo de Referencia.')).toBeInTheDocument();
    expect(screen.getAllByText(/^Escolha exclusiva$/)).toHaveLength(1);
    expect(screen.getByRole('button', {
      name:
        /O prazo de vigencia da contratacao e de \[indicar o prazo\] contados do\(a\) \[indicar o termo inicial da vigencia\]\./i,
    })).toBeInTheDocument();
    expect(screen.queryByText(/na forma do artigo 105 da Lei/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {
      name:
        /O prazo de vigencia da contratacao e de \[indicar o prazo\] contados do\(a\) \[indicar o termo inicial da vigencia\]\./i,
    })).toHaveAttribute(
      'title',
      'O prazo de vigencia da contratacao e de [indicar o prazo] contados do(a) [indicar o termo inicial da vigencia], na forma do artigo 105 da Lei n° 14.133, de 2021.',
    );
    fireEvent.click(screen.getByRole('button', { name: /Pular/i }));
    expect(await screen.findByText('Questionario pronto para geracao')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar geracao/i }));

    await waitFor(() => {
      expect(mockedReferenceTermsService.generateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          questionnaireAnswers: [
            expect.objectContaining({
              questionId: 'field-1-inserir-objeto',
              skipped: true,
            }),
            expect.objectContaining({
              questionId: 'exclusive-2-bem',
              selectedOptionId: 'bem-comum',
              origin: 'ai',
              approved: true,
              skipped: false,
            }),
            expect.objectContaining({
              questionId: 'exclusive-3-subcontratacao',
              skipped: true,
            }),
          ],
        }),
      );
    });
  }, 15000);

  it('permite preencher placeholders da clausula escolhida antes de avancar', async () => {
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
          id: 'block-entrega-unica',
          kind: 'paragraph',
          blockIndex: 1,
          text: 'O prazo de entrega dos bens e de [indicar o prazo] dias, contados do(a) [indicar o termo inicial da vigencia], em remessa unica.',
          excerpt: 'O prazo de entrega dos bens e de [indicar o prazo] dias, contados do(a) [indicar o termo inicial da vigencia], em remessa unica.',
          isInstructional: true,
          hasPlaceholder: true,
        },
        {
          id: 'block-entrega-parcelada',
          kind: 'paragraph',
          blockIndex: 2,
          text: 'As parcelas serao entregues nos seguintes prazos e condicoes.',
          excerpt: 'As parcelas serao entregues nos seguintes prazos e condicoes.',
          isInstructional: true,
          hasPlaceholder: false,
        },
      ],
      questionnaireSchema: {
        version: 1,
        generatedAt: new Date().toISOString(),
        questions: [
          {
            id: 'exclusive-entrega',
            kind: 'exclusive',
            title: 'Escolha exclusiva',
            prompt: 'Escolha qual clausula deve permanecer ativa neste ponto do Termo de Referencia.',
            blockIds: ['block-entrega-unica', 'block-entrega-parcelada'],
            blockIndexes: [1, 2],
            options: [
              {
                id: 'entrega-unica',
                label: 'Entrega unica',
                text: 'O prazo de entrega dos bens e de [indicar o prazo] dias, contados do(a) [indicar o termo inicial da vigencia], em remessa unica.',
                blockId: 'block-entrega-unica',
                blockIndex: 1,
              },
              {
                id: 'entrega-parcelada',
                label: 'Entrega parcelada',
                text: 'As parcelas serao entregues nos seguintes prazos e condicoes.',
                blockId: 'block-entrega-parcelada',
                blockIndex: 2,
              },
            ],
          },
        ],
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedReferenceTermsService.suggestQuestionnaireAnswers.mockResolvedValueOnce({
      status: 'generated',
      suggestions: [],
      warnings: [],
      model: 'gemini-2.5-flash-lite',
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

    expect(await screen.findByText('Escolha qual clausula deve permanecer ativa neste ponto do Termo de Referencia.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {
      name: /O prazo de entrega dos bens e de \[indicar o prazo\] dias, contados do\(a\) \[indicar o termo inicial da vigencia\], em remessa unica\./i,
    }));

    expect(screen.getByText('Prazo e vigencia')).toBeInTheDocument();
    expect(screen.getByText('Termo inicial da vigencia')).toBeInTheDocument();
    expect(mockedReferenceTermsService.generateDraft).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('Ex.: 12 meses, contados da assinatura do contrato.'), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ex.: data da assinatura do contrato.'), {
      target: { value: 'recebimento da nota de empenho' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salvar resposta/i }));

    expect(await screen.findByText('Questionario pronto para geracao')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar geracao/i }));

    await waitFor(() => {
      expect(mockedReferenceTermsService.generateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          questionnaireAnswers: [
            expect.objectContaining({
              questionId: 'exclusive-entrega',
              selectedOptionId: 'entrega-unica',
              optionValues: {
                'option-block-1::0::[indicar o prazo]': '30',
                'option-block-1::0::[indicar o termo inicial da vigencia]': 'recebimento da nota de empenho',
              },
            }),
          ],
        }),
      );
    });
  }, 15000);

  it('mostra escolha inline para estudo tecnico preliminar ou nota tecnica na mesma clausula', async () => {
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
          id: 'block-continuado',
          kind: 'paragraph',
          blockIndex: 1,
          text: 'O fornecimento de bens e enquadrado como continuado tendo em vista que [...], sendo a vigencia plurianual mais vantajosa considerando [...] OU [o Estudo Tecnico Preliminar] OU [os termos da Nota Tecnica].',
          excerpt: 'O fornecimento de bens e enquadrado como continuado tendo em vista que [...], sendo a vigencia plurianual mais vantajosa considerando [...] OU [o Estudo Tecnico Preliminar] OU [os termos da Nota Tecnica].',
          isInstructional: true,
          hasPlaceholder: true,
        },
        {
          id: 'block-alternativo',
          kind: 'paragraph',
          blockIndex: 2,
          text: 'Clausula alternativa secundaria.',
          excerpt: 'Clausula alternativa secundaria.',
          isInstructional: true,
          hasPlaceholder: false,
        },
      ],
      questionnaireSchema: {
        version: 1,
        generatedAt: new Date().toISOString(),
        questions: [
          {
            id: 'exclusive-continuado',
            kind: 'exclusive',
            title: 'Escolha exclusiva',
            prompt: 'Escolha qual clausula deve permanecer ativa neste ponto do Termo de Referencia.',
            blockIds: ['block-continuado', 'block-alternativo'],
            blockIndexes: [1, 2],
            options: [
              {
                id: 'clausula-continuado',
                label: 'Continuado',
                text: 'O fornecimento de bens e enquadrado como continuado tendo em vista que [...], sendo a vigencia plurianual mais vantajosa considerando [...] OU [o Estudo Tecnico Preliminar] OU [os termos da Nota Tecnica].',
                blockId: 'block-continuado',
                blockIndex: 1,
              },
              {
                id: 'clausula-secundaria',
                label: 'Secundaria',
                text: 'Clausula alternativa secundaria.',
                blockId: 'block-alternativo',
                blockIndex: 2,
              },
            ],
          },
        ],
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mockedReferenceTermsService.suggestQuestionnaireAnswers.mockResolvedValueOnce({
      status: 'generated',
      suggestions: [],
      warnings: [],
      model: 'gemini-2.5-flash-lite',
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

    expect(await screen.findByText('Escolha qual clausula deve permanecer ativa neste ponto do Termo de Referencia.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {
      name: /O fornecimento de bens e enquadrado como continuado/i,
    }));

    expect(screen.getByText('Documento de referencia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'o Estudo Tecnico Preliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'os termos da Nota Tecnica' })).toBeInTheDocument();

    const textareas = screen.getAllByRole('textbox');
    fireEvent.change(textareas[textareas.length - 2], {
      target: { value: 'ha necessidade continuada do fornecimento' },
    });
    fireEvent.change(textareas[textareas.length - 1], {
      target: { value: 'ha previsao de consumo permanente' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'o Estudo Tecnico Preliminar' }));
    fireEvent.click(screen.getByRole('button', { name: /Salvar resposta/i }));
    expect(await screen.findByText('Questionario pronto para geracao')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continuar geracao/i }));

    await waitFor(() => {
      expect(mockedReferenceTermsService.generateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          questionnaireAnswers: [
            expect.objectContaining({
              questionId: 'exclusive-continuado',
              selectedOptionId: 'clausula-continuado',
              optionValues: expect.objectContaining({
                'option-block-1::0::[...]': 'ha necessidade continuada do fornecimento',
                'option-block-1::1::[...]': 'ha previsao de consumo permanente',
                'option-block-1::0::[o Estudo Tecnico Preliminar]': 'o Estudo Tecnico Preliminar',
                'option-block-1::1::[os termos da Nota Tecnica]': '',
              }),
            }),
          ],
        }),
      );
    });
  }, 15000);

  it('gera ETP a partir de objeto digitado manualmente', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ETP - Servicos Continuos/i }));
    fireEvent.change(screen.getByPlaceholderText(/descreva o objeto da licitacao/i), {
      target: { value: 'Contratacao de servicos continuos de limpeza predial' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar ETP/i }));

    expect(await screen.findByText('Questionario do ETP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gerar com pendencias/i }));

    await waitFor(() => {
      expect(mockedPreliminaryStudiesService.generateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          manualObject: 'Contratacao de servicos continuos de limpeza predial',
        }),
      );
    });

    expect(await screen.findByText('ETP gerado.')).toBeInTheDocument();
    expect(screen.getByTestId('editor-content')).toHaveTextContent('<h1>ETP gerado</h1>');
  }, 15000);

  it('gera texto de uma secao do ETP com IA mesmo sem digitacao previa', async () => {
    mockedPreliminaryStudiesService.generateDraft.mockClear();
    mockedPreliminaryStudiesService.generateQuestionText.mockResolvedValueOnce({
      status: 'generated',
      value: 'A contratacao e necessaria para manter a limpeza predial de forma continua.',
      warnings: [],
      model: 'gemini-2.5-flash-lite',
    });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ETP - Servicos Continuos/i }));
    fireEvent.change(screen.getByPlaceholderText(/descreva o objeto da licitacao/i), {
      target: { value: 'Contratacao de servicos continuos de limpeza predial' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar ETP/i }));

    expect(await screen.findByText('Questionario do ETP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gerar texto com IA/i }));

    expect(
      await screen.findByDisplayValue('A contratacao e necessaria para manter a limpeza predial de forma continua.'),
    ).toBeInTheDocument();
    expect(mockedPreliminaryStudiesService.generateQuestionText).toHaveBeenCalledWith(
      expect.objectContaining({
        manualObject: 'Contratacao de servicos continuos de limpeza predial',
        question: expect.objectContaining({ id: 'necessidade' }),
        userNotes: '',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: /Salvar resposta/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Gerar com pendencias/i }));

    await waitFor(() => {
      expect(mockedPreliminaryStudiesService.generateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          questionnaireAnswers: expect.arrayContaining([
            expect.objectContaining({
              questionId: 'necessidade',
              value: 'A contratacao e necessaria para manter a limpeza predial de forma continua.',
              origin: 'ai',
              approved: true,
            }),
          ]),
        }),
      );
    });
  }, 15000);

  it('gera ETP com processo e PDF pesquisavel apos aprovar sugestoes', async () => {
    mockedPreliminaryStudiesService.generateDraft.mockClear();
    mockedPreliminaryStudiesService.suggestQuestionnaireAnswers.mockResolvedValueOnce({
      status: 'generated',
      suggestions: preliminaryStudyQuestions.map((question, index) => ({
        questionId: question.id,
        status: 'suggested' as const,
        value: `Resposta ${question.id}`,
        justification: 'Fonte localizada no processo.',
        sourcePage: index + 1,
        sourceExcerpt: `Trecho ${question.id}`,
        confidence: 'high' as const,
      })),
      warnings: [],
      model: 'gemini-2.5-flash-lite',
    });

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ETP - Servicos Continuos/i }));
    fireEvent.change(screen.getByPlaceholderText(/descreva o objeto da licitacao/i), {
      target: { value: '23035.000123/2026-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar ETP/i }));

    expect(await screen.findByText('Sugestoes da IA para o ETP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Aprovar todas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar para pendencias/i }));

    await waitFor(() => {
      expect(mockedPreliminaryStudiesService.generateDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          processo: expect.objectContaining({ numProcesso: '23035.000123/2026-11' }),
          questionnaireAnswers: expect.arrayContaining([
            expect.objectContaining({
              questionId: 'necessidade',
              origin: 'ai',
              approved: true,
            }),
          ]),
        }),
      );
    });
  }, 15000);

  it('cai para questionario manual quando processo nao tem PDF', async () => {
    mockedSuapProcessosService.getAll.mockResolvedValueOnce([
      {
        id: 'proc-sem-pdf',
        suapId: '456',
        url: 'https://suap.local/processo/2',
        status: 'sincronizado',
        numProcesso: '23035.000456/2026-22',
        beneficiario: 'Fornecedor Teste Ltda',
        cpfCnpj: '12345678000190',
        assunto: 'Servico continuado de limpeza sem PDF',
      },
    ] as never);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000456/2026-22')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ETP - Servicos Continuos/i }));
    fireEvent.change(screen.getByPlaceholderText(/descreva o objeto da licitacao/i), {
      target: { value: '23035.000456/2026-22' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar ETP/i }));

    expect(await screen.findByText('Questionario do ETP')).toBeInTheDocument();
    expect(mockedPreliminaryStudiesService.analyzeProcessPdf).not.toHaveBeenCalled();
  }, 15000);

  it('exibe acoes de copiar por secao no ETP gerado', async () => {
    mockedPreliminaryStudiesService.suggestQuestionnaireAnswers.mockResolvedValueOnce({
      status: 'generated',
      suggestions: preliminaryStudyQuestions.map((question, index) => ({
        questionId: question.id,
        status: 'suggested' as const,
        value: `Resposta ${question.id}`,
        justification: 'Fonte localizada no processo.',
        sourcePage: index + 1,
        sourceExcerpt: `Trecho ${question.id}`,
        confidence: 'high' as const,
      })),
      warnings: [],
      model: 'gemini-2.5-flash-lite',
    });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ETP - Servicos Continuos/i }));
    fireEvent.change(screen.getByPlaceholderText(/descreva o objeto da licitacao/i), {
      target: { value: '23035.000123/2026-11' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gerar ETP/i }));

    expect(await screen.findByText('Sugestoes da IA para o ETP')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Aprovar todas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continuar para pendencias/i }));

    expect(await screen.findByRole('button', { name: /Copiar Necessidade da contratação/i })).toBeInTheDocument();
  }, 15000);

  it('bloqueia ETP quando nao ha processo nem objeto', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <EditorDocumentos />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('23035.000123/2026-11')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ETP - Servicos Continuos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Gerar ETP/i }));

    expect(await screen.findByText('Informe um processo sincronizado ou descreva o objeto da licitacao para gerar o ETP.')).toBeInTheDocument();
    expect(mockedPreliminaryStudiesService.generateDraft).not.toHaveBeenCalled();
  });
});
