import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // tu anon key
);

let menu = [];
let usuarioAutenticado = null;
let cantidadesSeleccionadas = {};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Login seguro con RPC
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
  localStorage.setItem("usuario_nombre", data.usuario);
  document.getElementById("usuario-conectado").textContent = data.usuario;

  document.getElementById("login").classList.add("contenido-oculto");
  document.getElementById("contenido").classList.remove("contenido-oculto");

  await Promise.all([cargarMenu(), cargarResumen(), mostrarPedidosPendientes()]);
}

// Cargar menú disponible
async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("id, nombre, precio, categoria")
    .eq("disponible", true)
    .order("categoria", { ascending: true });

  if (error) {
    console.warn("❌ Error al cargar el menú:", error);
    return;
  }

  menu = data || [];
  mostrarMenuAgrupado(menu);
  actualizarFiltroCategorias(menu);
}

// Render del menú agrupado y listeners
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

  // Listeners para inputs
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

function filtrarMenu() {
  const seleccion = document.getElementById("filtro").value;
  if (seleccion === "todos") {
    mostrarMenuAgrupado(menu);
  } else {
    const filtrado = menu.filter(p => p.categoria === seleccion);
    mostrarMenuAgrupado(filtrado);
  }
}

// Crear/actualizar pedido
async function enviarPedido() {
  const local = document.getElementById("local").value;
  const mesa = document.getElementById("mesa").value.trim();
  const hoy = new Date().toISOString().split("T")[0];

  const items = [];
  for (const menuId in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[menuId];
    const plato = menu.find(p => p.id === menuId);
    if (cantidad > 0 && plato) {
      items.push({ menu_id: menuId, nombre: plato.nombre, cantidad, precio: plato.precio });
    }
  }

  if (items.length === 0 || mesa === "") {
    alert("⚠️ Selecciona al menos un plato y especifica la mesa.");
    return;
  }

  const { data: existentes } = await supabase
    .from("pedidos")
    .select("id")
    .eq("usuario_id", usuarioAutenticado)
    .eq("local", local)
    .eq("mesa", mesa)
    .eq("cobrado", false)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  let pedidoId;
  let mensaje;

  if (existentes && existentes.length > 0) {
    pedidoId = existentes[0].id;
    mensaje = "✅ Pedido actualizado correctamente.";

    for (const item of items) {
      const { data: existente } = await supabase
        .from("pedido_items")
        .select("id, cantidad")
        .eq("pedido_id", pedidoId)
        .eq("menu_id", item.menu_id)
        .single();

      if (existente) {
        await supabase
          .from("pedido_items")
          .update({ cantidad: item.cantidad, precio: item.precio })
          .eq("id", existente.id);
      } else {
        await supabase.from("pedido_items").insert([{
          pedido_id: pedidoId,
          menu_id: item.menu_id,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precio
        }]);
      }
    }

    const { data: actualizados } = await supabase
      .from("pedido_items")
      .select("cantidad, precio")
      .eq("pedido_id", pedidoId);

    const nuevoTotal = (actualizados || []).reduce((sum, p) => sum + p.cantidad * p.precio, 0);

    await supabase
      .from("pedidos")
      .update({ total: nuevoTotal })
      .eq("id", pedidoId);

  } else {
    mensaje = "🆕 Nuevo pedido creado.";
    const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

    const { data } = await supabase
      .from("pedidos")
      .insert([{
        local,
        mesa,
        total,
        entregado: false,
        cobrado: false,
        fecha: new Date().toISOString(),
        usuario_id: usuarioAutenticado
      }])
      .select()
      .single();

    pedidoId = data.id;

    for (const item of items) {
      await supabase.from("pedido_items").insert([{
        pedido_id: pedidoId,
        menu_id: item.menu_id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio
      }]);
    }
  }

  const resumenEl = document.getElementById("resumen");
  const confirmacionEl = document.getElementById("confirmacion");
  confirmacionEl.classList.remove("confirmacion-oculta");

  resumenEl.innerHTML = `
    <p>${mensaje}</p>
    <p><strong>Mesa:</strong> ${escapeHtml(mesa)}</p>
    <p><strong>Local:</strong> ${escapeHtml(local)}</p>
    <p><strong>Platos:</strong> ${items.map(i => `${escapeHtml(i.nombre)} (${i.cantidad})`).join(", ")}</p>
  `;

  document.getElementById("usuario-conectado").textContent = localStorage.getItem("usuario_nombre") || "";
  await cargarResumen();
  await mostrarPedidosPendientes();
}

