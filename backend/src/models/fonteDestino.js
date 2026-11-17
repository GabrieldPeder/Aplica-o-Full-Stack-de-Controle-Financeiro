// Acesso ao banco para fontes e destinos de dinheiro (RF5): renda, conta e cartão de crédito.
// Toda função recebe usuarioId como 1º parâmetro e filtra por ele (RF3).
import { consultar, emTransacao } from '../config/db.js';
import { ErroApi } from '../middlewares/erros.js';

const NAO_ENCONTRADA = 'Fonte/destino não encontrada.';

const SELECAO = `SELECT f.id, f.nome, f.tipo, f.dia_fechamento, f.dia_vencimento, f.limite, f.reserva,
    count(l.id)::int AS quantidade_lancamentos
  FROM fontes_destinos f
  LEFT JOIN lancamentos l ON l.fonte_destino_id = f.id
  WHERE f.usuario_id = $1`;

function paraApi(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    tipo: linha.tipo,
    diaFechamento: linha.dia_fechamento,
    diaVencimento: linha.dia_vencimento,
    limite: linha.limite === null ? null : Number(linha.limite),
    reserva: linha.reserva,
    quantidadeLancamentos: linha.quantidade_lancamentos,
  };
}

// Campos de cartão só existem em cartão; reserva de emergência só em conta.
function normalizar({ nome, tipo, diaFechamento, diaVencimento, limite, reserva }) {
  const ehCartao = tipo === 'cartao_credito';
  return [
    nome,
    tipo,
    ehCartao ? diaFechamento : null,
    ehCartao ? diaVencimento : null,
    ehCartao ? limite : null,
    tipo === 'conta' ? Boolean(reserva) : false,
  ];
}

async function buscar(usuarioId, id) {
  const { rows } = await consultar(`${SELECAO} AND f.id = $2 GROUP BY f.id`, [usuarioId, id]);
  return rows[0] ? paraApi(rows[0]) : null;
}

export async function listar(usuarioId) {
  const { rows } = await consultar(`${SELECAO} GROUP BY f.id ORDER BY f.nome`, [usuarioId]);
  return rows.map(paraApi);
}

export async function criar(usuarioId, dados) {
  const { rows } = await consultar(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [usuarioId, ...normalizar(dados)],
  );
  return buscar(usuarioId, rows[0].id);
}

// Em transação, travando a linha (FOR UPDATE), pelo mesmo motivo de categoria.atualizar.
export async function atualizar(usuarioId, id, dados) {
  await emTransacao(async (cliente) => {
    const { rows } = await cliente.query(
      'SELECT tipo FROM fontes_destinos WHERE usuario_id = $1 AND id = $2 FOR UPDATE',
      [usuarioId, id],
    );
    if (rows.length === 0) throw new ErroApi(404, NAO_ENCONTRADA);
    if (dados.tipo !== rows[0].tipo) {
      const { rows: [{ n }] } = await cliente.query(
        'SELECT count(*)::int AS n FROM lancamentos WHERE fonte_destino_id = $1',
        [id],
      );
      if (n > 0) {
        throw new ErroApi(409, 'Não é possível mudar o tipo.', {
          tipo: 'Já existem lançamentos aqui; o tipo não pode ser alterado.',
        });
      }
    }
    await cliente.query(
      `UPDATE fontes_destinos
       SET nome = $3, tipo = $4, dia_fechamento = $5, dia_vencimento = $6, limite = $7, reserva = $8
       WHERE usuario_id = $1 AND id = $2`,
      [usuarioId, id, ...normalizar(dados)],
    );
  });
  return buscar(usuarioId, id);
}

// Com lançamentos vinculados o banco recusa (FK, erro 23503 → 409 no middleware de erros).
export async function excluir(usuarioId, id) {
  const { rowCount } = await consultar('DELETE FROM fontes_destinos WHERE usuario_id = $1 AND id = $2', [
    usuarioId, id,
  ]);
  if (rowCount === 0) throw new ErroApi(404, NAO_ENCONTRADA);
}
