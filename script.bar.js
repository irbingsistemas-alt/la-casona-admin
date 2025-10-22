import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const listaDiv = document.getElementById("lista-pedidos");
const resumenDiv = document.getElementById("resumen-locales");
const filtroSelect = document.getElementById("filtro-local");
const resumenFinal = document.getElementById("resumen-confirmados");

let menusBar = [];
let pedidos = [];

async function cargarMenusBar() {
  const { data } = await supabase
    .from("menus")
    .select("nombre")
    .eq("area", "bar");

  menusBar = data?.map(item => item.nombre) || [];
}

async function cargarPedidos() {
  await cargarMenusBar();

  const { data } = await supabase
    .from("pedidos")
    .select("id, cliente, piso, apartamento, mesa, local, tipo, fecha, total, entregado")
    .order("fecha", { ascending: false });

  pedidos = data || [];
  await mostrarResumenLocales();
  llenarFiltroLocales();
  mostrarPedidos("todos");
  await mostrarResumenConfirmadosDelDia();
}

async function mostrarResumenLocales() {
  const resumen = {};

  for (const pedido of pedidos || []) {
    if (pedido.entregado) continue;

    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre")
      .eq("pedido_id", pedido.id);

    const tieneBar = items?.some(i => menusBar.includes(i.nombre));
    if (!tieneBar) continue;

    resumen[pedido.local] = (resumen[pedido.local] || 0) + 1;
  }

  let html = "<h3>Pedidos sin entregar por local (solo bar)</h3><ul>";
  for (const local in resumen) {
    html += `<li><strong>${local}:</strong> ${resumen[local]} pedidos</li>`;
  }
  html += "</ul>";
  resumenDiv.innerHTML = html;
}

function llenarFiltroLocales() {
  const locales = [...new Set(pedidos.map(p => p.local))];
  filtroSelect.innerHTML = `<option value="todos">Todos</option>`;
  locales.forEach(local => {
    const option = document.createElement("option");
    option.value = local;
    option.textContent = local;
    filtroSelect.appendChild(option);
  });
}

function filtrarPorLocal() {
  const seleccion = filtroSelect.value;
  mostrarPedidos(seleccion);
}

async function mostrarPedidos(localSeleccionado) {
  listaDiv.innerHTML = "";

  const filtrados = pedidos.filter(p => !p.entregado && (localSeleccionado === "todos" || p.local === localSeleccionado));

  for (const pedido of filtrados) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, cantidad, subtotal")
      .eq("pedido_id", pedido.id);

    const itemsBar = items?.filter(i => menusBar.includes(i.nombre)) || [];
    if (itemsBar.length === 0) continue;

    const totalBar = itemsBar.reduce((sum, i) => sum + i.subtotal, 0);

    const barra = document.createElement("div");
    barra.className = "pedido-barra";

    const info = document.createElement("div");
    info.className = "pedido-info";
    info.innerHTML = `
      <p><strong>Local:</strong> ${pedido.local}</p>
      ${pedido.tipo === "mesa"
        ? `<p><strong>Mesa:</strong> ${pedido.mesa}</p>`
        : `<p><strong>Cliente:</strong> ${pedido.cliente}</p>
           <p><strong>Piso:</strong> ${pedido.piso}</p>
           <p><strong>Apto:</strong> ${pedido.apartamento}</p>`}
      <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString()}</p>
      <ul>${itemsBar.map(i => `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`).join("")}</ul>
      <p><strong>Total bar:</strong> ${totalBar} CUP</p>
    `;

    const botonDiv = document.createElement("div");
    botonDiv.className = "pedido-boton";

    const boton = document.createElement("button");
    boton.textContent = "✅ Confirmar";
    boton.addEventListener("click", () => confirmarPedido(pedido.id));

    botonDiv.appendChild(boton);
    barra.appendChild(info);
    barra.appendChild(botonDiv);
    listaDiv.appendChild(barra);
  }
}

async function confirmarPedido(id) {
  await supabase
    .from("pedidos")
    .update({ entregado: true })
    .eq("id", id);

  cargarPedidos();
}

async function mostrarResumenConfirmadosDelDia() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const isoInicio = hoy.toISOString();

  const { data: pedidosConfirmados } = await supabase
    .from("pedidos")
    .select("id, local, fecha, entregado")
    .eq("entregado", true)
    .gte("fecha", isoInicio);

  const resumen = {};
  let totalPedidos = 0;
  let totalImporte = 0;

  for (const pedido of pedidosConfirmados || []) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, subtotal")
      .eq("pedido_id", pedido.id);

    const itemsBar = items?.filter(i => menusBar.includes(i.nombre)) || [];
    if (itemsBar.length === 0) continue;

    const totalBar = itemsBar.reduce((sum, i) => sum + i.subtotal, 0);

    if (!resumen[pedido.local]) resumen[pedido.local] = { cantidad: 0, total: 0 };
    resumen[pedido.local].cantidad += 1;
    resumen[pedido.local].total += totalBar;

    totalPedidos += 1;
    totalImporte += totalBar;
  }

  let html = "<h3>Resumen de pedidos confirmados hoy por área (solo bar)</h3><ul>";
  for (const local in resumen) {
    html += `<li><strong>${local}:</strong> ${resumen[local].cantidad} pedidos – ${resumen[local].total} CUP</li>`;
  }
  html += `</ul><p><strong>Total general:</strong> ${totalPedidos} pedidos – ${totalImporte} CUP</p>`;
  resumenFinal.innerHTML = html;
}

window.filtrarPorLocal = filtrarPorLocal;
cargarPedidos();
