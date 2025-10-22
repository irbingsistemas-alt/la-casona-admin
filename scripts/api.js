export async function enviarPedidoADatabase({ local, mesa, pedido, total, usuario_id }) {
  const { data: pedidoInsertado, error } = await supabase
    .from('pedidos')
    .insert([{
      local,
      mesa,
      total,
      entregado: false,
      cobrado: false,
      fecha: new Date().toISOString(),
      usuario_id
    }])
    .select()
    .single();

  if (error) {
    console.error("❌ Error al guardar pedido:", error);
    return null;
  }

  // Inserta los platos en tabla secundaria si la usas
  for (const item of pedido) {
    await supabase.from('pedido_items').insert([{
      pedido_id: pedidoInsertado.id,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio
    }]);
  }

  return pedidoInsertado;
}
