# PR 4 — Seed de demonstração

| | |
|---|---|
| **Responsável** | João Vitor (implementa todas as tarefas deste plano) |
| **Revisor** | Gabriel |
| **Branch** | `feat/seed` |
| **Situação** | Concluído — PR #11, entregue na `main` pelo #13 |
| **Especificação** | [especificacao.md](../especificacao.md) — seção 6 |
| **Depende de** | PR 3 (lançamentos e parcelamento) |

## Objetivo

Um comando (`npm run db:seed`) que carrega dados suficientes para demonstrar todas as telas: 2 usuários e pelo menos 3 meses de lançamentos (RNF do enunciado).

## Como está organizado

- `backend/database/seed.sql`: SQL puro, executado por `database/executar.js` como o `schema.sql`.
- Uma função temporária `pg_temp.lancar(email, tipo, descrição, valor, mês relativo, dia, categoria, fonte, parcelas)` grava um lançamento (e as parcelas) localizando categoria e fonte pelo nome. Ela some ao fim da conexão.

## Decisões

- **Datas relativas a hoje.** Os lançamentos usam `CURRENT_DATE` (mês atual e os 3 anteriores). O seed nunca fica "velho" e nunca cria lançamento no futuro.
- **4 meses, e não 3.** A saúde financeira (PR 7) analisa os 3 últimos meses **completos**; com só 3 meses de dados, um deles ficaria vazio e distorceria as médias.
- **Mesma regra de parcelas da API.** A 1ª parcela recebe o resto da divisão em centavos; todas guardam a data da compra e o mesmo `grupo_parcelamento`.
- **Depósitos na reserva fora da janela.** O dinheiro guardado na Poupança foi lançado há mais de um ano: um depósito na reserva é transferência, não renda, e não pode inflar a taxa de poupança.
- **Hash pré-calculado.** A senha `demo1234` já vai como hash bcrypt (custo 10) no SQL.
- **Recomeça do zero.** `TRUNCATE ... RESTART IDENTITY` no início: pode ser executado quantas vezes quiser.

## Casos de atenção (cobertos por teste)

- Os dois usuários entram com a senha documentada.
- As parcelas de cada compra somam o valor exato e têm a mesma data.
- Nenhum lançamento no futuro; cada usuário tem 2 cartões e 1 conta de reserva.
- Executar o seed duas vezes não duplica nada.

## O que o seed cria

| | Ana (`ana@exemplo.com`) | Bruno (`bruno@exemplo.com`) |
|---|---|---|
| Perfil | Boa reserva (≈ 6 meses), lazer acima da média no mês atual | Pouca reserva, poupança baixa, mais parcelas |
| Cartões | Roxo (fecha 3, vence 10) e Verde (fecha 25, vence 5) | Os mesmos |
| Parceladas | Notebook 10×, Geladeira 6× | Celular 12×, Sofá 5× |
| Compra no dia do fechamento | Tênis (dia 3, Cartão Roxo) | Mochila (dia 3, Cartão Roxo) |

## Tarefas

- [x] Escrever `seed.sql` e o script `db:seed` no `package.json`.
- [x] Teste `test/database/seed.test.js` (login, parcelas, nada no futuro, reexecução).
- [x] README: comando, usuários e perfis.
- [x] Commit: `feat: seed de demonstração com 2 usuários e 3 meses de lançamentos`
- [x] Ajuste no PR 7: ampliar para 4 meses e mover os depósitos da reserva.
