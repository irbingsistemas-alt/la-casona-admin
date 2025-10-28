// clientes-focsa.js
// Versión que usa la RPC listar_menus(p_destino, p_only_available, p_limit)
// Reemplaza la función cargarMenu en tu módulo FOCSA.
// Depende de que la RPC listar_menus exista y que el anon/authenticated tenga EXECUTE.

// Import Supabase (ESM)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {});

// DOM references (espera que el HTML tenga estos ids)
const menuContainer = document.getElementById("menu-container");
const filtro = document.getElementById("filtro");
const buscar = document.getElementById("buscar");
const loadingMenu = document.getElementById("loadingMenu");
const carritoLista = document.getElementById("carritoLista");
const totalEl = document.getElementById("total");
const resumenEl = document.getElementById("resumen");
const confirmPanel = document.getElementById("confirmacion");
const btnRevisar = document.getElementById("btnRevisar");
const btnLimpiar = document.getElementById("btnLimpiar");
const btnEnviarWhats = document.getElementById("btnEnviarWhats");
const btnCancelar = document.getElementById("btnCancelar");

let menu = []; // array de items retornados por la RPC
const seleccion = {}; // productId -> cantidad

const escapeHtml = s => String(s ?? "").replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Cargar menú usando RPC listar_menus filtrado por focsa
export async function cargarMenu() {
  if (loadingMenu) loadingMenu.style.display = "inline";
  try {
    const { data, error } = await supabase.rpc('listar_menus', {
      p_destino: 'focsa',
      p_only_available: true,
      p_limit: 1000
    });
    if (error) throw error;
    menu = Array.isArray(data) ? data : [];

    // construir select de categorías desde items FOCSA
    const cats = [...new Set(menu.map(i => i.categoria).filter(Boolean))].sort();
    if (filtro) {
      filtro.innerHTML = "<option value='todos'>Todas las categorías</option>";
      cats.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        filtro.appendChild(opt);
      });
    }

    renderMenu(menu);
  } catch (err) {
    console.error("Error cargarMenu RPC listar_menus:", err);
    if (menuContainer) menuContainer.innerHTML = "<div class='small'>Error cargando menú FOCSA. Revisa consola.</div>";
  } finally {
    if (loadingMenu) loadingMenu.style.display = "none";
  }
}

// Render agrupado por categoría y controles de cantidad
export function renderMenu(list) {
  if (!menuContainer) return;
  menuContainer.innerHTML = "";
  const listToRender = Array.isArray(list) ? list : (Array.isArray(menu) ? menu : []);
  if (!listToRender.length) {
    menuContainer.innerHTML = "<div class='small'>No hay platos disponibles.</div>";
    return;
  }

  const grouped = listToRender.reduce((acc, it) => {
    const cat = it.categoria || "Sin categoría";
    acc[cat] = acc[cat] || [];
    acc[cat].push(it);
    return acc;
  }, {});

  for (const cat of Object.keys(grouped)) {
    const groupDiv = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = cat;
    groupDiv.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "menu-grid";

    grouped[cat].forEach(item => {
      const card = document.createElement("div");
      card.className = "menu-item";

      const name = document.createElement("div");
      name.innerHTML = `<strong>${escapeHtml(item.nombre)}</strong>`;

      const price = document.createElement("div");
      price.className = "price";
      price.textContent = `${item.precio} CUP`;

      const qtyRow = document.createElement("div");
      qtyRow.className = "qty-row";
      qtyRow.innerHTML = `
        <button type="button" data-action="dec" data-id="${item.id}">−</button>
        <input type="number" min="0" value="${seleccion[item.id] || 0}" data-id="${item.id}" />
        <button type="button" data-action="inc" data-id="${item.id}">+</button>
      `;

      qtyRow.querySelectorAll("button").forEach(b => {
        b.addEventListener("click", () => {
          const id = b.dataset.id;
          const action = b.dataset.action;
          const current = Number(seleccion[id] || 0);
          if (action === "inc") seleccion[id] = current + 1;
          if (action === "dec") seleccion[id] = Math.max(0, current - 1);
          const input = qtyRow.querySelector(`input[data-id="${id}"]`);
          if (input) input.value = seleccion[id];
          renderCarrito();
        });
      });

      const inputEl = qtyRow.querySelector("input");
      inputEl.addEventListener("input", (ev) => {
        const id = ev.target.dataset.id;
        const v = Math.max(0, parseInt(ev.target.value || 0));
        seleccion[id] = v;
        renderCarrito();
      });

      card.appendChild(name);
      card.appendChild(price);
      card.appendChild(qtyRow);
      grid.appendChild(card);
    });

    groupDiv.appendChild(grid);
    menuContainer.appendChild(groupDiv);
  }
}

// Filtrar y buscar
if (filtro) {
  filtro.addEventListener("change", () => {
    const val = filtro.value;
    const filtered = val === "todos" ? menu : menu.filter(m => m.categoria === val);
    renderMenu(filtered);
  });
}

let searchDebounce;
if (buscar) {
  buscar.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const q = buscar.value.trim().toLowerCase();
      const filtered = !q ? menu : menu.filter(m => (m.nombre || "").toLowerCase().includes(q) || (m.categoria||"").toLowerCase().includes(q));
      renderMenu(filtered);
    }, 180);
  });
}

