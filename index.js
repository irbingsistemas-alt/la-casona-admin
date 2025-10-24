import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // tu anon key
);

const form = document.getElementById("loginForm");
const mensajeError = document.getElementById("mensajeError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  mensajeError.textContent = "";

  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  const { data, error } = await supabase
    .rpc("login_usuario", { usuario_input: usuario, clave_input: clave })
    .single();

  if (error || !data) {
    mensajeError.textContent = "❌ Usuario o clave incorrecta";
    return;
  }

  localStorage.setItem("usuarioActivo", data.usuario);
  localStorage.setItem("rol", data.rol);

  const destino = {
    admin: "modules/admin.html",
    cocina: "modules/cocina.html",
    bar: "modules/bar.html",
    barra: "modules/barra.html",
    pizzeria: "modules/pizzeria.html",
    reparto: "modules/reparto.html",
    gerente: "modules/usuarios.html",   // nuevo rol
    dependiente: "modules/dependientes.html"
  };

  if (destino[data.rol]) {
    window.location.href = destino[data.rol];
  } else {
    mensajeError.textContent = "❌ Rol no reconocido";
  }
});
