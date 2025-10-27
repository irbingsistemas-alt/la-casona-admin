import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

let menu = [];
let usuarioAutenticado = null;
let cantidadesSeleccionadas = {}; // { menuId: cantidad }
let latestMenuFetchTs = 0;

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------- cargarResumen: recuenta pedidos del día para el usuario ---------- */
async function cargarResumen() {
  if (!usuarioAutenticado) {
    document.getElementById("fecha-resumen").textContent = "";
    document.getElementById("total-cobrados").textContent = "0";
    document.getElementById("importe-cobrado").textContent = "0.00";
    document.getElementById("total-pendientes").textContent = "0";
    document.getElementById("importe-pendiente").textContent = "0.00";
    return;
  }

  const hoy = new Date().toISOString().split("T")[0];
  try {
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("cobrado, total")
      .eq("usuario_id", usuarioAutenticado)
      .gte("fecha", `${hoy}T00:00:00`)
      .lte("fecha", `${hoy}T23:59:59`);

    if (error) {
      console.warn("Error al cargar resumen:", error);
      return;
    }

    let cobrados = 0, pendientes = 0, totalCobrado = 0, totalPendiente = 0;
    (pedidos || []).forEach(p => {
      if (p.cobrado) {
        cobrados++;
        totalCobrado += Number(p.total || 0);
      } else {
        pendientes++;
        totalPendiente += Number(p.total || 0);
      }
    });

    document.getElementById("fecha-resumen").textContent = hoy;
    document.getElementById("total-cobrados").textContent = String(cobrados);
    document.getElementById("importe-cobrado").textContent = totalCobrado.toFixed(2);
    document.getElementById("total-pendientes").textContent = String(pendientes);
    document.getElementById("importe-pendiente").textContent = totalPendiente.toFixed(2);

  } catch (err) {
    console.error("cargarResumen error:", err);
  }
}

/* ---------- cargarMenu y render (preserva cantidades) ---------- */
async function cargarMenu(force = false) {
  const now = Date.now();
  if (!force && now - latestMenuFetchTs < 2500) return;
  latestMenuFetchTs = now;

  const { data, error } = await supabase
    .from("menus")
    .select("id,nombre,precio,categoria,disponible,activo")
    .eq("disponible", true)
    .eq("activo", true)
    .order("categoria", { ascending: true });

  if (error) {
    console.warn("Error al cargar menú:", error);
    alert("❌ Error al cargar el menú.");
    return;
  }

  menu = data || [];
  const menuIds = new Set(menu.map(m => m.id));
  Object.keys(cantidadesSeleccionadas).forEach(id => {
    if (!menuIds.has(id)) delete cantidadesSeleccionadas[id];
  });

  mostrarMenuAgrupado(menu);
  actualizarFiltroCategorias(menu);
  actualizarTotalesUI();
}

function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  contenedor.innerHTML = "";

  const grupos = platos.reduce((acc, p) => {
    const cat = p.categoria || "Sin categoría";
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});

  for (const categoria of Object.keys(grupos)) {
    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";
    grupo.innerHTML = `<h3>${escapeHtml(categoria)}</h3>`;

    grupos[categoria].forEach(plato => {
      const cantidadActual = Number(cantidadesSeleccionadas[plato.id] || 0);
      const item = document.createElement("div");
      item.className = "menu-item";
      item.innerHTML = `
        <div class="nombre">${escapeHtml(plato.nombre)}</div>
        <div class="precio">${Number(plato.precio).toFixed(2)} CUP</div>
        <input
          type="number"
          min="0"
          value="${cantidadActual}"
          data-menu-id="${plato.id}"
          aria-label="Cantidad ${escapeHtml(plato.nombre)}"
        />
      `;
      const input = item.querySelector("input");
      input.addEventListener("input", (ev) => {
        const v = ev.target.value === "" ? 0 : parseInt(ev.target.value, 10) || 0;
        actualizarCantidad(plato.id, v);
      });
      grupo.appendChild(item);
    });

    contenedor.appendChild(grupo);
  }
}

function actualizarFiltroCategorias(platos) {
  const filtro = document.getElementById("filtro");
  const categorias = [...new Set(platos.map(p => p.categoria || "Sin categoría"))].sort();
  filtro.innerHTML = `<option value="todos">Todos</option>`;
  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtro.appendChild(option);
  });
}

