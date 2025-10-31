import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Inicializar Supabase
const supabase = createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

window.supabase = supabase;

document.addEventListener("DOMContentLoaded", () => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");

  if (!usuario || !rol || !["admin", "gerente"].includes(rol)) {
    window.location.href = "../index.html";
    return;
  }

  document.getElementById("rolInfo").textContent = `Rol: ${rol} · Usuario: ${usuario}`;
  document.getElementById("usuario-conectado")?.textContent = usuario;

  document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../index.html";
  });

  // Aquí comenzamos la carga del menú
  cargarMenus();
});
