import {
  AUTH_INVITE_MODE,
  AUTH_RECOVERY_MODE,
  buildInviteRedirectUrl,
  isLocalAuthRedirectUrl,
  normalizeAuthMode,
  normalizeNextPath,
  resolveAuthRedirectOrigin,
} from '@/lib/auth';

describe('auth helpers', () => {
  it('normaliza rotas de retorno inseguras para a raiz', () => {
    expect(normalizeNextPath('https://externo.com')).toBe('/');
    expect(normalizeNextPath('//externo.com')).toBe('/');
    expect(normalizeNextPath('/auth')).toBe('/');
  });

  it('aceita apenas modos esperados na pagina /auth', () => {
    expect(normalizeAuthMode(AUTH_INVITE_MODE)).toBe(AUTH_INVITE_MODE);
    expect(normalizeAuthMode(AUTH_RECOVERY_MODE)).toBe(AUTH_RECOVERY_MODE);
    expect(normalizeAuthMode('oauth')).toBeNull();
  });

  it('monta a URL de retorno do convite apontando para /auth em modo invite', () => {
    expect(buildInviteRedirectUrl('https://sistema.exemplo.gov.br', '/consultor')).toBe(
      'https://sistema.exemplo.gov.br/auth?mode=invite&next=%2Fconsultor',
    );
  });

  it('prioriza a origem publica configurada para o redirecionamento do convite', () => {
    expect(
      resolveAuthRedirectOrigin('http://localhost:8080', 'https://sistema.exemplo.gov.br/app'),
    ).toBe('https://sistema.exemplo.gov.br');
  });

  it('identifica URLs locais de redirecionamento de convite', () => {
    expect(isLocalAuthRedirectUrl('http://localhost:8080/auth?mode=invite')).toBe(true);
    expect(isLocalAuthRedirectUrl('https://sistema.exemplo.gov.br/auth?mode=invite')).toBe(false);
  });
});
