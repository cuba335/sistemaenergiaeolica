import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

const norm = (s) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

function Eolicos() {
  const navigate = useNavigate();
  const location = useLocation();

  // Guard de rol (solo admin)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    if (!token) navigate("/", { replace: true });
    if (rol !== "administrador") navigate("/dashboard", { replace: true });
  }, [navigate]);

  const [lista, setLista] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // crear equipo
  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [creando, setCreando] = useState(false);

  // filtro
  const [q, setQ] = useState("");

  // estados por fila
  const [rowLoading, setRowLoading] = useState({}); // { [id_eolico]: 'asignar'|'desasignar'|'toggle' }

  // Si viene ?userId=###
  const params = new URLSearchParams(location.search);
  const userIdParam = Number(params.get("userId") || 0);

  const cargarTodo = async () => {
    try {
      setCargando(true);
      setError("");
      // OJO: /usuarios exige admin (ya estamos en admin)
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

  const showBackendError = (e, fallback = "Ocurrió un error") => {
    const msg =
      e?.response?.data?.mensaje ||
      e?.response?.data?.error ||
      e?.response?.data?.errores?.[0]?.msg ||
      (e?.response?.status === 409 ? "Registro duplicado." : null) ||
      fallback;
    alert(msg);
  };

  const crearEolico = async (e) => {
    e.preventDefault();
    const codigo = (codigoNuevo || "").trim().toUpperCase();
    if (!codigo) {
      alert("Ingresa un código.");
      return;
    }
    if (codigo.length < 3) {
      alert("El código debe tener al menos 3 caracteres.");
      return;
    }

    try {
      setCreando(true);
      await api.post("/eolicos", { codigo });
      setCodigoNuevo("");
      await cargarTodo();
    } catch (e2) {
      if (e2?.response?.status === 409) {
        alert("Ese código ya existe.");
      } else {
        showBackendError(e2, "No se pudo crear el equipo.");
      }
    } finally {
      setCreando(false);
    }
  };

  const setRowBusy = (id, action) =>
    setRowLoading((s) => ({ ...s, [id]: action }));

  const clearRowBusy = (id) =>
    setRowLoading((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });

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

  const toggle = async (id_eolico, nuevo) => {
    try {
      setRowBusy(id_eolico, "toggle");
      await api.put(`/eolicos/${id_eolico}/toggle`, { activo: !!nuevo });
      await cargarTodo();
    } catch (e) {
      showBackendError(e, "No se pudo cambiar el estado.");
    } finally {
      clearRowBusy(id_eolico);
    }
  };

  const listaFiltrada = useMemo(() => {
    const nq = norm(q);
    if (!nq) return lista;
    return lista.filter((r) => {
      const nombre = [r.nombres, r.primer_apellido, r.segundo_apellido]
        .filter(Boolean)
        .join(" ");
      const campos = [r.codigo, nombre, r.login].map(norm);
      return campos.some((c) => c.includes(nq));
    });
  }, [q, lista]);

  const nombreUsuario = (r) =>
    [r.nombres, r.primer_apellido, r.segundo_apellido]
      .filter(Boolean)
      .join(" ") || "—";

  // helpers UI
  const isBusy = (id, action) => rowLoading[id] === action;

  return (
    <div className="container my-4">
      <div className="d-flex align-items-center justify-content-between">
        <h3 className="mb-0">⚙️ Sistemas Eólicos (Alquiler/Asignación)</h3>
        {cargando && <span className="text-muted">Cargando…</span>}
      </div>

      {error && <div className="alert alert-danger mt-3">{error}</div>}

      {/* Crear nuevo equipo */}
      <div className="card mt-3">
        <div className="card-body">
          <form className="row g-2 align-items-end" onSubmit={crearEolico}>
            <div className="col-sm-4">
              <label className="form-label">Código único</label>
              <input
                className="form-control"
                placeholder="Ej: EOL-0001"
                value={codigoNuevo}
                onChange={(e) => setCodigoNuevo(e.target.value.toUpperCase())} // MAYÚSCULAS
                maxLength={20}
              />
            </div>
            <div className="col-sm-3">
              <button className="btn btn-success w-100" type="submit" disabled={creando}>
                {creando ? "Creando…" : "➕ Crear equipo"}
              </button>
            </div>
            <div className="col-sm-5">
              <div className="input-group">
                <span className="input-group-text">🔎</span>
                <input
                  className="form-control"
                  placeholder="Buscar por código o usuario…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && (
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setQ("")}
                  >
                    Limpiar
                  </button>
                )}
              </div>
              {/* Hint si llegó ?userId=… */}
              {userIdParam > 0 && (
                <div className="form-text">
                  Filtrando para asignar al usuario con ID <strong>{userIdParam}</strong> (se
                  resalta con ★ en el combo).
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Tabla */}
      <div className="card mt-3">
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-striped table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>ID</th>
                  <th>Código</th>
                  <th>Usuario asignado</th>
                  <th>Login</th>
                  <th>Estado</th>
                  <th style={{ minWidth: 300 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((r) => {
                  const asignado = !!r.usuario_id;
                  const busyAsignar = isBusy(r.id_eolico, "asignar");
                  const busyDesasignar = isBusy(r.id_eolico, "desasignar");
                  const busyToggle = isBusy(r.id_eolico, "toggle");

                  return (
                    <tr key={r.id_eolico}>
                      <td>{r.id_eolico}</td>
                      <td>
                        <strong>{r.codigo}</strong>
                      </td>
                      <td>{nombreUsuario(r)}</td>
                      <td>{r.login || "—"}</td>
                      <td>
                        {/* Botón estado: verde=activado, rojo=desactivado */}
                        <button
                          className={`btn btn-sm ${r.activo ? "btn-success" : "btn-danger"}`}
                          onClick={() => toggle(r.id_eolico, !r.activo)}
                          disabled={!asignado || busyToggle}
                          title={
                            !asignado
                              ? "Primero asigna a un usuario"
                              : r.activo
                              ? "Desactivar"
                              : "Activar"
                          }
                        >
                          {busyToggle ? "Guardando…" : r.activo ? "Activado" : "Desactivado"}
                        </button>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2 align-items-center">
                          {/* Asignar: combobox con usuarios */}
                          <div
                            className="input-group input-group-sm"
                            style={{ minWidth: 260 }}
                          >
                            <label className="input-group-text">Asignar</label>
                            <select
                              className="form-select"
                              value={r.usuario_id || ""}
                              onChange={(e) => {
                                const uid = Number(e.target.value || 0);
                                if (uid > 0) asignar(r.id_eolico, uid);
                              }}
                              disabled={busyAsignar}
                            >
                              <option value="">— seleccionar —</option>
                              {usuarios.map((u) => (
                                <option key={u.id_usuario} value={u.id_usuario}>
                                  {`${[u.nombres, u.primer_apellido]
                                    .filter(Boolean)
                                    .join(" ") || u.usuario} · ID ${u.id_usuario}${
                                    userIdParam === u.id_usuario ? " ★" : ""
                                  }`}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Desasignar */}
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => desasignar(r.id_eolico)}
                            disabled={!asignado || busyDesasignar}
                          >
                            {busyDesasignar ? "Procesando…" : "Desasignar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {listaFiltrada.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">
                      No hay equipos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between">
            <div className="text-muted small">
              {listaFiltrada.length} de {lista.length} resultados
            </div>
            <div>
              <button
                className="btn btn-outline-secondary"
                onClick={cargarTodo}
                disabled={cargando}
              >
                {cargando ? "Actualizando…" : "↻ Recargar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Eolicos;
