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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DEFAULT_PNCP_UASG, DEFAULT_PNCP_UASGS } from '@/lib/licitacoesPncp';
import {
  atasRegistroPrecosService,
  type AtaRegistroPrecoRow,
  type AtasRegistroPrecosSyncResult,
  type AtaRegistroPrecoVinculoFilter,
} from '@/services/atasRegistroPrecos';

const vinculoOptions: Array<{ value: AtaRegistroPrecoVinculoFilter; label: string }> = [
  { value: 'qualquer-vinculo', label: 'Qualquer vínculo' },
  { value: 'gerenciadora', label: 'Gerenciadora' },
  { value: 'participante', label: 'Participante' },
  { value: 'aderente', label: 'Aderente' },
  { value: 'todos', label: 'Todas as atas' },
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

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatUasg(codigo?: string | null, nome?: string | null) {
  if (!codigo) return '-';
  return `${codigo}${nome ? ` - ${nome}` : ''}`;
}

function rawString(row: AtaRegistroPrecoRow, keys: string[]) {
  for (const key of keys) {
    const value = row.rawData[key];
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function rawNumber(row: AtaRegistroPrecoRow, keys: string[]) {
  const value = rawString(row, keys);
  if (!value) return null;
  const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : null;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function participantesLabel(count: number) {
  return `${count} ${count === 1 ? 'participante' : 'participantes'}`;
}

function ParticipantesBadge({ row }: { row: AtaRegistroPrecoRow }) {
  if (row.totalUnidadesParticipantes <= 0) return null;

  const participantes = row.unidadesParticipantes;
  const label = participantesLabel(row.totalUnidadesParticipantes);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" tabIndex={0} aria-label={`Ver ${label}`} className="cursor-help">
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-sm">
          <div className="space-y-1">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em]">Participantes</p>
            <ul className="max-h-56 space-y-0.5 overflow-y-auto text-xs">
              {participantes.map((participante) => (
                <li key={participante}>UASG {participante}</li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function vinculoBadges(row: AtaRegistroPrecoRow, uasgCodigo: string) {
  const normalized = uasgCodigo.replace(/\D/g, '');
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.unidadeGerenciadoraCodigo === normalized ? <Badge variant="secondary">Gerenciadora</Badge> : null}
      {row.unidadesParticipantes.includes(normalized) ? <Badge variant="outline">Participante</Badge> : null}
      {row.unidadesAderentes.includes(normalized) ? <Badge variant="outline">Aderente</Badge> : null}
      <ParticipantesBadge row={row} />
      {row.totalAdesoes > 0 ? <Badge variant="outline">{row.totalAdesoes} adesão</Badge> : null}
      {row.totalItens === 0 ? <Badge variant="secondary">Itens não carregados</Badge> : null}
    </div>
  );
}

function getSyncWarningMessage(result: AtasRegistroPrecosSyncResult) {
  const failedScopes = result.errors?.length ?? 0;
  if (result.status === 'error') {
    return failedScopes > 0
      ? `Compras.gov.br não concluiu a consulta agora (${failedScopes} escopo(s) com falha). A lista permanece com dados já materializados.`
      : 'Compras.gov.br não concluiu a consulta agora. A lista permanece com dados já materializados.';
  }

  return `Sincronização parcial: ${result.upserted} registro(s) materializado(s).`;
}

function getSyncThrownWarningMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('failed to fetch')
    || normalized.includes('network')
    || normalized.includes('internet_disconnected')
    || normalized.includes('network_changed')
    || normalized.includes('504')
    || normalized.includes('gateway timeout')
  ) {
    return 'Não foi possível conectar ao Supabase agora. Verifique a conexão e tente novamente.';
  }

  if (
    normalized.includes('dadosabertos.compras.gov.br')
    || normalized.includes('could not open jpa entitymanager')
    || normalized.includes('falha ao sincronizar arp')
  ) {
    return 'Compras.gov.br não concluiu a consulta agora. A lista permanece com dados já materializados.';
  }

  return null;
}

function isInternalUasg(uasgCodigo: string) {
  const normalized = uasgCodigo.replace(/\D/g, '');
  return DEFAULT_PNCP_UASGS.includes(normalized);
}

function AtasDetailsSheet({
  ata,
  onOpenChange,
}: {
  ata: AtaRegistroPrecoRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [isSyncingDetails, setIsSyncingDetails] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ['atas-registro-precos-itens', ata?.ataKey],
    queryFn: () => atasRegistroPrecosService.listItems(ata?.ataKey ?? ''),
    enabled: Boolean(ata?.ataKey),
    staleTime: 60000,
  });

  const handleSyncDetails = async () => {
    if (!ata) return;
    const detailDate = dateOnly(ata.dataVigenciaInicial) ?? dateOnly(ata.dataAssinatura) ?? toDateInputValue(new Date());
    setIsSyncingDetails(true);
    try {
      const result = await atasRegistroPrecosService.sync({
        unidadeCodigos: [ata.unidadeGerenciadoraCodigo],
        dataInicial: detailDate,
        dataFinal: detailDate,
        numeroAta: ata.numeroAta,
        includeDetalhes: true,
        source: 'frontend-detail',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['atas-registro-precos-itens', ata.ataKey] }),
        queryClient.invalidateQueries({ queryKey: ['atas-registro-precos'] }),
      ]);
      if (result.status === 'partial_success' || result.status === 'error') {
        toast.warning(getSyncWarningMessage(result));
      } else {
        toast.success(`${result.upserted} detalhe(s) materializado(s).`);
      }
    } catch (error) {
      const warningMessage = getSyncThrownWarningMessage(error);
      if (warningMessage) {
        toast.warning(warningMessage);
      } else {
        toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar os detalhes da ata.');
      }
    } finally {
      setIsSyncingDetails(false);
    }
  };

  return (
    <Sheet open={Boolean(ata)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        {ata ? (
          <div className="space-y-5">
            <SheetHeader className="pr-8">
              <SheetTitle>Ata {ata.numeroAta}</SheetTitle>
              <SheetDescription>{formatUasg(ata.unidadeGerenciadoraCodigo, ata.unidadeGerenciadoraNome)}</SheetDescription>
            </SheetHeader>

            <div className="space-y-2">
              <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Objeto</p>
              <p className="font-ui text-sm leading-6 text-text-primary">{ata.objeto || '-'}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Vigência</p>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">
                  {formatDate(ata.dataVigenciaInicial)} até {formatDate(ata.dataVigenciaFinal)}
                </p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Compra</p>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">
                  {ata.numeroCompra || '-'}{ata.anoCompra ? `/${ata.anoCompra}` : ''}
                </p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Participantes</p>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{ata.totalUnidadesParticipantes}</p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Adesões</p>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{ata.totalAdesoes}</p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Valor total</p>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{formatCurrency(rawNumber(ata, ['valorTotal', 'valor_total']))}</p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Situacao</p>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">{rawString(ata, ['statusAta', 'situacao', 'status']) ?? '-'}</p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3 sm:col-span-2">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Controle PNCP</p>
                <p className="mt-1 break-all font-mono text-xs font-semibold text-text-primary">
                  {rawString(ata, ['numeroControlePncpAta', 'numeroControlePNCPAta', 'numeroControlePncp']) ?? '-'}
                </p>
              </div>
            </div>

            <DataTablePanel title="Itens" description={`${items.length} item(ns) materializado(s)`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-text-secondary">
                  {items.length === 0 ? 'Os itens podem ser carregados sob demanda para evitar timeout na busca geral.' : 'Itens materializados no cache local.'}
                </p>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void handleSyncDetails()} disabled={isSyncingDetails}>
                  {isSyncingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  Atualizar detalhes
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="py-8 text-center text-sm text-text-secondary">Nenhum item materializado.</div>
                      </TableCell>
                    </TableRow>
                  ) : items.map((item) => (
                    <TableRow key={item.itemKey}>
                      <TableCell className="font-mono text-xs">{item.numeroItem}</TableCell>
                      <TableCell className="max-w-md text-sm">{item.descricaoItem || '-'}</TableCell>
                      <TableCell className="text-sm">{item.fornecedorNome || item.fornecedorNi || '-'}</TableCell>
                      <TableCell className="text-right text-sm font-semibold">{formatCurrency(item.valorTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataTablePanel>

            <Button type="button" variant="outline" className="gap-2" asChild>
              <a href={rawString(ata, ['linkAtaPNCP', 'linkCompraPNCP']) ?? 'https://dadosabertos.compras.gov.br/swagger-ui/index.html'} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Abrir fonte
              </a>
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function AtasRegistroPrecos() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [uasgCodigo, setUasgCodigo] = useState(DEFAULT_PNCP_UASG);
  const [vinculo, setVinculo] = useState<AtaRegistroPrecoVinculoFilter>('qualquer-vinculo');
  const [search, setSearch] = useState('');
  const [dataInicial, setDataInicial] = useState(getDefaultStartDate);
  const [dataFinal, setDataFinal] = useState(toDateInputValue(new Date()));
  const [selectedAta, setSelectedAta] = useState<AtaRegistroPrecoRow | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    uasgCodigo,
    vinculo,
    search,
    dataInicial,
    dataFinal,
  }), [dataFinal, dataInicial, page, pageSize, search, uasgCodigo, vinculo]);

  const { data: listResult = { rows: [], count: 0 }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['atas-registro-precos', queryParams],
    queryFn: () => atasRegistroPrecosService.list(queryParams),
    staleTime: 30000,
  });

  const totalPages = Math.max(1, Math.ceil(listResult.count / pageSize));
  const currentRows = listResult.rows;
  const totalAdesoes = currentRows.reduce((sum, row) => sum + row.totalAdesoes, 0);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['atas-registro-precos'] });
  };

  const reloadCachedRows = async () => {
    await invalidate();
    await refetch();
  };

  const handleSync = async (internal = false) => {
    setIsSyncing(true);
    try {
      const shouldSearchParticipantCache = vinculo === 'participante' && isInternalUasg(uasgCodigo);
      const shouldSearchAdesaoCache = vinculo === 'aderente' && isInternalUasg(uasgCodigo);
      const result = internal || shouldSearchParticipantCache || shouldSearchAdesaoCache
        ? await atasRegistroPrecosService.syncInternalUasgs({
          dataInicial,
          dataFinal,
          objetoBusca: search,
          includeParticipantes: shouldSearchParticipantCache,
          includeAdesoes: shouldSearchAdesaoCache,
          adesaoUnidadeCodigos: shouldSearchAdesaoCache ? [uasgCodigo] : undefined,
          source: shouldSearchParticipantCache
            ? 'frontend-participante-cache'
            : shouldSearchAdesaoCache
              ? 'frontend-aderente-cache'
              : 'frontend-ifrn-cache',
        })
        : await atasRegistroPrecosService.sync({
          unidadeCodigos: [uasgCodigo],
          dataInicial,
          dataFinal,
          objetoBusca: search,
          includeDetalhes: false,
          includeParticipantes: vinculo === 'participante',
          includeAdesoes: vinculo === 'aderente',
          source: 'frontend-search',
        });

      await reloadCachedRows();
      if (result.status === 'partial_success' || result.status === 'error') {
        toast.warning(getSyncWarningMessage(result));
      } else {
        toast.success(`${result.upserted} registro(s) materializado(s).`);
      }
    } catch (error) {
      await reloadCachedRows();
      const warningMessage = getSyncThrownWarningMessage(error);
      if (warningMessage) {
        toast.warning(warningMessage);
      } else {
        toast.error(error instanceof Error ? error.message : 'Não foi possível sincronizar as atas.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        <span>Licitações / Atas e ARP</span>
      </HeaderSubtitle>
      <HeaderActions>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar lista
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handleSync(true)} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Sincronizar UASGs IFRN
          </Button>
        </div>
      </HeaderActions>

      <FilterPanel>
        <div className="grid gap-3 xl:grid-cols-[140px_180px_150px_150px_minmax(220px,1fr)_160px]">
          <FilterField label="UASG">
            <Input
              value={uasgCodigo}
              onChange={(event) => {
                setUasgCodigo(event.target.value.replace(/\D/g, '').slice(0, 6));
                setPage(1);
              }}
              inputMode="numeric"
              aria-label="UASG"
              placeholder="158366"
            />
          </FilterField>
          <FilterField label="Vínculo">
            <Select
              value={vinculo}
              onValueChange={(value) => {
                setVinculo(value as AtaRegistroPrecoVinculoFilter);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vínculo" />
              </SelectTrigger>
              <SelectContent>
                {vinculoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Data inicial">
            <Input type="date" value={dataInicial} onChange={(event) => { setDataInicial(event.target.value); setPage(1); }} aria-label="Data inicial" />
          </FilterField>
          <FilterField label="Data final">
            <Input type="date" value={dataFinal} onChange={(event) => { setDataFinal(event.target.value); setPage(1); }} aria-label="Data final" />
          </FilterField>
          <FilterField label="Busca">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
                aria-label="Busca"
                placeholder="Ata, compra, objeto, item ou fornecedor"
              />
            </div>
          </FilterField>
          <div className="flex items-end">
            <Button type="button" className="w-full gap-2" onClick={() => void handleSync()} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Buscar ARP
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          A busca por item ou fornecedor considera os detalhes já carregados. Abra uma ata e use "Atualizar detalhes" para ampliar a pesquisa local.
        </p>
      </FilterPanel>

      <DataTablePanel title="Lista de atas" description={`${listResult.count} registro(s) no filtro atual`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ata</TableHead>
              <TableHead>Objeto</TableHead>
              <TableHead>Gerenciadora</TableHead>
              <TableHead>Vigência</TableHead>
              <TableHead>Vínculos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando atas...
                  </div>
                </TableCell>
              </TableRow>
            ) : currentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="py-10 text-center text-sm text-text-secondary">Nenhuma ata encontrada.</div>
                </TableCell>
              </TableRow>
            ) : currentRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="min-w-[160px]">
                  <p className="font-mono text-xs font-semibold text-text-primary">{row.numeroAta}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{row.numeroCompra || '-'}{row.anoCompra ? `/${row.anoCompra}` : ''}</p>
                </TableCell>
                <TableCell className="max-w-xl">
                  <p className="line-clamp-3 text-sm text-text-primary">{row.objeto || '-'}</p>
                  {row.itemCorrespondente ? (
                    <div className="mt-2 rounded-radius-md border border-primary/15 bg-primary/[0.04] px-2.5 py-2">
                      <Badge variant="outline" className="mb-1 border-primary/20 bg-primary/[0.08] text-primary">
                        Encontrado em item
                      </Badge>
                      <p className="text-xs font-medium text-text-primary">
                        Item {row.itemCorrespondente.numeroItem}: {row.itemCorrespondente.descricaoItem || row.itemCorrespondente.codigoItem || '-'}
                      </p>
                      {row.itemCorrespondente.fornecedorNome || row.itemCorrespondente.fornecedorNi ? (
                        <p className="mt-0.5 text-xs text-text-secondary">
                          {row.itemCorrespondente.fornecedorNome || row.itemCorrespondente.fornecedorNi}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="min-w-[180px] text-sm">{formatUasg(row.unidadeGerenciadoraCodigo, row.unidadeGerenciadoraNome)}</TableCell>
                <TableCell className="min-w-[150px] text-sm">
                  <p>{formatDate(row.dataVigenciaInicial)}</p>
                  <p className="text-xs text-text-secondary">até {formatDate(row.dataVigenciaFinal)}</p>
                </TableCell>
                <TableCell className="min-w-[190px]">{vinculoBadges(row, uasgCodigo)}</TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedAta(row)}>
                    Detalhar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={listResult.count}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </DataTablePanel>

      <AtasDetailsSheet ata={selectedAta} onOpenChange={(open) => !open && setSelectedAta(null)} />
    </div>
  );
}
