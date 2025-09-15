// src/components/Graficos.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  ArcElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../api/axios";
import { generarPDF } from "../components/ReportePDF";
import "animate.css";

ChartJS.register(
  LineElement,
  BarElement,
  ArcElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);

/* ===== Datos de prueba para demo ===== */
const mockLecturas = [
  { fecha_lectura: "2025-08-15T09:00:00", voltaje: 12.4, bateria: 86, consumo: 48 },
  { fecha_lectura: "2025-08-15T10:00:00", voltaje: 12.7, bateria: 84, consumo: 52 },
  { fecha_lectura: "2025-08-15T11:00:00", voltaje: 12.6, bateria: 82, consumo: 53 },
  { fecha_lectura: "2025-08-15T12:00:00", voltaje: 12.5, bateria: 81, consumo: 55 },
  { fecha_lectura: "2025-08-15T13:00:00", voltaje: 12.8, bateria: 79, consumo: 58 },
];

/* ===== Helper: obtener PNG en alta resolución del chart ===== */
const toBase64HiDPI = (chartRef, scale = 3) => {
  const chart = chartRef?.current;
  if (!chart) return null;

  const oldDpr = chart.options.devicePixelRatio;
  chart.options.devicePixelRatio = scale;
  chart.resize();
  const img = chart.toBase64Image("image/png", 1.0);
  chart.options.devicePixelRatio = oldDpr;
  chart.resize();
  return img;
};

// helpers de sesión
function getRol() {
  return (localStorage.getItem("rol") || "").toLowerCase();
}
function getUsuarioLS() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    return null;
  }
}

