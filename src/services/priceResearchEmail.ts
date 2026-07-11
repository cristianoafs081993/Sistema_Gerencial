import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuotationModality = 'direct' | 'express' | 'batch' | 'custom' | 'manual';

export const MODALITY_LABELS: Record<QuotationModality, string> = {
  direct: 'Cotação Segmentada (Direta)',
  express: 'Cotação Urgente (Expressa)',
  batch: 'Cotação em Lote',
  custom: 'Mensagem Customizada (Personalizada)',
  manual: 'Envio Avulso (Por E-mail)',
};

export const MODALITY_DESCRIPTIONS: Record<QuotationModality, string> = {
  direct: 'Envia a cada fornecedor apenas os itens específicos que ele comercializa (candidatos mapeados).',
  express: 'Disparo rápido com prazo curto de resposta automática e layout simplificado.',
  batch: 'Dispara a lista completa de todos os itens da pesquisa para todos os fornecedores de uma só vez.',
  custom: 'Permite que você altere o texto e o assunto individualmente para cada empresa antes de enviar.',
  manual: 'Permite cotar digitando qualquer e-mail na hora, sem necessidade de cadastro ou vínculo prévio.',
};

export type Supplier = {
  id: string;
  name: string;
  document?: string;
  email: string;
  phone?: string;
  contactName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  city?: string;
  uf?: string;
  statusRegularidade?: string;
};

// Kept for backward compatibility with existing dialog fields
export type PriceResearchSupplier = Supplier & {
  researchId: string;
};

