// Funções puras para dinheiro. Todo cálculo da API é feito em CENTAVOS inteiros,
// porque somar decimais em ponto flutuante dá erro (0.1 + 0.2 = 0.30000000000000004).

export const MAX_PARCELAS = 48;

// 33.34 ou '33.34' (NUMERIC vem do pg como texto) → 3334.
// A validação de "até 2 casas" é feita antes, no middleware validar.
export function paraCentavos(valor) {
  return Math.round(Number(valor) * 100);
}

// 3334 → 33.34
export function deCentavos(centavos) {
  return centavos / 100;
}

// Divide o valor em n parcelas: base = floor(centavos / n) e a 1ª parcela recebe o resto.
// Ex.: 10000 em 3 → [3334, 3333, 3333]. A soma é sempre igual ao total.
export function dividirEmParcelas(centavos, n) {
  if (!Number.isInteger(centavos) || centavos <= 0) {
    throw new RangeError('O valor deve ser um número inteiro de centavos maior que zero.');
  }
  if (!Number.isInteger(n) || n < 1 || n > MAX_PARCELAS) {
    throw new RangeError(`O número de parcelas deve estar entre 1 e ${MAX_PARCELAS}.`);
  }
  const base = Math.floor(centavos / n);
  if (base === 0) {
    throw new RangeError('Cada parcela precisa ter pelo menos R$ 0,01.');
  }
  const parcelas = Array(n).fill(base);
  parcelas[0] += centavos - base * n;
  return parcelas;
}
