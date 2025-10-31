// scripts/script-menus.js  — Parte 1/3
// Encabezado, configuración y utilidades
// NOTA: reemplaza SUPABASE_ANON_KEY en tu proceso de build; no lo incluyas en repo público.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_ANON_KEY = "REPLACE_AT_BUILD_TIME"; // <<-- inyectar en build
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

// ---------- Config UI / Branding ----------
/*
  Este script asume que tu HTML usa el logo en ../assets/logo.png
  y tu style-base.css ya define .logo-login y paleta.
  Tamaño recomendado del logo: 120x120 (CSS ya maneja responsividad).
*/

// ---------- Helpers ----------
function el(id){ return document.getElementById(id); }
function escapeHtml(s=""){ return String(s).replace(/[&<>"'`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'})[c]); }
function toast(msg){ // temporal; sustituir por tu sistema de notificaciones si existe
  try { const n = el("notificacion"); if(n){ n.textContent = msg; n.classList.remove("oculto"); setTimeout(()=>n.classList.add("oculto"), 4000); return; } } catch(e){}
  alert(msg);
}
function safeParseInt(v, fallback=0){ const n = parseInt(v); return Number.isNaN(n)?fallback:n; }
function safeParseFloat(v, fallback=0.0){ const n = parseFloat(v); return Number.isNaN(n)?fallback:n; }
function debounce(fn, ms=250){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }

// ---------- Auditoría helper (intento cliente; ideal que RPC registre en servidor) ----------
async function logAuditoria({ menu_id=null, usuario=null, accion, campo=null, valor_anterior=null, valor_nuevo=null }){
  try{
    const payload = { menu_id, usuario: usuario ?? localStorage.getItem("usuario") ?? "unknown", accion, campo, valor_anterior: String(valor_anterior ?? ""), valor_nuevo: String(valor_nuevo ?? "") };
    // Inserción directa como respaldo; preferible que RPC lo haga en servidor con validación
    await supabase.from("auditoria_menus").insert(payload);
  }catch(e){
    console.warn("auditoria fallo (cliente):", e);
  }
}

// ---------- Verificar rol y boot ----------
const ROLES_PERMITIDOS = ["admin","gerente"];
document.addEventListener("DOMContentLoaded", async () => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");
  if(!usuario || !rol || !ROLES_PERMITIDOS.includes(rol)){
    window.location.href = "../index.html";
    return;
  }
  // Mostrar usuario en UI si existe
  if(el("usuarioConectado")) el("usuarioConectado").textContent = usuario;
  // Bind botones globales
  el("logoutBtn")?.addEventListener("click", ()=>{ localStorage.clear(); window.location.href="../index.html"; });
  el("btn-recargar-menu")?.addEventListener("click", cargarMenus);
  el("btn-nuevo-item")?.addEventListener("click", ()=>abrirModalMenu("crear"));
  el("btn-exportar-csv")?.addEventListener("click", exportarCSV);
  el("btn-importar-csv")?.addEventListener("click", importarCSV);
  // Inicializa
  await Promise.all([cargarFiltros(), cargarMenus(), cargarDashboardResumen()]);
});
// scripts/script-menus.js  — Parte 2/3
// Cargas, cache en memoria, renderizado y delegación de eventos

// Estado en memoria
let menusCache = [];            // lista completa
let filtrosActivos = { texto: "", categoria: "", destino: "" };
let collapseState = JSON.parse(localStorage.getItem("menuCollapse")||"{}"); // {categoria: true/false}

// ---------- Cargas ----------
async function cargarMenus(){
  try{
    const { data, error } = await supabase.from("menus").select("*").order("orden",{ascending:true});
    if(error) throw error;
    menusCache = data || [];
    renderListaPorCategoria();
    actualizarFiltrosLocales();
  }catch(e){
    console.error("cargarMenus:", e);
    toast("Error cargando menús");
  }
}

async function cargarFiltros(){
  // cargar categorías y destinos únicos
  try{
    const { data: cats } = await supabase.from("categorias").select("id,nombre").order("nombre");
    const selCat = el("filtro-categoria");
    if(selCat){
      selCat.innerHTML = `<option value="">Todas</option>` + (cats||[]).map(c=>`<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.nombre)}</option>`).join("");
      selCat.addEventListener("change", ()=>{ filtrosActivos.categoria = selCat.value; renderListaPorCategoria(); });
    }
    // destinos desde tabla menus si no hay tabla de destinos
    const { data: destinos } = await supabase.from("menus").select("destino").distinct();
    const selDest = el("filtro-destino");
    if(selDest){
      selDest.innerHTML = `<option value="">Todos</option>` + (destinos||[]).map(d=>`<option value="${escapeHtml(d.destino)}">${escapeHtml(d.destino)}</option>`).join("");
      selDest.addEventListener("change", ()=>{ filtrosActivos.destino = selDest.value; renderListaPorCategoria(); });
    }
    const busc = el("buscador-menu");
    if(busc){
      busc.addEventListener("input", debounce((e)=>{ filtrosActivos.texto = e.target.value.trim().toLowerCase(); renderListaPorCategoria(); }, 220));
    }
  }catch(e){
    console.error("cargarFiltros:", e);
  }
}

function actualizarFiltrosLocales(){
  // rellena selects si los cambios vienen desde carga de menus
  const selCat = el("filtro-categoria");
  const selDest = el("filtro-destino");
  if(!selCat || !selDest) return;
  const categorias = Array.from(new Set(menusCache.map(m=>m.categoria_id))).filter(Boolean);
  // si ya existe opciones no sobreescribir; se dejó cargar desde tablas de categorias
}

// ---------- Render agrupado por categoría (colapsable) ----------
function renderListaPorCategoria(){
  const cont = el("menu-lista");
  if(!cont) return;
  // filtrado
  const lista = menusCache.filter(m=>{
    if(filtrosActivos.categoria && String(m.categoria_id)!==String(filtrosActivos.categoria)) return false;
    if(filtrosActivos.destino && m.destino !== filtrosActivos.destino) return false;
    if(filtrosActivos.texto){
      const txt = filtrosActivos.texto;
      return (m.nombre||"").toLowerCase().includes(txt) || (m.descripcion||"").toLowerCase().includes(txt);
    }
    return true;
  });
  // agrupar por categoria nombre si disponible
  const map = new Map();
  lista.forEach(item=>{
    const cat = item.categoria_nombre || String(item.categoria_id) || "Sin categoría";
    if(!map.has(cat)) map.set(cat, []);
    map.get(cat).push(item);
  });

  // render
  let html = "";
  for(const [cat, items] of map.entries()){
    const collapsed = collapseState[cat] === false ? false : !!collapseState[cat]; // default true
    html += `<section class="categoria-grupo" data-cat="${escapeHtml(cat)}">
      <header class="categoria-header">
        <button class="categoria-toggle" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
        <span class="categoria-meta">${items.length} ítems</span>
      </header>
      <div class="categoria-body" style="display:${collapsed? 'none':'block'}">`;
    items.forEach(it => {
      html += templateItemCompact(it);
    });
    html += `</div></section>`;
  }
  cont.innerHTML = html;

  // delegación: toggles, añadir, editar, reponer
  cont.querySelectorAll(".categoria-toggle").forEach(btn=>{
    btn.onclick = (e)=>{
      const cat = btn.dataset.cat;
      const body = btn.closest(".categoria-grupo").querySelector(".categoria-body");
      const isHidden = body.style.display === "none";
      body.style.display = isHidden ? "block" : "none";
      collapseState[cat] = !isHidden ? false : true;
      localStorage.setItem("menuCollapse", JSON.stringify(collapseState));
    };
  });
  cont.querySelectorAll(".btn-add").forEach(b=> b.onclick = ()=> handleAddToOrder(b.dataset.id) );
  cont.querySelectorAll(".btn-edit").forEach(b=> b.onclick = ()=> abrirModalMenu("editar", b.dataset.id) );
  cont.querySelectorAll(".btn-reponer").forEach(b=> b.onclick = ()=> quickReponer(b.dataset.id) );
}

// ---------- plantilla compacta por item ----------
function templateItemCompact(item){
  const low = Number(item.stock) <= 2;
  return `<div class="menu-item" data-id="${escapeHtml(item.id)}">
    <div class="mi-left">
      <div class="mi-nombre">${escapeHtml(item.nombre)}</div>
      <div class="mi-sub">${escapeHtml(item.destino||"")}${item.area? " · "+escapeHtml(item.area):""}</div>
    </div>
    <div class="mi-right">
      <div class="mi-precio">${Number(item.precio||0).toFixed(2)} CUP</div>
      <div class="mi-stock ${low? "low": ""}">Stock: ${escapeHtml(String(item.stock||0))}</div>
      <div class="mi-actions">
        <button class="btn-add" data-id="${escapeHtml(item.id)}">Añadir</button>
        <button class="btn-edit" data-id="${escapeHtml(item.id)}">Editar</button>
        <button class="btn-reponer" data-id="${escapeHtml(item.id)}">Reponer</button>
      </div>
    </div>
  </div>`;
}

// ---------- Operaciones UX (pedido local) ----------
let pedidoTemporal = {}; // {menuId: cantidad}
function handleAddToOrder(id){
  const item = menusCache.find(m=>String(m.id)===String(id));
  if(!item) return;
  if(Number(item.stock) <= 0){ toast("No hay stock disponible"); return; }
  pedidoTemporal[id] = (pedidoTemporal[id]||0)+1;
  updateResumenPedidoUI();
}
function updateResumenPedidoUI(){
  const totalEl = el("total");
  const cantidadEl = el("cantidad-items");
  const cantidades = Object.values(pedidoTemporal).reduce((s,n)=>s+Number(n),0);
  const valor = Object.entries(pedidoTemporal).reduce((s,[id,c])=>{
    const it = menusCache.find(m=>String(m.id)===String(id));
    return s + (it? Number(it.precio||0)*Number(c):0);
  },0);
  if(totalEl) totalEl.textContent = `${valor.toFixed(2)} CUP`;
  if(cantidadEl) cantidadEl.textContent = `${cantidades}`;
}

// ---------- Quick reponer (prompt inline) ----------
async function quickReponer(id){
  const n = prompt("Nuevo stock (entero):");
  if(n==null) return;
  const nuevo = safeParseInt(n, null);
  if(nuevo==null){ toast("Valor inválido"); return; }
  try{
    const { data: prev } = await supabase.from("menus").select("stock,nombre").eq("id", id).single();
    const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: { stock: nuevo } });
    if(error) throw error;
    await logAuditoria({ menu_id:id, accion:"reponer", campo:"stock", valor_anterior:prev.stock, valor_nuevo:nuevo });
    toast("Stock actualizado");
    await cargarMenus();
  }catch(e){
    console.error("quickReponer:", e);
    toast("Error actualizando stock");
  }
}
// scripts/script-menus.js  — Parte 3/3
// Modales, CRUD (RPC), import/export, dashboard y utilidades finales

