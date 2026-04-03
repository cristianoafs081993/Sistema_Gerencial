import { useState, useMemo, useCallback } from 'react';
import { Search, FileText, Calendar, DollarSign, ExternalLink, ArrowUpDown, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { HeaderActions } from '@/components/HeaderParts';
import { ContratosSyncDialog } from '@/components/modals/ContratosSyncDialog';
import { FilterPanel } from '@/components/design-system/FilterPanel';

export default function Contratos() {
  const { contratos, empenhos, contratosEmpenhos, isLoading, refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [isSyncDialogOpen, setIsSyncDialogOpen] = useState(false);

  const normalizeString = useCallback((str: string) =>
    str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "", []);

  const filteredContratos = useMemo(() => {
    const searchNormalized = normalizeString(searchTerm);
    let result = contratos.filter((c) => {
      return (
        normalizeString(c.numero).includes(searchNormalized) ||
        normalizeString(c.contratada).includes(searchNormalized)
      );
    });

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';

        if (sortConfig.key === 'numero') {
          aValue = a.numero;
          bValue = b.numero;
        } else if (sortConfig.key === 'data_termino') {
          aValue = a.data_termino ? new Date(a.data_termino).getTime() : 0;
          bValue = b.data_termino ? new Date(b.data_termino).getTime() : 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [contratos, searchTerm, normalizeString, sortConfig]);

  const safeFormatDate = (dateVal: Date | string | null | undefined) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      return format(d, 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };

  const getRapSaldo = (rapALiquidar?: number, saldoRapOficial?: number) => {
    const aLiq = rapALiquidar || 0;
    if (aLiq > 0) return aLiq;
    return saldoRapOficial || 0;
  };

  const getEmpenhosDoContrato = useCallback((contratoId: string) => {
    const linkIds = contratosEmpenhos
      .filter((l) => l.contrato_id === contratoId)
      .map((l) => l.empenho_id);

    // Compatibilidade: dependendo do histórico/imports, `contratos_empenhos.empenho_id`
    // pode estar armazenando o UUID do empenho OU o número do empenho.
    // Para não "sumir" vínculos na UI, resolvemos por ambos.
    const normalizeRef = (s: string) => (s || '')
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');

    const byId = new Map(empenhos.map(e => [e.id, e] as const));
    const byNumero = new Map(empenhos.map(e => [e.numero, e] as const));
    const byNumeroNorm = new Map(empenhos.map(e => [normalizeRef(e.numero), e] as const));
    // Alguns vínculos antigos guardam só o final do número
    const byNumeroSuffix12 = new Map(empenhos.map(e => [normalizeRef(e.numero).slice(-12), e] as const));

    const resolved: typeof empenhos = [];
    const seen = new Set<string>();
    for (const ref of linkIds) {
      const refStr = (ref || '').toString().trim();
      const refNorm = normalizeRef(refStr);
      const emp =
        byId.get(refStr) ||
        byNumero.get(refStr) ||
        byNumeroNorm.get(refNorm) ||
        (refNorm.length >= 12 ? byNumeroSuffix12.get(refNorm.slice(-12)) : undefined);
      if (!emp) continue;
      if (seen.has(emp.id)) continue;
      seen.add(emp.id);
      resolved.push(emp);
    }
    return resolved;
  }, [empenhos, contratosEmpenhos]);

  const totalALiquidarGlobal = useMemo(() => {
    return contratos.reduce((sumContrato, c) => {
      const emps = getEmpenhosDoContrato(c.id);
      return sumContrato + emps.reduce((sumEmp, e) => {
        if (e.tipo === 'rap') return sumEmp + getRapSaldo(e.rapALiquidar, e.saldoRapOficial);
        const liquidado = (e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0);
        return sumEmp + Math.max(0, e.valor - liquidado);
      }, 0);
    }, 0);
  }, [contratos, getEmpenhosDoContrato]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="ml-2 h-3 w-3 text-primary" /> : <ChevronDown className="ml-2 h-3 w-3 text-primary" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  return (
    <div className="space-y-6 pb-10">

      <HeaderActions>
        <Button
          variant="outline"
          className="gap-2 h-8 text-xs sm:h-9 sm:text-sm bg-surface-card border-border-default shadow-sm transition-all"
          onClick={() => setIsSyncDialogOpen(true)}
        >
          <RefreshCw className="h-4 w-4 text-action-primary" />
          Sincronizar Contratos
        </Button>
      </HeaderActions>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <StatCard
          title="Contratos Ativos"
          value={contratos.length}
          icon={FileText}
          stitchColor="vibrant-blue"
        />

        <StatCard
          title="Valor Global"
          value={formatCurrency(contratos.reduce((sum, c) => sum + (c.valor || 0), 0))}
          icon={DollarSign}
          stitchColor="purple"
        />

        <StatCard
          title="Saldo a Liquidar"
          value={formatCurrency(totalALiquidarGlobal)}
          icon={Calendar}
          stitchColor="amber"
          progress={45} // Placeholder progress or calculate if possible
        />

        <StatCard
          title="Valor Empenhado"
          value={formatCurrency(contratos.reduce((sum, c) => {
            const emps = getEmpenhosDoContrato(c.id);
            return sum + emps.reduce((s, e) => s + (e.valor || 0), 0);
          }, 0))}
          icon={ExternalLink}
          stitchColor="emerald-green"
        />
      </div>

      {/* Standard Filter Card */}
      <FilterPanel className="shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número ou contratada..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm input-system"
              />
            </div>
          </div>
        </CardContent>
      </FilterPanel>

      <Card className="card-system shadow-sm overflow-hidden border-none shadow-none mt-6">
        <CardHeader className="px-6 py-4 border-b border-border-default/50">
          <CardTitle className="table-title">Contratos Ativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                  <TableHead
                    className="h-11 px-6 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                    onClick={() => handleSort('numero')}
                  >
                    <div className="flex items-center">
                      Contrato
                      <SortIcon columnKey="numero" />
                    </div>
                  </TableHead>
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider">Contratada</TableHead>
                  <TableHead
                    className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-slate-100/80 transition-colors"
                    onClick={() => handleSort('data_termino')}
                  >
                    <div className="flex items-center justify-end">
                      Vigência
                      <SortIcon columnKey="data_termino" />
                    </div>
                  </TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Valor Total</TableHead>
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-wider">EMPENHADO</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo a Liquidar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContratos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                      Nenhum contrato encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContratos.map((c) => {
                    const empenhosVinculados = getEmpenhosDoContrato(c.id);
                    const totalEmpenhado = empenhosVinculados.reduce((sum, e) => sum + e.valor, 0);
                    const percentualEmpenhado = c.valor && c.valor > 0
                      ? Math.min(100, (totalEmpenhado / c.valor) * 100)
                      : 0;

                    const totalALiquidar = empenhosVinculados.reduce((sum, e) => {
                      if (e.tipo === 'rap') return sum + getRapSaldo(e.rapALiquidar, e.saldoRapOficial);
                      const liquidado = (e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0);
                      return sum + Math.max(0, e.valor - liquidado);
                    }, 0);

                    return (
                      <TableRow key={c.id} className="hover:bg-slate-50/80 transition-colors border-b last:border-0">
                        <TableCell className="py-4 px-6">
                          <span className="font-mono font-medium text-sm">{c.numero}</span>
                        </TableCell>
                        <TableCell className="py-4 px-4">
                          <span className="font-medium text-sm">{c.contratada}</span>
                        </TableCell>
                        <TableCell className="py-4 px-4 text-right">
                          <div className="flex flex-col text-xs space-y-0.5">
                            <span className="text-muted-foreground">+ {safeFormatDate(c.data_inicio)}</span>
                            <span className="font-medium text-muted-foreground">- {safeFormatDate(c.data_termino)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <span className="font-bold text-action-primary text-sm">{formatCurrency(c.valor || 0)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="space-y-2">
                            {totalEmpenhado > 0 && (
                              <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-700">{formatCurrency(totalEmpenhado)}</span>
                                  <span className="font-medium text-slate-500">{percentualEmpenhado.toFixed(1)}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-slate-500 rounded-full transition-all"
                                    style={{ width: `${percentualEmpenhado}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-1">
                            {empenhosVinculados.length > 0 ? (
                              empenhosVinculados.map((e) => {
                                const balance = e.tipo === 'rap'
                                  ? getRapSaldo(e.rapALiquidar, e.saldoRapOficial)
                                  : Math.max(0, e.valor - ((e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0)));

                                return (
                                  <Popover key={e.id}>
                                    <PopoverTrigger asChild>
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] font-mono py-0 h-5 cursor-pointer hover:bg-muted-foreground/20 transition-colors"
                                      >
                                        {e.numero}
                                      </Badge>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-3 shadow-xl border-border/50 backdrop-blur-sm">
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center border-b border-border/50 pb-1 mr-1">
                                          <span className="text-xs font-bold font-mono text-primary">{e.numero}</span>
                                          <Badge variant="outline" className="text-[9px] uppercase px-1 h-4">
                                            {e.tipo === 'rap' ? 'RAP' : 'Exercício'}
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-1.5 text-xs py-1">
                                          <span className="text-muted-foreground">Valor Total:</span>
                                          <span className="text-right font-medium">{formatCurrency(e.valor || 0)}</span>
                                          <span className="text-muted-foreground font-semibold">Saldo a Liquidar:</span>
                                          <span className={cn(
                                            "text-right font-bold underline decoration-dotted",
                                            balance > 0 ? "text-orange-600" : "text-green-600"
                                          )}>
                                            {formatCurrency(balance)}
                                          </span>
                                        </div>
                                        {e.tipo !== 'rap' && (
                                          <div className="pt-1.5 mt-1 border-t border-dashed border-border/50">
                                            <div className="flex justify-between text-[10px]">
                                              <span className="text-muted-foreground">Total Liquidado:</span>
                                              <span className="font-medium text-emerald-700">
                                                {formatCurrency((e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0))}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sem empenhos</span>
                            )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-4 text-right">
                          <div className="flex flex-col">
                            <span className={cn(
                              "font-semibold text-sm",
                              totalALiquidar > 0 ? "text-status-warning" : "text-status-success"
                            )}>
                              {formatCurrency(totalALiquidar)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ContratosSyncDialog
        open={isSyncDialogOpen}
        onOpenChange={setIsSyncDialogOpen}
        onSyncComplete={refreshData}
      />
    </div>
  );
}

