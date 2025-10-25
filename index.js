import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Inicializar Supabase
const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU" // tu anon key real
);

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const loader = document.getElementById("loader");
  const mensaje = document.getElementById("mensaje");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (mensaje) mensaje.textContent = "";
      if (loader) loader.style.display = "block";

      const usuario_input = document.getElementById("usuario").value.trim().toLowerCase();
      const clave_input = document.getElementById("clave").value.trim();

      if (!usuario_input || !clave_input) {
        if (loader) loader.style.display = "none";
        if (mensaje) mensaje.textContent = "Por favor completa todos los campos.";
        return;
      }

      try {
        const { data, error } = await supabase.rpc("login_usuario", {
          usuario_input,
          clave_input,
        });

        if (loader) loader.style.display = "none";

        if (error) {
          console.error("Error RPC:", error);
          if (mensaje) mensaje.textContent = "Error en el servidor. Intenta de nuevo.";
          return;
        }

        if (!data || data.length === 0) {
          if (mensaje) mensaje.textContent = "Usuario o contraseña incorrectos.";
          return;
        }

        const usuario = data[0];
        localStorage.setItem("usuario", usuario.usuario);
        localStorage.setItem("rol", usuario.rol);

        switch (usuario.rol) {
          case "dependiente":
            window.location.href = "modules/dependientes.html";
            break;
          case "cocina":
            window.location.href = "modules/cocina.html";
            break;
          case "bar":
            window.location.href = "modules/bar.html";
            break;
          case "admin":
          case "gerente":
            window.location.href = "modules/admin.html";
            break;
          default:
            if (mensaje) mensaje.textContent = "Rol no reconocido: " + usuario.rol;
        }
      } catch (err) {
        console.error("Excepción:", err);
        if (loader) loader.style.display = "none";
        if (mensaje) mensaje.textContent = "Error inesperado. Revisa la consola.";
      }
    });
  }
});
