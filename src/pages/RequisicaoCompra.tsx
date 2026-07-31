import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ClipboardList,
  Coins,
  FileText,
  Loader2,
  Plus,
  Pencil,
  Printer,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderSubtitle } from '@/components/HeaderParts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { getAuthUserMatricula, permissionMatchesAuthUser } from '@/lib/terceirizadoIdentity';
import { formatCurrency, formatarDocumento } from '@/lib/utils';
import { contratosApiService } from '@/services/contratosApi';
import { transparenciaService, type PortalTransparenciaItemEmpenho } from '@/services/transparencia';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import type { RequisicaoCompra, RequisicaoCompraItem, RequisicaoCompraRecord } from '@/types';
import { getEmpenhoAvailableBalance } from '@/utils/empenhoBalance';
import {
  buildEmpenhoItemBalances,
  buildRequisicaoItemsFromEmpenho,
  getRequisicaoItemAvailableBalance,
} from '@/utils/requisicaoEmpenhoItems';

// Helper to translate status labels
const STATUS_META = {
  draft: { label: 'Rascunho', className: 'border-slate-300 bg-slate-50 text-slate-700' },
  review: { label: 'Em Revisão', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  approved: { label: 'Aprovada', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Rejeitada', className: 'border-rose-300 bg-rose-50 text-rose-800' },
};


export default function RequisicaoCompraPage() {
  const queryClient = useQueryClient();
  const { user, userGroups, isSuperAdmin } = useAuth();
  const { empenhos = [], contratos = [], contratosEmpenhos = [] } = useData();
  const userMatricula = getAuthUserMatricula(user);
  const userIdentity = useMemo(
    () => ({
      id: user?.id,
      email: user?.email,
      user_metadata: { matricula: userMatricula },
    }),
    [user?.id, user?.email, userMatricula],
  );

  // Roles verification
  const isTerceirizado = useMemo(() => userGroups.some((g) => g.slug === 'terceirizado'), [userGroups]);
  const isFiscalOrManager = useMemo(() => {
    return (
      isSuperAdmin ||
      userGroups.some((g) => g.slug === 'fiscal-contratos' || g.slug === 'diretores' || g.slug === 'teste')
    );
  }, [userGroups, isSuperAdmin]);


  // Form & Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingRequisicaoId, setEditingRequisicaoId] = useState<string | undefined>();
  const [requisicaoNumber, setRequisicaoNumber] = useState('');
  const [processNumber, setProcessNumber] = useState('');
  const [selectedContratoId, setSelectedContratoId] = useState<string>('none');
  const [selectedEmpenhoIds, setSelectedEmpenhoIds] = useState<string[]>([]);
  const [isEmpenhoPickerOpen, setIsEmpenhoPickerOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Omit<RequisicaoCompraItem, 'id' | 'requisicaoCompraId' | 'createdAt' | 'updatedAt'>[]>([]);
  const [pendingAutoFillEmpenhoIds, setPendingAutoFillEmpenhoIds] = useState<string[]>([]);

  // Queries
  const { data: requisicoes = [], isLoading: isLoadingRequisicoes } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => requisicoesCompraService.listRecentRequisicoes(),
  });

  const { data: permissions = [] } = useQuery({
    queryKey: ['terceirizado-permissions'],
    queryFn: () => requisicoesCompraService.listPermissions(),
  });


  // Filter allowed Contracts and Empenhos for Terceirizado
  const allowedContracts = useMemo(() => {
    if (!isTerceirizado || isSuperAdmin) return contratos;
    const userPerms = permissions.filter(
      (p) => permissionMatchesAuthUser(p, userIdentity) && p.contratoId
    );
    const allowedIds = userPerms.map((p) => p.contratoId);
    return contratos.filter((c) => allowedIds.includes(c.id));
  }, [contratos, permissions, isTerceirizado, isSuperAdmin, userIdentity]);

  const allowedEmpenhos = useMemo(() => {
    let baseEmpenhos = empenhos;

    if (isTerceirizado && !isSuperAdmin) {
      const userPerms = permissions.filter(
        (p) => permissionMatchesAuthUser(p, userIdentity) && p.empenhoId
      );
      const allowedEmpenhoIds = new Set(userPerms.map((p) => p.empenhoId));
      baseEmpenhos = empenhos.filter((e) => allowedEmpenhoIds.has(e.id));
    }

    // Filter by selected contract if active
    if (selectedContratoId && selectedContratoId !== 'none') {
      const linkedToSelectedIds = new Set(
        contratosEmpenhos
          .filter((ce) => ce.contrato_id === selectedContratoId)
          .map((ce) => ce.empenho_id)
      );
      return baseEmpenhos.filter((e) => linkedToSelectedIds.has(e.id));
    }

    return baseEmpenhos;
  }, [
    empenhos,
    contratosEmpenhos,
    permissions,
    isTerceirizado,
    isSuperAdmin,
    userIdentity,
    selectedContratoId,
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

  // Selected details
  const currentContrato = useMemo(() => {
    return contratos.find((c) => c.id === selectedContratoId);
  }, [contratos, selectedContratoId]);

  const selectedEmpenhos = useMemo(
    () => selectedEmpenhoIds
      .map((id) => empenhos.find((empenho) => empenho.id === id))
      .filter((empenho): empenho is NonNullable<typeof empenho> => Boolean(empenho)),
    [empenhos, selectedEmpenhoIds],
  );

  const primaryEmpenho = selectedEmpenhos[0];

  const selectedEmpenhoOptions = useMemo(() => {
    const selectedIds = new Set(selectedEmpenhoIds);
    return allowedEmpenhos
      .filter((empenho) => selectedIds.has(empenho.id))
      .map((empenho) => ({
        id: empenho.id,
        label: `${empenho.numero} - saldo ${formatCurrency(getEmpenhoAvailableBalance(empenho))}`,
      }));
  }, [allowedEmpenhos, selectedEmpenhoIds]);

  const portalEmpenhoItemQueries = useQueries({
    queries: selectedEmpenhos.map((empenho) => ({
      queryKey: ['requisicao-portal-itens-empenho', empenho.numero],
      queryFn: () => transparenciaService.getItensEmpenhoPortal(empenho.numero, { includeHistorico: true }),
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

  const reservedReviewItemQueries = useQueries({
    queries: selectedEmpenhos.map((empenho) => ({
      queryKey: ['requisicao-review-item-reservations', empenho.id, editingRequisicaoId],
      queryFn: () => requisicoesCompraService.getReviewItemReservations(empenho.id, editingRequisicaoId),
      retry: false,
    })),
  });

  const empenhoBalanceById = useMemo(() => {
    return new Map(selectedEmpenhos.map((empenho) => [empenho.id, getEmpenhoAvailableBalance(empenho)]));
  }, [selectedEmpenhos]);

  const empenhoItemBalancesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof buildEmpenhoItemBalances>>();
    selectedEmpenhos.forEach((empenho, index) => {
      map.set(
        empenho.id,
        buildEmpenhoItemBalances(
          empenho.numero,
          (portalEmpenhoItemQueries[index]?.data ?? []) as PortalTransparenciaItemEmpenho[],
          liquidacoesEmpenhoQueries[index]?.data ?? [],
          reservedReviewItemQueries[index]?.data ?? {},
        ),
      );
    });
    return map;
  }, [liquidacoesEmpenhoQueries, portalEmpenhoItemQueries, reservedReviewItemQueries, selectedEmpenhos]);

  useEffect(() => {
    if (!isEditing || editingRequisicaoId || pendingAutoFillEmpenhoIds.length === 0) return;

    const nextPending: string[] = [];
    const additions: typeof items = [];

    pendingAutoFillEmpenhoIds.forEach((empenhoId) => {
      const empenhoIndex = selectedEmpenhos.findIndex((empenho) => empenho.id === empenhoId);
      const empenho = selectedEmpenhos[empenhoIndex];
      if (!empenho) return;

      const isLoading = portalEmpenhoItemQueries[empenhoIndex]?.isLoading || liquidacoesEmpenhoQueries[empenhoIndex]?.isLoading;
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
          quantity: 1,
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

  // Handlers for adding/removing items in form
  const handleAddItem = (empenhoId?: string) => {
    const empenho = selectedEmpenhos.find((item) => item.id === empenhoId) ?? primaryEmpenho;
    if (!empenho) return;

    setItems((curr) => [
      ...curr,
      {
        description: '',
        quantity: 1,
        unit: 'UN',
        unitPrice: 0,
        empenhoId: empenho.id,
        empenhoNumero: empenho.numero,
        sourceType: 'manual',
        sortOrder: curr.length,
      },
    ]);
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
        const available = getRequisicaoItemAvailableBalance(item, item.empenhoId ? empenhoItemBalancesById.get(item.empenhoId) ?? [] : []);
        const requested = item.quantity * item.unitPrice;
        return available !== null && requested > available
          ? { index, description: item.description, requested, available }
          : null;
      })
      .filter((item): item is { index: number; description: string; requested: number; available: number } => Boolean(item));
  }, [empenhoItemBalancesById, items]);

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

  const canSubmitForReview =
    selectedEmpenhos.length > 0 &&
    items.every((item) => item.empenhoId && selectedEmpenhoIds.includes(item.empenhoId)) &&
    empenhoBalanceViolations.length === 0 &&
    itemBalanceViolations.length === 0;

  // Start creating new Requisição
  const handleNewRequisicao = () => {
    setEditingRequisicaoId(undefined);
    setRequisicaoNumber(`REQ-${new Date().getFullYear()}-${String(requisicoes.length + 1).padStart(4, '0')}`);
    setProcessNumber('');
    setSelectedContratoId('none');
    setSelectedEmpenhoIds([]);
    setIsEmpenhoPickerOpen(false);
    setNotes('');
    setItems([]);
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
      setRequisicaoNumber(fullRequisicao.number);
      setProcessNumber(fullRequisicao.processNumber || '');
      setSelectedContratoId(fullRequisicao.contratoId || 'none');
      const requisicaoEmpenhoIds = (fullRequisicao.empenhos?.length
        ? fullRequisicao.empenhos.map((empenho) => empenho.empenhoId)
        : fullRequisicao.empenhoId
          ? [fullRequisicao.empenhoId]
          : []
      ).filter(Boolean);
      setSelectedEmpenhoIds(requisicaoEmpenhoIds);
      setNotes(fullRequisicao.notes || '');
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
  };

  // Save Requisição
  const handleSaveRequisicao = async (status: RequisicaoCompra['status'] = 'draft') => {
    if (!requisicaoNumber.trim()) {
      toast.error('Informe o número da Requisição de Compra.');
      return;
    }
    if (items.length === 0) {
      toast.error('Adicione pelo menos um item à Requisição de Compra.');
      return;
    }
    if (items.some((i) => !i.description.trim() || i.quantity <= 0 || i.unitPrice < 0)) {
      toast.error('Revise os itens. Todos devem conter descrição, quantidade positiva e preço válido.');
      return;
    }

    if (status === 'review' && selectedEmpenhos.length === 0) {
      toast.error('Selecione um empenho antes de enviar a requisição para o fiscal.');
      return;
    }
    if (status === 'review' && items.some((item) => !item.empenhoId || !selectedEmpenhoIds.includes(item.empenhoId))) {
      toast.error('Cada item deve estar vinculado a um empenho selecionado.');
      return;
    }

    if (status === 'review' && empenhoBalanceViolations.length > 0) {
      const firstViolation = empenhoBalanceViolations[0];
      toast.error(`Saldo insuficiente no empenho ${firstViolation.empenho.numero}. Saldo atual: ${formatCurrency(firstViolation.available)}.`);
      return;
    }

    if (status === 'review' && itemBalanceViolations.length > 0) {
      const firstViolation = itemBalanceViolations[0];
      toast.error(`Saldo insuficiente no item ${firstViolation.index + 1}. Saldo do item: ${formatCurrency(firstViolation.available)}.`);
      return;
    }
    const selectedPayloadEmpenhos = selectedEmpenhos.map((empenho, index) => ({
      empenhoId: empenho.id,
      empenhoNumero: empenho.numero,
      sortOrder: index,
    }));
    const payload = {
      title: `Requisição de Compra ${requisicaoNumber}`,
      number: requisicaoNumber,
      processNumber: processNumber || undefined,
      contratoId: selectedContratoId !== 'none' ? selectedContratoId : undefined,
      contratoNumero: currentContrato?.numero,
      empenhoId: primaryEmpenho?.id,
      empenhoNumero: primaryEmpenho?.numero,
      empenhos: selectedPayloadEmpenhos,
      notes: notes || undefined,
      status,
    };

    const loadingToast = toast.loading('Salvando requisição de compra...');
    try {
      await requisicoesCompraService.saveRequisicao(payload, items, { id: editingRequisicaoId, status });
      toast.success(status === 'review' ? 'Requisição enviada para revisão.' : 'Requisição salva com sucesso.', { id: loadingToast });
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar Requisição de Compra.';
      toast.error(message, { id: loadingToast });
    }
  };

  // Change Status (Fiscal approved / rejected)
  const handleChangeStatus = async (requisicaoId: string, status: RequisicaoCompra['status']) => {
    const loadingToast = toast.loading('Atualizando situação da requisição...');
    try {
      const fullRequisicao = await requisicoesCompraService.getRequisicaoById(requisicaoId);
      if (!fullRequisicao) throw new Error('Requisição não localizada.');

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

      toast.success(`Situação atualizada para: ${STATUS_META[status].label}`, { id: loadingToast });
      void queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
    } catch (err) {
      toast.error('Não foi possível alterar a situação.', { id: loadingToast });
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
      toast.error('Falha ao excluir.', { id: loadingToast });
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

      const itemsHtml = fullRequisicao.items
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

      const totalValue = fullRequisicao.items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

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
          <div class="sub">Sistema de Gestão Orçamentária e Contratos - GovAnalytics</div>
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

  return (
    <div className="space-y-6 pb-10">
      <HeaderSubtitle>Gestão de Requisições de Compra</HeaderSubtitle>


      {/* VIEW: EDICÃO OU CRIAÇÃO DE REQUISICAO */}
      {isEditing && (
        <Card className="border-primary/20 shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <CardHeader className="bg-primary/[0.02] border-b border-border-default/50">
            <CardTitle>{editingRequisicaoId ? 'Editar Requisição de Compra' : 'Nova Requisição de Compra'}</CardTitle>
            <CardDescription>Preencha os dados e associe as referências de contrato e empenho.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="requisicao-number">Número da Requisição</Label>
                <Input id="requisicao-number" value={requisicaoNumber} onChange={(e) => setRequisicaoNumber(e.target.value)} placeholder="REQ-2026-0001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requisicao-process">Número do Processo (Opcional)</Label>
                <Input id="requisicao-process" value={processNumber} onChange={(e) => setProcessNumber(e.target.value)} placeholder="23035.XXXXXX/2026-XX" />
              </div>
              <div className="space-y-2">
                <Label>Contrato Permitido</Label>
                <Select value={selectedContratoId} onValueChange={(val) => setSelectedContratoId(val)}>
                  <SelectTrigger aria-label="Contrato"><SelectValue placeholder="Selecione um contrato..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum contrato</SelectItem>
                    {allowedContracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero} - {c.contratada}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Filtrar por número, favorecido, descrição ou valor..." />
                      <CommandList className="max-h-72">
                        <CommandEmpty>Nenhum empenho encontrado.</CommandEmpty>
                        <CommandGroup heading="Empenhos disponíveis">
                          {allowedEmpenhos.map((empenho) => {
                            const checked = selectedEmpenhoIds.includes(empenho.id);
                            const label = `${empenho.numero} - saldo ${formatCurrency(getEmpenhoAvailableBalance(empenho))} - ${empenho.favorecidoNome || 'Sem favorecido'} - ${empenho.descricao || ''}`;
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
              <div className="flex items-center justify-between border-b border-border-default/50 pb-2">
                <h3 className="font-ui text-sm font-bold text-text-primary uppercase tracking-wider">Itens e Serviços Requisitados</h3>
                <span className="font-mono text-sm font-bold text-primary">{formatCurrency(requisicaoTotal)}</span>
              </div>

              {selectedEmpenhos.length === 0 ? (
                <div className="rounded-radius-lg border border-dashed border-border-default bg-surface-subtle/30 px-4 py-6 text-center text-sm text-text-muted">
                  Selecione ao menos um empenho para adicionar itens.
                </div>
              ) : (
                selectedEmpenhos.map((empenho, empenhoIndex) => {
                  const groupItems = items
                    .map((item, index) => ({ item, index }))
                    .filter(({ item }) => item.empenhoId === empenho.id);
                  const groupTotal = requisicaoTotalByEmpenhoId.get(empenho.id) ?? 0;
                  const availableBalance = empenhoBalanceById.get(empenho.id) ?? 0;
                  const afterRequisicao = Math.max(0, availableBalance - groupTotal);
                  const isLoadingPortalItems = portalEmpenhoItemQueries[empenhoIndex]?.isLoading ?? false;
                  const isLoadingLiquidacoes = liquidacoesEmpenhoQueries[empenhoIndex]?.isLoading ?? false;
                  const isPortalItemsError = portalEmpenhoItemQueries[empenhoIndex]?.isError ?? false;
                  const portalItems = (portalEmpenhoItemQueries[empenhoIndex]?.data ?? []) as PortalTransparenciaItemEmpenho[];
                  const empenhoItemBalances = empenhoItemBalancesById.get(empenho.id) ?? [];
                  const hasBalanceViolation = groupTotal > availableBalance;

                  return (
                    <div key={empenho.id} className="space-y-3 rounded-radius-lg border border-border-default bg-surface-base p-3">
                      <div className={`flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3 ${
                        hasBalanceViolation
                          ? 'border-status-danger bg-status-danger/5'
                          : 'border-status-success bg-status-success/5'
                      }`}>
                        <div>
                          <p className="text-xs font-semibold uppercase text-text-muted">Empenho / NE</p>
                          <p className="mt-1 font-mono text-sm font-bold text-text-primary">{empenho.numero}</p>
                          {empenho.favorecidoNome ? (
                            <p className="text-xs text-text-muted">{empenho.favorecidoNome}</p>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-right text-sm sm:grid-cols-3">
                          <div>
                            <p className="text-text-muted">Saldo disponível</p>
                            <p className="font-mono font-bold text-text-primary">{formatCurrency(availableBalance)}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Nesta NE</p>
                            <p className="font-mono font-bold text-text-primary">{formatCurrency(groupTotal)}</p>
                          </div>
                          <div>
                            <p className="text-text-muted">Após requisição</p>
                            <p className="font-mono font-bold text-text-primary">{formatCurrency(afterRequisicao)}</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 rounded-radius-lg border border-border-default bg-surface-subtle/30 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-text-primary">Itens do empenho {empenho.numero}</h4>
                            <p className="text-xs text-text-muted">
                              Os subitens vêm da NE e os saldos consideram liquidações e requisições em revisão para este empenho.
                            </p>
                          </div>
                          {(isLoadingPortalItems || isLoadingLiquidacoes) ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                        </div>
                        {isPortalItemsError ? (
                          <p className="text-sm text-status-warning">Não foi possível carregar os subitens deste empenho agora. Cadastre os itens manualmente, se necessário.</p>
                        ) : !isLoadingPortalItems && portalItems.length === 0 ? (
                          <p className="text-sm text-text-muted">Nenhum subitem foi encontrado para este empenho. O cadastro manual permanece disponível.</p>
                        ) : null}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-primary text-primary hover:bg-primary/5"
                          onClick={() => handleAddItem(empenho.id)}
                        >
                          <Plus className="h-4 w-4" />
                          Adicionar Item
                        </Button>
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
                                const itemAvailableBalance = getRequisicaoItemAvailableBalance(item, empenhoItemBalances);
                                const itemSubtotal = item.quantity * item.unitPrice;
                                const isGeneratedItem = item.sourceType === 'portal_transparencia_empenho_item';
                                const hasItemBalanceViolation = itemAvailableBalance !== null && itemSubtotal > itemAvailableBalance;

                                return (
                                  <TableRow key={`${empenho.id}-${index}`} className={hasItemBalanceViolation ? 'bg-status-danger/5' : undefined}>
                                    <TableCell className="text-center font-bold text-text-muted">{groupIndex + 1}</TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <Input
                                          value={item.description}
                                          onChange={(e) => handleUpdateItem(index, { description: e.target.value })}
                                          placeholder="Ex: Material ou serviço específico"
                                          className="h-9"
                                          disabled={isGeneratedItem}
                                        />
                                        {item.sourceReference ? (
                                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                                            <Badge variant="outline" className="text-[10px]">Subitem da NE</Badge>
                                            <span>{item.sourceReference}</span>
                                          </div>
                                        ) : null}
                                      </div>
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
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItem(index, { quantity: Number(e.target.value) })}
                                        className="h-9 text-right"
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={item.unitPrice}
                                        onChange={(e) => handleUpdateItem(index, { unitPrice: Number(e.target.value) })}
                                        className="h-9 text-right"
                                        disabled={isGeneratedItem}
                                      />
                                    </TableCell>
                                    <TableCell className={`text-right font-mono text-xs font-bold leading-9 ${hasItemBalanceViolation ? 'text-status-danger' : 'text-status-success'}`}>
                                      {itemAvailableBalance !== null ? formatCurrency(itemAvailableBalance) : '-'}
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="requisicao-notes">Observações / Justificativas Técnicas</Label>
              <Textarea id="requisicao-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Descreva observações, justificativas ou detalhes complementares..." />
            </div>

            <div className="flex justify-between items-center border-t border-border-default/50 pt-4">
              <Button type="button" variant="outline" onClick={handleCancelForm}>
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => handleSaveRequisicao('draft')}>
                  Salvar Rascunho
                </Button>
                <Button
                  type="button"
                  className="bg-primary hover:bg-primary/95 text-primary-foreground"
                  disabled={!canSubmitForReview}
                  onClick={() => handleSaveRequisicao('review')}
                >
                  Enviar para Fiscal
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
                  : 'Nenhum prestador terceirizado submeteu requisições de compra para revisão ainda.'}
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
                    <TableHead>Situação</TableHead>
                    <TableHead>Requisição</TableHead>
                    <TableHead>Criado por</TableHead>
                    <TableHead>Referências</TableHead>
                    <TableHead>Atualização</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right pr-6">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requisicoes.map((requisicao) => {
                    const statusInfo = STATUS_META[requisicao.status] || { label: requisicao.status, className: '' };
                    const isCreator = requisicao.createdBy === user?.id;
                    const requisicaoEmpenhoLabels = requisicao.empenhos?.length
                      ? requisicao.empenhos.map((empenho) => empenho.empenhoNumero).filter(Boolean)
                      : requisicao.empenhoNumero
                        ? [requisicao.empenhoNumero]
                        : [];

                    return (
                      <TableRow key={requisicao.id} className="hover:bg-surface-hover/20">
                        <TableCell className="align-top">
                          <Badge variant="outline" className={`font-ui text-xs font-bold ${statusInfo.className}`}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="font-ui font-bold text-text-primary">{requisicao.number}</div>
                          {requisicao.title && (
                            <div className="mt-1 max-w-[18rem] truncate text-xs text-text-muted" title={requisicao.title}>
                              {requisicao.title}
                            </div>
                          )}
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
                                <FileText className="h-3.5 w-3.5 text-sebrae-blue shrink-0" />
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
                        <TableCell className="align-top text-xs text-text-secondary">
                          {requisicao.notes ? (
                            <span className="line-clamp-2 block max-w-[18rem]" title={requisicao.notes}>{requisicao.notes}</span>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right pr-6">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              title="Imprimir Requisição em PDF"
                              aria-label={`Imprimir requisição ${requisicao.number}`}
                              onClick={() => void handlePrintPDF(requisicao)}
                              className="h-8 px-2"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {isCreator && (requisicao.status === 'draft' || requisicao.status === 'rejected') && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  title="Editar Requisição"
                                  aria-label={`Editar requisição ${requisicao.number}`}
                                  onClick={() => handleEditRequisicao(requisicao)}
                                  className="h-8 px-2"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Excluir requisição ${requisicao.number}`}
                                  onClick={() => handleDeleteRequisicao(requisicao.id)}
                                  className="h-8 px-2 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {!isCreator && isFiscalOrManager && requisicao.status === 'review' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                title="Visualizar e Editar"
                                aria-label={`Visualizar e editar requisição ${requisicao.number}`}
                                onClick={() => handleEditRequisicao(requisicao)}
                                className="h-8 px-2"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {isFiscalOrManager && requisicao.status === 'review' && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-2"
                                  title="Aprovar Requisição"
                                  aria-label={`Aprovar requisição ${requisicao.number}`}
                                  onClick={() => handleChangeStatus(requisicao.id, 'approved')}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-rose-600 hover:bg-rose-700 text-white h-8 px-2"
                                  title="Rejeitar Requisição"
                                  aria-label={`Rejeitar requisição ${requisicao.number}`}
                                  onClick={() => handleChangeStatus(requisicao.id, 'rejected')}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
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
