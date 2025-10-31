import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU" // tu anon key real
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
 };
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
// script-menus.prod.part2.js
// Cargas y rendering principales

// Cargar todos los menús y renderizar tablas/paneles
export async function cargarMenus() {
  const { data, error } = await supabase.from("menus").select("*");
  if (error || !data) {
    console.error("cargarMenus:", error);
    return;
  }
  renderizarTabla(data);
  renderizarSinStock(data);
  actualizarFiltros(data);
}

// Tabla principal (sin iconografía, diseño sobrio)
function renderizarTabla(items) {
  const cont = document.getElementById("tabla-menus");
  if (!cont) return;

  let html = `<table><thead><tr>
    <th>Nombre</th><th>Precio</th><th>Stock</th><th>Destino</th>
    <th>Área</th><th>Activo</th><th>Acciones</th>
  </tr></thead><tbody>`;

  items.forEach(item => {
    html += `<tr data-id="${item.id}">
      <td>${escapeHtml(item.nombre)}</td>
      <td>${Number(item.precio).toFixed(2)}</td>
      <td>${Number(item.stock)}</td>
      <td>${escapeHtml(item.destino)}</td>
      <td>${escapeHtml(item.area)}</td>
      <td>${item.activo ? "Sí" : "No"}</td>
      <td>
        <button class="btn-text" data-action="editar" data-id="${item.id}">Editar</button>
        <button class="btn-text" data-action="duplicar" data-id="${item.id}" data-destino="${escapeHtml(item.destino)}">Duplicar</button>
        <button class="btn-text" data-action="desactivar" data-id="${item.id}">Desactivar</button>
      </td>
    </tr>`;
  });

  html += "</tbody></table>";
  cont.innerHTML = html;

  // Delegación de eventos para minimizar inline handlers
  cont.querySelectorAll("button[data-action]").forEach(btn => {
    btn.onclick = async (e) => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (action === "editar") return editarItem(id);
      if (action === "duplicar") return duplicarItem(id, btn.getAttribute("data-destino"));
      if (action === "desactivar") return desactivarItem(id);
    };
  });
}

// Panel ítems sin stock (compacto)
function renderizarSinStock(items) {
  const cont = document.getElementById("panel-sin-stock");
  if (!cont) return;
  const sinStock = items.filter(i => Number(i.stock) === 0);
  if (sinStock.length === 0) { cont.innerHTML = "<p>Todos los ítems tienen stock.</p>"; return; }
  let html = "<ul>";
  sinStock.forEach(i => {
    html += `<li>${escapeHtml(i.nombre)} — ${escapeHtml(i.destino)} · ${escapeHtml(i.area)} <button class="btn-text" data-reponer="${i.id}">Reponer</button></li>`;
  });
  html += "</ul>";
  cont.innerHTML = html;
  cont.querySelectorAll("button[data-reponer]").forEach(b => { b.onclick = () => reponerStock(b.getAttribute("data-reponer")); });
}

// Actualizar selects de filtros
function actualizarFiltros(items) {
  const destinos = Array.from(new Set(items.map(i => i.destino))).sort();
  const areas = Array.from(new Set(items.map(i => i.area))).sort();

  const selDestino = document.getElementById("filtro-destino");
  const selArea = document.getElementById("filtro-area");
  if (selDestino) {
    selDestino.innerHTML = `<option value="">Todos</option>${destinos.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}`;
  }
  if (selArea) {
    selArea.innerHTML = `<option value="">Todos</option>${areas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join("")}`;
  }
}

// Escape simple para evitar inyección en inserciones de HTML
function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"'`]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;' })[c]);
}
// script-menus.prod.part3.js
// Modales, edición/creación, acciones con auditoría

