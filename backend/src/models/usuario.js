// Acesso ao banco para usuários: cadastro, login e busca.
// A senha só existe aqui dentro: nenhuma função devolve senha_hash.
import bcrypt from 'bcrypt';
import { consultar, emTransacao } from '../config/db.js';
import { ErroApi } from '../middlewares/erros.js';

const CUSTO_BCRYPT = 10;
const COLUNAS = 'id, nome, email, cpf';

// Criados para todo usuário novo (spec, seção 3).
export const CATEGORIAS_PADRAO = [
  { nome: 'Alimentação', tipo: 'saida' },
  { nome: 'Moradia', tipo: 'saida' },
  { nome: 'Saúde', tipo: 'saida' },
  { nome: 'Mobilidade', tipo: 'saida' },
  { nome: 'Lazer', tipo: 'saida' },
  { nome: 'Educação', tipo: 'saida' },
  { nome: 'Outros', tipo: 'saida' },
  { nome: 'Salário', tipo: 'entrada' },
  { nome: 'Outros', tipo: 'entrada' },
];

export const FONTES_PADRAO = [
  { nome: 'Conta corrente', tipo: 'conta' },
  { nome: 'Salário', tipo: 'renda' },
];

// Hash usado quando o e-mail não existe, para o login levar o mesmo tempo
// e não revelar quais e-mails estão cadastrados.
const HASH_FICTICIO = bcrypt.hashSync('senha-que-ninguem-usa-1', CUSTO_BCRYPT);

// Insere várias linhas de uma vez: VALUES ($1, $2, $3), ($1, $4, $5), ...
async function inserirPadroes(cliente, tabela, usuarioId, itens) {
  const params = [usuarioId];
  const linhas = itens.map(({ nome, tipo }) => {
    params.push(nome, tipo);
    return `($1, $${params.length - 1}, $${params.length})`;
  });
  await cliente.query(`INSERT INTO ${tabela} (usuario_id, nome, tipo) VALUES ${linhas.join(', ')}`, params);
}

// Cadastro + categorias e fontes padrão, tudo ou nada.
// Dados já normalizados pelo validar (e-mail em minúsculas, CPF só dígitos).
export async function criarComPadroes({ nome, email, cpf, senha }) {
  // Checagem amigável: informa e-mail E CPF repetidos de uma vez.
  // A garantia real é o UNIQUE do banco (erro 23505 → 409 no middleware de erros).
  const { rows: existentes } = await consultar(
    'SELECT email, cpf FROM usuarios WHERE email = $1 OR cpf = $2',
    [email, cpf],
  );
  if (existentes.length > 0) {
    const campos = {};
    if (existentes.some((u) => u.email === email)) campos.email = 'Já existe um usuário com este e-mail.';
    if (existentes.some((u) => u.cpf === cpf)) campos.cpf = 'Já existe um usuário com este CPF.';
    throw new ErroApi(409, 'Usuário já cadastrado.', campos);
  }

  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);
  return emTransacao(async (cliente) => {
    const { rows } = await cliente.query(
      `INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ($1, $2, $3, $4) RETURNING ${COLUNAS}`,
      [nome, email, cpf, senhaHash],
    );
    const usuario = rows[0];
    await inserirPadroes(cliente, 'categorias', usuario.id, CATEGORIAS_PADRAO);
    await inserirPadroes(cliente, 'fontes_destinos', usuario.id, FONTES_PADRAO);
    return usuario;
  });
}

// Devolve o usuário se e-mail e senha conferem; senão null.
export async function conferirCredenciais(email, senha) {
  const { rows } = await consultar(`SELECT ${COLUNAS}, senha_hash FROM usuarios WHERE email = $1`, [email]);
  const encontrado = rows[0];
  const confere = await bcrypt.compare(senha, encontrado?.senha_hash ?? HASH_FICTICIO);
  if (!encontrado || !confere) return null;
  const { senha_hash: _descartado, ...usuario } = encontrado;
  return usuario;
}

export async function buscarPorId(id) {
  const { rows } = await consultar(`SELECT ${COLUNAS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
