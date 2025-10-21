// index.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Conexión con Supabase usando la clave pública (anon key)
const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU" // reemplaza con tu anon key real
);

// ✅ Referencias al formulario y mensaje de error
const form = document.getElementById("loginForm");
const mensajeError = document.getElementById("mensajeError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensajeError.textContent = "";

  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  // ✅ Consulta segura a la tabla usuarios
  const { data, error } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("usuario", usuario)
    .eq("clave", clave)
    .single();

  if (error || !data) {
    mensajeError.textContent = "❌ Usuario o clave incorrecta";
    return;
  }

  // ✅ Guardar sesión en localStorage
  localStorage.setItem("usuarioActivo", usuario);
  localStorage.setItem("rol", data.rol);

  // ✅ Redirigir según el rol
  if (data.rol === "admin") {
    window.location.href = "admin.html";
  } else if (data.rol === "cocina") {
    window.location.href = "cocina.html";
  } else if (data.rol === "reparto") {
    window.location.href = "reparto.html";
  } else {
    mensajeError.textContent = "❌ Rol no reconocido";
  }
});