// Abrir modal genérico para crear/editar
export function abrirModalMenu(modo, datos = {}) {
  const root = document.getElementById("modal-menu-root");
  if (!root) return;
  const esEdicion = modo === "editar";
  const titulo = esEdicion ? "Editar ítem" : "Crear ítem";

  root.innerHTML = `<div class="modal-backdrop"><div class="modal">
    <h3>${titulo}</h3>
    <form id="form-menu">
      <label>Nombre<input name="nombre" value="${escapeHtml(datos.nombre || "")}" required /></label>
      <label>Precio<input name="precio" type="number" step="0.01" value="${escapeHtml(datos.precio || "")}" required /></label>
      <label>Stock<input name="stock" type="number" value="${escapeHtml(datos.stock ?? 0)}" required /></label>
      <label>Categoría ID<input name="categoria_id" value="${escapeHtml(datos.categoria_id || "")}" /></label>
      <label>Destino
        <select name="destino">
          ${["dependiente","cocina","admin","bar","FOCSA","Granma"].map(d => `<option value="${d}" ${datos.destino===d?"selected":""}>${d}</option>`).join("")}
        </select>
      </label>
      <label>Área
        <select name="area">
          ${["plato","bebida","embalaje","extra"].map(a => `<option value="${a}" ${datos.area===a?"selected":""}>${a}</option>`).join("")}
        </select>
      </label>
      <label>Orden<input name="orden" type="number" value="${escapeHtml(String(datos.orden ?? 0))}" /></label>
      <label>URL imagen<input name="imagen_url" value="${escapeHtml(datos.imagen_url || "")}" /></label>
      <label>Descripción<textarea name="descripcion">${escapeHtml(datos.descripcion || "")}</textarea></label>
      <div class="modal-actions">
        <button type="submit" class="btn-primary">${esEdicion ? "Guardar" : "Crear"}</button>
        <button type="button" class="btn-muted" id="modal-cancel">Cancelar</button>
      </div>
    </form>
  </div></div>`;

  document.getElementById("modal-cancel").onclick = cerrarModalMenu;

  document.getElementById("form-menu").onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    payload.precio = safeParseFloat(payload.precio);
    payload.stock = safeParseInt(payload.stock);
    payload.orden = safeParseInt(payload.orden);

    try {
      if (esEdicion) {
        // cargar valor anterior para auditoría
        const { data: prev } = await supabase.from("menus").select("*").eq("id", datos.id).single();
        const { error } = await supabase.rpc("actualizar_menu", { menu_id: datos.id, cambios: payload });
        if (error) throw error;
        await logAuditoria({ menu_id: datos.id, usuario: localStorage.getItem("usuario"), accion: "editar", campo: "varios", valor_anterior: JSON.stringify(prev), valor_nuevo: JSON.stringify(payload) });
        toast("Cambios guardados");
      } else {
        const { data: created, error } = await supabase.rpc("crear_menu", { menu_input: payload });
        if (error) throw error;
        await logAuditoria({ menu_id: created?.id ?? null, usuario: localStorage.getItem("usuario"), accion: "crear", campo: "varios", valor_nuevo: JSON.stringify(payload) });
        toast("Ítem creado");
      }
      cerrarModalMenu();
      cargarMenus();
    } catch (err) {
      console.error(err);
      toast("Error al guardar. Revisa la consola.");
    }
  };
}

export function cerrarModalMenu() {
  const root = document.getElementById("modal-menu-root");
  if (!root) return;
  root.innerHTML = "";
}

// Editar: abre modal con datos cargados
export async function editarItem(id) {
  const { data, error } = await supabase.from("menus").select("*").eq("id", id).single();
  if (error || !data) return toast("Error al cargar ítem");
  abrirModalMenu("editar", data);
}

// Duplicar (auditable)
export async function duplicarItem(id, destino) {
  const nuevoDestino = prompt("Destino nuevo:", destino);
  if (!nuevoDestino) return;
  try {
    const { error, data } = await supabase.rpc("duplicar_menu_para_destino", { menu_id: id, nuevo_destino: nuevoDestino });
    if (error) throw error;
    await logAuditoria({ menu_id: id, usuario: localStorage.getItem("usuario"), accion: "duplicar", campo: "destino", valor_anterior: destino, valor_nuevo: nuevoDestino });
    toast("Duplicado correctamente");
    cargarMenus();
  } catch (e) {
    console.error(e);
    toast("Error al duplicar");
  }
}

// Desactivar (auditable)
export async function desactivarItem(id) {
  if (!confirm("Confirmar desactivación del ítem?")) return;
  try {
    const { data: prev } = await supabase.from("menus").select("*").eq("id", id).single();
    const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: { activo: false } });
    if (error) throw error;
    await logAuditoria({ menu_id: id, usuario: localStorage.getItem("usuario"), accion: "desactivar", campo: "activo", valor_anterior: prev.activo, valor_nuevo: false });
    toast("Ítem desactivado");
    cargarMenus();
  } catch (e) {
    console.error(e);
    toast("Error al desactivar");
  }
}

