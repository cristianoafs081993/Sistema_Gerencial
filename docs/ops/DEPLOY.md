# DEPLOY

## Build e publicacao

Scripts principais:

- `npm run build`
- `npm run check`

Configuracao observada:

- [package.json](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/package.json)
- [vercel.json](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vercel.json)
- [vite.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vite.config.ts)

## Plataforma

O projeto esta configurado para deploy em Vercel.

Parametros atuais:

- framework: `vite`
- install: `npm install`
- build: `npm run build`
- output: `dist`

## Rewrites relevantes

Definidos em [vercel.json](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vercel.json):

- `/api-transparencia/:path*` -> `https://api.portaldatransparencia.gov.br/:path*`
- `/api-contratos/:path*` -> `https://contratos.comprasnet.gov.br/:path*`
- fallback SPA -> `/index.html`

## Fallback estatico para rotas SPA

O build tambem gera entradas estaticas por rota em `dist/<rota>/index.html` e um `dist/404.html` baseado no shell da SPA.

Objetivo:

- evitar 404 em acesso direto ou refresh de rotas como `/consultor`, `/editor-documentos` e similares
- reduzir dependencia exclusiva do rewrite do host

Implementacao:

- script: [generate-spa-fallbacks.mjs](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/scripts/generate-spa-fallbacks.mjs)
- acionado por `npm run build`

## Diferenca entre dev e producao

### Em dev

Os proxies estao no [vite.config.ts](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vite.config.ts).

### Em producao

Os rewrites equivalentes estao no [vercel.json](/C:/Users/crist/OneDrive/Desktop/Obsidian/01%20-%20Projetos/Apps/Sistema_Gerencial/vercel.json).

## Checklist minimo de deploy

1. Validar ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Rodar:
   - `npm run check`
3. Confirmar se as migrations do Supabase esperadas ja estao aplicadas
4. Confirmar se as Edge Functions chamadas pelo frontend estao publicadas
5. Confirmar rewrites das APIs externas em producao

## Riscos conhecidos

- se a function `consultor` nao estiver publicada, o modulo Consultor falha
- se a function `verificar-conformidade` nao estiver publicada, o editor perde a analise de conformidade
- se views como `vw_rastreabilidade_pf` nao existirem no banco real, algumas paginas carregam vazias ou quebram