// ---------- Modal: crear / editar ----------
function abrirModalMenu(modo="crear", idOrData=null){
  const root = el("modal-menu-root");
  if(!root) return;
  let data = {};
  if(modo==="editar"){
    data = menusCache.find(m=>String(m.id)===String(idOrData)) || {};
  }
  root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true">
    <div class="modal">
      <h4>${modo==="editar" ? "Editar ítem" : "Crear ítem"}</h4>
      <form id="form-menu">
        <label>Nombre<input name="nombre" required value="${escapeHtml(data.nombre||"")}" /></label>
        <label>Precio<input name="precio" type="number" step="0.01" required value="${escapeHtml(String(data.precio||0))}" /></label>
        <label>Stock<input name="stock" type="number" required value="${escapeHtml(String(data.stock||0))}" /></label>
        <label>Destino<input name="destino" value="${escapeHtml(data.destino||"")}" /></label>
        <label>Área<input name="area" value="${escapeHtml(data.area||"")}" /></label>
        <label>Categoría ID<input name="categoria_id" value="${escapeHtml(String(data.categoria_id||""))}" /></label>
        <label>Orden<input name="orden" type="number" value="${escapeHtml(String(data.orden||0))}" /></label>
        <label>Imagen URL<input name="imagen_url" value="${escapeHtml(data.imagen_url||"")}" /></label>
        <label>Descripción<textarea name="descripcion">${escapeHtml(data.descripcion||"")}</textarea></label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
          <button type="submit" class="btn-principal">${modo==="editar"?"Guardar":"Crear"}</button>
          <button type="button" id="modal-cancel" class="btn-secundario">Cancelar</button>
        </div>
      </form>
    </div></div>`;
  el("modal-cancel").onclick = cerrarModalMenu;
  el("form-menu").onsubmit = async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const payload = Object.fromEntries(fd.entries());
    payload.precio = safeParseFloat(payload.precio);
    payload.stock = safeParseInt(payload.stock);
    payload.orden = safeParseInt(payload.orden);
    try{
      if(modo==="editar"){
        const id = data.id;
        const { data: prev } = await supabase.from("menus").select("*").eq("id", id).single();
        const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: payload });
        if(error) throw error;
        await logAuditoria({ menu_id:id, accion:"editar", campo:"varios", valor_anterior: JSON.stringify(prev), valor_nuevo: JSON.stringify(payload) });
        toast("Cambios guardados");
      }else{
        const admin = localStorage.getItem("usuario");
        const { data: created, error } = await supabase.rpc("crear_menu", { menu_input: payload, p_admin: admin });
        if(error) throw error;
        await logAuditoria({ menu_id: created?.id ?? null, accion:"crear", campo:"varios", valor_nuevo: JSON.stringify(payload) });
        toast("Ítem creado");
      }
      cerrarModalMenu();
      await cargarMenus();
    }catch(e){
      console.error("form-menu submit:", e);
      toast("Error guardando ítem");
    }
  };
}
function cerrarModalMenu(){ const root = el("modal-menu-root"); if(root) root.innerHTML = ""; }

// ---------- Export / Import CSV ----------
async function exportarCSV(){
  try{
    const filtros = { categoria: filtrosActivos.categoria || null, destino: filtrosActivos.destino || null };
    const { data, error } = await supabase.rpc("exportar_menus_csv", { filtros });
    if(error) throw error;
    const blob = new Blob([data], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "menus_export.csv"; a.click(); URL.revokeObjectURL(a.href);
    await logAuditoria({ accion:"exportar_csv", campo:"export", valor_nuevo: JSON.stringify(filtros) });
    toast("CSV exportado");
  }catch(e){ console.error("exportarCSV:", e); toast("Error exportando CSV"); }
}

function validarCSV(text){
  const filas = text.trim().split("\n").map(r=>r.trim()).filter(Boolean);
  if(filas.length<1) return false;
  const encabezado = filas[0].split(",").map(h=>h.trim().toLowerCase());
  const esperadas = ["nombre","precio","stock","categoria_id","destino","area","orden","imagen_url","descripcion"];
  return esperadas.every(c=>encabezado.includes(c));
}
function importarCSV(){
  const input = document.createElement("input"); input.type="file"; input.accept=".csv";
  input.onchange = async (e)=> {
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    if(!validarCSV(text)){ toast("CSV inválido. Faltan columnas requeridas."); return; }
    try{
      const { data, error } = await supabase.rpc("importar_menus_csv", { csv_text: text });
      if(error) throw error;
      await logAuditoria({ accion:"importar_csv", campo:"import", valor_nuevo: `filas:${(text.match(/\n/g)||[]).length}` });
      toast("Importación completada");
      await cargarMenus();
    }catch(e){ console.error("importarCSV:", e); toast("Error importando CSV"); }
  };
  input.click();
}

// ---------- Dashboard resumen y paneles ----------
async function cargarDashboardResumen(){
  try{
    const { data, error } = await supabase.from("menus").select("id,precio,stock,activo,disponible");
    if(error) throw error;
    const cont = el("panel-resumen");
    if(!cont) return;
    const items = data || [];
    const totalItems = items.length;
    const activos = items.filter(i=>i.activo).length;
    const sinStock = items.filter(i=>Number(i.stock)===0).length;
    const stockTotal = items.reduce((s,i)=>s+Number(i.stock||0),0);
    const valorTotal = items.reduce((s,i)=>s+Number(i.precio||0),0);
    cont.innerHTML = `<div class="stat-row">
      <div>Total: <strong>${totalItems}</strong></div>
      <div>Activos: <strong>${activos}</strong></div>
      <div>Sin stock: <strong>${sinStock}</strong></div>
      <div>Stock total: <strong>${stockTotal}</strong></div>
      <div>Valor total: <strong>${valorTotal.toFixed(2)} CUP</strong></div>
    </div>`;
  }catch(e){ console.error("cargarDashboardResumen:", e); }
}

// ---------- Utilidades finales: abrir item por id (edic.) ----------
async function abrirModalMenuById(id){
  const item = menusCache.find(m=>String(m.id)===String(id));
  if(!item){ toast("Ítem no encontrado"); return; }
  abrirModalMenu("editar", id);
}

// Exponer funciones para debugging/uso inline si se necesita
window.cargarMenus = cargarMenus;
window.cargarDashboardResumen = cargarDashboardResumen;
window.abrirModalMenu = abrirModalMenu;
window.exportarCSV = exportarCSV;
window.importarCSV = importarCSV;
