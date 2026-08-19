import { readSession, jsonResponse } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) {
    return jsonResponse({ authenticated: false }, { status: 401 });
  }

  let unidade = null;
  if (session.unidadeId) {
    unidade = await env.DB.prepare("SELECT id, sigla, nome FROM unidades WHERE id = ?")
      .bind(session.unidadeId)
      .first();
  }

  return jsonResponse({
    authenticated: true,
    role: session.role,
    nome: session.nome,
    unidade,
  });
}
