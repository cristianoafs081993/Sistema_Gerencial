# Comprovantes de preenchimento no SIAFI

Extensão SIAGES **1.9.66**. A captura funciona localmente no DH em `https://siafi.tesouro.gov.br`, sem login SIAGES, storage remoto, migration, Edge Function ou chamada a LLM. As injeções globais também ficam excluídas do login `acesso.gov.br`.

## Uso

1. Atualize/recarregue a extensão pelo pacote 1.9.66. Abra uma nova tela de DH após a atualização. Não recarregue uma tela com preenchimento ainda não registrado apenas para ativar a extensão.
2. Conclua a edição das listas e dos Dados Básicos no próprio SIAFI. Retorne de eventual pré-doc aberto.
3. No painel **Comprovante da liquidação**, mantenha **Incluir pré-docs preenchidos** marcado e clique em **Capturar liquidação**.
4. Mantenha a aba SIAFI selecionada. A extensão percorre as abas e situações, expande os detalhes dos itens e aguarda o AJAX terminar. **Cancelar captura** interrompe a coleta e tenta restaurar a aba original.
5. Ao concluir, clique em **Baixar PDF** e **Baixar dados (JSON)**. Os dois downloads são explícitos para evitar bloqueio de múltiplos downloads automáticos.

Dados Básicos, Principal Com Orçamento e Dados de Pagamento são obrigatórios. Dedução é consultada e registrada como `empty` quando não há itens/situações. Outras abas preenchidas, identificadas pelas classes de estado do SIAFI, também entram; Resumo fica fora desta versão. Cada situação de orçamento/dedução é percorrida separadamente, sem selecionar ou alterar linhas. Pré-docs de favorecidos e deduções são abertos somente quando já preenchidos e fechados com **Retornar**. A captura nunca aciona Confirmar, Registrar, Registrar Alterações, Salvar Rascunho, Excluir ou Verificar Consistência.

## Saídas e contrato de dados

- PDF A4 paisagem: imagens reais do navegador, divididas em trechos com pequena sobreposição. Começa diretamente nas telas do SIAFI, sem capa de metadados. Cada página identifica DH, UG, exercício, data e paginação. Capturas parciais recebem `PARCIAL` no cabeçalho; os avisos detalhados ficam no painel e no JSON.
- JSON UTF-8, `schemaVersion: "1.0.0"`: `captureId`, `startedAt`, `finishedAt`, `source`, `document`, `status`, `sections`, `predocs`, `warnings`, `analysis` e `purpose`.
- `sections[]`: chave/título, situação quando houver, estado, horário, campos (`id`, `label`, `value`, `type`, `disabled`), tabelas com cabeçalhos/células e texto de apoio; `firstPage`/`lastPage` relacionam a seção ao PDF.
- `predocs[]`: controle/linha de origem, `sectionKey`, preenchimento e estado (`captured`, `missing`, `skipped`); quando capturado, recebe campos/tabelas/texto e referências de páginas.
- Valores monetários, datas, documentos e classificações preservam o formato de origem, incluindo zeros à esquerda. Rótulos repetidos não sobrescrevem outros campos.
- URL contém somente origem/caminho. Campos ocultos, senhas, ViewState e calendários ocultos não são exportados. Cookies, tokens e HTML bruto não integram os arquivos.
- `analysis.status: "not_requested"`: sem avaliação automatizada nem envio à LLM; arquivo preparado para a integração posterior.

`complete` indica cobertura das abas planejadas e dos pré-docs identificados; não significa que os dados estejam corretos ou que o DH tenha sido registrado. `partial` sinaliza pré-doc ausente, exclusão voluntária dos pré-docs ou aba opcional indisponível. Falhas de captura/restauração não disponibilizam comprovante como concluído. DH sem número é identificado como em preenchimento no nome do arquivo. O PDF declara que não atesta registro, liquidação ou pagamento.

## Implementação e operação

`siafi-evidence-core.js` extrai campos e planeja abas; `siafi-evidence.js` coordena navegação/montagem local; `siafi-evidence-pdf.js` escreve o PDF com JPEGs; `siafi-evidence-background.js` usa `chrome.tabs.captureVisibleTab` em PNG. O worker valida host HTTPS, frame principal e aba ativa antes/depois da espera, serializa capturas e respeita duas chamadas por segundo. Não há novas permissões no manifesto.

