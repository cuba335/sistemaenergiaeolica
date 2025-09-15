import React, { useState, useEffect, useRef } from "react";
import api from "../api/axios";
import { Line } from "react-chartjs-2";
import { generarPDF } from "../components/ReportePDF";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend);

function Reportes() {
  const [datos, setDatos] = useState([]);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [rol, setRol] = useState("");

  const chartRef = useRef(null);

  useEffect(() => {
    const r = localStorage.getItem("rol");
    if (r) setRol(r.toLowerCase());
  }, []);

  const cargarDatos = async () => {
    if (!fechaInicio || !fechaFin) {
      setError("Por favor ingresa ambas fechas");
      return;
    }
    if (fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser mayor que la fecha final");
      return;
    }

    setError(null);
    setCargando(true);

    try {
      const endpoint =
        rol === "administrador" ? "/resumen/admin-rango" : "/resumen/rango";

      const res = await api.get(endpoint, {
        params: { desde: fechaInicio, hasta: fechaFin },
      });

      const data = Array.isArray(res.data) ? res.data : [];
      setDatos(data);
    } catch (e) {
      console.error(e);
      setError("Error al cargar datos");
    } finally {
      setCargando(false);
    }
  };

  const etiquetas = datos.map((d) =>
    rol === "administrador"
      ? `${d.login} (${d.rol})`
      : new Date(d.fecha_lectura).toLocaleString()
  );

  const voltajes = datos.map((d) => d.voltaje);
  const baterias = datos.map((d) => d.bateria);
  const consumos = datos.map((d) => d.consumo);

  const lineData = {
    labels: etiquetas,
    datasets: [
      {
        label: "Voltaje (V)",
        data: voltajes,
        borderColor: "#28a745",
        backgroundColor: "rgba(40, 167, 69, 0.2)",
        tension: 0.3,
        fill: true,
      },
      {
        label: "Batería (%)",
        data: baterias,
        borderColor: "#007bff",
        backgroundColor: "rgba(0, 123, 255, 0.2)",
        tension: 0.3,
        fill: true,
      },
      {
        label: "Consumo (W)",
        data: consumos,
        borderColor: "#fd7e14",
        backgroundColor: "rgba(253, 126, 20, 0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
      tooltip: { mode: "index", intersect: false },
      title: { display: true, text: "Tendencias de Parámetros Eléctricos" },
    },
  };

  const exportarPDF = () => {
    if (!chartRef.current) return;
    const graficoBase64 = chartRef.current.toBase64Image();

    const tablaDatos = datos.map((d) =>
      rol === "administrador"
        ? [
            d.login,
            d.rol,
            `${d.nombres} ${d.primer_apellido} ${d.segundo_apellido || ""}`,
            d.voltaje,
            d.bateria,
            d.consumo,
          ]
        : [new Date(d.fecha_lectura).toLocaleString(), d.voltaje, d.bateria, d.consumo]
    );

    const encabezados =
      rol === "administrador"
        ? ["Usuario", "Rol", "Nombre", "Voltaje (V)", "Batería (%)", "Consumo (W)"]
        : ["Fecha", "Voltaje (V)", "Batería (%)", "Consumo (W)"];

    generarPDF(
      rol === "administrador" ? "Administrador" : "Usuario",
      tablaDatos,
      `Reporte desde ${fechaInicio} hasta ${fechaFin}`,
      graficoBase64,
      encabezados
    );
  };

  return (
    <div className="container my-5">
      <h2 className="text-center mb-4">📄 Reportes PDF Personalizados</h2>

      <div className="row mb-4">
        <div className="col-md-5">
          <label htmlFor="fechaInicio" className="form-label">
            Fecha Inicio:
          </label>
          <input
            type="date"
            id="fechaInicio"
            className="form-control"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div className="col-md-5">
          <label htmlFor="fechaFin" className="form-label">
            Fecha Fin:
          </label>
          <input
            type="date"
            id="fechaFin"
            className="form-control"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        <div className="col-md-2 d-flex align-items-end">
          <button className="btn btn-primary w-100" onClick={cargarDatos}>
            Buscar
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger text-center mb-4">{error}</div>}
      {cargando && <p className="text-center">Cargando datos...</p>}

      {datos.length > 0 && (
        <>
          <div className="card mb-4" style={{ height: 400 }}>
            <Line ref={chartRef} data={lineData} options={options} />
          </div>

          <div className="table-responsive">
            <table className="table table-striped table-bordered text-center">
              <thead className="table-dark">
                <tr>
                  {rol === "administrador" ? (
                    <>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Nombre</th>
                      <th>Voltaje (V)</th>
                      <th>Batería (%)</th>
                      <th>Consumo (W)</th>
                    </>
                  ) : (
                    <>
                      <th>Fecha</th>
                      <th>Voltaje (V)</th>
                      <th>Batería (%)</th>
                      <th>Consumo (W)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {datos.map((d, i) =>
                  rol === "administrador" ? (
                    <tr key={i}>
                      <td>{d.login}</td>
                      <td>{d.rol}</td>
                      <td>{`${d.nombres} ${d.primer_apellido} ${d.segundo_apellido || ""}`}</td>
                      <td>{d.voltaje}</td>
                      <td>{d.bateria}</td>
                      <td>{d.consumo}</td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td>{new Date(d.fecha_lectura).toLocaleString()}</td>
                      <td>{d.voltaje}</td>
                      <td>{d.bateria}</td>
                      <td>{d.consumo}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-3">
            <button className="btn btn-success" onClick={exportarPDF}>
              🖨️ Exportar PDF
            </button>
          </div>
        </>
      )}

      {datos.length === 0 && !cargando && !error && (
        <p className="text-center text-muted">No hay datos para mostrar.</p>
      )}
    </div>
  );
}

export default Reportes;
