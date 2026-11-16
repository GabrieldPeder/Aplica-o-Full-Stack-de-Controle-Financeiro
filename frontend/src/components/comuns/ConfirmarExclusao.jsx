// Janela de confirmação antes de excluir.
// Para opções diferentes de "Excluir" (ex.: "só esta parcela" / "todas"), passe os
// próprios botões como children; eles substituem o botão padrão.
export default function ConfirmarExclusao({ mensagem, erro, excluindo, aoConfirmar, aoCancelar, children }) {
  return (
    <div className="fundo-modal">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirmar-titulo">
        <h2 id="confirmar-titulo">Confirmar exclusão</h2>
        <p>{mensagem}</p>
        {erro && (
          <p className="mensagem-erro" role="alert">
            {erro}
          </p>
        )}
        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={aoCancelar} disabled={excluindo}>
            Cancelar
          </button>
          {children ?? (
            <button type="button" className="botao-perigo" onClick={aoConfirmar} disabled={excluindo}>
              {excluindo ? 'Excluindo…' : 'Excluir'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
