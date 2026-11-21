import { Navigate, Route, Routes } from 'react-router-dom';
import RotaProtegida from './components/layout/RotaProtegida.jsx';
import Layout from './components/layout/Layout.jsx';
import Login from './components/paginas/Login.jsx';
import Cadastro from './components/paginas/Cadastro.jsx';
import EmConstrucao from './components/paginas/EmConstrucao.jsx';
import Categorias from './components/paginas/Categorias.jsx';
import FontesDestinos from './components/paginas/FontesDestinos.jsx';
import Relatorios from './components/paginas/Relatorios.jsx';
import Faturas from './components/paginas/Faturas.jsx';
import Dashboard from './components/paginas/Dashboard.jsx';
import Lancamentos from './components/paginas/Lancamentos.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      <Route element={<RotaProtegida />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/fontes-destinos" element={<FontesDestinos />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/faturas" element={<Faturas />} />
          <Route path="/saude-financeira" element={<EmConstrucao titulo="Saúde financeira" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
