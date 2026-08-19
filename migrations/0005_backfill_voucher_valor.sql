-- Preenche o valor do voucher para matrículas cadastradas antes dessa
-- funcionalidade existir (voucher_valor ainda nulo). Só toca linhas nulas,
-- então é seguro rodar de novo sem sobrescrever valores já calculados.
-- Mantenha as faixas abaixo em sincronia com functions/_lib/voucherValor.js
-- e public/js/voucher-valor.js.
UPDATE matriculas
SET voucher_valor = CASE
  WHEN data_matricula >= '2026-08-13' AND data_matricula <= '2026-09-11' THEN 40000
  WHEN data_matricula >= '2026-09-12' AND data_matricula <= '2026-10-14' THEN 30000
  ELSE NULL
END
WHERE voucher_valor IS NULL;
