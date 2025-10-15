// src/pages/Usuarios.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Modal, Button } from "react-bootstrap";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/** Helpers de validación */
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
const passPolicy = (v) => {
  const s = String(v || "");
  return s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);
};
const onlyDigits = (v) => String(v || "").replace(/[^\d]/g, "");
const toUpperSafe = (v) => (v ? String(v).toUpperCase() : v || "");

/** Normalizador para búsqueda local */
const normLoc = (s) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function Usuarios() {
  const navigate = useNavigate();

  // Lista
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);

  // 🔎 Buscador
  const [busqueda, setBusqueda] = useState("");

  // Formulario (crear / editar)
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [rolNombre, setRolNombre] = useState("usuario");

  const [nombre, setNombre] = useState("");
  const [primerApellido, setPrimerApellido] = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");
  const [cedula, setCedula] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [rolEdicion, setRolEdicion] = useState("usuario");

  // Estados de UI
  const [guardando, setGuardando] = useState(false);
  const [borrandoId, setBorrandoId] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const [errorGlobal, setErrorGlobal] = useState("");

  // Errores / modal
  const [touched, setTouched] = useState({});
  const [showErrModal, setShowErrModal] = useState(false);
  const [modalErrors, setModalErrors] = useState([]);

  // Toggle eólico
  const [toggleId, setToggleId] = useState(null);

  // Asignar por código (cuando estoy editando)
  const [eolicoCodigoInput, setEolicoCodigoInput] = useState("");

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    try {
      setCargandoLista(true);
      setErrorGlobal("");
      // Backend debe devolver eolico_id, eolico_codigo, eolico_habilitado
      const res = await api.get("/usuarios");
      setUsuarios(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setErrorGlobal("No se pudo cargar la lista de usuarios.");
      setUsuarios([]);
    } finally {
      setCargandoLista(false);
    }
  };

  const resetForm = () => {
    setUsuario("");
    setPassword("");
    setRolNombre("usuario");
    setNombre("");
    setPrimerApellido("");
    setSegundoApellido("");
    setCedula("");
    setTelefono("");
    setDireccion("");
    setFechaNacimiento("");
    setEditingId(null);
    setRolEdicion("usuario");
    setGuardando(false);
    setTouched({});
    setModalErrors([]);
    setShowErrModal(false);
    setEolicoCodigoInput("");
  };

  /** Validaciones — crear */
  const erroresCrear = useMemo(() => {
    if (editingId) return {};
    const errs = {};
    if (!usuario.trim()) errs.usuario = "El correo es obligatorio.";
    else if (!isEmail(usuario)) errs.usuario = "Ingresa un correo válido.";
    if (!password) errs.password = "La contraseña es obligatoria.";
    else if (!passPolicy(password))
      errs.password = "Mín. 8 caracteres, con al menos 1 letra y 1 número.";
    if (!nombre.trim()) errs.nombre = "El nombre es obligatorio.";
    if (!primerApellido.trim()) errs.primerApellido = "El primer apellido es obligatorio.";
    if (!fechaNacimiento) errs.fechaNacimiento = "La fecha de nacimiento es obligatoria.";
    return errs;
  }, [usuario, password, nombre, primerApellido, fechaNacimiento, editingId]);

  /** Validaciones — actualizar */
  const erroresActualizar = useMemo(() => {
    if (!editingId) return {};
    const errs = {};
    if (!nombre.trim()) errs.nombre = "El nombre es obligatorio.";
    if (!primerApellido.trim()) errs.primerApellido = "El primer apellido es obligatorio.";
    if (!fechaNacimiento) errs.fechaNacimiento = "La fecha de nacimiento es obligatoria.";
    return errs;
  }, [nombre, primerApellido, fechaNacimiento, editingId]);

  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }));

  const openErrorsModal = (objErrores) => {
    const list = Object.values(objErrores);
    setModalErrors(list);
    setShowErrModal(true);
  };

  const handleAgregar = async () => {
    setTouched({
      usuario: true,
      password: true,
      nombre: true,
      primerApellido: true,
      fechaNacimiento: true,
    });
    if (Object.keys(erroresCrear).length > 0) {
      openErrorsModal(erroresCrear);
      return;
    }

    const payload = {
      usuario: usuario.trim().toLowerCase(), // correo en minúsculas
      contrasena: password,
      rol: rolNombre,
      nombres: toUpperSafe(nombre.trim()),
      primer_apellido: toUpperSafe(primerApellido.trim()),
      segundo_apellido: segundoApellido.trim()
        ? toUpperSafe(segundoApellido.trim())
        : null,
      ci: cedula.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim() ? toUpperSafe(direccion.trim()) : null,
      fecha_nacimiento: fechaNacimiento,
    };

    try {
      setGuardando(true);
      await api.post("/usuarios", payload);
      await cargarUsuarios();
      resetForm();
    } catch (err) {
      console.error("Error al agregar usuario:", err);
      const msg =
        err?.response?.status === 409
          ? "Ese correo ya está registrado."
          : err?.response?.data?.mensaje || "Error al agregar usuario.";
      setModalErrors([msg]);
      setShowErrModal(true);
    } finally {
      setGuardando(false);
    }
  };

  const handleEditar = (u) => {
    setNombre(u.nombres || "");
    setPrimerApellido(u.primer_apellido || "");
    setSegundoApellido(u.segundo_apellido || "");
    setCedula(u.ci || "");
    setTelefono(u.telefono || "");
    setDireccion(u.direccion || "");
    setFechaNacimiento(
      u.fecha_nacimiento ? String(u.fecha_nacimiento).split("T")[0] : ""
    );
    setEditingId(u.id_usuario);
    setRolEdicion((u.nombre_rol || "usuario").toLowerCase());
    setTouched({});
    setModalErrors([]);
    setShowErrModal(false);
    setEolicoCodigoInput("");
  };

  const handleActualizar = async () => {
    setTouched({
      nombre: true,
      primerApellido: true,
      fechaNacimiento: true,
    });

    if (Object.keys(erroresActualizar).length > 0) {
      openErrorsModal(erroresActualizar);
      return;
    }

    const payload = {
      nombres: toUpperSafe(nombre.trim()),
      primer_apellido: toUpperSafe(primerApellido.trim()),
      segundo_apellido: segundoApellido.trim()
        ? toUpperSafe(segundoApellido.trim())
        : null,
      ci: cedula.trim() || null,
      fecha_nacimiento: fechaNacimiento,
      telefono: telefono.trim() || null,
      direccion: direccion.trim() ? toUpperSafe(direccion.trim()) : null,
      rol: rolEdicion,
    };

    try {
      setGuardando(true);
      await api.put(`/usuarios/${editingId}`, payload);
      await cargarUsuarios();
      resetForm();
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
      const msg = err?.response?.data?.mensaje || "Error al actualizar usuario.";
      setModalErrors([msg]);
      setShowErrModal(true);
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async (id_usuario) => {
    if (!window.confirm("¿Está seguro de eliminar este usuario?")) return;
    try {
      setBorrandoId(id_usuario);
      await api.delete(`/usuarios/${id_usuario}`);
      await cargarUsuarios();
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      const msg = err?.response?.data?.mensaje || "Error al eliminar usuario.";
      setModalErrors([msg]);
      setShowErrModal(true);
    } finally {
      setBorrandoId(null);
    }
  };

  // 🟢 Toggle eólico: /eolicos/:id/toggle usando eolico_id
  const handleToggleEolico = async (u) => {
    if (!u?.eolico_id) return;
    const next = u.eolico_habilitado ? 0 : 1;
    try {
      setToggleId(u.id_usuario);
      await api.put(`/eolicos/${u.eolico_id}/toggle`, { activo: !!next });
      // refresco local optimista
      setUsuarios((prev) =>
        prev.map((x) =>
          x.id_usuario === u.id_usuario ? { ...x, eolico_habilitado: next } : x
        )
      );
    } catch (e) {
      alert(e?.response?.data?.mensaje || "No se pudo cambiar el estado.");
    } finally {
      setToggleId(null);
    }
  };

  // 🟢 Asignar eólico por código (cuando estoy en edición)
  const asignarEolicoPorCodigo = async () => {
    const codigo = (eolicoCodigoInput || "").trim().toUpperCase();
    if (!editingId) {
      alert("Primero selecciona un usuario para editar.");
      return;
    }
    if (codigo.length < 3) {
      alert("Código inválido.");
      return;
    }
    try {
      await api.post("/eolicos/asignar-por-codigo", {
        codigo,
        usuario_id: editingId,
      });
      setEolicoCodigoInput("");
      await cargarUsuarios();
    } catch (e) {
      alert(e?.response?.data?.mensaje || "No se pudo asignar el eólico.");
    }
  };

  // Reporte CSV
  const handleReporte = async () => {
    try {
      setDescargando(true);
      setErrorGlobal("");
      const res = await api.get("/reporte-usuarios", { responseType: "blob" });
      const dispo = res.headers["content-disposition"] || "";
      const match = dispo.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      const filename = match ? decodeURIComponent(match[1]) : "reporte_usuarios.csv";
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar reporte:", err);
      setErrorGlobal("No se pudo descargar el reporte CSV.");
    } finally {
      setDescargando(false);
    }
  };

  // Reporte PDF
  const handleReportePDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      const titulo = "Reporte de Usuarios";
      const fecha = new Date().toLocaleString();
      doc.setFontSize(16);
      doc.text(titulo, 40, 40);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generado: ${fecha}`, 40, 58);
      doc.setTextColor(0);

      const columns = [
        { header: "ID", dataKey: "id_usuario" },
        { header: "Usuario (correo)", dataKey: "usuario" },
        { header: "Rol", dataKey: "nombre_rol" },
        { header: "Nombres", dataKey: "nombres" },
        { header: "Primer Ap.", dataKey: "primer_apellido" },
        { header: "Segundo Ap.", dataKey: "segundo_apellido" },
        { header: "CI", dataKey: "ci" },
        { header: "Fecha Nac.", dataKey: "fecha_nacimiento" },
        { header: "Teléfono", dataKey: "telefono" },
        { header: "Dirección", dataKey: "direccion" },
        { header: "Código Eólico", dataKey: "eolico_codigo" },
        { header: "Estado Eólico", dataKey: "estado_eolico" },
      ];

      const rows = (usuarios || []).map((u) => ({
        id_usuario: u.id_usuario ?? "",
        usuario: u.usuario ?? "",
        nombre_rol: u.nombre_rol ?? "",
        nombres: u.nombres ?? "",
        primer_apellido: u.primer_apellido ?? "",
        segundo_apellido: u.segundo_apellido ?? "",
        ci: u.ci ?? "",
        fecha_nacimiento: u.fecha_nacimiento
          ? String(u.fecha_nacimiento).split("T")[0]
          : "",
        telefono: u.telefono ?? "",
        direccion: u.direccion ?? "",
        eolico_codigo: u.eolico_codigo ?? "—",
        estado_eolico: u.eolico_codigo
          ? u.eolico_habilitado
            ? "Activado"
            : "Desactivado"
          : "No asignado",
      }));

      autoTable(doc, {
        startY: 75,
        head: [columns.map((c) => c.header)],
        body: rows.map((r) => columns.map((c) => r[c.dataKey] ?? "")),
        styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak" },
        headStyles: { fillColor: [40, 167, 69] },
        margin: { left: 40, right: 40 },
      });

      doc.save("reporte_usuarios.pdf");
    } catch (e) {
      console.error("Error al generar PDF:", e);
      alert("No se pudo generar el PDF. Revisa la consola para más detalles.");
    }
  };

  // Check rol para acceso
  const usuarioLogueado = (() => {
    try {
      return JSON.parse(localStorage.getItem("usuario") || "{}");
    } catch {
      return {};
    }
  })();
  const rol = (usuarioLogueado.rol || "").toLowerCase();

  const fmtFecha = (f) => {
    try {
      if (!f) return "";
      const d = new Date(f);
      if (isNaN(d.getTime())) return String(f).split("T")[0] || "";
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  // Filtro local
  const usuariosFiltrados = useMemo(() => {
    const q = normLoc(busqueda);
    if (!q) return usuarios;
    return usuarios.filter((u) => {
      const campos = [
        u.id_usuario,
        u.usuario,
        u.nombre_rol,
        u.nombres,
        u.primer_apellido,
        u.segundo_apellido,
        u.ci,
        u.telefono,
        u.direccion,
        u.eolico_codigo,
      ].map((x) => normLoc(x));
      return campos.some((c) => c.includes(q));
    });
  }, [busqueda, usuarios]);

  if (rol !== "administrador") {
    return (
      <>
        <Navbar />
        <div className="container mt-5">
          <h3>🚫 Acceso denegado</h3>
          <p>Solo administradores pueden acceder a esta página.</p>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <div className="container mt-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="mb-0">👥 Gestión de Usuarios</h3>
          <div className="d-flex flex-wrap gap-2">
            <button
              className="btn btn-outline-danger"
              onClick={handleReportePDF}
              disabled={cargandoLista}
              title="Exportar a PDF"
            >
              📄 PDF
            </button>
            <button
              className="btn btn-info"
              onClick={handleReporte}
              disabled={descargando || cargandoLista}
              title="Generar Reporte de Usuarios (CSV)"
            >
              {descargando ? "Descargando..." : "📄 Reporte de Usuarios (CSV)"}
            </button>
          </div>
        </div>

        {errorGlobal && <div className="alert alert-danger">{errorGlobal}</div>}

        {/* Formulario */}
        <div className="card mb-4 shadow-sm">
          <div className="card-body">
            <h5 className="card-title mb-3">
              {editingId ? "Editar Usuario" : "Agregar Nuevo Usuario"}
            </h5>

            <div className="row">
              {/* Credenciales solo en alta */}
              {!editingId && (
                <>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Correo (usuario)</label>
                    <input
                      type="email"
                      placeholder="correo@dominio.com"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                      onBlur={() => markTouched("usuario")}
                      className={`form-control ${
                        touched.usuario &&
                        (erroresCrear.usuario ? "is-invalid" : "is-valid")
                      }`}
                    />
                    {touched.usuario && erroresCrear.usuario && (
                      <div className="invalid-feedback">{erroresCrear.usuario}</div>
                    )}
                  </div>

                  <div className="col-md-4 mb-3">
                    <label className="form-label">Contraseña</label>
                    <input
                      type="password"
                      placeholder="Mín. 8 caracteres, 1 letra y 1 número"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => markTouched("password")}
                      className={`form-control ${
                        touched.password &&
                        (erroresCrear.password ? "is-invalid" : "is-valid")
                      }`}
                    />
                    {touched.password && erroresCrear.password && (
                      <div className="invalid-feedback">{erroresCrear.password}</div>
                    )}
                  </div>

                  <div className="col-md-4 mb-3">
                    <label className="form-label">Rol</label>
                    <select
                      value={rolNombre}
                      onChange={(e) => setRolNombre(e.target.value)}
                      className="form-select"
                    >
                      <option value="usuario">Usuario</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </div>
                </>
              )}

              {/* Datos personales */}
              <div className="col-md-4 mb-3">
                <label className="form-label">Nombre</label>
                <input
                  type="text"
                  placeholder="Nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onBlur={() => markTouched("nombre")}
                  className={`form-control ${
                    touched.nombre &&
                    ((editingId ? erroresActualizar.nombre : erroresCrear.nombre)
                      ? "is-invalid"
                      : "is-valid")
                  }`}
                />
                {touched.nombre &&
                  (editingId ? erroresActualizar.nombre : erroresCrear.nombre) && (
                    <div className="invalid-feedback">
                      {editingId ? erroresActualizar.nombre : erroresCrear.nombre}
                    </div>
                  )}
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Primer Apellido</label>
                <input
                  type="text"
                  placeholder="Primer Apellido"
                  value={primerApellido}
                  onChange={(e) => setPrimerApellido(e.target.value)}
                  onBlur={() => markTouched("primerApellido")}
                  className={`form-control ${
                    touched.primerApellido &&
                    ((editingId
                      ? erroresActualizar.primerApellido
                      : erroresCrear.primerApellido)
                      ? "is-invalid"
                      : "is-valid")
                  }`}
                />
                {touched.primerApellido &&
                  (editingId
                    ? erroresActualizar.primerApellido
                    : erroresCrear.primerApellido) && (
                    <div className="invalid-feedback">
                      {editingId
                        ? erroresActualizar.primerApellido
                        : erroresCrear.primerApellido}
                    </div>
                  )}
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Segundo Apellido</label>
                <input
                  type="text"
                  placeholder="Segundo Apellido"
                  value={segundoApellido}
                  onChange={(e) => setSegundoApellido(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Cédula de Identidad</label>
                <input
                  type="text"
                  placeholder="Cédula de Identidad"
                  value={cedula}
                  onChange={(e) => setCedula(onlyDigits(e.target.value))}
                  className="form-control"
                />
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={fechaNacimiento}
                  onChange={(e) => setFechaNacimiento(e.target.value)}
                  onBlur={() => markTouched("fechaNacimiento")}
                  className={`form-control ${
                    touched.fechaNacimiento &&
                    ((editingId
                      ? erroresActualizar.fechaNacimiento
                      : erroresCrear.fechaNacimiento)
                      ? "is-invalid"
                      : "is-valid")
                  }`}
                />
                {touched.fechaNacimiento &&
                  (editingId
                    ? erroresActualizar.fechaNacimiento
                    : erroresCrear.fechaNacimiento) && (
                    <div className="invalid-feedback">
                      {editingId
                        ? erroresActualizar.fechaNacimiento
                        : erroresCrear.fechaNacimiento}
                    </div>
                  )}
              </div>

              <div className="col-md-4 mb-3">
                <label className="form-label">Teléfono</label>
                <input
                  type="text"
                  placeholder="Teléfono"
                  value={telefono}
                  onChange={(e) => setTelefono(onlyDigits(e.target.value))}
                  className="form-control"
                />
              </div>

              <div className="col-md-8 mb-3">
                <label className="form-label">Dirección</label>
                <input
                  type="text"
                  placeholder="Dirección"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="form-control"
                />
              </div>

              {/* Selector de rol visible en edición */}
              {editingId && (
                <div className="col-md-4 mb-3">
                  <label className="form-label">Rol</label>
                  <select
                    value={rolEdicion}
                    onChange={(e) => setRolEdicion(e.target.value)}
                    className="form-select"
                  >
                    <option value="usuario">Usuario</option>
                    <option value="administrador">Administrador</option>
                  </select>
                </div>
              )}

              {/* Asignar eólico por código (solo en edición) */}
              {editingId && (
                <div className="col-md-8 mb-3">
                  <label className="form-label">Asignar Eólico por Código</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej: EOL-0001"
                      value={eolicoCodigoInput}
                      onChange={(e) => setEolicoCodigoInput(e.target.value.toUpperCase())}
                    />
                    <button
                      className="btn btn-outline-success"
                      type="button"
                      onClick={asignarEolicoPorCodigo}
                    >
                      Asignar
                    </button>
                  </div>
                  <div className="form-text">
                    También puedes ir a <strong>Eólicos</strong> y asignar desde allí.
                  </div>
                </div>
              )}
            </div>

            <div className="d-flex flex-wrap gap-2">
              {editingId ? (
                <button
                  className="btn btn-warning"
                  onClick={handleActualizar}
                  disabled={guardando}
                >
                  {guardando ? "Actualizando..." : "Actualizar"}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={handleAgregar}
                  disabled={guardando}
                >
                  {guardando ? "Guardando..." : "Agregar"}
                </button>
              )}

              <button className="btn btn-secondary" onClick={resetForm} disabled={guardando}>
                Limpiar
              </button>

              {/* Acceso rápido a Eólicos (asignación) */}
              <button
                type="button"
                className="btn btn-outline-success ms-auto"
                onClick={() => navigate("/eolicos")}
                title="Ir a Asignación / Eólicos"
              >
                Ir a Eólicos
              </button>
            </div>
          </div>
        </div>

        {/* ==== Buscador ==== */}
        <div className="card shadow-sm mb-2">
          <div className="card-body d-flex flex-wrap gap-2 align-items-center">
            <div className="flex-grow-1">
              <input
                type="search"
                className="form-control"
                placeholder="Buscar por correo, nombre, apellidos, CI, teléfono, dirección o código eólico…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            {busqueda && (
              <button className="btn btn-outline-secondary" onClick={() => setBusqueda("")}>
                Limpiar búsqueda
              </button>
            )}
            <div className="ms-auto text-muted small">
              {usuariosFiltrados.length} de {usuarios.length} resultados
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between">
              <h5 className="card-title mb-0">Lista de Usuarios</h5>
              {cargandoLista && <span className="text-muted">Cargando...</span>}
            </div>

            <div className="table-responsive mt-3">
              <table className="table table-striped table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 70 }}>Nro.</th>
                    <th style={{ minWidth: 200 }}>Usuario (correo)</th>
                    <th style={{ minWidth: 120 }}>Rol</th>
                    <th style={{ minWidth: 160 }}>Nombres</th>
                    <th style={{ minWidth: 160 }}>Primer Apellido</th>
                    <th style={{ minWidth: 160 }}>Segundo Apellido</th>
                    <th style={{ minWidth: 120 }}>CI</th>
                    <th style={{ minWidth: 150 }}>Fecha Nacimiento</th>
                    <th style={{ minWidth: 130 }}>Teléfono</th>
                    <th style={{ minWidth: 220 }}>Dirección</th>
                    <th style={{ minWidth: 130 }}>Código Eólico</th>
                    <th style={{ minWidth: 120 }}>Estado</th>
                    <th style={{ minWidth: 320 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((u, idx) => {
                    const nro = idx + 1; // Nro. en vez de ID
                    const tieneEolico = !!u.eolico_codigo;
                    const habil = !!u.eolico_habilitado;
                    return (
                      <tr key={u.id_usuario} title={`ID interno: ${u.id_usuario}`}>
                        <td>{nro}</td>
                        <td className="text-break">{u.usuario || ""}</td>
                        <td>{u.nombre_rol || ""}</td>
                        <td className="text-break">{u.nombres || ""}</td>
                        <td className="text-break">{u.primer_apellido || ""}</td>
                        <td className="text-break">{u.segundo_apellido || ""}</td>
                        <td>{u.ci || ""}</td>
                        <td>{fmtFecha(u.fecha_nacimiento)}</td>
                        <td>{u.telefono || ""}</td>
                        <td className="text-break">{u.direccion || ""}</td>

                        <td>{tieneEolico ? u.eolico_codigo : "—"}</td>
                        <td>
                          {tieneEolico ? (
                            <span className={`badge ${habil ? "bg-success" : "bg-danger"}`}>
                              {habil ? "Activado" : "Desactivado"}
                            </span>
                          ) : (
                            <span className="badge bg-secondary">No asignado</span>
                          )}
                        </td>

                        <td>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              className="btn btn-sm btn-warning"
                              onClick={() => handleEditar(u)}
                            >
                              Editar
                            </button>

                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleEliminar(u.id_usuario)}
                              disabled={borrandoId === u.id_usuario}
                            >
                              {borrandoId === u.id_usuario ? "Eliminando..." : "Eliminar"}
                            </button>

                            {/* ON/OFF si tiene eólico */}
                            <button
                              className={`btn btn-sm ${habil ? "btn-success" : "btn-outline-danger"}`}
                              disabled={!u.eolico_id || toggleId === u.id_usuario}
                              onClick={() => handleToggleEolico(u)}
                              title={u.eolico_id ? "Cambiar estado" : "Sin eólico asignado"}
                            >
                              {toggleId === u.id_usuario
                                ? "Guardando..."
                                : u.eolico_id
                                  ? (habil ? "Desactivar" : "Activar")
                                  : "—"}
                            </button>

                            {/* Ir a Eólicos filtrado por este usuario */}
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => navigate(`/eolicos?userId=${u.id_usuario}`)}
                              title="Asignar / Ver eólico de este usuario"
                            >
                              Asignar/Ver Eólico
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {usuariosFiltrados.length === 0 && !cargandoLista && (
                    <tr>
                      <td colSpan="13" className="text-center text-muted">
                        No hay usuarios que coincidan con la búsqueda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2 text-end">
              <button
                className="btn btn-outline-secondary"
                onClick={cargarUsuarios}
                disabled={cargandoLista}
              >
                {cargandoLista ? "Actualizando..." : "↻ Recargar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de errores */}
      <Modal show={showErrModal} onHide={() => setShowErrModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Corrige estos campos</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalErrors.length === 0 ? (
            <div>No hay errores.</div>
          ) : (
            <ul className="mb-0">
              {modalErrors.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setShowErrModal(false)}>
            Entendido
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default Usuarios;
