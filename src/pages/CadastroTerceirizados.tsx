import { useEffect, useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import { normalizeMatricula, permissionMatchesTerceirizado } from '@/lib/terceirizadoIdentity';
import type { Terceirizado, TerceirizadoPermission } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserPlus,
  Check,
  ShieldCheck,
  Trash2,
  Edit,
  Plus,
  Loader2,
  Lock,
  X,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';

export default function CadastroTerceirizadosPage() {
  const { empenhos = [], contratos = [] } = useData();

  // State
  const [terceirizados, setTerceirizados] = useState<Terceirizado[]>([]);
  const [permissions, setPermissions] = useState<TerceirizadoPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [editingTerceirizadoId, setEditingTerceirizadoId] = useState<string | undefined>();
  const [name, setName] = useState('');
  const [matricula, setMatricula] = useState('');
  const [tipo, setTipo] = useState<'limpeza_manutencao' | 'refeitorio'>('refeitorio');

  // Full-page edit + permissions state
  const [selectedTerceirizado, setSelectedTerceirizado] = useState<Terceirizado | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [permissionType, setPermissionType] = useState<'contrato' | 'empenho'>('empenho');
  const [permissionTargetId, setPermissionTargetId] = useState<string>('');
  const [selectedPermissionEmpenhoIds, setSelectedPermissionEmpenhoIds] = useState<string[]>([]);
  const [isPermissionEmpenhoPickerOpen, setIsPermissionEmpenhoPickerOpen] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tcList, permList] = await Promise.all([
        requisicoesCompraService.listTerceirizados(),
        requisicoesCompraService.listPermissions(),
      ]);
      setTerceirizados(tcList);
      setPermissions(permList);
      return { tcList, permList };
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar dados dos terceirizados.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // Save Terceirizado
  const handleSaveTerceirizado = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedMatricula = normalizeMatricula(matricula);
    const editingTerceirizado = editingTerceirizadoId
      ? terceirizados.find((tc) => tc.id === editingTerceirizadoId)
      : undefined;
    const nextName = name.trim();

    if (!nextName || !normalizedMatricula) {
      toast.error('Preencha o nome e a matricula do terceirizado.');
      return;
    }

    setIsSaving(true);
    try {
      await requisicoesCompraService.saveTerceirizado({
        id: editingTerceirizadoId,
        name: nextName,
        matricula: normalizedMatricula,
        previousMatricula: editingTerceirizado?.matricula,
        userId: editingTerceirizado?.userId,
        email: editingTerceirizado?.email,
        tipo,
      });

      toast.success(
        editingTerceirizadoId
          ? 'Terceirizado atualizado com sucesso!'
          : 'Terceirizado cadastrado com sucesso!'
      );
      
      const reloaded = await loadData();

      if (editingTerceirizadoId) {
        const updatedTerceirizado = reloaded?.tcList.find((tc) => tc.id === editingTerceirizadoId);
        setSelectedTerceirizado(updatedTerceirizado ?? (editingTerceirizado ? {
          ...editingTerceirizado,
          name: nextName,
          matricula: normalizedMatricula,
          tipo,
          updatedAt: new Date(),
        } : null));
        setName(nextName);
        setMatricula(normalizedMatricula);
      } else {
        setName('');
        setMatricula('');
        setTipo('refeitorio');
        setEditingTerceirizadoId(undefined);
        setSelectedTerceirizado(null);
        setIsPermissionsOpen(false);
        setPermissionTargetId('');
        setSelectedPermissionEmpenhoIds([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar terceirizado. Verifique se a matricula ja esta cadastrada.');
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Terceirizado + permissions
  const handleStartEdit = (tc: Terceirizado) => {
    setEditingTerceirizadoId(tc.id);
    setSelectedTerceirizado(tc);
    setName(tc.name);
    setMatricula(tc.matricula);
    setTipo(tc.tipo);
    setPermissionTargetId('');
    setSelectedPermissionEmpenhoIds([]);
    setPermissionType('empenho');
    setIsPermissionsOpen(true);
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    setEditingTerceirizadoId(undefined);
    setSelectedTerceirizado(null);
    setName('');
    setMatricula('');
    setTipo('refeitorio');
    setPermissionTargetId('');
    setSelectedPermissionEmpenhoIds([]);
    setIsPermissionEmpenhoPickerOpen(false);
  };

  const handleEditViewOpenChange = (open: boolean) => {
    setIsPermissionsOpen(open);
    if (!open) {
      handleCancelEdit();
    }
  };

  const handleOpenCreateDialog = () => {
    setEditingTerceirizadoId(undefined);
    setSelectedTerceirizado(null);
    setName('');
    setMatricula('');
    setTipo('refeitorio');
    setPermissionTargetId('');
    setSelectedPermissionEmpenhoIds([]);
    setIsPermissionEmpenhoPickerOpen(false);
    setIsCreateDialogOpen(true);
  };

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      handleCancelEdit();
    }
  };

  // Delete Terceirizado
  const handleDeleteTerceirizado = async (id: string) => {
    if (!confirm('Deseja realmente remover este terceirizado? Os vínculos de permissão também serão removidos.')) {
      return;
    }

    try {
      await requisicoesCompraService.deleteTerceirizado(id);
      toast.success('Terceirizado removido com sucesso!');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover terceirizado.');
    }
  };

  const togglePermissionEmpenho = (empenhoId: string) => {
    setSelectedPermissionEmpenhoIds((current) =>
      current.includes(empenhoId)
        ? current.filter((id) => id !== empenhoId)
        : [...current, empenhoId],
    );
  };

  // Add Permission Link
  const handleAddPermission = async () => {
    if (!selectedTerceirizado) {
      toast.error('Selecione um terceirizado para vincular.');
      return;
    }

    const requestedTargetIds = permissionType === 'empenho'
      ? selectedPermissionEmpenhoIds
      : permissionTargetId && permissionTargetId !== 'none'
        ? [permissionTargetId]
        : [];

    if (requestedTargetIds.length === 0) {
      toast.error(permissionType === 'empenho' ? 'Selecione um ou mais empenhos para vincular.' : 'Selecione o contrato para vincular.');
      return;
    }

    const existingTargetIds = new Set(
      activePermissions
        .map((permission) => permissionType === 'empenho' ? permission.empenhoId : permission.contratoId)
        .filter(Boolean),
    );
    const targetIds = requestedTargetIds.filter((id) => !existingTargetIds.has(id));

    if (targetIds.length === 0) {
      toast.info('Todos os vínculos selecionados já existem para este terceirizado.');
      return;
    }

    setIsLinking(true);
    try {
      await Promise.all(targetIds.map((targetId) => requisicoesCompraService.addPermission(
        selectedTerceirizado.matricula,
        permissionType,
        targetId,
        selectedTerceirizado.userId,
        selectedTerceirizado.email,
      )));
      toast.success(targetIds.length === 1 ? 'Vínculo de acesso cadastrado com sucesso!' : `${targetIds.length} vínculos de acesso cadastrados com sucesso!`);
      setPermissionTargetId('');
      setSelectedPermissionEmpenhoIds([]);
      
      // Reload permissions
      const permList = await requisicoesCompraService.listPermissions();
      setPermissions(permList);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao vincular permissão. Verifique se o vínculo já existe.');
    } finally {
      setIsLinking(false);
    }
  };

  // Delete Permission Link
  const handleRemovePermission = async (permId: string) => {
    try {
      await requisicoesCompraService.removePermission(permId);
      toast.success('Vínculo de acesso removido.');
      
      // Reload permissions
      const permList = await requisicoesCompraService.listPermissions();
      setPermissions(permList);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao remover vínculo.');
    }
  };

  // Active permissions for selected Terceirizado
  const activePermissions = useMemo(() => {
    if (!selectedTerceirizado) return [];
    return permissions.filter((p) => permissionMatchesTerceirizado(p, selectedTerceirizado));
  }, [permissions, selectedTerceirizado]);

  // Target dropdown options
  const targetOptions = useMemo(() => {
    if (permissionType === 'contrato') {
      return contratos.map((c) => ({
        id: c.id,
        label: `Contrato nº ${c.numero} - ${c.contratada || 'Sem fornecedor'}`,
        extra: c.contratada || '',
      }));
    }

    return empenhos.map((e) => ({
      id: e.id,
      label: `${e.numero} (${formatCurrency(e.valor)} - ${e.favorecidoNome || 'Sem favorecido'})`,
      extra: `${formatCurrency(e.valor)} - ${e.favorecidoNome || 'Sem favorecido'}`,
    }));
  }, [contratos, empenhos, permissionType]);

  const selectedPermissionEmpenhoOptions = useMemo(() => {
    if (permissionType !== 'empenho') return [];
    const selectedIds = new Set(selectedPermissionEmpenhoIds);
    return targetOptions.filter((option) => selectedIds.has(option.id));
  }, [permissionType, selectedPermissionEmpenhoIds, targetOptions]);

  const groupedActivePermissions = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      type: 'contrato' | 'empenho';
      items: Array<{ id: string; label: string; extra: string }>;
    }>();

    activePermissions.forEach((perm) => {
      const type = perm.contratoId ? 'contrato' : 'empenho';
      const group = groups.get(type) ?? { key: type, type, items: [] };

      if (perm.contratoId) {
        const contrato = contratos.find((item) => item.id === perm.contratoId);
        group.items.push({
          id: perm.id,
          label: contrato ? contrato.numero : 'Contrato ID não localizado',
          extra: contrato?.contratada || '',
        });
      } else if (perm.empenhoId) {
        const empenho = empenhos.find((item) => item.id === perm.empenhoId);
        group.items.push({
          id: perm.id,
          label: empenho ? empenho.numero : 'Empenho ID não localizado',
          extra: empenho ? `${formatCurrency(empenho.valor)} - ${empenho.favorecidoNome || 'Sem favorecido'}` : '',
        });
      }

      groups.set(type, group);
    });

    return Array.from(groups.values());
  }, [activePermissions, contratos, empenhos]);

  return (
    <div className="space-y-6 p-6">
      {!isPermissionsOpen && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary font-ui flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Cadastro de Terceirizados
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Gerencie prestadores terceirizados e configure seus vínculos de acesso a contratos e empenhos.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleOpenCreateDialog}
            className="bg-primary hover:bg-primary/95 text-primary-foreground gap-1.5 self-start sm:self-auto"
          >
            <UserPlus className="h-4 w-4" />
            Cadastrar Terceirizado
          </Button>
        </div>
      )}

      {isPermissionsOpen && selectedTerceirizado ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-ui text-xl font-bold text-text-primary flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                Editar terceirizado
              </h2>
              <p className="text-sm text-text-muted mt-1">
                Atualize os dados cadastrais e gerencie os contratos/empenhos que <strong className="text-text-primary">{selectedTerceirizado.name}</strong> poderá usar.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => handleEditViewOpenChange(false)}>
              Voltar ao cadastro
            </Button>
          </div>

          <Card className="border-border-default shadow-soft">
            <CardHeader className="bg-primary/[0.01] border-b">
              <CardTitle>Dados do terceirizado</CardTitle>
              <CardDescription>Esses dados identificam o prestador e controlam o acesso ao fluxo de requisições.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSaveTerceirizado} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="edit-tc-name">Nome Completo</Label>
                    <Input
                      id="edit-tc-name"
                      placeholder="Nome do terceirizado"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      disabled={isSaving}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-tc-matricula">Matrícula</Label>
                    <Input
                      id="edit-tc-matricula"
                      inputMode="numeric"
                      placeholder="Matrícula SUAP"
                      value={matricula}
                      onChange={(event) => setMatricula(event.target.value)}
                      disabled={isSaving}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-tc-type">Tipo de Prestação</Label>
                    <Select
                      value={tipo}
                      onValueChange={(val) => setTipo(val as 'limpeza_manutencao' | 'refeitorio')}
                      disabled={isSaving}
                    >
                      <SelectTrigger id="edit-tc-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="refeitorio">Refeitório (Acesso liberado)</SelectItem>
                        <SelectItem value="limpeza_manutencao">Limpeza e Manutenção (Sem acesso)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => handleEditViewOpenChange(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/95 text-primary-foreground">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Salvar dados
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {tipo !== 'refeitorio' && (
            <div className="bg-amber-50 border border-amber-200 rounded-radius-md p-3 text-xs text-amber-800 leading-relaxed flex gap-2">
              <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Este terceirizado é do tipo <strong>Limpeza e Manutenção</strong> e atualmente não possui acesso ao painel de requisições de compra. Vincular contratos ou empenhos só terá efeito se o tipo dele for alterado para Refeitório.
              </span>
            </div>
          )}

          <Card className="border-border-default shadow-soft">
            <CardHeader className="bg-primary/[0.01] border-b">
              <CardTitle>Vincular Contratos e Empenhos</CardTitle>
              <CardDescription>Configure o escopo de visualização do terceirizado. Ele só poderá adicionar itens nestas referências nas suas Requisições de Compra.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="perm-type">Tipo de Vínculo</Label>
                  <Select
                    value={permissionType}
                    onValueChange={(val) => {
                      setPermissionType(val as 'contrato' | 'empenho');
                      setPermissionTargetId('');
                      setSelectedPermissionEmpenhoIds([]);
                    }}
                  >
                    <SelectTrigger id="perm-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contrato">Contrato</SelectItem>
                      <SelectItem value="empenho">Empenho / NE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{permissionType === 'contrato' ? 'Selecionar contrato' : 'Selecionar um ou mais empenhos'}</Label>
                  {permissionType === 'contrato' ? (
                    <Select value={permissionTargetId} onValueChange={(val) => setPermissionTargetId(val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha o contrato..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Escolha uma opção...</SelectItem>
                        {targetOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <Popover open={isPermissionEmpenhoPickerOpen} onOpenChange={setIsPermissionEmpenhoPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isPermissionEmpenhoPickerOpen}
                            aria-label={selectedPermissionEmpenhoIds.length > 0 ? `${selectedPermissionEmpenhoIds.length} empenho(s) selecionado(s)` : 'Buscar e selecionar empenhos'}
                            className="min-h-10 w-full justify-between text-left font-normal"
                          >
                            <span className="truncate">
                              {selectedPermissionEmpenhoIds.length > 0
                                ? `${selectedPermissionEmpenhoIds.length} empenho(s) selecionado(s)`
                                : 'Buscar e selecionar empenhos...'}
                            </span>
                            <Plus className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Filtrar por número, favorecido ou valor..." />
                            <CommandList className="max-h-72">
                              <CommandEmpty>Nenhum empenho encontrado.</CommandEmpty>
                              <CommandGroup heading="Empenhos disponíveis">
                                {targetOptions.map((opt) => {
                                  const checked = selectedPermissionEmpenhoIds.includes(opt.id);
                                  return (
                                    <CommandItem
                                      key={opt.id}
                                      value={opt.label}
                                      onSelect={() => togglePermissionEmpenho(opt.id)}
                                      className="gap-2"
                                    >
                                      <Check className={checked ? 'h-4 w-4 opacity-100' : 'h-4 w-4 opacity-0'} />
                                      <span className="min-w-0 flex-1 truncate" title={opt.label}>{opt.label}</span>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {selectedPermissionEmpenhoOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5" aria-label="Empenhos selecionados">
                          {selectedPermissionEmpenhoOptions.map((opt) => (
                            <Badge key={opt.id} variant="secondary" className="max-w-full gap-1 pr-1">
                              <span className="max-w-[22rem] truncate" title={opt.label}>{opt.label}</span>
                              <button
                                type="button"
                                className="rounded-full p-0.5 hover:bg-surface-hover"
                                aria-label={`Remover ${opt.label}`}
                                onClick={() => togglePermissionEmpenho(opt.id)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  disabled={isLinking || (permissionType === 'contrato' ? !permissionTargetId || permissionTargetId === 'none' : selectedPermissionEmpenhoIds.length === 0)}
                  onClick={handleAddPermission}
                  className="bg-primary hover:bg-primary/95 text-primary-foreground gap-1.5 self-end h-10"
                >
                  {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  Vincular Acesso
                </Button>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="font-ui text-sm font-bold text-text-primary uppercase tracking-wider">Vínculos de Acesso Ativos ({activePermissions.length})</span>
                </div>

                {activePermissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 border border-dashed rounded-radius-lg bg-surface-subtle/10">
                    <ShieldCheck className="h-8 w-8 text-text-muted opacity-30" />
                    <p className="text-xs text-text-muted text-center">
                      Nenhum contrato ou empenho vinculado a este prestador.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border-default rounded-radius-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-surface-subtle/50">
                          <TableHead className="w-32">Tipo</TableHead>
                          <TableHead>Vínculos autorizados</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedActivePermissions.map((group) => (
                          <TableRow key={group.key}>
                            <TableCell className="whitespace-nowrap py-3 align-middle">
                              <Badge variant="secondary" className={group.type === 'contrato' ? 'bg-sebrae-blue/10 text-sebrae-blue border border-sebrae-blue/20' : 'bg-amber-50 text-amber-800'}>
                                {group.type === 'contrato' ? 'Contrato' : 'Empenho'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 align-middle">
                              <div className="flex max-w-full flex-wrap gap-2 py-1 pr-2" aria-label={`Vínculos ${group.type === 'contrato' ? 'de contratos' : 'de empenhos'}`}>
                                {group.items.map((item) => (
                                  <Badge
                                    key={item.id}
                                    variant="outline"
                                    className="min-h-8 max-w-full gap-2 rounded-full border-border-default bg-background px-3 py-1 font-normal"
                                  >
                                    <span className="font-mono font-semibold text-text-primary">{item.label}</span>
                                    {item.extra && (
                                      <span className="max-w-[32rem] whitespace-normal break-words text-xs text-text-secondary" title={item.extra}>
                                        {item.extra}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      className="ml-1 rounded-full p-0.5 text-destructive hover:bg-destructive/10"
                                      aria-label={`Remover vínculo ${item.label}`}
                                      onClick={() => void handleRemovePermission(item.id)}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle className="font-ui text-base font-bold text-text-primary flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Novo Terceirizado
                </DialogTitle>
                <DialogDescription>
                  Cadastre um novo prestador para configurar seu perfil.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveTerceirizado} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="create-tc-name">Nome Completo</Label>
                  <Input
                    id="create-tc-name"
                    placeholder="Nome do terceirizado"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isSaving}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-tc-matricula">Matrícula</Label>
                  <Input
                    id="create-tc-matricula"
                    inputMode="numeric"
                    placeholder="Matrícula SUAP"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    disabled={isSaving}
                    required
                  />
                  <p className="text-[10px] text-text-muted">
                    A matrícula deve corresponder ao login retornado pelo SUAP.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="create-tc-type">Tipo de Prestação</Label>
                  <Select
                    value={tipo}
                    onValueChange={(val) => setTipo(val as 'limpeza_manutencao' | 'refeitorio')}
                    disabled={isSaving}
                  >
                    <SelectTrigger id="create-tc-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refeitorio">Refeitório (Acesso liberado)</SelectItem>
                      <SelectItem value="limpeza_manutencao">Limpeza e Manutenção (Sem acesso)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => handleCreateDialogOpenChange(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/95 text-primary-foreground">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Cadastrar Terceirizado
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Card className="border-border-default shadow-soft">
            <CardHeader>
              <CardTitle className="font-ui text-base font-bold text-text-primary">
                Prestadores Cadastrados ({terceirizados.length})
              </CardTitle>
              <CardDescription className="mt-1">
                Lista de todos os terceirizados. Fiscais e Diretores podem gerenciar e definir permissões de escopo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-text-secondary">Carregando terceirizados...</p>
                </div>
              ) : terceirizados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 bg-primary/[0.01] border-t border-dashed">
                  <Users className="h-10 w-10 text-primary opacity-30" />
                  <h3 className="font-ui text-sm font-bold text-text-primary">Nenhum terceirizado cadastrado</h3>
                  <p className="text-xs text-text-muted text-center max-w-xs">
                    Clique em Cadastrar Terceirizado no topo para adicionar o primeiro prestador.
                  </p>
                </div>
              ) : (
                <div className="border-t overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-surface-subtle/30">
                        <TableHead>Nome</TableHead>
                        <TableHead>Matrícula</TableHead>
                        <TableHead>Tipo / Acesso</TableHead>
                        <TableHead>Vínculos Ativos</TableHead>
                        <TableHead className="text-right pr-6">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {terceirizados.map((tc) => {
                        const tcPermsCount = permissions.filter((p) => permissionMatchesTerceirizado(p, tc)).length;

                        return (
                          <TableRow key={tc.id} className="hover:bg-surface-hover/20">
                            <TableCell className="font-medium text-text-primary">{tc.name}</TableCell>
                            <TableCell className="text-text-muted font-mono">{tc.matricula || '-'}</TableCell>
                            <TableCell>
                              {tc.tipo === 'refeitorio' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold hover:bg-emerald-100">
                                  Refeitório
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100 flex items-center gap-1 w-fit">
                                  <Lock className="h-3 w-3 shrink-0" />
                                  Limpeza & Manut.
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="font-ui font-bold">
                                {tcPermsCount} vínculo(s)
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6 space-x-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Editar terceirizado"
                                onClick={() => handleStartEdit(tc)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4 text-text-secondary" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Excluir terceirizado"
                                onClick={() => void handleDeleteTerceirizado(tc.id)}
                                className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
