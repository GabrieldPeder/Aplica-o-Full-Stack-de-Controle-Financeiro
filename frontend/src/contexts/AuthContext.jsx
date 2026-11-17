// Sessão do usuário: guarda o token JWT (localStorage) e os dados de quem está logado.
// Ao abrir o app com um token salvo, confere com GET /auth/me antes de mostrar as páginas.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, configurarSessao } from '../services/api.js';

const CHAVE_TOKEN = 'financas.token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(CHAVE_TOKEN));
  const [usuario, setUsuario] = useState(null);
  // Com token salvo, as páginas só aparecem depois da conferência no /auth/me.
  const [carregando, setCarregando] = useState(() => Boolean(localStorage.getItem(CHAVE_TOKEN)));

  // O interceptor do axios lê o token por esta referência. Ela é atualizada na hora
  // em salvarSessao/logout, então a primeira requisição depois do login já leva o token.
  const tokenRef = useRef(token);

  const logout = useCallback(() => {
    localStorage.removeItem(CHAVE_TOKEN);
    tokenRef.current = null;
    setToken(null);
    setUsuario(null);
  }, []);

  const salvarSessao = useCallback((novoToken, novoUsuario) => {
    localStorage.setItem(CHAVE_TOKEN, novoToken);
    tokenRef.current = novoToken;
    setToken(novoToken);
    setUsuario(novoUsuario);
  }, []);

  useEffect(() => {
    configurarSessao({ obterToken: () => tokenRef.current, aoExpirar: logout });
  }, [logout]);

  // Confere o token salvo quando o app abre.
  useEffect(() => {
    if (!tokenRef.current) return;
    api
      .get('/auth/me')
      .then(({ data }) => setUsuario(data.usuario))
      .catch(logout) // token inválido/expirado (ou API fora do ar): volta para o login
      .finally(() => setCarregando(false));
  }, [logout]);

  const login = useCallback(
    async (email, senha) => {
      const { data } = await api.post('/auth/login', { email, senha });
      salvarSessao(data.token, data.usuario);
    },
    [salvarSessao],
  );

  // Cadastra e já entra na conta.
  const cadastrar = useCallback(
    async (dados) => {
      await api.post('/auth/cadastro', dados);
      await login(dados.email, dados.senha);
    },
    [login],
  );

  return (
    <AuthContext.Provider value={{ usuario, token, carregando, login, cadastrar, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components -- o hook mora junto do contexto que ele lê
export function useAuth() {
  return useContext(AuthContext);
}
