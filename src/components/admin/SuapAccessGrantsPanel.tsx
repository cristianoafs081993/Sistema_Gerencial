import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Save, Trash2, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';

import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { SectionPanel } from '@/components/design-system/SectionPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { IFRN_CAMPUSES } from '@/lib/ifrnCampuses';
import { normalizeMatricula } from '@/lib/terceirizadoIdentity';
import {
  deleteSuapAccessGrant,
  dismissSuapAccessRequest,
  fetchSuapAccessState,
  setSuapRequireGrant,
  upsertSuapAccessGrant,
  type SuapAccessGrant,
  type SuapAccessState,
} from '@/services/suapAccessAdmin';
import type { AdminUserGroup } from '@/services/userAdmin';

type GrantForm = {
  matricula: string;
  nome: string;
  status: 'ativo' | 'suspenso';
  validUntil: string;
  notes: string;
  groupIds: string[];
  campi: string[];
};

const EMPTY_FORM: GrantForm = { matricula: '', nome: '', status: 'ativo', validUntil: '', notes: '', groupIds: [], campi: [] };

function campusName(codigo: string) {
  return IFRN_CAMPUSES.find((campus) => campus.codigo === codigo)?.nome || codigo;
}

function toggle(list: string[], value: string, checked: boolean) {
  return checked ? Array.from(new Set([...list, value])) : list.filter((item) => item !== value);
}

