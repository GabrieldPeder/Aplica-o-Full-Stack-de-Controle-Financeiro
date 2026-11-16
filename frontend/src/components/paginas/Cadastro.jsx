import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { extrairErro } from '../../services/api.js';
import { somenteDigitos } from '../../services/formatar.js';
import CampoTexto from '../comuns/CampoTexto.jsx';
import CampoCpf from '../comuns/CampoCpf.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';

const VAZIO = { nome: '', email: '', cpf: '', senha: '', confirmacaoSenha: '' };

// Mesmas regras do servidor, para avisar antes de enviar.
function validar(dados) {
  const erros = {};
  if (!dados.nome.trim()) erros.nome = 'Informe o nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email.trim())) erros.email = 'E-mail inválido.';
  if (somenteDigitos(dados.cpf).length !== 11) erros.cpf = 'CPF inválido.';
  if (dados.senha.length < 8 || !/[A-Za-z]/.test(dados.senha) || !/\d/.test(dados.senha)) {
    erros.senha = 'A senha deve ter pelo menos 8 caracteres, com letras e números.';
  }
  if (dados.confirmacaoSenha !== dados.senha) erros.confirmacaoSenha = 'As senhas não conferem.';
  return erros;
}

export default function Cadastro() {
  const { usuario, cadastrar } = useAuth();
  const [dados, setDados] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/" replace />;

  const alterar = (campo) => (valor) => setDados((atual) => ({ ...atual, [campo]: valor }));

  async function enviar(evento) {
    evento.preventDefault();
    const novosErros = validar(dados);
    setErros(novosErros);
    setMensagem('');
    if (Object.keys(novosErros).length > 0) return;

    setEnviando(true);
    try {
      await cadastrar(dados);
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
        <h1>Criar conta</h1>
        <MensagemErro mensagem={mensagem} />
        <CampoTexto rotulo="Nome" nome="nome" valor={dados.nome} aoMudar={alterar('nome')} erro={erros.nome} autoComplete="name" />
        <CampoTexto rotulo="E-mail" nome="email" tipo="email" valor={dados.email} aoMudar={alterar('email')} erro={erros.email} autoComplete="email" />
        <CampoCpf rotulo="CPF" nome="cpf" valor={dados.cpf} aoMudar={alterar('cpf')} erro={erros.cpf} />
        <CampoTexto rotulo="Senha" nome="senha" tipo="password" valor={dados.senha} aoMudar={alterar('senha')} erro={erros.senha} autoComplete="new-password" />
        <CampoTexto
          rotulo="Confirmar senha"
          nome="confirmacaoSenha"
          tipo="password"
          valor={dados.confirmacaoSenha}
          aoMudar={alterar('confirmacaoSenha')}
          erro={erros.confirmacaoSenha}
          autoComplete="new-password"
        />
        <button type="submit" disabled={enviando}>
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </button>
        <p>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
