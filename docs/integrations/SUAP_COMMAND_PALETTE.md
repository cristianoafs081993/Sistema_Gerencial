# Consultas SUAP pela paleta de comandos

A extensão permite abrir consultas oficiais do SUAP pela paleta `Ctrl+K` sem exigir que a aba atual esteja no SUAP. No SIAGES, essas consultas aparecem na paleta nativa; nas demais páginas compatíveis, inclusive no Comprasnet, a extensão fornece a paleta. O SIAGES conserva sua paleta normal; ao digitar exatamente `solrecfin`, a extensão fecha o diálogo nativo e mostra a ação local, sem duas paletas abertas simultaneamente.

## Consultas

Digite um termo para ver as consultas disponíveis ou use um prefixo para direcionar a pesquisa:

| Tipo | Prefixos aceitos |
| --- | --- |
| Processos | `processo`, `processos`, `proc`, `p` |
| Alunos | `aluno`, `alunos`, `matricula`, `alu`, `mat`, `a` |
| Documentos | `documento`, `documentos`, `docto`, `doc`, `d` |
| Contratos | `contrato`, `contratos`, `con`, `c` |

Exemplos: `proc 23000.000123/2026-01`, `aluno 20201234567890`, `doc minuta`, `contrato 12/2024`. Uma matrícula numérica abre o registro do aluno; outros termos abrem a pesquisa do SUAP.

Enter abre a consulta na aba atual. `Ctrl+Enter` abre em uma nova aba. A consulta é apenas uma navegação para o domínio oficial `suap.ifrn.edu.br`; é necessário estar autenticado no SUAP para acessar o resultado.

## Captura SIAFI com print

Na extensão 1.9.75, estando em um DH de `https://siafi.tesouro.gov.br`, use **Ctrl+K → print → Enter** para executar **Capturar liquidação (PDF e JSON)**. O comando inicia a coleta local das abas e pré-docs preenchidos, sem exigir login SIAGES. A paleta fecha antes da coleta, e os downloads aparecem em uma janela temporária com **Fechar**. Não há card permanente sobre o formulário.

Depois de cada captura concluída, o JSON é resumido no acumulador local. Use **Ctrl+K → solrecfin → Enter** para exibir a soma por código e fonte: empenho do exercício em `EXE001`, restos a pagar em `RAP001`, fonte padrão `1000000000` e fonte `1333000000` quando o PTRES for `230446`. O acumulado fica somente no armazenamento local da extensão. Reinicia à meia-noite no fuso `America/Sao_Paulo` (Brasília), inclusive com a janela aberta. O seletor Dia consulta os últimos sete dias corridos, incluindo hoje; dias sem capturas aparecem zerados. A versão anterior migra os registros pela data de captura. Registros fora da janela de sete dias são removidos ao consultar ou incluir uma captura. **Limpar acumulado de hoje** preserva os dias anteriores. Capturas sem valor ou sem empenho identificável permanecem como pendência e não entram silenciosamente nos totais.

