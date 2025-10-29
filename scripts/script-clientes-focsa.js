const supabase = window.supabase.createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const menuContenedor = document.getElementById("menuContenedor");
const filtroCategoria = document.getElementById("filtroCategoria");
const listaEmbalajes = document.getElementById("listaEmbalajes");
const totalEl = document.getElementById("total");
const btnEnviarWhats = document.getElementById("btnEnviarWhats");
const mensajeEl = document.getElementById("mensaje");

let menu = [];
let embalajes = [];
const seleccion = {}; // id → cantidad
const packagingSeleccionado = {}; // id → cantidad

async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("id, nombre, precio, categoria, stock, disponible, destino")
    .eq("disponible", true)
    .eq("destino", "focsa")
    .gt("stock", 0)
    .order("categoria", { ascending: true });

  if (error) return console.error("Error menú", error);
  menu = data || [];

  const categorias = [...new Set(menu.map(i => i.categoria).filter(Boolean))].sort();
  filtroCategoria.innerHTML = "<option value='todos'>Todas</option>";
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    filtroCategoria.appendChild(opt);
  });

  renderMenu(menu);
}

function renderMenu(lista) {
  menuContenedor.innerHTML = "";
  const agrupado = lista.reduce((acc, item) => {
    const cat = item.categoria || "Sin categoría";
    acc[cat] = acc[cat] || [];
    acc[cat].push(item);
    return acc;
  }, {});

  for (const cat in agrupado) {
    const grupoDiv = document.createElement("div");
    grupoDiv.className = "categoria-grupo";
    grupoDiv.innerHTML = `<h4>${cat}</h4>`;

    agrupado[cat].forEach(item => {
      const div = document.createElement("div");
      div.className = "menu-item";

      const nombre = document.createElement("span");
      nombre.textContent = `${item.nombre} – ${item.precio} CUP · Stock: ${item.stock}`;

      const input = document.createElement("input");
      input.type = "number";
      input.min = 0;
      input.max = item.stock;
      input.value = seleccion[item.id] || 0;
      input.dataset.id = item.id;
      input.dataset.precio = item.precio;

      input.addEventListener("input", () => {
        const id = input.dataset.id;
        const cantidad = Math.min(parseInt(input.value) || 0, item.stock);
        seleccion[id] = cantidad;
        calcularTotal();
      });

      div.appendChild(nombre);
      div.appendChild(input);
      grupoDiv.appendChild(div);
    });

    menuContenedor.appendChild(grupoDiv);
  }

  calcularTotal();
}

filtroCategoria.addEventListener("change", () => {
  const cat = filtroCategoria.value;
  const filtrado = cat === "todos" ? menu : menu.filter(m => m.categoria === cat);
  renderMenu(filtrado);
});

async function cargarEmbalajes() {
  const { data, error } = await supabase
    .from("embalajes")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  if (error) return console.error("Error embalajes", error);
  embalajes = data || [];

  listaEmbalajes.innerHTML = embalajes.map(e => `
    <div class="menu-item">
      <span>${e.nombre} – ${e.precio} CUP</span>
      <input type="number" min="0" value="0" data-id="${e.id}" data-precio="${e.precio}" />
    </div>
  `).join("");

  listaEmbalajes.querySelectorAll("input").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.id;
      const cantidad = parseInt(input.value) || 0;
      packagingSeleccionado[id] = cantidad;
      calcularTotal();
    });
  });
}

function calcularTotal() {
  let total = 0;

  for (const id in seleccion) {
    const cantidad = seleccion[id];
    const item = menu.find(m => m.id === id);
    if (item && cantidad > 0) {
      total += cantidad * item.precio;
    }
  }

  for (const id in packagingSeleccionado) {
    const cantidad = packagingSeleccionado[id];
    const item = embalajes.find(e => e.id === id);
    if (item && cantidad > 0) {
      total += cantidad * item.precio;
    }
  }

  totalEl.textContent = total.toFixed(2);
}

cargarMenu();
cargarEmbalajes();
btnEnviarWhats.addEventListener("click", async () => {
  const cliente = document.getElementById("cliente").value.trim();
  const piso = document.getElementById("piso").value.trim();
  const apartamento = document.getElementById("apartamento").value.trim();
  const perteneceGrupo = document.getElementById("optGrupo").checked;

  if (!cliente || !piso || !apartamento) {
    alert("Completa los datos del cliente.");
    return;
  }

  const items = Object.entries(seleccion)
    .filter(([_, cantidad]) => cantidad > 0)
    .map(([id, cantidad]) => {
      const item = menu.find(m => m.id === id);
      return {
        id,
        nombre: item.nombre,
        cantidad,
        precio: item.precio
      };
    });

  const packaging = Object.entries(packagingSeleccionado)
    .filter(([_, cantidad]) => cantidad > 0)
    .map(([id, cantidad]) => {
      const item = embalajes.find(e => e.id === id);
      return {
        id,
        nombre: item.nombre,
        qty: cantidad,
        precio: item.precio
      };
    });

  const total = parseFloat(totalEl.textContent);
  const payload = {
    cliente,
    piso,
    apartamento,
    local: "FOCSA",
    tipo: "FOCSA",
    items,
    packaging,
    total,
    grupo_whatsapp: perteneceGrupo,
    nota: `Grupo WhatsApp: ${perteneceGrupo ? "SI" : "NO"}`
  };

  btnEnviarWhats.disabled = true;
  btnEnviarWhats.textContent = "Enviando...";

  try {
    const { data, error } = await supabase.rpc("crear_pedido_cliente", {
      p_payload: payload,
      p_actor: cliente
    });

    if (error || !data || !data.ok) {
      console.error("Error RPC", error || data);
      alert("No se pudo crear el pedido.");
      return;
    }

    const texto = data.mensaje || `Pedido creado: ${data.pedido_id}`;
    window.open(`https://wa.me/5350971023?text=${encodeURIComponent(texto)}`, "_blank");

    mensajeEl.textContent = "Pedido enviado correctamente.";
    mensajeEl.style.display = "block";

    document.getElementById("formPedido").reset();
    totalEl.textContent = "0";
    menuContenedor.innerHTML = "";
    listaEmbalajes.innerHTML = "";
    filtroCategoria.innerHTML = "<option value='todos'>Todas</option>";
    Object.keys(seleccion).forEach(k => delete seleccion[k]);
    Object.keys(packagingSeleccionado).forEach(k => delete packagingSeleccionado[k]);

    await cargarMenu();
    await cargarEmbalajes();
  } catch (err) {
    console.error("Error creando pedido", err);
    alert("Error inesperado.");
  } finally {
    btnEnviarWhats.disabled = false;
    btnEnviarWhats.textContent = "Confirmar y enviar";
  }
});
