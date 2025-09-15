// src/components/Navbar.js
import React, { useState, useEffect } from "react";
import {
  Navbar,
  Nav,
  Container,
  NavDropdown,
  Offcanvas,
  Button,
  Modal,
} from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import "animate.css";

function NavBarComponent({ usuario: usuarioProp, onLogout }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [me, setMe] = useState(null);             // <- /me-detalle
  const [loadingMe, setLoadingMe] = useState(true);
  const [showPerfil, setShowPerfil] = useState(false); // <- Modal "Mi perfil"

  const paisajes = ["/paisaje1.jpg", "/paisaje3.png", "/paisaje2.jpg"];
  const location = useLocation();
  const isLoginPage = location.pathname === "/" || location.pathname === "/login";

  const rolLS = (localStorage.getItem("rol") || "").toLowerCase();

  useEffect(() => {
    const interval = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % paisajes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cargar detalle del usuario (solo si hay token y no es login)
  useEffect(() => {
    let cancel = false;
    const cargar = async () => {
      try {
        setLoadingMe(true);
        const res = await api.get("/me-detalle");
        if (!cancel) setMe(res.data);
      } catch (e) {
        if (e?.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("rol");
          localStorage.removeItem("usuario");
          navigate("/", { replace: true });
        }
      } finally {
        if (!cancel) setLoadingMe(false);
      }
    };
    if (!isLoginPage && localStorage.getItem("token")) cargar();
    return () => { cancel = true; };
  }, [isLoginPage, navigate]);

  // Fallbacks
  let datosUsuarioLS = {};
  try { datosUsuarioLS = JSON.parse(localStorage.getItem("usuario") || "{}"); } catch { datosUsuarioLS = {}; }

  const rol = (me?.rol || datosUsuarioLS?.rol || rolLS || "").toLowerCase();
  const displayName =
    usuarioProp ||
    me?.nombre_completo ||
    datosUsuarioLS?.nombre ||
    datosUsuarioLS?.usuario ||
    me?.login ||
    "Usuario";

  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
    return (first + last).toUpperCase() || "U";
  };

  const handleClose = () => setShowMenu(false);
  const handleShow = () => setShowMenu(true);
  const openPerfil = () => setShowPerfil(true);
  const closePerfil = () => setShowPerfil(false);

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("rol");
      localStorage.removeItem("usuario");
      window.dispatchEvent(new Event("auth-changed"));
      navigate("/", { replace: true });
    }
  };

  const fmtFecha = (f) => {
    try {
      if (!f) return "—";
      const d = new Date(f);
      if (isNaN(d.getTime())) return String(f).split("T")[0] || "—";
      return d.toLocaleDateString();
    } catch { return "—"; }
  };

  return (
    <>
      <Navbar
        expand="lg"
        sticky="top"
        className="navbar-dark py-0 shadow animate__animated animate__fadeInDown"
        style={{
          backgroundImage: `url(${paisajes[bgIndex]})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          minHeight: "56px",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Capa oscura */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.55) 100%)",
            zIndex: 1,
          }}
        />

        <Container
          fluid
          className="d-flex justify-content-between align-items-center flex-wrap"
          style={{ position: "relative", zIndex: 2 }}
        >
          <div className="titulo-container">
            <h1
              className="titulo-animado text-white text-shadow m-0"
              style={{ fontSize: "2rem", lineHeight: "56px"}}
            >
              Sistema de Energía Eólica
            </h1>
          </div>

          {/* Enlaces desktop */}
          {!isLoginPage && (
            <div className="d-none d-lg-flex justify-content-center w-100">
              <Nav className="gap-3 nav-enlaces-grandes align-items-center">
                <Nav.Link as={Link} to="/dashboard" className="text-white nav-item-hover">
                  Principal
                </Nav.Link>
                <Nav.Link as={Link} to="/graficos" className="text-white nav-item-hover">
                  Gráficos
                </Nav.Link>

                {rol === "usuario" && (
                  <Nav.Link as={Link} to="/contactos" className="text-white nav-item-hover">
                    Contactos
                  </Nav.Link>
                )}

                {rol === "administrador" && (
                  <>
                    <Nav.Link as={Link} to="/usuarios" className="text-white nav-item-hover">
                      Usuarios
                    </Nav.Link>

                    {/* ✅ NUEVO enlace sólo para admin */}
                    <Nav.Link as={Link} to="/eolicos" className="text-white nav-item-hover">
                      Alquiler
                    </Nav.Link>

                    <Nav.Link as={Link} to="/reportes" className="text-white nav-item-hover">
                      Reportes PDF
                    </Nav.Link>
                    <Nav.Link as={Link} to="/alertas" className="text-white nav-item-hover">
                      Alertas
                    </Nav.Link>
                  </>
                )}

                <NavDropdown
                  align="end"
                  title={
                    <span className="d-inline-flex align-items-center">
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: "#28a745",
                          color: "white",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          marginRight: 8,
                        }}
                      >
                        {getInitials(displayName)}
                      </span>
                      {loadingMe ? "Cargando..." : displayName}
                    </span>
                  }
                  id="user-nav-dropdown"
                >
                  <NavDropdown.Item onClick={openPerfil}>
                    Mi perfil
                  </NavDropdown.Item>
                  <NavDropdown.Divider />
                  <NavDropdown.Item onClick={handleLogoutClick}>
                    Cerrar sesión
                  </NavDropdown.Item>
                </NavDropdown>
              </Nav>
            </div>
          )}

          {/* Botón hamburguesa (mobile) */}
          {!isLoginPage && (
            <Button
              variant="light"
              onClick={handleShow}
              className="boton-hamburguesa d-lg-none"
              aria-label="Abrir menú"
            >
              ☰
            </Button>
          )}
        </Container>
      </Navbar>

      {/* Menú lateral (mobile) */}
      {!isLoginPage && (
        <Offcanvas show={showMenu} onHide={handleClose} placement="end" style={{ width: "240px" }}>
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>Menú</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Nav className="flex-column">
              <Nav.Link as={Link} to="/dashboard" onClick={handleClose} className="nav-item-hover">
                Principal
              </Nav.Link>
              <Nav.Link as={Link} to="/graficos" onClick={handleClose} className="nav-item-hover">
                Gráficos
              </Nav.Link>

              {rol === "usuario" && (
                <Nav.Link as={Link} to="/contactos" onClick={handleClose} className="nav-item-hover">
                  Contactos
                </Nav.Link>
              )}

              {rol === "administrador" && (
                <>
                  <Nav.Link as={Link} to="/usuarios" onClick={handleClose} className="nav-item-hover">
                    Usuarios
                  </Nav.Link>

                  {/* ✅ NUEVO enlace mobile sólo admin */}
                  <Nav.Link as={Link} to="/eolicos" onClick={handleClose} className="nav-item-hover">
                    Alquiler
                  </Nav.Link>

                  <Nav.Link as={Link} to="/reportes" onClick={handleClose} className="nav-item-hover">
                    Reportes PDF
                  </Nav.Link>
                  <Nav.Link as={Link} to="/alertas" onClick={handleClose} className="nav-item-hover">
                    Alertas
                  </Nav.Link>
                </>
              )}

              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center">
                    <span
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "#28a745",
                        color: "white",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        marginRight: 8,
                      }}
                    >
                      {getInitials(displayName)}
                    </span>
                    {loadingMe ? "Cargando..." : displayName}
                  </span>
                }
                id="user-nav-dropdown"
                className="mt-2"
              >
                <NavDropdown.Item
                  onClick={() => {
                    handleClose();
                    openPerfil();
                  }}
                >
                  Mi perfil
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item
                  onClick={() => {
                    handleClose();
                    handleLogoutClick();
                  }}
                >
                  Cerrar sesión
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>
          </Offcanvas.Body>
        </Offcanvas>
      )}

      {/* Modal Mi Perfil */}
      <Modal show={showPerfil} onHide={closePerfil} centered>
        <Modal.Header closeButton>
          <Modal.Title>Mi perfil</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex align-items-center mb-3">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#28a745",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                marginRight: 12,
              }}
            >
              {getInitials(displayName)}
            </div>
            <div>
              <div className="fw-bold" style={{ fontSize: 16 }}>
                {loadingMe ? "Cargando..." : (me?.nombre_completo || displayName)}
              </div>
              <small className="text-muted">
                {me?.rol ? me.rol.charAt(0).toUpperCase() + me.rol.slice(1) : "—"}
              </small>
            </div>
          </div>

          <div className="row g-2">
            <div className="col-12 col-md-6">
              <div className="border rounded p-2 h-100">
                <div className="text-muted small">Usuario (login)</div>
                <div>{me?.login || "—"}</div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="border rounded p-2 h-100">
                <div className="text-muted small">Email</div>
                <div>{me?.email || "—"}</div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="border rounded p-2 h-100">
                <div className="text-muted small">Fecha de nacimiento</div>
                <div>{fmtFecha(me?.fecha_nacimiento)}</div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="border rounded p-2 h-100">
                <div className="text-muted small">Teléfono</div>
                <div>{me?.telefono || "—"}</div>
              </div>
            </div>

            <div className="col-12">
              <div className="border rounded p-2 h-100">
                <div className="text-muted small">Dirección</div>
                <div>{me?.direccion || "—"}</div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closePerfil}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        .nav-item-hover { cursor: pointer; }
        .nav-item-hover:hover,
        .nav-item-hover:active { text-decoration: underline; }
        .text-shadow { text-shadow: 0 2px 6px rgba(0,0,0,.35); }
      `}</style>
    </>
  );
}

export default NavBarComponent;
