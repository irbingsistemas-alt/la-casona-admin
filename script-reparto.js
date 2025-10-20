import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const lista = document.getElementById("lista-pedidos");
const resumenDiv = document.getElementById("resumen-dia");

document.getElementById("filtroFecha").addEventListener("change", mostrarResumen);

async function mostrarResumen() {
  const fechaSeleccionada = document.getElementById("filtroFecha").value;
  const pisoFiltro = document.getElementById("filtroPiso")?.value.trim().toLowerCase() || "";
  const clienteFiltro = document.getElementById("filtroCliente")?.value.trim().toLowerCase() || "";

  if (!fechaSeleccionada) {
    alert("Selecciona una fecha.");
    return;
  }

  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("fecha", fechaSeleccionada)
    .order("created_at", { ascending: false });

  if (error) {
    alert("❌ Error al cargar pedidos");
    return;
  }

  const filtrados = pedidos.filter(p => {
    const pisoOk = !pisoFiltro || (p.piso || "").toLowerCase().includes(pisoFiltro);
    const clienteOk = !clienteFiltro || (p.cliente || "").toLowerCase().includes(clienteFiltro);
    return pisoOk && clienteOk;
  });

  const entregados = filtrados.filter(p => p.entregado);
  const pendientes = filtrados.filter(p => !p.entregado);

  resumenDiv.innerHTML = `
    <h3>Resumen del ${fechaSeleccionada}</h3>
    <table>
      <tr><th>Pedidos generados</th><td>${pedidos.length}</td></tr>
      <tr><th>Pedidos entregados</th><td>${entregados.length}</td></tr>
      <tr><th>Pedidos mostrados</th><td>${filtrados.length}</td></tr>
    </table>
  `;

  lista.innerHTML = `<h4>🕒 Pendientes</h4>`;
  await mostrarPedidos(pendientes);

  if (entregados.length > 0) {
    const separador = document.createElement("hr");
    lista.appendChild(separador);
    const titulo = document.createElement("h4");
    titulo.textContent = "✅ Entregados";
    lista.appendChild(titulo);
    await mostrarPedidos(entregados, true);
  }
}

async function mostrarPedidos(pedidos, entregado = false) {
  for (const pedido of pedidos) {
    const { data: items, error } = await supabase
      .from("pedido_items")
      .select("*")
      .eq("pedido_id", pedido.id);

    const div = document.createElement("div");
    div.className = "menu-item";
    div.innerHTML = `
      <p><strong>${pedido.fecha}</strong></p>
      <p><strong>${pedido.cliente}</strong> - Piso ${pedido.piso}, Apto ${pedido.apartamento}</p>
      <ul>
        ${items.map(i => `<li>${i.nombre} x${i.cantidad} = ${i.subtotal} CUP</li>`).join("")}
      </ul>
      <p><strong>Total:</strong> ${pedido.total} CUP</p>
      ${pedido.notas ? `<p><em>Notas: ${pedido.notas}</em></p>` : ""}
      ${entregado
        ? `<p style="color:green;"><strong>Entregado ✅</strong></p>`
        : `<button onclick="marcarEntregado('${pedido.id}', this)">Marcar como entregado</button>`}
    `;
    lista.appendChild(div);
  }
}

window.marcarEntregado = async function (pedidoId, boton) {
  boton.disabled = true;
  boton.textContent = "Entregado ✅";

  const { error } = await supabase
    .from("pedidos")
    .update({ entregado: true })
    .eq("id", pedidoId);

  if (error) {
    alert("❌ Error al actualizar estado");
    boton.disabled = false;
    boton.textContent = "Marcar como entregado";
    return;
  }

  mostrarResumen();
};

window.onload = () => {
  const hoy = new Date();
  const yyyy = hoy.getFullYear();
  const mm = String(hoy.getMonth() + 1).padStart(2, "0");
  const dd = String(hoy.getDate()).padStart(2, "0");
  const hoyISO = `${yyyy}-${mm}-${dd}`;
  document.getElementById("filtroFecha").value = hoyISO;
  mostrarResumen();
};

window.addEventListener("scroll", () => {
  const btn = document.getElementById("volverArriba");
  if (btn) btn.style.display = window.scrollY > 200 ? "block" : "none";
});
