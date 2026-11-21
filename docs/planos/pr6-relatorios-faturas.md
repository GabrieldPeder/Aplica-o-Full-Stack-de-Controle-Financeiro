# PR 6 — Relatório por fonte/destino e faturas

| | |
|---|---|
| **Responsável** | Gabriel (implementa todas as tarefas deste plano) |
| **Revisor** | João Vitor |
| **Branch** | `feat/relatorios-faturas` (criada a partir de `feat/categorias-fontes`) |
| **Situação** | Concluído — PR #8 |
| **Especificação** | [especificacao.md](../especificacao.md) — seções 4.5 (RF8), 4.6 (RF9) e 5 |
| **Depende de** | PR 2 (fontes/destinos) e o model de lançamentos do PR 3 |

## Objetivo

Relatório de entradas, saídas e saldo por fonte/destino num período (RF8) e previsão das faturas de cada cartão de crédito, com parcelas futuras e limite utilizado/disponível (RF9). Na API e nas telas.

## Como está organizado

- `config/datas.js`: `calcularFatura` (implementação de referência do enunciado), `ultimoDiaDoMes`, `dataValida`, `hojeIso`. Funções puras.
- `middlewares/validar.js`: nova regra `data()` (`AAAA-MM-DD` existente). O PR 3 usa a mesma regra nas rotas de lançamentos.
- `models/relatorio.js`: `porFonteDestino(usuarioId, { inicio, fim })`. O PR 5 acrescenta `porCategoria` neste arquivo.
- `models/fatura.js`: `previsao(usuarioId, { meses, hoje })`.
- `routes/relatorios.js`: `GET /api/relatorios/fontes-destinos` e `GET /api/relatorios/faturas`. O PR 5 acrescenta `/categorias` neste arquivo.
- Front-end: página `Relatorios` com seletor de período e abas. Este PR faz a aba "Por fonte/destino" (`RelatorioFontesDestinos.jsx`); a aba "Por categoria" fica reservada para o PR 5. Página `Faturas`. Gráficos com Recharts.

## Decisões

- **"Hoje" como parâmetro.** `previsao` recebe `hoje` (padrão: data atual no horário de Brasília, por `hojeIso()`). Os testes passam uma data fixa, sem mexer no relógio.
- **Janela de faturas a partir de hoje.** A fatura atual é `calcularFatura(hoje, cartão, 1)`: é a fatura em que cairia uma compra feita hoje. As próximas são as parcelas 2, 3… dessa mesma conta. Assim "compra no dia do fechamento vai para o mês seguinte" vale também para escolher a fatura atual.
- **O que compõe uma fatura.** Só lançamentos de **saída** no cartão. Cada parcela vai para `calcularFatura(dataDaCompra, cartão, parcela)`. Faturas sem itens aparecem com total R$ 0,00.
- **Limite utilizado.** É a soma de todas as parcelas com vencimento hoje ou depois, incluindo uma fatura já fechada e ainda não vencida. O limite disponível pode ficar negativo, e a tela destaca isso.
- **Contas em centavos.** Os totais são somados em centavos (`config/dinheiro.js` do PR 3), para não acumular erro de arredondamento.
- **Período do RF8 usa a data da compra.** Uma compra parcelada aparece inteira no mês da compra (decisão da especificação, seção 3). Só a tela de faturas distribui as parcelas.

## Casos de atenção

- As 4 linhas da tabela de exemplos do enunciado, mais fechamento no dia 31 em fevereiro e parcela que atravessa o ano.
- Compra feita **no dia do fechamento** aparece na fatura do mês seguinte (item do checklist final).
- Parcela já vencida não conta no limite utilizado nem aparece na previsão.
- Usuário A não vê cartões, lançamentos nem saldos de B.
- `inicio` depois de `fim`, data inexistente (`2026-02-30`) e `meses` fora de 1–12 → 400.

---

## Tarefa 1 — Datas e regra `data()`

**Arquivos:** `backend/src/config/datas.js`, `backend/src/middlewares/validar.js`
**Testes:** `backend/test/config/datas.test.js`, `backend/test/middlewares/validar.test.js`

- [x] Testes: tabela do enunciado; fechamento 31 em fevereiro (vira 28/02); dia de vencimento 31 em mês de 30 dias; parcela 12 atravessando o ano; `dataValida` recusa `2026-02-30`, `2026-13-01`, `26-1-1`; regra `data()` normaliza e dá a mensagem certa.
- [x] Ver falharem, implementar, ver passarem.
- [x] Commit: `feat: cálculo de fatura e validação de datas`

## Tarefa 2 — Relatório por fonte/destino (RF8)

