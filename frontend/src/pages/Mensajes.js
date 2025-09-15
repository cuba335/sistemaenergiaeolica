import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

function Mensajes() {
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Referencia a la colección "contactos" ordenada por fecha descendente
    const q = query(collection(db, "contactos"), orderBy("fecha", "desc"));

    // Suscripción en tiempo real a los cambios en Firestore
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const mensajesFirebase = [];
      querySnapshot.forEach((doc) => {
        mensajesFirebase.push({ id: doc.id, ...doc.data() });
      });
      setMensajes(mensajesFirebase);
      setCargando(false);
    });

    // Limpieza cuando el componente se desmonta
    return () => unsubscribe();
  }, []);

  if (cargando) return <p>Cargando mensajes...</p>;

  return (
    <div className="container mt-4" style={{ maxWidth: "700px" }}>
      <h2 className="mb-4">Mensajes recibidos</h2>
      {mensajes.length === 0 ? (
        <p>No hay mensajes aún.</p>
      ) : (
        <ul className="list-group">
          {mensajes.map((msg) => (
            <li key={msg.id} className="list-group-item">
              <p><strong>Mensaje:</strong> {msg.mensaje}</p>
              <p>
                <small>
                  Fecha: {msg.fecha?.toDate ? msg.fecha.toDate().toLocaleString() : "Desconocida"}
                </small>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Mensajes;
