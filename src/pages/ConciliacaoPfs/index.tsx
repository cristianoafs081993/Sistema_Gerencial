import { useState, useEffect } from 'react';
import { getNecessidadePFs, getDocumentosPendentes } from '@/services/pfImportService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatCard } from '@/components/StatCard';
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

interface DocumentoPendente {
  id: string;
  fonte_sof: string;
  data_emissao: string;
  favorecido_nome: string;
  valor_liquidado: number;
  valor_pago: number;
  valor_pendente: number;
}

export default function ConciliacaoPfs() {
  const [fontes, setFontes] = useState<NecessidadeFonte[]>([]);
  const [docsPendentes, setDocsPendentes] = useState<DocumentoPendente[]>([]);
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
    <div className="space-y-6 pb-10">
      <HeaderActions>
        {totalNecessidade > 0 && <Badge variant="destructive" className="animate-pulse bg-status-error">Crítico</Badge>}
        <Button onClick={fetchData} variant="outline" size="sm" className="gap-space-2 shadow-shadow-sm h-space-9" disabled={loading}>
          <RefreshCw className={loading ? "h-space-4 w-space-4 animate-spin" : "h-space-4 w-space-4"} />
          Atualizar Análise
        </Button>
      </HeaderActions>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Falta Solicitar (PF)"
          value={formatCurrency(totalNecessidade)}
          subtitle="Déficit total de cobertura para as liquidações atuais"
          icon={TrendingDown}
          stitchColor="red-500"
          isLoading={loading}
        />

        <StatCard
          title="Liquidações a Pagar"
          value={formatCurrency(totalAPagar)}
          subtitle={`${docsPendentes.length} documentos aguardando pagamento`}
          icon={FileWarning}
          stitchColor="vibrant-blue"
          isLoading={loading}
        />

        <StatCard
          title="Fontes Críticas"
          value={fontes.filter(f => f.status_analise === 'NECESSITA_PF').length}
          subtitle="Fontes onde o saldo de PF é insuficiente"
          icon={AlertCircle}
          stitchColor="amber"
          isLoading={loading}
        />
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
        <Card className="shadow-sm card-system overflow-hidden">
          <CardHeader className="px-6 py-4 border-b border-border-default/50 flex flex-row items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ArrowRightCircle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {selectedFonte ? `Liquidações Pendentes - Fonte ${selectedFonte}` : "Todas as Liquidações Pendentes"}
                </CardTitle>
                <CardDescription className="text-[10px] font-medium uppercase tracking-wider mt-0.5">
                  Documentos aguardando liberação de recurso
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold px-2 py-0 h-5">
                {filteredDocs.length} Registros
              </Badge>
              {selectedFonte && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedFonte(null)} className="h-7 px-2 text-[10px] font-bold uppercase tracking-tighter text-muted-foreground hover:text-primary transition-colors">
                  Ver Todos
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-b border-border-default/50">
                    <TableHead className="w-[120px] font-semibold text-xs uppercase tracking-wider py-4 px-6 text-muted-foreground">Data</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground">Documento</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground">Favorecido</TableHead>
                    <TableHead className="text-center font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap">Fonte</TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap">Liquidado</TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider py-4 text-muted-foreground whitespace-nowrap">Pago</TableHead>
                    <TableHead className="text-right font-semibold text-xs uppercase tracking-wider py-4 pr-6 text-muted-foreground whitespace-nowrap">Pendente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="px-6 py-4"><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell className="py-4"><Skeleton className="h-4 w-48" /></TableCell>
                        <TableCell className="py-4"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                        <TableCell className="py-4"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                        <TableCell className="py-4"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                        <TableCell className="py-4 pr-6"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
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
                      <TableRow key={doc.id} className="group hover:bg-slate-50/80 transition-all border-b last:border-0 cursor-pointer">
                        <TableCell className="text-xs font-medium py-4 px-6">{format(new Date(`${doc.data_emissao}T12:00:00`), 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="font-mono text-[11px] font-bold text-primary py-4 group-hover:underline underline-offset-4 decoration-primary/30">{formatDocumentoId(doc.id)}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs font-bold py-4 text-slate-700" title={doc.favorecido_nome}>{doc.favorecido_nome}</TableCell>
                        <TableCell className="text-center py-4">
                          <Badge variant="secondary" className="font-mono text-[9px] px-1.5 py-0 bg-slate-100 text-slate-600">{doc.fonte_sof}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium py-4">{formatCurrency(doc.valor_liquidado)}</TableCell>
                        <TableCell className="text-right text-xs font-medium text-muted-foreground py-4">{formatCurrency(doc.valor_pago)}</TableCell>
                        <TableCell className="text-right font-extrabold text-sm text-status-error py-4 pr-6">
                          {formatCurrency(doc.valor_pendente)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
