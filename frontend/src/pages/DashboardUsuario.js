// src/pages/DashboardUsuario.js
import React, { useEffect, useMemo, useState, useCallback } from "react";
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

import {
  Card,
  Modal,
  Button,
  Row,
  Col,
  Spinner,
  Form,
  Badge,
} from "react-bootstrap";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* =========================
   Utilidades y datos mock
========================= */

// Genera una serie de lecturas ficticias con una onda suave + ruido
function generarLecturasMock(n = 20) {
  const base = new Date();
  const res = [];
  let bateria = 90; // arranca alta y baja poco a poco
  for (let i = n - 1; i >= 0; i--) {
    const t = new Date(base.getTime() - i * 60 * 1000); // cada minuto
    const k = (n - i) / n;
    const voltaje =
      12.5 + Math.sin(k * Math.PI * 2) * 0.35 + (Math.random() - 0.5) * 0.15;
    bateria = Math.max(10, bateria - Math.random() * 0.6); // va bajando
    const consumo =
      50 + Math.cos(k * Math.PI * 2) * 6 + (Math.random() - 0.5) * 4;

    res.push({
      fecha_lectura: t.toISOString(),
      voltaje: Number(voltaje.toFixed(2)),
      bateria: Number(bateria.toFixed(0)),
      consumo: Number(consumo.toFixed(1)),
    });
  }
  return res.reverse(); // más antiguo -> más nuevo
}

function generarAlertasDesdeLecturas(lecturas) {
  const UMBRAL_BATERIA = 20;
  const UMBRAL_VOLTAJE_BAJO = 10;
  return lecturas
    .filter(
      (d) => d.bateria < UMBRAL_BATERIA || d.voltaje < UMBRAL_VOLTAJE_BAJO
    )
    .slice(-5) // últimas 5
    .map((d) => ({
      ...d,
      mensaje:
        d.bateria < UMBRAL_BATERIA
          ? "Batería baja"
          : d.voltaje < UMBRAL_VOLTAJE_BAJO
          ? "Voltaje bajo"
          : "Alerta",
    }))
    .reverse();
}

const fmtNum = (n, dec = 0, suf = "") =>
  Number.isFinite(Number(n)) ? `${Number(n).toFixed(dec)}${suf}` : "—";

/* =========================
   Componente principal
========================= */

