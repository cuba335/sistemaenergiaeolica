// src/pages/DashboardAdmin.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

import { Card, Row, Col, Button, Badge, Spinner, Form, Table } from "react-bootstrap";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Legend, Filler);

// ---- Umbrales (ajústalos a tu gusto) ----
const UMBRAL = {
  VOLTAJE_ALTO: 15,   // V
  BATERIA_BAJA: 20,   // %
  CONSUMO_ALTO: 80,   // W
};

// ---- Utilidades (formato y mock) ----
const fmt = (n, dec = 2, suf = "") =>
  Number.isFinite(Number(n)) ? `${Number(n).toFixed(dec)}${suf}` : "—";

function generarLecturasMock(n = 24) {
  const base = new Date();
  const out = [];
  let bateria = 92;
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(base.getTime() - i * 60 * 1000); // cada minuto
    const k = (n - i) / n;
    const voltaje = 12.6 + Math.sin(k * Math.PI * 2) * 0.4 + (Math.random() - 0.5) * 0.15;
    bateria = Math.max(10, bateria - Math.random() * 0.7);
    const consumo = 52 + Math.cos(k * Math.PI * 2) * 7 + (Math.random() - 0.5) * 4;

    out.push({
      fecha_lectura: t.toISOString(),
      voltaje: Number(voltaje.toFixed(2)),
      bateria: Number(bateria.toFixed(0)),
      consumo: Number(consumo.toFixed(1)),
    });
  }
  // Admin ve “todos los usuarios”: añadimos un login ficticio
  return out.map((d, i) => ({ ...d, login: `user${(i % 3) + 1}`, rol: "usuario" }));
}

function generarAlertasDesdeLecturas(lects) {
  return lects
    .filter(
      (d) =>
        d.voltaje > UMBRAL.VOLTAJE_ALTO ||
        d.bateria < UMBRAL.BATERIA_BAJA ||
        d.consumo > UMBRAL.CONSUMO_ALTO
    )
    .slice(-8)
    .reverse();
}

/** MOCK de usuarios con eólico para modo demo */
function generarUsuariosEolicosMock(n = 10) {
  const arr = Array.from({ length: n }).map((_, i) => {
    const id = i + 1;
    const asignado = Math.random() > 0.25; // 75% asignados
    const habil = asignado ? (Math.random() > 0.4 ? 1 : 0) : 0; // 60% de los asignados, activados
    return {
      id_usuario: id,
      usuario: `user${id}@demo.com`,
      nombres: `Usuario ${id}`,
      primer_apellido: "Demo",
      eolico_codigo: asignado ? `EOL-${String(1000 + id)}` : null,
      eolico_habilitado: habil,
    };
  });
  return arr;
}

