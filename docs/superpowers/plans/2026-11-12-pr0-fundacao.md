# PR 0 — Fundação: Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o repositório com back-end Express conectado ao PostgreSQL (schema completo), tratamento de erros padronizado, e front-end Vite/React com roteamento, cliente HTTP único e `AuthContext` base — tudo pronto para os PRs 1–8 só acrescentarem funcionalidades.

**Architecture:** `backend/src/server.js` exporta `criarApp()` (testável) e só escuta a porta quando executado diretamente. Configuração em `config/env.js`, banco em `config/db.js` (Pool + `emTransacao`), erros em `middlewares/erros.js` (classe `ErroApi` + middleware final). O front tem um único ponto de acesso à API (`services/api.js`) que o `AuthContext` configura com o token e a ação de logout.

**Tech Stack:** Node.js ≥ 22 (ESM), Express, `pg`, `dotenv`, `cors`, `node:test`; PostgreSQL 16 (Docker); React + Vite, `react-router-dom`, `axios`.

**Spec:** `docs/superpowers/specs/2026-11-12-controle-financeiro-design.md`

**Responsável:** Gabriel — branch `feat/fundacao`.

## Global Constraints

- `backend/src/` contém **somente** `server.js`, `config/`, `models/`, `middlewares/`, `routes/`. Nenhuma outra pasta ou arquivo.
- `frontend/src/` contém somente `main.jsx`, `App.jsx`, `index.css` e as pastas `components/`, `contexts/`, `services/`.
- Dependências permitidas neste PR — back: `express`, `pg`, `dotenv`, `cors`; front: `react-router-dom`, `axios` (+ o que o template do Vite já traz). Nada além disso.
- `"type": "module"` no `backend/package.json`; Node ≥ 22 (`"engines": { "node": ">=22" }`) — necessário para o glob em `node --test`.
- Scripts npm precisam funcionar no Windows: nada de `VAR=valor comando`, `rm`, ou `.sh`.
- `.env` nunca vai para o Git; `.env.example` sim (em `backend/` e `frontend/`).
- Formato único de erro: `{ "erro": string, "campos"?: { [campo]: string } }`; resposta de erro nunca contém `stack`.
- Textos para o usuário em português.
- Commits pequenos em português (`feat:`, `chore:`, `test:`, `docs:`), autor Gabriel.

## Review Focus

- JSON malformado no corpo (`{`) deve dar **400** "JSON inválido no corpo da requisição.", não 500 → teste na Task 3.
- Id não numérico vindo do Postgres como erro `22P02` (ex.: `/api/categorias/abc` em PRs futuros) deve dar **400**, não 500 → teste na Task 3.
- Subir o servidor sem `.env` (ou sem `JWT_SECRET`) deve falhar na hora com mensagem que diga **quais** variáveis faltam e como resolver → teste na Task 1.
- Coluna `DATE` não pode virar `Date` com fuso (o `pg` faria `2026-11-03` virar `2026-11-02T03:00Z`); deve voltar como string `'2026-11-03'` → teste na Task 2.
- `emTransacao` com erro no meio deve desfazer tudo **e** devolver a conexão ao pool (senão o pool esgota após 10 falhas) → teste na Task 2.

---

### Task 1: Esqueleto do back-end e configuração de ambiente

**Files:**
- Create: `.gitignore`, `backend/package.json`, `backend/.env.example`, `backend/src/config/env.js`
- Test: `backend/test/config/env.test.js`, `backend/test/ajudantes/ambiente.js`

**Interfaces:**
- Produces: `carregarConfig(env: object) -> Config` e `config: Config` em `src/config/env.js`, onde
  `Config = { porta: number, databaseUrl: string, jwtSecret: string, jwtExpira: string, corsOrigem: string, loginMaxTentativas: number, loginJanelaMin: number }`.
- Produces: `test/ajudantes/ambiente.js` — importado **como primeiro import** de todo teste que toca banco/servidor; define `process.env.NODE_ENV = 'test'` (o `.env` é carregado pelo próprio `env.js`; `dotenv` não sobrescreve variáveis já definidas).

- [ ] **Step 1: Criar `.gitignore` na raiz** com `node_modules/`, `.env`, `dist/`, `coverage/`, `*.log`.

