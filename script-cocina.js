const supabase = supabase.createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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

  filtroSelect.addEventListener("change", () => {
    mostrarPedidos(filtroSelect.value);
  });
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
      <ul>${itemsCocina.map(i => `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`).join("")}</ul>
      <p><strong>Total cocina:</strong> ${totalCocina} CUP</p>
    `;

    const boton = document.createElement("button");
    boton.textContent = "✅ Confirmar";
    boton.addEventListener("click", () => confirmarPedido(pedido.id));

    const botonDiv = document.createElement("div");
    botonDiv.className = "pedido-boton";
    botonDiv.appendChild(boton);

    barra.appendChild(info);
    barra.appendChild(botonDiv);
    listaDiv.appendChild(barra);
  }
}

async function confirmarPedido(id) {
  const { error } = await supabase
    .from("pedidos")
    .update({ entregado: true })
    .eq("id", id);

  if (error) {
    alert("Error al confirmar pedido: " + error.message);
  } else {
    cargarPedidos();
  }
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

  let html = "<h3>Resumen de pedidos confirmados hoy por área</h3><ul>";
  for (const local in resumen) {
    html += `<li><strong>${local}:</strong> ${resumen[local].cantidad} pedidos – ${resumen[local].total} CUP</li>`;
  }
  html += "</ul>";
  resumenFinal.innerHTML = html;
}

cargarPedidos();
