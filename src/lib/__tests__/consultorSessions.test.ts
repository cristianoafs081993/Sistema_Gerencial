import {
  createConsultorSession,
  getConsultorStorageKey,
  loadConsultorSessions,
  replaceSessionMessages,
  saveConsultorSessions,
} from '@/lib/consultorSessions';

describe('consultorSessions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('usa uma chave de storage diferente por usuario', () => {
    expect(getConsultorStorageKey('user-1', 'a@ifrn.edu.br')).not.toBe(
      getConsultorStorageKey('user-2', 'b@ifrn.edu.br'),
    );
  });

  it('persiste e carrega sessoes sem compartilhar entre chaves distintas', () => {
    const session = replaceSessionMessages(createConsultorSession(), [
      {
        id: 'user-msg',
        role: 'user',
        content: 'Analisar TR de limpeza',
      },
    ]);

    saveConsultorSessions(getConsultorStorageKey('user-1', 'a@ifrn.edu.br'), [session]);

    expect(loadConsultorSessions(getConsultorStorageKey('user-1', 'a@ifrn.edu.br'))).toHaveLength(1);
    expect(loadConsultorSessions(getConsultorStorageKey('user-2', 'b@ifrn.edu.br'))).toHaveLength(0);
  });
});
