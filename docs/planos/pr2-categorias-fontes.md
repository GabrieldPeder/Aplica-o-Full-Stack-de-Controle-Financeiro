# PR 2 — Categorias e fontes/destinos

| | |
|---|---|
| **Responsável** | Gabriel (implementa todas as tarefas deste plano) |
| **Revisor** | João Vitor |
| **Branch** | `feat/categorias-fontes` (criada a partir de `feat/autenticacao`) |
| **Situação** | Em revisão |
| **Especificação** | [especificacao.md](../especificacao.md) — seções 3, 4.3 e 5 |
| **Depende de** | PR 1 (`autenticar`, `validar`, `Layout`) |

## Objetivo

CRUD de categorias (RF4) e de fontes/destinos (RF5), na API e nas telas, sempre isolado por usuário (RF3). Com isso o João Vitor tem tudo o que precisa para as rotas e a tela de lançamentos (PR 3).

## Como está organizado

- `models/categoria.js` e `models/fonteDestino.js`: `listar`, `criar`, `atualizar`, `excluir`. Todas recebem `usuarioId` como 1º parâmetro, no mesmo padrão do `models/lancamento.js`.
- `routes/categorias.js` e `routes/fontesDestinos.js`: validam com `validar` e chamam o model. Montadas em `server.js` atrás de `autenticar`.
- Front-end: `services/useApi.js` (hook de carregamento), `services/formatar.js` (moeda), componentes `CampoSelect`, `ListaVazia` e `ConfirmarExclusao`, e as páginas `Categorias` e `FontesDestinos`.

## Decisões

- **Mudar o tipo de algo que já tem lançamentos → 409.** Vale para categoria (uma saída ficaria ligada a uma categoria de entrada) e para fonte/destino (um cartão com parcelas viraria conta e as faturas quebrariam). Mudar o nome continua livre.
- **Campos de cartão só existem em cartão.** Para `renda` e `conta`, dia de fechamento, dia de vencimento e limite são gravados como `NULL`, mesmo que venham no corpo. `reserva` só vale para `conta`; nos outros tipos é gravada como `false`.
- **`quantidadeLancamentos` na listagem.** Cada item listado informa quantos lançamentos usa. A tela usa isso para avisar antes de excluir ou mudar o tipo, e o banco continua barrando (FK → 409).
- **Id inválido na URL** (`/api/categorias/abc`) → 400 pelo `validar`. Id válido de outro usuário → 404.
- **`ConfirmarExclusao` fica em `comuns/`.** O PR 3 pode reaproveitá-lo para "só esta parcela / todas as parcelas" passando os próprios botões.

## Casos de atenção

- Usuário A não vê, edita nem exclui categoria ou fonte de B → 404 (e B não aparece na listagem de A).
- Nome repetido: categoria repete por **nome + tipo** ("Outros" de entrada e "Outros" de saída podem coexistir); fonte/destino repete só por nome.
- Excluir com lançamentos → 409 "Não é possível excluir: existem lançamentos vinculados."
- Cartão sem dia de fechamento, dia de vencimento ou limite → 400 apontando cada campo.
- Editar um cartão para conta zera os campos de cartão.

---

## Tarefa 1 — Models

**Arquivos:** `backend/src/models/categoria.js`, `backend/src/models/fonteDestino.js`
**Testes:** `backend/test/models/categoria.test.js`, `backend/test/models/fonteDestino.test.js`

- [ ] Testes de categoria: listar só as do usuário, ordenadas por tipo e nome, com `quantidadeLancamentos`; criar; nome+tipo repetido → 409 (via `23505`); atualizar nome; mudar tipo com lançamentos → 409 no campo `tipo`; atualizar/excluir de outro usuário → 404; excluir com lançamento → `23503`.
- [ ] Testes de fonte/destino: criar conta (campos de cartão `null`, `reserva` respeitada), criar cartão com dias e limite numérico; nome repetido → 409; cartão → conta zera campos de cartão; mudar tipo com lançamentos → 409; isolamento → 404; excluir com lançamento → `23503`.
- [ ] Ver falharem, implementar, ver passarem.
- [ ] Commit: `feat: models de categorias e fontes/destinos`

## Tarefa 2 — Rotas

**Arquivos:** `backend/src/routes/categorias.js`, `backend/src/routes/fontesDestinos.js`, `backend/src/server.js`, `README.md`
**Testes:** `backend/test/routes/categorias.test.js`, `backend/test/routes/fontesDestinos.test.js`

| Método | Rota | Resposta |
|---|---|---|
| GET | `/api/categorias` | 200 lista |
| POST | `/api/categorias` | 201 · 400 · 409 |
| PUT | `/api/categorias/:id` | 200 · 400 · 404 · 409 |
| DELETE | `/api/categorias/:id` | 204 · 404 · 409 |
| GET | `/api/fontes-destinos` | 200 lista |
| POST | `/api/fontes-destinos` | 201 · 400 · 409 |
| PUT | `/api/fontes-destinos/:id` | 200 · 400 · 404 · 409 |
| DELETE | `/api/fontes-destinos/:id` | 204 · 404 · 409 |

- [ ] Testes: sem token → 401; corpo inválido → 400 com os campos (cartão sem dias/limite aponta os três); id `abc` → 400; fluxo criar → listar → editar → excluir; isolamento entre dois usuários → 404; duplicado → 409; excluir com lançamento → 409.
- [ ] Ver falharem, implementar, registrar em `server.js` com `autenticar`, ver passarem.
- [ ] README: tabela de rotas.
- [ ] Commit: `feat: rotas de categorias e fontes/destinos`

## Tarefa 3 — Telas

**Arquivos:** `services/useApi.js`, `services/formatar.js`, `components/comuns/{CampoSelect,ListaVazia,ConfirmarExclusao}.jsx`, `components/paginas/{Categorias,FontesDestinos}.jsx`, `App.jsx`, `index.css`

- [ ] `useApi(caminho, parametros)` → `{ dados, carregando, erro, recarregar }` (o PR 3 usa com os filtros de lançamentos).
- [ ] Categorias: formulário de criar/editar (nome, tipo), listas de saídas e de entradas, editar e excluir com confirmação; erros do servidor embaixo dos campos; aviso quando a categoria tem lançamentos.
- [ ] Fontes e destinos: formulário com os campos de cartão só quando o tipo é cartão e "reserva de emergência" só quando é conta; tabela com tipo, dias, limite em R$ e reserva; editar e excluir com confirmação.
- [ ] Estados de carregando, lista vazia e erro nas duas telas.
- [ ] Conferir: lint e build limpos; no navegador: criar, ver erro de nome repetido no campo, editar, excluir, cartão sem limite mostra o erro, tela de outro usuário não mostra os dados do primeiro.
- [ ] Commit: `feat: telas de categorias e fontes/destinos`
