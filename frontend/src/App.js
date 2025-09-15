// src/App.js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import Login from "./pages/Login";
import DashboardAdmin from "./pages/DashboardAdmin";
import DashboardUsuario from "./pages/DashboardUsuario";
import Usuarios from "./pages/Usuarios";
import Contactos from "./pages/Contactos";
import AlertasPage from "./pages/AlertasPage";
import Graficos from "./components/Graficos";
import Reportes from "./pages/Reportes";
import Mensajes from "./pages/Mensajes";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import UsuarioDetalle from "./pages/UsuarioDetalle";
import MonitoreoAdmin from "./pages/MonitoreoAdmin";
import Eolicos from "./pages/Eolicos";   // módulo Alquiler/Asignación

import Layout from "./components/Layout";
import Footer from "./components/Footer";

// Helpers
function getToken() {
  return localStorage.getItem("token") || null;
}
function getRol() {
  return (localStorage.getItem("rol") || "").toLowerCase();
}
function getUsuarioLS() {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "null");
  } catch {
    return null;
  }
}

// Ruta protegida
function PrivateRoute() {
  const token = getToken();
  if (!token) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Decide dashboard
function DashboardWrapper() {
  const rol = getRol();
  if (rol === "administrador") return <DashboardAdmin />;
  if (rol === "usuario") return <DashboardUsuario />;
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1 }}>
          <Routes>
            {/* Públicas */}
            <Route path="/" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Protegidas */}
            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardWrapper />} />

                {/* Solo admin */}
                <Route
                  path="/usuarios"
                  element={getRol() === "administrador" ? <Usuarios /> : <Navigate to="/dashboard" replace />}
                />
                <Route
                  path="/usuarios/:id"
                  element={getRol() === "administrador" ? <UsuarioDetalle /> : <Navigate to="/dashboard" replace />}
                />

                {/* Alquiler/Asignación (alias) */}
                <Route
                  path="/alquiler"
                  element={getRol() === "administrador" ? <Eolicos /> : <Navigate to="/dashboard" replace />}
                />
                <Route
                  path="/eolicos"
                  element={getRol() === "administrador" ? <Eolicos /> : <Navigate to="/dashboard" replace />}
                />

                {/* Autenticados (cualquier rol) */}
                <Route path="/contactos" element={<Contactos />} />
                <Route path="/mensajes" element={<Mensajes />} />
                <Route path="/alertas" element={<AlertasPage />} />
                <Route path="/graficos" element={<Graficos />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/admin/monitoreo" element={<MonitoreoAdmin />} />
              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
