import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const listaDiv = document.getElementById("lista-pedidos");
const resumenDiv = document.getElementById("resumen-locales");
const filtroSelect = document.getElementById("filtro-local");
const resumenFinal = document.getElementById("resumen-confirmados");

let menusCocina = [];
let pedidos = [];

async function cargarMenusCocina() {
  const { data } = await supabase
    .from("menus")
    .select("nombre")
    .eq("area", "cocina");

  menusCocina = data?.map(item => item.nombre) || [];
}

async function cargarPedidos() {
  await cargarMenusCocina();

  const { data } = await supabase
    .from("pedidos")
    .select("id, cliente, piso, apartamento, mesa, local, tipo, fecha, total, entregado")
    .order("fecha", { ascending: false });

  pedidos = data || [];
  mostrarResumenLocales();
  llenarFiltroLocales();
  mostrarPedidos("todos");
  mostrarResumenConfirmadosDelDia();
}

function mostrarResumenLocales() {
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

    const itemsCocina = items?.filter(i => menusCocina.includes(i.nombre)) || [];
    if (itemsCocina.length === 0) continue;

    const totalCocina = itemsCocina.reduce((sum, i) => sum + i.subtotal, 0);

    const contenedor = document.createElement("div");
    contenedor.style.border = "1px solid #ccc";
    contenedor.style.padding = "10px";
    contenedor.style.marginBottom = "10px";
    contenedor.style.backgroundColor = "#f9f9f9";

    const info = document.createElement("div");
    info.innerHTML = `
      <p><strong>Local:</strong> ${pedido.local}</p>
      ${pedido.tipo === "mesa"
        ? `<p><strong>Mesa:</strong> ${pedido.mesa}</p>`
        : `<p><strong>Cliente:</strong> ${pedido.cliente}</p>
           <p><strong>Piso:</strong> ${pedido.piso}</p>
           <p><strong>Apto:</strong> ${pedido.apartamento}</p>`}
      <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString()}</p>
      <ul>${itemsCocina.map(i => `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`).join("")}</ul>
      <p><strong>Total cocina:</strong> ${totalCocina} CUP</p>
    `;

    const boton = document.createElement("button");
    boton.textContent = "✅ Confirmar";
    boton.style.marginTop = "10px";
    boton.addEventListener("click", () => confirmarPedido(pedido.id));

    contenedor.appendChild(info);
    contenedor.appendChild(boton);
    listaDiv.appendChild(contenedor);
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

  const { data } = await supabase
    .from("pedidos")
    .select("local, total")
    .eq("entregado", true)
    .gte("fecha", isoInicio);

  const resumen = {};
  (data || []).forEach(p => {
    if (!resumen[p.local]) resumen[p.local] = { cantidad: 0, total: 0 };
    resumen[p.local].cantidad += 1;
    resumen[p.local].total += p.total;
  });

  let html = "<h3>Resumen de pedidos confirmados hoy por área</h3><ul>";
  for (const local in resumen) {
    html += `<li><strong>${local}:</strong> ${resumen[local].cantidad} pedidos – ${resumen[local].total} CUP</li>`;
  }
  html += "</ul>";
  resumenFinal.innerHTML = html;
}
