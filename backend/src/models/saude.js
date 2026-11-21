// Saúde financeira (desafio). Tudo calculado aqui no back-end, em centavos, a partir dos
// últimos 3 meses completos e das parcelas futuras já conhecidas. Sem API de linguagem.
// Os limites das dicas ficam nas constantes abaixo (e estão documentados no README).
import { consultar } from '../config/db.js';
import { calcularFatura, hojeIso, ultimoDiaDoMes } from '../config/datas.js';
import { paraCentavos, deCentavos } from '../config/dinheiro.js';

export const LIMITES = {
  poupancaAlerta: 10, // taxa de poupança < 10% → alerta
  poupancaElogio: 20, // ≥ 20% → elogio
  comprometimentoAlerta: 30, // próximas 3 faturas > 30% da renda de 3 meses → alerta
  categoriaAcimaDaMedia: 30, // gasto do mês atual > 30% acima da média → alerta
  reservaAlertaMeses: 3, // reserva < 3 meses de gastos → alerta
  reservaElogioMeses: 6, // ≥ 6 meses → elogio
};
const MESES_ANALISADOS = 3;
const MESES_PROJECAO = 6;
const AVISO = 'Conteúdo educativo; não constitui recomendação financeira profissional.';

const dois = (n) => String(n).padStart(2, '0');
const reais = (centavos) => deCentavos(Math.round(centavos));
const porcento = (parte, todo) => (todo > 0 ? Math.round((parte * 10000) / todo) / 100 : null);

// Mês deslocado k meses a partir de 'AAAA-MM-DD' → { referencia: 'AAAA-MM', inicio, fim }.
export function mesRelativo(hoje, k) {
  const [ano, mes] = hoje.split('-').map(Number);
  const total = ano * 12 + (mes - 1) + k;
  const a = Math.floor(total / 12);
  const m = total % 12;
  const referencia = `${a}-${dois(m + 1)}`;
  return { referencia, inicio: `${referencia}-01`, fim: `${referencia}-${dois(ultimoDiaDoMes(a, m))}` };
}

// Entradas e saídas por mês (à vista e parceladas separadas), nos meses pedidos.
async function totaisPorMes(usuarioId, inicio, fim) {
  const { rows } = await consultar(
    `SELECT to_char(data, 'YYYY-MM') AS referencia,
       (COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) * 100)::bigint AS entradas,
       (COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'), 0) * 100)::bigint AS saidas,
       (COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida' AND total_parcelas = 1), 0) * 100)::bigint AS saidas_a_vista
     FROM lancamentos
     WHERE usuario_id = $1 AND data BETWEEN $2 AND $3
     GROUP BY 1`,
    [usuarioId, inicio, fim],
  );
  return new Map(rows.map((r) => [r.referencia, {
    entradas: Number(r.entradas), saidas: Number(r.saidas), saidasAVista: Number(r.saidas_a_vista),
  }]));
}

// Parcelas e compras no cartão que vencem depois de hoje, agrupadas pelo mês da fatura.
async function faturasFuturas(usuarioId, hoje) {
  const { rows } = await consultar(
    `SELECT l.valor, l.data, l.parcela_atual, l.total_parcelas, f.dia_fechamento, f.dia_vencimento
     FROM lancamentos l
     JOIN fontes_destinos f ON f.id = l.fonte_destino_id
     WHERE l.usuario_id = $1 AND l.tipo = 'saida' AND f.tipo = 'cartao_credito'`,
    [usuarioId],
  );
  const cartaoPorMes = new Map(); // tudo que vence no cartão (à vista e parcelado)
  const parcelasPorMes = new Map(); // só parcelas de compras parceladas
  for (const r of rows) {
    const { referencia, vencimento } = calcularFatura(r.data, { diaFechamento: r.dia_fechamento, diaVencimento: r.dia_vencimento }, r.parcela_atual);
    if (vencimento <= hoje) continue;
    const centavos = paraCentavos(r.valor);
    cartaoPorMes.set(referencia, (cartaoPorMes.get(referencia) ?? 0) + centavos);
    if (r.total_parcelas > 1) parcelasPorMes.set(referencia, (parcelasPorMes.get(referencia) ?? 0) + centavos);
  }
  return { cartaoPorMes, parcelasPorMes };
}

