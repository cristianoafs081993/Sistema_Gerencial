import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Download, ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { applyDocxTemplatePlan } from '@/lib/docxDocumentTemplate';
import type { SupportedDocumentType } from '@/lib/documentGeneration';
import {
  licitacaoArtifactsService,
  type LicitacaoArtifactRecord,
  type LicitacaoArtifactType,
} from '@/services/licitacaoArtifacts';

const artifactTypeLabels: Record<LicitacaoArtifactType, string> = {
  etp: 'ETP',
  mapa_riscos: 'Mapa de Risco',
  termo_referencia: 'Termo de Referencia',
  minuta_contrato: 'Minuta de Contrato',
};

const documentTypeByArtifactType: Record<LicitacaoArtifactType, SupportedDocumentType> = {
  etp: 'estudo-tecnico-preliminar-servicos-continuos',
  mapa_riscos: 'mapa-riscos-licitacao',
  termo_referencia: 'termo-referencia-compras',
  minuta_contrato: 'contrato-servico-ifrn',
};

const artifactTypeOptions: Array<{ value: 'todos' | LicitacaoArtifactType; label: string }> = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'etp', label: 'ETP' },
  { value: 'mapa_riscos', label: 'Mapa de Risco' },
  { value: 'termo_referencia', label: 'Termo de Referencia' },
  { value: 'minuta_contrato', label: 'Minuta de Contrato' },
];

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

export default function ArtefatosLicitacao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [artifactType, setArtifactType] = useState<'todos' | LicitacaoArtifactType>('todos');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: artifacts = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['licitacao-artifacts'],
    queryFn: () => licitacaoArtifactsService.list(),
    staleTime: 15000,
  });

  const filteredArtifacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return artifacts.filter((artifact) => {
      const matchesType = artifactType === 'todos' || artifact.artifactType === artifactType;
      if (!matchesType) return false;
      if (!query) return true;

      const haystack = [
        artifact.title,
        artifact.subtitle,
        artifact.processNumber,
        artifact.manualObject,
        artifact.plainText,
        artifactTypeLabels[artifact.artifactType],
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [artifacts, artifactType, search]);

  const openArtifact = (artifact: LicitacaoArtifactRecord) => {
    const documentType = documentTypeByArtifactType[artifact.artifactType];
    navigate(`/editor-documentos/${documentType}?artifactId=${artifact.id}`);
  };

  const copyArtifact = async (artifact: LicitacaoArtifactRecord) => {
    await navigator.clipboard.writeText(artifact.plainText || artifact.htmlContent);
    toast.success('Artefato copiado.');
  };

  const downloadDocx = async (artifact: LicitacaoArtifactRecord) => {
    const templateBase64 = typeof artifact.metadata.templateBase64 === 'string'
      ? artifact.metadata.templateBase64
      : undefined;

    if (!templateBase64 || !artifact.docxExportPlan) {
      toast.error('Este artefato nao possui plano de exportacao DOCX.');
      return;
    }

    setDownloadingId(artifact.id);
    try {
      const bytes = await applyDocxTemplatePlan(templateBase64, artifact.docxExportPlan);
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = artifact.docxFileName || `${artifact.title}.docx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success('DOCX gerado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel gerar o DOCX.');
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteArtifact = async (artifact: LicitacaoArtifactRecord) => {
    if (!window.confirm(`Excluir ${artifactTypeLabels[artifact.artifactType]} v${artifact.version}?`)) return;

    setDeletingId(artifact.id);
    try {
      await licitacaoArtifactsService.delete(artifact.id);
      await queryClient.invalidateQueries({ queryKey: ['licitacao-artifacts'] });
      toast.success('Artefato excluido.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel excluir o artefato.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        <Button type="button" variant="outline" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Atualizar
        </Button>
      </HeaderActions>

      <SectionPanel
        title="Artefatos de Licitacao"
        description="Repositorio das versoes geradas no fluxo ETP, Mapa de Risco, Termo de Referencia e Minuta de Contrato."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-radius-lg border border-border-default bg-surface-subtle/70 p-3">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Total</p>
            <p className="mt-1 font-ui text-2xl font-semibold text-text-primary">{artifacts.length}</p>
          </div>
          {artifactTypeOptions.slice(1).map((option) => (
            <div key={option.value} className="rounded-radius-lg border border-border-default bg-surface-subtle/70 p-3">
              <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{option.label}</p>
              <p className="mt-1 font-ui text-2xl font-semibold text-text-primary">
                {artifacts.filter((artifact) => artifact.artifactType === option.value).length}
              </p>
            </div>
          ))}
        </div>
      </SectionPanel>

      <FilterPanel>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por processo, objeto, titulo ou conteudo"
          />
          <Select value={artifactType} onValueChange={(value) => setArtifactType(value as typeof artifactType)}>
            <SelectTrigger>
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {artifactTypeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FilterPanel>

      <DataTablePanel title="Biblioteca" description={`${filteredArtifacts.length} artefato(s) exibido(s)`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Titulo</TableHead>
              <TableHead>Processo / Objeto</TableHead>
              <TableHead>Versao</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead className="text-right">Acoes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando artefatos...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredArtifacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="py-10 text-center text-sm text-text-secondary">Nenhum artefato encontrado.</div>
                </TableCell>
              </TableRow>
            ) : (
              filteredArtifacts.map((artifact) => (
                <TableRow key={artifact.id}>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/20 bg-primary/[0.07] text-primary">
                      {artifactTypeLabels[artifact.artifactType]}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-[240px]">
                    <p className="font-ui text-sm font-semibold text-text-primary">{artifact.title}</p>
                    <p className="mt-0.5 line-clamp-1 font-ui text-xs text-text-secondary">{artifact.subtitle || artifact.plainText}</p>
                  </TableCell>
                  <TableCell className="min-w-[220px]">
                    <p className="font-mono text-xs font-semibold text-text-primary">{artifact.processNumber || '-'}</p>
                    <p className="mt-0.5 line-clamp-1 font-ui text-xs text-text-secondary">{artifact.manualObject || '-'}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">v{artifact.version}</TableCell>
                  <TableCell className="font-ui text-xs text-text-secondary">{formatDate(artifact.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openArtifact(artifact)} aria-label="Abrir no editor">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => void copyArtifact(artifact)} aria-label="Copiar">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => void downloadDocx(artifact)}
                        disabled={!artifact.docxExportPlan || downloadingId === artifact.id}
                        aria-label="Baixar DOCX"
                      >
                        {downloadingId === artifact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => void deleteArtifact(artifact)}
                        disabled={deletingId === artifact.id}
                        aria-label="Excluir"
                      >
                        {deletingId === artifact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTablePanel>
    </div>
  );
}
