import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const menuDiv = document.getElementById("menu");
const filtroSelect = document.getElementById("filtro");
const cantidadesSeleccionadas = {};
let menu = [];

async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("disponible", true)
    .order("orden", { ascending: true });

  if (error) {
    alert("❌ Error al cargar el menú");
    return;
  }

  menu = data;
  const categorias = [...new Set(menu.map(item => item.categoria).filter(Boolean))];

  filtroSelect.innerHTML = '<option value="todos">Todas</option>';
  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtroSelect.appendChild(option);
  });

  mostrarMenuAgrupado(menu);
}

function mostrarMenuAgrupado(platos) {
  menuDiv.innerHTML = "";

  const agrupado = {};
  platos.forEach(item => {
    if (!agrupado[item.categoria]) agrupado[item.categoria] = [];
    agrupado[item.categoria].push(item);
  });

  for (const categoria in agrupado) {
    const grupo = agrupado[categoria];
    const grupoDiv = document.createElement("div");
    grupoDiv.className = "categoria-grupo";

    const titulo = document.createElement("h3");
    titulo.textContent = categoria;
    grupoDiv.appendChild(titulo);

    grupo.forEach(item => {
      const key = item.nombre;
      const cantidadGuardada = cantidadesSeleccionadas[key] || 0;
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `
        <label>
          <strong>${item.nombre}</strong> - ${item.precio} CUP
          <input type="number" min="0" value="${cantidadGuardada}" data-name="${item.nombre}" data-price="${item.precio}" />
        </label>
      `;
      grupoDiv.appendChild(div);
    });

    menuDiv.appendChild(grupoDiv);
  }

  document.querySelectorAll("input[type='number']").forEach(input => {
    input.addEventListener("input", () => {
      const nombre = input.dataset.name;
      const cantidad = parseInt(input.value) || 0;
      cantidadesSeleccionadas[nombre] = cantidad;
      calcularTotal();
    });
  });

  calcularTotal();
}

function filtrarMenu() {
  const seleccion = filtroSelect.value;
  if (seleccion === "todos") {
    mostrarMenuAgrupado(menu);
  } else {
    const filtrado = menu.filter(item => item.categoria === seleccion);
    mostrarMenuAgrupado(filtrado);
  }
}

function calcularTotal() {
  let total = 0;
  for (const nombre in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[nombre];
    const plato = menu.find(p => p.nombre === nombre);
    if (plato && cantidad > 0) {
      total += cantidad * plato.precio;
    }
  }
  document.getElementById("total").textContent = total;
}

async function enviarPedido() {
  const cliente = document.getElementById("cliente").value.trim();
  const piso = document.getElementById("piso").value.trim();
  const apartamento = document.getElementById("apartamento").value.trim();

  if (!cliente || !piso || !apartamento) {
    alert("Por favor, completa nombre, piso y apartamento");
    return;
  }

  let resumenHTML = `<p><strong>Cliente:</strong> ${cliente}<br><strong>Piso:</strong> ${piso}<br><strong>Apartamento:</strong> ${apartamento}</p><ul>`;
  let mensaje = `Pedido para: ${cliente}\nPiso: ${piso}\nApartamento: ${apartamento}\n\n`;
  let total = 0;
  let items = [];

  for (const nombre in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[nombre];
    const plato = menu.find(p => p.nombre === nombre);
    if (cantidad > 0 && plato) {
      const subtotal = cantidad * plato.precio;
      mensaje += `- ${nombre} x${cantidad} = ${subtotal} CUP\n`;
      resumenHTML += `<li>${nombre} x${cantidad} = ${subtotal} CUP</li>`;
      total += subtotal;
      items.push({ nombre, cantidad, subtotal });
    }
  }

  if (items.length === 0) {
    alert("Selecciona al menos un plato");
    return;
  }

  mensaje += `\nTotal: ${total} CUP`;
  resumenHTML += `</ul><p><strong>Total:</strong> ${total} CUP</p>`;

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert([{
      cliente,
      piso,
      apartamento,
      fecha: new Date().toISOString(),
      total,
      entregado: false
    }])
    .select()
    .single();

  if (error) {
    alert("❌ Error al guardar el pedido");
    return;
  }

  for (const item of items) {
    await supabase.from("pedido_items").insert([{
      pedido_id: pedido.id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      subtotal: item.subtotal
    }]);
  }

  document.getElementById("resumen").innerHTML = resumenHTML;
  document.getElementById("confirmacion").style.display = "block";
  window.mensajeWhatsApp = mensaje;
}

function enviarWhatsApp() {
  const numero = "5350971023";
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(window.mensajeWhatsApp)}`;
  window.open(url, "_blank");
  document.getElementById("confirmacion").style.display = "none";
}

function cancelar() {
  document.getElementById("confirmacion").style.display = "none";
}

window.filtrarMenu = filtrarMenu;
window.enviarPedido = enviarPedido;
window.enviarWhatsApp = enviarWhatsApp;
window.cancelar = cancelar;

cargarMenu();
