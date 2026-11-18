# Aplicação Full Stack de Controle Financeiro

Projeto 2 da disciplina **Programação Web Full Stack** (UTFPR — Engenharia de Software).
Aplicação de controle financeiro pessoal: cadastro e login de usuários, lançamentos de entradas e saídas
por categoria e fonte/destino, compras parceladas no cartão, relatórios e previsão de faturas.

**Grupo:** Gabriel de Peder · João Vitor Antoniel

Documentação do grupo: [especificação](docs/especificacao.md) e [planos de cada PR](docs/planos/README.md).

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Back-end | Node.js 22+, Express, PostgreSQL 16 (driver `pg`), `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit` |
| Front-end | React + Vite, React Router, Axios, Recharts |
| Testes | Test runner nativo do Node (`node:test`) |

## Pré-requisitos

- **Node.js 22 ou mais novo** (`node --version`)
- **Docker Desktop** (recomendado) **ou** PostgreSQL 16 instalado na máquina

## Como rodar

### 1. Banco de dados

**Com Docker** (dentro de `backend/`):

```bash
cd backend
docker compose up -d
```

Isso cria o usuário `financas` (senha `financas`) e os bancos `financas` (desenvolvimento) e `financas_teste` (testes automatizados).

**Sem Docker:** com o PostgreSQL instalado, crie o mesmo usuário e os dois bancos:

```sql
CREATE ROLE financas LOGIN PASSWORD 'financas';
CREATE DATABASE financas OWNER financas;
CREATE DATABASE financas_teste OWNER financas;
```

(Se usar outro usuário/senha, ajuste as URLs no `backend/.env`.)

### 2. Back-end

```bash
cd backend
cp .env.example .env          # no Windows (cmd): copy .env.example .env
                              # depois troque JWT_SECRET no .env por um texto longo e aleatório
npm install
npm run db:criar              # cria as tabelas no banco de desenvolvimento
npm run db:teste              # cria as tabelas no banco de testes
npm test                      # roda os testes automatizados
npm run dev                   # API em http://localhost:3000
```

Teste rápido: `http://localhost:3000/api/status` deve responder `{"status":"ok"}`.

> `npm run db:criar` **recria** as tabelas e apaga os dados existentes.

### 3. Front-end

Em outro terminal:

```bash
cd frontend
cp .env.example .env          # no Windows (cmd): copy .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

## Scripts

| Pasta | Script | O que faz |
|---|---|---|
| backend | `npm run dev` | Sobe a API e reinicia ao salvar arquivos |
| backend | `npm start` | Sobe a API |
| backend | `npm test` | Testes automatizados (usam o banco `financas_teste`) |
| backend | `npm run db:criar` | Recria as tabelas no banco de desenvolvimento |
| backend | `npm run db:teste` | Recria as tabelas no banco de testes |
| frontend | `npm run dev` | Sobe o front-end |
| frontend | `npm run build` | Gera a versão de produção em `dist/` |
| frontend | `npm run lint` | Verifica o código |

## Estrutura de pastas

```text
backend/
├── database/        → schema.sql, scripts de banco e seed
├── test/            → testes automatizados
└── src/
    ├── server.js    → cria o app Express (middlewares, rotas, erros)
    ├── config/      → .env, conexão/pool do banco e funções utilitárias puras
    ├── models/      → acesso ao banco de dados (único lugar com SQL)
    ├── middlewares/ → autenticação, validação, rate limit, tratamento de erros
    └── routes/      → rotas + código dos controladores
