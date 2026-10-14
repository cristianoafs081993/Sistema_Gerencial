(function (scope) {
  const SOURCE = 'siages-siafi-analysis';
  function validateSender(sender) {
    let url;
    try { url = new URL(sender?.url || ''); } catch { throw new Error('Origem SIAFI inválida.'); }
    if (sender?.frameId !== 0 || url.protocol !== 'https:' || url.hostname !== 'siafi.tesouro.gov.br') throw new Error('Acione a conferência na tela principal do SIAFI.');
  }
  async function handle(message, sender, post, openTab) {
    validateSender(sender);
    if (message.type === 'open-process') {
      if (!/^[0-9a-f-]{36}$/i.test(String(message.processoId || ''))) throw new Error('Processo inválido.');
      await openTab({ url: `https://www.siages.com.br/suap?processo=${encodeURIComponent(message.processoId)}`, active: true });
      return {};
    }
    if (!['prepare','start','status','retry','review'].includes(message.type)) throw new Error('Operação de conferência desconhecida.');
    return post({ ...message.payload, action: message.type });
  }
  scope.SiagesSiafiAnalysisBackground = { SOURCE, handle, validateSender };
})(globalThis);
