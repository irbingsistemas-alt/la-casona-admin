import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const menuContainer = document.getElementById("menuContainer");

async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("disponible", true);

  if (error || !data) {
    alert("❌ Error al cargar el menú");
    return;
  }

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "item-menu";
    div.innerHTML = `
      <h3>${item.nombre}</h3>
      <p>${item.descripcion || ""}</p>
      <p><strong>${item.precio} CUP</strong></p>
      <input type="number" min="0" placeholder="Cantidad" id="item-${item.id}" />
    `;
    menuContainer.appendChild(div);
  });
}

async function enviarPedido() {
  const mesa = document.getElementById("mesa").value.trim();
  if (!mesa) {
    alert("⚠️ Ingresa el número de mesa");
    return;
  }

  const { data: menu, error } = await supabase
    .from("menus")
    .select("*")
    .eq("disponible", true);

  if (error || !menu) {
    alert("❌ No se pudo cargar el menú");
    return;
  }

  let total = 0;
  const resumen = [];

  menu.forEach(item => {
    const cantidad = parseInt(document.getElementById(`item-${item.id}`).value);
    if (cantidad > 0) {
      const subtotal = item.precio * cantidad;
      total += subtotal;
      resumen.push(`${cantidad} x ${item.nombre}`);
    }
  });

  if (resumen.length === 0) {
    alert("⚠️ Selecciona al menos un producto");
    return;
  }

  const { error: insertError } = await supabase.from("pedidos").insert([{
    fecha: new Date().toISOString(),
    total,
    entregado: false,
    tipo: "mesa",
    mesa,
    cliente: resumen.join(", "),
    piso: null,
    apartamento: null
  }]);

  if (insertError) {
    alert("❌ Error al enviar el pedido");
    return;
  }

  alert("✅ Pedido enviado a cocina");
  location.reload();
}

window.onload = cargarMenu;
window.enviarPedido = enviarPedido;
