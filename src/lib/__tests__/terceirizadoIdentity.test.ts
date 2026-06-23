import {
  getAuthUserMatricula,
  normalizeMatricula,
  permissionMatchesAuthUser,
  permissionMatchesTerceirizado,
} from '@/lib/terceirizadoIdentity';

describe('terceirizadoIdentity', () => {
  it('normaliza matricula do SUAP para chave de comparacao', () => {
    expect(normalizeMatricula(' 2024.001-AB ')).toBe('2024001ab');
  });

  it('extrai matricula dos metadados do usuario autenticado', () => {
    expect(
      getAuthUserMatricula({
        user_metadata: { matricula: ' 123.456-7 ' },
      }),
    ).toBe('1234567');
  });

  it('prioriza matricula ao comparar permissao com terceirizado cadastrado', () => {
    expect(
      permissionMatchesTerceirizado(
        { userMatricula: '1234567', userEmail: 'antigo@ifrn.edu.br' },
        { matricula: '123.456-7', email: 'novo@ifrn.edu.br' },
      ),
    ).toBe(true);
  });

  it('permite fallback por email apenas para permissoes legadas sem matricula', () => {
    expect(
      permissionMatchesTerceirizado(
        { userEmail: 'teste@ifrn.edu.br' },
        { email: 'TESTE@ifrn.edu.br' },
      ),
    ).toBe(true);
  });

  it('autoriza usuario SUAP por matricula mesmo com email diferente', () => {
    expect(
      permissionMatchesAuthUser(
        { userMatricula: '7654321', userEmail: 'legado@ifrn.edu.br' },
        {
          id: 'user-1',
          email: 'suap@ifrn.edu.br',
          user_metadata: { matricula: '765.432-1' },
        },
      ),
    ).toBe(true);
  });
});
