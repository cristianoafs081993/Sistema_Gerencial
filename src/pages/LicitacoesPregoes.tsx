import type { ReactNode } from 'react';
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw, RotateCw, Search } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { TablePagination } from '@/components/design-system/TablePagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import { IFRN_UASG_CATALOG } from '@/lib/licitacoesPncp';
import {
  getLicitacaoLinks,
  getProposalStatus,
  licitacoesPncpService,
  type LicitacaoPncpProposalStatus,
  type LicitacaoPncpRow,
  type LicitacaoPncpSrpFilter,
} from '@/services/licitacoesPncp';

const proposalOptions: Array<{ value: LicitacaoPncpProposalStatus; label: string }> = [
  { value: 'todos', label: 'Todos os prazos' },
  { value: 'abertas', label: 'Propostas abertas' },
  { value: 'futuras', label: 'Abertura futura' },
  { value: 'encerradas', label: 'Encerradas' },
];

const srpOptions: Array<{ value: LicitacaoPncpSrpFilter; label: string }> = [
  { value: 'todos', label: 'SRP e tradicional' },
  { value: 'sim', label: 'Somente SRP' },
  { value: 'nao', label: 'Sem SRP' },
];

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultStartDate() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 364);
  return toDateInputValue(start);
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function rawText(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function rawNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function getPncpItems(rawData: Record<string, unknown>) {
  return Array.isArray(rawData.itens)
    ? rawData.itens.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    : [];
}

function getPncpItemDescription(item: Record<string, unknown>) {
  return rawText(item.descricao)
    ?? rawText(item.descricaoItem)
    ?? rawText(item.descricaoDetalhada)
    ?? rawText(item.itemDescricao)
    ?? '-';
}

function getPncpItemNumber(item: Record<string, unknown>) {
  return rawText(item.numeroItem) ?? rawText(item.numero_item) ?? rawText(item.itemNumero) ?? '-';
}

function formatUasg(row: LicitacaoPncpRow) {
  if (!row.uasgCodigo) return '-';
  return `${row.uasgCodigo}${row.uasgNome ? ` - ${row.uasgNome}` : ''}`;
}

function proposalBadgeClass(status: string) {
  if (status === 'Aberta') return 'border-primary/20 bg-primary/[0.08] text-primary';
  if (status === 'Futura') return 'border-info/20 bg-info/[0.08] text-info';
  if (status === 'Encerrada') return 'border-border bg-muted/60 text-muted-foreground';
  return 'border-warning/20 bg-warning/[0.08] text-warning';
}

function FilterField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</p>
      <div className="mt-1 font-ui text-sm font-semibold text-text-primary">{value || '-'}</div>
    </div>
  );
}

function formatLicitacaoNumero(numeroCompra: string | null | undefined, anoCompra: number | null | undefined): string {
  if (!numeroCompra || !anoCompra) return '';
  const cleanNum = numeroCompra.replace(/\D/g, '');
  const paddedNum = cleanNum.padStart(5, '0');
  return `${paddedNum}${anoCompra}`;
}

function getTransparencyModalidadeCode(pncpModalidadeId: number | null | undefined): string {
  if (!pncpModalidadeId) return '5';
  if (pncpModalidadeId === 5 || pncpModalidadeId === 6) {
    return '5';
  }
  return String(pncpModalidadeId);
}

