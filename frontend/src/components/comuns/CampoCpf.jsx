import CampoTexto from './CampoTexto.jsx';
import { mascaraCpf } from '../../services/formatar.js';

// Campo de CPF com máscara 000.000.000-00.
export default function CampoCpf({ valor, aoMudar, ...resto }) {
  return (
    <CampoTexto
      valor={valor}
      aoMudar={(texto) => aoMudar(mascaraCpf(texto))}
      inputMode="numeric"
      placeholder="000.000.000-00"
      {...resto}
    />
  );
}
