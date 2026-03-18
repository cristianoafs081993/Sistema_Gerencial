import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { RastreabilidadePF } from '@/types/pfs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { PFImportDialog } from './PFImportDialog';
import { PFDetailsDialog } from './PFDetailsDialog';

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
      const { data: pfs, error } = await supabase
        .from('vw_rastreabilidade_pf')
        .select('*')
        .order('data_solicitacao', { ascending: false });

      if (error) throw error;
      setData(pfs || []);
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
    'APROVADA E LIBERADA': 'bg-green-500 hover:bg-green-600 border-transparent text-white',
    'CANCELADA': 'bg-red-500 hover:bg-red-600 border-transparent text-white',
    'PENDENTE': 'bg-yellow-500 hover:bg-yellow-600 border-transparent text-white',
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
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Rastreabilidade de PFs</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar arquivos
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Solicitado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSolicitado)}</div>
            <p className="text-xs text-muted-foreground">{processedData.length} PFs no total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Liberado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(totalLiberado)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPendente)}</div>
            <p className="text-xs text-muted-foreground">{pendentes.length} PFs pendentes</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center space-x-2">
          <Select value={mesFilter} onValueChange={setMesFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Meses</SelectItem>
              {meses.map(m => <SelectItem key={m as string} value={m as string}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={fonteFilter} onValueChange={setFonteFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Fontes</SelectItem>
              {fontes.map(f => <SelectItem key={f as string} value={f as string}>{f}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={tipoFilter} onValueChange={setTipoFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Tipos</SelectItem>
              {tipos.map(t => <SelectItem key={t as string} value={t as string}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              {statusList.map(s => <SelectItem key={s as string} value={s as string}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('ppf_campus')}>
                  <div className="flex items-center">
                    PPF Campus
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="w-[140px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('data_solicitacao')}>
                  <div className="flex items-center">
                    Data Solicitação
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="w-[100px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('tipo')}>
                  <div className="flex items-center">
                    Tipo
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('mes_referencia')}>
                  <div className="flex items-center">
                    Mês
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('fonte_recurso')}>
                  <div className="flex items-center">
                    Fonte
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="text-right w-[140px] cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('valor')}>
                  <div className="flex items-center justify-end">
                    Valor
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="w-[140px] text-center cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center">
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">
                    Carregando dados...
                  </TableCell>
                </TableRow>
              ) : processedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground italic">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                processedData.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/40 transition-colors cursor-pointer group" onClick={() => openDetails(row)}>
                    <TableCell className="font-mono text-xs font-semibold text-primary">
                      {row.ppf_campus}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(row.data_solicitacao)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] h-5">{row.tipo}</Badge>
                    </TableCell>
                    <TableCell>{row.mes_referencia}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-[10px]">{row.fonte_recurso}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-base">{formatCurrency(row.valor)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${statusColorMap[row.status?.toUpperCase() || ''] || getStatusBadgeVariant(row.status)} text-white border-none shadow-sm`}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-bold">Total Geral (Exibido):</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(totalSolicitado)}</TableCell>
                <TableCell colSpan={6}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

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
