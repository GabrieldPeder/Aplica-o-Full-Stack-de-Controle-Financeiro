# Aplicação Full Stack de Controle Financeiro

Projeto 2 da disciplina **Programação Web Full Stack** (UTFPR — Engenharia de Software).
Aplicação de controle financeiro pessoal: cadastro e login de usuários, lançamentos de entradas e saídas
por categoria e fonte/destino, compras parceladas no cartão, relatórios e previsão de faturas.

**Grupo:** Gabriel de Peder · João Vitor Antoniel

Especificação do grupo: [`docs/superpowers/specs/2026-11-12-controle-financeiro-design.md`](docs/superpowers/specs/2026-11-12-controle-financeiro-design.md)

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

## Padrão de erros da API

Toda resposta de erro tem o formato:

```json
{ "erro": "Dados inválidos.", "campos": { "valor": "O valor deve ser maior que zero." } }
```

## Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/status` | Verifica se a API está no ar |

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
