# LC

## Objetivo

Importar Lista de Credores, exibir a base carregada, comparar com PDFs de pagamento e gerar macro SIAFI.

## Ponto de entrada

- pagina: [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)
- import service: [lcImportService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcImportService.ts)
- comparacao: [lcComparisonService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/lcComparisonService.ts)
- extracao PDF: [bolsistasPdfService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/bolsistasPdfService.ts)
- macro SIAFI: [siafiMacroService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/siafiMacroService.ts)

## Arquivos aceitos para LC

- `.csv`
- `.xlsx`
- `.xls`

## Regras de leitura

- tenta detectar UTF-16LE, UTF-16BE e UTF-8
- para CSV, escolhe `tab`, `;` ou `,`
- usa a primeira aba
- procura o cabecalho pela presenca de:
  - `ob - lista credores`
  - `ob/lc - sequencial`

## Colunas lidas por posicao

- `0`: `obListaCredores`
- `1`: `sequencial`
- `2`: `favorecidoDocumento`
- `3`: `favorecidoNome`
- `4`: `bancoCodigo`
- `5`: `bancoNome`
- `6`: `agenciaCodigo`
- `7`: `agenciaNome`
- `8`: `contaBancaria`

Observacao: contas bancarias podem conter digito verificador alfanumerico, como `7456-X`. O valor bruto continua importado como texto; para comparacao, copia e macro SIAFI, o fluxo remove pontuacao e usa `7456X`, preservando o `X`.

## Regras de descarte

Linhas sao descartadas quando:

- `obListaCredores` e vazio ou `-9`
- `sequencial` e vazio ou `-9`
- `favorecidoDocumento` e vazio ou `-9`
- `sequencial` nao e numerico

## Destino no banco

- tabela: `lc_credores`
- chave de upsert:
  - `ob_lista_credores,sequencial`

## Fluxos derivados

### Consolidacao por CPF

A tela monta uma visao consolidada por documento do favorecido e escolhe a melhor linha quando ha duplicidade.

### Comparacao com PDFs

O usuario envia PDFs de pagamento.
O sistema extrai os bolsistas e compara com a base carregada na LC. Suporta estes formatos de PDFs:

1. **Layout com Rótulos (Format A)**:
   - Apresenta informações de 1 bolsista por bloco com rótulos descritivos (ex: `CPF`, `Dados bancários Banco`, `Agência`, `Conta`).
   - O valor da bolsa é uniforme para o documento e extraído de frases como `corresponde a R$ [valor]`.
2. **Layout de Tabela (Format B)**:
   - Apresenta os bolsistas listados em uma grade com cabeçalho (contendo `MATRÍCULA`, `VALOR REFERÊNCIA` ou similar).
   - Extrai automaticamente CPF, Banco, Agencia, Operacao opcional, Conta e Valor individual de cada linha. A Operacao do PDF nao compoe a conta e e ignorada no fluxo operacional.

3. **Layout PAFE com dados bancarios (Format C)**:
   - Apresenta cabecalho com `NOME`, `MATRICULA`, `SETOR`, `TURNO`, `VR R$`, `CPF` e `DADOS BANCARIOS`.
   - Extrai valor antes do CPF e, depois dele, Banco, Agencia, Operacao opcional e Conta. A Operacao do PDF e ignorada; a conta e preservada com pontuacao e `X`.
   - O valor pode vir como `R$ 300,00` ou `300,00 R$` (o pdfjs entrega a segunda forma no PDF do SUAP).
   - Nomes com marcadores de rodape (`*`, `**`, `***`, `¹²³`) sao aceitos e o marcador e removido do nome extraido. Antes, linhas com `*` nao casavam no regex e o aluno era omitido silenciosamente (ex.: 33 de 41 alunos reconhecidos).

**Páginas escaneadas (OCR).** A leitura usa a camada de texto do PDF (pdfjs). Uma página sem texto que contém imagem (PDF "impresso"/reprocessado, por exemplo pelo Ghostscript) é lida por OCR no próprio navegador:

