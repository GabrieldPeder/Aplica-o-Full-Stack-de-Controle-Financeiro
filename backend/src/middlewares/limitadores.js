// Limite de tentativas por IP (express-rate-limit). Ao passar do limite responde 429
// no formato padrão, dizendo quantos minutos faltam, com o cabeçalho Retry-After.
import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';

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

// Cada chamada cria um contador novo (cada app/teste começa do zero).
export function criarLimitadorLogin() {
  return limitador({
    janelaMinutos: config.loginJanelaMin,
    maximo: config.loginMaxTentativas,
    ignorarSucessos: true, // só tentativas erradas contam
  });
}

export function criarLimitadorCadastro() {
  return limitador({ janelaMinutos: 60, maximo: 10 });
}