/* ---------- actualizarCantidad y UI totals ---------- */
window.actualizarCantidad = function (menuId, cantidad) {
  const qty = parseInt(cantidad, 10) || 0;
  if (qty <= 0) {
    if (cantidadesSeleccionadas[menuId]) delete cantidadesSeleccionadas[menuId];
  } else {
    cantidadesSeleccionadas[menuId] = qty;
  }
  actualizarTotalesUI();
};

function actualizarTotalesUI() {
  const total = Object.entries(cantidadesSeleccionadas).reduce((sum, [id, qty]) => {
    const plato = menu.find(p => p.id === id);
    return sum + (plato ? Number(plato.precio) * qty : 0);
  }, 0);
  const items = Object.values(cantidadesSeleccionadas).reduce((s, v) => s + v, 0);
  const totalEl = document.getElementById("total");
  const itemsEl = document.getElementById("cantidad-items");
  if (totalEl) totalEl.textContent = total.toFixed(2);
  if (itemsEl) itemsEl.textContent = items;
}

/* ---------- mostrarPedidosPendientes y helpers básicos (declaración adelantada) ---------- */
async function mostrarPedidosPendientes() {
  const hoy = new Date().toISOString().split("T")[0];
  try {
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("id, mesa, local, total, fecha")
      .eq("usuario_id", usuarioAutenticado)
      .eq("cobrado", false)
      .gte("fecha", `${hoy}T00:00:00`)
      .lte("fecha", `${hoy}T23:59:59`)
      .order("fecha", { ascending: true });

    if (error) throw error;

    let html = "<h3>🕒 Pedidos pendientes</h3>";
    if (!pedidos || pedidos.length === 0) {
      html += "<p>No hay pedidos pendientes.</p>";
    } else {
      html += "<ul>";
      pedidos.forEach(p => {
        html += `
          <li style="margin-bottom:10px;">
            <strong>Mesa ${escapeHtml(p.mesa)}</strong> (${escapeHtml(p.local)}) – ${Number(p.total).toFixed(2)} CUP
            <div style="display:inline-block; margin-left:10px;">
              <button class="btn-principal" onclick="verDetalles('${p.id}')">Ver detalles</button>
              <button class="btn-secundario" onclick="cerrarPedido('${p.id}')">Cobrar</button>
            </div>
            <div style="color:#666; font-size:0.9rem; margin-top:4px;">${new Date(p.fecha).toLocaleString()}</div>
          </li>
        `;
      });
      html += "</ul>";
    }

    const cont = document.getElementById("pedidos-pendientes");
    if (cont) cont.innerHTML = html;
  } catch (err) {
    console.error("Error mostrarPedidosPendientes:", err);
  }
}

/* ---------- verDetalles y cerrarPedido placeholders (implementadas en Parte 2) ---------- */
window.verDetalles = async function (pedidoId) { console.warn("verDetalles placeholder"); };
window.cerrarPedido = async function (pedidoId) { console.warn("cerrarPedido placeholder"); };

