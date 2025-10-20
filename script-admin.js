import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const tabla = document.querySelector("#tabla tbody");

async function verificarAcceso() {
  const usuario = localStorage.getItem("usuarioActivo");
  if (!usuario) {
    document.body.innerHTML = "<h2>Acceso restringido. No has iniciado sesión.</h2>";
    return;
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("usuario", usuario)
    .single();

  if (error || !data || data.rol !== "admin") {
    document.body.innerHTML = "<h2>Acceso restringido. Solo administradores.</h2>";
    return;
  }

  await cargarPlatos();
  await cargarCategorias();
}

async function cargarPlatos() {
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .order("orden", { ascending: true });

  if (error) {
    alert("❌ Error al cargar platos");
    return;
  }

  tabla.innerHTML = "";
  data.forEach(plato => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${plato.nombre}</td>
      <td>${plato.precio} CUP</td>
      <td>${plato.categoria || ""}</td>
      <td><button onclick="eliminarPlato('${plato.id}')">🗑️</button></td>
    `;
    tabla.appendChild(fila);
  });
}

async function cargarCategorias() {
  const { data, error } = await supabase
    .from("menus")
    .select("categoria");

  if (error) return;

  const categorias = [...new Set(data.map(p => p.categoria).filter(Boolean))];
  const select = document.getElementById("categoriaExistente");

  categorias.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    select.appendChild(option);
  });

  select.addEventListener("change", () => {
    const seleccionada = select.value;
    document.getElementById("nuevaCategoria").value = seleccionada;
  });
}

async function agregarPlato() {
  const nombre = document.getElementById("nuevoNombre").value.trim();
  const precio = parseFloat(document.getElementById("nuevoPrecio").value);
  const categoria = document.getElementById("nuevaCategoria").value.trim();

  if (!nombre || isNaN(precio)) {
    alert("⚠️ Completa nombre y precio.");
    return;
  }

  const { error } = await supabase.from("menus").insert([{
    nombre,
    precio,
    categoria,
    disponible: true
  }]);

  if (error) {
    alert("❌ Error al guardar el plato");
    return;
  }

  document.getElementById("nuevoNombre").value = "";
  document.getElementById("nuevoPrecio").value = "";
  document.getElementById("nuevaCategoria").value = "";
  document.getElementById("categoriaExistente").value = "";

  await cargarPlatos();
  await cargarCategorias();
}

async function eliminarPlato(id) {
  const confirmar = confirm("¿Eliminar este plato?");
  if (!confirmar) return;

  const { error } = await supabase
    .from("menus")
    .delete()
    .eq("id", id);

  if (error) {
    alert("❌ Error al eliminar");
    return;
  }

  await cargarPlatos();
  await cargarCategorias();
}

function logout() {
  localStorage.removeItem("usuarioActivo");
  localStorage.removeItem("autenticado");
  window.location.href = "index.html";
}

window.agregarPlato = agregarPlato;
window.eliminarPlato = eliminarPlato;
window.logout = logout;
window.onload = verificarAcceso;
