import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ChartPanel } from '@/components/design-system/ChartPanel';
import { Button } from '@/components/ui/button';
import { HeaderActions } from '@/components/HeaderParts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatCurrency } from '@/lib/utils';
import {
  parseRapHistoricoAnualFile,
  rapHistoricoAnualService,
} from '@/services/rapHistoricoAnual';
import { buildRapHistoricoAnualEvolution } from '@/utils/rapHistoricoAnual';
import { ExecutionTooltip } from './DashboardChartBits';
import { formatCompactCurrency } from './utils';

const RAP_ANNUAL_COLORS = {
  processadoInscrito: '#2563eb',
  naoProcessadoInscrito: '#10b981',
  naoProcessadoReinscrito: '#f59e0b',
  total: '#7c3aed',
};

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

export function DashboardRapAnnualEvolutionPanel() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedUg, setSelectedUg] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [visibleKeys, setVisibleKeys] = useState<string[]>([
    'processadoInscrito',
    'naoProcessadoInscrito',
    'naoProcessadoReinscrito',
    'total',
  ]);

  const toggleKey = (key: string, forceIsolate = false) => {
    setVisibleKeys((prev) => {
      if (forceIsolate) {
        if (prev.length === 1 && prev.includes(key)) {
          return ['processadoInscrito', 'naoProcessadoInscrito', 'naoProcessadoReinscrito', 'total'];
        }
        return [key];
      }

      if (prev.includes(key)) {
        if (prev.length === 1) {
          return ['processadoInscrito', 'naoProcessadoInscrito', 'naoProcessadoReinscrito', 'total'];
        }
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  const { data: report = { rows: [], sourceFile: '', importedAt: '' }, isLoading } = useQuery({
    queryKey: ['rap-historico-anual', 'latest'],
    queryFn: () => rapHistoricoAnualService.getLatestReport(),
    staleTime: 30000,
  });

  const ugOptions = useMemo(() => {
    const map = new Map<string, string>();
    report.rows.forEach((row) => {
      if (!row.ugExecutora) return;
      if (!map.has(row.ugExecutora)) map.set(row.ugExecutora, row.ugNome || row.ugExecutora);
    });
    return Array.from(map.entries())
      .map(([codigo, nome]) => ({ codigo, nome }))
      .sort((left, right) => left.codigo.localeCompare(right.codigo));
  }, [report.rows]);

  const selectedUgLabel = useMemo(() => {
    const option = ugOptions.find((item) => item.codigo === selectedUg);
    if (!option) return '';
    return option.nome && option.nome !== option.codigo ? `${option.codigo} - ${option.nome}` : option.codigo;
  }, [selectedUg, ugOptions]);

  const chartData = useMemo(
    () => (selectedUg ? buildRapHistoricoAnualEvolution(report.rows, selectedUg) : []),
    [report.rows, selectedUg],
  );

  const hasRows = report.rows.length > 0;
  const hasSelection = Boolean(selectedUg);

  const handleUpload = async (file?: File) => {
    if (!file) return;

    setIsUploading(true);
    const toastId = toast.loading('Processando histórico anual de RAP...');

    try {
      const rows = await parseRapHistoricoAnualFile(file);
      await rapHistoricoAnualService.importReport(rows, file.name);
      await queryClient.invalidateQueries({ queryKey: ['rap-historico-anual'] });
      setSelectedUg('');
      toast.success(`${rows.length} linha(s) importada(s) do histórico anual de RAP.`, { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível importar o histórico anual de RAP.', { id: toastId });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <ChartPanel
      title="Evolução anual dos restos a pagar"
      description={
        report.importedAt
          ? `Último histórico importado em ${formatDateTime(report.importedAt)}`
          : 'Histórico agregado por UG e ano'
      }
      loading={isLoading}
      heightClassName="h-[380px]"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,360px)_auto] sm:items-center">
            <Select value={selectedUg} onValueChange={setSelectedUg} disabled={!hasRows}>
              <SelectTrigger aria-label="Selecionar UG do histórico RAP">
                <SelectValue placeholder={hasRows ? 'Selecionar UG' : 'Nenhum histórico importado'} />
              </SelectTrigger>
              <SelectContent>
                {ugOptions.map((option) => (
                  <SelectItem key={option.codigo} value={option.codigo}>
                    {option.codigo} - {option.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedUgLabel ? (
              <span className="font-ui text-xs font-semibold text-text-muted">{selectedUgLabel}</span>
            ) : null}
          </div>

          {isSuperAdmin ? (
            <HeaderActions>
              <input
                ref={inputRef}
                className="hidden"
                type="file"
                accept=".csv"
                onChange={(event) => void handleUpload(event.target.files?.[0])}
              />
              <Button
                type="button"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar histórico RAP
              </Button>
            </HeaderActions>
          ) : null}
        </div>

        {!hasRows ? (
          <div className="flex h-[260px] items-center justify-center rounded-[22px] border border-dashed border-border-default/80 bg-surface-subtle/40 px-6 text-center">
            <div>
              <FileSpreadsheet className="mx-auto h-8 w-8 text-text-muted" />
              <p className="mt-3 font-ui text-sm font-semibold text-text-primary">Nenhum histórico anual de RAP importado.</p>
              <p className="mt-1 font-ui text-xs text-text-muted">Importe o CSV agregado para habilitar a evolução por UG.</p>
            </div>
          </div>
        ) : !hasSelection ? (
          <div className="flex h-[260px] items-center justify-center rounded-[22px] border border-dashed border-border-default/80 bg-surface-subtle/40 px-6 text-center">
            <div>
              <p className="font-ui text-sm font-semibold text-text-primary">Selecione uma UG para visualizar a série anual.</p>
              <p className="mt-1 font-ui text-xs text-text-muted">{ugOptions.length} UG(s) disponíveis no último histórico importado.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <LegendPill
                color={RAP_ANNUAL_COLORS.processadoInscrito}
                label="Processado inscrito"
                active={visibleKeys.includes('processadoInscrito')}
                onClick={(e) => toggleKey('processadoInscrito', e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)}
              />
              <LegendPill
                color={RAP_ANNUAL_COLORS.naoProcessadoInscrito}
                label="Não processado inscrito"
                active={visibleKeys.includes('naoProcessadoInscrito')}
                onClick={(e) => toggleKey('naoProcessadoInscrito', e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)}
              />
              <LegendPill
                color={RAP_ANNUAL_COLORS.naoProcessadoReinscrito}
                label="Não processado reinscrito"
                active={visibleKeys.includes('naoProcessadoReinscrito')}
                onClick={(e) => toggleKey('naoProcessadoReinscrito', e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)}
              />
              <LegendPill
                color={RAP_ANNUAL_COLORS.total}
                label="Total"
                active={visibleKeys.includes('total')}
                onClick={(e) => toggleKey('total', e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)}
              />
              <span className="font-ui text-[10px] text-text-muted select-none ml-2">
                (Clique para alternar • Alt/Shift+Clique para isolar)
              </span>
            </div>

            <div className="h-[380px] rounded-[22px] border border-border-default/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,0.85))] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe3f0" />
                  <XAxis dataKey="ano" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={74}
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                    tickFormatter={formatCompactCurrency}
                  />
                  <Tooltip content={<ExecutionTooltip />} cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }} />
                  <Bar
                    dataKey="processadoInscrito"
                    stackId="rap"
                    name="Processado inscrito"
                    fill={RAP_ANNUAL_COLORS.processadoInscrito}
                    radius={[0, 0, 0, 0]}
                    hide={!visibleKeys.includes('processadoInscrito')}
                  />
                  <Bar
                    dataKey="naoProcessadoInscrito"
                    stackId="rap"
                    name="Não processado inscrito"
                    fill={RAP_ANNUAL_COLORS.naoProcessadoInscrito}
                    radius={[0, 0, 0, 0]}
                    hide={!visibleKeys.includes('naoProcessadoInscrito')}
                  />
                  <Bar
                    dataKey="naoProcessadoReinscrito"
                    stackId="rap"
                    name="Não processado reinscrito"
                    fill={RAP_ANNUAL_COLORS.naoProcessadoReinscrito}
                    radius={[6, 6, 0, 0]}
                    hide={!visibleKeys.includes('naoProcessadoReinscrito')}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke={RAP_ANNUAL_COLORS.total}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: RAP_ANNUAL_COLORS.total }}
                    activeDot={{ r: 4 }}
                    hide={!visibleKeys.includes('total')}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ano</TableHead>
                  <TableHead className="text-right">Processado</TableHead>
                  <TableHead className="text-right">Não processado</TableHead>
                  <TableHead className="text-right">Reinscrito</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chartData.map((row) => (
                  <TableRow key={row.ano}>
                    <TableCell className="font-mono text-xs font-semibold">{row.ano}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(row.processadoInscrito)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(row.naoProcessadoInscrito)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCurrency(row.naoProcessadoReinscrito)}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-primary">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </ChartPanel>
  );
}

function LegendPill({
  color,
  label,
  active,
  onClick,
}: {
  color: string;
  label: string;
  active: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Clique para ocultar/exibir. Alt/Shift+Clique para isolar."
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-200 cursor-pointer select-none",
        active ? "opacity-100 hover:brightness-95" : "opacity-40 hover:opacity-75"
      )}
      style={{
        backgroundColor: active ? `${color}14` : '#f1f5f9',
        color: active ? color : '#64748b',
        borderColor: active ? `${color}33` : '#cbd5e1'
      }}
    >
      <span
        className="h-2 w-2 rounded-full transition-all duration-200"
        style={{
          backgroundColor: active ? color : 'transparent',
          border: `1.5px solid ${active ? 'transparent' : '#64748b'}`
        }}
      />
      {label}
    </button>
  );
}
