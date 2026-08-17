import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
import { supabase } from '@/lib/supabase';
import { DEFAULT_PNCP_UASG, DEFAULT_PNCP_UASGS, IFRN_UASG_CATALOG } from '@/lib/licitacoesPncp';
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
  const found = IFRN_UASG_CATALOG.find((u) => u.codigo === codigo);
  const displayName = nome || found?.nome;
  return `${codigo}${displayName ? ` - ${displayName}` : ''}`;
}

export function getVigenciaInfo(dataVigenciaFinal?: string | null) {
  if (!dataVigenciaFinal) return { status: 'desconhecido', label: '-', badgeClass: 'bg-muted text-muted-foreground', diffDays: 0 };
  const fim = new Date(dataVigenciaFinal);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffMs = fim.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expirada',
      label: 'Expirada',
      detail: `Venceu há ${Math.abs(diffDays)} dia(s)`,
      badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
      diffDays,
    };
  }
  if (diffDays <= 60) {
    return {
      status: 'vencendo',
      label: `Vence em ${diffDays}d`,
      detail: `Atenção: faltam ${diffDays} dias para expirar`,
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium',
      diffDays,
    };
  }
  return {
    status: 'vigente',
    label: `Vigente (${diffDays}d)`,
    detail: `Vigente por mais ${diffDays} dias`,
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium',
    diffDays,
  };
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
              {participantes.map((participante) => {
                const catalogMatch = IFRN_UASG_CATALOG.find((u) => u.codigo === participante);
                return (
                  <li key={participante}>
                    UASG {participante} {catalogMatch ? `(${catalogMatch.nome})` : ''}
                  </li>
                );
              })}
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

  const { data: executionData = { itemCommittedMap: new Map<string, number>(), totalEmpenhado: 0, contratos: [] } } = useQuery({
    queryKey: ['atas-execution-balances', ata?.numeroCompra, ata?.anoCompra, ata?.numeroAta],
    queryFn: async () => {
      if (!ata) return { itemCommittedMap: new Map<string, number>(), totalEmpenhado: 0, contratos: [] };
      const numClean = ata.numeroCompra ? String(ata.numeroCompra).replace(/\D/g, '') : '';
      const padded5 = numClean.padStart(5, '0');
      const ano = String(ata.anoCompra || '');
      const numAta = String(ata.numeroAta || '').trim();

      const { data: dbContratos } = await supabase
        .from('contratos_api')
        .select('id, api_contrato_id, numero, fornecedor_nome, processo, valor_global, raw_data');

      const matchedContratos = (dbContratos || []).filter((c) => {
        const licNum = String(c.raw_data?.licitacao_numero || '').trim();
        const infoComp = String(c.raw_data?.informacao_complementar || '');
        if (numClean && ano) {
          if (licNum === `${numClean}/${ano}` || licNum === `${padded5}/${ano}` || licNum.includes(`${numClean}/${ano}`) || licNum.includes(`${padded5}/${ano}`)) {
            return true;
          }
          if (infoComp.includes(`${padded5}${ano}`) || infoComp.includes(`${numClean}${ano}`)) {
            return true;
          }
        }
        if (numAta && (licNum.includes(numAta) || infoComp.includes(numAta))) {
          return true;
        }
        return false;
      });

      const contratoIds = matchedContratos.map((c) => c.id);
      const itemMap = new Map<string, number>();
      let totalEmp = 0;

      if (contratoIds.length > 0) {
        const { data: cItens } = await supabase
          .from('contratos_api_itens')
          .select('contrato_api_id, numero_item_compra, valor_total')
          .in('contrato_api_id', contratoIds);

        if (Array.isArray(cItens)) {
          cItens.forEach((ci) => {
            const num = String(Number(ci.numero_item_compra || '0'));
            const val = Number(ci.valor_total) || 0;
            if (num && val > 0) {
              itemMap.set(num, (itemMap.get(num) || 0) + val);
              totalEmp += val;
            }
          });
        }
      }

      return { itemCommittedMap: itemMap, totalEmpenhado: totalEmp, contratos: matchedContratos };
    },
    enabled: Boolean(ata),
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

  const vigenciaInfo = getVigenciaInfo(ata?.dataVigenciaFinal);
  const valorTotalAta = ata ? (rawNumber(ata, ['valorTotal', 'valor_total']) || items.reduce((acc, it) => acc + (it.valorTotal || 0), 0)) : 0;
  const saldoGeralAta = Math.max(0, valorTotalAta - executionData.totalEmpenhado);
  const percentualConsumidoGeral = valorTotalAta > 0 ? Math.min(100, Math.round((executionData.totalEmpenhado / valorTotalAta) * 100)) : 0;

  const linkAtaPncp = ata ? rawString(ata, ['linkAtaPNCP', 'linkCompraPNCP']) : null;

  return (
    <Sheet open={Boolean(ata)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        {ata ? (
          <div className="space-y-6">
            <SheetHeader className="pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl">Ata {ata.numeroAta}</SheetTitle>
                <Badge variant="outline" className={vigenciaInfo.badgeClass}>
                  {vigenciaInfo.label}
                </Badge>
              </div>
              <SheetDescription className="text-sm">{formatUasg(ata.unidadeGerenciadoraCodigo, ata.unidadeGerenciadoraNome)}</SheetDescription>
            </SheetHeader>

            <div className="rounded-radius-md border border-border-default bg-surface-subtle/40 p-3.5 space-y-1.5">
              <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Objeto da Ata</p>
              <p className="font-ui text-sm leading-relaxed text-text-primary">{ata.objeto || '-'}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Valor Homologado</p>
                <p className="mt-1 font-mono text-base font-bold text-text-primary">{formatCurrency(valorTotalAta)}</p>
                <p className="text-[11px] text-text-secondary">Total registrado na ata</p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Já Empenhado</p>
                <p className="mt-1 font-mono text-base font-bold text-text-primary">
                  {formatCurrency(executionData.totalEmpenhado)}
                </p>
                <p className="text-[11px] text-text-secondary">{percentualConsumidoGeral}% consumido</p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Saldo Disponível</p>
                <p className="mt-1 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(saldoGeralAta)}
                </p>
                <p className="text-[11px] text-text-secondary">Disponível para pedidos</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-text-muted" />
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Vigência da Ata</p>
                </div>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">
                  {formatDate(ata.dataVigenciaInicial)} até {formatDate(ata.dataVigenciaFinal)}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">{vigenciaInfo.detail}</p>
              </div>
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-text-muted" />
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Compra / Pregão de Origem</p>
                </div>
                <p className="mt-1 font-ui text-sm font-semibold text-text-primary">
                  {ata.numeroCompra || '-'}{ata.anoCompra ? `/${ata.anoCompra}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">{ata.modalidadeNome || 'Pregão Eletrônico'}</p>
              </div>
            </div>

            <div className="rounded-radius-md border border-border-default bg-surface-subtle/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h4 className="font-ui text-xs font-semibold uppercase tracking-[0.12em] text-text-primary">
                    Participantes e Adesões (Lei 14.133/2021)
                  </h4>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{ata.totalUnidadesParticipantes} participante(s)</Badge>
                  <Badge variant="outline">{ata.totalAdesoes} carona(s)</Badge>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <p className="font-semibold text-text-muted mb-1">Órgãos / Campi Participantes:</p>
                  {ata.unidadesParticipantes.length > 0 ? (
                    <ul className="space-y-1">
                      {ata.unidadesParticipantes.map((u) => {
                        const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === u);
                        return (
                          <li key={u} className="flex items-center gap-1.5 text-text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            UASG {u} — {cat?.nome || 'Órgão Participante'}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-text-secondary">Nenhum participante registrado além da gerenciadora.</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-text-muted mb-1">Órgãos Aderentes (Caronas):</p>
                  {ata.unidadesAderentes.length > 0 ? (
                    <ul className="space-y-1">
                      {ata.unidadesAderentes.map((u) => {
                        const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === u);
                        return (
                          <li key={u} className="flex items-center gap-1.5 text-text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            UASG {u} — {cat?.nome || 'Órgão Aderente'}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-text-secondary">Nenhuma adesão registrada até o momento.</p>
                  )}
                </div>
              </div>
            </div>

            <DataTablePanel title="Itens e Saldos da Ata" description={`${items.length} item(ns) materializado(s)`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-text-secondary">
                  {items.length === 0 ? 'Os itens podem ser carregados sob demanda para evitar timeout na busca geral.' : 'Saldos cruzados com o Comprasnet Contratos e SIAFI.'}
                </p>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void handleSyncDetails()} disabled={isSyncingDetails}>
                  {isSyncingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                  Atualizar detalhes
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Item</TableHead>
                    <TableHead>Descrição & Fornecedor</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Valor Homologado</TableHead>
                    <TableHead className="text-right">Já Empenhado</TableHead>
                    <TableHead className="text-right">Saldo Restante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="py-8 text-center text-sm text-text-secondary">Nenhum item materializado.</div>
                      </TableCell>
                    </TableRow>
                  ) : items.map((item) => {
                    const itemNum = String(Number(item.numeroItem || '0'));
                    const itemHomologado = item.valorTotal || ((item.quantidadeHomologada || 0) * (item.valorUnitario || 0)) || 0;
                    const itemEmpenhado = executionData.itemCommittedMap.get(itemNum) || 0;
                    const itemSaldo = Math.max(0, itemHomologado - itemEmpenhado);
                    const itemPercent = itemHomologado > 0 ? Math.min(100, Math.round((itemEmpenhado / itemHomologado) * 100)) : 0;

                    let progressColor = 'bg-emerald-500';
                    if (itemPercent >= 90) progressColor = 'bg-destructive';
                    else if (itemPercent >= 70) progressColor = 'bg-amber-500';

                    return (
                      <TableRow key={item.itemKey}>
                        <TableCell className="font-mono text-xs font-bold">{item.numeroItem}</TableCell>
                        <TableCell className="max-w-xs">
                          <p className="text-xs font-medium text-text-primary line-clamp-2">{item.descricaoItem || '-'}</p>
                          <p className="mt-0.5 text-[11px] text-text-secondary truncate">
                            {item.fornecedorNome || item.fornecedorNi || '-'}
                          </p>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">{item.quantidadeHomologada ?? '-'}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold">{formatCurrency(itemHomologado)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          <span className="font-semibold text-text-primary">{formatCurrency(itemEmpenhado)}</span>
                          <div className="mt-1 w-full bg-surface-subtle rounded-full h-1.5 overflow-hidden">
                            <div className={`h-full ${progressColor}`} style={{ width: `${itemPercent}%` }} />
                          </div>
                          <span className="text-[10px] text-text-secondary">{itemPercent}%</span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(itemSaldo)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataTablePanel>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-default">
              {linkAtaPncp ? (
                <Button type="button" variant="default" className="gap-2" asChild>
                  <a href={linkAtaPncp} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir Ata Oficial no PNCP
                  </a>
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="gap-2" asChild>
                <a href={rawString(ata, ['linkCompraPNCP']) ?? 'https://dadosabertos.compras.gov.br/swagger-ui/index.html'} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Ver Processo de Compra
                </a>
              </Button>
            </div>
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
  const [apenasVigentes, setApenasVigentes] = useState(false);
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
    apenasVigentes,
  }), [apenasVigentes, dataFinal, dataInicial, page, pageSize, search, uasgCodigo, vinculo]);

  const { data: listResult = { rows: [], count: 0 }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['atas-registro-precos', queryParams],
    queryFn: () => atasRegistroPrecosService.list(queryParams),
    staleTime: 30000,
  });

  const totalPages = Math.max(1, Math.ceil(listResult.count / pageSize));
  const currentRows = listResult.rows;

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
        <div className="grid gap-3 xl:grid-cols-[130px_170px_140px_140px_minmax(200px,1fr)_130px_140px]">
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
          <FilterField label="Vigência">
            <Button
              type="button"
              variant={apenasVigentes ? 'default' : 'outline'}
              className="w-full text-xs font-semibold"
              onClick={() => {
                setApenasVigentes(!apenasVigentes);
                setPage(1);
              }}
            >
              {apenasVigentes ? 'Apenas vigentes' : 'Todas as vigências'}
            </Button>
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
              <TableHead>Ata / Compra</TableHead>
              <TableHead>Objeto</TableHead>
              <TableHead>Gerenciadora</TableHead>
              <TableHead>Vigência & Status</TableHead>
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
            ) : currentRows.map((row) => {
              const vigencia = getVigenciaInfo(row.dataVigenciaFinal);
              return (
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
                  <TableCell className="min-w-[170px] text-sm">
                    <div className="space-y-1">
                      <Badge variant="outline" className={vigencia.badgeClass}>
                        {vigencia.label}
                      </Badge>
                      <p className="text-xs text-text-secondary">
                        {formatDate(row.dataVigenciaInicial)} até {formatDate(row.dataVigenciaFinal)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[190px]">{vinculoBadges(row, uasgCodigo)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedAta(row)}>
                      Detalhar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
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
