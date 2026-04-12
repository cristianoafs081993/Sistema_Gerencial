# AGENTS

Este repositorio possui documentacao operacional obrigatoria para tarefas em areas criticas. Agentes e assistentes devem usar essa documentacao antes de propor ou aplicar mudancas.

## Ordem de leitura padrao

1. [docs/ai/START_HERE.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/ai/START_HERE.md)
2. [docs/REPOSITORY_GUIDE.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/REPOSITORY_GUIDE.md)
3. [docs/README.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/README.md)
4. [docs/TESTING.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/TESTING.md)

## Leitura obrigatoria por tipo de mudanca

- Banco de dados e migrations:
  - [docs/database/SCHEMA_OVERVIEW.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/database/SCHEMA_OVERVIEW.md)
  - [docs/database/TABLE_CATALOG.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/database/TABLE_CATALOG.md)
  - [docs/database/DATA_LINEAGE.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/database/DATA_LINEAGE.md)

- Importacoes por CSV, XLSX e PDF:
  - [docs/data-import/README.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/README.md)
  - [docs/data-import/PIPELINE_MATRIX.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/data-import/PIPELINE_MATRIX.md)
  - documento especifico do pipeline afetado

- APIs, proxies, storage e Edge Functions:
  - [docs/integrations/API_CATALOG.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/integrations/API_CATALOG.md)
  - [docs/ops/SUPABASE_FUNCTIONS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/ops/SUPABASE_FUNCTIONS.md)
  - [docs/ops/ENVIRONMENT.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/ops/ENVIRONMENT.md)

- Fluxo de dados do frontend:
  - [docs/frontend/DATA_FLOW.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/frontend/DATA_FLOW.md)

- Design system:
  - [docs/design-system/COMPONENT_CATALOG.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/design-system/COMPONENT_CATALOG.md)
  - [docs/design-system/PAGE_PATTERNS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/design-system/PAGE_PATTERNS.md)
  - [docs/design-system/TOKENS.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/design-system/TOKENS.md)

- Testes e regressao:
  - [docs/TESTING.md](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/docs/TESTING.md)

## Regras de manutencao

- Se a mudanca alterar comportamento real do sistema, atualize a documentacao correspondente no mesmo trabalho.
- Se a mudanca corrigir bug ou acrescentar funcionalidade, adicione ou ajuste testes de regressao.
- Mantenha testes unitarios e de integracao nos pontos mais criticos do sistema.
- Se houver conflito entre documentacao legada em `docs/llm` e codigo atual, o codigo atual vence.
- Nao assuma que o arquivo aceito pela UI e o mesmo realmente suportado pelo parser. Verifique pagina, dialog, service e tabela de destino.
- Nao trate a documentacao como opcional em temas de banco, importacao, integracao ou design system.

## Regra de saida

Ao concluir uma tarefa nessas areas criticas, informe explicitamente se a documentacao foi atualizada ou se permaneceu correta sem alteracao.