// normalizador para búsqueda (quita acentos y pasa a minúsculas)
const norm = (s) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function Graficos() {
  const lineRef = useRef(null);
  const barRef = useRef(null);
  const pieRef = useRef(null);

  const [datos, setDatos] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  // switches
  const [usarMock, setUsarMock] = useState(true); // alterna demo / backend
  const [tiempoReal, setTiempoReal] = useState(false); // simula stream en vivo

  // === soporte para admin buscar un usuario ===
  const rol = getRol();
  const soyAdmin = rol === "administrador";
  const me = getUsuarioLS();

  const [usuarios, setUsuarios] = useState([]); // lista para el buscador
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState(null); // {id_usuario, usuario, nombres, ...}

  const MAX_PUNTOS = 30;
  const INTERVALO_MS = 2000;

  // Cargar usuarios para el buscador (solo admin). Descarga una vez y filtra local.
  const cargarUsuarios = useCallback(async () => {
    if (!soyAdmin) return;
    try {
      setCargandoUsuarios(true);
      const res = await api.get("/usuarios");
      setUsuarios(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setUsuarios([]);
    } finally {
      setCargandoUsuarios(false);
    }
  }, [soyAdmin]);

  useEffect(() => {
    cargarUsuarios();
  }, [cargarUsuarios]);

  const usuariosFiltrados = useMemo(() => {
    const q = norm(busqueda);
    if (!q) return usuarios.slice(0, 20);
    return usuarios
      .filter((u) => {
        const campos = [
          u.id_usuario,
          u.usuario,
          u.nombres,
          u.primer_apellido,
          u.segundo_apellido,
          u.nombre_rol,
          u.ci,
        ].map((x) => norm(x));
        return campos.some((c) => c.includes(q));
      })
      .slice(0, 20);
  }, [busqueda, usuarios]);

  // ===== Cargar datos (backend o mock), según usuario seleccionado (admin) =====
  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError("");

      if (usarMock) {
        setDatos(mockLecturas);
      } else {
        // si soy admin y hay un usuario seleccionado, pedir sus datos
        const userId = soyAdmin && seleccionado?.id_usuario ? seleccionado.id_usuario : undefined;
        const url = userId ? `/resumen?userId=${encodeURIComponent(userId)}` : "/resumen";
        const res = await api.get(url);
        const arr = Array.isArray(res.data) ? res.data : [];
        setDatos(
          arr.map((d, i) => ({
            fecha_lectura:
              d.fecha_lectura || new Date(Date.now() - (arr.length - i) * 3600e3).toISOString(),
            voltaje: Number(d.voltaje) || 0,
            bateria: Number(d.bateria) || 0,
            consumo: Number(d.consumo) || 0,
          }))
        );
      }
    } catch (e) {
      setError("No se pudo cargar los datos.");
      setDatos([]);
    } finally {
      setCargando(false);
    }
  }, [usarMock, soyAdmin, seleccionado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  /* ===== Simulación “tiempo real” ===== */
  useEffect(() => {
    if (!tiempoReal) return;
    const id = setInterval(() => {
      setDatos((prev) => {
        const now = new Date();
        const anterior = prev.at(-1) || { bateria: 80, voltaje: 12.5, consumo: 50 };
        const nuevo = {
          fecha_lectura: now.toISOString(),
          voltaje: +(anterior.voltaje + (Math.random() * 0.3 - 0.15)).toFixed(2),
          bateria: Math.max(
            0,
            Math.min(100, +(anterior.bateria + (Math.random() * 1.2 - 0.6)).toFixed(0))
          ),
          consumo: +(anterior.consumo + (Math.random() * 3 - 1.5)).toFixed(0),
        };
        const arr = [...prev, nuevo];
        return arr.length > MAX_PUNTOS ? arr.slice(-MAX_PUNTOS) : arr;
      });
    }, INTERVALO_MS);

    return () => clearInterval(id);
  }, [tiempoReal]);

  /* ===== Preparación de series ===== */
  const serieOrdenada = datos
    .slice()
    .sort((a, b) => new Date(a.fecha_lectura) - new Date(b.fecha_lectura));

  const etiquetas = serieOrdenada.map((d) =>
    new Date(d.fecha_lectura).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );

  const voltajes = serieOrdenada.map((d) => Number(d.voltaje) || 0);
  const baterias = serieOrdenada.map((d) => Number(d.bateria) || 0);
  const consumos = serieOrdenada.map((d) => Number(d.consumo) || 0);

  /* ===== Config Chart.js ===== */
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: "easeOutQuart" },
    interaction: { mode: "nearest", intersect: false },
    plugins: { legend: { position: "bottom" }, tooltip: { mode: "index", intersect: false } },
    scales: { y: { beginAtZero: true } },
  };

  const lineData = {
    labels: etiquetas,
    datasets: [
      {
        label: "Voltaje (V)",
        data: voltajes,
        borderColor: "#28a745",
        backgroundColor: "rgba(40,167,69,0.2)",
        tension: 0.3,
        fill: true,
      },
      {
        label: "Batería (%)",
        data: baterias,
        borderColor: "#007bff",
        backgroundColor: "rgba(0,123,255,0.2)",
        tension: 0.3,
        fill: true,
      },
      {
        label: "Consumo (W)",
        data: consumos,
        borderColor: "#fd7e14",
        backgroundColor: "rgba(253,126,20,0.2)",
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const barData = {
    labels: etiquetas,
    datasets: [
      { label: "Nivel de Batería (%)", data: baterias, backgroundColor: "#007bff", borderRadius: 6 },
    ],
  };

  const pieData = {
    labels: etiquetas.length ? etiquetas : ["Sin datos"],
    datasets: [
      {
        label: "Consumo energético (W)",
        data: consumos.length ? consumos : [1],
        backgroundColor: ["#4caf50", "#2196f3", "#ff9800", "#f44336", "#9c27b0"],
        hoverOffset: 20,
      },
    ],
  };

  /* ===== Exportación PDF nítida ===== */
  const exportarPDF = async (ref, titulo, filas, columnas, nombreArchivo) => {
    const img = toBase64HiDPI(ref, 3); // 3x DPI
    if (!img) return;
    let nombreUsuario = "—";
    try {
      if (soyAdmin && seleccionado) {
        nombreUsuario = seleccionado.usuario || seleccionado.nombres || "—";
      } else {
        nombreUsuario = me?.usuario || "—";
      }
    } catch {}
    await generarPDF({
      titulo,
      usuario: nombreUsuario,
      descripcion: usarMock
        ? "Datos de prueba (mock)"
        : tiempoReal
        ? "Tiempo real"
        : soyAdmin && seleccionado
        ? `Datos del usuario ID ${seleccionado.id_usuario}`
        : "Datos del servidor",
      tabla: filas,
      head: columnas,
      graficoBase64: img,
      nombreArchivo: nombreArchivo || "reporte_monitor",
    });
  };

  // Texto “Mostrando…”
  const tituloContexto = useMemo(() => {
    if (usarMock) return "Mostrando: datos de prueba (mock)";
    if (soyAdmin && seleccionado) {
      const nom =
        [seleccionado.nombres, seleccionado.primer_apellido, seleccionado.segundo_apellido]
          .filter(Boolean)
          .join(" ") || seleccionado.usuario;
      return `Mostrando: ${nom} (ID ${seleccionado.id_usuario})`;
    }
    return me?.usuario ? `Mostrando: ${me.usuario}` : "Mostrando: usuario actual";
  }, [usarMock, soyAdmin, seleccionado, me]);

  return (
    <div className="container my-5 animate__animated animate__fadeIn">
      {/* Header & switches */}
      <div className="card shadow-sm mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between">
          <div className="d-flex flex-column">
            <h3 className="m-0">📊 Monitoreo del Sistema Eólico</h3>
            <small className="text-muted">{tituloContexto}</small>
          </div>

          <div className="d-flex align-items-center gap-3">
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="switchMock"
                checked={usarMock}
                onChange={() => setUsarMock((prev) => !prev)}
              />
              <label className="form-check-label" htmlFor="switchMock">
                Usar datos de prueba
              </label>
            </div>
            <div className="form-check form-switch m-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="switchRT"
                checked={tiempoReal}
                onChange={() => setTiempoReal((prev) => !prev)}
              />
              <label className="form-check-label" htmlFor="switchRT">
                Tiempo real (simulado)
              </label>
            </div>
            <button className="btn btn-outline-secondary" onClick={cargar}>
              Recargar
            </button>
          </div>
        </div>
      </div>

      {/* Buscador de usuarios (solo admin, desactivado si usarMock) */}
      {soyAdmin && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="badge bg-dark-subtle text-dark me-2">Modo administrador</div>
              <div className="flex-grow-1" style={{ minWidth: 280 }}>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Buscar usuario por nombre, correo, CI…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  disabled={usarMock}
                />
              </div>
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  setBusqueda("");
                  setSeleccionado(null);
                  cargar(); // recargar al usuario actual (o sin userId)
                }}
                disabled={usarMock && !seleccionado}
              >
                Limpiar selección
              </button>
              {cargandoUsuarios && <span className="text-muted small ms-2">Cargando usuarios…</span>}
            </div>

            {/* dropdown simple con resultados */}
            {!usarMock && busqueda && usuariosFiltrados.length > 0 && (
              <div className="list-group mt-2" style={{ maxHeight: 280, overflowY: "auto" }}>
                {usuariosFiltrados.map((u) => {
                  const nombreCompleto = [u.nombres, u.primer_apellido, u.segundo_apellido]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={u.id_usuario}
                      type="button"
                      className="list-group-item list-group-item-action"
                      onClick={() => {
                        setSeleccionado(u);
                        setBusqueda(`${nombreCompleto || u.usuario} (${u.usuario || "sin correo"})`);
                        setTimeout(() => cargar(), 0);
                      }}
                    >
                      <div className="d-flex justify-content-between">
                        <strong>{nombreCompleto || "—"}</strong>
                        <span className="badge bg-secondary">{u.nombre_rol || "—"}</span>
                      </div>
                      <div className="small text-muted">
                        {u.usuario || "—"} · ID: {u.id_usuario} · CI: {u.ci || "—"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {soyAdmin && !usarMock && seleccionado && (
              <div className="mt-2">
                <span className="badge bg-info text-dark">
                  Seleccionado: ID {seleccionado.id_usuario}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger text-center mb-4">{error}</div>}
      {cargando && <p className="text-center my-4">Cargando datos...</p>}
      {!cargando && datos.length === 0 && !error && (
        <p className="text-center text-muted">No hay datos para mostrar.</p>
      )}

      {datos.length > 0 && (
        <>
          {/* Línea */}
          <section className="mb-5">
            <div className="card shadow" style={{ borderRadius: 16 }}>
              <div
                className="card-header bg-success text-white"
                style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
              >
                <strong>Tendencias de Voltaje, Batería y Consumo</strong>
              </div>
              <div className="card-body" style={{ height: 420 }}>
                <Line ref={lineRef} data={lineData} options={options} />
              </div>
              <div className="card-footer text-center">
                <button
                  className="btn btn-success"
                  onClick={() =>
                    exportarPDF(
                      lineRef,
                      "Gráfico de Tendencias Eléctricas",
                      serieOrdenada.map((d) => [
                        new Date(d.fecha_lectura).toLocaleString(),
                        d.voltaje,
                        d.bateria,
                        d.consumo,
                      ]),
                      ["Fecha/Hora", "Voltaje (V)", "Batería (%)", "Consumo (W)"],
                      "reporte_tendencias"
                    )
                  }
                >
                  🖨️ Exportar PDF
                </button>
              </div>
            </div>
          </section>

          {/* Barras + Pie */}
          <section className="row">
            <div className="col-md-6 mb-4">
              <div className="card shadow h-100" style={{ borderRadius: 16 }}>
                <div
                  className="card-header bg-primary text-white"
                  style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                >
                  <strong>Nivel de Batería</strong>
                </div>
                <div className="card-body" style={{ height: 360 }}>
                  <Bar ref={barRef} data={barData} options={options} />
                </div>
                <div className="card-footer text-center">
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      exportarPDF(
                        barRef,
                        "Gráfico de Nivel de Batería",
                        serieOrdenada.map((d) => [
                          new Date(d.fecha_lectura).toLocaleString(),
                          d.bateria,
                        ]),
                        ["Fecha/Hora", "Batería (%)"],
                        "reporte_bateria"
                      )
                    }
                  >
                    🖨️ Exportar PDF
                  </button>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-4">
              <div className="card shadow h-100" style={{ borderRadius: 16 }}>
                <div
                  className="card-header bg-warning"
                  style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                >
                  <strong>Consumo Relativo</strong>
                </div>
                <div className="card-body" style={{ height: 360 }}>
                  <Pie ref={pieRef} data={pieData} options={options} />
                </div>
                <div className="card-footer text-center">
                  <button
                    className="btn btn-warning text-dark"
                    onClick={() =>
                      exportarPDF(
                        pieRef,
                        "Gráfico de Consumo Energético",
                        serieOrdenada.map((d) => [
                          new Date(d.fecha_lectura).toLocaleString(),
                          d.consumo,
                        ]),
                        ["Fecha/Hora", "Consumo (W)"],
                        "reporte_consumo"
                      )
                    }
                  >
                    🖨️ Exportar PDF
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Graficos;