// Reponer stock (auditable)
export async function reponerStock(id) {
  const nuevoStock = prompt("Nuevo stock:");
  if (nuevoStock == null) return;
  const n = safeParseInt(nuevoStock);
  try {
    const { data: prev } = await supabase.from("menus").select("stock").eq("id", id).single();
    const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: { stock: n } });
    if (error) throw error;
    await logAuditoria({ menu_id: id, usuario: localStorage.getItem("usuario"), accion: "reponer", campo: "stock", valor_anterior: prev.stock, valor_nuevo: n });
    toast("Stock actualizado");
    cargarMenus();
  } catch (e) {
    console.error(e);
    toast("Error al actualizar stock");
  }
}
// script-menus.prod.part4.js
// Export/Import, paneles resumen y auditoría de lectura

// Exportar CSV (llama RPC que devuelva CSV como text)
export async function exportarCSV() {
  try {
    const filtros = {
      destino: document.getElementById("filtro-destino")?.value || null,
      area: document.getElementById("filtro-area")?.value || null,
      activo: true
    };
    const { data, error } = await supabase.rpc("exportar_menus_csv", { filtros });
    if (error || !data) throw error || new Error("Sin datos");
    const blob = new Blob([data], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "menus_export.csv";
    link.click();
    await logAuditoria({ accion: "exportar_csv", usuario: localStorage.getItem("usuario"), campo: "export", valor_nuevo: JSON.stringify(filtros) });
  } catch (e) {
    console.error(e);
    toast("Error al exportar CSV");
  }
}

// Validación simple de CSV
function validarCSV(texto) {
  const filas = texto.trim().split("\n").map(r => r.trim()).filter(Boolean);
  if (filas.length < 1) return false;
  const encabezado = filas[0].split(",").map(h => h.trim().toLowerCase());
  const esperadas = ["nombre","precio","stock","categoria_id","destino","area","orden","imagen_url","descripcion"];
  return esperadas.every(c => encabezado.includes(c));
}

// Importar CSV con validación y auditoría
export async function importarCSV() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    if (!validarCSV(text)) { toast("CSV inválido. Faltan columnas requeridas."); return; }
    try {
      const { data, error } = await supabase.rpc("importar_menus_csv", { csv_text: text });
      if (error) throw error;
      await logAuditoria({ accion: "importar_csv", usuario: localStorage.getItem("usuario"), campo: "import", valor_nuevo: `filas:${(text.match(/\n/g)||[]).length}` });
      toast("Importación completada");
      cargarMenus();
    } catch (err) {
      console.error(err);
      toast("Error al importar CSV");
    }
  };
  input.click();
}

// Dashboard resumen (estadísticas)
export async function cargarDashboardResumen() {
  const { data, error } = await supabase.from("menus").select("id, precio, stock, activo, disponible");
  const cont = document.getElementById("panel-dashboard");
  if (!cont || error || !data) return;
  const totalItems = data.length;
  const activos = data.filter(i => i.activo).length;
  const disponibles = data.filter(i => i.disponible).length;
  const sinStock = data.filter(i => Number(i.stock) === 0).length;
  const stockTotal = data.reduce((s, i) => s + Number(i.stock || 0), 0);
  const valorTotal = data.reduce((s, i) => s + Number(i.precio || 0), 0);

  cont.innerHTML = `<div class="stat">Total ítems<br><strong>${totalItems}</strong></div>
    <div class="stat">Activos<br><strong>${activos}</strong></div>
    <div class="stat">Disponibles<br><strong>${disponibles}</strong></div>
    <div class="stat">Sin stock<br><strong>${sinStock}</strong></div>
    <div class="stat">Stock total<br><strong>${stockTotal}</strong></div>
    <div class="stat">Valor total (CUP)<br><strong>${valorTotal.toFixed(2)}</strong></div>`;

  // registrar lectura de dashboard (opcional, ligero)
  logAuditoria({ accion: "leer_dashboard", usuario: localStorage.getItem("usuario"), campo: "dashboard", valor_nuevo: JSON.stringify({ totalItems, activos, sinStock }) });
}

