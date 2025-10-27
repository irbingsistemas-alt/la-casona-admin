// === Inicializar Supabase ===
const supabaseClient = window.supabase.createClient(
  "https://ihswokmnhwaitzwjzvmy.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
);

// === Login ===
document.getElementById('btn-login').addEventListener('click', async () => {
  const usuario = document.getElementById('usuario').value.trim();
  const clave = document.getElementById('clave').value.trim();

  const { data, error } = await supabaseClient.rpc('login_usuario', {
    usuario_input: usuario,
    clave_input: clave
  });

  if (error || !data || data.length === 0) {
    document.getElementById('login-error').textContent = 'Credenciales incorrectas';
    return;
  }

  const usuarioData = data[0];
  localStorage.setItem('usuario_id', usuarioData.id);
  localStorage.setItem('usuario_nombre', usuarioData.usuario);
  localStorage.setItem('usuario_rol', usuarioData.rol);

  document.getElementById('login-panel').style.display = 'none';
  document.getElementById('main-panel').style.display = 'block';
  document.getElementById('bienvenida').textContent = `Bienvenido, ${usuarioData.usuario}`;

  cargarMenu();
  cargarPedidosPendientes();
  cargarResumen();
});

// === Logout ===
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.clear();
  location.reload();
});

// === Cargar menú disponible ===
async function cargarMenu() {
  const contenedor = document.getElementById('menu-contenedor');
  contenedor.innerHTML = '';

  const { data, error } = await supabaseClient
    .from('menus')
    .select('id, nombre, precio, categoria')
    .eq('disponible', true)
    .order('categoria', { ascending: true });

  if (error) {
    console.error('Error cargando menú', error);
    return;
  }

  const agrupado = {};
  data.forEach(item => {
    if (!agrupado[item.categoria]) agrupado[item.categoria] = [];
    agrupado[item.categoria].push(item);
  });

  for (const categoria in agrupado) {
    const grupo = document.createElement('div');
    grupo.className = 'categoria-grupo';

    const titulo = document.createElement('h4');
    titulo.textContent = categoria;
    grupo.appendChild(titulo);

    agrupado[categoria].forEach(plato => {
      const fila = document.createElement('div');

      const nombre = document.createElement('span');
      nombre.textContent = plato.nombre;

      const precio = document.createElement('span');
      precio.textContent = `${plato.precio} CUP`;

      const input = document.createElement('input');
      input.type = 'number';
      input.min = 0;
      input.value = 0;
      input.addEventListener('input', actualizarTotales);

      fila.appendChild(nombre);
      fila.appendChild(precio);
      fila.appendChild(input);
      grupo.appendChild(fila);
    });

    contenedor.appendChild(grupo);
  }
}

// === Limpiar selección ===
document.getElementById('btn-limpiar').addEventListener('click', () => {
  document.querySelectorAll('#menu-contenedor input[type="number"]').forEach(input => {
    input.value = 0;
  });
  actualizarTotales();
});

// === Actualizar totales ===
function actualizarTotales() {
  let total = 0;
  let cantidad = 0;
  document.querySelectorAll('#menu-contenedor .categoria-grupo').forEach(grupo => {
    // Cada fila: [0]=nombre, [1]=precio, [2]=input
    grupo.querySelectorAll('div').forEach(fila => {
      const input = fila.querySelector('input[type="number"]');
      const precioSpan = fila.querySelector('span:nth-child(2)');
      const valor = parseInt(input.value) || 0;
      const precio = parseFloat(precioSpan.textContent) || 0;
      total += valor * precio;
      cantidad += valor;
    });
  });
  document.getElementById('total-cup').textContent = total.toFixed(2);
  document.getElementById('total-items').textContent = cantidad;
}
// === Cargar pedidos pendientes ===
async function cargarPedidosPendientes() {
  const usuario_id = localStorage.getItem('usuario_id');
  const contenedor = document.getElementById('pedidos-contenedor');
  contenedor.innerHTML = '';

  const { data, error } = await supabaseClient
    .from('pedidos')
    .select('id, mesa, total, fecha')
    .eq('usuario_id', usuario_id)
    .eq('cobrado', false)
    .gte('fecha', new Date().toISOString().split('T')[0]);

  if (error) {
    console.error('Error cargando pedidos', error);
    return;
  }
  if (!data) return;

  data.forEach(pedido => {
    const div = document.createElement('div');
    div.className = 'pedido-pendiente';

    div.innerHTML = `
      <p><strong>Mesa:</strong> ${pedido.mesa}</p>
      <p><strong>Total:</strong> ${pedido.total} CUP</p>
      <p><strong>Hora:</strong> ${new Date(pedido.fecha).toLocaleTimeString()}</p>
      <div class="botonera">
        <button onclick="verDetalles('${pedido.id}')">Ver detalles</button>
        <button onclick="cobrarPedido('${pedido.id}')">Cobrar</button>
      </div>
    `;

    contenedor.appendChild(div);
  });
}

// === Ver detalles del pedido ===
async function verDetalles(pedido_id) {
  const { data, error } = await supabaseClient
    .from('vista_pedido_detalle')
    .select('nombre_plato, cantidad, precio, updated_at')
    .eq('pedido_id', pedido_id);

  if (error) {
    console.error('Error en verDetalles', error);
    return;
  }
  if (!data) return;

  const contenedor = document.getElementById('detalle-contenedor');
  contenedor.innerHTML = '';

  data.forEach(item => {
    const fila = document.createElement('div');
    fila.className = 'item-actualizado';
    fila.innerHTML = `
      <p><strong>${item.nombre_plato}</strong></p>
      <p>Cantidad: ${item.cantidad}</p>
      <p>Precio: ${item.precio} CUP</p>
      <p>Última modificación: ${new Date(item.updated_at).toLocaleTimeString()}</p>
    `;
    contenedor.appendChild(fila);
  });

  document.getElementById('modal-detalles').style.display = 'flex';
}

// === Cerrar modal ===
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal-detalles').style.display = 'none';
});

// === Cobrar pedido ===
async function cobrarPedido(pedido_id) {
  const { error } = await supabaseClient
    .from('pedidos')
    .update({ cobrado: true })
    .eq('id', pedido_id);

  if (error) {
    console.error('Error cobrando pedido', error);
    return;
  }

  cargarPedidosPendientes();
  cargarResumen();
}

// === Cargar resumen del día ===
async function cargarResumen() {
  const usuario_id = localStorage.getItem('usuario_id');
  const fecha = new Date().toISOString().split('T')[0];
  document.getElementById('resumen-fecha').textContent = fecha;
  document.getElementById('resumen-usuario').textContent = localStorage.getItem('usuario_nombre');

  const { data: cobrados, error: errorC } = await supabaseClient
    .rpc('resumen_cobrados', { usuario_id });

  const { data: pendientes, error: errorP } = await supabaseClient
    .rpc('resumen_pendientes', { usuario_id });

  if (errorC) console.error('RPC resumen_cobrados', errorC);
  if (errorP) console.error('RPC resumen_pendientes', errorP);

  document.getElementById('resumen-cobrados').textContent = cobrados?.pedidos_cobrados || 0;
  document.getElementById('resumen-cobrado').textContent = (cobrados?.importe_cobrado ?? 0).toFixed(2);
  document.getElementById('resumen-pendientes').textContent = pendientes?.pedidos_pendientes || 0;
  document.getElementById('resumen-pendiente').textContent = (pendientes?.importe_pendiente ?? 0).toFixed(2);
}
