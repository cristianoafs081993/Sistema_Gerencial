import { Fragment, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Coins,
  DollarSign,
  ExternalLink,
  FileSearch,
  FileStack,
  FileText,
  FolderSync,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Receipt,
  ScanSearch,
  ScrollText,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  UserCog,
  Users,
  Wand2,
  Warehouse,
  X,
  Zap,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { appScreenGroups, appScreens, type AppScreenGroupId } from '@/lib/appScreens';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { DocumentoDetalhesDialog } from '@/components/DocumentoDetalhesDialog';
import { formatCurrency, formatarDocumento, formatDocumentoId } from '@/lib/utils';
import { getEmpenhoAvailableBalance } from '@/utils/empenhoBalance';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { ContratoApiDetailsSheet } from '@/components/contratos/ContratoApiDetailsSheet';
import {
  contratosApiService,
  type ContratoApiDetails,
  type ContratoApiEmpenhoRow,
  type ContratoApiFaturaRow,
  type ContratoApiHistoricoRow,
  type ContratoApiRow,
  type ContratoApiSyncRun,
} from '@/services/contratosApi';
import { isContratoApiCampusEmpenho } from '@/utils/contratosApiStatus';
import { contractDaysRemaining, contractDeadlineLabel, formatContractDate } from '@/utils/contractPresentation';
import {
  buildContractExecutionSummary,
  buildLocalEmpenhoLookupMap,
  type ContractExecutionRow,
} from '@/utils/contractExecutionSummary';
import { DEFAULT_IFRN_CAMPUS_UASG } from '@/lib/ifrnCampuses';
import { normalizeContratoNumero, shouldIgnoreContratoNumero } from '@/utils/contratosSync';
import { transparenciaService } from '@/services/transparencia';
import { getRapReferenceYear } from '@/utils/rapMetrics';
import type { Empenho, Contrato, ContratoEmpenho, Atividade, DocumentoDespesa } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSuapSync?: () => void;
  onOpenPasswordChange?: () => void;
  onSignOut?: () => void;
  empenhosList?: Empenho[];
  contratosList?: Contrato[];
  contratosEmpenhosList?: ContratoEmpenho[];
  disableContractSearch?: boolean;
  atividadesList?: Atividade[];
  onSaveEmpenho?: (id: string, data: Partial<Empenho>) => void;
  campusUasg?: string;
}

type SearchScope = 'all' | 'empenhos' | 'contratos' | 'screens' | 'actions' | 'suap-processos' | 'suap-alunos' | 'suap-documentos' | 'documentos-habeis';
type ContractViewFilter = 'all' | 'expiring90' | 'pending' | 'expired120';
type SuapQueryKind = 'processos' | 'alunos' | 'documentos' | 'contratos';

const SUAP_BASE_URL = 'https://suap.ifrn.edu.br';
const CONDH_PAGE_SIZE = 20;

function getSuapQueryUrl(kind: SuapQueryKind, query: string) {
  const normalizedQuery = query.trim();
  const params = new URLSearchParams();

  if (kind === 'processos') {
    params.set('q', normalizedQuery);
    return new URL(`/admin/processo_eletronico/processo/?${params.toString()}`, SUAP_BASE_URL).href;
  }

  if (kind === 'alunos') {
    if (/^\d+$/.test(normalizedQuery)) {
      return new URL(`/edu/aluno/${normalizedQuery}/`, SUAP_BASE_URL).href;
    }
    params.set('q', normalizedQuery);
    return new URL(`/edu/alunos/?${params.toString()}`, SUAP_BASE_URL).href;
  }

  if (kind === 'documentos') {
    params.set('opcao', '1');
    params.set('q', normalizedQuery);
    return new URL(`/admin/documento_eletronico/documentotexto/?${params.toString()}`, SUAP_BASE_URL).href;
  }

  params.set('campi', '3');
  params.set('q', normalizedQuery);
  params.set('tab', 'tab_ativos');
  return new URL(`/admin/contratos/contrato/?${params.toString()}`, SUAP_BASE_URL).href;
}

function getSuapQueryTitle(kind: SuapQueryKind, query: string) {
  if (kind === 'alunos' && /^\d+$/.test(query.trim())) return `Abrir Aluno #${query.trim()}`;
  const names: Record<SuapQueryKind, string> = {
    processos: 'Processos',
    alunos: 'Alunos',
    documentos: 'Documentos',
    contratos: 'Contratos',
  };
  return `Buscar "${query.trim()}" no SUAP ${names[kind]}`;
}

const suapQueryKinds: SuapQueryKind[] = ['processos', 'alunos', 'documentos', 'contratos'];

const groupIconMap: Record<AppScreenGroupId, React.ComponentType<{ className?: string }>> = {
  orcamentario: LandmarkIcon,
  financeiro: Banknote,
  contratos: FileStack,
  licitacoes: ScrollText,
  energia: Zap,
  operacoes: Warehouse,
  documentos: FileText,
  automacoes: Clock3,
  administracao: Settings2,
};

function LandmarkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7" />
    </svg>
  );
}

// Visual highlighting of matching query in search result strings
function HighlightMatch({ text, query }: { text?: string | null; query: string }) {
  if (!text) return null;
  if (!query.trim()) return <>{text}</>;

  const clean = query.trim();
  const lowerText = text.toLowerCase();
  const lowerQuery = clean.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) {
    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length >= 2) {
      const digitIdx = text.indexOf(digitsOnly);
      if (digitIdx !== -1) {
        return (
          <>
            <span className="sr-only">{text}</span>
            <span aria-hidden="true">
              {text.slice(0, digitIdx)}
              <span className="font-bold underline decoration-primary/60 decoration-2 text-primary">
                {text.slice(digitIdx, digitIdx + digitsOnly.length)}
              </span>
              {text.slice(digitIdx + digitsOnly.length)}
            </span>
          </>
        );
      }
    }
    return <>{text}</>;
  }

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, index)}
        <span className="font-bold underline decoration-primary/60 decoration-2 text-primary">
          {text.slice(index, index + clean.length)}
        </span>
        {text.slice(index + clean.length)}
      </span>
    </>
  );
}

