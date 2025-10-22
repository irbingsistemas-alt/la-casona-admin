import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://ihswokmnhwaitzwjzvmy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function autenticarUsuario(usuario, clave) {
  const { data, error } = await supabase
    .from('dependientes')
    .select('id')
    .eq('usuario', usuario)
    .eq('clave', clave)
    .single();

  return data && !error;
}

export async function obtenerMenu() {
  const { data, error } = await supabase
    .from('platos')
    .select('id, nombre, precio, categoria')
    .eq('activo', true)
    .order('categoria', { ascending: true });

  return data || [];
}

export async function enviarPedidoADatabase({ local, mesa, pedido, total }) {
  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase
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
        dependiente_id: user?.user?.id || null
      }
    ]);

  if (error) console.error('Error al guardar pedido:', error);
}

export async function obtenerResumenDelDia() {
  const { data: user } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('pedidos')
    .select('total')
    .eq('dependiente_id', user?.user?.id)
    .eq('cobrado', true);

  if (error) return { cantidad: 0, total: 0 };

  const cantidad = data.length;
  const total = data.reduce((sum, p) => sum + p.total, 0);

  return { cantidad, total };
}
