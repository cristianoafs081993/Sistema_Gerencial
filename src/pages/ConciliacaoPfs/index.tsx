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
import { HeaderActions } from '@/components/HeaderParts';

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
    <div className="flex-1 space-y-space-8 p-space-4 md:p-space-8 pt-space-6 pb-space-10">
      <HeaderActions>
        {totalNecessidade > 0 && <Badge variant="destructive" className="animate-pulse bg-status-error">Crítico</Badge>}
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-space-2 shadow-shadow-sm h-space-9" disabled={loading}>
          <RefreshCw className={loading ? "h-space-4 w-space-4 animate-spin" : "h-space-4 w-space-4"} />
          Atualizar Análise
        </Button>
      </HeaderActions>

      {/* Overview Cards */}
      <div className="grid gap-space-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-status-error/20 bg-status-error/5 shadow-shadow-md card-system">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-space-2">
            <CardTitle className="text-text-xs font-font-bold uppercase tracking-wider text-status-error">Falta Solicitar (PF)</CardTitle>
            <TrendingDown className="h-space-5 w-space-5 text-status-error" />
          </CardHeader>
          <CardContent>
            <div className="text-text-3xl font-font-black text-status-error">{formatCurrency(totalNecessidade)}</div>
            <p className="text-text-xs text-status-error/80 mt-space-1 font-font-medium">
              Déficit total de cobertura para as liquidações atuais
            </p>
          </CardContent>
        </Card>

        <Card className="border-action-primary/20 bg-action-primary/5 shadow-shadow-md card-system">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-space-2">
            <CardTitle className="text-text-xs font-font-bold uppercase tracking-wider text-action-primary">Liquidações a Pagar</CardTitle>
            <FileWarning className="h-space-5 w-space-5 text-action-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-text-3xl font-font-black text-action-primary">{formatCurrency(totalAPagar)}</div>
            <p className="text-text-xs text-action-primary/80 mt-space-1 font-font-medium">
              {docsPendentes.length} documentos aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card className="border-status-success/20 bg-status-success/5 shadow-shadow-md card-system">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-space-2">
            <CardTitle className="text-text-xs font-font-bold uppercase tracking-wider text-status-success">Fontes Críticas</CardTitle>
            <AlertCircle className="h-space-5 w-space-5 text-status-success" />
          </CardHeader>
          <CardContent>
            <div className="text-text-3xl font-font-black text-status-success">
              {fontes.filter(f => f.status_analise === 'NECESSITA_PF').length}
            </div>
            <p className="text-text-xs text-status-success/80 mt-space-1 font-font-medium">
              Fontes onde o saldo de PF é insuficiente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fontes Analysis */}
      <div className="space-y-space-4">
        <h3 className="text-text-lg font-font-bold flex items-center gap-space-2 px-space-1">
          <Wallet className="h-space-5 w-space-5 text-action-primary" /> Análise por Fonte de Recursos
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
              <CardHeader className="pb-space-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-text-sm px-space-3 py-space-1 bg-surface-card border-border-default">Fonte {f.fonte}</Badge>
                  {f.status_analise === 'NECESSITA_PF' ? (
                    <Badge className="bg-status-error/10 text-status-error hover:bg-status-error/20 border-status-error/20 gap-space-1.5 shadow-none">
                      <TrendingDown className="h-space-3 w-space-3" /> Necessita PF
                    </Badge>
                  ) : f.status_analise === 'SUFICIENTE' ? (
                    <Badge className="bg-status-success/10 text-status-success hover:bg-status-success/20 border-status-success/20 gap-space-1.5 shadow-none">
                      <CheckCircle2 className="h-space-3 w-space-3" /> Suficiente
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-space-1.5">Regular</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-space-3">
                <div className="flex justify-between items-end border-b pb-space-2 border-border-default/50">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-font-bold uppercase text-text-muted">Saldo PF Disponível</span>
                     <span className="text-text-sm font-font-bold text-text-secondary">{formatCurrency(f.saldo_pf_disponivel)}</span>
                   </div>
                   <div className="flex flex-col text-right">
                     <span className="text-[10px] font-font-bold uppercase text-text-muted">Fila de Pagamento</span>
                     <span className="text-text-sm font-font-black text-action-primary">{formatCurrency(f.total_a_pagar)}</span>
                   </div>
                </div>
                {f.necessidade_pf > 0 && (
                   <div className="bg-status-error/10 p-space-3 rounded-radius-lg flex items-center justify-between group-hover:bg-status-error/20 transition-colors">
                     <span className="text-text-xs font-font-bold text-status-error uppercase">Déficit de Recurso:</span>
                     <span className="text-text-lg font-font-black text-status-error">{formatCurrency(f.necessidade_pf)}</span>
                   </div>
                )}
                <p className="text-[10px] text-center text-text-muted font-font-medium italic pt-space-1">
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
        
        <Card className="shadow-shadow-xl border-border-default/60 card-system overflow-hidden">
          <Table>
            <TableHeader className="bg-surface-subtle/50">
              <TableRow className="border-b border-border-default">
                <TableHead className="w-[120px] font-font-bold text-[10px] uppercase tracking-widest text-text-muted">Data</TableHead>
                <TableHead className="font-font-bold text-[10px] uppercase tracking-widest text-text-muted">Documento</TableHead>
                <TableHead className="font-font-bold text-[10px] uppercase tracking-widest text-text-muted">Favorecido</TableHead>
                <TableHead className="text-center font-font-bold text-[10px] uppercase tracking-widest text-text-muted">Fonte</TableHead>
                <TableHead className="text-right font-font-bold text-[10px] uppercase tracking-widest text-text-muted">Liquidado</TableHead>
                <TableHead className="text-right font-font-bold text-[10px] uppercase tracking-widest text-text-muted">Pago</TableHead>
                <TableHead className="text-right font-font-bold text-[10px] uppercase tracking-widest text-text-muted">Pendente</TableHead>
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
