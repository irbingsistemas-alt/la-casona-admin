document.addEventListener("DOMContentLoaded", () => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");
  const rolInfo = document.getElementById("rolInfo");
  const modulos = document.getElementById("modulos");

  if (!usuario || !rol) {
    window.location.href = "index.html";
    return;
  }

  rolInfo.textContent = `Rol: ${rol} · Usuario: ${usuario}`;

  const accesos = {
    admin: [
      { nombre: "Administración", href: "modules/admin.html" },
      { nombre: "Bar", href: "modules/bar.html" },
      { nombre: "Dependientes", href: "modules/dependientes.html" },
      { nombre: "Cocina", href: "modules/cocina.html" },
    ],
    gerente: [
      { nombre: "Administración", href: "modules/admin.html" },
      { nombre: "Dependientes", href: "modules/dependientes.html" },
    ],
    bar: [{ nombre: "Bar", href: "modules/bar.html" }],
    cocina: [{ nombre: "Cocina", href: "modules/cocina.html" }],
    dependiente: [{ nombre: "Dependientes", href: "modules/dependientes.html" }],
  };

  const opciones = accesos[rol] || [];

  if (opciones.length === 0) {
    modulos.innerHTML = "<p>No tienes acceso a ningún módulo.</p>";
    return;
  }

  opciones.forEach((mod) => {
    const btn = document.createElement("a");
    btn.href = mod.href;
    btn.className = "btn";
    btn.style.margin = "8px";
    btn.textContent = mod.nombre;
    modulos.appendChild(btn);
  });

  document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });
});
