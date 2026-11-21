# Checklist final e roteiro da apresentação (PR 8)

Conferência do projeto contra o [enunciado](https://costasilvati.github.io/fullStack/projeto-2.html), item a item.
**Situação em 21/11/2026:** 202 testes automatizados passando (`npm test` no `backend/`), lint sem avisos e build do front-end ok.

Legenda: ✅ feito e verificado · 👥 depende do grupo (não é código)

## 1. Checklist final do enunciado

| Item | Situação | Onde é verificado |
|---|---|---|
| Mesmo e-mail com maiúsculas diferentes é rejeitado | ✅ | `test/routes/auth.test.js` — "e-mail com maiúsculas e CPF com máscara contam como repetidos → 409" |
| Mesmo CPF com e sem pontuação é rejeitado | ✅ | mesmo teste acima |
| Sem a verificação prévia no código, o banco ainda impede duplicatas | ✅ | `UNIQUE` nomeadas em `schema.sql`; `test/config/db.test.js` insere direto no banco e recebe `23505` |
| Nenhuma resposta da API contém `senha_hash` | ✅ | `test/routes/auth.test.js` — "nenhuma resposta expõe o hash da senha" |
| Trocar o id na URL não dá acesso a dados de outro usuário | ✅ | `test/routes/lancamentos.test.js` — "usuário B não lê, edita nem exclui lançamento de A → 404" (e testes equivalentes de categorias e fontes) |
| Saída não aceita categoria de entrada | ✅ | `test/routes/lancamentos.test.js` e `test/models/lancamento.test.js` |
| R$ 100,00 em 3× soma exatamente R$ 100,00 | ✅ | `test/config/dinheiro.test.js`, `test/routes/lancamentos.test.js` |
| Compra no dia do fechamento cai na fatura seguinte | ✅ | `test/config/datas.test.js` (linhas da Tabela 10.3); seed tem uma compra assim para cada usuário |
| Token expirado volta ao login sem erro na tela | ✅ | interceptor de 401 em `frontend/src/services/api.js`; testado no navegador com token adulterado |
| `.env` fora do repositório e `.env.example` versionado | ✅ | `.gitignore` (`.env*` e `!.env.example`); só os dois `.env.example` estão no Git |
| README permite subir o projeto do zero | ✅ | seção "Como rodar" do README (banco, `.env`, `db:criar`, `db:seed`, back-end e front-end) |

## 2. Critérios de avaliação (Tabela 10.7)

| # | Critério | Situação | Observação |
|---|---|---|---|
| 1 | Cadastro com validação no servidor | ✅ | `validar.js` (obrigatórios, e-mail, `cpfValido`, senha ≥ 8 com letras e números) |
| 2 | Unicidade por UNIQUE, normalização e 409 no front | ✅ | campo duplicado aparece sob o campo na tela de cadastro |
| 3 | Login com JWT, middleware e bcrypt | ✅ | `autenticar.js`, bcrypt custo 10, token de 1h |
| 4 | Isolamento (RF3) | ✅ | id sempre do token; todo model filtra por `usuario_id` |
| 5 | CRUD de categorias e fontes/destinos | ✅ | cartão exige dias e limite (400); exclusão com lançamentos → 409 |
| 6 | CRUD de lançamentos com validações | ✅ | valor, data, tipo da categoria, posse da categoria e da fonte |
| 7 | Filtros, paginação e totais | ✅ | 20 por página; totais sobre o filtro inteiro |
| 8 | Parcelas em transação e centavos corretos | ✅ | `emTransacao` + `dividirEmParcelas` |
| 9 | Relatório por categoria | ✅ | percentual, pizza, barras atual × anterior, variação |
| 10 | Relatório por fonte/destino | ✅ | entradas, saídas, saldo das contas e gráfico |
| 11 | Previsão de faturas | ✅ | regra de fechamento, parcelas futuras, limite utilizado/disponível |
| 12 | Verbos, status e padrão único de erro | ✅ | `{ erro, campos }` em toda resposta de erro (`erros.js`) |
| 13 | Modelagem e pool | ✅ | FKs, CHECK, NOT NULL, `NUMERIC(12,2)`, `pg.Pool` |
| 14 | Segurança | ✅ | `.env` fora do Git, SQL parametrizado, validação de toda entrada, CORS restrito, rate limit no login |
| 15 | Front-end | ✅ | `RotaProtegida`, `AuthContext`, `api.js` único com 401, estados de carregando/vazio/erro |
| 16 | Estrutura, README, scripts, commits | ✅ | `backend/src` só com `config`, `models`, `middlewares`, `routes`; commits dos dois integrantes |
| — | Desafio (+10) | ✅ | 5 indicadores no back-end, projeção com gráfico, dicas e aviso educativo visível |
| 17–19 | Apresentação | 👥 | ver roteiro abaixo |

**Para o grupo confirmar (👥):**

- O banco (PostgreSQL) foi comunicado ao professor antes do início.
- As bibliotecas usadas estão aprovadas: `express`, `pg`, `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit`, `react-router-dom`, `axios`, `recharts`.
- Os dois integrantes conseguem explicar qualquer trecho do código, inclusive o feito com apoio de IA.

## 3. Roteiro da apresentação (máximo 10 minutos)

**Antes de começar:** Docker aberto, `npm run db:criar` e `npm run db:seed` já testados, Postman/Insomnia aberto com duas abas (token da Ana e token do Bruno).

| # | Item obrigatório | Quem | O que mostrar | Tempo |
|---|---|---|---|---|
| 1 | Código-fonte | Gabriel | Pastas `backend/src` e `frontend/src`, `schema.sql`, `server.js`, `erros.js`, `validar.js` | 1 min |
| 2 | Linha de comando | Gabriel | `docker compose up -d`, `npm run db:criar`, `npm run db:seed`, `npm run dev` nos dois | 1 min |
| 3 | Cadastro e unicidade | Gabriel | Cadastrar usuário novo; repetir com `ANA@exemplo.com` → erro no e-mail; repetir com CPF `529.982.247-25` → erro no CPF | 1 min |
| 4 | Login, isolamento e token | Gabriel | Login; no Postman, `GET /api/lancamentos/<id da Ana>` com token do Bruno → 404; sem token → 401 | 1,5 min |
| 5 | CRUD completo | João Vitor | Criar categoria e cartão; lançar uma compra de R$ 100,00 em 3× no cartão (parcelas 33,34 + 33,33 + 33,33); editar e excluir com "só esta / todas" | 2 min |
| 6 | Relatórios | ambos | Por categoria (João: pizza, comparação com o mês anterior); por fonte/destino e faturas (Gabriel: em qual fatura caiu cada parcela do item 5, e a compra do dia do fechamento) | 2 min |
| 7 | Desafio | João Vitor | Saúde financeira da Ana (reserva boa, lazer fora da curva) e do Bruno (reserva baixa, poupança abaixo de 10%); aviso educativo | 1,5 min |

**Perguntas prováveis e onde está a resposta:**

- *Por que as parcelas guardam a data da compra?* → README, "Faturas de cartão": a regra fica num lugar só e mudar o fechamento recalcula tudo.
- *Como garantem que não há e-mail duplicado?* → `UNIQUE` no banco; a consulta prévia só melhora a mensagem.
- *Onde está a transação das parcelas?* → `models/lancamento.js` → `criar` usa `emTransacao`.
- *Por que centavos inteiros?* → `0.1 + 0.2 ≠ 0.3` em ponto flutuante; `config/dinheiro.js`.
- *Como funciona o período anterior?* → README, "Relatório por categoria".
- *Como os limites das dicas foram escolhidos?* → README, "Saúde financeira", e a constante `LIMITES` em `models/saude.js`.
