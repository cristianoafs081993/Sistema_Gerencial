import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ClipboardList,
  Coins,
  FileText,
  Loader2,
  Plus,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { getAuthUserMatricula, permissionMatchesAuthUser } from '@/lib/terceirizadoIdentity';
import { formatCurrency, formatarDocumento } from '@/lib/utils';
import { contratosApiService } from '@/services/contratosApi';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import type { RequisicaoCompra, RequisicaoCompraItem, RequisicaoCompraRecord } from '@/types';
import { buildContratoItemBalances } from '@/utils/contratoItemBalance';
import { getEmpenhoAvailableBalance, hasSufficientEmpenhoBalance } from '@/utils/empenhoBalance';

// Helper to translate status labels
const STATUS_META = {
  draft: { label: 'Rascunho', className: 'border-slate-300 bg-slate-50 text-slate-700' },
  review: { label: 'Em Revisão', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  approved: { label: 'Aprovada', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  rejected: { label: 'Rejeitada', className: 'border-rose-300 bg-rose-50 text-rose-800' },
};

const normalizeContractNumber = (value: string | null | undefined) =>
  String(value ?? '').replace(/\D/g, '').replace(/^0+/, '');

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
  const [selectedEmpenhoId, setSelectedEmpenhoId] = useState<string>('none');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Omit<RequisicaoCompraItem, 'id' | 'requisicaoCompraId' | 'createdAt' | 'updatedAt'>[]>([]);

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
      // Explicitly allowed empenho IDs
      const userPerms = permissions.filter(
        (p) => permissionMatchesAuthUser(p, userIdentity) && p.empenhoId
      );
      const allowedEmpenhoIds = new Set(userPerms.map((p) => p.empenhoId));

      // Empenhos linked to allowed contracts
      const allowedContractIds = new Set(allowedContracts.map((c) => c.id));
      const linkedEmpenhoIds = new Set(
        contratosEmpenhos
          .filter((ce) => allowedContractIds.has(ce.contrato_id))
          .map((ce) => ce.empenho_id)
      );

      baseEmpenhos = empenhos.filter(
        (e) => allowedEmpenhoIds.has(e.id) || linkedEmpenhoIds.has(e.id)
      );
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
    allowedContracts,
    isTerceirizado,
    isSuperAdmin,
    userIdentity,
    selectedContratoId,
  ]);

  // Selected details
  const currentContrato = useMemo(() => {
    return contratos.find((c) => c.id === selectedContratoId);
  }, [contratos, selectedContratoId]);

  const currentEmpenho = useMemo(() => {
    return empenhos.find((e) => e.id === selectedEmpenhoId);
  }, [empenhos, selectedEmpenhoId]);

  const empenhoBalance = useMemo(
    () => (currentEmpenho ? getEmpenhoAvailableBalance(currentEmpenho) : null),
    [currentEmpenho],
  );

  const { data: contratoItemBalances = [], isLoading: isLoadingContratoItems } = useQuery({
    queryKey: ['requisicao-contrato-api-items', currentContrato?.numero],
    enabled: Boolean(currentContrato?.numero),
    queryFn: async () => {
      const apiContracts = await contratosApiService.getContratosApi(false);
      const normalizedNumber = normalizeContractNumber(currentContrato?.numero);
      const apiContract = apiContracts.find(
        (contract) => normalizeContractNumber(contract.numero) === normalizedNumber,
      );
      if (!apiContract) return [];
      return buildContratoItemBalances(await contratosApiService.getContratoApiDetails(apiContract.id));
    },
  });

  // Handlers for adding/removing items in form
  const handleAddItem = () => {
    setItems((curr) => [
      ...curr,
      {
        description: '',
        quantity: 1,
        unit: 'UN',
        unitPrice: 0,
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

  // Start creating new Requisição
  const handleNewRequisicao = () => {
    setEditingRequisicaoId(undefined);
    setRequisicaoNumber(`REQ-${new Date().getFullYear()}-${String(requisicoes.length + 1).padStart(4, '0')}`);
    setProcessNumber('');
    setSelectedContratoId('none');
    setSelectedEmpenhoId('none');
    setNotes('');
    setItems([
      {
        description: 'Aquisição de material/serviço conforme especificações',
        quantity: 1,
        unit: 'UN',
        unitPrice: 0,
        sortOrder: 0,
      },
    ]);
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
      setSelectedEmpenhoId(fullRequisicao.empenhoId || 'none');
      setNotes(fullRequisicao.notes || '');
      setItems(fullRequisicao.items);
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

    if (status === 'review' && !currentEmpenho) {
      toast.error('Selecione um empenho antes de enviar a requisição para o fiscal.');
      return;
    }
    if (status === 'review' && currentEmpenho && !hasSufficientEmpenhoBalance(currentEmpenho, requisicaoTotal)) {
      toast.error(`Saldo insuficiente no empenho. Saldo atual: ${formatCurrency(empenhoBalance || 0)}.`);
      return;
    }

    const payload = {
      title: `Requisição de Compra ${requisicaoNumber}`,
      number: requisicaoNumber,
      processNumber: processNumber || undefined,
      contratoId: selectedContratoId !== 'none' ? selectedContratoId : undefined,
      contratoNumero: currentContrato?.numero,
      empenhoId: selectedEmpenhoId !== 'none' ? selectedEmpenhoId : undefined,
      empenhoNumero: currentEmpenho?.numero,
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
      const empenhoInfo = empenhos.find((e) => e.id === fullRequisicao.empenhoId);

      const itemsHtml = fullRequisicao.items
        .map(
          (item, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
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
            <strong>Empenho / NE:</strong> ${
              empenhoInfo ? `${empenhoInfo.numero} (Favorecido: ${empenhoInfo.favorecidoNome || '-'})` : fullRequisicao.empenhoNumero || '-'
            }<br />
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
              <th style="width: 55%;">Descrição dos Itens / Serviços</th>
              <th style="width: 10%; text-align: center;">Unid.</th>
              <th style="width: 10%; text-align: right;">Qtd.</th>
              <th style="width: 10%; text-align: right;">Preço Unitário</th>
              <th style="width: 10%; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="total-row">
              <td colspan="5" style="text-align: right;">Valor Total da Requisição de Compra:</td>
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
                <Select value={selectedEmpenhoId} onValueChange={(val) => setSelectedEmpenhoId(val)}>
                  <SelectTrigger aria-label="Empenho"><SelectValue placeholder="Selecione um empenho..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum empenho</SelectItem>
                    {allowedEmpenhos.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.numero} - saldo {formatCurrency(getEmpenhoAvailableBalance(e))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currentEmpenho ? (
              <div className={`flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3 ${
                requisicaoTotal > (empenhoBalance || 0)
                  ? 'border-status-danger bg-status-danger/5'
                  : 'border-status-success bg-status-success/5'
              }`}>
                <div>
                  <p className="text-xs font-semibold uppercase text-text-muted">Saldo disponível do empenho</p>
                  <p className="mt-1 font-mono text-lg font-bold text-text-primary">{formatCurrency(empenhoBalance || 0)}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-text-muted">Após esta requisição</p>
                  <p className="font-mono font-bold text-text-primary">
                    {formatCurrency(Math.max(0, (empenhoBalance || 0) - requisicaoTotal))}
                  </p>
                </div>
              </div>
            ) : null}

            {currentContrato ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Saldo contratual por item</h3>
                    <p className="text-xs text-text-muted">Contratado menos faturas pagas ou apropriadas no SIAFI com item vinculado.</p>
                  </div>
                  {isLoadingContratoItems ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                </div>
                {!isLoadingContratoItems && contratoItemBalances.length > 0 ? (
                  <div className="overflow-x-auto border-y border-border-default">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Contratado</TableHead>
                          <TableHead className="text-right">Executado</TableHead>
                          <TableHead className="text-right">Saldo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contratoItemBalances.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <p className="font-medium">Item {item.number}</p>
                              <p className="max-w-xl text-xs text-text-muted">{item.description}</p>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.contracted)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.executed)}</TableCell>
                            <TableCell className="text-right font-bold text-status-success">{formatCurrency(item.available)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : !isLoadingContratoItems ? (
                  <p className="border-y border-border-default py-3 text-sm text-text-muted">
                    A API de Contratos não retornou itens vinculados para este contrato.
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* INTERACTIVE ITEMS TABLE */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-default/50 pb-2">
                <h3 className="font-ui text-sm font-bold text-text-primary uppercase tracking-wider">Itens e Serviços Requisitados</h3>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 border-primary text-primary hover:bg-primary/5" onClick={handleAddItem}>
                  <Plus className="h-4 w-4" />
                  Adicionar Item
                </Button>
              </div>

              <div className="border border-border-default rounded-radius-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-subtle/50">
                      <TableHead style={{ width: '4%' }} className="text-center">#</TableHead>
                      <TableHead style={{ width: '50%' }}>Descrição do Item / Serviço</TableHead>
                      <TableHead style={{ width: '10%' }} className="text-center">Und</TableHead>
                      <TableHead style={{ width: '10%' }} className="text-right">Qtd</TableHead>
                      <TableHead style={{ width: '13%' }} className="text-right">Valor Unitário</TableHead>
                      <TableHead style={{ width: '10%' }} className="text-right">Subtotal</TableHead>
                      <TableHead style={{ width: '3%' }} className="text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-text-muted py-6">
                          Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-center font-bold text-text-muted">{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={item.description}
                              onChange={(e) => handleUpdateItem(index, { description: e.target.value })}
                              placeholder="Ex: Material ou serviço específico"
                              className="h-9"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(index, { unit: e.target.value.toUpperCase() })}
                              placeholder="UN"
                              className="h-9 text-center"
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
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-text-primary leading-9">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => handleRemoveItem(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="bg-primary/[0.02] hover:bg-primary/[0.02] border-t border-border-default">
                      <TableCell colSpan={5} className="text-right font-ui text-sm font-bold text-text-primary">
                        Total Geral da Requisição:
                      </TableCell>
                      <TableCell className="text-right font-mono text-base font-black text-primary" colSpan={2}>
                        {formatCurrency(requisicaoTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
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
                  disabled={!currentEmpenho || requisicaoTotal > (empenhoBalance || 0)}
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {requisicoes.map((requisicao) => {
                const statusInfo = STATUS_META[requisicao.status] || { label: requisicao.status, className: '' };
                const isCreator = requisicao.createdBy === user?.id;

                return (
                  <Card key={requisicao.id} className="border-border-default bg-surface-card shadow-soft hover:shadow-card hover:-translate-y-[1px] transition-all duration-200 flex flex-col justify-between">
                    <CardHeader className="pb-3 gap-2">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className={`font-ui text-xs font-bold ${statusInfo.className}`}>
                          {statusInfo.label}
                        </Badge>
                        <span className="font-ui text-[10px] text-text-muted">
                          {new Date(requisicao.updatedAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div>
                        <CardTitle className="font-ui text-lg tracking-tight text-text-primary">{requisicao.number}</CardTitle>
                        <CardDescription className="text-text-muted mt-1 leading-normal font-ui text-xs">
                          Criado por: <span className="font-bold text-text-primary">{requisicao.createdByEmail}</span>
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      <div className="border-t border-border-default/50 pt-3 space-y-2 text-xs font-ui text-text-secondary leading-relaxed">
                        {requisicao.contratoNumero && (
                          <div className="flex gap-1.5 items-start">
                            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <span>Contrato: <span className="font-bold text-text-primary">{requisicao.contratoNumero}</span></span>
                          </div>
                        )}
                        {requisicao.empenhoNumero && (
                          <div className="flex gap-1.5 items-start">
                            <Coins className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span>Empenho: <span className="font-bold text-text-primary">{requisicao.empenhoNumero}</span></span>
                          </div>
                        )}
                        {requisicao.processNumber && (
                          <div className="flex gap-1.5 items-start">
                            <FileText className="h-4 w-4 text-sebrae-blue shrink-0 mt-0.5" />
                            <span>Processo: <span className="font-bold text-text-primary">{requisicao.processNumber}</span></span>
                          </div>
                        )}
                      </div>

                      {requisicao.notes && (
                        <div className="bg-surface-subtle/50 p-2.5 rounded-radius-md text-xs text-text-secondary border border-border-default/50 line-clamp-2 leading-normal">
                          {requisicao.notes}
                        </div>
                      )}

                      {/* ACTIONS */}
                      <div className="flex flex-wrap items-center justify-between border-t border-border-default/50 pt-3 gap-2">
                        <div className="flex gap-1">
                          <Button type="button" variant="outline" size="sm" title="Imprimir Requisição em PDF" onClick={() => void handlePrintPDF(requisicao)} className="h-9 px-2">
                            <Printer className="h-4 w-4" />
                          </Button>
                          {isCreator && (requisicao.status === 'draft' || requisicao.status === 'rejected') && (
                            <>
                              <Button type="button" variant="outline" size="sm" onClick={() => handleEditRequisicao(requisicao)} className="h-9 px-3">
                                Editar
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteRequisicao(requisicao.id)} className="h-9 px-2 text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {!isCreator && isFiscalOrManager && (requisicao.status === 'review') && (
                            <Button type="button" variant="outline" size="sm" onClick={() => handleEditRequisicao(requisicao)} className="h-9 px-3">
                              Visualizar e Editar
                            </Button>
                          )}
                        </div>

                        {/* Fiscal action badges */}
                        {isFiscalOrManager && requisicao.status === 'review' && (
                          <div className="flex gap-1">
                            <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 px-2" title="Aprovar Requisição" onClick={() => handleChangeStatus(requisicao.id, 'approved')}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="sm" className="bg-rose-600 hover:bg-rose-700 text-white h-9 px-2" title="Rejeitar Requisição" onClick={() => handleChangeStatus(requisicao.id, 'rejected')}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
