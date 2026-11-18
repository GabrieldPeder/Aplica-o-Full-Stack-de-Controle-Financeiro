// Página de relatórios: período escolhido pelo usuário e uma aba por relatório.
import { useState } from 'react';
import { mesAtual } from '../../services/formatar.js';
import CampoTexto from '../comuns/CampoTexto.jsx';
import RelatorioFontesDestinos from './RelatorioFontesDestinos.jsx';

const ABAS = [
  { id: 'categorias', texto: 'Por categoria' },
  { id: 'fontes-destinos', texto: 'Por fonte/destino' },
];

export default function Relatorios() {
  const [datas, setDatas] = useState(mesAtual);
  const [aba, setAba] = useState('fontes-destinos');

  const completas = Boolean(datas.inicio && datas.fim);
  const erroPeriodo = completas && datas.inicio > datas.fim ? 'A data final deve ser igual ou posterior à inicial.' : '';
  const periodoValido = completas && !erroPeriodo;

  return (
    <section>
      <h1>Relatórios</h1>

      <div className="cartao">
        <div className="campos-linha">
          <CampoTexto rotulo="De" nome="inicio" tipo="date" valor={datas.inicio} aoMudar={(inicio) => setDatas({ ...datas, inicio })} />
          <CampoTexto rotulo="Até" nome="fim" tipo="date" valor={datas.fim} aoMudar={(fim) => setDatas({ ...datas, fim })} erro={erroPeriodo} />
        </div>
        <div className="abas" role="tablist">
          {ABAS.map(({ id, texto }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={aba === id}
              className={aba === id ? 'aba ativa' : 'aba'}
              onClick={() => setAba(id)}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {!periodoValido && <p className="detalhe">Escolha um período válido para ver o relatório.</p>}
      {periodoValido && aba === 'fontes-destinos' && <RelatorioFontesDestinos periodo={datas} />}
      {periodoValido && aba === 'categorias' && (
        <div className="cartao">
          <p className="detalhe">O relatório por categoria entra no PR 5.</p>
        </div>
      )}
    </section>
  );
}
