import { Fragment, useEffect, useMemo, useState } from 'react';
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
import { formatCurrency, formatarDocumento } from '@/lib/utils';
import { getEmpenhoAvailableBalance } from '@/utils/empenhoBalance';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { ContratoApiDetailsSheet } from '@/components/contratos/ContratoApiDetailsSheet';
import { contratosApiService, type ContratoApiDetails, type ContratoApiRow } from '@/services/contratosApi';
import { isContratoApiCampusEmpenho } from '@/utils/contratosApiStatus';
import { normalizeContratoNumero, shouldIgnoreContratoNumero } from '@/utils/contratosSync';
import type { Empenho, Contrato, Atividade } from '@/types';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenSuapSync?: () => void;
  onOpenPasswordChange?: () => void;
  onSignOut?: () => void;
  empenhosList?: Empenho[];
  contratosList?: Contrato[];
  disableContractSearch?: boolean;
  atividadesList?: Atividade[];
  onSaveEmpenho?: (id: string, data: Partial<Empenho>) => void;
}

type SearchScope = 'all' | 'empenhos' | 'contratos' | 'screens' | 'actions';

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

  // 4. Objeto
  if (obj) {
    if (obj.includes(q)) score += 2000;
    else if (words.length > 1 && words.every((w) => obj.includes(w))) score += 2500;
  }

  // 5. Processo
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
  disableContractSearch = false,
  atividadesList = [],
  onSaveEmpenho,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { canAccessScreen, session } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  const [activeScope, setActiveScope] = useState<SearchScope>('all');
  const [selectedEmpenhoForDialog, setSelectedEmpenhoForDialog] = useState<Empenho | null>(null);
  const [isEmpenhoDialogOpen, setIsEmpenhoDialogOpen] = useState(false);
  const [apiContratos, setApiContratos] = useState<ContratoApiRow[]>([]);
  const [selectedContratoForDialog, setSelectedContratoForDialog] = useState<ContratoApiRow | null>(null);
  const [selectedContratoDetails, setSelectedContratoDetails] = useState<ContratoApiDetails | null>(null);
  const [isContratoDetailsOpen, setIsContratoDetailsOpen] = useState(false);
  const [isContratoDetailsLoading, setIsContratoDetailsLoading] = useState(false);

  // Carrega apenas contratos ativos da API para enriquecer busca e detalhes com precisão
  useEffect(() => {
    if (disableContractSearch) {
      setApiContratos([]);
      return;
    }

    let isMounted = true;
    contratosApiService
      .getContratosApi(true)
      .then((res) => {
        if (isMounted && Array.isArray(res)) setApiContratos(res);
      })
      .catch((err) => {
        console.warn('CommandPalette: aviso ao carregar contratos da API', err);
      });
    return () => {
      isMounted = false;
    };
  }, [disableContractSearch]);

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
    }
  }, [open]);

  // Detect scoped prefixes like "ne:", "empenho:", "contrato:", "tela:", "modulo:"
  const { effectiveQuery, detectedScope } = useMemo(() => {
    const trimmed = searchValue.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('ne ') || lower.startsWith('empenho ') || lower.startsWith('ne:') || lower.startsWith('empenho:')) {
      const query = trimmed.replace(/^(ne|empenho)[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'empenhos' as SearchScope };
    }
    if (lower.startsWith('contrato ') || lower.startsWith('contrato:')) {
      const query = trimmed.replace(/^contrato[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'contratos' as SearchScope };
    }
    if (lower.startsWith('tela ') || lower.startsWith('modulo ') || lower.startsWith('tela:') || lower.startsWith('modulo:')) {
      const query = trimmed.replace(/^(tela|modulo)[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'screens' as SearchScope };
    }
    if (lower.startsWith('acao ') || lower.startsWith('atalho ') || lower.startsWith('acao:') || lower.startsWith('atalho:')) {
      const query = trimmed.replace(/^(acao|atalho)[:\s]+/i, '').trim();
      return { effectiveQuery: query, detectedScope: 'actions' as SearchScope };
    }

    return { effectiveQuery: trimmed, detectedScope: activeScope };
  }, [searchValue, activeScope]);

  const currentScope = detectedScope !== 'all' ? detectedScope : activeScope;

  const handleSelectScreen = (path: string) => {
    onOpenChange(false);
    navigate(path);
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

  // Lista unificada de contratos EXCLUSIVAMENTE ATIVOS (mesclando API e dados locais)
  const combinedContratos = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        numero: string;
        fornecedorNome: string;
        objeto: string;
        processo: string;
        valor: number;
        status?: string;
        apiContrato?: ContratoApiRow;
        localContrato?: Contrato;
      }
    >();

    // 1. Contratos da API ativos
    for (const api of apiContratos) {
      const isAtivo = api.situacao_derivada === true;
      if (!isAtivo) continue;

      const norm = normalizeContratoNumero(api.numero) || api.numero;
      map.set(norm, {
        id: api.id,
        numero: api.numero,
        fornecedorNome: api.fornecedor_nome || '',
        objeto: api.objeto || '',
        processo: api.processo || '',
        valor: api.valor_acumulado || api.valor_global || 0,
        status: 'Ativo',
        apiContrato: api,
      });
    }

    // 2. Mescla contratos locais que estejam ativos
    for (const loc of contratosList) {
      if (shouldIgnoreContratoNumero(loc.numero)) continue;
      const statusNorm = (loc.status || '').trim().toLowerCase();
      const isLocalInativo = ['inativo', 'encerrado', 'concluido', 'concluído', 'rescindido', 'cancelado'].includes(statusNorm);
      if (isLocalInativo) continue;

      const norm = normalizeContratoNumero(loc.numero) || loc.numero;
      if (map.has(norm)) {
        const existing = map.get(norm)!;
        existing.localContrato = loc;
        if (!existing.fornecedorNome && (loc.fornecedorNome || loc.contratada)) {
          existing.fornecedorNome = loc.fornecedorNome || loc.contratada || '';
        }
        if (!existing.objeto && loc.objeto) existing.objeto = loc.objeto;
      } else {
        map.set(norm, {
          id: loc.id,
          numero: loc.numero,
          fornecedorNome: loc.fornecedorNome || loc.contratada || '',
          objeto: loc.objeto || '',
          processo: loc.processo || '',
          valor: loc.valorTotal || loc.valor || 0,
          status: loc.status || 'Ativo',
          localContrato: loc,
        });
      }
    }

    return Array.from(map.values());
  }, [apiContratos, contratosList]);

  const handleSelectContrato = async (cont: (typeof combinedContratos)[number]) => {
    setIsContratoDetailsOpen(true);
    setIsContratoDetailsLoading(true);
    onOpenChange(false);

    try {
      let apiContrato = cont.apiContrato;

      if (!apiContrato) {
        apiContrato = (await contratosApiService.getContratoApiByNumeroOrId(cont.numero || cont.id)) ?? undefined;
      }

      if (apiContrato) {
        setSelectedContratoForDialog(apiContrato);
        const details = await contratosApiService.getContratoApiDetails(apiContrato.id);
        const campusEmpenhos = details.empenhos.filter((empenho) => isContratoApiCampusEmpenho(empenho));
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
          unidade_codigo: '158366',
          unidade_nome: 'INST.FED. DO RN/CAMPUS CURRAIS NOVOS',
          unidade_origem_codigo: null,
          unidade_origem_nome: null,
          objeto: cont.objeto || 'Contrato cadastrado localmente',
          processo: cont.processo || null,
          vigencia_inicio: loc?.dataInicio ? String(loc.dataInicio).slice(0, 10) : loc?.data_inicio ? String(loc.data_inicio).slice(0, 10) : null,
          vigencia_fim: loc?.dataFim ? String(loc.dataFim).slice(0, 10) : loc?.data_termino ? String(loc.data_termino).slice(0, 10) : null,
          valor_global: cont.valor || null,
          valor_acumulado: cont.valor || null,
          situacao: cont.status === 'Ativo',
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

    if (!effectiveQuery) {
      if (currentScope === 'contratos') {
        return combinedContratos.slice(0, 15);
      }
      return [];
    }

    const scored = combinedContratos
      .map((cont) => ({
        cont,
        score: scoreContrato(cont, effectiveQuery),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.cont);

    return scored.slice(0, 8);
  }, [combinedContratos, effectiveQuery, currentScope]);

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
              placeholder="Digite um comando, NE, contrato, fornecedor ou módulo..."
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
        </div>

        <CommandList className="max-h-[min(540px,78vh)] p-2 scrollbar-thin bg-card text-card-foreground">
          {totalResults === 0 && effectiveQuery && (
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
                      Contratos Ativos
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">{matchingContratos.length} resultado(s)</span>
                  </div>
                }
              >
                {matchingContratos.map((contrato) => (
                  <CommandItem
                    key={contrato.id}
                    value={`contrato ${contrato.numero} ${contrato.fornecedorNome || ''} ${contrato.objeto || ''} ${contrato.id}`}
                    onSelect={() => handleSelectContrato(contrato)}
                    className="group flex items-center justify-between gap-3.5 py-3 px-3.5 mb-1.5 rounded-xl border border-transparent transition-all cursor-pointer data-[selected=true]:bg-blue-500/8 data-[selected=true]:border-blue-500/25 hover:bg-muted/50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold shadow-2xs">
                      <FileStack className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          Contrato {contrato.numero}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-2 py-0 border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-bold uppercase tracking-wider rounded-md">
                          {contrato.status || 'Ativo'}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground font-medium truncate mt-1">
                        <span className="text-foreground/90 font-semibold">
                          <HighlightMatch text={contrato.fornecedorNome || 'Fornecedor não informado'} query={effectiveQuery} />
                        </span>
                        {contrato.objeto ? (
                          <span className="ml-1.5 text-muted-foreground">
                            • <HighlightMatch text={contrato.objeto} query={effectiveQuery} />
                          </span>
                        ) : null}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Valor Global</span>
                      <span className="font-mono font-extrabold text-sm text-foreground tabular-nums">
                        {formatCurrency(contrato.valor || 0)}
                      </span>
                    </div>

                    <CommandShortcut className="hidden sm:inline-flex opacity-0 group-data-[selected=true]:opacity-100 transition-opacity text-xs font-semibold text-blue-600">
                      Ver ↵
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {/* Módulos do Sistema */}
          {availableGroups.length > 0 && (
            <>
              {matchingEmpenhos.length > 0 || matchingContratos.length > 0 ? <CommandSeparator className="my-2" /> : null}
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
          lastSyncRun={null}
          loading={isContratoDetailsLoading}
        />
      )}
    </>
  );
}
