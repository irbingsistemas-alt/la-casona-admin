// Historial: filtros y renderizado
const filtroActor = document.getElementById("filtroActor");
const filtroAccion = document.getElementById("filtroAccion");
const btnExportarHistorial = document.getElementById("btnExportarHistorial");

let historialCompleto = [];

async function cargarHistorial() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("actor, action, object_type, object_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return console.error("audit_logs", error);

  historialCompleto = data || [];
  renderizarHistorial();
}

function renderizarHistorial() {
  const actorFiltro = filtroActor.value.trim().toLowerCase();
  const accionFiltro = filtroAccion.value.trim().toLowerCase();

  const filtrado = historialCompleto.filter((h) => {
    const actor = (h.actor || "").toLowerCase();
    const accion = (h.action || "").toLowerCase();
    return (
      (!actorFiltro || actor.includes(actorFiltro)) &&
      (!accionFiltro || accion.includes(accionFiltro))
    );
  });

  historialEl.innerHTML = "";

  filtrado.forEach((h) => {
    const d = document.createElement("div");
    d.className = "hist-item";
    d.innerHTML = `
      <div><strong>${escapeHtml(h.action)}</strong></div>
      <div class="small">actor: ${escapeHtml(h.actor || "")} · objeto: ${escapeHtml(h.object_type || "")} · id: ${escapeHtml(h.object_id || "")}</div>
      <div class="small">${escapeHtml(JSON.stringify(h.details || {}))}</div>
      <div class="small" style="color:#666">${new Date(h.created_at).toLocaleString()}</div>
    `;
    historialEl.appendChild(d);
  });
}
// Eventos de filtro
filtroActor.addEventListener("input", () => {
  clearTimeout(filtroActor._t);
  filtroActor._t = setTimeout(renderizarHistorial, 300);
});

filtroAccion.addEventListener("input", () => {
  clearTimeout(filtroAccion._t);
  filtroAccion._t = setTimeout(renderizarHistorial, 300);
});

// Exportar historial filtrado
btnExportarHistorial.addEventListener("click", () => {
  const actorFiltro = filtroActor.value.trim().toLowerCase();
  const accionFiltro = filtroAccion.value.trim().toLowerCase();

  const filtrado = historialCompleto.filter((h) => {
    const actor = (h.actor || "").toLowerCase();
    const accion = (h.action || "").toLowerCase();
    return (
      (!actorFiltro || actor.includes(actorFiltro)) &&
      (!accionFiltro || accion.includes(accionFiltro))
    );
  });

  const texto = filtrado.map((h) => {
    return `Acción: ${h.action}
Actor: ${h.actor}
Objeto: ${h.object_type} · ID: ${h.object_id}
Detalles: ${JSON.stringify(h.details)}
Fecha: ${new Date(h.created_at).toLocaleString()}
-----------------------------`;
  }).join("\n\n");

  const blob = new Blob([texto], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "historial_filtrado.txt";
  a.click();
  URL.revokeObjectURL(url);
});
