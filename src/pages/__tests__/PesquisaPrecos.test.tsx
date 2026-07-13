import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PesquisaPrecos from '@/pages/PesquisaPrecos';
import { findCatalogSuggestions } from '@/lib/priceCatalogClient';
import { parsePriceResearchFile } from '@/lib/priceResearch';
import { priceResearchService } from '@/services/priceResearch';
import { priceResearchEmailService } from '@/services/priceResearchEmail';
import { toast } from 'sonner';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  },
}));

vi.mock('@/components/HeaderParts', () => ({
  HeaderActions: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  HeaderSubtitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    userOrg: { id: 'ifrn-cn', slug: 'ifrn-cn', name: 'Campus Currais Novos' },
    session: { user: { id: 'user-1' } },
  }),
}));

vi.mock('@/lib/priceResearch', async () => {
  const actual = await vi.importActual<typeof import('@/lib/priceResearch')>('@/lib/priceResearch');
  return {
    ...actual,
    parsePriceResearchFile: vi.fn(),
    createPriceResearchTemplate: vi.fn(),
    exportPriceResearchWorkbook: vi.fn(),
  };
});

vi.mock('@/services/priceResearch', () => ({
  priceResearchService: {
    search: vi.fn(),
    listRecent: vi.fn(),
    getById: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('@/services/priceResearchEmail', () => ({
  MODALITY_LABELS: {
    direct: 'Cotacao Segmentada (Direta)',
    express: 'Cotacao Urgente (Expressa)',
    batch: 'Cotacao em Lote',
    custom: 'Mensagem Customizada (Personalizada)',
    manual: 'Envio Avulso (Por E-mail)',
  },
  MODALITY_DESCRIPTIONS: {
    direct: 'Envia a cada fornecedor apenas os itens especificos que ele comercializa.',
    express: 'Disparo rapido com prazo curto de resposta.',
    batch: 'Dispara a lista completa para todos os fornecedores.',
    custom: 'Permite alterar o texto e o assunto individualmente.',
    manual: 'Permite cotar digitando qualquer e-mail na hora.',
  },
  priceResearchEmailService: {
    listSuppliers: vi.fn(),
    listDispatches: vi.fn(),
    searchGlobalSuppliers: vi.fn(),
    saveSupplier: vi.fn(),
    linkSupplierToResearch: vi.fn(),
    deleteSupplier: vi.fn(),
    sendQuotation: vi.fn(),
  },
}));

vi.mock('@/lib/priceCatalogClient', () => ({
  findCatalogSuggestions: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockedParser = vi.mocked(parsePriceResearchFile);
const mockedService = vi.mocked(priceResearchService);
const mockedEmailService = vi.mocked(priceResearchEmailService);
const mockedCatalogMatcher = vi.mocked(findCatalogSuggestions);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const importedItem = {
  localId: 'item-1',
  itemNumber: '1',
  description: 'Café torrado e moído, pacote de 500 g',
  catalogType: 'material' as const,
  catalogCode: '606523',
  quantity: 100,
  unit: 'PCT',
  targetCapacity: 500,
  targetMeasureUnit: 'G',
  referenceUnitCost: null,
  candidates: [],
  searchStatus: 'idle' as const,
};

const candidate = {
  id: 'comprasgov:1',
  sourceType: 'compras_gov_precos' as const,
  sourceLabel: 'Compras.gov.br - Pesquisa de Preços',
  sourceUrl: 'https://dadosabertos.compras.gov.br/precos',
  pncpSearchUrl: 'https://pncp.gov.br/app/editais?q=1',
  purchaseId: '15836606000012026',
  purchaseItemId: '1',
  purchaseDate: '2026-05-01',
  resultDate: '2026-05-02',
  supplierDocument: '00000000000100',
  supplierName: 'Fornecedor',
  agencyCode: '158366',
  agencyName: 'IFRN',
  state: 'RN',
  municipality: 'Currais Novos',
  description: 'Café torrado e moído',
  detailedDescription: null,
  brand: 'Marca',
  quantity: 100,
  originalUnitPrice: 20,
  comparableUnitPrice: 20,
  originalUnitLabel: 'PCT 500 G',
  unitCompatible: true,
  aiScore: 92,
  aiReason: 'Descrição e unidade compatíveis.',
  selected: true,
  exclusionReason: '',
  rawData: {},
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <PesquisaPrecos />
    </QueryClientProvider>,
  );
  const startBtn = screen.queryByRole('button', { name: /Iniciar Nova Pesquisa/i });
  if (startBtn) {
    fireEvent.click(startBtn);
  }
  return renderResult;
}

describe('PesquisaPrecos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.listRecent.mockResolvedValue([]);
    mockedService.search.mockResolvedValue([
      { localId: 'item-1', candidates: [candidate] },
    ]);
    mockedService.save.mockResolvedValue('research-1');
    mockedEmailService.listSuppliers.mockResolvedValue([]);
    mockedEmailService.listDispatches.mockResolvedValue([
      {
        id: 'dispatch-sent',
        researchId: 'research-1',
        supplierId: 'supplier-1',
        modality: 'batch',
        recipientEmail: 'fornecedor@example.com',
        recipientName: 'Fornecedor',
        subject: 'Solicitacao de cotacao',
        status: 'sent',
        errorMessage: null,
        sentAt: '2026-07-10T10:00:00Z',
        createdAt: '2026-07-10T10:00:00Z',
      },
      {
        id: 'dispatch-failed',
        researchId: 'research-1',
        supplierId: 'supplier-2',
        modality: 'batch',
        recipientEmail: 'falha@example.com',
        recipientName: 'Fornecedor com falha',
        subject: 'Solicitacao de cotacao',
        status: 'failed',
        errorMessage: 'Erro de envio',
        sentAt: null,
        createdAt: '2026-07-10T10:01:00Z',
      },
    ]);
    mockedEmailService.searchGlobalSuppliers.mockResolvedValue([]);
    mockedEmailService.sendQuotation.mockResolvedValue({ results: [], summary: { sent: 0, failed: 0 } });
    mockedParser.mockResolvedValue([importedItem]);
    mockedCatalogMatcher.mockResolvedValue([]);
  });

  it('importa a planilha e pesquisa até 15 referências oficiais', async () => {
    const { container } = renderPage();
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    expect((await screen.findAllByText('Café torrado e moído, pacote de 500 g'))[0]).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedService.search).toHaveBeenCalledWith([
        expect.objectContaining({ catalogCode: '606523', catalogType: 'material' }),
      ]);
    });
    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));
    expect(await screen.findByText('Fornecedor')).toBeInTheDocument();
    expect(screen.queryByText(/unidade e quantidade compat/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/descri..o e unidade compat/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Item 1 de 1')).not.toBeInTheDocument();
    expect(screen.getByTitle(importedItem.description)).toHaveTextContent(importedItem.description);
    expect(screen.queryByRole('button', { name: /Voltar para a Lista de Itens/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Item anterior/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ximo item/i })).not.toBeInTheDocument();
    expect(screen.getAllByText('R$ 20,00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Métodos de cálculo/i)).toBeInTheDocument();
    expect(screen.getByText(/Dispersão da amostra/i)).toBeInTheDocument();
    expect(screen.getByText(/Coeficiente de variação/i)).toBeInTheDocument();
    expect(screen.getByText(/Média ponderada/i)).toBeInTheDocument();
    expect(screen.getByText(/Média saneada/i)).toBeInTheDocument();
    expect(screen.getByText(/Excluídos/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Itens/i }));
    expect(await screen.findByRole('button', { name: /Ver Cotações/i })).toBeInTheDocument();
  }, 15000);

  it('mostra skeleton contextual enquanto busca cotações e não antecipa o estado vazio', async () => {
    const search = createDeferred<Array<{ localId: string; candidates: typeof candidate[] }>>();
    mockedService.search.mockReturnValueOnce(search.promise);
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));

    expect(await screen.findByText('Buscando cotações oficiais...')).toBeInTheDocument();
    expect(screen.getAllByTestId('curation-metric-skeleton')).toHaveLength(3);
    expect(screen.queryByText('Nenhuma cotação do PNCP localizada para este item.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar XLSX/i })).toBeDisabled();

    await act(async () => {
      search.resolve([{ localId: 'item-1', candidates: [candidate] }]);
      await search.promise;
    });

    expect(await screen.findByText('Fornecedor')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Buscando cotações oficiais...')).not.toBeInTheDocument());
  });

  it('mostra skeleton nas colunas de cotações e preço na tabela de itens enquanto busca cotações', async () => {
    const search = createDeferred<Array<{ localId: string; candidates: typeof candidate[] }>>();
    mockedService.search.mockReturnValueOnce(search.promise);
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    // Devemos ver o skeleton das colunas na tabela de itens
    expect(await screen.findByTestId('item-quotes-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('item-price-skeleton')).toBeInTheDocument();

    await act(async () => {
      search.resolve([{ localId: 'item-1', candidates: [candidate] }]);
      await search.promise;
    });

    // Skeletons devem sumir e mostrar as cotações/preços reais
    await waitFor(() => {
      expect(screen.queryByTestId('item-quotes-skeleton')).not.toBeInTheDocument();
    });
    expect(screen.getByText('1 cotações')).toBeInTheDocument();
    expect(screen.getByText('R$ 20,00')).toBeInTheDocument();
  });

  it('mostra o estado vazio somente depois que a busca termina sem cotações', async () => {
    mockedService.search.mockResolvedValueOnce([{ localId: 'item-1', candidates: [] }]);
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    await waitFor(() => expect(mockedService.search).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));

    expect(await screen.findByText('Nenhuma cotação do PNCP localizada para este item.')).toBeInTheDocument();
    expect(screen.queryByText('Buscando cotações oficiais...')).not.toBeInTheDocument();
  });

  it('mostra erro inline e permite tentar novamente após falha da busca oficial', async () => {
    mockedService.search.mockRejectedValueOnce(new Error('Serviço oficial indisponível.'));
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Serviço oficial indisponível.'));
    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as cotações oficiais.');
    expect(screen.getByText('Serviço oficial indisponível.')).toBeInTheDocument();

    mockedService.search.mockResolvedValueOnce([{ localId: 'item-1', candidates: [candidate] }]);
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));

    expect(await screen.findByText('Fornecedor')).toBeInTheDocument();
    expect(mockedService.search).toHaveBeenCalledTimes(2);
  });

  it('permite selecionar arquivo PDF pesquisável', () => {
    const { container } = renderPage();
    expect(container.querySelector('input[type="file"]')).toHaveAttribute('accept', expect.stringContaining('.pdf'));
  });

  it('ao avançar da identificação para itens, abre a lista de itens em vez das cotações do item selecionado', async () => {
    const { container } = renderPage();

    fireEvent.change(screen.getByLabelText('Observações'), {
      target: { value: 'Entrega em até 30 dias, com frete incluso.' },
    });

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    await screen.findAllByText('Café torrado e moído, pacote de 500 g');
    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));
    expect(await screen.findByText('Fornecedor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /1\. Identificação/i }));
    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));

    expect(await screen.findByRole('button', { name: /Ver Cotações/i })).toBeInTheDocument();
    expect(screen.queryByText('Fornecedor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));
    expect(await screen.findByText('Alertas e conformidade')).toBeInTheDocument();
    expect(screen.getByText(/não integra o relatório exportado/i)).toBeInTheDocument();
    const reportPreview = screen.getByTitle('Prévia completa do relatório de pesquisa de preços');
    const reportHtml = reportPreview.getAttribute('srcdoc') ?? '';
    expect(reportHtml).toContain('Relatorio gerencial consolidado');
    expect(reportHtml).toContain('Curva ABC');
    expect(reportHtml).toContain('Mapa comparativo');
    expect(reportHtml).toContain('Entrega em até 30 dias, com frete incluso.');
    expect(reportHtml).not.toContain('Alertas e conformidade');
    expect(screen.queryByText('Consolidação das Cotações por Item')).not.toBeInTheDocument();
    expect(screen.queryByText('Resumo Consolidado')).not.toBeInTheDocument();
    expect(screen.queryByText('Observações Finais')).not.toBeInTheDocument();
    expect(screen.queryByText('Irregularidades e conformidade')).not.toBeInTheDocument();
    expect(screen.queryByText(/An.lise OK/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nenhum alerta objetivo/i)).not.toBeInTheDocument();
  });

  it('abre o historico de e-mails em modal acionado pelo rodape da solicitacao de cotacao', async () => {
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    await screen.findByRole('button', { name: /Ver Cota..es/i });
    expect(screen.queryByText(/Hist.rico de Disparos de E-mail/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Salvar Rascunho/i }));
    await waitFor(() => expect(mockedService.save).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: /Solicitar Cota..o/i }));
    expect(mockedEmailService.listDispatches).not.toHaveBeenCalled();
    expect(screen.queryByText('1 enviado(s)')).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /Hist.rico de e-mails/i }));

    expect(await screen.findByText('1 enviado(s)')).toBeInTheDocument();
    expect(screen.getByText('1 falha(s)')).toBeInTheDocument();
    expect(mockedEmailService.listDispatches).toHaveBeenCalledWith('research-1');
  });

  it('sugere e permite confirmar CATMAT quando o arquivo nao informa codigo', async () => {
    mockedParser.mockResolvedValue([{ ...importedItem, catalogCode: '' }]);
    mockedCatalogMatcher.mockResolvedValue([
      {
        code: '606523',
        catalogType: 'material',
        description: 'CAFÉ TORRADO E MOÍDO, PACOTE 500 G',
        context: 'ALIMENTOS > CAFÉ',
        score: 96,
        reason: '5 de 5 termos relevantes coincidem. Especificações numéricas coincidem.',
      },
    ]);

    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    fireEvent.click(await screen.findByRole('button', { name: /Configurar Item/i }));

    await waitFor(() => {
      expect(mockedCatalogMatcher).toHaveBeenCalledWith(
        'Café torrado e moído, pacote de 500 g',
        'material',
      );
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Usar este código' }));

    expect(screen.getByDisplayValue('606523')).toBeInTheDocument();
  });

  it('permite excluir um preço e exige justificativa visível', async () => {
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });
    await screen.findAllByText('Café torrado e moído, pacote de 500 g');
    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));
    await screen.findByText('Fornecedor');

    // Clica no checkbox para desconsiderar o preço
    fireEvent.click(screen.getByRole('checkbox', { name: /Usar preço 1/i }));

    // O modal deve aparecer exigindo justificativa
    const textarea = await screen.findByPlaceholderText(/Ex\.: unidade de fornecimento/i);
    fireEvent.change(textarea, { target: { value: 'Justificativa válida com mais de 10 caracteres' } });
    
    // Confirma a exclusão no modal
    fireEvent.click(screen.getByText('Desconsiderar cotação'));

    // Agora, o preço foi desconsiderado e a justificativa inline deve estar visível
    expect(screen.getByLabelText(/Justificativa para desconsiderar 1/i)).toBeInTheDocument();
  });

  it('monta o link correto do PNCP preferindo o ano da data real do candidato em vez de 2030 do purchaseId', async () => {
    const candidateWithMismatchedYear = {
      ...candidate,
      purchaseId: '93153605000522030', // Ano fatiado seria 2030
      purchaseDate: '2026-05-01', // Ano da data real é 2026
      agencyCode: '931536',
      pncpSearchUrl: 'https://pncp.gov.br/app/editais?q=931536%2052%2F2030', // Fallback inicial
    };

    mockedService.search.mockResolvedValue([
      { localId: 'item-1', candidates: [candidateWithMismatchedYear] },
    ]);

    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({
          data: [
            {
              numero_controle_pncp: '51792919000104-1-000052/2026',
              uasg_codigo: '931536',
              numero_compra: '00052',
              ano_compra: 2026,
            },
          ],
          error: null,
        })),
      })),
    } as any);

    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });

    await screen.findAllByText('Café torrado e moído, pacote de 500 g');
    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));
    await screen.findByText('Fornecedor');

    // Verifica que o link do PNCP montado no front-end aponta para o ano correto (2026) e tem o CNPJ resolvido
    const pncpLink = screen.getByRole('link', { name: /pncp/i });
    expect(pncpLink).toHaveAttribute(
      'href',
      'https://pncp.gov.br/app/editais/51792919000104/2026/52',
    );
  });

  it('permite configurar atualização monetária global pelo card de métodos de cálculo', async () => {
    const { container } = renderPage();
    fireEvent.change(screen.getByLabelText(/Data da Pesquisa/i), {
      target: { value: '2026-06-09' },
    });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['xlsx'], 'custos.xlsx')] },
    });
    await screen.findAllByText('Café torrado e moído, pacote de 500 g');
    fireEvent.click(await screen.findByRole('button', { name: /Ver Cotações/i }));
    await screen.findByText('Fornecedor');

    // Verifica que existe o checkbox de reajuste global
    const globalAdjustCheckbox = screen.getByRole('checkbox', { name: /Ativar atualização monetária global/i });
    expect(globalAdjustCheckbox).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Frete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Evidência/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/O reajuste de inflação/i)).not.toBeInTheDocument();

    const sampleSummary = screen.getByText('Amostra');
    const adjustmentTitle = screen.getByText('Ativar atualização monetária global (IN 65/2021)');
    expect(sampleSummary.compareDocumentPosition(adjustmentTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Ativa o reajuste global (abre o modal)
    fireEvent.click(globalAdjustCheckbox);

    // Salva com o valor padrão (IPCA)
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));

    expect(screen.getByRole('columnheader', { name: /Índice de atualização monetária/i })).toBeInTheDocument();
    expect(screen.getByText(/1,\d{4}/)).toBeInTheDocument();
    expect(toast.info).toHaveBeenCalledWith(
      expect.stringContaining(`mês atual (${new Date().toISOString().slice(0, 7)})`),
      { duration: 4000 },
    );
    expect(toast.info).not.toHaveBeenCalledWith(
      expect.stringContaining('2026-06'),
      expect.anything(),
    );

    // Clica no link/botão Configurar para editar a atualização
    const configBtn = screen.getByRole('button', { name: /\(Configurar\)/i });
    expect(configBtn).toBeInTheDocument();
    fireEvent.click(configBtn);

    // O select de índice de reajuste deve aparecer no modal
    const indexSelect = screen.getByLabelText(/Índice ou Método/i);
    expect(indexSelect).toBeInTheDocument();
    expect(indexSelect).toHaveValue('IPCA');

    // Altera para manual
    fireEvent.change(indexSelect, { target: { value: 'manual' } });

    // O input de taxa de reajuste manual deve aparecer
    const manualRateInput = screen.getByPlaceholderText(/Ex: 5.5/i);
    expect(manualRateInput).toBeInTheDocument();
    fireEvent.change(manualRateInput, { target: { value: '10' } });

    // Salva a alteração para fechar o modal
    fireEvent.click(screen.getByRole('button', { name: /Salvar/i }));
  });

  it('permite adicionar itens manualmente na etapa 2, e os reordena sequencialmente ao remover', async () => {
    const { container } = renderPage();

    // Avança para a Etapa 2
    fireEvent.click(screen.getByRole('button', { name: /Avançar/i }));

    // Passo 2: Verifica o botão de adição manual
    const addManualBtn = await screen.findByRole('button', { name: /Adicionar item manualmente/i });
    expect(addManualBtn).toBeInTheDocument();

    // Clica para iniciar manualmente
    fireEvent.click(addManualBtn);

    // O modal de configuração de item deve abrir
    expect(screen.getByText(/Configuração do Item 1/i)).toBeInTheDocument();

    // Altera a descrição do primeiro item
    const descriptionTextarea = screen.getByLabelText(/Descrição Técnico-Comercial do Item/i);
    fireEvent.change(descriptionTextarea, { target: { value: 'Item Manual Teste 1' } });

    // Preenche o código CATMAT/CATSER
    const codeInput = screen.getByPlaceholderText(/Ex: 606523/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });

    // Confirma e volta
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));

    // Aguarda o modal fechar para evitar múltiplos elementos com o mesmo texto
    await waitFor(() => {
      expect(screen.queryByText(/Configuração do Item 1/i)).not.toBeInTheDocument();
    });

    // O item deve estar visível na tabela do Passo 2
    expect(screen.getByText('Item Manual Teste 1')).toBeInTheDocument();

    // Adiciona um segundo item manualmente no Passo 2
    const addAnotherManualBtn = screen.getByRole('button', { name: /Adicionar item manualmente/i });
    fireEvent.click(addAnotherManualBtn);

    // Deve abrir a configuração do Item 2
    expect(screen.getByText(/Configuração do Item 2/i)).toBeInTheDocument();

    // Altera a descrição do segundo item
    const descriptionTextarea2 = screen.getByLabelText(/Descrição Técnico-Comercial do Item/i);
    fireEvent.change(descriptionTextarea2, { target: { value: 'Item Manual Teste 2' } });

    // Preenche o código CATMAT/CATSER
    const codeInput2 = screen.getByPlaceholderText(/Ex: 606523/i);
    fireEvent.change(codeInput2, { target: { value: '654321' } });

    // Confirma e volta
    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));

    // Aguarda o modal fechar
    await waitFor(() => {
      expect(screen.queryByText(/Configuração do Item 2/i)).not.toBeInTheDocument();
    });

    // Ambos devem estar visíveis
    expect(screen.getByText('Item Manual Teste 1')).toBeInTheDocument();
    expect(screen.getByText('Item Manual Teste 2')).toBeInTheDocument();

    // Remove o primeiro item
    const removeButtons = screen.getAllByRole('button', { name: /Remover Item/i });
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);

    // O Item Manual Teste 1 deve ter sumido
    expect(screen.queryByText('Item Manual Teste 1')).not.toBeInTheDocument();
    // O Item Manual Teste 2 deve continuar, e seu número sequencial deve ter atualizado para 1
    expect(screen.getByText('Item Manual Teste 2')).toBeInTheDocument();
    const row = screen.getByText('Item Manual Teste 2').closest('tr');
    expect(row?.querySelector('td')).toHaveTextContent('1'); // O número do item agora é 1
  });
});