- [pdfOcrService.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/pdfOcrService.ts) renderiza a página em canvas (~300 dpi), binariza e apaga as linhas da grade da tabela ([ocrPreprocess.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/ocrPreprocess.ts); sem isso o Tesseract perde as células) e reconhece com `tesseract.js` (idioma `por`, modo LSTM, carregado sob demanda).
- O texto reconhecido entra na posição da página original, então registros que atravessam páginas (nome/CPF no texto e agência/conta na imagem) são ligados normalmente.
- A saída do OCR tem ruído: o parser tolera separadores como `—`/`|` entre rótulo e valor, normaliza o CPF (`709,443.734-02`, `709.443 .734-02`, espaços, `O` no lugar de `0`) e corrige `O/l/I` em agência e conta. Sem isso o aluno desaparecia em silêncio.
- Todo registro que depende de OCR sai com `ocr: true`. A grade da LC mostra o selo **OCR · conferir**, a tela avisa quantos foram lidos por OCR e destaca os que têm CPF com dígito verificador inválido (provável erro de leitura). O OCR já errou dígitos em teste (`NE`→`NF`), então CPF, agência e conta devem ser conferidos no PDF antes de gerar a macro. Um CPF lido errado cai em `aluno_nao_encontrado`; uma conta lida errada cai em `conta_nao_encontrada`.
- Páginas em branco (sem texto e sem imagem) e páginas com texto e imagem (logotipo) não passam por OCR.
- O primeiro uso baixa do próprio app (`/ocr`, ~9 MB: worker, núcleo wasm e idioma) e leva alguns segundos por página; depois o navegador reaproveita o cache. A renderização do pdfjs depende de `requestAnimationFrame`: com a aba em segundo plano a leitura pausa até voltar.
- Layout validado com OCR: **Format A** (ofício com rótulos). Os layouts de tabela (B e C) passam pelo mesmo OCR e marcam todos os registros como `ocr`, mas não foram validados com PDF escaneado.

`extractBolsistasFromPdfFiles(files, { onWarning, onOcrProgress, ocr })` avisa, via `onWarning`, quando: `ocr_failed` (OCR falhou nas páginas), `ocr_disabled` (`ocr: false`) ou `count_mismatch` (o ofício declara `N (extenso) bolsas`, ex.: `5 (cinco) bolsas`, e foram identificados menos bolsistas — rede de segurança contra aluno não lido). A tela exibe esses avisos e o progresso do OCR em toasts.

No layout com rótulos (Format A), o fim do parágrafo anterior ao primeiro bolsista (ex.: `... Laboratório 3 TAL.`) não entra mais no nome extraído.

Banco pelo nome (Format A): desde a 1.9.92, `resolveBancoCodigo` converte o nome em código COMPE. Antes, qualquer nome virava `001`. Só um banco não reconhecido ainda cai em `001`; nesse caso, confira o banco quando a conta der `conta_nao_encontrada`. Veja "Montagem automática pela extensão".

O fluxo de comparação gera pendências de cruzamento e permite ao usuário:
- Na grade de dados para cópia, exibir o ícone de cópia em todas as linhas e em cada campo disponível (CPF, banco, agência e conta). Os ícones só ficam habilitados depois que o usuário seleciona a linha correspondente.
- Salvar uma lista de trabalho nomeada, incluindo as contas escolhidas na grade, para reabri-la ou excluí-la depois. As listas são persistidas na tabela `lc_saved_lists`, com isolamento por `org_id`, e não alteram a base oficial `lc_credores`. O salvamento (e a reabertura) não depende de pendências: mesmo que todos os credores estejam com status `aluno_nao_encontrado` e nenhuma linha seja apta para a macro, o diálogo abre na aba de grade, a lista pode ser salva e apenas o download do `.mac` fica desabilitado.
- Usuários autenticados do mesmo órgão conseguem listar, abrir, atualizar e excluir as listas dos colegas; o navegador mantém apenas um espelho local para contingência quando o Supabase estiver indisponível.
- Copiar blocos formatados de 7 alunos (com destaque em amarelo na 7ª linha) no mesmo padrão de leiaute da macro `.mac` para colagem direta (via Shift+Insert). Os campos são concatenados continuamente sem nenhum espaçador ou tabulador (CPF com 14, Banco com 3, Agência com 4, Operação/Resto com 24, Conta preenchida com 20 caracteres com zeros à esquerda, e Valor em centavos como última coluna). Isso garante o preenchimento exato de cada coluna limite do emulador, ativando o recurso de "auto-tab" nativo do SIAFI em cada transição de campo sem risco de pulos ou desalinhamentos.
- Gerar e baixar arquivo de macro `.mac` para preenchimento automatizado no SIAFI.

## Montagem automática pela extensão (processos de bolsa, 1.9.92)

Ao abrir no SUAP um processo cujo **Tipo** ou **Assunto** contenha `bolsa`/`bolsista` (ex.: Tipo "Ensino: Pagamento de Bolsa"), a extensão monta e salva a lista de trabalho sem que o usuário baixe ou envie PDF.

