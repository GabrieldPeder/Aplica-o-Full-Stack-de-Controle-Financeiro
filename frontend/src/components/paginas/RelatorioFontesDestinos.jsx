// RF8 — entradas por fonte, saídas por destino e saldo das contas no período.
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../services/useApi.js';
import { moeda } from '../../services/formatar.js';
import Carregando from '../comuns/Carregando.jsx';
import ListaVazia from '../comuns/ListaVazia.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';

const COR_ENTRADA = '#16a34a';
const COR_SAIDA = '#dc2626';

// Junta entradas e saídas por fonte/destino para o gráfico de barras.
function dadosDoGrafico(relatorio) {
  const porNome = new Map();
  for (const { nome, total } of relatorio.entradasPorFonte) porNome.set(nome, { nome, entradas: total, saidas: 0 });
  for (const { nome, total } of relatorio.saidasPorDestino) {
    porNome.set(nome, { nome, entradas: porNome.get(nome)?.entradas ?? 0, saidas: total });
  }
  return [...porNome.values()];
}

function TabelaTotais({ titulo, itens, vazio }) {
  return (
    <div className="cartao">
      <h2>{titulo}</h2>
      {itens.length === 0 ? (
        <ListaVazia texto={vazio} />
      ) : (
        <table className="tabela">
          <tbody>
            {itens.map((item) => (
              <tr key={item.id}>
                <td>{item.nome}</td>
                <td className="valor">{moeda(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function RelatorioFontesDestinos({ periodo }) {
  const { dados: relatorio, carregando, erro } = useApi('/relatorios/fontes-destinos', periodo);

  if (carregando && !relatorio) return <Carregando />;
  if (erro) return <MensagemErro mensagem={erro} />;
  if (!relatorio) return null;

  const grafico = dadosDoGrafico(relatorio);
  const saldo = relatorio.totalEntradas - relatorio.totalSaidas;

  return (
    <>
      <div className="resumo">
        <div className="cartao destaque">
          <span>Entradas</span>
          <strong className="positivo">{moeda(relatorio.totalEntradas)}</strong>
        </div>
        <div className="cartao destaque">
          <span>Saídas</span>
          <strong className="negativo">{moeda(relatorio.totalSaidas)}</strong>
        </div>
        <div className="cartao destaque">
          <span>Saldo do período</span>
          <strong className={saldo < 0 ? 'negativo' : 'positivo'}>{moeda(saldo)}</strong>
        </div>
      </div>

      <div className="cartao">
        <h2>Entradas e saídas por fonte/destino</h2>
        {grafico.length === 0 ? (
          <ListaVazia texto="Nenhum lançamento no período." />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={grafico} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nome" />
              <YAxis tickFormatter={(v) => moeda(v).replace(',00', '')} width={90} />
              <Tooltip formatter={(valor) => moeda(valor)} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill={COR_SAIDA} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="colunas">
        <TabelaTotais titulo="Entradas por fonte" itens={relatorio.entradasPorFonte} vazio="Nenhuma entrada no período." />
        <TabelaTotais titulo="Saídas por destino" itens={relatorio.saidasPorDestino} vazio="Nenhuma saída no período." />
      </div>

      <div className="cartao">
        <h2>Saldo das contas no período</h2>
        {relatorio.saldoContas.length === 0 ? (
          <ListaVazia texto="Nenhuma conta cadastrada." />
        ) : (
          <table className="tabela">
            <thead>
              <tr>
                <th>Conta</th>
                <th className="valor">Entradas</th>
                <th className="valor">Saídas</th>
                <th className="valor">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {relatorio.saldoContas.map((conta) => (
                <tr key={conta.id}>
                  <td>{conta.nome}</td>
                  <td className="valor">{moeda(conta.entradas)}</td>
                  <td className="valor">{moeda(conta.saidas)}</td>
                  <td className={`valor ${conta.saldo < 0 ? 'negativo' : ''}`}>{moeda(conta.saldo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
