// Utilitários de datas (funções puras). Datas trafegam como texto 'AAAA-MM-DD' e as contas
// são feitas em UTC, para o fuso horário não mudar o dia.

// mes: 0 a 11
export function ultimoDiaDoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

// Aceita mes > 11 (vira o ano seguinte) e ajusta dias inexistentes (31 em fevereiro → 28/29).
function dataSegura(ano, mes, dia) {
  const a = ano + Math.floor(mes / 12);
  const m = ((mes % 12) + 12) % 12;
  return new Date(Date.UTC(a, m, Math.min(dia, ultimoDiaDoMes(a, m))));
}

const iso = (data) => data.toISOString().slice(0, 10);

// Em qual fatura cai a parcela de uma compra no cartão (regra de fechamento do RF9,
// implementação de referência do enunciado).
//   dataCompra: 'AAAA-MM-DD'; cartao: { diaFechamento, diaVencimento }; numeroParcela: 1, 2, ...
//   → { referencia: 'AAAA-MM' (mês do vencimento), fechamento: 'AAAA-MM-DD', vencimento: 'AAAA-MM-DD' }
export function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
  const [ano, mes, dia] = dataCompra.split('-').map(Number);
  const m = mes - 1;
  const fechamentoDoMes = Math.min(cartao.diaFechamento, ultimoDiaDoMes(ano, m));

  let mesFechamento = dia < fechamentoDoMes ? m : m + 1; // no dia do fechamento ou depois: fatura seguinte
  mesFechamento += numeroParcela - 1; // parcela k: k − 1 meses depois

  const fechamento = dataSegura(ano, mesFechamento, cartao.diaFechamento);
  const mesVencimento = cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : mesFechamento + 1;
  const vencimento = dataSegura(ano, mesVencimento, cartao.diaVencimento);

  return { referencia: iso(vencimento).slice(0, 7), fechamento: iso(fechamento), vencimento: iso(vencimento) };
}

// 'AAAA-MM-DD' de uma data que existe no calendário (recusa 2026-02-30).
export function dataValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [ano, mes, dia] = texto.split('-').map(Number);
  return mes >= 1 && mes <= 12 && dia >= 1 && dia <= ultimoDiaDoMes(ano, mes - 1);
}

// Data de hoje no horário de Brasília, como 'AAAA-MM-DD'.
// (às 23h de 18/11 em Brasília já é 19/11 em UTC; para o usuário ainda é dia 18)
const FORMATO_BRASILIA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
export function hojeIso(agora = new Date()) {
  return FORMATO_BRASILIA.format(agora);
}

// Primeiro e último dia do mês de uma data 'AAAA-MM-DD' (padrão dos filtros: mês corrente).
export function inicioDoMes(dataIso = hojeIso()) {
  return `${dataIso.slice(0, 7)}-01`;
}

export function fimDoMes(dataIso = hojeIso()) {
  const [ano, mes] = dataIso.split('-').map(Number);
  return `${dataIso.slice(0, 7)}-${String(ultimoDiaDoMes(ano, mes - 1)).padStart(2, '0')}`;
}

const somarDias = (dataIso, dias) => iso(new Date(Date.parse(`${dataIso}T00:00:00Z`) + dias * 86400000));

// Período imediatamente anterior, para comparar relatórios (especificação 4.5):
// - meses inteiros (de dia 1 ao último dia) → o mesmo número de meses inteiros antes;
//   ex.: outubro → setembro; out–dez → jul–set;
// - qualquer outro intervalo → o mesmo número de dias, logo antes do início.
export function periodoAnterior({ inicio, fim }) {
  const [anoI, mesI, diaI] = inicio.split('-').map(Number);
  const [anoF, mesF, diaF] = fim.split('-').map(Number);
  const mesesInteiros = diaI === 1 && diaF === ultimoDiaDoMes(anoF, mesF - 1);
  if (mesesInteiros) {
    const meses = (anoF - anoI) * 12 + (mesF - mesI) + 1;
    return { inicio: iso(dataSegura(anoI, mesI - 1 - meses, 1)), fim: somarDias(inicio, -1) };
  }
  const dias = Math.round((Date.parse(fim) - Date.parse(inicio)) / 86400000) + 1;
  return { inicio: somarDias(inicio, -dias), fim: somarDias(inicio, -1) };
}
