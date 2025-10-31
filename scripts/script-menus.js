import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzIiwi..." // tu anon key real
);

window.supabase = supabase;

document.addEventListener("DOMContentLoaded", () => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");

  if (!usuario || !rol || !["admin", "gerente"].includes(rol)) {
    window.location.href = "../index.html";
    return;
  }

  document.getElementById("rolInfo").textContent = `Rol: ${rol} · Usuario: ${usuario}`;
  document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../index.html";
  });

  document.getElementById("btnNuevo").onclick = () => abrirModalMenu("crear");
  document.getElementById("btnExportar").onclick = exportarCSV;
  document.getElementById("btnImportar").onclick = importarCSV;
  document.getElementById("btnExportarAuditoria").onclick = exportarAuditoria;

  cargarMenus();
  cargarDashboardResumen();
  cargarResumenMenus();
  cargarResumenPorLocal();
  cargarSugerenciasReposicion();
  cargarAuditoria();
  cargarUltimosModificados();
});

async function cargarMenus() {
  const { data, error } = await supabase.from("menus").select("*");
  if (error || !data) return;

  renderizarTabla(data);
  renderizarSinStock(data);
  actualizarFiltros(data);
}
function renderizarTabla(items) {
  const cont = document.getElementById("tabla-menus");
  let html = `<table><thead><tr>
    <th>Nombre</th><th>Precio</th><th>Stock</th><th>Destino</th>
    <th>Área</th><th>Activo</th><th>Acciones</th></tr></thead><tbody>`;

  items.forEach(item => {
    html += `<tr>
      <td>${item.nombre}</td>
      <td>${item.precio} CUP</td>
      <td>${item.stock}</td>
      <td>${item.destino}</td>
      <td>${item.area}</td>
      <td>${item.activo ? "✔" : "✖"}</td>
      <td>
        <button onclick="editarItem('${item.id}')">✏️</button>
        <button onclick="duplicarItem('${item.id}', '${item.destino}')">🔁</button>
        <button onclick="desactivarItem('${item.id}')">🗑️</button>
      </td>
    </tr>`;
  });

  html += "</tbody></table>";
  cont.innerHTML = html;
}

function renderizarSinStock(items) {
  const cont = document.getElementById("panel-sin-stock");
  const sinStock = items.filter(i => i.stock === 0);
  if (sinStock.length === 0) {
    cont.innerHTML = "<p>Todos los ítems tienen stock.</p>";
    return;
  }

  let html = "<ul>";
  sinStock.forEach(i => {
    html += `<li><strong>${i.nombre}</strong> (${i.destino}) — ${i.area}
      <button onclick="reponerStock('${i.id}')">➕ Reponer</button></li>`;
  });
  html += "</ul>";
  cont.innerHTML = html;
}

async function editarItem(id) {
  const { data, error } = await supabase.from("menus").select("*").eq("id", id).single();
  if (error || !data) return alert("Error al cargar ítem");
  abrirModalMenu("editar", data);
}

async function duplicarItem(id, destino) {
  const nuevoDestino = prompt("Destino nuevo:", destino);
  if (!nuevoDestino) return;
  const { error } = await supabase.rpc("duplicar_menu_para_destino", { menu_id: id, nuevo_destino });
  if (error) return alert("Error al duplicar");
  alert("Duplicado correctamente");
  cargarMenus();
}

async function desactivarItem(id) {
  const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: { activo: false } });
  if (error) return alert("Error al desactivar");
  alert("Ítem desactivado");
  cargarMenus();
}