export function SuapAccessGrantsPanel({ groups, onChanged }: { groups: AdminUserGroup[]; onChanged?: () => void }) {
  const [state, setState] = useState<SuapAccessState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [form, setForm] = useState<GrantForm>(EMPTY_FORM);
  const [editingMatricula, setEditingMatricula] = useState<string | null>(null);

  const groupNameById = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);

  const reload = useCallback(async () => {
    try {
      setState(await fetchSuapAccessState());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar as autorizações.');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setIsBusy(true);
    try {
      await action();
      toast.success(success);
      await reload();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a operação.');
    } finally {
      setIsBusy(false);
    }
  };

  const startEdit = (grant: SuapAccessGrant) => {
    setEditingMatricula(grant.matricula);
    setForm({
      matricula: grant.matricula,
      nome: grant.nome || '',
      status: grant.status,
      validUntil: grant.validUntil || '',
      notes: grant.notes || '',
      groupIds: grant.groupIds,
      campi: grant.campi,
    });
  };

  const resetForm = () => {
    setEditingMatricula(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = () =>
    run(async () => {
      await upsertSuapAccessGrant({
        matricula: form.matricula,
        nome: form.nome,
        status: form.status,
        validUntil: form.validUntil || null,
        notes: form.notes,
        groupIds: form.groupIds,
        campi: form.campi,
      });
      resetForm();
    }, 'Autorização salva. Vale a partir do próximo login da pessoa pelo SUAP.');

  if (loadError) {
    return (
      <SectionPanel title="Autorizações por matrícula (SUAP)" description="Defina perfil e campus de quem entra pelo SUAP.">
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </SectionPanel>
    );
  }

  if (!state) {
    return (
      <SectionPanel title="Autorizações por matrícula (SUAP)">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando autorizações...
        </div>
      </SectionPanel>
    );
  }

  return (
    <div className="space-y-6">
      <SectionPanel
        title="Autorizações por matrícula (SUAP)"
        description="Quem entra pelo SUAP recebe exatamente os perfis e campi cadastrados para a sua matrícula. Usuários sem autorização cadastrada continuam como estão."
      >
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Exigir autorização para novos acessos pelo SUAP</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Desligado: quem entra pelo SUAP sem autorização segue a regra antiga e recebe o perfil Diretores.
                Ligado: quem ainda não tem nenhum perfil fica com acesso pendente e aparece em Solicitações.
                Quem já tem perfil continua com o mesmo acesso nos dois casos.
              </p>
            </div>
            <Switch
              checked={state.requireGrant}
              disabled={isBusy}
              aria-label="Exigir autorização para novos acessos pelo SUAP"
              onCheckedChange={(checked) =>
                void run(() => setSuapRequireGrant(checked), checked ? 'Autorização passou a ser exigida para novos acessos.' : 'Regra antiga do login SUAP reativada.')
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Input
                value={form.matricula}
                disabled={Boolean(editingMatricula) || isBusy}
                onChange={(event) => setForm({ ...form, matricula: event.target.value })}
                placeholder="Matrícula do SUAP"
                aria-label="Matrícula do SUAP"
              />
              {form.matricula && normalizeMatricula(form.matricula) !== form.matricula.trim() ? (
                <p className="text-xs text-muted-foreground">Será salva como {normalizeMatricula(form.matricula)}</p>
              ) : null}
              <Input
                value={form.nome}
                disabled={isBusy}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
                placeholder="Nome (opcional, preenchido no primeiro login)"
                aria-label="Nome"
              />
              <div className="flex gap-3">
                <select
                  value={form.status}
                  disabled={isBusy}
                  onChange={(event) => setForm({ ...form, status: event.target.value as GrantForm['status'] })}
                  aria-label="Situação"
                  className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                </select>
                <Input
                  type="date"
                  value={form.validUntil}
                  disabled={isBusy}
                  onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
                  aria-label="Válido até"
                  title="Válido até (opcional)"
                  className="flex-1"
                />
              </div>
              <Textarea
                value={form.notes}
                disabled={isBusy}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Observações"
                aria-label="Observações"
                rows={2}
              />
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Perfis</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {groups.map((group) => (
                    <label key={group.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.groupIds.includes(group.id)}
                        disabled={isBusy}
                        onCheckedChange={(checked) => setForm({ ...form, groupIds: toggle(form.groupIds, group.id, checked === true) })}
                        aria-label={`Perfil ${group.name}`}
                      />
                      {group.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Campi permitidos</p>
                <p className="mb-2 text-xs text-muted-foreground">Sem nenhum marcado, a pessoa usa o campus do SUAP e pode trocar livremente, como hoje.</p>
                <div className="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
                  {IFRN_CAMPUSES.map((campus) => (
                    <label key={campus.codigo} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={form.campi.includes(campus.codigo)}
                        disabled={isBusy}
                        onCheckedChange={(checked) => setForm({ ...form, campi: toggle(form.campi, campus.codigo, checked === true) })}
                        aria-label={`Campus ${campus.nome}`}
                      />
                      {campus.nome}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {editingMatricula || form.matricula ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={isBusy}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
            ) : null}
            <Button type="button" onClick={() => void handleSave()} disabled={isBusy || !form.matricula.trim() || form.groupIds.length === 0}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingMatricula ? 'Salvar alterações' : 'Autorizar matrícula'}
            </Button>
          </div>
        </div>
      </SectionPanel>

      {state.requests.length > 0 ? (
        <DataTablePanel title="Solicitações de acesso" description="Pessoas que entraram pelo SUAP sem autorização cadastrada.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Campus no SUAP</TableHead>
                <TableHead>Última tentativa</TableHead>
                <TableHead className="w-[200px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.requests.map((request) => (
                <TableRow key={request.matricula}>
                  <TableCell>
                    <div className="font-semibold text-slate-800">{request.nome || request.matricula}</div>
                    <div className="text-xs text-slate-500">Matrícula {request.matricula}{request.vinculo ? ` · ${request.vinculo}` : ''}</div>
                  </TableCell>
                  <TableCell>{request.suapCampusUasg ? campusName(request.suapCampusUasg) : request.suapCampusSigla || '-'}</TableCell>
                  <TableCell>{new Date(request.lastSeenAt).toLocaleString('pt-BR')} ({request.attempts}x)</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingMatricula(null);
                          setForm({ ...EMPTY_FORM, matricula: request.matricula, nome: request.nome || '', campi: request.suapCampusUasg ? [request.suapCampusUasg] : [] });
                        }}
                      >
                        <UserCheck className="h-4 w-4" /> Autorizar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void run(() => dismissSuapAccessRequest(request.matricula), 'Solicitação descartada.')}
                      >
                        Descartar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTablePanel>
      ) : null}

      <DataTablePanel title="Matrículas autorizadas" description={`${state.grants.length} matrícula(s) cadastrada(s).`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Perfis</TableHead>
              <TableHead>Campi</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Último login SUAP</TableHead>
              <TableHead className="w-[120px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.grants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                  Nenhuma matrícula cadastrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              state.grants.map((grant) => (
                <TableRow key={grant.matricula}>
                  <TableCell>
                    <div className="font-semibold text-slate-800">{grant.nome || 'Ainda não entrou'}</div>
                    <div className="text-xs text-slate-500">Matrícula {grant.matricula}{grant.emailSuap ? ` · ${grant.emailSuap}` : ''}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {grant.groupIds.map((groupId) => (
                        <Badge key={groupId} variant="secondary">{groupNameById.get(groupId) || 'Perfil removido'}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {grant.campi.length > 0 ? grant.campi.map(campusName).join(', ') : `Campus do SUAP${grant.suapCampusSigla ? ` (${grant.suapCampusSigla})` : ''}`}
                  </TableCell>
                  <TableCell>
                    {grant.status === 'ativo' ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="warning">Suspenso</Badge>}
                    {grant.validUntil ? <div className="mt-1 text-xs text-slate-500">até {new Date(`${grant.validUntil}T12:00:00`).toLocaleDateString('pt-BR')}</div> : null}
                  </TableCell>
                  <TableCell className="text-xs">{grant.lastLoginAt ? new Date(grant.lastLoginAt).toLocaleString('pt-BR') : '-'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="icon" disabled={isBusy} onClick={() => startEdit(grant)} title="Editar">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar {grant.matricula}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={isBusy}
                        className="text-red-600 hover:text-red-700"
                        title="Remover autorização"
                        onClick={() => {
                          if (!window.confirm(`Remover a autorização da matrícula ${grant.matricula}? Os perfis que a pessoa já recebeu continuam até você alterá-los em Usuários.`)) return;
                          void run(() => deleteSuapAccessGrant(grant.matricula), 'Autorização removida.');
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Remover {grant.matricula}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DataTablePanel>
    </div>
  );
}
