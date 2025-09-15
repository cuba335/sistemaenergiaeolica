import Navbar from "./Navbar";
import { Outlet, useNavigate } from "react-router-dom";

const Layout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    navigate("/");
  };

  return (
    <>
      <Navbar onLogout={handleLogout} />
      <main className="container mt-4">
        <Outlet />
      </main>
    </>
  );
};

export default Layout;
