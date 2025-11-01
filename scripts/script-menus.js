// ---------------- CONFIG / CLIENTE ----------------
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ihswokmnhwaitzwjzvmy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"; // <-- inyectar en build
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.supabase = supabase;

const ROLES_PERMITIDOS = ["admin", "gerente"];

function el(id){ return document.getElementById(id); }
function escapeHtml(s=""){ return String(s).replace(/[&<>"'\`]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','\`':'&#96;'})[c]); }
function safeParseInt(v, f=0){ const n = parseInt(v); return Number.isNaN(n)?f:n; }
function safeParseFloat(v, f=0.0){ const n = parseFloat(v); return Number.isNaN(n)?f:n; }
function debounce(fn, ms=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

function notify(msg, type="info"){
  const n = el("notificacion");
  if(n){
    n.textContent = msg;
    n.className = `notificacion ${type}`;
    n.style.display = "block";
    clearTimeout(n._t);
    n._t = setTimeout(()=>{ n.style.display = "none"; }, 3500);
    return;
  }
  alert(msg);
}

async function logAuditoria({ menu_id=null, usuario=null, accion, campo=null, valor_anterior=null, valor_nuevo=null }){
  try {
    const payload = {
      menu_id,
      usuario: usuario ?? localStorage.getItem("usuario") ?? "unknown",
      accion,
      campo,
      valor_anterior: String(valor_anterior ?? ""),
      valor_nuevo: String(valor_nuevo ?? "")
    };
    await supabase.from("auditoria_menus").insert(payload);
  } catch (e){
    console.warn("auditoria cliente falló:", e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");
  if(!usuario || !rol || !ROLES_PERMITIDOS.includes(rol)){
    window.location.href = "../index.html";
    return;
  }
  if(el("usuarioConectado")) el("usuarioConectado").textContent = usuario;

  el("logoutBtn")?.addEventListener("click", ()=>{ localStorage.clear(); window.location.href = "../index.html"; });
  el("btn-recargar-menu")?.addEventListener("click", cargarMenus);
  el("btn-nuevo-item")?.addEventListener("click", ()=> abrirModalMenu("crear"));
  el("btn-exportar-csv")?.addEventListener("click", exportarCSV);
  el("btn-importar-csv")?.addEventListener("click", importarCSV);

  await Promise.all([cargarFiltros(), cargarMenus(), cargarDashboardResumen()]);
});

let menusCache = [];
let filtrosActivos = { texto:"", categoria:"", destino:"" };
let collapseState = JSON.parse(localStorage.getItem("menuCollapse") || "{}");
let pedidoTemporal = {};
// ---------------- CARGAS Y FILTROS ----------------

async function cargarMenus(){
  try {
    const { data, error } = await supabase.from("menus").select("*").order("orden",{ascending:true});
    if(error) throw error;
    menusCache = data || [];
    renderListaPorCategoria();
    actualizarFiltrosLocales();
  } catch (e) {
    console.error("cargarMenus:", e);
    notify("Error cargando menús", "error");
  }
}

async function cargarFiltros() {
  try {
    const { data: cats } = await supabase.from("categorias").select("id,nombre").order("nombre");
    const selCat = el("filtro-categoria");
    if (selCat) {
      selCat.innerHTML = `<option value="">Todas las categorías</option>` + (cats || [])
        .map(c => `<option value="${escapeHtml(String(c.id))}">${escapeHtml(c.nombre)}</option>`).join("");
      selCat.addEventListener("change", () => {
        filtrosActivos.categoria = selCat.value;
        renderListaPorCategoria();
      });
    }

    const { data: allMenus, error: errMenus } = await supabase.from("menus").select("destino");
    if (errMenus) throw errMenus;
    const destinosSet = new Set((allMenus || []).map(r => r.destino).filter(Boolean));
    const destinos = Array.from(destinosSet).sort();
    const selDest = el("filtro-destino");
    if (selDest) {
      selDest.innerHTML = `<option value="">Todos los destinos</option>` + destinos
        .map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
      selDest.addEventListener("change", () => {
        filtrosActivos.destino = selDest.value;
        renderListaPorCategoria();
      });
    }

    const busc = el("buscador-menu");
    if (busc) busc.addEventListener("input", debounce((e) => {
      filtrosActivos.texto = e.target.value.trim().toLowerCase();
      renderListaPorCategoria();
    }, 220));
  } catch (e) {
    console.error("cargarFiltros:", e);
    notify("Error cargando filtros", "error");
  }
}

function actualizarFiltrosLocales(){
  // Placeholder para futuras sincronizaciones
}

// ---------------- RENDER AGRUPADO ----------------

function renderListaPorCategoria(){
  const cont = el("menu-lista");
  if(!cont) return;

  const lista = menusCache.filter(m=>{
    if(filtrosActivos.categoria && String(m.categoria_id)!==String(filtrosActivos.categoria)) return false;
    if(filtrosActivos.destino && m.destino !== filtrosActivos.destino) return false;
    if(filtrosActivos.texto){
      const t = filtrosActivos.texto;
      return (m.nombre||"").toLowerCase().includes(t) || (m.descripcion||"").toLowerCase().includes(t);
    }
    return true;
  });

  const map = new Map();
  lista.forEach(item=>{
    const cat = item.categoria_nombre || String(item.categoria_id) || "Sin categoría";
    if(!map.has(cat)) map.set(cat, []);
    map.get(cat).push(item);
  });

  let html = "";
  for(const [cat, items] of map.entries()){
    const collapsed = collapseState[cat] === false ? false : !!collapseState[cat];
    html += `<section class="categoria-grupo" data-cat="${escapeHtml(cat)}">
      <header class="categoria-header">
        <button class="categoria-toggle" data-cat="${escapeHtml(cat)}">${escapeHtml(cat)}</button>
        <span class="categoria-meta">${items.length} ítems</span>
      </header>
      <div class="categoria-body" style="display:${collapsed?'none':'block'}">`;
    items.forEach(it=> html += templateItemCompact(it) );
    html += `</div></section>`;
  }

  cont.innerHTML = html;

  cont.querySelectorAll(".categoria-toggle").forEach(btn=>{
    btn.onclick = ()=>{
      const cat = btn.dataset.cat;
      const body = btn.closest(".categoria-grupo").querySelector(".categoria-body");
      const hidden = body.style.display === "none";
      body.style.display = hidden ? "block" : "none";
      collapseState[cat] = hidden ? true : false;
      localStorage.setItem("menuCollapse", JSON.stringify(collapseState));
    };
  });

  cont.querySelectorAll(".btn-add").forEach(b=> b.onclick = ()=> handleAddToOrder(b.dataset.id) );
  cont.querySelectorAll(".btn-edit").forEach(b=> b.onclick = ()=> abrirModalMenu("editar", b.dataset.id) );
  cont.querySelectorAll(".btn-reponer").forEach(b=> b.onclick = ()=> quickReponer(b.dataset.id) );
}

function templateItemCompact(item){
  const low = Number(item.stock) <= 2;
  return `<div class="menu-item" data-id="${escapeHtml(item.id)}" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">
    <div class="mi-left" style="flex:1;">
      <div class="mi-nombre" style="font-weight:600">${escapeHtml(item.nombre)}</div>
      <div class="mi-sub" style="font-size:0.9rem;color:#666">${escapeHtml(item.destino||"")}${item.area? " · "+escapeHtml(item.area):""}</div>
    </div>
    <div class="mi-right" style="display:flex;align-items:center;gap:12px">
      <div class="mi-precio" style="font-weight:700;text-align:right;width:110px">${Number(item.precio||0).toFixed(2)} CUP</div>
      <div class="mi-stock ${low? "low":""}" style="font-size:0.9rem;color:${low? '#b00020':'#2e8b57'}">Stock: ${escapeHtml(String(item.stock||0))}</div>
      <div class="mi-actions" style="display:flex;gap:6px">
        <button class="btn-add" data-id="${escapeHtml(item.id)}" style="padding:6px 10px;background:#a52a2a;color:#fff;border-radius:6px;border:0">Añadir</button>
        <button class="btn-edit" data-id="${escapeHtml(item.id)}" style="padding:6px 8px;background:#666;color:#fff;border-radius:6px;border:0">Editar</button>
        <button class="btn-reponer" data-id="${escapeHtml(item.id)}" style="padding:6px 8px;background:#eee;color:#333;border-radius:6px;border:1px solid #ccc">Reponer</button>
      </div>
    </div>
  </div>`;
}
// ---------------- PEDIDO TEMPORAL UX ----------------

function handleAddToOrder(id){
  const item = menusCache.find(m=>String(m.id)===String(id));
  if(!item) return;
  if(Number(item.stock) <= 0){ notify("No hay stock disponible","error"); return; }
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

// ---------------- REPOSICIÓN RÁPIDA ----------------

async function quickReponer(id){
  const n = prompt("Nuevo stock (entero):");
  if(n==null) return;
  const nuevo = safeParseInt(n, null);
  if(nuevo==null){ notify("Valor inválido","error"); return; }
  try {
    const { data: prev } = await supabase.from("menus").select("stock,nombre").eq("id", id).single();
    const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: { stock: nuevo } });
    if(error) throw error;
    await logAuditoria({ menu_id: id, accion: "reponer", campo:"stock", valor_anterior: prev.stock, valor_nuevo: nuevo });
    notify("Stock actualizado","success");
    await cargarMenus();
  } catch (e){
    console.error("quickReponer:", e);
    notify("Error actualizando stock","error");
  }
}

// ---------------- MODAL CRUD ----------------

function abrirModalMenu(modo="crear", idOrData=null){
  const root = el("modal-menu-root");
  if(!root) return;
  let data = {};
  if(modo==="editar") data = menusCache.find(m=>String(m.id)===String(idOrData)) || {};

  root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" style="display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:9999">
  <div class="modal" style="background:#fff;border-radius:8px;padding:16px;width:95%;max-width:560px;box-shadow:0 8px 30px rgba(0,0,0,0.2)">
  <h4 style="margin:0 0 12px">${modo==="editar"?"Editar ítem":"Crear ítem"}</h4>
  <form id="form-menu" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
  <label style="grid-column:1/3">Nombre<input name="nombre" required value="${escapeHtml(data.nombre||"")}" /></label>
  <label>Precio<input name="precio" type="number" step="0.01" required value="${escapeHtml(String(data.precio||0))}" /></label>
  <label>Stock<input name="stock" type="number" required value="${escapeHtml(String(data.stock||0))}" /></label>
  <label>Destino<input name="destino" value="${escapeHtml(data.destino||"")}" /></label>
  <label>Área<input name="area" value="${escapeHtml(data.area||"")}" /></label>
  <label>Categoría ID<input name="categoria_id" value="${escapeHtml(String(data.categoria_id||""))}" /></label>
  <label>Orden<input name="orden" type="number" value="${escapeHtml(String(data.orden||0))}" /></label>
  <label style="grid-column:1/3">Imagen URL<input name="imagen_url" value="${escapeHtml(data.imagen_url||"")}" /></label>
  <label style="grid-column:1/3">Descripción<textarea name="descripcion" style="min-height:80px">${escapeHtml(data.descripcion||"")}</textarea></label>
  <div style="grid-column:1/3;display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
  <button type="submit" class="btn-principal"> ${modo==="editar"?"Guardar":"Crear"} </button>
  <button type="button" id="modal-cancel" class="btn-secundario">Cancelar</button>
  </div>
  </form></div></div>`;

  const first = root.querySelector("input[name='nombre']");
  if(first) first.focus();

  el("modal-cancel").onclick = cerrarModalMenu;

  el("form-menu").onsubmit = async (ev)=>{
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const payload = Object.fromEntries(fd.entries());
    payload.precio = safeParseFloat(payload.precio);
    payload.stock = safeParseInt(payload.stock);
    payload.orden = safeParseInt(payload.orden);
    try {
      if(modo==="editar"){
        const id = data.id;
        const { data: prev } = await supabase.from("menus").select("*").eq("id", id).single();
        const { error } = await supabase.rpc("actualizar_menu", { menu_id: id, cambios: payload });
        if(error) throw error;
        await logAuditoria({ menu_id:id, accion:"editar", campo:"varios", valor_anterior: JSON.stringify(prev), valor_nuevo: JSON.stringify(payload) });
        notify("Cambios guardados","success");
      } else {
        const admin = localStorage.getItem("usuario");
        const { data: created, error } = await supabase.rpc("crear_menu", { menu_input: payload, p_admin: admin });
        if(error) throw error;
        await logAuditoria({ menu_id: created?.id ?? null, accion:"crear", campo:"varios", valor_nuevo: JSON.stringify(payload) });
        notify("Ítem creado","success");
      }
      cerrarModalMenu();
      await cargarMenus();
    } catch (e){
      console.error("form submit:", e);
      notify("Error guardando ítem","error");
    }
  };
}

function cerrarModalMenu(){ const r = el("modal-menu-root"); if(r) r.innerHTML = ""; }

// ---------------- IMPORT / EXPORT CSV ----------------

async function exportarCSV(){
  try {
    const filtros = { categoria: filtrosActivos.categoria || null, destino: filtrosActivos.destino || null };
    const { data, error } = await supabase.rpc("exportar_menus_csv", { filtros });
    if(error) throw error;
    const blob = new Blob([data], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "menus_export.csv"; a.click(); URL.revokeObjectURL(a.href);
    await logAuditoria({ accion:"exportar_csv", campo:"export", valor_nuevo: JSON.stringify(filtros) });
    notify("CSV exportado","success");
  } catch (e){ console.error("exportarCSV:", e); notify("Error exportando CSV","error"); }
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
  input.onchange = async (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const text = await f.text();
    if(!validarCSV(text)){ notify("CSV inválido. Faltan columnas requeridas.","error"); return; }
    try {
      const { data, error } = await supabase.rpc("importar_menus_csv", { csv_text: text });
      if(error) throw error;
      await logAuditoria({ accion:"importar_csv", campo:"import", valor_nuevo:`filas:${(text.match(/\n/g)||[]).length}` });
      notify("Importación completada","success");
      await cargarMenus();
    } catch (e){ console.error("importarCSV:", e); notify("Error importando CSV","error"); }
  };
  input.click();
}

// ---------------- DASHBOARD RESUMEN ----------------

async function cargarDashboardResumen(){
  try {
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

    cont.innerHTML = `<div style="display:flex;gap:12px;flex-wrap:wrap">
      <div>Total: <strong>${totalItems}</strong></div>
      <div>Activos: <strong>${activos}</strong></div>
      <div>Sin stock: <strong>${sinStock}</strong></div>
      <div>Stock total: <strong>${stockTotal}</strong></div>
      <div>Valor total: <strong>${valorTotal.toFixed(2)} CUP</strong></div>
    </div>`;
  } catch (e){
    console.error("cargarDashboardResumen:", e);
  }
}

// ---------------- EXPOSICIÓN ÚTIL ----------------

window.cargarMenus = cargarMenus;
window.cargarDashboardResumen = cargarDashboardResumen;
window.abrirModalMenu = abrirModalMenu;
window.exportarCSV = exportarCSV;
window.importarCSV = importarCSV;
                                                                
