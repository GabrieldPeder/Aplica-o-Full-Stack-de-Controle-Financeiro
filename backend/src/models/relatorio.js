// Relatórios: agregações no banco (GROUP BY, SUM), sempre filtradas pelo usuário (RF3).
// As somas saem em centavos inteiros (SUM(valor) * 100) e só viram reais no final,
// para não acumular erro de arredondamento.
import { consultar } from '../config/db.js';
import { deCentavos } from '../config/dinheiro.js';
import { periodoAnterior } from '../config/datas.js';

const reais = (centavos) => deCentavos(Number(centavos));

async function somarPorFonteDestino(usuarioId, tipo, { inicio, fim }) {
  const { rows } = await consultar(
    `SELECT f.id, f.nome, f.tipo, (SUM(l.valor) * 100)::bigint AS centavos
     FROM lancamentos l
     JOIN fontes_destinos f ON f.id = l.fonte_destino_id
     WHERE l.usuario_id = $1 AND l.tipo = $2 AND l.data BETWEEN $3 AND $4
     GROUP BY f.id
     ORDER BY centavos DESC, f.nome`,
    [usuarioId, tipo, inicio, fim],
  );
  return rows.map(({ id, nome, tipo: tipoFonte, centavos }) => ({ id, nome, tipo: tipoFonte, total: reais(centavos) }));
}

// RF8 — entradas por fonte, saídas por destino e saldo das contas no período.
// Compras parceladas contam inteiras na data da compra (especificação, seção 3).
export async function porFonteDestino(usuarioId, periodo) {
  const [entradasPorFonte, saidasPorDestino, { rows: contas }] = await Promise.all([
    somarPorFonteDestino(usuarioId, 'entrada', periodo),
    somarPorFonteDestino(usuarioId, 'saida', periodo),
    consultar(
      `SELECT f.id, f.nome,
         (COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) * 100)::bigint AS entradas,
         (COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0) * 100)::bigint AS saidas
       FROM fontes_destinos f
       LEFT JOIN lancamentos l ON l.fonte_destino_id = f.id AND l.data BETWEEN $2 AND $3
       WHERE f.usuario_id = $1 AND f.tipo = 'conta'
       GROUP BY f.id
       ORDER BY f.nome`,
      [usuarioId, periodo.inicio, periodo.fim],
    ),
  ]);

  const somar = (lista) => reais(lista.reduce((total, item) => total + Math.round(item.total * 100), 0));

  return {
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    totalEntradas: somar(entradasPorFonte),
    totalSaidas: somar(saidasPorDestino),
    entradasPorFonte,
    saidasPorDestino,
    saldoContas: contas.map(({ id, nome, entradas, saidas }) => ({
      id,
      nome,
      entradas: reais(entradas),
      saidas: reais(saidas),
      saldo: reais(Number(entradas) - Number(saidas)),
    })),
  };
}

// Soma por categoria de um tipo, no período atual e no anterior, numa consulta só.
async function somarPorCategoria(usuarioId, tipo, atual, anterior) {
  const { rows } = await consultar(
    `SELECT c.id, c.nome,
       (COALESCE(SUM(l.valor) FILTER (WHERE l.data BETWEEN $3 AND $4), 0) * 100)::bigint AS atual,
       (COALESCE(SUM(l.valor) FILTER (WHERE l.data BETWEEN $5 AND $6), 0) * 100)::bigint AS anterior
     FROM lancamentos l
     JOIN categorias c ON c.id = l.categoria_id
     WHERE l.usuario_id = $1 AND l.tipo = $2
       AND (l.data BETWEEN $3 AND $4 OR l.data BETWEEN $5 AND $6)
     GROUP BY c.id`,
    [usuarioId, tipo, atual.inicio, atual.fim, anterior.inicio, anterior.fim],
  );
  return rows.map(({ id, nome, atual: a, anterior: b }) => ({ id, nome, atual: Number(a), anterior: Number(b) }));
}

// RF7 — saídas por categoria (com % do total e comparação com o período anterior) e
// entradas por categoria. Categorias com valor só no período anterior aparecem com total 0.
export async function porCategoria(usuarioId, periodo) {
  const anterior = periodoAnterior(periodo);
  const [saidas, entradas] = await Promise.all([
    somarPorCategoria(usuarioId, 'saida', periodo, anterior),
    somarPorCategoria(usuarioId, 'entrada', periodo, anterior),
  ]);

  const totalSaidas = saidas.reduce((t, c) => t + c.atual, 0);
  const totalEntradas = entradas.reduce((t, c) => t + c.atual, 0);
  const porTotal = (x, y) => y.atual - x.atual || x.nome.localeCompare(y.nome, 'pt-BR');

  return {
    periodo: { inicio: periodo.inicio, fim: periodo.fim },
    periodoAnterior: anterior,
    totalSaidas: reais(totalSaidas),
    totalEntradas: reais(totalEntradas),
    saidas: saidas.sort(porTotal).map((c) => ({
      id: c.id,
      nome: c.nome,
      total: reais(c.atual),
      percentual: totalSaidas > 0 ? Math.round((c.atual * 10000) / totalSaidas) / 100 : 0,
      totalAnterior: reais(c.anterior),
      variacao: reais(c.atual - c.anterior),
    })),
    entradas: entradas
      .filter((c) => c.atual > 0)
      .sort(porTotal)
      .map((c) => ({ id: c.id, nome: c.nome, total: reais(c.atual) })),
  };
}
