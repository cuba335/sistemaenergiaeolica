import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";

function fmtFecha(f) {
  try {
    if (!f) return "—";
    const d = new Date(f);
    if (isNaN(d.getTime())) return String(f).split("T")[0] || "—";
    return d.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

export default function UsuarioDetalle() {
  const { id } = useParams();
  const [u, setU] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setCargando(true);
        setError("");
        const res = await api.get(`/usuarios/${id}`);
        setU(res.data || null);
      } catch (e) {
        setError("No se pudo cargar el usuario.");
        setU(null);
      } finally {
        setCargando(false);
      }
    })();
  }, [id]);

  return (
    <div className="container py-4">UsuarioDetalle
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Detalle del Usuario</h3>
        <Link to="/usuarios" className="btn btn-outline-secondary">← Volver</Link>
      </div>

      {cargando && <p>Buscando..</p>}
      {error && <div className="alert alert-danger">{error}</div>}
      {!cargando && !u && !error && <p className="text-muted">No encontrado.</p>}

      {u && (
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">ID</div>
                  <div>{u.id_usuario}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Rol</div>
                  <div>{u.nombre_rol || "—"}</div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Usuario (login)</div>
                  <div>{u.usuario || "—"}</div>
                </div>
              </div>

              <div className="col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Nombres</div>
                  <div>{u.nombres || "—"}</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Primer apellido</div>
                  <div>{u.primer_apellido || "—"}</div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Segundo apellido</div>
                  <div>{u.segundo_apellido || "—"}</div>
                </div>
              </div>

              <div className="col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">CI</div>
                  <div>{u.ci || "—"}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Fecha de nacimiento</div>
                  <div>{fmtFecha(u.fecha_nacimiento)}</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Teléfono</div>
                  <div>{u.telefono || "—"}</div>
                </div>
              </div>
              <div className="col-md-12">
                <div className="border rounded p-2 h-100">
                  <div className="text-muted small">Dirección</div>
                  <div>{u.direccion || "—"}</div>
                </div>
              </div>
            </div>

            {/* Aquí podrías linkear sus gráficos/reporte individual si lo deseas */}
            {/* <Link to={`/graficos?userId=${u.id_usuario}`} className="btn btn-primary mt-3">Ver gráficos</Link> */}
          </div>
        </div>
      )}
    </div>
  );
}
