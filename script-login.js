const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function login() {
  const usuario = document.getElementById("usuario").value.trim();
  const clave = document.getElementById("clave").value.trim();

  if (!usuario || !clave) {
    alert("⚠️ Ingresa usuario y contraseña");
    return;
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("usuario", usuario)
    .eq("clave", clave)
    .single();

  if (error || !data) {
    alert("❌ Usuario o contraseña incorrectos");
    return;
  }

  localStorage.setItem("autenticado", "true");
  localStorage.setItem("usuarioActivo", usuario);
  window.location.href = "admin.html";
}
