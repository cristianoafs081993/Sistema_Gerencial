# SYSTEM_MAP

## Stack atual

- frontend: React 18 + Vite
- linguagem: TypeScript
- UI: Tailwind + shadcn/ui + componentes proprios do design system
- estado de dados: React Query + DataContext
- backend principal: Supabase
- integracoes externas:
  - Portal da Transparencia
  - API de contratos
  - Edge Functions do Supabase
  - importacao manual por CSV/XLSX/PDF

## Rotas principais

Definidas em [App.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/App.tsx).

- `/`: Dashboard
- `/atividades`: planejamento orcamentario
- `/descentralizacoes`: movimentacao descentralizada
- `/empenhos`: empenhos de exercicio e RAP
- `/contratos`: contratos locais
- `/liquidacoes-pagamentos`: documentos habeis, OBs, fontes SOF e situacoes
- `/financeiro`: saldo por fonte e vinculacao
- `/lc`: lista de credores + comparacao com PDFs + macro SIAFI
- `/retencoes-efd-reinf`: auditoria de retencoes
- `/rastreabilidade-pfs`: fluxo de PFs
- `/conciliacao-pfs`: conciliacao operacional de PFs
- `/gerador-documentos`: geracao documental
- `/editor-documentos`: editor rico com integracao de IA
- `/consultor`: modulo de consulta/IA
- `/suap`: processos SUAP
- `/design-system-preview`: vitrine visual

## Camadas principais

### Rotas e paginas

As paginas ficam em [src/pages](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages).

### Estado compartilhado

- [DataContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/DataContext.tsx)
- [useDataQueries.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/useDataQueries.ts)
- [useCrudMutations.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/useCrudMutations.ts)

### Integracao com banco e APIs

- cliente Supabase: [supabase.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabase.ts)
- fallback REST: [supabaseRest.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabaseRest.ts)
- validacao de ambiente: [env.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/env.ts)
- services: [src/services](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services)

## Dominios de dados

### Orcamento base

- `atividades`
- `empenhos`
- `descentralizacoes`
- `creditos_disponiveis`

### Documentos e execucao

- `documentos_habeis`
- `documentos_habeis_itens`
- `documentos_habeis_situacoes`

### PFs e conciliacao

- `pf_solicitacao`
- `pf_aprovacao`
- `pf_liberacao`
- views de controle e conciliacao

### Contratos

- `contratos`
- `contratos_empenhos`
- `contratos_api`
- `contratos_api_empenhos`
- `contratos_api_faturas`
- `contratos_api_sync_runs`

### Importacoes auxiliares

- `financeiro_fonte_vinculacao`
- `lc_credores`
- `retencoes_efd_reinf`

## Observacoes criticas

- O sistema usa tabelas, views e imports manuais ao mesmo tempo.
- Nem toda view consumida no frontend esta claramente presente nas migrations do repo.
- Nem toda Edge Function invocada pelo frontend esta versionada localmente.
- Parte do comportamento depende da estrutura real dos arquivos de entrada, nao apenas do schema do banco.
