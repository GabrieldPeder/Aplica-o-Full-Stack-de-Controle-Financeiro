// Cria o app Express: middlewares globais, rotas e tratamento de erros.
import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { config } from './config/env.js';
import { rotaNaoEncontrada, tratarErros } from './middlewares/erros.js';

export function criarApp() {
  const app = express();

  // Lista (e não texto fixo): o cabeçalho CORS só é enviado quando a origem é a do front-end.
  app.use(cors({ origin: [config.corsOrigem] }));
  app.use(express.json());

  app.get('/api/status', (req, res) => {
    res.json({ status: 'ok' });
  });

  // rotas dos próximos PRs: app.use('/api/auth', authRoutes) etc.

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
