const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_KEY = "TU_API_KEY_AQUI"; // ← reemplaza con tu anon key

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

async function cargarPlatos() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/menus?select=*`, { headers });
  const platos = await res.json();
  const tbody = document.querySelector("#tabla tbody");
  tbody.innerHTML = "";

  platos.sort((a, b) => a.orden - b.orden).forEach(plato => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${plato.nombre}</td>
      <td>${plato.precio} CUP</td>
      <td>${plato.categoria || ""}</td>
      <td><button onclick="eliminarPlato('${plato.id}')">🗑️</button></td>
    `;
    tbody.appendChild(fila);
  });
}

async function agregarPlato() {
  const nombre = document.getElementById("nuevoNombre").value.trim();
  const precio = parseFloat(document.getElementById("nuevoPrecio").value);
  const categoria = document.getElementById("nuevaCategoria").value.trim();

  if (!nombre || isNaN(precio)) {
    alert("Completa nombre y precio.");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/menus`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      nombre,
      precio,
      categoria,
      disponible: true
    })
  });

  if (res.ok) {
    document.getElementById("nuevoNombre").value = "";
    document.getElementById("nuevoPrecio").value = "";
    document.getElementById("nuevaCategoria").value = "";
    cargarPlatos();
  } else {
    alert("❌ Error al guardar el plato.");
  }
}

async function eliminarPlato(id) {
  const confirmar = confirm("¿Eliminar este plato?");
  if (!confirmar) return;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/menus?id=eq.${id}`, {
    method: "DELETE",
    headers
  });

  if (res.ok) {
    cargarPlatos();
  } else {
    alert("❌ Error al eliminar.");
  }
}

function logout() {
  localStorage.removeItem("usuarioActivo");
  window.location.href = "index.html";
}

window.onload = cargarPlatos;
