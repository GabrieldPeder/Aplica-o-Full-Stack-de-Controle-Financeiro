// Sessão do usuário: token JWT e dados básicos, persistidos no localStorage.
// O PR 1 acrescenta login, cadastrar, carregando e a validação via /auth/me.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { configurarSessao } from '../services/api.js';

const CHAVE_TOKEN = 'financas.token';
const CHAVE_USUARIO = 'financas.usuario';

function lerUsuarioSalvo() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_USUARIO));
  } catch {
    return null; // JSON corrompido: trata como deslogado
  }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(lerUsuarioSalvo);
  const [token, setToken] = useState(() => (lerUsuarioSalvo() ? localStorage.getItem(CHAVE_TOKEN) : null));

  // O interceptor do axios lê o token atual por esta referência.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
    setToken(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    configurarSessao({ obterToken: () => tokenRef.current, aoExpirar: logout });
  }, [logout]);

  return <AuthContext.Provider value={{ usuario, token, logout }}>{children}</AuthContext.Provider>;
}

// oxlint-disable-next-line react/only-export-components -- o hook mora junto do contexto que ele lê
export function useAuth() {
  return useContext(AuthContext);
}
