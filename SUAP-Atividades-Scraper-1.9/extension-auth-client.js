(function () {
  const AUTH_MESSAGE_SOURCE = 'siages-extension-auth';

  function request(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const runtime = globalThis.chrome?.runtime;
      if (!runtime?.sendMessage) {
        reject(new Error('O serviço de autenticação da extensão não está disponível.'));
        return;
      }

      try {
        runtime.sendMessage({ source: AUTH_MESSAGE_SOURCE, type, ...payload }, (response) => {
          const runtimeError = runtime.lastError;
          if (runtimeError) {
            reject(new Error(runtimeError.message || 'A extensão não respondeu à solicitação de autenticação.'));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error || 'Não foi possível concluir a operação de autenticação.'));
            return;
          }
          resolve(response);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  globalThis.SiagesExtensionAuth = {
    getSession: async () => (await request('get-session')).session || null,
    signIn: async (email, password) => (await request('sign-in', { email, password })).session,
    signOut: async () => { await request('sign-out'); },
  };
})();
