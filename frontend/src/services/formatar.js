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
