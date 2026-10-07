# Tela inicial da extensão SIAGES

Na versão 1.9.63, o popup e o nome exibido pelo navegador usam **SIAGES** e exibem a logo institucional do sistema. O subtítulo “Extensão para o navegador” foi removido.

## Organização

- Cabeçalho com a logo institucional, o nome SIAGES e link para abrir o SIAGES.
- **Sua conta** concentra exclusivamente autenticação. Enquanto verifica a sessão, não exibe formulário nem usuário. Sem sessão, oferece e-mail, senha e `Entrar no SIAGES`, também acionável com Enter. Com sessão, mostra o e-mail, o estado `Conectado` e `Sair`, ocultando o formulário. A senha é limpa após entrar ou sair; alterações da sessão em outros contextos atualizam o popup.
- **Sincronização** reúne agenda e resultado das caixas de processos, atividades do Plano 8 e RDs. Desde a versão 1.9.63, toda essa seção é exclusiva do superadministrador. Ela começa oculta e só aparece após a confirmação da sessão. Mensagens de autenticação permanecem no bloco da conta.
- Atividades e RDs usam painéis expansíveis, inicialmente fechados. Prévias de atividades abrem seu painel; coleta de RDs em andamento, prévias ou falhas abrem o painel de RDs. Os controles e estados dos dois fluxos continuam independentes.
- O preenchimento de favorecidos continua disponível exclusivamente quando a aba atual pertence ao SIAFI.

O campo `Segredo de automação` foi retirado, junto com a leitura e escrita da sua preferência no popup. Esse valor não era utilizado pelos fluxos atuais de sincronização. Não há novo contrato de backend nem alteração em migrations ou Edge Functions.

## Visibilidade administrativa (1.9.63)

O popup segue `src/lib/authz.ts`: sessão com token e usuário cujo e-mail normalizado corresponda a `SUPERADMIN_EMAIL`, ou cujo `app_metadata.role` seja `superadmin`, ou `app_metadata.is_superadmin` seja o booleano `true`. Metadados editáveis pelo usuário (`user_metadata`) não concedem acesso; papel `admin` comum também não.

Sem essa permissão, o popup não consulta agenda, estados de RDs ou prévias de atividades, nem permite acionar seus controles. Ao sair, trocar de sessão ou falhar a verificação, a seção é ocultada e os resultados exibidos são limpos. Respostas atrasadas da verificação de sessão não restauram o acesso anterior. Login e preenchimento de favorecidos no SIAFI mantêm seu funcionamento independente.

Esta restrição é de apresentação e interação do popup. Não altera os agendamentos do worker nem substitui a autorização existente do backend; não cria nem modifica migrations ou Edge Functions.

## Aparência e acessibilidade

O HTML independente da extensão reproduz os tokens Céu documentados em `docs/design-system/TOKENS.md`: fundo claro, cards brancos, bordas suaves, ação azul e estados semânticos. Não carrega fontes ou bibliotecas remotas. Controles usam rótulos, foco visível, formulário nativo e `details`/`summary`; mensagens de estado são anunciadas por `aria-live`.

## Regressão

`src/lib/__tests__/suapPopupAccount.test.ts` cobre sessão inicial, login, logout, limpeza de senha, falhas de autenticação, mudanças de sessão e separação entre conta e sincronização. Também cobre os três critérios de superadmin, usuário comum, administrador comum, metadados não confiáveis, ausência de usuário, carregamento sem exposição, ausência de consultas sem permissão, cliques programáticos recusados e respostas atrasadas após logout/troca de conta. As suítes existentes de popup, RDs, SIAFI, autenticação e empacotamento preservam os fluxos operacionais.

A conferência visual usa o HTML e JavaScript reais com uma sessão simulada localmente, sem acionar sincronizações no ambiente remoto.

### Validação em 07/10/2026

- 39 testes focados aprovados (conta do popup, sincronização de atividades, RDs, SIAFI, autenticação, pacote e encoding); lint dos testes alterados e sintaxe do popup aprovados.
- Layout, saída, entrada com Enter e abertura de atividades conferidos no navegador com sessão simulada.
- Build e 54 fallbacks SPA gerados. O comando `npm run build` encontrou um atalho Bun/Vite inconsistente em `node_modules`; a execução direta `node node_modules/vite/bin/vite.js build`, seguida de `node scripts/generate-spa-fallbacks.mjs`, passou.
- A suíte completa teve 1379 testes aprovados e quatro falhas. A repetição isolada eliminou os timeouts de Layout/PesquisaPrecos e o erro assíncrono de Comprasnet; persistiram falhas fora do popup em `suapProcessDocumentExtension.test.ts` (iframe ausente no teste de cópia CPF/CNPJ) e `ManutencaoAdmin.test.tsx` (item de Refeitório ausente). Os arquivos do painel de processos já continham alterações locais anteriores a este trabalho e foram preservados.
- `npm run check` bloqueado pelo erro de lint em `src/utils/nfeChave.ts:57` (`no-useless-escape`).
- Pacote `SUAP-Atividades-Scraper-1.9.62.zip`: 30 arquivos idênticos à pasta corrente, comparados por SHA-256.
