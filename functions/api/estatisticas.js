import { readSession, jsonResponse } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: "Não autenticado." }, { status: 401 });
  if (session.role !== "loja" && session.role !== "admin") {
    return jsonResponse({ error: "Acesso negado." }, { status: 403 });
  }

  // valor_total soma voucher_valor (centavos) apenas de quem tem voucher
  // elegível e não é "aluno novo" (kit escolar não entra na soma monetária).
  const { results } = await env.DB.prepare(
    `SELECT un.id, un.sigla, un.nome,
       COUNT(CASE WHEN m.voucher_elegivel = 1 THEN 1 END) AS total_vouchers,
       COALESCE(SUM(CASE WHEN m.voucher_elegivel = 1 AND m.aluno_novo = 0 THEN m.voucher_valor ELSE 0 END), 0) AS valor_total_centavos
     FROM unidades un
     LEFT JOIN matriculas m ON m.unidade_id = un.id
     GROUP BY un.id, un.sigla, un.nome
     ORDER BY un.sigla`
  ).all();

  const valorTotalGeralCentavos = results.reduce((soma, u) => soma + u.valor_total_centavos, 0);

  return jsonResponse({ unidades: results, valor_total_geral_centavos: valorTotalGeralCentavos });
}
