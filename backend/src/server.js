// Cria o app Express: middlewares globais, rotas e tratamento de erros.
import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { config } from './config/env.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';
import { autenticar } from './middlewares/autenticar.js';
import { criarRotasAuth } from './routes/auth.js';
import rotasCategorias from './routes/categorias.js';
import rotasFontesDestinos from './routes/fontesDestinos.js';
import rotasRelatorios from './routes/relatorios.js';
import rotasLancamentos from './routes/lancamentos.js';

export function criarApp() {
  const app = express();

  // Lista (e não texto fixo): o cabeçalho CORS só é enviado quando a origem é a do front-end.
  app.use(cors({ origin: [config.corsOrigem] }));
  app.use(express.json());

  app.get('/api/status', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', criarRotasAuth());
  // Daqui para baixo, todas as rotas exigem token (autenticar coloca req.usuarioId).
  app.use('/api/categorias', autenticar, rotasCategorias);
  app.use('/api/fontes-destinos', autenticar, rotasFontesDestinos);
  app.use('/api/lancamentos', autenticar, rotasLancamentos);
  app.use('/api/relatorios', autenticar, rotasRelatorios);

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}

const executadoDiretamente = import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDiretamente) {
  criarApp().listen(config.porta, () => {
    console.log(`API ouvindo em http://localhost:${config.porta}`);
  });
}
