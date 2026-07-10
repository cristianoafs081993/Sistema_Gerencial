import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  FolderOpen,
  Globe,
  Image,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions, HeaderSubtitle } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  buildPriceResearchReportHtml,
  createPriceResearchTemplate,
  exportPriceResearchWorkbook,
  getEstimatedUnitPrice,
  getSelectedStatistics,
  analyzePriceResearchCompliance,
  METHOD_LABELS,
  parsePriceResearchFile,
  validatePriceResearchReport,
  type PriceResearchCandidate,
  type PriceResearchComplianceFinding,
  type PriceResearchItem,
  type PriceResearchMethod,
  type PriceResearchReportData,
} from '@/lib/priceResearch';
import { findCatalogSuggestions } from '@/lib/priceCatalogClient';
import { priceResearchService } from '@/services/priceResearch';
import { marketSearchService, type MarketSearchResult } from '@/services/marketSearch';
import { supabase } from '@/lib/supabase';
import { calculateIndexFactor, type InflationIndexType } from '@/lib/monetaryAdjustment';
import { SupplierEmailDialog } from '@/components/price-research/SupplierEmailDialog';
import { SupplierEmailHistory } from '@/components/price-research/SupplierEmailHistory';

const METHOD_OPTIONS: Array<{ value: PriceResearchMethod; label: string }> = [
  { value: 'minimum', label: 'Menor preço' },
  { value: 'mean', label: 'Média' },
  { value: 'median', label: 'Mediana' },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

function candidateStatus(candidate: PriceResearchCandidate) {
  if (!candidate.unitCompatible) return { label: 'Revisar unidade', className: 'border-amber-300 bg-amber-50 text-amber-800' };
  if (candidate.aiScore >= 80) return { label: 'Alta aderência', className: 'border-primary/20 bg-primary/[0.08] text-primary' };
  if (candidate.aiScore >= 60) return { label: 'Aderente', className: 'border-sebrae-blue/25 bg-sebrae-blue/[0.08] text-sebrae-blue' };
  return { label: 'Revisar descrição', className: 'border-slate-300 bg-slate-50 text-slate-700' };
}

function isOfficialCandidate(candidate: PriceResearchCandidate) {
  return candidate.sourceType === 'compras_gov_precos';
}

function isLocalCandidate(candidate: PriceResearchCandidate) {
  return candidate.sourceType === 'custom';
}

function isMarketCandidate(candidate: PriceResearchCandidate) {
  return !isOfficialCandidate(candidate) && !isLocalCandidate(candidate);
}

const COMPLIANCE_SEVERITY_LABELS: Record<PriceResearchComplianceFinding['severity'], string> = {
  error: 'Bloqueantes',
  warning: 'Alertas',
  info: 'Informativos',
};

const COMPLIANCE_SEVERITY_STYLES: Record<PriceResearchComplianceFinding['severity'], string> = {
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  info: 'border-slate-200 bg-slate-50 text-slate-800',
};

export default function PesquisaPrecos() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [researchId, setResearchId] = useState<string>();
  const [activeStep, setActiveStep] = useState(1);
  const [processNumber, setProcessNumber] = useState('');
  const [objectDescription, setObjectDescription] = useState('');
  const [responsibleName, setResponsibleName] = useState('');
  const [researchDate, setResearchDate] = useState(today);
  const [method, setMethod] = useState<PriceResearchMethod>('median');
  const [methodologyJustification, setMethodologyJustification] = useState(
    'A mediana foi adotada por reduzir o efeito de valores extremos, após análise crítica da comparabilidade das especificações, unidades e quantidades.',
  );
  const [notes, setNotes] = useState('');
  const [sourceFile, setSourceFile] = useState('');
  const [items, setItems] = useState<PriceResearchItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const currentIndex = items.findIndex((item) => item.localId === selectedItemId);

  const handlePrevItem = () => {
    if (currentIndex > 0) {
      setSelectedItemId(items[currentIndex - 1].localId);
    }
  };

  const handleNextItem = () => {
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
      setSelectedItemId(items[currentIndex + 1].localId);
    }
  };
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingResearchId, setLoadingResearchId] = useState<string>();

  const [viewMode, setViewMode] = useState<'list' | 'wizard'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Email dialog
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);

  const [curadoriaTab, setCuradoriaTab] = useState<'basket' | 'market' | 'local'>('basket');
  const [marketSearchTerm, setMarketSearchTerm] = useState('');
  const [selectedMarketProviders, setSelectedMarketProviders] = useState<string[]>(['amazon', 'magalu', 'americanas']);
  const [marketResults, setMarketResults] = useState<MarketSearchResult[]>([]);
  const [isSearchingMarket, setIsSearchingMarket] = useState(false);
  const [capturingUrls, setCapturingUrls] = useState<Set<string>>(new Set());
  const [freightCep, setFreightCep] = useState<string>(() => localStorage.getItem('pp_freight_cep') || '');

  // Fornecedores Locais State
  const [localSupplierName, setLocalSupplierName] = useState('');
  const [localSupplierDoc, setLocalSupplierDoc] = useState('');
  const [localPrice, setLocalPrice] = useState('');
  const [localFreight, setLocalFreight] = useState('');
  const [localUnit, setLocalUnit] = useState('');
  const [localQuoteDate, setLocalQuoteDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [capturingCandidateId, setCapturingCandidateId] = useState<string | null>(null);
  const [previewCandidate, setPreviewCandidate] = useState<PriceResearchCandidate | null>(null);
  const [candidateExclusionDraft, setCandidateExclusionDraft] = useState<{
    itemId: string;
    candidate: PriceResearchCandidate;
    reason: string;
  } | null>(null);

  const [monetaryAdjustmentDraft, setMonetaryAdjustmentDraft] = useState<{
    itemId: string;
    candidate: PriceResearchCandidate;
    enabled: boolean;
    index: InflationIndexType | 'manual';
    manualRate: string;
    fromDate: string;
    toDate: string;
  } | null>(null);

  const confirmMonetaryAdjustment = () => {
    if (!monetaryAdjustmentDraft) return;
    const { itemId, candidate, enabled, index, manualRate, fromDate, toDate } = monetaryAdjustmentDraft;
    
    let factor = 1;
    let adjustedPrice = candidate.comparableUnitPrice;

    if (enabled) {
      if (index === 'manual') {
        const rate = parseFloat(manualRate) || 0;
        factor = 1 + (rate / 100);
      } else {
        const calculated = calculateIndexFactor(index, fromDate, toDate);
        if (calculated === null) {
          toast.error('Período de correção fora do intervalo suportado (01/2024 a 07/2026).');
          return;
        }
        factor = calculated;
      }
      adjustedPrice = candidate.comparableUnitPrice * factor;
    }

    updateCandidate(itemId, candidate.id, {
      monetaryAdjustmentEnabled: enabled,
      monetaryAdjustmentIndex: index,
      monetaryAdjustmentFactor: factor,
      monetaryAdjustmentManualRate: index === 'manual' ? (parseFloat(manualRate) || 0) : undefined,
      monetaryAdjustedPrice: adjustedPrice,
    });

    setMonetaryAdjustmentDraft(null);
    toast.success('Atualização monetária configurada com sucesso!');
  };

  const deleteResearch = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja excluir esta pesquisa de preços? Isso removerá permanentemente o relatório e todos os itens orçados.')) return;
    setIsDeletingId(id);
    try {
      await priceResearchService.delete(id);
      await queryClient.invalidateQueries({ queryKey: ['price-researches'] });
      toast.success('Pesquisa de preços excluída com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível excluir a pesquisa.');
    } finally {
      setIsDeletingId(null);
    }
  };

  const startNewResearch = () => {
    setResearchId(undefined);
    setActiveStep(1);
    setProcessNumber('');
    setObjectDescription('');
    setResponsibleName('');
    setResearchDate(today());
    setMethod('median');
    setMethodologyJustification(
      'A mediana foi adotada por reduzir o efeito de valores extremos, após análise crítica da comparabilidade das especificações, unidades e quantidades.',
    );
    setNotes('');
    setSourceFile('');
    setItems([]);
    setSelectedItemId(undefined);
    setCandidateExclusionDraft(null);
    setViewMode('wizard');
  };

  const resolveDirectPncpLinks = async (targetItems: PriceResearchItem[]): Promise<PriceResearchItem[]> => {
    const keysToLookup: Array<{ uasg: string; numFull: string; numShort: string; candidateId: string; localItemId: string; modalidadeId: number }> = [];
    
    const getYearFromCandidate = (c: any, digits: string) => {
      const dateVal = c.resultDate || c.purchaseDate;
      if (dateVal && dateVal.length >= 4) {
        const parsedYear = dateVal.slice(0, 4);
        if (/^\d{4}$/.test(parsedYear)) {
          return parsedYear;
        }
      }
      if (digits.length === 15) {
        return digits.slice(11, 15);
      } else if (digits.length >= 17) {
        return digits.slice(13, 17);
      }
      return '';
    };

    targetItems.forEach((item) => {
      item.candidates.forEach((c) => {
        if (c.sourceType === 'compras_gov_precos' && c.purchaseId) {
          const digits = c.purchaseId.replace(/\D/g, '');
          let uasg = '';
          let number = '';
          if (digits.length === 15) {
            uasg = digits.slice(0, 6);
            number = digits.slice(6, 11);
          } else if (digits.length >= 17) {
            uasg = digits.slice(0, 6);
            number = digits.slice(8, 13);
          }
          const year = getYearFromCandidate(c, digits);

          if (uasg && number && year) {
            // Mapeia modalidade do SIASG para modalidade do PNCP
            let modalidadeId = 5; // default: Pregão (5)
            if (digits.length === 15) {
              modalidadeId = 1; // Dispensa
            } else if (digits.length >= 17) {
              const siasgMod = digits.slice(6, 8);
              if (siasgMod === '06') {
                modalidadeId = 1; // Dispensa
              } else if (siasgMod === '07') {
                modalidadeId = 2; // Inexigibilidade
              }
            }

            keysToLookup.push({
              localItemId: item.localId,
              candidateId: c.id,
              uasg,
              numFull: `${number}/${year}`,
              numShort: `${parseInt(number, 10)}/${year}`,
              modalidadeId
            });
          }
        }
      });
    });

    if (keysToLookup.length === 0) return targetItems;

    const getRelativeDateStr = (dateStr: string, offsetDays: number) => {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return null;
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };

    try {
      const uasgs = Array.from(new Set(keysToLookup.map(k => k.uasg)));

      const { data: pncpRecords, error } = await supabase
        .from('licitacoes_pncp')
        .select('numero_controle_pncp, uasg_codigo, numero_compra, ano_compra')
        .in('uasg_codigo', uasgs);

      if (error) {
        console.error('Erro ao buscar chaves PNCP no banco local:', error);
        return targetItems;
      }

      const pncpMap = new Map<string, string>();
      if (pncpRecords && pncpRecords.length > 0) {
        pncpRecords.forEach(r => {
          if (r.numero_compra) {
            const cleanNum = r.numero_compra.includes('/') ? r.numero_compra.split('/')[0] : r.numero_compra;
            const keyFull = `${r.uasg_codigo}_${cleanNum}/${r.ano_compra}`;
            const keyShort = `${r.uasg_codigo}_${parseInt(cleanNum, 10)}/${r.ano_compra}`;
            pncpMap.set(keyFull, r.numero_controle_pncp);
            pncpMap.set(keyShort, r.numero_controle_pncp);
          }
        });
      }

      // Identifica candidatos não mapeados e dispara sincronizações rápidas em background (não bloqueante)
      const syncRequests: Array<{ uasg: string; number: string; year: string }> = [];
      const seenSyncKeys = new Set<string>();

      keysToLookup.forEach((k) => {
        const candidate = targetItems
          .find(item => item.localId === k.localItemId)
          ?.candidates.find(c => c.id === k.candidateId);
        
        if (candidate) {
          const keyFull = `${k.uasg}_${k.numFull}`;
          const keyShort = `${k.uasg}_${k.numShort}`;
          const isResolved = pncpMap.has(keyFull) || pncpMap.has(keyShort);

          if (!isResolved) {
            const digits = candidate.purchaseId ? candidate.purchaseId.replace(/\D/g, '') : '';
            let rawNum = '';
            if (digits.length === 15) {
              rawNum = digits.slice(6, 11);
            } else if (digits.length >= 17) {
              rawNum = digits.slice(8, 13);
            }
            const rawYear = getYearFromCandidate(candidate, digits);

            if (rawNum && rawYear) {
              const numberShort = parseInt(rawNum, 10).toString();
              const syncKey = `${k.uasg}_${numberShort}_${rawYear}`;
              if (!seenSyncKeys.has(syncKey)) {
                seenSyncKeys.add(syncKey);
                syncRequests.push({ uasg: k.uasg, number: numberShort, year: rawYear });
              }
            }
          }
        }
      });

      if (syncRequests.length > 0) {
        console.log(`[resolveDirectPncpLinks] Disparando ${syncRequests.length} resoluções rápidas em background (não bloqueante)...`);
        
        const runBackgroundSync = async () => {
          const syncPromises = syncRequests.map(async (req) => {
            try {
              await supabase.functions.invoke('sync-licitacoes-pncp', {
                body: {
                  resolveIndividual: true,
                  query: `${req.uasg} ${req.number}/${req.year}`
                }
              });
            } catch (err) {
              console.warn(`[resolveDirectPncpLinks] Falha na resolução rápida para UASG ${req.uasg}:`, err);
            }
          });

          await Promise.all(syncPromises);

          const { data: newPncpRecords, error: newPncpError } = await supabase
            .from('licitacoes_pncp')
            .select('numero_controle_pncp, uasg_codigo, numero_compra, ano_compra')
            .in('uasg_codigo', uasgs);

          if (!newPncpError && newPncpRecords) {
            const updatedPncpMap = new Map<string, string>();
            newPncpRecords.forEach(r => {
              if (r.numero_compra) {
                const cleanNum = r.numero_compra.includes('/') ? r.numero_compra.split('/')[0] : r.numero_compra;
                const keyFull = `${r.uasg_codigo}_${cleanNum}/${r.ano_compra}`;
                const keyShort = `${r.uasg_codigo}_${parseInt(cleanNum, 10)}/${r.ano_compra}`;
                updatedPncpMap.set(keyFull, r.numero_controle_pncp);
                updatedPncpMap.set(keyShort, r.numero_controle_pncp);
              }
            });

            // Atualiza o estado de itens de forma reativa
            setItems((currentItems) => currentItems.map((item) => {
              const updatedCandidates = item.candidates.map((c) => {
                if (c.sourceType === 'compras_gov_precos' && c.purchaseId) {
                  const digits = c.purchaseId.replace(/\D/g, '');
                  let uasg = '';
                  let number = '';
                  if (digits.length === 15) {
                    uasg = digits.slice(0, 6);
                    number = digits.slice(6, 11);
                  } else if (digits.length >= 17) {
                    uasg = digits.slice(0, 6);
                    number = digits.slice(8, 13);
                  }
                  const year = getYearFromCandidate(c, digits);

                  if (uasg && number && year) {
                    const keyFull = `${uasg}_${number}/${year}`;
                    const keyShort = `${uasg}_${parseInt(number, 10)}/${year}`;
                    const ctrlNum = updatedPncpMap.get(keyFull) || updatedPncpMap.get(keyShort);
                    if (ctrlNum) {
                      const match = ctrlNum.match(/^(\d{14})-\d+-(\d+)\/(\d{4})/);
                      if (match) {
                        return {
                          ...c,
                          pncpSearchUrl: `https://pncp.gov.br/app/editais/${match[1]}/${match[3]}/${parseInt(match[2], 10)}`
                        };
                      }
                    }
                  }
                }
                return c;
              });
              return { ...item, candidates: updatedCandidates };
            }));
            console.log('[resolveDirectPncpLinks] Links do PNCP atualizados reativamente via background sync!');
          }
        };

        // Executa sem dar await para não travar a UI
        void runBackgroundSync();
      }

      return targetItems.map((item) => {
        const updatedCandidates = item.candidates.map((c) => {
          if (c.sourceType === 'compras_gov_precos' && c.purchaseId) {
            const digits = c.purchaseId.replace(/\D/g, '');
            let uasg = '';
            let number = '';
            if (digits.length === 15) {
              uasg = digits.slice(0, 6);
              number = digits.slice(6, 11);
            } else if (digits.length >= 17) {
              uasg = digits.slice(0, 6);
              number = digits.slice(8, 13);
            }
            const year = getYearFromCandidate(c, digits);

            if (uasg && number && year) {
              const keyFull = `${uasg}_${number}/${year}`;
              const keyShort = `${uasg}_${parseInt(number, 10)}/${year}`;
              const ctrlNum = pncpMap.get(keyFull) || pncpMap.get(keyShort);
              if (ctrlNum) {
                const match = ctrlNum.match(/^(\d{14})-\d+-(\d+)\/(\d{4})/);
                if (match) {
                  return {
                    ...c,
                    pncpSearchUrl: `https://pncp.gov.br/app/editais/${match[1]}/${match[3]}/${parseInt(match[2], 10)}`
                  };
                }
              }
            }
          }
          return c;
        });
        return { ...item, candidates: updatedCandidates };
      });
    } catch (err) {
      console.error('Erro ao resolver links diretos do PNCP:', err);
    }

    return targetItems;
  };

  const { data: recentResearches = [], isFetching: isFetchingRecent } = useQuery({
    queryKey: ['price-researches'],
    queryFn: () => priceResearchService.listRecent(),
    staleTime: 15000,
  });

  const selectedItem = items.find((item) => item.localId === selectedItemId) ?? items[0];
  const selectedStatistics = selectedItem ? getSelectedStatistics(selectedItem) : null;
  const selectedCoefficientOfVariation = selectedStatistics?.coefficientOfVariation ?? 0;
  const selectedHasHighDispersion = selectedCoefficientOfVariation > 25;
  const completedItems = items.filter((item) => item.candidates.length > 0).length;
  const selectedQuotesCount = items.reduce(
    (total, item) => total + item.candidates.filter((candidate) => candidate.selected).length,
    0,
  );
  const estimatedTotal = items.reduce(
    (total, item) => total + (getEstimatedUnitPrice(item, method) * item.quantity),
    0,
  );

  const reportData = useMemo<PriceResearchReportData>(() => ({
    title: objectDescription || 'Pesquisa de Preços',
    processNumber,
    objectDescription,
    responsibleName,
    researchDate,
    method,
    methodologyJustification,
    notes,
    sourceFile,
    items,
  }), [
    items,
    method,
    methodologyJustification,
    notes,
    objectDescription,
    processNumber,
    researchDate,
    responsibleName,
    sourceFile,
  ]);

  const updateItem = (localId: string, patch: Partial<PriceResearchItem>) => {
    setItems((current) => current.map((item) => item.localId === localId ? { ...item, ...patch } : item));
  };

  const deleteItem = (localId: string) => {
    setItems((current) => current.filter((item) => item.localId !== localId));
    toast.success("Item removido da pesquisa.");
  };

  const handleAddLocalCandidate = () => {
    if (!selectedItem) return;
    if (!localSupplierName.trim()) {
      toast.error('Informe o nome do fornecedor.');
      return;
    }
    const priceNum = parseFloat(localPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error('Informe um preço unitário válido maior que zero.');
      return;
    }

    const freightNum = localFreight ? parseFloat(localFreight) : 0;
    const newCandidate: PriceResearchCandidate = {
      id: `local-${Date.now()}`,
      purchaseItemId: `local-${Date.now()}`,
      description: selectedItem.description,
      originalUnitPrice: priceNum,
      comparableUnitPrice: priceNum + (isNaN(freightNum) ? 0 : freightNum),
      originalUnitLabel: localUnit.trim() || selectedItem.unit || 'UN',
      quantity: selectedItem.quantity,
      supplierName: localSupplierName.trim(),
      supplierDocument: localSupplierDoc.trim(),
      agencyName: 'Fornecedor Local',
      purchaseDate: localQuoteDate || new Date().toISOString().split('T')[0],
      sourceType: 'custom',
      sourceLabel: 'Fornecedor Local',
      selected: true,
      exclusionReason: '',
      freightCost: localFreight ? freightNum : undefined,
    };

    updateItem(selectedItem.localId, {
      candidates: [...selectedItem.candidates, newCandidate],
    });

    toast.success('Cotação de fornecedor local adicionada com sucesso!');

    setLocalSupplierName('');
    setLocalSupplierDoc('');
    setLocalPrice('');
    setLocalFreight('');
  };

  const updateCandidate = (localId: string, candidateId: string, patch: Partial<PriceResearchCandidate>) => {
    setItems((current) => current.map((item) => {
      if (item.localId !== localId) return item;
      return {
        ...item,
        candidates: item.candidates.map((candidate) => (
          candidate.id === candidateId ? { ...candidate, ...patch } : candidate
        )),
      };
    }));
  };

  const requestCandidateExclusion = (itemId: string, candidate: PriceResearchCandidate) => {
    setCandidateExclusionDraft({
      itemId,
      candidate,
      reason: candidate.exclusionReason,
    });
  };

  const confirmCandidateExclusion = () => {
    if (!candidateExclusionDraft) return;
    const reason = candidateExclusionDraft.reason.trim();
    if (reason.length < 10) {
      toast.error('Informe uma justificativa objetiva para desconsiderar a cotação.');
      return;
    }
    updateCandidate(candidateExclusionDraft.itemId, candidateExclusionDraft.candidate.id, {
      selected: false,
      exclusionReason: reason,
    });
    setCandidateExclusionDraft(null);
  };

  const openMissingExclusionReason = (itemId: string) => {
    const item = items.find((currentItem) => currentItem.localId === itemId);
    const candidate = item?.candidates.find((currentCandidate) => (
      !currentCandidate.selected && !currentCandidate.exclusionReason.trim()
    ));

    if (!candidate) return false;

    setSelectedItemId(itemId);
    setCuradoriaTab('basket');
    setActiveStep(4);
    requestCandidateExclusion(itemId, candidate);
    return true;
  };

  const handleComplianceFindingClick = (finding: PriceResearchComplianceFinding) => {
    if (!finding.itemId) return;

    if (
      finding.message.toLowerCase().includes('exclu')
      && finding.message.includes('sem justificativa')
      && openMissingExclusionReason(finding.itemId)
    ) {
      return;
    }

    setSelectedItemId(finding.itemId);
    setCuradoriaTab('basket');
    setActiveStep(4);
  };

  const suggestCatalogForItem = async (item: PriceResearchItem) => {
    updateItem(item.localId, {
      catalogMatchStatus: 'searching',
      catalogMatchError: undefined,
      catalogSuggestions: [],
    });
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const suggestions = await findCatalogSuggestions(item.description, item.catalogType);
      updateItem(item.localId, {
        catalogMatchStatus: 'success',
        catalogSuggestions: suggestions,
        catalogMatchError: suggestions.length === 0
          ? 'Nenhum código semelhante foi localizado. Revise a descrição ou troque o catálogo.'
          : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível consultar o catálogo.';
      updateItem(item.localId, {
        catalogMatchStatus: 'error',
        catalogMatchError: message,
      });
      toast.error(message);
    }
  };

  const suggestMissingCatalogCodes = async (targetItems: PriceResearchItem[]) => {
    const missing = targetItems.filter((item) => !item.catalogCode);
    for (const item of missing) {
      await suggestCatalogForItem(item);
    }
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsParsing(true);
    try {
      const parsed = await parsePriceResearchFile(file);
      setItems(parsed);
      setSelectedItemId(undefined);
      setSourceFile(file.name);
      setResearchId(undefined);
      toast.success(`${parsed.length} item(ns) importado(s).`);
      const missingCodes = parsed.filter((item) => !item.catalogCode).length;
      if (missingCodes > 0) {
        toast.info(`Buscando códigos semelhantes para ${missingCodes} item(ns) sem CATMAT/CATSER.`);
        void suggestMissingCatalogCodes(parsed);
      }
      // Avança automaticamente para o Passo 2 após importar
      setActiveStep(2);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ler a planilha.');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const searchPrices = async () => {
    const invalid = items.filter((item) => !/^\d{4,9}$/.test(item.catalogCode));
    if (invalid.length > 0) {
      const missing = invalid.filter((item) => !item.catalogCode);
      if (missing.length > 0) {
        toast.info(`Confirme uma sugestão de CATMAT/CATSER para ${missing.length} item(ns).`);
        void suggestMissingCatalogCodes(missing);
      } else {
        toast.error(`Informe um CATMAT/CATSER válido para ${invalid.length} item(ns).`);
      }
      return;
    }

    setIsSearching(true);
    setItems((current) => current.map((item) => ({ ...item, searchStatus: 'searching', searchError: undefined })));
    try {
      const results = await priceResearchService.search(items);
      const resultMap = new Map(results.map((result) => [result.localId, result]));
      const searchResultItems = items.map((item) => {
        const result = resultMap.get(item.localId);
        return {
          ...item,
          candidates: result?.candidates ?? [],
          searchStatus: result?.error ? 'error' : 'success',
          searchError: result?.error,
        };
      });
      const resolvedItems = await resolveDirectPncpLinks(searchResultItems);
      setItems(resolvedItems);
      const found = results.reduce((total, result) => total + result.candidates.length, 0);
      toast.success(`${found} referência(s) oficial(is) encontrada(s).`);
      // Avança para a curadoria automaticamente ao buscar preços com sucesso (Passo 4)
      setActiveStep(4);
    } catch (error) {
      setItems((current) => current.map((item) => ({
        ...item,
        searchStatus: 'error',
        searchError: error instanceof Error ? error.message : 'Falha na pesquisa.',
      })));
      toast.error(error instanceof Error ? error.message : 'Não foi possível pesquisar os preços.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (selectedItem) {
      // Restaura o termo e resultados da última busca deste item
      setMarketSearchTerm(selectedItem.marketSearchTerm ?? selectedItem.description);
      setMarketResults(selectedItem.marketSearchResults ?? []);
      setCuradoriaTab('basket');
      // Inicializa estados do fornecedor local
      setLocalSupplierName('');
      setLocalSupplierDoc('');
      setLocalPrice('');
      setLocalFreight('');
      setLocalUnit(selectedItem.unit || 'UN');
      setLocalQuoteDate(new Date().toISOString().split('T')[0]);
    }
  }, [selectedItemId, selectedItem?.description]);

  useEffect(() => {
    if (curadoriaTab === 'market' && selectedItem) {
      const defaultSearchTerm = selectedItem.marketSearchTerm ?? selectedItem.description;
      const hasResults = selectedItem.marketSearchResults && selectedItem.marketSearchResults.length > 0;
      if (!hasResults && defaultSearchTerm.trim()) {
        const triggerAutoSearch = async () => {
          if (selectedMarketProviders.length === 0) return;
          setIsSearchingMarket(true);
          try {
            const results = await marketSearchService.search(defaultSearchTerm, selectedMarketProviders);
            setMarketResults(results);
            updateItem(selectedItem.localId, {
              marketSearchTerm: defaultSearchTerm,
              marketSearchResults: results,
            });
          } catch (error) {
            console.error('Erro na busca automática de e-commerce:', error);
          } finally {
            setIsSearchingMarket(false);
          }
        };
        void triggerAutoSearch();
      }
    }
  }, [curadoriaTab, selectedItemId]);

  function parseMarketPrice(priceStr: string): number {
    if (!priceStr) return 0;
    let clean = priceStr.replace(/[R$\s]/gi, '');
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }

  const handleMarketSearch = async () => {
    if (!marketSearchTerm.trim()) {
      toast.error('Informe um termo de busca.');
      return;
    }
    if (selectedMarketProviders.length === 0) {
      toast.error('Selecione ao menos um provedor.');
      return;
    }
    setIsSearchingMarket(true);
    try {
      const results = await marketSearchService.search(marketSearchTerm, selectedMarketProviders);
      setMarketResults(results);
      // Persiste os resultados no item para não perder ao trocar de item
      if (selectedItem) {
        updateItem(selectedItem.localId, {
          marketSearchTerm,
          marketSearchResults: results,
        });
      }
      toast.success(`${results.length} resultado(s) encontrado(s).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha na pesquisa de mercado.');
    } finally {
      setIsSearchingMarket(false);
    }
  };

  const handleAddMarketCandidate = async (result: MarketSearchResult) => {
    if (!selectedItem) return;

    const alreadyAdded = selectedItem.candidates.some(
      (c) => c.sourceUrl === result.link
    );
    if (alreadyAdded) {
      toast.error('Esta oferta já foi adicionada à cesta.');
      return;
    }

    const price = parseMarketPrice(result.price);
    if (price <= 0) {
      toast.error('Não foi possível obter um preço válido para esta oferta.');
      return;
    }

    const candidateId = `market-${result.provider}-${crypto.randomUUID()}`;
    const newCandidate: PriceResearchCandidate = {
      id: candidateId,
      sourceType: result.provider as any,
      sourceLabel: result.provider.charAt(0).toUpperCase() + result.provider.slice(1),
      sourceUrl: result.link,
      thumbnailLink: result.thumbnailLink,
      displayLink: result.displayLink,
      purchaseId: 'E-COMMERCE',
      purchaseItemId: 'OFFER',
      purchaseDate: today(),
      resultDate: today(),
      supplierDocument: null,
      supplierName: result.provider.toUpperCase(),
      agencyCode: 'E-COMMERCE',
      agencyName: result.displayLink,
      state: null,
      municipality: null,
      description: result.title,
      detailedDescription: result.snippet,
      brand: null,
      quantity: 1,
      originalUnitPrice: price,
      comparableUnitPrice: price,
      originalUnitLabel: 'UN',
      unitCompatible: true,
      aiScore: 100,
      aiReason: 'Selecionado via pesquisa de mercado privada',
      selected: true,
      exclusionReason: '',
      rawData: { ...result },
    };

    updateItem(selectedItem.localId, {
      candidates: [...selectedItem.candidates, newCandidate],
    });
    toast.success('Oferta incluída na cesta. Capturando evidência...');

    // Dispara captura de print em background automaticamente
    setCapturingUrls((prev) => new Set(prev).add(result.link));
    try {
      const { imageUrl, freight } = await marketSearchService.capture(result.link, freightCep || undefined);
      const freightTotal = freight.status !== 'pending' && freight.total != null ? freight.total : undefined;
      updateCandidate(selectedItem.localId, candidateId, {
        evidenceImage: imageUrl,
        evidenceCapturedAt: new Date().toISOString(),
        freightCost: freightTotal,
        comparableUnitPrice: newCandidate.originalUnitPrice + (freightTotal ?? 0),
      });
      if (freight.status === 'free') toast.success('Evidência capturada. Frete grátis detectado automaticamente.');
      else if (freight.status === 'captured') toast.success(`Evidência capturada. Frete R$ ${freight.total?.toFixed(2).replace('.', ',')} detectado automaticamente.`);
      else toast.success('Evidência capturada. Informe o frete manualmente na coluna Frete.');
    } catch {
      toast.error('Oferta incluída, mas não foi possível capturar o print. Tente manualmente na cesta.');
    } finally {
      setCapturingUrls((prev) => { const s = new Set(prev); s.delete(result.link); return s; });
    }
  };

  const handleCaptureEvidence = async (candidateId: string, url: string, originalUnitPrice: number) => {
    setCapturingCandidateId(candidateId);
    try {
      const { imageUrl, freight } = await marketSearchService.capture(url, freightCep || undefined);
      const freightTotal = freight.status !== 'pending' && freight.total != null ? freight.total : undefined;
      updateCandidate(selectedItem.localId, candidateId, {
        evidenceImage: imageUrl,
        evidenceCapturedAt: new Date().toISOString(),
        freightCost: freightTotal,
        comparableUnitPrice: originalUnitPrice + (freightTotal ?? 0),
      });
      if (freight.status === 'free') toast.success('Evidência capturada. Frete grátis detectado automaticamente.');
      else if (freight.status === 'captured') toast.success(`Evidência capturada. Frete R$ ${freight.total?.toFixed(2).replace('.', ',')} detectado automaticamente.`);
      else toast.success('Evidência capturada. Informe o frete na coluna Frete se necessário.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao capturar a evidência.');
    } finally {
      setCapturingCandidateId(null);
    }
  };

  const hasTriggeredSearch = useRef(false);

  useEffect(() => {
    if (activeStep === 3) {
      // Se todos os itens já foram buscados com sucesso, avança imediatamente para a etapa 4
      const allSuccess = items.length > 0 && items.every((item) => item.searchStatus === 'success');
      if (allSuccess) {
        setActiveStep(4);
        return;
      }

      const hasPendingSearch = items.some((item) => item.searchStatus === 'idle' || item.searchStatus === 'error');
      if (hasPendingSearch && !isSearching && !hasTriggeredSearch.current) {
        hasTriggeredSearch.current = true;
        void searchPrices();
      }
    } else {
      hasTriggeredSearch.current = false;
    }
  }, [activeStep, items, isSearching]);

  const saveResearch = async (status: 'review' | 'completed' = 'review', silent = false) => {
    if (items.length === 0) {
      if (!silent) toast.error('Importe uma planilha antes de salvar.');
      return false;
    }
    setIsSaving(true);
    try {
      const id = await priceResearchService.save(reportData, { id: researchId, status });
      setResearchId(id);
      await queryClient.invalidateQueries({ queryKey: ['price-researches'] });
      if (!silent) {
        toast.success(status === 'completed' ? 'Pesquisa concluída e salva.' : 'Pesquisa salva para revisão.');
      }
      return true;
    } catch (error) {
      if (!silent) {
        toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a pesquisa.');
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const autoSaveResearch = async () => {
    if (items.length === 0) return;
    try {
      const id = await priceResearchService.save(reportData, { id: researchId, status: 'review' });
      setResearchId(id);
      await queryClient.invalidateQueries({ queryKey: ['price-researches'] });
      toast.success('Rascunho salvo automaticamente.', { id: 'auto-save', duration: 2000 });
    } catch (error) {
      console.warn('Auto-salvamento silencioso falhou:', error);
    }
  };

  const goToStep = (step: number) => {
    if (step === activeStep) return;
    if (step > 1 && items.length === 0) {
      toast.error('Importe um arquivo de itens antes de prosseguir.');
      return;
    }

    // Regra 1: Bloquear Passo 3 ou superior se houver itens sem código CATMAT/CATSER
    if (step >= 3) {
      const itemsWithoutCode = items.filter((item) => !item.catalogCode);
      if (itemsWithoutCode.length > 0) {
        toast.error(`Mapeamento pendente: associe um código CATMAT/CATSER para todos os ${itemsWithoutCode.length} item(ns) antes de prosseguir.`);
        return;
      }
    }

    // Regra 2: Bloquear Passo 4 ou superior se a busca de preços ainda estiver pendente (idle)
    if (step >= 4) {
      const itemsNotSearched = items.filter((item) => item.searchStatus === 'idle');
      if (itemsNotSearched.length > 0) {
        toast.error(`Busca de preços pendente: realize a busca de preços oficiais (Passo 3) antes de prosseguir.`);
        return;
      }
    }

    setActiveStep(step);
    void autoSaveResearch();
  };

  const printReport = async () => {
    const errors = validatePriceResearchReport(reportData);
    if (errors.length > 0) {
      const firstBlockingFinding = analyzePriceResearchCompliance(reportData).find((finding) => finding.severity === 'error');
      if (
        firstBlockingFinding?.itemId
        && firstBlockingFinding.message.toLowerCase().includes('exclu')
        && firstBlockingFinding.message.includes('sem justificativa')
        && openMissingExclusionReason(firstBlockingFinding.itemId)
      ) {
        toast.error('Justifique a cotação desconsiderada para concluir o relatório.');
        return;
      }
      toast.error(errors[0]);
      return;
    }

    const saved = await saveResearch('completed');
    if (!saved) return;

    // Pré-carrega todas as imagens de evidência como base64 para embutir no HTML
    // (evita imagens em branco no PDF causadas por carregamento assíncrono de URLs externas)
    const fetchImageAsDataUri = async (url: string): Promise<string> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return url;
        const blob = await res.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(url);
          reader.readAsDataURL(blob);
        });
      } catch {
        return url; // fallback: usa URL original
      }
    };

    // Clona os dados e substitui URLs por data URIs
    const reportDataWithEmbeddedImages: typeof reportData = {
      ...reportData,
      items: await Promise.all(
        reportData.items.map(async (item) => ({
          ...item,
          candidates: await Promise.all(
            item.candidates.map(async (c) => {
              if (c.evidenceImage && c.evidenceImage.startsWith('http')) {
                return { ...c, evidenceImage: await fetchImageAsDataUri(c.evidenceImage) };
              }
              return c;
            })
          ),
        }))
      ),
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura do relatório.');
      return;
    }
    printWindow.document.write(buildPriceResearchReportHtml(reportDataWithEmbeddedImages));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 500);
  };


  const loadResearch = async (id: string) => {
    setLoadingResearchId(id);
    try {
      const record = await priceResearchService.getById(id);
      if (!record) throw new Error('Pesquisa não encontrada.');
      setResearchId(record.id);
      setProcessNumber(record.processNumber);
      setObjectDescription(record.objectDescription);
      setResponsibleName(record.responsibleName);
      setResearchDate(record.researchDate);
      setMethod(record.method);
      setMethodologyJustification(record.methodologyJustification);
      setNotes(record.notes);
      setSourceFile(record.sourceFile);
      const resolvedItems = await resolveDirectPncpLinks(record.items);
      setItems(resolvedItems);
      setSelectedItemId(undefined);
      setCandidateExclusionDraft(null);
      
      // Define a etapa adequada
      const hasSearch = record.items.every(item => item.searchStatus !== 'idle');
      const hasCodes = record.items.every(item => item.catalogCode);
      if (hasSearch) {
        setActiveStep(4); // Vai para a curadoria se a busca já foi executada
      } else if (hasCodes) {
        setActiveStep(3); // Vai para o console de busca se já tem códigos
      } else {
        setActiveStep(2); // Vai para catalogação se faltam códigos
      }

      setViewMode('wizard');
      toast.success('Pesquisa carregada com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir a pesquisa.');
    } finally {
      setLoadingResearchId(undefined);
    }
  };

  const complianceFindings = useMemo(() => analyzePriceResearchCompliance(reportData), [reportData]);
  const complianceCounts = useMemo(() => ({
    error: complianceFindings.filter((finding) => finding.severity === 'error').length,
    warning: complianceFindings.filter((finding) => finding.severity === 'warning').length,
    info: complianceFindings.filter((finding) => finding.severity === 'info').length,
  }), [complianceFindings]);

  const totalCount = recentResearches.length;
  const reviewCount = recentResearches.filter((r) => r.status !== 'completed').length;
  const completedCount = recentResearches.filter((r) => r.status === 'completed').length;

  const filteredResearches = useMemo(() => {
    if (!searchTerm.trim()) return recentResearches;
    const term = searchTerm.toLowerCase();
    return recentResearches.filter(
      (r) =>
        r.processNumber.toLowerCase().includes(term) ||
        r.responsibleName.toLowerCase().includes(term) ||
        (r.objectDescription && r.objectDescription.toLowerCase().includes(term))
    );
  }, [recentResearches, searchTerm]);

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Pesquisa de preços com fontes oficiais e revisão humana</HeaderSubtitle>

      {viewMode === 'list' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Panel / Dashboard Welcome */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-surface-card border border-border-subtle/70 rounded-radius-xl shadow-soft">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-sebrae-navy">Pesquisas de Preços</h3>
              <p className="text-sm text-text-muted">
                Histórico e gerenciamento de estimativas de preços oficiais sob a IN SEGES/ME nº 65/2021.
              </p>
            </div>
            <Button
              type="button"
              className="btn-primary gap-2 bg-sebrae-blue hover:bg-sebrae-navy text-white font-semibold text-sm h-10 px-4 rounded-radius-md transition-all shrink-0 flex items-center justify-center shadow-md shadow-primary/20"
              onClick={startNewResearch}
            >
              <Plus className="h-4 w-4" />
              Iniciar Nova Pesquisa
            </Button>
          </div>

          {/* Search & Filter Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              type="text"
              placeholder="Buscar por título, processo ou responsável..."
              className="pl-10 h-10 text-sm bg-surface-card border border-border-default focus-visible:ring-2 focus-visible:ring-sebrae-blue"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Main Listing Section */}
          {isFetchingRecent && recentResearches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-surface-card border border-border-default rounded-radius-lg">
              <Loader2 className="h-8 w-8 animate-spin text-sebrae-blue" />
              <p className="mt-4 text-sm text-text-secondary">Carregando pesquisas recentes...</p>
            </div>
          ) : filteredResearches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-surface-card border border-border-default rounded-radius-lg text-center p-6">
              <div className="p-4 bg-slate-100 rounded-full text-slate-400 mb-4">
                <Search className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-sebrae-navy">Nenhuma pesquisa encontrada</h4>
              <p className="text-sm text-text-muted mt-1 max-w-sm">
                {searchTerm
                  ? 'Nenhum resultado corresponde à sua busca. Tente buscar por outros termos.'
                  : 'Nenhuma pesquisa de preços foi iniciada ainda no sistema.'}
              </p>
              {!searchTerm && (
                <Button type="button" className="btn-primary mt-4 bg-sebrae-blue text-white" onClick={startNewResearch}>
                  <Plus className="h-4 w-4 mr-2" /> Iniciar Primeira Pesquisa
                </Button>
              )}
            </div>
          ) : (
            <DataTablePanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Objeto da Contratação</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResearches.map((record) => {
                    const isCompleted = record.status === 'completed';
                    return (
                      <TableRow key={record.id} className="hover:bg-surface-subtle/40">
                        <TableCell className="max-w-[350px]">
                          <p className="font-ui text-sm font-bold text-sebrae-navy truncate" title={record.objectDescription || ''}>
                            {record.objectDescription || 'Sem objeto descrito'}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-text-secondary">
                          {record.processNumber || '-'}
                        </TableCell>
                        <TableCell className="font-ui text-xs text-text-secondary">
                          {record.responsibleName || '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-text-secondary">
                          {formatDate(record.researchDate)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              isCompleted
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}
                          >
                            {isCompleted ? 'Concluída' : 'Em Revisão'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end items-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-sebrae-blue hover:text-white hover:bg-sebrae-blue rounded-full transition-all flex items-center justify-center"
                              onClick={() => void loadResearch(record.id)}
                              disabled={loadingResearchId === record.id || isDeletingId === record.id}
                              title="Editar Pesquisa"
                            >
                              {loadingResearchId === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Pencil className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive rounded-full transition-all flex items-center justify-center"
                              onClick={() => void deleteResearch(record.id)}
                              disabled={loadingResearchId === record.id || isDeletingId === record.id}
                              title="Excluir Pesquisa"
                            >
                              {isDeletingId === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DataTablePanel>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Breadcrumb e Wizard Card Unificado */}
          <div className="bg-surface-card border border-border-subtle/70 rounded-radius-xl p-6 shadow-soft space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                {/* Breadcrumb */}
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setViewMode('list');
                          void queryClient.invalidateQueries({ queryKey: ['price-researches'] });
                        }}
                        className="font-ui text-xs text-text-secondary hover:text-sebrae-blue transition-colors"
                      >
                        Pesquisas de Preços
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-ui text-xs font-bold text-text-primary">
                        {researchId ? (objectDescription ? `Editar: ${objectDescription.slice(0, 45)}${objectDescription.length > 45 ? '...' : ''}` : 'Editar Pesquisa') : 'Nova Pesquisa'}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              
              <div className="text-right shrink-0 bg-surface-subtle/30 px-3 py-1.5 rounded-lg border border-border-default/40">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Etapa Atual</span>
                <span className="text-sm font-black text-sebrae-blue">{activeStep} de 5</span>
              </div>
            </div>

            {/* Visual Stepper Wizard (4 Etapas) - Timeline Progress Style */}
            <div className="w-full py-2 border-t border-border-default/40 pt-4">
              <div className="max-w-4xl mx-auto space-y-3">
                {/* Grid of Columns for Labels */}
                <div className="grid grid-cols-4 text-center text-xs md:text-sm font-ui">
                  {[
                    { wizardNumber: 1, label: '1. Identificação', targetSteps: [1] },
                    { wizardNumber: 2, label: '2. Itens', targetSteps: [2] },
                    { wizardNumber: 3, label: '3. Cotações', targetSteps: [3, 4] },
                    { wizardNumber: 4, label: '4. Relatório', targetSteps: [5] },
                  ].map((step) => {
                    const isCompleted = Math.min(...step.targetSteps) < activeStep && !step.targetSteps.includes(activeStep);
                    const isActive = step.targetSteps.includes(activeStep);
                    
                    // Determina se pode clicar diretamente no botão
                    let isSelectable = false;
                    if (step.wizardNumber === 1) {
                      isSelectable = true;
                    } else if (step.wizardNumber === 2) {
                      isSelectable = items.length > 0;
                    } else if (step.wizardNumber === 3) {
                      isSelectable = items.length > 0 && items.every(i => i.catalogCode);
                    } else if (step.wizardNumber === 4) {
                      isSelectable = items.length > 0 && items.every(i => i.catalogCode) && items.every(i => i.searchStatus !== 'idle');
                    }

                    const handleWizardClick = () => {
                      if (step.wizardNumber === 3) {
                        // Se o usuário clicar em "Curadoria":
                        // Se a busca já foi feita (nenhum item 'idle'), vai direto para a etapa 4.
                        // Se a busca não foi feita, vai para a etapa 3 (transição/busca) para disparar a busca!
                        const hasSearch = items.every(item => item.searchStatus !== 'idle');
                        goToStep(hasSearch ? 4 : 3);
                      } else if (step.wizardNumber === 4) {
                        goToStep(5);
                      } else {
                        goToStep(step.wizardNumber);
                      }
                    };

                    return (
                      <button
                        key={step.wizardNumber}
                        type="button"
                        disabled={!isSelectable}
                        onClick={handleWizardClick}
                        className={`font-sans text-xs md:text-sm font-bold transition-all px-1 truncate ${
                          isActive
                            ? 'text-sebrae-blue font-extrabold text-[13px] md:text-[14px]'
                            : isCompleted
                            ? 'text-sebrae-blue/80 hover:text-sebrae-navy font-semibold'
                            : 'text-slate-400 font-semibold'
                        } ${isSelectable ? 'cursor-pointer hover:opacity-90' : 'cursor-not-allowed'}`}
                      >
                        {step.label}
                      </button>
                    );
                  })}
                </div>

                {/* Continuous Progress Bar aligned with column centers */}
                <div className="relative w-full">
                  <div className="w-full h-[6px] bg-slate-200/60 rounded-full overflow-hidden relative">
                    <div
                      className="absolute top-0 left-0 h-full bg-sebrae-blue rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm"
                      style={{
                        width: activeStep === 1 ? '12.5%' :
                               activeStep === 2 ? '37.5%' :
                               activeStep === 3 || activeStep === 4 ? '62.5%' :
                               '100%'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

      {/* Global Actions Header */}
      <HeaderActions>
        <Button type="button" variant="outline" className="gap-2" onClick={createPriceResearchTemplate}>
          <FileDown className="h-4 w-4" />
          Baixar modelo
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
          {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importar arquivo
        </Button>
        <Button type="button" variant="outline" className="gap-2" onClick={() => void saveResearch('review')} disabled={isSaving || items.length === 0}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar rascunho
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
          onClick={() => setIsEmailDialogOpen(true)}
          disabled={items.length === 0}
          title="Solicitar cotação de preços por e-mail para fornecedores"
        >
          <Mail className="h-4 w-4" />
          Solicitar Cotação
        </Button>
        <Button type="button" className="gap-2 bg-primary hover:bg-primary-hover text-primary-foreground" onClick={() => void printReport()} disabled={items.length === 0 || isSaving}>
          <Printer className="h-4 w-4" />
          Gerar relatório
        </Button>
      </HeaderActions>

      {/* Email Quotation Dialog */}
      <SupplierEmailDialog
        open={isEmailDialogOpen}
        onClose={() => setIsEmailDialogOpen(false)}
        researchId={researchId ?? ''}
        objectDescription={objectDescription}
        processNumber={processNumber}
        responsibleName={responsibleName}
        items={items}
        onSent={() => void queryClient.invalidateQueries({ queryKey: ['price-researches'] })}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.pdf,application/pdf"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {/* STEP 1: IDENTIFICAÇÃO & PLANILHA */}
      {activeStep === 1 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <SectionPanel
            title="Identificação da pesquisa"
            description="Campos obrigatórios para formalização do relatório conforme a IN SEGES/ME nº 65/2021."
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="research-process">Número do Processo</Label>
                <Input id="research-process" value={processNumber} onChange={(event) => setProcessNumber(event.target.value)} placeholder="23035.000000/2026-00" />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="research-date">Data da Pesquisa</Label>
                <Input id="research-date" type="date" value={researchDate} onChange={(event) => setResearchDate(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-4">
                <Label htmlFor="research-object">Objeto da Contratação</Label>
                <Textarea id="research-object" value={objectDescription} onChange={(event) => setObjectDescription(event.target.value)} rows={3} placeholder="Descrição sucinta do objeto..." />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label htmlFor="research-responsible">Agente Responsável</Label>
                <Input id="research-responsible" value={responsibleName} onChange={(event) => setResponsibleName(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label>Método Estatístico</Label>
                <Select value={method} onValueChange={(value) => setMethod(value as PriceResearchMethod)}>
                  <SelectTrigger aria-label="Método de cálculo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHOD_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2 xl:col-span-4">
                <Label htmlFor="methodology">Justificativa da Metodologia Adotada</Label>
                <Textarea id="methodology" value={methodologyJustification} onChange={(event) => setMethodologyJustification(event.target.value)} rows={2} />
              </div>
            </div>
          </SectionPanel>

          {items.length === 0 ? (
            <SectionPanel
              title="Arquivo de custos"
              description="Forneça a lista de itens a serem orçados em formato Excel ou PDF legível."
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center rounded-radius-xl border-2 border-dashed border-primary/25 bg-primary/[0.02] px-6 py-16 text-center transition-colors hover:bg-primary/[0.05]"
              >
                <FileSpreadsheet className="h-10 w-10 text-primary animate-pulse" />
                <span className="mt-4 font-ui text-base font-semibold text-text-primary">Clique para importar planilha ou PDF de custos</span>
                <span className="mt-1 max-w-xl font-ui text-sm text-text-secondary">
                  Formatos XLSX, XLS, CSV ou PDF pesquisável. O arquivo deve conter colunas de descrição, quantidade, unidade e idealmente código CATMAT ou CATSER.
                </span>
              </button>
            </SectionPanel>
          ) : (
            <div className="rounded-radius-lg border border-primary/20 bg-primary/[0.02] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-full text-primary">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-ui text-sm font-semibold text-text-primary">Planilha de Itens Carregada</h4>
                  <p className="font-ui text-xs text-text-secondary mt-0.5">
                    Arquivo: <span className="font-semibold">{sourceFile}</span> | Total: <span className="font-semibold">{items.length} itens</span>
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
                  {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Substituir planilha
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: CÓDIGOS DE CATÁLOGO */}
      {activeStep === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <SectionPanel
            title="Itens Importados"
            description="Selecione um item na lista abaixo clicando nele para configurar seu código CATMAT/CATSER e especificações."
          >
            <div className="overflow-x-auto rounded-radius-xl border border-border-default bg-surface-card">
              <table className="w-full border-collapse text-left font-ui text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-surface-subtle text-text-muted font-bold select-none">
                    <th className="py-3 px-4 text-center w-16">Item</th>
                    <th className="py-3 px-4">Descrição Técnico-Comercial</th>
                    <th className="py-3 px-4 w-28 text-right">Qtd.</th>
                    <th className="py-3 px-4 w-32">Unidade</th>
                    <th className="py-3 px-4 w-28">Tipo</th>
                    <th className="py-3 px-4 w-40">Código do Catálogo</th>
                    <th className="py-3 px-4 text-center w-20">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default/60">
                  {items.map((item) => {
                    const hasCode = !!item.catalogCode;
                    return (
                      <tr
                        key={item.localId}
                        onClick={() => setSelectedItemId(item.localId)}
                        className="hover:bg-surface-subtle/50 transition-colors cursor-pointer"
                        title="Clique para configurar este item"
                      >
                        <td className="py-3.5 px-4 text-center font-bold text-text-primary">{item.itemNumber}</td>
                        <td className="py-3.5 px-4 font-medium text-text-secondary leading-normal">{item.description}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-text-primary">{item.quantity}</td>
                        <td className="py-3.5 px-4 font-medium text-text-secondary">{item.unit || <span className="text-text-muted italic">-</span>}</td>
                        <td className="py-3.5 px-4">
                          {hasCode ? (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {item.catalogType === 'material' ? 'CATMAT' : 'CATSER'}
                            </Badge>
                          ) : (
                            <span className="text-text-muted font-mono">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-text-primary">
                          {item.catalogCode || <span className="text-text-muted font-normal italic">Pendente</span>}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Remover Item"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItem(item.localId);
                            }}
                            className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive rounded-full transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionPanel>

          {/* Modal de Configuração do Item */}
          {selectedItemId && selectedItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="relative w-full max-w-4xl bg-surface-card border border-border-default rounded-radius-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-border-default flex items-center justify-between bg-surface-subtle/50">
                  <div>
                    <h3 className="text-sm font-bold text-sebrae-navy">
                      Configuração do Item {selectedItem.itemNumber}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5 truncate max-w-[600px]">
                      {selectedItem.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="h-8 w-8 rounded-full p-0 flex items-center justify-center text-text-secondary hover:bg-slate-100 hover:text-text-primary"
                    onClick={() => setSelectedItemId(undefined)}
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-auto p-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label>Descrição Técnico-Comercial do Item</Label>
                      <Textarea
                        value={selectedItem.description}
                        onChange={(event) => updateItem(selectedItem.localId, {
                          description: event.target.value,
                          catalogMatchStatus: 'idle',
                          catalogSuggestions: [],
                          catalogMatchError: undefined,
                        })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Catálogo</Label>
                      <Select value={selectedItem.catalogType} onValueChange={(value) => updateItem(selectedItem.localId, {
                        catalogType: value as PriceResearchItem['catalogType'],
                        catalogCode: '',
                        catalogMatchStatus: 'idle',
                        catalogSuggestions: [],
                        catalogMatchError: undefined,
                        candidates: [],
                        searchStatus: 'idle',
                      })}>
                        <SelectTrigger aria-label="Tipo de catálogo"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="material">CATMAT (Materiais)</SelectItem>
                          <SelectItem value="service">CATSER (Serviços)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Código do Item</Label>
                      <div className="flex gap-2">
                        <Input
                          value={selectedItem.catalogCode}
                          onChange={(event) => updateItem(selectedItem.localId, {
                            catalogCode: event.target.value.replace(/\D/g, ''),
                            candidates: [],
                            searchStatus: 'idle',
                          })}
                          placeholder="Ex: 606523"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          aria-label="Sugerir código"
                          title="Sugerir códigos similares"
                          onClick={() => void suggestCatalogForItem(selectedItem)}
                          disabled={selectedItem.catalogMatchStatus === 'searching'}
                        >
                          {selectedItem.catalogMatchStatus === 'searching'
                            ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            : <Sparkles className="h-4 w-4 text-primary" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade do Termo</Label>
                      <Input type="number" min="0" step="any" value={selectedItem.quantity} onChange={(event) => updateItem(selectedItem.localId, { quantity: Number(event.target.value) })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Unidade de Fornecimento</Label>
                      <Input value={selectedItem.unit} onChange={(event) => updateItem(selectedItem.localId, { unit: event.target.value.toUpperCase() })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Capacidade Comparável</Label>
                      <Input type="number" min="0" step="any" value={selectedItem.targetCapacity ?? ''} onChange={(event) => updateItem(selectedItem.localId, { targetCapacity: event.target.value ? Number(event.target.value) : null })} placeholder="Ex: 500" />
                    </div>
                    <div className="space-y-2">
                      <Label>Medida Comparável</Label>
                      <Input value={selectedItem.targetMeasureUnit ?? ''} onChange={(event) => updateItem(selectedItem.localId, { targetMeasureUnit: event.target.value.toUpperCase() || null })} placeholder="G, KG, ML, L, UN..." />
                    </div>
                  </div>

                  {selectedItem.catalogMatchStatus === 'searching' && (
                    <div className="mt-4 flex items-center gap-2 rounded-radius-md border border-sebrae-blue/20 bg-sebrae-blue/5 p-4 font-ui text-sm text-sebrae-navy">
                      <Loader2 className="h-4 w-4 animate-spin text-sebrae-blue" />
                      Pesquisando correspondências no catálogo de referência de IA...
                    </div>
                  )}

                  {selectedItem.catalogSuggestions && selectedItem.catalogSuggestions.length > 0 && (
                    <div className="mt-4 space-y-3 rounded-radius-lg border border-sebrae-blue/20 bg-sebrae-blue/[0.04] p-4">
                      <div>
                        <h4 className="font-ui text-sm font-semibold text-sebrae-navy">Códigos Semelhantes Identificados no Catálogo</h4>
                        <p className="font-ui text-xs text-sebrae-blue">Selecione uma das opções para usá-la como filtro da consulta.</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedItem.catalogSuggestions.map((suggestion) => {
                          const isActive = selectedItem.catalogCode === suggestion.code;
                          return (
                            <div key={suggestion.code} className="rounded-radius-md border border-border-default bg-surface-card p-3 flex flex-col justify-between gap-3 shadow-sm hover:border-primary/45 transition-colors">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-xs">{suggestion.code}</Badge>
                                  <Badge variant="secondary" className="text-[10px]">{suggestion.score}% aderente</Badge>
                                </div>
                                <p className="mt-2 font-ui text-xs font-bold text-text-primary leading-relaxed">{suggestion.description}</p>
                                <p className="mt-1 font-ui text-[10px] text-text-muted leading-relaxed">{suggestion.reason}</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={isActive ? 'secondary' : 'outline'}
                                onClick={() => updateItem(selectedItem.localId, {
                                  catalogType: suggestion.catalogType,
                                  catalogCode: suggestion.code,
                                  candidates: [],
                                  searchStatus: 'idle',
                                  searchError: undefined,
                                })}
                              >
                                {isActive ? 'Código Ativo' : 'Usar este código'}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedItem.catalogMatchError && (
                    <div className="mt-4 rounded-radius-md border border-amber-200 bg-amber-50 p-3.5 font-ui text-xs text-amber-900 leading-normal">
                      {selectedItem.catalogMatchError}
                    </div>
                  )}

                  {selectedItem.searchError && (
                    <div className="mt-4 rounded-radius-md border border-destructive/20 bg-destructive/5 p-3.5 font-ui text-xs text-destructive">
                      {selectedItem.searchError}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3.5 border-t border-border-default bg-surface-subtle/50 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-muted font-medium">Item {selectedItem.itemNumber} de {items.length}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handlePrevItem}
                      disabled={currentIndex === 0}
                      title="Item anterior"
                      className="h-8 w-8 shrink-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleNextItem}
                      disabled={currentIndex === items.length - 1}
                      title="Próximo item"
                      className="h-8 w-8 shrink-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Button
                    type="button"
                    className="bg-sebrae-blue hover:bg-sebrae-navy text-white text-xs font-semibold h-9 px-4 rounded-lg shadow-sm"
                    onClick={() => setSelectedItemId(undefined)}
                  >
                    Confirmar e Voltar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: BUSCA DE PREÇOS */}
      {activeStep === 3 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <SectionPanel
            title="Consulta de Preços Homologados"
            description="A consulta à API de Compras do Governo Federal (últimos 12 meses) é disparada automaticamente com base nos códigos CATMAT/CATSER mapeados."
          >
            <div className="space-y-3">
              <p className="font-ui text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">Progresso da Busca por Item</p>
              {items.map((item) => (
                <div key={item.localId} className="flex items-center justify-between p-3.5 rounded-xl border border-border-light bg-white shadow-sm hover:border-slate-300 transition-all">
                  <div className="flex items-center gap-3">
                    <span className="font-ui text-xs font-bold text-sebrae-navy">Item {item.itemNumber}</span>
                    <p className="font-ui text-xs text-slate-700 truncate max-w-[320px]" title={item.description}>{item.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-xs font-semibold border-slate-200 text-slate-600 bg-slate-50">
                      {item.catalogType === 'material' ? 'CATMAT' : 'CATSER'} {item.catalogCode}
                    </Badge>
                    {item.searchStatus === 'searching' && (
                      <div className="flex items-center gap-1.5 text-xs text-sebrae-blue font-semibold">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-sebrae-blue" />
                        Consultando API...
                      </div>
                    )}
                    {item.searchStatus === 'success' && (
                      <div className="flex items-center gap-1.5 text-xs text-ifrn-green font-bold">
                        <span className="text-ifrn-green font-extrabold text-sm">✓</span>
                        {item.candidates.length} cotações encontradas
                      </div>
                    )}
                    {item.searchStatus === 'error' && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 font-semibold" title={item.searchError}>
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        Falhou
                      </div>
                    )}
                    {item.searchStatus === 'idle' && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-slate-300 animate-pulse"></span>
                        Aguardando disparo
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Dynamic Search Feedback Panel */}
            {isSearching ? (
              <div className="mt-6 border border-[#E2E8F0] bg-white rounded-xl p-5 flex items-center gap-4 shadow-sm animate-pulse">
                <Loader2 className="h-6 h-6 animate-spin text-sebrae-blue" />
                <div>
                  <h4 className="font-ui text-sm font-bold text-sebrae-navy">Pesquisa em Andamento</h4>
                  <p className="font-ui text-xs text-slate-500 mt-0.5">Buscando cotações oficiais no Compras.gov... Por favor, aguarde de 5 a 15 segundos.</p>
                </div>
              </div>
            ) : items.some((item) => item.searchStatus === 'error') ? (
              <div className="mt-6 border border-red-200 bg-red-50/30 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
                  <div>
                    <h4 className="font-ui text-sm font-bold text-red-950">Algumas consultas falharam</h4>
                    <p className="font-ui text-xs text-red-800 mt-0.5">Houve uma instabilidade ao conectar com a API oficial. Você pode tentar novamente.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  className="gap-2 bg-sebrae-blue hover:bg-sebrae-navy text-white font-semibold text-xs h-9 px-4 rounded-lg shadow-sm"
                  onClick={() => {
                    hasTriggeredSearch.current = true;
                    void searchPrices();
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Tentar Novamente
                </Button>
              </div>
            ) : items.every((item) => item.searchStatus === 'idle') ? (
              <div className="mt-6 border border-border-light bg-white rounded-xl p-5 flex items-center gap-4 shadow-sm">
                <Loader2 className="h-5 h-5 animate-spin text-slate-400" />
                <div>
                  <h4 className="font-ui text-sm font-bold text-slate-700">Inicializando busca...</h4>
                  <p className="font-ui text-xs text-slate-500 mt-0.5">Aguardando início da consulta automatizada.</p>
                </div>
              </div>
            ) : null}

            {/* Banner de Sucesso pós Busca */}
            {items.length > 0 && items.every((i) => i.searchStatus === 'success') && (
              <div className="mt-6 rounded-xl border border-ifrn-green/20 bg-ifrn-green/[0.02] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex gap-2.5 text-ifrn-green text-xs leading-normal">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-ifrn-green mt-0.5" />
                  <div>
                    <span className="font-bold">Pesquisa Finalizada com Sucesso!</span> Todas as cotações oficiais foram baixadas e analisadas.
                  </div>
                </div>
                <Button type="button" className="gap-1.5 text-xs bg-sebrae-blue text-white hover:bg-sebrae-navy" onClick={() => goToStep(4)}>
                  Avançar para Cotações
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </SectionPanel>
        </div>
      )}

      {/* STEP 4: CURADORIA DE COTAÇÕES */}
      {activeStep === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {!selectedItemId ? (
            <SectionPanel
              title="Curadoria da Cesta de Preços por Item"
              description="Examine as cotações encontradas para cada item. Selecione no mínimo 3 referências compatíveis para homologar o preço estimado."
            >
              <div className="overflow-x-auto rounded-radius-xl border border-border-default bg-surface-card">
                <table className="w-full border-collapse text-left font-ui text-xs">
                  <thead>
                    <tr className="border-b border-border-default bg-surface-subtle text-text-muted font-bold">
                      <th className="py-3 px-4 text-center w-16">Item</th>
                      <th className="py-3 px-4">Descrição Técnico-Comercial</th>
                      <th className="py-3 px-4 w-40">Código do Catálogo</th>
                      <th className="py-3 px-4 text-center w-36">Cotações Selecionadas</th>
                      <th className="py-3 px-4 text-right w-36">Preço Estimado</th>
                      <th className="py-3 px-4 text-center w-32">Status</th>
                      <th className="py-3 px-4 text-center w-36">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/60">
                    {items.map((item) => {
                      const selectedCandidates = item.candidates.filter(c => c.selected);
                      const selectedCount = selectedCandidates.length;
                      const isSufficient = selectedCount >= 3;
                      
                      const prices = selectedCandidates.map(c => c.precoRestituido || c.precoUnitario);
                      let estimatedPrice = 0;
                      if (prices.length > 0) {
                        if (method === 'median') {
                          const sorted = [...prices].sort((a, b) => a - b);
                          const mid = Math.floor(sorted.length / 2);
                          estimatedPrice = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                        } else if (method === 'average') {
                          estimatedPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
                        } else {
                          estimatedPrice = Math.min(...prices);
                        }
                      }
                      
                      return (
                        <tr key={item.localId} className="hover:bg-surface-subtle/50 transition-colors">
                          <td className="py-3.5 px-4 text-center font-bold text-text-primary">{item.itemNumber}</td>
                          <td className="py-3.5 px-4 font-medium text-text-secondary leading-normal">{item.description}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-[10px] bg-surface-subtle border border-border-default px-1.5 py-0.5 rounded text-text-secondary">
                              {item.catalogType === 'material' ? 'CATMAT' : 'CATSER'} {item.catalogCode}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`font-mono font-bold ${isSufficient ? 'text-primary' : 'text-amber-800'}`}>
                              {selectedCount} cotações
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                            {estimatedPrice > 0 ? (
                              `R$ ${estimatedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-text-muted font-normal italic">Pendente</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isSufficient ? (
                              <Badge className="border-primary/25 bg-primary/5 text-primary text-[10px] hover:bg-primary/5">Pronto</Badge>
                            ) : (
                              <Badge className="border-amber-300 bg-amber-50 text-amber-800 text-[10px] hover:bg-amber-50">Incompleto</Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex gap-1 justify-center items-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedItemId(item.localId)}
                                title="Editar Cotações"
                                aria-label="Editar Cotações"
                                className="h-8 w-8 text-sebrae-blue hover:text-white hover:bg-sebrae-blue rounded-full transition-all"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="Remover Item"
                                aria-label="Remover Item"
                                onClick={() => deleteItem(item.localId)}
                                className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive rounded-full transition-all"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionPanel>
          ) : (
            <div className="space-y-6">
              {/* Barra de Ações Superior (Voltar + Navegar) */}
              <div className="flex items-center justify-between gap-4 bg-surface-card border border-border-default rounded-radius-xl p-4 shadow-soft">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedItemId(undefined)}
                  className="text-xs gap-1.5 border-border-default text-text-secondary hover:bg-surface-subtle shrink-0"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Voltar para a Lista de Itens
                </Button>

                <div className="hidden sm:block flex-1 text-center px-4 overflow-hidden max-w-[50%] mx-auto">
                  <p className="text-sm font-bold text-sebrae-navy truncate" title={selectedItem?.description}>
                    {selectedItem?.description}
                  </p>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-text-muted font-medium mr-1.5">Item {selectedItem?.itemNumber} de {items.length}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handlePrevItem}
                    disabled={currentIndex === 0}
                    title="Item anterior"
                    className="h-8 w-8 shrink-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleNextItem}
                    disabled={currentIndex === items.length - 1}
                    title="Próximo item"
                    className="h-8 w-8 shrink-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {selectedItem ? (
                <>
                  <TooltipProvider delayDuration={120}>
                    <section className="rounded-radius-xl border border-border-default bg-surface-card p-4 shadow-soft">
                      <div className="grid gap-5 xl:grid-cols-12 xl:items-stretch">
                        <div className="min-w-0 xl:col-span-9">
                          <div className="mb-4 flex items-center gap-2">
                            <h4 className="font-ui text-sm font-bold text-text-primary">Métodos de cálculo</h4>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/[0.08]"
                                  aria-label="Informações sobre os métodos de cálculo"
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                Escolha o método que será usado como preço estimado do item. Os demais indicadores ficam disponíveis para conferência da amostra.
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          <div role="radiogroup" aria-label="Métodos de cálculo" className="grid gap-4 md:grid-cols-3">
                            {METHOD_OPTIONS.map((option) => {
                              const value = option.value === 'minimum'
                                ? selectedStatistics?.minimum ?? 0
                                : option.value === 'mean'
                                  ? selectedStatistics?.mean ?? 0
                                  : selectedStatistics?.median ?? 0;
                              const isSelected = method === option.value;

                              return (
                                <label
                                  key={option.value}
                                  className={`group flex min-h-[82px] cursor-pointer flex-col justify-between rounded-radius-lg border p-3 transition-colors ${
                                    isSelected
                                      ? 'border-primary/30 bg-primary/[0.04]'
                                      : 'border-transparent hover:border-border-default hover:bg-surface-subtle/60'
                                  }`}
                                >
                                  <span className="flex items-center gap-2 font-ui text-sm text-text-secondary">
                                    <input
                                      type="radio"
                                      name={`price-method-${selectedItem.localId}`}
                                      value={option.value}
                                      checked={isSelected}
                                      onChange={() => setMethod(option.value)}
                                      className="h-4 w-4 accent-primary"
                                    />
                                    <span className={isSelected ? 'font-bold text-primary' : 'font-medium'}>{option.label}</span>
                                  </span>
                                  <span className={`mt-2 block font-mono text-lg leading-none ${isSelected ? 'font-black text-primary' : 'font-bold text-text-primary'}`}>
                                    {formatCurrency(value)}
                                  </span>
                                  {isSelected ? (
                                    <span className="mt-1 block font-ui text-[10px] font-semibold text-text-muted">preço estimado atual</span>
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <aside
                          className={`flex min-h-[112px] w-full flex-col justify-between rounded-radius-lg border p-3 xl:col-span-3 ${
                            selectedHasHighDispersion
                              ? 'border-red-200 bg-red-50/40 text-red-700'
                              : 'border-border-default bg-surface-subtle/40 text-text-secondary'
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="font-ui text-[10px] font-black uppercase tracking-wider">Dispersão da amostra</p>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/[0.08]"
                                  aria-label="Informações sobre dispersão da amostra"
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs leading-relaxed">
                                Indicadores de dispersão ajudam a identificar valores extremos e necessidade de justificativa técnica.
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <dl className="space-y-1.5 font-ui text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <dt>Coeficiente de variação</dt>
                              <dd className="font-mono font-bold">{selectedCoefficientOfVariation.toFixed(2)}%</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt>Desvio padrão</dt>
                              <dd className="font-mono font-bold">{formatCurrency(selectedStatistics?.standardDeviation ?? 0)}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <dt>Maior preço</dt>
                              <dd className="font-mono font-bold">{formatCurrency(selectedStatistics?.maximum ?? 0)}</dd>
                            </div>
                          </dl>
                        </aside>
                      </div>

                      <div className="mt-4 grid gap-2 border-t border-border-default/70 pt-3 sm:grid-cols-2 xl:grid-cols-4">
                        {[
                          ['Amostra', `${selectedStatistics?.count ?? 0} cotação(ões)`],
                          ['Média ponderada', formatCurrency(selectedStatistics?.weightedMean ?? 0)],
                          ['Média saneada', formatCurrency(selectedStatistics?.sanitizedMean ?? 0)],
                          ['Preços excluídos', String(selectedStatistics?.excludedCount ?? 0)],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between gap-3 rounded-radius-sm bg-surface-subtle/50 px-3 py-2">
                            <span className="font-ui text-[10px] font-black uppercase tracking-wider text-text-muted">{label}</span>
                            <span className="min-w-0 truncate text-right font-mono text-xs font-bold text-text-primary">{value}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </TooltipProvider>

                  {/* Alerta de Cotações Insuficientes */}
                  {selectedItem.candidates.filter(c => c.selected).length < 3 && (
                    <div className="flex gap-2.5 rounded-radius-lg border border-amber-200 bg-amber-50/50 p-4 text-amber-900 shadow-sm">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                      <div className="font-ui text-xs leading-normal">
                        <span className="font-bold">Aviso legal da IN 65/2021:</span> Selecione no mínimo 3 preços homologados para compom a estimativa do item. Casos excepcionais exigem justificativa formal anexa ao processo.
                      </div>
                    </div>
                  )}

                  {/* Tabs de Navegação */}
                  <div className="flex border-b border-border-default space-x-6">
                    <button
                      type="button"
                      className={`pb-3 text-sm font-semibold transition-all relative ${
                        curadoriaTab === 'basket' ? 'text-primary' : 'text-text-muted hover:text-text-primary'
                      }`}
                      onClick={() => setCuradoriaTab('basket')}
                    >
                      PNCP ({selectedItem.candidates.filter(isOfficialCandidate).length})
                      {curadoriaTab === 'basket' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`pb-3 text-sm font-semibold transition-all relative ${
                        curadoriaTab === 'market' ? 'text-primary' : 'text-text-muted hover:text-text-primary'
                      }`}
                      onClick={() => setCuradoriaTab('market')}
                    >
                      Pesquisa de Mercado (Internet)
                      {curadoriaTab === 'market' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                      )}
                    </button>
                    <button
                      type="button"
                      className={`pb-3 text-sm font-semibold transition-all relative ${
                        curadoriaTab === 'local' ? 'text-primary' : 'text-text-muted hover:text-text-primary'
                      }`}
                      onClick={() => setCuradoriaTab('local')}
                    >
                      Fornecedores Locais
                      {curadoriaTab === 'local' && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                      )}
                    </button>
                  </div>

                  {/* Exibição da Aba Ativa */}
                  {curadoriaTab === 'basket' && (
                    <DataTablePanel
                      title={`Cotações do PNCP - Item ${selectedItem.itemNumber}`}
                      description="Selecione as referências oficiais do PNCP mais compatíveis tecnicamente. Exclusões precisam de justificativa descritiva."
                      actions={(
                        <Button type="button" variant="outline" className="gap-2 h-9 text-xs" onClick={() => void exportPriceResearchWorkbook(reportData)}>
                          <Download className="h-3.5 w-3.5" />
                          Exportar XLSX
                        </Button>
                      )}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Usar</TableHead>
                            <TableHead>Fonte / Aderência</TableHead>
                            <TableHead>Órgão e Fornecedor</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead className="text-right">Preço Original</TableHead>
                            <TableHead className="text-right w-24">Frete (R$)</TableHead>
                            <TableHead className="text-right">Preço Base</TableHead>
                            <TableHead className="text-center w-24">Ajuste</TableHead>
                            <TableHead className="text-right">Preço Ajustado</TableHead>
                            <TableHead className="text-right">Divergência (%)</TableHead>
                            <TableHead className="text-center w-28">Evidência</TableHead>
                            <TableHead className="text-center w-20">Excluir</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const pncpCandidates = selectedItem.candidates.filter(isOfficialCandidate);
                            return pncpCandidates.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={12} className="text-center py-8 text-text-muted text-xs">
                                  Nenhuma cotação do PNCP localizada para este item.
                                </TableCell>
                              </TableRow>
                            ) : (
                              pncpCandidates.map((candidate) => {
                              const isExcludedWithoutReason = !candidate.selected && !candidate.exclusionReason.trim();
                              return (
                                <TableRow key={candidate.id} className={candidate.selected ? 'bg-primary/[0.01]' : 'opacity-85'}>
                                  <TableCell>
                                    <Checkbox
                                      aria-label={`Usar preço ${candidate.purchaseItemId}`}
                                      checked={candidate.selected}
                                      onCheckedChange={(checked) => {
                                        if (checked === true) {
                                          updateCandidate(selectedItem.localId, candidate.id, {
                                            selected: true,
                                            exclusionReason: '',
                                          });
                                          return;
                                        }
                                        requestCandidateExclusion(selectedItem.localId, candidate);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="min-w-[220px]">
                                    <div className="flex gap-3 items-start">
                                      {candidate.thumbnailLink && (
                                        <img
                                          src={candidate.thumbnailLink}
                                          alt="Thumbnail"
                                          className="h-12 w-12 object-contain rounded-md border border-border-default bg-white p-0.5 shrink-0"
                                        />
                                      )}
                                      <div className="space-y-1.5 flex-1">
                                        {candidate.aiReason &&
                                          candidate.aiReason !== 'Descrição e unidade comparável avaliadas por critérios objetivos.' &&
                                          candidate.aiReason !== 'Descrição e unidade compatíveis.' && (
                                            <p className="font-ui text-xs text-text-primary leading-normal font-semibold">{candidate.aiReason}</p>
                                          )}
                                        <p className="line-clamp-3 font-ui text-xs text-text-secondary leading-relaxed font-bold" title={candidate.description}>{candidate.description}</p>
                                        <div className="flex gap-2">
                                          {isMarketCandidate(candidate) && (
                                            <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline">
                                              Acessar no {candidate.sourceLabel} <ExternalLink className="h-2.5 w-2.5" />
                                            </a>
                                          )}
                                          {candidate.pncpSearchUrl && (() => {
                                             let href = candidate.pncpSearchUrl;
                                             const purchaseId = candidate.purchaseId || '';
                                             const pncpMatch = purchaseId.match(/^(\d{14})-\d+-(\d+)\/(\d{4})/);
                                             if (pncpMatch) {
                                               const cnpj = pncpMatch[1];
                                               const num = parseInt(pncpMatch[2], 10);
                                               const year = pncpMatch[3];
                                               href = `https://pncp.gov.br/app/editais/${cnpj}/${year}/${num}`;
                                             } else {
                                               try {
                                                 const url = new URL(href);
                                                 const q = url.searchParams.get('q');
                                                 if (q) {
                                                   const qMatch = q.match(/^(\d{6})\s+0*(\d+)\/(\d{4})$/);
                                                   if (qMatch) {
                                                     url.searchParams.set('q', `${qMatch[1]} ${qMatch[2]}/${qMatch[3]}`);
                                                     url.searchParams.delete('pagina');
                                                     href = url.toString();
                                                   }
                                                 }
                                               } catch {
                                                 // Mantém o link original quando a URL complementar do PNCP não puder ser normalizada.
                                               }
                                             }
                                             return (
                                               <a 
                                                 href={href} 
                                                 target="_blank" 
                                                 rel="noreferrer" 
                                                 onClick={() => {
                                                   console.log('[PNCP Link Diagnostics]', {
                                                     candidateId: candidate.id,
                                                     purchaseId,
                                                     statePncpUrl: candidate.pncpSearchUrl,
                                                     renderedHref: href
                                                   });
                                                 }}
                                                 className="inline-flex items-center gap-0.5 text-[10px] font-bold text-sebrae-blue hover:underline"
                                               >
                                                 PNCP <ExternalLink className="h-2.5 w-2.5" />
                                               </a>
                                             );
                                           })()}
                                        </div>
                                        {!candidate.selected && (
                                          <div className="mt-2.5 relative flex items-center max-w-[280px]">
                                            <Input
                                              aria-label={`Justificativa para desconsiderar ${candidate.purchaseItemId}`}
                                              value={candidate.exclusionReason}
                                              onChange={(event) => updateCandidate(selectedItem.localId, candidate.id, { exclusionReason: event.target.value })}
                                              placeholder="Justifique a exclusão..."
                                              className={`h-7 text-xs pr-8 ${isExcludedWithoutReason ? 'border-amber-300 focus:border-amber-500 bg-amber-50/20' : ''}`}
                                            />
                                            {isExcludedWithoutReason && (
                                              <AlertTriangle className="absolute right-2.5 h-3 w-3 text-amber-500" title="Justificativa obrigatória" />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="min-w-[180px]">
                                    <p className="font-mono text-xs font-bold text-text-primary">{candidate.agencyCode || '-'}</p>
                                    <p className="font-ui text-xs text-text-secondary truncate max-w-[160px]" title={candidate.agencyName || ''}>{candidate.agencyName || '-'}</p>
                                    <p className="mt-1.5 font-ui text-xs font-bold text-text-primary truncate max-w-[160px]" title={candidate.supplierName || ''}>{candidate.supplierName || '-'}</p>
                                    <p className="font-mono text-[10px] text-text-secondary leading-none mt-0.5">{candidate.supplierDocument || '-'}</p>
                                    <p className="font-ui text-[10px] text-text-secondary mt-1 leading-none">{formatDate(candidate.resultDate || candidate.purchaseDate)}</p>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{candidate.originalUnitLabel}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{formatCurrency(candidate.originalUnitPrice)}</TableCell>
                                  <TableCell className="text-right w-24">
                                    {!isOfficialCandidate(candidate) ? (
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0,00"
                                        aria-label="Frete"
                                        className="h-7 text-right font-mono text-xs w-20 ml-auto px-1.5"
                                        value={candidate.freightCost ?? ''}
                                        onChange={(e) => {
                                          const freight = e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0);
                                          updateCandidate(selectedItem.localId, candidate.id, {
                                            freightCost: freight,
                                            comparableUnitPrice: candidate.originalUnitPrice + (freight ?? 0),
                                          });
                                        }}
                                      />
                                    ) : (
                                      <span className="text-xs text-text-muted font-mono">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs">{formatCurrency(candidate.comparableUnitPrice)}</TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className={`h-7 px-2 text-xs gap-1 transition-all ${
                                        candidate.monetaryAdjustmentEnabled
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold'
                                          : 'border-border-default hover:border-primary/30 text-text-secondary hover:text-primary'
                                      }`}
                                      onClick={() => {
                                        const dateVal = candidate.resultDate || candidate.purchaseDate || new Date().toISOString().split('T')[0];
                                        setMonetaryAdjustmentDraft({
                                          itemId: selectedItem.localId,
                                          candidate,
                                          enabled: candidate.monetaryAdjustmentEnabled ?? false,
                                          index: candidate.monetaryAdjustmentIndex ?? 'IPCA',
                                          manualRate: candidate.monetaryAdjustmentManualRate?.toString() ?? '0',
                                          fromDate: dateVal.slice(0, 7),
                                          toDate: researchDate.slice(0, 7),
                                        });
                                      }}
                                      title="Configurar atualização monetária"
                                    >
                                      {candidate.monetaryAdjustmentEnabled ? (
                                        <span>
                                          {candidate.monetaryAdjustmentIndex === 'manual'
                                            ? 'Manual'
                                            : candidate.monetaryAdjustmentIndex}
                                        </span>
                                      ) : (
                                        <span>Ajustar</span>
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs font-bold">
                                    {formatCurrency(candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs font-bold">
                                    {(() => {
                                      const itemEstimatedPrice = getEstimatedUnitPrice(selectedItem, method);
                                      const adjustedPrice = candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;
                                      const dev = itemEstimatedPrice > 0 ? ((adjustedPrice - itemEstimatedPrice) / itemEstimatedPrice) * 100 : 0;
                                      
                                      if (!candidate.selected) return <span className="text-text-muted">-</span>;

                                      if (dev > 0) {
                                        return (
                                          <span className={dev > 25 ? 'text-destructive font-bold' : 'text-amber-600'}>
                                            +{dev.toFixed(1)}%
                                          </span>
                                        );
                                      }
                                      if (dev < 0) {
                                        return <span className="text-emerald-600">{dev.toFixed(1)}%</span>;
                                      }
                                      return <span className="text-text-muted">0.0%</span>;
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {candidate.selected && !isOfficialCandidate(candidate) ? (
                                      candidate.evidenceImage && candidate.evidenceImage.startsWith('http') ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-2.5 text-xs gap-1 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 transition-all font-semibold"
                                          onClick={() => setPreviewCandidate(candidate)}
                                          title="Visualizar print da evidência"
                                        >
                                          <Image className="h-3.5 w-3.5" />
                                          Ver Print
                                        </Button>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-2.5 text-xs gap-1 border-border-default hover:border-primary/30 text-text-secondary hover:text-primary transition-all font-semibold"
                                          onClick={() => void handleCaptureEvidence(candidate.id, candidate.sourceUrl, candidate.originalUnitPrice)}
                                          disabled={capturingCandidateId === candidate.id}
                                          title="Capturar print da página em tempo real"
                                        >
                                          {capturingCandidateId === candidate.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                                          ) : (
                                            <Camera className="h-3.5 w-3.5 text-primary" />
                                          )}
                                          Tirar Print
                                        </Button>
                                      )
                                    ) : (
                                      <span className="text-xs text-text-muted">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      title="Desconsiderar cotação"
                                      disabled={!candidate.selected}
                                      onClick={() => requestCandidateExclusion(selectedItem.localId, candidate)}
                                      className={`h-8 w-8 rounded-full transition-all ${
                                        candidate.selected
                                          ? 'text-destructive hover:bg-destructive hover:text-white'
                                          : 'text-text-muted cursor-not-allowed opacity-40'
                                      }`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          );
                        })()}
                        </TableBody>
                      </Table>
                    </DataTablePanel>
                  )}

                  {curadoriaTab === 'market' && (
                    <div className="space-y-6">
                      {/* Painel de busca e provedores */}
                      <div className="p-5 border border-border-default bg-surface-card rounded-radius-lg shadow-soft space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                          <div className="space-y-1">
                            <h4 className="font-ui text-sm font-bold text-text-primary">Buscador de Canais Privados</h4>
                            <p className="font-ui text-xs text-text-muted">Pesquise preços diretamente nos maiores e-commerces do país.</p>
                          </div>
                          {/* Seleção de Provedores */}
                          <div className="flex flex-wrap items-center gap-4">
                            {[
                              { id: 'amazon', label: 'Amazon' },
                              { id: 'magalu', label: 'Magalu' },
                              { id: 'americanas', label: 'Americanas' },
                            ].map((prov) => {
                              const isChecked = selectedMarketProviders.includes(prov.id);
                              return (
                                <label key={prov.id} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text-secondary select-none">
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedMarketProviders((prev) => [...prev, prov.id]);
                                      } else {
                                        setSelectedMarketProviders((prev) => prev.filter((p) => p !== prov.id));
                                      }
                                    }}
                                  />
                                  {prov.label}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* CEP para cálculo de frete */}
                        <div className="flex items-center gap-2 mt-1">
                          <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
                          <span className="text-[11px] text-text-secondary font-semibold whitespace-nowrap">CEP (frete Amazon):</span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            maxLength={9}
                            placeholder="00000-000"
                            value={freightCep}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
                              const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
                              setFreightCep(formatted);
                              localStorage.setItem('pp_freight_cep', raw);
                            }}
                            className="h-7 text-xs w-32 font-mono"
                            title="CEP para cálculo automático de frete na Amazon. Para outros marketplaces, informe manualmente na coluna Frete."
                          />
                          {freightCep.replace(/\D/g, '').length === 8 && (
                            <span className="text-[10px] text-emerald-600 font-semibold">✓ Configurado</span>
                          )}
                        </div>

                        {/* Input de busca */}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                            <Input
                              type="text"
                              value={marketSearchTerm}
                              onChange={(e) => setMarketSearchTerm(e.target.value)}
                              placeholder="Digite a palavra-chave para buscar no e-commerce..."
                              className="pl-10 h-10 text-sm focus-visible:ring-sebrae-blue"
                            />
                          </div>
                          <Button
                            type="button"
                            className="bg-sebrae-blue hover:bg-sebrae-navy text-white font-semibold text-sm h-10 px-6 gap-2"
                            onClick={() => void handleMarketSearch()}
                            disabled={isSearchingMarket}
                          >
                            {isSearchingMarket ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                            Buscar
                          </Button>
                        </div>
                      </div>

                      {/* Resultados */}
                      {isSearchingMarket ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className="border border-border-default rounded-radius-lg bg-surface-card p-4 animate-pulse space-y-3">
                              <div className="h-36 bg-slate-100 rounded-md w-full" />
                              <div className="h-4 bg-slate-100 rounded w-1/4" />
                              <div className="h-6 bg-slate-100 rounded w-full" />
                              <div className="h-4 bg-slate-100 rounded w-1/2" />
                              <div className="flex justify-between items-center pt-3">
                                <div className="h-6 bg-slate-100 rounded w-20" />
                                <div className="h-8 bg-slate-100 rounded w-24" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : marketResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 bg-surface-card border border-dashed border-border-default rounded-radius-lg text-center p-6">
                          <div className="p-3.5 bg-slate-100 rounded-full text-slate-400 mb-3">
                            <ShoppingBag className="h-6 w-6" />
                          </div>
                          <h5 className="font-ui text-sm font-bold text-text-primary">Nenhum resultado para exibir</h5>
                          <p className="font-ui text-xs text-text-muted mt-1 max-w-sm">
                            Faça uma busca acima utilizando a descrição do produto para listar as ofertas das lojas.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {marketResults.map((result, idx) => {
                            const isAdded = selectedItem.candidates.some((c) => c.sourceUrl === result.link);
                            return (
                              <div
                                key={idx}
                                className="flex flex-col justify-between border border-border-default hover:border-primary/45 bg-surface-card rounded-radius-lg p-4 shadow-soft hover:shadow-md transition-all group"
                              >
                                <div className="space-y-3">
                                  {/* Imagem do produto */}
                                  <div className="h-36 bg-white rounded-md border border-border-default/50 p-2 flex items-center justify-center overflow-hidden relative">
                                    {result.thumbnailLink ? (
                                      <img
                                        src={result.thumbnailLink}
                                        alt={result.title}
                                        className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                                      />
                                    ) : (
                                      <ShoppingBag className="h-10 w-10 text-slate-300" />
                                    )}
                                    {/* Badge do Provedor */}
                                    <Badge variant="outline" className="absolute top-2 right-2 border-primary/20 bg-primary/5 text-primary text-[10px] font-semibold py-0.5 px-2 capitalize shadow-sm">
                                      {result.provider}
                                    </Badge>
                                  </div>

                                  {/* Títulos e snippets */}
                                  <div className="space-y-1">
                                    <a
                                      href={result.link}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-ui text-xs font-bold text-text-primary hover:text-sebrae-blue hover:underline line-clamp-2 leading-snug flex items-start gap-1"
                                    >
                                      {result.title}
                                      <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 text-text-muted" />
                                    </a>
                                    <p className="font-ui text-[10px] text-text-muted line-clamp-2 leading-relaxed">{result.snippet}</p>
                                    <p className="font-mono text-[9px] text-text-muted">{result.displayLink}</p>
                                  </div>
                                </div>

                                {/* Preço e ação */}
                                <div className="mt-4 pt-3 border-t border-border-default/50 flex items-center justify-between gap-2">
                                  <span className="font-mono text-base font-extrabold text-text-primary">{result.price}</span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={capturingUrls.has(result.link)}
                                    className={`gap-1 font-semibold text-xs h-8 px-3 transition-all ${
                                      capturingUrls.has(result.link)
                                        ? 'bg-amber-50 text-amber-700 border border-amber-200 cursor-wait'
                                        : isAdded
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50 cursor-default'
                                        : 'bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm'
                                    }`}
                                    onClick={() => !isAdded && !capturingUrls.has(result.link) && void handleAddMarketCandidate(result)}
                                  >
                                    {capturingUrls.has(result.link) ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Capturando...
                                      </>
                                    ) : isAdded ? (
                                      <>
                                        <Check className="h-3.5 w-3.5" />
                                        Na Cesta
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="h-3.5 w-3.5" />
                                        Incluir
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Cotações de Internet Adicionadas */}
                      <DataTablePanel
                        title="Cotações de Internet Adicionadas"
                        description="Veja abaixo as cotações de canais privados de internet que foram incluídas para este item."
                      >
                        {selectedItem.candidates.filter(isMarketCandidate).length === 0 ? (
                          <div className="text-center py-8 text-text-muted text-xs">
                            Nenhuma cotação de internet adicionada para este item. Use o buscador acima para incluir preços.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-radius-xl border border-border-default bg-surface-card">
                            <table className="w-full border-collapse text-left font-ui text-sm">
                              <thead>
                                <tr className="border-b border-border-default bg-surface-subtle text-text-muted font-bold">
                                  <th className="py-3 px-4">Produto</th>
                                  <th className="py-3 px-4 w-40">Provedor</th>
                                  <th className="py-3 px-4 w-32 text-right">Preço Unitário</th>
                                  <th className="py-3 px-4 w-32 text-right">Frete</th>
                                  <th className="py-3 px-4 w-32 text-right">Preço Base</th>
                                  <th className="py-3 px-4 text-center w-24">Ajuste</th>
                                  <th className="py-3 px-4 w-32 text-right">Preço Ajustado</th>
                                  <th className="py-3 px-4 w-32 text-right">Divergência (%)</th>
                                  <th className="py-3 px-4 text-center w-24">Excluir</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-default/60">
                                {selectedItem.candidates
                                  .filter(isMarketCandidate)
                                  .map((candidate) => {
                                    return (
                                      <tr key={candidate.id} className="hover:bg-surface-subtle/50 transition-colors">
                                        <td className="py-3.5 px-4 font-medium text-text-secondary">
                                          <div className="flex gap-3 items-center">
                                            {candidate.thumbnailLink && (
                                              <img
                                                src={candidate.thumbnailLink}
                                                alt="Thumbnail"
                                                className="h-10 w-10 object-contain rounded border border-border-default bg-white p-0.5 shrink-0"
                                              />
                                            )}
                                            <div className="space-y-1">
                                              <a
                                                href={candidate.sourceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-bold text-text-primary hover:text-sebrae-blue hover:underline line-clamp-2 leading-tight flex items-center gap-1"
                                              >
                                                {candidate.description}
                                                <ExternalLink className="h-3.5 w-3.5 text-text-muted shrink-0" />
                                              </a>
                                            </div>
                                          </div>
                                        </td>
                                        <td className="py-3.5 px-4 capitalize font-semibold text-text-secondary">{candidate.sourceLabel}</td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs">{formatCurrency(candidate.originalUnitPrice)}</td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs">{candidate.freightCost ? formatCurrency(candidate.freightCost) : '-'}</td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs text-text-secondary">{formatCurrency(candidate.comparableUnitPrice)}</td>
                                        <td className="py-3.5 px-4 text-center">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={`h-7 px-2 text-xs gap-1 transition-all ${
                                              candidate.monetaryAdjustmentEnabled
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold'
                                                : 'border-border-default hover:border-primary/30 text-text-secondary hover:text-primary'
                                            }`}
                                            onClick={() => {
                                              const dateVal = candidate.resultDate || candidate.purchaseDate || new Date().toISOString().split('T')[0];
                                              setMonetaryAdjustmentDraft({
                                                itemId: selectedItem.localId,
                                                candidate,
                                                enabled: candidate.monetaryAdjustmentEnabled ?? false,
                                                index: candidate.monetaryAdjustmentIndex ?? 'IPCA',
                                                manualRate: candidate.monetaryAdjustmentManualRate?.toString() ?? '0',
                                                fromDate: dateVal.slice(0, 7),
                                                toDate: researchDate.slice(0, 7),
                                              });
                                            }}
                                            title="Configurar atualização monetária"
                                          >
                                            {candidate.monetaryAdjustmentEnabled ? (
                                              <span>
                                                {candidate.monetaryAdjustmentIndex === 'manual'
                                                  ? 'Manual'
                                                  : candidate.monetaryAdjustmentIndex}
                                              </span>
                                            ) : (
                                              <span>Ajustar</span>
                                            )}
                                          </Button>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-text-primary">
                                          {formatCurrency(candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice)}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-text-primary">
                                          {(() => {
                                            const itemEstimatedPrice = getEstimatedUnitPrice(selectedItem, method);
                                            const adjustedPrice = candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;
                                            const dev = itemEstimatedPrice > 0 ? ((adjustedPrice - itemEstimatedPrice) / itemEstimatedPrice) * 100 : 0;
                                            
                                            if (!candidate.selected) return <span className="text-text-muted">-</span>;

                                            if (dev > 0) {
                                              return (
                                                <span className={dev > 25 ? 'text-destructive font-bold' : 'text-amber-600'}>
                                                  +{dev.toFixed(1)}%
                                                </span>
                                              );
                                            }
                                            if (dev < 0) {
                                              return <span className="text-emerald-600">{dev.toFixed(1)}%</span>;
                                            }
                                            return <span className="text-text-muted">0.0%</span>;
                                          })()}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            title="Excluir cotação de internet"
                                            onClick={() => {
                                              updateItem(selectedItem.localId, {
                                                candidates: selectedItem.candidates.filter(c => c.id !== candidate.id),
                                              });
                                              toast.success('Cotação de internet removida.');
                                            }}
                                            className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive rounded-full transition-all"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </DataTablePanel>
                    </div>
                  )}

                  {curadoriaTab === 'local' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      <div className="p-5 border border-border-default bg-surface-card rounded-radius-lg shadow-soft space-y-4">
                        <div className="space-y-1">
                          <h4 className="font-ui text-sm font-bold text-text-primary">Cadastrar Cotação de Fornecedor Local</h4>
                          <p className="font-ui text-xs text-text-muted">Insira os dados da cotação recebida por e-mail, telefone ou visita presencial de fornecedores da sua região.</p>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="local-supplier-name">Fornecedor (Razão Social / Nome Fantasia) <span className="text-destructive">*</span></Label>
                            <Input
                              id="local-supplier-name"
                              type="text"
                              value={localSupplierName}
                              onChange={(e) => setLocalSupplierName(e.target.value)}
                              placeholder="Ex: Comercial de Alimentos S.A."
                              className="h-10 text-sm"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="local-supplier-doc">CNPJ / CPF</Label>
                            <Input
                              id="local-supplier-doc"
                              type="text"
                              value={localSupplierDoc}
                              onChange={(e) => setLocalSupplierDoc(e.target.value)}
                              placeholder="Ex: 00.000.000/0000-00"
                              className="h-10 text-sm"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="local-price">Preço Unitário (R$) <span className="text-destructive">*</span></Label>
                            <Input
                              id="local-price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={localPrice}
                              onChange={(e) => setLocalPrice(e.target.value)}
                              placeholder="0,00"
                              className="h-10 text-sm font-mono"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="local-freight">Custo de Frete (R$) - Opcional</Label>
                            <Input
                              id="local-freight"
                              type="number"
                              step="0.01"
                              min="0"
                              value={localFreight}
                              onChange={(e) => setLocalFreight(e.target.value)}
                              placeholder="0,00"
                              className="h-10 text-sm font-mono"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="local-unit">Unidade de Medida</Label>
                            <Input
                              id="local-unit"
                              type="text"
                              value={localUnit}
                              onChange={(e) => setLocalUnit(e.target.value)}
                              placeholder="Ex: UN, CAIXA, KG, PAR..."
                              className="h-10 text-sm"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label htmlFor="local-date">Data da Cotação</Label>
                            <Input
                              id="local-date"
                              type="date"
                              value={localQuoteDate}
                              onChange={(e) => setLocalQuoteDate(e.target.value)}
                              className="h-10 text-sm font-mono"
                            />
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <Button
                            type="button"
                            onClick={handleAddLocalCandidate}
                            className="bg-sebrae-blue hover:bg-sebrae-navy text-white font-semibold text-sm h-10 px-6 gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Adicionar à Cesta
                          </Button>
                        </div>
                      </div>

                      {/* Lista de cotações manuais já inseridas */}
                      <DataTablePanel
                        title="Cotações Locais Cadastradas"
                        description="Veja abaixo as cotações de fornecedores locais que você inseriu manualmente para este item."
                      >
                        {selectedItem.candidates.filter(isLocalCandidate).length === 0 ? (
                          <div className="text-center py-8 text-text-muted text-xs">
                            Nenhuma cotação de fornecedor local cadastrada para este item.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-radius-xl border border-border-default bg-surface-card">
                            <table className="w-full border-collapse text-left font-ui text-sm">
                              <thead>
                                <tr className="border-b border-border-default bg-surface-subtle text-text-muted font-bold">
                                  <th className="py-3 px-4">Fornecedor</th>
                                  <th className="py-3 px-4 w-40">CNPJ / CPF</th>
                                  <th className="py-3 px-4 w-32 text-right">Preço Unitário</th>
                                  <th className="py-3 px-4 w-32 text-right">Frete</th>
                                  <th className="py-3 px-4 w-32 text-right">Preço Base</th>
                                  <th className="py-3 px-4 text-center w-24">Ajuste</th>
                                  <th className="py-3 px-4 w-32 text-right">Preço Ajustado</th>
                                  <th className="py-3 px-4 w-32 text-right">Divergência (%)</th>
                                  <th className="py-3 px-4 w-32">Data</th>
                                  <th className="py-3 px-4 text-center w-24">Excluir</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border-default/60">
                                {selectedItem.candidates
                                  .filter(isLocalCandidate)
                                  .map((candidate) => {
                                    return (
                                      <tr key={candidate.id} className="hover:bg-surface-subtle/50 transition-colors">
                                        <td className="py-3.5 px-4 font-bold text-text-primary">{candidate.supplierName}</td>
                                        <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">{candidate.supplierDocument || '-'}</td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs">{formatCurrency(candidate.originalUnitPrice)}</td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs">{candidate.freightCost ? formatCurrency(candidate.freightCost) : '-'}</td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs text-text-secondary">{formatCurrency(candidate.comparableUnitPrice)}</td>
                                        <td className="py-3.5 px-4 text-center">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className={`h-7 px-2 text-xs gap-1 transition-all ${
                                              candidate.monetaryAdjustmentEnabled
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold'
                                                : 'border-border-default hover:border-primary/30 text-text-secondary hover:text-primary'
                                            }`}
                                            onClick={() => {
                                              const dateVal = candidate.resultDate || candidate.purchaseDate || new Date().toISOString().split('T')[0];
                                              setMonetaryAdjustmentDraft({
                                                itemId: selectedItem.localId,
                                                candidate,
                                                enabled: candidate.monetaryAdjustmentEnabled ?? false,
                                                index: candidate.monetaryAdjustmentIndex ?? 'IPCA',
                                                manualRate: candidate.monetaryAdjustmentManualRate?.toString() ?? '0',
                                                fromDate: dateVal.slice(0, 7),
                                                toDate: researchDate.slice(0, 7),
                                              });
                                            }}
                                            title="Configurar atualização monetária"
                                          >
                                            {candidate.monetaryAdjustmentEnabled ? (
                                              <span>
                                                {candidate.monetaryAdjustmentIndex === 'manual'
                                                  ? 'Manual'
                                                  : candidate.monetaryAdjustmentIndex}
                                              </span>
                                            ) : (
                                              <span>Ajustar</span>
                                            )}
                                          </Button>
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-text-primary">
                                          {formatCurrency(candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice)}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono text-xs font-bold text-text-primary">
                                          {(() => {
                                            const itemEstimatedPrice = getEstimatedUnitPrice(selectedItem, method);
                                            const adjustedPrice = candidate.monetaryAdjustedPrice ?? candidate.comparableUnitPrice;
                                            const dev = itemEstimatedPrice > 0 ? ((adjustedPrice - itemEstimatedPrice) / itemEstimatedPrice) * 100 : 0;
                                            
                                            if (!candidate.selected) return <span className="text-text-muted">-</span>;

                                            if (dev > 0) {
                                              return (
                                                <span className={dev > 25 ? 'text-destructive font-bold' : 'text-amber-600'}>
                                                  +{dev.toFixed(1)}%
                                                </span>
                                              );
                                            }
                                            if (dev < 0) {
                                              return <span className="text-emerald-600">{dev.toFixed(1)}%</span>;
                                            }
                                            return <span className="text-text-muted">0.0%</span>;
                                          })()}
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs">{formatDate(candidate.purchaseDate)}</td>
                                        <td className="py-3.5 px-4 text-center">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            title="Excluir cotação local"
                                            onClick={() => {
                                              updateItem(selectedItem.localId, {
                                                candidates: selectedItem.candidates.filter(c => c.id !== candidate.id),
                                              });
                                              toast.success('Cotação local removida.');
                                            }}
                                            className="h-8 w-8 text-destructive hover:text-white hover:bg-destructive rounded-full transition-all"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </DataTablePanel>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* STEP 5: VALIDAÇÃO & RELATÓRIO FINAL */}
      {activeStep === 5 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Tabela de Consolidação por Item */}
          <SectionPanel
            title="Consolidação das Cotações por Item"
            description="Resumo dos métodos estatísticos e da estimativa final por item."
          >
            <div className="overflow-x-auto rounded-radius-xl border border-border-default bg-surface-card">
              <table className="w-full border-collapse text-left font-ui text-[11px]">
                <thead>
                  <tr className="border-b border-border-default bg-surface-subtle text-text-muted font-bold">
                    <th className="py-3 px-4 text-center w-12">Item</th>
                    <th className="py-3 px-4 min-w-[200px]">Descrição</th>
                    <th className="py-3 px-4 text-center w-12">Qtd.</th>
                    <th className="py-3 px-4 text-right w-28">Preço Estimado</th>
                    <th className="py-3 px-4 text-right w-28">Total Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default/60">
                  {items.map((item) => {
                    const estimatedPrice = getEstimatedUnitPrice(item, method);
                    const totalEstimated = estimatedPrice * item.quantity;
                    
                    return (
                      <tr key={item.localId} className="hover:bg-surface-subtle/50 transition-colors">
                        <td className="py-3 px-4 text-center font-bold text-text-primary">{item.itemNumber}</td>
                        <td className="py-3 px-4 font-medium text-text-secondary leading-normal">
                          <div>{item.description}</div>
                          <div className="mt-0.5">
                            <span className="font-mono text-[9px] bg-surface-subtle border border-border-default px-1 py-0.5 rounded text-text-secondary">
                              {item.catalogType === 'material' ? 'CATMAT' : 'CATSER'} {item.catalogCode}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono">{item.quantity}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                          {estimatedPrice > 0 ? formatCurrency(estimatedPrice) : <span className="text-text-muted font-normal italic">-</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-text-primary">
                          {totalEstimated > 0 ? formatCurrency(totalEstimated) : <span className="text-text-muted font-normal italic">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionPanel>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Resumo Consolidado */}
            <SectionPanel
              title="Resumo Consolidado"
              description="Acompanhamento geral da estimativa orçamentária calculada."
            >
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Total de Itens', items.length.toString()],
                  ['Cotações Ativas', selectedQuotesCount.toString()],
                  ['Método Estatístico', METHOD_LABELS[method]],
                  ['Estimativa Geral', formatCurrency(estimatedTotal)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-radius-lg border border-border-default bg-surface-subtle/40 p-4">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-wider text-text-muted leading-none">{label}</p>
                    <p className="mt-2 font-ui text-lg font-bold text-text-primary leading-none truncate">{value}</p>
                  </div>
                ))}
              </div>
            </SectionPanel>

            <SectionPanel
              title="Irregularidades e conformidade"
              description="Achados automáticos com base na IN SEGES/ME nº 65/2021."
            >
              <div className="grid grid-cols-3 gap-3">
                {(['error', 'warning', 'info'] as const).map((severity) => (
                  <div key={severity} className={`rounded-radius-lg border p-3 ${COMPLIANCE_SEVERITY_STYLES[severity]}`}>
                    <p className="font-ui text-[10px] font-bold uppercase tracking-wider leading-none">
                      {COMPLIANCE_SEVERITY_LABELS[severity]}
                    </p>
                    <p className="mt-2 font-mono text-xl font-bold leading-none">{complianceCounts[severity]}</p>
                  </div>
                ))}
              </div>

              {complianceFindings.length === 0 ? (
                <div className="mt-5 flex gap-2.5 rounded-radius-lg border border-primary/20 bg-primary/[0.03] p-4 text-primary">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                  <p className="font-ui text-xs leading-normal">
                    <span className="font-bold">Análise OK:</span> nenhum indício objetivo de irregularidade foi identificado pela verificação automática da IN SEGES/ME nº 65/2021.
                  </p>
                </div>
              ) : (
                <div className="mt-5 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {complianceFindings.map((finding) => (
                    <button
                      key={finding.id}
                      type="button"
                      className={`w-full rounded-radius-md border p-3 text-left transition-colors hover:bg-surface-subtle ${COMPLIANCE_SEVERITY_STYLES[finding.severity]}`}
                      onClick={() => handleComplianceFindingClick(finding)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-ui text-xs font-bold leading-snug text-current">{finding.message}</p>
                          <p className="mt-1 font-ui text-[10px] font-semibold text-current/75">{finding.ruleLabel}</p>
                        </div>
                        {finding.itemNumber ? (
                          <Badge variant="outline" className="shrink-0 bg-white/60 text-[10px]">Item {finding.itemNumber}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 font-ui text-[10px] leading-normal text-current/80">
                        <span className="font-bold">Evidência:</span> {finding.evidence}
                      </p>
                      <p className="mt-1 font-ui text-[10px] leading-normal text-current/80">
                        <span className="font-bold">Ação:</span> {finding.recommendedAction}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </SectionPanel>
          </div>

          <SectionPanel
            title="Observações Finais"
            description="Informações complementares sobre prazos de entrega, frete, garantias, marcas e condições da pesquisa."
          >
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder="Descreva prazos e locais de entrega, regras de frete, garantias técnicas exigidas, negociação por marcas ou outros fatores de mercado..."
            />
          </SectionPanel>
        </div>
      )}

      {/* WIZARD NAVIGATION FOOTER */}
      <div className="flex justify-between items-center border-t border-border-light pt-6 mt-6">
        <Button
          type="button"
          variant="outline"
          className="gap-2 font-semibold text-xs h-10 hover:text-sebrae-blue hover:border-sebrae-blue/30"
          onClick={() => {
            if (activeStep === 4 || activeStep === 3) {
              goToStep(2);
            } else {
              goToStep(activeStep - 1);
            }
          }}
          disabled={activeStep === 1}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
          {activeStep < 5 ? (
            <Button
              type="button"
              className="gap-2 bg-sebrae-blue hover:bg-sebrae-navy text-white font-semibold text-xs h-10 transition-all"
              onClick={() => goToStep(activeStep + 1)}
              disabled={items.length === 0}
            >
              Avançar
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-2 bg-sebrae-blue hover:bg-sebrae-navy text-white font-semibold text-xs h-10 transition-all"
              onClick={() => void printReport()}
              disabled={items.length === 0 || isSaving}
            >
              <Printer className="h-4 w-4" />
              Finalizar e Imprimir
            </Button>
          )}
        </div>
      </div>
      </div>
      )}

      {/* Histórico de Disparos de E-mail */}
      {researchId && (
        <SupplierEmailHistory researchId={researchId} />
      )}

      {candidateExclusionDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-radius-xl border border-border-default bg-surface-card shadow-xl animate-in zoom-in-95 duration-200">
            <div className="border-b border-border-default px-5 py-4">
              <h3 className="font-ui text-sm font-bold text-text-primary">Justificar desconsideração</h3>
              <p className="mt-1 font-ui text-xs text-text-secondary">
                A IN SEGES/ME nº 65/2021 exige critério fundamentado para desconsiderar valores da cesta.
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-radius-md border border-border-default bg-surface-subtle/45 p-3">
                <p className="line-clamp-2 font-ui text-xs font-bold text-text-primary" title={candidateExclusionDraft.candidate.description}>
                  {candidateExclusionDraft.candidate.description}
                </p>
                <p className="mt-1 font-ui text-[10px] text-text-secondary">
                  {candidateExclusionDraft.candidate.sourceLabel} | {candidateExclusionDraft.candidate.supplierName || candidateExclusionDraft.candidate.agencyName || 'Fonte sem fornecedor'} | {formatCurrency(candidateExclusionDraft.candidate.comparableUnitPrice)}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="candidate-exclusion-reason">Justificativa obrigatória</Label>
                <Textarea
                  id="candidate-exclusion-reason"
                  value={candidateExclusionDraft.reason}
                  onChange={(event) => setCandidateExclusionDraft((current) => (
                    current ? { ...current, reason: event.target.value } : current
                  ))}
                  rows={4}
                  autoFocus
                  placeholder="Ex.: unidade de fornecimento incompatível; descrição divergente; preço excessivamente elevado frente à mediana; registro sem comparabilidade técnica..."
                />
                <p className="font-ui text-[10px] text-text-muted">
                  Use uma justificativa objetiva. Mínimo operacional: 10 caracteres.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border-default px-5 py-3">
              <Button
                type="button"
                variant="outline"
                className="text-xs"
                onClick={() => setCandidateExclusionDraft(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
                onClick={confirmCandidateExclusion}
              >
                Desconsiderar cotação
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização de Evidência */}
      {previewCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-surface-card border border-border-default rounded-radius-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between bg-surface-subtle/50">
              <div>
                <h3 className="text-sm font-bold text-sebrae-navy capitalize animate-none">
                  Evidência de Preço — {previewCandidate.sourceLabel}
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5 truncate max-w-[500px]">
                  URL: <a href={previewCandidate.sourceUrl} target="_blank" rel="noreferrer" className="text-sebrae-blue hover:underline font-mono">{previewCandidate.sourceUrl}</a>
                </p>
              </div>
              <button
                type="button"
                className="h-8 w-8 rounded-full p-0 flex items-center justify-center text-text-secondary hover:bg-slate-100 hover:text-text-primary"
                onClick={() => setPreviewCandidate(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6 bg-slate-50 flex items-center justify-center min-h-[300px]">
              {previewCandidate.evidenceImage ? (
                <img
                  src={previewCandidate.evidenceImage}
                  alt={`Evidência ${previewCandidate.sourceLabel}`}
                  className="max-w-full max-h-[60vh] object-contain rounded-md border border-border-default bg-white shadow-sm"
                />
              ) : (
                <p className="text-sm text-text-muted">Nenhuma imagem capturada.</p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border-default bg-surface-subtle/50 flex justify-between items-center gap-3">
              <span className="text-[10px] font-mono text-text-muted">
                Preço Comparável: <span className="font-bold text-text-primary">{formatCurrency(previewCandidate.comparableUnitPrice)}</span>
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-9 font-semibold"
                  onClick={() => {
                    if (!previewCandidate.evidenceImage) return;
                    const link = document.createElement('a');
                    link.href = previewCandidate.evidenceImage;
                    link.download = `evidencia-${previewCandidate.sourceLabel.toLowerCase()}-${previewCandidate.id}.png`;
                    link.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar Imagem
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-primary text-primary-foreground text-xs h-9 font-semibold"
                  onClick={() => setPreviewCandidate(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de Atualização Monetária */}
      {monetaryAdjustmentDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs transition-all animate-none p-4">
          <div className="bg-surface-card border border-border-default rounded-radius-xl w-full max-w-lg shadow-premium flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border-default flex justify-between items-center bg-surface-subtle">
              <div>
                <h3 className="text-sm font-bold text-sebrae-navy capitalize">
                  Atualização Monetária
                </h3>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Ajuste o valor da cotação com base em índices de inflação ou reajuste manual.
                </p>
              </div>
              <button
                type="button"
                className="h-8 w-8 rounded-full p-0 flex items-center justify-center text-text-secondary hover:bg-slate-100 hover:text-text-primary"
                onClick={() => setMonetaryAdjustmentDraft(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1">
                <p className="text-xs text-text-secondary">
                  <strong>Fornecedor:</strong> {monetaryAdjustmentDraft.candidate.supplierName || monetaryAdjustmentDraft.candidate.sourceLabel || '-'}
                </p>
                <p className="text-xs text-text-secondary">
                  <strong>Preço Base Original:</strong> {formatCurrency(monetaryAdjustmentDraft.candidate.comparableUnitPrice)}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="monetary-adjust-enable"
                  checked={monetaryAdjustmentDraft.enabled}
                  onCheckedChange={(checked) =>
                    setMonetaryAdjustmentDraft({
                      ...monetaryAdjustmentDraft,
                      enabled: checked === true,
                    })
                  }
                />
                <label
                  htmlFor="monetary-adjust-enable"
                  className="text-xs font-semibold text-text-primary cursor-pointer"
                >
                  Ativar Atualização Monetária para esta cotação
                </label>
              </div>

              {monetaryAdjustmentDraft.enabled && (
                <div className="space-y-4 pt-2 border-t border-border-default/60">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-secondary">Índice ou Método</label>
                    <select
                      className="w-full rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                      value={monetaryAdjustmentDraft.index}
                      onChange={(e) =>
                        setMonetaryAdjustmentDraft({
                          ...monetaryAdjustmentDraft,
                          index: e.target.value as InflationIndexType | 'manual',
                        })
                      }
                    >
                      <option value="IPCA">IPCA (IBGE)</option>
                      <option value="IGP-M">IGP-M (FGV)</option>
                      <option value="INPC">INPC (IBGE)</option>
                      <option value="manual">Manual (%)</option>
                    </select>
                  </div>

                  {monetaryAdjustmentDraft.index === 'manual' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-secondary">Taxa de Reajuste (%)</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 5.5"
                        value={monetaryAdjustmentDraft.manualRate}
                        onChange={(e) =>
                          setMonetaryAdjustmentDraft({
                            ...monetaryAdjustmentDraft,
                            manualRate: e.target.value,
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary">Mês Inicial (A-M)</label>
                        <input
                          type="month"
                          className="w-full rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                          value={monetaryAdjustmentDraft.fromDate}
                          min="2024-01"
                          max="2026-07"
                          onChange={(e) =>
                            setMonetaryAdjustmentDraft({
                              ...monetaryAdjustmentDraft,
                              fromDate: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-text-secondary">Mês Final (A-M)</label>
                        <input
                          type="month"
                          className="w-full rounded-md border border-border-default bg-surface-card px-3 py-1.5 text-xs text-text-primary focus:border-primary focus:outline-none"
                          value={monetaryAdjustmentDraft.toDate}
                          min="2024-01"
                          max="2026-07"
                          onChange={(e) =>
                            setMonetaryAdjustmentDraft({
                              ...monetaryAdjustmentDraft,
                              toDate: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {monetaryAdjustmentDraft.index !== 'manual' && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded text-[11px] text-blue-700 leading-normal">
                      O reajuste será calculado proporcionalmente com base na tabela histórica oficial carregada no sistema (Janeiro/2024 a Julho/2026).
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border-default bg-surface-subtle flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-9 font-semibold"
                onClick={() => setMonetaryAdjustmentDraft(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-primary text-primary-foreground text-xs h-9 font-semibold"
                onClick={confirmMonetaryAdjustment}
              >
                Aplicar Reajuste
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
