import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // clave pública
);

let usuarioAutenticado = null;
let menu = [];
let cantidadesSeleccionadas = {};
let total = 0;
let pedidosCobrados = 0;
let importeCobrado = 0;
let pedidoActualId = null;

window.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabase.auth.getUser();
  if (data?.user?.id) {
    usuarioAutenticado = data.user.id;
    document.getElementById("login").style.display = "none";
    document.getElementById("contenido").style.display = "block";
    await cargarMenu();
    await cargarResumen();
  }
});

function actualizarEstiloLocal() {
  const local = document.getElementById("local").value;
  document.body.setAttribute("data-local", local.toLowerCase());
}
window.actualizarEstiloLocal = actualizarEstiloLocal;

async function iniciarSesion() {
  const correo = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: clave
  });

  if (error || !data.session) {
    alert("❌ Credenciales incorrectas");
    return;
  }

  usuarioAutenticado = data.user.id;
  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  await cargarMenu();
  await cargarResumen();
}
window.iniciarSesion = iniciarSesion;

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

function filtrarMenu() {
  const seleccion = document.getElementById("filtro").value;
  const grupos = document.querySelectorAll(".categoria-grupo");

  grupos.forEach(grupo => {
    const categoria = grupo.getAttribute("data-categoria");
    grupo.style.display = seleccion === "todos" || categoria === seleccion ? "block" : "none";
  });
}
window.filtrarMenu = filtrarMenu;

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

async function enviarPedido() {
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

  for (const item of items) {
    await supabase.from("pedido_items").insert([{
      pedido_id: data.id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio
    }]);
  }
}
window.enviarPedido = enviarPedido;

async function marcarCobrado() {
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

  const resumen = document.getElementById("resumen");
  resumen.innerHTML += `<p style="color:green;"><strong>✅ Pedido cobrado</strong></p>`;

  cantidadesSeleccionadas = {};
  total = 0;
  pedidoActualId = null;

  document.querySelectorAll(".menu-item input").forEach(input => input.value = "0");
  document.getElementById("total").textContent = "0";

  await cargarResumen();
}
window.marcarCobrado = marcarCobrado;

async function cargarResumen() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const { data, error } = await supabase
    .from("pedidos")
    .select("total")
    .eq("usuario_id", userId)
    .eq("cobrado", true);

  if (error || !data) return;

  pedidosCobrados = data.length;
  importeCobrado = data.reduce((sum, p) => sum + p.total, 0);

  document.getElementById("total-cobrados").textContent = pedidosCobrados;
  document.getElementById("importe-cobrado").textContent = importeCobrado;
}

function cerrarSesion() {
  supabase.auth.signOut();
  localStorage.clear();
  location.reload();
}
window.cerrarSesion = cerrarSesion;
