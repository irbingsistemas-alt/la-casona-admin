import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Conexión con Supabase
const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

const form = document.getElementById("loginForm");
const mensajeError = document.getElementById("mensajeError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensajeError.textContent = "";

  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

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

  localStorage.setItem("usuarioActivo", usuario);
  localStorage.setItem("rol", data.rol);

  const destino = {
    admin: "admin.html",
    cocina: "cocina.html",
    bar: "bar.html",
    barra: "barra.html",
    pizzeria: "pizzeria.html",
    reparto: "reparto.html",
    administrador: "usuarios.html",
    dependiente: "dependientes.html"
  };

  if (destino[data.rol]) {
    window.location.href = `modules/${destino[data.rol]}`;
  } else {
    mensajeError.textContent = "❌ Rol no reconocido";
  }
});
