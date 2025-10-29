// Parte 1 — script-dependientes.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

let menu = [];
let usuarioAutenticado = null;
let cantidadesSeleccionadas = {};
let latestMenuFetchTs = 0;

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.iniciarSesion = async function () {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();
  if (!usuario || !clave) return alert("Completa usuario y contraseña.");

  const { data, error } = await supabase.rpc("login_dependiente", {
    usuario_input: usuario,
    clave_input: clave
  });

  if (error || !data) return alert("❌ Usuario o contraseña incorrectos.");

  const perfil = Array.isArray(data) ? data[0] : data;
  if (!perfil || !["admin", "dependiente", "gerente"].includes(perfil.rol)) {
    return alert("⚠️ Acceso denegado para este rol.");
  }

  usuarioAutenticado = perfil.id;
  localStorage.setItem("usuario_nombre", perfil.usuario);
  document.getElementById("usuario-conectado").textContent = perfil.usuario;
  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  const btnRec = document.getElementById("btn-recargar-menu");
  if (btnRec) btnRec.onclick = () => cargarMenu(true);

  await Promise.all([cargarMenu(), cargarResumen(), mostrarPedidosPendientes()]);
};

window.cerrarSesion = function () {
  usuarioAutenticado = null;
  localStorage.removeItem("usuario_nombre");
  document.getElementById("usuario").value = "";
  document.getElementById("clave").value = "";
  document.getElementById("login").style.display = "block";
  document.getElementById("contenido").style.display = "none";
  document.getElementById("confirmacion").style.display = "none";
  document.getElementById("resumen").innerHTML = "";
  document.getElementById("usuario-conectado").textContent = "";
};

async function cargarResumen() {
  if (!usuarioAutenticado) return;
  const hoy = new Date().toISOString().split("T")[0];

  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("cobrado, total")
    .eq("usuario_id", usuarioAutenticado)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  if (error) return;

  let cobrados = 0, pendientes = 0, totalCobrado = 0, totalPendiente = 0;
  (pedidos || []).forEach(p => {
    if (p.cobrado) { cobrados++; totalCobrado += Number(p.total || 0); }
    else { pendientes++; totalPendiente += Number(p.total || 0); }
  });

  document.getElementById("fecha-resumen").textContent = hoy;
  document.getElementById("total-cobrados").textContent = String(cobrados);
  document.getElementById("importe-cobrado").textContent = totalCobrado.toFixed(2);
  document.getElementById("total-pendientes").textContent = String(pendientes);
  document.getElementById("importe-pendiente").textContent = totalPendiente.toFixed(2);
}

async function cargarMenu(force = false) {
  const now = Date.now();
  if (!force && now - latestMenuFetchTs < 2500) return;
  latestMenuFetchTs = now;

  const { data, error } = await supabase
    .from("menus")
    .select("id,nombre,precio,categoria,disponible,activo")
    .eq("disponible", true)
    .eq("activo", true)
    .order("categoria", { ascending: true });

  if (error) return;

  menu = data || [];
  const menuIds = new Set(menu.map(m => m.id));
  Object.keys(cantidadesSeleccionadas).forEach(id => {
    if (!menuIds.has(id)) delete cantidadesSeleccionadas[id];
  });

  mostrarMenuAgrupado(menu);
  actualizarFiltroCategorias(menu);
  actualizarTotalesUI();
}
// Parte 2 — script-dependientes.js
function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  if (!contenedor) return;
  contenedor.innerHTML = "";

  const grupos = platos.reduce((acc, p) => {
    const cat = p.categoria || "Sin categoría";
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});

  for (const categoria of Object.keys(grupos)) {
    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";
    grupo.innerHTML = `<h3>${escapeHtml(categoria)}</h3>`;

    grupos[categoria].forEach(plato => {
      const cantidadActual = Number(cantidadesSeleccionadas[plato.id] || 0);
      const item = document.createElement("div");
      item.className = "menu-item";
      item.innerHTML = `
        <div class="nombre">${escapeHtml(plato.nombre)}</div>
        <div class="precio">${Number(plato.precio).toFixed(2)} CUP</div>
        <input type="number" min="0" value="${cantidadActual}" data-menu-id="${plato.id}" aria-label="Cantidad ${escapeHtml(plato.nombre)}" />
      `;
      const input = item.querySelector("input");
      input.addEventListener("input", (ev) => {
        const v = ev.target.value === "" ? 0 : parseInt(ev.target.value, 10) || 0;
        actualizarCantidad(plato.id, v);
      });
      grupo.appendChild(item);
    });

    contenedor.appendChild(grupo);
  }
}

function actualizarFiltroCategorias(platos) {
  const filtro = document.getElementById("filtro");
  if (!filtro) return;
  const categorias = [...new Set(platos.map(p => p.categoria || "Sin categoría"))].sort();
  filtro.innerHTML = `<option value="todos">Todos</option>`;
  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtro.appendChild(option);
  });
  attachFiltroListener();
}

function attachFiltroListener() {
  const filtroEl = document.getElementById("filtro");
  if (!filtroEl) return;
  const nuevo = filtroEl.cloneNode(true);
  filtroEl.parentNode.replaceChild(nuevo, filtroEl);
  nuevo.addEventListener("change", window.filtrarMenu);
}

window.filtrarMenu = function () {
  const seleccion = document.getElementById("filtro").value;
  if (seleccion === "todos") mostrarMenuAgrupado(menu);
  else mostrarMenuAgrupado(menu.filter(p => (p.categoria || "Sin categoría") === seleccion));
};

window.actualizarCantidad = function (menuId, cantidad) {
  const qty = parseInt(cantidad, 10) || 0;
  if (qty <= 0) delete cantidadesSeleccionadas[menuId];
  else cantidadesSeleccionadas[menuId] = qty;
  actualizarTotalesUI();
};

function actualizarTotalesUI() {
  const total = Object.entries(cantidadesSeleccionadas).reduce((sum, [id, qty]) => {
    const plato = menu.find(p => p.id === id);
    return sum + (plato ? Number(plato.precio) * qty : 0);
  }, 0);
  const items = Object.values(cantidadesSeleccionadas).reduce
