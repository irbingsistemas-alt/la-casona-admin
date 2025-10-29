document.addEventListener("DOMContentLoaded", () => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");
  const rolInfo = document.getElementById("rolInfo");
  const modulos = document.getElementById("modulos");

  if (!usuario || !rol) {
    window.location.href = "../index.html";
    return;
  }

  rolInfo.textContent = `Rol: ${rol} · Usuario: ${usuario}`;

  const accesos = {
    admin: [
      { nombre: "Administración", href: "../modules/admin.html", icon: "🛠️" },
      { nombre: "Bar", href: "../modules/bar.html", icon: "🍸" },
      { nombre: "Dependientes", href: "../modules/dependientes.html", icon: "🧾" },
      { nombre: "Cocina", href: "../modules/cocina.html", icon: "🍽️" },
    ],
    gerente: [
      { nombre: "Administración", href: "../modules/admin.html", icon: "🛠️" },
      { nombre: "Dependientes", href: "../modules/dependientes.html", icon: "🧾" },
    ],
    bar: [{ nombre: "Bar", href: "../modules/bar.html", icon: "🍸" }],
    cocina: [{ nombre: "Cocina", href: "../modules/cocina.html", icon: "🍽️" }],
    dependiente: [{ nombre: "Dependientes", href: "../modules/dependientes.html", icon: "🧾" }],
  };

  const opciones = accesos[rol] || [];

  if (opciones.length === 0) {
    modulos.innerHTML = "<p>No tienes acceso a ningún módulo.</p>";
    return;
  }

  opciones.forEach((mod) => {
    const card = document.createElement("a");
    card.href = mod.href;
    card.className = "modulo-card";
    card.innerHTML = `
      <div class="modulo-icon">${mod.icon}</div>
      <div><strong>${mod.nombre}</strong></div>
    `;
    modulos.appendChild(card);
  });

  document.getElementById("btnLogout").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "index.html";
  });
});
