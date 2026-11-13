// Acesso ao banco para lançamentos. Toda função recebe usuarioId como 1º parâmetro e
// filtra por ele (RF3): um usuário nunca enxerga nem altera lançamento de outro.
// Os dados de entrada já chegam validados e normalizados pelo middleware validar.
import { randomUUID } from 'node:crypto';
import { consultar, emTransacao } from '../config/db.js';
import { paraCentavos, deCentavos, dividirEmParcelas } from '../config/dinheiro.js';
import { ErroApi } from '../middlewares/erros.js';

export const ITENS_POR_PAGINA = 20;

const COLUNAS = `l.id, l.tipo, l.descricao, l.valor, l.data, l.categoria_id, c.nome AS categoria_nome,
  l.fonte_destino_id, f.nome AS fonte_destino_nome, l.parcela_atual, l.total_parcelas, l.grupo_parcelamento`;

const JUNCOES = `FROM lancamentos l
  JOIN categorias c ON c.id = l.categoria_id
  JOIN fontes_destinos f ON f.id = l.fonte_destino_id`;

// snake_case do banco → camelCase da API; NUMERIC (texto) → número.
function paraApi(linha) {
  return {
    id: linha.id,
    tipo: linha.tipo,
    descricao: linha.descricao,
    valor: Number(linha.valor),
    data: linha.data,
    categoriaId: linha.categoria_id,
    categoriaNome: linha.categoria_nome,
    fonteDestinoId: linha.fonte_destino_id,
    fonteDestinoNome: linha.fonte_destino_nome,
    parcelaAtual: linha.parcela_atual,
    totalParcelas: linha.total_parcelas,
    grupoParcelamento: linha.grupo_parcelamento,
  };
}

// Monta o WHERE dos filtros. Sempre começa por usuario_id = $1.
function montarFiltro(usuarioId, { inicio, fim, tipo, categoriaId, fonteDestinoId }) {
  const condicoes = ['l.usuario_id = $1', 'l.data BETWEEN $2 AND $3'];
  const params = [usuarioId, inicio, fim];
  if (tipo) {
    params.push(tipo);
    condicoes.push(`l.tipo = $${params.length}`);
  }
  if (categoriaId) {
    params.push(categoriaId);
    condicoes.push(`l.categoria_id = $${params.length}`);
  }
  if (fonteDestinoId) {
    params.push(fonteDestinoId);
    condicoes.push(`l.fonte_destino_id = $${params.length}`);
  }
  return { where: `WHERE ${condicoes.join(' AND ')}`, params };
}

// filtros: { inicio, fim, tipo?, categoriaId?, fonteDestinoId?, pagina? }
export async function listar(usuarioId, filtros) {
  const pagina = filtros.pagina ?? 1;
  const { where, params } = montarFiltro(usuarioId, filtros);

  // Totais sobre o filtro inteiro (não só a página atual).
  const { rows: [resumo] } = await consultar(
    `SELECT COUNT(*)::int AS total_itens,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
            COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0) AS saidas
     FROM lancamentos l ${where}`,
    params,
  );

  const { rows } = await consultar(
    `SELECT ${COLUNAS} ${JUNCOES} ${where}
     ORDER BY l.data DESC, l.id DESC
     LIMIT ${ITENS_POR_PAGINA} OFFSET $${params.length + 1}`,
    [...params, (pagina - 1) * ITENS_POR_PAGINA],
  );

  const entradas = paraCentavos(resumo.entradas);
  const saidas = paraCentavos(resumo.saidas);
  return {
    itens: rows.map(paraApi),
    pagina,
    totalPaginas: Math.max(1, Math.ceil(resumo.total_itens / ITENS_POR_PAGINA)),
    totalItens: resumo.total_itens,
    totais: {
      entradas: deCentavos(entradas),
      saidas: deCentavos(saidas),
      saldo: deCentavos(entradas - saidas),
    },
  };
}

export async function buscarPorId(usuarioId, id) {
  const { rows } = await consultar(
    `SELECT ${COLUNAS} ${JUNCOES} WHERE l.usuario_id = $1 AND l.id = $2`,
    [usuarioId, id],
  );
  return rows[0] ? paraApi(rows[0]) : null;
}

