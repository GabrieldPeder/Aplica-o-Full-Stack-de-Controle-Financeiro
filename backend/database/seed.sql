-- Carga de demonstração. APAGA todos os dados e cria 2 usuários com 3 meses de lançamentos
-- relativos à data de hoje (o mês atual e os 3 anteriores: a saúde financeira usa 3 meses completos).
-- Uso: npm run db:seed        (depois de npm run db:criar)
--
-- Usuários (senha de ambos: demo1234):
--   ana@exemplo.com    CPF 529.982.247-25
--   bruno@exemplo.com  CPF 111.444.777-35
--
-- Cada usuário tem as categorias/fontes padrão do cadastro, mais:
--   * Cartão Roxo  — fecha dia 3,  vence dia 10 (fechamento < vencimento)
--   * Cartão Verde — fecha dia 25, vence dia 5  (fechamento > vencimento: vence no mês seguinte)
--   * Poupança     — conta marcada como reserva de emergência
-- e lançamentos com: salário mensal, gastos variados, 2 compras parceladas e
-- 1 compra feita exatamente no dia do fechamento do Cartão Roxo.

TRUNCATE lancamentos, fontes_destinos, categorias, usuarios RESTART IDENTITY CASCADE;

-- Hash bcrypt (custo 10) de 'demo1234', gerado previamente.
INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES
  ('Ana Souza',   'ana@exemplo.com',   '52998224725', '$2b$10$sLuuFSBOZd45mzcGW7cckOYNENw6uPyDAdwkfq5HqBpFn76ItaVGC'),
  ('Bruno Lima',  'bruno@exemplo.com', '11144477735', '$2b$10$sLuuFSBOZd45mzcGW7cckOYNENw6uPyDAdwkfq5HqBpFn76ItaVGC');

-- Categorias padrão (iguais às do cadastro) para os dois usuários.
INSERT INTO categorias (usuario_id, nome, tipo)
SELECT u.id, c.nome, c.tipo
FROM usuarios u
CROSS JOIN (VALUES
  ('Alimentação', 'saida'), ('Moradia', 'saida'), ('Saúde', 'saida'), ('Mobilidade', 'saida'),
  ('Lazer', 'saida'), ('Educação', 'saida'), ('Outros', 'saida'),
  ('Salário', 'entrada'), ('Outros', 'entrada')
) AS c(nome, tipo);

-- Fontes/destinos: padrões + 2 cartões + poupança (reserva).
INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
SELECT u.id, f.nome, f.tipo, f.fechamento, f.vencimento, f.limite, f.reserva
FROM usuarios u
CROSS JOIN (VALUES
  ('Conta corrente', 'conta',          NULL::smallint, NULL::smallint, NULL::numeric, FALSE),
  ('Salário',        'renda',          NULL, NULL, NULL, FALSE),
  ('Cartão Roxo',    'cartao_credito', 3,    10,   4000, FALSE),
  ('Cartão Verde',   'cartao_credito', 25,   5,    2500, FALSE),
  ('Poupança',       'conta',          NULL, NULL, NULL, TRUE)
) AS f(nome, tipo, fechamento, vencimento, limite, reserva);

-- Função temporária: grava um lançamento (dividido em parcelas, se houver) do usuário,
-- localizando categoria e fonte pelo nome. "mes" é relativo ao mês atual (0, -1, -2).
-- Lançamentos com data no futuro são ignorados (o seed não cria nada depois de hoje).
CREATE OR REPLACE FUNCTION pg_temp.lancar(
  p_email TEXT, p_tipo TEXT, p_descricao TEXT, p_valor NUMERIC, p_mes INT, p_dia INT,
  p_categoria TEXT, p_fonte TEXT, p_parcelas INT DEFAULT 1
) RETURNS VOID AS $$
DECLARE
  v_usuario INT;
  v_categoria INT;
  v_fonte INT;
  v_inicio DATE := (date_trunc('month', CURRENT_DATE) + make_interval(months => p_mes))::date;
  v_data DATE;
  v_centavos BIGINT := round(p_valor * 100);
  v_base BIGINT := floor(round(p_valor * 100) / p_parcelas);
  v_grupo UUID := CASE WHEN p_parcelas > 1 THEN gen_random_uuid() END;
BEGIN
  -- dia inexistente (31 em fevereiro) vira o último dia do mês
  v_data := LEAST(v_inicio + (p_dia - 1), (v_inicio + INTERVAL '1 month - 1 day')::date);
  IF v_data > CURRENT_DATE THEN
    RETURN;
  END IF;

  SELECT id INTO v_usuario FROM usuarios WHERE email = p_email;
  SELECT id INTO v_categoria FROM categorias WHERE usuario_id = v_usuario AND nome = p_categoria AND tipo = p_tipo;
  SELECT id INTO v_fonte FROM fontes_destinos WHERE usuario_id = v_usuario AND nome = p_fonte;

  -- Mesma regra da API: a 1ª parcela recebe o resto da divisão; todas com a data da compra.
  FOR i IN 1..p_parcelas LOOP
    INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                             parcela_atual, total_parcelas, grupo_parcelamento)
    VALUES (v_usuario, p_tipo, p_descricao,
            (CASE WHEN i = 1 THEN v_centavos - v_base * (p_parcelas - 1) ELSE v_base END) / 100.0,
            v_data, v_categoria, v_fonte, i, p_parcelas, v_grupo);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Lançamentos que se repetem nos 3 meses, para os dois usuários.
DO $$
DECLARE
  u RECORD;
  m INT;
