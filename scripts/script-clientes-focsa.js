/**
 * script-clientes-focsa.js
 * Versión final con llamada única a crear_pedido_cliente(json, text)
 * Validaciones defensivas, sin fallback, sin stringify
 */

/* CONFIGURA TU SUPABASE */
const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* Elementos del DOM */
const menuContenedor = document.getElementById("menuContenedor");
const filtroCategoria = document.getElementById("filtroCategoria");
const listaEmbalajes = document.getElementById("listaEmbalajes");
const totalEl = document.getElementById("total");
const btnEnviarWhats = document.getElementById("btnEnviarWhats");
const mensajeEl = document.getElementById("mensaje");

let menu = [];
let embalajes = [];
const seleccion = {};
const packagingSeleccionado = {};

/* Cargar menú */
async function cargarMenu() {
  try {
    const { data, error } = await supabase
      .from("menus")
      .select("id, nombre, precio, categoria, stock, disponible, destino")
      .eq("disponible", true)
      .eq("destino", "focsa")
      .gt("stock", 0)
      .order("categoria", { ascending: true });

    if (error) throw error;
    menu = Array.isArray(data) ? data : [];

    const categorias = [...new Set(menu.map(i => i.categoria).filter(Boolean))].sort();
    filtroCategoria.innerHTML = "<option value='todos'>Todas</option>";
    categorias.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      filtroCategoria.appendChild(opt);
    });

    renderMenu(menu);
  } catch (err) {
    console.error("cargarMenu error", err);
    menuContenedor.innerHTML = "<div style='padding:12px;color:#a00'>Error cargando productos</div>";
  }
}

/* Renderizar menú */
function renderMenu(lista) {
  menuContenedor.innerHTML = "";
  const agrupado = lista.reduce((acc, item) => {
    const cat = item.categoria || "Sin categoría";
    acc[cat] = acc[cat] || [];
    acc[cat].push(item);
    return acc;
  }, {});

  for (const cat of Object.keys(agrupado)) {
    const titulo = document.createElement("div");
    titulo.style.fontWeight = 600;
    titulo.style.margin = "6px 0";
    titulo.textContent = cat;
    menuContenedor.appendChild(titulo);

    agrupado[cat].forEach(item => {
      const div = document.createElement("div");
      div.className = "menu-item";

      const nombre = document.createElement("span");
      nombre.textContent = `${item.nombre} — ${Number(item.precio).toFixed(2)} CUP`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const stockTag = document.createElement("small");
      stockTag.style.color = "#666";
      stockTag.textContent = `stock: ${item.stock}`;

      const input = document.createElement("input");
      input.type = "number";
      input.min = 0;
      input.max = item.stock || 9999;
      input.value = seleccion[item.id] || 0;
      input.setAttribute("aria-label", `cantidad-${item.nombre}`);
      input.dataset.id = item.id;
      input.dataset.precio = item.precio;

      input.addEventListener("input", () => {
        const id = input.dataset.id;
        const cantidad = Math.max(0, Math.min(parseInt(input.value) || 0, Number(item.stock || 0)));
        if (cantidad === 0) delete seleccion[id]; else seleccion[id] = cantidad;
        input.value = cantidad;
        calcularTotal();
      });

      right.appendChild(stockTag);
      right.appendChild(input);
      div.appendChild(nombre);
      div.appendChild(right);
      menuContenedor.appendChild(div);
    });
  }

  calcularTotal();
}

/* Cargar embalajes */
async function cargarEmbalajes() {
  try {
    const { data, error } = await supabase
      .from("embalajes")
      .select("*")
      .eq("activo", true)
      .order("nombre");

    if (error) throw error;
    embalajes = Array.isArray(data) ? data : [];

    listaEmbalajes.innerHTML = "";
    embalajes.forEach(e => {
      const div = document.createElement("div");
      div.className = "menu-item";

      const nombre = document.createElement("span");
      nombre.textContent = `${e.nombre} — ${Number(e.precio).toFixed(2)} CUP`;

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      const input = document.createElement("input");
      input.type = "number";
      input.min = 0;
      input.value = packagingSeleccionado[e.id] || 0;
      input.dataset.id = e.id;
      input.dataset.precio = e.precio;

      input.addEventListener("input", () => {
        const id = input.dataset.id;
        const cantidad = Math.max(0, parseInt(input.value) || 0);
        if (cantidad === 0) delete packagingSeleccionado[id]; else packagingSeleccionado[id] = cantidad;
        input.value = cantidad;
        calcularTotal();
      });

      right.appendChild(input);
      div.appendChild(nombre);
      div.appendChild(right);
      listaEmbalajes.appendChild(div);
    });

    calcularTotal();
  } catch (err) {
    console.error("cargarEmbalajes error", err);
    listaEmbalajes.innerHTML = "<div style='padding:12px;color:#a00'>Error cargando embalajes</div>";
  }
}

