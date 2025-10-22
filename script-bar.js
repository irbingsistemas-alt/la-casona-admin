import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, confirmado_por_area")
      .eq("pedido_id", pedido.id);

    const tieneBarPendiente = items?.some(i =>
      menusBar.includes(i.nombre) && i.confirmado_por_area !== "bar"
    );
    if (!tieneBarPendiente) continue;

    resumen[pedido.local] = (resumen[pedido.local] || 0) + 1;
  }

  let html = "<h3>Pedidos pendientes por local (solo bar)</h3><ul>";
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

  const filtrados = pedidos.filter(p =>
    localSeleccionado === "todos" || p.local === localSeleccionado
  );

  for (const pedido of filtrados) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("id, nombre, cantidad, subtotal, confirmado_por_area")
      .eq("pedido_id", pedido.id);

    const itemsBar = items?.filter(i =>
      menusBar.includes(i.nombre) && i.confirmado_por_area !== "bar"
    ) || [];

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
    boton.addEventListener("click", () => confirmarPedido(itemsBar.map(i => i.id)));

    botonDiv.appendChild(boton);
    barra.appendChild(info);
    barra.appendChild(botonDiv);
    listaDiv.appendChild(barra);
  }

  if (listaDiv.innerHTML.trim() === "") {
    listaDiv.innerHTML = "<p>No hay pedidos pendientes del área bar.</p>";
  }
}

async function confirmarPedido(ids) {
  if (ids.length > 0) {
    await supabase
      .from("pedido_items")
      .update({ confirmado_por_area: "bar" })
      .in("id", ids);
  }

  cargarPedidos();
}

async function mostrarResumenConfirmadosDelDia() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const isoInicio = hoy.toISOString();

  const { data: pedidosConfirmados } = await supabase
    .from("pedidos")
    .select("id, local, fecha")
    .gte("fecha", isoInicio);

  const resumen = {};
  let totalPedidos = 0;
  let totalImporte = 0;

  for (const pedido of pedidosConfirmados || []) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, subtotal, confirmado_por_area")
      .eq("pedido_id", pedido.id);

    const itemsBar = items?.filter(i =>
      menusBar.includes(i.nombre) && i.confirmado_por_area === "bar"
    ) || [];

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
