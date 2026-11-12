// Tratamento de erros centralizado. Toda resposta de erro da API tem o formato
// { erro: 'mensagem', campos?: { campo: 'mensagem' } }.

// Erro "esperado" lançado pelas rotas: next(new ErroApi(404, 'Lançamento não encontrado.'))
export class ErroApi extends Error {
  constructor(status, mensagem, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

// Violações de UNIQUE (código 23505 do PostgreSQL), identificadas pelo nome da constraint.
const DUPLICIDADES = {
  usuarios_email_unico: {
    erro: 'Usuário já cadastrado.',
    campos: { email: 'Já existe um usuário com este e-mail.' },
  },
  usuarios_cpf_unico: {
    erro: 'Usuário já cadastrado.',
    campos: { cpf: 'Já existe um usuário com este CPF.' },
  },
  categorias_nome_unico: {
    erro: 'Registro duplicado.',
    campos: { nome: 'Já existe uma categoria com este nome e tipo.' },
  },
  fontes_destinos_nome_unico: {
    erro: 'Registro duplicado.',
    campos: { nome: 'Já existe uma fonte/destino com este nome.' },
  },
};

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: 'Rota não encontrada.' });
}

// eslint-disable-next-line no-unused-vars -- o Express reconhece o middleware de erro pelos 4 parâmetros
export function tratarErros(err, req, res, next) {
  if (err instanceof ErroApi) {
    const corpo = { erro: err.message };
    if (err.campos) corpo.campos = err.campos;
    return res.status(err.status).json(corpo);
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }

  switch (err.code) {
    case '23505':
      return res.status(409).json(DUPLICIDADES[err.constraint] ?? { erro: 'Registro duplicado.' });
    case '23503':
      return res.status(409).json({ erro: 'Não é possível excluir: existem lançamentos vinculados.' });
    case '22P02':
      return res.status(400).json({ erro: 'Parâmetro inválido.' });
    default:
      console.error(err);
      return res.status(500).json({ erro: 'Erro interno do servidor.' });
  }
}
