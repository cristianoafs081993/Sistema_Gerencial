import { parseMoney } from '../../../supabase/functions/_shared/pncpContracts';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Package,
  Receipt,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import {
  formatChaveNfe,
  buildNfePortalUrl,
  type PncpInstrumentoCobranca,
} from '@/services/pncpInstrumentosCobranca';
import type { ContratoApiFaturaRow } from '@/services/contratosApi';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const raw = value.slice(0, 10);
  const parts = raw.includes('/') ? raw.split('/') : raw.split('-');
  if (parts.length !== 3) return value;
  if (raw.includes('/')) return value;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
};

export interface ContratoNfeRastreabilidadeProps {
  instrumentos: PncpInstrumentoCobranca[];
  faturasApi: ContratoApiFaturaRow[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function ContratoNfeRastreabilidade({
  instrumentos,
  faturasApi,
  isLoading = false,
  onRefresh,
}: ContratoNfeRastreabilidadeProps) {
  const [copiedChave, setCopiedChave] = useState<string | null>(null);

  const handleCopyChave = (chave: string) => {
    navigator.clipboard.writeText(chave.replace(/\D/g, ''));
    setCopiedChave(chave);
    setTimeout(() => setCopiedChave(null), 2500);
  };

  // Mapeamento de faturas do Comprasnet por número do instrumento
  const faturaByNumero = new Map<string, ContratoApiFaturaRow>();
  for (const f of faturasApi) {
    if (f.numero_instrumento_cobranca) {
      faturaByNumero.set(f.numero_instrumento_cobranca.trim(), f);
      // fallback sem zeros à esquerda
      faturaByNumero.set(f.numero_instrumento_cobranca.trim().replace(/^0+/, ''), f);
    }
  }

  const totalNfeValor = instrumentos.reduce((sum, inst) =>
    sum + (parseMoney(inst.notaFiscal?.valorNotaFiscal) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header com métricas */}
      <div className="rounded-lg border border-border/80 bg-surface-subtle p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground">
                  Rastreabilidade de Notas Fiscais e Instrumentos de Cobrança (NF-e)
                </h4>
                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                  PNCP + SEFAZ
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chaves de 44 dígitos da SEFAZ, itens discriminados e conciliação direta com faturas atestadas no SIAFI.
              </p>
            </div>
          </div>

          {onRefresh ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onRefresh}
              disabled={isLoading}
              title="Consultar novamente no PNCP e atualizar banco de dados"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              <span>Atualizar</span>
            </Button>
          ) : null}
        </div>

        {/* Indicadores resumidos */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">NF-e no PNCP:</span>
            <span className="font-semibold text-xs text-foreground">
              {instrumentos.length} {instrumentos.length === 1 ? 'documento' : 'documentos'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Valor Total em Notas:</span>
            <span className="font-semibold text-xs text-status-success">{formatCurrency(totalNfeValor)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Faturas no Comprasnet:</span>
            <span className="font-semibold text-xs text-foreground">{faturasApi.length} faturas</span>
          </div>
        </div>
      </div>

      {/* Lista de Instrumentos de Cobrança */}
      {isLoading && instrumentos.length === 0 ? (
        <div className="py-8 text-center text-sm font-medium text-muted-foreground flex flex-col items-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span>Consultando instrumentos de cobrança no PNCP...</span>
        </div>
      ) : instrumentos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-foreground">
            Nenhum instrumento de cobrança ou NF-e sincronizado no banco para este contrato.
          </p>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto">
            Os órgãos e fornecedores publicam instrumentos de cobrança à medida que as notas fiscais são atestadas e transmitidas ao PNCP.
          </p>
          {onRefresh ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs text-action-primary border-action-primary/30"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              <span>Consultar no PNCP agora</span>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {instrumentos.map((inst) => {
            const numeroClean = inst.numeroInstrumentoCobranca.trim();
            const faturaConciliada = faturaByNumero.get(numeroClean) || faturaByNumero.get(numeroClean.replace(/^0+/, ''));
            const chave = inst.chaveNFe || inst.notaFiscal?.chaveNotaFiscal;
            const valorNfe = inst.notaFiscal?.valorNotaFiscal
              ? (typeof inst.notaFiscal.valorNotaFiscal === 'number'
                  ? inst.notaFiscal.valorNotaFiscal
                  : parseMoney(inst.notaFiscal.valorNotaFiscal))
              : (faturaConciliada?.valor_bruto || 0);

            return (
              <div
                key={`${inst.sequencialInstrumentoCobranca}-${inst.numeroInstrumentoCobranca}`}
                className="rounded-lg border border-border/80 bg-card p-4 shadow-sm hover:border-primary/40 transition-colors"
              >
                {/* Cabeçalho do Card */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        Nota Fiscal Nº {inst.numeroInstrumentoCobranca}
                      </span>
                      {inst.notaFiscal?.serie ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Série {inst.notaFiscal.serie}
                        </Badge>
                      ) : null}
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-status-success/10 text-status-success border-status-success/30 flex items-center gap-1"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        <span>{inst.notaFiscal?.tipoEventoMaisRecente || 'Autorizada SEFAZ'}</span>
                      </Badge>
                      {faturaConciliada ? (
                        <Badge variant="default" className="text-[10px] bg-action-primary text-white">
                          Conciliada no SIAFI ({faturaConciliada.situacao || 'Liquidada'})
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                          Pendente de Ateste Local
                        </Badge>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Emissão: <strong>{formatDate(inst.dataEmissaoDocumento)}</strong></span>
                      {inst.notaFiscal?.nomeFornecedor ? (
                        <span>Fornecedor: <strong>{inst.notaFiscal.nomeFornecedor}</strong> {inst.notaFiscal.cnpjFornecedor ? `(${inst.notaFiscal.cnpjFornecedor})` : ''}</span>
                      ) : null}
                      {inst.notaFiscal?.municipioFornecedor ? (
                        <span>Município: <strong>{inst.notaFiscal.municipioFornecedor}</strong></span>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-muted-foreground block">Valor da NF-e</span>
                    <span className="text-base font-bold text-status-success">
                      {formatCurrency(Number(valorNfe) || 0)}
                    </span>
                  </div>
                </div>

                {/* Bloco da Chave de Acesso de 44 Dígitos */}
                {chave ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-2.5 border border-border/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider shrink-0">
                          Chave NF-e:
                        </span>
                        <span className="font-mono text-xs text-foreground tracking-wide font-medium select-all break-all">
                          {formatChaveNfe(chave)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          onClick={() => handleCopyChave(chave)}
                          title="Copiar chave de acesso completa (44 dígitos)"
                        >
                          {copiedChave === chave ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                              <span className="text-status-success font-medium">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </Button>

                        <a
                          href={buildNfePortalUrl(chave)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-action-primary hover:underline px-2 py-1"
                          title="Consultar chave de acesso no Portal Nacional da NF-e da Receita Federal"
                        >
                          <span>Portal SEFAZ</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Tabela de Itens e Produtos da NF-e */}
                {inst.itens && inst.itens.length > 0 ? (
                  <Accordion type="single" collapsible className="mt-3">
                    <AccordionItem value="itens" className="border-0">
                      <AccordionTrigger className="py-2 text-xs font-medium text-action-primary hover:no-underline gap-1 justify-start">
                        <Package className="h-3.5 w-3.5" />
                        <span>Ver {inst.itens.length} {inst.itens.length === 1 ? 'item faturado' : 'itens faturados'} na nota fiscal</span>
                      </AccordionTrigger>
                      <AccordionContent className="pb-1 pt-2">
                        <div className="overflow-x-auto rounded-md border border-border/70">
                          <Table>
                            <TableHeader>
                              <TableRow className="text-[11px]">
                                <TableHead className="w-12">#</TableHead>
                                <TableHead>Descrição do Produto / Serviço</TableHead>
                                <TableHead>NCM / CFOP</TableHead>
                                <TableHead className="text-right">Qtd.</TableHead>
                                <TableHead className="text-right">Valor Unit.</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {inst.itens.map((item, idx) => {
                                const valUnit = typeof item.valorUnitario === 'number'
                                  ? item.valorUnitario
                                  : parseMoney(item.valorUnitario);
                                const valTot = typeof item.valor === 'number'
                                  ? item.valor
                                  : parseMoney(item.valor);

                                return (
                                  <TableRow key={idx} className="text-xs">
                                    <TableCell className="font-mono text-muted-foreground text-[11px]">
                                      {item.numeroProduto || idx + 1}
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground max-w-sm">
                                      {item.descricaoProdutoServico}
                                      {item.ncmSh ? (
                                        <span className="block text-[10px] text-muted-foreground">{item.ncmSh}</span>
                                      ) : null}
                                    </TableCell>
                                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                                      {item.codigoNcmSh || '-'}{item.cfop ? ` / ${item.cfop}` : ''}
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      {item.quantidade} {item.unidade}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {formatCurrency(valUnit || 0)}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-foreground">
                                      {formatCurrency(valTot || 0)}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
