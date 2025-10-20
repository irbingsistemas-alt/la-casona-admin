const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  if (!usuario || !clave) {
    alert("⚠️ Ingresa usuario y contraseña");
    return;
  }

  const { data, error } = await supabase.rpc("validar_login", {
    usuario_input: usuario,
    clave_input: clave
  });

  if (error || !data || data.length === 0) {
    alert("❌ Usuario o contraseña incorrectos");
    return;
  }

  localStorage.setItem("autenticado", "true");
  localStorage.setItem("usuarioActivo", usuario);
  localStorage.setItem("rolActivo", data[0].rol || "admin");

  window.location.href = "admin.html";
}
