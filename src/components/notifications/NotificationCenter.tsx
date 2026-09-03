import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  Landmark,
  Receipt,
  Calendar,
  Send,
  Sparkles,
} from 'lucide-react';

import type { Empenho, Descentralizacao, Atividade, RequisicaoCompra, RequisicaoCompraRecord } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmpenhoDialog } from '@/components/modals/EmpenhoDialog';
import { requisicoesCompraService } from '@/services/requisicoesCompra';

const STORAGE_KEY = 'siages-notifications-last-read';
const MAX_EVENTS = 20;

export interface NotificationCenterProps {
  empenhos?: Empenho[];
  descentralizacoes?: Descentralizacao[];
  atividades?: Atividade[];
  requisicoesCompra?: (RequisicaoCompraRecord | RequisicaoCompra)[];
  onSaveEmpenho?: (id: string, data: Partial<Empenho>) => void;
  className?: string;
}

export type NotificationItem =
  | {
      id: string;
      type: 'empenho';
      date: Date;
      createdAt: Date;
      documentDate: Date;
      title: string;
      subtitle: string;
      description: string;
      valor: number;
      dimensao?: string;
      status?: string;
      raw: Empenho;
    }
  | {
      id: string;
      type: 'descentralizacao';
      date: Date;
      createdAt: Date;
      documentDate: Date;
      title: string;
      subtitle: string;
      description: string;
      valor: number;
      dimensao?: string;
      origem?: string;
      raw: Descentralizacao;
    }
  | {
      id: string;
      type: 'requisicao';
      date: Date;
      createdAt: Date;
      documentDate: Date;
      title: string;
      subtitle: string;
      description: string;
      valor: number;
      dimensao?: string;
      status?: string;
      raw: RequisicaoCompraRecord | RequisicaoCompra;
    };

