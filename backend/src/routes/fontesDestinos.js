// Rotas de fontes e destinos (RF5). Montadas em server.js atrás de autenticar.
import { Router } from 'express';
import { validar, texto, umDe, inteiro, dinheiro, booleano, quando } from '../middlewares/validar.js';
import * as fonteDestino from '../models/fonteDestino.js';

const rotas = Router();

const ehCartao = (corpo) => corpo.tipo === 'cartao_credito';

// Dias e limite só são exigidos (e só são lidos) para cartão de crédito.
const corpo = {
  nome: texto({ max: 60 }),
  tipo: umDe(['renda', 'conta', 'cartao_credito']),
  diaFechamento: quando(ehCartao, inteiro({ min: 1, max: 31 })),
  diaVencimento: quando(ehCartao, inteiro({ min: 1, max: 31 })),
  limite: quando(ehCartao, dinheiro()),
  reserva: quando((c) => c.tipo === 'conta', booleano({ padrao: false })),
};
const comId = { params: { id: inteiro({ min: 1 }) } };

rotas.get('/', async (req, res) => {
  res.json(await fonteDestino.listar(req.usuarioId));
});

rotas.post('/', validar({ body: corpo }), async (req, res) => {
  res.status(201).json(await fonteDestino.criar(req.usuarioId, req.dados));
});

rotas.put('/:id', validar({ ...comId, body: corpo }), async (req, res) => {
  res.json(await fonteDestino.atualizar(req.usuarioId, req.parametros.id, req.dados));
});

rotas.delete('/:id', validar(comId), async (req, res) => {
  await fonteDestino.excluir(req.usuarioId, req.parametros.id);
  res.status(204).end();
});

export default rotas;