// Carrito y UI
export function renderCarrito() {
  if (!carritoLista || !totalEl) return;
  const entries = Object.entries(seleccion).filter(([, qty]) => qty > 0);
  if (entries.length === 0) {
    carritoLista.innerHTML = "<div class='small'>No hay items seleccionados.</div>";
    totalEl.textContent = "0 CUP";
    return;
  }
  const lines = entries.map(([id, qty]) => {
    const item = menu.find(m => String(m.id) === String(id));
    const subtotal = item ? (qty * (Number(item.precio)||0)) : 0;
    return { id, nombre: item ? item.nombre : id, qty, precio: Number(item.precio)||0, subtotal };
  });

  carritoLista.innerHTML = lines.map(l => `
    <div style="display:flex;justify-content:space-between;padding:6px 4px;border-bottom:1px dashed #f0f0f0">
      <div><strong>${escapeHtml(l.nombre)}</strong><div class="small">x${l.qty} · ${l.precio} CUP</div></div>
      <div style="text-align:right">${l.subtotal} CUP</div>
    </div>
  `).join("");

  const total = lines.reduce((s, i) => s + i.subtotal, 0);
  totalEl.textContent = `${total} CUP`;
}

// Limpiar selección
if (btnLimpiar) {
  btnLimpiar.addEventListener("click", () => {
    for (const k in seleccion) seleccion[k] = 0;
    renderCarrito();
    renderMenu(menu);
  });
}

// Revisar pedido
if (btnRevisar) {
  btnRevisar.addEventListener("click", () => {
    const cliente = document.getElementById("cliente").value.trim();
    const piso = document.getElementById("piso").value.trim();
    const apartamento = document.getElementById("apartamento").value.trim();
    if (!cliente || !piso || !apartamento) {
      alert("Por favor completa nombre, piso y apartamento");
      return;
    }
    const items = Object.entries(seleccion).filter(([,q]) => q>0).map(([id,q]) => {
      const item = menu.find(m => String(m.id) === String(id));
      return { id, nombre: item ? item.nombre : id, cantidad: q, precio: Number(item?.precio||0), subtotal: q * Number(item?.precio||0) };
    });
    if (items.length === 0) { alert("Selecciona al menos un plato"); return; }

    resumenEl.innerHTML = `
      <div style="margin-bottom:8px"><strong>Cliente:</strong> ${escapeHtml(cliente)}<br>
      <strong>Piso:</strong> ${escapeHtml(piso)} · <strong>Apto:</strong> ${escapeHtml(apartamento)}</div>
      ${items.map(it=>`<div style="display:flex;justify-content:space-between;padding:6px 0">${escapeHtml(it.nombre)} <span>${it.cantidad} × ${it.precio} CUP</span></div>`).join("")}
      <div style="border-top:1px solid #eee;padding-top:8px;font-weight:800">Total: ${items.reduce((s,i)=>s+i.subtotal,0)} CUP</div>
    `;
    confirmPanel.style.display = "block";
    confirmPanel.setAttribute("aria-hidden","false");

    const msgLines = [
      `Pedido para: ${cliente}`,
      `Local: Edificio FOCSA`,
      `Piso: ${piso} - Apto: ${apartamento}`,
      `` ,
      ...items.map(it => `- ${it.nombre} x${it.cantidad} = ${it.subtotal} CUP`),
      ``,
      `Total: ${items.reduce((s,i)=>s+i.subtotal,0)} CUP`
    ];
    window.mensajeWhatsApp = msgLines.join("\n");
    window.pedidoParaGuardar = { cliente, piso, apartamento, local: "FOCSA", tipo: "FOCSA", total: items.reduce((s,i)=>s+i.subtotal,0), items };
  });
}

if (btnCancelar) {
  btnCancelar.addEventListener("click", () => {
    confirmPanel.style.display = "none";
    confirmPanel.setAttribute("aria-hidden","true");
  });
}

// Guardar pedido usando inserciones actuales o, si prefieres, reemplazar por supabase.rpc('crear_pedido_cliente', payload)
if (btnEnviarWhats) {
  btnEnviarWhats.addEventListener("click", async () => {
    const payload = window.pedidoParaGuardar;
    if (!payload) return alert("No hay pedido para enviar.");
    btnEnviarWhats.disabled = true;
    btnEnviarWhats.textContent = "Enviando...";
    try {
      // Insert pedido (frontend directo). Recomiendo cambiar por RPC transaccional crear_pedido_cliente más adelante.
      const { data: pedido, error: errPedido } = await supabase
        .from("pedidos")
        .insert([{
          cliente: payload.cliente,
          piso: payload.piso,
          apartamento: payload.apartamento,
          local: payload.local,
          tipo: payload.tipo,
          fecha: new Date().toISOString(),
          total: payload.total,
          entregado: false
        }])
        .select()
        .single();
      if (errPedido) throw errPedido;

      const itemsToInsert = (payload.items || []).map(it => ({
        pedido_id: pedido.id,
        producto_id: it.id,
        nombre: it.nombre,
        cantidad: it.cantidad,
        subtotal: it.subtotal
      }));
      const { error: errItems } = await supabase.from("pedido_items").insert(itemsToInsert);
      if (errItems) throw errItems;

      const numero = "5350971023";
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(window.mensajeWhatsApp)}`;
      window.open(url, "_blank");

      confirmPanel.style.display = "none";
      confirmPanel.setAttribute("aria-hidden","true");
      for (const k in seleccion) seleccion[k]=0;
      renderCarrito();
      alert("Pedido guardado y se abrió WhatsApp.");
    } catch (err) {
      console.error("Error guardando pedido:", err);
      alert("❌ Error guardando pedido. Revisa consola y logs.");
    } finally {
      btnEnviarWhats.disabled = false;
      btnEnviarWhats.textContent = "Confirmar y enviar";
    }
  });
}

// Inicialización automática
(async function init(){
  await cargarMenu();
  renderCarrito();
})();
