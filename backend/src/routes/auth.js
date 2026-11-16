// Rotas de autenticação: cadastro, login e dados da sessão (RF1, RF2).
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';
import { validar, texto, email, cpf, senha, igualA } from '../middlewares/validar.js';
import { autenticar, gerarToken, SESSAO_INVALIDA } from '../middlewares/autenticar.js';
import { ErroApi } from '../middlewares/erros.js';
import * as usuario from '../models/usuario.js';

// Responde 429 no formato padrão, dizendo quantos minutos faltam.
function limitador({ janelaMinutos, maximo, ignorarSucessos = false }) {
  return rateLimit({
    windowMs: janelaMinutos * 60 * 1000,
    limit: maximo,
    skipSuccessfulRequests: ignorarSucessos,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
      const minutos = Math.max(1, Math.ceil((req.rateLimit.resetTime - Date.now()) / 60000));
      res.status(429).json({ erro: `Muitas tentativas. Tente novamente em ${minutos} minuto${minutos > 1 ? 's' : ''}.` });
    },
  });
}

// Cria as rotas com limitadores novos (cada app tem seu próprio contador de tentativas).
export function criarRotasAuth() {
  const rotas = Router();

  const limitarLogin = limitador({
    janelaMinutos: config.loginJanelaMin,
    maximo: config.loginMaxTentativas,
    ignorarSucessos: true, // só tentativas erradas contam
  });
  const limitarCadastro = limitador({ janelaMinutos: 60, maximo: 10 });

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
    validar({ body: { email: email(), senha: texto({ max: 72 }) } }),
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