/* Calcular total */
function calcularTotal() {
  let total = 0;

  for (const id in seleccion) {
    const cantidad = Number(seleccion[id] || 0);
    const item = menu.find(m => m.id === id);
    if (!item) continue;
    total += cantidad * Number(item.precio || 0);
  }

  for (const id in packagingSeleccionado) {
    const cantidad = Number(packagingSeleccionado[id] || 0);
    const item = embalajes.find(e => e.id === id);
    if (!item) continue;
    total += cantidad * Number(item.precio || 0);
  }

  totalEl.textContent = Number(total || 0).toFixed(2);
}

/* Filtrado por categoría */
filtroCategoria.addEventListener("change", () => {
  const cat = filtroCategoria.value;
  const filtrado = cat === "todos" ? menu : menu.filter(m => m.categoria === cat);
  renderMenu(filtrado);
});

/* Carga inicial */
cargarMenu();
cargarEmbalajes();
/* Envío del pedido */
btnEnviarWhats.addEventListener("click", async () => {
  try {
    const cliente = document.getElementById("cliente").value.trim();
    const piso = document.getElementById("piso").value.trim();
    const apartamento = document.getElementById("apartamento").value.trim();
    const perteneceGrupo = document.getElementById("optGrupo").checked;

    if (!cliente || !piso || !apartamento) {
      alert("Completa los datos del cliente: nombre, piso y apartamento.");
      return;
    }

    const items = Object.entries(seleccion)
      .filter(([_, cantidad]) => Number(cantidad) > 0)
      .map(([id, cantidad]) => {
        const item = menu.find(m => m.id === id);
        if (!item) return null;
        return {
          menu_id: id,
          nombre: item.nombre,
          cantidad: Number(cantidad),
          precio: Number(item.precio),
          subtotal: Number(cantidad) * Number(item.precio),
          es_packaging: false
        };
      })
      .filter(Boolean);

    const packaging = Object.entries(packagingSeleccionado)
      .filter(([_, cantidad]) => Number(cantidad) > 0)
      .map(([id, cantidad]) => {
        const item = embalajes.find(e => e.id === id);
        if (!item) return null;
        return {
          menu_id: id,
          nombre: item.nombre,
          cantidad: Number(cantidad),
          precio: Number(item.precio),
          subtotal: Number(cantidad) * Number(item.precio),
          es_packaging: true
        };
      })
      .filter(Boolean);

    if (items.length === 0 && packaging.length === 0) {
      alert("Selecciona al menos un producto o embalaje.");
      return;
    }

    const total = Number(totalEl.textContent || 0);
    const payload = {
      cliente,
      piso,
      apartamento,
      local: "FOCSA",
      tipo: "FOCSA",
      items: [...items, ...packaging],
      total,
      grupo_whatsapp: perteneceGrupo,
      nota: `Grupo WhatsApp: ${perteneceGrupo ? "SI" : "NO"}`
    };

    console.log("Payload enviado:", JSON.stringify(payload, null, 2));

    btnEnviarWhats.disabled = true;
    btnEnviarWhats.textContent = "Enviando...";

    const rpcResult = await supabase.rpc("crear_pedido_cliente", {
      p_payload: payload,
      p_actor: cliente
    });

    const { data, error } = rpcResult || {};
    if (error || !data || data.ok === false) {
      console.error("RPC error", { error, data });
      const msg = data?.message || error?.message || "No se pudo crear el pedido";
      alert("Error: " + msg);
      return;
    }

    const texto = data.mensaje || `Pedido creado: ${data.pedido_id}`;
    window.open(`https://wa.me/5350971023?text=${encodeURIComponent(texto)}`, "_blank");

    mensajeEl.textContent = "Pedido enviado correctamente.";
    mensajeEl.style.display = "block";

    document.getElementById("formPedido").reset();
    totalEl.textContent = "0.00";
    Object.keys(seleccion).forEach(k => delete seleccion[k]);
    Object.keys(packagingSeleccionado).forEach(k => delete packagingSeleccionado[k]);

    await cargarMenu();
    await cargarEmbalajes();
  } catch (err) {
    console.error("Error creando pedido (catch)", err);
    alert("Error inesperado al crear el pedido.");
  } finally {
    btnEnviarWhats.disabled = false;
    btnEnviarWhats.textContent = "Confirmar y enviar";
  }
});
