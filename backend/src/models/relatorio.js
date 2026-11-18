// Relatórios: agregações no banco (GROUP BY, SUM), sempre filtradas pelo usuário (RF3).
// As somas saem em centavos inteiros (SUM(valor) * 100) e só viram reais no final,
// para não acumular erro de arredondamento.
import { consultar } from '../config/db.js';
import { deCentavos } from '../config/dinheiro.js';

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
