# PR 3 — Lançamentos e parcelamento

| | |
|---|---|
| **Responsável** | João Vitor (implementa todas as tarefas deste plano) |
| **Revisor** | Gabriel |
| **Branch** | `feat/lancamentos` |
| **Situação** | Em andamento |
| **Especificação** | [especificacao.md](../especificacao.md) — seções 3, 4.3 e 4.4 |
| **Depende de** | PR 1 (`autenticar`, `validar`, `AuthContext`, Layout) e PR 2 (categorias e fontes/destinos) |

## Objetivo

Entregar o CRUD de lançamentos (RF6): API com filtros, paginação, totais e compras parceladas no cartão, e a tela de Lançamentos no front-end.

## Como está organizado

- `config/dinheiro.js`: funções puras em centavos (`paraCentavos`, `deCentavos`, `dividirEmParcelas`). Nenhum cálculo de dinheiro usa decimal.
- `models/lancamento.js`: `listar`, `buscarPorId`, `criar`, `atualizar`, `excluir`. Todas recebem `usuarioId` como 1º parâmetro.
- `routes/lancamentos.js`: valida a entrada com `validar`, chama o model e devolve o status certo.
- `components/paginas/Lancamentos.jsx`: filtros, tabela paginada, totais, formulário e exclusão.

**Decisão — regras de vínculo no model.** As regras que precisam consultar o banco (categoria/fonte do usuário → 404, tipo da categoria ≠ tipo do lançamento → 400, parcelamento só em saída no cartão → 400, campos imutáveis em parcelado → 400) ficam no model e lançam `ErroApi`. Assim elas rodam **dentro da mesma transação** da gravação e ficam testadas sem subir o servidor. A rota só valida formato (tipos, tamanhos, datas) com `validar`.

**Tecnologias deste PR:** nenhuma biblioteca nova. `node:crypto` (`randomUUID`) para o grupo de parcelamento.

## Regras gerais (valem para todas as tarefas)

- Toda query filtra por `usuario_id = $1`; o id do usuário vem só de `req.usuarioId`.
- Dinheiro: cálculo em centavos; resposta com número de 2 casas (`33.34`).
- JSON em camelCase; banco em snake_case; a conversão acontece no model (`paraApi`).
- Parcelas guardam a **data da compra**; a fatura de cada uma é calculada no PR 6.
- Erros no formato `{ erro, campos }`.

## Casos de atenção

- R$ 100,00 em 3× → 33,34 + 33,33 + 33,33 (a 1ª parcela recebe o resto); a soma é sempre exata.
- Valor pequeno demais para o número de parcelas (R$ 0,02 em 3×) → 400, não parcela de R$ 0,00.
- Totais (`entradas`, `saidas`, `saldo`) somam o **filtro inteiro**, não só a página.
- Em parcelado, mandar no PUT o **mesmo** valor que já está gravado em `data`/`tipo`/… não é alteração (o front manda o objeto inteiro).
- `DELETE ?todasParcelas=true` em lançamento à vista apaga só ele (grupo `NULL` não casa com nada).
- Usuário A não lê, edita nem exclui lançamento de B → 404.
- Filtros sem `inicio`/`fim` usam o mês corrente.

---

## Tarefa 1 — Funções de dinheiro ✅

**Arquivos:** `backend/src/config/dinheiro.js` · **Testes:** `backend/test/config/dinheiro.test.js`

**Entrega:** `paraCentavos`, `deCentavos`, `dividirEmParcelas`, `MAX_PARCELAS = 48`.

- [x] Testes: 100,00/3, 0,01/1, 10,00/48, soma sempre exata, `0.1 + 0.2`, entradas inválidas (`RangeError`).
- [x] Implementar e ver passar.
- [x] Commit: `feat: funções de dinheiro em centavos e divisão em parcelas`

## Tarefa 2 — Model de lançamentos ✅

