import { useState, useMemo, useCallback } from 'react';
import { Search, FileText, Calendar, DollarSign, ExternalLink, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HeaderSubtitle } from '@/components/HeaderParts';
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
    <div className="space-y-6 animate-fade-in">
      <HeaderSubtitle>
        Visualização de contratos e empenhos vinculados
      </HeaderSubtitle>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Contratos Ativos</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou contratada..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/50">
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
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-mono font-medium">{c.numero}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium">{c.contratada}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col text-xs space-y-0.5">
                            <span className="text-muted-foreground">Início: {safeFormatDate(c.data_inicio)}</span>
                            <span className="font-medium">Fim: {safeFormatDate(c.data_termino)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col">
                            <span className="font-bold text-primary">{formatCurrency(c.valor || 0)}</span>
                            {totalEmpenhado > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                Empenhado: {formatCurrency(totalEmpenhado)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col">
                            <span className={cn(
                              "font-semibold",
                              totalALiquidar > 0 ? "text-orange-600" : "text-green-600"
                            )}>
                              {formatCurrency(totalALiquidar)}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase">A Liquidar</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <FileText className="h-8 w-8 text-primary opacity-70" />
              <div className="text-2xl font-bold">{contratos.length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Contratos Ativos</div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-accent/5 border-accent/10">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <DollarSign className="h-8 w-8 text-accent opacity-70" />
              <div className="text-2xl font-bold">
                {formatCurrency(contratos.reduce((sum, c) => sum + (c.valor || 0), 0))}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Valor Global Sob Contrato</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-500/5 border-orange-500/10">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <Calendar className="h-8 w-8 text-orange-500 opacity-70" />
              <div className="text-2xl font-bold">
                {formatCurrency(totalALiquidarGlobal)}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Saldo Total a Liquidar</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/10">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <ExternalLink className="h-8 w-8 text-blue-500 opacity-70" />
              <div className="text-2xl font-bold">{contratosEmpenhos.length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Vínculos Gerenciados</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
