-- Valor (em centavos) do voucher de material escolar, calculado a partir da
-- data da matrícula (ver functions/_lib/voucherValor.js).
ALTER TABLE matriculas ADD COLUMN voucher_valor INTEGER;