- [ ] **Step 2: Criar `backend/package.json`** (`npm init -y`, depois ajustar) com `"type": "module"`, `"engines": { "node": ">=22" }` e scripts:

```json
{
  "dev": "node --watch src/server.js",
  "start": "node src/server.js",
  "test": "node --test \"test/**/*.test.js\"",
  "db:criar": "node database/executar.js database/schema.sql",
  "db:teste": "node database/executar.js database/schema.sql --teste"
}
```

Instalar: `npm install express pg dotenv cors`.

- [ ] **Step 3: Criar `backend/.env.example`**

```
PORT=3000
DATABASE_URL=postgres://financas:financas@localhost:5432/financas
DATABASE_URL_TESTE=postgres://financas:financas@localhost:5432/financas_teste
JWT_SECRET=troque-este-segredo
JWT_EXPIRA=1h
CORS_ORIGEM=http://localhost:5173
LOGIN_MAX_TENTATIVAS=5
LOGIN_JANELA_MIN=15
```

- [ ] **Step 4: Escrever o teste que falha** — `backend/test/config/env.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregarConfig } from '../../src/config/env.js';

const base = { DATABASE_URL: 'postgres://a', JWT_SECRET: 's', CORS_ORIGEM: 'http://localhost:5173' };

test('aplica valores padrão', () => {
  const c = carregarConfig(base);
  assert.equal(c.porta, 3000);
  assert.equal(c.jwtExpira, '1h');
  assert.equal(c.loginMaxTentativas, 5);
  assert.equal(c.loginJanelaMin, 15);
  assert.equal(c.databaseUrl, 'postgres://a');
});

test('lista todas as variáveis obrigatórias ausentes', () => {
  assert.throws(() => carregarConfig({}), /DATABASE_URL, JWT_SECRET, CORS_ORIGEM.*\.env\.example/s);
});

test('em NODE_ENV=test usa DATABASE_URL_TESTE e a exige', () => {
  assert.equal(carregarConfig({ ...base, NODE_ENV: 'test', DATABASE_URL_TESTE: 'postgres://t' }).databaseUrl, 'postgres://t');
  assert.throws(() => carregarConfig({ ...base, NODE_ENV: 'test' }), /DATABASE_URL_TESTE/);
});
```

- [ ] **Step 5: Rodar e ver falhar** — `cd backend && npm test` → FAIL (`Cannot find module .../src/config/env.js`).

- [ ] **Step 6: Implementar `src/config/env.js`** — `import 'dotenv/config'`; `carregarConfig(env)` monta o objeto acima (números com `Number(...)`), junta os nomes ausentes e lança `Error('Variáveis de ambiente ausentes: X, Y. Copie backend/.env.example para backend/.env e preencha.')`; `export const config = carregarConfig(process.env)`.

- [ ] **Step 7: Criar `test/ajudantes/ambiente.js`** — uma linha: `process.env.NODE_ENV = 'test';`. Ele não termina em `.test.js`, então o `npm test` não o executa como teste.

- [ ] **Step 8: Rodar** — `npm test` → 3 testes PASS.

- [ ] **Step 9: Commit**

```bash
git add .gitignore backend/package.json backend/package-lock.json backend/.env.example backend/src/config/env.js backend/test
git commit -m "chore: esqueleto do back-end e configuração por .env"
```

---

### Task 2: Banco — Docker, schema, execução de SQL e pool

**Files:**
- Create: `backend/docker-compose.yml`, `backend/database/docker-init.sql`, `backend/database/schema.sql`, `backend/database/executar.js`, `backend/src/config/db.js`
- Test: `backend/test/config/db.test.js`

**Interfaces:**
- Consumes: `config.databaseUrl` (Task 1).
- Produces (`src/config/db.js`): `pool: pg.Pool`; `consultar(sql: string, params?: any[]) -> Promise<pg.QueryResult>`; `emTransacao<T>(fn: (cliente: pg.PoolClient) => Promise<T>) -> Promise<T>` (BEGIN/COMMIT, ROLLBACK + relança em erro, `release()` sempre).
- Produces (`database/executar.js`): `executarSql(caminhoArquivo: string) -> Promise<void>` (exportada; obtém o `pool` com `await import('../src/config/db.js')` **dentro** da função — import estático carregaria a config antes de o `--teste` definir `NODE_ENV`; quando rodado como CLI: `node database/executar.js <arquivo.sql> [--teste]`, com `--teste` definindo `NODE_ENV=test` **antes** de importar a config via `import()` dinâmico, imprime "OK: <arquivo>" e encerra o pool).
- Convenção que todos os models seguirão: `DATE` volta como string `AAAA-MM-DD`; `NUMERIC` volta como string (models convertem).