O alertador de pré-doc continua protegendo registro/saída. Somente a troca de abas solicitada pelo coletor recebe exceção temporária no mundo isolado da extensão. Downloads internos ao painel são liberados. Documento alterado, sessão expirada, troca de aba, timeout e falhas de permissão interrompem a operação. Cliques/teclas fora do painel são bloqueados durante a coleta; não execute outra automação na mesma aba.

Detalhes recolhidos e áreas com rolagem interna são temporariamente expandidos apenas para apresentação, com restauração de estilos/rolagem. Pré-docs RichFaces têm um ancestral fixo e bloqueiam a rolagem do body: nesses casos, o coletor mantém a largura original e desloca temporariamente a janela entre os trechos, sem depender da rolagem da página nem de ajuste manual do zoom. As coordenadas são medidas novamente em cada trecho e excluem a barra de rolagem do recorte. Posição/estilos, aba/situação original são restaurados inclusive em falhas. Limite: 160 imagens; estrutura não reconhecida deve ser capturada em partes, sem exportação silenciosamente incompleta. Revise legibilidade/cobertura antes de anexar ao processo.

## Validação

`siafiEvidence.test.ts`: contrato, campos repetidos/desabilitados, formatos, exclusão de segredos, abas obrigatórias/opcionais, pré-docs, remetente/aba do worker e offsets do PDF. `siafiEvidenceCapture.test.ts`: percurso AJAX, situações múltiplas, pré-doc preenchido/ausente, cancelamento, falha sem exportação e restauração de áreas com rolagem. `suapSiafiPredocAlert.test.ts`: proteção de registro e exceção restrita de navegação. `suapExtensionPackage.test.ts`: carregamento/versão/permissões.

Validação em 08/10/2026: 43 testes dos quatro arquivos acima passaram; a verificação de encoding também passou. O build Vite e a geração dos 54 fallbacks SPA concluíram, usando diretamente o Node empacotado porque o wrapper local de `vite` estava inválido. O PDF do escritor da extensão foi renderizado com Poppler e revisado visualmente. O ZIP 1.9.64 foi conferido arquivo a arquivo contra a pasta da extensão.

A verificação geral não ficou verde: `npm run check` parou no erro `no-useless-escape` em `src/utils/nfeChave.ts:57`, arquivo não alterado neste trabalho. A suíte completa terminou com 1.408 testes aprovados e nove falhas em oito arquivos fora do fluxo alterado, incluindo timeouts. Essas falhas não foram corrigidas nem classificadas como regressões anteriores por comparação com uma execução de base.

Inspeção da sessão real em 08/10/2026: RP em preenchimento, UG 158366, processo 23035.002988.2026-97, DSP061, NE 2026NE000028, sem deduções e pré-doc OB PIX com lista 2026LX000010. PDF/JSON locais foram gerados sem registro ou confirmação. O coletor completo da 1.9.64 ainda precisa ser validado após ativação da versão no navegador; a inspeção assistida não substitui esse teste.

Correção 1.9.65 em 08/10/2026: o erro de enquadramento foi reproduzido na consulta do RP 170 e localizado na janela fixa do pré-doc. Foram acrescentados testes de modal fixo com body bloqueado, restauração após falha e limite inferior de rolagem; o fluxo integrado também garante ausência de capa e referências de páginas iniciadas em 1. A reprodução de layout no Chrome, com estrutura RichFaces fictícia, completou dois trechos e restaurou os estilos. Nesse teste de layout o retorno do worker é simulado; não substitui a validação nativa depois de carregar a extensão corrigida. A capa também foi retirada do PDF assistido já entregue, ajustando a paginação no PDF e no JSON.

Validação final 1.9.65: 47 testes focados (incluindo encoding) aprovados; suíte geral com 1.417 aprovados e três falhas em `DataContext.test.tsx`, `suapProcessDocumentExtension.test.ts` e `ManutencaoAdmin.test.tsx`, fora do fluxo alterado. O lint geral permanece bloqueado por `src/utils/nfeChave.ts:57`. Build Vite e 54 fallbacks SPA concluídos. PDF assistido sem capa: oito páginas renderizadas e revisadas, paginação/referências JSON conferidas. Os 36 arquivos do ZIP 1.9.65 coincidem por SHA-256 com a pasta da extensão. Não houve migration, deploy ou envio a LLM.
