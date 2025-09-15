// src/pages/AlertasDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { generarPDF } from "../components/ReportePDF";

const UMBRAL = {
  VOLTAJE_ALTO: 15, // V
  BATERIA_BAJA: 20, // %
  CONSUMO_ALTO: 80, // W
};

const toYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const fmtNum = (n, dec = 2) => {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(dec) : "—";
};

const fmtFecha = (f) => {
  try {
    return f ? new Date(f).toLocaleString() : "—";
  } catch {
    return "—";
  }
};

function AlertasDashboard() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [soloAlertas, setSoloAlertas] = useState(true);

  const rol = (localStorage.getItem("rol") || "").toLowerCase();

  // preset de fechas al montar
  useEffect(() => {
    const hoy = new Date();
    const hace7 = new Date(hoy);
    hace7.setDate(hoy.getDate() - 7);
    setFechaInicio(toYMD(hace7));
    setFechaFin(toYMD(hoy));
  }, []);

  const cargar = async () => {
    if (!fechaInicio || !fechaFin) {
      setError("Por favor selecciona fecha inicio y fin.");
      return;
    }
    if (fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la final.");
      return;
    }

    setError("");
    setCargando(true);
    try {
      const endpoint = rol === "administrador" ? "/alertas/admin-rango" : "/alertas/rango";
      const res = await api.get(endpoint, {
        params: { desde: fechaInicio, hasta: fechaFin, soloAlertas },
      });
      setDatos(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("rol");
        localStorage.removeItem("usuario");
        navigate("/", { replace: true });
        return;
      }
      setError("Error cargando datos.");
    } finally {
      setCargando(false);
    }
  };

  // carga automática cuando cambian fechas o filtro (si ya hay fechas)
  useEffect(() => {
    if (fechaInicio && fechaFin) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin, soloAlertas]);

  // Derivados de estado
  const { voltajeAlto, bateriaBaja, consumoAlto, cts } = useMemo(() => {
    const vA = datos.some((d) => Number(d?.voltaje) > UMBRAL.VOLTAJE_ALTO);
    const bB = datos.some((d) => Number(d?.bateria) < UMBRAL.BATERIA_BAJA);
    const cA = datos.some((d) => Number(d?.consumo) > UMBRAL.CONSUMO_ALTO);

    const cts = {
      vA: datos.filter((d) => Number(d?.voltaje) > UMBRAL.VOLTAJE_ALTO).length,
      bB: datos.filter((d) => Number(d?.bateria) < UMBRAL.BATERIA_BAJA).length,
      cA: datos.filter((d) => Number(d?.consumo) > UMBRAL.CONSUMO_ALTO).length,
    };
    return { voltajeAlto: vA, bateriaBaja: bB, consumoAlto: cA, cts };
  }, [datos]);

  const setRango = (dias) => {
    const fin = new Date();
    const ini = new Date(fin);
    ini.setDate(fin.getDate() - dias);
    setFechaInicio(toYMD(ini));
    setFechaFin(toYMD(fin));
  };

  const exportarPDF = async () => {
    const isAdmin = rol === "administrador";

    const head = isAdmin
      ? ["Fecha", "Usuario", "Rol", "Voltaje (V)", "Batería (%)", "Consumo (W)"]
      : ["Fecha", "Voltaje (V)", "Batería (%)", "Consumo (W)"];

    const body = (datos || []).map((d) =>
      isAdmin
        ? [
            fmtFecha(d?.fecha_lectura),
            d?.login || "—",
            d?.rol || "—",
            fmtNum(d?.voltaje),
            fmtNum(d?.bateria),
            fmtNum(d?.consumo),
          ]
        : [fmtFecha(d?.fecha_lectura), fmtNum(d?.voltaje), fmtNum(d?.bateria), fmtNum(d?.consumo)]
    );

    let usuarioNombre = "—";
    try {
      usuarioNombre = JSON.parse(localStorage.getItem("usuario") || "{}")?.usuario || "—";
    } catch {}

    const desc = [
      `Rango: ${fechaInicio} a ${fechaFin}`,
      `Solo alertas: ${soloAlertas ? "Sí" : "No"}`,
      `Total lecturas: ${datos.length}`,
      `Umbrales → Voltaje>${UMBRAL.VOLTAJE_ALTO}V | Batería<${UMBRAL.BATERIA_BAJA}% | Consumo>${UMBRAL.CONSUMO_ALTO}W`,
    ].join("  •  ");

    await generarPDF({
      titulo: "REPORTE DE ALERTAS DEL SISTEMA",
      usuario: usuarioNombre,
      descripcion: desc,
      tabla: body,
      head,
      nombreArchivo: "reporte_alertas",
    });
  };

  return (
    <div className="container my-4">
      <h3 className="mb-3">Alertas del sistema</h3>

      {/* Filtros */}
      <div className="card mb-3 shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label">Fecha inicio</label>
              <input
                type="date"
                className="form-control"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label">Fecha fin</label>
              <input
                type="date"
                className="form-control"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label d-block">Rangos rápidos</label>
              <div className="btn-group w-100" role="group">
                <button className="btn btn-outline-secondary" onClick={() => setRango(0)}>
                  Hoy
                </button>
                <button className="btn btn-outline-secondary" onClick={() => setRango(7)}>
                  7 días
                </button>
                <button className="btn btn-outline-secondary" onClick={() => setRango(30)}>
                  30 días
                </button>
              </div>
            </div>

            <div className="col-md-3">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="soloAlertas"
                  checked={soloAlertas}
                  onChange={(e) => setSoloAlertas(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="soloAlertas">
                  Solo alertas activas
                </label>
              </div>
              <div className="d-flex gap-2 mt-2">
                <button className="btn btn-primary w-100" onClick={cargar} disabled={cargando}>
                  {cargando ? "Buscando..." : "Buscar"}
                </button>
                <button
                  className="btn btn-outline-success w-100"
                  onClick={exportarPDF}
                  disabled={cargando || !datos.length}
                >
                  PDF
                </button>
              </div>
            </div>
          </div>

          {error && <div className="alert alert-danger mt-3">{error}</div>}
        </div>
      </div>

      {/* Estado general */}
      <div
        className={`mb-4 p-3 border rounded d-flex align-items-center justify-content-between ${
          voltajeAlto || bateriaBaja || consumoAlto
            ? "bg-danger text-white"
            : "bg-success text-white"
        }`}
        style={{ borderRadius: 14 }}
      >
        <strong>
          {voltajeAlto || bateriaBaja || consumoAlto
            ? "🚨 Sistema en alerta"
            : "✅ Sistema estable"}
        </strong>
        <small>
          Última lectura:{" "}
          {datos?.[datos.length - 1]?.fecha_lectura
            ? fmtFecha(datos[datos.length - 1].fecha_lectura)
            : "—"}
        </small>
      </div>

      {/* Tarjetas de resumen */}
      <div className="row g-3 mb-3">
        <div className="col-sm-4">
          <div className="card shadow-sm h-100" style={{ borderRadius: 14 }}>
            <div className="card-body">
              <h6 className="card-title mb-1">Voltaje alto</h6>
              <div className="d-flex align-items-center justify-content-between">
                <p className={voltajeAlto ? "text-danger fw-bold m-0" : "text-success m-0"}>
                  {voltajeAlto ? `Sí (>${UMBRAL.VOLTAJE_ALTO} V)` : "No"}
                </p>
                <span className="badge bg-secondary">{cts.vA}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-4">
          <div className="card shadow-sm h-100" style={{ borderRadius: 14 }}>
            <div className="card-body">
              <h6 className="card-title mb-1">Batería baja</h6>
              <div className="d-flex align-items-center justify-content-between">
                <p className={bateriaBaja ? "text-warning fw-bold m-0" : "text-success m-0"}>
                  {bateriaBaja ? `Sí (<${UMBRAL.BATERIA_BAJA} %)` : "No"}
                </p>
                <span className="badge bg-secondary">{cts.bB}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-sm-4">
          <div className="card shadow-sm h-100" style={{ borderRadius: 14 }}>
            <div className="card-body">
              <h6 className="card-title mb-1">Consumo alto</h6>
              <div className="d-flex align-items-center justify-content-between">
                <p className={consumoAlto ? "text-info fw-bold m-0" : "text-success m-0"}>
                  {consumoAlto ? `Sí (>${UMBRAL.CONSUMO_ALTO} W)` : "No"}
                </p>
                <span className="badge bg-secondary">{cts.cA}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="card shadow-sm" style={{ borderRadius: 14 }}>
        <div className="card-body">
          <h5 className="card-title mb-3">
            Lecturas {rol === "administrador" ? "— todos los usuarios" : ""}
          </h5>

          <div className="table-responsive">
            <table className="table table-bordered table-striped align-middle text-center">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  {rol === "administrador" && <th>Usuario</th>}
                  {rol === "administrador" && <th>Rol</th>}
                  <th>Voltaje (V)</th>
                  <th>Batería (%)</th>
                  <th>Consumo (W)</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((d, i) => (
                  <tr key={i}>
                    <td>{fmtFecha(d?.fecha_lectura)}</td>
                    {rol === "administrador" && <td>{d?.login || "—"}</td>}
                    {rol === "administrador" && <td>{d?.rol || "—"}</td>}
                    <td className={Number(d?.voltaje) > UMBRAL.VOLTAJE_ALTO ? "text-danger fw-semibold" : ""}>
                      {fmtNum(d?.voltaje)}
                    </td>
                    <td className={Number(d?.bateria) < UMBRAL.BATERIA_BAJA ? "text-warning fw-semibold" : ""}>
                      {fmtNum(d?.bateria)}
                    </td>
                    <td className={Number(d?.consumo) > UMBRAL.CONSUMO_ALTO ? "text-info fw-semibold" : ""}>
                      {fmtNum(d?.consumo)}
                    </td>
                  </tr>
                ))}

                {datos.length === 0 && (
                  <tr>
                    <td colSpan={rol === "administrador" ? 6 : 4} className="text-muted">
                      No hay lecturas para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-end">
            <button
              className="btn btn-outline-success mt-2"
              onClick={exportarPDF}
              disabled={datos.length === 0}
            >
              🖨️ Descargar PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AlertasDashboard;
