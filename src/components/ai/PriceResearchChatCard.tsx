import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderPlus,
  Info,
  Scale,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  AssistenteGerencialPriceResearchCandidate,
  AssistenteGerencialPriceResearchData,
  AssistenteGerencialPriceResearchItem,
} from '@/lib/assistenteGerencialSessions';
import {
  buildDespachoConclusivoSuapText,
  exportPriceResearchHtml,
  exportPriceResearchWorkbook,
  type PriceResearchReportData,
} from '@/lib/priceResearch';
import { supabase } from '@/lib/supabase';
import { cn, formatCurrency } from '@/lib/utils';

type PriceResearchChatCardProps = {
  data: AssistenteGerencialPriceResearchData;
  className?: string;
};

export function PriceResearchChatCard({ data, className }: PriceResearchChatCardProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({ '1': true });
  const [selectedCandidateForModal, setSelectedCandidateForModal] = useState<AssistenteGerencialPriceResearchCandidate | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const toggleItem = (itemNumber: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [itemNumber]: !prev[itemNumber],
    }));
  };

  const handleCopyDespacho = async () => {
    try {
      const text = buildDespachoConclusivoSuapText(data);
      await navigator.clipboard.writeText(text);
      toast.success('Minuta do Despacho Conclusivo copiada para a área de transferência!');
    } catch {
      toast.error('Não foi possível copiar o despacho.');
    }
  };

  const handleDownloadReportHtml = () => {
    try {
      const reportData: PriceResearchReportData = {
        title: data.title,
        demandSummary: data.demandSummary,
        processNumber: data.processNumber || '',
        researchDate: data.researchDate,
        method: data.calculationMethod,
        institutionName: 'Instituto Federal do Rio Grande do Norte - Campus Currais Novos',
        institutionUnit: 'Diretoria de Administração e Planejamento',
        institutionDetails: 'Pesquisa de Preços automatizada com validação de Editais e TRs no PNCP',
        overallEstimatedTotal: data.overallEstimatedTotal,
        methodologyJustification: data.methodologyJustification || '',
        items: data.items.map((i) => ({
          id: `item-${i.itemNumber}`,
          itemNumber: i.itemNumber,
          description: i.description,
          detailedSpecification: i.detailedSpecification || '',
          catalogType: i.catalogType,
          catalogCode: i.catalogCode,
          quantity: i.quantity,
          unit: i.unit,
          capacity: 1,
          capacityUnit: i.unit,
          candidates: i.candidates.map((c) => ({
            id: c.id,
            sourceType: (c.sourceType as any) || 'compras_gov_precos',
            sourceLabel: 'Compras.gov.br / PNCP',
            supplierName: c.supplierName,
            supplierDocument: c.supplierDocument,
            agencyName: c.agencyName,
            agencyCode: c.agencyCode || '',
            purchaseId: c.purchaseId,
            purchaseItemId: c.purchaseItemId || '1',
            purchaseDate: c.purchaseDate,
            resultDate: c.resultDate,
            originalUnitPrice: c.unitPrice,
            comparableUnitPrice: c.comparableUnitPrice,
            originalUnitLabel: c.originalUnitLabel || i.unit,
            unitCompatible: c.unitCompatible,
            selected: c.selected,
            exclusionReason: c.exclusionReason || '',
            sourceUrl: c.pncpUrl || `https://pncp.gov.br/app/editais`,
            pncpSearchUrl: c.pncpUrl,
            aiScore: c.editalScore,
            aiReason: c.technicalJustification,
          })),
        })),
      };

      exportPriceResearchHtml(reportData);
      toast.success('Mapa Comparativo de Preços exportado em HTML/PDF!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório de pesquisa.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const reportData: PriceResearchReportData = {
        title: data.title,
        demandSummary: data.demandSummary,
        processNumber: data.processNumber || '',
        researchDate: data.researchDate,
        method: data.calculationMethod,
        institutionName: 'Instituto Federal do Rio Grande do Norte - Campus Currais Novos',
        institutionUnit: 'Diretoria de Administração e Planejamento',
        institutionDetails: 'Memória de Cálculo de Pesquisa de Preços (Lei 14.133/2021)',
        overallEstimatedTotal: data.overallEstimatedTotal,
        methodologyJustification: data.methodologyJustification || '',
        items: data.items.map((i) => ({
          id: `item-${i.itemNumber}`,
          itemNumber: i.itemNumber,
          description: i.description,
          detailedSpecification: i.detailedSpecification || '',
          catalogType: i.catalogType,
          catalogCode: i.catalogCode,
          quantity: i.quantity,
          unit: i.unit,
          capacity: 1,
          capacityUnit: i.unit,
          candidates: i.candidates.map((c) => ({
            id: c.id,
            sourceType: (c.sourceType as any) || 'compras_gov_precos',
            sourceLabel: 'Compras.gov.br / PNCP',
            supplierName: c.supplierName,
            supplierDocument: c.supplierDocument,
            agencyName: c.agencyName,
            agencyCode: c.agencyCode || '',
            purchaseId: c.purchaseId,
            purchaseItemId: c.purchaseItemId || '1',
            purchaseDate: c.purchaseDate,
            resultDate: c.resultDate,
            originalUnitPrice: c.unitPrice,
            comparableUnitPrice: c.comparableUnitPrice,
            originalUnitLabel: c.originalUnitLabel || i.unit,
            unitCompatible: c.unitCompatible,
            selected: c.selected,
            exclusionReason: c.exclusionReason || '',
            sourceUrl: c.pncpUrl || `https://pncp.gov.br/app/editais`,
            pncpSearchUrl: c.pncpUrl,
            aiScore: c.editalScore,
            aiReason: c.technicalJustification,
          })),
        })),
      };

      await exportPriceResearchWorkbook(reportData);
      toast.success('Planilha Excel (.xlsx) baixada com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar planilha Excel.');
    }
  };

  const handleSaveToDatabase = async () => {
    setIsSaving(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp.user?.id;
      if (!userId) {
        toast.error('Faça login para salvar a pesquisa no repositório.');
        return;
      }

      // Insert into price_researches
      const { data: insertedResearch, error: resError } = await supabase
        .from('price_researches')
        .insert({
          user_id: userId,
          title: data.title,
          status: 'completed',
          calculation_method: data.calculationMethod,
          institution_name: 'IFRN Campus Currais Novos',
          institution_unit: 'Diretoria de Administração e Planejamento',
          methodology_justification: data.methodologyJustification,
          notes: data.demandSummary,
        })
        .select('id')
        .single();

      if (resError || !insertedResearch?.id) {
        throw new Error(resError?.message || 'Erro ao registrar pesquisa de preços.');
      }

      const researchId = insertedResearch.id;

      // Insert items
      for (const item of data.items) {
        await supabase.from('price_research_items').insert({
          research_id: researchId,
          item_number: parseInt(item.itemNumber, 10) || 1,
          description: item.description,
          detailed_specification: item.detailedSpecification,
          catalog_type: item.catalogType,
          catalog_code: item.catalogCode,
          quantity: item.quantity,
          unit: item.unit,
          candidates_count: item.candidatesCount,
          raw_candidates: item.candidates,
        });
      }

      toast.success('Pesquisa salva com sucesso no módulo de Pesquisas de Preços!');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível persistir a pesquisa no banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalAuditedEditais = data.items.reduce(
    (acc, i) => acc + i.candidates.filter((c) => c.editalAudited).length,
    0,
  );

  return (
    <div
      className={cn(
        'mt-3 overflow-hidden rounded-xl border border-primary/20 bg-card/95 text-card-foreground shadow-sm transition-all',
        className,
      )}
    >
      {/* Header Banner */}
      <div className="bg-primary/5 px-4 py-3 border-b border-primary/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Scale className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-xs font-bold text-foreground">
                Pesquisa de Preços Normativa (IN 65/2021)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                {data.items.length} {data.items.length === 1 ? 'item pesquisado' : 'itens pesquisados'} • {totalAuditedEditais} editais/TRs auditados no PNCP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge
              variant={data.complianceValid ? 'default' : 'secondary'}
              className="text-[10px] uppercase font-semibold tracking-wide"
            >
              {data.complianceValid ? 'Cesta Válida' : 'Atenção Normativa'}
            </Badge>
          </div>
        </div>

        {/* Metric Summary */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-background/60 p-2 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Valor Total Estimado</p>
            <p className="text-sm font-extrabold text-primary">{formatCurrency(data.overallEstimatedTotal)}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-2 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Método Central</p>
            <p className="text-sm font-bold capitalize text-foreground">{data.calculationMethod === 'median' ? 'Mediana' : data.calculationMethod}</p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-2 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Cotações Coletadas</p>
            <p className="text-sm font-bold text-foreground">
              {data.items.reduce((acc, i) => acc + i.candidates.length, 0)} cotações
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-2 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase">Homogeneidade</p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {data.items.every((i) => i.coefficientOfVariation <= 25) ? 'CV ≤ 25% (Aprovado)' : 'CV > 25%'}
            </p>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="divide-y divide-border/60">
        {data.items.map((item) => {
          const isExpanded = expandedItems[item.itemNumber] ?? false;

          return (
            <div key={item.itemNumber} className="p-3">
              <button
                type="button"
                onClick={() => toggleItem(item.itemNumber)}
                className="flex w-full items-center justify-between gap-3 text-left focus:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {item.itemNumber}
                    </span>
                    <span className="truncate text-xs font-bold text-foreground">
                      {item.description}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Qtd: {item.quantity} {item.unit} • Unitário Estimado: <strong>{formatCurrency(item.estimatedUnitPrice)}</strong> • Total: <strong>{formatCurrency(item.estimatedTotal)}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    CV: {item.coefficientOfVariation.toFixed(1)}%
                  </Badge>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded ? (
                <div className="mt-3 space-y-2 pt-2 border-t border-dashed border-border">
                  <p className="text-[11px] font-semibold text-foreground">Cotações Públicas & Auditoria de Editais:</p>
                  
                  <div className="space-y-1.5">
                    {item.candidates.map((cand) => {
                      const isExcluded = !cand.selected || cand.compatibility === 'INCOMPATIVEL';

                      return (
                        <div
                          key={cand.id}
                          className={cn(
                            'flex flex-col gap-1 rounded-lg border p-2.5 text-xs transition-colors',
                            isExcluded
                              ? 'border-destructive/20 bg-destructive/[0.03] opacity-80'
                              : 'border-border/70 bg-background/80 hover:border-primary/40'
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">
                                {cand.agencyName || 'Órgão Público'}
                              </span>
                              {cand.supplierDocument ? (
                                <span className="text-[10px] text-muted-foreground">({cand.supplierDocument})</span>
                              ) : null}
                            </div>
                            <span className={cn('font-extrabold', isExcluded ? 'text-muted-foreground line-through' : 'text-primary')}>
                              {formatCurrency(cand.comparableUnitPrice)} / {cand.originalUnitLabel || item.unit}
                            </span>
                          </div>

                          {cand.itemDescription ? (
                            <p className="text-[11px] text-foreground/80 line-clamp-1">
                              <strong>Objeto:</strong> {cand.itemDescription}
                            </p>
                          ) : null}

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span>PNCP: {cand.purchaseId}</span>
                            {cand.purchaseDate ? <span>• Data: {cand.purchaseDate}</span> : null}
                            {isExcluded ? (
                              <span className="font-medium text-destructive">• Desconsiderado do cálculo</span>
                            ) : null}
                          </div>

                          {/* Edital Audit Status */}
                          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-1.5">
                            <div className="flex items-center gap-1.5">
                              {cand.compatibility === 'INCOMPATIVEL' ? (
                                <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-medium flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  Incompatível (0%)
                                </Badge>
                              ) : cand.compatibility === 'COMPATIVEL_COM_RESSALVA' ? (
                                <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] font-medium flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {cand.editalPage ? `Auditado (${cand.editalPage})` : 'Auditado c/ Ressalva'}
                                </Badge>
                              ) : cand.editalAudited ? (
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-medium flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  {cand.editalPage ? `Auditado (${cand.editalPage})` : 'Edital Auditado'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  PNCP Registrado
                                </Badge>
                              )}

                              {cand.editalScore && cand.compatibility !== 'INCOMPATIVEL' ? (
                                <span className="text-[10px] font-semibold text-muted-foreground">
                                  Similaridade: {cand.editalScore}%
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1">
                              {cand.editalExcerpt || cand.technicalJustification ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
                                  onClick={() => setSelectedCandidateForModal(cand)}
                                >
                                  <Sparkles className="mr-1 h-3 w-3" />
                                  Ver Parecer TR
                                </Button>
                              ) : null}

                              {cand.documentUrl || cand.pncpUrl ? (
                                <a
                                  href={cand.documentUrl || cand.pncpUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {cand.documentUrl ? 'Edital PDF' : 'PNCP'}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Action Bar for Documents */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadReportHtml}
            className="h-8 text-xs font-semibold"
            title="Baixar Mapa Comparativo com memória de cálculo e evidências"
          >
            <FileText className="mr-1.5 h-3.5 w-3.5 text-primary" />
            Mapa Comparativo (PDF)
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyDespacho}
            className="h-8 text-xs font-semibold"
            title="Copiar Despacho Conclusivo formatado para processo no SUAP"
          >
            <Copy className="mr-1.5 h-3.5 w-3.5 text-primary" />
            Despacho SUAP
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="h-8 text-xs font-semibold"
            title="Exportar planilha Excel completa"
          >
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Excel (.xlsx)
          </Button>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSaveToDatabase}
          disabled={isSaving}
          className="h-8 text-xs font-semibold"
          title="Salvar esta pesquisa no módulo do sistema (/pesquisa-precos)"
        >
          <FolderPlus className="mr-1.5 h-3.5 w-3.5 text-primary" />
          {isSaving ? 'Salvando...' : 'Salvar no Módulo'}
        </Button>
      </div>

      {/* Dialog: Edital / TR Excerpt Inspector */}
      {selectedCandidateForModal ? (
        <Dialog open={Boolean(selectedCandidateForModal)} onOpenChange={() => setSelectedCandidateForModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <Sparkles className="h-4 w-4 text-primary" />
                Auditoria de Edital / TR (IA Gemini)
              </DialogTitle>
              <DialogDescription className="text-xs">
                {selectedCandidateForModal.agencyName} • {selectedCandidateForModal.purchaseId}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              {selectedCandidateForModal.itemDescription ? (
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="font-semibold text-foreground">Item Registrado na Licitação:</p>
                  <p className="mt-0.5 text-muted-foreground">{selectedCandidateForModal.itemDescription}</p>
                </div>
              ) : null}

              {selectedCandidateForModal.editalPage ? (
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <p className="font-semibold text-foreground">Localização no Documento:</p>
                  <p className="text-muted-foreground">{selectedCandidateForModal.editalPage}</p>
                </div>
              ) : null}

              {selectedCandidateForModal.editalExcerpt ? (
                <div className="rounded-lg border border-border bg-background p-2.5">
                  <p className="font-semibold text-foreground">Trecho Literal Extraído do Edital/TR:</p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    "{selectedCandidateForModal.editalExcerpt}"
                  </p>
                </div>
              ) : null}

              {selectedCandidateForModal.technicalJustification ? (
                <div
                  className={cn(
                    'rounded-lg border p-2.5',
                    selectedCandidateForModal.compatibility === 'INCOMPATIVEL'
                      ? 'bg-destructive/10 border-destructive/20 text-destructive'
                      : selectedCandidateForModal.compatibility === 'COMPATIVEL_COM_RESSALVA'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-950 dark:text-amber-200'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-950 dark:text-emerald-200'
                  )}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {selectedCandidateForModal.compatibility === 'INCOMPATIVEL' ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {selectedCandidateForModal.compatibility === 'INCOMPATIVEL'
                      ? 'Parecer de Incompatibilidade Técnica (Item Excluído):'
                      : 'Parecer de Similaridade Técnica:'}
                  </p>
                  <p className="mt-0.5 leading-relaxed">{selectedCandidateForModal.technicalJustification}</p>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {selectedCandidateForModal.documentTitle ? (
                  <span className="text-[11px] text-muted-foreground truncate max-w-[260px]" title={selectedCandidateForModal.documentTitle}>
                    📄 {selectedCandidateForModal.documentTitle}
                  </span>
                ) : <span />}

                <div className="flex items-center gap-2">
                  {selectedCandidateForModal.documentUrl ? (
                    <a
                      href={selectedCandidateForModal.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir PDF do Edital / TR
                    </a>
                  ) : null}

                  {selectedCandidateForModal.pncpUrl ? (
                    <a
                      href={selectedCandidateForModal.pncpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver no PNCP
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
