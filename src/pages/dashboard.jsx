import React, { useEffect, useState } from "react";
import { api } from "../api";
import SensorTable from "../components/SensorTable";
import Layout from "../components/Layout";

export default function Sensores() {
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
    <Layout role={role} onLogout={logout}>
      <div className="topbar">
        <h1></h1>
        <div className="role-pill">{role}</div>
      </div>

      <SensorTable role={role} />
    </Layout>
  );
}