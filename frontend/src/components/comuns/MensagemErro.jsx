// Mensagem de erro geral (não ligada a um campo específico).
export default function MensagemErro({ mensagem }) {
  if (!mensagem) return null;
  return (
    <p className="mensagem-erro" role="alert">
      {mensagem}
    </p>
  );
}
