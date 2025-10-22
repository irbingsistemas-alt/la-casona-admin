import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const listaDiv = document.getElementById("lista-pedidos");
const resumenContainer = document.getElementById("lista-pedidos-container");

let pedidos = [];
let menusCocina = [];

async function cargarMenusCocina() {
  const { data, error } = await supabase
    .from("menus")
    .select("nombre")
    .eq("area", "cocina");

  if (error) {
    alert("❌ Error al cargar menú de cocina");
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
  mostrarResumenLocales();
  mostrarFiltroLocales();
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

  const resumenDiv = document.createElement("div");
  resumenDiv.innerHTML = html;
  resumenContainer.prepend(resumenDiv);
}

function mostrarFiltroLocales() {
  const locales = [...new Set(pedidos.map(p => p.local))];
  const select = document.createElement("select");
  select.id = "filtro-local";
  select.innerHTML = `<option value="todos">Todos los locales</option>`;
  locales.forEach(local => {
    const option = document.createElement("option");
    option.value = local;
    option.textContent = local;
    select.appendChild(option);
  });

  select.onchange = () => mostrarPedidos(select.value);
  resumenContainer.prepend(select);
}

async function mostrarPedidos(localSeleccionado) {
  listaDiv.innerHTML = "";

  const filtrados = pedidos.filter(p => !p.entregado && (localSeleccionado === "todos" || p.local === localSeleccionado));

  for (const pedido of filtrados) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, cantidad, subtotal")
      .eq("pedido_id", pedido.id);

    const itemsCocina = items.filter(i => menusCocina.includes(i.nombre));
    if (itemsCocina.length === 0) continue;

    let html = `<div style="display:flex; justify-content:space-between; align-items:center; border:1px solid #ccc; padding:10px; margin-bottom:10px; background:#f9f9f9;">
      <div>
        <p><strong>Local:</strong> ${pedido.local}</p>
        ${pedido.tipo === "mesa" ? `<p><strong>Mesa:</strong> ${pedido.mesa}</p>` : `
          <p><strong>Cliente:</strong> ${pedido.cliente}</p>
          <p><strong>Piso:</strong> ${pedido.piso}</p>
          <p><strong>Apto:</strong> ${pedido.apartamento}</p>`}
        <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString()}</p>
        <ul>${itemsCocina.map(i => `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`).join("")}</ul>
        <p><strong>Total cocina:</strong> ${itemsCocina.reduce((sum, i) => sum + i.subtotal, 0)} CUP</p>
      </div>
      <div>
        <button onclick="confirmarPedido(${pedido.id})">✅ Confirmar</button>
      </div>
    </div>`;

    listaDiv.innerHTML += html;
  }
}

async function confirmarPedido(id) {
  const { error } = await supabase
    .from("pedidos")
    .update({ entregado: true })
    .eq("id", id);

  if (error) {
    alert("❌ Error al confirmar pedido");
    return;
  }

  alert("✅ Pedido confirmado");
  cargarPedidos();
}

async function mostrarResumenConfirmadosDelDia() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const isoInicio = hoy.toISOString();

  const { data, error } = await supabase
    .from("pedidos")
    .select("local, total")
    .eq("entregado", true)
    .gte("fecha", isoInicio);

  if (error) {
    console.error("Error al cargar resumen diario");
    return;
  }

  const resumen = {};
  data.forEach(p => {
    if (!resumen[p.local]) {
      resumen[p.local] = { cantidad: 0, total: 0 };
    }
    resumen[p.local].cantidad += 1;
    resumen[p.local].total += p.total;
  });

  let html = "<h3>Resumen de pedidos confirmados hoy por área</h3><ul>";
  for (const local in resumen) {
    html += `<li><strong>${local}:</strong> ${resumen[local].cantidad} pedidos – ${resumen[local].total} CUP</li>`;
  }
  html += "</ul>";

  const resumenFinal = document.createElement("div");
  resumenFinal.innerHTML = html;
  listaDiv.appendChild(resumenFinal);
}

window.confirmarPedido = confirmarPedido;
cargarPedidos();
