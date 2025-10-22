import { obtenerMenu, enviarPedidoADatabase, autenticarUsuario } from './api.js';

let pedidoActual = [];
let total = 0;

function actualizarEstiloLocal() {
  const local = document.getElementById("local").value;
  document.body.setAttribute("data-local", local.toLowerCase());
}
window.actualizarEstiloLocal = actualizarEstiloLocal;

async function iniciarSesion() {
  const usuario = document.getElementById("usuario").value;
  const clave = document.getElementById("clave").value;

  const acceso = await autenticarUsuario(usuario, clave);
  if (!acceso) {
    alert("Credenciales incorrectas");
    return;
  }

  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  const menu = await obtenerMenu();
  mostrarMenu(menu);
}
window.iniciarSesion = iniciarSesion;

function mostrarMenu(menu) {
  const contenedor = document.getElementById("menu");
  contenedor.innerHTML = "";

  const categorias = [...new Set(menu.map(plato => plato.categoria))];
  const filtro = document.getElementById("filtro");
  categorias.forEach(cat => {
    const opcion = document.createElement("option");
    opcion.value = cat;
    opcion.textContent = cat;
    filtro.appendChild(opcion);
  });

  menu.forEach(plato => {
    const item = document.createElement("div");
    item.className = "menu-item";

    const label = document.createElement("label");
    const nombre = document.createElement("strong");
    nombre.textContent = plato.nombre;

    const cantidad = document.createElement("input");
    cantidad.type = "number";
    cantidad.min = "0";
    cantidad.value = "0";
    cantidad.dataset.id = plato.id;
    cantidad.dataset.nombre = plato.nombre;
    cantidad.dataset.precio = plato.precio;

    label.appendChild(nombre);
    label.appendChild(cantidad);
    item.appendChild(label);
    contenedor.appendChild(item);
  });
}

function filtrarMenu() {
  const filtro = document.getElementById("filtro").value;
  const items = document.querySelectorAll(".menu-item");

  items.forEach(item => {
    const nombre = item.querySelector("strong").textContent;
    item.style.display = filtro === "todos" || nombre.includes(filtro) ? "flex" : "none";
  });
}
window.filtrarMenu = filtrarMenu;

function enviarPedido() {
  const local = document.getElementById("local").value;
  const mesa = document.getElementById("mesa").value;
  const inputs = document.querySelectorAll(".menu-item input");

  pedidoActual = [];
  total = 0;

  inputs.forEach(input => {
    const cantidad = parseInt(input.value);
    if (cantidad > 0) {
      const nombre = input.dataset.nombre;
      const precio = parseFloat(input.dataset.precio);
      pedidoActual.push({ nombre, cantidad, precio });
      total += cantidad * precio;
    }
  });

  if (pedidoActual.length === 0 || mesa.trim() === "") {
    alert("Debe seleccionar al menos un plato y especificar la mesa.");
    return;
  }

  document.body.setAttribute("data-local", local.toLowerCase());

  const resumen = document.getElementById("resumen");
  resumen.innerHTML = `
    <p><strong>Local:</strong> ${local}</p>
    <p><strong>Mesa:</strong> ${mesa}</p>
    <ul>
      ${pedidoActual.map(p => `<li>${p.nombre} x${p.cantidad} = ${p.precio * p.cantidad} CUP</li>`).join("")}
    </ul>
    <p><strong>Total:</strong> ${total} CUP</p>
  `;

  document.getElementById("confirmacion").style.display = "block";

  enviarPedidoADatabase({ local, mesa, pedido: pedidoActual, total });
}
window.enviarPedido = enviarPedido;

function marcarCobrado() {
  document.getElementById("confirmacion").style.display = "none";
  pedidoActual = [];
  total = 0;

  const inputs = document.querySelectorAll(".menu-item input");
  inputs.forEach(input => input.value = "0");
  document.getElementById("total").textContent = "0";
}
window.marcarCobrado = marcarCobrado;
