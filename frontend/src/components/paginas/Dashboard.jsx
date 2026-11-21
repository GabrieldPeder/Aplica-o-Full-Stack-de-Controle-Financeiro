// Dashboard: totais do mês, últimas movimentações e próxima fatura de cada cartão.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../services/useApi.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { moeda, dataBr, mesAno, mesAtual } from '../../services/formatar.js';
import Carregando from '../comuns/Carregando.jsx';
import ListaVazia from '../comuns/ListaVazia.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';

const ULTIMAS = 6;

export default function Dashboard() {
  const { usuario } = useAuth();
  const [mes] = useState(mesAtual);
  const lancamentos = useApi('/lancamentos', mes);
  const faturas = useApi('/relatorios/faturas', { meses: 1 });

  const dados = lancamentos.dados;
  const totais = dados?.totais;
  const primeiroNome = usuario?.nome?.split(' ')[0];

  return (
    <section>
      <h1>{primeiroNome ? `Olá, ${primeiroNome}` : 'Dashboard'}</h1>
      <p className="detalhe">Resumo de {mesAno(mes.inicio.slice(0, 7))}</p>

      {lancamentos.carregando && !dados && <Carregando />}
      <MensagemErro mensagem={lancamentos.erro} />

      {totais && (
        <div className="resumo">
          <div className="cartao destaque">
            <span>Entradas do mês</span>
            <strong className="positivo">{moeda(totais.entradas)}</strong>
          </div>
          <div className="cartao destaque">
            <span>Saídas do mês</span>
            <strong className="negativo">{moeda(totais.saidas)}</strong>
          </div>
          <div className="cartao destaque">
            <span>Saldo do mês</span>
            <strong className={totais.saldo < 0 ? 'negativo' : 'positivo'}>{moeda(totais.saldo)}</strong>
          </div>
        </div>
      )}

      <div className="colunas">
        <div className="cartao">
          <div className="titulo-com-acoes">
            <h2>Últimas movimentações</h2>
            <Link to="/lancamentos">Ver todas</Link>
          </div>
          {dados && dados.itens.length === 0 && <ListaVazia texto="Nenhum lançamento neste mês." />}
          {dados && dados.itens.length > 0 && (
            <table className="tabela">
              <tbody>
                {dados.itens.slice(0, ULTIMAS).map((l) => (
                  <tr key={l.id}>
                    <td className="detalhe">{dataBr(l.data).slice(0, 5)}</td>
                    <td>
                      {l.descricao}
                      {l.totalParcelas > 1 && <small className="detalhe"> · {l.parcelaAtual}/{l.totalParcelas}</small>}
                      <br />
                      <small className="detalhe">{l.categoriaNome}</small>
                    </td>
                    <td className={`valor ${l.tipo === 'saida' ? 'negativo' : 'positivo'}`}>
                      {l.tipo === 'saida' ? '−' : '+'} {moeda(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="cartao">
          <div className="titulo-com-acoes">
            <h2>Próximas faturas</h2>
            <Link to="/faturas">Detalhes</Link>
          </div>
          {faturas.carregando && !faturas.dados && <Carregando />}
          <MensagemErro mensagem={faturas.erro} />
          {faturas.dados?.cartoes.length === 0 && <ListaVazia texto="Nenhum cartão cadastrado." />}
          {faturas.dados?.cartoes.length > 0 && (
            <ul className="lista">
              {faturas.dados.cartoes.map((cartao) => {
                // A fechada (a pagar) vem antes da aberta; sem fechada, mostra a aberta.
                const proxima = cartao.faturas.find((f) => f.situacao === 'fechada') ?? cartao.faturas.find((f) => f.atual);
                return (
                  <li key={cartao.id}>
                    <span>
                      {cartao.nome}
                      <br />
                      <small className="detalhe">
                        {mesAno(proxima.referencia)} · vence {dataBr(proxima.vencimento)}
                        {proxima.situacao === 'fechada' ? ' · fechada' : ' · aberta'}
                      </small>
                    </span>
                    <strong>{moeda(proxima.total)}</strong>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
