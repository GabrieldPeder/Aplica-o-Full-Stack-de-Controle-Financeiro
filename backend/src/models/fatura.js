// Previsão das faturas dos cartões de crédito (RF9).
// Cada parcela guarda a data da COMPRA; a fatura em que ela cai é calculada aqui com
// calcularFatura(data, cartão, parcela). Mudar o dia de fechamento recalcula tudo.
import { consultar } from '../config/db.js';
import { calcularFatura, hojeIso } from '../config/datas.js';
import { paraCentavos, deCentavos } from '../config/dinheiro.js';

// meses: quantas faturas além da atual; hoje: 'AAAA-MM-DD' (os testes passam uma data fixa).
export async function previsao(usuarioId, { meses = 3, hoje = hojeIso() } = {}) {
  const { rows: cartoes } = await consultar(
    `SELECT id, nome, dia_fechamento, dia_vencimento, limite
     FROM fontes_destinos
     WHERE usuario_id = $1 AND tipo = 'cartao_credito'
     ORDER BY nome`,
    [usuarioId],
  );
  // Só saídas compõem fatura (uma entrada no cartão, como estorno, não entra).
  const { rows: compras } = await consultar(
    `SELECT id, fonte_destino_id, descricao, valor, data, parcela_atual, total_parcelas
     FROM lancamentos
     WHERE usuario_id = $1 AND tipo = 'saida'
       AND fonte_destino_id IN (SELECT id FROM fontes_destinos WHERE usuario_id = $1 AND tipo = 'cartao_credito')
     ORDER BY data, id`,
    [usuarioId],
  );

  return {
    cartoes: cartoes.map((linha) => {
      const cartao = { diaFechamento: linha.dia_fechamento, diaVencimento: linha.dia_vencimento };

      // A fatura atual é aquela em que cairia uma compra feita hoje; as seguintes, mês a mês.
      const faturas = [];
      for (let i = 0; i <= meses; i++) {
        faturas.push({ ...calcularFatura(hoje, cartao, i + 1), atual: i === 0, centavos: 0, itens: [] });
      }
      const porReferencia = new Map(faturas.map((f) => [f.referencia, f]));

      let utilizadoCentavos = 0;
      for (const compra of compras.filter((c) => c.fonte_destino_id === linha.id)) {
        const centavos = paraCentavos(compra.valor);
        const { referencia, vencimento } = calcularFatura(compra.data, cartao, compra.parcela_atual);
        if (vencimento >= hoje) utilizadoCentavos += centavos; // parcela ainda não vencida ocupa o limite

        const destino = porReferencia.get(referencia);
        if (!destino) continue; // fatura fora da janela mostrada
        destino.centavos += centavos;
        destino.itens.push({
          id: compra.id,
          descricao: compra.descricao,
          parcela: `${compra.parcela_atual}/${compra.total_parcelas}`,
          valor: deCentavos(centavos),
          dataCompra: compra.data,
        });
      }

      const limiteCentavos = paraCentavos(linha.limite);
      return {
        id: linha.id,
        nome: linha.nome,
        diaFechamento: linha.dia_fechamento,
        diaVencimento: linha.dia_vencimento,
        limite: deCentavos(limiteCentavos),
        limiteUtilizado: deCentavos(utilizadoCentavos),
        limiteDisponivel: deCentavos(limiteCentavos - utilizadoCentavos),
        faturas: faturas.map(({ centavos, ...f }) => ({ ...f, total: deCentavos(centavos) })),
      };
    }),
  };
}
