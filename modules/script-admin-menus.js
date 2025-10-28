import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

// DOM references
const form = document.getElementById("menuForm");
const categoriaSelect = document.getElementById("categoriaSelect");
const filtroDestino = document.getElementById("filtroDestino");
const filtroCategoria = document.getElementById("filtroCategoria");
const buscar = document.getElementById("buscar");
const menuListado = document.getElementById("menuListado");
const historialEl = document.getElementById("historial");
const btnCancelarEdicion = document.getElementById("btnCancelarEdicion");
const toast = document.getElementById("toast");

let cachedMenus = [];

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function showToast(msg, t = 2800) {
  toast.textContent = msg;
  toast.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (toast.style.display = "none"), t);
}

async function cargarCategorias() {
  const { data, error } = await supabase
    .from("menus")
    .select("categoria")
    .not("categoria", "is", null)
    .limit(1000);
  if (error) return console.error("categorias", error);
  const cats = [...new Set(data.map((r) => r.categoria).filter(Boolean))].sort();
  categoriaSelect.innerHTML = '<option value="">-- seleccionar --</option>';
  filtroCategoria.innerHTML = '<option value="">Todas</option>';
  cats.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    o.textContent = c;
    categoriaSelect.appendChild(o);
    const f = document.createElement("option");
    f.value = c;
    f.textContent = c;
    filtroCategoria.appendChild(f);
  });
}

async function listarMenus() {
  const destino = filtroDestino.value || null;
  const { data, error } = await supabase.rpc("listar_menus", {
    p_destino: destino,
    p_only_available: false,
    p_limit: 1000,
  });
  if (error) return console.error("listar_menus", error);
  cachedMenus = data || [];
  renderListado();
}

function renderListado() {
  const cat = filtroCategoria.value;
  const q = buscar.value.trim().toLowerCase();
  let items = cachedMenus;
  if (cat) items = items.filter((i) => i.categoria === cat);
  if (q) items = items.filter((i) => (i.nombre || "").toLowerCase().includes(q));

  const agrupado = items.reduce((acc, it) => {
    const c = it.categoria || "Sin categoría";
    acc[c] = acc[c] || [];
    acc[c].push(it);
    return acc;
  }, {});

  menuListado.innerHTML = "";
  Object.entries(agrupado).forEach(([cat, lista]) => {
    const grupo = document.createElement("div");
    grupo.style.marginBottom = "16px";

    const titulo = document.createElement("h3");
    titulo.textContent = cat;
    titulo.style.margin = "8px 0";
    grupo.appendChild(titulo);

    lista.forEach((it) => {
      const card = document.createElement("div");
      card.style.padding = "8px";
      card.style.border = "1px solid #eee";
      card.style.borderRadius = "8px";
      card.style.marginBottom = "6px";
      card.style.background = "#fff";
      card.style.boxShadow = "0 2px 6px rgba(0,0,0,0.04)";
      card.innerHTML = `
        <div><strong>${escapeHtml(it.nombre)}</strong> — ${it.precio} CUP</div>
        <div class="small">Destino: ${it.destino} · Disponible: ${it.disponible ? "Sí" : "No"}</div>
        <div style="margin-top:6px">
          <button class="edit" data-id="${it.id}">Editar</button>
          <button class="toggle" data-id="${it.id}">${it.disponible ? "Desactivar" : "Activar"}</button>
        </div>`;
      grupo.appendChild(card);
    });

    menuListado.appendChild(grupo);
  });

  menuListado.querySelectorAll(".edit").forEach((b) => b.addEventListener("click", cargarParaEditar));
  menuListado.querySelectorAll(".toggle").forEach((b) => b.addEventListener("click", toggleDisponible));
}

async function cargarParaEditar(ev) {
  const id = ev.target.dataset.id;
  const { data, error } = await supabase.from("menus").select("*").eq("id", id).single();
  if (error) return showToast("Error cargando plato");
  document.getElementById("menuId").value = data.id;
  document.getElementById("nombre").value = data.nombre || "";
  document.getElementById("descripcion").value = data.descripcion || "";
  document.getElementById("precio").value = data.precio || 0;
  categoriaSelect.value = data.categoria || "";
  document.getElementById("destino").value = data.destino || "restaurant";
  document.getElementById("disponible").value = data.disponible ? "true" : "false";
  document.getElementById("imagen_url").value = data.imagen_url || "";
  document.getElementById("stock").value = data.stock ?? "";
  btnCancelarEdicion.style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

btnCancelarEdicion.addEventListener("click", () => {
  form.reset();
  document.getElementById("menuId").value = "";
  btnCancelarEdicion.style.display = "none";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("menuId").value || null;
  const payload = {
    nombre: document.getElementById("nombre").value.trim(),
    descripcion: document.getElementById("descripcion").value.trim(),
    precio: parseFloat(document.getElementById("precio").value) || 0,
    categoria: categoriaSelect.value || "",
    destino: document.getElementById("destino").value,
    disponible: document.getElementById("disponible").value === "true",
    imagen_url: document.getElementById("imagen_url").value.trim(),
    stock: document.getElementById("stock").value === "" ? null : parseInt(document.getElementById("stock").value),
  };
  try {
    if (!id) {
      const { error } = await supabase.rpc("crear_menu", { p_payload: payload, p_actor: "admin_ui" });
      if (error) throw error;
      showToast("Plato creado");
    } else {
      const { error } = await supabase.rpc("actualizar_menu", { p_id: id, p_changes: payload, p_actor: "admin_ui" });
      if (error) throw error;
      showToast("Plato actualizado");
    }
    form.reset();
    document.getElementById("menuId").value = "";
    btnCancelarEdicion.style.display = "none";
    await cargarCategorias();
    await listarMenus();
    await cargarHistorial();
  } catch (err) {
    console.error("guardar", err);
    showToast("Error al guardar");
  }
});
async function toggleDisponible(ev) {
  const id = ev.target.dataset.id;
  const item = cachedMenus.find((m) => m.id === id);
  if (!item) return;
  const nuevo = !item.disponible;
  const payload = { disponible: nuevo };
  const { error } = await supabase.rpc("actualizar_menu", {
    p_id: id,
    p_changes: payload,
    p_actor: "admin_ui",
  });
  if (error) return showToast("Error al cambiar estado");
  showToast(nuevo ? "Plato activado" : "Plato desactivado");
  await listarMenus();
  await cargarHistorial();
}

async function cargarHistorial() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("actor, action, object_type, object_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return console.error("audit_logs", error);
  historialEl.innerHTML = "";
  (data || []).forEach((h) => {
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

// Filtros
filtroDestino.addEventListener("change", listarMenus);
filtroCategoria.addEventListener("change", renderListado);
buscar.addEventListener("input", () => {
  clearTimeout(buscar._t);
  buscar._t = setTimeout(renderListado, 200);
});
document.getElementById("btnRefrescar").addEventListener("click", async () => {
  await cargarCategorias();
  await listarMenus();
  await cargarHistorial();
});

// Inicialización
(async function init() {
  await cargarCategorias();
  await listarMenus();
  await cargarHistorial();
})();