Na 1.9.81, os arquivos começam pelo número do processo (ex.: `23035.002988.2026-97 - 2026NP000123 - EMPRESA LTDA.pdf`). O comando **Ctrl+K → printup → Enter** (**Capturar e anexar no SUAP**) faz a captura e salva uma cópia em Downloads. Também envia o PDF ao Supabase e abre o upload do mesmo processo no SUAP com o documento já no campo Arquivo, inclusive quando o SUAP está em outro perfil do Chrome logado na mesma conta SIAGES. Você só confere e clica em Salvar. Digitar `print` mostra os dois comandos, com `print` primeiro; `printup` mostra só o novo. Detalhes, limpeza diária e restrições: [SIAFI_EVIDENCE](SIAFI_EVIDENCE.md#printup-captura-e-upload-no-suap).

Abrir a paleta no SIAFI e digitar `print` ou `printup` não dispara consultas de empenhos/contratos; essas consultas continuam disponíveis ao solicitar outras buscas. Durante a captura, Ctrl+K mantém a paleta fechada para preservar as imagens. O comando fica oculto fora de um DH SIAFI HTTPS reconhecido. Operação, saídas e restrições: [SIAFI_EVIDENCE](SIAFI_EVIDENCE.md).

## Consulta global solrecfin

Na extensão **1.9.78**, cada linha de código/fonte funciona como uma seção expansível, com uma seta e a quantidade de capturas ao lado do código. Clique em qualquer ponto da linha para expandir/recolher; pelo teclado, use Tab até o código e Enter ou Espaço. A tabela resumida mantém somente Código, Fonte e Valor. A expansão mostra documento, empenho, PTRES, horário da captura em Brasília e valor, além do subtotal do grupo. O detalhamento usa exatamente as capturas que alimentam o total do dia selecionado, inclusive no histórico. Pendências sem código/valor ficam fora dessa composição. Capturas repetidas do mesmo documento aparecem em linhas separadas, como no cálculo existente. Registros antigos sem identificação mostram **NP/RP não identificada**, preservando o valor disponível. Os dados continuam locais, sem consulta adicional ao SIAFI ou ao backend.

Desde 1.9.75, **Ctrl+K → solrecfin → Enter** funciona fora do DH: telas do SIAFI, SUAP, Comprasnet, SIAGES e demais páginas compatíveis com content scripts. O resumo lê o mesmo `chrome.storage.local` da extensão em qualquer domínio, com acumulado diário e histórico dos sete dias. Não exige sessão SIAGES nem fica esperando consultas remotas de empenhos/contratos. Capturas continuam sendo registradas apenas no SIAFI; abrir a consulta em outro site não acrescenta liquidações.

No SIAGES, digitar `solrecfin` na paleta nativa encaminha somente esse comando ao diálogo local da extensão; Ctrl+K e as demais buscas nativas seguem seu fluxo habitual. A ponte usa o campo da paleta (`cmdk-input`) e fecha o diálogo original antes da consulta local. Não há alteração de backend. As exclusões do login gov.br permanecem, assim como as restrições de páginas internas/protegidas do navegador.

## Escopo e segurança

A paleta global consulta contratos locais somente pelas colunas existentes (`id`, `numero`, `contratada`, `valor`, `data_inicio`, `data_termino`). Objeto, processo e situação derivados continuam vindo de `contratos_api`; a tabela local não fornece esses campos. A paleta nativa do SIAGES carrega a busca de contratos apenas ao abrir, reduzindo consultas no carregamento inicial.

- A consulta não lê nem armazena dados do SUAP na página de origem.
- A paleta global pode coexistir com o content script de redação de ETP no Comprasnet.
- Ações contextuais de processos e comandos de sincronização não são liberados globalmente por esta funcionalidade.
- As quatro injeções globais da extensão são excluídas de `acesso.gov.br` e de seus subdomínios. Isso mantém o fluxo de autenticação gov.br livre dos atalhos e listeners da extensão; as páginas do SIAFI, SUAP e Comprasnet continuam usando suas próprias regras de rota.
- Páginas internas ou superfícies nas quais o navegador bloqueia content scripts não são compatíveis.
- Atalhos de texto (`/cn`, `/ifrn`...) são compartilhados entre perfis do Chrome pelo SIAGES (`snippets-sync.js` + tabela `extension_snippets`), pois `chrome.storage.sync` não alcança perfis sem sincronização do Google, como o usado para o SIAFI. É preciso estar logado no SIAGES pelo popup da extensão em cada perfil; sem sessão, o perfil usa apenas a cópia local.

Essa exclusão reduz interferência possível no login, mas não prova a origem de um `403 Forbidden`: a resposta pode ser produzida pelo próprio serviço gov.br antes de qualquer content script. Para separar as hipóteses, teste a versão 1.9.69 em uma janela normal, após recarregar a extensão. Cookies primários do site continuam sendo diferentes de cookies de terceiros; a configuração de terceiros não informa se há uma sessão gov.br antiga salva.

## Validação manual

1. Recarregue a extensão em `chrome://extensions` e abra uma página comum, o SIAGES e uma tela do Comprasnet.
2. Abra a paleta com `Ctrl+K` e teste as quatro consultas, incluindo uma matrícula numérica.
3. Confirme que Enter usa a aba atual e `Ctrl+Enter` abre uma nova aba no SUAP.
4. No SIAGES, confirme que somente a paleta nativa aparece; no Comprasnet, confirme que o assistente de ETP continua disponível.
5. Confirme que o comando de sincronização imediata e as ações contextuais de processo permanecem restritos.
6. No SIAFI, faça um novo login em uma janela normal e confirme se o 403 desapareceu. Se ainda ocorrer somente no perfil normal, remova apenas os dados de `acesso.gov.br` nas configurações de cookies do Chrome e repita o teste.
7. Em um DH SIAFI, confirme a ausência do card ao entrar e após atualizar uma aba. Use Ctrl+K → print → Enter, aguarde a coleta e baixe PDF/JSON. Confira que as imagens não contêm a paleta nem a janela de progresso e que a aba original foi restaurada. Feche a janela e confirme que ela permanece fechada após AJAX. Fora do DH e em outros sites, o comando de captura não deve aparecer.
8. Com login SIAGES na extensão dos dois perfis, use Ctrl+K → printup → Enter em um DH com processo em Dados Básicos. Confira a cópia em Downloads, iniciada pelo NUP. Volte à janela do SUAP e confirme que o upload do processo abre com Tipo/Assunto preenchidos e o PDF no campo Arquivo. Clique em Salvar e confirme no Supabase que linha e objeto sumiram. Repita sem login para ver a mensagem de falha e o seletor no `up` manual.
9. Após uma captura, use Ctrl+K → solrecfin → Enter no menu do SIAFI, no SUAP, no Comprasnet e no SIAGES. Confirme os mesmos totais e histórico de sete dias. No SIAGES, o comando deve fechar a paleta nativa antes de mostrar a consulta local; as demais buscas continuam na paleta nativa.
10. Clique na linha de código/fonte para expandir/recolher e confira documentos, valores e subtotal. Confirme que clicar na fonte, no valor ou na seta alterna uma única vez. Troque o dia e confira que a composição acompanha o histórico. Teste Tab + Enter/Espaço, capturas repetidas e registros antigos sem número; em telas estreitas, a tabela permite rolagem horizontal.
