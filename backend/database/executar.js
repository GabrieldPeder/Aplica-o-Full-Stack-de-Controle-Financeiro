// Executa um arquivo .sql no banco configurado no .env.
// Uso: node database/executar.js <arquivo.sql> [--teste]
//   --teste  usa DATABASE_URL_TESTE em vez de DATABASE_URL
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function executarSql(caminhoArquivo) {
  // Import dinâmico: a configuração só é lida depois de o --teste definir NODE_ENV.
  const { pool } = await import('../src/config/db.js');
  const sql = await readFile(resolve(process.cwd(), caminhoArquivo), 'utf8');
  await pool.query(sql);
}

const executadoDiretamente = import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDiretamente) {
  const [arquivo, ...opcoes] = process.argv.slice(2);
  if (!arquivo) {
    console.error('Uso: node database/executar.js <arquivo.sql> [--teste]');
    process.exit(1);
  }
  if (opcoes.includes('--teste')) process.env.NODE_ENV = 'test';

  const { pool } = await import('../src/config/db.js');
  try {
    await executarSql(arquivo);
    console.log(`OK: ${arquivo}`);
  } catch (erro) {
    console.error(`Erro ao executar ${arquivo}: ${erro.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
