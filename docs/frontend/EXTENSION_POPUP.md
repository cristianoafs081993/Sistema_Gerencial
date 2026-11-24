# Tela inicial da extensão SIAGES

Na versão 1.9.63, o popup e o nome exibido pelo navegador usam **SIAGES** e exibem a logo institucional do sistema. O subtítulo “Extensão para o navegador” foi removido.

## Organização

Layout com menu lateral (novembro de 2026): o popup ocupa 800 × 580 px, perto do limite de 800 × 600 px que o Chrome permite. À esquerda fica um menu fixo de 248 px; à direita, a seção escolhida, com rolagem própria. Só uma seção aparece por vez. O menu segue o padrão de sidebar do design system: fundo branco, rótulos de grupo em caixa alta, item ativo em `accent` com ponto azul à direita.

- Topo do menu com a logo institucional e o nome SIAGES; rodapé com o link `Abrir SIAGES` e a dica `Ctrl + K`.
- Grupo **Geral**: **Conta**, **Favorecidos SIAFI** (só com a aba do SIAFI ativa), **Atalhos de texto**, **Modelos e preenchimentos** e **Painel do processo**. Grupo **Sincronização** (só superadministrador): **Caixas de processos**, **Atividades — Plano 8** e **RDs**, cada um com sua própria seção.
- O popup reabre na última seção escolhida (`localStorage`, chave `siages-popup-section`). Se essa seção não estiver disponível (sincronização sem permissão ou ainda em verificação), mostra a Conta e passa para a seção salva assim que ela ficar disponível. Ao sair da conta numa seção de sincronização, volta para a Conta.
- Com a aba do SIAFI ativa, o popup abre direto em **Favorecidos SIAFI**, sem trocar a seção salva.
- O menu sinaliza o estado sem abrir a seção: ponto de presença no ícone da Conta (verde conectado, cinza desconectado, âmbar quando a verificação falha), total de atalhos, `Aviso`/`Rodando` nas caixas de processos, `Prévia` nas atividades e `Coletando`/`Conferir`/`Aviso` nas RDs (unidade atual ou lote). Esses selos substituem a abertura automática dos antigos painéis expansíveis. Quando o item ativo tem selo, o ponto azul é omitido.
- **Sua conta** concentra autenticação e vínculo de campus (UASG). Enquanto verifica a sessão, não exibe formulário nem usuário. Sem sessão, oferece e-mail, senha e `Entrar no SIAGES`, também acionável com Enter. Com sessão, mostra avatar com a inicial, o e-mail, o estado `Conectado`, `Sair` e o seletor **Campus vinculado (UASG)** (padrão `158366 — Currais Novos`, sincronizado com `user_campus_preferences` / `set_user_campus_uasg`), ocultando o formulário. A mensagem de sessão renovada só aparece em caso de erro, aviso ou desconexão. A senha é limpa após entrar ou sair; alterações da sessão ou da UASG em outros contextos atualizam o popup.
- **Sincronização**: desde a versão 1.9.63, é exclusiva do superadministrador. As três seções ficam dentro de `#sync-section`, que começa oculto e só aparece após a confirmação da sessão. Mensagens de autenticação permanecem na Conta. Os controles e estados de atividades e RDs continuam independentes.
- **Atalhos de texto** (1.9.83) fica disponível mesmo sem login. O formulário (`Novo atalho` / `Editar atalho /x`) vem antes da lista com busca. Permite buscar, criar, editar (inclusive trocar o gatilho) e remover atalhos como `/cn`, usando a mesma chave `siages-snippets` do painel do SUAP e do expansor. Gatilhos são normalizados (barra inicial, minúsculas, sem espaços) e duplicados são recusados. A lista reage a `chrome.storage.onChanged`, então atalhos recebidos de outro perfil pelo SIAGES aparecem sem reabrir o popup.
- **Modelos e preenchimentos** reúne o que antes era fixo no código para o servidor de Currais Novos. Ver a seção a seguir.
- **Painel do processo** escolhe os blocos da aba **Resumo** do painel SIAGES nas páginas de processo do SUAP. Ver a seção a seguir.

