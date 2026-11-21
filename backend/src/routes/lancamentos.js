// Rotas de lançamentos (RF6). Montadas em server.js atrás de autenticar:
// req.usuarioId sempre vem do token. As regras que dependem do banco (categoria/fonte do
// usuário, tipo da categoria, parcelamento só no cartão) ficam no model, dentro da transação.
import { Router } from 'express';
import { validar, texto, umDe, inteiro, dinheiro, data, booleano } from '../middlewares/validar.js';
import { inicioDoMes, fimDoMes } from '../config/datas.js';
import { MAX_PARCELAS } from '../config/dinheiro.js';
import { ErroApi } from '../middlewares/erros.js';
import * as lancamento from '../models/lancamento.js';

const rotas = Router();

const TIPOS = ['entrada', 'saida'];
const comId = { params: { id: inteiro({ min: 1 }) } };

const corpo = {
  tipo: umDe(TIPOS),
  descricao: texto({ max: 120 }),
  valor: dinheiro(),
  data: data(),
  categoriaId: inteiro({ min: 1 }),
  fonteDestinoId: inteiro({ min: 1 }),
  totalParcelas: inteiro({ min: 1, max: MAX_PARCELAS, padrao: 1 }),
};

// Na edição, totalParcelas é opcional: só serve para conferir que não mudou.
const corpoEdicao = { ...corpo, totalParcelas: inteiro({ min: 1, max: MAX_PARCELAS, opcional: true }) };

// A data final não pode ser anterior à inicial.
function dataFinal() {
  const regra = data({ padrao: () => fimDoMes() });
  return (valor, consulta) => {
    const resultado = regra(valor);
    if (resultado.erro) return resultado;
    const inicio = data({ padrao: () => inicioDoMes() })(consulta.inicio);
    if (!inicio.erro && resultado.valor < inicio.valor) {
      return { erro: 'A data final deve ser igual ou posterior à inicial.' };
    }
    return resultado;
  };
}

const filtros = {
  inicio: data({ padrao: () => inicioDoMes() }),
  fim: dataFinal(),
  tipo: umDe(TIPOS, { opcional: true }),
  categoriaId: inteiro({ min: 1, opcional: true }),
  fonteDestinoId: inteiro({ min: 1, opcional: true }),
  pagina: inteiro({ min: 1, padrao: 1 }),
};

const naoEncontrado = () => new ErroApi(404, 'Lançamento não encontrado.');

rotas.get('/', validar({ query: filtros }), async (req, res) => {
  res.json(await lancamento.listar(req.usuarioId, req.filtros));
});

rotas.post('/', validar({ body: corpo }), async (req, res) => {
  res.status(201).json(await lancamento.criar(req.usuarioId, req.dados));
});

rotas.get('/:id', validar(comId), async (req, res) => {
  const encontrado = await lancamento.buscarPorId(req.usuarioId, req.parametros.id);
  if (!encontrado) throw naoEncontrado();
  res.json(encontrado);
});

rotas.put('/:id', validar({ ...comId, body: corpoEdicao }), async (req, res) => {
  const { totalParcelas, ...dados } = req.dados;
  if (totalParcelas !== null) dados.totalParcelas = totalParcelas;
  res.json(await lancamento.atualizar(req.usuarioId, req.parametros.id, dados));
});

rotas.delete(
  '/:id',
  validar({ ...comId, query: { todasParcelas: booleano({ padrao: false }) } }),
  async (req, res) => {
    const excluiu = await lancamento.excluir(req.usuarioId, req.parametros.id, req.filtros);
    if (!excluiu) throw naoEncontrado();
    res.status(204).end();
  },
);

export default rotas;
