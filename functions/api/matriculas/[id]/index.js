import { readSession, jsonResponse } from "../../../_lib/auth.js";
import { validateMatriculaFields } from "../../../_lib/validate.js";
import { calcularVoucherValor } from "../../../_lib/voucherValor.js";
import { SELECT_FIELDS } from "../index.js";

async function loadOwnedMatricula(env, session, id) {
  if (!session || (session.role !== "escola" && session.role !== "admin")) {
    return { error: jsonResponse({ error: "Apenas usuários de escola podem gerenciar matrículas." }, { status: 403 }) };
  }
  if (!id) {
    return { error: jsonResponse({ error: "Matrícula inválida." }, { status: 400 }) };
  }

  const matricula = await env.DB.prepare("SELECT * FROM matriculas WHERE id = ?").bind(id).first();
  if (!matricula) {
    return { error: jsonResponse({ error: "Matrícula não encontrada." }, { status: 404 }) };
  }
  // Admin tem acesso geral a qualquer unidade; escola só à própria.
  if (session.role === "escola" && matricula.unidade_id !== session.unidadeId) {
    return { error: jsonResponse({ error: "Esta matrícula pertence a outra unidade." }, { status: 403 }) };
  }
  return { matricula };
}

export async function onRequestPatch({ request, env, params }) {
  const session = await readSession(request, env.SESSION_SECRET);
  const id = parseInt(params.id, 10);

  const { matricula, error } = await loadOwnedMatricula(env, session, id);
  if (error) return error;

  if (matricula.status === "retirado") {
    return jsonResponse({ error: "Não é possível editar uma matrícula cujo material já foi retirado." }, { status: 409 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Requisição inválida." }, { status: 400 });
  }

  const { values, erros } = validateMatriculaFields(body);
  if (erros.length) {
    return jsonResponse({ error: erros.join(" ") }, { status: 400 });
  }

  const voucherValor = calcularVoucherValor(values.data_matricula);

  await env.DB.prepare(
    `UPDATE matriculas
     SET nome_responsavel = ?, cpf_responsavel = ?, email = ?, telefone = ?,
         nome_aluno = ?, ra_aluno = ?, data_matricula = ?, voucher_valor = ?
     WHERE id = ?`
  )
    .bind(
      values.nome_responsavel,
      values.cpf_responsavel,
      values.email,
      values.telefone,
      values.nome_aluno,
      values.ra_aluno,
      values.data_matricula,
      voucherValor,
      id
    )
    .run();

  const atualizado = await env.DB.prepare(`SELECT ${SELECT_FIELDS} FROM matriculas m LEFT JOIN unidades un ON un.id = m.unidade_id WHERE m.id = ?`)
    .bind(id)
    .first();

  return jsonResponse({ matricula: atualizado });
}

export async function onRequestDelete({ request, env, params }) {
  const session = await readSession(request, env.SESSION_SECRET);
  const id = parseInt(params.id, 10);

  const { matricula, error } = await loadOwnedMatricula(env, session, id);
  if (error) return error;

  // Excluir também remove o registro de qualquer retirada já feita (some do
  // painel da loja também, já que os dois painéis leem da mesma tabela) e
  // apaga a foto/assinatura salvas no R2, se existirem.
  if (matricula.retirada_foto_key) {
    await env.MEDIA.delete(matricula.retirada_foto_key);
  }
  if (matricula.retirada_assinatura_key) {
    await env.MEDIA.delete(matricula.retirada_assinatura_key);
  }

  await env.DB.prepare("DELETE FROM matriculas WHERE id = ?").bind(id).run();

  return jsonResponse({ ok: true });
}
