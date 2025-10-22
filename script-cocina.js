import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const listaDiv = document.getElementById("lista-pedidos");
const container = document.getElementById("lista-pedidos-container");

let menusCocina = [];
let pedidos = [];

async function cargarMenusCocina() {
  const { data } = await supabase
    .from("menus")
    .select("nombre")
    .eq("area", "cocina");

  menusCocina = data.map(item => item.nombre);
}

async function cargarPedidos() {
  await cargarMenusCocina();

  const { data } = await supabase
    .from("pedidos")
    .select("id, cliente, piso, apartamento, mesa, local, tipo, fecha, total, entregado")
    .order("fecha", { ascending: false });

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

  const div = document.createElement("div");
  div.innerHTML = "<h3>Pedidos sin entregar por local</h3><ul>" +
    Object.entries(resumen).map(([local, count]) => `<li><strong>${local}:</strong> ${count}</li>`).join("") +
    "</ul>";
  container.prepend(div);
}

function mostrarFiltroLocales() {
  const locales = [...new Set(pedidos.map(p => p.local))];
  const select = document.createElement("select");
  select.id = "filtro-local";
  select.innerHTML = `<option value="todos">Todos los locales</option>` +
    locales.map(local => `<option value="${local}">${local}</option>`).join("");
  select.onchange = () => mostrarPedidos(select.value);
  container.prepend(select);
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

    const totalCocina = itemsCocina.reduce((sum, i) => sum + i.subtotal, 0);

    listaDiv.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; border:1px solid #ccc; padding:10px; margin-bottom:10px; background:#f9f9f9;">
        <div>
          <p><strong>Local:</strong> ${pedido.local}</p>
          ${pedido.tipo === "mesa"
            ? `<p><strong>Mesa:</strong> ${pedido.mesa}</p>`
            : `<p><strong>Cliente:</strong> ${pedido.cliente}</p>
               <p><strong>Piso:</strong> ${pedido.piso}</p>
               <p><strong>Apto:</strong> ${pedido.apartamento}</p>`}
          <p><strong>Fecha:</strong> ${new Date(pedido.fecha).toLocaleString()}</p>
          <ul>${itemsCocina.map(i => `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`).join("")}</ul>
          <p><strong>Total cocina:</strong> ${totalCocina} CUP</p>
        </div>
        <div>
          <button onclick="confirmarPedido(${pedido.id})">✅ Confirmar</button>
        </div>
      </div>
    `;
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
  data.forEach(p => {
    if (!resumen[p.local]) resumen[p.local] = { cantidad: 0, total: 0 };
    resumen[p.local].cantidad += 1;
    resumen[p.local].total += p.total;
  });

  listaDiv.innerHTML += `
    <div style="margin-top:30px; border-top:1px solid #ccc; padding-top:10px;">
      <h3>Resumen final por área (confirmados hoy)</h3>
      <ul>${Object.entries(resumen).map(([local, r]) =>
        `<li><strong>${local}:</strong> ${r.cantidad} pedidos – ${r.total} CUP</li>`).join("")}</ul>
    </div>
  `;
}

window.confirmarPedido = confirmarPedido;
cargarPedidos();
