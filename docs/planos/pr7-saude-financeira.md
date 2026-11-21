# PR 7 — Saúde financeira (desafio)

| | |
|---|---|
| **Responsável** | João Vitor (implementa todas as tarefas deste plano) |
| **Revisor** | Gabriel |
| **Branch** | `feat/saude-financeira` |
| **Situação** | Concluído — PR #9, entregue na `main` pelo #13 |
| **Especificação** | [especificacao.md](../especificacao.md) — seção 4.7 |
| **Depende de** | PR 5 e PR 6 (`calcularFatura`) |

## Objetivo

Página que analisa os dados do usuário e mostra indicadores, uma projeção com gráfico e dicas, tudo calculado no back-end (requisitos do desafio: pelo menos 3 indicadores, projeção com gráfico, dicas geradas dos dados e aviso educativo visível).

## Como está organizado

- `models/saude.js`: `calcular(usuarioId, { hoje })`, a constante `LIMITES` e `mesRelativo(hoje, k)`.
- `routes/saude.js`: `GET /api/saude-financeira`.
- Front-end: `SaudeFinanceira.jsx` (indicadores, dicas, gráfico de linha com Recharts, tabelas e aviso).

## Indicadores (base: 3 últimos meses completos)

| Indicador | Cálculo | Dica |
|---|---|---|
| Taxa de poupança | (entradas − saídas) ÷ entradas, por mês e média | < 10% alerta; ≥ 20% elogio |
| Comprometimento com cartões | próximas 3 faturas ÷ (renda média × 3) | > 30% alerta |
| Parcelas futuras | parcelas a vencer, por mês da fatura | > 0 informa total e último mês |
| Categoria fora da curva | gasto do mês atual ÷ média dos 3 meses anteriores | > 30% acima alerta |
| Reserva de emergência | saldo das contas com `reserva = true` ÷ média de saídas | < 3 meses alerta; ≥ 6 elogio |

**Projeção de 6 meses:** média de entradas − média de saídas **à vista** − parcelas que caem em cada mês. As compras parceladas entram pelas parcelas (e não pela data da compra) para não serem contadas duas vezes. Algum mês negativo → alerta.

## Decisões

- **"Hoje" injetável**, como no PR 6: os testes usam 21/11/2026 fixo.
- **Meses completos.** O mês atual ainda não terminou; usá-lo na média puxaria tudo para baixo. Ele só entra na comparação "categoria fora da curva".
- **Parcelas pela fatura.** Usa `calcularFatura` do PR 6; só conta o que vence depois de hoje.
- **Sem divisão por zero.** Sem renda ou sem gastos, o indicador vem `null` e a tela mostra "—".
- **Sem API de linguagem.** As dicas são regras com os limites de `LIMITES`, documentados no README.
- **Ajuste no seed (PR 4).** Ampliado para 4 meses, e os depósitos da reserva movidos para fora da janela de análise.

## Casos de atenção (cobertos por teste)

- Taxa de poupança por mês e média; elogio acima de 20%.
- Parcelas futuras só com vencimento depois de hoje.
- Comprometimento ignora fatura já vencida.
- Categoria 150% acima da média gera alerta.
- Usuário no vermelho, sem reserva e muito comprometido recebe os 4 alertas; usuário sem lançamentos não quebra.

## Tarefas

- [x] Model `saude.js` com testes (9 casos).
- [x] Rota com teste de API (401 e usuário novo).
- [x] Página com indicadores, dicas, gráfico de projeção, tabelas e aviso.
- [x] README: seção "Saúde financeira" com os limites.
- [x] Commit: `feat: página de saúde financeira com indicadores, dicas e projeção`
