# Especificação — Projeto 2: Aplicação Full Stack de Controle Financeiro

- **Data:** 2026-11-12
- **Grupo:** Gabriel de Peder + colega (2 integrantes)
- **Enunciado:** https://costasilvati.github.io/fullStack/projeto-2.html (fonte: `costasilvati/fullStack/08-projeto-2-controle-financeiro.Rmd`)
- **Meta:** 100 pontos + 10 do desafio (saúde financeira)

Este documento registra as decisões do grupo. Onde ele não fala nada, vale o enunciado.

---

## 1. Entendimento e restrições

**O que o enunciado exige (não negociável):**

- Back-end Node.js + Express; front-end React (Vite); banco com persistência real; autenticação JWT; senhas com bcrypt.
- `backend/src/` contém **somente** `server.js`, `routes/`, `models/`, `middlewares/`, `config/`. Controladores ficam nos arquivos de rotas (sem pasta `controllers`). Acesso ao banco **só** em `models/`.
- `frontend/src/` contém **somente** `components/`, `contexts/` e `services/` (regras do Projeto 1 + `services/`), além de `main.jsx`/`App.jsx`.
- Commits incrementais dos dois integrantes; cada integrante responsável por uma parte bem definida; ambos capazes de explicar qualquer trecho.
- Uso de IA documentado no README (regra do Projeto 1).
- Repositório público (já está).

**Decisões do grupo:**

| Tema | Decisão |
|---|---|
| Banco | PostgreSQL |
| Acesso ao banco | SQL puro com `pg` (Pool + queries parametrizadas `$1`) |
| Bibliotecas back-end | `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit` |
| Bibliotecas front-end | `react-router-dom`, `axios`, `recharts` |
| Testes | Runner nativo `node:test` + `assert` + `fetch` nativo (sem dependência extra) |
| Postgres local | `backend/docker-compose.yml` (alternativa: Postgres instalado, documentada no README) |
| Estilo visual | CSS próprio (sem biblioteca de componentes) |

**Comunicação ao professor (uma única mensagem, antes de começar):**

> "Professor, nosso grupo vai usar PostgreSQL (driver `pg`) e a biblioteca Recharts para os gráficos. As demais dependências são as citadas no enunciado (Express, bcrypt, jsonwebtoken, dotenv, cors, express-rate-limit, React Router e Axios)."

---

## 2. Estrutura do repositório

```text
/
├── README.md
├── .gitignore                    → node_modules, .env, dist
├── docs/superpowers/             → especificação e plano (este documento)
├── backend/
│   ├── package.json              → scripts: dev, start, test, db:criar, db:seed
│   ├── .env.example
│   ├── docker-compose.yml        → serviço postgres:16 com volume
│   ├── database/
│   │   ├── schema.sql            → DDL completo (DROP + CREATE)
│   │   ├── seed.sql              → carga de demonstração
│   │   └── executar.js           → script Node que roda um .sql via pg (usado pelos npm scripts)
│   ├── test/                     → testes node:test (unitários e de API)
│   └── src/
│       ├── server.js
│       ├── config/
│       │   ├── env.js            → lê e valida variáveis do .env
│       │   ├── db.js             → Pool + função emTransacao(fn)
│       │   ├── cpf.js            → cpfValido (função pura)
│       │   ├── dinheiro.js       → paraCentavos, deCentavos, dividirEmParcelas (funções puras)
│       │   └── datas.js          → ultimoDiaDoMes, dataSegura, calcularFatura, periodoAnterior (funções puras)
│       ├── models/               → usuario, categoria, fonteDestino, lancamento, relatorio, fatura, saude
│       ├── middlewares/          → autenticar, validar, limitadores (rate limit), erros
│       └── routes/               → auth, categorias, fontesDestinos, lancamentos, relatorios, saude
└── frontend/
    ├── package.json
    ├── .env.example              → VITE_API_URL=http://localhost:3000/api
    └── src/
        ├── main.jsx, App.jsx     → BrowserRouter + rotas
        ├── services/
        │   ├── api.js            → instância única do axios (Bearer + tratamento de 401)
        │   ├── useApi.js         → hook { dados, carregando, erro, recarregar }
        │   └── formatar.js       → moeda BRL, datas pt-BR, máscaras de CPF e moeda
        ├── contexts/
        │   └── AuthContext.jsx   → usuario, token, login, logout, cadastrar
        └── components/
            ├── paginas/          → Login, Cadastro, Dashboard, Lancamentos, Categorias,
            │                       FontesDestinos, Relatorios, Faturas, SaudeFinanceira
            ├── layout/           → RotaProtegida, Layout (menu + sair)
            └── comuns/           → Carregando, ListaVazia, MensagemErro, CampoTexto,
                                    CampoMoeda, CampoCpf, ConfirmarExclusao, gráficos
```

