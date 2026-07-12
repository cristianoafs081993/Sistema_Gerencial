import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { appScreens, appScreenGroups } from '@/lib/appScreens';
import {
  getOrgDetail,
  listOrgs,
  setOrgModules,
  setOrgUsers,
  upsertOrg,
  type AdminOrg,
  type AdminOrgDetail,
  type AdminOrgsState,
} from '@/services/orgAdmin';
import { listAdminUsersState, type AdminUser } from '@/services/userAdmin';

type OrgFormData = {
  id?: string;
  slug: string;
  name: string;
  cnpj: string;
  isActive: boolean;
};

const emptyForm = (): OrgFormData => ({ slug: '', name: '', cnpj: '', isActive: true });

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export default function ControleOrgaos() {
  const { isSuperAdmin } = useAuth();

  const [orgsState, setOrgsState] = useState<AdminOrgsState | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<AdminOrgDetail | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulário de criação/edição de órgão
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [orgForm, setOrgForm] = useState<OrgFormData>(emptyForm());

  // Módulos selecionados para o órgão
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);

  // Usuários selecionados para o órgão
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Telas agrupadas por grupo (apenas telas não-admin para atribuição de módulos)
  const screensByGroup = useMemo(() => {
    return appScreenGroups
      .map((group) => ({
        group,
        screens: appScreens.filter((s) => s.groupId === group.id && !s.hiddenFromNavigation),
      }))
      .filter((g) => g.screens.length > 0);
  }, []);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        Acesso restrito ao superadministrador.
      </div>
    );
  }

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orgs, usersState] = await Promise.all([listOrgs(), listAdminUsersState()]);
      setOrgsState(orgs);
      setAllUsers(usersState.users.filter((u) => u.email !== 'cristiano.cnrn@gmail.com'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar órgãos.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrgDetail = async (orgId: string) => {
    setIsDetailLoading(true);
    try {
      const detail = await getOrgDetail(orgId);
      setSelectedOrg(detail);
      setSelectedScreenIds(detail.enabledScreenIds);
      setSelectedUserIds(detail.users.map((u) => u.userId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar detalhes do órgão.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSelectOrg = (org: AdminOrg) => {
    void loadOrgDetail(org.id);
  };

  const handleOpenNewOrgForm = () => {
    setOrgForm(emptyForm());
    setShowOrgForm(true);
  };

  const handleOpenEditOrgForm = (org: AdminOrg) => {
    setOrgForm({
      id: org.id,
      slug: org.slug,
      name: org.name,
      cnpj: org.cnpj || '',
      isActive: org.isActive,
    });
    setShowOrgForm(true);
  };

  const handleSaveOrg = async () => {
    if (!orgForm.name.trim()) {
      toast.error('Informe o nome do órgão.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await upsertOrg({
        id: orgForm.id,
        slug: orgForm.slug || slugify(orgForm.name),
        name: orgForm.name.trim(),
        cnpj: orgForm.cnpj.trim() || undefined,
        isActive: orgForm.isActive,
      });
      setOrgsState(result);
      setShowOrgForm(false);
      toast.success(orgForm.id ? 'Órgão atualizado.' : 'Órgão criado com sucesso.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar órgão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveModules = async () => {
    if (!selectedOrg) return;
    setIsSubmitting(true);
    try {
      const detail = await setOrgModules({ orgId: selectedOrg.id, screenIds: selectedScreenIds });
      setSelectedOrg(detail);
      toast.success('Módulos do órgão atualizados.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar módulos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveUsers = async () => {
    if (!selectedOrg) return;
    setIsSubmitting(true);
    try {
      const detail = await setOrgUsers({
        orgId: selectedOrg.id,
        users: selectedUserIds.map((userId) => ({ userId, role: 'member' as const })),
      });
      setSelectedOrg(detail);
      toast.success('Usuários do órgão atualizados.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar usuários.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleScreen = (screenId: string) => {
    setSelectedScreenIds((current) =>
      current.includes(screenId) ? current.filter((id) => id !== screenId) : [...current, screenId],
    );
  };

  const allScreenIds = useMemo(
    () => screensByGroup.flatMap(({ screens }) => screens.map((s) => s.id)),
    [screensByGroup],
  );

  const selectAllScreens = () => setSelectedScreenIds(allScreenIds);
  const deselectAllScreens = () => setSelectedScreenIds([]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  };

  return (
    <div className="space-y-6">
      <HeaderActions>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
        <Button type="button" size="sm" onClick={handleOpenNewOrgForm}>
          <Plus className="h-4 w-4" />
          Novo órgão
        </Button>
      </HeaderActions>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1a1a19]">Administração</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#34322d]">Controle de Órgãos</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#858481]">
          Gerencie os órgãos (tenants) do sistema. Defina quais módulos cada órgão pode acessar e quais usuários
          pertencem a cada órgão. Os dados de cada órgão são completamente isolados.
        </p>
      </div>

      {/* Formulário de órgão */}
      {showOrgForm && (
        <FilterPanel title={orgForm.id ? 'Editar órgão' : 'Novo órgão'}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Nome do órgão"
              value={orgForm.name}
              onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))}
            />
            <Input
              placeholder="Slug (ex: ifrn-cn)"
              value={orgForm.slug}
              onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <Input
              placeholder="CNPJ"
              value={orgForm.cnpj}
              onChange={(e) => setOrgForm((f) => ({ ...f, cnpj: e.target.value }))}
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <Checkbox
                  checked={orgForm.isActive}
                  onCheckedChange={(v) => setOrgForm((f) => ({ ...f, isActive: v === true }))}
                />
                Ativo
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={() => void handleSaveOrg()} disabled={isSubmitting}>
              <Save className="h-4 w-4" />
              Salvar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowOrgForm(false)}>
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </FilterPanel>
      )}

      {isLoading && !orgsState ? (
        <SectionPanel>
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando órgãos...
          </div>
        </SectionPanel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Lista de órgãos */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Órgãos cadastrados</p>
            {(orgsState?.orgs || []).map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => handleSelectOrg(org)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedOrg?.id === org.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border-default bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate text-sm font-semibold">{org.name}</span>
                    </div>
                    {org.cnpj && <p className="mt-0.5 text-xs text-slate-400">{org.cnpj}</p>}
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {org.userCount} usuário(s)
                      </span>
                      <span>·</span>
                      <span>{org.enabledModuleCount} módulo(s)</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge variant={org.isActive ? 'default' : 'secondary'} className="text-[10px]">
                      {org.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleOpenEditOrgForm(org); }}
                      className="text-slate-400 hover:text-slate-700"
                      title="Editar"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </button>
            ))}

            {(orgsState?.orgs || []).length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhum órgão cadastrado.</p>
            )}
          </div>

          {/* Detalhes do órgão selecionado */}
          <div className="space-y-4">
            {!selectedOrg && !isDetailLoading && (
              <SectionPanel>
                <p className="py-10 text-center text-sm text-slate-400">
                  Selecione um órgão para gerenciar seus módulos e usuários.
                </p>
              </SectionPanel>
            )}

            {isDetailLoading && (
              <SectionPanel>
                <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando detalhes...
                </div>
              </SectionPanel>
            )}

            {selectedOrg && !isDetailLoading && (
              <>
                {/* Módulos habilitados */}
                <SectionPanel
                  title={`Módulos — ${selectedOrg.name}`}
                  description="Marque os módulos que este órgão pode acessar. Usuários deste órgão só verão as telas aqui habilitadas."
                  actions={
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={selectAllScreens}
                        disabled={isSubmitting}
                        title="Marcar todos os módulos"
                      >
                        Marcar todos
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={deselectAllScreens}
                        disabled={isSubmitting}
                        title="Desmarcar todos os módulos"
                      >
                        Desmarcar todos
                      </Button>
                      <Button type="button" size="sm" onClick={() => void handleSaveModules()} disabled={isSubmitting}>
                        <Save className="h-4 w-4" />
                        Salvar módulos
                      </Button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    {screensByGroup.map(({ group, screens }) => (
                      <div key={group.id}>
                        <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          {group.name}
                        </p>
                        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {screens.map((screen) => {
                            const enabled = selectedScreenIds.includes(screen.id);
                            return (
                              <label
                                key={screen.id}
                                className="flex cursor-pointer items-center gap-2 rounded-md border border-border-default px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                              >
                                <Checkbox
                                  checked={enabled}
                                  onCheckedChange={() => toggleScreen(screen.id)}
                                />
                                {screen.name}
                                {enabled && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionPanel>

                {/* Usuários do órgão */}
                <DataTablePanel
                  title="Usuários do órgão"
                  description="Associe usuários a este órgão. Cada usuário pertence a exatamente um órgão."
                  actions={
                    <Button type="button" size="sm" onClick={() => void handleSaveUsers()} disabled={isSubmitting}>
                      <Save className="h-4 w-4" />
                      Salvar usuários
                    </Button>
                  }
                >
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Vínculo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers.map((user) => {
                        const isLinked = selectedUserIds.includes(user.id);
                        return (
                          <TableRow key={user.id} className="cursor-pointer" onClick={() => toggleUser(user.id)}>
                            <TableCell>
                              <div className="font-semibold text-slate-800">{user.email}</div>
                              <div className="text-xs text-slate-500">
                                {user.createdAt ? `Criado em ${new Date(user.createdAt).toLocaleDateString('pt-BR')}` : ''}
                              </div>
                            </TableCell>
                            <TableCell>
                              {user.usesDefaultPassword
                                ? <Badge variant="warning">Senha padrão</Badge>
                                : <Badge variant="secondary">Ativo</Badge>}
                            </TableCell>
                            <TableCell>
                              <Checkbox
                                checked={isLinked}
                                onCheckedChange={() => toggleUser(user.id)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`vincular-${user.email}`}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </DataTablePanel>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
