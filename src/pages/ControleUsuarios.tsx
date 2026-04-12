import { useEffect, useMemo, useState } from 'react';
import { Loader2, MailPlus, Plus, RefreshCw, Save, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildInviteRedirectUrl, isLocalAuthRedirectUrl, resolveAuthRedirectOrigin } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  createDirectUser,
  inviteAdminUser,
  listAdminUsersState,
  setAdminUserGroups,
  upsertUserGroup,
  type AdminScreen,
  type AdminScreenGroup,
  type AdminUser,
  type AdminUserGroup,
  type AdminUsersState,
} from '@/services/userAdmin';

const DEFAULT_PASSWORD = 'ifrn';

function screenGroupName(screenGroups: AdminScreenGroup[], groupId: string) {
  return screenGroups.find((group) => group.id === groupId)?.name || groupId;
}

function sortScreens(screens: AdminScreen[], screenGroups: AdminScreenGroup[]) {
  const orderByGroup = new Map(screenGroups.map((group) => [group.id, group.sortOrder]));

  return [...screens].sort((left, right) => {
    const groupDelta = (orderByGroup.get(left.groupId) || 0) - (orderByGroup.get(right.groupId) || 0);
    if (groupDelta !== 0) return groupDelta;
    return left.sortOrder - right.sortOrder;
  });
}

