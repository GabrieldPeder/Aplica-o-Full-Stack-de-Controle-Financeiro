// Acesso ao banco para categorias (RF4). Toda função recebe usuarioId como 1º parâmetro
// e filtra por ele (RF3). Os dados chegam validados pelo middleware validar.
import { consultar } from '../config/db.js';
import { ErroApi } from '../middlewares/erros.js';

const NAO_ENCONTRADA = 'Categoria não encontrada.';

// Inclui quantos lançamentos usam a categoria (a tela avisa antes de excluir).
const SELECAO = `SELECT c.id, c.nome, c.tipo, count(l.id)::int AS quantidade_lancamentos
  FROM categorias c
  LEFT JOIN lancamentos l ON l.categoria_id = c.id
  WHERE c.usuario_id = $1`;

function paraApi(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    tipo: linha.tipo,
    quantidadeLancamentos: linha.quantidade_lancamentos,
  };
}

async function buscar(usuarioId, id) {
  const { rows } = await consultar(`${SELECAO} AND c.id = $2 GROUP BY c.id`, [usuarioId, id]);
  return rows[0] ? paraApi(rows[0]) : null;
}

export async function listar(usuarioId) {
  const { rows } = await consultar(`${SELECAO} GROUP BY c.id ORDER BY c.tipo, c.nome`, [usuarioId]);
  return rows.map(paraApi);
}

export async function criar(usuarioId, { nome, tipo }) {
  const { rows } = await consultar(
    'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id',
    [usuarioId, nome, tipo],
  );
  return buscar(usuarioId, rows[0].id);
}

export async function atualizar(usuarioId, id, { nome, tipo }) {
  const atual = await buscar(usuarioId, id);
  if (!atual) throw new ErroApi(404, NAO_ENCONTRADA);
  if (tipo !== atual.tipo && atual.quantidadeLancamentos > 0) {
    throw new ErroApi(409, 'Não é possível mudar o tipo.', {
      tipo: 'A categoria já tem lançamentos; só o nome pode ser alterado.',
    });
  }
  await consultar('UPDATE categorias SET nome = $3, tipo = $4 WHERE usuario_id = $1 AND id = $2', [
    usuarioId, id, nome, tipo,
  ]);
  return buscar(usuarioId, id);
}

// Com lançamentos vinculados o banco recusa (FK, erro 23503 → 409 no middleware de erros).
export async function excluir(usuarioId, id) {
  const { rowCount } = await consultar('DELETE FROM categorias WHERE usuario_id = $1 AND id = $2', [usuarioId, id]);
  if (rowCount === 0) throw new ErroApi(404, NAO_ENCONTRADA);
}
