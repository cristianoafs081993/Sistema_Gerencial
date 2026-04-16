# DATA_FLOW

Este documento resume como os dados chegam ao frontend e circulam pelas paginas.

## Camada 1: rotas

As rotas sao lazy-loaded em [App.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/App.tsx).

Cada rota cai em uma pagina em `src/pages`.

## Camada 0: sessao e autenticacao

Antes das paginas protegidas ou autenticadas, o app passa por:

- [AuthContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/AuthContext.tsx)
- [ProtectedRoute.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/components/auth/ProtectedRoute.tsx)
- [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx)
- [supabase.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabase.ts)

Esse fluxo agora concentra:

- leitura inicial de sessao via `supabase.auth.getSession`
- sincronizacao de mudancas por `onAuthStateChange`
- login por e-mail e senha via `signInWithPassword`
- aceite de convite ou recuperacao de acesso na rota publica `/auth`
- definicao de senha inicial por `supabase.auth.updateUser`
- encerramento da sessao no cabecalho global do layout
- protecao de todas as rotas por um guard central antes do `Layout`
- derivacao local de permissoes de superadministrador pelo e-mail autenticado
- carregamento das permissoes de tela do usuario em `AuthContext`
- bloqueio de acesso direto por rota em `ProtectedRoute`
- filtro dos itens da sidebar pelo catalogo central de telas em `src/lib/appScreens.ts`

### Controle de usuarios

A tela `/controle-usuarios` e exclusiva do superadministrador. Ela usa a Edge Function `admin-users` para listar usuarios do Supabase Auth, criar usuarios com senha padrao `ifrn`, enviar convites, criar grupos e gravar permissoes por tela.

O grupo inicial `Diretores` recebe acesso as telas de producao e nao recebe acesso ao controle de usuarios. Uploads e importacoes continuam dependentes de `isSuperAdmin`, portanto o grupo `Diretores` nao libera botoes de upload.

## Camada 2: origem do dado

O frontend hoje usa tres padroes principais:

### Padrao A: DataContext

Usado para os dados mais centrais do sistema:

- atividades
- empenhos
- descentralizacoes
- contratos
- contratos_empenhos
- creditos_disponiveis

Arquivos:

- [DataContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/DataContext.tsx)
- [useDataQueries.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/useDataQueries.ts)
- [useCrudMutations.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/useCrudMutations.ts)

Paginas que dependem fortemente disso:

- [Dashboard.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Dashboard.tsx)
- [Atividades.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Atividades.tsx)
- [Empenhos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Empenhos.tsx)
- [Descentralizacoes.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Descentralizacoes.tsx)

Observacao:

- a pagina [Atividades.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Atividades.tsx) agora atende a rota `/planejamento/:scope`
- as visoes `campus`, `sistemico` e `emendas-parlamentares` filtram a tabela `atividades` pelo campo `tipo_atividade`
- cadastro manual e importacao JSON na pagina de planejamento persistem o `tipo_atividade` correspondente a aba atual

### Padrao B: pagina + service proprio

Usado quando a pagina tem pipeline proprio de importacao ou consulta:

- [Financeiro.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Financeiro.tsx)
- [LC.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LC.tsx)
- [RetencoesFdReinfDesign.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RetencoesFdReinfDesign.tsx)
- [LiquidacoesPagamentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/LiquidacoesPagamentos.tsx)
- [RastreabilidadePFs/index.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/RastreabilidadePFs/index.tsx)

### Padrao C: pagina + Edge Function ou API externa

Usado em modulos com IA ou integracoes externas:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)
- [ConsultorSessions.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/ConsultorSessions.tsx)
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)
- [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx)
- [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx)

## Camada 3: services

Os services em [src/services](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services) fazem:

- query em tabela ou view do Supabase
- upsert/importacao
- chamada de API externa
- chamada de Edge Function
- enriquecimento e mapeamento de dados
- normalizacao de labels exibidos no frontend, como `componente_funcional` sem prefixo numerico e atividades de Ensino sem prefixo `NN - COMPONENTE FUNCIONAL (PROEN):`

