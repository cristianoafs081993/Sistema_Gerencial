import { supabase } from '@/lib/supabase';
import type { DocxTemplateExportPlan } from '@/lib/docxDocumentTemplate';

export type LicitacaoArtifactType = 'etp' | 'mapa_riscos' | 'termo_referencia' | 'minuta_contrato';

type LicitacaoArtifactRow = {
  id: string;
  artifact_type: LicitacaoArtifactType;
  process_id?: string | null;
  process_number?: string | null;
  manual_object?: string | null;
  title?: string | null;
  subtitle?: string | null;
  html_content?: string | null;
  plain_text?: string | null;
  metadata?: Record<string, unknown> | null;
  source_artifact_ids?: string[] | null;
  template_id?: string | null;
  docx_export_plan?: DocxTemplateExportPlan | null;
  docx_file_name?: string | null;
  created_by?: string | null;
  created_by_email?: string | null;
  version?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LicitacaoArtifactRecord = {
  id: string;
  artifactType: LicitacaoArtifactType;
  processId?: string;
  processNumber?: string;
  manualObject?: string;
  title: string;
  subtitle?: string;
  htmlContent: string;
  plainText: string;
  metadata: Record<string, unknown>;
  sourceArtifactIds: string[];
  templateId?: string;
  docxExportPlan?: DocxTemplateExportPlan;
  docxFileName?: string;
  createdBy?: string;
  createdByEmail?: string;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateLicitacaoArtifactVersionInput = {
  artifactType: LicitacaoArtifactType;
  processId?: string;
  processNumber?: string;
  manualObject?: string;
  title: string;
  subtitle?: string;
  htmlContent: string;
  plainText?: string;
  metadata?: Record<string, unknown>;
  sourceArtifactIds?: string[];
  templateId?: string;
  docxExportPlan?: DocxTemplateExportPlan;
  docxFileName?: string;
};

export type UpdateLicitacaoArtifactContentInput = {
  id: string;
  htmlContent: string;
  plainText?: string;
  metadata?: Record<string, unknown>;
};

const ARTIFACT_SELECT = `
  id,
  artifact_type,
  process_id,
  process_number,
  manual_object,
  title,
  subtitle,
  html_content,
  plain_text,
  metadata,
  source_artifact_ids,
  template_id,
  docx_export_plan,
  docx_file_name,
  created_by,
  created_by_email,
  version,
  created_at,
  updated_at
`;

export function stripArtifactHtml(html: string) {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const div = document.createElement('div');
  div.innerHTML = html.replace(/></g, '> <');
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

export function mapRow(row: LicitacaoArtifactRow): LicitacaoArtifactRecord {
  return {
    id: row.id,
    artifactType: row.artifact_type,
    processId: row.process_id || undefined,
    processNumber: row.process_number || undefined,
    manualObject: row.manual_object || undefined,
    title: row.title || 'Artefato de licitacao',
    subtitle: row.subtitle || undefined,
    htmlContent: row.html_content || '',
    plainText: row.plain_text || stripArtifactHtml(row.html_content || ''),
    metadata: row.metadata || {},
    sourceArtifactIds: row.source_artifact_ids || [],
    templateId: row.template_id || undefined,
    docxExportPlan: row.docx_export_plan || undefined,
    docxFileName: row.docx_file_name || undefined,
    createdBy: row.created_by || undefined,
    createdByEmail: row.created_by_email || undefined,
    version: row.version || 1,
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function normalizeManualObject(value?: string) {
  return value?.replace(/\s+/g, ' ').trim() || undefined;
}

async function getNextVersion(input: Pick<CreateLicitacaoArtifactVersionInput, 'artifactType' | 'processId' | 'manualObject'>) {
  let query = supabase
    .from('licitacao_document_artifacts')
    .select('version')
    .eq('artifact_type', input.artifactType)
    .order('version', { ascending: false })
    .limit(1);

  if (input.processId) {
    query = query.eq('process_id', input.processId);
  } else {
    query = query.is('process_id', null).eq('manual_object', normalizeManualObject(input.manualObject) || '');
  }

  const { data, error } = await query;
  if (error) throw error;

  const latestVersion = Array.isArray(data) && data[0]?.version ? Number(data[0].version) : 0;
  return latestVersion + 1;
}

export const licitacaoArtifactsService = {
  async list() {
    const { data, error } = await supabase
      .from('licitacao_document_artifacts')
      .select(ARTIFACT_SELECT)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => mapRow(row as LicitacaoArtifactRow));
  },

  async listByProcess(processId: string) {
    const { data, error } = await supabase
      .from('licitacao_document_artifacts')
      .select(ARTIFACT_SELECT)
      .eq('process_id', processId)
      .order('artifact_type', { ascending: true })
      .order('version', { ascending: false });

    if (error) throw error;
    return (data || []).map((row) => mapRow(row as LicitacaoArtifactRow));
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('licitacao_document_artifacts')
      .select(ARTIFACT_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRow(data as LicitacaoArtifactRow) : null;
  },

  async createVersion(input: CreateLicitacaoArtifactVersionInput) {
    const htmlContent = input.htmlContent || '<p></p>';
    const version = await getNextVersion(input);
    const payload = {
      artifact_type: input.artifactType,
      process_id: input.processId || null,
      process_number: input.processNumber || null,
      manual_object: normalizeManualObject(input.manualObject) || null,
      title: input.title,
      subtitle: input.subtitle || null,
      html_content: htmlContent,
      plain_text: input.plainText || stripArtifactHtml(htmlContent),
      metadata: input.metadata || {},
      source_artifact_ids: input.sourceArtifactIds || [],
      template_id: input.templateId || null,
      docx_export_plan: input.docxExportPlan || null,
      docx_file_name: input.docxFileName || null,
      version,
    };

    const { data, error } = await supabase
      .from('licitacao_document_artifacts')
      .insert(payload)
      .select(ARTIFACT_SELECT)
      .single();

    if (error) throw error;
    return mapRow(data as LicitacaoArtifactRow);
  },

  async updateContent(input: UpdateLicitacaoArtifactContentInput) {
    const htmlContent = input.htmlContent || '<p></p>';
    const payload: Record<string, unknown> = {
      html_content: htmlContent,
      plain_text: input.plainText || stripArtifactHtml(htmlContent),
      updated_at: new Date().toISOString(),
    };

    if (input.metadata) payload.metadata = input.metadata;

    const { data, error } = await supabase
      .from('licitacao_document_artifacts')
      .update(payload)
      .eq('id', input.id)
      .select(ARTIFACT_SELECT)
      .single();

    if (error) throw error;
    return mapRow(data as LicitacaoArtifactRow);
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('licitacao_document_artifacts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
