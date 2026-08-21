// Garante que os usuários iniciais existam no D1 (4 escolas + loja + admins).
// Usuários que já existem NÃO têm a senha alterada — só role/unidade/nome/is_admin
// são atualizados. Só usuários novos ganham uma senha aleatória.
// Uso:
//   node scripts/seed-users.mjs --local   (banco local do wrangler)
//   node scripts/seed-users.mjs --remote  (banco real na Cloudflare)

import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword } from "../functions/_lib/auth.js";

const mode = process.argv.includes("--remote") ? "--remote" : "--local";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sem caracteres ambíguos

function randomPassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

const usuarios = [
  { email: "alessandra.rmartins@adventistas.org", role: "escola", unidadeSigla: "CAJI", nome: "CAJI - Colégio Adventista de Ji-Paraná" },
  { email: "queiteane.cintia@adventistas.org", role: "escola", unidadeSigla: "EAOP", nome: "EAOP - Escola Adventista de Ouro Preto do Oeste" },
  { email: "cassia.caroline@adventistas.org", role: "escola", unidadeSigla: "EAJI", nome: "EAJI - Escola Adventista de Ji-Paraná" },
  { email: "dara.rodrigues@adventistas.org", role: "escola", unidadeSigla: "EAV", nome: "EAV - Escola Adventista de Vilhena" },
  { email: "wesley.ffrigeri@adventistas.org", role: "loja", unidadeSigla: null, nome: "Loja SELS" },
  { email: "didaticos.asur@adventistas.org", role: "loja", unidadeSigla: null, nome: "Didáticos ASuR" },
  { email: "rafael.delmiro@adventistas.org", role: "loja", unidadeSigla: null, nome: "Rafael Delmiro", isAdmin: true },
  { email: "micelio.reis@adventistas.org", role: "loja", unidadeSigla: null, nome: "Micélio Reis", isAdmin: true },
];

console.log("Consultando usuários já existentes...");
let existingEmails = new Set();
try {
  const existingRaw = execSync(
    `npx wrangler d1 execute voucher-matricula-db ${mode} --command "SELECT email FROM usuarios" --json`,
    { encoding: "utf-8" }
  );
  const parsed = JSON.parse(existingRaw);
  const rows = parsed[0]?.results || [];
  existingEmails = new Set(rows.map((r) => r.email));
} catch {
  // Tabela pode ainda não existir/estar vazia — segue com o conjunto vazio.
}

const credenciaisNovas = [];
const jaExistiam = [];
const statements = [];

for (const u of usuarios) {
  const unidadeExpr = u.unidadeSigla ? `(SELECT id FROM unidades WHERE sigla = '${u.unidadeSigla}')` : "NULL";
  const isAdminExpr = u.isAdmin ? 1 : 0;
  const nomeEscaped = u.nome.replace(/'/g, "''");

  if (existingEmails.has(u.email)) {
    // Já existe: atualiza só papel/unidade/nome/admin, preservando a senha atual.
    statements.push(
      `UPDATE usuarios SET role = '${u.role}', unidade_id = ${unidadeExpr}, nome_exibicao = '${nomeEscaped}', is_admin = ${isAdminExpr} WHERE email = '${u.email}';`
    );
    jaExistiam.push(u);
  } else {
    const senha = randomPassword();
    const hash = await hashPassword(senha);
    credenciaisNovas.push({ ...u, senha });
    statements.push(
      `INSERT INTO usuarios (email, password_hash, role, unidade_id, nome_exibicao, is_admin) VALUES ('${u.email}', '${hash}', '${u.role}', ${unidadeExpr}, '${nomeEscaped}', ${isAdminExpr});`
    );
  }
}

const tmpDir = mkdtempSync(join(tmpdir(), "voucher-seed-"));
const sqlPath = join(tmpDir, "seed.sql");
writeFileSync(sqlPath, statements.join("\n"), "utf-8");

console.log(`Aplicando seed de usuários (${mode.replace("--", "")})...`);
execSync(`npx wrangler d1 execute voucher-matricula-db ${mode} --file "${sqlPath}"`, {
  stdio: "inherit",
});

const linhas = ["=== Resultado do seed (guarde credenciais novas em local seguro) ==="];

if (credenciaisNovas.length) {
  linhas.push(
    "",
    "Usuários novos (senha gerada agora):",
    ...credenciaisNovas.map(
      (c) =>
        `${c.isAdmin ? "Admin (acesso geral)" : c.role === "loja" ? "Loja" : "Escola"} ${c.nome}\n  e-mail: ${c.email}\n  senha:  ${c.senha}\n`
    )
  );
}

if (jaExistiam.length) {
  linhas.push(
    "Usuários que já existiam (senha NÃO foi alterada):",
    ...jaExistiam.map((u) => `  - ${u.nome} <${u.email}>`),
    ""
  );
}

writeFileSync("credenciais-geradas.txt", linhas.join("\n"), "utf-8");
console.log("\n" + linhas.join("\n"));
console.log("Resultado também salvo em credenciais-geradas.txt (não versionado no git).");
