import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

let menu = [];
let usuarioAutenticado = null;
window.addEventListener("load", () => {
  const id = localStorage.getItem("usuario_id");
  const nombre = localStorage.getItem("usuario_nombre");
  const rol = localStorage.getItem("rol");

  if (id && nombre && rol) {
    console.log("🔄 Restaurando sesión desde localStorage…");
    usuarioAutenticado = id;
    document.getElementById("usuario-conectado").textContent = nombre;
    document.getElementById("login").style.display = "none";
    document.getElementById("contenido").style.display = "block";

    const btnRec = document.getElementById("btn-recargar-menu");
    if (btnRec) btnRec.onclick = () => cargarMenu(true);

    cargarMenu();
    cargarResumen();
    mostrarPedidosPendientes();
  } else {
    console.log("ℹ️ No hay sesión activa en localStorage.");
  }
});
let cantidadesSeleccionadas = {};
let latestMenuFetchTs = 0;

function escapeHtml(text = "") {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.iniciarSesion = async function () {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  console.log("📥 Usuario ingresado:", usuario);
  console.log("📥 Clave ingresada:", clave);

  if (!usuario || !clave) {
    alert("Completa usuario y contraseña.");
    return;
  }

  try {
    const { data, error } = await supabase.rpc("login_dependiente", {
      usuario_input: usuario,
      clave_input: clave
    });

    console.log("📡 Resultado RPC login_dependiente:", { data, error });

    if (error || !data) {
      alert("❌ Usuario o contraseña incorrectos.");
      return;
    }

    const perfil = Array.isArray(data) ? data[0] : data;
    console.log("👤 Perfil recibido:", perfil);

    if (!perfil || !["admin", "dependiente", "gerente"].includes(perfil.rol)) {
      alert("⚠️ Acceso denegado para este rol.");
      return;
    }

    // 🧠 Persistencia en localStorage
    usuarioAutenticado = perfil.id;
    localStorage.setItem("usuario_id", perfil.id);
    localStorage.setItem("usuario_nombre", perfil.usuario);
    localStorage.setItem("rol", perfil.rol);

    // 🖥️ Actualiza interfaz
    document.getElementById("usuario-conectado").textContent = perfil.usuario;
    document.getElementById("login").style.display = "none";
    document.getElementById("contenido").style.display = "block";

    const btnRec = document.getElementById("btn-recargar-menu");
    if (btnRec) btnRec.onclick = () => cargarMenu(true);

    console.log("✅ Login exitoso. Cargando menú y resumen…");

    await Promise.all([
      cargarMenu(),
      cargarResumen(),
      mostrarPedidosPendientes()
    ]);

    console.log("✅ Datos cargados correctamente tras login.");

    // 🎉 Saludo dinámico
    const saludo = document.getElementById("mensaje-bienvenida");
    if (saludo) {
      const hora = new Date().toLocaleTimeString();
      const rolTexto = perfil.rol === "admin"
        ? "Panel administrativo activo."
        : perfil.rol === "gerente"
        ? "Gestión operativa disponible."
        : "¡Listo para tomar pedidos!";
      document.getElementById("saludo-usuario").textContent = `👋 Bienvenido, ${escapeHtml(perfil.usuario)}.`;
      document.getElementById("saludo-rol").textContent = `Tu rol: ${escapeHtml(perfil.rol)} — ${rolTexto}`;
      document.getElementById("saludo-hora").textContent = `Acceso registrado a las ${hora}.`;
      saludo.style.display = "block";
    }
  } catch (err) {
    console.error("❌ Error inesperado en iniciarSesion:", err);
    alert("Error inesperado al iniciar sesión. Revisa la consola.");
  }
};
window.cerrarSesion = function () {
  console.log("🔒 Cerrando sesión…");

  usuarioAutenticado = null;
  cantidadesSeleccionadas = {};

  // 🧹 Limpieza de localStorage
  localStorage.removeItem("usuario_id");
  localStorage.removeItem("usuario_nombre");
  localStorage.removeItem("rol");

  // 🧼 Limpieza de campos y UI
  document.getElementById("usuario").value = "";
  document.getElementById("clave").value = "";
  document.getElementById("usuario-conectado").textContent = "";
  document.getElementById("contenido").style.display = "none";
  document.getElementById("login").style.display = "block";
  document.getElementById("menu").innerHTML = "";
  document.getElementById("resumen").innerHTML = "";
  document.getElementById("confirmacion").style.display = "none";
  document.getElementById("pedidos-pendientes").innerHTML = "";

  actualizarTotalesUI();

  // ✅ Confirmación visual
  alert("Sesión cerrada correctamente.");
};

function actualizarTotalesUI() {
  const total = Object.entries(cantidadesSeleccionadas).reduce((sum, [id, qty]) => {
    const plato = menu.find(p => p.id === id);
    return sum + (plato ? Number(plato.precio) * qty : 0);
  }, 0);

  const items = Object.values(cantidadesSeleccionadas).reduce((s, v) => s + v, 0);
  document.getElementById("total").textContent = total.toFixed(2);
  document.getElementById("cantidad-items").textContent = items;
}

window.limpiarSeleccion = function () {
  cantidadesSeleccionadas = {};
  document.querySelectorAll("#menu input[type='number']").forEach(input => input.value = 0);
  actualizarTotalesUI();
};
async function cargarMenu(force = false) {
  const now = Date.now();
  if (!force && now - latestMenuFetchTs < 2500) return;
  latestMenuFetchTs = now;

  const contenedor = document.getElementById("menu");
  if (contenedor) {
    contenedor.innerHTML = "<p style='padding:1em;'>⏳ Cargando menú…</p>";
  }

  const { data, error } = await supabase
    .from("menus")
    .select("id,nombre,precio,categoria,disponible,activo,stock")
    .eq("disponible", true)
    .eq("activo", true);

  console.log("📦 Menú cargado:", data);
  console.log("⚠️ Error al cargar menú:", error);

  if (error || !data) {
    if (contenedor) {
      contenedor.innerHTML = "<p style='padding:1em; color:#c00;'>❌ Error al cargar el menú. Intenta recargar.</p>";
    }
    return;
  }

  if (data.length === 0) {
    if (contenedor) {
      contenedor.innerHTML = "<p style='padding:1em; color:#666;'>⚠️ No hay platos disponibles en este momento.</p>";
    }
    return;
  }

  // 🧠 Actualiza menú global en memoria
  menu = data;

  const nuevosDatos = data.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  const visibles = document.querySelectorAll("#menu .menu-item");

  if (visibles.length === 0) {
    console.log("🎨 Renderizando menú completo…");
    mostrarMenuAgrupado(menu);
  } else {
    console.log("🔁 Actualizando ítems visibles…");
    visibles.forEach(el => {
      const input = el.querySelector("input[data-menu-id]");
      const id = input?.getAttribute("data-menu-id");
      const nuevo = nuevosDatos[id];
      if (!nuevo) return;

      const nombreEl = el.querySelector(".nombre");
      const precioEl = el.querySelector(".precio");

      if (nombreEl) nombreEl.textContent = nuevo.nombre;
      if (precioEl) {
        precioEl.innerHTML = `
          ${Number(nuevo.precio).toFixed(2)} CUP
          <span class="estado ${nuevo.disponible ? '' : 'no'}">
            ${nuevo.disponible ? '✔' : '✖'}
          </span>
          <span class="meta ${nuevo.stock <= 2 ? 'stock-bajo' : ''}" style="margin-left:6px;">
            Stock: ${nuevo.stock}
          </span>
        `;
      }

      if (input) {
        input.max = nuevo.stock;
        input.disabled = nuevo.stock === 0;
      }

      const qty = cantidadesSeleccionadas[id] || 0;
      if (qty > nuevo.stock) {
        cantidadesSeleccionadas[id] = nuevo.stock;
        input.value = nuevo.stock;
      }
    });
  }

  actualizarFiltroCategorias(menu);
  actualizarTotalesUI();
}

function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  if (!contenedor) {
    console.warn("❌ No se encontró el contenedor #menu en el DOM.");
    return;
  }

  console.log("🎨 Renderizando menú agrupado:", platos);

  contenedor.innerHTML = "";

  if (!platos || platos.length === 0) {
    contenedor.innerHTML = "<p style='padding:1em; color:#666;'>⚠️ No hay platos disponibles para mostrar.</p>";
    return;
  }

  const grupos = platos.reduce((acc, p) => {
    const cat = p.categoria || "Sin categoría";
    (acc[cat] = acc[cat] || []).push(p);
    return acc;
  }, {});

  for (const categoria of Object.keys(grupos)) {
    console.log(`📦 Grupo de categoría: ${categoria} (${grupos[categoria].length} ítems)`);

    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";
    grupo.innerHTML = `<h3>${escapeHtml(categoria)}</h3>`;

    grupos[categoria].forEach(plato => {
      const cantidadActual = Number(cantidadesSeleccionadas[plato.id] || 0);
      const item = document.createElement("div");
      item.className = "menu-item";
      item.innerHTML = `
        <div class="nombre">${escapeHtml(plato.nombre)}</div>
        <div class="precio">
          ${Number(plato.precio).toFixed(2)} CUP
          <span class="estado ${plato.disponible ? '' : 'no'}">
            ${plato.disponible ? '✔' : '✖'}
          </span>
          <span class="meta ${plato.stock <= 2 ? 'stock-bajo' : ''}" style="margin-left:6px;">
            Stock: ${plato.stock}
          </span>
        </div>
        <input type="number" min="0" max="${plato.stock}" value="${cantidadActual}" data-menu-id="${plato.id}" ${plato.stock === 0 ? 'disabled' : ''} />
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

  console.log("✅ Menú renderizado correctamente.");
}

function actualizarFiltroCategorias(platos) {
  const filtro = document.getElementById("filtro");
  if (!filtro) return;

  const categorias = [...new Set(platos.map(p => p.categoria || "Sin categoría"))].sort();
  filtro.innerHTML = `<option value="todos">Todos</option>`;
  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filtro.appendChild(option);
  });

  attachFiltroListener();
}

function attachFiltroListener() {
  const filtroEl = document.getElementById("filtro");
  if (!filtroEl) return;
  const nuevo = filtroEl.cloneNode(true);
  filtroEl.parentNode.replaceChild(nuevo, filtroEl);
  nuevo.addEventListener("change", window.filtrarMenu);
}

window.filtrarMenu = function () {
  const seleccion = document.getElementById("filtro").value;
  if (seleccion === "todos") mostrarMenuAgrupado(menu);
  else mostrarMenuAgrupado(menu.filter(p => (p.categoria || "Sin categoría") === seleccion));
};

window.actualizarCantidad = function (menuId, cantidad) {
  const qty = parseInt(cantidad, 10) || 0;
  if (qty <= 0) delete cantidadesSeleccionadas[menuId];
  else cantidadesSeleccionadas[menuId] = qty;
  actualizarTotalesUI();
};

window.revisarPedido = function () {
  const mesa = (document.getElementById("mesa").value || "").trim();
  if (!mesa) return alert("Indica número de mesa antes de revisar el pedido.");
  const local = document.getElementById("local").value;

  const items = Object.entries(cantidadesSeleccionadas)
    .map(([id, qty]) => {
      const p = menu.find(m => m.id === id);
      return p ? { id, nombre: p.nombre, price: Number(p.precio), cantidad: qty } : null;
    })
    .filter(Boolean);

  if (items.length === 0) return alert("Selecciona al menos un plato antes de revisar.");

  const resumenBlock = document.getElementById("resumen");
  resumenBlock.innerHTML = `
    <p><strong>Mesa:</strong> ${escapeHtml(mesa)}</p>
    <p><strong>Local:</strong> ${escapeHtml(local)}</p>
    <ul>
      ${items.map(i => `<li>${escapeHtml(i.nombre)} x${i.cantidad} — ${(i.price * i.cantidad).toFixed(2)} CUP</li>`).join("")}
    </ul>
    <p><strong>Total:</strong> ${items.reduce((s,i)=>s+(i.price*i.cantidad),0).toFixed(2)} CUP</p>
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
async function confirmarPedido() {
  const local = document.getElementById("local").value;
  const mesa = (document.getElementById("mesa").value || "").trim();
  if (!mesa) return alert("Indica número de mesa antes de confirmar.");

  const itemsRaw = Object.entries(cantidadesSeleccionadas)
    .map(([id, qty]) => {
      const p = menu.find(m => m.id === id);
      return p ? { menu_id: String(id), nombre: p.nombre, cantidad: Number(qty), precio: Number(p.precio) } : null;
    })
    .filter(Boolean)
    .filter(i => i.cantidad > 0);

  if (itemsRaw.length === 0) return alert("No hay items para enviar.");

  const itemsMap = {};
  itemsRaw.forEach(it => {
    const key = String(it.menu_id);
    if (!itemsMap[key]) itemsMap[key] = { ...it };
    else itemsMap[key].cantidad += it.cantidad;
  });

  const items = Object.values(itemsMap);

  try {
const payload = items.map(i => ({
  menu_id: i.menu_id,
  nombre: i.nombre,
  cantidad: i.cantidad,
  precio: i.precio
}));

// ✅ Validación antes de enviar
if (payload.some(i => !i.menu_id || !i.nombre || isNaN(i.precio) || isNaN(i.cantidad))) {
  return alert("❌ Hay ítems mal formateados. Revisa el menú.");
}

const { data, error } = await supabase.rpc('confirmar_pedido_sum_with_audit', {
  p_mesa: mesa,
  p_local: local,
  p_usuario_id: usuarioAutenticado,
  p_items: payload,
  p_pedido_id: null
});

    if (error) throw error;

    const result = Array.isArray(data) && data.length > 0 ? data[0] : null;
    const itemsReturned = result?.items ?? [];
    console.log("RPC result:", data);
    let allGood = true;
    items.forEach(it => {
      const found = itemsReturned.find(r => String(r.menu_id) === String(it.menu_id));
      if (!found || Number(found.cantidad) < Number(it.cantidad)) allGood = false;
    });
    console.log("Items enviados:", items);
    console.log("Items devueltos por RPC:", itemsReturned);
    if (!allGood) return alert("❗ La actualización no se reflejó completamente. Revisa la consola.");

    if (result && result.items) {
      result.items.forEach(ret => {
        const localPlato = menu.find(p => String(p.id) === String(ret.menu_id));
        if (localPlato) {
          localPlato.stock = Number(ret.stock_restante ?? localPlato.stock - ret.cantidad);
        }
      });
      mostrarMenuAgrupado(menu);
      actualizarTotalesUI();
    }

    cantidadesSeleccionadas = {};
    document.querySelectorAll("#menu input[type='number']").forEach(input => input.value = 0);
    actualizarTotalesUI();
    document.getElementById("confirmacion").style.display = "none";
    document.getElementById("resumen").innerHTML = "";

    await cargarResumen();
    await mostrarPedidosPendientes();

    if (result && result.pedido_id) verDetalles(result.pedido_id);
  } catch (err) {
    console.error("Error en confirmarPedido (RPC):", err);
    alert("❌ Error al confirmar pedido. Revisa la consola.");
  }
}

async function cargarResumen() {
  if (!usuarioAutenticado) return;
  const hoy = new Date().toISOString().split("T")[0];

  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select("cobrado, total")
    .eq("usuario_id", usuarioAutenticado)
    .gte("fecha", `${hoy}T00:00:00`)
    .lte("fecha", `${hoy}T23:59:59`);

  if (error) return;

  let cobrados = 0, pendientes = 0, totalCobrado = 0, totalPendiente = 0;
  (pedidos || []).forEach(p => {
    if (p.cobrado) { cobrados++; totalCobrado += Number(p.total || 0); }
    else { pendientes++; totalPendiente += Number(p.total || 0); }
  });

  document.getElementById("fecha-resumen").textContent = hoy;
  document.getElementById("total-cobrados").textContent = String(cobrados);
  document.getElementById("importe-cobrado").textContent = totalCobrado.toFixed(2);
  document.getElementById("total-pendientes").textContent = String(pendientes);
  document.getElementById("importe-pendiente").textContent = totalPendiente.toFixed(2);
}

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
          <li class="pedido-pendiente">
            <strong>Mesa ${escapeHtml(p.mesa)}</strong> (${escapeHtml(p.local)}) – ${Number(p.total).toFixed(2)} CUP
            <div style="margin-top:6px;">
              <button class="btn-principal" onclick="verDetalles('${p.id}')">Ver detalles</button>
              <button class="btn-secundario" onclick="cerrarPedido('${p.id}')">Cobrar</button>
            </div>
            <div class="meta">${new Date(p.fecha).toLocaleString()}</div>
          </li>
        `;
      });
      html += "</ul>";
    }

    const cont = document.getElementById("pedidos-pendientes");
    if (cont) cont.innerHTML = html;
  } catch (err) {
    console.error("Error mostrarPedidosPendientes:", err);
    alert("❌ No se pudieron cargar los pedidos pendientes.");
  }
}

window.verDetalles = async function (pedidoId) {
  try {
    const { data, error } = await supabase
      .from("pedido_items")
      .select("id, menu_id, nombre, cantidad, precio, subtotal, updated_at")
      .eq("pedido_id", pedidoId)
      .order("id", { ascending: true });

    if (error) throw error;

    const items = data || [];
    const total = items.reduce((s, it) => s + Number(it.subtotal || 0), 0);

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
                  <span class="meta">Cantidad: ${it.cantidad} — Precio: ${Number(it.precio).toFixed(2)} CUP — Subtotal: ${Number(it.subtotal).toFixed(2)} CUP</span>
                </div>
                <div class="meta">${new Date(it.updated_at).toLocaleString()}</div>
              </li>
            `).join("")}
          </ul>
          <div style="margin-top:10px; font-weight:700;">Total: ${total.toFixed(2)} CUP</div>
          <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:12px;">
            <button id="modal-cerrar-btn" class="btn-secundario">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("modal-cerrar-btn").onclick = () => {
      root.innerHTML = "";
    };
  } catch (err) {
    console.error("Error verDetalles:", err);
    alert("❌ Error al cargar detalles del pedido.");
  }
};

window.cerrarPedido = async function (pedidoId) {
  if (!confirm("Confirmar cobro del pedido?")) return;

  try {
    const { data: pedidoCheck, error: errCheck } = await supabase
      .from("pedidos")
      .select("usuario_id, cobrado")
      .eq("id", pedidoId)
      .single();

    if (errCheck) throw errCheck;
    if (!pedidoCheck || pedidoCheck.cobrado) {
      alert("Pedido ya cobrado o no encontrado.");
      return;
    }
    if (pedidoCheck.usuario_id !== usuarioAutenticado) {
      alert("Este pedido no fue creado por tu sesión. No puedes cobrarlo.");
      return;
    }

    const { error } = await supabase
      .from("pedidos")
      .update({
        cobrado: true,
        cobrado_por: usuarioAutenticado,
        cobrado_at: new Date().toISOString()
      })
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
};
