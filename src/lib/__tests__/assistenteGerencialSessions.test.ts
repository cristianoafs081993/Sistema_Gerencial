import {
  createAssistenteGerencialSession,
  getAssistenteGerencialStorageKey,
  loadAssistenteGerencialSession,
  replaceAssistenteGerencialMessages,
  saveAssistenteGerencialSession,
} from '@/lib/assistenteGerencialSessions';

describe('assistenteGerencialSessions', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('usa uma chave de storage diferente por usuario', () => {
    expect(getAssistenteGerencialStorageKey('user-1', 'a@ifrn.edu.br')).not.toBe(
      getAssistenteGerencialStorageKey('user-2', 'b@ifrn.edu.br'),
    );
  });

  it('persiste e carrega a conversa sem compartilhar entre usuarios', () => {
    const session = replaceAssistenteGerencialMessages(createAssistenteGerencialSession(), [
      {
        id: 'user-msg',
        role: 'user',
        content: 'Qual o saldo de credito disponivel?',
      },
    ]);

    saveAssistenteGerencialSession(getAssistenteGerencialStorageKey('user-1', 'a@ifrn.edu.br'), session);

    expect(loadAssistenteGerencialSession(getAssistenteGerencialStorageKey('user-1', 'a@ifrn.edu.br')).messages).toHaveLength(1);
    expect(loadAssistenteGerencialSession(getAssistenteGerencialStorageKey('user-2', 'b@ifrn.edu.br')).messages).toHaveLength(1);
    expect(loadAssistenteGerencialSession(getAssistenteGerencialStorageKey('user-2', 'b@ifrn.edu.br')).messages[0].role).toBe('assistant');
  });
});
