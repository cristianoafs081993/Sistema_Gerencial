import { useState, useMemo, useCallback } from 'react';
import { Search, FileText, Calendar, DollarSign, ExternalLink, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export default function Contratos() {
  const { contratos, empenhos, contratosEmpenhos, isLoading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

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
        let aValue: any;
        let bValue: any;

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

  const safeFormatDate = (dateVal: any) => {
    if (!dateVal) return '-';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '-';
      return format(d, 'dd/MM/yyyy');
    } catch (e) {
      return '-';
    }
  };

  const getEmpenhosDoContrato = useCallback((contratoId: string) => {
    const linkIds = contratosEmpenhos
      .filter((l) => l.contrato_id === contratoId)
      .map((l) => l.empenho_id);
    
    return empenhos.filter((e) => linkIds.includes(e.id));
  }, [empenhos, contratosEmpenhos]);

  const totalALiquidarGlobal = useMemo(() => {
    return contratos.reduce((sumContrato, c) => {
      const emps = getEmpenhosDoContrato(c.id);
      return sumContrato + emps.reduce((sumEmp, e) => {
        if (e.tipo === 'rap') return sumEmp + (e.rapALiquidar || 0);
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
    <div className="space-y-space-6 pb-space-10">

      <Card className="card-system shadow-shadow-sm">
        <CardHeader className="pb-space-3">
          <CardTitle className="text-text-lg font-font-bold">Contratos Ativos</CardTitle>
          <div className="relative mt-space-2">
            <Search className="absolute left-space-3 top-1/2 -translate-y-1/2 h-space-4 w-space-4 text-text-muted" />
            <Input
              placeholder="Buscar por número ou contratada..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-space-10 input-system"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-radius-md border border-border-default/50 overflow-hidden">
            <table className="w-full text-text-sm">
              <thead>
                <tr className="bg-surface-subtle/50 border-b border-border-default/50">
                  <th 
                    className="text-left py-3 px-4 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('numero')}
                  >
                    <div className="flex items-center">
                      Contrato
                      <SortIcon columnKey="numero" />
                    </div>
                  </th>
                  <th className="text-left py-3 px-4 font-medium">Contratada</th>
                  <th 
                    className="text-right py-3 px-4 font-medium cursor-pointer hover:bg-muted/80 transition-colors"
                    onClick={() => handleSort('data_termino')}
                  >
                    <div className="flex items-center justify-end">
                      Vigência
                      <SortIcon columnKey="data_termino" />
                    </div>
                  </th>
                  <th className="text-right py-3 px-4 font-medium">Valor Total</th>
                  <th className="text-right py-3 px-4 font-medium">Saldo a Liquidar</th>
                  <th className="text-left py-3 px-4 font-medium">Empenhos Vinculados</th>
                </tr>
              </thead>
              <tbody>
                {filteredContratos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum contrato encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredContratos.map((c) => {
                    const empenhosVinculados = getEmpenhosDoContrato(c.id);
                    const totalEmpenhado = empenhosVinculados.reduce((sum, e) => sum + e.valor, 0);
                    
                    const totalALiquidar = empenhosVinculados.reduce((sum, e) => {
                      if (e.tipo === 'rap') return sum + (e.rapALiquidar || 0);
                      const liquidado = (e.valorLiquidadoAPagar || 0) + (e.valorPagoOficial || 0);
                      return sum + Math.max(0, e.valor - liquidado);
                    }, 0);

                    return (
                      <tr key={c.id} className="border-b border-border-default/50 hover:bg-surface-subtle transition-colors">
                        <td className="py-space-3 px-space-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-font-medium text-text-sm">{c.numero}</span>
                          </div>
                        </td>
                        <td className="py-space-3 px-space-4">
                          <span className="font-font-medium text-text-sm">{c.contratada}</span>
                        </td>
                        <td className="py-space-3 px-space-4 text-right">
                          <div className="flex flex-col text-text-xs space-y-space-0.5">
                            <span className="text-text-muted">Início: {safeFormatDate(c.data_inicio)}</span>
                            <span className="font-font-medium text-text-secondary">Fim: {safeFormatDate(c.data_termino)}</span>
                          </div>
                        </td>
                        <td className="py-space-3 px-space-4 text-right">
                          <div className="flex flex-col">
                            <span className="font-font-bold text-action-primary text-text-sm">{formatCurrency(c.valor || 0)}</span>
                            {totalEmpenhado > 0 && (
                              <span className="text-[10px] text-text-muted">
                                Empenhado: {formatCurrency(totalEmpenhado)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-space-3 px-space-4 text-right">
                          <div className="flex flex-col">
                            <span className={cn(
                              "font-font-semibold text-text-sm",
                              totalALiquidar > 0 ? "text-status-warning" : "text-status-success"
                            )}>
                              {formatCurrency(totalALiquidar)}
                            </span>
                            <span className="text-[10px] text-text-muted uppercase">A Liquidar</span>
                          </div>
                        </td>
                        <td className="py-space-3 px-space-4">
                          <div className="flex flex-wrap gap-1">
                            {empenhosVinculados.length > 0 ? (
                              empenhosVinculados.map((e) => {
                                const balance = e.tipo === 'rap' 
                                  ? (e.rapALiquidar || 0) 
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
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-space-4">
        <Card className="bg-action-primary/5 border-action-primary/10 shadow-shadow-sm">
          <CardContent className="pt-space-6">
            <div className="flex flex-col items-center text-center space-y-space-2">
              <FileText className="h-space-8 w-space-8 text-action-primary opacity-70" />
              <div className="text-text-2xl font-font-bold">{contratos.length}</div>
              <div className="text-text-xs text-text-muted uppercase tracking-wider font-font-semibold">Contratos Ativos</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-action-secondary/5 border-action-secondary/10 shadow-shadow-sm">
          <CardContent className="pt-space-6">
            <div className="flex flex-col items-center text-center space-y-space-2">
              <DollarSign className="h-space-8 w-space-8 text-action-secondary opacity-70" />
              <div className="text-text-2xl font-font-bold">
                {formatCurrency(contratos.reduce((sum, c) => sum + (c.valor || 0), 0))}
              </div>
              <div className="text-text-xs text-text-muted uppercase tracking-wider font-font-semibold">Valor Global Sob Contrato</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-status-warning/5 border-status-warning/10 shadow-shadow-sm">
          <CardContent className="pt-space-6">
            <div className="flex flex-col items-center text-center space-y-space-2">
              <Calendar className="h-space-8 w-space-8 text-status-warning opacity-70" />
              <div className="text-text-2xl font-font-bold">
                {formatCurrency(totalALiquidarGlobal)}
              </div>
              <div className="text-text-xs text-text-muted uppercase tracking-wider font-font-semibold">Saldo Total a Liquidar</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-action-info/5 border-action-info/10 shadow-shadow-sm">
          <CardContent className="pt-space-6">
            <div className="flex flex-col items-center text-center space-y-space-2">
              <ExternalLink className="h-space-8 w-space-8 text-action-info opacity-70" />
              <div className="text-text-2xl font-font-bold">{contratosEmpenhos.length}</div>
              <div className="text-text-xs text-text-muted uppercase tracking-wider font-font-semibold">Vínculos Gerenciados</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