1. `process-document.js` lê os documentos da timeline (até 15), primeiro os de título ou tipo Ofício/Memorando/Relação/Lista/Planilha/Folha/bolsa.
   - **Documentos eletrônicos** (o ofício com os alunos é desse tipo): o HTML de `/documento_eletronico/conteudo_documento/<id>/` vira texto com uma linha por bloco (`htmlToBlockText`). O layout é o Format A, com rótulos.
   - **Documentos digitalizados/anexados**: PDF de `?original=sim`, lido por `extractBolsistasFromPdfFiles` só pela camada de texto (`ocr: false`).
     - Não há OCR aqui: o Chrome congela a renderização do iframe oculto, que tem 1px e é de outra origem, e o pdfjs nunca terminava. O card ficava parado em "Lendo 3 documento(s)..." no 505643, quando a Liquidação (captura do SIAFI, só imagem) foi anexada.
     - Páginas escaneadas vão para a IA, que lê a imagem do PDF.
     - Cada PDF tem prazo de 60 s (`LC_PDF_READ_TIMEOUT_MS`); estourado o prazo, vira aviso.
2. O iframe `/suap-extensao/processo-info` roda `runSuapLcAutoBuild` ([suapLcAutoBuildService.ts](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/services/suapLcAutoBuildService.ts)).
   - Lê **os documentos de texto primeiro** e para assim que a lista está completa: há alunos com agência e conta, e o total declarado foi atingido. PDFs só são abertos se ainda faltar aluno. O card mostra qual documento está sendo lido ("Lendo Ofício … (2 de 3)...").
   - Escolhe o documento com mais alunos que tenham agência e conta.
   - Compara com o total declarado (`N (extenso) bolsas`).
3. **IA só se o script falhar**: com zero alunos ou menos que o declarado, o documento vai para a Edge Function `extrair-bolsistas-documento` (Gemini, com OpenAI de reserva). O resultado da IA só substitui o do script se tiver mais alunos, e as linhas saem com `ia: true`. A grade mostra o selo **IA · conferir**.
4. O cruzamento com `lc_credores` usa `buildLcGridRows` ([lcWorkListBuilder.ts](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/services/lcWorkListBuilder.ts)), a mesma regra da comparação manual por PDF.
5. A lista é salva em `lc_saved_lists` com:
   - `suap_id`, `process_number`, `origin = 'extensao'` e `extraction`;
   - o nome "<assunto> — <NUP>".
   Existe uma lista por processo e órgão. Reabrir o processo não duplica nem sobrescreve uma lista já editada; o botão **Remontar** do painel substitui as linhas, após confirmação.
6. O painel do SUAP mostra o card **Lista de credores**: etapa, alunos, total declarado, pendências e avisos. O botão **Abrir no SIAGES** leva a `/lc?lista=<id>`, que abre direto a grade da lista. Se a lista não existir mais, a tela avisa.

Validação real: no processo 505643 (Bolsa TAL, Ofício 156/2026), o script leu 10 de 10 alunos, com R$ 400,00 por aluno. Os bancos vieram pelo nome (Nubank, Banco do Brasil, Caixa, Inter, Mercado Pago).

**Banco pelo nome.** O ofício traz o banco pelo nome. `resolveBancoCodigo` ([bancoCodigo.ts](/C:/Users/3128880/Desktop/Programação/Sistema_Gerencial/src/utils/bancoCodigo.ts)) converte para o código COMPE: BB 001, Caixa 104, Bradesco 237, Itaú 341, Santander 033, Nubank 260, Inter 077, C6 336, BNB 004, Sicoob 756, Sicredi 748, PagBank 290, Mercado Pago 323, PicPay 380, entre outros. Vale também para o upload manual de PDF. Isso corrige a limitação antiga em que um nome de banco sempre virava `001`. Um banco não reconhecido continua caindo em `001`.

**Parser (Format A).**
- O nome é a última linha antes de `(matrícula)`. Assim o fim do parágrafo anterior ("… TAL") e o fim do bloco anterior ("Conta 12.345-X") não entram no nome.
- A conta aceita ponto e `X` (`12.345-X`), e o tipo `(Conta corrente)` é ignorado.

## Arquivo de exemplo

- [7 - LC.csv](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/7%20-%20LC.csv)

## Riscos e observacoes

- valores `-9` fazem parte do contrato de descarte
- a especificação de formatos de PDFs suportados foi unificada e integrada ao parser dinâmico.
