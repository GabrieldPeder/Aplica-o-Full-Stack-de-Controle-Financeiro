# PR 1 — Autenticação

| | |
|---|---|
| **Responsável** | Gabriel (implementa todas as tarefas deste plano) |
| **Revisor** | João Vitor |
| **Branch** | `feat/autenticacao` |
| **Situação** | Em revisão |
| **Especificação** | [especificacao.md](../especificacao.md) — seções 4.2, 4.3 (auth) e 5 |
| **Depende de** | PR 0 |

## Objetivo

Cadastro, login e logout com JWT (RF1, RF2), o middleware que protege as rotas (base do RF3), o middleware de validação usado por todas as rotas, e no front-end as telas de Login e Cadastro, o `AuthContext` completo, as rotas protegidas e o menu lateral.

## Como está organizado

- `config/cpf.js`: `cpfValido(cpf)` e `somenteDigitos(texto)`, funções puras.
- `middlewares/validar.js`: `validar({ body, query, params })` + as regras prontas (`texto`, `email`, `cpf`, `senha`, `igualA`, `umDe`, `inteiro`, `dinheiro`, `booleano`, `quando`). Respondem 400 com **todos** os campos errados de uma vez.
- `middlewares/autenticar.js`: lê `Authorization: Bearer <token>` e coloca o id do usuário em `req.usuarioId`.
- `models/usuario.js`: cadastro (usuário + categorias e fontes padrão numa transação), conferência de senha e busca por id.
- `routes/auth.js`: `criarRotasAuth()` monta as rotas com seus limitadores de tentativas.
- Front-end: `AuthContext` com `login`, `cadastrar`, `logout` e `carregando`; páginas `Login` e `Cadastro`; `RotaProtegida` e `Layout`.

**Tecnologias novas:** `bcrypt`, `jsonwebtoken`, `express-rate-limit` (todas citadas no enunciado).

## Decisões

- **Onde ficam os dados validados.** O `validar` guarda o resultado já normalizado em `req.dados` (corpo), `req.filtros` (query string) e `req.parametros` (URL). Campos que não estão nas regras são descartados, e ninguém consegue mandar `usuario_id` pelo corpo. Motivo: no Express 5, `req.query` é somente leitura e não pode ser sobrescrito.
- **Formato de uma regra.** É uma função `(valor, corpoOriginal) => ({ valor })` ou `({ erro: 'mensagem' })`. Quem precisar de uma regra nova (por exemplo `data()` no PR 3) escreve outra função no mesmo formato no `validar.js`.
- **Regras de vínculo.** Regras que precisam consultar o banco (registro de outro usuário → 404 etc.) ficam no model, como o João Vitor já fez no PR 3. O `validar` só confere formato.
- **Limitadores por app.** `criarRotasAuth()` cria limitadores novos a cada chamada. Assim cada teste que sobe um servidor começa com o contador zerado.
- **Duplicidade amigável.** Antes de inserir, o cadastro procura e-mail **e** CPF já usados e devolve os dois campos de uma vez. Se duas pessoas cadastrarem ao mesmo tempo, o `UNIQUE` do banco garante, e o erro vira 409 pelo middleware do PR 0.
- **Login com tempo constante.** Quando o e-mail não existe, a senha é comparada mesmo assim com um hash fixo. Assim a resposta não fica mais rápida e não revela quais e-mails estão cadastrados.
- **`JWT_SECRET` de exemplo é recusado** fora dos testes, com mensagem pedindo para trocar no `.env`.

## Regras gerais

- Senhas só em hash bcrypt (custo 10); `senha_hash` nunca sai do model.
- Token: payload `{ sub: id }`, expiração `JWT_EXPIRA` (padrão 1h).
- E-mail gravado em minúsculas e sem espaços; CPF só com dígitos.
- Mensagens em português, no formato `{ erro, campos }`.

## Casos de atenção

- `Joao@Email.com ` e `joao@email.com` são o mesmo e-mail → 409 no campo `email`.
- `123.456.789-09` e `12345678909` são o mesmo CPF → 409 no campo `cpf`.
- E-mail **e** CPF repetidos → 409 com os dois campos.
- Login com e-mail inexistente e com senha errada dão a **mesma** resposta (401 "E-mail ou senha inválidos.").
- 6ª tentativa de login errada em 15 minutos → 429 com `Retry-After`; login certo não gasta tentativa.
- Token expirado, adulterado ou de usuário excluído → 401.
- Recarregar a página logado mantém a sessão; com token inválido no `localStorage`, volta ao login sem tela branca.

---

## Tarefa 1 — CPF, validação e ajustes de configuração

