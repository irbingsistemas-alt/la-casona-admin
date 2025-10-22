import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Conexión directa a Supabase
const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

let usuarioAutenticado = null;
let menu = [];
let cantidadesSeleccionadas = {};
let total = 0;
let pedidosCobrados = 0;
let importeCobrado = 0;

// ✅ Restaurar sesión si existe
window.addEventListener("DOMContentLoaded", async () => {
  const id = localStorage.getItem("usuario_id");
  if (id) {
    usuarioAutenticado = id;
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
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, rol")
    .eq("usuario", usuario)
    .eq("clave", clave)
    .single();

  if (error || !data || data.rol !== "dependiente") {
    alert("❌ Credenciales incorrectas o rol no autorizado");
    return;
  }

  usuarioAutenticado = data.id;
  localStorage.setItem("usuario_id", data.id);

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

    const scroll = document.createElement("div");
    scroll.className = "menu-scroll";

    agrupado[categoria].forEach(item => {
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `
        <strong>${item.nombre}</strong>
        <small>${item.precio} CUP</small>
        <input type="number" min="0" value="0" data-name="${item.nombre}" data-price="${item.precio}" />
      `;
      scroll.appendChild(div);
    });

    grupo.appendChild(scroll);
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

async function cargarResumen() {
  const { data, error } = await supabase
    .from("pedidos")
    .select("total")
    .eq("usuario_id", usuarioAutenticado)
    .eq("cobrado", true);

  if (error || !data) return;

  pedidosCobrados = data.length;
  importeCobrado = data.reduce((sum, p) => sum + p.total, 0);

  document.getElementById("total-cobrados").textContent = pedidosCobrados;
  document.getElementById("importe-cobrado").textContent = importeCobrado;
}
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

  // Opcional: guardar los platos en tabla secundaria
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

function marcarCobrado() {
  const resumen = document.getElementById("resumen");
  resumen.innerHTML += `<p style="color:green;"><strong>✅ Pedido cobrado</strong></p>`;

  pedidosCobrados += 1;
  importeCobrado += total;

  document.getElementById("total-cobrados").textContent = pedidosCobrados;
  document.getElementById("importe-cobrado").textContent = importeCobrado;

  cantidadesSeleccionadas = {};
  total = 0;

  document.querySelectorAll(".menu-item input").forEach(input => input.value = "0");
  document.getElementById("total").textContent = "0";
}
window.marcarCobrado = marcarCobrado;

function cerrarSesion() {
  localStorage.clear();
  location.reload();
}
window.cerrarSesion = cerrarSesion;