frontend/src/
├── components/      → páginas e componentes (JSX)
├── contexts/        → AuthContext
└── services/        → cliente HTTP (único acesso à API) e funções de formatação
```

**Decisões de organização:**

- Funções utilitárias puras (validação de CPF, cálculo de parcelas e de faturas) ficam em `backend/src/config/`.
- No front-end, `formatar.js` (moeda, datas, máscaras) e o hook `useApi.js` ficam em `services/`.
- Datas do tipo `DATE` voltam do banco como texto `AAAA-MM-DD`, para evitar erro de fuso horário.

**Faturas de cartão (RF9):**

- Todas as parcelas de uma compra guardam a **data da compra**. A fatura de cada parcela é calculada por `calcularFatura(data, cartão, parcela)` (`backend/src/config/datas.js`, implementação de referência do enunciado). Assim, mudar o dia de fechamento de um cartão recalcula todas as faturas.
- Por isso os relatórios por período (RF7, RF8) contam uma compra parcelada inteira no mês em que foi feita; só a tela de faturas distribui as parcelas pelos meses.
- A fatura atual é aquela em que cairia uma compra feita hoje (horário de Brasília). Uma compra no dia do fechamento já vai para a fatura seguinte.
- Limite utilizado = soma de todas as parcelas com vencimento hoje ou depois.

## Padrão de erros da API

Toda resposta de erro tem o formato:

```json
{ "erro": "Dados inválidos.", "campos": { "valor": "O valor deve ser maior que zero." } }
```

## Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/status` | Verifica se a API está no ar |
| `POST` | `/api/auth/cadastro` | Cadastra usuário (`nome`, `email`, `cpf`, `senha`, `confirmacaoSenha`) e cria categorias e fontes padrão |
| `POST` | `/api/auth/login` | Devolve `{ token, usuario }`; limite de 5 tentativas erradas a cada 15 min |
| `GET` | `/api/auth/me` | Dados do usuário do token |
| `GET` | `/api/categorias` | Lista as categorias do usuário (com `quantidadeLancamentos`) |
| `POST` | `/api/categorias` | Cria categoria (`nome`, `tipo`: `entrada` ou `saida`) |
| `PUT` | `/api/categorias/:id` | Edita; o tipo só muda se não houver lançamentos |
| `DELETE` | `/api/categorias/:id` | Exclui; 409 se houver lançamentos |
| `GET` | `/api/fontes-destinos` | Lista fontes e destinos do usuário |
| `POST` | `/api/fontes-destinos` | Cria (`nome`, `tipo`: `renda`, `conta` ou `cartao_credito`; cartão exige `diaFechamento`, `diaVencimento`, `limite`; conta aceita `reserva`) |
| `PUT` | `/api/fontes-destinos/:id` | Edita; o tipo só muda se não houver lançamentos |
| `DELETE` | `/api/fontes-destinos/:id` | Exclui; 409 se houver lançamentos |
| `GET` | `/api/relatorios/fontes-destinos?inicio=&fim=` | Entradas por fonte, saídas por destino e saldo das contas no período (datas `AAAA-MM-DD`) |
| `GET` | `/api/relatorios/faturas?meses=3` | Fatura atual e as próximas `meses` (1 a 12) de cada cartão, com parcelas e limite utilizado/disponível |

Todas as rotas, exceto `/api/status`, `/api/auth/cadastro` e `/api/auth/login`, exigem o cabeçalho `Authorization: Bearer <token>`.
As demais rotas são adicionadas pelos próximos PRs (ver a especificação).

## Divisão do trabalho

| # | PR | Responsável |
|---|---|---|
| 0 | Fundação (estrutura, banco, erros, front-end base) | Gabriel |
| 1 | Autenticação | Gabriel |
| 2 | Categorias + fontes/destinos | Gabriel |
| 3 | Lançamentos (CRUD, filtros, parcelamento) | João Vitor |
| 4 | Seed de demonstração | João Vitor |
| 5 | Relatório por categoria + Dashboard | João Vitor |
| 6 | Relatório por fonte/destino + Faturas | Gabriel |
| 7 | Saúde financeira (desafio) | João Vitor |
| 8 | Acabamento, testes finais e apresentação | Ambos |

## Uso de ferramentas de IA

Usamos o assistente **Claude** (Anthropic) como apoio no planejamento, na escrita da especificação e na
implementação. Todo o código foi revisado pelos integrantes, que são capazes de explicar qualquer trecho.
Os commits feitos com apoio da IA trazem a linha `Co-Authored-By: Claude`.
