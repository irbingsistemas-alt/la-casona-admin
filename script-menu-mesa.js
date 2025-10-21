import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "tu-clave-publica"
);

const menuContainer = document.getElementById("menuContainer");

async function cargarMenu() {
  const { data, error } = await supabase.from("menus").select("*").eq("disponible", true);
  if (error) {
    alert("❌ Error al cargar menú");
    return;
  }

  data.forEach(item => {
    const div = document.createElement("div");
    div.innerHTML = `
      <h3>${item.nombre}</h3>
      <p>${item.descripcion}</p>
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

  const { data: menu } = await supabase.from("menus").select("*").eq("disponible", true);
  const pedido = [];

  menu.forEach(item => {
    const cantidad = parseInt(document.getElementById(`item-${item.id}`).value);
    if (cantidad > 0) {
      pedido.push({ item_id: item.id, nombre: item.nombre, cantidad });
    }
  });

  if (pedido.length === 0) {
    alert("⚠️ Selecciona al menos un producto");
    return;
  }

  const { error } = await supabase.from("pedidos").insert([{
    mesa,
    tipo: "mesa",
    pedido,
    estado: "pendiente"
  }]);

  if (error) {
    alert("❌ Error al enviar pedido");
    return;
  }

  alert("✅ Pedido enviado a cocina");
  location.reload();
}

window.onload = cargarMenu;
window.enviarPedido = enviarPedido;
