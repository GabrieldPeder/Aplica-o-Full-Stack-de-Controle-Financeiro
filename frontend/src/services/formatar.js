// Formatação de valores para exibição e máscaras de campos.

export function somenteDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

// '52998224725' → '529.982.247-25' (aplica a máscara enquanto a pessoa digita)
export function mascaraCpf(texto) {
  const d = somenteDigitos(texto).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

const FORMATO_REAL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// 1500.5 → 'R$ 1.500,50'
export function moeda(valor) {
  return FORMATO_REAL.format(Number(valor ?? 0));
}

// '2026-11-03' → '03/11/2026'
export function dataBr(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// '2026-12' → 'dez/2026'
export function mesAno(referencia) {
  const [ano, mes] = referencia.split('-');
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

const doisDigitos = (n) => String(n).padStart(2, '0');

// Primeiro e último dia do mês atual, no formato AAAA-MM-DD (horário do navegador).
export function mesAtual(hoje = new Date()) {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return { inicio: `${ano}-${doisDigitos(mes)}-01`, fim: `${ano}-${doisDigitos(mes)}-${doisDigitos(ultimoDia)}` };
}
