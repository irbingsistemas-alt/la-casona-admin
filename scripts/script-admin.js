document.addEventListener("DOMContentLoaded", () => {
  const rol = localStorage.getItem("rol");
  const usuario = localStorage.getItem("usuario");

  const rolesPermitidos = ["admin", "gerente"]; // Ajusta según el módulo

  if (!usuario || !rolesPermitidos.includes(rol)) {
    window.location.href = "../index.html"; // Redirige al login
    return;
  }

  // Aquí continúa tu lógica normal del módulo...
});
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Inicializar Supabase
const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
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

  const nuevoUsuario = document.getElementById("nuevoUsuario").value.trim().toLowerCase();
  const nuevaClave = document.getElementById("nuevaClave").value.trim();
  const nuevoRol = document.getElementById("nuevoRol").value;

  if (!nuevoUsuario || !nuevaClave || !nuevoRol) {
    alert("Completa todos los campos para crear el usuario.");
    return;
  }

  const { error } = await supabase.rpc("crear_usuario", {
    p_usuario: nuevoUsuario,
    p_clave: nuevaClave,
    p_rol: nuevoRol,
    p_admin: usuario
  });

  if (error) {
    alert("❌ Error creando usuario: " + error.message);
  } else {
    alert("✅ Usuario creado con éxito");
    document.getElementById("crearForm").reset();
    cargarUsuarios();
    cargarLogs();
  }
});

// Cambiar clave
document.getElementById("cambiarForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const usuarioClave = document.getElementById("usuarioClave").value.trim().toLowerCase();
  const nuevaClaveUsuario = document.getElementById("nuevaClaveUsuario").value.trim();

  if (!usuarioClave || !nuevaClaveUsuario) {
    alert("Completa ambos campos para cambiar la clave.");
    return;
  }

  const { data, error } = await supabase.rpc("cambiar_clave", {
    p_usuario: usuarioClave,
    p_clave: nuevaClaveUsuario,
    p_admin: usuario
  });

  if (error) {
    alert("❌ Error cambiando clave: " + error.message);
  } else {
    const mensaje = data?.mensaje || "Clave actualizada con éxito para " + usuarioClave;
    alert("🔐 " + mensaje);
    document.getElementById("cambiarForm").reset();
    cargarLogs();
  }
});

// Cargar usuarios
async function cargarUsuarios() {
  try {
    const tbody = document.getElementById("tablaUsuarios");
    tbody.innerHTML = `<tr><td colspan="3">Cargando usuarios…</td></tr>`;

    // Intenta obtener rol desde relación roles(nombre) o, si no existe, solo usuario/id
    // Ajusta "roles(nombre)" si tu relación tiene otro nombre.
    const { data, error } = await supabase
      .from("usuarios")
      .select("usuario, id, roles(nombre)")
      .order("usuario", { ascending: true })
      .limit(1000);

    if (error) {
      // Si la columna/relación no existe, reintenta con una select más simple
      console.warn('Primera consulta usuarios fallo, reintentando sin roles:', error);
      const fallback = await supabase
        .from("usuarios")
        .select("usuario, id")
        .order("usuario", { ascending: true })
        .limit(1000);
      if (fallback.error) {
        tbody.innerHTML = `<tr><td colspan="3">Error cargando usuarios: ${escapeHtml(fallback.error.message || JSON.stringify(fallback.error))}</td></tr>`;
        console.error("Error cargando usuarios fallback:", fallback.error);
        return;
      }
      renderUsuariosFromData(fallback.data || []);
      return;
    }

    renderUsuariosFromData(data || []);
  } catch (err) {
    console.error("Error cargando usuarios (excepción):", err);
    const tbody = document.getElementById("tablaUsuarios");
    tbody.innerHTML = `<tr><td colspan="3">Excepción al cargar usuarios: ${escapeHtml(err.message || JSON.stringify(err))}</td></tr>`;
  }
}

function renderUsuariosFromData(data) {
  const tbody = document.getElementById("tablaUsuarios");
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3">No hay usuarios registrados.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  (data || []).forEach(u => {
    // si traes roles(nombre) la propiedad será u.roles?.nombre
    const rolText = (u.roles && u.roles.nombre) ? u.roles.nombre : (u.rol ?? "—");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(u.usuario)}</td>
      <td>${escapeHtml(rolText)}</td>
      <td><button data-usuario="${escapeHtml(u.usuario)}" class="btn-borrar">Borrar</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// Borrar usuario
window.borrarUsuario = async (usuarioAfectado) => {
  if (!confirm("¿Seguro que quieres borrar " + usuarioAfectado + "?")) return;

  const { error } = await supabase.rpc("borrar_usuario", {
    p_usuario: usuarioAfectado,
    p_admin: usuario
  });

  if (error) {
    alert("❌ Error borrando usuario: " + error.message);
  } else {
    alert("🗑️ Usuario borrado");
    cargarUsuarios();
    cargarLogs();
  }
};

// Cargar logs
async function cargarLogs() {
  const { data, error } = await supabase
    .from("logs_admin")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error cargando logs:", error);
    return;
  }

  const tbody = document.getElementById("tablaLogs");
  tbody.innerHTML = "";
  data.forEach(l => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${l.accion}</td>
      <td>${l.usuario_afectado}</td>
      <td>${l.realizado_por}</td>
      <td>${new Date(l.fecha).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Inicializar
cargarUsuarios();
cargarLogs();
