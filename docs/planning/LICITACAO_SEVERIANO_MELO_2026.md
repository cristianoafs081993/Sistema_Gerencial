# Plano de produto — Pregão Eletrônico 16/2026 de Severiano Melo/RN

## Decisão executiva

O edital contrata em lote único 14 grupos de software, migração, implantação, treinamento, suporte presencial e customização. O valor estimado do primeiro ano é de **R$ 474.656,39**, as propostas encerram em **14/07/2026 às 07h59** e a implantação completa deve ocorrer em **45 dias** após a Ordem de Serviço.

A recomendação é **NO-BID por desenvolvimento próprio** e **BID CONDICIONAL apenas com parceiro/consórcio/white-label que já possua ERP municipal maduro, ambiente demonstrável, atestados e aderência a SIAFIC/TCE-RN**. A admissibilidade jurídica e comercial dessa composição deve ser confirmada formalmente.

O sistema atual tem bons ativos em orçamento, despesa, compras, artefatos de licitação, pesquisa de preços, PNCP, atas, contratos, documentos e dashboards, mas não é um ERP municipal completo. Tributário e Saúde, hoje praticamente ausentes, somam 819 de aproximadamente 1.310 requisitos, ou 62,5% do total.

## Riscos eliminatórios

- Lote único, fornecedor único e interoperabilidade entre módulos.
- Mínimo de 90% de aderência em cada módulo e também no conjunto.
- Item parcialmente atendido conta como não atendido.
- Possível prova de conceito com base de teste própria, sem correções ou contato externo durante a sessão.
- Migração de tributário, pessoal, ponto, protocolos, documentos, patrimônio, contabilidade, planejamento, compras, licitações, estoques e frotas, sem dicionário do legado.
- Implantação, parametrização, migração e treinamento em 45 dias.
- Suporte das 08h às 17h, atendimento presencial, 300 horas pós-implantação e 300 horas de customização.
- Conformidade contínua com SIAFIC, TCE/RN e regras CON sem custo adicional.
- Atestado compatível, balanços de dois exercícios, LG/LC/SG superiores a 1 e patrimônio líquido mínimo de R$ 47.465,64.

Deve-se pedir esclarecimento porque o item 19.1 aceita 90%, enquanto os itens 20.8, 20.13 e 20.15 sugerem demonstração de todas as funções. O item 20.15 também cita um inexistente item 31, embora as especificações estejam no item 19.

## Ativos reaproveitáveis

- React, TypeScript, Supabase, React Query, design system e Vitest.
- Autenticação, rotas protegidas, usuários, grupos e permissões por tela.
- Planejamento/executação orçamentária, créditos, empenhos, liquidações, pagamentos, retenções e contratos.
- Requisição de compra e geração de ETP, TR, Matriz de Riscos e contratos.
- Pesquisa de preços, cotações locais, Compras.gov.br, PNCP, pregões e atas/ARP.
- Editor documental, processos SUAP, dashboards e Edge Functions.

## Lacunas transversais

- Multitenancy e multientidade em todo o modelo de dados.
- RBAC granular por entidade, módulo, função e ação.
- Auditoria imutável com autor, ação, instante e origem.
- SSO corporativo, assinatura ICP-Brasil e assinatura em lote.
- Workflow, tarefas, notificações, anexos e busca global.
- Central de ajuda e portal de suporte com SLA e satisfação.
- Backup/restauração testados, observabilidade, segurança e evidências LGPD.
- Migração com staging, mapeamento, validação, reconciliação e rollback.

## Matriz preliminar

As faixas são triagem de produto, não declaração formal de aderência.

| Módulo | Requisitos | Aderência atual estimada | Decisão |
|---|---:|---:|---|
| Planejamento público | 77 | 15–25% | Evoluir após a fundação |
| Contabilidade/finanças/diárias/convênios | 105 | 15–25% | Parceiro primeiro |
| Compras/licitações/contratos | 57 | 45–60% | Prioridade própria |
| Transparência | 26 | 5–15% | Construir sobre dados comuns |
| Patrimônio | 18 | 0–5% | Construir após compras/contabilidade |
| Almoxarifado | 16 | 0–5% | Construir junto de compras |
| Frotas | 21 | 0–10% | Reutilizar manutenção |
| Obras | 15 | 0–10% | Construir após contratos |
| BI | 4 | 25–40% | Tornar configurável |
| Tributário | 403 | 0–3% | Parceiro ou aquisição |
| Mobile | 30 | 0–10% | PWA primeiro |
| Processo/assinatura | 9 | 15–30% | Evoluir e integrar ICP-Brasil |
| Banco de preços/cotação | 8 | 55–70% | Prioridade própria |
| Controle interno | 34 | 5–15% | Construir sobre auditoria/riscos |
| Site/e-SIC/Ouvidoria | 54 | 0–5% | Produto separado sobre CMS/protocolo |
| Ponto | 17 | 0–5% | Integrar solução de mercado |
| Saúde | 416 | 0–2% | Parceiro especializado |

## Economia do contrato

| Componente | Valor |
|---|---:|
| Licenças por 12 meses | R$ 316.776,72 |
| Migração/implantação/treinamento | R$ 21.388,67 |
| 300 h de suporte local | R$ 63.008,00 |
| 300 h de customização | R$ 73.483,00 |
| **Total** | **R$ 474.656,39** |

As 600 horas consomem mão de obra e deslocamento. O valor de implantação é baixo para converter todas as bases sem documentação.

Estimativa ROM, com incerteza mínima de ±40%:

