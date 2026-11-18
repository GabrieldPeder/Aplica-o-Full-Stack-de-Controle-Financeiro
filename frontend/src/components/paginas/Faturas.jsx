// RF9 — fatura atual e previsão das próximas, por cartão de crédito.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../services/useApi.js';
import { moeda, dataBr, mesAno } from '../../services/formatar.js';
import CampoSelect from '../comuns/CampoSelect.jsx';
import Carregando from '../comuns/Carregando.jsx';
import ListaVazia from '../comuns/ListaVazia.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';

const OPCOES_MESES = [3, 6, 12].map((n) => ({ valor: String(n), texto: `Próximos ${n} meses` }));

function BarraLimite({ cartao }) {
  const estourado = cartao.limiteDisponivel < 0;
  const usado = Math.min(100, (cartao.limiteUtilizado / cartao.limite) * 100);
  return (
    <div className="limite">
      <div className="barra" role="progressbar" aria-valuenow={Math.round(usado)} aria-valuemin={0} aria-valuemax={100} aria-label="Limite utilizado">
        <div className={estourado ? 'barra-preenchida estourado' : 'barra-preenchida'} style={{ width: `${usado}%` }} />
      </div>
      <div className="limite-legenda">
        <span>Utilizado: {moeda(cartao.limiteUtilizado)}</span>
        <span className={estourado ? 'negativo' : ''}>
          Disponível: {moeda(cartao.limiteDisponivel)} de {moeda(cartao.limite)}
        </span>
      </div>
    </div>
  );
}

function CartaoFatura({ fatura }) {
  return (
    <article className={`fatura ${fatura.situacao}`}>
      <header>
        <h3>
          {mesAno(fatura.referencia)}
          {fatura.situacao === 'aberta' && <span className="selo">Atual</span>}
          {fatura.situacao === 'fechada' && <span className="selo selo-alerta" title="Fatura fechada, ainda não vencida">A pagar</span>}
        </h3>
        <strong>{moeda(fatura.total)}</strong>
      </header>
      <p className="detalhe">
        Fecha {dataBr(fatura.fechamento)} · vence {dataBr(fatura.vencimento)}
      </p>
      {fatura.itens.length === 0 ? (
        <ListaVazia texto="Sem lançamentos." />
      ) : (
        <ul className="lista">
          {fatura.itens.map((item) => (
            <li key={item.id}>
              <span>
                {item.descricao}
                {item.parcela !== '1/1' && <> — {item.parcela}</>}
                <small className="detalhe"> · {dataBr(item.dataCompra)}</small>
              </span>
              <span>{moeda(item.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function Faturas() {
  const [meses, setMeses] = useState('3');
  const { dados, carregando, erro } = useApi('/relatorios/faturas', { meses });

  return (
    <section>
      <div className="titulo-com-acoes">
        <h1>Faturas</h1>
        <CampoSelect rotulo="Previsão" nome="meses" valor={meses} aoMudar={setMeses} opcoes={OPCOES_MESES} />
      </div>

      {carregando && !dados && <Carregando />}
      <MensagemErro mensagem={erro} />

      {dados && dados.cartoes.length === 0 && (
        <div className="cartao">
          <ListaVazia texto="Você ainda não tem cartões de crédito." />
          <Link to="/fontes-destinos">Cadastrar um cartão</Link>
        </div>
      )}

      {dados?.cartoes.map((cartao) => (
        <div key={cartao.id} className="cartao">
          <h2>{cartao.nome}</h2>
          <p className="detalhe">
            Fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}
          </p>
          <BarraLimite cartao={cartao} />
          <div className="faturas">
            {cartao.faturas.map((fatura) => (
              <CartaoFatura key={fatura.referencia} fatura={fatura} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
