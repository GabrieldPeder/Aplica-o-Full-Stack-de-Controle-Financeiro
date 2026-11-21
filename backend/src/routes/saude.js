// Rota da saúde financeira (desafio). Montada em server.js atrás de autenticar.
import { Router } from 'express';
import * as saude from '../models/saude.js';

const rotas = Router();

rotas.get('/', async (req, res) => {
  res.json(await saude.calcular(req.usuarioId));
});

export default rotas;