**Arquivos:** `backend/src/models/relatorio.js` · **Testes:** `backend/test/models/relatorio.test.js`
**Entrega:** `{ periodo: { inicio, fim }, totalEntradas, totalSaidas, entradasPorFonte: [{ id, nome, tipo, total }], saidasPorDestino: [...], saldoContas: [{ id, nome, entradas, saidas, saldo }] }`, listas ordenadas por total (maior primeiro).

- [x] Testes: somas por fonte e por destino só dentro do período; saldo de cada conta (inclusive conta sem movimento, com zeros); totais em centavos exatos (0,10 + 0,20 = 0,30); isolamento entre usuários.
- [x] Ver falharem, implementar, ver passarem.
- [x] Commit: `feat: relatório por fonte/destino`

## Tarefa 3 — Previsão de faturas (RF9)

**Arquivos:** `backend/src/models/fatura.js` · **Testes:** `backend/test/models/fatura.test.js`
**Entrega:** `{ cartoes: [{ id, nome, diaFechamento, diaVencimento, limite, limiteUtilizado, limiteDisponivel, faturas: [{ referencia, fechamento, vencimento, situacao, atual, total, itens: [{ id, descricao, parcela, valor, dataCompra }] }] }] }`.

- [x] Testes (hoje fixo): fatura atual + próximas `meses`, inclusive vazias; compra no dia do fechamento cai na fatura seguinte; parcelas 1/3, 2/3, 3/3 em faturas seguidas com "x/3" no item; parcela vencida fora do limite e da previsão; entrada no cartão ignorada; cartão sem lançamentos tem limite todo disponível; isolamento.
- [x] Ver falharem, implementar, ver passarem.
- [x] Commit: `feat: previsão de faturas dos cartões`

## Tarefa 4 — Rotas

**Arquivos:** `backend/src/routes/relatorios.js`, `backend/src/server.js`, `README.md`
**Testes:** `backend/test/routes/relatorios.test.js`

| Método | Rota | Resposta |
|---|---|---|
| GET | `/api/relatorios/fontes-destinos?inicio=&fim=` | 200 · 400 · 401 |
| GET | `/api/relatorios/faturas?meses=3` | 200 · 400 · 401 |

- [x] Testes: sem token → 401; datas ausentes, inválidas ou invertidas → 400 com o campo; `meses` 0 ou 13 → 400; respostas 200 com o formato acima.
- [x] Ver falharem, implementar, registrar em `server.js` com `autenticar`, ver passarem.
- [x] README: rotas e decisões de faturas.
- [x] Commit: `feat: rotas de relatório por fonte/destino e faturas`

## Tarefa 5 — Telas

**Arquivos:** `components/paginas/{Relatorios,RelatorioFontesDestinos,Faturas}.jsx`, `services/formatar.js`, `App.jsx`, `index.css`, `package.json` (Recharts)

- [x] Relatórios: seletor de período (padrão: mês atual) e abas; aba "Por fonte/destino" com resumo, gráfico de barras (entradas × saídas) e tabelas de entradas por fonte, saídas por destino e saldo das contas.
- [x] Faturas: para cada cartão, dias de fechamento e vencimento, barra de limite usado/disponível (vermelha se estourar), cartões das faturas com itens "Notebook — 3/10", destaque da fatura atual e estado vazio.
- [x] Estados de carregando, vazio e erro.
- [x] Conferir: lint e build limpos; no navegador, com lançamentos parcelados, os valores batem com a regra de fechamento.
- [x] Commit: `feat: telas de relatório por fonte/destino e de faturas`

---

## Correções após a revisão

- **Fatura fechada e ainda não vencida:** entre o fechamento e o vencimento, a fatura que acabou de fechar contava no limite utilizado, mas não aparecia na tela. Agora ela aparece antes da atual com `situacao: 'fechada'` e o selo "A pagar". As outras faturas têm `situacao` `'aberta'` (a atual) ou `'futura'`. Com isso, a soma das faturas mostradas é igual ao limite utilizado (teste `entre o fechamento e o vencimento…`).
- **"Hoje" no plano:** o texto dizia UTC; o código usa o horário de Brasília (`hojeIso`).

## Pendências menores

- Com muitas fontes/destinos (15 ou mais), os nomes do gráfico de barras se sobrepõem e alguns somem; um gráfico horizontal ou "top N + Outros" resolveria.
- As abas de Relatórios usam `role="tab"`, mas não têm `role="tabpanel"` nem navegação pelas setas.
- O Recharts deixa o pacote do front-end com cerca de 770 kB (aviso no build); carregar Relatórios e Faturas com `React.lazy` reduziria.
- Ao digitar o ano no campo de data, o Chrome dispara uma consulta por dígito; as respostas antigas são ignoradas, mas o erro de período pisca.
- O ano `0000` passa na validação de data e o banco recusa com "Parâmetro inválido." sem apontar o campo.
- `previsao` carrega todas as compras no cartão do usuário, sem filtro de data (sem impacto no tamanho deste projeto).
