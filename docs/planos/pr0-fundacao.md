# PR 0 — Fundação

| | |
|---|---|
| **Responsável** | Gabriel (implementa todas as tarefas deste plano) |
| **Revisor** | João Vitor |
| **Branch** | `feat/fundacao` |
| **Situação** | Concluído — PR #2 |
| **Especificação** | [especificacao.md](../especificacao.md) |

## Objetivo

Deixar o repositório pronto para os próximos PRs: back-end Express ligado ao PostgreSQL com todas as tabelas, erros padronizados, e front-end React com rotas, cliente HTTP único e um `AuthContext` inicial. Os PRs seguintes só acrescentam funcionalidades em cima disso.

## Como está organizado

- `backend/src/server.js` exporta `criarApp()`, que monta o app sem abrir a porta (assim os testes conseguem subir o servidor). A porta só é aberta quando o arquivo é executado diretamente (`npm run dev`).
- `config/env.js` lê e valida o `.env`; `config/db.js` cria o pool de conexões e a função `emTransacao`; `middlewares/erros.js` tem a classe `ErroApi` e o tratamento final de erros.
- No front-end, todas as chamadas à API passam por `services/api.js`. O `AuthContext` informa a ele o token atual e o que fazer quando a sessão expira.

**Tecnologias deste PR:** Node.js 22+, Express, `pg`, `dotenv`, `cors`, testes com `node:test`; PostgreSQL 16; React + Vite, `react-router-dom`, `axios`.

## Regras gerais (valem para todas as tarefas)

- `backend/src/` tem **somente** `server.js`, `config/`, `models/`, `middlewares/` e `routes/`.
- `frontend/src/` tem somente `main.jsx`, `App.jsx`, `index.css` e as pastas `components/`, `contexts/` e `services/`.
- Bibliotecas permitidas neste PR: no back, `express`, `pg`, `dotenv` e `cors`; no front, `react-router-dom` e `axios` (além do que o Vite já traz).
- Os scripts do `package.json` precisam funcionar no Windows (nada de `VAR=valor comando`, `rm` ou arquivos `.sh`).
- `.env` nunca vai para o Git; `.env.example` sim, no back e no front.
- Toda resposta de erro tem o formato `{ "erro": "...", "campos": { ... } }` e nunca mostra o `stack`.
- Mensagens e commits em português (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).

## Casos de atenção

Situações fáceis de esquecer, cada uma coberta por teste:

- JSON malformado no corpo (`{`) responde **400** "JSON inválido no corpo da requisição.", e não 500.
- Texto onde se espera número (`/api/categorias/abc`) responde **400** "Parâmetro inválido.".
- Subir o servidor sem `.env` falha na hora, dizendo quais variáveis faltam e como resolver.
- Datas do banco voltam como texto `'2026-11-03'`. Sem esse ajuste, o fuso de Brasília transformaria em 02/11.
- Se der erro no meio de uma transação, tudo é desfeito e a conexão volta para o pool.

---

## Tarefa 1 — Estrutura do back-end e `.env`

**Arquivos:** `.gitignore`, `backend/package.json`, `backend/.env.example`, `backend/src/config/env.js`
**Testes:** `backend/test/config/env.test.js`, `backend/test/ajudantes/ambiente.js`

**Entrega para as próximas tarefas:**
- `config` com `porta`, `databaseUrl`, `jwtSecret`, `jwtExpira`, `corsOrigem`, `loginMaxTentativas`, `loginJanelaMin`.
- `test/ajudantes/ambiente.js`: deve ser o **primeiro import** de todo teste que usa banco ou servidor. Ele faz os testes usarem o banco `financas_teste`.

- [x] Criar `package.json` com os scripts `dev`, `start`, `test`, `db:criar`, `db:teste` e instalar `express`, `pg`, `dotenv`, `cors`.
- [x] Criar `.env.example` com `PORT`, `DATABASE_URL`, `DATABASE_URL_TESTE`, `JWT_SECRET`, `JWT_EXPIRA`, `CORS_ORIGEM`, `LOGIN_MAX_TENTATIVAS`, `LOGIN_JANELA_MIN`.
- [x] Escrever os testes: valores padrão (porta 3000, token de 1h, 5 tentativas em 15 min); erro listando todas as variáveis ausentes; em modo de teste, usa e exige `DATABASE_URL_TESTE`.
- [x] Ver os testes falharem, implementar `carregarConfig(env)` e ver passarem.
- [x] Commit: `chore: esqueleto do back-end e configuração por .env`

## Tarefa 2 — Banco de dados

**Arquivos:** `backend/docker-compose.yml`, `backend/database/docker-init.sql`, `backend/database/schema.sql`, `backend/database/executar.js`, `backend/src/config/db.js`
**Testes:** `backend/test/config/db.test.js`

**Usa:** `config.databaseUrl` (Tarefa 1).
**Entrega:**
- `consultar(sql, params)` para consultas simples.
- `emTransacao(async (cliente) => { ... })` para gravações em várias tabelas ou várias linhas: tudo ou nada.
- `executarSql(arquivo)` e os comandos `npm run db:criar` / `npm run db:teste`.

- [x] `docker-compose.yml` com PostgreSQL 16 (usuário e senha `financas`) e criação automática do banco de testes.
- [x] `schema.sql` com as quatro tabelas da especificação, constraints com nome (`usuarios_email_unico`, `usuarios_cpf_unico`, `categorias_nome_unico`, `fontes_destinos_nome_unico`), CHECKs e índices. Pode ser executado várias vezes (recria as tabelas).
- [x] Escrever os testes: e-mail e CPF duplicados, cartão sem limite, valor zero, exclusão de categoria com lançamento, exclusão de usuário em cascata, data como texto, transação desfeita em erro (12 vezes seguidas, para provar que o pool não esgota), transação confirmada, schema executado duas vezes.
- [x] Ver falharem, implementar `db.js` e `executar.js`, ver passarem.
- [x] Commit: `feat: schema do banco, pool de conexões e transações`

