// Validação de CPF (funções puras).

export function somenteDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

// Confere os dois dígitos verificadores. Aceita com ou sem máscara.
export function cpfValido(cpf) {
  const digitos = somenteDigitos(cpf);
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigito = (quantidade) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) {
      soma += Number(digitos[i]) * (quantidade + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(digitos[9]) && calcularDigito(10) === Number(digitos[10]);
}
