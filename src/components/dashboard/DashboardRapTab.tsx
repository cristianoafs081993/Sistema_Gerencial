import { useState } from 'react';
import { Flag, Lock, Receipt, Wallet } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { DashboardRapAnnualEvolutionPanel } from './DashboardRapAnnualEvolutionPanel';
import { DashboardRapOrigemEmpenhosModal } from './DashboardRapOrigemEmpenhosModal';
import type { Atividade, Empenho } from '@/types';

type RapResumo = {
  origem: string;
  baseVigente: number;
  liquidadoNoAno: number;
  saldoAtual: number;
  percentual: number;
};

type DashboardRapTabProps = {
  isLoading: boolean;
  rapTotalInscrito: number;
  rapTotalReinscrito: number;
  rapTotalLiquidadoNoAno: number;
  rapTotalSaldoAtual: number;
  filteredRapCount: number;
  dadosRapPorOrigem: RapResumo[];
  empenhosRap?: Empenho[];
  rapReferenceYear?: number;
  atividades?: Atividade[];
  onSaveEmpenho?: (updated: Empenho) => Promise<void> | void;
};

export function DashboardRapTab({
  isLoading,
  rapTotalInscrito,
  rapTotalReinscrito,
  rapTotalLiquidadoNoAno,
  rapTotalSaldoAtual,
  filteredRapCount,
  dadosRapPorOrigem,
  empenhosRap = [],
  rapReferenceYear = new Date().getFullYear(),
  atividades = [],
  onSaveEmpenho,
}: DashboardRapTabProps) {
  const [selectedOrigem, setSelectedOrigem] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const rapTotalBaseVigente = rapTotalInscrito + rapTotalReinscrito;

  const handleRowClick = (origem: string) => {
    setSelectedOrigem(origem);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Inscrito"
          value={formatCurrency(rapTotalInscrito)}
          subtitle="Ano anterior"
          icon={Flag}
          stitchColor="vibrant-blue"
          progress={rapTotalBaseVigente > 0 ? (rapTotalInscrito / rapTotalBaseVigente) * 100 : 0}
          isLoading={isLoading}
        />
        <StatCard
          title="Reinscrito"
          value={formatCurrency(rapTotalReinscrito)}
          subtitle={`${filteredRapCount} RAPs filtrados`}
          icon={Receipt}
          stitchColor="amber"
          progress={rapTotalBaseVigente > 0 ? (rapTotalReinscrito / rapTotalBaseVigente) * 100 : 0}
          isLoading={isLoading}
        />
        <StatCard
          title="Liquidado no ano"
          value={formatCurrency(rapTotalLiquidadoNoAno)}
          icon={Lock}
          stitchColor="purple"
          progress={rapTotalBaseVigente > 0 ? (rapTotalLiquidadoNoAno / rapTotalBaseVigente) * 100 : 0}
          isLoading={isLoading}
        />
        <StatCard
          title="Saldo atual"
          value={formatCurrency(rapTotalSaldoAtual)}
          icon={Wallet}
          stitchColor="emerald-green"
          progress={rapTotalBaseVigente > 0 ? (rapTotalSaldoAtual / rapTotalBaseVigente) * 100 : 0}
          isLoading={isLoading}
        />
      </div>

      <DashboardRapAnnualEvolutionPanel />

      <Card className="card-system overflow-hidden">
        <CardHeader className="border-b border-border-default/50 px-6 py-4">
          <CardTitle className="text-lg sm:text-xl font-bold text-text-primary">RAP por origem de recurso</CardTitle>
          <CardDescription>
            Liquidado no exercício e saldo remanescente (clique na linha para ver os empenhos com saldo)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-b border-border-default/50 hover:bg-transparent">
                  <TableHead className="h-11 px-6 text-xs font-semibold uppercase tracking-wider">Origem de Recurso</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Inscrito / Reinscrito</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Liquidado no Ano</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider">Saldo Atual</TableHead>
                  <TableHead className="h-11 px-6 text-right text-xs font-semibold uppercase tracking-wider">Taxa de Liquidação</TableHead>
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
                    <TableRow
                      key={index}
                      className="border-b transition-colors last:border-0 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 cursor-pointer group"
                      onClick={() => handleRowClick(item.origem)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(item.origem);
                        }
                      }}
                      title={`Clique para ver os empenhos com saldo da origem ${item.origem}`}
                    >
                      <TableCell className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                            {item.origem}
                          </span>
                          <span className="text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 font-normal">
                            (ver empenhos)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm">{formatCurrency(item.baseVigente)}</TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm">{formatCurrency(item.liquidadoNoAno)}</TableCell>
                      <TableCell className="px-4 py-4 text-right text-sm font-medium text-status-error">
                        {formatCurrency(item.saldoAtual)}
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

      <DashboardRapOrigemEmpenhosModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        origem={selectedOrigem}
        empenhos={empenhosRap}
        rapReferenceYear={rapReferenceYear}
        atividades={atividades}
        onSaveEmpenho={onSaveEmpenho}
      />
    </div>
  );
}
