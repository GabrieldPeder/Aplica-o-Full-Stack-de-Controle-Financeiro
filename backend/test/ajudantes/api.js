// Funções de apoio para testes de rotas: sobe o servidor e chama a API com fetch.
import { criarApp } from '../../src/server.js';

export function subirServidor() {
  const servidor = criarApp().listen(0);
  return { base: `http://localhost:${servidor.address().port}/api`, fechar: () => servidor.close() };
}

export async function chamar(base, metodo, caminho, { corpo, token } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  const resposta = await fetch(`${base}${caminho}`, {
    method: metodo,
    headers,
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null };
}

// CPF válido diferente a cada chamada (calcula os dígitos verificadores).
let sequencia = Date.now() % 100000000;
export function gerarCpf() {
  const base = String(++sequencia).padStart(9, '1').slice(-9).split('').map(Number);
  const digito = (numeros) => {
    const soma = numeros.reduce((total, n, i) => total + n * (numeros.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  base.push(digito(base));
  base.push(digito(base));
  return base.join('');
}

// Cadastra um usuário novo pela API e devolve o token de login.
export async function criarSessao(base) {
  const email = `teste${gerarCpf()}@email.com`;
  const senha = 'segura123';
  await chamar(base, 'POST', '/auth/cadastro', {
    corpo: { nome: 'Teste', email, cpf: gerarCpf(), senha, confirmacaoSenha: senha },
  });
  const { corpo } = await chamar(base, 'POST', '/auth/login', { corpo: { email, senha } });
  return corpo.token;
}
