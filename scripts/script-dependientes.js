import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

let usuarioAutenticado = null;
let menu = [];
let cantidadesSeleccionadas = {};
let total = 0;
let pedidosCobrados = 0;
let importeCobrado = 0;

window.addEventListener("DOMContentLoaded", async () => {
  const id = localStorage.getItem("usuario_id");
  if (id) {
    usuarioAutenticado = id;
    document.getElementById("login").style.display = "none";
    document.getElementById("contenido").style.display = "block";
    await cargarMenu();
    await cargarResumen();
  }
});

function actualizarEstiloLocal() {
  const local = document.getElementById("local").value;
  document.body.setAttribute("data-local", local.toLowerCase());
}
window.actualizarEstiloLocal = actualizarEstiloLocal;

async function iniciarSesion() {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, rol")
    .eq("usuario", usuario)
    .eq("clave", clave)
    .single();

  if (error || !data || data.rol !== "dependiente") {
    alert("❌ Credenciales incorrectas o rol no autorizado");
    return;
  }

  usuarioAutenticado = data.id;
  localStorage.setItem("usuario_id", data.id);

  document.getElementById("login").style.display = "none";
  document.getElementById("contenido").style.display = "block";

  await cargarMenu();
  await cargarResumen();
}
window.iniciarSesion = iniciarSesion;

async function cargarMenu() {
  const { data, error } = await supabase
    .from("menus")
    .select("nombre, precio, categoria")
    .eq("activo", true)
    .order("categoria", { ascending: true });

  if (error || !data) {
    alert("❌ Error al cargar el menú");
    return;
  }

  menu = data;
  mostrarMenuAgrupado(menu);
}

function mostrarMenuAgrupado(platos) {
  const contenedor = document.getElementById("menu");
  contenedor.innerHTML = "";

  const filtro = document.getElementById("filtro");
  filtro.innerHTML = '<option value="todos">Todos</option>';

  const agrupado = {};
  platos.forEach(p => {
    if (!agrupado[p.categoria]) {
      agrupado[p.categoria] = [];
      const option = document.createElement("option");
      option.value = p.categoria;
      option.textContent = p.categoria;
      filtro.appendChild(option);
    }
    agrupado[p.categoria].push(p);
  });

  for (const categoria in agrupado) {
    const grupo = document.createElement("div");
    grupo.className = "categoria-grupo";
    grupo.setAttribute("data-categoria", categoria);

    const titulo = document.createElement("h3");
    titulo.textContent = categoria;
    grupo.appendChild(titulo);

    agrupado[categoria].forEach(item => {
      const div = document.createElement("div");
      div.className = "menu-item";
      div.innerHTML = `
        <strong>${item.nombre}</strong>
        <small>${item.precio} CUP</small>
        <input type="number" min="0" value="0" data-name="${item.nombre}" data-price="${item.precio}" style="width:40px;" />
      `;
      grupo.appendChild(div);
    });

    contenedor.appendChild(grupo);
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
  const seleccion = document.getElementById("filtro").value;
  const grupos = document.querySelectorAll(".categoria-grupo");

  grupos.forEach(grupo => {
    const categoria = grupo.getAttribute("data-categoria");
    grupo.style.display = seleccion === "todos" || categoria === seleccion ? "block" : "none";
  });
}
window.filtrarMenu = filtrarMenu;

async function cargarResumen() {
  const { data, error } = await supabase
    .from("pedidos")
    .
