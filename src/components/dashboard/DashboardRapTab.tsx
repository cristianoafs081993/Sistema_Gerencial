import { Flag, Lock, Receipt, Wallet } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';

type RapResumo = {
  origem: string;
  inscrito: number;
  pago: number;
  saldo: number;
  percentual: number;
};

type DashboardRapTabProps = {
  isLoading: boolean;
  rapTotalInscrito: number;
  rapTotalALiquidar: number;
  rapTotalLiquidado: number;
  rapTotalPago: number;
  filteredRapCount: number;
  dadosRapPorOrigem: RapResumo[];
};

export function DashboardRapTab({
  isLoading,
  rapTotalInscrito,
  rapTotalALiquidar,
  rapTotalLiquidado,
  rapTotalPago,
  filteredRapCount,
  dadosRapPorOrigem,
}: DashboardRapTabProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Inscrito"
          value={formatCurrency(rapTotalInscrito)}
          subtitle={`${filteredRapCount} RAPs`}
          icon={Flag}
          stitchColor="vibrant-blue"
          progress={100}
          isLoading={isLoading}
        />
        <StatCard
          title="A liquidar"
          value={formatCurrency(rapTotalALiquidar)}
          icon={Receipt}
          stitchColor="amber"
          progress={rapTotalInscrito > 0 ? (rapTotalALiquidar / rapTotalInscrito) * 100 : 0}
          isLoading={isLoading}
        />
        <StatCard
          title="Liquidado / a pagar"
          value={formatCurrency(rapTotalLiquidado)}
          icon={Lock}
          stitchColor="purple"
          progress={rapTotalInscrito > 0 ? (rapTotalLiquidado / rapTotalInscrito) * 100 : 0}
          isLoading={isLoading}
        />
        <StatCard
          title="Pago"
          value={formatCurrency(rapTotalPago)}
          icon={Wallet}
          stitchColor="emerald-green"
          progress={rapTotalLiquidado > 0 ? (rapTotalPago / rapTotalLiquidado) * 100 : 0}
          isLoading={isLoading}
        />
      </div>

      <Card className="card-system overflow-hidden">
        <CardHeader className="border-b border-border-default/50 px-6 py-4">
          <CardTitle className="table-title">Resumo de RAPs por Origem</CardTitle>
          <CardDescription>Acompanhamento de inscritos vs pagamentos efetivados</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-border-default/50 hover:bg-transparent">
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-wider">Origem de Recurso</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Inscrito Original</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Pago</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo Restante</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-wider">Taxa de Pgto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dadosRapPorOrigem.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center italic text-muted-foreground">
                      Nenhum RAP correspondente aos filtros foi encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  dadosRapPorOrigem.map((item, index) => (
                    <TableRow key={index} className="border-b transition-colors last:border-0 hover:bg-slate-50/80">
                      <TableCell className="px-6 py-4 text-sm font-medium">{item.origem}</TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm">{formatCurrency(item.inscrito)}</TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm">{formatCurrency(item.pago)}</TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm font-medium text-status-error">
                        {formatCurrency(item.saldo)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={Math.min(item.percentual, 100)} className="h-2 w-16" />
                          <span className="w-12 text-right text-sm text-muted-foreground">{item.percentual.toFixed(0)}%</span>
                        </div>
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
  );
}