**Arquivos:** `backend/src/config/cpf.js`, `backend/src/middlewares/validar.js`, `backend/src/config/env.js`, `.gitignore`
**Testes:** `backend/test/config/cpf.test.js`, `backend/test/middlewares/validar.test.js`, `backend/test/config/env.test.js`

- [x] Testes do CPF: `529.982.247-25` válido; dígito errado; 11 dígitos iguais; tamanho errado; texto vazio.
- [x] Testes do `validar`: normaliza e guarda em `req.dados`/`req.filtros`/`req.parametros`; descarta campos extras; junta todos os erros em `campos` com status 400 e `erro: 'Dados inválidos.'`; cada regra pronta (obrigatório, tamanho, e-mail, CPF, senha fraca, confirmação diferente, `umDe`, `inteiro` com limites e padrão, `dinheiro` com 3 casas ou zero, `booleano`, `quando`).
- [x] Teste do `env.js`: `JWT_SECRET=troque-este-segredo` é recusado fora do modo de teste.
- [x] Ver falharem, implementar, ver passarem.
- [x] Ajustes do PR 0: `.env` lido de `backend/.env` independente da pasta atual; `.gitignore` cobre `.env*` (menos `.env.example`).
- [x] Commit: `feat: validação de CPF e middleware validar`

## Tarefa 2 — Model de usuário

**Arquivos:** `backend/src/models/usuario.js` · **Testes:** `backend/test/models/usuario.test.js`
**Entrega:** `criarComPadroes({ nome, email, cpf, senha })`, `conferirCredenciais(email, senha)` → usuário ou `null`, `buscarPorId(id)`, `CATEGORIAS_PADRAO`, `FONTES_PADRAO`.

- [x] Testes: cria usuário sem devolver `senha_hash`; senha gravada em hash; 9 categorias e 2 fontes padrão; e-mail e/ou CPF repetidos → `ErroApi` 409 com os campos certos; se a criação dos padrões falhar, o usuário não fica gravado; credenciais certas/erradas/e-mail inexistente.
- [x] Ver falharem, implementar, ver passarem.
- [x] Commit: `feat: model de usuário com cadastro em transação`

## Tarefa 3 — Rotas de autenticação

**Arquivos:** `backend/src/middlewares/autenticar.js`, `backend/src/routes/auth.js`, `backend/src/server.js`, `README.md`
**Testes:** `backend/test/routes/auth.test.js`

| Método | Rota | Resposta |
|---|---|---|
| POST | `/api/auth/cadastro` | 201 `{ usuario }` · 400 · 409 · 429 (10 por hora) |
| POST | `/api/auth/login` | 200 `{ token, usuario }` · 400 · 401 · 429 |
| GET | `/api/auth/me` | 200 `{ usuario }` · 401 |

- [x] Testes: cadastro completo; campos inválidos → 400 com todos os campos; duplicidades → 409; login certo devolve token que funciona no `/me`; senha errada e e-mail inexistente → mesma resposta 401; 6ª tentativa errada → 429; acerto não conta; `/me` sem token, com token adulterado, expirado ou de usuário excluído → 401; resposta nunca tem `senhaHash`/`senha_hash`.
- [x] Ver falharem, implementar, registrar em `server.js`, ver passarem.
- [x] README: rotas de autenticação.
- [x] Commit: `feat: rotas de cadastro, login e sessão`

## Tarefa 4 — Front-end

**Arquivos:** `contexts/AuthContext.jsx`, `components/layout/{RotaProtegida,Layout}.jsx`, `components/paginas/{Login,Cadastro}.jsx`, `components/comuns/{CampoTexto,CampoCpf,MensagemErro,Carregando}.jsx`, `services/formatar.js`, `App.jsx`, `index.css`

- [x] `AuthContext`: `login(email, senha)`, `cadastrar(dados)` (cadastra e já entra), `logout()`, `carregando`. Ao abrir com token salvo, confere com `GET /auth/me`. O `login` atualiza o token na hora, antes de qualquer requisição.
- [x] `Login` e `Cadastro`: validação no navegador antes de enviar; erros do servidor embaixo de cada campo; mensagem do 429; máscara de CPF; botão desabilitado enquanto envia.
- [x] `RotaProtegida` (sem sessão → `/login`) e `Layout` (menu lateral com todas as páginas da especificação, nome do usuário e Sair). Logado em `/login` → vai para `/`.
- [x] Conferir: `npm run lint` e `npm run build` limpos; no navegador: cadastrar, ver erro de CPF repetido no campo certo, sair, entrar, recarregar e continuar logado, token corrompido volta ao login.
- [x] Commit: `feat: telas de login e cadastro, rotas protegidas e menu`
