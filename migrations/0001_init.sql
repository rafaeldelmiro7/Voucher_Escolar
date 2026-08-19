-- Sistema de Voucher de Matrícula - Rede Adventista de Educação (ASuR)

CREATE TABLE IF NOT EXISTS unidades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sigla TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('escola', 'loja')),
  unidade_id INTEGER REFERENCES unidades(id),
  nome_exibicao TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matriculas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_responsavel TEXT NOT NULL,
  cpf_responsavel TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  nome_aluno TEXT NOT NULL,
  ra_aluno TEXT NOT NULL,
  data_matricula TEXT NOT NULL,
  unidade_id INTEGER NOT NULL REFERENCES unidades(id),
  criado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),

  voucher_numero INTEGER,
  voucher_elegivel INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'aguardando_retirada' CHECK (status IN ('aguardando_retirada', 'retirado')),
  retirada_nome TEXT,
  retirada_data TEXT,
  retirada_foto_key TEXT,
  retirada_assinatura_key TEXT,
  retirada_por_usuario INTEGER REFERENCES usuarios(id)
);

CREATE INDEX IF NOT EXISTS idx_matriculas_unidade ON matriculas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_matriculas_status ON matriculas(status);
CREATE INDEX IF NOT EXISTS idx_matriculas_cpf ON matriculas(cpf_responsavel);
CREATE UNIQUE INDEX IF NOT EXISTS idx_matriculas_voucher_numero ON matriculas(voucher_numero) WHERE voucher_numero IS NOT NULL;

CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Limite total de vouchers da campanha (rede toda). NULL/ausente = sem limite.
INSERT OR IGNORE INTO config (chave, valor) VALUES ('limite_vouchers', '');

INSERT OR IGNORE INTO unidades (sigla, nome) VALUES
  ('CAJI', 'CAJI - Colégio Adventista de Ji-Paraná'),
  ('EAOP', 'EAOP - Escola Adventista de Ouro Preto do Oeste'),
  ('EAJI', 'EAJI - Escola Adventista de Ji-Paraná'),
  ('EAV',  'EAV - Escola Adventista de Vilhena');