// Precise scoring for empenhos
function scoreEmpenho(emp: Empenho, rawQuery: string): number {
  if (!rawQuery) return 0;
  const q = rawQuery.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const words = q.split(/\s+/).filter(Boolean);

  const num = (emp.numero || '').toLowerCase();
  const fav = (emp.favorecidoNome || '').toLowerCase();
  const doc = (emp.favorecidoDocumento || '').replace(/\D/g, '');
  const proc = (emp.processo || '').toLowerCase();
  const pi = (emp.planoInterno || '').toLowerCase();
  const desc = (emp.descricao || '').toLowerCase();
  const orig = (emp.origemRecurso || '').toLowerCase();

  let score = 0;

  // 1. NE Number Matching (Highest Priority)
  if (num === q) {
    score += 20000;
  } else if (num.startsWith(q)) {
    score += 15000;
  } else if (num.includes(q)) {
    score += 10000;
  }

  // Numeric sequential part match (e.g. "32" matches "2026NE000032")
  if (digits.length >= 1) {
    const numDigits = num.replace(/\D/g, '');
    const sequentialPart = num.replace(/^.*?ne0*/i, '');

    if (sequentialPart === digits) {
      score += 18000;
    } else if (sequentialPart.startsWith(digits)) {
      score += 12000;
    } else if (num.endsWith(digits)) {
      score += 9000;
    } else if (digits.length >= 3 && numDigits.includes(digits)) {
      score += 5000;
    }
  }

  // 2. Plano Interno (PI)
  if (pi) {
    if (pi === q) score += 8000;
    else if (pi.startsWith(q)) score += 6000;
    else if (pi.includes(q)) score += 3500;
  }

  // 3. Favorecido / Credor
  if (fav) {
    if (fav.startsWith(q)) score += 5000;
    else if (fav.includes(q)) score += 3000;
    else if (words.length > 1 && words.every((w) => fav.includes(w))) score += 4000;
  }

  // 4. Descrição / Objeto
  if (desc) {
    if (desc.includes(q)) score += 2000;
    else if (words.length > 1 && words.every((w) => desc.includes(w))) score += 2500;
  }

  // 5. Processo
  if (proc && q.length >= 3 && proc.includes(q)) {
    score += 1500;
  }

  // 6. PTRES / Origem de Recurso
  if (orig && q.length >= 4 && orig.includes(q)) {
    score += 1200;
  }

  // 7. CPF/CNPJ (Only match if query has at least 5 digits to avoid 1-2 digit noise)
  if (doc && digits.length >= 5 && doc.includes(digits)) {
    score += 1000;
  }

  return score;
}

// Precise scoring for contratos
function scoreContrato(
  cont: {
    numero: string;
    fornecedorNome: string;
    fornecedorDocumento?: string | null;
    objeto: string;
    processo: string;
  },
  rawQuery: string,
): number {
  if (!rawQuery) return 0;
  const q = rawQuery.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const words = q.split(/\s+/).filter(Boolean);

  const num = (cont.numero || '').toLowerCase();
  const forn = (cont.fornecedorNome || '').toLowerCase();
  const doc = (cont.fornecedorDocumento || '').replace(/\D/g, '');
  const obj = (cont.objeto || '').toLowerCase();
  const proc = (cont.processo || '').toLowerCase();

  let score = 0;

  // 1. Termo genérico de busca por contrato
  if (q === 'contrato' || q === 'contratos' || q === 'ct') {
    score += 1000;
  }

  // 2. Número do contrato
  if (num === q) {
    score += 20000;
  } else if (num.startsWith(q)) {
    score += 15000;
  } else if (num.includes(q)) {
    score += 10000;
  }

  if (digits.length >= 1) {
    const cleanContratoNum = num.replace(/\/.*$/, '').replace(/^0+/, '');
    if (cleanContratoNum === digits) {
      score += 18000;
    } else if (cleanContratoNum.startsWith(digits)) {
      score += 12000;
    } else if (num.replace(/\D/g, '').includes(digits)) {
      score += 6000;
    }
  }

  // 3. Fornecedor
  if (forn) {
    if (forn.startsWith(q)) score += 5000;
    else if (forn.includes(q)) score += 3000;
    else if (words.length > 1 && words.every((w) => forn.includes(w))) score += 4000;
  }

  // 4. CPF/CNPJ do Fornecedor
  if (doc && digits.length >= 4 && doc.includes(digits)) {
    score += digits.length >= 11 && doc === digits ? 9000 : 3500;
  }

  // 5. Objeto
  if (obj) {
    if (obj.includes(q)) score += 2000;
    else if (words.length > 1 && words.every((w) => obj.includes(w))) score += 2500;
  }

  // 6. Processo
  if (proc && q.length >= 3 && proc.includes(q)) {
    score += 1500;
  }

  return score;
}