async function reponerStock(id) {
  const nuevoStock = prompt("Nuevo stock:");
  if (!nuevoStock) return;
  const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: { stock: parseInt(nuevoStock) } });
  if (error) return alert("Error al reponer");
  alert("Stock actualizado");
  cargarMenus();
}
function abrirModalMenu(modo, datos = {}) {
  const root = document.getElementById("modal-menu-root");
  const esEdicion = modo === "editar";
  const titulo = esEdicion ? "✏️ Editar ítem" : "➕ Crear nuevo ítem";

  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <h4>${titulo}</h4>
    <form id="form-menu">
      <input name="nombre" placeholder="Nombre" value="${datos.nombre || ""}" required />
      <input name="precio" type="number" placeholder="Precio" value="${datos.precio || ""}" required />
      <input name="stock" type="number" placeholder="Stock" value="${datos.stock || 0}" required />
      <input name="categoria_id" placeholder="Categoría ID" value="${datos.categoria_id || ""}" />
      <select name="destino">${["dependiente","cocina","admin","bar","FOCSA","Granma"].map(d => `<option value="${d}" ${datos.destino===d?"selected":""}>${d}</option>`).join("")}</select>
      <select name="area">${["plato","bebida","embalaje","extra"].map(a => `<option value="${a}" ${datos.area===a?"selected":""}>${a}</option>`).join("")}</select>
      <input name="orden" type="number" placeholder="Orden visual" value="${datos.orden || 0}" />
      <input name="imagen_url" placeholder="URL de imagen" value="${datos.imagen_url || ""}" />
      <textarea name="descripcion" placeholder="Descripción">${datos.descripcion || ""}</textarea>
      <div style="margin-top:12px; display:flex; gap:10px;">
        <button type="submit" class="btn-principal">${esEdicion ? "Guardar" : "Crear"}</button>
        <button type="button" class="btn-secundario" onclick="cerrarModalMenu()">Cancelar</button>
      </div>
    </form></div></div>`;

  document.getElementById("form-menu").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    payload.precio = parseFloat(payload.precio);
    payload.stock = parseInt(payload.stock);
    payload.orden = parseInt(payload.orden);

    const rpc = esEdicion ? "actualizar_menu" : "crear_menu";
    const args = esEdicion ? { menu_id: datos.id, cambios: payload } : { menu_input: payload };

    const { error } = await supabase.rpc(rpc, args);
    if (error) return alert("❌ Error al guardar");
    alert("✅ Cambios guardados");
    cerrarModalMenu();
    cargarMenus();
  };
}

function cerrarModalMenu() {
  document.getElementById("modal-menu-root").innerHTML = "";
}

async function exportarCSV() {
  const filtros = {
    destino: document.getElementById("filtro-destino").value || null,
    area: document.getElementById("filtro-area").value || null,
    activo: true
  };
  const { data, error } = await supabase.rpc("exportar_menus_csv", { filtros });
  if (error || !data) return alert("❌ Error al exportar CSV");
  const blob = new Blob([data], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "menus_export.csv";
  link.click();
}

async function importarCSV() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const { data, error } = await supabase.rpc("importar_menus_csv", { csv_text: text });
    if (error) return alert("❌ Error al importar CSV");
    alert(data);
    cargarMenus();
  };
  input.click();
}

async function cargarResumenMenus() {
  const { data, error } = await supabase.from("menus").select("categoria_id, destino, stock, precio");
  const cont = document.getElementById("panel-resumen");
  if (!cont || error || !data) return;

  const resumen = {};
  data.forEach(item => {
    const key = `${item.categoria_id || "Sin categoría"} · ${item.destino}`;
    if (!resumen[key]) resumen[key] = { total: 0, stock: 0 };
    resumen[key].total += Number(item.precio || 0);
    resumen[key].stock += Number(item.stock || 0);
  });

  let html = "<table><thead><tr><th>Categoría · Destino</th><th>Stock total</th><th>Valor total (CUP)</th></tr></thead><tbody>";
  Object.entries(resumen).forEach(([clave, val]) => {
    html += `<tr><td>${clave}</td><td>${val.stock}</td><td>${val.total.toFixed(2)}</td></tr>`;
  });
  html += "</tbody></table>";
  cont.innerHTML = html;
 });
    <div><strong>Total ítems:</strong><br/>${totalItems}</div>
    <div><strong>Activos:</strong><br/>${activos}</div>
    <div><strong>Disponibles:</strong><br/>${disponibles}</div>
    <div><strong>Sin stock:</strong><br/>${sinStock}</div>
    <div><strong>Stock total:</strong><br/>${stockTotal}</div>
    <div><strong>Valor total:</strong><br/>${valorTotal.toFixed(2)} CUP</div>
  `;
}
async function exportarAuditoria() {
  const { data, error } = await supabase
    .from("auditoria_menus")
    .select("*")
    .order("fecha", { ascending: false });

  if (error || !data) return alert("❌ Error al exportar auditoría");

  let csv = "menu_id,usuario,accion,campo,valor_anterior,valor_nuevo,fecha\n";
  data.forEach(log => {
    csv += `"${log.menu_id}","${log.usuario}","${log.accion}","${log.campo}","${log.valor_anterior}","${log.valor_nuevo}","${log.fecha}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "auditoria_menus.csv";
  link.click();
}

async function cargarAuditoria() {
  const { data, error } = await supabase
    .from("auditoria_menus")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(20);

  const cont = document.getElementById("panel-auditoria");
  if (!cont || error || !data || data.length === 0) {
    cont.innerHTML = "<p>No hay registros recientes.</p>";
    return;
  }

  let html = "<ul>";
  data.forEach(log => {
    html += `<li>
      <strong>${log.accion}</strong> en <code>${log.campo}</code> —
      <span class="meta">${log.valor_anterior} → ${log.valor_nuevo}</span><br/>
      <span class="meta">🕒 ${new Date(log.fecha).toLocaleString()} · 👤 ${log.usuario}</span>
    </li>`;
  });
  html += "</ul>";
  cont.innerHTML = html;
}

async function cargarUltimosModificados() {
  const { data, error } = await supabase
    .from("auditoria_menus")
    .select("menu_id, campo, valor_nuevo, fecha")
    .order("fecha", { ascending: false })
    .limit(10);

  const cont = document.getElementById("panel-modificados");
  if (!cont || error || !data || data.length === 0) {
    cont.innerHTML = "<p>No hay modificaciones recientes.</p>";
    return;
  }

  let html = "<ul>";
  for (const log of data) {
    const { data: menu } = await supabase
      .from("menus")
      .select("nombre, destino")
      .eq("id", log.menu_id)
      .single();

    html += `<li>
      <strong>${menu?.nombre || "Ítem"} (${menu?.destino || "-"})</strong><br/>
      <span class="meta">Campo: ${log.campo} → ${log.valor_nuevo}</span><br/>
      <span class="meta">🕒 ${new Date(log.fecha).toLocaleString()}</span>
    </li>`;
  }
  html += "</ul>";
  cont.innerHTML = html;
}

async function cargarSugerenciasReposicion() {
  const { data, error } = await supabase
    .from("menus")
    .select("id, nombre, stock, destino, area")
    .lt("stock", 3)
    .order("stock", { ascending: true });

  const cont = document.getElementById("panel-reposicion");
  if (!cont || error || !data || data.length === 0) {
    cont.innerHTML = "<p>No hay ítems con stock bajo.</p>";
    return;
  }

  let html = "<ul>";
  data.forEach(item => {
    html += `<li>
      <strong>${item.nombre}</strong> (${item.destino} · ${item.area}) —
      <span class="meta">Stock: ${item.stock}</span>
      <button onclick="reponerStock('${item.id}')">➕ Reponer</button>
    </li>`;
  });
  html += "</ul>";
  cont.innerHTML = html;
}

async function cargarResumenPorLocal() {
  const { data, error } = await supabase
    .from("menus")
    .select("destino, area, stock, precio");

  const cont = document.getElementById("panel-locales");
  if (!cont || error || !data) return;

  const resumen = {};
  data.forEach(item => {
    const key = `${item.destino} · ${item.area}`;
    if (!resumen[key]) resumen[key] = { total: 0, stock: 0 };
    resumen[key].total += Number(item.precio || 0);
    resumen[key].stock += Number(item.stock || 0);
  });

  let html = "<table><thead><tr><th>Destino · Área</th><th>Stock total</th><th>Valor total (CUP)</th></tr></thead><tbody>";
  Object.entries(resumen).forEach(([clave, val]) => {
    html += `<tr><td>${clave}</td><td>${val.stock}</td><td>${val.total.toFixed(2)}</td></tr>`;
  });
  html += "</tbody></table>";
  cont.innerHTML = html;
}
