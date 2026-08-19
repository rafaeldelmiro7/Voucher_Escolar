export function onlyDigits(str) {
  return (str || "").replace(/\D/g, "");
}

export function isValidCPF(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // todos os dígitos iguais

  const calcDigit = (base) => {
    let sum = 0;
    let weight = base.length + 1;
    for (const ch of base) {
      sum += parseInt(ch, 10) * weight;
      weight--;
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  const d1 = calcDigit(cpf.slice(0, 9));
  const d2 = calcDigit(cpf.slice(0, 9) + d1);
  return cpf === cpf.slice(0, 9) + String(d1) + String(d2);
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || "").trim());
}

export function formatCPF(cpfRaw) {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return cpfRaw;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

export function validateMatriculaFields(body) {
  const values = {
    nome_responsavel: (body.nome_responsavel || "").trim(),
    cpf_responsavel: onlyDigits(body.cpf_responsavel || ""),
    email: (body.email || "").trim(),
    telefone: onlyDigits(body.telefone || ""),
    nome_aluno: (body.nome_aluno || "").trim(),
    ra_aluno: (body.ra_aluno || "").trim(),
    data_matricula: (body.data_matricula || "").trim(),
  };

  const erros = [];
  if (!values.nome_responsavel) erros.push("Nome do responsável é obrigatório.");
  if (!isValidCPF(values.cpf_responsavel)) erros.push("CPF do responsável inválido.");
  if (!isValidEmail(values.email)) erros.push("E-mail inválido.");
  if (values.telefone.length < 10) erros.push("Telefone inválido.");
  if (!values.nome_aluno) erros.push("Nome do aluno é obrigatório.");
  if (!values.ra_aluno) erros.push("RA do aluno é obrigatório.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.data_matricula)) erros.push("Data da matrícula inválida.");

  return { values, erros };
}
