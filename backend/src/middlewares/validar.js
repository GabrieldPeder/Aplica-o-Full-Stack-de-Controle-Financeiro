// Validação e normalização da entrada das rotas.
//
// Uso:   router.post('/', validar({ body: { nome: texto({ max: 60 }), tipo: umDe(['entrada', 'saida']) } }), ...)
//
// O resultado já normalizado fica em req.dados (corpo), req.filtros (query string) e
// req.parametros (parâmetros da URL). Campos que não estão nas regras são descartados.
// Se algum campo estiver errado, responde 400 com TODOS os erros: { erro, campos }.
//
// Uma regra é uma função (valor, corpoOriginal) => ({ valor }) ou ({ erro: 'mensagem' }).
import { cpfValido, somenteDigitos } from '../config/cpf.js';

const OBRIGATORIO = 'Campo obrigatório.';
const MAIOR_INTEIRO = 2147483647; // limite do tipo INTEGER do PostgreSQL

const vazio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

function aplicar(regras, entrada) {
  const valores = {};
  const campos = {};
  for (const [campo, regra] of Object.entries(regras)) {
    const resultado = regra(entrada?.[campo], entrada ?? {});
    if (resultado.erro) campos[campo] = resultado.erro;
    else valores[campo] = resultado.valor;
  }
  return { valores, campos };
}

export function validar({ body, query, params }) {
  return (req, res, next) => {
    const camposComErro = {};
    const partes = [
      [body, req.body, 'dados'],
      [query, req.query, 'filtros'],
      [params, req.params, 'parametros'],
    ];
    for (const [regras, entrada, destino] of partes) {
      if (!regras) continue;
      const { valores, campos } = aplicar(regras, entrada);
      Object.assign(camposComErro, campos);
      req[destino] = valores;
    }
    if (Object.keys(camposComErro).length > 0) {
      return res.status(400).json({ erro: 'Dados inválidos.', campos: camposComErro });
    }
    next();
  };
}

// ---------- regras prontas ----------

export function texto({ min = 1, max = 255, opcional = false } = {}) {
  return (valor) => {
    if (vazio(valor)) return opcional ? { valor: null } : { erro: OBRIGATORIO };
    if (typeof valor !== 'string') return { erro: OBRIGATORIO };
    const limpo = valor.trim();
    if (limpo.length < min) return { erro: `Mínimo de ${min} caracteres.` };
    if (limpo.length > max) return { erro: `Máximo de ${max} caracteres.` };
    return { valor: limpo };
  };
}

export function email() {
  return (valor) => {
    if (vazio(valor)) return { erro: OBRIGATORIO };
    const limpo = String(valor).trim().toLowerCase();
    if (limpo.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) return { erro: 'E-mail inválido.' };
    return { valor: limpo };
  };
}

export function cpf() {
  return (valor) => {
    if (vazio(valor)) return { erro: OBRIGATORIO };
    if (!cpfValido(valor)) return { erro: 'CPF inválido.' };
    return { valor: somenteDigitos(valor) };
  };
}

export function senha() {
  return (valor) => {
    if (vazio(valor)) return { erro: OBRIGATORIO };
    const s = String(valor);
    if (s.length < 8 || s.length > 72 || !/[A-Za-z]/.test(s) || !/\d/.test(s)) {
      return { erro: 'A senha deve ter pelo menos 8 caracteres, com letras e números.' };
    }
    return { valor: s };
  };
}

// Compara com outro campo do corpo original (ex.: confirmacaoSenha === senha).
export function igualA(outroCampo, mensagem) {
  return (valor, corpo) => {
    if (vazio(valor)) return { erro: OBRIGATORIO };
    if (valor !== corpo[outroCampo]) return { erro: mensagem };
    return { valor };
  };
}

export function umDe(opcoes, { opcional = false } = {}) {
  return (valor) => {
    if (vazio(valor)) return opcional ? { valor: null } : { erro: OBRIGATORIO };
    if (!opcoes.includes(valor)) return { erro: 'Valor inválido.' };
    return { valor };
  };
}

export function inteiro({ min = 1, max = MAIOR_INTEIRO, opcional = false, padrao } = {}) {
  return (valor) => {
    if (vazio(valor)) {
      if (padrao !== undefined) return { valor: padrao };
      return opcional ? { valor: null } : { erro: OBRIGATORIO };
    }
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < min || numero > max) {
      return { erro: `Informe um número inteiro entre ${min} e ${max}.` };
    }
    return { valor: numero };
  };
}

// Valor em reais: número maior que zero com no máximo 2 casas decimais.
export function dinheiro({ opcional = false } = {}) {
  return (valor) => {
    if (vazio(valor)) return opcional ? { valor: null } : { erro: OBRIGATORIO };
    const numero = Number(valor);
    const duasCasas = Number.isFinite(numero) && Math.abs(Math.round(numero * 100) - numero * 100) < 1e-6;
    if (!duasCasas || numero <= 0 || numero > 9999999999.99) {
      return { erro: 'Informe um valor maior que zero, com até 2 casas decimais.' };
    }
    return { valor: numero };
  };
}

export function booleano({ padrao } = {}) {
  return (valor) => {
    if (valor === undefined || valor === null) {
      return padrao !== undefined ? { valor: padrao } : { erro: OBRIGATORIO };
    }
    if (typeof valor !== 'boolean') return { erro: 'Valor inválido.' };
    return { valor };
  };
}

// Aplica a regra só quando condicao(corpo) for verdadeira; senão o campo fica null.
// Ex.: dia de fechamento só existe para cartão de crédito.
export function quando(condicao, regra) {
  return (valor, corpo) => (condicao(corpo) ? regra(valor, corpo) : { valor: null });
}
