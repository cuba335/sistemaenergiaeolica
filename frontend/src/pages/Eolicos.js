// src/pages/Eolicos.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

/* =========== Utils =========== */
const norm = (s) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const money = (v) =>
  Number(v || 0).toLocaleString("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  });

/* =========== Modal genérico =========== */
function Modal({ open, title, children, onClose, footer }) {
  if (!open) return null;
  return (
    <>
      <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered modal-lg modal-fullscreen-sm-down">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar" />
            </div>
            <div className="modal-body">{children}</div>
            <div className="modal-footer flex-wrap gap-2">
              {footer}
              <button className="btn btn-outline-secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} />
    </>
  );
}

/* =========== Página =========== */
export default function Eolicos() {
  const navigate = useNavigate();
  const location = useLocation();

  /* Guard de rol */
  useEffect(() => {
    const token = localStorage.getItem("token");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    if (!token) navigate("/", { replace: true });
    if (rol !== "administrador") navigate("/dashboard", { replace: true });
  }, [navigate]);

  /* Estado */
  const [lista, setLista] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // búsqueda
  const [q, setQ] = useState("");

  // row busy
  const [rowLoading, setRowLoading] = useState({}); // {[id_eolico]: 'asignar'|'desasignar'|'toggle'|'costos'|'pdf'|'cuotas-*'}

  // modal nuevo
  const [openNuevo, setOpenNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({
    codigo: "",
    tarifa_mes: "",
    costo_instalacion: "",
    deposito: "",
    costo_operativo_dia: "",
  });
  const [creando, setCreando] = useState(false);

  // modal costos
  const [openCostos, setOpenCostos] = useState(false);
  const [equipoEdit, setEquipoEdit] = useState(null);
  const [costos, setCostos] = useState({
    tarifa_mes: "",
    costo_instalacion: "",
    deposito: "",
    costo_operativo_dia: "",
  });
  const [aplicarAlquiler, setAplicarAlquiler] = useState(true); // ✅ nuevo estado

  // === Cuotas ===
  // Modal “Generar plan de cuotas”
  const [openPlan, setOpenPlan] = useState(false);
  const [equipoPlan, setEquipoPlan] = useState(null);
  const [guardandoPlan, setGuardandoPlan] = useState(false);
  const hoyISO = new Date().toISOString().slice(0, 10);
  const [planForm, setPlanForm] = useState({
    concepto: "tarifa", // 'tarifa'|'instalacion'|'deposito'|'operativo'|'otro'
    numero_cuotas: 6,
    periodicidad: "mensual", // 'mensual'|'semanal'|'diaria'
    primera_fecha: hoyISO,
    monto_total: "", // vacío = el backend lo infiere si corresponde
    descripcion: "",
  });

  // Modal “Lista de cuotas”
  const [openListaCuotas, setOpenListaCuotas] = useState(false);
  const [loadingCuotas, setLoadingCuotas] = useState(false);
  const [alquilerInfo, setAlquilerInfo] = useState(null); // { id_alquiler, eolico_id, codigo, login, nombres... }
  const [listaCuotas, setListaCuotas] = useState([]);
  const [pagandoId, setPagandoId] = useState(0);

  // ?userId=###
  const params = new URLSearchParams(location.search);
  const userIdParam = Number(params.get("userId") || 0);

  /* Cargar datos */
  const cargarTodo = async () => {
    try {
      setCargando(true);
      setError("");
      const [rEol, rUsr] = await Promise.all([api.get("/eolicos"), api.get("/usuarios")]);
      setLista(Array.isArray(rEol.data) ? rEol.data : []);
      setUsuarios(Array.isArray(rUsr.data) ? rUsr.data : []);
    } catch (e) {
      console.error("cargarTodo error:", e?.response || e);
      setError("No se pudo cargar la información.");
      setLista([]);
      setUsuarios([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Helpers */
  const showBackendError = (e, fallback = "Ocurrió un error") => {
    const msg =
      e?.response?.data?.mensaje ||
      e?.response?.data?.error ||
      e?.response?.data?.errores?.[0]?.msg ||
      (e?.response?.status === 409 ? "Registro duplicado." : null) ||
      fallback;
    alert(msg);
  };

  const isBusy = (id, action) => rowLoading[id] === action;
  const setRowBusy = (id, action) => setRowLoading((s) => ({ ...s, [id]: action }));
  const clearRowBusy = (id) =>
    setRowLoading((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });

  const nombreUsuario = (r) =>
    [r.nombres, r.primer_apellido, r.segundo_apellido].filter(Boolean).join(" ") || "—";

  const listaFiltrada = useMemo(() => {
    const nq = norm(q);
    if (!nq) return lista;
    return lista.filter((r) => {
      const nombre = [r.nombres, r.primer_apellido, r.segundo_apellido].filter(Boolean).join(" ");
      const campos = [r.codigo, nombre, r.login].map(norm);
      return campos.some((c) => c.includes(nq));
    });
  }, [q, lista]);

  /* Acciones */
  const crearEolico = async () => {
    const codigo = (nuevo.codigo || "").trim().toUpperCase();
    if (!codigo) return alert("Ingresa un código.");
    if (codigo.length < 3) return alert("El código debe tener al menos 3 caracteres.");

    const payload = {
      codigo,
      tarifa_mes: Number(nuevo.tarifa_mes || 0),
      costo_instalacion: Number(nuevo.costo_instalacion || 0),
      deposito: Number(nuevo.deposito || 0),
      costo_operativo_dia: Number(nuevo.costo_operativo_dia || 0),
    };

    try {
      setCreando(true);
      await api.post("/eolicos", payload);
      setNuevo({
        codigo: "",
        tarifa_mes: "",
        costo_instalacion: "",
        deposito: "",
        costo_operativo_dia: "",
      });
      setOpenNuevo(false);
      await cargarTodo();
    } catch (e) {
      if (e?.response?.status === 409) alert("Ese código ya existe.");
      else showBackendError(e, "No se pudo crear el equipo.");
    } finally {
      setCreando(false);
    }
  };

  const asignar = async (id_eolico, usuario_id) => {
    try {
      setRowBusy(id_eolico, "asignar");
      await api.put(`/eolicos/${id_eolico}/asignar`, { usuario_id });
      await cargarTodo();
    } catch (e) {
      showBackendError(e, "No se pudo asignar.");
    } finally {
      clearRowBusy(id_eolico);
    }
  };

  const desasignar = async (id_eolico) => {
    if (!window.confirm("¿Desasignar este equipo?")) return;
    try {
      setRowBusy(id_eolico, "desasignar");
      await api.put(`/eolicos/${id_eolico}/desasignar`);
      await cargarTodo();
    } catch (e) {
      showBackendError(e, "No se pudo desasignar.");
    } finally {
      clearRowBusy(id_eolico);
    }
  };

  const toggle = async (id_eolico, nuevoEstado) => {
    try {
      setRowBusy(id_eolico, "toggle");
      await api.put(`/eolicos/${id_eolico}/toggle`, { activo: !!nuevoEstado });
      await cargarTodo();
    } catch (e) {
      showBackendError(e, "No se pudo cambiar el estado.");
    } finally {
      clearRowBusy(id_eolico);
    }
  };

  const abrirEditarCostos = (r) => {
    setEquipoEdit(r);
    setCostos({
      tarifa_mes: r.tarifa_mes ?? 0,
      costo_instalacion: r.costo_instalacion ?? 0,
      deposito: r.deposito ?? 0,
      costo_operativo_dia: r.costo_operativo_dia ?? 0,
    });
    setAplicarAlquiler(true); // ✅ por defecto aplicar
    setOpenCostos(true);
  };

  const guardarCostos = async () => {
    if (!equipoEdit) return;
    const id = equipoEdit.id_eolico;
    const payload = {
      tarifa_mes: Number(costos.tarifa_mes || 0),
      costo_instalacion: Number(costos.costo_instalacion || 0),
      deposito: Number(costos.deposito || 0),
      costo_operativo_dia: Number(costos.costo_operativo_dia || 0),
      aplicar_alquiler_activo: aplicarAlquiler, // ✅ enviar flag
    };
    try {
      setRowBusy(id, "costos");
      await api.put(`/eolicos/${id}/costos`, payload);
      setOpenCostos(false);
      setEquipoEdit(null);
      await cargarTodo();
    } catch (e) {
      showBackendError(e, "No se pudieron guardar los costos.");
    } finally {
      clearRowBusy(id);
    }
  };

  // === Cuotas ===
  // Abrir modal para GENERAR plan
  const abrirGenerarPlan = (row) => {
    setEquipoPlan(row);
    setPlanForm((f) => ({
      ...f,
      concepto: "tarifa",
      numero_cuotas: 6,
      periodicidad: "mensual",
      primera_fecha: hoyISO,
      monto_total: "",
      descripcion: "",
    }));
    setOpenPlan(true);
  };

  // Enviar creación de plan
  const enviarGenerarPlan = async () => {
    if (!equipoPlan) return;
    const id = equipoPlan.id_eolico;

    const payload = {
      concepto: planForm.concepto,
      numero_cuotas: Number(planForm.numero_cuotas || 0),
      periodicidad: planForm.periodicidad,
      primera_fecha: planForm.primera_fecha || undefined,
      descripcion: planForm.descripcion || undefined,
    };
    // monto_total es opcional
    if (String(planForm.monto_total).trim() !== "") {
      payload.monto_total = Number(planForm.monto_total);
      if (!(payload.monto_total > 0)) return alert("Monto total inválido.");
    }

    if (!(payload.numero_cuotas >= 1 && payload.numero_cuotas <= 120)) {
      return alert("El número de cuotas debe estar entre 1 y 120.");
    }

    try {
      setGuardandoPlan(true);
      setRowBusy(id, "cuotas-generar");
      await api.post(`/eolicos/${id}/cuotas/generar`, payload);
      setOpenPlan(false);
      setEquipoPlan(null);
      await cargarTodo();
      await verCuotas(id); // abre la lista generada
    } catch (e) {
      showBackendError(e, "No se pudo generar el plan de cuotas.");
    } finally {
      setGuardandoPlan(false);
      clearRowBusy(id);
    }
  };

  // Ver LISTA de cuotas (modal)
  const verCuotas = async (id_eolico) => {
    try {
      setRowBusy(id_eolico, "cuotas-lista");
      setLoadingCuotas(true);
      const r = await api.get(`/eolicos/${id_eolico}/cuotas`);
      setAlquilerInfo(r.data?.alquiler || null);
      setListaCuotas(Array.isArray(r.data?.cuotas) ? r.data.cuotas : []);
      setOpenListaCuotas(true);
    } catch (e) {
      showBackendError(e, "No se pudieron cargar las cuotas.");
    } finally {
      setLoadingCuotas(false);
      clearRowBusy(id_eolico);
    }
  };

  // Pagar una cuota
  const pagarCuota = async (id_cuota) => {
    try {
      setPagandoId(id_cuota);
      await api.put(`/cuotas/${id_cuota}/pagar`, { metodo_pago: "efectivo", observaciones: "Caja" });
      setListaCuotas((prev) =>
        prev.map((c) => (c.id_cuota === id_cuota ? { ...c, pagado: 1, fecha_pago: new Date().toISOString() } : c))
      );
    } catch (e) {
      showBackendError(e, "No se pudo marcar como pagada.");
    } finally {
      setPagandoId(0);
    }
  };

  // PDF de cuotas
  const abrirPDFCuotas = async (id_eolico, codigo) => {
    try {
      setRowBusy(id_eolico, "cuotas-pdf");
      const token = localStorage.getItem("token") || "";
      const base = api.defaults.baseURL || "";
      const url = `${base}/eolicos/${id_eolico}/cuotas/pdf`;

      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || "No se pudo generar el PDF de cuotas");
      }
      const blob = await resp.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const win = window.open(blobUrl, "_blank");
      if (!win) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `cuotas_${codigo || id_eolico}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (e) {
      console.error("abrirPDFCuotas error:", e);
      alert("No se pudo abrir el PDF de cuotas.");
    } finally {
      clearRowBusy(id_eolico);
    }
  };

  /* UI */
  return (
    <div className="container my-4">
      {/* Header */}
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
        <div className="d-flex flex-column">
          <h3 className="mb-0">Sistemas Eólicos</h3>
          <div className="text-muted small">Gestión de alquiler, costos y asignaciones</div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-nowrap">
          {/* BUSCADOR COMPACTO */}
          <div className="input-group input-group-sm" style={{ maxWidth: 280 }}>
            <span className="input-group-text">Buscar</span>
            <input
              className="form-control"
              placeholder="Código, usuario, login…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button className="btn btn-outline-secondary" onClick={() => setQ("")} title="Limpiar">
                Limpiar
              </button>
            )}
          </div>

          {/* Acciones */}
          <button className="btn btn-success btn-sm" onClick={() => setOpenNuevo(true)}>
            Nuevo
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={cargarTodo} disabled={cargando}>
            {cargando ? "Actualizando…" : "Recargar"}
          </button>
        </div>
      </div>

      {userIdParam > 0 && (
        <div className="form-text mt-1">
          Asignación rápida para usuario ID <strong>{userIdParam}</strong> (se resalta con ★).
        </div>
      )}

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      {/* Tabla responsiva */}
      <div className="card mt-3 shadow-sm">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped table-bordered align-middle">
              <thead>
                {/* Fila 1: headers principales */}
                <tr className="table-light align-middle">
                  <th style={{ minWidth: 70 }}>Nro.</th>
                  <th style={{ minWidth: 130 }}>Código</th>
                  <th style={{ minWidth: 180 }}>Usuario asignado</th>
                  <th style={{ minWidth: 160 }}>Login</th>
                  <th style={{ minWidth: 120 }}>Estado</th>
                  <th colSpan="4" className="text-center" style={{ minWidth: 420 }}>
                    Costos
                  </th>
                  <th style={{ minWidth: 520 }}>Acciones</th>
                </tr>
                {/* Fila 2: subheaders de costos */}
                <tr className="table-secondary">
                  <th colSpan="5" />
                  <th style={{ minWidth: 110 }}>Tarifa/mes</th>
                  <th style={{ minWidth: 110 }}>Instalación</th>
                  <th style={{ minWidth: 110 }}>Depósito</th>
                  <th style={{ minWidth: 110 }}>Op./día</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((r, idx) => {
                  const nro = idx + 1;
                  const asignado = !!r.usuario_id;
                  const busyAsignar = isBusy(r.id_eolico, "asignar");
                  const busyDesasignar = isBusy(r.id_eolico, "desasignar");
                  const busyToggle = isBusy(r.id_eolico, "toggle");
                  const busyPdf = isBusy(r.id_eolico, "pdf");

                  return (
                    <tr key={r.id_eolico}>
                      <td>{nro}</td>
                      <td>
                        <div className="d-flex flex-column">
                          <strong>{r.codigo}</strong>
                          <small className="text-muted">
                            Creado: {new Date(r.fecha_creacion).toLocaleString()}
                          </small>
                          <div>
                            {r.habilitado ? (
                              <span className="badge bg-success">Habilitado</span>
                            ) : (
                              <span className="badge bg-warning text-dark">No habilitado</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-break">
                        <div className="fw-semibold">{nombreUsuario(r)}</div>
                      </td>
                      <td className="text-break">{r.login || "—"}</td>
                      <td>
                        <div className="form-check form-switch d-flex align-items-center gap-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id={`sw-${r.id_eolico}`}
                            checked={!!r.activo}
                            onChange={() => toggle(r.id_eolico, !r.activo)}
                            disabled={!asignado || busyToggle}
                            title={!asignado ? "Primero asigna a un usuario" : r.activo ? "Desactivar" : "Activar"}
                          />
                          <label className="form-check-label small" htmlFor={`sw-${r.id_eolico}`}>
                            {busyToggle ? "Guardando…" : r.activo ? "Activado" : "Desactivado"}
                          </label>
                        </div>
                      </td>

                      {/* Costos (4 columnas) */}
                      <td className="text-nowrap">{money(r.tarifa_mes)}</td>
                      <td className="text-nowrap">{money(r.costo_instalacion)}</td>
                      <td className="text-nowrap">{money(r.deposito)}</td>
                      <td className="text-nowrap">{money(r.costo_operativo_dia)}</td>

                      {/* Acciones */}
 {/* Acciones */}
<td>
  <div className="d-flex flex-column align-items-center gap-2">
    {/* Fila 1: acciones principales */}
    <div className="d-flex flex-wrap justify-content-center gap-2">
      {/* Editar costos */}
      <button className="btn btn-sm btn-primary" onClick={() => abrirEditarCostos(r)}>
        Editar costos
      </button>

      {/* Recibo PDF (equipo) */}
      <button
        className="btn btn-sm btn-outline-dark"
        onClick={() => {
          (async () => {
            try {
              setRowBusy(r.id_eolico, "pdf");
              const token = localStorage.getItem("token") || "";
              const base = api.defaults.baseURL || "";
              const url = `${base}/eolicos/${r.id_eolico}/recibo`;
              const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
              if (!resp.ok) {
                const txt = await resp.text();
                throw new Error(txt || "No se pudo generar el PDF");
              }
              const blob = await resp.blob();
              const blobUrl = window.URL.createObjectURL(blob);
              const win = window.open(blobUrl, "_blank");
              if (!win) {
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = `recibo_${r.codigo || r.id_eolico}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }
              setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            } catch (e) {
              console.error("abrirRecibo error:", e);
              alert("No se pudo abrir el recibo PDF.");
            } finally {
              clearRowBusy(r.id_eolico);
            }
          })();
        }}
        disabled={isBusy(r.id_eolico, "pdf")}
        title="Abrir/descargar PDF del recibo"
      >
        {isBusy(r.id_eolico, "pdf") ? "Generando…" : "Recibo PDF"}
      </button>

      {/* Ver cuotas */}
      <button
        className="btn btn-sm btn-outline-primary"
        onClick={() => verCuotas(r.id_eolico)}
        disabled={isBusy(r.id_eolico, "cuotas-lista")}
        title="Ver plan de cuotas del alquiler activo"
      >
        {isBusy(r.id_eolico, "cuotas-lista") ? "Cargando…" : "Ver cuotas"}
      </button>

      {/* Generar plan de cuotas */}
      <button
        className="btn btn-sm btn-outline-success"
        onClick={() => abrirGenerarPlan(r)}
        disabled={isBusy(r.id_eolico, "cuotas-generar")}
        title="Generar plan de cuotas"
      >
        {isBusy(r.id_eolico, "cuotas-generar") ? "Generando…" : "Generar cuotas"}
      </button>

      {/* Cuotas PDF */}
      <button
        className="btn btn-sm btn-outline-dark"
        onClick={() => abrirPDFCuotas(r.id_eolico, r.codigo)}
        disabled={isBusy(r.id_eolico, "cuotas-pdf")}
        title="Descargar/abrir PDF del plan de cuotas"
      >
        {isBusy(r.id_eolico, "cuotas-pdf") ? "Generando…" : "Cuotas PDF"}
      </button>
    </div>

    {/* Fila 2: asignación */}
    <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
      <div className="input-group input-group-sm" style={{ maxWidth: 260 }}>
        <span className="input-group-text">Asignar</span>
        <select
          className="form-select"
          value={r.usuario_id || ""}
          onChange={(e) => {
            const uid = Number(e.target.value || 0);
            if (uid > 0) asignar(r.id_eolico, uid);
          }}
          disabled={isBusy(r.id_eolico, "asignar")}
        >
          <option value="">— seleccionar —</option>
          {usuarios.map((u) => (
            <option key={u.id_usuario} value={u.id_usuario}>
              {`${[u.nombres, u.primer_apellido].filter(Boolean).join(" ") || u.usuario}${
                userIdParam === u.id_usuario ? " ★" : ""
              }`}
            </option>
          ))}
        </select>
      </div>

      <button
        className="btn btn-sm btn-outline-secondary"
        onClick={() => desasignar(r.id_eolico)}
        disabled={!asignado || isBusy(r.id_eolico, "desasignar")}
      >
        {isBusy(r.id_eolico, "desasignar") ? "Procesando…" : "Desasignar"}
      </button>
    </div>
  </div>
</td>

                    </tr>
                  );
                })}

                {listaFiltrada.length === 0 && !cargando && (
                  <tr>
                    <td colSpan="10" className="text-center text-muted">
                      No hay equipos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between mt-2">
            <div className="text-muted small">
              {listaFiltrada.length} de {lista.length} resultados
            </div>
            <button className="btn btn-outline-secondary" onClick={cargarTodo} disabled={cargando}>
              {cargando ? "Actualizando" : "Recargar"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Nuevo equipo */}
      <Modal
        open={openNuevo}
        title="Crear nuevo equipo eólico"
        onClose={() => setOpenNuevo(false)}
        footer={
          <button className="btn btn-success" onClick={crearEolico} disabled={creando}>
            {creando ? "Creando…" : "Crear"}
          </button>
        }
      >
        <div className="row g-3">
          <div className="col-12">
            <label className="form-label">Código único</label>
            <input
              className="form-control"
              placeholder="Ej: EOL-0001"
              value={nuevo.codigo}
              onChange={(e) => setNuevo((s) => ({ ...s, codigo: e.target.value.toUpperCase() }))}
              maxLength={20}
              required
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Tarifa mensual (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={nuevo.tarifa_mes}
              onChange={(e) => setNuevo((s) => ({ ...s, tarifa_mes: e.target.value }))}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Instalación (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={nuevo.costo_instalacion}
              onChange={(e) => setNuevo((s) => ({ ...s, costo_instalacion: e.target.value }))}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Depósito (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={nuevo.deposito}
              onChange={(e) => setNuevo((s) => ({ ...s, deposito: e.target.value }))}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label">Costo operativo/día (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={nuevo.costo_operativo_dia}
              onChange={(e) => setNuevo((s) => ({ ...s, costo_operativo_dia: e.target.value }))}
            />
          </div>
          <div className="col-12">
            <div className="small text-muted">Luego podrás editar estos valores desde “Editar costos”.</div>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar costos */}
      <Modal
        open={openCostos}
        title={`Editar costos — ${equipoEdit?.codigo ?? ""}`}
        onClose={() => setOpenCostos(false)}
        footer={
          <button
            className="btn btn-primary"
            onClick={guardarCostos}
            disabled={equipoEdit ? isBusy(equipoEdit.id_eolico, "costos") : true}
          >
            {equipoEdit && isBusy(equipoEdit.id_eolico, "costos") ? "Guardando…" : "Guardar costos"}
          </button>
        }
      >
        <div className="row g-3">
          <div className="col-6 col-md-6">
            <label className="form-label">Tarifa mensual (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={costos.tarifa_mes}
              onChange={(e) => setCostos((s) => ({ ...s, tarifa_mes: e.target.value }))}
            />
          </div>
          <div className="col-6 col-md-6">
            <label className="form-label">Instalación (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={costos.costo_instalacion}
              onChange={(e) => setCostos((s) => ({ ...s, costo_instalacion: e.target.value }))}
            />
          </div>
          <div className="col-6 col-md-6">
            <label className="form-label">Depósito (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={costos.deposito}
              onChange={(e) => setCostos((s) => ({ ...s, deposito: e.target.value }))}
            />
          </div>
          <div className="col-6 col-md-6">
            <label className="form-label">Costo operativo/día (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              value={costos.costo_operativo_dia}
              onChange={(e) => setCostos((s) => ({ ...s, costo_operativo_dia: e.target.value }))}
            />
          </div>

          {/* ✅ Checkbox para aplicar al alquiler activo */}
          <div className="col-12">
            <div className="form-check">
              <input
                id="aplicarAlquiler"
                className="form-check-input"
                type="checkbox"
                checked={aplicarAlquiler}
                onChange={(e) => setAplicarAlquiler(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="aplicarAlquiler">
                Aplicar también al alquiler activo
              </label>
            </div>
            <div className="form-text">
              Se actualizarán <code>tarifa_mes</code>, <code>costo_instalacion</code> y <code>deposito</code> en la fila
              activa de <code>alquileres</code> de este equipo.
            </div>
          </div>

          <div className="col-12">
            <div className="alert alert-light border small mb-0">
              <div className="fw-semibold mb-1">Resumen</div>
              <div>
                Tarifa mensual: <strong>{money(costos.tarifa_mes)}</strong>
              </div>
              <div>
                Instalación: <strong>{money(costos.costo_instalacion)}</strong>
              </div>
              <div>
                Depósito: <strong>{money(costos.deposito)}</strong>
              </div>
              <div>
                Costo operativo/día: <strong>{money(costos.costo_operativo_dia)}</strong>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Generar plan de cuotas */}
      <Modal
        open={openPlan}
        title={`Generar plan de cuotas — ${equipoPlan?.codigo ?? ""}`}
        onClose={() => setOpenPlan(false)}
        footer={
          <>
            <button className="btn btn-success" onClick={enviarGenerarPlan} disabled={guardandoPlan}>
              {guardandoPlan ? "Guardando…" : "Crear plan"}
            </button>
          </>
        }
      >
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">Concepto</label>
            <select
              className="form-select"
              value={planForm.concepto}
              onChange={(e) => setPlanForm((s) => ({ ...s, concepto: e.target.value }))}
            >
              <option value="tarifa">Tarifa mensual</option>
              <option value="instalacion">Instalación</option>
              <option value="deposito">Depósito</option>
              <option value="operativo">Operativo</option>
              <option value="otro">Otro</option>
            </select>
            <div className="form-text">
              Si dejas <b>monto total</b> vacío, el sistema lo calcula (tarifa = tarifa_mes × cuotas; instalación/depósito = valor).
            </div>
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">N° de cuotas</label>
            <input
              type="number"
              min="1"
              max="120"
              className="form-control"
              value={planForm.numero_cuotas}
              onChange={(e) => setPlanForm((s) => ({ ...s, numero_cuotas: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">Periodicidad</label>
            <select
              className="form-select"
              value={planForm.periodicidad}
              onChange={(e) => setPlanForm((s) => ({ ...s, periodicidad: e.target.value }))}
            >
              <option value="mensual">Mensual</option>
              <option value="semanal">Semanal</option>
              <option value="diaria">Diaria</option>
            </select>
          </div>

          <div className="col-6 col-md-4">
            <label className="form-label">Primera fecha</label>
            <input
              type="date"
              className="form-control"
              value={planForm.primera_fecha}
              onChange={(e) => setPlanForm((s) => ({ ...s, primera_fecha: e.target.value }))}
            />
          </div>

          <div className="col-6 col-md-4">
            <label className="form-label">Monto total (opcional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="form-control"
              placeholder="Dejar vacío para auto"
              value={planForm.monto_total}
              onChange={(e) => setPlanForm((s) => ({ ...s, monto_total: e.target.value }))}
            />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Descripción (opcional)</label>
            <input
              className="form-control"
              maxLength={120}
              value={planForm.descripcion}
              onChange={(e) => setPlanForm((s) => ({ ...s, descripcion: e.target.value }))}
            />
          </div>

          <div className="col-12">
            <div className="alert alert-light border small mb-0">
              <div className="fw-semibold mb-1">Referencias (equipo)</div>
              <div>Tarifa mensual: <strong>{money(equipoPlan?.tarifa_mes)}</strong></div>
              <div>Instalación: <strong>{money(equipoPlan?.costo_instalacion)}</strong></div>
              <div>Depósito: <strong>{money(equipoPlan?.deposito)}</strong></div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Lista de cuotas */}
      <Modal
        open={openListaCuotas}
        title={`Plan de cuotas — ${alquilerInfo?.codigo ?? ""}`}
        onClose={() => setOpenListaCuotas(false)}
        footer={
          <>
            <button
              className="btn btn-outline-dark"
              onClick={() => abrirPDFCuotas(alquilerInfo?.eolico_id || 0, alquilerInfo?.codigo)}
              disabled={!alquilerInfo}
            >
              Cuotas PDF
            </button>
          </>
        }
      >
        {loadingCuotas ? (
          <div className="text-center py-3">Cargando…</div>
        ) : !alquilerInfo ? (
          <div className="text-muted">No hay alquiler activo.</div>
        ) : (
          <>
            <div className="row g-2 mb-2">
              <div className="col-12 col-md-6">
                <div className="small text-muted">
                  Cliente:{" "}
                  <strong>
                    {[alquilerInfo?.nombres, alquilerInfo?.primer_apellido].filter(Boolean).join(" ") || "—"}
                  </strong>
                </div>
                <div className="small text-muted">Login: <strong>{alquilerInfo?.login || "—"}</strong></div>
              </div>
              <div className="col-12 col-md-6">
                <div className="small text-muted">Alquiler ID: <strong>{alquilerInfo?.id_alquiler}</strong></div>
                <div className="small text-muted">
                  Inicio: <strong>{new Date(alquilerInfo?.fecha_inicio).toLocaleString()}</strong>
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-sm table-striped align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ width: 70 }}>#</th>
                    <th>Descripción</th>
                    <th style={{ width: 140 }}>Vencimiento</th>
                    <th style={{ width: 140 }} className="text-end">
                      Monto
                    </th>
                    <th style={{ width: 140 }}>Estado</th>
                    <th style={{ width: 130 }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {listaCuotas.map((c) => (
                    <tr key={c.id_cuota}>
                      <td>{c.numero}</td>
                      <td className="text-break">{c.descripcion || `${c.concepto} ${c.numero}`}</td>
                      <td>{new Date(c.fecha_vencimiento).toLocaleDateString()}</td>
                      <td className="text-end">{money(c.monto)}</td>
                      <td>
                        {c.pagado ? (
                          <span className="badge bg-success">Pagado</span>
                        ) : (
                          <span className="badge bg-warning text-dark">Pendiente</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline-success"
                          disabled={!!c.pagado || pagandoId === c.id_cuota}
                          onClick={() => pagarCuota(c.id_cuota)}
                        >
                          {pagandoId === c.id_cuota ? "Guardando…" : c.pagado ? "Listo" : "Pagar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {listaCuotas.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-muted">
                        No hay cuotas generadas.
                      </td>
                    </tr>
                  )}
                </tbody>
                {listaCuotas.length > 0 && (
                  <tfoot>
                    {(() => {
                      const total = listaCuotas.reduce((s, c) => s + Number(c.monto || 0), 0);
                      const pagado = listaCuotas.filter((c) => c.pagado).reduce((s, c) => s + Number(c.monto || 0), 0);
                      const pendiente = total - pagado;
                      return (
                        <>
                          <tr>
                            <th colSpan="3" className="text-end">
                              TOTAL
                            </th>
                            <th className="text-end">{money(total)}</th>
                            <th colSpan="2"></th>
                          </tr>
                          <tr>
                            <th colSpan="3" className="text-end">
                              PAGADO
                            </th>
                            <th className="text-end text-success">{money(pagado)}</th>
                            <th colSpan="2"></th>
                          </tr>
                          <tr>
                            <th colSpan="3" className="text-end">
                              PENDIENTE
                            </th>
                            <th className="text-end text-danger">{money(pendiente)}</th>
                            <th colSpan="2"></th>
                          </tr>
                        </>
                      );
                    })()}
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
