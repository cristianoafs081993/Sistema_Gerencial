import type { ReactNode } from 'react';
import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { supabase } from '@/lib/supabase';
import { DEFAULT_PNCP_UASG, DEFAULT_PNCP_UASGS, IFRN_UASG_CATALOG } from '@/lib/licitacoesPncp';
import type { Empenho } from '@/types';
import {
  atasRegistroPrecosService,
  type AtaRegistroPrecoRow,
  type AtasRegistroPrecosSyncResult,
  type AtaRegistroPrecoVinculoFilter,
} from '@/services/atasRegistroPrecos';

const vinculoOptions: Array<{ value: AtaRegistroPrecoVinculoFilter; label: string }> = [
  { value: 'qualquer-vinculo', label: 'Qualquer vínculo' },
  { value: 'gerenciadora', label: 'Gerenciadora' },
  { value: 'participante', label: 'Participante' },
  { value: 'aderente', label: 'Aderente' },
  { value: 'todos', label: 'Todas as atas' },
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

function formatCurrency(value?: number | null) {
  if (typeof value !== 'number') return '-';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatUasg(codigo?: string | null, nome?: string | null) {
  if (!codigo) return '-';
  const found = IFRN_UASG_CATALOG.find((u) => u.codigo === codigo);
  const displayName = nome || found?.nome;
  return `${codigo}${displayName ? ` - ${displayName}` : ''}`;
}

export function getVigenciaInfo(dataVigenciaFinal?: string | null) {
  if (!dataVigenciaFinal) return { status: 'desconhecido', label: '-', badgeClass: 'bg-muted text-muted-foreground', diffDays: 0 };
  const fim = new Date(dataVigenciaFinal);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffMs = fim.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: 'expirada',
      label: 'Expirada',
      detail: `Venceu há ${Math.abs(diffDays)} dia(s)`,
      badgeClass: 'bg-destructive/15 text-destructive border-destructive/30',
      diffDays,
    };
  }
  if (diffDays <= 60) {
    return {
      status: 'vencendo',
      label: `Vence em ${diffDays}d`,
      detail: `Atenção: faltam ${diffDays} dias para expirar`,
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium',
      diffDays,
    };
  }
  return {
    status: 'vigente',
    label: `Vigente (${diffDays}d)`,
    detail: `Vigente por mais ${diffDays} dias`,
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium',
    diffDays,
  };
}

