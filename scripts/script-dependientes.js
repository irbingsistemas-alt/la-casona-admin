import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU" // tu anon key
);

let menu = [];
let usuarioAutenticado = localStorage.getItem("usuario_id") || null;
let cantidadesSeleccionadas = {};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mostrarMensaje(texto, tipo = "info") {
  const mensaje = document.getElementById("mensajeSistema");
  mensaje.textContent = texto;
  mensaje.className = tipo === "error" ? "mensaje-error" : "confirmacion-ok";
  mensaje.style.display = "block";
  setTimeout(() => mensaje.style.display = "none", 4000);
}

async function iniciarSesion() {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();
  const loginError = document.getElementById("loginError");
  loginError.textContent = "";

  const { data, error } = await supabase
    .rpc("login_usuario", { usuario_input: usuario, clave_input: clave })
    .single();

  if (error || !data) {
    loginError.textContent = "❌ Usuario o contraseña incorrectos.";
    return;
  }

  usuarioAutenticado = data.id;
  localStorage.setItem("usuario_id", data.id);
  localStorage.setItem("usuario_nombre", data.usuario);
  localStorage.setItem("usuario_rol", data.rol);

  document.getElementById("usuario-conectado").textContent = data.usuario;
  document.getElementById("login").classList.add("contenido-oculto");
  document.getElementById("contenido").classList.remove("contenido-oculto");

  await Promise.all([cargarMenu(), cargarResumen(), mostrarPedidosPendientes()]);
}

document.getElementById("btnEntrar").addEventListener("click", iniciarSesion);

window.addEventListener("load", () => {
  const nombre = localStorage.getItem("usuario_nombre");
  if (usuarioAutenticado && nombre) {
    document.getElementById("usuario-conectado").textContent = nombre;
    document.getElementById("login").classList.add("contenido-oculto");
    document.getElementById("contenido").classList.remove("contenido-oculto");
    cargarMenu();
    cargarResumen();
    mostrarPedidosPendientes();
  }
});
async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("id, nombre, precio, categoria")
    .eq("disponible", true)
    .order("categoria", { ascending: true });

  if (error) {
    mostrarMensaje("❌ Error al cargar el menú", "error");
    return;
  }

  menu = data || [];
  mostrarMenuAgrupado(menu);
  actualizarFiltroCategorias(menu);
}

function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  contenedor.innerHTML = "";
  cantidadesSeleccionadas = {};

  const grupos = {};
  platos.forEach(p => {
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  });

  for (const categoria in grupos) {
    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";
    grupo.innerHTML = `<h3>${escapeHtml(categoria)}</h3>`;

    grupos[categoria].forEach(plato => {
      const item = document.createElement("div");
      item.className = "menu-item";
      item.innerHTML = `
        <div>${escapeHtml(plato.nombre)}</div>
        <div class="precio">${plato.precio} CUP</div>
        <input type="number" min="0" value="0" data-menu-id="${plato.id}" />
      `;
      grupo.appendChild(item);
    });

    contenedor.appendChild(grupo);
  }

  contenedor.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener("input", (e) => {
      const menuId = e.target.dataset.menuId;
      const cantidad = parseInt(e.target.value) || 0;
      cantidadesSeleccionadas[menuId] = cantidad;

      const total = Object.entries(cantidadesSeleccionadas).reduce((sum, [id, cant]) => {
        const plato = menu.find(p => p.id === id);
        return sum + (plato ? plato.precio * cant : 0);
      }, 0);

      const items = Object.values(cantidadesSeleccionadas).reduce((sum, c) => sum + c, 0);
      document.getElementById("total").textContent = total;
      document.getElementById("cantidad-items").textContent = items;
    });
  });
}

async function mostrarPedidosPendientes() {
  const hoy = new Date().toISOString().split("T")[0];
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, mesa, total, fecha")
    .eq("usuario_id", usuarioAutenticado)
    .eq("cobrado", false)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  const contenedor = document.getElementById("pedidos-pendientes");
  contenedor.innerHTML = "";

  (data || []).forEach(pedido => {
    const div = document.createElement("div");
    div.className = "pedido-pendiente";
    div.innerHTML = `
      <strong>Mesa:</strong> ${pedido.mesa} |
      <strong>Total:</strong> ${pedido.total} CUP |
      <strong>Hora:</strong> ${new Date(pedido.fecha).toLocaleTimeString()}
      <button onclick="verDetallePedido('${pedido.id}')" class="btn-secundario">Ver detalles</button>
      <button onclick="marcarCobrado('${pedido.id}')">Cobrar</button>
    `;
    contenedor.appendChild(div);
  });
}

async function verDetallePedido(pedidoId) {
  const { data, error } = await supabase
    .from("vista_pedido_detalle")
    .select("*")
    .eq("pedido_id", pedidoId);

  const contenedor = document.getElementById("detalle-pedido");
  contenedor.innerHTML = "";

  const grupos = {};
  (data || []).forEach(item => {
    if (!grupos[item.categoria]) grupos[item.categoria] = [];
    grupos[item.categoria].push(item);
  });

  for (const categoria in grupos) {
    const bloque = document.createElement("div");
    bloque.innerHTML = `<h4>${categoria}</h4>`;
    grupos[categoria].forEach(plato => {
      const fila = document.createElement("div");
      fila.className = "item-actualizado";
      fila.innerHTML = `
        ${plato.nombre} — ${plato.cantidad} u. — ${plato.precio} CUP
        ${plato.actualizado_en ? `<br><small>Actualizado: ${new Date(plato.actualizado_en).toLocaleTimeString()}</small>` : ""}
      `;
      bloque.appendChild(fila);
    });
    contenedor.appendChild(bloque);
  }

  document.getElementById("modal-detalle").classList.remove("contenido-oculto");
}

function cerrarModalDetalle() {
  document.getElementById("modal-detalle").classList.add("contenido-oculto");
}

async function marcarCobrado(pedidoId) {
  await supabase
    .from("pedidos")
    .update({ cobrado: true })
    .eq("id", pedidoId);

  mostrarPedidosPendientes();
  cargarResumen();
}

function actualizarFiltroCategorias(platos) {
  const filtro = document.getElementById("filtro");
  const categorias = [...new Set(platos.map(p => p.categoria))];
  filtro.innerHTML = `<option value="todos">Todos</option>`;

  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtro.appendChild(option);
  });
}

function cargarResumen() {
  document.getElementById("fecha-resumen").textContent = new Date().toISOString().split("T")[0];
  // Aquí puedes agregar lógica para calcular totales si lo deseas
}

document.getElementById("btnCerrarSesion").addEventListener("click", () => {
  localStorage.clear();
  location.reload();
});
