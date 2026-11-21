// Rotas de relatórios. Montadas em server.js atrás de autenticar.
// (O relatório por categoria, RF7, entra neste arquivo no PR 5.)
import { Router } from 'express';
import { validar, data, inteiro } from '../middlewares/validar.js';
import * as relatorio from '../models/relatorio.js';
import * as fatura from '../models/fatura.js';

const rotas = Router();

// A data final não pode ser anterior à inicial (as duas já no formato AAAA-MM-DD).
function dataFinal() {
  const regraData = data();
  return (valor, consulta) => {
    const resultado = regraData(valor);
    const inicio = regraData(consulta.inicio);
    if (resultado.erro || inicio.erro) return resultado;
    if (resultado.valor < inicio.valor) return { erro: 'A data final deve ser igual ou posterior à inicial.' };
    return resultado;
  };
}

const periodo = { query: { inicio: data(), fim: dataFinal() } };

// RF7 — saídas e entradas por categoria, comparando com o período anterior.
rotas.get('/categorias', validar(periodo), async (req, res) => {
  res.json(await relatorio.porCategoria(req.usuarioId, req.filtros));
});

// RF8 — entradas por fonte, saídas por destino e saldo das contas no período.
rotas.get('/fontes-destinos', validar(periodo), async (req, res) => {
  res.json(await relatorio.porFonteDestino(req.usuarioId, req.filtros));
});

// RF9 — fatura atual e as próximas `meses` de cada cartão.
rotas.get('/faturas', validar({ query: { meses: inteiro({ min: 1, max: 12, padrao: 3 }) } }), async (req, res) => {
  res.json(await fatura.previsao(req.usuarioId, { meses: req.filtros.meses }));
});

export default rotas;
