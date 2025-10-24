import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

let usuarioAutenticado = null;
let menu = [];
let cantidadesSeleccionadas = {};
let total = 0;

window.addEventListener("DOMContentLoaded", async () => {
  const id = localStorage.getItem("usuario_id");
  if (id) {
    usuarioAutenticado = id;
    document.getElementById("login").style.display = "none";
    document.getElementById("contenido").style.display = "block";
    await cargarMenu();
    await cargarResumen();
    await mostrarPedidosPendientes();
  }

  const hoy = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  document.getElementById("fecha-resumen").textContent = hoy;
});

window.iniciarSesion = async function () {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  if (!usuario || !clave) {
    alert("⚠️ Debes ingresar usuario y contraseña.");
    return;
  }

  const { data, error } = await supabase.rpc("login_dependiente", {
    usuario_input: usuario,
    clave_input: clave
  }).single();

  if (error || !data || data.rol !== "dependiente") {
    alert("❌ Credenciales incorrectas o rol no autorizado");
    return;
  }

  usuarioAutenticado = data.id;
  localStorage.setItem("usuario_id", data.id);
  document.getElementById("usuario-conectado").textContent = data.usuario;

  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  await cargarMenu();
  await cargarResumen();
  await mostrarPedidosPendientes();
};

async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("nombre, precio, categoria")
    .eq("activo", true)
    .order("categoria", { ascending: true });

  if (error || !data) {
    alert("❌ Error al cargar el menú");
    return;
  }

  menu = data;
  mostrarMenuAgrupado(menu);
}

function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  contenedor.innerHTML = "";

  const agrupado = {};
  platos.forEach(p => {
    if (!agrupado[p.categoria]) agrupado[p.categoria] = [];
    agrupado[p.categoria].push(p);
  });

  for (const categoria in agrupado) {
    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";

    const titulo = document.createElement("h3");
    titulo.textContent = categoria;
    grupo.appendChild(titulo);

    agrupado[categoria].forEach(item => {
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `
        <div>${item.nombre}</div>
        <div class="precio">${item.precio} CUP</div>
        <input type="number" min="0" value="0" data-name="${item.nombre}" data-price="${item.precio}" />
      `;
      grupo.appendChild(div);
    });

    contenedor.appendChild(grupo);
  }

  document.querySelectorAll("input[type='number']").forEach(input => {
    input.addEventListener("input", () => {
      const nombre = input.dataset.name;
      const cantidad = parseInt(input.value) || 0;
      cantidadesSeleccionadas[nombre] = cantidad;
      calcularTotal();
    });
  });

  calcularTotal();
}

function calcularTotal() {
  total = 0;
  let cantidadTotal = 0;
  for (const nombre in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[nombre];
    const plato = menu.find(p => p.nombre === nombre);
    if (plato && cantidad > 0) {
      total += cantidad * plato.precio;
      cantidadTotal += cantidad;
    }
  }
  document.getElementById("total").textContent = total;
  document.getElementById("cantidad-items").textContent = cantidadTotal;
}

window.limpiarSeleccion = function () {
  cantidadesSeleccionadas = {};
  total = 0;
  document.querySelectorAll(".menu-item input").forEach(input => input.value = "0");
  document.getElementById("total").textContent = "0";
  document.getElementById("cantidad-items").textContent = "0";
};
window.enviarPedido = async function () {
  const local = document.getElementById("local").value;
  const mesa = document.getElementById("mesa").value.trim();

  const items = [];
  for (const nombre in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[nombre];
    const plato = menu.find(p => p.nombre === nombre);
    if (cantidad > 0 && plato) {
      items.push({ nombre, cantidad, precio: plato.precio });
    }
  }

  if (items.length === 0 || mesa === "") {
    alert("⚠️ Selecciona al menos un plato y especifica la mesa.");
    return;
  }

  const { data, error } = await supabase
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

  if (error) {
    alert("❌ Error al guardar el pedido");
    return;
  }

  for (const item of items) {
    await supabase.from("pedido_items").insert([{
      pedido_id: data.id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio
    }]);
  }

  await cargarResumen();
  await mostrarPedidosPendientes();
};

async function mostrarPedidosPendientes() {
  const id = localStorage.getItem("usuario_id");

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, local, mesa, total, fecha")
    .eq("usuario_id", id)
    .eq("cobrado", false)
    .order("fecha", { ascending: true });

  const resumen = document.getElementById("resumen");
  resumen.innerHTML = "";

  for (const pedido of pedidos) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, cantidad, precio")
      .eq("pedido_id", pedido.id);

    const hora = new Date(pedido.fecha).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const bloque = document.createElement("div");
    bloque.innerHTML = `
      <h4>🧾 Pedido ${pedido.id.slice(0, 8)} — ${pedido.local} / Mesa ${pedido.mesa} — ${hora}</h4>
      <ul>
        ${items.map(p => `<li>${p.nombre} x${p.cantidad} = ${p.precio * p.cantidad} CUP</li>`).join("")}
      </ul>
      <p><strong>Total:</strong> ${pedido.total} CUP</p>
      <button onclick="marcarPedidoCobrado('${pedido.id}')">Cobrar este pedido</button>
    `;
    resumen.appendChild(bloque);
  }

  document.getElementById("confirmacion").style.display = "block";
}

window.marcarPedidoCobrado = async function (id) {
  const { error } = await supabase
    .from("pedidos")
    .update({ cobrado: true })
    .eq("id", id);

  if (error) {
    alert("❌ Error al marcar como cobrado");
    return;
  }

  await cargarResumen();
  await mostrarPedidosPendientes();
};

async function cargarResumen() {
  const id = localStorage.getItem("usuario_id");
  const hoy = new Date().toISOString().split("T")[0];

  const { data: pendientes } = await supabase
    .from("pedidos")
    .select("total")
    .eq("usuario_id", id)
    .eq("cobrado", false)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  const totalPendientes = pendientes?.length || 0;
  const importePendiente = pendientes?.reduce((sum, p) => sum + p.total, 0) || 0;

  document.getElementById("total-pendientes").textContent = totalPendientes;
  document.getElementById("importe-pendiente").textContent = importePendiente;

  const { data: cobrados } = await supabase
    .from("pedidos")
    .select("total")
    .eq("usuario_id", id)
    .eq("cobrado", true)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  const totalCobrados = cobrados?.length || 0;
  const importeCobrado = cobrados?.reduce((sum, p) => sum + p.total, 0) || 0;

  document.getElementById("total-cobrados").textContent = totalCobrados;
  document.getElementById("importe-cobrado").textContent = importeCobrado;
}

window.cerrarSesion = function () {
  localStorage.clear();
  location.reload();
};
