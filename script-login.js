const supabase = window.supabase.createClient(https://ihswokmnhwaitzwjzvmy.supabase.co, eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU);

async function login() {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

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
  window.location.href = "admin.html";
}
