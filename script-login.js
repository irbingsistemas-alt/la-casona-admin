function login() {
  const usuario = document.getElementById("usuario").value;
  const clave = document.getElementById("clave").value;

  if (usuario === "admin" && clave === "casona17") {
    localStorage.setItem("autenticado", "true");
    window.location.href = "admin.html";
  } else {
    alert("Usuario o contraseña incorrectos");
  }
}