// Resumen por categoría/destino
export async function cargarResumenMenus() {
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
  Object.entries(resumen).forEach(([k,v]) => { html += `<tr><td>${escapeHtml(k)}</td><td>${v.stock}</td><td>${v.total.toFixed(2)}</td></tr>`; });
  html += "</tbody></table>";
  cont.innerHTML = html;
}

// Resumen por local (destino · área)
export async function cargarResumenPorLocal() {
  const { data, error } = await supabase.from("menus").select("destino, area, stock, precio");
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
  Object.entries(resumen).forEach(([k,v]) => { html += `<tr><td>${escapeHtml(k)}</td><td>${v.stock}</td><td>${v.total.toFixed(2)}</td></tr>`; });
  html += "</tbody></table>";
  cont.innerHTML = html;
}

// Cargar auditoría y últimos cambios
export async function cargarAuditoria() {
  const { data, error } = await supabase.from("auditoria_menus").select("*").order("fecha", { ascending: false }).limit(20);
  const cont = document.getElementById("panel-auditoria");
  if (!cont || error || !data || data.length === 0) { cont.innerHTML = "<p>No hay registros recientes.</p>"; return; }
  let html = "<ul>";
  data.forEach(log => {
    html += `<li><strong>${escapeHtml(log.accion)}</strong> — ${escapeHtml(log.campo)}<br><span class="meta">${escapeHtml(log.valor_anterior)} → ${escapeHtml(log.valor_nuevo)}</span><br><span class="meta">${new Date(log.fecha).toLocaleString()} · ${escapeHtml(log.usuario)}</span></li>`;
  });
  html += "</ul>";
  cont.innerHTML = html;
}

export async function cargarUltimosModificados() {
  const { data, error } = await supabase.from("auditoria_menus").select("menu_id, campo, valor_nuevo, fecha").order("fecha", { ascending: false }).limit(10);
  const cont = document.getElementById("panel-modificados");
  if (!cont || error || !data || data.length === 0) { cont.innerHTML = "<p>No hay modificaciones recientes.</p>"; return; }
  let html = "<ul>";
  for (const log of data) {
    const { data: menu } = await supabase.from("menus").select("nombre, destino").eq("id", log.menu_id).single();
    html += `<li><strong>${escapeHtml(menu?.nombre || "Ítem")} (${escapeHtml(menu?.destino || "-")})</strong><br><span class="meta">Campo: ${escapeHtml(log.campo)} → ${escapeHtml(log.valor_nuevo)}</span><br><span class="meta">${new Date(log.fecha).toLocaleString()}</span></li>`;
  }
  html += "</ul>";
  cont.innerHTML = html;
}

// Exportar auditoría completa
export async function exportarAuditoria() {
  try {
    const { data, error } = await supabase.from("auditoria_menus").select("*").order("fecha", { ascending: false });
    if (error || !data) throw error || new Error("Sin datos");
    let csv = "menu_id,usuario,accion,campo,valor_anterior,valor_nuevo,fecha\n";
    data.forEach(log => {
      csv += `"${log.menu_id}","${log.usuario}","${log.accion}","${log.campo}","${log.valor_anterior}","${log.valor_nuevo}","${log.fecha}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "auditoria_menus.csv"; link.click();
    await logAuditoria({ accion: "exportar_auditoria", usuario: localStorage.getItem("usuario"), campo: "export_audit", valor_nuevo: `rows:${data.length}` });
  } catch (e) {
    console.error(e);
    toast("Error al exportar auditoría");
  }
}

// Sugerencias de reposición
export async function cargarSugerenciasReposicion() {
  const { data, error } = await supabase.from("menus").select("id, nombre, stock, destino, area").lt("stock", 3).order("stock", { ascending: true });
  const cont = document.getElementById("panel-reposicion");
  if (!cont || error || !data || data.length === 0) { cont.innerHTML = "<p>No hay ítems con stock bajo.</p>"; return; }
  let html = "<ul>";
  data.forEach(item => {
    html += `<li>${escapeHtml(item.nombre)} (${escapeHtml(item.destino)} · ${escapeHtml(item.area)}) — Stock: ${item.stock} <button class="btn-text" data-reponer="${item.id}">Reponer</button></li>`;
  });
  html += "</ul>";
  cont.innerHTML = html;
  cont.querySelectorAll("button[data-reponer]").forEach(b => { b.onclick = () => reponerStock(b.getAttribute("data-reponer")); });
}
