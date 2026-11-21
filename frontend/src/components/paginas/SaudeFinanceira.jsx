// Saúde financeira (desafio): indicadores, dicas e projeção de saldo. Tudo vem calculado da API.
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../../services/useApi.js';
import { moeda, mesAno } from '../../services/formatar.js';
import Carregando from '../comuns/Carregando.jsx';
import ListaVazia from '../comuns/ListaVazia.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';

const ICONE = { alerta: '⚠️', elogio: '✅', info: 'ℹ️' };
const pct = (valor) => (valor === null ? '—' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);

// Situação de cada indicador: 'bom', 'atencao' ou neutro, conforme os limites que a API devolve.
function classe(situacao) {
  return situacao === 'bom' ? 'positivo' : situacao === 'atencao' ? 'negativo' : '';
}

function Indicador({ titulo, valor, detalhe, situacao }) {
  return (
    <div className="cartao destaque">
      <span>{titulo}</span>
      <strong className={classe(situacao)}>{valor}</strong>
      {detalhe && <small className="detalhe">{detalhe}</small>}
    </div>
  );
}

export default function SaudeFinanceira() {
  const { dados: s, carregando, erro } = useApi('/saude-financeira');

  if (carregando && !s) return <Carregando />;
  if (erro) return <MensagemErro mensagem={erro} />;
  if (!s) return null;

  const { limites } = s;
  const taxa = s.poupanca.media;
  const comp = s.comprometimento.percentual;
  const reservaMeses = s.reserva.meses;
  const grafico = s.projecao.map((m) => ({ ...m, mes: mesAno(m.referencia) }));
  const periodo = `${mesAno(s.referencia.meses[0])} a ${mesAno(s.referencia.meses.at(-1))}`;

  return (
    <section>
      <h1>Saúde financeira</h1>
      <p className="detalhe">Baseado nos meses completos de {periodo} e nas parcelas já lançadas.</p>

      {s.semHistorico && (
        <div className="cartao">
          <ListaVazia texto="Ainda não há lançamentos nos últimos 3 meses completos. Os indicadores aparecem conforme você registra entradas e saídas." />
        </div>
      )}

      <div className="resumo">
        <Indicador
          titulo="Taxa de poupança (média)"
          valor={pct(taxa)}
          detalhe={`Meta: pelo menos ${limites.poupancaElogio}%`}
          situacao={taxa === null ? null : taxa >= limites.poupancaElogio ? 'bom' : taxa < limites.poupancaAlerta ? 'atencao' : null}
        />
        <Indicador
          titulo="Comprometimento com cartões"
          valor={pct(comp)}
          detalhe={`${moeda(s.comprometimento.proximasFaturas)} nas próximas 3 faturas`}
          situacao={comp === null ? null : comp > limites.comprometimentoAlerta ? 'atencao' : 'bom'}
        />
        <Indicador
          titulo="Reserva de emergência"
          valor={reservaMeses === null ? moeda(s.reserva.saldo) : `${reservaMeses.toLocaleString('pt-BR')} meses`}
          detalhe={s.reserva.contas === 0 ? 'Nenhuma conta marcada como reserva' : `${moeda(s.reserva.saldo)} guardados`}
          situacao={
            s.reserva.contas === 0 || (reservaMeses !== null && reservaMeses < limites.reservaAlertaMeses)
              ? 'atencao'
              : reservaMeses !== null && reservaMeses >= limites.reservaElogioMeses ? 'bom' : null
          }
        />
      </div>

      <div className="cartao">
        <h2>Dicas</h2>
        {s.dicas.length === 0 ? (
          <ListaVazia texto="Nenhum alerta no momento. Continue assim!" />
        ) : (
          <ul className="dicas">
            {s.dicas.map((d, i) => (
              <li key={i} className={`dica dica-${d.tipo}`}>
                <span aria-hidden="true">{ICONE[d.tipo]}</span>
                <span>{d.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="cartao">
        <h2>Projeção dos próximos 6 meses</h2>
        <p className="detalhe">Média de entradas e gastos à vista dos últimos 3 meses, mais as parcelas que já vão cair em cada fatura.</p>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={grafico} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" />
            <YAxis tickFormatter={(v) => moeda(v).replace(',00', '')} width={95} />
            <Tooltip formatter={(valor) => moeda(valor)} />
            <Legend />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Line type="monotone" dataKey="saldo" name="Saldo do mês" stroke="#2563eb" strokeWidth={2} />
            <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#16a34a" strokeWidth={2} strokeDasharray="5 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="colunas">
        <div className="cartao">
          <h2>Poupança por mês</h2>
          <table className="tabela">
            <thead>
              <tr><th>Mês</th><th className="valor">Entradas</th><th className="valor">Saídas</th><th className="valor">Guardado</th></tr>
            </thead>
            <tbody>
              {s.poupanca.porMes.map((m) => (
                <tr key={m.referencia}>
                  <td>{mesAno(m.referencia)}</td>
                  <td className="valor">{moeda(m.entradas)}</td>
                  <td className="valor">{moeda(m.saidas)}</td>
                  <td className={`valor ${m.taxa !== null && m.taxa < 0 ? 'negativo' : ''}`}>{pct(m.taxa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cartao">
          <h2>Parcelas a vencer</h2>
          {s.parcelasFuturas.length === 0 ? (
            <ListaVazia texto="Nenhuma parcela futura." />
          ) : (
            <table className="tabela">
              <tbody>
                {s.parcelasFuturas.map((p) => (
                  <tr key={p.referencia}>
                    <td>Fatura de {mesAno(p.referencia)}</td>
                    <td className="valor">{moeda(p.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="aviso" role="note">{s.aviso}</p>
    </section>
  );
}