## Tarefa 3 — Servidor e tratamento de erros

**Arquivos:** `backend/src/middlewares/erros.js`, `backend/src/server.js`
**Testes:** `backend/test/middlewares/erros.test.js`, `backend/test/server.test.js`

**Entrega:**
- `ErroApi(status, mensagem, campos)`: as rotas dos próximos PRs lançam erros com ela, por exemplo `throw new ErroApi(404, 'Lançamento não encontrado.')`.
- `criarApp()` com `GET /api/status` e um comentário marcando onde as rotas dos próximos PRs entram.

Tradução dos erros (o mesmo texto aparece para o usuário):

| Situação | Status | Mensagem |
|---|---|---|
| `ErroApi` lançada por uma rota | o da `ErroApi` | a da `ErroApi` |
| JSON malformado | 400 | JSON inválido no corpo da requisição. |
| Corpo grande demais / tipo não suportado | 413 / 415 | Corpo da requisição muito grande. / Tipo de conteúdo não suportado. |
| E-mail duplicado | 409 | Usuário já cadastrado. (campo `email`) |
| CPF duplicado | 409 | Usuário já cadastrado. (campo `cpf`) |
| Categoria ou fonte/destino com nome repetido | 409 | Registro duplicado. (campo `nome`) |
| Exclusão com lançamentos vinculados | 409 | Não é possível excluir: existem lançamentos vinculados. |
| Id ou data inválidos | 400 | Parâmetro inválido. |
| CHECK ou NOT NULL violado no banco | 400 | Dados inválidos. |
| Rota inexistente | 404 | Rota não encontrada. |
| Qualquer outro erro | 500 | Erro interno do servidor. |

- [x] Escrever os testes de cada linha da tabela e os do servidor: status 200, rota inexistente 404, JSON malformado 400, CORS só para `http://localhost:5173`.
- [x] Ver falharem, implementar e ver passarem.
- [x] Commit: `feat: servidor Express com CORS e tratamento de erros padronizado`

## Tarefa 4 — Front-end

**Arquivos:** `frontend/` (criado com o Vite), `frontend/.env.example`, `src/services/api.js`, `src/contexts/AuthContext.jsx`, `src/components/paginas/EmConstrucao.jsx`, `src/App.jsx`, `src/main.jsx`

**Entrega:**
- `api`: instância do axios que já envia `Authorization: Bearer <token>`. Quando a API responde 401 (exceto no `/auth/login`), a sessão é encerrada.
- `extrairErro(erro)`: devolve `{ mensagem, campos }` para as telas mostrarem os erros junto dos campos.
- `useAuth()`: devolve `{ usuario, token, logout }`. O PR 1 acrescenta `login`, `cadastrar` e a validação do token salvo.
- Rotas `/login`, `/cadastro` e `/` com páginas provisórias; qualquer outra rota leva para `/`.

- [x] Criar o projeto com o Vite, remover os arquivos de exemplo e instalar `react-router-dom` e `axios`.
- [x] Implementar `api.js`, `AuthContext.jsx`, as rotas e a página provisória.
- [x] Conferir: `npm run build` e `npm run lint` sem erros; no navegador, uma rota inexistente leva para `/`, e um `localStorage` corrompido não deixa a tela branca.
- [x] Commit: `feat: front-end com Vite, rotas, cliente HTTP único e AuthContext base`

## Tarefa 5 — README e teste do zero

- [x] README com tecnologias, pré-requisitos, passo a passo (com e sem Docker), scripts, estrutura de pastas, padrão de erros, divisão do trabalho e uso de IA.
- [x] Clonar a branch numa pasta nova e seguir **só** o README: testes passando, API e front-end no ar.
- [x] Commit: `docs: README com instruções de execução`

---

## Ajustes feitos durante a implementação

- **CORS:** a origem permitida é passada como lista. Assim o cabeçalho só aparece para o front-end, e um site estranho não recebe nada.
- **Lint do front-end:** o Vite atual usa o `oxlint`. Para ele passar limpo, o token passou a ser atualizado dentro de um efeito do React. Por isso, no PR 1 a função `login` deve atualizar o token na hora, antes da primeira requisição.
- **Docker:** não foi possível testar o `docker-compose.yml` no ambiente usado, então os testes rodaram num PostgreSQL instalado com as mesmas credenciais. Falta confirmar o `docker compose up -d` numa máquina do grupo.

## Correções após a revisão

- **Queda do banco:** se o PostgreSQL derrubasse uma conexão (banco reiniciado, notebook que dormiu), a API inteira caía. Agora ela descarta a conexão quebrada e continua funcionando. Dois testes cobrem isso.
- **Erros que davam 500:** id gigante na URL, data inexistente e corpo grande demais agora respondem 400 ou 413 (tabela da Tarefa 3).
- **Testes em sequência:** os arquivos de teste rodam um de cada vez (`--test-concurrency=1`), porque todos usam o mesmo banco de testes.

## Pendências menores (para resolver nos próximos PRs)

- O `.env` só é encontrado quando o comando é executado de dentro de `backend/`.
- O `JWT_SECRET` de exemplo é aceito sem aviso.
- O `.gitignore` cobre só `.env` (não `.env.test` etc.).
- A mensagem de erro de chave estrangeira sempre fala em "excluir", mesmo quando não é exclusão.
- A exceção do 401 compara a URL exata `/auth/login`; o PR 1 deve chamar exatamente essa URL.
- O front-end não avisa se faltar o arquivo `frontend/.env`.
