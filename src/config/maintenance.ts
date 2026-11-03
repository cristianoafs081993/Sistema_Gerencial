/**
 * Configuração do Modo de Manutenção do SIAGES
 *
 * Para ativar/desativar:
 * - Pode ser alternado diretamente aqui com `IS_MAINTENANCE_ENABLED: true | false`
 * - Ou via variável de ambiente `VITE_MAINTENANCE_MODE=true`
 *
 * Em caso de manutenção ativa, administradores podem contornar a tela usando:
 * - Acesso via URL: `?bypass=siages` ou `?bypass=true`
 * - Ou clicando no botão "Acesso Técnico" no rodapé da tela de manutenção.
 */

export const MAINTENANCE_CONFIG = {
  // ATIVO: Sistema em manutenção
  enabled: true,
  title: 'Sistema em Manutenção',
  subtitle: 'Estamos realizando melhorias programadas na infraestrutura do SIAGES.',
  description:
    'O acesso aos módulos do sistema está temporariamente suspenso para realização de atualizações e manutenções programadas no ambiente. Voltaremos em breve.',
  estimatedReturn: 'Previsão de retorno em breve',
  bypassSecret: 'siages',
};

export function isMaintenanceActive(): boolean {
  // Se for explicitamente desligado via env
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'false') {
    return false;
  }
  // Se for explicitamente ativado via env
  if (import.meta.env.VITE_MAINTENANCE_MODE === 'true') {
    return true;
  }
  // Verifica bypass via URL (?bypass=siages ou ?bypass=true)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const bypassParam = params.get('bypass');
    if (
      bypassParam === 'true' ||
      bypassParam === '1' ||
      bypassParam === MAINTENANCE_CONFIG.bypassSecret
    ) {
      sessionStorage.setItem('siages_maintenance_bypass', 'true');
      return false;
    }
    // Verifica se já fez bypass na sessão atual
    if (sessionStorage.getItem('siages_maintenance_bypass') === 'true') {
      return false;
    }
  }

  return MAINTENANCE_CONFIG.enabled;
}
