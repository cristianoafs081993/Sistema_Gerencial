import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Coins,
  FileText,
  Info,
  Loader2,
  MoreHorizontal,
  Plus,
  Pencil,
  Printer,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  TrendingDown,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderSubtitle } from '@/components/HeaderParts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { getAuthUserMatricula, permissionMatchesAuthUser } from '@/lib/terceirizadoIdentity';
import { formatCurrency, formatarDocumento } from '@/lib/utils';
import { contratosApiService, LIQUIDACOES_CACHE_UPDATED_EVENT } from '@/services/contratosApi';
import { transparenciaService, type PortalTransparenciaItemEmpenho } from '@/services/transparencia';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import type { RequisicaoCompra, RequisicaoCompraItem, RequisicaoCompraRecord } from '@/types';
import { getEmpenhoAvailableBalance } from '@/utils/empenhoBalance';
import {
  buildEmpenhoItemBalances,
  buildRequisicaoItemsFromEmpenho,
  getRequisicaoItemAvailableBalance,
} from '@/utils/requisicaoEmpenhoItems';
import { filterAndRankRequisicaoEmpenhos } from '@/utils/requisicaoEmpenhoSelector';

// Helper to translate status labels
const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'border-slate-300 bg-slate-100 text-slate-700' },
  enviada_fornecedor: { label: 'Enviada ao Fornecedor', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  liquidada: { label: 'Enviada para Pagamento', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  review: { label: 'Enviada ao Fornecedor', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  approved: { label: 'Enviada ao Fornecedor', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  rejected: { label: 'Rascunho', className: 'border-slate-300 bg-slate-100 text-slate-700' },
};


export default function RequisicaoCompraPage() {
  const queryClient = useQueryClient();
  const { user, userGroups, isSuperAdmin } = useAuth();
  const { empenhos = [], contratos = [] } = useData();
  const userMatricula = getAuthUserMatricula(user);
  const userIdentity = useMemo(
    () => ({
      id: user?.id,
      email: user?.email,
      user_metadata: { matricula: userMatricula },
    }),
    [user?.id, user?.email, userMatricula],
  );

  // Roles verification: terceirizados são prestadores externos; todos os demais são servidores/gestores/superadmin
  const isTerceirizado = useMemo(() => userGroups.some((g) => g.slug === 'terceirizado'), [userGroups]);
  const isFiscalOrManager = useMemo(() => {
    return (
      isSuperAdmin ||
      !isTerceirizado ||
      userGroups.some((g) => g.slug !== 'terceirizado')
    );
  }, [userGroups, isSuperAdmin, isTerceirizado]);

  // Form & Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingRequisicaoId, setEditingRequisicaoId] = useState<string | undefined>();
  const [editingStatus, setEditingStatus] = useState<RequisicaoCompra['status']>('draft');
  const [requisicaoNumber, setRequisicaoNumber] = useState('');
  const [selectedEmpenhoIds, setSelectedEmpenhoIds] = useState<string[]>([]);
  const [isEmpenhoPickerOpen, setIsEmpenhoPickerOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [empenhoSearch, setEmpenhoSearch] = useState('');
  const [items, setItems] = useState<Omit<RequisicaoCompraItem, 'id' | 'requisicaoCompraId' | 'createdAt' | 'updatedAt'>[]>([]);
  const [pendingAutoFillEmpenhoIds, setPendingAutoFillEmpenhoIds] = useState<string[]>([]);
  const [emptyQuantityInputKeys, setEmptyQuantityInputKeys] = useState<Set<string>>(new Set());
  const [emptyUnitPriceInputKeys, setEmptyUnitPriceInputKeys] = useState<Set<string>>(new Set());

  // Queries
  const { data: requisicoes = [], isLoading: isLoadingRequisicoes } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => requisicoesCompraService.listRecentRequisicoes(),
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['terceirizado-permissions'],
    queryFn: () => requisicoesCompraService.listPermissions(),
  });



  const allowedEmpenhos = useMemo(() => {
    let baseEmpenhos = empenhos;

    if (isTerceirizado && !isSuperAdmin) {
      const userPerms = permissions.filter(
        (p) => permissionMatchesAuthUser(p, userIdentity) && p.empenhoId
      );
      const allowedEmpenhoIds = new Set(userPerms.map((p) => p.empenhoId));
      baseEmpenhos = empenhos.filter((e) => allowedEmpenhoIds.has(e.id));
    }


    return baseEmpenhos;
  }, [
    empenhos,
    permissions,
    isTerceirizado,
    isSuperAdmin,
    userIdentity,
  ]);

  useEffect(() => {
    const allowedIds = new Set(allowedEmpenhos.map((empenho) => empenho.id));
    setSelectedEmpenhoIds((current) => {
      const next = current.filter((id) => allowedIds.has(id));
      if (next.length === current.length) return current;

      if (!editingRequisicaoId) {
        setItems((currentItems) =>
          currentItems
            .filter((item) => item.empenhoId && next.includes(item.empenhoId))
            .map((item, index) => ({ ...item, sortOrder: index })),
        );
      }
      setPendingAutoFillEmpenhoIds((currentPending) => currentPending.filter((id) => next.includes(id)));
      return next;
    });
  }, [allowedEmpenhos, editingRequisicaoId]);


  // Total retido / comprometido por empenho em requisições com status 'enviada_fornecedor' (excluindo requisição em edição)
  const enviadoFornecedorTotalByEmpenhoId = useMemo(() => {
    const map = new Map<string, number>();

    requisicoes.forEach((req) => {
      const isEnviada = req.status === 'enviada_fornecedor' || req.status === 'review' || req.status === 'approved';
      if (!isEnviada) return;
      if (editingRequisicaoId && req.id === editingRequisicaoId) return;

      if (req.items && req.items.length > 0) {
        req.items.forEach((item) => {
          const empId = item.empenhoId || req.empenhoId;
          if (empId) {
            const current = map.get(empId) ?? 0;
            map.set(empId, current + (item.quantity * item.unitPrice));
          }
        });
      } else if (req.empenhoId && req.totalValue) {
        const current = map.get(req.empenhoId) ?? 0;
        map.set(req.empenhoId, current + req.totalValue);
      }
    });

    return map;
  }, [requisicoes, editingRequisicaoId]);

  const selectedEmpenhos = useMemo(
    () => selectedEmpenhoIds
      .map((id) => empenhos.find((empenho) => empenho.id === id))
      .filter((empenho): empenho is NonNullable<typeof empenho> => Boolean(empenho)),
    [empenhos, selectedEmpenhoIds],
  );

  const primaryEmpenho = selectedEmpenhos[0];

  // Saldo Oficial SIAFI
  const officialBalanceByEmpenhoId = useMemo(() => {
    return new Map(selectedEmpenhos.map((empenho) => [empenho.id, getEmpenhoAvailableBalance(empenho)]));
  }, [selectedEmpenhos]);

  // Saldo Disponível Efetivo (Oficial - Enviadas ao Fornecedor)
  const empenhoBalanceById = useMemo(() => {
    return new Map(
      selectedEmpenhos.map((empenho) => {
        const official = officialBalanceByEmpenhoId.get(empenho.id) ?? 0;
        const enviado = enviadoFornecedorTotalByEmpenhoId.get(empenho.id) ?? 0;
        return [empenho.id, Math.max(0, official - enviado)];
      }),
    );
  }, [officialBalanceByEmpenhoId, enviadoFornecedorTotalByEmpenhoId, selectedEmpenhos]);

  const selectedEmpenhoOptions = useMemo(() => {
    const selectedIds = new Set(selectedEmpenhoIds);
    return selectedEmpenhos
      .filter((empenho) => selectedIds.has(empenho.id))
      .map((empenho) => {
        const effective = empenhoBalanceById.get(empenho.id) ?? getEmpenhoAvailableBalance(empenho);
        const enviado = enviadoFornecedorTotalByEmpenhoId.get(empenho.id) ?? 0;
        const extra = enviado > 0 ? ` (disp. c/ desconto de enviadas)` : '';
        return {
          id: empenho.id,
          label: `${empenho.numero} - saldo ${formatCurrency(effective)}${extra}`,
        };
      });
  }, [selectedEmpenhos, selectedEmpenhoIds, empenhoBalanceById, enviadoFornecedorTotalByEmpenhoId]);


  const filteredEmpenhos = useMemo(
    () => filterAndRankRequisicaoEmpenhos(allowedEmpenhos, {
      busca: empenhoSearch,
    }),
    [allowedEmpenhos, empenhoSearch],
  );

  const portalEmpenhoItemQueries = useQueries({
    queries: selectedEmpenhos.map((empenho) => ({
      queryKey: ['requisicao-portal-itens-empenho', empenho.numero],
      queryFn: () => transparenciaService.getItensEmpenhoPortal(empenho.numero),
      retry: false,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const liquidacoesEmpenhoQueries = useQueries({
    queries: selectedEmpenhos.map((empenho) => ({
      queryKey: ['requisicao-liquidacoes-api-empenho', empenho.numero],
      queryFn: () => contratosApiService.getLiquidacoesPublicasPorEmpenho(empenho.numero),
      retry: false,
      staleTime: 60 * 1000,
    })),
  });

  useEffect(() => {
    const handleLiquidacoesCacheUpdated = () => {
      void queryClient.invalidateQueries({ queryKey: ['requisicao-liquidacoes-api-empenho'] });
    };

    window.addEventListener(LIQUIDACOES_CACHE_UPDATED_EVENT, handleLiquidacoesCacheUpdated);
    return () => window.removeEventListener(LIQUIDACOES_CACHE_UPDATED_EVENT, handleLiquidacoesCacheUpdated);
  }, [queryClient]);

  const empenhoItemBalanceReadyById = useMemo(() => {
    return new Map(
      selectedEmpenhos.map((empenho, index) => [
        empenho.id,
        Boolean(liquidacoesEmpenhoQueries[index]?.isSuccess),
      ]),
    );
  }, [liquidacoesEmpenhoQueries, selectedEmpenhos]);

  const empenhoItemBalanceErrorById = useMemo(() => {
    return new Map(
      selectedEmpenhos.map((empenho, index) => [
        empenho.id,
        Boolean(liquidacoesEmpenhoQueries[index]?.isError),
      ]),
    );
  }, [liquidacoesEmpenhoQueries, selectedEmpenhos]);



  const empenhoItemBalancesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildEmpenhoItemBalances>>();
    selectedEmpenhos.forEach((empenho, index) => {
      map.set(
        empenho.id,
        buildEmpenhoItemBalances(
          empenho.numero,
          (portalEmpenhoItemQueries[index]?.data ?? []) as PortalTransparenciaItemEmpenho[],
          liquidacoesEmpenhoQueries[index]?.data ?? [],
        ),
      );
    });
    return map;
  }, [liquidacoesEmpenhoQueries, portalEmpenhoItemQueries, selectedEmpenhos]);

  useEffect(() => {
    if (!isEditing || editingRequisicaoId || pendingAutoFillEmpenhoIds.length === 0) return;

    const nextPending: string[] = [];
    const additions: typeof items = [];

    pendingAutoFillEmpenhoIds.forEach((empenhoId) => {
      const empenhoIndex = selectedEmpenhos.findIndex((empenho) => empenho.id === empenhoId);
      const empenho = selectedEmpenhos[empenhoIndex];
      if (!empenho) return;

      const isLoading = portalEmpenhoItemQueries[empenhoIndex]?.isLoading;
      if (isLoading) {
        nextPending.push(empenhoId);
        return;
      }

      if (items.some((item) => item.empenhoId === empenhoId) || additions.some((item) => item.empenhoId === empenhoId)) {
        return;
      }

      const balances = empenhoItemBalancesById.get(empenhoId) ?? [];
      if (balances.length > 0) {
        additions.push(
          ...buildRequisicaoItemsFromEmpenho(empenho.numero, balances).map((item) => ({
            ...item,
            empenhoId: empenho.id,
            empenhoNumero: empenho.numero,
          })),
        );
        return;
      }

      if (!portalEmpenhoItemQueries[empenhoIndex]?.isError) {
        additions.push(
        {
          description: 'Aquisição de material/serviço conforme especificações',
          quantity: 0,
          unit: 'UN',
          unitPrice: 0,
          empenhoId: empenho.id,
          empenhoNumero: empenho.numero,
          sourceType: 'manual',
          sortOrder: 0,
        },
        );
      toast.warning('Nenhum subitem foi encontrado para este empenho. Você pode cadastrar os itens manualmente.');
      }
    });

    if (additions.length > 0) {
      setItems((current) => [...current, ...additions].map((item, index) => ({ ...item, sortOrder: index })));
    }
    setPendingAutoFillEmpenhoIds(nextPending);
  }, [
    editingRequisicaoId,
    empenhoItemBalancesById,
    isEditing,
    items,
    liquidacoesEmpenhoQueries,
    pendingAutoFillEmpenhoIds,
    portalEmpenhoItemQueries,
    selectedEmpenhos,
  ]);
  const handleRemoveSelectedEmpenho = (empenhoId: string) => {
    const hasItems = items.some((item) => item.empenhoId === empenhoId);
    if (hasItems && !confirm('Remover este empenho tambem removera os itens vinculados a ele. Deseja continuar?')) {
      return;
    }

    setSelectedEmpenhoIds((current) => current.filter((id) => id !== empenhoId));
    setPendingAutoFillEmpenhoIds((current) => current.filter((id) => id !== empenhoId));
    setItems((current) =>
      current
        .filter((item) => item.empenhoId !== empenhoId)
        .map((item, index) => ({ ...item, sortOrder: index })),
    );
  };

  const toggleEmpenhoSelection = (empenhoId: string) => {
    if (selectedEmpenhoIds.includes(empenhoId)) {
      handleRemoveSelectedEmpenho(empenhoId);
      return;
    }

    setSelectedEmpenhoIds((current) => [...current, empenhoId]);
    if (!editingRequisicaoId) {
      setPendingAutoFillEmpenhoIds((current) => [...new Set([...current, empenhoId])]);
    }
  };


  const handleUpdateItem = (index: number, patch: Partial<typeof items[0]>) => {
    setItems((curr) => curr.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const handleRemoveItem = (index: number) => {
    setItems((curr) => curr.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, sortOrder: idx })));
  };

  const requisicaoTotal = useMemo(() => {
    return items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  }, [items]);

  const itemBalanceViolations = useMemo(() => {
    return items
      .map((item, index) => {
        const isBalanceReady = item.empenhoId ? empenhoItemBalanceReadyById.get(item.empenhoId) === true : false;
        const available = isBalanceReady ? getRequisicaoItemAvailableBalance(item, item.empenhoId ? empenhoItemBalancesById.get(item.empenhoId) ?? [] : []) : null;
        const requested = item.quantity * item.unitPrice;
        return available !== null && requested > available
          ? { index, description: item.description, requested, available }
          : null;
      })
      .filter((item): item is { index: number; description: string; requested: number; available: number } => Boolean(item));
  }, [empenhoItemBalanceReadyById, empenhoItemBalancesById, items]);

  const requisicaoTotalByEmpenhoId = useMemo(() => {
    const totals = new Map<string, number>();
    items.forEach((item) => {
      if (!item.empenhoId) return;
      totals.set(item.empenhoId, (totals.get(item.empenhoId) ?? 0) + item.quantity * item.unitPrice);
    });
    return totals;
  }, [items]);

  const empenhoBalanceViolations = useMemo(() => {
    return selectedEmpenhos
      .map((empenho) => {
        const requested = requisicaoTotalByEmpenhoId.get(empenho.id) ?? 0;
        const available = empenhoBalanceById.get(empenho.id) ?? 0;
        return requested > available ? { empenho, requested, available } : null;
      })
      .filter((item): item is { empenho: typeof selectedEmpenhos[number]; requested: number; available: number } => Boolean(item));
  }, [empenhoBalanceById, requisicaoTotalByEmpenhoId, selectedEmpenhos]);

  // Start creating new Requisição
  const handleNewRequisicao = () => {
    setEditingRequisicaoId(undefined);
    setEditingStatus('draft');
    setRequisicaoNumber(`REQ-${new Date().getFullYear()}-${String(requisicoes.length + 1).padStart(4, '0')}`);
    setSelectedEmpenhoIds([]);
    setIsEmpenhoPickerOpen(false);
    setEmpenhoSearch('');
    setNotes('');
    setItems([]);
    setEmptyQuantityInputKeys(new Set());
    setEmptyUnitPriceInputKeys(new Set());
    setPendingAutoFillEmpenhoIds([]);
    setIsEditing(true);
  };

  // Open existing Requisição for edit
  const handleEditRequisicao = async (requisicao: RequisicaoCompra) => {
    const loadingToast = toast.loading('Carregando requisição de compra...');
    try {
      const fullRequisicao = await requisicoesCompraService.getRequisicaoById(requisicao.id);
      if (!fullRequisicao) throw new Error('Requisição de compra não encontrada.');

      setEditingRequisicaoId(fullRequisicao.id);
      setEditingStatus(fullRequisicao.status);
      setRequisicaoNumber(fullRequisicao.number);
      setEmpenhoSearch('');
      const requisicaoEmpenhoIds = (fullRequisicao.empenhos?.length
        ? fullRequisicao.empenhos.map((empenho) => empenho.empenhoId)
        : fullRequisicao.empenhoId
          ? [fullRequisicao.empenhoId]
          : []
      ).filter(Boolean);
      setSelectedEmpenhoIds(requisicaoEmpenhoIds);
      setNotes(fullRequisicao.notes || '');
      setEmptyQuantityInputKeys(new Set());
      setEmptyUnitPriceInputKeys(new Set());
      setItems(fullRequisicao.items.map((item, index) => ({
        ...item,
        empenhoId: item.empenhoId || requisicaoEmpenhoIds[0],
        empenhoNumero: item.empenhoNumero || fullRequisicao.empenhos?.find((empenho) => empenho.empenhoId === (item.empenhoId || requisicaoEmpenhoIds[0]))?.empenhoNumero || fullRequisicao.empenhoNumero,
        sortOrder: index,
      })));
      setPendingAutoFillEmpenhoIds([]);
      setIsEditing(true);
      toast.dismiss(loadingToast);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar requisição.', { id: loadingToast });
    }
  };

  // Cancel form
  const handleCancelForm = () => {
    setIsEditing(false);
    setEditingRequisicaoId(undefined);
    setEditingStatus('draft');
    setEmptyQuantityInputKeys(new Set());
    setEmptyUnitPriceInputKeys(new Set());
  };

  // Save Requisição
  const handleSaveRequisicao = async (status: RequisicaoCompra['status'] = 'draft'): Promise<string | null> => {
    if (!requisicaoNumber.trim()) {
      toast.error('Informe o número da Requisição de Compra.');
      return null;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um item à Requisição de Compra.');
      return null;
    }
    if (items.some((i) => !i.description.trim() || i.quantity < 0 || i.unitPrice < 0)) {
      toast.error('Revise os itens. Todos devem conter descrição, quantidade não negativa e preço válido.');
      return null;
    }

    const isEnviando = status === 'enviada_fornecedor' || status === 'review' || status === 'approved' || status === 'liquidada';
    if (isEnviando && selectedEmpenhos.length === 0) {
      toast.error('Selecione ao menos um empenho antes de salvar a requisição.');
      return null;
    }
    if (isEnviando && items.some((item) => !item.empenhoId || !selectedEmpenhoIds.includes(item.empenhoId))) {
      toast.error('Cada item deve estar vinculado a um empenho selecionado.');
      return null;
    }

    if ((status === 'enviada_fornecedor' || status === 'review') && empenhoBalanceViolations.length > 0) {
      const firstViolation = empenhoBalanceViolations[0];
      toast.error(`Saldo insuficiente no empenho ${firstViolation.empenho.numero}. Saldo disponível: ${formatCurrency(firstViolation.available)}.`);
      return null;
    }

    if ((status === 'enviada_fornecedor' || status === 'review') && itemBalanceViolations.length > 0) {
      const firstViolation = itemBalanceViolations[0];
      toast.error(`Saldo insuficiente no item ${firstViolation.index + 1}. Saldo do item: ${formatCurrency(firstViolation.available)}.`);
      return null;
    }
    const selectedPayloadEmpenhos = selectedEmpenhos.map((empenho, index) => ({
      empenhoId: empenho.id,
      empenhoNumero: empenho.numero,
      sortOrder: index,
    }));
    const payload = {
      title: `Requisição de Compra ${requisicaoNumber}`,
      number: requisicaoNumber,
      empenhoId: primaryEmpenho?.id,
      empenhoNumero: primaryEmpenho?.numero,
      empenhos: selectedPayloadEmpenhos,
      notes: notes || undefined,
      status,
    };

    const loadingToast = toast.loading('Salvando requisição de compra...');
    try {
      const savedId = await requisicoesCompraService.saveRequisicao(payload, items, { id: editingRequisicaoId, status });
      let successMessage = 'Requisição salva com sucesso.';
      if (status === 'enviada_fornecedor' || status === 'review') {
        successMessage = 'Requisição enviada ao fornecedor com sucesso.';
      } else if (status === 'liquidada') {
        successMessage = 'Requisição enviada para pagamento com sucesso.';
      }
      toast.success(successMessage, { id: loadingToast });
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      return savedId;
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : typeof err === 'object' && err && 'message' in err
          ? String((err as { message?: unknown }).message || 'Erro ao salvar Requisição de Compra.')
          : 'Erro ao salvar Requisição de Compra.';
      toast.error(message, { id: loadingToast });
      return null;
    }
  };

  // Change Status (Rascunho <-> Enviada ao Fornecedor <-> Enviada para Pagamento)
  const handleChangeStatus = async (requisicaoId: string, status: RequisicaoCompra['status']) => {
    const targetStatusLabel = STATUS_META[status]?.label || status;
    const loadingToast = toast.loading(`Alterando situação para "${targetStatusLabel}"...`);
    try {
      const fullRequisicao = await requisicoesCompraService.getRequisicaoById(requisicaoId);
      if (!fullRequisicao) throw new Error('Requisição não localizada.');

      // Ao enviar ao fornecedor, valida saldo disponível
      if (status === 'enviada_fornecedor' || status === 'review') {
        const empenhosToCheck = fullRequisicao.empenhos?.length
          ? fullRequisicao.empenhos
          : fullRequisicao.empenhoId
            ? [{ empenhoId: fullRequisicao.empenhoId, empenhoNumero: fullRequisicao.empenhoNumero || '', sortOrder: 0 }]
            : [];

        for (const emp of empenhosToCheck) {
          const empenhoObj = empenhos.find((e) => e.id === emp.empenhoId);
          if (empenhoObj) {
            const official = getEmpenhoAvailableBalance(empenhoObj);
            const totalEnviadoOnEmp = enviadoFornecedorTotalByEmpenhoId.get(emp.empenhoId) ?? 0;
            const currentReqOnEmp = (fullRequisicao.status === 'enviada_fornecedor' || fullRequisicao.status === 'review' || fullRequisicao.status === 'approved')
              ? fullRequisicao.items
                  .filter((i) => (i.empenhoId || fullRequisicao.empenhoId) === emp.empenhoId)
                  .reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0)
              : 0;
            const otherEnviado = Math.max(0, totalEnviadoOnEmp - currentReqOnEmp);
            const available = Math.max(0, official - otherEnviado);
            const reqTotalOnEmpenho = fullRequisicao.items
              .filter((i) => (i.empenhoId || fullRequisicao.empenhoId) === emp.empenhoId)
              .reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
            if (reqTotalOnEmpenho > available) {
              throw new Error(`Saldo insuficiente no empenho ${emp.empenhoNumero}. Saldo disponível: ${formatCurrency(available)} (Saldo oficial: ${formatCurrency(official)}, Comprometido em enviadas: ${formatCurrency(otherEnviado)}).`);
            }
          }
        }
      }

      // Save with new status
      await requisicoesCompraService.saveRequisicao(
        {
          title: fullRequisicao.title,
          number: fullRequisicao.number,
          processNumber: fullRequisicao.processNumber,
          contratoId: fullRequisicao.contratoId,
          contratoNumero: fullRequisicao.contratoNumero,
          empenhoId: fullRequisicao.empenhoId,
          empenhoNumero: fullRequisicao.empenhoNumero,
          empenhos: fullRequisicao.empenhos,
          notes: fullRequisicao.notes,
          status,
        },
        fullRequisicao.items,
        { id: requisicaoId, status }
      );

      toast.success(`Situação atualizada para: ${targetStatusLabel}`, { id: loadingToast });
      if (editingRequisicaoId === requisicaoId) {
        setEditingStatus(status);
      }
      void queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível alterar a situação.';
      toast.error(message, { id: loadingToast });
    }
  };

  // Delete Requisição
  const handleDeleteRequisicao = async (requisicaoId: string) => {
    if (!confirm('Deseja realmente excluir esta Requisição de Compra?')) return;
    const loadingToast = toast.loading('Excluindo...');
    try {
      await requisicoesCompraService.deleteRequisicao(requisicaoId);
      toast.success('Excluído com sucesso.', { id: loadingToast });
      void queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao excluir.';
      toast.error(message, { id: loadingToast });
    }
  };
  // Print PDF Generator
  const handlePrintPDF = async (requisicao: RequisicaoCompra) => {
    const loadingToast = toast.loading('Preparando documento de impressão...');
    try {
      const fullRequisicao = await requisicoesCompraService.getRequisicaoById(requisicao.id);
      if (!fullRequisicao) throw new Error('Requisição não encontrada.');

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('O navegador bloqueou a abertura do PDF.');
        return;
      }

      // Find references
      const contratoInfo = contratos.find((c) => c.id === fullRequisicao.contratoId);
      const requisicaoEmpenhos = fullRequisicao.empenhos?.length
        ? fullRequisicao.empenhos
        : fullRequisicao.empenhoId
          ? [{ empenhoId: fullRequisicao.empenhoId, empenhoNumero: fullRequisicao.empenhoNumero || '', sortOrder: 0 }]
          : [];
      const empenhoInfoById = new Map(empenhos.map((empenho) => [empenho.id, empenho]));
      const empenhosLabel = requisicaoEmpenhos.length > 0
        ? requisicaoEmpenhos
            .map((linkedEmpenho) => {
              const empenhoInfo = empenhoInfoById.get(linkedEmpenho.empenhoId);
              const numero = empenhoInfo?.numero || linkedEmpenho.empenhoNumero || '-';
              return empenhoInfo?.favorecidoNome
                ? `${numero} (Favorecido: ${empenhoInfo.favorecidoNome})`
                : numero;
            })
            .join('<br />')
        : '-';

      const printableItems = fullRequisicao.items.filter((item) => item.quantity > 0);

      const itemsHtml = printableItems
        .map(
          (item, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td>${item.empenhoNumero || fullRequisicao.empenhoNumero || '-'}</td>
          <td>${item.description}</td>
          <td style="text-align: center;">${item.unit}</td>
          <td style="text-align: right;">${item.quantity.toLocaleString('pt-BR')}</td>
          <td style="text-align: right;">${formatCurrency(item.unitPrice)}</td>
          <td style="text-align: right;">${formatCurrency(item.quantity * item.unitPrice)}</td>
        </tr>
      `
        )
        .join('');

      const totalValue = printableItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

      const reportHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Requisição de Compra ${fullRequisicao.number}</title>
        <style>
          @page { size: A4 portrait; margin: 20mm 15mm; }
          body { font-family: "Segoe UI", Arial, sans-serif; color: #333; font-size: 11px; line-height: 1.6; margin: 0; }
          .header { text-align: center; border-bottom: 2px solid #2f9e41; padding-bottom: 15px; margin-bottom: 20px; }
          .header h1 { font-size: 16px; margin: 0; color: #1a1a1a; font-weight: bold; }
          .header h2 { font-size: 12px; margin: 5px 0 0; color: #2f9e41; font-weight: 600; }
          .header .sub { font-size: 9px; color: #666; margin-top: 3px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 25px; border: 1px solid #e2e8f0; background: #fafafa; padding: 12px; border-radius: 6px; }
          .meta-item { font-size: 10px; }
          .meta-item strong { color: #4a5568; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
          th, td { border: 1px solid #cbd5e0; padding: 8px 10px; text-align: left; }
          th { background: #edf2f7; color: #2d3748; font-weight: bold; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
          .total-row { background: #edf6ef; font-weight: bold; font-size: 12px; }
          .notes-box { margin-bottom: 40px; padding: 12px; border: 1px solid #cbd5e0; border-radius: 6px; }
          .notes-title { font-weight: bold; margin-bottom: 6px; color: #2d3748; font-size: 10px; text-transform: uppercase; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 60px; text-align: center; }
          .sig-line { border-top: 1px solid #718096; margin-top: 40px; padding-top: 5px; font-size: 10px; }
          .sig-line span { display: block; color: #718096; font-size: 9px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>INSTITUTO FEDERAL DE EDUCAÇÃO, CIÊNCIA E TECNOLOGIA DO RIO GRANDE DO NORTE</h1>
          <h2>REQUISIÇÃO DE COMPRA</h2>
          <div class="sub">SIAGES - Sistema Integrado de Administração e Gestão Estratégica</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <strong>Requisição de Compra nº:</strong> ${fullRequisicao.number}<br />
            <strong>Processo Relacionado:</strong> ${fullRequisicao.processNumber || '-'}<br />
            <strong>Emitido por:</strong> ${fullRequisicao.createdByEmail}<br />
            <strong>Situação:</strong> ${STATUS_META[fullRequisicao.status].label}
          </div>
          <div class="meta-item">
            <strong>Contrato Vinculado:</strong> ${
              contratoInfo ? `${contratoInfo.numero} - ${contratoInfo.contratada}` : fullRequisicao.contratoNumero || '-'
            }<br />
            <strong>Empenhos / NEs:</strong> ${empenhosLabel}<br />
            <strong>Data de Cadastro:</strong> ${fullRequisicao.createdAt.toLocaleDateString('pt-BR')} às ${fullRequisicao.createdAt.toLocaleTimeString('pt-BR')}<br />
            <strong>Data da Última Atualização:</strong> ${fullRequisicao.updatedAt.toLocaleDateString('pt-BR')}<br />
            <strong>Data da Última Edição:</strong> ${fullRequisicao.updatedAt.toLocaleDateString('pt-BR')}
          </div>
        </div>

        <h2>Detalhamento dos Itens / Serviços Requisitados</h2>
        <table>
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">Item</th>
              <th style="width: 16%;">Empenho / NE</th>
              <th style="width: 39%;">Descrição dos Itens / Serviços</th>
              <th style="width: 10%; text-align: center;">Unid.</th>
              <th style="width: 10%; text-align: right;">Qtd.</th>
              <th style="width: 10%; text-align: right;">Preço Unitário</th>
              <th style="width: 10%; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="total-row">
              <td colspan="6" style="text-align: right;">Valor Total da Requisição de Compra:</td>
              <td style="text-align: right; color: #1e6b2d;">${formatCurrency(totalValue)}</td>
            </tr>
          </tbody>
        </table>

        ${
          fullRequisicao.notes
            ? `
          <div class="notes-box">
            <div class="notes-title">Observações / Notas Complementares</div>
            <div>${fullRequisicao.notes}</div>
          </div>
        `
            : ''
        }

        <div class="signatures">
          <div>
            <div class="sig-line">
              <strong>${fullRequisicao.createdByEmail}</strong>
              <span>Solicitante Responsável</span>
            </div>
          </div>
          <div>
            <div class="sig-line">
              <strong>Fiscal do Contrato Administrativo</strong>
              <span>IFRN - Representante da Unidade Gestora</span>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

      printWindow.document.write(reportHtml);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
      }, 150);

      toast.success('Documento aberto para impressão.', { id: loadingToast });
    } catch (err) {
      toast.error('Erro ao gerar PDF.', { id: loadingToast });
    }
  };

  const handlePrintAndSave = async () => {
    const savedId = await handleSaveRequisicao('draft');
    if (!savedId) return;

    const savedRequisicao = await requisicoesCompraService.getRequisicaoById(savedId);
    if (!savedRequisicao) {
      toast.error('Requisição salva, mas não foi possível carregá-la para impressão.');
      return;
    }

    await handlePrintPDF(savedRequisicao);
  };

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Gestão de Requisições de Compra</HeaderSubtitle>


      {/* VIEW: EDICÃO OU CRIAÇÃO DE REQUISICAO */}
      {isEditing && (
        <Card className="border-primary/20 shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <CardHeader className="bg-primary/[0.02] border-b border-border-default/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle>{editingRequisicaoId ? `Editar Requisição de Compra (${requisicaoNumber})` : 'Nova Requisição de Compra'}</CardTitle>
                <CardDescription>Preencha os dados e associe os empenhos que fundamentam a requisição.</CardDescription>
              </div>
              {editingRequisicaoId && (
                <div className="flex items-center gap-2 bg-surface-base px-3 py-1.5 rounded-radius-md border border-border-default shrink-0">
                  <span className="text-xs font-medium text-text-muted">Situação atual:</span>
                  <Badge variant="outline" className={`font-ui text-xs font-bold ${STATUS_META[editingStatus || 'draft']?.className}`}>
                    {STATUS_META[editingStatus || 'draft']?.label}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <div className="space-y-2">
                <Label>Empenho / Nota de Empenho</Label>
                <Popover open={isEmpenhoPickerOpen} onOpenChange={setIsEmpenhoPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isEmpenhoPickerOpen}
                      aria-label={selectedEmpenhoIds.length > 0 ? `${selectedEmpenhoIds.length} empenho(s) selecionado(s)` : 'Buscar e selecionar empenhos'}
                      className="min-h-10 w-full justify-between text-left font-normal"
                    >
                      <span className="truncate">
                        {selectedEmpenhoIds.length > 0
                          ? `${selectedEmpenhoIds.length} empenho(s) selecionado(s)`
                          : 'Buscar e selecionar empenhos...'}
                      </span>
                      <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[min(48rem,calc(100vw-2rem))] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        value={empenhoSearch}
                        onValueChange={setEmpenhoSearch}
                        placeholder="Buscar por número, favorecido, descrição ou valor..."
                      />
                      <CommandList className="max-h-72">
                        {filteredEmpenhos.length === 0 ? (
                          <p className="py-6 text-center text-sm">Nenhum empenho encontrado.</p>
                        ) : (
                          <CommandGroup heading="Empenhos disponíveis">
                            {filteredEmpenhos.map((empenho) => {
                              const checked = selectedEmpenhoIds.includes(empenho.id);
                              const official = getEmpenhoAvailableBalance(empenho);
                              const enviado = enviadoFornecedorTotalByEmpenhoId.get(empenho.id) ?? 0;
                              const effective = Math.max(0, official - enviado);
                              const extraLabel = enviado > 0 ? ` (Oficial: ${formatCurrency(official)} | (-) Enviado: ${formatCurrency(enviado)})` : '';
                              const label = `${empenho.numero} - saldo ${formatCurrency(effective)}${extraLabel} - ${empenho.favorecidoNome || 'Sem favorecido'} - ${empenho.descricao || ''}`;
                              return (
                                <CommandItem
                                  key={empenho.id}
                                  value={label}
                                  onSelect={() => toggleEmpenhoSelection(empenho.id)}
                                  className="gap-2"
                                >
                                  <Check className={checked ? 'h-4 w-4 opacity-100' : 'h-4 w-4 opacity-0'} />
                                  <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedEmpenhoOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5" aria-label="Empenhos selecionados">
                    {selectedEmpenhoOptions.map((option) => (
                      <Badge key={option.id} variant="secondary" className="max-w-full gap-1 pr-1">
                        <span className="max-w-[22rem] truncate" title={option.label}>{option.label}</span>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-surface-hover"
                          aria-label={`Remover ${option.label}`}
                          onClick={() => handleRemoveSelectedEmpenho(option.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
                {selectedEmpenhos.length === 0 ? (
                <div className="rounded-radius-lg border border-dashed border-border-default bg-surface-subtle/30 px-4 py-6 text-center text-sm text-text-muted">
                  Selecione ao menos um empenho para adicionar itens.
                </div>
              ) : (
                selectedEmpenhos.map((empenho) => {
                  const groupItems = items
                    .map((item, index) => ({ item, index }))
                    .filter(({ item }) => item.empenhoId === empenho.id);
                  const groupTotal = requisicaoTotalByEmpenhoId.get(empenho.id) ?? 0;
                  const officialBalance = officialBalanceByEmpenhoId.get(empenho.id) ?? getEmpenhoAvailableBalance(empenho);
                  const enviadoFornecedorTotal = enviadoFornecedorTotalByEmpenhoId.get(empenho.id) ?? 0;
                  const availableBalance = empenhoBalanceById.get(empenho.id) ?? 0;
                  const afterRequisicao = Math.max(0, availableBalance - groupTotal);
                  const empenhoItemBalances = empenhoItemBalancesById.get(empenho.id) ?? [];
                  const hasBalanceViolation = groupTotal > availableBalance;
                  const isItemBalanceReady = empenhoItemBalanceReadyById.get(empenho.id) === true;
                  const isItemBalanceError = empenhoItemBalanceErrorById.get(empenho.id) === true;

                  return (
                    <div key={empenho.id} className="space-y-3 rounded-radius-lg border border-border-default bg-surface-base p-3">
                      <div className={`flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3 rounded-radius-md ${
                        hasBalanceViolation
                          ? 'border-status-error bg-status-error/5'
                          : 'border-status-success bg-status-success/5'
                      }`}>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-bold text-text-primary">{empenho.numero}</p>
                            {enviadoFornecedorTotal > 0 && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-800" title="Possui saldo retido em requisições já enviadas ao fornecedor">
                                (-) {formatCurrency(enviadoFornecedorTotal)} em requisições enviadas
                              </Badge>
                            )}
                          </div>
                          {empenho.favorecidoNome ? (
                            <p className="text-xs text-text-muted mt-0.5">{empenho.favorecidoNome}</p>
                          ) : null}
                        </div>
                        <div className={`grid gap-3 text-right text-sm ${enviadoFornecedorTotal > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                          {enviadoFornecedorTotal > 0 && (
                            <div>
                              <p className="text-text-muted text-xs">Saldo oficial (SIAFI)</p>
                              <p className="font-mono text-xs font-semibold text-text-muted">{formatCurrency(officialBalance)}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-text-muted">Saldo disponível</p>
                            <p className="font-mono font-bold text-text-primary">{formatCurrency(availableBalance)}</p>
                          </div>
                          <div>
                            <p className={hasBalanceViolation ? 'text-status-error' : 'text-text-muted'}>Requisição</p>
                            <p className={`font-mono font-bold ${hasBalanceViolation ? 'text-status-error' : 'text-text-primary'}`}>{formatCurrency(groupTotal)}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Após requisição</p>
                            <p className="font-mono font-bold text-text-primary">{formatCurrency(afterRequisicao)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-radius-lg border border-border-default">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-surface-subtle/50">
                              <TableHead style={{ width: '4%' }} className="text-center">#</TableHead>
                              <TableHead style={{ width: '38%' }}>Descrição do Item / Serviço</TableHead>
                              <TableHead style={{ width: '10%' }} className="text-center">Und</TableHead>
                              <TableHead style={{ width: '10%' }} className="text-right">Qtd</TableHead>
                              <TableHead style={{ width: '13%' }} className="text-right">Valor Unitário</TableHead>
                              <TableHead style={{ width: '12%' }} className="text-right">Saldo do Item</TableHead>
                              <TableHead style={{ width: '10%' }} className="text-right">Subtotal</TableHead>
                              <TableHead style={{ width: '3%' }} className="text-center"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupItems.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="py-6 text-center text-text-muted">
                                  Nenhum item adicionado neste empenho.
                                </TableCell>
                              </TableRow>
                            ) : (
                              groupItems.map(({ item, index }, groupIndex) => {
                                const isGeneratedItem = item.sourceType === 'portal_transparencia_empenho_item';
                                const itemAvailableBalance = isGeneratedItem
                                  ? getRequisicaoItemAvailableBalance(item, empenhoItemBalances)
                                  : null;
                                const isProvisionalItemBalance = isGeneratedItem && !isItemBalanceReady;
                                const itemSubtotal = item.quantity * item.unitPrice;
                                const hasItemBalanceViolation = itemAvailableBalance !== null && itemSubtotal > itemAvailableBalance;
                                const quantityInputKey = item.sourceItemKey || `${item.empenhoId ?? empenho.id}-${index}`;
                                const unitPriceInputKey = item.sourceItemKey ? `${item.sourceItemKey}|price` : `${item.empenhoId ?? empenho.id}-${index}-price`;

                                return (
                                  <TableRow key={`${empenho.id}-${index}`} className={hasItemBalanceViolation ? 'bg-status-error/5' : undefined}>
                                    <TableCell className="text-center font-bold text-text-muted">{groupIndex + 1}</TableCell>
                                    <TableCell>
                                      <div className="min-w-0 whitespace-normal break-words text-sm leading-5 text-text-primary">{item.description}</div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Input
                                        value={item.unit}
                                        onChange={(e) => handleUpdateItem(index, { unit: e.target.value.toUpperCase() })}
                                        placeholder="UN"
                                        className="h-9 text-center"
                                        disabled={isGeneratedItem}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={emptyQuantityInputKeys.has(quantityInputKey) ? '' : item.quantity}
                                        onFocus={() => {
                                          if (item.quantity !== 0) return;
                                          setEmptyQuantityInputKeys((current) => new Set(current).add(quantityInputKey));
                                        }}
                                        onChange={(e) => {
                                          const rawValue = e.target.value;
                                          setEmptyQuantityInputKeys((current) => {
                                            const next = new Set(current);
                                            if (rawValue === '') next.add(quantityInputKey);
                                            else next.delete(quantityInputKey);
                                            return next;
                                          });
                                          handleUpdateItem(index, { quantity: rawValue === '' ? 0 : Number(rawValue) });
                                        }}
                                        className="h-9 text-right"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={emptyUnitPriceInputKeys.has(unitPriceInputKey) ? '' : item.unitPrice}
                                        onFocus={() => {
                                          if (item.unitPrice !== 0) return;
                                          setEmptyUnitPriceInputKeys((current) => new Set(current).add(unitPriceInputKey));
                                        }}
                                        onChange={(e) => {
                                          const rawValue = e.target.value;
                                          setEmptyUnitPriceInputKeys((current) => {
                                            const next = new Set(current);
                                            if (rawValue === '') next.add(unitPriceInputKey);
                                            else next.delete(unitPriceInputKey);
                                            return next;
                                          });
                                          handleUpdateItem(index, { unitPrice: rawValue === '' ? 0 : Number(rawValue) });
                                        }}
                                        className="h-9 text-right"
                                      />
                                    </TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-bold leading-9 ${hasItemBalanceViolation ? 'text-status-error' : 'text-status-success'}`}>
                                      {itemAvailableBalance !== null
                                        ? <span title={isProvisionalItemBalance ? 'Saldo base do subitem; as liquidações oficiais serão aplicadas quando o cache terminar.' : undefined}>
                                            {formatCurrency(itemAvailableBalance)}
                                          </span>
                                        : isGeneratedItem ? <span title={isItemBalanceError ? 'Não foi possível consultar as liquidações deste empenho' : 'O saldo detalhado será carregado após as liquidações'}>{isItemBalanceError ? 'Indisponível' : 'Carregando...'}</span> : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-text-primary leading-9">
                                      {formatCurrency(itemSubtotal)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveItem(index)}>
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="flex items-center justify-between border-t border-border-default/50 pt-4">
                <span className="font-ui text-sm font-bold uppercase tracking-wider text-text-primary">Total da requisição</span>
                <span className="font-mono text-base font-bold text-primary">{formatCurrency(requisicaoTotal)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requisicao-notes">Observações / Justificativas Técnicas</Label>
              <Textarea id="requisicao-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Descreva observações, justificativas ou detalhes complementares..." />
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 border-t border-border-default/50 pt-4">
              <Button type="button" variant="outline" onClick={handleCancelForm}>
                Voltar
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => handleSaveRequisicao('draft')}>
                  Salvar Rascunho
                </Button>
                <Button
                  type="button"
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  onClick={() => handleSaveRequisicao('enviada_fornecedor')}
                >
                  <Send className="h-4 w-4" />
                  Enviar ao Fornecedor
                </Button>
                {isFiscalOrManager && editingRequisicaoId && (
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={() => handleSaveRequisicao('liquidada')}
                  >
                    <Check className="h-4 w-4" />
                    Enviar para Pagamento
                  </Button>
                )}
                <Button
                  type="button"
                  className="bg-primary hover:bg-primary/95 text-primary-foreground"
                  onClick={() => void handlePrintAndSave()}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW: MAIN DASHBOARD */}
      {!isEditing && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <span className="font-ui text-sm font-bold text-text-primary uppercase tracking-wider">Requisições de Compra ({requisicoes.length})</span>
            </div>
            {(isTerceirizado || isSuperAdmin) && (
              <Button type="button" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5" onClick={handleNewRequisicao}>
                <Plus className="h-4 w-4" />
                Nova Requisição de Compra
              </Button>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-border-default bg-surface-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Total de Requisições</p>
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-text-primary">{requisicoes.length}</p>
            </Card>

            <Card className="border border-border-default bg-surface-card p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Rascunhos</p>
                <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">Rascunho</Badge>
              </div>
              <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
                {requisicoes.filter((r) => r.status === 'draft' || r.status === 'rejected').length}
              </p>
            </Card>

            <Card className="border border-amber-200 bg-amber-50/40 p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-900">Enviadas ao Fornecedor</p>
                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">Comprometido</Badge>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="font-mono text-2xl font-bold text-amber-950">
                  {requisicoes.filter((r) => r.status === 'enviada_fornecedor' || r.status === 'review' || r.status === 'approved').length}
                </p>
                <p className="font-mono text-xs font-bold text-amber-800">
                  {formatCurrency(
                    requisicoes
                      .filter((r) => r.status === 'enviada_fornecedor' || r.status === 'review' || r.status === 'approved')
                      .reduce((sum, r) => sum + (r.totalValue ?? 0), 0),
                  )}
                </p>
              </div>
            </Card>

            <Card className="border border-emerald-200 bg-emerald-50/40 p-4 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-900">Enviadas para Pagamento</p>
                <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-800">Enviada para Pagamento</Badge>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <p className="font-mono text-2xl font-bold text-emerald-950">
                  {requisicoes.filter((r) => r.status === 'liquidada').length}
                </p>
                <p className="font-mono text-xs font-bold text-emerald-800">
                  {formatCurrency(
                    requisicoes
                      .filter((r) => r.status === 'liquidada')
                      .reduce((sum, r) => sum + (r.totalValue ?? 0), 0),
                  )}
                </p>
              </div>
            </Card>
          </div>

          {isLoadingRequisicoes ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 border rounded-radius-lg border-border-default">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="font-ui text-sm text-text-secondary">Carregando requisições de compra...</p>
            </div>
          ) : requisicoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed rounded-radius-lg border-primary/20 bg-primary/[0.01]">
              <ClipboardList className="h-10 w-10 text-primary opacity-45" />
              <h3 className="font-ui text-base font-bold text-text-primary">Nenhuma Requisição de Compra cadastrada</h3>
              <p className="font-ui text-sm text-text-secondary max-w-sm text-center">
                {isTerceirizado || isSuperAdmin
                  ? 'Você ainda não criou requisições de compra. Clique no botão acima para registrar a sua primeira requisição.'
                  : 'Nenhum prestador terceirizado submeteu requisições de compra ainda.'}
              </p>
              {(isTerceirizado || isSuperAdmin) && (
                <Button type="button" className="bg-primary text-primary-foreground mt-2" onClick={handleNewRequisicao}>
                  Começar a Cadastrar
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-radius-lg border border-border-default bg-surface-card shadow-soft">
              <Table>
                <TableHeader>
                  <TableRow className="bg-surface-subtle/50">
                    <TableHead>Requisição</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead>Referências</TableHead>
                    <TableHead>Atualização</TableHead>
                    <TableHead className="text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisicoes.map((requisicao) => {
                    const statusInfo = STATUS_META[requisicao.status] || { label: requisicao.status, className: '' };
                    const isCreator = requisicao.createdBy === user?.id;
                    const isDraft = requisicao.status === 'draft' || requisicao.status === 'rejected';
                    const isEnviada = requisicao.status === 'enviada_fornecedor' || requisicao.status === 'review' || requisicao.status === 'approved';
                    const isLiquidada = requisicao.status === 'liquidada';

                    const requisicaoEmpenhoLabels = requisicao.empenhos?.length
                      ? requisicao.empenhos.map((empenho) => empenho.empenhoNumero).filter(Boolean)
                      : requisicao.empenhoNumero
                        ? [requisicao.empenhoNumero]
                        : [];

                    return (
                      <TableRow key={requisicao.id} className="hover:bg-surface-hover/20">
                        <TableCell className="align-top whitespace-nowrap">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="font-ui font-bold text-text-primary text-xs sm:text-sm whitespace-nowrap">{requisicao.number}</span>
                            <Badge
                              variant="outline"
                              className={`font-ui text-[10px] font-semibold px-1.5 py-0 leading-4 whitespace-nowrap shrink-0 ${statusInfo.className}`}
                            >
                              {statusInfo.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-right font-mono text-sm font-bold text-text-primary">
                          {formatCurrency(requisicao.totalValue ?? 0)}
                        </TableCell>
                        <TableCell className="align-top text-xs text-text-secondary">
                          <span className="font-semibold text-text-primary">{requisicao.createdByEmail}</span>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-1 text-xs text-text-secondary">
                            {requisicao.contratoNumero && (
                              <div className="flex gap-1.5 items-center">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>Contrato: <span className="font-bold text-text-primary">{requisicao.contratoNumero}</span></span>
                              </div>
                            )}
                            {requisicaoEmpenhoLabels.length > 0 && (
                              <div className="flex gap-1.5 items-center">
                                <Coins className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span>
                                  Empenho{requisicaoEmpenhoLabels.length > 1 ? 's' : ''}:{' '}
                                  <span className="font-bold text-text-primary">{requisicaoEmpenhoLabels.join(', ')}</span>
                                </span>
                              </div>
                            )}
                            {requisicao.processNumber && (
                              <div className="flex gap-1.5 items-center">
                                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span>Processo: <span className="font-bold text-text-primary">{requisicao.processNumber}</span></span>
                              </div>
                            )}
                            {!requisicao.contratoNumero && requisicaoEmpenhoLabels.length === 0 && !requisicao.processNumber && (
                              <span className="text-text-muted">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-xs text-text-muted">
                          {new Date(requisicao.updatedAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="align-top text-right pr-4 whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1 flex-nowrap shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              title="Imprimir Requisição em PDF"
                              aria-label={`Imprimir requisição ${requisicao.number}`}
                              onClick={() => void handlePrintPDF(requisicao)}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              title="Editar Requisição"
                              aria-label={`Editar requisição ${requisicao.number}`}
                              onClick={() => handleEditRequisicao(requisicao)}
                              className="h-8 w-8 p-0 shrink-0"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            {/* Mudança de Situação */}
                            {isFiscalOrManager && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 px-2.5 font-ui text-xs font-medium gap-1 shrink-0"
                                    title="Alterar situação"
                                    aria-label={`Alterar situação da requisição ${requisicao.number}`}
                                  >
                                    <span>Situação</span>
                                    <ChevronDown className="h-3 w-3 opacity-70" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel className="text-xs text-text-muted">Alterar situação para:</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleChangeStatus(requisicao.id, 'draft')}
                                    className="gap-2 text-xs font-medium cursor-pointer"
                                  >
                                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                                    <span>Rascunho</span>
                                    {isDraft && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangeStatus(requisicao.id, 'enviada_fornecedor')}
                                    className="gap-2 text-xs font-medium cursor-pointer text-amber-900 focus:text-amber-950 focus:bg-amber-50"
                                  >
                                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                                    <span>Enviada ao Fornecedor</span>
                                    {isEnviada && <Check className="ml-auto h-3.5 w-3.5 text-amber-600" />}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleChangeStatus(requisicao.id, 'liquidada')}
                                    className="gap-2 text-xs font-medium cursor-pointer text-emerald-900 focus:text-emerald-950 focus:bg-emerald-50"
                                  >
                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    <span>Enviada para Pagamento</span>
                                    {isLiquidada && <Check className="ml-auto h-3.5 w-3.5 text-emerald-600" />}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}

                            {/* Ações para Rascunho */}
                            {isDraft && (
                              <>
                                {!isFiscalOrManager && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="bg-amber-600 hover:bg-amber-700 text-white h-8 px-2.5 gap-1 text-xs font-semibold shrink-0"
                                    title="Enviar ao Fornecedor"
                                    aria-label={`Enviar requisição ${requisicao.number} ao fornecedor`}
                                    onClick={() => handleChangeStatus(requisicao.id, 'enviada_fornecedor')}
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    <span>Enviar</span>
                                  </Button>
                                )}
                                {(isCreator || isFiscalOrManager) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Excluir requisição ${requisicao.number}`}
                                    title="Excluir requisição"
                                    onClick={() => handleDeleteRequisicao(requisicao.id)}
                                    className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
