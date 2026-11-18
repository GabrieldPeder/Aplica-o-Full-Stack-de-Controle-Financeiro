// Funções de apoio para os testes: criam usuários e lançamentos direto no banco.
import { consultar } from '../../src/config/db.js';

let contador = 0;

export async function criarUsuario() {
  contador++;
  const { rows } = await consultar(
    `INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ('Teste', $1, $2, 'x') RETURNING id`,
    [`cenario${contador}-${Date.now()}@teste.com`, String(Date.now() + contador).slice(-11).padStart(11, '3')],
  );
  return rows[0].id;
}

export async function criarLancamento(usuarioId, categoriaId, fonteDestinoId, tipo = 'saida') {
  await consultar(
    `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
     VALUES ($1, $2, 'Teste', 10, '2026-11-03', $3, $4)`,
    [usuarioId, tipo, categoriaId, fonteDestinoId],
  );
}
