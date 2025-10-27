import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Ajusta la ANON_KEY exactamente como en los demás módulos
const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// --- Helpers UI ---
const $ = id => document.getElementById(id);

function showMain(usuarioNombre) {
  $('login-panel').style.display = 'none';
  $('main-panel').style.display = 'block';
  $('bienvenida').textContent = `Bienvenido, ${usuarioNombre}`;
}

// --- Login ---
$('btn-login').addEventListener('click', async () => {
  $('login-error').textContent = '';
  const usuario = $('usuario').value.trim();
  const clave = $('clave').value.trim();
  if (!usuario || !clave) {
    $('login-error').textContent = 'Completa usuario y clave';
    return;
  }

  const { data, error } = await supabase.rpc('login_usuario', {
    usuario_input: usuario,
    clave_input: clave
  });

  if (error || !data || data.length === 0) {
    $('login-error').textContent = 'Credenciales incorrectas';
    console.error('login_usuario error', error);
    return;
  }

  const u = data[0];
  // Guardar datos localmente (las funciones DB actuales no devuelven token)
  localStorage.setItem('usuario_id', u.id);
  localStorage.setItem('usuario_nombre', u.usuario);
  localStorage.setItem('usuario_rol', u.rol);

  showMain(u.usuario);
  await cargarMenu();
  await cargarPedidosPendientes();
  await cargarResumen();
});

// Logout
$('btn-logout').addEventListener('click', () => {
  localStorage.clear();
  location.reload();
});

// --- Cargar menú ---
async function cargarMenu() {
  const contenedor = $('menu-contenedor');
  contenedor.innerHTML = '';

  const { data, error } = await supabase
    .from('menus')
    .select('id, nombre, precio, categoria')
    .eq('disponible', true)
    .order('categoria', { ascending: true });

  if (error) {
    console.error('Error cargando menú', error);
    contenedor.innerHTML = '<p class="mensaje-error">No se pudo cargar el menú</p>';
    return;
  }
  const agrupado = {};
  (data || []).forEach(item => {
    const cat = item.categoria || 'Sin categoría';
    if (!agrupado[cat]) agrupado[cat] = [];
    agrupado[cat].push(item);
  });

  for (const categoria of Object.keys(agrupado)) {
    const grupo = document.createElement('div');
    grupo.className = 'categoria-grupo';
    const titulo = document.createElement('h4');
    titulo.textContent = categoria;
    grupo.appendChild(titulo);

    agrupado[categoria].forEach(plato => {
      const fila = document.createElement('div');
      fila.style.display = 'flex';
      fila.style.justifyContent = 'space-between';
      fila.style.alignItems = 'center';
      fila.style.gap = '12px';

      const nombre = document.createElement('span');
      nombre.textContent = plato.nombre;
      nombre.style.flex = '1';

      const precio = document.createElement('span');
      precio.className = 'menu-precio';
      precio.textContent = `${plato.precio} CUP`;
      precio.dataset.precio = String(plato.precio);
      precio.style.minWidth = '90px';
      precio.style.textAlign = 'right';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = 0;
      input.value = 0;
      input.style.width = '72px';
      input.setAttribute('aria-label', `Cantidad de ${plato.nombre}`);
      input.dataset.menuId = plato.id;
      input.addEventListener('input', actualizarTotales);

      fila.appendChild(nombre);
      fila.appendChild(precio);
      fila.appendChild(input);
      grupo.appendChild(fila);
    });

    contenedor.appendChild(grupo);
  }

  actualizarTotales();
}

// --- Limpiar selección ---
$('btn-limpiar').addEventListener('click', () => {
  document.querySelectorAll('#menu-contenedor input[type="number"]').forEach(i => i.value = 0);
  actualizarTotales();
});

// --- Actualizar totales ---
function actualizarTotales() {
  let total = 0;
  let cantidad = 0;
  document.querySelectorAll('#menu-contenedor .categoria-grupo').forEach(grupo => {
    grupo.querySelectorAll('div').forEach(fila => {
      const input = fila.querySelector('input[type="number"]');
      if (!input) return;
      const valor = parseInt(input.value) || 0;
      const precioEl = fila.querySelector('.menu-precio');
      const precio = parseFloat(precioEl?.dataset?.precio) || 0;
      total += valor * precio;
      cantidad += valor;
    });
  });
  $('total-cup').textContent = total.toFixed(2);
  $('total-items').textContent = cantidad;
}