- desenvolvimento integral das lacunas: 220–360 pessoa-mês;
- prazo: 12–24 meses com 12–18 pessoas;
- custo carregado a R$ 15 mil–R$ 20 mil por pessoa-mês: R$ 3,3–7,2 milhões;
- integração com parceiro maduro: 12–30 pessoa-mês, mais licença ou participação na receita.

O desenvolvimento integral não se paga com esta contratação isolada.

## Sequência por custo/benefício

### Fase 0 — gate desta licitação (1–2 dias)

1. Validar toda a habilitação e os atestados.
2. Enviar os pedidos de esclarecimento.
3. Localizar parceiro com ERP completo e demonstração pronta.
4. Criar matriz sim/não dos 1.310 requisitos.
5. Ensaiar a prova de conceito na ordem do edital.
6. Participar somente se cada módulo atingir ao menos 92% internamente.

Sem parceiro pronto, a recomendação é não participar desta edição.

### Fase 1 — fundação do fork (8–12 semanas)

1. Remover suposições fixas de IFRN, campus e UASG.
2. Criar tenant, entidade, unidade administrativa e exercício.
3. Implementar multitenancy, RLS e RBAC granular.
4. Criar auditoria append-only.
5. Criar workflow, notificações, documentos e assinatura.
6. Criar plataforma de importação/migração.
7. Implantar ajuda, suporte/SLA, observabilidade, backup e recuperação.

É o investimento de maior reuso em todos os módulos e editais.

### Fase 2 — compras e contratações (10–16 semanas)

1. Catálogos de materiais/serviços e fornecedores.
2. Fluxo DFD → ETP → riscos → TR → preços → compra.
3. Compras diretas, sanções, pareceres e aprovações.
4. PNCP, pregões, propostas, adjudicação e homologação.
5. Atas, contratos, pré-empenho, ordens e recebimentos.
6. Cotação externa por link e portal do fornecedor.
7. Dados sintéticos e testes de demonstração.

Este é o melhor módulo próprio: já há base e ele atende órgãos das três esferas.

### Fase 3 — BI, transparência e controle interno (8–14 semanas)

1. Dashboards configuráveis.
2. Camada pública e portal de transparência.
3. Alertas, conciliações, amostragem e planos de ação.
4. Linhagem de dados e evidências.

### Fase 4 — patrimônio, almoxarifado, frota e obras

Detalhamento: [FASE_4_PATRIMONIO_ALMOXARIFADO_FROTA_OBRAS.md](FASE_4_PATRIMONIO_ALMOXARIFADO_FROTA_OBRAS.md).

Ordem recomendada: fundação operacional → Almoxarifado → Patrimônio → Frota → Obras. A estimativa refinada é de 7–10 meses; a faixa inicial de 4–7 meses exige redução de escopo ou módulos de mercado.

### Fase 5 — planejamento e contabilidade municipal (6–12 meses)

Exige liderança funcional especializada: PPA/LDO/LOA, PCASP, eventos contábeis, execução integrada, Lei 4.320, RREO, RGF, MSC/SICONFI, TCE/RN e regras CON. Validar fechamentos completos em município piloto antes de vender.

### Fase 6 — verticais por parceria

- Tributário: IPTU, ISS/NFS-e, taxas, dívida ativa, cobrança, bancos, Pix e fiscalização.
- Saúde: prontuário, regulação, farmácia, vigilâncias, SUS e CNES.
- Ponto: relógios, escalas, banco de horas e folha.
- Site/e-SIC/Ouvidoria e mobile podem ser próprios depois da fundação.

Tributário e Saúde devem ser produtos independentes, não funcionalidades criadas para um único edital.

## Arquitetura do fork

- Núcleo sem referências fixas a uma instituição.
- Identidade, vocabulário, integrações e regras por tenant.
- Separação entre core, domínios e conectores regulatórios.
- APIs/eventos para módulos próprios ou parceiros.
- Feature flags e licenciamento por módulo.
- Templates, relatórios e regras legais versionados.
- Pacote de dados sintéticos e roteiros automáticos para POC.

## Critério para investir em módulo próprio

Iniciar somente se pelo menos três condições forem verdadeiras:

1. aparece em várias licitações-alvo;
2. reaproveita 40% ou mais da fundação;
3. pode ser vendido separadamente;
4. sua manutenção regulatória é proporcional à receita;
5. existe parceiro ou piloto real;
6. payback conservador em 24–36 meses.

As primeiras apostas são Compras/Licitações/Contratos, Banco de Preços/Cotação, Processo/Documentos, BI/Transparência e Controle Interno.

## Próximos artefatos

1. Planilha de aderência com requisito, responsável, evidência, status e custo.
2. Roteiro de POC por módulo.
3. Due diligence de parceiros.
4. Modelo financeiro: parceiro, aquisição e desenvolvimento.
5. Arquitetura alvo e plano de desacoplamento do IFRN.
6. Plano comercial com quantidade mínima de municípios por vertical.

## Decisão final

- **Pregão atual:** NO-BID solo; BID CONDICIONAL com parceiro pronto.
- **Produto:** prosseguir com o fork, fundação multi-instituição e suíte de compras.
- **Investimento:** não iniciar Contabilidade, Tributário ou Saúde sem especialistas, piloto e carteira comercial.

## Fonte e método

Análise do edital e TR do Pregão 16/2026, Processo 1006011/2026, fornecido em PDF, e do inventário atual de rotas, páginas, services, Edge Functions, migrations e documentação deste repositório. A contagem foi extraída dos subitens 19.2.x a 19.18.x e precisa de validação manual antes de qualquer declaração de aderência.