// Busca categoria e fonte/destino DO USUÁRIO e aplica as regras de vínculo (4.4, passos 2–4).
async function conferirVinculos(executor, usuarioId, { tipo, categoriaId, fonteDestinoId, totalParcelas }) {
  const { rows: [categoria] } = await executor.query(
    'SELECT tipo FROM categorias WHERE usuario_id = $1 AND id = $2',
    [usuarioId, categoriaId],
  );
  if (!categoria) throw new ErroApi(404, 'Categoria não encontrada.');

  const { rows: [fonte] } = await executor.query(
    'SELECT tipo FROM fontes_destinos WHERE usuario_id = $1 AND id = $2',
    [usuarioId, fonteDestinoId],
  );
  if (!fonte) throw new ErroApi(404, 'Fonte/destino não encontrada.');

  if (categoria.tipo !== tipo) {
    throw new ErroApi(400, 'Dados inválidos.', {
      categoriaId: `A categoria escolhida é de ${categoria.tipo === 'entrada' ? 'entrada' : 'saída'}.`,
    });
  }
  if (totalParcelas > 1 && (tipo !== 'saida' || fonte.tipo !== 'cartao_credito')) {
    throw new ErroApi(400, 'Dados inválidos.', {
      totalParcelas: 'Parcelamento só é permitido em saídas no cartão de crédito.',
    });
  }
}

// dados: { tipo, descricao, valor, data, categoriaId, fonteDestinoId, totalParcelas? }
// Devolve a lista de lançamentos criados (1 por parcela).
export async function criar(usuarioId, dados) {
  const totalParcelas = dados.totalParcelas ?? 1;
  return emTransacao(async (cliente) => {
    await conferirVinculos(cliente, usuarioId, { ...dados, totalParcelas });

    const parcelas = dividirEmParcelas(paraCentavos(dados.valor), totalParcelas);
    const grupo = totalParcelas > 1 ? randomUUID() : null;

    const ids = [];
    for (const [indice, centavos] of parcelas.entries()) {
      const { rows } = await cliente.query(
        `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id,
           fonte_destino_id, parcela_atual, total_parcelas, grupo_parcelamento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [usuarioId, dados.tipo, dados.descricao, deCentavos(centavos), dados.data, dados.categoriaId,
          dados.fonteDestinoId, indice + 1, totalParcelas, grupo],
      );
      ids.push(rows[0].id);
    }

    const { rows } = await cliente.query(
      `SELECT ${COLUNAS} ${JUNCOES} WHERE l.usuario_id = $1 AND l.id = ANY($2) ORDER BY l.parcela_atual`,
      [usuarioId, ids],
    );
    return rows.map(paraApi);
  });
}

// Em lançamento parcelado só descricao, categoriaId e valor podem mudar (ver especificação 4.3).
const IMUTAVEIS_EM_PARCELADO = ['data', 'fonteDestinoId', 'tipo', 'totalParcelas'];

export async function atualizar(usuarioId, id, dados) {
  return emTransacao(async (cliente) => {
    const atual = await buscarPorId(usuarioId, id);
    if (!atual) throw new ErroApi(404, 'Lançamento não encontrado.');

    if (atual.totalParcelas > 1) {
      const alterados = IMUTAVEIS_EM_PARCELADO.filter(
        (campo) => dados[campo] !== undefined && dados[campo] !== atual[campo],
      );
      if (alterados.length > 0) {
        const campos = Object.fromEntries(alterados.map((c) => [c, 'Não pode ser alterado em compra parcelada; exclua a compra e lance novamente.']));
        throw new ErroApi(400, 'Dados inválidos.', campos);
      }
    }

    const novo = { ...atual, ...dados, totalParcelas: atual.totalParcelas };
    await conferirVinculos(cliente, usuarioId, novo);

    await cliente.query(
      `UPDATE lancamentos SET tipo = $3, descricao = $4, valor = $5, data = $6,
         categoria_id = $7, fonte_destino_id = $8
       WHERE usuario_id = $1 AND id = $2`,
      [usuarioId, id, novo.tipo, novo.descricao, deCentavos(paraCentavos(novo.valor)), novo.data,
        novo.categoriaId, novo.fonteDestinoId],
    );
    const { rows } = await cliente.query(
      `SELECT ${COLUNAS} ${JUNCOES} WHERE l.usuario_id = $1 AND l.id = $2`,
      [usuarioId, id],
    );
    return paraApi(rows[0]);
  });
}

// Devolve true se excluiu algo. Com todasParcelas, exclui o grupo inteiro da compra.
export async function excluir(usuarioId, id, { todasParcelas = false } = {}) {
  const sql = todasParcelas
    ? `DELETE FROM lancamentos
       WHERE usuario_id = $1 AND (id = $2 OR grupo_parcelamento = (
         SELECT grupo_parcelamento FROM lancamentos WHERE usuario_id = $1 AND id = $2))`
    : 'DELETE FROM lancamentos WHERE usuario_id = $1 AND id = $2';
  const { rowCount } = await consultar(sql, [usuarioId, id]);
  return rowCount > 0;
}
