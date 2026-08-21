-- Indica se a matrícula é de um aluno novo. Quando marcado, o voucher é em
-- material escolar (Kit Escolar) em vez do valor em dinheiro por data.
ALTER TABLE matriculas ADD COLUMN aluno_novo INTEGER NOT NULL DEFAULT 0;
