import { readSession, jsonResponse } from "../../_lib/auth.js";

// Serve arquivos do R2 (fotos e assinaturas de retirada) somente para usuários autenticados
// (loja, ou a escola dona da unidade correspondente ao arquivo).
export async function onRequestGet({ request, env, params }) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: "Não autenticado." }, { status: 401 });

  const segments = Array.isArray(params.key) ? params.key : [params.key];
  const key = segments.filter(Boolean).join("/");
  if (!key) return jsonResponse({ error: "Arquivo não informado." }, { status: 400 });

  if (session.role === "escola") {
    const matriculaIdMatch = key.match(/^retiradas\/(\d+)\//);
    const matriculaId = matriculaIdMatch ? parseInt(matriculaIdMatch[1], 10) : null;
    if (!matriculaId) return jsonResponse({ error: "Acesso negado." }, { status: 403 });
    const matricula = await env.DB.prepare("SELECT unidade_id FROM matriculas WHERE id = ?").bind(matriculaId).first();
    if (!matricula || matricula.unidade_id !== session.unidadeId) {
      return jsonResponse({ error: "Acesso negado." }, { status: 403 });
    }
  } else if (session.role !== "loja" && session.role !== "admin") {
    return jsonResponse({ error: "Acesso negado." }, { status: 403 });
  }

  const object = await env.MEDIA.get(key);
  if (!object) return jsonResponse({ error: "Arquivo não encontrado." }, { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  return new Response(object.body, { headers });
}
