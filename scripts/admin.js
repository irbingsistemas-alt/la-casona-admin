import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "TU_ANON_KEY_AQUI" // ⚠️ Sustituye con tu anon key real
);

// Validar sesión y rol
const usuario = localStorage.getItem("usuario");
const rol = localStorage.getItem("rol");

if (!usuario || !rol || (rol !== "admin" && rol !== "gerente")) {
  window.location.href = "../index.html";
}

document.getElementById("usuarioConectado").textContent = usuario;

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "../index.html";
});

// Crear usuario
document.getElementById("crearForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nuevoUsuario = document.getElementById("nuevoUsuario").value.toLowerCase();
  const nuevaClave = document.getElementById("nuevaClave").value;
  const nuevoRol = document.getElementById("nuevoRol").value;

  const { error } = await supabase.rpc("crear_usuario", {
    p_usuario: nuevoUsuario,
    p_clave: nuevaClave,
    p_rol: nuevoRol
  });

  if (error) {
    alert("Error creando usuario: " + error.message);
  } else {
    alert("Usuario creado con éxito");
    document.getElementById("crearForm").reset();
    cargarUsuarios();
  }
});

// Cambiar clave
document.getElementById("cambiarForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const usuarioClave = document.getElementById("usuarioClave").value.toLowerCase();
  const nuevaClaveUsuario = document.getElementById("nuevaClaveUsuario").value;

  const { error } = await supabase.rpc("cambiar_clave", {
    p_usuario: usuarioClave,
    p_clave: nuevaClaveUsuario
  });

  if (error) {
    alert("Error cambiando clave: " + error.message);
  } else {
    alert("Clave actualizada con éxito para " + usuarioClave);
    document.getElementById("cambiarForm").reset();
  }
});

// Cargar usuarios
async function cargarUsuarios() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("usuario, roles(nombre)")
    .order("usuario");

  if (error) {
    console.error(error);
    return;
  }

  const tbody = document.getElementById("tablaUsuarios");
  tbody.innerHTML = "";
  data.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.usuario}</td>
      <td>${u.roles.nombre}</td>
      <td>
        <button onclick="borrarUsuario('${u.usuario}')">Borrar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.borrarUsuario = async (usuario) => {
  if (!confirm("¿Seguro que quieres borrar " + usuario + "?")) return;
  const { error } = await supabase.rpc("borrar_usuario", { p_usuario: usuario });
  if (error) {
    alert("Error borrando usuario: " + error.message);
  } else {
    alert("Usuario borrado");
    cargarUsuarios();
  }
};

cargarUsuarios();
