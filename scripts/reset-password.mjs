// Gera uma senha nova aleatória para um usuário existente e atualiza o hash no D1.
// A senha antiga deixa de funcionar imediatamente.
// Uso:
//   node scripts/reset-password.mjs <email> --local   (banco local do wrangler)
//   node scripts/reset-password.mjs <email> --remote  (banco real na Cloudflare)

import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword } from "../functions/_lib/auth.js";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const mode = args.includes("--remote") ? "--remote" : "--local";

if (!email || email.startsWith("--")) {
  console.error("Uso: node scripts/reset-password.mjs <email> [--local|--remote]");
  process.exit(1);
}

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // sem caracteres ambíguos

function randomPassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

console.log(`Verificando se ${email} existe (${mode.replace("--", "")})...`);
const existingRaw = execSync(
  `npx wrangler d1 execute voucher-matricula-db ${mode} --command "SELECT email FROM usuarios WHERE email = '${email.replace(/'/g, "''")}'" --json`,
  { encoding: "utf-8" }
);
const rows = JSON.parse(existingRaw)[0]?.results || [];
if (!rows.length) {
  console.error(`Nenhum usuário encontrado com o e-mail ${email}.`);
  process.exit(1);
}

const senha = randomPassword();
const hash = await hashPassword(senha);

const tmpDir = mkdtempSync(join(tmpdir(), "voucher-reset-"));
const sqlPath = join(tmpDir, "reset.sql");
writeFileSync(
  sqlPath,
  `UPDATE usuarios SET password_hash = '${hash}' WHERE email = '${email.replace(/'/g, "''")}';`,
  "utf-8"
);

console.log(`Aplicando reset de senha (${mode.replace("--", "")})...`);
execSync(`npx wrangler d1 execute voucher-matricula-db ${mode} --file "${sqlPath}"`, { stdio: "inherit" });

console.log(`\n=== Senha redefinida ===\ne-mail: ${email}\nsenha:  ${senha}\n\nGuarde em local seguro e repasse ao usuário por um canal confiável.`);