Decisão a documentar no README: funções utilitárias puras ficam em `backend/src/config/`; `formatar.js` e `useApi.js` ficam em `frontend/src/services/`.

---

## 3. Modelo de dados

Base: o DDL do enunciado, com estes acréscimos/ajustes:

- Constraints de unicidade com **nome explícito**, para identificar o campo no erro `23505`:
  - `CONSTRAINT usuarios_email_unico UNIQUE (email)`
  - `CONSTRAINT usuarios_cpf_unico UNIQUE (cpf)`
  - `CONSTRAINT categorias_nome_unico UNIQUE (usuario_id, nome, tipo)`
  - `CONSTRAINT fontes_destinos_nome_unico UNIQUE (usuario_id, nome)`
- `fontes_destinos`: `CHECK (limite IS NULL OR limite > 0)` e coluna `reserva BOOLEAN NOT NULL DEFAULT FALSE` (para o desafio).
- `lancamentos`: FKs para `categorias` e `fontes_destinos` **sem** `ON DELETE CASCADE` (exclusão com vínculo gera `23503` → 409). `CHECK (parcela_atual BETWEEN 1 AND total_parcelas)`.
- Índices: `(usuario_id, data)` e `(grupo_parcelamento)`.

**Normalização antes de gravar:** e-mail `trim().toLowerCase()`; CPF só dígitos; nomes com `trim()`.

**Dinheiro:** `NUMERIC(12,2)` no banco. Na API, todo cálculo em **centavos inteiros** (`config/dinheiro.js`). O `pg` devolve `NUMERIC` como string; os models convertem para número com 2 casas na saída.

**Parcelas guardam a data da compra.** Todas as parcelas de uma compra têm a mesma `data` (data da compra); a fatura de cada uma é calculada por `calcularFatura(data, cartao, parcela_atual)`.
- Justificativa (para a apresentação): a regra de fatura fica em um único lugar testável, e alterar o dia de fechamento do cartão recalcula tudo automaticamente.
- Consequência: filtros e relatórios por período (RF6, RF7, RF8) usam a data da compra — uma compra parcelada aparece inteira no mês em que foi feita. Só o RF9 distribui as parcelas pelas faturas futuras. Documentar no README.

**Padrões ao cadastrar usuário** (na mesma transação do cadastro):
- Categorias de saída: Alimentação, Moradia, Saúde, Mobilidade, Lazer, Educação, Outros.
- Categorias de entrada: Salário, Outros.
- Fontes/destinos: Conta corrente (`conta`), Salário (`renda`).

---

## 4. API

### 4.1 Convenções

- Prefixo `/api`; todas as rotas exigem token, exceto `POST /auth/cadastro` e `POST /auth/login`.
- Formato único de erro: `{ "erro": "mensagem", "campos": { "campo": "mensagem" } }` (`campos` opcional).
- Status: `200` leitura/edição, `201` criação, `204` exclusão, `400` dados inválidos, `401` sem token/token inválido/credenciais inválidas, `404` registro inexistente **para este usuário**, `409` duplicado ou com vínculo, `429` excesso de tentativas, `500` erro inesperado (sem stack na resposta).
- Datas trafegam como `AAAA-MM-DD`; valores como número com 2 casas (ex.: `33.34`).
- Camelcase no JSON (`categoriaId`, `fonteDestinoId`, `totalParcelas`); snake_case no banco. A conversão acontece nos models.

