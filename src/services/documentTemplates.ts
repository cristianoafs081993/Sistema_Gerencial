import { supabase } from '@/lib/supabase';

export type DocumentTemplateCode = 'termo-referencia-compras';
export type DocumentTemplateStatus = 'active' | 'archived';
export type DocumentTemplateEditableBlockKind = 'paragraph' | 'table';

export type DocumentTemplateEditableBlock = {
  id: string;
  kind: DocumentTemplateEditableBlockKind;
  blockIndex: number;
  text: string;
  excerpt: string;
  styleId?: string;
  isInstructional: boolean;
  hasPlaceholder: boolean;
};

export type DocumentTemplateQuestionKind = 'exclusive' | 'optional' | 'field';

export type DocumentTemplateQuestionOption = {
  id: string;
  label: string;
  text: string;
  blockId?: string;
  blockIndex?: number;
  blockIds?: string[];
  blockIndexes?: number[];
  blockTexts?: string[];
};

export type DocumentTemplateQuestion = {
  id: string;
  kind: DocumentTemplateQuestionKind;
  title: string;
  prompt: string;
  guidance?: string;
  blockId?: string;
  blockIndex?: number;
  blockIds?: string[];
  blockIndexes?: number[];
  placeholder?: string;
  options?: DocumentTemplateQuestionOption[];
};

export type DocumentTemplateQuestionnaireSchema = {
  version: 1;
  generatedAt: string;
  questions: DocumentTemplateQuestion[];
};

export type DocumentTemplateRecord = {
  id: string;
  code: DocumentTemplateCode;
  name: string;
  description?: string;
  versionLabel?: string;
  fileName: string;
  mimeType: string;
  templateBase64: string;
  templateText: string;
  editableBlocks: DocumentTemplateEditableBlock[];
  questionnaireSchema?: DocumentTemplateQuestionnaireSchema;
  status: DocumentTemplateStatus;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentTemplateRow = {
  id: string;
  code: DocumentTemplateCode;
  name: string;
  description?: string | null;
  version_label?: string | null;
  file_name: string;
  mime_type: string;
  template_base64: string;
  template_text: string;
  editable_blocks?: DocumentTemplateEditableBlock[] | null;
  questionnaire_schema?: DocumentTemplateQuestionnaireSchema | null;
  status: DocumentTemplateStatus;
  created_by_email?: string | null;
  created_at: string;
  updated_at: string;
};

const TEMPLATE_SELECT = `
  id,
  code,
  name,
  description,
  version_label,
  file_name,
  mime_type,
  template_base64,
  template_text,
  editable_blocks,
  questionnaire_schema,
  status,
  created_by_email,
  created_at,
  updated_at
`;

const mapTemplateRow = (row: DocumentTemplateRow): DocumentTemplateRecord => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description || undefined,
  versionLabel: row.version_label || undefined,
  fileName: row.file_name,
  mimeType: row.mime_type,
  templateBase64: row.template_base64,
  templateText: row.template_text,
  editableBlocks: Array.isArray(row.editable_blocks) ? row.editable_blocks : [],
  questionnaireSchema: row.questionnaire_schema || undefined,
  status: row.status,
  createdByEmail: row.created_by_email || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

type UploadDocumentTemplateParams = {
  code: DocumentTemplateCode;
  name: string;
  description?: string;
  versionLabel?: string;
  fileName: string;
  mimeType: string;
  templateBase64: string;
  templateText: string;
  editableBlocks: DocumentTemplateEditableBlock[];
  questionnaireSchema?: DocumentTemplateQuestionnaireSchema;
  createdByEmail?: string;
};

export const documentTemplatesService = {
  async listAll(): Promise<DocumentTemplateRecord[]> {
    const { data, error } = await supabase
      .from('document_templates')
      .select(TEMPLATE_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as DocumentTemplateRow[] | null) || []).map(mapTemplateRow);
  },

  async listByCode(code: DocumentTemplateCode): Promise<DocumentTemplateRecord[]> {
    const { data, error } = await supabase
      .from('document_templates')
      .select(TEMPLATE_SELECT)
      .eq('code', code)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data as DocumentTemplateRow[] | null) || []).map(mapTemplateRow);
  },

  async getActiveTemplate(code: DocumentTemplateCode): Promise<DocumentTemplateRecord | null> {
    const { data, error } = await supabase
      .from('document_templates')
      .select(TEMPLATE_SELECT)
      .eq('code', code)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapTemplateRow(data as DocumentTemplateRow) : null;
  },

  async uploadTemplate(params: UploadDocumentTemplateParams): Promise<DocumentTemplateRecord[]> {
    const { error: archiveError } = await supabase
      .from('document_templates')
      .update({ status: 'archived' })
      .eq('code', params.code)
      .eq('status', 'active');

    if (archiveError) {
      throw archiveError;
    }

    const { error: insertError } = await supabase.from('document_templates').insert({
      code: params.code,
      name: params.name,
      description: params.description || null,
      version_label: params.versionLabel || null,
      file_name: params.fileName,
      mime_type: params.mimeType,
      template_base64: params.templateBase64,
      template_text: params.templateText,
      editable_blocks: params.editableBlocks,
      questionnaire_schema: params.questionnaireSchema || null,
      status: 'active',
      created_by_email: params.createdByEmail || null,
    });

    if (insertError) {
      throw insertError;
    }

    return this.listByCode(params.code);
  },
};
