import { useState, useEffect } from 'react';
import { RastreabilidadePF } from '@/types/pfs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, Search, Filter, ArrowUpDown, ChevronRight, Eye } from 'lucide-react';
import { PFImportDialog } from '@/components/modals/PFImportDialog';
import { PFDetailsDialog } from '@/components/modals/PFDetailsDialog';
import { HeaderActions } from '@/components/HeaderParts';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { rastreabilidadePFsService } from '@/services/rastreabilidadePFs';

export default function RastreabilidadePFs() {
  const [data, setData] = useState<RastreabilidadePF[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  // Filtros
  const currentMonth = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'][new Date().getMonth()];
  const [mesFilter, setMesFilter] = useState<string>(currentMonth);
  const [fonteFilter, setFonteFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Ordenação
  const [sortKey, setSortKey] = useState<keyof RastreabilidadePF>('data_solicitacao');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detalhes
  const [selectedPF, setSelectedPF] = useState<RastreabilidadePF | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const pfs = await rastreabilidadePFsService.getAll();
      setData(pfs);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const d = new Date(dateString);
    // Add timezone offset to prevent shifting day
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return new Intl.DateTimeFormat('pt-BR').format(d);
  };

  const truncatePF = (pf: string | null) => {
    if (!pf) return '-';
    return pf.substring(0, 8) + '...';
  };

  const getStatusBadgeVariant = (status: string | null) => {
    if (!status) return 'secondary';
    const s = status.toUpperCase();
    if (s.includes('APROVADA E LIBERADA')) return 'default'; // Or success if available
    if (s.includes('CANCELADA')) return 'destructive';
    if (s.includes('PENDENTE')) return 'outline';
    return 'secondary';
  };

  const statusColorMap: Record<string, string> = {
    'APROVADA E LIBERADA': 'bg-status-success hover:bg-status-success/90 border-transparent text-white',
    'CANCELADA': 'bg-status-error hover:bg-status-error/90 border-transparent text-white',
    'PENDENTE': 'bg-status-warning hover:bg-status-warning/90 border-transparent text-white',
  };

  // Filtered and Sorted data
  const processedData = data
    .filter(item => {
      if (mesFilter !== 'all' && item.mes_referencia !== mesFilter) return false;
      if (fonteFilter !== 'all' && item.fonte_recurso !== fonteFilter) return false;
      if (tipoFilter !== 'all' && item.tipo !== tipoFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (!aValue || !bValue) return 0;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return sortOrder === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  const handleSort = (key: keyof RastreabilidadePF) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const openDetails = (pf: RastreabilidadePF) => {
    setSelectedPF(pf);
    setDetailsOpen(true);
  };

  // Unique filter options
  const meses = Array.from(new Set(data.map(d => d.mes_referencia).filter(Boolean)));
  const fontes = Array.from(new Set(data.map(d => d.fonte_recurso).filter(Boolean)));
  const tipos = Array.from(new Set(data.map(d => d.tipo).filter(Boolean)));
  const statusList = Array.from(new Set(data.map(d => d.status).filter(Boolean)));

  // Resumos (use filteredData for totals, but call it processedData now)
  const totalSolicitado = processedData.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  const totalLiberado = processedData.filter(d => d.status === 'APROVADA E LIBERADA').reduce((acc, curr) => acc + (curr.valor || 0), 0);
  const pendentes = processedData.filter(d => d.status === 'PENDENTE');
  const totalPendente = pendentes.reduce((acc, curr) => acc + (curr.valor || 0), 0);

  return (
    <div className="space-y-6 pb-10">

      <HeaderActions>
        <Button onClick={() => setImportOpen(true)} size="sm" className="gap-space-2 h-space-9 shadow-shadow-sm">
          <Upload className="h-4 w-4" />
          Importar arquivos
        </Button>
      </HeaderActions>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Solicitado"
          value={formatCurrency(totalSolicitado)}
          subtitle={`${processedData.length} PFs no total`}
          icon={Search}
          stitchColor="vibrant-blue"
        />
        <StatCard
          title="Total Liberado"
          value={formatCurrency(totalLiberado)}
          icon={Search}
          stitchColor="emerald-green"
        />
        <StatCard
          title="Pendentes"
          value={formatCurrency(totalPendente)}
          subtitle={`${pendentes.length} PFs pendentes`}
          icon={Filter}
          stitchColor="amber"
          progress={(totalPendente / (totalSolicitado || 1)) * 100}
        />
      </div>
      {/* Standard Filter Card */}
      <FilterPanel className="shadow-sm">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-[140px]">
                <Select value={mesFilter} onValueChange={setMesFilter}>
                  <SelectTrigger className="input-system h-10 w-full">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="all">Todos os Meses</SelectItem>
                    {meses.map(m => <SelectItem key={m as string} value={m as string}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[140px]">
                <Select value={fonteFilter} onValueChange={setFonteFilter}>
                  <SelectTrigger className="input-system h-10 w-full">
                    <SelectValue placeholder="Fonte" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="all">Todas as Fontes</SelectItem>
                    {fontes.map(f => <SelectItem key={f as string} value={f as string}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[140px]">
                <Select value={tipoFilter} onValueChange={setTipoFilter}>
                  <SelectTrigger className="input-system h-10 w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="all">Todos os Tipos</SelectItem>
                    {tipos.map(t => <SelectItem key={t as string} value={t as string}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full sm:w-[140px]">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="input-system h-10 w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-sm">
                    <SelectItem value="all">Todos os Status</SelectItem>
                    {statusList.map(s => <SelectItem key={s as string} value={s as string}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </FilterPanel>

      <Card className="shadow-sm card-system overflow-hidden">
        <CardHeader className="px-6 py-4 border-b border-border-default/50 flex flex-row items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <CardTitle className="table-title">Rastreabilidade de PFs</CardTitle>
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-2 py-0 h-5">
              {processedData.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-border-default/50">
                  <TableHead className="w-[140px] cursor-pointer hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider py-4 px-6" onClick={() => handleSort('ppf_campus')}>
                    <div className="flex items-center gap-2">
                      PPF Campus
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[140px] cursor-pointer hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider py-4" onClick={() => handleSort('data_solicitacao')}>
                    <div className="flex items-center gap-2">
                      Data Solicitação
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] cursor-pointer hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider py-4" onClick={() => handleSort('tipo')}>
                    <div className="flex items-center gap-2">
                      Tipo
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] cursor-pointer hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider py-4" onClick={() => handleSort('mes_referencia')}>
                    <div className="flex items-center gap-2">
                      Mês
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] cursor-pointer hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider py-4" onClick={() => handleSort('fonte_recurso')}>
                    <div className="flex items-center gap-2">
                      Fonte
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="text-right w-[140px] cursor-pointer hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider py-4" onClick={() => handleSort('valor')}>
                    <div className="flex items-center justify-end gap-2">
                      Valor
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[160px] text-center cursor-pointer hover:text-primary transition-colors text-xs font-semibold uppercase tracking-wider py-4" onClick={() => handleSort('status')}>
                    <div className="flex items-center justify-center gap-2">
                      Status
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="w-[80px] text-right text-xs font-semibold uppercase tracking-wider py-4 pr-6">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 animate-pulse rounded" /></TableCell>
                      <TableCell className="py-4"><div className="h-4 w-24 bg-slate-100 animate-pulse rounded" /></TableCell>
                      <TableCell className="py-4"><div className="h-4 w-16 bg-slate-100 animate-pulse rounded" /></TableCell>
                      <TableCell className="py-4"><div className="h-4 w-12 bg-slate-100 animate-pulse rounded" /></TableCell>
                      <TableCell className="py-4"><div className="h-4 w-12 bg-slate-100 animate-pulse rounded" /></TableCell>
                      <TableCell className="py-4"><div className="h-4 w-24 bg-slate-100 animate-pulse rounded ml-auto" /></TableCell>
                      <TableCell className="py-4"><div className="h-6 w-32 bg-slate-100 animate-pulse rounded-full mx-auto" /></TableCell>
                      <TableCell className="pr-6 py-4"><div className="h-8 w-8 bg-slate-100 animate-pulse rounded-full ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : processedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground italic">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedData.map((row, i) => (
                    <TableRow key={i} className="hover:bg-slate-50 transition-colors cursor-pointer group border-b border-border-default/30 last:border-0" onClick={() => openDetails(row)}>
                      <TableCell className="font-mono text-xs font-bold text-primary py-4 px-6">
                        {row.ppf_campus}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs py-4">{formatDate(row.data_solicitacao)}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground border-slate-200">{row.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-600 py-4">{row.mes_referencia}</TableCell>
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600">{row.fonte_recurso}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-sm text-slate-900 py-4">{formatCurrency(row.valor)}</TableCell>
                      <TableCell className="text-center py-4">
                        <Badge className={`${statusColorMap[row.status?.toUpperCase() || ''] || getStatusBadgeVariant(row.status)} border-none shadow-sm text-[10px] font-bold uppercase tracking-wider px-2 py-0.5`}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4 pr-6">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-action-primary/10 hover:text-action-primary rounded-full transition-all">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              <TableFooter className="bg-slate-50/80">
                <TableRow>
                  <TableCell colSpan={5} className="font-bold text-xs uppercase tracking-wider px-6 py-4">Total Geral (Exibido):</TableCell>
                  <TableCell className="text-right font-bold text-sm text-slate-900 py-4">{formatCurrency(totalSolicitado)}</TableCell>
                  <TableCell colSpan={2} className="pr-6 py-4"></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PFImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={fetchData}
      />

      <PFDetailsDialog
        pf={selectedPF}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
