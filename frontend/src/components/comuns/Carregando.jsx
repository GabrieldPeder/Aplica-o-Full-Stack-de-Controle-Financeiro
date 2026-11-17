export default function Carregando({ texto = 'Carregando…' }) {
  return (
    <p className="carregando" role="status">
      {texto}
    </p>
  );
}
