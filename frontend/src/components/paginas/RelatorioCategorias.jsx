// RF7 — saídas por categoria (pizza + barras atual × anterior + tabela) e entradas por categoria.
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../services/useApi.js';
import { moeda, dataBr } from '../../services/formatar.js';
import Carregando from '../comuns/Carregando.jsx';
import ListaVazia from '../comuns/ListaVazia.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';

const CORES = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569'];
const COR_ATUAL = '#2563eb';
const COR_ANTERIOR = '#94a3b8';

const eixoMoeda = (v) => moeda(v).replace(',00', '');
const periodoTexto = ({ inicio, fim }) => `${dataBr(inicio)} a ${dataBr(fim)}`;

function Variacao({ valor }) {
  if (valor === 0) return <span className="detalhe">—</span>;
  // Para saídas, gastar MAIS é ruim (vermelho); gastar menos é bom (verde).
  return <span className={valor > 0 ? 'negativo' : 'positivo'}>{valor > 0 ? '▲' : '▼'} {moeda(Math.abs(valor))}</span>;
}

export default function RelatorioCategorias({ periodo }) {
  const { dados: r, carregando, erro } = useApi('/relatorios/categorias', periodo);

  if (carregando && !r) return <Carregando />;
  if (erro) return <MensagemErro mensagem={erro} />;
  if (!r) return null;

  const comValor = r.saidas.filter((c) => c.total > 0);

  return (
    <>
      <div className="resumo">
        <div className="cartao destaque">
          <span>Saídas</span>
          <strong className="negativo">{moeda(r.totalSaidas)}</strong>
        </div>
        <div className="cartao destaque">
          <span>Entradas</span>
          <strong className="positivo">{moeda(r.totalEntradas)}</strong>
        </div>
        <div className="cartao destaque">
          <span>Comparando com</span>
          <strong className="texto-periodo">{periodoTexto(r.periodoAnterior)}</strong>
        </div>
      </div>

      <div className="colunas">
        <div className="cartao">
          <h2>Saídas por categoria</h2>
          {comValor.length === 0 ? (
            <ListaVazia texto="Nenhuma saída no período." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={comValor} dataKey="total" nameKey="nome" outerRadius={100} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                  {comValor.map((c, i) => <Cell key={c.id} fill={CORES[i % CORES.length]} />)}
                </Pie>
                <Tooltip formatter={(valor) => moeda(valor)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="cartao">
          <h2>Período atual × anterior</h2>
          {r.saidas.length === 0 ? (
            <ListaVazia texto="Nenhuma saída nos dois períodos." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={r.saidas} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" />
                <YAxis tickFormatter={eixoMoeda} width={90} />
                <Tooltip formatter={(valor) => moeda(valor)} />
                <Legend />
                <Bar dataKey="total" name="Atual" fill={COR_ATUAL} radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalAnterior" name="Anterior" fill={COR_ANTERIOR} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="cartao">
        <h2>Detalhe das saídas</h2>
        {r.saidas.length === 0 ? (
          <ListaVazia texto="Nenhuma saída no período." />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th className="valor">Total</th>
                  <th className="valor">% do total</th>
                  <th className="valor">Período anterior</th>
                  <th className="valor">Variação</th>
                </tr>
              </thead>
              <tbody>
                {r.saidas.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td className="valor">{moeda(c.total)}</td>
                    <td className="valor">{c.percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%</td>
                    <td className="valor">{moeda(c.totalAnterior)}</td>
                    <td className="valor"><Variacao valor={c.variacao} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="cartao">
        <h2>Entradas por categoria</h2>
        {r.entradas.length === 0 ? (
          <ListaVazia texto="Nenhuma entrada no período." />
        ) : (
          <table className="tabela">
            <tbody>
              {r.entradas.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td className="valor">{moeda(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