### 4.2 Middlewares

- `autenticar`: valida `Authorization: Bearer <token>`, coloca `req.usuarioId` (vindo de `payload.sub`). Ausente/inválido/expirado → 401.
- `validar(regras)`: valida e normaliza `req.body`/`req.query`; junta **todos** os erros em `campos` e responde 400. Escrito à mão, sem biblioteca.
- `limitadores`: `express-rate-limit`.
  - Login: `LOGIN_MAX_TENTATIVAS` (padrão 5) por `LOGIN_JANELA_MIN` (padrão 15) minutos por IP, `skipSuccessfulRequests: true`; resposta 429 no formato padrão com `Retry-After`.
  - Cadastro: 10 por hora por IP.
- `erros`: middleware final; traduz `23505` → 409 (campo pelo nome da constraint), `23503` → 409 ("possui lançamentos vinculados"), demais → 500 com log no console.

### 4.3 Rotas

| Método | Rota | Regras principais |
|---|---|---|
| POST | `/auth/cadastro` | Campos obrigatórios; e-mail válido; `cpfValido`; senha ≥ 8 com letra e número; `senha === confirmacaoSenha`; bcrypt (custo 10); usuário + padrões em **transação**; 409 com `campos.email` ou `campos.cpf`. Resposta 201 sem `senha_hash`. |
| POST | `/auth/login` | 401 genérico "E-mail ou senha inválidos."; resposta `{ token, usuario }`; JWT `{ sub: id }`, expiração `JWT_EXPIRA` (padrão `1h`). |
| GET | `/auth/me` | Dados do usuário do token. |
| GET/POST | `/categorias` | Lista ordenada por tipo e nome. Criar: nome e tipo obrigatórios; 409 se duplicado. |
| PUT/DELETE | `/categorias/:id` | 404 se não for do usuário; 409 se duplicado; DELETE com lançamentos → 409. Mudar o `tipo` de categoria com lançamentos → 409. |
| GET/POST | `/fontes-destinos` | Se `cartao_credito`: `diaFechamento`, `diaVencimento` (1–31) e `limite` (> 0) obrigatórios (400). Se não for cartão, esses campos são gravados como `NULL`. |
| PUT/DELETE | `/fontes-destinos/:id` | Mesmas regras; DELETE com lançamentos → 409. |
| GET | `/lancamentos` | Filtros `inicio`, `fim` (padrão: mês corrente), `tipo`, `categoriaId`, `fonteDestinoId`, `pagina` (20 por página). Resposta `{ itens, pagina, totalPaginas, totalItens, totais: { entradas, saidas, saldo } }`; totais via `SUM` sobre o filtro inteiro. Ordenação: data desc, id desc. |
| POST | `/lancamentos` | Ver 4.4. |
| GET | `/lancamentos/:id` | 404 se não for do usuário. |
| PUT | `/lancamentos/:id` | Mesmas validações do POST. Em lançamento parcelado (`totalParcelas > 1`): só `descricao`, `categoriaId` e `valor` podem mudar; alterar `data`, `fonteDestinoId`, `tipo` ou `totalParcelas` → 400 ("exclua a compra e lance novamente"). |
| DELETE | `/lancamentos/:id` | `?todasParcelas=true` exclui todo o `grupo_parcelamento` (do mesmo usuário). |
| GET | `/relatorios/categorias` | Ver 4.5. |
| GET | `/relatorios/fontes-destinos` | Ver 4.5. |
| GET | `/relatorios/faturas?meses=3` | Ver 4.6. |
| GET | `/saude-financeira` | Ver 4.7. |

