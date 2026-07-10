import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variavel de ambiente ausente: ${name}`);
  return value;
}

type DbResearch = {
  id: string;
  title: string;
  process_number: string | null;
  object_description: string;
  responsible_name: string;
  institution_name: string | null;
  institution_unit: string | null;
  institution_details: string | null;
  institution_logo: string | null;
  report_servers: unknown[] | null;
  research_date: string;
  calculation_method: 'median' | 'mean' | 'minimum';
  methodology_justification: string | null;
  notes: string | null;
  source_file: string | null;
  status: 'draft' | 'review' | 'completed';
  updated_at: string;
};

type DbResearchItem = {
  local_id: string;
  item_number: string;
  description: string;
  catalog_type: 'material' | 'service';
  catalog_code: string;
  quantity: number | string;
  unit: string;
  target_capacity: number | string | null;
  target_measure_unit: string | null;
  reference_unit_cost: number | string | null;
  candidates: Array<Record<string, unknown>> | null;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) as string;
}

function createStableHash(value: string) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, '0');
}

function numberOrNull(value: number | string | null) {
  return value === null ? null : Number(value);
}

function pickCandidate(candidate: Record<string, unknown>) {
  return {
    id: candidate.id,
    sourceType: candidate.sourceType,
    sourceLabel: candidate.sourceLabel,
    sourceUrl: candidate.sourceUrl,
    purchaseId: candidate.purchaseId,
    purchaseItemId: candidate.purchaseItemId,
    purchaseDate: candidate.purchaseDate,
    resultDate: candidate.resultDate,
    supplierDocument: candidate.supplierDocument,
    supplierName: candidate.supplierName,
    agencyCode: candidate.agencyCode,
    agencyName: candidate.agencyName,
    state: candidate.state,
    municipality: candidate.municipality,
    description: candidate.description,
    quantity: candidate.quantity,
    originalUnitPrice: candidate.originalUnitPrice,
    comparableUnitPrice: candidate.comparableUnitPrice,
    monetaryAdjustedPrice: candidate.monetaryAdjustedPrice,
    originalUnitLabel: candidate.originalUnitLabel,
    unitCompatible: candidate.unitCompatible,
    selected: candidate.selected,
    exclusionReason: candidate.exclusionReason,
  };
}

function buildSnapshot(research: DbResearch, items: DbResearchItem[]) {
  return {
    title: research.title,
    processNumber: research.process_number || '',
    objectDescription: research.object_description,
    responsibleName: research.responsible_name,
    institutionName: research.institution_name || '',
    institutionUnit: research.institution_unit || '',
    institutionDetails: research.institution_details || '',
    institutionLogo: research.institution_logo || '',
    reportServers: Array.isArray(research.report_servers) ? research.report_servers : [],
    researchDate: research.research_date,
    method: research.calculation_method,
    methodologyJustification: research.methodology_justification || '',
    notes: research.notes || '',
    sourceFile: research.source_file || '',
    items: items.map((item) => ({
      localId: item.local_id,
      itemNumber: item.item_number,
      description: item.description,
      catalogType: item.catalog_type,
      catalogCode: item.catalog_code,
      quantity: Number(item.quantity),
      unit: item.unit,
      targetCapacity: numberOrNull(item.target_capacity),
      targetMeasureUnit: item.target_measure_unit,
      referenceUnitCost: numberOrNull(item.reference_unit_cost),
      candidates: Array.isArray(item.candidates) ? item.candidates.map(pickCandidate) : [],
    })),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido.' }, 405);
  }

  try {
    const body = await request.json().catch(() => ({})) as { id?: string; auth?: string };
    const researchId = body.id?.trim();
    const providedHash = body.auth?.trim().toLowerCase();

    if (!researchId || !providedHash) {
      return jsonResponse({ error: 'Identificador da pesquisa e hash sao obrigatorios.' }, 400);
    }

    const serviceClient = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const [{ data: research, error: researchError }, { data: items, error: itemsError }] = await Promise.all([
      serviceClient
        .from('price_researches')
        .select('id,title,process_number,object_description,responsible_name,institution_name,institution_unit,institution_details,institution_logo,report_servers,research_date,calculation_method,methodology_justification,notes,source_file,status,updated_at')
        .eq('id', researchId)
        .maybeSingle(),
      serviceClient
        .from('price_research_items')
        .select('local_id,item_number,description,catalog_type,catalog_code,quantity,unit,target_capacity,target_measure_unit,reference_unit_cost,candidates')
        .eq('research_id', researchId)
        .order('sort_order'),
    ]);

    if (researchError) throw researchError;
    if (itemsError) throw itemsError;
    if (!research) {
      return jsonResponse({ found: false, isValid: false, error: 'Pesquisa de precos nao localizada.' }, 404);
    }

    const typedResearch = research as DbResearch;
    const typedItems = (items ?? []) as DbResearchItem[];
    const snapshotHash = createStableHash(stableStringify(buildSnapshot(typedResearch, typedItems)));

    return jsonResponse({
      found: true,
      isValid: snapshotHash.toLowerCase() === providedHash,
      expectedHash: snapshotHash,
      providedHash,
      research: {
        id: typedResearch.id,
        processNumber: typedResearch.process_number || '',
        objectDescription: typedResearch.object_description,
        responsibleName: typedResearch.responsible_name,
        institutionName: typedResearch.institution_name || '',
        institutionUnit: typedResearch.institution_unit || '',
        researchDate: typedResearch.research_date,
        status: typedResearch.status,
        updatedAt: typedResearch.updated_at,
        itemsCount: typedItems.length,
      },
    });
  } catch (error) {
    console.error('[validar-pesquisa-precos]', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Falha inesperada ao validar pesquisa de precos.',
    }, 500);
  }
});