async function gastosPorCategoria(usuarioId, inicio, fim, inicioAtual) {
  const { rows } = await consultar(
    `SELECT c.id, c.nome,
       (COALESCE(SUM(l.valor) FILTER (WHERE l.data < $4), 0) * 100)::bigint AS anteriores,
       (COALESCE(SUM(l.valor) FILTER (WHERE l.data >= $4), 0) * 100)::bigint AS atual
     FROM lancamentos l JOIN categorias c ON c.id = l.categoria_id
     WHERE l.usuario_id = $1 AND l.tipo = 'saida' AND l.data BETWEEN $2 AND $3
     GROUP BY c.id`,
    [usuarioId, inicio, fim, inicioAtual],
  );
  return rows.map((r) => ({ id: r.id, nome: r.nome, anteriores: Number(r.anteriores), atual: Number(r.atual) }));
}

async function saldoReserva(usuarioId) {
  const { rows: [r] } = await consultar(
    `SELECT COUNT(DISTINCT f.id)::int AS contas,
       (COALESCE(SUM(CASE l.tipo WHEN 'entrada' THEN l.valor WHEN 'saida' THEN -l.valor END), 0) * 100)::bigint AS saldo
     FROM fontes_destinos f
     LEFT JOIN lancamentos l ON l.fonte_destino_id = f.id
     WHERE f.usuario_id = $1 AND f.reserva`,
    [usuarioId],
  );
  return { contas: r.contas, centavos: Number(r.saldo) };
}

