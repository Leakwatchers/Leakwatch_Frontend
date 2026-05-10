import React from "react";
import SensorTable from "../components/SensorTable";
import Layout from "../components/Layout";

export default function SensorsPage({ role }) {

  function logout() {

    localStorage.clear();

    window.location.href = "/login";
  }

  return (
    <Layout
      role={role}
      onLogout={logout}
    >

      <div className="topbar">

        <h1>
          Sensores
        </h1>

        <div className="role-pill">
          {role}
        </div>

      </div>

      <div className="content">
        <SensorTable role={role} />
      </div>

    </Layout>
  );
}