- [ ] **Step 1: Criar `backend/docker-compose.yml`** — serviço `banco`, imagem `postgres:16`, `POSTGRES_USER/PASSWORD/DB = financas/financas/financas`, porta `5432:5432`, volume nomeado `dados_financas`, e `./database/docker-init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro`.

- [ ] **Step 2: Criar `database/docker-init.sql`** com `CREATE DATABASE financas_teste;` (roda só na primeira subida do volume).

- [ ] **Step 3: Criar `database/schema.sql`** (idempotente: começa com `DROP TABLE IF EXISTS lancamentos, fontes_destinos, categorias, usuarios CASCADE;`). Conteúdo fixado pela spec §3:

```sql
CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL,
  cpf         CHAR(11)     NOT NULL,
  senha_hash  VARCHAR(100) NOT NULL,
  criado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT usuarios_email_unico UNIQUE (email),
  CONSTRAINT usuarios_cpf_unico   UNIQUE (cpf)
);

CREATE TABLE categorias (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        VARCHAR(60) NOT NULL,
  tipo        VARCHAR(7)  NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  CONSTRAINT categorias_nome_unico UNIQUE (usuario_id, nome, tipo)
);

CREATE TABLE fontes_destinos (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome            VARCHAR(60) NOT NULL,
  tipo            VARCHAR(14) NOT NULL CHECK (tipo IN ('renda', 'conta', 'cartao_credito')),
  dia_fechamento  SMALLINT CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento  SMALLINT CHECK (dia_vencimento BETWEEN 1 AND 31),
  limite          NUMERIC(12, 2) CHECK (limite IS NULL OR limite > 0),
  reserva         BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fontes_destinos_nome_unico UNIQUE (usuario_id, nome),
  CHECK (tipo <> 'cartao_credito'
         OR (dia_fechamento IS NOT NULL AND dia_vencimento IS NOT NULL AND limite IS NOT NULL))
);

CREATE TABLE lancamentos (
  id                  SERIAL PRIMARY KEY,
  usuario_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo                VARCHAR(7)     NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao           VARCHAR(120)   NOT NULL,
  valor               NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data                DATE           NOT NULL,
  categoria_id        INTEGER NOT NULL REFERENCES categorias(id),
  fonte_destino_id    INTEGER NOT NULL REFERENCES fontes_destinos(id),
  parcela_atual       SMALLINT NOT NULL DEFAULT 1,
  total_parcelas      SMALLINT NOT NULL DEFAULT 1 CHECK (total_parcelas BETWEEN 1 AND 48),
  grupo_parcelamento  UUID,
  criado_em           TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (parcela_atual BETWEEN 1 AND total_parcelas)
);

CREATE INDEX idx_lancamentos_usuario_data ON lancamentos (usuario_id, data);
CREATE INDEX idx_lancamentos_grupo        ON lancamentos (grupo_parcelamento);
```

Observação: a exclusão de usuário em cascata apaga lançamentos antes de categorias/fontes porque todas as FKs para `usuarios` são `ON DELETE CASCADE` e o Postgres resolve a ordem.