export default function DashboardAdmin() {
  const navigate = useNavigate();

  // ---- Guard de rol (solo admin) ----
  useEffect(() => {
    const token = localStorage.getItem("token");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    if (!token) return navigate("/", { replace: true });
    if (rol !== "administrador") return navigate("/usuario", { replace: true });
  }, [navigate]);

  // ---- Estado ----
  const [usarMock, setUsarMock] = useState(true);  // 🔀 alterna mock/real
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [lecturas, setLecturas] = useState([]); // serie para gráfico (ASC)
  const [alertas, setAlertas] = useState([]);   // últimas alertas

  // NUEVO: usuarios con info de eólico
  const [usuariosEolicos, setUsuariosEolicos] = useState([]);
  const [cargandoEolicos, setCargandoEolicos] = useState(true);

  const lineRef = useRef(null);

  // ---- Carga de datos ----
  const cargar = useCallback(async () => {
    setError("");
    setCargando(true);
    setCargandoEolicos(true);
    try {
      if (usarMock) {
        // lecturas / alertas
        await new Promise((r) => setTimeout(r, 250));
        const m = generarLecturasMock(30);
        setLecturas(m);
        setAlertas(generarAlertasDesdeLecturas(m));
        // usuarios/eólicos mock
        setUsuariosEolicos(generarUsuariosEolicosMock(12));
      } else {
        // /resumen (admin) y /alertas
        const [r1, r2, r3] = await Promise.all([
          api.get("/resumen"),
          api.get("/alertas"),
          api.get("/usuarios"), // ← trae eolico_codigo y eolico_habilitado (ver backend)
        ]);

        const serie = (Array.isArray(r1.data) ? r1.data : []).slice().sort(
          (a, b) => new Date(a.fecha_lectura) - new Date(b.fecha_lectura)
        );
        setLecturas(serie);
        setAlertas(Array.isArray(r2.data) ? r2.data : []);
        setUsuariosEolicos(Array.isArray(r3.data) ? r3.data : []);
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.clear();
        navigate("/", { replace: true });
        return;
      }
      console.error(e);
      setError("Error al cargar datos del backend.");
      setLecturas([]);
      setAlertas([]);
      setUsuariosEolicos([]);
    } finally {
      setCargando(false);
      setCargandoEolicos(false);
    }
  }, [usarMock, navigate]);

  useEffect(() => {
    cargar();
    // Auto-refresco (mock cada 5s, real cada 30s)
    const ms = usarMock ? 5000 : 30000;
    const id = setInterval(() => {
      if (usarMock) {
        // refresco mock "en vivo"
        setLecturas((prev) => {
          if (prev.length === 0) return generarLecturasMock(30);
          const last = prev[prev.length - 1];
          const t = new Date(last.fecha_lectura);
          t.setMinutes(t.getMinutes() + 1);

          const voltaje = (last.voltaje ?? 12.6) + (Math.random() - 0.5) * 0.18;
          const bateria = Math.max(10, (last.bateria ?? 85) - Math.random() * 0.6);
          const consumo = (last.consumo ?? 52) + (Math.random() - 0.5) * 3.2;

          const nuevo = {
            fecha_lectura: t.toISOString(),
            voltaje: Number(voltaje.toFixed(2)),
            bateria: Number(bateria.toFixed(0)),
            consumo: Number(consumo.toFixed(1)),
            login: `user${((prev.length + 1) % 3) + 1}`,
            rol: "usuario",
          };
          const next = [...prev.slice(-29), nuevo];
          setAlertas(generarAlertasDesdeLecturas(next));
          return next;
        });

        // refresco mock de usuarios/eólicos cada 3 ciclos aprox
        setUsuariosEolicos((prev) => {
          if (prev.length === 0) return generarUsuariosEolicosMock(12);
          // hacer un flip aleatorio de un usuario
          const idx = Math.floor(Math.random() * prev.length);
          const copy = [...prev];
          if (copy[idx].eolico_codigo) {
            copy[idx] = {
              ...copy[idx],
              eolico_habilitado: copy[idx].eolico_habilitado ? 0 : 1,
            };
          }
          return copy;
        });
      } else {
        cargar();
      }
    }, ms);
    return () => clearInterval(id);
  }, [cargar, usarMock]);

  // ---- Derivados ----
  const ultima = lecturas.length ? lecturas[lecturas.length - 1] : null;
  const ultimaFecha = ultima?.fecha_lectura
    ? new Date(ultima.fecha_lectura).toLocaleString()
    : "—";

  const voltajeAlto = lecturas.some((d) => Number(d.voltaje) > UMBRAL.VOLTAJE_ALTO);
  const bateriaBaja = lecturas.some((d) => Number(d.bateria) < UMBRAL.BATERIA_BAJA);
  const consumoAlto = lecturas.some((d) => Number(d.consumo) > UMBRAL.CONSUMO_ALTO);

  const labels = useMemo(
    () =>
      lecturas.map((d) =>
        d?.fecha_lectura
          ? new Date(d.fecha_lectura).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : ""
      ),
    [lecturas]
  );

  const lineData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: "Voltaje (V)",
          data: lecturas.map((d) => Number(d.voltaje) || 0),
          borderColor: "#28a745",
          backgroundColor: "rgba(40,167,69,0.18)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
        {
          label: "Batería (%)",
          data: lecturas.map((d) => Number(d.bateria) || 0),
          borderColor: "#007bff",
          backgroundColor: "rgba(0,123,255,0.16)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
        {
          label: "Consumo (W)",
          data: lecturas.map((d) => Number(d.consumo) || 0),
          borderColor: "#fd7e14",
          backgroundColor: "rgba(253,126,20,0.16)",
          fill: true,
          tension: 0.35,
          pointRadius: 2,
        },
      ],
    }),
    [labels, lecturas]
  );

  const opcionesGrafico = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { mode: "index", intersect: false },
        title: { display: true, text: "Tendencias globales (últimas lecturas)" },
    },
      interaction: { mode: "nearest", intersect: false },
      animation: { duration: usarMock ? 600 : 300, easing: "easeOutQuart" },
      scales: {
        y: { beginAtZero: false },
        x: { ticks: { maxRotation: 0, autoSkip: true } },
      },
    }),
    [usarMock]
  );

  // ---- KPIs EÓLICOS (derivados de usuariosEolicos) ----
  const kpisEol = useMemo(() => {
    const totalUsuarios = usuariosEolicos.length;
    const asignados = usuariosEolicos.filter((u) => !!u.eolico_codigo);
    const totalAsignados = asignados.length;
    const activados = asignados.filter((u) => Number(u.eolico_habilitado) === 1).length;
    const desactivados = totalAsignados - activados;
    return {
      totalUsuarios,
      totalAsignados,
      activados,
      desactivados,
    };
  }, [usuariosEolicos]);

  // Orden para tabla de resumen eólico (solo algunos)
  const topUsuariosEolicos = useMemo(() => {
    // primero los que tienen código
    const arr = [...usuariosEolicos].sort((a, b) => {
      const ax = a.eolico_codigo ? 0 : 1;
      const bx = b.eolico_codigo ? 0 : 1;
      if (ax !== bx) return ax - bx;
      // los activados primero
      return (b.eolico_habilitado || 0) - (a.eolico_habilitado || 0);
    });
    return arr.slice(0, 8);
  }, [usuariosEolicos]);

  return (
    <div className="container py-4">

      {/* Encabezado */}
      <div
        className="rounded-3 p-4 mb-4 shadow-sm"
        style={{
          background: "linear-gradient(135deg, rgba(0,123,255,.08), rgba(40,167,69,.08))",
          border: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h2 className="mb-1">Administrador</h2>
            <div className="text-muted">Visión global del sistema</div>
          </div>
          <div className="d-flex align-items-center gap-3">
            <Form.Check
              type="switch"
              id="switchMock"
              label="Usar datos de prueba"
              checked={usarMock}
              onChange={() => setUsarMock((v) => !v)}
            />
            <Button variant="outline-secondary" onClick={cargar} disabled={cargando || cargandoEolicos}>
              {(cargando || cargandoEolicos) ? "Cargando…" : "Actualizar ahora"}
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Estado del sistema */}
      <div
        className={`mb-4 p-3 border rounded d-flex align-items-center justify-content-between ${
          voltajeAlto || bateriaBaja || consumoAlto ? "bg-danger text-white" : "bg-success text-white"
        }`}
      >
        <strong>
          {voltajeAlto || bateriaBaja || consumoAlto ? "🚨 Sistema en alerta" : "✅ Sistema estable"}
        </strong>
        <small>Última actualización: {ultimaFecha}</small>
      </div>

      {/* KPIs rápidos */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small mb-1">Voltaje alto</div>
                <div className={voltajeAlto ? "text-danger fw-bold" : "text-success fw-bold"}>
                  {voltajeAlto ? `Sí (> ${UMBRAL.VOLTAJE_ALTO} V)` : "No"}
                </div>
              </div>
              <div style={{ fontSize: 28 }}>🔌</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small mb-1">Batería baja</div>
                <div className={bateriaBaja ? "text-warning fw-bold" : "text-success fw-bold"}>
                  {bateriaBaja ? `Sí (< ${UMBRAL.BATERIA_BAJA} %)` : "No"}
                </div>
              </div>
              <div style={{ fontSize: 28 }}>🔋</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small mb-1">Consumo alto</div>
                <div className={consumoAlto ? "text-info fw-bold" : "text-success fw-bold"}>
                  {consumoAlto ? `Sí (> ${UMBRAL.CONSUMO_ALTO} W)` : "No"}
                </div>
              </div>
              <div style={{ fontSize: 28 }}>⚡</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* === NUEVO BLOQUE: Estado de sistemas eólicos === */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="mb-0">Sistemas eólicos — estado general</h5>
            {cargandoEolicos && <span className="text-muted small">Cargando…</span>}
          </div>

          {/* KPIs eólicos */}
          <Row className="g-3">
            <Col md={3}>
              <Card className="border-0 bg-light h-100">
                <Card.Body>
                  <div className="text-muted small">Usuarios totales</div>
                  <div className="fs-4 fw-bold">{kpisEol.totalUsuarios}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 h-100" style={{ background: "rgba(108,117,125,.08)" }}>
                <Card.Body>
                  <div className="text-muted small">Con eólico asignado</div>
                  <div className="fs-4 fw-bold">{kpisEol.totalAsignados}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 h-100" style={{ background: "rgba(40,167,69,.08)" }}>
                <Card.Body>
                  <div className="text-muted small">Activados</div>
                  <div className="fs-4 fw-bold text-success">{kpisEol.activados}</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-0 h-100" style={{ background: "rgba(220,53,69,.08)" }}>
                <Card.Body>
                  <div className="text-muted small">Desactivados</div>
                  <div className="fs-4 fw-bold text-danger">{kpisEol.desactivados}</div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabla breve */}
          <div className="mt-4">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <strong>Resumen rápido (8)</strong>
              <Button
                size="sm"
                variant="outline-primary"
                onClick={() => navigate("/alquiler")}
              >
                Gestionar alquiler / activación
              </Button>
            </div>
            {topUsuariosEolicos.length === 0 ? (
              <p className="text-muted m-0">Sin datos para mostrar.</p>
            ) : (
              <div className="table-responsive">
                <Table bordered hover size="sm" className="align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>#</th>
                      <th>Usuario</th>
                      <th>Nombre</th>
                      <th>Código eólico</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsuariosEolicos.map((u, idx) => (
                      <tr key={u.id_usuario}>
                        <td>{idx + 1}</td>
                        <td>{u.usuario}</td>
                        <td>{[u.nombres, u.primer_apellido].filter(Boolean).join(" ") || "—"}</td>
                        <td>{u.eolico_codigo || <span className="text-muted">No asignado</span>}</td>
                        <td>
                          {u.eolico_codigo ? (
                            <Badge bg={u.eolico_habilitado ? "success" : "danger"}>
                              {u.eolico_habilitado ? "Activado" : "Desactivado"}
                            </Badge>
                          ) : (
                            <Badge bg="secondary">No asignado</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </div>
        </Card.Body>
      </Card>
      {/* === FIN BLOQUE NUEVO === */}

      {/* Gráfico principal */}
      <Card className="shadow-sm mb-4 border-0" style={{ minHeight: 420 }}>
        <Card.Body>
          {cargando ? (
            <div className="d-flex align-items-center justify-content-center" style={{ minHeight: 320 }}>
              <Spinner animation="border" />
            </div>
          ) : lecturas.length === 0 ? (
            <p className="text-center text-muted m-0">No hay lecturas para mostrar.</p>
          ) : (
            <div style={{ height: 340 }}>
              <Line ref={lineRef} data={lineData} options={opcionesGrafico} />
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Alertas recientes */}
      <Card className="shadow-sm border-0 mb-4">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="mb-0">Últimas alertas</h5>
            <span className="text-muted small">
              {alertas.length ? `Mostrando ${Math.min(alertas.length, 8)} de ${alertas.length}` : "—"}
            </span>
          </div>
          {alertas.length === 0 ? (
            <p className="text-muted m-0">Sin alertas recientes.</p>
          ) : (
            <ul className="list-group">
              {alertas.slice(0, 8).map((a, i) => (
                <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <strong>{a?.login || "usuario"}</strong>{" "}
                    <Badge bg="secondary" className="me-2">
                      {a?.rol || "usuario"}
                    </Badge>
                    <span className="text-muted">
                      • {a?.fecha_lectura ? new Date(a.fecha_lectura).toLocaleString() : "Sin fecha"}
                    </span>
                    <div className="small">
                      Voltaje: {fmt(a?.voltaje, 2, " V")} · Batería: {fmt(a?.bateria, 0, " %")} · Consumo:{" "}
                      {fmt(a?.consumo, 1, " W")}
                    </div>
                  </div>
                  <Badge bg="warning" text="dark">Atención</Badge>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 d-flex gap-2">
            <Button variant="primary" onClick={() => navigate("/alertas")}>Ver todas las alertas</Button>
            <Button variant="success" onClick={() => navigate("/graficos")}>Ver gráficos detallados</Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