/* ---------- iniciarSesion (usa las funciones ya definidas arriba) ---------- */
window.iniciarSesion = async function () {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();
  if (!usuario || !clave) {
    alert("Completa usuario y contraseña.");
    return;
  }

  const { data, error } = await supabase.rpc("login_dependiente", {
    usuario_input: usuario,
    clave_input: clave
  });

  if (error || !data) {
    alert("❌ Usuario o contraseña incorrectos.");
    return;
  }

  const perfil = Array.isArray(data) ? data[0] : data;
  if (!perfil || !perfil.rol) {
    alert("❌ Respuesta inválida del servidor.");
    return;
  }

  if (!["admin", "dependiente", "gerente"].includes(perfil.rol)) {
    alert("⚠️ Acceso denegado para este rol.");
    return;
  }

  usuarioAutenticado = perfil.id;
  localStorage.setItem("usuario_nombre", perfil.usuario);
  document.getElementById("usuario-conectado").textContent = perfil.usuario;
  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  document.getElementById("btn-recargar-menu").onclick = () => cargarMenu(true);

  await Promise.all([cargarMenu(), cargarResumen(), mostrarPedidosPendientes()]);
};
/* ---------- revisarPedido (muestra resumen con confirmación) ---------- */
window.revisarPedido = function () {
  const mesa = (document.getElementById("mesa").value || "").trim();
  if (!mesa) {
    alert("Indica número de mesa antes de revisar el pedido.");
    return;
  }
  const local = document.getElementById("local").value;
  const items = Object.entries(cantidadesSeleccionadas)
    .map(([id, qty]) => {
      const p = menu.find(m => m.id === id);
      return p ? { id, nombre: p.nombre, precio: Number(p.precio), cantidad: qty } : null;
    })
    .filter(Boolean);

  if (items.length === 0) {
    alert("Selecciona al menos un plato antes de revisar.");
    return;
  }

  const resumenBlock = document.getElementById("resumen");
  resumenBlock.innerHTML = `
    <p><strong>Mesa:</strong> ${escapeHtml(mesa)}</p>
    <p><strong>Local:</strong> ${escapeHtml(local)}</p>
    <ul>
      ${items.map(i => `<li>${escapeHtml(i.nombre)} x${i.cantidad} — ${(i.precio * i.cantidad).toFixed(2)} CUP</li>`).join("")}
    </ul>
    <p><strong>Total:</strong> ${items.reduce((s,i)=>s+(i.precio*i.cantidad),0).toFixed(2)} CUP</p>
    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="confirmar-pedido-btn" class="btn-principal">✅ Confirmar pedido</button>
      <button id="editar-pedido-btn" class="btn-secundario">✏️ Volver a editar</button>
    </div>
  `;
  document.getElementById("confirmacion").style.display = "block";

  document.getElementById("editar-pedido-btn").onclick = () => {
    document.getElementById("confirmacion").style.display = "none";
  };
  document.getElementById("confirmar-pedido-btn").onclick = () => confirmarPedido();
};

/* ---------- confirmarPedido: crea o actualiza pedido (elimina items con cantidad 0) ---------- */
async function confirmarPedido() {
  const local = document.getElementById("local").value;
  const mesa = (document.getElementById("mesa").value || "").trim().toLowerCase();
  if (!mesa) {
    alert("Indica número de mesa antes de confirmar.");
    return;
  }

  const items = Object.entries(cantidadesSeleccionadas)
    .map(([id, qty]) => {
      const p = menu.find(m => m.id === id);
      return p ? { menu_id: id, nombre: p.nombre, cantidad: Number(qty), precio: Number(p.precio) } : null;
    })
    .filter(Boolean)
    .filter(i => i.cantidad > 0);

  if (items.length === 0) {
    alert("No hay items para enviar.");
    return;
  }

  const hoy = new Date().toISOString().split("T")[0];

  try {
    const { data: existentes, error: errExist } = await supabase
      .from("pedidos")
      .select("id")
      .eq("usuario_id", usuarioAutenticado)
      .eq("local", local)
      .eq("mesa", mesa)
      .eq("cobrado", false)
      .gte("fecha", `${hoy}T00:00:00`)
      .lte("fecha", `${hoy}T23:59:59`);

    if (errExist) throw errExist;

    let pedidoId = null;
    let mensaje = "";

    if (existentes && existentes.length > 0) {
      pedidoId = existentes[0].id;
      mensaje = "✅ Pedido actualizado correctamente.";

      const { data: itemsExistentes } = await supabase
        .from("pedido_items")
        .select("id, menu_id")
        .eq("pedido_id", pedidoId);

      const existentesMap = {};
      (itemsExistentes || []).forEach(it => { existentesMap[it.menu_id] = it.id; });

      for (const it of items) {
        if (existentesMap[it.menu_id]) {
          await supabase
            .from("pedido_items")
            .update({ cantidad: it.cantidad, precio: it.precio })
            .eq("id", existentesMap[it.menu_id]);
        } else {
          await supabase.from("pedido_items").insert([{
            pedido_id: pedidoId,
            menu_id: it.menu_id,
            nombre: it.nombre,
            cantidad: it.cantidad,
            precio: it.precio
          }]);
        }
      }

      const menuIdsActual = items.map(i => i.menu_id);
      if (menuIdsActual.length > 0) {
        const { error: errDelete } = await supabase
          .from("pedido_items")
          .delete()
          .eq("pedido_id", pedidoId)
          .not("menu_id", "in", `(${menuIdsActual.map(id => `'${id}'`).join(",")})`);
        if (errDelete) console.warn("No se pudo eliminar items obsoletos:", errDelete);
      }

      const { data: actualizados } = await supabase
        .from("pedido_items")
        .select("cantidad, precio")
        .eq("pedido_id", pedidoId);

      const nuevoTotal = (actualizados || []).reduce((s, p) => s + p.cantidad * p.precio, 0);

      await supabase
        .from("pedidos")
        .update({ total: nuevoTotal })
        .eq("id", pedidoId);

    } else {
      mensaje = "🆕 Nuevo pedido creado.";
      const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

      const { data: newPedido, error: errInsert } = await supabase
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

      if (errInsert) throw errInsert;
      pedidoId = newPedido.id;

      const inserts = items.map(i => ({
        pedido_id: pedidoId,
        menu_id: i.menu_id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: i.precio
      }));
      const { error: errItems } = await supabase.from("pedido_items").insert(inserts);
      if (errItems) throw errItems;
    }

    document.getElementById("confirmacion").style.display = "block";
    document.getElementById("resumen").innerHTML = `
      <p>${mensaje}</p>
      <p><strong>Mesa:</strong> ${escapeHtml(mesa)}</p>
      <p><strong>Local:</strong> ${escapeHtml(local)}</p>
      <p><strong>Platos:</strong> ${items.map(i => `${escapeHtml(i.nombre)} (${i.cantidad})`).join(", ")}</p>
    `;

    cantidadesSeleccionadas = {};
    document.querySelectorAll("#menu input[type='number']").forEach(input => input.value = 0);
    actualizarTotalesUI();

    await cargarResumen();
    await mostrarPedidosPendientes();
    await cargarMenu(true);

  } catch (err) {
    console.error("Error en confirmarPedido:", err);
    alert("❌ Error al procesar el pedido. Revisa la consola.");
  }
}

