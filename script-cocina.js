import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const listaDiv = document.getElementById("lista-pedidos");
const resumenDiv = document.getElementById("resumen-locales");
const filtroSelect = document.getElementById("filtro-local");
let pedidos = [];
let menusCocina = [];

async function cargarMenusCocina() {
  const { data, error } = await supabase
    .from("menus")
    .select("nombre")
    .eq("area", "cocina");

  if (error) {
    alert("❌ Error al cargar área cocina");
    return;
  }

  menusCocina = data.map(item => item.nombre);
}

async function cargarPedidos() {
  await cargarMenusCocina();

  const { data, error } = await supabase
    .from("pedidos")
    .select("id, cliente, piso, apartamento, mesa, local, tipo, fecha, total, entregado")
    .order("fecha", { ascending: false });

  if (error) {
    alert("❌ Error al cargar pedidos");
    return;
  }

  pedidos = data;
  mostrarResumenPorLocal();
  llenarFiltroLocales();
  mostrarPedidos("todos");
}

function mostrarResumenPorLocal() {
  const resumen = {};
  pedidos.forEach(p => {
    if (!p.entregado) {
      resumen[p.local] = (resumen[p.local] || 0) + 1;
    }
  });

  let html = "<h3>Pedidos sin entregar por local</h3><ul>";
  for (const local in resumen) {
    html += `<li><strong>${local}:</strong> ${resumen[local]} pedidos</li>`;
  }
  html += "</ul>";
  resumenDiv.innerHTML = html;
}

function llenarFiltroLocales() {
  const locales = [...new Set(pedidos.map(p => p.local))];
  filtroSelect.innerHTML = '<option value="todos">Todos</option>';
  locales.forEach(local => {
    const option = document.createElement("option");
    option.value = local;
    option.textContent = local;
    filtroSelect.appendChild(option);
  });
}

async function mostrarPedidos(localSeleccionado) {
  listaDiv.innerHTML = "";

  const filtrados = pedidos.filter(p => {
    return (localSeleccionado === "todos" || p.local === localSeleccionado);
  });

  for (const pedido of filtrados) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, cantidad, subtotal")
      .eq("pedido_id", pedido.id);

    const itemsCocina = items.filter(i => menusCocina.includes(i.nombre));
    if (itemsCocina.length === 0) continue;

    let html = `<div class="pedido-box">
      <p><strong>Local:</strong> ${pedido.local}</p>
      ${pedido.tipo === "mesa" ? `<p><strong>Mesa:</strong> ${pedido.mesa}</p>` : `
        <p><strong>Cliente:</strong> ${pedido.cliente}</p>
        <p><strong>Piso:</strong> ${pedido.piso}</p>
        <p><strong>Apto:</strong> ${pedido.apartamento}</p>`}
      <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString()}</p>
      <ul>`;

    itemsCocina.forEach(i => {
      html += `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`;
    });

    html += `</ul>
      <p><strong>Total cocina:</strong> ${itemsCocina.reduce((sum, i) => sum + i.subtotal, 0)} CUP</p>
      <p><strong>Estado:</strong> ${pedido.entregado ? "✅ Entregado" : "🕒 Pendiente"}</p>
    </div>`;

    listaDiv.innerHTML += html;
  }

  mostrarTotalesPorArea(filtrados);
}

function mostrarTotalesPorArea(pedidosFiltrados) {
  let totalEntregado = 0;

  pedidosFiltrados.forEach(p => {
    if (p.entregado) {
      totalEntregado += p.total;
    }
  });

  listaDiv.innerHTML += `<div style="margin-top:20px; border-top:1px solid #ccc; padding-top:10px;">
    <h3>Total entregado en esta área:</h3>
    <p><strong>${totalEntregado} CUP</strong></p>
  </div>`;
}

function filtrarPorLocal() {
  const seleccion = filtroSelect.value;
  mostrarPedidos(seleccion);
}

cargarPedidos();
