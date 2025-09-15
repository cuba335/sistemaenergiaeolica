// src/pages/DetalleUsuario.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, Row, Col, Form, Button, Alert } from "react-bootstrap";
import api from "../api/axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, TimeScale);

const hoy = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function DetalleUsuario() {
  const { id } = useParams(); // id_usuario
  const [usuarios, setUsuarios] = useState([]);
  const [desde, setDesde] = useState(haceDias(7));
  const [hasta, setHasta] = useState(hoy());
  const [lecturas, setLecturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Carga usuarios para identificar la ficha del seleccionado
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await api.get("/usuarios");
        if (!cancel) setUsuarios(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Carga lecturas del rango (admin)
  const cargarLecturas = async () => {
    setErr("");
    try {
      setLoading(true);
      const res = await api.get("/resumen/admin-rango", {
        params: { desde, hasta },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      // Filtramos por este usuario
      setLecturas(rows.filter((r) => String(r.usuario_id) === String(id)));
    } catch (e) {
      console.error(e);
      setErr("No se pudieron cargar las lecturas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarLecturas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const usuarioSel = useMemo(
    () => usuarios.find((u) => String(u.id_usuario) === String(id)),
    [usuarios, id]
  );

  const labels = lecturas.map((r) =>
    new Date(r.fecha_lectura).toLocaleString()
  );

  const mkLine = (label, field) => ({
    labels,
    datasets: [
      {
        label,
        data: lecturas.map((r) => Number(r[field] ?? 0)),
        fill: false,
        tension: 0.2,
      },
    ],
  });

  const fmt = (v) => (v == null || v === "" ? "—" : v);

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">👤 Detalle de usuario</h3>
        <Link to="/usuarios" className="btn btn-outline-secondary">← Volver</Link>
      </div>

      {!usuarioSel ? (
        <Alert variant="warning">Cargando usuario…</Alert>
      ) : (
        <Card className="mb-3">
          <Card.Body>
            <Row className="gy-2">
              <Col md={3}><strong>ID:</strong> {usuarioSel.id_usuario}</Col>
              <Col md={3}><strong>Login:</strong> {fmt(usuarioSel.usuario)}</Col>
              <Col md={3}><strong>Rol:</strong> {fmt(usuarioSel.nombre_rol)}</Col>
              <Col md={3}><strong>CI:</strong> {fmt(usuarioSel.ci)}</Col>
              <Col md={4}><strong>Nombres:</strong> {fmt(usuarioSel.nombres)}</Col>
              <Col md={4}><strong>Primer Ap.:</strong> {fmt(usuarioSel.primer_apellido)}</Col>
              <Col md={4}><strong>Segundo Ap.:</strong> {fmt(usuarioSel.segundo_apellido)}</Col>
              <Col md={4}><strong>Teléfono:</strong> {fmt(usuarioSel.telefono)}</Col>
              <Col md={8}><strong>Dirección:</strong> {fmt(usuarioSel.direccion)}</Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      <Card className="mb-3">
        <Card.Body>
          <Form className="row g-2 align-items-end">
            <div className="col-auto">
              <Form.Label className="mb-0">Desde</Form.Label>
              <Form.Control type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="col-auto">
              <Form.Label className="mb-0">Hasta</Form.Label>
              <Form.Control type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <div className="col-auto">
              <Button onClick={cargarLecturas} disabled={loading}>
                {loading ? "Cargando…" : "Actualizar"}
              </Button>
            </div>
          </Form>
          {err && <Alert className="mt-2" variant="danger">{err}</Alert>}
        </Card.Body>
      </Card>

      <Row className="g-3">
        <Col md={12}>
          <Card>
            <Card.Header>Voltaje</Card.Header>
            <Card.Body><Line data={mkLine("Voltaje (V)", "voltaje")} /></Card.Body>
          </Card>
        </Col>
        <Col md={12}>
          <Card>
            <Card.Header>Batería</Card.Header>
            <Card.Body><Line data={mkLine("Batería (%)", "bateria")} /></Card.Body>
          </Card>
        </Col>
        <Col md={12}>
          <Card>
            <Card.Header>Consumo</Card.Header>
            <Card.Body><Line data={mkLine("Consumo (W)", "consumo")} /></Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mt-3">
        <Card.Header>Lecturas (tabla)</Card.Header>
        <Card.Body className="table-responsive">
          <table className="table table-sm table-striped">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Voltaje</th>
                <th>Batería</th>
                <th>Consumo</th>
              </tr>
            </thead>
            <tbody>
              {lecturas.map((r, i) => (
                <tr key={i}>
                  <td>{new Date(r.fecha_lectura).toLocaleString()}</td>
                  <td>{fmt(r.voltaje)}</td>
                  <td>{fmt(r.bateria)}</td>
                  <td>{fmt(r.consumo)}</td>
                </tr>
              ))}
              {lecturas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted">
                    No hay datos en el rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card.Body>
      </Card>
    </div>
  );
}
