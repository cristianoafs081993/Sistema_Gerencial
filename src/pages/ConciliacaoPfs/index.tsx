import { useState, useEffect } from 'react';
import { getNecessidadePFs, getDocumentosPendentes } from '@/services/pfImportService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  Wallet, 
  FileWarning, 
  ArrowRightCircle, 
  TrendingDown,
  RefreshCw,
  Search,
  ExternalLink
} from 'lucide-react';
import { formatCurrency, formatDocumentoId } from '@/lib/utils';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { HeaderSubtitle, HeaderActions } from '@/components/HeaderParts';

interface NecessidadeFonte {
  fonte: string;
  total_solicitado: number;
  total_pago: number;
  total_a_pagar: number;
  saldo_pf_disponivel: number;
  qtd_docs_pendentes: number;
  necessidade_pf: number;
  status_analise: 'REGULAR' | 'SUFICIENTE' | 'NECESSITA_PF';
}

export default function ConciliacaoPfs() {
  const [fontes, setFontes] = useState<NecessidadeFonte[]>([]);
  const [docsPendentes, setDocsPendentes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFonte, setSelectedFonte] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fontesRes, docsRes] = await Promise.all([
        getNecessidadePFs(),
        getDocumentosPendentes()
      ]);
      setFontes(fontesRes || []);
      setDocsPendentes(docsRes || []);
    } catch (error) {
      console.error('Erro ao buscar dados de necessidade:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalNecessidade = fontes.reduce((acc, curr) => acc + curr.necessidade_pf, 0);
  const totalAPagar = fontes.reduce((acc, curr) => acc + curr.total_a_pagar, 0);

  const filteredDocs = selectedFonte 
    ? docsPendentes.filter(d => d.fonte_sof.startsWith(selectedFonte))
    : docsPendentes;

  return (
    <div className="flex-1 space-y-8 p-8 pt-6 animate-in fade-in duration-500">
      <HeaderSubtitle>Análise de liquidações em aberto vs. saldo disponível de PFs</HeaderSubtitle>
      <HeaderActions>
        {totalNecessidade > 0 && <Badge variant="destructive" className="animate-pulse">Crítico</Badge>}
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-2 shadow-sm" disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Atualizar Análise
        </Button>
      </HeaderActions>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-red-200 bg-red-50/20 dark:bg-red-900/10 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Falta Solicitar (PF)</CardTitle>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-red-700 dark:text-red-400">{formatCurrency(totalNecessidade)}</div>
            <p className="text-xs text-red-600/80 mt-1 font-medium">
              Déficit total de cobertura para as liquidações atuais
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/20 dark:bg-blue-900/10 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Liquidações a Pagar</CardTitle>
            <FileWarning className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-700 dark:text-blue-400">{formatCurrency(totalAPagar)}</div>
            <p className="text-xs text-blue-600/80 mt-1 font-medium">
              {docsPendentes.length} documentos aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/20 dark:bg-emerald-900/10 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Fontes Críticas</CardTitle>
            <AlertCircle className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
              {fontes.filter(f => f.status_analise === 'NECESSITA_PF').length}
            </div>
            <p className="text-xs text-emerald-600/80 mt-1 font-medium">
              Fontes onde o saldo de PF é insuficiente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fontes Analysis */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold flex items-center gap-2 px-1">
          <Wallet className="h-5 w-5 text-primary" /> Análise por Fonte de Recursos
        </h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
             Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[200px] w-full rounded-xl" />)
          ) : fontes.map((f) => (
            <Card 
              key={f.fonte} 
              className={`group hover:shadow-lg transition-all cursor-pointer border-l-4 ${
                f.status_analise === 'NECESSITA_PF' ? 'border-l-red-500 shadow-red-100/20' : 
                f.status_analise === 'SUFICIENTE' ? 'border-l-emerald-500 shadow-emerald-100/20' : 
                'border-l-slate-300'
              } ${selectedFonte === f.fonte ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              onClick={() => setSelectedFonte(selectedFonte === f.fonte ? null : f.fonte)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-sm px-3 py-1 bg-white dark:bg-slate-900">Fonte {f.fonte}</Badge>
                  {f.status_analise === 'NECESSITA_PF' ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200 gap-1.5 shadow-none">
                      <TrendingDown className="h-3 w-3" /> Necessita PF
                    </Badge>
                  ) : f.status_analise === 'SUFICIENTE' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200 gap-1.5 shadow-none">
                      <CheckCircle2 className="h-3 w-3" /> Suficiente
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1.5">Regular</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-end border-b pb-2 border-slate-100 dark:border-slate-800">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase text-muted-foreground">Saldo PF Disponível</span>
                     <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(f.saldo_pf_disponivel)}</span>
                   </div>
                   <div className="flex flex-col text-right">
                     <span className="text-[10px] font-bold uppercase text-muted-foreground">Fila de Pagamento</span>
                     <span className="text-sm font-black text-blue-600">{formatCurrency(f.total_a_pagar)}</span>
                   </div>
                </div>
                {f.necessidade_pf > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg flex items-center justify-between group-hover:bg-red-100/50 transition-colors">
                    <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Déficit de Recurso:</span>
                    <span className="text-lg font-black text-red-600">{formatCurrency(f.necessidade_pf)}</span>
                  </div>
                )}
                <p className="text-[10px] text-center text-muted-foreground font-medium italic pt-1">
                  Clique para ver os {f.qtd_docs_pendentes} documentos desta fonte
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pending Documents Table */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <ArrowRightCircle className="h-5 w-5 text-blue-500" /> 
            {selectedFonte ? `Liquidações Pendentes - Fonte ${selectedFonte}` : "Todas as Liquidações Pendentes"}
          </h3>
          {selectedFonte && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedFonte(null)} className="h-8 text-[11px] font-bold uppercase tracking-tighter">
              Ver Todos
            </Button>
          )}
        </div>
        
        <Card className="shadow-xl border-slate-200/60 dark:border-slate-800/60 overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
              <TableRow className="border-b">
                <TableHead className="w-[120px] font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Data</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Documento</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Favorecido</TableHead>
                <TableHead className="text-center font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Fonte</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Liquidado</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Pago</TableHead>
                <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest text-muted-foreground">Pendente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground italic">
                    {selectedFonte ? "Nenhuma liquidação pendente nesta fonte." : "Nenhuma liquidação pendente no sistema. Parabéns!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.map((doc) => (
                  <TableRow key={doc.id} className="group hover:bg-slate-50/80 transition-all border-b last:border-0">
                    <TableCell className="text-xs font-medium">{format(new Date(`${doc.data_emissao}T12:00:00`), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="font-mono text-[11px] font-bold text-primary">{formatDocumentoId(doc.id)}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs font-bold" title={doc.favorecido_nome}>{doc.favorecido_nome}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-mono text-[9px] px-1">{doc.fonte_sof}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">{formatCurrency(doc.valor_liquidado)}</TableCell>
                    <TableCell className="text-right text-xs font-medium text-muted-foreground">{formatCurrency(doc.valor_pago)}</TableCell>
                    <TableCell className="text-right font-black text-sm text-red-600">
                      {formatCurrency(doc.valor_pendente)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
