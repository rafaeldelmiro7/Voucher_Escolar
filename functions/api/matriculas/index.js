import { readSession, jsonResponse } from "../../_lib/auth.js";
import { validateMatriculaFields } from "../../_lib/validate.js";
import { calcularVoucherValor } from "../../_lib/voucherValor.js";

export const SELECT_FIELDS = `
  m.id, m.nome_responsavel, m.cpf_responsavel, m.email, m.telefone,
  m.nome_aluno, m.ra_aluno, m.serie_aluno, m.data_matricula, m.unidade_id, m.criado_em,
  m.voucher_numero, m.voucher_elegivel, m.voucher_valor, m.aluno_novo, m.status,
  m.retirada_nome, m.retirada_data, m.retirada_foto_key, m.retirada_assinatura_key,
  m.retirada_parentesco,
  un.sigla AS unidade_sigla, un.nome AS unidade_nome
`;

export async function onRequestGet({ request, env }) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) return jsonResponse({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const statusFilter = url.searchParams.get("status") || "";
  const context = url.searchParams.get("context") || "";
  const unidadeFilter = parseInt(url.searchParams.get("unidade"), 10) || null;

  let query = `SELECT ${SELECT_FIELDS} FROM matriculas m LEFT JOIN unidades un ON un.id = m.unidade_id WHERE 1=1`;
  const params = [];

  if (session.role === "escola") {
    query += " AND m.unidade_id = ?";
    params.push(session.unidadeId);
  } else if (session.role === "loja" || (session.role === "admin" && context === "loja")) {
    // A loja só lida com retiradas de quem realmente tem voucher.
    query += " AND m.voucher_elegivel = 1";
  } else if (session.role !== "admin") {
    return jsonResponse({ error: "Acesso negado." }, { status: 403 });
  }
  // admin fora do contexto da loja enxerga todas as matrículas, de qualquer unidade.

  if (unidadeFilter && (session.role === "loja" || session.role === "admin")) {
    query += " AND m.unidade_id = ?";
    params.push(unidadeFilter);
  }

  if (statusFilter === "aguardando_retirada" || statusFilter === "retirado") {
    query += " AND m.status = ?";
    params.push(statusFilter);
  }

  if (q) {
    query += " AND (m.nome_aluno LIKE ? OR m.nome_responsavel LIKE ? OR m.cpf_responsavel LIKE ? OR m.ra_aluno LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  const isLojaView = session.role === "loja" || (session.role === "admin" && context === "loja");
  query += isLojaView && !statusFilter
    ? " ORDER BY m.status ASC, m.criado_em ASC"
    : " ORDER BY m.criado_em DESC";

  const { results } = await env.DB.prepare(query).bind(...params).all();
  return jsonResponse({ matriculas: results });
}

export async function onRequestPost({ request, env }) {
  const session = await readSession(request, env.SESSION_SECRET);
  if (!session || (session.role !== "escola" && session.role !== "admin")) {
    return jsonResponse({ error: "Apenas usuários de escola podem cadastrar matrículas." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Requisição inválida." }, { status: 400 });
  }

  const { values, erros } = validateMatriculaFields(body);
  const { nome_responsavel, cpf_responsavel, email, telefone, nome_aluno, ra_aluno, serie_aluno, data_matricula } = values;

  let unidadeId = session.unidadeId;
  if (session.role === "admin") {
    unidadeId = parseInt(body.unidade_id, 10) || null;
    if (!unidadeId) erros.push("Selecione a unidade escolar.");
  }

  if (erros.length) {
    return jsonResponse({ error: erros.join(" ") }, { status: 400 });
  }

  if (session.role === "admin") {
    const unidadeExiste = await env.DB.prepare("SELECT id FROM unidades WHERE id = ?").bind(unidadeId).first();
    if (!unidadeExiste) {
      return jsonResponse({ error: "Unidade escolar inválida." }, { status: 400 });
    }
  }

  const configRow = await env.DB.prepare("SELECT valor FROM config WHERE chave = 'limite_vouchers'").first();
  const limite = configRow && configRow.valor ? parseInt(configRow.valor, 10) : null;

  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM matriculas WHERE voucher_numero IS NOT NULL"
  ).first();
  const totalAtual = countRow ? countRow.total : 0;

  let voucherNumero = null;
  let voucherElegivel = 0;
  if (!limite || totalAtual < limite) {
    voucherNumero = totalAtual + 1;
    voucherElegivel = 1;
  }

  const voucherValor = calcularVoucherValor(data_matricula);
  const alunoNovo = body.aluno_novo ? 1 : 0;

  const result = await env.DB.prepare(
    `INSERT INTO matriculas
      (nome_responsavel, cpf_responsavel, email, telefone, nome_aluno, ra_aluno, serie_aluno, data_matricula,
       unidade_id, criado_por, voucher_numero, voucher_elegivel, voucher_valor, aluno_novo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      nome_responsavel,
      cpf_responsavel,
      email,
      telefone,
      nome_aluno,
      ra_aluno,
      serie_aluno,
      data_matricula,
      unidadeId,
      session.uid,
      voucherNumero,
      voucherElegivel,
      voucherValor,
      alunoNovo
    )
    .run();

  const novaMatricula = await env.DB.prepare(`SELECT ${SELECT_FIELDS} FROM matriculas m LEFT JOIN unidades un ON un.id = m.unidade_id WHERE m.id = ?`)
    .bind(result.meta.last_row_id)
    .first();

  return jsonResponse({ matricula: novaMatricula }, { status: 201 });
}