function parseDate(value: Date | string | number | undefined | null): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return isNaN(value.getTime()) ? new Date(0) : value;
  if (typeof value === 'number') return new Date(value);

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return new Date(0);
    // Caso DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss
    if (trimmed.includes('/')) {
      const [datePart, timePart] = trimmed.split(' ');
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        const time = timePart || '12:00:00';
        const iso = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${time}`;
        const parsed = new Date(iso);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
    // Caso YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsed = new Date(`${trimmed}T12:00:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function extractDocNumber(numero?: string | null): number {
  if (!numero) return 0;
  const match = numero.match(/(\d{4})[A-Za-z]+(\d+)/);
  if (match) {
    const year = parseInt(match[1], 10);
    const seq = parseInt(match[2], 10);
    return year * 10_000_000 + seq;
  }
  const digits = numero.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function interleaveEvents(
  empenhos: NotificationItem[],
  descentralizacoes: NotificationItem[],
  requisicoes: NotificationItem[] = [],
  maxTotal = 20,
): NotificationItem[] {
  const result: NotificationItem[] = [];
  const maxLen = Math.max(empenhos.length, descentralizacoes.length, requisicoes.length);

  for (let i = 0; i < maxLen && result.length < maxTotal; i++) {
    if (requisicoes[i] && result.length < maxTotal) {
      result.push(requisicoes[i]);
    }
    if (descentralizacoes[i] && result.length < maxTotal) {
      result.push(descentralizacoes[i]);
    }
    if (empenhos[i] && result.length < maxTotal) {
      result.push(empenhos[i]);
    }
  }

  return result;
}

function formatNotificationDate(date: Date): string {
  if (!date || isNaN(date.getTime()) || date.getTime() === 0) return '-';
  return date.toLocaleDateString('pt-BR');
}

const statusBadgeVariantMap: Record<string, 'warning' | 'info' | 'success' | 'destructive' | 'default'> = {
  pendente: 'warning',
  liquidado: 'info',
  pago: 'success',
  cancelado: 'destructive',
  enviada_fornecedor: 'warning',
  review: 'warning',
  approved: 'warning',
};

const statusLabelMap: Record<string, string> = {
  pendente: 'Pendente',
  liquidado: 'Liquidado',
  pago: 'Pago',
  cancelado: 'Cancelado',
  enviada_fornecedor: 'Enviada ao Fornecedor',
  review: 'Enviada ao Fornecedor',
  approved: 'Enviada ao Fornecedor',
};

export function NotificationCenter({
  empenhos = [],
  descentralizacoes = [],
  atividades = [],
  requisicoesCompra: propsRequisicoesCompra,
  onSaveEmpenho,
  className,
}: NotificationCenterProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedEmpenho, setSelectedEmpenho] = useState<Empenho | null>(null);
  const [isEmpenhoDialogOpen, setIsEmpenhoDialogOpen] = useState(false);

  // Busca requisições recentes via React Query se não fornecidas por prop
  const { data: queriedRequisicoes = [] } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => requisicoesCompraService.listRecentRequisicoes(),
    enabled: propsRequisicoesCompra === undefined,
    staleTime: 1000 * 60 * 2,
  });

  const requisicoes = propsRequisicoesCompra ?? queriedRequisicoes;

  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  // Consolidar empenhos, descentralizações e requisições enviadas ao fornecedor (máx 20 eventos)
  const allNotifications = useMemo<NotificationItem[]>(() => {
    // 1. Mapear e ordenar descentralizações decrescentemente pela data oficial de emissão (as mais recentes primeiro)
    const sortedDescentralizacoes: NotificationItem[] = descentralizacoes
      .map((d) => {
        const docDate = parseDate(d.dataEmissao || d.createdAt);
        const createdDate = parseDate(d.createdAt || d.dataEmissao);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        return {
          id: `desc-${d.id || d.notaCredito || Math.random().toString()}`,
          type: 'descentralizacao' as const,
          date: effectiveDate,
          createdAt: createdDate,
          documentDate: docDate,
          title: d.notaCredito ? `Descentralização ${d.notaCredito}` : 'Descentralização de Crédito',
          subtitle: d.origemRecurso ? `Origem: ${d.origemRecurso}` : 'Origem não informada',
          description: d.descricao || (d.planoInterno ? `PI: ${d.planoInterno}` : ''),
          valor: Number(d.valor) || 0,
          dimensao: d.dimensao,
          origem: d.origemRecurso,
          raw: d,
        };
      })
      .sort((a, b) => {
        const dateDiff = b.date.getTime() - a.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        const numA = extractDocNumber(a.raw.notaCredito);
        const numB = extractDocNumber(b.raw.notaCredito);
        if (numA !== 0 && numB !== 0 && numA !== numB) {
          return numB - numA;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    // 2. Mapear e ordenar empenhos pelos últimos emitidos (maior número sequencial de NE primeiro)
    const sortedEmpenhos: NotificationItem[] = empenhos
      .map((e) => {
        const docDate = parseDate(e.dataEmpenho || e.createdAt);
        const createdDate = parseDate(e.createdAt || e.dataEmpenho);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        return {
          id: `emp-${e.id || e.numero}`,
          type: 'empenho' as const,
          date: effectiveDate,
          createdAt: createdDate,
          documentDate: docDate,
          title: `Empenho ${e.numero}`,
          subtitle: e.favorecidoNome || 'Favorecido não informado',
          description: e.descricao || '',
          valor: Number(e.valor) || 0,
          dimensao: e.dimensao,
          status: e.status || 'pendente',
          raw: e,
        };
      })
      .sort((a, b) => {
        const numA = extractDocNumber(a.raw.numero);
        const numB = extractDocNumber(b.raw.numero);
        if (numA !== 0 && numB !== 0 && numA !== numB) {
          return numB - numA;
        }
        const dateDiff = b.date.getTime() - a.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    // 3. Mapear e ordenar requisições de compra com status 'enviada_fornecedor' (ou review/approved)
    const sortedRequisicoes: NotificationItem[] = requisicoes
      .filter((r) => r.status === 'enviada_fornecedor' || r.status === 'review' || r.status === 'approved')
      .map((r) => {
        const docDate = parseDate(r.updatedAt || r.createdAt);
        const createdDate = parseDate(r.createdAt || r.updatedAt);
        const effectiveDate = docDate.getTime() > 0 ? docDate : createdDate;

        const empenhoLabels = r.empenhos?.length
          ? r.empenhos.map((e) => e.empenhoNumero).filter(Boolean).join(', ')
          : r.empenhoNumero || '';

        return {
          id: `req-${r.id || r.number}`,
          type: 'requisicao' as const,
          date: effectiveDate,
          createdAt: createdDate,
          documentDate: docDate,
          title: r.number ? `Requisição ${r.number}` : 'Requisição de Compra',
          subtitle: r.createdByEmail ? `Criador: ${r.createdByEmail}` : 'Enviada ao Fornecedor',
          description: r.title || (empenhoLabels ? `Empenho(s): ${empenhoLabels}` : (r.contratoNumero ? `Contrato: ${r.contratoNumero}` : '')),
          valor: Number(r.totalValue) || 0,
          status: r.status,
          raw: r,
        };
      })
      .sort((a, b) => {
        const dateDiff = b.date.getTime() - a.date.getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    // 4. Intercalar os últimos eventos (requisições, descentralizações e empenhos)
    return interleaveEvents(sortedEmpenhos, sortedDescentralizacoes, sortedRequisicoes, MAX_EVENTS);
  }, [empenhos, descentralizacoes, requisicoes]);

  // Contagem de itens não lidos dentre os últimos eventos
  const unreadCount = useMemo(() => {
    if (lastReadTimestamp === 0) return Math.min(allNotifications.length, MAX_EVENTS);
    return allNotifications.filter((item) => item.date.getTime() > lastReadTimestamp).length;
  }, [allNotifications, lastReadTimestamp]);

  const hasUnread = unreadCount > 0;

  const markAllAsRead = () => {
    const now = Date.now();
    setLastReadTimestamp(now);
    try {
      localStorage.setItem(STORAGE_KEY, now.toString());
    } catch {
      // Ignorar falha de storage local
    }
  };

  const handleEmpenhoClick = (empenho: Empenho) => {
    setSelectedEmpenho(empenho);
    setIsEmpenhoDialogOpen(true);
    setIsOpen(false);
  };

  const handleDescentralizacaoClick = () => {
    setIsOpen(false);
    navigate('/descentralizacoes');
  };

  const handleRequisicaoClick = () => {
    setIsOpen(false);
    navigate('/requisicao-compra');
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'p-1.5 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              isOpen && 'bg-muted text-foreground',
              className,
            )}
            title={hasUnread ? `Central de Notificações (${unreadCount} não lida${unreadCount > 1 ? 's' : ''})` : 'Central de Notificações'}
            aria-label={hasUnread ? `Abrir central de notificações (${unreadCount} não lida${unreadCount > 1 ? 's' : ''})` : 'Abrir central de notificações'}
          >
            <Bell className="w-4 h-4 md:w-4.5 md:h-4.5" />
            {hasUnread && (
              <span
                data-testid="notification-unread-badge"
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-[10px] leading-none border-2 border-card shadow-xs select-none pointer-events-none"
                title={`${unreadCount} novidade(s)`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="w-[360px] sm:w-[410px] max-w-[calc(100vw-24px)] p-0 shadow-2xl rounded-2xl border-border bg-card overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground">Notificações</h3>
                  {hasUnread && (
                    <Badge variant="brand" className="text-[10px] px-1.5 py-0 h-4 font-bold shrink-0">
                      {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">Últimos {MAX_EVENTS} eventos e requisições</p>
              </div>
            </div>

            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground gap-1 shrink-0 ml-2"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Marcar lidas</span>
              </Button>
            )}
          </div>

          {/* Lista Unificada e Intercalada de Notificações */}
          <ScrollArea className="max-h-[390px] overflow-y-auto pl-2 pr-3.5 py-2">
            {allNotifications.length === 0 ? (
              <div className="py-8 text-center px-4 space-y-2">
                <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                  <Sparkles className="w-5 h-5 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-foreground">Nenhum evento encontrado</p>
                <p className="text-[11px] text-muted-foreground">
                  Não há movimentações orçamentárias ou requisições recentes para exibir.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {allNotifications.map((item) => {
                  const isUnread = lastReadTimestamp === 0 || item.date.getTime() > lastReadTimestamp;

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (item.type === 'empenho') {
                          handleEmpenhoClick(item.raw as Empenho);
                        } else if (item.type === 'requisicao') {
                          handleRequisicaoClick();
                        } else {
                          handleDescentralizacaoClick();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (item.type === 'empenho') {
                            handleEmpenhoClick(item.raw as Empenho);
                          } else if (item.type === 'requisicao') {
                            handleRequisicaoClick();
                          } else {
                            handleDescentralizacaoClick();
                          }
                        }
                      }}
                      className={cn(
                        'group relative flex items-start gap-2.5 p-2.5 rounded-xl border border-transparent transition-all text-left cursor-pointer hover:bg-muted/60 hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isUnread ? 'bg-primary/[0.03] border-primary/10' : 'bg-transparent',
                      )}
                    >
                      {/* Ícone de Tipo */}
                      <div
                        className={cn(
                          'p-2 rounded-lg shrink-0 mt-0.5 transition-colors',
                          item.type === 'empenho'
                            ? 'bg-blue-500/10 text-blue-600 group-hover:bg-blue-500/20'
                            : item.type === 'requisicao'
                              ? 'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-500/20',
                        )}
                      >
                        {item.type === 'empenho' ? (
                          <Receipt className="w-4 h-4" />
                        ) : item.type === 'requisicao' ? (
                          <Send className="w-4 h-4" />
                        ) : (
                          <Landmark className="w-4 h-4" />
                        )}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.title}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {item.type === 'empenho' && item.status && (
                              <Badge
                                variant={statusBadgeVariantMap[item.status] || 'default'}
                                className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider font-semibold shrink-0 whitespace-nowrap"
                              >
                                {statusLabelMap[item.status] || item.status}
                              </Badge>
                            )}
                            {item.type === 'descentralizacao' && (
                              <Badge variant="success" className="text-[9px] px-1.5 py-0 h-4 font-semibold shrink-0 whitespace-nowrap">
                                NC
                              </Badge>
                            )}
                            {item.type === 'requisicao' && (
                              <Badge
                                variant="warning"
                                className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider font-semibold shrink-0 whitespace-nowrap bg-amber-100 text-amber-900 border-amber-300"
                              >
                                Enviada
                              </Badge>
                            )}
                          </div>
                        </div>

                        <p className="text-[11px] text-foreground/80 font-medium truncate">
                          {item.subtitle}
                        </p>

                        {item.description && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {item.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-0.5 gap-1.5 text-[10px] text-muted-foreground">
                          <span className="font-bold text-xs text-foreground font-ui shrink-0">
                            {formatCurrency(item.valor)}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.dimensao && (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium shrink-0">
                                {item.dimensao.split(' - ')[0] || item.dimensao}
                              </span>
                            )}
                            <span className="flex items-center gap-1 shrink-0 text-[10px] whitespace-nowrap">
                              <Calendar className="w-3 h-3 opacity-60 shrink-0" />
                              {formatNotificationDate(item.documentDate || item.date)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ponto indicador de não lido na linha */}
                      {isUnread && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 self-center" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Modal para inspeção direta de empenho */}
      {selectedEmpenho && (
        <EmpenhoDialog
          open={isEmpenhoDialogOpen}
          onOpenChange={setIsEmpenhoDialogOpen}
          empenho={selectedEmpenho}
          atividades={atividades}
          onSave={onSaveEmpenho ? (id, data) => onSaveEmpenho(id, data) : () => {}}
        />
      )}
    </>
  );
}
