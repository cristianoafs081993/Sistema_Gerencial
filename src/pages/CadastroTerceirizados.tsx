import { useEffect, useState, useMemo } from 'react';
import { useData } from '@/contexts/DataContext';
import { requisicoesCompraService } from '@/services/requisicoesCompra';
import { normalizeMatricula, permissionMatchesTerceirizado } from '@/lib/terceirizadoIdentity';
import type { Terceirizado, TerceirizadoPermission } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  UserPlus,
  ShieldCheck,
  Trash2,
  Edit,
  Plus,
  Coins,
  FileText,
  Loader2,
  Lock,
  X,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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

  // Permissions Drawer State
  const [selectedTerceirizado, setSelectedTerceirizado] = useState<Terceirizado | null>(null);
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [permissionType, setPermissionType] = useState<'contrato' | 'empenho'>('contrato');
  const [permissionTargetId, setPermissionTargetId] = useState<string>('');
  const [isLinking, setIsLinking] = useState(false);

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
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar dados dos terceirizados.');
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

    if (!name.trim() || !normalizedMatricula) {
      toast.error('Preencha o nome e a matricula do terceirizado.');
      return;
    }

    setIsSaving(true);
    try {
      await requisicoesCompraService.saveTerceirizado({
        id: editingTerceirizadoId,
        name: name.trim(),
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
      
      setName('');
      setMatricula('');
      setTipo('refeitorio');
      setEditingTerceirizadoId(undefined);
      
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar terceirizado. Verifique se a matricula ja esta cadastrada.');
    } finally {
      setIsSaving(false);
    }
  };

  // Edit Terceirizado
  const handleStartEdit = (tc: Terceirizado) => {
    setEditingTerceirizadoId(tc.id);
    setName(tc.name);
    setMatricula(tc.matricula);
    setTipo(tc.tipo);
  };

  // Cancel Edit
  const handleCancelEdit = () => {
    setEditingTerceirizadoId(undefined);
    setName('');
    setMatricula('');
    setTipo('refeitorio');
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

  // Manage Permissions
  const handleOpenPermissions = (tc: Terceirizado) => {
    setSelectedTerceirizado(tc);
    setPermissionTargetId('');
    setPermissionType('contrato');
    setIsPermissionsOpen(true);
  };

  // Add Permission Link
  const handleAddPermission = async () => {
    if (!selectedTerceirizado || !permissionTargetId || permissionTargetId === 'none') {
      toast.error('Selecione um contrato ou empenho para vincular.');
      return;
    }

    setIsLinking(true);
    try {
      await requisicoesCompraService.addPermission(
        selectedTerceirizado.matricula,
        permissionType,
        permissionTargetId,
        selectedTerceirizado.userId,
        selectedTerceirizado.email
      );
      toast.success('Vínculo de acesso cadastrado com sucesso!');
      setPermissionTargetId('');
      
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
        label: `Contrato nº ${c.numero} - ${c.contratada || 'Sem Fornecedor'}`,
      }));
    } else {
      return empenhos.map((e) => ({
        id: e.id,
        label: `Empenho ${e.numero} (${e.processo || 'Sem Processo'})`,
      }));
    }
  }, [contratos, empenhos, permissionType]);

  return (
    <div className="space-y-6 p-6">
      {/* Top Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary font-ui flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Cadastro de Terceirizados
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Gerencie prestadores terceirizados e configure seus vínculos de acesso a contratos e empenhos.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Form Card */}
        <Card className="border-border-default shadow-soft md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="font-ui text-base font-bold text-text-primary flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {editingTerceirizadoId ? 'Editar Terceirizado' : 'Novo Terceirizado'}
            </CardTitle>
            <CardDescription>
              {editingTerceirizadoId 
                ? 'Atualize os dados e o tipo do prestador.'
                : 'Cadastre um novo prestador para configurar seu perfil.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveTerceirizado} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tc-name">Nome Completo</Label>
                <Input
                  id="tc-name"
                  placeholder="Nome do terceirizado"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tc-matricula">Matricula</Label>
                <Input
                  id="tc-matricula"
                  inputMode="numeric"
                  placeholder="Matricula SUAP"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  disabled={isSaving}
                  required
                />
                <p className="text-[10px] text-text-muted">
                  A matricula deve corresponder ao login retornado pelo SUAP.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tc-type">Tipo de Prestação</Label>
                <Select
                  value={tipo}
                  onValueChange={(val) => setTipo(val as 'limpeza_manutencao' | 'refeitorio')}
                  disabled={isSaving}
                >
                  <SelectTrigger id="tc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refeitorio">Refeitório (Acesso liberado)</SelectItem>
                    <SelectItem value="limpeza_manutencao">Limpeza e Manutenção (Sem acesso)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                {editingTerceirizadoId && (
                  <Button type="button" variant="ghost" onClick={handleCancelEdit} disabled={isSaving}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" disabled={isSaving} className="bg-primary hover:bg-primary/95 text-primary-foreground">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  {editingTerceirizadoId ? 'Salvar Alterações' : 'Cadastrar Terceirizado'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* List Card */}
        <Card className="border-border-default shadow-soft md:col-span-2">
          <CardHeader>
            <CardTitle className="font-ui text-base font-bold text-text-primary">
              Prestadores Cadastrados ({terceirizados.length})
            </CardTitle>
            <CardDescription>
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
                  Cadastre o primeiro prestador terceirizado no painel lateral.
                </p>
              </div>
            ) : (
              <div className="border-t overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-subtle/30">
                      <TableHead>Nome</TableHead>
                      <TableHead>Matricula</TableHead>
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
                              variant="outline"
                              size="sm"
                              title="Gerenciar Vínculos de Acesso"
                              onClick={() => handleOpenPermissions(tc)}
                              className="h-8 text-xs font-bold text-primary hover:bg-primary/5"
                            >
                              <ShieldCheck className="h-4 w-4 mr-1" />
                              Vínculos
                            </Button>
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

      {/* Permissions slide-over (Sheet) */}
      <Sheet open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
        <SheetContent className="w-[450px] sm:w-[540px] max-w-full overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 font-ui font-bold text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Vínculos de Acesso
            </SheetTitle>
            <SheetDescription>
              Gerencie quais Contratos e Empenhos o terceirizado{' '}
              <strong className="text-text-primary">{selectedTerceirizado?.name}</strong> poderá usar.
            </SheetDescription>
          </SheetHeader>

          {selectedTerceirizado && (
            <div className="py-6 space-y-6">
              {/* Alert: type access restriction warning */}
              {selectedTerceirizado.tipo !== 'refeitorio' && (
                <div className="bg-amber-50 border border-amber-200 rounded-radius-md p-3 text-xs text-amber-800 leading-relaxed flex gap-2">
                  <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Atenção:</strong> Este terceirizado é do tipo <strong>Limpeza e Manutenção</strong> e atualmente não possui acesso ao painel de requisições de compra. Vincular contratos ou empenhos só terá efeito se o tipo dele for alterado para Refeitório.
                  </span>
                </div>
              )}

              {/* Add New Vinculo Form */}
              <div className="space-y-4 bg-surface-subtle/35 p-4 border rounded-radius-lg">
                <h4 className="font-ui text-sm font-bold text-text-primary">Novo Vínculo</h4>
                
                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="perm-type">Tipo de Vínculo</Label>
                    <Select
                      value={permissionType}
                      onValueChange={(val) => {
                        setPermissionType(val as 'contrato' | 'empenho');
                        setPermissionTargetId('');
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

                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="perm-target">Selecionar Entidade</Label>
                    <Select value={permissionTargetId} onValueChange={(val) => setPermissionTargetId(val)}>
                      <SelectTrigger id="perm-target">
                        <SelectValue placeholder={`Escolha o ${permissionType === 'contrato' ? 'contrato' : 'empenho'}...`} />
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
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    disabled={isLinking || !permissionTargetId || permissionTargetId === 'none'}
                    onClick={handleAddPermission}
                    className="bg-primary hover:bg-primary/95 text-primary-foreground gap-1.5 text-xs font-bold"
                  >
                    {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                    Vincular Acesso
                  </Button>
                </div>
              </div>

              {/* Active Permission List */}
              <div className="space-y-3 pt-2">
                <h4 className="font-ui text-sm font-bold text-text-primary flex items-center gap-1.5">
                  Vínculos Ativos ({activePermissions.length})
                </h4>

                {activePermissions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 border border-dashed rounded-radius-lg bg-surface-subtle/10">
                    <ShieldCheck className="h-8 w-8 text-text-muted opacity-30" />
                    <p className="text-xs text-text-muted text-center">
                      Nenhum contrato ou empenho vinculado a este prestador.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border-default rounded-radius-lg overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-surface-subtle/30">
                          <TableHead>Tipo</TableHead>
                          <TableHead>Identificação</TableHead>
                          <TableHead className="text-center w-[10%]">Remover</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activePermissions.map((perm) => {
                          const isContrato = !!perm.contratoId;
                          
                          // Find labels
                          let label = 'Desconhecido';
                          if (isContrato) {
                            const match = contratos.find((c) => c.id === perm.contratoId);
                            label = match ? `Contrato nº ${match.numero}` : 'Contrato';
                          } else {
                            const match = empenhos.find((e) => e.id === perm.empenhoId);
                            label = match ? `Empenho ${match.numero}` : 'Empenho';
                          }

                          return (
                            <TableRow key={perm.id} className="hover:bg-surface-hover/10">
                              <TableCell className="py-2.5">
                                {isContrato ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-100 flex items-center gap-1 w-fit">
                                    <FileText className="h-3 w-3 shrink-0" />
                                    Contrato
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-100 flex items-center gap-1 w-fit">
                                    <Coins className="h-3 w-3 shrink-0" />
                                    Empenho
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-bold font-ui py-2.5 text-text-primary">{label}</TableCell>
                              <TableCell className="text-center py-2.5">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleRemovePermission(perm.id)}
                                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