/* ---------- verDetalles: modal con listado de items del pedido ---------- */
window.verDetalles = async function (pedidoId) {
  try {
    const { data, error } = await supabase
      .from("pedido_items")
      .select("menu_id, nombre, cantidad, precio, updated_at")
      .eq("pedido_id", pedidoId)
      .order("id", { ascending: true });

    if (error) throw error;
    const items = data || [];

    const root = document.getElementById("modal-detalle-root");
    root.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal">
          <h4>Detalles del pedido</h4>
          <ul>
            ${items.map(it => `
              <li>
                <div>
                  <strong>${escapeHtml(it.nombre)}</strong><br/>
                  <span class="meta">Cantidad: ${it.cantidad} — Precio: ${Number(it.precio).toFixed(2)} CUP</span>
                </div>
                <div class="meta">${it.updated_at ? new Date(it.updated_at).toLocaleString() : ""}</div>
              </li>
            `).join("")}
          </ul>
          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:12px;">
            <button id="modal-cerrar-btn" class="btn-secundario">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("modal-cerrar-btn").onclick = () => { root.innerHTML = ""; };

  } catch (err) {
    console.error("Error verDetalles:", err);
    alert("❌ Error al cargar detalles del pedido.");
  }
};

/* ---------- cerrarPedido: marca cobrado + registra cobrado_por y cobrado_at ---------- */
window.cerrarPedido = async function (pedidoId) {
  if (!confirm("Confirmar cobro del pedido?")) return;
  try {
    const { error } = await supabase
      .from("pedidos")
      .update({ cobrado: true, cobrado_por: usuarioAutenticado, cobrado_at: new Date().toISOString() })
      .eq("id", pedidoId);

    if (error) throw error;

    alert("✅ Pedido marcado como cobrado.");
    await cargarResumen();
    await mostrarPedidosPendientes();
    await cargarMenu(true);
  } catch (err) {
    console.error("Error cerrarPedido:", err);
    alert("❌ Error al marcar como cobrado.");
  }
}

/* ---------- utilitarios UI ---------- */
window.limpiarSeleccion = function () {
  cantidadesSeleccionadas = {};
  document.querySelectorAll("#menu input[type='number']").forEach(input => input.value = 0);
  actualizarTotalesUI();
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
