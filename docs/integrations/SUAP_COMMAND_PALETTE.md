# Consultas SUAP pela paleta de comandos

A extensão permite abrir consultas oficiais do SUAP pela paleta `Ctrl+K` sem exigir que a aba atual esteja no SUAP. No SIAGES, essas consultas aparecem na paleta nativa; nas demais páginas compatíveis, inclusive no Comprasnet, a extensão fornece a paleta. A extensão não injeta uma segunda paleta no SIAGES nem no SUAP.

## Consultas

Digite um termo para ver as consultas disponíveis ou use um prefixo para direcionar a pesquisa:

| Tipo | Prefixos aceitos |
| --- | --- |
| Processos | `processo`, `processos`, `proc`, `p` |
| Alunos | `aluno`, `alunos`, `matricula`, `alu`, `mat`, `a` |
| Documentos | `documento`, `documentos`, `docto`, `doc`, `d` |
| Contratos | `contrato`, `contratos`, `con`, `c` |

Exemplos: `proc 23000.000123/2026-01`, `aluno 20201234567890`, `doc minuta`, `contrato 12/2024`. Uma matrícula numérica abre o registro do aluno; outros termos abrem a pesquisa do SUAP.

Enter abre a consulta na aba atual. `Ctrl+Enter` abre em uma nova aba. A consulta é apenas uma navegação para o domínio oficial `suap.ifrn.edu.br`; é necessário estar autenticado no SUAP para acessar o resultado.

## Escopo e segurança

- A consulta não lê nem armazena dados do SUAP na página de origem.
- A paleta global pode coexistir com o content script de redação de ETP no Comprasnet.
- Ações contextuais de processos e comandos de sincronização não são liberados globalmente por esta funcionalidade.
- Páginas internas ou superfícies nas quais o navegador bloqueia content scripts não são compatíveis.

## Validação manual

1. Recarregue a extensão em `chrome://extensions` e abra uma página comum, o SIAGES e uma tela do Comprasnet.
2. Abra a paleta com `Ctrl+K` e teste as quatro consultas, incluindo uma matrícula numérica.
3. Confirme que Enter usa a aba atual e `Ctrl+Enter` abre uma nova aba no SUAP.
4. No SIAGES, confirme que somente a paleta nativa aparece; no Comprasnet, confirme que o assistente de ETP continua disponível.
5. Confirme que o comando de sincronização imediata e as ações contextuais de processo permanecem restritos.
