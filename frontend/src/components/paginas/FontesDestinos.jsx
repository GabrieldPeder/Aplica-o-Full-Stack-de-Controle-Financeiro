import { useState } from 'react';
import { api, extrairErro } from '../../services/api.js';
import { useApi } from '../../services/useApi.js';
import { moeda } from '../../services/formatar.js';
import CampoTexto from '../comuns/CampoTexto.jsx';
import CampoSelect from '../comuns/CampoSelect.jsx';
import Carregando from '../comuns/Carregando.jsx';
import ListaVazia from '../comuns/ListaVazia.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';
import ConfirmarExclusao from '../comuns/ConfirmarExclusao.jsx';

const TIPOS = [
  { valor: 'conta', texto: 'Conta' },
  { valor: 'renda', texto: 'Renda' },
  { valor: 'cartao_credito', texto: 'Cartão de crédito' },
];
const NOME_DO_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.texto]));
const VAZIO = { id: null, nome: '', tipo: 'conta', diaFechamento: '', diaVencimento: '', limite: '', reserva: false };

// Formulário trabalha com texto; a API recebe números (ou null) nos campos de cartão.
function paraFormulario(item) {
  return {
    ...item,
    diaFechamento: item.diaFechamento ?? '',
    diaVencimento: item.diaVencimento ?? '',
    limite: item.limite ?? '',
  };
}

function validarFormulario(form) {
  const erros = {};
  if (!form.nome.trim()) erros.nome = 'Informe o nome.';
  if (form.tipo === 'cartao_credito') {
    for (const campo of ['diaFechamento', 'diaVencimento']) {
      const dia = Number(form[campo]);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) erros[campo] = 'Informe um dia entre 1 e 31.';
    }
    if (!(Number(form.limite) > 0)) erros.limite = 'Informe um limite maior que zero.';
  }
  return erros;
}

export default function FontesDestinos() {
  const { dados: fontes, carregando, erro, recarregar } = useApi('/fontes-destinos');
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const editando = form.id !== null;
  const emUso = editando && fontes?.find((f) => f.id === form.id)?.quantidadeLancamentos > 0;
  const ehCartao = form.tipo === 'cartao_credito';
  const alterar = (campo) => (valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  function limparFormulario() {
    setForm(VAZIO);
    setErros({});
    setMensagem('');
  }

  async function salvar(evento) {
    evento.preventDefault();
    setMensagem('');
    const novosErros = validarFormulario(form);
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const corpo = { nome: form.nome, tipo: form.tipo };
    if (ehCartao) {
      corpo.diaFechamento = Number(form.diaFechamento);
      corpo.diaVencimento = Number(form.diaVencimento);
      corpo.limite = Number(form.limite);
    }
    if (form.tipo === 'conta') corpo.reserva = form.reserva;

    setEnviando(true);
    try {
      if (editando) await api.put(`/fontes-destinos/${form.id}`, corpo);
      else await api.post('/fontes-destinos', corpo);
      limparFormulario();
      recarregar();
    } catch (e) {
      const { mensagem: msg, campos } = extrairErro(e);
      setErros(campos);
      setMensagem(msg);
    } finally {
      setEnviando(false);
    }
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await api.delete(`/fontes-destinos/${paraExcluir.id}`);
      if (form.id === paraExcluir.id) limparFormulario();
      setParaExcluir(null);
      recarregar();
    } catch (e) {
      setErroExclusao(extrairErro(e).mensagem);
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <section>
      <h1>Fontes e destinos</h1>
      <p className="detalhe">De onde o dinheiro vem (renda) e para onde vai (contas e cartões de crédito).</p>

      <form className="cartao" onSubmit={salvar} noValidate>
        <h2>{editando ? 'Editar' : 'Nova fonte ou destino'}</h2>
        <MensagemErro mensagem={mensagem} />
        <div className="campos-linha">
          <CampoTexto rotulo="Nome" nome="nome" valor={form.nome} aoMudar={alterar('nome')} erro={erros.nome} maxLength={60} />
          <CampoSelect
            rotulo="Tipo"
            nome="tipo"
            valor={form.tipo}
            aoMudar={alterar('tipo')}
            opcoes={TIPOS}
            erro={erros.tipo}
            disabled={emUso}
            title={emUso ? 'Já existem lançamentos aqui; o tipo não pode ser alterado.' : undefined}
          />
        </div>

        {ehCartao && (
          <div className="campos-linha">
            <CampoTexto rotulo="Dia do fechamento" nome="diaFechamento" tipo="number" min={1} max={31} valor={form.diaFechamento} aoMudar={alterar('diaFechamento')} erro={erros.diaFechamento} />
            <CampoTexto rotulo="Dia do vencimento" nome="diaVencimento" tipo="number" min={1} max={31} valor={form.diaVencimento} aoMudar={alterar('diaVencimento')} erro={erros.diaVencimento} />
            <CampoTexto rotulo="Limite (R$)" nome="limite" tipo="number" min={0.01} step={0.01} valor={form.limite} aoMudar={alterar('limite')} erro={erros.limite} />
          </div>
        )}

        {form.tipo === 'conta' && (
          <label className="caixa-marcar">
            <input type="checkbox" checked={form.reserva} onChange={(e) => alterar('reserva')(e.target.checked)} />
            Esta conta é minha reserva de emergência
          </label>
        )}

        <div className="acoes">
          {editando && (
            <button type="button" className="botao-secundario" onClick={limparFormulario}>
              Cancelar
            </button>
          )}
          <button type="submit" disabled={enviando}>
            {enviando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Adicionar'}
          </button>
        </div>
      </form>

      {carregando && !fontes && <Carregando />}
      <MensagemErro mensagem={erro} />

      {fontes && (
        <div className="cartao">
          {fontes.length === 0 ? (
            <ListaVazia texto="Nenhuma fonte ou destino cadastrado." />
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Detalhes</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {fontes.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nome}</td>
                    <td>{NOME_DO_TIPO[f.tipo]}</td>
                    <td className="detalhe">
                      {f.tipo === 'cartao_credito' &&
                        `Fecha dia ${f.diaFechamento} · vence dia ${f.diaVencimento} · limite ${moeda(f.limite)}`}
                      {f.reserva && 'Reserva de emergência'}
                      {f.quantidadeLancamentos > 0 && (
                        <>{(f.tipo === 'cartao_credito' || f.reserva) && ' · '}{f.quantidadeLancamentos} lançamento(s)</>
                      )}
                    </td>
                    <td className="acoes-item">
                      <button type="button" className="botao-link" onClick={() => { setErros({}); setMensagem(''); setForm(paraFormulario(f)); }}>
                        Editar
                      </button>
                      <button type="button" className="botao-link perigo" onClick={() => { setErroExclusao(''); setParaExcluir(f); }}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {paraExcluir && (
        <ConfirmarExclusao
          mensagem={`Excluir "${paraExcluir.nome}"?`}
          erro={erroExclusao}
          excluindo={excluindo}
          aoConfirmar={excluir}
          aoCancelar={() => setParaExcluir(null)}
        />
      )}
    </section>
  );
}
