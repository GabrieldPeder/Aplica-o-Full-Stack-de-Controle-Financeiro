// Carrega dados da API (GET) e controla os estados de carregando e erro.
// Uso: const { dados, carregando, erro, recarregar } = useApi('/categorias');
//      useApi('/lancamentos', { inicio, fim, pagina })  ← recarrega quando os parâmetros mudam
import { useCallback, useEffect, useState } from 'react';
import { api, extrairErro } from './api.js';

export function useApi(caminho, parametros) {
  const [versao, setVersao] = useState(0);
  // Identifica a consulta atual; mudou caminho, parâmetros ou pediu recarregar → nova consulta.
  const chave = JSON.stringify([caminho, parametros ?? {}, versao]);
  // Guarda de qual consulta veio o último resultado. Enquanto for de outra, está carregando.
  const [resultado, setResultado] = useState({ chave: null, dados: null, erro: '' });

  useEffect(() => {
    let ativo = true; // ignora respostas que chegam depois de a tela mudar
    const [caminhoAtual, parametrosAtuais] = JSON.parse(chave);
    api
      .get(caminhoAtual, { params: parametrosAtuais })
      .then(({ data }) => ativo && setResultado({ chave, dados: data, erro: '' }))
      .catch((e) => ativo && setResultado((anterior) => ({ chave, dados: anterior.dados, erro: extrairErro(e).mensagem })));
    return () => {
      ativo = false;
    };
  }, [chave]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const atual = resultado.chave === chave;
  return {
    dados: resultado.dados, // mantém os dados anteriores enquanto recarrega (sem piscar a tela)
    carregando: !atual,
    erro: atual ? resultado.erro : '',
    recarregar,
  };
}
