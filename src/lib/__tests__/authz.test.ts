import { SUPERADMIN_EMAIL, isSuperAdminEmail, isSuperAdminUser, normalizeEmail } from '@/lib/authz';

describe('authz helpers', () => {
  it('normaliza e-mails para lowercase e trim', () => {
    expect(normalizeEmail('  Cristiano.CNRN@GMAIL.COM ')).toBe(SUPERADMIN_EMAIL);
  });

  it('reconhece o e-mail do superadministrador', () => {
    expect(isSuperAdminEmail('cristiano.cnrn@gmail.com')).toBe(true);
    expect(isSuperAdminEmail('outro@ifrn.edu.br')).toBe(false);
  });

  it('aceita o superadministrador por e-mail ou app_metadata', () => {
    expect(isSuperAdminUser({ email: SUPERADMIN_EMAIL })).toBe(true);
    expect(isSuperAdminUser({ email: 'outro@ifrn.edu.br', app_metadata: { role: 'superadmin' } })).toBe(true);
    expect(isSuperAdminUser({ email: 'outro@ifrn.edu.br', app_metadata: { is_superadmin: true } })).toBe(true);
    expect(isSuperAdminUser({ email: 'outro@ifrn.edu.br' })).toBe(false);
  });
});