**Isolamento (RF3):** toda função de model recebe `usuarioId` como primeiro parâmetro e filtra `WHERE usuario_id = $1`. O id nunca vem do corpo ou da URL. Categoria/fonte de outro usuário em um lançamento → 404.

### 4.4 Criação de lançamento

1. Validar: `tipo` ∈ {entrada, saida}; `descricao` 1–120; `valor` > 0 com até 2 casas; `data` válida; `categoriaId` e `fonteDestinoId` obrigatórios; `totalParcelas` inteiro 1–48 (padrão 1).
2. Buscar categoria e fonte/destino **do usuário** (senão 404).
3. Tipo da categoria ≠ tipo do lançamento → 400 em `campos.categoriaId`.
4. `totalParcelas > 1` exige `tipo = saida` e destino `cartao_credito` (senão 400).
5. `dividirEmParcelas(centavos, n)`: base = `floor(centavos / n)`, a 1ª parcela recebe o resto. R$ 100,00 em 3× → 33,34 + 33,33 + 33,33.
6. Gravar as N parcelas com o mesmo `grupo_parcelamento` (`crypto.randomUUID()`), `parcela_atual` 1..N, mesma `data`, dentro de `emTransacao`. Lançamento à vista: `grupo_parcelamento = NULL`.
7. Resposta 201 com a lista de lançamentos criados.

### 4.5 Relatórios (RF7, RF8)

- Parâmetros `inicio` e `fim` obrigatórios (400 se inválidos ou `inicio > fim`).
- Agregação no banco (`GROUP BY`, `SUM`), filtrando sempre por `usuario_id`.
- **Período anterior** (`config/datas.js → periodoAnterior`): se `inicio` é dia 1 e `fim` é o último dia de um mês, compara com o mesmo número de meses inteiros imediatamente anteriores (outubro → setembro; out–dez → jul–set); senão, desloca o mesmo número de dias para trás.
- **RF7** resposta: `{ periodo, periodoAnterior, totalSaidas, totalEntradas, saidas: [{ id, nome, total, percentual, totalAnterior, variacao }], entradas: [{ id, nome, total }] }`, saídas ordenadas por total desc; `percentual` com 2 casas; `variacao` = `total - totalAnterior`. Categorias com valor só no período anterior também aparecem (total 0).
- **RF8** resposta: `{ periodo, entradasPorFonte: [...], saidasPorDestino: [...], saldoContas: [{ id, nome, entradas, saidas, saldo }] }` — `saldoContas` só para `tipo = conta`.

### 4.6 Faturas (RF9)

`calcularFatura(data, { diaFechamento, diaVencimento }, parcela)` conforme a implementação de referência do enunciado (UTC, ajuste de dia inexistente para o último dia do mês). Testada com as 4 linhas da tabela de exemplos do enunciado.

Para cada cartão do usuário:
1. Buscar todos os lançamentos de saída do cartão.
2. Calcular a fatura de cada um e agrupar por `referencia` (AAAA-MM).
3. **Fatura atual** = a primeira com `fechamento > hoje` (no dia do fechamento ela já fechou). Devolver a atual + as próximas `meses` (padrão 3, máximo 12), **incluindo faturas vazias** (total 0).
4. Cada fatura: `{ referencia, fechamento, vencimento, total, itens: [{ id, descricao, parcela: "3/10", valor, dataCompra }] }`.
5. `limiteUtilizado` = soma das parcelas com `vencimento >= hoje`; `limiteDisponivel` = `limite - limiteUtilizado` (pode ser negativo; o front destaca).

"Hoje" é obtido por uma função injetável (`hoje()` em `config/datas.js`) para permitir testes com data fixa.

### 4.7 Saúde financeira (desafio)

`GET /saude-financeira` — tudo calculado no back-end, com base nos últimos 3 meses completos + parcelas futuras conhecidas:

| Indicador | Cálculo | Regra da dica |
|---|---|---|
| Taxa de poupança | (entradas − saídas) ÷ entradas, por mês | < 10% → alerta; ≥ 20% → elogio |
| Comprometimento com cartões | soma das próximas 3 faturas ÷ (renda média mensal × 3) | > 30% → alerta |
| Parcelas futuras | soma das parcelas a vencer, por mês | > 0 → informa total e último mês |
| Categoria fora da curva | gasto do mês atual na categoria ÷ média dos 3 meses anteriores | > 30% acima → alerta |
| Reserva de emergência | saldo das fontes com `reserva = true` ÷ média de saídas mensais | < 3 meses → alerta; ≥ 6 → elogio |

- Projeção de saldo para os próximos 6 meses: média de entradas e saídas dos últimos 3 meses + parcelas futuras conhecidas; alerta se algum mês ficar negativo.
- Os limites ficam em constantes no model e documentados no README.
- Resposta inclui `aviso: "Conteúdo educativo; não constitui recomendação financeira profissional."`, exibido na tela.
- Sem API de modelo de linguagem.

### 4.8 Variáveis de ambiente (`backend/.env.example`)

```
PORT=3000
DATABASE_URL=postgres://financas:financas@localhost:5432/financas
JWT_SECRET=troque-este-segredo
JWT_EXPIRA=1h
CORS_ORIGEM=http://localhost:5173
LOGIN_MAX_TENTATIVAS=5
LOGIN_JANELA_MIN=15
```

---

## 5. Front-end

- **Rotas:** `/login`, `/cadastro` (públicas); `/` (Dashboard), `/lancamentos`, `/categorias`, `/fontes-destinos`, `/relatorios`, `/faturas`, `/saude-financeira` (dentro de `<RotaProtegida>` + `<Layout>`).
- **AuthContext:** `usuario`, `token`, `carregando`, `login`, `logout`, `cadastrar`. Token em `localStorage`; ao abrir o app com token salvo, valida com `GET /auth/me`.
- **services/api.js:** instância axios com `baseURL = import.meta.env.VITE_API_URL`; interceptor de requisição injeta `Bearer`; interceptor de resposta em 401 (exceto na própria rota de login) executa logout e navega para `/login` sem exibir erro.
- **Formulários:** validação no cliente antes do envio + exibição de `campos` do servidor sob cada campo (`CampoTexto` recebe `erro`). Máscaras de CPF e moeda. Mensagem 429 exibida no login.
- **Estados:** toda tela que consome a API usa `useApi` e trata carregando, lista vazia e erro.
- **Formatação:** `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`; datas `dd/mm/aaaa`.
- **Telas:**
  - Dashboard: totais do mês (entradas, saídas, saldo), últimas movimentações, próxima fatura de cada cartão.
  - Lançamentos: filtros, tabela paginada, totais, formulário (categoria filtrada pelo tipo; campo parcelas só para destino cartão), exclusão com confirmação e escolha "só esta / todas as parcelas".
  - Categorias e Fontes/destinos: lista + formulário (campos de cartão só quando o tipo é cartão; checkbox "reserva").
  - Relatórios: seletor de período; abas Categoria (pizza de saídas + barras atual × anterior + tabela) e Fonte/destino (barras + tabelas).
  - Faturas: por cartão, limite utilizado/disponível e cartões das faturas com itens.
  - Saúde financeira: indicadores, dicas, gráfico de linha da projeção, aviso educativo.

---

## 6. Banco: scripts e seed

- `npm run db:criar` → executa `schema.sql` (recria as tabelas).
- `npm run db:seed` → executa `seed.sql`.
- Seed: 2 usuários (senha conhecida, documentada no README) com categorias/fontes padrão, 2 cartões cada um (dias de fechamento diferentes, um com fechamento < vencimento e outro com fechamento > vencimento), uma conta marcada como reserva, e **3 meses** de lançamentos relativos à data atual (entradas de salário, saídas variadas, pelo menos 2 compras parceladas e uma compra feita exatamente no dia do fechamento). Hashes bcrypt gerados previamente e gravados no SQL.