// --- Cargar pedidos pendientes ---
async function cargarPedidosPendientes() {
  const usuario_id = localStorage.getItem('usuario_id');
  const contenedor = $('pedidos-contenedor');
  contenedor.innerHTML = '';

  if (!usuario_id) {
    contenedor.innerHTML = '<p class="mensaje-error">Usuario no autenticado</p>';
    return;
  }

  const hoyISO = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, mesa, total, fecha')
    .eq('usuario_id', usuario_id)
    .eq('cobrado', false)
    .gte('fecha', hoyISO);

  if (error) {
    console.error('Error cargando pedidos', error);
    contenedor.innerHTML = '<p class="mensaje-error">No se pudieron cargar pedidos</p>';
    return;
  }

  (data || []).forEach(p => {
    const div = document.createElement('div');
    div.className = 'pedido-pendiente';
    div.innerHTML = `
      <p><strong>Mesa:</strong> ${p.mesa || '—'}</p>
      <p><strong>Total:</strong> ${p.total} CUP</p>
      <p><strong>Hora:</strong> ${ new Date(p.fecha).toLocaleTimeString() }</p>
      <div class="botonera">
        <button class="btn-detalle" data-id="${p.id}">Ver detalles</button>
        <button class="btn-cobrar" data-id="${p.id}">Cobrar</button>
      </div>
    `;
    contenedor.appendChild(div);
  });

  // Delegación de eventos
  contenedor.querySelectorAll('.btn-detalle').forEach(b => b.addEventListener('click', (e) => verDetalles(e.target.dataset.id)));
  contenedor.querySelectorAll('.btn-cobrar').forEach(b => b.addEventListener('click', (e) => cobrarPedido(e.target.dataset.id)));
}

// --- Ver detalles ---
async function verDetalles(pedido_id) {
  const { data, error } = await supabase
    .from('vista_pedido_detalle')
    .select('nombre, cantidad, precio, actualizado_en')
    .eq('pedido_id', pedido_id);

  if (error) {
    console.error('Error en verDetalles', error);
    return;
  }

  const cont = $('detalle-contenedor');
  cont.innerHTML = '';
  (data || []).forEach(item => {
    const fila = document.createElement('div');
    fila.className = 'item-actualizado';
    fila.innerHTML = `
      <p><strong>${item.nombre}</strong></p>
      <p>Cantidad: ${item.cantidad}</p>
      <p>Precio: ${item.precio} CUP</p>
      <p>Última modificación: ${ item.actualizado_en ? new Date(item.actualizado_en).toLocaleTimeString() : '—' }</p>
    `;
    cont.appendChild(fila);
  });

  $('modal-detalles').style.display = 'flex';
}

// Cerrar modal
$('modal-close').addEventListener('click', () => $('modal-detalles').style.display = 'none');

// --- Cobrar pedido (usando RPC marca_pedido_cobrado) ---
async function cobrarPedido(pedido_id) {
  const usuario_id = localStorage.getItem('usuario_id');
  if (!usuario_id) {
    alert('Usuario no autenticado');
    return;
  }

  const { error } = await supabase.rpc('marca_pedido_cobrado', {
    p_pedido_id: pedido_id,
    p_usuario_id: usuario_id
  });

  if (error) {
    console.error('Error cobrando pedido', error);
    alert('No se pudo cobrar el pedido (ver consola)');
    return;
  }

  await cargarPedidosPendientes();
  await cargarResumen();
}

// --- Cargar resumen del día ---
async function cargarResumen() {
  const usuario_id = localStorage.getItem('usuario_id');
  const fecha = new Date().toISOString().split('T')[0];
  $('resumen-fecha').textContent = fecha;
  $('resumen-usuario').textContent = localStorage.getItem('usuario_nombre') || '—';

  if (!usuario_id) {
    $('resumen-cobrados').textContent = '0';
    $('resumen-cobrado').textContent = '0.00';
    $('resumen-pendientes').textContent = '0';
    $('resumen-pendiente').textContent = '0.00';
    return;
  }

  const { data: cobrados, error: errorC } = await supabase.rpc('resumen_cobrados', { p_usuario_id: usuario_id });
  const { data: pendientes, error: errorP } = await supabase.rpc('resumen_pendientes', { p_usuario_id: usuario_id });

  if (errorC) console.error('RPC resumen_cobrados', errorC);
  if (errorP) console.error('RPC resumen_pendientes', errorP);

  $('resumen-cobrados').textContent = (cobrados?.pedidos_cobrados ?? 0);
  $('resumen-cobrado').textContent = (Number(cobrados?.importe_cobrado ?? 0)).toFixed(2);
  $('resumen-pendientes').textContent = (pendientes?.pedidos_pendientes ?? 0);
  $('resumen-pendiente').textContent = (Number(pendientes?.importe_pendiente ?? 0)).toFixed(2);
}

// --- Inicio: si ya hay usuario en localStorage mostramos main ---
document.addEventListener('DOMContentLoaded', async () => {
  const stored = localStorage.getItem('usuario_id');
  const storedName = localStorage.getItem('usuario_nombre');
  if (stored && storedName) {
    showMain(storedName);
    await cargarMenu();
    await cargarPedidosPendientes();
    await cargarResumen();
  }
});
