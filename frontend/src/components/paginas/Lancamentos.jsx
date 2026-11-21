// Lançamentos (RF6): filtros, tabela paginada com totais, formulário de criação/edição
// (com parcelamento no cartão) e exclusão com a escolha "só esta parcela / todas".
import { useState } from 'react';
import { api, extrairErro } from '../../services/api.js';
import { useApi } from '../../services/useApi.js';
import { moeda, dataBr, mesAtual } from '../../services/formatar.js';
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
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const novoFormulario = () => ({
  id: null, tipo: 'saida', descricao: '', valor: '', data: hoje(), categoriaId: '', fonteDestinoId: '', totalParcelas: '1',
});
const TRAVADO_EM_PARCELADO = 'Compra parcelada: para mudar este campo, exclua a compra e lance novamente.';

function validarFormulario(form, ehCartao) {
  const erros = {};
  if (!form.descricao.trim()) erros.descricao = 'Informe a descrição.';
  const valor = Number(form.valor);
  if (!(valor > 0) || Math.round(valor * 100) !== Number((valor * 100).toFixed(6))) {
    erros.valor = 'Informe um valor maior que zero, com até 2 casas decimais.';
  }
  if (!form.data) erros.data = 'Informe a data.';
  if (!form.categoriaId) erros.categoriaId = 'Escolha a categoria.';
  if (!form.fonteDestinoId) erros.fonteDestinoId = 'Escolha a fonte/destino.';
  const parcelas = Number(form.totalParcelas);
  if (ehCartao && (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48)) {
    erros.totalParcelas = 'De 1 a 48 parcelas.';
  }
  return erros;
}

