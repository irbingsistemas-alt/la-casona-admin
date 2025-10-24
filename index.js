import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ⚠️ Sustituye con tu anon key real desde Project Settings → API → anon public
const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // Normalizar usuario a minúsculas
      const usuario_input = document.getElementById("usuario").value.toLowerCase();
      const clave_input = document.getElementById("clave").value;

      try {
        const { data, error } = await supabase.rpc("login_usuario", {
          usuario_input,
          clave_input,
        });

        if (error) {
          console.error("Error RPC:", error);
          alert("Error en el servidor. Intenta de nuevo.");
          return;
        }

        if (!data || data.length === 0) {
          alert("Usuario o contraseña incorrectos.");
          return;
        }

        const usuario = data[0];

        // Guardar sesión en localStorage
        localStorage.setItem("usuario", usuario.usuario);
        localStorage.setItem("rol", usuario.rol);

        // Redirigir según rol
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
            alert("Rol no reconocido: " + usuario.rol);
        }
      } catch (err) {
        console.error("Excepción:", err);
        alert("Error inesperado. Revisa la consola.");
      }
    });
  }
});
