// Campo de formulário com rótulo e mensagem de erro logo abaixo.
export default function CampoTexto({ rotulo, nome, valor, aoMudar, erro, tipo = 'text', ...resto }) {
  const idErro = `${nome}-erro`;
  return (
    <div className="campo">
      <label htmlFor={nome}>{rotulo}</label>
      <input
        id={nome}
        name={nome}
        type={tipo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? idErro : undefined}
        {...resto}
      />
      {erro && (
        <span id={idErro} className="campo-erro">
          {erro}
        </span>
      )}
    </div>
  );
}