function limpiarSeleccion() {
  cantidadesSeleccionadas = {};
  document.querySelectorAll("#menu input[type='number']").forEach(input => (input.value = 0));
  document.getElementById("total").textContent = "0";
  document.getElementById("cantidad-items").textContent = "0";
}

function cerrarSesion() {
  usuarioAutenticado = null;
  localStorage.removeItem("usuario_nombre");
  document.getElementById("usuario").value = "";
  document.getElementById("clave").value = "";
  document.getElementById("login").classList.remove("contenido-oculto");
  document.getElementById("contenido").classList.add("contenido-oculto");
  document.getElementById("confirmacion").classList.add("confirmacion-oculta");
  document.getElementById("resumen").innerHTML = "";
  document.getElementById("usuario-conectado").textContent = "";
}

async function cargarResumen() {
  const hoy = new Date().toISOString().split("T")[0];
  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("cobrado, total")
    .eq("usuario_id", usuarioAutenticado)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  if (error) {
    console.warn("Error al cargar resumen:", error);
    return;
  }

  let cobrados = 0, pendientes = 0, totalCobrado = 0, totalPendiente = 0;

  (pedidos || []).forEach(p => {
    if (p.cobrado) {
      cobrados++;
      totalCobrado += p.total;
    } else {
      pendientes++;
      totalPendiente += p.total;
    }
  });

  document.getElementById("fecha-resumen").textContent = hoy;
  document.getElementById("total-cobrados").textContent = cobrados;
  document.getElementById("importe-cobrado").textContent = totalCobrado;
  document.getElementById("total-pendientes").textContent = pendientes;
  document.getElementById("importe-pendiente").textContent = totalPendiente;
}

async function mostrarPedidosPendientes() {
  const hoy = new Date().toISOString().split("T")[0];
  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("id, mesa, local, total")
    .eq("usuario_id", usuarioAutenticado)
    .eq("cobrado", false)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  if (error) {
    console.warn("Error al cargar pedidos pendientes:", error);
    return;
  }

  let html = "<h3>🕒 Pedidos pendientes</h3>";
  if (!pedidos || pedidos.length === 0) {
    html += "<p>No hay pedidos pendientes.</p>";
  } else {
    html += "<ul>";
    pedidos.forEach(p => {
      html += `
        <li>
          <strong>Mesa ${escapeHtml(p.mesa)}</strong> (${escapeHtml(p.local)}) – ${p.total} CUP
          <button class="btn-cobrar" data-pedido-id="${p.id}">Cobrar</button>
        </li>
      `;
    });
    html += "</ul>";
  }

  const contenedor = document.getElementById("pedidos-pendientes");
  if (contenedor) {
    contenedor.innerHTML = html;
    contenedor.querySelectorAll(".btn-cobrar").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const pedidoId = e.currentTarget.dataset.pedidoId;
        await cerrarPedido(pedidoId);
      });
    });
  }
}

async function cerrarPedido(pedidoId) {
  const { error } = await supabase
    .from("pedidos")
    .update({ cobrado: true })
    .eq("id", pedidoId);

  if (!error) {
    alert("✅ Pedido marcado como cobrado.");
    await cargarResumen();
    await mostrarPedidosPendientes();
  } else {
    alert("❌ Error al cerrar el pedido.");
  }
}

// Listeners globales
document.getElementById("btnEntrar").addEventListener("click", iniciarSesion);
document.getElementById("filtro").addEventListener("change", filtrarMenu);
document.getElementById("btnRevisarPedido").addEventListener("click", enviarPedido);
document.getElementById("btnLimpiarSeleccion").addEventListener("click", limpiarSeleccion);
document.getElementById("btnCerrarSesion").addEventListener("click", cerrarSesion);

// Carga inicial de menú para vista (opcional si quieres que se vea sin login)
