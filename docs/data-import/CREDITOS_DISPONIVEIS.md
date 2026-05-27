# CREDITOS DISPONIVEIS

## Finalidade

A pagina `/credito-disponivel` exibe o relatorio de saldo de credito com detalhamento por PTRES e plano interno (PI).

## Arquivos aceitos

O upload manual aceita CSV nos dois layouts operacionais:

1. Layout detalhado, tabulado, com colunas `PTRES`, `PI`, descricao sem cabecalho, `Metrica` e valor sem cabecalho.
2. Layout legado agregado, com colunas `PTRES`, `Metrica` e `Valor`.

O parser reconhece CSV UTF-8, Windows-1252, UTF-16LE e UTF-16BE, aceita separadores tab, `;` e `,`, preserva valores `0,00` e ignora linhas sem valor parseavel.

## Persistencia

- `creditos_disponiveis_detalhes` guarda cada importacao como snapshot identificado por `import_batch_id`, incluindo `plano_interno`, `descricao`, `metrica`, `valor`, arquivo de origem e data de importacao.
- A pagina consulta somente o snapshot mais recente, para reproduzir integralmente o ultimo relatorio importado.
- `creditos_disponiveis` continua sendo atualizado por PTRES com valores agregados, preservando compatibilidade com a ingestao legada.

## Apresentacao

- A tabela exibe `PTRES`, `PI`, descricao e valor; a metrica permanece armazenada para compatibilidade, mas nao e exibida como coluna.
- O filtro inicial apresenta apenas registros com saldo diferente de zero, permitindo consultar registros zerados pelo seletor de saldo.
- O nome do arquivo de origem nao e exibido na pagina.
- A consulta e a importacao manual de credito disponivel ficam concentradas em `/credito-disponivel`; a tela de Empenhos nao exibe cards nem botao de importacao desse relatorio.

## Permissao

- leitura da pagina: usuarios autenticados com permissao para a tela;
- importacao manual: somente superadministrador.