export type PriceResearchEmailDispatch = {
  id: string;
  researchId: string;
  supplierId: string | null;
  modality: QuotationModality;
  recipientEmail: string;
  recipientName: string | null;
  subject: string | null;
  status: 'sent' | 'failed' | 'cancelled';
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type SendQuotationPayload = {
  researchId: string;
  modality: QuotationModality;
  recipients: Array<{
    supplierId?: string;
    name: string;
    email: string;
    customMessage?: string;
    items?: Array<{
      itemNumber: string;
      description: string;
      unit: string;
      quantity: number;
    }>;
  }>;
  items: Array<{
    itemNumber: string;
    description: string;
    unit: string;
    quantity: number;
  }>;
  objectDescription: string;
  processNumber?: string;
  responsibleName: string;
  deadlineDate?: string;
  deadlineBusinessDays?: number;
  additionalMessage?: string;
  replyTo?: string;
  agencyName?: string;
  agencySub?: string;
};

export type SendQuotationResult = {
  results: Array<{
    email: string;
    name: string;
    status: 'sent' | 'failed';
    errorMessage?: string;
    sentAt?: string;
  }>;
  summary: { sent: number; failed: number };
};

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

type DbSupplierRow = {
  id: string;
  name: string;
  document: string | null;
  email: string;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  city?: string | null;
  uf?: string | null;
  status_regularidade?: string | null;
};

type DbDispatchRow = {
  id: string;
  research_id: string;
  supplier_id: string | null;
  modality: QuotationModality;
  recipient_email: string;
  recipient_name: string | null;
  subject: string | null;
  status: 'sent' | 'failed' | 'cancelled';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

function mapSupplierRow(row: DbSupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    document: row.document ?? undefined,
    email: row.email,
    phone: row.phone ?? undefined,
    contactName: row.contact_name ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    city: row.city ?? undefined,
    uf: row.uf ?? undefined,
    statusRegularidade: row.status_regularidade ?? undefined,
  };
}

function mapDispatchRow(row: DbDispatchRow): PriceResearchEmailDispatch {
  return {
    id: row.id,
    researchId: row.research_id,
    supplierId: row.supplier_id,
    modality: row.modality,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    subject: row.subject,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const priceResearchEmailService = {
  // ------------------------------------------------------------------
  // Send quotation emails via Edge Function
  // ------------------------------------------------------------------
  async sendQuotation(payload: SendQuotationPayload): Promise<SendQuotationResult> {
    const { data, error } = await supabase.functions.invoke('disparar-cotacao-email', {
      body: payload,
    });
    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/failed to fetch|networkerror|cors/i.test(message)) {
        throw new Error(
          'Não foi possível acessar a função de envio. Confirme o deploy no Supabase.',
        );
      }
      throw new Error(message);
    }
    const response = data as { error?: string } & SendQuotationResult;
    if (response.error) throw new Error(response.error);
    return response;
  },

  // ------------------------------------------------------------------
  // Global Suppliers CRUD
  // ------------------------------------------------------------------
  async listGlobalSuppliers(): Promise<Supplier[]> {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => mapSupplierRow(r as DbSupplierRow));
  },

  async searchGlobalSuppliers(query: string): Promise<Supplier[]> {
    if (!query.trim()) return [];
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .or(`name.ilike.%${query}%,document.ilike.%${query}%`)
      .limit(10);
    if (error) throw error;
    return (data ?? []).map((r) => mapSupplierRow(r as DbSupplierRow));
  },

  async saveGlobalSupplier(
    supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<Supplier> {
    const payload = {
      name: supplier.name,
      document: supplier.document || null,
      email: supplier.email,
      phone: supplier.phone || null,
      contact_name: supplier.contactName || null,
      notes: supplier.notes || null,
      city: supplier.city || null,
      uf: supplier.uf || null,
      status_regularidade: supplier.statusRegularidade || null,
    };
    if (id) {
      const { data, error } = await supabase
        .from('suppliers')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapSupplierRow(data as DbSupplierRow);
    } else {
      const { data, error } = await supabase
        .from('suppliers')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return mapSupplierRow(data as DbSupplierRow);
    }
  },

  async deleteGlobalSupplier(id: string): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
  },

  // ------------------------------------------------------------------
  // Research Linked Suppliers
  // ------------------------------------------------------------------
  async listSuppliers(researchId: string): Promise<PriceResearchSupplier[]> {
    const { data, error } = await supabase
      .from('price_research_suppliers')
      .select('research_id, suppliers(*)')
      .eq('research_id', researchId);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      ...mapSupplierRow(r.suppliers as DbSupplierRow),
      researchId: r.research_id,
    }));
  },

  async saveSupplier(
    researchId: string,
    supplierData: Omit<PriceResearchSupplier, 'id' | 'researchId' | 'createdAt' | 'updatedAt'>,
    id?: string,
  ): Promise<PriceResearchSupplier> {
    // 1. Create/Update global supplier record
    const globalSupplier = await this.saveGlobalSupplier(supplierData, id);

    // 2. Link global supplier to research if it doesn't already exist
    const { data: existingLink, error: checkError } = await supabase
      .from('price_research_suppliers')
      .select('*')
      .eq('research_id', researchId)
      .eq('supplier_id', globalSupplier.id)
      .maybeSingle();

    if (checkError) throw checkError;

    if (!existingLink) {
      const { error: linkError } = await supabase
        .from('price_research_suppliers')
        .insert({
          research_id: researchId,
          supplier_id: globalSupplier.id,
        });
      if (linkError) throw linkError;
    }

    return {
      ...globalSupplier,
      researchId,
    };
  },

  async linkSupplierToResearch(researchId: string, supplierId: string): Promise<void> {
    const { error } = await supabase
      .from('price_research_suppliers')
      .insert({
        research_id: researchId,
        supplier_id: supplierId,
      });
    if (error && !error.message.includes('duplicate key')) throw error;
  },

  async deleteSupplier(researchId: string, supplierId: string): Promise<void> {
    const { error } = await supabase
      .from('price_research_suppliers')
      .delete()
      .eq('research_id', researchId)
      .eq('supplier_id', supplierId);
    if (error) throw error;
  },

  // ------------------------------------------------------------------
  // Dispatch history
  // ------------------------------------------------------------------
  async listDispatches(researchId: string): Promise<PriceResearchEmailDispatch[]> {
    const { data, error } = await supabase
      .from('price_research_email_dispatches')
      .select('id,research_id,supplier_id,modality,recipient_email,recipient_name,subject,status,error_message,sent_at,created_at')
      .eq('research_id', researchId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => mapDispatchRow(r as DbDispatchRow));
  },

  async countDispatches(researchId: string): Promise<number> {
    const { count, error } = await supabase
      .from('price_research_email_dispatches')
      .select('id', { count: 'exact', head: true })
      .eq('research_id', researchId)
      .eq('status', 'sent');
    if (error) return 0;
    return count ?? 0;
  },
};
