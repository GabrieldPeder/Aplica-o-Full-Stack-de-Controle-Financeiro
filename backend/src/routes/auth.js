// Rotas de autenticação: cadastro, login e dados da sessão (RF1, RF2).
import { Router } from 'express';
import { validar, texto, email, cpf, senha, senhaDigitada, igualA } from '../middlewares/validar.js';
import { criarLimitadorLogin, criarLimitadorCadastro } from '../middlewares/limitadores.js';
import { autenticar, gerarToken, SESSAO_INVALIDA } from '../middlewares/autenticar.js';
import { ErroApi } from '../middlewares/erros.js';
import * as usuario from '../models/usuario.js';

// Cria as rotas com limitadores novos (cada app tem seu próprio contador de tentativas).
export function criarRotasAuth() {
  const rotas = Router();

  const limitarLogin = criarLimitadorLogin();
  const limitarCadastro = criarLimitadorCadastro();

  rotas.post(
    '/cadastro',
    limitarCadastro,
    validar({
      body: {
        nome: texto({ max: 120 }),
        email: email(),
        cpf: cpf(),
        senha: senha(),
        confirmacaoSenha: igualA('senha', 'As senhas não conferem.'),
      },
    }),
    async (req, res) => {
      const { nome, email, cpf, senha } = req.dados;
      const criado = await usuario.criarComPadroes({ nome, email, cpf, senha });
      res.status(201).json({ usuario: criado });
    },
  );

  rotas.post(
    '/login',
    limitarLogin,
    validar({ body: { email: email(), senha: senhaDigitada() } }),
    async (req, res) => {
      const encontrado = await usuario.conferirCredenciais(req.dados.email, req.dados.senha);
      if (!encontrado) throw new ErroApi(401, 'E-mail ou senha inválidos.');
      res.json({ token: gerarToken(encontrado.id), usuario: encontrado });
    },
  );

  rotas.get('/me', autenticar, async (req, res) => {
    const encontrado = await usuario.buscarPorId(req.usuarioId);
    if (!encontrado) throw new ErroApi(401, SESSAO_INVALIDA); // usuário excluído
    res.json({ usuario: encontrado });
  });

  return rotas;
}
