import React, { useEffect, useState } from "react";
import SensorListWidget from "../widgets/SensorListWidget.jsx";
import { api } from "../api";

export default function Dashboard() {
  const [role, setRole] = useState("");

  useEffect(() => {
    // Decodifica o JWT para pegar role (se você preferir posso fazer backend retornar /me)
    try {
      const token = localStorage.getItem("jwt");
      if (!token) return;

      const payload = JSON.parse(atob(token.split(".")[1]));
      setRole(payload.role ? payload.role.replace("ROLE_", "") : "");
    } catch {
      setRole("VIEW");
    }
  }, []);

  return (
    <div>
      <header className="topbar">
        <h1>Dashboard</h1>
        <div className="role-pill">{role || "—"}</div>
      </header>

      <section className="grid">
        {/* Lista de sensores igual à antiga */}
        <SensorListWidget />

        {/* Card de Relatórios */}
        <div className="card">
          <h3>Relatórios</h3>
          <p>Visualize relatórios gerados pelo sistema.</p>
        </div>
      </section>
    </div>
  );
}
