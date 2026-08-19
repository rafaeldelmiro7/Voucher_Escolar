let currentUser = null;
let matriculasAtuais = [];
let editingId = null;
let isAdmin = false;

const modalBackdrop = document.getElementById("modal-backdrop");

function statusBadge(m) {
  if (!m.voucher_elegivel) return '<span class="badge badge-none">Sem voucher</span>';
  if (m.status === "retirado") return '<span class="badge badge-done">Retirado</span>';
  return `<span class="badge badge-pending">Voucher nº ${m.voucher_numero}</span>`;
}

function actionButtons(m) {
  const editLocked = m.status === "retirado";
  const editLockedAttr = editLocked ? "disabled" : "";
  const editTitle = editLocked ? "Não é possível editar após a retirada" : "Editar";
  return `
    <div class="row-actions">
      <button type="button" class="icon-btn icon-btn-view" data-action="view" data-id="${m.id}" title="Ver detalhes" aria-label="Ver detalhes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button type="button" class="icon-btn icon-btn-edit" data-action="edit" data-id="${m.id}" title="${editTitle}" aria-label="Editar" ${editLockedAttr}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>
      </button>
      <button type="button" class="icon-btn icon-btn-delete" data-action="delete" data-id="${m.id}" title="Excluir" aria-label="Excluir">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M18 7l-.8 12.1A2 2 0 0 1 15.2 21H8.8a2 2 0 0 1-2-1.9L6 7"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  `;
}

