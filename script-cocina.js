import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const contenedor = document.getElementById("lista-pedidos");

async function cargarPedidos() {
  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("entregado", false)
    .order("fecha", { ascending: true });

  if (error) {
    contenedor.innerHTML = "<p>Error al cargar pedidos</p>";
    return;
  }

  contenedor.innerHTML = "";

  for (const pedido of pedidos) {
    const { data: items } = await supabase
      .from("pedido_items")
      .select("nombre, cantidad")
      .eq("pedido_id", pedido.id);

    const div = document.createElement("div");
    div.className = "pedido-cocina";
    div.innerHTML = `
      <h3>🧑‍🍳 ${pedido.cliente} - Piso ${pedido.piso}, Apto ${pedido.apartamento}</h3>
      <p><strong>Hora:</strong> ${new Date(pedido.fecha).toLocaleTimeString()}</p>
      <ul>
        ${items.map(item => `<li>${item.nombre} x${item.cantidad}</li>`).join("")}
      </ul>
      <button class="entregar-btn" data-id="${pedido.id}">✅ Marcar como entregado</button>
    `;
    contenedor.appendChild(div);
  }

  document.querySelectorAll(".entregar-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const { error } = await supabase
        .from("pedidos")
        .update({ entregado: true })
        .eq("id", id);

      if (error) {
        alert("❌ Error al marcar como entregado");
      } else {
        btn.parentElement.remove(); // Elimina el pedido de la vista
      }
    });
  });
}

cargarPedidos();