- [ ] **Step 4: Escrever o teste que falha** — `test/config/db.test.js` (primeiro import: `../ajudantes/ambiente.js`). `before`: `executarSql('database/schema.sql')` (caminho relativo a `backend/`). `after`: `pool.end()`. Helper local `inserirUsuario(email, cpf)`. Testes:
  - `'email duplicado viola usuarios_email_unico'` → `assert.rejects(..., { code: '23505', constraint: 'usuarios_email_unico' })`
  - `'cpf duplicado viola usuarios_cpf_unico'` → idem com `'usuarios_cpf_unico'`
  - `'cartão sem limite viola CHECK'` → `{ code: '23514' }`
  - `'lançamento com valor 0 viola CHECK'` → `{ code: '23514' }`
  - `'excluir categoria com lançamento viola FK'` → `{ code: '23503' }`
  - `'excluir usuário apaga os dados dele em cascata'` → depois do `DELETE`, `SELECT count(*)` em `lancamentos` do usuário = `0`
  - `'DATE volta como string AAAA-MM-DD'` → `SELECT DATE '2026-11-03' AS d` → `rows[0].d === '2026-11-03'`
  - `'emTransacao desfaz tudo e libera a conexão em erro'` → 12 vezes seguidas: `emTransacao` insere um usuário e lança `new Error('falha')`; `assert.rejects(..., /falha/)`; ao final `count(*)` de usuários com aquele e-mail = 0 e `pool.totalCount <= 10` e `pool.waitingCount === 0`
  - `'emTransacao confirma e devolve o retorno'` → retorna o `id` inserido e a linha existe
  - `'schema.sql pode ser executado duas vezes'` → `await executarSql('database/schema.sql')` não lança

- [ ] **Step 5: Rodar e ver falhar** — `npm test` → FAIL (módulos não existem).

- [ ] **Step 6: Implementar `src/config/db.js`** — antes de criar o pool: `pg.types.setTypeParser(1082, (v) => v)` (DATE como string). `new pg.Pool({ connectionString: config.databaseUrl })`. `emTransacao` com `pool.connect()`, `BEGIN`, `await fn(cliente)`, `COMMIT`; em erro `ROLLBACK` e relança; `finally` → `cliente.release()`.

- [ ] **Step 7: Implementar `database/executar.js`** — `executarSql` lê o arquivo (`fs/promises`, caminho resolvido a partir de `process.cwd()`) e faz um único `pool.query(conteudo)`. Bloco CLI só quando `import.meta.url === pathToFileURL(process.argv[1]).href`.

- [ ] **Step 8: Subir o banco e preparar o banco de teste**

Run: `docker compose up -d` (dentro de `backend/`), copiar `.env.example` para `.env`, depois `npm run db:criar` e `npm run db:teste`.
Expected: duas linhas `OK: database/schema.sql`.

- [ ] **Step 9: Rodar** — `npm test` → todos PASS (Task 1 + Task 2).

- [ ] **Step 10: Commit**

```bash
git add backend/docker-compose.yml backend/database backend/src/config/db.js backend/test/config/db.test.js
git commit -m "feat: schema do banco, pool de conexões e transações"
```

---

### Task 3: Servidor Express e tratamento de erros centralizado

**Files:**
- Create: `backend/src/middlewares/erros.js`, `backend/src/server.js`
- Test: `backend/test/middlewares/erros.test.js`, `backend/test/server.test.js`

**Interfaces:**
- Consumes: `config` (Task 1).
- Produces (`middlewares/erros.js`):
  - `class ErroApi extends Error` — `constructor(status: number, mensagem: string, campos?: object)`; propriedades `status`, `campos`. Todas as rotas futuras lançam/`next()` com ela.
  - `rotaNaoEncontrada(req, res)` → 404 `{ erro: 'Rota não encontrada.' }`.
  - `tratarErros(err, req, res, next)` — middleware final.
- Produces (`server.js`): `criarApp() -> express.Application` (cors restrito a `config.corsOrigem`, `express.json()`, `GET /api/status` → `200 { status: 'ok' }`, ponto marcado `// rotas dos próximos PRs` onde os routers serão montados, depois `rotaNaoEncontrada` e `tratarErros`). Quando executado diretamente: `criarApp().listen(config.porta)` e log `API ouvindo em http://localhost:<porta>`.

Mapeamento fixado de `tratarErros` (mensagens exatas):

