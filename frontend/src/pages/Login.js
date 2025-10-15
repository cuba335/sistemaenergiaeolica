// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import api from "../api/axios";
import { useNavigate, Link } from "react-router-dom";
import { Form, Button, Card, Alert, Image } from "react-bootstrap";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

function Login() {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Fondo rotatorio
  const imagenesFondo = ["/paisaje1.jpg", "/paisaje2.jpg", "/paisaje3.png"];
  const [currentImage, setCurrentImage] = useState(0);

  // Fallback de logo
  const [logoError, setLogoError] = useState(false);
  const brandText = "EE"; // Cambia esto si quieres otras siglas

  const navigate = useNavigate();

  // Si ya hay sesión, ir al dashboard
  useEffect(() => {
    const token = localStorage.getItem("token");
    const rol = (localStorage.getItem("rol") || "").toLowerCase();
    if (token && rol) navigate("/dashboard", { replace: true });
  }, [navigate]);

  // Rotación de fondo
  useEffect(() => {
    const id = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % imagenesFondo.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const email = String(usuario || "").trim().toLowerCase();
    const pass = String(contrasena || "");

    if (!email || !pass) {
      setError("Por favor ingresa correo y contraseña.");
      return;
    }
    if (!isEmail(email)) {
      setError("Ingresa un correo válido (ej: usuario@dominio.com).");
      return;
    }

    try {
      setLoading(true);
      const res = await api.post("/login", { usuario: email, contrasena: pass });
      const data = res.data;
      if (!data?.success || !data?.token || !data?.rol) {
        setError(data?.mensaje || "Usuario o contraseña incorrectos");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("rol", data.rol.toLowerCase());
      localStorage.setItem(
        "usuario",
        JSON.stringify({ usuario: data.usuario, rol: data.rol.toLowerCase() })
      );
      api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;

      window.dispatchEvent(new Event("auth-changed"));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err.response) {
        if (err.response.status === 423)
          setError("Cuenta bloqueada temporalmente. Intenta más tarde.");
        else if (err.response.status === 401)
          setError("Usuario o contraseña incorrectos");
        else setError(err.response.data?.mensaje || "Error en el servidor");
      } else {
        setError("No se pudo conectar con el servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  const fondoActual = imagenesFondo[currentImage % imagenesFondo.length];

  return (
    <>
      {/* Barra superior */}
      <div
        style={{
          width: "100%",
          height: 100,
          background: "linear-gradient(90deg, #0d6efd, #198754)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: "1.8rem",
          letterSpacing: ".5px",
          textShadow: "0 2px 6px rgba(0,0,0,.25)",
        }}
      >
        Sistema de Energía Eólica
      </div>

      {/* Fondo + tarjeta */}
      <div
        style={{
          backgroundImage: `url(${fondoActual})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          height: "calc(100vh - 100px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 40px",
        }}
      >
        <Card
          style={{
            maxWidth: 500,
            width: "100%",
            background: "rgba(255,255,255,.88)",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,.05)",
            backdropFilter: "blur(2px)",
          }}
          className="p-4 shadow-lg"
        >
          <div className="text-center mb-3">
            {/* Si /logo.png carga bien -> mostrarlo; si falla -> fallback elegante */}
            {!logoError ? (
              <Image
                src="/logo.png"
                alt="Logo"
                width={140}
                height={140}
                roundedCircle
                onError={() => setLogoError(true)}
                style={{ objectFit: "cover", background: "#fff" }}
              />
            ) : (
              <div
                aria-label="Fallback Logo"
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                  fontWeight: 800,
                  fontSize: 42,
                  color: "#fff",
                  background:
                    "conic-gradient(from 210deg, #0d6efd, #20c997, #198754, #0d6efd)",
                  boxShadow: "inset 0 0 20px rgba(0,0,0,.15)",
                  userSelect: "none",
                }}
                title="Marca"
              >
                {brandText}
              </div>
            )}
          </div>

          <h3 className="text-center mb-4">Iniciar Sesión</h3>

          {error && <Alert variant="danger">{error}</Alert>}

          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3">
              <Form.Label>Correo</Form.Label>
              <Form.Control
                type="email"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                autoComplete="email"
                placeholder="usuario@dominio.com"
                disabled={loading}
                inputMode="email"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Contraseña</Form.Label>
              <Form.Control
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete="current-password"
                placeholder="Ingrese su contraseña"
                disabled={loading}
              />
            </Form.Group>

            <div className="d-grid">
              <Button variant="success" type="submit" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </div>

            <div className="text-center mt-3">
              <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
            </div>
          </Form>
        </Card>
      </div>
    </>
  );
}

export default Login;