export default function DashboardUsuario() {
  const navigate = useNavigate();

  // ---- Estado UI ----
  const [usarMock, setUsarMock] = useState(true); // ⬅️ por defecto datos REALES
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // ---- Datos ----
  const [lecturas, setLecturas] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [perfil, setPerfil] = useState(null); // { nombre_completo, email, telefono, direccion, ... }

  // ---- KPIs (último valor) ----
  const ultima = lecturas.length ? lecturas[lecturas.length - 1] : null;
  const penultima = lecturas.length > 1 ? lecturas[lecturas.length - 2] : null;

  const voltaje = ultima?.voltaje ?? null;
  const bateria = ultima?.bateria ?? null;
  const consumo = ultima?.consumo ?? null;

  const delta = (a, b) =>
    a == null || b == null ? null : Number(a) - Number(b);

  const dVolt = delta(voltaje, penultima?.voltaje);
  const dBat = delta(bateria, penultima?.bateria);
  const dCon = delta(consumo, penultima?.consumo);

  const arrow = (d) => (d == null ? "" : d > 0 ? "▲" : d < 0 ? "▼" : "■");

  // ---- Guard de sesión/rol + carga de perfil real ----
  useEffect(() => {
    const token = localStorage.getItem("token");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();

    if (!token) {
      navigate("/", { replace: true });
      return;
    }
    if (rol === "administrador") {
      navigate("/admin", { replace: true });
      return;
    }
    if (rol !== "usuario") {
      navigate("/", { replace: true });
      return;
    }

    // Traemos el PERFIL REAL del backend
    (async () => {
      try {
        const r = await api.get("/me-detalle");
        // Esperado del backend (según tu index.js):
        // { nombre_completo, email, telefono, direccion, ... }
        const p = r?.data || {};
        setPerfil({
          nombre_completo:
            p.nombre_completo ||
            [p.nombres, p.primer_apellido, p.segundo_apellido]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            "Usuario",
          email: p.email || "",
          telefono: p.telefono || "",
          direccion: p.direccion || "",
        });
      } catch (e) {
        console.error("Error cargando perfil:", e);
        // Fallback minimal
        setPerfil({ nombre_completo: "Usuario", email: "", telefono: "", direccion: "" });
      }
    })();
  }, [navigate]);

  // ---- Carga de datos (real o mock) ----
  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      if (usarMock) {
        // Simulamos latencia
        await new Promise((r) => setTimeout(r, 400));
        const m = generarLecturasMock(24);
        setLecturas(m);
        setAlertas(generarAlertasDesdeLecturas(m));
      } else {
        const [rLect, rAl] = await Promise.all([
          api.get("/resumen"),
          api.get("/alertas"),
        ]);
        const lect = Array.isArray(rLect.data) ? rLect.data : [];
        const als = Array.isArray(rAl.data) ? rAl.data : [];
        // /resumen backend devuelve DESC; ordenamos ASC para el gráfico
        const ordenadas = lect
          .slice()
          .sort(
            (a, b) => new Date(a.fecha_lectura) - new Date(b.fecha_lectura)
          );
        setLecturas(ordenadas);
        setAlertas(als.slice(0, 5));
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.clear();
        navigate("/", { replace: true });
        return;
      }
      console.error(e);
      setError("No se pudieron obtener las lecturas.");
      setLecturas([]);
      setAlertas([]);
    } finally {
      setCargando(false);
    }
  }, [usarMock, navigate]);

  useEffect(() => {
    cargar();
    // Auto-refresco cada 30s en modo real; 5s en mock para “vivo”
    const ms = usarMock ? 5000 : 30000;
    const id = setInterval(() => {
      if (usarMock) {
        // Avanzamos la serie con un nuevo punto mock
        setLecturas((prev) => {
          const base = prev.length ? prev[prev.length - 1] : generarLecturasMock(1)[0];
          const t = new Date(base.fecha_lectura);
          t.setMinutes(t.getMinutes() + 1);

          const voltaje =
            (base.voltaje ?? 12.5) +
            (Math.random() - 0.5) * 0.15 +
            Math.sin(Date.now() / 180000) * 0.05;
          const bateria = Math.max(10, (base.bateria ?? 80) - Math.random() * 0.5);
          const consumo =
            (base.consumo ?? 50) +
            (Math.random() - 0.5) * 2.5 +
            Math.cos(Date.now() / 200000) * 1.5;

          const nuevo = {
            fecha_lectura: t.toISOString(),
            voltaje: Number(voltaje.toFixed(2)),
            bateria: Number(bateria.toFixed(0)),
            consumo: Number(consumo.toFixed(1)),
          };
          const next = [...prev.slice(-23), nuevo]; // mantenemos ~24 puntos
          setAlertas(generarAlertasDesdeLecturas(next));
          return next;
        });
      } else {
        cargar();
      }
    }, ms);
    return () => clearInterval(id);
  }, [cargar, usarMock]);

  // ---- Modal de alerta cuando batería < 20 % (si llega un valor crítico nuevo) ----
  const [showAlerta, setShowAlerta] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState("");
  useEffect(() => {
    if (ultima?.bateria != null && ultima.bateria < 20) {
      setMensajeAlerta("⚠️ ¡Alerta! Nivel de batería bajo.");
      setShowAlerta(true);
    }
  }, [ultima?.bateria]);

  // ---- Gráfico (líneas) ----
  const etiquetas = useMemo(
    () =>
      lecturas.map((d) =>
        d?.fecha_lectura
          ? new Date(d.fecha_lectura).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""
      ),
    [lecturas]
  );

  const lineData = useMemo(
    () => ({
      labels: etiquetas,
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
    [lecturas, etiquetas]
  );

  const opcionesGrafico = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { mode: "index", intersect: false },
        title: {
          display: true,
          text: "Voltaje / Batería / Consumo (últimas lecturas)",
        },
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

  const ultimaFecha =
    lecturas.length && lecturas[lecturas.length - 1]?.fecha_lectura
      ? new Date(lecturas[lecturas.length - 1].fecha_lectura).toLocaleString()
      : "—";

  // Correo de soporte (funciona con mailto:)
  const SOPORTE_EMAIL = "soporte@energia.com";
  const soporteHref = `mailto:${SOPORTE_EMAIL}?subject=${encodeURIComponent(
    "Soporte técnico — Sistema Eólico"
  )}&body=${encodeURIComponent(
    "Hola equipo de soporte,\n\nNecesito ayuda con mi equipo eólico.\n\nGracias."
  )}`;

  return (
    <div className="container py-4">
      {/* Hero / encabezado */}
      <div
        className="rounded-3 p-4 mb-4 shadow-sm"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,123,255,0.1), rgba(40,167,69,0.1))",
          border: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            {/* ⬇️ Muestra NOMBRE, no correo */}
            <h2 className="mb-1">
              Bienvenido,{" "}
              {perfil?.nombre_completo ? perfil.nombre_completo : "Usuario"}
            </h2>
            <div className="text-muted">
              Panel de usuario • Monitoreo en tiempo real
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Form.Check
              type="switch"
              id="switchMock"
              label="Usar datos de prueba"
              checked={usarMock}
              onChange={() => setUsarMock((v) => !v)}
            />
            <Button
              variant="outline-secondary"
              onClick={cargar}
              disabled={cargando}
            >
              {cargando ? "Cargando..." : "Actualizar ahora"}
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* KPIs */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="shadow-sm h-100 border-0">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small mb-1">Voltaje</div>
                <div className="fs-4 fw-bold">{fmtNum(voltaje, 2, " V")}</div>
                <div
                  className={`small ${
                    dVolt == null
                      ? "text-muted"
                      : dVolt >= 0
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {arrow(dVolt)} {dVolt == null ? "—" : fmtNum(dVolt, 2, " V")}{" "}
                  vs. último
                </div>
              </div>
              <div style={{ fontSize: 30 }}>🔌</div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="shadow-sm h-100 border-0">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small mb-1">Batería</div>
                <div className="fs-4 fw-bold">
                  {fmtNum(bateria, 0, " %")}{" "}
                  {bateria != null && bateria < 20 && (
                    <Badge bg="warning" text="dark">
                      Baja
                    </Badge>
                  )}
                </div>
                <div
                  className={`small ${
                    dBat == null
                      ? "text-muted"
                      : dBat >= 0
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {arrow(dBat)} {dBat == null ? "—" : fmtNum(dBat, 0, " %")} vs.
                  último
                </div>
              </div>
              <div style={{ fontSize: 30 }}>🔋</div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="shadow-sm h-100 border-0">
            <Card.Body className="d-flex justify-content-between align-items-center">
              <div>
                <div className="text-muted small mb-1">Consumo</div>
                <div className="fs-4 fw-bold">{fmtNum(consumo, 1, " W")}</div>
                <div
                  className={`small ${
                    dCon == null
                      ? "text-muted"
                      : dCon >= 0
                      ? "text-danger"
                      : "text-success"
                  }`}
                >
                  {arrow(dCon)} {dCon == null ? "—" : fmtNum(dCon, 1, " W")} vs.
                  último
                </div>
              </div>
              <div style={{ fontSize: 30 }}>⚡</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal de alerta por batería baja */}
      <Modal show={showAlerta} onHide={() => setShowAlerta(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Alerta del sistema</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-0">{mensajeAlerta}</p>
          <small className="text-muted">
            Revisa tu equipo y contacta soporte si corresponde.
          </small>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAlerta(false)}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Gráfico principal */}
      <Card className="shadow-sm mb-4 border-0" style={{ minHeight: 420 }}>
        <Card.Body>
          {cargando ? (
            <div
              className="d-flex align-items-center justify-content-center"
              style={{ minHeight: 320 }}
            >
              <Spinner animation="border" />
            </div>
          ) : lecturas.length === 0 ? (
            <p className="text-center text-muted m-0">
              No hay datos para mostrar.
            </p>
          ) : (
            <>
              <div style={{ height: 340 }}>
                <Line data={lineData} options={opcionesGrafico} />
              </div>
              <div className="text-end mt-2">
                <small className="text-muted">
                  Última actualización: {ultimaFecha}
                </small>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Alertas recientes */}
      <Card className="shadow-sm mb-4 border-0">
        <Card.Body>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="mb-0">Alertas recientes</h5>
            <span className="text-muted small">
              Muestra {alertas.length || 0}{" "}
              {alertas.length === 1 ? "alerta" : "alertas"}
            </span>
          </div>
          {alertas.length === 0 ? (
            <p className="text-muted m-0">No hay alertas en este momento.</p>
          ) : (
            <ul className="list-group">
              {alertas.map((a, i) => (
                <li
                  key={i}
                  className="list-group-item d-flex justify-content-between align-items-center"
                >
                  <div>
                    <strong>{a?.mensaje || "Alerta"}</strong>{" "}
                    <span className="text-muted">
                      •{" "}
                      {a?.fecha_lectura
                        ? new Date(a.fecha_lectura).toLocaleString()
                        : "Sin fecha"}
                    </span>
                    <div className="small">
                      Voltaje: {fmtNum(a?.voltaje, 2, " V")} · Batería:{" "}
                      {fmtNum(a?.bateria, 0, " %")} · Consumo:{" "}
                      {fmtNum(a?.consumo, 1, " W")}
                    </div>
                  </div>
                  <Badge bg="warning" text="dark">
                    Atención
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>

      {/* Perfil (básico) */}
      <Card className="shadow-sm mb-4 border-0" style={{ maxWidth: 740 }}>
        <Card.Body>
          <h5 className="mb-3">Mi perfil</h5>
          {perfil ? (
            <Row>
              <Col md={6}>
                <p className="mb-1">
                  <strong>Nombre:</strong>{" "}
                  {perfil.nombre_completo || "—"}
                </p>
                <p className="mb-1">
                  <strong>Email:</strong> {perfil.email || "—"}
                </p>
              </Col>
              <Col md={6}>
                <p className="mb-1">
                  <strong>Teléfono:</strong> {perfil.telefono || "—"}
                </p>
                <p className="mb-1">
                  <strong>Dirección:</strong> {perfil.direccion || "—"}
                </p>
              </Col>
            </Row>
          ) : (
            <p className="text-muted m-0">Cargando perfil…</p>
          )}
        </Card.Body>
      </Card>

      {/* Consejos y soporte */}
      <Row className="g-3">
        <Col md={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Body>
              <h5 className="mb-3">Consejos para ahorrar energía</h5>
              <ul className="mb-0">
                <li>Apaga dispositivos cuando no los uses.</li>
                <li>Usa equipos eficientes y horarios de baja demanda.</li>
                <li>Realiza mantenimiento preventivo regularmente.</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm border-0 h-100">
            <Card.Body>
              <h5 className="mb-3">Soporte técnico</h5>
              <p className="mb-1">
                ¿Necesitas ayuda? Escríbenos a{" "}
                {/* mailto que abre el cliente de correo */}
                <a href={soporteHref}>{SOPORTE_EMAIL}</a>.
              </p>
              <p className="mb-0">
                Teléfono: <strong>123-456-789</strong>
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
