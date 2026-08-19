import { verifyPassword, createSessionCookie, jsonResponse } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Requisição inválida." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!email || !password) {
    return jsonResponse({ error: "Informe e-mail e senha." }, { status: 400 });
  }

  const usuario = await env.DB.prepare(
    `SELECT u.id, u.email, u.password_hash, u.role, u.is_admin, u.unidade_id, u.nome_exibicao, un.sigla AS unidade_sigla, un.nome AS unidade_nome
     FROM usuarios u
     LEFT JOIN unidades un ON un.id = u.unidade_id
     WHERE u.email = ?`
  )
    .bind(email)
    .first();

  if (!usuario) {
    return jsonResponse({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const ok = await verifyPassword(password, usuario.password_hash);
  if (!ok) {
    return jsonResponse({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  // Usuários marcados como is_admin têm acesso geral a todas as unidades e à loja,
  // independentemente do role de base cadastrado.
  const effectiveRole = usuario.is_admin ? "admin" : usuario.role;

  const cookie = await createSessionCookie(
    {
      uid: usuario.id,
      role: effectiveRole,
      unidadeId: usuario.unidade_id,
      nome: usuario.nome_exibicao,
    },
    env.SESSION_SECRET
  );

  return jsonResponse(
    {
      role: effectiveRole,
      nome: usuario.nome_exibicao,
      unidade: usuario.unidade_id ? { id: usuario.unidade_id, sigla: usuario.unidade_sigla, nome: usuario.unidade_nome } : null,
    },
    { headers: { "Set-Cookie": cookie } }
  );
}