function rawString(row: AtaRegistroPrecoRow, keys: string[]) {
  for (const key of keys) {
    const value = row.rawData[key];
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
}

function rawNumber(row: AtaRegistroPrecoRow, keys: string[]) {
  for (const key of keys) {
    const value = row.rawData[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const str = String(value).trim();
    if (!str) continue;
    if (str.includes(',')) {
      const parsed = Number(str.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    } else {
      const parsed = Number(str);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function dateOnly(value?: string | null) {
  return value ? value.slice(0, 10) : null;
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function participantesLabel(count: number) {
  return `${count} ${count === 1 ? 'participante' : 'participantes'}`;
}

function ParticipantesBadge({ row }: { row: AtaRegistroPrecoRow }) {
  if (row.totalUnidadesParticipantes <= 0) return null;

  const participantes = row.unidadesParticipantes;
  const label = participantesLabel(row.totalUnidadesParticipantes);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" tabIndex={0} aria-label={`Ver ${label}`} className="cursor-help">
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-sm">
          <div className="space-y-1">
            <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em]">Participantes</p>
            <ul className="max-h-56 space-y-0.5 overflow-y-auto text-xs">
              {participantes.map((participante) => {
                const catalogMatch = IFRN_UASG_CATALOG.find((u) => u.codigo === participante);
                return (
                  <li key={participante}>
                    UASG {participante} {catalogMatch ? `(${catalogMatch.nome})` : ''}
                  </li>
                );
              })}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function vinculoBadges(row: AtaRegistroPrecoRow, uasgCodigo: string) {
  const normalized = uasgCodigo.replace(/\D/g, '');
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.unidadeGerenciadoraCodigo === normalized ? <Badge variant="secondary">Gerenciadora</Badge> : null}
      {row.unidadesParticipantes.includes(normalized) ? <Badge variant="outline">Participante</Badge> : null}
      {row.unidadesAderentes.includes(normalized) ? <Badge variant="outline">Aderente</Badge> : null}
      <ParticipantesBadge row={row} />
      {row.totalAdesoes > 0 ? <Badge variant="outline">{row.totalAdesoes} adesão</Badge> : null}
      {row.totalItens === 0 ? <Badge variant="secondary">Itens não carregados</Badge> : null}
    </div>
  );
}

function getSyncWarningMessage(result: AtasRegistroPrecosSyncResult) {
  const failedScopes = result.errors?.length ?? 0;
  if (result.status === 'error') {
    return failedScopes > 0
      ? `Compras.gov.br não concluiu a consulta agora (${failedScopes} escopo(s) com falha). A lista permanece com dados já materializados.`
      : 'Compras.gov.br não concluiu a consulta agora. A lista permanece com dados já materializados.';
  }

  return `Sincronização parcial: ${result.upserted} registro(s) materializado(s).`;
}

function getSyncThrownWarningMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();

  if (
    normalized.includes('failed to fetch')
    || normalized.includes('network')
    || normalized.includes('internet_disconnected')
    || normalized.includes('network_changed')
    || normalized.includes('504')
    || normalized.includes('gateway timeout')
  ) {
    return 'Não foi possível conectar ao Supabase agora. Verifique a conexão e tente novamente.';
  }

  if (
    normalized.includes('dadosabertos.compras.gov.br')
    || normalized.includes('could not open jpa entitymanager')
    || normalized.includes('falha ao sincronizar arp')
  ) {
    return 'Compras.gov.br não concluiu a consulta agora. A lista permanece com dados já materializados.';
  }

  return null;
}

function isInternalUasg(uasgCodigo: string) {
  const normalized = uasgCodigo.replace(/\D/g, '');
  return DEFAULT_PNCP_UASGS.includes(normalized);
}

const PROCESSO_PREFIX_TO_UASG: Record<string, string> = {
  '23035': '158366', // Currais Novos
  '23421': '158155', // Reitoria
  '23134': '158369', // Natal Central
  '23057': '158368', // Natal Zona Norte
  '23133': '152711', // Natal Cidade Alta
  '23135': '158365', // Mossoró
  '23136': '158371', // Apodi
  '23137': '158367', // Ipanguaçu
  '23138': '158373', // João Câmara
  '23139': '158374', // Pau dos Ferros
  '23036': '158375', // Macau
  '23038': '158370', // Caicó
  '23039': '152756', // Parnamirim
  '23040': '154840', // São Paulo do Potengi
  '23041': '152757', // Nova Cruz
  '23042': '158372', // Santa Cruz
  '23044': '154839', // Canguaretama
  '23045': '154838', // Ceará-Mirim
  '23046': '154582', // São Gonçalo do Amarante
};

function detectUasgFromEmpenho(processo?: string | null, infoOrDesc?: string | null, fallback?: string): string {
  if (infoOrDesc) {
    const minutaMatch = infoOrDesc.match(/\b(?:UASG\s*(?:MINUTA)?|UG)\s*:?\s*(15\d{4})\b/i);
    if (minutaMatch) return minutaMatch[1];
  }
  if (processo) {
    const cleanProc = processo.replace(/\D/g, '');
    const prefix5 = cleanProc.slice(0, 5);
    if (PROCESSO_PREFIX_TO_UASG[prefix5]) return PROCESSO_PREFIX_TO_UASG[prefix5];
  }
  return fallback || '158366';
}

function normalizeText(val: string | null | undefined): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseNumeric(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return Number.isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  if (str.includes(',')) {
    const parsed = parseFloat(str.replace(/\./g, '').replace(',', '.'));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(str);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export type ItemEmpenhoDetail = {
  id: string;
  numeroEmpenho: string;
  dataEmissao?: string | null;
  valor: number;
  valorLiquidado?: number | null;
  valorPago?: number | null;
  credorNome?: string | null;
  credorCpfCnpj?: string | null;
  unidadeGestoraCodigo?: string | null;
  unidadeGestoraNome?: string | null;
  descricao?: string | null;
  subitemDescricao?: string | null;
  fonte: 'comprasnet' | 'siafi' | 'transparencia';
  contratoNumero?: string | null;
  rawEmpenho?: Empenho | null;
};

export type AtaExecutionData = {
  itemCommittedMap: Map<string, number>;
  itemEmpenhosMap: Map<string, ItemEmpenhoDetail[]>;
  totalEmpenhado: number;
  contratos: any[];
  allEmpenhos: ItemEmpenhoDetail[];
};

function AtasDetailsDialog({
  ata,
  onOpenChange,
}: {
  ata: AtaRegistroPrecoRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [isSyncingDetails, setIsSyncingDetails] = useState(false);
  const [expandedItemKeys, setExpandedItemKeys] = useState<Set<string>>(new Set());
  const [selectedEmpenhoForDialog, setSelectedEmpenhoForDialog] = useState<Empenho | null>(null);
  const [isEmpenhoDialogOpen, setIsEmpenhoDialogOpen] = useState(false);
  const [selectedUasgScope, setSelectedUasgScope] = useState<string>('todas');

  const { data: items = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['atas-registro-precos-itens', ata?.ataKey],
    queryFn: () => atasRegistroPrecosService.listItems(ata?.ataKey ?? ''),
    enabled: Boolean(ata?.ataKey),
    staleTime: 60000,
  });

  const { data: unidades = [], isLoading: isLoadingUnidades } = useQuery({
    queryKey: ['atas-registro-precos-unidades', ata?.ataKey],
    queryFn: () => atasRegistroPrecosService.listUnidades(ata?.ataKey ?? ''),
    enabled: Boolean(ata?.ataKey),
    staleTime: 60000,
  });

  const { data: executionData = { itemCommittedMap: new Map<string, number>(), itemEmpenhosMap: new Map<string, ItemEmpenhoDetail[]>(), totalEmpenhado: 0, contratos: [], allEmpenhos: [] }, isLoading: isLoadingExecution } = useQuery({
    queryKey: ['atas-execution-balances', ata?.numeroCompra, ata?.anoCompra, ata?.numeroAta, ata?.unidadeGerenciadoraCodigo, ata?.ataKey, items],
    queryFn: async (): Promise<AtaExecutionData> => {
      if (!ata) {
        return {
          itemCommittedMap: new Map(),
          itemEmpenhosMap: new Map(),
          totalEmpenhado: 0,
          contratos: [],
          allEmpenhos: [],
        };
      }

      const numCompraClean = ata.numeroCompra ? String(ata.numeroCompra).replace(/\D/g, '') : '';
      const numCompraPadded5 = numCompraClean ? numCompraClean.padStart(5, '0') : '';
      const anoCompra = ata.anoCompra ? String(ata.anoCompra) : '';

      const numAta = String(ata.numeroAta || '').trim();
      const numAtaParts = numAta.split('/');
      const numAtaClean = numAtaParts[0] ? numAtaParts[0].replace(/\D/g, '') : '';
      const numAtaAno = numAtaParts[1] ? numAtaParts[1].replace(/\D/g, '') : anoCompra;

      // Monta conjunto de fornecedores válidos desta Ata (CNPJs limpos e nomes normalizados)
      const validCnpjs = new Set<string>();
      const validNomes: string[] = [];
      const itemByNumber = new Map<string, typeof items[0]>();

      items.forEach((it) => {
        const num = String(Number(it.numeroItem || '0'));
        if (num && num !== '0') itemByNumber.set(num, it);

        const cnpjClean = (it.fornecedorNi || '').replace(/\D/g, '');
        if (cnpjClean && cnpjClean.length >= 8) validCnpjs.add(cnpjClean);

        const nomeNorm = normalizeText(it.fornecedorNome || '');
        if (nomeNorm && nomeNorm.length >= 4) validNomes.push(nomeNorm);
      });

      const hasAtaItems = items.length > 0;

      // Função utilitária para verificar se um fornecedor pertence à Ata
      const isSupplierMatched = (cpfCnpj?: string | null, nome?: string | null) => {
        if (!hasAtaItems) return true; // Se ainda não carregou itens, aceita baseado na licitação/ata
        const docClean = (cpfCnpj || '').replace(/\D/g, '');
        if (docClean && validCnpjs.has(docClean)) return true;
        const norm = normalizeText(nome || '');
        if (norm && validNomes.some((vn) => norm.includes(vn) || vn.includes(norm))) return true;
        return false;
      };

      // 1. Consulta contratos, empenhos SIAFI e cache de subitens da Transparência em paralelo
      const [contratosRes, empenhosRes, cacheRes] = await Promise.all([
        supabase
          .from('contratos_api')
          .select('id, api_contrato_id, numero, fornecedor_nome, processo, valor_global, raw_data'),
        supabase
          .from('empenhos')
          .select('*'),
        supabase
          .from('portal_transparencia_empenho_itens_cache')
          .select('codigo_documento, descricao, valor_atual, sequencial'),
      ]);

      const dbContratos = Array.isArray(contratosRes.data) ? contratosRes.data : [];
      const dbEmpenhos = Array.isArray(empenhosRes.data) ? empenhosRes.data : [];
      const cachedItems = Array.isArray(cacheRes.data) ? cacheRes.data : [];

      const cachedMap = new Map<string, any[]>();
      cachedItems.forEach((ci) => {
        const doc = ci.codigo_documento;
        if (!cachedMap.has(doc)) cachedMap.set(doc, []);
        cachedMap.get(doc)!.push(ci);
      });

      // Regex para encontrar menção exata ao Pregão de Origem
      const pregaoRegex = numCompraClean && anoCompra
        ? new RegExp(`(?:preg[aã]o|pe)\\s*(?:eletr[oô]nico)?\\s*(?:n[º°.]?\\s*)?0*${numCompraClean}\\/${anoCompra}`, 'i')
        : null;

      // Regex para encontrar menção exata à Ata
      const ataRegex = numAtaClean && numAtaAno
        ? new RegExp(`(?:ata|arp|ata de registro de pre[cç]os)\\s*(?:n[º°.]?\\s*)?0*${numAtaClean}\\/${numAtaAno}`, 'i')
        : null;

      // 2. Filtra contratos que pertencem a esta Ata / Pregão
      const matchedContratos = dbContratos.filter((c) => {
        const licNum = String(c.raw_data?.licitacao_numero || '').trim();
        const infoComp = String(c.raw_data?.informacao_complementar || '');
        const objeto = String(c.raw_data?.objeto || '');
        const cFornecedorCnpj = (c.raw_data as any)?.fornecedor?.cnpj_cpf_idgener || '';
        const cFornecedorNome = c.fornecedor_nome || '';

        // Se a Ata possui itens cadastrados, o fornecedor do contrato DEVE coincidir
        if (hasAtaItems) {
          if (!isSupplierMatched(cFornecedorCnpj, cFornecedorNome)) {
            return false;
          }
        }

        // Verifica vínculo explícito com a Ata
        if (ataRegex && (ataRegex.test(infoComp) || ataRegex.test(objeto) || ataRegex.test(licNum))) {
          return true;
        }

        // Verifica vínculo com o Pregão de Origem (somente se a Ata tiver itens com fornecedor validado)
        if (hasAtaItems && numCompraClean && anoCompra) {
          if (
            licNum === `${numCompraClean}/${anoCompra}` ||
            licNum === `${numCompraPadded5}/${anoCompra}`
          ) {
            return true;
          }
          if (pregaoRegex && (pregaoRegex.test(infoComp) || pregaoRegex.test(objeto))) {
            return true;
          }
        }

        return false;
      });

      const matchedContratoIds = matchedContratos.map((c) => c.id);
      let contratosItens: any[] = [];
      let contratosEmpenhos: any[] = [];

      if (matchedContratoIds.length > 0) {
        const [itensRes, empRes] = await Promise.all([
          supabase
            .from('contratos_api_itens')
            .select('contrato_api_id, numero_item_compra, descricao_complementar, valor_total, quantidade')
            .in('contrato_api_id', matchedContratoIds),
          supabase
            .from('contratos_api_empenhos')
            .select('contrato_api_id, numero, valor_empenhado, valor_liquidado, valor_pago, unidade_gestora, data_emissao')
            .in('contrato_api_id', matchedContratoIds),
        ]);
        if (Array.isArray(itensRes.data)) contratosItens = itensRes.data;
        if (Array.isArray(empRes.data)) contratosEmpenhos = empRes.data;
      }

      // 3. Filtra empenhos locais (SIAFI)
      const matchedLocalEmpenhos = dbEmpenhos.filter((emp) => {
        const empDoc = emp.favorecido_documento;
        const empNome = emp.favorecido_nome;

        // Se a Ata possui itens cadastrados, o credor do empenho DEVE coincidir com os fornecedores da Ata
        if (hasAtaItems) {
          if (!isSupplierMatched(empDoc, empNome)) {
            return false;
          }
        }

        // Caso A: Empenho referenciado diretamente em contrato já validado
        if (contratosEmpenhos.some((ce) => ce.numero === emp.numero)) {
          return true;
        }

        // Caso B: Processo coincide com contrato já validado
        const empProcClean = emp.processo ? String(emp.processo).replace(/\D/g, '') : '';
        if (empProcClean && empProcClean.length >= 8) {
          const matchProc = matchedContratos.some((c) => {
            const cProcClean = c.processo ? String(c.processo).replace(/\D/g, '') : '';
            return cProcClean && (cProcClean === empProcClean || cProcClean.includes(empProcClean) || empProcClean.includes(cProcClean));
          });
          if (matchProc) return true;
        }

        // Caso C: Menção explícita à Ata na descrição do empenho
        const desc = emp.descricao || '';
        if (ataRegex && ataRegex.test(desc)) {
          return true;
        }

        // Caso D: Menção explícita ao Pregão (somente se a Ata possuir itens com fornecedor validado)
        if (hasAtaItems && pregaoRegex && pregaoRegex.test(desc)) {
          return true;
        }

        return false;
      });

      // 4. Estruturas para associar empenhos e valores aos itens da Ata
      const itemCommittedMap = new Map<string, number>();
      const itemEmpenhosMap = new Map<string, ItemEmpenhoDetail[]>();
      const allEmpenhosMap = new Map<string, ItemEmpenhoDetail>();

      const addEmpenhoToItem = (itemNum: string, detail: ItemEmpenhoDetail) => {
        const normalizedNum = String(Number(itemNum || '0'));
        if (!normalizedNum || normalizedNum === '0') return;

        // Se o item existir na Ata, valida se o credor coincide com o fornecedor daquele item específico
        const targetItem = itemByNumber.get(normalizedNum);
        if (targetItem) {
          const targetCnpj = (targetItem.fornecedorNi || '').replace(/\D/g, '');
          const detailCnpj = (detail.credorCpfCnpj || '').replace(/\D/g, '');
          if (targetCnpj && detailCnpj && targetCnpj.length >= 8 && detailCnpj.length >= 8) {
            if (targetCnpj !== detailCnpj) return; // Fornecedor diferente do item!
          } else {
            const targetNome = normalizeText(targetItem.fornecedorNome || '');
            const detailNome = normalizeText(detail.credorNome || '');
            if (targetNome && detailNome && !targetNome.includes(detailNome) && !detailNome.includes(targetNome)) {
              return; // Fornecedor incompatível com o item!
            }
          }
        }

        if (!itemEmpenhosMap.has(normalizedNum)) {
          itemEmpenhosMap.set(normalizedNum, []);
        }
        const list = itemEmpenhosMap.get(normalizedNum)!;
        if (!list.some((existing) => existing.numeroEmpenho === detail.numeroEmpenho && existing.id === detail.id)) {
          list.push(detail);
        }
      };

      // A) Empenhos do Comprasnet Contratos vinculados aos contratos válidos
      for (const ce of contratosEmpenhos) {
        const parentContrato = matchedContratos.find((c) => c.id === ce.contrato_api_id);
        const localMatch = dbEmpenhos.find((e) => e.numero === ce.numero);
        const ugCodigo = ce.unidade_gestora || detectUasgFromEmpenho(
          parentContrato?.processo,
          `${(ce.raw_data as any)?.informacao_complementar || ''} ${(parentContrato?.raw_data as any)?.informacao_complementar || ''}`,
          (parentContrato?.raw_data as any)?.contratante?.unidade_gestora?.codigo || ata.unidadeGerenciadoraCodigo
        );
        const ugName = IFRN_UASG_CATALOG.find((u) => u.codigo === ugCodigo)?.nome;
        const docKey = `${ugCodigo}26435${ce.numero}`;
        const subitens = cachedMap.get(docKey) || [];

        const baseDetail: ItemEmpenhoDetail = {
          id: `ce-${ce.numero}`,
          numeroEmpenho: ce.numero,
          dataEmissao: ce.data_emissao || localMatch?.data_empenho,
          valor: parseNumeric(ce.valor_empenhado) || parseNumeric(localMatch?.valor),
          valorLiquidado: parseNumeric(ce.valor_liquidado) || parseNumeric(localMatch?.valor_liquidado),
          valorPago: parseNumeric(ce.valor_pago),
          credorNome: parentContrato?.fornecedor_nome || localMatch?.favorecido_nome,
          credorCpfCnpj: (parentContrato?.raw_data as any)?.fornecedor?.cnpj_cpf_idgener || localMatch?.favorecido_documento,
          unidadeGestoraCodigo: ugCodigo,
          unidadeGestoraNome: ugName,
          descricao: localMatch?.descricao || `Contrato Comprasnet ${parentContrato?.numero || ''}`,
          fonte: 'comprasnet',
          contratoNumero: parentContrato?.numero,
          rawEmpenho: localMatch ? (localMatch as any) : null,
        };

        allEmpenhosMap.set(ce.numero, baseDetail);

        if (subitens.length > 0) {
          subitens.forEach((sub: any, idx: number) => {
            const matchCompra = (sub.descricao || '').match(/Item\s*(?:compra|de\s*compra)?\s*:?\s*0*(\d+)/i);
            const itemSeq = matchCompra ? matchCompra[1] : (items.length === 1 ? items[0].numeroItem : null);
            const subVal = parseNumeric(sub.valor_atual || sub.valorAtual);

            if (itemSeq) {
              addEmpenhoToItem(itemSeq, {
                ...baseDetail,
                id: `ce-sub-${ce.numero}-${sub.sequencial || idx}`,
                valor: subVal > 0 ? subVal : baseDetail.valor,
                subitemDescricao: sub.descricao,
                fonte: 'transparencia',
              });
            }
          });
        } else {
          const descCombined = `${baseDetail.descricao || ''} ${(ce.raw_data as any)?.informacao_complementar || ''}`;
          const itemMatch = descCombined.match(/Item\s*(?:compra|de\s*compra)?\s*:?\s*0*(\d+)/i);
          if (itemMatch) {
            addEmpenhoToItem(itemMatch[1], baseDetail);
          } else {
            const contractItens = contratosItens.filter((ci) => ci.contrato_api_id === ce.contrato_api_id);
            if (contractItens.length === 1) {
              addEmpenhoToItem(String(contractItens[0].numero_item_compra), baseDetail);
            } else if (items.length === 1) {
              addEmpenhoToItem(items[0].numeroItem, baseDetail);
            }
          }
        }
      }

      // B) Instrumentos contratuais do tipo Empenho (NE) já validados
      for (const mc of matchedContratos) {
        if (mc.numero && mc.numero.includes('NE') && !allEmpenhosMap.has(mc.numero)) {
          const localMatch = dbEmpenhos.find((e) => e.numero === mc.numero);
          const ugCodigo = detectUasgFromEmpenho(
            mc.processo,
            `${(mc.raw_data as any)?.informacao_complementar || ''} ${(mc.raw_data as any)?.objeto || ''}`,
            (mc.raw_data as any)?.contratante?.unidade_gestora?.codigo || ata.unidadeGerenciadoraCodigo
          );
          const ugName = IFRN_UASG_CATALOG.find((u) => u.codigo === ugCodigo)?.nome;
          const docKey = `${ugCodigo}26435${mc.numero}`;
          const subitens = cachedMap.get(docKey) || [];

          const baseDetail: ItemEmpenhoDetail = {
            id: `mc-${mc.numero}`,
            numeroEmpenho: mc.numero,
            dataEmissao: (mc.raw_data as any)?.data_assinatura || localMatch?.data_empenho,
            valor: parseNumeric(mc.valor_global) || parseNumeric(localMatch?.valor),
            valorLiquidado: parseNumeric(localMatch?.valor_liquidado),
            credorNome: mc.fornecedor_nome || localMatch?.favorecido_nome,
            credorCpfCnpj: (mc.raw_data as any)?.fornecedor?.cnpj_cpf_idgener || localMatch?.favorecido_documento,
            unidadeGestoraCodigo: ugCodigo,
            unidadeGestoraNome: ugName,
            descricao: localMatch?.descricao || `Instrumento Comprasnet ${mc.numero}`,
            fonte: 'comprasnet',
            contratoNumero: mc.numero,
            rawEmpenho: localMatch ? (localMatch as any) : null,
          };

          allEmpenhosMap.set(mc.numero, baseDetail);

          if (subitens.length > 0) {
            subitens.forEach((sub: any, idx: number) => {
              const matchCompra = (sub.descricao || '').match(/Item\s*(?:compra|de\s*compra)?\s*:?\s*0*(\d+)/i);
              const itemSeq = matchCompra ? matchCompra[1] : (items.length === 1 ? items[0].numeroItem : null);
              const subVal = parseNumeric(sub.valor_atual || sub.valorAtual);

              if (itemSeq) {
                addEmpenhoToItem(itemSeq, {
                  ...baseDetail,
                  id: `mc-sub-${mc.numero}-${sub.sequencial || idx}`,
                  valor: subVal > 0 ? subVal : baseDetail.valor,
                  subitemDescricao: sub.descricao,
                  fonte: 'transparencia',
                });
              }
            });
          } else {
            const descCombined = `${baseDetail.descricao || ''} ${mc.raw_data?.objeto || ''} ${mc.raw_data?.informacao_complementar || ''}`;
            const itemMatch = descCombined.match(/Item\s*(?:compra|de\s*compra)?\s*:?\s*0*(\d+)/i);
            if (itemMatch) {
              addEmpenhoToItem(itemMatch[1], baseDetail);
            } else {
              const contractItens = contratosItens.filter((ci) => ci.contrato_api_id === mc.id);
              if (contractItens.length === 1) {
                addEmpenhoToItem(String(contractItens[0].numero_item_compra), baseDetail);
              } else if (items.length === 1) {
                addEmpenhoToItem(items[0].numeroItem, baseDetail);
              }
            }
          }
        }
      }

      // C) Empenhos locais (SIAFI) validados
      for (const local of matchedLocalEmpenhos) {
        if (!allEmpenhosMap.has(local.numero)) {
          const ugCodigo = detectUasgFromEmpenho(local.processo, local.descricao, ata.unidadeGerenciadoraCodigo);
          const ugName = IFRN_UASG_CATALOG.find((u) => u.codigo === ugCodigo)?.nome;
          const docKey = `${ugCodigo}26435${local.numero}`;
          const subitens = cachedMap.get(docKey) || [];

          const baseDetail: ItemEmpenhoDetail = {
            id: `local-${local.numero}`,
            numeroEmpenho: local.numero,
            dataEmissao: local.data_empenho,
            valor: parseNumeric(local.valor),
            valorLiquidado: parseNumeric(local.valor_liquidado),
            credorNome: local.favorecido_nome,
            credorCpfCnpj: local.favorecido_documento,
            unidadeGestoraCodigo: ugCodigo,
            unidadeGestoraNome: ugName,
            descricao: local.descricao,
            fonte: 'siafi',
            rawEmpenho: local as any,
          };

          allEmpenhosMap.set(local.numero, baseDetail);

          if (subitens.length > 0) {
            subitens.forEach((sub: any, idx: number) => {
              const matchCompra = (sub.descricao || '').match(/Item\s*(?:compra|de\s*compra)?\s*:?\s*0*(\d+)/i);
              const itemSeq = matchCompra ? matchCompra[1] : (items.length === 1 ? items[0].numeroItem : null);
              const subVal = parseNumeric(sub.valor_atual || sub.valorAtual);

              if (itemSeq) {
                addEmpenhoToItem(itemSeq, {
                  ...baseDetail,
                  id: `local-sub-${local.numero}-${sub.sequencial || idx}`,
                  valor: subVal > 0 ? subVal : baseDetail.valor,
                  subitemDescricao: sub.descricao,
                  fonte: 'transparencia',
                });
              }
            });
          } else {
            const itemMatch = (local.descricao || '').match(/Item\s*(?:compra|de\s*compra)?\s*:?\s*0*(\d+)/i);
            if (itemMatch) {
              addEmpenhoToItem(itemMatch[1], baseDetail);
            } else if (items.length === 1) {
              addEmpenhoToItem(items[0].numeroItem, baseDetail);
            }
          }
        }
      }

      // D) Reconciliação dos saldos dos itens
      itemEmpenhosMap.forEach((empenhosList, itemNum) => {
        const sum = empenhosList.reduce((acc, emp) => acc + (emp.valor || 0), 0);
        if (sum > 0) {
          itemCommittedMap.set(itemNum, sum);
        }
      });

      // E) Total geral empenhado
      let totalEmp = 0;
      if (itemCommittedMap.size > 0) {
        itemCommittedMap.forEach((val) => {
          totalEmp += val;
        });
      } else {
        allEmpenhosMap.forEach((emp) => {
          totalEmp += emp.valor || 0;
        });
      }

      return {
        itemCommittedMap,
        itemEmpenhosMap,
        totalEmpenhado: totalEmp,
        contratos: matchedContratos,
        allEmpenhos: Array.from(allEmpenhosMap.values()),
      };
    },
    enabled: Boolean(ata),
    staleTime: 60000,
  });

  const toggleItemExpanded = (itemKey: string) => {
    setExpandedItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const handleSyncDetails = async () => {
    if (!ata) return;
    const detailDate = dateOnly(ata.dataVigenciaInicial) ?? dateOnly(ata.dataAssinatura) ?? toDateInputValue(new Date());
    setIsSyncingDetails(true);
    try {
      const result = await atasRegistroPrecosService.sync({
        unidadeCodigos: [ata.unidadeGerenciadoraCodigo],
        dataInicial: detailDate,
        dataFinal: detailDate,
        numeroAta: ata.numeroAta,
        includeDetalhes: true,
        source: 'frontend-detail',
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['atas-registro-precos-itens', ata.ataKey] }),
        queryClient.invalidateQueries({ queryKey: ['atas-registro-precos-unidades', ata.ataKey] }),
        queryClient.invalidateQueries({ queryKey: ['atas-registro-precos'] }),
      ]);
      if (result.status === 'partial_success' || result.status === 'error') {
        toast.warning(getSyncWarningMessage(result));
      } else {
        toast.success(`${result.upserted} detalhe(s) materializado(s).`);
      }
    } catch (error) {
      const warningMessage = getSyncThrownWarningMessage(error);
      if (warningMessage) {
        toast.warning(warningMessage);
      } else {
        toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar os detalhes da ata.');
      }
    } finally {
      setIsSyncingDetails(false);
    }
  };

  const vigenciaInfo = getVigenciaInfo(ata?.dataVigenciaFinal);

  // Lista de UASGs participantes/aderentes/gerenciadora da Ata
  const availableUasgs = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; tipo: string; isGerenciadora: boolean }>();

    if (ata?.unidadeGerenciadoraCodigo) {
      const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === ata.unidadeGerenciadoraCodigo);
      map.set(ata.unidadeGerenciadoraCodigo, {
        codigo: ata.unidadeGerenciadoraCodigo,
        nome: ata.unidadeGerenciadoraNome || cat?.nome || `UASG ${ata.unidadeGerenciadoraCodigo}`,
        tipo: 'Gerenciadora',
        isGerenciadora: true,
      });
    }

    (ata?.unidadesParticipantes || []).forEach((codigo) => {
      if (!map.has(codigo)) {
        const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === codigo);
        map.set(codigo, {
          codigo,
          nome: cat?.nome || `UASG ${codigo}`,
          tipo: 'Participante',
          isGerenciadora: false,
        });
      }
    });

    (ata?.unidadesAderentes || []).forEach((codigo) => {
      if (!map.has(codigo)) {
        const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === codigo);
        map.set(codigo, {
          codigo,
          nome: cat?.nome || `UASG ${codigo}`,
          tipo: 'Aderente (Carona)',
          isGerenciadora: false,
        });
      }
    });

    unidades.forEach((u) => {
      if (!map.has(u.unidadeCodigo)) {
        const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === u.unidadeCodigo);
        const tipoLabel = u.tipoUnidade === 'GERENCIADORA' ? 'Gerenciadora' : u.tipoUnidade === 'ADERENTE' ? 'Aderente (Carona)' : 'Participante';
        map.set(u.unidadeCodigo, {
          codigo: u.unidadeCodigo,
          nome: u.unidadeNome || cat?.nome || `UASG ${u.unidadeCodigo}`,
          tipo: tipoLabel,
          isGerenciadora: u.tipoUnidade === 'GERENCIADORA',
        });
      }
    });

    (executionData.allEmpenhos || []).forEach((emp) => {
      if (emp.unidadeGestoraCodigo && !map.has(emp.unidadeGestoraCodigo)) {
        const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === emp.unidadeGestoraCodigo);
        map.set(emp.unidadeGestoraCodigo, {
          codigo: emp.unidadeGestoraCodigo,
          nome: emp.unidadeGestoraNome || cat?.nome || `UASG ${emp.unidadeGestoraCodigo}`,
          tipo: 'Emitente / Contratante',
          isGerenciadora: emp.unidadeGestoraCodigo === ata?.unidadeGerenciadoraCodigo,
        });
      }
    });

    return Array.from(map.values());
  }, [ata, unidades, executionData.allEmpenhos]);

  const isScoped = selectedUasgScope !== 'todas';
  const selectedUasgInfo = isScoped ? availableUasgs.find((u) => u.codigo === selectedUasgScope) : null;

  // Mapa de cotas de unidades indexadas por (numeroItem + '_' + unidadeCodigo)
  const unidadesByItemAndUasg = useMemo(() => {
    const map = new Map<string, typeof unidades[0]>();
    unidades.forEach((u) => {
      const itemNum = String(Number(u.numeroItem || '0'));
      if (itemNum && itemNum !== '0') {
        map.set(`${itemNum}_${u.unidadeCodigo}`, u);
      }
      if (u.itemKey) {
        map.set(`${u.itemKey}_${u.unidadeCodigo}`, u);
      }
    });
    return map;
  }, [unidades]);

  // Cálculos consolidados no escopo selecionado (Geral vs UASG específica)
  const { valorTotalAta, totalEmpenhadoAta, saldoGeralAta, percentualConsumidoGeral } = useMemo(() => {
    if (!ata) return { valorTotalAta: 0, totalEmpenhadoAta: 0, saldoGeralAta: 0, percentualConsumidoGeral: 0 };

    if (!isScoped) {
      const valTotal = rawNumber(ata, ['valorTotal', 'valor_total']) || items.reduce((acc, it) => acc + (it.valorTotal || 0), 0);
      const totalEmp = executionData.totalEmpenhado;
      const saldo = Math.max(0, valTotal - totalEmp);
      const perc = valTotal > 0 ? Math.min(100, Math.round((totalEmp / valTotal) * 100)) : 0;
      return { valorTotalAta: valTotal, totalEmpenhadoAta: totalEmp, saldoGeralAta: saldo, percentualConsumidoGeral: perc };
    }

    // Escopo por UASG específica:
    const isGerenciadora = selectedUasgScope === ata.unidadeGerenciadoraCodigo;
    const isSingleUnitAta = availableUasgs.length <= 1;

    let valTotalUasg = 0;
    let totalEmpUasg = 0;
    let hasScopedItemEmpenhos = false;

    items.forEach((it) => {
      const itemNum = String(Number(it.numeroItem || '0'));
      const uItem = unidadesByItemAndUasg.get(`${itemNum}_${selectedUasgScope}`) || unidadesByItemAndUasg.get(`${it.itemKey}_${selectedUasgScope}`);
      
      const hasAnyUnitsForItem = unidades.some((u) => u.itemKey === it.itemKey || String(Number(u.numeroItem || '0')) === itemNum);
      const qtdUasg = uItem
        ? (uItem.quantidadeRegistrada ?? uItem.quantidadeAutorizada ?? 0)
        : (isGerenciadora || isSingleUnitAta ? (it.quantidadeHomologada ?? 0) : 0);

      const valItemHomologado = (isSingleUnitAta || (!uItem && isGerenciadora && !hasAnyUnitsForItem))
        ? (it.valorTotal || (qtdUasg * (it.valorUnitario || 0)) || 0)
        : qtdUasg * (it.valorUnitario || 0);

      valTotalUasg += valItemHomologado;

      const empenhosItem = executionData.itemEmpenhosMap.get(itemNum) || [];
      const scopedEmpenhos = empenhosItem.filter(
        (emp) => !emp.unidadeGestoraCodigo || emp.unidadeGestoraCodigo === selectedUasgScope || (isSingleUnitAta && isGerenciadora)
      );
      if (scopedEmpenhos.length > 0) {
        hasScopedItemEmpenhos = true;
        totalEmpUasg += scopedEmpenhos.reduce((acc, emp) => acc + (emp.valor || 0), 0);
      }
    });

    if (!hasScopedItemEmpenhos) {
      const scopedAllEmpenhos = executionData.allEmpenhos.filter(
        (emp) => !emp.unidadeGestoraCodigo || emp.unidadeGestoraCodigo === selectedUasgScope || (isSingleUnitAta && isGerenciadora)
      );
      totalEmpUasg = scopedAllEmpenhos.reduce((acc, emp) => acc + (emp.valor || 0), 0);
    }

    const saldoUasg = Math.max(0, valTotalUasg - totalEmpUasg);
    const percUasg = valTotalUasg > 0 ? Math.min(100, Math.round((totalEmpUasg / valTotalUasg) * 100)) : 0;

    return { valorTotalAta: valTotalUasg, totalEmpenhadoAta: totalEmpUasg, saldoGeralAta: saldoUasg, percentualConsumidoGeral: percUasg };
  }, [ata, isScoped, items, executionData, selectedUasgScope, unidadesByItemAndUasg, availableUasgs, unidades]);

  const linkAtaPncp = ata ? rawString(ata, ['linkAtaPNCP', 'linkCompraPNCP']) : null;

  return (
    <>
      <Dialog open={Boolean(ata)} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden border border-border-default bg-surface-card p-0 shadow-2xl">
          {ata ? (
            <>
              <DialogHeader className="border-b border-border-default/60 px-6 py-4 pr-12 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-xl font-semibold text-text-primary">Ata {ata.numeroAta}</DialogTitle>
                    <Badge variant="outline" className={vigenciaInfo.badgeClass}>
                      {vigenciaInfo.label}
                    </Badge>
                    {(isLoadingExecution || isLoadingItems || isLoadingUnidades) && (
                      <Badge variant="outline" className="gap-1.5 border-action-primary/30 bg-action-primary/10 text-action-primary animate-pulse text-xs font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Calculando saldos e empenhos...
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <DialogDescription className="text-sm text-text-secondary">
                    {formatUasg(ata.unidadeGerenciadoraCodigo, ata.unidadeGerenciadoraNome)}
                  </DialogDescription>

                  <div className="flex items-center gap-2">
                    <span className="font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted whitespace-nowrap">
                      Escopo:
                    </span>
                    <Select value={selectedUasgScope} onValueChange={setSelectedUasgScope}>
                      <SelectTrigger className="h-7.5 w-64 text-xs font-medium bg-surface-subtle/70">
                        <SelectValue placeholder="Selecione o Campus / UASG" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas" className="text-xs font-semibold">
                          🌐 Todas as UASGs (Geral Consolidado)
                        </SelectItem>
                        {availableUasgs.map((u) => (
                          <SelectItem key={u.codigo} value={u.codigo} className="text-xs">
                            {u.codigo} — {u.nome} ({u.tipo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isScoped && selectedUasgInfo && (
                  <div className="flex items-center justify-between gap-2 rounded-radius-md border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs text-text-primary">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <span>
                        Exibindo saldos e cotas específicos de: <strong>{selectedUasgInfo.nome}</strong> (UASG {selectedUasgInfo.codigo} • {selectedUasgInfo.tipo})
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] font-medium text-primary hover:bg-primary/10"
                      onClick={() => setSelectedUasgScope('todas')}
                    >
                      Ver Geral da Ata
                    </Button>
                  </div>
                )}

                <div className="rounded-radius-md border border-border-default bg-surface-subtle/40 p-3.5 space-y-1.5">
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Objeto da Ata</p>
                  <p className="font-ui text-sm leading-relaxed text-text-primary">{ata.objeto || '-'}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                    <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      {isScoped ? `Valor Homologado (${selectedUasgScope})` : 'Valor Homologado'}
                    </p>
                    {isLoadingItems && !ata.rawData?.valorTotal ? (
                      <div className="mt-1 flex items-center gap-1.5 text-text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="font-mono text-sm">Carregando...</span>
                      </div>
                    ) : (
                      <p className="mt-1 font-mono text-base font-bold text-text-primary">{formatCurrency(valorTotalAta)}</p>
                    )}
                    <p className="text-[11px] text-text-secondary">
                      {isScoped ? `Cota registrada para UASG ${selectedUasgScope}` : 'Total registrado na ata'}
                    </p>
                  </div>
                  <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                    <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      {isScoped ? `Já Empenhado (${selectedUasgScope})` : 'Já Empenhado'}
                    </p>
                    {isLoadingExecution ? (
                      <div className="mt-1 flex items-center gap-1.5 text-text-muted">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="font-mono text-sm font-semibold">Cruzando empenhos...</span>
                      </div>
                    ) : (
                      <p className="mt-1 font-mono text-base font-bold text-text-primary">
                        {formatCurrency(totalEmpenhadoAta)}
                      </p>
                    )}
                    <p className="text-[11px] text-text-secondary">
                      {isLoadingExecution ? 'Consultando SIAFI e Contratos' : `${percentualConsumidoGeral}% consumido`}
                    </p>
                  </div>
                  <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                    <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      {isScoped ? `Saldo Disponível (${selectedUasgScope})` : 'Saldo Disponível'}
                    </p>
                    {isLoadingExecution ? (
                      <div className="mt-1 flex items-center gap-1.5 text-text-muted">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-600/70" />
                        <span className="font-mono text-sm font-semibold">Aguardando cálculo...</span>
                      </div>
                    ) : (
                      <p className="mt-1 font-mono text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(saldoGeralAta)}
                      </p>
                    )}
                    <p className="text-[11px] text-text-secondary">
                      {isLoadingExecution ? 'Aguardando apuração de empenhos' : 'Disponível para pedidos'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-text-muted" />
                      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Vigência da Ata</p>
                    </div>
                    <p className="mt-1 font-ui text-sm font-semibold text-text-primary">
                      {formatDate(ata.dataVigenciaInicial)} até {formatDate(ata.dataVigenciaFinal)}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">{vigenciaInfo.detail}</p>
                  </div>
                  <div className="rounded-radius-md border border-border-default bg-surface-subtle/60 p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-text-muted" />
                      <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Compra / Pregão de Origem</p>
                    </div>
                    <p className="mt-1 font-ui text-sm font-semibold text-text-primary">
                      {ata.numeroCompra || '-'}{ata.anoCompra ? `/${ata.anoCompra}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">{ata.modalidadeNome || 'Pregão Eletrônico'}</p>
                  </div>
                </div>

                <div className="rounded-radius-md border border-border-default bg-surface-subtle/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <h4 className="font-ui text-xs font-semibold uppercase tracking-[0.12em] text-text-primary">
                        Participantes e Adesões (Lei 14.133/2021)
                      </h4>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">{ata.totalUnidadesParticipantes} participante(s)</Badge>
                      <Badge variant="outline">{ata.totalAdesoes} carona(s)</Badge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <p className="font-semibold text-text-muted mb-1">Órgãos / Campi Participantes:</p>
                      {ata.unidadesParticipantes.length > 0 ? (
                        <ul className="space-y-1">
                          {ata.unidadesParticipantes.map((u) => {
                            const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === u);
                            return (
                              <li key={u} className="flex items-center gap-1.5 text-text-primary">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                UASG {u} — {cat?.nome || 'Órgão Participante'}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-text-secondary">Nenhum participante registrado além da gerenciadora.</p>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-text-muted mb-1">Órgãos Aderentes (Caronas):</p>
                      {ata.unidadesAderentes.length > 0 ? (
                        <ul className="space-y-1">
                          {ata.unidadesAderentes.map((u) => {
                            const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === u);
                            return (
                              <li key={u} className="flex items-center gap-1.5 text-text-primary">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                UASG {u} — {cat?.nome || 'Órgão Aderente'}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-text-secondary">Nenhuma adesão registrada até o momento.</p>
                      )}
                    </div>
                  </div>
                </div>

                <DataTablePanel
                  title="Itens e Saldos da Ata"
                  description={`${items.length} item(ns) materializado(s) • Clique em um item para ver os empenhos vinculados`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-text-secondary">
                      {items.length === 0 ? 'Os itens podem ser carregados sob demanda para evitar timeout na busca geral.' : 'Saldos cruzados com Comprasnet Contratos, SIAFI e Transparência.'}
                    </p>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void handleSyncDetails()} disabled={isSyncingDetails}>
                      {isSyncingDetails ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                      Atualizar detalhes
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead className="w-14">Item</TableHead>
                        <TableHead>Descrição & Fornecedor</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Valor Homologado</TableHead>
                        <TableHead className="text-right">Já Empenhado</TableHead>
                        <TableHead className="text-right">Saldo Restante</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingItems ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-secondary">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span>Carregando itens da ata...</span>
                            </div>
                  </TableCell>
                        </TableRow>
                      ) : items.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7}>
                            <div className="py-10 px-4 text-center">
                              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle border border-border-default/60 mb-2.5">
                                <FileText className="h-5 w-5 text-text-muted" />
                              </div>
                              <p className="text-xs font-semibold text-text-primary">Itens detalhados não disponíveis no Dados Abertos</p>
                              <p className="mt-1 text-[11px] text-text-secondary max-w-md mx-auto">
                                Esta ata está homologada e vigente, mas a listagem de itens individuais não foi disponibilizada no endpoint de Dados Abertos do Comprasnet.
                              </p>
                              {linkAtaPncp && (
                                <div className="mt-3">
                                  <a
                                    href={linkAtaPncp}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Consultar itens diretamente no PNCP
                                  </a>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : items.map((item) => {
                        const itemNum = String(Number(item.numeroItem || '0'));
                        const isGerenciadora = selectedUasgScope === ata.unidadeGerenciadoraCodigo;
                        const isSingleUnitAta = availableUasgs.length <= 1;

                        const unidadeItemForScope = isScoped
                          ? (unidadesByItemAndUasg.get(`${itemNum}_${selectedUasgScope}`) || unidadesByItemAndUasg.get(`${item.itemKey}_${selectedUasgScope}`))
                          : null;

                        const hasAnyUnitsForItem = unidades.some((u) => u.itemKey === item.itemKey || String(Number(u.numeroItem || '0')) === itemNum);

                        const allItemEmpenhos = executionData.itemEmpenhosMap.get(itemNum) || [];
                        const itemEmpenhos = isScoped
                          ? allItemEmpenhos.filter((emp) => !emp.unidadeGestoraCodigo || emp.unidadeGestoraCodigo === selectedUasgScope || (isSingleUnitAta && isGerenciadora))
                          : allItemEmpenhos;

                        const itemQtd = isScoped
                          ? (unidadeItemForScope
                              ? (unidadeItemForScope.quantidadeRegistrada ?? unidadeItemForScope.quantidadeAutorizada ?? 0)
                              : (isGerenciadora || isSingleUnitAta ? (item.quantidadeHomologada ?? 0) : 0))
                          : (item.quantidadeHomologada ?? 0);

                        const itemHomologado = isScoped
                          ? (isSingleUnitAta || (!unidadeItemForScope && isGerenciadora && !hasAnyUnitsForItem)
                              ? (item.valorTotal || (itemQtd * (item.valorUnitario || 0)) || 0)
                              : itemQtd * (item.valorUnitario || 0))
                          : (item.valorTotal || ((item.quantidadeHomologada || 0) * (item.valorUnitario || 0)) || 0);

                        const itemEmpenhado = isScoped
                          ? itemEmpenhos.reduce((acc, emp) => acc + (emp.valor || 0), 0)
                          : (executionData.itemCommittedMap.get(itemNum) || 0);

                        const itemSaldo = Math.max(0, itemHomologado - itemEmpenhado);
                        const itemPercent = itemHomologado > 0 ? Math.min(100, Math.round((itemEmpenhado / itemHomologado) * 100)) : 0;
                        const isExpanded = expandedItemKeys.has(item.itemKey);

                        let progressColor = 'bg-emerald-500';
                        if (itemPercent >= 90) progressColor = 'bg-destructive';
                        else if (itemPercent >= 70) progressColor = 'bg-amber-500';

                        // Unidades participantes deste item
                        const itemUnits = unidades.filter(
                          (u) => u.itemKey === item.itemKey || String(Number(u.numeroItem || '0')) === itemNum
                        );

                        return (
                          <Fragment key={item.itemKey}>
                            <TableRow
                              className={`cursor-pointer transition-colors hover:bg-surface-subtle/80 ${isExpanded ? 'bg-surface-subtle/50 font-medium' : ''}`}
                              onClick={() => toggleItemExpanded(item.itemKey)}
                              tabIndex={0}
                              role="button"
                              aria-expanded={isExpanded}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleItemExpanded(item.itemKey);
                                }
                              }}
                            >
                              <TableCell className="p-2 text-center text-text-muted">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 transition-transform text-primary" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 transition-transform" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-bold">{item.numeroItem}</TableCell>
                              <TableCell className="max-w-xs">
                                <p className="text-xs font-medium text-text-primary line-clamp-2">{item.descricaoItem || '-'}</p>
                                <p className="mt-0.5 text-[11px] text-text-secondary truncate">
                                  {item.fornecedorNome || item.fornecedorNi || '-'}
                                </p>
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono">
                                {itemQtd}
                                {isScoped && (
                                  <span className="block text-[10px] text-text-muted">
                                    de {item.quantidadeHomologada ?? 0} total
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono font-semibold">{formatCurrency(itemHomologado)}</TableCell>
                              <TableCell className="text-right text-xs font-mono">
                                {isLoadingExecution ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                                      <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
                                    </span>
                                    <div className="h-1.5 w-14 rounded-full bg-surface-subtle animate-pulse" />
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="font-semibold text-text-primary">{formatCurrency(itemEmpenhado)}</span>
                                    {itemEmpenhos.length > 0 ? (
                                      <Badge variant="secondary" className="mt-0.5 text-[10px] py-0 px-1.5 font-normal bg-action-primary/10 text-action-primary border-action-primary/20">
                                        {itemEmpenhos.length} empenho(s)
                                      </Badge>
                                    ) : null}
                                    <div className="mt-1 w-full bg-surface-subtle rounded-full h-1.5 overflow-hidden">
                                      <div className={`h-full ${progressColor}`} style={{ width: `${itemPercent}%` }} />
                                    </div>
                                    <span className="text-[10px] text-text-secondary">{itemPercent}%</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {isLoadingExecution ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-normal text-text-muted">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Calculando...
                                  </span>
                                ) : (
                                  formatCurrency(itemSaldo)
                                )}
                              </TableCell>
                            </TableRow>

                            {isExpanded && (
                              <TableRow className="bg-surface-subtle/30 border-t-0 hover:bg-surface-subtle/30">
                                <TableCell colSpan={7} className="p-0">
                                  <div className="p-4 border-t border-dashed border-border-default/80 bg-surface-subtle/20 space-y-4">
                                    {/* 1. QUADRO DE COTAS POR UASG / CAMPUS */}
                                    {itemUnits.length > 0 && (
                                      <div className="rounded-radius-md border border-border-default/70 bg-surface-card p-3 space-y-2.5 shadow-xs">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-primary">
                                            <Building2 className="h-3.5 w-3.5 text-primary" />
                                            <span>Distribuição de Cotas por Campus (UASG)</span>
                                          </div>
                                          <Badge variant="outline" className="text-[10px]">
                                            {itemUnits.length} unidade(s) cotista(s)
                                          </Badge>
                                        </div>

                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                          {itemUnits.map((u) => {
                                            const cat = IFRN_UASG_CATALOG.find((c) => c.codigo === u.unidadeCodigo);
                                            const isGer = u.tipoUnidade === 'GERENCIADORA' || u.unidadeCodigo === ata.unidadeGerenciadoraCodigo;
                                            const cotaQtd = u.quantidadeRegistrada ?? u.quantidadeAutorizada ?? 0;
                                            const cotaValor = cotaQtd * (item.valorUnitario || 0);

                                            const uEmpenhos = allItemEmpenhos.filter(
                                              (emp) => emp.unidadeGestoraCodigo === u.unidadeCodigo
                                            );
                                            const uEmpenhado = uEmpenhos.reduce((acc, emp) => acc + (emp.valor || 0), 0);
                                            const uSaldo = Math.max(0, cotaValor - uEmpenhado);
                                            const uPerc = cotaValor > 0 ? Math.min(100, Math.round((uEmpenhado / cotaValor) * 100)) : 0;

                                            const isCurrentScope = selectedUasgScope === u.unidadeCodigo;

                                            return (
                                              <div
                                                key={u.id}
                                                className={`rounded-radius-md border p-2.5 text-xs transition-colors ${
                                                  isCurrentScope
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                                    : 'border-border-default/50 bg-surface-subtle/40'
                                                }`}
                                              >
                                                <div className="flex items-start justify-between gap-1.5 mb-1.5">
                                                  <div className="min-w-0">
                                                    <p className="font-semibold text-text-primary truncate">
                                                      {cat?.nome || u.unidadeNome || `UASG ${u.unidadeCodigo}`}
                                                    </p>
                                                    <span className="text-[10px] text-text-muted">UASG {u.unidadeCodigo}</span>
                                                  </div>
                                                  <Badge
                                                    variant={isGer ? 'default' : 'secondary'}
                                                    className="text-[9px] px-1 py-0 shrink-0 font-normal"
                                                  >
                                                    {isGer ? 'Gerenciadora' : 'Participante'}
                                                  </Badge>
                                                </div>

                                                <div className="space-y-1 text-[11px] font-mono">
                                                  <div className="flex justify-between text-text-secondary">
                                                    <span>Cota:</span>
                                                    <span className="font-semibold text-text-primary">
                                                      {cotaQtd} un ({formatCurrency(cotaValor)})
                                                    </span>
                                                  </div>
                                                  <div className="flex justify-between text-text-secondary">
                                                    <span>Empenhado:</span>
                                                    <span className="font-medium text-text-primary">{formatCurrency(uEmpenhado)}</span>
                                                  </div>
                                                  <div className="flex justify-between text-text-secondary pt-0.5 border-t border-border-default/30">
                                                    <span>Saldo:</span>
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                      {formatCurrency(uSaldo)}
                                                    </span>
                                                  </div>
                                                </div>

                                                <div className="mt-2 w-full bg-surface-subtle rounded-full h-1 overflow-hidden">
                                                  <div
                                                    className={`h-full ${
                                                      uPerc >= 90 ? 'bg-destructive' : uPerc >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`}
                                                    style={{ width: `${uPerc}%` }}
                                                  />
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* 2. EMPENHOS VINCULADOS AO ITEM */}
                                    {isLoadingExecution ? (
                                      <div className="flex items-center justify-center gap-2 py-4 px-4 rounded-radius-md bg-surface-subtle/50 border border-border-default/40 text-xs text-text-secondary">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        <span>Buscando empenhos vinculados ao Item {item.numeroItem}...</span>
                                      </div>
                                    ) : itemEmpenhos.length === 0 ? (
                                      <div className="flex items-center gap-2 py-3 px-4 rounded-radius-md bg-surface-subtle/50 border border-border-default/40 text-xs text-text-secondary">
                                        <FileText className="h-4 w-4 text-text-muted shrink-0" />
                                        <span>
                                          {isScoped
                                            ? `Nenhum empenho vinculado a este item para a UASG ${selectedUasgScope}.`
                                            : 'Nenhum empenho vinculado especificamente a este item registrado até o momento.'}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-text-muted px-0.5">
                                          <FileText className="h-3.5 w-3.5" />
                                          <span>
                                            Empenhos do Item {isScoped ? `(UASG ${selectedUasgScope} - ${itemEmpenhos.length})` : `(${itemEmpenhos.length})`}
                                          </span>
                                        </div>
                                        {itemEmpenhos.map((emp) => (
                                          <div
                                            key={emp.id}
                                            className="rounded-radius-md border border-border-default/60 bg-surface-card p-3 shadow-sm text-xs space-y-2"
                                          >
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default/40 pb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-text-primary text-sm">{emp.numeroEmpenho}</span>
                                                {emp.unidadeGestoraCodigo ? (
                                                  <Badge variant="outline" className="text-[10px]">
                                                    UG {emp.unidadeGestoraCodigo} {emp.unidadeGestoraNome ? `(${emp.unidadeGestoraNome})` : ''}
                                                  </Badge>
                                                ) : null}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-text-primary text-sm">
                                                  {formatCurrency(emp.valor)}
                                                </span>
                                                {emp.rawEmpenho ? (
                                                  <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-6 px-2 text-[11px] gap-1"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setSelectedEmpenhoForDialog(emp.rawEmpenho ?? null);
                                                      setIsEmpenhoDialogOpen(true);
                                                    }}
                                                  >
                                                    <ExternalLink className="h-3 w-3" />
                                                    Ver Empenho
                                                  </Button>
                                                ) : null}
                                              </div>
                                            </div>

                                            <div className="grid gap-2 sm:grid-cols-2 text-text-secondary">
                                              <div>
                                                <p className="text-[11px] text-text-muted">Favorecido:</p>
                                                <p className="font-medium text-text-primary">
                                                  {emp.credorNome || '-'} {emp.credorCpfCnpj ? `(${emp.credorCpfCnpj})` : ''}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-[11px] text-text-muted">Data de Emissão:</p>
                                                <p className="font-medium text-text-primary">{formatDate(emp.dataEmissao)}</p>
                                              </div>
                                            </div>

                                            {emp.subitemDescricao ? (
                                              <div className="rounded bg-surface-subtle/60 p-2 text-[11px] text-text-secondary border border-border-default/30">
                                                <span className="font-semibold text-text-primary">Subitem:</span> {emp.subitemDescricao}
                                              </div>
                                            ) : emp.descricao ? (
                                              <div className="rounded bg-surface-subtle/50 p-2 text-[11px] text-text-secondary line-clamp-2">
                                                <span className="font-semibold text-text-primary">Finalidade: </span>
                                                {emp.descricao}
                                              </div>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </DataTablePanel>
              </div>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default/60 bg-surface-subtle/30 px-6 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {linkAtaPncp ? (
                    <Button type="button" variant="default" size="sm" className="gap-2" asChild>
                      <a href={linkAtaPncp} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Abrir Ata Oficial no PNCP
                      </a>
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                    <a href={rawString(ata, ['linkCompraPNCP']) ?? 'https://dadosabertos.compras.gov.br/swagger-ui/index.html'} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Ver Processo de Compra
                    </a>
                  </Button>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {selectedEmpenhoForDialog ? (
        <EmpenhoDialog
          open={isEmpenhoDialogOpen}
          onOpenChange={(isOpen) => {
            setIsEmpenhoDialogOpen(isOpen);
            if (!isOpen) setSelectedEmpenhoForDialog(null);
          }}
          empenho={selectedEmpenhoForDialog}
        />
      ) : null}
    </>
  );
}

export default function AtasRegistroPrecos() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [uasgCodigo, setUasgCodigo] = useState(DEFAULT_PNCP_UASG);
  const [vinculo, setVinculo] = useState<AtaRegistroPrecoVinculoFilter>('qualquer-vinculo');
  const [search, setSearch] = useState('');
  const [dataInicial, setDataInicial] = useState(getDefaultStartDate);
  const [dataFinal, setDataFinal] = useState(toDateInputValue(new Date()));
  const [apenasVigentes, setApenasVigentes] = useState(false);
  const [selectedAta, setSelectedAta] = useState<AtaRegistroPrecoRow | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const queryParams = useMemo(() => ({
    page,
    pageSize,
    uasgCodigo,
    vinculo,
    search,
    dataInicial,
    dataFinal,
    apenasVigentes,
  }), [apenasVigentes, dataFinal, dataInicial, page, pageSize, search, uasgCodigo, vinculo]);

  const { data: listResult = { rows: [], count: 0 }, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['atas-registro-precos', queryParams],
    queryFn: () => atasRegistroPrecosService.list(queryParams),
    staleTime: 30000,
  });

  const totalPages = Math.max(1, Math.ceil(listResult.count / pageSize));
  const currentRows = listResult.rows;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['atas-registro-precos'] });
  };

  const reloadCachedRows = async () => {
    await invalidate();
    await refetch();
  };

  const handleSync = async (internal = false) => {
    setIsSyncing(true);
    try {
      const shouldSearchParticipantCache = vinculo === 'participante' && isInternalUasg(uasgCodigo);
      const shouldSearchAdesaoCache = vinculo === 'aderente' && isInternalUasg(uasgCodigo);
      const result = internal || shouldSearchParticipantCache || shouldSearchAdesaoCache
        ? await atasRegistroPrecosService.syncInternalUasgs({
          dataInicial,
          dataFinal,
          objetoBusca: search,
          includeParticipantes: shouldSearchParticipantCache,
          includeAdesoes: shouldSearchAdesaoCache,
          adesaoUnidadeCodigos: shouldSearchAdesaoCache ? [uasgCodigo] : undefined,
          source: shouldSearchParticipantCache
            ? 'frontend-participante-cache'
            : shouldSearchAdesaoCache
              ? 'frontend-aderente-cache'
              : 'frontend-ifrn-cache',
        })
        : await atasRegistroPrecosService.sync({
          unidadeCodigos: [uasgCodigo],
          dataInicial,
          dataFinal,
          objetoBusca: search,
          includeDetalhes: false,
          includeParticipantes: vinculo === 'participante',
          includeAdesoes: vinculo === 'aderente',
          source: 'frontend-search',
        });

      await reloadCachedRows();
      if (result.status === 'partial_success' || result.status === 'error') {
        toast.warning(getSyncWarningMessage(result));
      } else {
        toast.success(`${result.upserted} registro(s) materializado(s).`);
      }
    } catch (error) {
      await reloadCachedRows();
      const warningMessage = getSyncThrownWarningMessage(error);
      if (warningMessage) {
        toast.warning(warningMessage);
      } else {
        toast.error(error instanceof Error ? error.message : 'Não foi possível sincronizar as atas.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>
        <span>Licitações / Atas e ARP</span>
      </HeaderSubtitle>
      <HeaderActions>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar lista
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={() => void handleSync(true)} disabled={isSyncing}>
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Sincronizar UASGs IFRN
          </Button>
        </div>
      </HeaderActions>

      <FilterPanel>
        <div className="grid gap-3 xl:grid-cols-[130px_170px_140px_140px_minmax(200px,1fr)_130px_140px]">
          <FilterField label="UASG">
            <Input
              value={uasgCodigo}
              onChange={(event) => {
                setUasgCodigo(event.target.value.replace(/\D/g, '').slice(0, 6));
                setPage(1);
              }}
              inputMode="numeric"
              aria-label="UASG"
              placeholder="158366"
            />
          </FilterField>
          <FilterField label="Vínculo">
            <Select
              value={vinculo}
              onValueChange={(value) => {
                setVinculo(value as AtaRegistroPrecoVinculoFilter);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vínculo" />
              </SelectTrigger>
              <SelectContent>
                {vinculoOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Data inicial">
            <Input type="date" value={dataInicial} onChange={(event) => { setDataInicial(event.target.value); setPage(1); }} aria-label="Data inicial" />
          </FilterField>
          <FilterField label="Data final">
            <Input type="date" value={dataFinal} onChange={(event) => { setDataFinal(event.target.value); setPage(1); }} aria-label="Data final" />
          </FilterField>
          <FilterField label="Busca">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                className="pl-9"
                aria-label="Busca"
                placeholder="Ata, compra, objeto, item ou fornecedor"
              />
            </div>
          </FilterField>
          <FilterField label="Vigência">
            <Button
              type="button"
              variant={apenasVigentes ? 'default' : 'outline'}
              className="w-full text-xs font-semibold"
              onClick={() => {
                setApenasVigentes(!apenasVigentes);
                setPage(1);
              }}
            >
              {apenasVigentes ? 'Apenas vigentes' : 'Todas as vigências'}
            </Button>
          </FilterField>
          <div className="flex items-end">
            <Button type="button" className="w-full gap-2" onClick={() => void handleSync()} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
              Buscar ARP
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          A busca por item ou fornecedor considera os detalhes já carregados. Abra uma ata e use "Atualizar detalhes" para ampliar a pesquisa local.
        </p>
      </FilterPanel>

      <DataTablePanel title="Lista de atas" description={`${listResult.count} registro(s) no filtro atual`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ata / Compra</TableHead>
              <TableHead>Objeto</TableHead>
              <TableHead>Gerenciadora</TableHead>
              <TableHead>Vigência & Status</TableHead>
              <TableHead>Vínculos</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando atas...
                  </div>
                </TableCell>
              </TableRow>
            ) : currentRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="py-10 text-center text-sm text-text-secondary">Nenhuma ata encontrada.</div>
                </TableCell>
              </TableRow>
            ) : currentRows.map((row) => {
              const vigencia = getVigenciaInfo(row.dataVigenciaFinal);
              return (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[160px]">
                    <p className="font-mono text-xs font-semibold text-text-primary">{row.numeroAta}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{row.numeroCompra || '-'}{row.anoCompra ? `/${row.anoCompra}` : ''}</p>
                  </TableCell>
                  <TableCell className="max-w-xl">
                    <p className="line-clamp-3 text-sm text-text-primary">{row.objeto || '-'}</p>
                    {row.itemCorrespondente ? (
                      <div className="mt-2 rounded-radius-md border border-primary/15 bg-primary/[0.04] px-2.5 py-2">
                        <Badge variant="outline" className="mb-1 border-primary/20 bg-primary/[0.08] text-primary">
                          Encontrado em item
                        </Badge>
                        <p className="text-xs font-medium text-text-primary">
                          Item {row.itemCorrespondente.numeroItem}: {row.itemCorrespondente.descricaoItem || row.itemCorrespondente.codigoItem || '-'}
                        </p>
                        {row.itemCorrespondente.fornecedorNome || row.itemCorrespondente.fornecedorNi ? (
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {row.itemCorrespondente.fornecedorNome || row.itemCorrespondente.fornecedorNi}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-[180px] text-sm">{formatUasg(row.unidadeGerenciadoraCodigo, row.unidadeGerenciadoraNome)}</TableCell>
                  <TableCell className="min-w-[170px] text-sm">
                    <div className="space-y-1">
                      <Badge variant="outline" className={vigencia.badgeClass}>
                        {vigencia.label}
                      </Badge>
                      <p className="text-xs text-text-secondary">
                        {formatDate(row.dataVigenciaInicial)} até {formatDate(row.dataVigenciaFinal)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[190px]">{vinculoBadges(row, uasgCodigo)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedAta(row)}>
                      Detalhar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={listResult.count}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </DataTablePanel>

      <AtasDetailsDialog ata={selectedAta} onOpenChange={(open) => !open && setSelectedAta(null)} />
    </div>
  );
}
