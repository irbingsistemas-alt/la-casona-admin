import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const menuDiv = document.getElementById("menu");
const filtroSelect = document.getElementById("filtro");
const cantidadesSeleccionadas = {};
let menu = [];
let dependiente = null;
let pedidoId = null;

async function iniciarSesion() {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("usuario", usuario)
    .eq("clave", clave)
    .eq("rol", "dependiente")
    .single();

  if (error || !data) {
    alert("❌ Usuario o contraseña incorrectos");
    return;
  }

  dependiente = data.nombre || usuario;
  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  await cargarMenu();
  await mostrarResumenDelDia();
  await mostrarPedidosDetalladosDelDia();
}

async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("disponible", true)
    .order("orden", { ascending: true });

  if (error) {
    alert("❌ Error al cargar el menú");
    return;
  }

  menu = data;
  const categorias = [...new Set(menu.map(item => item.categoria).filter(Boolean))];

  filtroSelect.innerHTML = '<option value="todos">Todas</option>';
  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtroSelect.appendChild(option);
  });

  mostrarMenuAgrupado(menu);
}

function mostrarMenuAgrupado(platos) {
  menuDiv.innerHTML = "";

  const agrupado = {};
  platos.forEach(item => {
    if (!agrupado[item.categoria]) agrupado[item.categoria] = [];
    agrupado[item.categoria].push(item);
  });

  for (const categoria in agrupado) {
    const grupo = agrupado[categoria];
    const grupoDiv = document.createElement("div");
    grupoDiv.className = "categoria-grupo";

    const titulo = document.createElement("h3");
    titulo.textContent = categoria;
    grupoDiv.appendChild(titulo);

    grupo.forEach(item => {
      const key = item.nombre;
      const cantidadGuardada = cantidadesSeleccionadas[key] || 0;
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `
        <label>
          <strong>${item.nombre}</strong> - ${item.precio} CUP
          <input type="number" min="0" value="${cantidadGuardada}" data-name="${item.nombre}" data-price="${item.precio}" />
        </label>
      `;
      grupoDiv.appendChild(div);
    });

    menuDiv.appendChild(grupoDiv);
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
  const seleccion = filtroSelect.value;
  if (seleccion === "todos") {
    mostrarMenuAgrupado(menu);
  } else {
    const filtrado = menu.filter(item => item.categoria === seleccion);
    mostrarMenuAgrupado(filtrado);
  }
}

function calcularTotal() {
  let total = 0;
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
  const mesa = document.getElementById("mesa").value.trim();
  const local = document.getElementById("local").value;

  if (!mesa || !local || !dependiente) {
    alert("Completa todos los campos antes de enviar");
    return;
  }

  let resumenHTML = `<p><strong>Local:</strong> ${local}<br><strong>Mesa:</strong> ${mesa}</p><ul>`;
  let total = 0;
  let items = [];

  for (const nombre in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[nombre];
    const plato = menu.find(p => p.nombre === nombre);
    if (cantidad > 0 && plato) {
      const subtotal = cantidad * plato.precio;
      resumenHTML += `<li>${nombre} x${cantidad} = ${subtotal} CUP</li>`;
      total += subtotal;
      items.push({ nombre, cantidad, subtotal });
    }
  }

  if (items.length === 0) {
    alert("Selecciona al menos un plato");
    return;
  }

  resumenHTML += `</ul><p><strong>Total:</strong> ${total} CUP</p>`;

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert([{
      local,
      mesa,
      tipo: "mesa",
      dependiente,
      fecha: new Date().toISOString(),
      total,
      entregado: false,
      cliente: null,
      piso: null,
      apartamento: null
    }])
    .select("id")
    .single();

  if (error || !pedido) {
    alert("❌ Error al guardar el pedido");
    return;
  }

  pedidoId = pedido.id;
  localStorage.setItem("pedidoResumen", resumenHTML);
  localStorage.setItem("pedidoId", pedidoId);

  for (const item of items) {
    await supabase.from("pedido_items").insert([{
      pedido_id: pedidoId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      subtotal: item.subtotal
    }]);
  }

  document.getElementById("resumen").innerHTML = resumenHTML;
  document.getElementById("confirmacion").style.display = "block";
}

async function marcarCobrado() {
  if (!pedidoId) return;

  const { error } = await supabase
    .from("pedidos")
    .update({ entregado: true })
    .eq("id", pedidoId);

  if (error) {
    alert("❌ Error al marcar como cobrado");
    return;
  }

  alert("✅ Pedido marcado como cobrado");
  localStorage.removeItem("pedidoResumen");
  localStorage.removeItem("pedidoId");
  location.reload();
}

async function mostrarResumenDelDia() {
  const hoy = new Date();
  const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const finDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString();

  const { data: pedidosHoy, error } = await supabase
    .from("pedidos")
    .select("id, total, entregado, local")
    .eq("dependiente", dependiente)
    .gte("fecha", inicioDelDia)
    .lte("fecha", finDelDia);

  if (error) {
    console.error("Error al cargar resumen del día", error);
    return;
  }

  const porEntregar = pedidosHoy.filter(p => !p.entregado);
  const cobrados = pedidosHoy.filter(p => p.entregado);

  const totalPendiente = porEntregar.reduce((sum, p) => sum + p.total, 0);
  const totalCobrado = cobrados.reduce((sum, p) => sum + p.total, 0);

const resumenHTML = `
  <h3>📋 Resumen del día</h3>

  <p><strong>Pedidos por entregar:</strong> ${porEntregar.length}</p>
  <ul>
    ${porEntregar.map(p => `<li><strong>${p.local}</strong> - ${p.total} CUP</li>`).join("")}
  </ul>
  <p><strong>Total pendiente:</strong> ${totalPendiente} CUP</p>

  <p><strong>Pedidos cobrados:</strong> ${cobrados.length}</p>
  <ul>
    ${cobrados.map(p => `<li><strong>${p.local}</strong> - ${p.total} CUP</li>`).join("")}
  </ul>
  <p><strong>Total cobrado:</strong> ${totalCobrado} CUP</p>
`;
async function mostrarResumenDelDia() {
  const hoy = new Date();
  const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const finDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString();

  const { data: pedidosHoy, error } = await supabase
    .from("pedidos")
    .select("id, total, entregado, local")
    .eq("dependiente", dependiente)
    .gte("fecha", inicioDelDia)
    .lte("fecha", finDelDia);

  if (error) {
    console.error("Error al cargar resumen del día", error);
    return;
  }

  const porEntregar = pedidosHoy.filter(p => !p.entregado);
  const cobrados = pedidosHoy.filter(p => p.entregado);

  const totalPendiente = porEntregar.reduce((sum, p) => sum + p.total, 0);
  const totalCobrado = cobrados.reduce((sum, p) => sum + p.total, 0);

  const resumenHTML = `
    <h3>📋 Resumen del día</h3>
    <p><strong>Pedidos por entregar:</strong> ${porEntregar.length}</p>
    <ul>${porEntregar.map(p => `<li><strong>${p.local}</strong> - ${p.total} CUP</li>`).join("")}</ul>
    <p><strong>Total pendiente:</strong> ${totalPendiente} CUP</p>

    <p><strong>Pedidos cobrados:</strong> ${cobrados.length}</p>
    <ul>${cobrados.map(p => `<li><strong>${p.local}</strong> - ${p.total} CUP</li>`).join("")}</ul>
    <p><strong>Total cobrado:</strong> ${totalCobrado} CUP</p>
  `;

  document.getElementById("resumen-confirmados").innerHTML = resumenHTML;
}

async function mostrarPedidosDetalladosDelDia() {
  const hoy = new Date();
  const inicioDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).toISOString();
  const finDelDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59).toISOString();

  const { data: pedidosHoy, error } = await supabase
    .from("pedidos")
    .select("id, fecha, local, mesa, total, entregado")
    .eq("dependiente", dependiente)
    .gte("fecha", inicioDelDia)
    .lte("fecha", finDelDia)
    .order("fecha", { ascending: true });

  if (error) {
    console.error("Error al cargar pedidos detallados", error);
    return;
  }

  const itemsPorPedido = {};
  for (const pedido of pedidosHoy) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, cantidad, subtotal")
      .eq("pedido_id", pedido.id);
    itemsPorPedido[pedido.id] = items || [];
  }

  let resumenHTML = `<h3>📦 Detalle de pedidos del día</h3>`;
  for (const pedido of pedidosHoy) {
    const estado = pedido.entregado ? "✅ Cobrado" : "⏳ Por entregar";
    const hora = new Date(pedido.fecha).toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' });
    const items = itemsPorPedido[pedido.id];

    resumenHTML += `
      <div style="margin-bottom:20px;">
        <p><strong>ID:</strong> ${pedido.id} | <strong>${estado}</strong></p>
        <p><strong>Hora:</strong> ${hora} | <strong>Local:</strong> ${pedido.local} | <strong>Mesa:</strong> ${pedido.mesa}</p>
        <ul>${items.map(i => `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`).join("")}</ul>
        <p><strong>Total:</strong> ${pedido.total} CUP</p>
      </div>
    `;
  }

  document.getElementById("resumen-confirmados").innerHTML += resumenHTML;
}

window.onload = async () => {
  const resumen = localStorage.getItem("pedidoResumen");
  const id = localStorage.getItem("pedidoId");

  if (resumen && id) {
    const { data, error } = await supabase
      .from("pedidos")
      .select("entregado")
      .eq("id", id)
      .single();

    if (!error && data && !data.entregado) {
      document.getElementById("resumen").innerHTML = resumen;
      document.getElementById("confirmacion").style.display = "block";
      pedidoId = id;
    }
  }
};

window.filtrarMenu = filtrarMenu;
window.enviarPedido = enviarPedido;
window.marcarCobrado = marcarCobrado;
window.iniciarSesion = iniciarSesion;
