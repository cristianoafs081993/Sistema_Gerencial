import { useCallback, useEffect, useState } from 'react';
import { FileSearch, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { HeaderActions } from '@/components/HeaderParts';
import { DataTablePanel } from '@/components/design-system/DataTablePanel';
import { FilterPanel } from '@/components/design-system/FilterPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type AuditEntry = {
  id: string;
  org_id: string | null;
  user_id: string | null;
  user_email: string;
  event_type: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  orgs?: { name: string } | null;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  admin_action: 'Ação admin',
  permission_change: 'Alteração de permissão',
  user_created: 'Usuário criado',
  user_invited: 'Convite enviado',
  org_created: 'Órgão criado',
  org_updated: 'Órgão atualizado',
  module_permission_changed: 'Módulos alterados',
};

const EVENT_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'warning' | 'destructive'> = {
  login: 'default',
  logout: 'secondary',
  admin_action: 'warning',
  permission_change: 'warning',
  user_created: 'default',
  user_invited: 'default',
  org_created: 'default',
  org_updated: 'secondary',
  module_permission_changed: 'warning',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function AuditLog() {
  const { isSuperAdmin } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterEmail, setFilterEmail] = useState('');
  const [filterEventType, setFilterEventType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-slate-500">
        Acesso restrito ao superadministrador.
      </div>
    );
  }

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('audit_log')
        .select('id,org_id,user_id,user_email,event_type,resource_type,resource_id,metadata,ip_address,created_at,orgs(name)')
        .order('created_at', { ascending: false })
        .limit(300);

      if (filterEmail.trim()) {
        query = query.ilike('user_email', `%${filterEmail.trim()}%`);
      }
      if (filterEventType) {
        query = query.eq('event_type', filterEventType);
      }
      if (filterDateFrom) {
        query = query.gte('created_at', `${filterDateFrom}T00:00:00`);
      }
      if (filterDateTo) {
        query = query.lte('created_at', `${filterDateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEntries((data || []) as AuditEntry[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao carregar trilha de auditoria.');
    } finally {
      setIsLoading(false);
    }
  }, [filterEmail, filterEventType, filterDateFrom, filterDateTo]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const handleExportCSV = () => {
    if (entries.length === 0) return;

    const headers = ['Data/Hora', 'Usuário', 'Órgão', 'Evento', 'Recurso', 'ID Recurso', 'IP'];
    const rows = entries.map((e) => [
      formatDateTime(e.created_at),
      e.user_email,
      e.orgs?.name || e.org_id || '',
      EVENT_TYPE_LABELS[e.event_type] || e.event_type,
      e.resource_type || '',
      e.resource_id || '',
      e.ip_address || '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trilha-auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <HeaderActions>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadEntries()}
          disabled={isLoading}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleExportCSV} disabled={entries.length === 0}>
          Exportar CSV
        </Button>
      </HeaderActions>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1a1a19]">Administração</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#34322d]">Trilha de Auditoria</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#858481]">
          Registro individual de acessos por usuário e senha — requisito legal inciso V. Exibe os últimos 300
          eventos. Use os filtros para localizar registros específicos.
        </p>
      </div>

      {/* Filtros */}
      <FilterPanel title="Filtros">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Filtrar por e-mail"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value)}
          />
          <select
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="input-system h-10 rounded-md px-3 text-sm"
          >
            <option value="">Todos os eventos</option>
            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input
            type="date"
            placeholder="Data inicial"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
          <Input
            type="date"
            placeholder="Data final"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>
      </FilterPanel>

      {/* Tabela */}
      <DataTablePanel
        title="Registros de acesso"
        description={
          isLoading
            ? 'Carregando...'
            : `${entries.length} registro(s) encontrado(s)`
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando registros...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-sm text-slate-400">
            <FileSearch className="h-8 w-8" />
            Nenhum registro encontrado para os filtros aplicados.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(entry.created_at)}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-800">
                    {entry.user_email}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {entry.orgs?.name || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={EVENT_TYPE_VARIANT[entry.event_type] || 'secondary'} className="text-xs">
                      {EVENT_TYPE_LABELS[entry.event_type] || entry.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {entry.resource_type ? `${entry.resource_type}${entry.resource_id ? ` / ${entry.resource_id}` : ''}` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {entry.ip_address || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataTablePanel>
    </div>
  );
}
