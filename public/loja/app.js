let currentUser = null;
let matriculasAtuais = [];
let matriculaSelecionada = null;
let searchTimer = null;
let isAdmin = false;

const modalBackdrop = document.getElementById("modal-backdrop");
const canvas = document.getElementById("sig-canvas");
const ctx = canvas.getContext("2d");
let drawing = false;
let hasSignature = false;

function setupCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.scale(ratio, ratio);
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0f172a";
}

function clearSignature() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
}

function pointerPos(ev) {
  const rect = canvas.getBoundingClientRect();
  return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
}

canvas.addEventListener("pointerdown", (ev) => {
  drawing = true;
  hasSignature = true;
  const p = pointerPos(ev);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  canvas.setPointerCapture(ev.pointerId);
});

canvas.addEventListener("pointermove", (ev) => {
  if (!drawing) return;
  const p = pointerPos(ev);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
});

["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
  canvas.addEventListener(evt, () => {
    drawing = false;
  });
});

document.getElementById("sig-clear").addEventListener("click", clearSignature);

document.getElementById("foto_input").addEventListener("change", (ev) => {
  const file = ev.target.files[0];
  const preview = document.getElementById("foto_preview");
  if (!file) {
    preview.style.display = "none";
    return;
  }
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
});

function statusBadge(m) {
  if (m.status === "retirado") return '<span class="badge badge-done">Retirado</span>';
  if (!m.voucher_elegivel) return '<span class="badge badge-none">Sem voucher</span>';
  return '<span class="badge badge-pending">Aguardando retirada</span>';
}

