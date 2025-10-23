import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

let usuarioAutenticado = null;
let menu = [];
let cantidadesSeleccionadas = {};
let total = 0;
let pedidoActualId = null;

window.addEventListener("DOMContentLoaded", async () => {
  const id = localStorage.getItem("usuario_id");
  if (id) {
    usuarioAutenticado = id;
    document.getElementById("login").style.display = "none";
    document.getElementById("contenido").style.display = "block";
    await cargarMenu();
    await cargarResumen();

    const pendiente = localStorage.getItem("pedido_pendiente");
    if (pendiente) {
      pedidoActualId = pendiente;
      await mostrarPedidoPendiente(pendiente);
    }
  }
});

window.actualizarEstiloLocal = function () {
  const local = document.getElementById("local").value;
  document.body.setAttribute("data-local", local.toLowerCase());
};

window.iniciarSesion = async function () {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

const { data, error } = await supabase.rpc("login_dependiente", {
  usuario_input: usuario,
  clave_input: clave
}).single();

if (error || !data || data.rol !== "dependiente") {
  alert("❌ Credenciales incorrectas o rol no autorizado");
  console.error("Login error:", error);
  return;
}

usuarioAutenticado = data.id;
localStorage.setItem("usuario_id", data.id);

  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  await cargarMenu();
  await cargarResumen();
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

  const filtro = document.getElementById("filtro");
  filtro.innerHTML = '<option value="todos">Todos</option>';

  const agrupado = {};
  platos.forEach(p => {
    if (!agrupado[p.categoria]) {
      agrupado[p.categoria] = [];
      const option = document.createElement("option");
      option.value = p.categoria;
      option.textContent = p.categoria;
      filtro.appendChild(option);
    }
    agrupado[p.categoria].push(p);
  });

  for (const categoria in agrupado) {
    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";
    grupo.setAttribute("data-categoria", categoria);

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

window.filtrarMenu = function () {
  const seleccion = document.getElementById("filtro").value;
  const grupos = document.querySelectorAll(".categoria-grupo");

  grupos.forEach(grupo => {
    const categoria = grupo.getAttribute("data-categoria");
    grupo.style.display = seleccion === "todos" || categoria === seleccion ? "block" : "none";
  });
};

function calcularTotal() {
  total = 0;
  for (const nombre in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[nombre];
    const plato = menu.find(p => p.nombre === nombre);
    if (plato && cantidad > 0) {
      total += cantidad * plato.precio;
    }
  }
  document.getElementById("total").textContent = total;
}
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
    console.error(error);
    return;
  }

  pedidoActualId = data.id;
  localStorage.setItem("pedido_pendiente", data.id);

  for (const item of items) {
    await supabase.from("pedido_items").insert([{
      pedido_id: data.id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio
    }]);
  }

  mostrarResumenPedido(data.local, data.mesa, items, data.total);
};

function mostrarResumenPedido(local, mesa, items, total) {
  const resumen = document.getElementById("resumen");
  resumen.innerHTML = `
    <p><strong>Local:</strong> ${local}</p>
    <p><strong>Mesa:</strong> ${mesa}</p>
    <ul>
      ${items.map(p => `<li>${p.nombre} x${p.cantidad} = ${p.precio * p.cantidad} CUP</li>`).join("")}
    </ul>
    <p><strong>Total:</strong> ${total} CUP</p>
  `;
  document.getElementById("confirmacion").style.display = "block";
}

async function mostrarPedidoPendiente(id) {
  const { data, error } = await supabase
    .from("pedidos")
    .select("local, mesa, total")
    .eq("id", id)
    .eq("cobrado", false)
    .single();

  if (error || !data) return;

  const { data: items } = await supabase
    .from("pedido_items")
    .select("nombre, cantidad, precio")
    .eq("pedido_id", id);

  mostrarResumenPedido(data.local, data.mesa, items, data.total);
}

window.marcarCobrado = async function () {
  if (!pedidoActualId) {
    alert("⚠️ No hay pedido activo para cobrar.");
    return;
  }

  const { error } = await supabase
    .from("pedidos")
    .update({ cobrado: true })
    .eq("id", pedidoActualId);

  if (error) {
    alert("❌ Error al marcar como cobrado");
    console.error(error);
    return;
  }

  localStorage.removeItem("pedido_pendiente");
  pedidoActualId = null;

  const resumen = document.getElementById("resumen");
  resumen.innerHTML += `<p style="color:green;"><strong>✅ Pedido cobrado</strong></p>`;

  cantidadesSeleccionadas = {};
  total = 0;
  document.querySelectorAll(".menu-item input").forEach(input => input.value = "0");
  document.getElementById("total").textContent = "0";

  await cargarResumen();
};

async function cargarResumen() {
  const id = localStorage.getItem("usuario_id");

  const { data, error } = await supabase
    .from("pedidos")
    .select("total")
    .eq("usuario_id", id)
    .eq("cobrado", true);

  if (error || !data) return;

  const pedidosCobrados = data.length;
  const importeCobrado = data.reduce((sum, p) => sum + p.total, 0);

  document.getElementById("total-cobrados").textContent = pedidosCobrados;
  document.getElementById("importe-cobrado").textContent = importeCobrado;
}

window.cerrarSesion = function () {
  localStorage.clear();
  location.reload();
};
