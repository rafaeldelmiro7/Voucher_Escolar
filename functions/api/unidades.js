import { readSession, jsonResponse } from "../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: "Não autenticado." }, { status: 401 });

  const { results } = await env.DB.prepare("SELECT id, sigla, nome FROM unidades ORDER BY sigla").all();
  return jsonResponse({ unidades: results });
}
