import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

document.addEventListener("DOMContentLoaded", () => {
  const usuario = localStorage.getItem("usuario");
  const rol = localStorage.getItem("rol");
  const rolesPermitidos = ["admin", "gerente"];

  if (!usuario || !rolesPermitidos.includes(rol)) {
    window.location.href = "../index.html";
    return;
  }

  document.getElementById("usuarioConectado").textContent = usuario;

  const supabase = createClient(
    "https://ihswokmnhwaitzwjzvmy.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imloc3dva21uaHdhaXR6d2p6dm15Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3NjU2OTcsImV4cCI6MjA3NjM0MTY5N30.TY4BdOYdzrmUGoprbFmbl4HVntaIGJyRMOxkcZPdlWU"
  );

  document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "../index.html";
  });

  async function cargarRoles() {
    const select = document.getElementById("nuevoRol");
    try {
      const { data, error } = await supabase
        .from("roles")
        .select("id, nombre")
        .order("nombre", { ascending: true });

      if (error) throw error;

      select.innerHTML = "";
      (data || []).forEach(r => {
        const option = document.createElement("option");
        option.value = r.id;
        option.textContent = r.nombre;
        select.appendChild(option);
      });
    } catch (err) {
      console.error("Error cargando roles:", err);
      select.innerHTML = `<option>Error al cargar roles</option>`;
    }
  }

  document.getElementById("crearForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nuevoUsuario = document.getElementById("nuevoUsuario").value.trim().toLowerCase();
    const nuevaClave = document.getElementById("nuevaClave").value.trim();
    const nuevoRolId = document.getElementById("nuevoRol").value;

    if (!nuevoUsuario || !nuevaClave || !nuevoRolId) {
      alert("Completa todos los campos para crear el usuario.");
      return;
    }

    try {
      const { error } = await supabase.rpc("crear_usuario", {
        p_usuario: nuevoUsuario,
        p_clave: nuevaClave,
        p_rol_id: nuevoRolId,
        p_admin: usuario
      });
      if (error) throw error;
      alert("✅ Usuario creado con éxito");
      e.target.reset();
      await Promise.all([cargarUsuarios(), cargarLogs()]);
    } catch (err) {
      console.error("crear_usuario error:", err);
      alert("❌ Error creando usuario: " + (err.message || JSON.stringify(err)));
    }
  });

  document.getElementById("cambiarForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuarioClave = document.getElementById("usuarioClave").value.trim().toLowerCase();
    const nuevaClaveUsuario = document.getElementById("nuevaClaveUsuario").value.trim();

    if (!usuarioClave || !nuevaClaveUsuario) {
      alert("Completa ambos campos para cambiar la clave.");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("cambiar_clave", {
        p_usuario: usuarioClave,
        p_clave: nuevaClaveUsuario,
        p_admin: usuario
      });
      if (error) throw error;
      const mensaje = data?.mensaje || ("Clave actualizada con éxito para " + usuarioClave);
      alert("🔐 " + mensaje);
      e.target.reset();
      await cargarLogs();
    } catch (err) {
      console.error("cambiar_clave error:", err);
      alert("❌ Error cambiando clave: " + (err.message || JSON.stringify(err)));
    }
  });
    // 👥 Cargar usuarios con relación a roles(nombre)
  async function cargarUsuarios() {
    const tbody = document.getElementById("tablaUsuarios");
    tbody.innerHTML = `<tr><td colspan="3">Cargando usuarios…</td></tr>`;

    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("usuario, roles(nombre)")
        .order("usuario", { ascending: true })
        .limit(1000);

      if (error) throw error;

      tbody.innerHTML = "";
      (data || []).forEach(u => {
        const rolText = (u.roles && u.roles.nombre) ? u.roles.nombre : "—";
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(u.usuario)}</td>
          <td>${escapeHtml(rolText)}</td>
          <td><button class="btn-borrar" data-usuario="${escapeHtml(u.usuario)}">Borrar</button></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("Error cargando usuarios:", err);
      tbody.innerHTML = `<tr><td colspan="3">Error al cargar usuarios</td></tr>`;
    }
  }

  // 🗑️ Borrar usuario
  document.getElementById("tablaUsuarios").addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".btn-borrar");
    if (!btn) return;
    const usuarioAfectado = btn.dataset.usuario;
    if (!confirm("¿Seguro que quieres borrar " + usuarioAfectado + "?")) return;

    try {
      const { error } = await supabase.rpc("borrar_usuario", {
        p_usuario: usuarioAfectado,
        p_admin: usuario
      });
      if (error) throw error;
      alert("🗑️ Usuario borrado");
      await Promise.all([cargarUsuarios(), cargarLogs()]);
    } catch (err) {
      console.error("Error borrando usuario:", err);
      alert("❌ Error borrando usuario: " + (err.message || JSON.stringify(err)));
    }
  });

  // 📋 Historial de acciones
  let historialCompleto = [];

  async function cargarLogs() {
    const { data, error } = await supabase
      .from("logs_admin")
      .select("*")
      .order("fecha", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error cargando logs:", error);
      return;
    }

    historialCompleto = data || [];
    renderizarHistorial();
  }

  function renderizarHistorial() {
    const actorFiltro = document.getElementById("filtroActor").value.trim().toLowerCase();
    const accionFiltro = document.getElementById("filtroAccion").value.trim().toLowerCase();
    const fechaFiltro = document.getElementById("filtroFecha")?.value || "";
    const tbody = document.getElementById("tablaLogs");
    tbody.innerHTML = "";

    const filtrado = historialCompleto.filter((l) => {
      const actor = (l.realizado_por || "").toLowerCase();
      const accion = (l.accion || "").toLowerCase();
      const fecha = l.fecha ? new Date(l.fecha).toISOString().split("T")[0] : "";

      return (
        (!actorFiltro || actor.includes(actorFiltro)) &&
        (!accionFiltro || accion.includes(accionFiltro)) &&
        (!fechaFiltro || fecha === fechaFiltro)
      );
    });

    filtrado.forEach(l => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(l.accion)}</td>
        <td>${escapeHtml(l.usuario_afectado)}</td>
        <td>${escapeHtml(l.realizado_por)}</td>
        <td>${new Date(l.fecha).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 🧠 Filtros en tiempo real
  document.getElementById("filtroActor").addEventListener("input", renderizarHistorial);
  document.getElementById("filtroAccion").addEventListener("input", renderizarHistorial);
  document.getElementById("filtroFecha")?.addEventListener("input", renderizarHistorial);

  // 📤 Exportar historial filtrado
  document.getElementById("btnExportarHistorial").addEventListener("click", () => {
    const actorFiltro = document.getElementById("filtroActor").value.trim().toLowerCase();
    const accionFiltro = document.getElementById("filtroAccion").value.trim().toLowerCase();
    const fechaFiltro = document.getElementById("filtroFecha")?.value || "";

    const filtrado = historialCompleto.filter((l) => {
      const actor = (l.realizado_por || "").toLowerCase();
      const accion = (l.accion || "").toLowerCase();
      const fecha = l.fecha ? new Date(l.fecha).toISOString().split("T")[0] : "";

      return (
        (!actorFiltro || actor.includes(actorFiltro)) &&
        (!accionFiltro || accion.includes(accionFiltro)) &&
        (!fechaFiltro || fecha === fechaFiltro)
      );
    });

    const texto = filtrado.map((l) => {
      return `Acción: ${l.accion}
Usuario afectado: ${l.usuario_afectado}
Realizado por: ${l.realizado_por}
Fecha: ${new Date(l.fecha).toLocaleString()}
-----------------------------`;
    }).join("\n\n");

    const blob = new Blob([texto], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historial_filtrado.txt";
    a.click();
    URL.revokeObjectURL(url);
  });

  // 🔐 Escape visual
  function escapeHtml(text = "") {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 🚀 Inicializar
  (async function init() {
    await Promise.all([cargarRoles(), cargarUsuarios(), cargarLogs()]);
  })();
});