BEGIN
  FOR u IN SELECT * FROM (VALUES ('ana@exemplo.com', 6200.00, 1800.00), ('bruno@exemplo.com', 4300.00, 1350.00))
           AS t(email, salario, aluguel) LOOP
    FOR m IN -3..0 LOOP
      PERFORM pg_temp.lancar(u.email, 'entrada', 'Salário',            u.salario, m, 5,  'Salário',     'Salário');
      PERFORM pg_temp.lancar(u.email, 'saida',   'Aluguel',            u.aluguel, m, 10, 'Moradia',     'Conta corrente');
      PERFORM pg_temp.lancar(u.email, 'saida',   'Conta de luz',       142.37 + m * 9, m, 12, 'Moradia', 'Conta corrente');
      PERFORM pg_temp.lancar(u.email, 'saida',   'Supermercado',       612.40 - m * 23, m, 6, 'Alimentação', 'Cartão Roxo');
      PERFORM pg_temp.lancar(u.email, 'saida',   'Feira e padaria',    188.90, m, 16, 'Alimentação', 'Cartão Verde');
      PERFORM pg_temp.lancar(u.email, 'saida',   'Transporte por app', 96.50,  m, 8,  'Mobilidade',  'Cartão Roxo');
      PERFORM pg_temp.lancar(u.email, 'saida',   'Combustível',        210.00, m, 18, 'Mobilidade',  'Cartão Verde');
      PERFORM pg_temp.lancar(u.email, 'saida',   'Curso de inglês',    289.00, m, 15, 'Educação',    'Conta corrente');
      PERFORM pg_temp.lancar(u.email, 'entrada', 'Rendimento poupança', 38.20 - m * 2, m, 1, 'Outros', 'Poupança');
    END LOOP;
  END LOOP;
END;
$$;

-- Ana: guarda dinheiro todo mês, gasta mais com lazer no mês atual (categoria "fora da curva").
SELECT pg_temp.lancar('ana@exemplo.com', 'entrada', 'Reserva de emergência', 36000.00, -14, 6,  'Outros', 'Poupança');
SELECT pg_temp.lancar('ana@exemplo.com', 'saida',   'Cinema',                   64.00, -3, 20, 'Lazer',  'Cartão Roxo');
SELECT pg_temp.lancar('ana@exemplo.com', 'saida',   'Jantar de aniversário',   142.00, -2, 17, 'Lazer',  'Cartão Verde');
SELECT pg_temp.lancar('ana@exemplo.com', 'saida',   'Restaurante',             118.00, -1, 21, 'Lazer',  'Cartão Roxo');
SELECT pg_temp.lancar('ana@exemplo.com', 'saida',   'Show',                    380.00,  0, 2,  'Lazer',  'Cartão Verde');
SELECT pg_temp.lancar('ana@exemplo.com', 'saida',   'Viagem de fim de semana', 690.00,  0, 4,  'Lazer',  'Conta corrente');
SELECT pg_temp.lancar('ana@exemplo.com', 'saida',   'Consulta médica',         250.00, -1, 14, 'Saúde',  'Conta corrente');
SELECT pg_temp.lancar('ana@exemplo.com', 'saida',   'Farmácia',                 73.85,  0, 9,  'Saúde',  'Cartão Roxo');
-- Compras parceladas
SELECT pg_temp.lancar('ana@exemplo.com', 'saida', 'Notebook',  4299.90, -2, 11, 'Educação', 'Cartão Roxo',  10);
SELECT pg_temp.lancar('ana@exemplo.com', 'saida', 'Geladeira', 2400.00, -1, 26, 'Moradia',  'Cartão Verde', 6);
-- Compra exatamente no dia do fechamento do Cartão Roxo (dia 3): cai na fatura SEGUINTE.
SELECT pg_temp.lancar('ana@exemplo.com', 'saida', 'Tênis (dia do fechamento)', 349.90, -1, 3, 'Outros', 'Cartão Roxo');

-- Bruno: orçamento mais apertado, pouca reserva e mais parcelas.
SELECT pg_temp.lancar('bruno@exemplo.com', 'entrada', 'Freela de design',     900.00, -1, 22, 'Outros', 'Conta corrente');
SELECT pg_temp.lancar('bruno@exemplo.com', 'entrada', 'Depósito na poupança', 1200.00, -14, 7, 'Outros', 'Poupança');
SELECT pg_temp.lancar('bruno@exemplo.com', 'saida',   'Bar com amigos',       156.00, -2, 13, 'Lazer',  'Cartão Verde');
SELECT pg_temp.lancar('bruno@exemplo.com', 'saida',   'Streaming',             55.90, -1, 2,  'Lazer',  'Cartão Roxo');
SELECT pg_temp.lancar('bruno@exemplo.com', 'saida',   'Streaming',             55.90,  0, 2,  'Lazer',  'Cartão Roxo');
SELECT pg_temp.lancar('bruno@exemplo.com', 'saida',   'Dentista',             320.00,  0, 11, 'Saúde',  'Conta corrente');
SELECT pg_temp.lancar('bruno@exemplo.com', 'saida',   'Celular',             2899.00, -2, 9,  'Outros', 'Cartão Roxo',  12);
SELECT pg_temp.lancar('bruno@exemplo.com', 'saida',   'Sofá',                1980.00, -1, 25, 'Moradia', 'Cartão Verde', 5);
SELECT pg_temp.lancar('bruno@exemplo.com', 'saida',   'Mochila (dia do fechamento)', 189.90, 0, 3, 'Outros', 'Cartão Roxo');
