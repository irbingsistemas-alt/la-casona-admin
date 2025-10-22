import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://ihswokmnhwaitzwjzvmy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU';

const supabase = createClient(supabaseUrl, supabaseKey);

// 🔐 Autenticación de usuario dependiente
export async function autenticarUsuario(usuario, clave) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, rol')
    .eq('usuario', usuario)
    .eq('clave', clave)
    .single();

  if (error || !data || data.rol !== 'dependiente') {
    return null;
  }

  return data.id;
}

// 🍽️ Obtener menú activo desde 'menus'
export async function obtenerMenu() {
  const { data, error } = await supabase
    .from('menus')
    .select('id, nombre, precio, categoria')
    .eq('activo', true)
    .order('categoria', { ascending: true });

  return data || [];
}

// 🧾 Enviar pedido completo a la base de datos
export async function enviarPedidoADatabase({ local, mesa, pedido, total, usuario_id }) {
  const { data: pedidoInsertado, error } = await supabase
    .from('pedidos')
    .insert([
      {
        local,
        mesa,
        platos: pedido,
        total,
        entregado: false,
        cobrado: false,
        fecha: new Date().toISOString(),
        usuario_id
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('❌ Error al guardar pedido:', error);
    return;
  }

  for (const item of pedido) {
    await supabase.from('pedido_items').insert([
      {
        pedido_id: pedidoInsertado.id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        subtotal: item.precio * item.cantidad
      }
    ]);
  }
}

// 📊 Obtener resumen diario de cobros por dependiente
export async function obtenerResumenDelDia(usuario_id) {
  const { data, error } = await supabase
    .from('pedidos')
    .select('total')
    .eq('usuario_id', usuario_id)
    .eq('cobrado', true); // ✅ booleano

  if (error) return { cantidad: 0, total: 0 };

  const cantidad = data.length;
  const total = data.reduce((sum, p) => sum + p.total, 0);
  return { cantidad, total };
}