| Entrada | Status | Corpo |
|---|---|---|
| `ErroApi` | `err.status` | `{ erro: err.message, campos? }` (sem `campos` se não houver) |
| `err.type === 'entity.parse.failed'` | 400 | `{ erro: 'JSON inválido no corpo da requisição.' }` |
| `code '23505'` + constraint conhecida | 409 | ver tabela abaixo |
| `code '23505'` + constraint desconhecida | 409 | `{ erro: 'Registro duplicado.' }` |
| `code '23503'` | 409 | `{ erro: 'Não é possível excluir: existem lançamentos vinculados.' }` |
| `code '22P02'` | 400 | `{ erro: 'Parâmetro inválido.' }` |
| qualquer outro | 500 | `{ erro: 'Erro interno do servidor.' }` + `console.error(err)` |

| Constraint | `erro` | `campos` |
|---|---|---|
| `usuarios_email_unico` | `Usuário já cadastrado.` | `{ email: 'Já existe um usuário com este e-mail.' }` |
| `usuarios_cpf_unico` | `Usuário já cadastrado.` | `{ cpf: 'Já existe um usuário com este CPF.' }` |
| `categorias_nome_unico` | `Registro duplicado.` | `{ nome: 'Já existe uma categoria com este nome e tipo.' }` |
| `fontes_destinos_nome_unico` | `Registro duplicado.` | `{ nome: 'Já existe uma fonte/destino com este nome.' }` |

- [ ] **Step 1: Escrever os testes que falham — `test/middlewares/erros.test.js`** (sem banco). Helper `resFalso()` que grava `statusCode` e `body` (`status(c){...; return this}`, `json(b){...}`). Um teste por linha das duas tabelas acima, mais `'resposta 500 não contém stack'` (`assert.equal('stack' in res.body, false)`). Silenciar `console.error` no teste do 500 com `t.mock.method(console, 'error', () => {})`.

- [ ] **Step 2: Escrever os testes que falham — `test/server.test.js`** (primeiro import: `./ajudantes/ambiente.js`). `before`: `servidor = criarApp().listen(0)`; base `http://localhost:${servidor.address().port}`; `after`: `servidor.close()`. Com `fetch`:
  - `'GET /api/status responde 200'` → `{ status: 'ok' }`
  - `'rota inexistente responde 404 padrão'` → `GET /api/nao-existe` → 404, `{ erro: 'Rota não encontrada.' }`
  - `'JSON malformado responde 400'` → `POST /api/status`, `content-type: application/json`, corpo `'{'` → 400, `{ erro: 'JSON inválido no corpo da requisição.' }`
  - `'CORS libera só a origem configurada'` → com `Origin: http://localhost:5173` o cabeçalho `access-control-allow-origin` é `http://localhost:5173`; com `Origin: http://malicioso.com` o cabeçalho é `null`

- [ ] **Step 3: Rodar e ver falhar** — `npm test` → FAIL (módulos não existem).

- [ ] **Step 4: Implementar `middlewares/erros.js`** conforme as tabelas (mapa `constraint → { erro, campos }` como objeto constante).

- [ ] **Step 5: Implementar `server.js`** conforme a interface. Detecção de execução direta igual à de `executar.js`.

- [ ] **Step 6: Rodar** — `npm test` → todos PASS.

- [ ] **Step 7: Verificar manualmente** — `npm run dev`; em outro terminal `curl http://localhost:3000/api/status` → `{"status":"ok"}`.

- [ ] **Step 8: Commit**

```bash
git add backend/src/server.js backend/src/middlewares/erros.js backend/test
git commit -m "feat: servidor Express com CORS e tratamento de erros padronizado"
```

---

### Task 4: Front-end — Vite, rotas, cliente HTTP e AuthContext base

**Files:**
- Create: `frontend/` (template Vite React), `frontend/.env.example`, `frontend/src/services/api.js`, `frontend/src/contexts/AuthContext.jsx`, `frontend/src/components/paginas/EmConstrucao.jsx`
- Modify: `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/src/index.css`
- Delete: `frontend/src/App.css`, `frontend/src/assets/`, `frontend/public/vite.svg` e seus imports

**Interfaces:**
- Produces (`services/api.js`):
  - `api` — instância axios, `baseURL: import.meta.env.VITE_API_URL`.
  - `configurarSessao({ obterToken: () => string|null, aoExpirar: () => void }) -> void` — o `AuthContext` chama uma vez; o interceptor de requisição usa `obterToken()` para pôr `Authorization: Bearer <token>`; o de resposta chama `aoExpirar()` em **401**, exceto quando a URL da requisição é `/auth/login`, e sempre rejeita a promise.
  - `extrairErro(erro) -> { mensagem: string, campos: object }` — de `erro.response.data` (`erro`, `campos`); sem resposta (servidor fora do ar) → `{ mensagem: 'Não foi possível conectar ao servidor.', campos: {} }`; resposta sem `erro` → `{ mensagem: 'Erro inesperado.', campos: {} }`.
