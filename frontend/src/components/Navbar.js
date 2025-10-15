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
  Spinner,
  Badge,
} from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import "animate.css";

function NavBarComponent({ usuario: usuarioProp, onLogout }) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [me, setMe] = useState(null);                   // /me-detalle
  const [loadingMe, setLoadingMe] = useState(true);
  const [showPerfil, setShowPerfil] = useState(false);  // Modal "Mi perfil"

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

  // Cargar detalle del usuario
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

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text || "");
    } catch { /* no-op */ }
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
              style={{ fontSize: "2rem", lineHeight: "56px" }}
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
                          background: "linear-gradient(135deg,#22c55e,#16a34a)",
                          color: "white",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          marginRight: 8,
                          boxShadow: "0 0 0 2px rgba(255,255,255,.2)",
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
                        background: "linear-gradient(135deg,#22c55e,#16a34a)",
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

      {/* Modal Mi Perfil (fullscreen en móviles) */}
      <Modal
        show={showPerfil}
        onHide={closePerfil}
        centered
        dialogClassName="modal-fullscreen-sm-down"
      >
        <div className="position-relative">
          {/* Cover */}
          <div
            style={{
              height: 140,
              background:
                "linear-gradient(135deg, rgba(34,197,94,0.9), rgba(16,185,129,0.9)), url('/paisaje2.jpg') center/cover",
              borderTopLeftRadius: ".3rem",
              borderTopRightRadius: ".3rem",
            }}
          />
          {/* Avatar */}
          <div
            style={{
              position: "absolute",
              top: 90,
              left: 24,
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#22c55e,#16a34a)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              boxShadow: "0 6px 18px rgba(0,0,0,.2)",
              border: "3px solid white",
            }}
          >
            {getInitials(displayName)}
          </div>
        </div>

        <Modal.Header closeButton className="pt-4" />

        <Modal.Body>
          {/* Header info */}
          <div className="d-flex flex-wrap align-items-end gap-2 ps-2" style={{ marginTop: -32 }}>
            <div className="me-auto" style={{ minWidth: 0 }}>
              <div className="fw-bold" style={{ fontSize: 18 }}>
                {loadingMe ? (
                  <span className="text-muted">
                    <Spinner animation="grow" size="sm" /> Cargando…
                  </span>
                ) : (
                  me?.nombre_completo || displayName
                )}
              </div>
              {/* login puede ser largo: permitir quiebre */}
              <div
                className="text-muted small text-break"
                style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
              >
                {me?.login || "—"}
              </div>
            </div>
            {rol && (
              <Badge bg={rol === "administrador" ? "danger" : "success"} pill>
                {rol.charAt(0).toUpperCase() + rol.slice(1)}
              </Badge>
            )}
          </div>

          {/* Datos */}
          <div className="row g-3 mt-2">
            <div className="col-12 col-md-6">
              <div className="border rounded px-3 py-2 h-100">
                <div className="d-flex justify-content-between align-items-center" style={{ gap: 8 }}>
                  {/* minWidth:0 para que funcione el truncado/quiebre dentro de flex */}
                  <div style={{ minWidth: 0 }}>
                    <div className="text-muted small">Usuario (login)</div>
                    <div
                      className="fw-semibold text-break"
                      style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                    >
                      {me?.login || "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => copy(me?.login)}
                    title="Copiar"
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="border rounded px-3 py-2 h-100">
                <div className="d-flex justify-content-between align-items-center" style={{ gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="text-muted small">Email</div>
                    <div
                      className="fw-semibold text-break"
                      style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                    >
                      {me?.email || "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => copy(me?.email)}
                    title="Copiar"
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="border rounded px-3 py-2 h-100">
                <div className="text-muted small">Fecha de nacimiento</div>
                <div className="fw-semibold">{fmtFecha(me?.fecha_nacimiento)}</div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="border rounded px-3 py-2 h-100">
                <div className="text-muted small">Teléfono</div>
                <div className="fw-semibold">{me?.telefono || "—"}</div>
              </div>
            </div>

            <div className="col-12">
              <div className="border rounded px-3 py-2 h-100">
                <div className="text-muted small">Dirección</div>
                <div
                  className="fw-semibold text-break"
                  style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                >
                  {me?.direccion || "—"}
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>

        <Modal.Footer className="d-flex justify-content-between">
          <div className="text-muted small">
            {me?.email ? "Tus datos se muestran solo a ti." : ""}
          </div>
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
        /* Ajustes del modal en pantallas pequeñas */
        @media (max-width: 576px) {
          .modal-fullscreen-sm-down .modal-body { padding-top: .5rem; }
        }
      `}</style>
    </>
  );
}

export default NavBarComponent;
