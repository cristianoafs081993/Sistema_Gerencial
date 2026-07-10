import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  priceResearchEmailService,
  type SendQuotationPayload,
} from '@/services/priceResearchEmail';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RESEARCH_ID = 'test-research-uuid';

const SAMPLE_PAYLOAD: SendQuotationPayload = {
  researchId: RESEARCH_ID,
  modality: 'batch',
  recipients: [
    { name: 'Papelaria Central', email: 'contato@papelaria.com.br' },
    { name: 'Office Store Ltda', email: 'vendas@officestore.com.br' },
  ],
  items: [
    { itemNumber: '01', description: 'Resma de papel A4 75g/m²', unit: 'Resma', quantity: 50 },
    { itemNumber: '02', description: 'Caneta esferográfica azul', unit: 'Caixa', quantity: 5 },
  ],
  objectDescription: 'Aquisição de material de escritório',
  processNumber: '23035.000001/2026-11',
  responsibleName: 'João da Silva',
  deadlineBusinessDays: 3,
};

// ---------------------------------------------------------------------------
// sendQuotation
// ---------------------------------------------------------------------------

describe('priceResearchEmailService.sendQuotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should invoke the edge function with the correct payload', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        results: [
          { email: 'contato@papelaria.com.br', name: 'Papelaria Central', status: 'sent', sentAt: new Date().toISOString() },
          { email: 'vendas@officestore.com.br', name: 'Office Store Ltda', status: 'sent', sentAt: new Date().toISOString() },
        ],
        summary: { sent: 2, failed: 0 },
      },
      error: null,
    });

    const result = await priceResearchEmailService.sendQuotation(SAMPLE_PAYLOAD);

    expect(mockInvoke).toHaveBeenCalledWith('disparar-cotacao-email', {
      body: SAMPLE_PAYLOAD,
    });
    expect(result.summary.sent).toBe(2);
    expect(result.summary.failed).toBe(0);
    expect(result.results).toHaveLength(2);
  });

  it('should throw a user-friendly error when the edge function is unreachable', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Failed to fetch'),
    });

    await expect(priceResearchEmailService.sendQuotation(SAMPLE_PAYLOAD)).rejects.toThrow(
      /deploy no Supabase/i,
    );
  });

  it('should throw the error returned in the response body', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'researchId é obrigatório.' },
      error: null,
    });

    await expect(
      priceResearchEmailService.sendQuotation({ ...SAMPLE_PAYLOAD, researchId: '' }),
    ).rejects.toThrow('researchId é obrigatório.');
  });
});

// ---------------------------------------------------------------------------
// listSuppliers (linked to a research)
// ---------------------------------------------------------------------------

describe('priceResearchEmailService.listSuppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query joined tables and map rows to linked PriceResearchSupplier objects', async () => {
    const now = new Date().toISOString();
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({
      data: [
        {
          research_id: RESEARCH_ID,
          suppliers: {
            id: 'sup-1',
            name: 'Papelaria Central',
            document: '00.000.000/0001-01',
            email: 'contato@papelaria.com.br',
            phone: null,
            contact_name: null,
            notes: null,
            created_at: now,
            updated_at: now,
          }
        },
      ],
      error: null,
    });

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });

    const result = await priceResearchEmailService.listSuppliers(RESEARCH_ID);

    expect(mockFrom).toHaveBeenCalledWith('price_research_suppliers');
    expect(mockSelect).toHaveBeenCalledWith('research_id, suppliers(*)');
    expect(mockEq).toHaveBeenCalledWith('research_id', RESEARCH_ID);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Papelaria Central');
    expect(result[0].email).toBe('contato@papelaria.com.br');
    expect(result[0].researchId).toBe(RESEARCH_ID);
  });

  it('should return empty array on empty result', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockResolvedValue({ data: null, error: null });

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });

    const result = await priceResearchEmailService.listSuppliers(RESEARCH_ID);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// searchGlobalSuppliers
// ---------------------------------------------------------------------------

describe('priceResearchEmailService.searchGlobalSuppliers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query the suppliers table with ilike or conditions', async () => {
    const now = new Date().toISOString();
    const mockSelect = vi.fn().mockReturnThis();
    const mockOr = vi.fn().mockReturnThis();
    const mockLimit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'sup-1',
          name: 'Papelaria Central',
          document: '00.000.000/0001-01',
          email: 'contato@papelaria.com.br',
          phone: null,
          contact_name: null,
          notes: null,
          created_at: now,
          updated_at: now,
        },
      ],
      error: null,
    });

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ or: mockOr });
    mockOr.mockReturnValue({ limit: mockLimit });

    const result = await priceResearchEmailService.searchGlobalSuppliers('Papelaria');

    expect(mockFrom).toHaveBeenCalledWith('suppliers');
    expect(mockOr).toHaveBeenCalledWith('name.ilike.%Papelaria%,document.ilike.%Papelaria%');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Papelaria Central');
  });

  it('should return empty array directly for empty search query', async () => {
    const result = await priceResearchEmailService.searchGlobalSuppliers('');
    expect(result).toHaveLength(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// listDispatches
// ---------------------------------------------------------------------------

describe('priceResearchEmailService.listDispatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should map DB rows to PriceResearchEmailDispatch objects', async () => {
    const now = new Date().toISOString();
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'disp-1',
          research_id: RESEARCH_ID,
          supplier_id: 'sup-1',
          modality: 'batch',
          recipient_email: 'contato@papelaria.com.br',
          recipient_name: 'Papelaria Central',
          subject: 'Solicitação de Cotação — IFRN',
          status: 'sent',
          error_message: null,
          sent_at: now,
          created_at: now,
        },
      ],
      error: null,
    });

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ order: mockOrder });

    const result = await priceResearchEmailService.listDispatches(RESEARCH_ID);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('sent');
    expect(result[0].modality).toBe('batch');
    expect(result[0].recipientEmail).toBe('contato@papelaria.com.br');
  });
});
