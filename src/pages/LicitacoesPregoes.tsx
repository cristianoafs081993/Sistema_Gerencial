import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw, RotateCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { TablePagination } from '@/components/design-system/TablePagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

function rawText(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function rawNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function getPncpItems(rawData: Record<string, unknown>) {
  return Array.isArray(rawData.itens)
    ? rawData.itens.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

function getPncpItemDescription(item: Record<string, unknown>) {
  return rawText(item.descricao)
    ?? rawText(item.descricaoItem)
    ?? rawText(item.descricaoDetalhada)
    ?? rawText(item.itemDescricao)
    ?? '-';
}

function getPncpItemNumber(item: Record<string, unknown>) {
  return rawText(item.numeroItem) ?? rawText(item.numero_item) ?? rawText(item.itemNumero) ?? '-';
}

function formatUasg(row: LicitacaoPncpRow) {
  if (!row.uasgCodigo) return '-';
  return `${row.uasgCodigo}${row.uasgNome ? ` - ${row.uasgNome}` : ''}`;
}

function proposalBadgeClass(status: string) {
  if (status === 'Aberta') return 'border-primary/20 bg-primary/[0.08] text-primary';
  if (status === 'Futura') return 'border-sebrae-blue/20 bg-sebrae-blue/[0.08] text-sebrae-blue';
  if (status === 'Encerrada') return 'border-slate-300 bg-slate-50 text-slate-600';
  return 'border-amber-500/20 bg-amber-500/[0.08] text-amber-700';
}

function FilterField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</span>
      {children}
    </div>
  );
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

            {getPncpItems(licitacao.rawData).length > 0 ? (
              <div className="rounded-radius-lg border border-border-default p-4">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Itens PNCP</p>
                <div className="mt-3 space-y-2">
                  {getPncpItems(licitacao.rawData).map((item, index) => {
                    const unitValue = rawNumber(item.valorUnitarioEstimado ?? item.valorUnitario);
                    return (
                      <div key={`${getPncpItemNumber(item)}-${index}`} className="rounded-radius-md border border-border-default/70 bg-surface-subtle/60 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-ui text-sm font-semibold text-text-primary">Item {getPncpItemNumber(item)}</p>
                          <p className="font-mono text-xs font-semibold text-text-primary">
                            {formatCurrency(rawNumber(item.valorTotal ?? item.valorTotalEstimado))}
                          </p>
                        </div>
                        <p className="mt-1 font-ui text-sm text-text-secondary">{getPncpItemDescription(item)}</p>
                        <p className="mt-1 font-ui text-xs text-text-muted">
                          Qtd. {rawText(item.quantidade) ?? '-'} {rawText(item.unidadeMedida) ?? ''}
                          {unitValue !== null ? ` | Unit. ${formatCurrency(unitValue)}` : ''}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [objetoBusca, setObjetoBusca] = useState('');
  const [itemBusca, setItemBusca] = useState('');
  const [uasgCodigo, setUasgCodigo] = useState('');
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
    objetoBusca,
    itemBusca,
    uasgCodigo: uasgCodigo || undefined,
    situacao,
    srp,
    proposalStatus,
    dataInicial,
    dataFinal,
  }), [dataFinal, dataInicial, itemBusca, objetoBusca, page, pageSize, proposalStatus, search, situacao, srp, uasgCodigo]);

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

  const totalPages = Math.max(1, Math.ceil(listResult.count / pageSize));
  const currentPageRows = listResult.rows;

  const resetPage = () => setPage(1);

  const resetFilters = () => {
    setSearch('');
    setObjetoBusca('');
    setItemBusca('');
    setUasgCodigo('');
    setSituacao('todos');
    setSrp('todos');
    setProposalStatus('todos');
    setDataInicial(getDefaultStartDate());
    setDataFinal(toDateInputValue(new Date()));
    resetPage();
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const typedUasg = uasgCodigo.replace(/\D/g, '');

      const result = await licitacoesPncpService.sync({
        ...(typedUasg ? { unidadeCodigos: [typedUasg] } : {}),
        objetoBusca,
        itemBusca,
        dataInicial,
        dataFinal,
        source: 'frontend-search',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-uasgs'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-situacoes'] }),
      ]);

      if (result.status === 'partial_success') {
        toast.warning(`Busca parcial: ${result.upserted} pregão(ões) encontrado(s).`);
      } else {
        toast.success(`${result.upserted} pregão(ões) encontrado(s) via PNCP.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível buscar os pregões no PNCP.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInternalUasgsSync = async () => {
    setIsSyncing(true);
    try {
      const result = await licitacoesPncpService.syncInternalUasgs({
        dataInicial,
        dataFinal,
        source: 'frontend-ifrn-cache',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-uasgs'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-situacoes'] }),
      ]);

      if (result.status === 'partial_success') {
        toast.warning(`Sincronizacao parcial das UASGs IFRN: ${result.upserted} pregao(oes) encontrado(s).`);
      } else {
        toast.success(`${result.upserted} pregao(oes) encontrado(s) nas UASGs IFRN.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel sincronizar as UASGs IFRN.');
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
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handleInternalUasgsSync()} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Sincronizar UASGs IFRN
          </Button>
        </div>
      </HeaderActions>

      <FilterPanel
        title="Filtros de pregões"
        actions={(
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            Limpar filtros
          </Button>
        )}
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-12">
          <FilterField label="UASG" className="xl:col-span-3">
            <Input
              value={uasgCodigo}
              onChange={(event) => {
                setUasgCodigo(event.target.value.replace(/\D/g, '').slice(0, 6));
                resetPage();
              }}
              list="licitacoes-pncp-uasgs"
              inputMode="numeric"
              aria-label="UASG"
              placeholder="Todas as UASGs"
            />
            <datalist id="licitacoes-pncp-uasgs">
              {uasgOptions.map((option) => (
                <option key={option.codigo} value={option.codigo}>
                  {option.nome || option.codigo}
                </option>
              ))}
            </datalist>
          </FilterField>

          <FilterField label="Objeto no PNCP" className="xl:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={objetoBusca}
                onChange={(event) => {
                  setObjetoBusca(event.target.value);
                  resetPage();
                }}
                className="pl-9"
                aria-label="Objeto especifico"
                placeholder="Ex.: energia elétrica, combustível"
              />
            </div>
          </FilterField>

          <FilterField label="Item no PNCP" className="xl:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={itemBusca}
                onChange={(event) => {
                  setItemBusca(event.target.value);
                  resetPage();
                }}
                className="pl-9"
                aria-label="Item no PNCP"
                placeholder="Ex.: notebook, cadeira, manutenção"
              />
            </div>
          </FilterField>

          <FilterField label="Busca na lista" className="xl:col-span-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                className="pl-9"
                aria-label="Busca geral"
                placeholder="Número, processo ou unidade"
              />
            </div>
          </FilterField>

          <FilterField label="Situação" className="xl:col-span-3">
            <Select
              value={situacao}
              onValueChange={(value) => {
                setSituacao(value);
                resetPage();
              }}
            >
              <SelectTrigger aria-label="Situação">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                {situacoes.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Prazo de propostas" className="xl:col-span-3">
            <Select
              value={proposalStatus}
              onValueChange={(value) => {
                setProposalStatus(value as LicitacaoPncpProposalStatus);
                resetPage();
              }}
            >
              <SelectTrigger aria-label="Prazo de propostas">
                <SelectValue placeholder="Propostas" />
              </SelectTrigger>
              <SelectContent>
                {proposalOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Registro de preços" className="xl:col-span-2">
            <Select
              value={srp}
              onValueChange={(value) => {
                setSrp(value as LicitacaoPncpSrpFilter);
                resetPage();
              }}
            >
              <SelectTrigger aria-label="Registro de preços">
                <SelectValue placeholder="SRP" />
              </SelectTrigger>
              <SelectContent>
                {srpOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Publicada a partir de" className="xl:col-span-2">
            <Input
              type="date"
              value={dataInicial}
              onChange={(event) => {
                setDataInicial(event.target.value);
                resetPage();
              }}
              aria-label="Data inicial"
            />
          </FilterField>
          <FilterField label="Publicada até" className="xl:col-span-2">
            <Input
              type="date"
              value={dataFinal}
              onChange={(event) => {
                setDataFinal(event.target.value);
                resetPage();
              }}
              aria-label="Data final"
            />
          </FilterField>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-default/60 pt-4">
          <p className="font-ui text-xs text-text-secondary">
            Sem UASG informada, a busca consulta todas as unidades do IFRN publicadas no PNCP. Para pesquisar por item, use Buscar no PNCP para carregar os itens no cache local.
          </p>
          <Button type="button" className="gap-2" onClick={() => void handleManualSync()} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Buscar no PNCP
          </Button>
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
