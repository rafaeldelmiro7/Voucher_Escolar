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

// ---------- Foto: Arquivo ou Câmera ----------
let cameraStream = null;
let capturedPhotoBlob = null;

const fotoInput = document.getElementById("foto_input");
const fotoPreview = document.getElementById("foto_preview");
const cameraVideo = document.getElementById("camera-video");
const cameraCanvas = document.getElementById("camera-canvas");
const arquivoPanel = document.getElementById("foto-arquivo-panel");
const cameraPanel = document.getElementById("foto-camera-panel");
const tabArquivo = document.getElementById("foto-tab-arquivo");
const tabCamera = document.getElementById("foto-tab-camera");
const cameraCaptureBtn = document.getElementById("camera-capture-btn");
const cameraRetakeBtn = document.getElementById("camera-retake-btn");
const cameraAlert = document.getElementById("camera-alert");

function stopCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  cameraVideo.srcObject = null;
}

async function startCameraStream() {
  cameraAlert.innerHTML = "";
  cameraVideo.style.display = "block";
  cameraCaptureBtn.style.display = "inline-flex";
  cameraRetakeBtn.style.display = "none";
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
  } catch {
    cameraAlert.innerHTML =
      '<div class="alert alert-error">Não foi possível acessar a câmera. Verifique a permissão do navegador ou use a opção "Arquivo".</div>';
    cameraVideo.style.display = "none";
    cameraCaptureBtn.style.display = "none";
  }
}

function resetFotoSelection() {
  capturedPhotoBlob = null;
  fotoInput.value = "";
  fotoPreview.style.display = "none";
  fotoPreview.src = "";
  stopCameraStream();
  cameraAlert.innerHTML = "";
  cameraVideo.style.display = "block";
  cameraCanvas.style.display = "none";
  cameraCaptureBtn.style.display = "inline-flex";
  cameraRetakeBtn.style.display = "none";
}

function switchFotoSource(source) {
  resetFotoSelection();
  const isArquivo = source === "arquivo";
  tabArquivo.classList.toggle("active", isArquivo);
  tabArquivo.setAttribute("aria-selected", String(isArquivo));
  tabCamera.classList.toggle("active", !isArquivo);
  tabCamera.setAttribute("aria-selected", String(!isArquivo));
  arquivoPanel.style.display = isArquivo ? "block" : "none";
  cameraPanel.style.display = isArquivo ? "none" : "block";
  if (!isArquivo) startCameraStream();
}

function getFotoFile() {
  if (capturedPhotoBlob) {
    return new File([capturedPhotoBlob], "foto-camera.jpg", { type: "image/jpeg" });
  }
  return fotoInput.files[0] || null;
}

tabArquivo.addEventListener("click", () => switchFotoSource("arquivo"));
tabCamera.addEventListener("click", () => switchFotoSource("camera"));

cameraCaptureBtn.addEventListener("click", () => {
  if (!cameraStream) return;
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  cameraCanvas.getContext("2d").drawImage(cameraVideo, 0, 0);
  cameraCanvas.toBlob(
    (blob) => {
      capturedPhotoBlob = blob;
      fotoPreview.src = URL.createObjectURL(blob);
      fotoPreview.style.display = "block";
    },
    "image/jpeg",
    0.9
  );
  stopCameraStream();
  cameraVideo.style.display = "none";
  cameraCaptureBtn.style.display = "none";
  cameraRetakeBtn.style.display = "inline-flex";
});

cameraRetakeBtn.addEventListener("click", () => {
  capturedPhotoBlob = null;
  fotoPreview.style.display = "none";
  startCameraStream();
});

fotoInput.addEventListener("change", (ev) => {
  const file = ev.target.files[0];
  if (!file) {
    fotoPreview.style.display = "none";
    return;
  }
  capturedPhotoBlob = null;
  fotoPreview.src = URL.createObjectURL(file);
  fotoPreview.style.display = "block";
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
    detailRow("Série", m.serie_aluno || "-"),
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
    switchFotoSource("arquivo");
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
  stopCameraStream();
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
  const fotoFile = getFotoFile();
  if (!fotoFile) {
    alertBox.innerHTML = '<div class="alert alert-error">Anexe a foto de quem está retirando (arquivo ou câmera).</div>';
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

const RELATORIO_TITULOS = {
  retirado: { titulo: "Relatório de Materiais Retirados", vazio: "Nenhum material retirado encontrado.", contagem: "retirada(s)" },
  aguardando_retirada: { titulo: "Relatório de Aguardando Retirada", vazio: "Nenhuma matrícula aguardando retirada.", contagem: "matrícula(s)" },
  "": { titulo: "Relatório de Matrículas com Voucher", vazio: "Nenhuma matrícula encontrada.", contagem: "matrícula(s)" },
};

function buildRelatorioHtml(matriculas, unidadeNome, statusFiltro) {
  const agora = new Date().toLocaleString("pt-BR");
  const { titulo, vazio, contagem } = RELATORIO_TITULOS[statusFiltro] || RELATORIO_TITULOS[""];
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
          <td>${m.status === "retirado" ? m.retirada_nome || "-" : "-"}</td>
          <td>${m.status === "retirado" ? m.retirada_parentesco || "-" : "-"}</td>
          <td>${m.status === "retirado" ? formatDateTime(m.retirada_data) : "-"}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${titulo} - ${unidadeNome}</title>
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
  <h1>${titulo}</h1>
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
      ${linhas || `<tr><td colspan="10" style="text-align:center;color:#999">${vazio}</td></tr>`}
    </tbody>
  </table>
  <div class="total">Total: ${matriculas.length} ${contagem}</div>
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
    const statusFiltro = document.getElementById("status-filter").value;

    // Usa o mesmo filtro de status selecionado na tela, em vez de sempre
    // restringir a "retirado" — assim o relatório reflete o que o usuário está vendo.
    const params = buildListaParams();

    const data = await api.get(`/api/matriculas?${params.toString()}`);

    printWindow.document.open();
    printWindow.document.write(buildRelatorioHtml(data.matriculas, unidadeNome, statusFiltro));
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