---

## 7. Testes (`backend/test`, `npm test` → `node --test`)

- **Unitários:** `cpfValido` (válidos, dígito errado, repetidos, com máscara); `dividirEmParcelas` (100,00/3, 0,01/1, 10,00/48, soma sempre exata); `calcularFatura` (as 4 linhas da tabela do enunciado + fechamento dia 31 em fevereiro); `periodoAnterior` (mês inteiro, vários meses, intervalo arbitrário).
- **API** (contra um banco de teste, `DATABASE_URL` de teste): cadastro duplicado por e-mail com maiúsculas e por CPF com pontuação → 409 com o campo certo; resposta nunca contém `senha_hash`; sem token → 401; usuário A não lê/edita/exclui lançamento de B → 404; saída com categoria de entrada → 400; parcelado 100/3 soma 100,00.

---

## 8. Fluxo de trabalho e divisão

- `main` protegida; uma branch por PR (`feat/<nome>`); o outro integrante revisa antes do merge; commits pequenos em português (`feat:`, `fix:`, `docs:`, `test:`).

| # | PR | Responsável | Depende de |
|---|---|---|---|
| 0 | Fundação: estrutura, docker-compose, `schema.sql`, `executar.js`, `db.js`, `env.js`, middleware de erros, `server.js`, Vite + rotas vazias, `api.js`, `AuthContext` vazio, README inicial, `.gitignore`, `.env.example` | Gabriel | — |
| 1 | Autenticação: cadastro, login, `/me`, `autenticar`, `validar`, limitadores, telas Login/Cadastro, `AuthContext`, `RotaProtegida`, Layout | Gabriel | 0 |
| 2 | Categorias + fontes/destinos (API + telas) | Gabriel | 1 |
| 3 | Lançamentos: CRUD, filtros, paginação, totais, parcelamento (API + tela) | Colega | 2 (pode começar models/funções puras após o 0) |
| 4 | Seed de demonstração | Colega | 3 |
| 5 | Relatório por categoria (RF7) + Dashboard | Colega | 3 |
| 6 | Relatório por fonte/destino (RF8) + Faturas (RF9) | Gabriel | 3 |
| 7 | Saúde financeira (desafio) | Colega | 5, 6 |
| 8 | Acabamento: testes de API/isolamento, checklist final, README final, ensaio da apresentação | Ambos | todos |

Cada integrante apresenta e explica os próprios PRs.

---

## 9. README (conteúdo obrigatório)

Tecnologias; pré-requisitos; subir o Postgres (Docker ou local); configurar `.env` (back e front); `npm run db:criar` e `npm run db:seed`; subir back-end e front-end; usuários do seed; lista de rotas; decisões de projeto (utilitários em `config/`, data da compra nas parcelas, edição de parcelas, período anterior, limites do rate limit e das dicas de saúde financeira); divisão do trabalho por integrante; uso de ferramentas de IA.

---

## 10. Rastreabilidade com o enunciado

| Enunciado | Onde está atendido |
|---|---|
| RF1, RF2 | 4.2, 4.3 (auth), 5 (AuthContext, telas) |
| RF3 | 4.3 (isolamento), 7 (testes) |
| RF4, RF5 | 4.3, 3 (constraints) |
| RF6 | 4.3, 4.4, 5 |
| RF7, RF8 | 4.5, 5 |
| RF9 | 4.6, 5 |
| Desafio | 4.7, 5 |
| RNF segurança | 4.2, 4.8, `.gitignore` |
| RNF integridade/banco | 3, 4.4 (transação), 6 |
| RNF organização | 2 |
| RNF versionamento/documentação | 8, 9 |
| Roteiro de apresentação e checklist final | 6 (seed), 7 (testes), 8 (PR 8) |
