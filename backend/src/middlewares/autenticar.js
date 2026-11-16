// Protege as rotas: exige "Authorization: Bearer <token>" válido e coloca o id do
// usuário em req.usuarioId. As rotas nunca aceitam o id do usuário vindo do corpo ou da URL.
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ErroApi } from './erros.js';

export const SESSAO_INVALIDA = 'Sessão inválida ou expirada. Entre novamente.';

export function autenticar(req, res, next) {
  const [esquema, token] = (req.headers.authorization ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return next(new ErroApi(401, 'Token não informado.'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.usuarioId = Number(payload.sub);
    next();
  } catch {
    next(new ErroApi(401, SESSAO_INVALIDA)); // assinatura errada, token expirado ou malformado
  }
}

export function gerarToken(usuarioId) {
  return jwt.sign({}, config.jwtSecret, { subject: String(usuarioId), expiresIn: config.jwtExpira });
}
