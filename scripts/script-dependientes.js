import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const supabase = createClient(
  "https://your-project-url.supabase.co",
  "your-public-anon-key"
);

let menu = [];
let usuarioAutenticado = null;
let cantidadesSeleccionadas = {};

window.iniciarSesion = async function () {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  const { data, error } = await supabase.rpc("login_dependiente", {
    usuario_input: usuario,
    clave_input: clave
  }).single();

  if (error || !data) {
    alert("❌ Usuario o contraseña incorrectos.");
    return;
  }

  usuarioAutenticado = data.id;
  localStorage.setItem("usuario_nombre", data.usuario);

  document.getElementById("usuario-conectado").textContent = data.usuario;
  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  await cargarMenu();
  await cargarResumen();
  await mostrarPedidosPendientes();
};

async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("nombre, precio, categoria")
    .eq("disponible", true)
    .order("categoria", { ascending: true });

  if (error) {
    alert("❌ Error al cargar el menú.");
    return;
  }

  menu = data;
  mostrarMenuAgrupado(menu);
  actualizarFiltroCategorias(menu);
}

function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  contenedor.innerHTML = "";
  cantidadesSeleccionadas = {};

  const grupos = {};
  platos.forEach(p => {
    if (!grupos[p.categoria]) grupos[p.categoria] = [];
    grupos[p.categoria].push(p);
  });

  for (const categoria in grupos) {
    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";
    grupo.innerHTML = `<h3>${categoria}</h3>`;

    grupos[categoria].forEach(plato => {
      const item = document.createElement("div");
      item.className = "menu-item";
      item.innerHTML = `
        <div>${plato.nombre}</div>
        <div class="precio">${plato.precio} CUP</div>
        <input type="number" min="0" value="0" onchange="actualizarCantidad('${plato.nombre}', this.value)" />
      `;
      grupo.appendChild(item);
    });

    contenedor.appendChild(grupo);
  }
}

function actualizarFiltroCategorias(platos) {
  const filtro = document.getElementById("filtro");
  const categorias = [...new Set(platos.map(p => p.categoria))];
  filtro.innerHTML = `<option value="todos">Todos</option>`;
  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtro.appendChild(option);
  });
}

window.filtrarMenu = function () {
  const seleccion = document.getElementById("filtro").value;
  if (seleccion === "todos") {
    mostrarMenuAgrupado(menu);
  } else {
    const filtrado = menu.filter(p => p.categoria === seleccion);
    mostrarMenuAgrupado(filtrado);
  }
};

window.actualizarCantidad = function (nombre, cantidad) {
  cantidadesSeleccionadas[nombre] = parseInt(cantidad);
  const total = Object.entries(cantidadesSeleccionadas).reduce((sum, [nombre, cantidad]) => {
    const plato = menu.find(p => p.nombre === nombre);
    return sum + (plato ? plato.precio * cantidad : 0);
  }, 0);
  const items = Object.values(cantidadesSeleccionadas).reduce((sum, c) => sum + c, 0);
  document.getElementById("total").textContent = total;
  document.getElementById("cantidad-items").textContent = items;
};
window.enviarPedido = async function () {
  const local = document.getElementById("local").value;
  const mesa = document.getElementById("mesa").value.trim();
  const hoy = new Date().toISOString().split("T")[0];

  const items = [];
  for (const nombre in cantidadesSeleccionadas) {
    const cantidad = cantidadesSeleccionadas[nombre];
    const plato = menu.find(p => p.nombre === nombre);
    if (cantidad > 0 && plato) {
      items.push({ nombre, cantidad, precio: plato.precio });
    }
  }

  if (items.length === 0 || mesa === "") {
    alert("⚠️ Selecciona al menos un plato y especifica la mesa.");
    return;
  }

  const { data: existentes } = await supabase
    .from("pedidos")
    .select("id")
    .eq("usuario_id", usuarioAutenticado)
    .eq("local", local)
    .eq("mesa", mesa)
    .eq("cobrado", false)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  let pedidoId;
  let mensaje = "";

  if (existentes && existentes.length > 0) {
    pedidoId = existentes[0].id;
    mensaje = "✅ Pedido actualizado correctamente.";

    for (const item of items) {
      const { data: existente } = await supabase
        .from("pedido_items")
        .select("id, cantidad")
        .eq("pedido_id", pedidoId)
        .eq("nombre", item.nombre)
        .single();

      if (existente) {
        if (item.cantidad === 0) {
          await supabase.from("pedido_items").delete().eq("id", existente.id);
        } else {
          await supabase
            .from("pedido_items")
            .update({ cantidad: item.cantidad, precio: item.precio })
            .eq("id", existente.id);
        }
      } else {
        await supabase.from("pedido_items").insert([{
          pedido_id: pedidoId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precio: item.precio
        }]);
      }
    }

    const { data: actualizados } = await supabase
      .from("pedido_items")
      .select("cantidad, precio")
      .eq("pedido_id", pedidoId);

    const nuevoTotal = actualizados.reduce((sum, p) => sum + p.cantidad * p.precio, 0);

    await supabase
      .from("pedidos")
      .update({ total: nuevoTotal })
      .eq("id", pedidoId);

  } else {
    mensaje = "🆕 Nuevo pedido creado.";
    const { data, error } = await supabase
      .from("pedidos")
      .insert([{
        local,
        mesa,
        total,
        entregado: false,
        cobrado: false,
        fecha: new Date().toISOString(),
        usuario_id: usuarioAutenticado
      }])
      .select()
      .single();

    pedidoId = data.id;

    for (const item of items) {
      await supabase.from("pedido_items").insert([{
        pedido_id: pedidoId,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precio: item.precio
      }]);
    }
  }

  document.getElementById("confirmacion").style.display = "block";
  document.getElementById("resumen").innerHTML = `
    <p>${mensaje}</p>
    <p><strong>Mesa:</strong> ${mesa}</p>
    <p><strong>Local:</strong> ${local}</p>
    <p><strong>Platos:</strong> ${items.map(i => `${i.nombre} (${i.cantidad})`).join(", ")}</p>
  `;

  document.getElementById("usuario-conectado").textContent = localStorage.getItem("usuario_nombre") || "";
  await cargarResumen();
  await mostrarPedidosPendientes();
};

window.limpiarSeleccion = function () {
  cantidadesSeleccionadas = {};
  document.querySelectorAll("#menu input[type='number']").forEach(input => input.value = 0);
  document.getElementById("total").textContent = "0";
  document.getElementById("cantidad-items").textContent = "0";
};

window.cerrarSesion = function () {
  usuarioAutenticado = null;
  localStorage.removeItem("usuario_nombre");
  document.getElementById("usuario").value = "";
  document.getElementById("clave").value = "";
  document.getElementById("login").style.display = "block";
  document.getElementById("contenido").style.display = "none";
  document.getElementById("confirmacion").style.display = "none";
  document.getElementById("resumen").innerHTML = "";
  document.getElementById("usuario-conectado").textContent = "";
};
