// Lê e valida as variáveis de ambiente (arquivo backend/.env).
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export function carregarConfig(env) {
  const emTeste = env.NODE_ENV === 'test';
  const obrigatorias = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGEM'];
  if (emTeste) obrigatorias.push('DATABASE_URL_TESTE');

  const ausentes = obrigatorias.filter((nome) => !env[nome]);
  if (ausentes.length > 0) {
    throw new Error(
      `Variáveis de ambiente ausentes: ${ausentes.join(', ')}. ` +
        'Copie backend/.env.example para backend/.env e preencha.',
    );
  }

  return {
    porta: Number(env.PORT ?? 3000),
    databaseUrl: emTeste ? env.DATABASE_URL_TESTE : env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    jwtExpira: env.JWT_EXPIRA ?? '1h',
    corsOrigem: env.CORS_ORIGEM,
    loginMaxTentativas: Number(env.LOGIN_MAX_TENTATIVAS ?? 5),
    loginJanelaMin: Number(env.LOGIN_JANELA_MIN ?? 15),
  };
}

export const config = carregarConfig(process.env);