- Produces (`contexts/AuthContext.jsx`): `AuthProvider` e `useAuth() -> { usuario, token, logout }`. Token persistido em `localStorage` na chave `'financas.token'`, usuário em `'financas.usuario'` (JSON; JSON inválido → trata como deslogado). `logout()` limpa as duas chaves e o estado. No mount chama `configurarSessao({ obterToken: () => tokenAtual, aoExpirar: logout })`. O PR 1 acrescenta `login`, `cadastrar`, `carregando` e a validação via `/auth/me`.
- Produces (`App.jsx`): `BrowserRouter` (em `main.jsx`, envolvendo `AuthProvider`), rotas `/login`, `/cadastro`, `/` e `*` (`*` redireciona para `/`), todas renderizando `<EmConstrucao titulo="..."/>` por enquanto.

- [ ] **Step 1: Criar o projeto** — na raiz: `npm create vite@latest frontend -- --template react`; `cd frontend && npm install && npm install react-router-dom axios`. Remover os arquivos listados em *Delete* e seus imports; `index.css` reduzido a um reset simples (`box-sizing`, `margin: 0`, fonte do sistema).

- [ ] **Step 2: Criar `frontend/.env.example`** com `VITE_API_URL=http://localhost:3000/api` e copiar para `.env`.

- [ ] **Step 3: Implementar `services/api.js`, `contexts/AuthContext.jsx`, `components/paginas/EmConstrucao.jsx`, `App.jsx`, `main.jsx`** conforme as interfaces.

- [ ] **Step 4: Verificar build e lint**

Run: `npm run build && npm run lint`
Expected: build conclui sem erros; lint sem erros.

- [ ] **Step 5: Verificar no navegador** — com o back-end rodando, `npm run dev`; abrir `http://localhost:5173/qualquer-coisa` → redireciona para `/` e mostra o título da página em construção. No console do navegador, colar `localStorage.setItem('financas.usuario', '{quebrado')` e recarregar → a página continua abrindo (sem tela branca).

- [ ] **Step 6: Conferir a estrutura** — `ls frontend/src` mostra apenas `App.jsx  components  contexts  index.css  main.jsx  services`.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "feat: front-end com Vite, rotas, cliente HTTP único e AuthContext base"
```

---

### Task 5: README inicial, verificação do zero e PR

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: scripts e `.env.example` das Tasks 1–4.

- [ ] **Step 1: Escrever o `README.md`** com as seções: Sobre; Tecnologias (spec §1); Pré-requisitos (Node 22+, Docker Desktop **ou** PostgreSQL 16 instalado — neste caso criar os bancos `financas` e `financas_teste` e ajustar as URLs no `.env`); Como rodar (passo a passo: `docker compose up -d`, copiar os dois `.env.example`, `npm install` nos dois lados, `npm run db:criar`, `npm run db:teste`, `npm test`, `npm run dev` no back e no front); Estrutura de pastas (spec §2) e a decisão "utilitários puros em `backend/src/config/`; `formatar.js` e `useApi.js` em `frontend/src/services/`"; Rotas da API (por enquanto só `GET /api/status`, os próximos PRs completam); Divisão do trabalho (tabela da spec §8); Uso de ferramentas de IA (Claude usado para planejamento, especificação e apoio à implementação; todo código revisado e explicável pelos integrantes).

- [ ] **Step 2: Verificar do zero** — numa pasta temporária: `git clone` da branch, seguir **somente** o README. Expected: `npm test` no back passa; `GET /api/status` responde; o front abre em `http://localhost:5173`.

- [ ] **Step 3: Commit e PR**

```bash
git add README.md
git commit -m "docs: README com instruções de execução"
git push -u origin feat/fundacao
```

Abrir PR `feat/fundacao → main` com título "PR 0 — Fundação" e pedir revisão do colega.
