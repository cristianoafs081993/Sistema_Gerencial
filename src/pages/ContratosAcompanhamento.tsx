import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useData } from '@/contexts/DataContext';
import {
  contratosApiService,
  ContratoApiFaturaRow,
} from '@/services/contratosApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeaderActions } from '@/components/HeaderParts';
import { StatCard } from '@/components/StatCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

type RowStatus = 'ok' | 'divergente' | 'sem_contrato_local' | 'nao_encontrado_api';

interface ContractRow {
  id: string;
  numero: string;
  fornecedor: string;
  vigenciaInicio: string | null;
  vigenciaFim: string | null;
  apiEmpenhos: string[];
  localEmpenhos: string[];
  faltandoLocal: string[];
  sobrandoLocal: string[];
  apiSaldo: number;
  localSaldo: number;
  diffSaldo: number;
  status: RowStatus;
}

function isDateVigente(dateIso?: string | null) {
  if (!dateIso) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateIso}T00:00:00`);
  return !Number.isNaN(d.getTime()) && d >= today;
}

function getRapSaldo(rapALiquidar?: number, saldoRapOficial?: number) {
  const aLiq = rapALiquidar || 0;
  if (aLiq > 0) return aLiq;
  return saldoRapOficial || 0;
}

function formatDate(iso?: string | null) {
  if (!iso) return '-';
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(date);
}

export default function ContratosAcompanhamento() {
  const queryClient = useQueryClient();
  const { contratos, contratosEmpenhos, empenhos } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RowStatus>('all');
  const [selectedRow, setSelectedRow] = useState<ContractRow | null>(null);

  const contratosApiQuery = useQuery({
    queryKey: ['contratos-api-module'],
    queryFn: () => contratosApiService.getContratosApi(true),
    retry: false,
  });

  const contractApiIds = useMemo(
    () => (contratosApiQuery.data ?? []).map((item) => item.id),
    [contratosApiQuery.data]
  );

  const empenhosApiQuery = useQuery({
    queryKey: ['contratos-api-module', 'empenhos', contractApiIds],
    queryFn: () => contratosApiService.getEmpenhosApi(contractApiIds),
    enabled: contractApiIds.length > 0,
    retry: false,
  });

  const faturasApiQuery = useQuery({
    queryKey: ['contratos-api-module', 'faturas', contractApiIds],
    queryFn: () => contratosApiService.getFaturasApi(contractApiIds),
    enabled: contractApiIds.length > 0,
    retry: false,
  });

  const lastSyncQuery = useQuery({
    queryKey: ['contratos-api-module', 'last-sync'],
    queryFn: () => contratosApiService.getLastSyncRun('158366'),
    retry: false,
  });

  const migrationRequired =
    [contratosApiQuery.error, empenhosApiQuery.error, faturasApiQuery.error, lastSyncQuery.error]
      .filter(Boolean)
      .some((error) => String(error).includes('MIGRATION_REQUIRED'));

  const syncMutation = useMutation({
    mutationFn: () => contratosApiService.runSync('158366'),
    onSuccess: async (stats) => {
      toast.success(
        `Sincronização concluída: ${stats.contratos_upserted} contratos, ${stats.empenhos_upserted} empenhos e ${stats.faturas_upserted} faturas.`
      );
      await queryClient.invalidateQueries({ queryKey: ['contratos-api-module'] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro na sincronização: ${message}`);
    },
  });

  const faturasByContrato = useMemo(() => {
    const map = new Map<string, ContratoApiFaturaRow[]>();
    for (const f of faturasApiQuery.data ?? []) {
      const prev = map.get(f.contrato_api_id) ?? [];
      prev.push(f);
      map.set(f.contrato_api_id, prev);
    }
    return map;
  }, [faturasApiQuery.data]);

  const rows = useMemo<ContractRow[]>(() => {
    const contratosApi = contratosApiQuery.data ?? [];
    const empenhosApi = empenhosApiQuery.data ?? [];

    const localContractByNumero = new Map(contratos.map((c) => [c.numero, c]));
    const localEmpenhoById = new Map(empenhos.map((e) => [e.id, e]));
    const localLinksByContratoId = new Map<string, string[]>();

    for (const link of contratosEmpenhos) {
      const prev = localLinksByContratoId.get(link.contrato_id) ?? [];
      prev.push(link.empenho_id);
      localLinksByContratoId.set(link.contrato_id, prev);
    }

    const apiEmpenhosByContrato = new Map<string, string[]>();
    const apiSaldoByContrato = new Map<string, number>();
    for (const emp of empenhosApi) {
      const prev = apiEmpenhosByContrato.get(emp.contrato_api_id) ?? [];
      prev.push(emp.numero);
      apiEmpenhosByContrato.set(emp.contrato_api_id, prev);
      apiSaldoByContrato.set(
        emp.contrato_api_id,
        (apiSaldoByContrato.get(emp.contrato_api_id) ?? 0) + Number(emp.valor_a_liquidar ?? 0)
      );
    }

    const mappedRows: ContractRow[] = contratosApi.map((apiContract) => {
      const localContract = localContractByNumero.get(apiContract.numero);
      const localEmpenhoRefs = localContract
        ? localLinksByContratoId.get(localContract.id) ?? []
        : [];

      const localEmpenhoNumeros = Array.from(
        new Set(
          localEmpenhoRefs
            .map((id) => localEmpenhoById.get(id))
            .filter(Boolean)
            .map((e) => (e?.numero ?? '').trim())
            .filter(Boolean)
        )
      );

      const localSaldo = localEmpenhoRefs.reduce((sum, id) => {
        const e = localEmpenhoById.get(id);
        if (!e) return sum;
        if (e.tipo === 'rap') return sum + getRapSaldo(e.rapALiquidar, e.saldoRapOficial);
        const liquidado = (e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0);
        return sum + Math.max(0, e.valor - liquidado);
      }, 0);

      const apiEmpenhoNums = Array.from(new Set(apiEmpenhosByContrato.get(apiContract.id) ?? []));
      const apiSet = new Set(apiEmpenhoNums.map((n) => n.toUpperCase()));
      const localSet = new Set(localEmpenhoNumeros.map((n) => n.toUpperCase()));

      const faltandoLocal = apiEmpenhoNums.filter((num) => !localSet.has(num.toUpperCase()));
      const sobrandoLocal = localEmpenhoNumeros.filter((num) => !apiSet.has(num.toUpperCase()));
      const apiSaldo = Number(apiSaldoByContrato.get(apiContract.id) ?? 0);
      const diffSaldo = Number((localSaldo - apiSaldo).toFixed(2));

      let status: RowStatus = 'ok';
      if (!localContract) status = 'sem_contrato_local';
      else if (faltandoLocal.length > 0 || sobrandoLocal.length > 0 || Math.abs(diffSaldo) > 1) {
        status = 'divergente';
      }

      return {
        id: apiContract.id,
        numero: apiContract.numero,
        fornecedor: apiContract.fornecedor_nome ?? '-',
        vigenciaInicio: apiContract.vigencia_inicio,
        vigenciaFim: apiContract.vigencia_fim,
        apiEmpenhos: apiEmpenhoNums,
        localEmpenhos: localEmpenhoNumeros,
        faltandoLocal,
        sobrandoLocal,
        apiSaldo,
        localSaldo,
        diffSaldo,
        status,
      };
    });

    for (const local of contratos) {
      if (contratosApi.some((api) => api.numero === local.numero)) continue;
      if (!isDateVigente(local.data_termino ? new Date(local.data_termino).toISOString().slice(0, 10) : null)) continue;
      const localEmpenhoRefs = localLinksByContratoId.get(local.id) ?? [];
      const localEmpenhoNumeros = Array.from(
        new Set(
          localEmpenhoRefs
            .map((id) => localEmpenhoById.get(id))
            .filter(Boolean)
            .map((e) => (e?.numero ?? '').trim())
            .filter(Boolean)
        )
      );
      const localSaldo = localEmpenhoRefs.reduce((sum, id) => {
        const e = localEmpenhoById.get(id);
        if (!e) return sum;
        if (e.tipo === 'rap') return sum + getRapSaldo(e.rapALiquidar, e.saldoRapOficial);
        const liquidado = (e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0);
        return sum + Math.max(0, e.valor - liquidado);
      }, 0);

      const localInicio =
        local.data_inicio && !Number.isNaN(new Date(local.data_inicio).getTime())
          ? new Date(local.data_inicio).toISOString().slice(0, 10)
          : null;
      const localFim =
        local.data_termino && !Number.isNaN(new Date(local.data_termino).getTime())
          ? new Date(local.data_termino).toISOString().slice(0, 10)
          : null;

      mappedRows.push({
        id: `local-only-${local.id}`,
        numero: local.numero,
        fornecedor: local.contratada,
        vigenciaInicio: localInicio,
        vigenciaFim: localFim,
        apiEmpenhos: [],
        localEmpenhos: localEmpenhoNumeros,
        faltandoLocal: [],
        sobrandoLocal: localEmpenhoNumeros,
        apiSaldo: 0,
        localSaldo,
        diffSaldo: Number(localSaldo.toFixed(2)),
        status: 'nao_encontrado_api',
      });
    }

    return mappedRows;
  }, [contratos, contratosApiQuery.data, contratosEmpenhos, empenhos, empenhosApiQuery.data]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (statusFilter !== 'all' && row.status !== statusFilter) return false;
        if (!query) return true;
        return row.numero.toLowerCase().includes(query) || row.fornecedor.toLowerCase().includes(query);
      })
      .sort((a, b) => Math.abs(b.diffSaldo) - Math.abs(a.diffSaldo));
  }, [rows, search, statusFilter]);

  const totals = useMemo(() => {
    const divergentes = rows.filter((r) => r.status === 'divergente').length;
    const semLocal = rows.filter((r) => r.status === 'sem_contrato_local').length;
    const semApi = rows.filter((r) => r.status === 'nao_encontrado_api').length;
    const saldoApi = rows.reduce((sum, row) => sum + row.apiSaldo, 0);
    const saldoLocal = rows.reduce((sum, row) => sum + row.localSaldo, 0);
    return { divergentes, semLocal, semApi, saldoApi, saldoLocal };
  }, [rows]);

  const loading =
    contratosApiQuery.isLoading || empenhosApiQuery.isLoading || faturasApiQuery.isLoading;

  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        <Button
          variant="outline"
          className="gap-2 h-8 text-xs sm:h-9 sm:text-sm bg-surface-card border-border-default shadow-sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || migrationRequired}
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-action-primary" />
          ) : (
            <RefreshCw className="h-4 w-4 text-action-primary" />
          )}
          Sincronizar via API
        </Button>
      </HeaderActions>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Contratos auditados" value={rows.length} icon={Database} stitchColor="vibrant-blue" />
        <StatCard title="Divergentes" value={totals.divergentes} icon={AlertTriangle} stitchColor="amber" />
        <StatCard title="Sem contrato local/API" value={`${totals.semLocal + totals.semApi}`} icon={AlertTriangle} stitchColor="purple" />
        <StatCard title="Diferença total de saldo" value={formatCurrency(totals.saldoLocal - totals.saldoApi)} icon={CheckCircle2} stitchColor="emerald-green" />
      </div>

      {migrationRequired && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Banco ainda não preparado para o novo módulo</AlertTitle>
          <AlertDescription>
            A migration do módulo novo não foi aplicada no Supabase. Execute a migration
            <span className="font-mono"> 20260331120000_create_contratos_api_monitoramento.sql </span>
            e recarregue a página.
          </AlertDescription>
        </Alert>
      )}

      <Card className="card-system shadow-sm">
        <CardHeader className="pb-3 px-0 pt-0">
          <CardTitle className="text-xl font-bold">Acompanhamento de Contratos via API</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-4">
          <div className="text-sm text-muted-foreground">
            Última sincronização:{' '}
            <span className="font-medium text-foreground">
              {lastSyncQuery.data?.finished_at
                ? new Date(lastSyncQuery.data.finished_at).toLocaleString('pt-BR')
                : 'Nunca'}
            </span>
            {lastSyncQuery.data?.status === 'error' && (
              <span className="ml-2 text-status-error">
                ({lastSyncQuery.data.error_message || 'erro não detalhado'})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contrato ou fornecedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm input-system"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="divergente">Divergente</SelectItem>
                <SelectItem value="sem_contrato_local">Sem contrato local</SelectItem>
                <SelectItem value="nao_encontrado_api">Não encontrado na API</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="card-system shadow-sm overflow-hidden border-none shadow-none">
        <CardHeader className="px-6 py-4 border-b border-border-default/50">
          <CardTitle className="text-base font-semibold">Resultados da Auditoria</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">Contrato</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">Fornecedor</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-center">Empenhos API/Local</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-right">Saldo API</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-right">Saldo Local</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-right">Diferença</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-center">Status</TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-right">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      Carregando auditoria...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                      Nenhum contrato encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/80 transition-colors border-b last:border-0">
                      <TableCell className="py-4 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-semibold text-sm">{row.numero}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(row.vigenciaInicio)} a {formatDate(row.vigenciaFim)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 px-4">
                        <span className="text-sm line-clamp-2">{row.fornecedor || '-'}</span>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-center">
                        <span className="text-sm font-semibold">
                          {row.apiEmpenhos.length} / {row.localEmpenhos.length}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-right text-sm font-semibold text-blue-700">
                        {formatCurrency(row.apiSaldo)}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-right text-sm font-semibold text-emerald-700">
                        {formatCurrency(row.localSaldo)}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-right">
                        <span
                          className={`text-sm font-bold ${
                            Math.abs(row.diffSaldo) > 1 ? 'text-status-error' : 'text-status-success'
                          }`}
                        >
                          {formatCurrency(row.diffSaldo)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-4 text-center">
                        {row.status === 'ok' && <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">OK</Badge>}
                        {row.status === 'divergente' && <Badge className="bg-amber-500/10 text-amber-700 border-amber-200">Divergente</Badge>}
                        {row.status === 'sem_contrato_local' && <Badge className="bg-blue-500/10 text-blue-700 border-blue-200">Sem local</Badge>}
                        {row.status === 'nao_encontrado_api' && <Badge className="bg-slate-200 text-slate-700 border-slate-300">Sem API</Badge>}
                      </TableCell>
                      <TableCell className="py-4 px-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedRow(row)}>
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Contrato {selectedRow?.numero}</DialogTitle>
            <DialogDescription>
              Auditoria de vínculos, saldos e documentos de cobrança do contrato selecionado.
            </DialogDescription>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Saldo API</p>
                    <p className="text-base font-bold text-blue-700">{formatCurrency(selectedRow.apiSaldo)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Saldo Local</p>
                    <p className="text-base font-bold text-emerald-700">{formatCurrency(selectedRow.localSaldo)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Diferença</p>
                    <p
                      className={`text-base font-bold ${
                        Math.abs(selectedRow.diffSaldo) > 1 ? 'text-status-error' : 'text-status-success'
                      }`}
                    >
                      {formatCurrency(selectedRow.diffSaldo)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Empenhos vinculados na API</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {selectedRow.apiEmpenhos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedRow.apiEmpenhos.map((num) => (
                          <Badge key={num} variant="outline" className="font-mono text-xs">
                            {num}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Empenhos faltando no local</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {selectedRow.faltandoLocal.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedRow.faltandoLocal.map((num) => (
                          <Badge key={num} variant="outline" className="font-mono text-xs">
                            {num}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Empenhos sobrando no local</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {selectedRow.sobrandoLocal.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedRow.sobrandoLocal.map((num) => (
                          <Badge key={num} variant="outline" className="font-mono text-xs">
                            {num}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Faturas registradas na API</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {(faturasByContrato.get(selectedRow.id) ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada.</p>
                  ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {(faturasByContrato.get(selectedRow.id) ?? []).map((fatura) => (
                        <div key={fatura.id} className="flex items-center justify-between text-sm border-b border-dashed pb-1.5">
                          <span className="font-mono text-xs">{fatura.numero_instrumento_cobranca || '(sem número)'}</span>
                          <span className="text-muted-foreground">{fatura.situacao || '-'}</span>
                          <span className="font-semibold">{formatCurrency(fatura.valor_liquido || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
