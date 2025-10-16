if (localStorage.getItem("autenticado") !== "true") {
  window.location.href = "index.html";
}

let menu = [];

function mostrar() {
  const tbody = document.querySelector("#tabla tbody");
  tbody.innerHTML = "";
  menu.forEach((item, i) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td><input value="${item.nombre}" onchange="editar(${i}, 'nombre', this.value)" /></td>
      <td><input type="number" value="${item.precio}" onchange="editar(${i}, 'precio', this.value)" /></td>
      <td><input value="${item.categoria}" onchange="editar(${i}, 'categoria', this.value)" /></td>
      <td><button onclick="eliminar(${i})">X</button></td>
    `;
    tbody.appendChild(fila);
  });
}

function editar(i, campo, valor) {
  menu[i][campo] = valor;
}

function eliminar(i) {
  menu.splice(i, 1);
  mostrar();
}

function agregarPlato() {
  const nombre = document.getElementById("nuevoNombre").value;
  const precio = document.getElementById("nuevoPrecio").value;
  const categoria = document.getElementById("nuevaCategoria").value;
  if (nombre && precio && categoria) {
    menu.push({ nombre, precio, categoria });
    mostrar();
    document.getElementById("nuevoNombre").value = "";
    document.getElementById("nuevoPrecio").value = "";
    document.getElementById("nuevaCategoria").value = "";
  } else {
    alert("Completa todos los campos");
  }
}

function guardar() {
  localStorage.setItem("menu", JSON.stringify(menu));
  alert("Menú guardado");
}

function logout() {
  localStorage.removeItem("autenticado");
  window.location.href = "index.html";
}

window.onload = () => {
  const guardado = localStorage.getItem("menu");
  menu = guardado ? JSON.parse(guardado) : [];
  mostrar();
};