## Camada 4: fallback REST

Alguns services usam fallback para REST quando `supabase-js` falha ou retorna vazio:

- [atividades.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/atividades.ts)
- [empenhos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/empenhos.ts)
- [descentralizacoes.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/descentralizacoes.ts)
- [rastreabilidadePFs.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/rastreabilidadePFs.ts)
- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

## Exemplos de fluxo

### Dashboard

`App.tsx` -> `Dashboard.tsx` -> `useData()` -> `DataContext` -> `useDataQueries` -> services -> Supabase

Observacao para a aba RAP do dashboard:

- os cards de topo devem usar os campos proprios de RAP do empenho
- separar `inscrito` e `reinscrito` pelo ano do empenho:
  - ano imediatamente anterior ao exercicio corrente: usar a base inscrita do RAP
  - anos anteriores a esse: tratar como `reinscrito`
- `restos a pagar pagos` deve ser somado ao valor de `valor_liquidado_a_pagar` para representar o total liquidado/executado no exercicio corrente
- `restos a pagar a pagar` deve ser tratado como o saldo atual do empenho RAP
- em `Empenhos.tsx`, o `HeaderActions` agora separa as acoes em `Importar Empenhos` e `Importar Saldo RAP`
- no upload de `Empenhos.tsx`, o CSV dedicado de RAP com `NE CCor` + `Metrica` atualiza `saldo_rap_oficial` diretamente sem limpar os demais campos do RAP ja existentes
- quando o upload vier pelo CSV legado combinado, a coluna `RESTOS A PAGAR NAO PROCES. LIQUIDADOS A PAGAR` continua alimentando `valor_liquidado_a_pagar` tambem para RAP e e descontada do `saldo_rap_oficial`
- quando o saldo oficial nao vier preenchido, derivar o saldo pela base vigente do RAP menos o valor executado no ano
- a mesma regra deve valer para dashboard, tela de empenhos, agrupamentos e contratos vinculados
- nao reutilizar `valor` ou `valorPagoOficial` como substitutos desses totais na agregacao da aba RAP

### Financeiro

`Financeiro.tsx` -> `parseFinanceiroCsv` / `saveFinanceiroRows` -> `financeiro_fonte_vinculacao`

### LC

`LC.tsx` -> `parseLCCsv` / `saveLCRows` -> `lc_credores`

### PFs

`PFImportDialog.tsx` -> `importPFs` -> `pf_solicitacao` / `pf_aprovacao` / `pf_liberacao` -> views -> `RastreabilidadePFs/index.tsx`

### Documentos habeis

`LiquidacoesPagamentos.tsx` -> `JsonImportDialog` -> `transparenciaService.import*` -> `documentos_habeis*`

### Contratos

`Contratos.tsx` -> `useData()` -> `contratos` / `contratos_empenhos`

Enriquecimento por API:

`sync-contratos-comprasnet` -> `contratos_api*` -> `contratosApiService` -> drawer de detalhes em `Contratos.tsx`

Observacao:

- a lista principal continua usando a base local de contratos
- dados do Comprasnet aparecem apenas quando o numero normalizado do contrato local casa com `contratos_api.numero`
- o historico da API (`contratos_api_historico`) aparece no drawer com assinatura, aditivos, apostilamentos e rescisao
- contratos com origem `158155` recebem sinalizacao de Reitoria; a execucao operacional deve ser lida pela UG do campus `158366`
- Valor Total da lista usa o historico da API como fonte principal quando houver match, somando `valor_inicial` de cada termo: assinatura, aditivos, apostilamentos ou termos equivalentes. `valor_global` da API nao entra nessa metrica. Sem historico com `valor_inicial`, usa `contratos.valor` como fallback
- Valor Empenhado usa o empenhado original da API quando existir, ou o valor original do empenho local como fallback; RAP inscrito/reinscrito fica como detalhe separado
- no drawer, a secao de itens usa `contratos_api_itens.historico_item` para somar o valor contratado por item quando a API traz historico de assinatura/aditivos; `contratos_api_itens.valor_total` e apenas fallback quando nao houver historico do item
- no drawer, cada item tambem exibe o detalhamento do `historico_item` com tipo do termo, data, quantidade, valor unitario e valor total quando a API trouxer esses campos
- no resumo de itens do drawer, `Contratado` e `Executado` mostram tambem quantidade agregada: quantidade contratada pela soma de `historico_item[].quantidade` quando existir, e quantidade executada pela soma de `quantidade_faturado` nas faturas `Pago` ou `Siafi Apropriado`
- nas faturas associadas com `dados_item_faturado`, o drawer exibe quantidade faturada e valor unitario faturado alem do valor total do item
- a execucao por item soma faturas com situacao `Pago` ou `Siafi Apropriado` e vinculo `dados_item_faturado`
- faturas sem item vinculado ficam em grupo separado e nao entram na execucao oficial por item

