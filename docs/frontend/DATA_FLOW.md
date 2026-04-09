# DATA_FLOW

Este documento resume como os dados chegam ao frontend e circulam pelas paginas.

## Camada 1: rotas

As rotas sao lazy-loaded em [App.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/App.tsx).

Cada rota cai em uma pagina em `src/pages`.

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
- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)
- [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx)

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
- `restos a pagar pagos` deve ser lido como o valor liquidado/executado no exercicio corrente
- `restos a pagar a pagar` deve ser tratado como o saldo atual do empenho RAP
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

### Editor de Documentos

`EditorDocumentos.tsx` -> `suapProcessosService.getAll` -> `processos`

Observacoes:

- a grade de processos sincronizados do editor tenta leitura publica via `supabase-js` e cai para REST anonimo quando necessario
- a tela [Suap.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Suap.tsx) continua com sessao propria porque o modulo tambem executa acoes autenticadas de conclusao e reabertura

## Regras de cautela

- nem toda pagina relevante usa o `DataContext`
- parte do fluxo depende de imports manuais, nao so de query
- fallback REST pode mascarar diferencas de schema e permissao
- views e Edge Functions devem ser confirmadas no banco quando nao estiverem versionadas no repo
