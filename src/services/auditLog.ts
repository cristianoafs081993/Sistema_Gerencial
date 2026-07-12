import { supabase } from '@/lib/supabase';

export type AuditEventType =
  | 'login'
  | 'logout'
  | 'admin_action'
  | 'permission_change'
  | 'user_created'
  | 'user_invited'
  | 'org_created'
  | 'org_updated'
  | 'module_permission_changed';

export type AuditEvent = {
  orgId?: string | null;
  eventType: AuditEventType;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Registra um evento na trilha de auditoria.
 * A chamada é silenciosa: erros nunca bloqueiam o fluxo do usuário.
 *
 * Satisfaz o requisito legal — inciso V:
 * "mecanismos de autenticação individual por usuário e senha,
 *  com registro de acessos e trilha de auditoria."
 */
export async function recordAuditEvent(event: AuditEvent): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id || !user?.email) return;

    await supabase.from('audit_log').insert({
      org_id: event.orgId ?? null,
      user_id: user.id,
      user_email: user.email,
      event_type: event.eventType,
      resource_type: event.resourceType ?? null,
      resource_id: event.resourceId ?? null,
      metadata: event.metadata ?? null,
    });
  } catch {
    // Auditoria nunca deve interromper a operação principal
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para os dois eventos obrigatórios (inciso V)
// ─────────────────────────────────────────────────────────────────────────────

/** Registra entrada no sistema. Chamado no AuthContext após login bem-sucedido. */
export function auditLogin(orgId?: string | null) {
  return recordAuditEvent({ orgId, eventType: 'login', resourceType: 'session' });
}

/** Registra saída do sistema. Chamado no AuthContext ao detectar SIGNED_OUT. */
export function auditLogout(orgId?: string | null) {
  return recordAuditEvent({ orgId, eventType: 'logout', resourceType: 'session' });
}

/** Registra ações administrativas do superadmin (criar usuário, alterar módulos, etc.). */
export function auditAdminAction(
  action: string,
  resourceType: string,
  resourceId?: string,
  orgId?: string | null,
  metadata?: Record<string, unknown>,
) {
  return recordAuditEvent({
    orgId,
    eventType: 'admin_action',
    resourceType,
    resourceId,
    metadata: { action, ...metadata },
  });
}
