
# Plano: Substituir Importação CSV por JSON

## Contexto

O usuário deseja simplificar a importação de dados trocando o formato CSV pelo formato JSON, que é mais robusto e não possui os problemas de parsing relacionados a vírgulas e aspas.

## Estrutura do JSON de Atividades (fornecido)

```json
{
  "dimensao": "AD - Administração",
  "Processo": "8 - Orçamento",
  "Atividade": "Nome da atividade",
  "descricao": "Descrição",
  "valortotal": "0",
  "origemrecurso": "AD.20RL.231796.3",
  "naturezadespesa": "339000 - Não Especificado",
  "planointerno": "L20RLP01ADN"
}
```

## Alterações Propostas

### 1. Criar novo componente `JsonImportDialog.tsx`

**Arquivo:** `src/components/JsonImportDialog.tsx`

Novo componente que:
- Aceita arquivos `.json`
- Faz parsing com `JSON.parse()`
- Normaliza as chaves dos objetos (lowercase, sem acentos)
- Exibe preview dos registros encontrados
- Emite os dados para o componente pai

```typescript
interface JsonImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (data: Record<string, string>[]) => void;
  title: string;
  expectedFields: string[];
}
```

### 2. Atualizar página de Atividades

**Arquivo:** `src/pages/Atividades.tsx`

- Substituir `CsvImportDialog` por `JsonImportDialog`
- Atualizar `handleJsonImport` para mapear os campos do JSON para o modelo de Atividade
- Campos a mapear:
  - `dimensao` -> `dimensao`
  - `processo` (minúsculo) -> `processo`
  - `atividade` (minúsculo) -> `atividade`
  - `descricao` -> `descricao`
  - `valortotal` -> `valorTotal` (converter para número)
  - `origemrecurso` -> `origemRecurso`
  - `naturezadespesa` -> `naturezaDespesa`
  - `planointerno` -> `planoInterno`

### 3. Atualizar página de Empenhos

**Arquivo:** `src/pages/Empenhos.tsx`

- Substituir `CsvImportDialog` por `JsonImportDialog`
- Atualizar `handleJsonImport` para mapear os campos do JSON para o modelo de Empenho
- Campos esperados:
  - `numero`, `descricao`, `valor`, `dimensao`, `origemrecurso`, `naturezadespesa`, `dataempenho`, `status`

### 4. Remover componente antigo

**Arquivo:** `src/components/CsvImportDialog.tsx`

- Pode ser removido ou mantido como backup (recomendo remover para simplificar)

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `src/components/JsonImportDialog.tsx` | **Criar** - Novo componente de importação JSON |
| `src/pages/Atividades.tsx` | **Modificar** - Usar JsonImportDialog |
| `src/pages/Empenhos.tsx` | **Modificar** - Usar JsonImportDialog |
| `src/components/CsvImportDialog.tsx` | **Remover** |

## Vantagens da mudança

1. **Sem problemas de parsing**: JSON não tem ambiguidade com vírgulas ou aspas
2. **Encoding nativo**: JSON usa UTF-8 por padrão
3. **Estrutura clara**: Campos com nomes explícitos
4. **Validação mais simples**: JSON.parse() já valida a estrutura

## Resultado Esperado

- Botões "Importar CSV" serão substituídos por "Importar JSON"
- O arquivo JSON fornecido poderá ser importado diretamente
- Todos os registros serão mapeados corretamente para o sistema