## Modelos e preenchimentos (novembro de 2026)

Valores que cada servidor ajusta para o próprio setor e campus. Ficam em `chrome.storage.sync`, chave `siages-user-preferences`, e acompanham a conta Google conectada ao Chrome (não passam pelo banco do SIAGES; não há migration nem Edge Function). O módulo `user-preferences.js` concentra padrões, validação e leitura/gravação. Ele é carregado antes de `command-palette.js` e `process-document.js` no manifest e antes de `popup.js` no popup. Sem o módulo, a seção não é oferecida.

- **Atalhos de encaminhamento**: lista de até 15 atalhos da paleta. Cada um tem atalho (2 a 15 letras, sem números), nome na paleta, texto do despacho (com parágrafos), campus e setor de destino (nome + ID no SUAP) e perfil de quem encaminha. Na paleta, `<atalho> <id>` abre `processo/encaminhar/{id}/#siagesEncaminhar=` com esses valores. O `encdg` (DG/CN, campus CN id 3, setor id 841, perfil ASSISTENTE EM ADMINISTRACAO) é o atalho inicial e pode ser editado, renomeado ou removido, com opção de desfazer.
  - `Copiar da página aberta` lê, na aba ativa com a tela “Encaminhar” do SUAP, o campus, o setor e o perfil escolhidos (e o despacho, se o campo do atalho estiver vazio). Assim o servidor não precisa descobrir os IDs.
  - São recusados atalhos repetidos, sem campus/setor e os já usados pela paleta (`up`, `enc`, `encs`, `capa`, `vis`, `desp`, `cie` e sinônimos, além dos prefixos de busca como `ne`, `con`, `doc`, `aluno`).
- **Upload de documento (`up`)**: tipo de conferência, tipo de documento e assunto usados em `up <id>` e no Alt + clique sobre o número do processo. Campo vazio volta ao padrão (`Cópia Simples` / `Liquidação` / `Liquidação`). O envio de comprovantes do SIAFI (`siafi-upload-bridge.js`) continua sempre como `Liquidação`.
- **Despacho de liquidação**: destinatário, assunto, encaminhamento final e fecho do despacho gerado pelo SIAGES no SUAP. Vazio mantém o texto padrão; `{campus}` vira o nome do campus vinculado à conta (no SIAGES, `userCampus.nome`). O corpo (considerandos e AUTORIZO) continua montado conforme o tipo de despesa. A extensão envia só os campos personalizados em `despachoModelo` no contexto do processo; o SIAGES aceita apenas `destinatario`, `assunto`, `encaminhamento` e `fecho` como texto, dentro do limite de cada um.

O limite de 8 KB por item do `chrome.storage.sync` é verificado antes de gravar; acima dele, o popup pede para encurtar os textos ou remover atalhos. Mudanças valem na hora na paleta e no painel do processo, sem recarregar a página.

## Painel do processo: blocos da aba Resumo (novembro de 2026)

Caixas de marcar, em duas colunas, para os blocos do **Resumo** montado por `process-document.js`: Processo, Beneficiário, RPs / NPs, Documento e pagamento, Dados bancários, Retenções e empenhos (ou Empenhos, com várias notas), Conclusão, Caminho do processo e Lista de credores. Cada clique grava na hora; `Mostrar todos` desfaz as escolhas. O menu mostra quantos estão visíveis (ex.: `7/9`) quando há algum oculto.

