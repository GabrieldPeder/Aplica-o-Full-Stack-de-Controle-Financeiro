// Lista de opções com rótulo e mensagem de erro. opcoes: [{ valor, texto }]
export default function CampoSelect({ rotulo, nome, valor, aoMudar, opcoes, erro, ...resto }) {
  const idErro = `${nome}-erro`;
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}</label>
      <select
        id={nome}
        name={nome}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? idErro : undefined}
        {...resto}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.texto}
          </option>
        ))}
      </select>
      {erro && (
        <span id={idErro} className="campo-erro">
          {erro}
        </span>
      )}
    </div>
  );
}
