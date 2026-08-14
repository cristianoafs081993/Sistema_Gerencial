# Extensão do ETP no Comprasnet

## Objetivo

A extensão `Suape - Canivete Suíço do IFRN` acrescenta o assistente de redação com IA à tela oficial de edição de ETP do Comprasnet:

`https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-artefatos-web/artefatos/edit/<id>?tipo=ETP`

O certificado digital e a sessão do Comprasnet permanecem exclusivamente no navegador. A extensão não lê certificados, senhas ou cookies.

## Fluxo

1. `comprasnet-etp.js` identifica a rota de ETP e acrescenta o botão `Escrever ETP com IA`.
2. O botão abre um modal responsivo com iframe em `/comprasnet-extensao/etp`.
3. O content script lê a seção aberta, o número de processo visível e os estilos computados da página.
4. Para o modo ETP completo, navega somente pelas 13 seções textuais permitidas e devolve o conteúdo atual para revisão.
5. O iframe incorpora automaticamente o contexto institucional fixo do Campus Currais Novos e consulta o processo sincronizado no SIAGES, analisa o PDF disponível e processa anexos auxiliares apenas em memória.
6. `gerar-etp-comprasnet` gera a prévia geral do ETP.
7. O usuário configura extensão, formato, ênfases, fontes permitidas, tratamento do texto existente e o checklist da seção aberta. Apenas essas preferências não sensíveis usam `chrome.storage.sync` na chave versionada `siages-comprasnet-etp-generation-preferences-v1`.
8. A prévia pode conter o ETP completo para referência, mas somente a seção atualmente aberta no Comprasnet pode ser selecionada e aplicada. O usuário avança entre seções manualmente.
9. O content script escreve no CKEditor, dispara os eventos necessários e aguarda a confirmação de salvamento automático.
9. Avisos e pendências ficam recolhidos no ícone de alerta da prévia; após a aplicação bem-sucedida, o modal fecha e o foco retorna à página do Comprasnet.

O fluxo nunca acessa nem aciona `Concluir ETP`.

Processo, anexos, conteúdo existente e texto gerado permanecem somente em memória durante a abertura do modal; não entram no armazenamento sincronizado.

## Seções permitidas

São editáveis somente as seções textuais: necessidade, requisitos, mercado, solução, quantitativos, valor, parcelamento, contratações correlatas, planejamento, benefícios, providências, impactos ambientais e declaração de viabilidade.

Informações básicas, área requisitante, responsáveis, anexos, categoria, contratação e outros campos estruturados ficam fora do fluxo.

## Segurança e limites

- A sessão do SIAGES é enviada ao iframe somente pelo contrato `postMessage`, com origem fixa `https://www.siages.com.br`.
- Os anexos são analisados localmente; os arquivos originais não são persistidos nem enviados à Edge Function.
- O HTML retornado pela IA é sanitizado antes de ser escrito no CKEditor.
- Conteúdo preenchido é preservado por padrão.
- Sessão expirada, editor ausente, mudança de estrutura ou ausência de confirmação de autosave interrompem a operação.
- Não há migration nem armazenamento permanente do rascunho nesta primeira versão.

## Design visual

O botão e o modal usam a nomenclatura visual do Design System Brasil/Comprasnet (`br-button`, `br-card`, `br-input` e alertas). O content script captura tipografia, cores, bordas, foco e raio computados na página e envia os tokens `--comprasnet-*` ao iframe. A folha de estilos do iframe é isolada e não usa os tokens `suape-*`.

## Teste manual

1. Recarregue a extensão em `chrome://extensions`.
2. Abra um ETP em rascunho no Comprasnet com o certificado digital já autenticado.
3. Verifique o botão adicional, o modal, o comportamento responsivo e o foco por teclado.
4. Teste uma seção vazia e uma seção já preenchida; confirme a preservação padrão.
5. Gere uma prévia com processo e anexos auxiliares.
6. Altere uma preferência, feche e reabra o modal; confirme que somente a preferência foi lembrada.
7. Aplique somente a seção aberta, confirme o autosave e que o modal fecha devolvendo o foco para o Comprasnet.
8. Verifique manualmente que `Concluir ETP` não foi acionado.
