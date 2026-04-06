# START_HERE

Este e o ponto de entrada recomendado para pessoas e para IA.

## Objetivo

Este sistema gerencia execucao orcamentaria, documentos habeis, PFs, contratos, conciliacoes e modulos auxiliares do IFRN.
Boa parte do contrato de dados do sistema nao vem de APIs HTTP tradicionais. Ele vem de:

- tabelas e views do Supabase
- Edge Functions do Supabase
- arquivos CSV, XLSX e PDFs importados manualmente

Por isso, antes de mexer em qualquer modulo, leia a documentacao operacional correspondente.

## Ordem recomendada de leitura

1. [SYSTEM_MAP.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/ai/SYSTEM_MAP.md)
2. [SAFE_ENTRYPOINTS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/ai/SAFE_ENTRYPOINTS.md)
3. [README.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/README.md) da pasta `docs/data-import`
4. [DATA_LINEAGE.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/database/DATA_LINEAGE.md)

## Regras praticas para IA

- Nao assumir que o schema do banco esta descrito corretamente em `docs/llm/DATABASE_SCHEMA.md`.
- Nao assumir que o arquivo aceito pela UI e o mesmo realmente suportado pelo parser.
- Antes de alterar um modulo de importacao, localizar:
  - a pagina
  - o dialog/componente de upload
  - o service que faz parse
  - a tabela ou view de destino
  - o teste de regressao, se existir
- Se houver conflito entre documentacao antiga e codigo atual, o codigo atual vence.

## Fontes principais de verdade hoje

- rotas: [App.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/App.tsx)
- contexto e queries: [DataContext.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/DataContext.tsx), [useDataQueries.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/contexts/useDataQueries.ts)
- services: pasta [src/services](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services)
- migrations: pasta [supabase/migrations](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/migrations)
- functions: pasta [supabase/functions](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions)

## Documentacao antiga que exige cautela

- [README.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/README.md): ainda parece template em varias partes
- [OVERVIEW.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/llm/OVERVIEW.md): cobre um sistema menor que o atual
- [ARCHITECTURE.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/llm/ARCHITECTURE.md): util para contexto geral, mas incompleto
- [DATABASE_SCHEMA.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/llm/DATABASE_SCHEMA.md): documento inferido e parcial
- [FULL_CONTEXT.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/llm/FULL_CONTEXT.md): muito pesado para uso recorrente
