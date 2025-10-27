document.getElementById("btn_login").onclick = async () => {
  const usuario = usuario_input.value.trim();
  const clave = clave_input.value.trim();
  if (!usuario || !clave) {
    mensaje_login.textContent = "Completa ambos campos.";
    return;
  }

  const { data, error } = await supabase
    .rpc("login_usuario", { usuario_input: usuario, clave_input: clave });

  if (error || !data) {
    mensaje_login.textContent = "Credenciales inválidas.";
    return;
  }

  const { id, usuario: nombre, rol } = data;

  if (!["admin", "dependiente", "gerente"].includes(rol)) {
    mensaje_login.textContent = "Acceso denegado para este rol.";
    return;
  }

  localStorage.setItem("usuario_id", id);
  localStorage.setItem("usuario_nombre", nombre);
  localStorage.setItem("usuario_rol", rol);

  nombre_usuario.textContent = nombre;
  login.style.display = "none";
  panel.style.display = "block";

  cargar_menu();
  cargar_pendientes();
  cargar_resumen();
};

function cargar_menu() {
  menu_items.innerHTML = "";
  filtro_categoria.innerHTML = "";

  supabase
    .from("menus")
    .select("*")
    .eq("activo", true)
    .then(({ data, error }) => {
      if (error) return;

      const categorias = [...new Set(data.map(item => item.categoria))];
      filtro_categoria.innerHTML = `<option value="">Todas</option>` +
        categorias.map(cat => `<option value="${cat}">${cat}</option>`).join("");

      render_menu(data);

      filtro_categoria.onchange = () => {
        const seleccion = filtro_categoria.value;
        const filtrado = seleccion
          ? data.filter(item => item.categoria === seleccion)
          : data;
        render_menu(filtrado);
      };
    });
}

function render_menu(lista) {
  menu_items.innerHTML = lista.map(item => `
    <div class="menu-item">
      <strong>${item.nombre}</strong> - ${item.precio} CUP
      <input type="number" min="0" value="0"
        data-nombre="${item.nombre}"
        data-precio="${item.precio}" />
    </div>
  `).join("");
}
btn_revisar.onclick = () => {
  const mesa = mesa_input.value.trim().toLowerCase();
  const local = local_input.value;
  const items = document.querySelectorAll(".menu-item input");
  const resumen = [];
  let total = 0;

  items.forEach(input => {
    const cantidad = parseInt(input.value);
    if (cantidad > 0) {
      const nombre = input.dataset.nombre;
      const precio = parseFloat(input.dataset.precio);
      const subtotal = cantidad * precio;
      total += subtotal;
      resumen.push({ nombre, cantidad, subtotal });
    }
  });

  if (!mesa || resumen.length === 0) {
    alert("Completa la mesa y selecciona al menos un plato.");
    return;
  }

  resumen_contenido.innerHTML = `
    <p><strong>Mesa:</strong> ${mesa}</p>
    <p><strong>Local:</strong> ${local}</p>
    <ul>
      ${resumen.map(item => `
        <li>${item.nombre} x${item.cantidad} = ${item.subtotal.toFixed(2)} CUP</li>
      `).join("")}
    </ul>
    <p><strong>Total:</strong> ${total.toFixed(2)} CUP</p>
  `;

  resumen_pedido.style.display = "block";
};

btn_cancelar.onclick = () => {
  resumen_pedido.style.display = "none";
};

btn_confirmar.onclick = async () => {
  const usuario_id = localStorage.getItem("usuario_id");
  const mesa = mesa_input.value.trim().toLowerCase();
  const local = local_input.value;
  const items = document.querySelectorAll(".menu-item input");
  const seleccion = [];

  items.forEach(input => {
    const cantidad = parseInt(input.value);
    if (cantidad > 0) {
      const nombre = input.dataset.nombre;
      const precio = parseFloat(input.dataset.precio);
      seleccion.push({ nombre, cantidad, precio });
    }
  });

  const total = seleccion.reduce((acc, item) => acc + item.cantidad * item.precio, 0);

  const { error } = await supabase.rpc("crear_o_actualizar_pedido", {
    p_usuario_id: usuario_id,
    p_mesa: mesa,
    p_local: local,
    p_items: seleccion,
    p_total: total
  });

  if (error) {
    alert("Error al confirmar pedido.");
    return;
  }

  resumen_pedido.style.display = "none";
  mesa_input.value = "";
  local_input.value = "restaurant";
  items.forEach(i => i.value = "");
  cargar_pendientes();
  cargar_resumen();
  alert("Pedido confirmado con éxito.");
};

function cargar_pendientes() {
  const usuario_id = localStorage.getItem("usuario_id");
  lista_pendientes.innerHTML = "";

  supabase.rpc("resumen_pendientes", { p_usuario_id: usuario_id })
    .then(({ data, error }) => {
      if (error || !data) return;

      data.forEach(pedido => {
        const div = document.createElement("div");
        div.className = "pedido-pendiente";
        div.innerHTML = `
          <p><strong>Mesa:</strong> ${pedido.mesa}</p>
          <p><strong>Total:</strong> ${pedido.total} CUP</p>
          <p><strong>Hora:</strong> ${new Date(pedido.fecha).toLocaleTimeString()}</p>
          <button class="btn-cobrar" data-id="${pedido.id}">Cobrar</button>
        `;
        lista_pendientes.appendChild(div);
      });

      document.querySelectorAll(".btn-cobrar").forEach(btn => {
        btn.onclick = async () => {
          const pedido_id = btn.dataset.id;
          const usuario_id = localStorage.getItem("usuario_id");
          const { error } = await supabase.rpc("marca_pedido_cobrado", {
            p_pedido_id: pedido_id,
            p_usuario_id: usuario_id
          });
          if (!error) {
            cargar_pendientes();
            cargar_resumen();
            alert("Pedido cobrado.");
          }
        };
      });
    });
}

function cargar_resumen() {
  const usuario_id = localStorage.getItem("usuario_id");
  resumen_texto.textContent = "";

  supabase.rpc("resumen_cobrados", { p_usuario_id: usuario_id })
    .then(({ data, error }) => {
      if (error || !data) return;
      resumen_texto.textContent = `Pedidos cobrados: ${data.pedidos_cobrados} | Total: ${data.importe_total} CUP`;
    });
}

btn_logout.onclick = () => {
  localStorage.clear();
  panel.style.display = "none";
  login.style.display = "block";
  usuario_input.value = "";
  clave_input.value = "";
  mensaje_login.textContent = "";
};
