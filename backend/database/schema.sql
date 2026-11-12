-- Schema do banco (PostgreSQL). Recria todas as tabelas: APAGA os dados existentes.
-- Uso: npm run db:criar   (ou npm run db:teste para o banco de testes)

DROP TABLE IF EXISTS lancamentos, fontes_destinos, categorias, usuarios CASCADE;

CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  email       VARCHAR(160) NOT NULL,                -- gravado em minúsculas
  cpf         CHAR(11)     NOT NULL,                -- gravado só com dígitos
  senha_hash  VARCHAR(100) NOT NULL,
  criado_em   TIMESTAMP    NOT NULL DEFAULT NOW(),
  CONSTRAINT usuarios_email_unico UNIQUE (email),
  CONSTRAINT usuarios_cpf_unico   UNIQUE (cpf)
);

CREATE TABLE categorias (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        VARCHAR(60) NOT NULL,
  tipo        VARCHAR(7)  NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  CONSTRAINT categorias_nome_unico UNIQUE (usuario_id, nome, tipo)
);

CREATE TABLE fontes_destinos (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome            VARCHAR(60) NOT NULL,
  tipo            VARCHAR(14) NOT NULL CHECK (tipo IN ('renda', 'conta', 'cartao_credito')),
  dia_fechamento  SMALLINT CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento  SMALLINT CHECK (dia_vencimento BETWEEN 1 AND 31),
  limite          NUMERIC(12, 2) CHECK (limite IS NULL OR limite > 0),
  reserva         BOOLEAN NOT NULL DEFAULT FALSE,   -- usado na página de saúde financeira
  CONSTRAINT fontes_destinos_nome_unico UNIQUE (usuario_id, nome),
  CHECK (tipo <> 'cartao_credito'
         OR (dia_fechamento IS NOT NULL AND dia_vencimento IS NOT NULL AND limite IS NOT NULL))
);

-- FKs de categoria e fonte/destino SEM cascade: excluir com lançamentos vinculados gera erro 23503 (-> 409)
CREATE TABLE lancamentos (
  id                  SERIAL PRIMARY KEY,
  usuario_id          INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo                VARCHAR(7)     NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao           VARCHAR(120)   NOT NULL,
  valor               NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  data                DATE           NOT NULL,      -- em parcelas: data da COMPRA
  categoria_id        INTEGER NOT NULL REFERENCES categorias(id),
  fonte_destino_id    INTEGER NOT NULL REFERENCES fontes_destinos(id),
  parcela_atual       SMALLINT NOT NULL DEFAULT 1,
  total_parcelas      SMALLINT NOT NULL DEFAULT 1 CHECK (total_parcelas BETWEEN 1 AND 48),
  grupo_parcelamento  UUID,                         -- mesmo valor para todas as parcelas de uma compra
  criado_em           TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (parcela_atual BETWEEN 1 AND total_parcelas)
);

CREATE INDEX idx_lancamentos_usuario_data ON lancamentos (usuario_id, data);
CREATE INDEX idx_lancamentos_grupo        ON lancamentos (grupo_parcelamento);
