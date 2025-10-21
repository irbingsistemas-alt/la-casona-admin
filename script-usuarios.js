import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU" // tu clave pública
);

const tabla = document.querySelector("#tablaUsuarios tbody");

async function cargarUsuarios() {
  const { data, error } = await supabase.from("usuarios").select("*");

  if (error) {
    alert("❌ Error al cargar usuarios");
    return;
  }

  tabla.innerHTML = "";

  data.forEach(usuario => {
    const fila = document.createElement("tr");

    const celdaUsuario = document.createElement("td");
    celdaUsuario.textContent = usuario.usuario;

    const celdaRol = document.createElement("td");
    const selectRol = document.createElement("select");
    ["admin", "cocina", "reparto", "administrador"].forEach(r => {
      const option = document.createElement("option");
      option.value = r;
      option.textContent = r;
      if (usuario.rol === r) option.selected = true;
      selectRol.appendChild(option);
    });

    const celdaEditar = document.createElement("td");
    const inputClave = document.createElement("input");
    inputClave.type = "password";
    inputClave.placeholder = "Nueva clave";
    inputClave.style.width = "100px";

    const botonGuardar = document.createElement("button");
    botonGuardar.textContent = "💾";
    botonGuardar.onclick = () => editarUsuario(usuario.id, selectRol.value, inputClave.value);

    celdaRol.appendChild(selectRol);
    celdaEditar.appendChild(inputClave);
    celdaEditar.appendChild(botonGuardar);

    const celdaEliminar = document.createElement("td");
    const botonEliminar = document.createElement("button");
    botonEliminar.textContent = "🗑️";
    botonEliminar.onclick = () => eliminarUsuario(usuario.id);
    celdaEliminar.appendChild(botonEliminar);

    fila.appendChild(celdaUsuario);
    fila.appendChild(celdaRol);
    fila.appendChild(celdaEditar);
    fila.appendChild(celdaEliminar);

    tabla.appendChild(fila);
  });
}

async function agregarUsuario() {
  const usuario = document.getElementById("nuevoUsuario").value.trim();
  const clave = document.getElementById("nuevaClave").value.trim();
  const rol = document.getElementById("nuevoRol").value;

  if (!usuario || !clave || !rol) {
    alert("⚠️ Completa todos los campos");
    return;
  }

  const { error } = await supabase.from("usuarios").insert([{ usuario, clave, rol }]);

  if (error) {
    alert("❌ Error al agregar usuario");
    return;
  }

  document.getElementById("nuevoUsuario").value = "";
  document.getElementById("nuevaClave").value = "";
  document.getElementById("nuevoRol").value = "admin";

  await cargarUsuarios();
}

async function editarUsuario(id, nuevoRol, nuevaClave) {
  const cambios = {};
  if (nuevoRol) cambios.rol = nuevoRol;
  if (nuevaClave) cambios.clave = nuevaClave;

  const { error } = await supabase.from("usuarios").update(cambios).eq("id", id);

  if (error) {
    alert("❌ Error al editar usuario");
    return;
  }

  await cargarUsuarios();
}

async function eliminarUsuario(id) {
  const confirmar = confirm("¿Eliminar este usuario?");
  if (!confirmar) return;

  const { error } = await supabase.from("usuarios").delete().eq("id", id);

  if (error) {
    alert("❌ Error al eliminar usuario");
    return;
  }

  await cargarUsuarios();
}

function logout() {
  localStorage.removeItem("usuarioActivo");
  localStorage.removeItem("rol");
  window.location.href = "index.html";
}

window.agregarUsuario = agregarUsuario;
window.logout = logout;
window.onload = cargarUsuarios;
