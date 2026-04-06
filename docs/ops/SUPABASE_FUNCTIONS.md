# SUPABASE_FUNCTIONS

## Functions identificadas no repo

### `analisar-liquidacao-siafi`

Local:

- [analisar-liquidacao-siafi/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/analisar-liquidacao-siafi/index.ts)

Chamador:

- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

Entrada esperada:

- dados do processo
- `nsNumero`
- screenshots em `dataUrl`

Saida:

- objeto de analise com `statusGeral`, `resumo`, `recomendacao` e `itens`

Dependencias:

- `OPENAI_API_KEY`
- opcional `OPENAI_VISION_MODEL`

## Functions chamadas pelo frontend, mas nao localizadas neste repo

### `consultor`

Chamador:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)

Observacao:

- o frontend monta a URL para `functions/v1/consultor`
- a implementacao nao foi localizada em `supabase/functions`

### `verificar-conformidade`

Chamador:

- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Observacao:

- a function e invocada por `supabase.functions.invoke`
- a implementacao nao foi localizada em `supabase/functions`

## Recomendacao operacional

Antes de manutencao em modulos dependentes de IA:

1. confirmar quais functions existem no projeto Supabase real
2. confirmar segredos configurados em cada function
3. alinhar repo e ambiente publicado para evitar drift
