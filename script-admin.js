import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const tabla = document.querySelector("#tabla tbody");
let platos = [];

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

  await cargarCategorias();
  await cargarPlatos();
}

async function cargarPlatos(categoria = "") {
  let query = supabase.from("menus").select("*").order("orden", { ascending: true });
  if (categoria) query = query.eq("categoria", categoria);

  const { data, error } = await query;

  if (error) {
    alert("❌ Error al cargar platos");
    return;
  }

  platos = data;
  tabla.innerHTML = "";

  data.forEach(plato => {
    const fila = document.createElement("tr");
    fila.dataset.id = plato.id;

    const celdaNombre = document.createElement("td");
    celdaNombre.textContent = plato.nombre;

    const celdaPrecio = document.createElement("td");
    celdaPrecio.textContent = `${plato.precio} CUP`;

    const celdaCategoria = document.createElement("td");
    celdaCategoria.textContent = plato.categoria || "";

    const celdaDisponible = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!plato.disponible;
    celdaDisponible.appendChild(checkbox);

    const celdaEliminar = document.createElement("td");
    const botonEliminar = document.createElement("button");
    botonEliminar.textContent = "🗑️";
    botonEliminar.onclick = () => eliminarPlato(plato.id);
    celdaEliminar.appendChild(botonEliminar);

    fila.appendChild(celdaNombre);
    fila.appendChild(celdaPrecio);
    fila.appendChild(celdaCategoria);
    fila.appendChild(celdaDisponible);
    fila.appendChild(celdaEliminar);

    tabla.appendChild(fila);
  });
}

async function guardarDisponibilidad() {
  const filas = document.querySelectorAll("#tabla tbody tr");
  const actualizaciones = [];

  filas.forEach(fila => {
    const id = fila.dataset.id?.trim(); // ✅ aseguramos string limpio
    const checkbox = fila.querySelector("input[type='checkbox']");
    const nuevoEstado = checkbox.checked;

    const platoOriginal = platos.find(p => p.id === id);
    const estadoOriginal = Boolean(platoOriginal?.disponible);

    console.log("🧪 ID:", id, "| Original:", estadoOriginal, "| Nuevo:", nuevoEstado);

    if (estadoOriginal !== nuevoEstado) {
      actualizaciones.push({ id, disponible: nuevoEstado });
    }
  });

  if (actualizaciones.length === 0) {
    alert("No hay cambios de disponibilidad para guardar.");
    return;
  }

  for (const cambio of actualizaciones) {
    console.log("🔄 Actualizando:", cambio.id, "→", cambio.disponible);

    const { data, error } = await supabase
      .from("menus")
      .update({ disponible: cambio.disponible })
      .eq("id", cambio.id)
      .select();

    if (error) {
      console.error("❌ Error al actualizar:", error);
      alert("❌ Error al guardar cambios");
      return;
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ No se encontró el registro con ID:", cambio.id);
    } else {
      console.log("✅ Registro actualizado:", data[0]);
    }
  }

  alert("✅ Cambios guardados correctamente.");
  const categoriaActual = document.getElementById("filtroCategoria").value;
  await cargarPlatos(categoriaActual);
}

async function cargarCategorias() {
  const { data, error } = await supabase.from("menus").select("categoria");

  if (error) return;

  const categorias = [...new Set(data.map(p => p.categoria).filter(Boolean))];
  const selectFiltro = document.getElementById("filtroCategoria");
  const selectAgregar = document.getElementById("categoriaExistente");

  selectFiltro.innerHTML = '<option value="">Todas</option>';
  selectAgregar.innerHTML = '<option value="">-- Nueva categoría --</option>';

  categorias.forEach(cat => {
    const option1 = document.createElement("option");
    option1.value = cat;
    option1.textContent = cat;
    selectFiltro.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = cat;
    option2.textContent = cat;
    selectAgregar.appendChild(option2);
  });

  selectAgregar.addEventListener("change", () => {
    document.getElementById("nuevaCategoria").value = selectAgregar.value;
  });

  document.getElementById("filtroCategoria").addEventListener("change", (e) => {
    cargarPlatos(e.target.value);
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

  const categoriaActual = document.getElementById("filtroCategoria").value;
  await cargarPlatos(categoriaActual);
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

  const categoriaActual = document.getElementById("filtroCategoria").value;
  await cargarPlatos(categoriaActual);
  await cargarCategorias();
}

function logout() {
  localStorage.removeItem("usuarioActivo");
  localStorage.removeItem("autenticado");
  window.location.href = "index.html";
}

window.agregarPlato = agregarPlato;
window.eliminarPlato = eliminarPlato;
window.guardarDisponibilidad = guardarDisponibilidad;
window.logout = logout;
window.onload = verificarAcceso;
