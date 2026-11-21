# PR 5 — Relatório por categoria e Dashboard

| | |
|---|---|
| **Responsável** | João Vitor (implementa todas as tarefas deste plano) |
| **Revisor** | Gabriel |
| **Branch** | `feat/relatorio-categorias` |
| **Situação** | Concluído — PR #12, entregue na `main` pelo #13 |
| **Especificação** | [especificacao.md](../especificacao.md) — seções 4.5 (RF7) e 5 |
| **Depende de** | PR 3 (lançamentos) e PR 6 (página de relatórios e `models/relatorio.js`) |

## Objetivo

Relatório de saídas e entradas por categoria num período, com comparação com o período anterior (RF7), e a tela inicial (Dashboard) com o resumo do mês.

## Como está organizado

- `config/datas.js`: `periodoAnterior({ inicio, fim })` (função pura).
- `models/relatorio.js`: `porCategoria(usuarioId, periodo)`, ao lado do `porFonteDestino` do PR 6.
- `routes/relatorios.js`: `GET /api/relatorios/categorias?inicio=&fim=` (mesma validação de período do RF8).
- Front-end: aba "Por categoria" (`RelatorioCategorias.jsx`) na página `Relatorios` do PR 6, e `Dashboard.jsx`.

## Decisões

- **Período anterior.** Se o período é de meses inteiros (dia 1 ao último dia), compara com o mesmo número de meses inteiros logo antes (outubro → setembro; out–dez → jul–set). Senão, desloca o mesmo número de dias para trás. Assim "novembro" compara com outubro inteiro, mesmo tendo 30 e 31 dias.
- **Uma consulta por tipo.** `SUM(...) FILTER (WHERE data BETWEEN ...)` soma o período atual e o anterior na mesma consulta, agrupando por categoria no banco.
- **Categorias só do período anterior aparecem com total 0**, para mostrar a redução.
- **Percentual em centavos.** `round(centavos × 10000 / total) / 100`: 2 casas sem erro de ponto flutuante.
- **Compra parcelada conta inteira no mês da compra** (mesma regra do RF8; só as faturas distribuem as parcelas).
- **Dashboard sem rota nova.** Usa `GET /api/lancamentos` (mês corrente: totais e últimos lançamentos) e `GET /api/relatorios/faturas?meses=1` (fatura fechada a pagar ou, se não houver, a aberta).

## Casos de atenção (cobertos por teste)

- `periodoAnterior`: mês inteiro, vários meses, virada de ano, fevereiro, intervalo arbitrário.
- Saídas ordenadas do maior para o menor, com percentual, total anterior e variação.
- Categoria só com valor no período anterior aparece com total 0.
- Período sem lançamentos: listas vazias, sem divisão por zero.
- Outro usuário não vê nada; rota sem datas → 400.

## Tarefas

- [x] `periodoAnterior` com testes.
- [x] `porCategoria` com testes de model; rota com teste de API.
- [x] Aba "Por categoria": pizza das saídas, barras atual × anterior, tabela com variação e tabela de entradas.
- [x] Dashboard: totais do mês, últimas movimentações e próxima fatura de cada cartão.
- [x] README: rota nova.
- [x] Commit: `feat: relatório por categoria com período anterior e Dashboard`
