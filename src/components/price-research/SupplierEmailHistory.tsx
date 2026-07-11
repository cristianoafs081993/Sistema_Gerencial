import { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  priceResearchEmailService,
  MODALITY_LABELS,
  type PriceResearchEmailDispatch,
} from '@/services/priceResearchEmail';

type Props = {
  researchId: string;
  defaultExpanded?: boolean;
  showEmptyState?: boolean;
};

export function SupplierEmailHistory({ researchId, defaultExpanded = false, showEmptyState = false }: Props) {
  const [dispatches, setDispatches] = useState<PriceResearchEmailDispatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const load = async () => {
    setLoading(true);
    try {
      const list = await priceResearchEmailService.listDispatches(researchId);
      setDispatches(list);
    } catch {
      // silently ignore on widget
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (researchId) load();
  }, [researchId]);

  if (dispatches.length === 0 && !loading) {
    if (!showEmptyState) return null;

    return (
      <div className="rounded-radius-lg border border-dashed border-border-default bg-surface-subtle/35 px-5 py-8 text-center">
        <Mail className="mx-auto h-5 w-5 text-text-muted" />
        <p className="mt-3 text-sm font-semibold text-text-primary">Nenhum e-mail registrado</p>
        <p className="mt-1 text-xs text-text-secondary">
          Os envios realizados por esta pesquisa aparecerao aqui.
        </p>
      </div>
    );
  }

  const sentCount = dispatches.filter((d) => d.status === 'sent').length;
  const failedCount = dispatches.filter((d) => d.status === 'failed').length;

  return (
    <div className="overflow-hidden rounded-radius-lg border border-border-default bg-surface-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-surface-subtle/45 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:text-primary"
        >
          <Mail className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold text-foreground">
            Histórico de e-mails
          </span>
          {sentCount > 0 && (
            <Badge variant="secondary" className="shrink-0 border-green-200 bg-green-100 text-xs text-green-700">
              {sentCount} enviado(s)
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="secondary" className="shrink-0 border-red-200 bg-red-100 text-xs text-red-700">
              {failedCount} falha(s)
            </Badge>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void load()}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Atualizar"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Table */}
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Data/Hora</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Modalidade</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Destinatário</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">E-mail</th>
                <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((d, idx) => (
                <tr
                  key={d.id}
                  className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}`}
                >
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {d.sentAt
                        ? new Date(d.sentAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : new Date(d.createdAt).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground">
                    {MODALITY_LABELS[d.modality] ?? d.modality}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-foreground font-medium max-w-[160px] truncate">
                    {d.recipientName || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                    {d.recipientEmail}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {d.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Enviado
                      </span>
                    ) : d.status === 'failed' ? (
                      <span
                        title={d.errorMessage ?? ''}
                        className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5 font-medium cursor-help"
                      >
                        <XCircle className="w-3 h-3" /> Falha
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
