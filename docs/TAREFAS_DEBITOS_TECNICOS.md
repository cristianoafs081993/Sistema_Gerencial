# Tarefas Pendentes de Debito Tecnico

## Objetivo

Registrar o que ainda ficou pendente depois da rodada de estabilizacao, testes e reducao de riscos no frontend.

## Prioridade Alta

### 1. Migrar `pdfjs-dist` para uma versao segura

Status: pendente

Contexto:
- O build ainda mostra aviso de uso de `eval` vindo de `pdfjs-dist`.
- O `npm audit --omit=dev` ainda aponta vulnerabilidade alta em `pdfjs-dist`.
- O salto sugerido pelo `audit` e para `5.x`, entao isso precisa de validacao funcional.

Arquivos impactados:
- `src/pages/Consultor.tsx`
- `src/services/bolsistasPdfService.ts`
- `package.json`
- `vite.config.ts` se for necessario ajustar chunking/import

Checklist:
- Revisar changelog e breaking changes entre `3.x` e `5.x`
- Atualizar `pdfjs-dist`
- Validar import principal e configuracao de worker
- Testar leitura de PDF no Consultor
- Testar leitura de PDF no fluxo de bolsistas
- Confirmar se o warning de `eval` some no build
- Rodar `npm run lint`
- Rodar `npm test`
- Rodar `npm run build`

Criterio de conclusao:
- Sem regressao nos fluxos de PDF
- Sem warning de `pdfjs-dist` no build
- Sem vulnerabilidade alta remanescente ligada a `pdfjs-dist`

### 2. Definir estrategia para substituir ou isolar `xlsx`

Status: pendente

Contexto:
- `npm audit --omit=dev` ainda aponta vulnerabilidades altas em `xlsx`
- O pacote atual nao tem `fixAvailable`
- Hoje ele e usado em varios fluxos de importacao, entao a troca precisa ser planejada

Arquivos impactados:
- `src/services/financeiroImportService.ts`
- `src/services/retencoesEfdReinfImportService.ts`
- `src/services/pfImportService.ts`
- outros servicos de importacao que usam `xlsx`

Checklist:
- Mapear todos os usos atuais de `xlsx`
- Avaliar alternativas:
  - atualizar para uma linha segura, se disponivel
  - trocar por outra biblioteca
  - limitar `xlsx` apenas a arquivos estritamente necessarios
- Validar impacto em CSV, XLSX e datas
- Criar testes adicionais nos fluxos que forem alterados

Criterio de conclusao:
- Sem vulnerabilidade alta remanescente ligada a `xlsx`, ou risco formalmente aceito e isolado

## Prioridade Media

### 3. Reduzir vulnerabilidades transitivas restantes

Status: pendente

Contexto:
- Depois das atualizacoes feitas, o `audit` caiu, mas ainda restam dependencias transitivas com alerta
- As principais remanescentes estao ligadas a `glob`, `minimatch`, `lodash`, `yaml`, `rollup` e cadeia interna de `pdfjs-dist`

Checklist:
- Rodar `npm audit --omit=dev`
- Classificar o que e:
  - corrigivel por update simples
  - corrigivel por update major
  - apenas transitivo sem impacto real no runtime de producao
- Atualizar o que for seguro
- Registrar o que precisar de aceite tecnico

Criterio de conclusao:
- Lista residual pequena, explicada e com plano claro

### 4. Revisar dependencia `vite` para linha mais nova

Status: parcialmente tratado

Contexto:
- Ja atualizamos para `5.4.21`
- O `audit` ainda sinaliza que a correcao completa sobe para `vite 8.x`

Checklist:
- Avaliar compatibilidade de `vite 8`
- Validar plugin `@vitejs/plugin-react-swc`
- Validar build, preview e chunk splitting

Criterio de conclusao:
- Upgrade feito com sucesso ou decisao registrada de permanencia temporaria

## Prioridade Baixa

### 5. Limpar artefatos e warnings operacionais

Status: pendente

Checklist:
- Remover arquivos temporarios de `vite.config.ts.timestamp-*` se ainda existirem
- Revisar se ha arquivos de build/cache versionados por engano
- Manter `dist` e caches fora de commit

### 6. Consolidar documentacao da rodada tecnica

Status: pendente

Checklist:
- Registrar o que foi concluido nas fases anteriores
- Registrar o que ainda depende de migracao maior
- Opcional: transformar este arquivo em checklist viva de manutencao

## Comandos de retomada

Quando voltarmos para este bloco, usar:

```powershell
npm run lint
npm test
npm run build
npm audit --omit=dev
```

## Resumo rapido

Pendencia mais critica agora:
- `pdfjs-dist`
- `xlsx`

Pendencia estrutural menor:
- vulnerabilidades transitivas restantes
- eventual upgrade maior de `vite`
