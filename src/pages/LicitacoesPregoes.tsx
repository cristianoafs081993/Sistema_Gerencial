import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw, RotateCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { TablePagination } from '@/components/design-system/TablePagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_PNCP_UASG, IFRN_CNPJ } from '@/lib/licitacoesPncp';
import {
  getLicitacaoLinks,
  getProposalStatus,
  licitacoesPncpService,
  type LicitacaoPncpProposalStatus,
  type LicitacaoPncpRow,
  type LicitacaoPncpSrpFilter,
} from '@/services/licitacoesPncp';

const proposalOptions: Array<{ value: LicitacaoPncpProposalStatus; label: string }> = [
  { value: 'todos', label: 'Todos os prazos' },
  { value: 'abertas', label: 'Propostas abertas' },
  { value: 'futuras', label: 'Abertura futura' },
  { value: 'encerradas', label: 'Encerradas' },
];

const srpOptions: Array<{ value: LicitacaoPncpSrpFilter; label: string }> = [
  { value: 'todos', label: 'SRP e tradicional' },
  { value: 'sim', label: 'Somente SRP' },
  { value: 'nao', label: 'Sem SRP' },
];

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultStartDate() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 364);
  return toDateInputValue(start);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatUasg(row: LicitacaoPncpRow) {
  if (!row.uasgCodigo) return '-';
  return `${row.uasgCodigo}${row.uasgNome ? ` - ${row.uasgNome}` : ''}`;
}

function proposalBadgeClass(status: string) {
  if (status === 'Aberta') return 'border-primary/20 bg-primary/[0.08] text-primary';
  if (status === 'Futura') return 'border-blue-500/20 bg-blue-500/[0.08] text-blue-700';
  if (status === 'Encerrada') return 'border-slate-300 bg-slate-50 text-slate-600';
  return 'border-amber-500/20 bg-amber-500/[0.08] text-amber-700';
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <div className="mt-1 font-ui text-sm font-semibold text-text-primary">{value || '-'}</div>
    </div>
  );
}

