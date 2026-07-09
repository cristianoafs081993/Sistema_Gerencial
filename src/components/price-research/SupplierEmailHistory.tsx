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
};

export function SupplierEmailHistory({ researchId }: Props) {
  const [dispatches, setDispatches] = useState<PriceResearchEmailDispatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  if (dispatches.length === 0 && !loading) return null;

  const sentCount = dispatches.filter((d) => d.status === 'sent').length;
  const failedCount = dispatches.filter((d) => d.status === 'failed').length;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Mail className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Histórico de Disparos de E-mail
          </span>
          {sentCount > 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs">
              {sentCount} enviado(s)
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200 text-xs">
              {failedCount} falha(s)
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); load(); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

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
