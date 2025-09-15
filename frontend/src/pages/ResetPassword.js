import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { Card, Form, Button, Alert } from "react-bootstrap";

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!pass1 || !pass2) {
      setErr("Completa ambos campos.");
      return;
    }
    if (pass1 !== pass2) {
      setErr("Las contraseñas no coinciden.");
      return;
    }
    if (pass1.length < 8) {
      setErr("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    try {
      setEnviando(true);
      await api.post("/reset-password", { token, nueva_contrasena: pass1 });
      setMsg("Contraseña actualizada. Ahora puedes iniciar sesión.");
      setTimeout(() => navigate("/"), 1500);
    } catch (e) {
      setErr(e?.response?.data?.mensaje || "No se pudo restablecer la contraseña.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="container py-5" style={{ maxWidth: 520 }}>
      <Card className="p-4 shadow-sm">
        <h4 className="mb-3">Establecer nueva contraseña</h4>
        {msg && <Alert variant="success">{msg}</Alert>}
        {err && <Alert variant="danger">{err}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Nueva contraseña</Form.Label>
            <Form.Control
              type="password"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              disabled={enviando}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Repite la contraseña</Form.Label>
            <Form.Control
              type="password"
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              disabled={enviando}
            />
          </Form.Group>

          <div className="d-grid">
            <Button type="submit" variant="success" disabled={enviando}>
              {enviando ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