export async function calcular(usuarioId, { hoje = hojeIso() } = {}) {
  const meses = Array.from({ length: MESES_ANALISADOS }, (_, i) => mesRelativo(hoje, i - MESES_ANALISADOS)); // -3, -2, -1
  const atual = mesRelativo(hoje, 0);
  const [porMes, futuras, categorias, reserva] = await Promise.all([
    totaisPorMes(usuarioId, meses[0].inicio, meses.at(-1).fim),
    faturasFuturas(usuarioId, hoje),
    gastosPorCategoria(usuarioId, meses[0].inicio, atual.fim, atual.inicio),
    saldoReserva(usuarioId),
  ]);

  const historico = meses.map(({ referencia }) => ({ referencia, entradas: 0, saidas: 0, saidasAVista: 0, ...porMes.get(referencia) }));
  const media = (campo) => historico.reduce((t, m) => t + m[campo], 0) / MESES_ANALISADOS;
  const mediaEntradas = media('entradas');
  const mediaSaidas = media('saidas');
  const mediaSaidasAVista = media('saidasAVista');
  const semHistorico = historico.every((m) => m.entradas === 0 && m.saidas === 0);
  const dicas = [];

  // 1. Taxa de poupança, por mês e média.
  const taxaMedia = porcento(mediaEntradas - mediaSaidas, mediaEntradas);
  const poupanca = {
    porMes: historico.map((m) => ({ referencia: m.referencia, entradas: reais(m.entradas), saidas: reais(m.saidas), taxa: porcento(m.entradas - m.saidas, m.entradas) })),
    media: taxaMedia,
  };
  if (taxaMedia !== null && taxaMedia < LIMITES.poupancaAlerta) {
    dicas.push({ tipo: 'alerta', indicador: 'poupanca', texto: `Você guardou em média ${taxaMedia.toLocaleString('pt-BR')}% da renda nos últimos 3 meses. Tente chegar a pelo menos ${LIMITES.poupancaAlerta}% revendo os gastos das maiores categorias.` });
  } else if (taxaMedia !== null && taxaMedia >= LIMITES.poupancaElogio) {
    dicas.push({ tipo: 'elogio', indicador: 'poupanca', texto: `Ótimo! Você guardou em média ${taxaMedia.toLocaleString('pt-BR')}% da renda nos últimos 3 meses.` });
  }

  // 2. Comprometimento com cartões: próximas 3 faturas ÷ renda de 3 meses.
  const proximas = [1, 2, 3].map((k) => mesRelativo(hoje, k - 1).referencia);
  // A fatura do mês atual só conta se ainda não venceu (as já vencidas foram filtradas acima).
  const somaFaturas = proximas.reduce((t, ref) => t + (futuras.cartaoPorMes.get(ref) ?? 0), 0);
  const comprometimento = {
    proximasFaturas: reais(somaFaturas),
    rendaTresMeses: reais(mediaEntradas * 3),
    percentual: porcento(somaFaturas, mediaEntradas * 3),
  };
  if (comprometimento.percentual !== null && comprometimento.percentual > LIMITES.comprometimentoAlerta) {
    dicas.push({ tipo: 'alerta', indicador: 'comprometimento', texto: `As próximas 3 faturas dos cartões comprometem ${comprometimento.percentual.toLocaleString('pt-BR')}% da sua renda do período. Evite novas compras parceladas até reduzir para menos de ${LIMITES.comprometimentoAlerta}%.` });
  }

  // 3. Parcelas futuras por mês.
  const parcelasFuturas = [...futuras.parcelasPorMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([referencia, centavos]) => ({ referencia, total: reais(centavos) }));
  const totalParcelas = [...futuras.parcelasPorMes.values()].reduce((t, c) => t + c, 0);
  if (totalParcelas > 0) {
    dicas.push({ tipo: 'info', indicador: 'parcelas', texto: `Você tem ${reais(totalParcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em parcelas a vencer; a última cai na fatura de ${parcelasFuturas.at(-1).referencia.split('-').reverse().join('/')}.` });
  }

  // 4. Categorias fora da curva: gasto do mês atual vs média dos 3 meses anteriores.
  const foraDaCurva = categorias
    .map((c) => {
      const mediaCat = c.anteriores / MESES_ANALISADOS;
      return { id: c.id, nome: c.nome, atual: reais(c.atual), media: reais(mediaCat), acima: mediaCat > 0 ? porcento(c.atual - mediaCat, mediaCat) : null };
    })
    .filter((c) => c.acima !== null && c.acima > LIMITES.categoriaAcimaDaMedia)
    .sort((a, b) => b.acima - a.acima);
  for (const c of foraDaCurva) {
    dicas.push({ tipo: 'alerta', indicador: 'categoria', texto: `Os gastos com ${c.nome} neste mês já estão ${c.acima.toLocaleString('pt-BR')}% acima da média dos últimos 3 meses.` });
  }

  // 5. Reserva de emergência em meses de gastos.
  const mesesCobertos = mediaSaidas > 0 ? Math.round((reserva.centavos / mediaSaidas) * 10) / 10 : null;
  const reservaInfo = { contas: reserva.contas, saldo: reais(reserva.centavos), mediaSaidasMensal: reais(mediaSaidas), meses: mesesCobertos };
  if (reserva.contas === 0) {
    dicas.push({ tipo: 'alerta', indicador: 'reserva', texto: 'Nenhuma conta está marcada como reserva de emergência. Marque a conta onde você guarda dinheiro em "Fontes e destinos".' });
  } else if (mesesCobertos !== null && mesesCobertos < LIMITES.reservaAlertaMeses) {
    dicas.push({ tipo: 'alerta', indicador: 'reserva', texto: `Sua reserva cobre ${mesesCobertos.toLocaleString('pt-BR')} mês(es) de gastos. O recomendado é ter de ${LIMITES.reservaAlertaMeses} a ${LIMITES.reservaElogioMeses} meses guardados.` });
  } else if (mesesCobertos !== null && mesesCobertos >= LIMITES.reservaElogioMeses) {
    dicas.push({ tipo: 'elogio', indicador: 'reserva', texto: `Muito bem! Sua reserva cobre ${mesesCobertos.toLocaleString('pt-BR')} meses de gastos.` });
  }

  // 6. Projeção dos próximos 6 meses: média de entradas − média de saídas à vista − parcelas conhecidas.
  // (Compras parceladas entram pelas parcelas de cada mês, não pela data da compra.)
  let acumulado = 0;
  const projecao = Array.from({ length: MESES_PROJECAO }, (_, i) => {
    const { referencia } = mesRelativo(hoje, i + 1);
    const parcelas = futuras.parcelasPorMes.get(referencia) ?? 0;
    const saldo = mediaEntradas - mediaSaidasAVista - parcelas;
    acumulado += saldo;
    return { referencia, entradas: reais(mediaEntradas), saidas: reais(mediaSaidasAVista + parcelas), parcelas: reais(parcelas), saldo: reais(saldo), acumulado: reais(acumulado) };
  });
  const negativo = projecao.find((m) => m.saldo < 0);
  if (!semHistorico && negativo) {
    dicas.push({ tipo: 'alerta', indicador: 'projecao', texto: `Mantido o ritmo atual, o mês ${negativo.referencia.split('-').reverse().join('/')} deve fechar no vermelho. Reduza gastos ou adie compras antes disso.` });
  }

  return {
    referencia: { meses: meses.map((m) => m.referencia), hoje },
    semHistorico,
    poupanca,
    comprometimento,
    parcelasFuturas,
    categoriasForaDaCurva: foraDaCurva,
    reserva: reservaInfo,
    projecao,
    dicas,
    limites: LIMITES,
    aviso: AVISO,
  };
}