function LicitacaoDetailsSheet({
  licitacao,
  onOpenChange,
}: {
  licitacao: LicitacaoPncpRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const links = licitacao ? getLicitacaoLinks(licitacao) : null;

  return (
    <Sheet open={Boolean(licitacao)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        {licitacao ? (
          <div className="space-y-5">
            <SheetHeader className="pr-8">
              <SheetTitle>{licitacao.modalidadeNome || 'Pregão'} {licitacao.numeroCompra}/{licitacao.anoCompra}</SheetTitle>
              <SheetDescription>{licitacao.numeroControlePncp}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={proposalBadgeClass(getProposalStatus(licitacao))}>
                {getProposalStatus(licitacao)}
              </Badge>
              {licitacao.srp ? <Badge variant="outline">SRP</Badge> : null}
              {licitacao.situacaoCompraNome ? <Badge variant="secondary">{licitacao.situacaoCompraNome}</Badge> : null}
            </div>

            <div className="space-y-2">
              <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Objeto</p>
              <p className="font-ui text-sm leading-6 text-text-primary">{licitacao.objetoCompra || '-'}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Processo" value={licitacao.processo} />
              <DetailItem label="UASG" value={formatUasg(licitacao)} />
              <DetailItem label="Publicação PNCP" value={formatDateTime(licitacao.dataPublicacaoPncp)} />
              <DetailItem label="Abertura" value={formatDateTime(licitacao.dataAberturaProposta)} />
              <DetailItem label="Encerramento" value={formatDateTime(licitacao.dataEncerramentoProposta)} />
              <DetailItem label="Atualização global" value={formatDateTime(licitacao.dataAtualizacaoGlobal)} />
              <DetailItem label="Valor estimado" value={formatCurrency(licitacao.valorTotalEstimado)} />
              <DetailItem label="Valor homologado" value={formatCurrency(licitacao.valorTotalHomologado)} />
              <DetailItem label="Modo de disputa" value={licitacao.modoDisputaNome} />
              <DetailItem label="Amparo legal" value={licitacao.amparoLegalNome} />
            </div>

            {licitacao.informacaoComplementar ? (
              <div className="rounded-radius-lg border border-border-default p-4">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Informação complementar</p>
                <p className="mt-2 whitespace-pre-wrap font-ui text-sm leading-6 text-text-secondary">
                  {licitacao.informacaoComplementar}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {links?.pncpUrl ? (
                <Button type="button" variant="outline" className="gap-2" asChild>
                  <a href={links.pncpUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    PNCP
                  </a>
                </Button>
              ) : null}
              {links?.comprasGovUrl ? (
                <Button type="button" variant="outline" className="gap-2" asChild>
                  <a href={links.comprasGovUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Compras.gov.br
                  </a>
                </Button>
              ) : null}
              {licitacao.linkProcessoEletronico ? (
                <Button type="button" variant="outline" className="gap-2" asChild>
                  <a href={licitacao.linkProcessoEletronico} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Processo
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function LicitacoesPregoes() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [uasgCodigo, setUasgCodigo] = useState(DEFAULT_PNCP_UASG);
  const [situacao, setSituacao] = useState('todos');
  const [srp, setSrp] = useState<LicitacaoPncpSrpFilter>('todos');
  const [proposalStatus, setProposalStatus] = useState<LicitacaoPncpProposalStatus>('todos');
  const [dataInicial, setDataInicial] = useState(getDefaultStartDate);
  const [dataFinal, setDataFinal] = useState(toDateInputValue(new Date()));
  const [selectedLicitacao, setSelectedLicitacao] = useState<LicitacaoPncpRow | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    search,
    uasgCodigo,
    situacao,
    srp,
    proposalStatus,
    dataInicial,
    dataFinal,
  }), [dataFinal, dataInicial, page, pageSize, proposalStatus, search, situacao, srp, uasgCodigo]);

  const { data: listResult = { rows: [], count: 0 }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['licitacoes-pncp', queryParams],
    queryFn: () => licitacoesPncpService.list(queryParams),
    staleTime: 30000,
  });

  const { data: uasgOptions = [] } = useQuery({
    queryKey: ['licitacoes-pncp-uasgs'],
    queryFn: () => licitacoesPncpService.listUasgs(),
    staleTime: 60000,
  });

  const { data: situacoes = [] } = useQuery({
    queryKey: ['licitacoes-pncp-situacoes'],
    queryFn: () => licitacoesPncpService.listSituacoes(),
    staleTime: 60000,
  });

  const { data: lastSync } = useQuery({
    queryKey: ['licitacoes-pncp-last-sync'],
    queryFn: () => licitacoesPncpService.getLastSyncRun(),
    staleTime: 30000,
  });

  const totalPages = Math.max(1, Math.ceil(listResult.count / pageSize));
  const currentPageRows = listResult.rows;
  const totalEstimated = currentPageRows.reduce((sum, row) => sum + (row.valorTotalEstimado ?? 0), 0);
  const openOnPage = currentPageRows.filter((row) => getProposalStatus(row) === 'Aberta').length;

  const resetPage = () => setPage(1);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const selectedUasgs = uasgCodigo === 'todos'
        ? uasgOptions.map((option) => option.codigo)
        : [uasgCodigo || DEFAULT_PNCP_UASG];

      const result = await licitacoesPncpService.sync({
        unidadeCodigos: selectedUasgs.length ? selectedUasgs : [DEFAULT_PNCP_UASG],
        dataInicial,
        dataFinal,
        source: 'frontend-manual',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-uasgs'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-situacoes'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-last-sync'] }),
      ]);

      if (result.status === 'partial_success') {
        toast.warning(`Sincronização parcial: ${result.upserted} pregão(ões) atualizado(s).`);
      } else {
        toast.success(`${result.upserted} pregão(ões) atualizado(s) via PNCP.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível sincronizar os pregões do PNCP.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        <span>PNCP / Pregões IFRN</span>
      </HeaderSubtitle>
      <HeaderActions>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar lista
          </Button>
          {isSuperAdmin ? (
            <Button type="button" className="gap-2" onClick={() => void handleManualSync()} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Sincronizar PNCP
            </Button>
          ) : null}
        </div>
      </HeaderActions>

      <SectionPanel
        title="Pregões IFRN"
        description={`Consulta materializada do PNCP para o CNPJ ${IFRN_CNPJ}, com filtro operacional por UASG.`}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-radius-lg border border-border-default bg-surface-subtle/70 p-3">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Registros</p>
            <p className="mt-1 font-ui text-2xl font-semibold text-text-primary">{listResult.count}</p>
          </div>
          <div className="rounded-radius-lg border border-border-default bg-surface-subtle/70 p-3">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Abertas na página</p>
            <p className="mt-1 font-ui text-2xl font-semibold text-primary">{openOnPage}</p>
          </div>
          <div className="rounded-radius-lg border border-border-default bg-surface-subtle/70 p-3">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Estimado na página</p>
            <p className="mt-1 font-ui text-xl font-semibold text-text-primary">{formatCurrency(totalEstimated)}</p>
          </div>
          <div className="rounded-radius-lg border border-border-default bg-surface-subtle/70 p-3">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Última sincronização</p>
            <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{lastSync ? formatDateTime(lastSync.finishedAt || lastSync.startedAt) : '-'}</p>
            {lastSync?.status ? <p className="mt-0.5 font-ui text-xs text-text-secondary">{lastSync.status}</p> : null}
          </div>
        </div>
      </SectionPanel>

      <FilterPanel>
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_190px_170px_170px_170px_150px_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className="pl-9"
              placeholder="Buscar por objeto, processo, número ou UASG"
            />
          </div>

          <Select
            value={uasgCodigo}
            onValueChange={(value) => {
              setUasgCodigo(value);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="UASG" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as UASGs</SelectItem>
              {uasgOptions.map((option) => (
                <SelectItem key={option.codigo} value={option.codigo}>
                  {option.codigo} {option.nome ? `- ${option.nome}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={situacao}
            onValueChange={(value) => {
              setSituacao(value);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as situações</SelectItem>
              {situacoes.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={proposalStatus}
            onValueChange={(value) => {
              setProposalStatus(value as LicitacaoPncpProposalStatus);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Propostas" />
            </SelectTrigger>
            <SelectContent>
              {proposalOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={srp}
            onValueChange={(value) => {
              setSrp(value as LicitacaoPncpSrpFilter);
              resetPage();
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="SRP" />
            </SelectTrigger>
            <SelectContent>
              {srpOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="date"
            value={dataInicial}
            onChange={(event) => {
              setDataInicial(event.target.value);
              resetPage();
            }}
            aria-label="Data inicial"
          />
          <Input
            type="date"
            value={dataFinal}
            onChange={(event) => {
              setDataFinal(event.target.value);
              resetPage();
            }}
            aria-label="Data final"
          />
        </div>
      </FilterPanel>

      <DataTablePanel title="Lista de pregões" description={`${listResult.count} registro(s) no filtro atual`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compra</TableHead>
              <TableHead>Objeto</TableHead>
              <TableHead>UASG</TableHead>
              <TableHead>Propostas</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor estimado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando pregões...
                  </div>
                </TableCell>
              </TableRow>
            ) : currentPageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-10 text-center text-sm text-text-secondary">Nenhum pregão encontrado.</div>
                </TableCell>
              </TableRow>
            ) : (
              currentPageRows.map((row) => {
                const status = getProposalStatus(row);
                const links = getLicitacaoLinks(row);

                return (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-[170px]">
                      <p className="font-mono text-xs font-semibold text-text-primary">{row.numeroCompra}/{row.anoCompra}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{row.numeroControlePncp}</p>
                      {row.processo ? <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{row.processo}</p> : null}
                    </TableCell>
                    <TableCell className="min-w-[320px]">
                      <p className="line-clamp-2 font-ui text-sm font-semibold text-text-primary">{row.objetoCompra || '-'}</p>
                      <p className="mt-1 font-ui text-xs text-text-secondary">{row.modalidadeNome || 'Pregão'}{row.modoDisputaNome ? ` - ${row.modoDisputaNome}` : ''}</p>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <p className="font-mono text-xs font-semibold text-text-primary">{row.uasgCodigo || '-'}</p>
                      <p className="mt-0.5 line-clamp-1 font-ui text-xs text-text-secondary">{row.uasgNome || '-'}</p>
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <Badge variant="outline" className={proposalBadgeClass(status)}>
                        {status}
                      </Badge>
                      <p className="mt-1 font-ui text-xs text-text-secondary">{formatDate(row.dataEncerramentoProposta)}</p>
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <p className="font-ui text-sm text-text-primary">{row.situacaoCompraNome || '-'}</p>
                      {row.srp ? <Badge variant="secondary" className="mt-1">SRP</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatCurrency(row.valorTotalEstimado)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLicitacao(row)}>
                          Detalhar
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={links.pncpUrl} target="_blank" rel="noreferrer" aria-label="Abrir no PNCP">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={listResult.count}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </DataTablePanel>

      <LicitacaoDetailsSheet licitacao={selectedLicitacao} onOpenChange={(open) => !open && setSelectedLicitacao(null)} />
    </div>
  );
}
