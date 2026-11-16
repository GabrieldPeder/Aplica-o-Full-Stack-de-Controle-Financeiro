import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { extrairErro } from '../../services/api.js';
import CampoTexto from '../comuns/CampoTexto.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';

export default function Login() {
  const { usuario, login } = useAuth();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to={local.state?.voltarPara ?? '/'} replace />;

  async function enviar(evento) {
    evento.preventDefault();
    const novosErros = {};
    if (!email.trim()) novosErros.email = 'Informe o e-mail.';
    if (!senha) novosErros.senha = 'Informe a senha.';
    setErros(novosErros);
    setMensagem('');
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    try {
      await login(email, senha);
    } catch (erro) {
      const { mensagem: msg, campos } = extrairErro(erro);
      setErros(campos);
      setMensagem(msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="pagina-acesso">
      <form className="cartao-acesso" onSubmit={enviar} noValidate>
        <h1>Entrar</h1>
        <MensagemErro mensagem={mensagem} />
        <CampoTexto rotulo="E-mail" nome="email" tipo="email" valor={email} aoMudar={setEmail} erro={erros.email} autoComplete="email" />
        <CampoTexto rotulo="Senha" nome="senha" tipo="password" valor={senha} aoMudar={setSenha} erro={erros.senha} autoComplete="current-password" />
        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p>
          Ainda não tem conta? <Link to="/cadastro">Cadastre-se</Link>
        </p>
      </form>
    </main>
  );
}
