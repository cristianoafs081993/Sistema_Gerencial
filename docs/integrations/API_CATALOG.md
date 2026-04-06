# API_CATALOG

Este catalogo resume as integracoes externas e internas relevantes para o frontend.

## 1. Supabase Database

Uso:

- cliente principal do app

Arquivos:

- [supabase.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabase.ts)
- [env.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/env.ts)

Credenciais necessarias:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Observacao:

- o app usa tanto `supabase-js` quanto fallback REST.

## 2. Supabase REST fallback

Uso:

- fallback quando `supabase-js` falha ou retorna vazio em alguns carregamentos

Arquivo:

- [supabaseRest.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/lib/supabaseRest.ts)

Headers usados:

- `apikey`
- `Authorization: Bearer <anon key>`

Risco:

- se a politica RLS ou o schema mudarem, o fallback pode divergir do comportamento principal.

## 3. Portal da Transparencia

Uso:

- consulta de documentos, historicos e empenhos impactados

Proxy local:

- `/api-transparencia`

Configuracao:

- [vite.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vite.config.ts)

Service:

- [transparencia.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/transparencia.ts)

Endpoints observados:

- `/api-de-dados/despesas/documentos`
- `/api-de-dados/despesas/itens-de-empenho/historico`
- `/api-de-dados/despesas/empenhos-impactados`

Credenciais:

- o service atual usa `chave-api-dados`

Observacao:

- existe chave de API embutida no service. Isso deve ser tratado como contrato operacional sensivel e idealmente sair do codigo.

## 4. API de Contratos

Uso:

- sincronizacao de contratos ativos e inativos, empenhos e faturas

Proxy local:

- `/api-contratos`

Configuracao:

- [vite.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vite.config.ts)

Service:

- [contratosApi.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/contratosApi.ts)

Base usada:

- `/api-contratos/api`

Endpoints observados:

- `/contrato/ug/{unidadeCodigo}`
- `/contrato/inativo/ug/{unidadeCodigo}`
- `/contrato/{api_contrato_id}/empenhos`
- `/contrato/{api_contrato_id}/faturas`

Persistencia local:

- `contratos_api`
- `contratos_api_empenhos`
- `contratos_api_faturas`
- `contratos_api_sync_runs`

## 5. Edge Function `analisar-liquidacao-siafi`

Uso:

- analise de prints do SIAFI para concluir processo no modulo SUAP

Chamador:

- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

Implementacao no repo:

- [analisar-liquidacao-siafi/index.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/supabase/functions/analisar-liquidacao-siafi/index.ts)

Dependencias externas:

- `OPENAI_API_KEY`
- opcionalmente `OPENAI_VISION_MODEL`

## 6. Edge Function `consultor`

Uso:

- chat juridico e analise de PDF no modulo Consultor

Chamador:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)

Status:

- o frontend monta a URL por `getSupabaseFunctionUrl('consultor')`
- a implementacao da function nao foi localizada no repo nesta rodada

## 7. Edge Function `verificar-conformidade`

Uso:

- verificacao de conformidade documental no editor rico

Chamador:

- [EditorDocumentos.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/EditorDocumentos.tsx)

Status:

- invocada pelo frontend
- nao localizada em `supabase/functions` nesta rodada

## 8. Supabase Storage

Uso:

- PDFs do modulo SUAP

Chamador:

- [suapProcessos.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/services/suapProcessos.ts)

Bucket observado:

- `suap-pdfs`

## 9. Bibliotecas com contrato operacional relevante

### `pdfjs-dist`

Uso:

- leitura de PDFs no frontend

Arquivo:

- [Consultor.tsx](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/src/pages/Consultor.tsx)

### `xlsx`

Uso:

- leitura de CSV/XLSX em importacoes

Arquivos:

- `financeiroImportService.ts`
- `lcImportService.ts`
- `pfImportService.ts`
- `retencoesEfdReinfImportService.ts`
