import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { serializeDocxTemplateFile } from '@/lib/docxDocumentTemplate';
import {
  documentTemplatesService,
  type DocumentTemplateCode,
  type DocumentTemplateRecord,
} from '@/services/documentTemplates';

const TEMPLATE_CODE: DocumentTemplateCode = 'termo-referencia-compras';

export default function ModelosDocumentos() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [templates, setTemplates] = useState<DocumentTemplateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('Termo de Referencia - Compras');
  const [versionLabel, setVersionLabel] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsedTemplatePreview, setParsedTemplatePreview] = useState<Awaited<ReturnType<typeof serializeDocxTemplateFile>> | null>(null);
  const [questionnaireSchemaText, setQuestionnaireSchemaText] = useState('');

  const activeTemplate = useMemo(
    () => templates.find((template) => template.code === TEMPLATE_CODE && template.status === 'active') || null,
    [templates],
  );

  const templateVersions = useMemo(
    () => templates.filter((template) => template.code === TEMPLATE_CODE),
    [templates],
  );

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const nextTemplates = await documentTemplatesService.listAll();
      setTemplates(nextTemplates);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar modelos de documentos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const handleFileSelection = async (file: File | null) => {
    setSelectedFile(file);
    setParsedTemplatePreview(null);
    setQuestionnaireSchemaText('');

    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Envie um arquivo DOCX.');
      return;
    }

    setIsParsingFile(true);
    try {
      const parsedTemplate = await serializeDocxTemplateFile(file);
      setParsedTemplatePreview(parsedTemplate);
      setQuestionnaireSchemaText(JSON.stringify(parsedTemplate.questionnaireSchema, null, 2));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao analisar o modelo DOCX.');
    } finally {
      setIsParsingFile(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo DOCX para continuar.');
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith('.docx')) {
      toast.error('Envie um arquivo DOCX.');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedTemplate = parsedTemplatePreview || await serializeDocxTemplateFile(selectedFile);
      const questionnaireSchema = questionnaireSchemaText.trim()
        ? JSON.parse(questionnaireSchemaText)
        : parsedTemplate.questionnaireSchema;

      if (!parsedTemplate.templateText.trim()) {
        throw new Error('Nao foi possivel extrair texto do modelo DOCX.');
      }

      if (parsedTemplate.editableBlocks.length === 0) {
        throw new Error('Nao encontrei trechos editaveis no modelo. Verifique se o DOCX possui instrucoes ou placeholders.');
      }

      await documentTemplatesService.uploadTemplate({
        code: TEMPLATE_CODE,
        name: name.trim() || parsedTemplate.title || 'Termo de Referencia - Compras',
        description: description.trim() || undefined,
        versionLabel: versionLabel.trim() || undefined,
        fileName: selectedFile.name,
        mimeType: selectedFile.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        templateBase64: parsedTemplate.templateBase64,
        templateText: parsedTemplate.templateText,
        editableBlocks: parsedTemplate.editableBlocks,
        questionnaireSchema,
        createdByEmail: user?.email,
      });

      await loadTemplates();
      setSelectedFile(null);
      setParsedTemplatePreview(null);
      setQuestionnaireSchemaText('');
      setVersionLabel('');
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast.success(
        `Modelo publicado com ${parsedTemplate.editableBlocks.length} bloco(s) editavel(is) e ${questionnaireSchema?.questions?.length || 0} pergunta(s).`,
      );
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar o modelo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <HeaderActions>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadTemplates()} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </HeaderActions>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1a1a19]">Administracao</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#34322d]">Modelos de documentos</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#858481]">
          Publique os modelos DOCX ativos usados pela geracao assistida. O editor consome sempre a versao ativa de cada tipo.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <FilterPanel title="Publicar modelo DOCX">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome</Label>
              <Input id="template-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-version">Versao</Label>
              <Input
                id="template-version"
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                placeholder="ex.: Dez/2025"
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="template-description">Descricao</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Observacoes sobre a versao atual do modelo."
            />
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-border-default bg-surface-subtle/40 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-text-primary">Arquivo do modelo</p>
                <p className="text-xs text-text-secondary">
                  Envie o DOCX atual do Termo de Referencia para Compras. O upload substitui a versao ativa anterior.
                </p>
                <p className="text-xs text-text-muted">{selectedFile ? selectedFile.name : 'Nenhum arquivo selecionado.'}</p>
              </div>

              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  onChange={(event) => void handleFileSelection(event.target.files?.[0] || null)}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSubmitting || isParsingFile}>
                  <Upload className="h-4 w-4" />
                  Selecionar DOCX
                </Button>
                <Button type="button" onClick={() => void handleUpload()} disabled={isSubmitting || isParsingFile || !selectedFile}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Publicar
                </Button>
              </div>
            </div>
          </div>

          {isParsingFile ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-border-default bg-surface-subtle/40 px-3 py-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analisando campos, clausulas OU e lacunas do modelo...
            </div>
          ) : parsedTemplatePreview ? (
            <div className="mt-4 space-y-3 rounded-lg border border-border-default bg-surface-subtle/40 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Blocos editaveis</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{parsedTemplatePreview.editableBlocks.length}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Perguntas</p>
                  <p className="mt-1 text-lg font-semibold text-text-primary">{parsedTemplatePreview.questionnaireSchema.questions.length}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Titulo detectado</p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{parsedTemplatePreview.title || '-'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-questionnaire-schema">Questionario detectado</Label>
                <Textarea
                  id="template-questionnaire-schema"
                  value={questionnaireSchemaText}
                  onChange={(event) => setQuestionnaireSchemaText(event.target.value)}
                  className="min-h-[220px] font-mono text-xs"
                />
                <p className="text-xs leading-5 text-text-secondary">
                  Revise este JSON apenas quando precisar corrigir perguntas detectadas automaticamente pelo modelo AGU.
                </p>
              </div>
            </div>
          ) : null}
        </FilterPanel>

        <SectionPanel title="Modelo ativo" description="Versao usada hoje pelo editor.">
          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando modelos...
            </div>
          ) : activeTemplate ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Ativo</Badge>
                <Badge variant="outline">Termo de Referencia - Compras</Badge>
                {activeTemplate.versionLabel ? <Badge variant="outline">{activeTemplate.versionLabel}</Badge> : null}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-text-primary">{activeTemplate.name}</p>
                <p className="text-xs text-text-secondary">{activeTemplate.fileName}</p>
              </div>

              {activeTemplate.description ? (
                <p className="text-sm leading-6 text-text-secondary">{activeTemplate.description}</p>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border-default/70 bg-surface-subtle/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Blocos editaveis</p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">{activeTemplate.editableBlocks.length}</p>
                </div>
                <div className="rounded-lg border border-border-default/70 bg-surface-subtle/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Perguntas</p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">{activeTemplate.questionnaireSchema?.questions.length || 0}</p>
                </div>
                <div className="rounded-lg border border-border-default/70 bg-surface-subtle/40 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Atualizado em</p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">
                    {new Date(activeTemplate.updatedAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-text-secondary">
              Ainda nao existe modelo ativo para Termo de Referencia - Compras.
            </p>
          )}
        </SectionPanel>
      </div>

      <DataTablePanel
        title="Versoes publicadas"
        description="Historico do modelo usado pelo editor para Termo de Referencia - Compras."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Versao</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>Blocos</TableHead>
              <TableHead>Perguntas</TableHead>
              <TableHead>Atualizado em</TableHead>
              <TableHead>Autor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templateVersions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-text-secondary">
                  Nenhum modelo publicado ainda.
                </TableCell>
              </TableRow>
            ) : (
              templateVersions.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <Badge variant={template.status === 'active' ? 'secondary' : 'outline'}>
                      {template.status === 'active' ? 'Ativo' : 'Arquivado'}
                    </Badge>
                  </TableCell>
                  <TableCell>{template.versionLabel || '-'}</TableCell>
                  <TableCell>
                    <div className="font-medium text-text-primary">{template.name}</div>
                    <div className="text-xs text-text-secondary">{template.fileName}</div>
                  </TableCell>
                  <TableCell>{template.editableBlocks.length}</TableCell>
                  <TableCell>{template.questionnaireSchema?.questions.length || 0}</TableCell>
                  <TableCell>{new Date(template.updatedAt).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{template.createdByEmail || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTablePanel>
    </div>
  );
}
