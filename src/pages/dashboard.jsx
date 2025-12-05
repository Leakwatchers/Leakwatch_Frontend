import React, { useEffect, useState } from "react";
import { api } from "../api";
import SensorTable from "../components/SensorTable";

export default function Dashboard() {
  const [role, setRole] = useState("");

  useEffect(() => {
    detectRole();
  }, []);

  async function detectRole() {
    try {
      await api.get("/users");
      setRole("MASTER");
    } catch {
      setRole("VIEW");
    }
  }

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  return (
    <div className="app-root">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="side-brand">LeakWatcher</div>

        <nav>
          <a href="/">Dashboard</a>

          {role === "MASTER" && (
            <a href="/users">Gerenciar Usuários</a>
          )}

          <a href="/results">Resultados</a>

          <a onClick={logout} style={{cursor:"pointer"}}>Sair</a>
        </nav>

        <div className="side-footer">
          <div className="role-pill">{role}</div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="main-area">
        <div className="topbar">
          <h1>Dashboard</h1>
          <div className="role-pill">{role}</div>
        </div>

        <SensorTable role={role} />
      </main>

    </div>
  );
}
