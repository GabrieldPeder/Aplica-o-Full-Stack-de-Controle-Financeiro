// Rotas de categorias (RF4). Montadas em server.js atrás de autenticar:
// req.usuarioId sempre vem do token.
import { Router } from 'express';
import { validar, texto, umDe, inteiro } from '../middlewares/validar.js';
import * as categoria from '../models/categoria.js';

const rotas = Router();

const corpo = { nome: texto({ max: 60 }), tipo: umDe(['entrada', 'saida']) };
const comId = { params: { id: inteiro({ min: 1 }) } };

rotas.get('/', async (req, res) => {
  res.json(await categoria.listar(req.usuarioId));
});

rotas.post('/', validar({ body: corpo }), async (req, res) => {
  res.status(201).json(await categoria.criar(req.usuarioId, req.dados));
});

rotas.put('/:id', validar({ ...comId, body: corpo }), async (req, res) => {
  res.json(await categoria.atualizar(req.usuarioId, req.parametros.id, req.dados));
});

rotas.delete('/:id', validar(comId), async (req, res) => {
  await categoria.excluir(req.usuarioId, req.parametros.id);
  res.status(204).end();
});

export default rotas;
