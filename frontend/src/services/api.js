// Único ponto de comunicação com a API. Toda tela usa esta instância.
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Preenchidos pelo AuthContext com configurarSessao().
let obterToken = () => null;
let aoExpirar = () => {};

export function configurarSessao(opcoes) {
  obterToken = opcoes.obterToken;
  aoExpirar = opcoes.aoExpirar;
}

// Injeta o token em todas as requisições.
api.interceptors.request.use((requisicao) => {
  const token = obterToken();
  if (token) requisicao.headers.Authorization = `Bearer ${token}`;
  return requisicao;
});

// 401 = token ausente, inválido ou expirado: encerra a sessão e volta ao login.
// No próprio /auth/login, 401 significa só "senha errada" e é tratado pela tela.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    if (erro.response?.status === 401 && erro.config?.url !== '/auth/login') {
      aoExpirar();
    }
    return Promise.reject(erro);
  },
);

// Converte qualquer erro do axios para { mensagem, campos } (formato de erro da API).
export function extrairErro(erro) {
  if (!erro.response) {
    return { mensagem: 'Não foi possível conectar ao servidor.', campos: {} };
  }
  const { erro: mensagem, campos } = erro.response.data ?? {};
  return { mensagem: mensagem ?? 'Erro inesperado.', campos: campos ?? {} };
}
