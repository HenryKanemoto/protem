# Proposta: Score Protem (histórico de uso)

Proposta de uma página, **sem código**. Serve para a equipe decidir se vale construir e com quais limites.

## O que é

Um número de 0 a 100 por pessoa que resume **como ela usou os itens nos últimos 90 dias**: devolveu no prazo, cuidou dos itens e retirou o que pediu. É **só informativo**. Ajuda o responsável pelo acervo a conhecer o histórico de quem pede e ajuda a pessoa a ver como está.

## O que NÃO é

- **Não bloqueia, não nega e não atrasa nenhum pedido.** As regras RN01 a RN10 continuam exatamente como estão. Atraso continua sendo tratado só pela política da RN06.
- Não é público e não vira ranking: só a própria pessoa e o responsável veem.
- Não entra como regra no back-end nem decide nada sozinho.

## Como se calcula (tudo à vista)

| Parte | Peso | Como pontua |
|---|---|---|
| Pontualidade | 50 | Devoluções no prazo ÷ devoluções no período |
| Cuidado com os itens | 30 | Devoluções sem avaria ÷ devoluções no período |
| Retirada do que pediu | 20 | Pedidos aprovados que foram retirados ÷ pedidos aprovados |

- **Mínimo de 3 empréstimos** no período. Antes disso aparece "Sem histórico suficiente", nunca um número baixo por falta de dados. Quem está começando não é punido.
- Faixas em texto neutro: **Em construção** (sem histórico suficiente), **Bom** e **Ótimo**. Sem vermelho nem alarme.
- Avaria conta menos se o responsável marcar a categoria "avaria estética". Pedido recusado ou expirado por falha do sistema não conta contra a pessoa.
- A pessoa vê o **detalhamento**: cada parte, a conta e os empréstimos que entraram. Nenhum número aparece sem explicação.

## Quem decide usar

- **Opt-in da instituição**, em Configurações, **desligado por padrão**. Quem liga escolhe o período (30, 90 ou 180 dias).
- Desligado, nada é calculado nem exibido.

## Cuidados com a LGPD

- **Finalidade clara:** apoiar o responsável na gestão do acervo. Está escrita na tela e na política de privacidade.
- **Minimização:** usa só dados que o Protem já tem (datas, devoluções, avarias). Nada novo é coletado, e nenhum dado sensível entra.
- **Sem decisão automatizada:** o score nunca decide por conta própria, e a pessoa pode **pedir revisão** de um empréstimo que entrou na conta (a revisão fica registrada na auditoria).
- **Acesso restrito:** só a pessoa e o responsável. Sem exportação em massa.
- **Retenção:** só o período calculado; não existe "histórico de scores".
- A instituição é a controladora dos dados: a base legal e o texto de privacidade devem ser **validados com o encarregado (DPO) da instituição** antes de ligar.
- Na demonstração, tudo continua com dados fictícios.

## Riscos e como reduzir

| Risco | Cuidado |
|---|---|
| Estigmatizar quem teve um mau começo | Mínimo de 3 empréstimos, janela móvel de 90 dias, faixas neutras |
| Culpar a pessoa por defeito do item | Categoria de avaria e revisão pedida pela pessoa |
| O responsável usar o número como regra | Texto fixo na tela: "informativo, não bloqueia pedidos"; sem filtro nem ordenação por score |
| Gamificação (correr atrás do número) | Sem pontos por uso, sem comparação entre pessoas |

## Como seria construído (estimativa)

- Função pura em `store/regras/` (como as demais regras) com testes para cada parte, os limites e o caso "sem histórico suficiente".
- Campo opcional na configuração (`scoreAtivo`, `scoreDias`); sem mudança no formato do estado salvo.
- Uma seção no **perfil da pessoa** e no **detalhe do usuário** do responsável, com o detalhamento.
- Cerca de 2 a 3 dias de trabalho.

## Perguntas para a equipe

1. Os pesos 50 / 30 / 20 fazem sentido para a realidade de vocês?
2. O responsável deve ver o score antes de aprovar um pedido, ou só no detalhe do usuário?
3. Quem valida o texto de privacidade com a instituição?