function renderLista(matriculas) {
  matriculasAtuais = matriculas;
  const wrap = document.getElementById("lista-wrap");
  document.getElementById("total-label").textContent = `${matriculas.length} cadastro(s)`;

  if (!matriculas.length) {
    wrap.innerHTML = '<div class="empty-state">Nenhuma matrícula cadastrada ainda.</div>';
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Aluno</th>
          <th>RA</th>
          <th>Responsável</th>
          <th>CPF</th>
          ${isAdmin ? "<th>Unidade</th>" : ""}
          <th>Data matrícula</th>
          <th>Cadastrado em</th>
          <th>Voucher</th>
          <th>Valor</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${matriculas
          .map(
            (m) => `
          <tr>
            <td>${m.nome_aluno}</td>
            <td>${m.ra_aluno}</td>
            <td>${m.nome_responsavel}</td>
            <td>${formatCPFDisplay(m.cpf_responsavel)}</td>
            ${isAdmin ? `<td>${m.unidade_sigla || "-"}</td>` : ""}
            <td>${formatDate(m.data_matricula)}</td>
            <td>${formatDateTime(m.criado_em)}</td>
            <td>${statusBadge(m)}</td>
            <td>${formatVoucherValor(m.voucher_valor)}</td>
            <td>${actionButtons(m)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  wrap.querySelectorAll("button[data-action]").forEach((btn) => {
    const id = parseInt(btn.dataset.id, 10);
    const action = btn.dataset.action;
    btn.addEventListener("click", () => {
      if (action === "view") openViewModal(id);
      else if (action === "edit") openEditModal(id);
      else if (action === "delete") handleDelete(id);
    });
  });
}

async function loadLista() {
  try {
    const data = await api.get("/api/matriculas");
    renderLista(data.matriculas);
  } catch (e) {
    document.getElementById("lista-wrap").innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function detailRow(label, value) {
  return `<div><dt>${label}</dt><dd>${value}</dd></div>`;
}

function closeModal() {
  modalBackdrop.style.display = "none";
  editingId = null;
  document.getElementById("modal-alert").innerHTML = "";
}

function openViewModal(id) {
  const m = matriculasAtuais.find((x) => x.id === id);
  if (!m) return;

  document.getElementById("modal-title-text").textContent = "Detalhes da matrícula";
  document.getElementById("edit-form").style.display = "none";

  let html = [
    detailRow("Aluno", m.nome_aluno),
    detailRow("RA", m.ra_aluno),
    detailRow("Responsável", m.nome_responsavel),
    detailRow("CPF", formatCPFDisplay(m.cpf_responsavel)),
    detailRow("E-mail", m.email),
    detailRow("Telefone", m.telefone),
    ...(isAdmin ? [detailRow("Unidade", m.unidade_nome || "-")] : []),
    detailRow("Data da matrícula", formatDate(m.data_matricula)),
    detailRow("Voucher", m.voucher_elegivel ? "#" + m.voucher_numero : "Sem voucher"),
    detailRow("Valor do voucher", formatVoucherValor(m.voucher_valor)),
    detailRow("Status", m.status === "retirado" ? "Retirado" : "Aguardando retirada"),
  ].join("");

  if (m.status === "retirado") {
    html +=
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
  }

  document.getElementById("modal-detail").style.display = "grid";
  document.getElementById("modal-detail").innerHTML = html;
  modalBackdrop.style.display = "flex";
}

function openEditModal(id) {
  const m = matriculasAtuais.find((x) => x.id === id);
  if (!m || m.status === "retirado") return;

  editingId = id;
  document.getElementById("modal-title-text").textContent = "Editar matrícula";
  document.getElementById("modal-detail").style.display = "none";
  document.getElementById("modal-detail").innerHTML = "";

  document.getElementById("edit_nome_responsavel").value = m.nome_responsavel;
  document.getElementById("edit_cpf_responsavel").value = maskCPF(m.cpf_responsavel);
  document.getElementById("edit_email").value = m.email;
  document.getElementById("edit_telefone").value = maskPhone(m.telefone);
  document.getElementById("edit_nome_aluno").value = m.nome_aluno;
  document.getElementById("edit_ra_aluno").value = m.ra_aluno;
  document.getElementById("edit_data_matricula").value = m.data_matricula;
  document.getElementById("edit_voucher_valor_display").value = formatVoucherValor(calcularVoucherValor(m.data_matricula));

  document.getElementById("edit-form").style.display = "block";
  modalBackdrop.style.display = "flex";
}

async function handleDelete(id) {
  const m = matriculasAtuais.find((x) => x.id === id);
  if (!m) return;

  const aviso =
    m.status === "retirado"
      ? `Excluir a matrícula de ${m.nome_aluno}? O material já foi retirado — isso também vai apagar o comprovante (foto e assinatura) e remover o registro do painel da loja. Esta ação não pode ser desfeita.`
      : `Excluir a matrícula de ${m.nome_aluno}? Esta ação não pode ser desfeita.`;
  if (!confirm(aviso)) return;

  try {
    await api.delete(`/api/matriculas/${id}`);
    loadLista();
  } catch (e) {
    alert(e.message);
  }
}

document.getElementById("modal-close").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (ev) => {
  if (ev.target === modalBackdrop) closeModal();
});

document.getElementById("edit-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!editingId) return;
  const alertBox = document.getElementById("modal-alert");
  const btn = document.getElementById("edit-submit-btn");
  alertBox.innerHTML = "";
  btn.disabled = true;

  const payload = {
    nome_responsavel: document.getElementById("edit_nome_responsavel").value.trim(),
    cpf_responsavel: document.getElementById("edit_cpf_responsavel").value,
    email: document.getElementById("edit_email").value.trim(),
    telefone: document.getElementById("edit_telefone").value,
    nome_aluno: document.getElementById("edit_nome_aluno").value.trim(),
    ra_aluno: document.getElementById("edit_ra_aluno").value.trim(),
    data_matricula: document.getElementById("edit_data_matricula").value,
  };

  try {
    await api.patch(`/api/matriculas/${editingId}`, payload);
    closeModal();
    loadLista();
  } catch (e) {
    alertBox.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
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

  if (!currentUser.authenticated || (currentUser.role !== "escola" && currentUser.role !== "admin")) {
    window.location.href = currentUser.role === "escola" ? "/escola/" : "/loja/";
    return;
  }

  isAdmin = currentUser.role === "admin";

  document.getElementById("who-nome").textContent = currentUser.nome;

  if (isAdmin) {
    document.getElementById("who-unidade").textContent = "Acesso geral";
    document.getElementById("lista-title").textContent = "Matrículas cadastradas";

    const adminNav = document.getElementById("admin-nav");
    adminNav.style.display = "flex";
    adminNav.querySelector('[data-nav="escola"]').classList.add("active");

    document.getElementById("unidade_display").style.display = "none";
    const unidadeSelect = document.getElementById("unidade_select");
    unidadeSelect.style.display = "block";
    unidadeSelect.disabled = false;
    unidadeSelect.required = true;

    try {
      const { unidades } = await api.get("/api/unidades");
      unidades.forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.id;
        opt.textContent = u.nome;
        unidadeSelect.appendChild(opt);
      });
    } catch {
      // segue sem opções — o cadastro vai falhar com erro claro do servidor
    }
  } else {
    document.getElementById("who-unidade").textContent = currentUser.unidade ? currentUser.unidade.sigla : "-";
    document.getElementById("unidade_display").value = currentUser.unidade ? currentUser.unidade.nome : "-";
  }

  document.getElementById("data_matricula").valueAsDate = new Date();
  atualizarValorVoucherDisplay();

  attachMask(document.getElementById("cpf_responsavel"), maskCPF);
  attachMask(document.getElementById("telefone"), maskPhone);
  attachMask(document.getElementById("edit_cpf_responsavel"), maskCPF);
  attachMask(document.getElementById("edit_telefone"), maskPhone);

  loadLista();
}

function atualizarValorVoucherDisplay() {
  const data = document.getElementById("data_matricula").value;
  document.getElementById("voucher_valor_display").value = formatVoucherValor(calcularVoucherValor(data));
}

document.getElementById("data_matricula").addEventListener("change", atualizarValorVoucherDisplay);

document.getElementById("edit_data_matricula").addEventListener("change", () => {
  const data = document.getElementById("edit_data_matricula").value;
  document.getElementById("edit_voucher_valor_display").value = formatVoucherValor(calcularVoucherValor(data));
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api.post("/api/auth/logout");
  window.location.href = "/";
});

document.getElementById("matricula-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const alertBox = document.getElementById("form-alert");
  const submitBtn = document.getElementById("submit-btn");
  alertBox.innerHTML = "";
  submitBtn.disabled = true;
  submitBtn.textContent = "Cadastrando...";

  const payload = {
    nome_responsavel: document.getElementById("nome_responsavel").value.trim(),
    cpf_responsavel: document.getElementById("cpf_responsavel").value,
    email: document.getElementById("email").value.trim(),
    telefone: document.getElementById("telefone").value,
    nome_aluno: document.getElementById("nome_aluno").value.trim(),
    ra_aluno: document.getElementById("ra_aluno").value.trim(),
    data_matricula: document.getElementById("data_matricula").value,
  };

  if (isAdmin) {
    payload.unidade_id = document.getElementById("unidade_select").value;
  }

  try {
    const data = await api.post("/api/matriculas", payload);
    const msg = data.matricula.voucher_elegivel
      ? `Matrícula cadastrada! Voucher nº ${data.matricula.voucher_numero} gerado.`
      : "Matrícula cadastrada. Esta matrícula ficou fora do limite de vouchers disponíveis.";
    alertBox.innerHTML = `<div class="alert alert-success">${msg}</div>`;
    ev.target.reset();
    document.getElementById("data_matricula").valueAsDate = new Date();
    atualizarValorVoucherDisplay();
    if (isAdmin) document.getElementById("unidade_select").selectedIndex = 0;
    loadLista();
  } catch (e) {
    alertBox.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Cadastrar matrícula";
  }
});

init();
