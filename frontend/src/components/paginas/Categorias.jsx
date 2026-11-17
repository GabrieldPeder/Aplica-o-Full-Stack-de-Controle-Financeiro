import { useState } from 'react';
import { api, extrairErro } from '../../services/api.js';
import { useApi } from '../../services/useApi.js';
import CampoTexto from '../comuns/CampoTexto.jsx';
import CampoSelect from '../comuns/CampoSelect.jsx';
import Carregando from '../comuns/Carregando.jsx';
import ListaVazia from '../comuns/ListaVazia.jsx';
import MensagemErro from '../comuns/MensagemErro.jsx';
import ConfirmarExclusao from '../comuns/ConfirmarExclusao.jsx';

const TIPOS = [
  { valor: 'saida', texto: 'Saída' },
  { valor: 'entrada', texto: 'Entrada' },
];
const VAZIO = { id: null, nome: '', tipo: 'saida' };

export default function Categorias() {
  const { dados: categorias, carregando, erro, recarregar } = useApi('/categorias');
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const editando = form.id !== null;
  const emUso = editando && categorias?.find((c) => c.id === form.id)?.quantidadeLancamentos > 0;

  function limparFormulario() {
    setForm(VAZIO);
    setErros({});
    setMensagem('');
  }

  async function salvar(evento) {
    evento.preventDefault();
    setMensagem('');
    if (!form.nome.trim()) {
      setErros({ nome: 'Informe o nome.' });
      return;
    }
    setEnviando(true);
    try {
      const corpo = { nome: form.nome, tipo: form.tipo };
      if (editando) await api.put(`/categorias/${form.id}`, corpo);
      else await api.post('/categorias', corpo);
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
      await api.delete(`/categorias/${paraExcluir.id}`);
      if (form.id === paraExcluir.id) limparFormulario();
      setParaExcluir(null);
      recarregar();
    } catch (e) {
      setErroExclusao(extrairErro(e).mensagem);
    } finally {
      setExcluindo(false);
    }
  }

  function pedirExclusao(categoria) {
    setErroExclusao('');
    setParaExcluir(categoria);
  }

  return (
    <section>
      <h1>Categorias</h1>

      <form className="cartao formulario-linha" onSubmit={salvar} noValidate>
        <h2>{editando ? 'Editar categoria' : 'Nova categoria'}</h2>
        <MensagemErro mensagem={mensagem} />
        <div className="campos-linha">
          <CampoTexto rotulo="Nome" nome="nome" valor={form.nome} aoMudar={(nome) => setForm({ ...form, nome })} erro={erros.nome} maxLength={60} />
          <CampoSelect
            rotulo="Tipo"
            nome="tipo"
            valor={form.tipo}
            aoMudar={(tipo) => setForm({ ...form, tipo })}
            opcoes={TIPOS}
            erro={erros.tipo}
            disabled={emUso}
          />
        </div>
        {emUso && <p className="detalhe">A categoria já tem lançamentos; só o nome pode ser alterado.</p>}
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

      {carregando && !categorias && <Carregando />}
      <MensagemErro mensagem={erro} />

      {categorias && (
        <div className="colunas">
          {TIPOS.map(({ valor, texto }) => {
            const doTipo = categorias.filter((c) => c.tipo === valor);
            return (
              <div key={valor} className="cartao">
                <h2>{texto === 'Saída' ? 'Saídas' : 'Entradas'}</h2>
                {doTipo.length === 0 ? (
                  <ListaVazia texto="Nenhuma categoria." />
                ) : (
                  <ul className="lista">
                    {doTipo.map((c) => (
                      <li key={c.id}>
                        <span>
                          {c.nome}
                          {c.quantidadeLancamentos > 0 && (
                            <small className="detalhe"> · {c.quantidadeLancamentos} lançamento(s)</small>
                          )}
                        </span>
                        <span className="acoes-item">
                          <button type="button" className="botao-link" onClick={() => { setErros({}); setMensagem(''); setForm(c); }}>
                            Editar
                          </button>
                          <button type="button" className="botao-link perigo" onClick={() => pedirExclusao(c)}>
                            Excluir
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {paraExcluir && (
        <ConfirmarExclusao
          mensagem={
            paraExcluir.quantidadeLancamentos > 0
              ? `A categoria "${paraExcluir.nome}" tem ${paraExcluir.quantidadeLancamentos} lançamento(s) e não pode ser excluída. Exclua ou altere esses lançamentos antes.`
              : `Excluir a categoria "${paraExcluir.nome}"?`
          }
          erro={erroExclusao}
          excluindo={excluindo}
          aoConfirmar={excluir}
          aoCancelar={() => setParaExcluir(null)}
        >
          {paraExcluir.quantidadeLancamentos > 0 ? <></> : undefined}
        </ConfirmarExclusao>
      )}
    </section>
  );
}
