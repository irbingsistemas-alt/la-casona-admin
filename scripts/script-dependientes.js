import {
  obtenerMenu,
  enviarPedidoADatabase,
  autenticarUsuario,
  obtenerResumenDelDia
} from './api.js';

let pedidoActual = [];
let total = 0;
let pedidosCobrados = 0;
let importeCobrado = 0;
let usuarioAutenticado = null;
let menu = [];
let cantidadesSeleccionadas = {};

function actualizarEstiloLocal() {
  const local = document.getElementById("local").value;
  document.body.setAttribute("data-local", local.toLowerCase());
}
window.actualizarEstiloLocal = actualizarEstiloLocal;

async function iniciarSesion() {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  const id = await autenticarUsuario(usuario, clave);
  if (!id) {
    alert("❌ Credenciales incorrectas o rol no autorizado");
    return;
  }

  usuarioAutenticado = id;
  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  menu = await obtenerMenu();
  mostrarMenuAgrupado(menu);

  const resumen = await obtenerResumenDelDia(usuarioAutenticado);
  document.getElementById("total-cobrados").textContent = resumen.cantidad;
  document.getElementById("importe-cobrado").textContent = resumen.total;
}
window.iniciarSesion = iniciarSesion;

function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  contenedor.innerHTML = "";

  const categorias = [...new Set(platos.map(p => p.categoria).filter(Boolean))];
  const filtro = document.getElementById("filtro");
  filtro.innerHTML = '<option value="todos">Todos</option>';
  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtro.appendChild(option);
  });

  const agrupado = {};
  platos.forEach(item => {
    if (!agrupado[item.categoria]) agrupado[item.categoria] = [];
    agrupado[item.categoria].push(item);
  });

  for (const categoria in agrupado) {
    const grupoDiv = document.createElement("div");
    grupoDiv.className = "categoria-grupo";

    const titulo = document.createElement("h3");
    titulo.textContent = categoria;
    grupoDiv.appendChild(titulo);

    agrupado[categoria].forEach(item => {
      const div = document.createElement("div");
      div.className = "menu-item";

      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${item.nombre}</strong>
          <input type="number" min="0" value="0" data-name="${item.nombre}" data-price="${item.precio}" />
        </div>
        <small>${item.precio} CUP</small>
      `;

      grupoDiv.appendChild(div);
    });

    contenedor.appendChild(grupoDiv);
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

  await enviarPedidoADatabase({
    local,
    mesa,
    pedido: items,
    total,
    usuario_id: usuarioAutenticado
  });
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
