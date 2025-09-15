import React, { useState } from "react";
import api from "../api/axios";
import UsuarioDetalle from "./UsuarioDetalle";

function MonitoreoAdmin() {
  const [busqueda, setBusqueda] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  // 🔍 Buscar usuarios en backend
  const handleBuscar = async () => {
    try {
      const res = await api.get(`/usuarios?busqueda=${busqueda}`);
      setUsuarios(res.data); // lista de usuarios
    } catch (err) {
      console.error("Error buscando usuarios:", err);
    }
  };

  return (
    <div className="p-3">
      <h4>Modo administrador</h4>

      {/* Input + botones */}
      <div className="d-flex mb-3">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar usuario por nombre, correo, CI..."
          className="form-control"
        />
        <button onClick={handleBuscar} className="btn btn-success ms-2">
          Buscar
        </button>
        <button
          onClick={() => {
            setBusqueda("");
            setUsuarios([]);
            setUsuarioSeleccionado(null);
          }}
          className="btn btn-secondary ms-2"
        >
          Limpiar
        </button>
      </div>

      {/* Lista de resultados */}
      {usuarios.length > 0 && (
        <ul className="list-group">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="list-group-item list-group-item-action"
              onClick={() => setUsuarioSeleccionado(u)}
              style={{ cursor: "pointer" }}
            >
              {u.nombre} {u.apellido} ({u.email})
            </li>
          ))}
        </ul>
      )}

      {/* Cuando seleccionas un usuario */}
      {usuarioSeleccionado && (
        <div className="mt-4">
          <UsuarioDetalle usuario={usuarioSeleccionado} />
        </div>
      )}
    </div>
  );
}

export default MonitoreoAdmin;