function renderLista(matriculas) {
  matriculasAtuais = matriculas;
  const wrap = document.getElementById("lista-wrap");
  document.getElementById("total-label").textContent = `${matriculas.length} registro(s)`;

  if (!matriculas.length) {
    wrap.innerHTML = '<div class="empty-state">Nenhuma matrícula encontrada.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Voucher</th>
          <th>Aluno</th>
          <th>Responsável</th>
          <th>CPF</th>
          <th>Unidade</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${matriculas
          .map(
            (m) => `
          <tr>
            <td>${m.voucher_elegivel ? "#" + m.voucher_numero : "-"}</td>
            <td>${m.nome_aluno}</td>
            <td>${m.nome_responsavel}</td>
            <td>${formatCPFDisplay(m.cpf_responsavel)}</td>
            <td>${m.unidade_sigla || "-"}</td>
            <td>${statusBadge(m)}</td>
            <td><button class="btn btn-sm btn-outline" data-id="${m.id}">${m.status === "retirado" ? "Ver comprovante" : "Registrar retirada"}</button></td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => openModal(parseInt(btn.dataset.id, 10)));
  });
}

function buildListaParams() {
  const q = document.getElementById("search-input").value.trim();
  const status = document.getElementById("status-filter").value;
  const unidade = document.getElementById("unidade-filter").value;
  const params = new URLSearchParams();
  params.set("context", "loja");
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (unidade) params.set("unidade", unidade);
  return params;
}

async function loadLista() {
  const wrap = document.getElementById("lista-wrap");
  wrap.innerHTML = '<p class="loading">Carregando...</p>';
  try {
    const data = await api.get(`/api/matriculas?${buildListaParams().toString()}`);
    renderLista(data.matriculas);
  } catch (e) {
    wrap.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function detailRow(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function openModal(id) {
  const m = matriculasAtuais.find((x) => x.id === id);
  if (!m) return;
  matriculaSelecionada = m;

  document.getElementById("modal-detail").innerHTML = [
    detailRow("Aluno", m.nome_aluno),
    detailRow("RA", m.ra_aluno),
    detailRow("Responsável", m.nome_responsavel),
    detailRow("CPF", formatCPFDisplay(m.cpf_responsavel)),
    detailRow("Telefone", m.telefone),
    detailRow("Unidade", m.unidade_nome || "-"),
    detailRow("Data da matrícula", formatDate(m.data_matricula)),
    detailRow("Voucher", m.voucher_elegivel ? "#" + m.voucher_numero : "Sem voucher"),
  ].join("");

  document.getElementById("modal-alert").innerHTML = "";
  const form = document.getElementById("retirada-form");

  if (m.status === "retirado") {
    form.style.display = "none";
    document.getElementById("modal-detail").innerHTML +=
      detailRow("Retirado por", m.retirada_nome) +
      detailRow("Grau de parentesco", m.retirada_parentesco || "-") +
      detailRow("Data da retirada", formatDateTime(m.retirada_data)) +
      `<div style="grid-column:1/-1">
        <dt>Comprovantes</dt>
        <dd style="display:flex;gap:14px;margin-top:8px;flex-wrap:wrap">
          <img src="/api/media/${m.retirada_foto_key}" class="photo-preview" style="max-width:180px" />
          <img src="/api/media/${m.retirada_assinatura_key}" class="photo-preview" style="max-width:220px;background:#fff" />
        </dd>
      </div>`;
  } else {
    form.style.display = "block";
    form.reset();
    document.getElementById("foto_preview").style.display = "none";
    modalBackdrop.style.display = "flex";
    setTimeout(() => {
      setupCanvas();
      clearSignature();
    }, 0);
  }

  modalBackdrop.style.display = "flex";
}

function closeModal() {
  modalBackdrop.style.display = "none";
  matriculaSelecionada = null;
}

document.getElementById("modal-close").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (ev) => {
  if (ev.target === modalBackdrop) closeModal();
});

document.getElementById("retirada-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const alertBox = document.getElementById("modal-alert");
  const btn = document.getElementById("confirmar-btn");
  alertBox.innerHTML = "";

  const parentesco = document.getElementById("parentesco").value;
  if (!parentesco) {
    alertBox.innerHTML = '<div class="alert alert-error">Selecione o grau de parentesco de quem está retirando.</div>';
    return;
  }
  if (!hasSignature) {
    alertBox.innerHTML = '<div class="alert alert-error">Colete a assinatura de quem está retirando.</div>';
    return;
  }
  const fotoFile = document.getElementById("foto_input").files[0];
  if (!fotoFile) {
    alertBox.innerHTML = '<div class="alert alert-error">Anexe a foto de quem está retirando.</div>';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    const signatureBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));

    const formData = new FormData();
    formData.append("retirada_nome", document.getElementById("retirada_nome").value.trim());
    formData.append("parentesco", parentesco);
    formData.append("foto", fotoFile);
    formData.append("assinatura", signatureBlob, "assinatura.png");

    await api.post(`/api/matriculas/${matriculaSelecionada.id}/retirada`, formData);
    closeModal();
    loadLista();
  } catch (e) {
    alertBox.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar retirada";
  }
});

document.getElementById("search-input").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadLista, 350);
});
document.getElementById("status-filter").addEventListener("change", loadLista);
document.getElementById("unidade-filter").addEventListener("change", loadLista);

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api.post("/api/auth/logout");
  window.location.href = "/";
});

function buildRelatorioHtml(matriculas, unidadeNome) {
  const agora = new Date().toLocaleString("pt-BR");
  const linhas = matriculas
    .map(
      (m, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${m.nome_aluno}</td>
          <td>${m.ra_aluno}</td>
          <td>${m.nome_responsavel}</td>
          <td>${formatCPFDisplay(m.cpf_responsavel)}</td>
          <td>${m.unidade_sigla || "-"}</td>
          <td>${m.voucher_numero ? "#" + m.voucher_numero : "-"}</td>
          <td>${m.retirada_nome || "-"}</td>
          <td>${m.retirada_parentesco || "-"}</td>
          <td>${formatDateTime(m.retirada_data)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>Relatório de Retiradas - ${unidadeNome}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0b376d; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #eef5ff; }
  .total { margin-top: 16px; font-size: 13px; font-weight: bold; }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>Relatório de Materiais Retirados</h1>
  <div class="meta">
    Rede Adventista de Educação (ASuR) &middot; Unidade: <strong>${unidadeNome}</strong> &middot; Gerado em ${agora}
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Aluno</th><th>RA</th><th>Responsável</th><th>CPF</th>
        <th>Unidade</th><th>Voucher</th><th>Retirado por</th><th>Parentesco</th><th>Data da retirada</th>
      </tr>
    </thead>
    <tbody>
      ${linhas || '<tr><td colspan="10" style="text-align:center;color:#999">Nenhum material retirado encontrado.</td></tr>'}
    </tbody>
  </table>
  <div class="total">Total: ${matriculas.length} retirada(s)</div>
</body>
</html>`;
}

document.getElementById("print-btn").addEventListener("click", async () => {
  // Abre a janela já na hora do clique (evita bloqueio de pop-up dos navegadores,
  // que costuma barrar window.open() chamado depois de um await).
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o navegador está bloqueando pop-ups.");
    return;
  }
  printWindow.document.write("<p style='font-family:sans-serif;padding:24px'>Gerando relatório...</p>");

  const btn = document.getElementById("print-btn");
  btn.disabled = true;
  try {
    const unidadeSelect = document.getElementById("unidade-filter");
    const unidadeId = unidadeSelect.value;
    const unidadeNome = unidadeId ? unidadeSelect.options[unidadeSelect.selectedIndex].textContent : "Todas as unidades";

    const params = new URLSearchParams();
    params.set("context", "loja");
    params.set("status", "retirado");
    if (unidadeId) params.set("unidade", unidadeId);

    const data = await api.get(`/api/matriculas?${params.toString()}`);

    printWindow.document.open();
    printWindow.document.write(buildRelatorioHtml(data.matriculas, unidadeNome));
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  } catch (e) {
    printWindow.document.open();
    printWindow.document.write(`<p style="font-family:sans-serif;padding:24px;color:#dc2626">Erro ao gerar relatório: ${e.message}</p>`);
    printWindow.document.close();
  } finally {
    btn.disabled = false;
  }
});

async function init() {
  try {
    currentUser = await api.get("/api/auth/me");
  } catch {
    window.location.href = "/";
    return;
  }

  if (!currentUser.authenticated || (currentUser.role !== "loja" && currentUser.role !== "admin")) {
    window.location.href = currentUser.role === "escola" ? "/escola/" : "/loja/";
    return;
  }

  isAdmin = currentUser.role === "admin";

  document.getElementById("who-nome").textContent = currentUser.nome;

  if (isAdmin) {
    document.getElementById("who-role-label").textContent = "Acesso geral";
    const adminNav = document.getElementById("admin-nav");
    adminNav.style.display = "flex";
    adminNav.querySelector('[data-nav="loja"]').classList.add("active");
  }

  try {
    const { unidades } = await api.get("/api/unidades");
    const unidadeSelect = document.getElementById("unidade-filter");
    unidades.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.id;
      opt.textContent = u.nome;
      unidadeSelect.appendChild(opt);
    });
  } catch {
    // segue sem opções extras — o filtro simplesmente fica só com "Todas as unidades"
  }

  loadLista();
}

init();
