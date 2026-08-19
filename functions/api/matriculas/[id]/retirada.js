import { readSession, jsonResponse } from "../../../_lib/auth.js";

function extFromType(type, fallback) {
  if (!type) return fallback;
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return fallback;
}

export async function onRequestPost({ request, env, params }) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session || (session.role !== "loja" && session.role !== "admin")) {
    return jsonResponse({ error: "Apenas a loja conveniada pode registrar retiradas." }, { status: 403 });
  }

  const id = parseInt(params.id, 10);
  if (!id) return jsonResponse({ error: "Matrícula inválida." }, { status: 400 });

  const matricula = await env.DB.prepare("SELECT * FROM matriculas WHERE id = ?").bind(id).first();
  if (!matricula) return jsonResponse({ error: "Matrícula não encontrada." }, { status: 404 });
  if (matricula.status === "retirado") {
    return jsonResponse({ error: "Esta matrícula já teve o material retirado." }, { status: 409 });
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonResponse({ error: "Envio inválido, esperado multipart/form-data." }, { status: 400 });
  }

  const form = await request.formData();
  const retiradaNome = (form.get("retirada_nome") || "").toString().trim();
  const parentesco = (form.get("parentesco") || "").toString().trim();
  const fotoFile = form.get("foto");
  const assinaturaFile = form.get("assinatura");

  if (!retiradaNome) return jsonResponse({ error: "Informe o nome de quem retirou o material." }, { status: 400 });
  if (!parentesco) return jsonResponse({ error: "Informe o grau de parentesco de quem retirou o material." }, { status: 400 });
  if (!(fotoFile instanceof File) || fotoFile.size === 0) {
    return jsonResponse({ error: "Foto de quem retirou é obrigatória." }, { status: 400 });
  }
  if (!(assinaturaFile instanceof File) || assinaturaFile.size === 0) {
    return jsonResponse({ error: "Assinatura é obrigatória." }, { status: 400 });
  }

  const timestamp = Date.now();
  const fotoExt = extFromType(fotoFile.type, "jpg");
  const assinaturaExt = extFromType(assinaturaFile.type, "png");

  const fotoKey = `retiradas/${id}/foto-${timestamp}.${fotoExt}`;
  const assinaturaKey = `retiradas/${id}/assinatura-${timestamp}.${assinaturaExt}`;

  await env.MEDIA.put(fotoKey, await fotoFile.arrayBuffer(), {
    httpMetadata: { contentType: fotoFile.type || "image/jpeg" },
  });
  await env.MEDIA.put(assinaturaKey, await assinaturaFile.arrayBuffer(), {
    httpMetadata: { contentType: assinaturaFile.type || "image/png" },
  });

  const retiradaData = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE matriculas
     SET status = 'retirado', retirada_nome = ?, retirada_parentesco = ?, retirada_data = ?, retirada_foto_key = ?, retirada_assinatura_key = ?, retirada_por_usuario = ?
     WHERE id = ?`
  )
    .bind(retiradaNome, parentesco, retiradaData, fotoKey, assinaturaKey, session.uid, id)
    .run();

  const atualizado = await env.DB.prepare("SELECT * FROM matriculas WHERE id = ?").bind(id).first();
  return jsonResponse({ matricula: atualizado });
}
