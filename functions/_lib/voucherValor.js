// Valor do voucher de material escolar, por faixa de data da matrícula.
//
// ATUALIZE ESTA TABELA sempre que os períodos/valores da campanha mudarem.
// Mantenha em sincronia com public/js/voucher-valor.js (mesma tabela, mesma ordem).
export const FAIXAS_VOUCHER = [
  { inicio: "2026-08-13", fim: "2026-09-11", valorCentavos: 40000 }, // R$ 400,00
  { inicio: "2026-09-12", fim: "2026-10-14", valorCentavos: 30000 }, // R$ 300,00
];

// dataMatricula no formato "YYYY-MM-DD". Retorna o valor em centavos, ou
// null se a data cair fora de todas as faixas cadastradas.
export function calcularVoucherValor(dataMatricula) {
  if (!dataMatricula) return null;
  const faixa = FAIXAS_VOUCHER.find((f) => dataMatricula >= f.inicio && dataMatricula <= f.fim);
  return faixa ? faixa.valorCentavos : null;
}