export default function ControleUsuarios() {
  const [state, setState] = useState<AdminUsersState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedCreateGroupId, setSelectedCreateGroupId] = useState('');
  const [selectedInviteGroupId, setSelectedInviteGroupId] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string>('new');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedScreenIds, setSelectedScreenIds] = useState<string[]>([]);

  const sortedScreens = useMemo(
    () => (state ? sortScreens(state.screens, state.screenGroups) : []),
    [state],
  );

  const selectedGroup = state?.groups.find((group) => group.id === editingGroupId) || null;

  const loadState = async () => {
    setIsLoading(true);
    try {
      const nextState = await listAdminUsersState();
      setState(nextState);
      const directorGroup = nextState.groups.find((group) => group.slug === 'diretores') || nextState.groups[0];
      setSelectedCreateGroupId((current) => current || directorGroup?.id || '');
      setSelectedInviteGroupId((current) => current || directorGroup?.id || '');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar usuários e grupos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    if (!state) return;

    if (editingGroupId === 'new') {
      setGroupName('');
      setGroupDescription('');
      setSelectedScreenIds([]);
      return;
    }

    const group = state.groups.find((item) => item.id === editingGroupId);
    if (!group) return;

    setGroupName(group.name);
    setGroupDescription(group.description || '');
    setSelectedScreenIds(group.screenIds);
  }, [editingGroupId, state]);

  const applyState = (nextState: AdminUsersState, message: string) => {
    setState(nextState);
    toast.success(message);
  };

  const handleCreateDirectUser = async () => {
    const email = createEmail.trim().toLowerCase();
    if (!email || !selectedCreateGroupId) {
      toast.error('Informe e-mail e grupo para criar o usuário.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nextState = await createDirectUser({ email, groupId: selectedCreateGroupId });
      setCreateEmail('');
      applyState(nextState, `Usuário criado com a senha padrão "${DEFAULT_PASSWORD}".`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao criar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInviteUser = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !selectedInviteGroupId) {
      toast.error('Informe e-mail e grupo para enviar o convite.');
      return;
    }

    const redirectTo = buildInviteRedirectUrl(resolveAuthRedirectOrigin(window.location.origin, env.appOrigin), '/');
    if (isLocalAuthRedirectUrl(redirectTo)) {
      toast.error('Configure VITE_APP_ORIGIN com a URL pública do sistema antes de enviar convites.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nextState = await inviteAdminUser({ email, groupId: selectedInviteGroupId, redirectTo });
      setInviteEmail('');
      applyState(nextState, `Convite enviado para ${email}.`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar convite.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Informe o nome do grupo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const nextState = await upsertUserGroup({
        id: editingGroupId === 'new' ? undefined : editingGroupId,
        name: groupName.trim(),
        description: groupDescription.trim(),
        screenIds: selectedScreenIds,
      });

      setState(nextState);
      if (editingGroupId === 'new') {
        const createdGroup = nextState.groups.find((group) => group.name === groupName.trim());
        setEditingGroupId(createdGroup?.id || 'new');
      }
      toast.success('Grupo salvo.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao salvar grupo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserGroup = async (user: AdminUser, groupId: string, checked: boolean) => {
    const groupIds = checked
      ? Array.from(new Set([...user.groupIds, groupId]))
      : user.groupIds.filter((currentGroupId) => currentGroupId !== groupId);

    setIsSubmitting(true);
    try {
      const nextState = await setAdminUserGroups({ userId: user.id, email: user.email, groupIds });
      setState(nextState);
      toast.success('Grupos do usuário atualizados.');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Falha ao atualizar grupos do usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleScreen = (screenId: string, checked: boolean) => {
    setSelectedScreenIds((current) =>
      checked ? Array.from(new Set([...current, screenId])) : current.filter((id) => id !== screenId),
    );
  };

  return (
    <div className="space-y-6">
      <HeaderActions>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadState()} disabled={isLoading}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </HeaderActions>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1a1a19]">Administração</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#34322d]">Controle de usuários</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#858481]">
          Crie usuários, envie convites e defina quais telas cada grupo pode acessar.
        </p>
      </div>

      {isLoading && !state ? (
        <SectionPanel>
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando usuários e permissões...
          </div>
        </SectionPanel>
      ) : null}

      {state ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <FilterPanel title="Criar usuário">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                <Input
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  placeholder="email@ifrn.edu.br"
                />
                <select
                  value={selectedCreateGroupId}
                  onChange={(event) => setSelectedCreateGroupId(event.target.value)}
                  className="input-system h-10 rounded-md px-3 text-sm"
                >
                  {state.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <Button type="button" onClick={() => void handleCreateDirectUser()} disabled={isSubmitting}>
                  <UserPlus className="h-4 w-4" />
                  Criar
                </Button>
              </div>
              <p className="mt-3 text-xs text-[#858481]">
                Usuários criados por aqui entram com a senha padrão "{DEFAULT_PASSWORD}" e recebem um aviso para trocar a senha.
              </p>
            </FilterPanel>

            <FilterPanel title="Enviar convite">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="email@ifrn.edu.br"
                />
                <select
                  value={selectedInviteGroupId}
                  onChange={(event) => setSelectedInviteGroupId(event.target.value)}
                  className="input-system h-10 rounded-md px-3 text-sm"
                >
                  {state.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
                <Button type="button" variant="outline" onClick={() => void handleInviteUser()} disabled={isSubmitting}>
                  <MailPlus className="h-4 w-4" />
                  Convidar
                </Button>
              </div>
            </FilterPanel>
          </div>

          <DataTablePanel title="Usuários" description="Associação de usuários aos grupos de acesso.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  {state.groups.map((group) => (
                    <TableHead key={group.id}>{group.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{user.email}</div>
                      <div className="text-xs text-slate-500">Criado em {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}</div>
                    </TableCell>
                    <TableCell>
                      {user.usesDefaultPassword ? <Badge variant="warning">Senha padrão</Badge> : <Badge variant="secondary">Ativo</Badge>}
                    </TableCell>
                    {state.groups.map((group) => (
                      <TableCell key={`${user.id}-${group.id}`}>
                        <Checkbox
                          checked={user.groupIds.includes(group.id)}
                          disabled={isSubmitting}
                          onCheckedChange={(checked) => void handleToggleUserGroup(user, group.id, checked === true)}
                          aria-label={`${user.email}-${group.slug}`}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataTablePanel>

          <SectionPanel
            title="Grupos e permissões"
            description="Defina quais telas cada grupo pode acessar."
            actions={
              <Button type="button" size="sm" onClick={() => void handleSaveGroup()} disabled={isSubmitting}>
                <Save className="h-4 w-4" />
                Salvar grupo
              </Button>
            }
          >
            <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-3">
                <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setEditingGroupId('new')}>
                  <Plus className="h-4 w-4" />
                  Novo grupo
                </Button>
                {state.groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setEditingGroupId(group.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      editingGroupId === group.id ? 'border-primary bg-primary/10 text-primary' : 'border-border-default bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-semibold">{group.name}</span>
                    {group.isSystem ? <span className="ml-2 text-xs text-slate-500">sistema</span> : null}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Nome do grupo" />
                  <Textarea
                    value={groupDescription}
                    onChange={(event) => setGroupDescription(event.target.value)}
                    placeholder="Descrição"
                    className="min-h-10 md:row-span-2"
                  />
                </div>

                <div className="overflow-hidden rounded-md border border-border-default">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tela</TableHead>
                        <TableHead>Grupo de telas</TableHead>
                        <TableHead>Acesso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedScreens.map((screen) => (
                        <TableRow key={screen.id}>
                          <TableCell>
                            <div className="font-medium text-slate-800">{screen.name}</div>
                            <div className="text-xs text-slate-500">{screen.path}</div>
                          </TableCell>
                          <TableCell>{screenGroupName(state.screenGroups, screen.groupId)}</TableCell>
                          <TableCell>
                            <Checkbox
                              checked={selectedScreenIds.includes(screen.id)}
                              onCheckedChange={(checked) => toggleScreen(screen.id, checked === true)}
                              aria-label={`screen-${screen.id}`}
                              disabled={selectedGroup?.isSystem && screen.isAdminOnly}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </SectionPanel>
        </>
      ) : null}
    </div>
  );
}