export default function Lancamentos() {
  const [filtros, setFiltros] = useState(() => ({ ...mesAtual(), tipo: '', categoriaId: '', fonteDestinoId: '' }));
  const [pagina, setPagina] = useState(1);
  const filtroValido = filtros.inicio && filtros.fim && filtros.inicio <= filtros.fim;
  // Só manda para a API os filtros preenchidos.
  const parametros = Object.fromEntries(Object.entries({ ...filtros, pagina }).filter(([, v]) => v !== ''));

  const lista = useApi(filtroValido ? '/lancamentos' : null, parametros);
  const { dados: categorias } = useApi('/categorias');
  const { dados: fontes } = useApi('/fontes-destinos');

  const [form, setForm] = useState(novoFormulario);
  const [erros, setErros] = useState({});
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [paraExcluir, setParaExcluir] = useState(null);
  const [erroExclusao, setErroExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);

  const editando = form.id !== null;
  const parcelado = editando && form.totalParcelasOriginal > 1;
  const fonteEscolhida = fontes?.find((f) => f.id === Number(form.fonteDestinoId));
  const ehCartao = form.tipo === 'saida' && fonteEscolhida?.tipo === 'cartao_credito';
  const categoriasDoTipo = (categorias ?? []).filter((c) => c.tipo === form.tipo);

  const alterar = (campo) => (valor) => setForm((atual) => ({ ...atual, [campo]: valor }));
  const alterarFiltro = (campo) => (valor) => {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    setPagina(1);
  };

  function trocarTipo(tipo) {
    // A categoria depende do tipo: ao trocar, limpa a escolhida.
    setForm((atual) => ({ ...atual, tipo, categoriaId: '', totalParcelas: tipo === 'saida' ? atual.totalParcelas : '1' }));
  }

  function limparFormulario() {
    setForm(novoFormulario());
    setErros({});
    setMensagem('');
  }

  function editar(l) {
    setErros({});
    setMensagem('');
    setForm({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: String(l.valor),
      data: l.data,
      categoriaId: String(l.categoriaId),
      fonteDestinoId: String(l.fonteDestinoId),
      totalParcelas: String(l.totalParcelas),
      totalParcelasOriginal: l.totalParcelas,
      parcelaAtual: l.parcelaAtual,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvar(evento) {
    evento.preventDefault();
    setMensagem('');
    const novosErros = validarFormulario(form, ehCartao);
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) return;

    const corpo = {
      tipo: form.tipo,
      descricao: form.descricao,
      valor: Number(form.valor),
      data: form.data,
      categoriaId: Number(form.categoriaId),
      fonteDestinoId: Number(form.fonteDestinoId),
      totalParcelas: ehCartao || parcelado ? Number(form.totalParcelas) : 1,
    };
    setEnviando(true);
    try {
      if (editando) await api.put(`/lancamentos/${form.id}`, corpo);
      else await api.post('/lancamentos', corpo);
      limparFormulario();
      lista.recarregar();
    } catch (e) {
      const { mensagem: msg, campos } = extrairErro(e);
      setErros(campos);
      setMensagem(msg);
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(todasParcelas) {
    setExcluindo(true);
    try {
      await api.delete(`/lancamentos/${paraExcluir.id}`, { params: todasParcelas ? { todasParcelas: true } : {} });
      if (form.id === paraExcluir.id) limparFormulario();
      setParaExcluir(null);
      lista.recarregar();
    } catch (e) {
      setErroExclusao(extrairErro(e).mensagem);
    } finally {
      setExcluindo(false);
    }
  }

  const dados = lista.dados;
  const opcoesCategorias = [{ valor: '', texto: 'Escolha…' }, ...categoriasDoTipo.map((c) => ({ valor: String(c.id), texto: c.nome }))];
  const opcoesFontes = [{ valor: '', texto: 'Escolha…' }, ...(fontes ?? []).map((f) => ({ valor: String(f.id), texto: f.nome }))];

  return (
    <section>
      <h1>Lançamentos</h1>

      <form className="cartao" onSubmit={salvar} noValidate>
        <h2>
          {editando ? 'Editar lançamento' : 'Novo lançamento'}
          {parcelado && <small className="detalhe"> · parcela {form.parcelaAtual}/{form.totalParcelasOriginal}</small>}
        </h2>
        <MensagemErro mensagem={mensagem} />
        <div className="campos-linha">
          <CampoSelect rotulo="Tipo" nome="tipo" valor={form.tipo} aoMudar={trocarTipo} opcoes={TIPOS} erro={erros.tipo}
            disabled={parcelado} title={parcelado ? TRAVADO_EM_PARCELADO : undefined} />
          <CampoTexto rotulo="Descrição" nome="descricao" valor={form.descricao} aoMudar={alterar('descricao')} erro={erros.descricao} maxLength={120} />
          <CampoTexto rotulo="Valor (R$)" nome="valor" tipo="number" min="0.01" step="0.01" inputMode="decimal"
            valor={form.valor} aoMudar={alterar('valor')} erro={erros.valor} />
          <CampoTexto rotulo="Data" nome="data" tipo="date" valor={form.data} aoMudar={alterar('data')} erro={erros.data}
            disabled={parcelado} title={parcelado ? TRAVADO_EM_PARCELADO : undefined} />
        </div>
        <div className="campos-linha">
          <CampoSelect rotulo="Categoria" nome="categoriaId" valor={form.categoriaId} aoMudar={alterar('categoriaId')}
            opcoes={opcoesCategorias} erro={erros.categoriaId} />
          <CampoSelect rotulo={form.tipo === 'entrada' ? 'Fonte' : 'Destino'} nome="fonteDestinoId" valor={form.fonteDestinoId}
            aoMudar={alterar('fonteDestinoId')} opcoes={opcoesFontes} erro={erros.fonteDestinoId}
            disabled={parcelado} title={parcelado ? TRAVADO_EM_PARCELADO : undefined} />
          {(ehCartao || parcelado) && (
            <CampoTexto rotulo="Parcelas" nome="totalParcelas" tipo="number" min="1" max="48" step="1"
              valor={form.totalParcelas} aoMudar={alterar('totalParcelas')} erro={erros.totalParcelas} disabled={editando} />
          )}
        </div>
        {parcelado && <p className="detalhe">{TRAVADO_EM_PARCELADO} Aqui você muda só esta parcela (descrição, categoria e valor).</p>}
        {!editando && ehCartao && Number(form.totalParcelas) > 1 && Number(form.valor) > 0 && (
          <p className="detalhe">
            {form.totalParcelas}× de aproximadamente {moeda(Number(form.valor) / Number(form.totalParcelas))}
          </p>
        )}
        <div className="acoes">
          {editando && (
            <button type="button" className="botao-secundario" onClick={limparFormulario}>Cancelar</button>
          )}
          <button type="submit" disabled={enviando}>
            {enviando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Adicionar'}
          </button>
        </div>
      </form>

      <div className="cartao">
        <h2>Filtros</h2>
        <div className="campos-linha">
          <CampoTexto rotulo="De" nome="filtro-inicio" tipo="date" valor={filtros.inicio} aoMudar={alterarFiltro('inicio')} />
          <CampoTexto rotulo="Até" nome="filtro-fim" tipo="date" valor={filtros.fim} aoMudar={alterarFiltro('fim')}
            erro={filtros.inicio && filtros.fim && !filtroValido ? 'A data final deve ser igual ou posterior à inicial.' : undefined} />
          <CampoSelect rotulo="Tipo" nome="filtro-tipo" valor={filtros.tipo} aoMudar={alterarFiltro('tipo')}
            opcoes={[{ valor: '', texto: 'Todos' }, ...TIPOS]} />
          <CampoSelect rotulo="Categoria" nome="filtro-categoria" valor={filtros.categoriaId} aoMudar={alterarFiltro('categoriaId')}
            opcoes={[{ valor: '', texto: 'Todas' }, ...(categorias ?? []).map((c) => ({ valor: String(c.id), texto: `${c.nome} (${c.tipo === 'saida' ? 'saída' : 'entrada'})` }))]} />
          <CampoSelect rotulo="Fonte/destino" nome="filtro-fonte" valor={filtros.fonteDestinoId} aoMudar={alterarFiltro('fonteDestinoId')}
            opcoes={[{ valor: '', texto: 'Todas' }, ...(fontes ?? []).map((f) => ({ valor: String(f.id), texto: f.nome }))]} />
        </div>
      </div>

      {dados && (
        <div className="cartao resumo">
          <div className="destaque"><span>Entradas</span><strong className="positivo">{moeda(dados.totais.entradas)}</strong></div>
          <div className="destaque"><span>Saídas</span><strong className="negativo">{moeda(dados.totais.saidas)}</strong></div>
          <div className="destaque">
            <span>Saldo</span>
            <strong className={dados.totais.saldo < 0 ? 'negativo' : 'positivo'}>{moeda(dados.totais.saldo)}</strong>
          </div>
        </div>
      )}

      {lista.carregando && !dados && <Carregando />}
      <MensagemErro mensagem={lista.erro} />

      {dados && (
        <div className="cartao">
          {dados.itens.length === 0 ? (
            <ListaVazia texto="Nenhum lançamento no período." />
          ) : (
            <>
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Data</th><th>Descrição</th><th>Categoria</th><th>Fonte/destino</th>
                      <th className="valor">Valor</th><th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {dados.itens.map((l) => (
                      <tr key={l.id}>
                        <td>{dataBr(l.data)}</td>
                        <td>
                          {l.descricao}
                          {l.totalParcelas > 1 && <small className="detalhe"> · {l.parcelaAtual}/{l.totalParcelas}</small>}
                        </td>
                        <td>{l.categoriaNome}</td>
                        <td>{l.fonteDestinoNome}</td>
                        <td className={`valor ${l.tipo === 'saida' ? 'negativo' : 'positivo'}`}>
                          {l.tipo === 'saida' ? '−' : '+'} {moeda(l.valor)}
                        </td>
                        <td className="acoes-item">
                          <button type="button" className="botao-link" onClick={() => editar(l)}>Editar</button>
                          <button type="button" className="botao-link perigo" onClick={() => { setErroExclusao(''); setParaExcluir(l); }}>
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="paginacao">
                <button type="button" className="botao-secundario" disabled={pagina <= 1 || lista.carregando} onClick={() => setPagina(pagina - 1)}>
                  Anterior
                </button>
                <span className="detalhe">
                  Página {dados.pagina} de {dados.totalPaginas} · {dados.totalItens} lançamento(s)
                </span>
                <button type="button" className="botao-secundario" disabled={pagina >= dados.totalPaginas || lista.carregando}
                  onClick={() => setPagina(pagina + 1)}>
                  Próxima
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {paraExcluir && (
        <ConfirmarExclusao
          mensagem={
            paraExcluir.totalParcelas > 1
              ? `"${paraExcluir.descricao}" é a parcela ${paraExcluir.parcelaAtual} de ${paraExcluir.totalParcelas}. O que deseja excluir?`
              : `Excluir "${paraExcluir.descricao}" (${moeda(paraExcluir.valor)})?`
          }
          erro={erroExclusao}
          excluindo={excluindo}
          aoConfirmar={() => excluir(false)}
          aoCancelar={() => setParaExcluir(null)}
        >
          {paraExcluir.totalParcelas > 1 ? (
            <>
              <button type="button" className="botao-perigo" onClick={() => excluir(false)} disabled={excluindo}>Só esta parcela</button>
              <button type="button" className="botao-perigo" onClick={() => excluir(true)} disabled={excluindo}>Todas as parcelas</button>
            </>
          ) : undefined}
        </ConfirmarExclusao>
      )}
    </section>
  );
}