- A preferência fica na mesma chave `siages-user-preferences`, em `hiddenSummaryBlocks`. Guarda só os ocultos, então um bloco criado no futuro aparece por padrão. IDs desconhecidos são descartados.
- O painel lê a preferência antes do primeiro desenho, para os blocos ocultos não aparecerem por um instante, e redesenha o Resumo quando ela muda, inclusive em abas do SUAP já abertas.
- Blocos sem dados no processo continuam fora do Resumo, mesmo marcados. O aviso de sincronização no topo do Resumo é sempre exibido.
- Com todos os blocos ocultos, o Resumo mostra um aviso indicando onde reativá-los, em vez de ficar vazio.
- As outras abas do painel (Orçamentário, Atalhos, IA e Config.) não mudam.

### Valores revisados e mantidos fixos

- Atalhos de texto padrão (`/cn`, `/atpub`, `/ifrn`, `/lei14133`): são só o ponto de partida e já são editáveis em **Atalhos de texto**.
- UASG padrão `158366`: é apenas o valor inicial; o servidor escolhe o campus em **Sua conta**.
- E-mail do superadministrador: é regra de acesso (igual a `src/lib/authz.ts`), não preferência.
- Unidade `19` na sincronização do Plano 8: fallback da área exclusiva do superadministrador.
- Textos institucionais de Currais Novos no SIAGES web (contexto do ETP, pesquisa de preços, e-mail a fornecedores): pertencem às telas do SIAGES e dependem do cadastro do campus, não da extensão.

O campo `Segredo de automação` foi retirado, junto com a leitura e escrita da sua preferência no popup. Esse valor não era utilizado pelos fluxos atuais de sincronização. Não há novo contrato de backend nem alteração em migrations ou Edge Functions.

## Recuperação de sessão (1.9.76)

O worker reconhece o campo REST `error_code` do Supabase, mesmo quando `code` é numérico ou `error` contém um motivo genérico. `refresh_token_not_found`, `refresh_token_already_used`, `session_not_found`, `session_expired`, `invalid_grant` e HTTP 401 encerram a sessão local e orientam abrir o popup e entrar novamente. Assim, uma sessão recusada definitivamente não fica repetindo o aviso de falha temporária. Falhas de rede, HTTP 429 e 5xx preservam a sessão; o aviso HTTP inclui o status para diagnóstico, e o acesso ainda válido continua disponível.

Após atualizar a extensão para 1.9.76, recarregar as abas usadas. Se a sessão anterior tiver sido invalidada, abrir o popup SIAGES, entrar com e-mail e senha e repetir **Conferir com IA**. Não é necessário reinstalar nem apagar o armazenamento da extensão.

