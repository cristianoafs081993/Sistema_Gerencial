-- Referências históricas fornecidas pelo usuário; não constituem validação de vigência.
CREATE TABLE public.referencias_retencao_documentos (id text PRIMARY KEY, titulo text NOT NULL, origem text NOT NULL, data_referencia text, observacao text NOT NULL);
CREATE TABLE public.referencias_retencao_paginas (documento_id text NOT NULL REFERENCES public.referencias_retencao_documentos(id), pagina integer NOT NULL CHECK (pagina > 0), texto text NOT NULL, PRIMARY KEY (documento_id, pagina));
CREATE TABLE public.naturezas_rendimento_reinf (codigo text PRIMARY KEY CHECK (codigo ~ '^\d{5}$'), descricao text NOT NULL, codigo_receita text NOT NULL CHECK (codigo_receita ~ '^\d{4}$'), documento_id text NOT NULL REFERENCES public.referencias_retencao_documentos(id));
CREATE TABLE public.referencias_retencao_aliquotas (documento_id text NOT NULL REFERENCES public.referencias_retencao_documentos(id), codigo_receita text NOT NULL CHECK (codigo_receita ~ '^\d{4}$'), ir numeric(5,2) NOT NULL, csll numeric(5,2) NOT NULL, cofins numeric(5,2) NOT NULL, pis_pasep numeric(5,2) NOT NULL, percentual_total numeric(5,2) NOT NULL, PRIMARY KEY (documento_id, codigo_receita), CHECK (ir + csll + cofins + pis_pasep = percentual_total));
INSERT INTO public.referencias_retencao_documentos VALUES
('ufmg-2024', 'Tabela Natureza de Rendimento x Código de Receita - EFD-Reinf (Evento R-4020)', 'Divisão de Análise e Controle/DCF', 'Janeiro/2024', 'Tabela histórica; conferir vigência e enquadramento antes de utilizar.'),
('coad-orientacao', 'Retenção por entidades e órgãos públicos federais', 'COAD, documento fornecido pelo usuário', 'Impressão em 05/08/2026', 'Orientação histórica que cita IN SRF 480/2004; data de impressão não comprova vigência.');
INSERT INTO public.naturezas_rendimento_reinf (codigo, descricao, codigo_receita, documento_id) VALUES
('17001', 'Alimentação', '6147', 'ufmg-2024'),
('17002', 'Energia elétrica', '6147', 'ufmg-2024'),
('17003', 'Serviços prestados com emprego de materiais', '6147', 'ufmg-2024'),
('17004', 'Construção Civil por empreitada com emprego de materiais', '6147', 'ufmg-2024'),
('17005', 'Serviços hospitalares de que trata o art. 30 da Instrução Normativa RFB nº 1.234, de 11 de janeiro de 2012', '6147', 'ufmg-2024'),
('17006', 'Transporte de cargas, exceto os relacionados na natureza de rendimento "17017"', '6147', 'ufmg-2024'),
('17007', 'Serviços de auxílio diagnóstico e terapia, patologia clínica, imagenologia, anatomia patológica e citopatológica, medicina nuclear e análises e patologias clínicas, exames por métodos gráficos, procedimentos endoscópicos, radioterapia, quimioterapia, diálise e oxigenoterapia hiperbárica de que trata o art. 31 e parágrafo único da Instrução', '6147', 'ufmg-2024'),
('17008', 'Produtos farmacêuticos, de perfumaria, de toucador ou de higiene pessoal adquiridos de produtor, importador, distribuidor ou varejista, exceto os relacionados nas naturezas de rendimentos de “17019" a "17022"', '6147', 'ufmg-2024'),
('17009', 'Mercadorias e bens em geral', '6147', 'ufmg-2024'),
('17010', 'Gasolina, inclusive de aviação, óleo diesel, gás liquefeito de petróleo (GLP), combustíveis derivados de petróleo ou de gás natural, querosene de aviação (QAV), e demais produtos derivados de petróleo, adquiridos de refinarias de petróleo, de demais produtores, de importadores, de distribuidor ou varejista', '9060', 'ufmg-2024'),
('17011', 'Álcool etílico hidratado, inclusive para fins carburantes, adquirido diretamente de produtor, importador ou do distribuidor', '9060', 'ufmg-2024'),
('17012', 'Biodiesel adquirido de produtor ou importador', '9060', 'ufmg-2024'),
('17013', 'Gasolina, exceto gasolina de aviação, óleo diesel e gás liquefeito de petróleo (GLP), derivados de petróleo ou de gás natural e querosene de aviação adquiridos de distribuidores e comerciantes varejistas', '8739', 'ufmg-2024'),
('17014', 'Álcool etílico hidratado nacional, inclusive para fins carburantes adquirido de comerciante varejista', '8739', 'ufmg-2024'),
('17015', 'Biodiesel adquirido de distribuidores e comerciantes varejistas', '8739', 'ufmg-2024'),
('17016', 'Biodiesel adquirido de produtor detentor regular do selo “Combustível Social”, fabricado a partir de mamona ou fruto, caroço ou amêndoa de palma produzidos nas regiões norte e nordeste e no semiárido, por agricultor familiar enquadrado no', '8739', 'ufmg-2024'),
('17017', 'Transporte internacional de cargas efetuado por empresas nacionais', '8767', 'ufmg-2024'),
('17018', 'Estaleiros navais brasileiros nas atividades de Construção, conservação, modernização, conversão e reparo de embarcações pré-registradas ou registradas no REB', '8767', 'ufmg-2024'),
('17019', 'Produtos de perfumaria, de toucador e de higiene pessoal a que se refere o § 1º do art. 22 da Instrução Normativa RFB nº 1.234, de 2012, adquiridos de distribuidores e de comerciantes varejistas', '8767', 'ufmg-2024'),
('17020', 'Produtos a que se refere o § 2º do art. 22 da Instrução Normativa RFB nº 1.234, de 2012', '8767', 'ufmg-2024'),
('17021', 'Produtos de que tratam as alíneas “c” a “k” do inciso I do art. 5º da Instrução Normativa RFB nº 1.234, de 2012', '8767', 'ufmg-2024'),
('17022', 'Outros produtos ou serviços beneficiados com isenção, não incidência ou Alíquotas zero da Cofins e da Contribuição para o PIS/Pasep, observado o disposto no § 5º do art. 2º da Instrução Normativa RFB nº 1.234, de 2012', '8767', 'ufmg-2024'),
('17023', 'Passagens aéreas, rodoviárias e demais serviços de transporte de passageiros, inclusive, tarifa de embarque, exceto transporte internacional de passageiros, efetuado por empresas nacionais', '6175', 'ufmg-2024'),
('17024', 'Transporte internacional de passageiros efetuado por empresas nacionais', '8850', 'ufmg-2024'),
('17025', 'Serviços prestados por associações profissionais ou assemelhadas e cooperativas', '8863', 'ufmg-2024'),
('17026', 'Serviços prestados por bancos comerciais, bancos de investimento, bancos de desenvolvimento, caixas econômicas, sociedades de crédito, financiamento e investimento, sociedades de crédito imobiliário, e câmbio, distribuidoras de títulos e valores mobiliários, empresas de arrendamento mercantil, cooperativas de crédito, empresas de seguros privados e de capitalização e entidades abertas de previdência complementar.', '6188', 'ufmg-2024'),
('17027', 'Seguro Saúde', '6188', 'ufmg-2024'),
('17028', 'Serviços de abastecimento de água', '6190', 'ufmg-2024'),
('17029', 'Telefone', '6190', 'ufmg-2024'),
('17030', 'Correio e telégrafos', '6190', 'ufmg-2024'),
('17031', 'Vigilância', '6190', 'ufmg-2024'),
('17032', 'Limpeza', '6190', 'ufmg-2024'),
('17033', 'Locação de mão de obra', '6190', 'ufmg-2024'),
('17034', 'Intermediação de negócios;', '6190', 'ufmg-2024'),
('17035', 'Administração, locação ou cessão de bens imóveis, móveis e direitos de qualquer natureza', '6190', 'ufmg-2024'),
('17036', 'Factoring', '6190', 'ufmg-2024'),
('17037', 'Plano de saúde humano, veterinário ou odontológico com valores fixos por servidor, por empregado ou por animal', '6190', 'ufmg-2024'),
('17038', 'Pagamento efetuado a sociedade cooperativa pelo fornecimento de bens, conforme art. 24, da IN 1234/12.', '8863', 'ufmg-2024'),
('17040', 'Serviços prestados por associações profissionais ou assemelhadas e cooperativas que envolver parcela de serviços fornecidos por terceiros não cooperados ou não associados, contratados ou conveniados, para cumprimento de contratos – Serviços prestados com emprego de materiais, inclusive o de que trata a alínea “C” do Inciso II do art. 27 da IN 1.1234.', '6147', 'ufmg-2024'),
('17041', 'Serviços prestados por associações profissionais ou assemelhadas e cooperativas que envolver parcela de serviços fornecidos por terceiros não cooperados ou não associados, contratados ou conveniados, para cumprimento de contratos - Demais serviços', '6190', 'ufmg-2024'),
('17042', 'Pagamentos efetuados às associações e às cooperativas de médicos e de odontólogos, relativamente às importâncias recebidas a título de comissão, taxa de administração ou de adesão ao plano', '6190', 'ufmg-2024'),
('17043', 'Pagamento efetuado a sociedade cooperativa de produção, em relação aos atos decorrentes da comercialização ou de industrialização, pelas cooperativas agropecuárias e de pesca, de produtos adquiridos de não associados, agricultores, pecuaristas ou pescadores, para completar lotes destinados ao cumprimento de contratos ou para suprir capacidade ociosa de suas instalações industriais, conforme § 1º do art. 25, da IN 1234/12.', '6147', 'ufmg-2024'),
('17046', 'Pagamento efetuado na aquisição de bem imóvel, quando o vendedor for pessoa jurídica que exerce a atividade de compra e venda de imóveis, ou quando se tratar de imóveis adquiridos de entidades abertas de previdência complementar com fins lucrativos, conforme art. 23, inc I, da IN RFB 1234/2012.', '6147', 'ufmg-2024'),
('17047', 'Pagamento efetuado na aquisição de bem imóvel adquirido pertencente ao ativo não circulante da empresa vendedora, conforme art. 23, inc II da IN RFB 1234/2012.', '8767', 'ufmg-2024'),
('17049', 'Propaganda e Publicidade, em desconformidade ao art 16 da IN RFB 1234/2012, referente ao § 4º do citado artigo.', '6190', 'ufmg-2024'),
('17050', 'Propaganda e Publicidade, em conformidade ao art 16 da IN RFB 1234/2012, referente ao § 4º do citado artigo.', '8863', 'ufmg-2024'),
('17099', 'Demais serviços', '6190', 'ufmg-2024');
INSERT INTO public.referencias_retencao_aliquotas VALUES
('coad-orientacao', '6147', 1.20, 1.00, 3.00, 0.65, 5.85),
('coad-orientacao', '9060', 0.24, 1.00, 3.00, 0.65, 4.89),
('coad-orientacao', '8739', 0.24, 1.00, 0.00, 0.00, 1.24),
('coad-orientacao', '8767', 1.20, 1.00, 0.00, 0.00, 2.20),
('coad-orientacao', '6175', 2.40, 1.00, 3.00, 0.65, 7.05),
('coad-orientacao', '8850', 2.40, 1.00, 0.00, 0.00, 3.40),
('coad-orientacao', '8863', 0.00, 1.00, 3.00, 0.65, 4.65),
('coad-orientacao', '6188', 2.40, 1.00, 3.00, 0.65, 7.05),
('coad-orientacao', '6190', 4.80, 1.00, 3.00, 0.65, 9.45);
INSERT INTO public.referencias_retencao_paginas VALUES
('coad-orientacao', 1, '05/08/2026, 09:18 Untitled Document
ORIENTAÇÃO
RETENÇÃO POR ENTIDADES E ÓRGÃOS PÚBLICOS FEDERAIS
Fornecimento de Bens ou Prestação de Serviços
Veja como é calculada a retenção de tributos sobre vendas e serviços a órgãos públicos
Nesta Orientação examinamos os procedimentos relativos às retenções na fonte do IRPJ, da CSLL, da Cofins e do
PIS/Pasep sobre os pagamentos às pessoas jurídicas decorrentes do fornecimento de bens ou prestação de serviços em
geral, inclusive obras, aos órgãos da administração federal direta, às autarquias, fundações federais, empresas públicas,
sociedades de economia mista e demais entidades em que a União, direta ou indiretamente detenha a maioria do capital
social sujeito a voto, e que recebam recursos do Tesouro Nacional e estejam obrigadas a registrar sua execução
orçamentária e financeira no Siafi – Sistema Integrado de Administração Financeira do Governo Federal.
1. RESPONSABILIDADE PELA RETENÇÃO
A responsabilidade pela retenção do IRPJ e das mencionadas contribuições sociais é dos órgãos ou das entidades da
administração pública federal que efetuarem o pagamento.
A pessoa jurídica fornecedora do bem ou prestadora do serviço deverá informar no documento fiscal a ser entregue à
fonte pagadora o valor do Imposto de Renda e das contribuições a serem retidos na operação.
2. CÁLCULO DA RETENÇÃO
A retenção será efetuada aplicando-se, sobre o valor a ser pago, o percentual constante da coluna 6 da Tabela de
Retenção reproduzida a seguir, que corresponde à soma:
a) das alíquotas das contribuições devidas; e
b) da alíquota do Imposto de Renda, determinada mediante a aplicação de 15% sobre a base de cálculo estabelecida no
artigo 15 da Lei 9.249/95, conforme a natureza do bem fornecido ou do serviço prestado.
ALÍQUOTAS PERCENTUAL CÓDIGO
NATUREZA DO BEM FORNECIDO
A SER DA
OU DO SERVIÇO PRESTADO IR CSLL COFINS PIS/PASEP APLICADO RECEITA
(01) (02) (03) (04) (05) (06) (07)
Alimentação;
Energia elétrica;
Serviços prestados com emprego de
materiais;
Construção Civil por empreitada com
1,2 1,0 3,0 0,65 5,85 6147
emprego de materiais;
Serviços hospitalares;
Transporte de cargas, exceto os
relacionados no código 8767;
Mercadorias e bens em geral.
Gasolina, óleo diesel, Gás Liquefeito de
Petróleo (GLP) e Querosene de Aviação (QAV)
adquirido de produtor ou importador;
Demais combustíveis derivados de petróleo
e gás natural, e dos demais produtos derivados
0,24 1,0 3,0 0,65 4,89 9060
de petróleo, adquiridos de produtor, importador,
distribuidor ou varejista;
Álcool etílico hidratado para fins
carburantes, adquirido diretamente do
distribuidor.
Gasolina, exceto gasolina de aviação, óleo
diesel e Gás Liquefeito de Petróleo (GLP) e
Querosene de Aviação adquiridos de
0,24 1,0 0,0 0,0 1,24 8739
distribuidores e comerciantes varejistas, e álcool
para fins carburantes quando adquirido,
exclusivamente, de comerciante varejista.
Transporte internacional de cargas efetuado 1,2 1,0 0,0 0,0 2,2 8767
por empresas nacionais;
Estaleiros navais brasileiros nas atividades
de construção, conservação, modernização,
conversão e reparo de embarcações pré-
registradas ou registradas no Registro Especial
Brasileiro (REB), instituído pela Lei 9.432, de 8-
1-1997;
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 1/12'),
('coad-orientacao', 2, '05/08/2026, 09:18 Untitled Document
Aquisição de livros no mercado interno;
Medicamentos, produtos de perfumaria, de
toucador e de higiene pessoal a que se refere o
artigo 1º da Lei 10.147, de 2000, com a redação
dada pela Lei 10.548, de 2002, adquiridos de
atacadistas ou varejistas;
Pneus novos de borracha e Câmaras-de-ar
de borracha, classificados nas posições 40.11 e
40.13 da Tipi, adquiridos de atacadistas e
varejistas;
Máquinas, veículos e tratores de que trata o
caput do artigo 20 da Instrução Normativa 480
SRF/2004 e autopeças constantes do Anexo I e
II, da Lei 10.485, de 3-7-2002, adquiridos de
atacadistas e varejistas;
Água, refrigerante e cerveja sem álcool,
classificados nos códigos 22.01 e 22.02 da Tipi,
adquiridos de atacadistas e varejistas.
Outros produtos ou serviços beneficiados
com isenção, não incidência ou alíquotas zero
da Cofins e da Contribuição para o PIS/Pasep.
Passagens aéreas, rodoviárias e demais
serviços de transporte de passageiros, exceto 2,40 1,0 3,0 0,65 7,05 6175
as relacionadas no código 8850.
Transporte internacional de passageiros
2,40 1,0 0,0 0,0 3,40 8850
efetuado por empresas nacionais.
Serviços prestados por associações
0,0 1,0 3,0 0,65 4,65 8863
profissionais ou assemelhadas.
Serviços prestados por bancos comerciais,
bancos de investimento, bancos de
desenvolvimento, caixas econômicas,
sociedades de crédito, financiamento e
investimento, sociedades de crédito imobiliário,
2,40 1,0 3,0 0,65 7,05 6188
e câmbio, distribuidoras de títulos e valores
mobiliários, empresas de arrendamento
mercantil, cooperativas de crédito, empresas de
seguros privados e de capitalização e entidades
abertas de previdência complementar.
Serviços de abastecimento de água;
Telefone;
Correio de Telégrafos;
Vigilância;
Limpeza;
Locação de mão de obra; 4,80 1,0 3,0 0,65 9,45 6190
Intermediação de negócios;
Administração, locação ou cessão de bens
imóveis, móveis e direitos de qualquer natureza;
Factoring;
Demais serviços.
2.1. ALÍQUOTA DA CSLL
O valor da CSLL, a ser retido, será determinado mediante a aplicação da alíquota de 1% sobre o montante a ser pago.
2.2. ALÍQUOTAS DO PIS/PASEP E DA COFINS
O valor da Cofins e do PIS/Pasep, a ser retido, será determinado, aplicando-se as alíquotas de 3% e 0,65%,
respectivamente, sobre o montante a ser pago.
As mencionadas alíquotas aplicam-se inclusive na hipótese de as receitas de fornecimento de bens ou de prestação de
serviço estarem sujeitas ao regime de não cumulatividade da Cofins e do PIS/Pasep ou aos regimes de alíquotas
diferenciadas.
2.3. PAGAMENTO COM PERCENTUAIS DIFERENCIADOS
O percentual a ser aplicado sobre o valor a ser pago corresponderá à espécie do bem fornecido ou de serviço prestado,
conforme estabelecido em contrato entre as partes envolvidas na operação.
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 2/12'),
('coad-orientacao', 3, '05/08/2026, 09:18 Untitled Document
Quando o pagamento se referir a contratos distintos celebrados com a mesma pessoa jurídica pelo fornecimento de bens
ou de serviços prestados com percentuais diferenciados, deverá ser aplicado o percentual correspondente a cada
fornecimento contratado.
2.4. PAGAMENTOS ANTECIPADOS
A retenção do IRPJ e das contribuições será efetuada sobre qualquer forma de pagamento, inclusive naqueles
antecipados por conta de fornecimento de bens ou de prestação de serviços, para entrega futura.
2.5. DISPENSA DE RETENÇÃO
Fica dispensada a retenção quando o valor a ser retido for inferior a R$ 10,00. No entanto, essa dispensa não se aplica
na hipótese de Darf eletrônico efetuado por meio do Siafi.
3. DEFINIÇÃO DE SERVIÇOS COM EMPREGO DE MATERIAIS
Para os fins da retenção ora examinada, considera-se:
a) serviços prestados com emprego de materiais, os serviços contratados com previsão de fornecimento de material, cujo
fornecimento esteja segregado da prestação de serviço no contrato, e desde que discriminados separadamente no
documento fiscal de prestação de serviços, excetuados os serviços hospitalares, definidos no item 21;
b) construção por empreitada com emprego de materiais, a contratação por empreitada de construção civil, na
modalidade total, fornecendo o empreiteiro todos os materiais indispensáveis à sua execução, sendo tais materiais
incorporados à obra. Não serão considerados como materiais incorporados à obra, os instrumentos de trabalho utilizados
e os materiais consumidos na execução da obra.
4. PESSOAS JURÍDICAS/RECEITAS AMPARADAS POR ISENÇÃO, NÃO INCIDÊNCIA OU ALÍQUOTA ZERO
No caso de pessoa jurídica ou de receitas amparadas por isenção, não incidência ou alíquota zero, na forma da
legislação específica, do Imposto de Renda ou de uma ou mais contribuições, a retenção deverá ser efetuada mediante a
aplicação das alíquotas específicas mencionadas no item 2, correspondente ao Imposto de Renda ou às contribuições
não alcançadas pela isenção, não incidência ou pela alíquota zero. O recolhimento será efetuado mediante a utilização
dos códigos relacionados no item 25.
As pessoas jurídicas amparadas por isenção, não incidência ou alíquota zero devem informar esta condição no
documento fiscal, inclusive o enquadramento legal, sob pena de, se não o fizerem, se sujeitarem à retenção do Imposto
de Renda e das contribuições sobre o valor total do documento fiscal, no percentual total correspondente à natureza do
bem ou serviço.
5. COMPENSAÇÃO DOS VALORES RETIDOS
Os valores retidos poderão ser compensados, pelo contribuinte, com o valor do imposto e contribuições de mesma
espécie, devidos relativamente a fatos geradores ocorridos a partir do mês de retenção.
O valor a ser compensado, correspondente ao IRPJ e a cada espécie de contribuição social, será determinado pelo
próprio contribuinte mediante a aplicação, sobre o valor do documento fiscal, da alíquota respectiva, constante das
colunas 02, 03, 04 ou 05 da Tabela de Retenção constante no item 2.
Os valores retidos na fonte a título de PIS e de Cofins, quando não for possível sua dedução dos valores a pagar das
respectivas contribuições no mês de apuração, poderão ser restituídos ou compensados com débitos relativos a outros
tributos e contribuições administrados pela RFB, observada a legislação específica aplicável à matéria.
Neste caso, fica configurada a impossibilidade da dedução quando o montante retido no mês exceder o valor da
respectiva contribuição a pagar no mesmo mês.
Para efeito de determinação do excesso, considera-se contribuição a pagar no mês da retenção o valor da contribuição
devida descontada dos créditos apurados naquele mês.
O saldo dos valores retidos na fonte a título de PIS e de Cofins, apurados em períodos anteriores, poderá também ser
restituído ou compensado com débitos relativos a outros tributos e contribuições administrados pela RFB, na forma da
Instrução Normativa 900 RFB/2008.
6. OPERAÇÕES COM CARTÕES DE CRÉDITO OU DE DÉBITOS
Nos pagamentos correspondentes ao fornecimento de bens ou pela prestação de serviços efetuados por meio de cartões
de crédito ou débito, a retenção será efetuada pelo órgão ou entidade pagador sobre o total a ser pago à empresa
fornecedora do bem ou prestadora do serviço, devendo o pagamento com o cartão ser realizado pelo valor líquido,
depois de deduzidos os valores do imposto e das contribuições retidas, cabendo a responsabilidade pelo recolhimento
destas ao órgão ou entidade adquirente do bem ou tomador dos serviços.
7. DOCUMENTOS DE COBRANÇAS COM CÓDIGO DE BARRA
Nas notas fiscais, nas faturas, nos boletos bancários ou em quaisquer outros documentos de cobrança dos bens ou
serviços, que contenham código de barras, deverão ser informados o valor bruto do preço do bem fornecido ou do
serviço prestado e os valores do Imposto de Renda e das contribuições a serem retidos na operação, devendo o seu
pagamento ser efetuado pelo valor líquido deduzido das respectivas retenções, cabendo a responsabilidade pelo
recolhimento destas ao órgão ou entidade adquirente do bem ou tomador dos serviços.
O disposto neste item não se aplica às faturas de cartão de crédito.
8. AGÊNCIAS DE VIAGENS E TURISMO
Nos pagamentos referentes a aquisições de passagens aéreas e rodoviárias, a despesas de hospedagem, aluguel de
veículos e prestação de serviços afins, efetuados por intermédio de agências de viagens, a retenção será feita sobre o
total a pagar a cada empresa prestadora do serviço e, quando for o caso, à Infraero.
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 3/12'),
('coad-orientacao', 4, '05/08/2026, 09:18 Untitled Document
A agência de viagens apresentará, à unidade pagadora, documento de cobrança, do qual constarão:
a) o nome e o número de inscrição no CNPJ – Cadastro Nacional de Pessoa Jurídica, da empresa prestadora do serviço;
b) no caso de venda de passagens:
• o número e o valor do bilhete, excluídos a taxa de embarque, o pedágio e o seguro;
• o número de inscrição no CNPJ da Infraero e, em destaque, o valor da taxa de embarque;
c) o nome do usuário do serviço.
A indicação do número de inscrição no CNPJ da empresa prestadora do serviço e, quando for o caso, da Infraero poderá
ser efetuada em documento distinto do documento de cobrança.
Quando forem emitidos diversos bilhetes de uma mesma empresa de transporte, os dados referidos nas letras “a” a “c”
poderão ser indicados apenas na linha correspondente ao primeiro bilhete listado.
O valor do imposto e das contribuições retido será deduzido pelas empresas prestadoras do serviço e, quando for o caso,
pela Infraero, na proporção de suas receitas, devendo o comprovante anual de retenção previsto no item 24 ser fornecido
em nome de cada um destes beneficiários.
Como forma de comprovação da retenção, o órgão ou entidade que efetuar o pagamento deverá fornecer à agência de
viagem, para os fins de prestação de contas às empresas prestadoras do serviço, cópia do Darf ou quaisquer outros
documentos que comprovem que as retenções foram efetuadas em nome das empresas prestadoras do serviço.
9. ALUGUEL DE IMÓVEIS
Nos pagamentos de aluguel de imóvel de propriedade de pessoa jurídica, a retenção do imposto e das contribuições será
feita mediante aplicação do percentual sobre o total a ser pago.
9.1. PAGAMENTO FEITO ATRAVÉS DE ADMINISTRADORAS DE IMÓVEIS
Se o pagamento for efetuado por intermédio de administradora de imóveis, esta deverá fornecer à unidade pagadora o
nome da pessoa jurídica beneficiária e o respectivo número de inscrição no CNPJ.
9.2. PAGAMENTO À ENTIDADE ABERTA DE PREVIDÊNCIA COMPLEMENTAR
Caso o pagamento seja efetuado à entidade aberta de previdência complementar sem fins lucrativos, não haverá
retenção em relação ao Imposto de Renda, cabendo, entretanto, a retenção e o recolhimento, em códigos distintos, da
CSLL, da Cofins e da contribuição para o PIS/Pasep, utilizando-se, respectivamente, os códigos 6228, 6243 e 6230.
10. SEGUROS
Nos pagamentos de seguros, ainda que por intermédio de corretora, a retenção será feita sobre o valor do prêmio que
estiver sendo pago à seguradora, não podendo ser deduzida qualquer parcela correspondente à corretagem.
O direito à dedução do imposto e das contribuições retidos é da companhia seguradora, em nome da qual será emitido o
comprovante de retenção.
10.1. SEGURO OBRIGATÓRIO
A retenção do imposto e das contribuições, nos casos de pagamentos de seguro obrigatório de danos pessoais causados
por veículos automotores, somente será cabível quando relativos a veículos coletivos.
A base de cálculo, nesse caso, corresponderá a 50% do valor total do prêmio recolhido.
11. CONTAS DE TELEFONE
Nos pagamentos de contas telefônicas a retenção será efetuada sobre o total a ser pago, devendo o valor retido ser
deduzido pela companhia emissora da fatura, em nome da qual será emitido o comprovante de retenção.
11.1. AQUISIÇÃO DO DIREITO DE USO DO TELEFONE
No caso de aquisição do direito de uso ou de pagamento de aluguel de linhas telefônicas, a retenção será efetuada sobre
o valor pago relativamente à aquisição do direito de uso ou ao aluguel de linhas telefônicas.
12. PROPAGANDA E PUBLICIDADE
Nos pagamentos de serviços de propaganda e publicidade, realizados por intermédio de agência de propaganda, a
retenção será efetuada em relação a esta e a cada uma das demais pessoas jurídicas prestadoras do serviço, sobre o
valor das respectivas notas fiscais.
Nesse caso, a agência de propaganda deverá apresentar, à unidade pagadora, documento de cobrança, contendo, no
mínimo:
a) o nome e o número de inscrição no CNPJ, de cada empresa emitente de nota fiscal, listada no documento de
cobrança;
b) o número da respectiva nota fiscal e o seu valor.
Se uma mesma empresa emitir diversas notas fiscais para cobrança dos serviços, os dados previstos na letra “a”
poderão constar apenas na linha correspondente à primeira nota fiscal listada.
12.1. COMPENSAÇÃO DO VALOR RETIDO
O valor do imposto e das contribuições retidos poderá ser compensado pela empresa emitente da nota fiscal, na
proporção de suas receitas, devendo o comprovante anual de retenção previsto no item 24, ser fornecido em nome de
cada empresa beneficiária.
12.2. DISPENSA DE RETENÇÃO DO IR/FONTE
A retenção na forma examinada neste item dispensa a retenção do IR/Fonte de 1,5% sobre as importâncias pagas ou
creditadas por pessoas jurídicas a outras pessoas jurídicas, a título de serviços de propaganda e publicidade, prevista no
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 4/12'),
('coad-orientacao', 5, '05/08/2026, 09:18 Untitled Document
inciso II do artigo 53 da Lei 7.450/85.
13. CONSÓRCIO
Quando se tratar de pagamento a consórcio constituído para o fornecimento de bens e serviços, inclusive a execução de
obras e serviços de engenharia, a retenção deverá ser efetuada em nome de cada empresa participante do consórcio,
tendo por base o valor constante da correspondente nota fiscal de emissão de cada uma das pessoas jurídicas
consorciadas.
A empresa administradora deverá apresentar à unidade pagadora os documentos de cobrança, acompanhados das
respectivas notas fiscais, correspondentes aos valores dos fornecimentos de bens ou serviços de cada empresa
participante do consórcio.
13.1. CONSÓRCIO FORMADO POR EMPRESAS NACIONAIS E ESTRANGEIRAS
No caso de pagamentos a consórcios formados entre empresas nacionais e estrangeiras, aplica-se a retenção com base
na tabela constante do item 2 aos pagamentos efetuados às empresas nacionais, e a retenção do Imposto de Renda na
fonte, examinada no item 14, às consorciadas estrangeiras.
14. PAGAMENTOS A EMPRESA SEDIADA OU DOMICILIADA NO EXTERIOR
A retenção examinada nesta Orientação não será efetuada quando a beneficiária do pagamento for pessoa jurídica
sediada ou domiciliada no exterior.
Sobre esse pagamento incidirá o IR/Fonte, a ser retido pelo órgão pagador, calculado conforme as alíquotas vigentes à
época do fato gerador.
Considera-se ocorrido o fato gerador na data em que os rendimentos forem pagos, creditados, entregues, empregados
ou remetidos para o exterior.
Se o órgão efetuar o pagamento aos beneficiários, por intermédio de agência de propaganda ou publicidade, a esta cabe
a obrigação de reter e recolher o IR/Fonte.
15. PAGAMENTO DE REFEIÇÃO-CONVÊNIO, VALE-TRANSPORTE E VALE-COMBUSTÍVEL
Na aquisição de Refeição-Convênio (tíquete-alimentação e tíquete-refeição), Vale-Transporte e Vale-Combustível, caso
os pagamentos sejam efetuados a intermediárias, vinculadas ou não à prestadora do serviço ou à fornecedora de
combustível, a base de cálculo corresponde ao valor da corretagem ou comissão cobrada pela pessoa jurídica
prestadora do serviço.
O valor da corretagem ou comissão deverá ser destacado na nota fiscal de serviços.
Se não houver cobrança desses encargos, a empresa deverá fazer constar da nota fiscal a expressão: “Valor da
corretagem ou comissão: zero”.
Caso não seja feito destaque do valor da corretagem ou comissão na nota fiscal ou não conste a referida expressão, a
retenção será efetuada sobre o total a pagar.
15.1. TÍQUETES/VALES DE USO ESPECÍFICO
Quando os tíquetes ou os vales forem de uso específico, tornando possível, no momento do pagamento, a identificação
da prestadora responsável pela execução do serviço ou da fornecedora do combustível, a retenção será feita em nome
da prestadora ou fornecedora do combustível, sobre o valor correspondente ao serviço ou ao fornecimento do
combustível, conforme o caso, sem prejuízo da retenção sobre o valor da corretagem ou comissão, se devida.
15.2. VENDAS EFETUADAS PELA PRESTADORA DO SERVIÇO OU FORNECEDORA DO COMBUSTÍVEL
Se as vendas de Refeição-Convênio (tíquete-alimentação e tíquete-refeição), Vale-Transporte e Vale-Combustível forem
efetuadas diretamente pela prestadora do serviço ou pela fornecedora do combustível, a retenção será efetuada pelo
valor total da compra de tíquetes ou vales, no momento do pagamento.
16. PRODUTOS FARMACÊUTICOS, DE PERFUMARIA, DE TOUCADOR E DE HIGIENE PESSOAL
Nos pagamentos efetuados às pessoas jurídicas que procedam à industrialização ou à importação de produtos
farmacêuticos, de perfumaria, de toucador ou de higiene pessoal, será devida a retenção do IRPJ, da CSLL, do
PIS/Pasep e da Cofins, utilizando-se o código 6147.
16.1. PAGAMENTOS A DISTRIBUIDORES E COMERCIANTES VAREJISTAS
No que se refere a pagamentos realizados aos distribuidores e aos comerciantes varejistas dos medicamentos e
produtos de perfumaria, de toucador e de higiene pessoal, de que trata o artigo 1º da Lei 10.147/2000, alterado pela Lei
10.548/2002, será efetuada a retenção do Imposto de Renda e da CSLL, utilizando-se o código 8767, ficando dispensada
a retenção da contribuição para o PIS/Pasep e da Cofins.
17. MÁQUINAS, VEÍCULOS, AUTOPEÇAS, PNEUS E CÂMARAS DE AR
Nos pagamentos efetuados às pessoas jurídicas que procedam à industrialização ou à importação, inclusive à empresa
comercial atacadista equiparada a industrial, de máquinas, autopeças, pneus e câmaras de ar, veículos e tratores,
previstos nos artigos 1º, 3º e 5º da Lei 10.485, de 3-7-2002 (Informativo 27/2002), será devida a retenção do IRPJ, da
CSLL, da Cofins e do PIS/Pasep, utilizando-se o código 6147.
A retenção ainda será devida nos pagamentos relativos à aquisição de máquinas, autopeças, veículos e tratores não
especificados anteriormente, efetuados ao importador, fabricante, atacadistas e varejistas.
17.1. PAGAMENTOS A COMERCIANTES ATACADISTAS E VAREJISTAS
Tratando-se de pagamentos efetuados aos comerciantes atacadistas e varejistas, relativos aos produtos classificados
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 5/12'),
('coad-orientacao', 6, '05/08/2026, 09:18 Untitled Document
nas posições 40.11 (pneus novos de borracha) e 40.13 (câmaras de ar de borracha), da Tipi – Tabela de Incidência do
IPI, será efetuada a retenção e o recolhimento do Imposto de Renda e da CSLL, utilizando-se o código 8767, ficando
dispensada a retenção da contribuição para o PIS/Pasep e da Cofins.
18. ÁGUA, REFRIGERANTE E CERVEJA
Será devida a retenção do IRPJ, da CSLL, da Cofins e do PIS/ Pasep, utilizando-se o código 6147, nos pagamentos
efetuados às pessoas jurídicas que procedam à industrialização ou à importação de água, refrigerante e cervejas.
18.1. PAGAMENTOS A COMERCIANTES ATACADISTAS E VAREJISTAS
Em relação aos pagamentos aos comerciantes atacadistas e varejistas, relativos à aquisição de água, refrigerante e
cerveja sem álcool, classificados nos códigos 22.01 e 22.02 da TIPI, será efetuada a retenção e o recolhimento do
Imposto de Renda e da CSLL, utilizando-se o código 8767, ficando dispensada a retenção da contribuição para o
PIS/Pasep e da Cofins.
19. BENS IMÓVEIS
Na aquisição de bens imóveis serão observadas as seguintes regras:
a) quando o vendedor for pessoa jurídica que exerce a atividade de compra e venda de imóveis, ou quando se tratar de
imóveis adquiridos de entidades abertas de previdência complementar sem fins lucrativos cabe a retenção do IRPJ, da
CSLL, da Cofins e do PIS/Pasep, sobre o total a ser pago;
b) se o imóvel adquirido pertencer ao Ativo Não Circulante, exceto Realizável a Longo Prazo, da empresa vendedora
cabe a retenção tão somente do Imposto de Renda e da CSLL.
20. COOPERATIVAS
Nos pagamentos efetuados às sociedades cooperativas, pelo fornecimento de bens ou serviços, serão retidos sobre o
valor total do documento fiscal os valores correspondentes à Cofins e ao PIS/Pasep, de acordo com o item 4.
O disposto não se aplica às sociedades cooperativas de consumo que tenham por objeto a compra e o fornecimento de
bens aos consumidores, que estão sujeitas à retenção de acordo com a tabela constante do item 2.
20.1. COOPERATIVAS DE PRODUÇÃO
Não serão retidos os valores correspondentes ao PIS/Pasep, à Cofins e à CSLL nos pagamentos efetuados à sociedade
cooperativa de produção, em relação aos atos decorrentes da comercialização ou industrialização de produtos de seus
associados.
Essa dispensa não alcança as operações de comercialização ou industrialização, pelas cooperativas agropecuárias e de
pesca, de produtos adquiridos de não associados, agricultores, pecuaristas ou pescadores, para completar lotes
destinados ao cumprimento de contratos ou para suprir capacidade ociosa de suas instalações industriais, as quais se
sujeitarão a retenção e recolhimento do Imposto de Renda e das contribuições, no percentual total de 5,85%.
20.1.1. Segregação dos Valores
Para efeito da retenção, as cooperativas de produção deverão segregar, em seus documentos fiscais, as importâncias
relativas aos atos de comercialização ou industrialização de produtos de seus associados, das importâncias
correspondentes às operações com não associados.
Caso o documento fiscal seja emitido sem a mencionada segregação de valores, a retenção do Imposto de Renda e das
contribuições se dará sobre o total do documento fiscal, no percentual total de 5,85%.
20.2. COOPERATIVAS DE TRABALHO
Nos pagamentos efetuados às cooperativas de trabalho e às associações de profissionais ou assemelhadas será retido,
além da CSLL, da Cofins e do PIS/Pasep, o Imposto de Renda na fonte à alíquota de 1,5% sobre as importâncias
relativas aos serviços pessoais prestados por seus associados, utilizando-se o código de arrecadação 3280 – Serviços
Pessoais Prestados por Associados de Cooperativas de Trabalho.
Se o faturamento dessas entidades envolver parcela de serviços fornecidos por terceiros não cooperados ou não
associados, contratados ou conveniados, para cumprimento de contratos com os órgãos e entidades da administração
pública federal, será aplicada, a tal parcela, a retenção do Imposto de Renda e das contribuições no percentual total
previsto na Tabela de Retenção constante do item 2, de:
a) 5,85%, mediante o código de arrecadação 6147, no caso de serviços prestados com emprego de materiais; ou
b) 9,45%, mediante o código de arrecadação 6190, para os demais serviços.
20.2.1. Segregação dos Valores
Para efeito das retenções, as cooperativas de trabalho e as associações de profissionais ou assemelhadas deverão
segregar, em seus documentos fiscais, as importâncias relativas aos serviços pessoais prestados por seus associados
das importâncias que corresponderem aos demais serviços fornecidos diretamente pelas cooperativas (atividade
específica), bem assim, emitir fatura separada relativa aos serviços prestados por terceiros não cooperados, contratados
ou conveniados, para atendimento de demandas contratuais.
20.3. COOPERATIVAS E ASSOCIAÇÕES MÉDICAS QUE SUBCONTRATAM OS SERVIÇOS
Nos pagamentos efetuados às cooperativas ou associações médicas, as quais, para atender aos beneficiários dos seus
planos de saúde, subcontratam ou mantêm convênios para a prestação de serviços de terceiros não cooperados, tais
como: profissionais médicos e de enfermagem (pessoas físicas); hospitais, clínicas, casas de saúde, prontos-socorros,
ambulatórios e laboratórios, etc. (pessoas jurídicas), por conta de internações, diárias hospitalares, medicamentos,
fornecimento de exames laboratoriais e complementares de diagnose e terapia, etc., serão apresentadas duas faturas,
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 6/12'),
('coad-orientacao', 7, '05/08/2026, 09:18 Untitled Document
observando-se o seguinte:
a) no caso das associações médicas:
I – uma fatura, segregando as importâncias recebidas por conta de serviços pessoais prestados por pessoas físicas
associadas da cooperativa (serviços médicos e de enfermagem), das importâncias recebidas pelos demais bens ou
serviços (taxa de administração, etc.), cabendo a retenção:
• de 1,5% de Imposto de Renda sobre a quantia relativa aos serviços pessoais prestados por seus associados, sob o
código de arrecadação 3280 – Serviços Pessoais Prestados por Associados de Cooperativas de Trabalho; e
• da Cofins e do PIS/Pasep, sobre o valor total do documento fiscal, no percentual total de 3,65%, de acordo com o
disposto no item 4;
II – outra fatura, referente aos serviços de terceiros não cooperados (pessoas físicas ou jurídicas), a qual deverá
segregar as importâncias referentes aos serviços prestados, da seguinte forma:
• serviços médicos em geral prestados por pessoas físicas (médicos, dentistas, anestesistas, enfermeiros, etc.) e
serviços médicos em geral, não compreendidos em serviços hospitalares, prestados por pessoas jurídicas, por conta de
consultas médicas, exames laboratoriais, radiológicos, fisioterapias e assemelhados, cabendo a retenção, no percentual
total de 9,45%, sob o código de arrecadação 6190 (demais serviços);
• serviços hospitalares, conforme definição no item 21, cabendo a retenção e recolhimento, no percentual total de 5,85%,
sob o código de arrecadação 6147.
b) no caso das cooperativas médicas:
I – uma fatura, segregando as importâncias recebidas por conta de serviços pessoais prestados por pessoas físicas
associadas da cooperativa (serviços médicos e de enfermagem), das importâncias recebidas pelos demais bens ou
serviços (taxa de administração, etc.), cabendo a retenção:
• de 1,5% de Imposto de Renda sobre a quantia relativa aos serviços pessoais prestados por seus associados, sob o
código de arrecadação 3280 – Serviços Pessoais Prestados por Associados de Cooperativas de Trabalho; e
• da Cofins e do PIS/Pasep, sobre o valor total do documento fiscal, no percentual total de 3,65%, de acordo com o
disposto no item 4;
II – outra fatura, referente aos serviços de terceiros não cooperados (pessoas físicas ou jurídicas), a qual deverá
segregar as importâncias referentes aos serviços prestados, da seguinte forma:
• serviços médicos em geral prestados por pessoas físicas (médicos, dentistas, anestesistas, enfermeiros, etc.), e
serviços médicos em geral, não compreendidos em serviços hospitalares, prestados por pessoas jurídicas, por conta de
consultas médicas, exames laboratoriais, radiológicos, fisioterapias e assemelhados, cabendo a retenção, no percentual
total de 9,45%, sob o código de arrecadação 6190 (demais serviços);
• serviços hospitalares, conforme definição no item 21, cabendo a retenção e recolhimento, no percentual total de 5,85%,
sob o código de arrecadação 6147.
A inobservância quanto à segregação das importâncias referidas acarretará a retenção do Imposto de Renda e das
contribuições sobre o total do documento fiscal, no percentual de 9,45%, sob o código de arrecadação 6190 (demais
serviços).
20.4. COOPERATIVAS DE TRABALHO MÉDICO, ADMINISTRADORAS DE PLANO DE SAÚDE E SEGURO SAÚDE
Nos pagamentos efetuados às cooperativas de trabalho médico, administradoras de plano de saúde e seguro saúde, a
retenção a ser efetuada é a constante da rubrica “demais serviços”, no percentual de:
a) 9,45%, sob o código de arrecadação 6190, para os planos de saúde; e
b) 7,05%, sob o código 6188, para o seguro saúde.
Na hipótese de terceirização de serviços médicos (locação de mão de obra), por intermédio de cooperativas de trabalho
ou associações médicas, para o fornecimento de mão de obra nas dependências do tomador dos serviços, a retenção
será efetuada observando-se o seguinte:
a) no caso das associações médicas, de acordo com o item I da letra “a” do subitem 20.3, quando se tratar de
associados, e, de acordo com o item II da letra “a” do mesmo subitem, para os não associados;
b) no caso das cooperativas médicas, de acordo com o item I da letra “b” do subitem 20.3, quando se tratar de
associados, e, de acordo com o item II da letra “b” do mesmo subitem, para os não associados.
As cooperativas de trabalho ou associações médicas deverão, na hipótese prevista no parágrafo anterior, segregar, em
duas faturas distintas, as importâncias relativas aos serviços pessoais prestados por seus associados das importâncias
que corresponderem aos serviços prestados por não associados da cooperativa.
A inobservância quanto à segregação das importâncias acarretará a retenção do Imposto de Renda e das contribuições
sobre o total do documento fiscal, no percentual de 9,45%, sob o código de arrecadação 6190, da Tabela de Retenção
constante do item 2.
20.5. ASSOCIAÇÕES DE MÉDICOS
Nos pagamentos a associações de médicos que atuem na intermediação da prestação de serviços médicos prestados
por profissionais médicos ou pessoas jurídicas, os quais realizam os procedimentos médicos, em nome próprio, em suas
respectivas instalações, deverá ser observado o seguinte:
a) se o associado for pessoa jurídica, a retenção será efetuada sobre o total pago a cada pessoa jurídica prestadora dos
serviços, observado os seguintes percentuais:
• 5,85%, mediante o código de arrecadação 6147, no caso de serviços hospitalares, conforme definição no item 21; ou
• 9,45%, mediante o código de arrecadação 6190, para os demais serviços;
b) se o associado for pessoa física, caberá a retenção prevista no artigo 628 do Regulamento do Imposto de Renda,
aprovado Decreto 3.000/99 (rendimentos do trabalho não assalariado), sobre o total pago a cada pessoa física.
As associações de médicos deverão apresentar ao órgão ou entidade pagadora documento de cobrança contendo as
seguintes informações:
a) o nome e o número de inscrição no CPF – Cadastro de Pessoa Física ou no CNPJ de cada uma das pessoas físicas
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 7/12'),
('coad-orientacao', 8, '05/08/2026, 09:18 Untitled Document
ou jurídicas prestadora do serviço;
b) o valor a ser pago a cada uma das pessoas físicas ou jurídicas prestadoras do serviço.
A retenção prevista neste item aplica-se às demais associações de profissionais que atuam nos moldes das associações
médicas.
21. DEFINIÇÃO DE SERVIÇOS HOSPITALARES
São considerados serviços hospitalares, para os fins da retenção examinada nesta Orientação, aqueles prestados por
estabelecimentos assistenciais de saúde que dispõem de estrutura material e de pessoal destinada a atender a
internação de pacientes, garantir atendimento básico de diagnóstico e tratamento, com equipe clínica organizada e com
prova de admissão e assistência permanente prestada por médicos, que possuam serviços de enfermagem e
atendimento terapêutico direto ao paciente, durante 24 horas, com disponibilidade de serviços de laboratório e radiologia,
serviços de cirurgia e/ou parto, bem como registros médicos organizados para a rápida observação e acompanhamento
dos casos.
São também considerados serviços hospitalares aqueles efetuados pelas pessoas jurídicas:
– prestadoras de serviços pré-hospitalares, na área de urgência, realizados por meio de UTI móvel, instaladas em
ambulâncias de suporte avançado (Tipo “D”) ou em aeronave de suporte médico (Tipo “E”); e
– prestadoras de serviços de emergências médicas, realizados por meio de UTI móvel, instaladas em ambulâncias
classificadas nos Tipos “A”, “B”, “C” e “F”, que possuam médicos e equipamentos que possibilitem oferecer ao paciente
suporte avançado de vida.
22. HIPÓTESES EM QUE NÃO HAVERÁ RETENÇÃO
Não serão retidos o IRPJ, a CSLL, a Cofins e o PIS/Pasep, nos pagamentos efetuados a:
a) templos de qualquer culto;
b) partidos políticos;
c) instituições de educação e de assistência social, sem fins lucrativos (Lei 9.532/97, artigo 12);
d) instituições de caráter filantrópico, recreativo, cultural, científico e associações civis sem fins lucrativos (Lei 9.532/97,
artigo 15);
e) sindicatos, federações e confederações de empregados;
f) serviços sociais autônomos, criados ou autorizados por lei;
g) conselhos de fiscalização de profissões regulamentadas;
h) fundações de direito privado e fundações públicas instituídas ou mantidas pelo Poder Público;
i) condomínios edilícios;
j) Organização das Cooperativas Brasileiras (OCB) e as Organizações Estaduais de Cooperativas (Lei 5.764/71, artigo
105 e seu § 1º);
l) pessoas jurídicas optantes pelo Simples Nacional, em relação às suas receitas próprias;
m) pessoas jurídicas exclusivamente distribuidoras de jornais e revistas;
n) Itaipu binacional;
o) empresas estrangeiras de transporte;
p) órgãos da administração direta, autarquias e fundações do Governo Federal, Estadual ou Municipal;
q) título de suprimento de fundos a servidor (Decreto 93.872/86, artigos 45 a 47, com a redação dada pelo Decreto
3.639/2000 e pelo Decreto 5.026/2004);
r) título de adiantamentos efetuados a empregados para despesas miúdas de pronto pagamento, até o limite de 5
salários-mínimos, no caso das empresas públicas, das sociedades de economia mista e das demais entidades em que a
União, direta ou indiretamente detenha a maioria do capital social sujeito a voto, e que recebam recursos do Tesouro
Nacional e estejam obrigadas a registrar sua execução orçamentária e financeira no Siafi;
s) título de prestações relativas à aquisição de bem financiado por instituição financeira;
t) entidades fechadas de previdência complementar, no que se refere à receita decorrente de aluguéis e da venda de
bens imóveis destinados ao pagamento de benefícios de aposentadoria, pensão, pecúlio e resgates;
u) título de aquisição de gasolina, gás natural, óleo diesel, gás liquefeito de petróleo, querosene de aviação e demais
derivados de petróleo e gás natural efetuados pelas empresas públicas, sociedades de economia mista, e demais
entidades em que a União, direta ou indiretamente, detenha a maioria do capital social com direito a voto, e que dela
recebam recursos do Tesouro Nacional e estejam obrigadas a registrar sua execução orçamentária e financeira na
modalidade total no Siafi.
22.1. CASOS ESPECIAIS DE DISPENSA DE RETENÇÃO
Não será efetuada a retenção da contribuição para o PIS/Pasep e da Cofins, sendo cabível a retenção do Imposto de
Renda e da CSLL:
a) utilizando-se o código de arrecadação 8767, nos pagamentos efetuados:
I – a título de transporte internacional de cargas por empresas nacionais;
II – aos estaleiros navais brasileiros nas atividades de construção, conservação, modernização, conversão e reparo de
embarcações pré-registradas ou registradas no Registro Especial Brasileiro (REB);
III – pela aquisição no mercado interno de livros, conforme a definição prevista no subitem 22.1.1;
IV – pela aquisição de produtos ou serviços amparados com isenção, não incidência ou alíquota zero da Cofins e do PIS/
Pasep, devendo esta condição ser informada no documento fiscal, conforme consta no item 4;
b) utilizando-se o código de arrecadação 8850, nos pagamentos efetuados a título de transporte internacional de
passageiros efetuado por empresas nacionais;
c) nas aquisições de veículos e embarcações novos destinadas ao transporte escolar para a educação básica das redes
estadual e municipal;
d) nas aquisições, até 31-12-2014, de:
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 8/12'),
('coad-orientacao', 9, '05/08/2026, 09:18 Untitled Document
– unidades de processamento digital classificadas no código 8471.50.10 da Tipi – Tabela de Incidência do IPI;
– máquinas automáticas para processamento de dados, digitais, portáteis, de peso inferior a 3,5Kg, com tela (écran) de
área superior a 140 cm², classificadas nos códigos 8471.30.12, 8471.30.19 ou 8471.30.90 da Tipi;
– máquinas automáticas de processamento de dados, apresentadas sob a forma de sistemas, do código 8471.49 da Tipi,
contendo exclusivamente 1 unidade de processamento digital, 1 unidade de saída por vídeo (monitor), 1 teclado (unidade
de entrada), 1 mouse (unidade de entrada), classificados, respectivamente, nos códigos 8471.50.10, 8471.60.7,
8471.60.52 e 8471.60.53 da Tipi;
– teclado (unidade de entrada) e de mouse (unidade de entrada) classificados, respectivamente, nos códigos 8471.60.52
e 8471.60.53 da Tipi, quando acompanharem a unidade de processamento digital classificada no código 8471.50.10 da
Tipi.
22.1.1. Definição de Livro
Para efeito da dispensa de retenção prevista no inciso III, letra “a” do subitem 22.1, considera-se livro a publicação de
textos escritos em fichas ou folhas, não periódica, grampeada, colada ou costurada, em volume cartonado, encadernado
ou em brochura, em capas avulsas, em qualquer formato e acabamento.
São equiparados a livro:
a) fascículos, publicações de qualquer natureza que representem parte de livro;
b) materiais avulsos relacionados com o livro, impressos em papel ou em material similar;
c) roteiros de leitura para controle e estudo de literatura ou de obras didáticas;
d) álbuns para colorir, pintar, recortar ou armar;
e) atlas geográficos, históricos, anatômicos, mapas e cartogramas;
f) textos derivados de livro ou originais, produzidos por editores, mediante contrato de edição celebrado com o autor, com
a utilização de qualquer suporte;
g) livros em meio digital, magnético e ótico, para uso exclusivo de pessoas com deficiência visual;
h) livros impressos no Sistema Braille.
22.2. APRESENTAÇÃO DE DECLARAÇÃO DE DISPENSA DE RETENÇÃO
Para efeito da dispensa de retenção prevista no item 22, as instituições de educação e de assistência social, as
instituições de caráter filantrópico, recreativo, cultural, científico e associações civis sem fins lucrativos, e as pessoas
jurídicas optantes pelo Simples Nacional deverão apresentar declaração, em duas vias, assinadas pelo seu
representante legal.
O órgão ou entidade responsável pela retenção arquivará a 1ª via da declaração, em ordem alfabética, que ficará à
disposição da Secretaria da Receita Federal do Brasil, devendo a 2ª via ser devolvida ao interessado, como recibo.
22.2.1. Modelos das Declarações
• Declaração de Instituição de Educação ou de Assistência Social
Ilmo. Sr.
(autoridade a quem se dirige)
(Nome da entidade), com sede (endereço completo), inscrita no CNPJ sob o nº....................... DECLARA à (nome da
entidade pagadora), para fins de não incidência na fonte do IRPJ, da CSLL, da Cofins e da Contribuição para o
PIS/Pasep, a que se refere o art. 64 da Lei nº 9.430, de 27 de dezembro de 1996, que é instituição de educação ou de
assistência social a que se refere o art. 12 da Lei nº 9.532, de 10 de dezembro de 1997.
Para esse efeito, a declarante informa que:
I – preenche os seguintes requisitos, cumulativamente:
a) é reconhecida como de utilidade pública federal e estadual ou do Distrito Federal ou municipal;
b) é portadora do Certificado de Entidade de Fins Filantrópicos, fornecido pelo Conselho Nacional de Serviço Social;
c) promove assistência social beneficente, inclusive educacional ou de saúde, a menores, idosos, excepcionais ou
pessoas carentes;
d) é entidade sem fins lucrativos;
e) apresenta, anualmente, ao órgão do Instituto Nacional do Seguro Social – INSS jurisdicionante de sua sede,
relatório circunstanciado de suas atividades no exercício anterior;
f) presta serviços para os quais foi instituída e os coloca à disposição da população em geral, em caráter
complementar às atividades do Estado;
g) não percebem seus diretores, dirigentes, conselheiros, sócios, instituidores ou benfeitores, remuneração, por
qualquer forma, por serviços prestados e não usufruem eles vantagens ou benefícios a qualquer título;
h) aplica integralmente seus recursos na manutenção e desenvolvimento de seus objetivos sociais;
i) mantém escrituração completa de suas receitas e despesas em livros revestidos das formalidades que assegurem a
respectiva exatidão;
j) conserva em boa ordem, pelo prazo de cinco anos, contado da data da emissão, os documentos que comprovam a
origem de suas receitas e a efetivação de suas despesas, bem assim a realização de quaisquer outros atos ou
operações que venham a modificar sua situação patrimonial;
l) apresenta anualmente Declaração de Informações Econômico-Fiscais da Pessoa Jurídica (DIPJ), em conformidade
com o disposto em ato da Secretaria da Receita Federal do Brasil;
m) recolhe os tributos retidos sobre os rendimentos pagos ou creditados e a contribuição para a seguridade social
relativa aos empregados, bem assim cumpre as obrigações acessórias decorrentes;
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 9/12'),
('coad-orientacao', 10, '05/08/2026, 09:18 Untitled Document
n) cumpre os demais requisitos estabelecidos em lei específica, relacionados com o funcionamento de suas atividades;
II – o signatário é representante legal desta entidade, assumindo o compromisso de informar à Secretaria da Receita
Federal do Brasil e à unidade pagadora, imediatamente, eventual desenquadramento da presente situação e está
ciente de que a falsidade na prestação destas informações, sem prejuízo do disposto no art. 32 da Lei nº 9.430, de 27
de dezembro de 1996, o sujeitará, juntamente com as demais pessoas que para ela concorrem, às penalidades
previstas na legislação criminal e tributária, relativas à falsidade ideológica (art. 299 do Código Penal) e ao crime contra
a ordem tributária (art. 1º da Lei nº 8.137, de 27 de dezembro de 1990).
Local e data..................................................
Assinatura do Responsável
• Declaração de Entidades Sem Fins Lucrativos
Ilmo. Sr.
(autoridade a quem se dirige)
(Nome da entidade), com sede (endereço completo), inscrita no CNPJ sob o nº.................... DECLARA à (nome da
entidade pagadora), para fins de não incidência na fonte do IRPJ, da CSLL, da Cofins, e da contribuição para o
PIS/Pasep, a que se refere o art. 64 da Lei nº 9.430, de 27 de dezembro de 1996, que é entidade sem fins lucrativos de
caráter ................................................., a que se refere o art. 15 da Lei nº 9.532, de 10 de dezembro de 1997.
Para esse efeito, a declarante informa que:
I – preenche os seguintes requisitos, cumulativamente:
a) é entidade sem fins lucrativos;
b) presta serviços para os quais foi instituída e os coloca à disposição do grupo de pessoas a que se destinam;
c) não remunera, por qualquer forma, seus dirigentes por serviços prestados;
d) aplica integralmente seus recursos na manutenção e desenvolvimento de seus objetivos sociais;
e) mantém escrituração completa de suas receitas e despesas em livros revestidos das formalidades que assegurem a
respectiva exatidão;
f) conserva em boa ordem, pelo prazo de cinco anos, contado da data da emissão, os documentos que comprovam a
origem de suas receitas e a efetivação de suas despesas, bem assim a realização de quaisquer outros atos ou
operações que venham a modificar sua situação patrimonial;
g) apresenta anualmente Declaração de Informações Econômico-Fiscais da Pessoa Jurídica (DIPJ), em conformidade
com o disposto em ato da Secretaria da Receita Federal do Brasil;
II – o signatário é representante legal desta entidade, assumindo o compromisso de informar à Secretaria da Receita
Federal do Brasil e à unidade pagadora, imediatamente, eventual desenquadramento da presente situação e está
ciente de que a falsidade na prestação destas informações, sem prejuízo do disposto no art. 32 da Lei nº 9.430, de
1996, o sujeitará, juntamente com as demais pessoas que para ela concorrem, às penalidades previstas na legislação
criminal e tributária, relativas à falsidade ideológica (art. 299 do Código Penal) e ao crime contra a ordem tributária (art.
1º da Lei nº 8.137, de 27 de dezembro de 1990).
Local e data................................................
Assinatura do Responsável
• Declaração de Pessoas Jurídicas Optantes pelo Simples Nacional
Ilmo. Sr.
(autoridade a quem se dirige)
(Nome da empresa), com sede (endereço completo), inscrita no CNPJ sob o nº........... DECLARA à (nome da entidade
pagadora), para fins de não incidência na fonte do IRPJ, da CSLL, da Cofins, e da contribuição para o PIS/Pasep, a
que se refere o art. 64 da Lei nº 9.430, de 27 de dezembro de 1996, que é regularmente inscrita no Regime Especial
Unificado de Arrecadação de Tributos e Contribuições devidos pelas Microempresas e Empresas de Pequeno Porte –
Simples Nacional, de que trata o art. 12 da Lei Complementar nº 123, de 14 de dezembro de 2006.
Para esse efeito, a declarante informa que:
I – preenche os seguintes requisitos:
a) conserva em boa ordem, pelo prazo de cinco anos, contado da data da emissão, os documentos que comprovam a
origem de suas receitas e a efetivação de suas despesas, bem assim a realização de quaisquer outros atos ou
operações que venham a modificar sua situação patrimonial;
b) cumpre as obrigações acessórias a que está sujeita, em conformidade com a legislação pertinente;
II – o signatário é representante legal desta empresa, assumindo o compromisso de informar à Secretaria da Receita
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 10/12'),
('coad-orientacao', 11, '05/08/2026, 09:18 Untitled Document
Federal do Brasil e à entidade pagadora, imediatamente, eventual desenquadramento da presente situação e está
ciente de que a falsidade na prestação destas informações, sem prejuízo do disposto no art. 32 da Lei nº 9.430, de
1996, o sujeitará, juntamente com as demais pessoas que para ela concorrem, às penalidades previstas na legislação
criminal e tributária, relativas à falsidade ideológica (art. 299 do Código Penal) e ao crime contra a ordem tributária (art.
1º da Lei nº 8.137, de 27 de dezembro de 1990).
Local e data......................................................
Assinatura do Responsável
22.3. ALCANCE DA DISPENSA DE RETENÇÃO
A dispensa de retenção prevista no item 22 não isenta as entidades ali mencionadas do pagamento do Imposto de Renda
e das contribuições a que estão sujeitas, como contribuintes ou responsáveis, em decorrência da natureza das atividades
desenvolvidas, na forma da legislação tributária vigente.
23. PRAZO DE RECOLHIMENTO
Os valores retidos deverão ser recolhidos ao Tesouro Nacional, através de Darf, nos seguintes prazos:
a) pelos órgãos da administração federal direta, autarquias e fundações federais que efetuarem a retenção, até o 3º dia
útil da semana subsequente àquela em que tiver ocorrido o pagamento à pessoa jurídica fornecedora dos bens ou
prestadora do serviço;
b) pelas empresas públicas, sociedades de economia mista e demais entidades em que a União, direta ou indiretamente
detenha a maioria do capital social sujeito a voto, e que recebam recursos do Tesouro Nacional e estejam obrigadas a
registrar sua execução orçamentária e financeira no Siafi, de forma centralizada, pelo estabelecimento matriz da pessoa
jurídica, até o último dia útil da quinzena subsequente àquela quinzena em que tiver ocorrido o pagamento à pessoa
jurídica fornecedora dos bens ou prestadora do serviço.
Quando o pagamento referir-se a bens e serviços com percentuais diferenciados, os valores retidos correspondentes a
cada percentual serão recolhidos em Darf distintos.
23.1. INFRAÇÕES E PENALIDADES
As penalidades e demais acréscimos previstos na legislação do Imposto de Renda aplicam-se, subsidiariamente, à
CSLL, à Cofins e à contribuição para o PIS/Pasep, nas hipóteses de não retenção, falta de recolhimento, recolhimento
após o vencimento do prazo sem o acréscimo de multa moratória, de falta de declaração e nos de declaração inexata.
24. COMPROVANTE ANUAL DE RETENÇÃO
O órgão ou a entidade que efetuar a retenção deverá fornecer, à pessoa jurídica beneficiária do pagamento, até o último
dia útil do mês de fevereiro do ano subsequente, comprovante anual de retenção, conforme modelo constante do Anexo
V à Instrução Normativa 480 SRF/2004, informando, relativamente a cada mês em que houver sido efetuado o
pagamento:
a) os códigos de retenção;
b) os valores pagos; e
c) os valores retidos.
O referido comprovante também poderá ser disponibilizado em meio eletrônico.
24.1. FORMA ALTERNATIVA DE COMPROVAÇÃO DA RETENÇÃO
Como forma alternativa de comprovação da retenção, o órgão ou a entidade poderá fornecer ao beneficiário do
pagamento cópia do Darf, desde que este contenha a base de cálculo correspondente ao fornecimento dos bens ou da
prestação dos serviços.
25. SUSPENSÃO DA EXIGIBILIDADE DO CRÉDITO TRIBUTÁRIO
No caso de pessoa jurídica amparada pela suspensão da exigibilidade do crédito tributário ou por sentença judicial
transitada em julgado, determinando a suspensão do pagamento do IRPJ ou de qualquer das contribuições, o órgão ou a
entidade que efetuar o pagamento deverá calcular, individualmente, os valores do IRPJ e das contribuições considerados
devidos, aplicando as alíquotas correspondentes, e efetuar o recolhimento em Darf distintos para cada um deles,
utilizando os seguintes códigos:
IMPOSTO/CONTRIBUIÇÃO CÓDIGO DO DARF
IRPJ 6256
CSLL 6228
PIS/PASEP 6230
COFINS 6243
Se ocorrer qualquer das situações previstas anteriormente, o beneficiário do rendimento deverá apresentar à fonte
pagadora, a cada pagamento, a comprovação de que o direito a não retenção continua amparada por medida judicial.
A retenção em códigos distintos aplica-se, também, quando a pessoa jurídica beneficiária do pagamento gozar de
isenção do IRPJ ou de qualquer das contribuições.
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 11/12'),
('coad-orientacao', 12, '05/08/2026, 09:18 Untitled Document
26. DISPENSA DE DEMAIS RETENÇÕES
A sistemática de retenção do Imposto de Renda e contribuições, examinada nesta Orientação, dispensa, em relação aos
pagamentos efetuados, as demais retenções previstas na legislação do Imposto de Renda.
27. DIRF
Anualmente, até o último dia útil de fevereiro do ano subsequente, os órgãos ou as entidades que efetuarem a retenção
de que trata esta Orientação deverão apresentar, à unidade local da RFB, Declaração de Imposto de Renda Retido na
Fonte (Dirf), nela discriminando, mensalmente, o somatório dos valores pagos e o total retido, por contribuinte e por
código de recolhimento.
FUNDAMENTAÇÃO LEGAL: Lei 7.450, de 23-12-85 (Informativo 52/85 e Portal COAD); Lei 9.430, de 27-
12-96 – artigo 64 (Informativo 53/96); Lei 10.753, de 30-10-2003 – art. 2º (Informativo 45/2003); Lei 10.833,
de 29-12-2003 – artigos 34 a 36 (Informativo 53/2003); Lei 10.865, de 30-4-2004 – artigos 21 e 28
(Informativo 18/2004); Lei 11.196, de 21-11-2005 – artigos 30 e 74 (Informativo 47/2005); Lei 11.727, de 23-
6-2008 – artigos 5º, 19 e 26 (Fascículo 26/2008); Lei 12.249, de 11-6-2010 – artigo 17 (Fascículo 24/2010);
Instrução Normativa 480 SRF, de 15-12-2004 (Informativo 53/2004); Instrução Normativa 539 SRF, de 25-4-
2005 (Informativo 17/2005); Instrução Normativa 706 SRF, de 9-1-2007 (Fascículo 05/2007); Instrução
Normativa 765 RFB, de 2-8-2007 (Fascículo 32/2007); Instrução Normativa 791 SRF, de 10-12-2007
(Fascículo 50/2007); Instrução Normativa 900 RFB, de 30-12-2008 (Fascículo 01/2009); Instrução
Normativa 1.033 RFB, 4-5-2010 – art. 2º (Fascículo 20/2010).
https://www.coad.com.br/files/trib/html/pesquisa/ir/em31521.htm 12/12');
ALTER TABLE public.referencias_retencao_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY referencias_retencao_documentos_read ON public.referencias_retencao_documentos FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.referencias_retencao_documentos FROM anon, authenticated;
GRANT SELECT ON public.referencias_retencao_documentos TO authenticated;
GRANT ALL ON public.referencias_retencao_documentos TO service_role;
ALTER TABLE public.referencias_retencao_paginas ENABLE ROW LEVEL SECURITY;
CREATE POLICY referencias_retencao_paginas_read ON public.referencias_retencao_paginas FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.referencias_retencao_paginas FROM anon, authenticated;
GRANT SELECT ON public.referencias_retencao_paginas TO authenticated;
GRANT ALL ON public.referencias_retencao_paginas TO service_role;
ALTER TABLE public.naturezas_rendimento_reinf ENABLE ROW LEVEL SECURITY;
CREATE POLICY naturezas_rendimento_reinf_read ON public.naturezas_rendimento_reinf FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.naturezas_rendimento_reinf FROM anon, authenticated;
GRANT SELECT ON public.naturezas_rendimento_reinf TO authenticated;
GRANT ALL ON public.naturezas_rendimento_reinf TO service_role;
ALTER TABLE public.referencias_retencao_aliquotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY referencias_retencao_aliquotas_read ON public.referencias_retencao_aliquotas FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.referencias_retencao_aliquotas FROM anon, authenticated;
GRANT SELECT ON public.referencias_retencao_aliquotas TO authenticated;
GRANT ALL ON public.referencias_retencao_aliquotas TO service_role;
