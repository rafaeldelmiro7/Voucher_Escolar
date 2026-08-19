async function apiRequest(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Erro ${res.status}`;
    throw new Error(message);
  }

  return data;
}

const api = {
  get: (path) => apiRequest(path),
  post: (path, body) =>
    apiRequest(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    }),
  patch: (path, body) =>
    apiRequest(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body || {}),
    }),
  delete: (path) => apiRequest(path, { method: "DELETE" }),
};

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

function formatCPFDisplay(cpf) {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