**Arquivos:** `backend/src/models/lancamento.js` · **Testes:** `backend/test/models/lancamento.test.js`
**Usa:** Tarefa 1, `emTransacao`, `ErroApi`.

**Entrega:** `listar(usuarioId, filtros)`, `buscarPorId`, `criar`, `atualizar`, `excluir(usuarioId, id, { todasParcelas })` e `ITENS_POR_PAGINA = 20`.

- [x] Testes: à vista, parcelado 100/3 (valores, `parcelaAtual`, mesmo grupo e data), parcelamento fora do cartão → 400, categoria de entrada em saída → 400, categoria/fonte de outro usuário → 404, isolamento A × B, listar (filtros, ordem, páginas, totais), editar à vista, editar parcelado, excluir parcela/grupo.
- [x] Implementar e ver passar (`npm test`: 58/58).
- [x] Commit: `feat: model de lançamentos com filtros, totais e parcelamento`

## Tarefa 3 — Rotas da API

**Arquivos:** `backend/src/routes/lancamentos.js`, `backend/src/server.js` · **Testes:** `backend/test/routes/lancamentos.test.js`
**Usa:** Tarefa 2; `autenticar` e `validar` do PR 1.

| Método | Rota | Resposta |
|---|---|---|
| GET | `/api/lancamentos` | 200 `{ itens, pagina, totalPaginas, totalItens, totais }` |
| POST | `/api/lancamentos` | 201 com a lista de lançamentos criados |
| GET | `/api/lancamentos/:id` | 200 ou 404 |
| PUT | `/api/lancamentos/:id` | 200 ou 400/404 |
| DELETE | `/api/lancamentos/:id?todasParcelas=true` | 204 ou 404 |

- [ ] Regras do `validar`: `tipo` ∈ {entrada, saida}; `descricao` 1–120 (trim); `valor` > 0 com até 2 casas; `data` `AAAA-MM-DD` existente; `categoriaId`/`fonteDestinoId` inteiros positivos; `totalParcelas` inteiro 1–48 (padrão 1). Query: `inicio`/`fim` (padrão: 1º e último dia do mês corrente), `tipo`, ids, `pagina` ≥ 1.
- [ ] Testes de API: sem token → 401; corpo inválido → 400 com **todos** os campos; parcelado 100/3 soma 100,00; A não acessa B → 404; DELETE → 204.
- [ ] Implementar, registrar em `server.js` (`app.use('/api/lancamentos', autenticar, rotas)`), ver passar.
- [ ] Atualizar a tabela de rotas do README.
- [ ] Commit: `feat: rotas de lançamentos`

## Tarefa 4 — Tela de Lançamentos

**Arquivos:** `frontend/src/components/paginas/Lancamentos.jsx`, componentes em `comuns/` que faltarem (`CampoMoeda`, `ConfirmarExclusao`), `services/formatar.js`, `App.jsx`
**Usa:** Tarefa 3; `useApi`, `AuthContext` e Layout do PR 1; listas de categorias e fontes do PR 2.

- [ ] Filtros (período, tipo, categoria, fonte/destino) e tabela paginada com totais; estados carregando / lista vazia / erro.
- [ ] Formulário: categoria filtrada pelo tipo; campo de parcelas só quando o destino é cartão e o tipo é saída; erros do servidor sob cada campo.
- [ ] Edição: em parcelado, `data`, `tipo`, fonte e parcelas ficam desabilitados com a dica "exclua e lance novamente".
- [ ] Exclusão com confirmação; em parcelado, escolher "só esta parcela" ou "todas as parcelas".
- [ ] Valores em BRL e datas `dd/mm/aaaa`.
- [ ] Commit: `feat: tela de lançamentos`

## Para combinar com o Gabriel (PR 1)

- Assinatura do `validar(regras)`: formato das regras e se ele normaliza `req.query` além de `req.body` (as rotas desta tarefa precisam das duas).
- Se as regras de vínculo devem continuar no model (decisão acima) ou subir para a rota.
