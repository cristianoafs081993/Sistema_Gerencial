import { supabase } from '@/lib/supabase';
import type {
  PriceResearchCandidate,
  PriceResearchCatalogType,
  PriceResearchItem,
  PriceResearchMethod,
  PriceResearchReportData,
  PriceResearchReportServer,
  PriceResearchSearchFilters,
} from '@/lib/priceResearch';

export type PriceResearchSearchItem = Pick<
  PriceResearchItem,
  | 'localId'
  | 'itemNumber'
  | 'description'
  | 'catalogType'
  | 'catalogCode'
  | 'quantity'
  | 'unit'
  | 'targetCapacity'
  | 'targetMeasureUnit'
>;

export type PriceResearchSearchResult = {
  localId: string;
  candidates: PriceResearchCandidate[];
  error?: string;
};

export type PriceResearchRecord = {
  id: string;
  title: string;
  processNumber: string;
  objectDescription: string;
  responsibleName: string;
  institutionName: string;
  institutionUnit: string;
  institutionDetails: string;
  institutionLogo: string;
  reportServers: PriceResearchReportServer[];
  researchDate: string;
  method: PriceResearchMethod;
  methodologyJustification: string;
  notes: string;
  sourceFile: string;
  status: 'draft' | 'review' | 'completed';
  items: PriceResearchItem[];
  searchFilters: PriceResearchSearchFilters;
  createdAt: string;
  updatedAt: string;
};

export type PriceResearchValidationResult = {
  found: boolean;
  isValid: boolean;
  expectedHash?: string;
  providedHash?: string;
  error?: string;
  research?: {
    id: string;
    processNumber: string;
    objectDescription: string;
    responsibleName: string;
    institutionName: string;
    institutionUnit: string;
    researchDate: string;
    status: PriceResearchRecord['status'];
    updatedAt: string;
    itemsCount: number;
  };
};

type DbResearchRow = {
  id: string;
  title: string;
  process_number: string | null;
  object_description: string;
  responsible_name: string;
  institution_name: string | null;
  institution_unit: string | null;
  institution_details: string | null;
  institution_logo: string | null;
  report_servers: PriceResearchReportServer[] | null;
  research_date: string;
  calculation_method: PriceResearchMethod;
  methodology_justification: string | null;
  notes: string | null;
  source_file: string | null;
  search_filters: PriceResearchSearchFilters | null;
  status: PriceResearchRecord['status'];
  created_at: string;
  updated_at: string;
};

type DbResearchItemRow = {
  id: string;
  research_id: string;
  local_id: string;
  item_number: string;
  description: string;
  catalog_type: PriceResearchCatalogType;
  catalog_code: string;
  quantity: number;
  unit: string;
  target_capacity: number | null;
  target_measure_unit: string | null;
  reference_unit_cost: number | null;
  candidates: PriceResearchCandidate[] | null;
  sort_order: number;
};

const RESEARCH_SELECT = [
  'id',
  'title',
  'process_number',
  'object_description',
  'responsible_name',
  'institution_name',
  'institution_unit',
  'institution_details',
  'institution_logo',
  'report_servers',
  'research_date',
  'calculation_method',
  'methodology_justification',
  'notes',
  'source_file',
  'search_filters',
  'status',
  'created_at',
  'updated_at',
].join(',');

function mapItemRow(row: DbResearchItemRow): PriceResearchItem {
  return {
    localId: row.local_id,
    itemNumber: row.item_number,
    description: row.description,
    catalogType: row.catalog_type,
    catalogCode: row.catalog_code,
    quantity: Number(row.quantity),
    unit: row.unit,
    targetCapacity: row.target_capacity === null ? null : Number(row.target_capacity),
    targetMeasureUnit: row.target_measure_unit,
    referenceUnitCost: row.reference_unit_cost === null ? null : Number(row.reference_unit_cost),
    candidates: Array.isArray(row.candidates) ? row.candidates : [],
    searchStatus: 'success',
    catalogMatchStatus: 'idle',
    catalogSuggestions: [],
  };
}

function mapResearchRow(row: DbResearchRow, items: PriceResearchItem[] = []): PriceResearchRecord {
  return {
    id: row.id,
    title: row.title,
    processNumber: row.process_number || '',
    objectDescription: row.object_description,
    responsibleName: row.responsible_name,
    institutionName: row.institution_name || '',
    institutionUnit: row.institution_unit || '',
    institutionDetails: row.institution_details || '',
    institutionLogo: row.institution_logo || '',
    reportServers: Array.isArray(row.report_servers) ? row.report_servers : [],
    researchDate: row.research_date,
    method: row.calculation_method,
    methodologyJustification: row.methodology_justification || '',
    notes: row.notes || '',
    sourceFile: row.source_file || '',
    status: row.status,
    items,
    searchFilters: row.search_filters && typeof row.search_filters === 'object' ? row.search_filters : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizePriceResearchFunctionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|fetch failed|networkerror|cors/i.test(message)) {
    return new Error('Não foi possível acessar a função de pesquisa de preços. Confirme o deploy no Supabase.');
  }
  return error instanceof Error ? error : new Error(message);
}

