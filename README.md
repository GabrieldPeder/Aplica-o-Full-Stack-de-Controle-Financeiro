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
npm run db:seed               # (opcional) carrega os dados de demonstração
npm run db:teste              # cria as tabelas no banco de testes
npm test                      # roda os testes automatizados
npm run dev                   # API em http://localhost:3000
```

Teste rápido: `http://localhost:3000/api/status` deve responder `{"status":"ok"}`.

> `npm run db:criar` **recria** as tabelas e apaga os dados existentes. `npm run db:seed` também apaga tudo antes de carregar a demonstração.

**Usuários da demonstração** (`npm run db:seed`, senha `demo1234` para os dois):

| Usuário | E-mail | Perfil |
|---|---|---|
| Ana Souza | `ana@exemplo.com` | Boa reserva de emergência; gastos com lazer acima da média no mês atual |
| Bruno Lima | `bruno@exemplo.com` | Orçamento apertado, pouca reserva e mais compras parceladas |

Os lançamentos são relativos à data de hoje (mês atual e os 3 anteriores, que a saúde financeira usa como base). Cada usuário tem o **Cartão Roxo** (fecha dia 3, vence dia 10), o **Cartão Verde** (fecha dia 25, vence dia 5 do mês seguinte), uma **Poupança** marcada como reserva, compras parceladas e uma compra feita exatamente no dia do fechamento (cai na fatura seguinte).

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
| backend | `npm run db:seed` | Apaga os dados e carrega a demonstração (2 usuários, 4 meses de lançamentos) |
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
- Entre o fechamento e o vencimento, a fatura que acabou de fechar aparece antes da atual como "A pagar".
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
| `GET` | `/api/lancamentos` | Lista com filtros `inicio`, `fim` (padrão: mês corrente), `tipo`, `categoriaId`, `fonteDestinoId`, `pagina` (20 por página); devolve `{ itens, pagina, totalPaginas, totalItens, totais }` |
| `POST` | `/api/lancamentos` | Cria (`tipo`, `descricao`, `valor`, `data`, `categoriaId`, `fonteDestinoId`, `totalParcelas` 1–48 só em saída no cartão); devolve a lista de parcelas criadas |
| `GET` | `/api/lancamentos/:id` | Um lançamento |
| `PUT` | `/api/lancamentos/:id` | Edita; em compra parcelada só `descricao`, `categoriaId` e `valor` mudam |
| `DELETE` | `/api/lancamentos/:id?todasParcelas=true` | Exclui o lançamento ou, com `todasParcelas`, a compra inteira |
| `GET` | `/api/relatorios/categorias?inicio=&fim=` | Saídas por categoria (total, % do total, período anterior e variação) e entradas por categoria |
| `GET` | `/api/relatorios/fontes-destinos?inicio=&fim=` | Entradas por fonte, saídas por destino e saldo das contas no período (datas `AAAA-MM-DD`) |
| `GET` | `/api/relatorios/faturas?meses=3` | Fatura atual e as próximas `meses` (1 a 12) de cada cartão, com parcelas e limite utilizado/disponível |
| `GET` | `/api/saude-financeira` | Indicadores, dicas e projeção de saldo para 6 meses (ver abaixo) |

Todas as rotas, exceto `/api/status`, `/api/auth/cadastro` e `/api/auth/login`, exigem o cabeçalho `Authorization: Bearer <token>`.

## Saúde financeira (desafio)

Calculada no back-end (`backend/src/models/saude.js`), sem API de modelo de linguagem, com base nos **3 últimos meses completos** e nas parcelas já lançadas. Os limites ficam na constante `LIMITES` do model.

| Indicador | Cálculo | Dica |
|---|---|---|
| Taxa de poupança | (entradas − saídas) ÷ entradas, por mês e na média | < 10% → alerta; ≥ 20% → elogio |
| Comprometimento com cartões | soma das próximas 3 faturas ÷ (renda média mensal × 3) | > 30% → alerta |
| Parcelas futuras | parcelas a vencer, agrupadas pelo mês da fatura | > 0 → informa o total e o mês da última |
| Categoria fora da curva | gasto do mês atual ÷ média dos 3 meses anteriores | > 30% acima → alerta |
| Reserva de emergência | saldo das contas marcadas como reserva ÷ média de saídas mensais | < 3 meses → alerta; ≥ 6 → elogio |

**Projeção (6 meses):** média de entradas − média de saídas à vista − parcelas que caem em cada mês. As compras parceladas entram pelas parcelas, e não pela data da compra, para não serem contadas duas vezes. Se algum mês ficar negativo, aparece um alerta.

A página mostra o aviso: *Conteúdo educativo; não constitui recomendação financeira profissional.*

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
