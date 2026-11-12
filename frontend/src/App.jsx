import { Navigate, Route, Routes } from 'react-router-dom';
import EmConstrucao from './components/paginas/EmConstrucao.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<EmConstrucao titulo="Login" />} />
      <Route path="/cadastro" element={<EmConstrucao titulo="Cadastro" />} />
      <Route path="/" element={<EmConstrucao titulo="Dashboard" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