export function CommandPalette({
  open,
  onOpenChange,
  onOpenSuapSync,
  onOpenPasswordChange,
  onSignOut,
  empenhosList = [],
  contratosList = [],
  contratosEmpenhosList = [],
  disableContractSearch = false,
  atividadesList = [],
  onSaveEmpenho,
  campusUasg = DEFAULT_IFRN_CAMPUS_UASG,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { canAccessScreen, session } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  const [activeScope, setActiveScope] = useState<SearchScope>('all');
  const [contractViewFilter, setContractViewFilter] = useState<ContractViewFilter>('all');
  const [selectedEmpenhoForDialog, setSelectedEmpenhoForDialog] = useState<Empenho | null>(null);
  const [isEmpenhoDialogOpen, setIsEmpenhoDialogOpen] = useState(false);
  const [apiContratos, setApiContratos] = useState<ContratoApiRow[]>([]);
  const [apiEmpenhos, setApiEmpenhos] = useState<ContratoApiEmpenhoRow[]>([]);
  const [apiHistoricos, setApiHistoricos] = useState<ContratoApiHistoricoRow[]>([]);
  const [apiFaturas, setApiFaturas] = useState<ContratoApiFaturaRow[]>([]);
  const [lastApiSyncRun, setLastApiSyncRun] = useState<ContratoApiSyncRun | null>(null);
  const [selectedContratoForDialog, setSelectedContratoForDialog] = useState<ContratoApiRow | null>(null);
  const [selectedContratoLocalId, setSelectedContratoLocalId] = useState<string | null>(null);
  const [selectedContratoFallbackValor, setSelectedContratoFallbackValor] = useState<number>(0);
  const [selectedContratoDetails, setSelectedContratoDetails] = useState<ContratoApiDetails | null>(null);
  const [contratoDetailsError, setContratoDetailsError] = useState<string | null>(null);
  const [isContratoDetailsOpen, setIsContratoDetailsOpen] = useState(false);
  const [isContratoDetailsLoading, setIsContratoDetailsLoading] = useState(false);
  const [documentosPage, setDocumentosPage] = useState(1);
  const [selectedDocumentoForDialog, setSelectedDocumentoForDialog] = useState<DocumentoDespesa | null>(null);
  const [isDocumentoDetailsOpen, setIsDocumentoDetailsOpen] = useState(false);

  // Carrega contratos e resumos financeiros da API ao abrir a paleta
  useEffect(() => {
    if (disableContractSearch) {
      setApiContratos([]);
      setApiEmpenhos([]);
      setApiHistoricos([]);
      setApiFaturas([]);
      setLastApiSyncRun(null);
      return;
    }
    if (!open) return;

    let isMounted = true;
    contratosApiService
      .getContratosApi(true, campusUasg)
      .then(async (res) => {
        if (!isMounted || !Array.isArray(res)) return;
        setApiContratos(res);
        const ids = res.map((contrato) => contrato.id);
        const [empenhosRes, historicosRes, faturasRes, syncRunRes] = await Promise.all([
          contratosApiService.getEmpenhosApi ? contratosApiService.getEmpenhosApi(ids, campusUasg).catch(() => []) : Promise.resolve([]),
          contratosApiService.getHistoricosApi ? contratosApiService.getHistoricosApi(ids).catch(() => []) : Promise.resolve([]),
          contratosApiService.getFaturasApi ? contratosApiService.getFaturasApi(ids, undefined, campusUasg).catch(() => []) : Promise.resolve([]),
          contratosApiService.getLastSyncRun ? contratosApiService.getLastSyncRun(campusUasg).catch(() => null) : Promise.resolve(null),
        ]);
        if (!isMounted) return;
        if (Array.isArray(empenhosRes)) {
          setApiEmpenhos(empenhosRes.filter((emp) => isContratoApiCampusEmpenho(emp, campusUasg)));
        }
        if (Array.isArray(historicosRes)) setApiHistoricos(historicosRes);
        if (Array.isArray(faturasRes)) setApiFaturas(faturasRes);
        setLastApiSyncRun(syncRunRes ?? null);
      })
      .catch((err) => {
        console.warn('CommandPalette: aviso ao carregar contratos da API', err);
      });
    return () => {
      isMounted = false;
    };
  }, [open, campusUasg, disableContractSearch]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  // Reset search and scope on modal open/close
  useEffect(() => {
    if (!open) {
      setSearchValue('');
      setActiveScope('all');
      setContractViewFilter('all');
    }
  }, [open]);

  // Detect scoped prefixes, including the read-only SUAP searches.
  const { effectiveQuery, detectedScope, explicitSuapScope } = useMemo(() => {
    const trimmed = searchValue.trim();
    const lower = trimmed.toLowerCase();

    const condhMatch = trimmed.match(/^condh(?:[:\s]+(.*))?$/i);
    if (condhMatch) {
      return { effectiveQuery: (condhMatch[1] || '').trim(), detectedScope: 'documentos-habeis' as SearchScope, explicitSuapScope: null };
    }

    const processMatch = trimmed.match(/^(?:processos?|proc|p)[:\s]+(.+)$/i);
    if (processMatch) {
      return { effectiveQuery: processMatch[1].trim(), detectedScope: 'suap-processos' as SearchScope, explicitSuapScope: 'processos' as SuapQueryKind };
    }

    const studentMatch = trimmed.match(/^(?:alunos?|matricula|alu|mat|a)[:\s]+(.+)$/i);
    if (studentMatch) {
      return { effectiveQuery: studentMatch[1].trim(), detectedScope: 'suap-alunos' as SearchScope, explicitSuapScope: 'alunos' as SuapQueryKind };
    }

    const documentMatch = trimmed.match(/^(?:documentos?|docto|doc|d)[:\s]+(.+)$/i);
    if (documentMatch) {
      return { effectiveQuery: documentMatch[1].trim(), detectedScope: 'suap-documentos' as SearchScope, explicitSuapScope: 'documentos' as SuapQueryKind };
    }

    if (lower.startsWith('ne ') || lower.startsWith('empenho ') || lower.startsWith('ne:') || lower.startsWith('empenho:')) {
      const query = trimmed.replace(/^(ne|empenho)[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'empenhos' as SearchScope, explicitSuapScope: null };
    }
    if (/^(?:contratos?|con|c)[:\s]+/i.test(trimmed)) {
      const query = trimmed.replace(/^(?:contratos?|con|c)[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'contratos' as SearchScope, explicitSuapScope: 'contratos' as SuapQueryKind };
    }
    if (lower.startsWith('tela ') || lower.startsWith('modulo ') || lower.startsWith('tela:') || lower.startsWith('modulo:')) {
      const query = trimmed.replace(/^(tela|modulo)[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'screens' as SearchScope, explicitSuapScope: null };
    }
    if (lower.startsWith('acao ') || lower.startsWith('atalho ') || lower.startsWith('acao:') || lower.startsWith('atalho:')) {
      const query = trimmed.replace(/^(acao|atalho)[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'actions' as SearchScope, explicitSuapScope: null };
    }

    return { effectiveQuery: trimmed, detectedScope: activeScope, explicitSuapScope: null };
  }, [searchValue, activeScope]);

  const currentScope = detectedScope !== 'all' ? detectedScope : activeScope;

  const suapQueryActions = useMemo(() => {
    if (!effectiveQuery) return [];

    const kinds = explicitSuapScope
      ? [explicitSuapScope]
      : currentScope === 'all' || currentScope === 'actions'
        ? suapQueryKinds
        : currentScope === 'contratos'
          ? ['contratos' as SuapQueryKind]
          : [];

    return kinds.map((kind) => ({
      kind,
      title: getSuapQueryTitle(kind, effectiveQuery),
      url: getSuapQueryUrl(kind, effectiveQuery),
    }));
  }, [currentScope, effectiveQuery, explicitSuapScope]);

  const isCondhScope = currentScope === 'documentos-habeis';
  const condhQuery = isCondhScope ? effectiveQuery.trim() : '';
  const condhDocumentNumber = condhQuery.replace(/\D/g, '');
  const normalizedCondhNumber = condhQuery.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isValidCondhDocument = /^[\d.\-/\s]+$/.test(condhQuery) && /^(?:\d{11}|\d{14})$/.test(condhDocumentNumber);
  const isValidCondhDocumentNumber = /^\d{4,}(?:NP|RP)\d+$/.test(normalizedCondhNumber);
  const isValidCondhPartialNumber = /^\d+$/.test(condhQuery) && !isValidCondhDocument;
  const isValidCondhSearch = isValidCondhDocument || isValidCondhDocumentNumber || isValidCondhPartialNumber;
  const condhSearchLabel = isValidCondhDocument
    ? formatarDocumento(condhDocumentNumber)
    : isValidCondhPartialNumber ? `final ${condhQuery}` : normalizedCondhNumber;
  const canSearchCondh = canAccessScreen('liquidacoes-pagamentos');

  useEffect(() => {
    setDocumentosPage(1);
  }, [condhQuery]);

  const condhDocumentsQuery = useQuery({
    queryKey: ['command-palette-condh', normalizedCondhNumber, documentosPage],
    queryFn: () => transparenciaService.getDocumentosPorFavorecido(condhQuery, {
      page: documentosPage,
      perPage: CONDH_PAGE_SIZE,
    }),
    enabled: open && isCondhScope && isValidCondhSearch && canSearchCondh,
  });

  const matchingDocumentos = canSearchCondh ? condhDocumentsQuery.data?.data || [] : [];
  const totalDocumentos = canSearchCondh ? condhDocumentsQuery.data?.total || 0 : 0;

  const handleSelectScreen = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const handleSelectSuapQuery = (url: string, openInNewTab = false) => {
    onOpenChange(false);
    if (openInNewTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.assign(url);
  };

  const handleAction = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const handleSelectEmpenho = (empenho: Empenho) => {
    setSelectedEmpenhoForDialog(empenho);
    setIsEmpenhoDialogOpen(true);
    onOpenChange(false);
  };

  const handleSelectDocumento = (documento: DocumentoDespesa) => {
    setSelectedDocumentoForDialog(documento);
    setIsDocumentoDetailsOpen(true);
    onOpenChange(false);
  };

  const rapReferenceYear = useMemo(() => getRapReferenceYear(empenhosList), [empenhosList]);
  const localEmpenhoByLookupKey = useMemo(() => buildLocalEmpenhoLookupMap(empenhosList), [empenhosList]);

  const apiEmpenhosByContratoApiId = useMemo(() => {
    const map = new Map<string, ContratoApiEmpenhoRow[]>();
    for (const empenho of apiEmpenhos) {
      const current = map.get(empenho.contrato_api_id) ?? [];
      current.push(empenho);
      map.set(empenho.contrato_api_id, current);
    }
    return map;
  }, [apiEmpenhos]);

  const apiHistoricosByContratoApiId = useMemo(() => {
    const map = new Map<string, ContratoApiHistoricoRow[]>();
    for (const historico of apiHistoricos) {
      const current = map.get(historico.contrato_api_id) ?? [];
      current.push(historico);
      map.set(historico.contrato_api_id, current);
    }
    return map;
  }, [apiHistoricos]);

  const apiFaturasByContratoApiId = useMemo(() => {
    const map = new Map<string, ContratoApiFaturaRow[]>();
    for (const fatura of apiFaturas) {
      const current = map.get(fatura.contrato_api_id) ?? [];
      current.push(fatura);
      map.set(fatura.contrato_api_id, current);
    }
    return map;
  }, [apiFaturas]);

  // Lista unificada e enriquecida de contratos (mesclando API, histórico, empenhos do campus, faturas e dados locais)
  const combinedContratos = useMemo(() => {
    if (disableContractSearch) return [];

    type EnrichedPaletteContrato = {
      id: string;
      localId: string | null;
      numero: string;
      fornecedorNome: string;
      fornecedorDocumento: string | null;
      objeto: string;
      processo: string;
      vigenciaInicio: string | null;
      vigenciaFim: string | null;
      daysRemaining: number | null;
      deadlineLabel: string;
      valor: number;
      empenhado: number;
      aLiquidar: number;
      empenhosCount: number;
      openFaturasCount: number;
      hasReitoriaOrigin: boolean;
      situacaoDerivada: boolean;
      status?: string;
      apiContrato?: ContratoApiRow;
      localContrato?: Contrato;
      executionRows: ContractExecutionRow[];
    };

    const localByNorm = new Map<string, Contrato>();
    for (const loc of contratosList) {
      if (shouldIgnoreContratoNumero(loc.numero)) continue;
      const norm = normalizeContratoNumero(loc.numero) || loc.numero;
      localByNorm.set(norm, loc);
    }

    const map = new Map<string, EnrichedPaletteContrato>();

    // 1. Contratos da API (ativos + vencidos nos últimos 120 dias retornados por getContratosApi)
    for (const api of apiContratos) {
      if (shouldIgnoreContratoNumero(api.numero)) continue;
      const vigenciaInicio = api.vigencia_inicio_derivada ?? api.vigencia_inicio ?? null;
      const vigenciaFim = api.vigencia_fim_derivada ?? api.vigencia_fim ?? null;
      const daysRemaining = contractDaysRemaining(vigenciaFim);
      const isAtivo = api.situacao_derivada === true;
      const isExpired120 = daysRemaining !== null && daysRemaining < 0 && daysRemaining >= -120;
      if (!isAtivo && !isExpired120) continue;

      const norm = normalizeContratoNumero(api.numero) || api.numero;
      const loc = localByNorm.get(norm);
      const localId = loc?.id ?? null;
      const fallbackValor = loc?.valorTotal ?? loc?.valor ?? api.valor_acumulado ?? api.valor_global ?? 0;

      const summary = buildContractExecutionSummary({
        localContratoId: localId,
        fallbackValor,
        apiContrato: api,
        empenhos: empenhosList,
        contratosEmpenhos: contratosEmpenhosList,
        localEmpenhoByLookupKey,
        apiEmpenhos: apiEmpenhosByContratoApiId.get(api.id) ?? [],
        historico: apiHistoricosByContratoApiId.get(api.id) ?? [],
        faturas: apiFaturasByContratoApiId.get(api.id) ?? [],
        rapReferenceYear,
      });

      map.set(norm, {
        id: api.id,
        localId,
        numero: loc?.numero ?? api.numero,
        fornecedorNome: api.fornecedor_nome || loc?.fornecedorNome || loc?.contratada || '',
        fornecedorDocumento: api.fornecedor_documento || loc?.cnpj || null,
        objeto: api.objeto || loc?.objeto || '',
        processo: api.processo || loc?.processo || '',
        vigenciaInicio,
        vigenciaFim,
        daysRemaining,
        deadlineLabel: contractDeadlineLabel(vigenciaFim),
        valor: summary.valorGlobal,
        empenhado: summary.empenhado,
        aLiquidar: summary.aLiquidar,
        empenhosCount: summary.empenhosCount,
        openFaturasCount: summary.openFaturas.length,
        hasReitoriaOrigin: summary.hasReitoriaOrigin,
        situacaoDerivada: isAtivo,
        status: isAtivo ? 'Ativo' : 'Encerrado',
        apiContrato: api,
        localContrato: loc,
        executionRows: summary.rows,
      });
    }

    // 2. Mescla contratos locais ativos que não constam na API
    for (const loc of contratosList) {
      if (shouldIgnoreContratoNumero(loc.numero)) continue;
      const statusNorm = (loc.status || '').trim().toLowerCase();
      const isLocalInativo = ['inativo', 'encerrado', 'concluido', 'concluído', 'rescindido', 'cancelado'].includes(statusNorm);
      if (isLocalInativo) continue;

      const norm = normalizeContratoNumero(loc.numero) || loc.numero;
      if (map.has(norm)) continue;

      const rawInicio = loc.dataInicio ?? loc.data_inicio ?? null;
      const rawFim = loc.dataFim ?? loc.data_termino ?? null;
      const vigenciaInicio = rawInicio ? String(rawInicio).slice(0, 10) : null;
      const vigenciaFim = rawFim ? String(rawFim).slice(0, 10) : null;
      const daysRemaining = contractDaysRemaining(vigenciaFim);
      const fallbackValor = loc.valorTotal || loc.valor || 0;

      const summary = buildContractExecutionSummary({
        localContratoId: loc.id,
        fallbackValor,
        apiContrato: null,
        empenhos: empenhosList,
        contratosEmpenhos: contratosEmpenhosList,
        localEmpenhoByLookupKey,
        rapReferenceYear,
      });

      map.set(norm, {
        id: loc.id,
        localId: loc.id,
        numero: loc.numero,
        fornecedorNome: loc.fornecedorNome || loc.contratada || '',
        fornecedorDocumento: loc.cnpj || null,
        objeto: loc.objeto || '',
        processo: loc.processo || '',
        vigenciaInicio,
        vigenciaFim,
        daysRemaining,
        deadlineLabel: contractDeadlineLabel(vigenciaFim),
        valor: summary.valorGlobal || fallbackValor,
        empenhado: summary.empenhado,
        aLiquidar: summary.aLiquidar,
        empenhosCount: summary.empenhosCount,
        openFaturasCount: 0,
        hasReitoriaOrigin: false,
        situacaoDerivada: true,
        status: loc.status || 'Ativo',
        localContrato: loc,
        executionRows: summary.rows,
      });
    }

    return Array.from(map.values());
  }, [
    apiContratos,
    apiEmpenhosByContratoApiId,
    apiFaturasByContratoApiId,
    apiHistoricosByContratoApiId,
    contratosEmpenhosList,
    contratosList,
    disableContractSearch,
    empenhosList,
    localEmpenhoByLookupKey,
    rapReferenceYear,
  ]);

  const matchesContractFilter = (cont: (typeof combinedContratos)[number], view: ContractViewFilter) => {
    if (view === 'all') return cont.situacaoDerivada;
    if (view === 'expiring90') {
      return cont.situacaoDerivada && cont.daysRemaining !== null && cont.daysRemaining >= 0 && cont.daysRemaining <= 90;
    }
    if (view === 'pending') {
      return cont.openFaturasCount > 0;
    }
    return cont.daysRemaining !== null && cont.daysRemaining < 0 && cont.daysRemaining >= -120;
  };

  const contractFilterCounts = useMemo(() => {
    const counts: Record<ContractViewFilter, number> = {
      all: 0,
      expiring90: 0,
      pending: 0,
      expired120: 0,
    };
    for (const c of combinedContratos) {
      if (matchesContractFilter(c, 'all')) counts.all += 1;
      if (matchesContractFilter(c, 'expiring90')) counts.expiring90 += 1;
      if (matchesContractFilter(c, 'pending')) counts.pending += 1;
      if (matchesContractFilter(c, 'expired120')) counts.expired120 += 1;
    }
    return counts;
  }, [combinedContratos]);

  const handleSelectContrato = async (cont: (typeof combinedContratos)[number]) => {
    setIsContratoDetailsOpen(true);
    setIsContratoDetailsLoading(true);
    setContratoDetailsError(null);
    setSelectedContratoLocalId(cont.localId);
    setSelectedContratoFallbackValor(cont.valor || 0);
    onOpenChange(false);

    try {
      let apiContrato = cont.apiContrato;

      if (!apiContrato && typeof contratosApiService.getContratoApiByNumeroOrId === 'function') {
        apiContrato = (await contratosApiService.getContratoApiByNumeroOrId(cont.numero || cont.id, campusUasg)) ?? undefined;
      }

      if (apiContrato) {
        const normalizedContrato: ContratoApiRow = {
          ...apiContrato,
          vigencia_inicio: apiContrato.vigencia_inicio_derivada ?? apiContrato.vigencia_inicio,
          vigencia_fim: apiContrato.vigencia_fim_derivada ?? apiContrato.vigencia_fim,
        };
        setSelectedContratoForDialog(normalizedContrato);
        const details = await contratosApiService.getContratoApiDetails(apiContrato.id, campusUasg);
        const campusEmpenhos = details.empenhos.filter((empenho) => isContratoApiCampusEmpenho(empenho, campusUasg));
        const campusEmpenhoIds = new Set(campusEmpenhos.map((empenho) => empenho.id));
        const campusApiEmpenhoIds = new Set(campusEmpenhos.map((empenho) => Number(empenho.api_empenho_id)));
        setSelectedContratoDetails({
          ...details,
          empenhos: campusEmpenhos,
          faturaEmpenhos: details.faturaEmpenhos.filter(
            (row) =>
              (row.contrato_api_empenho_id != null && campusEmpenhoIds.has(row.contrato_api_empenho_id)) ||
              (row.api_empenho_id != null && campusApiEmpenhoIds.has(Number(row.api_empenho_id))),
          ),
        });
      } else {
        const loc = cont.localContrato;
        const fallbackContrato: ContratoApiRow = {
          id: cont.id,
          api_contrato_id: loc?.ano || 0,
          numero: cont.numero,
          fornecedor_nome: cont.fornecedorNome || null,
          fornecedor_documento: loc?.cnpj || null,
          unidade_codigo: campusUasg,
          unidade_nome: `INST.FED. DO RN/CAMPUS ${campusUasg}`,
          unidade_origem_codigo: null,
          unidade_origem_nome: null,
          objeto: cont.objeto || 'Contrato cadastrado localmente',
          processo: cont.processo || null,
          vigencia_inicio: cont.vigenciaInicio,
          vigencia_fim: cont.vigenciaFim,
          valor_global: cont.valor || null,
          valor_acumulado: cont.valor || null,
          situacao: cont.status === 'Ativo',
          situacao_derivada: cont.situacaoDerivada,
          updated_at: new Date().toISOString(),
        };
        setSelectedContratoForDialog(fallbackContrato);
        setSelectedContratoDetails({
          historico: [],
          empenhos: [],
          itens: [],
          faturas: [],
          faturaItens: [],
          faturaEmpenhos: [],
        });
      }
    } catch (error) {
      console.error('CommandPalette: erro ao carregar detalhes do contrato', error);
      setContratoDetailsError('Não foi possível carregar os detalhes do contrato. Tente novamente.');
      setSelectedContratoDetails({
        historico: [],
        empenhos: [],
        itens: [],
        faturas: [],
        faturaItens: [],
        faturaEmpenhos: [],
      });
    } finally {
      setIsContratoDetailsLoading(false);
    }
  };

  const selectedContratoExecution = useMemo(() => {
    if (!selectedContratoForDialog) return undefined;
    const historico =
      selectedContratoDetails?.historico?.length
        ? selectedContratoDetails.historico
        : apiHistoricosByContratoApiId.get(selectedContratoForDialog.id) ?? [];
    const detailEmpenhos =
      selectedContratoDetails?.empenhos?.length
        ? selectedContratoDetails.empenhos
        : apiEmpenhosByContratoApiId.get(selectedContratoForDialog.id) ?? [];
    const summary = buildContractExecutionSummary({
      localContratoId: selectedContratoLocalId,
      fallbackValor: selectedContratoFallbackValor,
      apiContrato: selectedContratoForDialog,
      empenhos: empenhosList,
      contratosEmpenhos: contratosEmpenhosList,
      localEmpenhoByLookupKey,
      apiEmpenhos: detailEmpenhos,
      historico,
      rapReferenceYear,
    });
    return {
      valorGlobal: summary.valorGlobal,
      empenhado: summary.empenhado,
      rows: summary.rows,
    };
  }, [
    apiEmpenhosByContratoApiId,
    apiHistoricosByContratoApiId,
    contratosEmpenhosList,
    empenhosList,
    localEmpenhoByLookupKey,
    rapReferenceYear,
    selectedContratoDetails,
    selectedContratoFallbackValor,
    selectedContratoForDialog,
    selectedContratoLocalId,
  ]);

  // High-precision scored Empenhos (ranked by relevance) - omite empenhos com saldo zero
  const matchingEmpenhos = useMemo(() => {
    if (currentScope !== 'all' && currentScope !== 'empenhos') return [];
    const withSaldo = empenhosList.filter((emp) => getEmpenhoAvailableBalance(emp) > 0);

    if (!effectiveQuery) {
      if (currentScope === 'empenhos') {
        return withSaldo.slice(0, 15);
      }
      return [];
    }

    const scored = withSaldo
      .map((emp) => ({
        emp,
        score: scoreEmpenho(emp, effectiveQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.emp);

    return scored.slice(0, 10);
  }, [empenhosList, effectiveQuery, currentScope]);

  // High-precision scored Contratos (ranked by relevance)
  const matchingContratos = useMemo(() => {
    if (currentScope !== 'all' && currentScope !== 'contratos') return [];

    const activeFilter = currentScope === 'contratos' ? contractViewFilter : 'all';
    const basePool = combinedContratos.filter((cont) => matchesContractFilter(cont, activeFilter));

    if (!effectiveQuery) {
      if (currentScope === 'contratos') {
        return basePool.slice(0, 15);
      }
      return [];
    }

    const scored = basePool
      .map((cont) => ({
        cont,
        score: scoreContrato(cont, effectiveQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.cont);

    return scored.slice(0, 8);
  }, [combinedContratos, contractViewFilter, effectiveQuery, currentScope]);

  // Build grouped screens
  const availableGroups = useMemo(() => {
    if (currentScope !== 'all' && currentScope !== 'screens') return [];

    const query = effectiveQuery.toLowerCase();

    return appScreenGroups
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((group) => {
        const screens = appScreens
          .filter((screen) => screen.groupId === group.id && canAccessScreen(screen.id))
          .filter((screen) => {
            if (!query) return true;
            return screen.name.toLowerCase().includes(query) || group.name.toLowerCase().includes(query);
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return {
          ...group,
          screens,
        };
      })
      .filter((group) => group.screens.length > 0);
  }, [effectiveQuery, currentScope, canAccessScreen]);

  const showActions = currentScope === 'all' || currentScope === 'actions';

  const totalResults =
    matchingEmpenhos.length +
    matchingContratos.length +
    matchingDocumentos.length +
    suapQueryActions.length +
    availableGroups.reduce((acc, g) => acc + g.screens.length, 0) +
    (showActions ? 3 : 0);

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
        <div className="flex flex-col border-b border-border/70 bg-card">
          <div className="relative flex items-center">
            <CommandInput
              value={searchValue}
              onValueChange={setSearchValue}
              placeholder="Digite um comando, NE, contrato, condh, processo, aluno ou documento..."
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !event.ctrlKey) return;
                const selectedItem = document.querySelector<HTMLElement>('[data-suap-query-url][aria-selected="true"]');
                const url = selectedItem?.dataset.suapQueryUrl;
                if (!url) return;
                event.preventDefault();
                event.stopPropagation();
                handleSelectSuapQuery(url, true);
              }}
            />
            {searchValue ? (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="absolute right-12 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                title="Limpar pesquisa"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <div className="absolute right-3.5 flex items-center gap-1 pointer-events-none">
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold text-muted-foreground bg-muted/80 border border-border/80 rounded shadow-2xs">
                ESC
              </kbd>
            </div>
          </div>

          {/* Scope Selector Chips with count badges */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-muted/20 border-t border-border/40 overflow-x-auto text-[11px] select-none scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveScope('all')}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 border text-xs ${
                activeScope === 'all'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
              }`}
            >
              Todos
              {effectiveQuery && totalResults > 0 ? (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeScope === 'all' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground'}`}>
                  {totalResults}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setActiveScope('empenhos')}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 border text-xs ${
                activeScope === 'empenhos'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              Empenhos
              {matchingEmpenhos.length > 0 ? (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeScope === 'empenhos' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'}`}>
                  {matchingEmpenhos.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setActiveScope('contratos')}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 border text-xs ${
                activeScope === 'contratos'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
              }`}
            >
              <FileStack className="h-3.5 w-3.5" />
              Contratos
              {matchingContratos.length > 0 ? (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeScope === 'contratos' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-blue-500/15 text-blue-700 dark:text-blue-300'}`}>
                  {matchingContratos.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setActiveScope('screens')}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 border text-xs ${
                activeScope === 'screens'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Módulos
            </button>

            <button
              type="button"
              onClick={() => setActiveScope('actions')}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 border text-xs ${
                activeScope === 'actions'
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ações Rápidas
            </button>
          </div>

          {currentScope === 'contratos' && !disableContractSearch ? (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 bg-muted/10 border-t border-border/40 text-[11px]">
              <div className="flex items-center gap-1 overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'Vigentes', count: contractFilterCounts.all },
                    { id: 'expiring90', label: 'A vencer (90d)', count: contractFilterCounts.expiring90 },
                    { id: 'pending', label: 'Faturas pendentes', count: contractFilterCounts.pending },
                    { id: 'expired120', label: 'Vencidos (120d)', count: contractFilterCounts.expired120 },
                  ] as const
                ).map((filterOption) => {
                  const selected = contractViewFilter === filterOption.id;
                  return (
                    <button
                      key={filterOption.id}
                      type="button"
                      onClick={() => setContractViewFilter(filterOption.id)}
                      className={`px-2.5 py-0.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 border text-[11px] ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{filterOption.label}</span>
                      <span className={`text-[10px] px-1 rounded font-bold ${selected ? 'bg-white/20 text-white' : 'bg-muted text-foreground/80'}`}>
                        {filterOption.count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {lastApiSyncRun?.finished_at ? (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  Sincronizado: {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(lastApiSyncRun.finished_at))}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <CommandList className="max-h-[min(540px,78vh)] p-2 scrollbar-thin bg-card text-card-foreground">
          {totalResults === 0 && effectiveQuery && !isCondhScope && (
            <CommandEmpty className="py-12 text-center text-sm text-muted-foreground">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/60 mb-3">
                <Search className="h-6 w-6" />
              </div>
              <p className="font-semibold text-foreground text-base">Nenhum resultado encontrado</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Não encontramos correspondências para "<span className="font-medium text-foreground">{effectiveQuery}</span>". Tente o número da NE (ex: "32"), fornecedor ou módulo.
              </p>
            </CommandEmpty>
          )}

          {/* Empenhos Encontrados */}
          {matchingEmpenhos.length > 0 && (
            <CommandGroup
              heading={
                <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Receipt className="h-3.5 w-3.5" />
                    Empenhos Encontrados
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">{matchingEmpenhos.length} resultado(s)</span>
                </div>
              }
            >
              {matchingEmpenhos.map((empenho) => {
                const saldo = getEmpenhoAvailableBalance(empenho);

                return (
                  <CommandItem
                    key={empenho.id}
                    value={`empenho ${empenho.numero} ${empenho.favorecidoNome || ''} ${empenho.planoInterno || ''} ${empenho.id}`}
                    onSelect={() => handleSelectEmpenho(empenho)}
                    className="group flex items-center justify-between gap-3.5 py-3 px-3.5 mb-1.5 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:border-primary/25 hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shadow-2xs">
                      <Receipt className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-foreground text-sm tracking-tight">
                          {empenho.numero}
                        </span>
                        {empenho.tipo === 'rap' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400/80 bg-amber-100/90 text-amber-900 dark:bg-amber-950 dark:text-amber-200 font-bold">
                            RAP
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground font-medium truncate mt-1">
                        <span className="text-foreground/90 font-semibold">
                          <HighlightMatch text={empenho.favorecidoNome || 'Favorecido não informado'} query={effectiveQuery} />
                        </span>
                        {empenho.planoInterno ? (
                          <span className="ml-1.5 text-muted-foreground">
                            • PI: <span className="font-mono text-foreground/80"><HighlightMatch text={empenho.planoInterno} query={effectiveQuery} /></span>
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Saldo Disponível</span>
                      <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(saldo)}
                      </span>
                    </div>

                    <CommandShortcut className="hidden sm:inline-flex opacity-0 group-data-[selected=true]:opacity-100 transition-opacity text-xs font-semibold text-primary">
                      Abrir ↵
                    </CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* Contratos Encontrados */}
          {matchingContratos.length > 0 && (
            <>
              {matchingEmpenhos.length > 0 ? <CommandSeparator className="my-2" /> : null}
              <CommandGroup
                heading={
                  <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <FileStack className="h-3.5 w-3.5" />
                      {currentScope === 'contratos' && contractViewFilter === 'expired120'
                        ? 'Contratos Vencidos (120d)'
                        : currentScope === 'contratos' && contractViewFilter === 'expiring90'
                          ? 'Contratos a Vencer (90d)'
                          : currentScope === 'contratos' && contractViewFilter === 'pending'
                            ? 'Contratos com Faturas Pendentes'
                            : 'Contratos Ativos'}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">{matchingContratos.length} resultado(s)</span>
                  </div>
                }
              >
                {matchingContratos.map((contrato) => {
                  const isExpired = !contrato.situacaoDerivada || (contrato.daysRemaining !== null && contrato.daysRemaining < 0);
                  const isExpiringSoon = !isExpired && contrato.daysRemaining !== null && contrato.daysRemaining <= 90;
                  const statusBadgeClass = isExpired
                    ? 'border-rose-500/30 bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    : isExpiringSoon
                      ? 'border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                      : 'border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
                  const hasVigencia = Boolean(contrato.vigenciaInicio || contrato.vigenciaFim);
                  const badgeText = contrato.vigenciaFim ? contrato.deadlineLabel : (contrato.status || 'Ativo');

                  return (
                    <CommandItem
                      key={contrato.id}
                      value={`contrato ${contrato.numero} ${contrato.fornecedorNome || ''} ${contrato.fornecedorDocumento || ''} ${contrato.objeto || ''} ${contrato.processo || ''} ${contrato.id}`}
                      onSelect={() => handleSelectContrato(contrato)}
                      className="group flex items-center justify-between gap-3.5 py-3 px-3.5 mb-1.5 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-blue-500/8 data-[selected=true]:border-blue-500/25 hover:bg-muted/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-2xs">
                        <FileStack className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-foreground text-sm">
                            Contrato {contrato.numero}
                          </span>
                          <Badge variant="outline" className={`text-[10px] px-2 py-0 font-bold uppercase tracking-wider rounded-md ${statusBadgeClass}`}>
                            {badgeText}
                          </Badge>
                          {contrato.hasReitoriaOrigin ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-md">
                              Origem Reitoria
                            </Badge>
                          ) : null}
                          {contrato.openFaturasCount > 0 ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold rounded-md">
                              {contrato.openFaturasCount} {contrato.openFaturasCount === 1 ? 'fatura pendente' : 'faturas pendentes'}
                            </Badge>
                          ) : null}
                          {contrato.empenhosCount > 0 ? (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground font-mono rounded-md">
                              {contrato.empenhosCount} {contrato.empenhosCount === 1 ? 'NE' : 'NEs'}
                            </Badge>
                          ) : null}
                        </div>

                        <p className="text-xs text-muted-foreground font-medium truncate mt-1">
                          <span className="text-foreground/90 font-semibold">
                            <HighlightMatch text={contrato.fornecedorNome || 'Fornecedor não informado'} query={effectiveQuery} />
                          </span>
                          {contrato.fornecedorDocumento ? (
                            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                              ({formatarDocumento(contrato.fornecedorDocumento)})
                            </span>
                          ) : null}
                          {contrato.objeto ? (
                            <span className="ml-1.5 text-muted-foreground">
                              • <HighlightMatch text={contrato.objeto} query={effectiveQuery} />
                            </span>
                          ) : null}
                        </p>

                        {hasVigencia || contrato.processo ? (
                          <p className="text-[11px] text-muted-foreground/90 truncate mt-0.5">
                            {hasVigencia ? (
                              <span>
                                Vigência: {formatContractDate(contrato.vigenciaInicio)} a {formatContractDate(contrato.vigenciaFim)}
                              </span>
                            ) : null}
                            {contrato.processo ? (
                              <span className={hasVigencia ? 'ml-2' : ''}>
                                {hasVigencia ? '• ' : ''}Proc. <span className="font-mono">{contrato.processo}</span>
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Valor Global</span>
                        <span className="font-mono font-extrabold text-sm text-foreground tabular-nums block">
                          {formatCurrency(contrato.valor || 0)}
                        </span>
                        {contrato.empenhado > 0 || contrato.aLiquidar > 0 || contrato.empenhosCount > 0 ? (
                          <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5 tabular-nums">
                            A liquidar: {formatCurrency(contrato.aLiquidar)}
                          </span>
                        ) : null}
                      </div>

                      <CommandShortcut className="hidden sm:inline-flex opacity-0 group-data-[selected=true]:opacity-100 transition-opacity text-xs font-semibold text-blue-600">
                        Ver ↵
                      </CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {isCondhScope && (
            <>
              {!canSearchCondh ? (
                <CommandGroup heading="Consulta de RP/NP">
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    Você não tem acesso à tela Liquidações e Pagamentos.
                  </div>
                </CommandGroup>
              ) : (
                <CommandGroup
                  heading={
                    <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Banknote className="h-3.5 w-3.5" />
                        Documentos RP/NP
                      </span>
                      {isValidCondhSearch && !condhDocumentsQuery.isError ? (
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {totalDocumentos} resultado(s)
                        </span>
                      ) : null}
                    </div>
                  }
                >
                  {!effectiveQuery ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      Digite `condh` seguido de um CPF/CNPJ ou número de RP/NP.
                    </div>
                  ) : !isValidCondhSearch ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      Informe um CPF/CNPJ com 11 ou 14 dígitos, o número de uma RP/NP (ex.: 2026NP000085) ou apenas seu sufixo numérico (ex.: 82).
                    </div>
                  ) : condhDocumentsQuery.isLoading ? (
                    <div role="status" className="px-3 py-4 text-sm text-muted-foreground">
                      Consultando documentos...
                    </div>
                  ) : condhDocumentsQuery.isError ? (
                    <div role="alert" className="px-3 py-4 text-sm text-destructive">
                      Não foi possível consultar os documentos. Tente novamente.
                    </div>
                  ) : matchingDocumentos.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted-foreground">
                      Nenhum documento RP ou NP encontrado para {condhSearchLabel}.
                    </div>
                  ) : (
                    <>
                      {matchingDocumentos.map((documento) => {
                        const displayId = formatDocumentoId(documento.id);
                        const tipo = displayId.match(/^\d{4}(NP|RP)/i)?.[1]?.toUpperCase() || 'RP/NP';

                        return (
                          <CommandItem
                            key={documento.id}
                            value={`condh ${condhQuery} ${displayId} ${documento.favorecido_nome}`}
                            onSelect={() => handleSelectDocumento(documento)}
                            className="group flex items-center justify-between gap-3.5 py-3 px-3.5 mb-1.5 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:border-primary/25 hover:bg-muted/50"
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-foreground text-sm tracking-tight">
                                  {displayId}
                                </span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-bold">
                                  {tipo}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {documento.estado}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground font-medium truncate mt-1">
                                {documento.favorecido_nome || 'Favorecido não informado'}
                                {documento.data_emissao ? ` • ${documento.data_emissao.slice(0, 10)}` : ''}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Valor</span>
                              <span className="font-mono font-bold text-sm text-foreground tabular-nums">
                                {formatCurrency(documento.valor_original)}
                              </span>
                            </div>
                            <CommandShortcut className="hidden sm:inline-flex opacity-0 group-data-[selected=true]:opacity-100 transition-opacity text-xs font-semibold text-primary">
                              Detalhes ↵
                            </CommandShortcut>
                          </CommandItem>
                        );
                      })}
                      {totalDocumentos > CONDH_PAGE_SIZE ? (
                        <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                          <button
                            type="button"
                            disabled={documentosPage <= 1}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setDocumentosPage((page) => Math.max(1, page - 1))}
                            className="rounded px-2 py-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Anterior
                          </button>
                          <span>
                            Página {documentosPage} de {Math.ceil(totalDocumentos / CONDH_PAGE_SIZE)}
                          </span>
                          <button
                            type="button"
                            disabled={documentosPage * CONDH_PAGE_SIZE >= totalDocumentos}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setDocumentosPage((page) => page + 1)}
                            className="rounded px-2 py-1 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Próxima
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </CommandGroup>
              )}
            </>
          )}

          {/* Consultas oficiais do SUAP */}
          {suapQueryActions.length > 0 && (
            <>
              {matchingEmpenhos.length > 0 || matchingContratos.length > 0 ? <CommandSeparator className="my-2" /> : null}
              <CommandGroup
                heading={
                  <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Consultas SUAP
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">{suapQueryActions.length} consulta(s)</span>
                  </div>
                }
              >
                {suapQueryActions.map((action) => (
                  <CommandItem
                    key={action.kind}
                    value={`suap ${action.kind} ${effectiveQuery} ${action.title}`}
                    data-suap-query-url={action.url}
                    onSelect={() => handleSelectSuapQuery(action.url)}
                    className="group flex items-center justify-between gap-3.5 py-2.5 px-3.5 mb-1 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-emerald-500/8 data-[selected=true]:border-emerald-500/25 hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      <Search className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{action.title}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold">
                          SUAP Oficial
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium truncate mt-1">Abrir consulta no SUAP</p>
                    </div>
                    <CommandShortcut className="hidden sm:inline-flex opacity-0 group-data-[selected=true]:opacity-100 transition-opacity text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Enter · Ctrl+Enter nova aba
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Módulos do Sistema */}
          {availableGroups.length > 0 && (
            <>
              {matchingEmpenhos.length > 0 || matchingContratos.length > 0 || suapQueryActions.length > 0 ? <CommandSeparator className="my-2" /> : null}
              {availableGroups.map((group) => {
                const GroupIcon = groupIconMap[group.id] || FileText;

                return (
                  <CommandGroup
                    key={group.id}
                    heading={
                      <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                        <GroupIcon className="h-3.5 w-3.5" />
                        {group.name}
                      </div>
                    }
                  >
                    {group.screens.map((screen) => {
                      const ScreenIcon = screen.icon || GroupIcon;

                      return (
                        <CommandItem
                          key={screen.id}
                          value={`tela modulo ${screen.name} ${group.name} ${screen.path}`}
                          onSelect={() => handleSelectScreen(screen.path)}
                          className="group flex items-center justify-between gap-3 py-2.5 px-3.5 mb-1 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:border-primary/20 hover:bg-muted/50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/70">
                            <ScreenIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-foreground">
                              <HighlightMatch text={screen.name} query={effectiveQuery} />
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">({group.name})</span>
                          </div>
                          <CommandShortcut className="hidden sm:inline-flex opacity-0 group-data-[selected=true]:opacity-100 transition-opacity text-xs font-semibold text-primary">
                            Navegar ↵
                          </CommandShortcut>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </>
          )}

          {/* Ações Rápidas */}
          {showActions && (
            <>
              <CommandSeparator className="my-2" />
              <CommandGroup
                heading={
                  <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    Ações Rápidas
                  </div>
                }
              >
                {canAccessScreen('requisicao-compra') && (
                  <CommandItem
                    value="nova requisicao compra compras pedido despesa"
                    onSelect={() => handleSelectScreen('/requisicao-compra')}
                    className="group flex items-center justify-between gap-3 py-2.5 px-3.5 mb-1 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:border-primary/20 hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">Nova Requisição de Compra</span>
                      <span className="ml-2 text-xs text-muted-foreground">Criar solicitação de despesa por NE</span>
                    </div>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                )}

                {canAccessScreen('pesquisa-precos') && (
                  <CommandItem
                    value="nova pesquisa precos cotacao fornecedores orcamento"
                    onSelect={() => handleSelectScreen('/pesquisa-precos')}
                    className="group flex items-center justify-between gap-3 py-2.5 px-3.5 mb-1 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:border-primary/20 hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">Pesquisa de Preços</span>
                      <span className="ml-2 text-xs text-muted-foreground">Cotação oficial e cálculo estimativo</span>
                    </div>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                )}

                {onOpenSuapSync && (
                  <CommandItem
                    value="sincronizar suap integracao processos importar"
                    onSelect={() => handleAction(onOpenSuapSync)}
                    className="group flex items-center justify-between gap-3 py-2.5 px-3.5 mb-1 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:border-primary/20 hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                      <FolderSync className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">Sincronizar com o SUAP</span>
                      <span className="ml-2 text-xs text-muted-foreground">Configurar caixas e importar processos</span>
                    </div>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                )}

                {onOpenPasswordChange && (
                  <CommandItem
                    value="alterar senha trocar perfil seguranca"
                    onSelect={() => handleAction(onOpenPasswordChange)}
                    className="group flex items-center justify-between gap-3 py-2.5 px-3.5 mb-1 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-primary/8 data-[selected=true]:border-primary/20 hover:bg-muted/50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">Alterar Senha</span>
                      <span className="ml-2 text-xs text-muted-foreground">Configurar nova senha de acesso</span>
                    </div>
                    <CommandShortcut>↵</CommandShortcut>
                  </CommandItem>
                )}
              </CommandGroup>
            </>
          )}

          {onSignOut && session && (
            <>
              <CommandSeparator className="my-2" />
              <CommandGroup heading="Sessão">
                <CommandItem
                  value="sair logout encerrar sessao"
                  onSelect={() => handleAction(onSignOut)}
                  className="group flex items-center justify-between gap-3 py-2.5 px-3.5 rounded-xl border border-transparent text-rose-600 hover:bg-rose-500/10 transition-all cursor-pointer"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                    <LogOut className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 font-semibold text-sm">Encerrar Sessão</div>
                  <CommandShortcut className="text-rose-600">↵</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* Sleek bottom navigation bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-t border-border/60 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-card border border-border/80 rounded shadow-2xs font-semibold text-foreground">↑</kbd>
              <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-card border border-border/80 rounded shadow-2xs font-semibold text-foreground">↓</kbd>
              <span className="ml-0.5">Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-card border border-border/80 rounded shadow-2xs font-semibold text-foreground">↵</kbd>
              <span className="ml-0.5">Selecionar</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Sistema Gerencial</span>
            <span>•</span>
            <kbd className="px-1.5 py-0.5 font-mono text-[10px] bg-card border border-border/80 rounded shadow-2xs font-semibold text-primary">Ctrl + K</kbd>
          </div>
        </div>
      </CommandDialog>

      {/* Direct Empenho Inspection Dialog */}
      {selectedEmpenhoForDialog && (
        <EmpenhoDialog
          open={isEmpenhoDialogOpen}
          onOpenChange={setIsEmpenhoDialogOpen}
          empenho={selectedEmpenhoForDialog}
          atividades={atividadesList}
          onSave={onSaveEmpenho ? (id, data) => onSaveEmpenho(id, data) : () => {}}
        />
      )}

      {/* Direct Contrato Inspection Modal */}
      {selectedContratoForDialog && (
        <ContratoApiDetailsSheet
          open={isContratoDetailsOpen}
          onOpenChange={setIsContratoDetailsOpen}
          contrato={selectedContratoForDialog}
          details={selectedContratoDetails}
          lastSyncRun={lastApiSyncRun}
          loading={isContratoDetailsLoading}
          error={contratoDetailsError}
          execution={selectedContratoExecution}
          onOpenEmpenho={(empenho) => {
            setSelectedEmpenhoForDialog(empenho);
            setIsEmpenhoDialogOpen(true);
          }}
          campusUasg={campusUasg}
        />
      )}

      {selectedDocumentoForDialog && (
        <DocumentoDetalhesDialog
          documento={selectedDocumentoForDialog}
          open={isDocumentoDetailsOpen}
          onOpenChange={setIsDocumentoDetailsOpen}
        />
      )}
    </>
  );
}