export const priceResearchService = {
  async search(items: PriceResearchSearchItem[], filters: PriceResearchSearchFilters = {}): Promise<PriceResearchSearchResult[]> {
    const { data, error } = await supabase.functions.invoke('pesquisar-precos', {
      body: { items, limit: 100, filters },
    });

    if (error) throw normalizePriceResearchFunctionError(error);
    const response = data as { results?: PriceResearchSearchResult[]; error?: string };
    if (response.error) throw new Error(response.error);
    return response.results ?? [];
  },

  async listRecent(): Promise<PriceResearchRecord[]> {
    const { data, error } = await supabase
      .from('price_researches')
      .select(RESEARCH_SELECT)
      .order('updated_at', { ascending: false })
      .limit(12);

    if (error) throw error;
    return (data ?? []).map((row) => mapResearchRow(row as DbResearchRow));
  },

  async getById(id: string): Promise<PriceResearchRecord | null> {
    const [{ data: research, error: researchError }, { data: items, error: itemsError }] = await Promise.all([
      supabase.from('price_researches').select(RESEARCH_SELECT).eq('id', id).maybeSingle(),
      supabase.from('price_research_items').select('*').eq('research_id', id).order('sort_order'),
    ]);

    if (researchError) throw researchError;
    if (itemsError) throw itemsError;
    if (!research) return null;
    return mapResearchRow(
      research as DbResearchRow,
      (items ?? []).map((row) => mapItemRow(row as DbResearchItemRow)),
    );
  },

  async validateAuthentication(id: string, auth: string): Promise<PriceResearchValidationResult> {
    const { data, error } = await supabase.functions.invoke('validar-pesquisa-precos', {
      body: { id, auth },
    });

    if (error) throw error;
    const result = data as PriceResearchValidationResult;
    if (result?.error && !result.found) return result;
    return result;
  },

  async save(
    data: PriceResearchReportData,
    options: { id?: string; status?: PriceResearchRecord['status']; orgId?: string } = {},
  ) {
    const payload: Record<string, any> = {
      title: data.title || 'Pesquisa de preços',
      process_number: data.processNumber || null,
      object_description: data.objectDescription,
      responsible_name: data.responsibleName,
      institution_name: data.institutionName || null,
      institution_unit: data.institutionUnit || null,
      institution_details: data.institutionDetails || null,
      institution_logo: data.institutionLogo || null,
      report_servers: data.reportServers ?? [],
      research_date: data.researchDate,
      calculation_method: data.method,
      methodology_justification: data.methodologyJustification || null,
      notes: data.notes || null,
      source_file: data.sourceFile || null,
      search_filters: data.searchFilters ?? {},
      status: options.status ?? 'review',
      updated_at: new Date().toISOString(),
    };

    if (options.orgId) {
      payload.org_id = options.orgId;
    }

    let researchId = options.id;
    if (researchId) {
      const { error } = await supabase.from('price_researches').update(payload).eq('id', researchId);
      if (error) throw error;
      const { error: deleteError } = await supabase
        .from('price_research_items')
        .delete()
        .eq('research_id', researchId);
      if (deleteError) throw deleteError;
    } else {
      const { data: inserted, error } = await supabase
        .from('price_researches')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      researchId = String(inserted.id);
    }

    const itemRows = data.items.map((item, index) => ({
      research_id: researchId,
      local_id: item.localId,
      item_number: item.itemNumber,
      description: item.description,
      catalog_type: item.catalogType,
      catalog_code: item.catalogCode,
      quantity: item.quantity,
      unit: item.unit,
      target_capacity: item.targetCapacity,
      target_measure_unit: item.targetMeasureUnit,
      reference_unit_cost: item.referenceUnitCost,
      candidates: item.candidates,
      sort_order: index,
    }));

    if (itemRows.length > 0) {
      const { error } = await supabase.from('price_research_items').insert(itemRows);
      if (error) throw error;
    }

    return researchId;
  },

  async delete(id: string): Promise<void> {
    const { error: itemsError } = await supabase
      .from('price_research_items')
      .delete()
      .eq('research_id', id);
    if (itemsError) throw itemsError;

    const { error: researchError } = await supabase
      .from('price_researches')
      .delete()
      .eq('id', id);
    if (researchError) throw researchError;
  },
};
