// Estrutura das páginas internas: menu lateral + conteúdo da página atual.
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const MENU = [
  { para: '/', texto: 'Dashboard' },
  { para: '/lancamentos', texto: 'Lançamentos' },
  { para: '/categorias', texto: 'Categorias' },
  { para: '/fontes-destinos', texto: 'Fontes e destinos' },
  { para: '/relatorios', texto: 'Relatórios' },
  { para: '/faturas', texto: 'Faturas' },
  { para: '/saude-financeira', texto: 'Saúde financeira' },
];

export default function Layout() {
  const { usuario, logout } = useAuth();

  return (
    <div className="layout">
      <aside className="menu">
        <strong className="menu-titulo">Controle Financeiro</strong>
        <nav>
          {MENU.map(({ para, texto }) => (
            <NavLink key={para} to={para} end={para === '/'}>
              {texto}
            </NavLink>
          ))}
        </nav>
        <div className="menu-rodape">
          <span>{usuario.nome}</span>
          <button type="button" className="botao-secundario" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}