Diagnóstico em 16/10/2026: chamada ao Auth com token fictício inexistente retornou HTTP 400 e `{ code: 400, error_code: 'refresh_token_not_found' }`. O worker anterior ignorava `error_code` e reproduzia o aviso genérico da captura. Isso confirma a falha de classificação; não identifica o motivo original da invalidação da sessão do usuário. Referência: [códigos do Supabase Auth](https://supabase.com/docs/guides/auth/debugging/error-codes).

## Visibilidade administrativa (1.9.63)

O popup segue `src/lib/authz.ts`: sessão com token e usuário cujo e-mail normalizado corresponda a `SUPERADMIN_EMAIL`, ou cujo `app_metadata.role` seja `superadmin`, ou `app_metadata.is_superadmin` seja o booleano `true`. Metadados editáveis pelo usuário (`user_metadata`) não concedem acesso; papel `admin` comum também não.

Sem essa permissão, o popup não consulta agenda, estados de RDs ou prévias de atividades, nem permite acionar seus controles. Ao sair, trocar de sessão ou falhar a verificação, a seção é ocultada e os resultados exibidos são limpos. Respostas atrasadas da verificação de sessão não restauram o acesso anterior. Login e preenchimento de favorecidos no SIAFI mantêm seu funcionamento independente.

Esta restrição é de apresentação e interação do popup. Não altera os agendamentos do worker nem substitui a autorização existente do backend; não cria nem modifica migrations ou Edge Functions.

## Aparência e acessibilidade

O HTML independente da extensão reproduz os tokens Céu documentados em `docs/design-system/TOKENS.md`: fundo claro, cards brancos, bordas suaves, ação azul e estados semânticos. Não carrega fontes ou bibliotecas remotas; os ícones do menu são SVG em linha. Controles usam rótulos, foco visível e formulário nativo. O menu é um `nav` de botões e o item ativo recebe `aria-current="page"`. Mensagens de estado são anunciadas por `aria-live`.

## Regressão

`src/lib/__tests__/suapPopupAccount.test.ts` cobre sessão inicial, login, logout, limpeza de senha, falhas de autenticação, mudanças de sessão e separação entre conta e sincronização. Também cobre os três critérios de superadmin, usuário comum, administrador comum, metadados não confiáveis, ausência de usuário, carregamento sem exposição, ausência de consultas sem permissão, cliques programáticos recusados e respostas atrasadas após logout/troca de conta. As suítes existentes de popup, RDs, SIAFI, autenticação e empacotamento preservam os fluxos operacionais.

`src/lib/__tests__/suapUserPreferences.test.ts` cobre padrões, normalização, validação, limite de atalhos e de 8 KB e falha do armazenamento. `src/lib/__tests__/suapPopupTemplates.test.ts` cobre a seção **Modelos e preenchimentos**: atalho criado com o destino copiado da tela Encaminhar, recusas, edição, remoção e desfazer, upload e despacho com volta ao padrão, e ausência do módulo. Também cobre **Painel do processo** (marcar, desmarcar, selo `7/9` e `Mostrar todos`); `suapProcessDocumentExtension.test.ts` confere o Resumo sem os blocos ocultos, o aviso com tudo oculto e o redesenho quando a preferência muda com o painel aberto. `suapCommandPaletteGlobal.test.ts` cobre atalhos configurados (inclusive criados com a página aberta) e o upload personalizado; `documentGeneration.test.ts`, `suapDispatchGeneration.test.ts`, `suapExtensionDispatch.test.ts` e `SuapExtensionDispatch.test.tsx` cobrem o modelo do despacho no SIAGES.

`src/lib/__tests__/suapPopupNavigation.test.ts` cobre o menu lateral: uma seção por vez, `aria-current`, reabertura da última seção, retorno à Conta sem permissão ou ao sair, restauração da seção de sincronização após a confirmação do superadmin, selos de pendência e abertura direta em Favorecidos SIAFI sem trocar a seção salva.

A conferência visual usa o HTML e JavaScript reais com uma sessão simulada localmente, sem acionar sincronizações no ambiente remoto.

### Validação em 07/10/2026

- 39 testes focados aprovados (conta do popup, sincronização de atividades, RDs, SIAFI, autenticação, pacote e encoding); lint dos testes alterados e sintaxe do popup aprovados.
- Layout, saída, entrada com Enter e abertura de atividades conferidos no navegador com sessão simulada.
- Build e 54 fallbacks SPA gerados. O comando `npm run build` encontrou um atalho Bun/Vite inconsistente em `node_modules`; a execução direta `node node_modules/vite/bin/vite.js build`, seguida de `node scripts/generate-spa-fallbacks.mjs`, passou.
- A suíte completa teve 1379 testes aprovados e quatro falhas. A repetição isolada eliminou os timeouts de Layout/PesquisaPrecos e o erro assíncrono de Comprasnet; persistiram falhas fora do popup em `suapProcessDocumentExtension.test.ts` (iframe ausente no teste de cópia CPF/CNPJ) e `ManutencaoAdmin.test.tsx` (item de Refeitório ausente). Os arquivos do painel de processos já continham alterações locais anteriores a este trabalho e foram preservados.
- `npm run check` bloqueado pelo erro de lint em `src/utils/nfeChave.ts:57` (`no-useless-escape`).
- Pacote `SUAP-Atividades-Scraper-1.9.62.zip`: 30 arquivos idênticos à pasta corrente, comparados por SHA-256.