function normalizeText(val: string | null | undefined): string {
  return String(val ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function parseNumeric(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const clean = String(val)
    .replace(/\./g, '')
    .replace(',', '.');
  return Number(clean) || 0;
}

function LicitacaoDetailsDialog({
  licitacao,
  onOpenChange,
}: {
  licitacao: LicitacaoPncpRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const links = licitacao ? getLicitacaoLinks(licitacao) : null;
  const [empenhos, setEmpenhos] = useState<any[]>([]);
  const [loadingEmpenhos, setLoadingEmpenhos] = useState(false);
  const [empenhosError, setEmpenhosError] = useState<string | null>(null);
  const [committedValues, setCommittedValues] = useState<Map<string, number>>(new Map());
  const [fetchedPncpItens, setFetchedPncpItens] = useState<Record<string, unknown>[]>([]);
  const [loadingPncpItens, setLoadingPncpItens] = useState(false);

  useEffect(() => {
    if (!licitacao) {
      setEmpenhos([]);
      setCommittedValues(new Map());
      setFetchedPncpItens([]);
      setEmpenhosError(null);
      return;
    }

    let isMounted = true;
    const fetchEmpenhosAndItems = async () => {
      setLoadingEmpenhos(true);
      setEmpenhosError(null);
      setFetchedPncpItens([]);

      let pregaoItens = getPncpItems(licitacao.rawData);
      if (pregaoItens.length === 0) {
        setLoadingPncpItens(true);
        try {
          const items = await licitacoesPncpService.fetchItems(
            licitacao.cnpjOrgao,
            licitacao.anoCompra,
            licitacao.sequencialCompra,
          );
          if (isMounted && items.length > 0) {
            setFetchedPncpItens(items);
            pregaoItens = items;
          }
        } catch (e) {
          console.error('Erro ao buscar itens da licitacao no PNCP:', e);
        } finally {
          if (isMounted) setLoadingPncpItens(false);
        }
      }

      try {
        const uasg = licitacao.uasgCodigo;
        const formattedNumero = formatLicitacaoNumero(licitacao.numeroCompra, licitacao.anoCompra);
        const modalidadeCode = getTransparencyModalidadeCode(licitacao.modalidadeId);

        const origin = typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
          ? window.location.origin
          : 'http://localhost:5173';

        let empenhosList: any[] = [];

        // 1. Tenta consulta ao vivo no Portal da Transparência
        if (uasg && formattedNumero) {
          try {
            const res = await fetch(
              `${origin}/api-transparencia/api-de-dados/licitacoes/empenhos?codigoUG=${uasg}&numero=${formattedNumero}&codigoModalidade=${modalidadeCode}&pagina=1`,
              {
                headers: {
                  'accept': 'application/json',
                  'chave-api-dados': '931d4d57337bef94e775337c318342e9',
                }
              }
            );
            if (res.ok) {
              const empenhosData = await res.json();
              if (Array.isArray(empenhosData)) {
                empenhosList = empenhosData;
              }
            }
          } catch (err) {
            console.warn('Portal da Transparência offline ou indisponível:', err);
          }
        }

        // 1. Consulta Comprasnet Contratos (fonte oficial e determinística de contratos, itens e empenhos)
        const numClean = licitacao.numeroCompra ? String(licitacao.numeroCompra).replace(/\D/g, '') : '';
        const padded5 = numClean.padStart(5, '0');
        const ano = String(licitacao.anoCompra || '');
        const procClean = licitacao.processo ? String(licitacao.processo).replace(/\D/g, '') : '';
        const licObjNorm = normalizeText(licitacao.objetoCompra);

        const { data: dbContratos } = await supabase
          .from('contratos_api')
          .select('id, api_contrato_id, numero, fornecedor_nome, processo, valor_global, raw_data');

        const matchedContratos = (dbContratos || []).filter((c) => {
          const licNumInContract = String(c.raw_data?.licitacao_numero || '').trim();
          const infoComp = String(c.raw_data?.informacao_complementar || '');
          const cProcClean = c.processo ? String(c.processo).replace(/\D/g, '') : '';
          const cUnidadeCompra = String((c.raw_data as any)?.unidade_compra || '').trim();
          const cContratanteUg = String((c.raw_data as any)?.contratante?.unidade_gestora?.codigo || '').trim();
          const cOrigemUg = String((c.raw_data as any)?.contratante?.unidade_gestora_origem?.codigo || '').trim();
          const cObjNorm = normalizeText(c.raw_data?.objeto || '');

          // TRAVA DE SEGURANÇA: Se AMBOS possuem processo SEI com 8+ dígitos e os processos são DIVERGENTES, REJEITA!
          if (procClean && cProcClean && procClean.length >= 8 && cProcClean.length >= 8) {
            const isProcessMatch = procClean === cProcClean || procClean.includes(cProcClean) || cProcClean.includes(procClean);
            if (!isProcessMatch) {
              return false;
            }
          }

          // 1. Vínculo determinístico pelo processo SEI
          if (procClean && cProcClean && procClean.length >= 8 && cProcClean.length >= 8) {
            if (procClean === cProcClean || procClean.includes(cProcClean) || cProcClean.includes(procClean)) {
              return true;
            }
          }

          // 2. Vínculo determinístico pela minuta Comprasnet na informacao_complementar
          if (uasg && numClean && ano) {
            if (
              infoComp.includes(`${uasg}05${padded5}${ano}`) ||
              infoComp.includes(`${uasg}05${numClean}${ano}`) ||
              infoComp.includes(`${uasg}06${padded5}${ano}`) ||
              infoComp.includes(`${uasg}06${numClean}${ano}`)
            ) {
              return true;
            }
          }

          // 3. Vínculo pelo número da licitação (ex.: 90001/2025 ou 00001/2025)
          if (numClean && ano) {
            const isDirectLicNumMatch = licNumInContract === `${numClean}/${ano}` ||
              licNumInContract === `${padded5}/${ano}` ||
              licNumInContract.includes(`${numClean}/${ano}`) ||
              licNumInContract.includes(`${padded5}/${ano}`);

            if (isDirectLicNumMatch) {
              // A licitação pertence à mesma UASG se qualquer uma das UASGs do contrato coincidir
              const isUgMatch = !uasg ||
                cUnidadeCompra === uasg ||
                cContratanteUg === uasg ||
                cOrigemUg === uasg ||
                infoComp.includes(uasg);

              if (isUgMatch) {
                // Validação de domínio de objeto para evitar cruzamento de contratos homônimos
                if (licObjNorm && cObjNorm) {
                  const isCombustivelLic = licObjNorm.includes('combustivel') || licObjNorm.includes('abastecimento') || licObjNorm.includes('diesel') || licObjNorm.includes('gasolina');
                  const isLimpezaMotoristaContrato = cObjNorm.includes('limpeza') || cObjNorm.includes('motorista') || cObjNorm.includes('direcao veicular') || cObjNorm.includes('portaria') || cObjNorm.includes('recepcao');
                  if (isCombustivelLic && isLimpezaMotoristaContrato) {
                    return false;
                  }

                  const isLimpezaMotoristaLic = licObjNorm.includes('limpeza') || licObjNorm.includes('motorista') || licObjNorm.includes('direcao veicular') || licObjNorm.includes('portaria') || licObjNorm.includes('recepcao');
                  const isCombustivelContrato = cObjNorm.includes('combustivel') || cObjNorm.includes('abastecimento') || cObjNorm.includes('diesel') || cObjNorm.includes('gasolina');
                  if (isLimpezaMotoristaLic && isCombustivelContrato) {
                    return false;
                  }
                }
                return true;
              }

              // Se o contrato não tiver nenhuma UG definida, valida por similaridade de objeto
              if (!cUnidadeCompra && !cContratanteUg && !cOrigemUg && licObjNorm) {
                if (cObjNorm && (cObjNorm.includes(licObjNorm.slice(0, 20)) || licObjNorm.includes(cObjNorm.slice(0, 20)))) {
                  return true;
                }
              }
            }
          }

          return false;
        });

        const contratoIds = matchedContratos.map((c) => c.id);

        let contratosItens: any[] = [];
        let contratosEmpenhos: any[] = [];

        if (contratoIds.length > 0) {
          const [itensRes, empRes] = await Promise.all([
            supabase
              .from('contratos_api_itens')
              .select('contrato_api_id, numero_item_compra, descricao_complementar, valor_total')
              .in('contrato_api_id', contratoIds),
            supabase
              .from('contratos_api_empenhos')
              .select('contrato_api_id, numero, valor_empenhado, valor_liquidado, valor_pago, unidade_gestora, data_emissao')
              .in('contrato_api_id', contratoIds),
          ]);
          if (Array.isArray(itensRes.data)) contratosItens = itensRes.data;
          if (Array.isArray(empRes.data)) contratosEmpenhos = empRes.data;
        }

        // 2. Busca subitens no cache do Portal da Transparência
        const { data: cachedItems } = await supabase
          .from('portal_transparencia_empenho_itens_cache')
          .select('codigo_documento, descricao, valor_atual, sequencial');

        const cachedMap = new Map<string, any[]>();
        if (Array.isArray(cachedItems)) {
          cachedItems.forEach((ci) => {
            const doc = ci.codigo_documento;
            if (!cachedMap.has(doc)) cachedMap.set(doc, []);
            cachedMap.get(doc)!.push(ci);
          });
        }

        // 3. Consulta empenhos locais no banco de dados (SIAFI / multi-campi)
        try {
          const { data: dbEmpenhos } = await supabase
            .from('empenhos')
            .select('numero, valor, processo, descricao, favorecido_nome, data_empenho');

          if (Array.isArray(dbEmpenhos)) {
            const matchedLocal = dbEmpenhos.filter((emp) => {
              const empProcClean = emp.processo ? String(emp.processo).replace(/\D/g, '') : '';
              const descNorm = normalizeText(emp.descricao || '');
              const docKey = `${uasg || '158366'}26435${emp.numero}`;
              const docItems = cachedMap.get(docKey) || [];

              if (procClean && empProcClean && (procClean === empProcClean || empProcClean.includes(procClean) || procClean.includes(empProcClean)) && procClean.length >= 8) {
                return true;
              }
              if (numClean && ano && uasg) {
                const isPregaoMatch = descNorm.includes(`pregao ${numClean}/${ano}`) ||
                  descNorm.includes(`pe ${numClean}/${ano}`) ||
                  descNorm.includes(`pregao eletronico ${numClean}/${ano}`) ||
                  descNorm.includes(`pregao eletronico nº ${numClean}/${ano}`) ||
                  descNorm.includes(`pregao nº ${numClean}/${ano}`) ||
                  descNorm.includes(`${numClean}/${ano}`);

                if (isPregaoMatch) {
                  // Valida prefixo do processo para a UASG alvo
                  if (empProcClean && empProcClean.length >= 5) {
                    const procPrefix = empProcClean.slice(0, 5);
                    const expectedPrefixes: Record<string, string> = {
                      '158366': '23035',
                      '158370': '23139',
                      '158155': '23421',
                      '158369': '23057',
                      '158368': '23058',
                      '158367': '23059',
                      '158365': '23056',
                      '152711': '23466',
                      '158371': '23136',
                      '158372': '23138',
                      '158373': '23135',
                      '158374': '23137',
                      '158375': '23140',
                      '154582': '23477',
                      '154838': '23547',
                      '154839': '23548',
                      '154840': '23549',
                      '152756': '23467',
                      '152757': '23468',
                    };
                    const expected = expectedPrefixes[uasg];
                    if (expected && procPrefix !== expected) return false;
                  }
                  return true;
                }
              }
              if (
                (licObjNorm.includes('arbitragem') && descNorm.includes('arbitragem')) ||
                (licObjNorm.includes('vigilancia') && descNorm.includes('vigilancia') && descNorm.includes('armada')) ||
                (licObjNorm.includes('energia eletrica') && descNorm.includes('energia') && descNorm.includes('fornecimento')) ||
                (licObjNorm.includes('recepcao') && (descNorm.includes('recepcao') || descNorm.includes('recepcionista')))
              ) {
                if (procClean && empProcClean && (procClean === empProcClean || empProcClean.includes(procClean) || procClean.includes(empProcClean))) {
                  return true;
                }
              }
              if (docItems.some((di: any) => {
                const itemDescNorm = normalizeText(di.descricao);
                return licObjNorm.includes('arbitragem') && itemDescNorm.includes('arbitragem');
              })) {
                if (procClean && empProcClean && (procClean === empProcClean || empProcClean.includes(procClean) || procClean.includes(empProcClean))) {
                  return true;
                }
              }
              return false;
            });

            const existingNums = new Set(empenhosList.map((e) => e.numeroEmpenho));

            // Adiciona empenhos vindos dos contratos Comprasnet
            for (const ce of contratosEmpenhos) {
              if (!existingNums.has(ce.numero)) {
                existingNums.add(ce.numero);
                const parentContrato = matchedContratos.find((c) => c.id === ce.contrato_api_id);
                const ugCodigo = ce.unidade_gestora || (parentContrato?.raw_data as any)?.contratante?.unidade_gestora?.codigo || (parentContrato?.raw_data as any)?.unidade_compra || licitacao.uasgCodigo;
                const ugCatalog = IFRN_UASG_CATALOG.find((u) => u.codigo === ugCodigo);
                const ugNome = ugCatalog?.nome || (ugCodigo === licitacao.uasgCodigo ? licitacao.uasgNome : `UASG ${ugCodigo}`);
                empenhosList.push({
                  numeroEmpenho: ce.numero,
                  valor: ce.valor_empenhado,
                  dataEmissao: ce.data_emissao,
                  credor: { nome: parentContrato?.fornecedor_nome },
                  unidadeGestora: { codigo: ugCodigo, nome: ugNome },
                  descricao: `Contrato Comprasnet ${parentContrato?.numero || ''}`,
                });
              }
            }

            for (const mc of matchedContratos) {
              if (mc.numero && mc.numero.includes('NE') && !existingNums.has(mc.numero)) {
                existingNums.add(mc.numero);
                const ugCodigo = (mc.raw_data as any)?.contratante?.unidade_gestora?.codigo || (mc.raw_data as any)?.unidade_compra || licitacao.uasgCodigo;
                const ugCatalog = IFRN_UASG_CATALOG.find((u) => u.codigo === ugCodigo);
                const ugNome = ugCatalog?.nome || (ugCodigo === licitacao.uasgCodigo ? licitacao.uasgNome : `UASG ${ugCodigo}`);
                empenhosList.push({
                  numeroEmpenho: mc.numero,
                  valor: mc.valor_global,
                  credor: { nome: mc.fornecedor_nome },
                  unidadeGestora: { codigo: ugCodigo, nome: ugNome },
                  descricao: `Instrumento Comprasnet ${mc.numero}`,
                });
              }
            }

            // Adiciona empenhos locais
            for (const local of matchedLocal) {
              if (!existingNums.has(local.numero)) {
                existingNums.add(local.numero);
                const ugCodigo = licitacao.uasgCodigo;
                const ugCatalog = IFRN_UASG_CATALOG.find((u) => u.codigo === ugCodigo);
                const ugNome = ugCatalog?.nome || licitacao.uasgNome || `UASG ${ugCodigo}`;
                empenhosList.push({
                  numeroEmpenho: local.numero,
                  valor: local.valor,
                  dataEmissao: local.data_empenho,
                  credor: { nome: local.favorecido_nome },
                  unidadeGestora: { codigo: ugCodigo, nome: ugNome },
                  descricao: local.descricao,
                });
              }
            }
          }
        } catch (err) {
          console.error('Erro ao buscar empenhos locais:', err);
        }

        if (!isMounted) return;
        setEmpenhos(empenhosList);

        const map = new Map<string, number>();

        // Reconciliação direta dos itens do Comprasnet Contratos (com numero_item_compra)
        if (contratosItens.length > 0) {
          contratosItens.forEach((ci) => {
            const numItem = String(Number(ci.numero_item_compra || '0'));
            const val = parseNumeric(ci.valor_total);
            if (numItem && val > 0) {
              map.set(numItem, (map.get(numItem) || 0) + val);
            }
          });
        }

        // 4. Busca subitens dos empenhos para reconciliação
        const itemsPromises = empenhosList.map(async (emp) => {
          const uasgEmitente = emp.unidadeGestora?.codigo || uasg || '158366';
          const codigoDocumento = `${uasgEmitente}26435${emp.numeroEmpenho}`;

          // Verifica no cache primeiro
          const inCache = cachedMap.get(codigoDocumento);
          if (inCache && inCache.length > 0) {
            return inCache.map((item) => ({
              ...item,
              valorAtual: item.valor_atual,
              empenhoNumero: emp.numeroEmpenho,
            }));
          }

          try {
            const itemRes = await fetch(
              `${origin}/api-transparencia/api-de-dados/despesas/itens-de-empenho?codigoDocumento=${codigoDocumento}&pagina=1`,
              {
                headers: {
                  'accept': 'application/json',
                  'chave-api-dados': '931d4d57337bef94e775337c318342e9',
                }
              }
            );
            if (!itemRes.ok) return [];
            const itemsData = await itemRes.json();
            return (Array.isArray(itemsData) ? itemsData : []).map(item => ({
              ...item,
              empenhoNumero: emp.numeroEmpenho,
            }));
          } catch (e) {
            return [];
          }
        });

        const allEmpenhoItems = (await Promise.all(itemsPromises)).flat();
        
        if (!isMounted) return;

        // Reconcilia com os itens do pregão
        if (allEmpenhoItems.length > 0) {
          allEmpenhoItems.forEach((empItem) => {
            if (!empItem) return;
            const empenhoItemDesc = empItem.descricao || '';
            const matchItemCompra = empenhoItemDesc.match(/Item\s+compra:?\s*0*(\d+)/i);
            const empenhoItemSequencial = matchItemCompra ? Number(matchItemCompra[1]) : Number(empItem.sequencial);
            const empenhoItemValor = parseNumeric(empItem.valorAtual || empItem.valor_atual);

            let matchedItem = pregaoItens.find((item) => {
              const num = Number(getPncpItemNumber(item));
              return num === empenhoItemSequencial;
            });

            if (!matchedItem) {
              const normEmp = normalizeText(empenhoItemDesc);
              matchedItem = pregaoItens.find((item) => {
                const desc = normalizeText(getPncpItemDescription(item));
                return desc && (normEmp.includes(desc) || desc.includes(normEmp));
              });
            }

            if (matchedItem) {
              const itemNum = getPncpItemNumber(matchedItem);
              const currentVal = map.get(itemNum) || 0;
              // Se já temos valor do comprasnet para esse item, usa o maior entre eles
              if (currentVal === 0 || !contratosItens.some(ci => String(Number(ci.numero_item_compra)) === String(itemNum))) {
                map.set(itemNum, currentVal + empenhoItemValor);
              }
            }
          });
        } else if (pregaoItens.length > 0 && empenhosList.length > 0 && map.size === 0) {
          if (pregaoItens.length === 1) {
            const firstItemNum = getPncpItemNumber(pregaoItens[0]);
            const total = empenhosList.reduce((acc, e) => acc + parseNumeric(e.valor), 0);
            map.set(firstItemNum, total);
          } else {
            empenhosList.forEach((e) => {
              const descNorm = normalizeText(e.descricao || '');
              const matchedItem = pregaoItens.find((item) => {
                const itemDesc = normalizeText(getPncpItemDescription(item));
                return itemDesc && (descNorm.includes(itemDesc) || itemDesc.includes(descNorm));
              });
              if (matchedItem) {
                const num = getPncpItemNumber(matchedItem);
                map.set(num, (map.get(num) || 0) + parseNumeric(e.valor));
              }
            });
          }
        }

        setCommittedValues(map);
      } catch (e) {
        console.error('Erro ao carregar empenhos e saldos:', e);
        if (isMounted) {
          setEmpenhosError(e instanceof Error ? e.message : 'Não foi possível carregar os empenhos.');
        }
      } finally {
        if (isMounted) {
          setLoadingEmpenhos(false);
        }
      }
    };

    fetchEmpenhosAndItems();

    return () => {
      isMounted = false;
    };
  }, [licitacao]);

  const displayItens = getPncpItems(licitacao?.rawData ?? {}).length > 0
    ? getPncpItems(licitacao?.rawData ?? {})
    : fetchedPncpItens;

  return (
    <Dialog open={Boolean(licitacao)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 shadow-2xl">
        {licitacao ? (
          <>
            <DialogHeader className="border-b border-border-default/60 px-6 py-4 pr-12">
              <DialogTitle className="text-lg font-semibold text-text-primary">
                {licitacao.modalidadeNome || 'Pregão'} {licitacao.numeroCompra}/{licitacao.anoCompra}
              </DialogTitle>
              <DialogDescription className="text-xs font-mono text-text-secondary">
                {licitacao.numeroControlePncp}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={proposalBadgeClass(getProposalStatus(licitacao))}>
                  {getProposalStatus(licitacao)}
                </Badge>
                {licitacao.srp ? <Badge variant="outline">SRP</Badge> : null}
                {licitacao.situacaoCompraNome ? <Badge variant="secondary">{licitacao.situacaoCompraNome}</Badge> : null}
              </div>

              <div className="space-y-2">
                <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Objeto</p>
                <p className="font-ui text-sm leading-6 text-text-primary">{licitacao.objetoCompra || '-'}</p>
              </div>

              {loadingPncpItens ? (
                <div className="rounded-radius-lg border border-border-default p-4 flex items-center justify-center gap-2 text-xs text-text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin text-action-primary" />
                  Carregando itens do pregão no PNCP...
                </div>
              ) : displayItens.length > 0 ? (
                <div className="rounded-radius-lg border border-border-default p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Itens PNCP</p>
                    <Badge variant="outline" className="text-xs">{displayItens.length} item(ns)</Badge>
                  </div>
                  <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {displayItens.map((item, index) => {
                      const unitValue = rawNumber(item.valorUnitarioEstimado ?? item.valorUnitario);
                      const itemNum = getPncpItemNumber(item);
                      const origValue = rawNumber(item.valorTotal ?? item.valorTotalEstimado) || 0;
                      const committedVal = committedValues.get(itemNum) || 0;
                      const balance = origValue - committedVal;

                      return (
                        <div key={`${itemNum}-${index}`} className="rounded-radius-md border border-border-default/70 bg-surface-subtle/60 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <p className="font-ui text-sm font-semibold text-text-primary">Item {itemNum}</p>
                            <p className="font-mono text-xs font-semibold text-text-primary">
                              Valor Estimado: {formatCurrency(origValue)}
                            </p>
                          </div>
                          <p className="mt-1 font-ui text-sm text-text-secondary">{getPncpItemDescription(item)}</p>
                          <p className="mt-1 font-ui text-xs text-text-muted">
                            Qtd. {rawText(item.quantidade) ?? '-'} {rawText(item.unidadeMedida) ?? ''}
                            {unitValue !== null ? ` | Unit. ${formatCurrency(unitValue)}` : ''}
                          </p>
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border-default/50 pt-2 text-xs">
                            <div>
                              <span className="text-text-muted block">Já Empenhado</span>
                              <span className="font-semibold text-action-primary block mt-0.5">
                                {loadingEmpenhos ? 'Carregando...' : formatCurrency(committedVal)}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted block">Saldo Restante</span>
                              <span className={`font-semibold block mt-0.5 ${balance <= 0 ? 'text-status-error' : 'text-status-success'}`}>
                                {loadingEmpenhos ? 'Carregando...' : formatCurrency(balance)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="rounded-radius-lg border border-border-default p-4">
                <div className="flex items-center justify-between">
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                    Empenhos da Licitação (Portal da Transparência)
                  </p>
                  {empenhos.length > 0 && !loadingEmpenhos ? (
                    <Badge variant="outline" className="text-xs bg-action-primary/5 text-action-primary border-action-primary/20">
                      {empenhos.length} empenho(s)
                    </Badge>
                  ) : null}
                </div>

                {loadingEmpenhos ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin text-action-primary" />
                    Buscando empenhos no Portal da Transparência...
                  </div>
                ) : empenhosError ? (
                  <div className="mt-3 rounded-radius-md border border-status-error/20 bg-status-error/5 p-3 text-xs text-status-error">
                    Aviso: Não foi possível obter dados em tempo real do Portal da Transparência.
                    <p className="mt-1 font-mono text-[10px] opacity-80">{empenhosError}</p>
                  </div>
                ) : empenhos.length === 0 ? (
                  <div className="py-6 text-center text-xs text-text-secondary border border-dashed border-border-default/60 rounded-radius-md mt-3">
                    Nenhum empenho registrado para esta licitação no Portal da Transparência.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {empenhos.map((emp, index) => (
                      <div key={`${emp.numeroEmpenho}-${index}`} className="rounded-radius-md border border-border-default/50 bg-surface-subtle/40 p-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-text-primary">{emp.numeroEmpenho}</span>
                          <span className="font-semibold text-text-primary">{formatCurrency(parseNumeric(emp.valor))}</span>
                        </div>
                        <div className="mt-1 text-text-muted flex flex-wrap gap-x-2 gap-y-0.5">
                          <span>Emissão: {formatDate(emp.dataEmissao)}</span>
                          <span>|</span>
                          <span>Emitente: UG {emp.unidadeGestora?.codigo} {emp.unidadeGestora?.nome ? `(${emp.unidadeGestora.nome})` : ''}</span>
                        </div>
                        {emp.credor?.nome ? (
                          <div className="mt-1 text-text-secondary truncate">
                            Favorecido: <span className="font-medium">{emp.credor.nome}</span>
                            {emp.credor.cpfCnpjFormatado ? ` (${emp.credor.cpfCnpjFormatado})` : ''}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem label="Processo" value={licitacao.processo} />
                <DetailItem label="UASG" value={formatUasg(licitacao)} />
                <DetailItem label="Publicação PNCP" value={formatDateTime(licitacao.dataPublicacaoPncp)} />
                <DetailItem label="Abertura" value={formatDateTime(licitacao.dataAberturaProposta)} />
                <DetailItem label="Encerramento" value={formatDateTime(licitacao.dataEncerramentoProposta)} />
                <DetailItem label="Atualização global" value={formatDateTime(licitacao.dataAtualizacaoGlobal)} />
                <DetailItem label="Valor estimado" value={formatCurrency(licitacao.valorTotalEstimado)} />
                <DetailItem label="Valor homologado" value={formatCurrency(licitacao.valorTotalHomologado)} />
                <DetailItem label="Modo de disputa" value={licitacao.modoDisputaNome} />
                <DetailItem label="Amparo legal" value={licitacao.amparoLegalNome} />
              </div>

              {licitacao.informacaoComplementar ? (
                <div className="rounded-radius-lg border border-border-default p-4">
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Informação complementar</p>
                  <p className="mt-2 whitespace-pre-wrap font-ui text-sm leading-6 text-text-secondary">
                    {licitacao.informacaoComplementar}
                  </p>
                </div>
              ) : null}
            </div>

            <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default/60 bg-surface-subtle/30 px-6 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {links?.pncpUrl ? (
                  <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                    <a href={links.pncpUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      PNCP
                    </a>
                  </Button>
                ) : null}
                {links?.comprasGovUrl ? (
                  <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                    <a href={links.comprasGovUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Compras.gov.br
                    </a>
                  </Button>
                ) : null}
                {licitacao.linkProcessoEletronico ? (
                  <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                    <a href={licitacao.linkProcessoEletronico} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Processo
                    </a>
                  </Button>
                ) : null}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function LicitacoesPregoes() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [objetoBusca, setObjetoBusca] = useState('');
  const [itemBusca, setItemBusca] = useState('');
  const [uasgCodigo, setUasgCodigo] = useState('');
  const [situacao, setSituacao] = useState('todos');
  const [srp, setSrp] = useState<LicitacaoPncpSrpFilter>('todos');
  const [proposalStatus, setProposalStatus] = useState<LicitacaoPncpProposalStatus>('todos');
  const [dataInicial, setDataInicial] = useState(getDefaultStartDate);
  const [dataFinal, setDataFinal] = useState(toDateInputValue(new Date()));
  const [selectedLicitacao, setSelectedLicitacao] = useState<LicitacaoPncpRow | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    search,
    objetoBusca,
    itemBusca,
    uasgCodigo: uasgCodigo || undefined,
    situacao,
    srp,
    proposalStatus,
    dataInicial,
    dataFinal,
  }), [dataFinal, dataInicial, itemBusca, objetoBusca, page, pageSize, proposalStatus, search, situacao, srp, uasgCodigo]);

  const { data: listResult = { rows: [], count: 0 }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['licitacoes-pncp', queryParams],
    queryFn: () => licitacoesPncpService.list(queryParams),
    staleTime: 30000,
  });

  const { data: uasgOptions = [] } = useQuery({
    queryKey: ['licitacoes-pncp-uasgs'],
    queryFn: () => licitacoesPncpService.listUasgs(),
    staleTime: 60000,
  });

  const { data: situacoes = [] } = useQuery({
    queryKey: ['licitacoes-pncp-situacoes'],
    queryFn: () => licitacoesPncpService.listSituacoes(),
    staleTime: 60000,
  });

  const totalPages = Math.max(1, Math.ceil(listResult.count / pageSize));
  const currentPageRows = listResult.rows;

  const resetPage = () => setPage(1);

  const resetFilters = () => {
    setSearch('');
    setObjetoBusca('');
    setItemBusca('');
    setUasgCodigo('');
    setSituacao('todos');
    setSrp('todos');
    setProposalStatus('todos');
    setDataInicial(getDefaultStartDate());
    setDataFinal(toDateInputValue(new Date()));
    resetPage();
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const typedUasg = uasgCodigo.replace(/\D/g, '');

      const result = await licitacoesPncpService.sync({
        ...(typedUasg ? { unidadeCodigos: [typedUasg] } : {}),
        objetoBusca,
        itemBusca,
        dataInicial,
        dataFinal,
        source: 'frontend-search',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-uasgs'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-situacoes'] }),
      ]);

      if (result.status === 'partial_success') {
        toast.warning(`Busca parcial: ${result.upserted} pregão(ões) encontrado(s).`);
      } else {
        toast.success(`${result.upserted} pregão(ões) encontrado(s) via PNCP.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível buscar os pregões no PNCP.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInternalUasgsSync = async () => {
    setIsSyncing(true);
    try {
      const result = await licitacoesPncpService.syncInternalUasgs({
        dataInicial,
        dataFinal,
        source: 'frontend-ifrn-cache',
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-uasgs'] }),
        queryClient.invalidateQueries({ queryKey: ['licitacoes-pncp-situacoes'] }),
      ]);

      if (result.status === 'partial_success') {
        toast.warning(`Sincronizacao parcial das UASGs IFRN: ${result.upserted} pregao(oes) encontrado(s).`);
      } else {
        toast.success(`${result.upserted} pregao(oes) encontrado(s) nas UASGs IFRN.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nao foi possivel sincronizar as UASGs IFRN.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        <span>PNCP / Pregões IFRN</span>
      </HeaderSubtitle>
      <HeaderActions>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar lista
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handleInternalUasgsSync()} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Sincronizar UASGs IFRN
          </Button>
        </div>
      </HeaderActions>

      <FilterPanel
        title="Filtros de pregões"
        actions={(
          <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
            Limpar filtros
          </Button>
        )}
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-12">
          <FilterField label="UASG" className="xl:col-span-3">
            <Input
              value={uasgCodigo}
              onChange={(event) => {
                setUasgCodigo(event.target.value.replace(/\D/g, '').slice(0, 6));
                resetPage();
              }}
              list="licitacoes-pncp-uasgs"
              inputMode="numeric"
              aria-label="UASG"
              placeholder="Todas as UASGs"
            />
            <datalist id="licitacoes-pncp-uasgs">
              {uasgOptions.map((option) => (
                <option key={option.codigo} value={option.codigo}>
                  {option.nome || option.codigo}
                </option>
              ))}
            </datalist>
          </FilterField>

          <FilterField label="Objeto no PNCP" className="xl:col-span-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={objetoBusca}
                onChange={(event) => {
                  setObjetoBusca(event.target.value);
                  resetPage();
                }}
                className="pl-9"
                aria-label="Objeto especifico"
                placeholder="Ex.: energia elétrica, combustível"
              />
            </div>
          </FilterField>

          <FilterField label="Item no PNCP" className="xl:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={itemBusca}
                onChange={(event) => {
                  setItemBusca(event.target.value);
                  resetPage();
                }}
                className="pl-9"
                aria-label="Item no PNCP"
                placeholder="Ex.: notebook, cadeira, manutenção"
              />
            </div>
          </FilterField>

          <FilterField label="Busca na lista" className="xl:col-span-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                className="pl-9"
                aria-label="Busca geral"
                placeholder="Número, processo ou unidade"
              />
            </div>
          </FilterField>

          <FilterField label="Situação" className="xl:col-span-3">
            <Select
              value={situacao}
              onValueChange={(value) => {
                setSituacao(value);
                resetPage();
              }}
            >
              <SelectTrigger aria-label="Situação">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as situações</SelectItem>
                {situacoes.map((option) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Prazo de propostas" className="xl:col-span-3">
            <Select
              value={proposalStatus}
              onValueChange={(value) => {
                setProposalStatus(value as LicitacaoPncpProposalStatus);
                resetPage();
              }}
            >
              <SelectTrigger aria-label="Prazo de propostas">
                <SelectValue placeholder="Propostas" />
              </SelectTrigger>
              <SelectContent>
                {proposalOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Registro de preços" className="xl:col-span-2">
            <Select
              value={srp}
              onValueChange={(value) => {
                setSrp(value as LicitacaoPncpSrpFilter);
                resetPage();
              }}
            >
              <SelectTrigger aria-label="Registro de preços">
                <SelectValue placeholder="SRP" />
              </SelectTrigger>
              <SelectContent>
                {srpOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Publicada a partir de" className="xl:col-span-2">
            <Input
              type="date"
              value={dataInicial}
              onChange={(event) => {
                setDataInicial(event.target.value);
                resetPage();
              }}
              aria-label="Data inicial"
            />
          </FilterField>
          <FilterField label="Publicada até" className="xl:col-span-2">
            <Input
              type="date"
              value={dataFinal}
              onChange={(event) => {
                setDataFinal(event.target.value);
                resetPage();
              }}
              aria-label="Data final"
            />
          </FilterField>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border-default/60 pt-4">
          <p className="font-ui text-xs text-text-secondary">
            Sem UASG informada, a busca consulta todas as unidades do IFRN publicadas no PNCP. Para pesquisar por item, use Buscar no PNCP para carregar os itens no cache local.
          </p>
          <Button type="button" className="gap-2" onClick={() => void handleManualSync()} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Buscar no PNCP
          </Button>
        </div>
      </FilterPanel>

      <DataTablePanel title="Lista de pregões" description={`${listResult.count} registro(s) no filtro atual`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Compra</TableHead>
              <TableHead>Objeto</TableHead>
              <TableHead>UASG</TableHead>
              <TableHead>Propostas</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Valor estimado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando pregões...
                  </div>
                </TableCell>
              </TableRow>
            ) : currentPageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <div className="py-10 text-center text-sm text-text-secondary">Nenhum pregão encontrado.</div>
                </TableCell>
              </TableRow>
            ) : (
              currentPageRows.map((row) => {
                const status = getProposalStatus(row);
                const links = getLicitacaoLinks(row);

                return (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-[170px]">
                      <p className="font-mono text-xs font-semibold text-text-primary">{row.numeroCompra}/{row.anoCompra}</p>
                      {row.processo ? <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{row.processo}</p> : null}
                    </TableCell>
                    <TableCell className="min-w-[320px]">
                      <p className="line-clamp-2 font-ui text-sm font-semibold text-text-primary">{row.objetoCompra || '-'}</p>
                      <p className="mt-1 font-ui text-xs text-text-secondary">{row.modalidadeNome || 'Pregão'}{row.modoDisputaNome ? ` - ${row.modoDisputaNome}` : ''}</p>
                    </TableCell>
                    <TableCell className="min-w-[180px]">
                      <p className="font-mono text-xs font-semibold text-text-primary">{row.uasgCodigo || '-'}</p>
                      <p className="mt-0.5 line-clamp-1 font-ui text-xs text-text-secondary">{row.uasgNome || '-'}</p>
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <Badge variant="outline" className={proposalBadgeClass(status)}>
                        {status}
                      </Badge>
                      <p className="mt-1 font-ui text-xs text-text-secondary">{formatDate(row.dataEncerramentoProposta)}</p>
                    </TableCell>
                    <TableCell className="min-w-[150px]">
                      <p className="font-ui text-sm text-text-primary">{row.situacaoCompraNome || '-'}</p>
                      {row.srp ? <Badge variant="secondary" className="mt-1">SRP</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatCurrency(row.valorTotalEstimado)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1.5">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLicitacao(row)}>
                          Detalhar
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" asChild>
                          <a href={links.pncpUrl} target="_blank" rel="noreferrer" aria-label="Abrir no PNCP">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          totalItems={listResult.count}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </DataTablePanel>

      <LicitacaoDetailsDialog licitacao={selectedLicitacao} onOpenChange={(open) => !open && setSelectedLicitacao(null)} />
    </div>
  );
}
