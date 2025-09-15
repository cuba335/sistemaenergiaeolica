import React, { useState } from "react";
import api from "../api/axios";
import { Card, Form, Button, Alert } from "react-bootstrap";

export default function ForgotPassword() {
  const [usuario, setUsuario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");

    if (!usuario) {
      setErr("Ingresa tu correo.");
      return;
    }

    try {
      setEnviando(true);
      await api.post("/forgot-password", { usuario });
      setMsg("Si el correo existe, te enviamos un enlace para recuperar la contraseña.");
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "No se pudo enviar el correo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <Card className="p-4 shadow-sm">
        <h4 className="mb-3">Recuperar contraseña</h4>
        {msg && <Alert variant="success">{msg}</Alert>}
        {err && <Alert variant="danger">{err}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Correo</Form.Label>
            <Form.Control
              type="email"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="usuario@dominio.com"
              disabled={enviando}
            />
          </Form.Group>

          <div className="d-grid">
            <Button type="submit" variant="primary" disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar enlace"}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
