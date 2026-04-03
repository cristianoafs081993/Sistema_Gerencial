import { useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { TableSkeletonRows } from '@/components/design-system/TableSkeletonRows';
import { HeaderActions } from '@/components/HeaderParts';
import {
  FinanceiroDisponivelCard,
  aggregateFinanceiroDisponivel,
  loadLatestFinanceiroCardsFromDb,
  parseFinanceiroCsv,
  saveFinanceiroRows,
} from '@/services/financeiroImportService';

export default function Financeiro() {
  const [cards, setCards] = useState<FinanceiroDisponivelCard[]>([]);
  const [fileName, setFileName] = useState('');
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cardsComSaldo = useMemo(
    () => cards.filter((card) => (card.saldoDisponivel || 0) > 0),
    [cards],
  );

  const formatCurrency = (value: number | null) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  const loadLatest = async () => {
    try {
      setIsLoadingInitial(true);
      const latest = await loadLatestFinanceiroCardsFromDb();
      setCards(latest.cards);
      setFileName(latest.sourceFile);
    } catch (error) {
      console.error('Erro ao carregar financeiro do banco:', error);
    } finally {
      setIsLoadingInitial(false);
    }
  };

  useEffect(() => {
    loadLatest();
  }, []);

  const handleUpload = async (file?: File) => {
    if (!file) return;

    try {
      setIsUploading(true);
      const rows = await parseFinanceiroCsv(file);
      await saveFinanceiroRows(rows, file.name);
      const nextCards = aggregateFinanceiroDisponivel(rows);
      setCards(nextCards);
      setFileName(file.name);
    } catch (error) {
      console.error('Erro ao importar financeiro:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderActions>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            variant="outline"
            disabled={isUploading}
            className="gap-space-2 h-space-9 shadow-shadow-sm"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Carregando...' : 'Upload CSV Financeiro'}
          </Button>
        </div>
      </HeaderActions>

      <DataTablePanel
        title="Financeiro Disponivel por Fonte e Vinculacao"
      >
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="hover:bg-transparent border-b border-border-default/50">
              <TableHead className="px-6 py-3 text-xs font-semibold uppercase tracking-wider">Fonte</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Descricao da Fonte</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Vinculacao</TableHead>
              <TableHead className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Descricao da Vinculacao</TableHead>
              <TableHead className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider">Disponivel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingInitial || isUploading ? (
              <TableSkeletonRows
                rows={8}
                columns={5}
                widths={['w-20', 'w-56', 'w-20', 'w-64', 'w-24 ml-auto']}
              />
            ) : cardsComSaldo.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground italic">
                  Nenhum registro com saldo disponivel.
                </TableCell>
              </TableRow>
            ) : (
              cardsComSaldo.map((card) => (
                <TableRow key={`${card.fonteCodigo}-${card.vinculacaoCodigo}`} className="border-b border-border-default/30 last:border-0">
                  <TableCell className="px-6 py-3 font-mono text-xs font-semibold">{card.fonteCodigo}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">{card.fonteDescricao || '-'}</TableCell>
                  <TableCell className="px-4 py-3 font-mono text-xs font-semibold">{card.vinculacaoCodigo}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">{card.vinculacaoDescricao || '-'}</TableCell>
                  <TableCell className="px-6 py-3 text-right font-bold text-sm text-action-primary">
                    {formatCurrency(card.saldoDisponivel)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTablePanel>
    </div>
  );
}
