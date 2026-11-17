// Só mostra as páginas internas para quem está logado; senão manda para o login.
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Carregando from '../comuns/Carregando.jsx';

export default function RotaProtegida() {
  const { usuario, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <Carregando texto="Conferindo sua sessão…" />;
  if (!usuario) return <Navigate to="/login" replace state={{ voltarPara: local.pathname }} />;
  return <Outlet />;
}