### Editor de Documentos

`EditorDocumentos.tsx` -> `suapProcessosService.getAll` -> `processos`

Observacoes:

- a grade de processos sincronizados do editor tenta leitura publica via `supabase-js` e cai para REST anonimo quando necessario
- o detalhe do processo no Editor pode abrir o PDF sincronizado pelo bucket `suap-pdfs` usando URL assinada via `suapProcessosService.getPdfSignedUrl`
- a opcao `Despacho de Liquidacao` continua usando `documentGeneration.ts` com dados de `processos`, `empenhos`, `contratos` e `contratos_api`
- a opcao `Contrato de Servico IFRN` baixa o PDF sincronizado do processo, extrai texto com `pdfjs-dist`, identifica paginas candidatas de modelo contratual e envia o modelo escolhido com trechos de apoio para a Edge Function `gerar-contrato-licitacao`
- a opcao `Termo de Referencia - Compras` exige um modelo DOCX ativo em `document_templates`, analisa o PDF sincronizado do processo com `pdfjs-dist`, envia o template e os trechos relevantes para a Edge Function `gerar-termo-referencia-compras` e libera download do DOCX final montado sobre esse modelo
- a geracao de contrato exige `pdf_url` no processo e bloqueia quando o PDF nao traz texto pesquisavel, porque esta versao ainda nao faz OCR
- a geracao do Termo de Referencia tambem bloqueia PDFs sem texto pesquisavel e nao tenta OCR
- quando o processo contem mais de um termo/minuta de contrato, o editor pede selecao manual do modelo antes de chamar a IA
- a tela administrativa `/modelos-documentos` publica novas versoes do DOCX, arquiva a versao ativa anterior e aparece apenas para superadmin
- as telas [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx) e [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx) expõem no header o botao `Baixar extensão`, apontando para a extensao SUAP Scraper no GitHub
- a tela [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx) passou a reutilizar a sessao global do app vinda de `AuthContext`
- a pagina [Auth.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Auth.tsx) centraliza login, convite e redefinicao de senha
- convites e criacao direta de usuarios ficam centralizados em `/controle-usuarios` e usam a Edge Function `admin-users`
- a origem do link de convite usa `VITE_APP_ORIGIN` quando configurada; se o resultado apontar para `localhost` ou loopback, o envio é bloqueado no frontend
- o cliente Supabase ficou com `detectSessionInUrl` habilitado para consumir o token do link de convite ou recuperacao
- no estado atual, uploads e importacoes do frontend so aparecem para `cristiano.cnrn@gmail.com`
- o Consultor salva sessoes em `localStorage`, mas agora com chave isolada por usuario autenticado em vez de um historico global compartilhado
- no Consultor, o upload de PDF fica liberado para qualquer usuario autenticado; a restricao de superadmin continua apenas nos uploads/importacoes CSV das demais telas

## Regras de cautela

- nem toda pagina relevante usa o `DataContext`
- parte do fluxo depende de imports manuais, nao so de query
- fallback REST pode mascarar diferencas de schema e permissao
- views e Edge Functions devem ser confirmadas no banco quando nao estiverem versionadas no repo
